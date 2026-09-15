/**
 * 知识盒行为单源 · sim 启动入口（issue 259，范式随 settings-panel/ADR-0106）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（vault = localStorage 文件系统；metadataCache 现解析
 *     frontmatter；workspace.openFile / openUrl 走壳事件与新标签）；
 *   - 种子数据：文献盒（视频 CBTI + 术语 既视感/昼夜节律/松果体，含 source/sourceTitle
 *     与 related 互链样例）+ 卡片盒三张 + 主题盒一篇 + 心流体验笔记（内部来源联想目标）；
 *     另有**挂载树语料**一整套（SEED_MOUNT_NOTES/LITERATURE/MEDIA，见下）——
 *     首启写入 fake vault（有种子标记不覆盖，评审壳内编辑可持久）；
 *   - 设置注入：setSettingsProvider（知识盒目录三键 + 视频工具键，与插件 data.json 同形）；
 *   - AI：fake requestUrl 罐头回放（术语生成/总结/领域判定可真跑演示级结果）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_knowledge，评审壳只调 boot + openPanel/openTerm。
 * 插件的 ui.ts / note-gen.ts / data.ts / source.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { AI_INDEX } from './fake/ai-index';
import { setApp } from '../../src/core/app';
import { setLinkBridge } from '../../src/core/link-now';
import { setVectorSearchSource } from '../../src/secondbrain/readonly';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider } from '../../src/core/ai';
import { KnowledgeData } from '../../src/knowledge/data';
import { UIManager } from '../../src/knowledge/ui';
import * as mountCanvas from '../../src/knowledge/mount-canvas';

const SEED_MARKER = 'bz-sim:__kb_seed_v3';
const key = (path: string): string => `bz-sim:${path}`;

/**
 * 影像任务种子（issue 310）：让「处理」与「历史」两个界面在评审壳里有真数据——
 * 一行处理中（带步骤文案）/ 两行待处理（一行信息齐备、一行只有链接走打开面板自动重抓）/
 * 一行失败（带原因）+ 三条已归档（两条同链接 = 历史分组）。
 * 状态口径同 ADR-0067：主列表只含 待处理 / 处理中 / 失败，成功即归档进历史。
 */
const SEED_TASKS: Array<Record<string, unknown>> = [
  {
    id: 'kb-demo-processing',
    url: 'https://www.bilibili.com/video/BV1awbg6XELn/',
    start: '00:00:00', end: '00:12:00',
    status: 'processing',
    reason: 'AI 生成文献笔记中',
    remark: null,
    notePath: null, videoPath: null,
    created: '2026-09-13 21:40:12', processedAt: null,
    title: 'CBTI：告别失眠的认知行为疗法', uploader: '演示 UP 主',
    archived: false, archivedAt: null,
    quality: '1080', page: 1, duration: 720,
  },
  {
    id: 'kb-demo-pending-info',
    url: 'https://www.bilibili.com/video/BV1mepartial01/',
    start: '00:01:30', end: '00:04:00',
    status: 'pending',
    reason: null, remark: '睡前看的那期',
    notePath: null, videoPath: null,
    created: '2026-09-13 22:05:40', processedAt: null,
    title: '（演示）多 P 视频 · 只看中集片段', uploader: '演示 UP 主',
    archived: false, archivedAt: null,
    quality: '720', page: 2, duration: 600,
  },
  {
    id: 'kb-demo-pending-bare',
    url: 'https://www.bilibili.com/video/BV1nometadata/',
    start: null, end: null,
    status: 'pending',
    reason: null, remark: null,
    notePath: null, videoPath: null,
    created: '2026-09-14 08:02:11', processedAt: null,
    title: null, uploader: null,
    archived: false, archivedAt: null,
    quality: null, page: null, duration: null,
  },
  {
    id: 'kb-demo-failed',
    url: 'https://www.bilibili.com/video/BV1failcase01/',
    start: null, end: null,
    status: 'failed',
    reason: 'yt-dlp 下载失败：HTTP Error 403 Forbidden（示例原因，评审壳不真跑管线）',
    remark: null,
    notePath: null, videoPath: null,
    created: '2026-09-13 19:20:00', processedAt: '2026-09-13 19:21:35',
    title: '（演示）一条失败的任务', uploader: '演示 UP 主',
    archived: false, archivedAt: null,
    quality: null, page: null, duration: 1800,
  },
  {
    id: 'kb-demo-arch-1',
    url: 'https://www.bilibili.com/video/BV1awbg6XELn/',
    start: null, end: null,
    status: 'success',
    reason: null, remark: null,
    notePath: '文献盒/CBTI.md', videoPath: 'CONFIG/APPENDIX/CBTI演示.mp4',
    created: '2026-09-04 07:40:00', processedAt: '2026-09-04 07:47:38',
    title: 'CBTI：告别失眠的认知行为疗法', uploader: '演示 UP 主',
    archived: true, archivedAt: '2026-09-04 07:47:38',
    quality: 'highest', page: null, duration: 1800,
  },
  {
    id: 'kb-demo-arch-2',
    url: 'https://www.bilibili.com/video/BV1awbg6XELn/',
    start: '00:12:00', end: '00:20:00',
    status: 'success',
    reason: null, remark: null,
    notePath: '文献盒/CBTI 睡眠限制一节.md', videoPath: 'CONFIG/APPENDIX/CBTI-切片.mp4',
    created: '2026-09-10 22:30:00', processedAt: '2026-09-10 22:41:07',
    title: 'CBTI：告别失眠的认知行为疗法', uploader: '演示 UP 主',
    archived: true, archivedAt: '2026-09-10 22:41:07',
    quality: '1080', page: null, duration: 1800,
  },
  {
    id: 'kb-demo-arch-3',
    url: 'https://www.bilibili.com/video/BV1sleepless9/',
    start: null, end: null,
    status: 'success',
    reason: null, remark: null,
    notePath: '文献盒/昼夜节律.md', videoPath: 'CONFIG/APPENDIX/昼夜节律.mp4',
    created: '2026-09-03 21:00:00', processedAt: '2026-09-03 21:10:00',
    title: '（演示）昼夜节律与睡眠', uploader: '另一演示 UP 主',
    archived: true, archivedAt: '2026-09-03 21:10:00',
    quality: '720', page: null, duration: 900,
  },
];

