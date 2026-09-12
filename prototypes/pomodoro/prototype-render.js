/* 源指纹 c0d932611df3cf2a · 仓内输入 1 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["src/pomodoro/render.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/pomodoro/render.ts → window.BZR_pomodoro（评审壳预览包，ADR-0104） */
var BZR_pomodoro = (() => {
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

  // src/pomodoro/render.ts
  var render_exports = {};
  __export(render_exports, {
    DEFAULT_POMODORO_SKIN_THEME: () => DEFAULT_POMODORO_SKIN_THEME,
    POMODORO_SKIN_THEMES: () => POMODORO_SKIN_THEMES,
    normalizeSkinTheme: () => normalizeSkinTheme,
    panelShellHtml: () => panelShellHtml,
    popupShellHtml: () => popupShellHtml,
    skinClassOf: () => skinClassOf
  });
  var POMODORO_SKIN_THEMES = [
    { value: "tomato", label: "番茄" },
    { value: "ink", label: "墨白" },
    { value: "grid", label: "方格纸" },
    { value: "moss", label: "苔原" },
    { value: "mist", label: "海雾" },
    { value: "sand", label: "暖沙" },
    { value: "citrus", label: "蜜柑" },
    { value: "sakura", label: "樱粉" },
    { value: "latte", label: "咖啡" },
    { value: "night", label: "夜航" }
  ];
  var DEFAULT_POMODORO_SKIN_THEME = "tomato";
  function normalizeSkinTheme(v) {
    const cur = String(v != null ? v : "");
    return POMODORO_SKIN_THEMES.some((t) => t.value === cur) ? cur : DEFAULT_POMODORO_SKIN_THEME;
  }
  function skinClassOf(v) {
    return `pomodoro-skin-${normalizeSkinTheme(v)}`;
  }
  function panelShellHtml() {
    return `
      <svg id="pomodoro-ring-svg" viewBox="0 0 120 120">
        <circle class="pomodoro-ring-track" cx="60" cy="60" r="52"></circle>
        <circle id="pomodoro-ring-progress" class="pomodoro-ring-progress" cx="60" cy="60" r="52"></circle>
      </svg>
      <div id="pomodoro-cycle" class="pomodoro-cycle"></div>
      <div id="pomodoro-phase"></div>
      <div id="pomodoro-task" class="pomodoro-task"></div>
      <div id="pomodoro-time"></div>
      <div class="pomodoro-controls">
        <button id="pomodoro-btn-start" class="pomodoro-btn pomodoro-btn-primary bz-touch-target--sm">开始</button>
        <button id="pomodoro-btn-reset" class="pomodoro-btn bz-touch-target--sm">重置</button>
        <button id="pomodoro-btn-skip" class="pomodoro-btn bz-touch-target--sm">跳过</button>
      </div>
      <div class="pomodoro-stats">
        <div id="pomodoro-today"></div>
        <div id="pomodoro-week" class="pomodoro-week"></div>
      </div>`;
  }
  function popupShellHtml() {
    return `<div id="pomodoro-popup" tabindex="-1">${panelShellHtml()}</div>`;
  }
  return __toCommonJS(render_exports);
})();
