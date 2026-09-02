# bz 共享样式组件清单（视觉统一基线）

> 目标：把重复的按钮/按钮组/chip/图标钮范式抽到 core 共享层，存量域（保险库/影院/回忆墙/设置面板）收编替换，**未来所有 bz 域只准用共享组件，禁止再写独立按钮基线**。
> 状态：待拍板。证据行号以 2026-09-02 master（a949c47）为准。

## 一、现状与病根

### core 现有共享件（src/core/styles.css）
| 共享件 | 位置 | 形态 | 备注 |
|---|---|---|---|
| 头行组播 `.bz-win-head button` 等 | 43-140 | 22×26/14px 图标钮，hover secondary | **白名单只收 7 旧域**，4 新域全不在 |
| `.bz-icon-btn`（--close） | 527-549 | 22×26/圆角 4，hover secondary | createIconBtn 产物 |
| confirm 按钮对（ok/cancel） | 436-502 | 居中、flex:1 平分、主=accent | 组件私有 |
| `.bz-path-picker-btn/-chip` | 925-999 | 次钮/主钮（hover .88）/胶囊 chip+✕ | 挂在 path-picker 名下，实际是隐含范式 |
| `.bz-overlay-*` / `.bz-win-mfs` / `.bz-item-menu` / `.bz-item-sheet` | 505-804 | 弹窗骨架/全屏/右键/抽屉 | settings-panel 是 4 新域中唯一用了 mfs 的 |

### core 缺失（各域被迫自写的）
- 通用**主/次/danger 三态按钮**类（全仓唯一 `.bz-button` 在旧 diary 域，非共享）
- 通用**按钮组行容器**（confirm-actions / path-picker-foot-btns 均组件私有）
- 通用 **chip + ✕**（.bz-path-picker-chip 带前缀，未被通用化）
- 图标钮**尺寸档位**（触控 30-34px / 微型 18-24px）

### 病根三条
1. **白名单滞后**：core 共享靠「列举已知域类名」+ `!important`，新域类名不在名单 = 规则不命中 → 每个域必须自带一份 → 永远重复。diary-wall 头行与 core `.bz-win-head` 逐值一致，只是没入名单。
2. **全局按钮基线特异性**：`button:not(.clickable-icon) { color/background/box-shadow: unset }`（core/styles.css:14-18，特异性 0,1,1）压过**单类**按钮规则（如 `.bz-cinema-btn` 0,1,0）。pwv/diary-wall 靠双类前缀（.bz-password-vault xxx，0,2,0）才压得住——共享组件若做成单类，必须先解决这条。
3. **主题隔离**：cinema 自绘 `--bz-cinema-*` 不套 Obsidian 变量；pwv 品牌金改写 accent 语义。共享组件颜色必须走 var()，允许域根覆盖。

## 二、共享组件清单（建议落 src/core/components.css，构建 SOURCES 插在 core/styles.css 后）

