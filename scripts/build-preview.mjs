// scripts/build-preview.mjs — 域渲染纯层 → 评审壳预览包（issue 237/ADR-0104）
//
// 把 src/<域>/render.ts（零依赖 markup 单源）打成 IIFE 单文件
// prototypes/<域>/prototype-render.js，挂 window.BZR_<域>，供 prototype.html 壳脚本消费——
// 与插件 ui.ts 消费同一份 markup，改一处两侧生效。
// 评审工件统一收在根级 prototypes/<域>/（2026-09-09 决策）；域源码留 src/<域>/。
//
// - 产物提交入 git：保「双击原型零依赖」（prototype-icons.js/prototype-data.js 同款先例）；
// - 输出确定性（banner 静态、无时间戳），避免 git 状态噪音；
// - 本脚本只写 prototypes/** 与 src/**（重出产物），不触碰 vault 插件目录——可在 worktree 内安全执行
//   （esbuild.config.mjs 的主构建/部署仍按铁律只在主仓库跑）。
//
// 用法：node scripts/build-preview.mjs [域 ...]（无参 = 渲染清单全量；显式指定域时
//   该域仅在渲染清单内才产渲染包，属行为域（BEHAVIOR_DOMAINS）则同步重出行为包）。
// 新域接入：render.ts 落域后在这里加一行 + prototype.html 加 <script src="./prototype-render.js">。
// favorites 2026-09-09 摘出（试点）：行为单源后壳不再消费 BZR 渲染产物（prototype-render.js
//   退役），只留行为包重出；同款域可如法炮制。

import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 产物内嵌「源指纹」的标记行（测试端解析，见 tests/tools/preview-freshness.test.ts） */
export const INPUTS_MARK = "#preview-inputs=";

/**
 * 源指纹：只取**仓内**输入（src/**、prototypes/**，过滤 node_modules 与仓外路径），
 * 按路径排序后逐个 hash 内容。用途：判定「产物是否与该域当前源码同步」——
 * 产物是构建时快照且提交入 git，改了 src 忘重出会静默显示旧界面
 * （2026-09-10 实例：首页「回忆墙」退役 6 小时未同步，靠人眼发现）。
 * 过滤 node_modules / 仓外路径 → 跨机器、跨构建位置（worktree vs 主仓）结果一致。
 */
function sourceStamp(metafile) {
  const files = [];
  for (const p of Object.keys(metafile.inputs)) {
    const rel = path.relative(ROOT, path.resolve(p)).split(path.sep).join("/");
    if (!rel || rel.startsWith("..") || rel.includes("node_modules/")) continue;
    files.push(rel);
  }
  files.sort();
  const h = createHash("sha1");
  for (const rel of files) {
    h.update(rel);
    h.update("\0");
    let digest = "MISSING";
    try {
      digest = createHash("sha1").update(fs.readFileSync(path.join(ROOT, rel))).digest("hex");
    } catch {
      /* 读不到（刚删/权限）→ 记 MISSING，仍可稳定比较 */
    }
    h.update(digest);
    h.update("\n");
  }
  return { hash: h.digest("hex").slice(0, 16), files };
}

/**
 * 构建单个入口 → 写产物。统一三件事：
 *  1. write:false + metafile：先拿到输入清单，才能在 banner 里内嵌**本次**源指纹；
 *  2. absWorkingDir=ROOT：模块路径注释（`// node_modules/...`）与构建位置无关，
 *     否则在 worktree 构建会产出 `../../bz/node_modules/...` 的假差异；
 *  3. 产物头部两行注释：`源指纹 <hash>` + `#preview-inputs=[...]`，供新鲜度守卫比对。
 */
async function buildOne({ entry, outfile, globalName, banner, alias }) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    globalName,
    target: "es2018",
    charset: "utf8",
    logLevel: "warning",
    write: false,
    metafile: true,
    absWorkingDir: ROOT,
    ...(alias ? { alias } : {}),
    banner: { js: banner },
  });
  const stamp = sourceStamp(result.metafile);
  const head =
    `/* 源指纹 ${stamp.hash} · 仓内输入 ${stamp.files.length} 个（校验见 tests/preview-freshness.test.ts） */\n` +
    `/*${INPUTS_MARK}${JSON.stringify(stamp.files)}*/\n`;
  fs.writeFileSync(outfile, head + result.outputFiles[0].text, "utf8");
}

