/**
 * 分层记忆系统（移植自 SmartCatMemorySystem.js HierarchicalMemorySystem）
 * 存储收敛进 smartcat.json（用户拍板：所有数据单 json）——原 4 层文件
 * CONFIG/SMART_CAT/memories/*.json 改为 data.memory 四层对象；字段结构沿用
 * （version/lastUpdated/memories + 层特异字段），旧数据一次性迁移由 data.ts 负责。
 * 修复原版 app 注入时序缺陷（构造后 init 已挂 app；原版此 bug 导致从未落盘，铁律 4 之外的功能性修复）。
 * 原检索每次从磁盘重读——本版直接读内存层（本质等价，行为更一致）。
 */
import type { App } from 'obsidian';
import type { SmartCatData, MemoryLayer } from './types';

export const MEMORY_CONFIG = {
  maxShortTerm: 100,
  maxLongTerm: 500,
  importanceThreshold: 0.7,
  consolidationInterval: 24 * 60 * 60 * 1000, // 24 小时
};

/** 相关度阈值与上限（原 retrieveRelevantMemories 语义） */
export const RETRIEVAL_THRESHOLD = 0.7;
export const RETRIEVAL_MAX = 10;

export class MemorySystem {
  app: App;
  /** 允许外部注入 data 读写（bypass 循环依赖：index 持有 data 引用） */
  dataProvider: () => SmartCatData;
  dataSaver: (data: SmartCatData) => Promise<void>;
  private consolidationTimer: ReturnType<typeof setInterval> | null = null;

  constructor(app: App, dataProvider: () => SmartCatData, dataSaver: (data: SmartCatData) => Promise<void>) {
    this.app = app;
    this.dataProvider = dataProvider;
    this.dataSaver = dataSaver;
  }

  get memory(): { shortTerm: MemoryLayer; longTerm: MemoryLayer; permanent: MemoryLayer; index: MemoryLayer } {
    return this.dataProvider().memory;
  }

  /** 启动固化调度（24h；幂等先清旧） */
  startConsolidationScheduler(): void {
    if (this.consolidationTimer) clearInterval(this.consolidationTimer);
    this.consolidationTimer = setInterval(() => {
      void this.consolidateMemories();
    }, MEMORY_CONFIG.consolidationInterval);
  }

