/**
 * 卡片盒全量导入（一次性工具，黑匣子补全 v2）：
 * 把「未导入且未跳过」的卡片盒卡片全部导入黑匣子概念。
 * v2 铁律（2026-08 用户确认）：
 *   1. 只使用标题：不读取卡片盒笔记正文（不读不写、原文零接触），AI 仅凭标题生成百科式定义 + 关联；
 *   2. 无原文降级：AI 未生成成功的卡片一律不导入（不写日志、保持未导入未跳过，留给下一轮）；
 *   3. 轮次重试：第 1 轮全量跑完所有待导入卡 → AI 失败的等全量跑完后进第 2 轮重试 → 每轮只跑上一轮
 *      失败的，直到某轮零成功或达到 MAX_ROUNDS；仍未成功的保持未导入（下次运行本脚本即下一轮）；
 *   4. 每批完成后打印本批卡片名（导入/失败名单）。
 * 与插件 src/blackbox/import-cardbox.ts + ai.ts 逻辑同构：
 *   - prompt 复用 buildBatchCardPrompt 的 JSON 数组格式 [{i, summary, relatedNames}]（20 张一批）
 *   - 写入复刻 runImport（related 回填 / 反向回填 / pendingLinks 跨批补链，一次 load→push→save）
 *   - 进度日志 blackbox_import.json（imported 累积，断点续传，重跑自动跳过）
 * 规则预筛仅按文件名（内容不可见）：剪藏残渣名（404/not found/未命名/error page）跳过；
 * 同名已在黑匣子概念中的卡片跳过（防重复）。不触发自动复盘（不走 addEntry）；写前备份原文件。
 * 用法：node tools/cardbox-import-all.mjs        （全量）
 *       MAX_BATCHES=1 node tools/cardbox-import-all.mjs   （试跑：只跑前 1 批）
 *       SHARDS=3 SHARD_INDEX=0 node tools/cardbox-import-all.mjs （并行分片：多个子进程各跑 1/N）
 * 并行安全：AI 生成互不依赖（全并行）；写盘用互斥锁（CONFIG/STORAGE/.bb-write.lock）串行化，
 * 锁内重读最新数据再写，防并发覆盖；锁残留超过 120s 自动接管。
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------------- 配置 ----------------
const VAULT = 'E:/Obsidian/叫我包仔';
const CARDBOX_FOLDER = path.join(VAULT, '卡片盒');
const STORAGE = path.join(VAULT, 'CONFIG/STORAGE');
const BB_FILE = path.join(STORAGE, 'blackbox.json');
const LOG_FILE = path.join(STORAGE, 'blackbox_import.json');
const DATA_JSON = path.join(VAULT, '.obsidian/plugins/bz/data.json');

const BATCH = 20;                 // 组大小：20（CLASSIFY_BATCH 同款；max_tokens 翻倍后不截断）
const MAX_TOKENS = 32768;         // 输出预算（含思考）翻倍：16384 时 20 卡+思考会被截断，2026-08-11 实测
const RETRY = 2;                  // 每批 AI 失败即时重试次数（网关 503/500 抖动时轮内多救一次；仍失败则全量跑完后进下一轮）
const MAX_ROUNDS = 5;             // 轮次上限：全量(1) + 失败重试(2..MAX_ROUNDS)
const MAX_BATCHES = Number(process.env.MAX_BATCHES) || Infinity; // 试跑开关：只跑前 N 批
const SHARDS = Number(process.env.SHARDS) || 1;                 // 并行分片总数
const SHARD_INDEX = Number(process.env.SHARD_INDEX) || 0;       // 本进程分片序号（0-based）
const EXISTING_CAP = 300;         // prompt 中既有概念名上限（最近的优先，防 prompt 膨胀）
const LOCK_FILE = path.join(STORAGE, '.bb-write.lock');         // 写盘互斥锁（并行子进程共用）
const LOCK_STALE_MS = 120000;     // 锁残留超过此时长视为死锁，强删接管

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 写盘互斥锁：串行化 blackbox.json 写操作；锁内回调可安全读-改-写 */
async function withWriteLock(fn) {
  const deadline = Date.now() + 300000; // 最多等 5 分钟
  for (;;) {
    try {
      fs.mkdirSync(LOCK_FILE);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const st = fs.statSync(LOCK_FILE);
        if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(LOCK_FILE); // 死锁残留，强删接管
          continue;
        }
      } catch (e2) { /* 锁刚被释放，重试 */ }
      if (Date.now() > deadline) throw new Error('写锁等待超时');
      await sleep(150 + Math.random() * 150);
    }
  }
  try {
    return await fn();
  } finally {
    try { fs.rmdirSync(LOCK_FILE); } catch (e) { /* 忽略 */ }
  }
}

