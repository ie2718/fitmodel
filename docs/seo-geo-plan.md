# FitModel SEO + GEO 优化方案

> 制定日期:2026-08-22。本文件是实施方案,未落地任何代码;实施时从 P0 起步,完成后在 `changelog.yaml` 留痕。
> 决策已确认:OG 分享图采用一张静态默认图(全站复用);robots.txt 对 AI 爬虫(GPTBot / ClaudeBot / PerplexityBot 等)全部明确允许。

## 一、现状诊断

站点:Astro 5 纯静态,20 个页面(首页 + 15 场景页 + leaderboards / models / methodology / changelog),部署于 `https://ie2718.github.io/fitmodel/`(GitHub Pages 项目页子路径)。

**已有的(仅 5 项)**:per-page title、meta description、og:title、og:description、favicon;`site`/`base` 配置与 `siteUrl()` 子路径前缀机制(`src/lib/meta.ts`),为补绝对 URL 提供了现成基础。

**缺失的(按影响排序)**:

1. 无 sitemap(未装 `@astrojs/sitemap`)
2. 无 robots.txt(`public/` 只有 favicon.svg)
3. 无 canonical;`trailingSlash: 'ignore'` 且站内链接尾斜杠不统一(导航链接不带、场景链接带),GH Pages 上两种形式都可能 200,有重复内容隐患
4. OG 不完整:缺 og:url / og:type / og:site_name / og:locale / og:image;Twitter Card 完全没有
5. 无任何 og:image(全站无图片资源,社交分享是裸链)
6. 无 JSON-LD 结构化数据(全站 `application/ld+json` 零命中)
7. 无 RSS(changelog / evidence 每周更新的站点尤其可惜)
8. 无 llms.txt(一个面向 AI 选型、数据全结构化的站点正适合提供)
9. 无自定义 404 页
10. 首页裸用 Base 布局默认 meta(未传 title/description props)

## 二、目标与原则

- **SEO 目标**:20 个页面被正确抓取、索引;场景页吃住「XX 场景用什么模型 / AI 怎么选」类搜索意图;搜索展现(富摘要、分享卡)完整。
- **GEO 目标**:让生成式引擎(ChatGPT、Perplexity、Claude 等)能高效抽取本站的推荐结论、数据与时效信号,并在回答中引用。
- **AGENTS.md 合规红线**:场景 md 正文与权重不碰、指标注册不碰、evidence 数据不碰、排名一律取自 `scoring.ts` 构建时输出(绝不手写进 JSON-LD 或文案);每次实施后在 `changelog.yaml` 追加条目;`npm run build` 即校验,构建失败必须修复。

## 三、P0:技术基建 + 核心结构化数据(一次上线)

### 3.1 完善 Base.astro 的 SEO head(全站一次生效)

扩展 `src/layouts/Base.astro` 的 `<head>`,Props 增加 `image` / `type` / `noindex`:

- `canonical`:`new URL(Astro.url.pathname, Astro.site)` 生成绝对 URL,自动带 `/fitmodel` 前缀,迁自定义域名零改动
- `og:url` / `og:type`(首页 website、场景页 article)/ `og:site_name`(FitModel)/ `og:locale`(zh_CN)/ `og:image`(绝对 URL)
- `twitter:card` = summary_large_image + twitter:title / description / image
- `robots` meta = `index, follow`;`status: draft` 的场景页输出 `noindex`(frontmatter 数据驱动,status 变 verified 后重建即自动恢复索引)

### 3.2 URL 规范化

`astro.config.mjs` 的 `trailingSlash` 从 `'ignore'` 改为 `'always'`;`SiteHeader.astro` 等站内链接统一带尾斜杠,消除 `/fitmodel/leaderboards` 与 `/fitmodel/leaderboards/` 双 URL 隐患。

### 3.3 sitemap + robots.txt

- 安装 `@astrojs/sitemap` 并注册集成(`site` 已配好,零成本产出 `sitemap-index.xml`),`filter` 排除 draft 场景页
- 新增 `public/robots.txt`:全部爬虫明确允许,含 AI 爬虫逐条显式 Allow(GPTBot、ClaudeBot、OAI-SearchBot、PerplexityBot、Google-Extended、Bytespider、CCBot 等),并声明 `Sitemap: https://ie2718.github.io/fitmodel/sitemap-index.xml`
- ⚠️ **已知限制**:GH Pages 项目页的 robots.txt 实际服务于 `/fitmodel/robots.txt` 而非域名根,规范上搜索引擎只认根级;当前阶段索引入口主要靠 Search Console 手动提交 sitemap + 页面级 meta,迁自定义域名后完全生效

### 3.4 og:image 静态默认图

生成一张 1200×630 品牌默认图存 `public/og-default.png`,全站复用。以现有 favicon 的紫底白「适」字视觉延展,含站名与「证据驱动的 AI 选型指南」标语。

### 3.5 自定义 404 页

新增 `src/pages/404.astro`:说明 + 返回首页 + 热门场景链接(GH Pages 自动生效)。

### 3.6 元数据文案优化

