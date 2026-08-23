# ticket 090 —— H1 动力学：信任回拉 + 90 天仿真门禁（设计确认稿）

状态：**PARKED**（2026-08-24 随 089 搁置：失去里程碑升温来源后，单独做降温会把不聊天用户压向锚点；方向五待重新定义后再议）
父文档：086-intelligence-evolution-proposal.md v4「H1」
日期：2026-08-24

## 一、要修的数学缺陷（红队 A 实测证实）

`trustUpdate` 软收拢 `v = cap + K(v−cap)`（cap=0.85, K=0.85）：
1. 每事件吞 15% 距 cap 距离，不动点 v* = cap + 5.67×gain ≈ 0.87~0.88——线性差量模型全废
2. **v < 0.834 时 erode 分支反而升温**（0.5 一次侵蚀 → 0.550）：既有物理下
   「自然降温」数学上不可能；轻度用户永远爬不上来（周净 −5.31‰）
3. 方向五 v3 的全部天数推算因此作废

## 二、裁决口径

- 降温走 **characterHomeostasis 式独立回拉**：`trust += (anchor − trust) × rate`
- **禁止**过 trustUpdate 的 erode 分支做冷却
- 分级 anchor + 三档利率：0.35 / 0.55 / 0.72 × 0.0008 / 0.0015 / 0.002

## 三、API 设计

```ts
// character.ts 纯函数（与 characterHomeostasis 同风格）
export function trustHomeostasisPull(
  current: number,
  anchor: number,     // 关系档位锚点
  rate: number,       // 日利率（按天调用）
): number {
  return current + (anchor - current) * rate;
}
```

- **档位判定**：复用方向五关系分档（亲密度带）。实现期先给静态映射：
  trust < 0.45 → (0.35, 0.002)；0.45–0.7 → (0.55, 0.0015)；> 0.7 → (0.72, 0.0008)
  （低段快拉防崩、高段慢拉保余温）★设计决策点：分档边界与三对数值是否照抄 v4 原文
- **调用点**：日级调度（onSchedulerTick 钩子已有，判日期变更后每日一次），变异后随当日既有保存落盘
- **erode 分支处置**：trustUpdate 签名不动（兼容），但生产路径不再有「无标记冷处理」调用；
  补一条回归测试锁定「v<0.834 时 erode 不升温」语义由新通道接管

## 四、仿真门禁（合并前必过）

vitest 可跑的确定性仿真（种子随机，秒级完成）：

```
3 画像 × 3 密度 × 90 天：
  重度（日均 talk 8 + milestone 2）/ 中度（talk 2 + milestone 0.5）/ 轻度（talk 0.2，milestone 0.05）
断言：
  A. 轻度 90 天净变化 ≥ −0.02（无死亡螺旋；旧物理下为负且爬不回来）
  B. 重度 plateau ≤ 0.87（cap+余温语义，不撞 0.999）
  C. 中度收敛到 anchor ± 0.05 带
  D. 停用期 30 天：trust 向 anchor 回落但不跌破 anchor − 0.05
  E. erode 升温回归锁：v=0.5 过旧分支必须仍 ≥ 0.5（文档化已知怪癖）或直接禁用
```

- 仿真器放 tests/smartcat/dynamics-sim.test.ts，纯函数驱动、无 IO

## 五、测试要求

- trustHomeostasisPull 单测：方向（双向回拉）、速率、边界钳制 [0.05, 0.999]
- 档位映射表测试
- 仿真五断言全绿
- 既有 mood/character 测试全量保留

## 六、开放问题（用户拍板）

1. 三对（anchor, rate）数值照抄 v4 还是要调？（本稿默认照抄）
2. 档位边界 0.45/0.7 是否合适？
3. 每日回拉 vs 每事件回拉：本稿选**每日一次**（事件级会与 softUpdate 升温互相打架）——确认？