/* ============================================================================
   日记本概念稿 · 共享工具（window.CUI）
   ----------------------------------------------------------------------------
   五个概念方向共用的纯函数：媒体 URL 修正、转义、日期文案、分组、标签取色、DOM 构建。
   零设计主张——只把「每个概念都会重复写一遍」的东西收一处。
   ========================================================================== */
(function () {
  'use strict';

  /** 媒体 URL 修正：假层对「清单内」媒体返回 './assets/<名>'（相对壳页），
   *  概念稿在 concepts/ 子目录，需上跳一层；'/__vault-media/*' 是根绝对路径，原样。 */
  function fixMedia(u) {
    if (!u) return '';
    return u.charAt(0) === '.' ? '../' + u.replace(/^\.\//, '') : u;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 08-29 → 8月29日；支持 'YYYY-MM-DD' 或 'MM-DD' */
  function mdLabel(date) {
    const mm = date.slice(-5);
    const [m, d] = mm.split('-');
    return Number(m) + '月' + Number(d) + '日';
  }
  const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function weekday(date) {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    return WEEK[new Date(y, m - 1, d).getDay()];
  }

  /** 相对时间文案（用于「最近」类界面）：今天/昨天/3 天前/N 天前 */
  function relDay(date) {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number);
    const then = new Date(y, m - 1, d);
    const now = new Date();
    const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - then) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return days + ' 天前';
    if (days < 365) return Math.round(days / 30) + ' 个月前';
    return Math.floor(days / 365) + ' 年前';
  }

  /** 按 'YYYY' 分组（保序，输入需已降序） */
  function byYear(entries) {
    const out = [];
    let cur = null;
    for (const e of entries) {
      const y = e.date.slice(0, 4);
      if (!cur || cur.year !== y) { cur = { year: y, entries: [] }; out.push(cur); }
      cur.entries.push(e);
    }
    return out;
  }

  /** 按 'YYYY-MM' 分组（保序） */
  function byMonth(entries) {
    const out = [];
    let cur = null;
    for (const e of entries) {
      const k = e.date.slice(0, 7);
      if (!cur || cur.key !== k) { cur = { key: k, entries: [] }; out.push(cur); }
      cur.entries.push(e);
    }
    return out;
  }

  /** 标签 → 稳定色调（同一标签恒定同色；概念稿用它做「类型着色」） */
  function tagHue(tag) {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360;
    return h;
  }
  function tagColor(tag, alpha) {
    const a = alpha == null ? 1 : alpha;
    return 'hsl(' + tagHue(tag) + ' 52% 52% / ' + a + ')';
  }

  /** 内容类型元信息（四个来源各自的固有属性，概念稿按类型换版式） */
  const KIND = {
    diary: { label: '日记', icon: '✎' },
    movie: { label: '影视', icon: '▤' },
    letter: { label: '信', icon: '✉' },
    book: { label: '书', icon: '❏' },
  };

  /** 媒体统计：一个条目的媒体构成 */
  function mediaStat(e) {
    let img = 0, video = 0, audio = 0;
    for (const m of e.media || []) {
      if (m.kind === 'video') video++;
      else if (m.kind === 'audio') audio++;
      else img++;
    }
    return { img, video, audio, total: img + video + audio };
  }

  /** 首图（用于缩略图/海报；无则 null） */
  function firstImage(e) {
    return (e.media || []).find((m) => m.kind === 'img') || null;
  }

  /** 摘要：正文取纯文本前 n 字（去 markdown 标记粗排） */
  function excerpt(e, n) {
    const t = (e.text || e.content || '')
      .replace(/!\[\[[^\]]*\]\]/g, '')
      .replace(/[#*>`_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  /** DOM 构建小工具：h('div.cls', {attr}, child...) */
  function h(sel, attrs, ...kids) {
    const m = /^([a-z0-9]+)?((?:\.[\w-]+)*)$/i.exec(sel) || [];
    const el = document.createElement(m[1] || 'div');
    if (m[2]) el.className = m[2].slice(1).split('.').join(' ');
    if (attrs && attrs.nodeType == null && typeof attrs === 'object') {
      for (const k in attrs) {
        if (k === 'html') el.innerHTML = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
      }
    } else if (attrs != null) {
      kids.unshift(attrs);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      el.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  }

  /** 挂 <img> 并处理失败 → 占位（概念稿媒体大多来自真实 vault，按需流式供给） */
  function img(src, alt) {
    const i = document.createElement('img');
    i.loading = 'lazy';
    i.decoding = 'async';
    i.alt = alt || '';
    if (src) {
      i.src = src;
      i.addEventListener('error', () => { i.style.display = 'none'; i.parentNode && i.parentNode.classList.add('is-ph'); }, { once: true });
    } else {
      i.style.display = 'none';
      i.parentNode && i.parentNode.classList.add('is-ph');
    }
    return i;
  }

  /** 等待数据模型就绪并交给回调 */
  function ready(fn) {
    const boot = document.getElementById('boot');
    BZ_CONCEPT.boot()
      .then((m) => {
        if (boot) boot.remove();
        fn(m);
      })
      .catch((err) => {
        if (boot) boot.innerHTML = '<span style="color:#c0392b">数据加载失败：' + esc(err && err.message) + '</span>';
        console.error(err);
      });
  }

  window.CUI = {
    fixMedia, esc, mdLabel, weekday, relDay,
    byYear, byMonth, tagHue, tagColor, KIND, mediaStat, firstImage, excerpt,
    h, img, ready,
  };
})();
