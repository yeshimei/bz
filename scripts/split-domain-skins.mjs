// scripts/split-domain-skins.mjs — 皮肤包迁移工具（issue 475 / ADR-0199）
//
// 把 `src/<域>/styles.css` 里**非首套**皮肤（主题轴）的规则切到 `src/<域>/skins/<id>.css`，
// 首套恒留源内作离线兜底。切出的文件**不进构建聚合**（`build-css.mjs` 的 SOURCES 不登记
// `src/<域>/skins/`），由 `scripts/build-skin-pack.mjs` 出版到 `manual/skins/`。
//
// 归属判据 = **选择器里的皮肤类 token**（各域 token 表见 CATALOG 旁的 TOKENS），
// 不依赖文件分节，故对「五肤 token 块 / 结构层逐肤补全 / 亮暗变体 / 预览卡」这类
// 散落组织一律通吃。两条域内特例单独处理：
//   1. pomodoro 的 `:root` 变量表（`--pz-<id>-*` 按行分组，一个块里装了 10 套色值）；
//   2. smartcat 的 `@keyframes`（皮肤规则自带动画，149 个关键帧里 19 个归皮肤，按引用名归属）。
//
// 守恒校验：切分前后「叶子块文本集合」必须相等 —— 丢块、串块、重复块都会当场报错。
// 幂等：切完再跑一遍无事可做（`--check` 模式下断言这一点，供守卫测试复用）。
//
// 用法：
//   node scripts/split-domain-skins.mjs          # 执行切分（幂等）
//   node scripts/split-domain-skins.mjs --check  # 只检查：源里是否还残留远端皮肤规则
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skins.catalog.json'), 'utf8'));
const CHECK_ONLY = process.argv.includes('--check');

/** 各域皮肤类 token 生成器（作用于选择器文本；同一套皮可有多个类：面板类 + 预览卡类） */
const TOKENS = {
  bookshelf: (id) => [`bz-bs-skin-${id}`, `bz-skinprev-bs-${id}`],
  pomodoro: (id) => [`pomodoro-skin-${id}`, `bz-sp-prev-pomo-${id}`, `--pz-${id}-`],
  memo: (id) => [`bz-memo-skin-${id}`, `bz-skinprev-${id}`],
  // smartcat 的面板类沿用原版 `.skin-<id>`（applyAppearance 兼容遗留那条），非 bz-sc-skin-*
  smartcat: (id) => [`.skin-${id}`, `bz-sc-prev-${id}`],
};

/** 副源：该域的皮肤规则并不全在自己的 styles.css 里。
 *  pomodoro 的**预览卡**（.bz-sp-prev-pomo-<id>，引用 --pz-<id>-* 变量）写在设置面板样式里，
 *  它必须跟皮肤一起走——否则预览卡在产物里而色值表在远端，卡就成了空格
 *  （ADR-0199 后果节「预览卡规则可能跨文件」）。 */
const EXTRA_SOURCES = {
  pomodoro: ['src/settings-panel/styles.css'],
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 选择器文本 → 命中的皮肤 id 集 */
function skinsInText(text, ids, domain) {
  const hit = new Set();
  for (const id of ids) {
    for (const token of TOKENS[domain](id)) {
      // 词边界：`skin-black` 不许命中 `skin-blackish`；但 `.skin-x` 这类前缀 token 自带边界
      const re = new RegExp(esc(token) + '(?![A-Za-z0-9_-])');
      if (re.test(text)) {
        hit.add(id);
        break;
      }
    }
  }
  return hit;
}

/** 顶层 CSS 切分：raw 原样保留（拼接可逐字还原），kind 区分注释/规则/at-rule/语句 */
export function parseCss(css) {
  const items = [];
  const n = css.length;
  let i = 0;
  let lead = '';
  while (i < n) {
    const ch = css[i];
    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
      lead += ch;
      i++;
      continue;
    }
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      items.push({ kind: 'comment', raw: lead + css.slice(i, stop) });
      lead = '';
      i = stop;
      continue;
    }
    const brace = css.indexOf('{', i);
    const semi = css.indexOf(';', i);
    if (semi !== -1 && (brace === -1 || semi < brace)) {
      const stop = semi + 1;
      items.push({ kind: 'stmt', raw: lead + css.slice(i, stop), sel: css.slice(i, semi).trim() });
      lead = '';
      i = stop;
      continue;
    }
    if (brace === -1) {
      items.push({ kind: 'stmt', raw: lead + css.slice(i) });
      lead = '';
      break;
    }
    let depth = 0;
    let j = brace;
    for (; j < n; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    const sel = css.slice(i, brace);
    items.push({
      kind: sel.trim().startsWith('@') ? 'at' : 'rule',
      raw: lead + css.slice(i, j),
      sel,
      body: css.slice(brace + 1, j - 1),
      lead,
    });
    lead = '';
    i = j;
  }
  if (lead) items.push({ kind: 'stmt', raw: lead });
  return items;
}

