// @vitest-environment node
/**
 * 影院（cinema）设置 schema 测试：死配置 cinemaPageSize 已删除（审计修复——
 * 全仓无消费点（列表一次全量渲染），改了不生效），schema 与默认值同步清理。
 */
import { describe, it, expect } from 'vitest';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';

describe('cinema 设置 schema', () => {
  it('死配置 cinemaPageSize 已从 schema 删除（每批加载数量行不再出现）', () => {
    const schema = cinemaSettingsSchema();
    const rows = schema.groups.flatMap((g) => g.rows);
    expect(rows.some((r: any) => (r.binding as any)?.key === 'cinemaPageSize')).toBe(false);
    expect(rows.some((r: any) => r.name === '每批加载数量')).toBe(false);
    // 目录组两行：影视文件夹 + 海报文件夹（cinemaPosterFolder，空回落 CONFIG/MOVIE POSTER）
    const folderGroup = schema.groups.find((g) => g.name === '目录')!;
    expect(folderGroup.rows).toHaveLength(2);
    expect((folderGroup.rows[0] as any).binding.key).toBe('cinemaFolderPath');
    const posterRow = folderGroup.rows[1] as any;
    expect(posterRow.type).toBe('path');
    expect(posterRow.mode).toBe('single');
    expect(posterRow.binding.key).toBe('cinemaPosterFolder');
    expect(posterRow.fallbackValue()).toBe('CONFIG/MOVIE POSTER');
    expect(DEFAULT_SETTINGS.cinemaPosterFolder).toBe('');
  });

  it('DEFAULT_SETTINGS 不再声明 cinemaPageSize 默认值', () => {
    expect('cinemaPageSize' in DEFAULT_SETTINGS).toBe(false);
    expect(DEFAULT_SETTINGS.cinemaFolderPath).toBe('我的/影视');
  });

  it('显示组：默认排序/默认状态筛选/剧集按季合并（issue 194 + issue 376，键与契约）', () => {
    const schema = cinemaSettingsSchema();
    const view = schema.groups.find((g) => g.name === '显示')!;
    expect(view.rows).toHaveLength(3);
    const [sort, status] = view.rows as any[];
    expect(sort.type).toBe('select');
    expect(sort.binding).toMatchObject({ key: 'cinemaSortMode' });
    expect(sort.options.map((o: any) => o.value)).toEqual(['date', 'created', 'rating']);
    expect(status.type).toBe('select');
    expect(status.binding).toMatchObject({ key: 'cinemaStatusFilter' });
    expect(status.options.map((o: any) => o.value)).toEqual(['', '想看', '在看', '已看']);
    // 剧集按季合并（issue 376 / ADR-0168）：toggle 行 + 布尔键；2026-09-20 用户拍板默认**开**
    const merge = view.rows[2] as any;
    expect(merge.type).toBe('toggle');
    expect(merge.name).toBe('剧集按季合并');
    expect(merge.binding.key).toBe('cinemaMergeSeasons');
    expect(DEFAULT_SETTINGS.cinemaMergeSeasons).toBe(true);
    // 默认值与选项集一致
    expect(DEFAULT_SETTINGS.cinemaSortMode).toBe('date');
    expect(DEFAULT_SETTINGS.cinemaStatusFilter).toBe('');
    // 风格扩展口（issue 236 / ADR-0103）：键在、默认午夜场；issue 246 起外观组布局行暴露单卡
    // （午夜场上岸单卡，gaz/booth 未实现不暴露，非法值域内回落午夜场）
    expect(DEFAULT_SETTINGS.cinemaStyle).toBe('midnight');
    const styleRow = schema.groups.find((g) => g.name === '外观')!.rows.find((r: any) => (r.binding as any)?.key === 'cinemaStyle') as any;
    expect(styleRow.type).toBe('choiceCards');
    expect(styleRow.options.map((o: any) => o.value)).toEqual(['midnight']);
    // 主题行占位（issue 246）：cinemaSkinTheme 绑 layoutKey=cinemaStyle
    const themeRow = schema.groups[0].rows[1] as any;
    expect(themeRow.binding).toMatchObject({ key: 'cinemaSkinTheme' });
    expect(themeRow.layoutKey).toBe('cinemaStyle');
    // 组序：外观 → 目录 → 显示（「数据抓取」组 ADR-0133 起挪入设置面板，issue 331 定名「数据源凭据」组）
    expect(schema.groups.map((g) => g.name)).toEqual(['外观', '目录', '显示']);
  });

  it('网格每行列数：设置行与键已退役（2026-09-26 用户拍板固定 5 列）', () => {
    expect('cinemaGridColumns' in DEFAULT_SETTINGS).toBe(false);
    const schema = cinemaSettingsSchema();
    const names = schema.groups.flatMap((g) => g.rows.map((r: any) => r.name));
    expect(names).not.toContain('网格每行列数');
  });
});
