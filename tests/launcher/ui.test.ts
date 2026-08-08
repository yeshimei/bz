/**
 * 入口页 UI 测试（ticket 23）：jsdom 交互——单例打开 / 长按编辑模式 /
 * 添加删除 / 拖拽推挤落位 / 档位手柄 / 点击执行并关闭 / 幽灵磁贴 / ESC。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockVault } from '../mock-vault';
import { resetObsidianMocks,  Platform as MockPlatform, getNoticeMessages, hasNotice, clearNotices } from '../mock-obsidian-entry';
import { setApp, getApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { openLauncher, unloadLauncher, calcCellSize, setLauncherShowTextSetter, setLauncherGestureSetter } from '../../src/launcher/ui';
import { LAUNCHER_PATH } from '../../src/launcher/data';

/**
 * jsdom 无真实布局（grid.clientWidth = 0）→ 网格单元尺寸 clamp 到 MIN_CELL=44，步长 = 44 + 间距 12。
 * 真实环境按容器宽度比例计算（见 calcCellSize 测试）。
 */
/**
 * jsdom 无真实布局（grid.clientWidth = 0）→ 网格单元尺寸 clamp 到 MIN_CELL=44，步长 = 44 + 间距 10。
 * 真实环境按容器宽度比例计算（见 calcCellSize 测试）。
 */
const STEP = 58;

const BZ_COMMANDS = [
  { id: 'bz-memo-open-panel', name: '打开备忘录面板', icon: 'sticky-note' },
  { id: 'bz-pw-open-manager', name: '打开密码本', icon: 'key' },
  { id: 'bz-review-open-panel', name: '打开复习面板', icon: 'calendar' },
];

function makeMockApp(vault: MockVault, extraCommands: { id: string; name: string; icon?: string }[] = []) {
  const executed: string[] = [];
  const app: any = {
    vault,
    commands: {
      listCommands: vi.fn(() => [...BZ_COMMANDS, ...extraCommands]),
      executeCommandById: vi.fn((id: string) => {
        executed.push(id);
      }),
    },
    workspace: { on: () => ({ ref: 'r' }), onLayoutReady: (cb: () => void) => cb(), getActiveFile: () => null },
    metadataCache: { getFileCache: () => null },
  };
  return { app, executed };
}

async function openOnce(
  vault: MockVault,
  settings: Record<string, any> = {},
  extraCommands: { id: string; name: string; icon?: string }[] = []
) {
  const { app, executed } = makeMockApp(vault, extraCommands);
  setApp(app);
  setSettingsProvider(() => ({ launcherColumns: '6', ...settings }) as any);
  openLauncher(app);
  // 等待 loadLauncherData 完成
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  return { app, executed };
}

function gridTiles(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#launcher-grid .launcher-tile')];
}

/**
 * 长按进入编辑模式（render 重建后返回新磁贴）。
 * 真实场景中长按后松手会触发一次 click——消费它（编辑模式菜单由后续点击打开）。
 */
function longPressEnterEdit(tile: HTMLElement | undefined, x = 50, y = 50): HTMLElement {
  if (!tile) return document.createElement('div'); // 兜底（测试中磁贴必存在）
  vi.useFakeTimers();
  try {
    firePointer(tile, 'pointerdown', x, y);
    vi.advanceTimersByTime(500);
  } finally {
    vi.useRealTimers();
  }
  const fresh = gridTiles().find((t) => t.dataset.tileId === tile.dataset.tileId) || gridTiles()[0];
  if (fresh) fresh.click(); // 消费长按遗留的 click 抑制
  return fresh as HTMLElement;
}

function firePointer(el: EventTarget, type: string, clientX: number, clientY: number) {
  el.dispatchEvent(new PointerEvent(type, { clientX, clientY, bubbles: true, cancelable: true }));
}

