/**
 * 记忆流系统（ADR-0021，重构自原 SmartCatMemorySystem.js HierarchicalMemorySystem）
 * 单层记忆流（Memory Stream）：所有观察/洞察同构追加入 stream，检索时按
 * GA 三因子评分分级（recency × importance × relevance），取代原四层固化。
 *
 * 核心机制（对齐 Generative Agents 论文）：
 *  1. 记忆对象 = { id, created, lastAccessed, description, importance, type, evidenceIds? }
 *  2. 检索评分 = α1·decay^小时 + α2·importance + α3·relevance（默认 α 全 1.0）
 *  3. 写入时 LLM 打分 importance（0-10 归一 0-1；AI 未配置降级规则分）
 *  4. 反思（Reflection）：24h 或新增 ≥20 条触发，LLM 归纳 3 条洞察写回流（可溯源）
 *  5. 上限 500 条，淘汰 importance 最低者；bge-m3 语义检索，Ollama 不可用降级词法
 */
import type { App } from 'obsidian';
import { getSmartcatVecPath } from './data';
import { callChatJson, isAIConfigured } from './api';
import { getEmbedding, checkRemoteOllama } from '../flash/ollama';
import type { SmartCatData, MemoryStreamEntry } from './types';

export const MEMORY_CONFIG = {
  /** 记忆流上限（软上限，超出淘汰 importance 最低） */
  maxStream: 500,
  /** 检索返回条数 */
  retrievalTopN: 10,
  /** GA 三因子权重（论文默认 α1=α2=α3=1.0） */
  alphaRecency: 1.0,
  alphaImportance: 1.0,
  alphaRelevance: 1.0,
  /** recency 指数衰减系数 */
  decay: 0.995,
  /** 反思：距上次至少间隔（ms） */
  reflectionInterval: 24 * 60 * 60 * 1000,
  /** 反思：新增记忆达到该条数也触发 */
  reflectionMinNew: 20,
  /** 反思：evidence 取最近 N 条内 */
  evidenceWindow: 100,
  /** 反思：evidence 取 importance 前 N 条 */
  evidenceTop: 50,
  /** 反思：一次生成洞察条数 */
  insightCount: 3,
} as const;

export class MemorySystem {
  app: App;
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;
  /** 反思完成回调（心情重构：index 接 PersonalityGrowth 反思驱动） */
  onReflect: ((insights: { text: string }[]) => void | Promise<void>) | null = null;
  /** 反思新增计数（距上次反思） */
  private pendingSinceReflect = 0;
  private reflectionTimer: ReturnType<typeof setInterval> | null = null;
  private reflecting = false;
  /** 语义模式状态：null=未探测 */
  private ollamaAvailable: boolean | null = null;
  private dim = 0;
  /** 已加载向量（行序对齐 stream；仅语义模式用） */
  private vectors: Float64Array | null = null;

  constructor(app: App, dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.app = app;
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
  }

  get stream(): MemoryStreamEntry[] {
    return this.dataProvider().memory.stream;
  }

  /** 初始化：探测 Ollama + 加载向量 + 启动反思调度 */
  async init(): Promise<void> {
    await this.probeSemantic();
    await this.loadVectors();
    this.startReflectionScheduler();
  }

  // ---------------- 记忆写入 ----------------

