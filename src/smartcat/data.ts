/**
 * smartcat 数据层（用户拍板：所有数据存在一个 json——CONFIG/STORAGE/smartcat.json；
 * 向量豁免单 json，独立 smartcat-memory-vectors.vec，ADR-0021）。
 * ADR-0021：删除原四层记忆与一次性迁移路径（无数据产生，用户拍板不做迁移兼容），
 * memory 段改为单层记忆流 MemoryStream；旧 localStorage/旧文件一律不再读取。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { defaultConfig, normalizeConfig } from './config';
import { randomOceanSeed, characterSeed, DEFAULT_TRAITS, DEFAULT_OCEAN } from './character';
import type { SmartCatData, MemoryStream, PersonalityGrowthData } from './types';

export const SMARTCAT_FILE = 'smartcat.json';
/** 记忆向量文件（bge-m3 1024 维 float32 平铺，dim uint32 LE 头；行序对齐 stream） */
export const SMARTCAT_VEC_FILE = 'smartcat-memory-vectors.vec';
/** 一天毫秒数（getAbsenceDays 天数换算） */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 刷新在场时间（ticket 088，H5 在场口径统一）：写入 Date.now() 到 editingData.lastPresenceAt。
 * **不新增独立写盘**——本函数只改内存字段，由调用方随既有 dataSaver 落盘：
 * 观察路径并入 addObservation 的 dataSaver（refresh 在 dataSaver 之前改内存字段），
 * 聊天/主动关心路径复用其既有 dataSaver 调用。editingData 可为 null/旧结构 → 展开兜底。
 */
export function touchPresence(data: SmartCatData, now = Date.now()): void {
  data.editingData = { ...(data.editingData || {}), lastPresenceAt: now };
}

/**
 * 距上次在场天数（ticket 088 读 helper，纯函数 + now 注入）：缺失值（旧数据无 lastPresenceAt）
 * 按 ensure 缺省初始化语义（初始化为当前时间）→ 0 天；导出供方向三「≥3 天无观察」/七「缺席」未来使用。
 */
export function getAbsenceDays(data: SmartCatData, now = Date.now()): number {
  const last = typeof data.editingData?.lastPresenceAt === 'number' ? data.editingData.lastPresenceAt : now;
  return Math.max(0, Math.floor((now - last) / DAY_MS));
}

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
    reflection: { lastReflectAt: 0, count: 0, lastDigestAt: 0, digestCount: 0 },
  };
}

/** 默认全量数据（config 默认 + PAD 心情默认 + 性格成长默认（MATE）+ 记忆流默认） */
export function defaultSmartCatData(): SmartCatData {
  return {
    config: defaultConfig(),
    mood: {
      pad: { pleasure: 55, arousal: 50, dominance: 50 },
      lastUpdate: 0,
      lastMood: 'neutral',
      currentEmotion: null,
    },
    personalityGrowth: defaultPersonalityGrowth(),
    editingData: null,
    memory: defaultMemoryStream(),
  };
}

/** 默认性格成长（MATE：OCEAN 随机种子 + 30 特质 seed + 空统计） */
export function defaultPersonalityGrowth(): PersonalityGrowthData {
  const ocean = randomOceanSeed();
  return {
    ocean,
    traits: characterSeed(ocean),
    relationship: { trust: 0.5, attachment: 0.5 },
    behaviorStats: { interactionCount: 0, emotionalTone: 0, preferredHour: 12, sessionCount: 0 },
    growthHistory: [],
    lastSave: 0,
    version: '2.0',
  };
}

/** 归一化（config 走 normalizeConfig；memory 校验 stream 数组，非法条目过滤；
 *  mood 兼容旧 8 维字段 → 投影为 PAD 三轴兜底（旧数据直读，无迁移）） */