  stopScheduler(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;
    }
  }

  /** 添加短期记忆（conversation 内容；维护上限 slice(-100)；更新索引） */
  async addShortTermMemory(conversation: string, metadata: Record<string, any> = {}): Promise<any> {
    const memory = {
      id: this.generateMemoryId(),
      timestamp: new Date().toISOString(),
      type: 'conversation',
      content: conversation,
      metadata: {
        importance: this.calculateImportance(conversation, metadata),
        emotion: this.detectEmotion(conversation),
        topics: this.extractTopics(conversation),
        ...metadata,
      },
      usage: { accessCount: 0, lastAccessed: null, relevanceScore: 1.0 },
    };
    const layer = this.memory.shortTerm;
    layer.memories.push(memory);
    if (layer.memories.length > MEMORY_CONFIG.maxShortTerm) {
      layer.memories = layer.memories.slice(-MEMORY_CONFIG.maxShortTerm);
    }
    layer.lastUpdated = new Date().toISOString();
    await this.updateMemoryIndex(memory, 'shortTerm');
    await this.dataSaver(this.dataProvider());
    return memory;
  }

  /** 计算重要性（原 calculateImportance 逐字） */
  calculateImportance(conversation: string, metadata: Record<string, any>): number {
    let score = 0.5;
    const content = typeof conversation === 'string' ? conversation : JSON.stringify(conversation);
    const wordCount = content.split(/\s+/).length;
    score += Math.min(wordCount / 500, 0.3);
    const emotionIntensity = this.calculateEmotionIntensity(content);
    score += emotionIntensity * 0.2;
    if (metadata.manuallyMarked) score += 0.3;
    if (metadata.isRepetitive) score += 0.1;
    return Math.min(Math.max(score, 0), 1);
  }

  /** 检测情感（原 detectEmotion 关键词表逐字） */
  detectEmotion(content: string): string {
    const text = content.toLowerCase();
    const emotionKeywords: Record<string, string[]> = {
      positive: ['开心', '高兴', '喜欢', '爱', '很好', '不错', '棒', '优秀', '惊喜'],
      negative: ['难过', '生气', '愤怒', '讨厌', '不好', '糟糕', '失望', '烦恼', '痛苦'],
      neutral: ['知道', '了解', '明白', '思考', '考虑', '可能', '应该'],
    };
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some((k) => text.includes(k))) return emotion;
    }
    return 'neutral';
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

  /** 主题提取（原 10 主题词，最多 3 个） */
  extractTopics(content: string): string[] {
    const commonTopics = ['学习', '工作', '生活', '技术', '阅读', '写作', '思考', '计划', '问题', '解决方案'];
    const text = content.toLowerCase();
    return commonTopics.filter((t) => text.includes(t.toLowerCase())).slice(0, 3);
  }

  /** 记忆固化（短期 importance>=0.7 → 长期；超限删最不重要；短期移除） */
  async consolidateMemories(): Promise<void> {
    const { shortTerm, longTerm } = this.memory;
    const important = shortTerm.memories.filter((m) => (m.metadata?.importance || 0) >= MEMORY_CONFIG.importanceThreshold);
    for (const memory of important) {
      const summary = this.generateMemorySummary(memory);
      const longTermMemory: any = {
        ...memory,
        id: this.generateMemoryId(),
        originalShortTermId: memory.id,
        summary,
        consolidatedAt: new Date().toISOString(),
        metadata: {
          ...memory.metadata,
          consolidationScore: this.calculateConsolidationScore(memory),
        },
      };
      longTerm.memories.push(longTermMemory);
      if (longTerm.memories.length > MEMORY_CONFIG.maxLongTerm) {
        this.removeLeastImportantLongTermMemory();
      }
      shortTerm.memories = shortTerm.memories.filter((m) => m.id !== memory.id);
    }
    longTerm.consolidationCount = (longTerm.consolidationCount || 0) + important.length;
    longTerm.lastUpdated = new Date().toISOString();
    shortTerm.lastUpdated = new Date().toISOString();
    await this.dataSaver(this.dataProvider());
  }

  /** 记忆摘要（原 generateMemorySummary 逐字：句子 10-200 字取前 3） */
  generateMemorySummary(memory: any): any {
    const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
    const sentences = content.split(/[.!?。！？]+/).filter((s: string) => s.trim().length > 0);
    const keySentences = sentences
      .filter((s: string) => s.length > 10 && s.length < 200)
      .slice(0, 3);
    return { keyPoints: keySentences, topics: memory.metadata?.topics, emotion: memory.metadata?.emotion, wordCount: content.length };
  }

  /** 固化分（原 calculateConsolidationScore 逐字） */
  calculateConsolidationScore(memory: any): number {
    let score = memory.metadata?.importance || 0;
    const usage = this.memory.index.usageStats?.[memory.id];
    if (usage) score += Math.min(usage.accessCount * 0.1, 0.3);
    const ageInDays = (Date.now() - new Date(memory.timestamp).getTime()) / (24 * 60 * 60 * 1000);
    score += Math.max(0, (7 - ageInDays) * 0.05);
    return Math.min(Math.max(score, 0), 1);
  }

  /** 删最不重要长期记忆（importance * consolidationScore 最小） */
  removeLeastImportantLongTermMemory(): void {
    const { longTerm } = this.memory;
    if (!longTerm.memories.length) return;
    let minImportance = 1;
    let minIndex = -1;
    longTerm.memories.forEach((memory: any, index: number) => {
      const importance = (memory.metadata?.importance || 0) * (memory.metadata?.consolidationScore || 0.5);
      if (importance < minImportance) {
        minImportance = importance;
        minIndex = index;
      }
    });
    if (minIndex !== -1) longTerm.memories.splice(minIndex, 1);
  }

  /** 检索相关记忆（三层合并 → relevance 降序 → >=0.7 → 至多 10 条；更新使用统计） */
  async retrieveRelevantMemories(query: string, _context: Record<string, any> = {}): Promise<any[]> {
    const results: any[] = [];
    for (const layer of ['shortTerm', 'longTerm', 'permanent'] as const) {
      results.push(...this.searchInLayer(layer, query));
    }
    results.sort((a, b) => b.relevance - a.relevance);
    const filtered = results.filter((m) => m.relevance >= RETRIEVAL_THRESHOLD);
    filtered.forEach((memory) => {
      void this.updateUsageStats(memory.id);
    });
    return filtered.slice(0, RETRIEVAL_MAX);
  }

  /** 层内检索（原 searchInLayer 语义；内存层直接读） */
  searchInLayer(layer: 'shortTerm' | 'longTerm' | 'permanent', query: string): any[] {
    const memories = this.memory[layer].memories || [];
    const results: any[] = [];
    for (const memory of memories) {
      const relevance = this.calculateRelevance(memory, query);
      if (relevance > 0) results.push({ ...memory, layer, relevance });
    }
    return results;
  }

  /** 相关度（原 calculateRelevance 逐字：关键词×0.4 + 主题×0.3 + 时间衰减×0.2 + 使用×0.05） */
  calculateRelevance(memory: any, query: string): number {
    let relevance = 0;
    const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
    const queryKeywords = query.toLowerCase().split(/\s+/);
    let keywordMatches = 0;
    queryKeywords.forEach((kw) => {
      if (content.toLowerCase().includes(kw)) keywordMatches++;
    });
    relevance += (keywordMatches / Math.max(queryKeywords.length, 1)) * 0.4;
    if (memory.metadata?.topics) {
      const topicMatches = memory.metadata.topics.filter((t: string) => query.toLowerCase().includes(t.toLowerCase())).length;
      relevance += (topicMatches / Math.max(memory.metadata.topics.length, 1)) * 0.3;
    }
    const memoryAge = Date.now() - new Date(memory.timestamp).getTime();
    const ageInDays = memoryAge / (24 * 60 * 60 * 1000);
    const timeRelevance = Math.max(0, 1 - ageInDays / 30);
    relevance += timeRelevance * 0.2;
    const usage = this.memory.index.usageStats?.[memory.id];
    if (usage) relevance += Math.min(usage.accessCount * 0.05, 0.1);
    return Math.min(Math.max(relevance, 0), 1);
  }

  /** 更新使用统计（accessCount++，落盘） */
  async updateUsageStats(memoryId: string): Promise<void> {
    if (this.memory.index.usageStats?.[memoryId]) {
      this.memory.index.usageStats[memoryId].accessCount++;
      this.memory.index.usageStats[memoryId].lastAccessed = new Date().toISOString();
      this.memory.index.lastUpdated = new Date().toISOString();
      await this.dataSaver(this.dataProvider());
    }
  }

  /** 更新索引（时间/主题/情感/usageStats） */
  async updateMemoryIndex(memory: any, layer: string): Promise<void> {
    const index = this.memory.index;
    const dateKey = new Date(memory.timestamp).toISOString().split('T')[0];
    (index.timeIndex ||= {})[dateKey] ||= [];
    index.timeIndex![dateKey].push(memory.id);
    if (memory.metadata?.topics?.length) {
      memory.metadata.topics.forEach((topic: string) => {
        (index.topicIndex ||= {})[topic] ||= [];
        index.topicIndex![topic].push(memory.id);
      });
    }
    if (memory.metadata?.emotion) {
      (index.emotionIndex ||= {})[memory.metadata.emotion] ||= [];
      index.emotionIndex![memory.metadata.emotion].push(memory.id);
    }
    (index.usageStats ||= {})[memory.id] = {
      layer,
      accessCount: 0,
      lastAccessed: null,
      importance: memory.metadata?.importance || 0,
    };
    index.lastUpdated = new Date().toISOString();
  }

  /** 清理过期（原 cleanupExpiredMemories：长期 30 天未用且 importance<0.3 删除） */
  async cleanupExpiredMemories(): Promise<void> {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const { longTerm } = this.memory;
    longTerm.memories = (longTerm.memories || []).filter((memory: any) => {
      const usage = this.memory.index.usageStats?.[memory.id];
      const lastUsed = usage && usage.lastAccessed ? new Date(usage.lastAccessed).getTime() : new Date(memory.timestamp).getTime();
      const isExpired = lastUsed < thirtyDaysAgo && (memory.metadata?.importance || 0) < 0.3;
      return !isExpired;
    });
    longTerm.lastUpdated = new Date().toISOString();
    await this.dataSaver(this.dataProvider());
  }

  /** 系统状态（原 getSystemStatus 语义） */
  getSystemStatus(): any {
    return {
      shortTermCount: this.memory.shortTerm.memories.length,
      longTermCount: this.memory.longTerm.memories.length,
      permanentCount: this.memory.permanent.memories.length,
      lastConsolidation: this.memory.longTerm.consolidationCount || 0,
    };
  }

  /** 格式化记忆供 prompt（原 formatMemoriesForPrompt 逐字） */
  formatMemoriesForPrompt(memories: any[]): string {
    return memories
      .map((memory, index) => {
        const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
        return `${index + 1}. [${memory.layer}] ${content.substring(0, 200)}...`;
      })
      .join('\n');
  }

  private generateMemoryId(): string {
    return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}