/**
 * smartcat 数据层（用户拍板：所有数据存在一个 json——CONFIG/STORAGE/smartcat.json）
 * 一次性迁移：首次加载缺失时读旧 localStorage 3 key + 旧 CONFIG/SMART CAT 3 文件 +
 * 旧 CONFIG/SMART_CAT/memories 4 层 → 合并写回单文件；旧数据源保留不删（防回滚）。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { defaultConfig, normalizeConfig } from './config';
import type { SmartCatData } from './types';

export const SMARTCAT_FILE = 'smartcat.json';

/** smartcat.json 路径（跟随共享 storagePath） */
export function getSmartcatFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/${SMARTCAT_FILE}`;
}

/** 默认全量数据（config 默认 + mood/人格成长默认 + 记忆四层默认） */
export function defaultSmartCatData(): SmartCatData {
  return {
    config: defaultConfig(),
    mood: {
      dimensions: { happiness: 75, energy: 65, curiosity: 60, affection: 50, focus: 80, creativity: 70, productivity: 75, relaxation: 60 },
      lastUpdate: 0,
      lastMood: 'neutral',
    },
    personalityGrowth: {
      traits: { playfulness: 50, sociability: 50, independence: 50, curiosity: 50 },
      growthHistory: [],
      lastSave: 0,
      version: '1.0',
    },
    emotionalMemory: null,
    timeEmotion: null,
    editingData: null,
    memory: {
      shortTerm: { version: '1.0', lastUpdated: new Date().toISOString(), memories: [], maxSize: 100, sessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` },
      longTerm: { version: '1.0', lastUpdated: new Date().toISOString(), memories: [], maxSize: 500, consolidationCount: 0 },
      permanent: { version: '1.0', lastUpdated: new Date().toISOString(), memories: [], protected: true },
      index: { version: '1.0', lastUpdated: new Date().toISOString(), memories: [], timeIndex: {}, topicIndex: {}, emotionIndex: {}, usageStats: {} },
    },
  };
}

/** 归一化（config 走 normalizeConfig；其余字段类型兜底） */
export function normalizeData(raw: any): SmartCatData {
  const def = defaultSmartCatData();
  if (!raw || typeof raw !== 'object') return def;
  return {
    config: normalizeConfig(raw.config || raw), // 兼容旧布局：整个文件即 config
    mood: {
      dimensions: { ...def.mood.dimensions, ...(raw.mood?.dimensions || {}) },
      lastUpdate: typeof raw.mood?.lastUpdate === 'number' ? raw.mood.lastUpdate : def.mood.lastUpdate,
      lastMood: typeof raw.mood?.lastMood === 'string' ? raw.mood.lastMood : def.mood.lastMood,
    },
    personalityGrowth: raw.personalityGrowth
      ? { ...def.personalityGrowth, ...raw.personalityGrowth }
      : def.personalityGrowth,
    emotionalMemory: raw.emotionalMemory ?? def.emotionalMemory,
    timeEmotion: raw.timeEmotion ?? def.timeEmotion,
    editingData: raw.editingData ?? def.editingData,
    memory: raw.memory
      ? {
          shortTerm: raw.memory.shortTerm || def.memory.shortTerm,
          longTerm: raw.memory.longTerm || def.memory.longTerm,
          permanent: raw.memory.permanent || def.memory.permanent,
          index: raw.memory.index || def.memory.index,
        }
      : def.memory,
  };
}

/** 读取数据（不存在/坏 JSON → 尝试迁移旧数据，再默认数据） */
export async function loadSmartCatData(app: App): Promise<SmartCatData> {
  const filePath = getSmartcatFilePath();
  const f = app.vault.getAbstractFileByPath(filePath);
  if (f) {
    try {
      return normalizeData(JSON.parse(await app.vault.read(f as any)));
    } catch (e) {
      return defaultSmartCatData();
    }
  }
  // 首次：尝试迁移旧数据源
  const migrated = await tryMigrateLegacy(app);
  if (migrated) return migrated;
  return defaultSmartCatData();
}

