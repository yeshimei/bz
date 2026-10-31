// scripts/build-manifest.mjs — 统一下载清单产出（issue 480 / ADR-0203）
//
// 汇总全部在线资源条目，写 `downloads/manifest.json`——插件端启动双源拉取的
// 唯一事实源（src/core/download-manifest.ts 消费）：
//   docs[]  —— 单文件资源（bz-changelog.html / bz-manual.html），id / name / file / sha256
//   skins[] —— 皮肤条目，id / domain / name / file / previewClass / 版本区间 / sha256
//
// sha256 一律对 **downloads/ 里的已出版产物**算（ skins 对 css、docs 对 html），
// 不从 src 源重算——清单永与产物一致，不会出现「清单说 A、产物是 B」。
// 因此发布顺序固定：pnpm skin-pack → pnpm changelog → pnpm catalog → pnpm manifest。
//
// 换行口径与插件端一致（src/core/sha256.ts：normalizeEol 后取 SHA-256），
// Windows CRLF 与仓库 LF 不会算出两个值。
//
// 用法：
//   node scripts/build-manifest.mjs          # 产出（写 downloads/manifest.json）
//   node scripts/build-manifest.mjs --check  # 只校验清单与产物同步（守卫测试复用）
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skins.catalog.json'), 'utf8'));
const OUT = path.join(ROOT, 'downloads/manifest.json');

/** 换行归一（与 src/core/sha256.ts 的 normalizeEol 同口径） */
const normalizeEol = (s) => String(s).replace(/\r\n?/g, '\n');
/** 文本 sha256（小写 64 位）——与插件端 textSha256 逐位一致 */
const textSha256 = (s) => createHash('sha256').update(Buffer.from(normalizeEol(s), 'utf8')).digest('hex');

/** 对 downloads/ 里的产物文件算 hash；产物缺席是硬错误（发布顺序被打破） */
function fileSha256(rel) {
  const abs = path.join(ROOT, 'downloads', rel);
  if (!fs.existsSync(abs)) {
    console.error(`downloads/${rel} 不存在——先跑 pnpm skin-pack / pnpm changelog / pnpm catalog 出产物，再跑 pnpm manifest`);
    process.exit(1);
  }
  return textSha256(fs.readFileSync(abs, 'utf8'));
}

/** 对 downloads/ 里的**二进制**产物算字节 sha256（目录包 tar.gz 用这个）。
 *  不能走上面那个：`readFileSync(abs,'utf8')` + 换行归一用在压缩流上会当场改坏内容，
 *  算出来的 hash 与插件端 `sha256Bytes` 永远对不上——症状是「每次下载都校验失败」。 */
function fileSha256Bytes(rel) {
  const abs = path.join(ROOT, 'downloads', rel);
  if (!fs.existsSync(abs)) {
    console.error(`downloads/${rel} 不存在——先跑 pnpm tools-pack 出目录包，再跑 pnpm manifest`);
    process.exit(1);
  }
  return createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
}

/** 对 downloads/ 里的产物文件算字节数；产物缺席沿用 fileSha256 的既有报错口径 */
function fileSize(rel) {
  const abs = path.join(ROOT, 'downloads', rel);
  if (!fs.existsSync(abs)) {
    console.error(`downloads/${rel} 不存在——先跑 pnpm skin-pack / pnpm changelog / pnpm catalog 出产物，再跑 pnpm manifest`);
    process.exit(1);
  }
  return fs.statSync(abs).size;
}

const problems = [];

