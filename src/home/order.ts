/**
 * 内容首页（home 域）入口顺序持久化（2026-09-10 用户拍板：入口列表可自由上下排序）。
 *
 * 存储：CONFIG/STORAGE/home.json（沿用旧钉选版同一文件）。
 *  - v1 的 `pinned` 字段随 issue 232「钉选/快照退役」作废；本层 v2 只认 `desk` / `mob` 两套顺序，
 *    读旧文件时 pinned 自然被忽略，首次保存时才整文件重写为 v2 形状。
 *  - **两端各排各的**（用户拍板）：desk = 桌面入口行顺序，mob = 移动瓦片顺序，互不影响。
 *
 * 形状校验从宽（容错契约同 home 其它只读源）：非数组/非字符串项一律丢弃，
 * 缺字段回落空序——空序 = 用 DOMAINS 默认顺序（shared.applyOrder），绝不因坏数据报错。
 * 读改写经 enqueueFileTask 串行（同文件多写者防丢写，storage.ts 既有原语）。
 */
import type { App } from 'obsidian';
import { jsonFileStore, storageFile, enqueueFileTask } from '../core/storage';
import type { HomeOrder } from './shared';

/** 当前顺序文件结构版本（v3：顺序与隐藏都按端各一份） */
export const HOME_ORDER_VERSION = 3;

// 类型单源在 ./shared（纯层，消费方只依赖它，不拉 storage）
export type { HomeOrder } from './shared';

export function emptyHomeOrder(): HomeOrder {
  return { version: HOME_ORDER_VERSION, desk: [], mob: [], hiddenDesk: [], hiddenMob: [] };
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];
}

/** 任意读入 → 合法顺序（丢弃坏项；版本号一律归一为当前版）。
 *  v2 → v3 迁移：v2 的单一 `hidden`（两端共用）由两端各继承一份，用户既有隐藏项不会丢；
 *  v3 文件里缺 hiddenDesk/hiddenMob 字段时同样回落该继承值。 */
export function normalizeHomeOrder(raw: unknown): HomeOrder {
  const o = (raw ?? {}) as Record<string, unknown>;
  const legacy = strList(o.hidden);
  return {
    version: HOME_ORDER_VERSION,
    desk: strList(o.desk),
    mob: strList(o.mob),
    hiddenDesk: o.hiddenDesk === undefined ? legacy : strList(o.hiddenDesk),
    hiddenMob: o.hiddenMob === undefined ? legacy : strList(o.hiddenMob),
  };
}

const store = (app?: App) =>
  jsonFileStore<unknown>(storageFile('home.json'), { defaultValue: () => emptyHomeOrder(), app });

/* ---------- 顺序缓存（2026-11-15 发版 review） ----------
 * 首开壳是同步铺的，读顺序却是异步的：壳只能按空序（默认顺序）铺，真实顺序跟着最慢的采集
 * 一起回来，一比对就整屏重排一次——设过自定义顺序或隐藏过域的人每次首开都闪这一下。
 * 这里把「上一次读到的顺序」按 app 键控留一份给同步段用（启动预热先读一遍），
 * 保存即刷新缓存；不跨库（换 app 自然失效）。 */
let cachedOrder: HomeOrder | null = null;
let cachedFor: App | null = null;

/** 同步取缓存（首开铺壳前用；没有就返回 null，照旧按默认顺序铺） */
export function cachedHomeOrder(app?: App): HomeOrder | null {
  return cachedFor === (app ?? null) ? cachedOrder : null;
}

/** 卸载 / 换库时丢弃缓存（home/index.ts 的 unloadHome 调） */
export function invalidateHomeOrder(): void {
  cachedOrder = null;
  cachedFor = null;
}

/** 读顺序（缺失/损坏/旧版一律回落空序；空序 = 默认顺序，不报错、不打断首页渲染） */
export async function loadHomeOrder(app?: App): Promise<HomeOrder> {
  const key = app ?? null;
  if (cachedFor === key && cachedOrder) return cachedOrder;
  try {
    const order = normalizeHomeOrder(await store(app).read());
    cachedFor = key;
    cachedOrder = order;
    return order;
  } catch {
    return emptyHomeOrder();
  }
}

/**
 * 一次性覆盖写（设置面板「首页 → 入口」组的内联列表保存用）：v3 四份数组一起提交，
 * 避免多次读改写；经 enqueueFileTask 与其它写者串行。
 * 提交的是**读到的整份 order**（含另一端），所以本端编辑不会动到另一端的数据。
 */
export async function saveHomeConfig(order: HomeOrder, app?: App): Promise<void> {
  return enqueueFileTask(storageFile('home.json'), async () => {
    await store(app).write({
      version: HOME_ORDER_VERSION,
      desk: [...order.desk],
      mob: [...order.mob],
      hiddenDesk: [...order.hiddenDesk],
      hiddenMob: [...order.hiddenMob],
    });
    // 保存即刷新同步缓存：下次首开铺壳用的就是这份新顺序，不必等一次整屏重排
    cachedFor = app ?? null;
    cachedOrder = normalizeHomeOrder(order);
  });
}
