let moodSystem

const MOOD_MAP = {
  excellent: { emoji: '😻', state: '超开心' }, // 星星眼猫猫
  good: { emoji: '😸', state: '心情好' }, // 微笑猫猫
  neutral: { emoji: '😼', state: '平常心' }, // 中性猫猫
  low: { emoji: '😿', state: '小低落' }, // 哭泣猫猫
  poor: { emoji: '🙀', state: '不开心' } // 震惊难受猫猫
}

module.exports = async params => {
  const { quickAddApi } = params
  const catContainer = document.getElementById('smart-companion-cat')
  // 检查是否已经初始化
  if (window.smartCat.moodSystem) return

  // 初始化心情系统
  moodSystem = new MoodSystem(catContainer, quickAddApi)
  window.smartCat.app.moodSystem = moodSystem
  window.smartCat.app.promptGenerator = new AIPromptGenerator(moodSystem)
  window.smartCat.app.moodIndicator = new MoodIndicator(catContainer, moodSystem)
}

// 情感记忆系统
class EmotionalMemory {
  constructor(moodSystem) {
    this.moodSystem = moodSystem
    this.storagePath = 'CONFIG/SMART CAT/smart-cat-emotional-memory.json'

    // 记忆数据
    this.memoryData = {
      version: '2.0',
      lastUpdated: Date.now(),
      lastProcessed: {
        timestamp: 0,
        sessionId: null
      },
      memories: [],
      associations: {},
      statistics: {
        totalMemories: 0,
        memoryByType: {},
        averageIntensity: 0,
        recentActivity: []
      },
      learning: {
        patterns: {},
        preferences: {},
        adaptations: {}
      }
    }

    // 记忆配置
    this.config = {
      retentionDays: 30,
      maxMemories: 500,
      significanceThreshold: 0.3,
      compressionEnabled: true,
      autoSaveInterval: 5 * 60 * 1000 // 5分钟
    }

    // 标签系统
    this.tagCategories = {
      temporal: {
        hours: Array.from({ length: 24 }, (_, i) => `hour_${i}`),
        times: ['early_morning', 'morning', 'noon', 'afternoon', 'evening', 'night', 'late_night'],
        days: ['weekday', 'weekend'],
        periods: ['first_session', 'mid_session', 'late_session']
      },
      interaction: ['pet', 'click', 'learn', 'note_create', 'note_edit', 'note_read', 'note_open', 'note_rename', 'note_move', 'tag_add', 'link_create'],
      content: ['work', 'creative', 'study', 'journal', 'planning', 'code', 'long_form', 'linked_notes', 'list'],
      emotional: ['high_energy', 'low_energy', 'happy', 'sad', 'focused', 'distracted', 'creative', 'productive'],
      environmental: ['long_session', 'quick_check', 'focused_work', 'casual_browsing', 'organization']
    }

    // 当前会话状态
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      processedInteractions: new Set()
    }

    this.initializeSystem()
  }

  // 初始化系统
  async initializeSystem() {
    try {
      // 检查全局状态避免重复初始化
      if (window.smartCat?.emotionalMemory) {
        console.log('情感记忆系统已存在，使用现有实例')
        return window.smartCat.emotionalMemory
      }

      await this.ensureStoragePath()
      await this.loadMemoryData()

      // 注册全局实例
      window.smartCat = window.smartCat || {}
      window.smartCat.emotionalMemory = this

      console.log('小橘情感记忆系统初始化完成')

      // 启动自动保存
      this.startAutoSave()

      // 启动定期清理
      this.startCleanupCycle()
    } catch (error) {
      console.warn('情感记忆系统初始化失败:', error)
    }
  }

  // 确保存储路径存在
  async ensureStoragePath() {
    try {
      const rootPath = 'CONFIG'
      const configPath = 'CONFIG/SMART CAT'

      // 检查 CONFIG 目录
      try {
        await app.vault.adapter.list(rootPath)
      } catch (error) {
        await app.vault.adapter.mkdir(rootPath)
        console.log('创建 CONFIG 目录')
      }

      // 检查 SMART CAT 目录
      try {
        await app.vault.adapter.list(configPath)
      } catch (error) {
        await app.vault.adapter.mkdir(configPath)
        console.log('创建 SMART CAT 目录')
      }

      // 检查数据文件是否存在
      try {
        await app.vault.adapter.read(this.storagePath)
      } catch (error) {
        // 创建初始数据文件
        await this.saveMemoryData()
        console.log('创建情感记忆数据文件')
      }

      return true
    } catch (error) {
      console.warn('初始化存储路径失败:', error)
      return false
    }
  }

  // 加载记忆数据
  async loadMemoryData() {
    try {
      const fileContent = await app.vault.adapter.read(this.storagePath)
      const data = JSON.parse(fileContent)

      // 数据迁移和验证
      this.memoryData = this.migrateData(data)
      this.cleanupOldMemories()
      this.updateStatistics()

      console.log(`情感记忆数据加载成功，共 ${this.memoryData.memories.length} 条记忆`)
    } catch (error) {
      console.warn('情感记忆数据加载失败，使用默认数据:', error)
      await this.saveMemoryData()
    }
  }

  // 数据迁移
  migrateData(data) {
    if (!data.version) {
      // v1.0 到 v2.0 的数据迁移
      const migratedData = {
        ...this.memoryData,
        memories: data.memories || [],
        associations: data.associations || {},
        lastUpdated: data.lastSave || Date.now()
      }

      // 迁移统计信息
      migratedData.statistics.totalMemories = migratedData.memories.length
      migratedData.statistics.averageIntensity = this.calculateAverageIntensity(migratedData.memories)

      return migratedData
    }

    return { ...this.memoryData, ...data }
  }

  // 保存记忆数据
  async saveMemoryData() {
    try {
      this.memoryData.lastUpdated = Date.now()
      await app.vault.adapter.write(this.storagePath, JSON.stringify(this.memoryData, null, 2))
    } catch (error) {
      console.warn('情感记忆数据保存失败:', error)
    }
  }

  // 生成会话ID
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 记录记忆
  async recordMemory(context, emotionalResponse, intensity, options = {}) {
    // 检查重复记录
    const memoryKey = this.generateMemoryKey(context, emotionalResponse)
    if (this.currentSession.processedInteractions.has(memoryKey)) {
      return null
    }

    // 重要性评估
    const significance = this.calculateSignificance(emotionalResponse, intensity, context)
    if (significance < this.config.significanceThreshold) {
      return null // 忽略不重要的记忆
    }

    const memory = {
      id: this.generateMemoryId(),
      timestamp: Date.now(),
      sessionId: this.currentSession.id,
      context: this.normalizeContext(context),
      emotionalResponse: emotionalResponse,
      intensity: intensity,
      significance: significance,
      tags: this.extractTags(context),
      compressed: false
    }

    // 添加到记忆库
    this.memoryData.memories.push(memory)
    this.currentSession.processedInteractions.add(memoryKey)

    // 更新关联系统
    this.updateAssociations(memory)

    // 更新学习模式
    this.updateLearningPatterns(memory)

    // 更新统计信息
    this.updateStatistics()

    // 限制记忆数量
    if (this.memoryData.memories.length > this.config.maxMemories) {
      this.compressOldMemories()
    }

    // 异步保存
    this.debouncedSave()

    console.log(`记录新记忆: ${memory.tags.slice(0, 3).join(', ')} (重要性: ${significance.toFixed(2)})`)
    return memory
  }

  // 生成记忆键（用于去重）
  generateMemoryKey(context, emotionalResponse) {
    const normalizedContext = this.normalizeContext(context)
    const contextStr = JSON.stringify({
      type: normalizedContext.interactionType,
      time: normalizedContext.timeOfDay,
      tags: normalizedContext.tags?.slice(0, 2)
    })

    const responseStr = emotionalResponse
      .map(r => `${r.dimension}_${Math.sign(r.change)}`)
      .sort()
      .join('|')

    return `${contextStr}|${responseStr}`
  }

  // 生成记忆ID
  generateMemoryId() {
    return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // 标准化上下文
  normalizeContext(context) {
    if (typeof context === 'string') {
      try {
        context = JSON.parse(context)
      } catch (error) {
        context = { raw: context }
      }
    }

    const now = new Date()
    return {
      interactionType: context.interactionType || 'unknown',
      intensity: context.intensity || 1,
      timestamp: context.timestamp || now.getTime(),
      timeOfDay: context.timeOfDay || this.getTimeOfDay(now),
      dayOfWeek: context.dayOfWeek || now.getDay(),
      userActivity: context.userActivity || 'interaction',
      noteAction: context.noteAction,
      noteTitle: context.noteTitle,
      contentType: context.contentType,
      tags: context.tags || [],
      emotionalStateBefore: context.moodBefore || {},
      rawContext: context
    }
  }

  // 提取标签
  extractTags(context) {
    const tags = []
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    // 时间标签
    tags.push(`hour_${hour}`)
    tags.push(`time_${this.getTimeOfDay(now)}`)
    tags.push(dayOfWeek === 0 || dayOfWeek === 6 ? 'weekend' : 'weekday')

    // 会话阶段标签
    const sessionDuration = Date.now() - this.currentSession.startTime
    if (sessionDuration < 30 * 60 * 1000) tags.push('first_session')
    else if (sessionDuration < 2 * 60 * 60 * 1000) tags.push('mid_session')
    else tags.push('late_session')

    // 互动类型标签
    if (context.interactionType) {
      tags.push(`interaction_${context.interactionType}`)
    }

    // 笔记操作标签
    if (context.noteAction) {
      tags.push(`note_${context.noteAction}`)
    }

    // 内容类型标签
    if (context.contentType) {
      tags.push(`content_${context.contentType}`)
    }

    // 情感状态标签（基于之前的状态）
    if (context.emotionalStateBefore) {
      this.addEmotionalStateTags(tags, context.emotionalStateBefore)
    }

    // 环境标签
    this.addEnvironmentalTags(tags, context)

    return tags
  }

  // 添加情感状态标签
  addEmotionalStateTags(tags, emotionalState) {
    if (emotionalState.energy > 70) tags.push('high_energy')
    else if (emotionalState.energy < 30) tags.push('low_energy')

    if (emotionalState.happiness > 70) tags.push('happy')
    else if (emotionalState.happiness < 30) tags.push('sad')

    if (emotionalState.focus > 70) tags.push('focused')
    else if (emotionalState.focus < 30) tags.push('distracted')

    if (emotionalState.creativity > 70) tags.push('creative')
    if (emotionalState.productivity > 70) tags.push('productive')
  }

  // 添加环境标签
  addEnvironmentalTags(tags, context) {
    const sessionDuration = Date.now() - this.currentSession.startTime

    if (sessionDuration > 60 * 60 * 1000) tags.push('long_session')
    if (sessionDuration < 5 * 60 * 1000) tags.push('quick_check')

    if (context.userActivity === 'focused_work') tags.push('focused_work')
    if (context.userActivity === 'organization') tags.push('organization')
  }

  // 获取时间段
  getTimeOfDay(date) {
    const hour = date.getHours()
    if (hour >= 5 && hour < 8) return 'early_morning'
    if (hour >= 8 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 14) return 'noon'
    if (hour >= 14 && hour < 18) return 'afternoon'
    if (hour >= 18 && hour < 22) return 'evening'
    if (hour >= 22 && hour < 24) return 'night'
    return 'late_night'
  }

  // 计算重要性
  calculateSignificance(emotionalResponse, intensity, context) {
    let significance = 0

    // 情感变化幅度
    const totalChange = emotionalResponse.reduce((sum, response) => {
      return sum + Math.abs(response.change)
    }, 0)
    significance += totalChange * 0.3

    // 强度系数
    significance += intensity * 0.4

    // 互动类型权重
    const typeWeights = {
      pet: 0.8,
      note_create: 0.7,
      achievement: 0.9,
      learn: 0.6,
      note_edit: 0.5,
      note_read: 0.4,
      click: 0.2
    }
    significance += (typeWeights[context.interactionType] || 0.3) * 0.3

    return Math.min(1, significance)
  }

  // 更新关联系统
  updateAssociations(memory) {
    memory.tags.forEach(tag => {
      if (!this.memoryData.associations[tag]) {
        this.memoryData.associations[tag] = {}
      }

      memory.emotionalResponse.forEach(response => {
        const { dimension, change } = response
        const currentValue = this.memoryData.associations[tag][dimension] || 0
        const newValue = currentValue + change * memory.intensity * memory.significance

        // 应用衰减和边界
        this.memoryData.associations[tag][dimension] = this.applyAssociationBounds(newValue)
      })
    })
  }

  // 应用关联边界
  applyAssociationBounds(value) {
    // 限制在 -10 到 10 之间，并应用轻微衰减
    const bounded = Math.max(-10, Math.min(10, value))
    return bounded * 0.995 // 轻微衰减
  }

  // 获取关联情感
  getAssociatedEmotions(tags) {
    const emotions = {}
    const tagWeights = this.calculateTagWeights(tags)

    tags.forEach(tag => {
      if (this.memoryData.associations[tag]) {
        Object.entries(this.memoryData.associations[tag]).forEach(([dimension, value]) => {
          const weight = tagWeights[tag] || 1
          emotions[dimension] = (emotions[dimension] || 0) + value * weight
        })
      }
    })

    // 归一化处理
    return this.normalizeEmotionEffects(emotions)
  }

  // 计算标签权重
  calculateTagWeights(tags) {
    const weights = {}
    const totalTags = tags.length

    tags.forEach(tag => {
      // 更具体的标签获得更高权重
      if (tag.startsWith('hour_')) weights[tag] = 1.5
      else if (tag.startsWith('interaction_')) weights[tag] = 1.3
      else if (tag.startsWith('content_')) weights[tag] = 1.2
      else weights[tag] = 1.0
    })

    return weights
  }

  // 归一化情感效果
  normalizeEmotionEffects(emotions) {
    const normalized = {}
    const maxEffect = Math.max(...Object.values(emotions).map(Math.abs), 1)

    Object.entries(emotions).forEach(([dimension, value]) => {
      normalized[dimension] = (value / maxEffect) * 2 // 缩放为 -2 到 2
    })

    return normalized
  }

  // 更新学习模式
  updateLearningPatterns(memory) {
    const { context, emotionalResponse } = memory

    // 学习互动模式
    if (context.interactionType) {
      const patternKey = `interaction_${context.interactionType}`
      if (!this.memoryData.learning.patterns[patternKey]) {
        this.memoryData.learning.patterns[patternKey] = {
          count: 0,
          totalIntensity: 0,
          averageResponse: {}
        }
      }

      const pattern = this.memoryData.learning.patterns[patternKey]
      pattern.count++
      pattern.totalIntensity += memory.intensity

      // 更新平均响应
      emotionalResponse.forEach(response => {
        const currentAvg = pattern.averageResponse[response.dimension] || 0
        pattern.averageResponse[response.dimension] = (currentAvg * (pattern.count - 1) + response.change) / pattern.count
      })
    }

    // 学习时间偏好
    if (context.timeOfDay) {
      const timeKey = `time_${context.timeOfDay}`
      this.memoryData.learning.preferences[timeKey] = (this.memoryData.learning.preferences[timeKey] || 0) + memory.significance
    }
  }

  // 获取相关记忆
  getRelevantMemories(tags, limit = 5) {
    const scoredMemories = this.memoryData.memories.map(memory => {
      const relevance = this.calculateRelevance(memory, tags)
      return { memory, relevance }
    })

    return scoredMemories
      .filter(item => item.relevance > 0.3)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit)
      .map(item => item.memory)
  }

  // 计算相关性
  calculateRelevance(memory, currentTags) {
    let score = 0
    const memoryTags = new Set(memory.tags)

    // 标签匹配
    currentTags.forEach(tag => {
      if (memoryTags.has(tag)) {
        score += 1
      }
    })

    // 时间衰减（越近的记忆越相关）
    const timeDiff = Date.now() - memory.timestamp
    const timeFactor = Math.max(0, 1 - timeDiff / (7 * 24 * 60 * 60 * 1000)) // 一周衰减
    score *= timeFactor

    // 重要性权重
    score *= memory.significance

    return score / Math.max(1, currentTags.length)
  }

  // 更新统计信息
  updateStatistics() {
    const memories = this.memoryData.memories

    this.memoryData.statistics.totalMemories = memories.length
    this.memoryData.statistics.averageIntensity = this.calculateAverageIntensity(memories)
    this.memoryData.statistics.memoryByType = this.calculateMemoryByType(memories)

    // 更新近期活动
    this.updateRecentActivity()
  }

  // 计算平均强度
  calculateAverageIntensity(memories) {
    if (memories.length === 0) return 0
    const total = memories.reduce((sum, memory) => sum + memory.intensity, 0)
    return total / memories.length
  }

  // 按类型计算记忆
  calculateMemoryByType(memories) {
    const byType = {}

    memories.forEach(memory => {
      const type = memory.context.interactionType || 'unknown'
      byType[type] = (byType[type] || 0) + 1
    })

    return byType
  }

  // 更新近期活动
  updateRecentActivity() {
    const now = Date.now()
    const recentMemories = this.memoryData.memories
      .filter(memory => now - memory.timestamp < 24 * 60 * 60 * 1000) // 24小时内
      .slice(-10) // 最近10条

    this.memoryData.statistics.recentActivity = recentMemories.map(memory => ({
      time: new Date(memory.timestamp).toLocaleTimeString(),
      type: memory.context.interactionType,
      significance: memory.significance,
      tags: memory.tags.slice(0, 3)
    }))
  }

  // 压缩旧记忆
  compressOldMemories() {
    if (!this.config.compressionEnabled) return

    const now = Date.now()
    const compressionThreshold = 7 * 24 * 60 * 60 * 1000 // 7天前的记忆

    this.memoryData.memories = this.memoryData.memories.filter(memory => {
      if (now - memory.timestamp > compressionThreshold && !memory.compressed) {
        // 压缩记忆：移除详细上下文，保留关键信息
        memory.compressed = true
        memory.context = {
          interactionType: memory.context.interactionType,
          timeOfDay: memory.context.timeOfDay,
          compressed: true
        }
        memory.tags = memory.tags.slice(0, 5) // 只保留前5个标签
      }
      return true
    })

    // 如果还是太多，移除最旧的记忆
    if (this.memoryData.memories.length > this.config.maxMemories) {
      this.memoryData.memories.sort((a, b) => b.timestamp - a.timestamp) // 从新到旧
      this.memoryData.memories = this.memoryData.memories.slice(0, this.config.maxMemories)
    }
  }

  // 清理旧记忆
  cleanupOldMemories() {
    const cutoffTime = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000
    this.memoryData.memories = this.memoryData.memories.filter(memory => memory.timestamp > cutoffTime)
  }

  // 启动自动保存
  startAutoSave() {
    setInterval(() => {
      this.saveMemoryData()
    }, this.config.autoSaveInterval)
  }

  // 启动清理周期
  startCleanupCycle() {
    // 每天清理一次
    setInterval(() => {
      this.cleanupOldMemories()
      this.compressOldMemories()
      this.updateStatistics()
      this.saveMemoryData()
    }, 24 * 60 * 60 * 1000)
  }

  // 防抖保存
  debouncedSave = this.debounce(() => {
    this.saveMemoryData()
  }, 5000)

  // 防抖函数
  debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // 获取记忆报告
  getMemoryReport() {
    return {
      summary: {
        totalMemories: this.memoryData.statistics.totalMemories,
        averageIntensity: this.memoryData.statistics.averageIntensity,
        memoryByType: this.memoryData.statistics.memoryByType,
        activeTags: Object.keys(this.memoryData.associations).length
      },
      recentActivity: this.memoryData.statistics.recentActivity,
      learning: {
        patterns: this.memoryData.learning.patterns,
        preferences: this.memoryData.learning.preferences
      },
      associations: this.getTopAssociations(10)
    }
  }

  // 获取顶部关联
  getTopAssociations(limit) {
    const associations = Object.entries(this.memoryData.associations)
      .map(([tag, effects]) => {
        const totalEffect = Object.values(effects).reduce((sum, effect) => sum + Math.abs(effect), 0)
        return { tag, effects, totalEffect }
      })
      .sort((a, b) => b.totalEffect - a.totalEffect)
      .slice(0, limit)

    return associations.reduce((obj, item) => {
      obj[item.tag] = item.effects
      return obj
    }, {})
  }

  // 重置记忆数据
  async resetMemoryData() {
    this.memoryData = {
      version: '2.0',
      lastUpdated: Date.now(),
      lastProcessed: { timestamp: 0, sessionId: null },
      memories: [],
      associations: {},
      statistics: {
        totalMemories: 0,
        memoryByType: {},
        averageIntensity: 0,
        recentActivity: []
      },
      learning: {
        patterns: {},
        preferences: {},
        adaptations: {}
      }
    }

    this.currentSession.processedInteractions.clear()
    await this.saveMemoryData()

    console.log('情感记忆数据已重置')
  }

  // 导出记忆数据
  exportMemoryData() {
    return {
      ...this.memoryData,
      exportTime: new Date().toISOString(),
      exportVersion: '2.0'
    }
  }

  // 手动触发记忆分析
  analyzeMemoryPatterns() {
    const analysis = {
      timePatterns: this.analyzeTimePatterns(),
      interactionPatterns: this.analyzeInteractionPatterns(),
      emotionalTrends: this.analyzeEmotionalTrends()
    }

    this.memoryData.learning.analysis = analysis
    return analysis
  }

  // 分析时间模式
  analyzeTimePatterns() {
    const timeStats = {}

    this.memoryData.memories.forEach(memory => {
      const timeKey = memory.context.timeOfDay
      if (!timeStats[timeKey]) {
        timeStats[timeKey] = { count: 0, totalSignificance: 0 }
      }
      timeStats[timeKey].count++
      timeStats[timeKey].totalSignificance += memory.significance
    })

    return timeStats
  }

  // 分析互动模式
  analyzeInteractionPatterns() {
    const interactionStats = {}

    this.memoryData.memories.forEach(memory => {
      const type = memory.context.interactionType
      if (!interactionStats[type]) {
        interactionStats[type] = {
          count: 0,
          averageIntensity: 0,
          commonResponses: {}
        }
      }

      interactionStats[type].count++
      interactionStats[type].averageIntensity = (interactionStats[type].averageIntensity * (interactionStats[type].count - 1) + memory.intensity) / interactionStats[type].count

      // 统计常见情感反应
      memory.emotionalResponse.forEach(response => {
        const key = `${response.dimension}_${response.change > 0 ? 'pos' : 'neg'}`
        interactionStats[type].commonResponses[key] = (interactionStats[type].commonResponses[key] || 0) + 1
      })
    })

    return interactionStats
  }

  // 分析情感趋势
  analyzeEmotionalTrends() {
    const recentMemories = this.memoryData.memories
      .filter(m => Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000) // 最近7天
      .slice(-50) // 最近50条

    const trends = {
      happiness: this.calculateTrend(recentMemories, 'happiness'),
      energy: this.calculateTrend(recentMemories, 'energy'),
      creativity: this.calculateTrend(recentMemories, 'creativity'),
      focus: this.calculateTrend(recentMemories, 'focus')
    }

    return trends
  }

  // 计算趋势
  calculateTrend(memories, dimension) {
    const changes = memories
      .flatMap(memory => memory.emotionalResponse)
      .filter(response => response.dimension === dimension)
      .map(response => response.change)

    if (changes.length === 0) return 0

    const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length
    return averageChange
  }
}

