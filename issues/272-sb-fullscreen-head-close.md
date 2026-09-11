# issue 272：第二大脑主面板移动端全屏化 + 头行关闭钮

日期：2026-09-11 ｜ 用户拍板：第二大脑要全屏、44px、右上角关闭按钮、风格统一 ｜ 关联：issue 271 全域移动规范、ADR-0114 修订

## 改动

- `panel.ts`：面板根挂 `.bz-panel-mtop`（≤768px 出全站统一 44px 顶部避让档，桌面不生效）；绑定 `#bz-sb-panel-close` → close()。
- `render.ts`：头行按钮组末尾加关闭钮（同款 `bz-sb-fbtn--icon` 图标钮风格，lucide x，与 AI 对话/灵感参考两钮并列）。
- `styles.css` @media：窄卡兜底（100vw-24px，ADR-0114）升格真全屏——top/left:0、transform:none、100vw × var(--bz-vvh,100vh)（键盘适配）、去边框圆角阴影；滚动模型原样保留。

## 语义

- 全屏页无遮罩可点 → 关闭走右上角钮（与影院/收藏夹等全屏主页一致）；桌面窄窗态遮罩点关与 ESC 保留。
- AI 对话/灵感参考的移动抽屉（mobile-panel.ts）不在此列，未动。
