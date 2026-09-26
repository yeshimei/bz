# 446 — 脸谱数据源设置面板：预处理导出目录直连（原始→预览→脸谱两段增量）

消费微信全模态预处理管线（skill wechat-media-preprocess）产出的按联系人分类数据文件夹
`<数据根>/<联系人>/chat.json` + 可选 `voice.json` / `image_desc.json` / `voice/` `thumb/`：
people 域新增声明式设置组（数据源 / 预览 / 生成 / 隐私），脸谱面板顶部出现「数据源」区，
勾选联系人扫描导入。**两段增量**：原始→预览（按 sid/哈希替代键去重，落
`CONFIG/STORAGE/people-preview.json` 纯文本）；预览→脸谱（441 增量管线不动）。

## 改动

1. **设置键**（src/settings.ts）9 键：peopleDataDir（''）/ peopleScanOnOpen（true）/
   peopleIncludeGroups（false）/ peoplePreviewVoice（true）/ peopleImageDescMode（'file'）/
   peoplePreviewVideo（true）/ peopleKeepSystem（true）/ peopleGenTrigger（'manual'）/
   peopleGenThreshold（0）。
2. **域 schema**（src/people/settings.ts 新建）：四组声明式；接入 settings-panel/ui.ts
   （loader + DOMAINS「记录」组 + NAV_SECS）。AI 视觉档只留设置位与提示行（实际调用后续票）。
3. **数据层**（src/people/datasource.ts 新建）：
   - 纯函数：msgKey（sid>0 → `s<sid>:<ct>`，否则 ct+msg 哈希）、normalizeChatJson
     （4.x 原始码归一：1 文本 / 3 图片 / 34 语音 / 43 视频 / 47 表情 / 49 appmsg / 50 通话 /
     10000 系统；媒体按开关合成为 type:1 文本形态，与 445 导出契约一致；image_desc 按 img
     字段精确对上、img 缺失走同月 ct 最近邻 ±12h 兜底）、mergePreview（按 key 增量只补新消息）、
     isGroupChat（非「我」who 多样性）、shouldGenerate（trigger/threshold 触发判定）。
   - IO：window.require('fs') 读 vault 外数据目录（仅桌面端）；PreviewStore 读写
     people-preview.json（jsonFileStore + enqueueFileTask，PeopleStore 同款）。
4. **面板 UI**（src/people/ui.ts + styles.css）：list 视图顶部「数据源」区——联系人勾选列表
   （名字 / 消息数 / 媒体徽章 / 已导入水位行）+「扫描」「导入所选」按钮 + 导入反馈行
   （manual 模式的手动「画脸谱」入口）；打开面板自动扫描（peopleScanOnOpen）；导入后按
   peopleGenTrigger / peopleGenThreshold 自动跑生成（441 planIncremental 机制不动）。
5. **测试**（tests/people/datasource.test.ts 新建 + smoke 同步 + 契约锁基准表）：
   增量矩阵（首导 / 重导部分新增 / 完全重复 / sid 与哈希替代键 / 群聊开关 / 系统消息开关 /
   语音无转写回退 / image_desc 命中与缺失）、预览落盘结构与清空、生成触发三态。
   夹具全部构造数据，不含真实聊天内容。

## 决策记录（实现口径）

- **sid 精度**：chat.json 的 sid 是 16~19 位整数，超 Number.MAX_SAFE_INTEGER——JSON.parse
  后尾数有损。替代键取 `s<sid>:<ct>`（同环境幂等；sid 截断碰撞需同秒同尾段，概率可忽略），
  有效 sid（≠0）都用作键（预处理线全部消息带 server_id，非任务书假设的「仅语音有 sid」，
  兼容两种形态）；sid=0/缺失回退 ct+msg 哈希。
- **image_desc 匹配**：契约口径（skill wechat-media-preprocess）= 条目 `{file, ct, desc}`、
  file 与 chat.json 的 img 字段同格式 `<月>/<文件名>`。img 有值 → 按 file 精确匹配（权威；
  miss 即 miss，不落最近邻乱配）；img 缺失（image_ct_map 未回写）→ 同月 ct 最近邻 ±12h 兜底
  （预处理线上下文管线同款阈值），一张描述只配一条消息防批量错位；都失手 → `[图片]` 空标签。
  实测当前 export_full 尚无 image_desc.json、img 字段也未全量回写——链路先就位，数据就绪即生效。
- **voice.json 兜底**：chat.json 语音已按 sid 回填转写（主流路径原样保留）；msg 仅 `[语音 N秒]`
  时查 voice.json（wav 双键：全路径 + 尾段文件名）回填 `[语音 N秒·情感] 文本`；emotion 英文标签
  （NEUTRAL/HAPPY/ANGRY/SAD）转中文（预处理线标准化），未知标签原样。
- **生成触发**：`shouldGenerate(newCount) = newCount>0 && (trigger==='auto' ? (threshold===0 ||
  newCount>=threshold) : (threshold>0 && newCount>=threshold))`——无新素材一律不画（不空跑）；
  auto=导入即画（threshold 作门槛），manual 下 threshold 达标也自动；默认 manual+0 =
  从不自动（手动入口在导入反馈行）。
- **隐私**：预览桶只存标签化文本（语音转写 / 图片描述 / 系统消息原文），落 vault 内
  CONFIG/STORAGE/people-preview.json；原始媒体（图 / 音 / 视频文件）不复制不解析，
  留在外部数据目录。
