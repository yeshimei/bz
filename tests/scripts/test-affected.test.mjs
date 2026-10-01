// @vitest-environment node
/**
 * scripts/test-affected.mjs —— 增量选择器回归测试。
 *
 * 这块的地基是**「不许漏」**：`vitest --changed` / `related` 在本仓的失效点正是
 * 「样式变更命中 0 个测试且退出码 0」（2026-10-01 实测，见 issues/534）。
 * 所以主断言分三类：
 *  1. 三类依赖边（import / 文本 / 目录）真的建起来了；
 *  2. 硬升格规则该全量时全量、不该全量时别全量；
 *  3. **拿真实仓库跑**：改样式必须命中该域的样式守卫、改锁文件/配置必须全量 —— 这几条
 *     一旦回归就是回到假绿，是最不该丢的性质。
 *
 * 约定：本文件里（**包括注释**）不许出现会解析成真实仓库路径的字面量 —— 反引号也算字面量，
 * 所以注释里写目录名别加反引号、别带尾斜杠。原因见 affected-repo-paths.ts 的文件头：
 * 这些字面量会被选择器当成文本边读走，轻则自指噪声（本文件被无谓卷进每一次相关选择），
 * 重则把「索引根之外且没有守卫读它 → 全量」这条兜底压掉（本文件倒是被选中了，
 * 可它根本不会去查那个文件）= 假绿。真实路径从 affected-repo-paths.ts 取，夹具路径用假名。
 * 唯一的例外是 harness 那个夹具：它必须真的叫 package.json / tests/setup.ts 才验得出
 * 「改了 harness 缓存整体作废」，而这两条本来就走全量，没有假绿空间。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  _clearContentCache,
  applyCache,
  buildIndex,
  classify,
  fileKey,
  harnessHash,
  harnessParts,
  parseArgs,
  pickTests,
  textEdgeHit,
  updateFromReport,
  walkTests,
} from '../../scripts/test-affected.mjs';
import { GUARD, PREFIX, REPO } from './affected-repo-paths';

const ROOT = process.cwd();

// ───────────────────────── 临时夹具 ─────────────────────────

let tmpRoot = null;

/** 在临时目录里搭一个迷你仓库（src/tests/scripts 三段结构） */
function makeRepo(files) {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bz-inc-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(tmpRoot, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  _clearContentCache();
  return tmpRoot;
}

function write(rel, content) {
  const abs = path.join(tmpRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  _clearContentCache();
}

afterEach(() => {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
  _clearContentCache();
});

// ───────────────────────── 1. 依赖边 ─────────────────────────

describe('buildIndex 三类依赖边', () => {
  it('import 边：相对路径解析到仓库内文件（含 index.ts 兜底）', () => {
    const root = makeRepo({
      'src/a/leaf.ts': 'export const x = 1;',
      'src/a/index.ts': "export * from './leaf';",
      'src/consumer.ts': "import { x } from './a';",
      'tests/t.test.ts': "import '../src/consumer';",
    });
    const idx = buildIndex(root);
    expect(idx.importEdges.get('src/consumer.ts').has('src/a/index.ts')).toBe(true);
    expect(idx.importEdges.get('src/a/index.ts').has('src/a/leaf.ts')).toBe(true);
    expect(idx.importEdges.get('tests/t.test.ts').has('src/consumer.ts')).toBe(true);
  });

  it('文本边：测试用字符串字面量直接读源码时也建边（这是 vitest 模块图看不见的那类）', () => {
    const root = makeRepo({
      // 路径藏在变量/helper 里 —— 只抓 'src/...' 字面量的写法会漏
      'src/memo/fake-styles.css': '.a{color:red}',
      'tests/m/text.test.ts': [
        "import { readFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const repo = (p) => readFileSync(join(process.cwd(), p), 'utf8');",
        "it('x', () => expect(repo('src/memo/fake-styles.css')).toContain('red'));",
      ].join('\n'),
    });
    const idx = buildIndex(root);
    const edges = idx.textEdges.get('tests/m/text.test.ts') ?? [];
    expect(edges.some((e) => e.kind === 'file' && e.target === 'src/memo/fake-styles.css')).toBe(
      true,
    );
  });

  it('文本边不限 src/tests/scripts：索引根之外的路径（downloads / tools / prototypes）也算', () => {
    const root = makeRepo({
      'downloads/fake-catalog.json': '{}',
      'tools/fake-tool/lib/core.js': 'module.exports = {};',
      'tests/outside.test.ts': [
        "import { readFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const repo = (p) => readFileSync(join(process.cwd(), p), 'utf8');",
        "it('看远端清单', () => expect(repo('downloads/fake-catalog.json')).toBe('{}'));",
        "it('看工具', () => expect(repo('tools/fake-tool/lib/core.js')).toContain('exports'));",
      ].join('\n'),
    });
    const idx = buildIndex(root);
    const targets = (idx.textEdges.get('tests/outside.test.ts') ?? []).map((e) => e.target);
    expect(targets).toContain('downloads/fake-catalog.json');
    expect(targets).toContain('tools/fake-tool/lib/core.js');
  });

  it('文本边不认「不存在的路径」：URL / 绝对路径 / vault 内路径 / 夹具假路径一律丢', () => {
    // 注意 `.toContain(...)` 里的那个裸字面量：**不能**写成仓库根真目录名（tools / downloads），
    // 否则在真实仓库里它就是一条自指目录边（见本节末尾那条守卫）。
    const root = makeRepo({
      'src/a.ts': 'export const a = 1;',
      'tests/noise.test.ts': [
        "it('噪声', () => {",
        "  expect('https://cdn.jsdelivr.net/gh/x/bz@master/downloads/manifest.json').toContain('http');",
        "  expect('D:/tools/ffmpeg.exe').toContain('ffmpeg');",
        "  expect('.obsidian/plugins/bz/downloads/templates.json').toContain('bz');",
        "  expect('归档/日记/2025-06-11.md').toContain('日记');",
        "  expect('downloads/ 顶层不允许清单外文件——未登记文件让 build-manifest 报错').toContain('顶层');",
        '});',
      ].join('\n'),
    });
    const idx = buildIndex(root);
    expect(idx.textEdges.get('tests/noise.test.ts') ?? []).toHaveLength(0);
  });

  it('目录边：扫树守卫（readdirSync 一个目录）→ 该目录下任何文件变更都命中', () => {
    const root = makeRepo({
      'src/big/one.ts': 'export const a = 1;',
      'src/big/two.ts': 'export const b = 2;',
      'tests/tree.test.ts': [
        "import { readdirSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "it('扫树', () => expect(readdirSync(join(process.cwd(), 'src/big'))).toHaveLength(2));",
      ].join('\n'),
    });
    const idx = buildIndex(root);
    const edges = idx.textEdges.get('tests/tree.test.ts') ?? [];
    const dirEdge = edges.find((e) => e.kind === 'dir');
    expect(dirEdge?.target).toBe('src/big');
    expect(textEdgeHit(dirEdge.target, 'dir', 'src/big/one.ts')).toBe(true);
    expect(textEdgeHit(dirEdge.target, 'dir', 'src/other/one.ts')).toBe(false);
  });

  it('目录实参带尾斜杠也要认：readdirSync(\'src/big/\') 不比不带斜杠弱', () => {
    const root = makeRepo({
      'src/big/one.ts': 'export const a = 1;',
      'tests/tree.test.ts': [
        "import { readdirSync } from 'node:fs';",
        "it('扫树', () => expect(readdirSync('src/big/')).toHaveLength(1));",
      ].join('\n'),
    });
    const edges = buildIndex(root).textEdges.get('tests/tree.test.ts') ?? [];
    expect(edges.some((e) => e.kind === 'dir' && e.target === 'src/big')).toBe(true);
    expect(textEdgeHit('src/big', 'dir', 'src/big/one.ts')).toBe(true);
  });
});

// ───────────────────────── 1.5 CLI 参数 ─────────────────────────

describe('CLI 参数解析', () => {
  it('--since 两种写法等价；位置参数只收变更文件', () => {
    expect(parseArgs(['--since', 'master']).since).toBe('master');
    // `--since=master` 曾被静默当成没传（退回 HEAD，选的改动集悄悄变了）
    expect(parseArgs(['--since=master']).since).toBe('master');
    expect(parseArgs([]).since).toBe('HEAD');
    // 空值不能漏出去：`git diff <undefined>` 不是「相对 HEAD」那件事
    expect(parseArgs(['--since']).since).toBe('HEAD');
    expect(parseArgs(['--since=']).since).toBe('HEAD');
    expect(parseArgs(['src/a.ts', 'src/b.ts', '--list']).files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(parseArgs(['--since', 'master', 'src/a.ts']).files).toEqual(['src/a.ts']);
    expect(parseArgs(['src/a.ts', '--since=master']).files).toEqual(['src/a.ts']);
  });

  it('`--` 之后一律透传给 vitest，不当自己的参数', () => {
    const o = parseArgs(['src/a.ts', '--', '--reporter=dot', '--list']);
    expect(o.files).toEqual(['src/a.ts']);
    expect(o.passthrough).toEqual(['--reporter=dot', '--list']);
    expect(o.list).toBe(false);
  });

  it('--full / --list / --no-cache / 自带 reporter 都认得出', () => {
    expect(parseArgs(['--full']).full).toBe(true);
    expect(parseArgs(['--list']).list).toBe(true);
    expect(parseArgs(['--no-cache']).useCache).toBe(false);
    expect(parseArgs(['--reporter=dot']).reporterGiven).toBe(true);
    expect(parseArgs(['src/a.ts']).reporterGiven).toBe(false);
  });
});

// ───────────────────────── 2. 硬升格规则 ─────────────────────────

describe('classify 硬升格', () => {
  const repo = () =>
    makeRepo({
      'src/core/fake-app.ts': 'export const app = 1;',
      'src/core/ui/fake-components.css': '.bz-a{}',
      'src/memo/fake-data.ts': 'export const m = 1;',
      'src/memo/fake-styles.css': '.memo{}',
      'tests/memo/fake-data.test.ts': "import '../../src/memo/fake-data';",
      'tests/core/fake-ui-scrollbar.test.ts': [
        "import { readFileSync, readdirSync, statSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const repo = (p) => readFileSync(join(process.cwd(), p), 'utf8');",
        "it('滚动条单源', () => expect(repo('src/core/ui/fake-components.css')).toContain('scrollbar'));",
      ].join('\n'),
      'tests/memo/fake-skin-dark.test.ts': [
        "import { readFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const repo = (p) => readFileSync(join(process.cwd(), p), 'utf8');",
        "it('深色皮肤', () => expect(repo('src/memo/fake-styles.css')).toContain('.memo'));",
      ].join('\n'),
    });

  const why = (root, file, status = 'M') =>
    classify({ changed: [{ file, status }], index: buildIndex(root) });

  it('依赖清单 / 测试配置 / 测试基建 / 全局夹具 → 全量', () => {
    const root = repo();
    for (const f of [
      REPO.lockfile,
      REPO.pkgJson,
      REPO.vitestConfig,
      REPO.tsconfig,
      REPO.testDomainScript,
      REPO.testsSetup,
      'tests/helpers/fake-date.ts',
    ]) {
      expect(why(root, f), f).not.toHaveLength(0);
    }
  });

  it('tests/ 下的非测试文件一律全量（共享夹具是开放集合，不逐个列举）', () => {
    const root = repo();
    expect(why(root, 'tests/some-new-fixture.ts')).not.toHaveLength(0);
    expect(why(root, 'tests/memo/fake-skin-dark.test.ts')).toHaveLength(0);
  });

  it('依赖图外的文件：有守卫引用 → 不升格；真·无主 → 全量', () => {
    const root = repo();
    // 这个 fixture 里没人引用它 → 没建边 → 全量（改了没人查不能默默过）
    expect(why(root, 'downloads/unreferenced.json')).not.toHaveLength(0);
    expect(why(root, REPO.rootMainJs)).not.toHaveLength(0);
    // 造一条真边：让守卫用字面量指着 downloads 下的文件 → 同一个文件不再升格
    write(
      'tests/skin/fake-catalog.test.ts',
      [
        "import { readFileSync } from 'node:fs';",
        "it('清单', () => expect(readFileSync('downloads/fake-catalog.json', 'utf8')).toBe('{}'));",
      ].join('\n'),
    );
    write('downloads/fake-catalog.json', '{}');
    expect(why(root, 'downloads/fake-catalog.json')).toHaveLength(0);
  });

  it('文档类 .md 不算「依赖图外」：没有任何测试把文档当输入', () => {
    const root = repo();
    // 用假文档名：写真实路径会在本文件里造出文本边（见 affected-repo-paths.ts 的说明）
    for (const f of ['docs/fake-changelog.md', 'issues/999-fake.md', 'FAKE-README.md', 'FAKE-AGENTS.md']) {
      expect(why(root, f), f).toHaveLength(0);
    }
  });

  it('core 下的 .ts → 全量；core 下的 .css 不因「在 core」而全量', () => {
    const root = repo();
    expect(why(root, 'src/core/fake-app.ts')).not.toHaveLength(0);
    expect(why(root, 'src/core/ui/fake-components.css')).toHaveLength(0);
  });

  it('没人引用的样式文件 → 全量（改了没人查 = 不能默默过）', () => {
    const root = repo();
    expect(why(root, 'src/memo/orphan.css')).not.toHaveLength(0);
  });

  it('有守卫引用的样式文件 → 不全量', () => {
    const root = repo();
    expect(why(root, 'src/memo/fake-styles.css')).toHaveLength(0);
  });

  it('src 模块新增/删除 → 全量（模块增删会改依赖方向与皮肤清单）', () => {
    const root = repo();
    expect(why(root, 'src/memo/new-thing.ts', 'A')).not.toHaveLength(0);
    expect(why(root, 'src/memo/fake-data.ts', 'D')).not.toHaveLength(0);
  });

  it('普通域内源码改动 → 不全量', () => {
    const root = repo();
    expect(why(root, 'src/memo/fake-data.ts')).toHaveLength(0);
  });
});

// ───────────────────────── 3. 取测试 ─────────────────────────

describe('pickTests', () => {
  it('无变更 → 空集合（不回退全量，由调用方显式 --full）', () => {
    const root = makeRepo({ 'src/a.ts': 'export const a=1;', 'tests/t.test.ts': "import '../src/a';" });
    const plan = pickTests({ root, files: [] });
    expect(plan.files).toHaveLength(0);
    expect(plan.reasons.join()).toContain('无变更');
  });

  it('改测试文件本身 → 必须跑它自己（它没有 importer，反向闭包找不到）', () => {
    const root = makeRepo({ 'src/a.ts': 'export const a=1;', 'tests/t.test.ts': "import '../src/a';" });
    const plan = pickTests({ root, files: ['tests/t.test.ts'] });
    expect(plan.files).toContain('tests/t.test.ts');
  });

  it('改源文件 → 命中 import 闭包 + 文本边守卫', () => {
    const root = makeRepo({
      'src/memo/fake-data.ts': 'export const m = 1;',
      'src/memo/fake-ui.ts': "import { m } from './fake-data'; export const u = m;",
      'tests/memo/fake-data.test.ts': "import '../../src/memo/fake-data';",
      'tests/memo/fake-ui.test.ts': "import '../../src/memo/fake-ui';",
      'tests/memo/fake-skin.test.ts': [
        "import { readFileSync } from 'node:fs';",
        "it('皮肤', () => expect(readFileSync('src/memo/marker.txt', 'utf8')).toBe('x'));",
      ].join('\n'),
      'src/memo/marker.txt': 'x',
    });
    const plan = pickTests({ root, files: ['src/memo/fake-data.ts'] });
    expect(plan.files).toContain('tests/memo/fake-data.test.ts');
    expect(plan.files).toContain('tests/memo/fake-ui.test.ts');
  });
});

// ───────────────────────── 4. 缓存 ─────────────────────────

describe('结果缓存', () => {
  it('fileKey：内容变了 key 就变；依赖闭包里的文件变了也变', () => {
    const root = makeRepo({
      'src/a.ts': 'export const a = 1;',
      'tests/t.test.ts': "import '../src/a';",
    });
    const idx0 = buildIndex(root);
    const h = harnessHash(root);
    const k0 = fileKey(root, 'tests/t.test.ts', idx0, h);

    write('src/a.ts', 'export const a = 2;');
    const k1 = fileKey(root, 'tests/t.test.ts', buildIndex(root), harnessHash(root));
    expect(k1.key).not.toBe(k0.key);

    write('tests/t.test.ts', "import '../src/a'; // touched");
    const k2 = fileKey(root, 'tests/t.test.ts', buildIndex(root), harnessHash(root));
    expect(k2.key).not.toBe(k1.key);
  });

  it('harness 分片变了 → 所有 key 变（锁文件/配置/夹具改了就整体作废）', () => {
    const root = makeRepo({
      'src/a.ts': 'export const a = 1;',
      'tests/t.test.ts': "import '../src/a';",
      'package.json': '{"name":"x"}',
      'tests/setup.ts': '// setup',
    });
    const idx = buildIndex(root);
    const before = harnessHash(root);
    write('package.json', '{"name":"y"}');
    expect(harnessHash(root)).not.toBe(before);
    expect(fileKey(root, 'tests/t.test.ts', idx, harnessHash(root)).key).not.toBe(
      fileKey(root, 'tests/t.test.ts', idx, before).key,
    );
  });

  it('harness 必须把**工具自身**算进去：改了指纹口径，旧缓存得整体作废', () => {
    const root = makeRepo({ 'src/a.ts': 'export const a = 1;', 'tests/t.test.ts': "import '../src/a';" });
    const parts = harnessParts(root);
    // 少了这一条，改 fileKey 的算法后旧 rows 仍会被复用 —— 修复本身会「继承」旧 bug
    expect(parts.some((p) => p.startsWith('tool:'))).toBe(true);
    expect(parts.find((p) => p.startsWith('tool:'))).not.toBe('tool:missing');
  });

  it('目录整树边要展开**索引根之外**的目标（downloads/manual/prototypes），否则选中了也白选', () => {
    // 复现的 P0：pickTests 靠 `dir downloads/fake-skins` 选中这个守卫，
    // 但 fileKey 只按 srcFiles 展开目录边 → 指纹里根本没有那个目录的文件 →
    // applyCache 拿旧 pass 一复用，守卫就再也不会跑。选中 ≠ 会跑。
    const root = makeRepo({
      'downloads/fake-skins/a.css': '.a{}',
      'tests/skin/catalog.test.ts': [
        "import { readdirSync } from 'node:fs';",
        "it('远端皮肤清单', () => expect(readdirSync('downloads/fake-skins')).toContain('a.css'));",
      ].join('\n'),
    });
    const idx = buildIndex(root);
    const h = harnessHash(root);
    const before = fileKey(root, 'tests/skin/catalog.test.ts', idx, h);
    expect(before.deps).toContain('downloads/fake-skins/a.css');

    // 改这个非 src 文件 → 指纹必须变，且缓存不得复用
    write('downloads/fake-skins/a.css', '.a{color:red}');
    const idx2 = buildIndex(root);
    const after = fileKey(root, 'tests/skin/catalog.test.ts', idx2, harnessHash(root));
    expect(after.key).not.toBe(before.key);

    const r = applyCache({
      root,
      files: ['tests/skin/catalog.test.ts'],
      index: idx2,
      cache: { version: 1, results: { 'tests/skin/catalog.test.ts': { status: 'pass', key: before.key } } },
      harness: harnessHash(root),
    });
    expect(r.reused).toHaveLength(0);
    expect(r.files).toEqual(['tests/skin/catalog.test.ts']);

    // 新增一个文件同样要变（靠目录边，不靠文件边）
    write('downloads/fake-skins/b.css', '.b{}');
    const idx3 = buildIndex(root);
    const added = fileKey(root, 'tests/skin/catalog.test.ts', idx3, harnessHash(root));
    expect(added.deps).toContain('downloads/fake-skins/b.css');
    expect(added.key).not.toBe(after.key);

    // 删掉一个也要变。指纹必须**当场钉住**：fileKey 里的目录边是现读磁盘展开的
    // （expandDir → walk / git 可见集），事后再拿同一个 idx3 重算是没意义的 ——
    // 那时磁盘已经变了，算出来和 idx4 一样，两边「一致地错」，断言会永远绿。
    fs.rmSync(path.join(root, 'downloads/fake-skins/b.css'));
    _clearContentCache();
    const idx4 = buildIndex(root);
    const removed = fileKey(root, 'tests/skin/catalog.test.ts', idx4, harnessHash(root));
    expect(removed.deps).not.toContain('downloads/fake-skins/b.css');
    expect(removed.key).not.toBe(added.key);
  });

  it('applyCache：只复用 pass；fail 必须重跑', () => {
    const root = makeRepo({
      'src/a.ts': 'export const a = 1;',
      'tests/good.test.ts': "import '../src/a';",
      'tests/bad.test.ts': "import '../src/a';",
    });
    const idx = buildIndex(root);
    const h = harnessHash(root);
    const cache = {
      version: 1,
      results: {
        'tests/good.test.ts': { status: 'pass', key: fileKey(root, 'tests/good.test.ts', idx, h).key },
        'tests/bad.test.ts': { status: 'fail', key: fileKey(root, 'tests/bad.test.ts', idx, h).key },
      },
    };
    const r = applyCache({
      root,
      files: ['tests/good.test.ts', 'tests/bad.test.ts'],
      index: idx,
      cache,
      harness: h,
    });
    expect(r.reused).toEqual(['tests/good.test.ts']);
    expect(r.files).toEqual(['tests/bad.test.ts']);
  });

  it('updateFromReport：本轮真跑过的按报告写回，没跑到的条目原样保留', () => {
    const root = makeRepo({
      'src/a.ts': 'export const a = 1;',
      'tests/ran.test.ts': "import '../src/a';",
      'tests/failed.test.ts': "import '../src/a';",
      'tests/notrun.test.ts': "import '../src/a';",
    });
    const idx = buildIndex(root);
    const h = harnessHash(root);
    // 上一次全量留下的结论：增量跑不能把它抹掉，也不能把没跑的文件伪造成本轮通过
    const kept = { status: 'pass', key: fileKey(root, 'tests/notrun.test.ts', idx, h).key };
    const cache = { version: 1, results: { 'tests/notrun.test.ts': { ...kept } } };

    const report = {
      testResults: [
        { name: path.join(root, 'tests/ran.test.ts'), status: 'passed' },
        { name: path.join(root, 'tests/failed.test.ts'), status: 'failed' },
      ],
    };
    const next = updateFromReport(cache, report, idx, h, root);

    expect(next.results['tests/ran.test.ts'].status).toBe('pass');
    expect(next.results['tests/ran.test.ts'].key).toBe(
      fileKey(root, 'tests/ran.test.ts', idx, h).key,
    );
    // 失败的写成 fail（下次必须重跑），不是不管
    expect(next.results['tests/failed.test.ts'].status).toBe('fail');
    // 报告里没有的文件：原条目一分不动
    expect(next.results['tests/notrun.test.ts']).toEqual(kept);
  });
});

// ───────────────────────── 5. 真实仓库（防回到假绿） ─────────────────────────

describe('真实仓库：不许回到「命中 0 个」的假绿', () => {
  const realPick = (file) => pickTests({ root: ROOT, files: [file] });

  it('改域内样式 → 命中该域的样式守卫（vitest related 这里是 0 个 + 退出码 0）', () => {
    const plan = realPick(REPO.memoStyles);
    expect(plan.mode).toBe('affected');
    expect(plan.files).toContain(GUARD.memoSkinDark);
  });

  it('改界面级单源 components.css → 命中滚动条单源守卫（ADR-0122）', () => {
    const plan = realPick(REPO.uiComponents);
    expect(plan.mode).toBe('affected');
    expect(plan.files).toContain(GUARD.uiScrollbar);
  });

  it('改依赖清单 → 全量', () => {
    const plan = realPick(REPO.lockfile);
    expect(plan.mode).toBe('full');
    expect(plan.files.length).toBe(walkTests(ROOT).length);
  });

  it('依赖图外的文件：有守卫读它 → 精确命中（不是全量）；真·无主 → 全量', () => {
    // downloads/ 与 tools/ 在索引根之外，但守卫确实用字符串字面量指着它们
    const remote = realPick(REPO.downloadsManifest);
    expect(remote.mode).toBe('affected');
    expect(remote.files).toContain(GUARD.skinPackCatalog);

    const tool = realPick(REPO.toolsRecCore);
    expect(tool.mode).toBe('affected');
    expect(tool.files.length).toBeGreaterThan(0);
    expect(tool.files.length).toBeLessThan(walkTests(ROOT).length);

    // 扫树守卫让「整个 downloads/ 目录」都有主：新加/改一个远端皮肤也命中
    expect(realPick(REPO.downloadsSkinCss).mode).toBe('affected');

    // 根 main.js 是构建产物，仓库里没有任何测试读它 → 没边 → 全量
    expect(realPick(REPO.rootMainJs).mode).toBe('full');
  });

  it('改文档 → 不全量、也不硬凑（没有测试受影响就是 0 个，交给调用方 --full）', () => {
    const plan = realPick(REPO.docChangelog);
    expect(plan.mode).toBe('affected');
    expect(plan.files).toHaveLength(0);

    const issue = realPick(REPO.issueFile);
    expect(issue.mode).toBe('affected');
    expect(issue.files).toHaveLength(0);
  });

  it('改域内源码 → 增量且是非空集合', () => {
    const plan = realPick(REPO.memoData);
    expect(plan.mode).toBe('affected');
    expect(plan.files.length).toBeGreaterThan(5);
    expect(plan.files.length).toBeLessThan(walkTests(ROOT).length);
  });

  it('扫树守卫在任何 src 变更下都必须被选中（依赖方向/渲染纯度/聚合清单）', () => {
    const plan = realPick(REPO.memoData);
    for (const guard of [GUARD.depsDirection, GUARD.renderPurity, GUARD.cssAggregationManifest]) {
      expect(plan.files, guard).toContain(guard);
    }
  });

  it('真实仓库：目录整树边按 git 可见全集展开，索引根之外（downloads/manual/prototypes）也要进指纹', () => {
    const idx = buildIndex(ROOT);
    const h = harnessHash(ROOT);
    // 这个守卫扫远端皮肤目录（readdirSync + sha256 清单），是「选中 ≠ 会跑」的高危面：
    // 目录边只按 src 展开的话，deps 里一个 downloads 的文件都没有，改了远端皮肤照样复用旧 pass。
    const deps = fileKey(ROOT, GUARD.skinPackCatalog, idx, h).deps;
    expect(deps.some((d) => d.startsWith(PREFIX.downloadsSkins))).toBe(true);
    // 分母是 git 可见集 → 被忽略的目录（node_modules、缓存目录）不该混进来
    expect(deps.some((d) => d.startsWith(PREFIX.nodeModules))).toBe(false);
  });

  it('本测试文件自己不许有「真实仓库的自指边」（夹具假路径不能撞上真目录名）', () => {
    // 夹具里编的路径本来是给临时目录用的假名，但只要它恰好也是仓库根的真目录名（tools / downloads…），
    // 选择器就会当真：本文件被卷进每一次该类目录的变更，更糟的是会把
    // 「索引根之外且没有守卫读它 → 全量」这条兜底压掉 —— 本文件被选中了，可它根本不查那个文件 = 假绿。
    const edges = (buildIndex(ROOT).textEdges.get(REPO.selfTest) ?? [])
      .map((e) => `${e.kind} ${e.target}`)
      .sort();
    expect(edges).toEqual([
      'file package.json',
      'file scripts/test-affected.mjs',
      'file tests/setup.ts',
    ]);
  });
});
