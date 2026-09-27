/**
 * 消息池（ADR-0206，取代静态 SMART_CAT_MESSAGES 语料库）：
 * 「AI 预生成弹药库，用一条删一条」——pet/connected/welcomeBack/thinking 四类型由 AI
 * 按小橘当前特性快照（PAD 心情档 + currentEmotion + traits 合成性格 + 关系阶段 + 时段）
 * 预生成囤入 smartcat.json messagePool 段，消费即取一条删一条；池 < 水位线后台补货，
 * 三重节流（单飞锁 + 冷却 + 单日上限）全写死不进设置。
 *
 * setup 无池：它只在「未配 AI」时展示，而无配 AI 无从生成——恒走兜底语料（pickSetupMessage）。
 * 兜底（FALLBACK_MESSAGES）覆盖三种落水姿势：池空冷启动 / 生成失败（静默）/ 未配 AI；
 * 语义是「离线兜底」而非「消息库」（与皮肤包首套离线兜底同构），兜底短窗重复不去重。
 *
 * 生成上下文刻意不掺具体记忆：池是提前囤的通用弹药，「懂你」的针对性表达走
 * 自言自语/聊天通道（ADR-0025 懂你上下文）——囤时懂、弹时已过期的记忆是噪音。
 */
import { callChatJson, isAIConfigured } from './api';
import { moodLevelFromPad, MOOD_MAP } from './mood';
import { getCharacterDescription } from './prompts';
import { relationshipStage, daysKnownFrom } from './relationship';
import type { ChatMessage, SmartCatData } from './types';

/** 池化类型（setup 不入池，见文件头） */
export type PoolKey = 'pet' | 'connected' | 'welcomeBack' | 'thinking';
export const POOL_KEYS: PoolKey[] = ['pet', 'connected', 'welcomeBack', 'thinking'];

/** 水位线：池内 < 3 条触发补货（ADR-0206 写死） */
const WATERMARK = 3;
/** 每批生成条数 */
export const BATCH_SIZE = 10;
/** 补货冷却（任何一批之后，成功失败都进冷却） */
const RESTOCK_COOLDOWN_MS = 10 * 60 * 1000;
/** 单日批数上限（按本地日键翻转重计） */
const MAX_BATCHES_PER_DAY = 6;
/** 池容量上限（normalizeData 同口径；防病态增长，正常水位 3 + 批量 10 远够） */
const POOL_CAP = 20;

/** 兜底语料（每类 3~5 条，精选自旧 SMART_CAT_MESSAGES，437 条全文 git 历史留档） */
export const FALLBACK_MESSAGES: Record<PoolKey, string[]> = {
  pet: [
    '喵呜~ 好舒服呀！继续摸摸~',
    '咕噜咕噜~ 最喜欢主人摸摸了',
    '喵~ 主人在认真工作呢！加油！',
    '蹭蹭~ 主人今天也很努力呢！',
  ],
  connected: [
    '喵呜~ 我准备好啦！随时可以聊天哦',
    '咕噜咕噜~ 小橘大脑启动完毕！',
    '喵！我现在可聪明了，问我什么都可以~',
    '呼噜呼噜~ 准备就绪，开始聊天~',
  ],
  welcomeBack: [
    '喵呜~ 你终于回来啦！想死我了！',
    '春风十里，不如你回来的身影~',
    '欢迎回来！让我们一起创造奇迹！',
    '我一直在这里等你呢~',
  ],
  thinking: [
    '喵呜~（持续思考中）马上就要有答案了！',
    '咕噜咕噜~ 思考进程已加载到80%喵~',
    '喵~ 大脑正在全力运转，请稍候~',
  ],
};

/** setup 兜底（旧 SETUP_MESSAGES 12 条精选 5 条，保留「配置/接入 AI」引导方向，UX 54） */
export const SETUP_FALLBACK_MESSAGES: string[] = [
  '喵~ 我还没连上 AI 呢。到设置里配置好 AI，我就能真正陪你聊天啦！',
  '喵！我的大脑还没启动：请在设置中配置 AI，聊天功能就会解锁哦~',
  '蹭蹭~ 记得去设置里给我接上 AI 哦，之后我会更懂你~',
  '喵~ 我准备好了，只差你在设置里配置 AI 这一步啦！',
  '呼噜~ 先到设置配置 AI 吧，配好之后我随时都能陪你聊天~',
];

/** setup 消费（纯函数：恒兜底随机，无池无消耗） */
export function pickSetupMessage(): string {
  return SETUP_FALLBACK_MESSAGES[Math.floor(Math.random() * SETUP_FALLBACK_MESSAGES.length)];
}

