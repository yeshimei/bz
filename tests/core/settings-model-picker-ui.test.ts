/**
 * 设置页「获取模型名」按钮 UI 测试（ticket 173）：模型名称行内嵌按钮渲染（bz-setting-action-row 豁免）、
 * 点击拉取（桩 fetch）成功弹选择器、选中回填 per-provider 覆盖 + 落盘 + success toast、
 * 失败路径 toast 报错且设置不动。jsdom 环境。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type BzSettings from '../../src/settings';
import { resetObsidianMocks } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { mainSettingsSchema } from '../../src/core/settings-main-schema';
import { closeModelPicker } from '../../src/core/settings-model-picker';
import { __resetNoticeForTests, cleanupNotices } from '../../src/core/notice';

const state = { ...DEFAULT_SETTINGS } as BzSettings & Record<string, unknown>;
const saver = vi.fn(async () => {});

/** 按设置名找行（mock Setting 在 settingEl 挂 dataset.name） */
function findRow(container: HTMLElement, name: string): HTMLElement {
  const el = [...container.querySelectorAll('.setting-item')].find(
    (s) => (s as HTMLElement).dataset.name === name
  ) as HTMLElement;
  expect(el, `行「${name}」存在`).toBeTruthy();
  return el;
}

/** 行内 mock 文本控件（含真实 inputEl） */
function textControlOf(el: HTMLElement): any {
  return (el as any).__setting.controls.find((c: any) => c.inputEl);
}

/** 行内 mock 按钮控件 */
function buttonOf(el: HTMLElement): any {
  return (el as any).__setting.controls.find((c: any) => typeof c.trigger === 'function' && !c.inputEl && !c.value);
}

/** 渲染 AI 组（与主设置页同 schema） */
function renderAIGroup(): HTMLElement {
  const schema = mainSettingsSchema();
  const container = document.createElement('div');
  renderSettingsInto(container, { groups: [schema.groups[0]] });
  return container;
}

/** 可见 toast 文本列表 */
function visibleToasts(): string[] {
  return Array.from(document.querySelectorAll('.bz-notice')).map(
    (el) => (el.querySelector('.bz-notice-body') || el).textContent || ''
  );
}

function okModels(data: unknown): any {
  return { ok: true, status: 200, json: async () => data };
}

beforeEach(() => {
  resetObsidianMocks();
  for (const k of Object.keys(state)) delete (state as any)[k];
  Object.assign(state, DEFAULT_SETTINGS);
  saver.mockClear();
  setSettingsProvider(() => state);
  setSettingsSaver(saver);
  document.body.innerHTML = '';
  __resetNoticeForTests();
  vi.useRealTimers();
});

afterEach(() => {
  closeModelPicker();
  cleanupNotices();
  vi.useRealTimers();
});

