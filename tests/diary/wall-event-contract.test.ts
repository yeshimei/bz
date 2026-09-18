/**
 * 日记本（diary）· 墙菜单加密/解密动作的域事件契约钉死
 * （review-deep diary-arch 测试缺口 2，随 A2「五通道事件契约半边空洞」立项）
 *
 * 背景：diary 五通道域事件（entry-added/tags-changed/entry-deleted/entry-decrypted/encrypted-purged）
 * 在 master 基线（4ebf37ae）的发射点只有两条路径——
 *   - ui/dialogs.ts（改标签加密分支发 diary:entry-decrypted）
 *   - ui/entry-actions.ts（删除/保险箱销毁发 diary:entry-deleted）
 * 墙右键/抽屉的「加密」（= encryptEntryAction，删源文件）与「解密」（= decryptEntryAction，
 * 还原写盘）走同级磁盘变更却【不发】同通道事件，当前唯一订阅方是墙自身（ui.ts 订阅后自刷兜底），
 * 故暂无实害；后续消费方（smartcat 观察、home 时间线）接入订阅即漏报。
 *
 * 【可配置期望约定】（写明以防无意识漂移，勿删用例）：
 * 下方 EMIT_* 开关钉死的是「合并前 master 现状 = 不发」。该行为已由墙面板修复批（A2）
 * 补发——encryptEntryAction/decryptEntryAction 成功分支现均发同通道事件，开关已翻转为 true
 *（断言方向 = 必发）。开关值必须始终与被钉死的可观测行为一致，翻转开关 = 翻转断言方向。
 * 附：A2 同批在 encryptEntryAction 加了 openFlowDialog 二次确认；本文件将其 mock 为
 * 自动确认（取消分支的行为面由 wall-fix-c.test.ts 钉死），确保成功路径仍走通到事件发射。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DiaryAppController } from '../../src/diary/ui';
import { onDomainEvent } from '../../src/core/domain-bus';
import type { WallEntry } from '../../src/diary/types';

const CHANNELS = ['diary:entry-deleted', 'diary:entry-decrypted'] as const;
type Channel = (typeof CHANNELS)[number];

/** 【期望配置】见文件头「可配置期望约定」：A2 合并后两动作成功分支 = 必发 */
const EMIT_ENTRY_DELETED_ON_ENCRYPT = true;
const EMIT_ENTRY_DECRYPTED_ON_DECRYPT = true;

const mocks = vi.hoisted(() => ({
  findDiaryEntry: vi.fn(),
  removeDiaryEntries: vi.fn(),
  isUnlocked: vi.fn(() => false),
  loadEncryptedEntries: vi.fn(async (): Promise<unknown[]> => []),
  encryptEntry: vi.fn(),
  reclassifyEntry: vi.fn(),
  deleteEncryptedEntry: vi.fn(async () => {}),
  ensureSafeUnlocked: vi.fn(),
  openEncrypt: vi.fn(),
  getSafeManager: vi.fn(() => ({ unlocked: false, manifest: { notes: [] } })),
  openFlowDialog: vi.fn(async () => 'ok'),
}));

// store 保留真实模块（isUnparsedRefusal/isDiaryReadFailure 等被 ui.ts 静态 import），
// 仅覆盖两动作消费的读写入口
vi.mock('../../src/diary/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/diary/store')>();
  return {
    ...actual,
    findDiaryEntry: mocks.findDiaryEntry,
    removeDiaryEntries: mocks.removeDiaryEntries,
  };
});
vi.mock('../../src/diary/encrypt', () => ({
  isUnlocked: mocks.isUnlocked,
  loadEncryptedEntries: mocks.loadEncryptedEntries,
  encryptEntry: mocks.encryptEntry,
  reclassifyEntry: mocks.reclassifyEntry,
  deleteEncryptedEntry: mocks.deleteEncryptedEntry,
}));
// ui.ts 动态 import '../encrypt'（解锁屏/保险箱面板/安全管理器）
vi.mock('../../src/encrypt', () => ({
  ensureSafeUnlocked: mocks.ensureSafeUnlocked,
  openEncrypt: mocks.openEncrypt,
  getSafeManager: mocks.getSafeManager,
}));
// 加密动作的二次确认（效率#12）：mock 为自动确认，取消分支行为面由 wall-fix-c.test.ts 钉死
vi.mock('../../src/core/flow-dialog', () => ({
  openFlowDialog: mocks.openFlowDialog,
}));
// 写链路弹窗与条目动作（ui.ts 静态 import；本文件不触其行为面）
vi.mock('../../src/diary/ui/dialogs', () => ({
  openAddDialog: vi.fn(),
  showTagPicker: vi.fn(),
  hideAddDialog: vi.fn(),
  hideTagPicker: vi.fn(),
}));
vi.mock('../../src/diary/ui/entry-actions', () => ({
  jumpToDiaryEntry: vi.fn(),
  copyDiaryLink: vi.fn(),
  showConfirm: vi.fn(),
}));

