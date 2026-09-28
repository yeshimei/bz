# issue 506：删除确认与解锁保险库两处「还是老样式」——收进册子，一门到底

- 关联：issue 505（脸谱主界面改册子，本轮的母任务）、issue 500 · 501 · 502（删除门禁与确认页）、
  issue 482（脸谱口径解锁屏）、ADR-0194（脸谱与保险库共锁同库；决策 3「取消 = 不展示任何数据」）、
  ADR-0002（core 不反向依赖域）、ADR-0067（一次性弹层 topifyZ）
- 域：people（脸谱）／落点跨 core + encrypt（共享骨架加一个可选槽位）
- 反馈来源：用户看完 505 上岸后的真机截图
  > 「删除确认框和密码解锁弹窗都还是之前的样式，把它改成相册簿原型中的」
- 用户裁决（二选一里选了后者）
  > 「单独给脸谱做一个书本的解锁保险库页面，替换掉之前的」

## 两处毛病（都属 505 的收尾漏项）

505 把**主界面**和**册内弹窗**都换成了册子，但有两处仍走 505 之前那套「通用圆角卡」：

1. **删除确认（已画谱那档）**：`delPage` 只写了一句「要删除，请重输主密码确认。」，
   真正的密码门交给宿主的全屏解锁屏（`uiLockScreen({ kind:'people', icon:'trash-2', title:'删除确认', … })`）。
   于是站在册子里点删除 → 翻出一页纸 → 再被弹到一张跟册子无关的皮肤上，「一门两皮」。
2. **解锁保险库**：`LOCK_KIND_META.people` 还是 `contact` 印章 + 「脸谱已上锁 / 解锁前，联系人卡片与聊天记录均以密文保存 / 解锁」，
   而册内那张合着的封面（`lockCover()`）写的是「脸谱 / 人物消息脸谱 / 解锁保险库」。
   同一件事在「进面板前的门禁」与「面板里上锁」两处挂着两句不同的话、两种不同的皮。

## 改动

### 1. 删除确认：主密码收进那一页（`src/people/render.ts` + `src/people/ui.ts`）

- `delPage(p, tier)`：`drawn` 档在说明行下面追一枚主密码框 + 一条常驻错误行
  （`[data-people-del-pw]` / `[data-people-del-err]`，错误行空串时靠 `.bz-people-del-err:empty { display:none }` 收起）。
  两档的页脚不变（取消 / 删除），即「一门到底」：翻出来的那一页就是全部交互。
- `handleDelete(id)`：三档统一 `dialog = { kind:'del', tier }` + 重画，**删掉**原来 drawn 档的分叉；
  重画后 `focusDelPw()` 把焦点交给密码框。
- 新增 `confirmDeleteFromPage(p, btn)`：页内校验（空 → 「请输入主密码确认」；`verifyPassword` 通过 → `deletePerson`；
  错 → 「主密码不对，再试一次。」+ 清框回焦；抛错 → 如实报错留在页上）。提交期禁用删除钮并换「正在确认…」，
  失败路径复位。**这是防误触确认而非解锁**，不改解锁态、不进冷却节流（同 encrypt 域密文销毁口径）。
- `del-ok` 点击按 `openedTier === 'drawn'` 分派；`overlay` 的 Enter 提交目标表加上 `data-people-del-pw`。
- 删除 `confirmDeleteWithPassword`（那支 505 前的宿主锁屏门）与随之无用的 `uiLockScreen` import。

### 2. 解锁保险库：共享骨架加一个可选次按钮，脸谱换皮成册子封面

**core（加法，既有三域渲染逐字不变）**

- `src/core/ui/lock-screen.ts`：新增 `LockScreenOpts.cancel?: string` 与 `LockScreenHandle.cancelBtn`。
  传了 `cancel` 才在主按钮**左侧**多出一颗 `.bz-lockscreen-cancel`（`data-ls="cancel"`）；
  组件只出钮与槽位，**语义留给调用域**（不挂 `onclick` 就只是颗不动的钮）；`setBusy` 期同步 disabled（提交窗口内不给退出）。
