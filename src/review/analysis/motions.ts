/**
 * 记忆分析 · 十六幕表演（时间驱动：翻到一幕从 t=0 演一遍，演完进常驻，翻走推终态）
 *
 * ── 词汇表（复习域分析层专属语言，不与他域共用）──
 * 本层的世界观：复习是守着一炉记忆的火。每篇笔记是一粒「忆炭」，余温即留存率 R；
 * 「忘坡」是 FSRS 幂律遗忘曲线——主视觉母题，一切幕都在讲同一件事：坡往下滑，
 * 添柴（复习）让坡变缓。
 *   忆炭 ember    一条在册笔记的记忆余温：R≥70% 青焰 / 40-70% 烛橙 / <40% 将熄 / 阶梯期未入炉为灰青
 *   忘坡 slope    遗忘曲线族 R(t,S)=(1+t/S·d)^-d：横轴「龄期/稳定性」，纵轴「留存」
 *   水位 tide     全库平均留存率 = 忆池水位（满水位 = 都记得牢）
 *   欠账 debt     逾期未还的复习（挂绳红欠条；区别于面板动效批的一次性朱批章——这里是持续状态）
 *   阶石 steppath 阶梯十级 + FSRS 自由档：阶段推进的踏脚石
 *   墨晶 crystal  稳定性 S 的结晶：越久不忘晶格越大，下次遗忘来得越慢
 *   矿层 strata   难度 D 分层：越常「忘了」，矿层越沉
 *   添柴 feed     一次复习动作（添柴志 = 每日复习量）
 *   长明 vigil    连续添柴天数 = 灯芯上不灭的烛焰
 *   批改 verdict  评级（忘了/困难/一般/简单）→ 批改环
 *   基岩 bedrock  最稳的几篇：S 最高的基岩榜
 *   来潮 portide  未来排程像潮水把到期推上岸（明日预告）
 *   四驻 quarters 队列四区（逾期/今日/未来/已完成）各驻一座灯塔
 *   批痕 marks    末次评级刻下的痕 + 待重做的热数
 *   守夜人 keeper 落款：火不灭，账不清
 *   巡火          自动连播（底栏按钮）；隔扇 = 换幕遮带；灯谱 = 右侧刻度；更漏 = 底栏进度
 *
 * ── 每幕一手法 + 常驻活系统（禁止一次性入场充数）──
 *  01 点炉      萤群聚在炉数→化形「忆」字  常驻：粒子微颤 + 指针斥力场（canvas 粒子力场，硬顶 60）
 *  02 忆炉全景   忆炭力场悬浮      常驻：各炭独立漂浮积分 + 指针斥力（canvas 力场）
 *  03 忘坡      曲线描画+落点浮现  常驻：dash 流光 + 指针游标描画（指针驱动）
 *  04 水位      波面涌入          常驻：三层正弦积分；按住池面压水位（spring 积分）
 *  05 欠账      欠条错峰挂绳      常驻：各条悬挂摆（相位差钟摆）；悬停抬起
 *  06 阶石      阶柱错峰生长      常驻：一粒萤火沿阶巡行（确定性路径）
 *  07 墨晶      晶格点亮          常驻：高光在晶格间巡游 + 指针视差
 *  08 矿层      矿带铺开          常驻：扫描线巡行；悬停读数
 *  09 添柴志    柴束生长          常驻：柴顶火苗呼吸（相位差）；悬停报日
 *  10 长明      灯珠逐粒点燃      常驻：烛焰噪声摇曳 + 指针风（canvas）
 *  11 批改环    环形描画          常驻：环缓转 + 指针角度命中扇区放大
 *  12 基岩      石柱推进          常驻：光泽自左向右巡扫；悬停读数
 *  13 来潮      潮柱涨起          常驻：柱顶萤点闪（到期预告）；悬停报日
 *  14 四驻      塔灯升起          常驻：四塔呼吸灯（错相位）；悬停整塔亮
 *  15 批痕      刻痕凿入          常驻：微光巡行 + 指针视差；热数脉冲
 *  16 守夜人    四格账落定        常驻：萤群绕行（确定性轨道）+ 指针视差
 *
 * 硬规矩：目标量 build 期读好（--ph/--x/--w），逐帧只写不读；S()/T() 同值短路；
 * 无逐帧随机（build 期 rng）；画布 DPR + clearRect；DOM 只动 transform/opacity/filter。
 */
import type { RaData } from './data';
import { RA_RATING_NAMES, RA_RATING_ORDER } from './data';
import {
  at, clamp01, easeOut, easeInOut, easeBack, easeElastic, spring, stagger, rng,
  canvas, sampleText, rgba, qsa, rollTo, lerp, toward, type Palette,
  localAt, nearest, under, tip, type PointerAt,
} from './kits';

/** `px/py` = 指针归一化 -1..1（不在画面为 0）；`pin` = 指针在场标志；`cx/cy` = 客户端坐标 */
export interface PerfCtx { t: number; pal: Palette; px: number; py: number; cx: number; cy: number; pin: number }
export interface Perf {
  dur: number;
  update(ctx: PerfCtx): void;
  /** 指针事件（只在当前这一幕上调用）：move 只记状态，写画面交给 update */
  move?(p: PointerAt): void;
  down?(p: PointerAt): void;
  up?(): void;
}

/** 写样式：保留已有 --* 声明 + 同值不重写（逐帧调用安全） */
const lastStyle = new WeakMap<HTMLElement, string>();
const lastText = new WeakMap<HTMLElement, string>();
function S(el: HTMLElement | null | undefined, v: string): void {
  if (!el || lastStyle.get(el) === v) return;
  const prev = el.getAttribute('style') ?? '';
  if (prev) {
    const vars = prev.match(/--[\w-]+\s*:[^;]*/g);
    if (vars) {
      const keep = vars.filter((d) => !v.includes(`${d.split(':')[0].trim()}:`));
      if (keep.length) v = `${keep.join(';')};${v}`;
    }
  }
  lastStyle.set(el, v);
  el.setAttribute('style', v);
}
/** 写文本：同值不重写 */
function T(el: HTMLElement | null | undefined, v: string): void {
  if (!el || lastText.get(el) === v) return;
  lastText.set(el, v);
  el.textContent = v;
}