/** 改过 sel/body 的块必须重建 raw，否则输出里仍是原样（改 body 不重建 = 白改） */
function rebuildRaw(item) {
  if (item && typeof item.sel === 'string' && typeof item.body === 'string') {
    item.raw = (item.lead ?? '') + item.sel + '{' + item.body + '}';
  }
}

/** 块（含 at-rule 递归）的皮肤归属。
 *  `:root` 例外：它的选择器不带皮肤 token，归属只能看**声明体**（pomodoro 的 --pz-<id>-*）。 */
function attributed(item, ids, domain) {
  if (item.kind === 'rule') {
    const hit = skinsInText(item.sel, ids, domain);
    if (item.sel.trim() === ':root') {
      for (const s of skinsInText(item.body ?? '', ids, domain)) hit.add(s);
    }
    return hit;
  }
  if (item.kind !== 'at') return new Set();
  const out = new Set();
  for (const child of parseCss(item.body)) {
    for (const s of attributed(child, ids, domain)) out.add(s);
  }
  return out;
}

/** 叶子块文本集合（at-rule 拆到子块；`:root` 拆到单条声明——pomodoro 变量表按行重排后仍可比）；
 *  用于守恒校验 */
function leaves(item, out = []) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  if (item.kind === 'at') {
    for (const child of parseCss(item.body).filter((c) => c.kind !== 'stmt' || c.raw.trim())) leaves(child, out);
    return out;
  }
  if (item.kind === 'comment' || item.kind === 'stmt') {
    const t = norm(item.raw);
    if (t) out.push(t);
    return out;
  }
  if (item.sel.trim() === ':root') {
    for (const decl of item.body.replace(/\/\*[\s\S]*?\*\//g, '').split(';')) {
      const t = norm(decl);
      if (t) out.push(`:root ${t}`);
    }
    return out;
  }
  out.push(norm(item.raw));
  return out;
}

