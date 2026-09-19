/**
 * diary 修复批 A（写链路弹窗族 dialogs.ts + core bindFormSubmit）回归：
 * - D-UI2/旧 D1'：两浮层 ESC 层（壳自带）+ 脏表单 confirmDiscard 分流 + 遮罩丢输入
 *   路径并入分流 + 「取消」按钮显式退出 + close 自摘 mask/成对注销 ESC 层；
 * - 效率#1：标签过滤输入即筛 + 频次前置排序 + sticky 底栏（结构 + CSS 守卫）；
 * - D-UI12/效率#3：保存进行中禁用 + 「保存中…」文案；选择器防连点；
 * - func N1：改标签整链兜底 catch（非守卫错误人话）+ 加密分支 isUnlocked 短路；
 * - D-UI5：开壳焦点由 uiModal 焦点管理接管（不再聚焦 display:none 隐藏 input）；
 * - 一致#1：新建 = 「添加」、编辑 = 「保存」；一致#2：bz- 域皮 + 删除钮 danger 族；
 * - 一致#7：默认日期键走 core localDayKey。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getApp, setApp } from '../../src/core/app';
import { emitDomainEvent } from '../../src/core/domain-bus';
import { localDayKey } from '../../src/core/utils';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import { applyDirectories, resetTagsConfig, getTagEmoji, getParentPrimaryTag, isSubTag } from '../../src/diary/config';
import {
  openAddDialog,
  saveNewEntry,
  showTagPicker,
  createAddDialog,
  createTagPicker,
  resetTagUsageStats,
  hideTagPicker,
} from '../../src/diary/ui/dialogs';
import { clearNotices, getNoticeMessages } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';

let vault: MockVault;

beforeEach(() => {
  document.body.innerHTML = '';
  clearNotices();
  resetTagsConfig();
  applyDirectories({});
  resetTagUsageStats();
  vi.restoreAllMocks();
  vault = new MockVault();
  setApp(mockAppWithVault(vault));
});

const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const addMask = () => document.getElementById('add-diary-mask');
const addPopup = () => document.getElementById('add-diary-popup');
const tagMask = () => document.getElementById('diary-tag-selector-mask');
const tagPopup = () => document.getElementById('diary-tag-selector-popup');
/** 放弃确认框按钮（confirmDiscard 契约：首动作「放弃」落取消位，次动作「继续编辑」确认位） */
const discardBtn = () => document.getElementById('__shared_confirm_cancel__');
const keepBtn = () => document.getElementById('__shared_confirm_ok__');
const confirmPopup = () => document.getElementById('__shared_confirm_popup__');
const footButtons = (root: HTMLElement | null) => [...(root?.querySelectorAll('.bz-diary-dialog-foot button') ?? [])].map((b) => b.textContent);

function pickType(label: string): void {
  const btn = [...document.querySelectorAll<HTMLButtonElement>('#add-diary-type-container .diary-tag-selector-btn')].find(
    (b) => b.dataset.tag === label
  );
  btn!.click();
}

/** 打开写日记弹窗；传 datetime 时改写日期框（注意：改写即偏离默认 = 脏态，
 *  ESC/遮罩/取消会走 confirmDiscard 分流——脏态用例显式传参，干净态用例不传） */
function openWriteDialog(datetime?: string): void {
  createAddDialog(); // 兼容入口保持可调（空操作）
  openAddDialog();
  if (datetime !== undefined) {
    (document.getElementById('add-diary-datetime') as HTMLInputElement).value = datetime;
  }
}

function openPicker(tags: string[], extra: Partial<Parameters<typeof showTagPicker>[0]> = {}): HTMLElement {
  createTagPicker(); // 兼容入口保持可调（空操作）
  showTagPicker({
    filename: '我的/日记/2401010800.md',
    filePath: '我的/日记/2401010800.md',
    date: '2024-01-01',
    time: '08:00',
    lineNumber: 0,
    tags,
    ...extra,
  });
  return tagPopup()!;
}

