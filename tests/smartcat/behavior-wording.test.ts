// @vitest-environment node
/**
 * 行为流人类文案模板层测试（ticket 129）
 * 覆盖：ROUTING_RULES 全表 source:action 对应 entityType:action 模板（含时长入文案）、
 * 来源别名（routing 风格键 task/memo 等双注册）、无模板兜底旧式、无 structured 条目直显描述。
 */
import { describe, it, expect } from 'vitest';
import { buildBehaviorWording, behaviorActionWord } from '../../src/smartcat/behavior-wording';
import type { BehaviorItem, StructuredMeta } from '../../src/smartcat/types';

function makeItem(source: string, type: string, meta?: StructuredMeta, description?: string): BehaviorItem {
  return {
    id: `beh_test_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
    type,
    source,
    description: description ?? `${source}:${type}${meta?.name ? ` ${meta.name}` : ''}`,
    metadata: meta,
  };
}

describe('buildBehaviorWording：news（聚合讯）', () => {
  it('news:saved 含平台 + 阅读时长', () => {
    const item = makeItem('news', 'saved', { entityType: 'news', action: 'saved', name: '好文', extras: { platform: '聚合讯', durationMin: 5 } });
    expect(buildBehaviorWording(item)).toBe('你保存了《好文》（聚合讯·读了 5 分钟）');
  });

  it('news:read 含平台 + 阅读时长', () => {
    const item = makeItem('news', 'read', { entityType: 'news', action: 'read', name: '好文', extras: { platform: 'RSS', durationMin: 3 } });
    expect(buildBehaviorWording(item)).toBe('你阅读了《好文》（RSS·读了 3 分钟）');
  });

  it('news:skipped 不带时长', () => {
    const item = makeItem('news', 'skipped', { entityType: 'news', action: 'skipped', name: '坏文', extras: { platform: '聚合讯', durationMin: 2 } });
    expect(buildBehaviorWording(item)).toBe('你跳过了《坏文》（聚合讯）');
  });

  it('news 无时长时不拼「读了」段', () => {
    const item = makeItem('news', 'saved', { entityType: 'news', action: 'saved', name: 'X', extras: { platform: 'P' } });
    expect(buildBehaviorWording(item)).toBe('你保存了《X》（P）');
  });

  it('news 未知动作 → 实体默认', () => {
    const item = makeItem('news', 'weird', { entityType: 'news', action: 'weird', name: 'X' });
    expect(buildBehaviorWording(item)).toBe('聚合讯《X》有动态');
  });
});

describe('buildBehaviorWording：movie（影视）', () => {
  it('movie:want / watching / watched', () => {
    expect(buildBehaviorWording(makeItem('movie', 'want', { entityType: 'movie', action: 'want', name: '流浪地球' }))).toBe('你把《流浪地球》加入想看');
    expect(buildBehaviorWording(makeItem('movie', 'watching', { entityType: 'movie', action: 'watching', name: '流浪地球' }))).toBe('你开始看《流浪地球》');
    expect(buildBehaviorWording(makeItem('movie', 'watched', { entityType: 'movie', action: 'watched', name: '流浪地球' }))).toBe('你看完了《流浪地球》');
  });

  it('movie:rated 首次评分 / 改分', () => {
    expect(buildBehaviorWording(makeItem('movie', 'rated', { entityType: 'movie', action: 'rated', name: 'X', rating: 4.5 }))).toBe('你给《X》评了 4.5 分');
    expect(buildBehaviorWording(makeItem('movie', 'rated', { entityType: 'movie', action: 'rated', name: 'X', rating: 4.5, extras: { fromRating: 3.5 } }))).toBe('你把《X》的评分从 3.5 改为 4.5');
  });

  it('movie:reviewed / deleted / unknown 兜底', () => {
    expect(buildBehaviorWording(makeItem('movie', 'reviewed', { entityType: 'movie', action: 'reviewed', name: 'X', extras: { review: '神作' } }))).toBe('你写了《X》的影评');
    expect(buildBehaviorWording(makeItem('movie', 'deleted', { entityType: 'movie', action: 'deleted', name: 'X' }))).toBe('你删除了《X》的影视记录');
    expect(buildBehaviorWording(makeItem('movie', 'unknown', { entityType: 'movie', action: 'unknown', name: 'X' }))).toBe('《X》的影视活动');
  });
});

describe('buildBehaviorWording：memo（备忘录，实际 entityType=task + 别名 memo）', () => {
  it('task:completed → 你完成了备忘录「标题」', () => {
    const item = makeItem('memo', 'completed', { entityType: 'task', action: 'completed', name: '买菜' });
    expect(buildBehaviorWording(item)).toBe('你完成了备忘录「买菜」');
  });

  it('routing 风格别名 memo:completed 同样命中', () => {
    const item = makeItem('memo', 'completed', { entityType: 'memo', action: 'completed', name: '买菜' });
    expect(buildBehaviorWording(item)).toBe('你完成了备忘录「买菜」');
  });

  it('task 全动作集（added/edited/restored/postponed/priority/deleted/due）', () => {
    const mk = (action: string, extras?: Record<string, any>) => makeItem('memo', action, { entityType: 'task', action, name: '写周报', extras });
    expect(buildBehaviorWording(mk('added'))).toBe('你添加了备忘录「写周报」');
    expect(buildBehaviorWording(mk('edited'))).toBe('你编辑了备忘录「写周报」');
    expect(buildBehaviorWording(mk('restored'))).toBe('你恢复了备忘录「写周报」');
    expect(buildBehaviorWording(mk('postponed'))).toBe('你把备忘录「写周报」推迟了');
    expect(buildBehaviorWording(mk('priority'))).toBe('你调整了备忘录「写周报」的优先级');
    expect(buildBehaviorWording(mk('deleted'))).toBe('你删除了备忘录「写周报」');
    expect(buildBehaviorWording(mk('due', { text: '你有 2 个待办今天到期：写周报（18:00）' }))).toBe('你有 2 个待办今天到期：写周报（18:00）');
    expect(buildBehaviorWording(mk('due'))).toBe('备忘录「写周报」今天到期');
  });
});

describe('buildBehaviorWording：favorites / belongings', () => {
  it('favorite 动作集 + favorites 别名', () => {
    expect(buildBehaviorWording(makeItem('favorites', 'added', { entityType: 'favorite', action: 'added', name: 'GitHub' }))).toBe('你收藏了《GitHub》');
    expect(buildBehaviorWording(makeItem('favorites', 'edited', { entityType: 'favorite', action: 'edited', name: 'GitHub' }))).toBe('你编辑了收藏《GitHub》');
    expect(buildBehaviorWording(makeItem('favorites', 'deleted', { entityType: 'favorites', action: 'deleted', name: 'GitHub' }))).toBe('你取消了收藏《GitHub》');
  });

  it('item 动作集（status 四态动词化）+ belongings 别名', () => {
    expect(buildBehaviorWording(makeItem('belongings', 'added', { entityType: 'item', action: 'added', name: 'Kindle' }))).toBe('你登记了新物品《Kindle》');
    expect(buildBehaviorWording(makeItem('belongings', 'edited', { entityType: 'item', action: 'edited', name: 'Kindle' }))).toBe('你编辑了物品《Kindle》');
    expect(buildBehaviorWording(makeItem('belongings', 'status', { entityType: 'item', action: 'status', name: 'Kindle', extras: { status: '闲置' } }))).toBe('你把《Kindle》标记为闲置');
    expect(buildBehaviorWording(makeItem('belongings', 'status', { entityType: 'item', action: 'status', name: 'Kindle', extras: { status: '已转卖' } }))).toBe('你转卖了《Kindle》');
    expect(buildBehaviorWording(makeItem('belongings', 'deleted', { entityType: 'belongings', action: 'deleted', name: 'Kindle' }))).toBe('你删除了《Kindle》');
  });
});

describe('buildBehaviorWording：pomodoro / chat', () => {
  it('pomodoro:focus-done 带分钟数', () => {
    expect(buildBehaviorWording(makeItem('pomodoro', 'focus-done', { entityType: 'pomodoro', action: 'focus-done', name: '番茄钟 25 分钟专注', duration: 25 }))).toBe('你用番茄钟完成了 25 分钟专注');
  });

  it('pomodoro:focus-done 无分钟数兜底', () => {
    expect(buildBehaviorWording(makeItem('pomodoro', 'focus-done', { entityType: 'pomodoro', action: 'focus-done' }))).toBe('你完成了一次番茄专注');
  });

  it('chat_message:said 回显消息（截断）+ chat 别名', () => {
    const long = '长'.repeat(300);
    expect(buildBehaviorWording(makeItem('chat', 'said', { entityType: 'chat_message', action: 'said', extras: { content: '周末去爬山' } }))).toBe('你说：周末去爬山');
    expect(buildBehaviorWording(makeItem('chat', 'said', { entityType: 'chat', action: 'said', extras: { content: long } }))).toBe(`你说：${'长'.repeat(200)}…`);
    expect(buildBehaviorWording(makeItem('chat', 'said', { entityType: 'chat_message', action: 'said' }))).toBe('你说了一句话');
  });
});

describe('buildBehaviorWording：library（书库，entityType=book）', () => {
  it('book 动作集 + library 别名', () => {
    expect(buildBehaviorWording(makeItem('library', 'started', { entityType: 'book', action: 'started', name: '三体' }))).toBe('你开始读《三体》');
    expect(buildBehaviorWording(makeItem('library', 'completed', { entityType: 'book', action: 'completed', name: '三体' }))).toBe('你读完了《三体》');
    expect(buildBehaviorWording(makeItem('library', 'added', { entityType: 'library', action: 'added', name: '三体' }))).toBe('你把《三体》加入了书架');
    expect(buildBehaviorWording(makeItem('library', 'removed', { entityType: 'book', action: 'removed', name: '三体' }))).toBe('你把《三体》移出了书架');
  });

  it('book:progressed 带进度 / 不带', () => {
    expect(buildBehaviorWording(makeItem('library', 'progressed', { entityType: 'book', action: 'progressed', name: '三体', progress: 60 }))).toBe('你读了《三体》（读到 60%）');
    expect(buildBehaviorWording(makeItem('library', 'progressed', { entityType: 'book', action: 'progressed', name: '三体' }))).toBe('你读了《三体》');
  });

  it('book:highlight / thought', () => {
    expect(buildBehaviorWording(makeItem('library', 'highlight', { entityType: 'book', action: 'highlight', name: '三体', extras: { texts: ['a', 'b'] } }))).toBe('你在《三体》划了 2 条重点');
    expect(buildBehaviorWording(makeItem('library', 'thought', { entityType: 'book', action: 'thought', name: '三体' }))).toBe('你在《三体》写了条想法');
  });
});

describe('buildBehaviorWording：diary / letter / poem / flash', () => {
  it('diary_entry 动作集 + diary 别名', () => {
    expect(buildBehaviorWording(makeItem('diary', 'created', { entityType: 'diary_entry', action: 'created', name: '2026-08-25 11:00' }))).toBe('你写了一篇日记（2026-08-25 11:00）');
    expect(buildBehaviorWording(makeItem('diary', 'updated', { entityType: 'diary_entry', action: 'updated', name: '2026-08-25 11:00' }))).toBe('你更新了日记（2026-08-25 11:00）');
    expect(buildBehaviorWording(makeItem('diary', 'deleted', { entityType: 'diary', action: 'deleted', name: '2026-08-25 11:00' }))).toBe('你删除了日记（2026-08-25 11:00）');
  });

  it('letter / poem / flash 动作集', () => {
    expect(buildBehaviorWording(makeItem('letter', 'created', { entityType: 'letter', action: 'created', name: '家书' }))).toBe('你写了一封信「家书」');
    expect(buildBehaviorWording(makeItem('letter', 'deleted', { entityType: 'letter', action: 'deleted', name: '家书' }))).toBe('你删除了信「家书」');
    expect(buildBehaviorWording(makeItem('poem', 'created', { entityType: 'poem', action: 'created', name: '晚霞' }))).toBe('你写了一首现代诗「晚霞」');
    expect(buildBehaviorWording(makeItem('flash', 'created', { entityType: 'flash', action: 'created', name: '灵感' }))).toBe('你在卡片盒记下了「灵感」');
    expect(buildBehaviorWording(makeItem('flash', 'updated', { entityType: 'flash', action: 'updated', name: '灵感' }))).toBe('你修改了卡片盒「灵感」');
    expect(buildBehaviorWording(makeItem('poem', 'deleted', { entityType: 'poem', action: 'deleted', name: '晚霞' }))).toBe('你删除了现代诗「晚霞」');
  });
});

describe('buildBehaviorWording：reflection / weekly-report / dossier / secondbrain', () => {
  it('系统产物文案', () => {
    expect(buildBehaviorWording(makeItem('reflection', 'insight', { entityType: 'reflection', action: 'insight' }))).toBe('小橘产生了一条新洞察');
    expect(buildBehaviorWording(makeItem('reflection', 'digest', { entityType: 'reflection', action: 'digest' }))).toBe('小橘生成了今日小结');
    expect(buildBehaviorWording(makeItem('weekly-report', 'generated', { entityType: 'weekly-report', action: 'generated' }))).toBe('小橘生成了本周懂你报告');
    expect(buildBehaviorWording(makeItem('dossier', 'generated', { entityType: 'dossier', action: 'generated' }))).toBe('小橘整理了我们的相处故事');
  });

  it('secondbrain 实体默认', () => {
    expect(buildBehaviorWording(makeItem('secondbrain', 'linked', { entityType: 'secondbrain', action: 'linked', name: '卡片' }))).toBe('你在第二大脑记录了「卡片」');
    expect(buildBehaviorWording(makeItem('secondbrain', 'linked', { entityType: 'secondbrain', action: 'linked' }))).toBe('你在第二大脑有新的记录');
  });
});

describe('buildBehaviorWording：literature（文献盒，ADR-0066/0072）', () => {
  it('literature:converted → 你把《标题》转成了文献', () => {
    const item = makeItem('literature', 'converted', { entityType: 'literature', action: 'converted', name: '从零开始学B站', extras: { notePath: '文献盒/从零开始学B站.md' } });
    expect(buildBehaviorWording(item)).toBe('你把《从零开始学B站》转成了文献');
  });

  it('literature:term-generated → 你为「术语」生成了一篇术语文献', () => {
    const item = makeItem('literature', 'term-generated', { entityType: 'literature', action: 'term-generated', name: '习得性无助' });
    expect(buildBehaviorWording(item)).toBe('你为「习得性无助」生成了一篇术语文献');
  });

  it('遗留 bili-downloader:converted / bili 存量条目同样命中（别名兼容，ADR-0072）', () => {
    const item = makeItem('bili-downloader', 'converted', { entityType: 'bili', action: 'converted', name: '旧视频笔记' });
    expect(buildBehaviorWording(item)).toBe('你把《旧视频笔记》转成了文献');
  });

  it('literature 未知动作 → 实体默认', () => {
    const item = makeItem('literature', 'weird', { entityType: 'literature', action: 'weird', name: 'X' });
    expect(buildBehaviorWording(item)).toBe('文献动态：X');
  });
});

describe('buildBehaviorWording：兜底与边界', () => {
  it('无模板命中的未知 entityType → 旧式 source:action 名称', () => {
    const item = makeItem('unknown_domain', 'weird', { entityType: 'unknown_domain', action: 'weird', name: 'X' });
    expect(buildBehaviorWording(item)).toBe('unknown_domain:weird X');
  });

  it('无 structured（legacy 兜底条目）→ 直接回显存储描述', () => {
    const item = makeItem('chat', 'unknown', undefined, '用户说：今天天气真好');
    expect(buildBehaviorWording(item)).toBe('用户说：今天天气真好');
  });

  it('无 structured 且描述为空 → source:type 兜底', () => {
    const item = makeItem('chat', 'unknown', undefined, '');
    expect(buildBehaviorWording(item)).toBe('chat:unknown');
  });

  it('entityType 存在但 action 缺失 → 用 item.type 参与分派', () => {
    const item = makeItem('memo', 'completed', { entityType: 'task', name: '买菜' } as any);
    expect(buildBehaviorWording(item)).toBe('你完成了备忘录「买菜」');
  });
});

describe('behaviorActionWord（type 徽标文案化）', () => {
  it('已知动作词 → 中文', () => {
    expect(behaviorActionWord('saved')).toBe('保存');
    expect(behaviorActionWord('skipped')).toBe('跳过');
    expect(behaviorActionWord('watched')).toBe('看完');
    expect(behaviorActionWord('completed')).toBe('完成');
    expect(behaviorActionWord('focus-done')).toBe('专注');
    expect(behaviorActionWord('unknown')).toBe('活动');
  });

  it('未知词回显原值', () => {
    expect(behaviorActionWord('some_custom_action')).toBe('some_custom_action');
  });
});