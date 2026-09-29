#!/usr/bin/env node
// ================================================================
// bz-face —— 包仔脸谱工具包 CLI（@jwbz/obsidian-face）
//
// 子命令：
//   bz-face prep <联系人> --data-root <路径> [--python <命令>] [--src <账号目录>]
//                 [--ffmpeg <路径>] [--derive-edge N] [--derive-quality N]
//                 [--asr-engine sensevoice|faster-whisper] [--asr-model <名>] [--limit N]
//     单联系人重活（issue 468 / ADR-0196 决策 1 的 prep 段）：媒体导出（语音 silk→wav、
//     图片 .dat 解码 + wxgf 就地转 jpg/gif、视频、文件、缩略图）→ 派生图片档（原图 →
//     长边/质量可配，缩略图绝不当 AI 输入）→ image_map.json 图片↔消息关联 → 本地语音转写
//     → voice.json 转写表。**绝不写回 chat.json**（语音仍 [语音 N秒]、图片仍 [图片]）。
//     幂等可续（重复执行只补缺口）；协作式让行：<数据根>/.bz-face/control.json 出现
//     {"action":"pause"} 在步骤边界与每条媒体之间待命（进程不退出不丢进度），stop 则留状态
//     退出（结果行带 stopped:true）。stdout 只产四行协议行（phase ∈ media/derive/map/transcribe），
//     Python 行原样透传，Node 只补预检行与兜底结果行；退出码 0 = 跑完（单条失败看结果行
//     failed:N；stopped 也算 0）、1 = 硬失败（联系人 / chat.json / 解密库缺失、引擎加载失败）、
//     2 = 用法错误。
//
//   bz-face sync --data-root <路径> [--python <命令>] [--src <账号目录>]
//                [--min-messages N] [--limit N]
//     一次跑完（issue 464 / ADR-0196 决策 1；485 变轻）：取密钥 → 解密数据库 →
//     逐联系人统计（消息 / 语音 / 图片 / 语音时长 / 最新消息，SQL 聚合写 stats.json，
//     不读消息正文）→ 头像源落位。**不再产出 chat.json**——全量消息由 export 子命令
//     按需导出。转写 / 媒体导出 / 图片描述不在 sync（468 的 prep 接管）。
//     stdout 只产 [bz-step]/[bz-p]/[bz-info]/[bz-result] 四行协议——本命令是给
//     插件编排消费的长任务（465 数据源同步按钮驱动），Python 的行原样透传，
//     Node 只补预检行与兜底结果行；退出码 0 = 跑完（单联系人失败看结果行 failed:N）、
//     1 = 硬失败（微信未运行 / 版本被封堵 / 解密失败，绝不静默降级读旧目录）、
//     2 = 用法错误。幂等可重复跑（产物字节比对，没变不写）。
//
//   bz-face export --data-root <路径> --contact <目录名> [--contact <目录名> …]
//                  [--python <命令>] [--src <账号目录>]
//     按需全量导出（issue 485）：对指定联系人走既有 export_flow 生成 chat.json + 头像。
//     不取密钥（只用数据根缓存 key.json）、不要求微信在跑；解密照跑（增量缓存全命中时秒过）。
//     供插件在「导入所选」时只对勾选者起本命令——单人两万条量级秒级完成。
//     协议 / 退出码同 sync；结果行带 mode:"export"（sync 轮为 mode:"stats"）。
//
//   bz-face rec <录音文件名> --data-root <路径> --contact <目录名> [--python <命令>] [--ffmpeg <路径>]
//     录音说话人分离 + 逐轮转写（issue 509 / ADR-0213、0214；方案 C，经真值校准）：
//     对 <数据根>/<联系人>/recordings/<录音> 跑 VAD 门控 → CAM++ 密滑窗（1s/0.25s）+
//     两状态 Viterbi（质心 = <数据根>/voiceprints/<联系人>.npz，降级阶梯 dual → me-only
//     → blind）→ SenseVoice 逐轮转写带情感。phase 账本断点续跑：sidecar <录音>.turns.json
//     逐阶段落账（vad / 声纹窗逐块 / 转写逐轮），中断续跑只补缺口；续跑时质心降级口径
//     变了会整体重算声纹段（两种口径绝不混账）。协作式让行走 <数据根>/.bz-face/
//     rec-control/<联系人>/<文件名>.control.json（按任务独立，并发录音互不串台）——pause 在安全点待命（模型不卸载），
//     stop 留账本退出（退出码 0）。
//     **进度权威在 sidecar.progress**（插件轮询渲染；stdout 打印仅供人看，不走四行协议）；
//     退出码 0 = 跑完 / 协作停止、1 = 硬失败（录音 / 联系人目录缺失、引擎加载失败）、2 = 用法错误。
//
//   bz-face refs --data-root <路径> --contact <目录名> [--contact <目录名> …] [--python <命令>]
//     构建联系人声纹参考质心（rec 的比对基准）：chat.json type=34 的 who 标签 ×
//     voice/*.wav 分池嵌入取均值，产 <数据根>/voiceprints/<联系人>.npz（原子写）。
//     增量构建：meta 存全局输入指纹，输入没变直接跳过（「我」池跨人采样，任一变化全体重建）。
//     缺 peer（联系人语音样本不足）只存 me = me-only，分离按「非我即对方」降级；两位都缺则
//     跳过（stdout △ 行）。退出码 0 = 跑完（单人跳过不算失败）、1 = 硬失败、2 = 用法错误。
//
//   bz-face status <联系人> --data-root <路径>
//     联系人产物体检（issue 510；纯 Node 读盘，不起 Python）：chat.json / stats.json /
//     voice/ + voice.json / image/ + desc/ + image_map.json / recordings/ + sidecar /
//     质心 npz 各一行——✓ 在且有货、△ 在但空、✗ 缺（附下一步命令）。
//     （人读纯文本，不走协议。）退出码 0 = 报告出得来、1 = 联系人目录不存在、2 = 用法错误。
//
//   bz-face capabilities
//     机器可读能力声明（issue 510）：一行 [bz-result] {"ok":true,"version":…,"commands":[…]}，
//     供插件 spawn 前探测包版本与子命令支持面（旧版到点按钮才失败 → 提前人话提示）。
//     退出码 0；用法错误 2。
//
//   bz-face doctor [--data-root <路径>] [--python <命令>]
//     环境自检：Python 版本 / 解密组与转写组依赖 / ffmpeg / ffprobe /
//     微信进程与版本 / 数据根可写性 / 录音环境（声纹参考 · 补充素材录音 · 模型权重缓存，
//     issue 510——数据根配置了才查，缺了 warn 不 fail）。逐行打「✓ 通过 / ✗ 缺失 + 可直接粘贴的
//     修复命令」；任何单项缺失都不抛栈、不中断其余检查。（人读纯文本，不走协议。）
//
//   bz-face --version / --help
//
// 预检与转发链路：probeWeixin / probeDataRoot / probeContactDir（lib/probes）→
// judgeSyncPreflight / judgePrepPreflight + createSyncRelay / createPrepRelay
// （lib/sync-core、lib/prep-core）→ runSyncProcess 起子进程逐行转发。
//
// 退出码：doctor / status 0 = 跑完（有缺失项也算——产物是「报告」）；sync / prep 见上；2 = 用法错误。
// 绝不自动安装：doctor 只打印修复命令，sync / prep 只报中文引导，不执行 pip / winget
// （README 与 ADR-0195）。
// ================================================================
'use strict';