// 与 import-cardbox.ts 一致的剪藏残渣文件名预筛（内容不可见，仅按名称）
const JUNK_NAME_RE = /(404|not found|未命名|error page)/i;

// ---------------- AI 配置（从 data.json 读，key 不打印） ----------------
function loadAI() {
  const d = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const provider = d.aiProvider || 'opencode-go';
  if (provider === 'opencode-go') {
    if (!d.opencodeGoApiKey) throw new Error('未配置 opencodeGoApiKey');
    return { endpoint: 'https://opencode.ai/zen/go/v1', apiKey: d.opencodeGoApiKey, model: 'deepseek-v4-flash' };
  }
  if (provider === 'deepseek') {
    if (d.deepseekApiKey) return { endpoint: 'https://api.deepseek.com', apiKey: d.deepseekApiKey, model: 'deepseek-v4-flash' };
    // quickadd data.json 兜底（与 getAIProvider 一致）
    try {
      const qa = JSON.parse(fs.readFileSync(path.join(VAULT, '.obsidian/plugins/quickadd/data.json'), 'utf8'));
      const p = qa.ai && qa.ai.providers && qa.ai.providers[0];
      if (p && p.endpoint && p.apiKey) return { endpoint: p.endpoint.replace(/\/+$/, ''), apiKey: p.apiKey, model: 'deepseek-v4-flash' };
    } catch (e) { /* 忽略 */ }
    throw new Error('未找到 DeepSeek 配置');
  }
  throw new Error(`未知 aiProvider: ${provider}`);
}

