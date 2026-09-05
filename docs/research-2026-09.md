# 行业调研与算法选型（2026-09）

> 本文回答两个问题：**同类榜单项目怎么做可信排名**、**我们把哪些方法落进了 scoring.ts**。
> 结论直接指导本站算法，每条选型都注明来源与理由。后续调整算法时先更新本文。

## 一、调研对象与核心机制

### 1. LMArena / arena.ai（原 Chatbot Arena）
- 2023 年底弃用在线 Elo，改为对全部对局做 **Bradley-Terry 极大似然估计**，置信区间用 **bootstrap** 重采样数百次得到，随榜单公开展示。
- **Style control**（2024-08 起）把回答长度、markdown 格式等风格变量作为协变量剥离，另出"风格控制后"排名。
- 分类目（Coding / Creative Writing / Hard Prompts 等）按真实用户 prompt 切分。
- 反面教材：私测争议与刷票研究（《The Leaderboard Illusion》）说明匿名机制需要持续审计、政策要公开。

### 2. Artificial Analysis
- Intelligence Index v4.2 = 10 项基准按四类做**加权算术平均（非几何平均）**：Agents 30% / General 30% / Coding 20% / 科学推理 20%，全部权重公示。
- 官方页面披露每项基准的**题数与重复次数**；声明整体 95% CI < ±1%；Elo 型子分数先归一化再入指数。
- 价格口径统一为 3:1 混合价（输入:输出）。权重随版本演进（v4.0→v4.2），演进本身留痕。

### 3. SWE-bench（Verified / Pro）
- Verified = 93 位开发者人工校验的 500 题子集（每题 3 人独立审查）；2026-02 起统一 agent 环境（Docker 禁网、删 git 历史、token 预算）复跑。
- 口径版本化（v2.0.0）；OpenAI 已宣布不再用 Verified 评前沿模型（污染），SWE-bench Pro 用私有分卷抗污染。

### 4. HELM / Stanford CRFM
- **Holistic 评估**：42 场景 × 7 类指标矩阵，反对塌缩成单一数字；逐条样例可回查，完全可复现。

### 5. LiveBench / LiveCodeBench
- 抗污染：每月换题（LiveBench）、每题标注发布日期 + 按模型训练截止日切时间窗（LiveCodeBench）；客观判分，不用 LLM 裁判。

### 6. OpenRouter 排行榜
- 按 **API 真实用量**（token 量）排名，数据门户对外开放。局限：用量反映"被用量"而非质量，样本偏开发者。

### 7. 其他
- **Scale SEAL**：私有题集抗污染；**Epoch AI**：统一环境复跑主流基准；**Aider polyglot**：小而精、口径稳定；**Vellum**：排除饱和基准，只看有区分度的题。
- **OpenCompass 司南**：12 一级 + 50 二级维度树，中英双语，开源可复现；**SuperCLUE**：中文场景特异性。

### 8. 场景→模型路由（RouteLLM / Not Diamond / OpenRouter Auto Router）
- 共同信号：查询难度估计、任务类别、历史对战胜率、成本约束。全部是**运行时服务**——没有一家发布可下载的"场景×模型推荐"数据文件。静态站发布 agent 可消费的推荐 JSON 是差异化空间。

## 二、"可信榜单"的八个机制（行业共识）

1. 盲测/匿名；2. 统一执行环境；3. 抗数据污染；4. 人工校验；5. **统计披露（置信区间、样本量）**；6. 方法与政策公开；7. 数据可回查；8. 更新频率与口径留痕。

## 三、本站的算法选型（对应 scoring.ts 实现）

