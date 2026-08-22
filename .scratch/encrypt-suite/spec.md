# 加密保险箱域规格（bz 插件新域 encrypt）

> spec 驱动：本文件是加密保险箱域（encrypt）唯一事实源，实现 ticket 以本文为准。
> 前置：grilling/domain-modeling 会话逐轮敲定，用户拍板全部分支。

## 一、概述与定位

新增 bz 域「加密保险箱」（src/encrypt/），提供**移出式清单容器加密**：

- 把用户选中的整篇 MD 笔记及其双链引用的图片/视频附件**移出 vault**，正文与附件本体都以密文形式落盘到设置根目录（加密清单 + 附件密文镜像），原路径文件消失——Obsidian 内"直接不见"。
- 解锁分两段：**清单解锁**（输入主密码，解密加密清单，列出加密笔记）；**快速预览**（压缩预览层，缩略图/抽帧，看得清但体积小）；**真还原**（解出原文 + 原质量图片/视频，写回原路径，笔记与附件在 vault 复活）。
- **加锁** = 把已还原的明文重新入保险箱，vault 再次恢复"不可见"。

复用 `src/password/crypto.ts` 的 `CryptoService`（PBKDF2 100k + AES-GCM-256，salt16+iv12+ct 布局，Base64），及密码本「主密码只存内存、解密成功即校验、无落盘校验值」范式。

## 二、机密面与威胁模型

- 威胁模型：防同机旁观者 + 防直接读文件（磁盘密文）。文件恢复快照等 Obsidian 内部缓存**明确不处理**（文档写明残余通道）。
- 机密面：正文 100% 密文化；附件本体密文化；加密清单本身是密文（内部字段含原路径，故清单不可见时路径也不可见）。

## 三、数据落地（用户拍板，ADR-0016 平铺点前缀布局，取代旧 附件/<原路径> 布局）

- 新增设置项 `encryptRoot`：加密清单与密文镜像的根目录，可配置（默认 `CONFIG/.ENCRYPT`——**点前缀目录，Obsidian 侧栏不可见**；可改库外绝对路径，改库外时隐藏语义失效）。
- **加密清单**：`<encryptRoot>/.safe.enc`——整库唯一清单（点前缀，侧栏隐藏），AES-GCM 加密。
- **密文镜像平铺**：正文、附件原始层、附件预览层一律 `.随机名.enc` 直接放 `<encryptRoot>/` 平铺（无子目录、无层级、文件名与路径信息零关联）；还原/删除全靠清单 `path` + `contentRef`/`blobRef`/`previewRef` 映射。
- **点前缀隐藏**：镜像文件与清单一律点前缀命名 → Obsidian 对点前缀路径一律忽略（不显示在侧栏、不索引、不可点），杜绝误点误删；**加密根目录内文件走 `vault.adapter`**（直读磁盘，点前缀可读写），还原写回原路径才走 `vault.create`（使 Obsidian 重新索引）。
- **旧布局不兼容（ADR-0016 不可逆取舍）**：旧 `safe.enc` + `<encryptRoot>/附件/<原路径>` 布局不再读取，旧加密数据还原能力放弃，旧文件留盘不被识别。

## 四、域主密码与密钥体系（Q4 = 主密码代理，共用密码本主密码）

- 复用密码本域主密码：**加密保险箱与密码本共用主密码**（用户在密码本首设/解锁，两域皆开）。主密码只存内存。
- **本期实现（简化，与密码本 passwords.enc 同模型）**：每个 blob（清单/正文/附件原层/附件预览层）直接用主密码经 `CryptoService.encrypt`（各自随机 salt+iv，PBKDF2 100k + AES-GCM-256）独立加密。与密码本域行为一致、无额外密钥原语、完全可测。
  - 派生成本：解锁清单 1 次 PBKDF2；打开预览按需解 summary/预览 blob 各 1 次；真还原按附件数各 1 次——典型规模可接受。
  - 代价：换主密码需全量重加密（与密码本一致，本期无改密命令）。
- **未来优化（不在本期）**：主密钥 MK + 逐条文件密钥 FK + MK 包裹 wrappedKey——换密只重裹不重加密正文。本期不引入。

## 五、清单数据模型（Safe Manifest）

清单明文结构（整体加密进 safe.enc）：

```jsonc
{
  "version": 1,
  "salt": "<base64 16B 清单级盐>",
  "wrappedKeys": {
    "<noteId>": "<base64 主密钥包裹的文件密钥>"
  },
  "notes": [ /* SafeNote[] */ ]
}
```

**SafeNote**（清单里的一条加密笔记）：

