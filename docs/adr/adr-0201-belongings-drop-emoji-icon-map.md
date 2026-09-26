# ADR-0201：归物本 emoji→lucide 映射表退役——分类图标只认 `icon` 字段

- 日期：2026-09-26
- 状态：已采纳（实现见 issue 477）
- 相关：ADR-0102（**本票修订**：其引入的 445 条映射表退役）/ ADR-0100 / ADR-0104（渲染单源纯度契约——该 ADR 正文里的白名单示例属**历史记录不改**；活化契约以 `CONTEXT.md` 为准，已随本票同步去掉 `./emoji-icon-map`）/ ADR-0009 / `src/belongings/category.ts` / `src/belongings/shared.ts` / `src/belongings/ai.ts`

## 背景

ADR-0102（issue 231，2026-09-07）拍板「数据 emoji 全转 lucide 图标 + 干掉 1226 条内置预设分类」，随之引入一张 445 条 `emoji → lucide 图标名` 映射表（`src/belongings/emoji-icon-map.ts`），承担三重职责：

1. **载入迁移转换器**——把老数据里的「📱 智能手机」这类 emoji 前缀分类剥成纯文字并补 `icon` 字段；
2. **遗留 emoji 渲染兜底**——条目无 `icon` 字段时，按分类首字符 emoji 查表出 lucide 占位；
3. **AI 图标菜单词源**——`AI_ICON_MENU` 注释称「从映射表全集挑选」。

用户问「归物本是不是内置了大量分类但没用上、带 emoji 图标的数据」。实查成立，且三项职责**均已失效或另有所属**：

1. **迁移已完成**——迁移在 2026-09 内随自然保存落盘（用户库 65 件、32 种 emoji 全部入表），`icon` 此后一律由字段承载；迁移路径只剩「剥前缀」这一半仍有意义；
2. **渲染兜底已被首字路径覆盖**——`shared.ts` 的 `catEmoji` / `catNameOf` 自带同一套正则，非 emoji 分类本来就回落首字文本；映射表实际只对「未迁移的遗留 emoji 分类」生效，而这类条目在迁移完成后不存在；
3. **与 AI 菜单无运行时依赖**——`AI_ICON_MENU`（118 条）早已是冻结字面量，注释里的「从映射表全集挑选」只是历史来路说明。

体量实测：源文件 10.6 KB，445 条**全部进 `main.js`**（无 tree-shaking）；原型侧另有一份 `window.BLG_EMOJI_MAP` 447 行，**全仓零消费**。

## 决策

### 1. 删除 445 条映射表，只保留 emoji 前缀拆分

`EMOJI_ICON` 整表删除。`splitEmojiCategory` 保留——迁移（`data.ts`）与 AI 返回解析（`ai.ts`）两处共用，口径不得各自私有一份正则——但返回形状由 `{ emoji, name, icon }` 收窄为 `{ emoji, name }`。模块随职责改名：`src/belongings/emoji-icon-map.ts` → `src/belongings/category.ts`。

### 2. 载入迁移只剥前缀，不再补 `icon`

`data.ts` 的载入迁移保留（内存、幂等、不写盘），删除 icon 回写分支。理由：迁移窗口已关闭，补写只会替「19 天后才第一次打开的库」凭空造一个 `icon`，而该图标未必是用户想要的——不如让它回落原形。

### 3. 分类图标只认 `icon` 字段

`shared.ts` 删除 `catIconOf`（其唯一职责即查表）；`itemIconOf` 只校验 `icon` 字段格式，不再回退「分类 emoji 查表」。渲染兜底链收敛为：**`icon` 字段 → 分类 emoji / 首字文本**。

### 4. 空分类仍出 `package` 图标（单点常量）

旧行为里「空分类 → 📦 → `package`」经映射表达成，是用户可见的既有视觉。改由 `shared.ts` 内 `EMPTY_CATEGORY_ICON = 'package'` 单点常量承接，**视觉不变**，且不引入新表。

### 5. 原型侧死段一并清除

`prototypes/belongings/prototype-icons.js` 的 `window.BLG_EMOJI_MAP`（447 行、零消费、单源已删）整段移除；`prototype-render.js` / `prototype-behavior.js` 经 `build-preview` 重出。

## 后果

- **用户可见变化 ≈ 零**：理论上「未迁移的遗留 emoji 分类（无 `icon` 字段）」不再转 lucide、改为原样显示 emoji；但 `loadDatabase` 每次载入都把 emoji 前缀剥成纯文字（`data.ts` 迁移块），**已落盘数据本就碰不到这条链**——该变化只对绕过迁移的内存项成立。空分类仍为 `package` 图标，视觉不变。
- **包体减小**：`main.js` 少约 7 KB；原型产物 `prototype-icons.js` 少 447 行。
- **AI 归类行为零变化**：`AI_ICON_MENU` 仍是 118 条冻结字面量，`AI_FALLBACK_ICON`（`package`）不变。
- **不可逆性**：删除后无法再为「未迁移的老条目」自动补图标。若日后确有此类数据回流，需人工补 `icon`，或从 git 历史取回映射表重跑一次性转换脚本。
- **测试夹具改口径**：多份测试原本依赖「emoji 分类 + 无 icon → 出 lucide」这条链，夹具统一改为 ADR-0102 迁移后的**正典形状**（分类纯文字 + `icon` 显式）；遗留形状仅在 `render.test.ts` 保留一条降级断言。
