/**
 * 动画系统（移植自 SmartCatAnimation.js AdvancedAnimationSystem + 72 小动作注入）
 * 铁律 9 收敛：一次性动画通过 CSS 变量驱动（styles.css `.bz-sc-anim` 承载体，
 * JS 只设 --bz-sc-anim-name/--bz-sc-anim-dur——动态时间参数）；循环动画（心情/基础）
 * 用 styles.css 组合类（.bz-sc-anim-base/.bz-sc-mood-happy 等）。156 keyframes 全静态。
 * 原版死代码（enhanceWith72Actions/setupSmartActionSequences/setupAdvancedSkinAnimations）
 * 无调用点 → 不移植（spec 决策）。
 */
export type AnimPart = 'body' | 'eyes' | 'ears' | 'tail' | 'head' | 'paws';

export interface InjectedAction {
  name: string;
  part: AnimPart;
  animation: string;
  duration: number;
}

/** 72 小动作表（原注入对象逐字：6 类 × 12） */
export const INJECTED_ACTIONS: Record<string, InjectedAction[]> = {
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
    { name: '身体轻晃', part: 'body', animation: 'bodySway', duration: 1100 },
  ],
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
    { name: '爪子轻拍', part: 'paws', animation: 'pawPat', duration: 800 },
  ],
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
    { name: '身体兴奋颤抖', part: 'body', animation: 'excitedShiver', duration: 400 },
  ],
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
    { name: '身体优雅鞠躬', part: 'body', animation: 'elegantBow', duration: 1200 },
  ],
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
    { name: '身体搞笑鞠躬', part: 'body', animation: 'funnyBow', duration: 1200 },
  ],
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
    { name: '旋转特效', part: 'body', animation: 'spinEffect', duration: 900 },
  ],
};

/** 皮肤动画表（原 setupAdvancedSkinAnimations 的皮肤动画组合；现由 styles.css .bz-sc-skin-* 承担，此处仅作为测试数据源导出） */
export const SKIN_ANIMATIONS: Record<string, { body: string; tail: string; eyes?: string; ears?: string }> = {
  neon: { body: 'neonDance 4s ease-in-out infinite, glowEffect 3s ease-in-out infinite', tail: 'neonDance 2s ease-in-out infinite', eyes: 'blinkQuick 2s ease-in-out infinite, glowEffect 4s ease-in-out infinite' },
  galaxy: { body: 'floatGracefully 6s ease-in-out infinite', tail: 'tailSwish 4s ease-in-out infinite', ears: 'earsTwitch 5s ease-in-out infinite' },
  fire: { body: 'fireFlicker 2s ease-in-out infinite, excitedVibrate 3s ease-in-out infinite', tail: 'tailFlick 1.5s ease-in-out infinite', eyes: 'eyesSparkle 3s ease-in-out infinite' },
  liquidMetal: { body: 'shimmer 4s linear infinite, gentleSway 5s ease-in-out infinite', tail: 'tailSwish 3s ease-in-out infinite' },
  crystal: { body: 'glowEffect 5s ease-in-out infinite, breathing 4s ease-in-out infinite', tail: 'tailSwish 3s ease-in-out infinite', eyes: 'blinkSlow 4s ease-in-out infinite, eyesSparkle 6s ease-in-out infinite' },
};

export type AnimMood = 'content' | 'happy' | 'curious' | 'sleepy' | 'excited' | 'playful';

export class SmartCatAnimation {
  cat: HTMLElement;
  body: HTMLElement;
  eyes: HTMLElement[];
  ears: HTMLElement[];
  tail: HTMLElement;
  face: HTMLElement;
  animationQueue: { animationName: string; duration: number }[] = [];
  isBusy = false;
  mood: AnimMood = 'content';
  lastInteraction = Date.now();
  private stateTimer: ReturnType<typeof setInterval> | null = null;
  private randomTimer: ReturnType<typeof setInterval> | null = null;
  private enhancedTimer: ReturnType<typeof setInterval> | null = null;
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(catElement: HTMLElement) {
    this.cat = catElement;
    this.body = catElement.querySelector('#cat-body') as HTMLElement;
    this.eyes = Array.from(catElement.querySelectorAll('.cat-eye'));
    this.ears = Array.from(catElement.querySelectorAll('.cat-ear'));
    this.tail = catElement.querySelector('.cat-tail') as HTMLElement;
    this.face = catElement.querySelector('.cat-face') as HTMLElement;
  }