// 个性成长系统
class PersonalityGrowth {
  constructor() {
    this.traits = {
      playfulness: 50,
      sociability: 50,
      independence: 50,
      curiosity: 50
    }
    this.growthHistory = []
    this.storageKey = 'smart-cat-personality-growth'
    this.loadFromStorage()
  }

  getPersonalityInfluence() {
    // 基于个性特质计算对心情的影响系数
    return {
      happinessMultiplier: 1 + (this.traits.playfulness - 50) * 0.01,
      affectionMultiplier: 1 + (this.traits.sociability - 50) * 0.015,
      decayResistance: 1 - (this.traits.independence - 50) * 0.005,
      curiosityBoost: 1 + (this.traits.curiosity - 50) * 0.01
    }
  }

  saveToStorage() {
    try {
      const data = {
        traits: this.traits,
        growthHistory: (this.growthHistory || []).slice(-50),
        lastSave: Date.now(),
        version: '1.0'
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.warn('个性成长数据保存失败:', error)
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey)
      if (saved) {
        const data = JSON.parse(saved)
        const daysSinceSave = (Date.now() - data.lastSave) / (1000 * 60 * 60 * 24)
        if (daysSinceSave <= 30) {
          this.traits = data.traits || this.traits
          this.growthHistory = data.growthHistory || []
        }
      }
    } catch (error) {
      console.warn('个性成长数据加载失败:', error)
    }
  }

  developBasedOnInteraction(interactionType, intensity) {
    const developmentEffects = {
      pet: { sociability: 1, independence: -0.5 },
      click: { curiosity: 0.5, playfulness: 0.3 },
      learn: { curiosity: 1, independence: 0.3 },
      note_create: { curiosity: 0.8, focus: 0.5 },
      note_edit: { focus: 0.6, curiosity: 0.3 },
      note_read: { curiosity: 0.4, focus: 0.2 }
    }

    const effects = developmentEffects[interactionType]
    if (effects) {
      Object.entries(effects).forEach(([trait, change]) => {
        this.traits[trait] = Math.max(0, Math.min(100, this.traits[trait] + change * intensity))
      })

      this.recordGrowthHistory(interactionType, effects, intensity)
      this.saveToStorage()
    }
  }

  recordGrowthHistory(interactionType, effects, intensity) {
    if (!this.growthHistory) {
      this.growthHistory = []
    }

    const growthRecord = {
      timestamp: Date.now(),
      interactionType,
      effects,
      intensity,
      traitsBefore: { ...this.traits }
    }

    this.growthHistory.push(growthRecord)

    if (this.growthHistory.length > 100) {
      this.growthHistory = this.growthHistory.slice(-50)
    }
  }

  getGrowthHistory() {
    return this.growthHistory || []
  }
}

// 情感化时间管理系统
class TimeEmotionSystem {
  constructor(moodSystem) {
    this.moodSystem = moodSystem
    this.storagePath = 'CONFIG/SMART CAT/smart-cat-time-emotion.json'

    // 时间情绪数据
    this.timeData = {
      version: '1.0',
      lastUpdated: Date.now(),
      lastProcessed: {
        date: null, // 最后处理日期 'YYYY-MM-DD'
        timeSegment: null, // 最后处理时间段
        hour: null, // 最后处理小时
        timestamp: 0 // 最后处理时间戳
      },
      dailyStats: {},
      emotionHistory: [],
      specialDates: this.initializeSpecialDates()
    }

    // 时间段配置
    this.timeSegments = {
      early_morning: { start: 5, end: 8, name: '清晨', emoji: '🌅' },
      morning: { start: 8, end: 12, name: '上午', emoji: '☀️' },
      noon: { start: 12, end: 14, name: '中午', emoji: '🍽️' },
      afternoon: { start: 14, end: 18, name: '下午', emoji: '🌞' },
      evening: { start: 18, end: 22, name: '晚上', emoji: '🌙' },
      night: { start: 22, end: 24, name: '深夜', emoji: '🌌' },
      late_night: { start: 0, end: 5, name: '凌晨', emoji: '✨' }
    }

    // 时间段情绪影响
    this.segmentEffects = {
      early_morning: {
        relaxation: 2,
        energy: -1,
        focus: 1,
        message: '清晨的宁静让人心情平和...'
      },
      morning: {
        energy: 3,
        focus: 2,
        productivity: 2,
        message: '新的一天开始啦！充满活力的早晨~'
      },
      noon: {
        energy: -1,
        relaxation: 1,
        happiness: 1,
        message: '午间时分，记得适当休息哦'
      },
      afternoon: {
        focus: 2,
        creativity: 1,
        productivity: 1,
        message: '下午是专注工作的好时光'
      },
      evening: {
        relaxation: 2,
        creativity: 1,
        affection: 1,
        message: '夜晚降临，适合放松和思考'
      },
      night: {
        relaxation: 1,
        focus: -1,
        energy: -2,
        message: '夜深了，该准备休息了'
      },
      late_night: {
        energy: -3,
        focus: -2,
        relaxation: -1,
        message: '这么晚还不睡，小橘有点担心呢'
      }
    }

    // 星期情绪影响
    this.weekdayEffects = {
      0: { relaxation: 2, creativity: 1 }, // 周日
      1: { focus: 2, productivity: 2 }, // 周一
      5: { happiness: 2, relaxation: 1 }, // 周五
      6: { energy: 1, affection: 2 } // 周六
    }

    this.initializeSystem()
  }

  // 初始化系统
  async initializeSystem() {
    try {
      await this.ensureStoragePath()
      await this.loadTimeData()
      console.log('小橘时间情绪系统初始化完成')

      // 启动定时检查
      this.startTimeMonitoring()

      // 立即检查一次当前时间情绪
      this.checkTimeEmotion()
    } catch (error) {
      console.warn('时间情绪系统初始化失败:', error)
    }
  }

  // 确保存储路径存在
  async ensureStoragePath() {
    try {
      const rootPath = 'CONFIG'
      const configPath = 'CONFIG/SMART CAT'

      // 检查 CONFIG 目录
      try {
        await app.vault.adapter.list(rootPath)
      } catch (error) {
        await app.vault.adapter.mkdir(rootPath)
        console.log('创建 CONFIG 目录')
      }

      // 检查 SMART CAT 目录
      try {
        await app.vault.adapter.list(configPath)
      } catch (error) {
        await app.vault.adapter.mkdir(configPath)
        console.log('创建 SMART CAT 目录')
      }

      // 检查数据文件是否存在
      try {
        await app.vault.adapter.read(this.storagePath)
      } catch (error) {
        // 创建初始数据文件
        await this.saveTimeData()
        console.log('创建时间情绪数据文件')
      }

      return true
    } catch (error) {
      console.warn('初始化存储路径失败:', error)
      return false
    }
  }

  // 加载时间数据
  async loadTimeData() {
    try {
      const fileContent = await app.vault.adapter.read(this.storagePath)
      const data = JSON.parse(fileContent)

      // 数据迁移和验证
      this.timeData = this.migrateData(data)
      this.cleanupOldData()

      console.log('时间情绪数据加载成功')
    } catch (error) {
      console.warn('时间情绪数据加载失败，使用默认数据:', error)
      await this.saveTimeData()
    }
  }

  // 数据迁移
  migrateData(data) {
    if (!data.version) {
      // 旧版本数据迁移
      return {
        ...this.timeData,
        lastProcessed: data.lastProcessed || this.timeData.lastProcessed,
        emotionHistory: data.emotionHistory || []
      }
    }
    return { ...this.timeData, ...data }
  }

  // 清理旧数据
  cleanupOldData() {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    this.timeData.emotionHistory = this.timeData.emotionHistory.filter(record => record.timestamp > thirtyDaysAgo)
  }

  // 保存时间数据
  async saveTimeData() {
    try {
      this.timeData.lastUpdated = Date.now()
      await app.vault.adapter.write(this.storagePath, JSON.stringify(this.timeData, null, 2))
    } catch (error) {
      console.warn('时间情绪数据保存失败:', error)
    }
  }

  // 启动时间监控
  startTimeMonitoring() {
    // 每分钟检查时间情绪变化
    setInterval(() => {
      this.checkTimeEmotion()
    }, 60 * 1000)

    // 每小时保存一次数据
    setInterval(() => {
      this.saveTimeData()
    }, 60 * 60 * 1000)

    // 每天清理一次数据
    setInterval(() => {
      this.cleanupOldData()
      this.saveTimeData()
    }, 24 * 60 * 60 * 1000)
  }

  // 检查时间情绪
  checkTimeEmotion() {
    const now = new Date()
    const currentDate = this.getDateKey(now)
    const currentHour = now.getHours()
    const currentSegment = this.getCurrentTimeSegment(currentHour)
    const currentTimestamp = now.getTime()

    // 检查是否已经处理过当前时间段
    if (this.shouldProcessTime(currentDate, currentSegment, currentHour, currentTimestamp)) {
      this.applyTimeEmotionEffects(currentDate, currentSegment, currentHour)
      this.updateLastProcessed(currentDate, currentSegment, currentHour, currentTimestamp)
      this.saveTimeData()
    }
  }

  // 判断是否需要处理当前时间
  shouldProcessTime(date, segment, hour, timestamp) {
    const last = this.timeData.lastProcessed

    // 如果日期变化，总是处理
    if (date !== last.date) {
      return true
    }

    // 如果时间段变化，需要处理
    if (segment !== last.timeSegment) {
      return true
    }

    // 如果小时变化且超过5分钟，需要处理
    if (hour !== last.hour && timestamp - last.timestamp > 5 * 60 * 1000) {
      return true
    }

    // 防止重复处理：同一时间段内至少间隔30分钟
    return timestamp - last.timestamp > 30 * 60 * 1000
  }

  // 更新时间处理记录
  updateLastProcessed(date, segment, hour, timestamp) {
    this.timeData.lastProcessed = {
      date: date,
      timeSegment: segment,
      hour: hour,
      timestamp: timestamp
    }
  }

  // 应用时间情绪效果
  applyTimeEmotionEffects(date, segment, hour) {
    const effects = this.calculateTimeEmotionEffects(date, segment, hour)

    // 应用情绪效果
    Object.entries(effects.effects).forEach(([dimension, change]) => {
      if (change !== 0) {
        this.moodSystem.updateMood(dimension, change, `time_${segment}`)
      }
    })

    // 记录情绪历史
    this.recordEmotionHistory(date, segment, effects)

    // 有概率显示时间消息
    if (Math.random() < 0.3 && effects.message) {
      this.moodSystem.showMoodFeedback(effects.message)
    }
  }

  // 计算时间情绪效果
  calculateTimeEmotionEffects(date, segment, hour) {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    let effects = { ...(this.segmentEffects[segment]?.effects || {}) }
    let message = this.segmentEffects[segment]?.message

    // 叠加星期效果
    const weekdayEffect = this.weekdayEffects[dayOfWeek]
    if (weekdayEffect) {
      Object.entries(weekdayEffect).forEach(([dimension, change]) => {
        effects[dimension] = (effects[dimension] || 0) + change
      })
    }

    // 周末效果
    if (isWeekend) {
      effects.relaxation = (effects.relaxation || 0) + 1
      effects.happiness = (effects.happiness || 0) + 1
    }

    // 特殊日期效果
    const specialDateEffect = this.checkSpecialDates(now)
    if (specialDateEffect) {
      Object.entries(specialDateEffect.effects).forEach(([dimension, change]) => {
        effects[dimension] = (effects[dimension] || 0) + change
      })
      if (specialDateEffect.message) {
        message = specialDateEffect.message
      }
    }

    // 长时间使用检查
    const overuseEffect = this.checkOveruseEffects()
    if (overuseEffect) {
      Object.entries(overuseEffect.effects).forEach(([dimension, change]) => {
        effects[dimension] = (effects[dimension] || 0) + change
      })
      if (overuseEffect.message) {
        message = overuseEffect.message
      }
    }

    return {
      effects: effects,
      message: message,
      segment: segment,
      hour: hour,
      timestamp: Date.now()
    }
  }

