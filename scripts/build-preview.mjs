// scripts/build-preview.mjs — 域渲染纯层 → 评审壳预览包（issue 237/ADR-0104）
//
// 把 src/<域>/render.ts（零依赖 markup 单源）打成 IIFE 单文件
// src/<域>/prototype-render.js，挂 window.BZR_<域>，供 prototype.html 壳脚本消费——
// 与插件 ui.ts 消费同一份 markup，改一处两侧生效。
//
// - 产物提交入 git：保「双击原型零依赖」（prototype-icons.js/prototype-data.js 同款先例）；
// - 输出确定性（banner 静态、无时间戳），避免 git 状态噪音；
// - 本脚本只写 src/**，不触碰 vault 插件目录——可在 worktree 内安全执行
//   （esbuild.config.mjs 的主构建/部署仍按铁律只在主仓库跑）。
//
// 用法：node scripts/build-preview.mjs [域 ...]（无参 = 全量清单）。
// 新域接入：render.ts 落域后在这里加一行 + prototype.html 加 <script src="./prototype-render.js">。

import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 单源域清单（belongings 试点；bookshelf、home 已接入（issue 243）。
 *  与 tests/core/render-purity.test.ts 守卫同一份清单，勿在测试里另抄） */
export const PREVIEW_DOMAINS = ["belongings", "bookshelf", "home"];

export async function buildPreview(domains = PREVIEW_DOMAINS) {
  for (const d of domains) {
    const entry = path.join(ROOT, "src", d, "render.ts");
    if (!fs.existsSync(entry)) {
      throw new Error(`预览入口缺失：src/${d}/render.ts（清单见 PREVIEW_DOMAINS）`);
    }
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      globalName: `BZR_${d}`,
      outfile: path.join(ROOT, "src", d, "prototype-render.js"),
      target: "es2018",
      charset: "utf8",
      logLevel: "warning",
      banner: {
        js: `/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/${d}/render.ts → window.BZR_${d}（评审壳预览包，ADR-0104） */`,
      },
    });
    console.log(`✓ src/${d}/prototype-render.js ← render.ts`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("build-preview.mjs")) {
  const args = process.argv.slice(2);
  await buildPreview(args.length ? args : PREVIEW_DOMAINS);
}
