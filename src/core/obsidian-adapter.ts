/**
 * Obsidian vault 事件适配器：全插件唯一的 app.vault 事件订阅点，
 * 把原生 create/modify/delete/rename 转译为域事件总线的两路派发。
 *
 * - 通用兜底路：恒发 'vault:md-created|modified|deleted|renamed'，载荷 { path }（rename 另加 oldPath）——
 *   未命中任何域目录的 md 文件由消费方在此通道兜底接住；
 * - 语义路：classifyFilePath(新路径) 命中域 d 时另发一条 '<d>:file-created|modified|deleted|renamed'。
 *   rename 只发 renamed 一条（不补发 created/deleted，消费方自行处理三分支）；
 *   仅 diary 附带 date: diaryDateFromPath(path)，非日期命名的日记省略 date 字段；
 *   rename 载荷 { oldPath, newPath, movedOut, date? }，movedOut = 旧路径分类 ≠ 新路径分类
 *   （含旧无新有的移入；「旧有新无」时新路径未命中域，语义事件不派发，仅剩通用兜底通道）。
 * - 只处理 md 文件事件（对象 extension === 'md'；失效对象读不到 extension 时按路径后缀兜底，
 *   且兜底排除 TFolder——名为 xxx.md 的目录不算 md 文件）；delete 事件的 file 参数可能是失效对象，
 *   只用其 path。rename 按「新旧任一为 md」派发（md↔非md 改名不丢事件，C4）。
 * - attach 幂等（重复调用直接返回）；registerRef 用于向 Obsidian Plugin 注册事件引用
 *   （plugin.registerEvent），保证插件卸载时自动清理；detach 再做一次显式 offref 收口。
 */
import { emitDomainEvent } from './domain-bus';
import { classifyFilePath, diaryDateFromPath, FileDomainKind } from './path-classify';

/** 挂载状态与已注册的事件引用（模块级单例：vault 订阅点全局唯一） */
let attached = false;
let boundVault: any = null;
const boundRefs: unknown[] = [];

/** md 判定：优先读文件对象 extension（失效对象读不到时按路径后缀兜底）。
 *  C3：兜底须排除文件夹（TFolder 无 extension 属性——Obsidian API 中仅 TFile 有），
 *  否则名为 `xxx.md` 的文件夹经 path.endsWith('.md') 被误判为 md 文件派发事件 */
function isMarkdownFile(file: any, path: string): boolean {
  if (file && typeof file.extension === 'string') return file.extension === 'md';
  if (file && Array.isArray((file as any).children)) return false; // TFolder 形态：目录恒非 md 文件
  return path.endsWith('.md');
}

/** created/modified/deleted 三分支派发：恒发通用兜底事件，命中域再发语义事件 */
function dispatchBasic(action: 'created' | 'modified' | 'deleted', file: any): void {
  const path: string | undefined = file && typeof file.path === 'string' ? file.path : undefined;
  if (!path || !isMarkdownFile(file, path)) return;
  emitDomainEvent(`vault:md-${action}`, { path });
  const kind: FileDomainKind | null = classifyFilePath(path);
  if (!kind) return;
  if (kind === 'diary') {
    const date = diaryDateFromPath(path);
    // 仅 diary 附带 date；非日期命名（如 随笔.md）省略字段
    emitDomainEvent(`diary:file-${action}`, date ? { path, date } : { path });
    return;
  }
  emitDomainEvent(`${kind}:file-${action}`, { path });
}

/** 文件夹判定（TFolder 形态特征：children 数组；C3/C4 共用——目录恒不按 md 派发） */
function isFolder(file: any): boolean {
  return !!(file && Array.isArray((file as any).children));
}

/** renamed 分支派发：只发 renamed 一条（通用 + 至多一条语义），不补发 created/deleted。
 *  C4：md↔非md 改名（旧 .md 新 .txt / 旧 .txt 新 .md）按「新旧任一为 md」判定派发——
 *  只看新路径会把整条事件丢掉，引用同步/复习标记从此失联 */
function dispatchRename(file: any, oldPath: unknown): void {
  const newPath: string | undefined = file && typeof file.path === 'string' ? file.path : undefined;
  if (!newPath || typeof oldPath !== 'string' || !oldPath) return;
  if (isFolder(file)) return; // 目录改名（含名为 xxx.md 的目录）不是 md 文件事件
  const wasMd = oldPath.endsWith('.md');
  if (!wasMd && !isMarkdownFile(file, newPath)) return;
  emitDomainEvent('vault:md-renamed', { oldPath, newPath });
  // 分类以新路径为准；旧路径仅参与 movedOut 判定（实时读设置，移动前后目录配置一致口径）
  const after = classifyFilePath(newPath);
  if (!after) return;
  const before = classifyFilePath(oldPath);
  const payload: { oldPath: string; newPath: string; movedOut: boolean; date?: string } = {
    oldPath,
    newPath,
    movedOut: before !== after, // 含旧无新有（移入域）；旧有新无时 after 为空、本事件不派发
  };
  if (after === 'diary') {
    const date = diaryDateFromPath(newPath);
    if (date) payload.date = date;
  }
  emitDomainEvent(`${after}:file-renamed`, payload);
}

/**
 * 挂载：订阅 app.vault create/modify/delete/rename（幂等，重复调用直接返回）。
 * registerRef 用于向 Obsidian Plugin 注册事件引用（plugin.registerEvent），保证卸载自动清理。
 */
export function attachObsidianAdapter(app: any, registerRef?: (ref: unknown) => void): void {
  if (attached) return;
  const vault = app && app.vault;
  if (!vault || typeof vault.on !== 'function') return; // 无 vault 环境（异常宿主）静默不挂载
  attached = true;
  boundVault = vault;
  const subscribe = (name: string, cb: (...args: any[]) => void): void => {
    const ref = vault.on(name, cb);
    boundRefs.push(ref);
    if (registerRef) registerRef(ref);
  };
  subscribe('create', (file: any) => dispatchBasic('created', file));
  subscribe('modify', (file: any) => dispatchBasic('modified', file));
  subscribe('delete', (file: any) => dispatchBasic('deleted', file));
  subscribe('rename', (file: any, oldPath: string) => dispatchRename(file, oldPath));
}

/** 摘除：显式 offref 已注册引用（registerEvent 清理的兜底），并复位挂载状态（幂等） */
export function detachObsidianAdapter(): void {
  if (!attached) return;
  if (boundVault && typeof boundVault.offref === 'function') {
    for (const ref of boundRefs) {
      try {
        boundVault.offref(ref);
      } catch (e) {
        /* 引用可能已随插件卸载被清理，忽略 */
      }
    }
  }
  boundRefs.length = 0;
  boundVault = null;
  attached = false;
}
