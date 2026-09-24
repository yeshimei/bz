/**
 * 观影志 · 25 幕的表演（时间驱动，不是被滚动进度抽着走）
 *
 * 一幕被翻到时「演一遍」：`t` 从 0 起算的秒数，每幕自己排进场（stagger + 各自缓动）、
 * 常驻（t 越过后进入呼吸/漂流/扫描这类氛围循环）、再到定格。翻走时引擎用
 * `update({ t: dur })` 把它推到终态——回头再看不会看到半截画面。
 *
 * 两条硬规矩（都是上一稿踩出来的）：
 *  1. **目标量一律在 build 期取好**（`--ph` / `--w` / `--x` 这些），逐帧只写不读——
 *     既省掉每帧的样式读，也不会出现「写完把自己的自定义属性抹掉、下一帧归零」；
 *  2. `S()` 保留元素上已有的 `--*` 声明并自带记忆（同值不重写），
 *     所以「整段写 cssText」不会顺手把排版用的变量擦掉。
 *
 * 手法清单（一幕一种，不重复）：流场萤火拖尾 / 折线描画 / 日历逐格点亮 / 柱状弹性生长 /
 * 链条串珠 / 直方图 + 里程表 / 双向滑出标尺 / 条形错峰 / 堆叠流图 / 印章落纸 / 河流冲刷 /
 * 抽屉拉开 / 均值线扫过 / 背靠背双峰 / 天平阻尼摆动 / 纵深飞入 / 对角波浪翻牌 / 右侧推入 /
 * 弧线归位 / 扇面摊开 / 磁带延展 / 打字机 / 弹幕漂流 / 热力矩阵扫行 / 落款错峰
 */
import { YB_TITLE, type YbData } from './data';
import { boxLogicalRect } from '../../core/landscape';
import {
  at, clamp01, easeOut, easeInOut, easeBack, easeElastic, spring, stagger,
  canvas, sampleText, rgba, qsa, humanDur, humanDurShort, setFlap, lerp, type Palette,
  localAt, nearest, under, tip, toward, type PointerAt,
} from './kits';

/** `px/py` = 指针位置（归一化 -1..1，指针不在画面里时是 0）；各幕自己决定要不要跟着走 */
export interface PerfCtx { t: number; pal: Palette; px: number; py: number; pin: number }
export interface Perf {
  dur: number;
  update(ctx: PerfCtx): void;
  /** 指针事件（只在**当前这一幕**上调用）：`move` 只在指针动时来、不是每帧来，
   *  所以这里只记状态（悬停到谁、指针在哪块里），把它变成画面的事交给 `update`。 */
  move?(p: PointerAt): void;
  /** 按住 / 松开（打分天平这种要压着才有手感的一幕用） */
  down?(p: PointerAt): void;
  up?(): void;
}

/** 写样式：保留已有 `--*` 声明 + 同值不重写（逐帧调用也安全） */
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
/** 数字位（逐位 `<i>`）：只在整个字符串变了时重建 */
function DGS(el: HTMLElement | null | undefined, v: string): void {
  if (!el || lastText.get(el) === v) return;
  lastText.set(el, v);
  el.innerHTML = [...v].map((ch) => (/\d/.test(ch) ? `<i>${ch}</i>` : `<i class="lit">${ch === ' ' ? '&nbsp;' : ch}</i>`)).join('');
}
const esc0 = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** `root` = 影片根（各幕 querySelector 的作用域）；`host` = 浮签挂载点（默认同 root）。
 *  引擎要在翻幕时统一收掉浮签，它拿到的是整屏根 —— 两边必须挂**同一个**元素，
 *  否则一边建、一边清，浮签会赖着不走（实测踩过：切幕后上一层楼的读数还挂在画面上）。 */
