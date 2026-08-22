// SMART CAT 分层记忆系统
// 文件名：SmartCatMemorySystem.js
// 存储位置：CONFIG/SMART_CAT/

class HierarchicalMemorySystem {
    constructor() {
        this.memoryConfig = {
            storagePath: 'CONFIG/SMART_CAT/memories/',
            maxShortTerm: 100,
            maxLongTerm: 500,
            importanceThreshold: 0.7,
            consolidationInterval: 24 * 60 * 60 * 1000 // 24小时
        };
        
        this.memoryLayers = {
            shortTerm: 'short_term.json',
            longTerm: 'long_term.json',
            permanent: 'permanent.json',
            index: 'memory_index.json'
        };
        
        this.init();
    }

    async init() {
        await this.ensureStorageStructure();
        await this.loadAllMemories();
        this.startConsolidationScheduler();
    }

    // 确保存储结构存在
    async ensureStorageStructure() {
        const { storagePath } = this.memoryConfig;
        
        try {
            // 检查存储目录是否存在
            if (!await this.app.vault.adapter.exists(storagePath)) {
                await this.app.vault.adapter.mkdir(storagePath);
            }

            // 初始化记忆文件
            for (const [layer, filename] of Object.entries(this.memoryLayers)) {
                const filePath = storagePath + filename;
                if (!await this.app.vault.adapter.exists(filePath)) {
                    await this.saveMemoryFile(filePath, this.getDefaultMemoryStructure(layer));
                }
            }
        } catch (error) {
            console.error('初始化记忆存储失败:', error);
        }
    }

    getDefaultMemoryStructure(layer) {
        const baseStructure = {
            version: '1.0',
            lastUpdated: new Date().toISOString(),
            memories: []
        };

        switch (layer) {
            case 'shortTerm':
                return {
                    ...baseStructure,
                    maxSize: this.memoryConfig.maxShortTerm,
                    sessionId: this.generateSessionId()
                };
            case 'longTerm':
                return {
                    ...baseStructure,
                    maxSize: this.memoryConfig.maxLongTerm,
                    consolidationCount: 0
                };
            case 'permanent':
                return {
                    ...baseStructure,
                    protected: true
                };
            case 'index':
                return {
                    ...baseStructure,
                    timeIndex: {},
                    topicIndex: {},
                    emotionIndex: {},
                    usageStats: {}
                };
            default:
                return baseStructure;
        }
    }

    // 生成会话ID
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 加载所有记忆层
    async loadAllMemories() {
        try {
            this.shortTermMemories = await this.loadMemoryLayer('shortTerm');
            this.longTermMemories = await this.loadMemoryLayer('longTerm');
            this.permanentMemories = await this.loadMemoryLayer('permanent');
            this.memoryIndex = await this.loadMemoryLayer('index');
            
            console.log('记忆系统加载完成');
        } catch (error) {
            console.error('加载记忆失败:', error);
        }
    }

    async loadMemoryLayer(layer) {
        const filePath = this.memoryConfig.storagePath + this.memoryLayers[layer];
        try {
            const content = await this.app.vault.adapter.read(filePath);
            return JSON.parse(content);
        } catch (error) {
            console.error(`加载${layer}记忆失败:`, error);
            return this.getDefaultMemoryStructure(layer);
        }
    }

    // 保存记忆文件
    async saveMemoryFile(filePath, data) {
        try {
            await this.app.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('保存记忆文件失败:', error);
        }
    }

    // 添加新记忆到短期记忆
    async addShortTermMemory(conversation, metadata = {}) {
        const memory = {
            id: this.generateMemoryId(),
            timestamp: new Date().toISOString(),
            type: 'conversation',
            content: conversation,
            metadata: {
                importance: await this.calculateImportance(conversation, metadata),
                emotion: this.detectEmotion(conversation),
                topics: this.extractTopics(conversation),
                ...metadata
            },
            usage: {
                accessCount: 0,
                lastAccessed: null,
                relevanceScore: 1.0
            }
        };

        // 添加到短期记忆
        this.shortTermMemories.memories.push(memory);
        
        // 维护短期记忆大小
        if (this.shortTermMemories.memories.length > this.memoryConfig.maxShortTerm) {
            this.shortTermMemories.memories = this.shortTermMemories.memories.slice(-this.memoryConfig.maxShortTerm);
        }

        this.shortTermMemories.lastUpdated = new Date().toISOString();
        await this.saveMemoryLayer('shortTerm');

        // 更新索引
        await this.updateMemoryIndex(memory, 'shortTerm');

        return memory;
    }

