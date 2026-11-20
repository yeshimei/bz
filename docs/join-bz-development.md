# 如何加入 bz 开源项目，成为开发者

> 这篇是给「想参与但不确定从哪下手」的人看的。技术细节版见 [CONTRIBUTING.md](../CONTRIBUTING.md)，本文讲完整流程和怎么借现成的 AI 工作流干活。

bz 是 MIT 开源项目，代码在 <https://github.com/yeshimei/bz>。加入不需要谁批准——**把代码拉下来，改好，提一个 PR，合并之后你就在 GitHub 贡献者名单里了，正式成为这个项目的开发者之一。** 也不用自己从零摸索一套 AI 写法，仓库里已经备好了规范和工具链，照着用就行。

---

## 一、整体路径（六步）

```
有 GitHub 账号 → fork 仓库 → 搭环境 → 按规范改（AI 帮忙）→ 验证 → 提 PR → 合并留名
```

每一步下面都有具体做法。

## 二、准备

需要四样东西：

1. **GitHub 账号** —— 用来 fork 仓库、提 PR、留名。
2. **Node 22 + pnpm** —— 跑构建和测试。
3. **Git** —— 拉代码、提交。
4. **Obsidian** —— 真机验证用（改完要在真插件里看效果）。

AI 编程助手（Claude Code、DeepSeek Harness 之类）不是必须，但**强烈建议用**——bz 的规范本来就是为 AI 协作写的，AI 按它干活成功率最高。你自己写也完全可以，同样遵守下面的流程。

## 三、第一步：拿到代码

在 GitHub 打开 <https://github.com/yeshimei/bz>，点右上角 **Fork**，把它复制到你自己的账号下。然后拉到本地：

```bash
git clone https://github.com/<你的账号>/bz.git
cd bz
pnpm install
```

## 四、第二步：搭测试环境

插件不能拿你日常用的笔记库折腾，单独建一个测试库（起名比如 `bz-test`）。然后改 `esbuild.config.mjs` 顶部的 `VAULT_PLUGIN_DIR`，指向你的测试库插件目录：

```js
const VAULT_PLUGIN_DIR = "<你的测试库>/.obsidian/plugins/bz"
```

启动监听构建：

```bash
pnpm run dev
```

之后每次改完代码，回 Obsidian 里按 `Ctrl/Cmd + R` 重载插件就能看到效果，不用重启整个 Obsidian。

## 五、第三步：用 AI 干活的「正确姿势」

这是重点。群里有人自己用 AI 写网页觉得效果不好——多半是没给 AI 立规矩，它自由发挥就跑偏了。bz 把规矩都写进了仓库，**你只要让 AI 先读、再动手**。

### 让 AI 先读这三份

- **AGENTS.md** —— 干活的硬约定：动手前先勘察列五清单、样式/命令/生成物的铁律、worktree 流程。
- **CONTEXT.md** —— 术语和口径，避免它自己造概念。
- **docs/adr/** —— 设计决策，解释「为什么当初这么定」，防止 AI 好心改坏。

### 标准对话流程（照着发）

1. 先发：**「先读 AGENTS.md / CONTRIBUTING.md / CONTEXT.md，不要改任何代码。」**
2. 再说你想做什么，让它**按 AGENTS.md 列五清单**：你怎么理解、我可能疏忽什么、可优化方向、要我回答的问题、开发流程承诺。
3. 你看过清单、确认或纠正之后，才让它动手。
4. 它会在仓库外的 worktree 里改（不碰你的主分支），只部署到测试库给你看。
5. 改完让它跑测试、真机截图，写一份验证报告给你点开看。

### 三条最容易踩的铁律

- **样式只写 `src/<域>/styles.css`**：不许内联视觉、不许运行时注入 `<style>`；根目录的 `styles.css` 和 `main.js` 是构建产物，**别手改**。
- **命令 ID 用 `bz-<域>-<动作>`**：比如 `bz-diary-open`。
- **提交信息按 Conventional Commits**，而且 `——` 之前的主句**至少 4 个字**——短了会被更新日志生成脚本静默丢掉，提交成功但日志里没你这条。

## 六、第四步：验证

别只信「测试绿了」。三样都做：

```bash
node scripts/test-domain.mjs memo        # 单模块，十秒左右
node scripts/test-affected.mjs --since master   # 改动波及的 + 全树守卫
npx tsc --noEmit                          # 类型检查
```

然后**真机看截图**：打开 Obsidian 测试库，实际点一遍你改的功能，确认视觉和交互都对。测试绿但画面不对，不算完成。

> 一个坑：别用 `vitest --changed` / `--related`。有一批守卫是读源码文本断言的，模块图里没这条边，会出现「命中 0 个、退出码 0」的假绿。

## 七、第五步：提 PR

1. 一个 PR 只做一件事，别把重构和新功能混在一起。
2. 按 `.github/pull_request_template.md` 填。
3. 改到数据格式的话，在 PR 里说清**老数据怎么迁**——这个插件对「装上就能接着用」有硬要求。
4. 在 GitHub 上从你的 fork 向 `yeshimei/bz` 发起 Pull Request，等合并。

合并之后，GitHub 会把你记进贡献者名单——你就是开发者之一了。

## 八、如果你只是想用插件（使用入口）

- 预览、安装、总体教程：[B 站视频](https://www.bilibili.com/video/BV1vNsZ6pE7i/)
- 日记本：[视频教程](https://www.bilibili.com/video/BV1W44i6yETx)
- 影院：[视频教程](https://www.bilibili.com/video/BV15hxH6QEgM/)
- 剪藏本：[视频教程](https://www.bilibili.com/video/BV1pvxe6qEkf/)
- 遇到问题：用 [GitHub Issues](https://github.com/yeshimei/bz/issues)，或来 QQ 交流群 **1130883117** 问。

## 九、常见问题

**需要很会写代码吗？** 不需要。能清楚描述问题、能按上面的流程验证结果就够了，代码可以让 AI 帮你写——规范会保证它不跑偏。

**改完没生效？** 在 Obsidian 里 `Ctrl/Cmd + R` 重载插件；确认 `pnpm run dev` 还在运行、路径指向的是测试库。

**测试全绿但功能不对？** 以真机截图为准，按第六步重新走。

**找不到某个入口？** 先看 B 站视频，再来群里问。

---

## 官方入口

- 仓库：<https://github.com/yeshimei/bz>
- 报问题 / 提需求：<https://github.com/yeshimei/bz/issues>
- 安装与教程：<https://www.bilibili.com/video/BV1vNsZ6pE7i/>
- QQ 交流群：1130883117
