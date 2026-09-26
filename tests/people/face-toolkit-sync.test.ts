// @vitest-environment node
/**
 * 脸谱工具包 bz-face sync 判定层测试（issue 464 / ADR-0196 决策 1、5）。
 *
 * 被测对象是包内纯判定层 tools/obsidian-face/lib/sync-core.js（CommonJS）——全部注入
 * 假件 / 预录协议行，**不真跑 sync 子进程、不探测真实环境、不碰真实微信数据**。
 * CLI（bin/bz-face.js）只是「预检 → 起子进程 → 逐行转发 → 汇总退出码」的薄壳；
 * 子进程管道（probes.runSyncProcess）同 doctor 的 probes 先例不在单测面。
 *
 * 覆盖：阶段计划（四步词汇与顺序）、sync 参数解析（--data-root 必填 / 默认值 / 畸形拒收）、
 * 协议行格式化与 src/core/external-tool.ts parseBzLine 的**跨层契约**（Node 发的行
 * 插件必须解析得回）、转发中继（透传 + 无结果行时兜底失败结果）、预检判定
 * （微信未运行 / 版本封堵 → 硬失败不静默降级；数据根缺失不可写）、启动失败归类。
 */
import { describe, it, expect } from 'vitest';
import {
  SYNC_PHASES,
  buildSyncPlan,
  parseSyncArgv,
  formatBzLine,
  createSyncRelay,
  judgeSyncPreflight,
  classifySyncSpawnFailure,
} from '../../tools/obsidian-face/lib/sync-core.js';
import { WECHAT_ROLLBACK_VERSION } from '../../tools/obsidian-face/lib/doctor-core.js';
import { parseBzLine } from '../../src/core/external-tool';

