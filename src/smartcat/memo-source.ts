/**
 * 备忘录动作观察文案层（ticket 075，对齐影视方法监听样板 ADR-0027）：
 * 用户拍板——观察只来自 memo UI 确认回调（方法监听）：memo 域 UI 确认回调直接调
 * smartcat.notifyMemoAction(事件)，文案构造集中本模块（纯函数可测）。
 * 覆盖动作：添加（键值式有才加）/ 编辑（α 合并一次保存一条）/ 完成 / 恢复未完成 /
 * 延后 / 切换优先级 / 删除（仅标题）+ 每日到期扫描合并一条（memoDueObservation）。
 * AIAgent 同步等非 UI 写入天然不收（方法监听，用户拍板不收批量同步）。
 * 数据语义零改动：字段对齐 memo.json（title/scene/priority/due/notePath/scriptName/courseName）。
 */
export type MemoPriority = 'important' | 'minor';

/** 编辑对比快照（α 合并：对比保存前后条目的相关字段） */
export interface MemoEditSnapshot {
  title: string;
  scene: string;
  priority: MemoPriority;
  due: string | null;
  notePath: string | null;
  scriptName: string | null;
  courseName: string | null;
}

/** 备忘录动作事件（memo 域确认回调 → smartcat.notifyMemoAction） */
export type MemoActionEvent =
  | { kind: 'added'; title: string; scene: string; priority: MemoPriority; due: string | null; notePath: string | null; scriptName: string | null; courseName: string | null }
  | { kind: 'edited'; old: MemoEditSnapshot; next: MemoEditSnapshot }
  | { kind: 'completed'; title: string }
  | { kind: 'restored'; title: string }
  | { kind: 'postponed'; title: string; due: string }
  | { kind: 'priority'; title: string; to: MemoPriority }
  | { kind: 'deleted'; title: string };

/** 优先级中文标签（important → 重要，其余 → 次要，对齐 memo 域 even 枚举） */
function priorityLabel(p: string | undefined): string {
  return p === 'important' ? '重要' : '次要';
}

/** 截止归一：'YYYY-MM-DDTHH:mm' → 'YYYY-MM-DD HH:mm'；空/无效 → null */
function normalizeDue(due: string | null | undefined): string | null {
  if (!due) return null;
  const norm = due.replace('T', ' ').trim();
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(norm) ? norm : null;
}

/** 截止 → MM-DD HH:mm（供 添加/编辑 α/延后 文案） */
function dueMMDD(due: string): string {
  return normalizeDue(due)!.slice(5, 16);
}

/** 截止 → HH:mm（供 每日到期扫描 文案） */
function dueHHMM(due: string): string {
  return normalizeDue(due)!.slice(11, 16);
}

/** 笔记路径尾名（'书库/1984.md' → '1984.md'） */
function noteTail(path: string): string {
  return (path.split('/').pop() || path).trim();
}

/** 添加观察文案（键值式：有才加，键顺序 场景→脚本→课程→优先级→截止→笔记） */
export function memoAddedText(
  title: string, scene: string, priority: MemoPriority,
  due: string | null, notePath: string | null, scriptName: string | null, courseName: string | null
): string {
  const kv: string[] = [];
  if (scene != null && scene.trim()) kv.push(`场景：${scene.trim()}`);
  const sn = scriptName && scriptName.trim();
  if (sn) kv.push(`脚本：${sn}`);
  const cn = courseName && courseName.trim();
  if (cn) kv.push(`课程：${cn}`);
  kv.push(`优先级：${priorityLabel(priority)}`);
  const d = normalizeDue(due);
  if (d) kv.push(`截止：${dueMMDD(d)}`);
  const np = notePath && notePath.trim();
  if (np) kv.push(`笔记：${noteTail(np)}`);
  return `你添加了待办「${title}」（${kv.join('，')}）`;
}

/** 编辑 α 合并观察文案（一次保存一条）：
 *  标题变 → 主句「你编辑了待办「新标题」」+（其余变更列表，'，' 分隔）；仅标题变 → 「你改题为「新标题」」；
 *  标题没变 → 主句「你更新了待办「X」」+ '：' + 变更列表（'、' 分隔）；
 *  无变更 → null（不产出）。变更项顺序：课程→场景→脚本→定位→截止→优先级（对齐 ticket 示例）。 */
