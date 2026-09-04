// @vitest-environment node
/**
 * 全站收尾 A 包（enh-sweep-a：设置面板与命令/图标层扫尾）回归测试（纯数据层）：
 * 1. 死键清理：clippingMobileDefaultFullscreen（旧 clipping 域孤儿键）与 5 个书库展示开关键
 *    已从接口+默认值双删（全仓 grep 确认无消费方）；
 * 2. 默认值修正：secondBrainRemoteOllamaUrl 留空（空 = 未配置远程，config 不再回落内网 IP）；
 * 3. 设置子项层级降级：面板样式表含 .bz-sp-set-row.child 透明度弱化规则；
 * 4. 图标单一事实源：DOMAIN_ICONS 两对历史重复图标错开、三份分析报告图标互异；
 * 5. 术语/文案：影院「影视文件夹」描述与日记本「影视目录」区分；书架墙回落描述为准确链路；
 *    新描述过文案 lint（符号/长度口径与 settings-copy-lint 引擎一致）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SETTINGS } from '../src/settings';
import { DOMAIN_ICONS } from '../src/core/domain-icons';
import { setSettingsProvider } from '../src/core/settings-provider';
import { buildConfig } from '../src/secondbrain/config';
import { cinemaSettingsSchema } from '../src/cinema/settings';
import { bookshelfSettingsSchema } from '../src/bookshelf/settings';
import { lintDesc } from './core/settings-copy-lint-engine';

/** 读仓库内文件（相对本测试文件定位，避免依赖 cwd） */
const readRepoFile = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('enh-sweep-a：死键清理', () => {
  it('clippingMobileDefaultFullscreen 与 5 个书库展示开关键已双删（接口+默认值）', () => {
    const dead = [
      'clippingMobileDefaultFullscreen',
      'showFileSize',
      'showReadingTime',
      'showHighlights',
      'showThinks',
      'showReview',
    ];
    for (const k of dead) {
      expect(k in DEFAULT_SETTINGS, `${k} 不在默认值中`).toBe(false);
    }
    // 实际生效键仍在：clipbook 融合域的移动端全屏键
    expect(DEFAULT_SETTINGS.clipbookMobileDefaultFullscreen).toBe(true);
    // 接口层同步：settings.ts 源文件不再声明死键（双删而非只删默认值）
    const settingsSrc = readRepoFile('../src/settings.ts');
    for (const k of dead) {
      expect(settingsSrc.includes(k), `settings.ts 不再出现 ${k}`).toBe(false);
    }
  });
});

describe('enh-sweep-a：secondBrainRemoteOllamaUrl 默认留空', () => {
  it('默认值为空串（空 = 未配置远程），config 不再回落写死内网 IP', () => {
    expect(DEFAULT_SETTINGS.secondBrainRemoteOllamaUrl).toBe('');
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as never);
    const cfg = buildConfig();
    expect(cfg.OLLAMA_REMOTE_URL).toBe('');
    // 用户显式配置时原样透传
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, secondBrainRemoteOllamaUrl: 'http://10.0.0.2:11434' }) as never);
    expect(buildConfig().OLLAMA_REMOTE_URL).toBe('http://10.0.0.2:11434');
  });
});

describe('enh-sweep-a：设置子项层级降级', () => {
  it('面板样式表含 .bz-sp-set-row.child 透明度弱化规则（hover 恢复）', () => {
    const css = readRepoFile('../src/settings-panel/styles.css');
    expect(css).toMatch(/\.bz-sp-set-row\.child\s*\{[^}]*opacity:\s*0?\.\d+/);
    expect(css).toMatch(/\.bz-sp-set-row\.child:hover\s*\{[^}]*opacity:\s*1/);
  });
});

describe('enh-sweep-a：图标单一事实源', () => {
  it('两对历史重复图标错开；三份分析报告图标互异', () => {
    // 读书笔记类（日记本 notebook-pen）vs 书架墙（book-open 独占）
    expect(DOMAIN_ICONS.diary).toBe('notebook-pen');
    expect(DOMAIN_ICONS.diary).not.toBe(DOMAIN_ICONS.bookshelf);
    expect(DOMAIN_ICONS.bookshelf).toBe('book-open');
    // 分析报告：阅读 bar-chart-3 / 复习（命令侧 calendar-check）/ 影视（命令侧 pie-chart）互异
    expect(DOMAIN_ICONS['reading-report']).toBe('bar-chart-3');
    const reportIcons = new Set([DOMAIN_ICONS['reading-report'], 'calendar-check', 'pie-chart']);
    expect(reportIcons.size).toBe(3);
    // 值域自检：映射无空值
    for (const [id, icon] of Object.entries(DOMAIN_ICONS)) {
      expect(icon, `域 ${id} 图标非空`).toBeTruthy();
    }
  });
});

describe('enh-sweep-a：术语与描述', () => {
  it('影院「影视文件夹」描述与日记本「影视目录」区分，且过文案 lint', () => {
    const schema = cinemaSettingsSchema();
    const row = schema.groups.flatMap((g) => g.rows).find((r) => (r as { name?: string }).name === '影视文件夹');
    const desc = (row as { desc?: string }).desc ?? '';
    expect(desc).toContain('日记本');
    expect(desc).toContain('影院');
    // 与日记本组「影视目录」同名混淆消除：描述不带旧通用措辞
    expect(desc).not.toBe('存放影视笔记的文件夹路径');
    expect(lintDesc(desc)).toEqual([]);
  });

  it('书架墙「书库文件夹」描述人话化（走查批 D：不暴露迁移实现细节，非「沿用书库设置」旧措辞）', () => {
    const schema = bookshelfSettingsSchema();
    const row = schema.groups.flatMap((g) => g.rows).find((r) => (r as { name?: string }).name === '书库文件夹');
    const desc = (row as { desc?: string }).desc ?? '';
    expect(desc).toBe('存放书籍笔记的文件夹，留空用 vault 根下的「书库」');
    expect(desc).not.toContain('沿用书库设置');
    expect(desc).not.toContain('存量值');
  });
});
