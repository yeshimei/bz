/**
 * 收藏本数据管理器（ticket 11）：源码 收藏本.js L28-66 逐字。
 * D2 可靠写契约收编：全部「读→改→写」事务整体入 core per-path 串行队列
 * （enqueueFileTask，键 = favorites.json 路径）——UI（DataManager）与后台文件同步
 * （file-sync）并发写同文件不再互踩；坏文件由 jsonFileStore 留档降级（原语 3）。
 * read/getAll 仍为无锁读；write 保留整段覆盖原义（供既有调用方，队列内勿重入）。
 *
 * issue 363 标签自定义（修订）：标签定义存 data.json 设置键 favoriteTags（config
 * getTags/setTags 设置层单源），本类保留 saveTags（写键 + saveSettings 唯一落盘点）与
 * updateTagLabelBulk（改名/删除时条目 tags[]+type 批量跟随，范式 = memo updateSceneBulk）；
 * loadTags 收口为旧伴生文件 favorites.tags.json 的一次性迁移（幂等：存在且非空 → 迁入
 * 设置键 → 旧文件进系统回收站；缺失/空/坏直接跳过或仅退役）。
 *
 * 深审批 A（bz-fix-fav-data）写链收口：
 * - arch-1：read 出口挂 normalizeItems 条目级归一管道（合法 JSON + 字段类型漂移消毒，
 *   与标签定义侧 normalizeTags 同域同制）；纯读不动盘，写链（mutateAll 读改写）自然固化
 *   归一形态（写时自愈），不可救条目剔除带计数告警。
 * - func-3：update 对「表单快照形态」（五业务字段齐）窄化为业务字段合并——盘侧托管字段
 *   （linkedNote/balance 系/llmConfig/archived 系）保留磁盘现值，防编辑链内存旧快照回滚
 *   checkup 清失效关联等盘侧并发修复；置顶/归档窄 patch 语义不变。
 * - func-4：type = tags[0] 派生字段在 add/update/updateTagLabelBulk 三条写链事务内统一
 *   重算（一处收口），ui 层手工维护退役化。
 * - arch-4（登记批 B）：DataManager 双实例语义不对称——主面板固化 storagePath（app.init
 *   一次构造不再重建），标签管理 tagManagerDm（ui.ts）现读设置现构造，运行中改共享
 *   storagePath 两轨漂移。收口方案：tagManagerDm 改取 FavoritesApp.getInstance()
 *   .dataManager（与主面板同实例，语义 =「storagePath 变更需重载插件后全面生效」，
 *   与 ADR-0009 手动迁移 Notice 同口径）；本类保持无状态实例语义，同 filePath 双实例
 *   写链由 per-path 串行队列保证安全（d2-reliability 回归在案）。
 */
import { jsonStore } from '../core/json-store';
import { enqueueFileTask } from '../core/storage';
import { getApp } from '../core/app';
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { CONFIG, getTags, normalizeTags, normalizeUrl, setTags } from './config';
import type { FavTag, FavoritesItem } from './types';

/**
 * 条目级归一管道（arch-1）：读出口字段类型消毒。favorites.json 是 vault 内可见可编辑文件，
 * 合法 JSON 但字段漂移（created 手滑成数字、tags 改成字符串、删掉 id 等）会直入内存——
 * created 数字使 filteredItems 的 localeCompare 比较器抛 TypeError 炸整面渲染链，tags 字符串
 * 使 includes 误命中筛选错乱。与标签定义侧 normalizeTags（坏行剔除/缺 id 补/类型纠偏）同域
 * 同制，规则：
 * - 非数组 → []；条目非对象、缺 id → 剔除（不可救：id 是唯一键，补 id 会让既有引用脱钩）；
 * - id 非串形态（如数字）→ String() 纠偏；tags 非数组 → 字符串按单元素收编、其余归 []，
 *   元素非串 String() 纠偏；title/description/created 非串 → String() 纠偏（null/缺 → ''）；
 * - pinned / archived 非 boolean → false；archivedAt 只接受串/null；
 * - url 非串纠偏后过 normalizeUrl 读侧归一（E6 读侧半：读盘路径统一补协议，空串跳过）；
 * - type 缺失/非串/空 → tags[0] 重算（func-4 派生口径的读侧兜底，消化历史脏数据）。
 * 未提及字段（balance 系/linkedNote/llmConfig 等）原样透传（读不炸写不产契约）。
 * 归一只作用内存读视图：getAll 纯读不落盘（盘上原值不动，checkup 漂移检查仍可复核）；
 * mutateAll 写链读到的即归一形态，写回自然固化（写时自愈）。剔除/纠偏发生时 console.warn
 * 计数留痕。
 */
