# 更新日志

## 体验优化

- **下载通道** ：插件更新与在线资源全面改走 GitHub 主通道、jsDelivr 备用，国内直连下载更快更稳
- **更新日志** ：插件更新重启后会自动弹出本次的更新说明

# 使用

1. 到 [Releases](https://github.com/yeshimei/bz/releases) 下载最新的 `bz-1.37.0.zip`
2. 解压到 `<你的 vault>/.obsidian/plugins/` 下，得到一个 `bz/` 文件夹
3. 重启 Obsidian → 设置 → 第三方插件 → 找到「bz」→ 启用

# 离线资源包

在线资源（皮肤、工具包、手册、影视索引）下不动时，用 `bz-offline-1.37.0.zip`。解压出的 `downloads/` 整个放进插件目录，再回插件点一次下载——本地校验通过就直接用，不联网。

```text
.obsidian/plugins/bz/
├── main.js
├── manifest.json
├── styles.css
└── downloads/
    ├── manifest.json
    ├── skins.zip
    └── tools/
```

# 反馈

问题与建议请提到 [Issues](https://github.com/yeshimei/bz/issues)。
