// @vitest-environment node
/**
 * 创作完成检测器测试（P2c，ticket 123）
 * 覆盖：minLength 门槛、稳定窗口完成、超时完成、forceComplete、幂等防重、时钟注入跨边界、clear 复位。
 */
import { describe, it, expect } from 'vitest';
import { ContentCompletionDetector } from '../../src/smartcat/content-completion-detector';

describe('ContentCompletionDetector', () => {
  describe('minLength 门槛', () => {
    it('内容不足 minLength → 不判定完成', () => {
      const detector = new ContentCompletionDetector({ minLength: 20 });
      const result = detector.refresh('a.md', '短');
      expect(result).toBeNull();
    });

    it('内容刚好达到 minLength → 可判定完成（稳定窗口后）', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 100,
        now: () => t,
      });
      // 第一次 refresh
      expect(detector.refresh('a.md', '12345')).toBeNull();
      // 稳定窗口过后再次 refresh
      t += 101;
      const result = detector.refresh('a.md', '12345');
      expect(result).not.toBeNull();
      expect(result!.content).toBe('12345');
      expect(result!.reason).toBe('stable');
    });

    it('内容超过 minLength → 可判定完成', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 10,
        stableMs: 50,
        now: () => t,
      });
      detector.refresh('a.md', '这是一段足够长的内容文本');
      t += 51;
      const result = detector.refresh('a.md', '这是一段足够长的内容文本');
      expect(result).not.toBeNull();
    });
  });

  describe('稳定窗口完成', () => {
    it('稳定窗口内无修改 → 返回 stable 完成', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 300,
        now: () => t,
      });

      detector.refresh('a.md', '创作内容足够长');
      t += 301; // 稳定窗口过
      const result = detector.refresh('a.md', '创作内容足够长');

      expect(result).not.toBeNull();
      expect(result!.reason).toBe('stable');
      expect(result!.path).toBe('a.md');
    });

    it('稳定窗口内有修改 → 不判定，窗口重置', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 300,
        now: () => t,
      });

      detector.refresh('a.md', '第一次内容');
      t += 100; // 窗口内
      expect(detector.refresh('a.md', '第二次内容')).toBeNull();
      t += 100; // 又过了 100ms，离第一次 200ms < 300ms
      expect(detector.refresh('a.md', '第三次内容')).toBeNull();
      t += 101; // 离最后一次修改 101ms < 300ms → 不应该完成
      // 但离最后一次修改只有 101ms，stableMs=300 → 不该完成
      // 等等，lastAt 是最后一次 refresh 的时间，t=1201 时 lastAt=1200
      // t - lastAt = 1 < 300 → 不该完成
      expect(detector.refresh('a.md', '第三次内容')).toBeNull();
      t += 300; // 离最后一次修改 301ms → 完成
      const result = detector.refresh('a.md', '第三次内容');
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('stable');
    });
  });

  describe('超时完成', () => {
    it('会话超时 → 返回 timeout 完成（即使内容仍在修改）', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 60_000, // 极长稳定窗口，不会触发 stable
        sessionTimeoutMs: 300,
        now: () => t,
      });

      detector.refresh('a.md', '创作中内容');
      t += 100;
      detector.refresh('a.md', '持续创作');
      t += 100;
      detector.refresh('a.md', '还在写');
      t += 101; // 总计 301ms ≥ 300ms → 超时
      const result = detector.refresh('a.md', '还在写');
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('timeout');
    });

    it('P1-1 回归：短内容超时后内容变化 → 不重复发 timeout', () => {
      let t = 0;
      const detector = new ContentCompletionDetector({
        minLength: 20, // 短内容永远 < minLength
        sessionTimeoutMs: 300,
        now: () => t,
      });

      // 1. 短内容开始
      detector.refresh('a.md', '短');
      expect(detector.getPending('a.md')).toBe(true);

      // 2. 超时触发
      t = 400_000;
      const timeoutResult = detector.refresh('a.md', '短');
      expect(timeoutResult).not.toBeNull();
      expect(timeoutResult!.reason).toBe('timeout');

      // 3. 超时后状态已清除，getPending 为 false
      expect(detector.getPending('a.md')).toBe(false);

      // 4. 再次 refresh 不同内容 → 开始新会话，不会立即重复 timeout
      t = 400_001;
      const nextResult = detector.refresh('a.md', '变了');
      expect(nextResult).toBeNull(); // 新会话刚开始，不应重复 timeout
      expect(detector.getPending('a.md')).toBe(true);
    });

    it('P1-1 回归：长内容超时后内容变化 → 不重复发 timeout', () => {
      let t = 0;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 60_000,
        sessionTimeoutMs: 300,
        now: () => t,
      });

      // 长内容开始
      detector.refresh('a.md', '足够长的内容');
      t = 400_000;
      const timeoutResult = detector.refresh('a.md', '足够长的内容');
      expect(timeoutResult).not.toBeNull();
      expect(timeoutResult!.reason).toBe('timeout');

      // 内容变化 → 新会话，不应重复 timeout
      t = 400_001;
      const nextResult = detector.refresh('a.md', '新内容');
      expect(nextResult).toBeNull();
      expect(detector.getPending('a.md')).toBe(true);
    });
  });

  describe('forceComplete', () => {
    it('显式强制完成 → 返回 manual 结果', () => {
      const detector = new ContentCompletionDetector({ minLength: 5 });
      detector.refresh('a.md', '手动完成的内容');
      const result = detector.forceComplete('a.md');
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('manual');
      expect(result!.content).toBe('手动完成的内容');
    });

    it('forceComplete 未 refresh 过的路径 → null', () => {
      const detector = new ContentCompletionDetector();
      const result = detector.forceComplete('nonexistent.md');
      expect(result).toBeNull();
    });

    it('forceComplete 空内容也返回（不检查 minLength）', () => {
      const detector = new ContentCompletionDetector({ minLength: 100 });
      detector.refresh('a.md', '短');
      const result = detector.forceComplete('a.md');
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('manual');
    });

    it('P2-4：forceComplete 后内容变化 → 新会话可再完成', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 100,
        now: () => t,
      });

      detector.refresh('a.md', '第一批内容');
      const fc = detector.forceComplete('a.md');
      expect(fc).not.toBeNull();
      expect(fc!.reason).toBe('manual');

      // forceComplete 后立即重复 → 幂等
      expect(detector.forceComplete('a.md')).toBeNull();

      // 内容变化 → completed 重置，开启新会话
      t += 1;
      detector.refresh('a.md', '第二批内容');
      t += 101;
      const second = detector.refresh('a.md', '第二批内容');
      expect(second).not.toBeNull();
      expect(second!.reason).toBe('stable');
    });
  });

  describe('幂等防重', () => {
    it('同一路径连续完成只发一次（forceComplete）', () => {
      const detector = new ContentCompletionDetector();
      detector.refresh('a.md', '测试内容');
      const first = detector.forceComplete('a.md');
      expect(first).not.toBeNull();

      const second = detector.forceComplete('a.md');
      expect(second).toBeNull(); // 幂等：第二次不发
    });

    it('stable 完成后 same-content refresh 不再发信号', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 100,
        now: () => t,
      });

      detector.refresh('a.md', '幂等测试内容');
      t += 101;
      const first = detector.refresh('a.md', '幂等测试内容');
      expect(first).not.toBeNull();

      // 同路径、同内容再次 refresh：completed 已标记，不再发信号
      t += 101;
      const second = detector.refresh('a.md', '幂等测试内容');
      expect(second).toBeNull();
    });

    it('stable 完成后内容变化会重发信号', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 100,
        now: () => t,
      });

      detector.refresh('a.md', '第一次内容');
      t += 101;
      const first = detector.refresh('a.md', '第一次内容');
      expect(first).not.toBeNull();

      // 内容变化 → completed 重置 → 新稳定窗口后可再完成
      t += 1;
      detector.refresh('a.md', '第二次内容');
      t += 101;
      const second = detector.refresh('a.md', '第二次内容');
      expect(second).not.toBeNull();
    });
  });

  describe('时钟注入跨边界', () => {
    it('模拟跨边界的时钟推进', () => {
      let t = 0;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 1000,
        sessionTimeoutMs: 4000,
        now: () => t,
      });

      // 每次 600ms，sessionTimeoutMs=4000 → 第 7 次（t=4200）首次超时
      // 超时后状态被删除，第 8 次（t=4800）开始新会话（不重复 timeout）
      let lastResult;
      for (let i = 0; i < 10; i++) {
        t += 600;
        lastResult = detector.refresh('a.md', `第 ${i} 次内容`);
      }

      // 只有第 7 次（i=6, t=4200）发出 timeout 信号，之后状态被清除
      expect(lastResult).toBeNull(); // 第 10 次（t=6000）是新会话，不触发
      expect(detector.getPending('a.md')).toBe(true); // 新会话仍在追踪中
    });

    it('超时后状态清除：再次 refresh 开始新会话', () => {
      let t = 0;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 1000,
        sessionTimeoutMs: 3000,
        now: () => t,
      });

      // 先有一条有效内容
      detector.refresh('a.md', '超时内容文本');
      expect(detector.getPending('a.md')).toBe(true);

      // 推进到超时
      t = 3000;
      const r1 = detector.refresh('a.md', '超时内容文本');
      expect(r1).not.toBeNull();
      expect(r1!.reason).toBe('timeout');

      // 超时后刷新 → 新会话，不重复
      t = 3001;
      const r2 = detector.refresh('a.md', '新会话内容文本');
      expect(r2).toBeNull();
      expect(detector.getPending('a.md')).toBe(true);
    });
  });

  describe('clear 复位', () => {
    it('clear 后所有路径状态清除', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 100,
        now: () => t,
      });

      detector.refresh('a.md', '内容 A');
      detector.refresh('b.md', '内容 B');
      expect(detector.getPending('a.md')).toBe(true);
      expect(detector.getPending('b.md')).toBe(true);

      detector.clear();
      expect(detector.getPending('a.md')).toBe(false);
      expect(detector.getPending('b.md')).toBe(false);

      // clear 后重新 refresh → 新的 firstAt/lastAt
      detector.refresh('a.md', '新内容 A');
      // 需要等稳定窗口过后再判定完成
      t += 101;
      const result = detector.refresh('a.md', '新内容 A');
      expect(result).not.toBeNull();
    });
  });

  describe('getPending', () => {
    it('未 refresh 的路径 → false', () => {
      const detector = new ContentCompletionDetector();
      expect(detector.getPending('x.md')).toBe(false);
    });

    it('refresh 后未完成 → true', () => {
      const detector = new ContentCompletionDetector({ minLength: 100 });
      detector.refresh('x.md', '短');
      expect(detector.getPending('x.md')).toBe(true);
    });

    it('完成后的路径 → false', () => {
      const detector = new ContentCompletionDetector({ minLength: 5 });
      detector.refresh('x.md', '足够长的内容');
      detector.forceComplete('x.md');
      expect(detector.getPending('x.md')).toBe(false);
    });
  });

  describe('getContent', () => {
    it('返回当前内容', () => {
      const detector = new ContentCompletionDetector();
      detector.refresh('a.md', 'hello');
      expect(detector.getContent('a.md')).toBe('hello');
    });

    it('未 refresh 的路径 → undefined', () => {
      const detector = new ContentCompletionDetector();
      expect(detector.getContent('x.md')).toBeUndefined();
    });
  });

  describe('多路径并发', () => {
    it('不同路径独立判定', () => {
      let t = 1000;
      const detector = new ContentCompletionDetector({
        minLength: 5,
        stableMs: 200,
        now: () => t,
      });

      detector.refresh('a.md', '路径 A 内容');
      t += 50;
      detector.refresh('b.md', '路径 B 内容');
      t += 151; // a 距离上次 201ms ≥ 200ms → 完成
      const resultA = detector.refresh('a.md', '路径 A 内容');
      expect(resultA).not.toBeNull();
      expect(resultA!.path).toBe('a.md');

      // b 距离上次 151ms < 200ms → 不完成
      const resultB = detector.refresh('b.md', '路径 B 内容');
      expect(resultB).toBeNull();

      t += 50; // b 距离上次 50ms... lastAt 更新为 t=1251
      // 等等，b 的 lastAt 在第一次 refresh 是 t=1050，第二次是 t=1201
      // 第三次 t=1251 → 1251-1201=50 < 200 → 不完成
      // 不对，应该 t += 200 来触发 b 的完成
      t += 150; // t=1401, b.lastAt=1201 → 200ms → 完成
      const resultB2 = detector.refresh('b.md', '路径 B 内容');
      expect(resultB2).not.toBeNull();
      expect(resultB2!.path).toBe('b.md');
    });
  });
});
