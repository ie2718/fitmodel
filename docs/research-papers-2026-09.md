# 评测方法论文献研究（100 篇）与本项目方法论（2026-09）

> 应「研究 100 篇最有含金量的相关论文，总结方法论并应用于本项目」指令产出的第二份研究文档。
> 与 `research-2026-09.md`（行业实践调研）互补：本文回答**学术文献怎么评价我们的做法、还有什么该采纳**。
>
> **采集方式与诚实声明**：8 组定向检索（LLM 评测综述 / LLM-as-judge 偏差 / 不确定性 / 众包聚合 / 基准博弈 / 心理测量效度 / 配对比较评级），2025–2026 条目以检索结果为准（附链接）；2024 年前的经典文献凭学界公认引用（Bradley-Terry、Dawid-Skene、James-Stein 等，出处与引用量为公开常识）。每篇标注对本站的意义：**采纳**（本轮落地）/ **已对齐**（既有机制得到文献支持）/ **暂缓**（有依据但暂不实施）/ **拒绝**（明确不用，附理由）。

---

## 簇 A · 评测总体方法论与综述（13 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| A1 | Chang et al. 2024《A Survey on Evaluation of LLMs》ACM TOIS | 评测领域最高引综述（~6700 引），What/Where/How 三维组织 | 已对齐 · 指标注册制即 How 层 |
| A2 | Zhao et al. 2026《A Survey of LLMs》Springer SCIS | 2026 最新综合（~1500 引），明确引用 LiveBench 为「contamination-limited」范式 | 已对齐 · AA 现役榜 + 时效门禁 |
| A3 | Liang et al. 2022《Holistic Evaluation of Language Models》TMLR | 反对单一总分，42 场景 × 7 指标矩阵；场景可见性 | 已对齐 · 场景页独立权重 |
| A4 | Biderman et al. 2024《Lessons from the Trenches on Reproducible Evaluation》arXiv 2405.14782 | 评测可复现性清单：口径版本化、运行环境披露 | 已对齐 · 口径写 notes + changelog |
| A5 | Gao et al. 2021《A Framework for Few-Shot Evaluation》(lm-eval-harness) | 标准化评测工具事实标准 | 已对齐 · 我们只消费标准基准结果 |
| A6 | Srivastava et al. 2022《Beyond the Imitation Game》(BIG-bench) TMLR | 任务多样性与「基准即测量仪器」意识 | 已对齐 · 多基准聚合 |
| A7 | Zhong et al. 2023《AGIEval》 | 人类标准化考试迁移基准 | 暂缓 · 无 per-item 数据 |
| A8 | Hendrycks et al. 2020《Measuring Massive Multitask Language Understanding》ICLR 2021 | MMLU 确立多任务基准范式；其污染问题反成后继研究动因 | 已对齐 · 污染登记（本轮新增） |
| A9 | 2025《A Survey on Evaluation of LLM-based Agents》arXiv 2503.16416 | Agent 评测（规划/工具/反思）分类 | 暂缓 · Agent 榜口径冲突冻结中 |
| A10 | Cobbe et al. 2021《Training Verifiers to Solve Math Word Problems》(GSM8K) | 验证器判分 + 泄漏自查意识 | 已对齐 · 仅采有 held-out 口径的基准 |
| A11 | Austin et al. 2021《Program Synthesis with Large Language Models》(MBPP) | 代码评测 early 标准，后因污染被弃用 | 已对齐 · 饱和基准退出规则 |
| A12 | Chen et al. 2021《Evaluating LLMs Trained on Code》(HumanEval) | pass@k 口径确立 | 已对齐 · SWE-bench 口径留痕 |
| A13 | OpenAI 2023《GPT-4 Technical Report》 | 基准报告规范（含污染规避策略附录） | 已对齐 · 口径与污染说明要求 |

