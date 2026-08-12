/**
 * 黑匣子旧条目修复（一次性工具，2026-08-11）：
 * 历史导入（插件导入弹窗未勾选 AI 总结 / AI 失败降级原文）把卡片原文（含 YAML frontmatter、
 * 一级标题等）写进了 blackbox.json 的 concept.definition。本工具把这些条目按「标题 → AI 生成」
 * 重新生成百科式定义并覆盖，只替换 definition 字段（id/related/createdAt/name/summary 均保留）。
 * 判定标准：definition 含 YAML/一级标题特征，或与卡片盒原文（去 frontmatter）高度重合。
 * 写前备份 blackbox.json；AI 重写失败的条目保持原样并打印（可重跑）。
 * 用法：node tools/rewrite-blackbox-legacy.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const VAULT = 'E:/Obsidian/叫我包仔';
const CARDBOX_FOLDER = path.join(VAULT, '卡片盒');
const STORAGE = path.join(VAULT, 'CONFIG/STORAGE');
const BB_FILE = path.join(STORAGE, 'blackbox.json');
const DATA_JSON = path.join(VAULT, '.obsidian/plugins/bz/data.json');

const BATCH = 10;       // 重写批大小（比导入更小，提高单批成功率）
const MAX_TOKENS = 16384;
const RETRY = 2;        // 网关不稳，多试两次

// ---------------- AI ----------------
function loadAI() {
  const d = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const provider = d.aiProvider || 'opencode-go';
  if (provider === 'opencode-go') {
    if (!d.opencodeGoApiKey) throw new Error('未配置 opencodeGoApiKey');
    return { endpoint: 'https://opencode.ai/zen/go/v1', apiKey: d.opencodeGoApiKey, model: 'deepseek-v4-flash' };
  }
  throw new Error(`不支持的 provider: ${provider}`);
}

async function aiChat(cfg, prompt) {
  const resp = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: MAX_TOKENS, stream: false }),
    signal: AbortSignal.timeout(300000),
  });
  if (!resp.ok) {
    let msg = `API ${resp.status}`;
    try { const err = await resp.json(); if (err.error?.message) msg = err.error.message; } catch (e) { /* 保留状态码 */ }
    throw new Error(msg);
  }
  const data = await resp.json();
  const errMsg = (data.error && (data.error.message || data.error.type)) || (data.message && data.message);
  if (errMsg) throw new Error(`API: ${errMsg}`);
  const content = data.choices?.[0]?.message?.content;
  if (content === undefined || content === null || typeof content !== 'string' || !content.trim()) throw new Error('响应 content 为空');
  return content;
}

/** 标题 → 百科式定义（只输出 summary，不要关联；本工具不动 related） */
function buildRewritePrompt(names) {
  const list = names.map((n, j) => `${j + 1}. ${n}`).join('\n');
  return [
    `以下 ${names.length} 个标题是主人黑匣子里的概念。请仅凭标题本身，为每个概念写一段正式、百科式的定义（80-150 字，像百科词条：它是什么、核心要点；不口语化、不废话、不虚构）：`,
    `标题列表：`,
    list,
    `只输出 JSON 数组：[{"i": 1, "summary": "..."}]`,
  ].join('\n');
}

function parseBatchJson(text) {
  if (!text) return [];
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x === 'object' && typeof x.i === 'number')
      .map((x) => ({ i: x.i, summary: typeof x.summary === 'string' ? x.summary.trim() : '' }));
  } catch (e) { return []; }
}

// ---------------- 判定 ----------------
const norm = (s) => (s || '').replace(/\s+/g, '').trim();
const hasYaml = (s) => /^---\s*$/m.test(s) || /^\s*tags:/m.test(s) || /^\s*category:/m.test(s);
const hasH1 = (s) => /(^|\n)#[^#\n]/.test(s);

/** 原文正文（去 frontmatter，兼容 CRLF） */
function cardBody(name) {
  const p = path.join(CARDBOX_FOLDER, name + '.md');
  if (!fs.existsSync(p)) return '';
  let raw = fs.readFileSync(p, 'utf8').replace(/\r/g, '');
  raw = raw.replace(/^---\n[\s\S]*?\n---\s*(?:\n|$)/, '');
  return raw;
}

/** 判定条目是否需要重写：含 YAML/标题特征，或与原文高度重合 */
function isDirty(e, body) {
  const d = e.definition || '';
  if (hasYaml(d) || hasH1(d)) return true;
  const dn = norm(d), bn = norm(body);
  if (!dn || !bn) return false;
  if (dn === bn) return true;
  const min = Math.min(60, bn.length);
  if (min > 10 && (dn.includes(bn.slice(0, min)) || bn.includes(dn.slice(0, min)))) return true;
  return false;
}

// ---------------- 主流程 ----------------
async function main() {
  const cfg = loadAI();
  const bb = JSON.parse(fs.readFileSync(BB_FILE, 'utf8'));
  const targets = [];
  for (const e of bb.entries) {
    if (e.type !== 'concept' || !e.name) continue;
    if (isDirty(e, cardBody(e.name))) targets.push(e);
  }
  if (!targets.length) { console.log('[done] 无需要重写的旧条目'); return; }
  console.log(`[scan] 需重写 ${targets.length} 条：${targets.map((t) => t.name).join('、')}`);

  // 写前备份
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(BB_FILE, `${BB_FILE}.bak-legacy-${ts}`);
  console.log(`[backup] → .bak-legacy-${ts}`);

  let rewritten = 0, failed = [];
  const names = targets.map((t) => t.name);
  for (let b = 0; b < names.length; b += BATCH) {
    const batch = names.slice(b, b + BATCH);
    let results = [];
    let ok = false;
    for (let attempt = 0; attempt <= RETRY && !ok; attempt++) {
      try {
        results = parseBatchJson(await aiChat(cfg, buildRewritePrompt(batch)));
        ok = results.length > 0;
        if (!ok) console.log(`[warn] 批 ${b / BATCH + 1} 解析为空，重试`);
      } catch (e) {
        console.log(`[warn] 批 ${b / BATCH + 1} AI 失败（${e.message}），重试`);
      }
    }
    const done = [], keep = [];
    for (const name of batch) {
      const hit = results.find((r) => r.i === batch.indexOf(name) + 1);
      if (hit && hit.summary) {
        const e = bb.entries.find((x) => x.type === 'concept' && x.name === name);
        if (e) { e.definition = hit.summary; done.push(name); }
        else keep.push(name);
      } else keep.push(name);
    }
    rewritten += done.length;
    failed.push(...keep);
    if (done.length) console.log(`[批 ${b / BATCH + 1}/${Math.ceil(names.length / BATCH)}] ✅ 重写 ${done.length} 条：${done.join('、')}`);
    if (keep.length) console.log(`[批 ${b / BATCH + 1}] ⚠️ 保留 ${keep.length} 条（AI 未成功）：${keep.join('、')}`);
  }

  // 保存（沿用 save 的统计同步）
  bb.meta.totalEntries = bb.entries.length;
  bb.meta.totalEvents = bb.events.length;
  fs.writeFileSync(BB_FILE, JSON.stringify(bb, null, 2), 'utf8');
  console.log(`[done] 重写 ${rewritten} 条 · 保留 ${failed.length} 条（保持原样，可重跑本工具）`);
}

main().catch((e) => { console.error('[fatal]', e); process.exit(1); });
