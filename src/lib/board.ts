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
  general: 'Arena 总榜人类盲测 Elo——综合人类偏好的最强信号。',
  coding:
    'Arena 编码类目盲测 + WebDev 类目盲测 + SWE-bench Verified 真实 issue 修复率，三信号可靠度加权。注意：SWE 最新官方运行为 2026-02，早于部分当前旗舰发布，其单项名次请结合区间与「依据」列解读。',
  writing: 'Arena 创意写作类目盲测排名。',
  long_context: '官方标称上下文窗口。证据缺口中，有数据前该维度仅降覆盖率不参与排名。',
  agent: 'Arena Agent 榜（2026-08 快照，净改进率口径）。注意：来源站 2026-09 起改用胜率口径，与本指标口径不一致，口径迁移待人工确认前本榜冻结更新；维度未接入任何场景评分，仅展示。',
};

/** 90% 误差界是否重叠（并列判定，与 scoring.ts 的 Z90 一致） */
export function ciOverlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}
