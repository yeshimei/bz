/**
 * 备忘录行为单源 · 公共假 obsidian（issue 260/ADR-0106，范式随 favorites 试点）
 *
 * 评审壳预览构建（build-preview.mjs 的 esbuild alias）把 ui.ts 依赖链上的
 * `obsidian` 包替换为本文件——浏览器里没有 Obsidian，但 ui.ts / core 的真实现
 * 只用到以下少数出口，逐一提供浏览器版即可让真行为代码原样运行：
 *   - Platform.isMobile        → 视口 ≤768 判定（评审壳 .demo-mob 容器归它管）
 *   - setIcon / IconName       → DOM 内联 SVG（表 = window.MEMO_ICONS，prototype-icons.js）
 *   - App / vault              → localStorage 文件系统（core/storage jsonFileStore 真实现
 *                               原样跑在上面；rename/delete 事件可手动派发——引用同步演示面）
 *   - workspace                → 最小桩：file-open 处理器注册表（被动捕获演示面——
 *                               壳按钮触发 demoFileOpen，模拟「打开某笔记」）
 *   - requestUrl 等            → memo 依赖链未触及，不给
 */
// ==================== 视口判定 ====================

/** 评审壳容器判定：真实端走 Obsidian Platform.isMobile；浏览器按视口宽（≤768） */
export const Platform = {
	isMobile: typeof window !== 'undefined' && window.innerWidth <= 768,
};

// ==================== 图标（表 = prototype-icons.js 的 window.MEMO_ICONS） ====================

declare global {
	interface Window {
		MEMO_ICONS?: Record<string, string>;
	}
}

/** 渲染 lucide 内联 SVG（未知 id 静默忽略——与 Obsidian setIcon 同语义） */
export function setIcon(container: HTMLElement, iconId: string): void {
	const d = (typeof window !== 'undefined' && window.MEMO_ICONS?.[iconId]) || '';
	if (!d) return;
	const ns = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	// 表里存的是内层 path/circle/polyline 片段——注入 innerHTML（内容为受控图标表）
	svg.innerHTML = d;
	container.replaceChildren(svg);
}

export type IconName = string;

/** requestUrl（core/utils → composer 剪藏抓标题链用到）：原型无网络，抛错走静默降级 */
export async function requestUrl(): Promise<never> {
	throw new Error('原型环境无网络请求（fake obsidian requestUrl）');
}

// ==================== TFile / Setting（类型与导入链面） ====================

/** 最小 TFile：path/name/basename/extension/stat——file-sync/reminder 消费面 */
export class TFile {
	path = '';
	name = '';
	basename = '';
	extension = '';
	stat: { ctime: number; mtime: number } = { ctime: 0, mtime: 0 };
}

/**
 * Setting 桩：仅 core/path-picker（uiSuggest 链）导入——原型 sim 永不构造设置界面，
 * 构建期需要导出存在，否则 esbuild alias 解析失败。
 */
export class Setting {
	settingEl = document.createElement('div');
	constructor(_container?: unknown) {}
}

/** MarkdownRenderer 桩：ui.ts 依赖链构建期需要导出存在（运行期不构造） */
export class MarkdownRenderer {}

/** MarkdownView 桩：diary/knowledge 传递链构建期需要导出存在（运行期不构造） */
export class MarkdownView {
	file: TFile | null = null;
	getViewData(): string {
		return '';
	}
}

/** obsidian moment 再导出（= moment 本体；diary/parser 等传递链构建期需要） */
import momentLib from 'moment';
export const moment = momentLib;

/** Component 桩：encrypt/ui 等传递链构建期需要导出存在（运行期不构造） */
export class Component {}

// ==================== App / vault（localStorage 文件系统 + rename/delete 演示事件） ====================

interface FakeFile {
	path: string;
	content: string;
}

/**
 * 内存 vault：core/storage.ts jsonFileStore 用到的读写方法 + 引用同步演示所需事件。
 * 后端 = localStorage（评审壳双 iframe 桌面/移动各跑一个真行为实例，同源共享同一数据源；
 * storage 事件桥转发为 modify——file-sync 订阅的是 rename/delete 通道，不经此桥，
 * 演示走 FakeVault.rename/delete 显式派发）。
 */