/** `root` = 层根（各幕 querySelector 作用域）；`host` = 浮签挂载点（= root，引擎统一收） */
export function buildPerfs(root: HTMLElement, data: RaData, host: HTMLElement = root): Map<string, Perf> {
  const out = new Map<string, Perf>();
  const scn = (id: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-id="${id}"]`);
  if (!scn('open')) return out;
  /** build 期读排版变量（parseFloat 容「12.8deg」这类带单位写法） */
  const vOf = (el: HTMLElement | null | undefined, name: string, fallback = 0): number => {
    const v = parseFloat(String(el?.style.getPropertyValue(name) ?? ''));
    return Number.isFinite(v) ? v : fallback;
  };

  /* ── 01 点炉：萤群聚成在炉数 → 化形「忆」字；常驻微颤 + 指针斥力（粒子硬顶 60） ── */
  {
    const s = scn('open') as HTMLElement;
    const cv = canvas(s, 'open');
    interface P { tx: number; ty: number; tx2: number; ty2: number; sx: number; sy: number; d: number; r: number; jade: boolean }
    let ps: P[] = [];
    let builtFor = 0;
    out.set('open', {
      dur: 4.2,
      update({ t, pal, px, py }) {
        if (cv) cv.fit();
        const w = cv?.w ?? 100, h = cv?.h ?? 100;
        if (cv && ps.length === 0 && w > 8) {
          builtFor = w;
          // 粒子硬顶 60（每系统）：两套靶点 = 在炉数数字 → 「忆」单字（大字号保点阵可读）
          const N = 60;
          const fontPx = Math.max(120, Math.min(h * .5, w * .3));
          const roll = rng(20260922);
          const resample = (text: string, fp: number): { x: number; y: number }[] => {
            const raw = sampleText(text, fp, 800, Math.max(3, Math.round(fp / 9)));
            if (!raw.length) return [];
            return Array.from({ length: N }, (_, i) => raw[Math.floor((i / N) * raw.length)]);
          };
          const a = resample(String(data.active), fontPx);
          const b = resample('忆', fontPx * .9);
          ps = a.map((p, i) => {
            const ang = (i / Math.max(1, N)) * Math.PI * 2 + roll() * .6;
            const rad = Math.max(w, h) * (.5 + roll() * .45);
            return {
              tx: p.x, ty: p.y, tx2: (b[i] ?? p).x, ty2: (b[i] ?? p).y,
              sx: Math.cos(ang) * rad, sy: Math.sin(ang) * rad * .68,
              d: roll() * .5, r: 2.2 + roll() * 2.6, jade: roll() < .2,
            };
          });
        } else if (cv && builtFor !== w && w > 8) {
          ps = [];
          builtFor = 0;
        }
        if (cv) {
          cv.clear();
          const ctx = cv.ctx;
          const cx = w / 2, cy = h / 2;
          const morph = easeInOut(at(t, 1.2, 2.7));
          const pxx = cx + (px * w) / 2, pyy = cy + (py * h) / 2;
          for (const p of ps) {
            const k = spring(clamp01((t - p.d) / 1.6), 5.2, 2.6);
            const txx = lerp(p.tx, p.tx2, morph), tyy = lerp(p.ty, p.ty2, morph);
            const jit = t > 2 ? 1.2 : 0;
            let x = cx + lerp(p.sx, txx, k) + Math.sin(t * 1.3 + p.tx * .05) * jit;
            let y = cy + lerp(p.sy, tyy, k) + Math.cos(t * 1.1 + p.ty * .06) * jit;
            if (px || py) {
              const dx = x - pxx, dy = y - pyy;
              const dist = Math.hypot(dx, dy);
              const R = Math.min(w, h) * .16;
              if (dist < R && dist > .001) {
                const f = (1 - dist / R) * 24 * (.35 + .65 * (1 - clamp01(k) * .6));
                x += (dx / dist) * f;
                y += (dy / dist) * f;
              }
            }
            ctx.globalAlpha = .16 + .84 * clamp01(k);
            ctx.fillStyle = rgba(p.jade ? pal.jadeRgb : pal.inkRgb, .8);
            ctx.beginPath();
            ctx.arc(x, y, p.r * (.45 + .55 * clamp01(k)), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          const sweep = at(t, .5, 1.7);
          if (sweep > 0 && sweep < 1) {
            const g = ctx.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, rgba(pal.jadeRgb, 0));
            g.addColorStop(.5, rgba(pal.jadeRgb, .12 * Math.sin(sweep * Math.PI)));
            g.addColorStop(1, rgba(pal.jadeRgb, 0));
            ctx.fillStyle = g;
            ctx.fillRect(0, cy - h * .3, w * sweep, h * .6);
          }
        }
      },
    });
  }

  /* ── 02 忆炉全景：每条在册一粒忆炭悬浮（canvas 力场 + 斥力 + 悬停报名） ── */
  {
    const s = scn('field') as HTMLElement;
    const cv = canvas(s, 'field');
    // build 期：活跃忆炭的状态表（最多 60 粒上屏，硬顶）
    const embers = data.liveEmbers.slice(0, 60).map((e) => ({ name: e.name, r: e.r, s: e.s, overdue: e.overdue }));
    let spots: { x: number; y: number }[] = [];
    let builtFor = 0;
    let hot = -1;
    out.set('field', {
      dur: 3.4,
      move(p) {
        hot = nearest(spots, localAt(cv?.el, p), .09);
        if (hot >= 0) {
          const e = embers[hot];
          const rTxt = e.r == null ? '阶梯期' : `R ${Math.round(e.r * 100)}%`;
          tip(host, `${e.name} · ${rTxt}`, p.cx, p.cy);
        } else tip(host, '');
      },
      update({ t, pal, px, py }) {
        if (cv) cv.fit();
        const w = cv?.w ?? 100, h = cv?.h ?? 100;
        if (cv && spots.length === 0 && w > 8 && embers.length) {
          builtFor = w;
          const roll = rng(777);
          // 炉膛椭圆散布：r 越低的越靠下（余温不足往下沉）。2026-09-23 修复构图：
          // 原基线 .94-.58 使点云永远挤在画布下 2/3、顶半屏全白像被截断——改 .84-.66
          // 摊满全高（含正弦扰动后大致 0.08h~0.92h），余温高低仍决定上下沉浮
          spots = embers.map((e) => {
            const depth = e.r == null ? .5 : 1 - e.r;
            const a = roll() * Math.PI * 2;
            const rx = w * .34, ry = h * .32;
            return {
              x: w / 2 + Math.cos(a) * rx * (.25 + .75 * roll()),
              y: h * (.84 - .66 * (1 - depth)) + Math.sin(a) * ry * .3,
            };
          });
        } else if (cv && builtFor !== w && w > 8) {
          spots = [];
          builtFor = 0;
        }
        if (cv) {
          cv.clear();
          const ctx = cv.ctx;
          const pxx = w / 2 + (px * w) / 2, pyy = h / 2 + (py * h) / 2;
          embers.forEach((e, i) => {
            const p = at(t, .9, i * .045);
            if (p <= 0) return;
            const base = spots[i] ?? { x: w / 2, y: h / 2 };
            // 常驻漂浮：每粒独立相位正弦积分（余温越足浮得越高越稳）
            const amp = e.r == null ? 3 : 2 + e.r * 4;
            const x = base.x + Math.sin(t * .9 + i * 1.7) * amp * .8;
            const y0 = lerp(h * 1.05, base.y, easeOut(p));
            const y = y0 + Math.cos(t * (.7 + (i % 5) * .1) + i) * amp;
            // 指针斥力
            let push = 0, pushA = 0;
            if (px || py) {
              const dx = x - pxx, dy = y - pyy;
              const dist = Math.hypot(dx, dy);
              const R = Math.min(w, h) * .13;
              if (dist < R && dist > .001) {
                push = (1 - dist / R) * 22;
                pushA = Math.atan2(dy, dx);
              }
            }
            const fx = x + Math.cos(pushA) * push, fy = y + Math.sin(pushA) * push;
            const tone = e.overdue ? pal.emberRgb : e.r == null ? pal.indigoRgb
              : e.r >= .7 ? pal.jadeRgb : e.r >= .4 ? pal.amberRgb : pal.emberRgb;
            const rad = (e.r == null ? 2.4 : 2 + e.r * 3.4) * (i === hot ? 1.9 : 1) * easeOut(p);
            const flick = .72 + .28 * Math.sin(t * (2.2 + (i % 7) * .3) + i * 2.1);
            const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad * 4.2);
            g.addColorStop(0, rgba(tone, .85 * flick));
            g.addColorStop(.35, rgba(tone, .3 * flick));
            g.addColorStop(1, rgba(tone, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(fx, fy, rad * 4.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = rgba(tone, .95);
            ctx.beginPath();
            ctx.arc(fx, fy, rad * .55, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      },
    });
  }

  /* ── 03 忘坡：幂律曲线族描画 + 忆炭落点；常驻 dash 流光 + 指针游标 ── */
  {
    const s = scn('slope') as HTMLElement;
    const cv = canvas(s, 'slope');
    const cursor = s.querySelector<HTMLElement>('[data-r="cursor"]');
    const oncliff = s.querySelector<HTMLElement>('[data-r="oncliff"]');
    const dots = qsa(s, '.ra-slope-dot');
    const REF_S = [3, 14, 45, 150]; // 四条参考坡的稳定性（天）
    let hotI = -1;
    out.set('slope', {
      dur: 3.6,
      move(p) {
        const dot = under<HTMLElement>(p, '.ra-slope-dot');
        hotI = dot ? Number(dot.dataset.i ?? -1) : -1;
        const l = localAt(cursor?.offsetParent as HTMLElement ?? null, p);
        if (hotI >= 0) {
          const e = data.liveEmbers.filter((x) => x.r != null && x.ageDays != null && x.s > 0)[hotI];
          if (e) tip(host, `${e.name} · 龄 ${Math.round(e.ageDays as number)} 天 / 稳 ${Math.round(e.s)} 天 · R ${Math.round((e.r as number) * 100)}%`, p.cx, p.cy);
        } else if (l) {
          tip(host, `龄期 ${Math.round(l.x * 3 * 10) / 10}×S`, p.cx, p.cy);
        } else tip(host, '');
      },
      update({ t, pal, px }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const padL = w * .07, padR = w * .05, padT = h * .12, padB = h * .14;
          const X = (u: number): number => padL + u * (w - padL - padR);
          const Y = (r: number): number => padT + (1 - r) * (h - padT - padB);
          const d = 0.9; // FSRS 默认衰减指数（与 fsrs.ts DEFAULT_D 同源口径）
          const grow = easeInOut(at(t, 1.9, .2));
          // 四条参考坡逐条描画
          REF_S.forEach((sV, si) => {
            const gp = clamp01(grow * 1.3 - si * .08);
            if (gp <= 0) return;
            ctx.beginPath();
            const steps = 60;
            for (let i = 0; i <= steps * gp; i++) {
              const u = i / steps;
              const r = Math.pow(1 + u * sV * 0 + (u * sV) / sV * 0 + u / 1 * sV / sV * 0 + (u) / (sV * d) * sV / sV * 0 + 0, 0); // 占位防误用
              void r;
              const rr = Math.pow(1 + (u * 3) / (sV * d), -d); // 横轴单位 = 3×S 的三倍龄窗（u∈0..1 → t = u·3S）
              if (i === 0) ctx.moveTo(X(u), Y(rr));
              else ctx.lineTo(X(u), Y(rr));
            }
            ctx.strokeStyle = rgba(pal.indigoRgb, .34 - si * .05);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          });
          // 网格与轴
          ctx.strokeStyle = rgba(pal.inkRgb, .1);
          ctx.lineWidth = 1;
          for (const gv of [0.25, 0.5, 0.75]) {
            ctx.beginPath(); ctx.moveTo(X(0), Y(gv)); ctx.lineTo(X(1), Y(gv)); ctx.stroke();
          }
          // 流光：一条沿主坡跑的高亮 dash（常驻）
          const dashT = (t * .35) % 1;
          const mainS = 14;
          ctx.setLineDash([10, 14]);
          ctx.lineDashOffset = -t * 26;
          ctx.beginPath();
          for (let i = 0; i <= 60; i++) {
            const u = i / 60;
            const rr = Math.pow(1 + (u * 3) / (mainS * d), -d);
            if (i === 0) ctx.moveTo(X(u), Y(rr));
            else ctx.lineTo(X(u), Y(rr));
          }
          ctx.strokeStyle = rgba(pal.jadeRgb, .5 * at(t, .6, 1.9));
          ctx.lineWidth = 1.6;
          ctx.stroke();
          ctx.setLineDash([]);
          void dashT;
          // 指针游标（描画）：指针横移时一根竖线 + 交点读数圈
          if (px && t > 1.2) {
            const u = clamp01((px + 1) / 2);
            ctx.strokeStyle = rgba(pal.inkRgb, .3);
            ctx.beginPath(); ctx.moveTo(X(u), Y(1)); ctx.lineTo(X(u), Y(0)); ctx.stroke();
            for (const sV of REF_S) {
              const rr = Math.pow(1 + (u * 3) / (sV * d), -d);
              ctx.fillStyle = rgba(pal.indigoRgb, .8);
              ctx.beginPath(); ctx.arc(X(u), Y(rr), 2.4, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
        // 落点浮现（DOM：build 期 --x/--y 已算好）
        dots.forEach((el, i) => {
          const p = at(t, .5, 1.4 + i * .028);
          const on = i === hotI && t > 2;
          S(el, `opacity:${(p * (on ? 1 : hotI >= 0 ? .4 : .9)).toFixed(3)}`
            + `;transform:translate(-50%,-50%) scale(${(on ? 2.1 : .55 + .45 * easeBack(p)).toFixed(3)})`
            + (on ? ';z-index:3' : ''));
        });
        if (oncliff) {
          const p = at(t, .6, 2.2);
          S(oncliff, `opacity:${p.toFixed(3)}`);
          T(oncliff, `${data.rBelow50 + data.rAbove90 === data.total ? 0 : Math.max(0, data.active - data.rBelow50 - data.rAbove90)} 篇`);
        }
      },
    });
  }

  /* ── 04 水位：波面涌入（三层正弦积分）；按住池面压水位（spring 积分） ── */
  {
    const s = scn('tide') as HTMLElement;
    const cv = canvas(s, 'tide');
    const gauge = s.querySelector<HTMLElement>('[data-r="gauge"]');
    const tplot = s.querySelector<HTMLElement>('[data-r="tplot"]');
    const target = data.avgR == null ? 0 : data.avgR;
    let shown = 0;      // 当前水位（0..1，向 target/按压目标积分）
    let pressAt: { x: number; y: number } | null = null;
    out.set('tide', {
      dur: 3.2,
      move(p) {
        if (pressAt) pressAt = localAt(tplot, p);
      },
      down(p) { pressAt = localAt(tplot, p); },
      up() { pressAt = null; },
      update({ t, pal }) {
        if (cv) cv.fit();
        const w = cv?.w ?? 100, h = cv?.h ?? 100;
        // 水位目标：数据值；按住池面时 = 指针 y（把水压下去）
        const want = pressAt ? clamp01(1 - pressAt.y) : target;
        const ramp = easeInOut(at(t, 2.2, .2));
        shown = t < .1 ? 0 : toward(shown, want * ramp, pressAt ? .09 : .05);
        const pct = Math.round(shown * 100);
        if (cv) {
          cv.clear();
          const ctx = cv.ctx;
          // 三层波：不同速度相位的正弦叠加（常驻涌动）
          const layers: Array<[string, number, number]> = [
            [pal.jadeRgb, .18, .0],
            [pal.jadeRgb, .26, 2.1],
            [pal.indigoRgb, .3, 4.2],
          ];
          layers.forEach(([rgb3, alpha, ph], li) => {
            ctx.beginPath();
            ctx.moveTo(0, h);
            const amp = h * (.03 + li * .012);
            const spd = .9 + li * .5;
            for (let x = 0; x <= w; x += 8) {
              const y = h * (1 - shown) + Math.sin(t * spd + ph + x / (w / (3 + li))) * amp
                + Math.sin(t * spd * .6 + x / (w / 1.7)) * amp * .5;
              ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fillStyle = rgba(rgb3, alpha);
            ctx.fill();
          });
          // 刻度线
          ctx.strokeStyle = rgba(pal.inkRgb, .14);
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 7]);
          for (const gv of [.25, .5, .75, 1]) {
            const y = h * (1 - gv);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
          }
          ctx.setLineDash([]);
          // 目标水位线（数据值）：红色虚线，按住时它提醒你「真实水位在这」
          if (target > 0) {
            const y = h * (1 - target);
            ctx.strokeStyle = rgba(pal.emberRgb, .5 * at(t, .5, 1));
            ctx.setLineDash([6, 6]);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        if (gauge) {
          // gauge 是全高轨道：translateY % 基于自身高（=plot 高），水位映射零 reflow
          S(gauge, `transform:translateY(${((1 - shown) * 100).toFixed(2)}%);opacity:${at(t, .4, .8).toFixed(3)}`);
          T(gauge.querySelector('b'), `${pct}%`);
        }
      },
    });
  }

  /* ── 05 欠账：红欠条错峰挂绳；常驻悬挂摆（相位差）；悬停抬起 ── */
  {
    const s = scn('debts') as HTMLElement;
    const debts = qsa(s, '.ra-debt');
    const rots = debts.map((el) => vOf(el, '--rot', 0));
    const swings = debts.map((el) => vOf(el, '--sw', 0));
    const total = s.querySelector<HTMLElement>('.ra-debt-total');
    let hotDebt = -1;
    out.set('debts', {
      dur: 2.8,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-debt');
        hotDebt = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        debts.forEach((el, i) => {
          const p = at(t, .5, .2 + i * .09);
          const on = i === hotDebt && t > 1.2;
          const swing = Math.sin(t * 1.15 + i * 1.9 + swings[i] * 6.28) * (1.6 + swings[i]);
          S(el, `opacity:${Math.min(1, p * 1.6).toFixed(3)}`
            + `;transform:translate(-50%,${((1 - easeBack(p)) * -26).toFixed(1)}px) rotate(${(rots[i] * easeOut(p) + swing * (on ? .2 : 1)).toFixed(2)}deg)`
            + (on ? ';z-index:3;filter:brightness(1.14)' : ''));
        });
        if (total) {
          const p = at(t, .6, 1.2);
          S(total, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 10).toFixed(1)}px)`);
        }
      },
    });
  }

  /* ── 06 阶石：阶柱错峰生长；一粒萤火沿阶常驻巡行；悬停报档 ── */
  {
    const s = scn('steppath') as HTMLElement;
    const steps = qsa(s, '.ra-step');
    const bars = steps.map((el) => el.querySelector<HTMLElement>('[data-r="stepbar"]'));
    const nums = steps.map((el) => el.querySelector<HTMLElement>('[data-r="stepn"]'));
    const fly = s.querySelector<HTMLElement>('[data-r="fly"]');
    const phs = steps.map((el) => vOf(el.querySelector<HTMLElement>('[data-r="stepbar"]'), '--ph', 0));
    const row = s.querySelector<HTMLElement>('[data-r="steps"]');
    let hotStep = -1;
    out.set('steppath', {
      dur: 3.0,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-step');
        hotStep = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        steps.forEach((el, i) => {
          const p = stagger(t, i, .12, .8);
          const on = i === hotStep && t > 1.6;
          S(bars[i], `height:${phs[i].toFixed(2)}%;transform:scaleY(${easeOut(p).toFixed(4)});transform-origin:bottom center`);
          S(el, `opacity:${(at(t, .4, i * .12) * (hotStep >= 0 && !on ? .55 : 1)).toFixed(3)}`);
          T(nums[i], String(Math.round((data.stageDist[i] || 0) * easeOut(p))));
        });
        // 萤火巡行：沿阶石顶端走（确定性：t 驱动，0..8 级往返）；位置走 --fx/--fy（同 --scan 口径）
        if (fly && row) {
          const span = steps.length - 1;
          const u = (Math.sin((t - 1.4) * .55) * .5 + .5) * span; // 往返巡行
          const i0 = Math.floor(u), i1 = Math.min(span, i0 + 1);
          const f = u - i0;
          const h0 = phs[i0] / 100, h1 = phs[i1] / 100;
          const lift = lerp(12 + h0, 12 + h1, easeInOut(f)); // 柱顶上方 12%
          const left = ((u + .5) / steps.length) * 100;
          const glow = .5 + .5 * Math.sin(t * 3);
          S(fly, `--fx:${left.toFixed(2)}%;--fy:${lift.toFixed(2)}%;opacity:${(at(t, .4, 1.4) * (.55 + .45 * glow)).toFixed(3)}`);
        }
      },
    });
  }

  /* ── 07 墨晶：四块晶格画布（晶体重量 = 档内篇数）；高光巡游 + 指针视差 ── */
  {
    const s = scn('crystal') as HTMLElement;
    const blocks = qsa(s, '.ra-crystal');
    const cvs = blocks.map((_, i) => canvas(s, `crystal${i}`));
    const ns = data.sBuckets.map((b) => b.n);
    const weights = blocks.map((el) => vOf(el, '--w', 0));
    const crow = s.querySelector<HTMLElement>('[data-r="crow"]');
    const numsEls = blocks.map((el) => el.querySelector<HTMLElement>('[data-r="cn"]'));
    let hotC = -1;
    out.set('crystal', {
      dur: 3.2,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-crystal');
        hotC = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t, pal, px, py }) {
        if (crow && t > 1.8) {
          S(crow, `transform:perspective(1100px) rotateX(${(-py * 2.6).toFixed(2)}deg) rotateY(${(px * 3).toFixed(2)}deg)`);
        }
        blocks.forEach((el, i) => {
          const p = at(t, .7, i * .16);
          const on = i === hotC && t > 1.6;
          S(el, `opacity:${(at(t, .3, i * .16) * (hotC >= 0 && !on ? .5 : 1)).toFixed(3)}`
            + `;transform:translateY(${((1 - easeOut(p)) * 14 - (on ? 6 : 0)).toFixed(1)}px)`);
          T(numsEls[i], String(Math.round(ns[i] * easeOut(p))));
          const cv = cvs[i];
          if (!cv) return;
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const weight = weights[i];
          if (weight <= 0) {
            // 空档：画一枚轮廓虚晶（说明这里是空的，不是坏了）
            ctx.strokeStyle = rgba(pal.inkRgb, .12);
            ctx.setLineDash([3, 5]);
            hexPath(ctx, w / 2, h * .62, Math.min(w, h) * .16);
            ctx.stroke();
            ctx.setLineDash([]);
            return;
          }
          // 六边形堆积晶格：中轴一列 + 两侧递减，晶格大小随重量
          const base = Math.min(w, h) * (.09 + .13 * weight);
          const glowU = ((t * .22 + i * .37) % 1); // 高光巡游（确定性）
          ctx.lineWidth = 1.1;
          const rowsN = 5;
          let idx = 0;
          for (let r = 0; r < rowsN; r++) {
            const count = rowsN - r;
            for (let c = 0; c < count; c++) {
              const cx = w / 2 + (c - (count - 1) / 2) * base * 1.78;
              const cy = h * .88 - r * base * 1.54;
              const size = base * (.8 + .3 * Math.sin(idx * 3.7));
              const appear = clamp01(at(t, .5, i * .16 + idx * .05));
              // 高光经过哪块：沿生成序号走
              const near = Math.exp(-Math.pow(glowU * (rowsN * rowsN) - idx, 2) / 3.2);
              ctx.strokeStyle = rgba(pal.jadeRgb, (.24 + .6 * near) * appear);
              ctx.fillStyle = rgba(pal.jadeRgb, (.06 + .16 * near + .1 * weight) * appear);
              hexPath(ctx, cx, cy, size * easeBack(appear));
              ctx.fill();
              ctx.stroke();
              idx++;
            }
          }
          void on;
        });
      },
    });
  }

  /* ── 08 矿层：四条矿带铺开；扫描线巡行；悬停读数 ── */
  {
    const s = scn('strata') as HTMLElement;
    const strata = qsa(s, '.ra-stratum');
    const phs = strata.map((el) => vOf(el, '--ph', 0));
    const nsEls = strata.map((el) => el.querySelector<HTMLElement>('[data-r="stn"]'));
    const ns = data.dBuckets.map((b) => b.n);
    const bed = s.querySelector<HTMLElement>('[data-r="bed"]');
    let hotSt = -1;
    out.set('strata', {
      dur: 2.6,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-stratum');
        hotSt = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        strata.forEach((el, i) => {
          const p = stagger(t, i, .16, .7);
          const on = i === hotSt && t > 1.2;
          S(el, `--scan:${(t > 1 ? ((t - 1) % 4.4) / 4.4 : -1).toFixed(4)}`
            + `;transform:scaleX(${(easeOut(p) * (on ? 1.02 : 1)).toFixed(4)});transform-origin:left center`
            + `;opacity:${(at(t, .4, i * .16) * (hotSt >= 0 && !on ? .5 : 1)).toFixed(3)}`);
          T(nsEls[i], String(Math.round(ns[i] * easeOut(p))));
        });
        if (bed) S(bed, `transform:perspective(1100px) rotateY(${(0).toFixed(2)}deg)`);
      },
    });
  }

  /* ── 09 添柴志：柴束错峰生长；柴顶火苗常驻呼吸；悬停报日期 ── */
  {
    const s = scn('dailies') as HTMLElement;
    const woods = qsa(s, '.ra-wood');
    const bars = woods.map((el) => el.querySelector<HTMLElement>('[data-r="woodbar"]'));
    const flames = woods.map((el) => el.querySelector<HTMLElement>('[data-r="flame"]'));
    const phs = woods.map((el) => vOf(el, '--ph', 0));
    const wTotal = s.querySelector<HTMLElement>('[data-r="woodTotal"]');
    let hotW = -1;
    out.set('dailies', {
      dur: 2.8,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-wood');
        hotW = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        woods.forEach((el, i) => {
          const p = stagger(t, i, .09, .6);
          const on = i === hotW && t > 1.4;
          S(bars[i], `height:${phs[i].toFixed(2)}%;transform:scaleY(${easeOut(p).toFixed(4)});transform-origin:bottom center`);
          // 火苗呼吸：有柴才亮（ph>0），相位差常驻
          const alive = phs[i] > 0 && p > .9 ? 1 : 0;
          const breath = .45 + .55 * Math.sin(t * 2.3 + i * 1.4);
          S(flames[i], `opacity:${(alive * (.35 + .65 * breath) * (on ? 1.4 : 1)).toFixed(3)}`
            + `;transform:translateX(-50%) scale(${(on ? 1.5 : .8 + .3 * breath).toFixed(3)})`);
          S(el, `opacity:${(at(t, .3, i * .09) * (hotW >= 0 && !on ? .55 : 1)).toFixed(3)}`);
        });
        if (wTotal) {
          const p = easeOut(at(t, 1.4, .6));
          T(wTotal, rollTo(data.dailyTotal, p));
        }
      },
    });
  }

  /* ── 10 长明：灯珠逐粒点燃；烛焰画布常驻摇曳 + 指针风；连燃数滚数 ── */
  {
    const s = scn('vigil') as HTMLElement;
    const cv = canvas(s, 'vigil');
    const beads = qsa(s, '.ra-bead');
    const streakN = s.querySelector<HTMLElement>('[data-r="streakN"]');
    out.set('vigil', {
      dur: 3.4,
      update({ t, pal, px, py }) {
        beads.forEach((el, i) => {
          const p = at(t, .3, .4 + i * .075);
          const lit = p > 0 ? 1 : 0;
          const pulse = i === beads.length - 1 && p >= 1 ? .4 + .6 * Math.abs(Math.sin(t * 1.8)) : 1;
          S(el, `opacity:${(lit * (i === beads.length - 1 ? pulse : .3 + .7 * p)).toFixed(3)}`
            + `;transform:scale(${(.4 + .6 * easeBack(p)).toFixed(3)})`);
        });
        if (streakN) {
          const p = easeOut(at(t, 1.6, .8));
          T(streakN, rollTo(data.streak, p));
        }
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const cx = w / 2, baseY = h * .92;
          const lit = data.streak > 0 ? 1 : easeInOut(at(t, .8, .3));
          // 烛焰：两段正弦噪声叠加的泪滴形（常驻摇曳）；指针 = 风（火苗朝反方向倾）
          const lean = -px * 10 * lit;
          const sway = Math.sin(t * 2.1) * 4 + Math.sin(t * 3.7 + 1.2) * 2;
          const flameH = h * (.34 + .05 * Math.sin(t * 1.6)) * lit;
          const tipX = cx + lean + sway;
          const g = ctx.createLinearGradient(cx, baseY, tipX, baseY - flameH);
          g.addColorStop(0, rgba(pal.amberRgb, .85 * lit));
          g.addColorStop(.55, rgba(pal.jadeRgb, .55 * lit));
          g.addColorStop(1, rgba(pal.jadeRgb, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(cx - 7 * lit, baseY);
          ctx.quadraticCurveTo(cx - 9 + lean * .4, baseY - flameH * .5, tipX, baseY - flameH);
          ctx.quadraticCurveTo(cx + 9 + lean * .4, baseY - flameH * .5, cx + 7, baseY);
          ctx.closePath();
          ctx.fill();
          // 灯芯
          ctx.strokeStyle = rgba(pal.inkRgb, .5 * at(t, .3, .1));
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(cx, baseY + 4); ctx.lineTo(cx, baseY - 6); ctx.stroke();
          // 底座
          ctx.fillStyle = rgba(pal.inkRgb, .18);
          ctx.beginPath(); ctx.ellipse(cx, baseY + 8, 22, 4.5, 0, 0, Math.PI * 2); ctx.fill();
          void py;
        }
      },
    });
  }

  /* ── 11 批改环：环形描画（扇区按评级分布）；常驻缓转 + 指针角度命中 ── */
  {
    const s = scn('verdicts') as HTMLElement;
    const cv = canvas(s, 'verdicts');
    const vRows = qsa(s, '[data-r="vk"]');
    const TOTAL = Math.max(1, RA_RATING_ORDER.reduce((a, k) => a + (data.ratingDist[k] || 0), 0));
    let hotK = -1;
    const toneOf = (k: string): keyof Palette | 'inkRgb' =>
      k === 'again' ? 'emberRgb' : k === 'hard' ? 'amberRgb' : k === 'good' ? 'jadeRgb' : 'inkRgb';
    out.set('verdicts', {
      dur: 3.2,
      move(p) {
        const row = under<HTMLElement>(p, '[data-r="vk"]');
        if (row) { hotK = RA_RATING_ORDER.indexOf((row.dataset.k ?? '') as typeof RA_RATING_ORDER[number]); return; }
        // 环是画布：按角度找扇区
        const l = localAt(cv?.el, p);
        if (!l) { hotK = -1; tip(host, ''); return; }
        const ang = (Math.atan2(l.y - .5, l.x - .5) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
        let acc = 0;
        hotK = -1;
        for (let i = 0; i < RA_RATING_ORDER.length; i++) {
          const frac = (data.ratingDist[RA_RATING_ORDER[i]] || 0) / TOTAL;
          if (frac <= 0) continue;
          if (ang >= acc && ang < acc + frac * Math.PI * 2) { hotK = i; break; }
          acc += frac * Math.PI * 2;
        }
        if (hotK >= 0) {
          const k = RA_RATING_ORDER[hotK];
          tip(host, `${RA_RATING_NAMES[k]} · ${data.ratingDist[k] || 0} 次`, p.cx, p.cy);
        } else tip(host, '');
      },
      update({ t, pal }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const cx = w / 2, cy = h / 2;
          const R = Math.min(w, h) * .36, rIn = R * .58;
          const spin = t > 2 ? (t - 2) * .12 : 0; // 常驻缓转
          let a0 = -Math.PI / 2 + spin;
          const grow = easeInOut(at(t, 2.2, .3));
          RA_RATING_ORDER.forEach((k, i) => {
            const frac = (data.ratingDist[k] || 0) / TOTAL;
            if (frac <= 0) return;
            const sweep = frac * Math.PI * 2 * grow;
            const on = i === hotK;
            const rOut = R * (on ? 1.07 : 1);
            ctx.beginPath();
            ctx.arc(cx, cy, rOut, a0, a0 + sweep);
            ctx.arc(cx, cy, rIn, a0 + sweep, a0, true);
            ctx.closePath();
            const toneKey = toneOf(k);
            const tone = (pal as unknown as Record<string, string>)[toneKey] ?? pal.ink;
            const rgb3 = (pal as unknown as Record<string, string>)[`${toneKey.replace('Rgb', '')}`] ?? '';
            void rgb3;
            ctx.fillStyle = tone.startsWith('rgb') ? tone : `rgba(${tone},.8)`;
            ctx.globalAlpha = (on ? 1 : hotK >= 0 ? .42 : .88) * Math.min(1, grow * 1.4);
            ctx.fill();
            ctx.globalAlpha = 1;
            a0 += frac * Math.PI * 2;
          });
          // 环心：批改总数
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = rgba(pal.inkRgb, at(t, .5, 1));
          ctx.font = `700 ${Math.round(Math.min(w, h) * .14)}px "Segoe UI", system-ui, sans-serif`;
          ctx.fillText(String(Math.round(data.verdictTotal * grow)), cx, cy);
          ctx.font = `${Math.round(Math.min(w, h) * .07)}px "Segoe UI", system-ui, sans-serif`;
          ctx.fillStyle = rgba(pal.inkRgb, .5 * at(t, .5, 1.2));
          ctx.fillText('次批改', cx, cy + Math.min(w, h) * .11);
        }
        // 图例联动
        vRows.forEach((row, i) => {
          const on = i === hotK;
          S(row, `opacity:${(at(t, .4, .6 + i * .1) * (hotK >= 0 && !on ? .45 : 1)).toFixed(3)}`
            + `;transform:translateX(${(on ? 6 : 0).toFixed(1)}px)`);
        });
      },
    });
  }

  /* ── 12 基岩：石柱推进（S 高低）；光泽自左向右巡扫；悬停读数 ── */
  {
    const s = scn('bedrock') as HTMLElement;
    const rows = qsa(s, '.ra-bed');
    const bars = rows.map((el) => el.querySelector<HTMLElement>('[data-r="bedbar"]'));
    const shines = rows.map((el) => el.querySelector<HTMLElement>('[data-r="shine"]'));
    const phs = rows.map((el) => vOf(el, '--ph', 0));
    let hotB = -1;
    out.set('bedrock', {
      dur: 3.0,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-bed');
        hotB = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        rows.forEach((el, i) => {
          const p = stagger(t, i, .14, .9);
          const on = i === hotB && t > 1.5;
          S(bars[i], `width:${phs[i].toFixed(2)}%;transform:scaleX(${easeOut(p).toFixed(4)});transform-origin:left center`
            + `;filter:${on ? 'brightness(1.18)' : 'none'}`);
          S(shines[i], `opacity:${(p >= 1 ? .4 + .5 * Math.max(0, Math.sin(t * 1.1 + i * .9)) : 0).toFixed(3)}`
            + `;transform:translateX(${(((((t * 22 + i * 60) % 160)) - 30)).toFixed(1)}px)`);
          S(el, `opacity:${(at(t, .3, i * .14) * (hotB >= 0 && !on ? .5 : 1)).toFixed(3)}`
            + `;transform:translateX(${(on ? 8 : 0).toFixed(1)}px)`);
        });
      },
    });
  }

  /* ── 13 来潮：潮柱涨起；柱顶萤点常驻闪（到期预告）；悬停报日期 ── */
  {
    const s = scn('portide') as HTMLElement;
    const bars = qsa(s, '.ra-tidebar');
    const columns = bars.map((el) => el.querySelector<HTMLElement>('[data-r="tidebar"]'));
    const numsEls = bars.map((el) => el.querySelector<HTMLElement>('[data-r="tidebarN"]'));
    const flies = bars.map((el) => el.querySelector<HTMLElement>('[data-r="tidefly"]'));
    const phs = bars.map((el) => vOf(el, '--ph', 0));
    const counts = data.next8.map((d) => d.count);
    let hotT = -1;
    out.set('portide', {
      dur: 2.8,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-tidebar');
        hotT = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        bars.forEach((el, i) => {
          const p = stagger(t, i, .11, .7);
          const on = i === hotT && t > 1.4;
          S(columns[i], `height:${phs[i].toFixed(2)}%;transform:scaleY(${easeOut(p).toFixed(4)});transform-origin:bottom center`
            + `;filter:${on ? 'brightness(1.2)' : 'none'}`);
          T(numsEls[i], String(Math.round((counts[i] || 0) * easeOut(p))));
          // 萤点：有排程的日子常驻闪（预告潮水将至）
          const alive = (counts[i] || 0) > 0 && p >= 1 ? 1 : 0;
          const blink = .3 + .7 * Math.abs(Math.sin(t * 1.7 + i * 1.1));
          S(flies[i], `opacity:${(alive * blink * (on ? 1 : .8)).toFixed(3)}`
            + `;transform:translate(-50%,${(-4 - 3 * Math.sin(t * 2 + i)).toFixed(1)}px) scale(${(on ? 1.5 : 1).toFixed(2)})`);
          S(el, `opacity:${(at(t, .3, i * .11) * (hotT >= 0 && !on ? .55 : 1)).toFixed(3)}`);
        });
      },
    });
  }

  /* ── 14 四驻：塔灯升起（逾期/今日/未来/已完成）；常驻呼吸灯（错相位）；悬停整塔亮 ── */
  {
    const s = scn('quarters') as HTMLElement;
    const quarters = qsa(s, '.ra-quarter');
    const lamps = quarters.map((el) => el.querySelector<HTMLElement>('[data-r="qlamp"]'));
    const numsEls = quarters.map((el) => el.querySelector<HTMLElement>('[data-r="qn"]'));
    const phs = quarters.map((el) => vOf(el, '--ph', 0));
    const counts = [data.overdueN, data.todayN, data.futureN, data.doneColN];
    let hotQ = -1;
    out.set('quarters', {
      dur: 2.8,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-quarter');
        hotQ = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        quarters.forEach((el, i) => {
          const p = stagger(t, i, .16, .8);
          const on = i === hotQ && t > 1.5;
          S(el, `opacity:${(at(t, .3, i * .16) * (hotQ >= 0 && !on ? .5 : 1)).toFixed(3)}`
            + `;transform:translateY(${((1 - easeOut(p)) * 16 - (on ? 6 : 0)).toFixed(1)}px)`
            + `;--breathe:${(.5 + .5 * Math.sin(t * 1.4 + i * 1.6)).toFixed(3)}`);
          S(lamps[i], `transform:scaleY(${easeOut(p).toFixed(4)});transform-origin:bottom center`
            + `;filter:brightness(${(on ? 1.4 : .8 + .45 * Math.abs(Math.sin(t * 1.4 + i * 1.6))).toFixed(3)})`);
          T(numsEls[i], String(Math.round((counts[i] || 0) * easeOut(p))));
        });
      },
    });
  }

  /* ── 15 批痕：刻痕凿入（末次评级分布）；微光巡行 + 指针视差；待重做热数 ── */
  {
    const s = scn('marks') as HTMLElement;
    const marks = qsa(s, '.ra-mark');
    const cuts = marks.map((el) => el.querySelector<HTMLElement>('[data-r="cut"]'));
    const numsEls = marks.map((el) => el.querySelector<HTMLElement>('[data-r="markn"]'));
    const phs = marks.map((el) => vOf(el, '--ph', 0));
    const mrow = s.querySelector<HTMLElement>('[data-r="mrow"]');
    const counts = RA_RATING_ORDER.map((k) => data.lastDiffDist[k] || 0);
    let hotM = -1;
    out.set('marks', {
      dur: 2.8,
      move(p) {
        const el = under<HTMLElement>(p, '.ra-mark');
        hotM = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t, px, py }) {
        if (mrow && t > 1.6) {
          S(mrow, `transform:perspective(1100px) rotateY(${(px * 2.4).toFixed(2)}deg) rotateX(${(-py * 1.8).toFixed(2)}deg)`);
        }
        marks.forEach((el, i) => {
          const p = stagger(t, i, .14, .55);
          const on = i === hotM && t > 1.4;
          // 凿痕：scaleX 快速凿入（back 过冲像一记凿击）
          S(cuts[i], `transform:scaleX(${easeBack(p).toFixed(4)});transform-origin:left center`
            + `;filter:${on ? 'brightness(1.3)' : 'none'}`);
          const sheen = p >= 1 ? Math.max(0, Math.sin(t * .9 + i * 1.3)) : 0;
          S(el, `opacity:${(at(t, .3, i * .14) * (hotM >= 0 && !on ? .5 : 1)).toFixed(3)}`
            + `;--sheen:${sheen.toFixed(3)}`);
          T(numsEls[i], String(Math.round((counts[i] || 0) * easeOut(p))));
        });
      },
    });
  }

  /* ── 16 守夜人：四格账落定（滚数）；萤群绕行画布（确定性轨道）+ 指针视差 ── */
  {
    const s = scn('keeper') as HTMLElement;
    const cv = canvas(s, 'colo');
    const coloN = s.querySelector<HTMLElement>('[data-r="coloN"]');
    const coloA = s.querySelector<HTMLElement>('[data-r="coloA"]');
    const coloD = s.querySelector<HTMLElement>('[data-r="coloD"]');
    const coloS = s.querySelector<HTMLElement>('[data-r="coloS"]');
    const roll = rng(4242);
    out.set('keeper', {
      dur: 3.4,
      update({ t, pal, px, py }) {
        const dp = (delay: number): number => easeOut(at(t, 1.2, delay));
        T(coloN, rollTo(data.total, dp(.2)));
        T(coloA, rollTo(data.active, dp(.45)));
        T(coloD, rollTo(data.doneN, dp(.7)));
        T(coloS, rollTo(data.streak, dp(.95)));
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const cx = w / 2 + px * 8, cy = h / 2 + py * 6;
          const appear = at(t, 1.2, .4);
          // 萤群：18 只沿各自椭圆轨道绕行（确定性：build 期 rng 生成参数）
          for (let i = 0; i < 18; i++) {
            const a = roll() * Math.PI * 2;
            const rx = Math.min(w, h) * (.28 + roll() * .22);
            const ry = rx * (.5 + roll() * .3);
            const spd = .25 + roll() * .4;
            const ph = roll() * Math.PI * 2;
            const u = t * spd + ph;
            const x = cx + Math.cos(u) * rx;
            const y = cy + Math.sin(u * .92 + a) * ry;
            const tw = .35 + .65 * Math.abs(Math.sin(t * 1.9 + i * 2.3));
            ctx.fillStyle = rgba(pal.jadeRgb, .5 * tw * appear);
            ctx.beginPath(); ctx.arc(x, y, 1.6 + tw, 0, Math.PI * 2); ctx.fill();
          }
          // 中心一枚慢呼吸的大萤（守夜人本身）
          const breathe = .5 + .5 * Math.sin(t * 1.1);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 + breathe * 12);
          g.addColorStop(0, rgba(pal.amberRgb, .3 * appear));
          g.addColorStop(1, rgba(pal.amberRgb, 0));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(cx, cy, 42 + breathe * 12, 0, Math.PI * 2); ctx.fill();
        }
      },
    });
  }

  return out;
}

/** 六边形路径（墨晶幕晶格用） */
function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
