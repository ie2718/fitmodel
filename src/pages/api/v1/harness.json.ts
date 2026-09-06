import type { APIRoute } from 'astro';
import { buildHarnessData, jsonHeaders, metaBlock } from '../../../lib/api';
import { absoluteUrl } from '../../../lib/meta';

/**
 * GET /api/v1/harness.json — Harness 榜：SWE-bench Verified 各 agent harness 公开最好成绩
 * （harness × 搭配模型组合成绩，模型已明示）+ 未公开提交的知名 Harness 产品属性。
 */
export const GET: APIRoute = async ({ site }) => {
  const s = site!;
  const data = await buildHarnessData();
  const body = {
    ...metaBlock(s, {
      description:
        'ranked[] = 在 SWE-bench Verified 公开提交过成绩的 Agent Harness（每 harness 取最优运行；score 为解决率 %，model 为该次运行搭配的模型——横向比较含模型因素）。unpublished[] = 未公开提交的知名 Harness（Cursor、Claude Code 等），仅列产品属性、不参与排名。口径与模型榜的 bash-only 隔离口径不同。',
      methodology_url: new URL(absoluteUrl('/methodology/', s)).href,
      count: data.ranked.length,
      unpublished_count: data.unpublished.length,
    }),
    ranked: data.ranked,
    unpublished: data.unpublished,
  };
  return new Response(JSON.stringify(body, null, 2), { headers: jsonHeaders() });
};
