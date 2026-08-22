class AdvancedAnimationSystem {
  constructor(catElement) {
    this.cat = catElement
    this.body = catElement.querySelector('#cat-body')
    this.eyes = catElement.querySelectorAll('.cat-eye')
    this.ears = catElement.querySelectorAll('.cat-ear')
    this.tail = catElement.querySelector('.cat-tail')
    this.face = catElement.querySelector('.cat-face')

    this.currentState = 'idle'
    this.animationQueue = []
    this.isBusy = false
    this.mood = 'content' // content, happy, curious, sleepy, excited, playful
    this.idleTimer = null
    this.lastInteraction = Date.now()

    this.body.style.animationDuration = '3s, 8s'
    this.tail.style.animationDuration = '7s'

    this.initialize()
  }

  initialize() {
    // 设置基础动画
    this.setBaseAnimations()

    // 启动状态循环
    this.startStateLoop()

    // 设置交互监听
    this.setupInteractions()

    // 启动随机动作系统
    this.startRandomActions()

    injectAdvancedAnimations()
  }

  setBaseAnimations() {
    // 身体基础动画 - 更自然的呼吸和浮动
    this.body.style.animation = 'breathing 3s ease-in-out infinite, gentleSway 8s ease-in-out infinite'

    // 耳朵轻微抖动
    this.ears.forEach(ear => {
      ear.style.animation = 'earsTwitch 12s ease-in-out infinite'
    })

    // 尾巴自然摆动
    this.tail.style.animation = 'tailFlick 7s ease-in-out infinite'

    // 眼睛眨眼
    this.eyes.forEach(eye => {
      eye.style.animation = 'blinkSlow 5s ease-in-out infinite'
    })
  }

  // 状态管理系统
  startStateLoop() {
    setInterval(() => {
      this.updateState()
    }, 5000) // 每5秒检查一次状态
  }

  updateState() {
    const now = Date.now()
    const timeSinceLastInteraction = now - this.lastInteraction

    // 根据互动时间和当前状态决定新状态
    if (timeSinceLastInteraction > 30000 && this.mood !== 'sleepy') {
      // 30秒无互动，可能变得困倦
      if (Math.random() < 0.3) {
        this.setMood('sleepy')
      }
    } else if (timeSinceLastInteraction < 5000 && this.mood !== 'excited') {
      // 5秒内有互动，可能变得兴奋
      if (Math.random() < 0.4) {
        this.setMood('excited')
      }
    }

    // 随机状态变化（小概率）
    if (Math.random() < 0.1) {
      const moods = ['content', 'happy', 'curious', 'playful']
      const randomMood = moods[Math.floor(Math.random() * moods.length)]
      if (randomMood !== this.mood) {
        this.setMood(randomMood)
      }
    }
  }

  setMood(newMood) {
    this.mood = newMood
    this.applyMoodAnimations()

    // 触发相应的心情动画
    switch (newMood) {
      case 'happy':
        this.playAnimation('happyBounce', 2000)
        break
      case 'curious':
        this.playAnimation('curiousLook', 1500)
        break
      case 'sleepy':
        this.playAnimation('sleepySway', 2500)
        break
      case 'excited':
        this.playAnimation('excitedVibrate', 1000)
        break
      case 'playful':
        this.playAnimation('playfulHop', 1800)
        break
    }
  }

  applyMoodAnimations() {
    // 根据心情调整基础动画参数
    switch (this.mood) {
      case 'happy':
        this.body.style.animation = 'happyBounce 4s ease-in-out infinite, gentleSway 6s ease-in-out infinite'
        this.tail.style.animation = 'tailWagHappy 3s ease-in-out infinite'
        this.eyes.forEach(eye => {
          eye.style.animation = 'blinkQuick 3s ease-in-out infinite, eyesSparkle 5s ease-in-out infinite'
        })
        break

      case 'curious':
        this.body.style.animation = 'curiousTilt 5s ease-in-out infinite'
        this.eyes.forEach(eye => {
          eye.style.animation = 'blinkSlow 4s ease-in-out infinite, eyesWiden 6s ease-in-out infinite'
        })
        break

      case 'sleepy':
        this.body.style.animation = 'sleepySway 8s ease-in-out infinite'
        this.ears.forEach(ear => {
          ear.style.animation = 'none'
        })
        this.tail.style.animation = 'none'
        this.eyes.forEach(eye => {
          eye.style.animation = 'blinkSlow 8s ease-in-out infinite'
        })
        break

      case 'excited':
        this.body.style.animation = 'excitedVibrate 2s ease-in-out infinite, breathing 2s ease-in-out infinite'
        this.tail.style.animation = 'tailSwish 1.5s ease-in-out infinite'
        this.eyes.forEach(eye => {
          eye.style.animation = 'blinkQuick 2s ease-in-out infinite'
        })
        break

      case 'playful':
        this.body.style.animation = 'playfulHop 3s ease-in-out infinite'
        this.tail.style.animation = 'tailFlick 2s ease-in-out infinite'
        this.eyes.forEach(eye => {
          eye.style.animation = 'blinkQuick 3s ease-in-out infinite'
        })
        break

      default: // content
        this.setBaseAnimations()
    }
  }

  // 随机动作系统
  startRandomActions() {
    setInterval(() => {
      if (this.isBusy || this.mood === 'sleepy') return

      // 随机触发小动作
      if (Math.random() < 0.3) {
        this.triggerRandomAction()
      }
    }, 8000) // 每8秒有可能触发随机动作
  }

  triggerRandomAction() {
    const actions = [
      { name: 'earFlickLeft', part: 'ears', duration: 800 },
      { name: 'earFlickRight', part: 'ears', duration: 800 },
      { name: 'tailFlick', part: 'tail', duration: 1000 },
      { name: 'contentStretch', part: 'body', duration: 1200 },
      { name: 'blinkQuick', part: 'eyes', duration: 500 }
    ]

    const randomAction = actions[Math.floor(Math.random() * actions.length)]
    this.playPartAnimation(randomAction.part, randomAction.name, randomAction.duration)
  }

  // 动画播放系统
  playAnimation(animationName, duration = 1000) {
    if (this.isBusy && animationName !== 'blinkQuick') {
      this.animationQueue.push({ animationName, duration })
      return
    }

    this.isBusy = true
    this.body.style.animation = 'none'
    void this.body.offsetWidth // 触发重绘

    // 应用新动画
    this.body.style.animation = `${animationName} ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`

    setTimeout(() => {
      this.isBusy = false
      this.applyMoodAnimations() // 恢复心情动画

      // 播放队列中的下一个动画
      if (this.animationQueue.length > 0) {
        const next = this.animationQueue.shift()
        setTimeout(() => this.playAnimation(next.animationName, next.duration), 200)
      }
    }, duration)
  }

  playPartAnimation(part, animationName, duration = 1000) {
    const elements = part === 'ears' ? this.ears : part === 'eyes' ? this.eyes : part === 'tail' ? [this.tail] : [this.body]

    elements.forEach(element => {
      const originalAnimation = element.style.animation
      element.style.animation = 'none'
      void element.offsetWidth

      element.style.animation = `${animationName} ${duration}ms ease-in-out`

      setTimeout(() => {
        element.style.animation = originalAnimation
      }, duration)
    })
  }

  // 交互系统
  setupInteractions() {
    // 鼠标悬停
    this.cat.addEventListener('mouseenter', () => {
      this.lastInteraction = Date.now()
      if (this.mood === 'sleepy') this.setMood('content')
      this.playAnimation('attentionPulse', 1500)
    })

    // 鼠标离开
    this.cat.addEventListener('mouseleave', () => {
      this.lastInteraction = Date.now()
    })

    // 点击
    this.cat.addEventListener('click', e => {
      if (e.target.closest('#cat-body')) {
        this.lastInteraction = Date.now()
        this.playAnimation('excitedWiggle', 800)
        this.setMood('excited')

        // 随机触发耳朵或尾巴动作
        if (Math.random() < 0.5) {
          setTimeout(() => {
            this.playPartAnimation('ears', Math.random() < 0.5 ? 'earFlickLeft' : 'earFlickRight', 600)
          }, 300)
        }
      }
    })
  }

  // 特殊场合动画
  celebrate() {
    this.playAnimation('celebrationDance', 2500)
    this.setMood('excited')
  }

  greet() {
    this.playAnimation('greetingBow', 1200)
    this.setMood('happy')
  }

  surprise() {
    this.playAnimation('surpriseJump', 1500)
    this.setMood('excited')
  }

  // 语音交互动画
  startListening() {
    this.playAnimation('attentionPulse', 2000)
    this.setMood('curious')
  }

  stopListening() {
    this.setMood('content')
  }

  thinking() {
    this.playAnimation('curiousTilt', 1500)
    this.setMood('curious')
  }
}

