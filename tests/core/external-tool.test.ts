// @vitest-environment node
/**
 * 外部工具调用壳 + 四行协议解析测试（src/core/external-tool.ts，issue 461 / ADR-0196）：
 * 四类协议行（[bz-step]/[bz-p]/[bz-info]/[bz-result]）各返回结构化事件（pct 允许 null
 * =该阶段不可估）、畸形行/空行/非协议输出/超长行不抛异常（忽略或透传）、
 * 跨 chunk 行缓冲与多字节安全、喂预录 stdout 行断言事件序列、mock 进程断言
 * 停止语义与退出码分流（close(0)=ok / close(非0)=失败带 stderr / stop()=中止）、
 * 停止的强杀升级（3 秒宽限到点 taskkill /T /F 整树收割 / 自然退出不升级 / 根死孤儿
 * 压管道时按 stopped 强制结算）与真实进程验证（长跑子进程 stop 后树消失、shell 孤儿
 * 真身被强杀收割后 close 回落）。
 * child_process 经 deps.cp 注入打桩（纯数据层 node 环境，不经 window.require）。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as nodeCp from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FORCE_KILL_GRACE_MS, parseBzLine, BzLineSplitter, runExternalTool } from '../../src/core/external-tool';
import type { ExternalToolCallbacks } from '../../src/core/external-tool';

/** 假子进程（同知识盒 processor.test.ts 口径）：stdout/stderr 可 emit；kill 可断言 */
class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = vi.fn(() => true);
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** 全回调落账的事件收集器（序列断言用） */
function makeRecorder() {
  const events: any[] = [];
  const cb: ExternalToolCallbacks = {
    onStep: (text) => events.push({ kind: 'step', text }),
    onProgress: (phase, pct) => events.push({ kind: 'progress', phase, pct }),
    onInfo: (data) => events.push({ kind: 'info', data }),
    onResult: (data) => events.push({ kind: 'result', data }),
    onRaw: (text) => events.push({ kind: 'raw', text }),
  };
  return { cb, events };
}