/** 种子笔记（文献目录词典行 + 关联互链 + 来源样例；ctime 控制部壹排序，新→旧） */
const SEED_NOTES: Array<{ path: string; ctime: number; content: string }> = [
  {
    path: '文献盒/CBTI.md',
    ctime: Date.parse('2026-09-04T07:47:38'),
    content: `---
title: "CBTI 即针对失眠的认知行为疗法"
tags:
  - "睡眠"
  - "心理学"
summary: "非药物治疗失眠的循证心理干预，重建健康睡眠模式。"
url: "https://www.bilibili.com/video/BV1awbg6XELn/"
date: "2026-09-04 07:47:38"
author: "演示 UP 主"
videoTitle: "CBTI：告别失眠的认知行为疗法"
type: video
domain: "心理"
related:
  - "[[卡片盒/多重记忆系统|多重记忆系统]]"
  - "[[卡片盒/认知行为疗法|认知行为疗法]]"
---

CBTI 即针对失眠的认知行为疗法，是一种非药物治疗失眠的循证心理干预方法。其核心观点认为：失眠的持续与**不良的睡眠认知和行为习惯**密切相关，通过改变这些因素来重建健康的睡眠模式。

## 核心模块

- **睡眠限制**——压缩卧床时间，提高睡眠效率
- **刺激控制**——把床留给睡眠
- 认知重构、放松训练与睡眠卫生教育

> 大量临床研究证实：CBTI 对慢性失眠具有显著且持久的疗效，被国际指南推荐为成人慢性失眠的一线治疗。

![[CONFIG/APPENDIX/CBTI演示.mp4]]`,
  },
  {
    path: '文献盒/既视感.md',
    ctime: Date.parse('2026-09-04T07:00:00'),
    content: `---
title: "既视感"
type: term
domain: "心理"
term: "既视感"
date: "2026-09-04 07:47:38"
---

既视感，又称"似曾相识感"，指经历全新情境时产生的主观熟悉感，仿佛此事曾发生过，实为大脑信息处理中的错觉。它与颞叶活动异常、识别与记忆系统短暂错位有关，在疲劳、压力大时更常见，也可能是癫痫等神经系统疾病的前兆。`,
  },
  {
    path: '文献盒/昼夜节律.md',
    ctime: Date.parse('2026-09-03T21:10:00'),
    content: `---
title: "昼夜节律"
type: term
domain: "心理"
term: "昼夜节律"
date: "2026-09-03 21:10:00"
source: "https://zhuanlan.zhihu.com/p/12345678"
sourceTitle: "什么是昼夜节律"
---

生物体以约 24 小时为周期的内在计时机制，由视交叉上核主导，调控睡眠-觉醒、体温与激素分泌；光照是最强的同步因子。`,
  },
  {
    path: '文献盒/松果体.md',
    ctime: Date.parse('2026-08-28T10:00:00'),
    content: `---
title: "松果体"
type: term
domain: "医学"
term: "松果体"
date: "2026-08-28 10:00:00"
---

松果体是大脑内豌豆大小的内分泌腺，夜间分泌褪黑素，把光照信息转译为激素信号，是睡眠-觉醒节律的激素执行器。`,
  },
  {
    path: '卡片盒/多重记忆系统.md',
    ctime: Date.parse('2026-09-05T09:00:00'),
    content: `---
tags: []
category: "心理"
related:
  - "[[文献盒/CBTI.md|CBTI]]"
date: "2026-09-05 09:00:00"
---

多重记忆系统：陈述性与程序性记忆分属不同系统。与 CBTI 关联——睡眠结构对记忆巩固的影响是这条连接的解释。`,
  },
  {
    path: '卡片盒/认知行为疗法.md',
    ctime: Date.parse('2026-09-05T08:30:00'),
    content: `---
tags: []
category: "心理"
related:
  - "[[文献盒/CBTI.md|CBTI]]"
date: "2026-09-05 08:30:00"
---

认知行为疗法：通过改变认知与行为模式干预心理问题。CBTI 是其在失眠域的具体形态。`,
  },
  {
    path: '卡片盒/间隔重复.md',
    ctime: Date.parse('2026-09-01T12:00:00'),
    content: `---
tags: []
category: "学习"
related: []
date: "2026-09-01 12:00:00"
---

间隔重复：按遗忘曲线安排复习间隔，用检索 effort 换长期保持。`,
  },
  {
    path: '主题盒/认知觉醒.md',
    ctime: Date.parse('2026-08-20T09:00:00'),
    content: `# 认知觉醒

大脑的本能脑、情绪脑与理智脑三层结构……（主题笔记就是普通笔记，自己写自己组织。）`,
  },
  {
    path: '我的/读书笔记/心流体验.md',
    ctime: Date.parse('2026-08-15T09:00:00'),
    content: `# 心流体验

心流（flow）：全情投入、忘却时间的最优体验状态——术语录入「内部笔记来源」的联想目标。`,
  },
];

