/**
 * 游戏库动效层测试（2026-09-23 全量动效批）：
 * 动效层的宿主契约——jsdom 无 WAAPI / 无 canvas 2d 上下文时全部落终态零感知；
 * ?rm=1 评审模拟 RM 时零编排零注入；关机断电的收口时序（无 WAAPI 同步摘除、
 * 有 WAAPI 等动画收口并 cancel 防 fill 残留——首页线上教训的回归钉）；
 * 读盘旋转的防重入与相位收口；后台整刷静默不重播。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  motionDetailIn, motionPanelOut, motionRendered, motionShelfIn, motionShotsPaint,
  motionStatsIn, motionStatusLine, motionStorePaint, motionSyncSpin, motionTeardown,
} from '../../src/gameshelf/motion';

/** WAAPI 桩：可断言 frames/opts 的最小实现（finished 立即 resolve，cancel 可探测） */
function stubAnimate(el: HTMLElement, log: { frames?: Keyframe[]; opts?: KeyframeAnimationOptions }[]): void {
  (el as unknown as { animate: typeof el.animate }).animate = ((frames: Keyframe[], opts: KeyframeAnimationOptions) => {
    log.push({ frames, opts });
    return {
      id: opts.id ?? '',
      effect: { target: el },
      finished: Promise.resolve(),
      playState: 'running',
      cancel: () => { (el as unknown as { __canceled?: boolean }).__canceled = true; },
    } as unknown as Animation;
  }) as typeof el.animate;
}

function shelfDom(): HTMLElement {
  const host = document.createElement('div');
  host.id = 'bz-gs-grid';
  host.innerHTML = `
  <div class="bz-gs-grid">
    <button type="button" class="bz-gs-card" data-appid="1">
      <span class="bz-gs-cover"><span class="bz-gs-rank">NO.1</span><span class="bz-gs-trophy">🏆</span></span>
      <span class="bz-gs-strip"><i style="width:73%"></i></span>
    </button>
    <button type="button" class="bz-gs-card" data-appid="2"><span class="bz-gs-cover"></span></button>
  </div>`;
  document.body.appendChild(host);
  return host;
}

function panelDom(): { frame: HTMLElement; body: HTMLElement } {
  const frame = document.createElement('div');
  frame.className = 'bz-gs-panel';
  frame.innerHTML = `
  <div id="bz-gs-hero"><div class="bz-gs-hero-art"></div><div class="bz-gs-hero-in">
    <div class="bz-gs-hero-left"><div class="bz-gs-hero-name">游戏</div></div>
    <div class="bz-gs-hero-side"><div><b>3</b><span>在架游戏</span></div><div><b>100</b><span>累计小时</span></div><div><b>1</b><span>从未启动</span></div></div>
  </div></div>
  <div id="bz-gs-status"></div>
  <div id="bz-gs-body"></div>`;
  document.body.appendChild(frame);
  return { frame, body: frame.querySelector<HTMLElement>('#bz-gs-body')! };
}

beforeEach(() => {
  document.body.innerHTML = '';
  // 评审模拟 RM 的还原口：防止上一用例的 ?rm=1 泄进下一个
  history.replaceState(null, '', '/');
});

afterEach(() => {
  motionTeardown();
  history.replaceState(null, '', '/');
});