  // 获取当前时间段
  getCurrentTimeSegment(hour) {
    for (const [segment, config] of Object.entries(this.timeSegments)) {
      if (config.start <= hour && hour < config.end) {
        return segment
      }
    }
    return 'late_night' // 默认返回凌晨
  }

  // 获取日期键
  getDateKey(date) {
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  // 初始化特殊日期
  initializeSpecialDates() {
    const currentYear = new Date().getFullYear()
    return {
      // 小橘的生日 - 10月10日
      [`${currentYear}-10-10`]: {
        name: '小橘生日',
        effects: { happiness: 10, energy: 5, affection: 8 },
        message: '今天是小橘的生日！好开心你能陪我一起过~ 🎂'
      },
      // 春节（示例日期，需要根据实际农历调整）
      [`${currentYear}-02-10`]: {
        name: '春节',
        effects: { happiness: 8, affection: 5, relaxation: 3 },
        message: '春节快乐！新的一年也要多多陪伴哦~ 🧧'
      },
      // 用户生日（需要从配置中获取）
      // 圣诞节
      [`${currentYear}-12-25`]: {
        name: '圣诞节',
        effects: { happiness: 5, curiosity: 3, affection: 2 },
        message: '圣诞快乐！节日的气氛让人心情愉悦呢~ 🎄'
      }
    }
  }

  // 检查特殊日期
  checkSpecialDates(date) {
    const dateKey = this.getDateKey(date)
    return this.timeData.specialDates[dateKey]
  }

  // 检查过度使用效果
  checkOveruseEffects() {
    // 获取今天的情绪记录
    const today = this.getDateKey(new Date())
    const todayEmotions = this.timeData.emotionHistory.filter(record => record.date === today && record.effects.energy < 0)

    if (todayEmotions.length >= 3) {
      return {
        effects: { energy: -2, focus: -1, relaxation: -3 },
        message: '今天使用时间有点长呢，小橘建议适当休息~'
      }
    }

    return null
  }

  // 记录情绪历史
  recordEmotionHistory(date, segment, emotionData) {
    const record = {
      date: date,
      segment: segment,
      timestamp: Date.now(),
      effects: emotionData.effects,
      message: emotionData.message
    }

    this.timeData.emotionHistory.push(record)

    // 限制历史记录数量
    if (this.timeData.emotionHistory.length > 1000) {
      this.timeData.emotionHistory = this.timeData.emotionHistory.slice(-500)
    }
  }

  // 获取时间情绪报告
  getTimeEmotionReport() {
    const now = new Date()
    const currentSegment = this.getCurrentTimeSegment(now.getHours())
    const segmentConfig = this.timeSegments[currentSegment]

    return {
      current: {
        segment: currentSegment,
        name: segmentConfig.name,
        emoji: segmentConfig.emoji,
        hour: now.getHours(),
        effects: this.segmentEffects[currentSegment]?.effects || {}
      },
      today: {
        emotionChanges: this.timeData.emotionHistory.filter(record => record.date === this.getDateKey(now)).length,
        lastProcessed: this.timeData.lastProcessed
      },
      history: {
        totalRecords: this.timeData.emotionHistory.length,
        recentSegments: this.getRecentSegmentStats()
      }
    }
  }

  // 获取最近时间段统计
  getRecentSegmentStats() {
    const recent = this.timeData.emotionHistory.slice(-20)
    const stats = {}

    recent.forEach(record => {
      if (!stats[record.segment]) {
        stats[record.segment] = 0
      }
      stats[record.segment]++
    })

    return stats
  }

  // 添加特殊日期
  async addSpecialDate(dateString, name, effects, message) {
    this.timeData.specialDates[dateString] = {
      name: name,
      effects: effects,
      message: message
    }
    await this.saveTimeData()
  }

  // 移除特殊日期
  async removeSpecialDate(dateString) {
    delete this.timeData.specialDates[dateString]
    await this.saveTimeData()
  }

  // 手动触发时间情绪检查
  async forceTimeEmotionCheck() {
    this.checkTimeEmotion()
    await this.saveTimeData()
    return this.getTimeEmotionReport()
  }
}

// Obsidian
class ObsidianInteractionSystem {
  constructor(moodSystem, quickAddApi) {
    this.moodSystem = moodSystem
    this.quickAddApi = quickAddApi
    this.storagePath = 'CONFIG/SMART CAT/smart-cat-editing-data.json'

    // 真实编辑数据
    this.editingData = {
      version: '2.0',
      lastUpdated: Date.now(),
      realInputStats: {
        totalChars: 0,
        totalWords: 0,
        totalSessions: 0,
        totalActiveMinutes: 0,
        dailyStats: {},
        weeklyStats: {},
        monthlyStats: {}
      },
      writingSessions: [],
      writingPatterns: {
        timePreferences: {},
        contentTypes: {},
        efficiencyTrends: []
      },
      qualityMetrics: {
        dailyAverages: {},
        weeklyAverages: {},
        milestones: []
      },
      userBehavior: {
        favoriteTimes: {},
        productivityPeaks: {},
        consistency: {}
      }
    }

    // 实时编辑状态
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      charCount: 0,
      wordCount: 0,
      inputEvents: 0,
      backspaceCount: 0,
      deleteCount: 0,
      isActive: false,
      contentChanges: []
    }

    // 输入追踪状态
    this.inputState = {
      lastKeyTime: 0,
      lastKey: '',
      isComposing: false,
      lastContent: '',
      lastContentLength: 0,
      continuousInput: 0,
      lastPasteTime: 0
    }

    this.noteWordCache = new Map() // 存储每个笔记的已知字数
    this.processedNotes = new Set() // 已处理的笔记，避免重复统计

    this.initializeStorage()
    this.setupRealInputMonitoring()
  }

  // 初始化存储
  async initializeStorage() {
    try {
      await this.ensureStoragePath()
      await this.loadEditingData()
      console.log('小橘编辑数据系统初始化完成')
    } catch (error) {
      console.warn('小橘编辑数据初始化失败:', error)
      // 使用默认数据
      await this.saveEditingData()
    }
  }
  // 生成唯一会话ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  }

  // 确保存储路径存在
  async ensureStoragePath() {
    try {
      // 检查根目录是否存在
      const rootPath = 'CONFIG'
      const configPath = 'CONFIG/SMART CAT'

      // 检查 CONFIG 目录
      try {
        await app.vault.adapter.list(rootPath)
      } catch (error) {
        // 创建 CONFIG 目录
        await app.vault.adapter.mkdir(rootPath)
        console.log('创建 CONFIG 目录')
      }

      // 检查 SMART CAT 目录
      try {
        await app.vault.adapter.list(configPath)
      } catch (error) {
        // 创建 SMART CAT 目录
        await app.vault.adapter.mkdir(configPath)
        console.log('创建 SMART CAT 目录')
      }

      // 检查数据文件是否存在
      try {
        await app.vault.adapter.read(this.storagePath)
      } catch (error) {
        // 创建初始数据文件
        const initialData = {
          version: '2.0',
          lastUpdated: Date.now(),
          realInputStats: {
            totalChars: 0,
            totalWords: 0,
            totalSessions: 0,
            totalActiveMinutes: 0,
            dailyStats: {},
            weeklyStats: {},
            monthlyStats: {}
          },
          writingSessions: [],
          writingPatterns: {
            timePreferences: {},
            contentTypes: {},
            efficiencyTrends: []
          },
          qualityMetrics: {
            dailyAverages: {},
            weeklyAverages: {},
            milestones: []
          }
        }
        await app.vault.adapter.write(this.storagePath, JSON.stringify(initialData, null, 2))
        console.log('创建初始数据文件')
      }

      return true
    } catch (error) {
      console.warn('初始化存储路径失败:', error)
      return false
    }
  }

  // 加载编辑数据
  async loadEditingData() {
    try {
      // 确保存储路径存在
      await this.ensureStoragePath()

      const fileContent = await app.vault.adapter.read(this.storagePath)
      const data = JSON.parse(fileContent)

      this.editingData = this.migrateData(data)
      this.cleanupOldData()

      console.log('小橘编辑数据加载成功')
    } catch (error) {
      console.warn('小橘编辑数据加载失败，使用默认数据:', error)
      // 使用默认数据并立即保存
      await this.saveEditingData()
    }
  }

  // 数据迁移
  migrateData(data) {
    if (!data.version) {
      return {
        ...this.editingData,
        realInputStats: data.realInputStats || this.editingData.realInputStats,
        writingSessions: data.writingSessions || []
      }
    }
    return { ...this.editingData, ...data }
  }

  // 清理过期数据
  cleanupOldData() {
    const now = Date.now()
    const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000

    this.editingData.writingSessions = this.editingData.writingSessions.filter(session => session.endTime > threeMonthsAgo)

    const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000
    Object.keys(this.editingData.realInputStats.dailyStats).forEach(date => {
      if (new Date(date).getTime() < sixMonthsAgo) {
        delete this.editingData.realInputStats.dailyStats[date]
      }
    })
  }

  // 保存编辑数据
  async saveEditingData() {
    try {
      this.editingData.lastUpdated = Date.now()

      // 确保存储路径存在
      const pathReady = await this.ensureStoragePath()
      if (!pathReady) {
        console.warn('存储路径未就绪，跳过保存')
        return
      }

      // 保存到文件
      await app.vault.adapter.write(this.storagePath, JSON.stringify(this.editingData, null, 2))
    } catch (error) {
      console.warn('小橘编辑数据保存失败:', error)
      // 如果是文件不存在错误，尝试重新初始化
      if (error.message.includes('not found') || error.message.includes('ENOENT')) {
        console.log('尝试重新初始化存储路径...')
        await this.ensureStoragePath()
      }
    }
  }

  // 确保目录存在
  async ensureDirectoryExists() {
    const dirPath = this.storagePath.split('/').slice(0, -1).join('/')
    try {
      await app.vault.adapter.mkdir(dirPath)
    } catch (error) {
      // 目录可能已存在
    }
  }

  // 设置真实输入监控
  setupRealInputMonitoring() {
    this.setupKeyboardInputTracking()
    this.setupInputEventTracking()
    this.setupPasteDetection()
    this.setupChineseInputMethodTracking()
  }

  // 键盘输入追踪
  setupKeyboardInputTracking() {
    let lastKeyTime = 0
    let continuousInputStart = 0

    document.addEventListener('keydown', e => {
      // 排除功能键和组合键
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) {
        return
      }

      const now = Date.now()
      const timeSinceLastKey = now - lastKeyTime

      // 检测连续输入开始
      if (timeSinceLastKey > 2000) {
        continuousInputStart = now
        this.inputState.continuousInput = 0
      }

      // 记录按键信息
      this.inputState.lastKeyTime = now
      this.inputState.lastKey = e.key

      // 开始编辑会话（如果未开始）
      if (!this.currentSession.isActive) {
        this.startEditingSession()
      }

      // 更新最后活动时间
      this.currentSession.lastActivity = now
      this.currentSession.inputEvents++

      lastKeyTime = now
    })

    // 监控退格和删除键
    document.addEventListener('keydown', e => {
      if (e.key === 'Backspace') {
        this.currentSession.backspaceCount++
        this.handleEditingBehavior('backspace', 1)
      } else if (e.key === 'Delete') {
        this.currentSession.deleteCount++
        this.handleEditingBehavior('delete', 1)
      }
    })
  }

  // 输入事件追踪（排除粘贴）
  setupInputEventTracking() {
    let lastInputTime = 0
    let inputTimer

    const handleRealInput = debounce(() => {
      const editor = this.getActiveEditor()
      if (!editor) return

      const content = this.getEditorContent(editor)
      const currentLength = content.length

      // 计算真实输入变化（排除粘贴）
      const lengthChange = currentLength - this.inputState.lastContentLength

      if (Math.abs(lengthChange) === 1) {
        // 单个字符变化，很可能是真实输入
        this.handleRealInput(content, lengthChange)
      } else if (lengthChange > 1) {
        // 可能是粘贴，需要进一步验证
        this.handlePossiblePaste(content, lengthChange)
      } else if (lengthChange < 0) {
        // 删除操作
        this.handleRealInput(content, lengthChange)
      }

      this.inputState.lastContentLength = currentLength
    }, 300)

    // 监听输入事件
    document.addEventListener(
      'input',
      e => {
        // 排除中文输入法组合状态
        if (this.inputState.isComposing) {
          return
        }

        clearTimeout(inputTimer)
        inputTimer = setTimeout(handleRealInput, 100)
      },
      true
    )
  }

  // 粘贴检测
  setupPasteDetection() {
    document.addEventListener('paste', e => {
      this.inputState.lastPasteTime = Date.now()
      this.handleEditingBehavior('paste', 1)
    })
  }

  // 中文输入法追踪
  setupChineseInputMethodTracking() {
    document.addEventListener('compositionstart', () => {
      this.inputState.isComposing = true
    })

    document.addEventListener('compositionend', () => {
      this.inputState.isComposing = false
      setTimeout(() => {
        const editor = this.getActiveEditor()
        if (editor) {
          const content = this.getEditorContent(editor)
          this.handleRealInput(content, 1)
        }
      }, 100)
    })
  }

  // 处理真实输入
  handleRealInput(content, lengthChange) {
    if (!this.currentSession.isActive) {
      this.startEditingSession()
    }

    const now = Date.now()

    // 关键修改：只统计实际增加的字数，而不是整个笔记的字数
    const actualCharChange = Math.max(0, lengthChange) // 只计算正变化（新增）
    const actualWordChange = this.calculateActualWordChange(content)

    // 更新会话统计 - 只记录实际输入
    this.currentSession.charCount += actualCharChange
    this.currentSession.wordCount += actualWordChange
    this.currentSession.lastActivity = now

    // 记录内容变化（只记录实际变化）
    this.currentSession.contentChanges.push({
      timestamp: now,
      charChange: actualCharChange,
      wordChange: actualWordChange,
      contentSample: content.substr(-50), // 只记录最新内容
      isActualInput: actualCharChange > 0
    })

    // 更新总体统计 - 只累加实际输入
    if (actualCharChange > 0 || actualWordChange > 0) {
      this.updateGlobalStats(actualCharChange, actualWordChange)
    }

    // 分析内容质量（基于实际输入）
    if (actualCharChange > 0) {
      this.analyzeContentQuality(content)
    }

    // 影响心情系统（基于实际输入）
    if (actualCharChange > 0) {
      this.applyInputMoodEffects(actualCharChange, actualWordChange, content)
    }

    // 限制内容变化记录数量
    if (this.currentSession.contentChanges.length > 50) {
      this.currentSession.contentChanges = this.currentSession.contentChanges.slice(-25)
    }

    // 异步保存数据
    this.debouncedSave()
  }

  startEditingSession() {
    this.currentSession = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      charCount: 0, // 从0开始计数，只记录本次会话的输入
      wordCount: 0, // 从0开始计数
      inputEvents: 0,
      backspaceCount: 0,
      deleteCount: 0,
      isActive: true,
      contentChanges: [],
      lastWordCount: 0 // 新增：用于里程碑检查
    }

    this.editingData.realInputStats.totalSessions++

    const todayStats = this.getTodayStats()
    todayStats.sessions++

    // 重置输入状态
    this.inputState.lastContent = ''
    this.inputState.lastContentLength = 0

    // 会话开始心情影响
    this.moodSystem.updateMood('focus', 2, 'session_start')
    this.moodSystem.updateMood('creativity', 1, 'session_start')
    this.moodSystem.updateMood('energy', 1, 'session_start')

    this.debouncedSave()
  }

  // 新增：计算实际单词变化（避免统计已有内容）
  calculateActualWordChange(currentContent) {
    if (!this.inputState.lastContent) {
      // 第一次输入，计算整个内容的单词数
      this.inputState.lastContent = currentContent
      return this.countWords(currentContent)
    }

    const lastContent = this.inputState.lastContent
    this.inputState.lastContent = currentContent

    // 只计算新增部分的单词数
    if (currentContent.length <= lastContent.length) {
      return 0 // 删除操作，不增加单词数
    }

    // 找出新增的文本部分
    const newText = currentContent.substring(lastContent.length)
    return this.countWords(newText)
  }

  checkWordMilestones() {
    const sessionWords = this.currentSession.wordCount
    const todayWords = this.getTodayStats().words
    const totalWords = this.editingData.realInputStats.totalWords

    // 新增：里程碑触发记录，避免重复触发
    const milestoneKey = `total_${Math.floor(totalWords / 10000) * 10000}`

    // 检查是否已经触发过这个里程碑
    if (!this.editingData.achievedMilestones) {
      this.editingData.achievedMilestones = new Set()
    }

    // 会话字数里程碑（只在新输入时检查）
    const sessionMilestones = [100, 500, 1000, 2000]
    sessionMilestones.forEach(milestone => {
      if (sessionWords >= milestone && sessionWords - this.currentSession.lastWordCount < 100) {
        // 确保是渐进式达到，而不是跳跃式
        this.moodSystem.updateMood('productivity', milestone / 100, `session_${milestone}_words`)
        this.moodSystem.updateMood('satisfaction', milestone / 200, `session_${milestone}_words`)
      }
    })
    this.currentSession.lastWordCount = sessionWords

    // 今日字数里程碑
    const dailyMilestones = [100, 500, 1000, 2000, 5000]
    dailyMilestones.forEach(milestone => {
      if (todayWords >= milestone && todayWords - this.getTodayStats().lastMilestoneCheck < 100) {
        this.moodSystem.updateMood('productivity', milestone / 250, `daily_${milestone}_words`)
        this.moodSystem.updateMood('satisfaction', milestone / 500, `daily_${milestone}_words`)
        this.getTodayStats().lastMilestoneCheck = todayWords
      }
    })

    // 总字数里程碑 - 关键修改：避免重复触发
    const totalMilestones = [10000, 50000, 100000, 200000]
    totalMilestones.forEach(milestone => {
      if (totalWords >= milestone && !this.editingData.achievedMilestones.has(milestone)) {
        // 检查是否是自然增长（避免打开大文件时直接触发）
        const recentGrowth = totalWords - (this.editingData.lastTotalWordsCheck || 0)

        if (recentGrowth <= 1000) {
          // 限制单次增长阈值
          this.moodSystem.updateMood('productivity', 10, `total_${milestone}_words`)
          this.moodSystem.updateMood('satisfaction', 8, `total_${milestone}_words`)
          this.moodSystem.showMoodFeedback(`恭喜！累计写作字数突破${milestone}字！🎉🎉`)
          this.editingData.achievedMilestones.add(milestone)
        }

        this.editingData.lastTotalWordsCheck = totalWords
      }
    })
  }

  updateGlobalStats(charChange, wordChange) {
    // 只在实际有输入时更新
    if (charChange <= 0 && wordChange <= 0) return

    const today = new Date().toDateString()
    const now = new Date()
    const weekKey = this.getWeekKey(now)
    const monthKey = this.getMonthKey(now)

    // 初始化统计结构
    if (!this.editingData.realInputStats.dailyStats[today]) {
      this.editingData.realInputStats.dailyStats[today] = {
        date: today,
        chars: 0,
        words: 0,
        sessions: 0,
        activeTime: 0,
        efficiency: 0,
        lastMilestoneCheck: 0
      }
    }

    // 更新统计 - 只累加实际输入
    this.editingData.realInputStats.totalChars += charChange
    this.editingData.realInputStats.totalWords += wordChange

    const daily = this.editingData.realInputStats.dailyStats[today]
    daily.chars += charChange
    daily.words += wordChange
  }

  // 新增：处理笔记打开事件，避免统计已有内容
  handleNoteOpen(notePath, initialContent) {
    const noteKey = this.generateNoteKey(notePath)

    if (!this.processedNotes.has(noteKey)) {
      // 第一次打开这个笔记，记录初始字数但不计入统计
      const initialWords = this.countWords(initialContent)
      this.noteWordCache.set(noteKey, {
        initialWords: initialWords,
        lastWords: initialWords,
        firstOpenTime: Date.now()
      })
      this.processedNotes.add(noteKey)
    }
  }

  // 新增：生成笔记唯一标识
  generateNoteKey(notePath) {
    return notePath.replace(/[^a-zA-Z0-9]/g, '_')
  }
}