export function normalizeItems(raw: unknown): FavoritesItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FavoritesItem[] = [];
  let dropped = 0;
  let fixed = 0;
  for (const r of raw) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) {
      dropped++;
      continue;
    }
    const o = r as Record<string, unknown>;
    if (o.id === undefined || o.id === null || o.id === '') {
      dropped++; // 缺 id 不可救（幽灵行：显示点不动删不掉）
      continue;
    }
    const it = { ...o } as unknown as FavoritesItem; // 未提及字段透传（balance 系/linkedNote/llmConfig…）
    if (typeof o.id !== 'string') {
      fixed++;
      it.id = String(o.id);
    }
    if (Array.isArray(o.tags)) {
      const tags: string[] = [];
      for (const t of o.tags) {
        if (t === undefined || t === null || t === '') continue;
        if (typeof t !== 'string') fixed++;
        tags.push(typeof t === 'string' ? t : String(t));
      }
      it.tags = tags;
    } else if (typeof o.tags === 'string' && o.tags) {
      fixed++;
      it.tags = [o.tags]; // 字符串漂移按单元素收编（'X'.includes 误命中语义随之消失）
    } else {
      if (o.tags !== undefined && o.tags !== null && o.tags !== '') fixed++;
      it.tags = [];
    }
    for (const k of ['title', 'description', 'created'] as const) {
      if (typeof o[k] !== 'string') {
        fixed++;
        (it as any)[k] = o[k] === undefined || o[k] === null ? '' : String(o[k]);
      }
    }
    if (typeof o.url !== 'string') fixed++;
    const rawUrl = typeof o.url === 'string' ? o.url : o.url === undefined || o.url === null ? '' : String(o.url);
    it.url = rawUrl.trim() ? normalizeUrl(rawUrl) : ''; // E6 读侧半：补协议（空串不产 'https://'）
    if (typeof o.pinned !== 'boolean') {
      fixed++;
      it.pinned = false;
    }
    if ('archived' in o && typeof o.archived !== 'boolean') {
      fixed++;
      it.archived = false;
    }
    if ('archivedAt' in o && o.archivedAt !== null && typeof o.archivedAt !== 'string') {
      fixed++;
      it.archivedAt = null;
    }
    if (typeof o.type !== 'string') {
      fixed++;
      it.type = it.tags[0] ?? ''; // func-4 读侧兜底：type = tags[0] 派生
    } else if (!o.type && it.tags[0]) {
      fixed++; // 空串但 tags 非空 → 历史脏数据，重算归位；tags 为空时 type='' 即合法派生值，不计数
      it.type = it.tags[0];
    }
    out.push(it);
  }
  if (dropped || fixed) {
    console.warn(
      `[favorites] favorites.json 条目归一：纠偏 ${fixed} 处字段漂移、剔除 ${dropped} 条不可救条目` +
        `（纯读不动盘上原值，写操作后将固化归一形态；checkup 漂移检查可复核）`,
    );
  }
  return out;
}

/** 表单业务字段集（func-3）：编辑保存唯一有权覆盖的字段面；盘侧托管字段不在此列 */
const FORM_SNAPSHOT_FIELDS = ['title', 'url', 'description', 'tags', 'pinned'] as const;