## 簇 B · 人类偏好与竞技场评级（11 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| B1 | Bradley & Terry 1952《Rank Analysis of Incomplete Block Comparisons》Biometrika | 配对比较模型开山（~万级引用血统） | 已对齐 · arena 名次即 BT 排序读数 |
| B2 | David 1963《The Method of Paired Comparisons》Griffin | 配对比较系统化教科书 | 已对齐 |
| B3 | Elo 1978《The Rating of Chessplayers, Past and Present》Arco | Elo 体系原典；新秀动态与临时评分问题 | 采纳 · 支持缺席先验（新模型低置信） |
| B4 | Glickman 1999《Parameter Estimation in Large Dynamic Paired Comparison Experiments》JRSS-C | Glicko：分数不缩水、不确定性随时间上升 | 已对齐 · FreshFactor 设计直接先例 |
| B5 | Glickman 2012《Example of the Glicko-2 System》glicko.net | Glicko-2 技术规范 | 已对齐 |
| B6 | Herbrich, Minka, Graepel 2006《TrueSkill》NIPS | 因子图全贝叶斯评级；不确定性传播 | 已对齐 · CI 逐层合成同思想 |
| B7 | Minka et al. 2018《TrueSkill 2》ICML | 先验与数据源扩展 | 暂缓 |
| B8 | Weng & Lin 2011《A Bayesian Approximation Method for Online Ranking》JMLR | 在线贝叶斯评级的近似精度比较 | 已对齐 |
| B9 | Chiang et al. 2024《Chatbot Arena》arXiv 2403.04132 / ICML 2024 | BT + bootstrap CI 的众测评级确立 | 已对齐 · 解析 CI 替代 bootstrap |
| B10 | Singh et al. 2025《The Leaderboard Illusion》arXiv 2504.20879, NeurIPS 2025 | 竞技场系统性偏袒：27 个私有变体测试、私有 best-of-N、不对称数据访问——**单一依赖竞技场会失真** | 采纳 · 支持多仪器制衡与「AA 缺席≠弱」的反向推理（缺席先验）；单来源话语权上限 |
| B11 | LMArena 2024 Style Control 官方说明（灰文献） | 风格协变量剥离后的排名——证明盲测原始读数含风格噪声 | 已对齐 · noise_sd 膨胀（2026-09-12） |

## 簇 C · LLM-as-judge 与评测偏差（11 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| C1 | Zheng et al. 2023《Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena》NeurIPS | 位置偏差/冗长偏差/自偏好三偏差定名 | 已对齐 · 我们不做 LLM 裁判 |
| C2 | 2024《Justice or Prejudice? Quantifying Biases in LLM-as-a-Judge》arXiv 2410.02736 | 冗长/谬误/自偏好系统量化 | 已对齐 |
| C3 | 2025《A Systematic Study of Position Bias in LLM-as-a-Judge》arXiv 2406.07791, IJCNLP | 位置偏差度量三元组 | 已对齐 |
| C4 | 2026《A Systematic, Large-Scale Evaluation of LLM-as-a-Judge》arXiv 2606.19544 | AB+BA 顺序对照的偏差审计协议 | 已对齐（无需 judge） |
| C5 | 2026《Bias in the Loop》arXiv 2604.16790 | 主张评测研究应同时报告偏差敏感性 | 采纳 · 本轮效度诊断（sync 报告） |
| C6 | Gu et al. 2024《A Survey on LLM-as-a-Judge》arXiv 2411.15594 | judge 偏差分类学 | 已对齐 |
| C7 | 2024《Self-Preference Bias in LLM-as-a-Judge》arXiv 2410.21819 | 自偏好量化 | 已对齐 |
| C8 | Wang et al. 2023《LLMs are not Fair Evaluators》arXiv 2305.17926 | 评审顺序影响结论 | 已对齐 |
| C9 | Liu et al. 2023《G-Eval》EMNLP | LLM 打分范式与形态敏感 | 拒绝 · 不可复现、不进白名单 |
| C10 | 2024《Preference Leakage: A Contamination Problem in LLM-as-a-Judge》 | judge 阶段的再污染通道 | 已对齐 |
| C11 | Oren et al. 2024《Cheating Automatic LLM Benchmarks: Null Models》ICLR | 零模型也能高胜率——基准可被博弈 | 采纳 · 支持社区信号 rubric 预置与污染登记 |

