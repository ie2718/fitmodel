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
| 跨指标可比 | percentile / z-score 统一量纲，原始分保留 | **双轨归一化**：序数型（分类目名次）用 Beta 后验百分位；区间型（Elo/解决率/价格，价格先取对数）用 z-score → 正态 CDF，se 用 delta 法 | percentile 抗离群适合名次；z-score 保留量级——修复「SWE 榜首集群 1 分之差被名次百分位放大成几个百分位、flash 型模型虚高」问题（2026-09-05 用户反馈归因） |
| 多指标聚合成维度分 | AA：公示权重的加权算术平均 | 可靠度加权算术平均：w = 来源层级 × 时效衰减 × 一致性 | 可解释、可分解；可靠度让"更可信、更新鲜、无争议"的证据话语权更大 |
| 不确定性表达 | LMArena bootstrap CI；AA 解析 CI | **解析 90% 误差界**：se 沿 百分位→维度→场景 逐层合成（含指标间分歧项），ci = fit ± 1.645×se | 无对局数据做不了 BT/bootstrap；解析式用 Beta 后验方差，构建时零开销。分数接近且区间重叠 → 视为并列 |
| 稀疏数据 | 经验贝叶斯向先验收缩（k≈3–5 等效基准数） | Beta 后验本身即收缩（n=1 → 50±28.9）；样本量因子 min(1, n/10) 进置信度 | 缺数据 ≠ 中庸：分数诚实表达"知道多少"，置信度表达"知道得多牢" |
| 时效 | Glicko 式：分数不缩水，确定性降级 + 过期门禁 | 窗口内衰减只影响组内权重（1 → 0.5 线性）；置信度含时效因子（1 − 0.2×age/窗口）；过期整体剔除不入分 | 与本站"过期仅展示不入分"门禁衔接；页面鲜度徽章同源 |
| 性价比 | ratio 口径（分/美元），对数轴展示，min-max 会放大低端噪声 | value = fit × min(2, 价格中位数/混合价) | ratio 口径一致；上限防极端低价虚高 |
| 排名聚合 | Borda/Copeland 丢分差信息，z-score 假设正态 | 不用，直接比较连续分数 + 误差界 | 保留分差与不确定性，列表排序 + 并列标记即可 |

**综合能力指数**（榜单页）：维度权重 general 0.4 / coding 0.3 / writing 0.2 / long_context 0.1，构建时公示于榜单页顶部。仿 AA：权重必须公示，改动必须在 changelog 留痕。

## 增补调研（2026-09-06，响应「榜单不客观/缺 GPT-6」反馈）

