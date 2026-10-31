# ADR-0277 · 分发主通道切换 GitHub Release + 皮肤整包快路

日期：2026-10-31 · 状态：已采纳（同日实现合入 master）

## 背景

分发一直只有两条通道：`raw.githubusercontent.com`（主）与 jsDelivr（备）。前者**零统计**——多少人装了、多少人更新了，完全不可见；后者有统计但只有个位数量级（上线两天的实测：`version.json` 88 次命中、本体下载 2 次）。同时 26 个皮肤 CSS 逐文件分发，新装机用户要点 26 次下载。

## 决策

1. **GitHub Release 资产升为主下载通道**（`https://github.com/yeshimei/bz/releases/download/<tag>/<path>`），raw/jsDelivr 整链降为兜底。选它的理由：
   - **自带精确下载计数**（`download_count`）——三条通道里唯一能回答「多少人装了」的；
   - **按 tag 冻结**：资产是打 tag 那一刻的字节，清单与产物永远同版，天然消灭 `@master` 快照「清单新、正文旧」一类事故（ADR-0269 时代的翻车点）；
   - 资产名允许带斜杠，`downloads/**` 逐字平铺上传，客户端 URL 拼法不分叉。
2. **tag 解析只走缓存，不发网络**：self-update 拉到发布指针后经 `noteReleaseTag` 回填（localStorage，TTL 24h）；缓存缺席时通道链退化为旧版形态。资源下载永远不因新通道多出一跳网络。
3. **皮肤整包快路**：清单新增可选 `skinsPack{file,sha256,size}`（`downloads/skins.zip`，deflate-raw，时间字段固定 0 出确定字节）。客户端一次下载替代最多 26 次逐文件请求；归档 sha（字节口径）+ 逐条目 sha（文本归一口径）双层校验，**全部通过才落盘**，任何一步失败整体回落逐文件——半套状态不存在。
4. **schema 只增不改**：`skinsPack` 是可选字段，旧客户端读新清单忽略之，走原逐文件路径。未来对清单的任何演进必须守住这条，删字段 = 弃旧客户端。
5. **二进制 IO 归口**：Release 通道下的二进制取数（本地归档缓存 → 离线包 → 通道链）收进 `bundle-asset.ts`（`fetchArchiveBytes` 通用出口），`remote-asset` 保持纯文本层——D3 直写守卫的 `writeBinary` 白名单面不变。

## 后果

- 正面：从下一次发布起，Release 页的下载计数就是可用的用户量信号（整包/离线包/三件套各自独立计数）；新装机皮肤下载 26 次 → 1 次；清单混版事故面收窄。
- 代价：Release 上传是发布流程新的一步（`push-assets` 自动尝试，tag 未打时 `--upload-only` 补跑；失败不影响旧通道，但该版本拿不到计数）。
- 仍不可见：raw 通道的用户（BRAT 等工具走 clone/raw）依旧零统计；真实活跃率仍需埋点才能回答。

## 补记（2026-10-31 同日拍板：raw 整体退场，升级为「Release 主 / jsDelivr 备」两层）

Release 通道上线当天即升为主通道：`REPO_BASES` 删掉 raw 基址，master 快照（发布指针、在线资源、
`releases/<tag>/` 镜像）只走 jsDelivr 四边缘；全部下载链 = Release 资产（tag 已知时）在前，
jsDelivr 兜底。理由：raw 在国内裸网基本恒死，每个用户都要白等一次 8s 超时才开始真正下载；
它唯一的优势「无缓存、最新鲜」由两条腿补上——① Release 资产按 tag 冻结（本来就不存在缓存陈旧
问题）；② 指针拉取加破缓存参数（`?t=` 换缓存键强制回源）。HTML 的 gh-proxy 反代兜底保留
（jsDelivr 对 .html 一律 301 到 raw，反代仍以 raw 为源，不受客户端通道调整影响）。环境自检
（env-check/probeNetwork）改为探 GitHub 仓库页（Release 下载同域；tag 未知时探真资产只会 404，
404 是「文件不在」不是「通道不通」）+ jsDelivr 最快边缘，引导页行文案改「GitHub 主通道 /
备用通道 · jsDelivr」。Release 资产不再逐个上传皮肤 css（只发 skins.zip）：旧客户端不认识
Release 通道（走镜像，照旧），新客户端走 skinsPack，逐文件回落时 Release 404 只是换源。
