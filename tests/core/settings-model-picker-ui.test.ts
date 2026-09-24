/**
 * 设置页「获取模型名」按钮 UI 测试（ticket 173）：模型名称行内嵌按钮渲染（bz-setting-action-row 豁免）、
 * 点击拉取（桩 fetch）成功弹选择器、选中回填 per-provider 覆盖 + 落盘 + success toast、
 * 失败路径 toast 报错且设置不动。jsdom 环境。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/settings';
import type BzSettings from '../../src/settings';
import { resetObsidianMocks, requestUrl } from '../mock-obsidian-entry';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { mainSettingsSchema } from '../../src/core/settings-main-schema';
import { closeModelPicker } from '../../src/core/settings-model-picker';
import { __resetNoticeForTests, cleanupNotices } from '../../src/core/notice';

const requestUrlMock = vi.mocked(requestUrl);

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

/** 渲染 AI 页（与主设置页同 schema；issue 331 拆组后模型行在「模型配置」组，渲前三组） */
function renderAIGroup(): HTMLElement {
  const schema = mainSettingsSchema();
  const container = document.createElement('div');
  renderSettingsInto(container, { groups: schema.groups.slice(0, 3) });
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
  requestUrlMock.mockReset();
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
    state.aiProvider = 'zhipu-plan';
    const container = renderAIGroup();
    const modelRow = findRow(container, '模型名称');
    const btn = buttonOf(modelRow);
    expect(btn).toBeTruthy();
    expect(btn.text).toBe('获取模型名');
    // 行内嵌按钮不挂 bz-setting-action-row（该豁免仅独立 ButtonRow）——模型行计为设置项
    expect(modelRow.classList.contains('bz-setting-action-row')).toBe(false);
    expect(textControlOf(modelRow).value).toBe('glm-5.3-flash');
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

  it('Ollama 服务商：选中回填 aiModelOverrides.ollama；最大输出行无按钮', async () => {
    state.aiProvider = 'ollama';
    state.aiModelOverrides = { ollama: 'qwen3:8b' }; // 有当前值 → 置顶高亮（选中即当前值本身）
    // Ollama 走原生 /api/tags 格式（models[].name），不是 OpenAI 兼容的 data[].id
    vi.stubGlobal('fetch', vi.fn(async () => okModels({ models: [{ name: 'qwen3:8b' }, { name: 'llama3.1' }] })));
    try {
      const container = renderAIGroup();
      const modelRow = findRow(container, '模型名称');
      buttonOf(modelRow).trigger();
      await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
      const popup = document.getElementById('bz-model-picker-popup')!;
      (popup.querySelector('.bz-model-picker-row') as HTMLElement).click();
      await vi.waitFor(() => expect(state.aiModelOverrides?.ollama).toBe('qwen3:8b'));
      expect(textControlOf(findRow(container, '模型名称')).value).toBe('qwen3:8b');
      // 最大输出行不渲染按钮（按钮仅模型行内嵌；该行已是标准 number 行，非 custom）
      expect(buttonOf(findRow(container, '最大输出 token'))).toBeFalsy();
      // 锁定：最大输出 token 是标准 number 行（input[type=number]，统一渲染器）
      expect(textControlOf(findRow(container, '最大输出 token')).inputEl.type).toBe('number');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('失败路径：拉取报错 → error toast，设置不动', async () => {
    state.aiProvider = 'zhipu-plan';
    state.zhipuPlanApiKey = 'bad';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })));
    try {
      const container = renderAIGroup();
      const modelRow = findRow(container, '模型名称');
      buttonOf(modelRow).trigger();
      await vi.waitFor(() => expect(visibleToasts().some((t) => t.includes('拒绝访问'))).toBe(true));
      expect(state.aiModelOverrides?.['zhipu-plan']).toBeUndefined();
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

/**
 * 回填时机回归（2026-09-24 用户报「获取模型要选中两次，输入框内容才变化」）：
 * 渲染器只在「动作 Promise 完成」后重读绑定回填显示值，而 openModelPicker 是打开即返回的
 * 弹窗——旧实现动作先 resolve，回填的是旧值，用户选中后输入框不刷新。现改为等选择器关闭
 * （onClose 统一收口）再 resolve。断言用「选中值 ≠ 当前值」才有效（旧测试选的恰是当前值，
 * 显示值断言恒真、抓不到本例）。
 */
describe('模型选择器回填时机：选中即刷新（一次点击）', () => {
  it('Embedding 模型：选与当前值不同的模型 → 输入框当场回填', async () => {
    state.secondBrainEmbeddingModel = ''; // 当前空 → 选中后必变
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        okModels({
          models: [
            {
              name: 'qwen3-embedding:8b',
              capabilities: ['embedding'],
              details: { parameter_size: '8B', embedding_length: 4096 },
            },
          ],
        })
      )
    );
    const container = renderAIGroup();
    const row = findRow(container, 'Embedding 模型');
    buttonOf(row).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await vi.waitFor(() => expect(state.secondBrainEmbeddingModel).toBe('qwen3-embedding:8b'));
    // 关键断言：不必再点一次按钮，显示值已刷新（旧实现此值恒为旧值，waitFor 会超时）
    await vi.waitFor(() =>
      expect(textControlOf(findRow(container, 'Embedding 模型')).value).toBe('qwen3-embedding:8b')
    );
  });

  // 注：本行有 refreshKey，onPick 内 refreshVisibility() 本就能回填——此例在旧实现下也绿，
  // 只作「一次点击即刷新」的语义锁；真正抓 bug 的锚是上一条 Embedding 行（无 refreshKey）。
  it('LLM 模型名称：选与当前值不同的模型 → 输入框当场回填', async () => {
    state.aiProvider = 'deepseek';
    state.deepseekApiKey = 'sk-test';
    state.aiModelOverrides = {}; // 无覆盖 → 显示注册表默认（deepseek 为「不强制模型」的空串）
    vi.stubGlobal('fetch', vi.fn(async () => okModels({ data: [{ id: 'deepseek-chat' }] })));
    const container = renderAIGroup();
    const row = findRow(container, '模型名称');
    expect(textControlOf(row).value).not.toBe('deepseek-chat'); // 前提：选中项 ≠ 当前显示值
    buttonOf(row).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await vi.waitFor(() => expect(state.aiModelOverrides?.deepseek).toBe('deepseek-chat'));
    await vi.waitFor(() =>
      expect(textControlOf(findRow(container, '模型名称')).value).toBe('deepseek-chat')
    );
  });

  it('取消选择（点遮罩关闭）不改变值，动作 Promise 正常收口——取消后再选仍一次点击生效', async () => {
    state.secondBrainEmbeddingModel = 'bge-m3';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okModels({ models: [{ name: 'bge-m3', capabilities: ['embedding'] }] }))
    );
    const container = renderAIGroup();
    buttonOf(findRow(container, 'Embedding 模型')).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    (document.getElementById('bz-model-picker-mask') as HTMLElement).click();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeNull());
    expect(state.secondBrainEmbeddingModel).toBe('bge-m3');
    expect(textControlOf(findRow(container, 'Embedding 模型')).value).toBe('bge-m3');
    // 取消路径若不触发 onClose，动作 Promise 悬空 → 再点按钮时渲染器仍在等上一次动作，
    // 回填链断掉（本断言即该风险的观察点）。换一个不同的模型证明链还在。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okModels({ models: [{ name: 'qwen3-embedding:8b', capabilities: ['embedding'] }] }))
    );
    buttonOf(findRow(container, 'Embedding 模型')).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await vi.waitFor(() =>
      expect(textControlOf(findRow(container, 'Embedding 模型')).value).toBe('qwen3-embedding:8b')
    );
  });
});

