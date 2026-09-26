/**
 * doctor-core.js 的类型声明。
 *
 * 为什么有这个文件：包本体是纯 JS（CommonJS，照 bili-downloader 先例），而仓库的
 * vitest 测试（tests/，TypeScript）要 import 本模块。tsconfig include 只扫
 * src/tests/prototypes 的 .ts，tools/ 不在类型检查面；放这份同名 .d.ts 后，
 * tsc 解析测试里的 import 走声明文件，包内 .js 实现完全不进类型检查。
 * （allowJs 虽开着，同名 .d.ts 优先——这是本包不进 tsc 面的机制，勿删本文件。）
 */

/** 检查行状态：pass=通过 / fail=缺失 / warn=存疑提示 / neutral=未配置（中性，不计失败） */
export type DoctorLineState = 'pass' | 'fail' | 'warn' | 'neutral';

/** 单行检查结果：text 为人话，fix 为可直接粘贴的安装/修复命令（或行动指引） */
export interface DoctorLine {
  key: string;
  state: DoctorLineState;
  text: string;
  fix?: string;
}

export interface DoctorChecksSummary {
  lines: DoctorLine[];
  passCount: number;
  failCount: number;
  warnCount: number;
  allPass: boolean;
}

/** 依赖项：mod = Python import 名，pip = pip 包名，note = 缺失时的附加提示 */
export interface DepSpec {
  mod: string;
  pip: string;
  note?: string;
}

export interface DoctorArgv {
  command: string | null;
  dataRoot?: string;
  python?: string;
  help?: boolean;
  version?: boolean;
  error?: string;
}

export declare const MIN_PYTHON_VERSION: number[];
export declare const WECHAT_BLOCKED_VERSION: number[];
export declare const WECHAT_ROLLBACK_VERSION: string;
export declare const WECHAT_4X_PROCESS: string;
export declare const WECHAT_3X_PROCESS: string;
export declare const DECRYPT_DEPS: DepSpec[];
export declare const TRANSCRIBE_DEPS: DepSpec[];
export declare const YARA_NOTE: string;

/** 点分版本号比较：a<b → -1，相等 → 0，a>b → 1；畸形段按 0 兜底，绝不抛 */
export declare function compareDotVersions(a: string, b: string): number;

/** 版本数组 [4,0,3,36] → '4.0.3.36' */
export declare function versionLabel(arr: number[]): string;

/**
 * 逐项执行探测函数并兜错：任何探测抛异常都折成 { ok:false, error }，
 * 单项失败绝不中断其余项（「缺失不中断」的第一道闸）。
 */
export declare function collectDoctorProbes(
  probeFns: Record<string, () => unknown>,
): Promise<Record<string, any>>;

/** 逐项判定：探测结果（允许残缺/畸形）→ 检查行列表与汇总 */
export declare function runDoctorChecks(
  results: Record<string, any>,
  opts?: { pkgRoot?: string },
): DoctorChecksSummary;

/** 微信检查行判定（独立可测） */
export declare function judgeWechat(res: Record<string, any>): DoctorLine;

/** 数据根检查行判定（独立可测） */
export declare function judgeDataRoot(res: Record<string, any>): DoctorLine;

/** CLI argv 解析（薄壳用；放判定层以便单测） */
export declare function parseDoctorArgv(argv: string[]): DoctorArgv;

/** 检查行 → 终端文本（单行：glyph + 文案 + 「→ 修复命令」） */
export declare function formatDoctorLine(line: DoctorLine): string;
