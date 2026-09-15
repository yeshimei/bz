/**
 * literature 域（文献盒）入口：ADR-0072 自 bili-downloader 迁出。
 * 主面板 = 文献目录下的文献笔记列表（部壹三入口：术语 / 段落 / 影像，见 ui.ts）；
 * 视频转文献批处理的 AI/笔记落盘在插件侧（ADR-0071），CLI 只产转录临时文件 + 交付视频。
 * 数据 CONFIG/STORAGE/literature.json（视频任务）；术语与段落生成不留任务记录（ticket 136 §2）。
 *
 * ADR-0141 §1：自动关联的两条命令（bz-knowledge-relink / bz-knowledge-link-all）随功能归属迁入本域——
 * 引擎与向量索引仍留第二大脑，本域只经 core/link-now 的 LinkBridge 消费（ADR-0002 域隔离）。
 * 关联范围恒为三个盒子（ADR-0141 §2），盒外笔记由实现侧拒绝（out-of-scope），此处只按结果提示。
 */
import type { App } from 'obsidian';
import { MarkdownView } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { getLinkBridge } from '../core/link-now';
import { notice } from '../core/notice';
import { KnowledgeData } from './data';
import { UIManager, type EntryPrefill } from './ui';
import { type TermSource } from './source';
import { upgradeNoteSourceInFile } from './note-gen';

let initialized = false;
let uiManager: UIManager | null = null;

/**
 * 录入预填契约（issue 329，供剪藏本划选工具框等跨域程序化入口消费）：全可选，缺省零影响。
 * - source：来源预填——url 态走外链 chip 管线（无 title 时异步抓页面标题落 sourceTitle），
 *   note 态走内部笔记 chip；显式传入优先，未传时维持各入口既有语义（命令入口带当前笔记）。
 * - text：段落态正文预填（优先于编辑器选区读取）；名词态走 term 参数、图版态无正文。
 * - images：图版态 data URL 数组预填进内存图列表（等价粘贴路径，同构校验与 ≤9 张上限）。
 * - onCreated：确认写入成功落盘后回调 notePath；**有回调即不自动打开笔记**（ADR-0144 工具框
 *   流程不打断阅读）；取消 / 写入失败不回调。
 */
export interface KnowledgeEntryPrefill extends EntryPrefill {
  source?: { kind: 'url'; url: string; title?: string } | { kind: 'note'; path: string };
}

/** 契约 source 两态 → 录入面板的 TermSource（url 归一 external；title 透传，已有则面板不重复抓标题） */
function prefillSource(src: NonNullable<KnowledgeEntryPrefill['source']>) {
  if (src.kind === 'url') return { kind: 'external' as const, url: src.url, title: src.title ?? null };
  return { kind: 'note' as const, path: src.path };
}

/**
 * 懒加载初始化（ADR-0003 幂等）：数据层 + 面板。
 * ticket 138 §1.2：initialized 在构造成功后置位；构造函数若在真实环境抛错（jsdom 掩盖），
 * 保持未初始化 → 下次命令自动重试，杜绝「构造失败后 uiManager 恒 null、面板永不再开」。
 */
export function ensureKnowledge(app: App): void {
  if (initialized) return;
  try {
    KnowledgeData.init({ storagePath: tryGetSettings()?.storagePath });
    uiManager = new UIManager(app);
    initialized = true;
  } catch (e) {
    console.error('bz: 文献盒初始化失败（下次打开命令将自动重试）', e);
    uiManager = null;
  }
}

/** 打开文献盒主面板（bz-knowledge-open 命令回调） */
export function openKnowledgePanel(app: App): void {
  ensureKnowledge(app);
  uiManager?.showMain();
}

/**
 * 打开「影像」录入界面并预填（聚合讯「保存至文献」入口，ADR-0068；命令 bz-knowledge-note-video）。
 * 注意：该入口直达**录入界面**（issue 310 起与主窗「影像」按钮同路径；处理队列 / 历史由录入界面头行两个钮进入），
 * 而非文献列表主面板；prefill 含链接/标题/UP主 时预填并自动解析。层级/ESC 由弹层自理，调用方不碰。
 */
export function openKnowledgeAddTask(app: App, prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
  ensureKnowledge(app);
  uiManager?.showVideoEntry(prefill);
}

