/**
 * 按域跑测试 —— 开发循环的默认入口（全量 `pnpm test` 不是默认动作：选择器判定的升格条件
 * 与「合回主干前跑 test:changed」见 AGENTS.md「跑什么」）。
 *
 * 为什么需要它：全量 586 文件 / 8872 例，墙钟 ~110–160s，而**改一个域通常只影响几十个文件**。
 * 但「一个域的测试」并不等于 `tests/<域>/`——历史上还有 26 个散落在 `tests/` 顶层的批次文件
 * （`review-fix-clip2-ui1.test.ts` 之类），它们按 `src/<域>/` 的 import 归属到域。本脚本把
 * 这条映射显式化，省得每回手敲一堆路径、或干脆图省事跑全量。
 *
 * 归属规则（简单、可预测，不做智能推断）：
 *  1. 文件在 `tests/<X>/` 下 → 归 X（不看 import）；
 *  2. 其余（顶层散落）→ 归它 import 得最多的 `src/<域>/`；只 import `core` 的归 `core`。
 *
 * 用法：
 *   node scripts/test-domain.mjs <域> [<域>...]       只跑这些域的用例
 *   node scripts/test-domain.mjs all                  跑全部（等价全量）
 *   node scripts/test-domain.mjs --list               打印域 → 文件数 映射
 *   node scripts/test-domain.mjs <域> -- -t "某用例"    `--` 之后的参数原样透传给 vitest
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = path.join(ROOT, 'tests');
const VITEST = path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs');

function walkTests(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTests(p, acc);
    else if (/\.test\.(ts|mjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const domains = fs
  .readdirSync(path.join(ROOT, 'src'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

/** 该文件 import 的 src/<域>/ 次数（core 单列，避免「谁都 import core」淹没真实归属） */
function srcImports(text) {
  const counts = new Map();
  for (const m of text.matchAll(/from\s+['"][^'"]*\/src\/([a-z-]+)\//g)) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return counts;
}

/** 域 → 文件列表 */
export function buildMap() {
  const map = new Map();
  for (const abs of walkTests(TESTS)) {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const seg = rel.split('/');
    let owner;
    if (seg.length > 2) {
      owner = seg[1]; // tests/<X>/...
    } else {
      const counts = srcImports(fs.readFileSync(abs, 'utf8'));
      const nonCore = [...counts.entries()].filter(([k]) => k !== 'core');
      const pool = nonCore.length ? nonCore : [...counts.entries()];
      // 次数最多者；并列取文件名里先出现的（counts 保序）
      owner = pool.sort((a, b) => b[1] - a[1])[0]?.[0] ?? '(未归属)';
    }
    if (!map.has(owner)) map.set(owner, []);
    map.get(owner).push(rel);
  }
  for (const v of map.values()) v.sort();
  return map;
}

function main() {
  const argv = process.argv.slice(2);
  const sep = argv.indexOf('--');
  const wanted = sep === -1 ? argv : argv.slice(0, sep);
  const passthrough = sep === -1 ? [] : argv.slice(sep + 1);

  const map = buildMap();

  if (wanted.includes('--list') || wanted.length === 0) {
    const rows = [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`域 → 测试文件数（在 tests/<域>/ 下 + 顶层按 import 归属；共 ${walkTests(TESTS).length} 文件）\n`);
    for (const [d, files] of rows) {
      const inside = files.filter((f) => f.startsWith(`tests/${d}/`)).length;
      const tag = domains.includes(d) ? '' : '  ← 非 src 域';
      console.log(`  ${d.padEnd(18)} ${String(files.length).padStart(3)}  (目录内 ${inside} + 归属 ${files.length - inside})${tag}`);
    }
    if (wanted.length === 0) {
      console.log('\n用法：node scripts/test-domain.mjs <域> [<域>...]   或   node scripts/test-domain.mjs all');
    }
    return wanted.length === 0 ? 1 : 0;
  }

  const picked = [];
  for (const w of wanted) {
    if (w === 'all') {
      for (const files of map.values()) picked.push(...files);
      continue;
    }
    const files = map.get(w);
    if (!files) {
      console.error(`未知域「${w}」。可用：${[...map.keys()].sort().join(' ')}`);
      process.exit(2);
    }
    picked.push(...files);
  }
  const uniq = [...new Set(picked)].sort();

  console.log(`→ ${wanted.join(' ')}：${uniq.length} 文件\n`);
  const child = spawn(process.execPath, [VITEST, 'run', ...uniq, ...passthrough], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 1));
}

export { walkTests, TESTS, ROOT };

// 仅在被直接执行时跑主流程（被测试 import 时不触发 spawn）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
