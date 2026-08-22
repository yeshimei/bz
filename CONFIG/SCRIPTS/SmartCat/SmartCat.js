let catContainer = document.getElementById('smart-companion-cat')
let settingsPanel = document.getElementById('settings-panel')
let chatPanel = document.getElementById('chat-panel')
let panelMask = document.getElementById('panel-mask')
let config
let isPageVisible = true
let backMessageTimer
let allowBackMessage
const getSmartCatMessage = window.smartCat.getSmartCatMessage
let pendingChatMessage = null

// 事件系统
class EventSystem {
  constructor() {
    this.events = {}
  }

  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event, callback) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit(event, data) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error)
      }
    })
  }
}

// 配置管理器
class ConfigManager {
  constructor() {
    this.defaultConfig = {
      appearance: 'orange',
      customColors: {
        primary: '#FF6B35',
        secondary: '#F7931E'
      },
      personality: 'lively',
      customPersonality: '你是一只聪明可爱的小橘助手，喜欢陪伴用户写笔记。回答要简短友好，偶尔可以卖萌。',
      speakInterval: 5,
      speakProbability: 0.3,
      responseSensitivity: 'medium',
      contextLength: 500,
      contextSplitRatio: 0.5,
      apiKey: '',
      conversationHistory: [],
      shortTermMemory: 50
    }
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem('smart-cat-config')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (!parsed.shortTermMemory || parsed.shortTermMemory < 50 || parsed.shortTermMemory > 200) {
          parsed.shortTermMemory = 50
        }
        return { ...this.defaultConfig, ...parsed }
      }
      return this.defaultConfig
    } catch {
      return this.defaultConfig
    }
  }

  saveConfig(config) {
    if (config.conversationHistory && config.conversationHistory.length > config.shortTermMemory) {
      const maxMessages = Math.min(config.shortTermMemory * 2, config.conversationHistory.length)
      config.conversationHistory = config.conversationHistory.slice(-maxMessages)
    }
    localStorage.setItem('smart-cat-config', JSON.stringify(config))
  }
}

// 外观管理器
class AppearanceManager {
  constructor(catContainer, eventSystem) {
    this.catContainer = catContainer
    this.eventSystem = eventSystem
    this.advancedSkins = {
      // 霓虹灯效果
      neon: {
        primary: '#00FFFF',
        secondary: '#FF00FF',
        style: `
            background: linear-gradient(135deg, #00FFFF, #FF00FF);
            box-shadow: 
                0 0 20px #00FFFF,
                0 0 40px #FF00FF,
                0 0 60px #00FFFF;
            animation: neonPulse 2s ease-in-out infinite alternate;
        `,
        earStyle: `
            background: #00FFFF;
            box-shadow: 0 0 10px #00FFFF;
        `,
        tailStyle: `
            background: #FF00FF;
            box-shadow: 0 0 15px #FF00FF;
            animation: neonTail 3s ease-in-out infinite;
        `
      },

      // 银河星空效果
      galaxy: {
        primary: '#1a1a2e',
        secondary: '#16213e',
        style: `
            background: radial-gradient(circle at 30% 30%, #1a1a2e, #16213e, #0f3460);
            position: relative;
            overflow: hidden;
        `,
        earStyle: `
            background: linear-gradient(45deg, #533483, #e94560);
        `,
        tailStyle: `
            background: linear-gradient(90deg, #533483, #e94560);
            animation: galaxyTail 4s ease-in-out infinite;
        `,
        afterStyle: `
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px),
                radial-gradient(circle at 80% 30%, #fff 1px, transparent 1px),
                radial-gradient(circle at 40% 70%, #fff 1px, transparent 1px),
                radial-gradient(circle at 60% 80%, #fff 2px, transparent 2px);
            background-size: 50px 50px;
            animation: twinkle 8s linear infinite;
        `
      },

      // 液态金属效果
      liquidMetal: {
        primary: '#bdc3c7',
        secondary: '#95a5a6',
        style: `
            background: linear-gradient(135deg, 
                #ecf0f1 0%, 
                #bdc3c7 25%, 
                #95a5a6 50%, 
                #7f8c8d 75%, 
                #34495e 100%);
            background-size: 400% 400%;
            animation: liquidFlow 6s ease-in-out infinite;
            position: relative;
            overflow: hidden;
        `,
        earStyle: `
            background: linear-gradient(45deg, #bdc3c7, #95a5a6);
            box-shadow: inset 0 0 10px rgba(255,255,255,0.5);
        `,
        tailStyle: `
            background: linear-gradient(90deg, #bdc3c7, #95a5a6);
            animation: metalTail 3s ease-in-out infinite;
        `,
        beforeStyle: `
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(45deg, 
                transparent 30%, 
                rgba(255,255,255,0.1) 50%, 
                transparent 70%);
            animation: shine 3s ease-in-out infinite;
        `
      },

      // 火焰效果
      fire: {
        primary: '#ff6b35',
        secondary: '#f7931e',
        style: `
            background: linear-gradient(135deg, 
                #ff6b35 0%, 
                #f7931e 25%, 
                #ff8c00 50%, 
                #ff4500 75%, 
                #dc143c 100%);
            background-size: 200% 200%;
            animation: fireBurn 4s ease-in-out infinite;
            position: relative;
        `,
        earStyle: `
            background: linear-gradient(45deg, #ff6b35, #ff4500);
            box-shadow: 0 0 15px #ff6b35;
        `,
        tailStyle: `
            background: linear-gradient(90deg, #ff6b35, #ff4500);
            animation: fireTail 2s ease-in-out infinite;
        `,
        afterStyle: `
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                radial-gradient(circle at 30% 20%, #ff8c00 2px, transparent 2px),
                radial-gradient(circle at 70% 30%, #ff4500 3px, transparent 3px),
                radial-gradient(circle at 40% 70%, #dc143c 2px, transparent 2px);
            animation: emberFloat 5s ease-in-out infinite;
        `
      },

      // 水晶透明效果
      crystal: {
        primary: 'rgba(255,255,255,0.1)',
        secondary: 'rgba(255,255,255,0.05)',
        style: `
            background: linear-gradient(135deg, 
                rgba(255,255,255,0.1) 0%, 
                rgba(255,255,255,0.05) 50%, 
                rgba(255,255,255,0.1) 100%);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.2);
            position: relative;
            overflow: hidden;
        `,
        earStyle: `
            background: rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
        `,
        tailStyle: `
            background: rgba(255,255,255,0.3);
            backdrop-filter: blur(10px);
            animation: crystalTail 4s ease-in-out infinite;
        `,
        beforeStyle: `
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, 
                transparent 45%, 
                rgba(255,255,255,0.1) 50%, 
                transparent 55%);
            animation: crystalShine 6s ease-in-out infinite;
        `
      },

      // 赛博朋克效果
      cyberpunk: {
        primary: '#00ff88',
        secondary: '#0088ff',
        style: `
            background: linear-gradient(135deg, 
                #00ff88 0%, 
                #0088ff 50%, 
                #ff0088 100%);
            background-size: 300% 300%;
            animation: cyberGlitch 5s ease-in-out infinite;
            position: relative;
            overflow: hidden;
        `,
        earStyle: `
            background: #00ff88;
            box-shadow: 
                0 0 10px #00ff88,
                0 0 20px #0088ff;
        `,
        tailStyle: `
            background: linear-gradient(90deg, #00ff88, #0088ff);
            animation: cyberTail 3s ease-in-out infinite;
        `,
        afterStyle: `
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: 
                repeating-linear-gradient(90deg, 
                    transparent 0px, 
                    transparent 2px, 
                    rgba(0,255,136,0.1) 2px, 
                    rgba(0,255,136,0.1) 4px),
                repeating-linear-gradient(0deg, 
                    transparent 0px, 
                    transparent 2px, 
                    rgba(0,136,255,0.1) 2px, 
                    rgba(0,136,255,0.1) 4px);
            animation: gridScan 4s linear infinite;
        `
      },

      // 彩虹渐变效果
      rainbow: {
        primary: '#ff6b6b',
        secondary: '#4ecdc4',
        style: `
            background: linear-gradient(135deg, 
                #ff6b6b 0%, 
                #ffa726 16.66%, 
                #ffee58 33.33%, 
                #4ecdc4 50%, 
                #45b7d1 66.66%, 
                #96ceb4 83.33%, 
                #ff6b6b 100%);
            background-size: 400% 400%;
            animation: rainbowFlow 8s ease-in-out infinite;
        `,
        earStyle: `
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
        `,
        tailStyle: `
            background: linear-gradient(90deg, #ff6b6b, #4ecdc4);
            animation: rainbowTail 4s ease-in-out infinite;
        `
      },

      // 全息投影效果
      hologram: {
        primary: 'rgba(0,255,255,0.3)',
        secondary: 'rgba(255,0,255,0.3)',
        style: `
            background: linear-gradient(135deg, 
                rgba(0,255,255,0.3) 0%, 
                rgba(255,0,255,0.3) 50%, 
                rgba(255,255,0,0.3) 100%);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255,255,255,0.1);
            position: relative;
            overflow: hidden;
        `,
        earStyle: `
            background: rgba(0,255,255,0.5);
            backdrop-filter: blur(5px);
        `,
        tailStyle: `
            background: rgba(255,0,255,0.5);
            animation: hologramTail 3s ease-in-out infinite;
        `,
        afterStyle: `
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent, 
                rgba(255,255,255,0.4), 
                transparent);
            animation: hologramScan 3s ease-in-out infinite;
        `
      }
    }
  }

  applyAppearance(config) {
    const catBody = this.catContainer.querySelector('#cat-body')
    const ears = this.catContainer.querySelectorAll('.cat-ear')
    const tail = this.catContainer.querySelector('.cat-tail')

    catBody.className = catBody.className.replace(/\bskin-\S+/g, '')

    this.applyBaseStyles(catBody, ears, tail)

    const skin = this.advancedSkins[config.appearance] || this.getBasicSkin(config.appearance)

    if (skin) {
      catBody.classList.add(`skin-${config.appearance}`)
      this.applySkinStyles(catBody, ears, tail, skin)
    }

    this.eventSystem.emit('appearanceChanged', { appearance: config.appearance })
  }

  applyBaseStyles(catBody, ears, tail) {
    catBody.style.cssText = `
      width: 50px;
      height: 40px;
      border-radius: 25px 25px 15px 15px;
      position: relative;
      animation: catFloat 4s ease-in-out infinite;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    `

    ears.forEach(ear => {
      ear.style.cssText = `
        position: absolute;
        top: -6px;
        width: 10px;
        height: 12px;
        border-radius: 50%;
      `
    })

    tail.style.cssText = `
      position: absolute;
      right: -12px;
      bottom: 8px;
      width: 15px;
      height: 4px;
      border-radius: 2px;
      transform-origin: left center;
      animation: tailSway 3s ease-in-out infinite;
    `
  }

  getBasicSkin(appearance) {
    const basicSkins = {
      orange: {
        primary: '#FF6B35',
        secondary: '#F7931E',
        earStyle: 'background: #FF6B35;',
        tailStyle: 'background: #FF6B35;'
      },
      gray: {
        primary: '#95A5A6',
        secondary: '#7F8C8D',
        earStyle: 'background: #95A5A6;',
        tailStyle: 'background: #95A5A6;'
      },
      black: {
        primary: '#2C3E50',
        secondary: '#34495E',
        earStyle: 'background: #2C3E50;',
        tailStyle: 'background: #2C3E50;'
      },
      white: {
        primary: '#ECF0F1',
        secondary: '#BDC3C7',
        earStyle: 'background: #ECF0F1;',
        tailStyle: 'background: #ECF0F1;'
      },
      calico: {
        primary: '#E74C3C',
        secondary: '#F39C12',
        earStyle: 'background: #E74C3C;',
        tailStyle: 'background: #E74C3C;'
      }
    }

    return basicSkins[appearance]
  }

  applySkinStyles(catBody, ears, tail, skin) {
    if (skin.style) {
      catBody.style.cssText += skin.style
    } else {
      catBody.style.background = `linear-gradient(135deg, ${skin.primary}, ${skin.secondary})`
    }

    ears.forEach(ear => {
      if (skin.earStyle) {
        ear.style.cssText += skin.earStyle
      } else {
        ear.style.background = skin.primary
      }
    })

    if (skin.tailStyle) {
      tail.style.cssText += skin.tailStyle
    } else {
      tail.style.background = skin.primary
    }
  }

  setAdvancedSkins(skins) {
    this.advancedSkins = skins
  }
}

// 气泡消息管理器
class BubbleManager {
  constructor(eventSystem) {
    this.eventSystem = eventSystem
    this.bubbleQueue = []
    this.isCurrentBubbleTyping = false
    this.currentBubble = null
    this.bubbleClickState = {
      firstClickTimestamp: 0,
      clickTimeout: null,
      isPermanent: false
    }
  }

  showBubble(message, duration = null) {
    if (!isPageVisible) return
    const  icon = window.smartCat.app.emojiProcessor.process(message)

    if (icon) {
      message = message.replace(icon, "")
      window.smartCat.app.moodIndicator.showCustomMood(icon)
    }
    
    this.bubbleQueue.push({
      message,
      duration,
      timestamp: Date.now()
    })

    if (!this.isCurrentBubbleTyping) this.processBubbleQueue()

    this.eventSystem.emit('bubbleQueued', { message, duration })
  }

  processBubbleQueue() {
    if (this.bubbleQueue.length === 0 || this.isCurrentBubbleTyping) {
      return
    }

    this.isCurrentBubbleTyping = true
    const bubbleData = this.bubbleQueue.shift()
    this.showBubbleInternal(bubbleData.message, bubbleData.duration)
  }

