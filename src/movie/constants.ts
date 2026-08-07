/**
 * 影视常量与工具（ticket 14，源码逐字移植）
 */
export const STATUS_WANT = 0;
export const STATUS_WATCHING = 1;
export const STATUS_WATCHED = 2;

export const TYPE_GROUPS: Record<string, string[]> = {
  电影: ['电影'],
  剧集: ['国产剧', '美剧', '英剧', '德剧', '日剧', '韩剧'],
  动漫: ['日漫', '国漫', '美漫'],
  纪录片: ['纪录片'],
  公开课: ['公开课', 'TED'],
};

export const ALL_TAGS: string[] = Object.values(TYPE_GROUPS).flat();

export const TYPE_COLORS: Record<string, { light: string; dark: string }> = {
  电影: { light: '#FF9800', dark: '#FFA726' },
  剧集: { light: '#2196F3', dark: '#42A5F5' },
  动漫: { light: '#E91E63', dark: '#EC407A' },
  纪录片: { light: '#4CAF50', dark: '#66BB6A' },
  公开课: { light: '#9C27B0', dark: '#AB47BC' },
};

export function getTypeColor(group: string): string {
  const c = TYPE_COLORS[group] || { light: '#95a5a6', dark: '#95a5a6' };
  return document.body.classList.contains('theme-dark') ? c.dark : c.light;
}

export function getGroupForTag(tag: string): string | null {
  for (const [group, tags] of Object.entries(TYPE_GROUPS)) {
    if (tags.includes(tag)) return group;
  }
  return null;
}

export function getStarRating(rating: number): string {
  return '⭐'.repeat(Math.floor(rating));
}
