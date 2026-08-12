/**
 * 黑匣子概念 AI 重分类（用户需求 2026-08-12：规则分类不准，改为 AI 按卡片内容分类）。
 *
 * 阶段一（默认）：读 `黑匣子/概念/` 下全部 .md，把每张卡片的名称+定义分批发给 AI
 *   （插件 data.json 里的 opencode-go 配置），AI 从 16 类候选中选类，
 *   结果落盘 `tools/ai-reclassify-result.json`（{相对路径: 分类}），不改动 vault。
 * 阶段二（--apply）：按结果移动文件到 `黑匣子/概念/<分类>/<名>.md` + 改 frontmatter
 *   category + 更新 blackbox.json index。写前备份 blackbox.json 与结果文件。幂等可重跑。
 *
 * 用法：
 *   node tools/reclassify-blackbox-ai.mjs            # 只分类（AI 调用，结果落盘）
 *   node tools/reclassify-blackbox-ai.mjs --apply    # 应用结果（移动+改 fm+改 index）
 * 前置：Obsidian 未运行（防旧插件内存写回覆盖）；脚本从 data.json 读 AI key，不硬编码。
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = 'E:/Obsidian/叫我包仔';
const CONCEPT_DIR = path.join(VAULT, '黑匣子', '概念');
const BB_FILE = path.join(VAULT, 'CONFIG/STORAGE/blackbox.json');
const PLUGIN_DATA = path.join(VAULT, '.obsidian/plugins/bz/data.json');
const RESULT_FILE = path.join(import.meta.dirname, 'ai-reclassify-result.json');

const CATEGORIES = ['医学', '心理学', '哲学', '文学', '历史', '地理', '科学', '宗教', '计算机', '艺术', '社会', '饮食', '音乐', '影视', '体育', '未分类'];
const BATCH = 100; // 每批篇数（正文均长 ~150 字，100 篇 ≈ 10K tokens 输入；max_tokens 8192 防截断）
const RETRIES = 2; // 每批失败重试次数
const SMOKE = parseInt(process.env.SMOKE || '0', 10); // 调试：只跑前 N 篇

/* ---------------- 工具 ---------------- */

function readJSON(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}
function backup(p) {
  if (!fs.existsSync(p)) return null;
  const ts = Date.now();
  const bak = p.replace(/\.json$/, `.bak-${ts}.json`);
  fs.copyFileSync(p, bak);
  return bak;
}

/** 解析 frontmatter → {fm, body, raw}（fm 值为 string 或 string[]；raw 保留原文行） */
function splitNote(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: raw, raw, lines: [] };
  const fm = {};
  const lines = m[1].split('\n');
  let cur = null;
  for (const line of lines) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      cur = kv[1];
      fm[cur] = kv[2].trim().replace(/^["']|["']$/g, '');
    } else if (line.startsWith('  - ') && cur) {
      fm[cur] = Array.isArray(fm[cur]) ? [...fm[cur], line.slice(4).trim()] : [fm[cur], line.slice(4).trim()];
    }
  }
  return { fm, body: m[2].trim(), raw, lines };
}

/** 相对 vault 路径（index 用的形态） */
function relOf(abs) { return path.relative(VAULT, abs).split(path.sep).join('/'); }
function absOf(rel) { return path.join(VAULT, ...rel.split('/')); }

function listConcepts() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  };
  walk(CONCEPT_DIR);
  return out.sort();
}

/* ---------------- 阶段一：AI 分类 ---------------- */

function getAPI() {
  const cfg = readJSON(PLUGIN_DATA, {});
  const apiKey = cfg.opencodeGoApiKey || '';
  if (!apiKey) throw new Error('data.json 里没有 opencodeGoApiKey（插件设置 → AI 配置）');
  return { endpoint: 'https://opencode.ai/zen/go/v1', apiKey, model: 'deepseek-v4-flash' };
}

