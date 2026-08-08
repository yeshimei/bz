/**
 * 影视文件夹监听核心（watcher 模式，2.1.0）：
 * 扫描缺海报笔记 → 按创建时间倒序（最新创建先抓）→ 串行抓取，每个完成后等 interval 防限流。
 * 纯函数与调度器分离，便于 node --test 单测。
 */
import fs from 'node:fs';
import path from 'node:path';
import { hasPoster } from './note-processor.js';

/** 扫描文件夹（depth 0）下所有缺海报的 .md，返回绝对路径数组 */
export function collectMissingPosterNotes(folderPath) {
  if (!fs.existsSync(folderPath)) return [];
  const results = [];
  let entries;
  try {
    entries = fs.readdirSync(folderPath);
  } catch {
    return [];
  }
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const full = path.join(folderPath, name);
    let st;
    try {
      st = fs.statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    try {
      if (!hasPoster(full)) results.push(full);
    } catch {
      /* 读取失败的文件跳过 */
    }
  }
  return results;
}

/** 按创建时间（birthtime）倒序：最新创建的先抓；birthtime 不可用时回退 mtime */
export function sortByBirthtime(paths) {
  const withTime = paths.map((p) => {
    try {
      const st = fs.statSync(p);
      const t = (st.birthtime && st.birthtime.getTime()) || st.mtime.getTime();
      return { p, t };
    } catch {
      return { p, t: 0 };
    }
  });
  withTime.sort((a, b) => b.t - a.t);
  return withTime.map((x) => x.p);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 串行处理器：push 去重；每个笔记处理完成后等 interval（默认 15s）再处理下一个。
 * @param {{ interval?: number, onNote: (notePath: string) => Promise<void> }} opts
 */
export function createProcessor({ interval = 15000, onNote }) {
  const queue = [];
  const queued = new Set();
  let busy = false;

  async function pump() {
    if (busy) return;
    busy = true;
    try {
      while (queue.length > 0) {
        const note = queue.shift();
        try {
          await onNote(note);
        } catch {
          /* 单条失败不阻断队列 */
        }
        // 处理完成后再释放去重标记（处理期间同文件重复入队应被拦截）
        queued.delete(note);
        if (interval > 0) await sleep(interval);
      }
    } finally {
      busy = false;
    }
  }

  /** 入队（同文件去重），并触发处理 */
  function push(note) {
    if (queued.has(note)) return;
    queued.add(note);
    queue.push(note);
    void pump();
  }

  function pushMany(notes) {
    for (const n of notes) push(n);
  }

  /** 队列是否仍有待处理/处理中 */
  function isBusy() {
    return busy || queue.length > 0;
  }

  function size() {
    return queue.length;
  }

  return { push, pushMany, isBusy, size };
}
