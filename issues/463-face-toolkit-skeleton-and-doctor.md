# 463 — `@jwbz/obsidian-face` 包骨架 + `doctor` 自检

## Parent

`issues/460-people-face-restructure-spec.md`（spec）。门禁与工作流按 `AGENTS.md`。

## What to build

把 `E:\Obsidian\微信脸谱数据\tools\` 下散装的解密链条收成一个可安装的包：Node 外壳 + 随包 vendored Python（自写脚本 + 裁剪版上游解密库，**保留其 MIT 许可与版权声明**）。

**本票不做 sync**，只让包能装、能自检：`bz-face doctor` 一次查清 Python 版本、解密组与转写组依赖、ffmpeg、微信进程与版本状态、数据根可写性，并按缺口给出**可直接粘贴**的安装命令。

包**不发布到公开 registry**（声明 public 访问但不执行发布）——它的核心能力是解密微信数据库。

## Acceptance criteria

- [ ] 包可被本地安装并暴露 `bz-face` 命令；`package.json` 声明 public 访问但仓库中无发布动作
- [ ] `bz-face doctor` 逐项打印「通过 / 缺失 + 修复命令」；单项缺失不抛栈、不中断其余检查
- [ ] 依赖按用途分成**解密组 / 转写组**两份清单，各自缺失时只提示对应那一行安装命令
- [ ] **不执行任何自动安装**（不得调用 pip 或等价动作）
- [ ] 微信进程不在、或版本已被官方封堵取密钥时，给人话指引（含需退回的版本号）
- [ ] 裁剪后的上游库保留许可证与版权声明；包内不含 `.git` 与无关导出器
- [ ] 散装脚本在仓库侧归档；README 写清安装与自检步骤

## Blocked by

- #461（协议解析与进程调用壳）
