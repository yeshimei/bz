// scripts/build-catalog.mjs — 归物本物品分类表出版（issue 478 / 阶段 A）
//
// 把 `src/belongings/catalog/categories.json`（表源，进仓可 diff）出版为远端
// 可分发形态，落 **`downloads/belongings-categories.json`**。
//
// sha256 不再自出一份私有清单：issue 480 / ADR-0203 后，**全插件在线资源的单一
// 事实源是 `downloads/manifest.json`**（`src/core/download-manifest.ts`），分类表作为
// 一条 doc 条目登记在里面（id `belongings-categories`，由 `pnpm manifest` 对已出版
// 产物算 hash）。本脚本只负责出产物 + 校验；清单同步由 `pnpm manifest` 收口。
// 发布顺序：pnpm catalog → pnpm manifest（与 skin-pack / changelog 同一条链）。
//
// 为什么产物进 git：远端读的就是仓库里的 `downloads/`（与 bz-changelog.html、
// skins/ 同一条路；`remotesFor` 的基址自 ADR-0203 起是 downloads/，旧 manual/ 是
// 改名前的冻结过渡副本）。为什么 sha256 在这里算：它是**构建期**产物，插件端只做
// 比对——两侧都对「归一换行后的文本」取 SHA-256（src/core/sha256.ts），免得
// Windows CRLF 与仓库 LF 算出两个值。口径照搬皮肤包脚本。
//
// 用法：
//   node scripts/build-catalog.mjs          # 出版（写 downloads/）
//   node scripts/build-catalog.mjs --check  # 只校验源 ⇄ 产物 ⇄ 清单同步（守卫测试复用）
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const SRC_CAT = path.join(ROOT, 'src/belongings/catalog/categories.json');
const SRC_POOL = path.join(ROOT, 'src/belongings/catalog/icon-pool.json');
const OUT_DIR = path.join(ROOT, 'downloads');
const DATA_FILE = 'belongings-categories.json';
/** 清单里本资源的条目 id（与 build-manifest.mjs 的 DOCS 表一致） */
const MANIFEST_ID = 'belongings-categories';
const MANIFEST_PATH = path.join(ROOT, 'downloads/manifest.json');

/** 换行归一（与 src/core/sha256.ts 的 normalizeEol 同口径） */
const normalizeEol = (s) => String(s).replace(/\r\n?/g, '\n');

/** 文本 sha256（小写 64 位）——与插件端 sha256Hex(normalizeEol(text)) 逐位一致 */
const textSha256 = (s) => createHash('sha256').update(Buffer.from(normalizeEol(s), 'utf8')).digest('hex');

// ---------- 读源 ----------
let cat, pool;
try {
  cat = JSON.parse(fs.readFileSync(SRC_CAT, 'utf8'));
} catch (e) {
  console.error(`读表源失败：${SRC_CAT}\n  ${(e && e.message) || e}`);
  process.exit(1);
}
try {
  pool = JSON.parse(fs.readFileSync(SRC_POOL, 'utf8'));
} catch (e) {
  console.error(`读图标池失败：${SRC_POOL}\n  ${(e && e.message) || e}`);
  process.exit(1);
}

const problems = [];
const isHan = (s) => /^[\u4e00-\u9fff]+$/.test(s); // 纯汉字判定（分类名为 2–8 个汉字）

