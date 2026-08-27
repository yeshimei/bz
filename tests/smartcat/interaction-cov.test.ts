/**
 * smartcat 交互管理器覆盖率补测（拖拽/手势主干见 interaction.test.ts）：
 * 宠物消息（含心跳随机分支）、点触单击宠物/长按复位、陪伴模式欢迎语与定时自言自语、
 * 自动陪伴消息四分支（锁/AI 未配置/选中文本/无上下文/编辑器上下文）、
 * 聊天消息组装（历史截取/笔记上下文/记忆检索失败降级）、移动端输入法适配器全生命周期。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionManager, MobileInputAdapter } from '../../src/smartcat/interaction';
import type { InteractionDeps } from '../../src/smartcat/interaction';
import { CAT_CONTAINER_ID } from '../../src/smartcat/ui';
import { eventSystem } from '../../src/smartcat/state';
import { EVENTS } from '../../src/smartcat/types';
import { setApp } from '../../src/core/app';
import { setAISettingsProvider, resetAIProviderCache } from '../../src/core/ai';
import { USER_CONTENT_BOUNDARY } from '../../src/smartcat/memory';
import { defaultPersonalityGrowth } from '../../src/smartcat/data';

function mountCat(): HTMLElement {
  const existed = document.getElementById(CAT_CONTAINER_ID);
  if (existed) existed.remove();
  const c = document.createElement('div');
  c.id = CAT_CONTAINER_ID;
  c.innerHTML = '<div id="cat-body"></div>';
  document.body.appendChild(c);
  return c;
}

function makeDeps(overrides: Partial<InteractionDeps> = {}): InteractionDeps {
  return {
    config: () => ({
      speakInterval: 1, speakProbability: 0, contextLength: 500, contextSplitRatio: 0.5,
      conversationHistory: [], shortTermMemory: 50,
    }) as never,
    // 气泡统一经注入桩收集（真实 BubbleManager 的 DOM 打字机与本域单测无关）
    bubble: { showBubble: (m: string) => { bubbles.push(m); } },
    mood: { pad: { pleasure: 55, arousal: 50, dominance: 50 }, currentMood: 'calm', getCurrentMoodEmoji: () => '😺', getCurrentEmotion: () => 'calm' },
    openChat: () => {},
    openSettings: () => {},
    ...overrides,
  } as unknown as InteractionDeps;
}

function mouse(target: EventTarget, type: string, x: number, y: number): void {
  target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true }));
}

function touch(target: EventTarget, type: string, x: number, y: number): void {
  const e: any = new Event(type, { bubbles: true });
  e.touches = [{ clientX: x, clientY: y }];
  e.changedTouches = [{ clientX: x, clientY: y }];
  target.dispatchEvent(e);
}

/** 编辑器型 app：getCursorContext/getCurrentNoteContext 有真实返回 */
function mountEditorApp(): void {
  const editor = {
    getValue: () => '第一行的内容\n光标所在行有一段足够长的正文内容用于上下文提取\n第三行的内容',
    getCursor: () => ({ line: 1, ch: 0 }),
  };
  setApp({
    workspace: { getMostRecentLeaf: () => ({ view: { editor, file: { basename: '读书笔记' } } }), getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  } as any);
}

/** 预览模式书页 app：hasBookTag 命中 + getVisibleContent 取预览文本 */
function mountBookApp(): void {
  const view = {
    getViewType: () => 'markdown',
    getMode: () => 'preview',
    containerEl: (() => { const d = document.createElement('div'); d.innerHTML = '<div class="markdown-preview-view">这是一本值得细读的书的内容片段</div>'; return d; })(),
    file: { basename: '三体' },
  };
  const file = { path: '书库/三体.md', basename: '三体' };
  setApp({
    workspace: { getMostRecentLeaf: () => ({ view }), getActiveFile: () => file },
    metadataCache: { getFileCache: () => ({ frontmatter: { tags: ['book'] } }) },
  } as any);
}

const bubbles: string[] = [];
let manager: InteractionManager | null = null;
let origFetch: typeof fetch;

beforeEach(() => {
  vi.useFakeTimers();
  bubbles.length = 0;
  mountCat();
  setAISettingsProvider(() => ({})); // 默认未配置 AI（isAIConfigured=false）
  resetAIProviderCache();
  origFetch = globalThis.fetch;
});

afterEach(() => {
  manager?.dispose();
  manager = null;
  globalThis.fetch = origFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

/** 配置 AI 并 mock fetch 成功回复 */
function mockAISuccess(content = '喵呜~'): void {
  resetAIProviderCache();
  setAISettingsProvider(() => ({ aiProvider: 'deepseek', deepseekApiKey: 'sk-test' }));
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  })) as any;
}

