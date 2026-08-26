// @vitest-environment node
/**
 * 自动双链数据层测试（ticket 111；纯数据层 node 环境）：
 * 队列 CRUD（入队合并刷新 hash / 消费移除 / 失败保留语义 / 失效条目清理）、
 * related 解析与幂等合并、上限截断、失效清理规划、裁判输出解析。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MockVault, mockAppWithVault } from '../mock-vault';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { DEFAULT_SETTINGS } from '../../src/settings';
import {
  LINK_AGENT_DEFAULT_SCOPE,
  computeHash,
  dequeuePath,
  enqueuePaths,
  getLinkQueueFilePath,
  isUnderFolder,
  loadQueue,
  mergeRelated,
  normalizeRelatedEntry,
  parseJudgeOutput,
  parseRelatedEntries,
  parseScopeList,
  planRemovals,
  pruneQueueByExists,
  toRelatedEntry,
} from '../../src/secondbrain/link-agent/data';

describe('自动双链·设置键默认值', () => {
  it('DEFAULT_SETTINGS 六键齐备且取 spec 默认值', () => {
    const s = DEFAULT_SETTINGS as any;
    expect(s.linkAgentEnabled).toBe(true);
    expect(s.linkAgentScopes).toBe('文献盒');
    expect(s.linkAgentTopK).toBe(8);
    expect(s.linkAgentMaxLinks).toBe(0);
    expect(s.linkAgentNotify).toBe(true);
    expect(s.linkAgentAutoClean).toBe(true);
    expect(LINK_AGENT_DEFAULT_SCOPE).toBe('文献盒');
  });
});

describe('关联范围解析（linkAgentScopes，需求变更）', () => {
  it('parseScopeList：逗号分隔/trim/去空；多目录保序', () => {
    expect(parseScopeList('文献盒,卡片盒')).toEqual(['文献盒', '卡片盒']);
    expect(parseScopeList(' 文献盒 , 卡片盒 , ,')).toEqual(['文献盒', '卡片盒']);
    expect(parseScopeList('书库')).toEqual(['书库']);
  });

  it('空值/缺省回退「文献盒」', () => {
    expect(parseScopeList(undefined)).toEqual(['文献盒']);
    expect(parseScopeList(null)).toEqual(['文献盒']);
    expect(parseScopeList('')).toEqual(['文献盒']);
    expect(parseScopeList(' , ')).toEqual(['文献盒']);
  });
});

describe('isUnderFolder / computeHash', () => {
  it('目录边界判定：恰为目录/子路径命中，兄弟与前缀相似不命中', () => {
    expect(isUnderFolder('文献盒', '文献盒')).toBe(true);
    expect(isUnderFolder('文献盒', '文献盒/A.md')).toBe(true);
    expect(isUnderFolder('文献盒', '文献盒/子/B.md')).toBe(true);
    expect(isUnderFolder('文献盒', '文献盒2/A.md')).toBe(false);
    expect(isUnderFolder('文献盒', '其他/A.md')).toBe(false);
    expect(isUnderFolder('', 'A.md')).toBe(false);
  });

  it('computeHash：内容稳定、变化即变', () => {
    expect(computeHash('abc')).toBe(computeHash('abc'));
    expect(computeHash('abc')).not.toBe(computeHash('abd'));
  });
});

describe('related 解析与幂等合并', () => {
  it('parseRelatedEntries：数组/单字符串/缺失/畸形项', () => {
    expect(parseRelatedEntries(['[[a]]', ' [[b]] '])).toEqual(['[[a]]', '[[b]]']);
    expect(parseRelatedEntries('[[solo]]')).toEqual(['[[solo]]']);
    expect(parseRelatedEntries(undefined)).toEqual([]);
    expect(parseRelatedEntries(null)).toEqual([]);
    expect(parseRelatedEntries([null, ''])).toEqual([]);
  });

  it('toRelatedEntry 去 .md；normalizeRelatedEntry 容忍别名/块引用/.md/多余括号，非 wikilink 返回 null', () => {
    expect(toRelatedEntry('文献盒/x.md')).toBe('[[文献盒/x]]');
    expect(normalizeRelatedEntry('[[文献盒/x]]')).toBe('文献盒/x');
    expect(normalizeRelatedEntry('[[文献盒/x|别名]]')).toBe('文献盒/x');
    expect(normalizeRelatedEntry('[[文献盒/x#^blockid]]')).toBe('文献盒/x');
    expect(normalizeRelatedEntry('[[文献盒/x.md]]')).toBe('文献盒/x');
    expect(normalizeRelatedEntry('普通文本')).toBeNull();
    expect(normalizeRelatedEntry('')).toBeNull();
  });

  it('mergeRelated：幂等去重保序；默认不限量；maxLinks>0 时截断且截掉的不算新增', () => {
    // 幂等：已存在的链不重复添加
    const r1 = mergeRelated(['[[a]]'], ['[[a]]', '[[b]]']);
    expect(r1.entries).toEqual(['[[a]]', '[[b]]']);
    expect(r1.added).toEqual(['[[b]]']);
    // 默认 0 = 不限量
    const r2 = mergeRelated([], ['1', '2', '3'], 0);
    expect(r2.entries.length).toBe(3);
    // 上限截断：总量封顶，被截掉的不计新增
    const r3 = mergeRelated(['[[keep]]'], ['[[n1]]', '[[n2]]'], 2);
    expect(r3.entries).toEqual(['[[keep]]', '[[n1]]']);
    expect(r3.added).toEqual(['[[n1]]']);
    // 全部被截掉时 added 为空
    const r4 = mergeRelated(['[[a]]', '[[b]]'], ['[[c]]'], 2);
    expect(r4.added).toEqual([]);
  });

  it('planRemovals：死链剔除、活链与非 wikilink 条目保留', () => {
    const alive = (p: string) => p === '文献盒/live';
    const { keep, removed } = planRemovals(['[[文献盒/dead]]', '[[文献盒/live]]', '非链接文本'], alive);
    expect(removed).toEqual(['[[文献盒/dead]]']);
    expect(keep).toEqual(['[[文献盒/live]]', '非链接文本']);
  });
});

describe('待处理队列 CRUD', () => {
  beforeEach(() => {
    setSettingsProvider(() => ({ ...DEFAULT_SETTINGS }) as any);
  });

  function makeEnv() {
    const vault = new MockVault();
    const app = mockAppWithVault(vault);
    setApp(app);
    return { vault, app };
  }

  it('队列文件路径落在 STORAGE 目录（storagePath 口径）', () => {
    makeEnv();
    expect(getLinkQueueFilePath()).toBe('CONFIG/STORAGE/secondbrain_link_queue.json');
  });

  it('入队新建文件并落盘；同 path 重入队合并为一条并刷新 hash 与 queuedAt', async () => {
    const { vault } = makeEnv();
    await enqueuePaths(['文献盒/a.md'], { '文献盒/a.md': 'h1' });
    let q = await loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ path: '文献盒/a.md', hash: 'h1' });
    expect(typeof q[0].queuedAt).toBe('string');
    const firstAt = q[0].queuedAt;

    await new Promise((r) => setTimeout(r, 5));
    await enqueuePaths(['文献盒/a.md'], { '文献盒/a.md': 'h2' });
    q = await loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0].hash).toBe('h2');
    expect(q[0].queuedAt).not.toBe(firstAt); // 刷新时间戳
    expect(vault.files.has(getLinkQueueFilePath())).toBe(true);
  });

  it('消费成功移除单条；失败保留语义 = 不调用移除则条目仍在', async () => {
    makeEnv();
    await enqueuePaths(['文献盒/a.md', '文献盒/b.md']);
    await dequeuePath('文献盒/a.md'); // 消费成功方移除
    let q = await loadQueue();
    expect(q.map((i) => i.path)).toEqual(['文献盒/b.md']); // b 未消费仍保留
    await dequeuePath('文献盒/不存在.md');
    q = await loadQueue();
    expect(q).toHaveLength(1);
  });

  it('对应文件已删除的条目顺带清理；存在的不动', async () => {
    const { vault } = makeEnv();
    vault.files.set('文献盒/keep.md', '正文');
    await enqueuePaths(['文献盒/keep.md', '文献盒/gone.md']);
    const removed = await pruneQueueByExists((p) => vault.files.has(p));
    expect(removed).toBe(1);
    const q = await loadQueue();
    expect(q.map((i) => i.path)).toEqual(['文献盒/keep.md']);
  });

  it('loadQueue 容忍畸形条目（缺 path / 非 md）', async () => {
    const { vault } = makeEnv();
    vault.files.set(getLinkQueueFilePath(), JSON.stringify([{ path: '文献盒/ok.md' }, { hash: 'x' }, { path: 'a.txt' }, 'junk']));
    const q = await loadQueue();
    expect(q.map((i) => i.path)).toEqual(['文献盒/ok.md']);
  });
});

describe('裁判输出解析', () => {
  it('严格 JSON 数组解析；容忍代码围栏；非法整体返回 []', () => {
    expect(parseJudgeOutput('[{"id":1,"reason":"同主题"}]', 2)).toEqual([{ id: 1, reason: '同主题' }]);
    expect(parseJudgeOutput('```json\n[{"id":2,"reason":"r"}]\n```', 2)).toEqual([{ id: 2, reason: 'r' }]);
    expect(parseJudgeOutput('好的，以下是结果：[{"id":1,"reason":"r"}]', 1)).toEqual([{ id: 1, reason: 'r' }]);
    // 空数组 = 无关联
    expect(parseJudgeOutput('[]', 3)).toEqual([]);
    // 非 JSON / 缺数组 / 空串
    expect(parseJudgeOutput('我觉得没有关联', 3)).toEqual([]);
    expect(parseJudgeOutput('{"id":1}', 3)).toEqual([]);
    expect(parseJudgeOutput('', 3)).toEqual([]);
  });

  it('id 越界/重复、reason 缺失逐项丢弃', () => {
    expect(
      parseJudgeOutput('[{"id":0,"reason":"x"},{"id":9,"reason":"y"},{"id":1},{"id":1,"reason":"dup"},{"id":2,"reason":"ok"}]', 2)
    ).toEqual([
      { id: 1, reason: 'dup' },
      { id: 2, reason: 'ok' },
    ]);
    // 完全重复的合法项只保留首个
    expect(parseJudgeOutput('[{"id":1,"reason":"a"},{"id":1,"reason":"b"}]', 1)).toEqual([{ id: 1, reason: 'a' }]);
  });
});