const path = require('path');
const fs = require('fs');
const core = require('../lib/doctor-core');
const sync = require('../lib/sync-core');
const prep = require('../lib/prep-core');
const exportCore = require('../lib/export-core');
const rec = require('../lib/rec-core');
const status = require('../lib/status-core');
const probes = require('../lib/probes');

const pkg = require('../package.json');

const SYNC_STEPS_TEXT = sync
  .buildSyncPlan()
  .map((p, i) => `      ${i + 1}. ${p.label}——${p.detail}`)
  .join('\n');

const PREP_STEPS_TEXT = prep
  .buildPrepPlan()
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
  '      产物全落数据根：<数据根>/<联系人>/stats.json（统计）、avatar.<ext>；',
  '      全量 chat.json 由 bz-face export 按需导出。',
  '      密钥与解密库在 <数据根>/.bz-face/ 下。幂等可重复跑。',
  '      stdout 为四行协议（[bz-step]/[bz-p]/[bz-info]/[bz-result]），供插件编排消费；',
  '      微信未运行 / 版本被封堵 / 解密失败 → 立即失败并给中文引导，不静默降级。',
  '  bz-face export --data-root <路径> --contact <目录名> [--contact <目录名> …]',
  '                  [--contacts-file <文件>] [--python <命令>] [--src <账号目录>]',
  '      按需全量导出（不需要微信在跑，吃 sync 的缓存密钥与解密库）：',
  '      对指定联系人生成 chat.json（文本 / [表情·名] / 图片定位 / 语音时长）+ 头像源。',
  '      --contact 可重复传多个——插件在「导入所选」时只对勾选者起本命令；名单长用',
  '      --contacts-file（一行一个，# 注释，兼容 、/,/; 分隔）绕命令行长度上限。',
  '      幂等可重复跑（chat.json / 头像字节比对，没变不写）。',
  '  bz-face prep <联系人> --data-root <路径> [--python <命令>] [--src <账号目录>]',
  '                [--ffmpeg <路径>] [--derive-edge N] [--derive-quality N]',
  '                [--asr-engine sensevoice|faster-whisper] [--asr-model <名>] [--limit N]',
  `      对一位联系人跑重活（不需要微信在跑，吃 sync 的产物）：`,
  PREP_STEPS_TEXT,
  '      产物落 <数据根>/<联系人>/：voice/*.wav、image|thumb|video|file/<月>/、',
  '      desc/<月>/ 派生图片档、image_map.json 关联表、voice.json 转写表——',
  '      **绝不写回 chat.json**。幂等可续（重复执行只补缺口）；协作式暂停 / 中断走',
  '      <数据根>/.bz-face/control.json：{"action":"pause"} 在安全点待命（进程不退出），',
  '      {"action":"stop"} 留状态退出（结果行带 stopped:true）。转写引擎 / ffmpeg /',
  '      派生档参数全部走 CLI 显式传参（插件侧接线时下发设置值）。',
  '  bz-face rec <录音文件名> --data-root <路径> --contact <目录名> [--python <命令>] [--ffmpeg <路径>]',
  '      录音说话人分离 + 逐轮转写（补充素材的录音；不需要微信在跑）：',
  '      VAD 门控 → CAM++ 密滑窗 + 两状态 Viterbi → SenseVoice 逐轮转写带情感。',
  '      质心 = <数据根>/voiceprints/<联系人>.npz（bz-face refs 产；缺质心按降级阶梯照跑；',
  '      续跑时降级口径变了会重算声纹段）。sidecar <录音>.turns.json 逐阶段落账、断点续跑',
  '      只补缺口——进度权威在 sidecar，插件轮询渲染（stdout 仅供人看）。done 后由插件把',
  '      轮次并进聊天仓。协作式暂停 / 停止走 <数据根>/.bz-face/rec-control/<联系人>/',
  '      <文件名>.control.json（按任务独立，并发录音互不串台，与 prep 的 control.json 无共享）：',
  '      {"action":"pause"} 在安全点待命（模型不卸载），',
  '      {"action":"stop"} 留账本退出（退出码 0）。',
  '  bz-face refs --data-root <路径> --contact <目录名> [--contact <目录名> …] [--python <命令>]',
  '      构建联系人声纹参考质心（rec 的比对基准）：chat.json who 标签 × voice/*.wav 分池均值，',
  '      产 <数据根>/voiceprints/<联系人>.npz（原子写；增量——输入指纹没变直接跳过）。',
  '      缺 peer 只存 me（分离时非我即对方），两位都缺则跳过该联系人（不算硬失败）。',
  '      dual 时另用留出样本的**窗级** max-sim 最小值留余量算出旁音门限，写进 npz meta。',
  '  bz-face check --data-root <路径> --contact <目录名> --src <录音绝对路径> [--src …] [--python <命令>] [--ffmpeg <路径>]',
  '      导入前归属抽检（issue 516）：对每个 --src 均匀抽 3 段各 3s 嵌入，与 me / peer 质心比对——',
  '      都不像则末行 [bz-result] 报 verdicts[<src>]=stranger（插件提示「可能选错了录音」，不硬拦）。',
  '      质心缺失 / 只有 me / 抽检失败 → verdict=unknown（不做判定，放行）。',
  '  bz-face status <联系人> --data-root <路径>',
  '      联系人产物体检（纯 Node 读盘，不起 Python）：chat / stats / voice / image / desc /',
  '      关联表 / 录音 sidecar / 质心各一行，缺的给下一步命令（人读纯文本）。',
  '  bz-face capabilities',
  '      机器可读能力声明：一行 [bz-result] 报包版本与子命令支持面（插件探测用）。',
  '  bz-face doctor [--data-root <路径>] [--python <命令>]',
  '      环境自检：Python / 解密组依赖 / 转写组依赖 / ffmpeg / ffprobe / 微信进程与版本 /',
  '      数据根可写性 / 录音环境（声纹参考 · 录音体量 · 模型权重缓存；数据根配置了才查）。',
  '      逐行打「通过/缺失 + 可直接粘贴的修复命令」，单项缺失不中断。',
  '  bz-face --version',
  '',
  '选项：',
  '  --data-root, -d <路径>   数据根路径（sync / export / prep / status 必填；doctor 不给则显示「未配置」）',
  '  --python, -p <命令>      Python 命令覆盖（缺省 python；含空格命令请用 python.exe 完整路径）',
  '  --src <账号目录>         sync / export / prep：微信账号目录覆盖（sync 默认当前微信数据目录；',
  '                           export / prep 默认取 .bz-face/key.json 的 source_dir）',
  '  --contact <目录名>       export / refs：联系人目录名（可重复传多个；来自 sync 产物的数据根目录）',
  '  --contacts-file <文件>   export：联系人名单文件（一行一个，# 注释；绕命令行长度上限）',
  '  --min-messages N         sync：少于该条数的联系人不落盘（默认 1 = 全量非空）',
  '  --limit N                sync / prep：调试用限制处理量（sync 限联系人数；prep 限各段条数；',
  '                           默认 0 = 不限）',
  '  --ffmpeg <路径>          prep / rec：ffmpeg 命令 / 路径（prep wxgf 解码、rec 音频转 16k wav；',
  '                           默认 ffmpeg）',
  '  --derive-edge N          prep：派生图片档长边像素（默认 1280，≥64）',
  '  --derive-quality N       prep：派生图片档 JPEG 质量（默认 80，1～100）',
  '  --asr-engine <名>        prep：语音转写引擎（sensevoice | faster-whisper；默认 sensevoice）',
  '  --asr-model <名>         prep：faster-whisper 档位（默认 small）',
  '  --help, -h               本说明',
  '',
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
    // 录音环境三项（issue 510）：判定层只在数据根配置了才出场；探测本身幂等便宜
    voiceprints: () => probes.probeVoiceprints(opts.dataRoot),
    recordings: () => probes.probeRecordings(opts.dataRoot),
    modelCache: () => probes.probeModelCache(),
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

  // 1. 预检（探测层各自兜错绝不抛）：微信进程与版本、数据根存在可写；
  //    数据根有缓存密钥（.bz-face/key.json）→ 解密链不依赖微信，跳过微信两道检查
  const [wechat, dataRoot] = await Promise.all([
    probes.probeWeixin(),
    Promise.resolve(probes.probeDataRoot(opts.dataRoot)),
  ]);
  const cachedKeyPath = path.join(opts.dataRoot || '', '.bz-face', 'key.json');
  const cachedKey = !!opts.dataRoot && fs.existsSync(cachedKeyPath);
  const pre = sync.judgeSyncPreflight({ wechat, dataRoot }, { cachedKey });
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

