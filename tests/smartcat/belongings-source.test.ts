/**
 * 归物本动作观察文案构造（ticket 079 方法监听）：belongings-source 纯函数全覆盖——
 * 添加（键值式有才加：全字段/无描述/无描述无分类/状态闲置非省略/状态使用中省略）、
 * 编辑（α 变化列表：各字段单独变/多变/全不变→空 changes/不参与字段）、状态（4 态动词化）、删除。
 * notify 集成挂点见 tests/belongings/ui.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  buildBelongingsActionText,
  belongingsAddedText,
  belongingsEditChanges,
  belongingsEditedText,
  belongingsStatusText,
  belongingsDeletedText,
  type BelongingsItemLike,
} from '../../src/smartcat/belongings-source';

/** 默认物品（ticket 示例一：松下s5 使用中，无描述） */
function item(partial: Partial<BelongingsItemLike> = {}): BelongingsItemLike {
  return {
    name: '松下s5',
    category: '📷 微单相机',
    purchase_price: 7988,
    purchase_date: '2024-03-01',
    current_status: '使用中',
    description: '',
    ...partial,
  };
}

describe('belongingsAddedText（添加：键值式有才加）', () => {
  it('全字段（状态非使用中不省略 + 描述）', () => {
    expect(
      belongingsAddedText(item({ current_status: '闲置', description: '索尼全画幅，44MP' }))
    ).toBe('你登记了新物品《松下s5》：分类（📷 微单相机）、价格 ￥7988、购买于 2024-03-01、状态 闲置、描述「索尼全画幅，44MP」');
  });

  it('无描述 + 状态使用中省略（ticket 示例一）', () => {
    expect(belongingsAddedText(item())).toBe('你登记了新物品《松下s5》：分类（📷 微单相机）、价格 ￥7988、购买于 2024-03-01');
  });

  it('无描述无分类（分类段省略）', () => {
    expect(belongingsAddedText(item({ category: '' }))).toBe('你登记了新物品《松下s5》：价格 ￥7988、购买于 2024-03-01');
  });

  it('状态闲置非省略（ticket 示例二）', () => {
    expect(
      belongingsAddedText({ name: '小米音响', category: '🔊 音箱音响', purchase_price: 428, purchase_date: '2023-06-11', current_status: '闲置', description: '' })
    ).toBe('你登记了新物品《小米音响》：分类（🔊 音箱音响）、价格 ￥428、购买于 2023-06-11、状态 闲置');
  });

  it('状态使用中省略（无状态段）', () => {
    const text = belongingsAddedText(item());
    expect(text).not.toContain('状态');
  });
});

describe('belongingsEditChanges（编辑 α 变化列表）', () => {
  const old = item();

  it('各字段单独变：名称', () => {
    expect(belongingsEditChanges(old, item({ name: '松下S5二代' }))).toEqual(['改了名称']);
  });

  it('各字段单独变：分类', () => {
    expect(belongingsEditChanges(old, item({ category: '📷 全画幅微单' }))).toEqual(['改了分类']);
  });

  it('各字段单独变：价格', () => {
    expect(belongingsEditChanges(old, item({ purchase_price: 8888 }))).toEqual(['改了价格']);
  });

  it('各字段单独变：购买日期', () => {
    expect(belongingsEditChanges(old, item({ purchase_date: '2024-03-02' }))).toEqual(['改了购买日期']);
  });

  it('各字段单独变：状态', () => {
    expect(belongingsEditChanges(old, item({ current_status: '闲置' }))).toEqual(['改了状态']);
  });

  it('各字段单独变：描述', () => {
    expect(belongingsEditChanges(old, item({ description: '配了麦克风' }))).toEqual(['改了描述']);
  });

  it('多变：价格 + 状态 + 描述', () => {
    expect(belongingsEditChanges(old, item({ purchase_price: 8888, current_status: '已转卖', description: '已出' }))).toEqual(['改了价格', '改了状态', '改了描述']);
  });

  it('全不变 → 空 changes', () => {
    expect(belongingsEditChanges(old, item())).toEqual([]);
  });

  it('不参与比较：id/created_date/last_updated 变化不产 changes', () => {
    const next = { ...old, id: 'item_2', created_date: '2025-01-01T00:00:00.000Z', last_updated: '2025-01-02T00:00:00.000Z' };
    expect(belongingsEditChanges(old, next)).toEqual([]);
  });
});

describe('belongingsEditedText / build 编辑分支', () => {
  it('有变化 → 主句 + 全角冒号 + 顿号列表', () => {
    expect(belongingsEditedText('松下s5', ['改了价格', '改了状态'])).toBe('你编辑了物品《松下s5》：改了价格、改了状态');
  });

  it('全不变（空 changes）→ 只发主句，不带尾冒号', () => {
    expect(belongingsEditedText('松下s5', [])).toBe('你编辑了物品《松下s5》');
  });
});

describe('belongingsStatusText（状态流转 4 态动词化）', () => {
  it('→闲置', () => {
    expect(belongingsStatusText('松下s5', '闲置')).toBe('你把《松下s5》标记为闲置');
  });

  it('→已转卖', () => {
    expect(belongingsStatusText('松下s5', '已转卖')).toBe('你转卖了《松下s5》');
  });

  it('→已丢弃', () => {
    expect(belongingsStatusText('松下s5', '已丢弃')).toBe('你丢弃了《松下s5》');
  });

  it('→使用中', () => {
    expect(belongingsStatusText('松下s5', '使用中')).toBe('你重新用起了《松下s5》');
  });
});

describe('belongingsDeletedText（删除：仅标题）', () => {
  it('删除文案', () => {
    expect(belongingsDeletedText('松下s5')).toBe('你删除了物品《松下s5》');
  });
});

describe('buildBelongingsActionText（事件 → 文本分发）', () => {
  it('add/edit/status/delete 四类分发', () => {
    expect(buildBelongingsActionText({ kind: 'add', item: item() })).toBe('你登记了新物品《松下s5》：分类（📷 微单相机）、价格 ￥7988、购买于 2024-03-01');
    expect(buildBelongingsActionText({ kind: 'edit', title: '松下s5', changes: ['改了价格'] })).toBe('你编辑了物品《松下s5》：改了价格');
    expect(buildBelongingsActionText({ kind: 'status', title: '松下s5', status: '已丢弃' })).toBe('你丢弃了《松下s5》');
    expect(buildBelongingsActionText({ kind: 'delete', title: '松下s5' })).toBe('你删除了物品《松下s5》');
  });
});