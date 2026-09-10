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
import { memoSettingsSchema } from '../../src/memo/settings';

declare global {
	interface Window {
		MEMO?: { ITEMS?: Array<Record<string, unknown>> };
	}
}

/** fake vault 内 memo.json 路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const VAULT_KEY = 'bz-sim:CONFIG/STORAGE/memo.json';

/**
 * 演示设置的**跨 iframe 持久层**（issue 269）。
 *
 * 评审壳是**双 iframe**（桌面 920 / 移动 412×915），每个 iframe 各自加载一份本模块——
 * 即两个互不相识的实例，`demoSettings` 是各自的**内存副本**：壳上按钮只调桌面实例的钩子，
 * 移动实例那份仍是初值，于是「点皮肤，桌面变了移动没变」。
 * 修法：皮肤/布局这类**外观选择**落 localStorage，两个实例 boot 时都读同一份——
 * 谁改都一致，且刷新（SSE 热重载会整页 reload）后选择不丢。
 * 数据类内容（memo.json）本就走 fake vault 的 localStorage，无需在此重复。
 */
const DEMO_KEY = 'bz-sim:demo-settings';

/** 需要跨 iframe 共享的键（外观选择；不含与数据/行为相关的键） */
const SHARED_KEYS = ['memoSkin', 'memoLayout'] as const;