  showBubbleInternal(message, duration = null) {
    if (!message) return

    const bubblesContainer = document.querySelector('#cat-bubbles-container')
    if (!bubblesContainer) return

    const bubble = document.createElement('div')
    bubble.className = 'cat-bubble'
    this.currentBubble = bubble

    const timing = this.calculateBubbleTiming(message, duration)

    bubblesContainer.appendChild(bubble)

    const allBubbles = Array.from(bubblesContainer.querySelectorAll('.cat-bubble'))
    const newBubbleIndex = allBubbles.length - 1

    this.pushExistingBubbles(allBubbles, newBubbleIndex)

    void bubble.offsetWidth
    bubble.classList.add('show')

    this.startTypingEffect(bubble, message, timing)

    if (allBubbles.length > 4) {
      const oldestBubble = allBubbles[0]
      this.removeBubble(oldestBubble, true)
    }

    this.setupBubbleInteractions(bubble, message, timing)

    this.eventSystem.emit('bubbleShown', { message, duration: timing.baseDisplayDuration })
  }

  calculateBubbleTiming(message, duration) {
    let baseDisplayDuration = duration
    if (baseDisplayDuration === null) {
      const baseDuration = 1000
      const charCount = message.length
      const perCharDuration = 200
      baseDisplayDuration = Math.min(baseDuration + charCount * perCharDuration, 15000)
      baseDisplayDuration = Math.max(baseDisplayDuration, 1000)
    }

    const MAX_TYPING_DURATION = 5000
    const TYPING_RATIO = 0.6
    const charCount = message.length
    const requiredTypingDuration = Math.min(charCount * 100, MAX_TYPING_DURATION)

    let typingDuration, displayDuration

    if (requiredTypingDuration <= MAX_TYPING_DURATION) {
      if (requiredTypingDuration <= baseDisplayDuration * TYPING_RATIO) {
        typingDuration = requiredTypingDuration
        displayDuration = baseDisplayDuration - typingDuration
      } else {
        typingDuration = requiredTypingDuration
        const minTotalDuration = typingDuration / TYPING_RATIO
        displayDuration = minTotalDuration - typingDuration
        baseDisplayDuration = minTotalDuration
      }
    } else {
      typingDuration = MAX_TYPING_DURATION
      displayDuration = baseDisplayDuration - typingDuration
      if (displayDuration < 2000) {
        displayDuration = 2000
        baseDisplayDuration = typingDuration + displayDuration
      }
    }

    displayDuration = Math.max(displayDuration, 1000)
    const charInterval = Math.max(30, Math.min(150, typingDuration / charCount))

    return {
      baseDisplayDuration,
      typingDuration,
      displayDuration,
      charInterval
    }
  }

  pushExistingBubbles(allBubbles, newBubbleIndex) {
    allBubbles.forEach((existingBubble, index) => {
      if (index < newBubbleIndex) {
        const pushHeight = (newBubbleIndex - index) * 68
        existingBubble.style.transform = `translateY(-${pushHeight}px)`
        existingBubble.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }
    })
  }

  startTypingEffect(bubble, message, timing) {
    let currentText = ''
    let charIndex = 0
    let isTypingComplete = false
    const typingStartTime = Date.now()

    const typingEffect = setInterval(() => {
      if (charIndex < message.length) {
        currentText += message[charIndex]
        bubble.textContent = currentText
        charIndex++

        if (charIndex < message.length) {
          bubble.textContent = currentText + ''
        }
      } else {
        const actualTypingTime = Date.now() - typingStartTime
        bubble.textContent = currentText
        clearInterval(typingEffect)
        isTypingComplete = true
        bubble.dataset.typingComplete = 'true'

        const displayTimeoutId = setTimeout(() => {
          this.removeBubble(bubble)
        }, timing.displayDuration)

        bubble.dataset.displayTimeoutId = displayTimeoutId

        setTimeout(() => {
          this.isCurrentBubbleTyping = false
          this.currentBubble = null
          this.processBubbleQueue()
        }, 100)
      }
    }, timing.charInterval)

    bubble.dataset.typingEffectId = typingEffect

    const totalTimeout = timing.baseDisplayDuration + 3000
    const totalTimeoutId = setTimeout(() => {
      if (!isTypingComplete && bubble.dataset.typingEffectId) {
        clearInterval(typingEffect)
        bubble.textContent = message
        isTypingComplete = true
        bubble.dataset.typingComplete = 'true'

        const displayTimeoutId = setTimeout(() => {
          this.removeBubble(bubble)
        }, timing.displayDuration)
        bubble.dataset.displayTimeoutId = displayTimeoutId
      } else if (isTypingComplete) {
        if (!bubble.dataset.displayTimeoutId) {
          this.removeBubble(bubble)
        }
      }
    }, totalTimeout)

    bubble.dataset.totalTimeoutId = totalTimeoutId
  }

  setupBubbleInteractions(bubble, message, timing) {
    bubble.style.pointerEvents = 'auto'
    bubble.style.cursor = 'pointer'

    const handleBubbleClick = event => {
      event.stopPropagation()
      event.preventDefault()

      const now = Date.now()
      const timeSinceFirstClick = now - this.bubbleClickState.firstClickTimestamp

      if (timeSinceFirstClick > 500) {
        this.bubbleClickState.firstClickTimestamp = now

        if (this.bubbleClickState.clickTimeout) {
          clearTimeout(this.bubbleClickState.clickTimeout)
        }

        this.bubbleClickState.clickTimeout = setTimeout(() => {
          this.handleSingleClick(bubble, message)
          this.bubbleClickState.firstClickTimestamp = 0
        }, 300)
      } else {
        clearTimeout(this.bubbleClickState.clickTimeout)
        this.bubbleClickState.firstClickTimestamp = 0
        this.handleDoubleClick(bubble, message)
      }
    }

    bubble.addEventListener('click', handleBubbleClick)
    bubble.addEventListener('touchstart', handleBubbleClick, { passive: false })
  }

  handleSingleClick(bubbleElem, message) {
    if (bubbleElem.dataset.permanent === 'true') {
      this.removeBubble(bubbleElem)
      return
    }

    if (!bubbleElem.dataset.typingComplete && bubbleElem.dataset.typingEffectId) {
      clearInterval(bubbleElem.dataset.typingEffectId)
      bubbleElem.textContent = message
      bubbleElem.dataset.typingComplete = 'true'
    }

    if (bubbleElem.dataset.displayTimeoutId) {
      clearTimeout(bubbleElem.dataset.displayTimeoutId)
      bubbleElem.dataset.displayTimeoutId = null
    }

    if (bubbleElem.dataset.totalTimeoutId) {
      clearTimeout(bubbleElem.dataset.totalTimeoutId)
      bubbleElem.dataset.totalTimeoutId = null
    }

    bubbleElem.dataset.permanent = 'true'
    this.bubbleClickState.isPermanent = true

    bubbleElem.style.boxShadow = '3px 1px 5px rgba(0, 0, 0, 0.15), 0 0 0 2px #4CAF50'
    bubbleElem.style.transition = 'box-shadow 0.3s ease'

    setTimeout(() => {
      bubbleElem.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)'
    }, 1000)

    this.eventSystem.emit('bubblePinned', { message })
  }

  handleDoubleClick(bubbleElem, bubbleMessage) {
    if (bubbleElem.dataset.typingEffectId) {
      clearInterval(bubbleElem.dataset.typingEffectId)
    }
    if (bubbleElem.dataset.displayTimeoutId) {
      clearTimeout(bubbleElem.dataset.displayTimeoutId)
    }
    if (bubbleElem.dataset.totalTimeoutId) {
      clearTimeout(bubbleElem.dataset.totalTimeoutId)
    }

    if (!bubbleElem.dataset.typingComplete) {
      bubbleElem.textContent = bubbleMessage
    }

    pendingChatMessage = bubbleMessage

    setTimeout(() => {
      this.removeBubble(bubbleElem)
      this.eventSystem.emit('bubbleToChat', { message: bubbleMessage })
    }, 50)
  }

  removeBubble(bubbleElem, isBeyondLimit = false) {
    if (bubbleElem.dataset.typingEffectId) {
      clearInterval(bubbleElem.dataset.typingEffectId)
    }
    if (bubbleElem.dataset.displayTimeoutId) {
      clearTimeout(bubbleElem.dataset.displayTimeoutId)
    }
    if (bubbleElem.dataset.totalTimeoutId) {
      clearTimeout(bubbleElem.dataset.totalTimeoutId)
    }

    bubbleElem.classList.remove('show')
    bubbleElem.classList.add('hide')

    if (this.bubbleClickState.isPermanent) {
      this.bubbleClickState.isPermanent = false
    }

    setTimeout(() => {
      const bubblesContainer = document.querySelector('#cat-bubbles-container')
      if (bubbleElem.parentNode === bubblesContainer) {
        bubblesContainer.removeChild(bubbleElem)

        const remainingBubbles = Array.from(bubblesContainer.querySelectorAll('.cat-bubble.show'))
        remainingBubbles.forEach((bubble, index) => {
          const targetPosition = index * 68
          bubble.style.transform = `translateY(-${targetPosition}px)`
          bubble.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        })
      }

      this.isCurrentBubbleTyping = false
      this.currentBubble = null
      this.processBubbleQueue()
    }, 300)

    this.eventSystem.emit('bubbleRemoved', { element: bubbleElem })
  }
}

// API服务
class APIService {
  constructor(eventSystem) {
    this.eventSystem = eventSystem
  }

