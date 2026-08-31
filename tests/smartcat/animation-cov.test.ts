/**
 * smartcat 动画系统覆盖率补测（原 SmartCatAnimation 移植）：
 * 部件查询/基础组合类、整身一次性动画 busy 排队（blinkQuick 插队例外）、局部部件动画、
 * 多部件组合动画、hover/click 交互监听、全动作池（72 小动作 + 心情动画 + 组合动作）
 * 随机调度、dispose 全量清理。
 * 纯 CSS 类/CSS 变量驱动（styles.css 承载视觉），断言只看类名与变量写入——不测渲染本身。
 * 2026-08-31：动画心情状态机已删除（setMood/AnimMood/bz-sc-mood-* 移除），
 * 原心情动画 keyframes 保留并进随机池；新增多部件组合动作。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmartCatAnimation, INJECTED_ACTIONS, MOOD_ACTIONS, COMBO_ACTIONS, getAllActions } from '../../src/smartcat/animation';

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

  it('initialize：装配基础类 + 两组定时器；dispose 后定时器全停', () => {
    anim.initialize();
    expect(anim.body.classList.contains('bz-sc-anim-base')).toBe(true);
    vi.advanceTimersByTime(5000);
    anim.dispose();
    vi.advanceTimersByTime(60_000); // 若 interval 未清，此刻必触发随机动作
    expect(anim.isBusy).toBe(false);
  });
});

describe('全动作池（去心情后）', () => {
  it('MOOD_ACTIONS：原心情动画 5 条保留（keyframes 复用，作为随机池普通动作）', () => {
    expect(MOOD_ACTIONS.map((a) => a.animation)).toEqual(['happyBounce', 'curiousLook', 'sleepySway', 'excitedVibrate', 'playfulHop']);
  });

  it('COMBO_ACTIONS：12 条组合动作，每条含多部件 parts', () => {
    expect(COMBO_ACTIONS.length).toBe(12);
    for (const action of COMBO_ACTIONS) {
      expect(action.parts?.length).toBeGreaterThan(1);
      // parts 含主部件 body
      expect(action.parts!.some((p) => p.part === 'body')).toBe(true);
      // parts 里的动画名都有对应 keyframes 引用（name 非空）
      for (const p of action.parts!) expect(p.animation).toBeTruthy();
    }
  });

  it('getAllActions：全池 = 72 小动作 + 5 心情动画 + 12 组合动作', () => {
    const all = getAllActions();
    const expected = 72 + 5 + 12;
    expect(all.length).toBe(expected);
    // 池内动作名唯一
    const names = all.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('INJECTED_ACTIONS 六类各 12 条（原 72 小动作保留）', () => {
    for (const key of Object.keys(INJECTED_ACTIONS)) {
      expect(INJECTED_ACTIONS[key].length).toBe(12);
    }
  });
});

describe('playAnimation 整身一次性动画（busy 排队）', () => {
  it('空闲播放：写 CSS 变量挂一次性类，duration 后清理并恢复基础动画', () => {
    anim.playAnimation('greetingBow', 1200);
    expect(anim.isBusy).toBe(true);
    expectAnimVars(anim.body, 'greetingBow', '1200ms');
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(anim.isBusy).toBe(false);
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(false);
    expect(anim.body.classList.contains('bz-sc-anim-base')).toBe(true); // 恢复基础组合类
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
  it('mouseenter：刷新互动时间 + attentionPulse', () => {
    anim.initialize();
    const before = anim.lastInteraction;
    vi.advanceTimersByTime(100);
    cat.dispatchEvent(new Event('mouseenter'));
    expect(anim.lastInteraction).toBeGreaterThan(before);
    expectAnimVars(anim.body, 'attentionPulse', '1500ms');
  });

  it('mouseleave：仅刷新互动时间', () => {
    anim.initialize();
    const before = anim.lastInteraction;
    vi.advanceTimersByTime(50);
    cat.dispatchEvent(new Event('mouseleave'));
    expect(anim.lastInteraction).toBeGreaterThan(before);
  });

  it('click 命中 #cat-body：excitedWiggle；50% 命中补耳朵抖动', () => {
    anim.initialize();
    const inner = cat.querySelector('.cat-body-inner')!;
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.5 触发耳动；后续取左耳
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expectAnimVars(anim.body, 'excitedWiggle', '800ms');
    vi.advanceTimersByTime(300); // 耳动延时到期
    const ear = anim.ears[0];
    expect(['earFlickLeft', 'earFlickRight']).toContain(ear.style.getPropertyValue('--bz-sc-anim-name'));
  });

  it('click 目标不在 #cat-body：无动画', () => {
    anim.initialize();
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    cat.dispatchEvent(new MouseEvent('click', { bubbles: true })); // target=cat 本体，非 body 内
    expect(anim.body.style.getPropertyValue('--bz-sc-anim-name')).toBe('');
  });

  it('greet：greetingBow（ensure 后问候入口）', () => {
    anim.greet();
    expectAnimVars(anim.body, 'greetingBow', '1200ms');
  });
});

describe('全动作池随机调度（去心情筛选）', () => {
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

  it('playMultiPartAnimation：多部件同时写动画变量，duration 后全还原', () => {
    const combo = COMBO_ACTIONS[0]; // 组合跳跃：body+tail+ears
    anim.playMultiPartAnimation(combo.parts!, combo.duration);
    expect(anim.isBusy).toBe(true);
    expectAnimVars(anim.body, combo.parts![0].animation, combo.duration + 'ms');
    expectAnimVars(anim.tail, combo.parts![1].animation, combo.duration + 'ms');
    expect(anim.ears[0].classList.contains('bz-sc-anim')).toBe(true);
    vi.advanceTimersByTime(combo.duration);
    expect(anim.isBusy).toBe(false);
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(false);
    expect(anim.tail.classList.contains('bz-sc-anim')).toBe(false);
  });

  it('triggerEnhancedRandomAction：抽到单部件动作走 playEnhancedAnimation', () => {
    // Math.random 0 → 全池第一支 = basic[0] gentleNod(body)
    vi.spyOn(Math, 'random').mockReturnValue(0);
    anim.triggerEnhancedRandomAction();
    expectAnimVars(anim.body, 'gentleNod', '800ms');
  });

  it('triggerEnhancedRandomAction：抽到组合动作走多部件播放', () => {
    // 全池索引 = 72 + 5 + 0 → MOOD_ACTIONS 之后第一支组合动作
    const comboIndex = INJECTED_ACTIONS.basic.length + INJECTED_ACTIONS.cute.length + INJECTED_ACTIONS.lively.length + INJECTED_ACTIONS.elegant.length + INJECTED_ACTIONS.funny.length + INJECTED_ACTIONS.special.length + MOOD_ACTIONS.length;
    // Math.random 精确命中组合动作索引（0..N-1 归一）
    vi.spyOn(Math, 'random').mockReturnValue((comboIndex + 0.5) / getAllActions().length);
    anim.triggerEnhancedRandomAction();
    expect(anim.isBusy).toBe(true);
    expect(anim.body.classList.contains('bz-sc-anim')).toBe(true);
    expect(anim.tail.classList.contains('bz-sc-anim')).toBe(true);
  });

  it('startEnhancedRandomActions 定时调度：6s tick、40% 概率、busy 跳过', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01); // 恒触发
    // mockImplementation 隔离：spy 只计数不执行原逻辑（callsThrough 会设置 isBusy+timeout，干扰断言）
    const spy = vi.spyOn(anim, 'triggerEnhancedRandomAction').mockImplementation(() => {});
    anim.startEnhancedRandomActions();
    vi.advanceTimersByTime(6000);
    expect(spy).toHaveBeenCalledTimes(1);
    // isBusy：不触发
    anim.isBusy = true;
    vi.advanceTimersByTime(6000);
    expect(spy).toHaveBeenCalledTimes(1);
    // 概率未命中 → 不触发
    anim.isBusy = false;
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.advanceTimersByTime(6000);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('startRandomActions 定时调度：8s tick、30% 概率、busy 守卫', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    vi.spyOn(anim, 'triggerRandomAction');
    anim.startRandomActions();
    // isBusy 不触发
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
