# Ticket 161：小橘设置面板滑杆改输入框

## 需求

设置弹窗下滑时滑杆偶尔误触，把小橘 ⚙️ 面板中全部数字滑杆改为输入框。

## 改动面

- `src/smartcat/ui.ts`：17 处 `slider` 行改 `number` 行（core/settings-schema 既有行类型，min/max 钳制 + step 保留，文案与绑定不变）；DEFAULT_BEHAVIOR 注释口径更新。

## 测试

- 无测试引用小橘 slider 行；settings-schema number 行为已有既有用例覆盖（钳制/落盘语义）。

## 状态

- [x] spec 更新
- [x] 实现
- [x] tsc + 相关测试（smartcat ui/settings + settings-schema-ui）
- [x] 构建验证