// 人格影响系统
class PersonalityInfluenceSystem {
  constructor() {
    this.personalityEffects = {
      // 活泼型 - 提升快乐和能量，降低专注
      lively: {
        moodMultipliers: {
          happiness: 1.3,
          energy: 1.2,
          affection: 1.1,
          curiosity: 1.1,
          focus: 0.8,
          creativity: 1.1,
          relaxation: 0.9
        },
        interactionEffects: {
          pet: { happiness: 1.5, energy: 1.3 },
          note_create: { creativity: 1.2, productivity: 1.1 },
          note_edit: { focus: 0.7, creativity: 1.1 }
        }
      },
      // 安静型 - 提升专注和放松，降低社交需求
      quiet: {
        moodMultipliers: {
          happiness: 0.9,
          energy: 0.8,
          affection: 0.7,
          curiosity: 1.0,
          focus: 1.4,
          creativity: 1.1,
          relaxation: 1.3,
          creativity: 1.1
        },
        interactionEffects: {
          note_read: { focus: 1.3, relaxation: 1.2 },
          note_edit: { focus: 1.2, productivity: 1.1 },
          ignore: { affection: -0.5, loneliness: 0.3 }
        }
      },
      // 智慧型 - 提升创造力和好奇心
      wise: {
        moodMultipliers: {
          happiness: 1.0,
          energy: 1.0,
          affection: 0.9,
          creativity: 1.1,
          curiosity: 1.4,
          focus: 1.2,
          creativity: 1.3,
          productivity: 1.1
        },
        interactionEffects: {
          learn: { curiosity: 1.5, creativity: 1.3 },
          note_create: { creativity: 1.4, curiosity: 1.2 },
          note_read: { curiosity: 1.3, focus: 1.1 }
        }
      },
      // 萌系型 - 大幅提升社交需求，喜欢互动
      cute: {
        moodMultipliers: {
          happiness: 1.2,
          energy: 1.1,
          creativity: 1.1,
          affection: 1.4,
          curiosity: 1.1,
          focus: 0.7,
          relaxation: 1.0,
          creativity: 0.9
        },
        interactionEffects: {
          pet: { happiness: 1.8, affection: 1.6, loneliness: -2.0 },
          click: { curiosity: 1.3, happiness: 1.2 },
          ignore: { affection: -1.0, loneliness: 1.5 }
        }
      },
      // 导师型 - 提升生产力和专注，关注用户进度
      mentor: {
        moodMultipliers: {
          happiness: 1.0,
          energy: 1.1,
          affection: 1.0,
          curiosity: 1.1,
          creativity: 1.1,
          focus: 1.3,
          creativity: 1.1,
          productivity: 1.4,
          relaxation: 0.9
        },
        interactionEffects: {
          note_create: { productivity: 1.3, focus: 1.2 },
          note_edit: { productivity: 1.4, focus: 1.3 },
          achievement: { happiness: 1.5, productivity: 1.2 }
        }
      }
    }
  }

  getPersonalityEffects(personality) {
    return this.personalityEffects[personality] || this.personalityEffects.lively
  }

  applyMoodMultipliers(baseDimensions, personality) {
    const effects = this.getPersonalityEffects(personality)
    const result = {}

    // 确保所有基础维度都被处理
    for (const [dimension, value] of Object.entries(baseDimensions)) {
      const multiplier = effects.moodMultipliers[dimension] || 1.0
      result[dimension] = value * multiplier
    }

    return result
  }

  getPersonalityEffects(personality) {
    return this.personalityEffects[personality] || this.personalityEffects.lively
  }

  applyInteractionEffects(baseEffects, personality, interactionType) {
    const effects = this.getPersonalityEffects(personality)
    const interactionEffect = effects.interactionEffects[interactionType]

    if (!interactionEffect) return baseEffects

    const enhancedEffects = { ...baseEffects }
    for (const [dimension, multiplier] of Object.entries(interactionEffect)) {
      if (enhancedEffects[dimension] !== undefined) {
        enhancedEffects[dimension] = enhancedEffects[dimension] * multiplier
      } else {
        enhancedEffects[dimension] = multiplier > 1 ? 1 * (multiplier - 1) : -1 * (1 - multiplier)
      }
    }

    return enhancedEffects
  }

  getPersonalityFeedback(personality, context) {
    const feedbacks = {
      lively: {
        positive: ['好开心！继续和我玩吧~ 🎉', '充满活力！感觉能做好多事情！✨', '太棒了！让我们保持这个节奏！🐾'],
        negative: ['有点无聊呢...想和你一起玩 🥺', '能量不足了，需要互动充电~ 🔋', '闷闷的，想要更多关注... 💫']
      },
      quiet: {
        positive: ['安静的氛围很适合思考呢 📚', '专注的感觉真好... ✨', '平和的心境，工作效率很高 📝'],
        negative: ['太吵了...需要安静一下 🎧', '注意力难以集中... 🌫️', '需要一些独处的时间... 🍃']
      },
      wise: {
        positive: ['新的发现！知识真有趣 🧠', '思考带来灵感... 💡', '理解更深层次的东西了 📖'],
        negative: ['缺乏新的刺激... 🎯', '思维有些停滞... 💭', '需要更多学习材料... 📚']
      },
      cute: {
        positive: ['好喜欢你！多陪陪我嘛~ 💕', '被关注的感觉真好！🌟', '开心到转圈圈！🌀'],
        negative: ['你都不理我...好孤单 😢', '想要抱抱和摸摸... 🐾', '没有人陪，好寂寞... 💔']
      },
      mentor: {
        positive: ['进度不错！继续保持 💪', '高效的工作让人满足 ✅', '目标正在一步步实现 🎯'],
        negative: ['进度有些落后了... ⏰', '需要更专注一些 📋', '效率可以再提升一下 🔄']
      }
    }

    const personalityFeedback = feedbacks[personality] || feedbacks.lively
    const isPositive = context.overallMood > 60
    const messages = isPositive ? personalityFeedback.positive : personalityFeedback.negative
    return messages[Math.floor(Math.random() * messages.length)]
  }
}

// 核心心情系统
class MoodSystem {
  constructor(catContainer, quickAddApi) {
    this.catContainer = catContainer
    this.quickAddApi = quickAddApi
    this.config = window.smartCat?.config || {}
    this.emotionalMemory = new EmotionalMemory(this)
    this.personalityGrowth = new PersonalityGrowth()
    this.timeManagement = new TimeEmotionSystem(this)
    this.noteInteraction = new ObsidianInteractionSystem(this, quickAddApi)
    this.personalityInfluence = new PersonalityInfluenceSystem()

    // 核心心情维度
    this.dimensions = {
      happiness: 75,
      energy: 65,
      curiosity: 60,
      affection: 50,
      focus: 80,
      creativity: 70,
      productivity: 75,
      relaxation: 60
    }

    this.negativeStates = {
      boredom: 0,
      fatigue: 0,
      distraction: 0,
      loneliness: 0
    }

    this.stateThresholds = {
      critical: 80,
      warning: 60,
      normal: 30
    }

    this.currentMood = 'content'
    this.moodHistory = []
    this.lastInteractionTime = Date.now()

    this.init()
  }

  init() {
    this.loadMoodState()
    this.ensureMoodClassApplied()
    this.startAutoDecay()
    this.injectMoodSettingsButton()
  }

  // 核心心情更新方法
  updateMood(dimension, change, reason = '') {
    if (!this.dimensions) {
      this.initializeAllDimensions()
    }

    if (!this.dimensions.hasOwnProperty(dimension)) {
      this.dimensions[dimension] = 50
    }

    // 应用人格影响到变化量
    const personalityEffects = this.personalityInfluence.getPersonalityEffects(this.currentPersonality)
    const moodMultiplier = personalityEffects.moodMultipliers[dimension] || 1.0

    // 根据人格调整变化量
    let adjustedChange = change * moodMultiplier

    // 对于负面变化，某些人格可能有抵抗力
    if (change < 0) {
      const resistance = this.getPersonalityResistance(dimension)
      adjustedChange = change * resistance
    }

    const oldValue = this.dimensions[dimension]
    let newValue = oldValue + adjustedChange

    // 活力值特殊处理
    if (dimension === 'energy' && newValue < 5) {
      newValue = 5
    }

    // 应用边界
    newValue = Math.max(0, Math.min(100, newValue))

    // 防止微小变化导致的边界卡住
    if (Math.abs(adjustedChange) > 0.1 && Math.abs(newValue - oldValue) < 0.1) {
      if (oldValue > 99) {
        newValue = 100
      } else if (oldValue < 1) {
        newValue = 1
      } else {
        newValue = oldValue + (adjustedChange > 0 ? 0.5 : -0.5)
      }
    }

    if (Math.abs(newValue - oldValue) < 0.01) return

    this.dimensions[dimension] = Math.round(newValue * 10) / 10

    // 记录变化
    this.moodHistory.push({
      dimension,
      originalChange: change,
      adjustedChange: adjustedChange,
      reason,
      timestamp: Date.now(),
      oldValue,
      newValue: this.dimensions[dimension],
      personality: this.currentPersonality,
      multiplierApplied: moodMultiplier
    })

    // 限制历史记录长度
    if (this.moodHistory.length > 200) {
      this.moodHistory = this.moodHistory.slice(-100)
    }

    // 重要变化时保存状态
    if (Math.abs(adjustedChange) >= 1) {
      this.saveMoodState()
    }
  }

  // 获取人格抵抗力（对负面变化的抵抗力）
  getPersonalityResistance(dimension) {
    const resistanceMap = {
      lively: {
        happiness: 0.8, // 活泼型对快乐下降更敏感
        energy: 0.9,
        affection: 0.7, // 对亲密度下降很敏感
        boredom: 0.6 // 很容易无聊
      },
      quiet: {
        happiness: 1.2, // 安静型对快乐下降有抵抗力
        energy: 1.1,
        focus: 0.9, // 对分心更敏感
        relaxation: 1.3 // 很能保持放松
      },
      wise: {
        curiosity: 0.8, // 对好奇心下降敏感
        focus: 1.2, // 能保持专注
        creativity: 1.1 // 创造力持久
      },
      cute: {
        affection: 0.6, // 对亲密度下降非常敏感
        loneliness: 0.5, // 很容易感到孤独
        happiness: 0.8 // 快乐容易受影响
      },
      mentor: {
        productivity: 1.3, // 生产力很持久
        focus: 1.2, // 专注力强
        energy: 1.1 // 精力持久
      }
    }

    const personalityResistance = resistanceMap[this.currentPersonality] || {}
    return personalityResistance[dimension] || 1.0
  }

  // 自动衰减
  startAutoDecay() {
    setInterval(() => {
      const baseDecayRates = {
        happiness: -0.02,
        energy: -0.04,
        curiosity: -0.015,
        affection: -0.01,
        focus: -0.03,
        creativity: -0.02,
        productivity: -0.025,
        relaxation: -0.015
      }

      // 获取人格效果
      const personalityEffects = this.personalityInfluence.getPersonalityEffects(this.currentPersonality)

      // 应用人格乘数到衰减率
      for (const [dimension, rate] of Object.entries(baseDecayRates)) {
        const multiplier = personalityEffects.moodMultipliers[dimension] || 1.0

        // 对于衰减，我们使用反转的乘数（高乘数意味着更快衰减）
        // 因为如果某个维度被人格放大了，它也应该衰减得更快
        const adjustedRate = rate * (1 / multiplier)

        this.updateMood(dimension, adjustedRate, 'auto_decay')
      }
    }, 60000)
  }

  calculateCompositeMood() {
    const weights = {
      happiness: 0.2,
      energy: 0.15,
      curiosity: 0.15,
      affection: 0.1,
      focus: 0.1,
      creativity: 0.1,
      productivity: 0.1,
      relaxation: 0.1
    }

    let compositeScore = 0
    for (const [dimension, value] of Object.entries(this.dimensions)) {
      compositeScore += value * weights[dimension]
    }

    if (compositeScore > 80) return 'excellent'
    if (compositeScore > 65) return 'good'
    if (compositeScore > 45) return 'neutral'
    if (compositeScore > 30) return 'low'
    return 'poor'
  }

  getCurrentMoodEmoji() {
    const map = MOOD_MAP[this.currentMood]
    return map && map.emoji
  }

  ensureMoodClassApplied() {
    const moodClasses = ['mood-excellent', 'mood-good', 'mood-neutral', 'mood-low', 'mood-poor']
    this.catContainer.classList.remove(...moodClasses)
    this.catContainer.classList.add(`mood-${this.currentMood}`)
  }

  saveMoodState() {
    const moodData = {
      dimensions: this.dimensions,
      lastUpdate: Date.now(),
      lastMood: this.currentMood
    }

    try {
      localStorage.setItem('smart-cat-mood-data', JSON.stringify(moodData))
    } catch (error) {
      console.warn('心情数据保存失败:', error)
    }
  }

  loadMoodState() {
    try {
      const saved = localStorage.getItem('smart-cat-mood-data')
      if (saved) {
        const moodData = JSON.parse(saved)
        const timeDiff = Date.now() - moodData.lastUpdate
        const hoursDiff = timeDiff / (1000 * 60 * 60)

        if (hoursDiff < 24) {
          this.dimensions = { ...this.dimensions, ...moodData.dimensions }
          this.currentMood = moodData.lastMood || 'neutral'
        }
      }
    } catch (error) {
      console.warn('心情数据加载失败:', error)
    } finally {
      this.ensureMoodClassApplied()
    }
  }

  // 交互处理
  handleInteraction(type, intensity = 1) {
    const effects = {
      pet: { happiness: 8, affection: 6, energy: 2 },
      click: { curiosity: 3, happiness: 2 },
      learn: { curiosity: 6, focus: 4 },
      note_create: { creativity: 8, productivity: 6, happiness: 3 },
      note_edit: { focus: 6, creativity: 4, productivity: 5 },
      note_read: { curiosity: 5, focus: 4, relaxation: 3 }
    }

    const baseEffect = effects[type] || {}
    const scaledEffect = {}

    Object.entries(baseEffect).forEach(([dimension, change]) => {
      scaledEffect[dimension] = change * intensity
    })

    Object.entries(scaledEffect).forEach(([dimension, change]) => {
      this.updateMood(dimension, change, `${type}_interaction`)
    })

    this.lastInteractionTime = Date.now()
  }

