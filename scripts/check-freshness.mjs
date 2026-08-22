/**
 * 鲜度巡检：报告每个注册指标的采集时效，超窗即退出码 1（供定时同步 / CI 门禁使用）。
 * 规则与 scoring.ts 的构建校验一致：超过 freshness_days 的证据「仅展示不入分」，
 * 本脚本把这件事提前到采集侧——哪个指标该重采、还剩几天余量，一张表看清。
 *
 * 用法：npm run check:freshness
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => yaml.load(readFileSync(path.join(root, 'src/data', f), 'utf8'));

const metrics = load('metrics.yaml');
const evidence = load('evidence.yaml');
const now = new Date();

const byMetric = new Map(metrics.map((m) => [m.id, { def: m, latest: null, count: 0 }]));
for (const e of evidence) {
  const slot = byMetric.get(e.metric);
  if (!slot) continue; // 未注册指标由构建硬校验拦截，这里不重复报
  slot.count += 1;
  if (!slot.latest || e.retrieved_at > slot.latest) slot.latest = e.retrieved_at;
}

const day = 86_400_000;
const rows = [...byMetric.values()].map(({ def, latest, count }) => {
  if (count === 0) return { def, count, age: null, status: 'gap' };
  const age = Math.floor((now - new Date(latest)) / day);
  const status = age > def.freshness_days ? 'stale' : age > def.freshness_days / 2 ? 'due' : 'ok';
  return { def, count, age, latest, status };
});
rows.sort((a, b) => {
  const rank = { stale: 0, gap: 1, due: 2, ok: 3 };
  return rank[a.status] - rank[b.status] || (b.age ?? 1e9) - (a.age ?? 1e9);
});

const label = { stale: '已过期（仅展示不入分）', gap: '无证据（采集缺口）', due: '过半（建议本周重采）', ok: '新鲜' };
console.log(`FitModel 鲜度巡检 · ${now.toISOString().slice(0, 10)}\n`);
for (const r of rows) {
  const { def } = r;
  const when = r.latest
    ? `${r.latest.toISOString().slice(0, 10)}（${r.age} 天前，窗口 ${def.freshness_days} 天）`
    : `窗口 ${def.freshness_days} 天`;
  console.log(`[${r.status.toUpperCase().padEnd(5)}] ${def.id.padEnd(24)} ${when} · ${r.count} 条 · ${label[r.status]}`);
}

const stale = rows.filter((r) => r.status === 'stale');
const gap = rows.filter((r) => r.status === 'gap');
const due = rows.filter((r) => r.status === 'due');
const unverified = evidence.filter((e) => !e.verified).length;
console.log(
  `\n合计：${metrics.length} 个注册指标 · ${evidence.length} 条证据 · 过期 ${stale.length} / 缺口 ${gap.length} / 过半 ${due.length} · 待人工抽查 ${unverified} 条`,
);

if (stale.length > 0) {
  console.error(`\n存在已过期指标：${stale.map((r) => r.def.id).join(', ')}。相关证据已退出评分，请按 AGENTS.md 采集流程重采。`);
  process.exit(1);
}
