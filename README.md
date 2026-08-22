# FitModel · 选型指南

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/Content-CC_BY_4.0-lightgrey.svg)](./LICENSE-CONTENT)
[![Astro](https://img.shields.io/badge/Astro-5-BC52EE.svg?logo=astro&logoColor=white)](https://astro.build)

「该用什么 AI?」——先说任务,再选模型。

**线上地址:<https://ie2718.github.io/fitmodel/>**

面向知识工作者的 AI 选型站:按**场景**(写作、编程、研究、办公、创意)给出三档推荐(免费够用 / 性价比 / 最强),附理由、价格、国内可用性与数据依据。覆盖全球与国产主流模型与工具。

## 为什么做

大模型两周一个版本,价格随时在变,评测口径五花八门,多数推荐文章说不清数据从哪来、是不是还新鲜。这个项目的做法是把「推荐」变成**可回查的计算**:每条参与评分的数据都带来源链接与采集日期,排名由算法从证据库生成,谁都不能手改;数据过期自动失效,并在页面上公示。

## 核心设计

- **场景优先**:首页按任务导航,每个场景页直接给答案(TL;DR),不要求用户先懂模型。
- **证据驱动**:所有入分数据存于 `src/data/evidence.yaml`,每条带 `source_url` 与 `retrieved_at`;评分实体精确到模型变体(如 `claude-opus-4-8`),不带来源的数据不得参与评分。
- **观点与数据分层**:人为输入只有场景维度权重(公示于每个场景页顶部)与避坑正文;权重、正文、指标注册归人工,事实数据由维护 agent 按周同步。分工协议见 [`AGENTS.md`](./AGENTS.md)。
- **构建即校验**:`npm run build` 同时执行数据审计——未注册指标直接构建失败,过期 / 域外 / 冲突数据仅展示不入分。
- **透明留痕**:全部变更记录在站内 `/changelog`,页首鲜度徽章标注数据年龄。

## 场景覆盖(15 个)

| 分类 | 场景 |
| --- | --- |
| 写作 | 日常写作(邮件/周报/文案) · 长文创作 · 论文写作 · 翻译 |
| 编程 | IDE 编码 · Agent 工程 · 原型生成 · 代码审查 |
| 研究 | 深度研究 · 搜索问答 · 长文档分析 |
| 办公 | PPT · 表格分析 · 会议纪要 |
| 创意 | 图像生成 |

其中「会议纪要」「图像生成」因专项指标尚未建库,暂不参与评分(页面会说明原因);其余 13 个场景的三档推荐全部由算法在构建时生成。

## 评分如何工作

构建时,`src/lib/scoring.ts` 对每个场景执行固定流水线:

1. **校验**:指标必须已在 `metrics.yaml` 注册,否则构建失败;证据超过时效窗口(`freshness_days`)或超出合理域(`plausible`)→ 仅展示不入分;同日同指标证据分歧 >10% → 降低置信度。
2. **归一化**:同一指标内做百分位归一化,消除量纲差异。
3. **聚合**:按场景声明的维度权重(`general` / `coding` / `writing` / `long_context`)加权得「场景适配分」,同时输出置信度(权重覆盖率 × 来源质量 × 证据一致性)与性价比分。
4. **出档**:TOP = 场景排名第 1;VALUE = 性价比分最高(且不与 TOP 重复);FREE = 有免费额度的产品中,底座模型适配分最高。

完整方法论(含局限说明)见站内 `/methodology` 页面。

## 开发

要求 Node.js ≥ 20.3。

```bash
npm install
npm run dev              # 本地开发 http://localhost:4321
npm run build            # 构建到 dist/(同时校验全部 schema 与证据)
npm run preview          # 预览构建产物
npm run check:freshness  # 鲜度巡检:哪个指标该重采、余量几天;超窗非零退出
```

## 目录结构

```
src/
├── content.config.ts    # 全部数据的 schema 定义(权重和=1 等约束,构建时强制执行)
├── content/scenarios/   # 15 个场景页(维度权重 frontmatter + 避坑建议正文)
├── data/
│   ├── metrics.yaml     # 指标注册表(入分指标白名单,新增需人工审批)
│   ├── evidence.yaml    # 证据库(全部可溯源数据,带 source_url 与采集日期)
│   ├── models.yaml      # 大模型家族元信息
│   ├── products.yaml    # 产品/工具数据
│   └── changelog.yaml   # 更新日志
├── lib/
│   ├── scoring.ts       # 评分引擎(校验 → 归一化 → 场景适配分/置信度/性价比)
│   ├── engine.ts        # 构建时装配评分引擎
│   ├── picks.ts         # 三档推荐计算(首页与场景页共用口径)
│   └── meta.ts          # 分类、档位、可用性等展示元数据
├── pages/               # 首页 / 场景页 / 模型库 / 榜单 / 方法论 / 更新日志
└── components/          # SiteHeader / SiteFooter
scripts/
└── check-freshness.mjs  # 鲜度巡检(可作 CI 与定时同步的门禁)
AGENTS.md                # 维护协议:agent 管数据层,人工管观点层
```

## 维护工作流

1. **定期同步**(每周一 09:00,维护 agent 自动执行):`npm run check:freshness` 巡检 → 按来源白名单采集 → 写入 `evidence.yaml` → `npm run build` 校验 → 波及分析 → `changelog.yaml` 留痕 → 复核鲜度。流程细节见 `AGENTS.md`。
2. **触发式采集**:价格变动、新模型发布等不受周期限制,随时补采。
3. **结论变更**:推荐结论如需调整,agent 出建议、人工确认;场景 `status: draft → verified` 与证据 `verified` 抽查仅人工执行。

## 贡献

- **数据修正/补充**:欢迎提 PR。新证据必须带 `source_url` 与 `retrieved_at`,来源限于 `AGENTS.md` 白名单,格式如下:

  ```yaml
  - id: ev-arena-067            # ev-<来源缩写>-<序号>
    metric: arena_elo_overall   # 必须是 metrics.yaml 已注册的指标
    subject: claude             # models.yaml 中的模型家族 id
    variant: claude-opus-4-8    # 评分实体(具体变体名)
    value: 1498
    source: arena.ai leaderboard
    source_url: https://arena.ai/leaderboard
    retrieved_at: 2026-08-22
    verified: false             # 人工抽查后置 true
    notes: 总榜第 N;口径说明
  ```

- **指标注册、场景权重、场景正文**:属于「观点层」,以 issue 讨论为主,由维护者确认后修改。
- 分工边界与采集流程详见 [`AGENTS.md`](./AGENTS.md)。

## 部署

推送到 `main` 即自动部署到 GitHub Pages([workflow](./.github/workflows/deploy.yml)),站点地址 <https://ie2718.github.io/fitmodel/>。站内链接经 `siteUrl()` 自动带 `/fitmodel` 子路径前缀(`astro.config.mjs` 的 `base`)。

迁移到 Vercel / Cloudflare Pages 或自定义域名时:改掉(或删掉)`astro.config.mjs` 里的 `site` 与 `base` 即可,构建命令 `npm run build`,产物目录 `dist`。

## 许可

- **代码**(页面、评分引擎、脚本、配置):[MIT](./LICENSE)
- **内容**(场景文章、`src/data/*.yaml`):[CC BY 4.0](./LICENSE-CONTENT),再分发需注明来源
- 证据数据采自第三方公开来源(arena.ai、SWE-bench、各厂商定价页),各来源站点条款对其数据另有约束,详见 `LICENSE-CONTENT`。

## 路线图

- [ ] 首轮人工复审:15 个场景 `draft → verified`,数据核实去「待核实」
- [ ] 补齐 `context_window_k` 等缺口指标,开放会议纪要 / 图像生成场景评分
- [ ] 模型详情页(数据卡片深化)
- [ ] 对比页(如 claude-vs-gpt,吃 SEO 长尾词)
- [ ] 英文版(i18n 已预留:内容与文案分离)
- [ ] 社区投票(冷启动后再考虑)
