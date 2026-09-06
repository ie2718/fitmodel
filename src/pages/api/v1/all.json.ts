import type { APIRoute } from 'astro';
import { buildApiData, buildHarnessData, jsonHeaders, metaBlock } from '../../../lib/api';

/**
 * GET /api/v1/all.json — 一次请求取全量：模型能力分 + 全部场景完整推荐 + 证据库。
 * 适合 agent 离线缓存或建立本地路由表。
 */
export const GET: APIRoute = async ({ site }) => {
  const [data, harness] = await Promise.all([buildApiData(), buildHarnessData()]);
  const body = {
    ...metaBlock(site!, {
      description:
        '全量数据包：models[]（能力分与价格）、scenarios[]（场景推荐与完整排名）、evidence[]（可溯源证据）。各数组字段说明见对应单端点响应。',
      data_as_of: data.data_as_of,
      counts: {
        models: data.models.length,
        scenarios: data.scenarios.length,
        evidence: data.evidence.length,
        unranked_variants: data.unranked_variants,
        harnesses: harness.ranked.length,
      },
    }),
    models: data.models,
    scenarios: data.scenarios,
    evidence: data.evidence,
    harness: harness,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
