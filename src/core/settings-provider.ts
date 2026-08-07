/**
 * 插件设置访问器（域模块经此读取 plugin.settings，避免直接依赖 main.ts）
 * main.ts onload 时注入；各域按需读取自己的设置字段。
 */
import type BzSettings from '../settings';

let _provider: (() => BzSettings) | null = null;

export function setSettingsProvider(fn: () => BzSettings): void {
  _provider = fn;
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
