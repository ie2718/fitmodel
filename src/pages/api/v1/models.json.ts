import type { APIRoute } from 'astro';
import { buildApiData, jsonHeaders, metaBlock } from '../../../lib/api';

/**
 * GET /api/v1/models.json — 全部模型变体的能力分（综合指数 + 维度分，带 90% 误差界）、API 价格与性价比。
 */
export const GET: APIRoute = async ({ site }) => {
  const data = await buildApiData();
  const body = {
    ...metaBlock(site!, {
      description:
        'models[] 为模型变体（评分实体）。scores.overall = 综合能力指数（权重见 methodology），ci90 = 90% 误差界，区间重叠的相邻名次视为并列；scores.dimensions 为维度百分位分；value_score = 性价比分（越高越划算）；evidence[] 为支撑证据 id（对照 evidence.json 可回查原文）。仅有价格证据、无能力数据的变体不入榜（unranked_variants）。',
      data_as_of: data.data_as_of,
      ranked_variants: data.ranked_variants,
      unranked_variants: data.unranked_variants,
    }),
    models: data.models,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