describe('四行协议解析 parseBzLine', () => {
  it('四类协议行各返回结构化事件（步骤名 / 阶段+百分比 / 信息体 / 结果体）', () => {
    expect(parseBzLine('[bz-step] 解析视频信息中')).toEqual({ kind: 'step', text: '解析视频信息中' });
    expect(parseBzLine('[bz-p] {"phase":"download","pct":35}')).toEqual({ kind: 'progress', phase: 'download', pct: 35 });
    expect(
      parseBzLine('[bz-info] {"title":"从零开始学B站","uploader":"某UP","bvid":"BV1xx411c7mD","url":"https://x","duration":600}'),
    ).toEqual({
      kind: 'info',
      data: { title: '从零开始学B站', uploader: '某UP', bvid: 'BV1xx411c7mD', url: 'https://x', duration: 600 },
    });
    expect(parseBzLine('[bz-result] {"transcript":"C:/tmp/t.txt","video":"CONFIG/APPENDIX/v.mp4"}')).toEqual({
      kind: 'result',
      data: { transcript: 'C:/tmp/t.txt', video: 'CONFIG/APPENDIX/v.mp4' },
    });
  });

  it('[bz-p] 百分比允许 null（该阶段不可估）；phase 缺失为 null；非有限数 pct 归 null（绝不假报）', () => {
    expect(parseBzLine('[bz-p] {"phase":"asr","pct":null}')).toEqual({ kind: 'progress', phase: 'asr', pct: null });
    expect(parseBzLine('[bz-p] {"pct":42}')).toEqual({ kind: 'progress', phase: null, pct: 42 });
    expect(parseBzLine('[bz-p] {"phase":"export"}')).toEqual({ kind: 'progress', phase: 'export', pct: null });
    expect(parseBzLine('[bz-p] {"phase":"x","pct":"88"}')).toEqual({ kind: 'progress', phase: 'x', pct: null }); // 字符串不假报
    expect(parseBzLine('[bz-p] {}')).toEqual({ kind: 'progress', phase: null, pct: null });
  });

  it('畸形行 / 空行 / 纯空白行返回 null 不抛异常（忽略，与知识盒坏行同口径）', () => {
    expect(parseBzLine('')).toBeNull();
    expect(parseBzLine('   ')).toBeNull();
    expect(parseBzLine('[bz-step]')).toBeNull(); // 空文案步骤行
    expect(parseBzLine('[bz-step]   ')).toBeNull();
    expect(parseBzLine('[bz-p] not-json')).toBeNull();
    expect(parseBzLine('[bz-p] 42')).toBeNull(); // 前缀对、体非对象
    expect(parseBzLine('[bz-p] {phase: bad}')).toBeNull(); // JSON 语法坏
    expect(parseBzLine('[bz-info] {broken')).toBeNull();
    expect(parseBzLine('[bz-result] [1,2,3]')).toBeNull(); // 数组体不收
    expect(parseBzLine('[bz-result] "ok"')).toBeNull(); // 原始值体不收
  });

  it('非协议输出原样透传为 raw（含伪协议前缀），行尾 \\r 剥除', () => {
    expect(parseBzLine('下载 10%')).toEqual({ kind: 'raw', text: '下载 10%' });
    expect(parseBzLine('bz-face: warning, retrying')).toEqual({ kind: 'raw', text: 'bz-face: warning, retrying' });
    expect(parseBzLine('[bz-steps] 伪前缀不匹配')).toEqual({ kind: 'raw', text: '[bz-steps] 伪前缀不匹配' });
    expect(parseBzLine('  [bz-step] 前导空白不算协议行')).toEqual({ kind: 'raw', text: '  [bz-step] 前导空白不算协议行' });
    expect(parseBzLine('[bz-step] 解析中\r')).toEqual({ kind: 'step', text: '解析中' }); // CRLF 残留的 \r
  });

  it('step 文案与协议前缀间多空格容忍；未知字段保留在 info/result 体里', () => {
    expect(parseBzLine('[bz-step]   下载中')).toEqual({ kind: 'step', text: '下载中' });
    expect(parseBzLine('[bz-info] {"title":"T","extra":1}')).toEqual({ kind: 'info', data: { title: 'T', extra: 1 } });
  });
});