describe('D-UI2/旧 D1\'：写日记弹窗 ESC 层 + 脏表单分流', () => {
  it('无输入按 ESC：弹窗直接收（mask 摘除、ESC 层成对注销——再按 ESC 无残留层响应）', () => {
    openWriteDialog();
    expect(addMask()).not.toBeNull();
    esc();
    expect(addMask()).toBeNull();
    expect(addPopup()).toBeNull();
    esc(); // 注销成对：不应弹出任何确认框
    expect(confirmPopup()).toBeNull();
    expect(getNoticeMessages().join('\n')).not.toContain('放弃');
  });

  it('已选类型（有输入）按 ESC：走 confirmDiscard——「继续编辑」留在弹窗，「放弃」才收', async () => {
    openWriteDialog();
    pickType('日记');
    esc();
    expect(addMask()).not.toBeNull(); // 未直接关
    expect(confirmPopup()).not.toBeNull();
    keepBtn()!.click();
    await flush();
    expect(addMask()).not.toBeNull(); // 继续编辑：弹窗保留、输入不丢
    expect([...addPopup()!.querySelectorAll('.diary-tag-selector-btn.diary-active')]).toHaveLength(1);
    esc();
    discardBtn()!.click(); // 放弃（proceed 走 .then 微任务，断言前先 flush）
    await flush();
    expect(addMask()).toBeNull();
  });

  it('日期偏离默认（有输入）按 ESC：同样走 confirmDiscard', async () => {
    openWriteDialog('2023-05-06 07:08'); // 偏离 localDayKey 默认
    esc();
    expect(confirmPopup()).not.toBeNull();
    discardBtn()!.click();
    await flush();
    expect(addMask()).toBeNull();
  });

  it('遮罩点击并入同一分流：无输入直接收，有输入先确认（丢输入路径不再静默）', async () => {
    openWriteDialog();
    addMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(addMask()).toBeNull(); // 无输入：直接收
    openWriteDialog();
    pickType('骑行');
    addMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(confirmPopup()).not.toBeNull(); // 有输入：先确认
    discardBtn()!.click();
    await flush();
    expect(addMask()).toBeNull();
  });

  it('「取消」按钮承接显式退出：有输入走确认分流，无输入直接收', async () => {
    openWriteDialog();
    const cancel = [...addPopup()!.querySelectorAll<HTMLButtonElement>('.bz-diary-dialog-foot button')].find((b) => b.textContent === '取消')!;
    cancel.click();
    expect(addMask()).toBeNull(); // 无输入直接收
    openWriteDialog();
    pickType('日记');
    const cancel2 = [...addPopup()!.querySelectorAll<HTMLButtonElement>('.bz-diary-dialog-foot button')].find((b) => b.textContent === '取消')!;
    cancel2.click();
    expect(confirmPopup()).not.toBeNull();
    discardBtn()!.click();
    await flush();
    expect(addMask()).toBeNull();
  });

  it('bz-diary-write 直开路径（不拉主面板）ESC 生效：同一 ESC 层由弹窗壳自带', () => {
    openAddDialog({ yearRange: { min: 2020, max: 2026 } }); // 命令直开形态
    esc();
    expect(addMask()).toBeNull();
  });

  it('D-UI5：开壳焦点由壳接管落在可交互元素上（不再 no-op 聚焦 display:none 隐藏 input）', () => {
    openWriteDialog();
    const popup = addPopup()!;
    expect(popup.contains(document.activeElement)).toBe(true);
    // 合并批口径：B 批 D-UI10 给日期展示区补 tabindex=0（Enter/Space 开滚轮）后，
    // 表单首个可交互元素 = 日期展示区（DIV），过滤框退居其次——焦点必落可交互元素即可
    const el = document.activeElement as HTMLElement;
    expect(['DIV', 'INPUT']).toContain(el.tagName);
    expect(el.getAttribute('tabindex') === '0' || el.tagName === 'INPUT').toBe(true);
  });
});

