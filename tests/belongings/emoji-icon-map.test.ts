// @vitest-environment node
/**
 * 归物本 emoji→lucide 映射与拆分纯函数（issue 231/ADR-0102）
 * 映射表的三重职责：载入迁移转换器 / 遗留 emoji 渲染兜底 / AI 图标菜单词源。
 */
import { describe, expect, it } from 'vitest';
import { EMOJI_ICON, splitEmojiCategory } from '../../src/belongings/emoji-icon-map';
import { AI_ICON_MENU } from '../../src/belongings/ai';

/** 用户真实库 65 件出现过的全部 emoji（迁移覆盖回归锚点，2026-09 快照） */
const REAL_DATA_EMOJI = [
  '🔍', '💾', '🚲', '📱', '📷', '💡', '🍳', '🪞', '💨', '🎸', '🔋', '🎒', '🔊', '🖥',
  '💺', '📽', '🌫', '💻', '🪑', '💧', '🛏', '📡', '🎮', '🧹', '⌚', '🪒', '🖨', '⌨', '⛺', '📏', '🥘', '🎵',
];

describe('EMOJI_ICON 映射表', () => {
  it('值全部为 kebab-case lucide 名', () => {
    for (const name of Object.values(EMOJI_ICON)) {
      expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('真实库出现过的 emoji 全部入表（迁移覆盖锚点）', () => {
    const missing = REAL_DATA_EMOJI.filter((e) => !(e in EMOJI_ICON));
    expect(missing).toEqual([]);
  });

  it('空分类兜底 📦 映射为 package（与渲染兜底约定一致）', () => {
    expect(EMOJI_ICON['📦']).toBe('package');
  });
});

describe('splitEmojiCategory', () => {
  it('emoji 前缀：拆出 emoji / 纯文字名 / 映射图标（带变体选择符也认）', () => {
    expect(splitEmojiCategory('📱 智能手机')).toEqual({ emoji: '📱', name: '智能手机', icon: 'smartphone' });
    expect(splitEmojiCategory('🖥️ 屏幕显示器').name).toBe('屏幕显示器');
    expect(splitEmojiCategory('🖥️ 屏幕显示器').icon).toBe('monitor');
  });

  it('无 emoji：原样返回、icon 为 null', () => {
    expect(splitEmojiCategory('键盘周边')).toEqual({ emoji: null, name: '键盘周边', icon: null });
    expect(splitEmojiCategory('')).toEqual({ emoji: null, name: '', icon: null });
  });

  it('未入表的 emoji：剥前缀但 icon 为 null（调用方保持 emoji 兜底）', () => {
    const r = splitEmojiCategory('🧿 护身符');
    expect(r.name).toBe('护身符');
    expect(r.icon).toBeNull();
  });
});

describe('AI_ICON_MENU（AI 归类图标菜单）', () => {
  it('全部 kebab-case 且无重复', () => {
    expect(new Set(AI_ICON_MENU).size).toBe(AI_ICON_MENU.length);
    for (const name of AI_ICON_MENU) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});
