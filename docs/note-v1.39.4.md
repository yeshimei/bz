# 更新日志

## ⚡ 优化

- **书库** ：接上 bz reader，书、进度、划线和阅读时长都跟着显示。
- **阅读报告** ：bz reader 的书也一并算进统计。
- **影视** ：没配目录或一部片都没有时，空态给一个视频教程入口。

# 安装

1. 到 [Releases](https://github.com/yeshimei/bz/releases) 下载最新的 `bz-<版本>.zip`
2. 解压到 `<你的 vault>/.obsidian/plugins/` 下，得到一个 `bz/` 文件夹
3. 重启 Obsidian → 设置 → 第三方插件 → 找到「bz」→ 启用

# 离线资源包

在线资源（皮肤、工具包、影视索引）下不动时，用 `bz-offline-<版本>.zip`。解压出的 `downloads/` 整个放进插件目录，再回插件点一次下载——本地校验通过就直接用，不联网。

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