// 为高级皮肤添加特殊动画
function setupAdvancedSkinAnimations() {
  const skinAnimations = {
    neon: {
      body: 'neonDance 4s ease-in-out infinite, glowEffect 3s ease-in-out infinite',
      tail: 'neonDance 2s ease-in-out infinite',
      eyes: 'blinkQuick 2s ease-in-out infinite, glowEffect 4s ease-in-out infinite'
    },
    galaxy: {
      body: 'floatGracefully 6s ease-in-out infinite',
      tail: 'tailSwish 4s ease-in-out infinite',
      ears: 'earsTwitch 5s ease-in-out infinite'
    },
    fire: {
      body: 'fireFlicker 2s ease-in-out infinite, excitedVibrate 3s ease-in-out infinite',
      tail: 'tailFlick 1.5s ease-in-out infinite',
      eyes: 'eyesSparkle 3s ease-in-out infinite'
    },
    liquidMetal: {
      body: 'shimmer 4s linear infinite, gentleSway 5s ease-in-out infinite',
      tail: 'tailSwish 3s ease-in-out infinite'
    },
    crystal: {
      body: 'glowEffect 5s ease-in-out infinite, breathing 4s ease-in-out infinite',
      eyes: 'blinkSlow 4s ease-in-out infinite, eyesSparkle 6s ease-in-out infinite'
    }
  }

  // 应用皮肤特定动画
  Object.keys(skinAnimations).forEach(skin => {
    const style = document.createElement('style')
    style.textContent = `
      .skin-${skin} .cat-body {
        animation: ${skinAnimations[skin].body} !important;
      }
      .skin-${skin} .cat-tail {
        animation: ${skinAnimations[skin].tail} !important;
      }
      .skin-${skin} .cat-eye {
        animation: ${skinAnimations[skin].eyes || 'blinkSlow 5s ease-in-out infinite'} !important;
      }
      .skin-${skin} .cat-ear {
        animation: ${skinAnimations[skin].ears || 'earsTwitch 8s ease-in-out infinite'} !important;
      }
    `
    document.head.appendChild(style)
  })
}

