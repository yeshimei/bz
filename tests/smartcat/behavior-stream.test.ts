// @vitest-environment node
/**
 * 行为流全量双写数据层测试（ticket 129 / ADR-0062）
 * 覆盖：
 * - 新签名 addObservation：memory 路由事件两流各有条目（独立 id/时间戳、无互标）；behavior 路由仅行为流；
 * - 返回值语义（memory 路由 → MemoryStreamEntry；behavior 路由 → BehaviorItem）；
 * - legacy 路径同口径全量双写（description 兜底行为条目 + memory 条目）；
 * - dedupe 短路不阻断行为条目（行为流 = 全量日志）；
 * - 滚动清理不受双写影响（settings 小容量下照常裁剪）；
 * - promoteToMemory 直接调用仍工作（面板按钮已移除后的保留接口）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemorySystem } from '../../src/smartcat/memory';
import { promoteToMemory } from '../../src/smartcat/memory';
import { defaultSmartCatData } from '../../src/smartcat/data';
import type { SmartCatData, MemoryStreamEntry, BehaviorItem } from '../../src/smartcat/types';

// mock settings-provider（行为流滚动窗口配置；测试可改值）
const mockSettings: Record<string, any> = {
  behaviorMaxDays: 30,
  behaviorMaxCount: 2000,
};
vi.mock('../../src/core/settings-provider', () => ({
  tryGetSettings: () => mockSettings,
}));

let data: SmartCatData;
let saver: ReturnType<typeof vi.fn<(d: SmartCatData) => Promise<void>>>;

function make(): MemorySystem {
  data = defaultSmartCatData();
  saver = vi.fn<(d: SmartCatData) => Promise<void>>(async (d) => { data = d; });
  const m = new MemorySystem({ vault: { adapter: {} } } as any, () => data, saver);
  (m as any).ollamaAvailable = false;
  return m;
}

beforeEach(() => {
  mockSettings.behaviorMaxDays = 30;
  mockSettings.behaviorMaxCount = 2000;
  data = defaultSmartCatData();
  saver = vi.fn(async (d) => { data = d; });
});

describe('双写：memory 路由事件（ticket 129）→ ADR-0069 后事件类全部走行为流', () => {
  it('diary:created → 仅行为流一条（memoryStream 不新增），条目字段完整', async () => {
    const m = make();
    const structured = { entityType: 'diary_entry', action: 'created', name: '2026-08-25 11:00' };
    const res = await m.addObservation('diary', { structured });
    const beh = res as BehaviorItem;
    expect(beh).not.toBeNull();
    expect(beh.id).toMatch(/^beh_/);
    // 仅行为流：记忆流不新增
    expect(data.memory.behaviorStream.length).toBe(1);
    expect(data.memory.memoryStream.length).toBe(0);
    // 条目字段
    expect(beh.id).toMatch(/^beh_/);
    expect(beh.metadata).toEqual(structured);
    expect((beh.metadata as any)?.originalType).toBeUndefined();
    expect((beh.metadata as any)?.memoryId).toBeUndefined();
    // 行为条目照旧 source:action name 描述
    expect(beh.description).toBe('diary:created 2026-08-25 11:00');
    expect(beh.type).toBe('created');
    expect(beh.source).toBe('diary');
  });

  it('movie:watched → 仅行为流（importance/emotion 档位保留在路由规则，不落记忆流）', async () => {
    const m = make();
    const res = await m.addObservation('movie', {
      structured: { entityType: 'movie', action: 'watched', name: '肖申克的救赎' },
    });
    const beh = res as BehaviorItem;
    expect(beh.id).toMatch(/^beh_/);
    expect(beh.source).toBe('movie');
    expect(beh.type).toBe('watched');
    expect(data.memory.behaviorStream.some((b) => b.source === 'movie' && b.type === 'watched')).toBe(true);
    expect(data.memory.memoryStream.length).toBe(0);
  });
});

describe('双写：behavior 路由事件仅行为流', () => {
  it('news:skipped → 仅行为流，记忆流不变', async () => {
    const m = make();
    const res = await m.addObservation('news', {
      structured: { entityType: 'news', action: 'skipped', name: '坏文', extras: { platform: '聚合讯' } },
    });
    expect(res).not.toBeNull();
    expect((res as BehaviorItem).id).toMatch(/^beh_/);
    expect(data.memory.behaviorStream.length).toBe(1);
    expect(data.memory.memoryStream.length).toBe(0);
    expect((res as BehaviorItem).description).toBe('news:skipped 坏文');
  });

  it('memo:completed → 仅行为流', async () => {
    const m = make();
    const res = await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name: '买菜' } });
    expect((res as BehaviorItem).type).toBe('completed');
    expect(data.memory.behaviorStream.length).toBe(1);
    expect(data.memory.memoryStream.length).toBe(0);
  });

  it('返回值语义：behavior 路由返回 BehaviorItem（事件类全退 behavior，ADR-0069）', async () => {
    const m = make();
    const beh = await m.addObservation('news', { structured: { entityType: 'news', action: 'read', name: 'T', extras: { platform: 'P', durationMin: 2 } } });
    expect((beh as BehaviorItem).id).toMatch(/^beh_/);
    expect((beh as BehaviorItem).timestamp).toBeTruthy();
    const beh2 = await m.addObservation('diary', { structured: { entityType: 'diary_entry', action: 'created', name: 'D' } });
    expect((beh2 as BehaviorItem).id).toMatch(/^beh_/);
    // 事件类不再进记忆流
    expect(data.memory.memoryStream.length).toBe(0);
    expect(data.memory.behaviorStream.some((b) => b.source === 'diary' && b.type === 'created')).toBe(true);
  });
});

describe('双写：legacy 旧签名同口径', () => {
  it('legacy 固定进 memory 流 + 也写行为流（description 兜底条目，metadata 缺省）', async () => {
    const m = make();
    const res = await m.addObservation('用户说：今天开始学 TypeScript', { source: 'chat', importance: 0.5 });
    expect(res).not.toBeNull();
    expect((res as MemoryStreamEntry).id).toMatch(/^memory_/);
    // 行为流：legacy 无 structured → action=unknown、metadata 缺省、描述直显原文
    expect(data.memory.behaviorStream.length).toBe(1);
    const beh = data.memory.behaviorStream[0];
    expect(beh.source).toBe('chat');
    expect(beh.type).toBe('unknown');
    expect(beh.metadata).toBeUndefined();
    expect(beh.description).toBe('用户说：今天开始学 TypeScript');
    // 记忆流照旧
    expect(data.memory.memoryStream.length).toBe(1);
    expect(data.memory.memoryStream[0].description).toBe('用户说：今天开始学 TypeScript');
  });

  it('legacy dedupe 短路仍返回 null，但行为条目已落（行为流 = 全量日志）', async () => {
    const m = make();
    await m.addObservation('用户说：我很开心', { source: 'chat', dedupe: true, importance: 0.7, emotion: 'happy' });
    expect(data.memory.memoryStream.length).toBe(1);
    const dup = await m.addObservation('用户说：我很开心', { source: 'chat', dedupe: true });
    expect(dup).toBeNull();
    expect(data.memory.memoryStream.length).toBe(1); // 记忆流去重
    expect(data.memory.behaviorStream.length).toBe(2); // 行为流全量
  });
});

describe('滚动清理不受双写影响', () => {
  it('小容量设置下 memory 路由事件照常被裁剪（双写不绕过清理）', async () => {
    mockSettings.behaviorMaxDays = 30;
    mockSettings.behaviorMaxCount = 5;
    const m = make();
    for (let i = 0; i < 8; i++) {
      await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name: `任务${i}` } });
    }
    expect(data.memory.behaviorStream.length).toBeLessThanOrEqual(5);
    // 记忆流无上限（行为域事件本就不进记忆流）
    expect(data.memory.memoryStream.length).toBe(0);
  });

  it('behavior 路由事件超容量照常裁剪（记忆流不新增、无上限问题）', async () => {
    mockSettings.behaviorMaxCount = 3;
    const m = make();
    for (let i = 0; i < 6; i++) {
      await m.addObservation('diary', { structured: { entityType: 'diary_entry', action: 'created', name: `D${i}` } });
    }
    expect(data.memory.behaviorStream.length).toBe(3); // 行为流裁剪到 3
    expect(data.memory.memoryStream.length).toBe(0); // 事件类不进记忆流（ADR-0069）
  });
});

describe('promoteToMemory 保留接口（面板按钮已移除，直接调用仍工作）', () => {
  it('双写产出的行为条目可直接提升为记忆（含 originalType/originalSource 标记）', async () => {
    const m = make();
    await m.addObservation('memo', { structured: { entityType: 'task', action: 'completed', name: '买菜' } });
    const beh = data.memory.behaviorStream[0];
    const beforeMemCount = data.memory.memoryStream.length;
    const promoted = promoteToMemory(data, beh.id);
    expect(promoted).not.toBeNull();
    expect(promoted!.source).toBe('memo');
    expect(promoted!.structured?.entityType).toBe('task');
    expect(promoted!.structured?.extras?.originalType).toBe('completed');
    expect(promoted!.structured?.extras?.originalSource).toBe('memo');
    expect(data.memory.behaviorStream.some((b) => b.id === beh.id)).toBe(false); // 已移出行为流
    expect(data.memory.memoryStream.length).toBe(beforeMemCount + 1);
  });

  it('未找到条目返回 null', () => {
    const m = make();
    expect(promoteToMemory(data, 'nonexistent')).toBeNull();
  });
});
describe('行为流 5s 短防抖直写（ticket 159）', () => {
  it('markBehaviorDirty 5s 后触发 flushSidecars；窗口内连续标脏合并；stopScheduler 清定时器', async () => {
    vi.useFakeTimers();
    try {
      const m = make();
      const flushSpy = vi.spyOn(m, 'flushSidecars').mockResolvedValue(undefined);
      await m.addObservation('memo', { structured: { entityType: 'task', action: 'deleted', name: '测试删除' } });
      // 未到 5s：不触发
      vi.advanceTimersByTime(4999);
      expect(flushSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(flushSpy).toHaveBeenCalledTimes(1);
      // 首次冲刷后再标脏 → 新窗口，5s 后再次直写
      await m.addObservation('memo', { structured: { entityType: 'task', action: 'deleted', name: '测试删除2' } });
      vi.advanceTimersByTime(5000);
      expect(flushSpy).toHaveBeenCalledTimes(2);
      // 标脏后立即停止调度（卸载路径）→ 定时器清空不再触发
      await m.addObservation('memo', { structured: { entityType: 'task', action: 'deleted', name: '测试删除3' } });
      m.stopScheduler();
      vi.advanceTimersByTime(10000);
      expect(flushSpy).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