function pickFallback(key: PoolKey): string {
  const pool = FALLBACK_MESSAGES[key];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------- 特性快照与生成 prompt（纯函数，测试直测） ----------------

/** 时段描述（生成上下文信号；welcomeBack 旧时段死文案已删，时段改喂这里） */
export function describeDaypart(hour: number): string {
  if (hour < 5) return '深夜';
  if (hour < 12) return '早晨';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 22) return '晚上';
  return '深夜';
}

/** 特性快照（轻量：心情档 + 情绪 + 性格合成 + 关系阶段 + 时段；不掺具体记忆，见文件头） */
export function buildTraitSnapshot(data: SmartCatData, now = Date.now()): string {
  const lines: string[] = [];
  const pad = data.mood?.pad;
  if (pad) {
    const level = moodLevelFromPad(pad);
    lines.push(`- 心情：${MOOD_MAP[level]?.state ?? level}`);
  }
  if (data.mood?.currentEmotion) lines.push(`- 当前情绪：${data.mood.currentEmotion}`);
  const traits = data.personalityGrowth?.traits;
  if (traits) lines.push(`- 性格：${getCharacterDescription(traits)}`);
  try {
    const g = data.personalityGrowth;
    const stage = relationshipStage({
      trust: g?.relationship?.trust ?? 0.5,
      attachment: g?.relationship?.attachment ?? 0.5,
      interactions: g?.behaviorStats?.interactionCount ?? 0,
      daysKnown: daysKnownFrom((data.memory?.memoryStream ?? []).map((m) => m.created), now),
    });
    lines.push(`- 与主人的关系阶段：${stage.name}`);
  } catch { /* 阶段派生失败不阻断快照 */ }
  lines.push(`- 时段：${describeDaypart(new Date(now).getHours())}`);
  return lines.join('\n');
}

/** 场景说明（生成 prompt 用） */
const SCENARIOS: Record<PoolKey, string> = {
  pet: '抚摸互动：主人正在摸小橘，小橘很受用（撒娇、舒服、鼓励、俏皮皆可）',
  connected: 'AI 刚刚连接就绪：告诉主人现在可以开始聊天了',
  welcomeBack: '主人离开了一段时间后回来：欢迎归来',
  thinking: '主人正在等小橘思考回答：思考进行中的等待占位语',
};

/** few-shot 风格示例（精选自旧语料写死在代码里，锚定猫语气不漂移；禁止照抄） */
const FEW_SHOTS: Record<PoolKey, string[]> = {
  pet: ['喵呜~ 好舒服呀！继续摸摸~ 🐾', '喵！摸一下收费一条小鱼干！🐟', '喵~ 主人在认真工作呢！加油！💪'],
  connected: ['喵呜~ 我准备好啦！随时可以聊天哦 😸', '咕噜咕噜~ 小橘大脑启动完毕！🐾', '喵！我现在可聪明了，问我什么都可以~'],
  welcomeBack: ['喵呜~ 你终于回来啦！想死我了！😻', '春风十里，不如你回来的身影~', '欢迎回来！我准备了虚拟小鱼干~ 🐟'],
  thinking: ['喵呜~（持续思考中）马上就要有答案了！', '（尾巴有节奏地摆动）思考还在继续中~', '咕噜咕噜~ 大脑CPU温度正常，继续思考~'],
};

