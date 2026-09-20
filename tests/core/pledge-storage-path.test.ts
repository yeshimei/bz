// @vitest-environment node
/**
 * 深审残款清偿：ARCH-2 storagePath 双轨收敛（review-deep-bugs.md checkup 段登记）
 *
 * 现状（收敛前）：storagePath 目录解析有两套口径——
 *  - core/storage storageDir()/storageFile()：trim 尾斜杠、空回退 CONFIG/STORAGE，**不剥**误配 .json 尾段；
 *  - favorites/config getStorageDir()/getStoragePath()：额外剥 .json 尾段（旧设置可能存了完整文件路径）。
 * 收敛（本批）：`.json` 尾段剥除上沉 core/storage normalizeStorageDir（纯函数单源），
 * storageDir() 经其归一；favorites 两口降级为 @deprecated 兼容转发（checkup files.ts /
 * home river.ts / 域内 app·ui 存量引用零改动，行为逐值恒等）。
 *
 * 守卫（防回潮）：
 *  - 行为恒等：旧口与 core 单源对同一输入矩阵逐值恒等（含 favorites.json 固定文件名拼接）；
 *  - 单源扫描：`.json$` 尾段剥除逻辑全仓只允许存在于 src/core/storage.ts；
 *  - 导出面：favorites 两口必须保留 @deprecated 转发标记（新代码导向 core）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeStorageDir, storageDir, storageFile } from '../../src/core/storage';
import { getStorageDir, getStoragePath } from '../../src/favorites/config';
import { setSettingsProvider } from '../../src/core/settings-provider';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(ROOT, 'src');

/** 输入矩阵：正常目录 / 尾斜杠 / 空 / 缺省 / 误配完整文件路径（带与不带目录）/ 普通文件名误配 */
const VALUE_MATRIX = [
  undefined,
  '',
  'CONFIG/STORAGE',
  'DATA/番茄/',
  '我的/数据',
  '我的/数据/',
  'CONFIG/STORAGE/favorites.json',
  '我的/数据/fav.json',
  'fav.json',
];

describe('core normalizeStorageDir：storagePath 目录归一单源', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({} as any));
  });

  it('缺省/空 → CONFIG/STORAGE；尾斜杠 trim', () => {
    expect(normalizeStorageDir(undefined)).toBe('CONFIG/STORAGE');
    expect(normalizeStorageDir('')).toBe('CONFIG/STORAGE');
    expect(normalizeStorageDir('DATA/番茄/')).toBe('DATA/番茄');
    expect(normalizeStorageDir('我的/数据')).toBe('我的/数据');
  });

  it('误配 .json 尾段 → 剥到所在目录（旧设置存了完整文件路径的兼容防御）', () => {
    expect(normalizeStorageDir('CONFIG/STORAGE/favorites.json')).toBe('CONFIG/STORAGE');
    expect(normalizeStorageDir('我的/数据/fav.json')).toBe('我的/数据');
    expect(normalizeStorageDir('fav.json')).toBe('CONFIG/STORAGE'); // 无目录段 → 回退缺省
  });

  it('storageDir() 经单源归一：settings.storagePath 误配 .json 也剥（全域受益）', () => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE/favorites.json' } as any));
    expect(storageDir()).toBe('CONFIG/STORAGE');
    expect(storageFile('memo.json')).toBe('CONFIG/STORAGE/memo.json');
    setSettingsProvider(() => ({ storagePath: 'DATA/笔记/' } as any));
    expect(storageDir()).toBe('DATA/笔记');
  });
});

describe('favorites 旧口 = core 单源的恒等转发', () => {
  it('getStorageDir(value) ≡ normalizeStorageDir(value)（全矩阵逐值恒等）', () => {
    for (const v of VALUE_MATRIX) {
      expect(getStorageDir(v)).toBe(normalizeStorageDir(v));
    }
  });

  it('getStoragePath(value) ≡ storageFile(favorites.json, normalizeStorageDir(value))', () => {
    for (const v of VALUE_MATRIX) {
      expect(getStoragePath(v)).toBe(storageFile('favorites.json', normalizeStorageDir(v)));
    }
    // 既有行为锚（tests/favorites/data.test.ts 同款断言，收敛后不得漂移）
    expect(getStoragePath('我的/数据')).toBe('我的/数据/favorites.json');
    expect(getStoragePath('我的/数据/')).toBe('我的/数据/favorites.json');
    expect(getStoragePath(undefined)).toBe('CONFIG/STORAGE/favorites.json');
    expect(getStoragePath('CONFIG/STORAGE/favorites.json')).toBe('CONFIG/STORAGE/favorites.json');
    expect(getStoragePath('我的/数据/fav.json')).toBe('我的/数据/favorites.json');
  });
});

describe('防回潮守卫：单源扫描 + @deprecated 导出面', () => {
  it('.json 尾段剥除逻辑全仓只允许存在于 src/core/storage.ts（第二轨即红）', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (name.endsWith('.ts') && fs.readFileSync(p, 'utf8').includes('/\\.json$/i')) {
          offenders.push(path.relative(ROOT, p).split(path.sep).join('/'));
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual(['src/core/storage.ts']);
  });

  it('favorites 旧口保留 @deprecated 转发标记（新代码导向 core 单源）', () => {
    const src = fs.readFileSync(path.join(SRC, 'favorites/config.ts'), 'utf8');
    expect(src).toContain('@deprecated');
    expect(src).toContain('normalizeStorageDir'); // 转发自 core 单源
    expect(src).not.toContain('replace(/\\/+$/'); // 本地目录解析逻辑已退役
  });
});
