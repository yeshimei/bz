# ADR-0292：bz reader 安装单飞，安装/更新/无动作三态单源

- 状态：已采纳
- 日期：2026-11-06
- 相关：ADR-0269（资源地址与通道顺序）、ADR-0289（数据文件存在性问盘）

## 背景

bz reader 有三处安装/更新入口：

1. 引导页检测屏的插件行（`core/setup-wizard`）；
2. 设置面板「插件」组（`settings-panel/plugin-resources`）；
3. 启动链的自动更新（`autoUpdateReaderPlugin`）。

三处各自维护 `busy`，彼此不知道对方在装。启动自动更新还在下载时用户点「更新」，
两个协程会同时写同一个 `.bz-tmp` 和三件套，版本互相覆盖，最后回读核对报
「安装后版本对不上」（2026-11-06 review P1）。

同一个 review 还指出：三处各写了一套「已安装 / 需更新 / 半装」判断（`needInstall` /
`actionVisible` / `hasKnownUpdate` / `missing`），结论一致时看不出问题，
改一处忘另两处就会出现「已装却提示更新」这类自相矛盾的界面。

另有一处隐患：GitHub 通道把 `manifest.version` 直接当 tag 拼资产地址
（`releases/download/<version>/main.js`）。bz-reader 现在 tag 恰好等于版本（`0.2.0`），
一旦改成 `v0.2.0` 这类带前缀写法，GitHub 资产全 404、静默退到码云单通道。

## 决策

**1. `installReaderPlugin` 单飞（in-flight 复用）。**

模块级 `installInFlight`：已有安装在进行时，后到调用直接返回同一个 promise，
不重复下载、不交错写盘。代价是复用者自己的 `onStage` 收不到进度（它的界面停在
「安装中…」直到完成）——比写坏好。

**2. 三态判定收成单源。**

```ts
isReaderHealthy(state)                  // 装好且可用（未装/半装都不算）
readerActionOf(state, latest)           // 'install' | 'update' | 'none'
```

引导页的按钮显隐、设置面板的行动作、向导完成屏的缺件判定全部引用这两个函数。
最新版未知（未查到 / 查询失败）一律按 `none` 算——不替用户猜有新版。
设置面板「全部更新」仍保留「未查过也可点」的重试入口，但判断基于 `readerActionOf`
而不是自己再算一遍版本。

**3. GitHub 资产走免 tag 别名。**

清单与两件套都从 `releases/latest/download/` 取（与 `manifest.json` 同源），
tag 命名规则以后怎么变都不会 404。码云没有 latest 别名，仍按 API 给的 tag 拼。

## 测试

`tests/core/reader-install.test.ts`：

- 并发两次 `installReaderPlugin`：只下载一次 `main.js`、两次结果相同；
- `readerActionOf` 四态（未装/半装/已最新/有新版）与 `isReaderHealthy`；
- 安装用例的 GitHub 资产地址改为 latest 别名（tag 前缀变化不再影响）。
