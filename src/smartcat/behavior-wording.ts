/**
 * 行为流人类文案模板层（ticket 129，ADR-0062 决策 2）
 *
 * 行为流条目存储结构化数据（metadata = StructuredMeta），面板渲染时按
 * `entityType:action` 分派模板函数生成人类文案（如 news:saved →「你保存了《标题》
 * （平台·读了 N 分钟）」），列表不显示事件名。存储 description 保持 `source:action 名称`
 * 兜底不迁移（兼容冻结）。
 *
 * 覆盖口径：对照 ROUTING_RULES 全表 + 实际各域 StructuredMeta 产出（movie/diary_entry/
 * task/favorite/item/pomodoro/chat_message/book/news/flash/poem/letter/reflection/
 * weekly-report/dossier/secondbrain）。模板键同时注册实际 entityType 与 routing 风格
 * 来源别名（如 task:* 与 memo:*），保证新旧两套键都命中；无模板命中 → 兜底旧式
 * `source:action 名称`；无 structured 条目不参与模板（legacy 兜底条目直接回显存储描述）。
 * 纯函数可测，无 DOM 依赖。
 */
import type { BehaviorItem, StructuredMeta } from './types';

type WordingGen = (s: StructuredMeta) => string;

const WORDING: Record<string, WordingGen> = {};

/** 注册实体：canonical 键 + 来源别名（routing 风格）同套动作模板 + 实体级默认（*） */
function registerEntity(canonical: string, actions: Record<string, WordingGen>, aliases: string[], entityDefault: WordingGen): void {
  for (const [action, gen] of Object.entries(actions)) {
    WORDING[`${canonical}:${action}`] = gen;
    for (const a of aliases) WORDING[`${a}:${action}`] = gen;
  }
  WORDING[`${canonical}:*`] = entityDefault;
  for (const a of aliases) WORDING[`${a}:*`] = entityDefault;
}

/** 文本截断（聊天/正文类入文案限长，防长文顶垮面板行） */
function clip(text: unknown, n = 80): string {
  const t = typeof text === 'string' ? text : text != null ? String(text) : '';
  return t.length > n ? t.slice(0, n) + '…' : t;
}

/** 聚合讯阅读分钟（extras.durationMin ≥1 才拼「读了 N 分钟」段；跳过态不带） */
function newsMinutes(s: StructuredMeta): string {
  const d = Number(s.extras?.durationMin);
  return Number.isFinite(d) && d >= 1 ? `读了 ${d} 分钟` : '';
}

/** 平台 + 时长段（· 连接；withMinutes=false 跳过时长——news:skipped 口径） */
function newsSuffix(s: StructuredMeta, withMinutes: boolean): string {
  const platform = s.extras?.platform ? String(s.extras.platform) : '';
  const parts = [platform, withMinutes ? newsMinutes(s) : ''].filter(Boolean);
  return parts.length ? `（${parts.join('·')}）` : '';
}

// ==================== news（聚合讯） ====================

registerEntity('news', {
  read: (s) => `你阅读了《${s.name || '未命名文章'}》${newsSuffix(s, true)}`,
  saved: (s) => `你保存了《${s.name || '未命名文章'}》${newsSuffix(s, true)}`,
  skipped: (s) => `你跳过了《${s.name || '未命名文章'}》${newsSuffix(s, false)}`,
}, [], (s) => `聚合讯《${s.name || '一篇文章'}》有动态`);

// ==================== movie（影视） ====================

registerEntity('movie', {
  want: (s) => `你把《${s.name || '未知电影'}》加入想看`,
  watching: (s) => `你开始看《${s.name || '未知电影'}》`,
  watched: (s) => `你看完了《${s.name || '未知电影'}》`,
  rated: (s) => {
    const rating = Number(s.rating);
    const from = Number(s.extras?.fromRating);
    if (Number.isFinite(from) && from > 0 && Number.isFinite(rating) && rating > 0) {
      return `你把《${s.name || '未知电影'}》的评分从 ${from} 改为 ${rating}`;
    }
    return Number.isFinite(rating) && rating > 0
      ? `你给《${s.name || '未知电影'}》评了 ${rating} 分`
      : `你给《${s.name || '未知电影'}》评了分`;
  },
  reviewed: (s) => {
    const to = s.extras?.review || s.extras?.toReview;
    const from = s.extras?.fromReview;
    if (from && !to) return `你删掉了《${s.name || '未知电影'}》的影评`;
    if (from && to) return `你修改了《${s.name || '未知电影'}》的影评`;
    return `你写了《${s.name || '未知电影'}》的影评`;
  },
  deleted: (s) => `你删除了《${s.name || '未知电影'}》的影视记录`,
}, [], (s) => `《${s.name || '一部电影'}》的影视活动`);

