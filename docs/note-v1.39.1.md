# 更新日志

## ⚡ 优化

- **游戏库** ：打开 Obsidian 就静默同步一次，首页时间线的「玩了 X」不必先开游戏库
- **游戏库** ：Steam 上没封面的游戏，改用同款封面图、商店截图或库内主视觉补上
- **游戏库** ：排序默认改成「最近玩」，并排在最前
- **插件更新** ：每次启动都查一遍新版本，不再被节流跳过
- **在线资源** ：手册、更新日志、皮肤、工具包跟着版本一起自动补齐

## 🐛 修复

- **游戏库** ：后台拉封面、中文名、成就时主界面不再一遍遍闪，只改变化的那几处

# 安装

1. 到 [Releases](https://github.com/yeshimei/bz/releases) 下载最新的 `bz-<版本>.zip`
2. 解压到 `<你的 vault>/.obsidian/plugins/` 下，得到一个 `bz/` 文件夹
3. 重启 Obsidian → 设置 → 第三方插件 → 找到「bz」→ 启用

# 离线资源包

在线资源（皮肤、工具包、手册、影视索引）下不动时，用 `bz-offline-<版本>.zip`。解压出的 `downloads/` 整个放进插件目录，再回插件点一次下载——本地校验通过就直接用，不联网。

```text
.obsidian/plugins/bz/
├── main.js
├── manifest.json
├── styles.css
└── downloads/
    ├── manifest.json
    ├── skins/
    └── tools/
```

# 反馈

问题与建议请提到 [Issues](https://github.com/yeshimei/bz/issues)。
