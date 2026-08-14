/**
 * 黑匣子对话测试（ticket 63）：三层记忆（日记 TF-IDF 检索 + 画像概要 + 对话历史）+ 包仔人设 + 降级。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { BlackBoxDataManager, createProfile } from '../../src/blackbox/data';
import { openBlackBoxChat, closeBlackBoxChat, unloadBlackBoxChat, buildChatContext, searchDiaryEntries } from '../../src/blackbox/chat';
import { defaultBlackBoxData } from '../../src/blackbox/types';
import type { DiarySourceEntry, Profile, ChatMsg } from '../../src/blackbox/types';

const ENTRIES: DiarySourceEntry[] = [
  { date: '2026-08-10', time: '08:30', content: '和妈妈搬完家，累但踏实。', filename: '2026-08-10', lineNumber: 1 },
  { date: '2026-08-11', time: '09:00', content: '妈妈来新家帮忙收拾。', filename: '2026-08-11', lineNumber: 1 },
  { date: '2026-08-12', time: '21:00', content: '一个人看了部电影。', filename: '2026-08-12', lineNumber: 3 },
];

function makeProfile(): Profile {
  return {
    id: 'pf_1', name: '妈妈', aliases: ['妈'], impression: '温柔可靠',
    aiObservations: [], emotions: [], mentionCount: 5,
    firstSeen: '2026-08-01', lastSeen: '2026-08-12', humanEdited: false, createdAt: '',
  };
}

describe('searchDiaryEntries（TF-IDF 检索）', () => {
  it('按关键词检索 → 相关条目在前', () => {
    const r = searchDiaryEntries(ENTRIES, '妈妈');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].content).toContain('妈妈');
  });
  it('无匹配 → 空数组', () => {
    expect(searchDiaryEntries(ENTRIES, '不存在的词xyz')).toEqual([]);
  });
  it('空查询 → 空数组', () => {
    expect(searchDiaryEntries(ENTRIES, '')).toEqual([]);
  });
});

describe('buildChatContext（三层记忆）', () => {
  it('检索片段 + 画像概要（印象+最近事件）+ 历史（maxHistory）', () => {
    const profiles = [makeProfile()];
    const events = [
      { id: 'ev_1', title: '搬家完成', date: '2026-08-10T08:30', datePrecision: 'time' as const, people: ['pf_1'], emotions: [], source: { path: 'x', lineNumber: 1, time: '08:30' }, confidence: 0.9, status: 'confirmed' as const, humanEdited: false },
      { id: 'ev_2', title: '看电影', date: '2026-08-12T21:00', datePrecision: 'time' as const, people: ['pf_1'], emotions: [], source: { path: 'y', lineNumber: 3, time: '21:00' }, confidence: 0.8, status: 'confirmed' as const, humanEdited: false },
      { id: 'ev_3', title: '旧事件', date: '2026-07-01T09:00', datePrecision: 'time' as const, people: ['pf_1'], emotions: [], source: { path: 'z', lineNumber: 1, time: '09:00' }, confidence: 0.8, status: 'confirmed' as const, humanEdited: false },
      { id: 'ev_4', title: '超旧事件', date: '2026-06-01T09:00', datePrecision: 'time' as const, people: ['pf_1'], emotions: [], source: { path: 'w', lineNumber: 1, time: '09:00' }, confidence: 0.8, status: 'confirmed' as const, humanEdited: false },
    ];
    const history: ChatMsg[] = [
      { role: 'user', content: '你好', ts: '1' },
      { role: 'assistant', content: '你好呀', ts: '2' },
    ];
    const ctx = buildChatContext(ENTRIES, profiles, events, history, '妈妈', 1);
    // 画像概要
    expect(ctx).toContain('妈妈');
    expect(ctx).toContain('温柔可靠');
    // 最近 3 个事件（按日期降序：看电影/搬家完成/旧事件；超旧事件被截断）
    expect(ctx).toContain('搬家完成');
    expect(ctx).toContain('看电影');
    expect(ctx).toContain('旧事件');
    expect(ctx).not.toContain('超旧事件');
    // 历史（maxHistory=1 → 只保留最近 1 条）
    expect(ctx).toContain('你好呀');
    // 检索片段（妈妈相关条目）
    expect(ctx).toContain('和妈妈搬完家');
  });
});

describe('对话 UI（openBlackBoxChat）', () => {
  beforeEach(() => resetObsidianMocks());
  afterEach(() => unloadBlackBoxChat());

  async function setup() {
    const vault = new MockVault();
    vault.create('我的/日记/2026-08-10.md', '# 📖 08:30\n\n和妈妈搬完家。\n');
    const app = mockAppWithVault(vault);
    setApp(app);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as any);
    return { vault, app };
  }

  it('打开 → 弹窗 + 标题「黑匣子」+ 输入框 + 发送按钮', async () => {
    const { app } = await setup();
    openBlackBoxChat(app, { json: async () => '{"reply":"hi"}' } as any);
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-blackbox-chat');
    expect(popup).not.toBeNull();
    expect(popup!.style.display).not.toBe('none');
    const title = document.getElementById('bz-blackbox-chat-title');
    expect(title!.textContent).toContain('黑匣子');
    expect(popup!.querySelector('#bz-blackbox-chat-input')).not.toBeNull();
    expect(popup!.querySelector('#bz-blackbox-chat-send')).not.toBeNull();
  });

  it('发送消息 → AI 回复追加到消息列表 + 历史落盘', async () => {
    const { app } = await setup();
    const ai = {
      json: vi.fn().mockResolvedValue('你好呀，搬完家辛苦啦。'),
    } as any;
    openBlackBoxChat(app, ai);
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-blackbox-chat')!;
    const input = popup.querySelector('#bz-blackbox-chat-input') as HTMLTextAreaElement;
    input.value = '最近怎么样？';
    input.dispatchEvent(new Event('input'));
    (popup.querySelector('#bz-blackbox-chat-send') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    const msgs = popup.querySelectorAll('.bz-chat-msg');
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    expect(popup.textContent).toContain('你好呀，搬完家辛苦啦。');
    const dm = new BlackBoxDataManager();
    const data = await dm.load();
    expect(data.chat.length).toBeGreaterThanOrEqual(2);
  });

  it('❌ 关闭 → 弹窗隐藏', async () => {
    const { app } = await setup();
    openBlackBoxChat(app, { json: async () => 'x' } as any);
    await new Promise((r) => setTimeout(r, 30));
    const popup = document.getElementById('bz-blackbox-chat')!;
    const close = popup.querySelector('.bz-icon-btn--close') as HTMLElement;
    close.click();
    expect(popup.style.display).toBe('none');
  });
});