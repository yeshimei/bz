# 426 模型选择器行：长说明把模型名挤成逐字竖排

- 状态：已修复（2026-09-24）
- 关联：ticket 173（模型选择器弹窗）、issue 422/424（Embedding / JEV 行内「获取模型」入口）、
  ADR-0184

## 用户原话

截图（AI 面板「JEV 模型」行点「获取模型」后的弹窗，Typesafe）：模型名 `jev-latest` 被渲染成
**逐字竖排**（j/e/v/-/l/a/t/e/s/t 各占一行），右侧说明文案被弹窗边缘裁切。

## 现状与根因

`src/core/styles.css` 的 `.bz-model-picker-row` 是**单行 flex**（无 `flex-wrap`）：
- `.bz-model-picker-name`：`flex: 1 1 auto; min-width: 0; word-break: break-all`
- `.bz-model-picker-detail`：`flex: 0 0 auto`（不收缩）

Typesafe `/v1/models` 的 `description` 很长（`parseJevModels` 把 description + release_date 拼成
detail），detail 的 max-content 宽度直接超过行宽；因它 `flex-shrink: 0`，flex 只能压缩名字
（`min-width: 0` + `break-all`）→ 名字被压到一字宽 → 逐字竖排，detail 则溢出被裁切。
LLM/Embedding 行的 detail 短（如「128k 上下文」），故此前未暴露。

## 方案

行允许换行、说明可让位并就地折行（`src/core/styles.css`）：

```css
.bz-model-picker-row { flex-wrap: wrap; }
.bz-model-picker-detail { flex: 0 1 auto; min-width: 0; overflow-wrap: anywhere; }
```

- 说明放得下 → 与原来完全一致（单行、名字占满左侧）；
- 放不下 → **整段折到第二行**并在容器内折行，名字始终保持单行可读；
- 名字的 `min-width: 0` + `break-all` 保留（超长模型名仍有断字兜底）。

## 验证

- 探针页（`.scratch/picker-wrap/`，真 `src/core/styles.css`，420px / 700px 两档，旧规则内联复刻对照）
  headless 截图：修复前 420px 复现「逐字竖排 + 说明裁切」，修复后名字单行、说明整段折行；
  700px 下短说明仍单行紧凑（无回归）。
- `tests/core/model-picker-row-wrap.test.ts`（新，3 例）：锁 `.bz-model-picker-row` 的 `flex-wrap: wrap`、
  detail 的 `flex: 0 1 auto` + `min-width: 0` + `overflow-wrap: anywhere`（且不得回退 `flex: 0 0 auto`）、
  名字 `min-width: 0` 兜底。
- 门禁：`vitest run` 487 文件 / 7244 例全绿；`tsc --noEmit` exit 0；原型指纹同步无漂移。