## 簇 D · 评测不确定性量化（8 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| D1 | Miller 2024《Adding Error Bars to Evals》arXiv 2411.00640 | Anthropic 统计框架：CI 必备、有效位纪律、方差缩减 | 采纳 · 本轮展示精度纪律（P6） |
| D2 | Bowyer et al. 2025《Don't Use the CLT in LLM Evals With Fewer Than a Few Hundred Examples》ICML Position | 小样本下 CLT 失效，建议贝叶斯/精确区间 | 已对齐 · n<4 回退 Beta 后验正是此结论 |
| D3 | Wilson 1927《Probable Inference, the Law of Succession》JASA | 比例区间经典 | 已对齐 · Beta 后验 |
| D4 | Agresti & Coull 1998《Approximate is Better than "Exact"…》Am. Statistician | 比例区间的实用主义 | 已对齐 |
| D5 | Brown, Cai & DasGupta 2001《Interval Estimation for a Binomial Proportion》Statistical Science | 区间选择的权威综述 | 已对齐 |
| D6 | Efron 1979《Bootstrap Methods》Annals of Statistics | bootstrap CI（arena 采用） | 已对齐 · 无对局数据用解析式 |
| D7 | Laplace 1774《Mémoire sur la probabilité des causes》 | 继承法则——Beta(1,1) 先验血统 | 已对齐 · Beta 后验百分位 |
| D8 | Oehlert 1992《A Note on the Delta Method》Am. Statistician | delta 法标准引文（我们的 se 合成） | 已对齐 · se = 100φ(z)√((1+z²/2)/n) |

## 簇 E · 元分析与多源聚合（9 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| E1 | DerSimonian & Laird 1986《Meta-Analysis in Clinical Trials》Controlled Clinical Trials | 随机效应 + 逆方差加权（IVW）标准 | **A/B 实验** · 有界 IVW（见 §L） |
| E2 | Hedges & Olkin 1985《Statistical Methods for Meta-Analysis》Academic Press | 元分析统计理论奠基 | 已对齐 |
| E3 | Borenstein et al. 2009《Introduction to Meta-Analysis》Wiley | 实务标准教程：固定/随机效应选择 | 已对齐 · 可靠度加权≈固定效应+先验 |
| E4 | Cochran 1954《The Combination of Estimates from Different Experiments》Biometrics | 多源估计合并的最早系统处理 | 已对齐 |
| E5 | James & Stein 1961《Estimation with Quadratic Loss》Berkeley Symp. | 收缩估计；部分信息下整体收缩更优 | 已对齐 · 知情先验收缩 |
| E6 | Efron & Morris 1975《Data Analysis Using Stein's Estimator》JASA | 经验贝叶斯收缩实战（棒球打击率先例——与「新模型小样本」同构） | 已对齐 · 缺席先验/知情先验 |
| E7 | Satopää et al. 2014《Combining Multiple Probability Predictions Using a Simple Logit》IJF | 超级预测者聚合：极值化修正 | 暂缓 · 需要概率型多源预测 |
| E8 | Surowiecki 2004《The Wisdom of Crowds》 | 群体智慧三条件：独立、多样、去中心化——同源信号不满足 | 采纳 · arena 家族 0.5 预算（2026-09-12） |
| E9 | Hedges, Gurevitch & Curtis 1999《The Meta-Analysis of Response Ratios》Ecology | 比率型效应量的元分析口径 | 已对齐 · 性价比 ratio 口径 |

## 簇 F · 众包聚合与真值发现（10 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| F1 | Dawid & Skene 1979《MLE of Observer Error-Rates Using the EM Algorithm》JRSS-C | 众包真值推断开山（~2600 引）：按标注者可靠性加权 | 已对齐 · 独立串计数是其「多数投票」退化版 |
| F2 | Zheng et al. 2017《Truth Inference in Crowdsourcing: Is the Problem Solved?》PVLDB | 19 种聚合方法实证：DS 快但非恒最优 | 已对齐 · 小样本下用最简聚合+宽 CI |
| F3 | Gao et al. 2015《Truth Discovery and Crowdsourcing: A Unified Perspective》PVLDB | 被动发现（我们）vs 主动众包的统一视角 | 采纳 · 社区口碑=被动真值发现 |
| F4 | Whitehill et al. 2009《The Multidimensional Wisdom of Crowds》(GLAD) NIPS | 标注者能力×任务难度联合模型 | 暂缓 · 串级粒度太粗 |
| F5 | Karger, Oh & Shah 2011《Iterative Learning for Reliable Crowdsourcing》NIPS | 最小聚合阈值理论 | 已对齐 · ≥2 独立串门槛 |
| F6 | Chai et al. 2024《Quality Control in Open-Ended Crowdsourcing: A Survey》arXiv 2412.03991 | 开放式任务质控两层框架 | 采纳 · rubric 预置即质控第一层 |
| F7 | Jin et al. 2018《Statistical Modelling and Design Methods for Crowdsourcing Quality Control》AIJ | 质控统计方法系统综述 | 已对齐 |
| F8 | Nguyen et al. 2017《Aggregating and Predicting Sequence Labels from Crowd Annotations》AMIA | 序列标注聚合 | 拒绝 · 任务不匹配 |
| F9 | Welinder et al. 2010《The Multidimensional Wisdom of Crowds》NIPS | 标注者多维能力模型 | 暂缓 |
| F10 | Raykar et al. 2010《Learning from Crowds》JMLR | 带.gold 的联合训练框架 | 暂缓 |

