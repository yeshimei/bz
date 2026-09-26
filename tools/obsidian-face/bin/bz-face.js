#!/usr/bin/env node
// ================================================================
// bz-face —— 包仔脸谱工具包 CLI（@jwbz/obsidian-face）
//
// 子命令：
//   bz-face sync --data-root <路径> [--python <命令>] [--src <账号目录>]
//                [--min-messages N] [--limit N]
//     一次跑完（issue 464 / ADR-0196 决策 1）：取密钥 → 解密数据库 →
//     逐联系人导出 chat.json（文本 + [表情·名] + 图片定位 + 语音时长）→
//     头像源落位。转写 / 媒体导出 / 图片描述不在 sync（票 468 的 prep）。
//     stdout 只产 [bz-step]/[bz-p]/[bz-info]/[bz-result] 四行协议——本命令是给
//     插件编排消费的长任务（465 数据源同步按钮驱动），Python 的行原样透传，
//     Node 只补预检行与兜底结果行；退出码 0 = 跑完（单联系人失败看结果行 failed:N）、
//     1 = 硬失败（微信未运行 / 版本被封堵 / 解密失败，绝不静默降级读旧目录）、
//     2 = 用法错误。幂等可重复跑（产物字节比对，没变不写）。
//
//   bz-face doctor [--data-root <路径>] [--python <命令>]
//     环境自检：Python 版本 / 解密组与转写组依赖 / ffmpeg / ffprobe /
//     微信进程与版本 / 数据根可写性。逐行打「✓ 通过 / ✗ 缺失 + 可直接粘贴的
//     修复命令」；任何单项缺失都不抛栈、不中断其余检查。（人读纯文本，不走协议。）
//
//   bz-face --version / --help
//
// 预检与转发链路：probeWeixin / probeDataRoot（lib/probes）→ judgeSyncPreflight /
// createSyncRelay（lib/sync-core）→ runSyncProcess 起子进程逐行转发。
//
// 退出码：doctor 0 = 跑完（有缺失项也算——产物是「报告」）；sync 见上；2 = 用法错误。
// 绝不自动安装：doctor 只打印修复命令，sync 只报中文引导，不执行 pip / winget
// （README 与 ADR-0195）。
// ================================================================
'use strict';

const path = require('path');
const core = require('../lib/doctor-core');
const sync = require('../lib/sync-core');
const probes = require('../lib/probes');

const pkg = require('../package.json');

const SYNC_STEPS_TEXT = sync
  .buildSyncPlan()
  .map((p, i) => `      ${i + 1}. ${p.label}——${p.detail}`)
  .join('\n');

const USAGE = [
  `bz-face（@jwbz/obsidian-face）v${pkg.version} —— 包仔脸谱工具包`,
  '',
  '用法：',
  '  bz-face sync --data-root <路径> [--python <命令>] [--src <账号目录>]',
  '                [--min-messages N] [--limit N]',
  '      从微信一次取数（微信需已登录）：',
  SYNC_STEPS_TEXT,
  '      产物全落数据根：<数据根>/<联系人>/chat.json、avatar.<ext>，',
  '      密钥与解密库在 <数据根>/.bz-face/ 下。幂等可重复跑。',
  '      stdout 为四行协议（[bz-step]/[bz-p]/[bz-info]/[bz-result]），供插件编排消费；',
  '      微信未运行 / 版本被封堵 / 解密失败 → 立即失败并给中文引导，不静默降级。',
  '  bz-face doctor [--data-root <路径>] [--python <命令>]',
  '      环境自检：Python / 解密组依赖 / 转写组依赖 / ffmpeg / ffprobe / 微信进程与版本 /',
  '      数据根可写性。逐行打「通过/缺失 + 可直接粘贴的修复命令」，单项缺失不中断。',
  '  bz-face --version',
  '',
  '选项：',
  '  --data-root, -d <路径>   数据根路径（sync 必填；doctor 不给则显示「未配置」）',
  '  --python, -p <命令>      Python 命令覆盖（缺省 python；含空格命令请用 python.exe 完整路径）',
  '  --src <账号目录>         sync：微信账号目录覆盖（默认当前微信数据目录）',
  '  --min-messages N         sync：少于该条数的联系人不落盘（默认 1 = 全量非空）',
  '  --limit N                sync：调试用，限制处理联系人数（默认 0 = 不限）',
  '  --help, -h               本说明',
  '',
  '预处理（prep <联系人>：媒体导出 / 语音转写）由后续票提供（468）。',
].join('\n');

