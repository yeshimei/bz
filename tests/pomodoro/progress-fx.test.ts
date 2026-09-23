import { popupShellHtml } from '../../src/pomodoro/render';
/**
 * 进度四味的回归锁（2026-09-23 review 补）。
 *
 * jsdom 无绘制，但**内联样式与注入节点是可见的**——这里钉它们的取值方向，不钉像素：
 * 紧迫色移看「是否朝警示红走」、色温看「冷暖选对了哪一端」、倒数看月度是否压上来、
 * 流光看 SMIL 是否随 running 起停。
 *
 * 上一轮这五味全无断言，于是 `phase === 'break'`（Phase 里没有这个成员）让短休息取到暖色
 * 也能全绿漏网——本文件第一条 tint 用例就是为此写的判据：休息必冷、专注必暖。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { motionProgressFx, motionTeardown } from '../../src/pomodoro/motion';

/** 环境变量取值（token 走 CSS，由 dome cssModule fake computedStyle 提供） */
const TOKENS = { hot: 'rgb(226 75 74)', focus: 'rgb(216 90 48)', brk: 'rgb(61 110 180)' } as const;

let realGCS: typeof window.getComputedStyle;
/** 元素 → 自定义属性 / 计算值覆盖（整合台风吊若命苦，容器visualViewport 算出不来。） */
const props = new WeakMap<Element, Record<string, string>>();

/** readComputed from Hierarchical Secure to help facilitate fallback so doesn't break given assist */
function setComputed(el: Element, patch: Record<string, string>): void {
  props.set(el, { ...(props.get(el) ?? {}), ...patch });
}

