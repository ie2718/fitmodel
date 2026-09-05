/**
 * FitModel 评分引擎（构建时运行，纯函数，无副作用）。
 *
 * 流水线：校验 → 去重/冲突检测 → Beta 后验百分位归一化 → 可靠度加权维度聚合 → 场景适配分/误差界/置信度/性价比。
 * 方法选型依据 docs/research-2026-09.md（LMArena 的置信区间表达、Artificial Analysis 的多基准聚合、
 * 经验贝叶斯收缩、时间衰减加权）。设计原则：
 * 1. 没有 evidence.yaml 记录的数据不得参与评分（防幽灵数据）；
 * 2. 未注册指标的证据直接抛错（构建失败）；
 * 3. 缺失数据降低「覆盖率与置信度」，而不是悄悄用猜测补齐；
 * 4. 每个分数带 90% 误差界：分数接近且区间重叠的模型视为并列，不假装能分出高下。
 */

export interface MetricDef {
  id: string;
  label: string;
  dimension: string;
  unit: string;
  direction: 'higher' | 'lower';
  source_tier: number; // 1=官方一手 2=独立基准 3=聚合二手
  freshness_days: number;
  plausible: [number, number];
  aggregator: string;
  source: string;
  description?: string;
}

export interface EvidenceRec {
  id: string;
  metric: string;
  subject: string;
  variant: string;
  value: number;
  source: string;
  source_url: string;
  retrieved_at: Date;
  verified?: boolean;
  notes?: string;
}

export interface Issue {
  level: 'warn' | 'error';
  msg: string;
}

export interface Fact {
  metric: string;
  value: number;
  score: number; // 0–100 Beta 后验百分位均值
  se: number; // 百分位估计的标准误（百分位点）
  evidId: string;
  source: string;
  sourceUrl: string;
  retrievedAt: Date;
  tier: number;
  stale: boolean;
  disputed: boolean;
  reliability: number; // 来源层级 × 时效衰减 × 一致性，0–1
  cohort: number; // 该指标组内参与比较的实体数
  notes?: string;
}

export interface DimScore {
  score: number; // 0–100 可靠度加权均值
  se: number; // 维度分标准误（含指标间分歧）
  n: number; // 参与聚合的指标条数
}

export interface EntityScore {
  key: string;
  subject: string;
  variant: string;
  facts: Record<string, Fact>;
  dimScores: Record<string, DimScore>;
}

export interface FitResult {
  entity: EntityScore;
  fit: number | null; // 0–100
  se: number; // fit 的标准误（百分位点）
  ci: [number, number]; // 90% 误差界
  coverage: number; // 权重覆盖率 0–1
  confidence: number; // 0–1
  value: number | null; // 性价比分（需 in/out 价格齐备）
  blendedPrice: number | null; // USD/M (in+out)
}

const TIER_WEIGHT: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.5 };
/** 90% 误差界的正态分位数 */
const Z90 = 1.645;
/** 同组比较样本量因子：参与比较的实体 ≥10 个记满分，不足按比例降置信 */
const SAMPLE_N_FULL = 10;
/** 维度分标准误下限（百分位点）：单一基准无法反映跨基准分歧，保底不确定性 */
const SE_FLOOR = 6;
/** 置信度的时效因子斜率：数据年龄占时效窗口的比例 × 0.2（Glicko 式——分数不缩水，确定性降级） */
const FRESH_SLOPE = 0.2;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Beta 后验百分位（经验贝叶斯）：
 * 组内按「好→差」排名 r_good（1=最好），真实百分位服从 Beta(n+1-r, r)，
 * 取后验均值 pct = (n+1-r)/(n+1)×100，标准误 = 100×sqrt(r(n+1-r)/((n+1)²(n+2)))。
 * 相比裸百分位：(1) 头尾不再触及 0/100，小样本不产生虚假极端分；
 * (2) 天然携带不确定性，供误差界合成。n=1 时为 50±28.9（等于没有信息）。
 */