// ---------- 校验：结构与池内 ----------
if (!cat || !Array.isArray(cat.groups)) {
  problems.push('表源根结构异常：groups 不是数组');
} else {
  if (cat.groups.length > 255) problems.push(`组数 ${cat.groups.length} 超过上限 255`);

  const groupIds = new Set();
  const itemIds = new Set();
  const itemNames = new Set();
  const aliasOwners = new Map(); // 别名 → 拥有者 id（全表跨分类不得重复）

  for (const g of cat.groups) {
    if (!g || typeof g.id !== 'string' || !g.id) problems.push('存在无 id 的组');
    else if (groupIds.has(g.id)) problems.push(`组 id 重复：${g.id}`);
    else groupIds.add(g.id);

    if (typeof g.icon !== 'string' || !pool.names.includes(g.icon)) {
      problems.push(`组「${g.id}」图标「${g && g.icon}」不在图标池内`);
    }

    if (!Array.isArray(g.items)) {
      problems.push(`组「${g.id}」items 不是数组`);
      continue;
    }
    if (g.items.length > 255) problems.push(`组「${g.id}」条目数 ${g.items.length} 超过上限 255`);

    for (const it of g.items) {
      if (!it || typeof it.id !== 'string' || !it.id) {
        problems.push(`组「${g.id}」存在无 id 的分类`);
        continue;
      }
      if (itemIds.has(it.id)) problems.push(`分类 id 全表重复：${it.id}`);
      else itemIds.add(it.id);

      if (typeof it.name !== 'string' || !isHan(it.name) || it.name.length < 2 || it.name.length > 8) {
        problems.push(`分类「${it.id}」名称「${it && it.name}」须为 2–8 个汉字`);
      } else if (itemNames.has(it.name)) problems.push(`分类名全表重复：「${it.name}」(${it.id})`);
      else itemNames.add(it.name);

      if (typeof it.icon !== 'string' || !pool.names.includes(it.icon)) {
        problems.push(`分类「${it.id}」图标「${it && it.icon}」不在图标池内`);
      }

      if (!Array.isArray(it.aliases)) {
        problems.push(`分类「${it.id}」aliases 不是数组`);
      } else {
        for (const a of it.aliases) {
          if (a === it.name) problems.push(`分类「${it.id}」别名等于自身名：「${a}」`);
          if (aliasOwners.has(a)) problems.push(`别名「${a}」跨分类重复：${aliasOwners.get(a)} 与 ${it.id}`);
          else aliasOwners.set(a, it.id);
        }
      }
    }
  }
}

if (problems.length) {
  console.error('分类表校验未通过：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

// ---------- 出版 ----------
const version = String(cat.version || '0.0.0');
const count = cat.groups.reduce((a, g) => a + g.items.length, 0);
const groups = cat.groups.length;

const dataText = JSON.stringify(cat, null, 2) + '\n';
const sha = textSha256(dataText);

const dataPath = path.join(OUT_DIR, DATA_FILE);

/** 清单里本资源的条目（单一事实源；没有 = 尚未登记） */
function manifestEntry() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    return (m?.docs ?? []).find((d) => d && d.id === MANIFEST_ID) ?? null;
  } catch {
    return null;
  }
}

if (CHECK_ONLY) {
  const prevData = fs.existsSync(dataPath) ? fs.readFileSync(dataPath, 'utf8') : null;
  if (prevData !== dataText) {
    console.error(`downloads/${DATA_FILE} 与源不同步——跑 pnpm catalog 重出版`);
    process.exit(1);
  }
  const entry = manifestEntry();
  if (!entry) {
    console.error(`downloads/manifest.json 未登记「${MANIFEST_ID}」条目——跑 pnpm manifest`);
    process.exit(1);
  }
  if (String(entry.sha256 || '').toLowerCase() !== sha) {
    console.error(`清单里「${MANIFEST_ID}」的 sha256 与产物不符——跑 pnpm manifest 重算`);
    process.exit(1);
  }
  console.log(`分类表产物与源同步 ✓（${groups} 组 / ${count} 条，sha256 ${sha.slice(0, 12)}）`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(dataPath, dataText, 'utf8');

const entry = manifestEntry();
const synced = entry && String(entry.sha256 || '').toLowerCase() === sha;
console.log(
  `出版 ${groups} 组 / ${count} 条分类表 → downloads/${DATA_FILE}（sha256 ${sha.slice(0, 12)}）` +
    (synced ? '；清单已同步' : '；**清单待重出：跑 pnpm manifest**'),
);
