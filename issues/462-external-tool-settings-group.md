# 462 — 外部工具路径升格为共享设置组 + 微信账号目录键

## Parent

`issues/460-people-face-restructure-spec.md`（spec）。门禁与工作流按 `AGENTS.md`。

## What to build

Python / ffmpeg / ffprobe 三个路径键现在挂在知识盒名下，但脸谱要用的是同一套。把它们升格为域无关的「外部工具」设置组，旧键一次性搬值（沿用既有 ASR 键迁移的做法），知识盒改为读新键。同时新增「微信账号目录」键（默认空 = 自动探测），同步时可用它覆盖探测结果。

## Acceptance criteria

- [ ] 设置面板出现「外部工具」组（Python / ffmpeg / ffprobe 三行），知识盒与脸谱共用同一套值
- [ ] 旧键有值时自动搬入新键（一次性、幂等、旧值清理）；无值时不动，走默认
- [ ] 知识盒下发外部工具参数时读新键，行为与改前一致（其测试夹具同步更新后全绿）
- [ ] 新增微信账号目录键，默认空；空时脸谱按自动探测走
- [ ] 迁移有单测覆盖三种情形：有值迁移 / 无值不动 / 重复执行幂等

## Blocked by

None — can start immediately.
