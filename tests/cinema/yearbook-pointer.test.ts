/**
 * 观影志 · 指针层契约（2026-09-22 用户拍板「鼠标的干扰全都做」）
 *
 * 分三层钉：
 *  1. 工具箱是纯函数（`localAt` / `nearest` / `toward`）——比例坐标与命中判定的口径只有这一处；
 *  2. 版式给指针留的钩子（`data-tip` / `.yb-rread`）在 26 幕里齐不齐——
 *     运动层靠这些钩子取读数，少一个就是某一页「悬停没反应」；
 *  3. 引擎真的把指针转给**当前这一幕**：翻幕之后指针事件不能还发给上一幕（否则上一幕会背着演），
 *     也不能在 stop 之后继续。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { deriveYb } from '../../src/cinema/yearbook/data';
import { yearbookHtml, YB_SCENES } from '../../src/cinema/yearbook/scenes';
import { bindYearbook } from '../../src/cinema/yearbook/engine';
import { localAt, nearest, toward, under, tip } from '../../src/cinema/yearbook/kits';
import { STATUS_WATCHED } from '../../src/cinema/constants';
import type { CinemaItem } from '../../src/cinema/state';

function item(p: Partial<CinemaItem> & { name: string }): CinemaItem {
  return {
    file: null, name: p.name, typeTag: p.typeTag ?? '电影', group: p.group ?? '电影',
    watchDate: p.watchDate ?? null, rating: p.rating ?? null, status: p.status ?? STATUS_WATCHED,
    poster: p.poster ?? null, review: p.review ?? null, genre: p.genre ?? null,
    director: p.director ?? null, actors: p.actors ?? null, region: p.region ?? null,
    year: p.year ?? null, releaseDate: p.releaseDate ?? null, doubanRating: p.doubanRating ?? null,
    doubanUrl: p.doubanUrl ?? null, synopsis: p.synopsis ?? null, duration: p.duration ?? null,
    seasonText: p.seasonText ?? null, hotComment: p.hotComment ?? null,
  };
}

const FIXTURE: CinemaItem[] = [
  item({ name: '长片', watchDate: '2024-04-08', rating: 9.5, doubanRating: '8.5', duration: '124分钟', genre: '剧情 / 科幻', region: '美国 / 日本', director: '甲', actors: 'A / B', year: '2023', review: '喜欢这部片子的每一个镜头', hotComment: '这条短评够长了可以进弹幕' }),
  item({ name: '短片', watchDate: '2024-04-09', rating: 5, doubanRating: '8.6', duration: '4分钟', genre: '剧情', region: '美国', director: '甲', actors: 'B', year: '2020' }),
  item({ name: '老片', watchDate: '2024-04-10', rating: 3, doubanRating: '9.1', duration: '201分钟', genre: '动画', region: '日本', director: '乙', actors: 'C', year: '1915' }),
  item({ name: '剧集 第一季', watchDate: '2024-05-01', rating: 8, doubanRating: '7.9', duration: '45分钟/集', seasonText: '13', genre: '剧情', region: '中国大陆', director: '丙', actors: 'A', typeTag: '美剧', group: '美剧' }),
  item({ name: '没片长', watchDate: '2024-06-01', rating: 7, genre: '喜剧', region: '法国' }),
];

const HTML = yearbookHtml(deriveYb(FIXTURE), () => null);

/** 真浏览器里元素都有 rect，jsdom 全是 0：给要命中的宿主铺一个固定矩形 */
const RECT = {
  x: 100, y: 100, width: 400, height: 200, top: 100, left: 100, right: 500, bottom: 300,
  toJSON() { return this; },
} as DOMRect;

function stubRect(el: Element): void {
  (el as HTMLElement).getBoundingClientRect = () => RECT;
}

/** jsdom **没有** document.elementFromPoint（连属性都没有，spyOn 会直接报 not defined）：
 *  按需装一个假的命中判定，用完删掉——真实浏览器里这一步是浏览器自己算的。 */
function withHitTest(hit: Element | null, fn: () => void): void {
  const anyDoc = document as unknown as { elementFromPoint?: (x: number, y: number) => Element | null };
  const had = Object.prototype.hasOwnProperty.call(anyDoc, 'elementFromPoint');
  const prev = anyDoc.elementFromPoint;
  anyDoc.elementFromPoint = () => hit;
  try { fn(); } finally {
    if (had) anyDoc.elementFromPoint = prev;
    else delete anyDoc.elementFromPoint;
  }
}

