# 388 · 首页入口菜单统一设置直达

> labels: feature ｜ map: — ｜ status: done ｜ assignee: — ｜ blocked-by: —
> 上游：issue 267（DOMAIN_MENU 域快捷菜单）／ADR-0153（设置面板为设置权威入口）
> 实现于 `wt/bz-home-menu-settings`

## 背景

首页各域入口的右键/长按菜单（`home/shared.ts::DOMAIN_MENU`）只放域自己的快捷动作，
进设置面板只能走入口列表末位的「设置」磁贴（点击不带定位，落在上次浏览的域）——
想改某个域的设置得开面板后再自己找。grill-with-docs 四轮拍板：每域菜单末尾统一加
一条「设置」，直达该域设置页。

## 决策（用户拍板口径）

1. **统一追加**：14 个有菜单的域，菜单末尾（域动作之后）统一一条「设置」；
   平铺追加、无分隔线（`core/item-actions` 共享组件零改动）。
2. **直达定位**：点击先关首页再开设置面板并定位到该域设置页
   （`openSettingsPanel(app, 域id)`；域 id 映射仅 `vault→password-vault` 一处异名，
   余 13 域同名直通；执行侧函数级动态 import，同 memo/gameshelf/review 惯例）。
   非 keepHome——同「打开别域面板」惯例，避免两层面板叠着。
3. **不挂边界**：settings/attach 维持不挂浮层（settings 入口点开本就是设置面板）。
4. **实现单源**：`DOMAIN_MENU` 导出处统一包一层追加（不手写 14 遍）；
   `DomainMenuAction` 增可选 `settingsDeep?: string` 槽位（= settings-panel 域 id），
   commandId 恒 `bz-settings-panel-open`（类型不动，原型壳/兜底可直跑命令）。
5. 文案「设置」（菜单盒头已有域名）；图标 settings 入口同款 lucide 名（单源不新增，
   prototype-icons 表不动）。

## 测试

- `tests/home/entry-menu.test.ts`：每域菜单末尾恰一条「设置」（label 无「打开」前缀）、
  `settingsDeep` 映射正确（vault→password-vault，其余=本域 id）、settings/attach 仍不在
  DOMAIN_MENU（不挂浮层边界不变）。
- 原型：shared.ts 单源 + 行为单源真 ui.ts 依赖链，自动生效；原型产物 build-preview 随批重出。

## 遗留

- 无。