/** 生成 prompt（走 callChatJson 的结构化 JSON 通道，ADR-0021） */
export function buildPoolPrompt(key: PoolKey, snapshot: string): ChatMessage[] {
  const shots = FEW_SHOTS[key].map((s) => `- ${s}`).join('\n');
  const system = `你是陪伴猫咪「小橘」的台词代笔。先读小橘当前的特性快照，再为指定场景批量写 ${BATCH_SIZE} 条短消息。

要求：
- 每条不超过 30 个字，口语化、有画面感；可用猫咪语气词（喵/咕噜/呼噜/~），不要堆砌；
- ${BATCH_SIZE} 条之间角度、句式、情绪色彩各不相同，禁止只换标点或语气词；
- 贴合特性快照：低落时不要硬嗨，疏离时少撒娇；
- 只输出 JSON 对象：{"messages": ["…", "…"]}，不要任何多余文字。

## 风格示例（模仿语气与长度，禁止照抄）
${shots}

## 小橘当前特性快照（仅作生成参考）
${snapshot}

## 场景
${SCENARIOS[key]}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: '开始生成，只返回 JSON。' },
  ];
}

/** 解析生成结果（畸形容忍：非数组/非字符串/空串全剥，去重截断） */
export function parsePoolBatch(raw: any): string[] {
  const arr = Array.isArray(raw?.messages) ? raw.messages : [];
  const seen = new Set<string>();
  for (const item of arr) {
    if (typeof item === 'string' && item.trim()) seen.add(item.trim());
  }
  return Array.from(seen).slice(0, BATCH_SIZE);
}

/** 调 AI 生成一批（失败抛错由调用方静默降级） */
export async function generatePoolBatch(key: PoolKey, snapshot: string): Promise<string[]> {
  const raw = await callChatJson(buildPoolPrompt(key, snapshot));
  return parsePoolBatch(raw);
}

// ---------------- 池系统（消费 + 标脏 + 补货调度） ----------------

/**
 * 消息池系统：消费=shift+标脏（30s tick 防抖落盘，崩溃最多重复弹一条已删消息，无害）；
 * 补货=水位 < 3 触发一批 10 条，单飞锁 + 冷却 10 分钟 + 单日 6 批三重节流（全写死），
 * 失败同样进冷却（防 30s tick 空转重试打爆）。节流状态仅内存（会话级）——启动触发点
 * 本身就依赖重启后可立即补货，持久化会跟它打架。
 */
export class MessagePoolSystem {
  private dirty = false;
  private generating = false;
  private lastRestockAt = 0;
  private dayKey = '';
  private batchesToday = 0;

  constructor(
    private dataProvider: () => SmartCatData,
    private dataSaver: (data: SmartCatData) => Promise<void>,
  ) {}

  /** 消费一条：池内 shift（用一条删一条），池空回落兜底语料 */
  consume(key: PoolKey): string {
    const pool = this.dataProvider().messagePool?.[key];
    if (pool && pool.length > 0) {
      const msg = pool.shift()!;
      this.dirty = true;
      void this.maybeRestock(); // 消费后惰性补货检查（节流门在内部，空转廉价）
      return msg;
    }
    return pickFallback(key);
  }

  /** 30s tick 挂点：脏了先落盘，再过一遍补货门 */
  async onTick(): Promise<void> {
    if (this.dirty) {
      this.dirty = false;
      try {
        await this.dataSaver(this.dataProvider());
      } catch { /* 落盘失败下轮再试（dirty 已复位，消费丢失无害） */ }
    }
    await this.maybeRestock();
  }

  /** 卸载兜底：脏池即时落一次（丢给调用方 fire-and-forget） */
  flushIfDirty(): Promise<void> {
    if (!this.dirty) return Promise.resolve();
    this.dirty = false;
    return this.dataSaver(this.dataProvider());
  }

  /** 池内最少且低于水位的类型；全部 ≥ 水位返回 null */
  private lowestBelowWatermark(): PoolKey | null {
    const pools = this.dataProvider().messagePool;
    let worst: PoolKey | null = null;
    let worstLen = WATERMARK;
    for (const key of POOL_KEYS) {
      const len = pools?.[key]?.length ?? 0;
      if (len < worstLen) {
        worst = key;
        worstLen = len;
      }
    }
    return worst;
  }

  /** 补货（三重节流 + 单飞锁；失败静默，ADR-0206） */
  async maybeRestock(): Promise<void> {
    if (this.generating) return;
    const now = Date.now();
    if (now - this.lastRestockAt < RESTOCK_COOLDOWN_MS) return;
    const dayKey = new Date(now).toDateString();
    if (this.dayKey !== dayKey) {
      this.dayKey = dayKey;
      this.batchesToday = 0;
    }
    if (this.batchesToday >= MAX_BATCHES_PER_DAY) return;
    const key = this.lowestBelowWatermark();
    if (!key) return;
    if (!(await isAIConfigured())) return;

    this.generating = true;
    try {
      const batch = await generatePoolBatch(key, buildTraitSnapshot(this.dataProvider(), now));
      if (batch.length > 0) {
        const data = this.dataProvider();
        const pool = ensurePool(data, key);
        pool.push(...batch.slice(0, POOL_CAP - pool.length));
        this.lastRestockAt = Date.now();
        this.batchesToday++;
        await this.dataSaver(data); // 批量成功是低频事件，即时落盘保重启连续性
      } else {
        this.lastRestockAt = Date.now(); // 空产出也进冷却
      }
    } catch {
      this.lastRestockAt = Date.now(); // 失败静默进冷却，不发通知
    } finally {
      this.generating = false;
    }
  }
}

/** 取/建某类型的池段（旧数据 messagePool 缺省容忍，零迁移） */
export function ensurePool(data: SmartCatData, key: PoolKey): string[] {
  if (!data.messagePool) {
    data.messagePool = { pet: [], connected: [], welcomeBack: [], thinking: [] };
  }
  if (!Array.isArray(data.messagePool[key])) {
    data.messagePool[key] = [];
  }
  return data.messagePool[key];
}