describe('D-UI2：标签选择器 ESC 层 + 脏表单分流', () => {
  it('选中集 = 原标签集（无改动）按 ESC：直接收', () => {
    openPicker(['日记']);
    expect(tagMask()).not.toBeNull();
    esc();
    expect(tagMask()).toBeNull();
  });

  it('改动未保存按 ESC：走 confirmDiscard，「放弃」才收', async () => {
    const popup = openPicker(['日记']);
    popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="日记"]')!.click(); // 取消原标签
    esc();
    expect(confirmPopup()).not.toBeNull();
    keepBtn()!.click();
    await flush();
    expect(tagMask()).not.toBeNull();
    esc();
    discardBtn()!.click();
    await flush();
    expect(tagMask()).toBeNull();
  });

  it('hideTagPicker 导出可收壳（宿主 relock 兜底消费面）', () => {
    openPicker(['日记']);
    hideTagPicker();
    expect(tagMask()).toBeNull();
  });
});

describe('效率#1：标签过滤 + 频次前置 + sticky 底栏', () => {
  it('写弹窗不再有过滤框（2026-09-19 移除）；标签选择器浮层过滤仍工作', () => {
    openWriteDialog();
    // 写弹窗侧「筛选类型」过滤框已按用户要求移除：chips 直选即可
    expect(addPopup()!.querySelector('.bz-diary-tag-filter')).toBeNull();
    // 选择器浮层的过滤框不受影响（回归钉）
    const popup = openPicker(['日记']);
    const filter = popup.querySelector('.bz-diary-tag-filter input') as HTMLInputElement;
    filter.value = '日';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
    const chips = [...popup.querySelectorAll<HTMLElement>('.diary-tag-selector-btn')];
    expect(chips.find((b) => b.dataset.tag === '日记')!.style.display).toBe('');
    expect(chips.find((b) => b.dataset.tag === '骑行')!.style.display).toBe('none');
  });

  it('chip 按使用频次前置（diary:entry-added 域事件历史）；无历史保持原序', () => {
    const firstOf = () => document.querySelector<HTMLElement>('#add-diary-type-container .diary-tag-selector-btn')!.dataset.tag;
    openWriteDialog();
    const baseline = firstOf(); // 无历史 = 配置原序首位（默认表为「日记」）
    expect(baseline).toBe('日记');
    addMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 无输入直接收，清场
    expect(addMask()).toBeNull();
    emitDomainEvent('diary:entry-added', { date: '2024-01-01', time: '10:00', tags: ['骑行'], content: '' });
    openWriteDialog();
    expect(firstOf()).toBe('骑行'); // 用过的前置（默认序中骑行不在首位）
  });

  it('sticky 底栏：保存/取消在滚动区外常驻（结构 + CSS 守卫）', () => {
    openWriteDialog();
    const popup = addPopup()!;
    const scroll = popup.querySelector('.bz-diary-chip-scroll')!;
    const foot = popup.querySelector('.bz-diary-dialog-foot')!;
    expect(scroll).not.toBeNull();
    expect(foot).not.toBeNull();
    expect(scroll.contains(foot)).toBe(false); // 底栏不随 chips 滚走
    const css = readFileSync(resolve(process.cwd(), 'src/diary/styles.css'), 'utf8');
    expect(css.match(/\.bz-diary-chip-scroll\s*\{([^}]*)\}/)![1]).toContain('overflow-y: auto');
    expect(css.match(/\.bz-diary-dialog-foot\s*\{([^}]*)\}/)![1]).toContain('flex-shrink: 0');
  });
});

