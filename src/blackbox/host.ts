/**
 * 黑匣子 × EPUB 阅读器跨插件契约（ADR-0016）：
 * - 注册侧：bz 向阅读器注册「书内选区录入」能力（captureConceptFromEpub / captureExcerptFromEpub），
 *   阅读器选区工具栏据此亮起按钮（未注册 → 置灰，阅读器侧能力探测负责）。
 * - 跳转侧：黑匣子列表来源点击 → 阅读器公开 API openEpubLocationFromLink 跳回书内原文。
 * bz 不 import 阅读器模块（跨插件边界），经 app.plugins.getPlugin 形状探测。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { openBlackBoxCaptureFromEpub } from './capture';
import { resolveSourceJump } from './source-jump';

/** 阅读器插件 id 候选（standalone 构建 / fork 构建） */
const READER_PLUGIN_IDS = ['weave-epub-reader', 'fork-weave-epub-reader'] as const;

/** 阅读器公开表面（鸭子类型；bz 侧只依赖这两个方法 + 注册通道） */
export interface ReaderPluginSurface {
  registerExternalEpubHost?: (host: object) => void;
  unregisterExternalEpubHost?: () => void;
  openEpubLocationFromLink?: (link: string) => Promise<boolean>;
}

/** 定位已启用的阅读器插件实例（找不到 → null，调用方静默降级） */
export function getReaderPlugin(app: App): ReaderPluginSurface | null {
  const plugins = (app as any).plugins;
  if (!plugins || typeof plugins.getPlugin !== 'function') return null;
  for (const id of READER_PLUGIN_IDS) {
    const p = plugins.getPlugin(id);
    if (p && typeof p === 'object') return p as ReaderPluginSurface;
  }
  return null;
}

let hostRegistered = false;
let readerRef: ReaderPluginSurface | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

/** 阅读器未就绪时重试上限（覆盖「reader 在 bz 之后加载/重载」的时序；避免无限轮询） */
const MAX_REGISTER_RETRIES = 10;
/** 重试间隔（毫秒） */
const REGISTER_RETRY_DELAY_MS = 2000;

/** 构建黑匣子能力宿主（ADR-0016：captureConceptFromEpub / captureExcerptFromEpub） */
function buildBlackBoxHost(app: App): object {
  return {
    captureConceptFromEpub: async (input: { selectedText: string; sourceLink: string }) => {
      await openBlackBoxCaptureFromEpub(app, 'concept', {
        selectedText: input.selectedText,
        sourceLink: input.sourceLink,
      });
    },
    captureExcerptFromEpub: async (input: { selectedText: string; sourceLink: string }) => {
      await openBlackBoxCaptureFromEpub(app, 'literature', {
        selectedText: input.selectedText,
        sourceLink: input.sourceLink,
      });
    },
  };
}

/** 阅读器未就绪时安排重试（幂等；与 layout-change 补注册双保险） */
function scheduleRegisterRetry(app: App): void {
  if (retryTimer || retryCount >= MAX_REGISTER_RETRIES) return;
  retryCount += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    registerBlackBoxEpubHost(app);
  }, REGISTER_RETRY_DELAY_MS);
}

/**
 * 注册黑匣子书内录入能力（幂等）。阅读器未加载/未安装 → 静默跳过并安排定时重试
 * （按钮置灰由阅读器侧能力探测负责；onLayoutReady 首试 + 定时重试 + layout-change 补注册）。
 */
export function registerBlackBoxEpubHost(app: App): void {
  if (hostRegistered) return;
  const reader = getReaderPlugin(app);
  if (!reader || typeof reader.registerExternalEpubHost !== 'function') {
    scheduleRegisterRetry(app);
    return;
  }
  readerRef = reader;
  reader.registerExternalEpubHost(buildBlackBoxHost(app));
  hostRegistered = true;
  retryCount = 0;
}

/**
 * 布局变化时刷新注册：阅读器后加载/重载（新实例）后补注册。幂等：
 * - 未注册过 → 走注册流程（含重试）；
 * - 已注册但阅读器实例变化（插件被重载）→ 向新实例重新注册。
 */
export function refreshBlackBoxEpubHost(app: App): void {
  if (!hostRegistered) {
    registerBlackBoxEpubHost(app);
    return;
  }
  const reader = getReaderPlugin(app);
  if (reader && reader !== readerRef && typeof reader.registerExternalEpubHost === 'function') {
    readerRef = reader;
    reader.registerExternalEpubHost(buildBlackBoxHost(app));
  }
}

/** 注销书内录入能力（bz onunload） */
export function unregisterBlackBoxEpubHost(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (hostRegistered && readerRef?.unregisterExternalEpubHost) {
    readerRef.unregisterExternalEpubHost();
  }
  hostRegistered = false;
  readerRef = null;
  retryCount = 0;
}

/** 黑匣子列表来源跳转执行（ADR-0016 三分派）：epub 双链 → 阅读器公开 API；[[笔记]] → 打开笔记；URL → 浏览器；其他不可点 */
export async function jumpFromSource(app: App, source: string): Promise<void> {
  const action = resolveSourceJump(source);
  if (action.kind === 'epub') {
    const reader = getReaderPlugin(app);
    if (!reader || typeof reader.openEpubLocationFromLink !== 'function') {
      notice('⚠️ 未安装 EPUB 阅读器插件');
      return;
    }
    const ok = await reader.openEpubLocationFromLink(action.link);
    if (!ok) notice('⚠️ 未能定位原文位置（书可能已被移动或删除）', 'warning');
  } else if (action.kind === 'note') {
    app.workspace.openLinkText(action.path, '', false, { active: true });
  } else if (action.kind === 'url') {
    window.open(action.url, '_blank');
  }
}
