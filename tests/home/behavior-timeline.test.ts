// @vitest-environment node
/**
 * 首页时间线行为流数据层测试（issue 305 / ADR-0132）：
 * 归一化（metadata.name 优先 / description 剥前缀 / 坏条目剔除）、映射表逐源（含噪音动作剔除）、
 * 分桶（本地日边界 / 窗口裁剪 / 升序）、只读契约（缺失不建文件 / 损坏回落空）。
 */
import { describe, it, expect } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import {
  normalizeBehaviorItem, mapBehaviorEvent, behaviorToDays, readBehaviorItems, behaviorSourceDomain,
  type BehaviorItemLite,
} from '../../src/home/behavior-timeline';

/** 2026-09-13（本地时区）内的时刻 */
const at = (h: number, m = 0, day = 13): number => new Date(2026, 8, day, h, m).getTime();

const item = (source: string, type: string, name = 'X', ts = at(10), rating: number | null = null): BehaviorItemLite =>
  ({ source, type, name, rating, ts });

describe('normalizeBehaviorItem（行为条目容错归一）', () => {
  it('metadata.name 优先，rating 取 metadata.rating', () => {
    const it = normalizeBehaviorItem({
      source: 'movie', type: 'rated', timestamp: new Date(at(21, 30)).toISOString(),
      description: 'movie:rated 旧名字', metadata: { name: '沙丘', rating: 4 },
    });
    expect(it).toEqual({ source: 'movie', type: 'rated', name: '沙丘', rating: 4, ts: at(21, 30) });
  });

  it('metadata 缺 name → description 剥 `src:type ` 前缀兜底', () => {
    const it = normalizeBehaviorItem({
      source: 'news', type: 'skipped', timestamp: new Date(at(9, 5)).toISOString(),
      description: 'news:skipped 轮子为什么难',
    });
    expect(it?.name).toBe('轮子为什么难');
    expect(it?.rating).toBeNull();
  });

  it('缺 source/type、时间戳非法、非对象 → null（坏条目不进时间线）', () => {
    expect(normalizeBehaviorItem(null)).toBeNull();
    expect(normalizeBehaviorItem('x')).toBeNull();
    expect(normalizeBehaviorItem({ type: 'watched', timestamp: new Date(at(10)).toISOString() })).toBeNull();
    expect(normalizeBehaviorItem({ source: 'movie', timestamp: new Date(at(10)).toISOString() })).toBeNull();
    expect(normalizeBehaviorItem({ source: 'movie', type: 'watched', timestamp: '不是时间' })).toBeNull();
  });
});

describe('behaviorSourceDomain（行为流 source → 首页域 id）', () => {
  it('已盘点来源逐一归口（渲染徽标/彩点 hasEvent 认这个 id）', () => {
    expect(behaviorSourceDomain('movie')).toBe('cinema');
    expect(behaviorSourceDomain('news')).toBe('clipping');
    expect(behaviorSourceDomain('memo')).toBe('memo');
    expect(behaviorSourceDomain('knowledge')).toBe('knowledge');
    // 知识盒旧域名存量来源（ADR-0072 迁出后 source 值不迁移）
    expect(behaviorSourceDomain('literature')).toBe('knowledge');
    expect(behaviorSourceDomain('bili-downloader')).toBe('knowledge');
    expect(behaviorSourceDomain('favorites')).toBe('favorites');
    expect(behaviorSourceDomain('review')).toBe('review');
    expect(behaviorSourceDomain('library')).toBe('bookshelf');
  });

  it('未收录来源原样透传（渲染层回落显示源名）', () => {
    expect(behaviorSourceDomain('flash')).toBe('flash');
  });
});