// ==================== memo（备忘录；实际 entityType=task，注册 memo 别名） ====================

registerEntity('task', {
  added: (s) => `你添加了备忘录「${s.name || '未命名'}」`,
  edited: (s) => `你编辑了备忘录「${s.name || '未命名'}」`,
  completed: (s) => `你完成了备忘录「${s.name || '未命名'}」`,
  restored: (s) => `你恢复了备忘录「${s.name || '未命名'}」`,
  postponed: (s) => `你把备忘录「${s.name || '未命名'}」推迟了`,
  priority: (s) => `你调整了备忘录「${s.name || '未命名'}」的优先级`,
  deleted: (s) => `你删除了备忘录「${s.name || '未命名'}」`,
  due: (s) => (s.extras?.text ? String(s.extras.text) : `备忘录「${s.name || '未命名'}」今天到期`),
}, ['memo'], (s) => `备忘录「${s.name || '未命名'}」有更新`);

// ==================== favorites（收藏本；实际 entityType=favorite，注册 favorites 别名） ====================

registerEntity('favorite', {
  added: (s) => `你收藏了《${s.name || '未命名'}》`,
  edited: (s) => `你编辑了收藏《${s.name || '未命名'}》`,
  deleted: (s) => `你取消了收藏《${s.name || '未命名'}》`,
}, ['favorites'], (s) => `收藏《${s.name || '未命名'}》有更新`);

// ==================== belongings（归物本；实际 entityType=item，注册 belongings 别名） ====================

registerEntity('item', {
  added: (s) => `你登记了新物品《${s.name || '未命名'}》`,
  edited: (s) => `你编辑了物品《${s.name || '未命名'}》`,
  status: (s) => {
    const status = s.extras?.status ? String(s.extras.status) : '';
    switch (status) {
      case '闲置': return `你把《${s.name || '未命名'}》标记为闲置`;
      case '已转卖': return `你转卖了《${s.name || '未命名'}》`;
      case '已丢弃': return `你丢弃了《${s.name || '未命名'}》`;
      case '使用中': return `你重新用起了《${s.name || '未命名'}》`;
      default: return status ? `你把《${s.name || '未命名'}》标记为${status}` : `你更新了物品《${s.name || '未命名'}》的状态`;
    }
  },
  deleted: (s) => `你删除了《${s.name || '未命名'}》`,
}, ['belongings'], (s) => `物品《${s.name || '未命名'}》有更新`);

// ==================== pomodoro（番茄钟） ====================

registerEntity('pomodoro', {
  'focus-done': (s) => {
    const minutes = Number(s.duration ?? s.extras?.minutes);
    return Number.isFinite(minutes) && minutes > 0 ? `你用番茄钟完成了 ${minutes} 分钟专注` : '你完成了一次番茄专注';
  },
}, [], () => '番茄钟专注记录');

// ==================== chat（聊天；实际 entityType=chat_message，注册 chat 别名） ====================

registerEntity('chat_message', {
  said: (s) => {
    const content = s.extras?.content;
    return content ? `你说：${clip(content, 200)}` : '你说了一句话';
  },
}, ['chat'], (s) => {
  const content = s.extras?.content;
  return content ? `你说：${clip(content, 200)}` : '你说了一句话';
});

// ==================== library（书库；实际 entityType=book，注册 library 别名） ====================

