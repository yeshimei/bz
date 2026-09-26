#!/usr/bin/env node
// ================================================================
// bz-face —— 包仔脸谱工具包 CLI（@jwbz/obsidian-face）
//
// 本票（issue 463）只开一个子命令：
//   bz-face doctor [--data-root <路径>] [--python <命令>]
//     环境自检：Python 版本 / 解密组与转写组依赖 / ffmpeg / ffprobe /
//     微信进程与版本 / 数据根可写性。逐行打「✓ 通过 / ✗ 缺失 + 可直接粘贴的
//     修复命令」；任何单项缺失都不抛栈、不中断其余检查。
//
//     --data-root   数据根路径（同步产出根 = 画脸谱读入根）；不给则该行显示「未配置」，
//                   不算失败。
//     --python      Python 命令覆盖（缺省 'python'；如 'py -3.12' 这类含空格命令
//                   请自行确保可被 execFile 直启，或用指向 python.exe 的完整路径）。
//
//   bz-face --version / --help
//
// 同步（sync）与预处理（prep <联系人>）是后续票（464 / 468）：python/ 下已收编
// 解密链脚本与裁剪版上游库，CLI 接线到货再开子命令。
//
// 退出码：0 = doctor 跑完（有缺失项也算——本命令的产物是「报告」不是「成功/失败」）；
//         2 = 用法错误（未知子命令 / 参数）。
// 绝不自动安装：doctor 只打印修复命令，不执行 pip / winget（README 与 ADR-0195）。
// ================================================================
'use strict';

const path = require('path');
const core = require('../lib/doctor-core');
const probes = require('../lib/probes');

const pkg = require('../package.json');

const USAGE = [
  `bz-face（@jwbz/obsidian-face）v${pkg.version} —— 包仔脸谱工具包`,
  '',
  '用法：',
  '  bz-face doctor [--data-root <路径>] [--python <命令>]',
  '      环境自检：Python / 解密组依赖 / 转写组依赖 / ffmpeg / ffprobe / 微信进程与版本 /',
  '      数据根可写性。逐行打「通过/缺失 + 可直接粘贴的修复命令」，单项缺失不中断。',
  '  bz-face --version',
  '',
  '选项：',
  '  --data-root, -d <路径>   数据根路径（不给则显示「未配置」，不算失败）',
  '  --python, -p <命令>      Python 命令覆盖（缺省 python）',
  '  --help, -h               本说明',
  '',
  '同步（sync）与预处理（prep）命令由后续票提供（python/ 侧脚本已收编）。',
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

async function main() {
  const parsed = core.parseDoctorArgv(process.argv.slice(2));
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