export function normalizeData(raw: any): SmartCatData {
  const def = defaultSmartCatData();
  if (!raw || typeof raw !== 'object') return def;
  const stream = Array.isArray(raw.memory?.stream)
    ? raw.memory.stream.filter((m: any) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.description === 'string')
    : [];
  // 旧 8 维（happiness/energy...）→ PAD 投影（pleasure=hy+aff、arousal=energy+curiosity、dominance=focus+productivity+creativity）
  const oldDim = raw.mood?.dimensions || {};
  const pick = (k: string, fb: number) => (typeof oldDim[k] === 'number' ? (oldDim[k] as number) : fb);
  const pad = raw.mood?.pad && typeof raw.mood.pad.pleasure === 'number'
    ? { ...def.mood.pad, ...raw.mood.pad }
    : oldDim.happiness !== undefined
      ? {
          pleasure: Math.min(100, Math.round(pick('happiness', 55) * 0.6 + pick('affection', 50) * 0.4)),
          arousal: Math.min(100, Math.round(pick('energy', 50) * 0.6 + pick('curiosity', 50) * 0.4)),
          dominance: Math.min(100, Math.round(pick('focus', 50) * 0.4 + pick('productivity', 50) * 0.3 + pick('creativity', 50) * 0.3)),
        }
      : def.mood.pad;
  return {
    config: normalizeConfig(raw.config || raw), // 兼容旧布局：整个文件即 config
    mood: {
      pad,
      lastUpdate: typeof raw.mood?.lastUpdate === 'number' ? raw.mood.lastUpdate : def.mood.lastUpdate,
      lastMood: typeof raw.mood?.lastMood === 'string' ? raw.mood.lastMood : def.mood.lastMood,
      currentEmotion: typeof raw.mood?.currentEmotion === 'string' ? raw.mood.currentEmotion : null,
    },
    personalityGrowth: normalizePersonalityGrowth(raw.personalityGrowth || def.personalityGrowth, def.personalityGrowth),
    editingData: raw.editingData ?? def.editingData,
    memory: {
      version: 1,
      lastUpdated: raw.memory?.lastUpdated || def.memory.lastUpdated,
      stream,
      reflection: {
        lastReflectAt: typeof raw.memory?.reflection?.lastReflectAt === 'number' ? raw.memory.reflection.lastReflectAt : 0,
        count: typeof raw.memory?.reflection?.count === 'number' ? raw.memory.reflection.count : 0,
        lastDigestAt: typeof raw.memory?.reflection?.lastDigestAt === 'number' ? raw.memory.reflection.lastDigestAt : 0,
        digestCount: typeof raw.memory?.reflection?.digestCount === 'number' ? raw.memory.reflection.digestCount : 0,
      },
    },
  };
}

/** 归一化性格成长：新结构字段逐项兜底；旧 4 维 traits（playfulness 等）映射进 behavioral 群组 */
export function normalizePersonalityGrowth(raw: any, def: PersonalityGrowthData): PersonalityGrowthData {
  if (!raw || typeof raw !== 'object') return def;
  const traits = { ...DEFAULT_TRAITS, ...(raw.traits && typeof raw.traits === 'object' ? raw.traits : {}) };
  // 旧 4 维兼容：playfulness→dopamine/humor、sociability→warmth/oxytocin、independence→avoidance、curiosity→creativity
  if (raw.traits && typeof raw.traits.playfulness === 'number') {
    traits.dopamine = Math.min(0.9, Math.max(0.1, (raw.traits.playfulness / 100 + 0.5) / 2));
    traits.humor = Math.min(0.9, Math.max(0.1, (raw.traits.playfulness / 100 + 0.5) / 2));
  }
  if (raw.traits && typeof raw.traits.sociability === 'number') {
    traits.warmth = Math.min(0.9, Math.max(0.1, (raw.traits.sociability / 100 + 0.5) / 2));
    traits.oxytocin = Math.min(0.9, Math.max(0.1, (raw.traits.sociability / 100 + 0.5) / 2));
  }
  if (raw.traits && typeof raw.traits.independence === 'number') {
    traits.def_avoidance = Math.min(0.9, Math.max(0.1, 1 - (raw.traits.independence / 100 + 0.5) / 2));
  }
  if (raw.traits && typeof raw.traits.curiosity === 'number') {
    traits.creativity = Math.min(0.9, Math.max(0.1, (raw.traits.curiosity / 100 + 0.5) / 2));
  }
  return {
    ocean: {
      ...DEFAULT_OCEAN,
      ...(raw.ocean && typeof raw.ocean === 'object' ? raw.ocean : {}),
    },
    traits,
    relationship: {
      trust: typeof raw.relationship?.trust === 'number' ? raw.relationship.trust : 0.5,
      attachment: typeof raw.relationship?.attachment === 'number' ? raw.relationship.attachment : 0.5,
    },
    behaviorStats: {
      interactionCount: typeof raw.behaviorStats?.interactionCount === 'number' ? raw.behaviorStats.interactionCount : 0,
      emotionalTone: typeof raw.behaviorStats?.emotionalTone === 'number' ? raw.behaviorStats.emotionalTone : 0,
      preferredHour: typeof raw.behaviorStats?.preferredHour === 'number' ? raw.behaviorStats.preferredHour : 12,
      sessionCount: typeof raw.behaviorStats?.sessionCount === 'number' ? raw.behaviorStats.sessionCount : 0,
    },
    growthHistory: Array.isArray(raw.growthHistory) ? raw.growthHistory : [],
    lastSave: typeof raw.lastSave === 'number' ? raw.lastSave : 0,
    version: '2.0',
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