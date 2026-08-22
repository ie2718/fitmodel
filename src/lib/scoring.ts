/**
 * FitModel 评分引擎（构建时运行，纯函数，无副作用）。
 *
 * 流水线：校验 → 去重/冲突检测 → 同组百分位归一化 → 维度聚合 → 场景适配分/置信度/性价比。
 * 设计原则：
 * 1. 没有 evidence.yaml 记录的数据不得参与评分（防幽灵数据）；
 * 2. 未注册指标的证据直接抛错（构建失败）；
 * 3. 缺失数据降低「覆盖率与置信度」，而不是悄悄用猜测补齐。
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

interface Fact {
  metric: string;
  value: number;
  score: number; // 0–100 同组百分位
  evidId: string;
  source: string;
  sourceUrl: string;
  retrievedAt: Date;
  tier: number;
  stale: boolean;
  disputed: boolean;
  notes?: string;
}

export interface EntityScore {
  key: string;
  subject: string;
  variant: string;
  facts: Record<string, Fact>;
  dimScores: Record<string, number>; // dimension -> mean percentile
}

export interface FitResult {
  entity: EntityScore;
  fit: number | null; // 0–100
  coverage: number; // 权重覆盖率 0–1
  confidence: number; // 0–1
  value: number | null; // 性价比分（需 in/out 价格齐备）
  blendedPrice: number | null; // USD/M (in+out)
}

const TIER_WEIGHT: Record<number, number> = { 1: 1, 2: 0.85, 3: 0.5 };

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 同一指标同组内百分位归一化（方向修正），n=1 时给 50 分并靠置信度表达不确定性 */
function percentileScores(
  values: { key: string; value: number }[],
  direction: 'higher' | 'lower',
): Map<string, number> {
  const out = new Map<string, number>();
  const n = values.length;
  if (n === 0) return out;
  if (n === 1) {
    out.set(values[0].key, 50);
    return out;
  }
  const sorted = [...values].sort((a, b) => a.value - b.value);
  sorted.forEach((v, i) => {
    let p = (i / (n - 1)) * 100;
    if (direction === 'lower') p = 100 - p;
    out.set(v.key, p);
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
      issues.push({ level: 'warn', msg: `${e.id} (${e.variant}/${def.id}) 已过期（>${def.freshness_days}天），仅展示不入分` });
    }
    recs.push({ ...e, def, stale, rejected });
  }

  // ---- 2) 去重与冲突检测：同一 (metric, variant) 取最新；同期多条分歧>10% 标记 disputed ----
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
    const sameDay = sorted.filter(
      (r) => r.retrieved_at.getTime() === newest.retrieved_at.getTime(),
    );
    let disputed = false;
    if (sameDay.length > 1) {
      const vals = sameDay.map((r) => r.value);
      const spread = Math.max(...vals) - Math.min(...vals);
      if (spread / Math.max(1, Math.abs(median(vals))) > 0.1) {
        disputed = true;
        issues.push({ level: 'warn', msg: `证据冲突：${key} 同日多来源分歧>10%，取中位数` });
      }
    }
    latest.set(key, { ...newest, disputed });
  }

  // ---- 3) 归一化：每个指标在其证据组内做百分位（方向修正）----
  const normByMetric = new Map<string, Map<string, number>>(); // metric -> entityKey -> score
  const entityKeyOf = (r: { subject: string; variant: string }) => `${r.subject}::${r.variant}`;
  for (const def of metrics) {
    const cohort = [...latest.values()].filter(
      (r) => r.metric === def.id && !r.rejected && !r.stale,
    );
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
    ent.facts[r.metric] = {
      metric: r.metric,
      value: r.value,
      score: normByMetric.get(r.metric)?.get(key) ?? 50,
      evidId: r.id,
      source: r.source,
      sourceUrl: r.source_url,
      retrievedAt: r.retrieved_at,
      tier: r.def.source_tier,
      stale: r.stale,
      disputed: r.disputed,
      notes: r.notes,
    };
  }
  for (const ent of entities.values()) {
    const byDim = new Map<string, number[]>();
    for (const f of Object.values(ent.facts)) {
      if (f.stale) continue;
      const dim = defs.get(f.metric)!.dimension;
      if (!byDim.has(dim)) byDim.set(dim, []);
      byDim.get(dim)!.push(f.score);
    }
    for (const [dim, scores] of byDim) ent.dimScores[dim] = scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  // ---- 5) 场景评分 ----
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
    let usedW = 0;
    let acc = 0;
    let tierSum = 0;
    let tierN = 0;
    let disputed = false;
    for (const [dim, w] of Object.entries(weights)) {
      const ds = ent.dimScores[dim];
      if (ds === undefined) continue;
      usedW += w;
      acc += w * ds;
    }
    for (const f of Object.values(ent.facts)) {
      if (f.stale) continue;
      tierSum += TIER_WEIGHT[f.tier] ?? 0.5;
      tierN++;
      if (f.disputed) disputed = true;
    }
    const coverage = usedW / totalW;
    const fit = usedW > 0 ? acc / usedW : null;
    const sourceFactor = tierN ? tierSum / tierN : 0.5;
    const agreeFactor = disputed ? 0.9 : 1;
    const confidence = coverage * sourceFactor * agreeFactor;
    const i = ent.facts['price_input_usd_m'];
    const o = ent.facts['price_output_usd_m'];
    const hasPrice = i && o && !i.stale && !o.stale;
    const blendedPrice = hasPrice ? i.value + o.value : null;
    let value: number | null = null;
    if (fit !== null && blendedPrice !== null && priceMedian) {
      value = fit * Math.min(2, priceMedian / blendedPrice);
    }
    return { entity: ent, fit, coverage, confidence, value, blendedPrice };
  }

  return {
    issues,
    entities,
    rank(weights: Record<string, number>): FitResult[] {
      return [...entities.values()]
        .map((ent) => scoreEntity(ent, weights))
        .filter((r) => r.fit !== null)
        .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));
    },
  };
}

export function confidenceLabel(c: number): { label: string; cls: 'ok' | 'warn' | 'bad' } {
  if (c >= 0.75) return { label: '高', cls: 'ok' };
  if (c >= 0.5) return { label: '中', cls: 'warn' };
  return { label: '低', cls: 'bad' };
}