  /** 添加观察记忆（聊天对话等）；importance+emotion 走 LLM 打分（未配置降级规则分/词法情绪） */
  async addObservation(description: string, opts: { source?: string; manuallyMarked?: boolean; importance?: number; emotion?: string } = {}): Promise<MemoryStreamEntry> {
    const score = opts.importance !== undefined
      ? { importance: opts.importance, emotion: opts.emotion }
      : await this.scoreImportanceAndEmotion(description, opts);
    const memory: MemoryStreamEntry = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      description,
      importance: score.importance,
      type: 'observation',
      source: opts.source,
      emotion: score.emotion,
    };
    this.stream.push(memory);
    this.enforceStreamLimit();
    this.pendingSinceReflect++;
    await this.dataSaver(this.dataProvider());
    await this.appendVector(memory);
    return memory;
  }

  /** 添加洞察记忆（反思产物；importance 固定高值可由调用方传入） */
  async addInsight(description: string, evidenceIds: string[], importance = 0.75, emotion?: string): Promise<MemoryStreamEntry> {
    const memory: MemoryStreamEntry = {
      id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      description,
      importance,
      type: 'insight',
      evidenceIds,
      source: 'reflection',
      emotion,
    };
    this.stream.push(memory);
    this.enforceStreamLimit();
    this.pendingSinceReflect++;
    await this.dataSaver(this.dataProvider());
    await this.appendVector(memory);
    return memory;
  }

  /** 超出上限淘汰 importance 最低（不足 1 条不淘汰） */
  private enforceStreamLimit(): void {
    while (this.stream.length > MEMORY_CONFIG.maxStream) {
      let minIdx = 0;
      this.stream.forEach((m, i) => {
        if ((m.importance ?? 0) < (this.stream[minIdx].importance ?? 0)) minIdx = i;
      });
      this.stream.splice(minIdx, 1);
    }
  }

  // ---------------- importance + emotion 打分 ----------------

  /** 打分（LLM 顺带情绪）：{score 0-10→0-1, emotion}；失败/未配置降级规则分 + 词法情绪 */
  async scoreImportanceAndEmotion(description: string, opts: { manuallyMarked?: boolean } = {}): Promise<{ importance: number; emotion?: string }> {
    try {
      if (await isAIConfigured()) {
        const r = await callChatJson([
          {
            role: 'system',
            content:
              '你是小橘，一只陪伴猫咪。请评估下面这条关于用户的记忆：' +
              '1) 重要程度 0=极其琐碎（如买了杯奶茶），10=极其重要（如考上了理想学校）；' +
              '2) 情绪倾向（从 happy/sad/curious/sleepy/playful/focused/calm/upset 中选一个最贴切的）。' +
              '只返回 JSON：{"score": 0到10之间的数字, "emotion": "情绪"}',
          },
          { role: 'user', content: `记忆：${description}` },
        ], 150);
        const s = Number(r?.score);
        const emotion = typeof r?.emotion === 'string' && r.emotion.trim() ? r.emotion.trim() : undefined;
        if (Number.isFinite(s)) {
          return { importance: Math.min(1, Math.max(0, s / 10)), emotion: emotion || this.detectEmotion(description) };
        }
      }
    } catch (e) { /* 降级规则分 + 词法情绪 */ }
    return { importance: this.ruleImportance(description, opts), emotion: this.detectEmotion(description) };
  }

  /** 词法情绪标注（关键词表；LLM 未配置/失败的兜底，原 detectEmotion 语义） */
  detectEmotion(content: string): string {
    if (typeof content !== 'string' || !content) return 'calm';
    const text = content.toLowerCase();
    const emotionKeywords: Record<string, string[]> = {
      happy: ['开心', '高兴', '喜欢', '爱', '很好', '不错', '棒', '优秀', '惊喜', '哈哈', '开心'],
      sad: ['难过', '伤心', '哭', '失望', '痛苦', '低落', '烦', '郁闷'],
      upset: ['生气', '愤怒', '讨厌', '糟糕', '气死'],
      curious: ['好奇', '奇怪', '为什么', '怎么', '探索', '研究'],
      playful: ['玩', '游戏', '好玩', '有趣', '轻松'],
      sleepy: ['困', '累', '睡着', '熬夜', '疲惫'],
      focused: ['专注', '工作', '写', '学', '复习', '练习'],
      calm: ['平静', '放松', '休息', '冥想'],
    };
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some((k) => text.includes(k))) return emotion;
    }
    return 'calm';
  }

  /** 规则 importance（原 calculateImportance 语义：0.5 + 词数 + 情绪强度 + 手动标记） */
  ruleImportance(description: string, opts: { manuallyMarked?: boolean } = {}): number {
    let score = 0.5;
    const content = typeof description === 'string' ? description : JSON.stringify(description);
    const wordCount = content.split(/\s+/).length;
    score += Math.min(wordCount / 500, 0.3);
    score += this.calculateEmotionIntensity(content) * 0.2;
    if (opts.manuallyMarked) score += 0.3;
    return Math.min(Math.max(score, 0), 1);
  }

  /** 情感强度（原 calculateEmotionIntensity 逐字） */
  calculateEmotionIntensity(content: string): number {
    const text = content.toLowerCase();
    const intensityWords: Record<string, string[]> = {
      high: ['非常', '特别', '极其', '超级', '十分', '真的'],
      medium: ['比较', '相当', '挺', '蛮'],
      low: ['有点', '稍微', '略微'],
    };
    for (const [level, words] of Object.entries(intensityWords)) {
      if (words.some((w) => text.includes(w))) {
        switch (level) {
          case 'high': return 0.8;
          case 'medium': return 0.5;
          case 'low': return 0.3;
        }
      }
    }
    return 0;
  }

  // ---------------- 检索（GA 三因子） ----------------

  /** 检索相关记忆：三因子评分 → 降序 → top N；更新 lastAccessed（自增强） */
  async retrieve(query: string, topN = MEMORY_CONFIG.retrievalTopN): Promise<MemoryStreamEntry[]> {
    const now = Date.now();
    const useSemantic = await this.useSemanticMode();
    let queryVec: number[] | null = null;
    if (useSemantic && query.trim()) {
      queryVec = await this.queryEmbeddingSafe(query);
    }
    const scored = this.stream.map((m) => {
      const hours = (now - new Date(m.lastAccessed || m.created).getTime()) / 3.6e6;
      const recency = Math.pow(MEMORY_CONFIG.decay, Math.max(0, hours));
      const importance = m.importance ?? 0;
      const relevance = queryVec && m.id ? this.semanticRelevance(m.id, queryVec) : this.lexicalRelevance(m, query);
      return { m, score: MEMORY_CONFIG.alphaRecency * recency + MEMORY_CONFIG.alphaImportance * importance + MEMORY_CONFIG.alphaRelevance * relevance };
    });
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topN).map((s) => s.m);
    const touched = top.filter((m) => m.id);
    if (touched.length) {
      const lastAccessed = new Date().toISOString();
      touched.forEach((m) => { m.lastAccessed = lastAccessed; });
      await this.dataSaver(this.dataProvider());
    }
    return top;
  }

  /** 词法相关度（无时间项——时间归 recency；关键词×0.7 + 主题命中×0.3 归一） */
  lexicalRelevance(memory: MemoryStreamEntry, query: string): number {
    if (!query.trim()) return 0;
    const content = memory.description.toLowerCase();
    const queryKeywords = query.toLowerCase().split(/\s+/).filter((k) => k.length > 0);
    if (!queryKeywords.length) return 0;
    let hit = 0;
    for (const kw of queryKeywords) if (content.includes(kw)) hit++;
    return Math.min(1, (hit / queryKeywords.length) * 0.7 + (content.includes(query.toLowerCase()) ? 0.3 : 0));
  }

  // ---------------- 语义模式（bge-m3 via Ollama） ----------------

  private async probeSemantic(): Promise<boolean> {
    if (this.ollamaAvailable !== null) return this.ollamaAvailable;
    try {
      const { buildConfig } = await import('../flash/config');
      this.ollamaAvailable = await checkRemoteOllama(buildConfig().OLLAMA_URL);
    } catch {
      this.ollamaAvailable = false;
    }
    return this.ollamaAvailable;
  }

  private async useSemanticMode(): Promise<boolean> {
    const ok = await this.probeSemantic();
    return ok && this.dim > 0 && !!this.vectors;
  }

  private async queryEmbeddingSafe(query: string): Promise<number[] | null> {
    try {
      const vec = await getEmbedding(query, true);
      if (!vec.length) return null;
      if (!this.dim) this.dim = vec.length;
      return vec;
    } catch {
      return null;
    }
  }

  /** 记忆语义相关度（余弦；向量缺失 → 0） */
  semanticRelevance(memoryId: string, queryVec: number[]): number {
    const vectors = this.vectors;
    if (!vectors || !this.dim) return 0;
    const idx = this.memoryVectorIndex(memoryId);
    if (idx < 0) return 0;
    const memVec = vectors.subarray(idx * this.dim, (idx + 1) * this.dim);
    if (!memVec.length || !queryVec.length) return 0;
    let dot = 0, a = 0, b = 0;
    for (let i = 0; i < this.dim; i++) {
      dot += memVec[i] * (queryVec[i] ?? 0);
      a += memVec[i] * memVec[i];
      b += (queryVec[i] ?? 0) * (queryVec[i] ?? 0);
    }
    const denom = Math.sqrt(a) * Math.sqrt(b);
    return denom === 0 ? 0 : Math.max(0, dot / denom);
  }

  /** 记忆在向量文件中的行序（appendVector 维护 id→行序映射） */
  private memoryVectorIndex(memoryId: string): number {
    return this.vectorIndexMap ? (this.vectorIndexMap.get(memoryId) ?? -1) : -1;
  }

  // ---------------- 向量文件（smartcat-memory-vectors.vec） ----------------

  private vectorIndexMap: Map<string, number> | null = null;

  /** 加载向量文件（dim uint32 LE + float32 平铺；无文件 → 清空） */
  async loadVectors(): Promise<void> {
    this.vectors = null;
    this.dim = 0;
    this.vectorIndexMap = null;
    try {
      const buf = await this.app.vault.adapter.readBinary(getSmartcatVecPath());
      const arr = new Uint8Array(buf);
      if (arr.length < 8) return;
      const dim = new DataView(arr.buffer, arr.byteOffset, 4).getUint32(0, true);
      if (dim <= 0 || dim > 10000) return;
      this.dim = dim;
      const payload = arr.slice(4);
      const count = Math.floor(payload.byteLength / 4 / dim);
      const f32 = new Float32Array(payload.buffer, payload.byteOffset, count * dim);
      this.vectors = new Float64Array(f32);
      // 行序映射：与 stream 顺序对齐（stream 可能已变化，重建映射）
      this.rebuildIndexMap();
    } catch {
      /* 无文件 → 空 */
    }
  }

  /** 重建 id→行序 映射（stream 顺序即向量行序） */
  private rebuildIndexMap(): void {
    const map = new Map<string, number>();
    this.stream.forEach((m, i) => { if (m.id) map.set(m.id, i); });
    this.vectorIndexMap = map;
  }

  /** 追加记忆向量（语义模式可用时；失败静默——检索会回退词法） */
  private async appendVector(memory: MemoryStreamEntry): Promise<void> {
    const ok = await this.probeSemantic();
    if (!ok) return;
    try {
      const vec = await getEmbedding(memory.description, false);
      if (!vec.length) return;
      if (!this.dim) this.dim = vec.length;
      // 追加到内存向量（行序 = stream 最后一条）
      if (!this.vectors) this.vectors = new Float64Array(0);
      const merged = new Float64Array(this.vectors.length + this.dim);
      merged.set(this.vectors, 0);
      for (let i = 0; i < this.dim; i++) merged[this.vectors.length + i] = vec[i] ?? 0;
      this.vectors = merged;
      if (!this.vectorIndexMap) this.vectorIndexMap = new Map();
      const idx = this.stream.length - 1;
      this.vectorIndexMap.set(memory.id, idx);
      await this.persistVectors();
    } catch {
      /* 降级词法 */
    }
  }

  /** 向量落盘（全量重写：dim 头 + float32 平铺） */
  private async persistVectors(): Promise<void> {
    if (!this.vectors || !this.dim) return;
    try {
      const f64 = this.vectors;
      const header = new Uint8Array(4);
      new DataView(header.buffer).setUint32(0, this.dim, true);
      const payload = new Float32Array(f64);
      const data = new Uint8Array(4 + payload.byteLength);
      data.set(header, 0);
      data.set(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength), 4);
      await this.app.vault.adapter.writeBinary(getSmartcatVecPath(), data.buffer as ArrayBuffer);
    } catch {
      /* 落盘失败静默 */
    }
  }

  // ---------------- 反思（Reflection） ----------------

  /** 反思调度（每 30s 检查一次；24h 或新增 ≥20 条触发） */
  startReflectionScheduler(): void {
    if (this.reflectionTimer) clearInterval(this.reflectionTimer);
    this.reflectionTimer = setInterval(() => {
      void this.maybeReflect();
    }, 30 * 1000);
  }

  stopScheduler(): void {
    if (this.reflectionTimer) {
      clearInterval(this.reflectionTimer);
      this.reflectionTimer = null;
    }
  }

  /** 触发条件：距上次反思 ≥24h 或 新增 ≥reflectionMinNew 条（从未反思只靠新增计数） */
  private shouldReflect(now: number): boolean {
    const last = this.dataProvider().memory.reflection.lastReflectAt || 0;
    if (!last) return this.pendingSinceReflect >= MEMORY_CONFIG.reflectionMinNew;
    return now - last >= MEMORY_CONFIG.reflectionInterval || this.pendingSinceReflect >= MEMORY_CONFIG.reflectionMinNew;
  }

  async maybeReflect(): Promise<boolean> {
    if (this.reflecting) return false;
    if (!this.shouldReflect(Date.now())) return false;
    this.reflecting = true;
    try {
      await this.reflect();
      return true;
    } finally {
      this.reflecting = false;
    }
  }

  /** 反思主流程：evidence → LLM 归纳 3 条洞察 → 写回流（带 evidenceIds）
   *  无产出（AI 未配置/调用失败/证据不足）时不推进 lastReflectAt——保持待反思状态，
   *  配置 AI 后可由 pending 计数立即再触发。
   */
  async reflect(): Promise<void> {
    const data = this.dataProvider();
    const now = Date.now();
    // evidence：最近 evidenceWindow 条内 importance 前 evidenceTop 条
    const recent = this.stream.slice(-MEMORY_CONFIG.evidenceWindow);
    const evidence = [...recent].sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0)).slice(0, MEMORY_CONFIG.evidenceTop);
    if (evidence.length < 2) return; // 记忆太少不反思

    const numbered = evidence.map((m, i) => `${i + 1}. ${m.description}`).join('\n');
    const prompt =
      `你是小橘，一只陪伴猫咪。下面是关于用户的一些记忆（编号 1-${evidence.length}）：\n` +
      numbered +
      '\n\n请归纳出最重要的 ' + MEMORY_CONFIG.insightCount + ' 条高阶结论（关于用户的喜好/性格/习惯/关系），' +
      '每条必须引用 1 条以上记忆编号作为依据。只返回 JSON：' +
      `{"insights":[{"text":"结论","evidence":[编号]}]}`;

    let insights: { text: string; evidence: number[] }[] = [];
    try {
      if (await isAIConfigured()) {
        const r = await callChatJson([
          { role: 'system', content: '你是辅助归纳记忆的助手，只输出合法 JSON。' },
          { role: 'user', content: prompt },
        ], 800);
        if (Array.isArray(r?.insights)) {
          insights = r.insights
            .filter((x: any) => x && typeof x.text === 'string' && x.text.trim())
            .slice(0, MEMORY_CONFIG.insightCount)
            .map((x: any) => ({ text: x.text.trim(), evidence: Array.isArray(x.evidence) ? x.evidence.map(Number) : [] }));
        }
      }
    } catch (e) { /* 反思调用失败 → 无产出，保持待反思 */ }

    if (insights.length) {
      for (const ins of insights) {
        const evidenceIds = ins.evidence
          .map((n) => evidence[n - 1]?.id)
          .filter((id): id is string => !!id);
        await this.addInsight(ins.text, evidenceIds);
      }
      data.memory.reflection.lastReflectAt = now;
      data.memory.reflection.count = (data.memory.reflection.count || 0) + 1;
      this.pendingSinceReflect = 0;
      // 反思驱动人格（心情重构：洞察 → PersonalityGrowth）
      if (this.onReflect) {
        try {
          await this.onReflect(insights);
        } catch (e) { /* 成长失败不影响记忆流 */ }
      }
    }
    data.memory.lastUpdated = new Date().toISOString();
    await this.dataSaver(data);
  }

  // ---------------- 状态与格式化 ----------------

  /** 系统状态（记忆流计数/洞察数/反思次数/语义模式） */
  getSystemStatus(): any {
    return {
      streamCount: this.stream.length,
      insightCount: this.stream.filter((m) => m.type === 'insight').length,
      reflectionCount: this.dataProvider().memory.reflection.count || 0,
      semanticMode: this.ollamaAvailable === true && this.dim > 0,
    };
  }

  /** 格式化记忆供 prompt（原 formatMemoriesForPrompt 语义） */
  formatMemoriesForPrompt(memories: MemoryStreamEntry[]): string {
    return memories
      .map((memory, index) => {
        const content = typeof memory.description === 'string' ? memory.description : JSON.stringify(memory.description);
        return `${index + 1}. [${memory.type}] ${content.substring(0, 200)}...`;
      })
      .join('\n');
  }
}