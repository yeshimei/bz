// scripts/rss-catalog/fetch-upstream.mjs — 刷新上游清单快照（issue 495 / ADR-0208）
//
// 把上游 README 拉回 `upstream/` 快照（随仓库提交）。「刷新上游」与「出版」（build.mjs）
// 是两步：出版只吃快照，可离线复现、可 diff 审查上游变化，测活结果不夹带网络抖动进 git。
//
// 用法：pnpm rss-upstream
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPSTREAMS } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UPSTREAM_DIR = path.join(HERE, 'upstream');

for (const u of UPSTREAMS) {
  const dest = path.join(UPSTREAM_DIR, `${u.id}.md`);
  process.stdout.write(`拉取 ${u.name} ← ${u.raw}\n`);
  const resp = await fetch(u.raw, { headers: { 'User-Agent': 'bz-rss-catalog-build' } });
  if (!resp.ok) {
    console.error(`拉取失败：HTTP ${resp.status}（${u.raw}）`);
    process.exit(1);
  }
  const text = await resp.text();
  if (!text.includes('| [Feed]')) {
    console.error('快照内容不像上游表格（无 | [Feed] 行）——上游结构变了，请人工核对再入库');
    process.exit(1);
  }
  fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
  fs.writeFileSync(dest, text, 'utf8');
  process.stdout.write(`快照已刷新：scripts/rss-catalog/upstream/${path.basename(dest)}（${text.length} 字节）\n`);
}