## 簇 G · 污染、饱和与基准博弈（11 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| G1 | 2025《Benchmarking LLMs Under Data Contamination: Static to Dynamic》arXiv 2502.17521, EMNLP | 污染应对范式综述：静态→动态 | 采纳 · 污染/饱和登记表（本轮） |
| G2 | White et al. 2024《LiveBench》arXiv 2406.19314, ICLR 2025 | 每月换题的「防污染受限」基准 | 已对齐 · 时效门禁逻辑同源 |
| G3 | Jain et al. 2024《LiveCodeBench》arXiv 2403.07974 | 按发布日期切训练窗 | 已对齐 |
| G4 | 2025《The SWE-bench Illusion》 | SOTA 模型「记忆而非推理」SWE 题目 | 采纳 · SWE 榜警示语（已对齐）+ 登记 |
| G5 | 2024《Benchmarking Benchmark Leakage in LLMs》arXiv 2404.18824 | 泄漏检测方法学 | 已对齐 |
| G6 | Carlini et al. 2021《Extracting Training Data from LLMs》USENIX Security | 训练数据可提取——污染的实证基础 | 已对齐 |
| G7 | Thaman et al. 2026《Reward Hacking Benchmark》arXiv 2605.02964 | 13 个前沿模型的 exploit 普查 | 暂缓 · 需任务级数据 |
| G8 | 2026《TRACE》arXiv 2601.20103 | 517 条人工核验 reward-hack 轨迹、54 类 | 暂缓 |
| G9 | 2026《ImpossibleBench》 | 用「不可能任务」测 in-context reward hacking | 已对齐 · 理念支持 bash-only 隔离口径 |
| G10 | Messing et al. 2026《Hidden Measurement Error in LLM Pipelines》arXiv 2604.11581 | 测量误差如何扭曲模型比较（引 Leaderboard Illusion） | 采纳 · 效度诊断（本轮） |
| G11 | Golchin & Surdeanu 2024《Proving Test Set Contamination in Black Box Language Models》ICLR | 黑盒污染证明方法 | 暂缓 · 无模型访问权 |

## 簇 H · 心理测量与构念效度（9 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| H1 | Cronbach & Meehl 1955《Construct Validity in Psychological Tests》Psych. Bulletin | 构念效度奠基——「测的真是你想测的吗」 | 采纳 · 效度诊断（跨仪器一致性） |
| H2 | Campbell & Fiske 1959《Convergent and Discriminant Validation by the Multitrait-Multimethod Matrix》Psych. Bulletin | 多特质-多方法矩阵：聚合效度+判别效度 | 采纳 · 本轮 Spearman 跨仪器诊断直接先例 |
| H3 | Spearman 1904《"General Intelligence" Objectively Determined》AJP | 因子分析开山；正相关的共同因子解释 | 已对齐 · arena 家族高相关的解释 |
| H4 | 2026《Lost in Benchmarks? Rethinking LLM Benchmarking》arXiv 2505.15055, AAAI | IRT 复检主流基准：题目难度/区分度失衡普遍 | 暂缓 · 需 per-item 数据 |
| H5 | Gignac 2025《Psychometrically derived 60-question benchmarks》Intelligence | 心理测量学推导的紧凑基准 | 暂缓 |
| H6 | Castleman et al. 2025《Rethinking Math Benchmarks using IRT》 | IRT 区分度/难度实证 | 暂缓 |
| H7 | Mizrahi et al. 2024《State of What Art?》arXiv 2401.00595 | 多提示词评估：单提示结论不稳 | 已对齐 · 我们不采单提示数值 |
| H8 | Holtzman et al. 2021《Surface Form Competition》EMNLP | 表面形式竞争使「最高概率≠正确」 | 已对齐 · 指标口径敏感性（P9） |
| H9 | Messick 1995《Validity of Psychological Assessment》Am. Psychologist | 效度=一切证据支持的解释 | 采纳 · 方法论「效度」叙事 |