export function buildPerfs(root: HTMLElement, data: YbData, host: HTMLElement = root): Map<string, Perf> {
  const out = new Map<string, Perf>();
  const scn = (id: string): HTMLElement | null => root.querySelector<HTMLElement>(`[data-id="${id}"]`);
  if (!scn('open')) return out;
  /** `--x` / `--ph` / `--a(deg)` 这类排版变量：build 期读一次。
   *  用 parseFloat 而不是 Number——`12.86deg` 这种带单位的写法 Number 会得 NaN，
   *  一路回落到 fallback（指针就永远指着起点，实测踩过）。 */
  const vOf = (el: HTMLElement | null | undefined, name: string, fallback = 0): number => {
    const v = parseFloat(String(el?.style.getPropertyValue(name) ?? ''));
    return Number.isFinite(v) ? v : fallback;
  };

  /* ── 01 开卷：流场萤火（探索稿 v4 上岸，2026-09-24 用户拍板）──
     粒子骑在慢速流场上（伪 curl：几层不同频率正弦叠出方向角），像萤火群顺气流游动；
     画布不清屏、每帧向透明擦一层（destination-out）——旧迹渐渐隐去露出纸面，
     光迹拖尾是这一幕的标志手感；开场 0.9s 整体淡入（满屏出生点瞬显会闪一下）。
     未移入：粒子（栗子）锚在出生点原地轻晃，不游荡；鼠标移入立即聚合，直接成片名
     「观影分析」。聚齐之后全靠手玩（2026-09-24「栗子逻辑」二次拍板）：
     快扫字面 → 栗子被打飞、脱队坠落盒底堆积；快扫盒底的堆 → 栗子被扬回天上、飞回
     各自字位——可以把整片字扫空，再把它们全部扫回来；慢挪只是轻抚，不脱队。
     另有偶发流星曳光；暗色主题下萤火转荧光、堆底如余烬明灭。 */
  {
    const s = scn('open')!;
    const cv = canvas(host, 'open'); // 画布在层框（.bz-yb-box）直下满铺（yearbookOpenHtml），不在幕里
    const boxEl = cv?.el.closest<HTMLElement>('.bz-yb-box') ?? null; // 层框：旋转态判定与坐标换算都认它
    interface P {
      x: number; y: number; pxl: number; pyl: number; vx: number; vy: number;
      ax: number; ay: number; d: number; r: number;
      kind: 0 | 1 | 2; ph: number; wr: number; ws: number; fm: number;
      hx: number; hy: number;
      air: 0 | 1 | 3 | 4; // 0=在位 1=下坠 3=堆底 4=归位途中（全靠手扫，不自动）
    }
    let ps: P[] = [];
    let builtFor = 0;
    let lastT = 0;
    // 聚合起点（鼠标首次移入才起表）：null = 还在满布游荡待命；叙事时间轴 tt 全挂在它上
    let claimAt: number | null = null;
    // 指针状态：update 的 px/py 是归一化坐标，这里换算回画布像素，另记速度与场强包络
    const pt = { x: 0, y: 0, in: false, vx: 0, vy: 0, ds: 0, was: false };
    // 叙事拍点：鼠标移入起表，0.9 起错峰认领 → ≈3.0 收齐成片名（直排片名，不再先出数字）
    const CLAIM_AT = .9, CLAIM_SPAN = .9, CLAIM_DUR = 1.2;
    // 动力学常数（px/s²、1/s；自由巡航 ≈ FLOW/DAMP_FREE ≈ 58px/s）
    const N = 1200, FLOW = 150, ATTR = 42, DAMP_FREE = 2.6, DAMP_LOCK = 8.5, VCAP = 640;
    // 栗子物理：重力 300（柔坠）、弹性 .55（多段反弹），坠粒齐落在纸面卡下缘一线堆积；
    // 快扫字面才打飞（KNOCK=指针速度档，慢挪不脱队），栗子沿手势正前方**扇形飞溅**
    // （SPLASH=扇形半角，速度/角度各带随机），弹道之后才被重力拉坠；快扫盒底的堆则整把扬回；
    // 扫入半径 = min(w,h)*SWEEP_R；METEOR_*=流星节奏
    const GRAV = 300, DAMP_FALL = 1.1, BOUNCE = .55, FLOOR_MARGIN = 3,
      KNOCK = .25, SWEEP_R = .08, SPLASH = .62, METEOR_FROM = 3, METEOR_EVERY = 3.5, METEOR_SPAN = 6;
    const WRAP = 140; // 出生撒点可越出屏幕的余量（聚合时从屏外四面八方汇进纸面卡）
    const HOME_K = 30, SWAY = 42; // 未移入时锚在出生点：回位劲度 + 慢晃/微颤幅度
    /** 流场：几层不同频率正弦叠出方向角（弧度）；时间项系数都很小——气流慢漂 */
    const flowAngle = (x: number, y: number, t: number): number =>
      Math.sin(x * .0031 + t * .22) * 1.9 + Math.sin(y * .0026 - t * .17) * 1.6 +
      Math.sin((x + y) * .0014 + t * .11) * 1.2 + Math.sin((x - y) * .0043 - t * .09) * .7;
    /** 认领：每粒按最近靶点吸附——贪心从「靶点侧」挑最近未认领的粒，等长下恰成双射，
     *  笔画密度均匀。一次性 O(n²)（≈1.4M 次比较），构建期跑一次无压力。 */
    const assign = (targets: { x: number; y: number }[], ref: { x: number; y: number }[]): Int32Array => {
      const n = targets.length;
      const used = new Uint8Array(n);
      const idx = new Int32Array(n);
      const order = new Int32Array(n);
      for (let i = 0; i < n; i++) order[i] = i;
      for (let i = n - 1; i > 0; i--) { // 洗牌：消除扫描线顺序的系统性偏置
        const k = (Math.random() * (i + 1)) | 0;
        const tmp = order[i]; order[i] = order[k]; order[k] = tmp;
      }
      for (let q = 0; q < n; q++) {
        const j = order[q];
        let best = 0, bd = Infinity;
        const tx = targets[j].x, ty = targets[j].y;
        for (let i = 0; i < n; i++) {
          if (used[i]) continue;
          const dx = ref[i].x - tx, dy = ref[i].y - ty;
          const dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = i; }
        }
        used[best] = 1; idx[j] = best;
      }
      return idx;
    };
    /** 构建：直接取样片名 YB_TITLE 一套字靶（2026-09-24 拍板：不再先排总藏量数字）。
     *  字的大小与中心锚定**纸面卡**（幕 rect，画布满屏后不能拿窗口尺寸当字号基准），
     *  字号此番调大（.5/.26）；出生撒满整窗、一部分超出屏幕之外 */
    const build = (w: number, h: number): void => {
      if (!cv) return;
      builtFor = w;
      // 纸面卡矩形必须是**逻辑**坐标（画布位图同系）：旋转态下 getBoundingClientRect 是
      // 视觉值，直接当逻辑用会把字靶甩到框外——真机上聚合跑到屏幕左下角外的根因（2026-09-24）
      const vr = s.getBoundingClientRect();
      const r = boxEl
        ? boxLogicalRect(boxEl, vr.left, vr.top, vr.right, vr.bottom)
        : { left: vr.left, top: vr.top, right: vr.right, bottom: vr.bottom };
      const fontPx = Math.max(46, Math.min((r.bottom - r.top) * .44, (r.right - r.left) * .23));
      const resample = (text: string, fp: number): { x: number; y: number }[] => {
        const raw = sampleText(text, fp, 800, 4);
        if (!raw.length) return [];
        return Array.from({ length: N }, (_, i) => raw[Math.floor((i / N) * raw.length)]);
      };
      const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
      const ta = resample(YB_TITLE, fontPx).map((p) => ({ x: p.x + cx, y: p.y + cy }));
      if (!ta.length) { ps = []; return; }
      ps = Array.from({ length: N }, () => {
        const roll = Math.random();
        const kind: 0 | 1 | 2 = roll < .03 ? 2 : roll < .11 ? 1 : 0; // 红 ~3%、金 ~8%，其余墨
        return {
          // 出生撒满整窗、一部分落在外屏（WRAP 余量内），聚合时从四面八方汇进纸面卡
          x: -WRAP + Math.random() * (w + WRAP * 2),
          y: -WRAP + Math.random() * (h + WRAP * 2),
          pxl: 0, pyl: 0, vx: 0, vy: 0,
          ax: 0, ay: 0,
          d: CLAIM_AT + Math.random() * CLAIM_SPAN, // 认领时刻错峰：字是一层层扑上去的
          r: kind ? 1.7 + Math.random() * .9 : 1 + Math.random() * .6, // 萤火略大
          kind, ph: Math.random() * Math.PI * 2,
          wr: 1.2 + Math.random() * 1.6, // 落位后巡游半径（萤火不钉死）
          ws: .8 + Math.random() * .9,   // 巡游角速度
          fm: .7 + Math.random() * .6,   // 流场受力个体差异
          hx: 0, hy: 0,
          air: 0,                         // 0=在位 1=下坠 3=堆底 4=归位
        };
      });
      for (const p of ps) {
        p.pxl = p.x; p.pyl = p.y;        // 首帧不留从原点出发的假拖尾
        p.hx = p.x; p.hy = p.y;          // 出生点即锚点：未移入时原地轻晃
      }
      // 按出生位置就近认领字靶（贪心从靶点侧挑最近未认领的粒，恰成双射、笔画密度均匀）
      const aA = assign(ta, ps.map((p) => ({ x: p.x, y: p.y })));
      for (let j = 0; j < N; j++) { ps[aA[j]].ax = ta[j].x; ps[aA[j]].ay = ta[j].y; }
    };
    // 流星：偶发曳光斜穿纸面（纯装饰，不占字位、不参与物理）
    const mets: { x: number; y: number; vx: number; vy: number; life: number; col: string }[] = [];
    let nextMet = 4;
    out.set('open', {
      dur: 7, // 定格基准：翻走时按它把这一幕推到终态（自动放映已删）
      update({ t, pal, px, py, pin }) {
        if (!cv) { lastT = t; return; }
        const changed = cv.fit();
        const w = cv.w, h = cv.h;
        if (w < 8) { lastT = t; return; }
        // 首帧 / resize / 重播（t 回零）：整面擦掉重来——拖尾长在画布上，不清会叠上次演出的残迹；
        // 重建即回到满布待命，鼠标移入再聚合。不拿 ps.length 当重建条件：取样空表的分支
        // 会配出「每帧重建风暴」（评审 P2），空就让它安静空着
        if (changed || builtFor !== w || t < lastT - .25) {
          build(w, h);
          claimAt = null;
          mets.length = 0; nextMet = 4; // 流星节奏随重建复位：重播后不必隔老半天
          cv.clear();
        }
        const dt = Math.min(.05, Math.max(.001, t - lastT));
        lastT = t;
        const ctx = cv.ctx;
        // 指针速度与场强包络：快扫才有劲（慢挪几乎不扰），停手/离开后指数平复（≈1~2s）
        const pxx = w / 2 + (px * w) / 2, pyy = h / 2 + (py * h) / 2;
        // 在场与否只认引擎的 pin（指针在层内）：归一坐标恰为 (0,0) 的正中死点也算在场——
        // 聚合叙事全挂 pt.in 上，死点判「不在」会让悬停正中永远不起表（评审 P2）
        pt.in = pin > 0;
        if (!pt.was) { pt.vx = 0; pt.vy = 0; } // 换位重进先归零，防一次跨屏速度尖峰
        else if (pt.in) {
          const kV = 1 - Math.exp(-9 * dt);
          pt.vx += ((pxx - pt.x) / dt - pt.vx) * kV;
          pt.vy += ((pyy - pt.y) / dt - pt.vy) * kV;
        }
        pt.was = pt.in; pt.x = pxx; pt.y = pyy;
        const pv = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
        const dsTarget = pt.in ? Math.min(1, pv / 700) : 0;
        pt.ds += (dsTarget - pt.ds) * (1 - Math.exp(-(dsTarget > pt.ds ? 9 : 1.1) * dt));

        // 不清屏：每帧向透明擦一层（destination-out）——旧迹渐渐隐去露出纸面，新迹拖出光痕。
        // 不用「盖纸色帷幕」：低透明度在 8-bit 画布上永远合不到底，整幕会留一层
        // 比纸面深几个色阶的残雾（看着就像垫了块底色）；向透明擦稳态即纸面，明暗主题通吃。
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineCap = 'round';
        // 聚合起点：鼠标首次移入才起表；整条叙事（认领/打飞/扬回）都挂 tt 上
        if (claimAt === null && pt.in) claimAt = t;
        const tt = claimAt === null ? -1 : t - claimAt;
        // 盒子四壁与地面：飞出的栗子全部圈在**纸面卡**内（飞出盒子就扫不回来了）——
        // 墙与地面每帧从面板矩形现量，层框跟面板走也不怕；旋转态换算成逻辑坐标（同 build）
        const vr = s.getBoundingClientRect();
        const br = boxEl
          ? boxLogicalRect(boxEl, vr.left, vr.top, vr.right, vr.bottom)
          : { left: vr.left, top: vr.top, right: vr.right, bottom: vr.bottom };
        const floor = br.bottom - FLOOR_MARGIN;
        // 偶发流星：聚合完成后才开演，随机方向斜穿纸面上半区
        if (tt > METEOR_FROM && t >= nextMet && mets.length < 3) {
          nextMet = t + METEOR_EVERY + Math.random() * METEOR_SPAN;
          const l2r = Math.random() < .5;
          mets.push({
            x: l2r ? -40 : w + 40, y: h * (.1 + Math.random() * .42),
            vx: (l2r ? 1 : -1) * (720 + Math.random() * 380), vy: 140 + Math.random() * 170,
            life: 1.6, col: Math.random() < .5 ? pal.goldRgb : pal.redRgb,
          });
        }
        for (const p of ps) {
          // 认领进度：错峰 + 弹簧微过冲（吸附那一下有「扑上去」的劲）；未移入（tt<0）恒 0
          const att = spring(clamp01((tt - p.d) / CLAIM_DUR), 4.6, 2.2);
          // 受力：未移入锚在出生点原地轻晃（慢晃 + 微颤，不游荡）；移入后吃流场 + 微颤
          let fx: number, fy: number;
          if (tt < 0) {
            fx = (p.hx - p.x) * HOME_K + Math.cos(t * .5 + p.ph) * SWAY
              + Math.cos(t * p.ws * 1.7 + p.ph * 2.3) * 18;
            fy = (p.hy - p.y) * HOME_K + Math.sin(t * .44 + p.ph * 1.7) * SWAY
              + Math.sin(t * p.ws * 1.3 + p.ph * 1.1) * 18;
          } else {
            // 流场：在位时只剩一成半（字保持形状但仍被微风拂动）；下坠/归位时更弱
            const ang = flowAngle(p.x, p.y, t);
            const flowK = FLOW * p.fm * Math.max(0, 1 - att * .85) * (p.air === 0 ? 1 : .3);
            fx = Math.cos(ang) * flowK;
            fy = Math.sin(ang) * flowK;
            // 私有微颤：落位时让字微微呼吸
            fx += Math.cos(t * p.ws * 1.7 + p.ph * 2.3) * 16;
            fy += Math.sin(t * p.ws * 1.3 + p.ph * 1.1) * 16;
          }
          // 字靶：单套片名靶点（p.ax/ay）。态分支：下坠/归位/堆底/在位各自受力
          let dampK = tt < 0 ? 4 : lerp(DAMP_FREE, DAMP_LOCK, clamp01(att));
          if (p.air === 1) {
            // 下坠：脱离字靶只受重力；重力已调轻（300），低阻尼放行 ≈270px/s 的柔坠
            fy += GRAV;
            dampK = DAMP_FALL;
          } else if (p.air === 4) {
            // 归位：从堆底飞回自己的字位（扫到堆才会触发——全靠手，不自动）
            fx += (p.ax - p.x) * ATTR * 1.15;
            fy += (p.ay - p.y) * ATTR * 1.15;
            dampK = 7;
            const rdx = p.x - p.ax, rdy = p.y - p.ay;
            if (rdx * rdx + rdy * rdy < 256) p.air = 0; // 16px 内到家，重新落座
          } else if (p.air === 3) {
            // 堆底：软钉在纸面卡下缘（堆积不消失，微微呼吸）
            dampK = 12;
            fy += (floor - p.r - p.y) * 60;
          } else {
            // 在位：吸向「字靶 + 巡游偏移」，常驻态的字由这点微光晕开
            const gx = p.ax + Math.cos(t * p.ws + p.ph) * p.wr;
            const gy = p.ay + Math.sin(t * p.ws * .83 + p.ph * 1.7) * p.wr;
            fx += (gx - p.x) * ATTR * att;
            fy += (gy - p.y) * ATTR * att;
          }
          // 指针 = 一把扫帚：快扫字面把栗子打飞（脱队坠落），快扫盒底的堆把栗子整把扬回；
          // 慢挪只是轻抚（微扰，不脱队）。打飞/扬回都吃顺手势的冲量，打出去有手感
          if (pt.ds > .01) {
            const dx = p.x - pt.x, dy = p.y - pt.y;
            const dd = Math.sqrt(dx * dx + dy * dy);
            const R = Math.min(w, h) * SWEEP_R;
            if (dd < R && dd > .5) {
              const fall = (1 - dd / R) * (1 - dd / R);
              const ux = dx / dd, uy = dy / dd;
              if (p.air === 0 && att > .85 && pt.ds > KNOCK) {
                // 打飞：栗子沿手势正前方**扇形飞溅**（半角 SPLASH，角度/速度各带随机、
                // 越近飞越急）——直接赋速度，先飞出去，弹道之后才被重力拉坠
                const base = Math.atan2(pt.vy, pt.vx);
                const ang = base + (Math.random() - .5) * SPLASH;
                const pv = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
                const spd = Math.min(950, Math.max(300, pv)) * (.55 + .75 * Math.random()) * (1 - (dd / R) * .5);
                p.air = 1;
                p.vx = Math.cos(ang) * spd;
                p.vy = Math.sin(ang) * spd;
                dampK = DAMP_FALL;
              } else if (p.air === 3 && pt.ds > KNOCK) {
                // 扬回：堆底的栗子被扫到，弹起飞回自己的字位
                p.air = 4;
                fx += (pt.vx * 1.6 + (p.ax - p.x) * 2.2) * fall;
                fy += -560 * fall - pt.vy * .6;
                dampK = 3.2;
              } else {
                const f = fall * pt.ds * (p.air === 1 ? .5 : 1);
                fx += (pt.vx * 1.5 + ux * 620 - uy * 240) * f;
                fy += (pt.vy * 1.5 + uy * 620 + ux * 240) * f;
              }
            }
          }
          // 半隐式欧拉 + 帧率无关阻尼（按态选：游荡松、在位紧、下坠放行）+ 限速保险丝
          p.vx += fx * dt; p.vy += fy * dt;
          const dmp = Math.exp(-dampK * dt);
          p.vx *= dmp; p.vy *= dmp;
          const sp2 = p.vx * p.vx + p.vy * p.vy;
          if (sp2 > VCAP * VCAP) { const cap = VCAP / Math.sqrt(sp2); p.vx *= cap; p.vy *= cap; }
          p.pxl = p.x; p.pyl = p.y;
          p.x += p.vx * dt; p.y += p.vy * dt;
          // 四壁（只管飞行/归位/堆底的栗子）：撞墙按弹性弹回，保证永远圈在纸面卡内、
          // 随时扫得回来；聚合在途的在位粒（air=0）不设墙——它们正从屏外往字位汇
          if (p.air !== 0) {
            const wl = br.left + p.r, wrt = br.right - p.r, wtp = br.top + p.r;
            if (p.x < wl) { p.x = wl; p.vx = -p.vx * BOUNCE; }
            else if (p.x > wrt) { p.x = wrt; p.vx = -p.vx * BOUNCE; }
            if (p.y < wtp) { p.y = wtp; p.vy = -p.vy * BOUNCE; }
          }
          // 落到纸面卡下缘：反弹耗能（弹性 + 横向摩擦），弹不动了就地落座堆积（不消失）
          if (p.air === 1 && p.y >= floor - p.r && p.vy > 0) {
            p.y = floor - p.r;
            p.vy = -p.vy * BOUNCE;
            p.vx *= .6;
            if (p.vy > -34) { p.vy = 0; p.air = 3; }
          }
          if (p.air === 3 && p.y > floor - p.r) { p.y = floor - p.r; p.vy = 0; }
          // 绘制：短线段（上一帧位置 → 当前位置）当彗尾；近乎不动时落一颗圆点。
          // 暗色主题：墨粒转荧光玉色、堆底如余烬明灭；亮色主题维持墨 + 金红萤火
          let col: string, a: number;
          if (p.kind === 1)      { col = pal.goldRgb; a = .5 + .45 * Math.sin(t * 1.7 + p.ph * 3.1); } // 金萤呼吸
          else if (p.kind === 2) { col = pal.redRgb;  a = .5 + .45 * Math.sin(t * 2.1 + p.ph * 2.3); } // 红萤呼吸
          else                   { col = pal.dark ? pal.jadeRgb : pal.inkRgb; a = .46 + .12 * Math.sin(t * 2.2 + p.ph); }
          a = Math.max(.06, a) * (.6 + .4 * clamp01(att)) * at(t, .9); // 落位渐亮 + 开场淡入
          if (pal.dark) {
            a = Math.min(1, a * 1.18);                                 // 暗纸面整体提亮一档
            if (p.air === 3) a *= .45 + .55 * (.5 + .5 * Math.sin(t * .9 + p.ph * 3.1)); // 余烬明灭
          }
          // 下坠的栗子曳光拉长（沿速度方向补一段尾巴），其余按帧间位移
          const sx0 = p.air === 1 ? p.x - p.vx * .09 : p.pxl;
          const sy0 = p.air === 1 ? p.y - p.vy * .09 : p.pyl;
          const mx = p.x - sx0, my = p.y - sy0;
          const long = mx * mx + my * my > .18 || p.air === 1;
          if (p.kind) { // 萤火亮点：宽而淡的一笔当柔光晕（暗色下晕更亮）
            ctx.strokeStyle = rgba(col, a * (pal.dark ? .26 : .16));
            ctx.lineWidth = p.r * 6.5;
            if (long) { ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(p.x, p.y); ctx.stroke(); }
            else { ctx.fillStyle = rgba(col, a * (pal.dark ? .26 : .16)); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); ctx.fill(); }
          }
          ctx.strokeStyle = rgba(col, a);
          ctx.fillStyle = rgba(col, a);
          ctx.lineWidth = p.r * 2;
          if (long) { ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(p.x, p.y); ctx.stroke(); }
          else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
          p.pxl = p.x; p.pyl = p.y;
        }
        // 流星：偶发曳光斜穿纸面（纯装饰，至多同屏 3 颗）
        for (let i = mets.length - 1; i >= 0; i--) {
          const m = mets[i];
          m.x += m.vx * dt; m.y += m.vy * dt; m.life -= dt;
          if (m.life <= 0 || m.x < -80 || m.x > w + 80) { mets.splice(i, 1); continue; }
          const ml = Math.min(1, m.life) * .8;
          const gx0 = m.x - m.vx * .12, gy0 = m.y - m.vy * .12;
          const g = ctx.createLinearGradient(gx0, gy0, m.x, m.y);
          g.addColorStop(0, rgba(m.col, 0));
          g.addColorStop(1, rgba(m.col, ml));
          ctx.strokeStyle = g;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(gx0, gy0); ctx.lineTo(m.x, m.y); ctx.stroke();
        }
      },
    });
  }

  /* ── 02 十二年：折线描画 ── */
  {
    const s = scn('years')!;
    const cv = canvas(s, 'years');
    const axis = s.querySelector<HTMLElement>('[data-r="axis"]');
    const peakEl = s.querySelector<HTMLElement>('[data-r="peak"]');
    const perEl = s.querySelector<HTMLElement>('[data-r="perYear"]');
    const ticks = qsa(s, '.yb-tick');
    const cursor = s.querySelector<HTMLElement>('[data-r="cursor"]');
    const n = data.years.length;
    const counts = data.years.map((y) => y.films.length);
    const max = Math.max(1, ...counts);
    const peakI = counts.indexOf(max);
    const axisStagger = ticks.map((_, i) => i * .07);
    // 指针停在折线上：读数光标从「自动扫」变成「停在你指的那一年」（移开再回到峰值年）
    let hotY = -1;
    out.set('years', {
      dur: 3.2,
      move(p) {
        const l = localAt(cv?.el, p);
        hotY = l ? Math.max(0, Math.min(n - 1, Math.round(l.x * (n - 1)))) : -1;
        if (hotY >= 0) tip(host, `<b>${data.years[hotY].y}</b> 年 · ${counts[hotY]} 部`, p.cx, p.cy);
        else tip(host, '');
      },
      update({ t, pal }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const padT = h * .14, padB = h * .2, padL = w * .04, padR = w * .04;
          const X = (i: number): number => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
          const Y = (v: number): number => h - padB - (v / max) * (h - padT - padB);
          const g = easeInOut(at(t, 1.7));
          const span = Math.max(0, g * (n - 1));
          const hx = X(span), hy = Y(lerp(counts[Math.floor(span)], counts[Math.min(n - 1, Math.ceil(span))], span % 1));
          ctx.beginPath();
          ctx.moveTo(X(0), h - padB);
          for (let i = 0; i <= Math.floor(span); i++) ctx.lineTo(X(i), Y(counts[i]));
          if (span > Math.floor(span)) ctx.lineTo(hx, hy);
          ctx.lineTo(hx, h - padB);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
          grad.addColorStop(0, rgba(pal.inkRgb, .16));
          grad.addColorStop(1, rgba(pal.inkRgb, 0));
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.beginPath();
          for (let i = 0; i <= Math.floor(span); i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(counts[i]));
          if (span > Math.floor(span)) ctx.lineTo(hx, hy);
          ctx.strokeStyle = rgba(pal.inkRgb, .92);
          ctx.lineWidth = 2;
          ctx.lineJoin = 'round';
          ctx.stroke();
          // 读数光标：跟着描画头走，走完停在峰值那一年报数（画布外的 DOM，字号不受缩放影响）；
          // 指针指到哪一年，它就停在那一年的折点上——这一页的字都在画布里，读数是唯一的出口
          if (cursor) {
            const ci = hotY >= 0 ? hotY : (g < 1 ? Math.min(n - 1, Math.round(span)) : peakI);
            const show = hotY >= 0 ? 1 : at(t, .5, .5);
            const label = `${data.years[ci].y} 年 · ${counts[ci]} 部`;
            if (cursor.dataset.label !== label) cursor.dataset.label = label;
            const pct = (X(ci) / w) * 100;
            S(cursor, `left:${pct.toFixed(2)}%;opacity:${(show * (g < 1 ? .85 : 1)).toFixed(3)}`);
          }
          if (g < 1) {
            const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 24);
            halo.addColorStop(0, rgba(pal.redRgb, .5));
            halo.addColorStop(1, rgba(pal.redRgb, 0));
            ctx.fillStyle = halo;
            ctx.beginPath(); ctx.arc(hx, hy, 24, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pal.red;
            ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, Math.PI * 2); ctx.fill();
          } else {
            const post = at(t, .8, 1.7);
            for (let i = 0; i < n; i++) {
              const k = clamp01(post * 1.8 - i * .06);
              if (k <= 0) continue;
              const hot = i === hotY;
              ctx.fillStyle = rgba(pal.inkRgb, (hot ? .95 : .55 * (hotY >= 0 ? .5 : 1)) * k);
              ctx.beginPath(); ctx.arc(X(i), Y(counts[i]), hot ? 4 : 2.4, 0, Math.PI * 2); ctx.fill();
              if (i === peakI || hot) {
                ctx.strokeStyle = rgba(pal.redRgb, (hot ? .95 : .85) * k);
                ctx.lineWidth = 1.6;
                ctx.beginPath(); ctx.arc(X(i), Y(counts[i]), hot ? 11 : 6 + 12 * (1 - k), 0, Math.PI * 2); ctx.stroke();
              }
            }
          }
        }
        ticks.forEach((el, i) => {
          const p = at(t, .5, .45 + axisStagger[i]);
          S(el, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 8).toFixed(1)}px)`);
        });
        S(axis, `opacity:${at(t, .6, .4).toFixed(3)}`);
        const pp = at(t, .5, 1.5);
        S(peakEl, `opacity:${pp.toFixed(3)}`);
        T(peakEl, `${data.years[peakI].y} 年 · ${max} 部`);
        T(perEl, `${(data.watchedCount / Math.max(1, n)).toFixed(1)} 部`);
      },
    });
  }

  /* ── 03 落笔的日子：日历逐格点亮（key/序都在 build 期算好） ── */
  {
    const s = scn('days')!;
    const grid = s.querySelector<HTMLElement>('.yb-days');
    const dayCount = new Map<string, number>();
    for (const [date, films] of data.days) dayCount.set(date.slice(4), films.length);
    const orderOf = new Map<string, number>();
    [...data.days.keys()].sort().forEach((d, i) => orderOf.set(d.slice(4), i));
    const cells = qsa(s, '.yb-cell').map((el) => {
      const mi = Number(el.closest<HTMLElement>('.yb-month')?.dataset.mi ?? 0);
      const day = Number(el.dataset.d ?? 0);
      const key = `-${String(mi + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { el, n: dayCount.get(key) ?? 0, o: orderOf.get(key) ?? -1, tipTxt: el.dataset.tip ?? '' };
    });
    const months = qsa(s, '.yb-month');
    void months;
    // 悬停某天：那格凸起 + 报出那天看的片（一年 366 格，光看颜色深浅读不出内容）
    let hotCell = -1;
    out.set('days', {
      dur: 3.0,
      move(p) {
        const cell = under<HTMLElement>(p, '.yb-cell[data-tip]');
        hotCell = cell ? cells.findIndex((c) => c.el === cell) : -1;
        if (hotCell >= 0) tip(host, cells[hotCell].tipTxt, p.cx, p.cy);
        else tip(host, '');
      },
      update({ t }) {
        const hot = hotCell >= 0 && t > 1.2 ? hotCell : -1;
        for (let i = 0; i < cells.length; i++) {
          const c = cells[i];
          if (!c.n) { S(c.el, 'opacity:.3'); continue; }
          const p = at(t, .34, .25 + c.o * .0034);
          const on = i === hot;
          S(c.el, `opacity:${(on ? 1 : (.28 + .72 * p) * (hot >= 0 ? .45 : 1)).toFixed(3)}`
            + `;transform:scale(${(on ? 1.5 : .55 + .45 * easeBack(p)).toFixed(3)})`
            + (on ? ';z-index:3' : ''));
        }
        S(grid, `--scan:${(((t % 4.6) / 4.6)).toFixed(4)}`);
      },
    });
  }

  /* ── 04 星期节律：日晷（辐条逐根抽出 → 指针扫到最常落座那一天 → 常驻微摆） ── */
  {
    const s = scn('week')!;
    const spokes = qsa(s, '.yb-spoke');
    const needle = s.querySelector<HTMLElement>('[data-r="needle"]');
    const hub = s.querySelector<HTMLElement>('.yb-dial-hub');
    const hubB = s.querySelector<HTMLElement>('.yb-dial-hub b');
    const hubS = s.querySelector<HTMLElement>('.yb-dial-hub span');
    const face = s.querySelector<HTMLElement>('[data-r="face"]');
    const labels = spokes.map((sp) => sp.querySelector<HTMLElement>('.yb-spoke-lb'));
    // 指针目标角 = 峰值那根的角度；起点固定在上方（-90°，即周一的位置）
    const target = vOf(needle, '--a', -90);
    // 鼠标上盘：晷针指向指针方向（跟手），并且盘心报出那一格是哪天、多少部。
    // `aim` 用 NaN 表示「指针不在盘上」——不能用 0 代替，0° 是个合法的方向（正上方）。
    let aim = NaN, hotSpoke = -1, shownDeg = target;
    out.set('week', {
      dur: 3.0,
      move(p) {
        const l = localAt(face, p);
        if (!l) { aim = NaN; hotSpoke = -1; return; }
        aim = (Math.atan2(l.x - .5, .5 - l.y) * 180) / Math.PI; // 0° = 正上方，顺时针为正
        // 与辐条同一套角度：--a = -90 + i × (360/7)
        const k = Math.round((((aim + 90) % 360 + 360) % 360) / (360 / 7)) % 7;
        hotSpoke = k;
      },
      update({ t }) {
        spokes.forEach((sp, i) => {
          const p = stagger(t, i, .09, .8);
          const on = t > 1.8 && i === hotSpoke;
          S(sp.querySelector<HTMLElement>('.yb-spoke-bar'), `transform:scaleX(${(easeElastic(p) * (on ? 1.06 : 1)).toFixed(4)})`);
          S(sp, `opacity:${(at(t, .4, i * .09) * (hotSpoke >= 0 && !on && t > 1.8 ? .42 : 1)).toFixed(3)}`);
          S(labels[i], `opacity:${at(t, .5, .5 + i * .09).toFixed(3)}`);
        });
        if (needle) {
          const p = at(t, 1.5, .7);
          if (p < 1) {
            shownDeg = -90 + (target + 90) * easeBack(p);
            S(needle, `transform:rotate(${shownDeg.toFixed(2)}deg);opacity:${at(t, .4, .7).toFixed(3)}`);
          } else {
            // 没指针时轻轻摆（原来的常驻微摆），指针上盘就跟着走
            const idle = target + Math.sin((t - 2.2) * 1.1) * 1.4;
            shownDeg = toward(shownDeg, Number.isFinite(aim) ? aim : idle, .2);
            S(needle, `transform:rotate(${shownDeg.toFixed(2)}deg);opacity:1`);
          }
        }
        // 盘心当读数窗：悬停哪一天就报那天（移开回到总数）。
        // 星期名直接从辐条的标签上取（「周一 128」的首段）——不要在运动层再抄一份星期表
        if (hubB && hubS) {
          if (hotSpoke >= 0) {
            T(hubB, String(data.weekN[hotSpoke]));
            T(hubS, (labels[hotSpoke]?.textContent ?? '').split(/\s+/)[0] || '部');
          } else { T(hubB, String(data.watchedCount)); T(hubS, '部'); }
        }
        const hp = at(t, .6, .4);
        S(hub, `opacity:${hp.toFixed(3)};transform:translate(-50%,-50%) scale(${(.7 + .3 * easeBack(hp)).toFixed(3)})`);
      },
    });
  }

  /* ── 05 连看与单日：缎带描画（stroke-dashoffset 画带子）+ 逐日串珠 + 单日 82 道刻线 ── */
  {
    const s = scn('streak')!;
    const path = s.querySelector<SVGPathElement>('[data-r="ribpath"]');
    const flow = s.querySelector<SVGPathElement>('[data-r="ribflow"]');
    const dots = qsa<SVGCircleElement>(s, '.yb-rib-dot');
    const ticks = qsa(s, '.yb-busy-tick');
    const tags = qsa(s, '.yb-btag');
    const tickH = ticks.map((_, i) => 34 + ((i * 37) % 58));
    let len = 1400;
    try {
      if (path && typeof path.getTotalLength === 'function') len = path.getTotalLength() || len;
    } catch (e) { /* jsdom 下没有 SVG 几何，用估算长度兜底 */ }
    // 初始：整条带子藏在虚线里（描画从 0 开始）
    if (path) { path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len}`; }
    // 悬停串珠 / 单日刻线：那一枚鼓起来并报出是哪天、哪一部
    let hotDot = -1, hotTick = -1;
    out.set('streak', {
      dur: 3.2,
      move(p) {
        const dot = under<SVGCircleElement>(p, '.yb-rib-dot');
        const tick = under<HTMLElement>(p, '.yb-busy-tick');
        hotDot = dot ? Number(dot.dataset.i ?? -1) : -1;
        hotTick = tick ? Number(tick.dataset.i ?? -1) : -1;
        const el = dot ?? tick;
        const txt = el?.dataset.tip ?? '';
        if (txt) tip(host, txt, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        const draw = easeInOut(at(t, 1.7, .15));
        if (path) path.style.strokeDashoffset = `${(len * (1 - draw)).toFixed(1)}`;
        if (flow) {
          // 带子里的流光：靠 dashoffset 随时间走（JS 驱动，不入 CSS 循环白名单）
          flow.style.strokeDasharray = '12 18';
          // 指针扫过带子时流光跟着变快：像被手拨了一下
          const boost = hotDot >= 0 || hotTick >= 0 ? 2.2 : 1;
          flow.style.strokeDashoffset = `${(-((t * 30 * boost) % 30)).toFixed(1)}`;
          S(flow as unknown as HTMLElement, `opacity:${(at(t, .5, 1.4) * .55).toFixed(3)}`);
        }
        dots.forEach((d, i) => {
          const p = at(t, .42, .5 + i * .085);
          const on = i === hotDot;
          S(d as unknown as HTMLElement, `opacity:${(on ? 1 : p * (hotDot >= 0 ? .4 : 1)).toFixed(3)}`
            + `;transform:scale(${(on ? 2.1 : .35 + .65 * easeBack(p)).toFixed(3)})`);
        });
        ticks.forEach((el, i) => {
          const p = at(t, .34, 1.25 + i * .011);
          const on = i === hotTick;
          S(el, `height:${(tickH[i] * easeOut(p) * (on ? 1.35 : 1)).toFixed(1)}%;opacity:${(on ? 1 : p * (hotTick >= 0 ? .45 : 1)).toFixed(3)}`);
        });
        tags.forEach((el, i) => {
          const p = stagger(t, i, .06, .5);
          S(el, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 12).toFixed(1)}px)`);
        });
      },
    });
  }

  /* ── 06 片长画像：直方图生长 + 里程表 ── */
  {
    const s = scn('length')!;
    const bins = qsa(s, '.yb-bin');
    const heights = bins.map((b) => vOf(b.querySelector<HTMLElement>('.yb-bbar'), '--ph'));
    const nums = data.bins.map((b) => b.films.length);
    const total = s.querySelector<HTMLElement>('[data-r="total"]');
    const side = s.querySelector<HTMLElement>('.yb-len-side');
    const cvReel = canvas(s, 'reel');
    const durs = data.durFilms.map((d) => d.min);
    const durTotal = durs.reduce((a, b) => a + b, 0);
    let flapDone = false;
    // 悬停柱子报出这一段的片；指针压到胶片盘上时，盘会朝着指针转一点、并把「读头」摆过去
    let hotBin = -1, reelAt: { x: number; y: number } | null = null, spin = 0;
    out.set('length', {
      dur: 3.4,
      move(p) {
        const bin = under<HTMLElement>(p, '.yb-bin');
        hotBin = bin ? Number(bin.dataset.i ?? -1) : -1;
        if (bin?.dataset.tip) tip(host, bin.dataset.tip, p.cx, p.cy); else tip(host, '');
        reelAt = localAt(cvReel?.el, p);
      },
      update({ t, pal }) {
        bins.forEach((b, i) => {
          const p = stagger(t, i, .11, .9);
          const on = i === hotBin;
          S(b.querySelector<HTMLElement>('.yb-bbar'), `height:${(heights[i] * easeOut(p)).toFixed(2)}%`
            + `;transform:scaleY(${on ? 1.04 : 1});transform-origin:bottom center;opacity:${on ? 1 : hotBin >= 0 ? .5 : 1}`);
          S(b, `opacity:${at(t, .4, i * .11).toFixed(3)}`);
          T(b.querySelector<HTMLElement>('.yb-bn'), String(Math.round(nums[i] * easeOut(p))));
        });
        if (cvReel) {
          cvReel.fit();
          cvReel.clear();
          const ctx = cvReel.ctx, w = cvReel.w, h = cvReel.h;
          const cx = w / 2, cy = h / 2;
          const rMax = Math.min(w, h) * .46, rMin = Math.min(w, h) * .12;
          const laps = Math.max(1, durTotal / 1440);
          const grow = easeInOut(at(t, 2.2, .4));
          // 走一圈 = 一天（1440 分钟）：角向随累计分钟增长，半径随圈数增长 → 一卷盘
          const steps = 900;
          // 指针上盘：整卷朝指针方向转一点（像手指拨了一下盘），读头摆到指针角度
          const aimSpin = reelAt ? Math.max(-.34, Math.min(.34, Math.atan2(reelAt.y - .5, reelAt.x - .5) + Math.PI / 2)) : 0;
          spin = toward(spin, aimSpin, .12);
          ctx.save();
          ctx.translate(cx, cy); ctx.rotate(spin); ctx.translate(-cx, -cy);
          ctx.lineWidth = Math.max(1.4, rMax * .028);
          ctx.lineCap = 'round';
          let acc = 0, di = 0;
          for (let i2 = 0; i2 < steps; i2++) {
            const u0 = i2 / steps, u1 = (i2 + 1) / steps;
            const a0 = u0 * laps * Math.PI * 2 - Math.PI / 2;
            const a1 = u1 * laps * Math.PI * 2 - Math.PI / 2;
            if (u1 > grow) break;
            const r0 = rMin + (rMax - rMin) * u0, r1 = rMin + (rMax - rMin) * u1;
            // 该步落在哪部片上（按分钟切分）——颜色分两种，读起来像盘上的接片
            const at2 = u0 * durTotal;
            while (di < durs.length - 1 && acc + durs[di] < at2) { acc += durs[di]; di++; }
            const hot = di % 2 === 0;
            ctx.strokeStyle = rgba(hot ? pal.inkRgb : pal.redRgb, .72);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
            ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
            ctx.stroke();
          }
          ctx.restore();
          ctx.fillStyle = rgba(pal.inkRgb, .16);
          ctx.beginPath(); ctx.arc(cx, cy, rMin * .5, 0, Math.PI * 2); ctx.fill();
          // 读头：从轴心指向指针角度的一根朱红细线（磁带机那种拾音头）
          if (reelAt && grow > .85) {
            const ang = Math.atan2(reelAt.y - .5, reelAt.x - .5);
            ctx.strokeStyle = rgba(pal.redRgb, .5);
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(ang) * rMin * .5, cy + Math.sin(ang) * rMin * .5);
            ctx.lineTo(cx + Math.cos(ang) * rMax, cy + Math.sin(ang) * rMax);
            ctx.stroke();
            ctx.fillStyle = pal.red;
            ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rMax, cy + Math.sin(ang) * rMax, 3.2, 0, Math.PI * 2); ctx.fill();
          }
        }
        // 合计不走滚动计数：翻页钟一次落定（逐位翻牌），位数不变所以每位都翻
        if (t < .1) flapDone = false;
        if (!flapDone && t > 1.9) { setFlap(total, humanDur(data.totalMinutes)); flapDone = true; }
        S(side, `opacity:${at(t, .6, .3).toFixed(3)}`);
      },
    });
  }

  /* ── 07 长短两端：标尺双向滑出 ── */
  {
    const s = scn('extremes')!;
    const line = s.querySelector<HTMLElement>('[data-r="rline"]');
    const ticks = s.querySelector<HTMLElement>('[data-r="rticks"]');
    const rread = s.querySelector<HTMLElement>('[data-r="rread"]');
    const ruler = s.querySelector<HTMLElement>('.yb-ruler');
    const marks = qsa(s, '.yb-mark');
    const xs = marks.map((m) => vOf(m, '--x', 50));
    const cards = qsa(s, '.yb-xcard');
    const durs2 = data.durFilms.map((d) => d.min).sort((a, b) => a - b);
    const lo = data.shortestMin, hi = data.longestMin;
    // 尺子上量一段：指针停在哪就报那一档有多少部（两端各留 6%，与 --x 的映射互为反函数）
    let readX: number | null = null, readN = 0, readMin = 0, hotEnd = -1;
    out.set('extremes', {
      dur: 2.8,
      move(p) {
        const l = localAt(ruler, p);
        if (!l) { readX = null; hotEnd = -1; return; }
        const rx = Math.max(.06, Math.min(.94, l.x));
        readX = rx;
        readMin = Math.round(lo + ((rx - .06) / .88) * Math.max(1, hi - lo));
        readN = durs2.filter((m) => Math.abs(m - readMin) <= 12).length;
        hotEnd = xs.findIndex((x) => Math.abs(x - rx * 100) < 3);
        tip(host, `<b>${readMin}</b> 分钟 · 上下 12 分钟里有 ${readN} 部`, p.cx, p.cy);
      },
      update({ t }) {
        const grow = easeInOut(at(t, 1.1, .2));
        S(line, `transform:scaleX(${grow.toFixed(4)});transform-origin:center`);
        S(ticks, `transform:scaleX(${grow.toFixed(4)});transform-origin:center;opacity:${at(t, .5, .5).toFixed(3)}`);
        marks.forEach((m, i) => {
          const p = at(t, 1.0, .8 + i * .18);
          const k = easeBack(p);
          const on = i === hotEnd;
          S(m, `left:${(50 + (xs[i] - 50) * k).toFixed(2)}%;opacity:${at(t, .4, .8 + i * .18).toFixed(3)}`
            + `;transform:scale(${((.72 + .28 * easeOut(p)) * (on ? 1.14 : 1)).toFixed(3)})`);
        });
        cards.forEach((c, i) => {
          const p = at(t, .8, 1.5 + i * .16);
          const on = i === hotEnd && t > 1.6;
          S(c, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 18 - (on ? 10 : 0)).toFixed(1)}px) rotate(${((1 - p) * (i ? 3 : -3)).toFixed(2)}deg)`);
        });
        // 读数线：一条跟着指针走的朱红竖线（落定后才出现，别跟进场抢戏）
        if (rread) {
          const rx = readX;
          if (rx == null || t < 1.4) S(rread, 'opacity:0');
          else S(rread, `left:${(rx * 100).toFixed(2)}%;opacity:${at(t, .3, 1.4).toFixed(3)}`);
        }
      },
    });
  }

  /* ── 08 类型光谱：条形错峰 + 常驻红线扫描 ── */
  {
    const s = scn('genres')!;
    const rows = qsa(s, '.yb-grow');
    const cvNet = canvas(s, 'net');
    const netKeys = data.genres.slice(0, 8).map((g) => g.name);
    const pairs = data.genrePairs.filter((pr) => netKeys.includes(pr.a) && netKeys.includes(pr.b));
    const pairMax = Math.max(1, ...pairs.map((pr) => pr.n));
    const widths = rows.map((r) => r.querySelector<HTMLElement>('.yb-gbar')?.style.getPropertyValue('--w') || '0%');
    const nums = data.genres.slice(0, 8).map((g) => g.films.length);
    // 条 ↔ 星图联动：两边指向同一份类型。悬停哪一条，星图里那个节点和它的边就点亮；
    // 悬停星图里的节点，左边那一条也跟着跳出来——共现这件事要两个视角对上才讲得明白。
    let focus = -1;
    let nodeAt: { x: number; y: number }[] = [];
    out.set('genres', {
      dur: 3.0,
      move(p) {
        const row = under<HTMLElement>(p, '.yb-grow');
        if (row) { focus = Number(row.dataset.i ?? -1); return; }
        // 星图是画布：没有可点元素，按节点比例坐标找最近的一个（半径给得松一点，节点很小）
        focus = nearest(nodeAt, localAt(cvNet?.el, p), .14);
      },
      update({ t, pal }) {
        const hot = t > 2.2 ? focus : -1;
        if (cvNet) {
          cvNet.fit();
          cvNet.clear();
          const ctx = cvNet.ctx, w = cvNet.w, h = cvNet.h;
          const R = Math.min(w, h) * .34, cx = w / 2, cy = h / 2;
          const pos = netKeys.map((_, i) => {
            const a = -Math.PI / 2 + (i / netKeys.length) * Math.PI * 2;
            return [cx + Math.cos(a) * R, cy + Math.sin(a) * R] as [number, number];
          });
          nodeAt = pos.map(([x, y]) => ({ x: x / Math.max(1, w), y: y / Math.max(1, h) }));
          // 边：按共现次数排序逐条画出（一条边 = 同一部片挂这两个类型）
          pairs.forEach((pr, i) => {
            const a = netKeys.indexOf(pr.a), b = netKeys.indexOf(pr.b);
            const draw = easeInOut(at(t, .7, .5 + i * .06));
            if (draw <= 0) return;
            const touch = hot >= 0 && (a === hot || b === hot);
            const [x1, y1] = pos[a], [x2, y2] = pos[b];
            const mx = lerp(x1, x2, draw), my = lerp(y1, y2, draw);
            const wgt = pr.n / pairMax;
            ctx.strokeStyle = touch ? rgba(pal.redRgb, .82)
              : rgba(wgt > .6 ? pal.redRgb : pal.inkRgb, (.1 + .32 * wgt) * (hot >= 0 ? .28 : 1));
            ctx.lineWidth = (.7 + 2.6 * wgt) * (touch ? 1.8 : 1);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(mx, my); ctx.stroke();
          });
          // 节点 + 名字
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          netKeys.forEach((k, i) => {
            const p = at(t, .5, .5 + i * .06);
            if (p <= 0) return;
            const [x, y] = pos[i];
            const on = i === hot;
            const rad = (3 + 5 * (nums[i] / Math.max(1, nums[0]))) * (on ? 1.7 : 1);
            ctx.globalAlpha = p * (hot >= 0 && !on ? .42 : 1);
            ctx.fillStyle = on ? pal.red : pal.paper;
            ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = on ? pal.red : rgba(pal.inkRgb, .5);
            ctx.lineWidth = on ? 2 : 1.2;
            ctx.stroke();
            ctx.fillStyle = on ? pal.red : rgba(pal.inkRgb, .82);
            ctx.font = `${Math.round(Math.max(11, Math.min(w, h) * .045) * (on ? 1.06 : 1))}px "Segoe UI", system-ui, sans-serif`;
            ctx.fillText(k, x, y + rad + 10);
            ctx.globalAlpha = 1;
          });
        }
        rows.forEach((row, i) => {
          const p = stagger(t, i, .09, .8);
          const on = i === hot;
          S(row.querySelector<HTMLElement>('.yb-gbar'), `width:${widths[i]};transform:scaleX(${(easeOut(p) * (on ? 1.04 : 1)).toFixed(4)});transform-origin:left center;opacity:${on ? 1 : hot >= 0 ? .5 : 1}`);
          const scan = i === 0 && t > 1.3 ? (((t - 1.3) % 3.4) / 3.4) : 0;
          S(row, `opacity:${at(t, .4, i * .09).toFixed(3)};transform:translateX(${((1 - easeOut(at(t, .6, i * .09))) * -16).toFixed(1)}px);--scan:${scan.toFixed(4)}`);
          T(row.querySelector<HTMLElement>('.yb-gn'), String(Math.round(nums[i] * easeOut(p))));
        });
      },
    });
  }

  /* ── 09 类型流向：堆叠流图 ── */
  {
    const s = scn('flow')!;
    const cv = canvas(s, 'flow');
    const legend = qsa(s, '.yb-lg');
    const keys = data.genres.slice(0, 5).map((g) => g.name);
    const years = data.years.map((y) => y.y);
    const series = keys.map((k) => data.years.map((y) => y.films.filter((f) => String(f.genre ?? '').split(/\s*\/\s*/).includes(k)).length));
    const maxTotal = Math.max(1, ...years.map((_, i) => series.reduce((s2, arr) => s2 + arr[i], 0)));
    const triplets = (pal: Palette): string[] => [pal.goldRgb, pal.redRgb, pal.blueRgb, pal.jadeRgb, pal.inkRgb];
    // 指针扫过河流：贴近的那一段顺着指针上下让开（像水流被手拨了一下），远处不动
    let atFlow: { x: number; y: number } | null = null;
    out.set('flow', {
      dur: 3.4,
      move(p) { atFlow = localAt(cv?.el, p); },
      update({ t, pal }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const padT = h * .12, padB = h * .12;
          const X = (i: number): number => (i / Math.max(1, years.length - 1)) * w;
          const g = easeInOut(at(t, 2.0));
          // 拨水：高斯衰减的竖直位移，近处跟随、远处归零
          const wake = (i: number): number => {
            if (!atFlow) return 0;
            const dx = X(i) / Math.max(1, w) - atFlow.x;
            return Math.exp(-(dx * dx) / .01) * (atFlow.y - .5) * h * .2;
          };
          const wob = (i: number, j: number): number => (t > 2 ? Math.sin(t * .7 + j * 1.3 + i * .5) * h * .008 : 0);
          const at3 = triplets(pal);
          ctx.strokeStyle = rgba(pal.inkRgb, .2);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(0, h - padB); ctx.lineTo(w * g, h - padB); ctx.stroke();
          const yOf = (i: number, j: number, which: 'top' | 'bot'): number => {
            const acc = series[j][i] + (which === 'bot' ? 0 : 0);
            const below = series.slice(0, j).reduce((s2, arr) => s2 + arr[i], 0);
            const up = (below + acc) / maxTotal;
            const dn = below / maxTotal;
            return h - padB - ((which === 'top' ? up : dn)) * (h - padT - padB) + wob(i, j) + wake(i);
          };
          for (let j = 0; j < series.length; j++) {
            ctx.beginPath();
            for (let i = 0; i < years.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), yOf(i, j, 'top'));
            for (let i = years.length - 1; i >= 0; i--) ctx.lineTo(X(i), yOf(i, j, 'bot'));
            ctx.closePath();
            ctx.fillStyle = rgba(at3[j], .48);
            ctx.fill();
            ctx.strokeStyle = rgba(at3[j], .9);
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }
          ctx.strokeStyle = rgba(pal.inkRgb, .12);
          for (let i = 0; i < years.length; i++) {
            if (X(i) > w * g) break;
            ctx.beginPath(); ctx.moveTo(X(i), padT * .55); ctx.lineTo(X(i), h - padB); ctx.stroke();
          }
          if (g < 1) {
            ctx.fillStyle = rgba(pal.redRgb, .85);
            ctx.beginPath(); ctx.arc(w * g, padT, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
        legend.forEach((el, i) => {
          const p = at(t, .5, 1.9 + i * .1);
          S(el, `opacity:${p.toFixed(3)};transform:translateX(${((1 - easeOut(p)) * -10).toFixed(1)}px)`);
        });
      },
    });
  }

  /* ── 10 出品印章：按经纬落到纸页上（落纸 → 墨圈扩散 → 常驻微亮） ── */
  {
    const s = scn('regions')!;
    const stamps = qsa(s, '.yb-stamp');
    const rings = stamps.map((el) => el.querySelector<HTMLElement>('.yb-stamp-ring'));
    // 悬停某枚印章：抬起来并报出国名与部数（其余压暗——印章挨得近，不压暗分不清指哪一枚）
    let hotStamp = -1;
    out.set('regions', {
      dur: 3.2,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-stamp');
        hotStamp = el ? Number(el.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        stamps.forEach((el, i) => {
          const p = stagger(t, i, .13, .55);
          const k = easeBack(p);
          const rot = vOf(el, '--rot', 0);
          const on = i === hotStamp && t > 1.4;
          S(el, `opacity:${(Math.min(1, p * 1.7) * (hotStamp >= 0 && !on ? .4 : 1)).toFixed(3)};`
            + `transform:translate(-50%,-50%) rotate(${(rot * (.4 + .6 * easeOut(p)) * (on ? .92 : 1)).toFixed(2)}deg)`
            + ` scale(${((1.34 - .34 * k) * (on ? 1.14 : 1)).toFixed(3)})`
            + (on ? ';z-index:3;filter:brightness(1.1)' : ''));
          const rp = at(t, .7, .1 + i * .13);
          S(rings[i], `opacity:${((1 - rp) * .8).toFixed(3)};transform:scale(${(.5 + rp * 1.5).toFixed(3)})`);
        });
      },
    });
  }

  /* ── 11 年代长河：河流冲刷 + 漂流 ── */
  {
    const s = scn('eras')!;
    const cv = canvas(s, 'eras');
    const dense = s.querySelector<HTMLElement>('[data-r="denseY"]');
    const side = s.querySelector<HTMLElement>('.yb-era-side');
    const ry = data.releaseYears;
    const wy = data.years.map((y2) => ({ y: y2.y, n: y2.films.length }));
    const maxN = Math.max(1, ...ry.map((r) => r.n));
    const maxW = Math.max(1, ...wy.map((r) => r.n));
    const denseY = ry.reduce((b, r) => (r.n > b.n ? r : b), ry[0] ?? { y: 0, n: 0 });
    T(dense, `${denseY.y} 年 · ${denseY.n} 部`);
    // 两条河都跟指针：贴近的那一段顺指针上下让开（下河小一半，别抢上河）
    let atEra: { x: number; y: number } | null = null;
    out.set('eras', {
      dur: 3.2,
      move(p) { atEra = localAt(cv?.el, p); },
      update({ t, pal }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          // 两条河：上河 = 上映年份的密度（1915→2026），下河 = 观影年份（2015→2026）
          const mid = h * .34, mid2 = h * .7, amp = h * .26, amp2 = h * .2;
          const g = easeInOut(at(t, 1.9));
          const X = (i: number): number => (i / Math.max(1, ry.length - 1)) * w;
          // 拨水：贴着指针的那一段顺着指针上下让开（高斯衰减，远处不动）；下河幅度小一半
          const wake = (u: number, k: number): number => {
            if (!atEra) return 0;
            const dx = u - atEra.x;
            return Math.exp(-(dx * dx) / .012) * (atEra.y - .5) * h * .22 * k;
          };
          const Y = (n: number, i: number): number => mid - (n / maxN) * amp + wake(X(i) / Math.max(1, w), 1);
          const X2 = (i: number): number => (i / Math.max(1, wy.length - 1)) * w * .82 + w * .18;
          const Y2 = (n: number, i: number): number => mid2 - (n / maxW) * amp2 + wake(X2(i) / Math.max(1, w), .5);
          const upto = Math.max(1, Math.floor(g * (ry.length - 1)));
          // 下河（观影年，12 年）先画：它是「你看的年份」，上河是「片子出品的年份」
          ctx.beginPath();
          ctx.moveTo(X2(0), Y2(wy[0]?.n ?? 0, 0));
          for (let i = 0; i < wy.length; i++) {
            const px2 = X2(i), py2 = Y2(wy[i].n, i);
            const nx2 = X2(Math.min(wy.length - 1, i + 1)), ny2 = Y2(wy[Math.min(wy.length - 1, i + 1)].n, Math.min(wy.length - 1, i + 1));
            ctx.bezierCurveTo((px2 + nx2) / 2, py2, (px2 + nx2) / 2, ny2, nx2, ny2);
          }
          const tip2 = X2(Math.max(0, Math.floor(g * (wy.length - 1))));
          ctx.lineTo(tip2, mid2 + amp2 * .6);
          ctx.lineTo(X2(0), mid2 + amp2 * .6);
          ctx.closePath();
          const grad2 = ctx.createLinearGradient(0, mid2 - amp2, 0, mid2 + amp2 * .6);
          grad2.addColorStop(0, rgba(pal.blueRgb, .3));
          grad2.addColorStop(1, rgba(pal.blueRgb, 0));
          ctx.fillStyle = grad2;
          ctx.fill();
          ctx.beginPath();
          for (let i = 0; i < wy.length; i++) {
            const px2 = X2(i), py2 = Y2(wy[i].n, i);
            const nx2 = X2(Math.min(wy.length - 1, i + 1)), ny2 = Y2(wy[Math.min(wy.length - 1, i + 1)].n, Math.min(wy.length - 1, i + 1));
            if (i === 0) ctx.moveTo(px2, py2);
            ctx.bezierCurveTo((px2 + nx2) / 2, py2, (px2 + nx2) / 2, ny2, nx2, ny2);
          }
          ctx.strokeStyle = rgba(pal.blueRgb, .9);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, Y(ry[0]?.n ?? 0, 0));
          for (let i = 0; i <= upto; i++) {
            const px = X(i), py = Y(ry[i].n, i);
            const nx = X(Math.min(ry.length - 1, i + 1)), ny = Y(ry[Math.min(ry.length - 1, i + 1)].n, Math.min(ry.length - 1, i + 1));
            ctx.bezierCurveTo((px + nx) / 2, py, (px + nx) / 2, ny, nx, ny);
          }
          const tipX = X(upto);
          ctx.lineTo(tipX, mid + amp * .5);
          ctx.lineTo(0, mid + amp * .5);
          ctx.closePath();
          const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp * .5);
          grad.addColorStop(0, rgba(pal.blueRgb, .26));
          grad.addColorStop(1, rgba(pal.blueRgb, 0));
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.beginPath();
          for (let i = 0; i <= upto; i++) {
            const px = X(i), py = Y(ry[i].n, i);
            const nx = X(Math.min(ry.length - 1, i + 1)), ny = Y(ry[Math.min(ry.length - 1, i + 1)].n, Math.min(ry.length - 1, i + 1));
            if (i === 0) ctx.moveTo(px, py);
            ctx.bezierCurveTo((px + nx) / 2, py, (px + nx) / 2, ny, nx, ny);
          }
          ctx.strokeStyle = rgba(pal.blueRgb, .92);
          ctx.lineWidth = 2;
          ctx.stroke();
          if (t > 1.7) {
            for (let i = 0; i < 64; i++) {
              const u = ((i * 37 % ry.length) / ry.length + (t - 1.7) * .05) % 1;
              const idx = Math.min(ry.length - 1, Math.round(u * (ry.length - 1)));
              const py = mid - (ry[idx].n / maxN) * amp * (1 + .05 * Math.sin(t * 1.4 + i)) + wake(u, 1);
              ctx.fillStyle = rgba(pal.blueRgb, .38);
              ctx.beginPath(); ctx.arc(u * w, py - 3, 1.3, 0, Math.PI * 2); ctx.fill();
            }
          } else {
            const hx = w * g;
            ctx.fillStyle = rgba(pal.redRgb, .9);
            ctx.beginPath(); ctx.arc(hx, mid, 3, 0, Math.PI * 2); ctx.fill();
          }
        }
        S(side, `opacity:${at(t, .6, .6).toFixed(3)}`);
      },
    });
  }

  /* ── 12 片龄横轴：色带铺开 → 海报刻度从轴右端（最老）往左扫入 ── */
  {
    const s = scn('age')!;
    const bands = qsa(s, '.yb-aband');
    const dots = qsa(s, '.yb-adot');
    const rule = s.querySelector<HTMLElement>('.yb-ageax-rule');
    const ticks = qsa(s, '.yb-atick');
    const side = s.querySelector<HTMLElement>('.yb-ageax-side');
    // 从老到新扫：轴右端起步，一路铺到左端（观感上像「时间流过来」）
    const order = dots.map((_, i) => i).sort((a, b) => b - a);
    const rank = new Map<number, number>();
    order.forEach((idx, k) => rank.set(idx, k));
    // 悬停一枚海报刻度：放大并报出片名与片龄（轴上全是无名缩略图，不给名字等于没信息）
    let hotDot = -1;
    out.set('age', {
      dur: 3.4,
      move(p) {
        const dot = under<HTMLElement>(p, '.yb-adot');
        hotDot = dot ? Number(dot.dataset.i ?? -1) : -1;
        if (dot?.dataset.tip) tip(host, dot.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        bands.forEach((b, i) => S(b, `opacity:${at(t, .5, .1 + i * .1).toFixed(3)}`));
        qsa(s, '.yb-aleg').forEach((el, i) => S(el, `opacity:${at(t, .4, .4 + i * .1).toFixed(3)}`));
        S(rule, `transform:scaleX(${easeInOut(at(t, .8, .1)).toFixed(4)});transform-origin:left center`);
        ticks.forEach((el, i) => S(el, `opacity:${at(t, .4, .5 + i * .08).toFixed(3)}`));
        const hover = t > 1.6 ? hotDot : -1;
        dots.forEach((d, i) => {
          const k = rank.get(i) ?? i;
          const p = at(t, .5, .35 + k * .017);
          const on = i === hover;
          S(d, `opacity:${(on ? 1 : p * (hover >= 0 ? .45 : 1)).toFixed(3)}`
            + `;transform:translateY(${((1 - easeOut(p)) * 9 - (on ? 6 : 0)).toFixed(1)}px) scale(${(on ? 1.9 : .7 + .3 * easeOut(p)).toFixed(3)})`
            + (on ? ';z-index:3' : ''));
        });
        S(side, `opacity:${at(t, .6, .6).toFixed(3)}`);
      },
    });
  }

  /* ── 13 我的评分：散点逐枚落位（按年份从早到晚）+ 边缘直方生长 + 均分线扫过 ── */
  {
    const s = scn('myrate')!;
    const plot = s.querySelector<HTMLElement>('[data-r="plot"]');
    const dots = qsa(s, '.yb-sdot2');
    const rows = qsa(s, '.yb-erow');
    const smean = s.querySelector<HTMLElement>('[data-r="smean"]');
    const flap = s.querySelector<HTMLElement>('[data-r="flap"]');
    const widths = rows.map((r) => r.style.getPropertyValue('--w'));
    let flapDone = false;
    // 悬停一枚点：放大 + 报出片名/评分/年份；同时右侧直方里对应那一档站起来（散点与边缘分布是一份数据的两个面）
    let hotDot = -1, hotScore = -1;
    out.set('myrate', {
      dur: 3.6,
      move(p) {
        const dot = under<HTMLElement>(p, '.yb-sdot2');
        hotDot = dot ? Number(dot.dataset.i ?? -1) : -1;
        const rowEl = under<HTMLElement>(p, '.yb-erow');
        hotScore = rowEl ? Number(rowEl.dataset.i ?? -1) : -1;
        const dotTip = dot?.dataset.tip;
        if (dotTip) tip(host, dotTip, p.cx, p.cy);
        else if (rowEl) tip(host, `<b>${hotScore}</b> 分 · ${data.myHist[hotScore] ?? 0} 部`, p.cx, p.cy);
        else tip(host, '');
      },
      update({ t, py }) {
        // 点按年份从左到右落（每点 delay 随序号线性增长），落到 100% 后整片轻微跟指针偏摆
        const hover = t > 2.2 ? hotDot : -1;
        dots.forEach((d, i) => {
          const p2 = at(t, .5, .3 + i * .0042);
          const k = easeOut(p2);
          const on = i === hover;
          S(d, `opacity:${(p2 * .95 * (on ? 1 : hover >= 0 ? .35 : 1)).toFixed(3)}`
            + `;transform:translateY(${((1 - k) * -12 - (on ? 5 : 0)).toFixed(1)}px) scale(${((.6 + .4 * easeBack(p2)) * (on ? 2.1 : 1)).toFixed(3)})`
            + (on ? ';z-index:3' : ''));
        });
        rows.forEach((r, i) => {
          const p2 = at(t, .5, .8 + i * .05);
          const on = hotScore === Number(r.dataset.i ?? -1);
          S(r.querySelector<HTMLElement>('[data-r="ebar"]'), `width:${widths[i]};transform:scaleX(${(easeOut(p2) * (on ? 1.05 : 1)).toFixed(4)});transform-origin:left center`);
          S(r, `opacity:${(at(t, .3, .8 + i * .05) * (hotScore >= 0 && !on ? .45 : 1)).toFixed(3)}`);
        });
        const lp = easeInOut(at(t, .8, 1.9));
        const y = vOf(smean, '--y', 50);
        S(smean, `bottom:calc(2.4em + ${(y * lp).toFixed(2)}% * (100% - 2.4em) / 100%);opacity:${at(t, .4, 1.9).toFixed(3)}`);
        // 落定后：整块散点跟着指针轻轻偏摆（原来这里有一段算了平滑却不用的死代码，现在真接上了）
        if (plot) S(plot, `transform:perspective(1200px) rotateY(${(py * 1.6).toFixed(2)}deg)`);
        if (t < .1) flapDone = false;
        if (!flapDone && t > 2.4) { setFlap(flap, data.avgMine.toFixed(2)); flapDone = true; }
      },
    });
  }

  /* ── 14 与豆瓣对照：背靠背双峰 ── */
  {
    const s = scn('mirror')!;
    const ups = qsa(s, '.yb-mcol.up'), downs = qsa(s, '.yb-mcol.down');
    const upPh = ups.map((c) => c.style.getPropertyValue('--ph'));
    const dnPh = downs.map((c) => c.style.getPropertyValue('--ph'));
    const means = qsa(s, '.yb-mir-mean');
    const mx = means.map((m) => vOf(m, '--x', 50));
    const dbN = data.dbHist.slice(), myN = data.myHist.slice();
    const flapDb = s.querySelector<HTMLElement>('[data-r="flapDb"]');
    const flapMine = s.querySelector<HTMLElement>('[data-r="flapMine"]');
    let flapDone = false;
    // 悬停某一档：两侧同一档的柱子一起站起来（背靠背双峰本来就是「同一档的两套分」，分开读会读错）
    let hotScore = -1;
    out.set('mirror', {
      dur: 3.0,
      move(p) {
        const col = under<HTMLElement>(p, '.yb-mcol');
        hotScore = col ? Number(col.dataset.i ?? -1) : -1;
        if (hotScore >= 0) tip(host, `<b>${hotScore}</b> 分 · 我的 ${myN[hotScore] ?? 0} 部 · 豆瓣 ${dbN[hotScore] ?? 0} 部`, p.cx, p.cy);
        else tip(host, '');
      },
      update({ t }) {
        const hot = t > 2.2 ? hotScore : -1;
        const draw = (list: HTMLElement[], phs: string[], nums: number[], origin: string): void => list.forEach((c, i) => {
          if (!phs[i]) return;
          const p = stagger(t, i, .06, .8);
          const on = i === hot;
          S(c.querySelector<HTMLElement>('.yb-mbar'), `height:${phs[i]};transform:scaleY(${(easeOut(p) * (on ? 1.06 : 1)).toFixed(4)});transform-origin:${origin};opacity:${on ? 1 : hot >= 0 ? .45 : 1}`);
          S(c, `opacity:${at(t, .3, i * .06).toFixed(3)}`);
          // 0 的箱子留空：中轴两侧本来就窄，数字全画出来会挤成三排小字（DOM 初值已空，这里也不能写回 0）
          const v = Math.round(nums[i] * easeOut(p));
          T(c.querySelector<HTMLElement>('.yb-mn'), v ? String(v) : '');
        });
        draw(ups, upPh, dbN, 'bottom center');
        draw(downs, dnPh, myN, 'top center');
        means.forEach((m, i) => {
          const p = easeInOut(at(t, .9, 1.2 + i * .15));
          S(m, `left:${(mx[i] * p).toFixed(2)}%;opacity:${at(t, .4, 1.2 + i * .15).toFixed(3)}`);
        });
        const gp = at(t, .6, 2.0);
        S(s.querySelector<HTMLElement>('.yb-mir-gap'), `opacity:${gp.toFixed(3)};transform:scale(${(.9 + .1 * easeBack(gp)).toFixed(3)})`);
        if (t < .1) flapDone = false;
        if (!flapDone && t > 2.0) {
          setFlap(flapDb, data.avgDb.toFixed(2));
          setFlap(flapMine, data.avgMine.toFixed(2));
          flapDone = true;
        }
      },
    });
  }

  /* ── 15 打分天平：阻尼摆动 ── */
  {
    const s = scn('balance')!;
    const beam = s.querySelector<HTMLElement>('[data-r="beam"]');
    const arm = s.querySelector<HTMLElement>('[data-r="arm"]');
    const pans = qsa(s, '.yb-bal-pan');
    const rows = qsa(s, '.yb-drow');
    const lists = s.querySelector<HTMLElement>('.yb-bal-lists');
    const tilt = vOf(beam, '--tilt', 0);
    // 全片唯一一处「按住才有手感」的器件：指针压住哪一侧的盘，秤杆就朝哪边沉，松手弹回数据本身那一档。
    // 悬停不按压也给一点预兆（±.16），不然「能压」这件事没人知道。
    let hoverPan = -1, pressPan = -1, shown = 0;
    const panOf = (p: PointerAt): number => {
      const el = under<HTMLElement>(p, '.yb-bal-pan');
      return el ? (el.classList.contains('l') ? 0 : 1) : -1;
    };
    out.set('balance', {
      dur: 3.0,
      move(p) { hoverPan = panOf(p); },
      down(p) { pressPan = panOf(p); },
      up() { pressPan = -1; },
      update({ t }) {
        const p = at(t, 2.0);
        const extra = pressPan === 0 ? .55 : pressPan === 1 ? -.55 : hoverPan === 0 ? .16 : hoverPan === 1 ? -.16 : 0;
        // 取负号：avgDiff<0（我整体打得更低）时右端（豆瓣均分）下沉——秤杆朝分高的一端沉
        shown = p < 1
          ? tilt * spring(p, 3.4, 2.2)
          : toward(shown, tilt + extra, pressPan >= 0 ? .05 : .12) + Math.sin(t * 1.1) * .012;
        const deg = -shown * 9;
        S(arm, `transform:rotate(${deg.toFixed(3)}deg)`);
        pans.forEach((pan, i) => {
          // 挂点对齐秤杆两端（杆宽 64% 居中 → 两端在 18%/82%），挂在 6% 会飘在杆外
          const base = i === 0 ? 'left:17%;right:auto' : 'left:auto;right:17%';
          // 挂盘不跟着转（真实天平上吊着的盘是平的），只挪位置
          const on = i === pressPan || (pressPan < 0 && i === hoverPan);
          S(pan, `${base};opacity:${at(t, .5, .5 + i * .15).toFixed(3)}`
            + (on ? ';filter:brightness(1.12);cursor:grab' : ''));
        });
        rows.forEach((r, i) => {
          const q = stagger(t, i, .07, .6);
          S(r, `opacity:${q.toFixed(3)};transform:translateX(${((1 - easeOut(q)) * 14).toFixed(1)}px)`);
        });
        S(lists, `opacity:${at(t, .5, 1.0).toFixed(3)}`);
      },
    });
  }

  /* ── 16 榜首三部：台座从地里升起 → 卡片纵深飞入落台 → 冠军头顶追光 ── */
  {
    const s = scn('podium')!;
    const slots = qsa(s, '.yb-pod-slot');
    const cards = qsa(s, '.yb-pod');
    const rings = cards.map((c) => c.querySelector<HTMLElement>('.yb-pod-ring'));
    const beam = s.querySelector<HTMLElement>('[data-r="beam"]');
    // 站位次序：视觉上左=榜眼、中=榜首、右=探花；进场按名次来（冠军最后落台）
    // 落台后整排跟指针让位（像风扫过领奖台），指针停在哪张卡上它就抬起来——这一页是「前三名」的门面
    let hotPod = -1;
    out.set('podium', {
      dur: 3.6,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-pod');
        hotPod = el ? Number(el.dataset.i ?? -1) : -1;
      },
      update({ t, px, py }) {
        slots.forEach((slot, i) => {
          const rank = Number(slot.dataset.i ?? 0);
          const delay = .15 + rank * .28;
          const rise = easeOut(at(t, .75, delay));
          S(slot, `opacity:${at(t, .4, delay).toFixed(3)}`);
          const block = slot.querySelector<HTMLElement>('.yb-pod-block');
          S(block, `transform:translateY(${((1 - rise) * 42).toFixed(1)}px);opacity:${(.2 + .8 * rise).toFixed(3)}`);
          const card = cards[i];
          const cp = at(t, .95, delay + .45);
          const ck = easeOut(cp);
          const ringP = at(t, 1.2, delay + .8);
          S(rings[i], `opacity:${((1 - ringP) * .9).toFixed(3)};transform:scale(${(.4 + ringP * 1.4).toFixed(3)})`);
          if (t > 2.2) {
            const shine = (((t - 2.2 + i * .7) % 4.2) / 4.2).toFixed(4);
            const float = Math.sin((t - 2.2) * 1.2 + i) * 1.8;
            const on = i === hotPod;
            S(card, `opacity:1;transform:translate(${(-px * 5 + (on ? 0 : 0)).toFixed(2)}px,${(float - py * 3.4 - (on ? 10 : 0)).toFixed(2)}px)`
              + ` scale(${on ? 1.045 : 1});--shine:${shine}` + (on ? ';z-index:3' : ''));
          } else {
            S(card, `opacity:${Math.min(1, cp * 1.9).toFixed(3)};transform:translate3d(0,${((1 - ck) * 30).toFixed(1)}px,${((1 - ck) * -170).toFixed(0)}px) scale(${(1.3 - .3 * ck).toFixed(3)})`);
          }
        });
        if (beam) S(beam, `opacity:${(at(t, .8, 2.1) * (t > 2.6 ? .72 + .28 * Math.sin((t - 2.6) * 1.4) : 1)).toFixed(3)}`
          + (t > 2.2 ? `;transform:translateX(${(px * 26).toFixed(1)}px)` : ''));
      },
    });
  }

  /* ── 17 高分墙：对角波浪翻牌 ── */
  {
    const s = scn('ninewall')!;
    const grid = s.querySelector<HTMLElement>('[data-r="grid"]');
    const tiles = qsa(s, '.yb-tile');
    const cols = 9;
    // 整墙随指针轻微转向（视差），指针停在哪张上它就抬起来——36 张同尺寸的格子，没有这层就看不出层次
    let hotTile = -1;
    out.set('ninewall', {
      dur: 3.4,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-tile');
        hotTile = el ? Number(el.dataset.i ?? -1) : -1;
      },
      update({ t, px, py }) {
        tiles.forEach((el, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const p = at(t, .62, .25 + (r + c) * .055);
          const k = easeOut(p);
          const on = i === hotTile;
          S(el, `opacity:${k.toFixed(3)};transform:perspective(700px) rotateY(${((1 - k) * 68).toFixed(2)}deg)`
            + ` translateY(${((1 - k) * 14 - (on ? 8 : 0)).toFixed(1)}px) scale(${((.86 + .14 * k) * (on ? 1.06 : 1)).toFixed(3)})`
            + (on ? ';z-index:3;filter:brightness(1.06)' : ''));
        });
        S(grid, `--sweep:${(t > 1.7 ? ((t - 1.7) % 5) / 5 : -1).toFixed(4)}`
          + (t > 2.2 ? `;transform:perspective(1400px) rotateX(${(-py * 2.4).toFixed(2)}deg) rotateY(${(px * 2.8).toFixed(2)}deg)` : ''));
      },
    });
  }

  /* ── 18 御用导演：右侧推入 ── */
  {
    const s = scn('directors')!;
    const rows = qsa(s, '.yb-prow');
    const shotsRow = rows.map((r) => qsa(r, '.yb-pshots i'));
    // 悬停一行：整行推近、四张封面摊开一点（导演榜的看点是「他拍了哪些」，不悬停就只能看见前两张）
    let hotRow = -1;
    out.set('directors', {
      dur: 2.9,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-prow');
        hotRow = el ? Number(el.dataset.i ?? -1) : -1;
      },
      update({ t, px }) {
        const hot = t > 1.8 ? hotRow : -1;
        rows.forEach((row, i) => {
          const p = stagger(t, i, .11, .7);
          const on = i === hot;
          S(row, `opacity:${(at(t, .4, i * .11) * (hot >= 0 && !on ? .4 : 1)).toFixed(3)}`
            + `;transform:translateX(${((1 - easeOut(p)) * 34 - (on ? 12 : 0) - px * 3).toFixed(1)}px)`);
          S(row.querySelector<HTMLElement>('.yb-pbar'), `transform:scaleX(${(easeOut(p) * (on ? 1.03 : 1)).toFixed(4)});transform-origin:left center`);
          shotsRow[i].forEach((shot, j) => {
            const q = stagger(t, j, .06, .5);
            const spread = on ? j * 5 : 0;
            S(shot, `opacity:${q.toFixed(3)};transform:translate(${spread.toFixed(1)}px,${((1 - easeOut(q)) * 8 - (on ? Math.abs(j - 1.5) * 1.2 : 0)).toFixed(1)}px)`
              + (on ? ` rotate(${(j - 1.5) * 2.2}deg) scale(1.06)` : ''));
          });
        });
      },
    });
  }

  /* ── 19 座上常客：沿弧滑入（弧是版式本身，不是动画的临时状态）+ 弧上呼吸 ── */
  {
    const s = scn('actors')!;
    const cards = qsa(s, '.yb-acard');
    const arc = s.querySelector<HTMLElement>('[data-r="arc"]');
    const attlChars = qsa(s, '.yb-attl i');
    const mid = (cards.length - 1) / 2;
    // 指针左右横move：整条弧转一点（像转头看这一排人）；停在哪张卡上，它沿弧升起来
    let hotCard = -1;
    out.set('actors', {
      dur: 3.0,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-acard');
        hotCard = el ? Number(el.dataset.i ?? -1) : -1;
      },
      update({ t, px }) {
        const tw = t > 1.8 ? px : 0;
        S(arc, `transform:translateX(${(tw * 10).toFixed(1)}px) rotate(${(tw * 1.5).toFixed(2)}deg)`);
        // 艺术字「座上常客」：四字逐字浮起落定，偶数字微侧一点点（盖章不正的闲笔）
        attlChars.forEach((c, i) => {
          const k = easeOut(at(t, .7, .3 + i * .16));
          S(c, `opacity:${k.toFixed(3)};transform:translateY(${((1 - k) * 30).toFixed(1)}px) rotate(${i % 2 ? 1.6 : -1.6}deg)`);
        });
        cards.forEach((c, i) => {
          const p = at(t, .95, i * .13);
          const k = easeOut(p);
          const breath = t > 1.4 ? Math.sin((t - 1.4) * 1.1 + i * .7) * .45 : 0;
          // 悬停的那张沿弧再升一点，两侧邻居顺势让开——弧是「一排人」，被点到的人该站出来
          const d = hotCard < 0 ? 0 : i - hotCard;
          const stand = d === 0 ? -.9 : Math.abs(d) === 1 ? .35 : 0;
          // --dy / --br 加在基准位移上：卡片沿弧线滑到位，落位后整段弧轻轻呼吸
          S(c, `opacity:${Math.min(1, p * 1.5).toFixed(3)};--dy:${((1 - k) * 16 + stand).toFixed(2)}em;--br:${breath.toFixed(2)}em`
            + (p >= 1 ? '' : `;transform:scale(${(.9 + .1 * k).toFixed(3)})`)
            + (d === 0 ? ';z-index:3' : ''));
          void mid;
        });
      },
    });
  }

  /* ── 20 连映系列：扇面摊开 ── */
  {
    const s = scn('series')!;
    const groups = qsa(s, '.yb-ser');
    const stacks = groups.map((g) => qsa(g, '.yb-ser-c'));
    // 悬停一组：扇面摊得更开（一叠封面全都能看清是哪几部），其余组压暗
    let hotSer = -1;
    out.set('series', {
      dur: 3.0,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-ser');
        hotSer = el ? Number(el.dataset.i ?? -1) : -1;
      },
      update({ t }) {
        const hot = t > 1.8 ? hotSer : -1;
        groups.forEach((g, gi) => {
          const gp = at(t, .6, gi * .18);
          const on = gi === hot;
          S(g, `opacity:${(gp * (hot >= 0 && !on ? .42 : 1)).toFixed(3)};transform:translateY(${((1 - easeOut(gp)) * 14 - (on ? 6 : 0)).toFixed(1)}px)`);
          stacks[gi].forEach((c, j) => {
            const p = at(t, .8, .25 + gi * .18 + j * .07);
            const k = easeBack(p);
            const fan = on ? 1.55 : 1;
            const ang = j * 7.5 * k * fan + (t > 1.8 ? Math.sin((t - 1.8) * 1.1 + j * .5 + gi) * .7 : 0);
            S(c, `opacity:${clamp01(p).toFixed(3)};transform:translateX(${(j * 16 * k * fan).toFixed(1)}px)`
              + ` translateY(${(-j * 3 * k * fan).toFixed(1)}px) rotate(${ang.toFixed(2)}deg) scale(${on ? 1.03 : 1})`);
          });
        });
      },
    });
  }

  /* ── 21 追剧深度：磁带延展 ── */
  {
    const s = scn('binge')!;
    const rows = qsa(s, '.yb-eprow');
    // 悬停一行：磁带再延展一点、那个刻度点亮，并报出剧名与集数
    let hotEp = -1;
    out.set('binge', {
      dur: 3.2,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-eprow');
        hotEp = el ? Number(el.dataset.i ?? -1) : -1;
        const e = hotEp >= 0 ? data.episodes[hotEp] : null;
        if (e) tip(host, `${esc0(e.base)} · ${e.ep} 集`, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        const hot = t > 1.8 ? hotEp : -1;
        rows.forEach((row, i) => {
          const e = data.episodes[i];
          if (!e) return;
          const p = stagger(t, i, .14, 1.1);
          const on = i === hot;
          S(row.querySelector<HTMLElement>('.yb-eptape'), `transform:scaleX(${(easeInOut(p) * (on ? 1.02 : 1)).toFixed(4)});transform-origin:left center`);
          S(row, `opacity:${(at(t, .4, i * .14) * (hot >= 0 && !on ? .42 : 1)).toFixed(3)}`);
          S(row.querySelector<HTMLElement>('.yb-eptick'), `opacity:${on ? 1 : .5};transform:scale(${on ? 2.2 : 1})`);
          T(row.querySelector<HTMLElement>('.yb-epn b'), String(Math.round(e.ep * easeOut(p))));
        });
      },
    });
  }

  /* ── 22 影评手记：打字机 ── */
  {
    const s = scn('notes')!;
    const notes = qsa(s, '.yb-note');
    const paras = notes.map((n) => n.querySelector<HTMLElement>('[data-r="ntx"]'));
    const KEY = ['喜欢', '好看', '感动', '治愈', '孤独', '时间', '自由', '生活', '我们', '自己', '温柔', '漫长'];
    const re = new RegExp(`(${KEY.join('|')})`, 'g');
    const full = paras.map((p) => p?.dataset.full ?? '');
    const chars = full.map((f) => [...f]);
    // 悬停一张卡片：它按指针在卡内的位置做 3D 倾斜（像把这张纸捏在手里看）
    let hotNote = -1, notePtr: PointerAt | null = null;
    out.set('notes', {
      dur: 4.4,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-note');
        hotNote = el ? Number(el.dataset.i ?? -1) : -1;
        notePtr = p;
      },
      update({ t }) {
        const hot = t > 1.6 ? hotNote : -1;
        notes.forEach((n, i) => {
          const cardP = at(t, .5, i * .5);
          const on = i === hot;
          const l = on && notePtr ? localAt(n, notePtr) : null;
          const ry = l ? (l.x - .5) * 9 : 0, rx = l ? (.5 - l.y) * 7 : 0;
          S(n, `opacity:${(cardP * (hot >= 0 && !on ? .5 : 1)).toFixed(3)}`
            + `;transform:translateY(${((1 - easeOut(cardP)) * 16 - (on ? 6 : 0)).toFixed(1)}px)`
            + (on ? ` perspective(900px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)` : '')
            + (on ? ';z-index:3' : ''));
          const p = paras[i];
          if (!p) return;
          const cps = chars[i];
          const typed = Math.floor(clamp01((t - (i * .5 + .3)) / (cps.length * .026)) * cps.length);
          const done = typed >= cps.length;
          const html = esc0(cps.slice(0, typed).join('')).replace(re, '<mark>$1</mark>') + (done ? '<i class="yb-caret done"></i>' : '<i class="yb-caret"></i>');
          if (p.dataset.shown !== html) { p.dataset.shown = html; p.innerHTML = html; }
        });
      },
    });
  }

  /* ── 23 豆瓣短评：弹幕漂流 ── */
  {
    const s = scn('quotes')!;
    const lanes = qsa(s, '.yb-lane');
    const quotes = lanes.map((l) => qsa(l, '.yb-quote'));
    // 位移改成**累积**（原来是 `(t*speed)%420` 的无状态取模，没法慢放）：
    // 指针停在哪一条上，那条泳道就降到 12% 速度——长句在弹幕里根本读不完，这是唯一的可读性出口。
    const laneOff = [0, 0, 0];
    const SPAN = 420;
    let lastT = 0, hotLane = -1, hotQuote: HTMLElement | null = null;
    out.set('quotes', {
      dur: 2.0,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-quote');
        hotQuote = el;
        hotLane = el ? Number(el.closest<HTMLElement>('.yb-lane')?.dataset.i ?? -1) : -1;
        if (el?.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy); else tip(host, '');
      },
      update({ t }) {
        const dt = Math.max(0, Math.min(.12, t - lastT));
        lastT = t;
        if (t < .1) { laneOff[0] = laneOff[1] = laneOff[2] = 0; }
        lanes.forEach((lane, i) => {
          const dir = i % 2 === 0 ? -1 : 1;
          const speed = (14 + i * 8) * (i === hotLane ? .12 : 1);
          laneOff[i] = (laneOff[i] + dt * speed * dir) % SPAN;
          S(lane, `transform:translateY(${laneOff[i].toFixed(1)}px)`);
          quotes[i].forEach((qt, j) => {
            const on = qt === hotQuote;
            S(qt, `opacity:${(at(t, .5, .1 + j * .09) * (on ? 1 : hotLane >= 0 && hotLane === i ? .42 : .94)).toFixed(3)}`
              + (on ? ';transform:scale(1.04)' : ';transform:none'));
          });
        });
      },
    });
  }

  /* ── 24 口味矩阵：对角扫入 + 十字巡行 ── */
  {
    const s = scn('matrix')!;
    const cv = canvas(s, 'matrix');
    const m = data.matrix;
    const colLabels = qsa(s, '.yb-mx-cols span');
    const rowLabels = qsa(s, '.yb-mx-rows span');
    // 指针在格上：十字高亮交给指针（自动巡行那套只在指针不图上时才跑），并报出这一格的部数
    let hotCell: { r: number; c: number } | null = null;
    out.set('matrix', {
      dur: 3.4,
      move(p) {
        const l = localAt(cv?.el, p);
        if (!l) { hotCell = null; tip(host, ''); return; }
        const c = Math.min(m.cols.length - 1, Math.max(0, Math.floor(l.x * m.cols.length)));
        const r = Math.min(m.rows.length - 1, Math.max(0, Math.floor(l.y * m.rows.length)));
        hotCell = { r, c };
        tip(host, `${esc0(m.rows[r])} × ${esc0(m.cols[c])} · ${m.n[r][c]} 部`, p.cx, p.cy);
      },
      update({ t, pal }) {
        if (cv) {
          cv.fit();
          cv.clear();
          const ctx = cv.ctx, w = cv.w, h = cv.h;
          const cols = m.cols.length, rows = m.rows.length;
          const cw = w / cols, ch = h / rows;
          const sweep = t > 1.8 && !hotCell ? ((t - 1.8) % 5.5) / 5.5 : -1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `${Math.round(Math.min(cw, ch) * .34)}px "Segoe UI", system-ui, sans-serif`;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const n = m.n[r][c];
              const p = at(t, .5, .2 + (r + c) * .07);
              if (p <= 0) continue;
              const k = easeOut(p);
              const x = c * cw, y = r * ch;
              const ratio = n / m.max;
              const inCross = sweep >= 0 && (Math.abs(sweep * cols - (c + .5)) < .6 || Math.abs(sweep * rows - (r + .5)) < .6);
              const onCell = !!hotCell && hotCell.r === r && hotCell.c === c;
              const inPtr = !!hotCell && (hotCell.r === r || hotCell.c === c);
              ctx.globalAlpha = k;
              ctx.fillStyle = onCell ? rgba(pal.redRgb, .35 + .45 * ratio)
                : inPtr ? rgba(pal.blueRgb, .18 + .34 * ratio)
                  : inCross ? rgba(pal.blueRgb, .18 + .34 * ratio)
                    : rgba(n === 0 ? pal.inkRgb : pal.redRgb, n === 0 ? .05 : .1 + .62 * ratio);
              ctx.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
              if (onCell) {
                ctx.strokeStyle = rgba(pal.redRgb, .95);
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5);
              }
              ctx.fillStyle = ratio > .55 || onCell ? rgba(pal.onStrong, .95) : rgba(pal.inkRgb, .8);
              ctx.fillText(String(Math.round(n * k)), x + cw / 2, y + ch / 2);
            }
          }
          ctx.globalAlpha = 1;
        }
        // 行列标签跟着指针那一格亮：这页的字全在画布里，标签是唯一的定位参照
        colLabels.forEach((el, i) => S(el, `opacity:${(hotCell && hotCell.c === i ? 1 : at(t, .5, .2 + i * .05) * (hotCell ? .45 : 1)).toFixed(3)}`));
        rowLabels.forEach((el, i) => S(el, `opacity:${(hotCell && hotCell.r === i ? 1 : at(t, .5, .2 + i * .05) * (hotCell ? .45 : 1)).toFixed(3)}`));
      },
    });
  }

  /* ── 26 落款：四格翻页钟逐格落定（这一页只剩时钟行） ── */
  {
    const s = scn('colophon')!;
    const items = ['flapTotal', 'flapWatched', 'flapDur', 'flapEp']
      .map((k) => s.querySelector<HTMLElement>(`[data-r="${k}"]`));
    const groups = items.map((el) => el?.closest<HTMLElement>('.yb-kv') ?? null);
    const flapVals = [String(data.total), String(data.watchedCount), humanDurShort(data.totalMinutes), String(data.epTotal)];
    let flapDone = false;
    // 悬停某一格：它那组数字抬起来、四格朝指针轻轻转（机械翻牌钟被手指推了一下的那种感觉）
    let hotG = -1;
    out.set('colophon', {
      dur: 3.0,
      move(p) {
        const el = under<HTMLElement>(p, '.yb-colo-grid .yb-kv');
        hotG = el ? groups.findIndex((g) => g === el) : -1;
      },
      update({ t, px, py }) {
        if (t < .1) flapDone = false;
        if (!flapDone && t > .5) {
          items.forEach((el, i) => setTimeout(() => setFlap(el, flapVals[i]), i * 110));
          flapDone = true;
        }
        groups.forEach((g, i) => {
          if (!g) return;
          const on = i === hotG && t > 1.4;
          S(g, `transform:translateY(${on ? -4 : 0}px) scale(${on ? 1.05 : 1});opacity:${hotG >= 0 && !on ? .55 : 1}`);
          items[i]?.querySelectorAll<HTMLElement>('.yb-flap').forEach((cell) => {
            S(cell, on ? `transform:perspective(500px) rotateX(${(py * -9).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg)` : 'transform:none');
          });
        });
      },
    });
  }

  return out;
}