- **GPT-6 Astra 已发布**：AA 智能指数 v4.2 第 2（max 55）/第 3（xhigh 54），BenchLM 9 月榜第 2（81.05）；arena.ai 尚未收录——单一依赖 arena 会系统性迟到新旗舰。GPT-5.6 已被 AA 下架（被 6 代取代）。
- **当前多源格局**（AA v4.2 前五）：Claude Fable 5.1 (57) > GPT-6 Astra max (55) > Astra xhigh (54) = Claude Opus 5 max (54) > Opus 5 xhigh (53)；开源：Kimi K3 (50) > GLM-5.3 (49) > Qwen3.8 (47)。
- **算法响应**：① 注册 `aa_intelligence_index`（tier 3 权重 0.5）作通用维度第三信号 + 新模型先行通道；② 名次型指标引入固定前沿参考系 `cohort_size`（50），百分位 = f(名次, R)，消除「采集扩围 → 全站分数漂移」（实测：编码 #3 因多采 17 个模型从 85.7 漂到 92.9）；③ 缺失维度改「知情先验」：先验 = 50 + (自身实测均值 − 50) × 可靠度，夹 [30,70]——已知很强的模型不再被缺数据拖成平庸，单基准模型也不因先验虚高（先验随证据可靠度回落）。
- **残余分歧示例**（诚实展示而非掩饰）：Claude Fable 5.1-max 在 AA 是全榜第 1，但 arena 编码类目第 34（三次抓取核实）——两个仪器在其编码能力上真实分歧，榜单以「依据」列并示两信号。
- 交叉核对来源：[AA models](https://artificialanalysis.ai/models) · [BenchLM](https://benchlm.ai/)（未入白名单，仅交叉参考）· [Vellum](https://www.vellum.ai/llm-leaderboard)（同前）。
- **2026-09-06 追踪**：GPT-6 Astra（9 月 3 日发布，$10/$50、1M 上下文）已登 arena **WebDev 榜第 1**（Elo 1797），Text 总榜仍未收录。注册 `arena_rank_webdev`（编码维度第三信号）+ AA 详情页价格/上下文入账；`aa_intelligence_index` 由 tier 3 升 tier 2——AA 自研评测集（AA-Briefcase、τ³-Banking 等，含 held-out）性质与 LMArena/SWE-bench 相同，是独立基准而非聚合转载。效果：GPT-6 Astra max 由 #17 升至 #6（79.7，中置信，与 #2–5 区间重叠显示 ≈ 并列），全部由新增证据推动。
- **SWE-bench 浏览器采集（2026-09-06）**：官网 JS 渲染表经浏览器全量提取成功。bash-only 官方可比集（mini-SWE-agent）共 47 个模型，本站补齐至全集（31 条新证据）——区间型 z-score 的参考系自此完整。关键事实：**GPT-6 / GPT-5.6 / Claude Fable 5.1 均不在官方可比集**（最新官方运行 2026-02-26，早于这些模型发布），SWE-bench 无法为当前旗舰提供证据；官方集榜首为 Claude 4.5 Opus high 76.8（与我们既有采集一致）。
- **BenchLM 判定：不入白名单**。核查其首页：证据标注「3 source families」「Provisional-ranked lane」、数据 credit 指向 Artificial Analysis——是聚合站而非自研评测，且无运营方信息、方法论页内容未公开呈现。聚合站的聚合会让来源责任无法追溯，与白名单「可回查原始出处」原则冲突。
- **用户反馈多平台采集（2026-09-06，响应「用户反馈/用户认可」反馈）**：① arena 用户偏好类目全列采集——Hard Prompts / Instruction Following / Longer Query 名次入册（143 条），其中 Longer Query 填补 long_context 维度缺口；② OpenRouter 真实用量榜可采集（Hy4 Preview 14.1T 周用量居首，GLM 5.3 Flash / DeepSeek V4 Flash / GPT-5.6 Luna 领跑——用量由价格与生态驱动，官方声明「衡量采用而非质量」，设为仅展示不进能力分）；③ 社区口碑（Reddit 多帖，定性记录）：GPT-6 Astra 反响分裂——r/ClaudeAI 用户认可编码「大幅提升」，r/better_claw 质疑 $10/$50 定价（Fable 缓存输入便宜 4 倍）与发布初期基础设施稳定性，r/ArtificialInteligence 存在基准独立性争论，r/OpenAI 用户称 3D/Blender 生成「mind blowing」；定性口碑不进入评分（无法诚实地自动化量化），由人工维护渠道沉淀于本文。
- **Agent 榜接入评估：暂缓**。来源站 2026-09 起改用胜率口径（与库内净改进率口径冲突，混用会破坏跨模型可比性），且现有证据仅 10 条、场景 schema 未含 agent 维度。处置：榜单冻结更新并标注口径变更；待来源口径稳定且覆盖 ≥15 模型后由人工评估是否新增 `arena_agent_winrate` 指标与场景维度。
- **AA 权重上调与 v4.3 全量重采（2026-09-08，用户指令「这个榜单的权重要高一些，参考价值更高」）**：
  ① **指标权重机制上线**——metrics.yaml 新增 `weight` 字段（缺省 1.0），维度聚合的话语权由「可靠度」扩为「指标权重 × 可靠度」，置信度因子分配同口径；`aa_intelligence_index` 设 weight: 2，在通用维度五信号中占约 1/3 话语权（4 个 arena 信号 + AA@2× → 2/6）。选型依据：AA 是独立自研基准（held-out 防污染、方法论文情公示），与 arena 盲测**方法论正交**而非同源叠加——arena 四信号同源（同一投票人群与方法论），AA 是唯一第三方测量，给更高权重可降低单一来源绑架排名的风险；同时它是 arena 缺位新模型的先行通道，权重过低会削弱该通道的信号质量。
  ② **v4.3 全量重采（25 条）**：v4.3 = 10 项评测（AA-Briefcase、GDPval-AA v2、AutomationBench-AA、Terminal-Bench v4.0、SciCode、HLE、GDP.pdf、CritPt、AA-Omniscience、AA-LCR v1.1）。数值整体低于 v4.2（Fable 5.1 57→53、Astra max 55→53），**版本间不可比**，同变体旧值由 latest 聚合整体替换；`claude-opus-5-high` 暂留 v4.2 值（v4.3 榜未见该配置，notes 已标注）。柱状榜 23 条为准确读数，Astra xhigh（≈50）与 MiMo-V2.5-Pro（≈27）取自散点图（±1）。
  ③ **外部榜单上网**：榜单页新增「AA 智能指数」tab（原始值镜像 + 来源回查），与方法论页新小节同步；models.yaml 新增 Thinking Machines（Inkling）/ NVIDIA（Nemotron 3 Ultra）/ Mistral / Muse Glimmer 四家族，Muse 系与 MiMo 的厂商归属按 AA 图例标注「待人工确认」。

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
