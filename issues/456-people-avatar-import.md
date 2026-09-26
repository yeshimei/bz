# 456 脸谱头像入库：库内媒体文件夹 + 外部头像复制进库

## 背景

455 评审轮给三处（折子封面 / 详情头 / 数据源行）加上了头像，把数据目录里
`avatar.<ext>` 的**绝对路径**直接交给 `localResourceUri` → `app://local/<去盘符路径>`。
实际效果是**三处全裂图**（截图：大琳详情头一枚碎图标 + alt 名）。

根因两点，叠加致命：

1. 新版 Obsidian 的 `app://local/` 已不解库外文件（安全收紧），库外绝对路径这条路本身就废；
2. 该函数还把盘符剥了（`E:/x` → `/x`），即便协议还能用，路径也是错的。

用户的判断与结论一致：**头像必须进库**——库内文件走 vault `getResourcePath`
产出的 `app://<vault-id>/...` 一定加载得出来。

## 改动一：库内媒体文件夹（settings.ts / people/settings.ts）

- 新设置键 `peopleMediaDir`，默认 `CONFIG/FACES`（vault 相对路径；空 = 用默认值）；
- 设置面板新增「媒体」组：文本行「媒体文件夹」+ 说明行「头像入库，其余媒体不入库」；
- 「隐私」组原「原始媒体不入库」说明补一句头像例外——图片 / 语音 / 视频仍留库外。

## 改动二：头像入库（datasource.ts）

- `peopleMediaDir()`：读设置，归一斜杠、去首尾斜杠，空回落 `CONFIG/FACES`；
- `mediaDirName(name)`：联系人名 → 安全目录名（`\ / : * ? " < > |` 与首尾点空格压 `_`）；
- `importAvatarToVault(app, name, externalPath)`：外部 `avatar.<ext>` 复制进
  `<媒体文件夹>/<联系人>/avatar.<ext>`，返回 vault 相对路径；外部文件已删 → 回落库内副本；
  两头都无 → `null`。逐段 `mkdir` 建目录，`readFileSync` → ArrayBuffer → `adapter.writeBinary`；
  入库失败退回原外部路径（语义不变，不炸导入）；
- `isVaultRelativePath(p)`：无盘符、无根斜杠 = 库内路径（迁移判定用）；
- 头像扩展名探测序抽成 `AVA_EXTS`（数据目录与库内同序）。

## 改动三：渲染（render.ts）

`localResourceUri` 三级：

1. 评审壳 `BZW_MEDIA_BASE` 有值 → 服务路由（壳能读库外）；
2. **库内相对路径 → `app.vault.adapter.getResourcePath`**（本次主路径）；
3. 库外绝对路径 → `app://local/` 兜底（保留旧行为，不再依赖）。

## 改动四：接线（ui.ts）

- 扫描（`runScan`）→ 行内头像走入库，数据源列表的行首头像不再裂；
- 导入（`importDsSelected`）→ 入库后写桶；外部文件删了导入即清（`delete contact.avatar`）；
- `previewData()` 读桶后跑 `migrateAvatars()`：**存量桶里 455 落盘的库外绝对路径**
  读到即复制入库并回写预览桶（幂等，已是库内路径直接跳过）——用户不必重导。

## 验收

- tsc 无错；people 域 267 测试通过（`generate-ui.test.ts` 的 1 条 unhandled rejection 为改动前既有，
  已 stash 对照确认）；
- 真实 vault 实测：插件加载后 `CONFIG/FACES/` 建出全部联系人目录，`people-preview.json`
  的 `avatar` 已变为 `CONFIG/FACES/大琳/avatar.jpg` 形态。

## 遗留

- 「纪事 · 按月」下面的日期左对齐：代码里月组头（`bz-people-ev-mon-head`）与事件日期
  （`bz-people-event-ts`）都是左对齐，未找到居中来源，待截图定位。
