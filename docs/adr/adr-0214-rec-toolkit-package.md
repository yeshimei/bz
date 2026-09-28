# ADR-0214 · 录音分离脚本收编 bz-face 包（rec / refs 子命令与质心随数据根）

日期：2026-09-29 · 状态：已采纳 · 关联：ADR-0212（补充素材入口）、ADR-0213（录音分离管线）、issue 509

## 背景

ADR-0213 拍板管线时，方案 C 脚本（`rec_slide_hmm.py` / `voiceprint_refs.py`）以校准期
形态直接住在数据根 `tools/`（真值校准就在那里跑的），插件 spawn 直指数据根路径。实施
509 后暴露三点：① 脚本无版本控制、随数据根漂移；② 插件侧路径依赖「数据根父目录下有
`tools/`」的布局假设（peopleDataDir = …/export_full 的既定现状），换机器 / 换布局即断；
③ 分离转写与包内 prep 的语音转写同为一个 funasr 环境，却分居两处——**本身就是一体的
功能**（用户拍板），应该同包分发。

## 决策

1. **收编进 `@jwbz/obsidian-face` v0.4**：`python/bz_rec.py`（分离 + 逐轮转写）与
   `python/bz_refs.py`（质心构建）——管线逻辑零改动照搬（phase 账本 / 降级阶梯 / 情感
   众数），只参数化路径：`--data-root / --contact / --file`，不再假设 `export_full`
   目录名与脚本旁 `voiceprints/`。
2. **CLI**：`bz-face rec <录音文件名> --data-root … --contact …`、
   `bz-face refs --data-root … --contact …`（可重复）。**进度权威仍在 sidecar**
   （ADR-0212 拍板的 UI 轮询口径不变），rec / refs 不走四行协议中继——`lib/rec-core.js`
   只做参数解析与预检（数据根可写、联系人目录 / 录音在位；**缺质心不拦**，降级阶梯照跑），
   stdout 逐行透传仅供人看。
3. **质心产物随数据根走**：`<数据根>/voiceprints/<联系人>.npz`（原数据根父目录
   `tools/voiceprints/` 的既有 npz 一次性迁入）。解除布局假设后，质心与 recordings / desc
   一样是数据根内聚的派生数据。
4. **数据根旧脚本保留作校准基准**：`rec_groundtruth.py` 按文件名调用三个方案脚本做真值
   比对，直接删会断校准链——原文件加退役注记（不再被插件引用），`tools/voiceprints/`
   旧目录留给校准环境。
5. **插件侧切 bz-face 口径**：`buildRecordingSpec / buildVoiceprintSpec` 组装
   `bz-face rec / refs`（同 prep：路径参数包引号、`--python` 下发 pythonPath 设置值）；
   `voiceprintRefPath` 改读 `<数据根>/voiceprints/`；数据根脚本路径拼接函数退役。

## 后果

- 脚本获得版本控制与随包分发；bz-face 的转写组依赖（funasr 连带 torch / librosa）即
  rec / refs 的全部依赖，doctor 自检面不变。
- 已建质心需迁移一次（已做）；换数据根时 `voiceprints/` 随目录整体搬。
- 数据根 `tools/` 回归纯校准环境（真值脚本 + gt 资产），不再承载产品管线。