async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('宠物消息与点触手势', () => {
  it('单击（300ms 无第二击）→ 宠物消息气泡 + 猫体缩放动画 + PET_INTERACTION 事件', async () => {
    const petSpy = vi.fn();
    eventSystem.on(EVENTS.PET_INTERACTION, petSpy);
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({ bubble: { showBubble } as any }));
    manager.setupInteractions();
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // 不触发心跳分支
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    vi.advanceTimersByTime(300);
    expect(showBubble).toHaveBeenCalledTimes(1);
    expect(typeof showBubble.mock.calls[0][0]).toBe('string');
    const catBody = cat.querySelector('#cat-body') as HTMLElement;
    expect(catBody.style.transform).toContain('scale');
    expect(petSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(400); // 缩放复位
    expect(catBody.style.transform).toBe('scale(1) rotate(0deg)');
    eventSystem.off(EVENTS.PET_INTERACTION, petSpy);
  });

  it('抚摸心跳分支（随机命中）：挂 heartbeat 动画并在 500ms 后清空', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.5 触发心跳
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    vi.advanceTimersByTime(300);
    const catBody = cat.querySelector('#cat-body') as HTMLElement;
    expect(catBody.style.animation).toContain('heartbeat');
    vi.advanceTimersByTime(500);
    expect(catBody.style.animation).toBe('');
  });

  it('CAT_TAPPED 事件携带连击计数；长按后松手（tapCount=-1）走无动作复位分支', () => {
    const taps: number[] = [];
    eventSystem.on(EVENTS.CAT_TAPPED, (d: any) => taps.push(d.count));
    const openSettings = vi.fn();
    manager = new InteractionManager(makeDeps({ openSettings }));
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    expect(taps).toEqual([1]);
    vi.advanceTimersByTime(400); // 让单击计时先走完复位（真实点击节奏）
    // 长按：openSettings 触发且计数置 -1
    mouse(cat, 'mousedown', 100, 100);
    vi.advanceTimersByTime(850);
    expect(openSettings).toHaveBeenCalledTimes(1);
    mouse(document, 'mouseup', 100, 100);
    // -1+1=0 → 三击及以上复位分支；复位后仍派发一次 CAT_TAPPED（count=0）
    expect(taps).toEqual([1, 0]);
    expect((manager as any).tapCount).toBe(0);
    eventSystem.off(EVENTS.CAT_TAPPED, (d: any) => taps.push(d.count));
  });

  it('带 book 标签的笔记上单击 → 走自动陪伴生成而非宠物消息', async () => {
    mountBookApp();
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    mouse(cat, 'mousedown', 100, 100);
    mouse(document, 'mouseup', 100, 100);
    await flush();
    vi.advanceTimersByTime(300);
    await flush();
    // AI 未配置 → 兜底陪伴语料（而非宠物文案）
    expect(bubbles.some((b) => /喵|笔记|专注|休息/.test(b))).toBe(true);
  });
});

describe('陪伴模式（欢迎语 + 定时自言自语）', () => {
  it('启动 1s 后：AI 未配置 → 引导语；AI 已配置 → 连接问候', async () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(bubbles.length).toBe(1);

    bubbles.length = 0;
    mockAISuccess();
    manager.dispose();
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    vi.advanceTimersByTime(1000);
    await flush();
    expect(bubbles.length).toBe(1);
  });

  it('restartCompanionInterval：概率不命中静默；命中则触发自动陪伴兜底语料', async () => {
    // 概率 0：tick 到点也不说
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    vi.advanceTimersByTime(60_000);
    await flush();
    // 只有启动欢迎语，无自言自语
    expect(bubbles.length).toBe(1);
    manager.dispose();

    // 概率 1：下一 tick 必触发；随机数同时决定语料取第 0 条（floor(0.2*4)=0）
    vi.spyOn(Math, 'random').mockReturnValue(0.2);
    const deps = makeDeps() as any;
    deps.config = () => ({ speakInterval: 1, speakProbability: 1, contextLength: 500, contextSplitRatio: 0.5, conversationHistory: [], shortTermMemory: 50 });
    manager = new InteractionManager(deps);
    manager.setupInteractions();
    vi.advanceTimersByTime(60_000);
    await flush();
    expect(bubbles).toContain('喵~ 继续加油写笔记哦！');
  });
});

