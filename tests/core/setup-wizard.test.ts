/**
 * core/setup-wizard 的任务编排：勾选清单 → 补齐队列。
 * 这里只测纯函数（buildSetupTasks / sizeText）——DOM 与真实下载不在单测里跑，
 * 但「下哪些、按什么顺序下、体积怎么算」是这里的责任，也最容易写错。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildSetupTasks,
  defaultSelection,
  resourceDocsOf,
  selectedTasks,
  setupAlreadyDone,
  setupDoneStorageKey,
  sizeText,
  splitProbeRows,
} from '../../src/core/setup-wizard';
import { DOC_VISIBILITY } from '../../src/core/doc-visibility';
import type { DownloadManifest } from '../../src/core/download-manifest';

// 与「在线资源」组 / 启动链同口径：本文件钉的是编排本身（顺序、体积、勾选），文档显隐开关
// 默认关（core/doc-visibility）——这里翻回 true，日志/手册照旧进队列，「功能还在」有凭据；
// 关着的行为由文件末尾那一组单独钉。
beforeEach(() => {
  DOC_VISIBILITY.changelogInResources = true;
  DOC_VISIBILITY.manualInResources = true;
});

/** 兜底标记的新格式：旧版的裸 `'1'` 已不再认（见 setupAlreadyDone 的说明） */
const STAMP = JSON.stringify({ at: 1700000000000 });

const manifest: DownloadManifest = {
  version: 1,
  docs: [
    { id: 'changelog', name: '更新日志', file: 'bz-changelog.html', sha256: 'a'.repeat(64), size: 1000 },
    { id: 'tool-bili-downloader', name: 'B站下载器', file: 'tools/bili-downloader.tar.gz', sha256: 'b'.repeat(64), kind: 'bundle', size: 26 * 1024 },
    { id: 'tool-dock-watch', name: '工具坞值守', file: 'tools/dock-watch.tar.gz', sha256: 'c'.repeat(64), kind: 'bundle', size: 46 * 1024 },
    { id: 'cinema-douban-index', name: '豆瓣影视索引', file: 'cinema-douban-index.json', sha256: 'd'.repeat(64), size: 7 * 1024 * 1024 },
  ],
  skins: [
    { id: 'noir', domain: 'memo', name: '墨', file: 'skins/memo/noir.css', sha256: 'e'.repeat(64), size: 2000 },
    { id: 'mono', domain: 'memo', name: '素', file: 'skins/memo/mono.css', sha256: 'f'.repeat(64), size: 3000 },
  ],
};

describe('首次准备：补齐队列', () => {
  it('Node 排第一（36MB 最久，先让小包在它之后秒完）', () => {
    const tasks = buildSetupTasks({}, manifest, { nodeMissing: true });
    expect(tasks[0].id).toBe('node');
    expect(tasks[0].size).toBeGreaterThan(30 * 1024 * 1024);
  });

  it('已有 Node → 不排 Node 任务', () => {
    const tasks = buildSetupTasks({}, manifest, { nodeMissing: false });
    expect(tasks.some((t) => t.id === 'node')).toBe(false);
  });

  it('目录包先于文档（工具是「能不能用」，文档是「查得到」）', () => {
    const ids = buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => t.id);
    expect(ids.indexOf('tool-bili-downloader')).toBeLessThan(ids.indexOf('changelog'));
    expect(ids.indexOf('tool-dock-watch')).toBeLessThan(ids.indexOf('cinema-douban-index'));
  });

  it('在线资源全部进队列（文档 + 索引 + 皮肤都在，不留「选择性漏下」）', () => {
    const ids = buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => t.id);
    expect(ids).toContain('changelog');
    expect(ids).toContain('cinema-douban-index');
    expect(ids).toContain('skins');
  });

  it('皮肤合并成一项，体积是各套之和', () => {
    const skin = buildSetupTasks({}, manifest, { nodeMissing: false }).find((t) => t.id === 'skins')!;
    expect(skin.size).toBe(5000);
    expect(skin.desc).toContain('2 套');
  });

  it('Python / ffmpeg 不再进队列（系统级运行时归「安装外部工具」）', () => {
    // 这条队列只会往插件目录搬东西：装出来的便携副本换仓库就没了，
    // 还会把那个会消失的路径写进设置。2026-11-01 起它们不再由这里装。
    const ids = buildSetupTasks({}, manifest, { nodeMissing: true }).map((t) => t.id);
    expect(ids.some((id) => id.startsWith('dep-'))).toBe(false);
  });

  it('bz reader 进队列（清单拉不到也能装），排在 Node 之后', () => {
    const tasks = buildSetupTasks({}, null, { nodeMissing: true, readerMissing: true });
    expect(tasks.map((t) => t.id)).toEqual(['node', 'reader']);
    const reader = tasks.find((t) => t.id === 'reader')!;
    expect(reader.kind).toBe('reader');
    expect(reader.label).toBe('bz reader');
    expect(reader.size).toBeGreaterThan(0);
  });

  it('已装 bz reader → 不进队列（重跑引导不重下）', () => {
    const ids = buildSetupTasks({}, manifest, { nodeMissing: false, readerMissing: false }).map((t) => t.id);
    expect(ids).not.toContain('reader');
  });

  it('清单拉不到 → 只剩 Node 任务（不静默当成「没有要下的」）', () => {
    const tasks = buildSetupTasks({}, null, { nodeMissing: true });
    expect(tasks.map((t) => t.id)).toEqual(['node']);
  });

  it('清单拉不到且已有 Node → 空队列（界面据此说「什么都不缺」）', () => {
    expect(buildSetupTasks({}, null, { nodeMissing: false })).toEqual([]);
  });
});

