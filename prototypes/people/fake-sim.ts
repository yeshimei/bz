/**
 * 脸谱行为单源 · sim 启动入口（issue 447，范式随 memo / favorites）
 *
 * 评审壳侧启动器：把真行为层（ui.ts → render.ts 依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（jsonFileStore 真实现跑在 localStorage 假 vault 上）；
 *   - 种子数据（形态仿真，非真实聊天——隐私口径 ADR-0191）：window.BZW_PEOPLE.SEED 的
 *     people.json / people-preview.json + 「数据目录」构造 chat.json，首启写入 fake vault；
 *   - **假 fs**：window.require('fs') 提供构造数据目录的 readdirSync/existsSync/readFileSync——
 *     数据源弹窗在壳内跑「真扫描 → 真归一化 → 真增量合并」管线（datasource.ts 全真），
 *     四态水位（有更新 / 已导无更新 / 未导入 / 群聊未纳入）可完整评审；
 *   - 设置注入：setSettingsProvider（peopleDataDir 指向构造目录）；
 *   - AI 生成不提供罐头：壳内点「画脸谱」会走真实调用并失败降级——生成路径在插件端评审。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_people，壳只调 boot + openPanel + 演示钩子。
 */
import { FakeApp } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { closePeoplePanel, isPeopleOpen, openDataSource, openPeoplePanel } from '../../src/people/ui';
import { peopleSettingsSchema } from '../../src/people/settings';

declare global {
	interface Window {
		BZW_PEOPLE?: {
			SEED?: {
				/** 构造数据目录里的文件（相对数据根） */
				DS_FILES?: Record<string, string>;
			};
		};
	}
}

/** fake vault 内数据文件路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const PEOPLE_KEY = 'bz-sim:CONFIG/STORAGE/people.json';
const PREVIEW_KEY = 'bz-sim:CONFIG/STORAGE/people-preview.json';

/** 构造数据根（壳内「外部数据目录」；与真插件配置形态一致，只是路径不存在于磁盘） */
const DS_ROOT = 'D:/演示数据/export_full';

// ==================== 形态仿真种子（构造数据，非真实聊天） ====================

/** 递增 sid（msgKey 稳定键）与递增 ct（2024-01 起秒级） */
let sidSeq = 900000000000;
let ctSeq = Math.floor(new Date('2024-01-02T09:00:00').getTime() / 1000);
function mk(n: number, who: string, msg: string, over: Record<string, unknown> = {}): Record<string, unknown> {
	sidSeq += 7;
	ctSeq += 180 + ((sidSeq % 7) * 60);
	return { ct: ctSeq, type: 1, who, msg, sid: sidSeq, ...over };
}
/** 构造一段对话流（n 条，文本为主，掺语音/图片/系统） */
function flow(n: number, name: string, startSid: number): Array<Record<string, unknown>> {
	const out: Array<Record<string, unknown>> = [];
	sidSeq = startSid;
	ctSeq = Math.floor(new Date('2024-01-02T09:00:00').getTime() / 1000);
	const lines = [
		['我', '早，今天碰一下进度？'],
		[name, '好，十点会议室'],
		['我', '接口那块我晚上再过一遍'],
		[name, '[语音 12秒·平静] 行，不急，把边界确认清楚就行'],
		[name, '[图片] 这是现在的报错截图'],
		['我', '看到了，午休后我改完发你'],
		[name, '辛苦'],
		['我', '[语音 8秒·开心] 搞定了，你瞅瞅'],
		[name, '"对方" 撤回了一条消息'],
		[name, '没问题了，收工'],
	];
	for (let i = 0; i < n; i++) {
		const [who, msg] = lines[i % lines.length];
		out.push(mk(1, who as string, msg as string));
	}
	return out;
}

