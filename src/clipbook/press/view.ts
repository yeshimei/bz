/**
 * 读报特刊 · 版面（markup 骨架，十六幕，一幕一屏）
 *
 * 构图口径（本轮「报章语法」深挖）：不再居中对称——每幕一个专属版式，
 * 大数字压角 / 竖排刊字 / 报眼 / 中缝 / 号外栏，版面张力靠字号差、留白与轻旋转。
 * 结构：遮罩根 .bz-rp → 层框 .bz-rp-box（内联几何 = 剪藏本面板矩形，行为层写入）→
 *   滚动口 .bz-rp-scroll（引擎一滚一幕）→ 影片 .bz-rp-film（十六幕纵排）+ 过片遮带 + 底栏刻度。
 * 幕内 data-r 钩子即 motions.ts 的表演靶点；数字/行由 data 驱动生成，颜色走 --clip-* 变量。
 * data-cur 属性与 [data-r="shut"] / .bz-rp-tick 是引擎契约，动线不可改名。
 */
import { esc } from '../render';
import { formatMinutes } from '../report-stats';
import type { PressData } from './data';

/** 十六幕目录（名 = 底栏刻度 title 与幕名；顺序即放映顺序） */
const SCN_NAMES = [
  '开印', '速览', '工班钟', '热力带', '读得最久', '消息源榜', '号外', '收录节奏',
  '驻留日历', '班次×来源', '关键词', '报库盘点', '压库专页', '未读版图', '总账', '落款',
] as const;

/** 里程表数字格（data-n 目标值 + data-fmt 格式；表演层按 t 滚） */
function numCell(n: number, fmt: 'int' | 'min', label: string): string {
  return `<div class="bz-rp-cell" data-r="cell"><b class="bz-rp-num" data-r="num" data-n="${n}" data-fmt="${fmt}">${fmt === 'min' ? esc(formatMinutes(n)) : n}</b><span>${esc(label)}</span></div>`;
}

/** 幕 5 头条（第一名独占一行，报章头版语法：大字标题 + 粗墨线） */
function headRow(d: PressData): string {
  const r = d.top[0];
  if (!r) return '';
  const max = Math.max(1, ...d.top.map((x) => x.minutes));
  return `
    <div class="bz-rp-head" data-r="head">
      <span class="bz-rp-rank" data-r="rank">1</span>
      <div class="bz-rp-head-main">
        <b class="bz-rp-head-t" title="${esc(r.title)}">${esc(r.title)}</b>
        <span class="bz-rp-head-s"><i>${esc(r.src)}</i><em data-r="heads">${esc(formatMinutes(r.minutes))}</em></span>
      </div>
      <span class="bz-rp-head-bar"><i data-r="headb" style="width:${Math.max(6, Math.round((r.minutes / max) * 100))}%"></i></span>
    </div>`;
}

/** 幕 5 次榜（2-5 名小行，活字坠落入场） */
function topRows(d: PressData): string {
  const max = Math.max(1, ...d.top.map((r) => r.minutes));
  return d.top.slice(1).map((r, i) => `
    <div class="bz-rp-row" data-r="row">
      <span class="bz-rp-rank" data-r="rank">${i + 2}</span>
      <span class="bz-rp-row-t" title="${esc(r.title)}">${esc(r.title)}</span>
      <span class="bz-rp-row-src">${esc(r.src)}</span>
      <span class="bz-rp-minb"><i data-r="minb" style="width:${Math.max(4, Math.round((r.minutes / max) * 100))}%"></i></span>
      <b class="bz-rp-row-min">${esc(formatMinutes(r.minutes))}</b>
    </div>`).join('');
}

/** 幕 6 消息源榜行（双条：橙条时长 + 细条篇数；王牌章挪到幕右上压角） */
function srcRows(d: PressData): string {
  const max = Math.max(1, ...d.sources.map((s) => s.minutes));
  const maxA = Math.max(1, ...d.sources.map((s) => s.articles));
  return d.sources.map((s) => `
    <div class="bz-rp-row" data-r="row">
      <span class="bz-rp-row-t bz-rp-row-t--src" title="${esc(s.name)}">${esc(s.name)}</span>
      <span class="bz-rp-bar"><i data-r="bar" style="width:${Math.max(3, Math.round((s.minutes / max) * 100))}%"></i></span>
      <span class="bz-rp-subbar"><i data-r="subbar" style="width:${Math.max(3, Math.round((s.articles / maxA) * 100))}%"></i></span>
      <b class="bz-rp-row-min" data-r="cnt" data-n="${s.minutes}" data-x="${s.articles}">${esc(formatMinutes(s.minutes))} · ${s.articles} 篇</b>
    </div>`).join('');
}

