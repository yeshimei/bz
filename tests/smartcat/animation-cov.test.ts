/**
 * smartcat 动画系统覆盖率补测（原 SmartCatAnimation 移植）：
 * 部件查询/基础组合类、状态循环（30s 无互动→sleepy / 5s 内→excited / 10% 随机换心情）、
 * 整身一次性动画 busy 排队（blinkQuick 插队例外）、局部部件动画、
 * hover/click 交互监听、72 小动作池按心情筛选与增强随机调度、dispose 全量清理。
 * 纯 CSS 类/CSS 变量驱动（styles.css 承载视觉），断言只看类名与变量写入——不测渲染本身。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartCatAnimation, INJECTED_ACTIONS } from '../../src/smartcat/animation';

/** 构造带全部部件的猫容器 DOM */
function buildCat(): HTMLElement {
  const cat = document.createElement('div');
  cat.id = 'test-cat';
  cat.innerHTML = `
    <div id="cat-body"><span class="cat-body-inner"></span></div>
    <div class="cat-eye"></div><div class="cat-eye"></div>
    <div class="cat-ear"></div><div class="cat-ear"></div>
    <div class="cat-tail"></div>
    <div class="cat-face"></div>`;
  document.body.appendChild(cat);
  return cat;
}

/** 断言某元素当前承载一次性动画变量 */
function expectAnimVars(el: HTMLElement, name: string, dur: string): void {
  expect(el.style.getPropertyValue('--bz-sc-anim-name')).toBe(name);
  expect(el.style.getPropertyValue('--bz-sc-anim-dur')).toBe(dur);
}

let cat: HTMLElement;
let anim: SmartCatAnimation;

beforeEach(() => {
  vi.useFakeTimers();
  cat = buildCat();
  anim = new SmartCatAnimation(cat);
});

afterEach(() => {
  anim?.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('构造与基础动画', () => {
  it('构造器按选择器收集六类部件', () => {
    expect(anim.cat).toBe(cat);
    expect(anim.body.id).toBe('cat-body');
    expect(anim.eyes.length).toBe(2);
    expect(anim.ears.length).toBe(2);
    expect(anim.tail.classList.contains('cat-tail')).toBe(true);
    expect(anim.face.classList.contains('cat-face')).toBe(true);
    expect(anim.isBusy).toBe(false);
    expect(anim.mood).toBe('content');
  });

  it('setBaseAnimations：body/ears/tail/eyes 挂基础循环组合类', () => {
    anim.setBaseAnimations();
    expect(anim.body.classList.contains('bz-sc-anim-base')).toBe(true);
    anim.ears.forEach((e) => expect(e.classList.contains('bz-sc-anim-ear-base')).toBe(true));
    expect(anim.tail.classList.contains('bz-sc-anim-tail-base')).toBe(true);
    anim.eyes.forEach((e) => expect(e.classList.contains('bz-sc-anim-eye-base')).toBe(true));
  });

  it('clearOneShot：清掉所有部件上的一次性动画类', () => {
    [anim.body, ...anim.eyes, ...anim.ears, anim.tail, anim.face].forEach((el) => el.classList.add('bz-sc-anim'));
    anim.clearOneShot();
    [anim.body, ...anim.eyes, ...anim.ears, anim.tail, anim.face].forEach((el) => {
      expect(el.classList.contains('bz-sc-anim')).toBe(false);
    });
  });

  it('initialize：装配基础类 + 三组定时器；dispose 后定时器全停', () => {
    anim.initialize();
    expect(anim.body.classList.contains('bz-sc-anim-base')).toBe(true);
    // dispose 前状态循环活着：推进 5s 会跑 updateState（此处随机数固定大值 → 无变化）
    vi.advanceTimersByTime(5000);
    anim.dispose();
    const moodBefore = anim.mood;
    anim.lastInteraction = Date.now() - 40_000;
    vi.advanceTimersByTime(60_000); // 若 interval 未清，此刻必切 sleepy
    expect(anim.mood).toBe(moodBefore);
  });
});

describe('updateState 状态循环', () => {
  it('30s 无互动且随机命中 → 切 sleepy', () => {
    anim.lastInteraction = Date.now() - 40_000;
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.1); // < 0.3
    anim.updateState();
    expect(anim.mood).toBe('sleepy');
  });

  it('5s 内有互动且随机命中 → 切 excited', () => {
    anim.lastInteraction = Date.now() - 1_000;
    // 第一次随机：excited 门（<0.4）；第二次随机：10% 换档门（≥0.1 不触发）
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.2).mockReturnValueOnce(0.5);
    anim.updateState();
    expect(anim.mood).toBe('excited');
  });

  it('10% 随机换心情分支：抽到不同心情才切换', () => {
    anim.lastInteraction = Date.now() - 10_000; // 落在两阈值之间的静默区
    // 唯一一次门随机 <0.1 命中；选档随机 0 → moods[0]='content'
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.05).mockReturnValueOnce(0);
    anim.mood = 'happy';
    anim.updateState();
    expect(anim.mood).toBe('content');
  });

  it('10% 分支抽到相同心情 → 不重复切换；未命中概率则完全不动', () => {
    anim.mood = 'content';
    anim.lastInteraction = Date.now() - 10_000;
    // 未命中 10%：门随机大值
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.9);
    anim.updateState();
    expect(anim.mood).toBe('content');
    // 命中 10% 但抽到当前心情（moods[0]=content）
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.05).mockReturnValueOnce(0.1);
    anim.updateState();
    expect(anim.mood).toBe('content');
  });
});