describe('体积文案', () => {
  it('MB / KB 分档，0 与空值不显示', () => {
    expect(sizeText(36.4 * 1024 * 1024)).toBe('36 MB'); // ≥10MB 取整，别摆小数
    expect(sizeText(26 * 1024)).toBe('26 KB');
    expect(sizeText(0)).toBe('');
    expect(sizeText(null)).toBe('');
  });
});

describe('首装与启动链同口径：在线资源一次全下（2026-11-02 用户拍板）', () => {
  it('大件索引没有「可先跳过」的例外：与其它文档同形（只给名称与体积）', () => {
    const items = buildSetupTasks({}, manifest, { nodeMissing: false });
    const big = items.find((t) => t.id === 'cinema-douban-index')!;
    const normal = items.find((t) => t.id === 'changelog')!;
    expect(big.desc).toBe(normal.desc);
    expect(big.desc).toBe('');
    expect(big.size).toBeGreaterThan(0); // 体积照实给，用户看得见这一项大
  });

  it('defaultSelection 全部勾上（含大件索引与皮肤：装了不等于能用，用户 2026-10-28 拍板）', () => {
    const items = buildSetupTasks({}, manifest, { nodeMissing: true }).map((t) => ({ ...t, ready: false }));
    const selected = defaultSelection(items);
    expect(selected.has('cinema-douban-index')).toBe(true);
    expect(selected.has('skins')).toBe(true);
    expect(selected.has('changelog')).toBe(true);
    expect(selected.has('tool-dock-watch')).toBe(true);
  });

  it('已就绪的不进勾选（勾中也只补真缺的）', () => {
    const items = buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => ({
      ...t,
      ready: t.id === 'changelog',
    }));
    const selected = defaultSelection(items);
    expect(selected.has('changelog')).toBe(false);
    expect(selectedTasks(items, selected).some((t) => t.id === 'changelog')).toBe(false);
    // 没就绪的照旧全勾
    expect(selectedTasks(items, selected).map((t) => t.id)).toContain('skins');
  });

  it('用户取消勾选 → 不跑那一项', () => {
    const items = buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => ({ ...t, ready: false }));
    const selected = new Set(['cinema-douban-index']);
    expect(selectedTasks(items, selected).map((t) => t.id)).toEqual(['cinema-douban-index']);
  });
});


describe('检测屏的分段：工具只出现一次（2026-10-28 截图里的重复）', () => {
  const rows = [
    { id: 'runtime', key: '运行环境' },
    { id: 'node', key: 'Node 运行时' },
    { id: 'tool-B站下载器', key: 'B站下载器' },
    { id: 'tool-工具坞值守', key: '工具坞值守' },
    { id: 'tool-脸谱工具包', key: '脸谱工具包' },
    { id: 'python', key: 'Python 环境' },
    { id: 'ai', key: 'AI 服务' },
  ];

  it('三个工具进「外部工具」段，环境行里不再出现它们', () => {
    const { env, tools } = splitProbeRows(rows);
    expect(tools.map((r) => r.key)).toEqual(['B站下载器', '工具坞值守', '脸谱工具包']);
    expect(env.map((r) => r.key)).toEqual(['运行环境', 'Node 运行时', 'Python 环境', 'AI 服务']);
  });

  it('两段互斥：没有任何一行同时出现在两边', () => {
    const { env, tools } = splitProbeRows(rows);
    const set = new Set(tools.map((r) => r.key));
    expect(env.some((r) => set.has(r.key))).toBe(false);
    expect(env.length + tools.length).toBe(rows.length);
  });

  it('「在线资源」段排除目录包：工具不会在下面再列一遍', () => {
    const docs = [
      { id: 'changelog', name: '更新日志' },
      { id: 'tool-dock-watch', name: '工具坞值守', kind: 'bundle' },
      { id: 'manual', name: '使用手册' },
    ];
    expect(resourceDocsOf({ docs }).map((d) => d.id)).toEqual(['changelog', 'manual']);
  });
});

