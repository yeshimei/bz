// @vitest-environment node
/**
 * 脸谱工具包 bz-face rec / refs 判定层测试（issue 509 / ADR-0214）。
 *
 * 被测对象是包内纯判定层 tools/obsidian-face/lib/rec-core.js（CommonJS）——全部注入
 * 假件 / 构造输入，**不真跑子进程、不探测真实环境、不碰真实数据根**。覆盖：rec 参数
 * 解析（位置文件名唯一 / 三参数必填 / 畸形拒收）、refs 参数解析（--contact 可重复）、
 * 预检判定（缺录音 / 缺联系人目录 → 各自硬失败给中文引导；缺质心不拦——降级阶梯照跑）。
 */
import { describe, it, expect } from 'vitest';
import { parseRecArgv, parseRefsArgv, judgeRecPreflight, judgeRefsPreflight } from '../../tools/obsidian-face/lib/rec-core.js';

describe('bz-face rec 参数解析', () => {
  it('全参数：位置文件名 + --data-root / --contact / --python（等号写法同认）', () => {
    expect(
      parseRecArgv(['rec', '大琳 周二.aac', '--data-root', 'E:\\根', '--contact', '大琳', '--python', 'py']),
    ).toMatchObject({ command: 'rec', file: '大琳 周二.aac', dataRoot: 'E:\\根', contact: '大琳', python: 'py' });
    expect(parseRecArgv(['--data-root=E:\\根', '--contact=老周', 'r.m4a'])).toMatchObject({ file: 'r.m4a', dataRoot: 'E:\\根', contact: '老周' });
  });

  it('help / version 直通', () => {
    expect(parseRecArgv(['rec', '--help']).help).toBe(true);
    expect(parseRecArgv(['--version']).version).toBe(true);
  });

  it('--ffmpeg：非空才透传给 Python（issue 510 对齐 prep；等号写法同认）', () => {
    expect(
      parseRecArgv(['rec', 'r.aac', '--data-root', 'E:\\根', '--contact', '大琳', '--ffmpeg', 'C:\\tools\\ffmpeg.exe']),
    ).toMatchObject({ file: 'r.aac', ffmpeg: 'C:\\tools\\ffmpeg.exe' });
    expect(parseRecArgv(['rec', 'r.aac', '--data-root=E:\\根', '--contact=大琳', '--ffmpeg=ffmpeg']).ffmpeg).toBe('ffmpeg');
    expect(parseRecArgv(['rec', 'r.aac', '--data-root', 'E:\\根', '--contact', '大琳']).ffmpeg).toBeUndefined();
    expect(parseRecArgv(['rec', 'r.aac', '--data-root', 'x', '--contact', 'c', '--ffmpeg']).error).toContain('--ffmpeg');
  });

  it('缺文件名 / 缺 --data-root / 缺 --contact / 多个位置参数 / 未知参数 → 各自报错', () => {
    expect(parseRecArgv(['rec']).error).toContain('录音文件名');
    expect(parseRecArgv(['rec', 'r.m4a']).error).toContain('--data-root');
    expect(parseRecArgv(['rec', 'r.m4a', '--data-root', 'x']).error).toContain('--contact');
    expect(parseRecArgv(['rec', 'a.aac', 'b.m4a', '--data-root', 'x', '--contact', 'c']).error).toContain('只收一个');
    expect(parseRecArgv(['rec', 'r.m4a', '--wat', 'x', '--data-root', 'd', '--contact', 'c']).error).toContain('未知参数');
  });
});

describe('bz-face refs 参数解析', () => {
  it('--data-root + --contact 可重复', () => {
    expect(parseRefsArgv(['refs', '--data-root', 'E:\\根', '--contact', '大琳', '--contact', '老周', '--python', 'py'])).toMatchObject({
      command: 'refs',
      dataRoot: 'E:\\根',
      contacts: ['大琳', '老周'],
      python: 'py',
    });
  });

  it('缺 --data-root / 缺 --contact / 未知参数 → 报错；help 直通', () => {
    expect(parseRefsArgv(['refs']).error).toContain('--data-root');
    expect(parseRefsArgv(['refs', '--data-root', 'x']).error).toContain('--contact');
    expect(parseRefsArgv(['refs', '--data-root', 'x', '--contact', 'a', '--wat']).error).toContain('未知参数');
    expect(parseRefsArgv(['refs', '--help']).help).toBe(true);
  });
});

describe('rec 预检判定', () => {
  const okRoot = { configured: true, path: 'E:\\根', exists: true, writable: true };

  it('齐备 → 放行；缺质心不拦（降级阶梯照跑）', () => {
    expect(judgeRecPreflight({ dataRoot: okRoot, contact: '大琳', file: 'r.aac' }, { contactDirExists: true, recordingExists: true }).ok).toBe(true);
  });

  it('数据根未配置 / 不存在 / 不可写 → 各自硬失败', () => {
    expect(judgeRecPreflight({ dataRoot: { configured: false }, contact: 'c', file: 'f' }, { contactDirExists: true, recordingExists: true }).error).toContain('--data-root');
    expect(judgeRecPreflight({ dataRoot: { configured: true, path: 'X:\\缺失', exists: false }, contact: 'c', file: 'f' }, { contactDirExists: true, recordingExists: true }).error).toContain('X:\\缺失');
    const ro = judgeRecPreflight({ dataRoot: { configured: true, path: 'D:\\只读', exists: true, writable: false }, contact: 'c', file: 'f' }, { contactDirExists: true, recordingExists: true });
    expect(ro.ok).toBe(false);
    expect(ro.error).toContain('不可写');
  });

  it('联系人目录 / 录音缺席 → 硬失败且带完整路径', () => {
    const noDir = judgeRecPreflight({ dataRoot: okRoot, contact: '陈默', file: 'r.aac' }, { contactDirExists: false, recordingExists: false });
    expect(noDir.ok).toBe(false);
    expect(noDir.error).toContain('陈默');
    const noRec = judgeRecPreflight({ dataRoot: okRoot, contact: '大琳', file: 'r.aac' }, { contactDirExists: true, recordingExists: false });
    expect(noRec.ok).toBe(false);
    expect(noRec.error).toContain('r.aac');
    expect(noRec.error).toContain('recordings');
  });
});

describe('refs 预检判定', () => {
  const okRoot = { configured: true, path: 'E:\\根', exists: true, writable: true };

  it('齐备 → 放行；联系人目录缺席 → 硬失败带名单', () => {
    expect(judgeRefsPreflight({ dataRoot: okRoot }, { contacts: ['大琳'], missingContacts: [] }).ok).toBe(true);
    const miss = judgeRefsPreflight({ dataRoot: okRoot }, { contacts: ['大琳', '阿四'], missingContacts: ['阿四'] });
    expect(miss.ok).toBe(false);
    expect(miss.error).toContain('阿四');
  });

  it('数据根三态与 rec 同口径', () => {
    expect(judgeRefsPreflight({ dataRoot: { configured: false } }, { contacts: ['a'], missingContacts: [] }).error).toContain('--data-root');
    expect(judgeRefsPreflight({ dataRoot: { configured: true, path: 'X:\\没', exists: false } }, { contacts: ['a'], missingContacts: [] }).error).toContain('X:\\没');
    expect(judgeRefsPreflight({ dataRoot: { configured: true, path: 'D:\\只读', exists: true, writable: false } }, { contacts: ['a'], missingContacts: [] }).error).toContain('不可写');
  });
});
