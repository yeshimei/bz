/**
 * 插件设置访问器（域模块经此读取 plugin.settings，避免直接依赖 main.ts）
 * main.ts onload 时注入；各域按需读取自己的设置字段。
 */
import type BzSettings from '../settings';
import type { BzResizablePersist } from './ui/resize';

let _provider: (() => BzSettings) | null = null;
let _saver: (() => Promise<void>) | null = null;

export function setSettingsProvider(fn: () => BzSettings): void {
  _provider = fn;
}

/** 注入设置保存通道（main.ts onload；域设置弹窗写回后经 saveSettings 持久化） */
export function setSettingsSaver(fn: () => Promise<void>): void {
  _saver = fn;
}

/** 保存设置到 data.json（未注入时静默——测试环境安全读取） */
export function saveSettings(): Promise<void> {
  return _saver ? _saver() : Promise.resolve();
}

/**
 * 打开设置面板的通道（main.ts onload 注入 settings-panel 的 openSettingsPanel）。
 *
 * 为什么不在 core 里直接拿设置面板（2026-10-30 用户实机踩过，两种写法都不行）：
 *  - 字面量 `import('../settings-panel')` 会被 esbuild 静态打进**每个**引用方：影院 / 书库 /
 *    知识盒 的行为包因此整块背上面板，而旧评审壳（已退役）的假 obsidian 层没有 Setting / Component，
 *    构建当场失败；
 *  - 换成变量拼出的动态 import 看着两全，实则 CJS 产物里它退化成原生 `import()`，
 *    插件运行时解析不到那个相对路径 → 按钮点了只弹一句「设置面板没能打开」。
 * 注入式没有这两个代价：core 只知道「有人能开面板」，谁开、开哪页由 main.ts 决定，
 * 面板本体也就不会跟着 core 进任何域的行为包。
 */
let _panelOpener: ((domainId?: string, anchorKey?: string) => void) | null = null;

export function setSettingsPanelOpener(fn: (domainId?: string, anchorKey?: string) => void): void {
  _panelOpener = fn;
}

/**
 * 请求打开设置面板（可定位到某域、某设置项）。
 * 返回 false = 没人接管（测试 / 旧评审壳（已退役）里没有面板），调用方自己给兜底文案。
 */
export function requestSettingsPanel(domainId?: string, anchorKey?: string): boolean {
  if (!_panelOpener) return false;
  try {
    _panelOpener(domainId, anchorKey);
    return true;
  } catch (e) {
    console.error('[bz] 设置面板打开失败', e);
    return false;
  }
}

export function getSettings(): BzSettings {
  if (!_provider) {
    throw new Error('bz: 设置提供者未注入（main.ts onload 应调用 setSettingsProvider）');
  }
  return _provider();
}

/** 安全读取（未注入时返回空对象，避免测试/早期调用崩溃） */
export function tryGetSettings(): Partial<BzSettings> {
  return _provider ? _provider() : {};
}

/** number 值设置键（面板尺寸记忆键的编译期约束，键名拼错/类型不对即编译失败）；
 *  -? 剥可选修饰——接口存在可选属性时同态映射会把 undefined 混进键联合 */
type NumberKeys<T> = { [K in keyof T]-?: T[K] extends number ? K : never }[keyof T];

/**
 * 主面板尺寸记忆通用工厂（ADR-0084 拖拽缩放全域推广，收敛 memo/clipbook 手写闭包）：
 * 返回 uiResizable 的 persist 钩子——load 读 <keyW/keyH>（无记忆或低于 min 回 null，
 * 面板走 CSS 默认尺寸）；save 写键后整库落盘（quiet 兜底，失败仅 console.error）。
 * 键语义：0 = 未拖过。各域接线形如：
 *   uiResizable(panelEl, { minW, minH, maxW, maxH, persist: panelSizePersist('xxPanelWidth', 'xxPanelHeight', MIN_W, MIN_H) })
 */
export function panelSizePersist(
  keyW: NumberKeys<BzSettings>,
  keyH: NumberKeys<BzSettings>,
  minW: number,
  minH: number,
): BzResizablePersist {
  return {
    load: () => {
      const s = tryGetSettings();
      const w = Number(s[keyW]) || 0;
      const h = Number(s[keyH]) || 0;
      if (w < minW || h < minH) return null;
      return { w, h };
    },
    save: (w, h) => {
      // keyof 联合写入 TS 保守，经可写视图中转；运行时键已受 NumberKeys 约束恒为 number 值键
      const rec = tryGetSettings() as unknown as Record<string, number>;
      rec[keyW as string] = w;
      rec[keyH as string] = h;
      void saveSettings().catch((e) => console.error('[bz] 面板尺寸保存失败', e));
    },
  };
}
