/**
 * 影视数据分析 charts（ticket 15：图表组件 + buildAnalysisHTML 21 section）
 */
import { TYPE_COLORS, R6to10 } from './analysis';
import type { AnalysisData } from './analysis';

export const PASTEL_CARDS = ['#E6DFF5', '#D6E4FF', '#CDF0EA', '#FADDE1', '#D8F3DC', '#FFF3C4'];

export function emptyHTML(): string {
  return '<p style="text-align:center;color:var(--text-muted);font-size:.8rem;padding:12px 0;">暂无数据</p>';
}

/** 浅色统计卡 */
export function statCardHTML(label: string, value: string, idx: number): string {
  return `
  <div style="background:${PASTEL_CARDS[idx % PASTEL_CARDS.length]};border-radius:8px;padding:14px;text-align:center;">
    <div style="font-size:1.4rem;font-weight:700;color:#2c3e50;">${value}</div>
    <div style="font-size:.75rem;color:#3D4456;margin-top:4px;">${label}</div>
  </div>`;
}

/** 竖向柱状图 */
export function barChartHTML(entries: { label: string; value: number }[], opt: { color?: string; highlight?: number } = {}): string {
  const color = opt.color || '#D6E4FF';
  const max = Math.max(...entries.map((e) => e.value), 1);
  return `
  <div style="display:flex;align-items:flex-end;gap:8px;height:120px;padding:8px 4px 0;overflow-x:auto;">
    ${entries
      .map((e, i) => {
        const h = Math.max((e.value / max) * 100, 2);
        const bg = opt.highlight === i ? '#FFE5CC' : color;
        return `
      <div style="flex:1;min-width:24px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;">
        <div style="font-size:.65rem;color:var(--text-muted);margin-bottom:2px;">${e.value}</div>
        <div style="width:100%;height:${h}%;background:${bg};border-radius:3px 3px 0 0;"></div>
        <div style="font-size:.6rem;color:var(--text-muted);margin-top:4px;white-space:nowrap;">${e.label}</div>
      </div>`;
      })
      .join('')}
  </div>`;
}

/** SVG 环形图 */
export function donutChartHTML(entries: { label: string; value: number }[], colors: string[], centerLabel?: string): string {
  const total = entries.reduce((s, e) => s + e.value, 0);
  let cumulative = 0;
  const circumference = 2 * Math.PI * 40;
  const segs = entries
    .map((e, i) => {
      const frac = total > 0 ? e.value / total : 0;
      const offset = -cumulative * circumference;
      cumulative += frac;
      return `
    <circle cx="50" cy="50" r="40" fill="none"
      stroke="${colors[i % colors.length]}" stroke-width="11"
      stroke-dasharray="${frac * circumference} ${circumference}" stroke-dashoffset="${offset}">
    </circle>`;
    })
    .join('');

  return `
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <div style="position:relative;width:140px;height:140px;flex-shrink:0;">
      <svg viewBox="0 0 100 100" style="transform:rotate(-90deg);width:100%;height:100%;">${segs}</svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-size:1.1rem;font-weight:700;color:#2c3e50;">${centerLabel ?? total}</div>
      </div>
    </div>
    <div style="flex:1;min-width:120px;">
      ${entries
        .map(
          (e, i) => `
      <div style="display:flex;align-items:center;gap:6px;margin:4px 0;font-size:.75rem;color:var(--text-muted);">
        <span style="width:10px;height:10px;border-radius:2px;background:${colors[i % colors.length]};flex-shrink:0;"></span>
        <span style="flex:1;">${e.label}</span>
        <span style="font-weight:600;color:#3D4456;">${e.value}</span>
      </div>`
        )
        .join('')}
    </div>
  </div>`;
}

/** 横向进度条 */
export function softBarHTML(entries: { label: string; value: number }[], color: string): string {
  const max = Math.max(...entries.map((e) => e.value), 1);
  return `
  <div style="display:flex;flex-direction:column;gap:8px;">
    ${entries
      .map(
        (e) => `
    <div style="display:flex;align-items:center;gap:8px;">
      <span style="width:64px;text-align:right;font-size:.7rem;color:var(--text-muted);flex-shrink:0;">${e.label}</span>
      <div style="flex:1;height:14px;background:var(--background-secondary);border-radius:7px;overflow:hidden;">
        <div style="width:${Math.max((e.value / max) * 100, 2)}%;height:100%;background:${color};border-radius:7px;"></div>
      </div>
      <span style="width:36px;text-align:right;font-size:.7rem;color:#3D4456;font-weight:600;flex-shrink:0;">${e.value}</span>
    </div>`
      )
      .join('')}
  </div>`;
}

