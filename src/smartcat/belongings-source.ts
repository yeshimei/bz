/**
 * 归物本动作观察文案层（ticket 079，ADR-0032，对齐影视/备忘录方法监听样板 ADR-0027/0028）：
 * 用户拍板——归物本观察从「domain-source belongings 计数 extract」（只增不减、无名称、状态流转/编辑不反映）
 * 改为**方法监听**：belongings 域 UI 确认回调直接调 smartcat.notifyBelongingsAction(事件)，
 * 文案构造集中本模块（纯函数可测）。
 * 覆盖动作：添加（键值式有才加）/ 编辑（α 变化列表）/ 状态流转（4 态动词化）/ 删除（仅标题）。
 * 添加状态省略规则：仅当 current_status 非「使用中」才写（表单默认使用中，避免噪音）。
 * 数据语义零改动：字段对齐 belongings.json（name/category/purchase_price/purchase_date/current_status/description）。
 * 编辑比较不参与：id、created_date、last_updated。
 */

/** 归物本物品观察形状（只含参与观察的字段；完整字段见 src/belongings/types.ts BelongingsItem） */
export interface BelongingsItemLike {
  name: string;
  category: string;
  purchase_price: number;
  purchase_date: string;
  current_status: string; // 使用中/闲置/已转卖/已丢弃
  description: string;
}

/** 编辑对比快照（α 变化列表：比较保存前后条目的相关字段） */
export type BelongingsEditLike = BelongingsItemLike;

/** 归物本动作事件（belongings 域确认回调 → smartcat.notifyBelongingsAction） */
export type BelongingsActionEvent =
  | { kind: 'add'; item: BelongingsItemLike }
  | { kind: 'edit'; title: string; changes: string[] }
  | { kind: 'status'; title: string; status: string }
  | { kind: 'delete'; title: string };

/** 添加观察文案（键值式：有才加，顿号分隔，顺序 分类→价格→购买日期→状态→描述；状态非「使用中」才写） */
export function belongingsAddedText(item: BelongingsItemLike): string {
  const kv: string[] = [];
  const cat = item.category && item.category.trim();
  if (cat) kv.push(`分类（${cat}）`);
  if (typeof item.purchase_price === 'number' && Number.isFinite(item.purchase_price)) kv.push(`价格 ￥${item.purchase_price}`);
  const date = item.purchase_date && item.purchase_date.trim();
  if (date) kv.push(`购买于 ${date}`);
  const st = item.current_status && item.current_status.trim();
  if (st && st !== '使用中') kv.push(`状态 ${st}`);
  const desc = item.description && item.description.trim();
  if (desc) kv.push(`描述「${desc}」`);
  return kv.length ? `你登记了新物品《${item.name}》：${kv.join('、')}` : `你登记了新物品《${item.name}》`;
}

/** 编辑 α 变化列表（snapshot = 弹窗打开时旧值快照；next = 保存后条目，item 是直接改的引用）
 *  比较参与：name/category/purchase_price/purchase_date/current_status/description；
 *  不参与：id/created_date/last_updated。变化项名：改了名称/分类/价格/购买日期/状态/描述。 */
export function belongingsEditChanges(snapshot: BelongingsEditLike, next: BelongingsEditLike): string[] {
  const changes: string[] = [];
  if (snapshot.name !== next.name) changes.push('改了名称');
  if (snapshot.category !== next.category) changes.push('改了分类');
  if (snapshot.purchase_price !== next.purchase_price) changes.push('改了价格');
  if (snapshot.purchase_date !== next.purchase_date) changes.push('改了购买日期');
  if (snapshot.current_status !== next.current_status) changes.push('改了状态');
  if (snapshot.description !== next.description) changes.push('改了描述');
  return changes;
}

/** 编辑观察文案：有变化 → 「你编辑了物品《X》：改了…」（'、' 分隔）；全不变（空 changes）→ 只发主句不带尾冒号 */
export function belongingsEditedText(title: string, changes: string[]): string {
  return changes.length ? `你编辑了物品《${title}》：${changes.join('、')}` : `你编辑了物品《${title}》`;
}

/** 状态流转观察文案（4 态动词化；未知状态兜底「标记为」） */
export function belongingsStatusText(title: string, status: string): string {
  switch (status) {
    case '闲置': return `你把《${title}》标记为闲置`;
    case '已转卖': return `你转卖了《${title}》`;
    case '已丢弃': return `你丢弃了《${title}》`;
    case '使用中': return `你重新用起了《${title}》`;
    default: return `你把《${title}》标记为${status}`;
  }
}

/** 删除观察文案 */
export function belongingsDeletedText(title: string): string {
  return `你删除了物品《${title}》`;
}

/** 事件 → 观察文本（smartcat.notifyBelongingsAction 调用；签名对齐 memo/movie-source 保持 string | null） */
export function buildBelongingsActionText(evt: BelongingsActionEvent): string | null {
  switch (evt.kind) {
    case 'add': return belongingsAddedText(evt.item);
    case 'edit': return belongingsEditedText(evt.title, evt.changes);
    case 'status': return belongingsStatusText(evt.title, evt.status);
    case 'delete': return belongingsDeletedText(evt.title);
  }
}