// @vitest-environment jsdom
/**
 * 图片类目录：设置页显示的就是**实际生效目录**（2026-10-31 口径收口，取代 issue 560 的域内缺省）
 *
 * 口径（源头只有一处：core/attachment-dir）：
 *   显式设置值 → Obsidian「默认新附件位置」（固定文件夹形态）→ `<本域主目录>/assets`
 * 第三跳是**推出来的**，不是常量：剪藏=剪藏文件夹、知识盒=卡片文件夹、影院/游戏库=本域目录。
 * `CONFIG/MOVIE POSTER` / `CONFIG/游戏海报` / `归档/网页剪藏/assets` / `文献盒/assets` 四个写死
 * 缺省全部退役——页面显示与实际落点必须同一处。
 *
 * 三跳全空（没设图片文件夹、Obsidian 也没固定附件目录、主目录还没配）= 空串：写盘侧拒绝，
 * 绝不落库根。图片字段也**永不参与空态闸门**，挡人进域的是主目录。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { gameshelfSettingsSchema } from '../../src/gameshelf/settings';
import { knowledgeSettingsSchema } from '../../src/knowledge/ui';
import { clipbookSettingsSchema } from '../../src/clipbook/ui';
import { emptyDataSourceState } from '../../src/clipbook/news-source-settings';
import { renderSettingsInto } from '../../src/core/settings-schema';
import { renderPanelSchema } from '../../src/settings-panel/renderer';
import { folderState, needsFolderSetup } from '../../src/core/folder-setup';
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

interface ImageRowCase {
  key: string;
  /** 本域主目录键 + 夹具值 */
  mainKey: string;
  mainValue: string;
  schema: () => SettingsSchema;
}

/** 四域图片行：主目录一配，图就该落 `<主目录>/assets` */
const IMAGE_ROWS: ImageRowCase[] = [
  {
    key: 'clipbookImageFolder',
    mainKey: 'articleDirectory',
    mainValue: '归档/剪藏',
    schema: () => clipbookSettingsSchema(emptyDataSourceState()),
  },
  { key: 'cinemaPosterFolder', mainKey: 'cinemaFolderPath', mainValue: '我的/影视', schema: () => cinemaSettingsSchema() },
  { key: 'gameshelfPosterFolder', mainKey: 'gameshelfFolderPath', mainValue: '我的/游戏', schema: () => gameshelfSettingsSchema() },
  { key: 'knowledgeImageFolder', mainKey: 'knowledgeCardboxDirectory', mainValue: '卡片盒', schema: () => knowledgeSettingsSchema() },
];

/** 只配主目录，其余留空 */
function onlyMainDirs(): void {
  const s: Record<string, string> = {};
  for (const c of IMAGE_ROWS) s[c.mainKey] = c.mainValue;
  setSettingsProvider(() => s as never);
}

beforeEach(() => {
  // 什么都不配：默认值这条链的最底
  setSettingsProvider(() => ({}) as never);
  mockVaultConfig(null);
});

