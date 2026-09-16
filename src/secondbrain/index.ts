/**
 * 第二大脑域入口（ticket 103；原闪念 index 占位转正）
 * - ensureSecondBrain 幂等启动：load 库 → 已有索引才增量补齐 refresh（空库不自动全量嵌入，
 *   首次向量化由主面板引导按钮触发）/ 移动端 initMobile 三级降级；
 * - vault modify 经 domain-bus 'vault:md-modified' 通用通道 → 5s 防抖静默刷新（QA L2188-2203 同语义；
 *   ticket 107 起索引未就绪时不自动嵌入）；
 * - 三个命令入口：主面板（统一入口）/ 参考侧边栏 / AI 对话；ticket 107 起本地无向量数据时
 *   后两者统一转开主面板引导态；
 * - ticket 111：自动关联管线（link agent）——linkAgentEnabled 开关注册监听与队列消费；
 * - ticket 115：启动存量补链（队列消费后串行）；手动命令（bz-knowledge-link-all / bz-knowledge-relink）
 *   随功能归属迁知识盒（ADR-0141 §1）；
 * - ticket 119（v1.4）：正文大改自动重跑——修改监听按基准哈希过滤，内容实质变化才重跑建链；
 * - issue 309：文献笔记建链改走显式通道——getLinkBridge() 给知识盒录入面板三段能力：
 *   preview（AI 出内容即起跑预演，草稿未落盘也能算）/ apply（落盘后写预演结果）/ now（兜底单篇管线）/ backfill（批量补链），
 *   面板内 loading → 完成后就地显示关联；原「生成即跑」的 'knowledge:tasks' 订阅已删除；
 * - issue 360：每周知识动态——启动后延迟调度静默聚合（weekly-ui.scheduleWeeklyDigest，
 *   周界判定 lastRunAt 滚动 7 天，无新内容零打扰，有内容通知挂「查看详情」）；
 *   命令 bz-secondbrain-weekly（本周知识动态）随时手动重聚并开详情弹层；
 * - unload 全量清理：定时器、订阅、面板 DOM、link agent、每周动态弹层与调度
 *   （AI 通道无持久资源，issue 359 起单例已退役）。
 */
import type { App } from 'obsidian';
import { onDomainEvent } from '../core/domain-bus';
import { setLinkBridge } from '../core/link-now';
import { tryGetSettings } from '../core/settings-provider';
import { IS_MOBILE } from './config';
import { VectorStore } from './vector-store';
import { setVectorSearchSource } from './readonly';
import { SecondBrainPanel, confirmFullRebuild } from './panel';
import { ReferencePanel } from './reference-panel';
import { ChatPanel } from './chat-panel';
import { MobilePanel } from './mobile-panel';
import { LinkAgent } from './link-agent/pipeline';
import { LinkAgentWatcher, createLinkBridge, startQueueConsumption, startStartupBackfill } from './link-agent/watch';
import { scheduleWeeklyDigest, unloadWeeklyDigest, runWeeklyManual } from './weekly-ui';

let appRef: App | null = null;
let store: VectorStore | null = null;
let initialized = false;

let panel: SecondBrainPanel | null = null;
let reference: ReferencePanel | null = null;
let chat: ChatPanel | null = null;
let mobile: MobilePanel | null = null;

// 自动关联管线（ticket 111）：随 linkAgentEnabled 开关注册（ADR-0003）
let linkAgent: LinkAgent | null = null;
let linkWatcher: LinkAgentWatcher | null = null;

let unsubVault: (() => void) | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** 幂等初始化（2026-09-12 起：启动即自动加载 —— 原 secondBrainEnabled 懒加载开关退役，
 *  main.onLoad 布局就绪时无条件调用；命令面板/首页入口仍可再次调用，幂等保证只初始化一次） */