describe('无 WAAPI 宿主（jsdom）：全动效落终态零感知', () => {
  it('卡带架入架：卡片落终态可见、终态零注入、进度条几何不被改写', () => {
    const host = shelfDom();
    expect(() => motionShelfIn(host, 'boot')).not.toThrow();
    for (const card of host.querySelectorAll<HTMLElement>('.bz-gs-card')) {
      expect(card.style.opacity).toBe('1'); // 末帧内联 = 终态可见
    }
    const strip = host.querySelector<HTMLElement>('.bz-gs-strip > i')!;
    expect(strip.style.width).toBe('73%'); // 布局宽一字不动（点亮走 clip-path）
    expect(strip.style.clipPath).toBe('none'); // 无 WAAPI 落末帧：无裁剪 = 与今天完全一致
    expect(host.querySelectorAll('.bz-gs-fx').length).toBe(0); // 纸屑排程未到不预建
  });

  it('奖杯架揭幕 / 读卡入仓 / 档案翻出 / 截图墙：调用零异常、无扫描线扫光残留', () => {
    const { frame, body } = panelDom();
    body.innerHTML = `
    <div class="bz-gs-stats"><div class="bz-stat">x</div></div>
    <div class="bz-gs-sec"><div class="bz-gs-rankrow"><span class="bz-gs-rankbar"><i style="width:50%"></i></span></div></div>
    <div class="bz-gs-cols"><div class="bz-gs-col is-now"><b>2</b><span class="bz-gs-colbar" style="height:30px"></span></div></div>`;
    expect(() => motionStatsIn(body)).not.toThrow();
    expect(() => motionRendered(frame, body, true, false, 'stats')).not.toThrow();
    expect(frame.querySelectorAll('.bz-gs-scan').length).toBe(0); // 无 WAAPI：扫描线注入即自毁

    const popup = document.createElement('div');
    popup.innerHTML = `
    <div class="bz-gs-detail-cover"><img alt=""></div>
    <span class="bz-gs-chiplet">动作</span>
    <div class="bz-gs-mine"><div class="bz-gs-mine-num"><b>100</b></div>
      <div class="bz-gs-mine-grid"><div></div></div>
      <div class="bz-gs-platbar"><i style="width:40%"></i></div></div>`;
    document.body.appendChild(popup);
    expect(() => motionDetailIn(popup)).not.toThrow();
    expect(popup.querySelectorAll('.bz-gs-shine').length).toBe(0); // 同上：扫光即自毁

    const storeBox = document.createElement('div');
    storeBox.innerHTML = '<div class="bz-gs-kv"></div><div class="bz-gs-desc"></div>';
    const shotsBox = document.createElement('div');
    shotsBox.innerHTML = '<button class="bz-gs-shot"></button>';
    expect(() => { motionStorePaint(storeBox); motionShotsPaint(shotsBox); }).not.toThrow();
  });

  it('状态行播报：无 WAAPI 落终态内联（终态可见）', () => {
    const el = document.createElement('div');
    motionStatusLine(el, '同步完成：新增 2 款');
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('none');
  });
});

describe('?rm=1 评审模拟 RM：零编排零注入', () => {
  it('上电 + 视图编排全静默（无内联、无注入件）', () => {
    history.replaceState(null, '', '/?rm=1');
    const { frame, body } = panelDom();
    body.innerHTML = '<div id="bz-gs-grid"><div class="bz-gs-grid"><div class="bz-gs-card"></div></div></div>';
    motionRendered(frame, body, true, false, 'shelf');
    const card = body.querySelector<HTMLElement>('.bz-gs-card')!;
    expect(card.style.opacity).toBe(''); // RM：内容由渲染层直接落终态，动效层零写入
    expect(frame.querySelectorAll('.bz-gs-scan').length).toBe(0);
    expect(card.getAttribute('style')).toBeNull();
  });

  it('RM 下关机断电同步收口（done 立即，不让摘除晚到）', () => {
    history.replaceState(null, '', '/?rm=1');
    const frame = document.createElement('div');
    document.body.appendChild(frame);
    let done = false;
    motionPanelOut(frame, () => { done = true; });
    expect(done).toBe(true);
  });
});