describe('获取模型名按钮：拉取 → 选择器 → 回填', () => {
  it('按钮渲染在模型名称行内（行内嵌按钮，非独立操作行），行内同时有输入框', () => {
    state.aiProvider = 'opencode-go';
    const container = renderAIGroup();
    const modelRow = findRow(container, '模型名称');
    const btn = buttonOf(modelRow);
    expect(btn).toBeTruthy();
    expect(btn.text).toBe('获取模型名');
    // 行内嵌按钮不挂 bz-setting-action-row（该豁免仅独立 ButtonRow）——模型行计为设置项
    expect(modelRow.classList.contains('bz-setting-action-row')).toBe(false);
    expect(textControlOf(modelRow).value).toBe('deepseek-v4-flash');
  });

  it('点击 → 拉取成功 → 弹选择器（服务商 label + 模型列表）→ 选中回填 aiModelOverrides + 落盘 + success toast', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'sk-test';
    state.aiModelOverrides = { deepseek: 'deepseek-reasoner' }; // 有当前值 → 置顶高亮
    vi.stubGlobal('fetch', vi.fn(async () => okModels({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] })));
    try {
      const container = renderAIGroup();
      const modelRow = findRow(container, '模型名称');
      buttonOf(modelRow).trigger();
      // 等待弹窗出现
      await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
      const popup = document.getElementById('bz-model-picker-popup')!;
      expect(popup.querySelector('.bz-settings-title')!.textContent).toBe('选择模型（DeepSeek）');
      // 当前值（deepseek-reasoner）置顶并高亮
      const rows = [...popup.querySelectorAll('.bz-model-picker-row')] as HTMLElement[];
      expect(rows[0].querySelector('.bz-model-picker-name')!.textContent).toBe('deepseek-reasoner');
      expect(rows[0].classList.contains('is-current')).toBe(true);
      expect(rows[1].querySelector('.bz-model-picker-name')!.textContent).toBe('deepseek-chat');
      // 选中第一项（当前值本身）回填
      rows[0].click();
      await vi.waitFor(() => expect(state.aiModelOverrides?.deepseek).toBe('deepseek-reasoner'));
      expect(saver).toHaveBeenCalled();
      expect(textControlOf(findRow(container, '模型名称')).value).toBe('deepseek-reasoner');
      expect(visibleToasts().some((t) => t.includes('模型已设为 deepseek-reasoner'))).toBe(true);
      // 选择器已关闭
      expect(document.getElementById('bz-model-picker-popup')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('custom 服务商：选中回填 aiCustomModel；上下文/最大输出行无按钮', async () => {
    state.aiProvider = 'custom';
    state.aiCustomEndpoint = 'https://api.example.com/v1';
    state.aiCustomApiKey = 'ck';
    vi.stubGlobal('fetch', vi.fn(async () => okModels({ data: [{ id: 'taste-1' }, { id: 'taste-2' }] })));
    try {
      const container = renderAIGroup();
      const modelRow = findRow(container, '模型名称');
      buttonOf(modelRow).trigger();
      await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
      const popup = document.getElementById('bz-model-picker-popup')!;
      (popup.querySelector('.bz-model-picker-row') as HTMLElement).click();
      await vi.waitFor(() => expect(state.aiCustomModel).toBe('taste-1'));
      expect(textControlOf(findRow(container, '模型名称')).value).toBe('taste-1');
      // 上下文/最大输出两行不渲染按钮（按钮仅模型行内嵌；此两行已是标准 number 行，非 custom）
      for (const name of ['上下文窗口', '最大输出 token']) {
        expect(buttonOf(findRow(container, name))).toBeFalsy();
      }
      // 锁定：上下文/最大输出 token 是标准 number 行（input[type=number]，统一渲染器）
      expect(textControlOf(findRow(container, '上下文窗口')).inputEl.type).toBe('number');
      expect(textControlOf(findRow(container, '最大输出 token')).inputEl.type).toBe('number');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('失败路径：拉取报错 → error toast，设置不动', async () => {
    state.aiProvider = 'openai';
    state.openaiApiKey = 'bad';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    try {
      const container = renderAIGroup();
      const modelRow = findRow(container, '模型名称');
      buttonOf(modelRow).trigger();
      await vi.waitFor(() => expect(visibleToasts().some((t) => t.includes('拒绝访问'))).toBe(true));
      expect(state.aiModelOverrides?.openai).toBeUndefined();
      expect(document.getElementById('bz-model-picker-popup')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

/**
 * ticket 265 样式源守卫：模型选择器弹窗的暗色 token 选择器曾断链——
 * `.theme-dark #bz-up-manager-popup, #bz-model-picker-popup {…}` 逗号后丢了
 * `.theme-dark` 前缀，该条无条件命中浅色块，深色下弹窗退回 Obsidian 原生
 * --background-primary/--text-muted → 黑底黑字。此处对样式源做静态断言，防回归。
 */
describe('模型选择器弹窗：双皮 token 选择器守卫（ticket 265）', () => {
  it('暗色 token 块内 #bz-model-picker-popup 必须带 .theme-dark 前缀，且每条选择器齐全', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/settings-panel/styles.css'),
      'utf8'
    );
    // 取暗色 token 块（S3 炭黑夜航）的选择器串
    const darkBlock = css.match(/\.theme-dark \.bz-sp-desk,[\s\S]*?\{/);
    expect(darkBlock, '暗色 token 块存在').toBeTruthy();
    const selector = darkBlock![0].replace(/\s*\{$/, '');
    // 每一条都要带 .theme-dark 前缀（含 #bz-model-picker-popup / #bz-up-manager-popup）
    const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      expect(p.startsWith('.theme-dark '), `「${p}」应带 .theme-dark 前缀`).toBe(true);
    }
    expect(parts.some((p) => p === '.theme-dark #bz-model-picker-popup')).toBe(true);
    expect(parts.some((p) => p === '.theme-dark #bz-up-manager-popup')).toBe(true);
  });

  it('弹窗内部行不残留 Obsidian 原生变量（hover/选中/名称/来源均挂 --sp-*）', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'src/settings-panel/styles.css'),
      'utf8'
    );
    // 皮收口段：弹窗选择器下不得出现 --background-modifier-* / --text-muted 等原生变量
    const start = css.indexOf('/* 模型选择器弹窗内部皮收口');
    expect(start, '皮收口段存在').toBeGreaterThan(-1);
    // 段尾 = 下一个顶层注释块起点
    const nextComment = css.indexOf('\n/*', start + 1);
    const seg = css.slice(start, nextComment === -1 ? undefined : nextComment);
    expect(seg).toContain('#bz-model-picker-popup .bz-model-picker-row:hover');
    expect(seg).toContain('#bz-model-picker-popup .bz-model-picker-row.is-current');
    expect(seg).toContain('#bz-model-picker-popup .bz-model-picker-detail');
    for (const native of ['--background-modifier-hover', '--background-modifier-active-hover', '--text-muted']) {
      expect(seg.includes(native), `皮收口段不应再消费 ${native}`).toBe(false);
    }
  });
});
