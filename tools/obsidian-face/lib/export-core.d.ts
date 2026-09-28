/**
 * export-core.js 的类型声明（机制同 sync-core.d.ts：包本体纯 JS CommonJS，
 * 仓库 vitest 测试要 import 本模块；tsconfig include 不含 tools/，放同名 .d.ts 后
 * tsc 解析 import 走声明文件，包内 .js 实现完全不进类型检查面。勿删。）
 */

export interface ExportArgv {
  command: 'export' | null;
  dataRoot?: string;
  /** --contact 可重复；缺参 / 空名记入 error */
  contacts: string[];
  /** --contacts-file 名单文件路径（issue 510；文件展开在 bin，本层只记路径） */
  contactsFile?: string;
  python?: string;
  src?: string;
  help?: boolean;
  version?: boolean;
  error?: string;
}

/**
 * 解析 bz-face export 的 argv（容忍开头重复的 export）。--data-root 与至少一个 --contact
 * 必填（help/version 除外；--contacts-file 也算名单来源）；未知参数 / 缺参记入 error，绝不猜。
 * 永不抛。
 */
export declare function parseExportArgv(argv: string[]): ExportArgv;

/**
 * 名单文件文本 → 联系人目录名数组（issue 510）。一行一个，兼容 、/,/; 同行多人；
 * # 注释行与空行忽略；BOM 与首尾空白剥掉。纯函数不读盘，永不抛。
 */
export declare function parseContactsFileText(text: string): string[];

/**
 * export 预检：数据根三道 + 缓存密钥 / 解密库在位 + 联系人目录齐全；不看微信
 * （export 不取密钥）。缺前置产物 → 各自硬失败给中文引导。永不抛。
 */
export declare function judgeExportPreflight(
  probes: { dataRoot?: { configured: boolean; path?: string; exists?: boolean; writable?: boolean; error?: string } },
  opts: { contacts: string[]; cachedKey?: boolean; hasDecrypted?: boolean; missingContacts?: string[] },
): { ok: boolean; error?: string };
