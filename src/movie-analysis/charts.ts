/**
 * 影视数据分析 charts（ticket 15 修正版：对齐源码渲染辅助逐字）
 */
import { TYPE_COLORS, R6to10 } from './analysis';
import type { AnalysisData } from './analysis';

export const PASTEL_CARDS = ['#D6E4FF', '#D8F3DC', '#CDF0EA', '#FADDE1', '#FFE5CC', '#E6DFF5'];

export function emptyHTML(): string {
  return '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:12px 0;">暂无数据</p>';
}

/** 浅色统计卡（源码 L285-291 逐字） */
export function statCardHTML(label: string, value: string | number, idx: number): string {
  const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
  return `<div style="flex:1;min-width:100px;padding:14px 8px;background:${bg};border-radius:12px;text-align:center;border:1px solid rgba(0,0,0,0.06);">
        <div style="font-size:1.35rem;font-weight:700;color:#3D4456;line-height:1.2;">${value}</div>
        <div style="font-size:.7rem;color:rgba(61,68,86,0.65);margin-top:3px;">${label}</div>
    </div>`;
}

/** 竖向浅色柱状图（源码 L294-315 逐字） */
export function barChartHTML(entries: { label: string; value: number }[], opt: { color?: string; highlight?: number } = {}): string {
  if (!entries || !entries.length) return emptyHTML();
  const o = opt || {};
  const color = o.color || '#D6E4FF';
  const max = Math.max(...entries.map((e) => e.value), 1);
  const minH = 26;
  const maxH = 92;
  return `
    <div style="overflow-x:auto;margin:8px 0 4px;">
        <div style="display:flex;align-items:flex-end;gap:10px;min-width:${Math.max(entries.length * 46, 230)}px;padding:0 4px;">
        ${entries
          .map((e, i) => {
            const h = max > 0 ? minH + (e.value / max) * (maxH - minH) : minH;
            const hl = o.highlight !== undefined ? o.highlight === i : false;
            const fill = hl ? '#FFE5CC' : color;
            return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
                <div style="width:100%;min-width:30px;height:${h}px;background:${fill};border-radius:6px 6px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:3px;color:#3D4456;font-weight:700;font-size:.75rem;">${e.value || ''}</div>
                <div style="margin-top:6px;font-size:.72rem;color:var(--text-muted);text-align:center;white-space:nowrap;">${e.label}</div>
            </div>`;
          })
          .join('')}
        </div>
    </div>`;
}

/** SVG 环形图（源码 L318-350 逐字） */
export function donutChartHTML(entries: { label: string; value: number }[], colors: string[], centerLabel?: number | string): string {
  if (!entries || !entries.length) return emptyHTML();
  const total = entries.reduce((s, e) => s + e.value, 0);
  if (!total) return emptyHTML();
  const CIRC = 2 * Math.PI * 40;
  let cum = 0;
  const segs = entries
    .map((e, i) => {
      const pct = e.value / total;
      const dash = pct * CIRC;
      const off = -cum * CIRC;
      cum += pct;
      return `<circle cx="50" cy="50" r="40" fill="transparent" stroke="${colors[i % colors.length]}" stroke-width="11" stroke-dasharray="${dash} ${Math.max(CIRC - dash, 0.1)}" stroke-dashoffset="${off}"></circle>`;
    })
    .join('');
  const legend = entries
    .map(
      (e, i) => `
        <div style="display:flex;align-items:center;gap:6px;margin:3px 0;font-size:.76rem;">
            <span style="width:10px;height:10px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;"></span>
            <span style="color:var(--text-normal);white-space:nowrap;">${e.label}</span>
            <span style="color:var(--text-muted);margin-left:auto;">${e.value}</span>
        </div>`
    )
    .join('');
  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;">
        <div style="position:relative;width:132px;height:132px;flex-shrink:0;margin:0 auto;">
            <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg);">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--background-modifier-border)" stroke-width="11"></circle>
                ${segs}
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;">
                <div style="font-size:1.15rem;font-weight:700;color:var(--text-normal);">${centerLabel !== undefined ? centerLabel : total}</div>
            </div>
        </div>
        <div style="flex:1;min-width:140px;">${legend}</div>
    </div>`;
}