export function memoEditedText(old: MemoEditSnapshot, next: MemoEditSnapshot): string | null {
  const changes: string[] = [];

  const oCourse = old.courseName && old.courseName.trim();
  const nCourse = next.courseName && next.courseName.trim();
  if (oCourse !== nCourse) {
    if (!oCourse && nCourse) changes.push(`添加课程「${nCourse}」`);
    else if (oCourse && nCourse) changes.push(`课程改为「${nCourse}」`);
    else changes.push('删除课程');
  }

  const oScene = old.scene && old.scene.trim();
  const nScene = next.scene && next.scene.trim();
  if (oScene !== nScene) changes.push(`场景改为「${nScene}」`);

  const oScript = old.scriptName && old.scriptName.trim();
  const nScript = next.scriptName && next.scriptName.trim();
  if (oScript !== nScript) {
    if (!oScript && nScript) changes.push(`添加脚本「${nScript}」`);
    else if (oScript && nScript) changes.push(`脚本改为「${nScript}」`);
    else changes.push(`删除脚本「${oScript}」`); // 对齐示例「删除脚本「主页」」（删除带上原脚本名）
  }

  const oNote = old.notePath && old.notePath.trim();
  const nNote = next.notePath && next.notePath.trim();
  if (oNote !== nNote) {
    if (!oNote && nNote) changes.push(`关联笔记 ${nNote}`);
    else if (oNote && nNote) changes.push(`笔记改为 ${nNote}`);
    else changes.push('删除笔记关联');
  }

  const oDue = normalizeDue(old.due);
  const nDue = normalizeDue(next.due);
  if (oDue !== nDue) {
    if (!oDue && nDue) changes.push(`设截止 ${dueMMDD(nDue!)}`);
    else if (oDue && nDue) changes.push(`截止延到 ${dueMMDD(nDue!)}`);
    else changes.push('清除截止日期');
  }

  const oPrio = priorityLabel(old.priority);
  const nPrio = priorityLabel(next.priority);
  if (oPrio !== nPrio) changes.push(`优先级改为${nPrio}`);

  const oTitle = old.title && old.title.trim();
  const nTitle = next.title && next.title.trim();
  if (oTitle !== nTitle) {
    if (!changes.length) return `你改题为「${nTitle}」`;
    return `你编辑了待办「${nTitle}」（${changes.join('，')}）`;
  }
  if (!changes.length) return null;
  return `你更新了待办「${oTitle}」：${changes.join('、')}`;
}

/** 完成观察文案 */
export function memoCompletedText(title: string): string {
  return `你完成了待办「${title}」`;
}

/** 恢复未完成观察文案 */
export function memoRestoredText(title: string): string {
  return `你把待办「${title}」恢复为未完成`;
}

/** 延后观察文案（due = 延后后的新截止） */
export function memoPostponedText(title: string, due: string): string {
  return `你把待办「${title}」延后到了 ${dueMMDD(due)}`;
}

/** 切换优先级观察文案 */
export function memoPriorityText(title: string, to: MemoPriority): string {
  return `你把待办「${title}」转为${priorityLabel(to)}`;
}

/** 删除观察文案 */
export function memoDeletedText(title: string): string {
  return `你删除了待办「${title}」`;
}

/** 每日到期扫描候选（memo.json 条目精简形状：扫描只需最少字段） */
export interface MemoDueLike {
  title?: string;
  due?: string | null;
  completed?: string | null;
}

/** 每日到期扫描文案（合并一条）：今天到期（对齐 memo getDueStatus 'today' 语义：
 *  dueDate == 今天 且 dueNorm > now）且未完成；条目 ≤5 截断，多出「等 N 个」；N=0 返回 null。
 *  now 可注入（测试跨天用）；排序保持 memo.json 原序。 */
export function memoDueObservation(items: MemoDueLike[] | null | undefined, now: Date = new Date()): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const nowStr = `${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const dueToday = (items || []).filter((it) => {
    if (!it || it.completed) return false;
    const due = normalizeDue(it.due);
    if (!due) return false;
    const dueDate = due.slice(0, 10);
    return dueDate === today && due > nowStr; // 今天且未过期（今天已过时刻 → overdue 不算 today）
  });
  const total = dueToday.length;
  if (!total) return null;
  const shown = dueToday.slice(0, 5).map((it) => `${it.title}（${dueHHMM(it.due!)}）`).join('、');
  const head = `你有 ${total} 个待办今天到期：${shown}`;
  return total > 5 ? `${head}…等 ${total} 个` : head;
}

/** 事件 → 观察文本（smartcat.notifyMemoAction 调用；编辑无变化返回 null） */
export function buildMemoActionText(evt: MemoActionEvent): string | null {
  switch (evt.kind) {
    case 'added':
      return memoAddedText(evt.title, evt.scene, evt.priority, evt.due, evt.notePath, evt.scriptName, evt.courseName);
    case 'edited':
      return memoEditedText(evt.old, evt.next);
    case 'completed':
      return memoCompletedText(evt.title);
    case 'restored':
      return memoRestoredText(evt.title);
    case 'postponed':
      return memoPostponedText(evt.title, evt.due);
    case 'priority':
      return memoPriorityText(evt.title, evt.to);
    case 'deleted':
      return memoDeletedText(evt.title);
  }
}