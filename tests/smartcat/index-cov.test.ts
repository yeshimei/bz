/**
 * smartcat 域入口覆盖率补测（装配主干见 presence/ui/settings/mood-gating 等既有测试）：
 * 各域动作观察入口、剪藏 frontmatter 解析、聊天错误路径、书评链路、
 * vault 活动（日记/三域/剪藏/短路）路由、news 待补全登记（modify 补全 + 定时降级）、
 * 欢迎回来回程语（时段/作息分支）、主动关心守卫与 AI 路径、
 * 趋势漂移/每周报告/关系史叙事定时链路、域 JSON 书库防抖、Bandit reward 回填。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { emitDomainEvent, clearDomainEvents } from '../../src/core/domain-bus';
import { attachObsidianAdapter, detachObsidianAdapter } from '../../src/core/obsidian-adapter';
import {
  ensureSmartCat, unloadSmartCat, openSmartCatChat, hideSmartCat,
  parseClipFrontmatter, maybeProactiveCare, __typewriterEffectForTests,
  __getSmartcatInternals, __setDiarySettleMsForTests, __setNoteSettleMsForTests,
  __setNewsSaveTimeoutForTests, __getNewsPendingSavesForTests,
  __getDiaryTimersForTests, __getNoteTimersForTests, __setLibraryDebounceMsForTests,
} from '../../src/smartcat/index';
import { eventSystem } from '../../src/smartcat/state';
import { EVENTS } from '../../src/smartcat/types';
import { CAT_CONTAINER_ID } from '../../src/smartcat/ui';
import { isoWeekKey } from '../../src/smartcat/rhythm';
import { DAY_MS, defaultSmartCatData, getSmartcatFilePath } from '../../src/smartcat/data';

let settings: any = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };

function makeApp() {
  const vault = new MockVault();
  const app: any = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => settings);
  setSettingsSaver(async () => {});
  const wsListeners: Record<string, Function[]> = {};
  app.workspace.on = (ev: string, cb: any) => { (wsListeners[ev] ||= []).push(cb); return { ev, cb }; };
  app.workspace.offref = (ref: any) => {
    const arr = wsListeners[ref?.ev] || [];
    const idx = arr.indexOf(ref?.cb);
    if (idx >= 0) arr.splice(idx, 1);
    return arr;
  };
  (app as any).__wsListeners = wsListeners;
  // 总线接线（对齐生产 main.ts 挂载 + diary-action.test 惯例）：vault 裸事件 → adapter 两路派发；
  // 单例先摘再挂 + 清空订阅，防跨用例串线（ensureSmartCat 的总线订阅在其后注册，不受影响）
  detachObsidianAdapter();
  clearDomainEvents();
  attachObsidianAdapter(app);
  return { app, vault };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const todayStr = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 当前小时附近的观察流（作息画像必命中当前小时；主动闸门放行） */
function mkStream(n = 5): any[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `o${i}`,
    created: new Date(Date.now() - i * 60_000).toISOString(),
    lastAccessed: new Date().toISOString(),
    description: `观察${i}`,
    importance: 0.5,
    type: 'observation',
    emotion: 'calm',
  }));
}

const bubbles: string[] = [];
/** 同引用监听（eventSystem 按引用 off；箭头函数每次新建会泄漏） */
const bubbleListener = (d: any) => bubbles.push(d?.message ?? '');
let origFetch: typeof fetch;

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
  settings = { storagePath: 'CONFIG/STORAGE', smartcatEnabled: true, smartcatMobileDefaultFullscreen: false };
  unloadSmartCat();
  resetAIProviderCache();
  setAISettingsProvider(() => settings);
  bubbles.length = 0;
  eventSystem.on(EVENTS.BUBBLE_QUEUED, bubbleListener);
  origFetch = globalThis.fetch;
});

