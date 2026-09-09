/**
 * 知识盒行为单源 · sim 启动入口（issue 259，范式随 settings-panel/ADR-0106）
 *
 * 评审壳侧启动器：把真行为层（ui.ts 及其依赖链）在浏览器里跑起来。
 * 与插件侧的差异全部收敛在「启动注入」：
 *   - FakeApp 注入 core/app（vault = localStorage 文件系统；metadataCache 现解析
 *     frontmatter；workspace.openFile / openUrl 走壳事件与新标签）；
 *   - 种子数据：文献盒（视频 CBTI + 术语 既视感/昼夜节律/松果体，含 source/sourceTitle
 *     与 related 互链样例）+ 卡片盒三张 + 主题盒一篇 + 心流体验笔记（内部来源联想目标）——
 *     首启写入 fake vault（有种子标记不覆盖，评审壳内编辑可持久）；
 *   - 设置注入：setSettingsProvider（知识盒目录三键 + 视频工具键，与插件 data.json 同形）；
 *   - AI：fake requestUrl 罐头回放（术语生成/总结/领域判定可真跑演示级结果）。
 *
 * 产物：build-preview.mjs 以本文件为入口、alias obsidian→fake-obsidian，
 * 产出 prototype-behavior.js 挂 window.BZW_knowledge，评审壳只调 boot + openPanel/openTerm。
 * 插件的 ui.ts / note-gen.ts / data.ts / source.ts / core 服务一律零改动——行为代码单源。
 */
import { FakeApp, encodeSeedFile } from './fake/fake-obsidian';
import { setApp } from '../../src/core/app';
import { setSettingsProvider } from '../../src/core/settings-provider';
import { setAISettingsProvider } from '../../src/core/ai';
import { KnowledgeData } from '../../src/knowledge/data';
import { UIManager } from '../../src/knowledge/ui';

const SEED_MARKER = 'bz-sim:__kb_seed_v1';
const key = (path: string): string => `bz-sim:${path}`;

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

/** 首启种子（有标记不覆盖——评审壳内落卡/录入的编辑可持久；壳「重置」清 bz-sim:* 后重播） */
function seedVault(): void {
  if (localStorage.getItem(SEED_MARKER)) return;
  for (const n of SEED_NOTES) localStorage.setItem(key(n.path), encodeSeedFile(n.content, { ctime: n.ctime, mtime: n.ctime }));
  localStorage.setItem(key('CONFIG/STORAGE/knowledge.json'), encodeSeedFile(JSON.stringify({ version: '1.0', tasks: [] })));
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

/** 壳入口：一次性启动（种子 + 注入 + 构造真 UIManager；幂等） */
export function bootKnowledgeSim(): void {
  const g = window as unknown as { __bzKbSimBooted?: boolean };
  if (g.__bzKbSimBooted) return;
  g.__bzKbSimBooted = true;
  seedVault();
  const app = new FakeApp();
  setApp(app as never);
  injectSettings();
  KnowledgeData.init({ storagePath: 'CONFIG/STORAGE' });
  ui = new UIManager(app as never);
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

/** 等价插件「视频录入 · 任务」按钮：打开视频任务面板 */
export function openVideo(): void {
  bootKnowledgeSim();
  ui?.showVideoEntry();
}

/** 壳约定别名（prototype-view 调 BZW_knowledge.boot()） */
export const boot = bootKnowledgeSim;
