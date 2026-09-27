// scripts/build-cinema-index.mjs — 影院名称索引出版（issue 498 / ADR-0209）
//
// 把外部合并好的名称索引（[{n,y,s,k,id}] 数组，见 .scratch/douban-dataset/build_name_index.py
// 的产物；上游 = 自抓 2026 影视表 + Kaggle 豆瓣数据，**不入 git**）规范成插件在线资源：
//   downloads/cinema-douban-index.json
//   { version, updatedAt, stats: { total, kinds[[类别,条数]]（按条数降序） }, rows: [[n,y,s,k,id]] }
//
// rows 用定长数组而非对象：8.5 万行省 ~30% 体积（实测 5.99MB → 4.16MB）。
// 明文 JSON 走 ADR-0207 统一清单 doc 通道（文本 sha256，全链路不支持 gzip/二进制）。
//
// 用法：
//   node scripts/build-cinema-index.mjs [输入文件]
//     输入缺省 .scratch/douban-dataset/cinema_name_index.json（本机构建链，gitignored）
// pnpm cinema-index
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, '.scratch/douban-dataset/cinema_name_index.json');
const OUT = path.join(ROOT, 'downloads/cinema-douban-index.json');
const KINDS = new Set(['电影', '电视剧', '综艺', '动画', '纪录片', '剧集综艺', '剧集/综艺']);

if (!fs.existsSync(INPUT)) {
  console.error(`输入不存在：${INPUT}`);
  console.error('上游数据集不入 git（外部数据合规边界，ADR-0209）；在本机构建链上生成后重试，');
  console.error('或把既有产物 downloads/cinema-douban-index.json 原样保留（清单 sha256 仍有效）。');
  process.exit(1);
}

const src = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
if (!Array.isArray(src)) {
  console.error('输入形状不对：应为 [{n,y,s,k,id}] 数组');
  process.exit(1);
}

const rows = [];
const ids = new Set();
const kindCount = new Map();
for (const r of src) {
  if (!r || typeof r !== 'object') throw new Error('行不是对象');
  const { n, y, s, k, id } = r;
  if (typeof n !== 'string' || !n) throw new Error('名称缺失');
  if (typeof id !== 'string' || !/^\d+$/.test(id)) throw new Error(`豆瓣 ID 非法：${id}`);
  if (ids.has(id)) throw new Error(`豆瓣 ID 重复：${id}（${n}）`);
  ids.add(id);
  const kind = k === '剧集/综艺' ? '剧集综艺' : k; // 出版期归一口径：斜杠类别收拢（展示层无歧义）
  if (!KINDS.has(kind)) throw new Error(`未知类别：${k}`);
  kindCount.set(kind, (kindCount.get(kind) || 0) + 1);
  rows.push([n, String(y ?? ''), String(s ?? ''), kind, id]);
}

const kinds = [...kindCount.entries()].sort((a, b) => b[1] - a[1]);
const today = new Date().toISOString().slice(0, 10);
const out = {
  version: 1,
  updatedAt: today,
  stats: { total: rows.length, kinds },
  rows,
};
const text = JSON.stringify(out) + '\n';
fs.writeFileSync(OUT, text, 'utf8');
console.log(`产出 downloads/cinema-douban-index.json：${rows.length} 条，` +
  `${(Buffer.byteLength(text, 'utf8') / 1048576).toFixed(2)} MB，出版 ${today}`);
console.log(`类别：${kinds.map(([k, c]) => `${k} ${c}`).join(' / ')}`);
