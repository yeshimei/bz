// scripts/build-skin-pack.mjs — 皮肤包出版（issue 475 / ADR-0199）
//
// 把 `src/<域>/skins/<id>.css`（远端皮肤源，**不进构建聚合**）出版为远端可分发的形态：
//   manual/skins/<域>/<id>.css   —— 与源逐字相同（仅换行归一为 LF）
//   manual/skins/index.json      —— 清单：id / domain / name / file / previewClass / 版本区间 / sha256
// 插件启动时按清单从 raw.githubusercontent（备 jsDelivr）逐套拉取，校验 sha256 后注入。
//
// 为什么产物提交入 git：远端读的就是仓库里的 `manual/`（与 manual/bz-changelog.html 同一条路）。
// 为什么 sha256 在这里算：它是**构建期**产物，插件端只做比对——两侧都对「归一换行后的文本」
// 取 SHA-256（src/core/sha256.ts），免得 Windows CRLF 与仓库 LF 算出两个值。
//
// 用法：
//   node scripts/build-skin-pack.mjs          # 出版（写 manual/skins/）
//   node scripts/build-skin-pack.mjs --check  # 只校验产物是否与源同步（守卫测试复用）
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skins.catalog.json'), 'utf8'));

/** 换行归一（与 src/core/sha256.ts 的 normalizeEol 同口径） */
const normalizeEol = (s) => String(s).replace(/\r\n?/g, '\n');

/** 文本 sha256（小写 64 位）——与插件端 sha256Hex(normalizeEol(text)) 逐位一致 */
const textSha256 = (s) => createHash('sha256').update(Buffer.from(normalizeEol(s), 'utf8')).digest('hex');

const OUT_DIR = path.join(ROOT, 'manual/skins');
const INDEX = path.join(OUT_DIR, 'index.json');

const entries = [];
const writes = [];
const problems = [];

for (const [domain, cfg] of Object.entries(CATALOG.domains)) {
  const skinDir = path.join(ROOT, `src/${domain}/skins`);
  const present = fs.existsSync(skinDir)
    ? fs.readdirSync(skinDir).filter((f) => f.endsWith('.css')).map((f) => f.replace(/\.css$/, ''))
    : [];
  const declared = cfg.skins.map((s) => s.id);

  // 目录双向一致：源文件与目录声明谁多谁少都报错（少 = 清单悬指；多 = 出了皮但没登记）
  const missing = declared.filter((id) => !present.includes(id));
  const extra = present.filter((id) => !declared.includes(id));
  if (missing.length) problems.push(`${domain}：清单声明了但源文件缺失 → ${missing.join('、')}`);
  if (extra.length) problems.push(`${domain}：src/${domain}/skins/ 里有未登记进清单的皮肤 → ${extra.join('、')}`);

  for (const skin of cfg.skins) {
    const rel = `src/${domain}/skins/${skin.id}.css`;
    if (!fs.existsSync(path.join(ROOT, rel))) continue;
    const text = normalizeEol(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const outRel = `skins/${domain}/${skin.id}.css`;
    // 预览卡类必须真的在这份 CSS 里定义（清单里写错类名 → 选择卡空格，属静默失效）
    if (skin.previewClass && !text.includes(`.${skin.previewClass}`)) {
      problems.push(`${domain}/${skin.id}：清单里的 previewClass「${skin.previewClass}」在皮肤 CSS 里找不到定义`);
    }
    entries.push({
      id: skin.id,
      domain,
      name: skin.name,
      file: outRel,
      ...(skin.previewClass ? { previewClass: skin.previewClass } : {}),
      ...(skin.since ? { since: skin.since } : {}),
      ...(skin.until ? { until: skin.until } : {}),
      sha256: textSha256(text),
    });
    writes.push({ rel: path.join(OUT_DIR, domain, `${skin.id}.css`), text, outRel });
  }
}

if (problems.length) {
  console.error('皮肤包清单与源不一致：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

const index = { version: CATALOG.version ?? 1, skins: entries };
const indexText = JSON.stringify(index, null, 2) + '\n';

let changed = 0;
for (const w of writes) {
  const prev = fs.existsSync(w.rel) ? fs.readFileSync(w.rel, 'utf8') : null;
  if (prev === w.text) continue;
  changed++;
  if (!CHECK_ONLY) {
    fs.mkdirSync(path.dirname(w.rel), { recursive: true });
    fs.writeFileSync(w.rel, w.text, 'utf8');
  }
}
const prevIndex = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : null;
if (prevIndex !== indexText) {
  changed++;
  if (!CHECK_ONLY) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(INDEX, indexText, 'utf8');
  }
}

// 下架清理：manual/skins/ 里已不在清单中的文件要删（否则远端仍能拿到已下架的皮）
const stale = [];
if (fs.existsSync(OUT_DIR)) {
  for (const domain of fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = path.join(OUT_DIR, domain.name);
    for (const f of fs.readdirSync(dir)) {
      if (!entries.some((e) => e.file === `skins/${domain.name}/${f}`)) stale.push(path.join(dir, f));
    }
  }
}
if (stale.length) {
  changed += stale.length;
  if (!CHECK_ONLY) for (const p of stale) fs.rmSync(p);
}

if (CHECK_ONLY && changed) {
  console.error(`manual/skins/ 与源不同步（${changed} 个文件）——跑 pnpm skin-pack 重出版`);
  process.exit(1);
}
console.log(
  CHECK_ONLY
    ? `皮肤包产物与源同步 ✓（${entries.length} 套）`
    : `出版 ${entries.length} 套皮肤 → manual/skins/（改动 ${changed} 个文件）`,
);
