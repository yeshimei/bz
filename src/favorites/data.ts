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
 */
import { jsonStore } from '../core/json-store';
import { enqueueFileTask } from '../core/storage';
import { getApp } from '../core/app';
import { saveSettings, tryGetSettings } from '../core/settings-provider';
import { CONFIG, getTags, normalizeTags, setTags } from './config';
import type { FavTag, FavoritesItem } from './types';

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
    return this.store.read();
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
      data.unshift(item);
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
      if (idx !== -1) data[idx] = { ...data[idx], ...newData };
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
   * 条目标签批量跟随（改名/删除迁移；范式 = memo updateSceneBulk）：tags[] 内 from → to
   * 且 type 同步（type = tags[0] 派生字段），返回迁移条数；零匹配不写盘。
   * 审查修复：触达条件改 or——type===from 但 tags[] 不含的脏条目（历史数据 type 与 tags 失同步）
   * 也一并跟随，不再残留脱钩旧标签。
   */
  async updateTagLabelBulk(from: string, to: string): Promise<number> {
    if (!from || from === to) return 0;
    return enqueueFileTask(this.filePath, async () => {
      const data = await this.read();
      let n = 0;
      data.forEach((d) => {
        if ((d.tags || []).includes(from) || d.type === from) {
          d.tags = (d.tags || []).map((t) => (t === from ? to : t));
          if (d.type === from) d.type = to;
          n++;
        }
      });
      if (n > 0) await this.write(data);
      return n;
    });
  }
}
