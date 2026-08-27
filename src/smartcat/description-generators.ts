/**
 * 描述生成器注册表（P2a 创作/情感域 StructuredMeta 适配，ticket 123）
 *
 * 策略模式：按 entityType 分派生成自然中文描述文本，替代 buildDescription 的
 * `[entityType] action name` 兜底。memory.ts 的 buildDescription 优先取
 * structured.snapshot.summary——过渡期由 index.ts 接线处先调 generateDescription
 * 产出 summary 写入 structured.snapshot.summary，memory.ts 自然拾取。
 *
 * P2 正式化时改为注册表直连 memory.ts，消除 snapshot 中转。
 */
import type { StructuredMeta } from './types';

// ==================== 生成器注册表 ====================

type Generator = (s: StructuredMeta) => string;

const generators: Record<string, Generator> = {};

/** 注册 entityType → 生成器 */
function register(entityType: string, gen: Generator): void {
  generators[entityType] = gen;
}

// ==================== movie（影视） ====================

register('movie', (s) => {
  const name = s.name || '未知电影';
  const rated = (s.rating != null && s.rating > 0) ? `，给了 ${s.rating} 分` : '';
  const review = (s.extras?.review || s.extras?.toReview) ? `，写了影评：${String(s.extras?.review || s.extras?.toReview).slice(0, 80)}` : '';
  switch (s.action) {
    case 'want':
      return `你把《${name}》加入想看`;
    case 'watching':
      return `你开始看《${name}》`;
    case 'watched':
      return `你看完了《${name}》${rated}${review}`;
    case 'rated': {
      const fromRating = s.extras?.fromRating;
      const hasFrom = fromRating != null && fromRating > 0;
      return hasFrom
        ? `你把《${name}》的评分从 ${fromRating} 改为 ${s.rating}`
        : `你给《${name}》评了 ${s.rating} 分`;
    }
    case 'reviewed': {
      const fromReview = s.extras?.fromReview as string | undefined;
      const toReview = (s.extras?.review || s.extras?.toReview) as string | undefined;
      const from = fromReview || null;
      const to = toReview || null;
      if (!from && to) return `你写了《${name}》的影评：${to.slice(0, 80)}`;
      if (from && to) return `你改了《${name}》的影评：${to.slice(0, 80)}`;
      if (from && !to) return `你删掉了《${name}》的影评`;
      return `你写了《${name}》的影评`;
    }
    case 'deleted':
      return `你删除了《${name}》的影视记录`;
    default:
      return `《${name}》的影视活动`;
  }
});

// ==================== book（书库） ====================

register('book', (s) => {
  const name = s.name || '未知书';
  const progress = s.progress != null ? `（读到 ${s.progress}%）` : '';
  const duration = s.duration != null ? `约 ${s.duration} 分钟` : '';
  switch (s.action) {
    case 'started':
      return `你开始读《${name}》`;
    case 'completed':
      return `你读完了《${name}》`;
    case 'progressed':
      return duration
        ? `你读了《${name}》${duration}${progress}`
        : `你读了《${name}》${progress || ''}`;
    case 'highlight': {
      const texts = s.extras?.texts as string[] | undefined;
      const content = s.extras?.content as string | undefined;
      // 划线+想法合并文案（对齐 buildLibraryNoteText 格式）
      const hlTexts = (s.extras?.highlights as string[] | undefined) || texts;
      const exTexts = s.extras?.excerpts as string[] | undefined;
      const parts: string[] = [];
      if (hlTexts && hlTexts.length > 0) {
        parts.push(hlTexts.length === 1 ? '划了条重点：「' + hlTexts[0] + '」' : '划了 ' + hlTexts.length + ' 条重点：「' + hlTexts.join('」、「') + '」');
      }
      if (exTexts && exTexts.length > 0) {
        parts.push(exTexts.length === 1 ? '写了条想法：「' + exTexts[0] + '」' : '写了 ' + exTexts.length + ' 条想法：「' + exTexts.join('」、「') + '」');
      }
      if (parts.length > 0) return '你在《' + name + '》' + parts.join('；');
      if (content) return `你在《${name}》划了条重点：「${content}」`;
      return `你在《${name}》划了条重点`;
    }
    case 'thought': {
      const texts = s.extras?.texts as string[] | undefined;
      const content = s.extras?.content as string | undefined;
      if (texts && texts.length > 0) {
        return texts.length === 1
          ? `你在《${name}》写了条想法：「${texts[0]}」`
          : `你在《${name}》写了 ${texts.length} 条想法：「${texts.join('」、「')}」`;
      }
      if (content) return `你在《${name}》写了条想法：「${content}」`;
      return `你在《${name}》写了条想法`;
    }
    case 'added':
      return `你把《${name}》加入了书架`;
    case 'removed':
      return `你把《${name}》移出了书架`;
    default:
      return `《${name}》的书库活动`;
  }
});

