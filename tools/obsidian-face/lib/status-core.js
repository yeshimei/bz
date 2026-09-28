// ================================================================
// bz-face status —— 联系人产物体检（issue 510；纯 Node 读盘，不起 Python）
//
// 职责切分（照 doctor 的两层切分）：
//   lib/status-core.js  本文件——argv 解析 / 产物事实采集（fs，各自兜错） / 人读报告组装
//   bin/bz-face.js      CLI 薄壳——采集 → 打印 → 退出码
//
// 输出格式：人读纯文本（doctor 同款），不走四行协议——status 是排障 / 体检的一次性命令。
// 每个产物一行：✓ 在且有货（带计数与更新时间） / △ 在但空或半截 / ✗ 缺（附下一步命令）。
// 退出码：0 = 报告出得来（产物缺不缺都算——产物是「报告」）；1 = 联系人目录都不在；2 = 用法错误。
//
// 铁的约定：本文件任何函数不得抛异常——读不动的产物折成 { error } 行，绝不让单个文件
// 炸掉整份报告；只读不写，绝不 pip install，绝不碰 vault。
// ================================================================
'use strict';

const fs = require('fs');
const path = require('path');

// ---- CLI 参数解析 ----

/**
 * 解析 bz-face status 的 argv：
 *   bz-face status <联系人> --data-root <路径> [--help] [--version]
 * 纯 Node 读盘——没有 --python（给了按未知参数拒）。
 * @returns {{ command:'status'|null, contact?:string, dataRoot?:string,
 *            help?:boolean, version?:boolean, error?:string }}
 */
function parseStatusArgv(argv) {
  const out = { command: 'status' };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'status') i += 1;
  const positional = [];
  for (; i < args.length; i++) {
    let arg = String(args[i]);
    let inlineValue;
    const eq = arg.indexOf('=');
    if (eq > 2 && arg.startsWith('--')) {
      inlineValue = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 < args.length) {
        i += 1;
        return String(args[i]);
      }
      return undefined;
    };
    switch (arg) {
      case '--data-root':
      case '-d': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--data-root 需要一个路径参数' };
        out.dataRoot = v;
        break;
      }
      case '--help':
        out.help = true;
        return out;
      case '--version':
        out.version = true;
        return out;
      default:
        if (arg.startsWith('-')) return { command: null, error: `未知参数「${arg}」` };
        positional.push(arg);
    }
  }
  if (positional.length > 1) return { command: null, error: '联系人只收一个（数据根下的目录名）' };
  if (positional.length === 1) out.contact = positional[0];
  if (!out.contact) return { command: null, error: '缺联系人——用法：bz-face status <联系人> --data-root <路径>' };
  if (!out.dataRoot) return { command: null, error: '--data-root 需要一个路径参数' };
  return out;
}

// ---- 事实采集（fs，各自兜错） ----

function statOf(p) {
  try {
    return fs.statSync(p);
  } catch {
    return null;
  }
}

