# 306 知识盒视频录入改链接解析式（解析按钮 + 分P/时长/档位 + 双把手进度条）

- 状态：进行中（2026-09-14 立项，无人值守会话实施）
- 关联：ADR-0133（本 issue 的决策记录）/ 被替换：ADR-0122 拍板要点 5（450ms 防抖 + 只补空）、ticket 146 的范围交互形态（整片/剪辑 toggle + 时间框）

## 背景

现有「视频录入」添加弹窗（issue 278）为：链接单框 450ms 防抖自动解析 + 手动标题/UP主输入框（只补空回填）+ 整片/剪辑 toggle + 分P 数字框 + 清晰度四选。用户 2026-09-14 拍板重做为链接解析式（详见 ADR-0133 拍板链）：单框 + 「解析」按钮 → 只读信息区（标题 / UP 主 / 分 P 下拉 / 时长 / 实测清晰度档位）→ 双把手进度条选范围（时间框双向联动 + ↑/↓ ±1 秒）→ 两端统一「保存」（仅入队不自动处理）。

实测结论（会话内验证）：view API 单响应即含 pages/duration（现 `video-meta.ts` 已在调，零新增请求）；未登录 playurl 档位上限 720P，带登录 cookie 的 wbi playurl 可拿完整档位（实测 [1080,720,480,360]）；CLI `~/.bilibili-cookies.json` 含登录 cookie。

## 交付

- [ ] 数据层：`KnowledgeTask` 新增 `duration: number | null`（旧数据缺省 null）；`quality` 值扩展为 `'highest' | 数字串档位`；时间格式化 helper（秒 ↔ `M:SS` / `H:MM:SS`，与 CLI `fmtDuration` 口径一致）
- [ ] `video-meta.ts` 扩展：解析 pages（P 号 / part / duration）与总 duration；新增档位查询——wbi 签名（nav 取 img/sub key + mixin）+ `x/player/wbi/playurl`，md5 纯 JS 实现（两端单源，不依赖 Node crypto）
- [ ] 弹窗 UI：单框 + 「解析」按钮（防抖退役）；只读信息区（标题 / UP 主 / 多 P 下拉 `P{n} · {part} · {mm:ss}`、单 P 隐藏）；失败态（原因 + 重试 + 分 P 数字框 + 时间框 + 固定档位）；双把手进度条（默认全选、拖动即剪辑、「整片」重置）；时间框双向联动 + ↑/↓ ±1s；清晰度下拉（实测档 + 最高，默认全局档、不可用取最高可用并提示）；两端统一「保存」
- [ ] 编辑态：打开弹窗自动重抓一次，抓取成功即落库（只补缺失，不重置手填）
- [ ] 主面板：打开时对缺标题任务串行自动重抓（带间隔），成功即落库并刷新卡片；卡片显示分 P 与时长
- [ ] 设置面板：「AI」组改名「AI 与凭据」；新增「B站 Cookie」设置项 + 桌面端「从 CLI 导入」按钮（`getFs()` 读 `~/.bilibili-cookies.json`）；影院 ApiZero Key / 豆瓣 Cookie 两项挪入
- [ ] CLI 配套：`tools/bili-downloader/core.js` quality → height 映射扩展支持任意档位数字串（`'480'`/`'360'` 精确档），`'highest'`/缺省维持取最高可用
- [ ] 测试：数据层（time helper / 档位解析 / duration 容错）+ UI 层（解析态机 / 进度条联动 / 档位默认规则）+ smoke 同步
- [ ] 文档：ADR-0133、CONTEXT 词条（录入元信息重写 + 清晰度档位 + 凭据）、spec 交付记录
- [ ] 门禁全绿（pnpm test + tsc + 自审 + diff 审查）→ 合并回主仓库 → 主仓库构建部署 → 清理 worktree

## 验收

- `pnpm test` 全绿、`pnpm exec tsc --noEmit` 0 错
- 解析按钮态机：成功渲染信息区 / 失败显失败态可保存 / 改动输入作废信息
- 进度条：默认全选 = 整片（保存落 start/end=null）；拖动/时间框双向联动；↑/↓ ±1 秒；切 P 重置量程
- 档位：配 cookie（导入）后显示实测档位、默认选中全局档；未配/失效回落固定列表
- 两端按钮均为「保存」，保存仅入队（▶️ 手动批量不变）
- 主面板打开自动重抓缺标题任务；编辑弹窗打开自动重抓且成功即落库
