/**
 * 阅读器协议单源：`obsidian://bz-reader?book=…&cfi=…&t=…&c=…`。
 *
 * 为什么放 core：这条协议串在四处出现——书架墙（继续读 / 划线跳原文）、知识盒来源
 * （原样透传）、第二大脑引用卡（书命中）、以及外部插件反调。各拼一遍，格式一改就要改
 * 四遍，漏一处就是「点了没反应」。
 *
 * 打开一律走 core `openExternalUrl`（app.openUrl → electron → window.open 的兜底链，
 * 末级失败有人话提示）。**裸 `window.open` 在移动端对自定义协议不可靠，而且失败了静默**
 * ——用户只看到弹窗关了、原文没打开（书架侧 `epub-notes.ts` 的注释记过这一条）。
 *
 * 只做拼装与打开，不解释书目语义：哪些参数该传、章节名是不是兜底假名，由调用方判断。
 */
import { openExternalUrl } from './utils';

/** 协议参数上限（与 bz-reader data/deeplink.ts 的 SNIPPET 一致：20 字足够唯一定位一次） */
export const READER_TEXT_SNIPPET = 20;

export interface ReaderJumpTarget {
  /** 书内 CFI 位置 */
  cfi?: string | null;
  /** CFI 失效时用来在章节里搜的原文片段（自动压缩空白并截到 READER_TEXT_SNIPPET） */
  text?: string | null;
  /** 章节名（是不是兜底名由调用方过滤，这里只管编码） */
  chapter?: string | null;
}

/** 拼装跳转链接；bookId 为空返回空串（调用方据此不关弹层、不假装打开了） */
export function readerJumpUrl(bookId: string, target: ReaderJumpTarget = {}): string {
  const id = String(bookId ?? '').trim();
  if (!id) return '';
  const q: string[] = [`book=${encodeURIComponent(id)}`];
  const cfi = String(target.cfi ?? '').trim();
  if (cfi) q.push(`cfi=${encodeURIComponent(cfi)}`);
  const text = String(target.text ?? '').replace(/\s+/g, ' ').trim().slice(0, READER_TEXT_SNIPPET);
  if (text) q.push(`t=${encodeURIComponent(text)}`);
  const chapter = String(target.chapter ?? '').trim();
  if (chapter) q.push(`c=${encodeURIComponent(chapter)}`);
  return `obsidian://bz-reader?${q.join('&')}`;
}

/** 打开书内位置；返回是否真的发起了（bookId 空 → false，调用方留在原地） */
export function openReaderJump(app: unknown, bookId: string, target: ReaderJumpTarget = {}): boolean {
  const url = readerJumpUrl(bookId, target);
  if (!url) return false;
  openExternalUrl(app, url);
  return true;
}