/** 目录内按扩展名计数（递归——image/ / desc/ 是 `<月>/<文件>` 两层布局；缺目录 → null） */
function countByExt(dir) {
  const out = {};
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.isFile()) {
        const ext = path.extname(e.name).toLowerCase() || '无扩展名';
        out[ext] = (out[ext] || 0) + 1;
      }
    }
  };
  try {
    fs.readdirSync(dir); // 缺目录 → null
  } catch {
    return null;
  }
  walk(dir);
  return out;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function fmtTime(st) {
  if (!st || !st.mtime) return '';
  const d = new Date(st.mtimeMs);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/**
 * 采集一位联系人的产物事实。任何一项读不动都折成 error 行，绝不抛。
 * @returns {{ dirExists:boolean, lines:{text:string,state:'ok'|'warn'|'miss'|'err'}[] }}
 */
function collectStatusFacts(dataRoot, contact) {
  const dir = path.join(dataRoot, contact);
  const lines = [];
  const st = statOf(dir);
  if (!st || !st.isDirectory()) {
    return { dirExists: false, lines };
  }
  const push = (text) => lines.push({ text, state: 'ok' });
  const warn = (text) => lines.push({ text, state: 'warn' });
  const miss = (text) => lines.push({ text, state: 'miss' });

  // stats.json（sync 轮统计）
  const statsPath = path.join(dir, 'stats.json');
  const stats = readJson(statsPath);
  if (stats && typeof stats === 'object') {
    push(`stats.json：消息 ${stats.msgs ?? '?'} / 语音 ${stats.voices ?? '?'} / 图片 ${stats.images ?? '?'}，语音 ${stats.voiceSec ?? '?'} 秒，${stats.syncedAt || fmtTime(statOf(statsPath))} 同步`);
  } else if (statOf(statsPath)) {
    warn('stats.json：读不出（坏 JSON）——重跑 bz-face sync 覆盖');
  } else {
    miss('stats.json：没有——先跑 bz-face sync');
  }

  // chat.json（export 轮消息流）
  const chatPath = path.join(dir, 'chat.json');
  const chat = readJson(chatPath);
  if (Array.isArray(chat)) {
    const voices = chat.filter((m) => m && m.type === 34).length;
    const images = chat.filter((m) => m && m.type === 3).length;
    push(`chat.json：${chat.length} 条消息（语音 ${voices} / 图片 ${images}），${fmtTime(statOf(chatPath))} 导出`);
  } else if (statOf(chatPath)) {
    warn('chat.json：读不出（坏 JSON）——重跑 bz-face export');
  } else {
    miss('chat.json：没有——bz-face export --data-root … --contact（prep 与 refs 都靠它）');
  }

  // 语音：voice/ + voice.json
  const wavExts = countByExt(path.join(dir, 'voice'));
  const wavCount = wavExts ? (wavExts['.wav'] || 0) : 0;
  if (wavExts === null) miss('voice/：没有（prep 段 1 产出 silk→wav）');
  else if (!wavCount) warn(`voice/：空（现有 ${Object.keys(wavExts).length} 类杂项）`);
  else push(`voice/：${wavCount} 个 wav`);
  const vjson = readJson(path.join(dir, 'voice.json'));
  if (Array.isArray(vjson)) {
    const failed = vjson.filter((r) => r && String(r.emotion) === 'ERR').length;
    push(`voice.json：转写 ${vjson.length} 条${failed ? `（失败 ${failed}，重跑 prep 只补失败）` : ''}`);
  } else if (statOf(path.join(dir, 'voice.json'))) {
    warn('voice.json：读不出（坏 JSON）——重跑 bz-face prep 覆盖');
  } else if (wavCount) {
    miss('voice.json：还没有转写——bz-face prep（转写段）');
  }

  // 图片：image/ + desc/ + image_map.json
  const imgExt = countByExt(path.join(dir, 'image'));
  if (imgExt === null) miss('image/：没有（prep 段 1 产出 .dat 解码图）');
  else {
    const total = Object.values(imgExt).reduce((a, b) => a + b, 0);
    const bin = imgExt['.bin'] || 0;
    const brief = Object.entries(imgExt).map(([e, n]) => `${e}×${n}`).join(' ');
    push(`image/：${total} 个${bin ? `（含 ${bin} 个 .bin 未解码——重跑 prep 补 wxgf 解码）` : ''}（${brief}）`);
  }
  const descExt = countByExt(path.join(dir, 'desc'));
  if (descExt === null) miss('desc/：没有（prep 段 2 派生图片档，AI 图片描述的上行源）');
  else {
    const total = Object.values(descExt).reduce((a, b) => a + b, 0);
    if (!total) warn('desc/：空');
    else push(`desc/：派生档 ${total} 个`);
  }
  const imap = readJson(path.join(dir, 'image_map.json'));
  if (Array.isArray(imap)) push(`image_map.json：关联 ${imap.length} 条`);
  else if (statOf(path.join(dir, 'image_map.json'))) warn('image_map.json：读不出（坏 JSON）——重跑 bz-face prep');
  else miss('image_map.json：没有（prep 段 3 图片关联表）');

  // 录音：recordings/ + 各 sidecar phase
  let recNames = null;
  try {
    recNames = fs.readdirSync(path.join(dir, 'recordings'));
  } catch {
    recNames = null;
  }
  if (recNames === null) {
    miss('recordings/：没有（详情页「补充素材 → 录音」导入后落位）');
  } else {
    const audio = recNames.filter((n) => !n.endsWith('.turns.json') && !n.endsWith('.tmp') && !n.startsWith('.'));
    const sidecars = recNames.filter((n) => n.endsWith('.turns.json'));
    if (!audio.length) warn('recordings/：空');
    else {
      const phaseParts = sidecars.map((n) => {
        const s = readJson(path.join(dir, 'recordings', n));
        const phase = s && typeof s.phase === 'string' ? s.phase : '?';
        const turns = s && Array.isArray(s.turns) ? `${s.turns.length}轮` : '';
        return `${n.replace(/\.turns\.json$/, '')}=${phase}${turns ? `/${turns}` : ''}`;
      });
      push(`recordings/：音频 ${audio.length} 个${phaseParts.length ? `；sidecar：${phaseParts.slice(0, 5).join('、')}${phaseParts.length > 5 ? ' …' : ''}` : ''}`);
    }
  }

  // 质心参考
  const npz = statOf(path.join(dataRoot, 'voiceprints', `${contact}.npz`));
  if (npz && npz.isFile()) {
    push(`voiceprints/${contact}.npz：在（${fmtTime(npz)} 构建）——bz-face refs 重建走增量指纹`);
  } else {
    warn(`voiceprints/${contact}.npz：没有——分离将按「非我即对方 / 盲聚」降级（bz-face refs --contact）`);
  }

  return { dirExists: true, lines };
}

// ---- 报告组装 ----

/**
 * 事实 → 人读报告行数组（第一行联系人头，末行小结）。
 * @returns {{ lines: string[], missing: number }}
 */
function formatStatusReport(dataRoot, contact, facts) {
  if (!facts.dirExists) {
    return {
      lines: [`bz-face status：联系人目录不存在：${path.join(dataRoot, contact)}——目录名以数据源扫描为准（bz-face sync 产物）`],
      missing: -1,
    };
  }
  const lines = [`联系人「${contact}」（${dataRoot}）：`, ''];
  let missing = 0;
  for (const l of facts.lines) {
    if (l.state === 'ok') lines.push(`✓ ${l.text}`);
    else if (l.state === 'warn') lines.push(`△ ${l.text}`);
    else {
      missing += 1;
      lines.push(`✗ ${l.text}`);
    }
  }
  lines.push('');
  lines.push(missing ? `小结：${missing} 项产物缺失（✗ 行给了下一步命令；重跑对应命令只补缺口）` : '小结：产物齐全。');
  return { lines, missing };
}

module.exports = {
  parseStatusArgv,
  collectStatusFacts,
  formatStatusReport,
};