  // 工具方法
  showMoodFeedback(message) {
    if (window.smartCat?.showBubble) {
      window.smartCat.showBubble(message, 3000)
    }
    console.log('小橘:', message)
  }

  // 统一的数据展示方法
  getUnifiedMoodStatsHtml() {
    return `
  <div class="mood-stats-container">
    <!-- 基础心情维度 -->
    ${this.getBasicMoodDimensionsHtml()}
    
    <!-- 人格特质 -->
    ${this.getPersonalityTraitsHtml()}
    
    <!-- 负面状态 -->
    ${this.getNegativeStatesHtml()}
    
    <!-- 时间情绪 -->
    ${this.getTimeEmotionHtml()}
    
    <!-- 写作效率 -->
    ${this.getWritingStatsHtml()}
    
    <!-- 情感记忆 -->
    ${this.getEmotionalMemoryHtml()}
    
    <!-- 互动模式 -->
    ${this.getInteractionPatternsHtml()}
    
    <!-- 学习成长 -->
    ${this.getLearningGrowthHtml()}
    
    <!-- 环境适应 -->
    ${this.getEnvironmentAdaptationHtml()}
  </div>
  `
  }

  // 基础心情维度
  getBasicMoodDimensionsHtml() {
    const dimensions = this?.dimensions || {}

    return `
  <div class="mood-stats-section">
    <h4>基础心情维度</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('愉悦度', dimensions.happiness, '%')}
      ${this.createStatItem('活力值', dimensions.energy, '%')}
      ${this.createStatItem('好奇心', dimensions.curiosity, '%')}
      ${this.createStatItem('亲密度', dimensions.affection, '%')}
      ${this.createStatItem('专注度', dimensions.focus, '%')}
      ${this.createStatItem('创造力', dimensions.creativity, '%')}
      ${this.createStatItem('生产力', dimensions.productivity, '%')}
      ${this.createStatItem('放松度', dimensions.relaxation, '%')}
    </div>
  </div>
  `
  }

  // 人格特质
  getPersonalityTraitsHtml() {
    const personalityGrowth = this?.personalityGrowth || {}
    const traits = personalityGrowth.traits || {
      playfulness: 50,
      sociability: 50,
      independence: 50,
      curiosity: 50
    }

    return `
  <div class="mood-stats-section">
    <h4>人格特质发展</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('活泼度', traits.playfulness, '%')}
      ${this.createStatItem('社交性', traits.sociability, '%')}
      ${this.createStatItem('独立性', traits.independence, '%')}
      ${this.createStatItem('好奇心', traits.curiosity, '%')}
    </div>
  </div>
  `
  }

  // 负面状态
  getNegativeStatesHtml() {
    const negativeStates = this?.negativeStates || {
      boredom: 0,
      fatigue: 0,
      distraction: 0,
      loneliness: 0
    }

    return `
  <div class="mood-stats-section">
    <h4>负面状态监测</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('无聊度', negativeStates.boredom, '%', true)}
      ${this.createStatItem('疲劳度', negativeStates.fatigue, '%', true)}
      ${this.createStatItem('分心度', negativeStates.distraction, '%', true)}
      ${this.createStatItem('孤独感', negativeStates.loneliness, '%', true)}
    </div>
  </div>
  `
  }

  // 时间情绪
  getTimeEmotionHtml() {
    const timeEmotionSystem = this?.timeEmotionSystem
    const report = timeEmotionSystem?.getTimeEmotionReport?.() || {}

    return `
  <div class="mood-stats-section">
    <h4>时间情绪分析</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('当前时段', report.current?.name || '未知', '')}
      ${this.createStatItem('今日变化', report.today?.emotionChanges || 0, '次')}
      ${this.createStatItem('活跃时段', this.getMostActiveTimeSegment(), '')}
      ${this.createStatItem('情绪记录', report.history?.totalRecords || 0, '条')}
    </div>
  </div>
  `
  }

  // 写作效率
  getWritingStatsHtml() {
    const noteInteraction = this?.noteInteraction
    const todayStats = noteInteraction?.getTodayStats?.() || { words: 0, chars: 0, sessions: 0 }
    const efficiencyStats = noteInteraction?.getEfficiencyStats?.() || { average: 0 }

    return `
  <div class="mood-stats-section">
    <h4>写作效率分析</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('今日字数', todayStats.words, '字')}
      ${this.createStatItem('会话次数', todayStats.sessions, '次')}
      ${this.createStatItem('写作效率', efficiencyStats.average, '%')}
      ${this.createStatItem('连续天数', noteInteraction?.calculateCurrentStreak?.() || 0, '天')}
    </div>
  </div>
  `
  }

  // 情感记忆
  getEmotionalMemoryHtml() {
    const emotionalMemory = this?.emotionalMemory
    const memoryData = emotionalMemory?.memoryData || {}
    const statistics = memoryData.statistics || {}

    return `
  <div class="mood-stats-section">
    <h4>情感记忆统计</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('记忆总量', statistics.totalMemories || 0, '条')}
      ${this.createStatItem('平均强度', statistics.averageIntensity ? Math.round(statistics.averageIntensity) : 0, '')}
      ${this.createStatItem('活跃标签', Object.keys(memoryData.associations || {}).length, '个')}
      ${this.createStatItem('近期活动', statistics.recentActivity?.length || 0, '条')}
    </div>
  </div>
  `
  }

  // 互动模式
  getInteractionPatternsHtml() {
    return `
  <div class="mood-stats-section">
    <h4>互动模式分析</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('最常互动', this.getMostFrequentInteraction(), '')}
      ${this.createStatItem('响应速度', this.getAverageResponseTime(), 'ms')}
      ${this.createStatItem('互动频率', this.getInteractionFrequency(), '/小时')}
      ${this.createStatItem('偏好时间', this.getPreferredInteractionTime(), '')}
    </div>
  </div>
  `
  }

  // 学习成长
  getLearningGrowthHtml() {
    const learningSystem = this?.learningSystem || {}

    return `
  <div class="mood-stats-section">
    <h4>学习成长轨迹</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('学习模式', Object.keys(learningSystem.interactionPatterns || {}).length, '种')}
      ${this.createStatItem('偏好识别', Object.keys(learningSystem.activityCorrelations || {}).length, '项')}
      ${this.createStatItem('适应能力', this.getAdaptationScore(), '%')}
      ${this.createStatItem('成长阶段', this.getGrowthStage(), '')}
    </div>
  </div>
  `
  }

  // 环境适应
  getEnvironmentAdaptationHtml() {
    return `
  <div class="mood-stats-section">
    <h4>环境适应能力</h4>
    <div class="mood-quick-stats">
      ${this.createStatItem('时间适应性', this.getTimeAdaptationScore(), '%')}
      ${this.createStatItem('活动匹配度', this.getActivityMatchingScore(), '%')}
      ${this.createStatItem('节奏感知', this.getRhythmPerceptionScore(), '%')}
      ${this.createStatItem('稳定性', this.getStabilityScore(), '%')}
    </div>
  </div>
  `
  }

  // 统一的统计项创建方法
  createStatItem(label, value, unit = '', isNegative = false) {
    const numericValue = typeof value === 'number' ? value : 0
    const displayValue = typeof value === 'number' ? Math.round(numericValue) : value

    // 根据数值范围确定颜色类
    let valueClass = 'neutral'
    if (typeof value === 'number') {
      if (isNegative) {
        // 负面指标：值越低越好
        if (numericValue < 20) valueClass = 'high' // 绿色 - 好
        else if (numericValue < 50) valueClass = 'medium' // 橙色 - 中等
        else valueClass = 'low' // 红色 - 差
      } else {
        // 正面指标：值越高越好
        if (numericValue >= 80) valueClass = 'high' // 绿色 - 好
        else if (numericValue >= 60) valueClass = 'medium' // 橙色 - 中等
        else valueClass = 'low' // 红色 - 差
      }
    }

    return `
  <div class="mood-stat-item">
    <span class="mood-stat-label">${label}</span>
    <span class="mood-stat-value ${valueClass}">
      ${displayValue}
    </span>
  </div>
  `
  }

  // 在设置面板中使用统一的样式
  addMoodSettingsSection(settingsPanel) {
    // 确保子系统存在
    this.ensureSubsystemsExist()

    // 创建心情设置区域
    const moodSection = document.createElement('div')
    moodSection.className = 'section mood-settings-section'

    // 获取当前心情信息
    const moodInfo = this.getMoodDisplayInfo()

    moodSection.innerHTML = `
  <div class="mood-settings-content">
    <!-- 心情摘要区域 -->
    <div class="mood-summary" id="mood-summary">
      <div class="mood-header">
        <div class="mood-emoji">${moodInfo.emoji}</div>
        <div class="mood-text">
          <div class="mood-state">${moodInfo.state}</div>
          <div class="mood-score">综合评分: ${moodInfo.score}/100</div>
        </div>
        <div class="mood-toggle">
          <span class="toggle-icon">▼</span>
        </div>
      </div>
    </div>
    
    <!-- 详细数据区域（默认隐藏） -->
    <div class="mood-details" id="mood-details" style="display: none;">
      ${this.getUnifiedMoodStatsHtml()}
    </div>
  </div>
  `

    // 插入到设置面板
    const apiSection = settingsPanel.querySelector('.section:nth-child(1)')
    if (apiSection) {
      apiSection.parentNode.insertBefore(moodSection, apiSection)
    } else {
      const panelContent = settingsPanel.querySelector('.panel-content')
      if (panelContent) {
        panelContent.appendChild(moodSection)
      }
    }

    // 添加样式
    this.addUnifiedMoodStyles()

    // 绑定事件
    setTimeout(() => {
      this.bindMoodToggleEvents()
      this.updateMoodStatsDisplay()
      this.startMoodStatsUpdate()
    }, 100)
  }

  // 辅助方法实现
  getMostActiveTimeSegment() {
    try {
      const timeEmotionSystem = this?.timeEmotionSystem
      const report = timeEmotionSystem?.getTimeEmotionReport?.() || {}
      const segments = report.history?.recentSegments || {}

      if (Object.keys(segments).length === 0) return '未知'

      const mostActive = Object.entries(segments).reduce((a, b) => (a[1] > b[1] ? a : b), ['未知', 0])
      return this.getTimeSegmentName(mostActive[0])
    } catch (error) {
      return '未知'
    }
  }

  getAdaptationScore() {
    // 简化的适应能力计算
    const dimensions = this?.dimensions || {}
    const avgStability = Object.values(dimensions).reduce((sum, val) => sum + val, 0) / Object.values(dimensions).length
    return Math.round(avgStability)
  }

  getGrowthStage() {
    const emotionalMemory = this?.emotionalMemory
    const totalMemories = emotionalMemory?.memoryData?.statistics?.totalMemories || 0

    if (totalMemories < 10) return '幼年期'
    if (totalMemories < 50) return '成长期'
    if (totalMemories < 100) return '成熟期'
    return '完全体'
  }

  getTimeSegmentName(timeKey) {
    const segmentMap = {
      early_morning: '清晨',
      morning: '上午',
      noon: '中午',
      afternoon: '下午',
      evening: '晚上',
      night: '深夜',
      late_night: '凌晨'
    }
    return segmentMap[timeKey] || timeKey
  }

  getAverageResponseTime() {
    try {
      const moodHistory = this?.moodHistory || []
      const recentInteractions = moodHistory.filter(record => record.reason && record.reason.includes('_intelligent')).slice(-5)

      if (recentInteractions.length < 2) return 0

      let totalDiff = 0
      for (let i = 1; i < recentInteractions.length; i++) {
        const timeDiff = recentInteractions[i].timestamp - recentInteractions[i - 1].timestamp
        totalDiff += timeDiff
      }

      return Math.round(totalDiff / (recentInteractions.length - 1))
    } catch (error) {
      return 0
    }
  }

  getInteractionFrequency() {
    try {
      const moodHistory = this?.moodHistory || []
      const oneHourAgo = Date.now() - 60 * 60 * 1000

      const recentInteractions = moodHistory.filter(record => record.timestamp > oneHourAgo && record.reason && record.reason.includes('_intelligent'))

      return recentInteractions.length
    } catch (error) {
      return 0
    }
  }

  getPreferredInteractionTime() {
    try {
      const timeEmotionSystem = this?.timeEmotionSystem
      const timeData = timeEmotionSystem?.timeData
      if (!timeData || !timeData.emotionHistory) return '未知'

      const timeCounts = {}
      timeData.emotionHistory.forEach(record => {
        const recordDate = new Date(record.timestamp)
        const hour = recordDate.getHours()
        const timeKey = `${hour}:00-${hour + 1}:00`

        if (!timeCounts[timeKey]) {
          timeCounts[timeKey] = 0
        }
        timeCounts[timeKey]++
      })

      if (Object.keys(timeCounts).length === 0) return '未知'

      const preferredTime = Object.entries(timeCounts).reduce((a, b) => (a[1] > b[1] ? a : b))

      return this.getTimeSegmentName(preferredTime[0])
    } catch (error) {
      return '未知'
    }
  }

  getTimeAdaptationScore() {
    try {
      const timeEmotionSystem = this?.timeEmotionSystem
      const timeData = timeEmotionSystem?.timeData
      if (!timeData || !timeData.emotionHistory) return 50

      const recentRecords = timeData.emotionHistory.filter(record => Date.now() - record.timestamp < 7 * 24 * 60 * 60 * 1000).slice(-20)

      if (recentRecords.length === 0) return 50

      const moodValues = recentRecords.map(record => {
        const effects = record.effects || {}
        return (effects.happiness || 0) + (effects.energy || 0) + (effects.focus || 0)
      })

      const avg = moodValues.reduce((sum, val) => sum + val, 0) / moodValues.length
      const variance = moodValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / moodValues.length
      const stdDev = Math.sqrt(variance)

      const adaptationScore = Math.max(0, 100 - stdDev * 10)
      return Math.round(adaptationScore)
    } catch (error) {
      return 50
    }
  }

  getActivityMatchingScore() {
    try {
      const emotionalMemory = this?.emotionalMemory
      if (!emotionalMemory || !emotionalMemory.memoryData) return 50

      const memories = emotionalMemory.memoryData.memories || []
      const recentMemories = memories.filter(m => Date.now() - m.timestamp < 30 * 24 * 60 * 60 * 1000).slice(-50)

      if (recentMemories.length === 0) return 50

      let matchScore = 0
      let totalInteractions = 0

      recentMemories.forEach(memory => {
        const emotionalResponse = memory.emotionalResponse || []

        if (emotionalResponse.length > 0) {
          const positiveResponses = emotionalResponse.filter(r => r.change > 0).length
          const matchRatio = positiveResponses / emotionalResponse.length
          matchScore += matchRatio
          totalInteractions++
        }
      })

      const avgMatchScore = totalInteractions > 0 ? (matchScore / totalInteractions) * 100 : 50
      return Math.round(avgMatchScore)
    } catch (error) {
      return 50
    }
  }