// ==================== 72种随机小动作注入代码 ====================
// 此代码通过原型扩展方式注入，不修改原有源代码

// 等待小橘系统加载完成
function injectAdvancedAnimations() {
  // 检查动画系统是否已加载
  if (typeof AdvancedAnimationSystem === 'undefined') {
    setTimeout(injectAdvancedAnimations, 100)
    return
  }

  // 扩展动画系统原型
  const originalInit = AdvancedAnimationSystem.prototype.initialize

  AdvancedAnimationSystem.prototype.initialize = function () {
    // 调用原有初始化
    if (originalInit) originalInit.call(this)

    // 注入72种小动作
    this.injectedAnimations = {
      // 基础动作类 (12种)
      basic: [
        { name: '轻微点头', part: 'body', animation: 'gentleNod', duration: 800 },
        { name: '快速眨眼', part: 'eyes', animation: 'quickBlink', duration: 300 },
        { name: '耳朵抖动', part: 'ears', animation: 'earTwitch', duration: 500 },
        { name: '尾巴轻摇', part: 'tail', animation: 'tailFlick', duration: 600 },
        { name: '身体微颤', part: 'body', animation: 'bodyShiver', duration: 400 },
        { name: '好奇歪头', part: 'head', animation: 'headTilt', duration: 1000 },
        { name: '舒展身体', part: 'body', animation: 'bodyStretch', duration: 1200 },
        { name: '爪子轻抬', part: 'paws', animation: 'pawLift', duration: 700 },
        { name: '眯眼微笑', part: 'eyes', animation: 'squintSmile', duration: 900 },
        { name: '耳朵后贴', part: 'ears', animation: 'earsBack', duration: 600 },
        { name: '尾巴卷曲', part: 'tail', animation: 'tailCurl', duration: 800 },
        { name: '身体轻晃', part: 'body', animation: 'bodySway', duration: 1100 }
      ],

      // 卖萌动作类 (12种)
      cute: [
        { name: '卖萌歪头', part: 'head', animation: 'cuteHeadTilt', duration: 1200 },
        { name: '眨眼卖萌', part: 'eyes', animation: 'cuteBlink', duration: 500 },
        { name: '耳朵扑棱', part: 'ears', animation: 'earFlutter', duration: 800 },
        { name: '尾巴画圈', part: 'tail', animation: 'tailCircle', duration: 1500 },
        { name: '身体扭动', part: 'body', animation: 'bodyWiggle', duration: 1000 },
        { name: '爪子洗脸', part: 'paws', animation: 'faceWash', duration: 1300 },
        { name: '打滚卖萌', part: 'body', animation: 'cuteRoll', duration: 1800 },
        { name: '耳朵抖动卖萌', part: 'ears', animation: 'cuteEarTwitch', duration: 700 },
        { name: '尾巴摇摆卖萌', part: 'tail', animation: 'cuteTailWag', duration: 900 },
        { name: '眯眼卖萌', part: 'eyes', animation: 'cuteSquint', duration: 600 },
        { name: '身体蜷缩', part: 'body', animation: 'bodyCurling', duration: 1100 },
        { name: '爪子轻拍', part: 'paws', animation: 'pawPat', duration: 800 }
      ],

      // 活泼动作类 (12种)
      lively: [
        { name: '兴奋跳跃', part: 'body', animation: 'excitedJump', duration: 800 },
        { name: '快速摇尾', part: 'tail', animation: 'fastTailWag', duration: 500 },
        { name: '耳朵竖起', part: 'ears', animation: 'earsPerk', duration: 400 },
        { name: '身体弹跳', part: 'body', animation: 'bodyBounce', duration: 700 },
        { name: '尾巴快速摆动', part: 'tail', animation: 'tailSwish', duration: 600 },
        { name: '耳朵快速抖动', part: 'ears', animation: 'fastEarTwitch', duration: 300 },
        { name: '身体轻跳', part: 'body', animation: 'bodyHop', duration: 900 },
        { name: '尾巴兴奋摇动', part: 'tail', animation: 'excitedTailWag', duration: 800 },
        { name: '耳朵兴奋抖动', part: 'ears', animation: 'excitedEarTwitch', duration: 600 },
        { name: '身体快速扭动', part: 'body', animation: 'fastBodyWiggle', duration: 700 },
        { name: '尾巴快速卷曲', part: 'tail', animation: 'fastTailCurl', duration: 500 },
        { name: '身体兴奋颤抖', part: 'body', animation: 'excitedShiver', duration: 400 }
      ],

      // 优雅动作类 (12种)
      elegant: [
        { name: '优雅转身', part: 'body', animation: 'elegantTurn', duration: 1500 },
        { name: '尾巴优雅摆动', part: 'tail', animation: 'elegantTailSway', duration: 1200 },
        { name: '耳朵优雅抖动', part: 'ears', animation: 'elegantEarTwitch', duration: 800 },
        { name: '身体优雅伸展', part: 'body', animation: 'elegantStretch', duration: 1600 },
        { name: '尾巴优雅卷曲', part: 'tail', animation: 'elegantTailCurl', duration: 1100 },
        { name: '耳朵优雅后贴', part: 'ears', animation: 'elegantEarsBack', duration: 900 },
        { name: '身体优雅晃动', part: 'body', animation: 'elegantBodySway', duration: 1300 },
        { name: '尾巴优雅轻摇', part: 'tail', animation: 'elegantTailFlick', duration: 1000 },
        { name: '耳朵优雅竖起', part: 'ears', animation: 'elegantEarsPerk', duration: 700 },
        { name: '身体优雅旋转', part: 'body', animation: 'elegantSpin', duration: 1800 },
        { name: '尾巴优雅波浪', part: 'tail', animation: 'elegantTailWave', duration: 1400 },
        { name: '身体优雅鞠躬', part: 'body', animation: 'elegantBow', duration: 1200 }
      ],

      // 搞笑动作类 (12种)
      funny: [
        { name: '滑稽摔倒', part: 'body', animation: 'funnyFall', duration: 1000 },
        { name: '尾巴打结', part: 'tail', animation: 'tailTangle', duration: 800 },
        { name: '耳朵抽筋', part: 'ears', animation: 'earCramp', duration: 600 },
        { name: '身体搞笑扭动', part: 'body', animation: 'funnyWiggle', duration: 900 },
        { name: '尾巴搞笑摆动', part: 'tail', animation: 'funnyTailWag', duration: 700 },
        { name: '耳朵搞笑抖动', part: 'ears', animation: 'funnyEarTwitch', duration: 500 },
        { name: '身体搞笑跳跃', part: 'body', animation: 'funnyJump', duration: 800 },
        { name: '尾巴搞笑卷曲', part: 'tail', animation: 'funnyTailCurl', duration: 600 },
        { name: '耳朵搞笑竖起', part: 'ears', animation: 'funnyEarsPerk', duration: 400 },
        { name: '身体搞笑旋转', part: 'body', animation: 'funnySpin', duration: 1100 },
        { name: '尾巴搞笑波浪', part: 'tail', animation: 'funnyTailWave', duration: 1000 },
        { name: '身体搞笑鞠躬', part: 'body', animation: 'funnyBow', duration: 1200 }
      ],

      // 特殊效果类 (12种)
      special: [
        { name: '星光闪烁', part: 'body', animation: 'starTwinkle', duration: 2000 },
        { name: '彩虹环绕', part: 'body', animation: 'rainbowHalo', duration: 1800 },
        { name: '气泡飘出', part: 'body', animation: 'bubbleFloat', duration: 1600 },
        { name: '爱心飞舞', part: 'body', animation: 'heartFloat', duration: 1400 },
        { name: '雪花飘落', part: 'body', animation: 'snowFall', duration: 1500 },
        { name: '花瓣飘洒', part: 'body', animation: 'petalShower', duration: 1700 },
        { name: '闪光效果', part: 'body', animation: 'flashEffect', duration: 500 },
        { name: '渐变变色', part: 'body', animation: 'colorShift', duration: 1200 },
        { name: '影子分身', part: 'body', animation: 'shadowClone', duration: 1000 },
        { name: '透明效果', part: 'body', animation: 'transparentEffect', duration: 1300 },
        { name: '放大缩小', part: 'body', animation: 'scalePulse', duration: 1100 },
        { name: '旋转特效', part: 'body', animation: 'spinEffect', duration: 900 }
      ]
    }

    // 启动增强版随机动作系统
    this.startEnhancedRandomActions()
  }

  // 添加增强版随机动作系统
  AdvancedAnimationSystem.prototype.startEnhancedRandomActions = function () {
    // 清除原有定时器
    if (this.enhancedActionTimer) {
      clearInterval(this.enhancedActionTimer)
    }

    // 新的随机动作定时器（更智能的触发逻辑）
    this.enhancedActionTimer = setInterval(() => {
      if (this.isBusy || this.mood === 'sleepy') return

      // 根据心情调整触发概率
      let triggerProbability = 0.3 // 基础概率30%

      switch (this.mood) {
        case 'happy':
          triggerProbability = 0.5
          break
        case 'excited':
          triggerProbability = 0.6
          break
        case 'playful':
          triggerProbability = 0.7
          break
        case 'curious':
          triggerProbability = 0.4
          break
        case 'sleepy':
          triggerProbability = 0.1
          break
        default:
          triggerProbability = 0.3
      }

      if (Math.random() < triggerProbability) {
        this.triggerEnhancedRandomAction()
      }
    }, 6000) // 每6秒检查一次
  }

  // 增强版随机动作触发
  AdvancedAnimationSystem.prototype.triggerEnhancedRandomAction = function () {
    const moodActions = this.getMoodAppropriateActions()
    if (moodActions.length === 0) return

    const randomAction = moodActions[Math.floor(Math.random() * moodActions.length)]
    this.playEnhancedAnimation(randomAction)
  }

  // 根据心情获取合适的动作
  AdvancedAnimationSystem.prototype.getMoodAppropriateActions = function () {
    const allActions = [...this.injectedAnimations.basic, ...this.injectedAnimations.cute, ...this.injectedAnimations.lively, ...this.injectedAnimations.elegant, ...this.injectedAnimations.funny, ...this.injectedAnimations.special]

    // 根据心情筛选动作
    let filteredActions = allActions

    switch (this.mood) {
      case 'happy':
        filteredActions = [...this.injectedAnimations.cute, ...this.injectedAnimations.lively, ...this.injectedAnimations.special]
        break
      case 'excited':
        filteredActions = [...this.injectedAnimations.lively, ...this.injectedAnimations.funny, ...this.injectedAnimations.special]
        break
      case 'playful':
        filteredActions = [...this.injectedAnimations.funny, ...this.injectedAnimations.lively, ...this.injectedAnimations.cute]
        break
      case 'curious':
        filteredActions = [...this.injectedAnimations.basic, ...this.injectedAnimations.elegant]
        break
      case 'sleepy':
        filteredActions = this.injectedAnimations.basic.filter(action => action.duration < 1000)
        break
      case 'content':
      default:
        filteredActions = allActions
    }

    return filteredActions
  }

  // 播放增强版动画
  AdvancedAnimationSystem.prototype.playEnhancedAnimation = function (action) {
    if (this.isBusy) return

    this.isBusy = true

    // 根据动作类型选择目标元素
    const elements = this.getActionElements(action.part)
    const originalStyles = []

    // 保存原始样式
    elements.forEach((element, index) => {
      originalStyles[index] = {
        animation: element.style.animation,
        transform: element.style.transform
      }
    })

    // 应用新动画
    const animationCSS = this.generateAnimationCSS(action.animation, action.duration)
    elements.forEach(element => {
      element.style.animation = 'none'
      void element.offsetWidth // 触发重绘
      element.style.animation = animationCSS
    })

    // 设置恢复定时器
    setTimeout(() => {
      elements.forEach((element, index) => {
        element.style.animation = originalStyles[index].animation
        element.style.transform = originalStyles[index].transform
      })
      this.isBusy = false
    }, action.duration)
  }

  // 获取动作对应的元素
  AdvancedAnimationSystem.prototype.getActionElements = function (part) {
    switch (part) {
      case 'body':
        return [this.body]
      case 'eyes':
        return this.eyes
      case 'ears':
        return this.ears
      case 'tail':
        return [this.tail]
      case 'head':
        return [this.face]
      case 'paws':
        return [this.body] // 用身体模拟爪子
      default:
        return [this.body]
    }
  }

  // 生成动画CSS
  AdvancedAnimationSystem.prototype.generateAnimationCSS = function (animationName, duration) {
    const animations = {
      // 基础动作动画
      gentleNod: `gentleNod ${duration}ms ease-in-out`,
      quickBlink: `quickBlink ${duration}ms ease-in-out`,
      earTwitch: `earTwitch ${duration}ms ease-in-out`,
      tailFlick: `tailFlick ${duration}ms ease-in-out`,
      bodyShiver: `bodyShiver ${duration}ms ease-in-out`,
      headTilt: `headTilt ${duration}ms ease-in-out`,
      bodyStretch: `bodyStretch ${duration}ms ease-in-out`,
      pawLift: `pawLift ${duration}ms ease-in-out`,
      squintSmile: `squintSmile ${duration}ms ease-in-out`,
      earsBack: `earsBack ${duration}ms ease-in-out`,
      tailCurl: `tailCurl ${duration}ms ease-in-out`,
      bodySway: `bodySway ${duration}ms ease-in-out`,

      // 卖萌动作动画
      cuteHeadTilt: `cuteHeadTilt ${duration}ms ease-in-out`,
      cuteBlink: `cuteBlink ${duration}ms ease-in-out`,
      earFlutter: `earFlutter ${duration}ms ease-in-out`,
      tailCircle: `tailCircle ${duration}ms ease-in-out`,
      bodyWiggle: `bodyWiggle ${duration}ms ease-in-out`,
      faceWash: `faceWash ${duration}ms ease-in-out`,
      cuteRoll: `cuteRoll ${duration}ms ease-in-out`,
      cuteEarTwitch: `cuteEarTwitch ${duration}ms ease-in-out`,
      cuteTailWag: `cuteTailWag ${duration}ms ease-in-out`,
      cuteSquint: `cuteSquint ${duration}ms ease-in-out`,
      bodyCurling: `bodyCurling ${duration}ms ease-in-out`,
      pawPat: `pawPat ${duration}ms ease-in-out`,

      // 活泼动作动画
      excitedJump: `excitedJump ${duration}ms ease-in-out`,
      fastTailWag: `fastTailWag ${duration}ms ease-in-out`,
      earsPerk: `earsPerk ${duration}ms ease-in-out`,
      bodyBounce: `bodyBounce ${duration}ms ease-in-out`,
      tailSwish: `tailSwish ${duration}ms ease-in-out`,
      fastEarTwitch: `fastEarTwitch ${duration}ms ease-in-out`,
      bodyHop: `bodyHop ${duration}ms ease-in-out`,
      excitedTailWag: `excitedTailWag ${duration}ms ease-in-out`,
      excitedEarTwitch: `excitedEarTwitch ${duration}ms ease-in-out`,
      fastBodyWiggle: `fastBodyWiggle ${duration}ms ease-in-out`,
      fastTailCurl: `fastTailCurl ${duration}ms ease-in-out`,
      excitedShiver: `excitedShiver ${duration}ms ease-in-out`,

      // 优雅动作动画
      elegantTurn: `elegantTurn ${duration}ms ease-in-out`,
      elegantTailSway: `elegantTailSway ${duration}ms ease-in-out`,
      elegantEarTwitch: `elegantEarTwitch ${duration}ms ease-in-out`,
      elegantStretch: `elegantStretch ${duration}ms ease-in-out`,
      elegantTailCurl: `elegantTailCurl ${duration}ms ease-in-out`,
      elegantEarsBack: `elegantEarsBack ${duration}ms ease-in-out`,
      elegantBodySway: `elegantBodySway ${duration}ms ease-in-out`,
      elegantTailFlick: `elegantTailFlick ${duration}ms ease-in-out`,
      elegantEarsPerk: `elegantEarsPerk ${duration}ms ease-in-out`,
      elegantSpin: `elegantSpin ${duration}ms ease-in-out`,
      elegantTailWave: `elegantTailWave ${duration}ms ease-in-out`,
      elegantBow: `elegantBow ${duration}ms ease-in-out`,

      // 搞笑动作动画
      funnyFall: `funnyFall ${duration}ms ease-in-out`,
      tailTangle: `tailTangle ${duration}ms ease-in-out`,
      earCramp: `earCramp ${duration}ms ease-in-out`,
      funnyWiggle: `funnyWiggle ${duration}ms ease-in-out`,
      funnyTailWag: `funnyTailWag ${duration}ms ease-in-out`,
      funnyEarTwitch: `funnyEarTwitch ${duration}ms ease-in-out`,
      funnyJump: `funnyJump ${duration}ms ease-in-out`,
      funnyTailCurl: `funnyTailCurl ${duration}ms ease-in-out`,
      funnyEarsPerk: `funnyEarsPerk ${duration}ms ease-in-out`,
      funnySpin: `funnySpin ${duration}ms ease-in-out`,
      funnyTailWave: `funnyTailWave ${duration}ms ease-in-out`,
      funnyBow: `funnyBow ${duration}ms ease-in-out`,

      // 特殊效果动画
      starTwinkle: `starTwinkle ${duration}ms ease-in-out`,
      rainbowHalo: `rainbowHalo ${duration}ms ease-in-out`,
      bubbleFloat: `bubbleFloat ${duration}ms ease-in-out`,
      heartFloat: `heartFloat ${duration}ms ease-in-out`,
      snowFall: `snowFall ${duration}ms ease-in-out`,
      petalShower: `petalShower ${duration}ms ease-in-out`,
      flashEffect: `flashEffect ${duration}ms ease-in-out`,
      colorShift: `colorShift ${duration}ms ease-in-out`,
      shadowClone: `shadowClone ${duration}ms ease-in-out`,
      transparentEffect: `transparentEffect ${duration}ms ease-in-out`,
      scalePulse: `scalePulse ${duration}ms ease-in-out`,
      spinEffect: `spinEffect ${duration}ms ease-in-out`
    }

    return animations[animationName] || `gentleNod ${duration}ms ease-in-out`
  }
}

