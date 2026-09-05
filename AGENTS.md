# AGENTS.md — FitModel 维护协议（证据驱动版）

本仓库由「维护 agent + 人工」共同维护。任何 agent（定时任务或人工唤起）修改内容前必须读本文件。

## 分工原则（不可违反）

| 内容 | 位置 | 谁可以改 | 规则 |
| --- | --- | --- | --- |
| 证据（原始数据） | `src/data/evidence.yaml` | agent 可直接追加 | 必须带 source_url、retrieved_at、metric id |
| 指标定义 | `src/data/metrics.yaml` | agent 建议新增，人工确认 | 新指标需人工审批后才生效 |
| 模型/产品元信息 | `src/data/models.yaml` / `products.yaml` | agent 可改（附来源） | 可用性等主观字段需人工确认 |
| 场景维度权重 | `src/content/scenarios/*.md` frontmatter | agent 可建议调整，人工确认 | 权重之和必须为 1（schema 强制校验） |
| 场景正文（避坑/建议） | `src/content/scenarios/*.md` body | 仅人工 | agent 不可改编辑观点 |
| 排名结果 | 构建时由 scoring.ts 计算 | 不可手动修改 | 改数据 → 重建 → 排名自动更新 |
| 更新日志 | `src/data/changelog.yaml` | agent 每次维护后追加 | 不可删除历史条目 |

核心原则：**agent 管数据层（证据 + 元信息），人工管观点层（权重 + 正文 + 指标注册）。排名是算法的输出，谁都不直接改。**

## 采集流程

### 最小操作卡（任何 agent 从这里开始）

```text
npm run sync          # ① 巡检 + 来源变更检测 + 采集任务卡（--json 可程序化消费）
# ② 按任务卡采集 → 追加到 src/data/evidence.yaml（模板在任务卡里）
npm run build         # ③ 构建即校验：未注册指标直接失败；过期/域外/冲突自动降级
npm run sync          # ④ 再跑一次：对比排名快照，输出哪些场景的推荐变了 → 写 changelog
```

规则：任务卡之外的来源禁止取数；`verified` 一律先 false；改不动 JS 渲染页就标注待人工。

### 触发条件
- 定期同步（每周一 09:00 自动执行，见「定期同步机制」）
- 用户指定
- 得知新模型/新版本/价格变动发布

### 步骤
0. **巡检**：运行 `npm run sync`——一条命令得到每个指标的采集状态（新鲜 / 过半 / 过期 / 缺口）、白名单来源的内容变更检测（HTTP 源自动做内容哈希对比，JS 渲染源标记为需浏览器采集）、以及本轮采集任务卡（指标 → 来源 URL → 写入模板）。存在「过期」时本轮必须重采对应来源，不得只留痕不改数据。仍可用 `npm run check:freshness` 做纯鲜度门禁（CI 用，超窗非零退出）。
1. **采集**：按任务卡从来源白名单获取数据（清单见下方，机器可读版在 `scripts/sync.mjs` 的 SOURCES）。
2. **写入证据**：在 `evidence.yaml` 追加记录，每条必须包含：
   - `id`: `ev-<来源缩写>-<序号>`（如 `ev-arena-031`）
   - `metric`: 必须是 `metrics.yaml` 中已注册的 id
   - `subject`: 模型家族 id（对应 `models.yaml`）
   - `variant`: 具体变体名
   - `value`: 原始数值
   - `source` + `source_url`: 来源名与可回查链接
   - `retrieved_at`: ISO 日期
   - `verified`: 初次采集为 false，人工抽查后改 true
   - `notes`: 口径说明、异常备注
3. **构建校验**：运行 `npm run build`。scoring.ts 会自动执行：
   - 指标注册检查（未注册 → 构建失败）
   - 合理域检查（域外 → 仅展示不入分）
   - 时效检查（过期 → 仅展示不入分）
   - 冲突检测（同日分歧 >10% → 取中位数入分并降置信度）
4. **波及分析**：`npm run sync` 的「排名影响」节自动对比上次快照（`scripts/.cache/rank-snapshot.json`），列出三档推荐变化的场景；无变化也要在 changelog 写「本轮无更新」。
5. **留痕**：在 `changelog.yaml` 追加条目，写清采集了什么、校验结果、哪些排名受影响。
6. **复核**：再次运行 `npm run sync`，确认任务卡清空（「缺口」（注册但无证据的指标）报给人工决定补采或降级）。

