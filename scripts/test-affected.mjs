/**
 * 增量跑测试 —— 「只跑受影响，且不许漏」的选择器。
 *
 * 为什么不直接用 `vitest --changed` / `vitest related`（2026-10-01 实测，见 issues/534）：
 *  1) 纯样式变更（含界面级单源 `src/core/ui/components.css`）它选中 **0 个测试**且退出码 0 ——
 *     仓库的样式单源守卫（铁律 3/9、ADR-0122、ADR-0199）正是靠 `readFileSync` 读源码文本断言，
 *     模块图里没有这条边，所以永远选不中；改样式 = 假绿。
 *  2) `pnpm-lock.yaml` 同样 0 命中（node_modules 依赖被显式跳过）。
 *  3) 它的固定开销实测 5.4–5.8s（要先 transform 全部 588 个 spec 建反向边表），
 *     而全量已经只要 ~29s（2026-10-01 提速批后），命中面一大就反超。
 *
 * 本脚本的口径：**用静态扫描自己建依赖索引**（冷建 ~0.4s），并把三类边都建起来：
 *  · import 边   —— `from '...'` / `import('...')` / `require('...')` 的相对路径
 *  · 文本边      —— 测试里以字符串字面量**直接读**的仓库路径（`repo('src/x.css')` 形态）；
 *                   判定依据是**路径真实存在**，不设「根目录白名单」：`downloads/`、`tools/`、
 *                   `prototypes/`、`manual/` 一样有守卫读，白名单会把它们全推给「一律全量」
 *  · 目录/整树边 —— 扫树守卫（`readdirSync('src')`、`listDomainStyles('src')`）→ 该目录下任何文件变更都命中
 * 前两类决定「改什么跑谁」，第三类保证扫树守卫不会被漏掉。
 *
 * 保守到底的三条硬升格 + 一条兜底（宁可全量，不许漏测）：
 *  · 依赖/配置/测试基建/全局夹具/样式/**core** 变更 → 全量
 *  · src 下文件新增/删除/改名 → 全量（模块增删会改依赖方向与皮肤清单）
 *  · 改动的 src 文件没有任何测试可达（反向闭包为空）→ 全量（可能是注册型入口）
 *  · 索引根之外、且**没有任何文本边/目录边**盖住它 → 全量（根 `main.js`、`.gitignore`…）；
 *    `.md` 例外，仓库里没有测试把文档当输入
 *
 * 用法：
 *   pnpm test:affected                     # 相对 HEAD 的未提交改动（开发循环）
 *   pnpm test:affected --since master      # 分支上相对主线的全部改动
 *   pnpm test:affected --list              # 只看选择结果与理由，不跑
 *   pnpm test:affected --no-cache          # 忽略结果缓存
 *   pnpm test:affected -- --reporter=dot   # `--` 之后透传给 vitest
 *   pnpm test:affected --full              # 强制全量并刷新结果缓存
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CACHE_DIR = path.join(ROOT, '.bz-test-cache');
const CACHE_FILE = path.join(CACHE_DIR, 'results.json');
/** 工具自身路径：进 harness 分片（见 harnessParts），改了选择口径旧缓存必须整体作废 */
const TOOL_SELF = fileURLToPath(import.meta.url);
/** 缓存结构版本：不与 tool 分片重复，但改字段形状时得一起抬 */
const CACHE_VERSION = 1;

/** 只索引这些目录（node_modules 等一律不看） */
const INDEX_ROOTS = ['src', 'tests', 'scripts'];

/** 被索引进依赖图的文件后缀 */
const INDEXABLE = /\.(ts|mjs|js|css|json)$/;

const slash = (p) => p.split(path.sep).join('/');

/**
 * 文件内容缓存：一次运行内每个文件只读一遍，**读字节**（不是解码后的文本）。
 * 必要性：算结果指纹时要对「自身 ∪ 依赖闭包」逐个哈希，而扫树守卫的闭包≈整棵 src
 * （491 个文件 × 43 个守卫），不缓存就是几十万次重复读盘。
 * 为什么要字节：目录边会盖住 `downloads/`、`prototypes/` 里的 .css/.html/图片，
 * `readFileSync(p,'utf8')` 会把所有非法字节统一成 U+FFFD —— 两个不同的二进制文件可能
 * 解出同一个字符串，指纹就撞了。哈希一律走 Buffer。
 */
