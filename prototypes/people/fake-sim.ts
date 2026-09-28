/**
 * 脸谱行为单源 · sim 启动入口（issue 447，范式随 memo / favorites）
 *
 * 评审壳侧启动器：把真行为层（ui.ts → render.ts 依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（jsonFileStore 真实现跑在 localStorage 假 vault 上）；
 *   - 种子数据（形态仿真，非真实聊天——隐私口径 ADR-0191）：window.BZW_PEOPLE.SEED 的
 *     people.json / people-preview.json + 「数据目录」构造 chat.json，首启写入 fake vault；
 *     开面板时经**真迁移**（migrate.ts）落进壳内假保库，明文三件随之删除——数据此后住保库、
 *     刷新不丢（壳里「重置演示数据」清 bz-sim: 前缀即重来）；
 *   - **假 fs**：window.require('fs') 提供构造数据目录的 readdirSync/existsSync/readFileSync——
 *     数据源弹窗在壳内跑「真扫描 → 真归一化 → 真增量合并」管线（datasource.ts 全真），
 *     四态水位（有更新 / 已导无更新 / 未导入 / 群聊未纳入）可完整评审；
 *   - 设置注入：setSettingsProvider（peopleDataDir 指向构造目录）；
 *   - AI 生成不提供罐头：壳内点「画脸谱」会走真实调用并失败降级——生成路径在插件端评审。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake/fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_people，壳只调 boot + openPanel + 演示钩子。
 */
import { FakeApp, fakeImageBytes } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { collectMediaStats } from '../../src/people/media';
import { closePeoplePanel, isPeopleOpen, openDataSource, openPeoplePanel } from '../../src/people/ui';
import { PeopleSafeStore, setPeopleSafeStoreForTests } from '../../src/people/safe-store';
import { peopleSettingsSchema } from '../../src/people/settings';

declare global {
	interface Window {
		BZW_PEOPLE?: {
			SEED?: {
				/** 构造数据目录里的文件（相对数据根） */
				DS_FILES?: Record<string, string>;
				/** 数据根（库外绝对路径；评审引导注入） */
				DATA_DIR?: string;
				/** 真实头像字节：绝对路径 → base64（评审引导注入；保库记录头像走密文附件字节） */
				AVATAR_B64?: Record<string, string>;
			};
		};
	}
}

/** fake vault 内数据文件路径（localStorage 键 = bz-sim: 前缀 + vault 路径） */
const PEOPLE_KEY = 'bz-sim:CONFIG/STORAGE/people.json';
const PREVIEW_KEY = 'bz-sim:CONFIG/STORAGE/people-preview.json';

/** 种子标记（存在 = 已种过）：明文种子首启经真迁移落库后会被删（migrate.ts 清理），
 *  没有标记就会每次刷新重种一遍——迁移重跑会把壳里删掉的联系人复活、把改过的记录顶回种子态。 */
const SEED_MARK = 'bz-sim:__people-seeded';

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

/**
 * people.json 种子（五位，覆盖真实形态：大量级 / 中位小量级 / 零媒体 / 数字名 / 超长名）。
 * issue 452：原「苏黎 empty 卡」改成**只在预览桶、没有卡**（seedPreview 里建）——
 * 正是真实数据里大琳的处境（导入过预览但没画过），墙成员 = 卡 ∪ 预览桶的合成路径靠它评审。
 */
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
		],
	});
}