/**
 * 挂载树语料（2026-09-15 重写，照真库写法）：主题 = 睡眠科学。
 * 风格对齐真实卡片盒：卡片 = 一句描述 + `## 小节`，**双链融在句子里**（不写链接清单）；
 * 文献 = frontmatter（title/type/domain/date + related） + 一段百科式长文。
 * 覆盖挂载树要看的口径：主干双链 / 同名文献吸附（睡眠结构 · 慢波睡眠 · 睡眠纺锤波 三对） /
 * 文献小节与文献段落（head、para 两类节点）/ 图与视频两类 / 环（睡眠纺锤波 ↔ 丘脑） /
 * 孤儿卡（睡眠卫生：无入链无出链）/ 断链（[[晨间光照方案]]）。
 * AI 建议演示（2026-09-15）另配 `SEED_AI_INDEX` 语料，见下。
 */
const SEED_MOUNT_NOTES: Array<{ path: string; ctime: number; content: string }> = [
  {
    path: '卡片盒/睡眠结构.md',
    ctime: Date.parse('2026-09-12T21:10:00'),
    content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 睡眠结构是一夜里各睡眠阶段的组成与轮转：非快速眼动与快速眼动交替，约九十分钟一个周期。)

## 分期

- N1/N2 是浅睡，[[睡眠纺锤波]] 出现在 N2
- N3 又叫 [[慢波睡眠]]，高幅 delta 波占两成以上
- [[快速眼动睡眠]] 眼球快速转动、肌张力消失，梦多在这一段

## 一夜的周期

成年人一夜走四到六个周期。深睡集中在头两个周期，管体力恢复；快速眼动在后半程补量，跟 [[记忆巩固]] 的关系更紧一些。

什么时候想睡由 [[昼夜节律]] 定，有多想睡由睡眠压定，两套机制叠起来才是困意曲线。

![[CONFIG/APPENDIX/CBTI演示.mp4]]

早上晒光这一节我一直没整理成卡，先记一笔 [[晨间光照方案]]。`,
  },
  {
    path: '卡片盒/慢波睡眠.md',
    ctime: Date.parse('2026-09-12T20:40:00'),
    content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 慢波睡眠（N3）即深睡，脑电以高幅低频的 delta 波为主，生长激素在这一段脉冲式分泌。)

深睡与 [[快速眼动睡眠]] 的分工不可互相替代：砍掉深睡第二天会累，砍掉快速眼动会「心里发空」。

它跟 [[记忆巩固]] 的接口在海马：慢波期的尖波涟漪把白天的经历反复重放。

深睡占比随年龄掉得很快——二十岁前后约两成，六十岁后常不足一成，这就是「年纪大了觉变浅」的生理来源。

![[文献盒/assets/睡眠周期图.png]]`,
  },
  {
    path: '卡片盒/快速眼动睡眠.md',
    ctime: Date.parse('2026-09-12T20:10:00'),
    content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 快速眼动睡眠（REM）眼球快速转动、肌张力几乎消失，脑电接近清醒但人不易被叫醒。)

它的时长在后半夜显著拉长，所以熬夜被砍掉的大多是这一段，情绪加工与联想的损失比「少睡几小时」更大。

与 [[记忆巩固]]、[[慢波睡眠]] 不是一回事：那一套管陈述性记忆，这一套管情绪与模式的重新组合。

