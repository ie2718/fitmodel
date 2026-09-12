/**
 * 综合能力指数与维度榜的公共定义：榜单页、模型页、Agent API 共用同一口径。
 * 权重仿 Artificial Analysis 的公示做法——改动必须同步方法论页并在 changelog 留痕。
 */

/** 综合能力指数的维度权重（公示） */
export const CANONICAL_WEIGHTS: Record<string, number> = {
  general: 0.4,
  coding: 0.3,
  writing: 0.2,
  long_context: 0.1,
};

export const DIM_LABEL: Record<string, string> = {
  general: '通用',
  coding: '编码',
  writing: '写作',
  long_context: '长上下文',
  agent: 'Agent',
};

export const CANONICAL_WEIGHT_LINE = Object.entries(CANONICAL_WEIGHTS)
  .map(([k, v]) => `${DIM_LABEL[k] ?? k} ${Math.round(v * 100)}%`)
  .join(' · ');

/** 场景维度在榜单页的展示顺序 */
export const BOARD_DIMS = ['general', 'coding', 'writing', 'long_context'] as const;

export const DIM_DESC: Record<string, string> = {
  general:
    '四个 arena 人类偏好信号（总榜 Elo / 总榜名次 / 难题榜 / 指令遵循榜）+ AA 智能指数，按指标权重 × 可靠度加权。AA 智能指数（Artificial Analysis 自研基准，held-out 防污染）权重 2×（2026-09-08 人工确认）且为现役前沿锚：未见于 AA v4.3 榜的变体按「非现役」缺席先验（30±24）收缩，其纯名次维度与先验 50/50 收缩——AA 官方会下架被替代代际（GPT-5.6 先例），缺席本身即证据。名次显著低于自身其余证据共识的类目（覆盖滞后）可靠度减半并在「依据」列标注。原始榜见「AA 智能指数」tab。',
  coding:
    'Arena 编码类目盲测 + WebDev 类目盲测 + SWE-bench Verified 真实 issue 修复率，三信号可靠度加权。注意：SWE 最新官方运行为 2026-02，早于部分当前旗舰发布，其单项名次请结合区间与「依据」列解读。',
  writing: 'Arena 创意写作类目盲测排名。',
  long_context: '官方标称上下文窗口。证据缺口中，有数据前该维度仅降覆盖率不参与排名。',
  agent: 'Arena Agent 榜（2026-08 快照，净改进率口径）。注意：来源站 2026-09 起改用胜率口径，与本指标口径不一致，口径迁移待人工确认前本榜冻结更新；维度未接入任何场景评分，仅展示。',
};

/** Harness 榜显示名（slug → 展示名）；未收录的 slug 原样展示 */
export const HARNESS_NAMES: Record<string, string> = {
  trae: 'TRAE',
  'rovo-dev': 'Atlassian Rovo Dev',
  warp: 'Warp',
  openhands: 'OpenHands',
  'epam-ai-run': 'EPAM AI/Run Developer Agent',
  'harness-ai': 'Harness AI',
  'refact-ai': 'Refact.ai Agent',
  'qodo-command': 'Qodo Command',
  'moatless-tools': 'Moatless Tools',
  'augment-agent-v1': 'Augment Agent v1',
  zencoder: 'Zencoder',
  'amazon-q-developer': 'Amazon Q Developer',
  'swe-agent': 'SWE-agent',
  bloop: 'Bloop',
  devlo: 'devlo',
  joycode: 'JoyCode (京东)',
  'lingxi-v1-5': 'Lingxi v1.5',
  'blackbox-ai-agent': 'Blackbox AI Agent',
  'google-jules': 'Google Jules',
  'bytedance-marscode': 'ByteDance MarsCode Agent',
  'nemotron-cortexa': 'Nemotron-CORTEXA (NVIDIA)',
  'emergent-e1': 'Emergent E1',
  sonar: 'Sonar',
  'sonar-foundation-agent': 'Sonar Foundation Agent',
  'live-swe-agent': 'live-SWE-agent',
  acoder: 'ACoder',
  'salesforce-sage': 'Salesforce AI Research SAGE',
  tools: 'Tools',
  'prometheus-v1-2-1': 'Prometheus v1.2.1',
  'aime-coder-v1': 'Aime-coder v1',
  'wandb-o1-crosscheck': 'W&B Programmer O1 crosscheck5',
  'patchpilot-v1-1': 'PatchPilot v1.1',
  'agent-scope': 'AgentScope',
  'codestory-midwit': 'CodeStory Midwit Agent',
  'swe-rizzo': 'SWE-Rizzo',
  gru: 'Gru',
  'artemis-agent-v2': 'Artemis Agent v2',
  'bracket-sh': 'Bracket.sh',
  'codesweep-swe-agent': 'CodeSweep (SWE-agent)',
  'autocoderover-v2-1': 'AutoCodeRover v2.1',
  'engine-labs': 'Engine Labs',
  'learn-by-interact': 'Learn-by-interact',
  'entropo-r2e': 'EntroPO + R2E',
  'agentless-1-5': 'Agentless 1.5',
  solver: 'Solver',
  'composio-swe-kit': 'Composio SWE-Kit',
  'appmap-navie-v2': 'AppMap Navie v2',
  'skywork-swe-32b': 'Skywork-SWE-32B (TTS Bo8)',
  'deepswe-preview': 'DeepSWE-Preview (TTS Bo16)',
  'r2e-gym': 'R2E-Gym',
  'agentless-lite': 'Agentless Lite (O3 Mini)',
  'swe-exp': 'SWE-Exp',
  'llama3-swe-rl': 'Llama3-SWE-RL (Agentless Mini)',
  ugaiforge: 'ugaiforge',
  'nebius-ai': 'Nebius AI',
  'swe-agent-lm-32b': 'SWE-agent-LM-32B',
  honeycomb: 'Honeycomb',
  'factory-code-droid': 'Factory Code Droid',
  'swe-fixer': 'SWE-Fixer',
  masai: 'MASAI',
  'lingma-agent': 'Lingma Agent (SWE-GPT)',
  'codeshell-agent': 'CodeShellAgent',
};

/** 90% 误差界是否重叠（并列判定，与 scoring.ts 的 Z90 一致） */
export function ciOverlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}
