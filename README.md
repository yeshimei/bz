# 包仔（bz）

由 16 个 QuickAdd 宏脚本（`CONFIG/SCRIPTS/Quickadd/`，约 21,000 行）独立化而来的 Obsidian 插件。**UI、文案、公式与逻辑与原脚本逐字保持一致**，**数据格式零迁移**（继续读写原脚本产出的全部数据文件）。

## 功能域（14 个）

| 域 | 命令 | 数据文件（零迁移） |
|---|---|---|
| 日记本 | 打开日记本面板 / 写日记 / 写摘抄 | `我的/日记/*.md`（标签筛选、滚轮日期、摘抄引用） |
| 备忘录 | 打开备忘录面板 / 创建备忘录条目 | `CONFIG/STORAGE/memo.json` |
| 归物本 | 归物本：添加物品 | `CONFIG/STORAGE/belongings.json` |
| 剪藏本 | 打开文章列表 | `归档/网页剪藏/*.md`（link+created frontmatter） |
| 聚合讯 | 打开资讯阅读器 | `CONFIG/STORAGE/news.json` |
| 密码本 | 打开密码本 / 添加密码条目 / 生成随机密码 | `CONFIG/STORAGE/passwords.json`（AES-GCM 加密） |
| 收藏本 | 打开收藏面板 / 添加收藏 | `CONFIG/STORAGE/favorites.json` |
| 书库 | 打开书库 / 打开读书笔记 | `书库/*.md`（book 标签） |
| 阅读数据分析报告 | 打开阅读数据分析报告 | 同上（tags 含 book） |
| 影视 | 影视：打开 / 影视：添加 | `我的/影视/*.md`（tags/评分/观影日期） |
| 自动摘要 | （常驻）`归档/网页剪藏` 新文自动 AI 摘要 | 写入剪藏 frontmatter |
| 复习计划 | 打开复习面板 / 加入复习计划 / 移出复习计划 / 复习（跳转逾期）/ 复习（选择难度） | `CONFIG/STORAGE/review.json`（FSRS v4） |
| 做题家 | 更新题库 / 打开做题家 | `CONFIG/STORAGE/quiz.json` |
| 闪念 | 闪念：打开参考窗口 / 闪念：打开 AI 对话 | `CONFIG/STORAGE/ai_completion_meta.json` + `*.vec` |
| AI Agent | （常驻）跨域 AI 任务 | `CONFIG/STORAGE/ai-agent.json` |

## 关键设计

- **命令裸注册**：命令 id/名称提取自原脚本 `addCommand` 调用点，不设默认快捷键（保留原热键兼容）；卸载时 `removeCommand` 全量清理。
- **懒加载**（ADR-0003）：UI 域首次打开初始化；事件常驻域（自动摘要/闪念/复习轮询/AI Agent）按设置开关注册。
- **数据零迁移**：所有 JSON/目录/字段名与源码逐字一致，旧数据直接可读。
- **降级链**：AI 服务（DeepSeek → Ollama 本地）、向量检索（远程 → TF-IDF → 文本）、批量出题（批量 → 逐篇）等均与源码一致。

## 安装

1. 构建：`npm install && npm run build` —— 产物自动输出到 vault 的 `.obsidian/plugins/bz/`（main.js / manifest.json / styles.css）
2. Obsidian 设置 → 第三方插件 → 启用「包仔」

## 开发

```bash
npm install        # 首次
npm run dev        # 监听重建（产物直出 vault）
npm run build      # 一次性构建
npm test           # vitest 全量测试（纯函数层 + UI 层 jsdom + mock fetch）
npx tsc --noEmit   # 类型检查
```

## 架构

- `src/core/`：跨域基础设施（utils/dom/json-store/changelog/ai/app/settings-provider/esc-manager/confirm）
- `src/<域>/`：每域独立（index 入口 + 数据层 + UI 层），main.ts 统一命令注册
- `tests/`：mock-obsidian-entry（Notice/requestUrl/moment/Plugin）+ mock-vault（内存文件树 + frontmatter 解析）+ 每域测试

### 测试规模

474 测试（44 文件）覆盖：数据层/纯函数公式（FSRS 幂律、香农多样性、基尼平衡、AES-GCM）、jsdom UI 交互（弹窗/长按/防抖/无限滚动）、mock fetch（AI/余额查询/Ollama）。