describe('stdout 行缓冲 BzLineSplitter', () => {
  it('单 chunk 多行 + CRLF + 无尾换行的残留行（flush 出列）', () => {
    const sp = new BzLineSplitter();
    expect(sp.push('[bz-step] 一\n[bz-step] 二\r\n半截')).toEqual(['[bz-step] 一', '[bz-step] 二']);
    expect(sp.flush()).toBe('半截');
    expect(sp.flush()).toBeNull(); // 二次冲刷无残留
  });

  it('跨 chunk 半行拼回一行；多字节 UTF-8 被 chunk 劈开也能正确解码', () => {
    const sp = new BzLineSplitter();
    const full = Buffer.from('[bz-step] 媒体导出 312/1631\n', 'utf8');
    // 在「媒」字（3 字节）中间劈开：多字节跨 chunk 不乱码（换行扫描在字节级，续字节 ≥0x80 不撞 0x0A）
    const cut = 11;
    expect(sp.push(full.subarray(0, cut))).toEqual([]);
    expect(sp.push(full.subarray(cut))).toEqual(['[bz-step] 媒体导出 312/1631']);
    expect(sp.flush()).toBeNull();
  });

  it('超长行截断透传不抛异常：按上限截断出列，后续行不受影响', () => {
    const sp = new BzLineSplitter(32); // 用小上限测截断语义
    const lines = sp.push('a'.repeat(100) + '\n' + '[bz-step] 正常行\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('a'.repeat(32)); // 截断为上限长度（透传，不抛）
    expect(lines[1]).toBe('[bz-step] 正常行');
    // 边界：恰好等于上限不截断
    const sp2 = new BzLineSplitter(32);
    expect(sp2.push('b'.repeat(32) + '\n')).toEqual(['b'.repeat(32)]);
    // 超限后未遇换行：截断待出列，push 不抛
    const sp3 = new BzLineSplitter(8);
    expect(sp3.push('c'.repeat(20))).toEqual([]);
  });
});

describe('调用壳 runExternalTool', () => {
  it('喂预录 stdout 行断言事件序列（协议行分流 + 非协议透传）+ close(0) → ok', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const { cb, events } = makeRecorder();
    const h = runExternalTool({ cmd: 'bz-face', args: ['sync', '--vault', 'X'] }, cb, { cp });
    expect(cp.spawn).toHaveBeenCalledWith(
      'bz-face',
      ['sync', '--vault', 'X'],
      expect.objectContaining({ shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    );
    child.stdout.emit('data', Buffer.from('[bz-step] 取密钥\n[bz-p] {"phase":"decrypt","pct":10}\n'));
    child.stdout.emit('data', Buffer.from('[bz-p] {"phase":"decrypt","pct":null}\n[bz-step] 导出 chat.json\r\n'));
    child.stdout.emit('data', Buffer.from('[bz-info] {"title":"大琳","msg_count":1631}\n'));
    child.stdout.emit('data', Buffer.from('工具自打的非协议日志 1%\n'));
    child.stdout.emit('data', Buffer.from('[bz-result] {"chat":".bz-face/chat.json","failed":0}'));
    child.emit('close', 0);
    const out = await h.done;
    expect(out).toEqual({ ok: true, stopped: false, code: 0, stderr: '', error: null });
    expect(events).toEqual([
      { kind: 'step', text: '取密钥' },
      { kind: 'progress', phase: 'decrypt', pct: 10 },
      { kind: 'progress', phase: 'decrypt', pct: null }, // 该阶段不可估
      { kind: 'step', text: '导出 chat.json' },
      { kind: 'info', data: { title: '大琳', msg_count: 1631 } },
      { kind: 'raw', text: '工具自打的非协议日志 1%' },
      { kind: 'result', data: { chat: '.bz-face/chat.json', failed: 0 } },
    ]);
  });

  it('退出码分流：close(非0) 且有 stderr → ok:false、error 带 stderr、code 原样；stderr 只留尾部', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const { cb } = makeRecorder();
    const h = runExternalTool({ cmd: 'bz-face', args: ['prep'] }, cb, { cp });
    const longErr = 'x'.repeat(3000) + '解密失败：密钥过期';
    child.stderr.emit('data', Buffer.from(longErr));
    child.emit('close', 2);
    const out = await h.done;
    expect(out.ok).toBe(false);
    expect(out.stopped).toBe(false);
    expect(out.code).toBe(2);
    // 2KB 滑窗：留尾不留头——窗口内截断、尾部原因保留、总长不超窗
    expect(out.stderr.endsWith('解密失败：密钥过期')).toBe(true);
    expect(out.stderr.length).toBeLessThanOrEqual(2048);
    expect(out.stderr.length).toBeLessThan(longErr.length);
    expect(out.error).toBeInstanceOf(Error);
    expect(out.error!.message).toContain('退出码 2');
    expect(out.error!.message).toContain('解密失败：密钥过期');
    expect((out.error as any).stderr).toBe(out.stderr); // 结构化字段与 stderr 一致
  });

  it('close(非0) 且无 stderr → 错误只带退出码，stderr 为空串', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
    child.emit('close', 1);
    const out = await h.done;
    expect(out).toEqual({ ok: false, stopped: false, code: 1, stderr: '', error: expect.any(Error) });
    expect(out.error!.message).toBe('外部工具异常退出（退出码 1）');
  });

  it('停止语义：stop() 调 kill 且幂等；停止后的终结一律按 stopped 算（退出码 0 也算中止、无 error）', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const { cb } = makeRecorder();
    const h = runExternalTool({ cmd: 'bz-face', args: ['prep'] }, cb, { cp });
    child.stdout.emit('data', Buffer.from('[bz-step] 语音转写中\n'));
    h.stop();
    h.stop(); // 幂等：重复 stop 不抛、kill 只一次
    expect(child.kill).toHaveBeenCalledTimes(1);
    child.emit('close', 0); // 即使进程恰好正常退出也按中止算（同知识盒 abort 口径）
    const out = await h.done;
    expect(out).toEqual({ ok: false, stopped: true, code: 0, stderr: '', error: null });
  });

  it('进程被信号杀（close 无退出码）且非 stop → 按失败分流（无退出码语义）', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
    child.stderr.emit('data', Buffer.from('段错误'));
    child.emit('close', null);
    const out = await h.done;
    expect(out.ok).toBe(false);
    expect(out.code).toBeNull();
    expect(out.stderr).toBe('段错误');
    expect(out.error!.message).toContain('无退出码');
  });

  it('spawn 同步抛错（如 ENOENT）→ ok:false、code:null、错误含原因；句柄 stop() 安全不抛', async () => {
    const cp = { spawn: vi.fn(() => { throw Object.assign(new Error('spawn bz-face ENOENT'), { code: 'ENOENT' }); }) };
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
    const out = await h.done;
    expect(out.ok).toBe(false);
    expect(out.code).toBeNull();
    expect(out.error!.message).toContain('外部工具启动失败');
    expect(out.error!.message).toContain('ENOENT');
    expect(() => h.stop()).not.toThrow(); // 已终结：stop 安全
  });

  it("child 'error' 事件 → ok:false；其后补发的 close 不重复 settle（done 结果唯一）", async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
    child.emit('error', new Error('spawn ENOENT'));
    child.emit('close', 1); // error 后再补 close：幂等护栏
    const out = await h.done;
    expect(out.ok).toBe(false);
    expect(out.code).toBeNull();
    expect(out.error!.message).toContain('spawn ENOENT');
    expect(out.stderr).toBe('');
  });

  it('非桌面端且未注入 cp → ok:false、错误说明不可用，不抛异常', async () => {
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb); // node 环境无 window.require
    const out = await h.done;
    expect(out.ok).toBe(false);
    expect(out.code).toBeNull();
    expect(out.error!.message).toContain('仅桌面端可用');
  });

  it('stdout 跨 chunk 半行 + 结束无尾换行 → 残留行在 close 时冲刷分发', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const { cb, events } = makeRecorder();
    const h = runExternalTool({ cmd: 'bz-face' }, cb, { cp });
    child.stdout.emit('data', Buffer.from('[bz-st'));
    child.stdout.emit('data', Buffer.from('ep] 收尾步骤')); // 无换行即 close
    child.emit('close', 0);
    const out = await h.done;
    expect(out.ok).toBe(true);
    expect(events).toEqual([{ kind: 'step', text: '收尾步骤' }]);
  });

  it('shell:true 与 cwd/env 透传给 spawn；args 缺省为空数组', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const h = runExternalTool({ cmd: 'bz-face.cmd', shell: true, cwd: 'D:/data', env: { BZ: '1' } }, makeRecorder().cb, { cp });
    expect(cp.spawn).toHaveBeenCalledWith(
      'bz-face.cmd',
      [],
      expect.objectContaining({ shell: true, cwd: 'D:/data', env: { BZ: '1' } }),
    );
    child.emit('close', 0);
    await h.done;
  });

  it('畸形协议行在壳内被忽略：不触发任何回调、不影响后续协议行、不抛异常', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const { cb, events } = makeRecorder();
    const h = runExternalTool({ cmd: 'bz-face' }, cb, { cp });
    child.stdout.emit('data', Buffer.from('[bz-p] garbage\n[bz-step] 正常步骤\n\n\n[bz-result] {"ok":1}\n'));
    child.emit('close', 0);
    await h.done;
    expect(events).toEqual([
      { kind: 'step', text: '正常步骤' },
      { kind: 'result', data: { ok: 1 } },
    ]);
  });

  it('终结后数据流再涌入（重复 close / 迟到 stdout）不影响已定终态', async () => {
    const child = new FakeChild();
    const cp = { spawn: vi.fn(() => child) };
    const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
    child.emit('close', 0);
    const first = await h.done;
    child.stdout.emit('data', Buffer.from('[bz-result] {"late":true}\n'));
    child.emit('close', 1); // 迟到的第二个 close
    await tick();
    expect(await h.done).toBe(first); // 同一个已定结果（Promise 已 resolve，不再变）
  });
});

