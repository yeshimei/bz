# issue 226：归物本换血——P20「瑞士大字报」完全原型化落地

拍板：用户从 belongings-redesign20 二十版中选中 P20 瑞士网格大字报，完全替换归物本域现有 P6「状态边栏×时间轴」视觉（对照 p20-full.html 完整功能版原型）。

## 范围
- 就地重写 `src/belongings/ui.ts` + `styles.css`（域内皮肤按 ADR-0097 判例：`.bz-bel--poster/.bz-bel-form/.bz-bel-detail` 作用域 token 覆盖 + `.bz-bel-*` 装饰类；基线继续消费组件库）。
- **完全原型化（issue 219b/c/d 收藏本范式跟进）**：删壳头行（品牌块/⚙/✕）——桌面海报 hero 即头、点遮罩/Esc 关；⚙ 收敛设置面板；移动专属窄头行（＋记一笔/🔍搜索展开/✕）。
- 新视图：海报 hero（大字标题=筛选名 + 品牌标语 + KPI 行：在库件数 hero/在库投入/日均成本/已离场·回收）→ 筛选 chips（全部/资产/四态带计数，再点回全部 issue 208）→ 工具行（搜索/年份/**排序三档 segmented 新增**/记一笔）→ 大字网格卡（NO.XX 编号/状态徽章/特大 emoji/名称/大字价格/meta，hover 整卡反色，离场灰化，末行空位补纸 filler）→ 脚注。
- **桌面点卡 = 详情弹窗**（P20 新增）：字段全览 + 四态流转条（当前态高亮）+ 编辑/删除；右键动作菜单不变（issue 202 不冲突）。

## 契约零改动
belongings.json 零迁移；命令 bz-belongings-open/add；设置键 belongingsDefaultStatus/belongingsMobileDefaultFullscreen；smartcat 事件 add/edit/status/delete + belongingsEditChanges；notifyUndo 撤销；confirmDiscard；自动刷新自写短路；topifyZ（面板/详情/表单三层动态发号）；ESC 分层（详情→表单→主面板）；统计口径 ADR-0089 不动。

## 测试
tests/belongings/ui.test.ts 整体重写（90 用例）：契约回归全保留，视图锚点换 chips/KPI/网格/详情。
