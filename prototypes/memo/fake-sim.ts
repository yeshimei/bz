/**
 * 备忘录行为单源 · sim 启动入口（issue 260/ADR-0106，范式随 favorites 试点）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（core/storage 的 jsonFileStore 真实现跑在 fake vault 上——
 *     读改写/留档/写队列全真，只把「文件系统」换成 localStorage，见 fake/fake-obsidian.ts）；
 *   - 种子数据：window.MEMO.ITEMS（prototype-data.js，六场景演示快照，日期相对当下生成），
 *     或评审壳父页同名全局（iframe 场景 window.parent.MEMO），首启写入 fake vault 的
 *     memo.json（数组形态，与插件 data 同构）；存储路径走真实现默认 CONFIG/STORAGE/memo.json；
 *   - 设置注入：setSettingsProvider（真 settings-provider 实现，注入可变设置对象——
 *     皮肤演示钮改 memoSkin 即时生效；autoPopupOnStart 壳内缺省关，被动捕获走手动演示）；
 *   - 域外接线等价重现：插件侧 main.ts 的 obsidian-adapter 挂载 + file-sync 常驻 +
 *     提醒后台，本文件 boot 时按同款次序接线；demoRenameNote/demoDeleteNote/demoCapture/
 *     demoFileOpen 是四个演示面的手动触发钩子（壳按钮调用），自动行为一律不随加载发生。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_memo，iframe 壳只调 boot + openPanel + 演示钩子。
 * 插件的 ui.ts / data.ts / due.ts / reminder.ts / file-sync.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { attachObsidianAdapter } from '../../src/core/obsidian-adapter';
import { ensureFileSync } from '../../src/memo/file-sync';
import { ensureMemoReminders } from '../../src/memo/reminder';
import { openMemoPanel, closeMemoPanel, applyMemoSkin } from '../../src/memo/ui';

declare global {
	interface Window {
		MEMO?: { ITEMS?: Array<Record<string, unknown>> };
	}
}

/** fake vault 内 memo.json 路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const VAULT_KEY = 'bz-sim:CONFIG/STORAGE/memo.json';

let _app: FakeApp | null = null;
/** 可变演示设置：设置注入用同一对象引用，壳内改键即时生效（saveSettings 为壳内 no-op） */
const demoSettings: Record<string, unknown> = {
	storagePath: 'CONFIG/STORAGE',
	// 面板键（ADR-0117 正名后键名）：皮肤演示钮写 memoSkin 即时热切换
	memoPanelWidth: 0,
	memoPanelHeight: 0,
	memoSkin: 'paper',
	memoLayout: 'default',
	// memo* 设置键（ADR-0092 存储契约，键名即本名）
	memoScenarios: '',
	memoSortMode: 'priority',
	memoShowArchivedByDefault: false,
	memoDefaultPriority: 'minor',
	memoDefaultScene: '',
	memoDueFormat: 'relative',
	// 被动捕获开关：壳内缺省关启动弹（演示走 demoCapture 手动触发，不随加载自动弹）
	autoPopupOnStart: false,
	openNoteReminder: true,
};

/** 评审壳种子：把原型演示数据写进 fake vault 的 memo.json（仅当库里没有数据时） */
function seedDatabase(): void {
	// 自身 window 优先（同文档场景）；iframe 场景读父页（评审壳持有 MEMO）
	const src = window.MEMO || (window.parent && (window.parent as Window).MEMO) || null;
	const items = src?.ITEMS || [];
	if (!localStorage.getItem(VAULT_KEY)) {
		localStorage.setItem(VAULT_KEY, JSON.stringify(items, null, 2));
	}
}

/** 评审壳演示设置 + 域外接线等价重现（adapter → file-sync 常驻；提醒后台走演示钩子） */
function injectRuntime(): void {
	const app = new FakeApp();
	setApp(app as never);
	_app = app;
	setSettingsProvider(() => demoSettings as never);
	setSettingsSaver(async () => {
		/* 壳内设置不落盘：可变对象即存储 */
	});
	// main.ts 同款：域事件总线地基挂载（file-sync 的 vault:md-* 通道由它供给）
	attachObsidianAdapter(app as never);
	// main.ts 同款：file-sync 无条件常驻（rename/delete 维护 memo.json 引用）
	ensureFileSync(app as never);
}

/** 壳入口：一次性启动（种子 + 注入；幂等） */
export function bootMemoSim(): void {
	const g = window as unknown as { __bzMemoSimBooted?: boolean };
	if (g.__bzMemoSimBooted) return;
	g.__bzMemoSimBooted = true;
	seedDatabase();
	injectRuntime();
}

/** 打开主面板（真 openMemoPanel；toggle 语义同插件） */
export function openPanel(): void {
	bootMemoSim();
	openMemoPanel(_app as never);
}

export { closeMemoPanel as closePanel };

/** 皮肤演示（设置行 onChange 同款热切换）：改演示设置 + 真 applyMemoSkin */
export function applySkin(skin: 'paper' | 'editorial'): void {
	bootMemoSim();
	demoSettings.memoSkin = skin;
	applyMemoSkin(skin);
}

/** 被动捕获演示：开 autoPopupOnStart 后注册真提醒后台（存在重要/到期未完成 → 300ms 后自动弹面板） */
export function demoCapture(): void {
	bootMemoSim();
	demoSettings.autoPopupOnStart = true;
	ensureMemoReminders(_app as never);
}

/** 打开笔记提醒演示：触发 workspace file-open（有重要/到期关联备忘录 → 面板定位到该笔记） */
export function demoFileOpen(path: string): void {
	bootMemoSim();
	ensureMemoReminders(_app as never);
	(_app!.workspace as unknown as { fileOpen: (p: string) => void }).fileOpen(path);
}

/** 引用同步演示·改名：vault 真 rename 事件 → 域事件总线 → file-sync 引用改写 */
export function demoRenameNote(from: string, to: string): boolean {
	bootMemoSim();
	return !!_app!.vault.rename(from, to);
}

/** 引用同步演示·删除：vault 真 delete 事件 → 域事件总线 → file-sync 引用清空 */
export function demoDeleteNote(path: string): boolean {
	bootMemoSim();
	return !!_app!.vault.delete(path);
}