/** 幕 7 号外电传行（clip-path 逐行显影 = 电传机连发） */
function recentRows(d: PressData): string {
  return d.recent.map((r) => `
    <div class="bz-rp-row bz-rp-row--wire" data-r="wire">
      <i class="bz-rp-wire-dot" data-r="dot" aria-hidden="true"></i>
      <span class="bz-rp-row-t" title="${esc(r.title)}">${esc(r.title)}</span>
      <span class="bz-rp-row-src">${esc(r.src)}</span>
      <span class="bz-rp-ago" data-r="ago">${esc(r.ago)} · ${r.minutes} 分钟</span>
    </div>`).join('');
}

/** 幕 8 日期标签（贴柱底） */
function dayLabels(d: PressData): string {
  if (!d.lib) return '';
  return d.lib.byDay.map((x) => `<span data-r="dl">${esc(x.label)}</span>`).join('');
}

/** 幕 13 压库三行（逐行缩进递增 = 卷宗摞放；天数里程表 + 压库戳） */
function old3Rows(d: PressData): string {
  return d.oldest3.map((o, i) => `
    <div class="bz-rp-old3" data-r="old3" style="--o3i:${i}">
      <span class="bz-rp-rank" data-r="o3rank">${i + 1}</span>
      <div class="bz-rp-old3-main">
        <span class="bz-rp-old3-t" title="${esc(o.title)}">${esc(o.title)}</span>
        <span class="bz-rp-row-src">${esc(o.src)} · 压了 ${esc(cnDay(o.days))} 天的报</span>
      </div>
      <b class="bz-rp-old3-d" data-r="o3d"><i data-r="o3n" data-n="${o.days}">0</i> 天</b>
      <span class="bz-rp-badge" data-r="o3tag">压库</span>
    </div>`).join('');
}

/** ISO 日期 → 「9 月 21 日」（最投入的一天） */
function dayCn(iso: string): string {
  const p = iso.split('-');
  return p.length >= 3 ? `${Number(p[1])} 月 ${Number(p[2])} 日` : iso;
}

/** 天数 → 数字串（压库行内嵌里程数） */
function cnDay(days: number): string {
  return `${days}`;
}

/** 幕 10 班次图例 */
function shiftLegend(): string {
  return `<div class="bz-rp-legend" data-r="legend">
    <span data-r="lg"><i style="background:var(--clip-line,#e4ddd0)"></i>夜班 0-6</span>
    <span data-r="lg"><i style="background:var(--clip-accent-soft,#e8965a);opacity:.55"></i>晨班 6-12</span>
    <span data-r="lg"><i style="background:var(--clip-accent-soft,#e8965a);opacity:.8"></i>午班 12-18</span>
    <span data-r="lg"><i style="background:var(--clip-accent,#c2410c)"></i>晚班 18-24</span>
  </div>`;
}

/** 竖排刊字（报眼/侧栏语法：每字一枚 span 供逐字表演） */
function vertChars(text: string): string {
  return [...text].map((c) => `<span>${esc(c)}</span>`).join('');
}

