# Ticket 170 — AI 提供商策略模式 + 影视 10 分制（备忘录闭环）

> 本票由两条 memo 备忘合并执行：`ai` 域「策略模式加入常见 AI 提供商（含 commandcode）」+ `影视` 域「6 分制改 10 分制、星星支持半星、一次性迁移全部影视笔记」。

## Part A — AI 策略模式注册表

### 背景

`src/core/ai.ts` 的 `getAIProvider` 是 if-else 硬编码两提供商（deepseek / opencode-go），新增提供商需改解析函数 + 设置 schema + settings 三处；无模型 / 上下文 / max token 配置 UI（max_tokens 各调用点硬编码）。

### 实现

- `src/core/ai.ts` 新增 `AI_PROVIDER_REGISTRY` 注册表（`AIProviderDescriptor`：id/label/endpoint/model/defaultMaxTokens/defaultContextWindow/apiKeyKey/noCors）——deepseek、opencode-go、**custom** 三行；`getProviderDescriptor` 查表（未知名回退 custom）；`getAIProvider` 改查表解析，deepseek 保留 QuickAdd data.json 兜底，opencode-go 行为零变化。
- **custom（OpenAI 兼容）**：endpoint / model / apiKey 全部用户自填，可覆盖任意 OpenAI 兼容提供商（含 commandcode 等新服务，无需改码）；缺 endpoint 或 key 抛「未配置自定义 AI 服务」。
- 设置 `src/settings.ts` 新增 `aiCustomEndpoint` / `aiCustomModel` / `aiCustomApiKey` / `aiMaxTokens`（默认 0 = API 默认）。
- 主设置页 `settings-main-schema.ts`：AI 服务商下拉扩三项（注册表驱动）；custom 显示自定义三行；新增「最大输出 token」number 行；OpenCode 密钥显隐由「非 deepseek」收窄为「opencode-go」。
- `AIService.prompt` max_tokens 优先级：显式 modelOptions > 设置 `aiMaxTokens`（>0）> 4096。
- `favorites/ai.ts` `isAvailable` 支持 custom（endpoint+key 齐全）。

## Part B — 影视评分 6 分制 → 10 分制 + 半星

### 背景

6 分制散落多处：滑块/编辑输入两套控件（1~6 与 0.1~5）、`DEFAULT_RATING=3.5`、`movie-report` 的 `R6to10` 换算与六评分桶、recommend prompt 文案「1~5 加权」；星星渲染 `getStarRating` 只整星无半星。vault 670 部影视笔记 frontmatter `评分` 均为 6 分制（589 部有分，最大 5.9）。

### 实现

- `src/movie/constants.ts`：`RATING_MAX=10`、`DEFAULT_RATING=5`、`STAR_FULL/STAR_HALF`；`getStarRating` 10 分制 → 5 星刻度（`rating/2`），0.25~0.75 区间出半星（⯪）。
- `src/movie/ui.ts`：添加/评分窗滑块 1~10（默认 5）、编辑弹窗数字输入 0.1~10。
- `src/movie-report/analysis.ts`：删除 `R6to10` 换算（个人与豆瓣同为 10 分制直接可比）；评分桶改十桶 `≥9/8~9/7~8/6~7/5~6/<5`；宝藏 ≥9 且豆瓣<8、失望 ≤4 且豆瓣≥8.5；文案「评分趋势（个人10分制）」「平均评分（10分制）」（平均分不再 ×换算）；双榜展示原分无换算；页脚改为「同为 10 分制可直接对比」。
- `src/movie/recommend.ts`：prompt 文案「1~5 加权」→「1~10 加权」。
- **数据迁移** `.scratch/migrate-movie-rating.py`：`new = round(old × 10/6, 1)`；-1/0/空/缺省/已 >6 不动；干跑 559 部换算、30 部跳过。**Obsidian 关闭后执行**（插件内存态 30s tick 会覆盖磁盘改动）。

## 测试

- `tests/core/ai-cov.test.ts`：custom 解析（endpoint 尾斜杠清理/model/key）、custom 缺 endpoint/key 报错、`aiMaxTokens` 生效与 0 回落 4096。
- `tests/core/ai.test.ts`：错误文案断言更新（deepseek 缺 key + QuickAdd 兜底失败 → 「未配置 DeepSeek API Key」；custom 缺配置 → 「未配置自定义 AI 服务」）。
- `tests/settings-tab.test.ts`：custom 切换显隐（自定义三行）、max token 行存在。
- `tests/core/settings-schema.test.ts` / `settings-copy-lint.test.ts`：AI 区块行列表补自定义三行 + max token。
- `tests/movie/ui.test.ts`：滑块 1~10 默认 5、编辑输入 0.1~10、写盘默认 5。
- `tests/movie-report/analysis-cov.test.ts`：getStarRating 半星（9→4.5 星半星、8.5→半星、8.4→4 星）、十桶全命中、宝藏/失望新阈值；富库评分换算 10 分制。
- `tests/movie-report/analysis.test.ts`：桶 5~6、失望榜新语义。

## 门禁

tsc 0 错；全量 222 文件 3581 用例绿；构建部署通过。vault 数据迁移脚本待 Obsidian 关闭后执行（完成后回填本票）。
