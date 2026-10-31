/**
 * 发版日志「定稿即真理源」守卫（2026-10-31 立）
 *
 * 事故背景：用户改完的 Release note 定稿（docs/note-v<版本>.md）本该是线上更新日志的
 * 真理源，但七步流程的 changelog 步不传 --note → 生成器从 git 全量重建，定稿被冲成
 * 提交历史口径（Release 页 2+8+2、线上日志 5+0+11），用户端看到的更新日志与 Release 页
 * 严重不符。同期还有第二个坑：清单重算跑在日志写盘**之前**，算的是上一版的 sha256，
 * 客户端拿清单校验新日志必然报「sha256 不匹配」。
 *
 * 本守卫钉住三条口径（读脚本源码文本断言，不跑真 git）：
 *  1. 生成器**自动扫描** docs/note-v*.md 应用定稿——不靠人记得传 --note；
 *  2. 清单重算必须在日志写盘**之后**（否则清单 hash 停在上一版）；
 *  3. --check 对账「已产出日志各版本块 == 定稿」，冲掉当场报红。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const gen = readFileSync(join(ROOT, 'scripts/_gen-changelog.mjs'), 'utf8');
const steps = readFileSync(join(ROOT, 'scripts/release-steps.mjs'), 'utf8');

describe('更新日志定稿即真理源（2026-10-31 事故守卫）', () => {
  it('生成器自动扫描 docs/note-v<版本>.md 发现定稿', () => {
    expect(gen).toMatch(/discoverNoteFiles/);
    // 文件名形状必须是 note-v<版本>.md —— 定稿留档的唯一形状
    expect(gen).toMatch(/\^note-v\(\\d\+\\\.\\d\+\\\.\\d\+\)\\\.md\$/);
  });

  it('生成器自动应用定稿（不依赖显式 --note 参数）', () => {
    // resolveNoteSources 把「自动发现的留档」与「显式 --note」合并成同一份来源表
    expect(gen).toMatch(/function resolveNoteSources\(\)/);
    expect(gen).toMatch(/resolveNoteSources\(\)/);
    // 应用定稿的循环遍历的是 noteSources（版本与文件已绑定），不是靠数组下标猜版本
    expect(gen).toMatch(/for \(const \{ version: wantVersion, file: noteFile \} of noteSources\)/);
  });

  it('清单重算跑在日志写盘之后（否则清单 hash 停在上一版）', () => {
    const writeIdx = gen.indexOf("writeFileSync(join(ROOT, 'downloads', 'bz-changelog.html'), html, 'utf8')");
    const manifestIdx = gen.indexOf("join(ROOT, 'scripts', 'build-manifest.mjs')");
    expect(writeIdx).toBeGreaterThan(-1);
    expect(manifestIdx).toBeGreaterThan(-1);
    expect(manifestIdx).toBeGreaterThan(writeIdx);
  });

  it('--check 对账「已产出日志 == 定稿」（冲掉当场报红）', () => {
    expect(gen).toMatch(/定稿即真理源/);
    // 对账要读**已产出的文件**（用户真正下载到的那份），不是内存里的版本块
    expect(gen).toMatch(/const DATA = \(\\\{\.\*\?\\\}\);/);
    expect(gen).toMatch(/与定稿 .* 不一致/);
  });

  it('七步流程的 changelog 步自检定稿已落进产物', () => {
    expect(steps).toMatch(/定稿没落进产物/);
    expect(steps).toMatch(/note-v\\d\+\\\.\\d\+\\\.\\d\+\\\.md/);
  });

  it('解析不了的 note 条目直接报错退出（绝不静默丢条目）', () => {
    expect(gen).toMatch(/解析不了的条目/);
    expect(gen).toMatch(/process\.exit\(1\)/);
  });
});
