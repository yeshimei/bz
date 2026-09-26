# 412 · review-411 修复批

来源：`review-411.md`（issue 411 双轴 review）Standards 轴 4 条判断题 + 1 处注释失准，用户拍板全部修复。

## 改动

1. **抽共享 select 决策三件套**（去重 Duplicated Code）：`core/settings-schema.ts` 导出
   `selectOptionsOf` / `selectOptionsSignature` / `selectDisplayValue`，core 渲染器（addDropdown
   路径）与 settings-panel 渲染器（自绘 .bz-select 路径）改用同一实现——DOM 形态各自保留，
   选项求值 / 换表判定 / 显示值回落只有一份。
2. **删死字段**（去 Speculative Generality）：`AIProviderDescriptor.noCors / extraHeaders` 删除
   （三条在册通道均不需要）；`prompt` 与 `ai-models` 的 noCors 直连分支删除（fetch 失败 →
   requestUrl 兜底路径不变）；`AIProvider.extraHeaders` 保留（对象 override 可带）。
3. **命名与类型**：`AIThinkingLevel.body` 收窄 `Record<string, any>` → `Record<string, unknown>`；
   renderer 内 `optSig` → `optionsSig`、`curNow` → `currentValue`（与 core 渲染器同名概念）。
4. **注释失准修正**：`ai.ts` zhipu-plan 档位表注释改为与实现一致——仅发 `reasoning_effort`
   （thinking.type 服务端默认 enabled，不发）；发 disabled 是**直接报错**不是静默无效
   （官方迁移提示，docs.bigmodel.cn / docs.z.ai，2026-09-23 核对）。

## 不修的

- review-411 提过的「Data Clumps：refreshKey 与函数型 options 结伴」——收益有限，不动。
- ai-cov 两处 `expect(p.noCors).toBeUndefined()` 断言随字段删除一并移除（字段不存在后断言恒真无意义）。

## 门禁

tsc --noEmit 0 错；定向 6 文件 154 例全绿后跑全量（vitest 全量 + 原型产物重出）。
