/**
 * 增量选择器测试要指着**真实仓库路径**做断言，这份清单单独放一个文件是有原因的。
 *
 * 选择器的「文本边」是从**测试文件里的字符串字面量**建的（见 scripts/test-affected.mjs 的
 * buildIndex）：字面量指向仓库里真实存在的路径 → 这条边就成立。如果把真实路径直接写在
 * `test-affected.test.mjs` 里，会立刻产生两个副作用：
 *  1. **自指噪声**：本测试文件被无谓地卷进每一次相关选择（`src/memo/styles.css` 一改就带上它）；
 *  2. **压掉本该升格的判断**：例如根 `main.js` 只因那句字面量就变成「有守卫引用」，
 *     于是「改了构建产物 → 全量」这条兜底永远不触发 —— 这是**假绿**方向的错，最不能忍。
 *
 * 非 `.test.(ts|mjs)` 的文件不参与文本边建图（buildIndex 只扫测试文件），所以路径集中在这里
 * 就两全：断言用的是真路径，选择器的索引里干干净净。
 */
export const REPO = {
  /** 域样式：改它应命中该域的样式守卫（vitest related 在这一格是 0 个 + 退出码 0） */
  memoStyles: 'src/memo/styles.css',
  /** 界面级单源：改它应命中滚动条单源守卫（ADR-0122） */
  uiComponents: 'src/core/ui/components.css',
  memoData: 'src/memo/data.ts',
  lockfile: 'pnpm-lock.yaml',
  pkgJson: 'package.json',
  vitestConfig: 'vitest.config.ts',
  tsconfig: 'tsconfig.json',
  testsSetup: 'tests/setup.ts',
  testDomainScript: 'scripts/test-domain.mjs',
  rootMainJs: 'main.js',
  /** 依赖图外但**有守卫在读**（tests/core/skin-pack-catalog.test.ts 用字符串字面量指着它） */
  downloadsManifest: 'downloads/manifest.json',
  downloadsSkinCss: 'downloads/skins/bookshelf/kraft.css',
  toolsRecCore: 'tools/obsidian-face/lib/rec-core.js',
  prototypesFakeObsidian: 'prototypes/diary/fake/fake-obsidian.ts',
  docChangelog: 'docs/changelog.md',
  issueFile: 'issues/534-test-affected-incremental.md',
  /** 本套测试自己（「不许有自指边」那条守卫要用它指自己） */
  selfTest: 'tests/scripts/test-affected.test.mjs',
} as const;

/**
 * 目录前缀断言用。同样是真实仓库路径片段，写进测试文件就会变成目录边
 * （`'downloads/skins/'` 一出现，本文件就被绑到远端皮肤目录上）。
 */
export const PREFIX = {
  /** 目录整树边必须展开到这里（git 可见集 ∩ downloads 前缀） */
  downloadsSkins: 'downloads/skins/',
  /** 幂等性分母不该混进被 git 忽略的目录 */
  nodeModules: 'node_modules/',
} as const;

/** 断言用的守卫文件路径（同样理由不写在测试文件里） */
export const GUARD = {
  memoSkinDark: 'tests/memo/skin-dark.test.ts',
  uiScrollbar: 'tests/core/ui-scrollbar.test.ts',
  depsDirection: 'tests/home/deps-direction.test.ts',
  renderPurity: 'tests/core/render-purity.test.ts',
  cssAggregationManifest: 'tests/core/css-aggregation-manifest.test.ts',
  skinPackCatalog: 'tests/core/skin-pack-catalog.test.ts',
  skinPackSplitGuard: 'tests/core/skin-pack-split-guard.test.ts',
} as const;
