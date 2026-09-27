# 490 · 下载清单反向守卫：downloads/ 顶层不允许清单外文件

- 日期：2026-09-27
- 状态：已完成
- 相关：issue 480 / ADR-0203（统一下载清单）

## 起因（用户讨论，先议后做）

每加一个在线资源都要登记 `build-manifest.mjs` 的 DOCS 行——用户问能不能免登记。
结论：**登记契约消灭不掉**（行名/排序/对外与否总得有出处），真正的痛点是「忘了登记」
在构建期不炸、发布后插件端校验才失败（失败发生在用户机器上，没人查）。所以选
反向守卫：不消灭登记，消灭「登记失败但没人知道」。

## 落地

`scripts/build-manifest.mjs`：算完 docs sha 后扫描 `downloads/` 顶层
（`readdirSync withFileTypes`），凡非豁免（`manifest.json` + DOCS 的 file 集合）、
非子目录的文件 → 计入 problems → exit 1，文案指路「在 DOCS 登记一行（连同插件端
行名）或删掉该文件」。出版与 `--check` 两条路径都过这道闸（problems 检查在写盘前）。
皮肤不受影响（全在 `downloads/skins/` 子目录）。

## 测试

`tests/core/skin-pack-split-guard.test.ts` +1：临时造未登记文件 → `build-manifest --check`
报「未登记进清单」且点名文件，finally 清理。全组 8/8。