describe('mapBehaviorEvent（ADR-0132 映射表）', () => {
  it('影院：want/watching 状态推进、watched 产出、rated 点评带星级', () => {
    expect(mapBehaviorEvent(item('movie', 'want', '沙丘'))).toMatchObject({ domain: 'cinema', kind: 'progress', text: '《沙丘》加入片单' });
    expect(mapBehaviorEvent(item('movie', 'watching', '沙丘'))).toMatchObject({ kind: 'progress', text: '开始看《沙丘》' });
    expect(mapBehaviorEvent(item('movie', 'watched', '沙丘'))).toMatchObject({ kind: 'produce', text: '标记《沙丘》已看' });
    expect(mapBehaviorEvent(item('movie', 'rated', '沙丘', at(10), 4))).toMatchObject({ kind: 'note', text: '评价《沙丘》 ★4' });
    // 星级缺失（metadata.rating 没有）→ 只出评价二字，不编星级
    expect(mapBehaviorEvent(item('movie', 'rated', '沙丘'))).toMatchObject({ kind: 'note', text: '评价《沙丘》' });
  });

  it('聚合讯：saved 产出、skipped 落已跳过类（第四类）', () => {
    expect(mapBehaviorEvent(item('news', 'saved', '某篇'))).toMatchObject({ domain: 'clipping', kind: 'produce', text: '收藏文章『某篇』' });
    expect(mapBehaviorEvent(item('news', 'skipped', '某篇'))).toMatchObject({ domain: 'clipping', kind: 'skipped', text: '已跳过『某篇』' });
  });

  it('备忘录：added 保留「新增备忘录」前缀（memoCreated 派生契约）、completed 产出', () => {
    const added = mapBehaviorEvent(item('memo', 'added', '买牛奶'));
    expect(added).toMatchObject({ domain: 'memo', kind: 'progress', text: '新增备忘录『买牛奶』' });
    expect(added?.text.startsWith('新增备忘录')).toBe(true);
    expect(mapBehaviorEvent(item('memo', 'completed', '买牛奶'))).toMatchObject({ kind: 'produce', text: '完成『买牛奶』' });
  });

  it('知识盒：knowledge/literature 双 source 同口径（term-generated / converted）', () => {
    expect(mapBehaviorEvent(item('knowledge', 'term-generated', '熵'))).toMatchObject({ domain: 'knowledge', kind: 'produce', text: '生成术语『熵』' });
    expect(mapBehaviorEvent(item('literature', 'term-generated', '熵'))).toMatchObject({ domain: 'knowledge', kind: 'produce', text: '生成术语『熵』' });
    expect(mapBehaviorEvent(item('knowledge', 'converted', '一部视频'))).toMatchObject({ kind: 'produce', text: '转化『一部视频』' });
    expect(mapBehaviorEvent(item('knowledge', 'image-generated', '窗外的树'))).toMatchObject({ kind: 'produce', text: '读图『窗外的树』' });
    expect(mapBehaviorEvent(item('literature', 'converted', '一部视频'))).toMatchObject({ kind: 'produce', text: '转化『一部视频』' });
  });

  it('收藏夹 / 视频下载 / 复习', () => {
    expect(mapBehaviorEvent(item('favorites', 'added', 'Anthropic'))).toMatchObject({ domain: 'favorites', kind: 'produce', text: '收藏站点『Anthropic』' });
    expect(mapBehaviorEvent(item('bili-downloader', 'added', '某视频'))).toMatchObject({ domain: 'knowledge', kind: 'progress', text: '添加下载『某视频』' });
    expect(mapBehaviorEvent(item('bili-downloader', 'converted', '某视频'))).toMatchObject({ domain: 'knowledge', kind: 'produce', text: '下载完成『某视频』' });
    // 复习启动条目无名（coverage-source 只发 {review, started}）→ 仍要能进时间线
    expect(mapBehaviorEvent(item('review', 'started', ''))).toMatchObject({ domain: 'review', kind: 'produce', text: '开始复习' });
  });

  it('噪音动作不进时间线：删除/编辑/归档/优先级/到期扫描/未收录源', () => {
    const noisy: Array<[string, string]> = [
      ['movie', 'deleted'], ['memo', 'edited'], ['memo', 'deleted'], ['memo', 'priority'],
      ['memo', 'restored'], ['memo', 'due'], ['favorites', 'archived'], ['favorites', 'unarchived'],
      ['favorites', 'deleted'], ['diary', 'deleted'], ['flash', 'deleted'], ['chat', 'said'],
      ['review', 'added'], ['library', 'completed'],
    ];
    for (const [source, type] of noisy) {
      expect(mapBehaviorEvent(item(source, type, 'X')), `${source}:${type} 不该进时间线`).toBeNull();
    }
  });

  it('无名条目剔除（白名单外）', () => {
    expect(mapBehaviorEvent(item('movie', 'watched', ''))).toBeNull();
    expect(mapBehaviorEvent(item('news', 'skipped', '   '))).toBeNull();
  });

  it('时刻标签取本地时区 HH:mm', () => {
    expect(mapBehaviorEvent(item('movie', 'watched', '沙丘', at(7, 5)))?.timeLabel).toBe('07:05');
  });
});

