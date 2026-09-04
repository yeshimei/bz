# issue 196：core 新增全局覆盖层 reset.css（2026-09-05）

## 背景

用户提出「core 中增加一个 reset.css 当做全局样式重置」。经确认，意图不是标准 reset 库
（normalize 已于 09-02 定稿为全局唯一 reset，见 vendor/normalize.css），而是要一个
**手动覆盖层**：专门存放「把 Obsidian 核心/浏览器已有默认样式压回去」的手写全局规则。

## 改动

- 新建 `src/core/reset.css`：文件头写明定位（手动全局覆盖层，区别于 normalize 的
  跨浏览器修正）与规矩（只放全局基线不带域语义、低特异性可被单类覆盖、每条注明动机）。
- `src/core/styles.css` 顶部裸 button 三属性 unset 基线整体迁入 reset.css（原位留
  指路注释）——级联等价：reset.css 在 SOURCES 中紧随 normalize、先于 core/styles.css，
  该规则相对其后所有规则的先后关系不变。
- `scripts/build-css.mjs`：SOURCES 插入 `src/core/reset.css`（normalize 之后），
  头部源文件布局与顺序说明同步。
- `docs/ui-kit-manual.md` §2 文件地图增「全局基线」两行（normalize + reset.css），
  构建顺序描述更新。

## 非目标

- 不动 normalize（仍是跨浏览器唯一 reset）。
- 不新增视觉值；本 issue 只立文件与迁移既有规则，后续覆盖需求逐条累积于此。
