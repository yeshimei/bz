/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/settings-panel/render.ts → window.BZR_settings_panel（评审壳预览包，ADR-0104） */
var BZR_settings_panel = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/settings-panel/render.ts
  var render_exports = {};
  __export(render_exports, {
    badgeHtml: () => badgeHtml,
    cardpickHtml: () => cardpickHtml,
    deskHeadHtml: () => deskHeadHtml,
    deskShellHtml: () => deskShellHtml,
    esc: () => esc,
    groupCardHtml: () => groupCardHtml,
    headToolsHtml: () => headToolsHtml,
    iconSpan: () => iconSpan,
    loadingHtml: () => loadingHtml,
    mobEmptyHtml: () => mobEmptyHtml,
    mobHeadHtml: () => mobHeadHtml,
    mobItemHtml: () => mobItemHtml,
    mobModalShellHtml: () => mobModalShellHtml,
    mobRowHitHtml: () => mobRowHitHtml,
    mobSecHtml: () => mobSecHtml,
    mobShellHtml: () => mobShellHtml,
    navItemHtml: () => navItemHtml,
    navSecHtml: () => navSecHtml,
    pageHeadHtml: () => pageHeadHtml,
    pathAddBtnHtml: () => pathAddBtnHtml,
    pathChipsHtml: () => pathChipsHtml,
    pathChipsItemsHtml: () => pathChipsItemsHtml,
    rowBtnHtml: () => rowBtnHtml,
    rowHtml: () => rowHtml,
    selectItemHtml: () => selectItemHtml,
    selectTriggerHtml: () => selectTriggerHtml,
    sliderHtml: () => sliderHtml,
    textInputHtml: () => textInputHtml,
    textareaHtml: () => textareaHtml,
    toggleHtml: () => toggleHtml
  });

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/settings-panel/shared.ts
  function toggleHtml(on) {
    return `<button type="button" class="bz-sw${on ? " on" : ""}" role="switch" aria-checked="${String(on)}"></button>`;
  }
  function selectTriggerHtml(label) {
    return `<div class="bz-select"><span class="bz-select-val">${esc(label)}</span>${iconSpan("chevron-right", "bz-select-car")}</div>`;
  }
  function selectItemHtml(label, on) {
    return `<button type="button" class="bz-select-item${on ? " is-on" : ""}"><span>${esc(label)}</span><span class="bz-ic bz-select-item-ck">${iconSpan("check")}</span></button>`;
  }
  function textInputHtml(opts) {
    const cls = ["bz-input"];
    if (opts.mono) cls.push("mono");
    if (opts.num) cls.push("num");
    if (opts.secret) cls.push("secret");
    const attrs = [`class="${cls.join(" ")}"`, `value="${esc(opts.value)}"`];
    attrs.push(opts.type === "number" ? 'type="number"' : 'type="text"');
    if (opts.placeholder) attrs.push(`placeholder="${esc(opts.placeholder)}"`);
    if (opts.min !== void 0) attrs.push(`min="${opts.min}"`);
    if (opts.max !== void 0) attrs.push(`max="${opts.max}"`);
    if (opts.step !== void 0) attrs.push(`step="${opts.step}"`);
    return `<input ${attrs.join(" ")} autocomplete="off">`;
  }
  function textareaHtml(value, placeholder) {
    return `<textarea class="bz-input bz-sp-textarea" autocomplete="off"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}>${esc(value)}</textarea>`;
  }
  function sliderHtml(min, max, step, value) {
    return `<div class="bz-sp-slider-row"><input type="range"${min !== void 0 ? ` min="${min}"` : ""}${max !== void 0 ? ` max="${max}"` : ""} step="${step != null ? step : 1}" value="${value}"><span class="bz-sp-slider-val">${value}</span></div>`;
  }
  function pathChipsItemsHtml(chips) {
    return chips.map((c) => {
      const cls = c.muted ? "bz-sp-chip bz-sp-chip--muted" : c.locked ? "bz-sp-chip bz-sp-chip--locked" : "bz-sp-chip";
      return `<span class="${cls}" data-sp-path="${esc(c.path)}"${c.label ? ` title="${esc(c.label)}"` : ""}>${esc(c.label)}` + (c.multi && !c.muted && !c.locked ? '<i class="x">✕</i>' : "") + `</span>`;
    }).join("");
  }
  function pathChipsHtml(chips) {
    return `<div class="bz-sp-chips">${pathChipsItemsHtml(chips)}</div>`;
  }
  function pathAddBtnHtml(text) {
    return `<button type="button" class="bz-sp-btn bz-sp-path-btn">${esc(text)}</button>`;
  }
  function rowBtnHtml(label, cta) {
    return `<button type="button" class="bz-sp-btn${cta ? " bz-sp-btn--primary" : ""}">${esc(label)}</button>`;
  }
  function badgeHtml(label) {
    return `<span class="bz-badge">${esc(label)}</span>`;
  }
  function cardpickHtml(cards) {
    return `<div class="bz-sp-cardpick" role="radiogroup">` + cards.map(
      (c) => `<button type="button" class="bz-sp-cardpick-card${c.on ? " is-on" : ""}" data-sp-card="${esc(c.value)}"><div class="bz-sp-mini${c.prevClass ? ` ${c.prevClass}` : ""}" aria-hidden="true"></div><span class="bz-sp-cardpick-name">${esc(c.label)}</span></button>`
    ).join("") + `</div>`;
  }
  function rowHtml(vm) {
    var _a, _b;
    const cls = ["bz-sp-set-row"];
    if (vm.cls) cls.push(vm.cls);
    if (vm.isCards) cls.push("bz-sp-set-row--cards");
    if (vm.isCustom) cls.push("bz-sp-set-row--custom");
    if (vm.isCustom) {
      return `<div class="${cls.join(" ")}"><div class="bz-sp-custom-slot bz-sp-custom-slot--full">${(_a = vm.ctrlHtml) != null ? _a : ""}</div></div>`;
    }
    const name = vm.name ? `<div class="bz-sp-set-name">${esc(vm.name)}</div>` : "";
    const desc = vm.desc ? `<div class="bz-sp-set-desc">${esc(vm.desc)}</div>` : "";
    const note = vm.note ? `<div class="bz-sp-set-note">↳ ${esc(vm.note)}</div>` : "";
    const info = `<div class="bz-sp-set-info">${name}${desc}${note}</div>`;
    const ctrlCls = vm.isCards ? "bz-sp-set-cards" : "bz-sp-set-ctrl";
    return `<div class="${cls.join(" ")}">${info}<div class="${ctrlCls}">${(_b = vm.ctrlHtml) != null ? _b : ""}</div></div>`;
  }
  function groupCardHtml(icon, name, count) {
    const ic = icon ? iconSpan(icon, "bz-sp-group-icon") : "";
    return `<div class="bz-sp-group"><div class="bz-sp-group-head">${ic}<span class="bz-sp-group-name">${esc(name)}</span><span class="bz-sp-group-count">${esc(count)}</span></div><div class="bz-sp-group-body"></div></div>`;
  }
  function pageHeadHtml(name, desc, tag) {
    return `<div class="bz-sp-page-head"><div><div class="bz-sp-page-title">${esc(name)}</div><div class="bz-sp-page-desc">${esc(desc)}</div></div><span class="bz-sp-page-tag">${esc(tag)}</span></div>`;
  }
  function loadingHtml(text = "加载设置…") {
    return `<div class="bz-sp-loading"><span class="bz-spinner"></span><span>${esc(text)}</span></div>`;
  }
  function headToolsHtml() {
    return `<span class="bz-sp-head-tools"></span>`;
  }

  // src/settings-panel/layouts/jingwei/render.ts
  function deskHeadHtml() {
    return `<div class="bz-sp-head"><div class="bz-sp-crumb"><span class="bz-sp-head-title bz-sp-crumb-cur">设置</span></div><div class="bz-sp-search bz-sp-head-search">${iconSpan("search")}<input class="bz-input" placeholder="搜索域与设置项" autocomplete="off"></div><span class="bz-sp-head-tools"></span></div>`;
  }
  function deskShellHtml() {
    return `${deskHeadHtml()}<div class="bz-sp-desk-body"><div class="bz-sp-desk-side"><div class="bz-sp-nav"></div></div><div class="bz-sp-desk-main"><div class="bz-sp-pane"></div></div></div>`;
  }
  function navSecHtml(title, itemsHtml) {
    return `<div class="bz-sp-nav-sec"><div class="bz-sp-nav-sec-t">${esc(title)}</div>${itemsHtml}</div>`;
  }
  function navItemHtml(opts) {
    return `<button type="button" class="bz-sp-nav-item${opts.on ? " on" : ""}" data-sp-domain="${esc(opts.id)}"><i data-lucide="${esc(opts.icon)}" class="bz-ic bz-sp-nav-ic"></i><span class="bz-sp-nav-name">${esc(opts.name)}</span><span class="bz-sp-nav-count">${esc(opts.count)}</span></button>`;
  }
  function mobHeadHtml() {
    return `<div class="bz-sp-head"><span class="bz-sp-head-title">设置</span><span class="bz-sp-head-tools"></span></div>`;
  }
  function mobShellHtml() {
    return `${mobHeadHtml()}<div class="bz-sp-mob-search"><span class="bz-input-wrap">${iconSpan("search")}<input class="bz-input" placeholder="搜索设置、域…" autocomplete="off"></span></div><div class="bz-sp-mob-list"></div>`;
  }
  function mobItemHtml(opts) {
    return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}"><span class="bz-sp-mob-ic"><i data-lucide="${esc(opts.icon)}" class="bz-ic"></i></span><span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span><span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span><span class="bz-sp-mob-chev">${iconSpan("chevron-right")}</span></button>`;
  }
  function mobRowHitHtml(opts) {
    return `<button type="button" class="bz-sp-mob-item" data-sp-domain="${esc(opts.id)}"><span class="bz-sp-mob-ic"><i data-lucide="${esc(opts.icon)}" class="bz-ic"></i></span><span class="bz-sp-mob-t"><span class="bz-sp-mob-name">${esc(opts.name)}</span><span class="bz-sp-mob-desc">${esc(opts.desc)}</span></span><span class="bz-sp-mob-kind">设置</span></button>`;
  }
  function mobSecHtml(title) {
    return `<div class="bz-sp-mob-sec">${esc(title)}</div>`;
  }
  function mobEmptyHtml(query) {
    return `<div class="bz-sp-mob-empty">没有匹配「${esc(query)}」的设置或域</div>`;
  }
  function mobModalShellHtml(icon, title) {
    return `<div class="bz-sp-mob-modal-head"><span class="bz-sp-mob-modal-ic"><i data-lucide="${esc(icon)}" class="bz-ic"></i></span><h3 class="bz-sp-mob-modal-title">${esc(title)}</h3></div><div class="bz-sp-settings-body bz-sp-mob-modal-body"></div>`;
  }
  return __toCommonJS(render_exports);
})();
