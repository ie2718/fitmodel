import type { APIRoute } from 'astro';
import { buildApiData, jsonHeaders, metaBlock } from '../../../lib/api';
import { siteUrl } from '../../../lib/meta';

/**
 * GET /api/v1/index.json — Agent 入口端点：自描述元信息 + 全部场景的三档速查 + 综合榜前 5。
 * 其他端点：/api/v1/scenarios/{id}.json · /api/v1/models.json · /api/v1/evidence.json · /api/v1/all.json
 */
export const GET: APIRoute = async ({ site }) => {
  const s = site!;
  const data = await buildApiData();
  const abs = (p: string) => new URL(siteUrl(p), s).href;

  const body = {
    ...metaBlock(s, {
      endpoints: {
        index: abs('/api/v1/index.json'),
        scenario: abs('/api/v1/scenarios/{id}.json').replace('{id}', ':id'),
        models: abs('/api/v1/models.json'),
        evidence: abs('/api/v1/evidence.json'),
        all: abs('/api/v1/all.json'),
        skill: abs('/skill.md'),
      },
      usage:
        '第一步：从 scenarios 找到与任务匹配的场景 id；第二步：GET scenarios/{id}.json 取完整排名与依据；需要全量数据时用 all.json。字段说明见各端点响应内 description 与 methodology_url。',
    }),
    overall_top5: data.models.slice(0, 5).map((m, i) => ({
      rank: i + 1,
      variant: m.variant,
      family: m.family,
      fit: m.scores.overall.fit,
      ci90: m.scores.overall.ci90,
      confidence_label: m.scores.overall.confidence_label,
    })),
    scenarios: data.scenarios.map((sc) => ({
      id: sc.id,
      title: sc.title,
      category: sc.category,
      category_label: sc.category_label,
      summary: sc.summary,
      url: new URL(sc.url, s).href,
      scoring_disabled: sc.scoring_disabled,
      picks: sc.scoring_disabled
        ? null
        : {
            top: sc.picks.top?.variant ?? null,
            value: sc.picks.value?.variant ?? null,
            free_product: sc.picks.free?.product ?? null,
            free_base_model: sc.picks.free?.base_variant ?? null,
          },
    })),
  };

  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
