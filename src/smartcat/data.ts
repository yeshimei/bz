/**
 * smartcat 数据层（用户拍板：所有数据存在一个 json——CONFIG/STORAGE/smartcat.json；
 * 向量豁免单 json，独立 smartcat-memory-vectors.vec，ADR-0021）。
 * ADR-0021：删除原四层记忆与一次性迁移路径（无数据产生，用户拍板不做迁移兼容），
 * memory 段改为单层记忆流 MemoryStream；旧 localStorage/旧文件一律不再读取。
 *
 * P1 数据基座（ticket 123）：memory 段升级为 v2 结构（memoryStream + behaviorStream 双流）；
 * 旧 schema（有 stream 字段或 version < 2）加载时重置为空新结构。
 */
import type { App } from 'obsidian';
import { tryGetSettings } from '../core/settings-provider';
import { defaultConfig, normalizeConfig } from './config';
import { randomOceanSeed, characterSeed, DEFAULT_TRAITS, DEFAULT_OCEAN } from './character';
import type { SmartCatData, MemoryStream, MemoryStreamEntry, PersonalityGrowthData, BehaviorItem } from './types';

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

/** 共享存储目录（跟随共享 storagePath；域内各 JSON 路径拼装的公共前缀） */
export function smartcatStorageDir(): string {
  const s = tryGetSettings() as any;
  return ((s && s.storagePath) || 'CONFIG/STORAGE').trim().replace(/\/+$/, '');
}

/**
 * 洞察人工修正原位补丁（092 设计第 7 条 / P1-29 修正被回滚修复）：
 * 在传入的数据对象上按 id 定位洞察并应用 pinned/supersededBy 类字段补丁。
 * **必须经常驻实例通道调用**（内存对象 + 统一 dataSaver）——独立 load-modify-save 副本
 * 落盘会回滚常驻侧后续任何保存。返回 false = 未找到该洞察。
 */
export function applyInsightPatch(data: SmartCatData, id: string, patch: (m: MemoryStreamEntry) => void): boolean {
  const target = (data.memory?.memoryStream || []).find((x) => x.id === id);
  if (!target) return false;
  patch(target);
  data.memory.lastUpdated = new Date().toISOString();
  return true;
}

/** smartcat.json 路径（跟随共享 storagePath） */
export function getSmartcatFilePath(): string {
  return `${smartcatStorageDir()}/${SMARTCAT_FILE}`;
}

/** 记忆向量文件路径（与 smartcat.json 同目录） */
export function getSmartcatVecPath(): string {
  return `${smartcatStorageDir()}/${SMARTCAT_VEC_FILE}`;
}

/** 默认记忆流 v2（空 memoryStream + 空 behaviorStream + 反思元数据） */
export function defaultMemoryStream(): MemoryStream {
  return {
    version: 2,
    lastUpdated: new Date().toISOString(),
    memoryStream: [],
    behaviorStream: [],
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
 *  mood 兼容旧 8 维字段 → 投影为 PAD 三轴兜底（旧数据直读，无迁移））
 *
 * P1 数据基座（ticket 123）：检测旧 schema（有 stream 字段或 version < 2）→ 重置 memory 段为空新结构。
 */
export function normalizeData(raw: any): SmartCatData {
  const def = defaultSmartCatData();
  if (!raw || typeof raw !== 'object') return def;

  // P1：旧 schema 检测——有 stream 字段或 version < 2 → 重置 memory 段（旧数据清空，拍板决定）
  const isOldSchema = raw.memory && (
    'stream' in raw.memory ||
    (typeof raw.memory.version === 'number' && raw.memory.version < 2)
  );

  let memoryStream: MemoryStreamEntry[] = [];
  let behaviorStream: BehaviorItem[] = [];
  let memoryReflection = {
    lastReflectAt: 0,
    count: 0,
    lastDigestAt: 0,
    digestCount: 0,
  };

  if (!isOldSchema) {
    // 新 schema：校验 memoryStream 数组
    memoryStream = Array.isArray(raw.memory?.memoryStream)
      ? raw.memory.memoryStream.filter((m: any) => m && typeof m === 'object' && typeof m.id === 'string' && typeof m.description === 'string')
      : [];
    behaviorStream = Array.isArray(raw.memory?.behaviorStream)
      ? raw.memory.behaviorStream.filter((b: any) => b && typeof b === 'object' && typeof b.id === 'string')
      : [];
    memoryReflection = {
      lastReflectAt: typeof raw.memory?.reflection?.lastReflectAt === 'number' ? raw.memory.reflection.lastReflectAt : 0,
      count: typeof raw.memory?.reflection?.count === 'number' ? raw.memory.reflection.count : 0,
      lastDigestAt: typeof raw.memory?.reflection?.lastDigestAt === 'number' ? raw.memory.reflection.lastDigestAt : 0,
      digestCount: typeof raw.memory?.reflection?.digestCount === 'number' ? raw.memory.reflection.digestCount : 0,
    };
  }
  // 旧 schema：memoryStream/behaviorStream 保持空数组，reflection 保持默认值

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
      version: 2,
      lastUpdated: raw.memory?.lastUpdated || def.memory.lastUpdated,
      memoryStream,
      behaviorStream,
      reflection: memoryReflection,
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

/** 保存（存在 modify / 不存在 create，建目录兜底）。
 *  Syncthing 冲突止血（用户拍板 2026-08-29）：写前与盘上现读内容比对，没变就跳过——
 *  无变化写只刷新 mtime，多设备各开一次就制造一轮 *.sync-conflict-* 冲突窗口。 */
export async function saveSmartCatData(app: App, data: SmartCatData): Promise<void> {
  const filePath = getSmartcatFilePath();
  const c = JSON.stringify(data, null, 2);
  const f = app.vault.getAbstractFileByPath(filePath);
  if (f) {
    try {
      if ((await app.vault.read(f as any)) === c) return;
    } catch { /* 读失败照写（保守回退，不改变原写入语义） */ }
    await app.vault.modify(f as any, c);
  } else {
    const d = filePath.substring(0, filePath.lastIndexOf('/'));
    if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
    await app.vault.create(filePath, c);
  }
}