function statsOf(monthly: Array<[string, number]>, voice: number, sec: number, image: number, text: number): Record<string, unknown> {
	const kinds: Record<string, number> = { 文本: text, 语音: voice, 图片: image, 系统: Math.round(voice / 8) + 2 };
	return {
		monthly,
		initiatedByMe: 42,
		initiatedByOther: 61,
		myAvgReplySec: 310,
		otherAvgReplySec: 640,
		myHourly: [1, 0, 0, 0, 0, 2, 6, 14, 22, 18, 12, 9, 16, 11, 8, 10, 14, 19, 23, 30, 42, 51, 38, 12],
		otherHourly: [2, 0, 0, 0, 0, 1, 3, 9, 17, 25, 14, 8, 12, 9, 7, 12, 18, 26, 31, 44, 57, 66, 45, 16],
		kindCounts: kinds,
		voiceCount: voice,
		voiceTotalSec: sec,
		imageCount: image,
	};
}

function months(count: number, base: number, drift: number): Array<[string, number]> {
	const out: Array<[string, number]> = [];
	const start = new Date('2024-06-01T00:00:00').getTime();
	for (let i = 0; i < count; i++) {
		const d = new Date(start + i * 30 * 86400000);
		const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		out.push([label, Math.max(4, Math.round(base + Math.sin(i / 2.2) * drift + i * 3))]);
	}
	return out;
}

/** people.json 种子（六位，覆盖真实形态：大量级 / 中位小量级 / 零媒体 / 数字名 / 超长名 / 线稿） */
function seedPeople(): string {
	const iso = (s: string) => new Date(s).toISOString();
	return JSON.stringify({
		version: 1,
		people: [
			{
				id: '陈默', name: '陈默', createdAt: iso('2026-03-01T10:00:00'),
				lastProcessedTs: ctSeq * 1000 - 86400000 * 30,
				imports: [{
					file: '数据源:陈默', importedAt: iso('2026-03-12T21:00:00'), messageCount: 12847, skippedCount: 921,
					timeFrom: iso('2024-06-01T00:00:00'), timeTo: iso('2026-03-12T21:00:00'),
					stats: statsOf(months(21, 520, 300), 891, 15120, 342, 11200),
				}],
				digest: {
					portrait: '## 相处模式\n陈默把情绪都收进工作节奏里：白天的回复短促克制，深夜的语音语速会慢下来。\n\n## 表达 DNA\n- 口头禅：「不急」「稳两年」「瞅瞅」\n- 少发长文字，生日凌晨的一段六十秒语音四年没断过\n> 有你在心里有底\n\n## 情绪底色\n平静占七成，开心对齐项目节点；生气只出现过三次，两次与临时改需求有关。',
					events: [
						{ ts: '2026-03-02', summary: '项目上线前连续一周陪他改方案到凌晨，他说「有你在心里有底」。', kind: 'major' },
						{ ts: '2025-11-18', summary: '父亲体检结果出来那天他请了假，晚上发来很长的语音。', kind: 'major' },
						{ ts: '2025-06-14', summary: '一起出差杭州，高铁上聊职业转型，他倾向再稳两年。', kind: 'minor' },
					],
					quotes: [
						{ ts: '2026-03-02', who: '对方', text: '有你在心里有底。' },
						{ ts: '2025-11-18', who: '对方', text: '人到中年就是这样。' },
					],
					chronicle: '## 2022\n六月入职同组，第一句话是「工位插排在哪」。\n\n## 2024\n搬到你家附近三公里，深夜语音明显变多。\n\n## 2025\n父亲一场大病，半年回老家四次；开始规律跑步。\n\n## 2026\n主导新系统迁移，上线后语音里第一次说出「成就感」。',
					generatedAt: iso('2026-03-12T21:30:00'),
				},
				profile: { tags: ['同事', '项目搭档'], job: '后端工程师', metVia: '入职同组', note: '项目主力搭档' },
				manualEvents: [{ id: 'ev-seed-1', ts: '2026-03-15', summary: '他推荐的那家面馆确实好吃。', createdAt: iso('2026-03-15T12:00:00') }],
			},
			{
				id: '林晚', name: '林晚', createdAt: iso('2026-02-20T10:00:00'),
				lastProcessedTs: ctSeq * 1000 - 86400000 * 40,
				imports: [{
					file: '数据源:林晚', importedAt: iso('2026-03-01T20:00:00'), messageCount: 8432, skippedCount: 512,
					timeFrom: iso('2024-06-01T00:00:00'), timeTo: iso('2026-03-01T20:00:00'),
					stats: statsOf(months(21, 340, 200), 512, 9360, 901, 6900),
				}],
				digest: {
					portrait: '## 相处模式\n家人档：大事说一半留一半，怕你担心；日常全是「吃了吗」「降温了」。\n\n## 表达 DNA\n- 语音比文字多，转发养生文章会补一句「别嫌我啰嗦」',
					events: [{ ts: '2026-01-28', summary: '过年回家的票她提前一个月就买好了。', kind: 'major' }],
					generatedAt: iso('2026-03-01T20:30:00'),
				},
			},
			{
				id: '周远山', name: '周远山', createdAt: iso('2026-03-10T10:00:00'),
				imports: [{
					file: '数据源:周远山', importedAt: iso('2026-03-10T22:00:00'), messageCount: 6920, skippedCount: 210,
					timeFrom: iso('2024-06-01T00:00:00'), timeTo: iso('2026-03-10T22:00:00'),
					stats: statsOf(months(21, 280, 160), 320, 6480, 188, 6300),
				}],
			},
			{
				id: '77', name: '77', createdAt: iso('2026-03-18T10:00:00'),
				imports: [{
					file: '数据源:77', importedAt: iso('2026-03-18T12:00:00'), messageCount: 1060, skippedCount: 7,
					timeFrom: iso('2024-06-01T00:00:00'), timeTo: iso('2026-03-18T12:00:00'),
					stats: statsOf(months(21, 44, 30), 0, 0, 8, 1040),
				}],
			},
			{
				id: 'A8号公寓连锁酒店18295475558', name: 'A8号公寓连锁酒店18295475558', createdAt: iso('2026-03-20T10:00:00'),
				imports: [{
					file: '数据源:A8号公寓连锁酒店', importedAt: iso('2026-03-20T12:00:00'), messageCount: 1, skippedCount: 0,
					timeFrom: iso('2026-03-01T00:00:00'), timeTo: iso('2026-03-01T00:00:00'),
				}],
			},
			{
				id: '苏黎', name: '苏黎', createdAt: iso('2026-03-22T10:00:00'),
				imports: [],
			},
		],
	});
}