/** 旧伴生文件路径（issue 363 已退役存量；仅迁移期识别用，不再新建） */
function legacyTagsPath(favoritesPath: string): string {
  const idx = favoritesPath.lastIndexOf('/');
  const dir = idx >= 0 ? favoritesPath.slice(0, idx) : '';
  return (dir || CONFIG.DEFAULT_STORAGE_PATH) + '/favorites.tags.json';
}

/**
 * 迁移 in-flight 串行（审查修复）：DataManager 按调用点现构造（app.init 与设置面板标签管理
 * 各持一个实例），实例字段锁不住跨实例并发——用模块级 promise 记忆，迁移在途时后到方直接
 * 等同一拍；完成后释放（迁移幂等，旧文件已退役时重入为空跑）。
 */
let legacyMigrateInFlight: Promise<void> | null = null;
function migrateLegacyOnce(run: () => Promise<void>): Promise<void> {
  if (!legacyMigrateInFlight) {
    legacyMigrateInFlight = run().finally(() => {
      legacyMigrateInFlight = null;
    });
  }
  return legacyMigrateInFlight;
}

export class DataManager {
  store: ReturnType<typeof jsonStore>;
  /** 数据文件路径（per-path 串行队列键；与 store 同路径） */
  filePath: string;

  constructor(storagePath: string) {
    this.store = jsonStore(storagePath);
    this.filePath = storagePath;
  }

  async read(): Promise<FavoritesItem[]> {
    // arch-1：读出口条目级归一（字段漂移消毒 + E6 读侧 url 补协议），返回类型不再是信任标注
    return normalizeItems(await this.store.read());
  }

  async write(data: FavoritesItem[]): Promise<void> {
    return this.store.write(data);
  }

