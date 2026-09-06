import type { APIRoute } from 'astro';
import { buildApiData, jsonHeaders, metaBlock } from '../../../../lib/api';

/**
 * GET /api/v1/scenarios/{id}.json — 单场景完整推荐：权重、三档、全排名（误差界/置信度/价格/依据）。
 * 场景 id 清单见 /api/v1/index.json。
 */
export const getStaticPaths = async () => {
  const data = await buildApiData();
  return data.scenarios.map((sc) => ({ params: { id: sc.id }, props: { scenario: sc } }));
};

export const GET: APIRoute = async ({ site, props }) => {
  const body = {
    ...metaBlock(site!, {
      description:
        'picks.top = 数据上最强；picks.value = 性价比最高（与 top 不同时给出）；picks.free = 有免费额度的国内可用产品中最优入口（产品层推荐：base_family 为底座模型家族，base_variant 仅为该家族内排序依据，免费档不承诺具体变体）。ranking 按适配分排序，ci90 区间重叠时 tied_with_previous=true（视为并列）。引用请注明 data_as_of 与来源链接。',
      data_as_of: (props.scenario as { as_of: string }).as_of,
    }),
    scenario: props.scenario,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