| # | 组件 | 类名 | 规格基准 | 收编替换的重复实例 |
|---|---|---|---|---|
| C1 | 按钮组行 | `.bz-btn-row`（--end 右对齐 / --grow 子项均分） | flex gap 10；默认右对齐 | pwv `.btns` ×2（1563/1626）、cinema `.bz-cinema-dm-actions`/`-form-actions`/`-qs-btns`（183/209/226）、settings `.bz-sp-set-ctrl`（224）、core `.confirm-actions` 可并入 |
| C2 | 三态按钮 | `.bz-btn` / `--primary` / `--danger` / `--sm` | 次=surface 底+1px 边框+圆角 8；主=accent 实底、hover opacity .88；颜色全走 var() | cinema `.bz-cinema-btn` 三态（187-195）、settings `.bz-sp-btn` 三态（371-393）、diary-wall `.bz-diary-wall-empty-btn`（854）、pwv `.bz-password-vault-btn`（862，金渐变=域覆盖 --primary） |
| C3 | 图标钮档位 | `.bz-icon-btn`（既有）+ `--lg`（30-34px 触控）+ `--sm`（18-20px） | 无底圆角、hover 出底 | pwv `mini` ×4（523/636/821/1355，域内逐字复制 4 份）、diary-wall `.bz-diary-wall-icon-btn`（148，与 core 同构）、cinema `.bz-cinema-ic-btn`（52）、settings mob-close/x（642/802） |
| C4 | 弹窗底部主次对 | `.bz-dialog-actions`（=C1 + 主次语义） | 右对齐次+主；danger 主钮实底 | cinema 表单/确认两处、pwv `.dialog`/`.pop2` 两份、与 core confirm 三套并存 |
| C5 | 胶囊 chip | `.bz-chip` + `--on` + `.bz-chip-x` | 999px、modifier-hover 底、✕ 18px 圆钮 | settings `.bz-sp-chip/-x`（415-440，与 core path-picker chip 逐值同构）、diary-wall chip/subchip（196/255）、pwv gen chip（956） |
| C6 | 头行 | 4 新域类名回填 core 组播白名单（或新域挂 `.bz-win-head`，二选一） | 22×26、padding 16/24/10 | diary-wall `.bz-diary-wall-head/-btns/-icon-btn`（110/141/148）、pwv mobbar（1058+）、cinema 面板头（26-39） |
| C7 | 选中态语义固化（规范层，非新类） | — | **实底 accent = 当前生效筛选**（chips/分段）；**tint 底+accent 字 = 导航定位**（nav/侧栏） | cinema nav/qs 实底、diary-wall chip 实底 vs pwv navitem/settings nav tint——按语义各归一类，不强行统一成一款 |

## 三、接入路线（关键决策）

**存量域兼容期**：core/components.css 里组件选择器写成「共享类 + 存量域现类名」群选（`.bz-btn, .bz-cinema-btn, .bz-sp-btn, … { }`），一次收编 4 域；各域文件删除自己的重复副本。**零 TS/DOM 改动**，纯 CSS 收敛。
**新域铁律**：此后新域只准挂共享类（.bz-btn / .bz-btn-row / .bz-chip / .bz-icon-btn…），白名单只服务存量域退役期——写入 ui-design-manual + ADR。

### 前提修正（P0，必须先做）
全局按钮基线改零特异性：`button:not(.clickable-icon) { … }` → `:where(button:not(.clickable-icon)) { … }`。语义不变（仍是兜底），但任何域按钮类 (0,1,0) 即可覆盖 → 共享单类组件成立的前提。⚠ 顺带验证：现有 `.bz-cinema-btn` 等单类按钮当前是否已被 unset 压掉底色（若已压掉，本修正即修复）。

## 四、分阶段

- **P0** 前提修正：按钮基线改 `:where()`；验证/修复单类按钮现状
- **P1** core/components.css 定义 C1-C5 + 变量策略 + 四域类名群选收编 + 删四域重复定义
- **P2** Obsidian 逐域视觉验证（按 ui-visual-fix-workflow，走标注/截图）
- **P3** 规范固化：更新 docs/ui-design-manual.md + ADR（新域禁写独立按钮基线）；回填 C6 头行名单
- **P4**（远期可选）7 旧域逐步收编，白名单退役

## 五、待拍板

1. **danger 画法**（现状三种并存：cinema/pwv 实底红主钮、settings 红字描边、pwv .danger 仅红字）
   → 推荐：**两档**——`--danger`（实底红，作弹窗主钮/删除钮）+ `--danger-ghost`（红字描边，作行内次要危险动作）
2. **接入路线**：纯 CSS 群选收编（推荐，零回归风险）vs 顺带改 DOM 挂共享类（彻底但大）
3. **头行 C6**：存量域类名回填名单（快）vs 新域改挂 `.bz-win-head`（彻底）
4. **pwv 品牌金**：组件颜色全走 var()，pwv 根覆盖成金渐变（推荐，不动组件）
