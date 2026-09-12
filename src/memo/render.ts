/**
 * 备忘录渲染纯层（ADR-0104 markup 单源）：面板壳/主头行计数/场景 nav/移动 chips/
 * 条目卡/meta 行/分区标签/完成折叠条的 markup 全部在此，ui.ts 与评审壳共用同一份。
 * 纯度：禁 obsidian/moment/core 服务（tests/core/render-purity 守卫 import 图）——
 * 时间类（due 状态/文案、相对时间）由调用方计算后以参数注入，本层只拼字符串。
 */
import { escapeHtml as esc, iconSpan } from '../core/ui/str';
import type { MemoItem } from './types';

/** 域图标表（lucide 名；渲染后组件库 mountIcons 统一 setIcon） */
export const MEMO_ICONS = {
	brand: 'list-checks',
	close: 'x',
	search: 'search',
	add: 'plus',
	addScene: 'tag',
	settings: 'settings',
	empty: 'inbox',
	pos: 'pin',
	star: 'star',
	edit: 'pencil',
	del: 'trash-2',
	course: 'graduation-cap',
	script: 'terminal',
	url: 'arrow-up-right',
	overdue: 'circle-alert',
	clock: 'clock',
	calendar: 'calendar',
	doneFold: 'chevron-down',
	sceneAll: 'layers',
	sceneToday: 'sun',
};

// lucide 占位 HTML 收口 core/ui/str（渲染后组件库 mountIcons 统一 setIcon） 
export { iconSpan };

/** 场景色点（数据语义色，域内直给；与旧 memo 相近语义） */
export const SCENE_DOTS: Record<string, string> = {
	剪藏: '#e67341', 代码: '#4c82c8', 公开课: '#8f5fc0', 学习: '#4c9e6c', 生活: '#c27a48', 工作: '#b25757',
};

export function sceneDot(scene: string): string {
	return SCENE_DOTS[scene] || '#8b8f9a';
}

/** 到期状态 → 图标名（meta 标签前缀；状态由调用方 getDueStatus 算好注入） */
export function dueIconName(status: string): string {
	if (status === 'overdue') return MEMO_ICONS.overdue;
	if (status === 'today') return MEMO_ICONS.clock;
	return MEMO_ICONS.calendar;
}

/** 到期状态 → 标签类 */
export function dueTagClass(status: string): string {
	if (status === 'overdue') return 'bz-memo-tag-overdue';
	if (status === 'today') return 'bz-memo-tag-today';
	return 'bz-memo-tag-future';
}

/** 伪场景图标前缀（issue 197 拍板：全部/今日/重要 = 图标，用户场景 = 场景色点）。
 *  重要 star 警示色走组件库 .bz-ic--warning（状态第二佐证，§6.1 状态不只靠颜色） */
export const SCENE_PSEUDO_ICONS: Record<string, { icon: string; cls?: string }> = {
	全部: { icon: MEMO_ICONS.sceneAll },
	今日: { icon: MEMO_ICONS.sceneToday },
	重要: { icon: MEMO_ICONS.star, cls: 'bz-ic--warning' },
};

/** 场景名首 emoji（issue 200 拍板：行头三槽 = 图标/emoji/彩圆；带 emoji 的场景名以 emoji 作行头） */
const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

/** 场景显示名（剥掉作行头的首 emoji；「🏠 家」→「家」） */
export function sceneLabel(scene: string): string {
	return scene.replace(LEADING_EMOJI_RE, '');
}

/** 场景项前导元素 HTML（三槽统一 14px 宽对齐：伪场景图标 / 场景名首 emoji / 场景色点；
 *  dotCls = .bz-rail-dot / .bz-mobstrip-dot 随宿主，彩圆本体尺寸不变居中成槽） */
export function sceneLeadHtml(o: { scene: string; dot: string }, dotCls: string): string {
	const pseudo = SCENE_PSEUDO_ICONS[o.scene];
	if (pseudo) return iconSpan(pseudo.icon, pseudo.cls ?? '');
	const emo = o.scene.match(LEADING_EMOJI_RE)?.[1];
	if (emo) return `<span class="bz-rail-emoji">${esc(emo)}</span>`;
	if (!o.dot) return '';
	return `<span class="${dotCls}" style="--bz-rail-tint:${o.dot}"></span>`;
}

/** 主头行计数（当前场景 + 当前搜索下的总数/未完成，对齐原型 updateCount；
 *  数字包 .bz-memo-cnt-num 供皮肤染色——issue 210 纸感/编辑部计数数字着色） */
export function mainCountHtml(total: number, undone: number): string {
	return `· <span class="bz-memo-cnt-num">${total}</span> 项 · <span class="bz-memo-cnt-num">${undone}</span> 未完成`;
}

