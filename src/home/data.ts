/**
 * 内容首页（home 域）数据层：home.json 读写 + 归一。
 *
 * home.json 存「钉选域清单」：{ version: 1, pinned: string[] }——
 * 钉选即域名 id 数组（顺序即卡片顺序）；其余信息（域清单/统计口径）是
 * 代码内声明，不入数据文件。文件缺失 → 默认钉选（懒建）；损坏 → 改名留档重建。
 */
import { jsonFileStore, storageFile } from '../core/storage';

export const HOME_VERSION = 1;
export const HOME_FILE_NAME = 'home.json';

/** 默认钉选域（diary/memo/cinema/review 四域：有真实统计 + 高频入口） */
export const DEFAULT_PINNED = ['diary', 'memo', 'cinema', 'review'];

export interface HomeData {
  version: number;
  pinned: string[];
}

export function defaultHomeData(): HomeData {
  return { version: HOME_VERSION, pinned: [...DEFAULT_PINNED] };
}

export function homeFilePath(): string {
  return storageFile(HOME_FILE_NAME);
}

/** 容错归一：非对象/版本非法回退默认；pinned 过滤为合法字符串数组、按需回退默认 */
function normalizeData(raw: unknown): HomeData {
  const def = defaultHomeData();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return def;
  const o = raw as Record<string, unknown>;
  const pinned = Array.isArray(o.pinned)
    ? (o.pinned as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0)
    : [];
  return { version: HOME_VERSION, pinned: pinned.length ? pinned : [...DEFAULT_PINNED] };
}

/** 读取钉选配置（缺失/损坏自动重建默认，不抛错） */
export async function loadHomeData(): Promise<HomeData> {
  const raw = await jsonFileStore<HomeData>(homeFilePath(), {
    defaultValue: () => defaultHomeData(),
  }).read();
  return normalizeData(raw);
}

/** 写回钉选配置（version 恒 1） */
export async function saveHomeData(data: HomeData): Promise<void> {
  await jsonFileStore<HomeData>(homeFilePath()).write({
    version: HOME_VERSION,
    pinned: data.pinned.filter((x) => typeof x === 'string' && x.length > 0),
  });
}
