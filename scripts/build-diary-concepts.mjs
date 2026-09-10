/**
 * scripts/build-diary-concepts.mjs
 * 日记本「概念稿」数据包构建：prototypes/diary/concepts/concept-data.ts → concept-data.js
 *
 * 与 build-preview.mjs 的 buildBehavior 同款口径（IIFE + alias obsidian→fake），
 * 但独立成脚本，避免给主预览构建脚本增加概念稿专用的构建目标。
 * 产物提交入 git（保「双击零依赖」先例）。输出确定性（无时间戳）。
 *
 * 用法：node scripts/build-diary-concepts.mjs
 */
import esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'prototypes', 'diary');

await esbuild.build({
  entryPoints: [path.join(DIR, 'concepts', 'concept-data.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'BZ_CONCEPT',
  outfile: path.join(DIR, 'concepts', 'concept-data.js'),
  target: 'es2018',
  charset: 'utf8',
  logLevel: 'warning',
  alias: {
    obsidian: path.join(DIR, 'fake', 'fake-obsidian.ts'),
  },
  banner: {
    js: '/* 构建产物（勿手改）：node scripts/build-diary-concepts.mjs — concepts/concept-data.ts（概念稿共享数据包，复用真解析链） */',
  },
});
console.log('✓ prototypes/diary/concepts/concept-data.js');
