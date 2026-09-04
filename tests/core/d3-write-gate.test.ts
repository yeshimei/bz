// @vitest-environment node
// D3 直写守门（可靠写契约收官）：扫描 src 下全部 .ts 中绕过 core/storage 契约的 vault/adapter
// 写类 API 直写。违规 = 白名单外命中；白名单清单制——每条豁免必须注明理由，条目失去对应
// 命中即报过期（逼清单短而准）。豁免口径见 d3-write-gate-engine.ts 头注释：
// 注释/字符串内 API 名不构成命中；enqueueFileTask/updateFileSections/mergeWriteSections
// 区域内的直写属契约队列内 IO，自动合规（D3 收编后的 diary/store.ts、bookshelf/epub-notes.ts）。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRawVaultWrites, type GateHit } from './d3-write-gate-engine';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

/** 递归收集 src 下全部 .ts 文件（styles.css 不在扫描面；node:fs 只读不写） */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...collectTsFiles(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** 白名单清单制：文件级豁免（路径正则，POSIX 斜杠，src/ 前缀）。每条必须写明豁免理由。 */
const WHITELIST: Array<{ file: RegExp; reason: string; /** 防回归哨兵：预期零命中，只参与哨兵断言不参与新鲜度检查 */ sentinel?: boolean }> = [
  {
    file: /^src\/core\/storage\.ts$/,
    reason: '契约本体：三原语（串行队列/段写/留档）的原始 vault IO 实现集中于此，是豁免的定义基准',
  },
  {
    file: /^src\/core\/json-store\.ts$/,
    reason: 'jsonStore 薄封装哨兵：现无裸写（转发 jsonFileStore）；此文件一旦出现直写即违约',
    sentinel: true,
  },
  {
    file: /^src\/encrypt\/data\.ts$/,
    reason: 'D2 已收编域：.safe.enc/staging 密文走 adapter 自有原子写协议（tmp 写成后替换，防半截密文）；解密产出 md/附件为用户文档写',
  },
  {
    file: /^src\/smartcat\/memory\.ts$/,
    reason: 'D3 收编清单外（smartcat 记忆库 json+vec，自研串行与 .bak 留档）——遗留项，另票收编后移除本条',
  },
  {
    file: /^src\/secondbrain\/store-file\.ts$/,
    reason: '自研模块级串行链（json+vec+冲突文件全链互斥，强于 per-path 队列，拆入 enqueueFileTask 反而丢互斥）；损坏留档已对齐 core CONFIG/.CORRUPT（D3）',
  },
  {
    file: /^src\/secondbrain\/vector-store\.ts$/,
    reason: 'secondbrain.vec 二进制写，不在 json 段写原语范围；写时机受 store-file 串行链约束',
  },
  {
    file: /^src\/literature\/note-gen\.ts$/,
    reason: '文献/笔记类用户文档写：视频转文献笔记生成与 frontmatter 回填（md 用户笔记，非插件私有数据）',
  },
  {
    file: /^src\/diary\/ui\/repair-modal\.ts$/,
    reason: '日记修复工具的 md 结构修复写（旧域冻结区 UI 不投资；修复流自带守卫与用户确认）',
  },
  {
    file: /^src\/clipbook\/save\.ts$/,
    reason: '剪藏 md 用户文档写（归档/网页剪藏/*.md）；news.json/clipbook.json 数据写已 D2 收编',
  },
  {
    file: /^src\/clipbook\/ui\.ts$/,
    reason: '剪藏条目「另存为笔记」md 用户文档写（一次性建条，无读改写竞态面）',
  },
  {
    file: /^src\/cinema\/ui\.ts$/,
    reason: '影视笔记 md 用户文档写（建《片名》.md + fileManager.processFrontMatter 写 frontmatter，Obsidian 内建语义）',
  },
  {
    file: /^src\/cinema\/recommend\.ts$/,
    reason: '影视笔记 md 用户文档写（AI 推荐一键想看建条，含防重名前置拦截）',
  },
  {
    file: /^src\/bookshelf\/notes\.ts$/,
    reason: '书评/划线 md 用户笔记写，vault.process 原子读改写（audit D 已收口，Obsidian 内建单步语义）',
  },
  {
    file: /^src\/auto-summary\/processor\.ts$/,
    reason: '剪藏 frontmatter md 写回：写前重读最新内容仅合并目标字段（P1-21 防盲写），md 文件操作不套 json 原语（D3 拍板保留）',
  },
];

/** 读真实 src（POSIX 相对路径，src/ 前缀） */
const FILES = collectTsFiles(SRC_ROOT).map((full) => ({
  path: 'src/' + relative(SRC_ROOT, full).split('\\').join('/'),
  content: readFileSync(full, 'utf8'),
}));

const violationsOf = (hits: GateHit[]): GateHit[] => hits.filter((h) => !WHITELIST.some((w) => w.file.test(h.path)));

describe('D3 直写守门：扫描 src/**/*.ts', () => {
  it('扫描面非空（src 下 .ts 文件已收集）', () => {
    expect(FILES.length).toBeGreaterThan(50);
  });

  it('白名单外的裸直写 = 违规（当前必须为零）', () => {
    const violations = violationsOf(scanRawVaultWrites(FILES));
    if (violations.length) {
      const detail = violations.map((v) => `  ${v.path}:${v.line}  ${v.api}  ← ${v.snippet}`).join('\n');
      throw new Error(
        `发现 ${violations.length} 处契约外裸直写，请改走 core/storage 契约` +
          `（enqueueFileTask/updateFileSections/jsonFileStore）；确属例外请进 WHITELIST 并注明理由：\n${detail}`
      );
    }
  });

  it('白名单新鲜度：非哨兵条目失去对应命中即过期（清单短而准）', () => {
    const hits = scanRawVaultWrites(FILES);
    const stale = WHITELIST.filter((w) => !w.sentinel && !hits.some((h) => w.file.test(h.path)));
    if (stale.length) {
      throw new Error(
        '白名单条目已无对应直写命中（收编完成请移除条目）：\n' +
          stale.map((s) => `  ${s.file.source} — ${s.reason}`).join('\n')
      );
    }
  });

  it('哨兵：core/json-store.ts 必须保持零裸写（薄封装转发 jsonFileStore）', () => {
    const hits = scanRawVaultWrites(FILES).filter((h) => h.path === 'src/core/json-store.ts');
    expect(hits).toEqual([]);
  });
});

describe('D3 直写守门引擎自检（白名单命中/未命中）', () => {
  const scanOne = (path: string, content: string): GateHit[] => scanRawVaultWrites([{ path, content }]);

  it('未命中白名单：裸 vault.modify/adapter.write 即违规，报行号与 API', () => {
    const hits = scanOne(
      'src/fake-domain/data.ts',
      [
        'export async function save() {',
        '  await app.vault.modify(f, content);',
        '}',
        'await adapter.write(p, s);',
      ].join('\n')
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ path: 'src/fake-domain/data.ts', line: 2 });
    expect(hits[0].api).toContain('vault.modify');
    expect(hits[1].api).toContain('adapter.write');
  });

  it('命中白名单：同一内容落在白名单文件 → 扫描器报命中、清单可豁免', () => {
    const hits = scanOne('src/cinema/ui.ts', 'await app.vault.create(filePath, content);');
    expect(hits).toHaveLength(1);
    expect(WHITELIST.some((w) => w.file.test(hits[0].path))).toBe(true);
  });

  it('注释与字符串/正则字面量里的 API 名不构成命中', () => {
    const hits = scanOne(
      'src/fake-domain/a.ts',
      [
        '// 写盘收口 vault.process 原子读改写',
        '/* vault.modify(f, c) */',
        'const tip = "请勿直接 vault.create(p, c)";',
        "const re = /vault\\.modify\\(/g;",
        'const tpl = `see vault.modify(x)`;',
      ].join('\n')
    );
    expect(hits).toEqual([]);
  });

  it('契约队列内 IO 豁免：enqueueFileTask 区域内的直写自动合规（diary/epub-notes 收编形态）', () => {
    const hits = scanOne(
      'src/fake-domain/b.ts',
      [
        'export async function writeFile(p: string) {',
        '  await enqueueFileTask(p, async () => {',
        '    const f = app.vault.getAbstractFileByPath(p);',
        '    if (f) await app.vault.modify(f, c);',
        '    else await app.vault.create(p, c);',
        '  });',
        '}',
        'await updateFileSections(p, (cur) => ({ a: 1 }));',
      ].join('\n')
    );
    expect(hits).toEqual([]);
  });

  it('队列区域之外的直写仍被抓（区域豁免不外溢）', () => {
    const hits = scanOne(
      'src/fake-domain/c.ts',
      ['await enqueueFileTask(p, async () => {', '  await app.vault.modify(f, c);', '});', 'await app.vault.modify(f2, c2);'].join('\n')
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(4);
  });

  it('API 覆盖：createBinary/process/writeBinary/modifyBinary/append 命中；createFolder/processFrontMatter 不误报', () => {
    const hits = scanOne(
      'src/fake-domain/d.ts',
      [
        'await app.vault.createFolder(dir);',
        'await app.fileManager.processFrontMatter(file, fn);',
        'await app.vault.createBinary(a.path, buf);',
        'await app.vault.process(file, fn2);',
        'await vault.writeBinary(path, buf);',
        'await vault.modifyBinary(f, buf);',
        'await adapter.append(logPath, line);',
      ].join('\n')
    );
    const apis = hits.map((h) => h.api);
    expect(apis.some((a) => a.includes('vault.createBinary'))).toBe(true);
    expect(apis.some((a) => a.includes('vault.process'))).toBe(true);
    expect(apis.some((a) => a.includes('vault.writeBinary'))).toBe(true);
    expect(apis.some((a) => a.includes('vault.modifyBinary'))).toBe(true);
    expect(apis.some((a) => a.includes('adapter.append'))).toBe(true);
    expect(apis.some((a) => a.includes('createFolder') || a.includes('processFrontMatter'))).toBe(false);
  });

  it('模板串 ${} 插值内的代码照常扫描（不因模板串整体吞掉而漏报）', () => {
    const hits = scanOne('src/fake-domain/e.ts', ['const msg = `x ${app.vault.modify(f, c)} y`;'].join('\n'));
    expect(hits).toHaveLength(1);
  });

  it('除号不误判为正则（正则启发式不吞后续代码）', () => {
    const hits = scanOne(
      'src/fake-domain/f.ts',
      ['const half = total / 2;', 'await app.vault.modify(f, c);'].join('\n')
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(2);
  });

  it('return 后的正则字面量被整体置空（不把正则内容当代码）', () => {
    const hits = scanOne(
      'src/fake-domain/g.ts',
      ['function f() {', '  return /app\\.vault\\.modify\\(/;', '}', 'await app.vault.modify(f, c);'].join('\n')
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(4);
  });
});