describe('setMood / applyMoodAnimations 心情切换', () => {
  it.each([
    ['happy', 'happyBounce', 2000],
    ['curious', 'curiousLook', 1500],
    ['sleepy', 'sleepySway', 2500],
    ['excited', 'excitedVibrate', 1000],
    ['playful', 'playfulHop', 1800],
  ] as const)('%s → 组合类 + 对应一次性动画', (mood, animationName, duration) => {
    anim.setMood(mood);
    expect(anim.mood).toBe(mood);
    expect(anim.body.classList.contains(`bz-sc-mood-${mood}`)).toBe(true);
    expectAnimVars(anim.body, animationName, duration + 'ms');
  });

  it('content → 回基础组合类，不带任何心情类，也无一次性动画', () => {
    anim.setMood('happy');
    anim.setMood('content');
    expect(anim.body.className).not.toContain('bz-sc-mood-');
    expect(anim.body.classList.contains('bz-sc-anim-base')).toBe(true);
  });
});

describe('playAnimation 整身一次性动画（busy 排队）', () => {
  it('空闲播放：写 CSS 变量挂一次性类，duration 后清理并恢复心情动画', () => {
    anim.playAnimation('greetingBow', 1200);
    expect(anim.isBusy).toBe(true);
    expectAnimVars(anim.body, 'greetingBow', '1200ms');
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(anim.isBusy).toBe(false);
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(false);
  });

  it('busy 时入队等待；结束后按序播队首（间隔 200ms）', () => {
    anim.playAnimation('first', 500);
    anim.playAnimation('second', 300); // 入队
    expectAnimVars(anim.body, 'first', '500ms'); // 仍播第一支
    vi.advanceTimersByTime(500);
    // 队首取出后延迟 200ms 才开播
    expect(anim.isBusy).toBe(false);
    vi.advanceTimersByTime(200);
    expect(anim.isBusy).toBe(true);
    expectAnimVars(anim.body, 'second', '300ms');
    vi.advanceTimersByTime(300);
    expect(anim.isBusy).toBe(false);
  });

  it('blinkQuick 插队例外：busy 时立即执行不打断排队能力', () => {
    anim.playAnimation('long', 800);
    anim.playAnimation('queuedNext', 200);
    anim.playAnimation('blinkQuick', 100); // 例外路径：直接应用
    expectAnimVars(anim.body, 'blinkQuick', '100ms');
    vi.advanceTimersByTime(800 + 200 + 300); // 主动画与排队链全部走完
    expect(anim.animationQueue.length).toBe(0);
  });
});

