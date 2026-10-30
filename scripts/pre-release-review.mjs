#!/usr/bin/env node
/* 前置 review 骨架生成器（2026-10-31 立）：吐出 <基线 tag>..HEAD 的规模统计 + 按域分组
 * 的文件清单 + 提交列表，review agent 往里填问题就行（清单格式与编号规则见
 * docs/pre-release-review.md——编号给了不再变，P0 > P1 > P2 排序，写不出判据不许列）。
 * 用法：node scripts/pre-release-review.mjs [基线tag]   （缺省取最新 tag）
 * 只读：git log / diff 全程不带写操作。 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const tags = git(['tag', '--sort=-creatordate']).split('\n').filter(Boolean);
const base = process.argv[2] || tags[0];
if (!base) {
  console.error('仓库里没有 tag，先给基线：node scripts/pre-release-review.mjs <tag>');
  process.exit(1);
}
const range = `${base}..HEAD`;

const commits = git(['log', '--oneline', '--no-decorate', range]).split('\n').filter(Boolean);
const nameOnly = git(['diff', '--name-only', range]).split('\n').filter(Boolean);
const stat = git(['diff', '--shortstat', range]).trim();

/* 按域分组：src/<域>/ 是主结构；根产物 / tests / docs / scripts / prototypes 各自一组 */
const groups = new Map();
const groupOf = (f) => {
  const m = f.match(/^src\/([^/]+)\//);
  if (m) return `src/${m[1]}`;
  if (f.startsWith('tests/')) return 'tests';
  if (f.startsWith('docs/') || f === 'AGENTS.md' || f === 'CONTEXT.md') return 'docs';
  if (f.startsWith('scripts/')) return 'scripts';
  if (f.startsWith('prototypes/')) return 'prototypes';
  return '根产物/其他';
};
for (const f of nameOnly) {
  const g = groupOf(f);
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(f);
}
const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

const out = [];
out.push(`# 发布前置 review 骨架（${base}..HEAD）`);
out.push('');
out.push(`- 提交数：${commits.length}；改动文件：${nameOnly.length}；${stat}`);
out.push('');
out.push('## 提交列表（log 口径，供 review 时对照「每条提交落在哪个域」）');
out.push('');
for (const c of commits) out.push(`- ${c}`);
out.push('');
out.push('## 改动文件（按域分组，行数为该域文件数）');
out.push('');
for (const [g, files] of sorted) {
  out.push(`### ${g}（${files.length} 文件）`);
  out.push('');
  for (const f of files) out.push(`- ${f}`);
  out.push('');
}
out.push('## 四维度检查（检查点见 docs/pre-release-review.md）');
out.push('');
for (const dim of ['代码', '样式 UI', '稳定性', '增强建议']) {
  out.push(`### ${dim}`);
  out.push('');
  out.push('| # | 位置 | 问题 | 建议 | 档 |');
  out.push('|---|---|---|---|---|');
  out.push('|  |  |  |  |  |');
  out.push('');
}
out.push('清单给用户挑号后：选哪些修哪些，修完才进七步；P0 没修完不发版。');
console.log(out.join('\n'));
