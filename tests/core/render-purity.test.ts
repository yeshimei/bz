// @vitest-environment node
/**
 * 域渲染纯层守卫（issue 237/ADR-0104）。
 *
 * render.ts 是「原型 × 插件」markup 单源，会被 esbuild 打成 prototype-render.js
 * 供评审壳双击加载——import 图必须绝对干净：禁 obsidian / moment / core 服务 /
 * 组件库 barrel（会拖入 obsidian 连带把预览包打包炸或撑爆）。
 * 允许的跨域依赖逐文件列名在 ALLOWED_EXTERNAL（当前仅 core/ui/str 零依赖工具）。
 * 域清单与 scripts/build-preview.mjs 同源（PREVIEW_DOMAINS），勿在此另抄。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PREVIEW_DOMAINS } from '../../scripts/build-preview.mjs';

const ROOT = process.cwd();
const ALLOWED_EXTERNAL = ['../core/ui/str'];

/** 解析相对说明符 → 文件路径（带 .ts / /index.ts 消歧；解析失败回传补 .ts 便于报错） */
function resolveSpec(fromFile: string, spec: string): string {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
  }
  return `${base}.ts`;
}

/** 抽取一个 TS 文件的全部模块说明符（static import/export-from + dynamic import） */
function importSpecs(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8')
    .replace(/^\s*(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"]\s*;?\s*$/gm, '');
  const specs: string[] = [];
  for (const re of [/from\s*['"]([^'"]+)['"]/g, /^import\s*['"]([^'"]+)['"]/gm, /import\(\s*['"]([^'"]+)['"]\s*\)/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) specs.push(m[1]);
  }
  return specs;
}

describe('render 纯度守卫（ADR-0104）', () => {
  it('PREVIEW_DOMAINS 各域 render.ts 的 import 图零污染', () => {
    for (const domain of PREVIEW_DOMAINS) {
      const entry = path.join(ROOT, 'src', domain, 'render.ts');
      expect(fs.existsSync(entry), `src/${domain}/render.ts 应存在`).toBe(true);

      const violations: string[] = [];
      const visited = new Set<string>();
      const walk = (file: string) => {
        if (visited.has(file)) return;
        visited.add(file);
        for (const spec of importSpecs(file)) {
          if (!spec.startsWith('.')) {
            violations.push(`${path.relative(ROOT, file)}：裸说明符 '${spec}'（render 纯层禁入 obsidian/moment/npm 包）`);
            continue;
          }
          const resolved = resolveSpec(file, spec);
          const inDomain = resolved.startsWith(path.join(ROOT, 'src', domain) + path.sep);
          const allowedExt = ALLOWED_EXTERNAL.some((rel) => resolved === resolveSpec(entry, rel));
          if (!inDomain && !allowedExt) {
            violations.push(`${path.relative(ROOT, file)}：'${spec}' → ${path.relative(ROOT, resolved)}（白名单外）`);
            continue;
          }
          if (fs.existsSync(resolved)) walk(resolved);
        }
      };
      walk(entry);
      expect(violations, violations.join('\n')).toEqual([]);
    }
  });

  it('预览包已构建且在库（双击原型零依赖依赖它）', () => {
    for (const domain of PREVIEW_DOMAINS) {
      const out = path.join(ROOT, 'src', domain, 'prototype-render.js');
      expect(fs.existsSync(out), `${out} 缺失——跑 node scripts/build-preview.mjs`).toBe(true);
      const text = fs.readFileSync(out, 'utf8');
      // 连字符域名的 globalName 合法标识符形态（settings-panel → BZR_settings_panel，与 build-preview 同步）
      expect(text).toContain(`BZR_${domain.replace(/-/g, '_')}`);
    }
  });
});