// ---------------- AI 请求（非流式，OpenAI 兼容；与 chatCompletionsNonStream 同构） ----------------
async function aiChat(cfg, prompt) {
  const resp = await fetch(`${cfg.endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_TOKENS,
      stream: false,
    }),
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
  if (content === undefined || content === null) throw new Error('响应缺少 content');
  if (typeof content !== 'string' || !content.trim()) throw new Error('响应 content 为空');
  return content;
}

// ---------------- prompt 与解析（复刻 buildBatchCardPrompt / parseBatchCardJson；v2 仅标题） ----------------
function buildBatchPrompt(names, existingNames) {
  const list = names.map((n, j) => `${j + 1}. ${n}`).join('\n');
  return [
    `以下 ${names.length} 张卡片将导入主人的黑匣子。每张卡只有标题、没有正文——请仅凭标题本身，按黑匣子概念卡的方式为每张卡写一张百科式知识卡片（解释这个标题所指的概念本身，不要虚构正文内容）：`,
    `1. summary：正式、百科式的口吻写一段定义（80-150 字，像百科词条：它是什么、核心要点；不口语化、不废话）；`,
    `2. relatedNames：从既有概念「${existingNames}」中挑 0-3 个与它相关的（没有就空数组）。`,
    `标题列表：`,
    list,
    `只输出 JSON 数组：[{"i": 1, "summary": "...", "relatedNames": ["..."]}]`,
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
      .map((x) => ({
        i: x.i,
        summary: typeof x.summary === 'string' ? x.summary.trim() : '',
        relatedNames: Array.isArray(x.relatedNames) ? x.relatedNames.filter((n) => typeof n === 'string').slice(0, 5) : [],
      }));
  } catch (e) { return []; }
}

// ---------------- 数据读写 ----------------
function readBB() { return JSON.parse(fs.readFileSync(BB_FILE, 'utf8')); }
function writeBB(data) {
  data.meta.totalEntries = data.entries.length;
  data.meta.totalEvents = data.events.length;
  fs.writeFileSync(BB_FILE, JSON.stringify(data, null, 2), 'utf8');
}
function readLog() {
  try {
    const obj = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return {
      imported: new Set(Array.isArray(obj.imported) ? obj.imported : []),
      skipped: new Set(Array.isArray(obj.skipped) ? obj.skipped : []),
    };
  } catch (e) { return { imported: new Set(), skipped: new Set() }; }
}
function writeLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({ imported: [...log.imported], skipped: [...log.skipped] }, null, 2), 'utf8');
}

function genId() { return `bb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }

// ---------------- 主流程 ----------------
/**
 * 处理一批：AI 凭标题生成 → 有 summary 的卡导入（definition=AI 定义），无 summary 的卡不导入。
 * 返回 { imported: string[], failed: string[] }；failed 保持未导入未跳过，由调用方放入下一轮。
 * 并行安全：AI 调用全并行（只读参考快照）；写盘在 withWriteLock 内重读最新数据再写。
 */
async function processBatch(cfg, cards, batchNo) {
  // 兼容两种入参：round 1 传对象数组 {name, createdAt}，round 2+ 重试可能传字符串数组（2026-08-11 实测 bug，统一归一）
  const cardsNorm = cards.map((c) => (typeof c === 'string' ? { name: c, createdAt: '' } : c));
  const names = cardsNorm.map((c) => c.name);
  // AI 前参考快照（无锁读：只供 prompt 挑关联名，读到的必是某个一致落盘状态）
  const snapshot = readBB();
  const existingNames = snapshot.entries.filter((e) => e.type === 'concept' && e.name).map((e) => e.name).slice(-EXISTING_CAP);

  // AI 生成（失败重试 RETRY 次；仍失败 → 本批全部进 failed）
  let aiResults = [];
  let aiFailed = false;
  for (let attempt = 0; attempt <= RETRY; attempt++) {
    try {
      const prompt = buildBatchPrompt(names, existingNames.join('、') || '（暂无）');
      const raw = await aiChat(cfg, prompt);
      aiResults = parseBatchJson(raw);
      if (aiResults.length) break;
      const s = raw.indexOf('[');
      const e2 = raw.lastIndexOf(']');
      let why = '解析为空';
      if (s < 0 || e2 <= s) why = '无 JSON 数组';
      else { try { JSON.parse(raw.slice(s, e2 + 1)); why = 'JSON 结构不完整（可能被 max_tokens 截断）'; } catch (e3) { why = 'JSON 解析失败（可能被截断）'; } }
      fs.appendFileSync('tools/ai-raw.log', `[batch ${batchNo} attempt ${attempt}] ${why}\n${raw.slice(0, 400)}\n---\n`);
      console.log(`[warn] 第 ${batchNo} 批解析为空（${why}），原始返回已存 tools/ai-raw.log`);
      if (attempt === RETRY) aiFailed = true;
    } catch (e) {
      console.log(`[warn] 第 ${batchNo} 批 AI 请求失败（${e.message}）`);
      if (attempt === RETRY) aiFailed = true;
    }
  }
  if (!aiResults.length) aiFailed = true;
  if (aiFailed) return { imported: [], failed: [...names] }; // 整批不导入，等下一轮

  // 逐卡判定：有 summary 才导入（无原文降级）；无 summary 的卡 → failed（下一轮重试）
  const importedNames = [];
  const failedNames = [];
  for (const name of names) {
    const hit = aiResults.find((r) => r.i === names.indexOf(name) + 1);
    if (hit && hit.summary) importedNames.push(name);
    else failedNames.push(name);
  }
  if (!importedNames.length) return { imported: [], failed: failedNames };

  // 写盘临界区：锁内重读最新数据（其他进程可能已写入），构造条目 → 写入 → 日志 → 跨批补链
  await withWriteLock(async () => {
    const latest = readBB();
    const existingConcepts = latest.entries.filter((e) => e.type === 'concept' && e.name);
    const existingByName = new Map(existingConcepts.map((e) => [e.name, e.id]));
    const existingById = new Map(existingConcepts.map((e) => [e.id, e]));

    // 创建条目（复刻 runImport 第一遍：definition = AI 定义，无任何原文字段）
    const nameToId = new Map();
    const created = [];
    for (const name of importedNames) {
      const hit = aiResults.find((r) => r.i === names.indexOf(name) + 1);
      const c = cardsNorm.find((x) => x.name === name);
      const entry = {
        id: genId(),
        type: 'concept',
        createdAt: (c && c.createdAt) || new Date().toISOString(),
        emotions: [], people: [], scene: '', toward: '', links: [],
        name,
        definition: hit.summary,
        related: [],
        _aiRelated: (hit.relatedNames || []).slice(0, 5),
      };
      nameToId.set(name, entry.id);
      created.push(entry);
    }

    // related 回填（复刻 runImport 第二遍：既有 id / 本批 name→id / pendingLinks + 反向回填）
    for (const e of created) {
      const ids = [];
      const pending = [];
      for (const n of e._aiRelated || []) {
        if (existingByName.has(n)) ids.push(existingByName.get(n));
        else {
          const id = nameToId.get(n);
          if (id && id !== e.id) ids.push(id);
          else pending.push(n);
        }
      }
      delete e._aiRelated;
      e.related = [...new Set(ids)].slice(0, 5);
      if (pending.length) e.pendingLinks = pending;
      for (const id of ids) {
        const old = existingById.get(id);
        if (old && !(old.related || []).includes(e.id)) {
          old.related = [...(old.related || []), e.id].slice(0, 5);
        }
      }
    }

    latest.entries.push(...created);
    writeBB(latest);
    const log = readLog();
    for (const name of importedNames) log.imported.add(name);
    writeLog(log);

    // 跨批补链（等效 resolvePendingLinks：已导入概念按名解析）
    const after = readBB();
    const nameToId2 = new Map(after.entries.filter((e) => e.type === 'concept' && e.name).map((e) => [e.name, e.id]));
    let changed = false;
    for (const e of after.entries) {
      if (e.type !== 'concept' || !e.pendingLinks || !e.pendingLinks.length) continue;
      const ids = [];
      const rest = [];
      for (const n of e.pendingLinks) {
        const id = nameToId2.get(n);
        if (id && id !== e.id) ids.push(id);
        else rest.push(n);
      }
      e.related = [...new Set([...(e.related || []), ...ids])].slice(0, 5);
      e.pendingLinks = rest.length ? rest : undefined;
      changed = true;
    }
    if (changed) writeBB(after);
  });

  return { imported: importedNames, failed: failedNames };
}

/**
 * 递归收集卡片盒所有 .md（含子目录，与插件 scanCardboxAsync 的 startsWith 一致）。
 * 只取文件名 + 文件 stat（元数据，正文零接触）；createdAt = 文件创建时间（条目时间线用）。
 */
function scanCardbox() {
  const out = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.isFile() && f.name.endsWith('.md')) {
        let createdAt = '';
        try { const st = fs.statSync(p); if (st.ctime) createdAt = new Date(st.ctime).toISOString(); } catch (e) { /* 兜底为空 */ }
        out.push({ name: path.basename(f.name, '.md'), createdAt });
      }
    }
  };
  walk(CARDBOX_FOLDER);
  return out;
}