// ==================== diary_entry（日记） ====================

register('diary_entry', (s) => {
  // snapshot.summary 优先——P2c 层会提供更丰富的摘要；此处生成器作为
  // structured 中 snapshot.summary 的产出者（过渡期由 index.ts 接线处调用）。
  if (s.snapshot?.summary) return s.snapshot.summary;

  const name = s.name || '未知时间';
  const tags = s.tags && s.tags.length > 0 ? s.tags.join('、') : '';
  const bodySnippet = s.extras?.body
    ? `：${String(s.extras.body).slice(0, 200)}`
    : '';

  switch (s.action) {
    case 'created':
      return tags
        ? `你在 ${name} 写了一篇日记（分类：${tags}）${bodySnippet}`
        : `你在 ${name} 写了一篇日记${bodySnippet}`;
    case 'updated':
      return tags
        ? `你更新了日记（${name}，分类：${tags}）${bodySnippet}`
        : `你更新了日记（${name}）${bodySnippet}`;
    case 'deleted':
      return `你删除了 ${name} 的日记`;
    default:
      return `日记记录（${name}）`;
  }
});

// ==================== letter（信） ====================

register('letter', (s) => {
  const name = s.name || '未命名信';
  const date = s.extras?.date || '';
  const body = s.extras?.body ? `：${String(s.extras.body)}` : '';
  switch (s.action) {
    case 'created':
      return date
        ? `你在 ${date} 写了一封信「${name}」${body}`
        : `你写了一封信「${name}」${body}`;
    case 'updated':
      return `你修改了信「${name}」${body}`;
    case 'deleted':
      return `你删除了信「${name}」`;
    default:
      return `信「${name}」的活动`;
  }
});

// ==================== poem（现代诗） ====================

register('poem', (s) => {
  const name = s.name || '未命名诗';
  const date = s.extras?.date || '';
  const body = s.extras?.body ? `：${String(s.extras.body)}` : '';
  switch (s.action) {
    case 'created':
      return date
        ? `你在 ${date} 写了一首现代诗「${name}」${body}`
        : `你写了一首现代诗「${name}」${body}`;
    case 'updated':
      return `你修改了现代诗「${name}」${body}`;
    case 'deleted':
      return `你删除了现代诗「${name}」`;
    default:
      return `现代诗「${name}」的活动`;
  }
});

// ==================== chat_message（聊天） ====================

register('chat_message', (s) => {
  const content = s.extras?.content as string | undefined;
  if (!content) return '你说了一句话';
  // 聊天消息截断：保留前 200 字
  const truncated = content.length > 200 ? content.slice(0, 200) + '…' : content;
  return `你说：${truncated}`;
});

// ==================== insight（洞察） ====================

register('insight', (s) => {
  if (s.name) return `产生了洞察：${s.name}`;
  const content = s.extras?.content as string | undefined;
  if (content) return `产生了洞察：${content}`;
  return '产生了一条洞察';
});

// ==================== flash（卡片盒） ====================

register('flash', (s) => {
  const name = s.name || '未命名';
  const body = s.extras?.body ? `：「${String(s.extras.body)}」` : '';
  switch (s.action) {
    case 'created':
      return `你在卡片盒记下了「${name}」${body}`;
    case 'updated':
      return `你修改了卡片盒「${name}」${body}`;
    case 'deleted':
      return `你删除了卡片盒「${name}」`;
    default:
      return `卡片盒「${name}」的活动`;
  }
});

// ==================== 兜底生成器 ====================

/** 兜底描述：对未知 entityType 使用 [entityType] action name 格式 */
export function generateFallbackDescription(s: StructuredMeta): string {
  const name = s.name ? ` ${s.name}` : '';
  return `[${s.entityType}] ${s.action}${name}`;
}

// ==================== 主入口 ====================

/**
 * 根据 StructuredMeta 生成自然中文描述文本。
 * 优先使用注册的 entityType 生成器；未知类型回退 generateFallbackDescription。
 *
 * 过渡期用法：index.ts 接线处调用本函数，将返回值写入 structured.snapshot.summary，
 * memory.ts 的 buildDescription（snapshot.summary 优先）自然拾取。
 *
 * P2 正式化时：memory.ts buildDescription 直接调用本注册表，消除 snapshot 中转。
 */
export function generateDescription(structured: StructuredMeta): string {
  // 优先使用已有的 snapshot.summary（由 settle 层生成的 diff/首落文本）
  if (structured.snapshot?.summary) return structured.snapshot.summary;
  const gen = generators[structured.entityType];
  if (gen) return gen(structured);
  return generateFallbackDescription(structured);
}