### 来源白名单
| 来源 | 层级 | 用于 | URL |
| --- | --- | --- | --- |
| 各厂商官方定价页 | tier 1 | 价格、上下文窗口 | OpenAI / Anthropic / Google / DeepSeek / 智谱 / 阿里 / 月之暗面 / 字节 |
| arena.ai（原 LMArena） | tier 2 | 人类偏好 Elo、分类目排名 | https://arena.ai/leaderboard |
| SWE-bench | tier 2 | 真实任务修复率 | https://swebench.com |
| Artificial Analysis | tier 3 | AA 智能指数、价格/速度交叉参考（权重减半；新模型先行收录通道） | https://artificialanalysis.ai/models |

**禁止**：从自媒体、论坛帖子、未署名文章取具体数值。不确定的字段一律标 `verified: false` 或 `needs_verification: true`。

## 校验规则（构建时自动执行）

详见 `/methodology` 页面或 `src/lib/scoring.ts`。核心规则：
- 未注册指标的 evidence → **构建失败**（硬错误）
- 值超出 plausible 域 → 警告 + 仅展示不入分
- 超过 freshness_days 未更新 → 警告 + 仅展示不入分
- 同日同指标多条证据分歧 >10% → 警告 + 降置信度

## 鲜度规则

场景页 header 显示「已验证 N 天内」/「信息可能过时」的徽章（构建时计算）：
- ≤30 天：绿色
- 31–60 天：黄色
- >60 天：红色

维护 agent 每周巡检时优先处理红色页面。

## 定期同步机制

目标：**全站数据（首页速查、场景排名、榜单、模型库）只有一个来源——evidence.yaml + 元信息文件**，保持它们新鲜，重建后全站自动最新。

- **周期**：每周一 09:00（本地时区）由维护 agent 的定时任务自动执行一轮「采集流程」（步骤 0–6）；触发式采集（价格变动、新模型发布）不受此周期限制。
- **巡检入口**：`npm run sync`——鲜度巡检 + 来源变更检测 + 采集任务卡 + 排名影响对比，一条命令走完巡检（`--json` 输出机器可读报告，供定时任务程序化消费）；`npm run check:freshness` 保留为纯鲜度门禁（任何指标过期即非零退出，CI 用）。
- **同步范围**：来源白名单全部来源（tier 1 官方定价页逐家重采；arena.ai / swebench.com 榜单由 sync 脚本做内容哈希对比，有变化才写入）；`models.yaml` / `products.yaml` 的价格与版本摘要随证据同步，主观字段（可用性、订阅价）标待核实。
- **口径延续**：同一变体价格口径变更（如 DeepSeek 2026-08-16 起峰谷计价取峰时价）必须在 notes 写明口径与生效日期；限时促销价在到期前一周的同步中复核。
- **职责边界不变**：agent 刷数据层；`verified` 抽查、权重、场景正文、指标注册仍归人工。同步结果（含缺口与待抽查清单）写入 changelog 当周条目。

## 内容口径

- 面向**知识工作者**：主推产品/订阅，模型名作为附注标签
- 场景维度权重公示于每个场景页顶部，修改需留痕
- 排名结果完全由算法生成，任何人不得手动覆盖
- 中文写作，说人话，不堆形容词

## 技术约定

- 静态站：Astro 5，无后端
- 构建 = 校验：`npm run build` 失败 = 数据有问题，必须修复
- 排名是构建时产物，改数据后重新构建即刷新
- **Agent 通道是构建产物，不要手改**：`/api/v1/*.json`、`/skill.md`、`llms.txt`、`llms-full.txt` 全部由构建从数据生成；改数据 → 重建即自动更新。唯一手工维护的源文件是 `skills/fitmodel-model-pick/SKILL.md`（场景清单占位区由构建注入）
- **算法层改动留痕**：`src/lib/scoring.ts` / `board.ts`（综合指数权重等）调整时，必须同步方法论页与 `docs/research-2026-09.md` 的选型依据，并在 changelog 记录
