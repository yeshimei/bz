/**
 * 备忘录（memo）· T6-T9 可翻转钉死（review-deep memo-arch 测试缺口 6/7/8/9）
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 四个开关钉死的是本批基线（master @ 8f05c3d7，批 E 零源码改动）的「现状行为」。
 * 对应并行修复批：
 *   - OPEN_FOR_NOTE_RESETS_SCENE    → 批 B（读链守卫 / openForNote 重置场景，memo-arch A3）
 *   - COMPOSER_READS_DEFAULT_PRIORITY → 批 D（jumpToNote await / composer 优先级，memo-arch A5）
 *   - AWAIT_OPEN_FILE               → 批 D（jumpToNote await，memo-arch A2）
 *   - READ_FAILURE_ERROR_STATE      → 读盘抛错兜底（memo-arch A9；未入 A–D 批清单，
 *                                     由主线程拍板修复落地后翻转）
 * 并行修复合并进 master 后，主线程把对应开关翻 true 即断言翻转为「必须」语义
 * （修复后行为成为契约）；开关值必须始终与被钉死的可观测行为一致。
 * 参考先例：tests/diary/wall-event-contract.test.ts 的 EMIT_* 开关。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import moment from 'moment';
import { setApp } from '../../src/core/app';
import { setSettingsProvider, setSettingsSaver } from '../../src/core/settings-provider';
import { resetObsidianMocks, hasNotice } from '../mock-obsidian-entry';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { M, resetMemoState } from '../../src/memo/state';
import { openMemoPanel, closeMemoPanel } from '../../src/memo/ui';
import { unloadMemo } from '../../src/memo'; // index 版 = ui 卸载 + 提醒后台卸载，两处都收
import { MemoData } from '../../src/memo/data';

/** 【期望配置】见文件头「可配置期望约定」：现状全部 false（钉旧基线行为），修复合并后翻转 */
const OPEN_FOR_NOTE_RESETS_SCENE = true; // 批 B 已合并：openForNote 已开分支重置 activeScene='全部'
const COMPOSER_READS_DEFAULT_PRIORITY = true; // 批 D 已合并：composer 读 memoDefaultPriority
const AWAIT_OPEN_FILE = true; // 批 D 已合并：jumpToNote await openFile 后再取 editor
const READ_FAILURE_ERROR_STATE = true; // 批 B 已合并：读盘抛错面板渲染错误空态

const SETTINGS = {
  storagePath: 'CONFIG/STORAGE',
  memoScenarios: '',
  memoSortMode: 'priority',
  memoDefaultPriority: 'important', // T7：设置与现状行为相左（composer 恒 minor 才暴露口径分裂）
  memoDefaultScene: '',
  memoOpenScene: '全部',
  memoDoneWindow: '30',
  autoPopupOnStart: false, // T6：关启动弹出，聚焦 file-open 链
  openNoteReminder: true,
  cinemaFolderPath: '我的/影视',
};

function at(dayOffset: number, hm: string): string {
  return moment().add(dayOffset, 'days').format(`YYYY-MM-DD ${hm}:00`);
}

/** app mock：workspace 支持 on/offref/emit（file-open 链）+ 可注入 getLeaf（jumpToNote 链） */
function seedVault(items: Record<string, unknown>[]): { vault: MockVault; app: any } {
  const vault = new MockVault();
  vault.files.set('CONFIG/STORAGE/memo.json', JSON.stringify(items, null, 2));
  const settings = { ...SETTINGS };
  const app = mockAppWithVault(vault) as any;
  const handlers: Record<string, Function[]> = {};
  app.workspace = {
    ...app.workspace,
    on: (ev: string, cb: any) => {
      (handlers[ev] ||= []).push(cb);
      return { event: ev, cb };
    },
    offref: (ref: any) => {
      if (!ref || !ref.event) return;
      const arr = handlers[ref.event] || [];
      const idx = arr.indexOf(ref.cb);
      if (idx >= 0) arr.splice(idx, 1);
    },
    emit: (ev: string, ...args: any[]) => {
      for (const cb of handlers[ev] || []) cb(...args);
    },
  };
  setApp(app);
  setSettingsProvider(() => settings as any);
  setSettingsSaver(vi.fn(async () => {}));
  MemoData.init(settings as any);
  return { vault, app };
}