afterEach(() => {
  unloadSmartCat();
  detachObsidianAdapter();
  clearDomainEvents();
  eventSystem.off(EVENTS.BUBBLE_QUEUED, bubbleListener);
  globalThis.fetch = origFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 配置 AI 并按 system 提示路由返回不同 JSON（聊天纯文本 / 报告 / 叙事） */
function mockAIRouted(): void {
  resetAIProviderCache();
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  globalThis.fetch = vi.fn(async (_url: any, init: any) => {
    const body = JSON.parse(init.body);
    const sys: string = body.messages?.[0]?.content || '';
    let content = '喵呜~';
    if (sys.includes('懂你报告')) content = JSON.stringify({ report: '这周你写了三篇日记，读完了一本书，情绪整体平稳。' });
    else if (sys.includes('关系史小结')) content = JSON.stringify({ narrative: '这一周我们一起读完了一本书，也写了几篇日记。' });
    return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
  }) as any;
}

describe('动作观察入口（方法监听）', () => {
  it('未初始化时全部入口静默不抛错', () => {
    expect(() => {
      emitDomainEvent('movie', { kind: 'created', name: 'x', status: 'want', rating: -1, review: null });
      emitDomainEvent('memo', { kind: 'completed', title: 'x' });
      emitDomainEvent('news', { kind: 'read', evt: { title: 'x', platform: 'p', state: 'read', durationMin: 1 } });
      emitDomainEvent('favorites', { kind: 'delete', title: 'x' });
      emitDomainEvent('belongings', { kind: 'delete', title: 'x' });
      emitDomainEvent('pomodoro', { kind: 'focus-done', minutes: 25 });
    }).not.toThrow();
    expect(__getSmartcatInternals().initialized).toBe(false);
  });

  it('收藏本/归物本/番茄钟/备忘录/影视 动作各产出对应观察（P2b：行为域走行为流）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('favorites', { kind: 'add', item: { title: 'GitHub', tags: ['工具'], description: '代码托管', url: 'https://github.com', pinned: false } as any });
    emitDomainEvent('belongings', { kind: 'add', item: { name: 'Kindle', category: '数码', purchase_price: 998, purchase_date: '2026-01-01', current_status: '使用中', description: '' } });
    emitDomainEvent('pomodoro', { kind: 'focus-done', minutes: 25 });
    emitDomainEvent('memo', { kind: 'completed', title: '买菜' });
    emitDomainEvent('movie', { kind: 'rated', name: '美丽人生', fromRating: 3.5, toRating: 4.5 });
    await sleep(150);
    // 行为域（favorites/belongings/memo）→ 行为流
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const behHas = (frag: string) => beh.some((b) => b.description.includes(frag));
    expect(behHas('favorites:added GitHub')).toBe(true);
    expect(behHas('belongings:added Kindle')).toBe(true);
    expect(behHas('memo:completed 买菜')).toBe(true);
    // pomodoro:focus-done → memory 流（routing.ts 已定）
    const stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    expect(stream.some((m) => m.description.includes('番茄钟 25 分钟专注'))).toBe(true);
    // 影视 → memory 流（非行为域，走旧路径）
    expect(stream.some((m) => m.description.includes('你把《美丽人生》的评分从 3.5 改为 4.5'))).toBe(true);

    // noteSource 关闭 → 后续动作静默
    const before = beh.length;
    __getSmartcatInternals().data.config.noteSource = false;
    emitDomainEvent('pomodoro', { kind: 'focus-done', minutes: 30 });
    await sleep(80);
    expect(__getSmartcatInternals().data.memory.behaviorStream.length).toBe(before);
  });

  it('news read 立即形态观察（P2b：行为域走行为流）', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    emitDomainEvent('news', { kind: 'read', evt: { title: '好文', platform: '聚合讯', state: 'read', durationMin: 6 } });
    await sleep(120);
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('read');
    expect(last.description).toContain('news:read 好文');
  });
});

describe('parseClipFrontmatter 解析', () => {
  it('list 标签/半角冒号 summary/带引号 url', () => {
    const out = parseClipFrontmatter('---\nurl: "https://a.com"\nsummary: "一段摘要"\ntags:\n  - 科技\n  - AI\n---\n正文');
    expect(out.url).toBe('https://a.com');
    expect(out.summary).toBe('一段摘要');
    expect(out.tags).toEqual(['科技', 'AI']);
  });

  it('全角冒号 summary：前缀命中但取值保留原样（indexOf 半角冒号的兼容现状）', () => {
    const out = parseClipFrontmatter('---\nsummary：一段摘要\n---\n正文');
    expect(out.summary).toBe('summary：一段摘要');
  });

  it('inline 数组标签；非法 inline 回退 list；无 frontmatter 全空', () => {
    expect(parseClipFrontmatter('---\ntags: ["a","b"]\n---\nx').tags).toEqual(['a', 'b']);
    expect(parseClipFrontmatter('---\ntags: [bad\n---\nx').tags).toEqual([]);
    expect(parseClipFrontmatter('没有 frontmatter')).toEqual({ summary: '', tags: [], url: '' });
  });

  it('tags 列表块被后续键终止', () => {
    const out = parseClipFrontmatter('---\ntags:\n  - a\nsource: web\n---\nx');
    expect(out.tags).toEqual(['a']);
  });
});