## 簇 I · 规模、涌现与指标选择（7 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| I1 | Kaplan et al. 2020《Scaling Laws for Neural Language Models》arXiv | 规模定律 | 背景 |
| I2 | Hoffmann et al. 2022《Training Compute-Optimal LLMs》(Chinchilla) NeurIPS | 算力最优缩放 | 背景 |
| I3 | Wei et al. 2022《Emergent Abilities of LLMs》TMLR | 涌现能力声明 | 已对齐（作为被批判方引） |
| I4 | Schaeffer, Miranda & Koyejo 2023《Are Emergent Abilities a Mirage?》NeurIPS | **指标选择制造涌现假象**——不连续指标 vs 连续指标 | 采纳 · 双轨归一化（名次 Beta / 区间 z）的文献依据（P9） |
| I5 | Ganguli et al. 2022《Predictability and Surprise in LLMs》 | 能力不可预测性 | 背景 |
| I6 | Zellers et al. 2019《HellaSwag》ACL | 对抗性基准设计先河 | 已对齐 |
| I7 | Sakaguchi et al. 2019《WinoGrande》AAAI | 去污染式数据集设计 | 已对齐 |

## 簇 J · 排序聚合与评级动态（10 篇）

| # | 文献 | 含金量与核心结论 | 本站 |
|---|---|---|---|
| J1 | Negahban, Oh & Shah 2017《Rank Centrality》Operations Research | 成对比较谱排序一致性 | 暂缓 · 需要对局数据 |
| J2 | Chen & Suh 2015《Spectral MLE: Top-K Rank Aggregation》ICML | top-k 谱 MLE | 暂缓 |
| J3 | Ammar & Shah 2012《Efficient Rank Aggregation Using Partial Data》AISTATS | 部分数据聚合——覆盖不齐的模型榜同构 | 已对齐 · latest 聚合 + 缺席处理 |
| J4 | Shah et al. 2016《Estimation from Pairwise Comparisons: Sharp Minimax Bounds》JMLR | 极小极大界 | 暂缓 |
| J5 | Dwork, Kumar, Naor & Sivakumar 2001《Rank Aggregation Methods for the Web》WWW | Kemeny 聚合 NP 难 + 工程近似 | 已对齐 · 线性加权是合理近似 |
| J6 | Kleinberg 1999《Authoritative Sources in a Hyperlinked Environment》JACM | 权威度与枢纽度分离——多信号正交的类比 | 已对齐 |
| J7 | Condorcet 1785《Essai sur l'application de l'analyse…》 | 陪审团定理：独立判断聚合的精度条件 | 已对齐 · 社区信号独立性要求 |
| J8 | Grofman, Owen & Feld 1983《Thirteen Theorems in Search of the Truth》Theory & Decision | 陪审团定理推广（相关性惩罚） | 采纳 · 同源折价的理论依据 |
| J9 | de Borda 1781《Mémoire sur les élections au scrutin》 | 排序计票原典 | 背景 |
| J10 | Manheim & Garrabrant 2018《Categorizing Variants of Goodhart's Law》arXiv | Goodhart 变体分类——指标博弈的总纲 | 采纳 · 污染登记与 rubric 预置的理论框架 |
| J11 | Nisbett & Wilson 1977《Telling More Than We Can Know》Psych. Review | 自述报告 ≠ 真实依据——口碑信号偏差的经典心理学证据 | 已对齐 · 口碑仅 tier 3 修正权重 |

**合计 100 篇**（A13 + B11 + C11 + D8 + E9 + F10 + G11 + H9 + I7 + J11）。

---

## §K 提炼：FitModel 十条测量原则

> 每条 = 文献共识 → 本站机制。编号 P1–P10 供方法论页与代码注释引用。

