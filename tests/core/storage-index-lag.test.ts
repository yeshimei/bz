// @vitest-environment node
/**
 * 索引滞后（启动扫描未完成）下的数据层回归 —— 2026-10-04「Folder already exists.」炸 onload。
 *
 * 真机时序（从 obsidian.asar 反证）：桌面端 adapter.watch 先挂监视器、再**异步排队** listAll()
 * 全量扫描，vault 文件树（fileMap）随扫描逐步填充；插件 onload 跑在扫描完成之前。此窗口内：
 *  - `getAbstractFileByPath` 对盘上存在的文件/目录返回 null（索引看不见）；
 *  - 而 Obsidian 的 create/createFolder 判重问的是 **adapter.exists（磁盘）**：盘上有 →
 *    `throw new Error("Folder already exists." / "File already exists.")`。
 * 老实现 ensureDir/createIfMissing 只问索引 → 「盘上有、索引看不见」必炸，jsonFileStore 首建
 * 路径全断（dock.json 首个在 onload 期走首建的文件，第一个踩雷）。
 *
 * 契约：索引看不见但盘上在 → 不重复建目录、adapter 直读直写；盘上真数据绝不拿默认值顶替。
 * 假层 IndexLagVault 的 create/createFolder 对齐真机「按磁盘判重」语义——
 * MockVault 本体判重形同虚设（create 不抛、目录恒可建），看不见这类缺陷（盲区对盲区）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { IndexLagVault } from '../mock-vault';
import { jsonFileStore } from '../../src/core/storage';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('索引滞后（启动扫描未完成）下的 jsonFileStore', () => {
  let vault: IndexLagVault;

  beforeEach(() => {
    vault = new IndexLagVault();
    setApp({ vault } as never);
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' }) as never);
  });

  it('目录盘上在、索引看不见 → 不 createFolder 撞「Folder already exists.」，首建走通', async () => {
    vault.dirs.add('CONFIG/STORAGE'); // 用户数据目录在盘上，索引还没扫到
    const store = jsonFileStore<{ n: number }>('CONFIG/STORAGE/fresh.json', { defaultValue: { n: 0 } });
    expect(await store.read()).toEqual({ n: 0 });
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/fresh.json')!)).toEqual({ n: 0 });
  });

  it('文件盘上有真数据、索引看不见 → adapter 直读真实数据，绝不拿默认值顶替', async () => {
    vault.dirs.add('CONFIG/STORAGE');
    vault.files.set('CONFIG/STORAGE/real.json', JSON.stringify({ real: 'data' }));
    const store = jsonFileStore<Record<string, string>>('CONFIG/STORAGE/real.json', { defaultValue: {} });
    expect(await store.read()).toEqual({ real: 'data' });
  });

  it('写：文件盘上有、索引看不见 → create 撞 already exists 降级 adapter 直写（不抛「竞态降级失败」）', async () => {
    vault.dirs.add('CONFIG/STORAGE');
    vault.files.set('CONFIG/STORAGE/w.json', JSON.stringify({ old: true }));
    await jsonFileStore('CONFIG/STORAGE/w.json').write({ fresh: 1 });
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/w.json')!)).toEqual({ fresh: 1 });
  });

  it('read 首建后（索引仍瞎）再 write → adapter 直写落盘（loadDockStore 的 read→write 连招）', async () => {
    vault.dirs.add('CONFIG/STORAGE');
    const store = jsonFileStore<{ seed: boolean }>('CONFIG/STORAGE/dock-like.json', {
      defaultValue: { seed: false },
    });
    await store.read(); // 首建缺省文件；文件落了盘，索引依旧看不见它
    await store.write({ seed: true });
    expect(JSON.parse(vault.files.get('CONFIG/STORAGE/dock-like.json')!)).toEqual({ seed: true });
  });
});
