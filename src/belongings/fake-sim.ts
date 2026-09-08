/**
 * 归物本行为单源 · sim 启动入口（issue 245/ADR-0106）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeVault 注入 core/app（core/storage 的 jsonFileStore 真实现跑在 fake vault 上——
 *     读改写/留档/写队列全真，只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：window.BLG.ITEMS（prototype-data.js，真实库 65 件同构快照），或评审壳父页
 *     同名全局（iframe 场景 window.parent.BLG），首启写入 fake vault 的 belongings.json；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现可用，注入默认值）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_belongings，iframe 壳只调 boot + openPanel。
 * 插件的 ui.ts / data.ts / ai.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../core/app';
import { setSettingsProvider } from '../core/settings-provider';
import { openPanel, closePanel, openForm, resetBelongingsState } from './ui';

declare global {
  interface Window {
    BLG?: { ITEMS?: Array<Record<string, unknown>> };
  }
}

/** 评审壳种子：把原型演示数据写进 fake vault 的 belongings.json（仅当库里没有数据时） */
function seedDatabase(): void {
  // 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 BLG）
  const src = window.BLG || (window.parent && (window.parent as Window).BLG) || null;
  const items = src?.ITEMS || [];
  const VAULT_KEY = 'bz-sim:CONFIG/STORAGE/belongings.json';
  // 已种子过（用户改过数据）不覆盖——保持评审壳内编辑可持久
  if (!localStorage.getItem(VAULT_KEY)) {
    const db = {
      version: '1.0',
      last_updated: new Date().toISOString(),
      items: Object.fromEntries(items.map((raw) => [String((raw as { id?: unknown }).id), raw])),
    };
    localStorage.setItem(VAULT_KEY, JSON.stringify(db, null, 2));
  }
  // 无条件注入 app（core/storage 的 jsonFileStore 经 getApp() 取——每次启动都要可用）。
  // core/app 的 setApp 形参是 obsidian App 类型；评审壳 FakeApp 只实现 vault 读写面，
  // 运行期 core/storage 以 (app.vault as any) 访问——类型断言收敛此处差异。
  setApp(new FakeApp() as never);
}

/** 默认设置（settings-provider 真实现注入；键与插件 data.json 同形） */
function injectSettings(): void {
  setSettingsProvider(
    () =>
      ({
        belongingsDefaultStatus: '',
      }) as never
  );
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootBelongingsSim(): void {
  const g = window as unknown as { __bzBelSimBooted?: boolean };
  if (g.__bzBelSimBooted) return;
  g.__bzBelSimBooted = true;
  seedDatabase();
  injectSettings();
}

export { openPanel, closePanel, openForm, resetBelongingsState };
