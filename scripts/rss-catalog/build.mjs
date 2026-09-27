// scripts/rss-catalog/build.mjs — RSS 源库出版（issue 495 / ADR-0208；issue 497 / ADR-0209 双上游）
//
// 快照 → 解析/归类/去重（lib.mjs）→ 并发测活 → 产物两份：
//   downloads/rss-catalog.json      统一清单 doc 条目「rss-catalog」的已出版产物（sha256 由 pnpm manifest 现算）
//   scripts/rss-catalog/liveness-report.json  测活报告（随仓库提交，事后审计面）
//
// 测活剔除口径（ADR-0208 决策 5，宁保留不误杀）：
//   剔除 = 确定性死亡：HTTP 404/410、200 但响应无 feed 结构（<rss/<feed/<RDF，疑似普通网页）；
//   保留 = HTTP 403（反爬）/429/5xx/超时/连接失败（重试一次仍如此）——标记进报告，不进剔除。
//   测活视角是发布环境：连不上 ≠ 源死了。
//   路由型条目（via，ADR-0209）**不进测活**：可用性 = 实例 × 上游 × 路由 三维，
//   测活结果时效极短且实例是用户可配项——以 features 筛选代替（ADR-0209 决策 4）。
//
// 用法：
//   pnpm rss-catalog                  # 快照 → 转换 → 测活 → 出版
//   pnpm rss-catalog -- --skip-live   # 跳过测活（调试转换用；出版不许跳）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, parseTimqianTable, parseRssHubRoutes, UPSTREAMS } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const SKIP_LIVE = process.argv.includes('--skip-live');

const CONCURRENCY = 16;
const TIMEOUT_MS = 8000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FEED_MARK_RE = /<(rss|feed|RDF)[\s>]/i;

// ── 1. 快照 → 条目（双上游合并，timqian 在前、序即产物序）──
const mdUp = UPSTREAMS.find((u) => u.format !== 'json');
const jsonUp = UPSTREAMS.find((u) => u.format === 'json');
const mdSnapshot = path.join(HERE, 'upstream', `${mdUp.id}.md`);
if (!fs.existsSync(mdSnapshot)) {
  console.error(`快照缺席：scripts/rss-catalog/upstream/${mdUp.id}.md——先跑 pnpm rss-upstream`);
  process.exit(1);
}
const { entries, noFeed, malformed } = parseTimqianTable(fs.readFileSync(mdSnapshot, 'utf8'));
if (entries.length === 0) {
  console.error('快照解析出 0 条目——上游结构可能变了，请人工核对');
  process.exit(1);
}
let rsshubDropped = null;
let rsshubParsed = 0;
if (jsonUp) {
  const jsonSnapshot = path.join(HERE, 'upstream', `${jsonUp.id}.json`);
  if (!fs.existsSync(jsonSnapshot)) {
    console.error(`快照缺席：scripts/rss-catalog/upstream/${jsonUp.id}.json——先跑 pnpm rss-upstream`);
    process.exit(1);
  }
  const r = parseRssHubRoutes(JSON.parse(fs.readFileSync(jsonSnapshot, 'utf8')));
  rsshubDropped = r.dropped;
  rsshubParsed = r.entries.length;
  if (rsshubParsed === 0) {
    console.error('RSSHub 快照解析出 0 条目——上游结构可能变了，请人工核对');
    process.exit(1);
  }
  entries.push(...r.entries);
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
// 路由型条目（via）不进测活（ADR-0209 决策 4），直接保留
const liveTargets = [];
catalog.feeds.forEach((f, i) => {
  if (!f.via) liveTargets.push(i);
});
if (SKIP_LIVE) {
  console.warn('跳过测活（--skip-live，仅供调试，正式出版不许跳）');
} else {
  process.stdout.write(`测活 ${liveTargets.length} 条（via 路由条目 ${catalog.feeds.length - liveTargets.length} 条免测；并发 ${CONCURRENCY}，超时 ${TIMEOUT_MS}ms）…\n`);
  let cursor = 0;
  let done = 0;
  const results = new Array(liveTargets.length);
  const worker = async () => {
    while (cursor < liveTargets.length) {
      const i = cursor++;
      const r = await probe(catalog.feeds[liveTargets[i]]);
      results[i] = r;
      done++;
      if (done % 200 === 0) process.stdout.write(`  已测 ${done}/${liveTargets.length}\n`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const deadIdx = new Map();
  const unsureIdx = new Map();
  liveTargets.forEach((feedIdx, i) => {
    const r = results[i];
    if (r.state === 'dead') deadIdx.set(feedIdx, r.reason);
    else if (r.state === 'unsure') unsureIdx.set(feedIdx, r.reason);
  });
  catalog.feeds = catalog.feeds.filter((f, i) => {
    if (deadIdx.has(i)) {
      culled.push({ url: f.url, title: f.title, reason: deadIdx.get(i) });
      return false;
    }
    if (unsureIdx.has(i)) unsure.push({ url: f.url, title: f.title, reason: unsureIdx.get(i) });
    return true;
  });
}

// ── 3. 产物 ──
fs.writeFileSync(path.join(ROOT, 'downloads', 'rss-catalog.json'), JSON.stringify(catalog, null, 2) + '\n', 'utf8');

const viaKept = catalog.feeds.filter((f) => f.via).length;
const assigned = catalog.feeds.filter((f) => !f.cats.includes('综合')).length;
const report = {
  generatedAt: new Date().toISOString(),
  upstream: UPSTREAMS.map((u) => ({ id: u.id, page: u.page, license: u.license })),
  parse: { entries: entries.length, noFeedRows: noFeed, malformedRows: malformed, duplicates, invalidUrl, rsshub: { parsed: rsshubParsed, dropped: rsshubDropped } },
  liveness: { skipped: SKIP_LIVE, checked: SKIP_LIVE ? 0 : liveTargets.length, culled: culled.length, keptUnsure: unsure.length },
  kept: catalog.feeds.length,
  keptVia: viaKept,
  categoryCoverage: { withCategory: assigned, fallbackOnly: catalog.feeds.length - assigned },
  culled,
  unsure,
};
fs.writeFileSync(path.join(HERE, 'liveness-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

process.stdout.write(
  `出版 downloads/rss-catalog.json：收录 ${catalog.feeds.length} 条（直连 ${catalog.feeds.length - viaKept}，路由 ${viaKept}）` +
    `（剔除 ${culled.length}，存疑保留 ${unsure.length}，去重 ${duplicates}，上游无 RSS ${noFeed}）\n` +
    `RSSHub 筛选剔除：要配置 ${rsshubDropped?.needConfig ?? 0}，要无头浏览器 ${rsshubDropped?.needPuppeteer ?? 0}，易反爬 ${rsshubDropped?.antiCrawler ?? 0}，无 example ${rsshubDropped?.noExample ?? 0}，example 含参数占位 ${rsshubDropped?.paramExample ?? 0}\n` +
    `归类覆盖：有明确大类 ${assigned}，仅综合 ${catalog.feeds.length - assigned}\n` +
    `报告：scripts/rss-catalog/liveness-report.json\n下一步：pnpm manifest 重出统一清单\n`,
);
