/**
 * 第二大脑域入口（ticket 103；原闪念 index 占位转正）
 * - ensureSecondBrain 幂等启动：load 库 → 已有索引才增量补齐 refresh（空库不自动全量嵌入，
 *   首次向量化由主面板引导按钮触发）/ 移动端 initMobile 三级降级；
 * - vault modify 经 domain-bus 'vault:md-modified' 通用通道 → 5s 防抖静默刷新（QA L2188-2203 同语义；
 *   ticket 107 起索引未就绪时不自动嵌入）；
 * - 三个命令入口：主面板（统一入口）/ 参考侧边栏 / AI 对话；ticket 107 起本地无向量数据时
 *   后两者统一转开主面板引导态；
 * - ticket 111：自动双链管线（link agent）——linkAgentEnabled 开关注册监听与队列消费；
 * - unload 全量清理：定时器、订阅、面板 DOM、DeepSeek 服务、link agent。
 */
import type { App } from 'obsidian';
import { onDomainEvent } from '../core/domain-bus';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { IS_MOBILE } from './config';
import { VectorStore } from './vector-store';
import { resetDeepseekAI } from './ai';
import { SecondBrainPanel } from './panel';
import { ReferencePanel } from './reference-panel';
import { ChatPanel } from './chat-panel';
import { MobilePanel } from './mobile-panel';
import { LinkAgent } from './link-agent/pipeline';
import { LinkAgentWatcher, startQueueConsumption } from './link-agent/watch';

let appRef: App | null = null;
let store: VectorStore | null = null;
let initialized = false;

let panel: SecondBrainPanel | null = null;
let reference: ReferencePanel | null = null;
let chat: ChatPanel | null = null;
let mobile: MobilePanel | null = null;

// 自动双链管线（ticket 111）：随 linkAgentEnabled 开关注册（ADR-0003）
let linkAgent: LinkAgent | null = null;
let linkWatcher: LinkAgentWatcher | null = null;

let unsubVault: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等初始化（懒加载 ADR-0003：secondBrainEnabled 开关在 main.onload 控制） */
export function ensureSecondBrain(app: App): void {
  if (initialized) return;
  initialized = true;
  appRef = app;
  const s = new VectorStore(app);
  store = s;
  // ticket 107：load 完成信号挂到 store 上，主面板打开时等待它——避免启动竞态下
  // 读到尚未装载的空库而误入引导态
  s.initialLoad = (async () => {
    try {
      await s.load();
      if (IS_MOBILE) {
        const msg = await s.initMobile();
        if (msg) console.log(`[secondbrain] ${msg}`);
      } else if (s.isIndexReady()) {
        // 已有索引 → 启动增量补齐；空库不自动全量嵌入（首次向量化须用户在主面板点击按钮）
        await s.refresh();
      } else {
        console.log('[secondbrain] 本地暂无向量数据，等待用户在主面板初始化');
      }
    } catch (e) {
      console.warn('[secondbrain] 初始化失败', e);
    }
  })();
  // 后台自动更新：vault modify 后 5s 防抖静默刷新（索引就绪才生效——首次向量化不抢跑）
  unsubVault = onDomainEvent('vault:md-modified', () => {
    if (!store?.isIndexReady()) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      // 后台静默刷新：失败仅告警，不产生 unhandled rejection
      store?.refresh().catch((e) => console.warn('[secondbrain] 后台刷新失败', e));
    }, 5000);
  });
  // ticket 111：自动双链——linkAgentEnabled=false 时无任何监听与写入
  try {
    if ((tryGetSettings() as any).linkAgentEnabled !== false) {
      linkAgent = new LinkAgent({ app, store: s });
      linkWatcher = new LinkAgentWatcher(app, linkAgent);
      linkWatcher.start();
      // 域初始化发现队列非空且 embedding 可达 → 自动消费，无需询问
      void startQueueConsumption(linkAgent, s.initialLoad);
    }
  } catch (e) {
    console.warn('[secondbrain] 自动双链初始化失败', e);
  }
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
  chat?.destroy(); // 弹窗形态：卸载需摘 escManager 层并移除 DOM（ticket 108）
  chat = null;
  mobile?.close();
  mobile = null;
  linkWatcher?.destroy();
  linkWatcher = null;
  linkAgent = null;
  store = null;
  appRef = null;
  initialized = false;
  resetDeepseekAI();
}

