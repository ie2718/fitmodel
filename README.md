# FitModel · 选型指南

「该用什么 AI？」——先说任务，再选模型。

面向知识工作者的 AI 选型站：按**场景**（写作、编程、研究、办公、创意）给出三档推荐（免费够用 / 性价比 / 最强），附理由、价格、国内可用性与数据依据。覆盖全球与国产主流模型、工具。

## 核心设计

- **场景优先**：首页按任务导航，每个场景页直接给答案（TL;DR），不要求用户先懂模型。
- **结论与数据分离**：编辑观点放 `src/content/scenarios/*.md`；客观数据（价格、版本、可用性）放 `src/data/*.yaml`，驱动页面渲染。新模型发布后只需更新数据文件 + 复审受影响结论。
- **agent + 人工分工维护**：见 `AGENTS.md`——agent 负责数据层的事实更新，推荐结论的变更由人工确认。公信力来自公开的更新日志（`/changelog`）与页首的「已验证」鲜度徽章。

## 开发

```bash
npm install
npm run dev      # 本地开发 http://localhost:4321
npm run build    # 构建到 dist/（同时校验全部数据 schema）
npm run preview  # 预览构建产物
```

## 目录结构

```
src/
├── content/scenarios/   # 15 个场景页(维度权重 frontmatter + 编辑观点正文)
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
└── check-freshness.mjs  # 鲜度巡检(超窗即非零退出,可作 CI 门禁)
AGENTS.md                # 维护协议:agent 管数据层,人工管观点层
```

## 维护工作流

1. **定期同步**(每周一 09:00,维护 agent 自动执行):`npm run check:freshness` 巡检 → 按来源白名单采集 → 写入 `evidence.yaml` → `npm run build` 校验 → 波及分析 → `changelog.yaml` 留痕 → 复核鲜度。流程细节见 `AGENTS.md`。
2. **触发式采集**:价格变动、新模型发布等不受周期限制,随时补采。
3. **结论变更**:推荐结论如需调整,agent 出建议、人工确认;场景 `status: draft → verified` 与证据 `verified` 抽查仅人工执行。

## 贡献

- **数据修正/补充**:欢迎提 PR,新证据必须带 `source_url` 与 `retrieved_at`(格式见 `evidence.yaml` 头部注释),来源限于 `AGENTS.md` 白名单。
- **指标注册、场景权重、场景正文**:属于「观点层」,以 issue 讨论为主,由维护者确认后修改。
- 分工边界与采集流程详见 `AGENTS.md`。

## 许可

- **代码**(页面、评分引擎、脚本、配置):[MIT](./LICENSE)
- **内容**(场景文章、`src/data/*.yaml`):[CC BY 4.0](./LICENSE-CONTENT),再分发需注明来源
- 证据数据采自第三方公开来源(arena.ai、SWE-bench、各厂商定价页),各来源站点条款对其数据另有约束,详见 `LICENSE-CONTENT`。

## 部署

任意静态托管：Vercel / Cloudflare Pages / GitHub Pages，构建命令 `npm run build`，产物目录 `dist`。部署前把 `astro.config.mjs` 的 `site` 换成真实域名。

## 路线图

- [ ] 首轮人工复审：15 个场景 `draft → verified`，数据核实去「待核实」
- [ ] 模型详情页（数据卡片深化）
- [ ] 对比页（如 claude-vs-gpt，吃 SEO 长尾词）
- [ ] 英文版（i18n 已预留：内容与文案分离）
- [ ] 社区投票（冷启动后再考虑）