    // 计算记忆重要性
    async calculateImportance(conversation, metadata) {
        let score = 0.5; // 基础分数

        // 对话长度和深度
        const content = typeof conversation === 'string' ? conversation : JSON.stringify(conversation);
        const wordCount = content.split(/\s+/).length;
        score += Math.min(wordCount / 500, 0.3); // 最多增加0.3分

        // 情感强度
        const emotionIntensity = this.calculateEmotionIntensity(content);
        score += emotionIntensity * 0.2;

        // 用户明确标记
        if (metadata.manuallyMarked) {
            score += 0.3;
        }

        // 信息重复频率（需要历史数据，这里简化处理）
        if (metadata.isRepetitive) {
            score += 0.1;
        }

        return Math.min(Math.max(score, 0), 1);
    }

    // 检测情感
    detectEmotion(content) {
        const text = content.toLowerCase();
        const emotionKeywords = {
            positive: ['开心', '高兴', '喜欢', '爱', '很好', '不错', '棒', '优秀', '惊喜'],
            negative: ['难过', '生气', '愤怒', '讨厌', '不好', '糟糕', '失望', '烦恼', '痛苦'],
            neutral: ['知道', '了解', '明白', '思考', '考虑', '可能', '应该']
        };

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return emotion;
            }
        }

        return 'neutral';
    }

    // 计算情感强度
    calculateEmotionIntensity(content) {
        const text = content.toLowerCase();
        const intensityWords = {
            high: ['非常', '特别', '极其', '超级', '十分', '真的'],
            medium: ['比较', '相当', '挺', '蛮'],
            low: ['有点', '稍微', '略微']
        };

        let intensity = 0;
        for (const [level, words] of Object.entries(intensityWords)) {
            if (words.some(word => text.includes(word))) {
                switch (level) {
                    case 'high': intensity = 0.8; break;
                    case 'medium': intensity = 0.5; break;
                    case 'low': intensity = 0.3; break;
                }
                break;
            }
        }

        return intensity;
    }

    // 提取主题
    extractTopics(content) {
        // 简化版主题提取，实际应用中可以使用更复杂的NLP技术
        const commonTopics = ['学习', '工作', '生活', '技术', '阅读', '写作', '思考', '计划', '问题', '解决方案'];
        const text = content.toLowerCase();
        
        return commonTopics.filter(topic => 
            text.includes(topic.toLowerCase())
        ).slice(0, 3); // 最多返回3个主题
    }

    // 生成记忆ID
    generateMemoryId() {
        return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 更新记忆索引
    async updateMemoryIndex(memory, layer) {
        const { id, timestamp, metadata } = memory;

        // 时间索引
        const dateKey = new Date(timestamp).toISOString().split('T')[0];
        if (!this.memoryIndex.timeIndex[dateKey]) {
            this.memoryIndex.timeIndex[dateKey] = [];
        }
        this.memoryIndex.timeIndex[dateKey].push(id);

        // 主题索引
        if (metadata.topics && metadata.topics.length > 0) {
            metadata.topics.forEach(topic => {
                if (!this.memoryIndex.topicIndex[topic]) {
                    this.memoryIndex.topicIndex[topic] = [];
                }
                this.memoryIndex.topicIndex[topic].push(id);
            });
        }

        // 情感索引
        if (metadata.emotion) {
            if (!this.memoryIndex.emotionIndex[metadata.emotion]) {
                this.memoryIndex.emotionIndex[metadata.emotion] = [];
            }
            this.memoryIndex.emotionIndex[metadata.emotion].push(id);
        }

        // 使用统计
        this.memoryIndex.usageStats[id] = {
            layer,
            accessCount: 0,
            lastAccessed: null,
            importance: metadata.importance
        };

        this.memoryIndex.lastUpdated = new Date().toISOString();
        await this.saveMemoryLayer('index');
    }

    // 记忆固化流程（短期→长期）
    async consolidateMemories() {
        console.log('开始记忆固化流程...');

        const importantMemories = this.shortTermMemories.memories.filter(memory => 
            memory.metadata.importance >= this.memoryConfig.importanceThreshold
        );

        for (const memory of importantMemories) {
            // 生成摘要
            const summary = await this.generateMemorySummary(memory);
            
            // 创建长期记忆
            const longTermMemory = {
                ...memory,
                id: this.generateMemoryId(), // 新ID
                originalShortTermId: memory.id,
                summary: summary,
                consolidatedAt: new Date().toISOString(),
                metadata: {
                    ...memory.metadata,
                    consolidationScore: await this.calculateConsolidationScore(memory)
                }
            };

            // 添加到长期记忆
            this.longTermMemories.memories.push(longTermMemory);
            
            // 维护长期记忆大小
            if (this.longTermMemories.memories.length > this.memoryConfig.maxLongTerm) {
                this.removeLeastImportantLongTermMemory();
            }

            // 从短期记忆中移除
            this.shortTermMemories.memories = this.shortTermMemories.memories.filter(m => m.id !== memory.id);
        }

        // 更新统计
        this.longTermMemories.consolidationCount = (this.longTermMemories.consolidationCount || 0) + importantMemories.length;
        this.longTermMemories.lastUpdated = new Date().toISOString();
        this.shortTermMemories.lastUpdated = new Date().toISOString();

        // 保存更改
        await this.saveMemoryLayer('shortTerm');
        await this.saveMemoryLayer('longTerm');

        console.log(`记忆固化完成，转移了 ${importantMemories.length} 条记忆`);
    }

    // 生成记忆摘要
    async generateMemorySummary(memory) {
        // 简化版摘要生成，实际可以使用AI模型
        const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
        
        // 提取关键句子（基于句子长度和关键词）
        const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 0);
        const keySentences = sentences
            .filter(sentence => sentence.length > 10 && sentence.length < 200)
            .slice(0, 3); // 最多3个关键句子

        return {
            keyPoints: keySentences,
            topics: memory.metadata.topics,
            emotion: memory.metadata.emotion,
            wordCount: content.length
        };
    }

    // 计算固化分数
    async calculateConsolidationScore(memory) {
        let score = memory.metadata.importance;

        // 使用频率加成
        const usage = this.memoryIndex.usageStats[memory.id];
        if (usage) {
            score += Math.min(usage.accessCount * 0.1, 0.3);
        }

        // 时间衰减补偿（新记忆有优势）
        const ageInDays = (Date.now() - new Date(memory.timestamp).getTime()) / (24 * 60 * 60 * 1000);
        score += Math.max(0, (7 - ageInDays) * 0.05); // 一周内记忆有加成

        return Math.min(Math.max(score, 0), 1);
    }

    // 移除最不重要的长期记忆
    removeLeastImportantLongTermMemory() {
        if (this.longTermMemories.memories.length === 0) return;

        let minImportance = 1;
        let minIndex = -1;

        this.longTermMemories.memories.forEach((memory, index) => {
            const importance = memory.metadata.importance * 
                             (memory.metadata.consolidationScore || 0.5);
            
            if (importance < minImportance) {
                minImportance = importance;
                minIndex = index;
            }
        });

        if (minIndex !== -1) {
            const removedMemory = this.longTermMemories.memories.splice(minIndex, 1)[0];
            console.log(`移除长期记忆: ${removedMemory.id}, 重要性: ${minImportance}`);
        }
    }

    // 记忆检索
    async retrieveRelevantMemories(query, context = {}) {
        const relevantMemories = [];

        // 从各层记忆检索
        const shortTermResults = await this.searchInLayer('shortTerm', query, context);
        const longTermResults = await this.searchInLayer('longTerm', query, context);
        const permanentResults = await this.searchInLayer('permanent', query, context);

        // 合并结果并按相关性排序
        relevantMemories.push(...shortTermResults, ...longTermResults, ...permanentResults);
        relevantMemories.sort((a, b) => b.relevance - a.relevance);

        // 只返回相关性高的记忆
        const threshold = this.memoryConfig.importanceThreshold;
        const filteredMemories = relevantMemories.filter(m => m.relevance >= threshold);

        // 更新使用统计
        filteredMemories.forEach(memory => {
            this.updateUsageStats(memory.id);
        });

        return filteredMemories.slice(0, 10); // 最多返回10条
    }

    // 在特定记忆层搜索
    async searchInLayer(layer, query, context) {
        const memories = await this.loadMemoryLayer(layer);
        const results = [];

        for (const memory of memories.memories) {
            const relevance = await this.calculateRelevance(memory, query, context);
            if (relevance > 0) {
                results.push({
                    ...memory,
                    layer,
                    relevance
                });
            }
        }

        return results;
    }

    // 计算相关性
    async calculateRelevance(memory, query, context) {
        let relevance = 0;

        // 关键词匹配
        const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
        const queryKeywords = query.toLowerCase().split(/\s+/);
        
        let keywordMatches = 0;
        queryKeywords.forEach(keyword => {
            if (content.toLowerCase().includes(keyword)) {
                keywordMatches++;
            }
        });

        relevance += (keywordMatches / queryKeywords.length) * 0.4;

        // 主题匹配
        if (memory.metadata.topics) {
            const topicMatches = memory.metadata.topics.filter(topic => 
                query.toLowerCase().includes(topic.toLowerCase())
            ).length;
            relevance += (topicMatches / Math.max(memory.metadata.topics.length, 1)) * 0.3;
        }

        // 时间衰减（近期记忆更相关）
        const memoryAge = Date.now() - new Date(memory.timestamp).getTime();
        const ageInDays = memoryAge / (24 * 60 * 60 * 1000);
        const timeRelevance = Math.max(0, 1 - (ageInDays / 30)); // 30天线性衰减
        relevance += timeRelevance * 0.2;

        // 使用频率加成
        const usage = this.memoryIndex.usageStats[memory.id];
        if (usage) {
            relevance += Math.min(usage.accessCount * 0.05, 0.1);
        }

        return Math.min(Math.max(relevance, 0), 1);
    }

    // 更新使用统计
    async updateUsageStats(memoryId) {
        if (this.memoryIndex.usageStats[memoryId]) {
            this.memoryIndex.usageStats[memoryId].accessCount++;
            this.memoryIndex.usageStats[memoryId].lastAccessed = new Date().toISOString();
            this.memoryIndex.lastUpdated = new Date().toISOString();
            await this.saveMemoryLayer('index');
        }
    }

    // 启动固化调度器
    startConsolidationScheduler() {
        setInterval(() => {
            this.consolidateMemories();
        }, this.memoryConfig.consolidationInterval);

        console.log('记忆固化调度器已启动');
    }

    // 保存记忆层
    async saveMemoryLayer(layer) {
        const filePath = this.memoryConfig.storagePath + this.memoryLayers[layer];
        const data = this[`${layer}Memories`];
        await this.saveMemoryFile(filePath, data);
    }

    // 手动标记重要记忆
    async markAsImportant(memoryId, layer = 'shortTerm') {
        const memories = await this.loadMemoryLayer(layer);
        const memory = memories.memories.find(m => m.id === memoryId);
        
        if (memory) {
            memory.metadata.importance = 0.9; // 手动标记高重要性
            memory.metadata.manuallyMarked = true;
            memories.lastUpdated = new Date().toISOString();
            
            await this.saveMemoryLayer(layer);
            console.log(`记忆 ${memoryId} 已被标记为重要`);
        }
    }

    // 获取系统状态
    getSystemStatus() {
        return {
            shortTermCount: this.shortTermMemories.memories.length,
            longTermCount: this.longTermMemories.memories.length,
            permanentCount: this.permanentMemories.memories.length,
            lastConsolidation: this.longTermMemories.consolidationCount,
            storagePath: this.memoryConfig.storagePath
        };
    }

    // 清理过期记忆
    async cleanupExpiredMemories() {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

        // 清理长期记忆（30天未使用且重要性低）
        this.longTermMemories.memories = this.longTermMemories.memories.filter(memory => {
            const usage = this.memoryIndex.usageStats[memory.id];
            const lastUsed = usage ? new Date(usage.lastAccessed).getTime() : new Date(memory.timestamp).getTime();
            
            const isExpired = lastUsed < thirtyDaysAgo && memory.metadata.importance < 0.3;
            return !isExpired;
        });

        await this.saveMemoryLayer('longTerm');
        console.log('过期记忆清理完成');
    }
}

