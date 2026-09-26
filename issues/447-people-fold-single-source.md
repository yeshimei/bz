# 447 — 脸谱改版：折子单源 + 数据源独立弹窗（446 交互重构）

用户拍板（grilling 两轮，Q1–Q6 全按推荐 + 折子案选中）：

## 交互拍板（实现口径）

1. **数据源 = 独立弹窗**（面板内弹层）：默认不打开；打开即扫描；**默认不勾选任何联系人**；
   「勾有更新的」一键快捷；「导入所选」只进预览；完成后弹窗内出「画脸谱」→ **关弹窗回面板跑**
   （面板头下进度行显示批次进度，完成 notice + 列表刷新）。
2. **自动链路全退役**：面板打开不自动弹窗/扫描/勾选/导入/生成。设置键退役：
   `peopleScanOnOpen`、`peopleGenTrigger`、`peopleGenThreshold`（settings.ts + 域 schema「生成」组整组撤）。
3. **文件向导退役**：bz-people-import 命令与头部按钮改开数据源弹窗；「导入聊天」按钮更名「数据源」；
   parseWechatExport 解析器留在 parse.ts 不接入口；detail 页「再导一次聊天」改「从数据源补画」。
4. **四态水位**（弹窗行内）：有更新（排最前 + 高亮行 + 新 N 条）/ 已导无更新（已导 N 条 · 画到日期）/
   未导入 / 群聊未纳入（禁勾，提示设置开启）。
5. **详情折子化**（G 案）：详情从长卷平铺改为折页册——五折（画像[+代表原话] / 事件[+随手记] /
   大事记 / 数据[互动统计+媒体+导入记录] / 档案），收起折显竖排引文，点折脊展开；卡墙改折子封面
   （竖排姓名 + 修复印章 + 统计）。工具条（排序/筛选/搜索）、合并、删除、导出笔记全保留。

## 单源改造（prototype-first）

- `src/people/render.ts` 新建：markup 纯层（零 import：自带 el/text/button helper + 类型 only），
  过 render-purity 守卫；`ui.ts` 只留行为（事件委托/数据流/生命周期）。
- `prototypes/people/`：fake-sim.ts（FakeApp + 形态仿真种子）+ fake/fake-obsidian.ts +
  prototype.html / prototype-view.html（双 iframe：920 桌面 / 412×915 移动）。
- `scripts/build-preview.mjs`：PREVIEW_DOMAINS + BEHAVIOR_DOMAINS 登记 people。

## 真实数据形态 → 布局参数（export_full 57 人实测）

- 消息量级 max 20,773 / 中位 33 / min 1：封面统计用 formatCount 万格式化，零值文案「尚无消息」。
- 名字最长 37 字（>12 字 6 人，纯数字/字母 4 人）：竖排名 >7 字截断为 6 字+「…」；长名横排降级。
- 74% 零语音、40% 零图片：媒体徽章零素材不渲染（既有 personMedia 口径）；印章只表水位。
- 当前导出无群聊：群聊判定与四态保留（数据就绪即生效）。

## 改动清单

- src/people/render.ts（新）/ ui.ts（重写行为层）/ styles.css（折子主题重写，数据展示块保留）
- src/people/settings.ts（数据源组 2 行 + 预览 4 + 隐私 2+按钮）/ src/settings.ts（三键退役）
- src/people/datasource.ts（shouldGenerate 删）；src/people/index.ts（importWechat → 开弹窗）
- prototypes/people/*（新）；scripts/build-preview.mjs（两清单 + people）
- tests：datasource.test.ts（shouldGenerate 块删）/ render.test.ts（新：封面/四态/折子锚）/
  sp-contract-lock（people 11→8）/ settings-panel（导航数不变）