describe('一致#1/#2/#7 + D-UI15：口径与域皮', () => {
  it('新建弹窗动作钮 = 「取消/添加」（新建 = 添加口径）；选择器 = 「删除/保存」（编辑 = 保存口径）', () => {
    openWriteDialog();
    expect(footButtons(addPopup())).toEqual(['取消', '添加']);
    addMask()!.dispatchEvent(new MouseEvent('click', { bubbles: true })); // 无输入直接收
    openPicker(['日记']);
    expect(footButtons(tagPopup())).toEqual(['删除', '保存']);
    expect(tagPopup()!.querySelector('.bz-diary-dialog-foot .bz-btn--danger')).not.toBeNull(); // 删除钮 danger 族
  });

  it('弹窗壳迁 bz- 域皮类（遮罩/圆角/阴影 token 随壳），遗留 id 保留供卸载兜底', () => {
    openWriteDialog();
    expect(addPopup()!.classList.contains('bz-overlay-popup')).toBe(true);
    expect(addPopup()!.classList.contains('bz-diary-add-popup')).toBe(true);
    expect(addMask()!.classList.contains('bz-overlay-mask')).toBe(true);
    expect(addPopup()!.getAttribute('role')).toBe('dialog');
    hideTagPicker();
    openPicker(['日记']);
    expect(tagPopup()!.classList.contains('bz-diary-tag-popup')).toBe(true);
  });

  it('默认日期键走 core localDayKey（一致#7）', () => {
    openWriteDialog();
    const value = (document.getElementById('add-diary-datetime') as HTMLInputElement).value;
    expect(value.startsWith(`${localDayKey()} `)).toBe(true);
  });

  it('D-UI11/D-UI15：chip 文本走 textContent + 角标 createElement 拼装；挂 bz-touch-target--xl', () => {
    openWriteDialog();
    const chips = [...document.querySelectorAll<HTMLButtonElement>('#add-diary-type-container .diary-tag-selector-btn')];
    expect(chips.length).toBeGreaterThan(0);
    const sub = chips.find((b) => isSubTag(b.dataset.tag!));
    if (sub) {
      const badge = sub.querySelector('.bz-diary-tag-badge')!;
      expect(badge).not.toBeNull();
      expect(badge.textContent).toBe(getTagEmoji(getParentPrimaryTag(sub.dataset.tag!)!));
      expect(badge.hasAttribute('style')).toBe(false); // 不再内联样式
    }
    expect(chips.every((b) => b.classList.contains('bz-touch-target--xl'))).toBe(true);
  });
});

describe('D-UI12/效率#3：保存进行中视觉反馈与防连点', () => {
  it('写日记：写盘期间「添加」禁用 + 「保存中…」，失败后复位可重试', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    let release!: () => void;
    const gate = new Promise<never>((_, reject) => (release = () => reject(new Error('磁盘只读'))));
    vi.spyOn(vault, 'create').mockImplementation(() => gate);
    const saving = saveNewEntry();
    await flush();
    // 主钮按位置取（foot 末位）：写盘期文案已是「保存中…」，按文本找不到
    const add = [...addPopup()!.querySelectorAll('.bz-diary-dialog-foot button')].pop() as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    expect(add.textContent).toBe('保存中…');
    release(); // 写盘失败
    await flush(10);
    await saving; // saveNewEntry 内部兜底不外抛
    expect(getNoticeMessages().join('\n')).toContain('保存失败（日记）');
    expect(addPopup()).not.toBeNull(); // 失败弹窗保留
    const add2 = [...addPopup()!.querySelectorAll('.bz-diary-dialog-foot button')].pop() as HTMLButtonElement;
    expect(add2.disabled).toBe(false);
    expect(add2.textContent).toBe('添加');
  });

  it('标签选择器：保存写盘期间禁用 + 防连点（第二次点击被忽略），成功才收壳', async () => {
    vault.files.set('我的/日记/2401010800.md', '---\ndate: 2024-01-01 08:00\ntype:\n  - 日记\n---\n\nA\n');
    const popup = openPicker(['日记']);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const realModify = vault.modify.bind(vault);
    const modify = vi.spyOn(vault, 'modify').mockImplementation(async (file: any, content: string) => {
      await gate; // 拖慢写盘窗口
      await realModify(file, content); // 放行后写透盘面，供落盘断言
    });
    const save = [...popup.querySelectorAll('.bz-diary-dialog-foot button')].find((b) => b.textContent === '保存') as HTMLButtonElement;
    popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="骑行"]')!.click();
    save.click();
    await flush();
    expect(save.disabled).toBe(true); // 写盘进行中禁用
    expect(save.textContent).toBe('保存中…');
    save.click(); // 防连点：进行中再点被忽略
    expect(modify).toHaveBeenCalledTimes(1);
    release();
    await flush(10);
    expect(tagMask()).toBeNull(); // 成功才收壳
    expect(vault.files.get('我的/日记/2401010800.md')).toContain('  - 骑行');
  });
});

