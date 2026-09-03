// scripts/build-css.mjs — 铁律 9：样式按域拆分，构建时聚合成根 styles.css
//
// 源文件布局：
//   src/core/styles.css   共享层/跨域样式（设置页分页、主窗口头部行统一规范、
//                         core 层 notice/settings-modal/confirm/dom、移动端全屏、
//                         统一右键菜单/长按抽屉）
//   src/<域>/styles.css   各域样式（diary/launcher/memo/todo/clipbook/password/
//                         favorites/review/quiz/pomodoro/library/attach/encrypt/movie）
//
// 根 styles.css 是构建聚合产物（Obsidian 每插件只加载这一个 styles.css），
// 请勿手改；改对应的源文件后 npm run dev / npm run build 重新生成。
//
// 拼接顺序 = 原 styles.css 的文档顺序（共享节前置，域间相对次序保持不变，
// 级联行为与拆分前一致；跨节选择器经审计均为 !important 支配或互不冲突的复合选择器）。
// 顺序说明：vendor/normalize.css（官方全局 reset）置顶 → 共享层 → 各域样式。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 与主构建一致的产物目录（esbuild.config.mjs 硬编码约定）
const PLUGIN_DIR = "E:/Obsidian/叫我包仔/.obsidian/plugins/bz";

// 聚合顺序清单（勿随意调整；新增域样式文件时在对应位置插入）
const SOURCES = [
  "src/core/vendor/normalize.css",
  "src/core/styles.css",
  // bz 组件库（自绘 token + 组件样式，源顺序在 core 之后保证可覆盖旧基线）
  "src/core/ui/tokens.css",
  "src/core/ui/components.css",
  "src/diary/styles.css",
  "src/diary-wall/styles.css",
  "src/launcher/styles.css",
  "src/home/styles.css",
  "src/memo/styles.css",
  "src/todo/styles.css",
  "src/clipbook/styles.css",
  "src/password/styles.css",
  "src/password-vault/styles.css",
  "src/favorites/styles.css",
  "src/review/styles.css",
  "src/pomodoro/styles.css",
  "src/library/styles.css",
  "src/attach/styles.css",
  "src/encrypt/styles.css",
  "src/settings-panel/styles.css",
  "src/belongings/styles.css",
  "src/movie/styles.css",
  "src/cinema/styles.css",
  "src/bookshelf/styles.css",
  "src/literature/styles.css",
  "src/secondbrain/styles.css",
  "src/smartcat/styles.css",
];

const HEADER = [
  "/* ============================================================",
  " * bz（包仔）— 由 QuickAdd 脚本独立化而来",
  " * 样式按域拆分（铁律 9）：本文件是构建聚合产物，请勿手改——",
  " *   共享样式 → src/core/styles.css；各域样式 → src/<域>/styles.css",
  " * 重新生成：npm run dev / npm run build（scripts/build-css.mjs）",
  " * ============================================================ */",
  "",
].join("\r\n");

export function buildStyles() {
  const parts = [HEADER];
  for (const rel of SOURCES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      throw new Error(`样式源缺失：${rel}（聚合清单见 scripts/build-css.mjs SOURCES）`);
    }
// 行尾统一 CRLF：与仓库工作区惯例一致，避免混合行尾造成 git 状态假差异
    let text = fs.readFileSync(file, "utf8").replace(/\r?\n/g, "\r\n");
    if (!text.endsWith("\n")) text += "\r\n";
    parts.push(text);
  }
  const css = parts.join("");
  fs.writeFileSync(path.join(ROOT, "styles.css"), css, "utf8");
  if (fs.existsSync(PLUGIN_DIR)) {
    fs.copyFileSync(path.join(ROOT, "styles.css"), path.join(PLUGIN_DIR, "styles.css"));
  }
  return css.length;
}

export function watchStyles(onChange) {
  const srcDir = path.join(ROOT, "src");
  let timer = null;
  const watcher = fs.watch(srcDir, { recursive: true }, (_event, filename) => {
    if (!filename || !String(filename).endsWith(".css")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const size = buildStyles();
        console.log(`✓ styles.css rebuilt from src/**/styles.css (${size} bytes)`);
        if (onChange) onChange();
      } catch (err) {
        console.error("✗ styles.css rebuild failed:", err.message);
      }
    }, 50);
  });
  return watcher;
}

if (process.argv[1] && process.argv[1].endsWith("build-css.mjs")) {
  const size = buildStyles();
  console.log(`✓ styles.css aggregated (${size} bytes)`);
}