/** 桌面场景 nav 项（.bz-rail-item） */
export function navBtnHtml(o: { scene: string; dot: string }, active: boolean, count: number): string {
	return `<button class="bz-rail-item${active ? ' on' : ''}" data-memo-scene="${esc(o.scene)}">${sceneLeadHtml(o, 'bz-rail-dot')}<span class="bz-rail-name">${esc(sceneLabel(o.scene))}</span><span class="bz-rail-count">${count}</span></button>`;
}

/** 移动场景 chip（.bz-mobstrip-chip） */
export function mobChipHtml(o: { scene: string; dot: string }, active: boolean): string {
	return `<button class="bz-mobstrip-chip${active ? ' is-on' : ''}" data-memo-scene="${esc(o.scene)}">${sceneLeadHtml(o, 'bz-mobstrip-dot')}${esc(sceneLabel(o.scene))}</button>`;
}

/** 移动场景条尾部「添加场景」chip（issue 268）：虚线空底 + tag 图标，挂在最后一个场景之后
 *  （左栏 .bz-memo-side-add 同语义的另一形态；虚线磁贴范式同收藏本 .bz-fav-chip-add）。
 *  动作不是场景：无 is-on / 无计数，data-memo-addscene 复用 ui.ts 既有委托。 */
export function mobAddSceneChipHtml(): string {
	return `<button class="bz-mobstrip-chip bz-mobstrip-add" data-memo-addscene title="添加场景">${iconSpan(MEMO_ICONS.addScene)}${esc('添加场景')}</button>`;
}

/** 面板壳首帧模板（.bz-panel-frame.bz-memo-panel；各槽位的渲染与行为接线在 ui.ts）
 *
 * 头行钮组（issue 197 → 268 收敛）：品牌块 + 右侧「打开备忘录设置 / 关闭」图标钮。
 * 皮肤段（.bz-memo-skin-*）在桌面把整组收掉（原型无此二钮）；移动端真全屏只放回
 * **关闭**一枚（issue 268：设置与新建从移动端头行撤除——设置并入设置面板，
 * 新建归底部录入「添加」与场景条尾部「添加场景」），并在收口段定档 28px 贴纸形态。
 * 新建：移动端入口归底部录入「添加」（打开创建弹窗）与场景条尾部「添加场景」——
 * issue 266 曾为此在头行补过一枚移动端专属新建钮，issue 268 随本次收敛退役。 */
export function panelShellHtml(): string {
	return `
    <div class="bz-panel-frame bz-memo-panel bz-panel-mtop">
      <div class="bz-panel-head">
        <div class="bz-panel-brand">${iconSpan(MEMO_ICONS.brand, 'bz-ic--sm')}</div>
        <div class="bz-panel-title">备忘录</div>
        <div class="bz-panel-head-sp"></div>
        <div class="bz-panel-head-btns">
          <button class="bz-icon-btn bz-memo-head-settings" data-memo-head-settings title="打开备忘录设置">${iconSpan(MEMO_ICONS.settings)}</button>
          <button class="bz-icon-btn bz-touch-target bz-touch-target--lg bz-memo-head-close" data-memo-head-close title="关闭">${iconSpan(MEMO_ICONS.close)}</button>
        </div>
      </div>
      <div class="bz-memo-body">
        <div class="bz-rail">
          <div class="bz-rail-scroll">
            <div class="bz-rail-label">场景</div>
            <div data-memo-nav></div>
            <button class="bz-memo-side-add" data-memo-addscene>${iconSpan(MEMO_ICONS.addScene)} 添加场景</button>
          </div>
        </div>
        <div class="bz-memo-main">
          <div class="bz-main-head">
            <div class="bz-main-title" data-memo-main-title>全部</div>
            <div class="bz-main-count" data-memo-main-count></div>
            <div class="bz-main-spacer"></div>
            <button class="bz-btn bz-btn--primary bz-btn--md" data-memo-newbtn>${iconSpan(MEMO_ICONS.add, 'bz-ic--sm')} 新建备忘录</button>
          </div>
          <div class="bz-toolrow">
            <div class="bz-search">${iconSpan(MEMO_ICONS.search)}<input class="bz-input" type="text" data-memo-search placeholder="搜索内容 / 场景…"></div>
            <div class="bz-memo-sort" data-memo-sort></div>
          </div>
          <div class="bz-mobstrip" data-memo-mob-scenes></div>
          <div class="bz-memo-content" data-memo-content></div>
          <div class="bz-memo-composer">
            <input class="bz-input" type="text" data-memo-composer-input placeholder="输入内容，Enter 保存…">
            <button class="bz-btn bz-btn--primary" data-memo-composer-add>${iconSpan(MEMO_ICONS.add, 'bz-ic--sm')} 添加</button>
          </div>
        </div>
      </div>
    </div>`;
}