/**
 * Jev 模型行「获取模型」（issue 424/ADR-0184）：拉 Typesafe `/v1/models`（自家格式
 * `{models:[{name,…}]}`，走 requestUrl——该域预检无 ACAO，浏览器 fetch 必被拒）→ 选择器 →
 * 选中写 jevModel。同 Embedding 行：等选择器关闭再 resolve 动作 Promise，一次点击即回填。
 */
describe('Jev 模型行：获取模型（issue 424/ADR-0184）', () => {
  it('拉取 Typesafe 模型列表 → 选择器 → 选中即回填（一次点击）', async () => {
    state.jevApiKey = 'sk-jev';
    state.jevModel = ''; // 当前空 → 选中后必变（否则「回填显示值」断言恒真，抓不到回填断链）
    requestUrlMock.mockResolvedValue({
      status: 200,
      text: JSON.stringify({
        models: [
          { name: 'jev-latest', description: '最新版', release_date: '2026-09-01' },
          { name: 'jev-preview', description: '预览版' },
        ],
      }),
    } as any);
    const container = renderAIGroup();
    const row = findRow(container, 'Jev 模型');
    buttonOf(row).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    // 请求打到服务商模型列表端点（不是判定端点），带 Bearer 密钥
    const call = requestUrlMock.mock.calls[0][0] as any;
    expect(call.url).toBe('https://api.typesafe.ai/v1/models');
    expect(call.method).toBe('GET');
    expect(call.headers.Authorization).toBe('Bearer sk-jev');
    (document.querySelector('.bz-model-picker-row') as HTMLElement).click();
    await vi.waitFor(() => expect(state.jevModel).toBe('jev-latest'));
    await vi.waitFor(() =>
      expect(textControlOf(findRow(container, 'Jev 模型')).value).toBe('jev-latest')
    );
  });

  it('缺密钥 → 行内报错，不发请求（服务商模型列表也要鉴权）', async () => {
    state.jevApiKey = '';
    const container = renderAIGroup();
    buttonOf(findRow(container, 'Jev 模型')).trigger();
    await vi.waitFor(() => expect(visibleToasts().some((t) => t.includes('Typesafe 密钥'))).toBe(true));
    expect(requestUrlMock).not.toHaveBeenCalled();
    expect(document.getElementById('bz-model-picker-popup')).toBeNull();
  });
});

