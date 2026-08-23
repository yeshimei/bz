/**
 * 域 JSON 感知（2026-08-23 用户拍板扩展；ticket 082 用户拍板清空）：CONFIG/STORAGE 各域数据 → 观察文本
 * ticket 075：memo 移除（method 监听 notifyMemoAction）；076：news 移除（notifyNewsRead）
 * ticket 078：favorites 移除；079：belongings 移除；080：pomodoro 移除
 * ticket 082（2026-08-24 用户拍板）：quiz/review 也移除——盲通道计数观察全清空（等 081 library 注入）
 */
import { describe, it, expect } from 'vitest';
import { DOMAIN_FILES, snapshotDomains } from '../../src/smartcat/domain-source';

describe('DOMAIN_FILES（盲通道清空；memo/news/favorites/belongings/pomodoro/quiz/review 均已移除）', () => {
  it('全部 7 个 JSON 盲通道域均不再有 extract（方法监听接管或用户拍板去掉）', () => {
    expect(DOMAIN_FILES.memo).toBeUndefined();
    expect(DOMAIN_FILES.news).toBeUndefined();
    expect(DOMAIN_FILES.favorites).toBeUndefined();
    expect(DOMAIN_FILES.belongings).toBeUndefined();
    expect(DOMAIN_FILES.pomodoro).toBeUndefined();
    expect(DOMAIN_FILES.quiz).toBeUndefined();
    expect(DOMAIN_FILES.review).toBeUndefined();
    expect(Object.keys(DOMAIN_FILES)).toHaveLength(0);
  });
});

describe('snapshotDomains（首次快照）', () => {
  it('空表：不产出任何观察，返回空数组', async () => {
    const prev = new Map<string, string>();
    const found = await snapshotDomains(async () => {
      throw new Error('不应读取任何文件');
    }, prev);
    expect(found).toEqual([]);
  });
});