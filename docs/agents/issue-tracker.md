# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in the **repo itself**（不是 `.scratch/`）。

## 本仓实际约定（2026-09-15 校正）

- **实现票（唯一真理源）**：`issues/<NN>-<slug>.md`，三位数连号、全仓唯一（当前已到 `issues/325-*.md`）。
  顶部字段：日期 / 用户拍板 / 关联（ADR 与 ticket 号）/ 状态；正文按背景 / 设计 / 改动面 / 测试 / 不在本轮分节。
  新票编号前先看 `issues/` 最新号（并行会话防撞号）。
- **决策记录**：`docs/adr/<NNNN>-<slug>.md`（四位数连号）。领域词表在仓库根 `CONTEXT.md`，
  与 ADR 同步更新（词条含 `_Avoid_:` 反例列表）。
- **探索期 spec**：`.scratch/<feature-slug>/spec.md`（不入库，见 `.gitignore`），
  用于「还没定稿、没编号」的调研；定稿后再落成 `issues/` 票号 + ADR。
- **交付态**写在票文件的 `状态：` 行（设计定稿 → 已实现 → 已交付），门禁结果与实现期偏差也追加在该行附近。
- **进度总表**：仓库根 `PROGRESS.md`，每票一节、最新在上。

## 通用约定（模板原文，Wayfinder 流程仍适用）

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

本仓：在新票 `issues/<NN>-<slug>.md` 落文件（先查最新号）；探索期内容落 `.scratch/<feature-slug>/`。

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly
（如「issue 325」= `issues/325-*.md`）。

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
