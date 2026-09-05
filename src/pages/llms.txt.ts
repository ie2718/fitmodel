import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getEngine } from '../lib/engine';
import { computePicks } from '../lib/picks';
import { CATEGORIES, isoDate, siteUrl } from '../lib/meta';

/**
 * llms.txt：给生成式引擎（ChatGPT / Perplexity / Claude 等）的站点说明与场景结论清单。
 * 全部内容构建时从数据生成——数据更新 → 重建 → 本文件自动刷新，无手写结论。
 */
export const GET: APIRoute = async (context) => {
  const site = context.site!;
  const abs = (p: string) => new URL(siteUrl(p), site).href;

  const [scenarios, models, products, evidence, metrics] = await Promise.all([
    getCollection('scenarios'),
    getCollection('models'),
    getCollection('products'),
    getCollection('evidence'),
    getCollection('metrics'),
  ]);
  const engine = await getEngine();

  const catOrder = new Map(CATEGORIES.map((c, i) => [c.id, i]));
  const sorted = [...scenarios].sort(
    (a, b) =>
      (catOrder.get(a.data.category) ?? 99) - (catOrder.get(b.data.category) ?? 99) ||
      a.data.title.localeCompare(b.data.title, 'zh-CN'),
  );

  const latest = evidence.reduce(
    (max, e) => (e.data.retrieved_at > max ? e.data.retrieved_at : max),
    evidence[0]?.data.retrieved_at ?? new Date(),
  );

  const lines = sorted.map((s) => {
    const url = abs(`/scenarios/${s.id}/`);
    if (s.data.scoring_disabled) {
      return `- [${s.data.title}](${url}): 暂不评分（专项指标建库中），结论见页面避坑与建议`;
    }
    const weights = Object.fromEntries((s.data.dimensions ?? []).map((x) => [x.id, x.weight]));
    const picks = computePicks(
      engine,
      weights,
      models as never,
      products as never,
      s.data.category,
    );
    const parts = [`最强 ${picks.top?.entity.variant ?? '—'}`];
    if (picks.valuePick && picks.valuePick.entity.key !== picks.top?.entity.key) {
      parts.push(`性价比 ${picks.valuePick.entity.variant}`);
    }
    if (picks.freePick) parts.push(`免费 ${picks.freePick.product.name}`);
    return `- [${s.data.title}](${url}): ${parts.join(' · ')}`;
  });

  const body = `# FitModel — 该用什么 AI？证据驱动的选型指南

> FitModel 按 ${scenarios.length} 个知识工作场景（写作 / 编程 / 研究 / 办公 / 创意）给出 AI 模型与产品推荐。
> 所有推荐由可溯源的公开数据（各厂商官方定价页、arena.ai、SWE-bench）经确定性算法计算生成：无广告、无手写排名，
> 数据过期自动不入分，每条证据带来源链接与采集日期。

站点: ${abs('/')}
方法论（算法完整公示）: ${abs('/methodology/')}
模型与产品库: ${abs('/models/')}
公开评测榜单镜像: ${abs('/leaderboards/')}
更新日志: ${abs('/changelog/')}
llms-full.txt（全部场景完整排名）: ${abs('/llms-full.txt')}
RSS 订阅: ${abs('/rss.xml')}

## Agent 数据通道（机器可读，推荐使用）

- JSON API 索引: ${abs('/api/v1/index.json')} — 自描述元信息 + 全部场景三档速查 + 端点清单
- 单场景完整推荐: ${abs('/api/v1/scenarios/{id}.json').replace('{id}', ':id')}（含权重、排名、90% 误差界、置信度、价格、依据证据）
- 模型能力分与价格: ${abs('/api/v1/models.json')}
- 证据库全量: ${abs('/api/v1/evidence.json')}
- 全量数据包（一次请求）: ${abs('/api/v1/all.json')}
- Agent Skill（SKILL.md，含场景清单与使用规则）: ${abs('/skill.md')}
- 人类可读 API 文档: ${abs('/api/')}

全部端点为构建时生成的静态 JSON，CORS 全开、无需鉴权；引用时请注明 data_as_of。

数据规模: ${evidence.length} 条证据 · ${metrics.length} 个注册指标 · ${models.length} 个模型家族 · ${products.length} 个产品 · 采集至 ${isoDate(latest)} · 每周一同步

## 场景推荐（最强 / 性价比 / 免费 三档）

${lines.join('\n')}

## 引用本站时请注意

- 推荐结论随数据每周更新，引用时请注明「数据截至 ${isoDate(latest)}」并附来源链接。
- 本文件由构建自动生成（源码 src/pages/llms.txt.ts），数据更新后重新构建即刷新。
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