  /** 读改写事务：fn 基于磁盘现值就地改动（或返回新数组），整体入串行队列执行 */
  async mutateAll(fn: (data: FavoritesItem[]) => FavoritesItem[] | void): Promise<FavoritesItem[]> {
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      const next = fn(data) || data;
      await this.write(next);
      return next;
    });
  }

  add(item: FavoritesItem): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      // func-4：type = tags[0] 派生字段写链统一重算（ui 层手工赋值退役化，传错也被纠）
      const entry = { ...item };
      if (Array.isArray(entry.tags)) entry.type = entry.tags[0] ?? '';
      data.unshift(entry);
    });
  }

  delete(id: string): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      const idx = data.findIndex((d) => d.id === id);
      if (idx !== -1) data.splice(idx, 1);
    });
  }

  /**
   * 撤销删除（ticket 141 通病 1）：删除前取到的完整条目原样插回（含 archived/llmConfig 等全部字段），
   * 不走 add() 重排——同 id 已存在（并发写回）则幂等跳过。参照 review/data.ts restoreItem 先例。
   */
  restoreItem(item: FavoritesItem): Promise<void> {
    return this.mutateAll((data) => {
      if (data.some((d) => d.id === item.id)) return;
      data.push(item);
    }).then(() => undefined);
  }

  update(id: string, newData: Partial<FavoritesItem>): Promise<FavoritesItem[]> {
    return this.mutateAll((data) => {
      const idx = data.findIndex((d) => d.id === id);
      if (idx === -1) return;
      // func-3：编辑链（ui saveForm）传内存全量快照——「表单快照形态」（五业务字段齐活）
      // 窄化为业务字段合并，盘侧托管字段（linkedNote/balance 系/llmConfig/archived 系/created）
      // 保留磁盘现值，防内存旧值回滚 checkup 清失效关联等盘侧并发修复；置顶/归档等窄
      // patch 永不含五字段全集合，语义不变。
      const isFormSnapshot = FORM_SNAPSHOT_FIELDS.every((k) => k in newData);
      const patch: Partial<FavoritesItem> = {};
      if (isFormSnapshot) {
        for (const k of FORM_SNAPSHOT_FIELDS) (patch as any)[k] = (newData as any)[k];
      } else {
        Object.assign(patch, newData);
      }
      const merged = { ...data[idx], ...patch };
      // func-4：type = tags[0] 派生字段写链统一重算（编辑改标签后不再残留旧派生值）
      if (Array.isArray(merged.tags)) merged.type = merged.tags[0] ?? '';
      data[idx] = merged;
    });
  }

  async getAll(): Promise<FavoritesItem[]> {
    return await this.read();
  }

  // ==================== 标签定义（issue 363 修订：data.json 设置键 favoriteTags） ====================

  /**
   * 标签定义收口（app.init / 设置面板标签管理载入时调用）：
   * 1) 旧伴生文件一次性迁移（幂等；审查修复：模块级 in-flight promise 串行——双入口并发载入
   *    只跑一次迁移，防读-迁-退役三步竞态互踩）；文件缺失直接跳过；存在 → 读出归一化（坏 JSON 由
   *    jsonStore 原样留档 CONFIG/.CORRUPT 后降级 []），设置键尚无自定义值且旧件有有效行
   *    → setTags 迁入 data.json 并落盘（落盘失败保留旧文件，下次载入重试）；最后旧文件
   *    进系统回收站退役（可反悔；删除失败不阻塞，下次载入重试）。
   * 2) 返回当前生效集（getTags：设置键优先，无键/空/坏回退内置 9 类 seed，seed 不落盘）。
   */
  async loadTags(): Promise<FavTag[]> {
    await migrateLegacyOnce(() => this.migrateLegacyTagsFile());
    return getTags();
  }

  /** 保存标签定义（管理界面增删改排序的唯一落盘点）：config.setTags 写设置层 + saveSettings 持久化 */
  async saveTags(tags: FavTag[]): Promise<void> {
    setTags(tags);
    await saveSettings();
  }

  /**
   * 旧伴生文件 favorites.tags.json 一次性迁移（issue 363 修订；幂等可重入）。
   * 设置键已有自定义值（新真源更新）时不回写旧件内容，只退役旧文件。
   */
  private async migrateLegacyTagsFile(): Promise<void> {
    const path = legacyTagsPath(this.filePath);
    let file: any = null;
    try {
      file = getApp().vault.getAbstractFileByPath(path);
    } catch {
      return; // app 未就绪：跳过（下次载入重试）
    }
    if (!file) return; // 幂等：旧文件不存在直接跳过
    let raw: unknown = null;
    try {
      raw = await jsonStore(path).read();
    } catch {
      raw = null;
    }
    const legacy = normalizeTags(raw);
    const existing = normalizeTags((tryGetSettings() as any)?.[CONFIG.TAGS_SETTINGS_KEY]);
    if (legacy.length && !existing.length) {
      setTags(legacy);
      try {
        await saveSettings();
      } catch (e) {
        console.error('[favorites-tags-migrate] 设置键落盘失败，保留旧文件待重试:', e);
        return; // 先保数据后退役：落盘不成不删旧文件
      }
    }
    try {
      await getApp().vault.trash(file, true); // 系统回收站，可反悔
    } catch (e) {
      console.error('[favorites-tags-migrate] 旧伴生文件退役失败（下次载入重试）:', e);
    }
  }

  /**
   * 条目标签批量跟随（改名/删除迁移；范式 = memo updateSceneBulk）：tags[] 内 from → to，
   * 迁移后 type 统一重算为 tags[0]（func-4 派生口径收口：跟随语义在 type 正确时与重算等价，
   * 对 type===from 但 tags[] 不含 from 的历史脏条目，重算直接落到 tags[0] 彻底归位）；
   * 返回迁移条数；零匹配不写盘。
   */
  async updateTagLabelBulk(from: string, to: string): Promise<number> {
    if (!from || from === to) return 0;
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      let n = 0;
      data.forEach((d) => {
        if ((d.tags || []).includes(from) || d.type === from) {
          d.tags = (d.tags || []).map((t) => (t === from ? to : t));
          d.type = d.tags[0] ?? ''; // func-4：type = tags[0] 派生（read 归一保证 tags 必为数组）
          n++;
        }
      });
      if (n > 0) await this.write(data);
      return n;
    });
  }
}
