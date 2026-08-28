// @vitest-environment node
/**
 * 设置项文案 lint 引擎（ticket 131 Q8 / ticket 100 规范，测试期工具，不进 src）：
 * - 标题：4-8 字、零符号（仅文字/数字/空格；连续西文数字串按 2 字宽折算）；
 * - 描述：8-32 字、自然句（仅文字/数字/空格/逗号/句号/百分号/加减连字符，禁止 、·/—（）等符号花样）。
 * 使用方式：各迁移组新建 `settings-copy-lint-<组>.test.ts`（node 环境），import 本引擎的
 * `lintTargets` 注册本组域 schema 并断言零违规；白名单按组独立传入（violation id 精确项或
 * 行级通配 `来源#行名:*`，豁免遗留文案须注明年/票与理由）。不要往别组的注册文件里加内容。
 */

import type { SettingsSchema, SettingsRow } from '../../src/core/settings-schema';

/** 标题零符号：仅允许文字/数字/空白 */
const TITLE_SYMBOL = /[^\p{Script=Han}\p{L}\p{N}\s]/u;
/** 描述自然句：额外允许中文逗号/句号/百分号/加减连字符；其余符号（、·/—（）等）一律违规 */
const DESC_ALLOWED = /^[\p{Script=Han}\p{L}\p{N}\s，。%+\-]*$/u;

/** 字数折算：连续西文字母/数字串按 2 字宽计（如 DeepSeek≈2 字），CJK 逐字计，空白不计 */
export function unitCount(s: string): number {
  return [...s.replace(/[A-Za-z0-9]+/g, 'XX')].filter((ch) => !/\s/.test(ch)).length;
}

export function lintName(name: string): string[] {
  const v: string[] = [];
  if (TITLE_SYMBOL.test(name)) v.push('title-symbol');
  const n = unitCount(name);
  if (n < 4 || n > 8) v.push('title-length');
  return v;
}

export function lintDesc(desc: string): string[] {
  const v: string[] = [];
  if (!DESC_ALLOWED.test(desc)) v.push('desc-symbol');
  const n = unitCount(desc);
  if (n < 8 || n > 32) v.push('desc-length');
  return v;
}

/** 展开 schema 全部行（含分组；行名缺省的 custom 行跳过 name/desc 检查） */
function collectRows(schema: SettingsSchema): Array<{ label: string; name?: string; desc?: string }> {
  const out: Array<{ label: string; name?: string; desc?: string }> = [];
  for (const g of schema.groups) {
    for (const row of g.rows as SettingsRow[]) {
      const r = row as { name?: string; desc?: string };
      out.push({ label: r.name || '<unnamed>', name: r.name, desc: r.desc });
    }
  }
  return out;
}

/** lint 全部目标 schema，返回未豁免的 violation id 列表 */
export function lintTargets(
  targets: Array<{ source: string; schema: SettingsSchema }>,
  whitelist: Iterable<string> = []
): string[] {
  const wl = new Set(whitelist);
  const whitelisted = (id: string): boolean => {
    if (wl.has(id)) return true;
    const rowPrefix = id.slice(0, id.lastIndexOf(':'));
    return wl.has(`${rowPrefix}:*`);
  };
  const violations: string[] = [];
  for (const { source, schema } of targets) {
    for (const row of collectRows(schema)) {
      for (const code of row.name ? lintName(row.name) : []) violations.push(`${source}#${row.label}:${code}`);
      for (const code of row.desc ? lintDesc(row.desc) : []) violations.push(`${source}#${row.label}:${code}`);
    }
  }
  return violations.filter((id) => !whitelisted(id));
}