describe('bz-face sync 判定层（issue 464）', () => {
  describe('阶段计划（步骤词汇表）', () => {
    it('四步按序：取密钥 → 解密 → 导出聊天 → 头像源；id 是 [bz-p] 的 phase 词', () => {
      expect(SYNC_PHASES.map((p) => p.id)).toEqual(['key', 'decrypt', 'contacts', 'avatar']);
      expect(SYNC_PHASES.map((p) => p.label)).toEqual(['取密钥', '解密数据库', '导出聊天', '头像源']);
      for (const p of SYNC_PHASES) {
        expect(p.detail.trim()).not.toBe('');
      }
    });

    it('buildSyncPlan 给副本：改返回值不动词汇表本体', () => {
      const plan = buildSyncPlan();
      plan[0].label = '篡改';
      expect(SYNC_PHASES[0].label).toBe('取密钥');
      expect(buildSyncPlan()[0].label).toBe('取密钥');
    });
  });

  describe('参数解析', () => {
    it('全参数：--data-root/--python/--src/--min-messages/--limit（空格写法）', () => {
      expect(
        parseSyncArgv(['sync', '--data-root', 'E:\\根', '--python', 'py', '--src', 'C:\\账号', '--min-messages', '20', '--limit', '3']),
      ).toMatchObject({
        command: 'sync',
        dataRoot: 'E:\\根',
        python: 'py',
        src: 'C:\\账号',
        minMessages: 20,
        limit: 3,
      });
    });

    it('等号写法与缺省值：minMessages=1、limit=0；开头 sync 可省', () => {
      expect(parseSyncArgv(['--data-root=E:\\根'])).toMatchObject({ command: 'sync', minMessages: 1, limit: 0 });
      expect(parseSyncArgv(['sync', '--data-root=D:\\x', '--limit=2'])).toMatchObject({ limit: 2 });
    });

    it('--data-root 必填（help/version 例外）', () => {
      const err = parseSyncArgv(['sync']);
      expect(err.command).toBeNull();
      expect(err.error).toContain('--data-root');
      expect(parseSyncArgv(['sync', '--help']).help).toBe(true);
      expect(parseSyncArgv(['sync', '--version']).version).toBe(true);
    });

    it('畸形值拒收：min-messages 0/非整数、limit 负数、缺值、未知参数', () => {
      expect(parseSyncArgv(['sync', '--data-root', 'X', '--min-messages', '0']).error).toContain('--min-messages');
      expect(parseSyncArgv(['sync', '--data-root', 'X', '--min-messages', 'abc']).error).toContain('--min-messages');
      expect(parseSyncArgv(['sync', '--data-root', 'X', '--limit', '-1']).error).toContain('--limit');
      expect(parseSyncArgv(['sync', '--data-root']).error).toContain('--data-root');
      expect(parseSyncArgv(['sync', '--data-root', 'X', '--wat']).error).toContain('未知参数');
    });
  });

  describe('协议行格式化 × parseBzLine 跨层契约（Node 发的行，插件必须解析得回）', () => {
    it('step 行：文案透传', () => {
      const line = formatBzLine('step', '解密数据库（增量）');
      expect(line).toBe('[bz-step] 解密数据库（增量）');
      expect(parseBzLine(line)).toEqual({ kind: 'step', text: '解密数据库（增量）' });
    });

    it('p 行：phase/pct 往返；非有限 pct 归 null（绝不假报）', () => {
      expect(parseBzLine(formatBzLine('p', { phase: 'contacts', pct: 35 }))).toEqual({
        kind: 'progress',
        phase: 'contacts',
        pct: 35,
      });
      expect(parseBzLine(formatBzLine('p', { phase: 'key', pct: null }))).toEqual({
        kind: 'progress',
        phase: 'key',
        pct: null,
      });
      expect(parseBzLine(formatBzLine('p', {}))).toEqual({ kind: 'progress', phase: null, pct: null });
      expect(parseBzLine(formatBzLine('p', { phase: 'decrypt', pct: Number.NaN }))).toEqual({
        kind: 'progress',
        phase: 'decrypt',
        pct: null,
      });
    });

    it('info/result 行：JSON 体深往返', () => {
      const info = { phase: 'contact', name: '大琳', status: 'ok', msgs: 20773, named: 52, imgs: 1631 };
      expect(parseBzLine(formatBzLine('info', info))).toEqual({ kind: 'info', data: info });
      const result = { ok: true, contacts: 74, written: 70, unchanged: 3, failed: 1, failures: [{ name: 'X', error: '炸了' }] };
      expect(parseBzLine(formatBzLine('result', result))).toEqual({ kind: 'result', data: result });
    });

    it('畸形输入不抛：空 step → 空串（调用方跳过）、循环引用对象 → 空串、未知 kind → 空串', () => {
      expect(formatBzLine('step', '   ')).toBe('');
      expect(formatBzLine('step', null)).toBe('');
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(formatBzLine('result', circular)).toBe('');
      expect(formatBzLine('wat' as 'step', {})).toBe('');
    });
  });

  describe('转发中继（透传 + 结果行兜底）', () => {
    it('子进程行原样透传（协议 / 非协议都不改写），空行丢弃；未见结果行前 sawResult 为假', () => {
      const relay = createSyncRelay();
      const out = [...relay.write('[bz-step] 取密钥'), ...relay.write('Python 原始输出 1/3'), ...relay.write(''), ...relay.write('[bz-p] {"phase":"contacts","pct":1}')];
      expect(out).toEqual(['[bz-step] 取密钥', 'Python 原始输出 1/3', '[bz-p] {"phase":"contacts","pct":1}']);
      expect(relay.sawResult).toBe(false);
    });

    it('见过 [bz-result] → finish 不补行（Python 的结果行唯一权威，不二次包装）', () => {
      const relay = createSyncRelay();
      relay.write('[bz-result] {"ok":true,"contacts":74,"failed":0}');
      expect(relay.sawResult).toBe(true);
      expect(relay.finish(0, '')).toEqual([]);
      expect(relay.finish(1, '晚到的 stderr')).toEqual([]);
    });

    it('没见结果行、退出码 0 → 兜底失败结果行（产物可能不完整），且可被 parseBzLine 解析', () => {
      const relay = createSyncRelay();
      const lines = relay.finish(0, '');
      expect(lines).toHaveLength(1);
      const ev = parseBzLine(lines[0]);
      expect(ev?.kind).toBe('result');
      expect((ev as { kind: 'result'; data: { ok: boolean; error: string } }).data.ok).toBe(false);
      expect((ev as { kind: 'result'; data: { error: string } }).data.error).toContain('结果行');
    });

    it('没见结果行、非零退出 → 错误带退出码与 stderr 末行；errorMessage 显式给则优先', () => {
      const relay = createSyncRelay();
      const lines = relay.finish(1, 'Traceback (most recent call last):\n  数据库解密失败：boom');
      const ev = parseBzLine(lines[0]) as { kind: 'result'; data: { ok: boolean; error: string } };
      expect(ev.data.ok).toBe(false);
      expect(ev.data.error).toContain('退出码 1');
      expect(ev.data.error).toContain('数据库解密失败：boom');

      const lines2 = relay.finish(null, '', '启动失败归类文案');
      const ev2 = parseBzLine(lines2[0]) as { kind: 'result'; data: { ok: boolean; error: string } };
      expect(ev2.data.ok).toBe(false);
      expect(ev2.data.error).toBe('启动失败归类文案');
    });
  });

  describe('预检判定（绝不静默降级）', () => {
    const okDataRoot = { configured: true, path: 'E:\\根', exists: true, writable: true };

    it('微信明确未在跑 → 硬失败 + 中文引导；检测到 3.x 一并点明', () => {
      const no = judgeSyncPreflight({ wechat: { ok: true, running: false }, dataRoot: okDataRoot });
      expect(no.ok).toBe(false);
      expect(no.error).toContain('未检测到微信进程');
      expect(no.error).toContain('打开并登录微信');

      const wx3 = judgeSyncPreflight({ wechat: { ok: true, running: false, wx3Running: true }, dataRoot: okDataRoot });
      expect(wx3.error).toContain('3.x');
    });

    it('微信版本 ≥ 封堵线 → 硬失败 + 退回指引（复用 doctor 常量，不另立口径）', () => {
      const blocked = judgeSyncPreflight({ wechat: { ok: true, running: true, version: '4.0.3.36' }, dataRoot: okDataRoot });
      expect(blocked.ok).toBe(false);
      expect(blocked.error).toContain('封堵');
      expect(blocked.error).toContain(WECHAT_ROLLBACK_VERSION);

      const fine = judgeSyncPreflight({ wechat: { ok: true, running: true, version: '4.0.3.19' }, dataRoot: okDataRoot });
      expect(fine.ok).toBe(true);
    });

    it('微信探测自身失败 / 版本读不出 → 不挡（Python 取密钥兜底）', () => {
      expect(judgeSyncPreflight({ wechat: { ok: false, error: 'tasklist 失败' }, dataRoot: okDataRoot }).ok).toBe(true);
      expect(judgeSyncPreflight({ wechat: { ok: true, running: true, versionError: '读不出' }, dataRoot: okDataRoot }).ok).toBe(true);
      expect(judgeSyncPreflight({ dataRoot: okDataRoot }).ok).toBe(true);
    });

    it('数据根：未配置 / 不存在 / 不可写 → 各自硬失败', () => {
      expect(judgeSyncPreflight({ wechat: { ok: true, running: true }, dataRoot: { configured: false } }).error).toContain('--data-root');
      const missing = judgeSyncPreflight({ wechat: { ok: true, running: true }, dataRoot: { configured: true, path: 'X:\\缺失', exists: false } });
      expect(missing.ok).toBe(false);
      expect(missing.error).toContain('X:\\缺失');
      const ro = judgeSyncPreflight({ wechat: { ok: true, running: true }, dataRoot: { configured: true, path: 'D:\\只读', exists: true, writable: false } });
      expect(ro.error).toContain('不可写');
    });
  });

  describe('启动失败归类', () => {
    it('ENOENT → 找不到 Python + doctor 指引；EACCES → 权限；其它取首行消息', () => {
      const enoent = classifySyncSpawnFailure({ code: 'ENOENT', message: 'spawn python ENOENT' }, 'py -3.12');
      expect(enoent).toContain('找不到 Python 命令「py -3.12」');
      expect(enoent).toContain('bz-face doctor');

      expect(classifySyncSpawnFailure({ code: 'EACCES', message: 'spawn python EACCES' }, 'python')).toContain('无执行权限');

      const other = classifySyncSpawnFailure({ message: 'spawn failed\n第二行' }, 'python');
      expect(other).toContain('导出进程启动失败');
      expect(other).not.toContain('第二行');
    });

    it('空/缺省输入不抛，给兜底文案', () => {
      expect(classifySyncSpawnFailure(null)).toContain('导出进程启动失败');
      expect(classifySyncSpawnFailure(undefined, 'python')).toContain('导出进程启动失败');
    });
  });
});