  initialize(): void {
    this.setBaseAnimations();
    this.startStateLoop();
    this.setupInteractions();
    this.startRandomActions();
    this.startEnhancedRandomActions();
  }

  /** 基础循环动画（原 setBaseAnimations：body breathing+gentleSway / ear earsTwitch / tail tailFlick / eye blinkSlow） */
  setBaseAnimations(): void {
    this.body.classList.add('bz-sc-anim-base');
    this.ears.forEach((ear) => ear.classList.add('bz-sc-anim-ear-base'));
    this.tail.classList.add('bz-sc-anim-tail-base');
    this.eyes.forEach((eye) => eye.classList.add('bz-sc-anim-eye-base'));
  }

  /** 清掉所有一次性动画类/变量（回到组合类空间） */
  clearOneShot(): void {
    this.body.classList.remove('bz-sc-anim');
    this.eyes.forEach((e) => e.classList.remove('bz-sc-anim'));
    this.ears.forEach((e) => e.classList.remove('bz-sc-anim'));
    this.tail.classList.remove('bz-sc-anim');
    this.face.classList.remove('bz-sc-anim');
  }

  /** 状态循环（原 startStateLoop：5s 检查；30s 无互动→sleepy、5s 内有→excited、10% 随机换） */
  startStateLoop(): void {
    if (this.stateTimer) clearInterval(this.stateTimer);
    this.stateTimer = setInterval(() => this.updateState(), 5000);
  }

  updateState(): void {
    const now = Date.now();
    const timeSinceLastInteraction = now - this.lastInteraction;
    if (timeSinceLastInteraction > 30000 && this.mood !== 'sleepy') {
      if (Math.random() < 0.3) this.setMood('sleepy');
    } else if (timeSinceLastInteraction < 5000 && this.mood !== 'excited') {
      if (Math.random() < 0.4) this.setMood('excited');
    }
    if (Math.random() < 0.1) {
      const moods: AnimMood[] = ['content', 'happy', 'curious', 'playful'];
      const randomMood = moods[Math.floor(Math.random() * moods.length)];
      if (randomMood !== this.mood) this.setMood(randomMood);
    }
  }

  /** 心情切换（原 setMood：写 mood + 组合类 + 触发一次性动画） */
  setMood(newMood: AnimMood): void {
    this.mood = newMood;
    this.applyMoodAnimations();
    switch (newMood) {
      case 'happy': this.playAnimation('happyBounce', 2000); break;
      case 'curious': this.playAnimation('curiousLook', 1500); break;
      case 'sleepy': this.playAnimation('sleepySway', 2500); break;
      case 'excited': this.playAnimation('excitedVibrate', 1000); break;
      case 'playful': this.playAnimation('playfulHop', 1800); break;
    }
  }

  /** 心情组合类切换（原 applyMoodAnimations：styles.css .bz-sc-mood-* 承担组合） */
  applyMoodAnimations(): void {
    this.body.classList.remove('bz-sc-mood-happy', 'bz-sc-mood-curious', 'bz-sc-mood-sleepy', 'bz-sc-mood-excited', 'bz-sc-mood-playful');
    if (this.mood === 'content') {
      this.setBaseAnimations();
      return;
    }
    this.body.classList.add(`bz-sc-mood-${this.mood}`);
  }

  /** 随机小动作（原 triggerRandomAction 5 选 1） */
  triggerRandomAction(): void {
    const actions = [
      { name: 'earFlickLeft', part: 'ears' as AnimPart, duration: 800 },
      { name: 'earFlickRight', part: 'ears' as AnimPart, duration: 800 },
      { name: 'tailFlick', part: 'tail' as AnimPart, duration: 1000 },
      { name: 'contentStretch', part: 'body' as AnimPart, duration: 1200 },
      { name: 'blinkQuick', part: 'eyes' as AnimPart, duration: 500 },
    ];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    this.playPartAnimation(randomAction.part, randomAction.name, randomAction.duration);
  }

