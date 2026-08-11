# 39 — 黑匣子 schema v2 扩展 + v1 数据迁移

**What to build:** blackbox.json 从 v1 升为 v2（版本化扩展，符合 ADR-0013「版本化扩展而非改字段」）：数据层支持三类条目（概念/文献/想法）、人物画像、事件、可编辑情绪词表；**存量 v1 数据无损迁移**——用户已录入的感触在升级后一条不丢、语义不丢。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

## 关键决策：v1 → v2 迁移映射（决策密集，spec 同步）

```jsonc
// version: 1 → 2
// impressions[] → entries[]（type='thought'），逐条映射：
{
  "id": "bb_xxx",                       // 原样
  "ts": "ISO",                          // 原样
  "type": "thought",                    // v1 条目全部归为核心知识
  "text": "<material>\n\n<feeling>",    // 素材+感受合并（用户已确认），语义不丢
  "emotions": ["想念", "难过"],          // [{tag,intensity}] → string[]，强度丢弃（用户决策去强度）
  "people": ["妹妹", "妈妈"],            // string → string[]：按顿号/中英文逗号/空格拆分非空段（v1 为单行自由文本）
  "scene": "", "toward": "",           // 原样
  "links": ["https://…", "[[笔记]]"]     // v1 为逗号分隔多链接字符串 → 数组（原样拆分保留，不丢多链接）
}
// persona / reviews / chat：原样保留（chat 滚动裁剪语义不变）
// 新增：
//   settings: { words: 24词预置, reviewThreshold: 10(兜底，读取优先全局设置), showSpeculativeEvents: true }
//   profiles: []（画像）
//   events: []（事件）
// v1 normalize 校验（material/feeling 必填）退役，v2 normalize 按新结构；load 时 version===1 走迁移，save 写 v2
```

## 验收标准

- [ ] blackbox.json v1 文件加载后自动迁移为 v2，persona/reviews/chat 无损，impressions 全部成为 type='thought' 的 entries，text 含素材+感受、emotions 为去强度词表、people 为数组
- [ ] 迁移幂等：迁移后再次加载不再重复迁移（version 已为 2）；空库/坏 JSON 行为与 v1 一致（默认数据 + .bak 备份）
- [ ] 新结构 normalize 容错：三类条目（concept/literature/thought）各自必填校验；profiles/events/settings 非法字段回退默认
- [ ] 纯函数：词表去重/限长、people 上限 5、emotions 上限 3 校验；settings.words 增删不影响存量条目 emotions
- [ ] 数据层测试覆盖迁移映射全部字段；既有 v1 数据层测试改为 v2 语义后全绿

## 引用

- ADR-0013（v1 冻结 + 版本化扩展路径）、ADR-0014（平行流）
- `.scratch/blackbox-suite-plugin/spec.md`「数据格式」节
