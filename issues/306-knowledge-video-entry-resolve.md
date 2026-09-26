# 306 知识盒视频录入改链接解析式（解析按钮 + 分P/时长/档位 + 双把手进度条）

- 状态：完成（2026-09-14 立项并实施）
- 关联：ADR-0133（本 issue 的决策记录）/ 被替换：ADR-0122 拍板要点 5（450ms 防抖 + 只补空）、ticket 146 的范围交互形态（整片/剪辑 toggle + 时间框）

## 背景

现有「视频录入」添加弹窗（issue 278）为：链接单框 450ms 防抖自动解析 + 手动标题/UP主输入框（只补空回填）+ 整片/剪辑 toggle + 分P 数字框 + 清晰度四选。用户 2026-09-14 拍板重做为链接解析式（详见 ADR-0133 拍板链）：单框 + 「解析」按钮 → 只读信息区（标题 / UP 主 / 分 P 下拉 / 时长 / 实测清晰度档位）→ 双把手进度条选范围（时间框双向联动 + ↑/↓ ±1 秒）→ 两端统一「保存」（仅入队不自动处理）。

实测结论（会话内验证）：view API 单响应即含 pages/duration（现 `video-meta.ts` 已在调，零新增请求；54P 视频全量返回、时长逐项求和一致）；未登录 playurl 档位上限 720P，带登录 cookie 的 playurl 可拿完整档位（实测 [1080,720,480,360]）；**实现期实测确认免 wbi 签名**（未签名带 cookie 即通，故不移植 wbi/md5；档位采用前置 nav 登录态校验）；CLI `~/.bilibili-cookies.json` 含登录 cookie（SESSDATA）。

## 交付（全部完成）

- [x] 数据层：`KnowledgeTask.duration`（旧数据缺省 null）；`quality` 值扩展为任意档位数字串；`secToTimeText` / `timeTextToSec` helper（秒 ↔ `M:SS` / `H:MM:SS`，与 CLI `fmtDuration` 口径一致）
- [x] `video-meta.ts` 扩展：pages（P 号 / part / duration / cid）与总 duration 净化；`isCookieLoggedIn`（nav）；`fetchVideoQualities`（`x/player/playurl` fnval=4048 取 dash，免签名）；`resolveVideo` 组合入口
- [x] 弹窗 UI：单框 + 「解析」按钮（防抖退役）；只读信息区（标题 / UP 主 / 多 P 下拉 `P{n} · {part} · {mm:ss}`、单 P 隐藏）；失败态（原因提示 + 分 P 数字框 + 时间框 + 固定档位，仍可保存）；双把手进度条（`range-bar.ts` 自绘，默认全选、拖动即剪辑、「整片」重置、触屏把手 touch-action 仲裁）；时间框双向联动 + ↑/↓ ±1s（Shift ±10）；清晰度下拉（实测档 + 最高，默认全局档、不可用回落最高可用并提示）；两端统一「保存」
- [x] 编辑态：打开弹窗自动重抓一次（静默、不阻塞保存），抓取成功即落库（只补缺失，不重置手填范围）
- [x] 主面板：打开时对缺标题任务串行自动重抓（300ms 间隔、会话级去重），成功即落库并刷新卡片；卡片显示分 P 与时长；不自动处理任务
- [x] 设置面板：「AI」组改名「AI 与凭据」；新增「B站 Cookie」设置项 + 桌面端「从 CLI 导入」按钮（`window.require('fs')` 读 `~/.bilibili-cookies.json`）；影院 ApiZero Key / 豆瓣 Cookie 两项挪入
- [x] CLI 配套：`tools/bili-downloader/core.js` quality → height 映射扩展支持任意档位数字串（`'480'`/`'360'` 精确档），`'highest'`/缺省维持取最高可用
- [x] 测试：data helper（往返一致）/ range-bar（set 钳制 / 键盘 / 拖拽）/ 解析态机（成功 / 失败 / 改动作废 / 序列号过期）/ 范围联动（提交钳制 / ↑↓ / 整片重置）/ 档位默认规则 / 打开面板自动重抓（知识盒域 166 passed）
- [x] 文档：ADR-0133（含实现期修正：免 wbi 签名 + nav 校验）、CONTEXT 词条（录入元信息重写 + 清晰度档位 + 凭据）、spec 交付记录

## 验收

- 知识盒域 `pnpm test` 166 passed、`pnpm exec tsc --noEmit` 0 错
- 解析按钮态机：成功渲染信息区 / 失败显失败态可保存 / 改动输入作废信息并可重新解析
- 进度条：默认全选 = 整片（保存落 start/end=null）；拖动与时间框双向联动；↑/↓ ±1 秒；切 P 重置量程
- 档位：配 cookie（导入）后显示实测档位、默认选中全局档、全局档不可用回落最高可用并提示；未配/失效回落固定列表
- 两端按钮均为「保存」，保存仅入队（▶️ 手动批量不变）
- 主面板打开自动重抓缺标题任务；编辑弹窗打开自动重抓且成功即落库