  /** 随机动作调度（原 startRandomActions：8s，30% 概率） */
  startRandomActions(): void {
    if (this.randomTimer) clearInterval(this.randomTimer);
    this.randomTimer = setInterval(() => {
      if (this.isBusy || this.mood === 'sleepy') return;
      if (Math.random() < 0.3) this.triggerRandomAction();
    }, 8000);
  }

  /** 整身一次性动画（原 playAnimation：busy 排队（blinkQuick 例外）→ none+重绘 → 应用 → duration 后恢复心情动画 + 播队内下一支） */
  playAnimation(animationName: string, duration = 1000): void {
    if (this.isBusy && animationName !== 'blinkQuick') {
      this.animationQueue.push({ animationName, duration });
      return;
    }
    this.isBusy = true;
    this.clearOneShot();
    this.body.classList.add('bz-sc-anim');
    (this.body as any).style.setProperty('--bz-sc-anim-name', animationName);
    (this.body as any).style.setProperty('--bz-sc-anim-dur', duration + 'ms');
    void this.body.offsetWidth;
    const t = setTimeout(() => {
      this.isBusy = false;
      this.clearOneShot();
      this.applyMoodAnimations();
      if (this.animationQueue.length > 0) {
        const next = this.animationQueue.shift()!;
        const t2 = setTimeout(() => this.playAnimation(next.animationName, next.duration), 200);
        this.pendingTimeouts.push(t2);
      }
    }, duration);
    this.pendingTimeouts.push(t);
  }

  /** 局部部件动画（原 playPartAnimation：保存原动画类 → 一次性 → 恢复） */
  playPartAnimation(part: AnimPart, animationName: string, duration = 1000): void {
    const elements = part === 'ears' ? this.ears : part === 'eyes' ? this.eyes : part === 'tail' ? [this.tail] : part === 'head' ? [this.face] : [this.body];
    elements.forEach((element) => {
      element.classList.add('bz-sc-anim');
      (element as any).style.setProperty('--bz-sc-anim-name', animationName);
      (element as any).style.setProperty('--bz-sc-anim-dur', duration + 'ms');
      void (element as HTMLElement).offsetWidth;
      const t = setTimeout(() => {
        element.classList.remove('bz-sc-anim');
        (element as any).style.removeProperty('--bz-sc-anim-name');
        (element as any).style.removeProperty('--bz-sc-anim-dur');
      }, duration);
      this.pendingTimeouts.push(t);
    });
  }