失眠的人为什么总说「睡了一夜比没睡还累」，可以对着 [[文献盒/CBTI#核心模块|CBTI · 核心模块]] 里的几条看。`,
  },
  {
    path: '卡片盒/记忆巩固.md',
    ctime: Date.parse('2026-09-09T21:30:00'),
    content: `---
tags: [学习, 睡眠]
category: 学习
---
(描述:: 记忆巩固是新记忆先在海马快速编码，再在睡眠里被重放、逐步转写到皮层长时记忆的过程。)

慢波期的重放效率最高，所以「睡够」对考试周比「再刷一套」更值钱，这也正是 [[间隔重复]] 安排复习间隔的生理依据。

侧写见 [[卡片盒/多重记忆系统]]，失眠侧的代价见 [[文献盒/睡眠结构#^bz-3f7a1c02|睡眠结构 · 深睡那段]]。`,
  },
  {
    path: '卡片盒/睡眠纺锤波.md',
    ctime: Date.parse('2026-09-11T22:30:00'),
    content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 睡眠纺锤波是 N2 期 11–16 Hz 的成串脑电，由丘脑网状核与丘脑皮层回路往复产生，一夜可上万次。)

纺锤波密度高的人更抗噪：它把外界声音关在 [[丘脑]] 门外，是「感觉门控」的睡眠版本。

生成回路和激素背景都不是孤立现象，跟 [[文献盒/松果体]] 那条夜间通路合起来看更清楚。`,
  },
  {
    path: '卡片盒/丘脑.md',
    ctime: Date.parse('2026-09-11T22:00:00'),
    content: `---
tags: [神经科学]
category: 医学
---
(描述:: 丘脑是除嗅觉外所有感觉通往皮层的中继站，也是睡眠与觉醒的开关。)

觉醒时它放大输入，N3 时切换成节律性爆发把输入挡在门外——[[睡眠纺锤波]] 就是这套开关在 N2 期的产物。

所以「睡觉时听不见」不是耳朵关机，是中继站下班了。`,
  },
  {
    path: '卡片盒/睡眠卫生.md',
    ctime: Date.parse('2026-09-02T21:00:00'),
    content: `---
tags: [睡眠]
category: 医学
---
固定作息、睡前减光、卧室只留睡眠功能、下午后不碰咖啡因——听上去都对，落地时大多数人只做到第一条。`,
  },
];

/** 文献盒语料：前三条与卡片同名（挂载树里吸附在卡片下方、不拉线），后两条是 AI 建议的邻居候选 */
const SEED_MOUNT_LITERATURE: Array<{ path: string; ctime: number; content: string }> = [
  {
    path: '文献盒/睡眠结构.md',
    ctime: Date.parse('2026-09-12T21:20:00'),
    content: `---
title: 睡眠结构
type: term
domain: 医学
term: 睡眠结构
date: 2026-09-12 21:20:00
related:
  - "[[卡片盒/睡眠结构]]"
---

睡眠结构指一夜里各睡眠阶段的组成与轮转顺序。非快速眼动睡眠（NREM）分 N1、N2、N3 三期，其中 N3 又称慢波睡眠，脑电以高幅低频 delta 波为主，生长激素分泌高峰落在这里；快速眼动睡眠（REM）眼球快速转动、肌张力几乎消失，脑电接近清醒状态。一个完整周期约九十分钟，成人一夜经历四到六个周期，深睡集中在前半程，REM 在后半程逐渐拉长。睡眠结构的判读依赖多导睡眠图，脑电、眼动、肌电与呼吸信号同步记录，可用于评估睡眠效率、入睡潜伏期与睡眠呼吸暂停。随年龄增长，深睡比例下降、夜间觉醒增多，是老年睡眠变浅的主要来源。

## 功能分工

深睡承担体力恢复与突触下调，REM 承担情绪加工与部分记忆整合，两者不能互相替代。睡眠限制疗法与刺激控制都以「先压缩卧床时间、再让睡眠压把效率顶回来」为操作核心。

被砍掉深睡的人第二天更困、更怕冷，被砍掉 REM 的人则更容易烦躁、注意力涣散。 ^bz-3f7a1c02

结构的时相由昼夜节律系统定，深度由睡眠稳态（睡眠压）定，两者叠加才构成完整的困意曲线。`,
  },
  {
    path: '文献盒/慢波睡眠.md',
    ctime: Date.parse('2026-09-12T20:50:00'),
    content: `---
title: 慢波睡眠
type: term
domain: 医学
term: 慢波睡眠
date: 2026-09-12 20:50:00
related:
  - "[[卡片盒/慢波睡眠]]"
---

慢波睡眠是深度非快速眼动睡眠，脑电以 0.5–4 Hz 的高幅 delta 波为主，占整夜睡眠的一到两成。它由丘脑皮层回路的同步化放电产生，生长激素在此期脉冲式分泌，组织修复与免疫调节集中发生。慢波睡眠集中在入睡后的前两个周期，后半夜快速眼动睡眠占比上升，因此熬夜最先牺牲的是深睡。慢波活动的功率可作为睡眠压的生理指标：清醒越久，入睡后的慢波活动越高，随夜衰减越快。深睡不足与代谢紊乱、免疫力下降相关，也直接影响陈述性记忆的隔夜巩固效果。`,
  },
  {
    path: '文献盒/睡眠纺锤波.md',
    ctime: Date.parse('2026-09-11T22:40:00'),
    content: `---
title: 睡眠纺锤波
type: term
domain: 医学
term: 睡眠纺锤波
date: 2026-09-11 22:40:00
related:
  - "[[卡片盒/睡眠纺锤波]]"
---

睡眠纺锤波是 N2 期出现的 11–16 Hz 成串脑电活动，由丘脑网状核与丘脑皮层神经元往复抑制产生，单个纺锤持续 0.5–2 秒，一夜可达上万次。纺锤波密度存在明显的个体差异与遗传背景，密度高者对夜间噪声的唤醒阈值更高，睡眠更不容易被打断。纺锤波还与部分记忆任务的隔夜提升相关：它与慢波睡眠、快速眼动睡眠共同构成睡眠期记忆重放的三个环节。`,
  },
  {
    path: '文献盒/睡眠日记.md',
    ctime: Date.parse('2026-09-08T20:00:00'),
    content: `---
title: 睡眠日记
type: term
domain: 医学
term: 睡眠日记
date: 2026-09-08 20:00:00
---

睡眠日记要求连续两周逐日记录上床时间、入睡耗时、夜醒次数与时长、起床时间、白天困倦程度及咖啡因与酒精摄入。它比一次多导睡眠图更能反映习惯性睡眠模式，是计算睡眠效率、判断睡眠相位前后移的一手材料，也是睡眠限制疗法调整卧床窗口的唯一依据。记录时只求当天如实填写，不必修饰——数据连续两周后，卧床里清醒的时间占比通常一眼可见。`,
  },
  {
    path: '文献盒/睡眠债.md',
    ctime: Date.parse('2026-09-07T20:30:00'),
    content: `---
title: 睡眠债
type: term
domain: 医学
term: 睡眠债
date: 2026-09-07 20:30:00
---

睡眠债指累积的睡眠不足，按「需要量减去实际量」逐日累加。它不会因为单次补觉清零：恢复一夜只能还掉一部分，被砍掉的深睡与快速眼动睡眠份额尤其还不回来。睡眠债的典型表现是日间嗜睡、反应变慢与情绪波动，长期欠债则以代谢与免疫代价结算。判断自己欠了多少，靠主观感觉并不可靠——人对自身警觉度的自评在欠债状态下明显偏高。`,
  },
  {
    path: '文献盒/睡眠周期图.md',
    ctime: Date.parse('2026-09-13T09:10:00'),
    content: `---
title: （图版）睡眠周期图：一夜的阶梯
type: image
domain: 医学
date: 2026-09-13 09:10:00
---

（演示读图）以阶梯带表示一夜的睡眠阶段：暖黄为清醒，蓝色为快速眼动，越深的蓝代表越深的非快速眼动睡眠。可见深睡集中在头两个周期，快速眼动在后半程逐周期拉长。

![[文献盒/assets/睡眠周期图.png]]`,
  },
];

/**
 * 媒体种子：挂载树的 image / video 两类节点要能真解析到文件（否则只出灰节点）。
 * 图片是**真 PNG**（data URL，壳内可直接 <img> 显示；与图版录入的落盘形态一致），
 * 视频是占位文本——壳内渲染统一映射到 assets/demo.mp4，不需要真字节。
 */
const SEED_MEDIA: Array<{ path: string; content: string }> = [
  {
    path: '文献盒/assets/睡眠周期图.png',
    content: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAADnUlEQVR42u3coVEDURCA4VSCQGCYiYpAoTLUkBIoAIGiAApAoNDUQQEoJBpFDWgwt8dsHruPb+ZXiPDeu/1yNxG32e72kpq2cQQSwJIAlgSwBLCk8oDf3j9//Ol3f0lvsoUNyMKmWZg7sOQRWhLAkgCWlAHY715+xbGwIgtzB5Y8QksCWBLA0n8C7Oclv3tZ2N8uzB1Y8ggtCWBJAEsCWAJYEsCSUgGfnG4lNQ1gCWBJAEsCWAJYUn3AHy+3kS6vDh2be3d9c1GyTikKuOn309y765uLknVKAJsVgAEGWAADDLDRdFEABhhggAEWwAADLIABBhhgpwSwWQEYYIAFMMAAG00XBWCAAQYYYAEMMMACGGCAjaaLAjDAAAMMsAAGGGABDDDAADulb4Adk9Q3gCWAJQEsaR3gvm/NvXt6XWzu9wYXPIHIkmpel8HLzvp3je/AkSOY+9u34AkEATvMrH8HMMAAA2x8nQDAAAMMMMAAAwwwwMbXCQAMMMAAAwwwwAADDDDAAANsfJ0AwAADDDDAAAMMMMDG1wkADDDAAAMMMMAAAwwwwAADbHydAMAAAwwwwAADDDDAkwCWBLAEsCSAJa0DHHyN7ePzw2J9X7BccHdZS4p8TuJH1bwoBQ8zq+gdOLLuvl9jBXeXtaTgzBU8pcR/V/AwRz9CAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAkooHsASwJIAlrQOc+Iraw839YuM/yu6aLilr2XMfZuYdOLLu8R9ld02XlLXsuQ8TYLsDGGAjbncAAwwwwAADDDDAABtxuwMYYCMOMMAAAwwwwADbHcAAG3G7AxhggAEGGGCAAQbYiNsdwAAbcbsDGGCAAQYYYIABBtiI2x3AABtxgAEGGGCAAT4WYEmDA1gCWBLAktYBHvzK3N3+OlLBVxDbnQo2+g4cHPGmX4dz704eoQEGWAADLAFsdwLYiAMsgAGWAAZYABtxuxPAAAMsgAGWALY7AWzEARbAAEsAAyyAjbjdCWAjDrAABlgCGGABbMTtTgBLAlgSwBLAkmoA9mZdyXuhJXmElgSwBLAkgCUBLAlgCWBJAEsCWAJYUkfAZ+cXkpoGsASwJIAlASwBLAlgSQBLAlgCWBLAkgCWAJYEsCSAJQEsASwJYElH6AsPIXBF5tbWTgAAAABJRU5ErkJggg==',
  },
  {
    path: 'CONFIG/APPENDIX/CBTI演示.mp4',
    content: '（演示）视频文件占位：评审壳不加载真媒体，正文与卡片里的 mp4 嵌入统一映射到壳内 assets/demo.mp4 回放。',
  },
];

/**
 * 任务种子兜底（每次都查，不受种子标记保护）：任务文件必须是**数组**——
 * 数据层按数组 `.map()`/`.push()` 消费，形状不对时保存会报 `data.push is not a function`
 * （旧版种子写成 `{version,tasks:[]}` 对象即此下场）。是数组就原样留（含用户新加的任务）。
 */
function ensureTaskSeedShape(): void {
  const taskKey = key('CONFIG/STORAGE/knowledge.json');
  const raw = localStorage.getItem(taskKey);
  if (raw) {
    try {
      const env = JSON.parse(raw) as { c?: string };
      const inner = JSON.parse(String(env?.c ?? ''));
      if (Array.isArray(inner)) return;
    } catch { /* 落到重写 */ }
  }
  localStorage.setItem(taskKey, encodeSeedFile(JSON.stringify(SEED_TASKS)));
}

/** 首启种子（有标记不覆盖——评审壳内落卡/录入的编辑可持久；壳「重置」清 bz-sim:* 后重播）
 *  标记版本号变了 = 新语料整体重播一次（旧标记还在不影响：新键名缺失即重写） */
function seedVault(): void {
  ensureTaskSeedShape();
  if (localStorage.getItem(SEED_MARKER)) return;
  for (const n of [...SEED_NOTES, ...SEED_MOUNT_NOTES, ...SEED_MOUNT_LITERATURE]) {
    localStorage.setItem(key(n.path), encodeSeedFile(n.content, { ctime: n.ctime, mtime: n.ctime }));
  }
  for (const m of SEED_MEDIA) localStorage.setItem(key(m.path), encodeSeedFile(m.content));
  localStorage.setItem(key('CONFIG/STORAGE/knowledge.json'), encodeSeedFile(JSON.stringify(SEED_TASKS)));
  localStorage.setItem(SEED_MARKER, new Date().toISOString());
}

/** 默认设置（键与插件 data.json 同形；三目录 + 视频工具键 + AI 服务商标识） */
function injectSettings(): void {
  const settings = {
    storagePath: 'CONFIG/STORAGE',
    aiProvider: 'deepseek',
    deepseekApiKey: 'sk-demo', // 假层罐头不校验；仅为让 getAIProvider 放行到 fake requestUrl
    knowledgeDirectory: '文献盒',
    knowledgeCardboxDirectory: '卡片盒',
    knowledgeTopicDirectory: '主题盒',
    knowledgeDomainList: '心理, 医学, 计算机, 学习',
    knowledgeProgressDetail: true,
    knowledgeKeepVideo: false,
    knowledgeQuality: 'highest',
    knowledgeStopOnFailure: false,
    knowledgeOutputDir: '',
    knowledgeCompress: true,
    knowledgeCrf: 23,
    knowledgeFfmpegPath: '',
    knowledgeFfprobePath: '',
    knowledgePythonPath: '',
    knowledgeWhisperModel: 'small',
    knowledgeCacheDir: '',
    knowledgeCacheRetentionDays: 7,
  } as never;
  setSettingsProvider(() => settings);
  // AI 模块有独立注入口（cinema/secondbrain 同款）：不注入则生成报「未配置 AI」
  setAISettingsProvider(() => settings as never);
}

let ui: UIManager | null = null;

// ---------------- 图版演示图（issue 312） ----------------

/**
 * 给图版面板的拖入区补一个壳专用的「载入示例图」按钮：评审时不必真去截图/找图，
 * 点一下就有一张图进来（**可连点**，第 2、3 张换配色与题字，用于看多图）。按钮走的是
 * **真实 drop 事件**（DataTransfer + File）——与手动拖入完全同一条产品路径，不是给面板开后门。
 */
function injectDemoPlate(): void {
  const zone = document.getElementById('lit-image-drop');
  if (!zone || zone.querySelector('[data-demo-plate]')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('data-demo-plate', '1');
  btn.textContent = '载入示例图';
  btn.title = '点一下加一张（可连点，演示多图）';
  btn.style.cssText =
    'border:1px solid var(--line);background:none;color:var(--ink3);font:11px/1.6 inherit;padding:2px 10px;border-radius:999px;cursor:pointer;';
  // 拦掉冒泡：拖入区的 click 会打开文件选择器，示例图按钮不该顺手弹一次
  btn.addEventListener('click', (e) => { e.stopPropagation(); void loadDemoPlate(); });
  zone.appendChild(btn);
}

/** 示例图画布配色（多图时逐张换天色，缩略图并排也分得清） */
const DEMO_PLATE_PALETTES: Array<[string, string, string, string, string]> = [
  ['#2b3a55', '#8f6a63', '#d9b18a', '#f2d9a8', '落日与山脊'],
  ['#2f4a44', '#7d9c8b', '#cfe0cf', '#f4f0d8', '晨雾与松林'],
  ['#1b2338', '#3d4a72', '#7f8fbf', '#e8ecf7', '夜色与湖面'],
];

/** 画一张示例图并转成 PNG 文件（序号只影响配色与题字） */
async function makeDemoPlateFile(seed: number): Promise<File | null> {
  const [sky0, sky1, sky2, sun, title] = DEMO_PLATE_PALETTES[seed % DEMO_PLATE_PALETTES.length];
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // 一张有明显内容可读的画：天幕渐变 + 落日 + 两重山脊 + 题字
  const sky = ctx.createLinearGradient(0, 0, 0, 160);
  sky.addColorStop(0, sky0);
  sky.addColorStop(0.55, sky1);
  sky.addColorStop(1, sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 240, 160);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(168, 78, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c4a63';
  ctx.beginPath();
  ctx.moveTo(0, 160);
  ctx.lineTo(58, 96);
  ctx.lineTo(116, 160);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#28324a';
  ctx.beginPath();
  ctx.moveTo(84, 160);
  ctx.lineTo(160, 108);
  ctx.lineTo(240, 160);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText(`示例图版 ${seed + 1} · ${title}`, 12, 150);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  if (!blob) return null;
  return new File([blob], `demo-plate-${seed + 1}.png`, { type: 'image/png' });
}

/**
 * 造示例图并经**真实 drop 事件**送进图版面板（自检也直接调它）。
 * count > 1 时一次塞多张（issue 313：评审「一组图合成一篇」的多图流程）。
 */
export async function loadDemoPlate(count = 1): Promise<void> {
  bootKnowledgeSim();
  const zone = document.getElementById('lit-image-drop');
  if (!zone) return;
  const dt = new DataTransfer();
  for (let i = 0; i < Math.max(1, count); i++) {
    const file = await makeDemoPlateFile(i);
    if (file) dt.items.add(file);
  }
  if (!dt.items.length) return;
  zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
}

/** 演示级自动双链候选（issue 309）：评审壳没有第二大脑 / 向量服务，用种子卡片充当
 *  「近邻检索 → AI 裁判」的结果，让属性区关联行的 loading → 完成显示在原型里真实可见。 */
const fakeLinkCandidates: Array<{ path: string; title: string }> = [
  { path: '卡片盒/多重记忆系统.md', title: '多重记忆系统' },
  { path: '卡片盒/认知行为疗法.md', title: '认知行为疗法' },
  { path: '卡片盒/间隔重复.md', title: '间隔重复' },
];

/**
 * 注入演示级自动双链通道（issue 309）：评审壳没有第二大脑 / 向量服务，用种子卡片充当
 * 「近邻检索 → AI 裁判」的结果，让「生成内容即起跑 → 属性区关联行分析中… → 完成后直接显示」
 * 这套过程在原型里真实可见。
 * - preview：延迟 ~2.6s（模拟管线耗时，看得清 loading）；返回固定 1~2 张种子卡片；
 * - apply：确认写入落盘后把预演结果写进 frontmatter.related（真写入，故预览「关联」区也读得到）；
 * - now：兜底路径（等价于直接建链）。
 */
function injectFakeLinkNow(app: FakeApp): void {
  /** 剥掉 head 里既有的 related 段（键行 + 其列表项），避免二次写入产生重复键 */
  const stripRelated = (head: string): string => {
    const out: string[] = [];
    let skipping = false;
    for (const line of head.split('\n')) {
      if (/^related:/.test(line)) { skipping = true; continue; }
      if (skipping) {
        if (/^\s+-\s/.test(line) || line.trim() === '') continue;
        skipping = false;
      }
      if (line.trim() !== '') out.push(line);
    }
    return out.join('\n');
  };
  const candidates = (): Array<{ path: string; title: string }> =>
    fakeLinkCandidates.filter((c) => !!app.vault.getAbstractFileByPath(c.path)).slice(0, 2);
  const writeLinks = async (path: string, picks: Array<{ path: string; title: string }>): Promise<number> => {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !picks.length) return 0;
    const text = await app.vault.read(file);
    const lines = picks.map((c) => `  - "[[${c.path}|${c.title}]]"`).join('\n');
    const next = /^---\n[\s\S]*?\n---/.test(text)
      ? text.replace(/^---\n([\s\S]*?)\n---/, (_m, head: string) => `---\n${stripRelated(head)}\nrelated:\n${lines}\n---`)
      : `---\nrelated:\n${lines}\n---\n\n${text}`;
    if (next !== text) await app.vault.modify(file, next);
    return picks.length;
  };
  setLinkBridge({
    preview: async () => {
      await new Promise((r) => setTimeout(r, 2600));
      return { status: 'done' as const, picks: candidates() };
    },
    apply: async (path: string, targetPaths: string[]) => {
      const map = new Map(fakeLinkCandidates.map((c) => [c.path, c.title]));
      const picks = targetPaths.map((p) => ({ path: p, title: map.get(p) || p }));
      return { status: 'done' as const, created: await writeLinks(path, picks) };
    },
    now: async (path: string) => ({ status: 'done' as const, created: await writeLinks(path, candidates()) }),
  });
}

/**
 * 假向量检索（2026-09-15）：挂载建议链路的**召回**是唯一绕不过索引的一环——壳里没有第二大脑，
 * 就用 `SEED_AI_INDEX` 当召回池，按查询串的关键词命中打分（命中数 → 关键词出现次数 → 最高分），
 * 返回 `{path, chunk, score}` 形状与真 `SearchHit` 一致。
 * 只喂 `exportVectorSearch()` 这个叶子桥（与插件同一条路），建议链路本身零改动。
 */
function injectFakeVectorSearch(): void {
  const index = AI_INDEX.filter((it) => !!localStorage.getItem(key(it.path)));
  setVectorSearchSource({
    isIndexReady: () => true,
    search: async (query: string, topK = 5) => {
      const q = String(query ?? '').toLowerCase();
      if (!q.trim()) return [];
      const hits: Array<{ path: string; chunk: string; score: number }> = [];
      for (const it of index) {
        let hit = 0;
        for (const k of it.keys) if (q.includes(k.toLowerCase())) hit++;
        if (!hit) continue;
        // 分数落在 0.62–0.93：过 0.7 的才可能被采纳官选中（SUGGEST_MIN_SCORE），但不是全部达标
        const score = Math.min(0.93, 0.62 + hit * 0.06 + Math.min(0.12, it.chunk.length / 900));
        hits.push({ path: it.path, chunk: it.chunk, score: Number(score.toFixed(3)) });
      }
      hits.sort((x, y) => y.score - x.score || x.path.localeCompare(y.path));
      return hits.slice(0, Math.max(1, topK));
    },
  });
}

/** 壳入口：一次性启动（种子 + 注入 + 构造真 UIManager；幂等） */
export function bootKnowledgeSim(): void {
  const g = window as unknown as { __bzKbSimBooted?: boolean };
  if (g.__bzKbSimBooted) return;
  g.__bzKbSimBooted = true;
  seedVault();
  const app = new FakeApp();
  setApp(app as never);
  injectSettings();
  injectFakeLinkNow(app);
  injectFakeVectorSearch();
  KnowledgeData.init({ storagePath: 'CONFIG/STORAGE' });
  ui = new UIManager(app as never);
  injectDemoPlate();
}

/** 等价插件 bz-knowledge-open：打开主面板（部壹文献） */
export function openPanel(): void {
  bootKnowledgeSim();
  ui?.showMain();
}

/** 等价插件 bz-knowledge-note-term（不带选中词）：打开术语录入弹层 */
export function openTerm(term?: string): void {
  bootKnowledgeSim();
  ui?.showTermEntry(term);
}

/** 等价「段落」入口（issue 309）：打开段落录入弹层（同壳三态之一） */
export function openPassage(): void {
  bootKnowledgeSim();
  ui?.showPassageEntry();
}

/** 等价主窗「图版」按钮（issue 312）：打开图版录入弹层（同壳三态的第三态） */
export function openImage(): void {
  bootKnowledgeSim();
  ui?.showImageEntry();
}

/** 等价主窗「影像」按钮 / 聚合讯「保存至文献」：打开影像**录入**界面（issue 310 起直达录入） */
export function openVideo(prefill?: { url: string; title?: string | null; uploader?: string | null }): void {
  bootKnowledgeSim();
  ui?.showVideoEntry(prefill);
}

/** 等价录入界面头行「处理」按钮：打开影像处理队列面板 */
export function openVideoTasks(): void {
  bootKnowledgeSim();
  ui?.showVideoTasks();
}

/** 等价处理面板头行「历史」按钮：切到面板内的历史视图（2026-09-14 复核起同面板切换，非独立弹窗） */
export function openVideoHistory(): void {
  bootKnowledgeSim();
  ui?.showHistory();
}

/**
 * 等价插件 `bz-knowledge-mount-tree`（issues 317/319）：以主卡开挂载树白板。
 * 壳里 AI 建议链路是**可跑通**的（假向量检索 + 三段罐头回答，见上），打开即能看到
 * 「主卡秒出 → 顶栏生成中 + 进度 → 幽灵节点并入」的全过程，以及固定/取消/看理由。
 *
 * 缺省主卡 = `卡片盒/睡眠结构.md`（有真实双链 + 同名文献吸附 + 六类形态，AI 另有建议可出）。
 * 其它可看样本：`卡片盒/丘脑.md`（与睡眠纺锤波互为环）、`卡片盒/睡眠卫生.md`（孤儿卡：
 * 一条双链都没有——首开时应是空板 + 生成中，AI 建议回来才有节点）。
 */
export function openMountTree(cardPath = '卡片盒/睡眠结构.md'): void {
  bootKnowledgeSim();
  void mountCanvas.openMountTree(cardPath);
}

/** 壳约定别名（prototype-view 调 BZW_knowledge.boot()） */
export const boot = bootKnowledgeSim;