describe('hideSmartCat 与聊天面板', () => {
  it('初始化前隐藏安全；渲染历史后隐藏卸载容器且可重复调用', async () => {
    hideSmartCat(); // 未初始化早退
    const { app, vault } = makeApp();
    const base = defaultSmartCatData();
    base.config.conversationHistory = [
      { role: 'user', content: '你好呀', timestamp: '2026-08-26T00:00:00Z' },
      { role: 'assistant', content: '喵~有什么可以陪你', timestamp: '2026-08-26T00:00:01Z' },
    ];
    vault.files.set(getSmartcatFilePath(), JSON.stringify(base));
    await ensureSmartCat(app);
    await openSmartCatChat(app);
    const msgs = Array.from(document.querySelectorAll('.chat-messages .message')).map((el) => el.textContent);
    expect(msgs.length).toBe(3); // 欢迎语 + 两条历史
    expect(msgs[1]).toContain('你好呀');
    expect(msgs[2]).toContain('喵~有什么可以陪你');

    hideSmartCat();
    expect(document.getElementById(CAT_CONTAINER_ID)).toBeNull();
    hideSmartCat(); // 幂等重复调用安全
  });

  it('发送消息失败路径：打字指示器移除并展示道歉文案，历史不落盘', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    await openSmartCatChat(app);
    globalThis.fetch = vi.fn(async () => { throw new Error('network down'); }) as any;
    const input = document.querySelector<HTMLTextAreaElement>('.chat-input')!;
    input.value = '讲个笑话';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(1300);
    expect(document.querySelector('#typing-indicator')).toBeNull();
    const texts = Array.from(document.querySelectorAll('.chat-messages .message')).map((el) => el.textContent || '');
    expect(texts.some((t) => t.includes('无法回复'))).toBe(true);
    expect(__getSmartcatInternals().data.config.conversationHistory.length).toBe(0);
  });

  it('用户回应回填 Bandit reward：pendingArm 清除且臂参数更新', async () => {
    mockAIRouted();
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.editingData = { ...(d.editingData || {}), ceBandit: { pendingArm: 'life', pendingAt: Date.now() - 60_000 } };
    await openSmartCatChat(app);
    const input = document.querySelector<HTMLTextAreaElement>('.chat-input')!;
    input.value = '谢谢关心';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await sleep(600);
    const ce = d.editingData.ceBandit;
    expect(ce.pendingArm).toBeUndefined();
    expect(ce.life).toBeTruthy(); // life 臂收到 reward 更新
  });
});

describe('书评链路（file-open）', () => {
  function bookApp() {
    const view = {
      getViewType: () => 'markdown',
      getMode: () => 'preview',
      containerEl: (() => { const d = document.createElement('div'); d.innerHTML = '<div class="markdown-preview-view">正文片段</div>'; return d; })(),
      file: { basename: '三体', path: '书库/三体.md' },
    };
    const file = { path: '书库/三体.md', basename: '三体' };
    setApp({
      workspace: { getMostRecentLeaf: () => ({ view }), getActiveFile: () => file },
      metadataCache: { getFileCache: () => ({ frontmatter: { tags: ['book'], title: '三体', author: '刘慈欣' } }) },
    } as any);
  }

  it('无 book 标签 → 打开文件静默；有标签且 AI 成功 → 气泡展示书评', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const cb = (app as any).__wsListeners['file-open'][0];
    await cb({ path: '随便.md' }); // 无活动文件 → hasBookTag false → 静默
    await sleep(50);
    expect(bubbles.length).toBe(0);

    mockAIRouted();
    globalThis.fetch = vi.fn(async (_u: any, init: any) => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '想象宏大，值得一读。' } }] }),
    })) as any;
    bookApp();
    await cb({ path: '书库/三体.md' });
    await sleep(150);
    expect(bubbles.some((b) => b.includes('值得一读'))).toBe(true);
  });

  it('书评生成失败 → console.error 记录且不外抛', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = makeApp();
    await ensureSmartCat(app);
    globalThis.fetch = vi.fn(async () => { throw new Error('down'); }) as any;
    bookApp();
    await (app as any).__wsListeners['file-open'][0]({ path: '书库/三体.md' });
    await sleep(120);
    expect(errSpy).toHaveBeenCalledWith('[smartcat] 书评失败:', expect.any(Error));
  });
});

