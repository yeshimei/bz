import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import { buildStyles, watchStyles } from "./scripts/build-css.mjs";

const prod = process.argv[2] === "production";

// 构建产物直接输出到 vault 的插件目录（安装即用）
const VAULT_PLUGIN_DIR = "E:/Obsidian/叫我包仔/.obsidian/plugins/bz";

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*"],
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
  buildStyles(); // 铁律 9：聚合 src/**/styles.css → 根 styles.css（并同步插件目录）
  copyStatic();
  process.exit(0);
} else {
  await context.watch();
  buildStyles();
  watchStyles(); // 监听 src/**/*.css 变化重新聚合（esbuild 只监听 TS 依赖图）
  copyStatic();
  console.log("watching for changes...");
}