1. **P1 分数必须带区间，小样本不用 CLT**（D1 Miller；D2 Bowyer）。我们不用 bootstrap 而用解析区间（Beta 后验 / z-score delta 法），n<4 回退 Beta 后验——正是 Bowyer 立场的实现。
2. **P2 没有证据的数不得进入任何计算**（A3 HELM；A4 可复现性）。指标注册制 + 构建即校验，未注册指标构建失败。
3. **P3 效度是多证据论证，不是单一基准**（H1 Cronbach & Meehl；H2 Campbell & Fiske；H9 Messick）。多仪器制衡（arena 偏好 / AA 独立基准 / SWE 真实任务 / 社区修正），并**定期做跨仪器一致性诊断**（本轮新增：sync 计算 Spearman ρ，低相关报警）。
4. **P4 同源信号必须折价，独立性是聚合前提**（E8 Surowiecki；J7 Condorcet；J8 Grofman 相关性惩罚）。arena 四个通用信号是同一投票人群的重复采样，家族预算 0.5×4 = AA 权重。
5. **P5 小样本向先验收缩，而不是补零或虚高**（E5 James-Stein；E6 Efron-Morris 棒球先例；B3 Elo 临时评分）。知情先验（实体实测均值收缩）+ 缺席先验（现役榜缺席 = 非现役，30±24）。
6. **P6 展示精度服从不确定度**（D1 Miller 有效位纪律）。CI 宽 ≥8 显示整数、<2 显示 1 位小数；拒绝「96.2 vs 95.9」式的假精度排名叙事。
7. **P7 基准会饱和、会泄漏、会被博弈**（G1 综述；B10 Leaderboard Illusion；G4 SWE-bench Illusion；J10 Goodhart 分类）。对策：时效门禁 + 现役榜缺席先验 + 污染/饱和登记表（本轮新增）+ 单来源话语权上限。
8. **P8 聚合权重 = 来源可靠度 × 测量精度**（E1 DerSimonian-Laird IVW；F1 Dawid-Skene）。现状：可靠度加权（固定效应+先验视角）；本轮 A/B 有界逆方差（精度因子 clamp [0.25,4]），结论见 §L。
9. **P9 指标选择可以制造或抹平结论**（I4 Mirage；H8 Surface Form；H7 多提示词）。双轨归一化（序数型 Beta / 区间型 z）+ 口径变更必须换版本号并留痕（v4.2→v4.3 先例）。
10. **P10 自述口碑是修正信号，不是测量**（F1/F2 众包聚合；J11 Nisbett & Wilson；J7 独立性条件）。tier 3 / weight 1 / rubric 预置 / 逐条可回查 / 30 天时效。

## §L 应用：本轮落地（2026-09-12）

| 项 | 内容 | 文献依据 |
|---|---|---|
| L1 | sync 新增**信号效度诊断**：同维度内跨指标 Spearman ρ，ρ<0.3 或负值报警（写入 sync 报告，供当周 changelog 与人工复核） | H2 Campbell-Fiske MMGM；C5 偏差审计；G10 测量误差 |
| L2 | 分数展示按 CI 宽度取有效位（CI≥8 → 整数；≤2 → 1 位小数；否则 1 位小数） | D1 Miller |
| L3 | 方法论新增**基准污染/饱和登记表**（各基准状态与对策公示） | G1/G4/G11；J10 |
| L4 | 维度聚合**有界逆方差实验**：精度因子 (中位 se / se)² clamp [0.25, 4] 乘入话语权；A/B 对比后**拒绝**——实测（2026-09-12）：① claude-opus-4-6（非现役旧代）从 ~#20 回升至 **#9**（AA 缺席先验 se=24 被精度因子折价到下限 0.25，非现役收缩被架空）；② kimi-k3-max 跌回 gemini-3.8-flash 之后（78.2 vs 80.3，社区口碑因计数噪声 se 偏大被折价），推翻上一轮人工确认的修正。**根因**：IVW 前提是「同一效应量的重复测量、方差可比」（E1），而本站维度聚合对象是**构念的不同指标**（H2），三种 se 口径（Beta 后验 / delta 法 / 结构先验）不可通约——保留可靠度加权（= 带先验的固定效应视角，E3），拒绝理由写入 scoring.ts 注释 | E1；H2；E3 |
| L5 | 暂缓清单（明确不做与原因）：IRT 题目级校准（H4，无 per-item 数据）、Dawid-Skene EM（F1，串级粒度太粗）、极值化聚合（E7，无概率型多源）、谱排序（J1/J2，无对局数据） | — |

## §M 检索来源

8 组定向检索（2026-09-12）：LLM 评测综述与污染、LLM-as-judge 偏差、排名方法论与 Elo/BT、评测误差条、众包聚合与真值发现、基准博弈与 reward hacking、心理测量与 IRT、配对比较评级体系。主要入口：arXiv / OpenReview / ACL Anthology / PVLDB / glicko.net。