function ensureReference(): void {
  if (!appRef || !store) return;
  // 上个实例已被 ❌ 关闭（isClosed）：置空以便重建，否则窄窗关闭后命令将永久失灵
  if (reference && !reference.alive) reference = null;
  if (reference) return;
  if (IS_MOBILE) {
    mobile ??= new MobilePanel(appRef, store);
    return;
  }
  // ReferencePanel 自持窄窗（内部 new FloatWindow('灵感参考')）；🤖 入口已移除（ticket 108）
  reference = new ReferencePanel(appRef, store);
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
  // ChatPanel 为居中弹窗（core createOverlay，ticket 108 改；原右侧窄窗形态废弃）
  chat = new ChatPanel(store, appRef);
}

function openChatInternal(): void {
  ensureChat();
  chat?.show();
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

/** 设置页「重新索引」（ticket 108）：打开主面板并标记全量重建意图，面板自动进入重建进度视图 */
export function rebuildSecondBrainIndex(app: App): void {
  ensureSecondBrain(app);
  if (!store) return;
  panel ??= new SecondBrainPanel(app, store, {
    onOpenReference: () => openReferenceInternal(),
    onOpenChat: () => openChatInternal(),
  });
  panel.requestRebuild();
  void panel.open();
}

/** 命令 bz-secondbrain-open：参考侧边栏（移动端为底部抽屉参考 tab）；空库统一转开主面板引导 */
export function openSecondBrainReference(app: App): void {
  ensureSecondBrain(app);
  if (!store?.isIndexReady()) {
    openSecondBrainPanel(app);
    return;
  }
  openReferenceInternal();
}

/** 命令 bz-secondbrain-chat：AI 对话面板；空库统一转开主面板引导 */
export function openSecondBrainChat(app: App): void {
  ensureSecondBrain(app);
  if (!store?.isIndexReady()) {
    openSecondBrainPanel(app);
    return;
  }
  openChatInternal();
}

/**
 * 命令 bz-secondbrain-rebuild-links（ticket 111）：对当前打开笔记重跑一次关联
 * （正文大改后的手动兜底入口）。手动触发即显式意图：不受 linkAgentScopes 范围限制，
 * 任何笔记可跑（候选仍按 linkAgentScopes 过滤）；embedding 不可达时入队待自动消费。
 */
export async function rebuildSecondBrainLinks(app: App): Promise<void> {
  const file = app.workspace.getActiveFile?.() as { path: string } | null;
  if (!file) {
    notice('请先打开一个笔记');
    return;
  }
  if ((tryGetSettings() as any).linkAgentEnabled === false) {
    notice('自动双链已在第二大脑设置中关闭');
    return;
  }
  ensureSecondBrain(app);
  if (!linkAgent) return;
  try {
    const outcome = await linkAgent.processNote(file.path);
    if (outcome.status === 'done') {
      notice(outcome.created > 0 ? `已新建关联 ${outcome.created} 条` : '未发现实质关联，未新建', 'success');
    } else if (outcome.status === 'queued') {
      notice('embedding 服务不可达，已加入待处理队列，服务可达后自动处理', 'info');
    } else if (outcome.status === 'failed') {
      notice(`关联处理失败：${outcome.error}`, 'error');
    } else {
      notice('该笔记暂无法处理（文件缺失或位于加密目录）', 'info');
    }
  } catch (e) {
    console.warn('[secondbrain] 重跑关联失败', e);
    notice(`关联处理失败：${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}
