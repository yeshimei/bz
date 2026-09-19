// @vitest-environment node
/**
 * home 域依赖方向守卫（ADR-0002；home 深审 arch A1 解环回归）：
 *
 * `home/river → recap/aggregate → home/weekly` 曾是**全仓唯一的域间顶层静态环**——
 * 环由 weekly.ts（R1 周报死模块）的 parseLocalDay 撑起。修复：parseLocalDay 下沉
 * core/utils 单源，recap 改引 core，环断。本文件静态扫描锁定「recap 不得顶层
 * import home」这一环成因边，防止环以任何形态复发。
 *
 * 方向说明：home → recap 是聚合层合法依赖（river 静态消费 collectRecap，三件套
 * 收编 recap 正典同向），守卫只锁 recap → home 反向边；type-only import 编译期
 * 擦除，不在限制内（render-purity 同口径）。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');

/** 递归收集目录下全部 .ts 文件（排除 .test.ts） */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...tsFiles(p));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

/** 抽取顶层 static import 的模块说明符（剥 type-only 与 export-from 之外的多行形态按整段匹配） */
function staticImports(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  // 逐条匹配 import ... from '...'；type-only（import type / export type）先剥
  const cleaned = text.replace(/^\s*(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm, '');
  const specs: string[] = [];
  const re = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned))) specs.push(m[1]);
  return specs;
}

/** 相对说明符 → 是否指向目标目录（src/home） */
function pointsIntoHome(fromFile: string, spec: string): boolean {
  if (!spec.startsWith('.')) return false;
  const resolved = path.resolve(path.dirname(fromFile), spec);
  return resolved === path.join(ROOT, 'home') || resolved.startsWith(path.join(ROOT, 'home') + path.sep);
}

describe('依赖方向守卫（ADR-0002）：recap 不得顶层 import home（A1 解环回归）', () => {
  it('src/recap/** 全部文件零顶层 import src/home/**（环成因边不再出现）', () => {
    const files = tsFiles(path.join(ROOT, 'recap'));
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const f of files) {
      for (const spec of staticImports(f)) {
        if (pointsIntoHome(f, spec)) {
          violations.push(`${path.relative(ROOT, f)}: import '${spec}'`);
        }
      }
    }
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('core/utils.parseLocalDay 单源在位（recap 的日期前缀解析已不拉 home）', () => {
    const utils = fs.readFileSync(path.join(ROOT, 'core', 'utils.ts'), 'utf8');
    expect(utils).toContain('export function parseLocalDay');
    const aggregate = fs.readFileSync(path.join(ROOT, 'recap', 'aggregate.ts'), 'utf8');
    expect(aggregate).toContain("parseLocalDay } from '../core/utils'");
    expect(aggregate).not.toContain('from \'../home/');
  });
});
