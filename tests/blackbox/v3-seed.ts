/**
 * 黑匣子测试 v3 seed（2026-08-12 用户决策：load 不再自动迁移）：
 * 把 v2 形状的 payload（entries/profiles/events/...）直接落为 v3 状态——笔记 + index + 派生层 JSON，
 * 等价于「一次性迁移已完成」。测试不再依赖 load 自动迁移。
 */
import type { MockVault } from '../mock-vault';

const TYPE_DIR: Record<string, string> = { concept: '概念', literature: '摘抄', thought: '想法' };

/** v2 形状 entries → v3 笔记 + index；返回 index（id → 路径）。 */
export function seedV3(vault: MockVault, payload: Record<string, any>): Record<string, string> {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const nameById = new Map<string, string>();
  for (const e of entries) {
    if (e && e.type === 'concept' && e.name) nameById.set(String(e.id), String(e.name));
  }
  const index: Record<string, string> = {};
  for (const e of entries) {
    const dir = `黑匣子/${TYPE_DIR[e.type] || '想法'}`;
    const title =
      e.type === 'concept'
        ? String(e.name || '未命名')
        : (String(e.text || '').replace(/\s+/g, ' ').trim().slice(0, 20) || '未命名');
    let path = `${dir}/${title}.md`;
    let n = 1;
    while (vault.files.has(path)) {
      path = `${dir}/${title}-${n}.md`;
      n += 1;
    }
    const fm: string[] = ['---', `id: ${e.id}`, `type: ${e.type}`, `createdAt: "${e.createdAt}"`];
    if (e.type === 'concept' && e.name) fm.push(`name: ${e.name}`);
    const list = (key: string, arr: unknown): void => {
      if (Array.isArray(arr) && arr.length) {
        fm.push(`${key}:`);
        for (const x of arr) fm.push(`  - ${x}`);
      }
    };
    list('emotions', e.emotions);
    list('people', e.people);
    list('links', e.links);
    list('tags', e.tags);
    if (e.scene) fm.push(`scene: "${e.scene}"`);
    if (e.source) fm.push(`source: "${e.source}"`);
    if (e.category) fm.push(`category: "${e.category}"`);
    // 关联双链写 frontmatter（related/terms id → 概念名；新解析优先 fm 再合并正文）
    const relNames = (ids: unknown): string[] =>
      Array.isArray(ids) ? ids.map((i) => nameById.get(String(i))).filter((x): x is string => !!x) : [];
    if (e.type === 'concept') list('related', relNames(e.related));
    if (e.type === 'literature') list('terms', relNames(e.terms));
    fm.push('---');
    const body = e.type === 'concept' ? (e.definition || '') : (e.text || '');
    vault.files.set(path, fm.join('\n') + '\n' + (body ? body + '\n' : ''));
    index[String(e.id)] = path;
  }
  const { entries: _drop, ...rest } = payload;
  // index 不再持久化（2026-08-12 用户决策）：load 全量扫描笔记构建
  vault.files.set('CONFIG/STORAGE/blackbox.json', JSON.stringify({ version: 3, ...rest }));
  return index;
}
