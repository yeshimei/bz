/**
 * 黑匣子提炼核心（ticket 59）：一次 AI 调用批量处理新增日记条目 → {people, events, emotions}。
 * 纯函数层：buildExtractPrompt（提示词）/ parseExtractJson（容错解析）/ applyExtraction（应用提炼）。
 * 降级：解析失败返回 null（调用方跳过重试）；永不拒收。
 */
import { classifyEventConfidence, dedupeEvent, mergeMention, shouldBuildProfile, sanitizeEmotions } from './types';
import { createEvent, createProfile } from './data';
import type { BlackBoxData, DiarySourceEntry } from './types';

/** AI 提炼返回结构 */
export interface ExtractResult {
  people: { name: string; aliases?: string[]; dates?: string[] }[];
  events: {
    title: string;
    confidence: number;
    emotion?: string;
    people?: string[];
    date?: string;
    time?: string;
  }[];
  emotions: { entry: string; tags: string[] }[];
}

/** 构建批量提炼提示词（条目 → JSON 输出结构说明）；空条目返回 null */
export function buildExtractPrompt(entries: DiarySourceEntry[]): string | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const lines = entries.map((e) => {
    const head = `${e.date} ${e.time}`;
    const content = (e.content || '').slice(0, 500);
    return `- [${head}] ${content}`;
  });
  return `你是「包仔」，一个从用户日记中提炼人物、事件与情绪的分析助手。请阅读以下日记条目，提取：
1. people：条目中出现的真实人物（排除泛指称呼如「大家」「同事」；保留名字/称呼如「妈妈」「老张」），每条 {name, aliases, dates}（aliases 为该人物的其他称呼；dates 为该人物出现的条目日期 YYYY-MM-DD 去重列表）。
2. events：有具体行动/变化/时刻的事件（排除纯流水账），每条 {title, confidence(0-1，是否确为事件的自评), emotion(该事件主要情绪，从词表选：触动/温暖/喜悦/平静/释然/难过/孤独/委屈/焦虑/愤怒/敬佩/想念/遗憾/感激/害怕/心动/幸福/骄傲/迷茫/疲惫/厌烦/羞耻/嫉妒/希望), people(参与人物名), date(条目日期 YYYY-MM-DD), time(条目时间 HH:mm)}。
3. emotions：每条日记的情绪推断，{entry(格式 "YYYY-MM-DD HH:mm"), tags(1-3 个情绪词，从上面词表选；无法判断则空数组)}。

日记条目：
${lines.join('\n')}

只返回 JSON，格式：{"people":[{"name":"","aliases":[],"dates":[]}],"events":[{"title":"","confidence":0,"emotion":"","people":[],"date":"","time":""}],"emotions":[{"entry":"YYYY-MM-DD HH:mm","tags":[]}]}`;
}