async function cmdDoctor(opts) {
  // 1. 采集（每个探测独立兜错，探测层绝不抛）
  const results = await core.collectDoctorProbes({
    python: () => probes.probePython(opts.python),
    decryptDeps: () => probes.probeModules(opts.python, core.DECRYPT_DEPS),
    transcribeDeps: () => probes.probeModules(opts.python, core.TRANSCRIBE_DEPS),
    ffmpeg: () => probes.probePathTool('ffmpeg'),
    ffprobe: () => probes.probePathTool('ffprobe'),
    wechat: () => probes.probeWeixin(),
    dataRoot: () => probes.probeDataRoot(opts.dataRoot),
  });

  // 2. 判定（纯函数；单项缺失不影响其余项）
  const { lines, passCount, failCount, warnCount } = core.runDoctorChecks(results, {
    pkgRoot: path.resolve(__dirname, '..'),
  });

  // 3. 打印（每项一行 + 修复命令行；末尾汇总）
  console.log(`bz-face doctor —— 环境自检（v${pkg.version}）`);
  console.log('');
  for (const line of lines) {
    console.log(core.formatDoctorLine(line));
  }
  console.log('');
  const parts = [`通过 ${passCount}`];
  if (failCount) parts.push(`缺失 ${failCount}`);
  if (warnCount) parts.push(`需留意 ${warnCount}`);
  console.log(`汇总：${parts.join('，')}${failCount ? '——按上方 ✗ 项的命令补齐后重跑' : '。'}`);
  return 0;
}

async function cmdSync(opts) {
  const relay = sync.createSyncRelay();
  const emit = (line) => {
    if (line) console.log(line);
  };

  // 1. 预检（探测层各自兜错绝不抛）：微信进程与版本、数据根存在可写
  const [wechat, dataRoot] = await Promise.all([
    probes.probeWeixin(),
    Promise.resolve(probes.probeDataRoot(opts.dataRoot)),
  ]);
  const pre = sync.judgeSyncPreflight({ wechat, dataRoot });
  if (!pre.ok) {
    // 硬失败：结果行（给插件）+ stderr（给人），退出码 1——绝不静默降级读旧目录
    emit(sync.formatBzLine('result', { ok: false, error: pre.error }));
    console.error(`bz-face sync：${pre.error}`);
    return 1;
  }

  // 2. 起子进程：stdout 逐行透传（协议行原样），stderr 留尾由终结兜底用
  emit(sync.formatBzLine('step', '预检通过：微信在跑、数据根可写，启动导出'));
  const run = await probes.runSyncProcess({
    pythonCmd: opts.python,
    scriptPath: path.join(__dirname, '..', 'python', 'bz_sync.py'),
    args: [
      '--data-root',
      opts.dataRoot,
      ...(opts.src ? ['--src', opts.src] : []),
      ...(opts.minMessages > 1 ? ['--min-messages', String(opts.minMessages)] : []),
      ...(opts.limit ? ['--limit', String(opts.limit)] : []),
    ],
    onLine: (line) => {
      for (const l of relay.write(line)) emit(l);
    },
  });

  // 3. 终结：Python 没吐结果行（崩溃 / 起不动）→ 中继补兜底结果行
  for (const l of relay.finish(
    run.code,
    run.stderr,
    run.error ? sync.classifySyncSpawnFailure(run.error, opts.python) : undefined,
  )) {
    emit(l);
  }
  // 0 = 跑完（单联系人失败看 [bz-result].failed）；非 0 归一成 1（2 留给用法错误）
  return run.code === 0 ? 0 : 1;
}

async function main() {
  const argv = process.argv.slice(2);
  const first = argv.find((a) => !String(a).startsWith('-'));
  if (first === 'sync') {
    const parsed = sync.parseSyncArgv(argv);
    if (parsed.error) {
      console.error(`bz-face：${parsed.error}\n\n${USAGE}`);
      return 2;
    }
    if (parsed.version) {
      console.log(`bz-face v${pkg.version}（@jwbz/obsidian-face）`);
      return 0;
    }
    if (parsed.help) {
      console.log(USAGE);
      return 0;
    }
    return cmdSync({
      dataRoot: parsed.dataRoot,
      python: parsed.python,
      src: parsed.src,
      minMessages: parsed.minMessages,
      limit: parsed.limit,
    });
  }
  const parsed = core.parseDoctorArgv(argv);
  if (parsed.error) {
    console.error(`bz-face：${parsed.error}\n\n${USAGE}`);
    return 2;
  }
  if (parsed.version) {
    console.log(`bz-face v${pkg.version}（@jwbz/obsidian-face）`);
    return 0;
  }
  if (parsed.help || !parsed.command) {
    console.log(USAGE);
    return parsed.help ? 0 : 2;
  }
  if (parsed.command === 'doctor') {
    return cmdDoctor({ dataRoot: parsed.dataRoot, python: parsed.python });
  }
  console.error(`bz-face：未知命令「${parsed.command}」\n\n${USAGE}`);
  return 2;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((e) => {
    // 兜底闸：到这里说明 CLI 骨架自身出错（探测与判定层已各自兜错），给一句人话不抛栈
    console.error(`bz-face 意外终止：${(e && e.message) || String(e)}`);
    process.exitCode = 1;
  });
