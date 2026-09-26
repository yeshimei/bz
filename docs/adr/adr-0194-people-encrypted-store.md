# ADR-0194：脸谱入保险库——聊天原文落盘但只落加密库，按联系人合并为一条保库记录

- 日期：2026-09-26
- 状态：已采纳（用户拍板：「考虑到复杂度和隐私，脸谱做成加密的，数据按照联系人合并在一起」）
- 相关：**取代 ADR-0191 §2**（「聊天原文不落盘」）/ ADR-0195/0196/0197（同批）/ `src/encrypt/data.ts`（SafeNote.kind）/ `src/password-vault/data.ts`（共锁同库先例）/ issue 456（头像入库，本票改写）

## 背景

ADR-0191 §2 当时定的是「聊天原文不落盘——导入 → 内存解析 → 提炼 → 落盘物只有人物卡」的隐私最小化口径。但 446/449 落地后实际形态已经偏离：`people-preview.json` 里存的是**归一化后的聊天文本**（含语音转写全文、图片描述全文），只是媒体标签化过。本次更进一步要求 `chat.json` 完整一份并入，**等于原始消息全量落进 vault 内**，与 ADR-0191 §2 正面冲突。

同时发现一处与加密目标直接矛盾的现状：头像落在 `CONFIG/FACES/<联系人名>/avatar.jpg`——**文件夹名就是人名**，等于一份明文联系人名单躺在库里。

保险库侧先例齐备：`src/encrypt/index.ts` 已导出 `getSafeManager()` / `ensureSafeUnlocked(kind)` / `SafeNote`；`SafeNote.kind` 是枚举 `'diary-entry' | 'password-vault'`；`password-vault/data.ts` 演示了「注入同一 SafeManager 单例 + 订阅 `encrypt:changed` / `encrypt:unlock-changed` + 上锁即清明文缓存」这套接法。

（附带修正：AGENTS.md 写的 `CONFIG/.ENCRYPT/` 路径是**过期的**，实际位置是 `CONFIG/STORAGE/.ENCRYPT/`，清单 `.safe.enc` 在其内。）

## 决策

1. **取代 ADR-0191 §2**：聊天原文**落盘**，但**只落加密库**。vault 内不存在任何明文聊天数据。
2. **存储粒度 = 每个联系人一条保库记录**（`SafeNote.kind = 'people'`）：把原 `people.json` 的一条人物卡 + 原 `people-preview.json` 的一只桶 + 该人的任务条目 + 头像附件合并成**一条记录、一个 `.enc` 文件**。改一个人只重写他那一份，不必每次解密/加密整库。
3. **索引也加密**（联系人名单 / 条数 / 更新时间）。"有哪些联系人"这层比"聊了什么"更敏感，不能明文。代价是面板打开**即要求解锁**（走 `ensureSafeUnlocked` 门禁）。
4. **头像进保库记录**（SafeAttachment，渲染时解密成 data URL）；`peopleMediaDir` 设置键与 `CONFIG/FACES/` 明文头像目录**退役**。
5. **锁复用**：与 encrypt / password-vault **共锁同库**——同一 `SafeManager` 单例、同一主密码、同一 `.safe.enc` 清单；订阅 `encrypt:unlock-changed`，上锁即清明文缓存**并暂停后台生成任务**。不新增第三把锁。
6. **加密边界（明写）**：数据根（vault 外，如 `E:\Obsidian\微信脸谱数据\export_full\`）仍是明文。加密保护的是 **vault 被同步 / 分享 / 截图 / 误传时的泄露**，不是「本机磁盘不留明文」。只做两件事：文档写清 + 设置面板一句提示；**不提供**自动清理数据根（那是不可逆操作）。
7. **工具永不接触 vault**：`@jwbz/obsidian-face` 只写数据根，**不需要也不具备任何解密能力**。工具的产物要么是明文（数据根），要么根本不进保库。

## 后果

- `checkup`（数据体检）的全域 json 只读巡检**读不到脸谱数据**了；未解锁时须跳过而不报错。
- 解锁门禁前置到「打开脸谱面板」这一步；上锁时在跑的生成任务必须暂停（不能继续在后台吐 AI 结果）。
- **存量迁移必须写**（与 ADR-0197 的 `version` 升级合并为同一次）：现有 `people.json`（3 人）+ `people-preview.json`（3 人）拆成每人一条保库记录。目标格式与源格式完全不同，没有就地升级路径。
- people 域新增对 encrypt 域的运行时依赖（先例：password-vault → encrypt）。方向安全——`encrypt/data` 不回引 people，无环。
- 多设备经 Obsidian Sync 同步加密文件时，另一台机器需同主密码；这是共锁同库的既有行为，不额外处理。
