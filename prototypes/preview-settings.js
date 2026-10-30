/* ============================================================
 * 评审壳 · 预览设置浮窗（prototypes/preview-settings.js）
 *
 * 一次写好、所有原型壳共用（壳里只需引入本文件 + preview-settings.css）：
 *   <link rel="stylesheet" href="../preview-settings.css">
 *   <script src="../preview-settings.js"></script>
 *
 * 面板默认展开，点外面收。四组开关：
 *   外观   → 明 / 暗 / 跟随（写回壳页与每个 iframe 的 body 类；host-theme.css 定 token）
 *   文件夹 → 未配置 / 已配置（iframe 重载并带 dirs=1；对照「未配置引导态」与「正常态」）
 *   移动端 → 显示 / 隐藏（壳里没有移动外景时这一行自动不出现）
 *   重置演示数据
 *
 * 兼容：各壳遗留的 .vbadge 与 #mobToggle/#reset/#themeGrp 一律由 CSS 藏起、由本脚本
 * 补一枚隐形占位（旧壳的绑定代码照旧跑，不报错）——壳文件不必逐个改逻辑，只加两行引入。
 * ============================================================ */
(function () {
  'use strict';

  var LS = 'bz-sim:';
  var state = {
    // 默认跟随壳自己的初始外观（有的壳本来就是深色），没有主张时才用亮色
    theme: (document.body && document.body.classList.contains('theme-dark')) ? 'dark' : 'light',
    // 文件夹三态：unset 未配置 / empty 配好但没内容 / full 配好且有内容
    data: 'unset',
    mob: true,
  };

  /** 旧壳里被藏掉的控件：补隐形占位，免得它们 `addEventListener` 打到 null 抛错 */
  function stubLegacyControls() {
    [['mobToggle', 'button'], ['reset', 'button'], ['themeGrp', 'span'], ['stResult', 'span']].forEach(function (p) {
      if (document.getElementById(p[0])) return;
      var el = document.createElement(p[1]);
      el.id = p[0];
      el.hidden = true;
      document.body.appendChild(el);
    });
  }

  function frames() {
    return Array.prototype.slice.call(document.querySelectorAll('iframe.demo-frame'));
  }
  function isMobFrame(f) {
    var src = f.getAttribute('src') || '';
    return /[?&]mob=1/.test(src) || !!f.closest('.demo-mob-wrap, #mobHost');
  }
  function mobHosts() {
    return Array.prototype.slice.call(document.querySelectorAll('.demo-mob-wrap, #mobHost'));
  }

  /** 帧地址：保留它自己的 query（?mob=1 / ?iface=panel），只改写「文件夹三态」那两个参数 */
  function withMode(f) {
    var src = f.getAttribute('src') || '';
    if (!src) return null;
    var u = new URL(src, location.href);
    if (state.data === 'unset') {
      // 明确传 0（不是删参数）：各域假层默认注入的是「已配置」，删参数只会回到那个缺省
      u.searchParams.set('dirs', '0');
      u.searchParams.delete('state');
    } else {
      u.searchParams.set('dirs', '1');
      if (state.data === 'empty') u.searchParams.set('state', 'empty');
      else u.searchParams.delete('state');
    }
    return u.toString();
  }

  function applyTheme() {
    var dark = state.theme === 'dark'
      || (state.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('theme-dark', dark);
    document.body.classList.toggle('theme-light', !dark);
    frames().forEach(function (f) {
      try {
        var d = f.contentDocument;
        if (!d || !d.body) return;
        d.body.classList.toggle('theme-dark', dark);
        d.body.classList.toggle('theme-light', !dark);
      } catch (e) { /* 跨文档未就绪：load 时再补 */ }
    });
    segOn('theme', state.theme);
  }

  function applyMode(reload) {
    if (reload) {
      frames().forEach(function (f) {
        var next = withMode(f);
        if (next) f.src = next;
      });
    }
    segOn('dirs', state.data);
  }

  function applyMob() {
    var hosts = mobHosts();
    var row = document.querySelector('#pvMobRow');
    if (row) row.hidden = hosts.length === 0;
    hosts.forEach(function (h) { h.style.display = state.mob ? '' : 'none'; });
    segOn('mob', state.mob ? '1' : '0');
  }

  function segOn(name, v) {
    var box = document.querySelector('#seg-' + name);
    if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.v === String(v));
    });
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'pv';
    wrap.id = 'pv';
    wrap.innerHTML =
      '<button class="pv-btn" id="pvToggle" aria-haspopup="true" aria-expanded="false">预览设置</button>' +
      '<div class="pv-pop" id="pvPop" hidden role="menu">' +
        '<div class="pv-row"><span class="pv-k">外观</span>' +
          '<span class="seg" id="seg-theme"><button data-v="light">明</button><button data-v="dark">暗</button><button data-v="auto">跟随</button></span></div>' +
        '<div class="pv-row"><span class="pv-k">文件夹</span>' +
          '<span class="seg" id="seg-dirs"><button data-v="unset">未配置</button><button data-v="empty">空册</button><button data-v="full">有内容</button></span></div>' +
        '<div class="pv-row" id="pvMobRow"><span class="pv-k">移动端</span>' +
          '<span class="seg" id="seg-mob"><button data-v="1">显示</button><button data-v="0">隐藏</button></span></div>' +
        '<div class="pv-sep"></div>' +
        '<button class="pv-act" id="pvReset">重置演示数据</button>' +
      '</div>';
    document.body.appendChild(wrap);

    var pop = document.getElementById('pvPop');
    var btn = document.getElementById('pvToggle');
    var openPop = function (open) {
      pop.hidden = !open;
      btn.classList.toggle('is-on', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', function (e) { e.stopPropagation(); openPop(pop.hidden); });
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) openPop(false);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openPop(false); });

    Array.prototype.forEach.call(document.querySelectorAll('#seg-theme button'), function (b) {
      b.addEventListener('click', function () { state.theme = b.dataset.v; applyTheme(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#seg-dirs button'), function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.v;
        if (v === state.data) return;
        state.data = v;
        applyMode(true);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#seg-mob button'), function (b) {
      b.addEventListener('click', function () { state.mob = b.dataset.v === '1'; applyMob(); });
    });
    document.getElementById('pvReset').addEventListener('click', function () {
      var kill = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(LS) === 0 && k !== LS + '__theme') kill.push(k); // 主题偏好不算演示数据
      }
      kill.forEach(function (k) { localStorage.removeItem(k); });
      location.reload();
    });

    frames().forEach(function (f) { f.addEventListener('load', applyTheme); });
    applyTheme();
    applyMode(true); // 首帧就按「未配置」加载：默认看到的是引导态（各域假层默认是已配置）
    applyMob();
    openPop(true); // 默认就是打开的：进页面不需要先点一下才看得见开关
  }

  function boot() {
    if (document.getElementById('pv')) return;
    stubLegacyControls();
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