describe('vault 活动路由（diary/note/clipping/短路）', () => {
  it('日记新链路：基线→新增条目首落→改名迁移→条目删除→文件删除→未跟踪兜底', async () => {
    __setDiarySettleMsForTests(30);
    const { app, vault } = makeApp();
    const dir = '我的/日记';
    const p1 = `${dir}/${todayStr()}.md`;
    // 改名目标：同目录内另一个合法日期命名（diaryFileDate 只认 YYYY-MM-DD.md）
    const yest = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yp = (n: number) => String(n).padStart(2, '0');
    const p2 = `${dir}/${yest.getFullYear()}-${yp(yest.getMonth() + 1)}-${yp(yest.getDate())}.md`;
    const entryA = '# 😄 09:00\n今天心情不错，写了点代码。';
    vault.files.set(p1, entryA);
    await ensureSmartCat(app);
    // 重启基线：A 已有字 → generated，不装计时器也不产观察
    expect(__getDiaryTimersForTests().size).toBeGreaterThanOrEqual(1);

    // 新增条目 B → 计时器起动 → 静置结算首落观察
    vault.files.set(p1, entryA + '\n# 🌙 10:00\n晚上记录一条新的想法内容');
    vault.emit('modify', vault.file(p1));
    await sleep(10); // 事件处理是异步链：先让微任务跑完再查计时表
    expect([...__getDiaryTimersForTests().keys()].some((k) => k.includes('\u000110:00'))).toBe(true);
    await sleep(90);
    let stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    expect(stream.some((m) => m.description.includes(`你在 ${todayStr()} 10:00 写了一篇日记`))).toBe(true);

    // 新增条目 C → 静置后照常首落（改名前完成结算窗口）
    vault.files.set(p1, entryA + '\n# 🌙 10:00\n晚上记录一条新的想法内容\n# ✨ 11:00\n再记一条用于改名迁移验证');
    vault.emit('modify', vault.file(p1));
    await sleep(90);
    stream = __getSmartcatInternals().data.memory.memoryStream;
    expect(stream.some((m) => m.description.includes(`你在 ${todayStr()} 11:00 写了一篇日记`))).toBe(true);

    // 同目录改名 → 计时/跟踪快照 key 迁移到新路径（防假删除重刷首落）
    await vault.rename(vault.file(p1), p2);
    vault.emit('rename', vault.file(p2), p1);
    await sleep(10);
    expect([...__getDiaryTimersForTests().keys()].every((k) => k.startsWith(p2 + '\u0001'))).toBe(true);

    // 条目消失（modify diff）→ 删除观察（behavior 流）+ 计时清理
    vault.files.set(p2, entryA);
    vault.emit('modify', vault.file(p2));
    await sleep(40);
    const beh = __getSmartcatInternals().data.memory.behaviorStream;
    const yestStr = `${yest.getFullYear()}-${yp(yest.getMonth() + 1)}-${yp(yest.getDate())}`;
    expect(beh.some((m) => m.source === 'diary' && m.type === 'deleted')).toBe(true);

    // 文件删除事件（有跟踪快照）→ 逐条删除观察（behavior 流）
    vault.emit('delete', { path: p2 });
    await sleep(40);
    const beh2 = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh2.filter((m) => m.source === 'diary' && m.type === 'deleted').length).toBeGreaterThanOrEqual(2);

    // 从未跟踪过的日期文件删除 → 文件级单条兜底（behavior 流）
    vault.emit('delete', { path: `${dir}/2020-01-01.md` });
    await sleep(40);
    const beh3 = __getSmartcatInternals().data.memory.behaviorStream;
    expect(beh3.some((m) => m.source === 'diary' && m.type === 'deleted')).toBe(true);
  }, 20000);

  it('卡片盒/现代诗/信：修改静置首落、删除观察、移出目录观察、信准入拒绝', async () => {
    __setNoteSettleMsForTests(30);
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    // 卡片盒首落
    vault.files.set('卡片盒/想法一.md', '# 想法一\n\n卡片盒里的第一段完整正文内容');
    vault.emit('modify', vault.file('卡片盒/想法一.md'));
    await sleep(10); // 事件异步链落定后再查计时表
    expect(__getNoteTimersForTests().has('卡片盒/想法一.md')).toBe(true);
    await sleep(90);
    // 现代诗首落（文件名 YYMMDD 派生日期）
    vault.files.set('我的/现代诗/161230 忧郁啊.md', '天空低垂的黄昏');
    vault.emit('modify', vault.file('我的/现代诗/161230 忧郁啊.md'));
    await sleep(90);
    // 信无 frontmatter date → 准入拒绝不跟踪
    vault.files.set('我的/信/第一封.md', '亲爱的朋友');
    vault.emit('modify', vault.file('我的/信/第一封.md'));
    await sleep(40);
    const stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    const noteBeh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    // P2a：flash:created → behavior 流（知识内容不进记忆流）
    expect(noteBeh.some((m) => m.source === 'flash' && m.type === 'created')).toBe(true);
    expect(stream.some((m) => m.description.includes('你在 2016-12-30 08:00 写了一首现代诗「161230 忧郁啊」'))).toBe(true);
    expect(stream.some((m) => m.source === 'letter')).toBe(false);
    expect(__getNoteTimersForTests().has('我的/信/第一封.md')).toBe(false);

    // 删除已跟踪的诗 → 删除观察（behavior 流）
    vault.emit('delete', { path: '我的/现代诗/161230 忧郁啊.md' });
    await sleep(40);
    expect(noteBeh.some((m) => m.source === 'poem' && m.type === 'deleted')).toBe(true);

    // 卡片盒改名移出观察目录 → 按旧跟踪产删除观察（behavior 流）
    vault.emit('rename', { path: '其他/想法一.md' }, '卡片盒/想法一.md');
    await sleep(40);
    const noteBeh2 = __getSmartcatInternals().data.memory.behaviorStream;
    expect(noteBeh2.some((m) => m.source === 'flash' && m.type === 'deleted')).toBe(true);
  }, 20000);

  it('影视/番茄钟/reading 路径短路不产观察；无关 md 静默', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    const before = __getSmartcatInternals().data.memory.memoryStream.length;
    vault.files.set('我的/影视/肖申克.md', '---\nstatus: watched\n---\n经典');
    vault.emit('modify', vault.file('我的/影视/肖申克.md'));
    vault.files.set('书库/三体.md', '阅读中');
    vault.emit('modify', vault.file('书库/三体.md'));
    vault.files.set(`${settings.storagePath}/pomodoro.json`, '[]');
    vault.emit('modify', vault.file(`${settings.storagePath}/pomodoro.json`));
    vault.files.set('随手笔记.md', '普通笔记');
    vault.emit('modify', vault.file('随手笔记.md'));
    await sleep(80);
    expect(__getSmartcatInternals().data.memory.memoryStream.length).toBe(before);
  });

  it('noteSource 关闭时 vault 活动整链静默', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    __getSmartcatInternals().data.config.noteSource = false;
    const before = __getSmartcatInternals().data.memory.memoryStream.length;
    vault.files.set('卡片盒/另一条.md', '# 另一条\n内容');
    vault.emit('modify', vault.file('卡片盒/另一条.md'));
    vault.emit('delete', { path: '我的/现代诗/不存在诗.md' });
    await sleep(40);
    expect(__getSmartcatInternals().data.memory.memoryStream.length).toBe(before);
  });
});