describe('func N1：改标签整链兜底与加密短路', () => {
  it('写盘失败（非守卫错误）：人话通知「改标签失败」，弹窗保留可重试', async () => {
    vault.files.set('我的/日记/2401010800.md', '---\ndate: 2024-01-01 08:00\ntype:\n  - 日记\n---\n\nA\n');
    const popup = openPicker(['日记']);
    vi.spyOn(vault, 'modify').mockRejectedValue(new Error('磁盘只读'));
    const save = [...popup.querySelectorAll('.bz-diary-dialog-foot button')].find((b) => b.textContent === '保存') as HTMLButtonElement;
    popup.querySelector<HTMLButtonElement>('.diary-tag-selector-btn[data-tag="骑行"]')!.click();
    save.click();
    await flush(10);
    expect(getNoticeMessages().join('\n')).toContain('改标签失败：磁盘只读');
    expect(tagPopup()).not.toBeNull(); // 失败留弹窗
    expect(save.disabled).toBe(false); // 按钮复位可重试
    expect(save.textContent).toBe('保存');
    expect(vault.files.get('我的/日记/2401010800.md')).toContain('  - 日记'); // 未盲写
  });

  it('加密条目保存前 isUnlocked() 短路：保险箱已锁直接人话，不进确认框（不再 unhandled 假成功）', async () => {
    const popup = openPicker(['加密', '日记'], { encrypted: true, noteId: 'note-1' });
    const save = [...popup.querySelectorAll('.bz-diary-dialog-foot button')].find((b) => b.textContent === '保存') as HTMLButtonElement;
    save.click();
    await flush(10);
    expect(getNoticeMessages().join('\n')).toContain('保险箱已上锁');
    expect(confirmPopup()).toBeNull(); // 未进「改分类」确认框
    expect(tagPopup()).not.toBeNull();
  });
});

describe('效率#2：bindFormSubmit 接入（写弹窗 → saveNewEntry / 选择器 → 保存回调）', () => {
  it('Ctrl+Enter 恒提交：未选类型被写层校验拦截（证明绑达 saveNewEntry）', async () => {
    openWriteDialog();
    addPopup()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    await flush();
    expect(getNoticeMessages().join('\n')).toContain('请至少选择一个类型');
  });

  it('单行 input 聚焦的纯 Enter 提交：日期+类型就绪时写盘收壳', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    const datetimeInput = document.getElementById('add-diary-datetime')!;
    datetimeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush(10);
    expect(vault.files.has('我的/日记/2401011030.md')).toBe(true);
    expect(addMask()).toBeNull();
  });

  it('手输日期消费形态（target 阶段 keypress preventDefault）不重复提交', async () => {
    openWriteDialog('2024-01-01 10:30');
    pickType('日记');
    const datetimeInput = document.getElementById('add-diary-datetime')!;
    datetimeInput.addEventListener('keypress', (e) => e.preventDefault()); // 模拟 datetime-picker commitManualEdit
    datetimeInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush(10);
    expect(vault.files.has('我的/日记/2401011030.md')).toBe(false); // 未双发保存
    expect(addMask()).not.toBeNull();
  });

  // 「过滤框回车不提交」随写弹窗过滤框移除一并退役（2026-09-19）；豁免机制由 bindFormSubmit 单元覆盖
});

describe('useFileDateTime 既有行为不受迁壳影响（回归钉）', () => {
  it('打开的条目文件 → 默认日期取该条目日期', () => {
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS, useFileDateTime: true }) as any);
    const app = mockAppWithVault(vault) as any;
    app.workspace.getActiveViewOfType = () => ({ file: { path: '我的/日记/2506110830.md', basename: '2506110830' } });
    setApp(app);
    openAddDialog();
    const value = (document.getElementById('add-diary-datetime') as HTMLInputElement).value;
    expect(value.startsWith('2025-06-11 ')).toBe(true);
  });
});
