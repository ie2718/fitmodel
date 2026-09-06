/**
 * FitModel 一键同步（npm run sync）
 *
 * 面向维护 agent 的统一入口，把 AGENTS.md「采集流程」的步骤 0/1/5/6 工具化：
 *   1. 鲜度巡检        —— 哪些指标新鲜/过半/过期/缺口
 *   2. 来源变更检测    —— 白名单来源做内容哈希对比，有变化才需要重采
 *   3. 采集任务卡      —— 每个待重采指标给出：来源 URL、上次值、写入模板
 *   4. 排名影响        —— 构建后再次运行，对比上次快照，报告三档推荐的变化面
 *
 * 用法：
 *   npm run sync            # 全流程报告（人类可读）
 *   npm run sync -- --json  # 机器可读输出（供 agent 程序化消费）
 *   npm run sync -- --no-fetch   # 跳过网络检测（离线/CI）
 *
 * 采集写完 evidence.yaml 后：npm run build → 再次 npm run sync 看排名影响。
 * 分工边界见 AGENTS.md：agent 管数据层，人工管观点层。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = path.join(root, 'scripts', '.cache');
const CACHE = path.join(cacheDir, 'source-snapshots.json');
const RANKS = path.join(cacheDir, 'rank-snapshot.json');
const DAY = 86_400_000;

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const noFetch = args.includes('--no-fetch');

const load = (f) => yaml.load(readFileSync(path.join(root, 'src/data', f), 'utf8'));
const metrics = load('metrics.yaml');
const evidence = load('evidence.yaml');
const now = new Date();
const today = now.toISOString().slice(0, 10);

// ---------- 1) 鲜度巡检（口径与 check-freshness.mjs / scoring.ts 一致） ----------
const byMetric = new Map(metrics.map((m) => [m.id, { def: m, latest: null, count: 0 }]));
for (const e of evidence) {
  const slot = byMetric.get(e.metric);
  if (!slot) continue;
  slot.count += 1;
  if (!slot.latest || e.retrieved_at > slot.latest) slot.latest = e.retrieved_at;
}
const freshness = [...byMetric.values()].map(({ def, latest, count }) => {
  if (count === 0) return { def, count, age: null, status: 'gap' };
  const age = Math.floor((now - new Date(latest)) / DAY);
  const status = age > def.freshness_days ? 'stale' : age > def.freshness_days / 2 ? 'due' : 'ok';
  return { def, count, age, latest, status };
});
const statusRank = { stale: 0, gap: 1, due: 2, ok: 3 };
freshness.sort(
  (a, b) => statusRank[a.status] - statusRank[b.status] || (b.age ?? 1e9) - (a.age ?? 1e9),
);
const todo = freshness.filter((r) => r.status !== 'ok');

// ---------- 2) 来源白名单与变更检测 ----------
// tier: 1=官方一手 2=独立基准 3=聚合二手（仅参考）
// method: http=可自动做内容哈希对比；browser=JS 渲染，需浏览器 agent 人工采集
const SOURCES = [
  {
    id: 'arena',
    name: 'arena.ai（原 LMArena）',
    tier: 2,
    method: 'http',
    metrics: ['arena_elo_overall', 'arena_rank_coding', 'arena_rank_writing', 'arena_agent_improvement'],
    urls: ['https://arena.ai/leaderboard'],
    notes: '记录总榜/类目名次与 Elo；页面为 JS 渲染，自动检测失败时用浏览器采集。',
  },
  {
    id: 'swebench',
    name: 'SWE-bench',
    tier: 2,
    method: 'http',
    metrics: ['swe_verified'],
    urls: ['https://www.swebench.com'],
    notes: '口径（bash-only / 官方运行轮次）写进 notes；2026-09-06 已验证浏览器渲染表可全量提取（mini-SWE-agent 官方可比集 47 条）。',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter Rankings',
    tier: 2,
    method: 'http',
    metrics: ['openrouter_tokens_weekly'],
    urls: ['https://openrouter.ai/rankings'],
    notes: '真实路由用量（采用非质量），仅展示于真实用量榜，不进能力分；每周重采。',
  },
  {
    id: 'aa',
    name: 'Artificial Analysis',
    tier: 3,
    method: 'http',
    metrics: ['aa_intelligence_index'],
    urls: ['https://artificialanalysis.ai/models'],
    notes: '仅交叉参考，不入分；与 tier1/2 冲突时提请人工复核。',
  },
  {
    id: 'pricing',
    name: '各厂商官方定价页',
    tier: 1,
    method: 'browser',
    metrics: ['price_input_usd_m', 'price_output_usd_m', 'context_window_k'],
    urls: [
      'https://openai.com/api/pricing/',
      'https://www.anthropic.com/pricing',
      'https://ai.google.dev/pricing',
      'https://api-docs.deepseek.com/quick_start/pricing',
      'https://open.bigmodel.cn/pricing',
      'https://help.aliyun.com/zh/model-studio/models',
      'https://platform.moonshot.cn/pricing',
      'https://www.volcengine.com/product/doubao',
    ],
    notes: 'JS 渲染页为主：用浏览器 agent 逐页采集；DeepSeek 峰谷计价取峰时价（口径延续 2026-08-16）；限时促销价到期前一周复核。',
  },
];
const sourcesOf = (metricId) => SOURCES.filter((s) => s.metrics.includes(metricId));

async function checkSource(src) {
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
  const snapshots = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const result = { id: src.id, name: src.name, method: src.method, urls: [] };
  for (const url of src.urls) {
    const prev = snapshots[url];
    if (src.method === 'browser' || noFetch) {
      result.urls.push({ url, status: 'manual', note: '需浏览器/人工采集' });
      continue;
    }
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'FitModel-sync/1.0 (evidence collector)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const hash = sha(body);
      const changed = prev ? prev.hash !== hash : null;
      snapshots[url] = { hash, checked_at: today };
      result.urls.push({
        url,
        status: changed === null ? 'first-check' : changed ? 'changed' : 'unchanged',
      });
    } catch (err) {
      result.urls.push({ url, status: 'unreachable', note: String(err).slice(0, 120) });
    }
  }
  return { result, snapshots };
}

// ---------- 3) 任务卡 ----------
function taskCard(row) {
  const { def, latest, age, count, status } = row;
  const srcs = sourcesOf(def.id);
  const urls = srcs.flatMap((s) => s.urls);
  return {
    metric: def.id,
    label: def.label,
    status,
    age_days: age,
    window_days: def.freshness_days,
    latest_value_date: latest ? latest.toISOString().slice(0, 10) : null,
    evidence_count: count,
    sources: srcs.map((s) => ({ name: s.name, tier: s.tier, urls: s.urls, notes: s.notes })),
    template: {
      id: `ev-<来源缩写>-<下一个序号>`,
      metric: def.id,
      subject: '<models.yaml 中的模型家族 id>',
      variant: '<具体模型变体名>',
      value: '<原始数值>',
      source: '<来源名>',
      source_url: '<可回查链接>',
      retrieved_at: today,
      verified: false,
      notes: '<口径说明；与上次口径不同时必须写明>',
    },
  };
}

// ---------- 4) 排名影响（需要 dist/api/v1/all.json，即先 npm run build） ----------
function rankDiff() {
  const dist = path.join(root, 'dist', 'api', 'v1', 'all.json');
  if (!existsSync(dist)) return { ready: false, note: '尚未构建（npm run build），无法对比排名' };
  const current = JSON.parse(readFileSync(dist, 'utf8')).scenarios.map((s) => ({
    id: s.id,
    top: s.picks?.top?.variant ?? null,
    value: s.picks?.value?.variant ?? null,
    free: s.picks?.free?.base_variant ?? null,
  }));
  const prev = existsSync(RANKS) ? JSON.parse(readFileSync(RANKS, 'utf8')) : null;
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(RANKS, JSON.stringify({ date: today, scenarios: current }, null, 2));
  if (!prev) return { ready: true, note: '已保存排名快照，下次同步后对比', changes: [] };
  const prevMap = new Map(prev.scenarios.map((s) => [s.id, s]));
  const changes = [];
  for (const cur of current) {
    const old = prevMap.get(cur.id);
    if (!old) continue;
    const diff = ['top', 'value', 'free'].filter((k) => old[k] !== cur[k]);
    if (diff.length > 0) changes.push({ scenario: cur.id, fields: diff, from: old, to: cur });
  }
  return { ready: true, baseline: prev.date, changes };
}

// ---------- 运行 ----------
const checks = [];
if (!noFetch) {
  for (const src of SOURCES) {
    const { result, snapshots } = await checkSource(src);
    checks.push(result);
    if (src.method === 'http') {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(CACHE, JSON.stringify(snapshots, null, 2));
    }
  }
}

const unverified = evidence.filter((e) => !e.verified).length;
const report = {
  date: today,
  freshness: freshness.map((r) => ({
    metric: r.def.id,
    status: r.status,
    age_days: r.age,
    window_days: r.def.freshness_days,
    evidence_count: r.count,
  })),
  sources: checks,
  tasks: todo.map(taskCard),
  rank_diff: rankDiff(),
  pending_manual_review: unverified,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const statusLabel = { stale: '已过期（不入分）', gap: '无证据（缺口）', due: '过半（建议本周重采）', ok: '新鲜' };
  console.log(`FitModel 一键同步 · ${today}\n`);
  console.log('== 1. 鲜度巡检 ==');
  for (const r of freshness) {
    const when = r.latest
      ? `${r.latest.toISOString().slice(0, 10)}（${r.age} 天前，窗口 ${r.def.freshness_days} 天）`
      : `窗口 ${r.def.freshness_days} 天`;
    console.log(`[${r.status.toUpperCase().padEnd(5)}] ${r.def.id.padEnd(24)} ${when} · ${r.count} 条 · ${statusLabel[r.status]}`);
  }
  if (checks.length) {
    console.log('\n== 2. 来源变更检测 ==');
    for (const c of checks) {
      for (const u of c.urls) {
        console.log(`[${u.status.padEnd(12)}] ${c.name} · ${u.url}${u.note ? ` · ${u.note}` : ''}`);
      }
    }
  }
  console.log('\n== 3. 采集任务 ==');
  if (report.tasks.length === 0) {
    console.log('全部指标新鲜，本轮无需采集。');
  } else {
    for (const t of report.tasks) {
      console.log(`\n→ ${t.metric} [${t.status}] ${t.label} · 距上次 ${t.age_days ?? '—'} 天 / 窗口 ${t.window_days} 天`);
      for (const s of t.sources) {
        console.log(`   来源(${s.tier === 1 ? 'tier1 官方' : s.tier === 2 ? 'tier2 基准' : 'tier3 参考'}): ${s.name} → ${s.urls.join(', ')}`);
        if (s.notes) console.log(`   注意: ${s.notes}`);
      }
      console.log(`   写入模板: ${JSON.stringify(t.template, null, 0).slice(0, 240)}…`);
    }
  }
  console.log('\n== 4. 排名影响 ==');
  const rd = report.rank_diff;
  if (!rd.ready) {
    console.log(rd.note);
  } else if (!rd.changes || rd.changes.length === 0) {
    console.log(rd.note ?? '与上次快照相比：三档推荐无变化。');
  } else {
    console.log(`基线 ${rd.baseline} → 当前，${rd.changes.length} 个场景推荐有变化：`);
    for (const ch of rd.changes) {
      for (const f of ch.fields) {
        console.log(`  [${ch.scenario}] ${f}: ${ch.from[f]} → ${ch.to[f]}`);
      }
    }
    console.log('变化面请写入 changelog.yaml 当周条目。');
  }
  console.log(`\n待人工抽查证据：${unverified} 条（verified: false）`);
  console.log('\n== 下一步 ==');
  if (report.tasks.length === 0) {
    console.log('1. npm run build 校验；2. 再次 npm run sync 留排名快照；3. changelog 留痕（如无变化写「本轮无更新」）。');
  } else {
    console.log('1. 按任务卡采集 → 追加到 src/data/evidence.yaml（id 递增、必须带 source_url 与 retrieved_at）；');
    console.log('2. npm run build（构建即校验，未注册指标会直接失败）；');
    console.log('3. 再次 npm run sync 查看排名影响 → 写入 src/data/changelog.yaml；');
    console.log('4. 分工边界见 AGENTS.md：权重、场景正文、指标注册归人工。');
  }
  const stale = freshness.filter((r) => r.status === 'stale');
  if (stale.length > 0) {
    console.error(`\n存在已过期指标：${stale.map((r) => r.def.id).join(', ')}——相关证据已退出评分，本轮必须重采。`);
    process.exitCode = 1;
  }
}
