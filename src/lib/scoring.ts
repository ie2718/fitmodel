/**
 * FitModel 评分引擎（构建时运行，纯函数，无副作用）。
 *
 * 流水线：校验 → 去重/冲突检测 → Beta 后验百分位归一化 → 指标权重×可靠度加权维度聚合 → 场景适配分/误差界/置信度/性价比。
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
  /** 指标在维度内的相对权重（缺省 1）：可靠度之外的第二重话语权，取值公示于 metrics.yaml；
   *  调整需人工确认并同步方法论页与 changelog（算法层改动留痕） */
  weight?: number;
  /** 缺席先验：指标在引擎内有数据、实体在该指标维度内有其他实测、唯独缺本指标时，
   *  注入一条合成先验事实参与聚合。适用场景：现役精选榜（如 AA，官方下架被替代代际）——
   *  缺席本身是「非现役」证据。pct/se 公示于 metrics.yaml，调整需留痕。 */
  absence_prior?: { pct: number; se: number };
  /** 名次型指标的固定前沿参考系大小（与采集政策一致，如 arena 前沿 50）：
   *  百分位按「名次 / 参考系」计算而非按已采集条数——采集范围扩大时分数不再漂移 */
  cohort_size?: number;
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
  /** 合成先验事实（非实测）：展示层与 API 应过滤，不作为「依据」展示 */
  prior?: boolean;
  /** 类目覆盖滞后折减标记：名次显著（>40 百分位）低于自身其余实测的共识，可靠度已 ×0.5 */
  outlier?: boolean;
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