// docs：单文件资源（新资源在此登记一行，插件端 download-manifest 的默认行表同步认 id）
const DOCS = [
  { id: 'changelog', name: '更新日志', file: 'bz-changelog.html' },
  { id: 'manual', name: '使用手册', file: 'bz-manual.html' },
  // issue 478：归物本物品分类表（数据表，不是文档；产物由 pnpm catalog 出，故发布顺序里 catalog 在 manifest 之前）
  { id: 'belongings-categories', name: '归物分类表', file: 'belongings-categories.json' },
  // issue 495：RSS 源库（社区源清单出版物，黄页模型见 ADR-0208；产物由 pnpm rss-catalog 出，
  // 故发布顺序里 rss-catalog 也在 manifest 之前）
  { id: 'rss-catalog', name: 'RSS 源库', file: 'rss-catalog.json' },
  // issue 498：豆瓣影视名称索引（影院输入联想，ADR-0209；产物由 pnpm cinema-index 出，
  // 上游数据集不入 git，见该脚本头注）
  { id: 'cinema-douban-index', name: '豆瓣影视索引', file: 'cinema-douban-index.json' },
  // ===== 外部工具（2026-10-28 对外分发；kind='bundle' = tar.gz 目录包，产物由 pnpm tools-pack 出，
  // 故发布顺序里 tools-pack 也在 manifest 之前）。这三个是插件**运行时真的会 spawn 的东西**：
  // 知识盒批量下载（bili-dl）、工具坞离线值守、脸谱（bz-face）。
  // 行名 2026-10-29 改名（知识盒工具包 / 工具坞工具包）：与 src/core/tool-runtime 的
  // TOOL_ENTRIES label 同源，改名两处一起改——行名给谁看，id 才是主键。
  // 已移植进插件的 news-watcher / douban-poster **不在这里**——它们运行时零依赖，上架只会让人白下。
  { id: 'tool-bili-downloader', name: '知识盒工具包', file: 'tools/bili-downloader.tar.gz', kind: 'bundle' },
  { id: 'tool-dock-watch', name: '工具坞工具包', file: 'tools/dock-watch.tar.gz', kind: 'bundle' },
  { id: 'tool-obsidian-face', name: '脸谱工具包', file: 'tools/obsidian-face.tar.gz', kind: 'bundle' },
];
const docs = DOCS.map((d) => ({
  ...d,
  // 文本存量走归一换行 hash，目录包走字节 hash——两条口径各自对齐插件端的 textSha256 / sha256Bytes
  sha256: d.kind === 'bundle' ? fileSha256Bytes(d.file) : fileSha256(d.file),
  size: fileSize(d.file),
}));

// 行序（在线资源组内的行顺序）：'skins' 是皮肤聚合行的保留 id，不是 doc 条目。
// 新增资源 = DOCS 加一行 + 本表加一个 id；漏登记由下方守卫拦下。
const ROW_ORDER = [
  'changelog',
  'manual',
  'skins',
  'belongings-categories',
  'rss-catalog',
  'cinema-douban-index',
  // 外部工具排在最后：它们是「可选增强」（知识盒批量下载 / 离线值守 / 脸谱），
  // 而上面四条是大多数人都要吃到的数据与文档。
  'tool-bili-downloader',
  'tool-dock-watch',
  'tool-obsidian-face',
];

// ── 反向守卫（issue 490）：downloads/ 顶层不允许存在清单外的文件 ──
// 新产物进目录但忘了登记 DOCS → 构建期就炸，而不是发布后插件端校验才失败
// （那些失败发生在用户机器上，构建期不查就没人查）。清单文件自身、发布指针与皮肤子目录豁免。
const MANIFEST_GUARD_IGNORE = new Set(['manifest.json', 'version.json', 'skins.zip', ...DOCS.map((d) => d.file)]);
for (const name of fs.readdirSync(path.join(ROOT, 'downloads'), { withFileTypes: true })) {
  if (!name.isFile() || MANIFEST_GUARD_IGNORE.has(name.name)) continue;
  problems.push(
    `downloads/${name.name} 未登记进清单——要么在上方 DOCS 登记一行（连同插件端行名），要么删掉该文件`,
  );
}

// skins：条目元数据来自 catalog，file/sha256 对已出版 css 算
const skins = [];
for (const [domain, cfg] of Object.entries(CATALOG.domains)) {
  for (const skin of cfg.skins) {
    const rel = `skins/${domain}/${skin.id}.css`;
    if (!fs.existsSync(path.join(ROOT, 'downloads', rel))) {
      problems.push(`${domain}/${skin.id}：downloads/${rel} 缺席——先跑 pnpm skin-pack`);
      continue;
    }
    skins.push({
      id: skin.id,
      domain,
      name: skin.name,
      file: rel,
      ...(skin.previewClass ? { previewClass: skin.previewClass } : {}),
      ...(skin.since ? { since: skin.since } : {}),
      ...(skin.until ? { until: skin.until } : {}),
      size: fileSize(rel),
      sha256: fileSha256(rel),
    });
  }
}

