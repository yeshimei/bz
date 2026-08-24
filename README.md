# 包仔（bz）

一站式 Obsidian 个人信息管理插件，由 QuickAdd 脚本独立化而来，现包含 **21 个功能域 / 43 条命令**：主页、日记本、备忘录、归物本、剪藏本、聚合讯、密码本、收藏本、书库、阅读数据分析报告、影视、自动摘要、复习计划、做题家、闪念、AI Agent、番茄钟、B站下载器、附件搬移、保险箱、小橘陪伴猫。

**UI、文案、公式与数据格式保持既有约定（兼容性冻结）**：沿用 `CONFIG/STORAGE/*.json`、`我的/*.md` 与 frontmatter，旧数据直接可读、零迁移。

## 功能域（21 个）

| 域 | 命令（id） | 数据（零迁移） |
|---|---|---|
| 主页 | `bz-home` | `CONFIG/STORAGE/launcher.json`（磁贴入口 + 中键/手势） |
| 日记本 | `bz-diary-open` / `bz-diary-write` | `我的/日记/*.md`（标签筛选、滚轮日期、摘抄引用、条目加密） |
| 备忘录 | `bz-memo-open` / `bz-memo-add` | `CONFIG/STORAGE/memo.json` |
| 归物本 | `bz-belongings-open` / `bz-belongings-add` | `CONFIG/STORAGE/belongings.json` |
| 剪藏本 | `bz-clipping-open` | `归档/网页剪藏/*.md`（link + created frontmatter） |
| 聚合讯 | `bz-news-open` | `CONFIG/STORAGE/news.json` |
| 密码本 | `bz-pw-open` / `bz-pw-add` / `bz-pw-generate` | `CONFIG/STORAGE/passwords.json`（AES-GCM 加密） |
| 收藏本 | `bz-favorites-open` / `bz-favorites-add` | `CONFIG/STORAGE/favorites.json` |
| 书库 | `bz-library-open` / `bz-book-notes-open` | `书库/*.md`（book 标签）、`我的/读书笔记`（EPUB 条目，ADR-0013） |
| 阅读数据分析报告 | `bz-reading-report-open` | metadataCache 统计（香农多样性、基尼平衡） |
| 影视 | `bz-movie-open` / `bz-movie-add` / `bz-movie-report` | `我的/影视/*.md`（tags/评分/观影日期/豆瓣信息） |
| 自动摘要 | （常驻，按设置开关） | 剪藏 frontmatter（新文自动 AI 摘要） |
| 复习计划 | `bz-review-open` / `bz-review-start` / `bz-review-add` / `bz-review-remove` / `bz-review-overdue` / `bz-review-rate` / `bz-review-again` / `bz-review-hard` / `bz-review-good` / `bz-review-easy` | `CONFIG/STORAGE/review.json`（FSRS v4） |
| 做题家 | `bz-quiz-open` / `bz-quiz-update` | `CONFIG/STORAGE/quiz.json` |
| 闪念 | `bz-flash-open` / `bz-flash-chat` | `CONFIG/STORAGE/ai_completion_meta.json` + `*.vec`（Ollama） |
| AI Agent | （常驻，按设置开关） | `CONFIG/STORAGE/ai-agent.json`（跨域 AI 任务） |
| 番茄钟 | `bz-pomodoro-open` | `CONFIG/STORAGE/pomodoro.json`（状态栏常驻倒计时） |
| B站下载器 | `bz-bili-open` | —（外部 Web 工具，ADR-0011） |
| 附件搬移 | `bz-attach-move` | —（搬当前笔记引用的 vault 附件，fileManager 自动改链） |
| 保险箱 | `bz-encrypt-open` / `bz-encrypt-lock` | `CONFIG/.ENCRYPT/`（`.safe.enc` + `.随机名.enc`，正文+图片/视频附件） |
| 小橘陪伴猫 | `bz-smartcat-open` / `bz-smartcat-chat` / `bz-smartcat-hide` / `bz-smartcat-dashboard` | `CONFIG/STORAGE/smartcat.json`（桌面宠物 + AI 陪伴） |

## 关键设计

