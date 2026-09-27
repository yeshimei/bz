// scripts/rss-catalog/fetch-upstream.mjs — 刷新上游清单快照（issue 495 / ADR-0208；issue 497 / ADR-0209 双上游）
//
// 把上游数据拉回 `upstream/` 快照（随仓库提交）：markdown 表格原样入库；
// RSSHub routes.json（约 8.5MB）经 distillRssHub 蒸馏后入库（约 1MB）。
// 「刷新上游」与「出版」（build.mjs）是两步：出版只吃快照，可离线复现、可 diff 审查上游变化，
// 测活结果不夹带网络抖动进 git。
//
// 用法：pnpm rss-upstream
// 注：raw.githubusercontent.com 在部分网络下不稳，拉取失败可换 gh api
//     （`gh api -H "Accept: application/vnd.github.raw" repos/<owner>/<repo>/contents/<path>`）人工落快照。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPSTREAMS, distillRssHub } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UPSTREAM_DIR = path.join(HERE, 'upstream');

for (const u of UPSTREAMS) {
  const isJson = u.format === 'json';
  const dest = path.join(UPSTREAM_DIR, `${u.id}.${isJson ? 'json' : 'md'}`);
  process.stdout.write(`拉取 ${u.name} ← ${u.raw}\n`);
  const resp = await fetch(u.raw, { headers: { 'User-Agent': 'bz-rss-catalog-build' } });
  if (!resp.ok) {
    console.error(`拉取失败：HTTP ${resp.status}（${u.raw}）`);
    process.exit(1);
  }
  if (isJson) {
    let data;
    try {
      data = JSON.parse(await resp.text());
    } catch {
      console.error('快照不是合法 JSON——上游结构变了，请人工核对再入库');
      process.exit(1);
    }
    const distilled = distillRssHub(data);
    const nsCount = Object.keys(distilled).length;
    const routeCount = Object.values(distilled).reduce((n, ns) => n + Object.keys(ns.routes).length, 0);
    if (nsCount < 100 || routeCount < 1000) {
      console.error(`蒸馏结果规模异常（${nsCount} 命名空间 / ${routeCount} 路由）——上游结构变了，请人工核对再入库`);
      process.exit(1);
    }
    fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(distilled) + '\n', 'utf8');
    process.stdout.write(`快照已刷新：scripts/rss-catalog/upstream/${path.basename(dest)}（${nsCount} 命名空间 / ${routeCount} 路由，${fs.statSync(dest).size} 字节）\n`);
  } else {
    const text = await resp.text();
    if (!text.includes('| [Feed]')) {
      console.error('快照内容不像上游表格（无 | [Feed] 行）——上游结构变了，请人工核对再入库');
      process.exit(1);
    }
    fs.mkdirSync(UPSTREAM_DIR, { recursive: true });
    fs.writeFileSync(dest, text, 'utf8');
    process.stdout.write(`快照已刷新：scripts/rss-catalog/upstream/${path.basename(dest)}（${text.length} 字节）\n`);
  }
}
