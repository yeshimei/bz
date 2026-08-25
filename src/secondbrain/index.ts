/**
 * 第二大脑域入口（ticket 103；原闪念 index 占位转正）
 * - ensureSecondBrain 幂等启动：load 库 → 桌面全量增量 refresh / 移动端 initMobile 三级降级；
 * - vault modify 经 domain-bus 'vault:md-modified' 通用通道 → 5s 防抖静默刷新（QA L2188-2203 同语义）；
 * - 三个命令入口：主面板（统一入口）/ 参考侧边栏 / AI 对话；
 * - unload 全量清理：定时器、订阅、面板 DOM、DeepSeek 服务。
 */
import type { App } from 'obsidian';
import { onDomainEvent } from '../core/domain-bus';
import { IS_MOBILE } from './config';
import { VectorStore } from './vector-store';
import { resetDeepseekAI } from './ai';
import { SecondBrainPanel } from './panel';
import { ReferencePanel } from './reference-panel';
import { ChatPanel } from './chat-panel';
import { MobilePanel } from './mobile-panel';

let appRef: App | null = null;
let store: VectorStore | null = null;
let initialized = false;

let panel: SecondBrainPanel | null = null;
let reference: ReferencePanel | null = null;
let chat: ChatPanel | null = null;
let mobile: MobilePanel | null = null;

let unsubVault: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等初始化（懒加载 ADR-0003：secondBrainEnabled 开关在 main.onload 控制） */
export function ensureSecondBrain(app: App): void {
  if (initialized) return;
  initialized = true;
  appRef = app;
  const s = new VectorStore(app);
  store = s;
  void (async () => {
    try {
      await s.load();
      if (IS_MOBILE) {
        const msg = await s.initMobile();
        if (msg) console.log(`[secondbrain] ${msg}`);
      } else {
        await s.refresh();
      }
    } catch (e) {
      console.warn('[secondbrain] 初始化失败', e);
    }
  })();
  // 后台自动更新：vault modify 后 5s 防抖静默刷新
  unsubVault = onDomainEvent('vault:md-modified', () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void store?.refresh();
    }, 5000);
  });
}

/** 卸载清理（main.onunload 调用） */
export function unloadSecondBrain(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  unsubVault?.();
  unsubVault = null;
  panel?.destroy();
  panel = null;
  reference?.close();
  reference = null;
  chat?.close();
  chat = null;
  mobile?.close();
  mobile = null;
  store = null;
  appRef = null;
  initialized = false;
  resetDeepseekAI();
}

function ensureReference(): void {
  if (!appRef || !store || reference) return;
  if (IS_MOBILE) {
    mobile ??= new MobilePanel(appRef, store);
    return;
  }
  // ReferencePanel 自持窄窗（内部 new FloatWindow('灵感参考')），🤖 回调开对话
  reference = new ReferencePanel(appRef, store, () => openChatInternal());
}

function openReferenceInternal(): void {
  ensureReference();
  if (IS_MOBILE) {
    mobile?.show();
  } else {
    reference?.fw.show();
  }
}

function ensureChat(): void {
  if (!appRef || !store || chat) return;
  // ChatPanel 自持窄窗（内部 new FloatWindow('AI 助手')）
  chat = new ChatPanel(store, appRef);
}

function openChatInternal(): void {
  ensureChat();
  chat?.fw.show();
}

/** 主面板：第二大脑统一入口 */
export function openSecondBrainPanel(app: App): void {
  ensureSecondBrain(app);
  if (!store) return;
  panel ??= new SecondBrainPanel(app, store, {
    onOpenReference: () => openReferenceInternal(),
    onOpenChat: () => openChatInternal(),
  });
  void panel.open();
}

/** 命令 bz-secondbrain-open：参考侧边栏（移动端为底部抽屉参考 tab） */
export function openSecondBrainReference(app: App): void {
  ensureSecondBrain(app);
  openReferenceInternal();
}

/** 命令 bz-secondbrain-chat：AI 对话面板 */
export function openSecondBrainChat(app: App): void {
  ensureSecondBrain(app);
  openChatInternal();
}
