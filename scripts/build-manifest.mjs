// scripts/build-manifest.mjs — 统一下载清单产出（issue 480 / ADR-0202）
//
// 汇总全部在线资源条目，写 `downloads/manifest.json`——插件端启动双源拉取的
// 唯一事实源（src/core/download-manifest.ts 消费）：
//   docs[]  —— 单文件资源（bz-changelog.html / bz-manual.html），id / name / file / sha256
//   skins[] —— 皮肤条目，id / domain / name / file / previewClass / 版本区间 / sha256
//
// sha256 一律对 **downloads/ 里的已出版产物**算（ skins 对 css、docs 对 html），
// 不从 src 源重算——清单永与产物一致，不会出现「清单说 A、产物是 B」。
// 因此发布顺序固定：pnpm skin-pack → pnpm changelog → pnpm manifest。
//
// 换行口径与插件端一致（src/core/sha256.ts：normalizeEol 后取 SHA-256），
// Windows CRLF 与仓库 LF 不会算出两个值。
//
// 用法：
//   node scripts/build-manifest.mjs          # 产出（写 downloads/manifest.json）
//   node scripts/build-manifest.mjs --check  # 只校验清单与产物同步（守卫测试复用）
import fs from 'node:fs';
import path from 'node:path';
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
    console.error(`downloads/${rel} 不存在——先跑 pnpm skin-pack / pnpm changelog 出产物，再跑 pnpm manifest`);
    process.exit(1);
  }
  return textSha256(fs.readFileSync(abs, 'utf8'));
}

const problems = [];

// docs：单文件资源（新资源在此登记一行，插件端 download-manifest 的默认行表同步认 id）
const DOCS = [
  { id: 'changelog', name: '更新日志', file: 'bz-changelog.html' },
  { id: 'manual', name: '使用手册', file: 'bz-manual.html' },
];
const docs = DOCS.map((d) => ({ ...d, sha256: fileSha256(d.file) }));

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
      sha256: fileSha256(rel),
    });
  }
}

if (problems.length) {
  console.error('清单与产物不一致：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const manifestText = JSON.stringify({ version: CATALOG.version ?? 1, docs, skins }, null, 2) + '\n';

const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null;
if (prev === manifestText) {
  console.log(`清单与产物同步 ✓（docs ${docs.length} + skins ${skins.length} 条）`);
  process.exit(0);
}
if (CHECK_ONLY) {
  console.error('downloads/manifest.json 与产物不同步——跑 pnpm manifest 重出');
  process.exit(1);
}
fs.writeFileSync(OUT, manifestText, 'utf8');
console.log(`产出 downloads/manifest.json（docs ${docs.length} + skins ${skins.length} 条）`);