describe('behaviorToDays（按本地日分桶）', () => {
  it('今天起往回 N 天、事件升序、窗外与无效动作剔除', () => {
    const now = at(21, 0); // 2026-09-13 21:00
    const days = behaviorToDays([
      item('movie', 'watched', '晚', at(20)),                    // 今天 20:00
      item('memo', 'added', '早', at(8)),                        // 今天 08:00
      item('movie', 'deleted', '噪音', at(9)),                    // 今天 09:00 → 剔除
      item('news', 'saved', '昨天', at(23, 30, 12)),              // 昨天 23:30
      item('movie', 'want', '七天前', at(10, 0, 6)),              // 窗口外（now-7d）→ 剔除
    ], now, 7);

    expect(days).toHaveLength(7);
    expect(days[0].dateStr).toBe('2026-09-13');
    expect(days[0].events.map((e) => e.text)).toEqual(['新增备忘录『早』', '标记《晚》已看']);
    expect(days[1].dateStr).toBe('2026-09-12');
    expect(days[1].events.map((e) => e.text)).toEqual(['收藏文章『昨天』']);
    expect(days[6].dateStr).toBe('2026-09-07');
    expect(days[6].events).toEqual([]);
  });

  it('本地日边界：23:59 落当天、次日 00:01 落次日（不按 UTC 切）', () => {
    const now = at(0, 5, 14); // 2026-09-14 00:05
    const days = behaviorToDays([
      item('memo', 'completed', '昨夜', at(23, 59, 13)),
      item('memo', 'completed', '今晨', at(0, 1, 14)),
    ], now, 2);
    expect(days[0].dateStr).toBe('2026-09-14');
    expect(days[0].events.map((e) => e.text)).toEqual(['完成『今晨』']);
    expect(days[1].dateStr).toBe('2026-09-13');
    expect(days[1].events.map((e) => e.text)).toEqual(['完成『昨夜』']);
  });
});

describe('readBehaviorItems（只读契约）', () => {
  it('文件缺失 → 空数组且不建文件（不触发 jsonFileStore 自动建）', async () => {
    const vault = new MockVault();
    const before = [...vault.files.keys()];
    const items = await readBehaviorItems(mockAppWithVault(vault) as any);
    expect(items).toEqual([]);
    expect([...vault.files.keys()]).toEqual(before);
  });

  it('损坏 JSON / items 非数组 → 回落空数组（不抛错）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat-behavior.json', '{{{ 坏');
    expect(await readBehaviorItems(mockAppWithVault(vault) as any)).toEqual([]);
    vault.files.set('CONFIG/STORAGE/smartcat-behavior.json', JSON.stringify({ items: 'x' }));
    expect(await readBehaviorItems(mockAppWithVault(vault) as any)).toEqual([]);
  });

  it('合法文件：坏条目剔除、好条目归一（metadata.name 与 description 兜底各显其能）', async () => {
    const vault = new MockVault();
    vault.files.set('CONFIG/STORAGE/smartcat-behavior.json', JSON.stringify({
      version: 1,
      items: [
        { id: 'beh_1', timestamp: new Date(at(20)).toISOString(), type: 'watched', source: 'movie', description: 'movie:watched 沙丘', metadata: { name: '沙丘' } },
        { id: 'beh_2', timestamp: new Date(at(21)).toISOString(), type: 'saved', source: 'news', description: 'news:saved 某篇' },
        { id: 'beh_3', timestamp: '坏时间', type: 'saved', source: 'news', description: 'news:saved 坏' },
        null,
      ],
    }));
    const items = await readBehaviorItems(mockAppWithVault(vault) as any);
    expect(items.map((i) => i.name)).toEqual(['沙丘', '某篇']);
  });
});