describe('generateAutoCompanionMessage 四分支', () => {
  it('锁持有 → 提示思考中并直接返回（不发起请求）', async () => {
    mockAISuccess();
    manager = new InteractionManager(makeDeps());
    (manager as any).generateAutoCompanionMessageLock = true;
    await manager.generateAutoCompanionMessage();
    expect(bubbles.length).toBe(1);
    expect((globalThis.fetch as any).mock.calls.length).toBe(0);
  });

  it('AI 未配置 + 无上下文 → 本地兜底语料，不发起请求', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as any;
    manager = new InteractionManager(makeDeps());
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(bubbles.length).toBe(1);
    expect(['喵~ 继续加油写笔记哦！', '笔记进展如何？需要我陪伴吗？', '保持专注，你做得很好！✨', '休息一下也不错哦~ 🐾🐾🐾']).toContain(bubbles[0]);
  });

  it('AI 已配置 + 无上下文（auto_companion 分支）→ 思考态调用并展示回复', async () => {
    mockAISuccess('给你比个心~');
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({ bubble: { showBubble } as any }));
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(showBubble).toHaveBeenCalledWith('给你比个心~');
    expect((manager as any).generateAutoCompanionMessageLock).toBe(false);
  });

  it('AI 回复为空串 → 不展示空气泡但锁正常释放', async () => {
    mockAISuccess('');
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({ bubble: { showBubble } as any }));
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(showBubble).not.toHaveBeenCalled();
    expect((manager as any).generateAutoCompanionMessageLock).toBe(false);
  });

  it('选中文本 ≤1500 字 → 以选中内容发起调用', async () => {
    mockAISuccess('这段写得不错');
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => '  被选中的句子  ' } as any);
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({ bubble: { showBubble } as any }));
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(showBubble).toHaveBeenCalledWith('这段写得不错');
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('被选中的句子');
  });

  it('编辑器有上下文 → learn prompt + 全文上下文路径；记忆检索结果注入懂你块', async () => {
    mockAISuccess('继续加油');
    const showBubble = vi.fn();
    let retrieved = '';
    // 状态向量段需要完整 30 特质 → 用出生默认人格
    const growth = defaultPersonalityGrowth();
    manager = new InteractionManager(makeDeps({
      bubble: { showBubble } as any,
      retrieveMemories: async (q: string) => { retrieved = q; return '用户最近在写小说'; },
      characterData: () => ({ personalityGrowth: growth, mood: { currentEmotion: '开心' }, memory: { memoryStream: [], behaviorStream: [] } }),
    }));
    mountEditorApp();
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(showBubble).toHaveBeenCalledWith('继续加油');
    expect(retrieved).toBe(''); // 自动陪伴用空 query 检索
    const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(body.messages[1].content).toContain('光标所在行有一段足够长的正文内容');
  });

  it('记忆检索抛错 → 降级空串不阻断；调用失败 → 锁复位且不外抛', async () => {
    mockAISuccess();
    (globalThis.fetch as any) = vi.fn(async () => { throw new Error('network down'); });
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({
      bubble: { showBubble } as any,
      retrieveMemories: async () => { throw new Error('检索炸了'); },
    }));
    await expect(manager.generateAutoCompanionMessage()).resolves.toBeUndefined();
    await flush();
    expect((manager as any).generateAutoCompanionMessageLock).toBe(false);
    expect(showBubble).not.toHaveBeenCalled();
  });

  it('retrieveMemories 未注入 → 返回空串照常出稿', async () => {
    mockAISuccess('好的');
    const showBubble = vi.fn();
    manager = new InteractionManager(makeDeps({ bubble: { showBubble } as any }));
    await manager.generateAutoCompanionMessage();
    await flush();
    expect(showBubble).toHaveBeenCalledWith('好的');
  });
});