describe('入口页 UI', () => {
  beforeEach(() => {
    resetObsidianMocks();
    document.body.innerHTML = '';
    setSettingsProvider(() => ({}) as any);
  });

  afterEach(() => {
    unloadLauncher();
    document.body.innerHTML = '';
    setApp(null as any);
  });

  it('打开：弹窗挂载 + 空态提示 + 无标题栏', async () => {
    await openOnce(new MockVault());
    expect(document.getElementById('launcher-overlay')).not.toBeNull();
    expect(document.getElementById('launcher-modal')).not.toBeNull();
    expect(document.getElementById('launcher-empty')).not.toBeNull();
    expect(document.querySelector('.launcher-toolbar')).toBeNull(); // 标题栏已移除
  });

  it('单例：重复打开不重建（复用聚焦）', async () => {
    const vault = new MockVault();
    await openOnce(vault);
    openLauncher((getApp() as any));
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('#launcher-overlay').length).toBe(1);
  });

  it('读取已有布局：launcher.json 磁贴渲染（含自定义图标）', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [
          { id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 2, h: 1, icon: 'star' },
          { id: 't2', commandId: 'bz-pw-open-manager', x: 2, y: 0, w: 1, h: 1 },
        ],
      })
    );
    await openOnce(vault);
    const tiles = gridTiles();
    expect(tiles.length).toBe(2);
    expect(tiles[0].dataset.commandId).toBe('bz-memo-open-panel');
    expect(tiles[0].style.gridColumn).toBe('1 / span 2');
    // 自定义图标优先于命令 icon
    expect(tiles[0].querySelector<HTMLElement>('.launcher-icon')!.dataset.icon).toBe('star');
    expect(tiles[1].querySelector<HTMLElement>('.launcher-icon')!.dataset.icon).toBe('key');
  });

  it('长按 0.5s 进入编辑模式：tile.editing + 完成按钮显示', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }],
      })
    );
    await openOnce(vault);
    let tile = gridTiles()[0];
    vi.useFakeTimers();
    try {
      firePointer(tile, 'pointerdown', 50, 50);
      expect(tile.classList.contains('editing')).toBe(false);
      vi.advanceTimersByTime(500);
      // render 重建 DOM，重新查询
      tile = gridTiles()[0];
      expect(tile.classList.contains('editing')).toBe(true);
      // 编辑模式：无删除按钮/手柄（已收进操作菜单）
      expect(tile.querySelector('.launcher-del')).toBeNull();
      expect(tile.querySelector('.launcher-resize')).toBeNull();
      // 完成按钮 + 列数选择悬浮显示（编辑模式唯一显式出口）；控件距顶部 34px
      const done = document.getElementById('launcher-done-btn')!;
      expect(done).not.toBeNull();
      expect(done.style.display).not.toBe('none');
      expect(document.getElementById('launcher-columns-sel')).not.toBeNull();
      expect(document.getElementById('launcher-text-toggle')).not.toBeNull();
      expect(document.getElementById('launcher-edit-controls')!.style.top).toBe('34px');
    } finally {
      vi.useRealTimers();
    }
  });

  it('长按前快速移动/松开取消进编辑', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    const tile = gridTiles()[0];
    vi.useFakeTimers();
    try {
      firePointer(tile, 'pointerdown', 50, 50);
      firePointer(tile, 'pointermove', 80, 50); // 移动 30px > 10px 阈值
      vi.advanceTimersByTime(500);
      expect(tile.classList.contains('editing')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('长按空白区域进入编辑模式（空态无磁贴时的入口）', async () => {
    await openOnce(new MockVault());
    const grid = document.getElementById('launcher-grid')!;
    expect(grid.querySelector('#launcher-empty')).not.toBeNull();
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      expect(document.getElementById('launcher-done-btn')!.style.display).toBe('none');
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    // 编辑模式：空白单元格「＋」出现 + 完成按钮可见
    expect(document.querySelectorAll('#launcher-grid .launcher-empty-cell').length).toBeGreaterThan(0);
    expect(document.getElementById('launcher-done-btn')!.style.display).not.toBe('none');
  });

  it('添加：编辑模式点空白格「＋」→ 命令选择器 → 过滤 → 选中 → 1×1 落末尾 + 写盘', async () => {
    const vault = new MockVault();
    await openOnce(vault);
    // 长按空白进入编辑模式
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
    expect(document.getElementById('launcher-cmd-mask')).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>('#launcher-cmd-popup input')!;
    input.value = '备忘';
    input.dispatchEvent(new Event('input'));
    const items = document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item');
    expect(items.length).toBe(1);
    expect(items[0].dataset.commandId).toBe('bz-memo-open-panel');
    items[0].click();
    // 等待写盘（saveLauncherData 建目录/建文件为异步链）
    await new Promise((r) => setTimeout(r, 0));
    // 磁贴出现 + 保存 + 进入编辑模式 + 固化命令自带图标
    const tiles = gridTiles();
    expect(tiles.length).toBe(1);
    expect(tiles[0].dataset.commandId).toBe('bz-memo-open-panel');
    expect(tiles[0].classList.contains('editing')).toBe(true);
    expect(tiles[0].querySelector<HTMLElement>('.launcher-icon')!.dataset.icon).toBe('sticky-note');
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0]).toMatchObject({
      commandId: 'bz-memo-open-panel',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      icon: 'sticky-note', // 命令有图标 → 默认固化
    });
  });

  it('添加无图标命令 → 不固化 icon（运行时兜底）', async () => {
    const vault = new MockVault();
    await openOnce(vault, {}, [{ id: 'bz-no-icon-cmd', name: '无图标命令' }]);
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
    const items = [...document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item')];
    items.find((i) => i.dataset.commandId === 'bz-no-icon-cmd')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0].icon).toBeUndefined(); // 无图标不固化
    expect(saved.desktop.tiles[0].commandId).toBe('bz-no-icon-cmd');
  });

  it('命令图标不在本地清单但 Obsidian 有效 → setIcon 渲染（不显示图标文字）', async () => {
    const vault = new MockVault();
    await openOnce(vault, {}, [{ id: 'bz-extra-icon', name: '外部命令', icon: 'pencil-line' }]);
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
    const items = [...document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item')];
    items.find((i) => i.dataset.commandId === 'bz-extra-icon')!.click();
    await new Promise((r) => setTimeout(r, 0));
    // 图标名未在 LUCIDE_ICONS 清单（仅 pencil）→ 但 getIcon 有效 → setIcon，不显示文字
    const iconEl = gridTiles()[0].querySelector<HTMLElement>('.launcher-icon')!;
    expect(iconEl.dataset.icon).toBe('pencil-line');
    expect(iconEl.textContent).toBe('');
  });

  it('添加多个：依次落末尾空位', async () => {
    const vault = new MockVault();
    await openOnce(vault);
    // 长按空白进入编辑模式
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    const pick = (id: string) => {
      document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
      const items = [...document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item')];
      items.find((i) => i.dataset.commandId === id)!.click();
    };
    pick('bz-memo-open-panel');
    pick('bz-pw-open-manager');
    pick('bz-review-open-panel');
    const tiles = gridTiles();
    expect(tiles.map((t) => t.dataset.commandId)).toEqual([
      'bz-memo-open-panel',
      'bz-pw-open-manager',
      'bz-review-open-panel',
    ]);
    expect(tiles[0].style.gridColumn).toBe('1 / span 1');
    expect(tiles[1].style.gridColumn).toBe('2 / span 1');
    expect(tiles[2].style.gridColumn).toBe('3 / span 1');
  });

  it('删除：编辑模式点磁贴 → 操作菜单 → 删除 + 写盘', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    const tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    // 编辑模式：无移动点击 → 操作菜单
    gridTiles()[0].click();
    expect(document.getElementById('launcher-menu-mask')).not.toBeNull();
    const rows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    expect(rows.some((r) => r.textContent!.includes('删除磁贴'))).toBe(true);
    rows.find((r) => r.textContent!.includes('删除磁贴'))!.click();
    expect(gridTiles().length).toBe(0);
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles.length).toBe(0);
  });

  it('点击磁贴：执行命令并关闭入口页', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    const { executed } = await openOnce(vault);
    const tile = gridTiles()[0];
    tile.click();
    expect(executed).toEqual(['bz-memo-open-panel']);
    expect(document.getElementById('launcher-overlay')).toBeNull();
  });

  it('幽灵磁贴：命令失效 → ghost 类；点击提示不执行；可删除', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [
          { id: 't1', commandId: 'bz-gone-command', x: 0, y: 0, w: 1, h: 1 }, // 失效
          { id: 't2', commandId: 'bz-memo-open-panel', x: 1, y: 0, w: 1, h: 1 },
        ],
      })
    );
    const { executed } = await openOnce(vault);
    const tiles = gridTiles();
    expect(tiles[0].classList.contains('ghost')).toBe(true);
    expect(tiles[1].classList.contains('ghost')).toBe(false);
    // 点击幽灵 → 不执行 + 提示
    gridTiles()[0].click();
    expect(executed).toEqual([]);
    expect(hasNotice(/命令不存在/)).toBe(true);
    // 编辑模式可删除（操作菜单）
    longPressEnterEdit(gridTiles()[1], 150, 50);
    const ghost = gridTiles().find((t) => t.dataset.commandId === 'bz-gone-command')!;
    ghost.click();
    const rows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    rows.find((r) => r.textContent!.includes('删除磁贴'))!.click();
    expect(gridTiles().map((t) => t.dataset.commandId)).toEqual(['bz-memo-open-panel']);
  });

  it('拖拽移动：编辑模式拖主体 → 推挤落位 + 写盘', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [
          { id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 },
          { id: 't2', commandId: 'bz-pw-open-manager', x: 1, y: 0, w: 1, h: 1 },
        ],
      })
    );
    await openOnce(vault);
    // 进编辑模式（长按 t2）
    longPressEnterEdit(
      gridTiles().find((t) => t.dataset.commandId === 'bz-pw-open-manager'), 160, 50);
    // 拖 t2（(1,0)）到 (3,0)：pointerdown 中心 (1*STEP+STEP/2, STEP/2)
    const t1 = gridTiles().find((t) => t.dataset.commandId === 'bz-memo-open-panel')!;
    firePointer(t1, 'pointerdown', 0 * STEP + STEP / 2, STEP / 2);
    // 目标格 (3,0)：pointer 让磁贴中心落在 (3*STEP+STEP/2, STEP/2)
    firePointer(document, 'pointermove', 3 * STEP + STEP / 2, STEP / 2);
    firePointer(document, 'pointerup', 3 * STEP + STEP / 2, STEP / 2);
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    const moved = saved.desktop.tiles.find((t: any) => t.id === 't1');
    expect(moved).toMatchObject({ x: 3, y: 0 });
    // t2 未被挤（目标区空闲）
    const t2s = saved.desktop.tiles.find((t: any) => t.id === 't2');
    expect(t2s).toMatchObject({ x: 1, y: 0 });
  });

  it('拖拽推挤：目标被占 → 被占磁贴顺移', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [
          { id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 },
          { id: 't2', commandId: 'bz-pw-open-manager', x: 1, y: 0, w: 1, h: 1 },
        ],
      })
    );
    await openOnce(vault);
    // 进编辑模式（长按 t1）
    vi.useFakeTimers();
    try {
      firePointer(gridTiles()[0], 'pointerdown', 50, 50);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    // 拖 t1（(0,0)）到 (1,0)（被 t2 占）
    const t1 = gridTiles().find((t) => t.dataset.commandId === 'bz-memo-open-panel')!;
    firePointer(t1, 'pointerdown', 0 * STEP + STEP / 2, STEP / 2);
    firePointer(document, 'pointermove', 1 * STEP + STEP / 2, STEP / 2);
    // 安卓式实时让位：松手前 t2 已顺移到 (2,0)
    const live = gridTiles().find((t) => t.dataset.commandId === 'bz-pw-open-manager')!;
    expect(live.style.gridColumn).toBe('3 / span 1');
    firePointer(document, 'pointerup', 1 * STEP + STEP / 2, STEP / 2);
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles.find((t: any) => t.id === 't1')).toMatchObject({ x: 1, y: 0 });
    expect(saved.desktop.tiles.find((t: any) => t.id === 't2')).toMatchObject({ x: 2, y: 0 }); // 被挤到右侧
  });

  it('尺寸菜单：编辑模式点磁贴 → 选择 2×2 → 写盘', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    tile.click();
    const rows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    // 当前尺寸标记 ✅ 1×1
    expect(rows.some((r) => r.textContent!.includes('✅ 尺寸 1×1'))).toBe(true);
    rows.find((r) => r.textContent!.includes('尺寸 2×2'))!.click();
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0]).toMatchObject({ w: 2, h: 2 });
  });

  it('尺寸被拒：扩大与邻居重叠 → 保持原尺寸 + 提示', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 3,
        desktop: {
          tiles: [
            { id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 },
            { id: 't2', commandId: 'bz-pw-open-manager', x: 1, y: 0, w: 2, h: 2 },
          ],
          columns: 6,
        },
        mobile: { tiles: [], columns: 6 },
      })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(
      gridTiles().find((t) => t.dataset.commandId === 'bz-memo-open-panel'), 50, 50);
    tile.click();
    const rows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    rows.find((r) => r.textContent!.includes('尺寸 2×2'))!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(hasNotice(/放不下/)).toBe(true);
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles.find((t: any) => t.id === 't1')).toMatchObject({ w: 1, h: 1 });
  });

  it('图标选择器：编辑模式点图标 → 选择 lucide 图标 → 写盘', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    tile.click();
    const menuRows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    menuRows.find((r) => r.textContent!.includes('选择图标'))!.click();
    expect(document.getElementById('launcher-icon-mask')).not.toBeNull();
    const cell = document.querySelector<HTMLElement>('#launcher-icon-popup .launcher-icon-cell[data-icon="star"]')!;
    cell.click();
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0].icon).toBe('star');
  });

  it('改名：编辑模式点名字 → 弹窗输入 → 显示新名 + 写盘 label', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    tile.click();
    const menuRows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    menuRows.find((r) => r.textContent!.includes('修改名称'))!.click();
    expect(document.getElementById('launcher-rename-mask')).not.toBeNull();
    const input = document.querySelector<HTMLInputElement>('#launcher-rename-popup input')!;
    expect(input.value).toBe('打开备忘录面板'); // 预填当前命令名
    input.value = '我的备忘';
    document.querySelector<HTMLElement>('#launcher-rename-popup button[title="保存名称"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(gridTiles()[0].querySelector('.launcher-name')!.textContent).toBe('我的备忘');
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0].label).toBe('我的备忘');
  });

  it('改名清空 → 恢复默认命令名 + label 删除', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 1,
        tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1, label: '自定义名' }],
      })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    tile.click();
    const menuRows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    menuRows.find((r) => r.textContent!.includes('修改名称'))!.click();
    const input = document.querySelector<HTMLInputElement>('#launcher-rename-popup input')!;
    expect(input.value).toBe('自定义名'); // 预填自定义名
    input.value = '   ';
    document.querySelector<HTMLElement>('#launcher-rename-popup button[title="保存名称"]')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(gridTiles()[0].querySelector('.launcher-name')!.textContent).toBe('打开备忘录面板');
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0].label).toBeUndefined();
  });

  it('点击遮罩层关闭入口页', async () => {
    await openOnce(new MockVault());
    const overlay = document.getElementById('launcher-overlay')!;
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(document.getElementById('launcher-overlay')).toBeNull();
  });

  it('列数控件：编辑模式改列数 → 写当前平台配置；越界磁贴自动重排', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 2,
        desktop: [
          { id: 't1', commandId: 'bz-memo-open-panel', x: 4, y: 0, w: 1, h: 1 }, // 6 列下在 x=4
          { id: 't2', commandId: 'bz-pw-open-manager', x: 5, y: 0, w: 1, h: 1 }, // x=5
        ],
        mobile: [],
      })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    const sel = document.getElementById('launcher-columns-sel') as HTMLSelectElement;
    expect(sel.value).toBe('6');
    // 列数改 3：t1(x=4) t2(x=5) 越界 → 自动重排到 3 列网格
    sel.value = '3';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.columns).toBe(3);
    const tiles = saved.desktop.tiles;
    expect(tiles.find((t: any) => t.id === 't1').x + tiles.find((t: any) => t.id === 't1').w).toBeLessThanOrEqual(3);
    expect(tiles.find((t: any) => t.id === 't2').x + tiles.find((t: any) => t.id === 't2').w).toBeLessThanOrEqual(3);
    // 桌面端列数改动不影响 mobile 配置
    expect(saved.mobile.columns).toBe(6);
  });

  it('右上角文字开关：编辑模式点「文」→ 写回设置 + 磁贴文字显隐', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    const settings: Record<string, any> = { launcherColumns: '6' };
    setSettingsProvider(() => ({ ...settings }) as any);
    setLauncherShowTextSetter((v) => {
      settings.launcherShowText = v;
    });
    setApp(makeMockApp(vault).app);
    openLauncher(makeMockApp(vault).app);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    // 默认显示文字
    expect(gridTiles()[0].querySelector('.launcher-name')).not.toBeNull();
    // 长按进编辑 → 点「文」关闭文字
    longPressEnterEdit(gridTiles()[0]);
    document.getElementById('launcher-text-toggle')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.launcherShowText).toBe(false); // 写回设置
    expect(gridTiles()[0].querySelector('.launcher-name')).toBeNull(); // 磁贴仅图标
    // 再点恢复
    document.getElementById('launcher-text-toggle')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(settings.launcherShowText).toBe(true);
    expect(gridTiles()[0].querySelector('.launcher-name')).not.toBeNull();
    setLauncherShowTextSetter(() => {});
  });

  it('右上角手势选择：编辑模式选手势 → 写回设置（设置页已移除入口页项）', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    const settings: Record<string, any> = { launcherColumns: '6' };
    setSettingsProvider(() => ({ ...settings }) as any);
    setLauncherGestureSetter((v) => {
      settings.launcherGesture = v;
    });
    setApp(makeMockApp(vault).app);
    openLauncher(makeMockApp(vault).app);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    longPressEnterEdit(gridTiles()[0]);
    const sel = document.getElementById('launcher-gesture-sel') as HTMLSelectElement;
    expect(sel).not.toBeNull();
    expect(sel.value).toBe('off'); // 默认关闭
    sel.value = 'double';
    sel.dispatchEvent(new Event('change'));
    expect(settings.launcherGesture).toBe('double'); // 写回设置
    setLauncherGestureSetter(() => {});
  });

  it('文字显隐平台独立：移动端字段不影响桌面；未设置继承桌面', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 3,
        desktop: { columns: 6, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] },
        mobile: { columns: 6, tiles: [{ id: 'm1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] },
      })
    );
    // 桌面端：launcherShowTextMobile=false 不影响（桌面看 launcherShowText=true）→ 有文字
    await openOnce(vault, { launcherShowText: true, launcherShowTextMobile: false });
    expect(gridTiles()[0].querySelector('.launcher-name')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // 移动端：launcherShowTextMobile=false → 无文字（桌面 true 不影响）
    MockPlatform.isMobile = true;
    try {
      await openOnce(vault, { launcherShowText: true, launcherShowTextMobile: false });
      expect(gridTiles()[0].querySelector('.launcher-name')).toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      // 移动端未设置 mobile 字段 → 继承桌面 false → 无文字
      await openOnce(vault, { launcherShowText: false });
      expect(gridTiles()[0].querySelector('.launcher-name')).toBeNull();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      // 移动端显式 true → 有文字（桌面 false 不影响）
      await openOnce(vault, { launcherShowText: false, launcherShowTextMobile: true });
      expect(gridTiles()[0].querySelector('.launcher-name')).not.toBeNull();
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  it('手势平台独立：移动端读 launcherGestureMobile；未设置继承桌面', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    const settings: Record<string, any> = { launcherColumns: '6', launcherGesture: 'triple' };
    setSettingsProvider(() => ({ ...settings }) as any);
    setLauncherGestureSetter((v) => {
      settings.launcherGestureMobile = v;
    });
    setApp(makeMockApp(vault).app);
    // 桌面端：读 launcherGesture=triple
    openLauncher(makeMockApp(vault).app);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    longPressEnterEdit(gridTiles()[0]);
    const sel = document.getElementById('launcher-gesture-sel') as HTMLSelectElement;
    expect(sel.value).toBe('triple');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // 移动端未设置 mobile → 继承桌面 triple
    MockPlatform.isMobile = true;
    try {
      openLauncher(makeMockApp(vault).app);
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      longPressEnterEdit(gridTiles()[0]);
      const sel2 = document.getElementById('launcher-gesture-sel') as HTMLSelectElement;
      expect(sel2.value).toBe('triple'); // 继承
      // 移动端改动 → 写 mobile 字段（桌面不动）
      sel2.value = 'swipe';
      sel2.dispatchEvent(new Event('change'));
      expect(settings.launcherGestureMobile).toBe('swipe');
      expect(settings.launcherGesture).toBe('triple');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      // 移动端显式 double → 读 double（桌面 triple 不影响）
      openLauncher(makeMockApp(vault).app);
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
      longPressEnterEdit(gridTiles()[0]);
      const sel3 = document.getElementById('launcher-gesture-sel') as HTMLSelectElement;
      expect(sel3.value).toBe('swipe');
    } finally {
      MockPlatform.isMobile = false;
      setLauncherGestureSetter(() => {});
    }
  });

  it('平台布局：移动端贴底滑入；桌面端居中显示', async () => {
    const vault = new MockVault();
    // 桌面端：居中 + 全圆角 + 淡入（无上滑动画）
    await openOnce(vault);
    expect(document.getElementById('launcher-overlay')!.style.alignItems).toBe('center');
    expect(document.getElementById('launcher-modal')!.style.borderRadius).toBe('14px');
    expect(document.getElementById('launcher-modal')!.style.animation).toContain('launcher-fade-in');
    expect(document.getElementById('launcher-grid')!.style.padding).toBe('16px 18px 20px'); // 桌面端底部 20px
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // 移动端：贴底 + 顶部圆角 + 上滑动画 + 底部大内边距撑起
    MockPlatform.isMobile = true;
    try {
      await openOnce(vault);
      expect(document.getElementById('launcher-overlay')!.style.alignItems).toBe('flex-end');
      expect(document.getElementById('launcher-modal')!.style.borderRadius).toBe('16px 16px 0 0');
      expect(document.getElementById('launcher-modal')!.style.animation).toContain('launcher-slide-up');
      expect(document.getElementById('launcher-grid')!.style.padding).toBe('16px 18px 48px'); // 移动端底部大内边距
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  it('显示文字统一开关：关闭 → 全部磁贴仅图标；开启 → 显示文字', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({
        version: 2,
        desktop: [
          { id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 },
          { id: 't2', commandId: 'bz-pw-open-manager', x: 1, y: 0, w: 1, h: 1 },
        ],
        mobile: [],
      })
    );
    // 默认开启（未设置 launcherShowText）→ 显示文字
    await openOnce(vault);
    expect(gridTiles().every((t) => t.querySelector('.launcher-name'))).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // 统一关闭 → 全部仅图标
    await openOnce(vault, { launcherShowText: false });
    expect(gridTiles().every((t) => t.querySelector('.launcher-name') === null)).toBe(true);
  });

  it('emoji 图标：图标选择器输入字符直接使用（lucide 清单外走文本渲染）', async () => {
    const vault = new MockVault();
    await vault.create(
      LAUNCHER_PATH,
      JSON.stringify({ version: 1, tiles: [{ id: 't1', commandId: 'bz-memo-open-panel', x: 0, y: 0, w: 1, h: 1 }] })
    );
    await openOnce(vault);
    let tile = longPressEnterEdit(gridTiles()[0], 50, 50);
    tile.click();
    const menuRows = [...document.querySelectorAll<HTMLElement>('#launcher-menu-popup .launcher-picker-item')];
    menuRows.find((r) => r.textContent!.includes('选择图标'))!.click();
    const input = document.querySelector<HTMLInputElement>('#launcher-icon-popup input')!;
    input.value = '🚀';
    input.dispatchEvent(new Event('input'));
    const emojiRow = document.querySelector<HTMLElement>('#launcher-icon-popup .launcher-icon-emoji')!;
    expect(emojiRow.dataset.emoji).toBe('🚀');
    emojiRow.click();
    await new Promise((r) => setTimeout(r, 0));
    // 磁贴图标渲染为文本字符（非 setIcon）
    const iconEl = gridTiles()[0].querySelector<HTMLElement>('.launcher-icon')!;
    expect(iconEl.textContent).toBe('🚀');
    expect(iconEl.dataset.icon).toBeUndefined();
    const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
    expect(saved.desktop.tiles[0].icon).toBe('🚀');
  });

  it('移动端与桌面端配置独立互不影响', async () => {
    const vault = new MockVault();
    await openOnce(vault); // 桌面端
    // 桌面端添加一个磁贴
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
    const items = [...document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item')];
    items.find((i) => i.dataset.commandId === 'bz-memo-open-panel')!.click();
    await new Promise((r) => setTimeout(r, 0));
    // 关闭
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('launcher-overlay')).toBeNull();

    // 切移动端环境（Platform.isMobile）
    MockPlatform.isMobile = true;
    try {
      await openOnce(vault);
      // 移动端是独立配置：无磁贴（空态）；列数用移动端独立设置（默认 4 列）
      expect(gridTiles().length).toBe(0);
      expect(document.getElementById('launcher-empty')).not.toBeNull();
      // 移动端默认 6 列（与桌面统一）
      expect(document.getElementById('launcher-grid')!.style.gridTemplateColumns).toBe('repeat(6, minmax(0, 1fr))');
      // 移动端添加另一个命令
      const g2 = document.getElementById('launcher-grid')!;
      vi.useFakeTimers();
      try {
        firePointer(g2, 'pointerdown', 100, 100);
        vi.advanceTimersByTime(500);
      } finally {
        vi.useRealTimers();
      }
      document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
      const items2 = [...document.querySelectorAll<HTMLElement>('#launcher-cmd-popup .launcher-picker-item')];
      items2.find((i) => i.dataset.commandId === 'bz-pw-open-manager')!.click();
      await new Promise((r) => setTimeout(r, 0));
      // 写盘：mobile 有、desktop 保留原样
      const saved = JSON.parse(vault.files.get(LAUNCHER_PATH)!);
      expect(saved.mobile.tiles.length).toBe(1);
      expect(saved.mobile.tiles[0].commandId).toBe('bz-pw-open-manager');
      expect(saved.desktop.tiles.length).toBe(1);
      expect(saved.desktop.tiles[0].commandId).toBe('bz-memo-open-panel');
    } finally {
      MockPlatform.isMobile = false;
    }
  });

  it('calcCellSize：按容器宽度比例计算 + clamp 边界', () => {
    // 6 列、间距 14、内边距 36：宽 800 → (800-36-70)/6 ≈ 115.7
    expect(calcCellSize(800, 6)).toBeCloseTo(115.67, 1);
    // 移动端窄屏：宽 390 → (390-36-70)/6 ≈ 47.3（> MIN 44）
    expect(calcCellSize(390, 6)).toBeCloseTo(47.33, 1);
    // 超窄屏 → clamp 到最小 44
    expect(calcCellSize(300, 6)).toBe(44);
    // 极宽 → clamp 到最大 200
    expect(calcCellSize(2000, 6)).toBe(200);
    // 3 列窄屏：宽 300 → (300-36-28)/3 ≈ 78.7
    expect(calcCellSize(300, 3)).toBeCloseTo(78.67, 1);
  });

  it('ESC 关闭入口页', async () => {
    await openOnce(new MockVault());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('launcher-overlay')).toBeNull();
  });

  it('关闭时清理残留命令选择器', async () => {
    await openOnce(new MockVault());
    const grid = document.getElementById('launcher-grid')!;
    vi.useFakeTimers();
    try {
      firePointer(grid, 'pointerdown', 100, 100);
      vi.advanceTimersByTime(500);
    } finally {
      vi.useRealTimers();
    }
    document.querySelector<HTMLElement>('#launcher-grid .launcher-empty-cell')!.click();
    expect(document.getElementById('launcher-cmd-mask')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('launcher-cmd-mask')).toBeNull();
    expect(document.getElementById('launcher-overlay')).toBeNull();
  });
});