function baseItem(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'x', title: '条目', scene: '工作', priority: 'minor', created: at(-1, '10:00'),
    completed: null, due: null, notePath: null, notePosition: null,
    scriptName: null, courseName: null, coursePath: null, linkedNote: null, url: null,
    ...extra,
  };
}

async function openPanel(app: any): Promise<HTMLElement> {
  openMemoPanel(app);
  await vi.waitFor(() => {
    expect(document.querySelectorAll('.bz-memo-card').length).toBeGreaterThan(0);
  });
  return document.querySelector('.bz-panel-overlay') as HTMLElement;
}

beforeEach(() => {
  resetObsidianMocks();
  resetMemoState();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  unloadMemo(); // index 版：面板 + vault 同步订阅 + 提醒后台全收
  closeMemoPanel();
  document.body.innerHTML = '';
});

describe('T6 openForNote 已开分支场景态（开关 OPEN_FOR_NOTE_RESETS_SCENE，批 B）', () => {
  it('面板停在「学习」时 file-open 提醒定位：现状不重置场景（目标可能被场景过滤挡掉）；修复后必须重置「全部」', async () => {
    const { vault, app } = seedVault([
      baseItem({ id: 'a', title: '笔记关联的重要备忘', notePath: '笔记/提醒目标.md', priority: 'important', scene: '学习' }),
    ]);
    // 注册提醒后台（file-open 捕获链）
    const { ensureMemoReminders } = await import('../../src/memo');
    ensureMemoReminders(app);
    const overlay = await openPanel(app);

    // 用户正停在「学习」场景
    (overlay.querySelector('[data-memo-scene="学习"]') as HTMLElement).click();
    expect(M.activeScene).toBe('学习');

    // 打开目标笔记 → 提醒改道定位（hasPendingUrgent 命中）
    app.workspace.emit('file-open', vault.file('笔记/提醒目标.md'));
    await vi.waitFor(() => {
      const input = overlay.querySelector('[data-memo-search]') as HTMLInputElement;
      expect(input.value).toBe('笔记/提醒目标.md');
    });
    // 两态共同的定位面：搜索词预设笔记路径
    expect(M.search).toBe('笔记/提醒目标.md');

    if (OPEN_FOR_NOTE_RESETS_SCENE) {
      // 修复后（必须）：场景过滤不再挡目标条目——activeScene 重置「全部」
      expect(M.activeScene).toBe('全部');
      await vi.waitFor(() => {
        expect(overlay.textContent).toContain('笔记关联的重要备忘');
      });
    } else {
      // 现状（钉死）：只写搜索不重置场景——用户场景为「学习」时该条目恰好在场纯属巧合
      expect(M.activeScene).toBe('学习');
    }
  });
});

describe('T7 composer 优先级口径（开关 COMPOSER_READS_DEFAULT_PRIORITY，批 D）', () => {
  it('memoDefaultPriority=important 时 composer 录入：现状恒 minor（设置只对编辑器生效）；修复后必须读设置', async () => {
    const { vault, app } = seedVault([baseItem({ id: 'a' })]);
    const overlay = await openPanel(app);
    const input = overlay.querySelector('[data-memo-composer-input]') as HTMLInputElement;
    input.value = '优先级口径探针条目';
    (overlay.querySelector('[data-memo-composer-add]') as HTMLElement).click();
    await vi.waitFor(() => {
      const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
      expect(raw.find((r: any) => r.title === '优先级口径探针条目')).toBeTruthy();
    });
    const raw = JSON.parse(vault.files.get('CONFIG/STORAGE/memo.json')!);
    const saved = raw.find((r: any) => r.title === '优先级口径探针条目');
    if (COMPOSER_READS_DEFAULT_PRIORITY) {
      expect(saved.priority).toBe('important'); // 修复后（必须）：两入口同口径
    } else {
      expect(saved.priority).toBe('minor'); // 现状（钉死）：快速录入恒次要
    }
  });
});

