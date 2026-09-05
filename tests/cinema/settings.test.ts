// @vitest-environment node
/**
 * 影院（cinema）设置 schema 测试：死配置 cinemaPageSize 已删除（审计修复——
 * 全仓无消费点（列表一次全量渲染），改了不生效），schema 与默认值同步清理。
 */
import { describe, it, expect } from 'vitest';
import { cinemaSettingsSchema } from '../../src/cinema/settings';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('cinema 设置 schema', () => {
  it('死配置 cinemaPageSize 已从 schema 删除（每批加载数量行不再出现）', () => {
    const schema = cinemaSettingsSchema();
    const rows = schema.groups.flatMap((g) => g.rows);
    expect(rows.some((r: any) => (r.binding as any)?.key === 'cinemaPageSize')).toBe(false);
    expect(rows.some((r: any) => r.name === '每批加载数量')).toBe(false);
    // 目录组仅剩影视文件夹路径行
    const folderGroup = schema.groups.find((g) => g.name === '目录')!;
    expect(folderGroup.rows).toHaveLength(1);
    expect((folderGroup.rows[0] as any).binding.key).toBe('cinemaFolderPath');
  });

  it('DEFAULT_SETTINGS 不再声明 cinemaPageSize 默认值', () => {
    expect('cinemaPageSize' in DEFAULT_SETTINGS).toBe(false);
    expect(DEFAULT_SETTINGS.cinemaFolderPath).toBe('我的/影视');
  });

  it('显示组：默认排序/默认状态筛选/网格每行列数（issue 194 + issue 208，键与契约）', () => {
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
    // 网格每行列数（issue 208）：number 行 + string 键数字绑定，钳制 2~12，默认 5
    expect(view.rows).toHaveLength(3);
    const grid = view.rows[2] as any;
    expect(grid.type).toBe('number');
    expect(grid.name).toBe('网格每行列数');
    expect(grid.min).toBe(2);
    expect(grid.max).toBe(12);
    expect(grid.binding.get()).toBe(5);
    // 默认值与选项集一致
    expect(DEFAULT_SETTINGS.cinemaSortMode).toBe('date');
    expect(DEFAULT_SETTINGS.cinemaStatusFilter).toBe('');
    expect(DEFAULT_SETTINGS.cinemaGridColumns).toBe('5');
    // 组序：目录 → 显示 → 移动端（移动端组置尾惯例）
    expect(schema.groups.map((g) => g.name)).toEqual(['目录', '显示', '移动端']);
  });

  it('网格每行列数：默认 5；非法/非正数回退默认（issue 208）', () => {
    const schema = cinemaSettingsSchema();
    const grid = schema.groups.find((g) => g.name === '显示')!.rows[2] as any;
    // string 键数字绑定：写入转字符串落盘，非法值读取回退默认（ticket 170 语义）
    const store: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    setSettingsProvider(() => store as never);
    expect(grid.binding.get()).toBe(5);
    grid.binding.set(8);
    expect(store.cinemaGridColumns).toBe('8');
    expect(grid.binding.get()).toBe(8);
    grid.binding.set(0);
    expect(grid.binding.get()).toBe(5); // 非正数回退默认
    store.cinemaGridColumns = '';
    expect(grid.binding.get()).toBe(5); // 空值回退默认
  });
});