/** 板块容器（左侧色条） */
export function sectionHTML(title: string, body: string, accent: string): string {
  return `
  <div style="margin:18px 0;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="width:4px;height:14px;background:${accent};border-radius:2px;"></div>
      <div style="font-size:.9rem;font-weight:600;color:#2c3e50;">${title}</div>
    </div>
    ${body}
  </div>`;
}

/** 排名列表 */
export function topListHTML(list: any[], withRating: boolean): string {
  if (!list.length) return emptyHTML();
  const badgeColors = ['#FFF3C4', '#D8F3DC', '#D6E4FF'];
  return `
  <div style="display:flex;flex-direction:column;gap:6px;">
    ${list
      .map(
        (item, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--background-secondary);border-radius:6px;">
      <span style="width:22px;height:22px;border-radius:50%;background:${badgeColors[i] || '#F1F3F5'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#3D4456;flex-shrink:0;">${i + 1}</span>
      <span style="flex:1;font-size:.8rem;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">《${item.name}》</span>
      <span style="font-size:.65rem;color:var(--text-muted);flex-shrink:0;">${item.typeTag}</span>
      ${withRating ? `<span style="font-size:.8rem;font-weight:700;color:#E67E22;flex-shrink:0;">${item.rating}</span>` : ''}
    </div>`
      )
      .join('')}
  </div>`;
}

/** 双榜（宝藏/失望）：个人分 + 换算 10 分 + 豆瓣 */
export function ratingCompareListHTML(list: any[]): string {
  if (!list.length) return emptyHTML();
  return `
  <div style="display:flex;flex-direction:column;gap:6px;">
    ${list
      .map(
        (item) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--background-secondary);border-radius:6px;">
      <span style="flex:1;font-size:.8rem;color:#2c3e50;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">《${item.name}》</span>
      <span style="font-size:.65rem;color:var(--text-muted);flex-shrink:0;">${item.typeTag}</span>
      <span style="font-size:.8rem;font-weight:700;color:#E67E22;flex-shrink:0;">${item.rating}</span>
      <span style="font-size:.65rem;color:var(--text-muted);flex-shrink:0;">(${(item.rating * R6to10).toFixed(1)})</span>
      <span style="font-size:.7rem;color:#3498DB;flex-shrink:0;">豆瓣${item.douban}</span>
    </div>`
      )
      .join('')}
  </div>`;
}

/** 行内 chips */
export function statInlineHTML(items: string[]): string {
  return `
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
    ${items
      .map((s) => `<span style="background:var(--background-secondary);border-radius:10px;padding:3px 10px;font-size:.7rem;color:#3D4456;">${s}</span>`)
      .join('')}
  </div>`;
}