describe('图片类目录的生效值 = 显式 → Obsidian → <主目录>/assets', () => {
  it('四行都挂了 fallbackValue（空行不该只留一个「选择…」按钮）', () => {
    onlyMainDirs();
    for (const c of IMAGE_ROWS) {
      expect(typeof rowOf(c.schema(), c.key).fallbackValue, `${c.key} 缺 fallbackValue`).toBe('function');
    }
  });

  it('只配了主目录 → 显示 <主目录>/assets', () => {
    onlyMainDirs();
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe(`${c.mainValue}/assets`);
    }
  });

  it('Obsidian 设了固定附件文件夹 → 附件位置优先于 <主目录>/assets', () => {
    onlyMainDirs();
    mockVaultConfig('附件');
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), `${c.key} 没跟随 Obsidian 附件位置`).toBe('附件');
    }
    mockVaultConfig('归档/附件');
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe('归档/附件');
    }
  });

  it('跟着笔记走 / 库根这几种 Obsidian 形态不算设过，回落 <主目录>/assets', () => {
    onlyMainDirs();
    for (const form of ['', '/', './', './子目录']) {
      mockVaultConfig(form);
      for (const c of IMAGE_ROWS) {
        expect(rowOf(c.schema(), c.key).fallbackValue!(), `${c.key} 在 Obsidian 设为 ${JSON.stringify(form)} 时应回落`).toBe(
          `${c.mainValue}/assets`
        );
      }
    }
  });

  it('宿主没有这项配置（老版本 / 取不到）时也回落 <主目录>/assets', () => {
    onlyMainDirs();
    setApp({} as never); // 连 vault 都没有
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe(`${c.mainValue}/assets`);
    }
  });

  it('三跳全空 → 空串（不发明目录，也不落库根）', () => {
    setSettingsProvider(() => ({}) as never);
    mockVaultConfig(null);
    for (const c of IMAGE_ROWS) {
      expect(rowOf(c.schema(), c.key).fallbackValue!(), c.key).toBe('');
    }
  });

  it('显式设置值优先于附件位置与主目录', () => {
    onlyMainDirs();
    mockVaultConfig('附件');
    setSettingsProvider(
      () =>
        ({
          articleDirectory: '归档/剪藏',
          cinemaFolderPath: '我的/影视',
          gameshelfFolderPath: '我的/游戏',
          knowledgeCardboxDirectory: '卡片盒',
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

describe('图片字段不参与空态闸门', () => {
  it('主目录配好 → 该域算就绪，图片字段 missing 恒为 false（图片是可选）', () => {
    setSettingsProvider(
      () =>
        ({
          articleDirectory: '归档/剪藏',
          cinemaFolderPath: '我的/影视',
          bookshelfFolderPath: '书库',
          gameshelfFolderPath: '我的/游戏',
          knowledgeDirectory: '文献盒',
          knowledgeCardboxDirectory: '卡片盒',
          knowledgeTopicDirectory: '主题盒',
        }) as never
    );
    mockVaultConfig(null);
    for (const d of ['clipbook', 'cinema', 'bookshelf', 'gameshelf', 'knowledge'] as const) {
      expect(needsFolderSetup(d), `${d} 被可选的图片字段挡在门外`).toBe(false);
      const img = folderState(d).fields.find((f) => f.field.image);
      if (img) {
        expect(img.missing, `${d} 图片字段不该算 missing`).toBe(false);
        expect(img.dir, `${d} 图片目录应落到主目录下的 assets`).toBe(
          `${d === 'knowledge' ? '卡片盒' : d === 'clipbook' ? '归档/剪藏' : d === 'cinema' ? '我的/影视' : '我的/游戏'}/assets`
        );
      }
    }
  });

  it('主目录没配 → 仍然由主目录挡门，图片字段不背锅', () => {
    setSettingsProvider(() => ({}) as never);
    mockVaultConfig(null);
    expect(needsFolderSetup('cinema')).toBe(true);
    const missing = folderState('cinema').missing.map((f) => f.field.key);
    expect(missing).toEqual(['cinemaFolderPath']);
  });
});

describe('四个写死缺省真的退役了', () => {
  /** 递归读 src 下所有 .ts，拼成一段文本 */
  function readSrc(): string {
    const root = join(process.cwd(), 'src');
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith('.ts')) out.push(readFileSync(p, 'utf8'));
      }
    };
    walk(root);
    return out.join('\n');
  }

  it('源码里不再出现 CONFIG/MOVIE POSTER、CONFIG/游戏海报、文献盒/assets、归档/网页剪藏/assets', () => {
    const text = readSrc();
    for (const dead of ['CONFIG/MOVIE POSTER', 'CONFIG/游戏海报', '文献盒/assets', '归档/网页剪藏/assets']) {
      expect(text.includes(dead), `${dead} 还在源码里（写死缺省已退役）`).toBe(false);
    }
  });
});

describe('两个设置渲染器同口径', () => {
  const schema = (fallback: string): SettingsSchema => ({
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
            fallbackValue: () => fallback,
          },
        ],
      },
    ],
  });

  it('域内 ⚙️ 弹窗（core 渲染器）空值时也挂回落 chip', () => {
    const box = document.createElement('div');
    renderSettingsInto(box, schema('我的/影视/assets'));
    const chip = box.querySelector('.bz-chip--locked');
    expect(chip, 'core 渲染器没显示实际生效目录').not.toBeNull();
    expect(chip!.textContent).toBe('我的/影视/assets');
  });

  it('实际生效目录为空时，两个渲染器都不挂 chip（不拿空串当生效目录）', () => {
    const coreBox = document.createElement('div');
    renderSettingsInto(coreBox, schema(''));
    expect(coreBox.querySelector('.bz-chip--locked')).toBeNull();

    const panelBox = document.createElement('div');
    renderPanelSchema(panelBox, schema(''));
    expect(panelBox.querySelector('.bz-chip--locked')).toBeNull();
  });

  it('已填显式值时两个渲染器都不挂回落 chip', () => {
    setSettingsProvider(() => ({ cinemaPosterFolder: '我的/海报' }) as never);
    const coreBox = document.createElement('div');
    renderSettingsInto(coreBox, schema('我的/影视/assets'));
    expect(coreBox.querySelector('.bz-chip--locked')).toBeNull();
    expect(coreBox.textContent).toContain('我的/海报');

    const panelBox = document.createElement('div');
    renderPanelSchema(panelBox, schema('我的/影视/assets'));
    expect(panelBox.querySelector('.bz-chip--locked')).toBeNull();
  });
});
