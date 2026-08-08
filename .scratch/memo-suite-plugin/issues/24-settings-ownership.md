# 21 — 设置归属模型落地（ADR-0009）：全局设置页 + 域设置弹窗

**What to build:** 按 ADR-0009 重构设置体系——设置页单页化（AI + 共享数据路径），10 个域面板右上角 ⚙️ 域设置弹窗（归物本/收藏本空弹窗），影视/书库筛选弹窗改挂 🔀，共享 storagePath 迁移，AI Agent 设置不暴露。

**Status:** ready-for-agent

## 改动清单

- [ ] `src/settings.ts`：新增 `storagePath`（默认 `CONFIG/STORAGE`）；7 个 JSON 路径字段（todoFilePath/belongingsDataFolder/pwStoragePath/favoritesStoragePath/reviewStoragePath/META_PATH/VEC_PATH）注释标 deprecated
- [ ] `src/main.ts`：首次加载迁移（旧 7 字段全同 → seed storagePath；参差 → 默认 + Notice 列出被忽略路径）；`BzSettingTab` 重写为单页两区块（🤖 AI：服务商/两个 key；📂 数据存储路径：storagePath），删除 12 tab 与全部 buildXxxTab
- [ ] `src/core/settings-modal.ts`（新）：通用设置弹窗工具（标题 + build 回调 + esc 关闭 + 空态），各域复用
- [ ] 数据路径读取点统一 `storagePath`：bz/data、belongings/data、password/index、favorites/app、review/data、quiz/manager、ai-agent/index、flash（META/VEC）
- [ ] 域设置弹窗（⚙️ 按钮 + 内容）：备忘录（autoPopupOnStart）、日记本（6 项）、归物本（空）、剪藏本（3 项）、密码本（3 项）、收藏本（空）、书库（7 项）、影视（2 项 + 海报提示）、复习计划（2 项 + 做题家 5 项）、闪念（17 项）
- [ ] 筛选弹窗换图标：影视「筛选与排序」⚙️→🔀、书库「视图与筛选」⚙️→🔀
- [ ] 入口页：编辑模式列数控件按平台读写（桌面 launcherColumns / 移动 launcherMobileColumns），不新增设置
- [ ] 测试：settings-tab.test.ts 重写（单页 + 迁移）；各域 ⚙️ 弹窗测试（打开/交互/保存）；smoke 核对

## 验收

- [ ] 设置页只显示 AI 与数据存储路径两区块，无 tab
- [ ] 10 域面板 ⚙️ 可开对应设置弹窗并生效（归物本/收藏本为空弹窗）
- [ ] 影视/书库筛选弹窗由 🔀 打开，⚙️ 打开的是真设置
- [ ] 老 data.json（含自定义 pwStoragePath 等）升级：迁移 Notice 正确、storagePath 初始化正确、旧字段仍在文件中
- [ ] 全量测试通过（npm test），tsc --noEmit 通过