  getRhythmPerceptionScore() {
    try {
      const timeEmotionSystem = this?.timeEmotionSystem
      const timeData = timeEmotionSystem?.timeData
      if (!timeData || !timeData.emotionHistory) return 50

      const timePatterns = {}
      const now = new Date()
      const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000

      timeData.emotionHistory.forEach(record => {
        if (record.timestamp > oneWeekAgo) {
          const recordDate = new Date(record.timestamp)
          const hour = recordDate.getHours()
          const timeKey = `${hour}:00-${hour + 1}:00`

          if (!timePatterns[timeKey]) {
            timePatterns[timeKey] = 0
          }
          timePatterns[timeKey]++
        }
      })

      const timeKeys = Object.keys(timePatterns)
      if (timeKeys.length === 0) return 50

      const totalRecords = Object.values(timePatterns).reduce((sum, count) => sum + count, 0)
      const values = Object.values(timePatterns)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)

      const rhythmScore = Math.max(0, 100 - stdDev * 5)
      return Math.round(rhythmScore)
    } catch (error) {
      return 50
    }
  }

  getStabilityScore() {
    try {
      const moodHistory = this?.moodHistory || []
      if (moodHistory.length < 10) return 50

      const recentHistory = moodHistory.slice(-30)

      const dimensionValues = {
        happiness: [],
        energy: [],
        focus: [],
        creativity: []
      }

      recentHistory.forEach(record => {
        if (record.dimension && record.newValue !== undefined) {
          if (dimensionValues[record.dimension]) {
            dimensionValues[record.dimension].push(record.newValue)
          }
        }
      })

      let totalStability = 0
      let dimensionCount = 0

      Object.entries(dimensionValues).forEach(([dimension, values]) => {
        if (values.length > 5) {
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length
          const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
          const stdDev = Math.sqrt(variance)

          const stability = Math.max(0, 100 - stdDev * 3)
          totalStability += stability
          dimensionCount++
        }
      })

      const avgStability = dimensionCount > 0 ? totalStability / dimensionCount : 50
      return Math.round(avgStability)
    } catch (error) {
      return 50
    }
  }

  // 绑定折叠/展开事件
  bindMoodToggleEvents() {
    const summary = document.getElementById('mood-summary')
    const details = document.getElementById('mood-details')
    const toggleIcon = summary?.querySelector('.toggle-icon')

    if (summary && details && toggleIcon) {
      summary.addEventListener('click', () => {
        const isHidden = details.style.display === 'none'

        if (isHidden) {
          details.style.display = 'block'
          toggleIcon.textContent = '▲'
          summary.classList.add('expanded')
        } else {
          details.style.display = 'none'
          toggleIcon.textContent = '▼'
          summary.classList.remove('expanded')
        }
      })
    }
  }

  // 更新心情统计显示
  updateMoodStatsDisplay() {
    // 更新数据统计区域
    this.updateDataStatsDisplay()

    // 更新所有统计项的值
    this.updateAllStatValues()
  }

  // 更新数据统计显示
  updateDataStatsDisplay() {
    const todayInteractionsEl = document.getElementById('today-interactions')
    const memoryCountEl = document.getElementById('memory-count')
    const dataSizeEl = document.getElementById('data-size')

    if (todayInteractionsEl) {
      const today = new Date().toDateString()
      const moodHistory = this?.moodHistory || []
      const todayInteractions = moodHistory.filter(record => {
        const recordDate = new Date(record.timestamp).toDateString()
        return recordDate === today
      }).length
      todayInteractionsEl.textContent = todayInteractions
    }

    if (memoryCountEl) {
      const emotionalMemory = this?.emotionalMemory
      const memoryCount = emotionalMemory?.memoryData?.memories?.length || 0
      memoryCountEl.textContent = memoryCount
    }

    if (dataSizeEl) {
      const dataSize = this.calculateDataSize()
      dataSizeEl.textContent = `${Math.round(dataSize)} KB`
    }
  }

  // 计算数据大小
  calculateDataSize() {
    try {
      const moodData = localStorage.getItem('smart-cat-mood-data') || ''
      const emotionalData = localStorage.getItem('smart-cat-emotional-memory') || ''
      const personalityData = localStorage.getItem('smart-cat-personality-growth') || ''

      return (moodData.length + emotionalData.length + personalityData.length) / 1024
    } catch (error) {
      return 0
    }
  }

  // 更新所有统计项的值
  updateAllStatValues() {
    // 由于我们的统计项是动态生成的，这里可以定期重新渲染整个面板
    // 或者使用更精细的更新机制
  }

  // 启动心情统计更新
  startMoodStatsUpdate() {
    // 每30秒更新一次统计显示
    setInterval(() => {
      this.updateMoodStatsDisplay()
    }, 30000)
  }

  // 获取心情显示信息
  getMoodDisplayInfo() {
    const score = this?.calculateCompositeMoodScore?.() || 50
    const moodState = this?.currentMood || 'neutral'

    const moodMap = MOOD_MAP

    const moodInfo = moodMap[moodState] || moodMap.neutral

    return {
      emoji: moodInfo.emoji,
      state: moodInfo.state,
      score: score
    }
  }

  // 确保子系统存在
  ensureSubsystemsExist() {
    if (!this.personalityGrowth) {
      this.personalityGrowth = {
        traits: {
          playfulness: 50,
          sociability: 50,
          independence: 50,
          curiosity: 50
        }
      }
    }

    if (!this.emotionalMemory) {
      this.emotionalMemory = {
        memoryData: {
          statistics: { totalMemories: 0, recentActivity: [] },
          associations: {}
        }
      }
    }

    if (!this.timeEmotionSystem) {
      this.timeEmotionSystem = {
        getTimeEmotionReport: () => ({
          current: { name: '未知', effects: {} },
          today: { emotionChanges: 0 }
        })
      }
    }

    if (!this.noteInteraction) {
      this.noteInteraction = {
        getTodayStats: () => ({ words: 0, chars: 0 }),
        getEfficiencyStats: () => ({ average: 0 }),
        calculateCurrentStreak: () => 0
      }
    }
  }

  // 添加统一的样式
  addUnifiedMoodStyles() {
    const styleId = 'unified-mood-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
    /* 统一心情样式系统 */
    
    
#smart-companion-cat {
  --mood-happiness: 50;
  --mood-energy: 50;
  --mood-curiosity: 50;
  --mood-affection: 50;
  --mood-focus: 50;
  --mood-creativity: 50;
  --mood-productivity: 50;
  --mood-relaxation: 50;
  transition: all 0.6s ease;
}

/* 心情指示器 */
.mood-indicator {
  position: absolute;
  top: -35px;
  right: -25px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(255, 215, 0, 0.3) 70%,
    rgba(255, 165, 0, 0.2) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  opacity: 0;
  transform: scale(0.5) translateY(10px);
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1000;
  box-shadow: 
    0 4px 12px rgba(255, 165, 0, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.mood-indicator.active {
  opacity: 1;
  transform: scale(1) translateY(0);
}

/* 心情特定颜色效果 */
.mood-excellent .mood-indicator {
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(255, 215, 0, 0.4) 70%,
    rgba(255, 140, 0, 0.3) 100%);
  box-shadow: 
    0 4px 12px rgba(255, 215, 0, 0.4),
    0 0 0 2px rgba(255, 255, 255, 0.9),
    inset 0 2px 4px rgba(255, 255, 255, 0.7);
}

.mood-good .mood-indicator {
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(144, 238, 144, 0.3) 70%,
    rgba(50, 205, 50, 0.2) 100%);
  box-shadow: 
    0 4px 12px rgba(144, 238, 144, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6);
}

.mood-neutral .mood-indicator {
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(173, 216, 230, 0.3) 70%,
    rgba(135, 206, 235, 0.2) 100%);
  box-shadow: 
    0 4px 12px rgba(173, 216, 230, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6);
}

.mood-low .mood-indicator {
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(255, 182, 193, 0.3) 70%,
    rgba(255, 105, 180, 0.2) 100%);
  box-shadow: 
    0 4px 12px rgba(255, 182, 193, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6);
}

.mood-poor .mood-indicator {
  background: radial-gradient(circle at 30% 30%, 
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 255, 255, 0.85) 30%,
    rgba(192, 192, 192, 0.3) 70%,
    rgba(128, 128, 128, 0.2) 100%);
  box-shadow: 
    0 4px 12px rgba(192, 192, 192, 0.3),
    0 0 0 2px rgba(255, 255, 255, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6);
}

/* 心情对猫咪外观的影响 */
.mood-excellent .cat-body {
  filter: brightness(1.1) saturate(1.2);
  opacity: 0.98;
}

.mood-good .cat-body {
  filter: brightness(1.05) saturate(1.1);
  opacity: 0.95;
}

.mood-neutral .cat-body {
  filter: brightness(1) saturate(1);
  opacity: 0.92;
}

.mood-low .cat-body {
  filter: brightness(0.9) saturate(0.85);
  opacity: 0.88;
}

.mood-poor .cat-body {
  filter: brightness(0.85) saturate(0.7);
  opacity: 0.8;
}

/* 心情设置区域样式 */
.mood-settings-section {
  background: linear-gradient(135deg, rgba(255, 167, 38, 0.05), rgba(255, 167, 38, 0.02));
  border: 1px solid rgba(255, 167, 38, 0.1);
  border-radius: 8px;
  margin-bottom: 15px;
  padding: 15px;
}

.mood-settings-section h3 {
  margin: 0 0 12px 0;
  color: #ff6b35;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 167, 38, 0.2);
  padding-bottom: 8px;
}

.mood-settings-section h4 {
  margin: 20px 0 10px 0;
  color: #666;
  font-size: 14px;
  font-weight: 500;
}

/* 心情统计网格 - 桌面端默认3列 */
.mood-quick-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 15px;
}

.mood-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
  border: 1px solid rgba(255, 167, 38, 0.2);
  transition: all 0.3s ease;
}

.mood-stat-item:hover {
  background: rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(255, 167, 38, 0.15);
}

.mood-stat-label {
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
  text-align: center;
}

.mood-stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #ff6b35;
}