/**
 * 重排模型行「获取模型」（issue 429）：与 Embedding 模型行同款弹窗流程——拉 /api/tags →
 * pickRerankModels 优先取名字含 rerank 的 → 选中写 secondBrainRerankModel + 落盘 + success toast，
 * 且等选择器关闭再 resolve（一次点击即回填）。行可见性挂在 8B 嵌入 + 重排开关上。
 */
describe('重排模型行：获取模型（issue 429）', () => {
  it('拉取 Ollama 模型列表 → 只列重排候选 → 选中即回填（一次点击）', async () => {
    state.secondBrainEmbeddingModel = 'qwen3-embedding:8b'; // 行可见前提
    state.secondBrainRerankModel = ''; // 当前空 → 选中后必变
    const fetchMock = vi.fn(async (u: string) => {
      expect(u).toBe('http://localhost:11434/api/tags');
      return okModels({
        models: [
          { name: 'llama3.1:latest', capabilities: ['completion'] },
          { name: 'dengcao/Qwen3-Reranker-4B:Q4_K_M', capabilities: ['completion'], details: { parameter_size: '4B' } },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = renderAIGroup();
    const row = findRow(container, '重排模型');
    buttonOf(row).trigger();
    await vi.waitFor(() => expect(document.getElementById('bz-model-picker-popup')).toBeTruthy());
    const popupRows = [...document.querySelectorAll('.bz-model-picker-row')];
    expect(popupRows).toHaveLength(1); // 聊天模型不进重排候选
    (popupRows[0] as HTMLElement).click();
    await vi.waitFor(() => expect(state.secondBrainRerankModel).toBe('dengcao/Qwen3-Reranker-4B:Q4_K_M'));
    await vi.waitFor(() =>
      expect(textControlOf(findRow(container, '重排模型')).value).toBe('dengcao/Qwen3-Reranker-4B:Q4_K_M')
    );
    expect(saver).toHaveBeenCalled();
    await vi.waitFor(() => expect(visibleToasts().some((t) => t.includes('重排模型已设为'))).toBe(true));
  });

  it('拉取失败（Ollama 无响应）→ 行内报错 toast，设置不动', async () => {
    state.secondBrainEmbeddingModel = 'qwen3-embedding:8b';
    state.secondBrainRerankModel = '原模型';
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    requestUrlMock.mockRejectedValue(new Error('Ollama 无响应'));
    const container = renderAIGroup();
    buttonOf(findRow(container, '重排模型')).trigger();
    await vi.waitFor(() => expect(visibleToasts().length).toBeGreaterThan(0));
    expect(state.secondBrainRerankModel).toBe('原模型');
    expect(document.getElementById('bz-model-picker-popup')).toBeNull();
  });

  it('嵌入模型非 8B → 重排行与重排模型行都收起（bz-setting-hidden）', () => {
    state.secondBrainEmbeddingModel = 'bge-m3';
    const container = renderAIGroup();
    expect(findRow(container, 'Embedding 模型').classList.contains('bz-setting-hidden')).toBe(false);
    expect(findRow(container, '启用重排').classList.contains('bz-setting-hidden')).toBe(true);
    expect(findRow(container, '重排模型').classList.contains('bz-setting-hidden')).toBe(true);
  });
});