const bytesCache = new Map();
function readBytes(abs) {
  if (bytesCache.has(abs)) return bytesCache.get(abs);
  let buf = null;
  try {
    buf = fs.readFileSync(abs);
  } catch {
    buf = null;
  }
  bytesCache.set(abs, buf);
  return buf;
}
function readText(abs) {
  const buf = readBytes(abs);
  return buf === null ? null : buf.toString('utf8');
}

/**
 * stat 结果缓存（按绝对路径，命中/未命中都记）。
 * 为什么必须有：判定「字面量是不是仓库里的真实路径」要 stat，而解析 import 时每个说明符要试
 * 8 个后缀 —— 不做记忆化实测 **8.2 万次 statSync / 1.57s**（Windows 上失败 stat 也不便宜）。
 * 记忆化后掉到 ~1.8 万次（同一路径在 588 个测试文件里反复出现）。
 */
const statCache = new Map();
function statOrNull(abs) {
  if (statCache.has(abs)) return statCache.get(abs);
  let st = null;
  try {
    st = fs.statSync(abs);
  } catch {
    st = null;
  }
  statCache.set(abs, st);
  return st;
}

/** 相对说明符 → 仓库内文件（按「所在目录 + 说明符」记忆化，重复 import 不再重试 8 个后缀） */
const resolveCache = new Map();
/** 目录整树边 → 文件列表（见 expandDir） */
const dirExpansionCache = new Map();
/** git 可见文件全集（见 gitVisibleSet） */
const gitVisibleCache = new Map();