// settings-panel 2026-09-08 拍板维持行为单源（样式/渲染/行为一份源码两端共用）；
// 原型观感对齐以 35c4342 自足三件套为参照系——冲突在壳环境（core 链 vs 域内自绘）逐一调和，
// 不回退双轨。
export const PREVIEW_DOMAINS = ["belongings", "bookshelf", "cinema", "clipbook", "diary", "home", "memo", "password-vault", "pomodoro", "review", "secondbrain", "settings-panel"];

// 行为单源域（issue 245/ADR-0106 试点：belongings）：除渲染产物外，另产「行为产物」——
// 以 fake-sim.ts 为入口、alias obsidian→belongings/fake/fake-obsidian，把真 ui.ts
// 依赖链打进 prototype-behavior.js（挂 window.BZW_<域>），壳只调 openPanel 等。
// 新域接入：render.ts 落域 + fake-sim.ts 启动器就绪后在此登记。
// home 行为产物 ~1.7MB：river 静态+动态 import 闭包实测 218 模块（含 npm moment），首页永不执行的模块仅求值不调用
// settings-panel 行为产物 ~1.7MB：全域 schema 闭包整体内联（各域 schema 改动后需重出该域行为包）
// review 行为产物（issue 253）：quiz-core/app/fit/watch 闭包 + ⚙ 直达 settings-panel 内联；
//   出题 AI 走 fake requestUrl canned 回放（prompt 特征识别 → RVW.SEED.quizBank）
// knowledge 行为产物（issue 259）：真 ui.ts 依赖链 + fake requestUrl 罐头（术语生成/总结/领域判定）
// encrypt 行为产物（2026-09-12）：保险库域此前在原型侧缺席（只有 encrypt-lab 设计稿与
//   password-vault 壳），接入后 encrypt/styles.css + 三资产工作台 + 锁屏走行为单源；
//   该域无 render.ts（markup 全在 ui.ts 内拼），故只产行为包、不进 PREVIEW_DOMAINS。
export const BEHAVIOR_DOMAINS = ["belongings", "bookshelf", "cinema", "clipbook", "encrypt", "diary", "favorites", "home", "knowledge", "memo", "password-vault", "pomodoro", "review", "secondbrain", "settings-panel"];

export async function buildBehavior(domain) {
  const entry = path.join(ROOT, "prototypes", domain, "fake-sim.ts");
  if (!fs.existsSync(entry)) {
    throw new Error(`行为入口缺失：prototypes/${domain}/fake-sim.ts（清单见 BEHAVIOR_DOMAINS）`);
  }
  const globalName = `BZW_${domain.replace(/-/g, "_")}`;
  await buildOne({
    entry,
    outfile: path.join(ROOT, "prototypes", domain, "prototype-behavior.js"),
    globalName,
    alias: {
      // 浏览器无 obsidian：替换为公共假层（接口与真实现一致，见 prototypes/<域>/fake/fake-obsidian.ts）
      obsidian: path.join(ROOT, "prototypes", domain, "fake", "fake-obsidian.ts"),
    },
    banner: `/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/${domain}/fake-sim.ts → window.${globalName}（行为单源预览包，issue 245/ADR-0106） */`,
  });
  console.log(`✓ prototypes/${domain}/prototype-behavior.js ← fake-sim.ts（alias obsidian→fake）`);
}

export async function buildPreview(domains = PREVIEW_DOMAINS) {
  for (const d of domains) {
    const entry = path.join(ROOT, "src", d, "render.ts");
    if (!fs.existsSync(entry)) {
      throw new Error(`预览入口缺失：src/${d}/render.ts（清单见 PREVIEW_DOMAINS）`);
    }
    // 连字符域名的 globalName 须为合法标识符（settings-panel → BZR_settings_panel）
    const globalName = `BZR_${d.replace(/-/g, "_")}`;
    await buildOne({
      entry,
      outfile: path.join(ROOT, "prototypes", d, "prototype-render.js"),
      globalName,
      banner: `/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/${d}/render.ts → window.${globalName}（评审壳预览包，ADR-0104） */`,
    });
    console.log(`✓ prototypes/${d}/prototype-render.js ← src/${d}/render.ts`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("build-preview.mjs")) {
  const args = process.argv.slice(2);
  // 渲染产物仅渲染清单内产（favorites 已退役渲染产物，显式指定也只重出行为包）
  const targets = args.length ? args.filter((d) => PREVIEW_DOMAINS.includes(d)) : PREVIEW_DOMAINS;
  await buildPreview(targets);
  // 行为产物（试点域；显式指定域时同步构建其行为包）
  for (const d of BEHAVIOR_DOMAINS) {
    if (!args.length || args.includes(d)) await buildBehavior(d);
  }
}