- 首页显式定制 title / description:title 含「AI 模型选型」核心词、30 字内;description 含「证据驱动」「每周更新」「免费 / 性价比 / 最强三档」差异化点
- 场景页 title 模板从 `${d.title} — FitModel` 调整为吃搜索意图的形态,如 `${d.title}用什么 AI?证据驱动的模型推荐 | FitModel`
- 实施时核对各页 H1 唯一性与 heading 层级

### 3.7 JSON-LD 结构化数据

新增 `src/components/JsonLd.astro`(JSON.stringify 后转义 `<`,防 `</script>` 注入,构建时注入):

- **首页**:`WebSite`(name / url / inLanguage zh-CN)+ 简版 `Organization`
- **场景页**:`BreadcrumbList`(首页 > 分类 > 场景)+ `ItemList`(排名前 10,position / name 来自 `rank()` 构建时输出)
- **leaderboards + methodology 页**:`Dataset`——`variableMeasured` 为 8 个注册指标、`citation` 汇总来源 URL、`dateModified` 取最新 evidence 的 `retrieved_at`
- 所有 `dateModified` 均用数据真实日期(evidence 最新采集日 / 场景 `last_verified`),给搜索引擎与 AI 明确时效信号

### 3.8 GEO 专属:llms.txt + 答案前置

- 新增 `src/pages/llms.txt.ts`,构建时从数据生成:站点定位与方法论一段话 + 15 个场景清单(每条 = title + 三档推荐一句话结论 + 绝对 URL)+ 数据更新频率说明;README 注明地址
- 场景页「推荐」区上方增加一句**构建时生成的直接回答**(如「截至 2026-08-22,基于 N 条公开证据,X 场景综合最强:Claude …」)——数据驱动、非编辑观点,不触碰人工正文;生成式引擎偏爱首屏直接答案
- 现有基础保留并放大:语义化 `<table>`、evidence 可回查外链、鲜度徽章、JSON-LD 时效字段

## 四、P1:增强项(第二批,按需)

1. **RSS**:`@astrojs/rss`,以 changelog 为数据源输出 `/rss.xml`
2. **每页动态 OG 图**:引入 satori 在构建时为 15 个场景页生成带标题的分享图(增加依赖与构建时间)
3. **FAQPage JSON-LD**:仅数据驱动问答(如「XX 场景免费档用什么?」),答案取自 `computePicks()`,不涉及编辑观点;注:Google 已限制 FAQ 富摘要展示,此项主要服务 GEO
4. **llms-full.txt**:含全部排名表格纯文本
5. **IndexNow**:deploy.yml 构建后主动 ping(Bing 等快速收录)
6. **首页搜索支持 `?q=` 预填**:配合 `WebSite` + `SearchAction` 结构化数据

## 五、P2:内容层扩展(人工主导,agent 不碰正文)

- 对比长尾页(「Claude vs GPT 写代码」等,README 路线图已列)
- 英文版 i18n + hreflang

## 六、实施时的文件改动清单(P0)

| 文件 | 动作 |
| --- | --- |
| `astro.config.mjs` | +sitemap 集成,trailingSlash: 'always' |
| `package.json` | +`@astrojs/sitemap` |
| `src/layouts/Base.astro` | 完整 SEO head |
| `src/components/JsonLd.astro` | 新增 |
| `src/pages/404.astro`、`src/pages/llms.txt.ts` | 新增 |
| `src/pages/index.astro` 及其余 5 类页面 | 定制 meta props + 注入 JSON-LD |
| `src/components/SiteHeader.astro` | 链接尾斜杠统一 |
| `public/robots.txt`、`public/og-default.png` | 新增 |
| `src/data/changelog.yaml` | 追加实施条目(agent 职责) |
| `README.md` | 部署节补 sitemap / llms.txt 说明 |

## 七、验收标准(P0 完成定义)

- `npm run build` 通过(构建 = 校验)
- dist 抽查:每页 canonical 为带 `/fitmodel` 前缀的绝对 URL 且尾斜杠一致;og:image 可访问;JSON-LD 通过 validator.schema.org;sitemap-index.xml 页数 = 20 − draft 页数;llms.txt 内容与数据一致
- 本地 Lighthouse SEO ≥ 95

## 八、交付后人工动作(不涉及代码)

1. Google Search Console / Bing Webmaster 验证站点,提交 `https://ie2718.github.io/fitmodel/sitemap-index.xml`
2. 可选:在用户站点仓库(ie2718.github.io)放根级 robots.txt 声明项目 sitemap,弥补子路径限制
3. 微信 / Telegram 等社交平台分享预览抽查

## 九、实施备注(2026-08-22 执行记录)

- P0 已全部落地;P1(RSS、动态 OG 图、FAQPage、llms-full.txt、IndexNow)与 P2 未动。
- **与方案的偏差**:3.1 / 3.3 中「draft 场景页 noindex 且不进 sitemap」**暂不启用**——实施时发现当前 15 个场景全部为 `status: draft`(等首轮人工复审),启用该规则会把全站核心内容整体排除出索引,违背 SEO 目标。现状:所有页面正常收录、全量进 sitemap。待人工复审产出首批 `verified` 场景后,再开启「draft 不入索引」规则(届时在 Base.astro 按 frontmatter status 输出 noindex + sitemap filter)。
- OG 分享图由 HTML + Chrome 无头截图生成(`public/og-default.png`,1200×630),视觉沿用 favicon 的靛蓝与「适」字标。

