// @vitest-environment node
/**
 * 脸谱工具包 bz-face doctor 判定层测试（issue 463 / ADR-0195）。
 *
 * 被测对象是包内的纯判定层 tools/obsidian-face/lib/doctor-core.js（CommonJS）——
 * 注入探测结果假件即可覆盖全部分支，**不真跑 doctor 子进程、不探测真实环境**。
 * CLI（bin/bz-face.js）只是「采集真探测 → 调判定层 → 打印」的薄壳，不在本文件测。
 *
 * 覆盖：版本判定（Python 下限 / 微信封堵线与退回指引）、依赖组缺失 → 对应组那行
 * 安装命令（组间不串）、单项探测抛异常 → 该项缺失且不中断其余项、数据根未配置中性。
 */
import { describe, it, expect } from 'vitest';
import {
  compareDotVersions,
  collectDoctorProbes,
  runDoctorChecks,
  judgeWechat,
  judgeDataRoot,
  parseDoctorArgv,
  formatDoctorLine,
  DECRYPT_DEPS,
  TRANSCRIBE_DEPS,
  MIN_PYTHON_VERSION,
  WECHAT_BLOCKED_VERSION,
  WECHAT_ROLLBACK_VERSION,
} from '../../tools/obsidian-face/lib/doctor-core.js';
import type { DoctorLine } from '../../tools/obsidian-face/lib/doctor-core.js';

/** 依赖组探测结果的假件工厂：ok 集合之外全部判缺 */
function depResults(deps: { mod: string }[], okMods: string[], failMods: string[] = []) {
  const results: Record<string, { ok: boolean; error?: string }> = {};
  for (const d of deps) {
    if (okMods.includes(d.mod)) results[d.mod] = { ok: true };
    else if (failMods.includes(d.mod)) results[d.mod] = { ok: false, error: `No module named '${d.mod}'` };
    else results[d.mod] = { ok: false };
  }
  return { ok: true, results };
}

/** 全绿探测结果（个别项按需覆盖） */
function greenResults(overrides: Record<string, unknown> = {}) {
  return {
    python: { ok: true, version: '3.12.8' },
    decryptDeps: depResults(DECRYPT_DEPS, DECRYPT_DEPS.map((d) => d.mod)),
    transcribeDeps: depResults(TRANSCRIBE_DEPS, TRANSCRIBE_DEPS.map((d) => d.mod)),
    ffmpeg: { ok: true, found: true, version: '8.1.2' },
    ffprobe: { ok: true, found: true, version: '8.1.2' },
    wechat: { ok: true, running: true, version: '4.0.3.19' },
    dataRoot: { configured: false },
    ...overrides,
  };
}

const lineOf = (lines: DoctorLine[], key: string): DoctorLine | undefined => lines.find((l) => l.key === key);