/**
 * 引导是否已走过：**必须按库分开**。
 *
 * localStorage 是 Obsidian 整个应用共用的，用一把全局键会让「在 A 库走完引导」变成
 * 「新开的 B 库也算走过」——2026-10-28 用户报障：换个新库打开插件，Node、工具包、文档
 * 一概没有，却一次引导都不弹。
 */
describe('引导已走过：按库分键', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('设置里 setupDone=true → 走过（与库无关，data.json 本来就是按库的）', () => {
    expect(setupAlreadyDone({ setupDone: true }, 'E:/vault-a')).toBe(true);
  });

  it('localStorage 兜底按库分键：A 库走过不影响 B 库', () => {
    localStorage.setItem(setupDoneStorageKey('E:/vault-a'), STAMP);
    expect(setupAlreadyDone(null, 'E:/vault-a')).toBe(true);
    expect(setupAlreadyDone(null, 'E:/vault-b')).toBe(false);
  });

  it('路径形态不同但指向同一个库 → 视为同一个库（反斜杠/尾斜杠归一）', () => {
    localStorage.setItem(setupDoneStorageKey('E:\\vault-a\\'), STAMP);
    expect(setupAlreadyDone(null, 'E:/vault-a')).toBe(true);
  });

  it('取不到 vault 路径 → 退回全局那把键（不因此崩，也不误判成「走过」）', () => {
    expect(setupDoneStorageKey('')).toBe('bz-setup-done');
    expect(setupAlreadyDone(null, '')).toBe(false);
    localStorage.setItem('bz-setup-done', STAMP);
    expect(setupAlreadyDone(null, '')).toBe(true);
  });
});

/**
 * 删掉 data.json 想把引导重走一遍 —— 第一次启动就必须弹（2026-10-29 用户报障：
 * 「首次打开没有引导页，第二次打开才有」）。
 *
 * 根因：旧版引导结束时**无条件**往 localStorage 写一个裸 `'1'`。用户删了 data.json，
 * 第一次启动 data.json 不存在 → 判据落到兜底键 → 被那把旧 `'1'` 静默拦住；
 * 而这一次启动恰好又把 data.json 写了出来（含 setupDone:false），于是第二次反而弹了。
 *
 * 现在兜底键只认新格式（`{"at":…}`），裸 `'1'` 当作没记过并清掉。
 */
describe('引导已走过：旧版裸标记不再生效', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('裸 \'1\'（旧版写的）→ 不算走过，并把它清掉', () => {
    const key = setupDoneStorageKey('E:/vault-a');
    localStorage.setItem(key, '1');
    expect(setupAlreadyDone(null, 'E:/vault-a')).toBe(false);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('新格式标记 → 走过（只读库靠它防每次启动都弹）', () => {
    localStorage.setItem(setupDoneStorageKey('E:/vault-a'), STAMP);
    expect(setupAlreadyDone(null, 'E:/vault-a')).toBe(true);
  });
});

/**
 * 手改 `"setupDone": false` 必须能复位引导（2026-10-28 用户报障）。
 *
 * 兜底键只在「设置压根写不进去」时才有资格说话：关过引导的人，localStorage 里已经有一把
 * 标记，若还让兜底参与判定，改 data.json 就永远看不到引导 —— 而手改 data.json 是用户最直接
 * 的复位手段。第三个参数 = data.json 是否存在（main.ts 从 loadData 的原始对象判断）。
 */
describe('引导已走过：设置优先，兜底只兜「设置写不进去」', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('data.json 里明确 false + 兜底键还在 → 仍算没走过（复位生效）', () => {
    localStorage.setItem(setupDoneStorageKey('E:/vault-a'), STAMP);
    expect(setupAlreadyDone({ setupDone: false }, 'E:/vault-a', true)).toBe(false);
  });

  it('data.json 里明确 true → 走过（哪怕兜底键被清掉）', () => {
    expect(setupAlreadyDone({ setupDone: true }, 'E:/vault-a', true)).toBe(true);
  });

  it('data.json 存在但没有这个键（老版本写的文件）→ 只信设置：弹，无视兜底键', () => {
    localStorage.setItem(setupDoneStorageKey('E:/vault-a'), STAMP);
    expect(setupAlreadyDone({ setupDone: false }, 'E:/vault-a', true)).toBe(false);
  });

  it('data.json 根本不存在（只读库/首次）→ 才吃兜底键', () => {
    localStorage.setItem(setupDoneStorageKey('E:/vault-a'), STAMP);
    expect(setupAlreadyDone({ setupDone: false }, 'E:/vault-a', false)).toBe(true);
  });
});