/** findDiaryEntry 返回的已存日记条目（store 真实返回形制：DiaryEntry） */
const STORED_ENTRY = {
  date: '2026-05-01',
  time: '12:00',
  timeValue: 1200,
  tags: ['日记'],
  emoji: '📖',
  content: '正文',
  filename: '我的/日记/2605011200.md',
  filePath: '我的/日记/2605011200.md',
  lineNumber: 0,
};

/** 最小 WallEntry 夹具（墙菜单动作消费的定位字段为主） */
function mkWallEntry(over: Partial<WallEntry> = {}): WallEntry {
  return {
    date: '2026-05-01',
    time: '12:00',
    tags: ['日记'],
    emoji: '📖',
    content: '正文',
    filename: '我的/日记/2605011200.md',
    filePath: '我的/日记/2605011200.md',
    lineNumber: 0,
    kind: 'diary',
    media: [],
    text: '正文',
    segments: [],
    ...over,
  };
}

/** 订阅两通道计数（用例内自管订阅/退订，不污染其他文件） */
function watchChannels() {
  const seen: Record<Channel, number> = { 'diary:entry-deleted': 0, 'diary:entry-decrypted': 0 };
  const offs = CHANNELS.map((ch) =>
    onDomainEvent(ch, () => {
      seen[ch] += 1;
    })
  );
  return { seen, stop: () => offs.forEach((off) => off()) };
}

/** 可配置期望断言：expected=true 钉「必发」（≥1 次），false 钉「现状不发」（0 次） */
function assertContract(seen: Record<Channel, number>, channel: Channel, expected: boolean) {
  if (expected) {
    expect(seen[channel], `【必发】${channel}：开关为 true 但事件未被观测到`).toBeGreaterThanOrEqual(1);
  } else {
    expect(seen[channel], `【现状不发】${channel}：开关为 false 但观测到事件（行为漂移，见文件头约定）`).toBe(0);
  }
}

/** 独立 controller（不走 getInstance 单例）+ 替换 loadAndRender（成功分支的 fire-and-forget 自刷） */
function freshController(): DiaryAppController {
  const c = new DiaryAppController();
  (c as unknown as { loadAndRender: unknown }).loadAndRender = vi.fn();
  return c;
}

beforeEach(() => {
  mocks.findDiaryEntry.mockReset();
  mocks.removeDiaryEntries.mockReset();
  mocks.encryptEntry.mockReset();
  mocks.reclassifyEntry.mockReset();
  mocks.ensureSafeUnlocked.mockReset();
  mocks.deleteEncryptedEntry.mockClear();
  // 默认 = 两动作的「一路绿灯」成功路径；失败分支用例内覆写
  mocks.ensureSafeUnlocked.mockResolvedValue(true);
  mocks.findDiaryEntry.mockResolvedValue({ ...STORED_ENTRY });
  mocks.encryptEntry.mockResolvedValue({ ...STORED_ENTRY, noteId: 'note-1' });
  mocks.removeDiaryEntries.mockResolvedValue(1);
  mocks.reclassifyEntry.mockResolvedValue(true);
});