describe('观影志 · 指针工具箱（纯函数 + 浮签）', () => {
  it('localAt：宿主内给比例坐标，出了边界给 null（画布类命中判定靠它）', () => {
    const host = document.createElement('div');
    stubRect(host);
    expect(localAt(host, { cx: 300, cy: 200, px: 0, py: 0 })).toEqual({ x: .5, y: .5 });
    expect(localAt(host, { cx: 60, cy: 200, px: 0, py: 0 })).toBeNull();  // 左边界外
    expect(localAt(host, { cx: 300, cy: 400, px: 0, py: 0 })).toBeNull(); // 下边界外
    expect(localAt(null, { cx: 300, cy: 200, px: 0, py: 0 })).toBeNull();
  });

  it('nearest：按比例距离找最近的一枚，超出半径算没命中', () => {
    const spots = [{ x: .2, y: .2 }, { x: .8, y: .8 }];
    expect(nearest(spots, { x: .81, y: .79 }, .12)).toBe(1);
    expect(nearest(spots, { x: .5, y: .5 }, .12)).toBe(-1); // 谁都不够近
    expect(nearest([], { x: .5, y: .5 })).toBe(-1);
    expect(nearest(spots, null)).toBe(-1);
  });

  it('toward：逐帧朝目标挪，指针跳变时不会一步到位', () => {
    expect(toward(0, 10, .5)).toBe(5);
    expect(Math.abs(toward(5, 10, .2) - 6)).toBeLessThan(1e-9);
  });

  it('under：取了 elementFromPoint 的结果再往上找匹配的祖先；取不到就 null', () => {
    const wrap = document.createElement('div');
    const cell = document.createElement('i');
    cell.className = 'yb-cell';
    wrap.appendChild(cell);
    document.body.appendChild(wrap);
    withHitTest(cell, () => {
      expect(under({ cx: 1, cy: 1, px: 0, py: 0 }, '.yb-cell')).toBe(cell);
      expect(under({ cx: 1, cy: 1, px: 0, py: 0 }, '.yb-stamp')).toBeNull();
    });
    withHitTest(null, () => {
      expect(under({ cx: 1, cy: 1, px: 0, py: 0 }, '.yb-cell')).toBeNull();
    });
    // 完全没实现命中判定的环境（真无头内核）：不许抛，按「没悬停」处理
    expect(under({ cx: 1, cy: 1, px: 0, py: 0 }, '.yb-cell')).toBeNull();
    wrap.remove();
  });

  it('浮签：同一个宿主只有一个节点，传空串即隐藏（翻幕靠它收干净）', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    tip(host, '<b>2022</b> 年 · 137 部', 40, 60);
    tip(host, '<b>2022</b> 年 · 137 部', 80, 90); // 同内容不动 innerHTML，只挪位置
    const nodes = host.querySelectorAll('.yb-tip');
    expect(nodes.length).toBe(1);
    const el = nodes[0] as HTMLElement;
    expect(el.textContent).toBe('2022 年 · 137 部');
    expect(el.style.left).toBe('80px');
    expect(el.style.opacity).toBe('1');
    expect(el.getAttribute('aria-hidden')).toBe('true'); // 浮签不进读屏（内容屏上都有）
    tip(host, '');
    expect(el.style.opacity).toBe('0');
    tip(host, '换一条', 10, 10);
    expect(host.querySelectorAll('.yb-tip').length).toBe(1); // 复用同一个节点
    host.remove();
  });
});

describe('观影志 · 每幕给指针留的钩子', () => {
  it('要报读数的幕都带 data-tip（悬停没字可报 = 这一页的指针白做）', () => {
    // 日历格子（只给点亮过的）、串珠、单日刻线、片长分箱、印章、片龄海报、散点、短评
    const must = [
      ['cell', '天数'], ['ribdot', '串珠'], ['btick', '刻线'], ['bin', '分箱'],
      ['stamp', '印章'], ['adot', '片龄'], ['sdot2', '散点'], ['quote', '短评'],
    ];
    for (const [key, what] of must) {
      const m = HTML.match(new RegExp(`data-r="${key}"[^>]*data-tip=`, 'g')) ?? [];
      expect(m.length, `${what}（data-r="${key}"）没有 data-tip`).toBeGreaterThan(0);
    }
    // 日历只给「点亮过的那几天」出浮签：364 个空格子不配有读数
    const cells = HTML.match(/data-r="cell"[^>]*>/g) ?? [];
    expect(cells.filter((c) => c.includes('data-tip')).length).toBeLessThan(cells.length);
  });

  it('07 长短两端：尺子上有读数线元素（指针量出的那一档）', () => {
    expect(HTML).toContain('data-r="rread"');
    const ruler = HTML.slice(HTML.indexOf('class="yb-ruler"'), HTML.indexOf('class="yb-ext-cards"'));
    expect(ruler).toContain('data-r="rread"');
  });

  it('按住的交互只留给打分天平（全片唯一有手感的器件）', () => {
    // 天平两只挂盘：按压判定按 class 取左右，别改成别的选择器
    const pans = HTML.match(/class="yb-bal-pan l"/g) ?? [];
    const pansR = HTML.match(/class="yb-bal-pan r"/g) ?? [];
    expect(pans.length).toBe(1);
    expect(pansR.length).toBe(1);
  });
});