  /** 交互监听（原 setupInteractions：hover 刷新/attentionPulse、leave 刷新、click cat-body→excitedWiggle+excited+50%耳动） */
  setupInteractions(): void {
    this.cat.addEventListener('mouseenter', () => {
      this.lastInteraction = Date.now();
      if (this.mood === 'sleepy') this.setMood('content');
      this.playAnimation('attentionPulse', 1500);
    });
    this.cat.addEventListener('mouseleave', () => {
      this.lastInteraction = Date.now();
    });
    this.cat.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest && target.closest('#cat-body')) {
        this.lastInteraction = Date.now();
        this.playAnimation('excitedWiggle', 800);
        this.setMood('excited');
        if (Math.random() < 0.5) {
          const t = setTimeout(() => {
            this.playPartAnimation(Math.random() < 0.5 ? 'ears' : 'ears', Math.random() < 0.5 ? 'earFlickLeft' : 'earFlickRight', 600);
          }, 300);
          this.pendingTimeouts.push(t);
        }
      }
    });
  }

  /** 特殊场合（原 celebrate/greet/surprise/startListening/stopListening/thinking） */
  celebrate(): void { this.playAnimation('celebrationDance', 2500); this.setMood('excited'); }
  greet(): void { this.playAnimation('greetingBow', 1200); this.setMood('happy'); }
  surprise(): void { this.playAnimation('surpriseJump', 1500); this.setMood('excited'); }
  startListening(): void { this.playAnimation('attentionPulse', 2000); this.setMood('curious'); }
  stopListening(): void { this.setMood('content'); }
  thinking(): void { this.playAnimation('curiousTilt', 1500); this.setMood('curious'); }

  // ---------- 72 小动作（增强版随机动作） ----------

  /** 增强随机调度（原 startEnhancedRandomActions：6s；mood 概率表） */
  startEnhancedRandomActions(): void {
    if (this.enhancedTimer) clearInterval(this.enhancedTimer);
    this.enhancedTimer = setInterval(() => {
      if (this.isBusy || this.mood === 'sleepy') return;
      let triggerProbability = 0.3;
      switch (this.mood) {
        case 'happy': triggerProbability = 0.5; break;
        case 'excited': triggerProbability = 0.6; break;
        case 'playful': triggerProbability = 0.7; break;
        case 'curious': triggerProbability = 0.4; break;
        case 'content': triggerProbability = 0.3; break;
      }
      if (Math.random() < triggerProbability) this.triggerEnhancedRandomAction();
    }, 6000);
  }

  /** 触发增强动作（原 triggerEnhancedRandomAction） */
  triggerEnhancedRandomAction(): void {
    const moodActions = this.getMoodAppropriateActions();
    if (!moodActions.length) return;
    const randomAction = moodActions[Math.floor(Math.random() * moodActions.length)];
    this.playEnhancedAnimation(randomAction);
  }

  /** 按心情筛选动作池（原 getMoodAppropriateActions 逐字） */
  getMoodAppropriateActions(): InjectedAction[] {
    const all = [...INJECTED_ACTIONS.basic, ...INJECTED_ACTIONS.cute, ...INJECTED_ACTIONS.lively, ...INJECTED_ACTIONS.elegant, ...INJECTED_ACTIONS.funny, ...INJECTED_ACTIONS.special];
    switch (this.mood) {
      case 'happy': return [...INJECTED_ACTIONS.cute, ...INJECTED_ACTIONS.lively, ...INJECTED_ACTIONS.special];
      case 'excited': return [...INJECTED_ACTIONS.lively, ...INJECTED_ACTIONS.funny, ...INJECTED_ACTIONS.special];
      case 'playful': return [...INJECTED_ACTIONS.funny, ...INJECTED_ACTIONS.lively, ...INJECTED_ACTIONS.cute];
      case 'curious': return [...INJECTED_ACTIONS.basic, ...INJECTED_ACTIONS.elegant];
      case 'sleepy': return INJECTED_ACTIONS.basic.filter((a) => a.duration < 1000);
      default: return all;
    }
  }

  /** 播放增强动画（原 playEnhancedAnimation：busy 直接 return，保存原类 → 一次性 → 恢复） */
  playEnhancedAnimation(action: InjectedAction): void {
    if (this.isBusy) return;
    this.isBusy = true;
    const elements = this.getActionElements(action.part);
    elements.forEach((element) => {
      element.classList.add('bz-sc-anim');
      (element as any).style.setProperty('--bz-sc-anim-name', action.animation);
      (element as any).style.setProperty('--bz-sc-anim-dur', action.duration + 'ms');
      void (element as HTMLElement).offsetWidth;
    });
    const t = setTimeout(() => {
      elements.forEach((element) => {
        element.classList.remove('bz-sc-anim');
        (element as any).style.removeProperty('--bz-sc-anim-name');
        (element as any).style.removeProperty('--bz-sc-anim-dur');
      });
      this.isBusy = false;
    }, action.duration);
    this.pendingTimeouts.push(t);
  }

  /** 动作元素映射（原 getActionElements：paws→body 模拟、head→face） */
  getActionElements(part: AnimPart): HTMLElement[] {
    switch (part) {
      case 'body': return [this.body];
      case 'eyes': return this.eyes;
      case 'ears': return this.ears;
      case 'tail': return [this.tail];
      case 'head': return [this.face];
      default: return [this.body];
    }
  }

  /** 卸载清理：清 interval + 挂起 timeout（原版无清理，移植必须补） */
  dispose(): void {
    if (this.stateTimer) clearInterval(this.stateTimer);
    if (this.randomTimer) clearInterval(this.randomTimer);
    if (this.enhancedTimer) clearInterval(this.enhancedTimer);
    this.stateTimer = this.randomTimer = this.enhancedTimer = null;
    for (const t of this.pendingTimeouts) clearTimeout(t);
    this.pendingTimeouts = [];
    this.animationQueue = [];
    this.isBusy = false;
  }
}