  async callDeepSeekAPI(messages) {
    if (!config.apiKey) {
      throw new Error('请先在设置中配置DeepSeek API密钥')
    }

    const API_URL = 'https://api.deepseek.com/v1/chat/completions'

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages,
          max_tokens: 300,
          temperature: 0.7,
          stream: false
        })
      })

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status}`)
      }

      const data = await response.json()
      this.eventSystem.emit('apiCallSuccess', { messages, response: data })
      return data.choices[0].message.content
    } catch (error) {
      this.eventSystem.emit('apiCallError', { messages, error })
      throw error
    }
  }
}

// 智能语音指令系统
class VoiceCommandSystem {
  constructor(quickAddApi, interactionManager) {
    this.quickAddApi = quickAddApi
    this.interactionManager = interactionManager
    this.commandRegistry = new Map()
    this.triggerWords = ['小猫', '猫猫', '小橘', '猫咪', '喵喵', '猫', '橘猫', '猫猫猫', '猫猫猫猫']
    this.speechRecognition = null
    this.isListening = false
    this.speechTimeout = null
    this.voiceIndicator = null

    this.setupCommandRegistry()
    this.initializeVoiceIndicator()
  }

  // 初始化语音指示器
  initializeVoiceIndicator() {
    this.voiceIndicator = this.interactionManager.catContainer.querySelector('#voice-indicator')
    if (this.voiceIndicator) {
      this.voiceIndicator.id = 'voice-recognition-indicator'
      this.voiceIndicator.style.cssText = `
        position: absolute;
        top: -18px;
        left: 50%;
        transform: translateX(-50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: linear-gradient(135deg, #ff6b6b, #ee5a52);
        box-shadow: 
          0 0 0 2px rgba(255, 107, 107, 0.3),
          0 0 10px 4px rgba(255, 107, 107, 0.2);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 100001;
        pointer-events: none;
      `
    }
  }

  // 初始化语音识别
  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('浏览器不支持语音识别功能')
      window.smartCat.showBubble('抱歉，你的浏览器不支持语音识别功能')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.maxAlternatives = 3

    recognition.onstart = () => {
      this.isListening = true
      if (this.voiceIndicator) {
        this.voiceIndicator.style.opacity = '1'
        this.voiceIndicator.classList.add('active')
      }

      this.speechTimeout = setTimeout(() => {
        if (this.isListening) {
          this.stopSpeechRecognition()
        }
      }, this.config.voiceTimeout || 15000)

      this.interactionManager.eventSystem.emit('speechRecognitionStarted')
    }

    recognition.onresult = event => {
      const results = event.results
      const finalResult = results[results.length - 1]

      if (!finalResult.isFinal) {
        const interimTranscript = Array.from(results)
          .filter(result => !result.isFinal)
          .map(result => result[0].transcript)
          .join('')

        if (interimTranscript) {
          this.interactionManager.eventSystem.emit('speechInterimResult', { transcript: interimTranscript })
        }
        return
      }

      const alternatives =
        finalResult[0] && finalResult[0].transcript
          ? Array.from(finalResult)
              .map(alt => ({
                transcript: alt.transcript,
                confidence: alt.confidence
              }))
              .sort((a, b) => b.confidence - a.confidence)
          : []

      if (alternatives.length > 0) {
        const bestMatch = alternatives[0]
        this.interactionManager.eventSystem.emit('speechFinalResult', {
          transcript: bestMatch.transcript,
          confidence: bestMatch.confidence
        })

        if (finalResult.isFinal) {
          setTimeout(async () => {
            await this.handleVoiceCommand(bestMatch.transcript)
          }, 500)
        }
      }
    }

    recognition.onerror = event => {
      this.isListening = false
      if (this.voiceIndicator) {
        this.voiceIndicator.style.opacity = '0'
        this.voiceIndicator.classList.remove('active')
      }

      clearTimeout(this.speechTimeout)

      const errorMessages = {
        'no-speech': '没有检测到语音',
        'audio-capture': '无法访问麦克风',
        'not-allowed': '麦克风访问被拒绝',
        network: '网络错误',
        aborted: '语音识别被中止'
      }

      const message = errorMessages[event.error] || '语音识别出现错误'
      window.smartCat.showBubble(message)
    }

    recognition.onend = () => {
      this.isListening = false
      if (this.voiceIndicator) {
        this.voiceIndicator.style.opacity = '0'
        this.voiceIndicator.classList.remove('active')
      }
      clearTimeout(this.speechTimeout)
      this.interactionManager.eventSystem.emit('speechRecognitionEnded')
    }

    this.speechRecognition = recognition
    return recognition
  }

  // 切换语音识别
  toggleSpeechRecognition() {
    if (!this.speechRecognition) {
      this.speechRecognition = this.initializeSpeechRecognition()
      if (!this.speechRecognition) return
    }

    if (this.isListening) {
      this.stopSpeechRecognition()
      window.smartCat.showBubble('语音识别已停止')
    } else {
      try {
        this.speechRecognition.start()
      } catch (error) {
        console.error('启动语音识别失败:', error)
        window.smartCat.showBubble('启动语音识别失败，请检查麦克风权限')
      }
    }
  }

  // 停止语音识别
  stopSpeechRecognition() {
    if (this.speechRecognition && this.isListening) {
      try {
        this.speechRecognition.stop()
      } catch (error) {
        console.error('停止语音识别失败:', error)
      }
      this.isListening = false
    }
  }

  // 设置命令注册表
  setupCommandRegistry() {
    // 系统命令
    this.registerCommand(['打开设置', '设置面板', '打开配置', '设置'], this.handleOpenSettings.bind(this))
    this.registerCommand(['打开聊天', '聊天面板', '开始聊天', '聊天'], this.handleOpenChat.bind(this))
    this.registerCommand(['关闭设置', '关闭聊天'], this.handleClosePanels.bind(this))

    // 复习计划（联动）
    this.registerCommand(['复习', '复习笔记', '开始复习'], this.handleStartReview.bind(this))

    // 笔记操作
    this.registerCommand(['新建笔记', '创建笔记'], this.handleCreateNote.bind(this))
    this.registerCommand(['保存笔记', '保存'], this.handleSaveNote.bind(this))

    // 陪伴功能
    this.registerCommand(['陪我聊天', '聊聊天', '说说话'], this.handleCompanionChat.bind(this))
    this.registerCommand(['鼓励我', '加油', '鼓励'], this.handleEncouragement.bind(this))
  }

  // 命令处理器
  async handleOpenSettings(command, config) {
    this.interactionManager.openSettings()
    window.smartCat.showBubble('设置面板已打开了喵～')
  }

  async handleOpenChat(command, config) {
    this.interactionManager.openChat()
    window.smartCat.showBubble('聊天面板已打开，来和我聊天吧～')
  }

  async handleClosePanels(command, config) {
    this.interactionManager.closeSettings()
    this.interactionManager.closeChat()
    window.smartCat.showBubble('已关闭所有面板')
  }

  async handleStartReview(command, config) {
    try {
      if (window.复习计划 && window.复习计划.复习) {
        window.复习计划.复习()
        window.smartCat.showBubble('开始复习笔记啦！加油哦～')
      } else {
        window.smartCat.showBubble('复习计划功能暂不可用')
      }
    } catch (error) {
      window.smartCat.showBubble(error.message)
    }
  }

  async handleCreateNote(command, config) {
    try {
      // 这里可以集成 QuickAdd 的创建笔记功能
      window.smartCat.showBubble('新建笔记功能正在开发中～')
    } catch (error) {
      window.smartCat.showBubble('创建笔记失败：' + error.message)
    }
  }

  async handleSaveNote(command, config) {
    try {
      // 保存当前笔记的逻辑
      window.smartCat.showBubble('笔记已保存！继续加油写吧～')
    } catch (error) {
      window.smartCat.showBubble('保存失败：' + error.message)
    }
  }

  async handleCompanionChat(command, config) {
    const messages = [
      {
        role: 'system',
        content: '你是一只可爱的陪伴猫咪，用温暖友好的语气和用户聊天，给予陪伴和鼓励。'
      },
      {
        role: 'user',
        content: '陪我聊聊天吧，给我一些温暖的陪伴话语。'
      }
    ]

    try {
      const response = await window.smartCat.callDeepSeekAPI(messages, config)
      if (response) {
        window.smartCat.showBubble(response)
      }
    } catch (error) {
      window.smartCat.showBubble('喵～我现在有点忙，稍后再陪你聊天哦～')
    }
  }

  async handleEncouragement(command, config) {
    const encouragements = ['加油！你是最棒的！💪', '继续努力，你一定可以的！✨', '不要放弃，成功就在眼前！🌟', '你已经做得很好了，继续保持！😊', '相信自己，你比想象中更强大！🚀']
    const randomMsg = encouragements[Math.floor(Math.random() * encouragements.length)]
    window.smartCat.showBubble(randomMsg)
  }

  // 注册命令
  registerCommand(keywords, handler, priority = 0) {
    const command = {
      keywords: Array.isArray(keywords) ? keywords : [keywords],
      handler,
      priority,
      usage: 0
    }

    keywords.forEach(keyword => {
      this.commandRegistry.set(keyword.toLowerCase(), command)
    })
  }

  // 检测是否为指令触发词
  isCommandTriggered(transcript) {
    const lowerTranscript = transcript.toLowerCase()
    return this.triggerWords.some(word => lowerTranscript.startsWith(word.toLowerCase()) || lowerTranscript.includes(` ${word.toLowerCase()} `) || lowerTranscript.startsWith(`${word.toLowerCase()}，`) || lowerTranscript.startsWith(`${word.toLowerCase()} `))
  }

  // 提取指令内容（去除触发词）
  extractCommandContent(transcript) {
    let content = transcript

    for (const word of this.triggerWords) {
      const lowerWord = word.toLowerCase()
      const lowerTranscript = transcript.toLowerCase()

      if (lowerTranscript.startsWith(lowerWord)) {
        content = transcript.slice(word.length).trim()
        content = content.replace(/^[，。！？\s]+/, '')
        break
      }

      const pattern = new RegExp(`(.+?)${lowerWord}(.+)`, 'i')
      const match = transcript.match(pattern)
      if (match) {
        content = match[2].trim()
        break
      }
    }

    return content
  }

  // 主语音命令处理函数
  async handleVoiceCommand(transcript) {
    const originalCommand = transcript.trim()
    window.smartCat.showBubble(`你说: "${originalCommand}"`)

    if (this.isCommandTriggered(originalCommand)) {
      const commandContent = this.extractCommandContent(originalCommand)

      if (!commandContent) {
        window.smartCat.showBubble('我在听呢，请告诉我你要做什么～')
        return
      }

      // 精确匹配
      const exactMatch = this.commandRegistry.get(commandContent.toLowerCase())
      if (exactMatch) {
        exactMatch.usage++
        return await exactMatch.handler(commandContent, this.config)
      }

      // 模糊匹配
      const fuzzyMatch = this.fuzzyMatchCommand(commandContent)
      if (fuzzyMatch && fuzzyMatch.confidence > 0.7) {
        fuzzyMatch.command.usage++
        return await fuzzyMatch.command.handler(commandContent, this.config)
      }

      // AI 指令识别
      return await this.handleAICommandRecognition(commandContent)
    } else {
      // 普通聊天处理
      return await this.handleCasualChat(originalCommand)
    }
  }

  // 模糊匹配
  fuzzyMatchCommand(command) {
    let bestMatch = null
    let bestScore = 0

    for (const [keyword, cmd] of this.commandRegistry) {
      const score = this.calculateSimilarity(command, keyword)
      if (score > bestScore) {
        bestScore = score
        bestMatch = { command: cmd, confidence: score }
      }
    }

    if (bestScore < 0.7) {
      for (const [keyword, cmd] of this.commandRegistry) {
        if (command.includes(keyword) || keyword.includes(command)) {
          const score = Math.max(0.7, bestScore)
          if (score > bestScore) {
            bestScore = score
            bestMatch = { command: cmd, confidence: score }
          }
        }
      }
    }

    return bestMatch
  }

  // 计算相似度
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length)
  }

  // 编辑距离算法
  editDistance(s1, s2) {
    s1 = s1.toLowerCase()
    s2 = s2.toLowerCase()

    const costs = []
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j
        } else {
          if (j > 0) {
            let newValue = costs[j - 1]
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
            }
            costs[j - 1] = lastValue
            lastValue = newValue
          }
        }
      }
      if (i > 0) costs[s2.length] = lastValue
    }
    return costs[s2.length]
  }

  // 普通聊天处理
  async handleCasualChat(message) {
    try {
      let prompt
      if (window.smartCat && window.smartCat.promptGenerator) {
        prompt = window.smartCat.app.promptGenerator.generatePrompt('casual_chat', message)
      } else {
        const personality = this.config.personality === 'custom' ? this.config.customPersonality : this.interactionManager.getPersonalityPrompt(this.config.personality)
        prompt = `${personality}\n\n用户正在和你进行日常聊天，请用友好可爱的语气回复，保持简短自然。`
      }

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `用户说："${message}"。请用简短的一句话回复。`
        }
      ]

      const response = await window.smartCat.callDeepSeekAPI(messages, config)
      if (response) {
        window.smartCat.showBubble(response)
      }
    } catch (error) {
      console.error('聊天回复失败:', error)
      window.smartCat.showBubble('喵～我刚才走神了，可以再说一次吗？')
    }
  }

  // AI 指令识别
  async handleAICommandRecognition(command) {
    try {
      const availableCommands = Array.from(this.commandRegistry.values())
        .filter((cmd, index, array) => array.indexOf(cmd) === index)
        .map(cmd => ({
          name: cmd.keywords[0],
          description: `处理${cmd.keywords.join('、')}相关功能`,
          usage: cmd.usage
        }))

      const messages = [
        {
          role: 'system',
          content: `你是一个智能语音助手，需要识别用户指令并执行相应操作。
用户会以"小猫"、"猫猫"等词语开头发出指令。

可用指令列表：
${availableCommands.map(cmd => `- ${cmd.name}: ${cmd.description}`).join('\n')}

请分析用户指令并选择最合适的操作，用JSON格式回复：
{
    "intent": "指令名称",
    "confidence": "置信度0-1",
    "action": "执行的操作描述",
    "response": "给用户的回复"
}`
        },
        {
          role: 'user',
          content: `用户指令："${command}"。请分析意图。`
        }
      ]

      const response = await window.smartCat.callDeepSeekAPI(messages)

      try {
        const aiResponse = JSON.parse(response)

        if (aiResponse.confidence > 0.6) {
          const matchedCommand = Array.from(this.commandRegistry.values()).find(cmd => cmd.keywords.includes(aiResponse.intent))

          if (matchedCommand) {
            matchedCommand.usage++
            setTimeout(() => matchedCommand.handler(command), 1000)
            return
          }
        }

        window.smartCat.showBubble('我好像不太明白这个指令呢，试试其他命令吧～')
      } catch (parseError) {
        window.smartCat.showBubble(response)
      }
    } catch (error) {
      console.error('AI指令识别失败:', error)
      window.smartCat.showBubble(error.message)
    }
  }

  // 获取系统状态
  getStatus() {
    return {
      isListening: this.isListening,
      commandCount: this.commandRegistry.size,
      triggerWords: this.triggerWords
    }
  }

  // 销毁资源
  destroy() {
    this.stopSpeechRecognition()
    this.speechRecognition = null
    this.commandRegistry.clear()
  }
}

// 内容监控器
class ContentMonitor {
  constructor(eventSystem) {
    this.eventSystem = eventSystem
    this.recentMonologues = []
    this.reviewedBooks = new Set()
    this.generateBookReviewLock = false

    this.setupContentMonitoring()
  }

  setupContentMonitoring() {
    const fileOpenEventRef = this.setupNoteSwitchDetection()
    this.eventSystem.emit('contentMonitoringStarted')
    return fileOpenEventRef
  }

  setupNoteSwitchDetection() {
    const fileOpenEventRef = app.workspace.on('file-open', file => {
      if (file) {
        this.eventSystem.emit('fileOpened', { file })
        this.generateBookReview()
      }
    })
    return fileOpenEventRef
  }

  async generateBookReview() {
    if (this.generateBookReviewLock) return

    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view || !activeLeaf.view.file) return

      const filePath = activeLeaf.view.file.path

      if (this.reviewedBooks.has(filePath)) {
        return
      }

      const bookDescription = this.generateBookDescription()
      if (!bookDescription) return

      let prompt
      if (window.smartCat && window.smartCat.promptGenerator) {
        prompt = window.smartCat.app.promptGenerator.generatePrompt('book_review', `请基于以下书籍数据给出简短评价：${bookDescription}`)
      } else {
        const personality = config.personality === 'custom' ? config.customPersonality : this.getPersonalityPrompt(config.personality)
        prompt = `${personality}\n\n请基于以下书籍数据：\n\n${bookDescription}\n\n请用简短的一句话给出评价或建议。`
      }

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: '请用简短的一句话给出评价或建议。'
        }
      ]

      this.generateBookReviewLock = true
      this.eventSystem.emit('bookReviewGenerationStarted', { bookDescription })

      startThinking()
      const response = await window.smartCat.callDeepSeekAPI(messages, config)
      stopThinking()

      if (response) {
        this.reviewedBooks.add(filePath)
        window.smartCat.showBubble(response, '🎓')
        this.eventSystem.emit('bookReviewGenerated', { bookDescription, review: response })
      }

      this.generateBookReviewLock = false
    } catch (error) {
      this.generateBookReviewLock = false
      stopAllThinking()
      console.error(error)
      this.eventSystem.emit('bookReviewGenerationError', { error })
    }
  }

  generateBookDescription() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view) return null

      const view = activeLeaf.view
      let frontmatter = {}

      if (view.file) {
        const fileCache = app.metadataCache.getFileCache(view.file)
        if (fileCache && fileCache.frontmatter) {
          frontmatter = fileCache.frontmatter
        }
      }

      const descriptionParts = []

      if (frontmatter.title) {
        descriptionParts.push(`书名：《${frontmatter.title}》`)
      }

      if (frontmatter.author) {
        descriptionParts.push(`作者：${frontmatter.author}`)
      }

      if (frontmatter.translator) {
        descriptionParts.push(`译者：${frontmatter.translator}`)
      }

      if (frontmatter.publisher) {
        descriptionParts.push(`出版社：${frontmatter.publisher}`)
      }

      if (frontmatter.publicationYear) {
        descriptionParts.push(`出版年份：${frontmatter.publicationYear}`)
      }

      if (frontmatter.category) {
        descriptionParts.push(`分类：${frontmatter.category}`)
      }

      if (frontmatter.readingProgress) {
        descriptionParts.push(`阅读进度：${frontmatter.readingProgress}%`)
      }

      if (frontmatter.readingTimeFormat) {
        descriptionParts.push(`阅读时长：${frontmatter.readingTimeFormat}`)
      }

      if (frontmatter.highlights) {
        descriptionParts.push(`高亮数量：${frontmatter.highlights}个`)
      }

      if (frontmatter.thinks) {
        descriptionParts.push(`想法数量：${frontmatter.thinks}个`)
      }

      if (frontmatter.ISBN) {
        descriptionParts.push(`ISBN：${frontmatter.ISBN}`)
      }

      return descriptionParts.join('，')
    } catch (error) {
      this.eventSystem.emit('bookDescriptionError', { error })
      return null
    }
  }

  getCursorContext() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
        const editor = activeLeaf.view.editor
        const content = editor.getValue()
        const cursor = editor.getCursor()
        const lines = content.split('\n')

        const currentLine = lines[cursor.line]

        if (config.contextLength === 0) {
          return currentLine
        }

        let context = currentLine + '\n'
        let totalLength = currentLine.length

        const upLimit = Math.floor(config.contextLength * config.contextSplitRatio)
        const downLimit = config.contextLength - upLimit

        let upLength = 0
        let upIndex = cursor.line - 1
        while (upIndex >= 0 && upLength < upLimit) {
          const line = lines[upIndex]
          if (upLength + line.length <= upLimit) {
            context = line + '\n' + context
            upLength += line.length
            totalLength += line.length
          } else {
            const remaining = upLimit - upLength
            context = line.substring(0, remaining) + '\n' + context
            upLength = upLimit
            totalLength += remaining
          }
          upIndex--
        }

        let downLength = 0
        let downIndex = cursor.line + 1
        while (downIndex < lines.length && downLength < downLimit && totalLength < config.contextLength) {
          const line = lines[downIndex]
          const availableSpace = Math.min(downLimit - downLength, config.contextLength - totalLength)

          if (line.length <= availableSpace) {
            context += line + '\n'
            downLength += line.length
            totalLength += line.length
          } else {
            context += line.substring(0, availableSpace) + '\n'
            downLength = downLimit
            totalLength = config.contextLength
          }
          downIndex++
        }

        return context.length > 0 ? context.substring(0, config.contextLength) : null
      }
    } catch (error) {
      this.eventSystem.emit('cursorContextError', { error })
    }
    return null
  }

  getViewportContent() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
        const editor = activeLeaf.view.editor
        const content = editor.getValue()
        return content.substring(0, 500)
      }
    } catch (error) {
      this.eventSystem.emit('viewportContentError', { error })
    }
    return null
  }

  getCurrentNoteContext() {
    try {
      let content = ''
      let cursorLine = -1
      let fileName = '当前笔记'

      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (activeLeaf && activeLeaf.view) {
        const view = activeLeaf.view

        if (view.editor) {
          const editor = view.editor
          content = editor.getValue()

          const cursor = editor.getCursor()
          cursorLine = cursor.line

          if (view.file) {
            fileName = view.file.basename || '未命名文件'
          }
        }
      }

      return {
        content: content,
        cursorLine: cursorLine,
        fileName: fileName
      }
    } catch (error) {
      this.eventSystem.emit('noteContextError', { error })
      return {
        content: '',
        cursorLine: -1,
        fileName: '未知文件'
      }
    }
  }

  getPersonalityPrompt(personality) {
    const personalities = {
      lively: '你是一只活泼可爱的小橘，热情友好，喜欢互动，用简短活泼的语气说话，偶尔加一些猫咪表情。回答要非常简短，不超过60字。',
      quiet: '你是一只安静温柔的小橘，说话温和简洁，不会过多打扰用户，用平静的语气表达关心。回答要非常简短，不超过40字。',
      wise: '你是一只聪明智慧的小橘，善于思考和分析，能给出有见地的评论，用理性的语气说话。回答要简短有深度，不超过80字。',
      cute: '你是一只超级可爱的小橘，喜欢卖萌，用撒娇的语气说话，经常使用猫咪表情和可爱的词汇。回答要非常简短可爱，不超过50字。',
      mentor: '你是一只经验丰富的导师小橘，能够指导用户写作和思考，用专业但友好的语气给出建议。回答要简短实用，不超过70字。'
    }
    return personalities[personality] || personalities.lively
  }

  getRecentMonologues() {
    return this.recentMonologues
  }
}

// 交互管理器
class InteractionManager {
  constructor(catContainer, settingsPanel, chatPanel, eventSystem, quickAddApi) {
    this.catContainer = catContainer
    this.settingsPanel = settingsPanel
    this.chatPanel = chatPanel
    this.eventSystem = eventSystem
    this.quickAddApi = quickAddApi

    this.isDragging = false
    this.startX = 0
    this.startY = 0
    this.initialLeft = 0
    this.initialTop = 0
    this.longPressTimer = null
    this.companionInterval = null
    this.isSettingsOpen = false
    this.isChatOpen = false
    this.tapCount = 0
    this.tapTimer = null
    this.tapStartX = 0
    this.tapStartY = 0
    this.tapThreshold = 5
    this.speechRecognition = null
    this.isListening = false
    this.speechTimeout = null
    this.generateAutoCompanionMessageLock = false

    this.boundHandleMouseDown = this.handleMouseDown.bind(this)
    this.boundHandleMouseMove = this.handleMouseMove.bind(this)
    this.boundHandleMouseUp = this.handleMouseUp.bind(this)
    this.boundHandleTouchStart = this.handleTouchStart.bind(this)
    this.boundHandleTouchMove = this.handleTouchMove.bind(this)
    this.boundHandleTouchEnd = this.handleTouchEnd.bind(this)
  }

  setupInteractions(config) {
    this.config = config
    this.setupSliderEvents()
    this.setupMovement()
    this.setupEventListeners()
    this.applyConfigToUI()
    this.startCompanionMode()
    this.eventSystem.emit('interactionsInitialized')
  }

  setupSliderEvents() {
    const contextLengthSlider = this.settingsPanel.querySelector('#context-length')
    const contextRatioSlider = this.settingsPanel.querySelector('#context-ratio')
    contextLengthSlider.addEventListener('input', this.updateContextLengthValue.bind(this))
    contextRatioSlider.addEventListener('input', this.updateContextRatioValue.bind(this))

    const intervalSlider = this.settingsPanel.querySelector('#speak-interval')
    const probabilitySlider = this.settingsPanel.querySelector('#speak-probability')
    const shortTermMemorySlider = this.settingsPanel.querySelector('#short-term-memory')
    intervalSlider.addEventListener('input', this.updateIntervalValue.bind(this))
    probabilitySlider.addEventListener('input', this.updateProbabilityValue.bind(this))
    shortTermMemorySlider.addEventListener('input', this.updateShortTermMemoryValue.bind(this))
  }

  updateShortTermMemoryValue() {
    const slider = this.settingsPanel.querySelector('#short-term-memory')
    const valueSpan = this.settingsPanel.querySelector('#short-term-memory-value')
    const value = parseInt(slider.value)
    valueSpan.textContent = `${value}轮对话`
    this.eventSystem.emit('shortTermMemoryUpdated', { value })
  }

  updateContextLengthValue() {
    const slider = this.settingsPanel.querySelector('#context-length')
    const valueSpan = this.settingsPanel.querySelector('#context-length-value')
    const value = parseInt(slider.value)

    if (value === 0) {
      valueSpan.textContent = '0字（仅当前行）'
    } else {
      const up = Math.floor(value * this.config.contextSplitRatio)
      const down = value - up
      valueSpan.textContent = `${value}字（上${up}字/下${down}字）`
    }
    this.eventSystem.emit('contextLengthUpdated', { value })
  }

  updateContextRatioValue() {
    const slider = this.settingsPanel.querySelector('#context-ratio')
    const valueSpan = this.settingsPanel.querySelector('#context-ratio-value')
    const ratio = parseFloat(slider.value)
    const upPercent = Math.round(ratio * 100)
    const downPercent = 100 - upPercent

    valueSpan.textContent = `${upPercent}%向上 / ${downPercent}%向下`
    this.eventSystem.emit('contextRatioUpdated', { ratio, upPercent, downPercent })
  }

  updateIntervalValue() {
    const slider = this.settingsPanel.querySelector('#speak-interval')
    const valueSpan = this.settingsPanel.querySelector('#interval-value')
    valueSpan.textContent = `${slider.value}分钟`
    this.eventSystem.emit('speakIntervalUpdated', { value: slider.value })
  }

  updateProbabilityValue() {
    const slider = this.settingsPanel.querySelector('#speak-probability')
    const valueSpan = this.settingsPanel.querySelector('#probability-value')
    valueSpan.textContent = `${Math.round(slider.value * 100)}%`
    this.eventSystem.emit('speakProbabilityUpdated', { value: slider.value })
  }

  setupMovement() {
    this.catContainer.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false })
    this.catContainer.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false })
    this.catContainer.addEventListener('touchend', this.boundHandleTouchEnd)
    this.catContainer.addEventListener('mousedown', this.boundHandleMouseDown)
  }

  handleTouchStart(e) {
    if (this.isSettingsOpen || this.isChatOpen) return

    e.preventDefault()
    const touch = e.touches[0]

    this.tapStartX = touch.clientX
    this.tapStartY = touch.clientY
    this.startX = touch.clientX
    this.startY = touch.clientY

    const computedStyle = window.getComputedStyle(this.catContainer)
    this.initialLeft = parseFloat(computedStyle.left) || (window.innerWidth - this.catContainer.offsetWidth) / 2
    this.initialTop = parseFloat(computedStyle.top) || window.innerHeight - this.catContainer.offsetHeight

    this.catContainer.style.transition = 'none'
    this.startLongPressTimer()
    this.eventSystem.emit('touchStarted', { x: this.startX, y: this.startY })
  }

  handleTouchMove(e) {
    if (this.isSettingsOpen || this.isChatOpen) return
    e.preventDefault()
    this.clearLongPressTimer()

    const touch = e.touches[0]
    const deltaX = touch.clientX - this.startX
    const deltaY = touch.clientY - this.startY

    const newLeft = this.initialLeft + deltaX
    const newTop = this.initialTop + deltaY

    const maxX = window.innerWidth - this.catContainer.offsetWidth
    const maxY = window.innerHeight - 10

    this.catContainer.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px'
    this.catContainer.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'

    this.isDragging = true
    this.eventSystem.emit('catDragged', { x: newLeft, y: newTop })
  }

  handleTouchEnd(e) {
    const touch = e.changedTouches[0]
    const endX = touch.clientX
    const endY = touch.clientY

    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2))

    if (moveDistance < this.tapThreshold && !this.isDragging) {
      this.handleTap()
    }

    this.isDragging = false
    this.catContainer.style.transition = 'all 0.3s ease'

    const rect = this.catContainer.getBoundingClientRect()
    const windowHeight = window.innerHeight

    if (rect.bottom > windowHeight - 5) {
      const newTop = windowHeight - rect.height + 10
      this.catContainer.style.top = newTop + 'px'
    }

    if (rect.top < 10) {
      this.catContainer.style.top = '10px'
    }

    this.clearLongPressTimer()
    this.eventSystem.emit('touchEnded', { x: endX, y: endY })
  }

  handleMouseDown(e) {
    if (this.isSettingsOpen || this.isChatOpen) return

    this.tapStartX = e.clientX
    this.tapStartY = e.clientY
    this.startX = e.clientX
    this.startY = e.clientY

    const computedStyle = window.getComputedStyle(this.catContainer)
    this.initialLeft = parseFloat(computedStyle.left) || (window.innerWidth - this.catContainer.offsetWidth) / 2
    this.initialTop = parseFloat(computedStyle.top) || window.innerHeight - this.catContainer.offsetHeight

    this.catContainer.style.transition = 'none'
    this.startLongPressTimer()

    document.addEventListener('mousemove', this.boundHandleMouseMove)
    document.addEventListener('mouseup', this.boundHandleMouseUp)
    this.eventSystem.emit('mouseDown', { x: this.startX, y: this.startY })
  }

  handleMouseMove(e) {
    if (this.isSettingsOpen || this.isChatOpen) return
    this.clearLongPressTimer()

    const deltaX = e.clientX - this.startX
    const deltaY = e.clientY - this.startY

    const newLeft = this.initialLeft + deltaX
    const newTop = this.initialTop + deltaY

    const maxX = window.innerWidth - this.catContainer.offsetWidth
    const maxY = window.innerHeight - 10

    this.catContainer.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px'
    this.catContainer.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px'

    this.isDragging = true
    this.eventSystem.emit('catDragged', { x: newLeft, y: newTop })
  }

  handleMouseUp(e) {
    const endX = e.clientX
    const endY = e.clientY

    const moveDistance = Math.sqrt(Math.pow(endX - this.tapStartX, 2) + Math.pow(endY - this.tapStartY, 2))

    if (moveDistance < this.tapThreshold && !this.isDragging) {
      this.handleTap()
    }

    this.isDragging = false
    this.catContainer.style.transition = 'all 0.3s ease'
    document.removeEventListener('mousemove', this.boundHandleMouseMove)
    document.removeEventListener('mouseup', this.boundHandleMouseUp)
    this.clearLongPressTimer()
    this.eventSystem.emit('mouseUp', { x: endX, y: endY })
  }

  handleTap() {
    this.tapCount++

    if (this.tapCount === 1) {
      clearTimeout(this.tapTimer)
      this.tapTimer = setTimeout(() => {
        if (this.hasBookTag()) {
          this.generateAutoCompanionMessage()
        } else {
          this.showPetMessage()
        }
        this.resetTapState()
      }, 300)
    } else if (this.tapCount === 2) {
      clearTimeout(this.tapTimer)
      this.clearLongPressTimer()
      this.tapTimer = setTimeout(() => {
        this.openChat()
        this.resetTapState()
      }, 300)
    } else if (this.tapCount === 3) {
      clearTimeout(this.tapTimer)
      this.clearLongPressTimer()
      this.tapTimer = setTimeout(() => {
        if (this.isDesktop()) {
          window.smartCat.showBubble('语音识别在桌面端会闪退，暂不支持哦～')
        } else {
          try {
            window.smartCat.app.voiceCommandSystem.toggleSpeechRecognition()
          } catch (error) {
            window.smartCat.showBubble(error.message)
          }
        }
        this.resetTapState()
      }, 300)
    } else if (this.tapCount === 4) {
      clearTimeout(this.tapTimer)
      this.clearLongPressTimer()
      this.tapTimer = setTimeout(() => {
        this.resetTapState()
      }, 300)
    } else if (this.tapCount === 5) {
      clearTimeout(this.tapTimer)
      this.clearLongPressTimer()
      this.tapTimer = setTimeout(() => {
        this.openSettings()
        this.resetTapState()
      }, 300)
    }

    this.eventSystem.emit('catTapped', { count: this.tapCount })
  }

  resetTapState() {
    this.tapCount = 0
    if (this.tapTimer) {
      clearTimeout(this.tapTimer)
      this.tapTimer = null
    }
    this.clearLongPressTimer()
  }

  startLongPressTimer() {
    this.longPressTimer = setTimeout(() => {
      this.openSettings()
      this.tapCount = -1
      if (this.tapTimer) {
        clearTimeout(this.tapTimer)
        this.tapTimer = null
      }
      this.eventSystem.emit('longPressDetected')
    }, 800)
  }

  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  setupEventListeners() {
    const saveSettingsBtn = this.settingsPanel.querySelector('#save-settings')
    saveSettingsBtn.addEventListener('click', this.saveSettings.bind(this))

    const sendButton = this.chatPanel.querySelector('#send-button')
    const chatInput = this.chatPanel.querySelector('#chat-input')
    sendButton.addEventListener('click', this.sendMessage.bind(this))
    chatInput.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.sendMessage()
      }
    })

    const appearanceOptions = this.settingsPanel.querySelectorAll('.appearance-option')
    appearanceOptions.forEach(option => {
      option.addEventListener('click', () => {
        appearanceOptions.forEach(opt => opt.classList.remove('selected'))
        option.classList.add('selected')
        this.eventSystem.emit('appearanceSelected', { appearance: option.dataset.appearance })
      })
    })

    const personalityOptions = this.settingsPanel.querySelectorAll('.personality-option')
    personalityOptions.forEach(option => {
      option.addEventListener('click', () => {
        personalityOptions.forEach(opt => opt.classList.remove('selected'))
        option.classList.add('selected')
        this.eventSystem.emit('personalitySelected', { personality: option.dataset.personality })
      })
    })
  }

  async sendMessage() {
    const chatInput = this.chatPanel.querySelector('#chat-input')
    const chatMessages = this.chatPanel.querySelector('#chat-messages')
    const message = chatInput.value.trim()

    if (!message) return

    const userMessage = document.createElement('div')
    userMessage.className = 'message user-message'
    userMessage.textContent = message
    chatMessages.appendChild(userMessage)

    chatInput.value = ''
    chatMessages.scrollTop = chatMessages.scrollHeight

    const typingIndicator = document.createElement('div')
    typingIndicator.className = 'message cat-message'
    typingIndicator.textContent = '小橘正在思考...'
    typingIndicator.id = 'typing-indicator'
    chatMessages.appendChild(typingIndicator)
    chatMessages.scrollTop = chatMessages.scrollHeight

    try {
      const messages = await this.prepareChatMessages(message)
      const response = await window.smartCat.callDeepSeekAPI(messages, this.config)

      const indicator = chatMessages.querySelector('#typing-indicator')
      if (indicator) {
        indicator.remove()
      }

      const catMessage = document.createElement('div')
      catMessage.className = 'message cat-message'
      catMessage.id = 'cat-reply-' + Date.now()
      chatMessages.appendChild(catMessage)

      await this.typewriterEffect(catMessage, response, 30)

      chatMessages.scrollTop = chatMessages.scrollHeight

      this.config.conversationHistory = this.config.conversationHistory || []

      this.config.conversationHistory.push({
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      })

      this.config.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      })

      saveConfig(this.config)
      this.eventSystem.emit('messageSent', { message, response })
    } catch (error) {
      const indicator = chatMessages.querySelector('#typing-indicator')
      if (indicator) {
        indicator.remove()
      }

      const errorMessage = document.createElement('div')
      errorMessage.className = 'message cat-message'
      errorMessage.id = 'cat-error-' + Date.now()
      chatMessages.appendChild(errorMessage)

      const errorText = '抱歉，我现在无法回复。请检查API密钥设置或网络连接。'
      await this.typewriterEffect(errorMessage, errorText, 30)

      chatMessages.scrollTop = chatMessages.scrollHeight
      this.eventSystem.emit('messageError', { error, message })
    }
  }

  async typewriterEffect(element, text, speed = 30) {
    return new Promise(resolve => {
      let index = 0
      element.textContent = ''

      const timer = setInterval(() => {
        if (index < text.length) {
          element.textContent += text[index]
          index++

          const chatMessages = this.chatPanel.querySelector('#chat-messages')
          chatMessages.scrollTop = chatMessages.scrollHeight
        } else {
          clearInterval(timer)
          resolve()
        }
      }, speed)
    })
  }

  async prepareChatMessages(userMessage) {
    const messages = []

    const prompt = window.smartCat.app.promptGenerator.generatePrompt('talk', userMessage)
    messages.push({ role: 'system', content: prompt })

    if (this.config.conversationHistory && this.config.conversationHistory.length > 0) {
      const maxHistoryMessages = Math.min(this.config.shortTermMemory * 2, this.config.conversationHistory.length)
      const recentHistory = this.config.conversationHistory.slice(-maxHistoryMessages)

      recentHistory.forEach(chat => {
        messages.push({
          role: chat.role,
          content: chat.content
        })
      })
    }

    let contextMessage = '当前对话上下文：\n'

    if (this.config.currentChatContext) {
      const { noteContext, recentMonologues, bookInfo } = this.config.currentChatContext

      if (bookInfo) {
        contextMessage += `- 当前书籍信息：${bookInfo}\n`
      }

      if (noteContext && noteContext.fileName) {
        contextMessage += `- 当前笔记：${noteContext.fileName}\n`
        let contentContext
        if (this.hasBookTag()) {
          contentContext = this.getVisibleContent()
        } else {
          contentContext = window.smartCat.app.contentMonitor.getCursorContext(this.config)
        }

        if (!contentContext) {
          contentContext = window.smartCat.app.contentMonitor.getViewportContent()
        }

        if (contentContext) {
          contextMessage += `- 当前内容：${contentContext}\n`
        }
      }

      if (recentMonologues && recentMonologues.length > 0) {
        contextMessage += '- 最近活动：\n'
        recentMonologues.slice(-3).forEach(monologue => {
          contextMessage += `  * ${monologue.message}\n`
        })
      }
    }

    const finalUserMessage = contextMessage + `\n用户最新消息：${userMessage}`
    messages.push({ role: 'user', content: finalUserMessage })

    return messages
  }

  applyConfigToUI() {
    this.settingsPanel.querySelector('#speak-interval').value = this.config.speakInterval
    this.settingsPanel.querySelector('#speak-probability').value = this.config.speakProbability
    this.settingsPanel.querySelector('#api-key').value = this.config.apiKey || ''

    this.settingsPanel.querySelector('#context-length').value = this.config.contextLength || 500
    this.settingsPanel.querySelector('#context-ratio').value = this.config.contextSplitRatio || 0.5
    this.settingsPanel.querySelector('#short-term-memory').value = this.config.shortTermMemory || 200

    this.updateShortTermMemoryValue()
    this.updateContextLengthValue()
    this.updateContextRatioValue()
    this.updateIntervalValue()
    this.updateProbabilityValue()
  }

  saveSettings() {
    const selectedAppearance = this.settingsPanel.querySelector('.appearance-option.selected')
    const newAppearance = selectedAppearance ? selectedAppearance.dataset.appearance : this.config.appearance

    const selectedPersonality = this.settingsPanel.querySelector('.personality-option.selected')
    const newPersonality = selectedPersonality ? selectedPersonality.dataset.personality : this.config.personality

    const newConfig = {
      ...this.config,
      appearance: newAppearance,
      personality: newPersonality,
      speakInterval: parseInt(this.settingsPanel.querySelector('#speak-interval').value),
      speakProbability: parseFloat(this.settingsPanel.querySelector('#speak-probability').value),
      apiKey: this.settingsPanel.querySelector('#api-key').value,
      contextLength: parseInt(this.settingsPanel.querySelector('#context-length').value),
      contextSplitRatio: parseFloat(this.settingsPanel.querySelector('#context-ratio').value),
      shortTermMemory: parseInt(this.settingsPanel.querySelector('#short-term-memory').value)
    }

    saveConfig(newConfig)
    window.smartCat.showBubble(getSmartCatMessage('SETUP_MESSAGES'))
    Object.assign(this.config, newConfig)
    applyAppearance(this.config)
    this.restartCompanionInterval()
    this.closeSettings()
    this.eventSystem.emit('settingsSaved', { config: newConfig })
  }

  startCompanionMode() {
    this.companionInterval = setInterval(() => {
      if (isPageVisible && Math.random() < this.config.speakProbability) {
        this.generateAutoCompanionMessage()
      }
    }, this.config.speakInterval * 60 * 1000)

    setTimeout(() => {
      if (this.config.apiKey) {
        window.smartCat.showBubble(getSmartCatMessage('CONNECTED_MESSAGES'), window.smartCat.app.moodSystem.getCurrentMoodEmoji())
      } else {
        window.smartCat.showBubble(getSmartCatMessage('SETUP_MESSAGES'))
      }
    }, 1000)

    this.eventSystem.emit('companionModeStarted')
  }

  restartCompanionInterval() {
    if (this.companionInterval) {
      clearInterval(this.companionInterval)
    }

    this.companionInterval = setInterval(() => {
      if (Math.random() < this.config.speakProbability) {
        this.generateAutoCompanionMessage()
      }
    }, this.config.speakInterval * 60 * 1000)
  }

  hasBookTag() {
    const currentFile = app.workspace.getActiveFile()
    if (!currentFile) return false

    const fileCache = app.metadataCache.getFileCache(currentFile)
    if (!fileCache) return false

    const allTags = fileCache.tags || []
    const frontmatterTags = fileCache.frontmatter?.tags || []

    const combinedTags = [...allTags.map(t => t.tag), ...(Array.isArray(frontmatterTags) ? frontmatterTags : [frontmatterTags])]

    return combinedTags.some(tag => tag && typeof tag === 'string' && tag.toLowerCase().includes('book'))
  }

  showPetMessage() {
    const mood = window.smartCat.mood
    let message

    if (Math.random() < 0.5) {
      message = getSmartCatMessage('PET_MESSAGES')
    } else if (mood) {
      const overall = mood.getMood().overall
      message = window.smartCat.getPetMessage(overall)
    } else {
      message = getSmartCatMessage('PET_MESSAGES')
    }

    window.smartCat.showBubble(message, window.smartCat.app.moodSystem.getCurrentMoodEmoji())

    const catBody = this.catContainer.querySelector('#cat-body')

    const animations = ['scale(1.15)', 'scale(1.1) rotate(5deg)', 'scale(1.12) rotate(-3deg)', 'scale(1.08)', 'scale(1.2)']
    const randomAnim = animations[Math.floor(Math.random() * animations.length)]
    catBody.style.transform = randomAnim
    catBody.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

    setTimeout(() => {
      catBody.style.transform = 'scale(1) rotate(0deg)'
    }, 300)

    if (Math.random() < 0.5) {
      catBody.style.animation = 'heartbeat 0.5s ease-in-out'
      setTimeout(() => {
        catBody.style.animation = ''
      }, 500)
    }

    this.eventSystem.emit('petInteraction')
  }

  openChat() {
    this.isChatOpen = true
    this.isSettingsOpen = false

    const panelMask = document.getElementById('panel-mask')
    if (panelMask) {
      panelMask.style.display = 'block'
    }

    this.chatPanel.style.display = 'flex'
    this.settingsPanel.style.display = 'none'

    this.prepareChatContext()

    if (this.hasBookTag()) {
      this.prepareBookChatContext()
    }

    const chatMessages = this.chatPanel.querySelector('#chat-messages')
    chatMessages.innerHTML = '<div class="message cat-message">你好！我是你的笔记陪伴小橘，可以基于你的笔记内容和你聊天~</div>'

    if (this.config.conversationHistory && this.config.conversationHistory.length > 0) {
      this.config.conversationHistory.forEach(chat => {
        const messageDiv = document.createElement('div')
        messageDiv.className = chat.role === 'user' ? 'message user-message' : 'message cat-message'
        messageDiv.textContent = chat.content
        chatMessages.appendChild(messageDiv)
      })
      chatMessages.scrollTop = chatMessages.scrollHeight
    }

    this.chatPanel.querySelector('#chat-input').focus()
    this.eventSystem.emit('chatOpened')
  }

  prepareBookChatContext() {
    const bookDescription = this.generateBookDescription()
    if (bookDescription) {
      this.config.currentChatContext = this.config.currentChatContext || {}
      this.config.currentChatContext.bookInfo = bookDescription
      saveConfig(this.config)
    }
  }

  prepareChatContext() {
    const noteContext = window.smartCat.app.contentMonitor.getCurrentNoteContext()
    const recentMonologues = window.smartCat.app.contentMonitor.getRecentMonologues()

    this.config.currentChatContext = {
      noteContext,
      recentMonologues
    }

    saveConfig(this.config)
  }

  openSettings() {
    this.isSettingsOpen = true
    this.isChatOpen = false

    const panelMask = document.getElementById('panel-mask')
    if (panelMask) {
      panelMask.style.display = 'block'
    }

    this.settingsPanel.style.display = 'block'
    this.chatPanel.style.display = 'none'

    this.updateSettingsUI()
    this.eventSystem.emit('settingsOpened')
  }

  updateSettingsUI() {
    const appearanceOptions = this.settingsPanel.querySelectorAll('.appearance-option')
    appearanceOptions.forEach(option => {
      if (option.dataset.appearance === this.config.appearance) {
        option.classList.add('selected')
      } else {
        option.classList.remove('selected')
      }
    })

    const personalityOptions = this.settingsPanel.querySelectorAll('.personality-option')
    personalityOptions.forEach(option => {
      if (option.dataset.personality === this.config.personality) {
        option.classList.add('selected')
      } else {
        option.classList.remove('selected')
      }
    })
  }

  closeChat() {
    this.isChatOpen = false
    this.chatPanel.style.display = 'none'
    const panelMask = document.getElementById('panel-mask')
    if (panelMask) {
      panelMask.style.display = 'none'
    }
    this.eventSystem.emit('chatClosed')
  }

  closeSettings() {
    this.isSettingsOpen = false
    this.settingsPanel.style.display = 'none'
    const panelMask = document.getElementById('panel-mask')
    if (panelMask) {
      panelMask.style.display = 'none'
    }
    this.eventSystem.emit('settingsClosed')
  }

  getVisibleContent() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view) {
        return null
      }

      const view = activeLeaf.view

      // 检查当前视图类型和模式
      if (view.getViewType && view.getViewType() === 'markdown') {
        const mode = view.getMode ? view.getMode() : 'source'

        if (mode === 'preview') {
          // 阅读模式
          return getVisiblePreviewContent(view)
        } else if (mode === 'source') {
          // 编辑模式
          return getVisibleEditorContent(view)
        }
      }

      return null
    } catch (error) {
      console.error('获取可见内容失败:', error)
      return null
    }
  }

  getVisiblePreviewContent(view) {
    const previewContainer = view.containerEl.querySelector('.markdown-preview-view')
    if (!previewContainer) {
      return null
    }

    return extractVisibleContent(previewContainer)
  }

  extractVisibleContent() {
    const visibleElements = []
    const viewportHeight = catContainer.clientHeight
    const scrollTop = catContainer.scrollTop

    const contentElements = catContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')

    for (const element of contentElements) {
      const rect = element.getBoundingClientRect()
      const containerRect = catContainer.getBoundingClientRect()

      const elementTop = rect.top - containerRect.top + scrollTop
      const elementBottom = elementTop + rect.height

      if (elementBottom > scrollTop && elementTop < scrollTop + viewportHeight) {
        const visibleHeight = Math.min(elementBottom, scrollTop + viewportHeight) - Math.max(elementTop, scrollTop)
        const visibilityRatio = visibleHeight / rect.height

        if (visibilityRatio > 0.3) {
          visibleElements.push({
            element: element,
            text: element.textContent,
            visibility: visibilityRatio
          })
        }
      }
    }

    visibleElements.sort((a, b) => a.visibility - b.visibility)
    const visibleText = visibleElements.map(item => item.text).join('\n\n')

    return visibleText.substring(0, 1500)
  }

  generateBookDescription() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view) return null

      const view = activeLeaf.view
      let frontmatter = {}

      // 尝试获取frontmatter
      if (view.file) {
        const fileCache = app.metadataCache.getFileCache(view.file)
        if (fileCache && fileCache.frontmatter) {
          frontmatter = fileCache.frontmatter
        }
      }

      // 构建自然语言描述
      const descriptionParts = []

      // 处理标题
      if (frontmatter.title) {
        descriptionParts.push(`《${frontmatter.title}》`)
      }

      // 处理作者和译者
      if (frontmatter.author) {
        if (frontmatter.translator) {
          descriptionParts.push(`由${frontmatter.author}著作，${frontmatter.translator}翻译`)
        } else {
          descriptionParts.push(`作者：${frontmatter.author}`)
        }
      }

      // 处理出版信息
      const publisherInfo = []
      if (frontmatter.publisher) publisherInfo.push(frontmatter.publisher)
      if (frontmatter.publicationYear) {
        // 处理日期格式
        let year = frontmatter.publicationYear
        if (typeof year === 'string') {
          // 提取年份
          const yearMatch = year.match(/\d{4}/)
          if (yearMatch) year = yearMatch[0]
        }
        publisherInfo.push(`${year}年出版`)
      }
      if (publisherInfo.length > 0) {
        descriptionParts.push(publisherInfo.join(' '))
      }

      // 处理分类
      if (frontmatter.category) {
        descriptionParts.push(`属于${frontmatter.category}领域`)
      }

      // 处理阅读数据
      const readingInfo = []
      if (frontmatter.readingProgress) {
        readingInfo.push(`阅读进度${frontmatter.readingProgress}%`)
      }
      if (frontmatter.readingTimeFormat) {
        readingInfo.push(`阅读时长${frontmatter.readingTimeFormat}`)
      }
      if (frontmatter.highlights) {
        readingInfo.push(`${frontmatter.highlights}处高亮`)
      }
      if (frontmatter.thinks) {
        readingInfo.push(`${frontmatter.thinks}条想法`)
      }
      if (readingInfo.length > 0) {
        descriptionParts.push(readingInfo.join('，'))
      }

      // 处理ISBN
      if (frontmatter.ISBN) {
        descriptionParts.push(`ISBN编码：${frontmatter.ISBN}`)
      }

      return descriptionParts.length > 0 ? descriptionParts.join('，') : null
    } catch (error) {
      console.error('生成书籍描述失败:', error)
      return null
    }
  }

  isDesktop() {
    if (app.vault.adapter instanceof app.vault.adapter.constructor) {
      return typeof require !== 'undefined' && typeof window !== 'undefined' && window.process && window.process.type === 'renderer'
    }
    return false
  }

  // 自动陪伴消息生成
  async generateAutoCompanionMessage() {
    if (!this.config.apiKey) return
    if (this.generateAutoCompanionMessageLock) {
      window.smartCat.showBubble(getSmartCatMessage('THINKING_IN_PROGRESS_MESSAGES'))
      return
    }

    try {
      let context
      if (this.hasBookTag()) {
        context = this.getVisibleContent()
        context = context.replace(/[\s\S]*?添加笔记属性/, '')
      } else {
        context = window.smartCat.app.contentMonitor.getCursorContext()
      }

      if (!context) {
        context = window.smartCat.app.contentMonitor.getViewportContent()
      }

      const selection = window.getSelection()
      const selectedText = selection.toString().trim()

      const prompt = window.smartCat.app.promptGenerator.generatePrompt('learn', context, selectedText || '')

      if (selectedText && selectedText.length <= 1500) {
        // 处理选中文本
        const messages = [
          {
            role: 'system',
            content: prompt
          },
          {
            role: 'user',
            content: `选中的文本："${selectedText}"\n\n上下文：${context}`
          }
        ]

        try {
          startThinking()
          this.generateAutoCompanionMessageLock = true
          const response = await window.smartCat.callDeepSeekAPI(messages, this.config)
          stopThinking()
          this.generateAutoCompanionMessageLock = false
          if (response) {
            window.smartCat.showBubble(response)
          }
        } catch (error) {
          this.generateAutoCompanionMessageLock = false
          console.error('解读选中文本失败:', error)
        }
        return
      }

      if (!context || context.length < 10) {
        if (window.smartCat && window.smartCat.promptGenerator) {
          const prompt = window.smartCat.app.promptGenerator.generatePrompt('auto_companion', '')

          const messages = [
            { role: 'system', content: prompt },
            { role: 'user', content: '基于当前状态给我一个简短的陪伴消息，不需要特定上下文' }
          ]

          startThinking()
          this.generateAutoCompanionMessageLock = true
          const response = await window.smartCat.callDeepSeekAPI(messages, this.config)
          stopThinking()

          if (response) {
            window.smartCat.showBubble(response)
            this.generateAutoCompanionMessageLock = false
          }
          return
        }

        const randomMessages = ['喵~ 继续加油写笔记哦！', '笔记进展如何？需要我陪伴吗？', '保持专注，你做得很好！✨', '休息一下也不错哦~ 🐾🐾🐾']
        const randomMsg = randomMessages[Math.floor(Math.random() * randomMessages.length)]
        window.smartCat.showBubble(randomMsg)
        return
      }

      const messages = [
        { role: 'system', content: prompt },
        { role: 'user', content: `基于以下内容给我一些陪伴或建议：${context}` }
      ]

      startThinking()
      this.generateAutoCompanionMessageLock = true
      const response = await window.smartCat.callDeepSeekAPI(messages, this.config)
      stopThinking()
      if (response) {
        window.smartCat.showBubble(response)
        this.generateAutoCompanionMessageLock = false
      }
    } catch (error) {
      this.generateAutoCompanionMessageLock = true
      stopAllThinking()
      console.log(error)
    }
  }

  // 语音识别切换
  toggleSpeechRecognition() {
    if (!this.speechRecognition) {
      this.speechRecognition = this.initializeSpeechRecognition()
      if (!this.speechRecognition) return
    }

    if (this.isListening) {
      this.stopSpeechRecognition()
      window.smartCat.showBubble('语音识别已停止')
    } else {
      try {
        this.speechRecognition.start()
      } catch (error) {}
    }
  }

  // 初始化语音识别
  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.log('浏览器不支持语音识别功能')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.maxAlternatives = 3

    // 语音指示器设置
    const voiceIndicator = this.catContainer.querySelector('#voice-indicator')
    if (voiceIndicator) {
      voiceIndicator.id = 'voice-recognition-indicator'
      voiceIndicator.style.cssText = `
            position: absolute;
            top: -18px;
            left: 50%;
            transform: translateX(-50%);
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            box-shadow: 
                0 0 0 2px rgba(255, 107, 107, 0.3),
                0 0 10px 4px rgba(255, 107, 107, 0.2);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 100001;
            pointer-events: none;
        `
    }

    recognition.onstart = () => {
      this.isListening = true
      if (voiceIndicator) {
        voiceIndicator.style.opacity = '1'
        voiceIndicator.classList.add('active')
      }

      this.speechTimeout = setTimeout(() => {
        if (this.isListening) {
          this.stopSpeechRecognition()
        }
      }, this.config.voiceTimeout || 15000)

      this.eventSystem.emit('speechRecognitionStarted')
    }

    recognition.onresult = event => {
      const results = event.results
      const finalResult = results[results.length - 1]

      if (!finalResult.isFinal) {
        const interimTranscript = Array.from(results)
          .filter(result => !result.isFinal)
          .map(result => result[0].transcript)
          .join('')

        if (interimTranscript) {
          this.eventSystem.emit('speechInterimResult', { transcript: interimTranscript })
        }
        return
      }

      const alternatives =
        finalResult[0] && finalResult[0].transcript
          ? Array.from(finalResult)
              .map(alt => ({
                transcript: alt.transcript,
                confidence: alt.confidence
              }))
              .sort((a, b) => b.confidence - a.confidence)
          : []

      if (alternatives.length > 0) {
        const bestMatch = alternatives[0]
        this.eventSystem.emit('speechFinalResult', { transcript: bestMatch.transcript, confidence: bestMatch.confidence })

        if (finalResult.isFinal) {
          setTimeout(async () => {
            await this.handleVoiceCommand(bestMatch.transcript)
          }, 500)
        }
      }
    }

    recognition.onerror = event => {
      this.isListening = false
      if (voiceIndicator) {
        voiceIndicator.style.opacity = '0'
        voiceIndicator.classList.remove('active')
      }

      clearTimeout(this.speechTimeout)

      const errorMessages = {
        'no-speech': '没有检测到语音',
        'audio-capture': '无法访问麦克风',
        'not-allowed': '麦克风访问被拒绝',
        network: '网络错误',
        aborted: '语音识别被中止'
      }

      const message = errorMessages[event.error] || '语音识别出现错误'
      window.smartCat.showBubble(message)
      this.eventSystem.emit('speechRecognitionError', { error: event.error, message })
    }

    recognition.onend = () => {
      this.isListening = false
      if (voiceIndicator) {
        voiceIndicator.style.opacity = '0'
        voiceIndicator.classList.remove('active')
      }
      clearTimeout(this.speechTimeout)
      this.eventSystem.emit('speechRecognitionEnded')
    }

    return recognition
  }

  // 停止语音识别
  stopSpeechRecognition() {
    if (this.speechRecognition && this.isListening) {
      try {
        this.speechRecognition.stop()
      } catch (error) {
        console.error('停止语音识别失败:', error)
      }
      this.isListening = false
    }
  }

  // 处理语音命令
  async handleVoiceCommand(transcript) {
    window.smartCat.showBubble(`你说: ${transcript}`)

    if (transcript.includes('打开设置')) {
      this.openSettings()
    } else if (transcript.includes('打开聊天')) {
      this.openChat()
    } else {
      // 作为普通聊天处理
      await this.handleVoiceChat(transcript)
    }
  }

  // 处理语音聊天
  async handleVoiceChat(message) {
    try {
      let prompt
      if (window.smartCat && window.smartCat.promptGenerator) {
        prompt = window.smartCat.app.promptGenerator.generatePrompt('casual_chat', message)
      } else {
        const personality = this.config.personality === 'custom' ? this.config.customPersonality : this.getPersonalityPrompt(this.config.personality)
        prompt = `${personality}\n\n用户正在和你进行日常聊天，请用友好可爱的语气回复，保持简短自然。`
      }

      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: `用户说："${message}"。请用简短的一句话回复。`
        }
      ]

      const response = await window.smartCat.callDeepSeekAPI(messages, this.config)
      if (response) {
        window.smartCat.showBubble(response)
      }
    } catch (error) {
      window.smartCat.showBubble('语音回复失败，请稍后再试')
    }
  }

  // 获取可见内容
  getVisibleContent() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view) {
        return null
      }

      const view = activeLeaf.view

      if (view.getViewType && view.getViewType() === 'markdown') {
        const mode = view.getMode ? view.getMode() : 'source'

        if (mode === 'preview') {
          return this.getVisiblePreviewContent(view)
        } else if (mode === 'source') {
          return this.getVisibleEditorContent(view)
        }
      }

      return null
    } catch (error) {
      this.eventSystem.emit('visibleContentError', { error })
      return null
    }
  }

  // 获取预览模式可见内容
  getVisiblePreviewContent(view) {
    const previewContainer = view.containerEl.querySelector('.markdown-preview-view')
    if (!previewContainer) {
      return null
    }

    return this.extractVisibleContent(previewContainer)
  }

  // 获取编辑模式可见内容
  getVisibleEditorContent(view) {
    const editorElement = view.containerEl.querySelector('.markdown-source-view')
    if (!editorElement) {
      return null
    }
    return editorElement.textContent || ''
  }

  // 提取可见内容
  extractVisibleContent(container) {
    const visibleElements = []
    const viewportHeight = container.clientHeight
    const scrollTop = container.scrollTop

    const contentElements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote')

    for (const element of contentElements) {
      const rect = element.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      const elementTop = rect.top - containerRect.top + scrollTop
      const elementBottom = elementTop + rect.height

      if (elementBottom > scrollTop && elementTop < scrollTop + viewportHeight) {
        const visibleHeight = Math.min(elementBottom, scrollTop + viewportHeight) - Math.max(elementTop, scrollTop)
        const visibilityRatio = visibleHeight / rect.height

        if (visibilityRatio > 0.3) {
          visibleElements.push({
            element: element,
            text: element.textContent,
            visibility: visibilityRatio
          })
        }
      }
    }

    visibleElements.sort((a, b) => a.visibility - b.visibility)
    const visibleText = visibleElements.map(item => item.text).join('\n\n')

    return visibleText.substring(0, 1500)
  }

  // 生成书籍描述
  generateBookDescription() {
    try {
      const activeLeaf = app.workspace.getMostRecentLeaf()
      if (!activeLeaf || !activeLeaf.view) return null

      const view = activeLeaf.view
      let frontmatter = {}

      if (view.file) {
        const fileCache = app.metadataCache.getFileCache(view.file)
        if (fileCache && fileCache.frontmatter) {
          frontmatter = fileCache.frontmatter
        }
      }

      const descriptionParts = []

      if (frontmatter.title) {
        descriptionParts.push(`《${frontmatter.title}》`)
      }

      if (frontmatter.author) {
        if (frontmatter.translator) {
          descriptionParts.push(`由${frontmatter.author}著作，${frontmatter.translator}翻译`)
        } else {
          descriptionParts.push(`作者：${frontmatter.author}`)
        }
      }

      const publisherInfo = []
      if (frontmatter.publisher) publisherInfo.push(frontmatter.publisher)
      if (frontmatter.publicationYear) {
        let year = frontmatter.publicationYear
        if (typeof year === 'string') {
          const yearMatch = year.match(/\d{4}/)
          if (yearMatch) year = yearMatch[0]
        }
        publisherInfo.push(`${year}年出版`)
      }
      if (publisherInfo.length > 0) {
        descriptionParts.push(publisherInfo.join(' '))
      }

      if (frontmatter.category) {
        descriptionParts.push(`属于${frontmatter.category}领域`)
      }

      const readingInfo = []
      if (frontmatter.readingProgress) {
        readingInfo.push(`阅读进度${frontmatter.readingProgress}%`)
      }
      if (frontmatter.readingTimeFormat) {
        readingInfo.push(`阅读时长${frontmatter.readingTimeFormat}`)
      }
      if (frontmatter.highlights) {
        readingInfo.push(`${frontmatter.highlights}处高亮`)
      }
      if (frontmatter.thinks) {
        readingInfo.push(`${frontmatter.thinks}条想法`)
      }
      if (readingInfo.length > 0) {
        descriptionParts.push(readingInfo.join('，'))
      }

      if (frontmatter.ISBN) {
        descriptionParts.push(`ISBN编码：${frontmatter.ISBN}`)
      }

      return descriptionParts.length > 0 ? descriptionParts.join('，') : null
    } catch (error) {
      this.eventSystem.emit('bookDescriptionError', { error })
      return null
    }
  }

  // 获取性格提示词
  getPersonalityPrompt(personality) {
    const personalities = {
      lively: '你是一只活泼可爱的小橘，热情友好，喜欢互动，用简短活泼的语气说话，偶尔加一些猫咪表情。回答要非常简短，不超过60字。',
      quiet: '你是一只安静温柔的小橘，说话温和简洁，不会过多打扰用户，用平静的语气表达关心。回答要非常简短，不超过40字。',
      wise: '你是一只聪明智慧的小橘，善于思考和分析，能给出有见地的评论，用理性的语气说话。回答要简短有深度，不超过80字。',
      cute: '你是一只超级可爱的小橘，喜欢卖萌，用撒娇的语气说话，经常使用猫咪表情和可爱的词汇。回答要非常简短可爱，不超过50字。',
      mentor: '你是一只经验丰富的导师小橘，能够指导用户写作和思考，用专业但友好的语气给出建议。回答要简短实用，不超过70字。'
    }
    return personalities[personality] || personalities.lively
  }
}


// 移动端输入法适配器
class MobileInputAdapter {
    constructor(catContainer) {
        this.catContainer = catContainer;
        this.originalStyle = null;
        this.isInputActive = false;
        this.isMobileDevice = this.detectMobile();
        
        if (this.isMobileDevice) {
            this.initialize();
        }
    }
    
    // 检测移动设备
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // 初始化
    initialize() {
        this.setupEventListeners();
        this.backupOriginalStyle();
    }
    
    // 备份原始样式
    backupOriginalStyle() {
        const style = window.getComputedStyle(this.catContainer);
        this.originalStyle = {
            position: style.position,
            top: style.top,
            left: style.left,
            right: style.right,
            bottom: style.bottom,
            transform: style.transform,
            transition: style.transition
        };
    }
    
    // 设置事件监听
    setupEventListeners() {
        // 监听输入框焦点事件
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        document.addEventListener('focusout', this.handleFocusOut.bind(this));
        
        // 监听窗口大小变化（包括输入法弹出）
        window.addEventListener('resize', this.debounce(this.handleResize.bind(this), 100));
        
        // 监听视觉视口变化（更精确的输入法检测）
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.debounce(this.handleVisualViewportResize.bind(this), 100));
        }
    }
    
    // 处理输入框获得焦点
    handleFocusIn(event) {
        if (!this.shouldHandleElement(event.target)) return;
        
        this.isInputActive = true;
        this.adjustCatPosition();
    }
    
    // 处理输入框失去焦点
    handleFocusOut(event) {
        if (!this.isInputActive) return;
        
        // 延迟恢复，避免输入法收起动画未完成
        setTimeout(() => {
            this.isInputActive = false;
            this.restoreOriginalPosition();
        }, 300);
    }
    
    // 处理窗口大小变化
    handleResize() {
        if (this.isInputActive) {
            this.adjustCatPosition();
        }
    }
    
    // 处理视觉视口变化
    handleVisualViewportResize() {
        if (this.isInputActive) {
            this.adjustCatPosition();
        }
    }
    
    // 判断是否需要处理该元素
    shouldHandleElement(element) {
        const inputTypes = ['text', 'textarea', 'search', 'email', 'url', 'tel', 'number', 'password'];
        const tagNames = ['INPUT', 'TEXTAREA'];
        
        if (tagNames.includes(element.tagName)) {
            return inputTypes.includes(element.type) || element.type === '';
        }
        
        return element.isContentEditable;
    }
    
    // 调整小橘位置
    adjustCatPosition() {
        if (!this.isInputActive) return;
        
        const safeMargin = 20;
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const catRect = this.catContainer.getBoundingClientRect();
        const catHeight = catRect.height;
        
        // 计算安全位置
        const safeTop = Math.max(10, viewportHeight - catHeight - safeMargin);
        
        // 使用transform进行更平滑的定位，避免left偏移
        this.catContainer.style.position = 'fixed';
        this.catContainer.style.top = safeTop + 'px';
        this.catContainer.style.left = '50%';
        this.catContainer.style.transform = 'translateX(-50%)';
        this.catContainer.style.zIndex = '9999';
        
        // 添加平滑过渡
        this.catContainer.style.transition = 'top 0.3s ease';
    }
    
    // 恢复原始位置
    restoreOriginalPosition() {
        if (!this.originalStyle) return;
        
        // 恢复所有样式
        this.catContainer.style.position = this.originalStyle.position;
        this.catContainer.style.top = this.originalStyle.top;
        this.catContainer.style.left = this.originalStyle.left;
        this.catContainer.style.right = this.originalStyle.right;
        this.catContainer.style.bottom = this.originalStyle.bottom;
        this.catContainer.style.transform = this.originalStyle.transform;
        this.catContainer.style.zIndex = '';
        
        // 恢复过渡效果
        if (this.originalStyle.transition) {
            this.catContainer.style.transition = this.originalStyle.transition;
        } else {
            this.catContainer.style.transition = '';
        }
    }
    
    // 防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // 销毁方法
    destroy() {
        document.removeEventListener('focusin', this.handleFocusIn);
        document.removeEventListener('focusout', this.handleFocusOut);
        window.removeEventListener('resize', this.handleResize);
        
        if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', this.handleVisualViewportResize);
        }
        
        this.restoreOriginalPosition();
    }
}

// 在 SmartCompanionApp 的 initialize 方法中添加：
// 
// 在适当的时候销毁：
// this.mobileInputAdapter?.destroy()


// 主应用类
class SmartCompanionApp {
  constructor(quickAddApi) {
    this.quickAddApi = quickAddApi
    this.eventSystem = new EventSystem()
    this.configManager = new ConfigManager()
    this.appearanceManager = new AppearanceManager(catContainer, this.eventSystem)
    this.bubbleManager = new BubbleManager(this.eventSystem)
    this.apiService = new APIService(this.eventSystem)
    this.contentMonitor = new ContentMonitor(this.eventSystem)
    this.interactionManager = new InteractionManager(catContainer, settingsPanel, chatPanel, this.eventSystem, quickAddApi)
    this.voiceCommandSystem = new VoiceCommandSystem(quickAddApi, this.interactionManager)
    this.emojiProcessor = new EmojiProcessor
    
    this.mobileInputAdapter = new MobileInputAdapter(catContainer, this.interactionManager)


    this.config = null

    this.setupEventListeners()

    this.mountToWindow()
  }

  async initialize() {
    config = this.config = this.configManager.loadConfig()
    this.appearanceManager.applyAppearance(this.config)
    this.addClearHistoryButton()
    this.interactionManager.setupInteractions(this.config)
    this.setupSimpleVisibilityCheck()

    panelMask.addEventListener('click', () => {
      this.closeSettings()
      this.closeChat()
      panelMask.style.display = 'none'
    })

    window.smartCat.config = this.config

    this.eventSystem.emit('appInitialized')
  }

  mountToWindow() {
    if (!window.smartCat) window.smartCat = {}

    // 挂载核心功能方法
    this.mountCoreMethods()

    // 挂载事件系统
    this.mountEventSystem()

    // 挂载工具方法
    this.mountUtilityMethods()

    window.smartCat.app = this
  }

  mountEventSystem() {
    const self = this // 保存当前实例的引用

    /**
     * 事件系统接口
     */
    window.smartCat.events = {
      /**
       * 监听智能猫事件
       */
      on: (eventName, callback, options = {}) => {
        const listenerId = options.id || `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const wrappedCallback = data => {
          try {
            callback(data)
            if (options.once) {
              self.eventSystem.off(eventName, wrappedCallback)
            }
          } catch (error) {
            console.error(`事件监听器错误 (${eventName}):`, error)
          }
        }

        wrappedCallback.listenerId = listenerId
        self.eventSystem.on(eventName, wrappedCallback)
        return listenerId
      },

      /**
       * 移除事件监听器
       */
      off: (eventName, target) => {
        if (!self.eventSystem.events[eventName]) return false

        if (typeof target === 'string') {
          // 通过ID移除
          self.eventSystem.events[eventName] = self.eventSystem.events[eventName].filter(callback => callback.listenerId !== target)
          return true
        } else if (typeof target === 'function') {
          // 通过函数引用移除
          self.eventSystem.off(eventName, target)
          return true
        }
        return false
      },

      /**
       * 触发自定义事件
       */
      emit: (eventName, data) => {
        self.eventSystem.emit(eventName, data)
        return true
      },

      /**
       * 获取所有已注册的事件列表
       */
      getEventList: () => {
        return Object.keys(self.eventSystem.events)
      },

      /**
       * 获取指定事件的监听器数量
       */
      getListenerCount: eventName => {
        return self.eventSystem.events[eventName] ? self.eventSystem.events[eventName].length : 0
      },

      /**
       * 移除所有事件监听器
       */
      removeAll: eventName => {
        if (eventName) {
          delete self.eventSystem.events[eventName]
        } else {
          self.eventSystem.events = {}
        }
      },

      /**
       * 创建事件监听器组，便于统一管理
       */
      createGroup: () => {
        const group = {
          listeners: new Map(),

          on: (eventName, callback, options) => {
            const listenerId = window.smartCat.events.on(eventName, callback, options)
            if (!group.listeners.has(eventName)) {
              group.listeners.set(eventName, new Set())
            }
            group.listeners.get(eventName).add(listenerId)
            return listenerId
          },

          off: (eventName, listenerId) => {
            const success = window.smartCat.events.off(eventName, listenerId)
            if (success && group.listeners.has(eventName)) {
              group.listeners.get(eventName).delete(listenerId)
            }
            return success
          },

          offAll: () => {
            group.listeners.forEach((listenerIds, eventName) => {
              listenerIds.forEach(listenerId => {
                window.smartCat.events.off(eventName, listenerId)
              })
            })
            group.listeners.clear()
          },

          getCount: () => {
            let total = 0
            group.listeners.forEach(listenerIds => {
              total += listenerIds.size
            })
            return total
          }
        }

        return group
      },

      // 其他方法保持不变...
      constants: {
        // 气泡事件
        BUBBLE_SHOWN: 'bubbleShown',
        BUBBLE_QUEUED: 'bubbleQueued',
        BUBBLE_REMOVED: 'bubbleRemoved',
        BUBBLE_PINNED: 'bubblePinned',
        BUBBLE_TO_CHAT: 'bubbleToChat',

        // 外观和设置事件
        APPEARANCE_CHANGED: 'appearanceChanged',
        APPEARANCE_SELECTED: 'appearanceSelected',
        PERSONALITY_SELECTED: 'personalitySelected',
        SETTINGS_SAVED: 'settingsSaved',
        SETTINGS_OPENED: 'settingsOpened',
        SETTINGS_CLOSED: 'settingsClosed',

        // 聊天事件
        CHAT_OPENED: 'chatOpened',
        CHAT_CLOSED: 'chatClosed',
        MESSAGE_SENT: 'messageSent',
        MESSAGE_ERROR: 'messageError',
        MESSAGE_REQUESTED: 'messageRequested',

        // API事件
        API_CALL_SUCCESS: 'apiCallSuccess',
        API_CALL_ERROR: 'apiCallError',

        // 陪伴模式事件
        COMPANION_MODE_STARTED: 'companionModeStarted',
        AUTO_COMPANION_MESSAGE_REQUESTED: 'autoCompanionMessageRequested',
        PET_INTERACTION: 'petInteraction',

        // 配置更新事件
        CONTEXT_LENGTH_UPDATED: 'contextLengthUpdated',
        CONTEXT_RATIO_UPDATED: 'contextRatioUpdated',
        SPEAK_INTERVAL_UPDATED: 'speakIntervalUpdated',
        SPEAK_PROBABILITY_UPDATED: 'speakProbabilityUpdated',
        SHORT_TERM_MEMORY_UPDATED: 'shortTermMemoryUpdated',

        // 内容监控事件
        CONTENT_MONITORING_STARTED: 'contentMonitoringStarted',
        FILE_OPENED: 'fileOpened',
        BOOK_REVIEW_GENERATION_STARTED: 'bookReviewGenerationStarted',
        BOOK_REVIEW_GENERATED: 'bookReviewGenerated',
        BOOK_REVIEW_GENERATION_ERROR: 'bookReviewGenerationError',

        // 交互事件
        INTERACTIONS_INITIALIZED: 'interactionsInitialized',
        CAT_TAPPED: 'catTapped',
        CAT_DRAGGED: 'catDragged',
        LONG_PRESS_DETECTED: 'longPressDetected',
        TOUCH_STARTED: 'touchStarted',
        TOUCH_ENDED: 'touchEnded',
        MOUSE_DOWN: 'mouseDown',
        MOUSE_UP: 'mouseUp',

        // 应用生命周期事件
        HISTORY_CLEARED: 'historyCleared',
        APP_INITIALIZED: 'appInitialized',
        APP_DESTROYED: 'appDestroyed'
      },

      once: (eventName, callback) => {
        return window.smartCat.events.on(eventName, callback, { once: true })
      },

      waitFor: (eventName, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`等待事件 ${eventName} 超时`))
          }, timeout)

          window.smartCat.events.once(eventName, data => {
            clearTimeout(timer)
            resolve(data)
          })
        })
      },

      batchOn: eventsMap => {
        const listenerIds = {}
        Object.entries(eventsMap).forEach(([eventName, callback]) => {
          listenerIds[eventName] = window.smartCat.events.on(eventName, callback)
        })
        return listenerIds
      },

      batchOff: listenerIds => {
        const results = {}
        Object.entries(listenerIds).forEach(([eventName, listenerId]) => {
          results[eventName] = window.smartCat.events.off(eventName, listenerId)
        })
        return results
      }
    }
  }

  mountCoreMethods() {
    // 气泡和消息相关
    window.smartCat.showBubble = (message, duration = null) => this.bubbleManager.showBubble(message, duration)

    // 面板控制
    window.smartCat.openChat = () => this.interactionManager.openChat()
    window.smartCat.closeChat = () => this.interactionManager.closeChat()
    window.smartCat.openSettings = () => this.interactionManager.openSettings()
    window.smartCat.closeSettings = () => this.interactionManager.closeSettings()

    // 配置管理
    window.smartCat.getConfig = () => this.config
    window.smartCat.saveConfig = config => this.configManager.saveConfig(config)
    window.smartCat.reloadConfig = () => {
      this.config = this.configManager.loadConfig()
      this.appearanceManager.applyAppearance(this.config)
    }

    // 外观和人格
    window.smartCat.switchAppearance = appearance => {
      this.config.appearance = appearance
      this.appearanceManager.applyAppearance(this.config)
      this.configManager.saveConfig(this.config)
    }

    window.smartCat.switchPersonality = personality => {
      this.config.personality = personality
      this.configManager.saveConfig(this.config)
    }

    // 聊天功能
    window.smartCat.callDeepSeekAPI = message => {
      return this.apiService.callDeepSeekAPI(message)
    }
    window.smartCat.quickChat = message => {
      this.interactionManager.openChat()
      setTimeout(() => {
        const chatInput = document.querySelector('#chat-input')
        if (chatInput) {
          chatInput.value = message
          this.interactionManager.sendMessage()
        }
      }, 100)
    }

    // 内容操作
    window.smartCat.getCurrentContext = () => window.smartCat.app.contentMonitor.getCurrentNoteContext()
    window.smartCat.generateBookReview = () => window.smartCat.app.contentMonitor.generateBookReview()
    window.smartCat.hasBookTag = () => this.interactionManager.hasBookTag()

    // 气泡管理
    window.smartCat.clearAllBubbles = () => {
      const bubbles = document.querySelectorAll('.cat-bubble')
      bubbles.forEach(bubble => this.bubbleManager.removeBubble(bubble))
    }

    // 历史记录
    window.smartCat.clearHistory = () => {
      this.config.conversationHistory = []
      this.configManager.saveConfig(this.config)
    }

    window.smartCat.exportHistory = () => {
      const conversations = this.config.conversationHistory || []
      const blob = new Blob([JSON.stringify(conversations, null, 2)], {
        type: 'application/json'
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smart-cat-conversations-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    // 状态控制
    window.smartCat.startThinking = () => startThinking()
    window.smartCat.stopThinking = () => stopThinking()

    // 调试和重置
    window.smartCat.debug = () => {
      return {
        config: this.config,
        isPageVisible: isPageVisible,
        thinkingCount: thinkingCount,
        bubbleQueue: this.bubbleManager.bubbleQueue.length,
        eventListeners: Object.keys(this.eventSystem.events).length,
        recentMonologues: window.smartCat.app.contentMonitor.recentMonologues.length,
        apiKeyConfigured: !!this.config.apiKey,
        companionMode: !!this.interactionManager.companionInterval
      }
    }
  }

  mountUtilityMethods() {
    window.smartCat.utils = {}
  }

  setupEventListeners() {
    this.eventSystem.on('messageError', data => {
      const { error, message } = data
      console.error('消息发送错误:', error)

      // 显示错误提示气泡
      let errorMessage = '消息发送失败，请稍后重试'

      if (error.message) {
        if (error.message.includes('API密钥') || error.message.includes('api key')) {
          errorMessage = 'API密钥错误，请检查设置'
        } else if (error.message.includes('网络') || error.message.includes('Network')) {
          errorMessage = '网络连接失败，请检查网络'
        } else if (error.message.includes('超时') || error.message.includes('timeout')) {
          errorMessage = '请求超时，请稍后重试'
        } else if (error.message.includes('配额') || error.message.includes('quota')) {
          errorMessage = 'API配额不足，请检查使用量'
        }
      }

      this.showErrorMessage(errorMessage)

      // 记录错误日志
      this.logError(error, message)
    })

    this.eventSystem.on('messageRequested', data => {
      // 统一处理所有消息显示
      this.handleMessageDisplay(data)
    })

    this.eventSystem.on('bubbleToChat', data => {
      this.openChatWithMessage(data.message)
    })

    this.eventSystem.on('appearanceChanged', data => {
      // 处理外观变化
    })

    this.eventSystem.on('settingsSaved', data => {
      // 处理设置保存
    })

    // 添加更多事件监听器...
  }

  handleMessageDisplay(messageData) {
    // 统一的消息显示逻辑
    const { type, content, options } = messageData

    switch (type) {
      case 'error':
        this.showErrorMessage(content, options)
        break
      case 'system':
        this.showSystemMessage(content, options)
        break
      case 'welcome':
        this.showWelcomeMessage(content, options)
        break
      default:
        this.showBubbleMessage(content, options)
    }
  }

  showErrorMessage(content, options = {}) {
    this.bubbleManager.showBubble(`[错误] ${content}`, { duration: 4000, ...options })
  }

  showSystemMessage(content, options = {}) {
    this.bubbleManager.showBubble(`[系统] ${content}`, { duration: 3000, ...options })
  }

  showWelcomeMessage(content, options = {}) {
    this.bubbleManager.showBubble(content, { duration: 3500, ...options })
  }

  showBubbleMessage(content, options = {}) {
    this.bubbleManager.showBubble(content, options)
  }

  setupSimpleVisibilityCheck() {
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden

      if (!isPageVisible) {
        clearTimeout(backMessageTimer)
        backMessageTimer = setTimeout(() => {
          allowBackMessage = true
        }, 60 * 1000)
      } else {
        clearTimeout(backMessageTimer)
        if (allowBackMessage) {
          this.showWelcomeBackMessage()
          allowBackMessage = false
        }
      }
    })
  }

  showWelcomeBackMessage() {
    if (!isPageVisible) return

    const hour = new Date().getHours()
    let timeBasedMessages = []

    if (hour >= 5 && hour < 12) {
      timeBasedMessages = ['早晨好！新的一天开始啦！🌅', '早安！今天也要元气满满哦！', '清晨的阳光迎接你的归来~', '早上好！思维最清晰的时刻到了！']
    } else if (hour >= 12 && hour < 18) {
      timeBasedMessages = ['下午好！继续上午的创作吧！', '午安~ 休息后思路更清晰！', '下午时光，正是创作好时节~', '日正当中，灵感正盛！']
    } else {
      timeBasedMessages = ['晚上好！宁静的夜晚适合思考~', '晚安前的创作时间到了！', '星空下的灵感特别美丽~', '夜晚是思维最活跃的时候呢！']
    }

    if (Math.random() > 0.5) {
      this.bubbleManager.showBubble(timeBasedMessages[Math.floor(Math.random() * timeBasedMessages.length)])
    } else {
      this.bubbleManager.showBubble(getSmartCatMessage('WELCOME_BACK_MESSAGES'))
    }
  }

  addClearHistoryButton() {
    const clearHistoryBtn = document.createElement('button')
    clearHistoryBtn.className = 'save-btn'
    clearHistoryBtn.id = 'clear-history'
    clearHistoryBtn.textContent = '清除对话历史'
    clearHistoryBtn.style.marginTop = '5px'
    clearHistoryBtn.style.background = '#dc3545'

    settingsPanel.querySelector('.panel-content').appendChild(clearHistoryBtn)

    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('确定要清除所有对话历史吗？这个操作不可撤销。')) {
        this.config.conversationHistory = []
        this.configManager.saveConfig(this.config)
        alert('对话历史已清除')
        this.eventSystem.emit('historyCleared')
      }
    })
  }

  openChatWithMessage() {
    this.interactionManager.openChat()

    setTimeout(() => {
      if (pendingChatMessage) {
        const chatMessages = chatPanel.querySelector('#chat-messages')
        const catMessage = document.createElement('div')
        catMessage.className = 'message cat-message'
        catMessage.textContent = pendingChatMessage
        chatMessages.appendChild(catMessage)

        if (this.config.conversationHistory) {
          this.config.conversationHistory.push({
            role: 'assistant',
            content: pendingChatMessage,
            timestamp: new Date().toISOString()
          })
          this.configManager.saveConfig(this.config)
        }

        chatMessages.scrollTop = chatMessages.scrollHeight

        const hintMessage = document.createElement('div')
        hintMessage.className = 'message system-message'
        hintMessage.textContent = '已将该气泡消息添加到对话历史，现在你可以继续聊天了～'
        hintMessage.style.fontSize = '12px'
        hintMessage.style.color = '#666'
        hintMessage.style.fontStyle = 'italic'
        chatMessages.appendChild(hintMessage)
        chatMessages.scrollTop = chatMessages.scrollHeight

        pendingChatMessage = null
      }
    }, 100)
  }

  closeSettings() {
    this.interactionManager.closeSettings()
  }

  closeChat() {
    this.interactionManager.closeChat()
  }
}

