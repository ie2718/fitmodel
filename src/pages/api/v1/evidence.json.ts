import type { APIRoute } from 'astro';
import { buildApiData, jsonHeaders, metaBlock } from '../../../lib/api';

/**
 * GET /api/v1/evidence.json — 证据库全量镜像：每条含原始值、来源链接与采集日期，可独立核查。
 */
export const GET: APIRoute = async ({ site }) => {
  const data = await buildApiData();
  const body = {
    ...metaBlock(site!, {
      description:
        'evidence[] 每条 = 一次采集记录：value 为原始数值（unit 为单位），retrieved_at 为采集日期，source_url 可回查来源原文，verified=false 表示尚未人工抽查（参与评分但置信度较低）。评分只使用时效窗口内的证据。',
      data_as_of: data.data_as_of,
      count: data.evidence.length,
    }),
    evidence: data.evidence,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
