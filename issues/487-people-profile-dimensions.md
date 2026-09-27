# 487 人物档案扩维度 + 画谱时 AI 按证据自动回填

## 背景

用户反馈：人物档案的「背景补充」维度太少（现 7 项：社交账号 / 生日 / 认识方式 / 认识时间 /
家乡现居 / 职业 / 标签 / 备注），要求加入更多维度，并且**画谱时让 AI 根据素材情况自动填写**
（现有的「AI 补充」按钮是手动触发的 455 实现，只覆盖旧 7 项）。

## 方案

### 维度扩展（types.ts PersonProfile）

新增 10 个可选维度（全部可空，向后兼容）：
`personality`（性格特点，一段话）、`interests[]`（兴趣爱好）、`habits`（作息 / 生活习惯）、
`recentLife`（近况）、`nickname`（称呼偏好）、`quote`（口头禅 / 代表句）、`likes[]`（喜欢：
话题 / 送礼参考）、`dislikes[]`（反感 / 雷点）、`relationships[]`（提到的身边人：
`{who, relation}`）、`importantDates[]`（重要日子：`{date, what}`）。

### UI（render.ts / ui.ts）

- `profileEditor` / `profileView` 增新字段：自由文本 6 项走 `data-people-prof-field` 输入行；
  三个数组（interests / likes / dislikes）按顿号 / 逗号切分的文本输入；两个结构维度复用
  socials 行模式（`relationships` 行 = who + relation；`importantDates` 行 = date + what）。
- `saveProfile` 解析新字段（数组切分去重去空；结构行过滤半行）。
- `buildProfileNote`（digest.ts）覆盖新维度——档案继续作为背景进两卷 prompt。

### AI 自动回填（jobs.ts / digest.ts / ui.ts）

- digest.ts 新增纯函数三件套：`buildProfileExtractPrompt(name, mat, known)`（JSON 契约 =
  全部维度；只许填素材能支撑的，无证据给空；已有手填值在 prompt 里声明「不要覆盖」）、
  `parseProfileReply(text)`（剥围栏 / 宽松 JSON / 逐字段防御归一）、
  `fillProfile(existing, ai)`（**只填空字段**：undefined / 空串 / 空数组才收 AI 值，手填绝不覆盖）。
- jobs.ts：chronicle 段内、时间线之后追加档案提炼（`asks.portrait`，stage 仍报 chronicle，
  message 注明「正在提炼人物档案…」）；`merged` 四类素材全空则整段跳过；任何失败不阻断，
  `job.aiProfile`（PersonJob 新可选字段）拿不到就留空。
- ui.ts `persistJobDone`：`job.aiProfile` 存在时 `entry.profile = fillProfile(existing?.profile, job.aiProfile)`
  再 upsert——画谱完成档案即自动补全，手填字段原样保留。

### 语义铁则

1. AI 只填空白，手填值绝不覆盖（重新画谱也不会冲掉用户改过的字段）。
2. 无证据留空，绝不编造（prompt 硬性要求 + 解析侧防御归一）。
3. 档案提炼失败不阻断画谱主流程（与关系时间线同级的次要产物）。
4. 隐私口径不变：只喂已落盘的提炼素材（事件 / 原话 / 场景 / 特质 / 统计），不送聊天原文。

## 测试

- digest：buildProfileNote 新维度、buildProfileExtractPrompt 契约、parseProfileReply 容错、
  fillProfile 只填空语义。
- jobs：素材齐时档案提炼被调用且 job.aiProfile 落值；AI 失败任务仍 done。
- render / ui：编辑器新字段渲染、saveProfile 解析、persistJobDone 合并回填（手填不覆盖）。
