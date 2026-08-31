/**
 * 动画系统（移植自 SmartCatAnimation.js AdvancedAnimationSystem + 72 小动作注入）
 * 铁律 9 收敛：一次性动画通过 CSS 变量驱动（styles.css `.bz-sc-anim` 承载体，
 * JS 只设 --bz-sc-anim-name/--bz-sc-anim-dur——动态时间参数）；循环动画（基础）
 * 用 styles.css 组合类（.bz-sc-anim-base 等）。keyframes 全静态。
 *
 * 2026-08-31 变更：去掉动画心情系统（AnimMood 状态机 / bz-sc-mood-* 组合类——
 * PAD 数据心情基本不变，视觉心情无意义）；原心情动画 keyframes 保留并进随机池
 * （happyBounce/curiousLook/sleepySway/excitedVibrate/playfulHop 作为普通动作随机触发）；
 * 新增多部件组合动作（playMultiPartAnimation，一个动作同时驱动 body+tail+ears+eyes）。
 * 原版死代码（enhanceWith72Actions/setupSmartActionSequences/setupAdvancedSkinAnimations）
 * 无调用点 → 不移植（spec 决策）。
 */
export type AnimPart = 'body' | 'eyes' | 'ears' | 'tail' | 'head' | 'paws';

export interface InjectedAction {
  name: string;
  part: AnimPart;
  animation: string;
  duration: number;
  /** 多部件组合动作（同时驱动多个部件；设置后 part 为示意主部件，parts 全量生效） */
  parts?: Array<{ part: AnimPart; animation: string }>;
}

