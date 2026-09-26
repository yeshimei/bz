# ADR-0180：数据源凭据三行统一单行掩码（textarea 的 masked 档位退役）

- 日期：2026-09-23
- 状态：已采纳（用户拍板；**取代 ADR-0147 决策 2「Cookie 行换 textarea」**——该决策的多行形态即本次退役对象）
- 相关：issue 413（本批）/ issue 331（拆组与 textarea 化，ADR-0147 落地批）/ ADR-0133（凭据收编）/ c7c16ec39（输入方式体检批，多行掩码档位引入）

## 背景

ADR-0147 决策 2 按「Cookie 串动辄上千字符，便于粘贴检查」把 B站 Cookie / 豆瓣 Cookie 改成
textarea；c7c16ec39（输入方式体检）又给 textarea 加了 `masked` 档位（`-webkit-text-security`
打点 + 眼睛切明文），凭据组一度是「Key 单行掩码 + 两个 Cookie 多行掩码」的混合形态。

用户 2026-09-23 看过实际界面后报「文本输入框加密感觉太奇怪了，加密的都改成单行的输入框」，
并附截图指出组内行序（原 B站 Cookie → ApiZero Key → 豆瓣 Cookie）要调。两条合起来 = 加密控件
一律单行、Key 在前。

## 决策

1. **凭据组三行统一 `type:'secret'`**（单行 password 框 + 眼睛切明文）：ApiZero Key /
   B站 Cookie / 豆瓣 Cookie。行序改为 **ApiZero Key → B站 Cookie → 豆瓣 Cookie**；键、desc、
   placeholder 逐字不变，desktop 端 B站行的「从 CLI 导入」`actions` 原样保留（secret 行 actions
   与 text 行同内核）。**取代 ADR-0147 决策 2** 的 Cookie textarea 形态（决策 1/3/4 不受影响——
   三卡分组、TextAreaRow.actions 能力、mock 忠实化仍然成立）。
2. **多行掩码档位整体退役**（无生产行消费，留作死代码即噪音）：
   `TextAreaRow.masked` 字段、core 弹窗渲染器的 masked 分支、`wireSecretEye` 的 class 模式
   （只余翻 `input.type`）、`settings-panel/renderer.ts` 的 `makeMaskedArea`、
   `settings-panel/shared.ts` 的 `maskedAreaHtml`、`core/ui/components.css` 的
   `.bz-maskarea / .bz-maskarea--revealed`、`settings-panel/styles.css` 的 `.bz-sp-secret--area`。
   `textarea`（普通多行文本）与 `secret`（单行掩码）两个档位本身不变——knowledge / memo
   等域的普通多行文本行不受影响。
3. **长串凭据的粘贴面损失接受**：单行输入框虽不如 textarea 便于目视核对整串，但「打点掩码下
   看不出内容、多行框只贡献高度」的实感更差；核对明文仍可经眼睛切换（单行横向滚动）。

### 被否的备选

- **保留 Cookie 的 textarea 只去掉打点**（明文多行）：与体检批「凭据一律掩码」相悖，
  且用户原话是「加密的都改成单行」。
- **masked 档位留着备用**：无生产行引用后成纯死代码，测试只能靠合成 schema 兜着；
  要用再加（档位实现已在 git 历史，issue 331 批）。

## 后果

- 凭据组视觉统一：三行同高同宽，眼睛行为一致；组内不再有「多行加密框」的异类。
- 升级无迁移：键与落盘行为零变化，存量 Cookie 串照常读入单行框。
- 若未来真出现「必须多行粘贴的长凭据」，按 ADR-0147 决策 3 的 actions 口径加回即可——
  需要的是「明文多行」或新档位，别再复活 `-webkit-text-security` 路线（本次已证伪其手感）。