describe('观影志 · 引擎把指针转给「当前这一幕」', () => {
  let ovl: HTMLElement;
  let sc: HTMLElement;
  let handle: { stop(): void } | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    ovl = document.createElement('div');
    ovl.className = 'bz-yb';
    ovl.innerHTML = `<div class="bz-yb-scroll"><div class="bz-yb-film">${yearbookHtml(deriveYb(FIXTURE), () => null)}</div></div>`;
    document.body.appendChild(ovl);
    sc = ovl.querySelector('.bz-yb-scroll') as HTMLElement;
    Object.defineProperty(sc, 'clientHeight', { value: 600, configurable: true });
  });
  afterEach(() => { handle?.stop(); handle = null; });

  it('悬停日晷：针跟着指针转，盘心报出那一格（切幕后不再吃指针）', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    const rail = ovl.querySelectorAll('.yb-rail-t')[3] as HTMLElement; // 04 星期节律
    rail.click();
    await new Promise((r) => setTimeout(r, 2400)); // 进场演完（t>2.2 之后指针才接管）
    const face = ovl.querySelector('[data-r="face"]') as HTMLElement;
    const needle = ovl.querySelector('[data-r="needle"]') as HTMLElement;
    const hub = ovl.querySelector('.yb-dial-hub') as HTMLElement;
    expect(hub.textContent).toContain('部'); // 没悬停时盘心是总数
    stubRect(face);
    const before = needle.style.transform;
    // 指针摆在盘面的右下：0° 在正上方、顺时针为正 → 落在 90°~135° 那一格（周三 ~ 周四）
    ovl.dispatchEvent(new PointerEvent('pointermove', { clientX: 400, clientY: 280, bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    expect(needle.style.transform).not.toBe(before);
    expect(hub.textContent).toContain('周'); // 盘心从「N 部」换成「N 周X」
    // 翻到下一幕：不该再吃指针（上一幕不许背着演）。
    // 过片要 160ms，等遮片合上、上一幕被推到终态之后再取基准值
    (ovl.querySelectorAll('.yb-rail-t')[4] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 600));
    const after = needle.style.transform;
    ovl.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 120, bubbles: true }));
    await new Promise((r) => setTimeout(r, 320));
    expect(needle.style.transform).toBe(after);
  });

  it('浮签跟着指针走，翻幕时收干净（不挂在上一层楼上）', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    (ovl.querySelectorAll('.yb-rail-t')[2] as HTMLElement).click(); // 03 落笔的日子
    await new Promise((r) => setTimeout(r, 300));
    const cell = ovl.querySelector('.yb-cell[data-tip]') as HTMLElement;
    expect(cell, '夹具里应当有点亮过的日子').toBeTruthy();
    withHitTest(cell, () => {
      ovl.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 200, bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 300));
    const box = ovl.querySelector('.yb-tip') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.style.opacity).toBe('1');
    expect(box.textContent).toContain('部');
    (ovl.querySelectorAll('.yb-rail-t')[3] as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 320));
    expect(box.style.opacity).toBe('0');
  });

  it('按下/松开只影响天平一幕：松手后秤杆回到数据那一档', async () => {
    handle = bindYearbook(ovl, deriveYb(FIXTURE));
    (ovl.querySelectorAll('.yb-rail-t')[14] as HTMLElement).click(); // 15 打分天平
    await new Promise((r) => setTimeout(r, 300));
    const arm = ovl.querySelector('[data-r="arm"]') as HTMLElement;
    const pan = ovl.querySelector('.yb-bal-pan.l') as HTMLElement;
    stubRect(pan);
    ovl.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true }));
    await new Promise((r) => setTimeout(r, 400));
    const pressed = arm.style.transform;
    ovl.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 200, bubbles: true }));
    await new Promise((r) => setTimeout(r, 700));
    expect(arm.style.transform).not.toBe(pressed); // 松手后往回走
  });

  it('一幕的表演次数与幕数一一对应（指针层没有偷偷多挂）', () => {
    expect(YB_SCENES.length).toBe(26);
  });
});