/** 浅色进度条（源码 L353-364 逐字） */
export function softBarHTML(entries: { label: string; value: number }[], color: string): string {
  if (!entries || !entries.length) return emptyHTML();
  const max = Math.max(...entries.map((e) => e.value), 1);
  return entries
    .map(
      (e) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
            <span style="width:64px;flex-shrink:0;font-size:.76rem;color:var(--text-muted);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.label}</span>
            <div style="flex:1;height:10px;background:var(--background-modifier-border);border-radius:5px;overflow:hidden;">
                <div style="height:100%;width:${Math.max((e.value / max) * 100, 2)}%;background:${color};border-radius:5px;"></div>
            </div>
            <span style="width:36px;flex-shrink:0;font-size:.76rem;color:var(--text-normal);text-align:right;">${e.value}</span>
        </div>`
    )
    .join('');
}

/** 板块容器（标题带色条，源码 L367-376 逐字） */
export function sectionHTML(title: string, body: string, accent: string): string {
  const bar = accent || '#D6E4FF';
  return `<div style="margin-bottom:20px;padding:14px 14px 12px;background:var(--background-secondary);border-radius:12px;border:1px solid var(--background-modifier-border);">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:.92rem;margin-bottom:12px;">
            <span style="width:4px;height:14px;border-radius:2px;background:${bar};flex-shrink:0;"></span>
            <span>${title}</span>
        </div>
        ${body}
    </div>`;
}

/** 排名列表（TOP1-3 浅色徽章，源码 L379-394 逐字） */
export function topListHTML(list: any[], withRating: boolean): string {
  if (!list || !list.length) return emptyHTML();
  const badges = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];
  return list
    .map((it, i) => {
      const rank =
        i < 3
          ? `<span style="width:20px;height:20px;flex-shrink:0;border-radius:50%;background:${badges[i]};color:#3D4456;font-size:.68rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(0,0,0,0.06);">${i + 1}</span>`
          : `<span style="width:20px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span>`;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--background-modifier-border);">
            ${rank}
            <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
            <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0;">${it.typeTag}</span>
            ${withRating ? `<span style="font-size:.8rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${it.rating}</span>` : ''}
        </div>`;
    })
    .join('');
}

/** 双榜（宝藏/失望，源码 L397-406 逐字） */
export function ratingCompareListHTML(list: any[]): string {
  if (!list || !list.length) return emptyHTML();
  return list
    .map(
      (it) => `
        <div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--background-modifier-border);">
            <span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${it.name}》</span>
            <span style="font-size:.72rem;color:var(--text-muted);flex-shrink:0;">${it.typeTag}</span>
            <span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${it.rating}<span style="font-weight:400;color:var(--text-muted);font-size:.68rem;">(${(it.rating * R6to10).toFixed(1)})</span></span>
            <span style="font-size:.78rem;color:var(--text-muted);flex-shrink:0;">豆瓣${it.douban}</span>
        </div>`
    )
    .join('');
}

/** 行内小统计（源码 L409-412 逐字） */
export function statInlineHTML(items: string[]): string {
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">${items
    .map(
      (s) => `
        <span style="font-size:.74rem;color:var(--text-muted);background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;padding:3px 10px;">${s}</span>`
    )
    .join('')}</div>`;
}

