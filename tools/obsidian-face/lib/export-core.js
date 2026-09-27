// ================================================================
// bz-face export —— 按需导出判定层（纯函数，零依赖，注入即可测；issue 485）
//
// 职责切分（照 464 sync 的三层切分）：
//   python/bz_sync.py  export 轮本体（--contact 走 export_flow 全量导出 chat.json + 头像）
//   lib/export-core.js 本文件——CLI 参数解析 / 预检判定（协议行格式化与转发中继复用 sync-core）
//   bin/bz-face.js     CLI 薄壳——预检 → 起子进程 → 逐行转发 → 汇总退出码
//
// 与 sync 轮的分工（485 拍板）：sync 只出 stats.json（统计数字），全量 chat.json 挪到
// 本命令按需导出——插件在「导入所选」时只对勾选者起本命令，单人两万条量级秒级完成。
// export 轮不要求微信在跑（吃 sync 已落盘的缓存密钥与解密库），预检据此与 sync 分道。
//
// 铁的约定（与 sync-core 相同）：
//   1. 本文件任何函数不得抛异常——畸形输入一律降级成失败结果；
//   2. 绝不执行任何安装；绝不静默降级（缺密钥 / 缺解密库 = 预检即硬失败）；
//   3. 四行协议同 sync：[bz-step] / [bz-p]{phase,pct} / [bz-info] / [bz-result]。
// ================================================================
'use strict';

// ---- CLI 参数解析（export 子命令）----

/**
 * 解析 bz-face export 的 argv。支持：
 *   bz-face export --data-root <路径> --contact <目录名> [--contact <目录名> …]
 *                   [--python <命令>] [--src <账号目录>] [--help] [--version]
 * --data-root 与至少一个 --contact 必填（help/version 除外）；--contact 可重复（去重保序
 * 在 Python 侧做，这里保留原样供预检逐个探测目录）。未知参数记入 error，绝不猜。
 * @param {string[]} argv process.argv.slice(2)（容忍开头重复的 export）
 * @returns {{ command:'export'|null, dataRoot?:string, contacts:string[], python?:string,
 *            src?:string, help?:boolean, version?:boolean, error?:string }}
 */
function parseExportArgv(argv) {
  const out = { command: 'export', contacts: [] };
  const args = argv || [];
  let i = 0;
  if (args[i] === 'export') i += 1; // bin 路由后仍传整体 argv，跳过命令词
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
      case '--python':
      case '-p': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--python 需要一个命令参数' };
        out.python = v;
        break;
      }
      case '--src': {
        const v = takeValue();
        if (v === undefined) return { command: null, error: '--src 需要一个账号目录参数' };
        out.src = v;
        break;
      }
      case '--contact': {
        const v = takeValue();
        if (v === undefined || !v.trim()) return { command: null, error: '--contact 需要一个联系人目录名参数' };
        out.contacts.push(v);
        break;
      }
      case '--help':
      case '-h':
        out.help = true;
        break;
      case '--version':
      case '-v':
        out.version = true;
        break;
      default:
        return { command: null, error: `未知参数：${args[i]}` };
    }
  }
  if (!out.help && !out.version && !out.dataRoot) {
    return {
      command: null,
      error: 'export 需要数据根：--data-root <路径>（密钥、解密库与各联系人目录都落在这里）',
    };
  }
  if (!out.help && !out.version && !out.contacts.length) {
    return {
      command: null,
      error: 'export 需要至少一个 --contact <联系人目录名>（可重复传多个）——全量导出请用 bz-face sync 的产物目录名',
    };
  }
  return out;
}

// ---- 预检判定 ----

/**
 * export 预检：注入探测结果，判这条 export 该不该起跑。与 sync 预检的分道点：
 *   - 不看微信进程与版本——export 不取密钥，只吃缓存；
 *   - 缓存密钥（.bz-face/key.json）与解密库（.bz-face/decrypted）必须已在——没有就引导先跑 sync；
 *   - 每个 --contact 目录必须已在数据根下——目录名来自插件的数据源扫描，缺席说明名单过期。
 * @param {Record<string, any>} probes 探测结果（dataRoot）
 * @param {{ contacts: string[], cachedKey?: boolean, hasDecrypted?: boolean, missingContacts?: string[] }} opts
 * @returns {{ ok: boolean, error?: string }}
 */
function judgeExportPreflight(probes, opts) {
  const contacts = (opts && opts.contacts) || [];
  const d = (probes && probes.dataRoot) || {};
  if (!d.configured) {
    return { ok: false, error: 'export 需要数据根：--data-root <路径>（密钥、解密库与各联系人目录都落在这里）' };
  }
  if (!d.exists) {
    return { ok: false, error: `数据根目录不存在：${d.path || d.error || '（路径读不出）'}——先建目录或检查路径` };
  }
  if (d.writable === false) {
    return { ok: false, error: `数据根不可写：${d.path || ''}——检查目录权限或被占用后重试` };
  }
  if (!contacts.length) {
    return { ok: false, error: 'export 需要至少一个 --contact <联系人目录名>（可重复传多个）' };
  }
  if (!opts.cachedKey) {
    return {
      ok: false,
      error: '还没有缓存的解密密钥（数据根 .bz-face/key.json）——先跑一次 bz-face sync（需微信登录），再按需导出',
    };
  }
  if (!opts.hasDecrypted) {
    return {
      ok: false,
      error: '还没有解密数据库（数据根 .bz-face/decrypted）——先跑一次 bz-face sync，再按需导出',
    };
  }
  const missing = (opts.missingContacts || []).filter(Boolean);
  if (missing.length) {
    const names = missing.slice(0, 3).map((n) => `「${n}」`).join('、');
    return {
      ok: false,
      error: `联系人目录不在数据根里：${names}${missing.length > 3 ? ` 等 ${missing.length} 位` : ''}——先同步刷新数据源，再按需导出`,
    };
  }
  return { ok: true };
}

module.exports = {
  parseExportArgv,
  judgeExportPreflight,
};
