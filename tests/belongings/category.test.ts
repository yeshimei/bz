// @vitest-environment node
/**
 * 归物本 · 分类串拆分纯函数
 *
 * issue 231/ADR-0102 引入时本模块还带一张 445 条 emoji→lucide 映射表；
 * issue 477/ADR-0201 删除该表后仅存 `splitEmojiCategory`，由载入迁移（`data.ts`）
 * 与 AI 返回解析（`ai.ts`）共用——两处口径不再各自持有一份正则。
 */
import { describe, expect, it } from 'vitest';
import { splitEmojiCategory } from '../../src/belongings/category';
import { AI_ICON_MENU } from '../../src/belongings/ai';

describe('splitEmojiCategory', () => {
  it('emoji 前缀：拆出 emoji / 纯文字名（带变体选择符也认）', () => {
    expect(splitEmojiCategory('📱 智能手机')).toEqual({ emoji: '📱', name: '智能手机' });
    expect(splitEmojiCategory('🖥️ 屏幕显示器')).toEqual({ emoji: '🖥', name: '屏幕显示器' });
  });

  it('无 emoji：原样返回、emoji 为 null', () => {
    expect(splitEmojiCategory('键盘周边')).toEqual({ emoji: null, name: '键盘周边' });
    expect(splitEmojiCategory('')).toEqual({ emoji: null, name: '' });
  });

  it('未知 emoji 同样剥前缀（拆分不再依赖映射表）', () => {
    expect(splitEmojiCategory('🧿 护身符')).toEqual({ emoji: '🧿', name: '护身符' });
  });
});

describe('AI_ICON_MENU（AI 归类图标菜单）', () => {
  it('全部 kebab-case 且无重复', () => {
    expect(new Set(AI_ICON_MENU).size).toBe(AI_ICON_MENU.length);
    for (const name of AI_ICON_MENU) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