```jsonc
{
  "id": "note-...",
  "path": "我的/日记/2025-06-01.md",   // 原路径（解密后可见，用于还原）
  "title": "2025-06-01",                // 列表展示标题
  "restored": false,                    // 状态：false=已入库(明文不在vault) / true=已还原(明文在vault待收)
  "createdAt": "ISO",
  "contentBlob": "<base64 正文密文>",   // 用 FK 加密的笔记原文
  "summary": "<base64 摘要密文(小文本)>",// 预览窗免费能力
  "preview": "<base64 预览层密文>",      // 预览窗用（可含压缩图/抽帧图，若有）
  "attachments": [
    {
      "path": "我的/影视/x.png",
      "kind": "image" | "video",
      "blob": "<base64 原质量密文 blob 引用或内嵌>",
      "previewBlob": "<base64 压缩/抽帧预览密文>",
      "restored": false
    }
  ]
}
```

> blob 存储：大文件（尤其视频）**不直接 Base64 内嵌进 JSON**（会膨胀），而是镜像为独立 `.随机名.enc` 文件平铺放 `<encryptRoot>/`，清单记镜像相对路径 + 文件大小 + 指纹。本期实现：**附件一律独立镜像文件 + 正文独立镜像文件**（正文不内嵌清单；`contentRef` 指向镜像，`content` 字段留空兼容旧数据）。

## 六、加锁/还原生命周期（Q19：临时取阅 + 状态字段）

- 语义：真还原 = "借出来用"，明文驻留 vault；加锁 = 重新入库。清单带状态字段（restored），防崩溃后不知道哪些明文流落在外。
- 崩溃契约（Q15）：
  1. 清单是唯一事实源；每篇 restored 标记。
  2. 真还原 = 幂等写回（重跑不重不漏），每完成一个文件 `metadataCache.trigger('changed')`，让 diary/movie/library 等立即恢复。
  3. 加锁 = **先写密文 blob + 增量更新清单，全部成功后才删 vault 原文件**；中途崩重跑收敛。
  4. 还原目标路径被用户占用（还原期间用户建了同名文件）→ 覆盖前校验清单指纹（记录原文件哈希），内容对得上才覆盖，对不上跳过并提示冲突 N 个，绝不盲盖用户新文件。
- 启动恢复：若 securityMode 开启且存在 restored=true 未收笔记 → 面板红点提示"N 篇已还原未入库，一键收走"；securityMode 关闭则仅提示不自动收。

## 七、压缩预览/抽帧（Q17 + 用户拍板 Q17-2）

- **图片预览**：canvas 缩放到设置目标长边（默认 960px，可配）+ 压缩（JPEG/WebP）；预览层密文存储；预览窗清晰可看。
- **视频预览**：**抽帧**（用户拍板）——用 `<video>` 抽首帧/关键帧画到 canvas 出缩略图，零外部依赖；预览窗里视频位置显示清晰抽帧图；真播放靠真还原后在 Obsidian 内正常播原质量。
- 生成时机：**加锁/入保险箱时**即时生成预览层（图片缩、视频抽帧），预览层与自己一起加密入库。
- 设置项：开关 `encryptPreviewEnabled`（默认开）、目标分辨率 `encryptPreviewSize`（默认 960）、质量 `encryptPreviewQuality`。
- 预览窗另外展示笔记正文摘要（summary，免费小文本，不做预览层）。

## 八、UI 面

### 主面板（备忘录样式，bz 自绘模态）
- 打开：`bz-encrypt-open`。未解锁 → 解锁/首设弹窗（复用密码本 showPasswordDialog 范式：首设二次确认 + 警告，已有文件单输入校验）。
- 解锁后：主面板（备忘录样式）标题"加密保险箱"，顶部按钮：⚙️ 设置、❌ 关闭（无锁定/眼睛按钮）。
- 列表：按 createdAt 倒序列出加密笔记卡片（标题 + 相对时间 + 附件数，无状态徽标）；**手势触发（同其他面板）**：单击卡片 → 打开预览窗；长按卡片 → 弹「是否还原？」确认弹窗，点确认开始还原（进度通知内显示完成），成功后跳转笔记并关闭面板。
- 还原=取出即删：成功后删除该篇全部密文镜像并从清单移除；有冲突（同名文件被占用）则条目保留在保险箱并提示。
- 锁定态可见面：解锁后即可见列表（路径/标题作为元数据，用户 Q12-B 接受；主密码不解锁时面板显示"未解锁"态，双击任意处弹解锁）。