/**
 * 名词生成入口（bz-knowledge-note-term 命令回调）：打开「名词」录入面板（ticket 136 §6）。
 * 显式 term 预填输入框；为空时读取当前激活 Markdown 编辑器选区预填（选中词），
 * 无选区则空输入框手动填。
 * 来源预填（ADR-0116）：命令入口带当前笔记上下文（选中词场景十有八九出自正在读的这篇）——
 * 以该笔记为可选「来源」（内部笔记方向），可一键清除；主窗「名词」按钮入口不带上下文、不预填。
 * opts（issue 329 预填扩展）：显式 opts.source 优先于「当前笔记」候选；既有调用（无 opts）零变化。
 */
export function openTermNote(app: App, term?: string, opts?: KnowledgeEntryPrefill): void {
  ensureKnowledge(app);
  let t = term?.trim();
  let src: TermSource | undefined;
  if (opts?.source) src = prefillSource(opts.source);
  // ticket 138 §1.1：getActiveViewOfType 内部做 view instanceof type，右值必须是类（MarkdownView），
  // 传字符串会在真实 Obsidian 抛 TypeError（测试 mock 掩盖）；选区空则 undefined → 空输入框手填。
  // 显式 term（程序化入口）不读视图；命令入口（无参）才取「当前笔记」作来源预填候选（ADR-0116）。
  if (!t) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    t = view?.editor?.getSelection()?.trim() || undefined;
    if (!src) {
      const file = view?.file;
      if (file && (file as any).extension === 'md') src = { kind: 'note', path: file.path };
    }
  }
  uiManager?.showTermEntry(t, src, opts);
}

/**
 * 段落生成入口（bz-knowledge-note-passage 命令回调，issue 326）：与名词命令同构（ticket 138 / ADR-0116）——
 * 读当前激活 Markdown 编辑器选区预填段落输入框，当前笔记（md）作来源候选，可一键清除。
 * 差异点：段落**不自动生成**——名词一个词预填即生成，段落是大段文字，进面板确认内容后手动点
 * 「生成」（Ctrl/Cmd+回车同效）；无选区 / 无视图 → 空输入框手填。
 * opts（issue 329）：text 优先于编辑器选区读取（剪藏本划选正文预填）；显式 opts.source 优先。
 */
export function openPassageNote(app: App, opts?: KnowledgeEntryPrefill): void {
  ensureKnowledge(app);
  let text: string | undefined;
  let src: TermSource | undefined;
  const explicit = String(opts?.text ?? '').trim();
  if (explicit) text = explicit;
  if (opts?.source) src = prefillSource(opts.source);
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  if (!text) text = view?.editor?.getSelection()?.trim() || undefined;
  if (!src) {
    const file = view?.file;
    if (file && (file as any).extension === 'md') src = { kind: 'note', path: file.path };
  }
  uiManager?.showPassageEntry(text, src, opts);
}

/**
 * 图版生成入口（bz-knowledge-note-image 命令回调，issue 326）：图无预填可言，命令入口带当前
 * 笔记作来源候选（ADR-0116 同款——命令带上下文，主窗按钮入口不带）；无视图则不带来源。
 * opts（issue 329）：images = data URL 数组预填进内存图列表（同构校验/上限）；显式 opts.source 优先。
 */
export function openImageNote(app: App, opts?: KnowledgeEntryPrefill): void {
  ensureKnowledge(app);
  let src: TermSource | undefined;
  if (opts?.source) src = prefillSource(opts.source);
  if (!src) {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (file && (file as any).extension === 'md') src = { kind: 'note', path: file.path };
  }
  uiManager?.showImageEntry(src, opts);
}

/**
 * 文献预览直达（issue 329 跨域 API，ADR-0144 划词锚定双链点击）：按 path 打开知识盒
 * 「文献预览」弹层（openPreview 同一渲染入口与样式，ADR-0122 渲染契约），主面板不需要可见。
 * 文件缺失 / 不在文献目录 → notice 提示并回退 app.workspace.openLinkText
 * （Obsidian 原生环境维持原生跳转，不在本 API 拦截范围）。
 */
export async function openKnowledgePreview(app: App, notePath: string): Promise<void> {
  ensureKnowledge(app);
  const path = String(notePath || '').trim();
  if (uiManager && await uiManager.openPreviewByPath(path).catch(() => false)) return;
  if (!path) { notice('未提供笔记路径，无法打开文献预览', 'warning'); return; }
  notice('不在知识盒文献目录，改用 Obsidian 打开：' + path, 'info');
  try {
    await app.workspace.openLinkText(path, '', false);
  } catch (e) {
    console.warn('[knowledge] openLinkText 回退失败', e);
  }
}