describe('playPartAnimation 局部部件动画', () => {
  it.each([
    ['ears', () => anim.ears],
    ['eyes', () => anim.eyes],
    ['tail', () => [anim.tail]],
    ['head', () => [anim.face]],
    ['body', () => [anim.body]],
  ] as const)('%s 部件：加一次性类与变量，duration 后还原', (part, getEls) => {
    anim.playPartAnimation(part, 'partWave', 400);
    for (const el of getEls()) {
      expect(el.classList.contains('bz-sc-anim')).toBe(true);
      expectAnimVars(el, 'partWave', '400ms');
    }
    vi.advanceTimersByTime(400);
    for (const el of getEls()) {
      expect(el.classList.contains('bz-sc-anim')).toBe(false);
      expect(el.style.getPropertyValue('--bz-sc-anim-name')).toBe('');
    }
  });

  it('triggerRandomAction：五选一池内动作落到对应部件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // index 2 = tailFlick(tail)
    anim.triggerRandomAction();
    expectAnimVars(anim.tail, 'tailFlick', '1000ms');
  });
});

describe('setupInteractions 交互监听', () => {
  it('mouseenter：刷新互动时间 + attentionPulse；sleepy 中被唤醒为 content', () => {
    anim.initialize();
    anim.mood = 'sleepy';
    const before = anim.lastInteraction;
    vi.advanceTimersByTime(100);
    cat.dispatchEvent(new Event('mouseenter'));
    expect(anim.lastInteraction).toBeGreaterThan(before);
    expect(anim.mood).toBe('content');
    expectAnimVars(anim.body, 'attentionPulse', '1500ms');
  });

  it('mouseleave：仅刷新互动时间', () => {
    anim.initialize();
    const before = anim.lastInteraction;
    vi.advanceTimersByTime(50);
    cat.dispatchEvent(new Event('mouseleave'));
    expect(anim.lastInteraction).toBeGreaterThan(before);
  });

  it('click 命中 #cat-body：excitedWiggle + excited 心情；50% 命中补耳朵抖动', () => {
    anim.initialize();
    const inner = cat.querySelector('.cat-body-inner')!;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.5 触发耳动；后续取左耳
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expectAnimVars(anim.body, 'excitedWiggle', '800ms');
    expect(anim.mood).toBe('excited');
    vi.advanceTimersByTime(300); // 耳动延时到期
    const ear = anim.ears[0];
    expect(['earFlickLeft', 'earFlickRight']).toContain(ear.style.getPropertyValue('--bz-sc-anim-name'));
  });

  it('click 目标不在 #cat-body：无动画无心情变化', () => {
    anim.initialize();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    cat.dispatchEvent(new MouseEvent('click', { bubbles: true })); // target=cat 本体，非 body 内
    expect(anim.mood).toBe('content');
    expect(anim.body.style.getPropertyValue('--bz-sc-anim-name')).toBe('');
  });

  it('greet：greetingBow + happy 心情（ensure 后问候入口）', () => {
    anim.greet();
    expectAnimVars(anim.body, 'greetingBow', '1200ms');
    expect(anim.mood).toBe('happy');
  });
});

