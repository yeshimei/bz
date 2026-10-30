// @vitest-environment jsdom
/**
 * 图片类目录：设置页显示的就是**实际生效目录**（2026-10-31 用户提问后的口径收口）
 *
 * 口径（源头只有一处，core/attachment-dir 的 resolveAssetDir）：
 *   显式设置值 → Obsidian「默认新附件位置」→ 域内缺省
 * 其中 Obsidian 那一跳只认**固定文件夹**（`附件` / `归档/附件`）；空串、`/`、`./`、`./子` 一律
 * 当没设（插件写的是固定位置，没有「当前笔记」这个上下文）。
 *
 * 为什么要这份测试：设置键默认值都是空串，所以图片行平时就是空的。设置页靠 `fallbackValue`
 * 在空值时挂一枚「实际生效目录」chip —— 这一格写过三种互不一致的形态：
 *   - 剪藏 / 游戏库：压根没配 → 空行只有「选择…」，看不出图会存哪；
 *   - 影院：写死域内缺省常量 `CONFIG/MOVIE POSTER`，**不含 Obsidian 附件位置** → 用户设了
 *     附件位置时，页面显示和真实落点不是同一处；
 *   - 知识盒：走 resolveImageDir（含附件位置）→ 唯一正确的那份。
 * 本文件把四域拉齐：同一份设置状态下，**行的 fallbackValue === 写入侧解析结果**，且能跟着
 * Obsidian 的附件设置变。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { gameshelfSettingsSchema } from '../../src/gameshelf/settings';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { clipbookSettingsSchema } from '../../src/clipbook/ui';
import { emptyDataSourceState } from '../../src/clipbook/news-source-settings';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import type { SettingsSchema } from '../../src/core/settings-schema';

/** Obsidian「默认新附件位置」的取值（null = 宿主没这配置 / 老版本） */
let attachmentFolderPath: string | null = null;

function mockVaultConfig(value: string | null): void {
  attachmentFolderPath = value;
  setApp({
    vault: {
      getConfig: (key: string) => (key === 'attachmentFolderPath' ? attachmentFolderPath : undefined),
    },
  } as never);
}

function rowOf(schema: SettingsSchema, key: string): { name: string; fallbackValue?: () => string } {
  for (const g of schema.groups) {
    for (const r of g.rows) {
      const b = (r as { binding?: { key?: string } }).binding;
      if (b?.key === key) return r as unknown as { name: string; fallbackValue?: () => string };
    }
  }
  throw new Error(`设置里找不到这一行：${key}`);
}

/** 四域图片行（设置键 → 域内缺省，即 Obsidian 附件位置也没设时的落点） */
const IMAGE_ROWS: Array<{ key: string; fallback: string; schema: () => SettingsSchema }> = [
  { key: 'clipbookImageFolder', fallback: '归档/网页剪藏/assets', schema: () => clipbookSettingsSchema(emptyDataSourceState()) },
  { key: 'cinemaPosterFolder', fallback: 'CONFIG/MOVIE POSTER', schema: () => cinemaSettingsSchema() },
  { key: 'gameshelfPosterFolder', fallback: 'CONFIG/游戏海报', schema: () => gameshelfSettingsSchema() },
  { key: 'knowledgeImageFolder', fallback: '文献盒/assets', schema: () => knowledgeSettingsSchema() },
];

beforeEach(() => {
  // 所有目录设置都是空的：走的就是「默认值」这条链
  setSettingsProvider(() => ({}) as never);
  mockVaultConfig(null);
});

describe('图片类目录行的默认值 = 实际生效目录', () => {
  it('四行都挂了 fallbackValue（空行不该只留一个「选择…」按钮）', () => {
    for (const c of IMAGE_ROWS) {
      const row = rowOf(c.schema(), c.key);
      expect(typeof row.fallbackValue, `${c.key} 缺 fallbackValue`).toBe('function');
    }
  });

  it('什么都没设时显示域内缺省', () => {
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe(c.fallback);
    }
  });

  it('Obsidian 设了固定附件文件夹时，显示跟着走', () => {
    mockVaultConfig('附件');
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), `${c.key} 没跟随 Obsidian 附件位置`).toBe('附件');
    }
    mockVaultConfig('归档/附件');
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe('归档/附件');
    }
  });

  it('跟着笔记走 / 库根这几种 Obsidian 形态不算设过，回落域内缺省', () => {
    for (const form of ['', '/', './', './子目录']) {
      mockVaultConfig(form);
      for (const c of IMAGE_ROWS) {
        expect(rowOf(c.schema(), c.key).fallbackValue!(), `${c.key} 在 Obsidian 设为 ${JSON.stringify(form)} 时应回落`).toBe(c.fallback);
      }
    }
  });

  it('宿主没有这项配置（老版本 / 取不到）时也回落域内缺省', () => {
    mockVaultConfig(null);
    setApp({} as never); // 连 vault 都没有
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe(c.fallback);
    }
  });

  it('显式设置值优先于 Obsidian 附件位置（chip 不显示，但解析口径不能反）', () => {
    mockVaultConfig('附件');
    setSettingsProvider(
      () =>
        ({
          clipbookImageFolder: '我的/网页图',
          cinemaPosterFolder: '我的/海报',
          gameshelfPosterFolder: '我的/封面',
          knowledgeImageFolder: '我的/图版',
        }) as never
    );
    expect(rowOf(clipbookSettingsSchema(emptyDataSourceState()), 'clipbookImageFolder').fallbackValue!()).toBe('我的/网页图');
    expect(rowOf(cinemaSettingsSchema(), 'cinemaPosterFolder').fallbackValue!()).toBe('我的/海报');
    expect(rowOf(gameshelfSettingsSchema(), 'gameshelfPosterFolder').fallbackValue!()).toBe('我的/封面');
    expect(rowOf(knowledgeSettingsSchema(), 'knowledgeImageFolder').fallbackValue!()).toBe('我的/图版');
  });
});

describe('两个设置渲染器同口径', () => {
  const schema = (): SettingsSchema => ({
    groups: [
      {
        icon: 'folder-open',
        name: '目录',
        rows: [
          {
            type: 'path',
            mode: 'single',
            name: '海报文件夹',
            desc: '豆瓣抓取的海报图片保存位置',
            binding: { key: 'cinemaPosterFolder' },
            fallbackValue: () => 'CONFIG/MOVIE POSTER',
          },
        ],
      },
    ],
  });

  it('域内 ⚙️ 弹窗（core 渲染器）空值时也挂回落 chip', () => {
    const box = document.createElement('div');
    renderSettingsInto(box, schema());
    const chip = box.querySelector('.bz-chip--locked');
    expect(chip, 'core 渲染器没显示实际生效目录').not.toBeNull();
    expect(chip!.textContent).toBe('CONFIG/MOVIE POSTER');
  });

  it('已填显式值时两个渲染器都不挂回落 chip', () => {
    setSettingsProvider(() => ({ cinemaPosterFolder: '我的/海报' }) as never);
    const coreBox = document.createElement('div');
    renderSettingsInto(coreBox, schema());
    expect(coreBox.querySelector('.bz-chip--locked')).toBeNull();
    expect(coreBox.textContent).toContain('我的/海报');

    const panelBox = document.createElement('div');
    renderPanelSchema(panelBox, schema());
    expect(panelBox.querySelector('.bz-chip--locked')).toBeNull();
  });
});
