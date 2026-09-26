# 305 日记题目改数字简写 + frontmatter 键英文化（契约 v3）

- 状态：进行中（2026-09-13 立项）
- 关联：ADR-0131（本 issue 的决策记录）/ ADR-0130（被修订）/ issue 304（前一版迁移）

## 背景

issue 304 把日记迁成「一目一文件」，题目 `YYYY-MM-DD HH-MM(-N).md`（时分用 `-` 是 Windows 禁 `:` 的妥协）。用户要求题目时间用英文冒号；实测 exFAT/NTFS 对 `12:23.md` 直接 ENOENT（`:` 为保留符，兼作 ADS 分隔符），全角 `：` 可行但不符「英文冒号」本意。用户拍板：题目改用数字简写 `YYMMDDHHmm`（`2026-06-13 12:23` → `2606131223`），并把 frontmatter 属性名英文化。

## 交付

- [x] 契约 v3（`src/core/diary-format.ts`）：题目正则/命名/解析、`date`+`type` 键、降级单源 `resolveDiaryEntryMeta`、时间戳 helper（`diaryStampText`/`parseDiaryStamp`）、`readDiaryFrontmatterFieldRaw`、`DIARY_LEGACY_FILE_RE`
- [x] 消费方全部改走 helper（不再自拆正则）：diary（parser/data/store/repair/encrypt/ui-locator）、smartcat（diary-source/index/note-memory/dashboard）、recap（aggregate/summarize）、home/river、encrypt/data、core/path-classify
- [x] 降级铺到全域：smartcat 观察链路、记忆链（种子/解析器/存活判定）、recap 一律「属性优先、题目兜底」
- [x] 体检口径：`name-mismatch` 比较完整时间戳；legacy 判定走契约正则
- [x] 迁移脚本：`scripts/diary-restamp.mjs`（v2 条目 → v3 题目 + 键英文化 + 记忆引用改指）；`scripts/diary-split.mjs` 改为直接产出 v3
- [x] 测试适配 + 新增（题目/键/降级/时间戳 helper 的用例）
- [x] 文档：ADR-0131、CONTEXT 词条、spec 交付记录
- [ ] 数据迁移实跑（本库）：关 Obsidian → `diary-restamp --apply` → 验证（1241 换名 / 键改写 / 记忆 1241 条改指）
- [ ] 插件构建部署（契约破坏性变更：迁移与部署同批）

## 顺带整改（ADR-0131 决策 5；原 review 遗留）

- 格式知识单源：消费方 `DIARY_ENTRY_FILE_RE` 拆组、范围 `日期:` 键常量、时间戳拼串全部收编契约 helper
- 死代码/过期面清理：`store` 零消费者兼容导出（`isValidDiaryDate/Time`、`isEncryptedEntry`）删除、`findDiaryEntry` 去 `lineNumber` 死参、`writeRecapEntry` 去 `app` 死参、`diary/ui/locator.ts` 行号分支退役（谓词简化 = filePath+time）、`diary/ui.ts` 两处 `${date}.md` 死兜底、`types.ts` lineNumber 注释、`styles.css` 两条死 CSS

## 验收

- `pnpm test` 全绿（含新增 v3 用例）、`pnpm tsc --noEmit` 0 错、原型产物重出对齐指纹
- 本库迁移后：`我的/日记/` 1241 个 `YYMMDDHHmm` 条目、0 个 v2 残留；`归档/日记/` 522 个原文件不动；`smartcat-memory.json` 1241 条日记引用指向新题目、`ref.locator` 保留；体检面板 0 项（或仅剩预期的 legacy/其他）
- 重开 Obsidian：日记墙 1241 条、时间显示仍为 `YYYY-MM-DD HH:mm`、小橘记忆面板可读、首页连击正常
