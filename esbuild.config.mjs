import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import { buildStyles, watchStyles } from "./scripts/build-css.mjs";
import { buildDockWatch } from "./scripts/build-dock-watch.mjs";

// production = 发布构建（压缩、无 sourcemap、产出 dock-watch 判据核心）
// once = 一次性开发构建（不压缩、inline sourcemap，构建完即退出，供 dev-restart 用）
// 缺省 = watch 常驻（改动自动重出）
const mode = process.argv[2] === "production" ? "production" : process.argv[2] === "once" ? "once" : "watch";
const prod = mode === "production";

// 构建产物直接输出到 vault 的插件目录（安装即用）。
// BZ_VAULT_DIR 可覆盖落点（开发时指向测试库，如 E:/Obsidian/测试/.obsidian/plugins/bz），
// 缺省仍是主库 —— 发布七步依赖这个缺省值，别改。
const VAULT_PLUGIN_DIR =
  process.env.BZ_VAULT_DIR || "E:/Obsidian/叫我包仔/.obsidian/plugins/bz";
// 发布版 main.js 同步到仓库根目录（git 跟踪，README「手动安装」/ GitHub Release 以此为准）
const RELEASE_MAIN = path.join(process.cwd(), "main.js");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "os", "node:fs", "node:path"],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  charset: "utf8",
  // 开发旗标（ADR-0276）：仅 BZ_VAULT_DIR 指向测试库时注入 true——core/dev-flows 测试合集
  // 只在测试库构建里存在；false 时 if (__BZ_DEV__) 分支被摇树，发布版零残留。
  define: { __BZ_DEV__: prod ? "false" : process.env.BZ_VAULT_DIR ? "true" : "false" },
  // 赞赏码内置（src/core/assets/reward-code.png）：png import 直接变 data URI 字符串，
  // 不进 downloads/ 远端资产通道（图固定不变，68KB 换一次网络往返不值）。
  loader: { ".png": "dataurl" },
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

if (mode === "watch") {
  await context.watch();
  buildStyles();
  watchStyles(); // 监听 src/**/*.css 变化重新聚合（esbuild 只监听 TS 依赖图）
  copyStatic();
  console.log("watching for changes...");
} else {
  await context.rebuild();
  if (prod) {
    await buildDockWatch(); // ADR-0242：值守进程的判据核心（tools/dock-watch/dock-core.cjs，生成物入 git）
  }
  buildStyles(); // 铁律 9：聚合 src/**/styles.css → 根 styles.css（并同步插件目录）
  copyStatic();
  if (prod) {
    // 发布版：main.js 由 vault 产物复制到仓库根目录（styles.css 已被 buildStyles 写到根目录）
    fs.copyFileSync(path.join(VAULT_PLUGIN_DIR, "main.js"), RELEASE_MAIN);
    console.log("✓ copied main.js → 仓库根目录（GitHub 发布版）");
  }
  process.exit(0);
}
