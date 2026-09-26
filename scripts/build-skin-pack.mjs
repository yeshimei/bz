// scripts/build-skin-pack.mjs — 皮肤包出版（issue 475 / ADR-0199；清单合并见 issue 480 / ADR-0203）
//
// 把 `src/<域>/skins/<id>.css`（远端皮肤源，**不进构建聚合**）出版为远端可分发的形态：
//   downloads/skins/<域>/<id>.css —— 与源逐字相同（仅换行归一为 LF）
// 清单（含 sha256）不再由本脚本产出——统一收敛到 `downloads/manifest.json`
//（scripts/build-manifest.mjs，`pnpm manifest`），skins 条目在那里对**已出版的 css**算 hash，
// 保证清单永与产物一致。发布顺序固定：skin-pack → changelog → manifest。
// 插件启动时按统一清单从 raw.githubusercontent（备 jsDelivr）逐套拉取，校验 sha256 后注入。
//
// 为什么产物提交入 git：远端读的就是仓库里的 `downloads/`（与 downloads/bz-changelog.html 同一条路）。
// 为什么 sha256 对「归一换行后的文本」算：插件端 src/core/sha256.ts 同口径，
// 免得 Windows CRLF 与仓库 LF 算出两个值。
//
// 用法：
//   node scripts/build-skin-pack.mjs          # 出版（写 downloads/skins/）
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

const OUT_DIR = path.join(ROOT, 'downloads/skins');

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
    // 预览卡类必须真的在这份 CSS 里定义（清单里写错类名 → 选择卡空格，属静默失效）
    if (skin.previewClass && !text.includes(`.${skin.previewClass}`)) {
      problems.push(`${domain}/${skin.id}：清单里的 previewClass「${skin.previewClass}」在皮肤 CSS 里找不到定义`);
    }
    writes.push({ rel: path.join(OUT_DIR, domain, `${skin.id}.css`), text, outRel: `skins/${domain}/${skin.id}.css` });
  }
}

if (problems.length) {
  console.error('皮肤包清单与源不一致：');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

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

// 下架清理：downloads/skins/ 里已不在清单中的文件要删（否则远端仍能拿到已下架的皮）

// 下架清理：manual/skins/ 里已不在清单中的文件要删（否则远端仍能拿到已下架的皮）
const stale = [];
if (fs.existsSync(OUT_DIR)) {
  for (const domain of fs.readdirSync(OUT_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = path.join(OUT_DIR, domain.name);
    for (const f of fs.readdirSync(dir)) {
      if (!writes.some((w) => w.outRel === `skins/${domain.name}/${f}`)) stale.push(path.join(dir, f));
    }
  }
}
if (stale.length) {
  changed += stale.length;
  if (!CHECK_ONLY) for (const p of stale) fs.rmSync(p);
}

if (CHECK_ONLY && changed) {
  console.error(`downloads/skins/ 与源不同步（${changed} 个文件）——跑 pnpm skin-pack 重出版`);
  process.exit(1);
}
console.log(
  CHECK_ONLY
    ? `皮肤包产物与源同步 ✓（${writes.length} 套）`
    : `出版 ${writes.length} 套皮肤 → downloads/skins/（改动 ${changed} 个文件）`,
);
