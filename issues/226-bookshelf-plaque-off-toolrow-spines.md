# issue 226：书库木匾复位 + 筛选弱化对齐原型 + 工具行逐行对齐 + 报告残留修复 + 书脊起伏修复

日期：2026-09-06　域：bookshelf　ADR：无（均属 ADR-0096 书脊墙的补全与 bug 修复）

## 用户反馈六项 → 根因 → 修复

1. **木匾复位**（225 退场后用户复核改拍板）：小号匾额「书库」+ 小字「LIBRARY」（拍板：只要英文），
   `3px double` 铜双线边+暗底，保持与统计标签行**同行居左**；**九肤逐肤换脸**对齐原型匾额
   （nordic 浅匾/noir 碳黑/wabi 土匾/bauhaus 黑匾白字/blueprint 蓝匾/neon 发光匾/kraft 深棕匾/
   velvet 金边深匾/mono 白匾黑框；dark=原版基础）。`--bsw-title` 机制随之退役。
2. **点「全馆藏书」没反应**：点击只重置状态轴不清分类筛选（`M.catFilter` 残留）→ 修为全馆一键清
   状态+分类。
3. **点分类其他分类不弱化**：CSS `:not(.dim-cat)` 把分类标签明确排除在弱化外；且无筛选时状态标签
   恒半透明——两处都与原型不符 → 对齐原型 `.off` 口径：无筛选全亮；任一筛选激活后未选中标签
   （状态+分类都算）`opacity:.35 + grayscale(1)`，全馆藏书恒亮作「回到全部」出口（原型 JS 同款）。
4. **墙底残留「阅读分析报告」**：`.bz-bs-view` 全仓无 display 切换规则——`active` 类切了寂寞，
   报告视图去过一次后内容永久可见（225 加的 flex:1 还会与书架对半分高）→ 修为
   `.bz-bs-view{display:none}` + `.active{display:flex;column;flex:1}`。
5. **检索框/排序与原型不一致**：逐行对照 p4-full.html 修正基础值——宽 260→**280px**、阴影 .4→**.5**、
   去多余 `border-radius:0`、placeholder token→**#a08e6e**、seg 文字 token→**#b8a488**、分隔线实色铜→
   **rgba(201,168,106,.4)**、on 态字 wall-dark→**#2b2018**、hint→**#8a755a**；状态标签 `min-width` 96→**100**、
   数字 22→**24px**（分类卡维持 225 轻缩拍板不动）。九肤覆写 225 已逐肤移植，保持。
6. **书脊全同高同宽**：md 书 `readingTimeMs` 在 parseBookFile 写死 0 且无人回填——frontmatter 的
   `readingTime`（毫秒）没人读，`readingTimeFormat` 解析器只认中文「N小时M分」而 weave 新数据是
   英文「11h41m53s」→ 高度全塌 150。修为 `parseReadingTimeMs`：`readingTime` 毫秒直读 →
   readingTimeFormat 中英双格式兜底。厚度公式本就正常（wordCount 有解析，sqrt 压缩属原型口径）。

## 测试

- data 层：时长解析四态（毫秒直读/英文格式/中文格式/全缺）。
- ui 层：匾额复位断言（h1 书库 + p LIBRARY）；无筛选无 .off；.off 弱化+全馆恒亮+点全馆清全筛选；
  源文本守护（九肤匾额规则、检索/排序原型基值、`.off`、视图 display 切换、旧恒半透明规则不复活）。
- 全量 4187/4187 绿；tsc 干净；worktree 自检页 headless 截图核（nordic/mono/bauhaus：匾额/弱化/
  色块书脊/黑通栏/红 seg 全对齐）。