describe('72 小动作（增强随机）', () => {
  it('INJECTED_ACTIONS 六类各 12 条', () => {
    for (const key of Object.keys(INJECTED_ACTIONS)) {
      expect(INJECTED_ACTIONS[key].length).toBe(12);
    }
  });

  it('getMoodAppropriateActions 按心情筛选；sleepy 只留短动作；默认全量', () => {
    anim.mood = 'happy';
    expect(anim.getMoodAppropriateActions().every((a) => [...INJECTED_ACTIONS.cute, ...INJECTED_ACTIONS.lively, ...INJECTED_ACTIONS.special].includes(a))).toBe(true);
    anim.mood = 'excited';
    expect(anim.getMoodAppropriateActions().length).toBe(36);
    anim.mood = 'playful';
    expect(anim.getMoodAppropriateActions().length).toBe(36);
    anim.mood = 'curious';
    expect(anim.getMoodAppropriateActions().length).toBe(24);
    anim.mood = 'sleepy';
    const sleepyPool = anim.getMoodAppropriateActions();
    expect(sleepyPool.length).toBeGreaterThan(0);
    expect(sleepyPool.every((a) => a.duration < 1000)).toBe(true);
    anim.mood = 'content';
    expect(anim.getMoodAppropriateActions().length).toBe(72);
  });

  it('getActionElements 部件映射（含非法值兜底 body）', () => {
    expect(anim.getActionElements('body')).toEqual([anim.body]);
    expect(anim.getActionElements('eyes')).toEqual(anim.eyes);
    expect(anim.getActionElements('ears')).toEqual(anim.ears);
    expect(anim.getActionElements('tail')).toEqual([anim.tail]);
    expect(anim.getActionElements('head')).toEqual([anim.face]);
    expect(anim.getActionElements('nope' as any)).toEqual([anim.body]);
  });

  it('playEnhancedAnimation：busy 直接跳过；空闲应用并在 duration 后清理复位', () => {
    const action = INJECTED_ACTIONS.basic[1]; // quickBlink / eyes / 300ms
    anim.isBusy = true;
    anim.playEnhancedAnimation(action);
    expect(anim.eyes[0].classList.contains('bz-sc-anim')).toBe(false); // busy 早退
    anim.isBusy = false;
    anim.playEnhancedAnimation(action);
    expectAnimVars(anim.eyes[0], 'quickBlink', '300ms');
    vi.advanceTimersByTime(300);
    expect(anim.eyes[0].classList.contains('bz-sc-anim')).toBe(false);
    expect(anim.isBusy).toBe(false);
  });

  it('triggerEnhancedRandomAction：从当前心情池抽一支播放', () => {
    anim.mood = 'curious'; // 池 = basic + elegant
    vi.spyOn(Math, 'random').mockReturnValue(0); // 取池第一支
    anim.triggerEnhancedRandomAction();
    const pool = [...INJECTED_ACTIONS.basic, ...INJECTED_ACTIONS.elegant];
    expect(anim.body.style.getPropertyValue('--bz-sc-anim-name')).toBe(pool[0].animation);
  });

  it('startEnhancedRandomActions 定时调度：mood 概率表生效，busy/sleepy 跳过', () => {
    // 只启动本调度（不 initialize，排除 5s 状态循环改写 mood 的干扰）
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // 恒触发
    anim.mood = 'playful';
    vi.spyOn(anim, 'triggerEnhancedRandomAction');
    anim.startEnhancedRandomActions();
    vi.advanceTimersByTime(6000);
    expect(anim.triggerEnhancedRandomAction).toHaveBeenCalledTimes(1);
    // sleepy：不触发
    anim.mood = 'sleepy';
    vi.advanceTimersByTime(6000);
    expect(anim.triggerEnhancedRandomAction).toHaveBeenCalledTimes(1);
    // isBusy：不触发
    anim.mood = 'playful';
    anim.isBusy = true;
    vi.advanceTimersByTime(6000);
    expect(anim.triggerEnhancedRandomAction).toHaveBeenCalledTimes(1);
  });

  it('startRandomActions 定时调度：8s tick、30% 概率、busy/sleepy 守卫', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    vi.spyOn(anim, 'triggerRandomAction');
    anim.startRandomActions();
    // sleepy 不触发
    anim.mood = 'sleepy';
    vi.advanceTimersByTime(8000);
    expect(anim.triggerRandomAction).not.toHaveBeenCalled();
    // isBusy 不触发
    anim.mood = 'content';
    anim.isBusy = true;
    vi.advanceTimersByTime(8000);
    expect(anim.triggerRandomAction).not.toHaveBeenCalled();
    // 空闲 + 概率命中 → 触发
    anim.isBusy = false;
    vi.advanceTimersByTime(8000);
    expect(anim.triggerRandomAction).toHaveBeenCalledTimes(1);
    // 概率未命中 → 不触发
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.advanceTimersByTime(8000);
    expect(anim.triggerRandomAction).toHaveBeenCalledTimes(1);
  });
});
