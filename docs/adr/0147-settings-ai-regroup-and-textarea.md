# ADR-0147 设置面板 AI 页三卡分组与 Cookie 多行文本框

- 状态：**决策 2 已被 ADR-0180（2026-09-23）取代**——Cookie 行 textarea 形态随「加密一律单行」拍板退役为 secret 单行掩码；决策 1/3/4（三卡分组 / TextAreaRow.actions / mock 忠实化）仍现行。其余部分保持已接受（2026-09-16，用户拍板；编号 0146 与并行会话撞号，改挂 0147）
- 关联：issue 331 / ADR-0133（「AI 与凭据」收编，本决策拆解其单组形态）/ issue 186（AI 独立成域）/ ADR-0180（取代决策 2）/ issue 413
- 影响：`src/core/settings-main-schema.ts`（组结构 + Cookie 行控件）、`src/core/settings-schema.ts`（TextAreaRow.actions）、`src/settings-panel/renderer.ts`（textarea 行内按钮）、相关测试

## 背景

ADR-0133 把 B站 Cookie、影院 ApiZero Key / 豆瓣 Cookie 收编进 AI 组并改名「AI 与凭据」，单组
膨胀到 11 行：服务商选择、五家密钥、custom 两行、模型三行、凭据三行同卡平铺，语义分层（接入 /
模型 / 第三方凭据）不可见。用户拍板重新分组，并指出长文本行应使用多行文本框。

## 决策

1. **AI 页拆三组**：「服务商」（下拉+密钥+custom，visibleWhen 行级门控随行走）/「模型配置」
   （模型名称+上下文+最大输出 token；issue 330 的「思考 reasoning」档位行合并时归入本组）/
   「数据源凭据」（B站 Cookie+ApiZero Key+豆瓣 Cookie）。
   设置键、绑定、显隐条件零变化；refreshKey 联动链本就是全 schema 级，模型三行跨组随服务商
   切换刷新不受影响。⚙️ 原生设置页与设置面板共用本 schema，两侧同时生效。
2. **Cookie 行换 textarea**：B站 Cookie / 豆瓣 Cookie 动辄上千字符，`type: 'text'` →
   `type: 'textarea'`；ApiZero Key 与各家 API 密钥单行可容纳，保持输入框。防抖落盘与失焦提交
   语义沿用 textarea 行既有口径（无回车提交）。
3. **TextAreaRow 补 actions 行内按钮**：与 text/number 行同口径（按钮在多行文本左侧），否则
   B站行「从 CLI 导入」按钮会随换控件消失。面板自绘渲染器 mountTextActions 参数泛化到
   textarea，行为（onClick 回填显示值）逐字对齐。
4. **mock 忠实化**：测试 mock `addTextArea` 由复用 MockText（`<input>`）改为 MockTextArea
   （真 `<textarea>`），渲染断言可依赖元素标签。

### 被否的备选

- 只拆两组（AI 服务 vs 凭据）：模型三行与密钥行分属不同心智（选哪家 vs 用哪个模型），三卡更清晰；
- API 密钥行一并换 textarea：密钥为单行短串，单行输入框即可，多行反而占版面；
- 「从 CLI 导入」按钮挪成独立按钮行：单组一行两控件（多行文本 + 行内按钮）已是既定行型口径，
  拆行徒增行数。

## 后果

- 原生设置页分组卡由三变五（服务商/模型配置/数据源凭据/数据存储路径/通知），文案 lint（行级）
  不受影响；组名不入 lint 范围。
- CONTEXT.md「凭据」词条改指「数据源凭据」组；ADR-0133 历史记录保留原文。