/** people-preview.json 种子：陈默（比构造目录少 12 条 → 有更新）/ 林晚（同量 → 无更新）/ 周远山（已导未画） */
function seedPreview(dsFiles: Record<string, string>): string {
	const read = (name: string): Array<Record<string, unknown>> => {
		try {
			return JSON.parse(dsFiles[`${DS_ROOT}/${name}/chat.json`]) as Array<Record<string, unknown>>;
		} catch {
			return [];
		}
	};
	const contacts: Record<string, unknown> = {};
	const build = (name: string, take: number) => {
		const raws = read(name).slice(0, take);
		contacts[name] = {
			msgs: raws.map((m) => ({
				key: `s${m.sid}:${m.ct}`,
				ts: (m.ct as number) * 1000,
				isSender: m.who === '我',
				text: String(m.msg ?? ''),
			})),
			watermarkSid: raws.length ? Math.max(...raws.map((m) => m.sid as number)) : 0,
			stats: { msgCount: raws.length, voiceCount: 2, voiceTotalSec: 20, imageCount: 1 },
			updatedAt: '2026-03-12T21:00:00.000Z',
		};
	};
	build('陈默', Math.max(0, read('陈默').length - 12));
	build('林晚', read('林晚').length);
	build('周远山', read('周远山').length);
	return JSON.stringify({ version: 1, contacts });
}

