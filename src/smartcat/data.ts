/**
 * smartcat 数据层（用户拍板：所有数据存在一个 json——CONFIG/STORAGE/smartcat.json；
 * 向量豁免单 json，独立 smartcat-memory-vectors.vec，ADR-0021）。
 * ADR-0021：删除原四层记忆与一次性迁移路径（无数据产生，用户拍板不做迁移兼容），
 * memory 段改为单层记忆流 MemoryStream；旧 localStorage/旧文件一律不再读取。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { defaultConfig, normalizeConfig } from './config';
import type { SmartCatData, MemoryStream } from './types';

export const SMARTCAT_FILE = 'smartcat.json';
/** 记忆向量文件（bge-m3 1024 维 float32 平铺，dim uint32 LE 头；行序对齐 stream） */
export const SMARTCAT_VEC_FILE = 'smartcat-memory-vectors.vec';

/** smartcat.json 路径（跟随共享 storagePath） */
export function getSmartcatFilePath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/${SMARTCAT_FILE}`;
}

/** 记忆向量文件路径（与 smartcat.json 同目录） */
export function getSmartcatVecPath(): string {
  const s = tryGetSettings() as any;
  const dir = ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
  return `${dir}/${SMARTCAT_VEC_FILE}`;
}

/** 默认记忆流（空 stream + 反思元数据） */
export function defaultMemoryStream(): MemoryStream {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    stream: [],
    reflection: { lastReflectAt: 0, count: 0 },
  };
}

/** 默认全量数据（config 默认 + mood/人格成长默认 + 记忆流默认） */
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
    memory: defaultMemoryStream(),
  };
}

/** 归一化（config 走 normalizeConfig；memory 校验 stream 数组，非法条目过滤） */
export function normalizeData(raw: any): SmartCatData {
  const def = defaultSmartCatData();
  if (!raw || typeof raw !== 'object') return def;
  const stream = Array.isArray(raw.memory?.stream)
    ? raw.memory.stream.filter((m: any) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.description === 'string')
    : [];
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
    memory: {
      version: 1,
      lastUpdated: raw.memory?.lastUpdated || def.memory.lastUpdated,
      stream,
      reflection: {
        lastReflectAt: typeof raw.memory?.reflection?.lastReflectAt === 'number' ? raw.memory.reflection.lastReflectAt : 0,
        count: typeof raw.memory?.reflection?.count === 'number' ? raw.memory.reflection.count : 0,
      },
    },
  };
}

/** 读取数据（不存在/坏 JSON → 默认数据；无迁移） */
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