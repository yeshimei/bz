# 更新日志

## ✨ 新增

- **外部工具** ：新增「bz 依赖什么」清单——勾选要装的东西（Node、Python、Ollama、向量模型、ffmpeg、转写引擎、脸谱的 Python 包），当场生成一段安装提示词，复制给任意 AI 就能从头装到尾，连 bz 里的设置一起回填

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
