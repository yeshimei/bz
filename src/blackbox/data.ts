/**
 * 黑匣子数据层（ticket 34）：blackbox.json v1 读写。
 * 文件不存在/解析失败 → 默认数据（懒创建：save 时建目录建文件）；
 * 路径跟随共享数据路径 storagePath（ADR-0009）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { generateId } from '../core/utils';
import type { BlackBoxData, ChatMsg, Impression, Persona, Review } from './types';
import { defaultBlackBoxData, shouldAutoReview } from './types';

/** 黑匣子数据文件路径（storagePath 优先，未注入回退默认；尾斜杠清理与全仓一致） */
export function getBlackBoxFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/blackbox.json`;
}

/** 容错归一：非法字段回退默认、数组过滤非法条目（不静默改用户数据，只防坏文件） */
function normalizeData(raw: any): BlackBoxData {
  const def = defaultBlackBoxData();
  if (!raw || typeof raw !== 'object') return def;
  const persona = normalizePersona(raw.persona);
  const impressions = Array.isArray(raw.impressions) ? raw.impressions.filter(isValidImpression) : [];
  const reviews = Array.isArray(raw.reviews) ? raw.reviews.filter(isValidReview) : [];
  const chat = Array.isArray(raw.chat) ? raw.chat.filter(isValidChatMsg) : [];
  return { version: 1, persona, impressions, reviews, chat };
}

function normalizePersona(raw: any): Persona {
  const def = defaultBlackBoxData().persona;
  if (!raw || typeof raw !== 'object') return def;
  const selfViews = Array.isArray(raw.selfViews)
    ? raw.selfViews.filter((v: any) => v && typeof v.ts === 'string' && typeof v.view === 'string')
    : [];
  return {
    name: typeof raw.name === 'string' && raw.name ? raw.name : def.name,
    seed: typeof raw.seed === 'string' && raw.seed ? raw.seed : def.seed,
    toneExample: typeof raw.toneExample === 'string' && raw.toneExample ? raw.toneExample : def.toneExample,
    selfViews,
  };
}

function isValidImpression(i: any): i is Impression {
  if (!i || typeof i !== 'object') return false;
  if (typeof i.id !== 'string' || typeof i.ts !== 'string') return false;
  if (typeof i.material !== 'string' || !i.material.trim()) return false;
  if (typeof i.feeling !== 'string' || !i.feeling.trim()) return false;
  if (!Array.isArray(i.emotions)) return false;
  if (!i.emotions.every((e: any) => e && typeof e.tag === 'string' && typeof e.intensity === 'number')) return false;
  return true;
}

function isValidReview(r: any): r is Review {
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.ts === 'string' &&
    typeof r.text === 'string' &&
    typeof r.impressionCount === 'number' &&
    typeof r.newSelfView === 'string'
  );
}

function isValidChatMsg(m: any): m is ChatMsg {
  return (
    !!m &&
    typeof m === 'object' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.text === 'string' &&
    typeof m.ts === 'string'
  );
}

export class BlackBoxDataManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** 读取数据（不存在/坏 JSON → 默认数据） */
  async load(): Promise<BlackBoxData> {
    const filePath = getBlackBoxFilePath();
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (!f) return defaultBlackBoxData();
    try {
      return normalizeData(JSON.parse(await this.app.vault.read(f as any)));
    } catch (e) {
      return defaultBlackBoxData();
    }
  }

  /** 保存（存在 modify / 不存在 create，建目录兜底） */
  async save(data: BlackBoxData): Promise<void> {
    const filePath = getBlackBoxFilePath();
    const c = JSON.stringify(data, null, 2);
    const f = this.app.vault.getAbstractFileByPath(filePath);
    if (f) {
      await this.app.vault.modify(f as any, c);
    } else {
      const d = filePath.substring(0, filePath.lastIndexOf('/'));
      if (d && !this.app.vault.getAbstractFileByPath(d)) {
        await this.app.vault.createFolder(d);
      }
      await this.app.vault.create(filePath, c);
    }
  }

  /** 新增感触；返回录入后的感触总数与是否应自动触发静默复盘 */
  async addImpression(data: BlackBoxData, imp: Impression): Promise<{ count: number; shouldReview: boolean }> {
    const s = tryGetSettings() as any;
    const threshold = Number(s && s.blackboxReviewThreshold) || 10;
    data.impressions.push(imp);
    await this.save(data);
    return { count: data.impressions.length, shouldReview: shouldAutoReview(data.impressions.length, threshold) };
  }

  /** 追加复盘记录（含新的自我认知，非空则同时生长人格档案） */
  async addReview(data: BlackBoxData, review: Review): Promise<void> {
    data.reviews.push(review);
    if (review.newSelfView) {
      data.persona.selfViews.push({ ts: review.ts, view: review.newSelfView });
    }
    await this.save(data);
  }

  /** 追加对话消息（保持最近 blackboxMaxHistory 条） */
  async addChat(data: BlackBoxData, role: 'user' | 'assistant', text: string, ts: string): Promise<void> {
    const s = tryGetSettings() as any;
    const max = Number(s && s.blackboxMaxHistory) || 20;
    data.chat.push({ role, text, ts });
    data.chat = data.chat.slice(-max);
    await this.save(data);
  }
}

/** 构造感触条目（id 生成 + 时间戳） */
export function createImpression(partial: Omit<Impression, 'id' | 'ts'>): Impression {
  return { ...partial, id: generateId('bb'), ts: new Date().toISOString() };
}
