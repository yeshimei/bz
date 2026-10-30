// @vitest-environment node
/**
 * scripts/test-workers.mjs —— worker 数自适应回归测试。
 *
 * 这块逻辑决定「全量测试开几路 / 失败重试几次」，错判的代价不是红而是**静默变慢**：
 * 独占时误判成并发就白丢 31% 墙钟，并发时误判成独占就两边互拖到 3~4 倍；
 * 重试则只管失败场景——多试一轮就多等一整个 waitFor 预算（一条真失败 2 轮 ≈ 多花 5~10s），
 * 几十条同时红能把一轮从 40s 拖到十几分钟，且全程 CPU 闲着。所以把三条判据（显式覆盖优先、
 * 独占吃满、并发均分）与两条安全线（心跳锁幂等、死会话剔除）都钉死，重试数单独钉一组。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { _internals, claimTestRun, resolveRetryCount, resolveWorkerCount } from '../../scripts/test-workers.mjs';

const MAX = Math.max(_internals.MIN_WORKERS, os.availableParallelism());

const dirs = [];
function tmpLockDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-test-workers-'));
  dirs.push(d);
  return d;
}
/** 造一个「新鲜」的锁文件（mtime = 现在） */
function seedLock(dir, name) {
  fs.writeFileSync(path.join(dir, name), '1');
}

let release = null;
afterEach(() => {
  release?.();
  release = null;
  while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
});

describe('resolveWorkerCount', () => {
  it('显式 BZ_TEST_MAX_WORKERS 优先，且向下取整', () => {
    const dir = tmpLockDir();
    seedLock(dir, 'a.lock');
    seedLock(dir, 'b.lock');
    expect(resolveWorkerCount({ BZ_TEST_MAX_WORKERS: '3' }, dir)).toBe(3);
    expect(resolveWorkerCount({ BZ_TEST_MAX_WORKERS: '7.9' }, dir)).toBe(7);
  });

  it('非法 / 非正值回落到自动判断', () => {
    const dir = tmpLockDir();
    expect(resolveWorkerCount({ BZ_TEST_MAX_WORKERS: 'abc' }, dir)).toBe(MAX);
    expect(resolveWorkerCount({ BZ_TEST_MAX_WORKERS: '0' }, dir)).toBe(MAX);
    expect(resolveWorkerCount({}, dir)).toBe(MAX);
  });

  it('独占（无其它存活会话）时吃满', () => {
    expect(resolveWorkerCount({}, tmpLockDir())).toBe(MAX);
  });

  it('两个并发会话各拿一半', () => {
    const dir = tmpLockDir();
    seedLock(dir, '1.lock');
    seedLock(dir, '2.lock');
    expect(resolveWorkerCount({}, dir)).toBe(Math.floor(MAX / 2));
  });

  it('会话数超过并行度时不低于下限 2', () => {
    const dir = tmpLockDir();
    for (let i = 0; i < MAX * 4; i++) seedLock(dir, `${i}.lock`);
    expect(resolveWorkerCount({}, dir)).toBe(_internals.MIN_WORKERS);
  });

  it('过期锁（进程被强杀、心跳已停）被剔除，不计入并发数', () => {
    const dir = tmpLockDir();
    const dead = path.join(dir, 'dead.lock');
    fs.writeFileSync(dead, '1');
    const old = new Date(Date.now() - _internals.FRESH_MS - 60_000);
    fs.utimesSync(dead, old, old);

    expect(resolveWorkerCount({}, dir)).toBe(MAX);
    expect(fs.existsSync(dead)).toBe(false); // 顺手清理
  });

  it('锁目录不存在时不抛错，按独占处理', () => {
    expect(resolveWorkerCount({}, path.join(os.tmpdir(), 'bz-test-workers-not-exist-xyz'))).toBe(MAX);
  });
});

describe('resolveRetryCount', () => {
  it('独占不重试（失败立刻可见，不为「不可能发生的假红」白等两轮）', () => {
    expect(resolveRetryCount({}, tmpLockDir())).toBe(0);
  });

  it('两个并发会话各开 2 次重试（抢 CPU 抖动照旧吸收）', () => {
    const dir = tmpLockDir();
    seedLock(dir, '1.lock');
    seedLock(dir, '2.lock');
    expect(resolveRetryCount({}, dir)).toBe(2);
  });

  it('显式 BZ_TEST_RETRY 优先（CI / 复现抖动时用），0 也算显式值', () => {
    const dir = tmpLockDir();
    seedLock(dir, '1.lock');
    seedLock(dir, '2.lock');
    expect(resolveRetryCount({ BZ_TEST_RETRY: '0' }, dir)).toBe(0);
    expect(resolveRetryCount({ BZ_TEST_RETRY: '3' }, dir)).toBe(3);
  });

  it('非法 / 负值回落到自动判断', () => {
    expect(resolveRetryCount({ BZ_TEST_RETRY: 'abc' }, tmpLockDir())).toBe(0);
    expect(resolveRetryCount({ BZ_TEST_RETRY: '-1' }, tmpLockDir())).toBe(0);
  });
});

describe('claimTestRun', () => {
  it('登记即写锁，释放即删锁', () => {
    const dir = tmpLockDir();
    release = claimTestRun(424242, dir);
    const file = path.join(dir, '424242.lock');
    expect(fs.existsSync(file)).toBe(true);
    release();
    release = null;
    expect(fs.existsSync(file)).toBe(false);
  });

  it('同一进程重复登记幂等（watch 重载配置不会把自己算成两个会话）', () => {
    const dir = tmpLockDir();
    release = claimTestRun(424243, dir);
    const again = claimTestRun(424243, dir);
    expect(again).toBe(release);
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.lock'))).toHaveLength(1);
  });

  it('登记后 resolveWorkerCount 把自己算作 1 个会话（不会算出 0 → 下限兜底）', () => {
    const dir = tmpLockDir();
    release = claimTestRun(424244, dir);
    expect(resolveWorkerCount({}, dir)).toBe(MAX);
  });
});
