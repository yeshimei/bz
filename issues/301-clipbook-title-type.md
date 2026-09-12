# issue-301：剪藏本文章标题字号降档（桌面 display 档 / 移动 27px）

- 分支：worktree/2 ｜ worktree：work-2 ｜ 日期：2026-09-12
- 来源：备忘录 item-1789166191968-7yoy1p（「桌面端和移动端的标题小一些」）

## 背景

备忘录「标题」判读为**文章标题**（阅读面顶栏大标题）：桌面 24px 写死（偏离 token 阶梯）、
移动 33px，相对正文确属偏大。顶栏刊名不动——2026-09-10 刚按用户拍板 21px→17px 收过
（styles.css 注释在案），备忘录晚于该决策 2 天，无新指示不再动刊名。

## 改动

- `src/clipbook/styles.css` 两行：
  - 桌面 `.bz-clip-art-title`：`font-size: 24px` → `var(--bz-font-display)`（token = 20px，
    项目倾向 token 化不写死中间值）；
  - 移动 `.bz-clip-mob-d-title`：`font-size: 33px` → `27px`（移动端 ×1.5 口径有弹性先例，
    取与桌面同比例降幅；端互斥类直改基座值，无需新增 @media）。
- 回归锁 `tests/clipbook/title-type.test.ts`：仿 `review-mobile-type.test.ts` 先例
  readFileSync 断言规则值（按选择器切块宽容解析，顺序无关）。

## 验收

- [x] `pnpm exec tsc --noEmit` 干净；clipbook 定向 + 全量门禁绿（worktree 内
      preview-freshness 假红按 stash 基线差集判据排除）
- [x] 合并 master 后主仓全量 4577 用例绿 + build 部署