registerEntity('book', {
  started: (s) => `你开始读《${s.name || '未知书'}》`,
  completed: (s) => `你读完了《${s.name || '未知书'}》`,
  progressed: (s) => {
    const percent = Number(s.progress ?? s.extras?.progress);
    const p = Number.isFinite(percent) && percent > 0 ? `（读到 ${percent}%）` : '';
    return `你读了《${s.name || '未知书'}》${p}`;
  },
  highlight: (s) => {
    const texts = s.extras?.texts as string[] | undefined;
    if (Array.isArray(texts) && texts.length) return `你在《${s.name || '未知书'}》划了 ${texts.length} 条重点`;
    const content = s.extras?.content ? `：「${clip(s.extras.content, 40)}」` : '';
    return `你在《${s.name || '未知书'}》划了条重点${content}`;
  },
  thought: (s) => {
    const texts = s.extras?.texts as string[] | undefined;
    if (Array.isArray(texts) && texts.length) return `你在《${s.name || '未知书'}》写了 ${texts.length} 条想法`;
    const content = s.extras?.content ? `：「${clip(s.extras.content, 40)}」` : '';
    return `你在《${s.name || '未知书'}》写了条想法${content}`;
  },
  added: (s) => `你把《${s.name || '未知书'}》加入了书架`,
  removed: (s) => `你把《${s.name || '未知书'}》移出了书架`,
}, ['library'], (s) => `《${s.name || '一本书'}》的书库活动`);

// ==================== diary（日记；实际 entityType=diary_entry，注册 diary 别名） ====================

registerEntity('diary_entry', {
  created: (s) => `你写了一篇日记${s.name ? `（${s.name}）` : ''}`,
  updated: (s) => `你更新了日记${s.name ? `（${s.name}）` : ''}`,
  deleted: (s) => `你删除了日记${s.name ? `（${s.name}）` : ''}`,
  tagged: (s) => `你调整了日记${s.name ? `（${s.name}）` : ''}的标签`,
}, ['diary'], (s) => `日记${s.name ? `（${s.name}）` : ''}有更新`);

// ==================== letter（信） ====================

registerEntity('letter', {
  created: (s) => `你写了一封信「${s.name || '未命名'}」`,
  updated: (s) => `你修改了信「${s.name || '未命名'}」`,
  deleted: (s) => `你删除了信「${s.name || '未命名'}」`,
}, [], (s) => `信「${s.name || '未命名'}」有更新`);

// ==================== poem（现代诗） ====================

registerEntity('poem', {
  created: (s) => `你写了一首现代诗「${s.name || '未命名'}」`,
  updated: (s) => `你修改了现代诗「${s.name || '未命名'}」`,
  deleted: (s) => `你删除了现代诗「${s.name || '未命名'}」`,
}, [], (s) => `现代诗「${s.name || '未命名'}」有更新`);

// ==================== flash（卡片盒） ====================

registerEntity('flash', {
  created: (s) => `你在卡片盒记下了「${s.name || '未命名'}」`,
  updated: (s) => `你修改了卡片盒「${s.name || '未命名'}」`,
  deleted: (s) => `你删除了卡片盒「${s.name || '未命名'}」`,
}, [], (s) => `卡片盒「${s.name || '未命名'}」有更新`);

// ==================== reflection（反思/日小结） ====================

registerEntity('reflection', {
  insight: () => '小橘产生了一条新洞察',
  digest: () => '小橘生成了今日小结',
}, [], () => '小橘有新的反思');

// ==================== weekly-report / dossier（小橘系统产物） ====================

registerEntity('weekly-report', {
  generated: () => '小橘生成了本周懂你报告',
}, [], () => '小橘生成了本周懂你报告');

registerEntity('dossier', {
  generated: () => '小橘整理了我们的相处故事',
}, [], () => '小橘整理了我们的相处故事');

// ==================== secondbrain（第二大脑） ====================

WORDING['secondbrain:*'] = (s) => (s.name ? `你在第二大脑记录了「${s.name}」` : '你在第二大脑有新的记录');

// ==================== literature（文献盒：视频转文献 + 术语生成，ADR-0066/0072） ====================

registerEntity('literature', {
  converted: (s) => `你把《${s.name || '一部视频'}》转成了文献`,
  'term-generated': (s) => `你为「${s.name || '一个术语'}」生成了一篇术语文献`,
}, ['literature'], (s) => `文献动态：${s.name || '一部视频'}`);