/** 组合 21 个 section */
export function buildAnalysisHTML(data: AnalysisData): string {
  // 1. 统计卡
  const statCards = [
    statCardHTML('收录总数', String(data.total), 0),
    statCardHTML('已看', String(data.watched), 1),
    statCardHTML('在看', String(data.watching), 2),
    statCardHTML('想看', String(data.want), 3),
    statCardHTML('平均评分', String(data.avgRating), 4),
    statCardHTML('平均豆瓣', String(data.avgDouban), 5),
  ].join('');

  // 2. 类型分布（按组降序）
  const typeEntries = Object.entries(data.groups)
    .map(([g, v]) => ({ label: g, value: v as number }))
    .sort((a, b) => b.value - a.value);
  const typeColors = typeEntries.map((e) => TYPE_COLORS[e.label] || '#95a5a6');
  const typeSection = sectionHTML('🎬 类型分布', donutChartHTML(typeEntries, typeColors), '#D6E4FF');

  // 3. 年度观影趋势
  const yearEntries = Object.entries(data.years)
    .map(([y, v]) => ({ label: String(y), value: v as number }))
    .sort((a, b) => Number(a.label) - Number(b.label));
  const yearSection = sectionHTML('📅 年度观影趋势', barChartHTML(yearEntries, { color: '#D6E4FF' }), '#D6E4FF');

  // 4. 片龄画像
  const ageEntries = (['当年', '1-3年', '4-10年', '≥10年'] as const).map((k) => ({ label: k, value: data.ageBuckets[k] as number }));
  const eraBody = data.eraEntries.length ? barChartHTML(data.eraEntries, { color: '#CDF0EA' }) : emptyHTML();
  const ageSection = sectionHTML(
    '🕰️ 片龄画像',
    statInlineHTML([`平均片龄 ${data.avgAge} 年`, `片龄≥10年 ${data.ageBuckets['≥10年']} 部`]) + softBarHTML(ageEntries, '#E6DFF5') + eraBody,
    '#CDF0EA'
  );

  // 5. 片长画像
  const durEntries = [
    { label: '<90', value: data.durBuckets['<90'] as number },
    { label: '90-120', value: data.durBuckets['90-120'] as number },
    { label: '>120', value: data.durBuckets['>120'] as number },
  ];
  const groupDurStr = data.groupDurEntries.length
    ? data.groupDurEntries.map((g: any) => `${g.label} ${g.value}分`).join(' · ')
    : '';
  const durSection = sectionHTML(
    '⏱️ 片长画像',
    statInlineHTML([`平均片长 ${data.avgDur} 分钟`, groupDurStr].filter(Boolean)) +
      softBarHTML(
        [
          { label: '&lt;90分', value: durEntries[0].value },
          { label: '90-120分', value: durEntries[1].value },
          { label: '&gt;120分', value: durEntries[2].value },
        ],
        '#D8F3DC'
      ),
    '#D8F3DC'
  );

  // 6. 月度观影分布（1-12 月，高亮本月）
  const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}月`, value: (data.months[i + 1] as number) || 0 }));
  const monthSection = sectionHTML('🗓️ 月度观影分布', barChartHTML(monthEntries, { color: '#CDF0EA', highlight: new Date().getMonth() }), '#CDF0EA');

  // 7. 观影节奏
  const weekendCount = (data.weekdays[0] as number) + (data.weekdays[6] as number);
  const weekendPct = data.total ? Math.round((weekendCount / data.total) * 100) : 0;
  const trendChips = data.yearTrend.length
    ? statInlineHTML(data.yearTrend.map((t: any) => `${t.label} ${t.value >= 0 ? '+' : ''}${t.value}%`))
    : '';
  const rhythmSection = sectionHTML(
    '📆 观影节奏',
    statInlineHTML([`月均 ${data.monthFreq} 部`, `周末 ${weekendCount} 部 (${weekendPct}%)`]) + barChartHTML(data.weekdayEntries, { color: '#D6E4FF' }) + trendChips,
    '#D6E4FF'
  );

  // 8. 个人评分分布
  const bucketEntries = (Object.keys(data.buckets) as (keyof typeof data.buckets)[]).map((k) => ({ label: String(k), value: data.buckets[k] as number }));
  const bucketSection = sectionHTML('⭐ 个人评分分布', barChartHTML(bucketEntries, { color: '#FADDE1' }), '#FADDE1');

  // 9. 评分趋势（个人6分制）
  const yearRatingSection = sectionHTML('📈 评分趋势（个人6分制）', barChartHTML(data.yearRatingEntries, { color: '#FFE5CC' }), '#FFE5CC');

  // 10. 打分习惯
  const diffPrefix = (data.avgDiff as string) !== '—' && Number(data.avgDiff) >= 0 ? '+' : '';
  const diffStr = `${diffPrefix}${data.avgDiff}（个人−豆瓣）`;
  const treasureBody = ratingCompareListHTML(data.treasure);
  const disappointBody = ratingCompareListHTML(data.disappoint);
  const habitSection = sectionHTML(
    '⚖️ 打分习惯（换算10分制）',
    statInlineHTML([`平均差值 ${diffStr}`]) + statInlineHTML(['💎 宝藏片（个人≥5 豆瓣<8）']) + treasureBody + statInlineHTML(['🌧️ 失望榜（个人≤2 豆瓣≥8.5）']) + disappointBody,
    '#FFE5CC'
  );

  // 11-14. TOP10
  const topN = (map: Record<string, number>, n: number) =>
    Object.entries(map)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, n)
      .map(([k, v]) => ({ label: k, value: v as number }));
  const genreSection = sectionHTML('🎭 题材偏好 TOP10', softBarHTML(topN(data.genres, 10), '#E6DFF5'), '#E6DFF5');
  const countrySection = sectionHTML('🌍 制片国家/地区 TOP10', softBarHTML(topN(data.countries, 10), '#D6E4FF'), '#D6E4FF');
  const directorSection = sectionHTML('🎥 最爱导演 TOP10', softBarHTML(topN(data.directors, 10), '#D8F3DC'), '#D8F3DC');
  const actorSection = sectionHTML('👥 最爱主演 TOP10', softBarHTML(topN(data.actors, 10), '#FADDE1'), '#FADDE1');

  // 15. 真爱重复
  const repeatSection = sectionHTML(
    '❤️ 真爱重复',
    statInlineHTML([`导演≥3部 ${data.dirRepeat} 人`, `主演≥3部 ${data.actRepeat} 人`]) +
      softBarHTML(
        [
          { label: '导演≥3部', value: data.dirRepeat as number },
          { label: '主演≥3部', value: data.actRepeat as number },
        ],
        '#D8F3DC'
      ),
    '#D8F3DC'
  );

  // 16. 影评关键词
  const keywordBody = data.keywordEntries.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${data.keywordEntries
        .map((k: any) => `<span style="background:#E6DFF5;color:#3D4456;border-radius:10px;padding:3px 10px;font-size:.7rem;">${k.label} ${k.value}</span>`)
        .join('')}</div>`
    : emptyHTML();
  const reviewSection = sectionHTML(
    '💬 影评关键词',
    statInlineHTML([`有影评 ${data.reviewCount} 篇 (${data.reviewRate}%)`, `平均 ${data.reviewAvgChars} 字`]) + keywordBody,
    '#E6DFF5'
  );

  // 17. 高分 TOP10
  const topRatedSection = sectionHTML('🏆 我的高分 TOP10', topListHTML(data.topRated, true), '#FFF3C4');

  // 18. 系列追踪
  const seriesBody = data.seriesList.length
    ? `<div style="display:flex;flex-direction:column;gap:6px;">${data.seriesList
        .map(([k, v]: [string, number]) => `<div style="display:flex;justify-content:space-between;font-size:.8rem;color:#2c3e50;"><span>《${k}》</span><span style="color:var(--text-muted);">${v} 部</span></div>`)
        .join('')}</div>`
    : emptyHTML();
  const seriesSection = sectionHTML('🔗 系列追踪', statInlineHTML([`追了 ${data.seriesList.length} 个系列（≥2部）`]) + seriesBody, '#CDF0EA');

  // 19. 追剧深度
  const seasonBody = data.seasons.length
    ? `<div style="display:flex;flex-direction:column;gap:6px;">${data.seasons
        .map((s: any) => `<div style="display:flex;justify-content:space-between;font-size:.8rem;color:#2c3e50;"><span>《${s.name}》</span><span style="color:var(--text-muted);">${s.seasons} 季</span></div>`)
        .join('')}</div>`
    : emptyHTML();
  const seasonSection = sectionHTML('📺 追剧深度', statInlineHTML([`平均 ${data.avgSeason} 季`]) + seasonBody, '#FADDE1');

  // 20. 想看清单
  const wantTitle = data.wantAvgDouban !== '—' ? `📌 想看清单（${data.wantList.length}） · 均豆瓣 ${data.wantAvgDouban}` : `📌 想看清单（${data.wantList.length}）`;
  const wantTagsBody = Object.keys(data.wantTags).length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${Object.entries(data.wantTags)
        .map(([t, c]) => `<span style="background:var(--background-secondary);border-radius:10px;padding:3px 10px;font-size:.7rem;color:#3D4456;">${t} ${c}</span>`)
        .join('')}</div>`
    : '';
  const wantSection = sectionHTML(wantTitle, topListHTML(data.wantList, false) + wantTagsBody, '#D6E4FF');

  // 21. footer
  const footer = `<p style="text-align:center;font-size:.68rem;color:var(--text-muted);margin-top:16px;">个人评分 6 分制 ⇄ 豆瓣 10 分制，换算 ×${R6to10.toFixed(2)}</p>`;

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;">${statCards}</div>
  ${typeSection}
  ${yearSection}
  ${ageSection}
  ${durSection}
  ${monthSection}
  ${rhythmSection}
  ${bucketSection}
  ${yearRatingSection}
  ${habitSection}
  ${genreSection}
  ${countrySection}
  ${directorSection}
  ${actorSection}
  ${repeatSection}
  ${reviewSection}
  ${topRatedSection}
  ${seriesSection}
  ${seasonSection}
  ${wantSection}
  ${footer}
  `;
}