describe('停止的强杀升级（进程树）', () => {
  /** 带真实 pid 形参的假子进程（强杀排程需要 pid；没有 pid = 没有可杀对象，不排程） */
  function fakeChildWithPid(pid = 4242): FakeChild {
    const c = new FakeChild();
    (c as { pid?: number }).pid = pid;
    return c;
  }

  it('stop（shell）后 3 秒未退 → 温和步 taskkill /T 保活根 + 宽限到点 taskkill /pid /T /F 整树收割', () => {
    if (process.platform !== 'win32') return; // 非 Windows 分支见「SIGKILL 兜底」用例
    vi.useFakeTimers();
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face.cmd', shell: true }, makeRecorder().cb, { cp });
      h.stop();
      h.stop(); // 幂等：温和步只做一次
      // shell 场景刻意不 child.kill()：杀壳会把树根提前送走，宽限到点的 /T /F 就没根可收割了
      expect(child.kill).not.toHaveBeenCalled();
      expect(cp.spawn).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T'], expect.anything());
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS);
      expect(cp.spawn).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T', '/F'], expect.anything());
      expect(cp.spawn).toHaveBeenCalledTimes(3); // 工具本尊 + 温和 taskkill + 强杀 taskkill，没有多余调用
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop（非 shell）后 3 秒未退 → 温和 child.kill 之后仍升级强杀（taskkill /pid /T /F）', () => {
    if (process.platform !== 'win32') return;
    vi.useFakeTimers();
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
      h.stop();
      expect(child.kill).toHaveBeenCalledTimes(1); // 非 shell：直属进程没有壳可绕，温和步照旧
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS);
      expect(cp.spawn).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/T', '/F'], expect.anything());
    } finally {
      vi.useRealTimers();
    }
  });

  it('非 Windows：宽限到点用 process.kill(pid, SIGKILL) 兜底（非树，注释即契约）', () => {
    if (process.platform === 'win32') return;
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
      h.stop();
      expect(child.kill).toHaveBeenCalledTimes(1); // 温和步 = SIGTERM
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS);
      expect(killSpy).toHaveBeenCalledWith(4242, 'SIGKILL');
    } finally {
      killSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('进程自然退出（close 到了）→ 强杀定时器摘除，宽限过后也不升级、不悬挂', async () => {
    vi.useFakeTimers();
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
      h.stop();
      child.emit('close', 0);
      const out = await h.done;
      expect(out).toEqual({ ok: false, stopped: true, code: 0, stderr: '', error: null });
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS * 3);
      expect(cp.spawn).toHaveBeenCalledTimes(1); // 只有工具本尊那次 spawn，没有 taskkill
    } finally {
      vi.useRealTimers();
    }
  });

  it('根已死（exit 到了）close 被孤儿压住 → 到点按 stopped 强制结算：不空杀死根、done 不悬挂', async () => {
    vi.useFakeTimers();
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
      h.stop();
      child.emit('exit', null, 'SIGTERM'); // 直属进程死了；close 因孤儿攥着管道迟迟不来
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS);
      const out = await h.done;
      // 调度器串行跑批，done 悬挂 = 队列停摆——宁可按 stopped 结算也不能等一个不会来的 close
      expect(out).toEqual({ ok: false, stopped: true, code: null, stderr: '', error: null });
      expect(cp.spawn).toHaveBeenCalledTimes(1); // 树根没了，taskkill /T 无根可寻：不对死 pid 空放
    } finally {
      vi.useRealTimers();
    }
  });

  it('宽限期内进程退了（close 在到点前到）→ 不升级；迟到 close 不改已定终态', async () => {
    vi.useFakeTimers();
    try {
      const child = fakeChildWithPid();
      const cp = { spawn: vi.fn(() => child) };
      const h = runExternalTool({ cmd: 'bz-face' }, makeRecorder().cb, { cp });
      h.stop();
      vi.advanceTimersByTime(FORCE_KILL_GRACE_MS - 1); // 还差 1ms 到点
      child.emit('close', 0); // 赶在宽限内退了
      vi.advanceTimersByTime(10);
      expect(cp.spawn).toHaveBeenCalledTimes(1);
      expect((await h.done).stopped).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('停止的真实进程验证（桌面 node 环境真起子进程）', () => {
  it('长跑子进程 stop() 后树在宽限内消失、done 按 stopped 结算（等 close 事件）', async () => {
    const h = runExternalTool(
      { cmd: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'] },
      makeRecorder().cb,
      { cp: nodeCp },
    );
    await new Promise((r) => setTimeout(r, 300)); // 让它真跑起来
    const t0 = Date.now();
    h.stop();
    const out = await h.done;
    // close 到来 = 攥着 stdio 管道的进程全灭 = 这棵树（就一个直属进程）已消失；
    // 直属进程一杀即退，用不到强杀宽限
    expect(out.stopped).toBe(true);
    expect(Date.now() - t0).toBeLessThan(FORCE_KILL_GRACE_MS);
  });

  it('Windows shell 场景（.cmd 的真实形态）：杀壳后孤儿真身由宽限到点的强杀整树收割，close 正常回落', async () => {
    if (process.platform !== 'win32') return; // shell 温和步/整树收割是 Windows 路径
    const dir = mkdtempSync(path.join(tmpdir(), 'bz-external-tool-'));
    // .cmd shim + node 真身 —— dock 域对 .cmd 自动开 shell 的那类工具就是这两层结构。
    // 真身用脚本文件而非 -e 内联（内联式经 cmd 转述会被引号规则啃坏）；shim 里路径带引号
    // （execPath 的 Program Files 有空格，不引号 cmd 会把它啃成 C:\Program）
    const js = path.join(dir, 'payload.js');
    const shim = path.join(dir, 'payload.cmd');
    writeFileSync(js, 'setInterval(() => {}, 1000);\nconsole.log("payload-up");\n');
    writeFileSync(shim, `@echo off\r\n"${process.execPath}" "%~dp0payload.js"\r\n`);
    let up!: () => void;
    const upPromise = new Promise<void>((r) => {
      up = r;
    });
    const cb: ExternalToolCallbacks = {
      onStep: () => {},
      onProgress: () => {},
      onInfo: () => {},
      onResult: () => {},
      onRaw: (t) => {
        if (t.trim() === 'payload-up') up(); // 真身已起：此刻杀壳才杀得出「孤儿」这个课题
      },
    };
    const h = runExternalTool({ cmd: shim, args: [], shell: true }, cb, { cp: nodeCp });
    await Promise.race([upPromise, new Promise((r) => setTimeout(r, 5000))]);
    const t0 = Date.now();
    h.stop(); // 温和步杀不动控制台壳（保住活根），宽限到点 taskkill /T /F 整树收割
    const out = await h.done;
    const elapsed = Date.now() - t0;
    expect(out.stopped).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(FORCE_KILL_GRACE_MS - 200); // 真身由强杀收割，宽限是认真的
    expect(elapsed).toBeLessThan(FORCE_KILL_GRACE_MS + 5000);
    // close 能到来本身就是树灭的证明：管道写端全关了（壳与真身都死了），孤儿无处存活
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* 清不掉就留给系统临时目录自清 */
    }
  }, 20000);
});