| 问题 | 行业方法 | 本站实现 | 理由 |
| --- | --- | --- | --- |
| 跨指标可比 | percentile / z-score 统一量纲，原始分保留 | **Beta 后验百分位**：组内按好→差排名 r，pct = (n+1−r)/(n+1)×100，se = 100×√(r(n+1−r)/((n+1)²(n+2))) | percentile 分布无关、抗离群；Beta 后验让头尾不再触及 0/100，小样本不产生虚假极端分，且天然携带标准误 |
| 多指标聚合成维度分 | AA：公示权重的加权算术平均 | 可靠度加权算术平均：w = 来源层级 × 时效衰减 × 一致性 | 可解释、可分解；可靠度让"更可信、更新鲜、无争议"的证据话语权更大 |
| 不确定性表达 | LMArena bootstrap CI；AA 解析 CI | **解析 90% 误差界**：se 沿 百分位→维度→场景 逐层合成（含指标间分歧项），ci = fit ± 1.645×se | 无对局数据做不了 BT/bootstrap；解析式用 Beta 后验方差，构建时零开销。分数接近且区间重叠 → 视为并列 |
| 稀疏数据 | 经验贝叶斯向先验收缩（k≈3–5 等效基准数） | Beta 后验本身即收缩（n=1 → 50±28.9）；样本量因子 min(1, n/10) 进置信度 | 缺数据 ≠ 中庸：分数诚实表达"知道多少"，置信度表达"知道得多牢" |
| 时效 | Glicko 式：分数不缩水，确定性降级 + 过期门禁 | 窗口内衰减只影响组内权重（1 → 0.5 线性）；置信度含时效因子（1 − 0.2×age/窗口）；过期整体剔除不入分 | 与本站"过期仅展示不入分"门禁衔接；页面鲜度徽章同源 |
| 性价比 | ratio 口径（分/美元），对数轴展示，min-max 会放大低端噪声 | value = fit × min(2, 价格中位数/混合价) | ratio 口径一致；上限防极端低价虚高 |
| 排名聚合 | Borda/Copeland 丢分差信息，z-score 假设正态 | 不用，直接比较连续分数 + 误差界 | 保留分差与不确定性，列表排序 + 并列标记即可 |

**综合能力指数**（榜单页）：维度权重 general 0.4 / coding 0.3 / writing 0.2 / long_context 0.1，构建时公示于榜单页顶部。仿 AA：权重必须公示，改动必须在 changelog 留痕。

**排除饱和基准**（Vellum 实践）与**真实用量正交信号**（OpenRouter 实践）列为指标注册的后续评估项，新增指标按 AGENTS.md 需人工审批。

## 四、给 Agent 的数据通道（调研结论 → 落地）

- llms.txt 采用率约 10%、Google 不支持——只能当入口之一，**不能是唯一通道**。
- 事实标准是"公开 JSON 端点为主、MCP 为辅"（OpenRouter `GET /api/v1/models` 已成路由生态事实数据源）。
- 本站落地：稳定 URL 的静态 JSON（`/api/v1/*`，CORS 全开、`schema_version` + `generated_at` 内嵌、数值型字段）+ `/skill.md`（agentskills.io 规范的 SKILL.md，构建时附加最新场景清单）+ llms.txt 指向以上两者。

## 五、来源

- LMArena 方法与政策: https://www.lmsys.org/blog/2023-12-07-leaderboard/ · https://www.lmsys.org/blog/2024-08-28-style-control/ · https://blog.lmarena.ai/blog/2024/policy/
- Artificial Analysis 方法论: https://artificialanalysis.ai/methodology/intelligence-benchmarking
- SWE-bench: https://epoch.ai/benchmarks/swe-bench-verified · https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/
- HELM: https://crfm.stanford.edu/helm/ · arXiv:2211.09110
- LiveBench: https://livebench.ai/ · LiveCodeBench: https://livecodebench.github.io/
- OpenRouter: https://openrouter.ai/rankings · https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties
- Scale SEAL: https://scale.com/blog/leaderboard · Epoch: https://epoch.ai/benchmarks · Aider: https://aider.chat/docs/leaderboards/ · Vellum: https://www.vellum.ai/llm-leaderboard
- OpenCompass: https://opencompass.org.cn/ · SuperCLUE: https://www.superclueai.com/
- RouteLLM: arXiv:2406.18665 · Not Diamond: https://www.notdiamond.ai/
- SKILL.md 规范: https://agentskills.io/specification · https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
- llms.txt: https://llmstxt.org
- 饱和指数（ICML 2026）: arXiv:2602.16763 · eval 误差条: arXiv:2411.00640