### 预览窗（独立弹窗）（用户拍板：点列表某一篇弹出独立窗口）
- 内容：Markdown 渲染正文（摘要或全文都能——预览层里如果只有压缩图，正文用解密后的 contentBlob 渲染纯查看；预览窗只读不写 vault）+ 图片/视频预览（压缩图 / 抽帧图）。
- 纯查看；不写 vault（与真还原分离）。

### 设置弹窗（⚙️，openSettingsModal 范式）
- encryptRoot（根目录）、预览开关、预览尺寸、预览质量、安全模式（securityMode 复用密码本那个，还是加密域独立？→ 本期**加密域独立** `encryptSecurityMode`，语义：关闭面板自动加锁）。

## 九、命令（main.ts COMMANDS 裸注册，三段式 bz-encrypt-*）

| id | name | 动作 |
|---|---|---|
| bz-encrypt-open | 加密保险箱 | 打开主面板（未解锁先弹解锁） |
| bz-encrypt-lock | 加密当前笔记（入保险箱） | 把当前打开的笔记 + 其双链附件移入保险箱（**执行前弹二次确认**，点确认才开始加密+进度通知） |

> 真还原按篇在面板内操作（不含独立 unlock 命令，避免与 open 重复）；还原=取出即删（成功后跳转笔记、关闭面板），无「收回/加锁收回」命令（lock-all 已删除）。

## 十、懒加载（ADR-0003）

- `ensureEncrypt` 幂等初始化；事件常驻：无（纯命令/面板驱动）。启动恢复（已还原未入库提示）在 onLayoutReady 经 `ensureEncryptOnReady` 检查（仅 securityMode 开启时自动收）。

## 十一、设置项新增（settings.ts + DEFAULT_SETTINGS）

```
encryptRoot: string          // 'CONFIG/.ENCRYPT'（点前缀目录，Obsidian 侧栏隐藏）
encryptPreviewEnabled: boolean  // true
encryptPreviewSize: string   // '960'
encryptPreviewQuality: string   // '0.7'
encryptSecurityMode: boolean // false
```

## 十二、依赖与复用

- import `CryptoService` from `../password/crypto`（复用，不复制）。
- import 密码本域主密码？→ 主密码共享但**不跨模块持状态**：加密域在解锁时调用密码本域 DataManager 的 unlock 校验，成功后把主密码缓存在加密域自身内存。若密码本未初始化，加密域自行走 unlock 校验（同一 safe 主密码）。本期简化：加密域**独立持有主密码状态**，与密码本共用同一个密码字符串（首设时在加密域首设；若密码本也已设置，输入同一密码解锁两边都开）。为最小耦合，加密域不读写 passwords.enc，只在用户主密码上独立派生清单 salt。
- UI 复用：core/notice、core/confirm、core/dom(createIconBtn/createOverlay)、core/settings-modal、core/esc-manager、core/settings-provider、core/utils(formatRelativeTime/escapeHtml)、obsidian Setting。
- Markdown 渲染：预览窗用 `app.workspace.getActiveViewOfType(MarkdownView)` 的 `markdownPostProcessor`/渲染？简化：预览窗内用 `MarkdownRenderer.render(app, md, el, sourcePath, component)`（obsidian 提供）。

## 十三、测试（tests/encrypt/）

- `data.test.ts`（@vitest-environment node，真实 crypto.subtle + MockVault）：清单加密往返、SafeNote 加锁/还原状态机、崩溃幂等（指纹冲突跳过）、平铺点前缀镜像路径、指纹校验、取出即删清理。
- `ui.test.ts`（jsdom + MockVault）：解锁弹窗（首设/解锁）、主面板列表渲染、单击开预览、长按还原确认、加密二次确认、预展窗打开、安全模式自动上锁。
- smoke.test.ts：EXPECTED_COMMAND_IDS 含 bz-encrypt-open/lock。

## 十四、架构与铁律对质

- 依赖方向（ADR-0002）：core ← 本域 data ← 本域 ui ← main；encrypt/data 无 DOM；import 方向不违反。
- 数据格式稳定（铁律1）：**不写任何既有域数据文件**；不碰 `我的/*` 之外；被加密笔记从 vault 移出是加密语义本身（用户显式选择），不动其他未加密笔记与各域 json。
- 命令裸注册（铁律2）：bz-encrypt-* 三段式，main.ts COMMANDS 表注册一次。
- DOM id/类名稳定（铁律3）：新增 `bz-encrypt-*` 前缀（encrypt-mask/encrypt-popup/encrypt-list/encrypt-preview-*）。
- 懒加载（铁律5）、样式按域拆分（铁律9，ticket 70：样式写 `src/encrypt/styles.css`，.bz-encrypt-* 类）。
- 通知写法（铁律8）：消息正文不带 emoji，查 ICONS 表用既有类型。