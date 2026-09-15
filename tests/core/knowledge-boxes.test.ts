// @vitest-environment node
/**
 * 三个盒子解析单源测试（ADR-0141 §4：core ← 域，两侧零互引）：
 * 归一化（反斜杠/首尾斜杠/空值回落缺省名）、三盒清单去重保序、盒内判定（递归语义）、
 * 白名单剔除用的「是否盒目录」判定。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setSettingsProvider } from '../../src/core/settings-provider';
import {
  DEFAULT_CARDBOX_DIR,
  DEFAULT_LIT_DIR,
  DEFAULT_TOPIC_DIR,
  boxDirs,
  getKnowledgeBoxes,
  inKnowledgeBoxes,
  isBoxDir,
  normalizeBoxDir,
} from '../../src/core/knowledge-boxes';

describe('normalizeBoxDir（目录归一）', () => {
  it('反斜杠转正、去首尾斜杠、去空白', () => {
    expect(normalizeBoxDir(' 文献盒 ', 'X')).toBe('文献盒');
    expect(normalizeBoxDir('/文献盒/', 'X')).toBe('文献盒');
    expect(normalizeBoxDir('\\笔记\\文献\\', 'X')).toBe('笔记/文献');
    expect(normalizeBoxDir('笔记\\文献', 'X')).toBe('笔记/文献');
  });

  it('空值/非字符串回落缺省名；fallback 传空串即返回空串', () => {
    expect(normalizeBoxDir(undefined, '文献盒')).toBe('文献盒');
    expect(normalizeBoxDir(null, '文献盒')).toBe('文献盒');
    expect(normalizeBoxDir('   ', '文献盒')).toBe('文献盒');
    expect(normalizeBoxDir('/', '文献盒')).toBe('文献盒');
    expect(normalizeBoxDir('', '')).toBe('');
    expect(normalizeBoxDir(undefined, '')).toBe('');
  });
});

describe('getKnowledgeBoxes / boxDirs（三盒解析）', () => {
  afterEach(() => {
    setSettingsProvider(() => ({}) as any);
  });

  it('三键齐全原样取；顺序恒为 文献 → 卡片 → 主题', () => {
    const boxes = getKnowledgeBoxes({ knowledgeDirectory: 'A', knowledgeCardboxDirectory: 'B', knowledgeTopicDirectory: 'C' });
    expect(boxes).toEqual({ lit: 'A', cardbox: 'B', topic: 'C' });
    expect(boxDirs(boxes)).toEqual(['A', 'B', 'C']);
  });

  it('键缺失/为空 → 回落缺省盒名（文献盒 / 卡片盒 / 主题盒）', () => {
    const boxes = getKnowledgeBoxes({});
    expect(boxDirs(boxes)).toEqual([DEFAULT_LIT_DIR, DEFAULT_CARDBOX_DIR, DEFAULT_TOPIC_DIR]);
    expect(getKnowledgeBoxes({ knowledgeDirectory: '   ' }).lit).toBe(DEFAULT_LIT_DIR);
  });

  it('两个键填同一目录 → 清单去重（不产生重复条目）', () => {
    const boxes = getKnowledgeBoxes({ knowledgeDirectory: '文献盒', knowledgeCardboxDirectory: '文献盒', knowledgeTopicDirectory: '主题盒' });
    expect(boxDirs(boxes)).toEqual(['文献盒', '主题盒']);
  });

  it('不传参时读实时设置（改设置即改范围，无缓存）', () => {
    setSettingsProvider(() => ({ knowledgeDirectory: 'X' }) as any);
    expect(getKnowledgeBoxes().lit).toBe('X');
  });
});

describe('inKnowledgeBoxes（盒内判定）', () => {
  const boxes = getKnowledgeBoxes({ knowledgeDirectory: '文献盒', knowledgeCardboxDirectory: '卡片盒', knowledgeTopicDirectory: '主题盒' });

  it('盒目录本身与其下文件/子目录都命中（递归语义）', () => {
    expect(inKnowledgeBoxes('文献盒', boxes)).toBe(true);
    expect(inKnowledgeBoxes('文献盒/A.md', boxes)).toBe(true);
    expect(inKnowledgeBoxes('主题盒/C盒/子/X.md', boxes)).toBe(true);
    expect(inKnowledgeBoxes('卡片盒/卡.md', boxes)).toBe(true);
  });

  it('兄弟目录与前缀相似不算，盒外一律不算', () => {
    expect(inKnowledgeBoxes('文献盒2/A.md', boxes)).toBe(false); // 前缀相似但不是同一目录
    expect(inKnowledgeBoxes('书库/某书.md', boxes)).toBe(false);
    expect(inKnowledgeBoxes('我的/日记/x.md', boxes)).toBe(false);
    expect(inKnowledgeBoxes('', boxes)).toBe(false);
  });

  it('反斜杠路径先归一再来判（Windows 手填也能命中）', () => {
    expect(inKnowledgeBoxes('\\文献盒\\A.md', boxes)).toBe(true);
  });

  it('路径本身是盒目录（无扩展名）也算命中', () => {
    expect(inKnowledgeBoxes('主题盒', boxes)).toBe(true);
  });
});

describe('isBoxDir（白名单剔除用）', () => {
  it('恰为三盒之一（含归一化后相等）返回 true；子目录与盒外返回 false', () => {
    const boxes = getKnowledgeBoxes({ knowledgeDirectory: '文献盒', knowledgeCardboxDirectory: '卡片盒', knowledgeTopicDirectory: '主题盒' });
    expect(isBoxDir('文献盒', boxes)).toBe(true);
    expect(isBoxDir('/卡片盒/', boxes)).toBe(true);
    expect(isBoxDir('主题盒/', boxes)).toBe(true);
    expect(isBoxDir('文献盒/子', boxes)).toBe(false); // 盒内的子目录不是「盒目录」本身
    expect(isBoxDir('归档/网页剪藏', boxes)).toBe(false);
    expect(isBoxDir('', boxes)).toBe(false);
  });
});
