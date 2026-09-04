# issue 193：死代码与残留全面清扫（用户拍板「全做」，2026-09-05）

## 范围（两代理全库盘点后用户拍板全做）

### ① 纯死物
- 死设置键：`showFileName`、`passwordMobileDefaultFullscreen`（全仓 0 读）
- 死导出 18 处：runSprint、generateBlockId、unregisterAlwaysOnTop、ensureClipbook、loadPanelData、NEWS_PLATFORMS、clipbook/store 七函数（isBiliVideo/unreadTotal/inboxCount/clipCount/savedCount/runAction/applyRetentionTo）、getSubfolder、_resetBookNotesUi、DEFAULT_TAGS、tagKeyOf、RECAP_TAG、REVIEW_FIT_FILE_PATH、saveQueue
- bili-downloader 幽灵域三处：AGENTS.md 领域行、settings-panel 隐藏行、DOMAIN_ICONS 键（bili-tasks.json 已无任何读写点）
- CONTEXT.md 去重：记忆流旧版（缺 ticket 092 字段）、记忆目录重复份、RL 校准配方粘连段
- git 跟踪调试残留：test-bundle.js / test-out.txt / test-out2.txt
- 注释修正：core/styles.css 旧 z 档位家族注释、AGENTS.md 命令数（40→44）、checks-consistency 头部 memo 措辞
- export 降级 15 处（去 export 保留本体）：settings-schema 11 行类型、RELOAD_SETTINGS_NOTICE、MobileFullscreenRowOptions、STORAGE_PATH_COMMIT_NOTICE（后因测试消费恢复导出）、samplingGroup

### ② 死代码迁移链整链删（用户部署实例 storagePath 已迁移，永不触发）
- main.ts：migrateStoragePath 方法 + onload 触发块 + migrateSecondBrainSettings 接线
- settings.ts：旧 5 路径键（todoFilePath/belongingsDataFolder/pwStoragePath/favoritesStoragePath/reviewStoragePath）+ SECOND_BRAIN_RENAMED_KEYS（16 闪念旧键映射）+ migrateSecondBrainSettings
- 各域兜底读取链收口为纯 storagePath：todo/data、todo/file-sync、belongings/data、favorites/app、favorites/file-sync、checkup/files、home/snapshot settingDir、review/data、review/quiz-core/manager
- 测试：settings-tab storagePath 迁移 describe、main-lifecycle P2 describe、secondbrain/settings-migrate.test.ts 全文件、smoke flashEnabled 断言删除

### ③ 摆设设置行（界面在显示、运行时零效果）
- 待办「完成后自动归档」（memoAutoArchive）、剪藏「每批加载数量」（articleBatchSize）、第二大脑「嵌入并发」（secondBrainConcurrency + config.CONCURRENCY 死字段）——三键三行删除

### ④ 根目录与 .scratch
- review-cinema-moviereport-home.md 直删（对象 movie-report 已退役）
- review-all-domains-bugs/ux.md 归档 docs/archive/（ADR-0090/0091 证据链）
- .scratch 六个已完结 spec 目录退 git 跟踪（bili-downloader-clip/literature/ux、clipping-link-to-url、diary-notebook-plugin、gesture-uniform）

## 明确保留
- 7 个 memo* 共享键、quiz-core（活引擎）、smartcat bili 存量兼容层、tools/ 三目录、memoAutoArchive 等中保留的 secondBrainConcurrency 例外已随摆设行批删除（注释自述「保留兼容」被用户「全做」覆盖）
- memoAutoArchive 删除后「完成后自动归档」行为在待办不存在（实现与否另票）

## 验收
- 主仓 tsc 干净 + vitest 全绿（用例数 4064，净减 11 个迁移/死导出用例）
- settings.ts 全部 10 键 + 2 迁移块 grep 清零
