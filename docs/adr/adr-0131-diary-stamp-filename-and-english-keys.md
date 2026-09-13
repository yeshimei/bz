# ADR-0131：日记题目改数字简写 + frontmatter 键英文化（契约 v3）

- 状态：已采纳（2026-09-13）
- 涉及域：diary（主）/ smartcat / recap / home / encrypt / core（path-classify）
- 关联：issue 305 / ADR-0130（本 ADR 修订其第 1、2、3 条）/ ADR-0030 / ADR-0002

## 背景

ADR-0130 定条目题目为 `YYYY-MM-DD HH-MM(-N)?.md`——用 `-` 连接时分，是因为 Windows 文件名禁英文 `:`。用户随后提出：题目里的时间应当用英文冒号分隔（`2026-06-13 12:23`）。

实测（本机 E: 盘 exFAT，NTFS 同理）：

| 题目形态 | 结果 |
|---|---|
| `colon-test 12:23.md` | **写入失败 ENOENT**（`:` 是驱动器保留符，兼作 NTFS ADS 分隔符） |
| `colon-test 12-23.md` | 成功 |
| `fullwidth 12：23.md` | 成功（全角 `：` U+FF1A 不是保留符） |

即「英文冒号题目」在本平台**不可能**；全角冒号可行但不合用户「英文冒号」的原意。用户随即拍板改用**数字简写**：`2026-06-13 12:23` → `2606131223`（`YYMMDDHHmm`）。同时要求 frontmatter 两个属性名英文化（`日期`→`date`、`类型`→`type`）。

## 决策

1. **题目（条目文件名）= `YYMMDDHHmm(-N)?.md`**
   - 例：`我的/日记/2606131223.md`；同刻多条沿用 `-2`/`-3` 后缀让位。
   - 选它的两个硬理由：全数字全平台合法；**字典序 = 时间序**（文件管理器/Obsidian 排序即时间线，不依赖解析）。
   - 代价：题目可读性下降——由属性值与界面展示补偿（见第 3 条）。
2. **frontmatter 恰两属性，键英文化**：`date: YYYY-MM-DD HH:mm`（英文冒号保留）+ `type:`（多值标签名列表）。
   **不做旧中文键兼容**：只认 `date`/`type`；旧键文件按「属性不可信」处理——运行时走题目降级，体检报 `unparsable`。
3. **可读形式只出现在两处**：属性值（`date: 2026-06-13 12:23`）与界面展示（日记墙卡片、时间标签、通知文案）。题目与可读形式的**互译只发生在 `src/core/diary-format.ts`**。
4. **降级单源 `resolveDiaryEntryMeta(path, parsed)`**：属性可信则用属性，否则从题目还原日期+时间（题目自带完整时间戳，降级零信息损失）；两处都不可信才判 null。
   ADR-0130 只要求 diary 域降级，本 ADR 把它推到全部消费方（smartcat 观察/记忆链、recap、加密还原），口径全域一致。
5. **契约 helper 收编**：`diaryEntryBaseName`/`diaryEntryPath`/`diaryMetaFromEntryPath`/`diaryDateFromEntryPath`/`resolveDiaryEntryMeta`/`diaryStampText`/`parseDiaryStamp`/`readDiaryFrontmatterFieldRaw`/`DIARY_LEGACY_FILE_RE`/`DIARY_DATE_KEY`/`DIARY_TYPE_KEY`。
   消费方一律经 helper，**不再自拆正则、不再自拼时间戳**（review 里「格式知识泄漏」的整改落点）。
6. **体检 `name-mismatch` 比较完整时间戳**：题目承载日期+时刻，任一不一致即双轨冲突，需人工裁决。
7. **迁移工具**：
   - `scripts/diary-split.mjs`（旧「一天一文件」→ v3 条目）——新库一次性迁移；
   - `scripts/diary-restamp.mjs`（v2 条目 → v3 题目 + 键英文化 + 记忆引用改指）——已按 ADR-0130 迁移过的库补跑。
   两者都 dry-run 默认、Obsidian 关闭拦截、幂等可重跑。

## 后果

- 题目变成纯数字，肉眼辨认时间要靠属性值或界面；换来的是全平台合法 + 排序即时间序 + 降级零损失（题目本身就是完整时间戳的编码）。
- 库内 md 反向链接为零（实测全库无 `[[YYYY-MM-DD HH-MM]]` 形式引用），换名不产生断链；唯一外部引用是 `CONFIG/STORAGE/smartcat-memory.json`，由迁移脚本同步改指（`ref.path` + `description`，locator 原样保留）。
- 契约 v3 是**破坏性**变更：旧插件构建读不懂新题目，反之亦然——迁移与插件部署必须同批（先关 Obsidian → 迁移 → 部署 → 重开）。
