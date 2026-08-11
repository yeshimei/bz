/**
 * 黑匣子复盘模块（ticket 37/41/42）：静默生长 + 手动触发。
 * v2 复盘产物：人格档案更新（text/newSelfView）+ 事件提炼（AI 全自动，推测标记，edited 锁）
 * + 画像观察增量（AI 持续写入 aiObservations，不覆盖用户印象）+ 新人物提示 + 事件汇报一句话。
 * 自动触发（录入后阈值命中）：不弹窗、不通知、不打扰——产物写入 reviews + 人格档案生长 + 对话流；
 * 手动触发（bz-blackbox-review）：产物公开写入对话面板，toast 轻反馈。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { BlackBoxAI } from './ai';
import type { ExtractedEvent } from './ai';
import { BlackBoxDataManager, createEvent } from './data';
import {
  buildEventReport,
  findProfileHints,
  resolveReviewThreshold,
  sanitizePeople,
  MAX_PEOPLE,
} from './types';
import type { BlackBoxData, EventItem, Profile } from './types';

let dataManager: BlackBoxDataManager | null = null;
/** 复盘 in-flight 标志：防止阈值连续命中/手动+自动并发触发多份复盘互相覆盖 */
let reviewing = false;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

/** 新人物提示文案（纯函数） */
export function buildProfileHintText(names: string[]): string {
  if (!names.length) return '';
  return `👤 我常听你提起「${names.join('、')}」，要不要为 TA 建一张画像？`;
}

/**
 * 事件合并（纯函数）：提炼结果 → 落库事件。
 * 去重：标题重复跳过；证据条目全部已被既有事件覆盖跳过。
 * 人物名字 → 画像 id（精确匹配）；无人物时回退主角；时间用 AI 值，缺省用最早证据条目日期。
 */
export function mergeExtractedEvents(data: BlackBoxData, extracted: ExtractedEvent[]): EventItem[] {
  const out: EventItem[] = [];
  const covered = new Set<string>(); // 已被既有事件覆盖的证据条目
  for (const ev of data.events) for (const id of ev.evidence) covered.add(id);
  const byId = new Map(data.entries.map((e) => [e.id, e]));
  for (const ex of extracted) {
    const title = ex.title.trim();
    if (!title) continue;
    // 去重 1：标题重复（既有事件）
    if (data.events.some((ev) => ev.title === title)) continue;
    // 去重 2：证据条目需真实存在；全部已被覆盖则跳过
    const evidence = ex.evidence.filter((id) => byId.has(id));
    if (!evidence.length) continue;
    if (evidence.every((id) => covered.has(id))) continue;
    const people = sanitizePeople(resolvePeople(ex.people, data.profiles));
    const mainPerson = resolvePerson(ex.mainPerson, data.profiles);
    const time =
      ex.time && /^\d{4}-\d{2}-\d{2}$/.test(ex.time)
        ? ex.time
        : evidence
            .map((id) => (byId.get(id)!.createdAt || '').slice(0, 10))
            .filter(Boolean)
            .sort()[0] || '';
    out.push(
      createEvent({
        title,
        summary: ex.summary,
        time,
        inferred: ex.inferred,
        people: people.length ? people : mainPerson ? [mainPerson] : [],
        mainPerson,
        evidence,
        emotions: ex.emotions,
      })
    );
    for (const id of evidence) covered.add(id);
  }
  return out;
}

/** 人物名字 → 画像 id（精确匹配名字；虚拟角色/纯名字保留原样） */
function resolvePeople(names: string[], profiles: Profile[]): string[] {
  const out: string[] = [];
  for (const n of names || []) {
    if (!n) continue;
    if (n.startsWith('pf_')) {
      out.push(n);
      continue;
    }
    const pf = profiles.find((p) => p.name === n);
    out.push(pf ? pf.id : n);
  }
  return out;
}

function resolvePerson(name: string, profiles: Profile[]): string {
  if (!name) return '';
  if (name.startsWith('pf_')) return name;
  const pf = profiles.find((p) => p.name === name);
  return pf ? pf.id : name;
}

/** 执行复盘：AI 读最近 threshold 条条目 → 复盘产物 + 事件提炼 + 画像观察 → 落盘（reviews + selfViews 生长 + 对话流）
 * 写前重载：AI 调用（长耗时）期间可能已有其他写入（新感触/对话），陈旧快照整体写回会覆盖丢数据。 */
