// scripts/rss-catalog/build.mjs — RSS 源库出版（issue 495 / ADR-0208）
//
// 快照 → 解析/归类/去重（lib.mjs）→ 并发测活 → 产物两份：
//   downloads/rss-catalog.json      统一清单 doc 条目「rss-catalog」的已出版产物（sha256 由 pnpm manifest 现算）
//   scripts/rss-catalog/liveness-report.json  测活报告（随仓库提交，事后审计面）
//
// 测活剔除口径（ADR-0208 决策 5，宁保留不误杀）：
//   剔除 = 确定性死亡：HTTP 404/410、200 但响应无 feed 结构（<rss/<feed/<RDF，疑似普通网页）；
//   保留 = HTTP 403（反爬）/429/5xx/超时/连接失败（重试一次仍如此）——标记进报告，不进剔除。
//   测活视角是发布环境：连不上 ≠ 源死了。
//
// 用法：
//   pnpm rss-catalog                  # 快照 → 转换 → 测活 → 出版
//   pnpm rss-catalog -- --skip-live   # 跳过测活（调试转换用；出版不许跳）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, parseTimqianTable, UPSTREAMS } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SKIP_LIVE = process.argv.includes('--skip-live');

const CONCURRENCY = 16;
const TIMEOUT_MS = 8000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FEED_MARK_RE = /<(rss|feed|RDF)[\s>]/i;

// ── 1. 快照 → 条目 ──
const upstream = UPSTREAMS[0]; // 首期单上游；多上游时循环快照逐个解析拼接
const snapshotPath = path.join(HERE, 'upstream', `${upstream.id}.md`);
if (!fs.existsSync(snapshotPath)) {
  console.error(`快照缺席：scripts/rss-catalog/upstream/${upstream.id}.md——先跑 pnpm rss-upstream`);
  process.exit(1);
}
const { entries, noFeed, malformed } = parseTimqianTable(fs.readFileSync(snapshotPath, 'utf8'));
if (entries.length === 0) {
  console.error('快照解析出 0 条目——上游结构可能变了，请人工核对');
  process.exit(1);
}
const { catalog, duplicates, invalidUrl } = buildCatalog({
  entries,
  updatedAt: new Date().toISOString().slice(0, 10),
  upstreams: UPSTREAMS,
});

// ── 2. 测活（16 并发 worker 池；404/410 与「200 无 feed 结构」判死，其余重试一次后保留待查） ──
async function probe(feed) {
  let lastReason = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(feed.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      });
      if (resp.status === 200) {
        // 只看前 4KB：feed 根元素（<rss/<feed/<RDF）必在文档头部；XML 前言超 4KB 的活源
        // 会被误判死——已接受的口径（有存疑保留兜不了它，但剔除会进报告可审计）。
        const head = (await resp.text()).slice(0, 4096);
        return FEED_MARK_RE.test(head)
          ? { state: 'ok' }
          : { state: 'dead', reason: '200 但无 feed 结构（疑似普通网页）' };
      }
      if (resp.status === 404 || resp.status === 410) return { state: 'dead', reason: `HTTP ${resp.status}` };
      lastReason = `HTTP ${resp.status}`;
      // 403（反爬）/429/5xx/其余非 2xx：重试一次再定性
    } catch (e) {
      lastReason = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? '超时' : (e?.cause?.code || e?.message || '网络错误');
    }
  }
  return { state: 'unsure', reason: `${lastReason}（重试仍未确认，保留）` };
}

const culled = [];
const unsure = [];
if (SKIP_LIVE) {
  console.warn('跳过测活（--skip-live，仅供调试，正式出版不许跳）');
} else {
  process.stdout.write(`测活 ${catalog.feeds.length} 条（并发 ${CONCURRENCY}，超时 ${TIMEOUT_MS}ms）…\n`);
  let cursor = 0;
  let done = 0;
  const results = new Array(catalog.feeds.length);
  const worker = async () => {
    while (cursor < catalog.feeds.length) {
      const i = cursor++;
      const r = await probe(catalog.feeds[i]);
      results[i] = r;
      done++;
      if (done % 200 === 0) process.stdout.write(`  已测 ${done}/${catalog.feeds.length}\n`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const kept = [];
  catalog.feeds.forEach((f, i) => {
    const r = results[i];
    if (r.state === 'dead') culled.push({ url: f.url, title: f.title, reason: r.reason });
    else {
      if (r.state === 'unsure') unsure.push({ url: f.url, title: f.title, reason: r.reason });
      kept.push(f);
    }
  });
  catalog.feeds = kept;
}

// ── 3. 产物 ──
fs.writeFileSync(path.join(ROOT, 'downloads', 'rss-catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const assigned = catalog.feeds.filter((f) => !f.cats.includes('综合')).length;
const report = {
  generatedAt: new Date().toISOString(),
  upstream: { id: upstream.id, page: upstream.page, license: upstream.license },
  parse: { entries: entries.length, noFeedRows: noFeed, malformedRows: malformed, duplicates, invalidUrl },
  liveness: { skipped: SKIP_LIVE, checked: SKIP_LIVE ? 0 : catalog.feeds.length + culled.length, culled: culled.length, keptUnsure: unsure.length },
  kept: catalog.feeds.length,
  categoryCoverage: { withCategory: assigned, fallbackOnly: catalog.feeds.length - assigned },
  culled,
  unsure,
};
fs.writeFileSync(path.join(HERE, 'liveness-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

process.stdout.write(
  `出版 downloads/rss-catalog.json：收录 ${catalog.feeds.length} 条` +
    `（剔除 ${culled.length}，存疑保留 ${unsure.length}，去重 ${duplicates}，上游无 RSS ${noFeed}）\n` +
    `归类覆盖：有明确大类 ${assigned}，仅综合 ${catalog.feeds.length - assigned}\n` +
    `报告：scripts/rss-catalog/liveness-report.json\n下一步：pnpm manifest 重出统一清单\n`,
);
