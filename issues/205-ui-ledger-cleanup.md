# issue 205：延后台账执行——diary-wall 收口 / uiPopover 输入锚定 / 浮层 sheet 收敛 / token 化

来源：issue 195 延后台账。四个并行批次：
- A：diary-wall 右键菜单迁 item-actions、详情抽屉 → .bz-sheet、壳/头行/搜索接入；bookshelf 筛选抽屉 → .bz-sheet
- B：联想收敛裁决——master 已并行落地 uiSuggest（issue 203），favorites/belongings 取 uiSuggest 方案，uiPopover 输入锚定模式撤销（避免双 API）；只保留各域右键菜单残余 click 复位补丁
- C：recap 头行、checkup 壳接入共享
- D：review 头行接入 + review/encrypt 全面 token 化

验收：各域测试绿 + 全量门禁绿 + tsc 干净；行为零回退；视觉仅向共享基线归一。
