# 498 · 同步解密段增量修复——父目录 --src 打不中缓存 + 按库指纹增量

## 现象（用户实测）

设置里微信路径补对（`D:\微信备份\xwechat_files`，账号父目录）之后，每次同步都卡在
「解密数据库」数分钟——485 的统计-only 同步本该十秒级。

## 根因（两层）

1. **缓存匹配失效**：vendor 解密缓存第一层按 `source_dir` **精确字符串匹配**
   （decrypt_runner `_cache_matches` / `_same_path`）。key.json 与缓存里存的是
   **账号子目录**（`...\xwechat_files\wxid_xxx`），而插件设置是自然填的**父目录**；
   bz_sync 把 `--src` 原样下传 → 每轮不命中 → 落到手动 key 全量重解密链
   （临时目录整库解密 + 原子替换），分钟级。
2. **缓存永不失效（隐性正确性 bug）**：第一层命中完全不看源库内容——微信写进新消息
   后缓存依旧命中，sync 的统计数据永远停在首次解密那刻。步骤文案「增量：已解密的库
   自动跳过」描述的行为上游其实没实现。

## 修法

### A. bz_sync.decrypt_all —— 账号目录解析

`--src` 没有直接指向账号目录（无 `db_storage` 子目录）且 key.json 的 `source_dir`
存在时，落回 key.json 的账号目录再调解密，缓存匹配恢复命中；显式账号目录仍优先。

### B. vendor 最小偏离（有据可查，ARCHIVE.md 登记）—— 源库指纹 + 按库增量复用

- `decrypt_runner._source_fingerprint()`：源 `db_storage` 逐 `.db` 文件指纹
  （relpath → `[mtime_ns, size]`；不含 -wal/-shm）。
- 第一层缓存命中条件加「指纹段一致」：缓存 JSON 新增 `files` 段；源库有变（新消息）
  → 落回第二层，走增量解密。旧缓存无 `files` 段视为失效，首轮重建（一次全量）后恢复。
- `_dump_v4_with_key`：未变库直接 `copy2` 上次解密产物进临时目录，只把变化的库交给
  `decrypt_db_files`（新增可选 `reuse` 参数 = 跳过重解的 relpath 集合）；全部复用时
  跳过解密调用（key 已在上游校验）。完成后 `files` 指纹段写回缓存。
- 效果：日常收发消息只动 message 等小库，同步解密从分钟级回到秒级，且新消息真实可见。

## 验证

真机探针（.scratch，不改微信源目录）：预置指纹缓存 → 命中秒回；抽掉一枚指纹 →
只重解该库；再跑 → 命中。bz-face 为 npm link 直指仓库，python 改动即时生效，
插件无需重建。