function buildPrompt(items) {
  const rows = items
    .map((it, i) => `${i + 1}. ${it.name}${it.category ? `（当前分类：${it.category}）` : ''}：${it.body}`)
    .join('\n');
  const sys = `你是中文百科分类专家。为每张概念卡片选择一个最合适的分类，只能从这 ${CATEGORIES.length} 类中选：\n${CATEGORIES.join('、')}\n\n判断要点：\n- 医学：疾病/治疗/药物/人体生理\n- 心理学：心理/情绪/认知/人格/行为\n- 哲学：思想/伦理/存在/主义/逻辑\n- 文学：作品/作家/文体/修辞\n- 历史：朝代/人物/事件/考古/历法\n- 地理：山川/气候/植物/动物/地名\n- 科学：物理/化学/数学/天文/生物/技术原理\n- 宗教：宗教/信仰/神话/教派\n- 计算机：软件/硬件/算法/网络/编程\n- 艺术：绘画/建筑/美学/设计（纯音乐/影视体裁请分别归入音乐/影视）\n- 社会：经济/政治/法律/文化/教育/组织\n- 饮食：食材/菜品/烹饪/饮品\n- 音乐：乐曲/乐器/音乐体裁/音乐家\n- 影视：电影/剧集/导演/演员\n- 体育：运动项目/运动员/赛事\n- 未分类：以上都不合适\n\n严格只输出一个 JSON 对象，键为输入编号（如 "1"），值为分类名，不要输出任何其他文字。`;
  return { sys, user: rows };
}

async function aiClassifyBatch(api, items) {
  const { sys, user } = buildPrompt(items);
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * attempt));
    try {
      const res = await fetch(`${api.endpoint}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.apiKey}` },
        body: JSON.stringify({
          model: api.model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
          ],
          temperature: 0.1,
          max_tokens: 8192,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('响应不是 JSON：' + content.slice(0, 120));
      const parsed = JSON.parse(m[0]);
      const out = {};
      for (const [k, v] of Object.entries(parsed)) {
        const idx = parseInt(k, 10) - 1;
        if (idx >= 0 && idx < items.length) out[items[idx].rel] = CATEGORIES.includes(v) ? v : '未分类';
      }
      if (Object.keys(out).length < items.length) throw new Error(`只回 ${Object.keys(out).length}/${items.length} 条`);
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`批次失败：${lastErr.message}`);
}

