# 23 — 命令入口页（Launcher）

**What to build:** 全局唯一的命令入口弹窗（Modal，单例），网格化展示命令磁贴；单击磁贴执行命令并关闭入口页。范围不限 bz- 命令，其他插件命令亦可上墙（`app.commands.listCommands()` 动态枚举）。默认布局空白，用户自行添加。

**Status:** resolved（2026-08-08 完成，36 测试，全量 699 过 / 1 存量失败）

## 已定设计（grilling 会话 2026 封板）

1. **形态**：Modal + 全局唯一单例（已开则复用聚焦，不重复实例）。
2. **命令**：`bz-launcher-open` 裸注册进 main.ts COMMANDS 表。
3. **网格**：列数默认 6、设置页可调（`launcherColumns`）；行数动态扩展 + 内部滚动。
4. **档位**：{1×1, 1×2, 2×1, 2×2}（列×行，最大 2×2）；编辑模式拖右下角手柄调整，松手吸附最近档位。
5. **推挤 (Push)**：拖拽落点被占 → 链式顺移腾位（行优先扫描到空位；网格末尾可扩展行）。
6. **命令范围**：全部命令可上墙（动态枚举），默认布局空白无任何命令。
7. **点击**：常态单击磁贴 = 执行命令 + 关闭入口页。
8. **编辑模式**：长按 0.5s 进入（iOS 式）；拖主体=移动、拖手柄=调档位、左上角 ×=删除、顶部 +=添加、完成=退出。编辑模式下单击不执行命令。
9. **添加**：+ → 模糊命令选择器（FuzzySuggestModal，按命令名搜全部命令）→ 选中后以 1×1 落网格末尾第一个空位。
10. **幽灵磁贴**：命令失效（插件禁用）→ 保留位置灰色不可用块，可删除，命令恢复后自动复活。点击提示「命令不存在」。
11. **图标**：磁贴可自定义 lucide 图标（内置图标清单 + 模糊搜索选择器），存 launcher.json，优先于命令自带 icon；无 icon 显示兜底。
12. **数据**：`CONFIG/STORAGE/launcher.json`，`{version: 1, tiles: [{id, commandId, x, y, w, h, icon?}]}`。

## 检查清单

- [ ] `src/launcher/` 新域：types / data（load/save + 网格纯函数：placeTile 追加空位、pushMove 推挤、canFit 越界、ghost 检测）/ icons（lucide 清单 + 模糊过滤）/ ui（LauncherModal 单例：网格渲染、长按编辑模式、pointer 拖拽、档位手柄、删除、添加、图标选择器、幽灵磁贴）/ index（ensureLauncher 懒加载 + openLauncher + unloadLauncher）
- [ ] main.ts：COMMANDS 表加 `bz-launcher-open`；onunload 清理；设置页加 launcher tab（列数）
- [ ] settings.ts：`launcherColumns`（默认 6）+ DEFAULT_SETTINGS
- [ ] styles.css：launcher 样式（磁贴、编辑模式抖动/描边、幽灵态、手柄）
- [ ] 测试：数据层纯函数（推挤/追加/越界/幽灵）+ UI 层 jsdom（长按进编辑、添加/删除、档位、点击执行并关闭、幽灵磁贴）
- [ ] smoke.test.ts 命令清单同步（30 → 31 命令）
- [ ] PROGRESS.md 更新