if (problems.length) {
  console.error('清单与产物不一致：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

// ── 行序守卫（issue 490 同系）：ROW_ORDER 必须与 DOCS 对齐 ──
// 1) 覆盖 DOCS 全部 id（漏登记 → 该资源在在线资源组里掉行）；
// 2) 必须含保留 id 'skins'（皮肤聚合行）；
// 3) 除 'skins' 外不得出现 DOCS 里没有的 id（手滑多写 → 消费侧出现幽灵行）。
const docIds = DOCS.map((d) => d.id);
const missingInRow = docIds.filter((id) => !ROW_ORDER.includes(id));
if (missingInRow.length) {
  problems.push(`ROW_ORDER 漏登记：${missingInRow.join(', ')} 在 DOCS 里但不在行序表——要么在 ROW_ORDER 加一行，要么从 DOCS 删掉该资源`);
}
if (!ROW_ORDER.includes('skins')) {
  problems.push(`ROW_ORDER 必须含保留 id 'skins'（皮肤聚合行的位置）；请把 'skins' 加进 ROW_ORDER`);
}
const ghostInRow = ROW_ORDER.filter((id) => id !== 'skins' && !docIds.includes(id));
if (ghostInRow.length) {
  problems.push(`ROW_ORDER 含 DOCS 没有的 id（'skins' 除外）：${ghostInRow.join(', ')}——请从 ROW_ORDER 删掉，或在 DOCS 登记对应资源`);
}

if (problems.length) {
  console.error('清单与产物不一致：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

// ── 皮肤整包 skins.zip（2026-10-31）：全部 skins 的 css 打成一个归档 ──
// 客户端下载一次替代最多 26 次逐文件请求（core/skin-pack.ts 的整包快路）。
// 归档格式：deflate-raw（zlib.deflateRawSync ↔ 插件端 DecompressionStream/zlib.inflateRawSync
// 同一算法），crc32 写进目录供解包校验；时间字段固定为 0——同内容出同字节，
// 重复跑发布流程不会让 sha256 无意义地变化。
// 逐文件 css 照旧保留在 downloads/skins/：旧客户端（不认识 skinsPack 字段）走它，
// 离线包镜像也是逐字结构，互为兜底——schema 只增不改。
const SKINS_ZIP_REL = 'skins.zip';
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(ms) {
  // 固定 2000-01-01 00:00:00（DOS 时间），与内容无关 → 字节确定
  const d = ms === undefined ? new Date(2000, 0, 1) : new Date(ms);
  const time = ((d.getHours() || 0) << 11) | ((d.getMinutes() || 0) << 5) | ((d.getSeconds() || 0) >> 1);
  const date = (((d.getFullYear() || 2000) - 1980) << 9) | (((d.getMonth() || 0) + 1) << 5) | (d.getDate() || 1);
  return { time, date };
}
function buildSkinsZip() {
  const files = [];
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = `${prefix}${e.name}`;
      if (e.isDirectory()) walk(abs, `${rel}/`);
      else files.push({ rel, buf: fs.readFileSync(abs) });
    }
  };
  walk(path.join(ROOT, 'downloads/skins'), 'skins/');
  files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  if (!files.length) {
    console.error('downloads/skins/ 是空的——先跑 pnpm skin-pack');
    process.exit(1);
  }

  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
  const u32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0); return b; };
  for (const { rel, buf } of files) {
    const comp = zlib.deflateRawSync(buf, { level: 9 });
    const useComp = comp.length < buf.length; // 压不动的小文件就地 store（method 0）
    const data = useComp ? comp : buf;
    const method = useComp ? 8 : 0;
    const { time, date } = dosDateTime();
    const name = Buffer.from(rel, 'utf8');
    const crc = crc32(buf);

    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method), u16(time), u16(date),
      u32(crc), u32(data.length), u32(buf.length), u16(name.length), u16(0), name,
    ]);
    chunks.push(local, data);
    central.push(
      Buffer.concat([
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(method), u16(time), u16(date),
        u32(crc), u32(data.length), u32(buf.length), u16(name.length),
        u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
      ]),
    );
    offset += local.length + data.length;
  }
  const cdStart = offset;
  const cd = Buffer.concat(central);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cd.length), u32(cdStart), u16(0),
  ]);
  return Buffer.concat([...chunks, cd, eocd]);
}