describe('墙菜单加密动作（encryptEntryAction）域事件契约', () => {
  it('加密成功（源文件被删）：diary:entry-deleted 按开关钉死现状', async () => {
    const c = freshController();
    const w = watchChannels();
    try {
      await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction(
        mkWallEntry()
      );
    } finally {
      w.stop();
    }
    // 证明确实走完成功分支（库密文 + 原文摘除各一次）
    expect(mocks.encryptEntry).toHaveBeenCalledTimes(1);
    expect(mocks.removeDiaryEntries).toHaveBeenCalledTimes(1);
    assertContract(w.seen, 'diary:entry-deleted', EMIT_ENTRY_DELETED_ON_ENCRYPT);
    // 通道不串：加密不得发解密通道
    expect(w.seen['diary:entry-decrypted']).toBe(0);
  });

  it('解锁取消（ensureSafeUnlocked false）：不发任何通道事件', async () => {
    mocks.ensureSafeUnlocked.mockResolvedValue(false);
    const c = freshController();
    const w = watchChannels();
    try {
      await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction(
        mkWallEntry()
      );
    } finally {
      w.stop();
    }
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(w.seen['diary:entry-deleted']).toBe(0);
    expect(w.seen['diary:entry-decrypted']).toBe(0);
  });

  it('找不到原文条目：不发任何通道事件', async () => {
    mocks.findDiaryEntry.mockResolvedValue(null);
    const c = freshController();
    const w = watchChannels();
    try {
      await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction(
        mkWallEntry()
      );
    } finally {
      w.stop();
    }
    expect(mocks.encryptEntry).not.toHaveBeenCalled();
    expect(w.seen['diary:entry-deleted']).toBe(0);
    expect(w.seen['diary:entry-decrypted']).toBe(0);
  });

  it('原文块摘除未生效（removed=0，D5 回滚）：不发任何通道事件', async () => {
    mocks.removeDiaryEntries.mockResolvedValue(0);
    const c = freshController();
    const w = watchChannels();
    try {
      await (c as unknown as { encryptEntryAction: (e: WallEntry) => Promise<void> }).encryptEntryAction(
        mkWallEntry()
      );
    } finally {
      w.stop();
    }
    // 回滚确实发生（密文被销毁），但事件仍零发
    expect(mocks.deleteEncryptedEntry).toHaveBeenCalledWith('note-1');
    expect(w.seen['diary:entry-deleted']).toBe(0);
    expect(w.seen['diary:entry-decrypted']).toBe(0);
  });
});

describe('墙菜单解密动作（decryptEntryAction）域事件契约', () => {
  it('解密成功（还原写盘）：diary:entry-decrypted 按开关钉死现状', async () => {
    const c = freshController();
    const w = watchChannels();
    try {
      await (
        c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }
      ).decryptEntryAction(mkWallEntry({ encrypted: true, noteId: 'note-9', tags: ['日记', '加密'] }));
    } finally {
      w.stop();
    }
    expect(mocks.reclassifyEntry).toHaveBeenCalledTimes(1);
    assertContract(w.seen, 'diary:entry-decrypted', EMIT_ENTRY_DECRYPTED_ON_DECRYPT);
    // 通道不串：解密不得发删除通道
    expect(w.seen['diary:entry-deleted']).toBe(0);
  });

  it('解密失败（reclassifyEntry false）：不发任何通道事件', async () => {
    mocks.reclassifyEntry.mockResolvedValue(false);
    const c = freshController();
    const w = watchChannels();
    try {
      await (
        c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }
      ).decryptEntryAction(mkWallEntry({ encrypted: true, noteId: 'note-9', tags: ['日记', '加密'] }));
    } finally {
      w.stop();
    }
    expect(w.seen['diary:entry-decrypted']).toBe(0);
    expect(w.seen['diary:entry-deleted']).toBe(0);
  });

  it('缺少保险箱记录（无 noteId）：不发任何通道事件', async () => {
    const c = freshController();
    const w = watchChannels();
    try {
      await (
        c as unknown as { decryptEntryAction: (e: WallEntry) => Promise<void> }
      ).decryptEntryAction(mkWallEntry({ encrypted: true, noteId: undefined, tags: ['日记', '加密'] }));
    } finally {
      w.stop();
    }
    expect(mocks.reclassifyEntry).not.toHaveBeenCalled();
    expect(w.seen['diary:entry-decrypted']).toBe(0);
    expect(w.seen['diary:entry-deleted']).toBe(0);
  });
});