function percentileScores(
  values: { key: string; value: number }[],
  direction: 'higher' | 'lower',
): Map<string, { pct: number; se: number }> {
  const out = new Map<string, { pct: number; se: number }>();
  const n = values.length;
  if (n === 0) return out;
  const sorted = [...values].sort((a, b) =>
    direction === 'higher' ? b.value - a.value : a.value - b.value,
  ); // 好→差
  sorted.forEach((v, i) => {
    const r = i + 1;
    const pct = ((n + 1 - r) / (n + 1)) * 100;
    const se = 100 * Math.sqrt((r * (n + 1 - r)) / ((n + 1) * (n + 1) * (n + 2)));
    out.set(v.key, { pct, se });
  });
  return out;
}

export interface ScoreEngine {
  issues: Issue[];
  entities: Map<string, EntityScore>;
  rank(weights: Record<string, number>): FitResult[];
}

export function buildScoreEngine(
  metrics: MetricDef[],
  evidence: EvidenceRec[],
  now = new Date(),
): ScoreEngine {
  const issues: Issue[] = [];
  const defs = new Map(metrics.map((m) => [m.id, m]));

  // ---- 1) 校验：指标已注册、取值在合理域、时效在窗口内 ----
  type Rec = EvidenceRec & { def: MetricDef; stale: boolean; rejected: boolean };
  const recs: Rec[] = [];
  for (const e of evidence) {
    const def = defs.get(e.metric);
    if (!def) {
      throw new Error(`[evidence] ${e.id}: 未注册指标 "${e.metric}"，先在 metrics.yaml 登记`);
    }
    const [lo, hi] = def.plausible;
    const rejected = e.value < lo || e.value > hi;
    if (rejected) {
      issues.push({
        level: 'warn',
        msg: `${e.id} (${e.variant}/${def.id}) 值 ${e.value} 超出合理域 [${lo}, ${hi}]，仅展示不入分`,
      });
    }
    const stale = daysBetween(now, e.retrieved_at) > def.freshness_days;
    if (stale) {
      issues.push({
        level: 'warn',
        msg: `${e.id} (${e.variant}/${def.id}) 已过期（>${def.freshness_days}天），仅展示不入分`,
      });
    }
    recs.push({ ...e, def, stale, rejected });
  }

  // ---- 2) 去重与冲突检测：同一 (metric, variant) 同日多条取中位数并标记 disputed ----
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    const key = `${r.metric}::${r.subject}::${r.variant}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const latest = new Map<string, Rec & { disputed: boolean }>();
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => b.retrieved_at.getTime() - a.retrieved_at.getTime());
    const newest = sorted[0];
    const sameDay = sorted.filter((r) => r.retrieved_at.getTime() === newest.retrieved_at.getTime());
    let disputed = false;
    if (sameDay.length > 1) {
      const vals = sameDay.map((r) => r.value);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread / Math.max(1, Math.abs(median(vals))) > 0.1) {
        disputed = true;
        issues.push({ level: 'warn', msg: `证据冲突：${key} 同日多来源分歧>10%，取中位数` });
      }
    }
    // 冲突时以同日中位数入分（口径与 warn 文案一致），记录仍指向最新一条
    const value = disputed ? median(sameDay.map((r) => r.value)) : newest.value;
    latest.set(key, { ...newest, value, disputed });
  }

  // ---- 3) 归一化：每个指标在其证据组内做 Beta 后验百分位 ----
  const normByMetric = new Map<string, Map<string, { pct: number; se: number }>>();
  const cohortByMetric = new Map<string, number>();
  const entityKeyOf = (r: { subject: string; variant: string }) => `${r.subject}::${r.variant}`;
  for (const def of metrics) {
    const cohort = [...latest.values()].filter(
      (r) => r.metric === def.id && !r.rejected && !r.stale,
    );
    cohortByMetric.set(def.id, cohort.length);
    normByMetric.set(
      def.id,
      percentileScores(
        cohort.map((r) => ({ key: entityKeyOf(r), value: r.value })),
        def.direction,
      ),
    );
  }

  // ---- 4) 实体与维度聚合 ----
  const entities = new Map<string, EntityScore>();
  for (const r of latest.values()) {
    if (r.rejected) continue; // 域外数据不参与任何分数
    const key = entityKeyOf(r);
    if (!entities.has(key)) {
      entities.set(key, { key, subject: r.subject, variant: r.variant, facts: {}, dimScores: {} });
    }
    const ent = entities.get(key)!;
    const norm = normByMetric.get(r.metric)?.get(key);
    const cohort = cohortByMetric.get(r.metric) ?? 1;
    const age = daysBetween(now, r.retrieved_at);
    // 时效衰减：窗口内线性从 1 → 0.5，到窗口边界与「过期剔除」衔接
    const decay = 1 - 0.5 * Math.min(1, Math.max(0, age / r.def.freshness_days));
    const reliability =
      (TIER_WEIGHT[r.def.source_tier] ?? 0.5) * decay * (r.disputed ? 0.85 : 1);
    ent.facts[r.metric] = {
      metric: r.metric,
      value: r.value,
      score: norm?.pct ?? 50,
      se: norm?.se ?? 28.9,
      evidId: r.id,
      source: r.source,
      sourceUrl: r.source_url,
      retrievedAt: r.retrieved_at,
      tier: r.def.source_tier,
      stale: r.stale,
      disputed: r.disputed,
      reliability,
      cohort,
      notes: r.notes,
    };
  }

  for (const ent of entities.values()) {
    const byDim = new Map<string, Fact[]>();
    for (const f of Object.values(ent.facts)) {
      if (f.stale) continue;
      const dim = defs.get(f.metric)!.dimension;
      if (!byDim.has(dim)) byDim.set(dim, []);
      byDim.get(dim)!.push(f);
    }
    for (const [dim, fs] of byDim) {
      const wSum = fs.reduce((a, f) => a + f.reliability, 0) || 1;
      const score = fs.reduce((a, f) => a + f.reliability * f.score, 0) / wSum;
      // 指标内估计误差 + 指标间分歧（加权样本方差），单一指标时保底
      const withinVar = fs.reduce((a, f) => a + (f.reliability * f.se) ** 2, 0) / (wSum * wSum);
      const betweenVar =
        fs.length > 1
          ? fs.reduce((a, f) => a + f.reliability * (f.score - score) ** 2, 0) / wSum
          : 0;
      const se = Math.max(SE_FLOOR, Math.sqrt(withinVar + betweenVar));
      ent.dimScores[dim] = { score, se, n: fs.length };
    }
  }

  // ---- 5) 场景评分 ----
  // 引擎中「至少有一个实体有数据」的维度集合：实体缺失这些维度时按中位先验收缩
  // （经验贝叶斯——缺数据 ≠ 中庸，而是向 50 收缩并放大误差界）；全站都无数据的维度
  // （如证据缺口中的长上下文）不参与任何实体的评分，避免整体分数无意义压缩。
  const dimsInEngine = new Set<string>();
  for (const ent of entities.values()) {
    for (const d of Object.keys(ent.dimScores)) dimsInEngine.add(d);
  }
  /** 实体缺失、但引擎中存在数据的维度，按先验 50 ± 28.9（均匀分布 sd，与 n=1 Beta 后验一致）计入 */
  const PRIOR_SCORE = 50;
  const PRIOR_SE = 28.9;

  const blendedPrices = [...entities.values()]
    .map((ent) => {
      const i = ent.facts['price_input_usd_m'];
      const o = ent.facts['price_output_usd_m'];
      return i && o && !i.stale && !o.stale ? { key: ent.key, price: i.value + o.value } : null;
    })
    .filter((x): x is { key: string; price: number } => x !== null);
  const priceMedian = blendedPrices.length ? median(blendedPrices.map((p) => p.price)) : null;

  function scoreEntity(ent: EntityScore, weights: Record<string, number>): FitResult {
    const totalW = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    let usedW = 0; // 实测覆盖的权重（决定 coverage）
    let inclW = 0; // 参与拟合的权重（实测 + 先验收缩）
    let acc = 0;
    let accMeasured = 0; // 仅实测维度的加权和（性价比分口径）
    let varAcc = 0;
    // 置信度各因子按「场景权重 × 指标可靠度」双重加权（只统计实测证据）
    let srcNum = 0;
    let srcDen = 0;
    let smpNum = 0;
    let smpDen = 0;
    let frsNum = 0;
    let frsDen = 0;
    let disputed = false;
    for (const [dim, w] of Object.entries(weights)) {
      const ds = ent.dimScores[dim];
      if (ds === undefined) {
        if (dimsInEngine.has(dim)) {
          // 该维度引擎中有数据、此实体没有 → 先验收缩，不确定性照常计入误差界
          inclW += w;
          acc += w * PRIOR_SCORE;
          varAcc += (w * PRIOR_SE) ** 2;
        }
        continue;
      }
      usedW += w;
      inclW += w;
      acc += w * ds.score;
      accMeasured += w * ds.score;
      varAcc += (w * ds.se) ** 2;
      // 该维度下的有效事实（与聚合口径一致）
      const fs = Object.values(ent.facts).filter(
        (f) => !f.stale && defs.get(f.metric)!.dimension === dim,
      );
      const fw = fs.reduce((a, f) => a + f.reliability, 0) || 1;
      for (const f of fs) {
        const ww = (w * f.reliability) / fw;
        const def = defs.get(f.metric)!;
        const age = daysBetween(now, f.retrievedAt);
        srcNum += ww * (TIER_WEIGHT[f.tier] ?? 0.5);
        smpNum += ww * Math.min(1, f.cohort / SAMPLE_N_FULL);
        frsNum += ww * (1 - FRESH_SLOPE * Math.min(1, Math.max(0, age / def.freshness_days)));
        srcDen += ww;
        smpDen += ww;
        frsDen += ww;
        if (f.disputed) disputed = true;
      }
    }
    const coverage = usedW / totalW;
    const fit = inclW > 0 ? acc / inclW : null;
    const se = inclW > 0 ? Math.max(SE_FLOOR, Math.sqrt(varAcc) / inclW) : SE_FLOOR;
    const ci: [number, number] = [Math.max(0, fit - Z90 * se), Math.min(100, fit + Z90 * se)];
    const sourceFactor = srcDen ? srcNum / srcDen : 0.5;
    const sampleFactor = smpDen ? smpNum / smpDen : 0.5;
    const freshFactor = frsDen ? frsNum / frsDen : 0.5;
    const agreeFactor = disputed ? 0.9 : 1;
    // Glicko 式时效处理：分数不因数据变旧而缩水（衰减只影响组内权重），
    // 确定性随数据年龄与样本量降级，过期数据由硬门禁整体剔除。
    const confidence = coverage * sourceFactor * sampleFactor * freshFactor * agreeFactor;
    const i = ent.facts['price_input_usd_m'];
    const o = ent.facts['price_output_usd_m'];
    const hasPrice = i && o && !i.stale && !o.stale;
    const blendedPrice = hasPrice ? i.value + o.value : null;
    // 性价比分：只用「有真实能力证据」的变体 + 实测适配分（不含先验收缩）——
    // 否则纯价格证据的变体会以 fit=先验 50 × 价格比上限 2 满分齐平，档位失去信息量
    const hasCapability = Object.values(ent.facts).some(
      (f) => !f.stale && defs.get(f.metric)!.dimension !== 'cost',
    );
    const fitMeasured = usedW > 0 ? accMeasured / usedW : null;
    let value: number | null = null;
    if (fitMeasured !== null && hasCapability && blendedPrice !== null && priceMedian) {
      value = fitMeasured * Math.min(2, priceMedian / blendedPrice);
    }
    return { entity: ent, fit, se, ci, coverage, confidence, value, blendedPrice };
  }

  return {
    issues,
    entities,
    rank(weights: Record<string, number>): FitResult[] {
      return [...entities.values()]
        .map((ent) => scoreEntity(ent, weights))
        // coverage = 0 → 该实体在本场景权重内没有任何实测维度，fit 是纯先验 50，
        // 排名无信息量（榜单/场景排名/性价比均不应出现「占位分」），故不入榜
        .filter((r) => r.fit !== null && r.coverage > 0)
        .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));
    },
  };
}

export function confidenceLabel(c: number): { label: string; cls: 'ok' | 'warn' | 'bad' } {
  if (c >= 0.7) return { label: '高', cls: 'ok' };
  if (c >= 0.4) return { label: '中', cls: 'warn' };
  return { label: '低', cls: 'bad' };
}

/** 分数 ± 90% 误差界（Z90 = 1.645，与 FitResult.ci 同口径） */
export function ci90(score: number, se: number): [number, number] {
  return [Math.max(0, score - Z90 * se), Math.min(100, score + Z90 * se)];
}
