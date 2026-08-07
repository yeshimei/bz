# 日记本插件（diary-notebook）

由 QuickAdd 宏脚本「日记本」（`CONFIG/SCRIPTS/Quickadd/日记本.js`，4146 行）独立化而来的 Obsidian 插件。**UI 与逻辑与原脚本保持一致**，数据格式零迁移（继续读写 `我的/日记/YYYY-MM-DD.md` 的 `# emoji HH:mm` 格式）。

## 功能

- 浮层主面板：标签筛选（主/二级标签、emoji 编码、计数）、日期筛选、搜索、无限滚动、sticky 日期
- 写日记：滚轮日期时间选择器 / 自然语言时间（`昨天 23:00`、`1分钟前`）/ 手动输入
- 写摘抄：选中文本 → 块引用双链 → 保存（`Alt+A` 打开写日记弹窗的热键保持有效）
- 聚合显示 `我的/影视`、`我的/信` 的条目
- 双击卡片跳转文件对应标题、长按复制双链引用、内联编辑、删除确认
- 加密条目（🔐）隐藏但写入不丢失；文件外部修改自动刷新

## 安装

1. 构建（或使用已构建产物）：`npm install && npm run build` —— 产物自动输出到 vault 的 `.obsidian/plugins/diary-notebook/`
2. Obsidian 设置 → 第三方插件 → 启用「日记本」

## 开发

```bash
npm install        # 首次
npm run dev        # 监听重建（产物直出 vault）
npm run build      # 一次性构建
npm test           # vitest 全量测试（纯函数层 + UI 层 jsdom）
npx tsc --noEmit   # 类型检查
```

## 架构（为迁移其他 QuickAdd 脚本预留）

```
src/
├── core/               ← 共享层（未来所有"本"复用）
│   ├── esc-manager.ts  ← ESC 层级管理器（自 Q3.js 移植）
│   ├── confirm.ts      ← 确认弹窗（自 Q3.js 移植）
│   └── utils.ts        ← escapeHtml / generateBlockId / sleep
├── diary/              ← 日记本功能域（每迁移一个脚本新增一个域）
│   ├── config.ts       ← 目录常量 / 标签配置 / emoji 映射
│   ├── types.ts        ← DiaryEntry 等类型
│   ├── state.ts        ← 全局状态 + diaryDataMap
│   ├── parser.ts       ← 日记/影视/信解析 + 自然语言时间（纯函数）
│   ├── store.ts        ← 加载/写回/增删/刷新监听（无 DOM，回调解耦）
│   ├── app.ts          ← Obsidian App 注入（测试可替换 mock）
│   └── ui/             ← panel / entries / dialogs / datetime-picker / quote / filter-shared
├── settings.ts         ← 11 项设置（与原宏一致）+ 设置页
└── main.ts             ← 插件装配 / 生命周期 / 卸载清理
```

**依赖方向**：`core ← config/state ← parser ← store ← ui ← main`；store 层无 DOM 依赖（UI 刷新通过回调注册解耦）。ui 内部模块间存在少量函数级引用环（如 entries ↔ filter-shared 的 applyFilter/refreshSubTagsBar），均为函数体内延迟引用、无模块初始化期求值，tsc/esbuild/vitest 均验证通过。

**迁移下一个脚本**（如收藏本）：
1. `src/favorites/` 目录放该域的逻辑（config/types/parser/store/ui）
2. 复用 `src/core/` 的 escManager/confirm/utils
3. `main.ts` 装配新域；`src/settings.ts` 增加该域设置
4. 命令 id 保持原脚本的 id（用户热键绑定不失效）

## 与原脚本的关键差异（有意为之）

| 项 | 原 QuickAdd | 插件版 |
|---|---|---|
| 依赖 | `window.__utils`（Q3 挂载）、QuickAdd 环境 | 独立模块（core/） |
| CSS | 运行时注入 `<style>` | 独立 `styles.css` |
| 空库显示 | 空白面板 | 空态文案「没有找到日记内容」 |
| 卸载 | 无（常驻） | DOM/监听/命令全清理 |

## 测试

- `src/diary/*.test.ts`：解析层/配置层纯函数单测
- `src/diary/ui/panel.test.ts`：UI 层 jsdom 测试（面板 DOM、标签筛选、弹窗、滚轮选择器、删除确认）
- `src/test/`：obsidian mock（alias 替换）、内存 vault mock