async function cmdExport(opts) {
  // 485 按需导出：与 sync 同一套中继 / 管道，预检换成 export 口径（不探微信——
  // export 不取密钥，只吃数据根缓存；缺密钥 / 缺解密库 / 目录名缺席都硬失败给中文引导）。
  const relay = sync.createSyncRelay('bz-face export --contact');
  const emit = (line) => {
    if (line) console.log(line);
  };

  const dataRoot = probes.probeDataRoot(opts.dataRoot);
  const cachedKey = !!opts.dataRoot && fs.existsSync(path.join(opts.dataRoot, '.bz-face', 'key.json'));
  const hasDecrypted = !!opts.dataRoot && fs.existsSync(path.join(opts.dataRoot, '.bz-face', 'decrypted'));
  const missingContacts = (opts.contacts || []).filter(
    (c) => {
      try {
        return !fs.statSync(path.join(opts.dataRoot || '', c)).isDirectory();
      } catch {
        return true;
      }
    },
  );
  const pre = exportCore.judgeExportPreflight(
    { dataRoot },
    { contacts: opts.contacts || [], cachedKey, hasDecrypted, missingContacts },
  );
  if (!pre.ok) {
    // 硬失败：结果行（给插件）+ stderr（给人），退出码 1——没有前置产物就没有可导出的东西
    emit(sync.formatBzLine('result', { ok: false, error: pre.error }));
    console.error(`bz-face export：${pre.error}`);
    return 1;
  }

  // 起子进程：stdout 逐行透传（协议行原样），stderr 留尾由终结兜底用
  emit(sync.formatBzLine('step', `预检通过：数据根可写、缓存密钥与解密库在位，导出 ${opts.contacts.length} 位联系人`));
  const run = await probes.runSyncProcess({
    pythonCmd: opts.python,
    scriptPath: path.join(__dirname, '..', 'python', 'bz_sync.py'),
    args: [
      '--data-root',
      opts.dataRoot,
      ...(opts.src ? ['--src', opts.src] : []),
      ...opts.contacts.flatMap((c) => ['--contact', c]),
    ],
    onLine: (line) => {
      for (const l of relay.write(line)) emit(l);
    },
  });

  // 终结：Python 没吐结果行（崩溃 / 起不动）→ 中继补兜底结果行
  for (const l of relay.finish(
    run.code,
    run.stderr,
    run.error ? sync.classifySyncSpawnFailure(run.error, opts.python) : undefined,
  )) {
    emit(l);
  }
  // 0 = 跑完（单人失败看 [bz-result].failed，与 sync 同口径）；非 0 归一成 1（2 留给用法错误）
  return run.code === 0 ? 0 : 1;
}

