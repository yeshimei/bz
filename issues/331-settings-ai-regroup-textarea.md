# 331 · 设置面板 AI 页重新分组 + Cookie 行换多行文本框

- 状态：已实现（2026-09-16，单 worktree 开发 → 门禁全绿 → 合并部署；编号 330 与并行会话
  「AI 思考设置与候选相似度下限」撞号，改挂 331/ADR-0147）
- 关联：ADR-0133（「AI 与凭据」组收编，本票拆组取代其单组形态）/ issue 186（AI 独立成域）/
  ticket 172（per-provider 三行）/ issue 330（思考档位行，合并时归入「模型配置」组）

## 用户原话拆解

1. 「把设置面板当中 AI 的重新分组」→ AI 页单组 11 行过长且混杂，按语义拆多组；
2. 「有些地方应该用文本框，而不是输入框」→ 长文本行（Cookie）由单行 input 换 textarea。

## 设计

### 分组（键与行为零变化，仅陈列重排）

| 组 | 图标 | 行 | 说明 |
|---|---|---|---|
| 服务商 | plug-zap | AI 服务商下拉 + 各注册表提供商密钥行 + custom 端点/密钥 | visibleWhen 随 aiProvider 行级门控不变 |
| 模型配置 | cpu | 模型名称 + 上下文窗口 + 最大输出 token + 思考 reasoning | refreshKey 随服务商切换联动——联动链是全 schema 级，跨组不受影响；思考档位（issue 330）合并时归入本组 |
| 数据源凭据 | key-round | B站 Cookie + ApiZero Key + 豆瓣 Cookie | 非 AI 的第三方数据源凭据独立成卡（ADR-0133 收编成果保留，仅不再与 AI 混组） |

### 控件（textarea 行）

- **B站 Cookie / 豆瓣 Cookie → `type: 'textarea'`**：Cookie 串动辄上千字符，多行文本框便于
  粘贴与检查；补 placeholder「粘贴从浏览器复制的 Cookie」。ApiZero Key 短令牌、各家 API 密钥
  单行可容纳，保持 input。
- **TextAreaRow 补 `actions` 字段**（core/settings-schema.ts + settings-panel/renderer.ts 两渲染器
  同口径，按钮渲染于多行文本左侧同 2026-09-08 拍板）：否则 B站行的「从 CLI 导入」按钮会随换
  控件消失（功能回归）。防抖 800ms + 失焦落盘语义不变（textarea 无回车提交，原口径）。

### mock 同步

- tests/mock-obsidian-entry.ts `addTextArea` 原复用 MockText 产出 `<input>`，新增 MockTextArea
  产出真 `<textarea>`（复刻真实 TextAreaComponent，铁律 6 精神）。

## 文档同步

- spec.md 追加 issue 331 节；CONTEXT.md「清晰度档位」「凭据」词条组名改「数据源凭据」；
  settings.ts / cinema/settings.ts 注释同步。ADR-0133 与 spec 历史拍板链保留原文（历史记录）。
