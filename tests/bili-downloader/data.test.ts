// @vitest-environment node
/**
 * 文献盒数据层测试（视频转文献，bili-downloader 域；ADR-0066 正名）：
 * 时间格式校验、bili-tasks.json CRUD、状态流转、清空已完成（只清成功）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TasksData, isValidTime, isTerminal, normalizeUrl } from '../../src/bili-downloader/data';
import { setApp } from '../../src/core/app';
import { MockVault } from '../mock-vault';

describe('isValidTime', () => {
  it('空/null/空白 = 合法（整片不剪辑）', () => {
    expect(isValidTime(null)).toBe(true);
    expect(isValidTime(undefined)).toBe(true);
    expect(isValidTime('')).toBe(true);
    expect(isValidTime('   ')).toBe(true);
  });
  it('mm:ss / hh:mm:ss / hh:mm:ss.S 合法', () => {
    expect(isValidTime('1:2')).toBe(true); // mm:ss（分秒均为 1-2 位）
    expect(isValidTime('5:30')).toBe(true);
    expect(isValidTime('05:30')).toBe(true);
    expect(isValidTime('1:02:03')).toBe(true);
    expect(isValidTime('1:02:03.5')).toBe(true);
    expect(isValidTime('1:02:03.55')).toBe(true);
  });
  it('非法格式拒绝', () => {
    expect(isValidTime('abc')).toBe(false);
    expect(isValidTime('1:2:3:4')).toBe(false);
    expect(isValidTime('30:00:00')).toBe(true); // 自由超长小时允许（长视频 100+ 分钟）
  });
});

describe('isTerminal / normalizeUrl', () => {
  it('成功/失败为终态，待处理/处理中非终态', () => {
    expect(isTerminal('success')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('pending')).toBe(false);
    expect(isTerminal('processing')).toBe(false);
  });
  it('normalizeUrl 仅去首尾空白', () => {
    expect(normalizeUrl('  BV1xx411c7mD  ')).toBe('BV1xx411c7mD');
  });
});

describe('TasksData（bili-tasks.json）', () => {
  let vault: MockVault;

  beforeEach(() => {
    vault = new MockVault();
    setApp({ vault } as any);
    TasksData.init({ storagePath: 'CONFIG/STORAGE' });
  });

  afterEach(() => {
    // 重置单例 store，避免跨用例串文件
    (TasksData as any)._store = null;
    (TasksData as any).filePath = '';
  });

  it('首读自建空文件（[]），addTask 追加队尾且字段完整', async () => {
    const t = await TasksData.addTask({ url: 'https://www.bilibili.com/video/BV1xx411c7mD', start: '1:02:03', end: '1:05:00', remark: '重点段落' });
    expect(t.id).toMatch(/^bili-task-/);
    expect(t.status).toBe('pending');
    expect(t.start).toBe('1:02:03');
    expect(t.end).toBe('1:05:00');
    expect(t.remark).toBe('重点段落');
    const all = await TasksData.loadTasks();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(t.id);
  });

  it('缺字段的旧/手改数据 loadTasks 统一补默认（零迁移）', async () => {
    await TasksData.write([{ id: 'legacy-1', url: 'BV1xx411c7mD' }]);
    const all = await TasksData.loadTasks();
    expect(all[0]).toMatchObject({
      id: 'legacy-1',
      status: 'pending',
      start: null,
      end: null,
      notePath: null,
      processedAt: null,
    });
  });

  it('title/uploader 可选字段（ticket 134）：addTask 去空白落库 + 旧数据补 null + updateTask 可改', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD', title: '  某视频标题  ', uploader: ' UP主甲 ' });
    expect(t.title).toBe('某视频标题');
    expect(t.uploader).toBe('UP主甲');
    // 旧数据（无新字段）读入零迁移：补 null 不崩（追加一条，不覆盖已有任务）
    const cur = await TasksData.read();
    cur.push({ id: 'legacy-2', url: 'BV1xx411c7mE' });
    await TasksData.write(cur);
    const legacy = await TasksData.loadTasks();
    expect(legacy.find((x) => x.id === 'legacy-2')).toMatchObject({ title: null, uploader: null });
    // 编辑可改可清空
    await TasksData.updateTask(t.id, { title: '改标题', uploader: null });
    const all = await TasksData.loadTasks();
    expect(all.find((x) => x.id === t.id)).toMatchObject({ title: '改标题', uploader: null });
  });

  it('updateTask 保留 id 与 created，仅合并补丁', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    await TasksData.updateTask(t.id, { status: 'success', notePath: '文献盒/测试.md' } as any);
    const all = await TasksData.loadTasks();
    expect(all[0].id).toBe(t.id);
    expect(all[0].created).toBe(t.created);
    expect(all[0].status).toBe('success');
    expect(all[0].notePath).toBe('文献盒/测试.md');
  });

  it('updateTask 不存在的 id 抛错', async () => {
    await expect(TasksData.updateTask('nope', { status: 'failed' })).rejects.toThrow('任务不存在');
  });

  it('deleteTask 移除指定任务；不存在静默', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    const t2 = await TasksData.addTask({ url: 'BV1xx411c7mE' });
    await TasksData.deleteTask(t.id);
    const all = await TasksData.loadTasks();
    expect(all.map((x) => x.id)).toEqual([t2.id]);
    await TasksData.deleteTask('nope'); // 不抛
  });

  it('retryTask：失败项回到待处理并清 reason/processedAt（保留旧结果字段）', async () => {
    const t = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    await TasksData.updateTask(t.id, { status: 'failed', reason: '视频已删除', processedAt: '2026-08-28 20:00:00', notePath: null, videoPath: null } as any);
    await TasksData.retryTask(t.id);
    const all = await TasksData.loadTasks();
    expect(all[0]).toMatchObject({ status: 'pending', reason: null, processedAt: null });
  });

  it('clearHistory 只清归档项（archived；失败/待处理/处理中保留，ADR-0067）', async () => {
    const ok = await TasksData.addTask({ url: 'BV1xx411c7mD' });
    const bad = await TasksData.addTask({ url: 'BV1xx411c7mE' });
    const pend = await TasksData.addTask({ url: 'BV1xx411c7mF' });
    await TasksData.updateTask(ok.id, { status: 'success', archived: true, archivedAt: '2026-08-28 21:00:00' } as any);
    await TasksData.updateTask(bad.id, { status: 'failed', reason: 'x' } as any);
    await TasksData.clearHistory();
    const all = await TasksData.loadTasks();
    expect(all.map((x) => x.id).sort()).toEqual([bad.id, pend.id].sort());
  });

  it('loadTasks 字段形状：title/uploader/archived/quality/page 缺省补默认（ADR-0067 零迁移）', async () => {
    await TasksData.addTask({ url: 'BV1xx411c7mD', quality: '720', page: 2 });
    const all = await TasksData.loadTasks();
    expect(all[0]).toMatchObject({
      title: null, uploader: null, archived: false, archivedAt: null,
      quality: '720', page: 2,
    });
    await TasksData.addTask({ url: 'BV1xx411c7mE' });
    const all2 = await TasksData.loadTasks();
    expect(all2[1].quality).toBeNull();
    expect(all2[1].page).toBeNull();
  });
});