/**
 * 打包值守进程的判据核心 —— `src/dock/watch-core.ts` → `tools/dock-watch/dock-core.cjs`（ADR-0242）。
 *
 * 值守进程（`dock-watch`）是个**插件进程之外**的 node 程序，跑不了 TS，也不该自己实现一份判据。
 * 这个脚本把本域那五个零依赖纯模块打成一个单文件 CJS，让它 `require` 过去 ——
 * **`ruleDue` 因此只有一份实现**（改判据只改 `src/dock/rules.ts`，值守件重打即可）。
 *
 * 为什么产物入 git：`tools/` 下的子包是要能单独拿出去用的（同 obsidian-face），
 * 拿不到仓库源码的人也得跑得起来。所以它是**生成物但跟踪**，与根 `main.js` / `changelog-data.ts`
 * 同性质 —— 一律别手改，改源码后重跑本脚本。
 *
 * 自检那一段是这套做法的守门人：一旦有人往 `watch-core.ts` 的导出面里塞了碰宿主 API 的模块，
 * 打包要么直接失败、要么产物里出现 `obsidian`，这里立刻拦下 —— 否则症状会推迟到用户机器上
 * 「值守进程一启动就崩」。
 */
import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 路径按**本文件**推，不看 cwd —— 它既会被 `node scripts/build-dock-watch.mjs` 直接跑，
// 也会被 esbuild.config.mjs 的 production 分支调用
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'tools', 'dock-watch');
const OUT_FILE = path.join(OUT_DIR, 'dock-core.cjs');
const VERSION_FILE = path.join(OUT_DIR, 'core-version.json');

/** 重出值守判据核心。产物入 git（生成物但跟踪，见文件头）。 */
export async function buildDockWatch() {
  const bzVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).version;

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'dock', 'watch-core.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: OUT_FILE,
    logLevel: 'info',
    charset: 'utf8',
    legalComments: 'none',
    banner: {
      js: '/* 生成物 —— 由 scripts/build-dock-watch.mjs 从 src/dock 打出（判据的唯一真理源在 src/dock/rules.ts）。勿手改。 */',
    },
  });

  // 产物里不该出现任何宿主 API —— 出现了就说明 watch-core.ts 的导出面被污染（见文件头）
  const text = fs.readFileSync(OUT_FILE, 'utf8');
  const leak = /require\(["']obsidian["']\)|from ["']obsidian["']/.exec(text);
  if (leak) {
    fs.rmSync(OUT_FILE, { force: true });
    throw new Error(
      `打包产物里出现了 obsidian（${leak[0]}）—— watch-core.ts 只许再导出零依赖纯模块，已删除产物`,
    );
  }

  // 值守件自身带上打包时的 bz 版本：面板据此提示「值守件比插件旧」（版本不同就是该重装了）
  fs.writeFileSync(VERSION_FILE, `${JSON.stringify({ bzVersion }, null, 2)}\n`, 'utf8');

  console.log(`✓ ${path.relative(ROOT, OUT_FILE).replace(/\\/g, '/')} ← src/dock/watch-core.ts（bz ${bzVersion}）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildDockWatch();
}