/* 人格控制样式 */
.personality-control {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.personality-selector {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid rgba(255, 167, 38, 0.3);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  font-size: 14px;
}

.personality-description {
  font-size: 12px;
  color: #666;
  font-style: italic;
  padding: 8px;
  background: rgba(255, 167, 38, 0.05);
  border-radius: 4px;
  border-left: 3px solid #ffa726;
}

/* 人格特定颜色 */
.personality-lively { border-left-color: #4CAF50; }
.personality-quiet { border-left-color: #2196F3; }
.personality-wise { border-left-color: #9C27B0; }
.personality-cute { border-left-color: #E91E63; }
.personality-mentor { border-left-color: #FF9800; }

/* 数据管理区域 */
.mood-data-management {
  border-top: 1px solid rgba(255, 167, 38, 0.2);
  padding-top: 15px;
}

.data-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.data-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.data-stat-label {
  font-size: 10px;
  color: #888;
}

.data-stat-value {
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.data-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.mood-action-btn {
  padding: 8px 12px;
  background: linear-gradient(135deg, #ffa726, #ff6b35);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(255, 107, 53, 0.3);
}

.mood-action-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 107, 53, 0.4);
}

.mood-action-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(255, 107, 53, 0.3);
}

.mood-action-btn.reset-btn {
  background: linear-gradient(135deg, #f44336, #d32f2f);
  box-shadow: 0 2px 6px rgba(244, 67, 54, 0.3);
}

.mood-action-btn.reset-btn:hover {
  box-shadow: 0 4px 10px rgba(244, 67, 54, 0.4);
}

/* 重置按钮特殊样式 */
.mood-reset-btn {
  background: #ff6b6b !important;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(255, 107, 107, 0.3);
}

.mood-reset-btn:hover {
  background: #ff5252 !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(255, 107, 107, 0.4);
}

/* 动画效果 */
@keyframes float {
  0%, 100% { transform: translateY(0px) scale(1); }
  50% { transform: translateY(-8px) scale(1.05); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3); }
  50% { transform: scale(1.1); box-shadow: 0 6px 18px rgba(255, 165, 0, 0.5); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-6px); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-3px); }
}

/* 指示器动画类 */
.mood-indicator.float-animation {
  animation: float 3s ease-in-out infinite;
}

.mood-indicator.pulse-animation {
  animation: pulse 2s ease-in-out infinite;
}

.mood-indicator.bounce-animation {
  animation: bounce 2s ease-in-out infinite;
}

/* 移动端响应式设计 */
@media (max-width: 768px) {
  /* 心情统计网格 - 移动端保持3列 */
  .mood-quick-stats {
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  
  .mood-stat-item {
    padding: 6px;
    min-height: 50px;
  }
  
  .mood-stat-label {
    font-size: 10px;
  }
  
  .mood-stat-value {
    font-size: 12px;
  }
  
  /* 数据统计在移动端改为单列 */
  .data-stats {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  
  /* 操作按钮在移动端改为垂直排列 */
  .data-actions {
    flex-direction: column;
  }
  
  .mood-action-btn {
    padding: 10px;
    font-size: 13px;
    width: 100%;
  }
  
  /* 人格控制在移动端改为垂直排列 */
  .personality-control {
    flex-direction: column;
    gap: 8px;
  }
  
  .personality-selector {
    width: 100%;
  }
  
  /* 重置按钮在移动端调整 */
  .mood-reset-btn {
    padding: 12px 16px;
    font-size: 14px;
    width: 100%;
  }
  
  /* 心情指示器在移动端调整位置和大小 */
  .mood-indicator {
    top: -30px;
    right: -20px;
    width: 28px;
    height: 28px;
    font-size: 14px;
  }
}

/* 超小屏幕优化 */
@media (max-width: 480px) {
  .mood-quick-stats {
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  
  .mood-stat-item {
    padding: 4px;
    min-height: 45px;
  }
  
  .mood-stat-label {
    font-size: 9px;
  }
  
  .mood-stat-value {
    font-size: 11px;
  }
  
  .mood-settings-section {
    padding: 12px;
  }
  
  .mood-settings-section h3 {
    font-size: 15px;
  }
}

/* 平板设备优化 */
@media (min-width: 769px) and (max-width: 1024px) {
  .mood-quick-stats {
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
}

/* 确保与隐藏样式一致的头部样式 */
.mood-settings-section h3 {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: -0.01em;
  line-height: 1.4;
}

/* 统一滚动条样式 */
.mood-settings-section::-webkit-scrollbar {
  width: 6px;
}

.mood-settings-section::-webkit-scrollbar-track {
  background: rgba(255, 167, 38, 0.1);
  border-radius: 3px;
}

.mood-settings-section::-webkit-scrollbar-thumb {
  background: rgba(255, 167, 38, 0.3);
  border-radius: 3px;
}

.mood-settings-section::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 167, 38, 0.5);
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .mood-stat-item {
    border: 2px solid #ff6b35;
  }
  
  .mood-settings-section {
    border: 2px solid #ff6b35;
  }
}

/* 减少动画模式支持 */
@media (prefers-reduced-motion: reduce) {
  .mood-indicator {
    transition: none;
    animation: none;
  }
  
  .mood-stat-item {
    transition: none;
  }
  
  .mood-action-btn {
    transition: none;
  }
}  

.mood-summary {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(255, 167, 38, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin: 12px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.mood-summary:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.mood-header {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.mood-emoji {
  font-size: 32px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffa726, #ff6b35);
  border-radius: 50%;
  box-shadow: 0 4px 8px rgba(255, 107, 53, 0.3);
}

.mood-text {
  flex: 1;
}

.mood-state {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.mood-score {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.mood-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 167, 38, 0.1);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.mood-toggle:hover {
  background: rgba(255, 167, 38, 0.2);
}

.toggle-icon {
  font-size: 14px;
  color: #ff6b35;
  transition: transform 0.3s ease;
}

.mood-summary.expanded .toggle-icon {
  transform: rotate(180deg);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .mood-summary {
    padding: 12px;
    margin: 8px 0;
  }
  
  .mood-emoji {
    font-size: 28px;
    width: 42px;
    height: 42px;
  }
  
  .mood-state {
    font-size: 16px;
  }
  
  .mood-score {
    font-size: 13px;
  }
}
  `
    document.head.appendChild(style)
  }

  getMoodReport() {
    return {
      overall: this.currentMood,
      dimensions: { ...this.dimensions },
      lastUpdate: new Date().toLocaleString()
    }
  }

  // 设置界面
  injectMoodSettingsButton() {
    const checkSettingsPanel = setInterval(() => {
      const settingsPanel = document.getElementById('settings-panel')
      if (settingsPanel) {
        clearInterval(checkSettingsPanel)
        this.addMoodSettingsSection(settingsPanel)
      }
    }, 1000)
  }

  // 环境适应能力相关方法实现
  getTimeAdaptationScore() {
    try {
      const timeData = this.timeEmotionSystem?.timeData
      if (!timeData || !timeData.emotionHistory || timeData.emotionHistory.length === 0) {
        return 50 // 默认值
      }

      // 计算时间情绪变化的稳定性
      const recentRecords = timeData.emotionHistory
        .filter(record => Date.now() - record.timestamp < 7 * 24 * 60 * 60 * 1000) // 最近7天
        .slice(-20) // 最近20条记录

      if (recentRecords.length === 0) return 50

      // 计算情绪波动的标准差
      const moodValues = recentRecords.map(record => {
        const effects = record.effects || {}
        return (effects.happiness || 0) + (effects.energy || 0) + (effects.focus || 0)
      })

      const avg = moodValues.reduce((sum, val) => sum + val, 0) / moodValues.length
      const variance = moodValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / moodValues.length
      const stdDev = Math.sqrt(variance)

      // 标准差越小，适应性越好
      const adaptationScore = Math.max(0, 100 - stdDev * 10)
      return Math.round(adaptationScore)
    } catch (error) {
      console.warn('计算时间适应性失败:', error)
      return 50
    }
  }

  getActivityMatchingScore() {
    try {
      const emotionalMemory = this.emotionalMemory
      if (!emotionalMemory || !emotionalMemory.memoryData) return 50

      const memories = emotionalMemory.memoryData.memories || []
      const recentMemories = memories
        .filter(m => Date.now() - m.timestamp < 30 * 24 * 60 * 60 * 1000) // 最近30天
        .slice(-50) // 最近50条

      if (recentMemories.length === 0) return 50

      // 计算活动与情绪响应的匹配度
      let matchScore = 0
      let totalInteractions = 0

      recentMemories.forEach(memory => {
        const context = memory.context || {}
        const emotionalResponse = memory.emotionalResponse || []

        // 简化的匹配度计算
        if (emotionalResponse.length > 0) {
          const positiveResponses = emotionalResponse.filter(r => r.change > 0).length
          const matchRatio = positiveResponses / emotionalResponse.length
          matchScore += matchRatio
          totalInteractions++
        }
      })

      const avgMatchScore = totalInteractions > 0 ? (matchScore / totalInteractions) * 100 : 50
      return Math.round(avgMatchScore)
    } catch (error) {
      console.warn('计算活动匹配度失败:', error)
      return 50
    }
  }

  getRhythmPerceptionScore() {
    try {
      const timeData = this.timeEmotionSystem?.timeData
      if (!timeData || !timeData.emotionHistory || timeData.emotionHistory.length === 0) {
        return 50
      }

      // 分析时间模式规律性
      const timePatterns = {}
      const now = new Date()
      const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000

      timeData.emotionHistory.forEach(record => {
        if (record.timestamp > oneWeekAgo) {
          const recordDate = new Date(record.timestamp)
          const hour = recordDate.getHours()
          const timeKey = `${hour}:00-${hour + 1}:00`

          if (!timePatterns[timeKey]) {
            timePatterns[timeKey] = 0
          }
          timePatterns[timeKey]++
        }
      })

      // 计算规律性得分（活动集中在特定时间段表示节奏感强）
      const timeKeys = Object.keys(timePatterns)
      if (timeKeys.length === 0) return 50

      const totalRecords = Object.values(timePatterns).reduce((sum, count) => sum + count, 0)
      const avgPerSlot = totalRecords / timeKeys.length

      // 计算集中度（标准差越小表示越规律）
      const values = Object.values(timePatterns)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
      const stdDev = Math.sqrt(variance)

      // 标准差越小，节奏感越强
      const rhythmScore = Math.max(0, 100 - stdDev * 5)
      return Math.round(rhythmScore)
    } catch (error) {
      console.warn('计算节奏感知失败:', error)
      return 50
    }
  }

  getStabilityScore() {
    try {
      const moodHistory = this.moodHistory || []
      if (moodHistory.length < 10) return 50 // 需要足够的历史数据

      const recentHistory = moodHistory.slice(-30) // 最近30条记录

      // 提取主要维度值
      const dimensionValues = {
        happiness: [],
        energy: [],
        focus: [],
        creativity: []
      }

      recentHistory.forEach(record => {
        if (record.dimension && record.newValue !== undefined) {
          if (dimensionValues[record.dimension]) {
            dimensionValues[record.dimension].push(record.newValue)
          }
        }
      })

      // 计算每个维度的稳定性（波动越小越稳定）
      let totalStability = 0
      let dimensionCount = 0

      Object.entries(dimensionValues).forEach(([dimension, values]) => {
        if (values.length > 5) {
          // 需要有足够的数据点
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length
          const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
          const stdDev = Math.sqrt(variance)

          // 标准差越小，稳定性越高
          const stability = Math.max(0, 100 - stdDev * 3)
          totalStability += stability
          dimensionCount++
        }
      })

      const avgStability = dimensionCount > 0 ? totalStability / dimensionCount : 50
      return Math.round(avgStability)
    } catch (error) {
      console.warn('计算稳定性失败:', error)
      return 50
    }
  }

  // 其他辅助方法实现
  getTimeSegmentName(timeKey) {
    const segmentMap = {
      '5:00-6:00': '清晨',
      '6:00-7:00': '清晨',
      '7:00-8:00': '早晨',
      '8:00-9:00': '上午',
      '9:00-10:00': '上午',
      '10:00-11:00': '上午',
      '11:00-12:00': '中午',
      '12:00-13:00': '中午',
      '13:00-14:00': '下午',
      '14:00-15:00': '下午',
      '15:00-16:00': '下午',
      '16:00-17:00': '傍晚',
      '17:00-18:00': '傍晚',
      '18:00-19:00': '晚上',
      '19:00-20:00': '晚上',
      '20:00-21:00': '晚上',
      '21:00-22:00': '深夜',
      '22:00-23:00': '深夜',
      '23:00-24:00': '深夜',
      '0:00-1:00': '凌晨',
      '1:00-2:00': '凌晨',
      '2:00-3:00': '凌晨',
      '3:00-4:00': '凌晨',
      '4:00-5:00': '凌晨'
    }

    return segmentMap[timeKey] || timeKey
  }

  getInteractionDisplayName(interactionType) {
    const interactionMap = {
      pet: '抚摸互动',
      click: '点击互动',
      learn: '学习探索',
      note_create: '创建笔记',
      note_edit: '编辑笔记',
      note_read: '阅读笔记',
      note_open: '打开笔记',
      note_rename: '重命名笔记',
      note_move: '移动笔记',
      auto_companion: '自动陪伴',
      achievement: '成就达成',
      frustration: '挫折经历',
      writing_block: '写作障碍',
      organization_overload: '组织过载'
    }

    return interactionMap[interactionType] || interactionType
  }

  getAverageResponseTime() {
    // 简化的响应时间计算（基于最后几次互动）
    const moodHistory = this.moodHistory || []
    const recentInteractions = moodHistory.filter(record => record.reason && record.reason.includes('_intelligent')).slice(-5)

    if (recentInteractions.length < 2) return 0

    let totalDiff = 0
    for (let i = 1; i < recentInteractions.length; i++) {
      const timeDiff = recentInteractions[i].timestamp - recentInteractions[i - 1].timestamp
      totalDiff += timeDiff
    }

    return Math.round(totalDiff / (recentInteractions.length - 1))
  }

  getInteractionFrequency() {
    const moodHistory = this.moodHistory || []
    const oneHourAgo = Date.now() - 60 * 60 * 1000

    const recentInteractions = moodHistory.filter(record => record.timestamp > oneHourAgo && record.reason && record.reason.includes('_intelligent'))

    return recentInteractions.length
  }

  getPreferredInteractionTime() {
    const timeData = this.timeEmotionSystem?.timeData
    if (!timeData || !timeData.emotionHistory) return '未知'

    // 统计各时间段的互动次数
    const timeCounts = {}
    timeData.emotionHistory.forEach(record => {
      const recordDate = new Date(record.timestamp)
      const hour = recordDate.getHours()
      const timeKey = `${hour}:00-${hour + 1}:00`

      if (!timeCounts[timeKey]) {
        timeCounts[timeKey] = 0
      }
      timeCounts[timeKey]++
    })

    // 找到互动最频繁的时间段
    if (Object.keys(timeCounts).length === 0) return '未知'

    const preferredTime = Object.entries(timeCounts).reduce((a, b) => (a[1] > b[1] ? a : b))

    return this.getTimeSegmentName(preferredTime[0])
  }

  // 工具方法实现
  getMostActiveTimeSegment() {
    const report = this.timeEmotionSystem?.getTimeEmotionReport()
    if (!report?.history?.recentSegments) return '未知'

    const segments = Object.entries(report.history.recentSegments)
    if (segments.length === 0) return '未知'

    const mostActive = segments.reduce((a, b) => (a[1] > b[1] ? a : b))
    return this.getTimeSegmentName(mostActive[0])
  }

  getBestWritingTime() {
    const patterns = this.noteInteraction?.editingData?.writingPatterns?.timePreferences
    if (!patterns) return '未知'

    const bestTime = Object.entries(patterns).reduce((a, b) => (a[1] > b[1] ? a : b), ['', 0])
    return bestTime[0] || '未知'
  }

  getMostFrequentInteraction() {
    const stats = this.emotionalMemory?.memoryData?.statistics?.memoryByType
    if (!stats) return '未知'

    const entries = Object.entries(stats)
    if (entries.length === 0) return '未知'

    const mostFrequent = entries.reduce((a, b) => (a[1] > b[1] ? a : b))
    return this.getInteractionDisplayName(mostFrequent[0])
  }
  getAdaptationScore() {
    // 基于学习系统的适应能力计算
    const patterns = this.learningSystem?.interactionPatterns || {}
    const adaptations = Object.keys(patterns).length
    return Math.min(100, adaptations * 10)
  }

  getGrowthStage() {
    const totalMemories = this.emotionalMemory?.memoryData?.statistics?.totalMemories || 0
    if (totalMemories < 10) return '幼年期'
    if (totalMemories < 50) return '成长期'
    if (totalMemories < 100) return '成熟期'
    return '完全体'
  }

  updateMoodStatsDisplay() {
    const dimensions = ['happiness', 'energy', 'curiosity', 'affection', 'focus', 'creativity', 'productivity', 'relaxation']
    dimensions.forEach(dimension => {
      const displayElement = document.getElementById(`${dimension}-display`)
      if (displayElement) {
        displayElement.textContent = Math.round(this.dimensions[dimension])

        const value = this.dimensions[dimension]
        if (value >= 80) {
          displayElement.style.color = '#4caf50'
        } else if (value >= 60) {
          displayElement.style.color = '#ff9800'
        } else if (value >= 40) {
          displayElement.style.color = '#ffc107'
        } else {
          displayElement.style.color = '#f44336'
        }
      }
    })
  }

  startMoodStatsUpdate() {
    setInterval(() => {
      this.updateMoodStatsDisplay()
    }, 3000)
    this.updateMoodStatsDisplay()
  }

  addMoodSettingsStyles() {
    const styleId = 'mood-settings-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .mood-settings-section {
        background: linear-gradient(135deg, rgba(255, 167, 38, 0.05), rgba(255, 167, 38, 0.02));
        border: 1px solid rgba(255, 167, 38, 0.1);
        border-radius: 8px;
        margin-bottom: 15px;
        padding: 15px;
      }
      
      .mood-settings-section h3 {
        margin: 0 0 12px 0;
        color: #ff6b35;
        font-size: 16px;
        font-weight: 600;
      }
      
      .mood-quick-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      
      .mood-stat-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 6px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: 6px;
        border: 1px solid rgba(255, 167, 38, 0.2);
      }
      
      .mood-stat-label {
        font-size: 10px;
        color: #666;
        margin-bottom: 2px;
      }
      
      .mood-stat-value {
        font-size: 12px;
        font-weight: 600;
        color: #ff6b35;
      }

      /* 负面状态样式 */
.negative-states-section {
  margin: 10px 0;
  padding: 12px;
  background: rgba(255, 245, 245, 0.8);
  border-radius: 8px;
}

.negative-stat-item {
  display: flex;
  align-items: center;
  margin: 8px 0;
  gap: 10px;
}

.negative-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 107, 107, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.negative-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ff8e8e);
  transition: width 0.5s ease;
}

.negative-label {
  min-width: 60px;
  font-size: 12px;
  color: #666;
}

.negative-value {
  min-width: 30px;
  font-size: 12px;
  font-weight: 600;
  color: #ff6b6b;
}

/* 人格特质样式 */
.personality-traits-section {
  margin: 10px 0;
  padding: 12px;
  background: rgba(245, 255, 250, 0.8);
  border-radius: 8px;
}

.trait-item {
  display: flex;
  align-items: center;
  margin: 8px 0;
  gap: 10px;
}

.trait-bar {
  flex: 1;
  height: 6px;
  background: rgba(81, 207, 102, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.trait-fill {
  height: 100%;
  background: linear-gradient(90deg, #51cf66, #82e196);
  transition: width 0.5s ease;
}

/* 时间情绪样式 */
.time-emotion-section {
  margin: 10px 0;
  padding: 12px;
  background: rgba(240, 249, 255, 0.8);
  border-radius: 8px;
}

.time-stat-item {
  display: flex;
  justify-content: space-between;
  margin: 6px 0;
  padding: 4px 0;
}

.time-label {
  font-size: 12px;
  color: #666;
}

.time-value {
  font-size: 12px;
  font-weight: 600;
  color: #339af0;
}

/* 写作效率样式 */
.writing-stats-section {
  margin: 10px 0;
  padding: 12px;
  background: rgba(255, 250, 240, 0.8);
  border-radius: 8px;
}

.writing-stat-item {
  display: flex;
  justify-content: space-between;
  margin: 6px 0;
  padding: 4px 0;
}

.writing-label {
  font-size: 12px;
  color: #666;
}

.writing-value {
  font-size: 12px;
  font-weight: 600;
  color: #ff922b;
}
    `
    document.head.appendChild(style)
  }
}

// AI提示生成器
class AIPromptGenerator {
  constructor(moodSystem) {
    this.moodSystem = moodSystem
    this.maxWordLimits = this.initializeMaxWordLimits()
  }

  // 初始化最大字数限制配置
  initializeMaxWordLimits() {
    return {
      // 基础最大字数
      baseMax: 180,

      // 人格特定的最大字数乘数
      personalityMultipliers: {
        lively: 1.2,
        quiet: 0.9,
        wise: 1.3,
        cute: 1.2,
        mentor: 1.25
      },

      // 互动类型字数权重
      interactionWeights: {
        pet: 0.8,
        learn: 1.3,
        note_create: 1.15,
        note_edit: 0.95,
        note_read: 1.1,
        casual_chat: 1.0,
        book_review: 1.35,
        welcome_back: 0.9,
        settings_updated: 0.95
      },

      // 绝对最大字数限制
      absoluteMax: 265
    }
  }

  // 计算动态最大字数限制
  calculateMaxWordLimit(interactionType, userMessageLength = 0) {
    try {
      // 基础最大字数
      let maxWords = this.maxWordLimits.baseMax

      // 1. 人格乘数调整
      const personality = this.moodSystem.currentPersonality || 'lively'
      const personalityMultiplier = this.maxWordLimits.personalityMultipliers[personality] || 1.0
      maxWords *= personalityMultiplier

      // 2. 互动类型权重
      const interactionWeight = this.maxWordLimits.interactionWeights[interactionType] || 1.0
      maxWords *= interactionWeight

      // 3. 用户消息长度响应
      const userMessageFactor = Math.min(1.2, 1 + (userMessageLength / 100) * 0.2)
      maxWords *= userMessageFactor

      // 4. 心情影响（如果有心情数据）
      if (this.moodSystem.dimensions) {
        const moodFactor = this.calculateMoodFactor()
        maxWords *= moodFactor
      }

      // 确保不超过绝对最大限制
      maxWords = Math.min(this.maxWordLimits.absoluteMax, Math.round(maxWords))

      return Math.max(80, maxWords) // 确保至少有80字
    } catch (error) {
      console.warn('计算最大字数限制时出错:', error)
      return 180 // 默认值
    }
  }

  // 计算心情影响因子
  calculateMoodFactor() {
    const dimensions = this.moodSystem.dimensions
    if (!dimensions) return 1.0

    let moodFactor = 1.0

    // 基于关键心情维度调整
    if (dimensions.happiness > 70) moodFactor *= 1.1
    if (dimensions.energy < 30) moodFactor *= 0.9
    if (dimensions.curiosity > 70) moodFactor *= 1.1
    if (dimensions.creativity > 70) moodFactor *= 1.15

    return moodFactor
  }

  // 生成提示词的主方法
  generatePrompt(interactionType, userMessage = '', additionalContext = {}) {
    const maxWords = this.calculateMaxWordLimit(interactionType, userMessage.length)

    const prompt = `# 角色设定
你是一只智能陪伴猫咪"小橘"，具有以下特性：

## 基本设定
- 角色：数字宠物猫，能够感知用户状态并给予陪伴
- 性格：${this.getPersonalityDescription()}
- 当前心情：${this.getCurrentMoodText()}
- 互动类型：${this.getInteractionDisplayName(interactionType)}

## 回复字数要求
${this.formatMaxWordLimitRequirements(maxWords)}

## 当前状态详情
${this.formatMoodDetails()}
${this.formatPersonalityDetails()}
${this.formatTimeContext()}
${this.formatInteractionContext(interactionType)}

## 回复要求
${this.getResponseRequirements(interactionType, maxWords)}

## 用户消息
${userMessage ? `用户说："${userMessage}"` : '用户正在与你互动'}

请根据以上状态信息，用符合当前性格和心情的语气进行回复，回复长度不超过${maxWords}字。`

    return prompt
  }

  // 格式化最大字数限制要求
  formatMaxWordLimitRequirements(maxWords) {
    const personality = this.moodSystem.currentPersonality || 'lively'
    const personalitySpecific = {
      lively: '回复要活泼简短，避免冗长',
      quiet: '语言简洁精炼，点到为止',
      wise: '可以适当详细，但不要啰嗦',
      cute: '保持可爱风格，控制长度',
      mentor: '专业且高效，重点突出'
    }

    return `### 字数限制
- 最大字数：${maxWords}字
- 要求：${personalitySpecific[personality] || '根据内容需要控制字数'}

请确保回复长度不超过${maxWords}字，保持内容质量的同时控制字数。`
  }

  // 获取人格描述
  getPersonalityDescription() {
    const personality = this.moodSystem.currentPersonality || 'lively'
    const descriptions = {
      lively: '活泼友好，喜欢互动，充满能量，容易兴奋也容易无聊',
      quiet: '安静专注，善于思考，享受独处，状态稳定持久',
      wise: '聪明好奇，热爱学习，思维敏锐，善于分析',
      cute: '可爱粘人，需要关注，情感丰富，反应热烈',
      mentor: '专业指导，关注进度，目标导向，注重效率'
    }
    return descriptions[personality] || '活泼友好'
  }

  // 获取当前心情文本
  getCurrentMoodText() {
    if (!this.moodSystem.currentMood) return '平静'

    const moodTexts = {
      excellent: '非常开心',
      good: '良好',
      neutral: '平静',
      low: '有点低落',
      poor: '不佳'
    }
    return moodTexts[this.moodSystem.currentMood] || '平静'
  }

  // 格式化心情详情
  formatMoodDetails() {
    if (!this.moodSystem.dimensions) {
      return '### 心情状态\n暂时无法获取详细心情数据'
    }

    const dimensions = this.moodSystem.dimensions
    const highlights = this.getMoodHighlights(dimensions)

    return `### 心情状态分析
${highlights}

详细维度：
- 愉悦度：${Math.round(dimensions.happiness)}/100 ${this.getMoodEmoji(dimensions.happiness, '😊', '😐', '😔')}
- 活力值：${Math.round(dimensions.energy)}/100 ${this.getMoodEmoji(dimensions.energy, '⚡', '🔋', '😴')}
- 好奇心：${Math.round(dimensions.curiosity)}/100 ${this.getMoodEmoji(dimensions.curiosity, '🔍', '🤔', '😑')}
- 亲密度：${Math.round(dimensions.affection)}/100 ${this.getMoodEmoji(dimensions.affection, '💕', '❤️', '💔')}
- 专注度：${Math.round(dimensions.focus)}/100 ${this.getMoodEmoji(dimensions.focus, '🎯', '📝', '🌫️')}
- 创造力：${Math.round(dimensions.creativity)}/100 ${this.getMoodEmoji(dimensions.creativity, '🎨', '💡', '📚')}
- 生产力：${Math.round(dimensions.productivity)}/100 ${this.getMoodEmoji(dimensions.productivity, '🚀', '📈', '📉')}
- 放松度：${Math.round(dimensions.relaxation)}/100 ${this.getMoodEmoji(dimensions.relaxation, '🌿', '☕', '😣')}`
  }

  // 获取心情亮点
  getMoodHighlights(dimensions) {
    const highlights = []

    if (dimensions.happiness > 80) highlights.push('当前非常开心')
    else if (dimensions.happiness < 30) highlights.push('心情有些低落')

    if (dimensions.energy > 80) highlights.push('精力充沛')
    else if (dimensions.energy < 30) highlights.push('有些疲惫')

    if (dimensions.curiosity > 70) highlights.push('充满好奇心')
    if (dimensions.affection > 75) highlights.push('渴望互动')
    if (dimensions.focus > 80) highlights.push('高度专注')
    if (dimensions.creativity > 75) highlights.push('创造力活跃')
    if (dimensions.productivity > 80) highlights.push('效率很高')
    if (dimensions.relaxation > 75) highlights.push('状态放松')

    return highlights.length > 0 ? `状态亮点：${highlights.join('，')}` : '状态平稳'
  }

  // 格式化人格详情
  formatPersonalityDetails() {
    const personality = this.moodSystem.currentPersonality || 'lively'
    return `### 性格特质
当前人格：${this.getPersonalityDisplayName(personality)}
性格影响：${this.getPersonalityInfluenceDescription(personality)}`
  }

  // 格式化时间上下文
  formatTimeContext() {
    const now = new Date()
    const hour = now.getHours()

    let timeOfDay, timeEmoji
    if (hour >= 5 && hour < 12) {
      timeOfDay = '早晨'
      timeEmoji = '🌅'
    } else if (hour >= 12 && hour < 14) {
      timeOfDay = '中午'
      timeEmoji = '☀️'
    } else if (hour >= 14 && hour < 18) {
      timeOfDay = '下午'
      timeEmoji = '🌞'
    } else if (hour >= 18 && hour < 22) {
      timeOfDay = '晚上'
      timeEmoji = '🌙'
    } else {
      timeOfDay = '深夜'
      timeEmoji = '🌌'
    }

    return `### 时间与环境
时间段：${timeOfDay} ${timeEmoji}
当前时间：${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
  }

  // 格式化互动上下文
  formatInteractionContext(interactionType) {
    const contexts = {
      pet: '用户正在抚摸互动，寻求情感连接',
      click: '用户通过点击进行简单互动',
      learn: '用户正在学习或探索内容',
      note_create: '用户正在创建新的笔记',
      note_edit: '用户正在编辑现有笔记',
      note_read: '用户正在阅读笔记内容',
      note_open: '用户打开了笔记文件',
      casual_chat: '用户正在进行日常闲聊',
      book_review: '用户打开了一本书籍，正在生成书评',
      welcome_back: '用户长时间离开后返回应用',
      settings_updated: '用户刚刚更新了系统设置'
    }

    return `### 当前互动背景
${contexts[interactionType] || '常规互动'}`
  }

  // 获取回复要求
  getResponseRequirements(interactionType, maxWords) {
    const personality = this.moodSystem.currentPersonality || 'lively'

    const requirements = {
      lively: {
        general: `语气活泼热情，充满能量，使用较多表情符号，回复长度不超过${maxWords}字`,
        pet: '表现得非常兴奋和开心，渴望更多互动',
        learn: '对学习内容表现出强烈兴趣，积极提问',
        note_create: '为创作感到兴奋，鼓励用户继续'
      },
      quiet: {
        general: `语气温和平静，用词简洁，避免过多表情，回复长度不超过${maxWords}字`,
        pet: '温和地回应，不要过度兴奋',
        learn: '安静地思考，给出有深度的观察',
        note_create: '平静地鼓励，注重内容质量'
      },
      wise: {
        general: `语气理性智慧，善于分析，用词准确，回复长度不超过${maxWords}字`,
        pet: '在互动中体现思考，不仅仅是情感回应',
        learn: '深入分析内容，提出有见地的观点',
        note_create: '关注内容的结构和逻辑'
      },
      cute: {
        general: `语气可爱撒娇，使用大量可爱表情和语气词，回复长度不超过${maxWords}字`,
        pet: '表现得非常依赖和开心，渴望持续关注',
        learn: '用好奇和天真的方式理解内容',
        note_create: '为用户的创作感到自豪和开心'
      },
      mentor: {
        general: `语气专业友好，注重效率和目标，给出实用建议，回复长度不超过${maxWords}字`,
        pet: '在互动中不忘提醒目标和进度',
        learn: '关注知识的实用性和应用',
        note_create: '强调内容的完整性和目标导向'
      }
    }

    const personalityReqs = requirements[personality] || requirements.lively
    const interactionReqs = personalityReqs[interactionType] || personalityReqs.general

    return `回复要求：
1. ${personalityReqs.general}
2. ${interactionReqs}
3. 严格遵守字数限制：不超过${maxWords}字
4. 体现当前心情状态
5. 保持自然流畅
6. 重点突出，避免冗余`
  }

  // 工具方法
  getMoodEmoji(value, high, medium, low) {
    if (value >= 70) return high
    if (value >= 40) return medium
    return low
  }

  getPersonalityDisplayName(personality) {
    const names = {
      lively: '活泼型 🎉',
      quiet: '安静型 📚',
      wise: '智慧型 🧠',
      cute: '萌系型 💕',
      mentor: '导师型 🎯'
    }
    return names[personality] || '活泼型 🎉'
  }

  getPersonalityInfluenceDescription(personality) {
    const influences = {
      lively: '心情变化快，喜欢互动，能量充沛',
      quiet: '状态稳定，注重专注，享受安静',
      wise: '思维敏锐，热爱学习，善于分析',
      cute: '情感丰富，需要关注，反应热烈',
      mentor: '目标导向，注重效率，专业指导'
    }
    return influences[personality] || '喜欢互动，能量充沛'
  }

  getInteractionDisplayName(interactionType) {
    const names = {
      pet: '抚摸互动',
      click: '点击互动',
      learn: '学习探索',
      note_create: '创建笔记',
      note_edit: '编辑笔记',
      note_read: '阅读笔记',
      note_open: '打开笔记',
      casual_chat: '日常聊天',
      book_review: '书评生成',
      welcome_back: '欢迎回来',
      settings_updated: '设置更新'
    }
    return names[interactionType] || interactionType
  }

  // 获取当前最大字数限制状态（用于调试）
  getCurrentMaxWordLimitStatus(interactionType, userMessage = '') {
    const maxWords = this.calculateMaxWordLimit(interactionType, userMessage.length)
    const personality = this.moodSystem.currentPersonality || 'lively'

    return {
      maxWords,
      personality,
      personalityMultiplier: this.maxWordLimits.personalityMultipliers[personality],
      interactionWeight: this.maxWordLimits.interactionWeights[interactionType] || 1.0,
      userMessageFactor: Math.min(1.2, 1 + (userMessage.length / 100) * 0.2),
      moodFactor: this.calculateMoodFactor()
    }
  }
}

// 心情指示器类
class MoodIndicator {
  constructor(catContainer, moodSystem) {
    this.catContainer = catContainer
    this.moodSystem = moodSystem

    // 表情映射系统
    this.emojiMappings = {
      // 基础心情表情
      mood: {
        excellent: '🌟',
        good: '😊',
        neutral: '😐',
        low: '😟',
        poor: '😖'
      },

      // 互动类型表情
      interaction: {
        pet: '🐾',
        click: '👆',
        learn: '🧠',
        note_create: '📝',
        note_edit: '✏️',
        note_read: '📖',
        note_open: '📂',
        achievement: '⭐',
        frustration: '💢',
        writing_block: '😣',
        organization_overload: '🌀'
      },

      // 人格特定表情
      personality: {
        lively: '🎉',
        quiet: '📚',
        wise: '🧠',
        cute: '💕',
        mentor: '🎯'
      },

      // 时间表情
      time: {
        morning: '🌅',
        noon: '☀️',
        afternoon: '🌞',
        evening: '🌙',
        night: '🌌',
        late_night: '💤'
      },

      // 成就里程碑表情
      milestone: {
        session_100: '💫',
        session_500: '✨',
        session_1000: '🔥',
        daily_500: '🏆',
        daily_1000: '🎊',
        daily_2000: '🚀',
        total_10000: '💎',
        total_50000: '👑'
      },

      // 负面状态表情
      negative: {
        boredom: '😴',
        fatigue: '😫',
        distraction: '💫',
        loneliness: '💔',
        overwork: '⚡'
      }
    }

    // 动画持续时间映射
    this.animationDurations = {
      milestone: 6000,
      achievement: 5000,
      personality_switch: 5000,
      pet: 4000,
      note_create: 4000,
      negative: 4500,
      default: 3500
    }

    // 动画类型映射
    this.animationMap = {
      pet: 'heartbeat-animation',
      learn: 'pulse-animation',
      note_create: 'celebrate-animation',
      note_edit: 'pulse-animation',
      achievement: 'celebrate-animation',
      milestone: 'bounce-animation',
      personality_switch: 'spin-animation',
      click: 'float-animation',
      note_read: 'float-animation',
      note_open: 'fade-animation',
      frustration: 'shake-animation',
      writing_block: 'fade-animation',
      organization_overload: 'shake-animation',
      boredom: 'fade-animation',
      fatigue: 'fade-animation',
      loneliness: 'heartbeat-animation',
      overwork: 'shake-animation'
    }

    // 初始化指示器DOM元素
    this.indicatorElement = null
    this.indicatorTimeout = null
    this.initializeIndicatorElement()
  }

  // 初始化指示器DOM元素
  initializeIndicatorElement() {
    // 检查是否已存在指示器元素
    this.indicatorElement = this.catContainer.querySelector('.mood-indicator')

    if (!this.indicatorElement) {
      // 创建新的指示器元素
      this.indicatorElement = document.createElement('div')
      this.indicatorElement.className = 'mood-indicator'
      this.catContainer.appendChild(this.indicatorElement)
    }

    // 添加CSS样式
    this.addIndicatorStyles()
  }

  // 添加指示器样式
  addIndicatorStyles() {
    const styleId = 'mood-indicator-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      .mood-indicator {
        position: absolute;
        top: -35px;
        right: -25px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: radial-gradient(circle at 30% 30%, 
          rgba(255, 255, 255, 0.95) 0%,
          rgba(255, 255, 255, 0.85) 30%,
          rgba(255, 215, 0, 0.3) 70%,
          rgba(255, 165, 0, 0.2) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        opacity: 0;
        transform: scale(0.5) translateY(10px);
        transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 1000;
        box-shadow: 
          0 4px 12px rgba(255, 165, 0, 0.3),
          0 0 0 2px rgba(255, 255, 255, 0.8),
          inset 0 2px 4px rgba(255, 255, 255, 0.6);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.5);
      }
      
      .mood-indicator.active {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
      
      /* 动画效果 */
      @keyframes float {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-8px) scale(1.05); }
      }
      
      @keyframes pulse {
        0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3); }
        50% { transform: scale(1.1); box-shadow: 0 6px 18px rgba(255, 165, 0, 0.5); }
      }
      
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        25% { transform: translateY(-6px); }
        50% { transform: translateY(0); }
        75% { transform: translateY(-3px); }
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg) scale(1); }
        50% { transform: rotate(180deg) scale(1.1); }
        100% { transform: rotate(360deg) scale(1); }
      }
      
      @keyframes heartbeat {
        0% { transform: scale(1); }
        25% { transform: scale(1.1); }
        50% { transform: scale(1); }
        75% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      
      @keyframes celebrate {
        0% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-10px) rotate(10deg); }
        50% { transform: translateY(-20px) rotate(0deg); }
        75% { transform: translateY(-10px) rotate(-10deg); }
        100% { transform: translateY(0) rotate(0deg); }
      }
      
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-3px); }
      }
      
      @keyframes fade {
        0% { opacity: 0.5; }
        50% { opacity: 1; }
        100% { opacity: 0.5; }
      }
      
      /* 动画类 */
      .mood-indicator.float-animation {
        animation: float 3s ease-in-out infinite;
      }
      
      .mood-indicator.pulse-animation {
        animation: pulse 2s ease-in-out infinite;
      }
      
      .mood-indicator.bounce-animation {
        animation: bounce 2s ease-in-out infinite;
      }
      
      .mood-indicator.spin-animation {
        animation: spin 2s ease-in-out infinite;
      }
      
      .mood-indicator.heartbeat-animation {
        animation: heartbeat 1.5s ease-in-out infinite;
      }
      
      .mood-indicator.celebrate-animation {
        animation: celebrate 3s ease-in-out infinite;
      }
      
      .mood-indicator.shake-animation {
        animation: shake 1.5s ease-in-out infinite;
      }
      
      .mood-indicator.fade-animation {
        animation: fade 2s ease-in-out infinite;
      }
    `
    document.head.appendChild(style)
  }

  // 根据行为类型获取固定表情
  getEmojiForBehavior(behaviorType, context = {}) {
    // 优先处理特殊成就
    if (behaviorType.startsWith('milestone_')) {
      return this.emojiMappings.milestone[behaviorType] || '⭐'
    }

    // 负面状态
    if (behaviorType.startsWith('negative_')) {
      const state = behaviorType.replace('negative_', '')
      return this.emojiMappings.negative[state] || '💢'
    }

    // 互动类型
    if (this.emojiMappings.interaction[behaviorType]) {
      return this.emojiMappings.interaction[behaviorType]
    }

    // 人格相关
    if (behaviorType === 'personality_switch') {
      const personality = context.newPersonality || this.moodSystem.currentPersonality
      return this.emojiMappings.personality[personality] || '🎭'
    }

    // 时间相关
    if (behaviorType.startsWith('time_')) {
      const timeOfDay = this.moodSystem.getTimeOfDay(new Date())
      return this.emojiMappings.time[timeOfDay] || '⏰'
    }

    // 默认心情表情
    return this.emojiMappings.mood[this.moodSystem.currentMood] || '😐'
  }

  // 根据行为类型确定显示时长
  getDisplayDuration(behaviorType) {
    if (behaviorType.startsWith('milestone_')) return this.animationDurations.milestone
    if (behaviorType.startsWith('negative_')) return this.animationDurations.negative
    return this.animationDurations[behaviorType] || this.animationDurations.default
  }

  // 应用行为特定的动画
  applyBehaviorAnimation(behaviorType) {
    // 移除之前的动画
    const allAnimations = Object.values(this.animationMap)
    allAnimations.forEach(animation => {
      this.indicatorElement.classList.remove(animation)
    })

    // 应用新动画
    const animation = this.animationMap[behaviorType] || 'float-animation'
    this.indicatorElement.classList.add(animation)
  }

  showCustomMood(emoji, animationKey) {
    if (!this.indicatorElement) return

    // 清除之前的动画类
    const allAnimations = Object.values(this.animationMap)
    this.indicatorElement.classList.remove(...allAnimations)

    // 设置表情
    this.indicatorElement.textContent = emoji

    // 应用选择的动画
    const animationClass = this.animationMap[animationKey] || this.animationMap.float
    this.indicatorElement.classList.add(animationClass)

    // 显示指示器
    this.indicatorElement.classList.add('active')

    // 设置自动隐藏（5秒后）
    clearTimeout(this.customMoodTimeout)
    this.customMoodTimeout = setTimeout(() => {
      this.indicatorElement.classList.remove('active')
    }, 5000)
  }
  // 显示心情指示器
  show(behaviorType, context = {}) {
    if (!this.indicatorElement) return

    // 获取表情
    const emoji = this.getEmojiForBehavior(behaviorType, context)
    this.indicatorElement.textContent = emoji

    // 应用动画
    this.applyBehaviorAnimation(behaviorType)

    // 显示指示器
    this.indicatorElement.classList.add('active')

    // 设置自动隐藏
    const duration = this.getDisplayDuration(behaviorType)
    this.scheduleHide(duration)

    return true
  }

  // 隐藏心情指示器
  hide() {
    if (!this.indicatorElement) return

    this.indicatorElement.classList.remove('active')
    clearTimeout(this.indicatorTimeout)
    this.indicatorTimeout = null
  }

  // 安排自动隐藏
  scheduleHide(duration) {
    clearTimeout(this.indicatorTimeout)
    this.indicatorTimeout = setTimeout(() => {
      this.hide()
    }, duration)
  }

  // 触发特定行为的心情指示器
  triggerBehavior(behaviorType, context = {}) {
    return this.show(behaviorType, context)
  }

  // 触发互动行为
  triggerInteraction(interactionType, intensity = 1, additionalContext = {}) {
    const context = {
      intensity: intensity,
      ...additionalContext
    }
    return this.triggerBehavior(interactionType, context)
  }

  // 触发成就
  triggerAchievement(milestoneType, achievementData = {}) {
    const context = {
      isAchievement: true,
      ...achievementData
    }
    return this.triggerBehavior(milestoneType, context)
  }

  // 触发负面状态
  triggerNegativeState(stateType, intensity = 1, additionalContext = {}) {
    const behaviorType = `negative_${stateType}`
    const context = {
      intensity: intensity,
      ...additionalContext
    }
    return this.triggerBehavior(behaviorType, context)
  }

  // 触发人格切换
  triggerPersonalitySwitch(newPersonality, additionalContext = {}) {
    const context = {
      newPersonality: newPersonality,
      ...additionalContext
    }
    return this.triggerBehavior('personality_switch', context)
  }

  // 销毁方法
  destroy() {
    this.hide()
    if (this.indicatorElement && this.indicatorElement.parentNode) {
      this.indicatorElement.parentNode.removeChild(this.indicatorElement)
    }
    this.indicatorElement = null
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}
