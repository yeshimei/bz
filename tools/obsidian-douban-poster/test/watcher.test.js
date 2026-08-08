import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectMissingPosterNotes, sortByBirthtime, createProcessor } from '../watcher.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('collectMissingPosterNotes', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('只返回缺海报的 .md（有海报/非 md/子目录跳过）', () => {
    fs.writeFileSync(path.join(tmpDir, '无海报.md'), '---\ntags:\n  - 电影\n---\n');
    fs.writeFileSync(path.join(tmpDir, '有海报.md'), '---\ntags:\n  - 电影\n海报: CONFIG/MOVIE POSTER/a.jpg\n---\n');
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'hi');
    fs.mkdirSync(path.join(tmpDir, '子目录'));
    fs.writeFileSync(path.join(tmpDir, '子目录', '嵌套.md'), '---\n---\n');

    const missing = collectMissingPosterNotes(tmpDir).map((p) => path.basename(p));
    assert.deepEqual(missing, ['无海报.md']);
  });

  it('文件夹不存在时返回空数组', () => {
    assert.deepEqual(collectMissingPosterNotes(path.join(tmpDir, '不存在')), []);
  });
});

describe('sortByBirthtime', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-sort-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('按创建时间倒序：最新创建的先抓', async () => {
    const a = path.join(tmpDir, 'a.md');
    const b = path.join(tmpDir, 'b.md');
    const c = path.join(tmpDir, 'c.md');
    fs.writeFileSync(a, '---\n---\n');
    await sleep(20);
    fs.writeFileSync(b, '---\n---\n');
    await sleep(20);
    fs.writeFileSync(c, '---\n---\n');

    const sorted = sortByBirthtime([a, b, c]);
    assert.deepEqual(sorted, [c, b, a]);
  });
});

describe('createProcessor', () => {
  it('串行处理：按入队顺序，每个完成后等 interval 再处理下一个', async () => {
    const order = [];
    const times = [];
    const processor = createProcessor({
      interval: 30,
      onNote: async (note) => {
        times.push(Date.now());
        order.push(note);
      },
    });

    processor.pushMany(['a', 'b', 'c']);
    // 等待全部处理完：3 个 × (处理时间 + 30ms 间隔)
    await sleep(200);
    assert.deepEqual(order, ['a', 'b', 'c']);
    assert.ok(times[1] - times[0] >= 30, `间隔应 ≥30ms，实际 ${times[1] - times[0]}`);
    assert.ok(times[2] - times[1] >= 30, `间隔应 ≥30ms，实际 ${times[2] - times[1]}`);
  });

  it('同文件去重：重复 push 只处理一次', async () => {
    const order = [];
    const processor = createProcessor({ interval: 10, onNote: async (n) => order.push(n) });
    processor.push('a');
    processor.push('a');
    processor.push('a');
    await sleep(80);
    assert.deepEqual(order, ['a']);
  });

  it('单条失败不阻断队列', async () => {
    const order = [];
    const processor = createProcessor({
      interval: 10,
      onNote: async (n) => {
        order.push(n);
        if (n === 'bad') throw new Error('boom');
      },
    });
    processor.pushMany(['bad', 'ok']);
    await sleep(100);
    assert.deepEqual(order, ['bad', 'ok']);
  });

  it('处理中入队的新笔记会继续处理', async () => {
    const order = [];
    const processor = createProcessor({
      interval: 20,
      onNote: async (n) => {
        order.push(n);
        // 模拟真实场景：处理 a 的网络请求期间（异步），新笔记 d 被扫描入队
        if (n === 'a') setTimeout(() => processor.push('d'), 5);
      },
    });
    processor.pushMany(['a', 'b', 'c']);
    await sleep(300);
    assert.deepEqual(order, ['a', 'b', 'c', 'd']);
  });
});