/** people-preview.json 种子：陈默（比构造目录少 12 条 → 有更新）/ 林晚（同量 → 无更新）/ 周远山（已导未画）/ 苏黎（只在仓里、没卡 → 452 上墙） */
function seedPreview(dsFiles: Record<string, string>): string {
	const read = (name: string): Array<Record<string, unknown>> => {
		try {
			return JSON.parse(dsFiles[`${DS_ROOT}/${name}/chat.json`]) as Array<Record<string, unknown>>;
		} catch {
			return [];
		}
	};
	const contacts: Record<string, unknown> = {};
	/** 聊天仓侧写统计与真实实现同源（collectMediaStats）——issue 454 的媒体数由它供数 */
	const build = (name: string, take: number) => {
		const raws = read(name).slice(0, take);
		const msgs = raws.map((m) => ({
			key: `s${m.sid}:${m.ct}`,
			ts: (m.ct as number) * 1000,
			isSender: m.who === '我',
			type: m.type ?? 1,
			text: String(m.msg ?? ''),
		}));
		const media = collectMediaStats(msgs);
		contacts[name] = {
			msgs,
			watermarkSid: raws.length ? Math.max(...raws.map((m) => m.sid as number)) : 0,
			stats: { msgCount: msgs.length, voiceCount: media.voiceCount, voiceTotalSec: media.voiceTotalSec, imageCount: media.imageCount },
			updatedAt: '2026-03-12T21:00:00.000Z',
		};
	};
	build('陈默', Math.max(0, read('陈默').length - 12));
	build('林晚', read('林晚').length);
	build('周远山', read('周远山').length);
	build('苏黎', read('苏黎').length); // 452：只在聊天仓里、people.json 没有卡 → 应由墙合成「待画」折子
	return JSON.stringify({ version: 2, contacts }); // 聊天仓 v2（issue 466）：旧 version 判废
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

/** 图片扩展名（假 fs 的字节分支：头像迁移 / 数据源行预览读的是 Uint8Array，不是文本） */
const IMG_EXT = /\.(jpg|jpeg|png|webp|gif)$/i;

/** 提供构造目录的 readdirSync / existsSync / readFileSync（datasource.ts 消费面）
 *  文本读原样出字符串；不带编码读图片时给 Uint8Array（迁移/预览的头像字节通道）。 */
function installFakeFs(files: Record<string, string>): void {
	if (typeof window === 'undefined') return;
	const w = window as unknown as { require?: (m: string) => unknown };
	const norm = (p: string) => p.replace(/\\/g, '/');
	w.require = (m: string) => {
		if (m !== 'fs') return undefined;
		return {
			readdirSync: (p: string, _opts?: unknown) =>
				Object.keys(files)
					.filter((k) => k.startsWith(norm(p) + '/'))
					.map((k) => k.slice(norm(p).length + 1).split('/')[0])
					.filter((v, i, a) => a.indexOf(v) === i)
					.map((name) => ({ isDirectory: () => true, name })),
			existsSync: (p: string) => {
				const key = norm(p);
				if (Object.prototype.hasOwnProperty.call(files, key)) return true;
				return IMG_EXT.test(key) && fakeImageBytes(key) !== null;
			},
			readFileSync: (p: string, enc?: string) => {
				const key = norm(p);
				// 字节读（无编码参数）：图片走 fakeImageBytes——头像迁移必须拿到真字节，
				// DS_FILES 里同名键是空串（清单只登记存在性，不搬运 1.8G 媒体）
				if (!enc && IMG_EXT.test(key)) {
					const bytes = fakeImageBytes(key);
					if (bytes) return bytes;
				}
				const hit = files[key];
				if (hit === undefined) throw new Error(`fake fs: ${p} 不存在`);
				return hit;
			},
		};
	};
}

// ==================== 假保险库（保库记录读写器的壳内替身） ====================

/**
 * 壳内假 SafeManager：清单 / 明文正文 / 附件原始层全落 **localStorage**（键前缀 bz-sim:__safe/；"密文 = 明文"）。
 *
 * 为什么必须有：467 / ADR-0194 之后脸谱全部数据（人物卡 + 聊天仓 + 任务 + 头像）都住在
 * 保险库里，面板入口第一句就是 getPeopleSafeStore() → encrypt.getSafeManager()。壳里没有
 * 加密层（.safe.enc / 密码学 / 锁屏都不存在），于是**点「打开面板」永远抛错** →
 * notice「脸谱面板打开失败，请重试」。这是壳的缺件，不是源码的问题。
 *
 * 注入通道用 safe-store 既有的测试注入缝（与 jsdom 用例同一条），不碰 src/ 一个字。
 * 解锁态恒真 → 面板解锁门禁（ensureSafeUnlocked('people')）不走真锁屏——壳里没有主密码。
 * 于是「存量迁移」照常跑：把壳内假 vault 里的旧明文三件迁成保库记录，面板拿到的就是
 * 真实数据通路（真 render + 真 ui + 真迁移），review 所见即插件所见。
 *
 * 为什么落 localStorage（不是内存 Map）：迁移收尾会**删掉旧明文三件**（migrate.ts 的清理
 * 步骤，与插件同口径）——内存版一旦刷新就是空册，桌面/移动两个 iframe 也各揣一份互不相见。
 * 落盘后与插件同语义：刷新不丢、双 iframe 共享同一库（读按需现取；写整清单覆盖——演示面够用），
 * 壳「重置演示数据」清 bz-sim: 前缀即从头来。
 */
function installFakeSafe(): void {
	type SimAttachment = {
		path: string;
		kind: 'image' | 'video';
		blobRef: string;
		blobSize: number;
		fingerprint: string;
		hasPreview: boolean;
		previewRef: string;
		keptShared?: boolean;
	};
	type SimNote = {
		id: string;
		kind?: string;
		path: string;
		title: string;
		createdAt: string;
		contentRef: string;
		attachments: SimAttachment[];
	};
	type SimInput = {
		path: string;
		title: string;
		kind?: string;
		content: string;
		attachments?: Array<{ path: string; kind?: 'image' | 'video'; data: string; keptShared?: boolean }>;
	};

	/** 保库落盘命名空间（bz-sim: 前缀 → 「重置演示数据」一并清） */
	const NS = 'bz-sim:__safe/';
	/** 清单读：坏数据当空库（壳不因一次手抖的 JSON 崩掉） */
	const readManifest = (): SimNote[] => {
		try {
			const parsed = JSON.parse(localStorage.getItem(`${NS}manifest`) ?? 'null') as SimNote[] | null;
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	};
	const writeManifest = (notes: SimNote[]): void => localStorage.setItem(`${NS}manifest`, JSON.stringify(notes));
	/** 递增 id（sim-<n>）：按现存清单推进——双 iframe 交替写也不会撞号 */
	const nextId = (notes: SimNote[]): string => {
		let seq = 0;
		for (const n of notes) {
			const m = /^sim-(\d+)$/.exec(n.id);
			if (m) seq = Math.max(seq, Number(m[1]));
		}
		return `sim-${seq + 1}`;
	};

	const safe = {
		root: 'CONFIG/STORAGE/.ENCRYPT',
		password: 'sim',
		unlocked: true,
		get manifest(): { version: number; notes: SimNote[] } {
			return { version: 1, notes: readManifest() };
		},
		selfHealRolledBack: 0,
		onUnlockChange: null as ((unlocked: boolean) => void) | null,
		manifestPath: 'CONFIG/STORAGE/.ENCRYPT/.safe.enc',
		resolveRef: (ref: string) => `CONFIG/STORAGE/.ENCRYPT/${ref}`,
		async exists() {
			return true;
		},
		async unlock() {
			safe.unlocked = true;
			return true;
		},
		lock() {
			safe.unlocked = false;
		},
		async verifyPassword() {
			return true;
		},
		async lockNote(input: SimInput): Promise<SimNote> {
			const notes = readManifest();
			const id = nextId(notes);
			const attachments = (input.attachments ?? []).map((a, i) => {
				const blobRef = `sim/${id}-${i}`;
				localStorage.setItem(`${NS}blob/${blobRef}`, a.data); // 字节先落、清单后写：清单可见即附件在
				return {
					path: a.path,
					kind: a.kind ?? 'image',
					blobRef,
					blobSize: a.data.length,
					fingerprint: `sim-fp-${id}-${i}`,
					hasPreview: false,
					previewRef: '',
					keptShared: a.keptShared,
				} satisfies SimAttachment;
			});
			const note: SimNote = {
				id,
				kind: input.kind,
				path: input.path,
				title: input.title,
				createdAt: new Date().toISOString(),
				contentRef: `sim/${id}.enc`,
				attachments,
			};
			localStorage.setItem(`${NS}body/${id}`, input.content);
			writeManifest([...notes, note]);
			return note;
		},
		async removeNote(id: string): Promise<void> {
			const notes = readManifest();
			const hit = notes.find((n) => n.id === id);
			if (hit) {
				for (const a of hit.attachments) localStorage.removeItem(`${NS}blob/${a.blobRef}`);
				writeManifest(notes.filter((n) => n.id !== id));
			}
			localStorage.removeItem(`${NS}body/${id}`);
		},
		async updateNotePayload(id: string, plain: string): Promise<void> {
			localStorage.setItem(`${NS}body/${id}`, plain);
		},
		async decryptNoteBody(note: { id: string }): Promise<string | null> {
			return localStorage.getItem(`${NS}body/${note.id}`);
		},
		async decryptAttachmentOriginal(a: { blobRef: string }): Promise<string | null> {
			return localStorage.getItem(`${NS}blob/${a.blobRef}`);
		},
	};

	setPeopleSafeStoreForTests(new PeopleSafeStore(safe as never));
}

// ==================== 演示设置 ====================

const demoSettings: Record<string, unknown> = {
	storagePath: 'CONFIG/STORAGE',
	// 数据目录可由壳启动钩子覆盖（window.BZW_PEOPLE.SEED.DATA_DIR，评审页注入真实目录用）；缺省演示目录
	peopleDataDir:
		(typeof window !== 'undefined' &&
			(window as unknown as { BZW_PEOPLE?: { SEED?: { DATA_DIR?: string } } }).BZW_PEOPLE?.SEED?.DATA_DIR) ||
		DS_ROOT,
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
	const dsFiles = window.BZW_PEOPLE?.SEED?.DS_FILES ?? buildDsFiles();
	// 种子：只在首启写（保留演示中的修改；壳「重置演示数据」清 bz-sim: 前缀后可重来）。
	// 标记 + 逐件判空：明文三件是给真迁移读的原料，迁完就被删；标记挡住「每次刷新重种」。
	if (localStorage.getItem(SEED_MARK) == null) {
		if (localStorage.getItem(PEOPLE_KEY) == null) localStorage.setItem(PEOPLE_KEY, seedPeople());
		if (localStorage.getItem(PREVIEW_KEY) == null) localStorage.setItem(PREVIEW_KEY, seedPreview(dsFiles));
		localStorage.setItem(SEED_MARK, new Date().toISOString());
	}
	// 保留引导注入的其余种子（DATA_DIR / AVATAR_B64）——直接覆写对象会把它们冲掉
	window.BZW_PEOPLE = { SEED: { ...window.BZW_PEOPLE?.SEED, DS_FILES: dsFiles } };
	installFakeFs(dsFiles);
	installFakeSafe();
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
