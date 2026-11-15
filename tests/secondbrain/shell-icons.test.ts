/**
 * 第二大脑面板图标物化（2026-11-15）：
 *
 * `render.ts` 的 `ic()` 只吐 `<i data-lucide>` 占位，真图标由 `mountIcons()` 物化。
 * 主面板 `createUI()` 把 `panelShellHtml()` 写进 `popup.innerHTML` 后一直没挂，
 * 全文件只在 `renderStats()` / `renderDist()` 末尾物化 —— 而引导态 / 进度态在
 * `render()` 里提前 return，永远走不到那两处。于是头行 glyph、引导页大图标、
 * 功能钮与移动端关闭钮的 × 全停在空占位上，视觉上就是几个空方块（桌面 / 移动同症状，
 * 两端共用 `openSecondBrainPanel()`，没有端分支）。
 *
 * 口径：骨架一建出来就把占位物化（与三态无关）；内容态原有的动态重渲仍各自物化，
 * 重复调用无害。尺寸不能只靠 `ic()` 的内联 style —— `mountIcons()` 替换时只复制
 * className，内联尺寸会丢，所以域样式要给回按容器的宽高。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import BzSettings, { DEFAULT_SETTINGS } from '../../src/settings';
import { SecondBrainPanel } from '../../src/secondbrain/panel';
import { ChatPanel } from '../../src/secondbrain/chat-panel';
import { openWeeklyDigest, unloadWeeklyDigest } from '../../src/secondbrain/weekly-ui';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

function makeEnv() {
  const vault = new MockVault();
  const app = mockAppWithVault(vault);
  setApp(app);
  setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, storagePath: 'CONFIG/STORAGE' }) as BzSettings);
  return app;
}

/** 空库 fake store：未就绪、无在跑 → 打开即引导态（走不到 renderStats/renderDist） */
function makeEmptyStore(): any {
  return {
    initialLoad: Promise.resolve(),
    isIndexReady: () => false,
    isRefreshing: () => false,
    hasPendingChanges: () => false,
    needsModelRebuild: () => false,
    refresh: async () => {},
    meta: { notes: {}, _dim: 0 },
    vectors: [],
  };
}

/** 就绪库 fake store：无待处理 → 打开即内容态 */
function makeReadyStore(): any {
  return {
    ...makeEmptyStore(),
    isIndexReady: () => true,
    meta: { notes: {}, _dim: 2 },
  };
}

const popupOf = () => document.querySelector('.bz-sb-panel') as HTMLElement | null;

/** 容器内必须有一个已物化的 `.bz-ic`；给了图标名还要对得上（mock 记 dataset.icon） */
function expectIconIn(sel: string, icon?: string): void {
  const host = document.querySelector(sel);
  expect(host, `${sel} 应存在`).not.toBeNull();
  const ic = host!.querySelector('.bz-ic') as HTMLElement | null;
  expect(ic, `${sel} 内应有物化图标 .bz-ic`).not.toBeNull();
  if (icon) expect(ic!.dataset.icon, `${sel} 图标名`).toBe(icon);
}

beforeEach(() => {
  resetObsidianMocks();
  document.body.innerHTML = '';
});

/** 周报弹层是模块级单例，不清会把已脱离文档的壳带进下一轮（重试时会看不见新壳） */
afterEach(() => unloadWeeklyDigest());