async function classifyAll() {
  const api = getAPI();
  const notes = listConcepts().map((p) => {
    const { fm, body } = splitNote(p);
    return { rel: relOf(p), name: fm.name || path.basename(p, '.md'), category: fm.category || '', body: body.slice(0, 400) };
  });
  const limited = SMOKE ? notes.slice(0, SMOKE) : notes;
  const total = limited.length;
  console.log(`概念笔记: ${notes.length} 篇${SMOKE ? `（SMOKE 只跑前 ${SMOKE}）` : ''}，分 ${Math.ceil(total / BATCH)} 批（每批 ${BATCH} 篇，模型 ${api.model}）`);

  const result = {};
  const failed = [];
  // 补跑：失败批次单独再试（最多 2 轮），成功并入结果
  let pending = [...Array(Math.ceil(total / BATCH)).keys()].map((k) => limited.slice(k * BATCH, (k + 1) * BATCH));
  let round = 0;
  while (pending.length && round <= 2) {
    const next = [];
    for (const items of pending) {
      const tag = `[补跑${round ? ` ${round}` : ''}]`;
      try {
        const out = await aiClassifyBatch(api, items);
        Object.assign(result, out);
        const dist = {};
        for (const v of Object.values(out)) dist[v] = (dist[v] || 0) + 1;
        console.log(`${tag} 完成 ${Object.keys(out).length} 篇：` + Object.entries(dist).map(([k, v]) => `${k} ${v}`).join(' '));
      } catch (e) {
        next.push(items);
        console.error(`${tag} 失败：${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    pending = next;
    round += 1;
  }
  for (const items of pending) failed.push({ items: items.map((x) => x.rel) });

  if (Object.keys(result).length) {
    const bak = backup(RESULT_FILE);
    if (bak) console.log(`旧结果已备份 → ${path.basename(bak)}`);
    writeJSON(RESULT_FILE, { ts: new Date().toISOString(), categories: CATEGORIES, result, failed });
  }
  console.log(`\n结果：成功 ${Object.keys(result).length}/${notes.length} 篇 → ${RESULT_FILE}`);
  if (failed.length) console.log(`失败批次 ${failed.length} 个，重跑脚本只补未覆盖部分（已成功的会跳过？不会——重跑会全量再来，失败批次建议单独排查）`);
  const unc = Object.values(result).filter((v) => v === '未分类').length;
  console.log(`未分类：${unc} 篇`);
  if (unc) {
    console.log('未分类名单：');
    for (const [rel, v] of Object.entries(result)) if (v === '未分类') console.log('  ' + rel);
  }
}

/* ---------------- 阶段二：应用结果 ---------------- */

function applyResult() {
  const res = readJSON(RESULT_FILE, null);
  if (!res || !res.result || !Object.keys(res.result).length) throw new Error(`没有可用结果：${RESULT_FILE}`);
  const map = res.result;
  // 候选类以结果文件为准（AI 重分类后可能新增类，如「游戏」）
  const cats = Array.isArray(res.categories) && res.categories.length ? res.categories : CATEGORIES;

  const bbBak = backup(BB_FILE);
  console.log(`blackbox.json 已备份 → ${path.basename(bbBak)}`);
  const bb = readJSON(BB_FILE, {});
  const index = bb.index || {};

  let moved = 0, same = 0, fail = 0, fixed = 0;
  for (const [rel, cat] of Object.entries(map)) {
    if (!cats.includes(cat)) { console.error(`非法分类「${cat}」→ 跳过 ${rel}`); fail++; continue; }
    const abs = absOf(rel);
    if (!fs.existsSync(abs)) { console.error(`笔记不存在 → 跳过 ${rel}`); fail++; continue; }
    const { fm, lines, body } = splitNote(abs);
    const targetDir = cat === '未分类' ? CONCEPT_DIR : path.join(CONCEPT_DIR, cat);
    const base = path.basename(rel);
    let target = path.join(targetDir, base);
    const curRel = relOf(abs);
    const sameCat = curRel.startsWith(`黑匣子/概念/${cat}/`) || (cat === '未分类' && path.dirname(abs) === CONCEPT_DIR);

    // 更新 frontmatter category（fm 权威同步）
    const inFm = lines.some((l) => /^category:/.test(l));
    let fmText;
    if (inFm) {
      fmText = lines.map((l) => (/^category:/.test(l) ? `category: "${cat}"` : l)).join('\n');
    } else {
      // 插到 name/title 行后（fm 体首块）
      const insertAt = lines.findIndex((l) => /^(name|title):/.test(l));
      const idx = insertAt >= 0 ? insertAt + 1 : 1;
      lines.splice(idx, 0, `category: "${cat}"`);
      fmText = lines.join('\n');
    }
    const newContent = `---\n${fmText}\n---\n${body}\n`;
    const changedFm = newContent !== fs.readFileSync(abs, 'utf8');

    // 移动（同名冲突 -N，但目标==自身不动）
    if (sameCat) {
      if (changedFm) { fs.writeFileSync(abs, newContent, 'utf8'); fixed++; }
      same++;
      continue;
    }
    let n = 1;
    const baseStem = base.replace(/\.md$/, '');
    while (fs.existsSync(target)) {
      const conflict = `${targetDir}/${baseStem}-${n}.md`;
      if (!fs.existsSync(conflict)) { target = conflict; break; }
      n++;
    }
    try {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.renameSync(abs, target);
      fs.writeFileSync(target, newContent, 'utf8');
      moved++;
    } catch (e) {
      console.error(`移动失败 ${rel} → ${relOf(target)}：${e.message}`);
      fail++;
      continue;
    }
    // 更新 index
    for (const [id, p] of Object.entries(index)) {
      if (p === rel || p === curRel) index[id] = relOf(target);
    }
  }
  writeJSON(BB_FILE, { ...bb, index });
  console.log(`\n应用完成：移动 ${moved}，同分类原地 ${same}（其中 fm 补 category ${fixed}），失败 ${fail}`);
}

/* ---------------- main ---------------- */

const APPLY = process.argv.includes('--apply');
if (APPLY) {
  applyResult();
} else {
  classifyAll().catch((e) => { console.error('分类失败：', e.message); process.exit(1); });
}
