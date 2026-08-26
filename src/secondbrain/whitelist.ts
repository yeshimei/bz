/**
 * 白名单目录工具（ticket 114）：第二大脑白名单（secondBrainAllowPaths）与
 * 自动双链范围（linkAgentScopes）共用的解析/规范化/格式化与 vault 目录聚合。
 *
 * 存储格式冻结：设置键内仍是英文逗号分隔的路径字符串（buildConfig.ALLOW_PATHS
 * 与 link-agent/watch 的消费方零改动），本模块只做录入侧的体验增强。
 */

/** 单个可选条目：目录（含其全部子目录笔记数）或库根级单文件 */
export interface FolderInfo {
  /** 目录全路径；根级单文件条目为该文件的完整 path */
  path: string;
  /** 末段显示名 */
  name: string;
  /** 缩进层级（路径段数-1；根级单文件为 0） */
  depth: number;
  /** 该目录子树内的 md 笔记数（单文件恒为 1） */
  notes: number;
  /** true = 根级单文件（白名单按「全等」语义精确匹配该文件） */
  isFile: boolean;
}

/** 解析逗号分隔路径：trim、去空项、去首尾斜杠、保序去重 */
export function parsePathList(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  const out: string[] = [];
  for (const part of String(raw).split(',')) {
    const p = part.trim().replace(/^\/+|\/+$/g, '');
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** 反向格式化（设置键存储值，英文逗号分隔） */
export function formatPathList(list: string[]): string {
  return normalizeSelection(list).join(',');
}

/**
 * 规范化选择集：去空白/首尾斜杠/重复；若某条目的严格祖先已被选，丢弃该后代
 * （白名单是目录前缀语义，祖先已覆盖后代，保留只会徒增噪音）。
 */
export function normalizeSelection(list: string[]): string[] {
  const cleaned: string[] = [];
  for (const item of list) {
    const p = String(item).trim().replace(/^\/+|\/+$/g, '');
    if (p && !cleaned.includes(p)) cleaned.push(p);
  }
  return cleaned.filter((p) => !cleaned.some((other) => other !== p && p.startsWith(other + '/')));
}

/** 由 md 文件路径聚合可选条目：每一级祖先目录一行（附子树笔记计数）+ 根级单文件；按 path 升序 */
export function collectFolderInfos(mdPaths: string[]): FolderInfo[] {
  const dirNotes = new Map<string, number>();
  const rootFiles: FolderInfo[] = [];
  for (const mdPath of mdPaths) {
    const idx = mdPath.lastIndexOf('/');
    if (idx === -1) {
      rootFiles.push({ path: mdPath, name: mdPath, depth: 0, notes: 1, isFile: true });
      continue;
    }
    let cur = idx;
    while (cur !== -1) {
      const dir = mdPath.slice(0, cur);
      dirNotes.set(dir, (dirNotes.get(dir) || 0) + 1);
      cur = dir.lastIndexOf('/');
    }
  }
  const dirs: FolderInfo[] = [...dirNotes.entries()].map(([dirPath, notes]) => ({
    path: dirPath,
    name: dirPath.slice(dirPath.lastIndexOf('/') + 1),
    depth: dirPath.split('/').length - 1,
    notes,
    isFile: false,
  }));
  return [...dirs, ...rootFiles].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