/** 构造数据目录（chat.json 供真扫描管线读取；老周家 = 群聊：两位发送者） */
function buildDsFiles(): Record<string, string> {
	const files: Record<string, string> = {};
	files[`${DS_ROOT}/陈默/chat.json`] = JSON.stringify([...flow(52, '陈默', 910000000000)]);
	files[`${DS_ROOT}/林晚/chat.json`] = JSON.stringify([...flow(40, '林晚', 920000000000)]);
	files[`${DS_ROOT}/周远山/chat.json`] = JSON.stringify([...flow(36, '周远山', 930000000000)]);
	files[`${DS_ROOT}/77/chat.json`] = JSON.stringify([...flow(22, '77', 940000000000)]);
	files[`${DS_ROOT}/苏黎/chat.json`] = JSON.stringify([...flow(12, '苏黎', 950000000000)]);
	const group: Array<Record<string, unknown>> = [
		mk(1, '老周', '周末回不回来吃饭', { sid: 960000000001 }),
		mk(1, '大姐', '票我买好了', { sid: 960000000002 }),
		mk(1, '我', '回', { sid: 960000000003 }),
	];
	files[`${DS_ROOT}/老周家/chat.json`] = JSON.stringify(group);
	return files;
}

// ==================== 假 fs（数据源真管线在壳内可跑） ====================

/** 提供构造目录的 readdirSync / existsSync / readFileSync（datasource.ts 消费面） */
function installFakeFs(files: Record<string, string>): void {
	if (typeof window === 'undefined') return;
	const w = window as unknown as { require?: (m: string) => unknown };
	w.require = (m: string) => {
		if (m !== 'fs') return undefined;
		return {
			readdirSync: (p: string, _opts?: unknown) =>
				Object.keys(files)
					.filter((k) => k.startsWith(p.replace(/\\/g, '/') + '/'))
					.map((k) => k.slice(p.length + 1).split('/')[0])
					.filter((v, i, a) => a.indexOf(v) === i)
					.map((name) => ({ isDirectory: () => true, name })),
			existsSync: (p: string) => Object.prototype.hasOwnProperty.call(files, p.replace(/\\/g, '/')),
			readFileSync: (p: string) => {
				const hit = files[p.replace(/\\/g, '/')];
				if (hit === undefined) throw new Error(`fake fs: ${p} 不存在`);
				return hit;
			},
		};
	};
}

// ==================== 演示设置 ====================

const demoSettings: Record<string, unknown> = {
	storagePath: 'CONFIG/STORAGE',
	peopleDataDir: DS_ROOT,
	peopleIncludeGroups: false,
	peoplePreviewVoice: true,
	peopleImageDescMode: 'file',
	peoplePreviewVideo: true,
	peopleKeepSystem: true,
};

// ==================== boot ====================

let booted = false;

/** 壳入口：注入 FakeApp / 种子 / 假 fs / 设置，然后 openPanel 交给壳 */
export function bootPeopleSim(): void {
	if (booted) return;
	booted = true;
	const app = new FakeApp();
	setApp(app as never);
	// 种子：不存在才写（保留演示中的修改；壳「重置演示数据」清 bz-sim: 前缀后可重来）
	if (localStorage.getItem(PEOPLE_KEY) == null) localStorage.setItem(PEOPLE_KEY, seedPeople());
	const dsFiles = window.BZW_PEOPLE?.SEED?.DS_FILES ?? buildDsFiles();
	window.BZW_PEOPLE = { SEED: { DS_FILES: dsFiles } };
	if (localStorage.getItem(PREVIEW_KEY) == null) localStorage.setItem(PREVIEW_KEY, seedPreview(dsFiles));
	installFakeFs(dsFiles);
	setSettingsProvider(() => demoSettings as never);
	void peopleSettingsSchema();
}

/** 壳演示钩子：开关面板 */
export function openPanel(): void {
	openPeoplePanel();
}

export function togglePanel(): void {
	if (isPeopleOpen()) closePeoplePanel();
	else openPeoplePanel();
}

/** 壳演示钩子：打开数据源弹窗（真扫描管线） */
export function demoOpenDataSource(): void {
	openPeoplePanel();
	openDataSource();
}

/** 壳演示钩子：重置演示数据（清 bz-sim: 前缀并刷新） */
export function demoReset(): void {
	const kill: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (k && k.startsWith('bz-sim:')) kill.push(k);
	}
	for (const k of kill) localStorage.removeItem(k);
	location.reload();
}
