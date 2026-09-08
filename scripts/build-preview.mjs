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

// settings-panel 2026-09-08 拍板维持行为单源（样式/渲染/行为一份源码两端共用）；
// 原型观感对齐以 35c4342 自足三件套为参照系——冲突在壳环境（core 链 vs 域内自绘）逐一调和，
// 不回退双轨。
export const PREVIEW_DOMAINS = ["belongings", "bookshelf", "cinema", "clipbook", "favorites", "home", "secondbrain", "settings-panel"];

// 行为单源域（issue 245/ADR-0106 试点：belongings）：除渲染产物外，另产「行为产物」——
// 以 fake-sim.ts 为入口、alias obsidian→belongings/fake/fake-obsidian，把真 ui.ts
// 依赖链打进 prototype-behavior.js（挂 window.BZW_<域>），壳只调 openPanel 等。
// 新域接入：render.ts 落域 + fake-sim.ts 启动器就绪后在此登记。
// home 行为产物 ~1.7MB：river 静态+动态 import 闭包实测 218 模块（含 npm moment），首页永不执行的模块仅求值不调用
// settings-panel 行为产物 ~1.7MB：全域 schema 闭包整体内联（各域 schema 改动后需重出该域行为包）
export const BEHAVIOR_DOMAINS = ["belongings", "bookshelf", "cinema", "clipbook", "favorites", "home", "secondbrain", "settings-panel"];

export async function buildBehavior(domain) {
  const entry = path.join(ROOT, "src", domain, "fake-sim.ts");
  if (!fs.existsSync(entry)) {
    throw new Error(`行为入口缺失：src/${domain}/fake-sim.ts（清单见 BEHAVIOR_DOMAINS）`);
  }
  const globalName = `BZW_${domain.replace(/-/g, "_")}`;
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName,
    outfile: path.join(ROOT, "src", domain, "prototype-behavior.js"),
    target: "es2018",
    charset: "utf8",
    logLevel: "warning",
    alias: {
      // 浏览器无 obsidian：替换为公共假层（接口与真实现一致，见 fake/fake-obsidian.ts）
      obsidian: path.join(ROOT, "src", domain, "fake", "fake-obsidian.ts"),
    },
    banner: {
      js: `/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/${domain}/fake-sim.ts → window.${globalName}（行为单源预览包，issue 245/ADR-0106） */`,
    },
  });
  console.log(`✓ src/${domain}/prototype-behavior.js ← fake-sim.ts（alias obsidian→fake）`);
}

export async function buildPreview(domains = PREVIEW_DOMAINS) {
  for (const d of domains) {
    const entry = path.join(ROOT, "src", d, "render.ts");
    if (!fs.existsSync(entry)) {
      throw new Error(`预览入口缺失：src/${d}/render.ts（清单见 PREVIEW_DOMAINS）`);
    }
    // 连字符域名的 globalName 须为合法标识符（settings-panel → BZR_settings_panel）
    const globalName = `BZR_${d.replace(/-/g, "_")}`;
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      globalName,
      outfile: path.join(ROOT, "src", d, "prototype-render.js"),
      target: "es2018",
      charset: "utf8",
      logLevel: "warning",
      banner: {
        js: `/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/${d}/render.ts → window.${globalName}（评审壳预览包，ADR-0104） */`,
      },
    });
    console.log(`✓ src/${d}/prototype-render.js ← render.ts`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("build-preview.mjs")) {
  const args = process.argv.slice(2);
  const targets = args.length ? args : PREVIEW_DOMAINS;
  await buildPreview(targets);
  // 行为产物（试点域；显式指定域时同步构建其行为包）
  for (const d of BEHAVIOR_DOMAINS) {
    if (!args.length || args.includes(d)) await buildBehavior(d);
  }
}
