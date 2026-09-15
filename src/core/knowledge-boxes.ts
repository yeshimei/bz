/**
 * 三个盒子（ADR-0141 §4）：知识盒三部目录的解析单源。
 *
 * 「三盒」= 文献盒（部壹：录入的文献笔记）+ 卡片盒（部贰：自己写的卡）+ 主题盒（部叁：专题笔记）。
 * 自动关联的两端（被处理端与候选端）与第二大脑的向量索引都以这三个目录为界，
 * 挂载建议的召回又以卡片盒为界——四处都得知道「盒子在哪」，所以解析必须单源，
 * 各写一遍必然漂移（改目录时漏掉一处＝静默失效）。
 *
 * 依赖方向：本模块在 core（`core ← 域`），知识盒与第二大脑都只经它取目录，两侧零互引（ADR-0002）。
 * 唯一真理源仍是设置键（`knowledgeDirectory` / `knowledgeCardboxDirectory` / `knowledgeTopicDirectory`）：
 * 改设置即改范围，不缓存、不探测磁盘（ADR-0141 §4：空盒是合法状态，空范围 / 空索引 / 不报错）。
 */
import { isUnderFolder } from './utils';
import { tryGetSettings } from './settings-provider';

/** 缺省盒名（设置键为空 / 缺省时的回落；与 ADR-0112 默认目录一致） */
export const DEFAULT_LIT_DIR = '文献盒';
export const DEFAULT_CARDBOX_DIR = '卡片盒';
export const DEFAULT_TOPIC_DIR = '主题盒';

/** 三个盒子目录（均为归一化后的 vault 内相对路径） */
export interface KnowledgeBoxes {
  /** 文献盒（knowledgeDirectory）：部壹扫描的文献笔记目录 */
  lit: string;
  /** 卡片盒（knowledgeCardboxDirectory）：用户自己写的卡片目录 */
  cardbox: string;
  /** 主题盒（knowledgeTopicDirectory）：专题笔记目录 */
  topic: string;
}

/** 目录归一：反斜杠转正斜杠、去首尾斜杠、去空白；空值回落缺省名（fallback 传 '' 则返回 ''） */
export function normalizeBoxDir(raw: unknown, fallback: string): string {
  const s = String(raw ?? '')
    .replace(/\\/g, '/')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  return s || fallback;
}

/**
 * 读三个盒子目录（实时读设置，弹窗改完即生效，无缓存）。
 * @param s 可显式传入设置对象（settings.ts 的 onload 迁移要在合并默认值之前解析，见 migrateAutoLinkSettings）
 */
export function getKnowledgeBoxes(s?: unknown): KnowledgeBoxes {
  const st = (s ?? (tryGetSettings() as unknown) ?? {}) as Record<string, unknown>;
  return {
    lit: normalizeBoxDir(st.knowledgeDirectory, DEFAULT_LIT_DIR),
    cardbox: normalizeBoxDir(st.knowledgeCardboxDirectory, DEFAULT_CARDBOX_DIR),
    topic: normalizeBoxDir(st.knowledgeTopicDirectory, DEFAULT_TOPIC_DIR),
  };
}

/**
 * 三盒目录清单（去重保序：文献 → 卡片 → 主题）。
 * 去重是必要的：用户把两个键填成同一目录时，白名单拼接与范围判定都不该出现重复项。
 * 空盒名不会出现（getKnowledgeBoxes 已有缺省回落）。
 */
export function boxDirs(boxes?: KnowledgeBoxes): string[] {
  const b = boxes ?? getKnowledgeBoxes();
  const out: string[] = [];
  for (const d of [b.lit, b.cardbox, b.topic]) {
    if (d && !out.includes(d)) out.push(d);
  }
  return out;
}

/** 路径是否在三个盒子内（递归语义：路径 = 盒目录本身或其下文件；空路径 false） */
export function inKnowledgeBoxes(path: string, boxes?: KnowledgeBoxes): boolean {
  const p = normalizeBoxDir(path, '');
  if (!p) return false;
  return boxDirs(boxes).some((d) => isUnderFolder(d, p));
}

/** 该目录是否就是三个盒子之一（按归一化比较；用于把白名单值里的三盒条目剔除——剔除是幂等的） */
export function isBoxDir(dir: string, boxes?: KnowledgeBoxes): boolean {
  const d = normalizeBoxDir(dir, '');
  return !!d && boxDirs(boxes).includes(d);
}