describe('聚合讯待补全登记（ticket 076/084b）', () => {
  it('剪藏 modify 命中登记 → 补全完整保存观察并移除登记（P2b：行为流）', async () => {
    const { app, vault } = makeApp();
    const clip1 = '归档/网页剪藏/文章一.md';
    vault.files.set(clip1, '---\nurl: "https://ex.com/a"\nsummary: "精彩摘要"\ntags:\n  - 科技\n  - AI\n---\n正文');
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(10 * 60 * 1000); // 先不让降级定时器捣乱
    emitDomainEvent('news', { kind: 'saved', evt: { title: '好文', platform: '聚合讯', state: 'saved', durationMin: 5 }, clipPath: clip1 });
    await sleep(30); // 等 url 异步登记
    const pending = __getNewsPendingSavesForTests().get(clip1) as any;
    expect(pending.url).toBe('https://ex.com/a');

    vault.emit('modify', vault.file(clip1));
    await sleep(60);
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('saved');
    expect(last.metadata.extras.summary).toBe('精彩摘要');
    expect(last.metadata.extras.tags).toEqual(['科技', 'AI']);
    expect(__getNewsPendingSavesForTests().has(clip1)).toBe(false);
  }, 20000);

  it('等待超时未等 auto-summary → 降级保存观察（无摘要形态）并清登记（P2b：行为流）', async () => {
    const { app, vault } = makeApp();
    await ensureSmartCat(app);
    __setNewsSaveTimeoutForTests(40);
    const clip2 = '归档/网页剪藏/文章二.md';
    vault.files.set(clip2, '纯正文没有 frontmatter');
    emitDomainEvent('news', { kind: 'saved', evt: { title: '第二篇', platform: 'RSS', state: 'saved', durationMin: 2 }, clipPath: clip2 });
    await sleep(120);
    const beh: any[] = __getSmartcatInternals().data.memory.behaviorStream;
    const last = beh[beh.length - 1];
    expect(last.source).toBe('news');
    expect(last.type).toBe('saved');
    expect(last.metadata.name).toBe('第二篇');
    expect(last.metadata.extras.platform).toBe('RSS');
    expect(__getNewsPendingSavesForTests().has(clip2)).toBe(false);
  }, 20000);
});