/** 标准正态分布 CDF（Abramowitz–Stegun 7.1.26 erf 近似，绝对误差 < 1.5e-7） */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** 标准正态密度 */
function normalPdf(z: number): number {
  return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * 组内归一化，按指标类型分两轨（选型依据 docs/research-2026-09.md）：
 *
 * 1. 序数型（unit = rank，如 Arena 分类目名次）：Beta 后验百分位。
 *    名次只有先后没有量级，Beta 后验把「排名估计」当统计量：头部约 93 而非 100，
 *    天然携带标准误。n = 1 → 50 ± 28.9（等于没有信息）。
 *
 * 2. 区间型（Elo、百分比、价格等有量纲的值）：z-score → 正态 CDF 百分位。
 *    名次百分位会把「1 分之差」放大成几个百分位（SWE-bench 榜首集群 76.8 vs 75.8
 *    的差距与第 8 名几乎同宽），z-score 保留量级：分差 ∝ z 分差。
 *    价格先取对数（跨三个数量级，跨量级比较用对数轴是行业惯例）。
 *    标准误用 delta 法：se = 100 × φ(z) × √((1+z²/2)/n)。
 *    n < 4 时 z 不稳定，回退 Beta 百分位。
 */
function normalizeScores(
  values: { key: string; value: number }[],
  direction: 'higher' | 'lower',
  unit: string,
  cohortSize?: number,
): Map<string, { pct: number; se: number }> {
  const out = new Map<string, { pct: number; se: number }>();
  const n = values.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(values[0].key, { pct: 50, se: 28.9 });
    return out;
  }

  const ordinal = unit === 'rank';
  if (ordinal && cohortSize && direction === 'lower') {
    // 固定前沿参考系：名次即证据值（r），百分位 = (R+1−r)/(R+1)。
    // R 与采集政策对齐（如前沿 50）：同一名次永远得到同一百分位，
    // 采集范围扩大不再引起分数漂移；超出参考系的名次（r>R）贴地保底。
    const R = cohortSize;
    for (const v of values) {
      const r = Math.max(1, Math.min(v.value, R + 1));
      const pct = Math.max(1, ((R + 1 - r) / (R + 1)) * 100);
      const se = Math.max(4, 100 * Math.sqrt((r * (R + 1 - r)) / ((R + 1) * (R + 1) * (R + 2))));
      out.set(v.key, { pct, se });
    }
    return out;
  }
  if (ordinal || n < 4) {
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

  // ---- 区间型：z-score → 正态 CDF ----
  const useLog = unit.includes('USD'); // 价格跨数量级，对数化后比较
  const xs = values.map((v) => (useLog ? Math.log(Math.max(v.value, 1e-6)) : v.value));
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1));
  if (sd === 0) {
    for (const v of values) out.set(v.key, { pct: 50, se: 28.9 });
    return out;
  }
  for (let i = 0; i < values.length; i++) {
    let z = (xs[i] - mean) / sd;
    if (direction === 'lower') z = -z;
    z = Math.max(-2.6, Math.min(2.6, z)); // 温缩极端值，防离群点独占 0/100
    const pct = normalCdf(z) * 100;
    const se = Math.max(4, 100 * normalPdf(z) * Math.sqrt((1 + (z * z) / 2) / n));
    out.set(values[i].key, { pct, se });
  }
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
      normalizeScores(
        cohort.map((r) => ({ key: entityKeyOf(r), value: r.value })),
        def.direction,
        def.unit,
        def.cohort_size,
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

  // ---- 4.5) 缺席先验注入 + 跨信号一致性折减 ----
  // a) 缺席先验（absence_prior，如 AA 现役前沿榜）：实体在该指标维度内有其他实测、唯独缺本指标时，
  //    注入一条先验事实。依据：现役精选榜会下架被替代代际（AA 下架 GPT-5.6 先例），
  //    缺席 ⇒ 非现役 ⇒ 能力期望低于在榜中位且高度不确定（pct/se 公示于 metrics.yaml）。
  //    注意只对「维度内有实测」的实体注入——全维度缺失的实体走第二段知情先验，不重复收缩。
  for (const def of metrics) {
    const ap = def.absence_prior;
    if (!ap) continue;
    for (const ent of entities.values()) {
      if (ent.facts[def.id]) continue;
      const hasDim = Object.values(ent.facts).some(
        (f) => !f.stale && defs.get(f.metric)!.dimension === def.dimension,
      );
      if (!hasDim) continue;
      ent.facts[def.id] = {
        metric: def.id,
        value: ap.pct,
        score: ap.pct,
        se: ap.se,
        evidId: `prior::${def.id}`,
        source: `${def.source}（缺席先验）`,
        sourceUrl: '',
        retrievedAt: now,
        tier: def.source_tier,
        stale: false,
        disputed: false,
        reliability: TIER_WEIGHT[def.source_tier] ?? 0.5,
        cohort: cohortByMetric.get(def.id) ?? 1,
        prior: true,
        notes: `缺席先验：未见于现役榜，按 ${ap.pct}±${ap.se} 收缩`,
      };
    }
  }
  // b) 类目覆盖滞后折减：名次型事实低于同一实体其余实测（不含先验/价格）可靠度加权中位数 40 分以上、
  //    且其余实测 ≥4 条 —— 新旗舰进入类目榜滞后的典型形态（同 Text 总榜曾缺 GPT-6）。
  //    可靠度 ×0.5 并打标，不删证据、可回查；只单向向下（覆盖滞后只会表现为名次异常低）。
  for (const ent of entities.values()) {
    const cap = Object.values(ent.facts).filter(
      (f) => !f.prior && !f.stale && defs.get(f.metric)!.dimension !== 'cost',
    );
    if (cap.length < 5) continue;
    for (const f of cap) {
      if (defs.get(f.metric)!.unit !== 'rank') continue;
      const others = cap.filter((x) => x !== f);
      const consensus = median(others.map((x) => x.score));
      if (consensus - f.score > 40) {
        f.reliability *= 0.5;
        f.outlier = true;
      }
    }
  }

  for (const ent of entities.values()) {
    const byDim = new Map<string, Fact[]>();
    for (const f of Object.values(ent.facts)) {
      if (f.stale) continue;
      const dim = defs.get(f.metric)!.dimension;
      if (!byDim.has(dim)) byDim.set(dim, []);
      byDim.get(dim)!.push(f);
    }
    // 该实体的缺席先验事实（如有）：供纯名次维度收缩用
    const entPrior = Object.values(ent.facts).find((f) => f.prior);
    for (const [dim, fs] of byDim) {
      // 证据话语权 = 指标权重 × 可靠度（weight 缺省 1；如 AA 智能指数 2×，公示于 metrics.yaml）
      const ew = (f: Fact) => f.reliability * (defs.get(f.metric)?.weight ?? 1);
      const wSum = fs.reduce((a, f) => a + ew(f), 0) || 1;
      let score = fs.reduce((a, f) => a + ew(f) * f.score, 0) / wSum;
      // 指标内估计误差 + 指标间分歧（加权样本方差），单一指标时保底
      const withinVar = fs.reduce((a, f) => a + (ew(f) * f.se) ** 2, 0) / (wSum * wSum);
      const betweenVar =
        fs.length > 1
          ? fs.reduce((a, f) => a + ew(f) * (f.score - score) ** 2, 0) / wSum
          : 0;
      let se = Math.max(SE_FLOOR, Math.sqrt(withinVar + betweenVar));
      // c) 非现役实体的纯名次维度收缩：维度证据全部是名次型（偏好类目）时，
      //    偏好名次对「现役能力」的代表性已被 AA 缺席部分否定 → 与缺席先验 50/50 收缩，
      //    先验不确定性并入维度误差。含区间型实测（SWE/AA/规格）的维度不受影响。
      if (
        entPrior &&
        dim !== 'cost' &&
        fs.every((f) => defs.get(f.metric)!.unit === 'rank')
      ) {
        score = (score + entPrior.score) / 2;
        se = Math.max(SE_FLOOR, Math.sqrt(se * se + (entPrior.se / 2) ** 2));
      }
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
    // ---- 第一段：实测维度聚合 + 置信度因子 ----
    const measuredFactWeights: Array<{ w: number; ds: DimScore }> = [];
    for (const [dim, w] of Object.entries(weights)) {
      const ds = ent.dimScores[dim];
      if (ds === undefined) continue;
      usedW += w;
      accMeasured += w * ds.score;
      varAcc += (w * ds.se) ** 2;
      measuredFactWeights.push({ w, ds });
      // 该维度下的有效事实（与聚合口径一致：话语权 = 指标权重 × 可靠度）
      const fs = Object.values(ent.facts).filter(
        (f) => !f.stale && defs.get(f.metric)!.dimension === dim,
      );
      const ew = (f: Fact) => f.reliability * (defs.get(f.metric)?.weight ?? 1);
      const fw = fs.reduce((a, f) => a + ew(f), 0) || 1;
      for (const f of fs) {
        const ww = (w * ew(f)) / fw;
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
    const sourceFactor = srcDen ? srcNum / srcDen : 0.5;
    const sampleFactor = smpDen ? smpNum / smpDen : 0.5;
    const freshFactor = frsDen ? frsNum / frsDen : 0.5;
    const agreeFactor = disputed ? 0.9 : 1;
    // ---- 第二段：缺失维度用「知情先验」收缩 ----
    // 先验不再是盲目的 50，而是该实体自身实测水平（已知强 → 其他维度按同水平估计），
    // 按证据可靠度（来源层级 × 样本量）打折——证据越薄越向中位回落，夹在 [30, 70]。
    // 对比盲先验：AA 总榜第 2 的新模型不再被「缺编码/写作数据」拖到中游冒充实排。
    const measuredMean = usedW > 0 ? accMeasured / usedW : null;
    const priorConfidence = sourceFactor * sampleFactor;
    const informedPrior =
      measuredMean !== null
        ? Math.max(30, Math.min(70, 50 + (measuredMean - 50) * priorConfidence))
        : PRIOR_SCORE;
    let inclW = 0;
    let acc = 0;
    for (const [dim, w] of Object.entries(weights)) {
      const ds = ent.dimScores[dim];
      if (ds === undefined) {
        if (dimsInEngine.has(dim)) {
          // 该维度引擎中有数据、此实体没有 → 知情先验收缩，不确定性照常计入误差界
          inclW += w;
          acc += w * informedPrior;
          varAcc += (w * PRIOR_SE) ** 2;
        }
        continue;
      }
      inclW += w;
      acc += w * ds.score;
    }
    const coverage = usedW / totalW;
    const fit = inclW > 0 ? acc / inclW : null;
    const se = inclW > 0 ? Math.max(SE_FLOOR, Math.sqrt(varAcc) / inclW) : SE_FLOOR;
    const ci: [number, number] = [Math.max(0, fit - Z90 * se), Math.min(100, fit + Z90 * se)];
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