describe('prepareChatMessages 聊天组装', () => {
  it('system 边界 + 历史截取（min(shortTermMemory*2, len)）+ 尾部用户消息', async () => {
    const history = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `h${i}` }));
    manager = new InteractionManager(makeDeps({
      config: () => ({ speakInterval: 1, speakProbability: 0, contextLength: 500, contextSplitRatio: 0.5, conversationHistory: history, shortTermMemory: 20 }) as never,
    }));
    const messages = await manager.prepareChatMessages('你好');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(USER_CONTENT_BOUNDARY.slice(0, 12));
    expect(messages[messages.length - 1].content).toContain('用户最新消息：你好');
    // shortTermMemory=20 → 上限 40 条历史
    expect(messages.length).toBe(1 + 40 + 1);
    expect(messages[1].content).toBe('h20');
    expect(messages[40].content).toBe('h59');
  });

  it('编辑器上下文注入当前笔记名与内容；检索失败降级不影响组装', async () => {
    mountEditorApp();
    manager = new InteractionManager(makeDeps({
      retrieveMemories: async () => { throw new Error('x'); },
    }));
    const messages = await manager.prepareChatMessages('总结一下');
    const userMsg = messages[messages.length - 1].content as string;
    expect(userMsg).toContain('- 当前笔记：读书笔记');
    expect(userMsg).toContain('- 当前内容：第一行的内容');
    expect(userMsg).toContain('用户最新消息：总结一下');
  });

  it('book 标签预览模式 → 内容取可见区；词法 query 用纯用户消息', async () => {
    mountBookApp();
    const queries: [string, string | undefined][] = [];
    manager = new InteractionManager(makeDeps({
      retrieveMemories: async (q: string, lexical?: string) => { queries.push([q, lexical]); return ''; },
    }));
    const messages = await manager.prepareChatMessages('主角是谁');
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(queries.length).toBe(1);
    expect(queries[0][1]).toBe('主角是谁'); // lexicalQuery = 纯用户消息
    expect(queries[0][0]).toContain('主角是谁'); // 语义 query 含情绪/时段扩展
  });
});

describe('dispose 清理完整性', () => {
  it('清理陪伴定时器/点触计时/回弹计时，卸载后一切静默', () => {
    manager = new InteractionManager(makeDeps());
    manager.setupInteractions();
    const cat = document.getElementById(CAT_CONTAINER_ID)!;
    // 制造回弹计时器
    Object.defineProperty(cat, 'offsetWidth', { value: 50, configurable: true });
    Object.defineProperty(cat, 'offsetHeight', { value: 40, configurable: true });
    touch(cat, 'touchstart', 300, 700);
    touch(cat, 'touchmove', 300, 2000);
    touch(cat, 'touchend', 300, 2000);
    manager.dispose();
    const l = parseFloat(cat.style.left);
    vi.advanceTimersByTime(120_000); // 陪伴 interval / 回弹恢复计时全部不应再动位置
    expect(parseFloat(cat.style.left)).toBe(l);
    expect(manager.companionInterval).toBeNull();
  });
});