// 思考状态管理
let thinkingCount = 0
let thinkingIndicator = null

function initializeThinkingIndicator() {
  thinkingIndicator = document.getElementById('thinking-indicator')
  if (!thinkingIndicator && catContainer) {
    thinkingIndicator = document.createElement('div')
    thinkingIndicator.id = 'thinking-indicator'
    thinkingIndicator.className = 'thinking-indicator'
    catContainer.appendChild(thinkingIndicator)
  }
}

function startThinking() {
  if (!thinkingIndicator) {
    initializeThinkingIndicator()
  }

  thinkingCount++

  if (thinkingIndicator) {
    thinkingIndicator.classList.add('active')
  }
}

function stopThinking() {
  thinkingCount = Math.max(0, thinkingCount - 1)

  if (thinkingCount === 0 && thinkingIndicator) {
    thinkingIndicator.classList.remove('active')
  }
}

function stopAllThinking() {
  thinkingCount = 0
  if (thinkingIndicator) {
    thinkingIndicator.classList.remove('active')
  }
}

function saveConfig(config) {
  const configManager = new ConfigManager()
  configManager.saveConfig(config)
}

function applyAppearance(config) {
  // 这个函数现在由AppearanceManager处理
  // 保持兼容性，调用全局的appearanceManager
  if (window.smartCat.appearanceManager) {
    window.smartCat.appearanceManager.applyAppearance(config)
  }
}

 
if (!window.smartCat) {
  window.smartCat = {}
}
// 导出模块
module.exports = async params => {
  const { quickAddApi } = params
  const app = new SmartCompanionApp(quickAddApi)
  app.initialize()
}