- **命令裸注册**（ADR-0004）：命令 id 统一 `bz-<域>-<动作>`，不设默认快捷键（外部主页.js / 磁贴按裸 id 调用）；卸载时 `removeCommand` 全量清理。
- **懒加载**（ADR-0003）：UI 域首次打开初始化（`ensureXxx` 幂等）；事件常驻域（自动摘要 / 闪念 / 复习轮询 / AI Agent / 番茄钟 / 小橘）按设置开关注册。
- **依赖方向**（ADR-0002）：`core ← config/state ← parser ← store ← ui ← main`；store 无 DOM，UI 刷新靠回调订阅；模块顶层不互访、不挂 window。
- **数据零迁移**：所有 JSON / 目录 / 字段名沿用既有格式，旧数据直接可读；已知文案、CSS、公式一律不改。
- **AI 降级链**：AI 服务 DeepSeek → Ollama 本地；向量检索 远程 → TF-IDF → 全文；批量出题 批量 → 逐篇。
- **外部工具**（独立 npm 包，插件不含其逻辑）：
  - 影视海报/豆瓣信息抓取：`tools/obsidian-douban-poster`（`@jwbz/obsidian-douban-poster`，可 PM2 watcher 守护，每 15 秒串行抓取防限流，ADR-0006/0007）
  - 聚合讯抓取：`tools/news-watcher`（`@jwbz/obsidian-news`，ADR-0008）
  - B站下载器：`tools/bili-downloader`（`@jwbz/bili-downloader`，本地 Web：解析/分P/多 CDN 节点/ffmpeg 合并/whisper 字幕，ADR-0011）
- **通知规范**：自绘 toast（`src/core/notice.ts`），正文不带 emoji 前缀；新语义先查 ICONS 表。
- **移动端适配**：主窗口弹窗默认全屏（`styles.css` 全局避让，ADR-0019）；主页手势（双击/三击/下滑）可配。

## 环境要求

- Obsidian ≥ 1.4.0（manifest `minAppVersion`），桌面端 + 移动端均可（`isDesktopOnly: false`）

## 安装

1. 构建：`npm install && npm run build` —— 产物自动输出到 vault 的 `.obsidian/plugins/bz/`（main.js / manifest.json / styles.css）
2. Obsidian 设置 → 第三方插件 → 启用「包仔」

> 仓库根目录同时内置构建产物（`main.js` / `manifest.json` / `styles.css`），也可直接下载或经 BRAT 安装。

## 开发

```bash
npm install        # 首次
npm run dev        # 监听重建（产物直出 vault，含 src/**/styles.css 聚合）
npm run build      # 一次性构建（production，minify + JS/CSS 聚合）
npm test           # vitest 全量测试（纯函数层 + UI 层 jsdom + mock fetch）
npx tsc --noEmit   # 类型检查
```

## 架构

- `src/main.ts`：命令裸注册表（43 条）、设置页、懒加载装配、onunload 全量清理
- `src/core/`：共享层（不挂 window）——app / settings-provider / ai / json-store / esc-manager / confirm / utils / dom / changelog / notice（自绘 toast）/ settings-modal / mobile
- `src/<域>/`：每域独立（index 入口 + 数据层 + UI 层），`src/settings.ts` 单页设置（域设置走 ⚙️ 弹窗）
- `src/diary/`：日记本（含条目加密，复用保险箱容器，ADR-0017）
- `src/smartcat/`：小橘陪伴猫（OCEAN 人格 + PAD 情绪状态机、记忆流、行为观察、恋爱关系成长，ADR-0022~0043）
- `styles.css`：唯一样式收敛处（构建自动聚合 `src/**/styles.css`），类名 `bz-` 前缀；禁止运行时注入 `<style>`
- `tools/`：三个外部工具源码（douban-poster / news-watcher / bili-downloader）
- `tests/`：mock-obsidian-entry（Notice/requestUrl/moment/Plugin）+ mock-vault（内存文件树 + frontmatter 解析）+ 每域测试
- `docs/adr/`：43 个架构决策记录（ADR-0001 ~ 0043）；`CONTEXT.md` 为项目术语与约定总表

### 测试规模

1800+ 测试（125 个文件）覆盖：数据层/纯函数公式（FSRS 幂律、香农多样性、基尼平衡、AES-GCM、OJ 状态机）、jsdom UI 交互（弹窗/长按/防抖/无限滚动）、mock fetch（AI/余额查询/Ollama）、smartcat 行为链路（情绪/记忆/陪伴）。

## License

MIT