/** 全动作池（含原 72 小动作 + 原心情动画 + 新增组合动作）；随机调度从此池抽取 */
export function getAllActions(): InjectedAction[] {
  return [
    ...INJECTED_ACTIONS.basic,
    ...INJECTED_ACTIONS.cute,
    ...INJECTED_ACTIONS.lively,
    ...INJECTED_ACTIONS.elegant,
    ...INJECTED_ACTIONS.funny,
    ...INJECTED_ACTIONS.special,
    ...MOOD_ACTIONS,
    ...COMBO_ACTIONS,
  ];
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

/** 原心情动画（去心情状态机后保留为随机池普通动作；keyframes 已存在 styles.css） */
export const MOOD_ACTIONS: InjectedAction[] = [
  { name: '开心蹦跳', part: 'body', animation: 'happyBounce', duration: 2000 },
  { name: '好奇张望', part: 'body', animation: 'curiousLook', duration: 1500 },
  { name: '困倦摇晃', part: 'body', animation: 'sleepySway', duration: 2500 },
  { name: '兴奋抖动', part: 'body', animation: 'excitedVibrate', duration: 1000 },
  { name: '欢快跳跃', part: 'body', animation: 'playfulHop', duration: 1800 },
];

/** 多部件组合动作（原心情状态机删除后新增；一个动作同时驱动多个部件） */
export const COMBO_ACTIONS: InjectedAction[] = [
  {
    name: '组合跳跃', part: 'body', animation: 'comboJump', duration: 900,
    parts: [
      { part: 'body', animation: 'comboJump' },
      { part: 'tail', animation: 'comboJumpTail' },
      { part: 'ears', animation: 'comboJumpEars' },
    ],
  },
  {
    name: '开心转圈', part: 'body', animation: 'comboHappySpin', duration: 1400,
    parts: [
      { part: 'body', animation: 'comboHappySpin' },
      { part: 'tail', animation: 'comboHappySpinTail' },
      { part: 'eyes', animation: 'comboHappySpinEyes' },
    ],
  },
  {
    name: '伸懒腰', part: 'body', animation: 'comboYawn', duration: 1300,
    parts: [
      { part: 'body', animation: 'comboYawn' },
      { part: 'eyes', animation: 'comboYawnEyes' },
      { part: 'tail', animation: 'comboYawnTail' },
    ],
  },
  {
    name: '左右张望', part: 'body', animation: 'comboLookAround', duration: 1200,
    parts: [
      { part: 'body', animation: 'comboLookAround' },
      { part: 'ears', animation: 'comboLookAroundEars' },
      { part: 'eyes', animation: 'comboLookAroundEyes' },
    ],
  },
  {
    name: '蹭蹭屏幕', part: 'body', animation: 'comboPurr', duration: 1100,
    parts: [
      { part: 'body', animation: 'comboPurr' },
      { part: 'tail', animation: 'comboPurrTail' },
      { part: 'eyes', animation: 'comboPurrEyes' },
    ],
  },
  {
    name: '受惊跳起', part: 'body', animation: 'comboStartle', duration: 700,
    parts: [
      { part: 'body', animation: 'comboStartle' },
      { part: 'ears', animation: 'comboStartleEars' },
      { part: 'eyes', animation: 'comboStartleEyes' },
    ],
  },
  {
    name: '伸展前爪', part: 'body', animation: 'comboStretchArms', duration: 1100,
    parts: [
      { part: 'body', animation: 'comboStretchArms' },
      { part: 'tail', animation: 'comboStretchArmsTail' },
    ],
  },
  {
    name: '扑跃玩耍', part: 'body', animation: 'comboPlayfulPounce', duration: 850,
    parts: [
      { part: 'body', animation: 'comboPlayfulPounce' },
      { part: 'tail', animation: 'comboPlayfulPounceTail' },
      { part: 'ears', animation: 'comboPlayfulPounceEars' },
    ],
  },
  {
    name: '打盹', part: 'body', animation: 'comboSleepyDozing', duration: 1600,
    parts: [
      { part: 'body', animation: 'comboSleepyDozing' },
      { part: 'eyes', animation: 'comboSleepyDozingEyes' },
      { part: 'tail', animation: 'comboSleepyDozingTail' },
    ],
  },
  {
    name: '好奇探头', part: 'body', animation: 'comboCuriousPeek', duration: 1000,
    parts: [
      { part: 'body', animation: 'comboCuriousPeek' },
      { part: 'head', animation: 'comboCuriousPeekHead' },
      { part: 'ears', animation: 'comboCuriousPeekEars' },
    ],
  },
  {
    name: '打滚', part: 'body', animation: 'comboRollOver', duration: 1500,
    parts: [
      { part: 'body', animation: 'comboRollOver' },
      { part: 'tail', animation: 'comboRollOverTail' },
      { part: 'eyes', animation: 'comboRollOverEyes' },
    ],
  },
  {
    name: '庆祝跳跃', part: 'body', animation: 'comboCelebrate', duration: 1200,
    parts: [
      { part: 'body', animation: 'comboCelebrate' },
      { part: 'tail', animation: 'comboCelebrateTail' },
      { part: 'ears', animation: 'comboCelebrateEars' },
    ],
  },
];

export class SmartCatAnimation {
  cat: HTMLElement;
  body: HTMLElement;
  eyes: HTMLElement[];
  ears: HTMLElement[];
  tail: HTMLElement;
  face: HTMLElement;
  animationQueue: { animationName: string; duration: number }[] = [];
  isBusy = false;
  lastInteraction = Date.now();
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
      if (this.isBusy) return;
      if (Math.random() < 0.3) this.triggerRandomAction();
    }, 8000);
  }

  /** 整身一次性动画（原 playAnimation：busy 排队（blinkQuick 例外）→ none+重绘 → 应用 → duration 后恢复基础动画 + 播队内下一支） */
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
      this.setBaseAnimations();
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

  /** 多部件组合动画（一个动作同时驱动多个部件：body 主动画 + 各部件子动画，统一时长） */
  playMultiPartAnimation(parts: Array<{ part: AnimPart; animation: string }>, duration = 1000): void {
    if (this.isBusy) return;
    this.isBusy = true;
    const applied: HTMLElement[] = [];
    parts.forEach(({ part, animation }) => {
      this.getActionElements(part).forEach((element) => {
        element.classList.add('bz-sc-anim');
        (element as any).style.setProperty('--bz-sc-anim-name', animation);
        (element as any).style.setProperty('--bz-sc-anim-dur', duration + 'ms');
        void (element as HTMLElement).offsetWidth;
        applied.push(element);
      });
    });
    const t = setTimeout(() => {
      applied.forEach((element) => {
        element.classList.remove('bz-sc-anim');
        (element as any).style.removeProperty('--bz-sc-anim-name');
        (element as any).style.removeProperty('--bz-sc-anim-dur');
      });
      this.isBusy = false;
    }, duration);
    this.pendingTimeouts.push(t);
  }

  /** 交互监听（原 setupInteractions：hover 刷新/attentionPulse、leave 刷新、click cat-body→excitedWiggle+50%耳动） */
  setupInteractions(): void {
    this.cat.addEventListener('mouseenter', () => {
      this.lastInteraction = Date.now();
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
        if (Math.random() < 0.5) {
          const t = setTimeout(() => {
            this.playPartAnimation('ears', Math.random() < 0.5 ? 'earFlickLeft' : 'earFlickRight', 600);
          }, 300);
          this.pendingTimeouts.push(t);
        }
      }
    });
  }

  /** 特殊场合（原 celebrate/greet/surprise/startListening/stopListening/thinking；无调用点的五个已随清理移除） */
  greet(): void { this.playAnimation('greetingBow', 1200); }

  // ---------- 全动作池（72 小动作 + 心情动画 + 组合动作） ----------

  /** 增强随机调度（原 startEnhancedRandomActions：6s；去心情后固定 40% 概率） */
  startEnhancedRandomActions(): void {
    if (this.enhancedTimer) clearInterval(this.enhancedTimer);
    this.enhancedTimer = setInterval(() => {
      if (this.isBusy) return;
      if (Math.random() < 0.4) this.triggerEnhancedRandomAction();
    }, 6000);
  }

  /** 触发增强动作（从全动作池抽一支；组合动作走多部件播放） */
  triggerEnhancedRandomAction(): void {
    const pool = getAllActions();
    if (!pool.length) return;
    const randomAction = pool[Math.floor(Math.random() * pool.length)];
    if (randomAction.parts?.length) {
      this.playMultiPartAnimation(randomAction.parts, randomAction.duration);
    } else {
      this.playEnhancedAnimation(randomAction);
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
    if (this.randomTimer) clearInterval(this.randomTimer);
    if (this.enhancedTimer) clearInterval(this.enhancedTimer);
    this.randomTimer = this.enhancedTimer = null;
    for (const t of this.pendingTimeouts) clearTimeout(t);
    this.pendingTimeouts = [];
    this.animationQueue = [];
    this.isBusy = false;
  }
}