/**
 * source 升级（issue 329 跨域 API，ADR-0144 §5「保存物化回写」）：把目标笔记 frontmatter 的
 * 外链 URL 形态 source（未保存剪藏发起录入时的落库形态，即 pendingSource 场景）改写为
 * internalLink 内部双链（`[[剪藏路径|标题]]`，序列化范式同 serializeTermSource）。
 * 手术边界：只动 source 一行——sourceTitle 与其余 frontmatter 键、正文零扰动；
 * 已是内部形态幂等不动（true，零写盘）；文件缺失 / 读失败 / 无可升级的 source 返回 false 静默。
 * 文件 IO 在 note-gen（upgradeNoteSourceInFile，用户文档写口径），此处只做跨域门面。
 */
export async function upgradeNoteSourceInternal(app: App, notePath: string, internalLink: string): Promise<boolean> {
  ensureKnowledge(app);
  return upgradeNoteSourceInFile(app, notePath, internalLink);
}

/**
 * 取自动关联通道（三处命令共用）：总开关关掉 / 通道未接线 → 提示并返回 null。
 * 未接线的原因通常是第二大脑域尚未初始化——命令回调由 main.ts 先 ensureSecondBrain（幂等）再进来。
 */
function takeLinkBridge(): ReturnType<typeof getLinkBridge> {
  if ((tryGetSettings() as any).linkAgentEnabled === false) {
    notice('自动关联已在知识盒设置中关闭', 'info');
    return null;
  }
  const bridge = getLinkBridge();
  if (!bridge) {
    notice('自动关联暂不可用：第二大脑尚未就绪', 'warning');
    return null;
  }
  return bridge;
}

/**
 * 命令 bz-knowledge-relink（ADR-0141 §1，原 bz-secondbrain-rebuild-links）：对当前打开的笔记
 * 重跑一次关联（正文大改后的手动兜底入口）。
 * 范围口径已反转（ADR-0141 §2）：**手动不再豁免**——盒外笔记直接拒绝并提示；
 * v1.7/ticket 167 的「手动重跑始终强制」保留（force 跳过「已有 related 不建链」尊重门）。
 */
export async function relinkActiveNote(app: App): Promise<void> {
  const file = app.workspace.getActiveFile?.() as { path: string } | null;
  if (!file) {
    notice('请先打开一个笔记', 'info');
    return;
  }
  const bridge = takeLinkBridge();
  if (!bridge) return;
  try {
    const outcome = await bridge.now(file.path, { force: true });
    if (outcome.status === 'done') {
      notice(outcome.created > 0 ? `已新建关联 ${outcome.created} 条` : '未发现实质关联，未新建', 'success');
    } else if (outcome.status === 'queued') {
      notice('embedding 服务不可达，已加入待处理队列，服务可达后自动处理', 'info');
    } else if (outcome.status === 'out-of-scope') {
      notice('该笔记不在三个盒子内：自动关联只在文献盒、卡片盒、主题盒里生效', 'info');
    } else if (outcome.status === 'failed') {
      notice(`关联处理失败：${outcome.error}`, 'error');
    } else {
      notice('该笔记暂无法处理（文件缺失、非 Markdown 或位于加密目录）', 'info');
    }
  } catch (e) {
    console.warn('[knowledge] 重跑关联失败', e);
    notice(`关联处理失败：${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

/**
 * 命令 bz-knowledge-link-all（ADR-0141 §1，原 bz-secondbrain-link-all）：对三个盒子内
 * **所有未连接（缺 related）的笔记**手动批量补链——启动自动补链的显式兜底入口，
 * 同路径同串行锁；embedding 不可达 / 无目标均明确通知。
 */
export async function linkAllInBoxes(): Promise<void> {
  const bridge = takeLinkBridge();
  if (!bridge) return;
  try {
    const result = await bridge.backfill();
    if (result.status === 'done') {
      notice(
        result.created > 0
          ? `批量补链完成：处理 ${result.processed} 篇 / 新建关联 ${result.created} 条`
          : '批量补链完成：未发现实质关联，未新建',
        'success'
      );
    } else if (result.status === 'unreachable') {
      notice('embedding 服务不可达，无法补链；服务恢复后可在下次启动自动补链', 'info');
    } else if (result.status === 'no-targets') {
      notice('当前无待补链笔记：三个盒子内未连接的笔记已处理完', 'info');
    } else {
      notice('批量补链跳过（自动关联已关闭）', 'info');
    }
  } catch (e) {
    console.warn('[knowledge] 批量补链失败', e);
    notice(`批量补链失败：${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

/** 卸载（main.ts onunload 调用；幂等空清理） */
export function unloadKnowledge(): void {
  uiManager?.destroy();
  uiManager = null;
  initialized = false;
}