/** 层骨架（数据已烘进 markup；表演只动样式不建节点） */
export function pressHtml(d: PressData): string {
  const busiest = d.busiest
    ? `<div class="bz-rp-busiest" data-r="brow"><span>最投入的一天</span><i class="bz-rp-lead" data-r="blead"></i><b data-r="bday">${esc(dayCn(d.busiest.date))}</b><span class="bz-rp-dim" data-r="bmin">${esc(formatMinutes(d.busiest.minutes))}</span></div>`
    : '';
  const deep = d.deepMinutes > 0
    ? `<div class="bz-rp-busiest" data-r="deeprow"><span>最深一段</span><i class="bz-rp-lead" data-r="deeplead"></i><b data-r="deepv">${esc(formatMinutes(d.deepMinutes))}</b><span class="bz-rp-dim">不歇气</span></div>`
    : '';
  const lib = d.lib;
  return `
    <div class="bz-rp-box">
      <div class="bz-rp-scroll">
        <div class="bz-rp-film">

          <!-- 01 开印：油墨泼开 + 刊名活字错落 + 竖排报眼 + 期号压角 -->
          <section class="bz-rp-scn" data-id="c01" data-name="开印">
            <canvas class="bz-rp-cv" data-cv="c01" aria-hidden="true"></canvas>
            <div class="bz-rp-mast-eye" data-r="eye" aria-hidden="true">${vertChars('读报特刊')}</div>
            <div class="bz-rp-in bz-rp-in--mid">
              <h1 class="bz-rp-mast" data-r="mast"><span>我</span><span>读</span><span>了</span><span>什</span><span>么</span></h1>
              <div class="bz-rp-mast-sub" data-r="sub">读报特刊 · 建库以来</div>
              <i class="bz-rp-mast-line" data-r="line" aria-hidden="true"></i>
            </div>
            <b class="bz-rp-issue" data-r="issue" aria-hidden="true">第 ${d.issue} 期</b>
          </section>

          <!-- 02 速览：总时长大数压左上，三格沿右缘错落 -->
          <section class="bz-rp-scn" data-id="c02" data-name="速览">
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">本期速览</h2>
              <div class="bz-rp-grid">
                <div class="bz-rp-hero" data-r="cell">
                  <b class="bz-rp-hero-n" data-r="num" data-n="${d.totalMinutes}" data-fmt="min">${esc(formatMinutes(d.totalMinutes))}</b>
                  <span class="bz-rp-hero-l">总阅读时长</span>
                </div>
                <div class="bz-rp-side">
                  ${numCell(d.articles, 'int', '已读篇数')}
                  ${numCell(d.activeDays, 'int', '活跃天数')}
                  ${numCell(d.streak, 'int', '连续天数')}
                </div>
              </div>
              <i class="bz-rp-inkline" data-r="inkline" aria-hidden="true"></i>
              ${busiest}
              ${deep}
            </div>
          </section>

          <!-- 03 工班钟：钟面左置 + 24 刻度 + 跟随针；工班行右侧 -->
          <section class="bz-rp-scn" data-id="c03" data-name="工班钟">
            <canvas class="bz-rp-cv" data-cv="c03" aria-hidden="true"></canvas>
            <div class="bz-rp-in bz-rp-in--dial">
              <h2 class="bz-rp-h">工班钟 · 什么时刻在读</h2>
              <div class="bz-rp-dial-c" data-r="dialc"><b>${d.peakHour >= 0 ? d.peakHour : '--'} 点</b><span>${d.peakHour >= 0 ? esc(shiftName(d.peakHour)) : '还没读过'}</span></div>
              <div class="bz-rp-shifts">
                ${d.shifts.map((s) => `
                  <div class="bz-rp-shift" data-r="shift">
                    <span class="bz-rp-shift-nm">${esc(s.label)}<i>${esc(s.span)}</i></span>
                    <span class="bz-rp-shift-b"><i data-r="shiftb" style="width:${Math.max(3, Math.round((s.minutes / Math.max(1, ...d.shifts.map((x) => x.minutes))) * 100))}%"></i></span>
                    <b class="bz-rp-shift-v" data-r="shiftv" data-n="${s.minutes}">${esc(formatMinutes(s.minutes))}</b>
                  </div>`).join('')}
              </div>
            </div>
          </section>

          <!-- 04 热力带：矩阵占右 2/3，竖排刊字压右缘，光标十字跟随 -->
          <section class="bz-rp-scn" data-id="c04" data-name="热力带">
            <canvas class="bz-rp-cv" data-cv="c04" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h bz-rp-h--vert" data-r="vt" aria-hidden="true">${vertChars('热力带')}</h2>
            </div>
            <div class="bz-rp-tip" data-r="tip"></div>
          </section>

          <!-- 05 读得最久：头版头条 + 四行活字次榜 -->
          <section class="bz-rp-scn" data-id="c05" data-name="读得最久">
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">读得最久 · Top 5</h2>
              ${headRow(d)}
              <div class="bz-rp-rows">${topRows(d)}</div>
            </div>
          </section>

          <!-- 06 消息源榜：滚筒压过双条 + 王牌章压右上角 -->
          <section class="bz-rp-scn" data-id="c06" data-name="消息源榜">
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">消息源榜 · 谁在供版</h2>
              <div class="bz-rp-rows">${srcRows(d)}</div>
              <div class="bz-rp-note" data-r="snote">橙条 = 阅读分钟 · 细条 = 供版篇数</div>
            </div>
            <b class="bz-rp-ace" data-r="ace" aria-hidden="true">王牌</b>
            <i class="bz-rp-roller" data-r="roller" aria-hidden="true"></i>
          </section>

          <!-- 07 号外：电传纸连发 + 走纸孔 + 今日注记 -->
          <section class="bz-rp-scn" data-id="c07" data-name="号外">
            <canvas class="bz-rp-cv" data-cv="c07" aria-hidden="true"></canvas>
            <div class="bz-rp-in bz-rp-in--wire">
              <h2 class="bz-rp-h">号外 · 最近在读</h2>
              <div class="bz-rp-rows">${recentRows(d)}</div>
              <div class="bz-rp-note" data-r="today">${d.todayMinutes > 0 ? `今晨已读 ${d.todayMinutes} 分钟 · 共 ${d.todaySessions} 段` : '今晨还没开张'}</div>
            </div>
          </section>

          <!-- 08 收录节奏：滚筒横扫柱弹起 + 峰值纸屑 -->
          <section class="bz-rp-scn" data-id="c08" data-name="收录节奏">
            <canvas class="bz-rp-cv" data-cv="c08" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">收录节奏 · 近 14 天</h2>
              <div class="bz-rp-daylab">${dayLabels(d)}</div>
              <div class="bz-rp-note" data-r="note">${lib ? `每天收进来的新剪报 · 单日最多收 ${lib.byDayPeak} 篇` : '报库数据暂缺'}</div>
            </div>
          </section>

          <!-- 09 驻留日历：56 格对角波显影 + 连胜线逐段描画 -->
          <section class="bz-rp-scn" data-id="c09" data-name="驻留日历">
            <canvas class="bz-rp-cv" data-cv="c09" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">驻留日历 · 近 56 天</h2>
            </div>
            <div class="bz-rp-tip" data-r="tip"></div>
          </section>

          <!-- 10 班次×来源：堆叠四段接力 + 悬停行提亮 -->
          <section class="bz-rp-scn" data-id="c10" data-name="班次×来源">
            <canvas class="bz-rp-cv" data-cv="c10" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">班次 × 来源 · 谁在哪一班供版</h2>
              ${shiftLegend()}
            </div>
            <div class="bz-rp-tip" data-r="tip"></div>
          </section>

          <!-- 11 关键词：词云螺旋落位 + 斥力弹性回位 -->
          <section class="bz-rp-scn" data-id="c11" data-name="关键词">
            <canvas class="bz-rp-cv" data-cv="c11" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">关键词 · 你读的标题里什么最多</h2>
            </div>
          </section>

          <!-- 12 报库盘点：墨盘圆环扫出 + 环心百分数 + 三格右列 -->
          <section class="bz-rp-scn" data-id="c12" data-name="报库盘点">
            <canvas class="bz-rp-cv" data-cv="c12" aria-hidden="true"></canvas>
            <div class="bz-rp-in bz-rp-in--c12">
              <h2 class="bz-rp-h">报库盘点 · 建库以来</h2>
              ${lib ? `
              <div class="bz-rp-ringc"><div class="bz-rp-ring-in" data-r="ringc"><b data-r="ringv">${lib.readRate}%</b><span>已读率</span></div></div>
              <div class="bz-rp-side3">
                ${numCell(lib.total, 'int', '在流篇数')}
                ${numCell(lib.readCount, 'int', '已读')}
                ${numCell(lib.unread, 'int', '待读')}
              </div>` : '<p class="bz-rp-dim">报库数据暂缺——news.json 没读到，这一页先欠着。</p>'}
            </div>
          </section>

          <!-- 13 压库专页：三份卷宗掀角入场 + 天数里程表 -->
          <section class="bz-rp-scn" data-id="c13" data-name="压库专页">
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">压库专页 · 压得最久的三份</h2>
              ${d.oldest3.length ? old3Rows(d) : '<p class="bz-rp-dim">没有压库的待读——报库很干净。</p>'}
            </div>
          </section>

          <!-- 14 未读版图：行滑入 + 总待读大数压右上角 -->
          <section class="bz-rp-scn" data-id="c14" data-name="未读版图">
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">未读版图 · 待读都在谁家</h2>
              <div class="bz-rp-rows">
                ${d.unreadTop.map((u) => `
                <div class="bz-rp-row" data-r="row">
                  <span class="bz-rp-row-t bz-rp-row-t--src">${esc(u.name)}</span>
                  <span class="bz-rp-bar"><i data-r="bar" style="width:${Math.max(3, Math.round((u.n / Math.max(1, ...d.unreadTop.map((x) => x.n))) * 100))}%"></i></span>
                  <b class="bz-rp-row-min" data-r="cnt" data-n="${u.n}">${u.n} 篇</b>
                </div>`).join('')}
              </div>
            </div>
            ${lib ? `<b class="bz-rp-ghost" data-r="ghost" aria-hidden="true">${lib.unread}</b>` : ''}
          </section>

          <!-- 15 总账：三数视差滚齐 + 界栏双线 + 扫光 -->
          <section class="bz-rp-scn" data-id="c15" data-name="总账">
            <canvas class="bz-rp-cv" data-cv="c15" aria-hidden="true"></canvas>
            <div class="bz-rp-in">
              <h2 class="bz-rp-h">总账 · 这间报馆一共</h2>
              ${d.totals ? `
              <div class="bz-rp-cells">
                <div class="bz-rp-cell" data-r="tcell"><b class="bz-rp-num" data-r="tnum" data-n="${d.totals.totalRead}">${d.totals.totalRead}</b><span>累计已读</span></div>
                <div class="bz-rp-cell" data-r="tcell"><b class="bz-rp-num" data-r="tnum" data-n="${d.totals.inStream}">${d.totals.inStream}</b><span>在流待读</span></div>
                <div class="bz-rp-cell" data-r="tcell"><b class="bz-rp-num" data-r="tnum" data-n="${d.totals.saved}">${d.totals.saved}</b><span>剪藏入册</span></div>
              </div>
              <div class="bz-rp-busiest" data-r="avgrow"><span>平均每天读报</span><i class="bz-rp-lead" data-r="avglead"></i><b data-r="avgv">${d.totals.perDay}</b><span class="bz-rp-dim">篇 / 天</span></div>` : '<p class="bz-rp-dim">总账缺页——news.stats 没读到。</p>'}
            </div>
          </section>

          <!-- 16 落款：墨滴礼花 + 纸屑 + 尾章 -->
          <section class="bz-rp-scn" data-id="c16" data-name="落款">
            <canvas class="bz-rp-cv" data-cv="c16" aria-hidden="true"></canvas>
            <div class="bz-rp-in bz-rp-in--mid">
              <h1 class="bz-rp-mast bz-rp-mast--end" data-r="end"><span>本</span><span>报</span><span>完</span></h1>
            </div>
            <span class="bz-rp-seal" data-r="seal" aria-hidden="true">完</span>
          </section>

        </div>
      </div>
      <div class="bz-rp-shut" data-r="shut" aria-hidden="true"><i></i><i></i></div>
      <nav class="bz-rp-ticks" data-r="ticks" aria-label="幕目录">${SCN_NAMES.map((n, i) => `<i class="bz-rp-tick" data-i="${i}" title="${esc(n)}"></i>`).join('')}</nav>
    </div>`;
}

/** 小时 → 班次名（标题人话；与 report-stats 工班口径一致） */
function shiftName(h: number): string {
  if (h < 6) return '夜班';
  if (h < 12) return '晨班';
  if (h < 18) return '午班';
  return '晚班';
}

/** 幕名单源（引擎底栏取名用） */
export const PRESS_SCENES = SCN_NAMES;
