import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import { buildStyles, watchStyles } from "./scripts/build-css.mjs";
import { buildPreview, PREVIEW_DOMAINS } from "./scripts/build-preview.mjs";

const prod = process.argv[2] === "production";

// 构建产物直接输出到 vault 的插件目录（安装即用）
const VAULT_PLUGIN_DIR = "E:/Obsidian/叫我包仔/.obsidian/plugins/bz";
// 发布版 main.js 同步到仓库根目录（git 跟踪，README「手动安装」/ GitHub Release 以此为准）
const RELEASE_MAIN = path.join(process.cwd(), "main.js");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "os"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  charset: "utf8",
  outfile: path.join(VAULT_PLUGIN_DIR, "main.js"),
});

// 同步静态资源：manifest.json / styles.css
function copyStatic() {
  for (const file of ["manifest.json", "styles.css"]) {
    const src = path.join(process.cwd(), file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(VAULT_PLUGIN_DIR, file));
      console.log(`✓ copied ${file}`);
    }
  }
}

if (prod) {
  await context.rebuild();
  await buildPreview(); // ADR-0104：域渲染纯层 → prototype-render.js（评审壳预览包，提交入 git）
  buildStyles(); // 铁律 9：聚合 src/**/styles.css → 根 styles.css（并同步插件目录）
  copyStatic();
  // 发布版：main.js 由 vault 产物复制到仓库根目录（styles.css 已被 buildStyles 写到根目录）
  fs.copyFileSync(path.join(VAULT_PLUGIN_DIR, "main.js"), RELEASE_MAIN);
  console.log("✓ copied main.js → 仓库根目录（GitHub 发布版）");
  process.exit(0);
} else {
  await context.watch();
  await buildPreview();
  buildStyles();
  watchStyles(); // 监听 src/**/*.css 变化重新聚合（esbuild 只监听 TS 依赖图）
  watchPreview(); // 监听各域 render.ts 变化重出预览包（迭代轮改 markup 双击原型即见）
  copyStatic();
  console.log("watching for changes...");
}

/** 监听各域 render.ts（单源清单内）变化重出 prototype-render.js（同 watchStyles 模式；
 *  fs.watch 递归回调的 filename 相对监听目录，Windows 反斜杠统一归一） */
function watchPreview() {
  const srcDir = path.join(process.cwd(), "src");
  let timer = null;
  const hit = (norm) => PREVIEW_DOMAINS.some((d) => norm === `${d}/render.ts` || norm.endsWith(`/src/${d}/render.ts`));
  fs.watch(srcDir, { recursive: true }, (_event, filename) => {
    const norm = filename ? String(filename).replace(/\\/g, "/") : "";
    if (!norm || !hit(norm)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      buildPreview().catch((err) => console.error("✗ prototype-render.js rebuild failed:", err.message));
    }, 80);
  });
}