describe('欢迎回来回程语（visibilitychange）', () => {
  function toggleHidden(hidden: boolean): () => void {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    return () => { delete (document as any).hidden; };
  }
  function fireVis(): void { document.dispatchEvent(new Event('visibilitychange')); }

  it('离开 ≥60s 回来按时段发问候；<60s 回来不发', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    vi.useFakeTimers();
    const restores: (() => void)[] = [];
    try {
      for (const hour of [8, 14, 22]) {
        vi.setSystemTime(new Date(2026, 7, 26, hour, 0, 0));
        restores.push(toggleHidden(true));
        fireVis();
        await vi.advanceTimersByTimeAsync(61_000);
        restores[restores.length - 1]();
        fireVis();
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(bubbles.length).toBe(3);
      expect(bubbles.every((b) => b.length > 0)).toBe(true);
      // 短离开：<60s 回来不触发
      const before = bubbles.length;
      restores.push(toggleHidden(true));
      fireVis();
      await vi.advanceTimersByTimeAsync(30_000);
      restores[restores.length - 1]();
      fireVis();
      await vi.advanceTimersByTimeAsync(31_000);
      expect(bubbles.length).toBe(before);
    } finally {
      restores.forEach((r) => r());
    }
  }, 20000);

  it('记忆足够且有作息画像 → 掺入作息感知话术', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.memory.memoryStream = mkStream(4);
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // 走时段语料 + 作息分支双命中
    vi.useFakeTimers();
    const restore = toggleHidden(true);
    fireVis();
    await vi.advanceTimersByTimeAsync(61_000);
    restore();
    fireVis();
    await vi.advanceTimersByTimeAsync(0);
    expect(bubbles.some((b) => b.includes('欢迎回来，我一直在哦~'))).toBe(true);
  }, 20000);
});