/** 切分一份 CSS：返回 { kept: string, moved: Map<skin, string[]> } */
function splitDomain(css, domain) {
  const cfg = CATALOG.domains[domain];
  const ids = cfg.skins.map((s) => s.id);
  const keep = cfg.keep.id;
  const allIds = [keep, ...ids]; // 含首套——`revertRoot` 的分组要连首套一起认
  let items = parseCss(css);

  const moved = new Map(ids.map((id) => [id, []]));
  const push = (id, raw) => moved.get(id).push(raw);

  // ── 域内特例 1：pomodoro `:root` 变量表（一块装 10 套色值，按行归属）
  if (domain === 'pomodoro') {
    for (const item of items) {
      if (item.kind !== 'rule' || item.sel.trim() !== ':root') continue;
      if (!item.body.includes('--pz-tomato-')) continue;
      const groups = new Map();
      let cur = null;
      let pending = []; // 注释/空行挂到**后一个**归属行（原文注释写在每套色值之前）
      for (const line of item.body.split('\n')) {
        const m = line.match(/--pz-([A-Za-z0-9_-]+?)-[a-z]/);
        if (m && allIds.includes(m[1])) {
          cur = m[1];
          const arr = groups.get(cur) ?? [];
          arr.push(...pending, line);
          pending = [];
          groups.set(cur, arr);
          continue;
        }
        if (line.trim()) pending.push(line);
      }
      // 首套留在原块里；其余各成独立 `:root`（首尾各补一个换行，保持与原文同形的展开）
      const tomatoLines = (groups.get(keep) ?? []).filter((l) => l.trim());
      item.body = tomatoLines.length ? `\n${tomatoLines.join('\n')}\n` : '';
      rebuildRaw(item);
      for (const id of ids) {
        if (id === keep) continue;
        const lines = (groups.get(id) ?? []).filter((l) => l.trim());
        if (!lines.length) continue;
        push(id, `\n:root {\n${lines.join('\n')}\n}\n`);
      }
    }
  }

  // ── 域内特例 2：smartcat `@keyframes`（按皮肤规则里的 animation 引用名归属）
  if (domain === 'smartcat') {
    const ownerOfName = new Map();
    const collect = (list) => {
      for (const it of list) {
        if (it.kind === 'at') {
          collect(parseCss(it.body));
          continue;
        }
        if (it.kind !== 'rule') continue;
        const hits = skinsInText(it.sel, allIds, domain);
        if (!hits.size) continue;
        for (const m of it.body.matchAll(/animation(?:-name)?\s*:\s*([^;{}]+)/g)) {
          const name = m[1].trim().split(/\s+/)[0];
          if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) continue;
          const arr = ownerOfName.get(name) ?? new Set();
          for (const h of hits) arr.add(h);
          ownerOfName.set(name, arr);
        }
      }
    };
    collect(items);

    const rest = [];
    for (const it of items) {
      const m = it.kind === 'at' && it.sel.trim().match(/^@keyframes\s+([A-Za-z0-9_-]+)$/);
      const owners = m ? ownerOfName.get(m[1]) : null;
      if (!owners || !owners.size) {
        rest.push(it);
        continue;
      }
      // 同时被多套皮引用 → 各自留一份；被首套引用 → 源里也留一份
      if (owners.has(keep)) rest.push(it);
      for (const id of owners) if (id !== keep) push(id, it.raw);
    }
    items = rest;
  }

  // ── 通用归属：选择器 token → 皮肤。**必须连首套一起认**——否则
  // 「.bz-memo-skin-paper …, .bz-memo-skin-editorial …」这类混合块会被整块搬走，
  // 内置首套当场丢规则（守恒校验看不出来，因为块还在皮文件里）。
  const attr = items.map((it) => attributed(it, allIds, domain));
  // 注释随其后第一个有归属的块走（前面无归属块的注释留在源里）
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind !== 'comment') continue;
    let j = i + 1;
    while (j < items.length && items[j].kind === 'comment') j++;
    if (j < items.length) attr[i] = attr[j];
  }

  const keptParts = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const hit = attr[i];
    const keepOnly = hit.size > 0 && [...hit].every((s) => s === keep);
    if (hit.size === 0 || keepOnly) {
      keptParts.push(it.raw);
      continue;
    }
    if (it.kind === 'rule' && it.sel.trim() === ':root') {
      // 只有 pomodoro 的 `--pz-<id>-*` 表走按行分组特例；别处出现 = 漏搬，宁可报错不静默留双份
      throw new Error(
        `[${domain}] :root 里仍有远端皮肤声明（${[...hit].filter((s) => s !== keep).join('、')}）——按 --pz-<id>- 分组格式写，参照 splitDomain 的 :root 特例`,
      );
    }
    // 含首套的混合块（如两套皮共用一个选择器）：**只留源里**——源恒在，远端皮用同一份规则即可，
    // 搬走会让内置首套当场丢规则（bookshelf 预览卡公共壳、memo 的 [data-memo-sort] 行都是这种块）。
    if (hit.has(keep)) {
      keptParts.push(it.raw);
      continue;
    }
    for (const id of hit) if (id !== keep) push(id, it.raw);
  }

  return { kept: keptParts.join(''), moved };
}

/** 皮肤源文件头（人读的出处说明；正文接切出的规则） */
function skinFileHeader(domain, skin) {
  return `/* ============================================================
 * bz 皮肤包 · ${domain}/${skin.id}（${skin.name}）——ADR-0199
 *
 * 本文件是**远端皮肤源**：不进构建聚合（scripts/build-css.mjs 不登记
 * src/${domain}/skins/），由 scripts/build-skin-pack.mjs 出版到
 * manual/skins/${domain}/${skin.id}.css，插件启动时同步到
 * <configDir>/plugins/bz/skins/ 后经 core/skin-pack.ts 注入。
 *
 * 改样式＝改这里；改完跑 pnpm skin-pack 重出版（清单 sha256 随之更新）。
 * ============================================================ */
`;
}

/** 逐块校验：切出的内容必须真的带着该皮肤的 token（防串皮） */
function verifyOwnership(domain, skin, text) {
  if (!TOKENS[domain](skin.id).some((t) => text.includes(t))) {
    throw new Error(`[${domain}/${skin.id}] 切出的内容不含皮肤 token，疑似串皮：\n${text.slice(0, 200)}`);
  }
}

let changed = 0;

// ── 前置护栏：本工具**只在干净树上跑一次**（切完源里就没有可搬的块了，再跑只能凭空造文件）。
//    典型踩坑：源已切分、只想补切一个副源 → 会拿「只有副源那几块」的内容覆盖掉整份皮文件。
if (!CHECK_ONLY) {
  for (const [domain, cfg] of Object.entries(CATALOG.domains)) {
    const skinDir = path.join(ROOT, `src/${domain}/skins`);
    if (!fs.existsSync(skinDir)) continue;
    const srcMoves = Object.entries(splitDomain(fs.readFileSync(path.join(ROOT, `src/${domain}/styles.css`), 'utf8'), domain).moved)
      .filter(([, raws]) => raws.join('').trim());
    if (!srcMoves.length) {
      throw new Error(
        `src/${domain}/skins/ 已存在，且 src/${domain}/styles.css 里已无可切的皮肤规则——本工具只在干净树上跑。` +
          `要重切：git checkout HEAD -- src/${domain}/styles.css src/settings-panel/styles.css && rm -rf src/${domain}/skins`,
      );
    }
  }
}

