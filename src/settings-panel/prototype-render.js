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
    deskShellHtml: () => deskShellHtml,
    esc: () => esc,
    groupCardHtml: () => groupCardHtml,
    iconSpan: () => iconSpan,
    loadingHtml: () => loadingHtml,
    miniHtml: () => miniHtml,
    navItemHtml: () => navItemHtml,
    navSecHtml: () => navSecHtml,
    pageHeadHtml: () => pageHeadHtml,
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
  function rowBtnHtml(label, cta) {
    return `<button type="button" class="bz-sp-btn${cta ? " bz-sp-btn--primary" : ""}">${esc(label)}</button>`;
  }
  function badgeHtml(label) {
    return `<span class="bz-badge">${esc(label)}</span>`;
  }
  function miniHtml(kind, prev) {
    const st = (extra) => ` style="${extra}"`;
    const bg = st(`background:${prev.bg}`);
    if (kind === "todo") {
      const headCls = "m-head" + (prev.head === "stripe" ? " m-stripe" : "");
      const headBg = prev.head === "stripe" ? prev.bg : prev.ink;
      const headBorder = prev.head === "stripe" ? `border-bottom:2px solid ${prev.ink};` : "";
      const lines = [[18, 16], [28, 24], [24, 32]].map(([w, top], i) => `<div class="m-line"${st(`top:${top}px;width:${w}px;background:${prev.ink};opacity:${i === 2 ? 0.35 : 0.55}`)}></div>`).join("");
      return `<div class="bz-sp-mini"${bg}><div class="${headCls}"${st(`background:${headBg};${headBorder}`)}></div>${lines}<div class="m-chip"${st(`background:${prev.ac}`)}></div></div>`;
    }
    if (kind === "shelf") {
      const books = (prev.books || []).map((c, i) => `<div class="m-book"${st(`left:${10 + i * 14}px;height:${[24, 32, 20][i]}px;background:${c};border-top:2px solid ${prev.ac}`)}></div>`).join("");
      return `<div class="bz-sp-mini"${bg}><div class="m-ac"${st(`background:${prev.ac}`)}></div>${books}</div>`;
    }
    if (kind === "layout") {
      const mk = (css) => `<div${st(`position:absolute;border-radius:2px;background:rgba(90,70,40,.22);${css}`)}></div>`;
      let blocks = "";
      if (prev.mode === "system") blocks = mk("left:4px;top:14px;width:14px;bottom:4px;") + mk("left:21px;top:14px;right:4px;height:26px;");
      else if (prev.mode === "compact") blocks = mk("left:4px;top:14px;width:14px;bottom:4px;") + mk("left:21px;top:14px;width:26px;height:12px;") + mk("left:21px;top:28px;width:26px;height:12px;") + mk("left:50px;top:14px;width:10px;bottom:10px;");
      else if (prev.mode === "iconrail") blocks = mk("left:2px;top:2px;bottom:2px;width:8px;") + mk("left:14px;top:4px;width:16px;bottom:4px;") + mk("left:34px;top:4px;right:4px;bottom:4px;");
      else if (prev.mode === "outline") blocks = mk("left:4px;top:14px;right:24px;bottom:4px;") + mk("right:4px;top:14px;width:16px;height:20px;");
      return `<div class="bz-sp-mini"${bg}><div class="m-head"${st("background:rgba(90,70,40,.28)")}></div>${blocks}</div>`;
    }
    if (kind === "skin") {
      return `<div class="bz-sp-mini"${bg}><div${st(`position:absolute;inset:0 50% 0 0;background:${prev.light || "#f6f2e9"}`)}></div><div${st(`position:absolute;inset:0 0 0 50%;background:${prev.dark || "#242429"}`)}></div><div${st(`position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:${prev.ac || "var(--sp-accent)"};border:2px solid #fff;`)}></div></div>`;
    }
    if (kind === "themecard") {
      return `<div class="bz-sp-mini"${bg}><div${st(`position:absolute;left:5px;top:50%;transform:translateY(-50%);width:5px;height:26px;border-radius:3px;background:${prev.ac};`)}></div></div>`;
    }
    if (kind === "poster") {
      const mk = (css) => `<div${st(`position:absolute;${css}`)}></div>`;
      return `<div class="bz-sp-mini"${bg}>` + mk(`left:6%;top:12%;width:44%;height:20%;background:${prev.ink || "#171512"};`) + mk(`left:86%;top:14%;width:8%;height:16%;background:${prev.ac || "#e8481f"};`) + mk(`left:6%;top:44%;width:88%;height:46%;background:rgba(23,21,18,.1);`) + mk(`left:38%;top:44%;width:2px;height:46%;background:rgba(23,21,18,.28);`) + mk(`left:66%;top:44%;width:2px;height:46%;background:rgba(23,21,18,.28);`) + `</div>`;
    }
    if (kind === "cat") {
      const ears = ["ear l", "ear r"].map(() => `<div class="ear"${st(`background:transparent;border-bottom-color:${prev.fur}`)}></div>`).join("");
      const eyes = ["eye l", "eye r"].map(() => `<div class="eye"${st("background:rgba(20,15,8,.75)")}></div>`).join("");
      return `<div class="bz-sp-mini"${bg}><div class="m-cat">${ears}<div class="face"${st(`background:${prev.fur}`)}></div>` + (prev.patch ? `<div class="patch"${st(`background:${prev.patch}`)}></div>` : "") + eyes + `</div></div>`;
    }
    return `<div class="bz-sp-mini"${bg}></div>`;
  }
  function cardpickHtml(cards) {
    return `<div class="bz-sp-cardpick" role="radiogroup">` + cards.map((c) => {
      const mini = c.kind ? miniHtml(c.kind, c.prev || {}) : `<div class="bz-sp-mini${c.prevClass ? ` ${c.prevClass}` : ""}" aria-hidden="true"></div>`;
      return `<button type="button" class="bz-sp-cardpick-card${c.on ? " is-on" : ""}" data-sp-card="${esc(c.value)}">` + mini + `<span class="bz-sp-cardpick-name">${esc(c.label)}</span></button>`;
    }).join("") + `</div>`;
  }
  function rowHtml(vm) {
    var _a, _b;
    const cls = ["bz-sp-set-row"];
    if (vm.cls) cls.push(vm.cls);
    if (vm.isCards) cls.push("bz-sp-set-row--cards");
    if (vm.isCustom) cls.push("bz-sp-set-row--custom");
    const open = `<div class="${cls.join(" ")}"${vm.key ? ` data-key="${esc(vm.key)}"` : ""}>`;
    const name = vm.name ? `<div class="bz-sp-set-name">${esc(vm.name)}</div>` : "";
    const desc = vm.desc ? `<div class="bz-sp-set-desc">${esc(vm.desc)}</div>` : "";
    if (vm.isCustom) {
      return `${open}<div class="bz-sp-set-info">${name}${desc}</div>${(_a = vm.ctrlHtml) != null ? _a : ""}</div>`;
    }
    const note = vm.note ? `<div class="bz-sp-set-note">↳ ${esc(vm.note)}</div>` : "";
    const info = `<div class="bz-sp-set-info">${name}${desc}${note}</div>`;
    const ctrlCls = vm.isCards ? "bz-sp-set-cards" : "bz-sp-set-ctrl";
    return `${open}${info}<div class="${ctrlCls}">${(_b = vm.ctrlHtml) != null ? _b : ""}</div></div>`;
  }
  function groupCardHtml(icon, name, count) {
    const ic = icon ? iconSpan(icon, "bz-sp-group-icon") : "";
    return `<section class="bz-sp-group"><div class="bz-sp-group-head">${ic}<span class="bz-sp-group-name">${esc(name)}</span><span class="bz-sp-group-count">${esc(count)}</span></div><div class="bz-sp-group-body"></div></section>`;
  }
  function pageHeadHtml(name, desc, tag) {
    return `<div class="bz-sp-page-head"><div><div class="bz-sp-page-title">${esc(name)}</div><div class="bz-sp-page-desc">${esc(desc)}</div></div><span class="bz-sp-page-tag">${esc(tag)}</span></div>`;
  }
  function loadingHtml(text = "加载设置…") {
    return `<div class="bz-sp-loading"><span class="bz-spinner"></span><span>${esc(text)}</span></div>`;
  }

  // src/settings-panel/layouts/jingwei/render.ts
  function deskShellHtml() {
    return `<div class="bz-sp-head"><div class="bz-sp-crumb"><span class="bz-sp-head-title bz-sp-crumb-cur">设置</span></div><div class="bz-sp-search bz-sp-head-search">${iconSpan("search")}<input class="bz-input" placeholder="搜索域与设置项" autocomplete="off"></div><span class="bz-sp-head-tools"></span></div><div class="bz-sp-desk-body"><aside class="bz-sp-desk-side"><div class="bz-sp-nav"></div></aside><main class="bz-sp-desk-main"><div class="bz-sp-pane"></div></main></div>`;
  }
  function navSecHtml(title, itemsHtml) {
    return `<div class="bz-sp-nav-sec"><div class="bz-sp-nav-sec-t">${esc(title)}</div>${itemsHtml}</div>`;
  }
  function navItemHtml(opts) {
    return `<button type="button" class="bz-sp-nav-item${opts.on ? " on" : ""}" data-sp-domain="${esc(opts.id)}">${iconSpan(opts.icon, "bz-ic bz-sp-nav-ic")}<span class="bz-sp-nav-name">${esc(opts.name)}</span><span class="bz-sp-nav-count">${esc(opts.count)}</span></button>`;
  }
  return __toCommonJS(render_exports);
})();