async function main() {
  const cfg = loadAI();
  console.log(`[config] endpoint=${cfg.endpoint} model=${cfg.model}（key 已隐藏）`);

  // 备份已按用户要求移除（2026-08-12：不再生成 .bak 文件）

  // 扫描卡片盒（只取文件名，正文零接触）
  const files = scanCardbox();
  const log = readLog();
  const bb = readBB();
  const existingNamesAll = new Set(bb.entries.filter((e) => e.type === 'concept' && e.name).map((e) => e.name));

  const cards = [];
  const preskip = [];
  for (const c of files) {
    const name = c.name;
    if (log.imported.has(name)) continue;       // 已导入
    if (log.skipped.has(name)) continue;        // 用户已跳过（永不导入）
    if (existingNamesAll.has(name)) continue;   // 黑匣子里已有同名概念（防重复）
    if (JUNK_NAME_RE.test(name)) { preskip.push({ name, reason: '疑似剪藏残渣' }); continue; }
    cards.push(c);
  }

  console.log(`[scan] 卡片盒共 ${files.length} 张 · 已导入 ${log.imported.size} · 已跳过 ${log.skipped.size} · 同名冲突 ${files.length - log.imported.size - log.skipped.size - cards.length - preskip.length} · 预筛跳过 ${preskip.length} · 待 AI 导入 ${cards.length}`);
  if (preskip.length) console.log(`[preskip] ${preskip.map((p) => `${p.name}(${p.reason})`).join(' | ')}`);

  if (!cards.length) { console.log('[done] 无待导入卡片'); return; }

  // 并行分片：按名称排序后取模均分（任一分片重启不影响其它分片）
  cards.sort((a, b) => a.name.localeCompare(b.name));
  const myCards = cards.filter((_, i) => i % SHARDS === SHARD_INDEX);
  if (SHARDS > 1) console.log(`[shard] ${SHARD_INDEX + 1}/${SHARDS}：本分片 ${myCards.length} 张（共 ${cards.length}）`);

  // 轮次循环：第 1 轮全量 → 之后每轮只跑上一轮 AI 失败的（等全量跑完才进下一轮）
  let pending = myCards;
  const failedFinal = [];
  let importedTotal = log.imported.size;
  let totalBatchesRun = 0;

  for (let round = 1; round <= MAX_ROUNDS && pending.length; round++) {
    const label = round === 1 ? '第1轮(全量)' : `第${round}轮(重试)`;
    const roundTotalBatches = Math.ceil(pending.length / BATCH);
    let roundImported = 0;
    let nextPending = [];
    for (let b = 0; b < pending.length; b += BATCH) {
      if (totalBatchesRun >= MAX_BATCHES) { console.log('[trial] 达到 MAX_BATCHES 试跑上限，停止（日志已断点，重跑继续）'); break; }
      const names = pending.slice(b, b + BATCH);
      const batchNo = Math.floor(b / BATCH) + 1;
      const r = await processBatch(cfg, names, `${round}-${batchNo}`);
      totalBatchesRun++;
      if (r.imported.length) {
        importedTotal += r.imported.length;
        roundImported += r.imported.length;
        console.log(`[${label} ${batchNo}/${roundTotalBatches}] ✅ 导入 ${r.imported.length} 张（累计 ${importedTotal}）：${r.imported.join('、')}`);
      } else {
        console.log(`[${label} ${batchNo}/${roundTotalBatches}] ⚠️ 本批 ${names.length} 张全部 AI 失败 → 下一轮重试`);
      }
      if (r.failed.length) {
        nextPending.push(...r.failed);
        console.log(`[${label} ${batchNo}/${roundTotalBatches}] ⚠️ 失败 ${r.failed.length} 张（等全量跑完进下一轮）：${r.failed.join('、')}`);
      }
    }
    if (roundImported === 0) {
      // 本轮零成功：继续跑没有意义，剩余留到下次运行（下一轮）
      failedFinal.push(...nextPending);
      console.log(`[round] ${label} 零成功，停止本轮循环；剩余 ${nextPending.length} 张保持未导入（下次运行本脚本即下一轮）`);
      break;
    }
    pending = nextPending;
    console.log(`[round] ${label} 完成：本轮导入 ${roundImported} 张 · 失败 ${pending.length} 张进入下一轮`);
  }

  console.log(`[done] 完成：本轮运行累计导入 ${importedTotal} 张（黑匣子现有概念 ${readBB().entries.length} 条）`);
  if (failedFinal.length) {
    console.log(`[下轮待跑] ${failedFinal.length} 张 AI 始终失败，保持未导入未跳过（下次运行重试）：${failedFinal.join('、')}`);
  }
}

main().catch((e) => { console.error('[fatal]', e); process.exit(1); });