describe('第二大脑主面板 · 骨架图标物化', () => {
  it('引导态：占位清零，头行 / 引导页 / 移动关闭钮的图标全部就位', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeEmptyStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await vi.waitFor(() => expect(document.getElementById('bz-sb-onboard')?.style.display).toBe('flex'), { timeout: 1500 });

    const popup = popupOf()!;
    expect(popup.querySelectorAll('[data-lucide]').length, '引导态不得留任何空占位').toBe(0);
    expect(popup.querySelectorAll('.bz-ic').length).toBeGreaterThan(0);

    expectIconIn('.bz-sb-glyph', 'brain');
    expectIconIn('.bz-sb-onboard-icon', 'brain');
    expectIconIn('#bz-sb-mb-close', 'x');
    // 头行四枚功能钮（周报 / 对话 / 参考 / 关闭）：引导期虽被整组收起，图标也得先挂上
    for (const id of ['bz-sb-weekly-open', 'bz-sb-open-chat', 'bz-sb-open-ref', 'bz-sb-panel-close']) {
      expectIconIn('#' + id);
    }
    panel.destroy();
  });

  it('内容态：骨架同样一次挂齐（不靠统计渲染顺带兜底）', async () => {
    const app = makeEnv();
    const panel = new SecondBrainPanel(app, makeReadyStore(), { onOpenReference: () => {}, onOpenChat: () => {} });
    await panel.open();
    await vi.waitFor(() => expect(document.getElementById('bz-sb-content')?.style.display).toBe('flex'), { timeout: 1500 });

    const popup = popupOf()!;
    expect(popup.querySelectorAll('[data-lucide]').length).toBe(0);
    expectIconIn('.bz-sb-glyph', 'brain');
    expectIconIn('#bz-sb-panel-close', 'x');
    expectIconIn('.bz-sb-foot #bz-sb-incr');
    expectIconIn('.bz-sb-foot #bz-sb-rebuild');
    panel.destroy();
  });

  it('样式：物化后的图标按容器有确定尺寸（内联 style 在替换时已丢，缺了会撑满容器或塌成默认块）', () => {
    const css = read('src/secondbrain/styles.css');
    const rule = (sel: string) => {
      const i = css.indexOf(sel);
      expect(i, `styles.css 缺 ${sel} 规则`).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i) + 1);
    };
    expect(rule('.bz-sb-panel .bz-sb-glyph .bz-ic')).toMatch(/width:\s*19px/);
    expect(rule('.bz-sb-panel .bz-sb-onboard-icon .bz-ic')).toMatch(/width:\s*34px/);
    expect(rule('.bz-sb-panel .bz-sb-fbtn .bz-ic')).toMatch(/width:\s*14px/);
    expect(rule('.bz-sb-panel .bz-sb-ct .bz-ic')).toMatch(/width:\s*13px/);
  });
});

describe('第二大脑 · 本周知识动态弹层图标物化', () => {
  it('头行 glyph 与关闭钮在首次建壳时就挂好（同域同类漏挂）', async () => {
    const app = makeEnv();
    openWeeklyDigest(app);
    await vi.waitFor(
      () => {
        expect(document.getElementById('bz-sb-weekly-panel')?.style.display).toBe('flex');
      },
      { timeout: 1500 }
    );

    const popup = document.getElementById('bz-sb-weekly-panel')!;
    expect(popup.querySelectorAll('[data-lucide]').length).toBe(0);
    expectIconIn('#bz-sb-weekly-panel .bz-sb-glyph', 'calendar-days');
    expectIconIn('#bz-sb-weekly-close', 'x');
  });
});

describe('第二大脑对话 · 气泡图标物化', () => {
  it('用户 / 助手气泡的 who 行图标立即物化（局部重写 innerHTML 后不再留空占位）', () => {
    const app = makeEnv();
    const chat = new ChatPanel({ search: vi.fn(async () => []) } as any, app);
    chat.addChatMessage('user', '你好');
    chat.addChatMessage('assistant', '你好，我是第二大脑。');
    const whos = Array.from(chat.messagesDiv.querySelectorAll<HTMLElement>('.bz-sb-chat-who'));
    // 构造时已有一条欢迎语（assistant），累计三条
    expect(whos.length).toBeGreaterThanOrEqual(3);
    for (const who of whos) expect(who.querySelector('[data-lucide]')).toBeNull();
    const icons = whos.map((w) => (w.querySelector('.bz-ic') as HTMLElement | null)?.dataset.icon);
    expect(icons[0]).toBe('brain'); // 欢迎语（assistant）
    expect(icons[icons.length - 2]).toBe('send'); // 刚发的用户气泡
    expect(icons[icons.length - 1]).toBe('brain'); // 刚发的助手气泡
    chat.destroy();
  });
});
