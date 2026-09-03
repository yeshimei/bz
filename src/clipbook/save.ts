/**
 * clipbook（剪藏本融合域，ADR-0082 / issue 177）：保存到剪藏本（写剪藏笔记）。
 *
 * 语义迁移自 src/news/reader.ts saveToClip（逐字保留 frontmatter 契约 P1-24 +
 * dataviewjs 摘要块）：news 条目标记已保存 → 写 `剪藏目录/<cleanTitle>.md`。
 * - frontmatter：url/author/site/summary/tags/date/created（created 本地时间戳
 *   ——UTC+8 凌晨不落昨日；date 转 UTC 本地串）
 * - 正文剥离 frontmatter/dataviewjs 块后写入，尾部嵌 dataviewjs 摘要 view
 * - 同名文件已存在 → 覆盖确认（自绘遮罩小弹窗 + escManager，对齐 reader 语义）
 * - B站视频条目保存分流文献盒（ADR-0068：openLiteratureAddTask），不写剪藏
 *
 * 调用方：UI 保存动作（doAct save）。成功后由调用方触发重渲染 + 目录刷新。
 */
import { TFile } from 'obsidian';
import { getApp } from '../core/app';
import { escManager } from '../core/esc-manager';
import { topifyZ } from '../core/dom';
import { tryGetSettings } from '../core/settings-provider';
import { notice } from '../core/notice';
import { openLiteratureAddTask } from '../literature';
import type { ClipArticle } from './types';
import { localDatetime, toDatetime } from './constants';

const yamlEscape = (v: any): string =>
  String(v ?? '').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');

/** 剪藏目录（读设置 articleDirectory，缺省回退常量——与 news/reader CLIP_DIR 同默认） */
export function clipDirOf(): string {
  const s = tryGetSettings() as any;
  return (s && s.articleDirectory) || '归档/网页剪藏';
}

/** 保存动作分流：B站视频 → 文献盒；其余 news 条目 → 写剪藏 */
export function saveArticle(article: ClipArticle): Promise<void> {
  const raw = article && article.raw;
  if (!raw) return Promise.resolve();
  if (isBiliVideoLike(raw)) {
    openLiteratureAddTask(getApp(), { url: raw.url, title: raw.title || null, uploader: raw.author || null });
    return Promise.resolve();
  }
  return writeClipNote(raw);
}

/** B站视频判定（与 store.isBiliVideo 同语义，避免循环依赖） */
function isBiliVideoLike(a: any): boolean {
  return a?.platform === 'B站' && !!String(a?.url || '').trim();
}

/** 写剪藏笔记（news 原文 raw） */
export async function writeClipNote(raw: any): Promise<void> {
  const app = getApp();
  const dir = clipDirOf();
  const cleanTitle = String(raw.title || '').replace(/[\\/:*?"<>|]/g, '').trim();
  if (!cleanTitle) {
    notice('标题为空', 'error');
    return;
  }
  const filePath = `${dir}/${cleanTitle}.md`;

  if (app.vault.getAbstractFileByPath(filePath)) {
    const ok = await confirmOverwrite(filePath);
    if (!ok) return;
  }

  const tagsYaml = (raw.tags || []).map((t: string) => `  - "${yamlEscape(t)}"`).join('\n');
  const now = localDatetime();
  const pubDate = raw.date ? toDatetime(String(raw.date)) : '';
  const body = String(raw.body || '')
    .replace(/^\s*---[\s\S]*?---\s*/m, '')
    .replace(/^\s*```dataviewjs[\s\S]*?```\s*/m, '')
    .trim();

  const md = `---
url: "${yamlEscape(raw.url || '')}"
author: "${yamlEscape(raw.author || '')}"
site: "${yamlEscape(raw.platform || '')}"
summary: "${yamlEscape(raw.summary || '')}"
tags:
${tagsYaml}
date: "${yamlEscape(pubDate)}"
created: ${now}
---
\`\`\`dataviewjs
await dv.view(\`CONFIG/SCRIPTS/DataView/摘要\`)
\`\`\`

${body}`;

  try {
    const dirAf = app.vault.getAbstractFileByPath(dir);
    if (!dirAf) await app.vault.createFolder(dir);
    const existing = app.vault.getAbstractFileByPath(filePath);
    if (existing) await app.vault.modify(existing as TFile, md);
    else await app.vault.create(filePath, md);
    notice(`已保存：${cleanTitle}`, 'success');
  } catch (e) {
    console.error('[剪藏本] 保存剪藏失败', e);
    notice('保存失败，请稍后重试', 'error');
  }
}

/** 同名覆盖确认（自绘遮罩弹窗；ESC/遮罩 = 取消；覆盖 = 确定） */
function confirmOverwrite(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'var(--background-primary)',
      borderRadius: '10px', padding: '20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      minWidth: '260px', textAlign: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif',
      zIndex: '10500',
    });
    el.innerHTML = `
      <div style="margin-bottom:14px;color:var(--text-normal);font-size:14px;">已存在同名剪藏，覆盖？</div>
      <div style="display:flex;gap:8px;justify-content:center;">
        <button class="y" style="padding:6px 18px;border:none;background:var(--interactive-accent);color:var(--text-on-accent);border-radius:4px;cursor:pointer;">覆盖</button>
        <button class="n" style="padding:6px 18px;border:1px solid var(--background-modifier-border);background:var(--background-secondary);color:var(--text-normal);border-radius:4px;cursor:pointer;">取消</button>
      </div>`;
    const ov = document.createElement('div');
    Object.assign(ov.style, { position: 'fixed', inset: '0', background: 'var(--background-modifier-cover)' });
    topifyZ(ov, el);
    document.body.appendChild(ov);
    document.body.appendChild(el);
    const close = (v: boolean) => { ov.remove(); el.remove(); resolve(v); };
    ov.onclick = () => close(false);
    const h = escManager.register('clipbook-confirm', {
      isVisible: () => ov.isConnected,
      close: () => close(false),
    });
    el.querySelector<HTMLElement>('.y')!.onclick = () => { h.unregister(); close(true); };
    el.querySelector<HTMLElement>('.n')!.onclick = () => { h.unregister(); close(false); };
  });
}