describe('主动关心 maybeProactiveCare（导出测试驱动）', () => {
  it('守卫链：未初始化/care 关/记忆不足/本周上限满 → 全部静默', async () => {
    await maybeProactiveCare(); // 未初始化
    expect(bubbles.length).toBe(0);
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.config.proactiveCare = false;
    d.memory.memoryStream = mkStream(5);
    await maybeProactiveCare();
    expect(bubbles.length).toBe(0);
    d.config.proactiveCare = true;
    d.memory.memoryStream = [];
    await maybeProactiveCare();
    expect(bubbles.length).toBe(0);
    // 上限满（非安静期）：间隔/作息放行但计数达 cap
    d.memory.memoryStream = mkStream(5);
    d.editingData = {
      ...(d.editingData || {}),
      proactiveCare: { week: isoWeekKey(), count: 2, lastAt: Date.now() - 4 * DAY_MS },
    };
    await maybeProactiveCare();
    expect(bubbles.length).toBe(0);
  }, 20000);

  it('AI 配置：LLM 关心话入气泡，计数 +1 并标记 pendingArm；空回复走兜底语料', async () => {
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.memory.memoryStream = mkStream(5);
    d.editingData = {
      ...(d.editingData || {}),
      proactiveCare: { week: isoWeekKey(), count: 0, lastAt: Date.now() - 4 * DAY_MS },
    };
    mockAIRouted();
    await maybeProactiveCare();
    expect(bubbles).toContain('喵呜~');
    expect(d.editingData.proactiveCare.count).toBe(1);
    expect(typeof d.editingData.ceBandit.pendingArm).toBe('string');
    expect(typeof d.editingData.lastPresenceAt).toBe('number');

    // 空回复 → 兜底硬编码语料
    d.editingData.proactiveCare.lastAt = Date.now() - 4 * DAY_MS;
    d.editingData.ceBandit = {};
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    })) as any;
    await maybeProactiveCare();
    expect(bubbles).toContain('喵~ 我注意到你最近常在深夜写东西，记得照顾好自己。');
  }, 20000);
});

describe('定时任务链路（趋势漂移 / 每周报告 / 关系史叙事）', () => {
  it('30 分钟趋势心跳回写 PAD 并喂门控；周三 10 点生成周报；11 点叙事扫描推进周键', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0)); // 周三 09:30
    mockAIRouted();
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.memory.memoryStream = mkStream(4);
    d.editingData = {
      ...(d.editingData || {}),
      weeklyReport: { weekKey: '2020-W01', at: 0 },
      dossierEvents: [{ eventId: 'e1', type: 'movie', at: new Date(Date.now() - 3600_000).toISOString(), title: '星际穿越' }],
    };
    const moodSpy = vi.spyOn(__getSmartcatInternals().moodSystem, 'applyTrendDrift');
    const gateSpy = vi.spyOn(__getSmartcatInternals().quietGateSystem, 'onHeartbeat');

    // +30min（10:00）→ 趋势漂移 tick 先响
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(moodSpy).toHaveBeenCalled();
    expect(gateSpy).toHaveBeenCalled();

    // +30min（10:30）→ 周报 tick 恰 h=10 生成；叙事扫描同刻首轮
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(d.memory.memoryStream.some((m: any) => m.description.includes('【本周懂你报告】'))).toBe(true);
    expect(d.editingData.weeklyReport.weekKey).toBe(isoWeekKey());
    expect(bubbles.some((b) => b.startsWith('喵~ 我读完这周关于你的记录了'))).toBe(true);
    expect(d.memory.memoryStream.some((m: any) => m.description.includes('【一起的日子】'))).toBe(true);
    expect(d.editingData.dossierScanKey).toBe(isoWeekKey());

    // +60min → 周报 tick h≠10 静默；叙事本周已生成不重复
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    const countBefore = d.memory.memoryStream.filter((m: any) => m.description.includes('【一起的日子】')).length;
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    const countAfter = d.memory.memoryStream.filter((m: any) => m.description.includes('【一起的日子】')).length;
    expect(countAfter).toBe(countBefore);
  }, 30000);

  it('常驻心跳节拍（p2 合并后时机不变）：10 分钟分派主动关心，9 分 59 秒不触发', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 26, 9, 30, 0));
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // 压制陪伴概率分支（speakProbability 0.3 恒不触发）
    const { app } = makeApp();
    await ensureSmartCat(app);
    const d: any = __getSmartcatInternals().data;
    d.memory.memoryStream = mkStream(5);
    d.editingData = {
      ...(d.editingData || {}),
      proactiveCare: { week: isoWeekKey(), count: 0, lastAt: Date.now() - 4 * DAY_MS },
    };
    // 先过 2s（覆盖 startCompanionMode 的 1000ms 欢迎语）建立基线
    await vi.advanceTimersByTimeAsync(2000);
    const base = bubbles.length;
    // 9 分 59 秒：未到 10 分钟节拍（20 节拍 × 30s）→ 主动关心不触发
    await vi.advanceTimersByTimeAsync(9 * 60 * 1000 + 59 * 1000 - 2000);
    expect(bubbles.length).toBe(base);
    // 10 分钟整：心跳分派主动关心 → 气泡 +1、计数 +1
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0); // 冲刷 maybeProactiveCare 的 await 微任务
    expect(bubbles.length).toBeGreaterThan(base);
    expect(d.editingData.proactiveCare.count).toBe(1);
  }, 20000);
});

