# ticket 092 —— 方向二：洞察版本化（086 v4）

状态：**READY-FOR-AGENT**
父文档：086-intelligence-evolution-proposal.md v4「方向二」（裁决：值得做，机制补全）
基线：master 6419c06
日期：2026-08-24

## 现状缺陷

反思洞察（insight 条目）一旦入流永不失效：习惯变了、结论过时，
检索时旧洞察与新观察平权竞争；无「被推翻」语义。dashboard 有固定/废弃入口（v3 已吸收）但数据层无版本机制支撑。

## 设计（v4 裁决逐条落地）

1. **supersede 语义改排序前剔除或 ×0.1 乘法惩罚**（二选一实现，注明选择）：
   废弃洞察不得进 GA 加法分空间（αRel=1.5 下线性减项盖不住）。
   推荐：retrieve/formatMemoriesForPrompt 前置 filter（剔除最简单且最稳）
2. **主题键 = 稳定复合键**：受限枚举 `工作|兴趣|关系|健康|环境`（LLM 打标时从中选，
   解析失败回退 lexical 关键词映射）；杜绝自由措辞导致同主题多键
   —— insight 条目新增可选字段 `theme?: string`（旧数据容忍零迁移）
3. **候选既有洞察通道**（reflect 时给 LLM 参照防重复结论）：
   主题索引 + Top-N 相似 insight（N 对齐 evidenceTop 窗口量级），独立 token 预算
   （候选只注入 id+description 前 N 字，不全文）；失败裁剪为空列表不整轮失败
4. **supersede 写点**：reflect 的 LLM 输出允许 `{supersede: <insightId>}`（最多 1 个/批次）；
   校验 id 存在且 type=insight 才生效；被废弃者写 `supersededBy?: string`（可选字段）
5. **环形引用检测**：A supersededBy B 且 B supersededBy A → 后写的拒绝（简单 visited 集）
6. **DDID 短格式**：dashboard/展示层洞察 id 显示为短数字索引（现有 id 太长），仅展示层
7. **Dashboard「固定/废弃」人工修正保留**：人工 pin（pinned?: boolean）后不被自动 supersede
8. **H4 继承**：新增 LLM prompt 一律 USER_CONTENT_BOUNDARY；失败裁剪独立退避
9. **兼容冻结**：smartcat.json 既有字段不动；全部新增为可选字段

## 测试要求

- 废弃洞察检索前被剔除（或 ×0.1 后排序垫底）——两条路径按所选方案断言
- 主题键枚举校验 + 回退；supersede 幂等/环形拒绝/pinned 保护
- 候选通道 token 预算截断 + 失败回退空
- 既有 memory.test 48+ 用例全量保留

## 工程规约

同 091 号票「工程规约」节（exFAT 写盘/git safe.directory/Conventional Commits 中文/
.scratch add -f/flake 判定协议/maxWorkers=4 门禁）。