/** 组合 21 个 section（源码 L414-458 逐字） */
export function buildAnalysisHTML(data: AnalysisData): string {
  const yearEntries = Object.keys(data.years)
    .sort((a, b) => Number(a) - Number(b))
    .map((y) => ({ label: y, value: data.years[y] as number }));
  const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: i + 1 + '月', value: (data.months[i + 1] as number) || 0 }));
  const bucketEntries = ['≥5.5', '5~5.5', '4~5', '3~4', '2~3', '<2'].map((b) => ({ label: b, value: (data.buckets as any)[b] as number }));
  const topN = (map: Record<string, number>, n: number) =>
    Object.entries(map)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, n)
      .map(([label, value]) => ({ label, value: value as number }));
  const typeEntries = Object.entries(data.groups)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([label, value]) => ({ label, value: value as number }));
  const typeColors = typeEntries.map((e) => TYPE_COLORS[e.label] || '#95a5a6');

  const avgRating = data.ratingCount ? ((data.ratingSum / data.ratingCount) * R6to10).toFixed(2) : '—';
  const avgDouban = data.doubanCount ? (data.doubanSum / data.doubanCount).toFixed(2) : '—';
  const curMonth = new Date().getMonth(); // 0-11

  const ageEntries = [
    { label: '当年', value: (data.ageBuckets as any)['当年'] as number },
    { label: '1-3年', value: (data.ageBuckets as any)['1-3年'] as number },
    { label: '4-10年', value: (data.ageBuckets as any)['4-10年'] as number },
    { label: '≥10年', value: (data.ageBuckets as any)['≥10年'] as number },
  ];
  const durEntries = [
    { label: '&lt;90分', value: (data.durBuckets as any)['<90'] as number },
    { label: '90-120分', value: (data.durBuckets as any)['90-120'] as number },
    { label: '&gt;120分', value: (data.durBuckets as any)['>120'] as number },
  ];

  return `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        ${statCardHTML('收录总数', data.total, 0)}
        ${statCardHTML('已看', data.watched, 1)}
        ${statCardHTML('在看', data.watching, 2)}
        ${statCardHTML('想看', data.want, 3)}
        ${statCardHTML('平均评分', avgRating, 4)}
        ${statCardHTML('平均豆瓣', avgDouban, 5)}
    </div>
    ${sectionHTML('🎬 类型分布', donutChartHTML(typeEntries, typeColors, data.total), '#FFE5CC')}
    ${sectionHTML('📅 年度观影趋势', barChartHTML(yearEntries, { color: '#D6E4FF' }), '#D6E4FF')}
    ${sectionHTML('🕰️ 片龄画像', statInlineHTML([`平均片龄 ${data.avgAge} 年`, `片龄≥10年 ${(data.ageBuckets as any)['≥10年']} 部`]) + softBarHTML(ageEntries, '#E6DFF5') + '<div style="margin-top:10px;">' + barChartHTML(data.eraEntries, { color: '#CDF0EA' }) + '</div>', '#E6DFF5')}
    ${sectionHTML('⏱️ 片长画像', statInlineHTML([`平均片长 ${data.avgDur} 分钟`, data.groupDurEntries.map((g: any) => `${g.label} ${g.value}分`).join(' · ')]) + softBarHTML(durEntries, '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('🗓️ 月度观影分布', barChartHTML(monthEntries, { color: '#CDF0EA', highlight: curMonth }), '#CDF0EA')}
    ${sectionHTML('📆 观影节奏', statInlineHTML([`月均 ${data.monthFreq} 部`, `周末 ${(data.weekdays[0] as number) + (data.weekdays[6] as number)} 部 (${data.total ? Math.round(((data.weekdays[0] as number) + (data.weekdays[6] as number)) / data.total * 100) : 0}%)`]) + barChartHTML(data.weekdayEntries, { color: '#D6E4FF' }) + (data.yearTrend.length ? '<div style="margin-top:10px;">' + statInlineHTML(data.yearTrend.map((t: any) => `${t.label} ${t.value >= 0 ? '+' : ''}${t.value}%`)) + '</div>' : ''), '#D6E4FF')}
    ${sectionHTML('⭐ 个人评分分布', barChartHTML(bucketEntries, { color: '#FADDE1' }), '#FADDE1')}
    ${sectionHTML('📈 评分趋势（个人6分制）', barChartHTML(data.yearRatingEntries, { color: '#FFE5CC' }), '#FFE5CC')}
    ${sectionHTML('⚖️ 打分习惯（换算10分制）', statInlineHTML([`平均差值 ${Number(data.avgDiff) >= 0 ? '+' : ''}${data.avgDiff}（个人−豆瓣）`]) + '<div style="font-weight:600;font-size:.8rem;margin:6px 0 4px;">💎 宝藏片（个人≥5 豆瓣&lt;8）</div>' + ratingCompareListHTML(data.treasure) + '<div style="font-weight:600;font-size:.8rem;margin:10px 0 4px;">🌧️ 失望榜（个人≤2 豆瓣≥8.5）</div>' + ratingCompareListHTML(data.disappoint), '#FADDE1')}
    ${sectionHTML('🎭 题材偏好 TOP10', softBarHTML(topN(data.genres, 10), '#E6DFF5'), '#E6DFF5')}
    ${sectionHTML('🌍 制片国家/地区 TOP10', softBarHTML(topN(data.countries, 10), '#D6E4FF'), '#D6E4FF')}
    ${sectionHTML('🎥 最爱导演 TOP10', softBarHTML(topN(data.directors, 10), '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('👥 最爱主演 TOP10', softBarHTML(topN(data.actors, 10), '#FADDE1'), '#FADDE1')}
    ${sectionHTML('❤️ 真爱重复', statInlineHTML([`导演≥3部 ${data.dirRepeat} 人`, `主演≥3部 ${data.actRepeat} 人`]) + softBarHTML([{ label: '导演≥3部', value: data.dirRepeat as number }, { label: '主演≥3部', value: data.actRepeat as number }], '#D8F3DC'), '#D8F3DC')}
    ${sectionHTML('💬 影评关键词', statInlineHTML([`有影评 ${data.reviewCount} 篇 (${data.reviewRate}%)`, `平均 ${data.reviewAvgChars} 字`]) + (data.keywordEntries.length ? data.keywordEntries.map((k: any) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:#E6DFF5;color:#3D4456;margin:2px;">${k.label} ${k.value}</span>`).join('') : emptyHTML()), '#E6DFF5')}
    ${sectionHTML('🏆 我的高分 TOP10', topListHTML(data.topRated, true), '#FFE5CC')}
    ${sectionHTML('🔗 系列追踪', statInlineHTML([`追了 ${data.seriesList.length} 个系列（≥2部）`]) + (data.seriesList.length ? data.seriesList.map(([k, v]: [string, number], i: number) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border);"><span style="width:18px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span><span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${k}》</span><span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${v} 部</span></div>`).join('') : emptyHTML()), '#D6E4FF')}
    ${sectionHTML('📺 追剧深度', statInlineHTML([`平均 ${data.avgSeason} 季`]) + (data.seasons.length ? data.seasons.map((s: any, i: number) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--background-modifier-border);"><span style="width:18px;flex-shrink:0;font-size:.72rem;color:var(--text-muted);text-align:center;">${i + 1}</span><span style="flex:1;font-size:.83rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">《${s.name}》</span><span style="font-size:.78rem;font-weight:600;color:var(--text-accent);flex-shrink:0;">${s.seasons} 季</span></div>`).join('') : emptyHTML()), '#CDF0EA')}
    ${sectionHTML('📌 想看清单（' + data.wantList.length + '）' + (data.wantAvgDouban !== '—' ? ' · 均豆瓣 ' + data.wantAvgDouban : ''), topListHTML(data.wantList, false) + (Object.keys(data.wantTags).length ? '<div style="margin-top:8px;">' + Object.entries(data.wantTags).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([t, c]) => `<span style="display:inline-block;padding:2px 10px;border-radius:10px;font-size:.72rem;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);margin:2px;">${t} ${c}</span>`).join('') + '</div>' : ''), '#FFF3C4')}
    <p style="text-align:center;font-size:.68rem;color:var(--text-muted);margin-top:16px;">个人评分 6 分制 ⇄ 豆瓣 10 分制，换算 ×${R6to10.toFixed(2)}</p>
    `;
}
