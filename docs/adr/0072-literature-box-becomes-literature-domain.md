# 文献盒迁出为独立 literature 域，数据收拢 literature.json

文献盒从 bili-downloader 域迁出为**独立域 `literature`**（src/literature）：命令改名（`bz-bili-tasks-open` → `bz-literature-open`，新增 `bz-literature-note-term`，删除 `bz-bili-open`），`core/path-classify` 新增 `'literature'` 域按文献目录匹配，域事件通道 `'bili-tasks'` → `'literature:tasks'`，smartcat 行为流观察收敛为「视频转文献成功 + 术语生成成功」两类（移除 added/parsed）。**数据收拢为 `CONFIG/STORAGE/literature.json` 单一文件**（视频任务沿用既有结构，术语生成不留任务记录）；旧 `bili-tasks.json` **不迁移、不做兼容**（用户拍板）。理由：域职责与命令命名对齐「文献盒」实际语义（域已不只是视频转文献），单一数据文件便于统一管理。取舍：备选「保留 bili-tasks.json 文件名/写迁移」会增加兼容面与迁移成本，弃用。
