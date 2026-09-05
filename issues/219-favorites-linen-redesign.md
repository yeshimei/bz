# issue 219：收藏本换血——C5「亚麻记事板」1:1 落地

拍板：用户从 favorites-cork-5 五变体中选中 C5 亚麻记事板，完全替换收藏本域现有 P1「标签工作台」视觉。

## 范围
- 就地重写 `src/favorites/styles.css`（亚麻十字纹底 + token 作用域覆盖 + 白卡/胶带/磁点/金圈）与 `ui.ts` 的 `cardHtml`（C5 卡结构）。
- 契约零改动：favorites.json 零迁移；命令/设置键/smartcat 事件/schema 不动；右键/长按动作、AI 整理、余额、归档、贴链搬家全保留。
- 测试锚定类（.bz-fav-card/.bz-fav-title/--pinned/--link/meta）语义保留，测试零改或最小改。

## 视觉规格（对照 c5-linen.html）
- 面板底亚麻十字纹（45°/-45° 双向 repeating + 米灰 #e9e4d8 系），域内 token 作用域覆盖（参照 issue 210 --bz-* 先例），rail/头行/工具行/空态自动亚麻化。
- 卡：白圆角 10、磁圆点（右上=tags[0] 色 hue 映射）、和纸胶带（顶部随机三色斜条）、标题+3 行简介+meta（标签/笔记/日期徽章）+余额；hover 抬升。
- 置顶=金圈（0 0 0 2px）；归档视图卡褪色（opacity .5 + grayscale）。
- 多列卡流：桌面 3 列（184px 卡），移动单列。