/** 容错解析 AI 返回（剥离代码块包裹；损坏返回 null） */
export function parseExtractJson(text: string): ExtractResult | null {
  if (!text || typeof text !== 'string') return null;
  let t = text.trim();
  // 剥离 ```json ... ``` 包裹
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  // 只截取首个 { ... } 对象
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  t = t.slice(start, end + 1);
  let raw: any;
  try {
    raw = JSON.parse(t);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;

  const people: ExtractResult['people'] = [];
  if (Array.isArray(raw.people)) {
    for (const p of raw.people) {
      if (!p || typeof p !== 'object') continue;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      if (!name) continue;
      const aliases = Array.isArray(p.aliases)
        ? p.aliases.filter((a: any) => typeof a === 'string' && a.trim()).map((a: any) => a.trim())
        : [];
      const dates = Array.isArray(p.dates)
        ? p.dates.filter((d: any) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
        : [];
      if (people.some((x) => x.name === name)) continue;
      people.push({ name, aliases, dates });
    }
  }

  const events: ExtractResult['events'] = [];
  if (Array.isArray(raw.events)) {
    for (const ev of raw.events) {
      if (!ev || typeof ev !== 'object') continue;
      const title = typeof ev.title === 'string' ? ev.title.trim() : '';
      const confidence = typeof ev.confidence === 'number' && !Number.isNaN(ev.confidence) ? ev.confidence : 0;
      if (!title || confidence < 0.5) continue;
      events.push({
        title,
        confidence,
        emotion: typeof ev.emotion === 'string' ? ev.emotion : undefined,
        people: Array.isArray(ev.people) ? ev.people.filter((p: any) => typeof p === 'string' && p.trim()) : [],
        date: typeof ev.date === 'string' ? ev.date : undefined,
        time: typeof ev.time === 'string' ? ev.time : undefined,
      });
    }
  }

  const emotions: ExtractResult['emotions'] = [];
  if (Array.isArray(raw.emotions)) {
    for (const em of raw.emotions) {
      if (!em || typeof em !== 'object') continue;
      const entry = typeof em.entry === 'string' ? em.entry.trim() : '';
      if (!entry) continue;
      const tags = Array.isArray(em.tags) ? sanitizeEmotions(em.tags) : [];
      emotions.push({ entry, tags });
    }
  }

  return { people, events, emotions };
}

/** 在 entries 中查找条目（date+time 匹配） */
function findEntry(entries: DiarySourceEntry[], date?: string, time?: string): DiarySourceEntry | undefined {
  if (!date || !time) return undefined;
  return entries.find((e) => e.date === date && e.time === time);
}

/** 批次条目日期范围 */
function batchDateRange(entries: DiarySourceEntry[]): { first: string; last: string } {
  const dates = entries.map((e) => e.date).filter(Boolean).sort();
  if (dates.length === 0) return { first: '', last: '' };
  return { first: dates[0], last: dates[dates.length - 1] };
}

/**
 * 应用提炼结果到派生层（原地更新 data）：
 * - people → mentions 合并（count+1 + 日期范围扩展）；跨日期 ≥2 次 → 自动建画像（从 mentions 移除）
 * - events → 置信度分级入库（<0.5 丢弃）+ 标题+证据去重 + source 证据链绑定 + 情绪合并
 */
export function applyExtraction(data: BlackBoxData, result: ExtractResult, entries: DiarySourceEntry[]): void {
  if (!data || !result) return;
  const { first, last } = batchDateRange(entries);

  // ---- people → mentions / profiles ----
  for (const p of result.people || []) {
    const name = p.name;
    if (!name) continue;
    // 已有画像（同名）→ 只更新 mentionCount 与日期统计（humanEdited 锁：用户改过不更新 aliases）
    const existingProfile = data.profiles.find((pf) => pf.name === name);
    if (existingProfile) {
      const appearDates2 = p.dates && p.dates.length ? p.dates : [];
      const inc = appearDates2.length ? appearDates2.filter((d: string, i: number, arr: string[]) => arr.indexOf(d) === i).length : 1;
      existingProfile.mentionCount += Math.max(1, inc);
      if (last && last > existingProfile.lastSeen) existingProfile.lastSeen = last;
      if (first && (!existingProfile.firstSeen || first < existingProfile.firstSeen)) existingProfile.firstSeen = first;
      if (!existingProfile.humanEdited && p.aliases && p.aliases.length) {
        for (const a of p.aliases) if (!existingProfile.aliases.includes(a)) existingProfile.aliases.push(a);
      }
      continue;
    }
    // 合并 mentions（dates = AI 返回的出现日期，去重）
    const m = data.mentions.find((x) => x.name === name);
    const curFirst = m ? m.firstSeen : '';
    const curLast = m ? m.lastSeen : '';
    const appearDates = p.dates && p.dates.length ? p.dates : [first, last].filter(Boolean);
    const allDates = [curFirst, curLast, ...appearDates].filter((d) => typeof d === 'string' && d.length > 0);
    const mergedFirst = allDates.length ? allDates.reduce((a, b) => (a < b ? a : b)) : last;
    const mergedLast = allDates.length ? allDates.reduce((a, b) => (a > b ? a : b)) : first;
    // 出现次数 = 既有 + 本批出现数（AI 返回 dates 时按去重天数；缺省按 1 次保守计）
    const hasDates = Array.isArray(p.dates) && p.dates.length > 0;
    const appearCount = hasDates ? appearDates.filter((d: string, i: number, arr: string[]) => arr.indexOf(d) === i).length : 1;
    const count = (m ? m.count : 0) + Math.max(1, appearCount);
    if (m) {
      m.count = count;
      m.firstSeen = mergedFirst;
      m.lastSeen = mergedLast;
    } else {
      data.mentions.push({ name, count, firstSeen: mergedFirst, lastSeen: mergedLast });
    }
    // 跨日期 ≥2 → 建画像
    if (shouldBuildProfile(data.mentions, name)) {
      const profile = createProfile(name, mergedFirst);
      profile.mentionCount = count;
      profile.lastSeen = mergedLast;
      profile.firstSeen = mergedFirst;
      if (p.aliases && p.aliases.length) profile.aliases = p.aliases;
      data.profiles.push(profile);
      data.mentions = data.mentions.filter((x) => x.name !== name);
    }
  }

  // ---- events ----
  for (const ev of result.events || []) {
    // 置信度 <0.5 不入库（discard）
    if (classifyEventConfidence(ev.confidence) === 'discard') continue;
    const entry = findEntry(entries, ev.date, ev.time);
    const source = entry
      ? { path: entry.filename, lineNumber: entry.lineNumber, time: entry.time }
      : { path: '', lineNumber: 0, time: ev.time || '' };
    const dateIso = entry ? `${entry.date}T${entry.time}` : ev.date ? `${ev.date}T${ev.time || '00:00'}` : '';
    const candidate = createEvent(ev.title, dateIso, ev.confidence, source);
    if (ev.emotion) {
      candidate.emotions = sanitizeEmotions([...(candidate.emotions || []), ev.emotion]);
    }
    if (ev.people && ev.people.length) candidate.people = ev.people.slice(0, 5);
    if (dedupeEvent(data.events, candidate)) continue;
    data.events.push(candidate);
  }
}