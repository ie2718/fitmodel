import { getCollection } from 'astro:content';
import { getEngine } from './engine';
import { computePicks } from './picks';
import { CANONICAL_WEIGHTS, DIM_LABEL } from './board';
import { confidenceLabel, type FitResult } from './scoring';
import { CATEGORIES, isoDate, siteUrl } from './meta';
import { HARNESS_NAMES } from './board';

/**
 * Agent API（/api/v1/*）的共享数据装配层。
 * 设计要点（调研结论）：自描述（schema_version/generated_at/字段说明内嵌）、
 * 数值型字段、稳定 URL、CORS 全开——见 docs/research-2026-09.md 第四节。
 */

export interface ApiPrice {
  input_usd_per_m: number;
  output_usd_per_m: number;
  blended_usd_per_m: number;
}

export interface ApiModel {
  subject: string;
  family: string;
  vendor: string;
  variant: string;
  scores: {
    overall: { fit: number; ci90: [number, number]; confidence: number; confidence_label: string };
    dimensions: Record<string, { score: number; se: number; n: number }>;
  };
  price: ApiPrice | null;
  value_score: number | null;
  evidence: string[];
}

export interface ApiPick {
  variant: string;
  subject: string;
  family: string;
  fit: number;
  se: number;
  ci90: [number, number];
  confidence: number;
  confidence_label: string;
  price: ApiPrice | null;
  value_score: number | null;
  evidence: string[];
}

export interface ApiScenario {
  id: string;
  title: string;
  category: string;
  category_label: string;
  summary: string;
  url: string;
  scoring_disabled: boolean;
  weights: Record<string, number>;
  picks: {
    top: ApiPick | null;
    value: ApiPick | null;
    free: {
      product: string;
      product_url: string | null;
      free_tier: string;
      base_family: string;
      base_variant: string;
      fit: number;
    } | null;
  };
  ranking: Array<
    ApiPick & { rank: number; note: string | null; tied_with_previous: boolean }
  >;
  rank_count: number;
  pitfalls: string[];
  as_of: string;
}

export interface ApiEvidence {
  id: string;
  metric: string;
  metric_label: string;
  subject: string;
  variant: string;
  value: number;
  unit: string;
  source: string;
  source_url: string;
  retrieved_at: string;
  verified: boolean;
  notes: string | null;
}

export interface ApiData {
  models: ApiModel[];
  scenarios: ApiScenario[];
  evidence: ApiEvidence[];
  data_as_of: string;
  ranked_variants: number;
  unranked_variants: number;
}

export interface ApiHarness {
  id: string;
  name: string;
  model: string;
  score: number;
  run_date: string | null;
  source_url: string;
  verified: boolean;
}

export interface ApiHarnessData {
  ranked: ApiHarness[];
  unpublished: Array<{
    id: string;
    name: string;
    pricing: string;
    free_tier: string;
    availability_cn: string;
    url: string | null;
  }>;
}

/** Harness 榜数据：SWE-bench Verified 各 harness 公开最好成绩（每 harness 取最优运行）
 *  + 未公开提交的知名 Harness（产品属性展示，不排名）。口径：harness × 搭配模型组合成绩。 */
export async function buildHarnessData(): Promise<ApiHarnessData> {
  const [evidence, products] = await Promise.all([
    getCollection('evidence'),
    getCollection('products'),
  ]);
  const latest = new Map<string, ApiHarness>();
  for (const e of evidence.filter((x) => x.data.metric === 'swe_verified_harness_best')) {
    const subject = e.data.subject;
    const prev = latest.get(subject);
    if (!prev || e.data.value > prev.score) {
      latest.set(subject, {
        id: subject,
        name: HARNESS_NAMES[subject] ?? subject,
        model: e.data.variant,
        score: e.data.value,
        run_date: e.data.notes?.match(/运行日期 (\d{4}-\d{2}-\d{2})/)?.[1] ?? null,
        source_url: e.data.source_url,
        verified: !!e.data.verified,
      });
    }
  }
  const ranked = [...latest.values()].sort((a, b) => b.score - a.score);
  const submitted = new Set(latest.keys());
  const unpublished = products
    .filter((p) => p.data.harness && !submitted.has(p.data.id))
    .map((p) => ({
      id: p.data.id,
      name: p.data.name,
      pricing: p.data.pricing,
      free_tier: p.data.free_tier,
      availability_cn: p.data.availability_cn,
      url: p.data.url ?? null,
    }));
  return { ranked, unpublished };
}

