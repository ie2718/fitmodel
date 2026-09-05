import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getEngine } from '../lib/engine';
import { computePicks } from '../lib/picks';
import { confidenceLabel } from '../lib/scoring';
import { CATEGORIES, isoDate, siteUrl } from '../lib/meta';

const DIM_SHORT: Record<string, string> = {
  general: '通用',
  coding: '编码',
  writing: '写作',
  long_context: '长文',
};

/**
 * llms-full.txt：llms.txt 的完整版——每个场景的全部排名、权重与价格，纯文本。
 * 构建时从数据生成，数据更新 → 重建 → 自动刷新。
 */
export const GET: APIRoute = async (context) => {
  const site = context.site!;
  const abs = (p: string) => new URL(siteUrl(p), site).href;

  const [scenarios, models, products, evidence] = await Promise.all([
    getCollection('scenarios'),
    getCollection('models'),
    getCollection('products'),
    getCollection('evidence'),
  ]);
  const engine = await getEngine();

  const catOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  const catLabel = new Map(CATEGORIES.map((c) => [c.id as string, c.label]));
  const sorted = [...scenarios].sort(
    (a, b) =>
      (catOrder.get(a.data.category) ?? 99) - (catOrder.get(b.data.category) ?? 99) ||
      a.data.title.localeCompare(b.data.title, 'zh-CN'),
  );

  const latest = evidence.reduce(
    (max, e) => (e.data.retrieved_at > max ? e.data.retrieved_at : max),
    evidence[0]?.data.retrieved_at ?? new Date(),
  );

  const sections = sorted.map((s) => {
    const url = abs(`/scenarios/${s.id}/`);
    if (s.data.scoring_disabled) {
      return `### ${catLabel.get(s.data.category) ?? ''} · ${s.data.title}\nURL: ${url}\n暂不评分（${s.data.scoring_note ?? '专项指标建库中'}），结论见页面避坑与建议。`;
    }
    const weights = Object.fromEntries((s.data.dimensions ?? []).map((x) => [x.id, x.weight]));
    const picks = computePicks(
      engine,
      weights,
      models as never,
      products as never,
      s.data.category,
    );
    const weightLine = s.data.dimensions
      .map((x) => `${DIM_SHORT[x.id] ?? x.id} ${Math.round(x.weight * 100)}%`)
      .join(' · ');
    const tiers = [`最强 ${picks.top?.entity.variant ?? '—'}`];
    if (picks.valuePick && picks.valuePick.entity.key !== picks.top?.entity.key) {
      tiers.push(`性价比 ${picks.valuePick.entity.variant}`);
    }
    if (picks.freePick) tiers.push(`免费 ${picks.freePick.product.name}`);

    const rankLines = picks.ranked
      .map((r, i) => {
        const pin = r.entity.facts['price_input_usd_m'];
        const pout = r.entity.facts['price_output_usd_m'];
        const price = pin && pout ? ` · API $${pin.value}/$${pout.value} 每百万 tokens` : '';
        const ci = `±${Math.max(1, Math.round(1.645 * r.se))}`;
        return `${i + 1}. ${r.entity.variant} — 适配 ${r.fit?.toFixed(0)} ${ci}（90% 误差界，相邻名次区间重叠视为并列）· 置信度${confidenceLabel(r.confidence).label}${price}`;
      })
      .join('\n');

    return `### ${catLabel.get(s.data.category) ?? ''} · ${s.data.title}\nURL: ${url}\n权重: ${weightLine} | 三档: ${tiers.join(' · ')}\n\n${rankLines}`;
  });

  const body = `# FitModel llms-full.txt — 全部场景完整排名

> llms.txt 的完整版：每个场景的全部模型排名、维度权重与价格。
> 数据截至 ${isoDate(latest)}，共 ${evidence.length} 条证据；推荐随每周数据同步自动重算，过期数据不入分。
> 排名口径与算法: ${abs('/methodology/')}

${sections.join('\n\n')}

---
引用时请注明「数据截至 ${isoDate(latest)}」与来源链接。本文件由构建自动生成（源码 src/pages/llms-full.txt.ts）。
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