- `src/core/ui/components.css`：`.bz-lockscreen-cancel` 从简样式（ghost，破坏性动作仍只由主按钮承担）。

**encrypt（接线 + 封面文案）**

- `LOCK_KIND_META.people` 改成册内封面同一句话：`icon:'lock'` / `title:'脸谱'` / `sub:'人物消息脸谱'` / `action:'解锁保险库'`。
- `openUnlockScreen` 传 `cancel: kind === 'people' ? '取消' : undefined`，
  并挂 `ls.cancelBtn.onclick = () => done(false)`——与点空白 / ESC 同一条收场路（ADR-0194 决策 3：取消 = 不展示任何数据）。

**people（换皮，只碰 `.bz-lockscreen--people`）**

- `src/people/styles.css` 重写 `#解锁屏 = 合着的册子封面` 一节：遮罩 = 桌面那层宣纸（`#f7f2e8` / 暗色 `#262320`，即 scope 底色，不是通用那层深蒙）、
  内容盒 = 皮革封皮（与 `.bz-people-cover` **同一串渐变**：皮面纹两层 + 左上暖光 + 155° 皮革线性）、
  `::before` = 书脊压带、`::after` = 顶沿烫金装订线、印章徽 = 铜搭扣（正圆、不转）、
  标题 = 楷体 34px 烫金字、副题 = 烫金小字、统计三格 = 封面下沿一行烫金账（去掉卡片底）、
  密码框占整行、取消与解锁并排、错误 / 安全 / 提示行按封面下沿小字处理。
- 暗色跟册内封面同一套改法：装订线转暗渐变、副题与提示提亮一档（`#e8d9b8` / `#c9b58a`）、搭扣压深
  （对齐 `.theme-dark .bz-people-cover-*` 那组，免得同一本书在两种主题下看着像两本）。
- **弹层挂 `document.body`，够不着 `.bz-people-scope` 上那组 token** —— 与日记锁屏同款教训：
  块内自声明 `--ls-*` 覆盖 + `--lsp-*` 封面五件套，圆角与字号（`--lsp-r` / `--lsp-f-aux` / `--lsp-f-head`）
  也按字面重声明，**一个 `var(--r-paper)` / `var(--f-aux)` 都不留给够不着的根**（首版漏了这处，值全落空）。

## 测试

- `tests/people/delete-person.test.ts`：`已画谱` 一档四例改为断言**页内**密码框
  （`type=password` / placeholder 主密码 / `[data-people-del-err]` 文案 / Enter 提交 / 取消走合页），删掉等宿主锁屏的 `lockMask` 旧锚。
- `tests/people/render.test.ts`：补 `delPage` 断言——密码框**只在 drawn 档**出现，错误行初始为空。
- `tests/people/lock-screen.test.ts`：文案断言换成新封面口径，补「封面上那颗取消」的收场断言（点击即放行 `false` 并摘屏）。
- `tests/core/lock-screen-ui.test.ts`：新增一组次按钮契约测试——不传 `cancel` 时 `cancelBtn === null` 且行内仍只有 `p1/p2/go`；
  传了则在 `go` 左侧；组件不接语义、`setBusy` 期点不动。

## 门禁与收尾

- [x] `npx tsc --noEmit` exit=0
- [x] `npx vitest run` 全量绿（554 文件 / 8355 例；含 `preview-freshness`）
- [x] `node scripts/build-preview.mjs` 重出原型产物（改到 `src/people/render.ts` 与 `src/encrypt/ui.ts`，11 份 `prototype-behavior.js` + 1 份 `prototype-render.js` 跟着重算）
- [ ] 提交 → merge 回主仓 → `_gen-changelog.mjs` + `build-manifest.mjs` → 主仓 `pnpm run build` 部署 → 清 worktree

## 备注：原型壳覆盖不到解锁屏

解锁屏是**宿主级**弹层（挂 `document.body`），册子原型壳跑的是面板内的封面（`lockCover`），
所以这层皮只能靠真机看 / 单测钉结构槽位——原型壳「看不到」是正常现象，不等于没生效。