export function ensureSecondBrain(app: App): void {
  if (initialized) return;
  initialized = true;
  appRef = app;
  const s = new VectorStore(app);
  store = s;
  // issue 318：注册只读检索桥（窄口叶子模块；消费方值导入本 index 会把整条 UI 栈拖进构建闭包，见 readonly.ts）
  setVectorSearchSource({
    isIndexReady: () => !!store?.isIndexReady(),
    search: (query: string, topK?: number) => (store ? store.search(query, topK) : Promise.resolve([])),
  });
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
  // ticket 111：自动关联——linkAgentEnabled=false 时无任何监听与写入
  try {
    if ((tryGetSettings() as any).linkAgentEnabled !== false) {
      linkAgent = new LinkAgent({ app, store: s });
      // initialLoad 传入监听器：显式建链通道先等索引装载完成（issue 309）
      linkWatcher = new LinkAgentWatcher(app, linkAgent, s.initialLoad);
      linkWatcher.start();
      // issue 309：知识盒录入面板的自动关联通道（预演 / 落盘后写入 / 兜底单篇建链）
      setLinkBridge(createLinkBridge(linkAgent, s.initialLoad));
      // 域初始化发现队列非空且 embedding 可达 → 自动消费，无需询问；
      // 队列消费之后串行执行存量补链（ticket 115：关联范围内缺 related 的存量笔记批量建链，
      // 补链目标排除队列内待重试条目避免重复算力；启动路径全程静默——批次进度/完成 toast 均不弹，
      // 手动命令 bz-secondbrain-link-all 才按批次通知，ticket 6/n2-sb）
      void (async () => {
        try {
          await startQueueConsumption(linkAgent, s.initialLoad, { silent: true });
        } catch (e) {
          console.warn('[secondbrain] 队列消费失败', e);
        }
        try {
          await startStartupBackfill(linkAgent, s.initialLoad, { silent: true });
        } catch (e) {
          console.warn('[secondbrain] 启动补链失败', e);
        }
      })();
    }
  } catch (e) {
    console.warn('[secondbrain] 自动关联初始化失败', e);
  }
  // issue 360：每周知识动态——启动后延迟调度（错开队列消费与存量补链），到周界且有实质内容才通知
  scheduleWeeklyDigest(app, s, s.initialLoad);
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
  setLinkBridge(null);
  unloadWeeklyDigest(); // issue 360：每周动态调度定时器 + 详情弹层 DOM/ESC 句柄一并清理
  store = null;
  setVectorSearchSource(null); // issue 318：卸载即撤销只读检索桥（未初始化/已卸载取到 null）
  appRef = null;
  initialized = false;
}

/** 只读检索面（issue 318）：类型出口留在 index（对外 API 不破）；实现与取用走叶子模块 readonly.ts */
export type { ReadonlyVectorSearch } from './readonly';

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

/** 对话入口：桌面居中弹窗；移动端统一走底部抽屉 AI tab（ticket 31：与参考入口同一抽屉、两入口行为一致） */
function openChatInternal(): void {
  if (IS_MOBILE) {
    // 移动端复用 MobilePanel（📚参考/🤖AI 双 tab 抽屉）：切到 AI tab 并展开
    ensureReference();
    mobile?.switchTab('chat');
    mobile?.show();
    return;
  }
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

/**
 * 「重新索引」确认通过后的实际动作：打开主面板并标记全量重建意图，面板自动进入重建进度视图。
 * 从设置页跳转用（那边确认已做过，不能再弹一次）；首页入口菜单走带确认的 rebuildSecondBrainIndex。
 */
export function requestRebuildAndOpen(app: App): void {
  ensureSecondBrain(app);
  if (!store) return;
  panel ??= new SecondBrainPanel(app, store, {
    onOpenReference: () => openReferenceInternal(),
    onOpenChat: () => openChatInternal(),
  });
  panel.requestRebuild();
  void panel.open();
}

/**
 * 命令 bz-secondbrain-rebuild-index（首页入口菜单「重建索引」）：
 * **先弹确认框**（confirmFullRebuild 单源，同面板「全量重建」/设置页「重新索引」那份 ——
 * 2026-09-11 用户要求：清空重嵌是破坏性动作，右键直达也必须过确认），
 * 确认后打开主面板进重建进度视图。返回 Promise（首页 keepHome 据此在确认/取消后刷新）。
 */
export async function rebuildSecondBrainIndex(app: App): Promise<void> {
  if (!(await confirmFullRebuild())) return;
  requestRebuildAndOpen(app);
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
 * 命令 bz-secondbrain-weekly（issue 360 本周知识动态）：随时手动触发——打开详情弹层并
 * 强制重聚一轮（不等周界；force 下首轮无基线也只立基线，弹层如实呈空态）。
 * 索引未就绪（空库引导态）转开主面板：无索引数据时无动态可聚合。
 */
export function openSecondBrainWeekly(app: App): void {
  ensureSecondBrain(app);
  if (!store?.isIndexReady()) {
    openSecondBrainPanel(app);
    return;
  }
  void runWeeklyManual(app, store);
}

/** 命令 bz-secondbrain-open：参考侧边栏（移动端为底部抽屉参考 tab）；空库统一转开主面板引导 */
