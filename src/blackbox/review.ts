/**
 * 黑匣子复盘模块（ticket 37）：静默生长 + 手动触发。
 * 自动触发（录入后阈值命中）：不弹窗、不通知、不打扰——生成产物写入 reviews + 人格档案生长；
 * 手动触发（bz-blackbox-review）：产物公开写入对话面板，toast 轻反馈。
 */
import type { App } from 'obsidian';
import { notice } from '../core/notice';
import { tryGetSettings } from '../core/settings-provider';
import { BlackBoxAI } from './ai';
import { BlackBoxDataManager } from './data';
import type { BlackBoxData } from './types';

let dataManager: BlackBoxDataManager | null = null;
/** 复盘 in-flight 标志：防止阈值连续命中/手动+自动并发触发多份复盘互相覆盖 */
let reviewing = false;

function manager(app: App): BlackBoxDataManager {
  if (!dataManager) dataManager = new BlackBoxDataManager(app);
  return dataManager;
}

function threshold(): number {
  const s = tryGetSettings() as any;
  const n = Number(s && s.blackboxReviewThreshold);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** 执行复盘：AI 读最近 threshold 条感触 → 产物落盘（reviews + selfViews 生长）
 * 写前重载：AI 调用（长耗时）期间可能已有其他写入（新感触/对话），陈旧快照整体写回会覆盖丢数据。 */
async function runReview(app: App, data: BlackBoxData, silent: boolean): Promise<{ ok: boolean; text: string }> {
  if (reviewing) return { ok: false, text: '' }; // 复盘已在途，跳过本次触发
  reviewing = true;
  const m = manager(app);
  const ai = new BlackBoxAI();
  try {
    const t = threshold();
    const result = await ai.review(data, t);
    // 写前重载最新数据，再落盘
    const latest = await m.load();
    await m.addReview(latest, {
      ts: new Date().toISOString(),
      text: result.text,
      impressionCount: Math.min(t, latest.impressions.length),
      newSelfView: result.newSelfView,
    });
    // 产物公开写入对话面板：追加为 assistant 消息（打开对话时可见，不弹窗不通知）
    await m.addChat(latest, 'assistant', result.text, new Date().toISOString());
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
  if (data.impressions.length === 0) {
    notice('⚠️ 黑匣子还是空的，先写几条感触吧');
    return '';
  }
  const r = await runReview(app, data, false);
  return r.text;
}

/** 卸载清理（onunload/测试重置）：清空模块级 manager 防跨实例残留 */
export function unloadBlackBoxReview(): void {
  dataManager = null;
}
