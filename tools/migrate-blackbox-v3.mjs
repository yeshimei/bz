/**
 * 黑匣子 v2 → v3 一次性迁移脚本（用户决策 2026-08-12：插件 load 不再自动迁移；
 * 迁移由本脚本执行一次完成，之后黑匣子内容展示以笔记为主）。
 *
 * 读 CONFIG/STORAGE/blackbox.json（v2 entries）→ 逐条写为独立笔记：
 *   - 概念 → `黑匣子/概念/<分类>/<概念名>.md`（有 category 时落分类子文件夹，无则平铺）
 *   - 摘抄 → `黑匣子/摘抄/<标题>.md`（标题 = 正文前 20 字去空白，迁移不调 AI）
 *   - 想法 → `黑匣子/想法/<标题>.md`
 * frontmatter（id/type/createdAt + 感触外壳 + toward/links 兼容 + 卡片盒可选字段）+ 正文 + 关联区双链。
 * 幂等：笔记已存在（frontmatter id 匹配）→ 跳过只登记索引；同名 `-N` 去重兜底；可安全重跑。
 * 完成后 blackbox.json 写 v3（派生层 + id→路径 index，entries 段删除；失败残留保留下次重跑）。
 * 写前自动备份原文件（.bak-<时间戳>）。
 *
 * 用法：node tools/migrate-blackbox-v3.mjs
 * 注意：执行前先退出 Obsidian（避免插件运行时写回覆盖）；Syncthing 多设备同步时先在单设备完成迁移。
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = 'E:/Obsidian/叫我包仔';
const STORAGE = path.join(VAULT, 'CONFIG/STORAGE');
const BB_FILE = path.join(STORAGE, 'blackbox.json');
const NOTE_ROOT = '黑匣子';
const TYPE_DIR = { concept: '概念', literature: '摘抄', thought: '想法' };

// ---------------- 复刻 src/blackbox/notes.ts 纯函数 ----------------

function sanitizeFileName(name) {
  const cleaned = String(name || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || '未命名';
}

function entryNoteTitle(entry) {
  if (entry.type === 'concept') return sanitizeFileName(entry.name || '');
  if (entry.title && entry.title.trim()) return sanitizeFileName(entry.title.trim());
  const text = (entry.text || '').replace(/\s+/g, ' ').trim();
  return sanitizeFileName(text.slice(0, 20));
}

function notePathOf(type, title, category) {
  const cat = type === 'concept' && category && category.trim() ? sanitizeFileName(category.trim()) + '/' : '';
  return `${NOTE_ROOT}/${TYPE_DIR[type]}/${cat}${sanitizeFileName(title)}.md`;
}

function quoteScalar(v) {
  if (/^[A-Za-z0-9_\-\u4e00-\u9fa5]+$/.test(v)) return v;
  return `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function fmList(key, list) {
  const arr = Array.isArray(list) ? list.filter((x) => typeof x === 'string' && !!x.trim()) : [];
  if (!arr.length) return [];
  return [`${key}:`, ...arr.map((x) => `  - ${x.trim()}`)];
}

function fmScalar(key, value) {
  if (typeof value !== 'string' || !value) return [];
  return [`${key}: ${quoteScalar(value)}`];
}

function buildNoteContent(entry, nameForId) {
  const fm = ['---'];
  fm.push(`id: ${entry.id}`);
  fm.push(`type: ${entry.type}`);
  fm.push(`createdAt: ${quoteScalar(entry.createdAt || new Date().toISOString())}`);
  // 概念名/文献想法标题写进 frontmatter（文件名只是载体：避免「名含 -数字」被去重后缀剥离，如 LK-99）
  if (entry.type === 'concept') {
    if (entry.name) fm.push(`name: ${quoteScalar(entry.name.trim())}`);
  } else if (entry.title) {
    fm.push(`title: ${quoteScalar(entry.title.trim())}`);
  }
  if (entry.emotions && entry.emotions.length) fm.push(...fmList('emotions', entry.emotions.slice(0, 3)));
  if (entry.people && entry.people.length) fm.push(...fmList('people', entry.people.slice(0, 5)));
  if (entry.scene) fm.push(...fmScalar('scene', entry.scene));
  if (entry.toward) fm.push(`toward: ${entry.toward}`);
  if (entry.links && entry.links.length) fm.push(...fmList('links', entry.links));
  if (entry.type === 'literature' && entry.source) fm.push(...fmScalar('source', entry.source));
  // 关联双链完整落盘 frontmatter（正文关联区被手动修改/误删不丢数据）：related/terms/from/pendingLinks
  const relIds = entry.type === 'concept' ? entry.related || [] : entry.type === 'literature' ? entry.terms || [] : [];
  const relNames = relIds
    .map(nameForId)
    .filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i);
  if (entry.type === 'concept' && relNames.length) fm.push(...fmList('related', relNames));
  if (entry.type === 'literature' && relNames.length) fm.push(...fmList('terms', relNames));
  if (entry.type === 'thought' && entry.from) {
    const fromName = nameForId(entry.from);
    if (fromName) fm.push(...fmScalar('from', fromName));
  }
  if (entry.pendingLinks && entry.pendingLinks.length) fm.push(...fmList('pendingLinks', entry.pendingLinks));
  if (entry.category) fm.push(...fmScalar('category', entry.category));
  if (entry.tags && entry.tags.length) fm.push(...fmList('tags', entry.tags));
  if (entry.summary) fm.push(...fmScalar('summary', entry.summary));
  fm.push('---');

  const body = [];
  const rel = [];
  if (entry.type === 'concept') {
    if (entry.definition) body.push(entry.definition.replace(/\s+$/, ''));
    const names = [...(entry.related || []).map(nameForId), ...(entry.pendingLinks || [])]
      .filter(Boolean)
      .filter((n, i, a) => a.indexOf(n) === i);
    if (names.length) rel.push(`- 关联：${names.map((n) => `[[${n}]]`).join(' ')}`);
  } else if (entry.type === 'literature') {
    if (entry.text) body.push(entry.text.replace(/\s+$/, ''));
    const src = (entry.source || '').trim();
    if (src) rel.push(`来源：${src}`);
    const names = [...(entry.terms || []).map(nameForId), ...(entry.pendingLinks || [])]
      .filter(Boolean)
      .filter((n, i, a) => a.indexOf(n) === i);
    if (names.length) rel.push(`关联概念：${names.map((n) => `[[${n}]]`).join(' ')}`);
  } else {
    if (entry.text) body.push(entry.text.replace(/\s+$/, ''));
    if (entry.from) {
      const fromName = nameForId(entry.from);
      if (fromName) rel.push(`来自：[[${fromName}]]`);
    }
  }
  const textBlock = body.join('\n\n');
  return fm.join('\n') + '\n' + (textBlock ? textBlock + '\n\n' : '\n') + (rel.length ? rel.join('\n') + '\n' : '');
}

// ---------------- 主流程 ----------------

function main() {
  if (!fs.existsSync(BB_FILE)) {
    console.log('blackbox.json 不存在，无需迁移');
    return;
  }
  const raw = JSON.parse(fs.readFileSync(BB_FILE, 'utf8'));
  let entries = Array.isArray(raw.entries) ? raw.entries : [];
  let fromBackup = false;
  if (!entries.length) {
    // 主文件已 v3（无 entries）：从最新备份取 entries，仅用于为既有笔记补 name/title 字段
    const baks = fs
      .readdirSync(STORAGE)
      .filter((n) => n.startsWith('blackbox.bak-') && n.endsWith('.json'))
      .sort();
    if (baks.length) {
      const b = JSON.parse(fs.readFileSync(path.join(STORAGE, baks[baks.length - 1]), 'utf8'));
      entries = Array.isArray(b.entries) ? b.entries : [];
      if (entries.length) {
        fromBackup = true;
        console.log('主文件已 v3（entries 空），从备份读取 entries 补字段:', baks[baks.length - 1]);
      }
    }
  }
  if (!entries.length) {
    console.log('没有需要迁移的旧数据（entries 为空，也无备份）');
    return;
  }

  // 幂等：扫描既有黑匣子笔记的 frontmatter id
  const existingById = new Map();
  if (fs.existsSync(path.join(VAULT, NOTE_ROOT))) {
    for (const type of Object.values(TYPE_DIR)) {
      const dir = path.join(VAULT, NOTE_ROOT, type);
      if (!fs.existsSync(dir)) continue;
      const walk = (d) => {
        for (const n of fs.readdirSync(d)) {
          const p = path.join(d, n);
          if (fs.statSync(p).isDirectory()) {
            walk(p);
            continue;
          }
          if (!n.endsWith('.md')) continue;
          const content = fs.readFileSync(p, 'utf8');
          const m = content.match(/^---\n[\s\S]*?\n---/);
          if (!m) continue;
          const idM = m[0].match(/^id:\s*(\S+)/m);
          if (idM && !existingById.has(idM[1])) existingById.set(idM[1], p);
        }
      };
      walk(dir);
    }
  }
  console.log(`既有黑匣子笔记：${existingById.size} 篇（幂等跳过用）`);

  // id → 概念名（related/terms 解析为 [[名]]）
  const nameById = new Map();
  for (const e of entries) {
    if (e.type === 'concept' && e.name) nameById.set(e.id, e.name.trim());
    else if (e.type !== 'concept') nameById.set(e.id, entryNoteTitle(e));
  }

  const index = {};
  const residual = [];
  let written = 0;
  let rewritten = 0;
  let skipped = 0;
  const mkdirp = (d) => {
    if (fs.existsSync(d)) return;
    mkdirp(path.dirname(d));
    fs.mkdirSync(d);
  };
  const uniquePath = (base) => {
    let p = base;
    let n = 1;
    while (fs.existsSync(path.join(VAULT, p))) {
      p = base.replace(/\.md$/, `-${n}.md`);
      n += 1;
    }
    return p;
  };

  for (const entry of entries) {
    try {
      if (index[entry.id] || existingById.has(entry.id)) {
        const rel = existingById.has(entry.id)
          ? path.relative(VAULT, existingById.get(entry.id)).replace(/\\/g, '/')
          : index[entry.id];
        // 幂等：已存在 → 只登记索引；缺 name/title 字段的笔记（首版脚本产物）重写补字段
        const abs = path.join(VAULT, rel);
        if (fs.existsSync(abs)) {
          const content = fs.readFileSync(abs, 'utf8');
          const need = entry.type === 'concept' ? '\nname:' : '\ntitle:';
          if (!content.includes(need)) {
            fs.writeFileSync(abs, buildNoteContent(entry, (id) => nameById.get(id)), 'utf8');
            rewritten += 1;
          }
        }
        index[entry.id] = rel;
        skipped += 1;
        continue;
      }
      const relPath = uniquePath(notePathOf(entry.type, entryNoteTitle(entry), entry.category));
      const absPath = path.join(VAULT, relPath);
      mkdirp(path.dirname(absPath));
      const content = buildNoteContent(entry, (id) => nameById.get(id));
      fs.writeFileSync(absPath, content, 'utf8');
      index[entry.id] = relPath;
      written += 1;
    } catch (e) {
      console.warn(`失败（保留重试）: ${entry.id} ${entry.name || entry.text ? (entry.text || '').slice(0, 20) : ''} — ${e.message}`);
      residual.push(entry);
    }
  }

  // 写 v3：派生层 + index（entries 段：失败残留保留）
  const v3 = {
    version: 3,
    settings: raw.settings || {},
    persona: raw.persona || {},
    profiles: Array.isArray(raw.profiles) ? raw.profiles : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    chat: Array.isArray(raw.chat) ? raw.chat : [],
    meta: {
      lastReviewAt: raw.meta && typeof raw.meta.lastReviewAt === 'string' ? raw.meta.lastReviewAt : '',
      totalEntries: Object.keys(index).length + residual.length,
      totalEvents: raw.meta && typeof raw.meta.totalEvents === 'number' ? raw.meta.totalEvents : 0,
    },
    index,
  };
  if (residual.length) v3.entries = residual;
  fs.writeFileSync(BB_FILE, JSON.stringify(v3, null, 2), 'utf8');

  console.log('----------------------------------------');
  console.log(`迁移完成：写入 ${written} 篇，补字段 ${rewritten} 篇，跳过 ${skipped} 篇（已存在），失败 ${residual.length} 条（保留下次重跑）`);
  console.log(`blackbox.json → v3（index ${Object.keys(index).length} 键）`);
  if (residual.length) console.log('重跑本脚本即可重试失败条目：node tools/migrate-blackbox-v3.mjs');
}

main();