/** 保存（存在 modify / 不存在 create，建目录兜底） */
export async function saveSmartCatData(app: App, data: SmartCatData): Promise<void> {
  const filePath = getSmartcatFilePath();
  const c = JSON.stringify(data, null, 2);
  const f = app.vault.getAbstractFileByPath(filePath);
  if (f) {
    await app.vault.modify(f as any, c);
  } else {
    const d = filePath.substring(0, filePath.lastIndexOf('/'));
    if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
    await app.vault.create(filePath, c);
  }
}

// ---------------- 一次性迁移 ----------------

/** 读 localStorage（try/catch：jsdom/node 环境无 localStorage 安全返回） */
function getLocal(key: string): any {
  try {
    const v = (typeof localStorage !== 'undefined' && localStorage.getItem(key)) || '';
    return v ? JSON.parse(v) : null;
  } catch (e) {
    return null;
  }
}

/** 读旧 vault 文件（不存在/坏 JSON → null） */
async function readLegacy(app: App, path: string): Promise<any> {
  try {
    const f = app.vault.getAbstractFileByPath(path);
    if (!f) return null;
    return JSON.parse(await app.vault.read(f as any));
  } catch (e) {
    return null;
  }
}

/**
 * 迁移旧数据（仅当目标 json 不存在时调用）：
 * localStorage 'smart-cat-config' / 'smart-cat-mood-data' / 'smart-cat-personality-growth'
 * + CONFIG/SMART CAT/{smart-cat-emotional-memory, smart-cat-time-emotion, smart-cat-editing-data}.json
 * + CONFIG/SMART_CAT/memories/{short_term, long_term, permanent, memory_index}.json
 * apiKey 忽略（AI 走 bz）。成功写盘返回 true。
 */
export async function tryMigrateLegacy(app: App): Promise<SmartCatData | null> {
  const cfg = getLocal('smart-cat-config');
  const mood = getLocal('smart-cat-mood-data');
  const pGrowth = getLocal('smart-cat-personality-growth');
  const emo = await readLegacy(app, 'CONFIG/SMART CAT/smart-cat-emotional-memory.json');
  const time = await readLegacy(app, 'CONFIG/SMART CAT/smart-cat-time-emotion.json');
  const edit = await readLegacy(app, 'CONFIG/SMART CAT/smart-cat-editing-data.json');
  const memDir = 'CONFIG/SMART_CAT/memories/';
  const memLayers: Record<string, any> = {};
  for (const layer of ['short_term', 'long_term', 'permanent', 'memory_index']) {
    memLayers[layer] = await readLegacy(app, memDir + layer + '.json');
  }
  // 无任何旧数据 → 不迁移
  if (!cfg && !mood && !pGrowth && !emo && !time && !edit &&
      !memLayers.short_term && !memLayers.long_term && !memLayers.permanent && !memLayers.memory_index) {
    return null;
  }
  const def = defaultSmartCatData();
  const legacyCfg = cfg ? { ...cfg } : null;
  // apiKey 忽略（AI 走 bz core/ai，用户拍板；旧值不迁移）
  if (legacyCfg && legacyCfg.apiKey !== undefined) delete legacyCfg.apiKey;
  const data: SmartCatData = normalizeData({
    config: legacyCfg || def.config,
    mood: mood || def.mood,
    personalityGrowth: pGrowth || def.personalityGrowth,
    emotionalMemory: emo || def.emotionalMemory,
    timeEmotion: time || def.timeEmotion,
    editingData: edit || def.editingData,
    memory: {
      shortTerm: memLayers.short_term || def.memory.shortTerm,
      longTerm: memLayers.long_term || def.memory.longTerm,
      permanent: memLayers.permanent || def.memory.permanent,
      index: memLayers.memory_index || def.memory.index,
    },
  });
  await saveSmartCatData(app, data);
  return data;
}