describe('T8 jumpToNote 定位时序（开关 AWAIT_OPEN_FILE，批 D）', () => {
  it('点位置标签跳转：现状同步取旧 view 的 editor（openFile 未 await）；修复后必须先 await 再打新 editor', async () => {
    const { vault, app } = seedVault([
      baseItem({ id: 'a', title: '要跳转的条目', notePath: '笔记/跳转目标.md', notePosition: { line: 3, ch: 7 } }),
    ]);
    vault.files.set('笔记/跳转目标.md', '# 跳转目标\n\n目标正文。\n'); // 关联笔记必须在库，否则 jumpToNote 提前返回
    // leaf mock：openFile 异步换 view（旧 editor → 新 editor），记录时序
    const events: string[] = [];
    const mkEditor = (tag: string) => ({
      focus: vi.fn(),
      setCursor: vi.fn(() => events.push(`setCursor:${tag}`)),
      scrollIntoView: vi.fn(),
    });
    const oldEditor = mkEditor('old');
    const newEditor = mkEditor('new');
    const leaf: any = {
      view: { editor: oldEditor },
      openFile: vi.fn(async () => {
        events.push('openFile');
        await Promise.resolve();
        leaf.view = { editor: newEditor }; // openFile 完成后 view 才换新（真机语义）
        events.push('opened');
      }),
    };
    app.workspace.getLeaf = () => leaf;

    const overlay = await openPanel(app);
    // 点卡片 meta 的位置标签 → jumpToNote
    (overlay.querySelector('[data-memo-pos]') as HTMLElement).click();
    await vi.waitFor(() => {
      expect(events).toContain('opened');
    });

    expect(leaf.openFile).toHaveBeenCalledTimes(1);
    expect(leaf.openFile.mock.calls[0][0].path).toBe('笔记/跳转目标.md');

    if (AWAIT_OPEN_FILE) {
      // 修复后（必须）：await openFile 后再取 editor——setCursor 打在新 view 的 editor 上
      expect(events.indexOf('opened')).toBeLessThan(events.indexOf('setCursor:new'));
      expect(newEditor.setCursor).toHaveBeenCalledWith(3, 7);
      expect(newEditor.focus).toHaveBeenCalled();
      expect(oldEditor.setCursor).not.toHaveBeenCalled();
    } else {
      // 现状（钉死）：openFile 未 await 即同步取 editor——定位打在旧 view（上一篇笔记）上，
      // 目标行定位静默失效（review-all2 N8 旧账）
      expect(events).toEqual(['openFile', 'setCursor:old', 'opened']);
      expect(oldEditor.setCursor).toHaveBeenCalledWith(3, 7);
      expect(newEditor.setCursor).not.toHaveBeenCalled();
    }
  });
});

describe('T9 读盘抛错面板兜底（开关 READ_FAILURE_ERROR_STATE，memo-arch A9）', () => {
  it('loadData 读拒绝：现状面板空白 + unhandled rejection；修复后必须错误空态 + 通知且无 unhandled', async () => {
    const { app } = seedVault([baseItem({ id: 'a' })]);
    vi.spyOn(MemoData, 'read').mockRejectedValue(new Error('读盘失败-探针'));

    // unhandledRejection 监听器换岗（vitest 自身监听暂摘，记完恢复）：
    // 现状的 void IIFE 拒绝会逸出为 run 级 unhandled error，这里捕获成可断言信号
    const saved = (process as any).listeners('unhandledRejection');
    (process as any).removeAllListeners('unhandledRejection');
    const seen: any[] = [];
    const recorder = (reason: any) => seen.push(reason);
    (process as any).on('unhandledRejection', recorder);
    try {
      openMemoPanel(app); // ui 直开（不经 ensureMemo，保证唯一拒绝源 = 面板装载 IIFE）
      await new Promise((r) => setTimeout(r, 80));
      const overlay = document.querySelector('.bz-panel-overlay') as HTMLElement;
      expect(overlay).toBeTruthy(); // 面板壳照常打开
      const content = overlay.querySelector('[data-memo-content]') as HTMLElement;

      if (READ_FAILURE_ERROR_STATE) {
        // 修复后（必须）：拒绝被接住——错误空态 + 人话通知，无 unhandled 逸出
        expect(seen).toHaveLength(0);
        expect(overlay.querySelector('.bz-empty')).toBeTruthy();
        expect(hasNotice(/保存失败/)).toBe(true);
      } else {
        // 现状（钉死）：renderAll 未执行（内容区空白无解释），rejection 逸出为 unhandled
        expect(content.innerHTML.trim()).toBe('');
        expect(overlay.querySelector('.bz-empty')).toBeNull();
        expect(seen).toHaveLength(1);
        expect((seen[0] as Error).message).toContain('读盘失败-探针');
      }
    } finally {
      (process as any).removeListener('unhandledRejection', recorder);
      for (const h of saved) (process as any).on('unhandledRejection', h);
    }
  });
});