export class FakeVault {
	private static key(path: string): string {
		return 'bz-sim:' + path;
	}
	private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
	private idSeq = 0;

	constructor() {
		// 跨实例写入：浏览器只向「非写者」文档派发 storage 事件——收到即视为外部 modify
		if (typeof window !== 'undefined') {
			window.addEventListener('storage', (e) => {
				if (!e.key || !e.key.startsWith('bz-sim:')) return;
				const path = e.key.slice('bz-sim:'.length);
				this.emit('modify', { path });
			});
		}
	}

	getAbstractFileByPath(path: string): FakeFile | null {
		const raw = localStorage.getItem(FakeVault.key(path));
		return raw == null ? null : { path, content: raw };
	}

	async read(f: FakeFile): Promise<string> {
		return f.content;
	}

	async modify(f: FakeFile, content: string): Promise<void> {
		f.content = content;
		localStorage.setItem(FakeVault.key(f.path), content);
	}

	async create(path: string, content: string): Promise<FakeFile> {
		const f = { path, content };
		localStorage.setItem(FakeVault.key(path), content);
		return f;
	}

	async createFolder(_path: string): Promise<void> {
		// localStorage 无目录概念；storage.json 的 ensureDir 调用此方法——no-op
		return undefined as never;
	}

	/** rename（obsidian vault 语义）：键改名 + 事件 (file, oldPath)——引用同步演示用 */
	rename(oldPath: string, newPath: string): FakeFile | null {
		const raw = localStorage.getItem(FakeVault.key(oldPath));
		if (raw == null) return null;
		localStorage.removeItem(FakeVault.key(oldPath));
		localStorage.setItem(FakeVault.key(newPath), raw);
		const f: FakeFile = { path: newPath, content: raw };
		this.emit('rename', f, oldPath);
		return f;
	}

	/** delete（obsidian vault 语义）：删键 + 事件 (file, prev)——引用同步演示用 */
	delete(path: string): FakeFile | null {
		const raw = localStorage.getItem(FakeVault.key(path));
		if (raw == null) return null;
		localStorage.removeItem(FakeVault.key(path));
		const f: FakeFile = { path, content: raw };
		this.emit('delete', f, f);
		return f;
	}

	/** 事件订阅（core/app vault.on/offref 同形） */
	on(evt: string, cb: (...args: unknown[]) => void): { ref: unknown } {
		if (!this.listeners.has(evt)) this.listeners.set(evt, []);
		this.listeners.get(evt)!.push(cb);
		const id = ++this.idSeq;
		return { ref: id };
	}

	offref(ref: unknown): void {
		// 简化：全量退订（原型单会话无并发订阅场景）
		this.listeners.clear();
		void ref;
	}

	private emit(evt: string, ...args: unknown[]): void {
		for (const cb of this.listeners.get(evt) ?? []) cb(...args);
	}
}

/** 最小 workspace 桩：file-open 处理器注册表（被动捕获演示——demoFileOpen 触发） */
class FakeWorkspace {
	private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
	private idSeq = 0;

	on(evt: string, cb: (...args: unknown[]) => void): { ref: unknown } {
		if (!this.handlers.has(evt)) this.handlers.set(evt, []);
		this.handlers.get(evt)!.push(cb);
		const id = ++this.idSeq;
		return { ref: id };
	}

	offref(ref: unknown): void {
		void ref;
	}

	/** 触发 file-open（壳演示钩子） */
	fileOpen(path: string | null): void {
		const file = path ? { path } : null;
		for (const cb of this.handlers.get('file-open') ?? []) cb(file);
	}
}

/** 评审壳 App：vault + workspace 最小面（memo 依赖链只用这两处） */
export class FakeApp {
	vault = new FakeVault();
	workspace = new FakeWorkspace();
}

// 注意：不在此提供 setApp/getApp——评审壳统一走 core/app 的真 setApp/getApp
// （fake-sim.ts import '../../src/core/app' 的 setApp 注入 FakeApp；core/storage 的
// jsonFileStore 经 core/app getApp() 取到同一实例，单源不裂）。

export type App = FakeApp;
