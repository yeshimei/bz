/**
 * 笔记库接入（ADR-0024 产品决策，ticket 025）：
 *  1) 写日记/闪念 → 计入信任成长（开发基于互动，轻质量 0.15）；
 *  2) 笔记库内容 = 小橘信息来源（隐私分级观察，只读、实时 vault 事件驱动）。
 * 隐私分级：flash=闪念标题/首行（内容本身就是要记的）；clipping=剪藏 frontmatter 的
 *  AI summary（auto-summary 产物，非私人正文）；movie=片名+评分（元数据）；diary=**不读正文**，
 *  仅条目标题时刻计数汇总。
 */
import type { App, TAbstractFile } from 'obsidian';
import { DIARY_DIRECTORY } from '../diary/config';

export type ActivityKind = 'diary' | 'flash' | 'clipping' | 'movie' | 'reading' | null;

/** 默认 flash（卡片盒）目录（flash 域 ALLOW_PATHS 默认含卡片盒；可配目录后续扩展） */
const FLASH_DIR = '卡片盒';

/** 路径分类（只认 .md；日志目录经 diary/config 动态目录） */
export function classifyPath(path: string | null | undefined): ActivityKind {
  if (!path || !path.endsWith('.md')) return null;
  const p = path.replace(/\\/g, '/');
  const diaryDir = (DIARY_DIRECTORY || '我的/日记').replace(/\/+$/, '');
  if (p.startsWith(diaryDir + '/')) return 'diary';
  if (p.startsWith(FLASH_DIR + '/')) return 'flash';
  if (p.startsWith('归档/网页剪藏')) return 'clipping';
  if (p.startsWith('我的/影视')) return 'movie';
  if (p.startsWith('书库')) return 'reading';
  return null;
}

/** 隐私分级观察文本（失败/无内容返回 null，调用方静默） */
export async function observationText(app: App, file: TAbstractFile, kind: ActivityKind): Promise<string | null> {
  if (!kind) return null;
  const readHead = async (n: number): Promise<string> => {
    try {
      const c = await app.vault.read(file as any);
      return c.split('\n').slice(0, n).join('\n');
    } catch { return ''; }
  };
  switch (kind) {
    case 'flash': {
      const head = (await readHead(6)).split('\n')[0]?.trim() || '';
      return head ? '你在卡片盒记下一条闪念：「' + head.slice(0, 40) + '」' : null;
    }
    case 'diary': { // 隐私：仅条目标题（emoji+HH:mm）计数，不读正文句子
      const txt = await readHead(400);
      const blocks = txt.split('\n').filter((l) => /^#\s+.*?\s+\d{1,2}:\d{2}\s*$/.test(l)).length;
      // 红队 B P2-1：0 条不谎报「写了 1 条」（空/格式不符文件跳过）
      return blocks >= 1 ? '你今天写了 ' + blocks + ' 条日记记录' : null;
    }
    case 'clipping': {
      const top = await readHead(12);
      const m = top.match(/^summary\s*[:：]\s*(.+)$/m);
      return m ? '你剪藏了：' + m[1].trim().slice(0, 60) : null;
    }
    case 'movie': {
      const top = await readHead(12);
      const name = String((file as any).basename || '').replace(/^《(.+?)》.*$/, '$1');
      const sc = top.match(/^评分\s*[:：]\s*(\d+)/m);
      if (name && name !== String((file as any).basename || '')) {
        return '你的影视库更新了《' + name.slice(0, 30) + '》' + (sc ? '（评分 ' + sc[1] + '）' : '');
      }
      return '你的影视库有了新记录';
    }
    case 'reading':
      return '书库笔记有更新，你的阅读在推进';
  }
  return null;
}