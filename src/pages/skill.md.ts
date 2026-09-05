import type { APIRoute } from 'astro';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildApiData } from '../lib/api';

/**
 * GET /skill.md — 面向 AI Agent 的技能文件（agentskills.io 规范）。
 * 内容源 = 仓库 skills/fitmodel-model-pick/SKILL.md（单一事实源），
 * 构建时把「场景清单」占位区替换为最新场景列表后输出。
 */
export const GET: APIRoute = async () => {
  const src = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills/fitmodel-model-pick/SKILL.md'),
    'utf8',
  );
  const data = await buildApiData();
  const lines = data.scenarios.map(
    (sc) =>
      `- ${sc.id}: ${sc.title}（${sc.category_label}${sc.scoring_disabled ? '，暂不评分' : ''}）`,
  );
  const body = src.replace(
    /<!-- SCENARIOS:START -->[\s\S]*<!-- SCENARIOS:END -->/,
    `<!-- SCENARIOS:START -->\n${lines.join('\n')}\n<!-- SCENARIOS:END -->`,
  );
  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
