# Ticket 145 — bili-dl 压缩回退：压缩件比原文件大则采纳原文件（用户拍板）

> 用户问「如果压缩的体积比原文件大，那么就采取原文件，这个有没有？」——现状没有（原网页版旧有逻辑在
> ticket 136 迁 CLI 时移除，CONTEXT.md 曾标注「压缩回退（网页版专有，已移除）」）。本次补回。
> 改动在全局工具源码镜像 `tools/bili-downloader`（@jwbz/bili-downloader v1.3.0，bz 仓库内 git 跟踪）；
> 插件侧 processor 仅透传 compress/crf，无需改动。

## 1. core.js ③.5 压缩段

- 新增 `needsCompressFallback(inPath, outPath)`：`statSync(outPath).size > statSync(inPath).size`（严格大于；
  stat 异常 → false，保守采纳压缩件）。
- 压缩完成后：回退 → 删压缩件、`srcForDeliver` 沿用压缩输入（原件/剪辑件）、**不写** resume-compress 缓存；
  采纳 → 维持现状（删中间剪辑临时件、写缓存）。
- 交付文件名：`buildFileName` 的 `compressed` 改传 `compressedAdopted`（回退时 false → 不带 `_crf<值>` 标记）；
  断点续跑命中压缩缓存恒为采纳（文件名仍带标记）。

## 2. 测试（tools/bili-downloader/tests）

- `core.test.js` 新增 `needsCompressFallback` 单测：压缩件更大 → true；更小/相等/stat 异常 → false。
- `node --test` 全量回归（既有 _crf23 采纳路径不受影响——正常场景压缩件更小仍采纳）。

## 3. 文档

- `CONTEXT.md`「压缩」段：_Avoid 改为「压缩率、码率压缩」；主句补回退语义（ticket 145）。
- `README.md` 压缩要点补「压缩后比原文件还大则自动回退用原文件」。
- `cli.js` 头部注释补压缩回退一句；`spec.md` 追加「压缩回退（ticket 145）」节。

## 4. 同步

- 全局安装副本 `C:\Users\PC\AppData\Roaming\npm\node_modules\@jwbz\bili-downloader\core.js` 与源码哈希一致；
  合并后同步 core.js（及文档）到全局副本，插件 spawn `bili-dl` 即生效。

## 5. 验收

- a) tools `node --test` 全绿（含新单测）；b) bz 侧 tsc + 全量测试 + 构建不回归；
  c) 全局安装副本 core.js 与源码一致。