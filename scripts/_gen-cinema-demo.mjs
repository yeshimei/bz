// scripts/_gen-cinema-demo.mjs — 影院域原型演示数据导出（真 vault → prototypes/cinema/prototype-data.js）
//
// 为什么要脚本：原型演示数据过去是手抄的，抄丢了字段（片长/季集/热门短评/上映日期全无），
// 于是「观影志」里凡是吃这些字段的幕只能对着空值画——手抄一次错一次。本脚本把 vault
// `我的/影视/*.md` 的 frontmatter 原样映射成插件 data.ts parseMovieFile 的同名字段，**零造数**：
// 库里有什么就写什么，字段缺失就留 null（演示数据与真实库同分布，图表才不是想象出来的）。
//
// 字段口径与 src/cinema/data.ts 的 parseMovieFile 一一对应（改那边记得改这边）；
// 海报写 vault 绝对 file:// 路径（与历史先例同款，双击原型即可加载真图）。
//
// 用法：node scripts/_gen-cinema-demo.mjs [--vault <vault 根>] [--limit N]
// 产物入库（prototype-data.js 同先例：保「双击原型零依赖」）。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** vault 根：默认取本机真实库；--vault 覆盖 */
function resolveVault() {
  const i = process.argv.indexOf("--vault");
  if (i > 0 && process.argv[i + 1]) return process.argv[i + 1];
  return "E:/Obsidian/叫我包仔";
}
const VAULT = resolveVault().replace(/\\/g, "/").replace(/\/$/, "");
const MOVIE_DIR = path.join(VAULT, "我的/影视");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) || 0 : 0;

/** frontmatter 行解析（子集：标量 + `- ` 列表 + 块标量 `|-`/`>` + 跨行引号标量；
 *  真库里有这两种写法：影评常写成 `|-` 诗行，豆瓣短评常是被引号包住的两行）。 */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const out = {};
  let listKey = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (listKey && /^\s*-\s+/.test(line)) {
      out[listKey].push(unquote(line.replace(/^\s*-\s+/, '').trim()));
      continue;
    }
    listKey = null;
    const kv = line.match(/^([^\s#][^:]*):(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    let val = kv[2].trim();

    // 块标量：`key: |-` 之后是缩进正文（逐行保留，诗行不被折成一行）
    if (/^[|>][-+]?$/.test(val)) {
      const fold = val.startsWith('>');
      const body = [];
      while (i + 1 < lines.length && (lines[i + 1].trim() === '' || /^[ \t]/.test(lines[i + 1]))) {
        body.push(lines[++i].replace(/^[ \t]{2}/, ''));
      }
      const text = body.join('\n').replace(/\n+$/, '');
      out[key] = fold ? text.replace(/\n/g, ' ') : text;
      continue;
    }
    // 跨行引号标量：本行以引号开头而未收尾 → 吃到收尾那一行（真库「热门短评」常见）
    if ((val.startsWith('"') && !/^"(?:[^"\\]|\\.)*"$/.test(val)) || (val.startsWith("'") && !/^'[^']*'$/.test(val))) {
      const quote = val[0];
      const parts = [val];
      while (i + 1 < lines.length && !parts[parts.length - 1].trimEnd().endsWith(quote)) parts.push(lines[++i]);
      val = parts.join('\n').trim();
    }
    if (!val) {
      out[key] = [];
      listKey = key;
      continue;
    }
    out[key] = unquote(val);
  }
  return out;
}

/** 剥 YAML 引号（"x" / 'x'）；引号未收尾的裸值（真库有：短评本身以引号开头）也去掉首字符 */
function unquote(v) {
  const s = String(v);
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.length > 1 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('"') || s.startsWith("'")) return s.slice(1);
  return s;
}

/** 海报路径 → file:// URL（逐段 encode，保留 `/` 与盘符的冒号） */
function fileUrl(rel) {
  const abs = `${VAULT}/${rel}`;
  return `file:///${abs.split("/").map((seg) => (/^[A-Za-z]:$/.test(seg) ? seg : encodeURIComponent(seg))).join("/")}`;
}