async function cmdPrep(opts) {
  const relay = prep.createPrepRelay();
  const emit = (line) => {
    if (line) console.log(line);
  };

  // 1. 预检（探测层各自兜错绝不抛）：数据根存在可写、联系人目录与 chat.json 在位。
  //    prep 不取密钥、不需要微信在跑——它只吃 sync 已落盘的解密库与媒体源。
  const [dataRoot, contact] = await Promise.all([
    Promise.resolve(probes.probeDataRoot(opts.dataRoot)),
    Promise.resolve(probes.probeContactDir(opts.dataRoot, opts.contact)),
  ]);
  const pre = prep.judgePrepPreflight({ dataRoot, contact });
  if (!pre.ok) {
    // 硬失败：结果行（给插件）+ stderr（给人），退出码 1——没有 sync 产物就没有可对齐的消息流
    emit(prep.formatBzLine('result', { ok: false, error: pre.error }));
    console.error(`bz-face prep：${pre.error}`);
    return 1;
  }

  // 2. 起子进程：stdout 逐行透传（协议行原样），stderr 留尾由终结兜底用
  // 不再打「预检通过：…启动预处理」这类 step：它只活一帧，紧接着就被工具侧
  // 第一行 [bz-p]（`媒体导出 0/1631`）接管——进度行本身就是「动作 + 数量」
  const run = await probes.runSyncProcess({
    pythonCmd: opts.python,
    scriptPath: path.join(__dirname, '..', 'python', 'bz_prep.py'),
    args: [
      '--data-root',
      opts.dataRoot,
      '--name',
      opts.contact,
      ...(opts.src ? ['--src', opts.src] : []),
      ...(opts.ffmpeg ? ['--ffmpeg', opts.ffmpeg] : []),
      '--derive-edge',
      String(opts.deriveEdge),
      '--derive-quality',
      String(opts.deriveQuality),
      '--asr-engine',
      opts.asrEngine,
      ...(opts.asrEngine === 'faster-whisper' ? ['--asr-model', opts.asrModel] : []),
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
    run.error ? prep.classifyPrepSpawnFailure(run.error, opts.python) : undefined,
  )) {
    emit(l);
  }
  // 0 = 跑完（单条失败 / stopped 都看 [bz-result]，与 sync 同口径）；非 0 归一成 1（2 留给用法错误）
  return run.code === 0 ? 0 : 1;
}

/**
 * rec / refs 共用：预检失败 = [bz-result] 一行 + stderr 一句 + 退出码 1；
 * 预检过 = 起子进程，stdout 逐行透传（进度权威在 sidecar，行不解析只转发）。
 */
async function runRecLike(opts) {
  const emit = (line) => {
    if (line) console.log(line);
  };
  const dataRoot = probes.probeDataRoot(opts.dataRoot);
  const pre = opts.kind === 'refs'
    ? rec.judgeRefsPreflight(
        { dataRoot },
        {
          contacts: opts.contacts || [],
          missingContacts: (opts.contacts || []).filter((c) => !rec.contactDirExists(opts.dataRoot, c)),
        },
      )
    : rec.judgeRecPreflight(
        { dataRoot, contact: opts.contact, file: opts.file },
        {
          contactDirExists: rec.contactDirExists(opts.dataRoot, opts.contact),
          recordingExists: rec.recordingExists(opts.dataRoot, opts.contact, opts.file),
        },
      );
  if (!pre.ok) {
    emit(sync.formatBzLine('result', { ok: false, error: pre.error }));
    console.error(`bz-face ${opts.kind}：${pre.error}`);
    return 1;
  }
  const scriptName = opts.kind === 'refs' ? 'bz_refs.py' : 'bz_rec.py';
  const scriptPath = path.join(__dirname, '..', 'python', scriptName);
  const args = opts.kind === 'refs'
    ? [
        '--data-root', opts.dataRoot,
        ...(opts.contacts || []).flatMap((c) => ['--contact', c]),
      ]
    : [
        '--data-root', opts.dataRoot,
        '--contact', opts.contact,
        '--file', opts.file,
        ...(opts.ffmpeg ? ['--ffmpeg', opts.ffmpeg] : []),
      ];
  const run = await probes.runSyncProcess({ pythonCmd: opts.python, scriptPath, args, onLine: (line) => emit(line) });
  // 脚本崩溃没交代 → 兜底结果行（进度权威在 sidecar，这行只是让插件进程终结有据可查）
  if (run.code !== 0) {
    emit(sync.formatBzLine('result', { ok: false, error: `bz-face ${opts.kind} 异常退出（退出码 ${run.code ?? '无'}）` }));
  }
  return run.code === 0 ? 0 : 1;
}

async function cmdRec(opts) {
  return runRecLike({ ...opts, kind: 'rec' });
}

async function cmdRefs(opts) {
  return runRecLike({ ...opts, kind: 'refs' });
}

/** check：导入前的录音归属抽检（issue 516 Q15）——末行 [bz-result] 带 verdicts，插件据此提示。 */
async function cmdCheck(opts) {
  const emit = (line) => {
    if (line) console.log(line);
  };
  // 只读：源文件 + <数据根>/voiceprints 质心。数据根 / 联系人目录不在位就没判据。
  const dataRoot = probes.probeDataRoot(opts.dataRoot);
  if (!dataRoot.configured || !dataRoot.exists) {
    const error = `数据根不在位：${opts.dataRoot}——先在设置里确认数据源目录（质心也从这里来）`;
    emit(sync.formatBzLine('result', { ok: false, error }));
    console.error(`bz-face check：${error}`);
    return 1;
  }
  if (!rec.contactDirExists(opts.dataRoot, opts.contact)) {
    const error = `<数据根>/${opts.contact}/ 不在位——先做数据源导入（质心也从这里来）`;
    emit(sync.formatBzLine('result', { ok: false, error }));
    console.error(`bz-face check：${error}`);
    return 1;
  }
  const scriptPath = path.join(__dirname, '..', 'python', 'bz_check.py');
  const args = [
    '--data-root', opts.dataRoot,
    '--contact', opts.contact,
    ...(opts.srcs || []).flatMap((s) => ['--src', s]),
    ...(opts.ffmpeg ? ['--ffmpeg', opts.ffmpeg] : []),
  ];
  const run = await probes.runSyncProcess({ pythonCmd: opts.python, scriptPath, args, onLine: (line) => emit(line) });
  if (run.code !== 0) {
    emit(sync.formatBzLine('result', { ok: false, error: `bz-face check 异常退出（退出码 ${run.code ?? '无'}）` }));
  }
  return run.code === 0 ? 0 : 1;
}

/** status：采集 + 报告（纯 Node 读盘，不起 Python）。退出码 0 = 报告出得来，1 = 联系人目录不在。 */
async function cmdStatus(opts) {
  const facts = status.collectStatusFacts(opts.dataRoot, opts.contact);
  const { lines, missing } = status.formatStatusReport(opts.dataRoot, opts.contact, facts);
  for (const l of lines) console.log(l);
  return missing < 0 ? 1 : 0;
}

/** capabilities：一行 [bz-result] 报包版本与子命令支持面（插件探测用；用法错误 2）。 */
async function cmdCapabilities() {
  console.log(
    sync.formatBzLine('result', {
      ok: true,
      package: 'bz-face',
      name: pkg.name,
      version: pkg.version,
      commands: ['sync', 'export', 'prep', 'rec', 'refs', 'check', 'status', 'doctor', 'capabilities'],
    }),
  );
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const first = argv.find((a) => !String(a).startsWith('-'));
  if (first === 'prep') {
    const parsed = prep.parsePrepArgv(argv);
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
    return cmdPrep({
      contact: parsed.contact,
      dataRoot: parsed.dataRoot,
      python: parsed.python,
      src: parsed.src,
      ffmpeg: parsed.ffmpeg,
      deriveEdge: parsed.deriveEdge,
      deriveQuality: parsed.deriveQuality,
      asrEngine: parsed.asrEngine,
      asrModel: parsed.asrModel,
      limit: parsed.limit,
    });
  }
  if (first === 'export') {
    const parsed = exportCore.parseExportArgv(argv);
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
    // --contacts-file 展开（issue 510）：文件读不动 = 用法错误；名单并到 --contact 之后，去重保序
    let contacts = parsed.contacts;
    if (parsed.contactsFile) {
      let text;
      try {
        text = fs.readFileSync(parsed.contactsFile, 'utf8');
      } catch (e) {
        console.error(`bz-face：名单文件读不出：${parsed.contactsFile}（${(e && e.message) || e}）\n\n${USAGE}`);
        return 2;
      }
      const fromFile = exportCore.parseContactsFileText(text);
      if (!fromFile.length) {
        console.error(`bz-face：名单文件是空的（一行一个联系人，# 注释行）：${parsed.contactsFile}\n\n${USAGE}`);
        return 2;
      }
      contacts = [...new Set([...contacts, ...fromFile])];
    }
    return cmdExport({
      dataRoot: parsed.dataRoot,
      contacts,
      python: parsed.python,
      src: parsed.src,
    });
  }
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
  if (first === 'rec') {
    const parsed = rec.parseRecArgv(argv);
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
    return cmdRec({ file: parsed.file, dataRoot: parsed.dataRoot, contact: parsed.contact, python: parsed.python, ffmpeg: parsed.ffmpeg });
  }
  if (first === 'refs') {
    const parsed = rec.parseRefsArgv(argv);
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
    return cmdRefs({ dataRoot: parsed.dataRoot, contacts: parsed.contacts, python: parsed.python });
  }
  if (first === 'check') {
    const parsed = rec.parseCheckArgv(argv);
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
    return cmdCheck({ dataRoot: parsed.dataRoot, contact: parsed.contact, srcs: parsed.srcs, python: parsed.python, ffmpeg: parsed.ffmpeg });
  }
  if (first === 'status') {
    const parsed = status.parseStatusArgv(argv);
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
    return cmdStatus({ contact: parsed.contact, dataRoot: parsed.dataRoot });
  }
  if (first === 'capabilities') {
    const rest = argv.filter((a) => a !== 'capabilities' && !String(a).startsWith('-'));
    const flags = argv.filter((a) => String(a).startsWith('-') && !['--help', '-h', '--version', '-v'].includes(a));
    if (rest.length || flags.length) {
      console.error(`bz-face：capabilities 不收参数（只支持 --help / --version）\n\n${USAGE}`);
      return 2;
    }
    const parsed = core.parseDoctorArgv(argv);
    if (parsed.version) {
      console.log(`bz-face v${pkg.version}（@jwbz/obsidian-face）`);
      return 0;
    }
    if (parsed.help) {
      console.log(USAGE);
      return 0;
    }
    return cmdCapabilities();
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