// 扩展动画系统的其他方法
AdvancedAnimationSystem.prototype.enhanceWith72Actions = function () {
  // 添加心情变化监听
  const originalSetMood = this.setMood
  this.setMood = function (newMood) {
    originalSetMood.call(this, newMood)
    this.applyMoodClass(newMood)
  }

  // 添加心情CSS类
  this.applyMoodClass = function (mood) {
    // 移除所有心情类
    this.cat.classList.remove('mood-happy', 'mood-excited', 'mood-playful', 'mood-curious', 'mood-sleepy')
    // 添加当前心情类
    this.cat.classList.add(`mood-${mood}`)
  }

  // 增强庆祝方法
  const originalCelebrate = this.celebrate
  this.celebrate = function () {
    originalCelebrate.call(this)

    // 随机选择3-5种庆祝动作连续播放
    const celebrationActions = [...this.injectedAnimations.lively, ...this.injectedAnimations.special]

    const numActions = Math.floor(Math.random() * 3) + 3 // 3-5个动作
    for (let i = 0; i < numActions; i++) {
      setTimeout(() => {
        const randomAction = celebrationActions[Math.floor(Math.random() * celebrationActions.length)]
        this.playEnhancedAnimation(randomAction)
      }, i * 800) // 每个动作间隔800ms
    }
  }

  // 增强问候方法
  const originalGreet = this.greet
  this.greet = function () {
    originalGreet.call(this)

    // 播放欢迎动作序列
    const greetingSequence = [
      { action: this.injectedAnimations.basic[0], delay: 300 }, // 轻微点头
      { action: this.injectedAnimations.cute[1], delay: 600 }, // 眨眼卖萌
      { action: this.injectedAnimations.elegant[11], delay: 900 } // 优雅鞠躬
    ]

    greetingSequence.forEach(({ action, delay }) => {
      setTimeout(() => {
        this.playEnhancedAnimation(action)
      }, delay)
    })
  }

  // 增强思考方法
  const originalThinking = this.thinking
  this.thinking = function () {
    originalThinking.call(this)

    // 思考时的特殊动作
    const thinkingActions = [
      this.injectedAnimations.basic[5], // 好奇歪头
      this.injectedAnimations.basic[0], // 轻微点头
      this.injectedAnimations.elegant[2] // 优雅耳朵抖动
    ]

    thinkingActions.forEach((action, index) => {
      setTimeout(() => {
        this.playEnhancedAnimation(action)
      }, index * 1200)
    })
  }

  // 添加智能动作序列系统
  this.setupSmartActionSequences()
}