const ext = (p) => /[?#]/.test(p) ? null : (/\.md$/i.test(p) ? null : p);

const files = fs.readdirSync(MOVIE_DIR).filter((f) => f.endsWith(".md"));
files.sort((a, b) => a.localeCompare(b, "zh"));
const items = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(MOVIE_DIR, f), "utf8");
  const fm = parseFrontmatter(raw);
  if (!fm) continue;
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : fm.tags ? [String(fm.tags)] : [];
  if (!tags.length) continue;
  const name = f.replace(/\.md$/, "").replace(/^《/, "").replace(/》$/, "");
  const ratingRaw = fm["评分"];
  const rating = ratingRaw === undefined || ratingRaw === null || ratingRaw === "" ? null : Number(ratingRaw);
  const status = rating === -1 ? "想看" : rating === 0 ? "在看" : "已看";
  const posterRel = fm["海报"] ? String(fm["海报"]) : null;
  const release = fm["上映日期"] ? String(fm["上映日期"]) : null;
  items.push({
    name,
    typeTag: tags[0],
    group: tags[0],
    status,
    rating,
    watchDate: fm["观影日期"] ? String(fm["观影日期"]) : null,
    review: fm["影评"] ? String(fm["影评"]) : null,
    poster: posterRel && fs.existsSync(path.join(VAULT, posterRel)) ? fileUrl(posterRel) : null,
    genre: fm["类型"] ? String(fm["类型"]) : null,
    director: fm["导演"] ? String(fm["导演"]) : null,
    actors: fm["主演"] ? String(fm["主演"]) : null,
    region: fm["制片国家/地区"] ? String(fm["制片国家/地区"]) : null,
    year: release ? release.slice(0, 4) : null,
    releaseDate: release,
    doubanRating: fm["豆瓣评分"] !== undefined && fm["豆瓣评分"] !== "" ? String(fm["豆瓣评分"]) : null,
    doubanUrl: /^https?:\/\//.test(String(fm["豆瓣链接"] ?? "")) ? String(fm["豆瓣链接"]) : null,
    synopsis: fm["简介"] ? String(fm["简介"]) : null,
    duration: fm["片长"] ? String(fm["片长"]) : null,
    seasonText: fm["季集"] ? String(fm["季集"]) : null,
    hotComment: fm["热门短评"] ? String(fm["热门短评"]) : null,
  });
}

// 观影日期倒序（原型列表默认排序与插件同口径：最近的在前）
items.sort((a, b) => String(b.watchDate ?? "").localeCompare(String(a.watchDate ?? "")));
const out = LIMIT ? items.slice(0, LIMIT) : items;

const lines = [];
lines.push("// 影院域原型演示数据（prototype.html 专用，不进构建）。");
lines.push("// 由 scripts/_gen-cinema-demo.mjs 从真实 vault `我的/影视/*.md` 导出——**零造数**：");
lines.push("// 字段与 src/cinema/data.ts parseMovieFile 同名同义，含 片长 / 季集 / 热门短评 / 上映日期；");
lines.push("// 缺失即 null（库里没有就是没有）。海报为 vault 绝对 file:// 路径，双击原型即可加载真图。");
lines.push(`// 导出时间：${new Date().toISOString().slice(0, 10)} · 条目 ${out.length} / 库内 ${items.length}`);
lines.push("window.CINEMA_DATA = [");
lines.push(out.map((it) => "  " + JSON.stringify(it)).join(",\n"));
lines.push("];");
lines.push("");
const dest = path.join(ROOT, "prototypes", "cinema", "prototype-data.js");
fs.writeFileSync(dest, lines.join("\n"));

const withDuration = out.filter((it) => /\d/.test(String(it.duration ?? ""))).length;
console.log(`写出 ${path.relative(ROOT, dest)}：${out.length} 条（库内 ${items.length}）`);
console.log(`  有片长 ${withDuration} · 有季集 ${out.filter((it) => it.seasonText).length} · 有短评 ${out.filter((it) => it.hotComment).length} · 有影评 ${out.filter((it) => it.review).length}`);
