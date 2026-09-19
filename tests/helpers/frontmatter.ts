/**
 * 游戏库域共享 frontmatter 测试引擎（深审测试架构缺口 6 抽取）：
 * 此前 sync.test.ts 私有一套迷你 YAML 往返、names/posters/backfill 又各有简化变体，
 * 三队列落盘契约的校验保真度受限。抽到这里作唯一实现（对齐 Obsidian processFrontMatter
 * 的序列化口径：中文键「键即整段前缀」的朴素解析 + 块列表 + 引号标量），后续域内测试
 * 一律消费本模块，不再各抄一份。
 */
import type { MockVault } from '../mock-vault';

/** 极简 frontmatter 解析（覆盖本域产出形态：tags 列表 + 扁平标量键） */
export function parseFm(vault: MockVault, path: string): Record<string, any> {
  const raw = vault.files.get(path) ?? '';
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const fm: Record<string, any> = {};
  if (!m) return fm;
  let lastKey = '';
  for (const line of m[1].split('\n')) {
    if (line.startsWith('- ')) {
      (fm[lastKey] ??= []).push(line.slice(2).trim());
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    lastKey = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (v === 'true') fm[lastKey] = true;
    else if (v === 'false') fm[lastKey] = false;
    else if (v !== '' && /^-?\d+(\.\d+)?$/.test(v)) fm[lastKey] = Number(v);
    else if (v !== '') fm[lastKey] = v.replace(/^"|"$/g, '');
    else fm[lastKey] = undefined;
  }
  return fm;
}

/** 序列化回 frontmatter（与解析同一套规则，保 upsert 幂等） */
export function serializeFm(fm: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) lines.push(`- ${item}`);
    } else if (typeof v === 'string') lines.push(`${k}: "${v}"`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}