describe('MobileInputAdapter 移动端输入法适配', () => {
  function stubUA(ua: string): () => void {
    const desc = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
    return () => {
      delete (navigator as any).userAgent;
      if (desc) Object.defineProperty(navigator, 'userAgent', desc);
    };
  }

  /** 聊天面板包装（UX 36 范围收敛：只有自家面板内的输入才抬猫） */
  function panelInput(): HTMLInputElement {
    let panel = document.getElementById('chat-panel') as HTMLElement | null;
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'chat-panel';
      document.body.appendChild(panel);
    }
    const input = document.createElement('input');
    input.type = 'text';
    panel.appendChild(input);
    return input;
  }

  it('桌面 UA：构造不挂监听，聚焦输入框不动猫，destroy 安全', () => {
    const restore = stubUA('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const input = panelInput();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(container.style.position).toBe('');
    expect(() => adapter.destroy()).not.toThrow();
    restore();
  });

  it('移动 UA：聚焦自家面板输入框 → fixed 居中悬浮；失焦 300ms 后还原且保留拖拽位置', () => {
    const restore = stubUA('Mozilla/5.0 (iPhone; CPU iPhone OS 17 like Mac OS X)');
    const container = document.createElement('div');
    container.style.left = '99px';
    container.style.top = '123px';
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const input = panelInput();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(container.style.position).toBe('fixed');
    expect(container.style.transform).toBe('translateX(-50%)');
    expect(parseFloat(container.style.top)).toBe(window.innerHeight - 0 - 20 >= 10 ? window.innerHeight - 20 : 10);
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(container.style.position).toBe('');
    // UX 36：失焦不重置拖拽位置（抬升前捕获的 left/top 原样复原；top 空串走样式表默认位）
    expect(container.style.left).toBe('99px');
    expect(container.style.top).toBe('123px');
    adapter.destroy();
    restore();
  });

  it('UX 36 范围收敛：自家面板外的输入聚焦不抬猫（全局焦点劫持收敛）', () => {
    const restore = stubUA('Android Mobile');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const stray = document.createElement('input');
    stray.type = 'text';
    document.body.appendChild(stray); // 不在 #chat-panel / 设置 / 面板内
    stray.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(container.style.position).toBe('');
    expect(container.style.top).toBe('');
    adapter.destroy();
    restore();
  });

  it('shouldHandleElement 分支：checkbox/普通 div 不处理（面板内也不抬）、TEXTAREA 处理', () => {
    const restore = stubUA('Android Mobile');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const fire = (el: HTMLElement) => el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    // 负例先行（此时 isInputActive 尚未置位，样式不应被改；且即使面板内 checkbox 也不处理）
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.appendChild(checkbox);
    fire(checkbox);
    expect(container.style.position).toBe('');
    const plainDiv = document.createElement('div');
    document.body.appendChild(plainDiv);
    fire(plainDiv);
    expect(container.style.position).toBe('');
    // 正例：面板内 TEXTAREA
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    document.body.appendChild(panel);
    const textarea = document.createElement('textarea');
    panel.appendChild(textarea);
    fire(textarea);
    expect(container.style.position).toBe('fixed');
    adapter.destroy();
    restore();
  });

  it('UX 36 焦点跳转/抖动竞态：面板内输入间跳转不复原；300ms 内重新聚焦取消复原', () => {
    const restore = stubUA('iPhone');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const panel = document.createElement('div');
    panel.id = 'chat-panel';
    document.body.appendChild(panel);
    const a = document.createElement('input');
    a.type = 'text';
    const b = document.createElement('input');
    b.type = 'text';
    panel.appendChild(a);
    panel.appendChild(b);
    // 面板内 a → b 跳转：focusout 的 relatedTarget 仍在面板内 → 不复原
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(container.style.position).toBe('fixed');
    b.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: a }));
    vi.advanceTimersByTime(400);
    expect(container.style.position).toBe('fixed');
    // 失焦后 300ms 内重新聚焦（输入法抖动）→ 取消复原保持抬升态
    b.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(400);
    expect(container.style.position).toBe('fixed');
    adapter.destroy();
    restore();
  });

  it('visualViewport 存在：resize 在激活时重算位置；destroy 摘除监听', () => {
    const restore = stubUA('iPhone');
    const vvListeners: Record<string, Function[]> = {};
    (window as any).visualViewport = {
      height: 500,
      addEventListener: (ev: string, cb: Function) => { (vvListeners[ev] ||= []).push(cb); },
      removeEventListener: (ev: string, cb: Function) => {
        const arr = vvListeners[ev] || [];
        const idx = arr.indexOf(cb);
        if (idx >= 0) arr.splice(idx, 1);
      },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const adapter = new MobileInputAdapter(container);
    const input = panelInput();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const topBefore = parseFloat(container.style.top);
    (window as any).visualViewport.height = 260;
    vvListeners['resize'][0]();
    const topAfter = parseFloat(container.style.top);
    expect(topAfter).toBeLessThan(topBefore);
    adapter.destroy();
    expect(vvListeners['resize'].length).toBe(0);
    delete (window as any).visualViewport;
    restore();
  });
});