/** meta 行 due 注入包（状态/文案由调用方按当下时刻算好） */
export type MetaDue = { status: 'overdue' | 'today' | 'future'; text: string } | null;

/** 卡片 meta 行（顺序对齐 memo buildMeta：课程→脚本→链接→位置→场景→截止→时间） */
export function metaTagsHtml(it: MemoItem, due: MetaDue, relTime: string): string {
	const tags: string[] = [];
	// 1. 课程（公开课）
	if (it.scene === '公开课' && it.courseName) {
		tags.push(`<span class="bz-memo-tag bz-memo-tag-course">${iconSpan(MEMO_ICONS.course)} ${esc(it.courseName.replace(/^《|》$/g, ''))}</span>`);
	}
	// 2. 脚本（代码）
	if (it.scene === '代码' && it.scriptName) {
		tags.push(`<span class="bz-memo-tag bz-memo-tag-script">${iconSpan(MEMO_ICONS.script)} ${esc(it.scriptName)}</span>`);
	}
	// 3. 链接
	if (it.url) {
		let host = '链接';
		try { host = new URL(it.url).hostname.replace(/^www\./, ''); } catch (e) { /* 保持默认 */ }
		tags.push(`<span class="bz-memo-tag bz-memo-tag-url" title="${esc(it.url)}">${iconSpan(MEMO_ICONS.url)} ${esc(host)}</span>`);
	}
	// 4. 位置（绑定笔记才显示；公开课课程同名文件不重复）
	if (it.notePath) {
		const name = it.notePath.split('/').pop()!.replace(/\.md$/i, '');
		const isCourseSame = it.scene === '公开课' && it.courseName && it.courseName.replace(/^《|》$/g, '') === name;
		if (!isCourseSame) {
			tags.push(`<span class="bz-memo-tag bz-memo-tag-pos" data-memo-pos="${esc(it.id)}">${iconSpan(MEMO_ICONS.pos)} ${esc(name)}</span>`);
		}
	}
	// 5. 场景（重要红底）
	const imp = it.priority === 'important' ? ' bz-memo-tag-important' : '';
	tags.push(`<span class="bz-memo-tag bz-memo-tag-scene${imp}">#${esc(it.scene)}</span>`);
	// 6. 截止（未完成；due 包由调用方注入）
	if (due) {
		tags.push(`<span class="bz-memo-tag ${dueTagClass(due.status)}">${iconSpan(dueIconName(due.status))} ${esc(due.text)}</span>`);
	}
	// 7. 相对时间（调用方注入）
	if (it.created && relTime) {
		tags.push(`<span class="bz-memo-time">${esc(relTime)}</span>`);
	}
	return tags.join('');
}

/** 勾选圈（列表卡与移动抽屉头共用，ADR-0104 markup 单源；完成态带 bz-memo-checked，
 *  title 随态换文案，data-memo-check 锚点两处同款——点击行为各自接线在 ui.ts） */
export function checkHtml(it: MemoItem): string {
	return `<span class="bz-memo-check${it.completed ? ' bz-memo-checked' : ''}" data-memo-check title="${it.completed ? '恢复未完成' : '标记完成'}"></span>`;
}

/** 条目卡（勾选/标题/meta；标题带 linkedNote/url 时为可点链接，点击行为接线在 ui.ts） */
export function cardHtml(it: MemoItem, due: MetaDue, relTime: string): string {
	const titleCls = it.completed ? ' bz-memo-done' : '';
	const clickable = !!(it.linkedNote || it.url);
	const titleHtml = clickable
		? `<a href="javascript:void(0)" data-memo-openitem="${esc(it.id)}">${esc(it.title)}</a>`
		: esc(it.title);
	return `<div class="bz-memo-card${titleCls}" data-memo-id="${esc(it.id)}">
      ${checkHtml(it)}
      <div class="bz-memo-body-text">
        <div class="bz-memo-card-title">${titleHtml}</div>
        <div class="bz-memo-meta">${metaTagsHtml(it, due, relTime)}</div>
      </div>
    </div>`;
}

/** 分区标签（到期优先 / 其他） */
export function sectionLabelHtml(label: string, count: number): string {
	return `<div class="bz-memo-section-label">${label} <span class="bz-memo-sec-cnt">${count}</span></div>`;
}

/** 已完成折叠条（open = 展开态） */
export function doneBarHtml(open: boolean, count: number): string {
	return `<div class="bz-memo-donebar${open ? ' bz-memo-donebar-open' : ''}" data-memo-donebar>
      ${iconSpan(MEMO_ICONS.doneFold)} 已完成 <span class="bz-memo-donebar-cnt">${count}</span></div>`;
}

/** 「更早 N 条」放全钮 */
export function doneMoreHtml(n: number): string {
	return `<button class="bz-memo-done-more" data-memo-donemore>更早 ${n} 条</button>`;
}
