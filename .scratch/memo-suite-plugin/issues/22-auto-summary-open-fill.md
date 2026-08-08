# 22 — 自动摘要：create/open 双触发 + 逐字段补全 + 通知

**What to build:** 自动摘要从「仅 create 监听 + 一次性生成 summary」改为「文件创建或打开（workspace file-open）都会执行」；对 frontmatter 逐字段检测缺失（title/summary/tags 缺什么补什么），缺哪个字段 AI 就只生成哪个字段；处理完成后通知显示《title》+ summary + #tags。

**用户需求原文（2026-08 反馈）**：自动摘要，当文件创建或打开时都会执行，如果不存在简介就获取简介，没有标签就获取标签，没有题目就获取题目。通知显示：

```
《title》

summary

#tags
```

**Blocked by:** 10

**Status:** ready-for-agent

**用户决策（2026-08 问答确认）**：① 触发范围保持只监听剪藏目录（articleDirectory，不扩全 vault）；② author 不纳入补全（AI 不再生成 author，已有 author 字段保留不动）；③ 缺多个字段时一次 AI 请求返回全部缺失字段；④ 仅补全成功后才通知；⑤ AI 失败每次打开都重试（无冷却）；⑥ 空数组/空串视为缺失；**缺 title 时 AI 生成标题并替换笔记标题（重命名文件）**

- [ ] `src/auto-summary/processor.ts`：`aiProcess(ai, bodyText, missing)` 提示词 JSON 模板按 missing 字段裁剪（字段规则文案逐字保留：标题 15-30 字禁标点/摘要 150-250 字禁「本文」等前缀/3-6 个中文标签≤5 字；**不含 author**；tags 规则块仅 missing 含 tags 时输出；正文截断 6000 不变；missing 为空返回 null 不调 AI）
- [ ] `processFile`：缺失检测 = 无 title / 无 summary / tags 非数组或空数组（空串/空数组视为缺失）→ missing 非空才请求 AI；写回只写缺失字段（不覆盖已有）；字段齐全直接 return（不 modify、不通知）
- [ ] 通知：调用 AI 前 `notice('正在为《xx》生成摘要…', 3000)`（xx 用已有 title 或文件名）；成功后 `notice()`（core/dom，smartCat 优先）显示 `《title》` + 空行 + summary + 空行 + `#tag1 #tag2`（缺哪段不显示哪段），时长 8s
- [ ] 缺 title：AI 生成 title → 重命名笔记文件（清理非法字符 `\\/:*?"<>|`、截断 80 字、防重名 `(1)(2)…`；rename 失败回退仅写 frontmatter）→ frontmatter 也写 title 保持一致
- [ ] `src/auto-summary/index.ts`：`ensureAutoSummary` 在延迟注册里增加 `workspace.on('file-open')`（传 null 关闭时跳过；目录前缀边界判断与 create 一致）；create/open 共用 1500ms 延迟 + pending Set 去重（同一文件延迟窗口内只排一次）
- [ ] `unloadAutoSummary`：offref 清理 workspace 监听 + pending 清空
- [ ] 测试：aiProcess missing 裁剪（缺 title 不含 summary 定义、缺 tags 无 tags 规则块）；processFile 缺什么补什么/字段齐全跳过/通知格式；index file-open 触发/目录外 open 不处理/create+open 去重（modify 一次）/卸载清理
- [ ] MockVault 补 `rename`（files Map key 迁移 + modifiedPaths 记录）
- [ ] spec.md 同步（自动摘要需求、事件监听、事件清单表、frontmatter 说明、提示词结构、事件触发缝）；PROGRESS.md 更新
