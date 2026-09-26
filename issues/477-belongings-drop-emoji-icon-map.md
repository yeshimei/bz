# 477 · 归物本 445 条 emoji→lucide 映射表退役

- 状态：**已完成（2026-09-26）**
- 域：belongings（新建 `category.ts`、删除 `emoji-icon-map.ts`、改 `data.ts` / `shared.ts` / `ai.ts` / `ui.ts`）+ prototypes（`prototype-icons.js` 清段 + belongings 两侧产物重出）+ tests
- 来源：用户问「归物本的是不是内置了大量分类但是没用上，有 emoji 图标的数据？」→ 实查确认后下令「445 条的 emoji 数据表删掉」。
- 关联：**ADR-0201（本票决策）** / ADR-0102（issue 231——本票修订其引入的映射表）/ ADR-0100 / `docs/prototype-first.md`

## 问题

`src/belongings/emoji-icon-map.ts` 带一张 445 条 `emoji → lucide 图标名` 映射表（源 10.6 KB，445 条全部进 `main.js`），是 ADR-0102 迁移期的脚手架。三项原职责已全部失效：

| 原职责 | 现状 |
|---|---|
| 载入迁移转换器（剥 emoji + 补 `icon`） | 迁移 2026-09 已全量落盘，`icon` 由字段承载；只剩「剥前缀」一半有意义 |
| 遗留 emoji 渲染兜底 | 已被 `shared.ts` 的 `catEmoji`/`catNameOf` 首字路径覆盖；只对「未迁移条目」生效，而这类条目已不存在 |
| AI 图标菜单词源 | `AI_ICON_MENU`（**118 条**）早已是冻结字面量，与映射表**无运行时依赖** |

另发现原型侧 `window.BLG_EMOJI_MAP` 447 行**全仓零消费**。

## 决策要点（详见 ADR-0201）

1. 删 `EMOJI_ICON` 整表；`splitEmojiCategory` 保留并收窄为 `{ emoji, name }`（迁移与 AI 解析共用，口径不私有）；模块改名 `emoji-icon-map.ts` → `category.ts`。
2. 载入迁移只剥前缀，**不再补 `icon`**（迁移窗口已关，补写等于凭空造图标）。
3. `shared.ts` 删 `catIconOf`；`itemIconOf` 只认 `icon` 字段。兜底链收敛为：`icon` 字段 → 分类 emoji / 首字文本。
4. 空分类仍出 `package` 图标——改由 `EMPTY_CATEGORY_ICON` 单点常量承接，**视觉不变**。
5. 原型 `BLG_EMOJI_MAP` 死段整段移除。

## 落地

- `src/belongings/category.ts`（新，单函数 + 沿革注释）
- `src/belongings/emoji-icon-map.ts`（删，-131 行 / -10.6 KB）
- `src/belongings/data.ts`：import 改指 `./category`；迁移块去掉 icon 回写分支
- `src/belongings/shared.ts`：去 `EMOJI_ICON` import 与 `splitEmojiCategory` 再导出；删 `catIconOf`；`catEmHtml` 走 `EMPTY_CATEGORY_ICON` 常量；`itemIconOf` 只认字段
- `src/belongings/ai.ts`：import 改指 `./category`；`AI_ICON_MENU` 注释修正（118 条冻结字面量，与映射表无运行时依赖）
- `src/belongings/ui.ts`：文档注释同步
- `prototypes/belongings/prototype-icons.js`：`BLG_EMOJI_MAP` 段删除（680 → 234 行）
- `prototypes/belongings/prototype-render.js` / `prototype-behavior.js`：`node scripts/build-preview.mjs belongings` 重出（`EMOJI_ICON` 归零）
- `CONTEXT.md`：归物本段与渲染纯度白名单段同步（白名单去掉 `./emoji-icon-map`）
- `tests/belongings/category.test.ts`（`emoji-icon-map.test.ts` 改名 + 重写：删映射表三例，保留拆分三例 + AI 菜单一例）
- 夹具改口径：`tests/belongings/ui.test.ts`（`makeItem` 基座改正典形状：`category: '机械键盘'` + `icon: 'keyboard'`；另四处夹具补显式 icon）、`tests/belongings/data.test.ts`（迁移断言改为「只剥前缀、不补 icon」）、`tests/belongings/render.test.ts`（兜底链断言改写，保留一条遗留 emoji 降级断言）

## 验证

- `pnpm exec tsc --noEmit` 干净
- `pnpm exec vitest run tests/belongings tests/core/render-purity.test.ts` → **16 文件 / 241 用例全绿**
- 全量门禁见提交记录

## 风险

- **未迁移的老库**：遗留 emoji 分类（无 `icon`）不再转 lucide，原样显示 emoji。用户自有库已在 2026-09 迁移落盘，无影响；对外分发场景若遇此类数据需人工补 `icon` 或从 git 历史取回映射表重跑转换。
- **不可逆**：映射表删除后无法自动补图标；git 历史仍可取回（删除提交可直接回滚）。