// QuickAdd 插件主类
class SmartCatMemoryPlugin {
    async onload() {
        console.log('加载 Smart Cat 记忆系统...');
        
        this.memorySystem = new HierarchicalMemorySystem();
        this.memorySystem.app = this.app;
        
        // 注册命令
        this.addCommand({
            id: 'show-memory-status',
            name: '显示记忆系统状态',
            callback: () => this.showMemoryStatus()
        });

        this.addCommand({
            id: 'force-consolidation',
            name: '强制执行记忆固化',
            callback: () => this.forceConsolidation()
        });

        this.addCommand({
            id: 'cleanup-memories',
            name: '清理过期记忆',
            callback: () => this.cleanupMemories()
        });

      
    }

    formatMemoriesForPrompt(memories) {
        return memories.map((memory, index) => {
            const content = typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content);
            return `${index + 1}. [${memory.layer}] ${content.substring(0, 200)}...`;
        }).join('\n');
    }

    async showMemoryStatus() {
        const status = this.memorySystem.getSystemStatus();
        const message = [
            '🐱 Smart Cat 记忆系统状态:',
            `📝 短期记忆: ${status.shortTermCount} 条`,
            `💾 长期记忆: ${status.longTermCount} 条`,
            `🔒 永久记忆: ${status.permanentCount} 条`,
            `🔄 固化次数: ${status.lastConsolidation} 次`,
            `📁 存储位置: ${status.storagePath}`
        ].join('\n');

        new Notice(message, 5000);
        console.log(message);
    }

    async forceConsolidation() {
        await this.memorySystem.consolidateMemories();
        new Notice('记忆固化完成');
    }

    async cleanupMemories() {
        await this.memorySystem.cleanupExpiredMemories();
        new Notice('过期记忆清理完成');
    }
}

