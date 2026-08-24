/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展；ticket 082 用户拍板清空 → 081 library 唯一条目）
 * ticket 075：memo 移除；076：news 移除；078：favorites 移除；079：belongings 移除；080：pomodoro 移除
 * ticket 082：quiz/review 移除（盲通道计数观察全清空）
 * ticket 081：library 唯一条目——weave-data.json 数据文件监听（结构化 diff）
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DOMAIN_FILES, snapshotDomains } from '../../src/smartcat/domain-source';
import { setSettingsProvider } from '../../src/core/settings-provider';

describe('DOMAIN_FILES（唯一 library；memo/news/favorites/belongings/pomodoro/quiz/review 均已移除）', () => {
  afterEach(() => {
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE' } as any)); // 还原默认，防泄漏到同文件后续用例
  });

  it('file 路径注册期动态拼装：跟随 storagePath 设置（P2 硬编码路径修复）', () => {
    setSettingsProvider(() => ({ storagePath: 'VAULT/CUSTOM' } as any));
    expect(DOMAIN_FILES.library.file).toBe('VAULT/CUSTOM/weave-data.json');
    // 尾斜杠归一
    setSettingsProvider(() => ({ storagePath: 'CONFIG/STORAGE///' } as any));
    expect(DOMAIN_FILES.library.file).toBe('CONFIG/STORAGE/weave-data.json');
  });
  it('除 library 外全部 JSON 盲通道域均不再有 extract', () => {
    expect(DOMAIN_FILES.memo).toBeUndefined();
    expect(DOMAIN_FILES.news).toBeUndefined();
    expect(DOMAIN_FILES.favorites).toBeUndefined();
    expect(DOMAIN_FILES.belongings).toBeUndefined();
    expect(DOMAIN_FILES.pomodoro).toBeUndefined();
    expect(DOMAIN_FILES.quiz).toBeUndefined();
    expect(DOMAIN_FILES.review).toBeUndefined();
    expect(Object.keys(DOMAIN_FILES)).toEqual(['library']);
  });

  it('library（ticket 081 v2）：weave-data.json 数据文件监听，extract 返回结构化 diff（书架/时长/划线想法）', () => {
    expect(DOMAIN_FILES.library.file).toBe('CONFIG/STORAGE/weave-data.json');
    const prev = new Map<string, string>();
    const ret = DOMAIN_FILES.library.extract(
      {
        books: {
          b1: {
            meta: { title: 'X' },
            reading: { position: { percent: 1 }, stats: { completedTime: 1 }, sessions: [{ durationSeconds: 300 }] },
            notes: { highlights: [{ text: 'c1' }], excerpts: [{ commentText: 'e1' }] },
          },
        },
      },
      prev,
    );
    // v2：结构化 diff 而非文本数组——started（读覆盖加入无 added）、done、sessions 带进度、划线/想法事件
    expect(ret).not.toBeNull();
    expect(Array.isArray(ret)).toBe(false);
    const diff = ret as any;
    expect(diff.started).toHaveLength(1);
    expect(diff.started[0].title).toBe('X');
    expect(diff.added).toHaveLength(0);
    expect(diff.done[0].title).toBe('X');
    expect(diff.sessions[0]).toMatchObject({ title: 'X', minutes: 5, percent: 100 });
    expect(diff.highlightEvents[0].texts).toEqual(['c1']);
    expect(diff.excerptEvents[0].texts).toEqual(['e1']);
  });
});

describe('snapshotDomains（首次快照）', () => {
  it('library 文件存在 → 返回 library；缺文件 → 空数组且不产出', async () => {
    const prev = new Map<string, string>();
    const found = await snapshotDomains(async (path: string) => {
      if (path.includes('weave-data')) {
        return { books: { b1: { meta: { title: 'X' }, reading: { position: { percent: 1 } }, notes: {} } } };
      }
      throw new Error('no file');
    }, prev);
    expect(found).toEqual(['library']);
    expect(found).not.toContain('memo');
    // 首次快照不产出 → 书库状态已被记录
    expect(prev.has('lib:b1:had')).toBe(true);
  });

  it('无 library 文件：返回空数组，不产出任何观察', async () => {
    const prev = new Map<string, string>();
    const found = await snapshotDomains(async () => {
      throw new Error('不应读取任何文件');
    }, prev);
    expect(found).toEqual([]);
  });
});