describe('关机断电收口时序', () => {
  it('无 WAAPI：done 同步调用（closePanel 摘除语义与旧版一致）', () => {
    const frame = document.createElement('div');
    document.body.appendChild(frame);
    let done = false;
    motionPanelOut(frame, () => { done = true; });
    expect(done).toBe(true);
    expect(frame.style.opacity).toBe(''); // 无 RM 无 WAAPI：不留 fill 式 opacity:0 内联
  });

  it('有 WAAPI：等动画再收口，收口时 cancel 退场动画（fill:forwards 不许活过关闭）', async () => {
    const frame = document.createElement('div');
    document.body.appendChild(frame);
    const log: { frames?: Keyframe[]; opts?: KeyframeAnimationOptions }[] = [];
    stubAnimate(frame, log);
    let done = false;
    motionPanelOut(frame, () => { done = true; });
    expect(done).toBe(false); // 异步：退场没演完不摘 DOM
    await Promise.resolve();
    expect(done).toBe(true);
    expect(log[0]?.opts?.id).toBe('bz-gs-panel-exit');
    expect(log[0]?.opts?.fill).toBe('forwards');
    expect((frame as unknown as { __canceled?: boolean }).__canceled).toBe(true); // 收口即 cancel
  });
});

describe('读盘旋转（唯一长驻循环）：防重入与相位收口', () => {
  it('同步中起旋防重入；相位收口（off）取消本钮循环', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn); // 挂上 DOM：与真机一致（断连句柄才会被清理）
    const log: { frames?: Keyframe[]; opts?: KeyframeAnimationOptions }[] = [];
    stubAnimate(btn, log);
    motionSyncSpin(btn, true);
    motionSyncSpin(btn, true); // 重入：不得再起一轮
    expect(log.length).toBe(1);
    expect(log[0]?.opts?.iterations).toBe(Infinity);
    expect(btn.dataset.gsSpinning).toBe('1');
    motionSyncSpin(btn, false); // 同步收尾：循环 cancel + 标记清除，可再次起旋
    expect((btn as unknown as { __canceled?: boolean }).__canceled).toBe(true);
    expect(btn.dataset.gsSpinning).toBeUndefined();
    motionSyncSpin(btn, true);
    expect(log.length).toBe(2);
    motionTeardown();
    expect((btn as unknown as { __canceled2?: boolean }).__canceled2).toBeUndefined();
  });
});

describe('渲染挂点静默语义（boot 消费 / 后台整刷不重播）', () => {
  it('boot=false 且视图未变（后台整刷）：零编排零注入', () => {
    const { frame, body } = panelDom();
    body.innerHTML = '<div id="bz-gs-grid"><div class="bz-gs-grid"><div class="bz-gs-card"></div></div></div>';
    motionRendered(frame, body, false, false, 'shelf');
    const card = body.querySelector<HTMLElement>('.bz-gs-card')!;
    expect(card.getAttribute('style')).toBeNull();
    expect(frame.querySelectorAll('.bz-gs-scan').length).toBe(0);
  });

  it('视图切换（viewChanged）：新视图有编排、面板壳不上电（只有 boot 扫描线）', () => {
    const { frame, body } = panelDom();
    body.innerHTML = '<div class="bz-gs-stats"><div class="bz-stat"></div></div>';
    motionRendered(frame, body, false, true, 'stats');
    const stat = body.querySelector<HTMLElement>('.bz-stat')!;
    expect(stat.style.opacity).toBe('1'); // 编排跑了（无 WAAPI 落终态）
    expect(frame.querySelectorAll('.bz-gs-scan').length).toBe(0); // 但不上电
  });

  it('引导态（view=null）：上电由 boot 决定，空态只做轻浮现', () => {
    const { frame, body } = panelDom();
    body.innerHTML = '<div class="bz-empty"></div>';
    motionRendered(frame, body, false, false, null);
    expect(frame.querySelectorAll('.bz-gs-scan').length).toBe(0);
    expect(body.querySelector<HTMLElement>('.bz-empty')!.style.opacity).toBe('');
    motionRendered(frame, body, true, false, null);
    expect(body.querySelector<HTMLElement>('.bz-empty')!.style.opacity).toBe('1');
  });
});