let skinsPack;
if (!CHECK_ONLY) {
  const zip = buildSkinsZip();
  fs.writeFileSync(path.join(ROOT, 'downloads', SKINS_ZIP_REL), zip);
  console.log(`产出 downloads/${SKINS_ZIP_REL}（${skins.length} 套皮肤，${(zip.length / 1024).toFixed(0)} KB）`);
  skinsPack = {
    file: SKINS_ZIP_REL,
    sha256: createHash('sha256').update(zip).digest('hex'),
    size: zip.length,
  };
} else if (fs.existsSync(path.join(ROOT, 'downloads', SKINS_ZIP_REL))) {
  // --check 模式：zip 已在就顺带核一次（不是本脚本产出的场景不硬卡）
  const zip = fs.readFileSync(path.join(ROOT, 'downloads', SKINS_ZIP_REL));
  skinsPack = {
    file: SKINS_ZIP_REL,
    sha256: createHash('sha256').update(zip).digest('hex'),
    size: zip.length,
  };
}

// ── 插件版本（发布指针的两处产出共用）──
// 指针里的 tag 按 `<repo 版本号>` 推：tag 名就是 `v<manifest.json 的 version>`，
// 发布流程必须（1）先 bump manifest.json（2）构建（3）打同名 tag（4）push。
const PLUGIN_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;

const manifestText =
  JSON.stringify(
    {
      version: CATALOG.version ?? 1,
      docs,
      skins,
      ...(skinsPack ? { skinsPack } : {}),
      rowOrder: ROW_ORDER,
      // 发布指针（2026-10-31 合并进清单）：新客户端检查更新直接读清单顶层 `release`，
      // 一次请求同时拿到「有没有新版」和「在线资源清单」。字段名不能叫 version——
      // 那个名字已被清单 schema 版本占用（只增不改）。version.json 照常产出：
      // v1.36 及更早的客户端只认它（代码里硬编码 raw 地址，与 Release 通道无关），
      // 停产等于把老用户焊死在旧版；等老客户端沉淀完再退役。
      release: { version: PLUGIN_VERSION, tag: `v${PLUGIN_VERSION}` },
    },
    null,
    2,
  ) + '\n';

// ── 发布指针 downloads/version.json（2026-10-28 对外分发；2026-10-31 起新客户端改读清单
//    顶层 `release`，此文件仅为 v1.36 及更早客户端保留——它们硬编码 raw 地址，不碰 Release）──
const POINTER_OUT = path.join(ROOT, 'downloads/version.json');
const pointerText = JSON.stringify({ version: PLUGIN_VERSION, tag: `v${PLUGIN_VERSION}` }, null, 2) + '\n';
const prevPointer = fs.existsSync(POINTER_OUT) ? fs.readFileSync(POINTER_OUT, 'utf8') : null;
if (prevPointer !== pointerText) {
  if (CHECK_ONLY) {
    problems.push(`downloads/version.json 与 manifest.json 版本不同步（指针应为 v${PLUGIN_VERSION}）——跑 pnpm manifest 重出`);
  } else {
    fs.writeFileSync(POINTER_OUT, pointerText, 'utf8');
    console.log(`产出 downloads/version.json（v${PLUGIN_VERSION}）`);
  }
}

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (prev === manifestText) {
  if (problems.length) {
    // 清单本身同步，但指针/登记有问题（--check 下才会走到这里）——不能报「同步 ✓」蒙混过去
    console.error('清单本身已同步，但还有别的问题：');
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
  }
  // 内容没变就不必重写（省一次磁盘、git 也不会脏），但**必须动一下 mtime**：
  // release-steps 用「产物比起点新」判定这一步是否真跑过，不 touch 会被误判成
  // 「manifest 步漏跑」——那正是它要拦的静默事故，只是这次是它自己误报。
  fs.utimesSync(OUT, new Date(), new Date());
  console.log(`清单与产物同步 ✓（docs ${docs.length} + skins ${skins.length} 条）`);
  process.exit(0);
}
if (CHECK_ONLY) {
  console.error('downloads/manifest.json 与产物不同步——跑 pnpm manifest 重出');
  process.exit(1);
}
fs.writeFileSync(OUT, manifestText, 'utf8');
console.log(`产出 downloads/manifest.json（docs ${docs.length} + skins ${skins.length} 条）`);