describe('bz-face doctor 判定层（issue 463）', () => {
  describe('版本判定纯函数', () => {
    it('点分版本比较：逐段数值比，不是字符串比', () => {
      expect(compareDotVersions('4.0.3.36', '4.0.3.36')).toBe(0);
      expect(compareDotVersions('4.0.3.9', '4.0.3.36')).toBe(-1); // 字符串比会错判 '9' > '36'
      expect(compareDotVersions('4.0.4.0', '4.0.3.36')).toBe(1);
      expect(compareDotVersions('3.10', '3.9')).toBe(1);
      expect(compareDotVersions('3.10.0', '3.10')).toBe(0); // 缺段按 0 兜底
    });

    it('封堵线常量：≥ 4.0.3.36 封堵，退回 4.0.3.19', () => {
      expect(WECHAT_BLOCKED_VERSION).toEqual([4, 0, 3, 36]);
      expect(WECHAT_ROLLBACK_VERSION).toBe('4.0.3.19');
      expect(MIN_PYTHON_VERSION).toEqual([3, 10]);
    });
  });

  describe('全绿 → 全部通过', () => {
    it('各检查项 pass，无修复命令，allPass 为真', () => {
      const { lines, failCount, allPass } = runDoctorChecks(greenResults());
      expect(failCount).toBe(0);
      expect(allPass).toBe(true);
      for (const key of ['python', 'decryptDeps', 'transcribeDeps', 'ffmpeg', 'ffprobe', 'wechat']) {
        expect(lineOf(lines, key)?.state).toBe('pass');
      }
      expect(lines.every((l) => !l.fix)).toBe(true);
    });
  });

  describe('依赖组缺失 → 只提示对应组的那行安装命令', () => {
    it('解密组缺 pymem/psutil：修复命令只含这两项，不串转写组', () => {
      const { lines } = runDoctorChecks(
        greenResults({
          decryptDeps: depResults(DECRYPT_DEPS, DECRYPT_DEPS.map((d) => d.mod).filter((m) => m !== 'pymem' && m !== 'psutil')),
        }),
      );
      const line = lineOf(lines, 'decryptDeps');
      expect(line?.state).toBe('fail');
      expect(line?.fix).toBe('python -m pip install pymem psutil');
      expect(lineOf(lines, 'transcribeDeps')?.state).toBe('pass'); // 转写组齐不受影响
    });

    it('转写组缺 funasr：修复命令只含 funasr，解密组不连坐', () => {
      const { lines } = runDoctorChecks(
        greenResults({
          transcribeDeps: depResults(TRANSCRIBE_DEPS, TRANSCRIBE_DEPS.map((d) => d.mod).filter((m) => m !== 'funasr')),
        }),
      );
      expect(lineOf(lines, 'transcribeDeps')?.fix).toBe('python -m pip install funasr');
      expect(lineOf(lines, 'decryptDeps')?.state).toBe('pass');
    });

    it('yara 缺失时追加 3.14 wheel 坑提示行', () => {
      const { lines } = runDoctorChecks(
        greenResults({
          decryptDeps: depResults(DECRYPT_DEPS, DECRYPT_DEPS.map((d) => d.mod).filter((m) => m !== 'yara')),
        }),
      );
      const note = lineOf(lines, 'decryptDeps-note');
      expect(note?.state).toBe('warn');
      expect(note?.text).toContain('3.14');
    });

    it('组探测整体失败（python 起不来）：给组清单兜底命令', () => {
      const { lines } = runDoctorChecks(greenResults({ decryptDeps: { ok: false, error: '找不到 python' } }));
      const line = lineOf(lines, 'decryptDeps');
      expect(line?.state).toBe('fail');
      expect(line?.fix).toContain('requirements-decrypt.txt');
    });
  });

  describe('Python 版本判定', () => {
    it('3.9 → fail + 安装命令；3.10 → pass；读不出 → fail', () => {
      const old = runDoctorChecks(greenResults({ python: { ok: true, version: '3.9.13' } }));
      const oldLine = lineOf(old.lines, 'python');
      expect(oldLine?.state).toBe('fail');
      expect(oldLine?.fix).toContain('Python.Python.3');

      const ok = runDoctorChecks(greenResults({ python: { ok: true, version: '3.10.0' } }));
      expect(lineOf(ok.lines, 'python')?.state).toBe('pass');

      const broken = runDoctorChecks(greenResults({ python: { ok: false, error: '找不到命令：python' } }));
      expect(lineOf(broken.lines, 'python')?.state).toBe('fail');
    });
  });

  describe('微信进程与版本判定（封堵线人话指引）', () => {
    it('未在跑 → fail，文案让人先打开并登录微信', () => {
      const line = judgeWechat({ ok: true, running: false });
      expect(line.state).toBe('fail');
      expect(line.text).toContain('未检测到微信进程');
      expect(line.fix).toContain('打开并登录微信');
    });

    it('只检测到微信 3.x → 文案点明本工具只支持 4.x', () => {
      const line = judgeWechat({ ok: true, running: false, wx3Running: true });
      expect(line.state).toBe('fail');
      expect(line.text).toContain('3.x');
    });

    it('4.0.3.19（封堵线下）→ pass；4.0.3.36 与 4.1 → fail + 退回版本号', () => {
      expect(judgeWechat({ ok: true, running: true, version: '4.0.3.19' }).state).toBe('pass');
      for (const v of ['4.0.3.36', '4.0.4.0', '4.1.0.27']) {
        const line = judgeWechat({ ok: true, running: true, version: v });
        expect(line.state).toBe('fail');
        expect(line.text).toContain('封堵');
        expect(line.fix).toContain(WECHAT_ROLLBACK_VERSION); // 退回指引必须带版本号
      }
    });

    it('在跑但版本读不出 → warn（不判死），提示 ≥ 封堵线将无法取密钥', () => {
      const line = judgeWechat({ ok: true, running: true, versionError: '版本号解析失败' });
      expect(line.state).toBe('warn');
      expect(line.text).toContain('4.0.3.36');
      expect(line.fix).toContain(WECHAT_ROLLBACK_VERSION);
    });

    it('探测层自身失败（tasklist 不可用）→ 状态未知 warn，不误报「未检测到」', () => {
      const line = judgeWechat({ ok: false, error: '进程查询失败' });
      expect(line.state).toBe('warn');
      expect(line.text).toContain('未知');
    });
  });

  describe('数据根：未配置中性、不可写给修复', () => {
    it('未配置 → neutral 行，不计失败，不影响 allPass', () => {
      const { lines, failCount, allPass } = runDoctorChecks(greenResults({ dataRoot: { configured: false } }));
      const line = lineOf(lines, 'dataRoot');
      expect(line?.state).toBe('neutral');
      expect(line?.text).toContain('未配置');
      expect(failCount).toBe(0);
      expect(allPass).toBe(true);
    });

    it('目录不存在 → fail + mkdir 命令；不可写 → fail；可写 → pass', () => {
      expect(judgeDataRoot({ configured: true, path: 'X:\\缺失', exists: false }).fix).toBe('mkdir "X:\\缺失"');
      const ro = judgeDataRoot({ configured: true, path: 'D:\\只读', exists: true, writable: false });
      expect(ro.state).toBe('fail');
      expect(ro.text).toContain('不可写');
      expect(judgeDataRoot({ configured: true, path: 'D:\\ok', exists: true, writable: true }).state).toBe('pass');
    });
  });

  describe('单项探测抛异常 → 该项缺失，其余项照常判定（绝不中断）', () => {
    it('collectDoctorProbes 把抛错折成 { ok:false, error }；判定层只红那一项', async () => {
      const results = await collectDoctorProbes({
        python: () => {
          throw new Error('探测子进程爆炸');
        },
        decryptDeps: () => depResults(DECRYPT_DEPS, DECRYPT_DEPS.map((d) => d.mod)),
        ffmpeg: () => ({ ok: true, found: false }), // 缺 ffmpeg：fail 但不炸
        wechat: () => {
          throw new Error('tasklist 权限不足');
        },
        // ffprobe / transcribeDeps / dataRoot 缺键 → missing 分支
      });
      expect(results.python).toMatchObject({ ok: false });
      expect(String(results.python.error)).toContain('爆炸');

      const { lines, failCount } = runDoctorChecks(results, { pkgRoot: '/pkg' });
      expect(lineOf(lines, 'python')?.state).toBe('fail');
      expect(lineOf(lines, 'python')?.text).toContain('探测子进程爆炸');
      expect(lineOf(lines, 'wechat')?.state).toBe('warn'); // 微信探测失败=状态未知
      expect(lineOf(lines, 'decryptDeps')?.state).toBe('pass'); // 其余项不受抛错项影响
      expect(lineOf(lines, 'ffprobe')?.state).toBe('fail'); // 缺键项降级为缺失
      expect(failCount).toBeGreaterThan(0);
      // 3 个抛错/缺键项之外，判定层仍完整输出了全部检查项
      expect(lines.map((l) => l.key)).toEqual(
        expect.arrayContaining(['python', 'decryptDeps', 'transcribeDeps', 'ffmpeg', 'ffprobe', 'wechat', 'dataRoot']),
      );
    });

    it('探测返回 null/非对象也折成失败，不抛', async () => {
      const results = await collectDoctorProbes({ python: () => null, ffmpeg: () => '怪返回' as unknown as Record<string, never> });
      expect(results.python).toMatchObject({ ok: false });
      expect(results.ffmpeg).toMatchObject({ ok: false });
    });
  });

  describe('CLI 参数解析（薄壳用）', () => {
    it('doctor + --data-root（空格与等号两种写法）+ --python', () => {
      expect(parseDoctorArgv(['doctor', '--data-root', 'E:\\数据根'])).toMatchObject({
        command: 'doctor',
        dataRoot: 'E:\\数据根',
      });
      expect(parseDoctorArgv(['doctor', '--data-root=E:\\数据根', '--python', 'py'])).toMatchObject({
        command: 'doctor',
        dataRoot: 'E:\\数据根',
        python: 'py',
      });
    });

    it('--version / --help；缺命令与未知参数报 error', () => {
      expect(parseDoctorArgv(['--version'])).toMatchObject({ version: true });
      expect(parseDoctorArgv(['--help'])).toMatchObject({ help: true });
      expect(parseDoctorArgv([]).command).toBeNull();
      expect(parseDoctorArgv(['sync']).error).toContain('未知参数'); // sync 是后续票，本版必须拒
      expect(parseDoctorArgv(['doctor', '--data-root']).error).toContain('--data-root');
    });
  });

  describe('输出格式化', () => {
    it('fail 行带「→ 修复命令」，pass 行不带，neutral 行原样', () => {
      expect(formatDoctorLine({ key: 'k', state: 'fail', text: '✗ 缺了', fix: 'pip install x' })).toContain('pip install x');
      expect(formatDoctorLine({ key: 'k', state: 'pass', text: '✓ 齐' })).not.toContain('→');
      expect(formatDoctorLine({ key: 'k', state: 'neutral', text: '· 未配置' })).toBe('· 未配置');
    });
  });
});