/** 读共享设置并盖到内存副本上（boot 时调用一次；坏数据静默忽略） */
function loadSharedSettings(): void {
	try {
		const raw = localStorage.getItem(DEMO_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as Record<string, unknown> | null;
		if (!parsed || typeof parsed !== 'object') return;
		for (const k of SHARED_KEYS) {
			if (parsed[k] !== undefined) demoSettings[k] = parsed[k];
		}
	} catch {
		/* 坏 JSON / 存储不可用：保持内存初值，不影响其余演示面 */
	}
}

/** 写共享设置（改外观时调用；写失败不抛——壳内评审不因存储问题中断） */
function saveSharedSettings(): void {
	try {
		const out: Record<string, unknown> = {};
		for (const k of SHARED_KEYS) out[k] = demoSettings[k];
		localStorage.setItem(DEMO_KEY, JSON.stringify(out));
	} catch {
		/* 存储不可用：仅本实例生效（下次 boot 回初值），不抛 */
	}
}

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

/** 壳入口：一次性启动（种子 + 共享设置 + 注入；幂等） */
export function bootMemoSim(): void {
	const g = window as unknown as { __bzMemoSimBooted?: boolean };
	if (g.__bzMemoSimBooted) return;
	g.__bzMemoSimBooted = true;
	seedDatabase();
	loadSharedSettings(); // 跨 iframe 共享的外观选择（皮肤/布局）先落地，再注入 provider
	injectRuntime();
}

/** 打开主面板（真 openMemoPanel；toggle 语义同插件） */
export function openPanel(): void {
	bootMemoSim();
	openMemoPanel(_app as never);
}

export { closeMemoPanel as closePanel };

/** 皮肤演示（设置行 onChange 同款热切换）：改演示设置（+ 共享落盘）+ 真 applyMemoSkin。
 *  返回**归一后的值**（未知值按 applyMemoSkin 的兜底回落纸感）——壳按绝对目标下发两端时，
 *  直接拿这个返回值回显按钮，不必再读回一次状态。 */
export function applySkin(skin: 'paper' | 'editorial'): 'paper' | 'editorial' {
	bootMemoSim();
	demoSettings.memoSkin = skin === 'editorial' ? 'editorial' : 'paper';
	saveSharedSettings();
	applyMemoSkin(demoSettings.memoSkin as 'paper' | 'editorial');
	return demoSettings.memoSkin as 'paper' | 'editorial';
}

/** 当前皮肤（读演示设置；未知回落纸感——与 applyMemoSkin 的兜底同口径） */
export function skinState(): 'paper' | 'editorial' {
	return demoSettings.memoSkin === 'editorial' ? 'editorial' : 'paper';
}

/**
 * 切到另一套皮肤，返回切换后的值（徽牌「皮肤」钮用）。
 * 修 issue 269：旧实现是壳内自己判 `textContent.includes('编辑部')` 决定目标——
 * 而标签「皮肤→编辑部」正好包含「编辑部」，于是目标恒为 paper，**点按永远不动**
 * （初始即 paper → 切到 paper）。标签与目标方向写反的典型症状。
 */
export function toggleSkin(): 'paper' | 'editorial' {
	const next: 'paper' | 'editorial' = skinState() === 'paper' ? 'editorial' : 'paper';
	applySkin(next);
	return next;
}

/** 皮肤清单（壳按绝对目标下发两端时用；与 `applyMemoSkin` 的可选值同源） */
export function listSkins(): Array<{ value: 'paper' | 'editorial'; label: string }> {
	return [
		{ value: 'paper', label: '纸感手账' },
		{ value: 'editorial', label: '编辑部' },
	];
}

// ---------- 布局（issue 269：徽牌「皮肤」钮改「布局」切换；清单 = 域设置 schema 单源） ----------

/**
 * 面板布局清单：**单源 = 域设置 schema 的「面板布局」行**（`memoSettingsSchema`）。
 * 壳上按钮不写死任何布局名——将来该行加第二布局（layouts/<x>/ 落地 + 卡组加一项），
 * 徽牌按钮自动跟着可切，本文件与 prototype.html 都不用改。
 * 现值：只有 `default`「清单」（场景工作台，即当前唯一实现）。
 */
export function listLayouts(): Array<{ value: string; label: string }> {
	const row = memoSettingsSchema()
		.groups.flatMap((g) => g.rows)
		.find((r) => (r as { binding?: { key?: string } }).binding?.key === 'memoLayout');
	const opts = (row as { options?: Array<{ value: string; label: string }> } | undefined)?.options ?? [];
	return opts.map((o) => ({ value: o.value, label: o.label }));
}

/** 当前布局（读演示设置 memoLayout，非法/缺省回落清单） */
function currentLayoutValue(): string {
	const all = listLayouts();
	const cur = String(demoSettings.memoLayout ?? '');
	return all.some((o) => o.value === cur) ? cur : (all[0]?.value ?? '');
}

/** 布局回显包（徽牌按钮初绘用；count 供按钮标注「仅一套」） */
export function layoutState(): { value: string; label: string; count: number } {
	bootMemoSim();
	const all = listLayouts();
	const value = currentLayoutValue();
	return { value, label: all.find((o) => o.value === value)?.label ?? value, count: all.length };
}

/** 切到下一个布局（只有一套时原地不动）：写演示设置（+ 共享落盘）+ 返回新状态供按钮回显。
 *  布局落地前 memoLayout 尚无消费方（面板不因它变样），这正是「点了暂时没变化」的原因——
 *  等第一套真布局实现（layouts/<x>/）在面板侧接线后，本钩子无需再改。 */
export function cycleLayout(): { value: string; label: string; count: number } {
	const all = listLayouts();
	if (all.length === 0) return { value: '', label: '', count: 0 };
	const i = Math.max(0, all.findIndex((o) => o.value === currentLayoutValue()));
	const next = all[(i + 1) % all.length];
	return setLayout(next.value);
}

/** 按**绝对值**落布局（壳按绝对目标下发两端：先算好 next 再两侧各调一次，
 *  避免「逐实例各自 cycle」在两个实例状态不一致时各转各的、越切越偏）。 */
export function setLayout(value: string): { value: string; label: string; count: number } {
	bootMemoSim();
	const all = listLayouts();
	const hit = all.find((o) => o.value === value) ?? all[0];
	if (!hit) return { value: '', label: '', count: 0 };
	demoSettings.memoLayout = hit.value;
	saveSharedSettings();
	return { value: hit.value, label: hit.label, count: all.length };
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