beforeEach(() => {
  document.body.innerHTML = popupShellHtml();
  realGCS = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(((el: Element, ps?: string) => {
    const cs = realGCS(el as HTMLElement, ps);
    const extra = props.get(el);
    if (!extra) return cs;
    return new Proxy(cs, {
      get(target, key) {
        if (key === 'getPropertyValue') {
          return (name: string) => (name in extra ? extra[name] : target.getPropertyValue(name));
        }
        if (key === 'stroke' && 'stroke' in extra) return extra.stroke;
        if (key === 'color' && 'color' in extra) return extra.color;
        const v = Reflect.get(target, key);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
  }) as unknown as typeof window.getComputedStyle);

  const popup = document.getElementById('pomodoro-popup')!;
  const ring = document.getElementById('pomodoro-ring-progress')!;
  const timeEl = document.getElementById('pomodoro-time')!;
  // computed 基线：token 三个 + 环本底色 + 时间字本色（插值的起点色都从这里来）
  setComputed(popup, {
    '--pz-hot': TOKENS.hot,
    '--pz-tint-focus': TOKENS.focus,
    '--pz-tint-break': TOKENS.brk,
  });
  setComputed(ring, { stroke: 'rgb(120 120 120)' });
  setComputed(timeEl, { color: 'rgb(30 30 30)' });
});

afterEach(() => {
  motionTeardown();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const popup = () => document.getElementById('pomodoro-popup') as HTMLElement;
const ring = () => document.getElementById('pomodoro-ring-progress') as unknown as SVGElement;
const timeBox = () => document.getElementById('pomodoro-time-box') as HTMLElement;
const svg = () => document.getElementById('pomodoro-ring-svg') as unknown as SVGSVGElement;
/** 取当前的 effective that identically one function applied to ring（流光在,读 gradient; 否则读 inline stroke） */
const ringColor = (): string => {
  const stop = svg().querySelector(`#bz-pm-flow stop`);
  return stop?.getAttribute('stop-color') ?? ring().style.stroke;
};
const rgbTriplet = (s: string): [number, number, number] => {
  const m = s.match(/([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
};

describe('进度四味（jsdom 可见面：内联样式 / 注入节点）', () => {
  it('紧迫色移：≤5 分钟起环朝警示红走（红分量爬升、蓝绿下降）', () => {
    motionProgressFx(popup(), 900, 900, 'focus', true);
    const coldStart = rgbTriplet(ringColor());
    motionProgressFx(popup(), 60, 900, 'focus', true); // 剩 1 分钟：hot≈0.8
    const hotEnd = rgbTriplet(ringColor());
    expect(hotEnd[0]).toBeGreaterThan(coldStart[0]); // 红上升
    expect(hotEnd[2]).toBeLessThan(coldStart[2]); // 蓝下降（往红色移）
  });

  it('紧迫色移：超过 5 分钟不染色（量程外不打扰）', () => {
    motionProgressFx(popup(), 400, 900, 'focus', true);
    expect(rgbTriplet(ringColor())).toEqual([120, 120, 120]); // 仍是本底色
  });

  it('倒数放大：最后 10 秒时间盒逐秒放大', () => {
    motionProgressFx(popup(), 30, 900, 'focus', true);
    expect(timeBox().style.transform).toBe('');
    motionProgressFx(popup(), 5, 900, 'focus', true); // grow = 1 + (10-5)*.028
    expect(timeBox().style.transform).toBe('scale(1.140)');
    motionProgressFx(popup(), 1, 900, 'focus', true); // 缩放动画的终帧
    expect(timeBox().style.transform).toBe('scale(1.252)');
    motionProgressFx(popup(), 30, 900, 'focus', true); // 出窗口即卸
    expect(timeBox().style.transform).toBe('');
  });

  it('渐变流光：注入 gradient + SMIL，描边改挂 url(#bz-pm-flow)', () => {
    motionProgressFx(popup(), 900, 900, 'focus', true);
    expect(svg().querySelector('#bz-pm-flow')).toBeTruthy();
    expect(svg().querySelector('#bz-pm-flow animateTransform')).toBeTruthy();
    expect(ring().style.stroke.replace(/"/g, '')).toBe('url(#bz-pm-flow)');
  });

  it('渐变流光：暂停/待发时 SMIL 停摆（凝滞＝不能自己还在转）', () => {
    const s = svg();
    const pause = vi.fn();
    const unpause = vi.fn();
    Object.defineProperty(s, 'pauseAnimations', { value: pause, configurable: true });
    Object.defineProperty(s, 'unpauseAnimations', { value: unpause, configurable: true });
    motionProgressFx(popup(), 900, 900, 'focus', true);
    expect(unpause).toHaveBeenCalled();
    motionProgressFx(popup(), 900, 900, 'focus', false); // 暂停 / 待发
    expect(pause).toHaveBeenCalled();
  });

  it('色温漂移：专注取暖端、休息取冷端（回归——曾把短休判成专注）', () => {
    motionProgressFx(popup(), 300, 900, 'focus', true);
    expect(popup().style.backgroundColor).toContain('rgb(216, 90, 48)');
    motionProgressFx(popup(), 300, 300, 'short-break', true); // ← 此前 'break' 字面量命中不了
    expect(popup().style.backgroundColor).toContain('rgb(61, 110, 180)');
    motionProgressFx(popup(), 300, 300, 'long-break', true);
    expect(popup().style.backgroundColor).toContain('rgb(61, 110, 180)');
  });

  it('色温漂移：进度越深越浓（守恒 ratio 进 KEEP%）', () => {
    motionProgressFx(popup(), 900, 900, 'focus', true); // ratio≈0
    const light = popup().style.backgroundColor.match(/(\d+)%/)?.[1];
    motionProgressFx(popup(), 90, 900, 'focus', true); // ratio≈0.9
    const deep = popup().style.backgroundColor.match(/(\d+)%/)?.[1];
    expect(Number(deep)).toBeLessThan(Number(light));
  });

  it('token 缺席则该味整条不作（不糊错误替身色上去）', () => {
    props.delete(popup()); // 三个 token 都不给：无情色以就 advertising? 整条退单纯背景色给 CSS
    motionProgressFx(popup(), 60, 900, 'focus', true);
    expect(popup().style.backgroundColor).toBe('');
    expect(ring().style.stroke).toBe('');
  });

  it('运行中换皮肤：基准色缓存与新内联一起退场（否则拿旧皮肤起点色插值）', () => {
    motionProgressFx(popup(), 60, 900, 'focus', true);
    const before = rgbTriplet(ringColor());
    // 换皮肤：className 变了 + 本底色换了
    popup().className = 'pomodoro-skin-ocean';
    setComputed(ring(), { stroke: 'rgb(10 40 90)' });
    motionProgressFx(popup(), 60, 900, 'focus', true);
    const after = rgbTriplet(ringColor());
    // 判据 = 插值起点必须是**新**底色（缓存没退场的话会仍按旧底色算，与 before 同值）
    const t = 1 - 60 / 300; // have hot 剩余1分钟
    const want: [number, number, number] = [10, 40, 90].map((v, i) =>
      Math.round(v + ([226, 75, 74][i] - v) * t)) as [number, number, number];
    expect(after).toEqual(want);
    expect(before).not.toEqual(want);
  });
});