for (const [domain, cfg] of Object.entries(CATALOG.domains)) {
  const files = [`src/${domain}/styles.css`, ...(EXTRA_SOURCES[domain] ?? [])];
  const moved = new Map(cfg.skins.map((s) => [s.id, []]));
  let keptLeaves = 0;

  for (const rel of files) {
    const file = path.join(ROOT, rel);
    const css = fs.readFileSync(file, 'utf8');
    const beforeLeaves = new Set(parseCss(css).flatMap((it) => leaves(it)));

    const res = splitDomain(css, domain);
    const afterLeaves = new Set(parseCss(res.kept).flatMap((it) => leaves(it)));
    for (const [id, raws] of res.moved) moved.get(id).push(...raws);
    keptLeaves += afterLeaves.size;

    // 守恒：本文件「保留 + 切出」的叶子块集合必须与原文相等
    const movedLeaves = [...res.moved.values()].flatMap((raws) => raws.flatMap((r) => leaves(parseCss(r)[0] ?? { kind: 'stmt', raw: r })));
    for (const l of movedLeaves) afterLeaves.add(l);
    const lost = [...beforeLeaves].filter((l) => !afterLeaves.has(l));
    const added = [...afterLeaves].filter((l) => !beforeLeaves.has(l));
    if (lost.length) throw new Error(`[${rel}] 切分丢块 ${lost.length} 处：\n${lost.slice(0, 5).join('\n')}`);
    if (added.length) throw new Error(`[${rel}] 切分多出无关块 ${added.length} 处：\n${added.slice(0, 5).join('\n')}`);

    if (!CHECK_ONLY && res.kept !== css) {
      fs.writeFileSync(file, res.kept, 'utf8');
      changed++;
    }
  }

  const skinDir = path.join(ROOT, `src/${domain}/skins`);
  for (const skin of cfg.skins) {
    const body = (moved.get(skin.id) ?? []).join('');
    if (!body.trim()) continue; // 该皮无规则（如 smartcat 的首套镜像）→ 不留空文件
    const text = skinFileHeader(domain, skin) + body.replace(/^\n+/, '\n');
    verifyOwnership(domain, skin, body);
    const out = path.join(skinDir, `${skin.id}.css`);
    const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (prev !== text) changed++;
    if (!CHECK_ONLY) {
      fs.mkdirSync(skinDir, { recursive: true });
      fs.writeFileSync(out, text, 'utf8');
    }
  }

  const movedCount = cfg.skins.filter((s) => (moved.get(s.id) ?? []).join('').trim()).length;
  console.log(`${domain}: 保留叶子块 ${keptLeaves} 个 / 切出 ${movedCount} 套皮`);
}

// ── --check：源里不得再有「该搬走的块」。判据 = 重跑切分后 kept 与原文逐字相同
//    （等价于「没有任何块命中远端皮肤且不含首套」——含首套的混合块是有意保留的，
//     它的选择器本来就会列出远端皮肤类，所以不能简单地搜字符串）
let dirty = [];
for (const [domain, cfg] of Object.entries(CATALOG.domains)) {
  const ids = cfg.skins.map((s) => s.id);
  const allIds = [cfg.keep.id, ...ids];
  for (const rel of [`src/${domain}/styles.css`, ...(EXTRA_SOURCES[domain] ?? [])]) {
    const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const { kept } = splitDomain(css, domain);
    if (kept === css) continue;
    const offenders = parseCss(css)
      .filter((it) => {
        const hit = attributed(it, allIds, domain);
        return hit.size > 0 && !hit.has(cfg.keep.id);
      })
      .map((it) => String(it.sel || it.raw).replace(/\s+/g, ' ').trim().slice(0, 60));
    dirty.push(`${rel}（${offenders.length} 处：${offenders.slice(0, 3).join(' | ')}）`);
  }
}
if (dirty.length) {
  throw new Error(`样式里仍残留该搬走的皮肤规则，跑 scripts/split-domain-skins.mjs 修：\n  ${dirty.join('\n  ')}`);
}
console.log('源内已无待搬的远端皮肤规则 ✓');
console.log(CHECK_ONLY ? '检查模式：未写盘' : `切分完成，改动 ${changed} 个文件`);
