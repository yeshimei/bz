/**
 * Obsidian App 实例注入（解耦：生产由插件 onload 注入，测试注入 mock）。
 */
import type { App } from 'obsidian';

let app: App | null = null;

export function setApp(a: App) {
  app = a;
}

export function getApp(): App {
  if (!app) throw new Error('app 尚未注入（插件未加载或测试未 setApp）');
  return app;
}