// ==================== ADR-0069 行为流全量盘点补齐（新增实体模板） ====================

// （clipping 实体模板已移除，2026-08-29 用户拍板断开剪藏删除行为记录；created/modify 由 news 保存流覆盖）

// ==================== review（复习计划；规则就绪待域事件接线） ====================

registerEntity('review', {
  started: () => '你开始了复习',
  added: (s) => `你把《${s.name || '未命名'}》加入了复习计划`,
  removed: (s) => `你把《${s.name || '未命名'}》移出了复习计划`,
  rated: (s) => {
    const rating = s.extras?.rating ? String(s.extras.rating) : '';
    const suffix = rating === 'again' ? '（忘了）'
      : rating === 'hard' ? '（困难）'
      : rating === 'good' ? '（一般）'
      : rating === 'easy' ? '（简单）' : '';
    return `你给《${s.name || '未命名'}》完成了复习评分${suffix}`;
  },
}, [], (s) => `复习计划《${s.name || '未命名'}》有更新`);

// ==================== quiz（题库；规则就绪待域事件接线） ====================

registerEntity('quiz', {
  added: (s) => `你把「${s.name || '未命名'}」加入了题库`,
  answered: (s) => {
    const ok = s.extras?.correct;
    const suffix = ok === true ? '，答对了' : ok === false ? '，答错了' : '';
    return `你回答了题目「${s.name || '未命名'}」${suffix}`;
  },
}, [], (s) => `题库「${s.name || '未命名'}」有更新`);

// ==================== launcher（入口页；规则就绪待域事件接线） ====================

registerEntity('launcher', {
  opened: () => '你打开了入口页',
}, [], () => '入口页有动态');

// ==================== attach（附件搬移；规则就绪待域事件接线） ====================

registerEntity('attach', {
  moved: (s) => {
    const n = Number(s.count ?? s.extras?.count);
    return Number.isFinite(n) && n > 0 ? `你搬移了当前笔记引用的 ${n} 个附件` : '你搬移了当前笔记引用的附件';
  },
}, [], () => '附件搬移记录');

/**
 * 行为流条目 → 人类文案（渲染时生成，纯函数）。
 * 1) 有 structured（metadata.entityType）→ 按 `entityType:action` 精确模板 → 实体级默认（`entityType:*`）；
 * 2) 无模板命中 → 兜底旧式 `source:action 名称`；
 * 3) 无 structured（legacy 兜底条目）→ 直接回显存储描述。
 */
export function buildBehaviorWording(item: BehaviorItem): string {
  const meta = (item.metadata ?? null) as StructuredMeta | null;
  if (!meta || typeof meta.entityType !== 'string' || !meta.entityType) {
    return item.description || `${item.source}:${item.type}`;
  }
  const action = typeof meta.action === 'string' && meta.action ? meta.action : item.type;
  const gen = WORDING[`${meta.entityType}:${action}`] ?? WORDING[`${meta.entityType}:*`];
  if (gen) return gen(meta);
  return `${item.source}:${action}${meta.name ? ` ${meta.name}` : ''}`;
}

/**
 * 行为 type（action）中文徽标词（ticket 129：type 徽标保留但文案化，如 saved→「保存」、
 * skipped→「跳过」；未知词回显原值）。
 */
export const ACTION_WORD_LABELS: Record<string, string> = {
  created: '创建', updated: '更新', deleted: '删除',
  saved: '保存', read: '阅读', skipped: '跳过',
  added: '添加', edited: '编辑', completed: '完成', restored: '恢复',
  postponed: '改期', priority: '调整优先级', due: '到期',
  want: '想看', watching: '在看', watched: '看完', rated: '评分', reviewed: '影评',
  status: '状态', 'focus-done': '专注', said: '说过',
  started: '开始读', progressed: '在读', highlight: '划线', thought: '想法', removed: '移出',
  insight: '洞察', digest: '小结', generated: '生成', unknown: '活动',
  tagged: '标签', opened: '打开', moved: '搬移', answered: '答题',
};

/** action → 中文徽标词（未知回显原值） */
export function behaviorActionWord(action: string): string {
  return ACTION_WORD_LABELS[action] || action;
}