/**
 * 三处教程入口各指一集（2026-11-01 用户拍板）：
 *   关于组＝第 1P（裸链接）／引导完成屏＝第 4P／依赖清单弹窗＝第 3P；
 * 界面上不写分P（不出现「4P」「共几集」），完成屏也不再弹「去 B 站看？」确认。
 *
 * 为什么用源码断言而不是起 DOM：链接与确认弹窗都长在渲染函数深处，拉一整套 app/state
 * 只为了看一个 href 不划算；这里真正要防的是「哪天被人顺手改回去」。
 */
describe('视频教程三处入口：各指一集，界面上不写分P', () => {
  const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const ABOUT = src('../../src/core/about-group.ts');
  const SETUP = src('../../src/core/setup-wizard.ts');
  const DEPS = src('../../src/core/deps-guide.ts');

  it('关于组：第 1P，裸链接（不带 ?p=）', () => {
    expect(ABOUT).toContain("const VIDEO_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/';");
    expect(ABOUT).toContain("name: '视频教程'");
  });

  it('完成屏：文案仍是「看使用教程 →」，直连第 4P，不再二次确认', () => {
    expect(SETUP).toContain("'看使用教程 →'");
    expect(SETUP).toContain("const TUTORIAL_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/?p=4';");
    // 注释里会提到「不再问去 B 站看」，所以这里只看代码：确认弹窗的标题字面量必须消失
    expect(SETUP, '跳外链前的「去 B 站看？」确认已撤').not.toContain("title: '去 B 站");
  });

  it('依赖清单弹窗：第 3P，且不再把集数写进 tooltip', () => {
    expect(DEPS).toContain("const TUTORIAL_URL = 'https://www.bilibili.com/video/BV1vNsZ6pE7i/?p=3';");
    expect(DEPS).not.toContain('共 ${');
  });

  it('三处的链接行都不带分享追踪参数（换个人分享就变）', () => {
    const urlLineOf = (s: string) =>
      s.split('\n').find((l) => l.includes("'https://www.bilibili.com/video/BV1vNsZ6pE7i/")) as string;
    for (const [file, s] of [['about-group', ABOUT], ['setup-wizard', SETUP], ['deps-guide', DEPS]] as const) {
      const line = urlLineOf(s);
      expect(line, file).toBeTruthy();
      expect(line, file).not.toContain('vd_source');
      expect(line, file).not.toContain('spm_id_from');
    }
  });
});

describe('已隐藏的文档不进首装队列（core/doc-visibility，2026-11-02：只隐藏不删）', () => {
  it('开关关（默认）：更新日志不进队列，其余文档与皮肤照进', () => {
    DOC_VISIBILITY.changelogInResources = false;
    DOC_VISIBILITY.manualInResources = false;
    const ids = buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => t.id);
    expect(ids).not.toContain('changelog');
    expect(ids).toContain('cinema-douban-index');
    expect(ids).toContain('skins');
  });

  it('开关翻回 true：更新日志回到队列（功能没删）', () => {
    DOC_VISIBILITY.changelogInResources = true;
    expect(buildSetupTasks({}, manifest, { nodeMissing: false }).map((t) => t.id)).toContain('changelog');
  });

  it('resourceDocsOf 随开关走：关 → 空；开 → 日志与手册都在', () => {
    const docs = [
      { id: 'changelog', name: '更新日志' },
      { id: 'tool-dock-watch', name: '工具坞值守', kind: 'bundle' },
      { id: 'manual', name: '使用手册' },
    ];
    DOC_VISIBILITY.changelogInResources = false;
    DOC_VISIBILITY.manualInResources = false;
    expect(resourceDocsOf({ docs }).map((d) => d.id)).toEqual([]);
    DOC_VISIBILITY.changelogInResources = true;
    DOC_VISIBILITY.manualInResources = true;
    expect(resourceDocsOf({ docs }).map((d) => d.id)).toEqual(['changelog', 'manual']);
  });
});