// 设置智能动作序列
AdvancedAnimationSystem.prototype.setupSmartActionSequences = function () {
  this.actionSequences = {
    greeting: [
      this.injectedAnimations.basic[0], // 轻微点头
      this.injectedAnimations.cute[1], // 眨眼卖萌
      this.injectedAnimations.elegant[11] // 优雅鞠躬
    ],

    celebration: [
      this.injectedAnimations.lively[0], // 兴奋跳跃
      this.injectedAnimations.special[0], // 星光闪烁
      this.injectedAnimations.funny[4] // 搞笑尾巴摆动
    ],

    thinking: [
      this.injectedAnimations.basic[5], // 好奇歪头
      this.injectedAnimations.elegant[2], // 优雅耳朵抖动
      this.injectedAnimations.basic[0] // 轻微点头
    ],

    listening: [
      this.injectedAnimations.basic[5], // 好奇歪头
      this.injectedAnimations.basic[3], // 尾巴轻摇
      this.injectedAnimations.elegant[2] // 优雅耳朵抖动
    ]
  }

  // 播放智能动作序列
  this.playActionSequence = function (sequenceName) {
    const sequence = this.actionSequences[sequenceName]
    if (!sequence) return

    sequence.forEach((action, index) => {
      setTimeout(() => {
        this.playEnhancedAnimation(action)
      }, index * 800)
    })
  }
}

if (!window.smartCat) window.smartCat = {}

module.exports = async params => {
  window.smartCat.animation = new AdvancedAnimationSystem(window.smartCat.catContainer)
  setTimeout(() => {
    window.smartCat.animation.greet()
  }, 100)
}
