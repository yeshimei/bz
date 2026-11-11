# 支持者名单（在线数据）

`docs/patrons.json` 是 bz 与 bz Reader 两个插件「支持作者」弹窗共用的**唯一名单源**。
2026-11-11 之前名单写在两个仓库的代码常量里，每加一位都要发两版；现在只改这一个文件。

## 文件形状

```json
{
  "version": 1,
  "updatedAt": "2026-11-11",
  "patrons": [
    { "name": "沁弦", "amount": 6.66, "date": "2026-11-11", "message": "照登，可省略" },
    { "name": "面包", "amount": "patron", "date": "2026-11-10" }
  ]
}
```

| 字段 | 规则 |
|---|---|
| `version` | 固定 `1`（将来换结构才动） |
| `updatedAt` | 最后一次改动日期 `YYYY-MM-DD` |
| `patrons` | **时间倒序**；同一天新的排前面 |
| `name` | 昵称原样，去首尾空白，1–40 字 |
| `amount` | 数字 = 微信赞赏码收到的金额（元）；`"patron"` = 赞助商店那条路 |
| `date` | `YYYY-MM-DD` |
| `message` | 可省略；最长 120 字，换行会被压成空格 |

解析端对每条做白名单校验：坏一条丢一条，不整份失败；`patrons` 不是数组才视为整份不可用。
排序由客户端按 `date` 倒序重排（同日保持文件顺序），所以手改时顺序反了也能救回来。

## 两个插件从哪里读

```
GitHub  https://raw.githubusercontent.com/yeshimei/bz/master/docs/patrons.json
码云    https://gitee.com/ntbl/bz/raw/master/docs/patrons.json
```

- 两个地址**并发**请求，谁先回、内容合法就用谁；单请求 8 秒封顶。
- 请求走 Obsidian 自带网络栈（码云 raw 不给跨域头，浏览器 `fetch` 会失败）。
- URL 带 `?t=<时间戳>` 绕 CDN 缓存（GitHub raw 5 分钟、码云 raw 60 秒）。
- 本机缓存 6 小时；打开弹窗时后台校验一次（60 秒内不重复请求）。
- 首次安装且两个源都不通：显示空态 + 重试，不内置任何名单内容。

## 怎么加一位

```powershell
node scripts/patron-add.mjs --name 沁弦 --amount 6.66 --date 2026-11-11 --message "留言"
```

- `--amount patron` 表示赞助商店那条路（显示「赞助人」）。
- `--date` 省略取今天；`--message` 省略就不写这条字段。
- 脚本负责校验、插到正确位置、写回、`git add` + `git commit`；默认再 `git push origin`
  （bz 的 origin 同时推 GitHub 与码云）。`--no-push` 只提交不推，`--dry-run` 只打印。
- 生效时间：推送后码云 60 秒内、GitHub 5 分钟内；插件带破缓存参数，实际下一次打开弹窗就能看到。

也可以直接在 GitHub 网页编辑这个文件（手机上也能改），提交即生效，但记得保持倒序与合法金额。

## 旧版本怎么办

旧版插件代码里仍带着自己那份内置名单，不会读在线文件——它们停在发版那一刻，无法也不该
远程改。新版不再内置名单内容，只保留本机缓存。
