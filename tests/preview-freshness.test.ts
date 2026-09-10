// @vitest-environment node
/**
 * 原型产物新鲜度守卫（2026-09-10）
 *
 * 背景：prototypes/<域>/prototype-{render,behavior}.js 是**构建时快照**——
 *   - 样式（`src/<域>/styles.css`）由壳 `<link>` 直连源文件，永不过期；
 *   - 渲染（render.ts）/ 行为（ui.ts 依赖链）浏览器认不了 TS，必须 esbuild 打包，
 *     产物提交入 git 且**不会自动重建**。
 * 于是「改了 src 却忘了跑 node scripts/build-preview.mjs」会让评审壳静默停留在旧版：
 * 界面不报错、样式还总是最新的（直连源），极难察觉
 * （实例：首页「回忆墙」入口在 ADR-0115 退役 6 小时后仍显示，靠人眼发现）。
 *
 * 做法：构建时把「源指纹 + 仓内输入清单」写进产物头部（scripts/build-preview.mjs::sourceStamp），
 * 本测试按清单重算当前源码指纹并比对 —— 不一致即判产物滞后，报错文案直接给重出命令。
 * 指纹只覆盖仓内文件（过滤 node_modules），故跨机器/跨构建位置结果一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BEHAVIOR_DOMAINS, PREVIEW_DOMAINS } from '../scripts/build-preview.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 产物头部两行标记（由 scripts/build-preview.mjs 写入） */
const HASH_RE = /\/\* 源指纹 ([0-9a-f]{16}) ·/;
const INPUTS_RE = /\/\*#preview-inputs=(\[[^\n]*\])\*\//;

/** 单文件内容摘要（跨产物复用：同一源文件被多个域引用） */
const digestCache = new Map<string, string>();
function fileDigest(rel: string): string {
  const hit = digestCache.get(rel);
  if (hit) return hit;
  let d = 'MISSING';
  try {
    d = createHash('sha1').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
  } catch {
    /* 读不到（被删/权限）→ 记 MISSING，与构建端保持同一口径 */
  }
  digestCache.set(rel, d);
  return d;
}

/** 与 scripts/build-preview.mjs::sourceStamp 同算法（清单顺序已在构建端排好） */
function stampOf(files: string[]): string {
  const h = createHash('sha1');
  for (const rel of files) {
    h.update(rel);
    h.update('\0');
    h.update(fileDigest(rel));
    h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}

function assertFresh(file: string): void {
  const abs = path.join(ROOT, file);
  expect(fs.existsSync(abs), `${file} 不存在`).toBe(true);

  const src = fs.readFileSync(abs, 'utf8');
  const mInputs = src.match(INPUTS_RE);
  const mHash = src.match(HASH_RE);
  const staleMsg = `${file} 没有源指纹标记（旧版构建产物）→ 请跑：node scripts/build-preview.mjs`;
  expect(mInputs, staleMsg).toBeTruthy();
  expect(mHash, staleMsg).toBeTruthy();

  const files = JSON.parse(mInputs![1]) as string[];
  expect(
    mHash![1],
    `${file} 与源码不同步：源改过但产物没重出 → 请跑：node scripts/build-preview.mjs`,
  ).toBe(stampOf(files));
}

const targets = [
  ...new Set([
    ...PREVIEW_DOMAINS.map((d) => `prototypes/${d}/prototype-render.js`),
    ...BEHAVIOR_DOMAINS.map((d) => `prototypes/${d}/prototype-behavior.js`),
  ]),
];

describe('原型产物新鲜度（源指纹守卫）', () => {
  it.each(targets)('%s 与当前源码同步', (file) => {
    assertFresh(file);
  });
});