describe('打字机点击跳过（UX 47）', () => {
  it('点击目标气泡立即完成全文渲染并清理 interval', async () => {
    vi.useFakeTimers();
    const el = document.createElement('div');
    document.body.appendChild(el);
    const p = __typewriterEffectForTests(el, '你好，世界！', 1000);
    vi.advanceTimersByTime(1000); // 1 打字节拍 → 1 字
    expect(el.textContent).toBe('你');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await p;
    expect(el.textContent).toBe('你好，世界！');
    // interval 已清：再推进不再增长（防残留定时器）
    vi.advanceTimersByTime(10_000);
    expect(el.textContent).toBe('你好，世界！');
    el.remove();
  });
});

describe('域 JSON 感知（library 盲通道）', () => {
  it('weave-data modify：即时书架事件 + 划线 5 分钟防抖合并入流', async () => {
    __setLibraryDebounceMsForTests(40);
    const { app, vault } = makeApp();
    const weavePath = `${settings.storagePath}/weave-data.json`;
    // 首次快照时书架为空（空对象也视为已存在文件，记入 observed）
    const weave0 = { books: {} };
    vault.files.set(weavePath, JSON.stringify(weave0));
    await ensureSmartCat(app); // 首次快照不产出
    await sleep(20); // 域 modify 监听经 onDomainActivity 异步挂载，先等它就位
    const weave1 = {
      books: {
        b1: {
          meta: { title: '三体' },
          reading: { position: { percent: 40 }, stats: { completedTime: '2026-08-26T10:00:00Z' }, sessions: [{ durationSeconds: 900 }] },
          notes: { highlights: [{ text: '很震撼的一段' }], excerpts: [] },
          sessions: [{ durationSeconds: 900 }],
        },
      },
    };
    vault.files.set(weavePath, JSON.stringify(weave1));
    vault.emit('modify', vault.file(weavePath));
    // 即时事件（逐条 await 入流）+ 防抖窗口（40ms）结算划线：并发跑全量时 CPU 争抢会拉伸
    // 异步链，固定 sleep 会假超时——改为轮询等待目标条目落流（deadline 内到齐即通过）
    const descs = () => (__getSmartcatInternals().data.memory.memoryStream as any[]).map((m) => m.description);
    const waitForDesc = async (text: string, deadlineMs = 8000): Promise<boolean> => {
      const t0 = Date.now();
      while (!descs().includes(text)) {
        if (Date.now() - t0 > deadlineMs) return false;
        await sleep(25);
      }
      return true;
    };
    expect(await waitForDesc('你开始读《三体》')).toBe(true);
    expect(await waitForDesc('你读完了《三体》')).toBe(true);
    expect(await waitForDesc('你读了《三体》约 15 分钟（读到 40%）')).toBe(true);
    expect(await waitForDesc('你在《三体》划了条重点：「很震撼的一段」')).toBe(true);
    const stream: any[] = __getSmartcatInternals().data.memory.memoryStream;
    expect(stream.filter((m) => m.source === 'library').length).toBeGreaterThanOrEqual(4);
    // 「读完」命中 dossier 正性白名单 → 事件表即写（经 onObservation 钩子）；划线防抖结算后落表
    const hasDossier = async (): Promise<boolean> => {
      const t0 = Date.now();
      while (!(__getSmartcatInternals().data.editingData?.dossierEvents || []).some((e: any) => e.type === 'book' && e.title === '三体')) {
        if (Date.now() - t0 > 3000) return false;
        await sleep(25);
      }
      return true;
    };
    expect(await hasDossier()).toBe(true);
  }, 20000);
});