export function jsonHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
  };
}

export function metaBlock(site: URL, extra: Record<string, unknown> = {}) {
  return {
    service: 'FitModel',
    description:
      '按知识工作场景给出 AI 模型/产品推荐（最强/性价比/免费三档）。推荐由可溯源公开证据在构建时计算生成，无人工挑选。引用请注明 data_as_of 日期与来源链接。',
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    language: 'zh-CN',
    license: 'CC-BY-4.0（数据）/ MIT（代码）',
    methodology_url: new URL(siteUrl('/methodology/'), site).href,
    ...extra,
  };
}

function priceOf(r: FitResult): ApiPrice | null {
  const i = r.entity.facts['price_input_usd_m'];
  const o = r.entity.facts['price_output_usd_m'];
  if (!i || !o || i.stale || o.stale) return null;
  return { input_usd_per_m: i.value, output_usd_per_m: o.value, blended_usd_per_m: i.value + o.value };
}

function pickOf(r: FitResult, familyName: string): ApiPick {
  return {
    variant: r.entity.variant,
    subject: r.entity.subject,
    family: familyName,
    fit: round1(r.fit),
    se: round1(r.se),
    ci90: [round1(r.ci[0]), round1(r.ci[1])],
    confidence: round2(r.confidence),
    confidence_label: confidenceLabel(r.confidence).label,
    price: priceOf(r),
    value_score: r.value === null ? null : round1(r.value),
    evidence: Object.values(r.entity.facts)
      .filter((f) => !f.stale && !f.prior)
      .map((f) => f.evidId),
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

export async function buildApiData(): Promise<ApiData> {
  const [models, products, evidence, metrics] = await Promise.all([
    getCollection('models'),
    getCollection('products'),
    getCollection('evidence'),
    getCollection('metrics'),
  ]);
  const engine = await getEngine();
  const metricMeta = new Map(metrics.map((m) => [m.data.id, m.data]));
  const familyName = new Map(models.map((m) => [m.data.id, m.data.name]));

  // ---- models：综合能力指数（公示权重口径）+ 维度分 ----
  const canonical = engine.rank(CANONICAL_WEIGHTS);
  const apiModels: ApiModel[] = canonical.map((r) => ({
    subject: r.entity.subject,
    family: familyName.get(r.entity.subject) ?? r.entity.subject,
    variant: r.entity.variant,
    scores: {
      overall: {
        fit: round1(r.fit),
        ci90: [round1(r.ci[0]), round1(r.ci[1])],
        confidence: round2(r.confidence),
        confidence_label: confidenceLabel(r.confidence).label,
      },
      dimensions: Object.fromEntries(
        Object.entries(r.entity.dimScores).map(([d, v]) => [
          d,
          { score: round1(v.score), se: round1(v.se), n: v.n },
        ]),
      ),
    },
    price: priceOf(r),
    value_score: r.value === null ? null : round1(r.value),
    evidence: Object.values(r.entity.facts)
      .filter((f) => !f.stale && !f.prior)
      .map((f) => f.evidId),
  }));

  // ---- scenarios：全场景三档 + 完整排名 ----
  const scenarios = await getCollection('scenarios');
  const catLabel = new Map(CATEGORIES.map((c) => [c.id as string, c.label]));
  const sorted = [...scenarios].sort((a, b) => a.id.localeCompare(b.id));
  const apiScenarios: ApiScenario[] = [];
  for (const s of sorted) {
    const d = s.data;
    const weights = Object.fromEntries((d.dimensions ?? []).map((x) => [x.id, x.weight]));
    const picks = d.scoring_disabled
      ? null
      : computePicks(engine, weights, models as never, products as never, d.category);
    const ranked: FitResult[] = picks?.ranked ?? [];
    const withFamily = (r: FitResult) => pickOf(r, familyName.get(r.entity.subject) ?? r.entity.subject);
    const ranking = ranked.map((r, i) => ({
      rank: i + 1,
      ...withFamily(r),
      note:
        Object.values(r.entity.facts)
          .filter((f) => !f.stale && !f.prior)
          .map((f) => metricMeta.get(f.metric)?.label ?? f.metric)
          .slice(0, 3)
          .join(' · ') || null,
      tied_with_previous: false,
    }));
    // 误差界重叠 → 与前一名并列（不假装分得出高下）
    let lastCi: [number, number] | null = null;
    for (let i = 0; i < ranking.length; i++) {
      const ci = ranking[i].ci90;
      ranking[i].tied_with_previous = lastCi !== null && ci[0] <= lastCi[1] && lastCi[0] <= ci[1];
      lastCi = ci;
    }
    const top = picks?.top ? withFamily(picks.top) : null;
    const value =
      picks?.valuePick && picks.valuePick.entity.key !== picks.top?.entity.key
        ? withFamily(picks.valuePick)
        : null;
    const free = picks?.freePick
      ? {
          product: picks.freePick.product.name,
          product_url: picks.freePick.product.url ?? null,
          free_tier: picks.freePick.product.free_tier,
          base_family: picks.freePick.base_family,
          base_variant: picks.freePick.best.entity.variant,
          fit: round1(picks.freePick.best.fit),
        }
      : null;
    apiScenarios.push({
      id: s.id,
      title: d.title,
      category: d.category,
      category_label: catLabel.get(d.category) ?? d.category,
      summary: d.summary,
      url: siteUrl(`/scenarios/${s.id}/`),
      scoring_disabled: !!d.scoring_disabled,
      weights: d.scoring_disabled ? {} : weights,
      picks: { top, value, free },
      ranking,
      rank_count: ranked.length,
      pitfalls: d.pitfalls ?? [],
      as_of: ranked.length
        ? isoDate(
            ranked
              .flatMap((r) => Object.values(r.entity.facts))
              .filter((f) => !f.stale && !f.prior)
              .reduce<Date | null>(
                (max, f) => (!max || f.retrievedAt > max ? f.retrievedAt : max),
                null,
              ) ?? new Date(),
          )
        : isoDate(d.last_verified),
    });
  }

  // ---- evidence：全量可回查 ----
  const apiEvidence: ApiEvidence[] = evidence
    .map((e) => ({
      id: e.data.id,
      metric: e.data.metric,
      metric_label: metricMeta.get(e.data.metric)?.label ?? e.data.metric,
      subject: e.data.subject,
      variant: e.data.variant,
      value: e.data.value,
      unit: metricMeta.get(e.data.metric)?.unit ?? '',
      source: e.data.source,
      source_url: e.data.source_url,
      retrieved_at: isoDate(e.data.retrieved_at),
      verified: !!e.data.verified,
      notes: e.data.notes ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const dataAsOf = evidence.reduce<Date>(
    (max, e) => (e.data.retrieved_at > max ? e.data.retrieved_at : max),
    evidence[0]?.data.retrieved_at ?? new Date(),
  );

  return {
    models: apiModels,
    scenarios: apiScenarios,
    evidence: apiEvidence,
    data_as_of: isoDate(dataAsOf),
    ranked_variants: apiModels.length,
    // 有证据但不在综合榜的变体（该口径下无实测能力维度，先验分不入榜）
    unranked_variants: engine.entities.size - apiModels.length,
  };
}

export { DIM_LABEL };
