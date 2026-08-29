/**
 * 键控卡片列表增量 patch（ticket 139）：文件事件驱动的列表刷新只动差异卡片，
 * 不再 `innerHTML=''` 全列表重建（根因：任一单文件变更销毁整个列表 DOM → 滚动位置跳顶）。
 *
 * 口径：容器直接子元素中凡带 `data-<keyAttr>` 的视为键控卡片；其余子元素
 * （空态提示 / 懒加载尾部提示等）为非键控装饰，不在 diff 范围、原位保留。
 * 只增/删/移/换差异卡片：目标 keys 里没有的移除，新 key 渲染插入，顺序按 keys 调整，
 * `changedKeys` 命中的 key 用 render 结果替换节点（内容未变的卡片连事件绑定一起原样复用）。
 *
 * 首批接入：literature / clipping（两域列表结构逐行同构，`dataset.path` 作 key）；
 * diary / movie 结构差异大（date-section 分组、无卡片 key、懒加载全铺），后续单列 ticket 接入。
 */

export interface PatchKeyedCardsOptions {
  /** 列表容器（卡片与装饰提示的直接父元素） */
  container: HTMLElement;
  /** 卡片 dataset 键名（如 'path'，读 data-path） */
  keyAttr: string;
  /** 目标已渲染区段的 key 序列（调用方负责按当前筛选/懒加载区段算好；须无重复） */
  keys: string[];
  /** 由 key 渲染一张新卡片；返回 null = 该 key 暂不可渲染（跳过，保留原卡片若有） */
  render: (key: string) => HTMLElement | null;
  /** 需要重建内容的 key 集合；省略 = 所有 key 一律按 render 结果重建替换 */
  changedKeys?: ReadonlySet<string>;
}

/** 容器直接子元素中的键控卡片（不含嵌套与非键控装饰） */
function keyedChildren(container: HTMLElement, keyAttr: string): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  const attr = 'data-' + keyAttr;
  for (const el of Array.from(container.children)) {
    if (el.nodeType !== 1) continue;
    if (!(el as HTMLElement).hasAttribute(attr)) continue;
    const key = (el as HTMLElement).dataset[keyAttr];
    if (key != null && !map.has(key)) map.set(key, el as HTMLElement);
  }
  return map;
}

/** 容器内第一个键控卡片（exclude 自身除外；无则 null） */
function firstKeyedChild(container: HTMLElement, keyAttr: string, exclude: HTMLElement | null): HTMLElement | null {
  const attr = 'data-' + keyAttr;
  for (const el of Array.from(container.children)) {
    if (el === exclude) continue;
    if (el.nodeType === 1 && (el as HTMLElement).hasAttribute(attr)) return el as HTMLElement;
  }
  return null;
}

/**
 * 与目标 key 序列 diff 后只动差异卡片。返回统计（测试断言用）：
 * added=新插入 / removed=移除 / moved=仅调序 / updated=重建替换。
 */
export function patchKeyedCards(opts: PatchKeyedCardsOptions): {
  added: number; removed: number; moved: number; updated: number;
} {
  const { container, keyAttr, keys, render } = opts;
  const old = keyedChildren(container, keyAttr);
  const changed = opts.changedKeys;
  const used = new Set<string>();
  let added = 0;
  let moved = 0;
  let updated = 0;

  /** 取 key 对应的就位卡片（复用旧卡或按需渲染），未就位返回 null */
  const ensure = (key: string): HTMLElement | null => {
    const existing = old.get(key);
    if (existing && !used.has(key)) {
      used.add(key);
      if (changed && !changed.has(key)) return existing;
      const fresh = render(key);
      if (!fresh) return existing; // 渲染失败保留旧卡
      if (fresh.outerHTML !== existing.outerHTML) {
        existing.replaceWith(fresh);
        updated++;
        return fresh;
      }
      return existing;
    }
    const fresh = render(key);
    if (fresh) added++;
    return fresh;
  };

  // 顺序遍历目标 keys：逐个就位并挂到正确位置（锚点 = 上一个已就位卡片）
  let anchor: HTMLElement | null = null;
  for (const key of keys) {
    const el = ensure(key);
    if (!el) continue;
    if (anchor) {
      if (el.previousElementSibling !== anchor) {
        anchor.after(el);
        moved++;
      }
    } else {
      // 首卡：必须位于全部其他键控卡片之前，且不越过其前方的非键控装饰
      const first = firstKeyedChild(container, keyAttr, el);
      if (first) {
        if (el.previousElementSibling !== first) {
          container.insertBefore(el, first);
          moved++;
        }
      } else if (!el.isConnected) {
        container.appendChild(el); // 容器无其他键控卡片：新卡追加（既有装饰保持在前）
        moved++;
      }
      // first 不存在且 el 已挂载：它就是唯一键控卡，原位即正确
    }
    anchor = el;
  }

  // 旧卡片里未出现在目标 keys 的 → 移除
  let removed = 0;
  for (const [key, el] of old) {
    if (used.has(key)) continue;
    el.remove();
    removed++;
  }
  return { added, removed, moved, updated };
}
