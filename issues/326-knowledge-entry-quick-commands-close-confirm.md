# 326 · 知识盒录入：段落/图版快捷命令 + 四入口关闭二次确认 + 生成后关窗开笔记

- 状态：已交付（2026-09-15，门禁全绿后合并部署；主构建产物已提交）
- 关联：ADR-0116（来源预填）、ADR-0125（confirmDiscard 域皮通道）、issue 309/312/313（四入口与同壳三态）、
  ticket 138（名词命令选区预填先例）、issue 310（影像直达录入界面）

## 用户诉求（原话拆解）

1. 「知识盒，没有段落和图版的快捷命令」——影像、名词都有命令（bz-knowledge-note-video / bz-knowledge-note-term），
   段落与图版只能进主面板点按钮。
2. 「段落也实现和名词一样的，选中自动放输入框中，自动带当前笔记为来源」——名词命令（ticket 138 / ADR-0116）
   会把编辑器选区预填进输入框、当前笔记作来源候选；段落命令同构。
3. 「为知识盒的四个入口界面增加关闭窗口二次确认弹窗，弹窗要风格化」——四入口 = 名词 / 段落 / 图版（同壳三态）
   + 影像录入弹窗。有内容时关闭要有确认，且走 ADR-0125 的统一风格化壳（域皮）。
4. 「生成文献笔记后要关闭弹窗打开笔记」——确认写入落盘后，关掉录入面板并直接打开生成的笔记。

## 设计

### 1. 两条快捷命令（`bz-knowledge-note-passage` / `bz-knowledge-note-image`）

- `openPassageNote(app)`：与 `openTermNote` 完全同构——读当前激活 MarkdownView 选区预填段落 textarea，
  当前笔记（md）作来源候选（ADR-0116：命令入口带上下文，主窗按钮入口不带）。
  **差异点：段落不自动生成**——名词一个词，预填即生成（ticket 155）；段落是大段文字，进面板让用户
  确认内容后再手动点「生成」（Ctrl/Cmd+回车同效）。
- `openImageNote(app)`：图无预填可言，命令入口带当前笔记作来源候选（同 ADR-0116 模式）。
- main.ts 注册，命令 ID 三段式；smoke 命令清单同步。

### 2. 四入口关闭二次确认（ADR-0125 §7 confirmDiscard + 域皮）

- 名词/段落/图版（termPopup 同壳三态）：**值判定**——当前态输入非空、已有预览（termPreview）、
  生成中（termGenerating）、图版态有内存图片，任一即「脏」。来源行单独不算脏（命令入口会预填来源，
  一打开就关就弹确认是骚扰）。来源之外四条道全走 `requestTermClose()`：遮罩点击（两处合一）、ESC。
  确认文案按态给（名词/段落/图片没生成写入）。确认走 `confirmDiscard(proceed, message, 'kb bz-kb-flow-dialog')`
  ——统一壳 + 知识盒纸墨皮（issue 291 同款 className 三段）。
- 影像录入（addPopup）：**事件打标**不做数值比对——打开即自动重抓（ADR-0133）会程序化改写
  url（短链写回规范链接）/时长/区间，数值比对必假阳。改在真实用户事件点打 `addDirty` 标：
  链接输入、区间条拖拽（RangeBar.set 只重绘不回调，天然免疫程序赋值）、时间框提交、
  分P 数字框、档位下拉、「整片」重置。打开（showAddDialog）与保存成功路径复位/绕过。
  关闭道（遮罩/ESC）走 `requestAddClose()`；保存路径直关不打扰。
- 影像·处理队列面板（videoPopup）不是录入入口，无草稿可丢，不加确认。

### 3. 生成后关窗开笔记

- 名词/段落/图版：`onTermConfirm` 成功路径在 `hideTermEntry()` 后追加 `openNote(path)`
  （openNote 自带 hideMain/hideVideo，录入面板 → 文献列表 → 队列面板整条链路都收掉，正文直达笔记）。
- 影像：生成在批处理后台异步完成，批量连跑时逐个弹笔记是灾难；保持既有手动打开
  （行点击 / 「打开文献笔记」动作）。

## 测试面

- index-cov：passage 命令选区预填 + 来源、无视图空开不抛；image 命令带来源开图版态。
- ui.test：脏态关（段落有字 / 图版有图）→ confirmDiscard 被调（域皮 className 断言）、
  干净态直关不打扰；确认「放弃」后面板收起；写入成功 → 面板关 + openFile 调用（路径为生成路径）；
  影像弹窗输入过链接后关 → 确认、没输入直接关。
- flow-dialog mock 改 importOriginal 展开（ui.ts 新 import confirmDiscard，工厂缺导出会炸加载）。