async function runReview(app: App, data: BlackBoxData, silent: boolean): Promise<{ ok: boolean; text: string }> {
  if (reviewing) return { ok: false, text: '' }; // 复盘已在途，跳过本次触发
  reviewing = true;
  const m = manager(app);
  const ai = new BlackBoxAI();
  try {
    const t = resolveReviewThreshold(data, tryGetSettings() as any);
    const result = await ai.review(data, t);
    // 写前重载最新数据，再落盘
    const latest = await m.load();
    const ts = new Date().toISOString();

    // 事件提炼（部分失败不阻断复盘：单条失败不影响已保存内容）
    let eventReport = '';
    try {
      const extracted = await ai.extractEvents(latest, t);
      const fresh = await m.load();
      const newEvents = mergeExtractedEvents(fresh, extracted);
      if (newEvents.length) {
        fresh.events.push(...newEvents);
        const spec = newEvents.filter((e) => e.inferred).length;
        eventReport = buildEventReport(newEvents.length, spec);
        await m.save(fresh);
      }
    } catch (e) {
      console.warn('黑匣子事件提炼失败（复盘继续）', e);
    }

    // 画像观察增量（AI 持续写入 aiObservations，不覆盖用户印象；上限 5 条裁旧）
    try {
      const fresh = await m.load();
      const recent = fresh.entries.slice(-t);
      for (const pf of fresh.profiles) {
        const related = recent.filter((e) => e.people.includes(pf.id) || e.people.includes(pf.name));
        if (!related.length) continue;
        const observation = await ai.observeProfile(pf, related);
        if (!observation) continue;
        const fresh2 = await m.load();
        const target = fresh2.profiles.find((p) => p.id === pf.id);
        if (target) {
          target.aiObservations.push(observation);
          if (target.aiObservations.length > 5) target.aiObservations = target.aiObservations.slice(-5);
          await m.save(fresh2);
        }
      }
    } catch (e) {
      console.warn('黑匣子画像观察失败（复盘继续）', e);
    }

    // 新人物提示（高频提及未建画像的人；程序计算，确定性）
    const latest2 = await m.load();
    const hints = findProfileHints(latest2.entries.slice(-t), latest2.profiles);
    const profileHint = buildProfileHintText(hints);

    await m.addReview(latest2, {
      ts,
      text: result.text,
      impressionCount: Math.min(t, latest2.entries.length),
      newSelfView: result.newSelfView,
      eventReport: eventReport || undefined,
      profileHint: profileHint || undefined,
    });
    // 产物公开写入对话面板：追加为 assistant 消息（打开对话时可见，不弹窗不通知）
    const chatLines: string[] = [result.text];
    if (eventReport) chatLines.push(eventReport);
    if (profileHint) chatLines.push(profileHint);
    for (const line of chatLines) {
      await m.addChat(latest2, 'assistant', line, new Date().toISOString());
    }
    if (!silent) notice('✅ 包仔复盘完成');
    return { ok: true, text: result.text };
  } catch (e) {
    if (!silent) notice('❌ 复盘失败：AI 暂时无法说话', 'error');
    console.warn('黑匣子复盘失败', e);
    return { ok: false, text: '' };
  } finally {
    reviewing = false;
  }
}

/**
 * 自动静默复盘（录入后阈值命中调用）：静默执行，失败不打扰。
 * 返回产物文本（UI 层可公开显示）。
 */
export async function triggerAutoReview(app: App, data: BlackBoxData): Promise<string> {
  const r = await runReview(app, data, true);
  return r.text;
}

/** 手动复盘（bz-blackbox-review 命令）：产物公开，toast 反馈 */
export async function manualReview(app: App): Promise<string> {
  const m = manager(app);
  const data = await m.load();
  if (data.entries.length === 0) {
    notice('⚠️ 黑匣子还是空的，先写点东西吧');
    return '';
  }
  const r = await runReview(app, data, false);
  return r.text;
}

/** 卸载清理（onunload/测试重置）：清空模块级 manager 防跨实例残留 */
export function unloadBlackBoxReview(): void {
  dataManager = null;
}