class EmojiProcessor {
    constructor() {
        this.returnedEmojis = new Set(); // 存储已返回的emoji
        this.emojiRegex = this.createEmojiRegex();
    }
    
    /**
     * 创建emoji匹配正则表达式
     */
    createEmojiRegex() {
        return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu;
    }
    
    /**
     * 核心方法：处理文本并返回合适的emoji
     * @param {string} text - 要处理的文本
     * @returns {string|null} 符合要求的emoji或null
     */
    process(text) {
        if (!text || typeof text !== 'string') {
            return null;
        }
        
        // 提取文本中的所有emoji
        const matches = text.match(this.emojiRegex);
        if (!matches || matches.length === 0) {
            return null;
        }
        
        // 去重并保持顺序
        const uniqueEmojis = [];
        const seen = new Set();
        for (const emoji of matches) {
            if (!seen.has(emoji)) {
                seen.add(emoji);
                uniqueEmojis.push(emoji);
            }
        }
        
        // 优先返回未返回过的emoji
        for (const emoji of uniqueEmojis) {
            if (!this.returnedEmojis.has(emoji)) {
                this.returnedEmojis.add(emoji);
                return emoji;
            }
        }
        
        // 所有emoji都已返回过，返回最后一个
        const lastEmoji = uniqueEmojis[uniqueEmojis.length - 1];
        this.returnedEmojis.add(lastEmoji);
        return lastEmoji;
    }
    
    /**
     * 重置已返回的emoji记录
     */
    reset() {
        this.returnedEmojis.clear();
    }
}