/** 供测试用：丢掉内容缓存（临时目录夹具改文件后必须调） */
export function _clearContentCache() {
  bytesCache.clear();
  statCache.clear();
  resolveCache.clear();
  dirExpansionCache.clear();
  gitVisibleCache.clear();
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** 仓库内参与建图的全部文件（repo 相对、正斜杠） */
export function indexableFiles(root = ROOT) {
  const out = [];
  for (const r of INDEX_ROOTS) {
    for (const abs of walk(path.join(root, r))) {
      if (INDEXABLE.test(abs)) out.push(slash(path.relative(root, abs)));
    }
  }
  return out;
}

export function walkTests(root = ROOT) {
  return walk(path.join(root, 'tests'))
    .filter((p) => /\.test\.(ts|mjs)$/.test(p))
    .map((p) => slash(path.relative(root, p)))
    .sort();
}

// ───────────────────────────── 变更集 ─────────────────────────────

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

/**
 * 收集变更集，语义对齐 vitest 的 VCS provider：
 *   git diff <since>            → 已提交(since 之后) + 已暂存 + 未暂存（含删除）
 *   git ls-files --other        → 未跟踪新文件
 * 返回 {path, status}，status ∈ M/A/D/R（R 记为新旧两条）。
 */
export function collectChanged({ root = ROOT, since = 'HEAD' } = {}) {
  const out = new Map();
  const nameStatus = git(root, ['diff', '--name-status', since]);
  for (const line of nameStatus ?? []) {
    const [status, ...rest] = line.split('\t');
    const st = status[0];
    if (st === 'R' || st === 'C') {
      const [, from, to] = [status].concat(rest);
      if (from) out.set(slash(from), 'D');
      if (to) out.set(slash(to), 'A');
      continue;
    }
    const file = rest[0];
    if (file) out.set(slash(file), st);
  }
  for (const f of git(root, ['ls-files', '--other', '--exclude-standard']) ?? []) {
    out.set(slash(f), 'A');
  }
  return [...out.entries()].map(([file, status]) => ({ file, status }));
}

/**
 * 「git 能报成变更的文件」全集 = tracked ∪ 未跟踪未忽略。
 * 与 collectChanged 的口径严格一致，非 git 目录返回 null（测试夹具退回磁盘扫描）。
 * 用途是算目录整树边的指纹分母：新增文件在、被删的 tracked 文件也还在（内容按 missing 计），
 * 增 / 删 / 改三种都能让指纹变。相反 `git ls-files` 之外的东西（node_modules 等被忽略的目录）
 * 不进来 —— 它们永远不会出现在变更集里，不该参与指纹，也不该被整树遍历。
 */
function gitVisibleSet(root) {
  if (gitVisibleCache.has(root)) return gitVisibleCache.get(root);
  const tracked = git(root, ['ls-files']);
  let set = null;
  if (tracked) {
    set = new Set(tracked.map(slash));
    for (const f of git(root, ['ls-files', '--other', '--exclude-standard']) ?? []) set.add(slash(f));
  }
  gitVisibleCache.set(root, set);
  return set;
}

// ───────────────────────────── 依赖索引 ─────────────────────────────

const IMPORT_RE = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;
/**
 * 字符串字面量 → 仓库内路径（文本边）。
 *
 * 为什么不能只抓 `'src/...'` 形态（**这一版踩过的坑**）：仓库里的守卫写得很绕，路径常常
 * 不是紧贴引号开头，也不都在 src/tests/scripts 下——
 *   `const repo = (p) => readFileSync(join(process.cwd(), p)); repo('src/core/ui/components.css')`
 *   `const D = join(process.cwd(), 'src'); readdirSync(D)`
 *   `readFileSync(path.join(ROOT, 'downloads/manifest.json'))`   ← tools / downloads / prototypes
 * 曾用「根目录必须 ∈ {src,tests,scripts}」的白名单来筛，结果把 `downloads/manifest.json`、
 * `tools/obsidian-face/lib/*.js`、`prototypes/**` 这些**真有守卫在读**的路径全挡在门外
 * （它们只能靠升格兜底）。改成按**路径是否在仓库里真实存在**判定：不做根名单假设，
 * 也不放过拼错/不存在的路径（URL、绝对路径、vault 内路径、夹具里的假路径自然落空）。
 *
 * 先抓**所有**字符串字面量再筛，宁可宽（多跑几个测试），不可窄（漏掉守卫）。
 */
const STRING_RE = /(['"`])([^'"`\n]{1,160})\1/g;
const FS_WALK_RE = /readdirSync|statSync|existsSync|readFileSync|glob|walk/i;
/**
 * 一眼就不是仓库内路径的字面量：URL（`://`）、Win 盘符、模块说明符（`node:fs`）、
 * UNC / POSIX 绝对路径、`~/`。
 */
const NOT_A_REPO_PATH_RE = /:|^[\\/]|^~[\\/]/;
/** 带文件后缀的字面量（`styles.css` / `downloads/…` 之外还要捞根目录那几个文件） */
const HAS_FILE_EXT_RE = /\.(ts|mjs|js|css|json|md|html|txt)$/;

/**
 * 像不像一个路径字面量。
 *
 * 这道过滤必须**便宜**：每个通过的字面量后面都跟着一次 statSync，而测试文件里绝大多数
 * 字符串是 `'utf8'` / `'div'` / `'2025-06-11'` 这类值。所以先看形状：
 *   · 含 `/`                 → 像路径（`src/x.css`、`../../downloads/x.json`）
 *   · 带文件后缀             → 像路径（根目录的 `styles.css` / `main.js`）
 *   · 是仓库根的一级目录名   → 像路径（`'src'`（扫树守卫的 `join(cwd,'src')`）、`'downloads'`）
 * 其余一律不 stat。（宽松版实测要 stat **1.6 万次**，冷建索引 0.8s；收紧后见 issue 534 的实测表。）
 */
function looksLikePathLiteral(s, topDirs) {
  const t = s.trim();
  if (!t || /\s/.test(t)) return false;
  if (NOT_A_REPO_PATH_RE.test(t)) return false;
  if (t.includes('/')) return true;
  if (HAS_FILE_EXT_RE.test(t)) return true;
  return topDirs.has(t.replace(/^\.\//, ''));
}

function resolveFile(root, fromAbs, spec, fileSet = null) {
  const cacheKey = `${root}\0${path.dirname(fromAbs)}\0${spec}`;
  const hit = resolveCache.get(cacheKey);
  if (hit !== undefined) return hit;
  const base = path.resolve(path.dirname(fromAbs), spec);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.mjs`,
    `${base}.js`,
    `${base}.css`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.mjs'),
  ].map((c) => [c, slash(path.relative(root, c))]);
  // 先纯集合查（索引已知存在的文件，零 syscall），再退到 stat 兜住索引根之外的路径
  // （`../../package.json` 这类）。顺序不能颠倒：候选表本身就是优先级。
  let found = candidates.find(([, rel]) => fileSet?.has(rel))?.[1] ?? null;
  if (!found) {
    found = candidates.find(([abs]) => statOrNull(abs)?.isFile())?.[1] ?? null;
  }
  resolveCache.set(cacheKey, found);
  return found;
}

/** 把字符串字面量归一成 repo 相对路径（逃出仓库的一律丢） */
function normalizeTextPath(root, fromAbs, raw) {
  const cleaned = raw
    .trim()
    .replace(/\\/g, '/') // 字面量里的反斜杠写法（'src\\x.css'）也要能认
    .replace(/^\.\//, '')
    .replace(/\/+$/, ''); // 'src/' 这种带尾斜杠的目录实参：不剥掉就永远匹配不上任何文件
  const rel = cleaned.startsWith('../')
    ? slash(path.relative(root, path.resolve(path.dirname(fromAbs), cleaned)))
    : cleaned;
  if (!rel || rel === '.' || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel;
}

/**
 * 建依赖索引。
 * 返回：
 *   importEdges  文件 → 它 import 的仓库内文件（正向）
 *   textEdges    测试 → [{ target, kind }]，kind = 'file' | 'dir'（dir 含整树 / 前缀）
 *   srcFiles     src 下全部文件（判断反向闭包是否为空、目录边是否命中）
 */
export function buildIndex(root = ROOT, files = indexableFiles(root)) {
  const importEdges = new Map();
  const textEdges = new Map();
  const srcFiles = files.filter((f) => f.startsWith('src/'));
  const fileSet = new Set(files);
  // 仓库根的一级目录名（一次 readdir 换掉上万次 statSync 的试探）
  const topDirs = new Set();
  try {
    for (const e of fs.readdirSync(root, { withFileTypes: true })) {
      if (e.isDirectory()) topDirs.add(e.name);
    }
  } catch {
    /* 临时夹具目录还没建全也无妨：带 '/' 的字面量不依赖它 */
  }

  for (const rel of files) {
    const abs = path.join(root, rel);
    const text = readText(abs);
    if (text == null) continue;

    const deps = new Set();
    for (const m of text.matchAll(IMPORT_RE)) {
      if (!m[1].startsWith('.')) continue;
      const r = resolveFile(root, abs, m[1], fileSet);
      if (r) deps.add(r);
    }
    importEdges.set(rel, deps);

    if (!rel.startsWith('tests/') || !/\.test\.(ts|mjs)$/.test(rel)) continue;

    const edges = [];
    const seen = new Set();
    const walks = FS_WALK_RE.test(text);
    const add = (target, kind) => {
      const key = `${kind}:${target}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ target, kind });
    };
    for (const m of text.matchAll(STRING_RE)) {
      const literal = m[2];
      if (!looksLikePathLiteral(literal, topDirs)) continue;
      const norm = normalizeTextPath(root, abs, literal);
      if (!norm) continue;

      // 判定依据是**磁盘上真实存在**：文件 → 文件边；目录 → 目录整树边（仅当这个测试确实在扫树）
      const st = statOrNull(path.join(root, norm));
      if (st?.isFile()) {
        add(norm, 'file');
        continue;
      }
      if (st?.isDirectory()) {
        if (walks) add(norm, 'dir');
        continue;
      }
      if (!norm.includes('*')) continue;

      // glob：stat 必然失败，退化成「静态前缀」目录边
      const prefix = norm.split('/').filter((s) => !s.includes('*')).join('/');
      if (prefix && statOrNull(path.join(root, prefix))?.isDirectory()) add(prefix, 'dir');
    }
    if (edges.length) textEdges.set(rel, edges);
  }

  return { root, importEdges, textEdges, srcFiles, files };
}

function dirMatches(dirTarget, file) {
  return file === dirTarget || file.startsWith(`${dirTarget}/`);
}

/**
 * 目录整树边 → 该目录下「可能被报成变更」的全部文件（升序，供指纹用）。
 *
 * **这是自审抓到的 P0**：初版把目录边写成 `for (const f of srcFiles) if (dirMatches(target, f))`，
 * 也就是只拿 `src/` 下的文件去展开。于是 `downloads/`、`manual/`、`prototypes/`、
 * `tools/` 这些**索引根之外**的目录边：`pickTests` 会靠它选中守卫，但 `fileKey` 里一个文件都
 * 没有 → `applyCache` 拿旧 pass 把守卫复用掉 ——「选中了」和「会跑」成了两回事，确定性漏测。
 * 现在分母取 git 可见全集（与 collectChanged 同口径）；非 git 目录（夹具）退回磁盘扫描。
 */
function expandDir(root, target) {
  const key = `${root}\0${target}`;
  const hit = dirExpansionCache.get(key);
  if (hit) return hit;
  const universe = gitVisibleSet(root);
  const out = (
    universe
      ? [...universe].filter((rel) => dirMatches(target, rel))
      : walk(path.join(root, target)).map((abs) => slash(path.relative(root, abs)))
  ).sort();
  dirExpansionCache.set(key, out);
  return out;
}

/** 文本边是否命中该变更文件 */
export function textEdgeHit(target, kind, file) {
  if (kind === 'file') return target === file;
  return dirMatches(target, file);
}

// ───────────────────────────── 升格判定 ─────────────────────────────

const FULL_RULES = [
  [(f) => f === 'package.json' || f === 'pnpm-lock.yaml' || f === 'pnpm-workspace.yaml', '依赖/清单'],
  [(f) => f === 'vitest.config.ts' || f === 'tsconfig.json' || f === 'esbuild.config.mjs', '测试/构建配置'],
  [(f) => f.startsWith('scripts/'), '测试基建'],
  // tests/ 下的非测试文件都是共享夹具（setup / mock-* / helpers / 未来说不准的新夹具），一律全量
  [(f) => f.startsWith('tests/') && !/\.test\.(ts|mjs)$/.test(f), '全局夹具'],
  // core 是共享层：实测 500/588 个测试直接或间接依赖它，增量跑 500 个 ≈ 全量，不如直说
  [(f) => f.startsWith('src/core/') && !f.endsWith('.css'), 'core 共享层'],
  // 索引只覆盖 src/tests/scripts（INDEX_ROOTS）与「被文本边指到的路径」。除此之外的变更
  // （根 main.js / .gitignore / 新加的顶层目录 …）**没有任何边**，那就不能假装知道谁受影响。
  // 注意条件里的「无任何文本边」：downloads/manifest.json、tools/… 、prototypes/… 这些虽然
  // 在索引根之外，但确有守卫用字符串字面量指着它们（文本边/目录边已在索引里），所以走精确选择，
  // 只有真·无主的文件才升格。`.md` 例外：仓库里没有任何测试把文档当输入。
  [
    (f, index) => !/^(src|tests|scripts)\//.test(f) && !/\.md$/.test(f) && !referencedByAnyEdge(index, f),
    '依赖图外且无守卫引用',
  ],
];

/** 某个文件是否被任何文本边（文件级 / 目录整树级）盖住 → 有守卫在读它 */
function referencedByAnyEdge(index, file) {
  for (const edges of index.textEdges.values()) {
    for (const e of edges) if (textEdgeHit(e.target, e.kind, file)) return true;
  }
  return false;
}

/**
 * 判定这次要不要直接全量。返回理由数组（空数组 = 可以只跑受影响）。
 */
export function classify({ changed, index }) {
  const reasons = [];
  const push = (why) => {
    if (!reasons.includes(why)) reasons.push(why);
  };

  // 反向可达（只用 import 边；文本/目录边是「守卫」不是「覆盖」）
  const rev = new Map();
  for (const [from, deps] of index.importEdges) {
    for (const d of deps) {
      if (!rev.has(d)) rev.set(d, new Set());
      rev.get(d).add(from);
    }
  }
  const testReach = (start) => {
    const queue = [start];
    const seen = new Set(queue);
    while (queue.length) {
      for (const up of rev.get(queue.pop()) ?? []) {
        if (seen.has(up)) continue;
        seen.add(up);
        queue.push(up);
        if (/\.test\.(ts|mjs)$/.test(up)) return true;
      }
    }
    return false;
  };

  for (const { file, status } of changed) {
    for (const [test, why] of FULL_RULES) {
      if (test(file, index)) push(`${why}：${file}`);
    }

    if (file.startsWith('src/') && (status === 'A' || status === 'D')) {
      push(`src 模块增删/改名：${file}`);
      continue;
    }

    if (file.endsWith('.css')) {
      // 样式不进 import 闭包，靠样式守卫的文本边命中；没守卫看的样式文件 = 改了没人查 → 全量
      if (!referencedByAnyEdge(index, file)) push(`样式文件无守卫引用：${file}`);
      continue;
    }

    if (file.startsWith('src/')) {
      if (status !== 'D' && !fs.existsSync(path.join(index.root ?? ROOT, file))) {
        push(`变更路径不存在/未跟踪：${file}`);
      } else if (!testReach(file)) {
        push(`改动的 src 文件无测试可达：${file}`);
      }
    }
  }

  return reasons;
}

// ───────────────────────────── 选测试 ─────────────────────────────

/**
 * 选出让哪些测试文件跑。
 * 返回 { mode: 'full' | 'affected', files, reasons, skippedByTextEdge }
 */
export function pickTests({ root = ROOT, since = 'HEAD', cache = null, files: override = null } = {}) {
  const all = walkTests(root);
  const index = buildIndex(root);
  const changed = override?.length
    ? override.map((file) => ({ file: slash(file), status: 'M' }))
    : collectChanged({ root, since });

  if (!changed.length) {
    return { mode: 'affected', files: [], reasons: ['工作区无变更'], changed, index };
  }

  const fullReasons = classify({ changed, index });
  if (fullReasons.length) {
    return { mode: 'full', files: all, reasons: fullReasons, changed, index };
  }

  // 反向闭包（import 边）
  const rev = new Map();
  for (const [from, deps] of index.importEdges) {
    for (const d of deps) {
      if (!rev.has(d)) rev.set(d, new Set());
      rev.get(d).add(from);
    }
  }
  const picked = new Set();
  // 直接改的测试文件本身必须跑（它没有 importer，反向闭包找不到它）
  for (const { file } of changed) if (/\.test\.(ts|mjs)$/.test(file)) picked.add(file);

  const queue = changed.map((c) => c.file);
  const seen = new Set(queue);
  while (queue.length) {
    for (const up of rev.get(queue.pop()) ?? []) {
      if (seen.has(up)) continue;
      seen.add(up);
      queue.push(up);
      if (/\.test\.(ts|mjs)$/.test(up)) picked.add(up);
    }
  }

  // 文本边 / 目录边（扫树守卫走这条，vitest 原生永远选不中它们）
  for (const [test, edges] of index.textEdges) {
    for (const { target, kind } of edges) {
      if (changed.some((c) => textEdgeHit(target, kind, c.file))) {
        picked.add(test);
        break;
      }
    }
  }

  const files = [...picked].sort();
  const filtered = cache ? applyCache({ root, files, index, cache }) : { files, reused: [] };
  return {
    mode: 'affected',
    files: filtered.files,
    reused: filtered.reused,
    reasons: [`变更 ${changed.length} 个文件 → 命中 ${files.length} 个测试`],
    changed,
    index,
    all,
  };
}

// ───────────────────────────── 结果缓存 ─────────────────────────────

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * harness 分片：任一变化 → 缓存整体作废。
 *
 * **`tool:` 这条不能省**（自审补上）：分片里少了工具自身，改 `fileKey` 的口径（例如把目录边
 * 从只展开 src 改成展开全目录）之后，旧 rows 的 key 算法与新算法不同却仍然「对得上」——
 * 修复会被旧缓存原样继承。代价只是脚本一改就全部重跑一次（脚本改动本身就该触发全量）。
 */
export function harnessParts(root = ROOT) {
  const parts = [`node:${process.version}`, `platform:${process.platform}-${process.arch}`];
  for (const f of ['package.json', 'pnpm-lock.yaml', 'vitest.config.ts', 'tsconfig.json', 'scripts/test-workers.mjs', 'tests/setup.ts', 'tests/mock-obsidian-entry.ts', 'tests/mock-vault.ts']) {
    try {
      parts.push(`${f}:${sha(fs.readFileSync(path.join(root, f), 'utf8'))}`);
    } catch {
      parts.push(`${f}:missing`);
    }
  }
  try {
    parts.push(`tool:${sha(fs.readFileSync(TOOL_SELF, 'utf8'))}`);
  } catch {
    parts.push('tool:missing');
  }
  parts.push(`env:BZ_TEST_MAX_WORKERS=${process.env.BZ_TEST_MAX_WORKERS ?? ''}`);
  // 本地日期入 key：用例结果可能与「今天」有关（时间窗口 / 到期 / 周界）。
  // 仓库已把日期依赖改成相对口径，但跨日复用一个 pass 是**不必冒**的风险——
  // 代价只是一天一次缓存未命中，换来的是「日期边界永不假绿」。
  const d = new Date();
  parts.push(`date:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  return parts;
}

export function harnessHash(root = ROOT) {
  return sha(harnessParts(root).join('|'));
}

/** 单个测试文件的指纹 = harness ‖ 自身 ∪ 依赖闭包 的内容 hash */
export function fileKey(root, testFile, index, harness = harnessHash(root)) {
  const { importEdges, textEdges } = index;
  const deps = new Set();
  const queue = [testFile];
  const seen = new Set(queue);
  while (queue.length) {
    const cur = queue.pop();
    deps.add(cur);
    for (const d of importEdges.get(cur) ?? []) {
      if (seen.has(d)) continue;
      seen.add(d);
      queue.push(d);
    }
  }
  // 文本/目录边：目录边展开成「该目录下 git 可见的全部文件」（见 expandDir 的 P0 说明）
  for (const { target, kind } of textEdges.get(testFile) ?? []) {
    if (kind === 'file') deps.add(target);
    else for (const f of expandDir(root, target)) deps.add(f);
  }
  const sorted = [...deps].sort();
  const h = crypto.createHash('sha256');
  h.update(harness);
  for (const rel of sorted) {
    h.update(rel);
    h.update('\0');
    // 按字节哈希：闭包里会有 downloads/*.html、prototypes/*.jpg 这类非文本文件
    h.update(readBytes(path.join(root, rel)) ?? Buffer.from('missing'));
    h.update('\0');
  }
  return { key: h.digest('hex'), deps: sorted };
}

export function loadCache(root = ROOT, file = CACHE_FILE) {
  const empty = { version: CACHE_VERSION, results: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw || typeof raw !== 'object' || !raw.results) return empty;
    // 结构版本对不上就整包丢掉：字段形状变了，旧行怎么解释都是猜
    if (raw.version !== CACHE_VERSION) return empty;
    return raw;
  } catch {
    return empty;
  }
}

/** 原子写（并发 worktree / 并发会话下不留半个文件） */
export function saveCache(cache, root = ROOT, file = CACHE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...cache, version: CACHE_VERSION }, null, 2));
  fs.renameSync(tmp, file);
}

/** 只复用 status=pass 且指纹一致的文件（失败的必须重跑） */
export function applyCache({ root = ROOT, files, index, cache, harness = harnessHash(root) }) {
  const reused = [];
  const run = [];
  for (const f of files) {
    const hit = cache.results[f];
    if (hit && hit.status === 'pass' && hit.key === fileKey(root, f, index, harness).key) {
      reused.push(f);
      continue;
    }
    run.push(f);
  }
  return { files: run, reused };
}

/**
 * 从 vitest 的 json 报告回写缓存。
 *
 * 只回写**这次真的跑过**的文件，且只有 pass 会被复用（fail 一律重跑）；
 * 报告里没有的文件保持原条目不动。缓存是**按文件**的，所以增量跑出来的 pass 同样有效
 * ——「只有全量才写回」是没必要的自我阉割：单个文件的 pass 与「本次跑了多少个文件」无关，
 * 而 key 已经覆盖了它自己的依赖闭包。
 *
 * flaky 的口径（别被注释骗了）：vitest 的 json 报告里**没有** retryCount（实测
 * `assertionResults` 只有 status/duration 等），靠 retry 救回的 pass 与一次过的 pass 长得一样，
 * 因此会被同等缓存。这与本仓 `vitest.config.ts` 的 `retry: 2`「flaky 抖动自动吸收」是同一口径
 * —— 该用例本轮确实通过了，不是漏测。真要区分得自挂一个 reporter 去读 `diagnostic().retryCount`，
 * 代价大于收益。
 */
export function updateFromReport(cache, report, index, harness, root = ROOT) {
  for (const t of report?.testResults ?? []) {
    const f = slash(path.relative(root, t.name));
    if (!f.startsWith('tests/') || !/\.test\.(ts|mjs)$/.test(f)) continue;
    cache.results[f] = {
      status: t.status === 'passed' ? 'pass' : 'fail',
      key: fileKey(root, f, index, harness).key,
    };
  }
  return cache;
}

// ───────────────────────────── CLI ─────────────────────────────

/**
 * 解析 CLI 参数。抽成纯函数是为了能测 —— `--since=master` 曾被静默当成没传
 * （于是退回 HEAD，选的改动集悄悄变了），这种事只有测得到才守得住。
 */
export function parseArgs(argv) {
  const sep = argv.indexOf('--');
  const head = sep === -1 ? argv : argv.slice(0, sep);
  const passthrough = sep === -1 ? [] : argv.slice(sep + 1);

  const sinceIdx = head.indexOf('--since');
  const sinceEq = head.find((a) => a.startsWith('--since='));
  const since = sinceEq
    ? sinceEq.slice('--since='.length)
    : sinceIdx >= 0
      ? head[sinceIdx + 1]
      : 'HEAD';

  return {
    // `--since` 后面空着（或 `--since=`）→ 当没传：`git diff <undefined>` 是另一码事，不能赌
    since: since || 'HEAD',
    full: head.includes('--full'),
    list: head.includes('--list'),
    useCache: !head.includes('--no-cache'),
    // 位置参数 = 显式指定变更文件（诊断/回归用：不改动工作区也能看会选谁）
    files: head.filter((a, i) => !a.startsWith('--') && head[i - 1] !== '--since' && a !== since),
    passthrough,
    reporterGiven: head.some((a) => a.startsWith('--reporter') || a.startsWith('--outputFile')),
  };
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const { since, full: forceFull, list: listOnly, useCache, files: explicit, passthrough } = opt;

  const cache = useCache ? loadCache() : null;
  const plan = forceFull
    ? { mode: 'full', files: walkTests(), reasons: ['--full 强制全量'], index: buildIndex(), reused: [] }
    : pickTests({ root: ROOT, since, cache, files: explicit });

  if (plan.mode === 'full') {
    console.log(`→ 全量（${plan.files.length} 文件）`);
    for (const r of plan.reasons.slice(0, 6)) console.log(`   · ${r}`);
    if (plan.reasons.length > 6) console.log(`   · …另有 ${plan.reasons.length - 6} 条同类理由`);
  } else {
    console.log(`→ 增量（${plan.files.length} 文件待跑，变更 ${plan.changed.length} 个）`);
    for (const r of plan.reasons) console.log(`   · ${r}`);
    if (plan.reused?.length) console.log(`   · 复用上次成功结果：${plan.reused.length} 个（未跑）`);
  }

  if (!plan.files.length) {
    // 「没得跑」有三种成因，必须说清是哪一种 —— 原 `vitest --changed` 的假绿就是这里含混。
    // 一律 `exitCode = 0` + return，不用 `process.exit()`：管道下 exit 会截断还没刷出去的 stdout。
    if (plan.reused?.length) {
      console.log(`没有要跑的测试：${plan.reused.length} 个命中文件全部复用上次成功结果（输入逐字节未变）。`);
    } else if (!plan.changed.length) {
      console.log('工作区没有变更，未跑任何用例。要门禁结论请跑 `pnpm test:changed`（相对主线）或 `--full`。');
    } else {
      console.log(`变更 ${plan.changed.length} 个文件，但没有测试受影响（未跑任何用例）。`);
      console.log('若这不是文档类改动，请加 `--full` 全量确认 —— 空命中不等于通过。');
    }
    process.exitCode = 0;
    return;
  }
  if (listOnly) {
    // 全量时逐条列 589 行没有信息量，只报个数
    if (plan.mode === 'full') console.log(`   （全量：${plan.files.length} 个测试文件，不逐条列）`);
    else for (const f of plan.files) console.log(`   ${f}`);
    return;
  }

  // 缓存要写回就必须拿到每个文件的结果 —— 增量跑同样需要报告，不能只在全量时挂 json。
  // 用户自己带了 reporter/outputFile 时让位（不覆盖他的输出配置，宁可这次不写缓存）。
  const wantReport = useCache && !opt.reporterGiven;
  if (wantReport) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const reportPath = path.join(CACHE_DIR, 'vitest-report.json');

  const args = [
    VITEST, 'run', ...plan.files,
    // default 那个 reporter 是给人看的：只挂 json 的话跑完一行用例都不列（实测过），
    // 而 `--reporter` 是数组语义，两个可以并存。
    ...(wantReport ? ['--reporter=default', '--reporter=json', `--outputFile=${path.relative(ROOT, reportPath)}`] : []),
    ...passthrough,
  ];
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', env: process.env });
  // 没有这个监听，spawn 失败（EMFILE 等）会以「未处理的 'error' 事件」崩掉，
  // 只在 stderr 留一段栈 —— 用户看到的是一句没头没尾的 node 报错。
  child.on('error', (err) => {
    console.error(`→ 起不来 vitest：${err.message}`);
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    // 通过就写回。缓存是**按文件**的：单个文件这次 pass、且它的依赖闭包指纹一致，
    // 这个 pass 就成立，与「本次一共跑了几个文件」无关；fail 一律不写 pass，
    // 所以增量结论不会把没跑到的文件伪装成通过。
    if (code !== 0) {
      console.error(`→ vitest 退出码 ${code}${signal ? `（信号 ${signal}）` : ''}，不写回结果缓存。`);
    } else if (useCache) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const next = updateFromReport(loadCache(), report, plan.index, harnessHash());
        saveCache(next);
        const n = Object.keys(next.results).length;
        console.log(`→ 结果缓存已更新：本轮 ${report.testResults?.length ?? 0} 个文件通过（历史共 ${n} 条）→ ${CACHE_FILE}`);
      } catch (err) {
        // 报告缺失/半截不影响退出码，但必须说出来 —— 悄悄不写回等于缓存永远不长
        console.error(`→ 结果缓存未写回：${err.message}`);
      }
    }
    // 同样不用 process.exit()：stdout 是管道时它会把上面几行连同 vitest 的尾部输出一起截掉
    process.exitCode = code ?? 1;
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
