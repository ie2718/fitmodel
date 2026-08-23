#!/usr/bin/env node
/**
 * 生成每页 OG 分享图(1200×630)到 public/og/。
 *
 * 做法:HTML 模板 + Chrome 无头截图,不引入图像库与字体依赖;
 * CI 不重跑(避免在中文字体缺失的环境出问题),页面标题变动后本地跑一次、提交产物即可:
 *
 *   node scripts/gen-og.mjs [--chrome /path/to/chrome]
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, '..');
const SCEN_DIR = path.join(root, 'src/content/scenarios');
const OUT_DIR = path.join(root, 'public/og');

const chromeFlagIdx = process.argv.indexOf('--chrome');
const chrome =
  chromeFlagIdx > -1
    ? process.argv[chromeFlagIdx + 1]
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? (yaml.load(m[1]) ?? {}) : {};
}

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tpl(title, sub) {
  const size = title.length >= 14 ? 58 : title.length >= 10 ? 70 : 88;
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'PingFang SC', 'Hiragino Sans GB', sans-serif;
    background: #4f46e5; color: #fff;
    padding: 72px 88px; position: relative;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .rule-top { position: absolute; top: 44px; left: 88px; right: 88px; border-top: 3px double rgba(255,255,255,0.55); }
  .rule-bottom { position: absolute; bottom: 44px; left: 88px; right: 88px; border-top: 1px solid rgba(255,255,255,0.4); }
  .head { display: flex; align-items: center; gap: 20px; margin-top: 28px; }
  .mark { width: 76px; height: 76px; border-radius: 17px; background: #fff; color: #4f46e5;
    display: flex; align-items: center; justify-content: center; font-size: 42px; font-weight: 600; }
  .brand { font-size: 30px; font-weight: 700; letter-spacing: 0.02em; }
  .q { font-family: 'Songti SC', 'STSong', 'Noto Serif SC', serif; font-size: ${size}px;
    font-weight: 800; letter-spacing: 0.02em; line-height: 1.25; margin-top: -20px; }
  .sub { margin-top: 26px; font-size: 25px; color: rgba(255,255,255,0.85); letter-spacing: 0.05em; }
  .foot { display: flex; justify-content: space-between; align-items: baseline;
    font-size: 19px; color: rgba(255,255,255,0.75); margin-bottom: 30px; letter-spacing: 0.04em; }
</style></head>
<body>
  <div class="rule-top"></div>
  <div class="head"><div class="mark">适</div><div class="brand">FitModel</div></div>
  <div><div class="q">${esc(title)}</div><div class="sub">${esc(sub)}</div></div>
  <div class="foot"><span>免费够用 / 性价比 / 最强 · 三档推荐</span><span>ie2718.github.io/fitmodel</span></div>
  <div class="rule-bottom"></div>
</body></html>`;
}

const pages = [
  { out: 'index.png', title: '该用什么 AI？', sub: '先说任务，再选模型 · 结论全部由公开数据计算' },
  { out: 'leaderboards.png', title: '公开评测榜单', sub: 'Arena · SWE-bench 原始数据镜像，每条可回查' },
  { out: 'models.png', title: '模型与产品库', sub: '定价 · 国内可用性 · 通用排名' },
  { out: 'methodology.png', title: '推荐是怎么算出来的', sub: '采集 · 校验 · 归一化 · 评分，完整公示' },
  { out: 'changelog.png', title: '更新日志', sub: '每次数据与内容变更都留痕' },
];
for (const f of fs.readdirSync(SCEN_DIR)) {
  if (!f.endsWith('.md')) continue;
  const d = frontmatter(path.join(SCEN_DIR, f));
  const sub = d.summary && d.summary.length > 44 ? d.summary.slice(0, 44) + '…' : (d.summary ?? '');
  pages.push({ out: `scenarios/${f.slice(0, -3)}.png`, title: String(d.title ?? f).split('：')[0], sub });
}

fs.mkdirSync(path.join(OUT_DIR, 'scenarios'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir?.() ?? '/tmp', 'fitmodel-og-'));

for (const p of pages) {
  const html = path.join(tmp, `${path.basename(p.out, '.png')}.html`);
  fs.writeFileSync(html, tpl(p.title, p.sub));
  const out = path.join(OUT_DIR, p.out);
  await run(chrome, [
    '--headless=new', '--disable-gpu', `--screenshot=${out}`,
    '--window-size=1200,630', '--force-device-scale-factor=1', '--hide-scrollbars',
    `file://${html}`,
  ]);
  console.log(`✓ ${path.relative(root, out)}  (${p.title})`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n完成:public/og/ 共 ${pages.length} 张(含子目录 scenarios/)。`);
