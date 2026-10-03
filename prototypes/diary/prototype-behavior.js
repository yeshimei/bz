/* 源指纹 5e6c37265c5c1a16 · 仓内输入 79 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/diary/fake-sim.ts","prototypes/diary/fake/fake-obsidian.ts","src/bookshelf/data.ts","src/bookshelf/state.ts","src/cinema/state.ts","src/core/app.ts","src/core/crypto.ts","src/core/diary-format.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/http.ts","src/core/item-actions.ts","src/core/lock-stats.ts","src/core/mobile.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/settings-btn-state.ts","src/core/settings-common.ts","src/core/settings-modal.ts","src/core/settings-provider.ts","src/core/settings-schema.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/help-tip.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/lock-screen.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/diary/config.ts","src/diary/data.ts","src/diary/encrypt.ts","src/diary/index.ts","src/diary/media-import.ts","src/diary/motion.ts","src/diary/parser.ts","src/diary/render.ts","src/diary/repair.ts","src/diary/store.ts","src/diary/ui.ts","src/diary/ui/datetime-picker.ts","src/diary/ui/dialogs.ts","src/diary/ui/entry-actions.ts","src/diary/ui/locator.ts","src/diary/vendor/page-flip.browser.js","src/encrypt/data.ts","src/encrypt/index.ts","src/encrypt/motion.ts","src/encrypt/preview.ts","src/encrypt/ui.ts","src/encrypt/vault-assets-view.ts","src/password-vault/data.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/diary/fake-sim.ts → window.BZW_diary（行为单源预览包，issue 245/ADR-0106） */
var BZW_diary = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js
  var require_moment = __commonJS({
    "node_modules/.pnpm/moment@2.30.1/node_modules/moment/moment.js"(exports, module) {
      (function(global, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : global.moment = factory();
      })(exports, function() {
        "use strict";
        var hookCallback;
        function hooks() {
          return hookCallback.apply(null, arguments);
        }
        function setHookCallback(callback) {
          hookCallback = callback;
        }
        function isArray(input) {
          return input instanceof Array || Object.prototype.toString.call(input) === "[object Array]";
        }
        function isObject(input) {
          return input != null && Object.prototype.toString.call(input) === "[object Object]";
        }
        function hasOwnProp(a, b) {
          return Object.prototype.hasOwnProperty.call(a, b);
        }
        function isObjectEmpty(obj) {
          if (Object.getOwnPropertyNames) {
            return Object.getOwnPropertyNames(obj).length === 0;
          } else {
            var k;
            for (k in obj) {
              if (hasOwnProp(obj, k)) {
                return false;
              }
            }
            return true;
          }
        }
        function isUndefined(input) {
          return input === void 0;
        }
        function isNumber(input) {
          return typeof input === "number" || Object.prototype.toString.call(input) === "[object Number]";
        }
        function isDate(input) {
          return input instanceof Date || Object.prototype.toString.call(input) === "[object Date]";
        }
        function map(arr, fn) {
          var res = [], i, arrLen = arr.length;
          for (i = 0; i < arrLen; ++i) {
            res.push(fn(arr[i], i));
          }
          return res;
        }
        function extend(a, b) {
          for (var i in b) {
            if (hasOwnProp(b, i)) {
              a[i] = b[i];
            }
          }
          if (hasOwnProp(b, "toString")) {
            a.toString = b.toString;
          }
          if (hasOwnProp(b, "valueOf")) {
            a.valueOf = b.valueOf;
          }
          return a;
        }
        function createUTC(input, format2, locale2, strict) {
          return createLocalOrUTC(input, format2, locale2, strict, true).utc();
        }
        function defaultParsingFlags() {
          return {
            empty: false,
            unusedTokens: [],
            unusedInput: [],
            overflow: -2,
            charsLeftOver: 0,
            nullInput: false,
            invalidEra: null,
            invalidMonth: null,
            invalidFormat: false,
            userInvalidated: false,
            iso: false,
            parsedDateParts: [],
            era: null,
            meridiem: null,
            rfc2822: false,
            weekdayMismatch: false
          };
        }
        function getParsingFlags(m) {
          if (m._pf == null) {
            m._pf = defaultParsingFlags();
          }
          return m._pf;
        }
        var some;
        if (Array.prototype.some) {
          some = Array.prototype.some;
        } else {
          some = function(fun) {
            var t = Object(this), len = t.length >>> 0, i;
            for (i = 0; i < len; i++) {
              if (i in t && fun.call(this, t[i], i, t)) {
                return true;
              }
            }
            return false;
          };
        }
        function isValid(m) {
          var flags = null, parsedParts = false, isNowValid = m._d && !isNaN(m._d.getTime());
          if (isNowValid) {
            flags = getParsingFlags(m);
            parsedParts = some.call(flags.parsedDateParts, function(i) {
              return i != null;
            });
            isNowValid = flags.overflow < 0 && !flags.empty && !flags.invalidEra && !flags.invalidMonth && !flags.invalidWeekday && !flags.weekdayMismatch && !flags.nullInput && !flags.invalidFormat && !flags.userInvalidated && (!flags.meridiem || flags.meridiem && parsedParts);
            if (m._strict) {
              isNowValid = isNowValid && flags.charsLeftOver === 0 && flags.unusedTokens.length === 0 && flags.bigHour === void 0;
            }
          }
          if (Object.isFrozen == null || !Object.isFrozen(m)) {
            m._isValid = isNowValid;
          } else {
            return isNowValid;
          }
          return m._isValid;
        }
        function createInvalid(flags) {
          var m = createUTC(NaN);
          if (flags != null) {
            extend(getParsingFlags(m), flags);
          } else {
            getParsingFlags(m).userInvalidated = true;
          }
          return m;
        }
        var momentProperties = hooks.momentProperties = [], updateInProgress = false;
        function copyConfig(to2, from2) {
          var i, prop, val, momentPropertiesLen = momentProperties.length;
          if (!isUndefined(from2._isAMomentObject)) {
            to2._isAMomentObject = from2._isAMomentObject;
          }
          if (!isUndefined(from2._i)) {
            to2._i = from2._i;
          }
          if (!isUndefined(from2._f)) {
            to2._f = from2._f;
          }
          if (!isUndefined(from2._l)) {
            to2._l = from2._l;
          }
          if (!isUndefined(from2._strict)) {
            to2._strict = from2._strict;
          }
          if (!isUndefined(from2._tzm)) {
            to2._tzm = from2._tzm;
          }
          if (!isUndefined(from2._isUTC)) {
            to2._isUTC = from2._isUTC;
          }
          if (!isUndefined(from2._offset)) {
            to2._offset = from2._offset;
          }
          if (!isUndefined(from2._pf)) {
            to2._pf = getParsingFlags(from2);
          }
          if (!isUndefined(from2._locale)) {
            to2._locale = from2._locale;
          }
          if (momentPropertiesLen > 0) {
            for (i = 0; i < momentPropertiesLen; i++) {
              prop = momentProperties[i];
              val = from2[prop];
              if (!isUndefined(val)) {
                to2[prop] = val;
              }
            }
          }
          return to2;
        }
        function Moment(config) {
          copyConfig(this, config);
          this._d = new Date(config._d != null ? config._d.getTime() : NaN);
          if (!this.isValid()) {
            this._d = /* @__PURE__ */ new Date(NaN);
          }
          if (updateInProgress === false) {
            updateInProgress = true;
            hooks.updateOffset(this);
            updateInProgress = false;
          }
        }
        function isMoment(obj) {
          return obj instanceof Moment || obj != null && obj._isAMomentObject != null;
        }
        function warn(msg) {
          if (hooks.suppressDeprecationWarnings === false && typeof console !== "undefined" && console.warn) {
            console.warn("Deprecation warning: " + msg);
          }
        }
        function deprecate(msg, fn) {
          var firstTime = true;
          return extend(function() {
            if (hooks.deprecationHandler != null) {
              hooks.deprecationHandler(null, msg);
            }
            if (firstTime) {
              var args = [], arg, i, key, argLen = arguments.length;
              for (i = 0; i < argLen; i++) {
                arg = "";
                if (typeof arguments[i] === "object") {
                  arg += "\n[" + i + "] ";
                  for (key in arguments[0]) {
                    if (hasOwnProp(arguments[0], key)) {
                      arg += key + ": " + arguments[0][key] + ", ";
                    }
                  }
                  arg = arg.slice(0, -2);
                } else {
                  arg = arguments[i];
                }
                args.push(arg);
              }
              warn(
                msg + "\nArguments: " + Array.prototype.slice.call(args).join("") + "\n" + new Error().stack
              );
              firstTime = false;
            }
            return fn.apply(this, arguments);
          }, fn);
        }
        var deprecations = {};
        function deprecateSimple(name, msg) {
          if (hooks.deprecationHandler != null) {
            hooks.deprecationHandler(name, msg);
          }
          if (!deprecations[name]) {
            warn(msg);
            deprecations[name] = true;
          }
        }
        hooks.suppressDeprecationWarnings = false;
        hooks.deprecationHandler = null;
        function isFunction(input) {
          return typeof Function !== "undefined" && input instanceof Function || Object.prototype.toString.call(input) === "[object Function]";
        }
        function set(config) {
          var prop, i;
          for (i in config) {
            if (hasOwnProp(config, i)) {
              prop = config[i];
              if (isFunction(prop)) {
                this[i] = prop;
              } else {
                this["_" + i] = prop;
              }
            }
          }
          this._config = config;
          this._dayOfMonthOrdinalParseLenient = new RegExp(
            (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) + "|" + /\d{1,2}/.source
          );
        }
        function mergeConfigs(parentConfig, childConfig) {
          var res = extend({}, parentConfig), prop;
          for (prop in childConfig) {
            if (hasOwnProp(childConfig, prop)) {
              if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                res[prop] = {};
                extend(res[prop], parentConfig[prop]);
                extend(res[prop], childConfig[prop]);
              } else if (childConfig[prop] != null) {
                res[prop] = childConfig[prop];
              } else {
                delete res[prop];
              }
            }
          }
          for (prop in parentConfig) {
            if (hasOwnProp(parentConfig, prop) && !hasOwnProp(childConfig, prop) && isObject(parentConfig[prop])) {
              res[prop] = extend({}, res[prop]);
            }
          }
          return res;
        }
        function Locale(config) {
          if (config != null) {
            this.set(config);
          }
        }
        var keys;
        if (Object.keys) {
          keys = Object.keys;
        } else {
          keys = function(obj) {
            var i, res = [];
            for (i in obj) {
              if (hasOwnProp(obj, i)) {
                res.push(i);
              }
            }
            return res;
          };
        }
        var defaultCalendar = {
          sameDay: "[Today at] LT",
          nextDay: "[Tomorrow at] LT",
          nextWeek: "dddd [at] LT",
          lastDay: "[Yesterday at] LT",
          lastWeek: "[Last] dddd [at] LT",
          sameElse: "L"
        };
        function calendar(key, mom, now2) {
          var output = this._calendar[key] || this._calendar["sameElse"];
          return isFunction(output) ? output.call(mom, now2) : output;
        }
        function zeroFill(number, targetLength, forceSign) {
          var absNumber = "" + Math.abs(number), zerosToFill = targetLength - absNumber.length, sign2 = number >= 0;
          return (sign2 ? forceSign ? "+" : "" : "-") + Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) + absNumber;
        }
        var formattingTokens = /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|N{1,5}|YYYYYY|YYYYY|YYYY|YY|y{2,4}|yo?|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g, localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g, formatFunctions = {}, formatTokenFunctions = {};
        function addFormatToken(token2, padded, ordinal2, callback) {
          var func = callback;
          if (typeof callback === "string") {
            func = function() {
              return this[callback]();
            };
          }
          if (token2) {
            formatTokenFunctions[token2] = func;
          }
          if (padded) {
            formatTokenFunctions[padded[0]] = function() {
              return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
            };
          }
          if (ordinal2) {
            formatTokenFunctions[ordinal2] = function() {
              return this.localeData().ordinal(
                func.apply(this, arguments),
                token2
              );
            };
          }
        }
        function removeFormattingTokens(input) {
          if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, "");
          }
          return input.replace(/\\/g, "");
        }
        function makeFormatFunction(format2) {
          var array = format2.match(formattingTokens), i, length;
          for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
              array[i] = formatTokenFunctions[array[i]];
            } else {
              array[i] = removeFormattingTokens(array[i]);
            }
          }
          return function(mom) {
            var output = "", i2;
            for (i2 = 0; i2 < length; i2++) {
              output += isFunction(array[i2]) ? array[i2].call(mom, format2) : array[i2];
            }
            return output;
          };
        }
        function formatMoment(m, format2) {
          if (!m.isValid()) {
            return m.localeData().invalidDate();
          }
          format2 = expandFormat(format2, m.localeData());
          formatFunctions[format2] = formatFunctions[format2] || makeFormatFunction(format2);
          return formatFunctions[format2](m);
        }
        function expandFormat(format2, locale2) {
          var i = 5;
          function replaceLongDateFormatTokens(input) {
            return locale2.longDateFormat(input) || input;
          }
          localFormattingTokens.lastIndex = 0;
          while (i >= 0 && localFormattingTokens.test(format2)) {
            format2 = format2.replace(
              localFormattingTokens,
              replaceLongDateFormatTokens
            );
            localFormattingTokens.lastIndex = 0;
            i -= 1;
          }
          return format2;
        }
        var defaultLongDateFormat = {
          LTS: "h:mm:ss A",
          LT: "h:mm A",
          L: "MM/DD/YYYY",
          LL: "MMMM D, YYYY",
          LLL: "MMMM D, YYYY h:mm A",
          LLLL: "dddd, MMMM D, YYYY h:mm A"
        };
        function longDateFormat(key) {
          var format2 = this._longDateFormat[key], formatUpper = this._longDateFormat[key.toUpperCase()];
          if (format2 || !formatUpper) {
            return format2;
          }
          this._longDateFormat[key] = formatUpper.match(formattingTokens).map(function(tok) {
            if (tok === "MMMM" || tok === "MM" || tok === "DD" || tok === "dddd") {
              return tok.slice(1);
            }
            return tok;
          }).join("");
          return this._longDateFormat[key];
        }
        var defaultInvalidDate = "Invalid date";
        function invalidDate() {
          return this._invalidDate;
        }
        var defaultOrdinal = "%d", defaultDayOfMonthOrdinalParse = /\d{1,2}/;
        function ordinal(number) {
          return this._ordinal.replace("%d", number);
        }
        var defaultRelativeTime = {
          future: "in %s",
          past: "%s ago",
          s: "a few seconds",
          ss: "%d seconds",
          m: "a minute",
          mm: "%d minutes",
          h: "an hour",
          hh: "%d hours",
          d: "a day",
          dd: "%d days",
          w: "a week",
          ww: "%d weeks",
          M: "a month",
          MM: "%d months",
          y: "a year",
          yy: "%d years"
        };
        function relativeTime(number, withoutSuffix, string, isFuture) {
          var output = this._relativeTime[string];
          return isFunction(output) ? output(number, withoutSuffix, string, isFuture) : output.replace(/%d/i, number);
        }
        function pastFuture(diff2, output) {
          var format2 = this._relativeTime[diff2 > 0 ? "future" : "past"];
          return isFunction(format2) ? format2(output) : format2.replace(/%s/i, output);
        }
        var aliases = {
          D: "date",
          dates: "date",
          date: "date",
          d: "day",
          days: "day",
          day: "day",
          e: "weekday",
          weekdays: "weekday",
          weekday: "weekday",
          E: "isoWeekday",
          isoweekdays: "isoWeekday",
          isoweekday: "isoWeekday",
          DDD: "dayOfYear",
          dayofyears: "dayOfYear",
          dayofyear: "dayOfYear",
          h: "hour",
          hours: "hour",
          hour: "hour",
          ms: "millisecond",
          milliseconds: "millisecond",
          millisecond: "millisecond",
          m: "minute",
          minutes: "minute",
          minute: "minute",
          M: "month",
          months: "month",
          month: "month",
          Q: "quarter",
          quarters: "quarter",
          quarter: "quarter",
          s: "second",
          seconds: "second",
          second: "second",
          gg: "weekYear",
          weekyears: "weekYear",
          weekyear: "weekYear",
          GG: "isoWeekYear",
          isoweekyears: "isoWeekYear",
          isoweekyear: "isoWeekYear",
          w: "week",
          weeks: "week",
          week: "week",
          W: "isoWeek",
          isoweeks: "isoWeek",
          isoweek: "isoWeek",
          y: "year",
          years: "year",
          year: "year"
        };
        function normalizeUnits(units) {
          return typeof units === "string" ? aliases[units] || aliases[units.toLowerCase()] : void 0;
        }
        function normalizeObjectUnits(inputObject) {
          var normalizedInput = {}, normalizedProp, prop;
          for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
              normalizedProp = normalizeUnits(prop);
              if (normalizedProp) {
                normalizedInput[normalizedProp] = inputObject[prop];
              }
            }
          }
          return normalizedInput;
        }
        var priorities = {
          date: 9,
          day: 11,
          weekday: 11,
          isoWeekday: 11,
          dayOfYear: 4,
          hour: 13,
          millisecond: 16,
          minute: 14,
          month: 8,
          quarter: 7,
          second: 15,
          weekYear: 1,
          isoWeekYear: 1,
          week: 5,
          isoWeek: 5,
          year: 1
        };
        function getPrioritizedUnits(unitsObj) {
          var units = [], u;
          for (u in unitsObj) {
            if (hasOwnProp(unitsObj, u)) {
              units.push({ unit: u, priority: priorities[u] });
            }
          }
          units.sort(function(a, b) {
            return a.priority - b.priority;
          });
          return units;
        }
        var match1 = /\d/, match2 = /\d\d/, match3 = /\d{3}/, match4 = /\d{4}/, match6 = /[+-]?\d{6}/, match1to2 = /\d\d?/, match3to4 = /\d\d\d\d?/, match5to6 = /\d\d\d\d\d\d?/, match1to3 = /\d{1,3}/, match1to4 = /\d{1,4}/, match1to6 = /[+-]?\d{1,6}/, matchUnsigned = /\d+/, matchSigned = /[+-]?\d+/, matchOffset = /Z|[+-]\d\d:?\d\d/gi, matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi, matchTimestamp = /[+-]?\d+(\.\d{1,3})?/, matchWord = /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i, match1to2NoLeadingZero = /^[1-9]\d?/, match1to2HasZero = /^([1-9]\d|\d)/, regexes;
        regexes = {};
        function addRegexToken(token2, regex, strictRegex) {
          regexes[token2] = isFunction(regex) ? regex : function(isStrict, localeData2) {
            return isStrict && strictRegex ? strictRegex : regex;
          };
        }
        function getParseRegexForToken(token2, config) {
          if (!hasOwnProp(regexes, token2)) {
            return new RegExp(unescapeFormat(token2));
          }
          return regexes[token2](config._strict, config._locale);
        }
        function unescapeFormat(s) {
          return regexEscape(
            s.replace("\\", "").replace(
              /\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,
              function(matched, p1, p2, p3, p4) {
                return p1 || p2 || p3 || p4;
              }
            )
          );
        }
        function regexEscape(s) {
          return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        }
        function absFloor(number) {
          if (number < 0) {
            return Math.ceil(number) || 0;
          } else {
            return Math.floor(number);
          }
        }
        function toInt(argumentForCoercion) {
          var coercedNumber = +argumentForCoercion, value = 0;
          if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            value = absFloor(coercedNumber);
          }
          return value;
        }
        var tokens = {};
        function addParseToken(token2, callback) {
          var i, func = callback, tokenLen;
          if (typeof token2 === "string") {
            token2 = [token2];
          }
          if (isNumber(callback)) {
            func = function(input, array) {
              array[callback] = toInt(input);
            };
          }
          tokenLen = token2.length;
          for (i = 0; i < tokenLen; i++) {
            tokens[token2[i]] = func;
          }
        }
        function addWeekParseToken(token2, callback) {
          addParseToken(token2, function(input, array, config, token3) {
            config._w = config._w || {};
            callback(input, config._w, config, token3);
          });
        }
        function addTimeToArrayFromToken(token2, input, config) {
          if (input != null && hasOwnProp(tokens, token2)) {
            tokens[token2](input, config._a, config, token2);
          }
        }
        function isLeapYear(year) {
          return year % 4 === 0 && year % 100 !== 0 || year % 400 === 0;
        }
        var YEAR = 0, MONTH = 1, DATE = 2, HOUR = 3, MINUTE = 4, SECOND = 5, MILLISECOND = 6, WEEK2 = 7, WEEKDAY = 8;
        addFormatToken("Y", 0, 0, function() {
          var y = this.year();
          return y <= 9999 ? zeroFill(y, 4) : "+" + y;
        });
        addFormatToken(0, ["YY", 2], 0, function() {
          return this.year() % 100;
        });
        addFormatToken(0, ["YYYY", 4], 0, "year");
        addFormatToken(0, ["YYYYY", 5], 0, "year");
        addFormatToken(0, ["YYYYYY", 6, true], 0, "year");
        addRegexToken("Y", matchSigned);
        addRegexToken("YY", match1to2, match2);
        addRegexToken("YYYY", match1to4, match4);
        addRegexToken("YYYYY", match1to6, match6);
        addRegexToken("YYYYYY", match1to6, match6);
        addParseToken(["YYYYY", "YYYYYY"], YEAR);
        addParseToken("YYYY", function(input, array) {
          array[YEAR] = input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
        });
        addParseToken("YY", function(input, array) {
          array[YEAR] = hooks.parseTwoDigitYear(input);
        });
        addParseToken("Y", function(input, array) {
          array[YEAR] = parseInt(input, 10);
        });
        function daysInYear(year) {
          return isLeapYear(year) ? 366 : 365;
        }
        hooks.parseTwoDigitYear = function(input) {
          return toInt(input) + (toInt(input) > 68 ? 1900 : 2e3);
        };
        var getSetYear = makeGetSet("FullYear", true);
        function getIsLeapYear() {
          return isLeapYear(this.year());
        }
        function makeGetSet(unit, keepTime) {
          return function(value) {
            if (value != null) {
              set$1(this, unit, value);
              hooks.updateOffset(this, keepTime);
              return this;
            } else {
              return get(this, unit);
            }
          };
        }
        function get(mom, unit) {
          if (!mom.isValid()) {
            return NaN;
          }
          var d = mom._d, isUTC = mom._isUTC;
          switch (unit) {
            case "Milliseconds":
              return isUTC ? d.getUTCMilliseconds() : d.getMilliseconds();
            case "Seconds":
              return isUTC ? d.getUTCSeconds() : d.getSeconds();
            case "Minutes":
              return isUTC ? d.getUTCMinutes() : d.getMinutes();
            case "Hours":
              return isUTC ? d.getUTCHours() : d.getHours();
            case "Date":
              return isUTC ? d.getUTCDate() : d.getDate();
            case "Day":
              return isUTC ? d.getUTCDay() : d.getDay();
            case "Month":
              return isUTC ? d.getUTCMonth() : d.getMonth();
            case "FullYear":
              return isUTC ? d.getUTCFullYear() : d.getFullYear();
            default:
              return NaN;
          }
        }
        function set$1(mom, unit, value) {
          var d, isUTC, year, month, date;
          if (!mom.isValid() || isNaN(value)) {
            return;
          }
          d = mom._d;
          isUTC = mom._isUTC;
          switch (unit) {
            case "Milliseconds":
              return void (isUTC ? d.setUTCMilliseconds(value) : d.setMilliseconds(value));
            case "Seconds":
              return void (isUTC ? d.setUTCSeconds(value) : d.setSeconds(value));
            case "Minutes":
              return void (isUTC ? d.setUTCMinutes(value) : d.setMinutes(value));
            case "Hours":
              return void (isUTC ? d.setUTCHours(value) : d.setHours(value));
            case "Date":
              return void (isUTC ? d.setUTCDate(value) : d.setDate(value));
            case "FullYear":
              break;
            default:
              return;
          }
          year = value;
          month = mom.month();
          date = mom.date();
          date = date === 29 && month === 1 && !isLeapYear(year) ? 28 : date;
          void (isUTC ? d.setUTCFullYear(year, month, date) : d.setFullYear(year, month, date));
        }
        function stringGet(units) {
          units = normalizeUnits(units);
          if (isFunction(this[units])) {
            return this[units]();
          }
          return this;
        }
        function stringSet(units, value) {
          if (typeof units === "object") {
            units = normalizeObjectUnits(units);
            var prioritized = getPrioritizedUnits(units), i, prioritizedLen = prioritized.length;
            for (i = 0; i < prioritizedLen; i++) {
              this[prioritized[i].unit](units[prioritized[i].unit]);
            }
          } else {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
              return this[units](value);
            }
          }
          return this;
        }
        function mod(n, x) {
          return (n % x + x) % x;
        }
        var indexOf;
        if (Array.prototype.indexOf) {
          indexOf = Array.prototype.indexOf;
        } else {
          indexOf = function(o) {
            var i;
            for (i = 0; i < this.length; ++i) {
              if (this[i] === o) {
                return i;
              }
            }
            return -1;
          };
        }
        function daysInMonth(year, month) {
          if (isNaN(year) || isNaN(month)) {
            return NaN;
          }
          var modMonth = mod(month, 12);
          year += (month - modMonth) / 12;
          return modMonth === 1 ? isLeapYear(year) ? 29 : 28 : 31 - modMonth % 7 % 2;
        }
        addFormatToken("M", ["MM", 2], "Mo", function() {
          return this.month() + 1;
        });
        addFormatToken("MMM", 0, 0, function(format2) {
          return this.localeData().monthsShort(this, format2);
        });
        addFormatToken("MMMM", 0, 0, function(format2) {
          return this.localeData().months(this, format2);
        });
        addRegexToken("M", match1to2, match1to2NoLeadingZero);
        addRegexToken("MM", match1to2, match2);
        addRegexToken("MMM", function(isStrict, locale2) {
          return locale2.monthsShortRegex(isStrict);
        });
        addRegexToken("MMMM", function(isStrict, locale2) {
          return locale2.monthsRegex(isStrict);
        });
        addParseToken(["M", "MM"], function(input, array) {
          array[MONTH] = toInt(input) - 1;
        });
        addParseToken(["MMM", "MMMM"], function(input, array, config, token2) {
          var month = config._locale.monthsParse(input, token2, config._strict);
          if (month != null) {
            array[MONTH] = month;
          } else {
            getParsingFlags(config).invalidMonth = input;
          }
        });
        var defaultLocaleMonths = "January_February_March_April_May_June_July_August_September_October_November_December".split(
          "_"
        ), defaultLocaleMonthsShort = "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"), MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/, defaultMonthsShortRegex = matchWord, defaultMonthsRegex = matchWord;
        function localeMonths(m, format2) {
          if (!m) {
            return isArray(this._months) ? this._months : this._months["standalone"];
          }
          return isArray(this._months) ? this._months[m.month()] : this._months[(this._months.isFormat || MONTHS_IN_FORMAT).test(format2) ? "format" : "standalone"][m.month()];
        }
        function localeMonthsShort(m, format2) {
          if (!m) {
            return isArray(this._monthsShort) ? this._monthsShort : this._monthsShort["standalone"];
          }
          return isArray(this._monthsShort) ? this._monthsShort[m.month()] : this._monthsShort[MONTHS_IN_FORMAT.test(format2) ? "format" : "standalone"][m.month()];
        }
        function handleStrictParse(monthName, format2, strict) {
          var i, ii, mom, llc = monthName.toLocaleLowerCase();
          if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
            for (i = 0; i < 12; ++i) {
              mom = createUTC([2e3, i]);
              this._shortMonthsParse[i] = this.monthsShort(
                mom,
                ""
              ).toLocaleLowerCase();
              this._longMonthsParse[i] = this.months(mom, "").toLocaleLowerCase();
            }
          }
          if (strict) {
            if (format2 === "MMM") {
              ii = indexOf.call(this._shortMonthsParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._longMonthsParse, llc);
              return ii !== -1 ? ii : null;
            }
          } else {
            if (format2 === "MMM") {
              ii = indexOf.call(this._shortMonthsParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._longMonthsParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._longMonthsParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortMonthsParse, llc);
              return ii !== -1 ? ii : null;
            }
          }
        }
        function localeMonthsParse(monthName, format2, strict) {
          var i, mom, regex;
          if (this._monthsParseExact) {
            return handleStrictParse.call(this, monthName, format2, strict);
          }
          if (!this._monthsParse) {
            this._monthsParse = [];
            this._longMonthsParse = [];
            this._shortMonthsParse = [];
          }
          for (i = 0; i < 12; i++) {
            mom = createUTC([2e3, i]);
            if (strict && !this._longMonthsParse[i]) {
              this._longMonthsParse[i] = new RegExp(
                "^" + this.months(mom, "").replace(".", "") + "$",
                "i"
              );
              this._shortMonthsParse[i] = new RegExp(
                "^" + this.monthsShort(mom, "").replace(".", "") + "$",
                "i"
              );
            }
            if (!strict && !this._monthsParse[i]) {
              regex = "^" + this.months(mom, "") + "|^" + this.monthsShort(mom, "");
              this._monthsParse[i] = new RegExp(regex.replace(".", ""), "i");
            }
            if (strict && format2 === "MMMM" && this._longMonthsParse[i].test(monthName)) {
              return i;
            } else if (strict && format2 === "MMM" && this._shortMonthsParse[i].test(monthName)) {
              return i;
            } else if (!strict && this._monthsParse[i].test(monthName)) {
              return i;
            }
          }
        }
        function setMonth(mom, value) {
          if (!mom.isValid()) {
            return mom;
          }
          if (typeof value === "string") {
            if (/^\d+$/.test(value)) {
              value = toInt(value);
            } else {
              value = mom.localeData().monthsParse(value);
              if (!isNumber(value)) {
                return mom;
              }
            }
          }
          var month = value, date = mom.date();
          date = date < 29 ? date : Math.min(date, daysInMonth(mom.year(), month));
          void (mom._isUTC ? mom._d.setUTCMonth(month, date) : mom._d.setMonth(month, date));
          return mom;
        }
        function getSetMonth(value) {
          if (value != null) {
            setMonth(this, value);
            hooks.updateOffset(this, true);
            return this;
          } else {
            return get(this, "Month");
          }
        }
        function getDaysInMonth() {
          return daysInMonth(this.year(), this.month());
        }
        function monthsShortRegex(isStrict) {
          if (this._monthsParseExact) {
            if (!hasOwnProp(this, "_monthsRegex")) {
              computeMonthsParse.call(this);
            }
            if (isStrict) {
              return this._monthsShortStrictRegex;
            } else {
              return this._monthsShortRegex;
            }
          } else {
            if (!hasOwnProp(this, "_monthsShortRegex")) {
              this._monthsShortRegex = defaultMonthsShortRegex;
            }
            return this._monthsShortStrictRegex && isStrict ? this._monthsShortStrictRegex : this._monthsShortRegex;
          }
        }
        function monthsRegex(isStrict) {
          if (this._monthsParseExact) {
            if (!hasOwnProp(this, "_monthsRegex")) {
              computeMonthsParse.call(this);
            }
            if (isStrict) {
              return this._monthsStrictRegex;
            } else {
              return this._monthsRegex;
            }
          } else {
            if (!hasOwnProp(this, "_monthsRegex")) {
              this._monthsRegex = defaultMonthsRegex;
            }
            return this._monthsStrictRegex && isStrict ? this._monthsStrictRegex : this._monthsRegex;
          }
        }
        function computeMonthsParse() {
          function cmpLenRev(a, b) {
            return b.length - a.length;
          }
          var shortPieces = [], longPieces = [], mixedPieces = [], i, mom, shortP, longP;
          for (i = 0; i < 12; i++) {
            mom = createUTC([2e3, i]);
            shortP = regexEscape(this.monthsShort(mom, ""));
            longP = regexEscape(this.months(mom, ""));
            shortPieces.push(shortP);
            longPieces.push(longP);
            mixedPieces.push(longP);
            mixedPieces.push(shortP);
          }
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          this._monthsRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._monthsShortRegex = this._monthsRegex;
          this._monthsStrictRegex = new RegExp(
            "^(" + longPieces.join("|") + ")",
            "i"
          );
          this._monthsShortStrictRegex = new RegExp(
            "^(" + shortPieces.join("|") + ")",
            "i"
          );
        }
        function createDate(y, m, d, h, M4, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M4, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M4, s, ms);
          }
          return date;
        }
        function createUTCDate(y) {
          var date, args;
          if (y < 100 && y >= 0) {
            args = Array.prototype.slice.call(arguments);
            args[0] = y + 400;
            date = new Date(Date.UTC.apply(null, args));
            if (isFinite(date.getUTCFullYear())) {
              date.setUTCFullYear(y);
            }
          } else {
            date = new Date(Date.UTC.apply(null, arguments));
          }
          return date;
        }
        function firstWeekOffset(year, dow, doy) {
          var fwd = 7 + dow - doy, fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;
          return -fwdlw + fwd - 1;
        }
        function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
          var localWeekday = (7 + weekday - dow) % 7, weekOffset = firstWeekOffset(year, dow, doy), dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset, resYear, resDayOfYear;
          if (dayOfYear <= 0) {
            resYear = year - 1;
            resDayOfYear = daysInYear(resYear) + dayOfYear;
          } else if (dayOfYear > daysInYear(year)) {
            resYear = year + 1;
            resDayOfYear = dayOfYear - daysInYear(year);
          } else {
            resYear = year;
            resDayOfYear = dayOfYear;
          }
          return {
            year: resYear,
            dayOfYear: resDayOfYear
          };
        }
        function weekOfYear(mom, dow, doy) {
          var weekOffset = firstWeekOffset(mom.year(), dow, doy), week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1, resWeek, resYear;
          if (week < 1) {
            resYear = mom.year() - 1;
            resWeek = week + weeksInYear(resYear, dow, doy);
          } else if (week > weeksInYear(mom.year(), dow, doy)) {
            resWeek = week - weeksInYear(mom.year(), dow, doy);
            resYear = mom.year() + 1;
          } else {
            resYear = mom.year();
            resWeek = week;
          }
          return {
            week: resWeek,
            year: resYear
          };
        }
        function weeksInYear(year, dow, doy) {
          var weekOffset = firstWeekOffset(year, dow, doy), weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
          return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
        }
        addFormatToken("w", ["ww", 2], "wo", "week");
        addFormatToken("W", ["WW", 2], "Wo", "isoWeek");
        addRegexToken("w", match1to2, match1to2NoLeadingZero);
        addRegexToken("ww", match1to2, match2);
        addRegexToken("W", match1to2, match1to2NoLeadingZero);
        addRegexToken("WW", match1to2, match2);
        addWeekParseToken(
          ["w", "ww", "W", "WW"],
          function(input, week, config, token2) {
            week[token2.substr(0, 1)] = toInt(input);
          }
        );
        function localeWeek(mom) {
          return weekOfYear(mom, this._week.dow, this._week.doy).week;
        }
        var defaultLocaleWeek = {
          dow: 0,
          // Sunday is the first day of the week.
          doy: 6
          // The week that contains Jan 6th is the first week of the year.
        };
        function localeFirstDayOfWeek() {
          return this._week.dow;
        }
        function localeFirstDayOfYear() {
          return this._week.doy;
        }
        function getSetWeek(input) {
          var week = this.localeData().week(this);
          return input == null ? week : this.add((input - week) * 7, "d");
        }
        function getSetISOWeek(input) {
          var week = weekOfYear(this, 1, 4).week;
          return input == null ? week : this.add((input - week) * 7, "d");
        }
        addFormatToken("d", 0, "do", "day");
        addFormatToken("dd", 0, 0, function(format2) {
          return this.localeData().weekdaysMin(this, format2);
        });
        addFormatToken("ddd", 0, 0, function(format2) {
          return this.localeData().weekdaysShort(this, format2);
        });
        addFormatToken("dddd", 0, 0, function(format2) {
          return this.localeData().weekdays(this, format2);
        });
        addFormatToken("e", 0, 0, "weekday");
        addFormatToken("E", 0, 0, "isoWeekday");
        addRegexToken("d", match1to2);
        addRegexToken("e", match1to2);
        addRegexToken("E", match1to2);
        addRegexToken("dd", function(isStrict, locale2) {
          return locale2.weekdaysMinRegex(isStrict);
        });
        addRegexToken("ddd", function(isStrict, locale2) {
          return locale2.weekdaysShortRegex(isStrict);
        });
        addRegexToken("dddd", function(isStrict, locale2) {
          return locale2.weekdaysRegex(isStrict);
        });
        addWeekParseToken(["dd", "ddd", "dddd"], function(input, week, config, token2) {
          var weekday = config._locale.weekdaysParse(input, token2, config._strict);
          if (weekday != null) {
            week.d = weekday;
          } else {
            getParsingFlags(config).invalidWeekday = input;
          }
        });
        addWeekParseToken(["d", "e", "E"], function(input, week, config, token2) {
          week[token2] = toInt(input);
        });
        function parseWeekday(input, locale2) {
          if (typeof input !== "string") {
            return input;
          }
          if (!isNaN(input)) {
            return parseInt(input, 10);
          }
          input = locale2.weekdaysParse(input);
          if (typeof input === "number") {
            return input;
          }
          return null;
        }
        function parseIsoWeekday(input, locale2) {
          if (typeof input === "string") {
            return locale2.weekdaysParse(input) % 7 || 7;
          }
          return isNaN(input) ? null : input;
        }
        function shiftWeekdays(ws, n) {
          return ws.slice(n, 7).concat(ws.slice(0, n));
        }
        var defaultLocaleWeekdays = "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), defaultLocaleWeekdaysShort = "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"), defaultLocaleWeekdaysMin = "Su_Mo_Tu_We_Th_Fr_Sa".split("_"), defaultWeekdaysRegex = matchWord, defaultWeekdaysShortRegex = matchWord, defaultWeekdaysMinRegex = matchWord;
        function localeWeekdays(m, format2) {
          var weekdays = isArray(this._weekdays) ? this._weekdays : this._weekdays[m && m !== true && this._weekdays.isFormat.test(format2) ? "format" : "standalone"];
          return m === true ? shiftWeekdays(weekdays, this._week.dow) : m ? weekdays[m.day()] : weekdays;
        }
        function localeWeekdaysShort(m) {
          return m === true ? shiftWeekdays(this._weekdaysShort, this._week.dow) : m ? this._weekdaysShort[m.day()] : this._weekdaysShort;
        }
        function localeWeekdaysMin(m) {
          return m === true ? shiftWeekdays(this._weekdaysMin, this._week.dow) : m ? this._weekdaysMin[m.day()] : this._weekdaysMin;
        }
        function handleStrictParse$1(weekdayName, format2, strict) {
          var i, ii, mom, llc = weekdayName.toLocaleLowerCase();
          if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._minWeekdaysParse = [];
            for (i = 0; i < 7; ++i) {
              mom = createUTC([2e3, 1]).day(i);
              this._minWeekdaysParse[i] = this.weekdaysMin(
                mom,
                ""
              ).toLocaleLowerCase();
              this._shortWeekdaysParse[i] = this.weekdaysShort(
                mom,
                ""
              ).toLocaleLowerCase();
              this._weekdaysParse[i] = this.weekdays(mom, "").toLocaleLowerCase();
            }
          }
          if (strict) {
            if (format2 === "dddd") {
              ii = indexOf.call(this._weekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else if (format2 === "ddd") {
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            }
          } else {
            if (format2 === "dddd") {
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else if (format2 === "ddd") {
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._minWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            } else {
              ii = indexOf.call(this._minWeekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._weekdaysParse, llc);
              if (ii !== -1) {
                return ii;
              }
              ii = indexOf.call(this._shortWeekdaysParse, llc);
              return ii !== -1 ? ii : null;
            }
          }
        }
        function localeWeekdaysParse(weekdayName, format2, strict) {
          var i, mom, regex;
          if (this._weekdaysParseExact) {
            return handleStrictParse$1.call(this, weekdayName, format2, strict);
          }
          if (!this._weekdaysParse) {
            this._weekdaysParse = [];
            this._minWeekdaysParse = [];
            this._shortWeekdaysParse = [];
            this._fullWeekdaysParse = [];
          }
          for (i = 0; i < 7; i++) {
            mom = createUTC([2e3, 1]).day(i);
            if (strict && !this._fullWeekdaysParse[i]) {
              this._fullWeekdaysParse[i] = new RegExp(
                "^" + this.weekdays(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
              this._shortWeekdaysParse[i] = new RegExp(
                "^" + this.weekdaysShort(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
              this._minWeekdaysParse[i] = new RegExp(
                "^" + this.weekdaysMin(mom, "").replace(".", "\\.?") + "$",
                "i"
              );
            }
            if (!this._weekdaysParse[i]) {
              regex = "^" + this.weekdays(mom, "") + "|^" + this.weekdaysShort(mom, "") + "|^" + this.weekdaysMin(mom, "");
              this._weekdaysParse[i] = new RegExp(regex.replace(".", ""), "i");
            }
            if (strict && format2 === "dddd" && this._fullWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (strict && format2 === "ddd" && this._shortWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (strict && format2 === "dd" && this._minWeekdaysParse[i].test(weekdayName)) {
              return i;
            } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
              return i;
            }
          }
        }
        function getSetDayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          var day = get(this, "Day");
          if (input != null) {
            input = parseWeekday(input, this.localeData());
            return this.add(input - day, "d");
          } else {
            return day;
          }
        }
        function getSetLocaleDayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
          return input == null ? weekday : this.add(input - weekday, "d");
        }
        function getSetISODayOfWeek(input) {
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          if (input != null) {
            var weekday = parseIsoWeekday(input, this.localeData());
            return this.day(this.day() % 7 ? weekday : weekday - 7);
          } else {
            return this.day() || 7;
          }
        }
        function weekdaysRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysStrictRegex;
            } else {
              return this._weekdaysRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              this._weekdaysRegex = defaultWeekdaysRegex;
            }
            return this._weekdaysStrictRegex && isStrict ? this._weekdaysStrictRegex : this._weekdaysRegex;
          }
        }
        function weekdaysShortRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysShortStrictRegex;
            } else {
              return this._weekdaysShortRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysShortRegex")) {
              this._weekdaysShortRegex = defaultWeekdaysShortRegex;
            }
            return this._weekdaysShortStrictRegex && isStrict ? this._weekdaysShortStrictRegex : this._weekdaysShortRegex;
          }
        }
        function weekdaysMinRegex(isStrict) {
          if (this._weekdaysParseExact) {
            if (!hasOwnProp(this, "_weekdaysRegex")) {
              computeWeekdaysParse.call(this);
            }
            if (isStrict) {
              return this._weekdaysMinStrictRegex;
            } else {
              return this._weekdaysMinRegex;
            }
          } else {
            if (!hasOwnProp(this, "_weekdaysMinRegex")) {
              this._weekdaysMinRegex = defaultWeekdaysMinRegex;
            }
            return this._weekdaysMinStrictRegex && isStrict ? this._weekdaysMinStrictRegex : this._weekdaysMinRegex;
          }
        }
        function computeWeekdaysParse() {
          function cmpLenRev(a, b) {
            return b.length - a.length;
          }
          var minPieces = [], shortPieces = [], longPieces = [], mixedPieces = [], i, mom, minp, shortp, longp;
          for (i = 0; i < 7; i++) {
            mom = createUTC([2e3, 1]).day(i);
            minp = regexEscape(this.weekdaysMin(mom, ""));
            shortp = regexEscape(this.weekdaysShort(mom, ""));
            longp = regexEscape(this.weekdays(mom, ""));
            minPieces.push(minp);
            shortPieces.push(shortp);
            longPieces.push(longp);
            mixedPieces.push(minp);
            mixedPieces.push(shortp);
            mixedPieces.push(longp);
          }
          minPieces.sort(cmpLenRev);
          shortPieces.sort(cmpLenRev);
          longPieces.sort(cmpLenRev);
          mixedPieces.sort(cmpLenRev);
          this._weekdaysRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._weekdaysShortRegex = this._weekdaysRegex;
          this._weekdaysMinRegex = this._weekdaysRegex;
          this._weekdaysStrictRegex = new RegExp(
            "^(" + longPieces.join("|") + ")",
            "i"
          );
          this._weekdaysShortStrictRegex = new RegExp(
            "^(" + shortPieces.join("|") + ")",
            "i"
          );
          this._weekdaysMinStrictRegex = new RegExp(
            "^(" + minPieces.join("|") + ")",
            "i"
          );
        }
        function hFormat() {
          return this.hours() % 12 || 12;
        }
        function kFormat() {
          return this.hours() || 24;
        }
        addFormatToken("H", ["HH", 2], 0, "hour");
        addFormatToken("h", ["hh", 2], 0, hFormat);
        addFormatToken("k", ["kk", 2], 0, kFormat);
        addFormatToken("hmm", 0, 0, function() {
          return "" + hFormat.apply(this) + zeroFill(this.minutes(), 2);
        });
        addFormatToken("hmmss", 0, 0, function() {
          return "" + hFormat.apply(this) + zeroFill(this.minutes(), 2) + zeroFill(this.seconds(), 2);
        });
        addFormatToken("Hmm", 0, 0, function() {
          return "" + this.hours() + zeroFill(this.minutes(), 2);
        });
        addFormatToken("Hmmss", 0, 0, function() {
          return "" + this.hours() + zeroFill(this.minutes(), 2) + zeroFill(this.seconds(), 2);
        });
        function meridiem(token2, lowercase) {
          addFormatToken(token2, 0, 0, function() {
            return this.localeData().meridiem(
              this.hours(),
              this.minutes(),
              lowercase
            );
          });
        }
        meridiem("a", true);
        meridiem("A", false);
        function matchMeridiem(isStrict, locale2) {
          return locale2._meridiemParse;
        }
        addRegexToken("a", matchMeridiem);
        addRegexToken("A", matchMeridiem);
        addRegexToken("H", match1to2, match1to2HasZero);
        addRegexToken("h", match1to2, match1to2NoLeadingZero);
        addRegexToken("k", match1to2, match1to2NoLeadingZero);
        addRegexToken("HH", match1to2, match2);
        addRegexToken("hh", match1to2, match2);
        addRegexToken("kk", match1to2, match2);
        addRegexToken("hmm", match3to4);
        addRegexToken("hmmss", match5to6);
        addRegexToken("Hmm", match3to4);
        addRegexToken("Hmmss", match5to6);
        addParseToken(["H", "HH"], HOUR);
        addParseToken(["k", "kk"], function(input, array, config) {
          var kInput = toInt(input);
          array[HOUR] = kInput === 24 ? 0 : kInput;
        });
        addParseToken(["a", "A"], function(input, array, config) {
          config._isPm = config._locale.isPM(input);
          config._meridiem = input;
        });
        addParseToken(["h", "hh"], function(input, array, config) {
          array[HOUR] = toInt(input);
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("Hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
        });
        addParseToken("Hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
        });
        function localeIsPM(input) {
          return (input + "").toLowerCase().charAt(0) === "p";
        }
        var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i, getSetHour = makeGetSet("Hours", true);
        function localeMeridiem(hours2, minutes2, isLower) {
          if (hours2 > 11) {
            return isLower ? "pm" : "PM";
          } else {
            return isLower ? "am" : "AM";
          }
        }
        var baseConfig = {
          calendar: defaultCalendar,
          longDateFormat: defaultLongDateFormat,
          invalidDate: defaultInvalidDate,
          ordinal: defaultOrdinal,
          dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
          relativeTime: defaultRelativeTime,
          months: defaultLocaleMonths,
          monthsShort: defaultLocaleMonthsShort,
          week: defaultLocaleWeek,
          weekdays: defaultLocaleWeekdays,
          weekdaysMin: defaultLocaleWeekdaysMin,
          weekdaysShort: defaultLocaleWeekdaysShort,
          meridiemParse: defaultLocaleMeridiemParse
        };
        var locales = {}, localeFamilies = {}, globalLocale;
        function commonPrefix(arr1, arr2) {
          var i, minl = Math.min(arr1.length, arr2.length);
          for (i = 0; i < minl; i += 1) {
            if (arr1[i] !== arr2[i]) {
              return i;
            }
          }
          return minl;
        }
        function normalizeLocale(key) {
          return key ? key.toLowerCase().replace("_", "-") : key;
        }
        function chooseLocale(names) {
          var i = 0, j, next, locale2, split;
          while (i < names.length) {
            split = normalizeLocale(names[i]).split("-");
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split("-") : null;
            while (j > 0) {
              locale2 = loadLocale(split.slice(0, j).join("-"));
              if (locale2) {
                return locale2;
              }
              if (next && next.length >= j && commonPrefix(split, next) >= j - 1) {
                break;
              }
              j--;
            }
            i++;
          }
          return globalLocale;
        }
        function isLocaleNameSane(name) {
          return !!(name && name.match("^[^/\\\\]*$"));
        }
        function loadLocale(name) {
          var oldLocale = null, aliasedRequire;
          if (locales[name] === void 0 && typeof module !== "undefined" && module && module.exports && isLocaleNameSane(name)) {
            try {
              oldLocale = globalLocale._abbr;
              aliasedRequire = __require;
              aliasedRequire("./locale/" + name);
              getSetGlobalLocale(oldLocale);
            } catch (e) {
              locales[name] = null;
            }
          }
          return locales[name];
        }
        function getSetGlobalLocale(key, values) {
          var data;
          if (key) {
            if (isUndefined(values)) {
              data = getLocale(key);
            } else {
              data = defineLocale(key, values);
            }
            if (data) {
              globalLocale = data;
            } else {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  "Locale " + key + " not found. Did you forget to load it?"
                );
              }
            }
          }
          return globalLocale._abbr;
        }
        function defineLocale(name, config) {
          if (config !== null) {
            var locale2, parentConfig = baseConfig;
            config.abbr = name;
            if (locales[name] != null) {
              deprecateSimple(
                "defineLocaleOverride",
                "use moment.updateLocale(localeName, config) to change an existing locale. moment.defineLocale(localeName, config) should only be used for creating a new locale See http://momentjs.com/guides/#/warnings/define-locale/ for more info."
              );
              parentConfig = locales[name]._config;
            } else if (config.parentLocale != null) {
              if (locales[config.parentLocale] != null) {
                parentConfig = locales[config.parentLocale]._config;
              } else {
                locale2 = loadLocale(config.parentLocale);
                if (locale2 != null) {
                  parentConfig = locale2._config;
                } else {
                  if (!localeFamilies[config.parentLocale]) {
                    localeFamilies[config.parentLocale] = [];
                  }
                  localeFamilies[config.parentLocale].push({
                    name,
                    config
                  });
                  return null;
                }
              }
            }
            locales[name] = new Locale(mergeConfigs(parentConfig, config));
            if (localeFamilies[name]) {
              localeFamilies[name].forEach(function(x) {
                defineLocale(x.name, x.config);
              });
            }
            getSetGlobalLocale(name);
            return locales[name];
          } else {
            delete locales[name];
            return null;
          }
        }
        function updateLocale(name, config) {
          if (config != null) {
            var locale2, tmpLocale, parentConfig = baseConfig;
            if (locales[name] != null && locales[name].parentLocale != null) {
              locales[name].set(mergeConfigs(locales[name]._config, config));
            } else {
              tmpLocale = loadLocale(name);
              if (tmpLocale != null) {
                parentConfig = tmpLocale._config;
              }
              config = mergeConfigs(parentConfig, config);
              if (tmpLocale == null) {
                config.abbr = name;
              }
              locale2 = new Locale(config);
              locale2.parentLocale = locales[name];
              locales[name] = locale2;
            }
            getSetGlobalLocale(name);
          } else {
            if (locales[name] != null) {
              if (locales[name].parentLocale != null) {
                locales[name] = locales[name].parentLocale;
                if (name === getSetGlobalLocale()) {
                  getSetGlobalLocale(name);
                }
              } else if (locales[name] != null) {
                delete locales[name];
              }
            }
          }
          return locales[name];
        }
        function getLocale(key) {
          var locale2;
          if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
          }
          if (!key) {
            return globalLocale;
          }
          if (!isArray(key)) {
            locale2 = loadLocale(key);
            if (locale2) {
              return locale2;
            }
            key = [key];
          }
          return chooseLocale(key);
        }
        function listLocales() {
          return keys(locales);
        }
        function checkOverflow(m) {
          var overflow, a = m._a;
          if (a && getParsingFlags(m).overflow === -2) {
            overflow = a[MONTH] < 0 || a[MONTH] > 11 ? MONTH : a[DATE] < 1 || a[DATE] > daysInMonth(a[YEAR], a[MONTH]) ? DATE : a[HOUR] < 0 || a[HOUR] > 24 || a[HOUR] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0) ? HOUR : a[MINUTE] < 0 || a[MINUTE] > 59 ? MINUTE : a[SECOND] < 0 || a[SECOND] > 59 ? SECOND : a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND : -1;
            if (getParsingFlags(m)._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
              overflow = DATE;
            }
            if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
              overflow = WEEK2;
            }
            if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
              overflow = WEEKDAY;
            }
            getParsingFlags(m).overflow = overflow;
          }
          return m;
        }
        var extendedIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/, basicIsoRegex = /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d|))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/, tzRegex = /Z|[+-]\d\d(?::?\d\d)?/, isoDates = [
          ["YYYYYY-MM-DD", /[+-]\d{6}-\d\d-\d\d/],
          ["YYYY-MM-DD", /\d{4}-\d\d-\d\d/],
          ["GGGG-[W]WW-E", /\d{4}-W\d\d-\d/],
          ["GGGG-[W]WW", /\d{4}-W\d\d/, false],
          ["YYYY-DDD", /\d{4}-\d{3}/],
          ["YYYY-MM", /\d{4}-\d\d/, false],
          ["YYYYYYMMDD", /[+-]\d{10}/],
          ["YYYYMMDD", /\d{8}/],
          ["GGGG[W]WWE", /\d{4}W\d{3}/],
          ["GGGG[W]WW", /\d{4}W\d{2}/, false],
          ["YYYYDDD", /\d{7}/],
          ["YYYYMM", /\d{6}/, false],
          ["YYYY", /\d{4}/, false]
        ], isoTimes = [
          ["HH:mm:ss.SSSS", /\d\d:\d\d:\d\d\.\d+/],
          ["HH:mm:ss,SSSS", /\d\d:\d\d:\d\d,\d+/],
          ["HH:mm:ss", /\d\d:\d\d:\d\d/],
          ["HH:mm", /\d\d:\d\d/],
          ["HHmmss.SSSS", /\d\d\d\d\d\d\.\d+/],
          ["HHmmss,SSSS", /\d\d\d\d\d\d,\d+/],
          ["HHmmss", /\d\d\d\d\d\d/],
          ["HHmm", /\d\d\d\d/],
          ["HH", /\d\d/]
        ], aspNetJsonRegex = /^\/?Date\((-?\d+)/i, rfc2822 = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/, obsOffsets = {
          UT: 0,
          GMT: 0,
          EDT: -4 * 60,
          EST: -5 * 60,
          CDT: -5 * 60,
          CST: -6 * 60,
          MDT: -6 * 60,
          MST: -7 * 60,
          PDT: -7 * 60,
          PST: -8 * 60
        };
        function configFromISO(config) {
          var i, l, string = config._i, match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string), allowTime, dateFormat, timeFormat, tzFormat, isoDatesLen = isoDates.length, isoTimesLen = isoTimes.length;
          if (match) {
            getParsingFlags(config).iso = true;
            for (i = 0, l = isoDatesLen; i < l; i++) {
              if (isoDates[i][1].exec(match[1])) {
                dateFormat = isoDates[i][0];
                allowTime = isoDates[i][2] !== false;
                break;
              }
            }
            if (dateFormat == null) {
              config._isValid = false;
              return;
            }
            if (match[3]) {
              for (i = 0, l = isoTimesLen; i < l; i++) {
                if (isoTimes[i][1].exec(match[3])) {
                  timeFormat = (match[2] || " ") + isoTimes[i][0];
                  break;
                }
              }
              if (timeFormat == null) {
                config._isValid = false;
                return;
              }
            }
            if (!allowTime && timeFormat != null) {
              config._isValid = false;
              return;
            }
            if (match[4]) {
              if (tzRegex.exec(match[4])) {
                tzFormat = "Z";
              } else {
                config._isValid = false;
                return;
              }
            }
            config._f = dateFormat + (timeFormat || "") + (tzFormat || "");
            configFromStringAndFormat(config);
          } else {
            config._isValid = false;
          }
        }
        function extractFromRFC2822Strings(yearStr, monthStr, dayStr, hourStr, minuteStr, secondStr) {
          var result = [
            untruncateYear(yearStr),
            defaultLocaleMonthsShort.indexOf(monthStr),
            parseInt(dayStr, 10),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
          ];
          if (secondStr) {
            result.push(parseInt(secondStr, 10));
          }
          return result;
        }
        function untruncateYear(yearStr) {
          var year = parseInt(yearStr, 10);
          if (year <= 49) {
            return 2e3 + year;
          } else if (year <= 999) {
            return 1900 + year;
          }
          return year;
        }
        function preprocessRFC2822(s) {
          return s.replace(/\([^()]*\)|[\n\t]/g, " ").replace(/(\s\s+)/g, " ").replace(/^\s\s*/, "").replace(/\s\s*$/, "");
        }
        function checkWeekday(weekdayStr, parsedInput, config) {
          if (weekdayStr) {
            var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr), weekdayActual = new Date(
              parsedInput[0],
              parsedInput[1],
              parsedInput[2]
            ).getDay();
            if (weekdayProvided !== weekdayActual) {
              getParsingFlags(config).weekdayMismatch = true;
              config._isValid = false;
              return false;
            }
          }
          return true;
        }
        function calculateOffset(obsOffset, militaryOffset, numOffset) {
          if (obsOffset) {
            return obsOffsets[obsOffset];
          } else if (militaryOffset) {
            return 0;
          } else {
            var hm = parseInt(numOffset, 10), m = hm % 100, h = (hm - m) / 100;
            return h * 60 + m;
          }
        }
        function configFromRFC2822(config) {
          var match = rfc2822.exec(preprocessRFC2822(config._i)), parsedArray;
          if (match) {
            parsedArray = extractFromRFC2822Strings(
              match[4],
              match[3],
              match[2],
              match[5],
              match[6],
              match[7]
            );
            if (!checkWeekday(match[1], parsedArray, config)) {
              return;
            }
            config._a = parsedArray;
            config._tzm = calculateOffset(match[8], match[9], match[10]);
            config._d = createUTCDate.apply(null, config._a);
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
            getParsingFlags(config).rfc2822 = true;
          } else {
            config._isValid = false;
          }
        }
        function configFromString(config) {
          var matched = aspNetJsonRegex.exec(config._i);
          if (matched !== null) {
            config._d = /* @__PURE__ */ new Date(+matched[1]);
            return;
          }
          configFromISO(config);
          if (config._isValid === false) {
            delete config._isValid;
          } else {
            return;
          }
          configFromRFC2822(config);
          if (config._isValid === false) {
            delete config._isValid;
          } else {
            return;
          }
          if (config._strict) {
            config._isValid = false;
          } else {
            hooks.createFromInputFallback(config);
          }
        }
        hooks.createFromInputFallback = deprecate(
          "value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are discouraged. Please refer to http://momentjs.com/guides/#/warnings/js-date/ for more info.",
          function(config) {
            config._d = /* @__PURE__ */ new Date(config._i + (config._useUTC ? " UTC" : ""));
          }
        );
        function defaults(a, b, c) {
          if (a != null) {
            return a;
          }
          if (b != null) {
            return b;
          }
          return c;
        }
        function currentDateArray(config) {
          var nowValue = new Date(hooks.now());
          if (config._useUTC) {
            return [
              nowValue.getUTCFullYear(),
              nowValue.getUTCMonth(),
              nowValue.getUTCDate()
            ];
          }
          return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
        }
        function configFromArray(config) {
          var i, date, input = [], currentDate, expectedWeekday, yearToUse;
          if (config._d) {
            return;
          }
          currentDate = currentDateArray(config);
          if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
          }
          if (config._dayOfYear != null) {
            yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);
            if (config._dayOfYear > daysInYear(yearToUse) || config._dayOfYear === 0) {
              getParsingFlags(config)._overflowDayOfYear = true;
            }
            date = createUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
          }
          for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
          }
          for (; i < 7; i++) {
            config._a[i] = input[i] = config._a[i] == null ? i === 2 ? 1 : 0 : config._a[i];
          }
          if (config._a[HOUR] === 24 && config._a[MINUTE] === 0 && config._a[SECOND] === 0 && config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
          }
          config._d = (config._useUTC ? createUTCDate : createDate).apply(
            null,
            input
          );
          expectedWeekday = config._useUTC ? config._d.getUTCDay() : config._d.getDay();
          if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
          }
          if (config._nextDay) {
            config._a[HOUR] = 24;
          }
          if (config._w && typeof config._w.d !== "undefined" && config._w.d !== expectedWeekday) {
            getParsingFlags(config).weekdayMismatch = true;
          }
        }
        function dayOfYearFromWeekInfo(config) {
          var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow, curWeek;
          w = config._w;
          if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;
            weekYear = defaults(
              w.GG,
              config._a[YEAR],
              weekOfYear(createLocal(), 1, 4).year
            );
            week = defaults(w.W, 1);
            weekday = defaults(w.E, 1);
            if (weekday < 1 || weekday > 7) {
              weekdayOverflow = true;
            }
          } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;
            curWeek = weekOfYear(createLocal(), dow, doy);
            weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);
            week = defaults(w.w, curWeek.week);
            if (w.d != null) {
              weekday = w.d;
              if (weekday < 0 || weekday > 6) {
                weekdayOverflow = true;
              }
            } else if (w.e != null) {
              weekday = w.e + dow;
              if (w.e < 0 || w.e > 6) {
                weekdayOverflow = true;
              }
            } else {
              weekday = dow;
            }
          }
          if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
            getParsingFlags(config)._overflowWeeks = true;
          } else if (weekdayOverflow != null) {
            getParsingFlags(config)._overflowWeekday = true;
          } else {
            temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
            config._a[YEAR] = temp.year;
            config._dayOfYear = temp.dayOfYear;
          }
        }
        hooks.ISO_8601 = function() {
        };
        hooks.RFC_2822 = function() {
        };
        function configFromStringAndFormat(config) {
          if (config._f === hooks.ISO_8601) {
            configFromISO(config);
            return;
          }
          if (config._f === hooks.RFC_2822) {
            configFromRFC2822(config);
            return;
          }
          config._a = [];
          getParsingFlags(config).empty = true;
          var string = "" + config._i, i, parsedInput, tokens2, token2, skipped, stringLength = string.length, totalParsedInputLength = 0, era, tokenLen;
          tokens2 = expandFormat(config._f, config._locale).match(formattingTokens) || [];
          tokenLen = tokens2.length;
          for (i = 0; i < tokenLen; i++) {
            token2 = tokens2[i];
            parsedInput = (string.match(getParseRegexForToken(token2, config)) || [])[0];
            if (parsedInput) {
              skipped = string.substr(0, string.indexOf(parsedInput));
              if (skipped.length > 0) {
                getParsingFlags(config).unusedInput.push(skipped);
              }
              string = string.slice(
                string.indexOf(parsedInput) + parsedInput.length
              );
              totalParsedInputLength += parsedInput.length;
            }
            if (formatTokenFunctions[token2]) {
              if (parsedInput) {
                getParsingFlags(config).empty = false;
              } else {
                getParsingFlags(config).unusedTokens.push(token2);
              }
              addTimeToArrayFromToken(token2, parsedInput, config);
            } else if (config._strict && !parsedInput) {
              getParsingFlags(config).unusedTokens.push(token2);
            }
          }
          getParsingFlags(config).charsLeftOver = stringLength - totalParsedInputLength;
          if (string.length > 0) {
            getParsingFlags(config).unusedInput.push(string);
          }
          if (config._a[HOUR] <= 12 && getParsingFlags(config).bigHour === true && config._a[HOUR] > 0) {
            getParsingFlags(config).bigHour = void 0;
          }
          getParsingFlags(config).parsedDateParts = config._a.slice(0);
          getParsingFlags(config).meridiem = config._meridiem;
          config._a[HOUR] = meridiemFixWrap(
            config._locale,
            config._a[HOUR],
            config._meridiem
          );
          era = getParsingFlags(config).era;
          if (era !== null) {
            config._a[YEAR] = config._locale.erasConvertYear(era, config._a[YEAR]);
          }
          configFromArray(config);
          checkOverflow(config);
        }
        function meridiemFixWrap(locale2, hour, meridiem2) {
          var isPm;
          if (meridiem2 == null) {
            return hour;
          }
          if (locale2.meridiemHour != null) {
            return locale2.meridiemHour(hour, meridiem2);
          } else if (locale2.isPM != null) {
            isPm = locale2.isPM(meridiem2);
            if (isPm && hour < 12) {
              hour += 12;
            }
            if (!isPm && hour === 12) {
              hour = 0;
            }
            return hour;
          } else {
            return hour;
          }
        }
        function configFromStringAndArray(config) {
          var tempConfig, bestMoment, scoreToBeat, i, currentScore, validFormatFound, bestFormatIsValid = false, configfLen = config._f.length;
          if (configfLen === 0) {
            getParsingFlags(config).invalidFormat = true;
            config._d = /* @__PURE__ */ new Date(NaN);
            return;
          }
          for (i = 0; i < configfLen; i++) {
            currentScore = 0;
            validFormatFound = false;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
              tempConfig._useUTC = config._useUTC;
            }
            tempConfig._f = config._f[i];
            configFromStringAndFormat(tempConfig);
            if (isValid(tempConfig)) {
              validFormatFound = true;
            }
            currentScore += getParsingFlags(tempConfig).charsLeftOver;
            currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;
            getParsingFlags(tempConfig).score = currentScore;
            if (!bestFormatIsValid) {
              if (scoreToBeat == null || currentScore < scoreToBeat || validFormatFound) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
                if (validFormatFound) {
                  bestFormatIsValid = true;
                }
              }
            } else {
              if (currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
              }
            }
          }
          extend(config, bestMoment || tempConfig);
        }
        function configFromObject(config) {
          if (config._d) {
            return;
          }
          var i = normalizeObjectUnits(config._i), dayOrDate = i.day === void 0 ? i.date : i.day;
          config._a = map(
            [i.year, i.month, dayOrDate, i.hour, i.minute, i.second, i.millisecond],
            function(obj) {
              return obj && parseInt(obj, 10);
            }
          );
          configFromArray(config);
        }
        function createFromConfig(config) {
          var res = new Moment(checkOverflow(prepareConfig(config)));
          if (res._nextDay) {
            res.add(1, "d");
            res._nextDay = void 0;
          }
          return res;
        }
        function prepareConfig(config) {
          var input = config._i, format2 = config._f;
          config._locale = config._locale || getLocale(config._l);
          if (input === null || format2 === void 0 && input === "") {
            return createInvalid({ nullInput: true });
          }
          if (typeof input === "string") {
            config._i = input = config._locale.preparse(input);
          }
          if (isMoment(input)) {
            return new Moment(checkOverflow(input));
          } else if (isDate(input)) {
            config._d = input;
          } else if (isArray(format2)) {
            configFromStringAndArray(config);
          } else if (format2) {
            configFromStringAndFormat(config);
          } else {
            configFromInput(config);
          }
          if (!isValid(config)) {
            config._d = null;
          }
          return config;
        }
        function configFromInput(config) {
          var input = config._i;
          if (isUndefined(input)) {
            config._d = new Date(hooks.now());
          } else if (isDate(input)) {
            config._d = new Date(input.valueOf());
          } else if (typeof input === "string") {
            configFromString(config);
          } else if (isArray(input)) {
            config._a = map(input.slice(0), function(obj) {
              return parseInt(obj, 10);
            });
            configFromArray(config);
          } else if (isObject(input)) {
            configFromObject(config);
          } else if (isNumber(input)) {
            config._d = new Date(input);
          } else {
            hooks.createFromInputFallback(config);
          }
        }
        function createLocalOrUTC(input, format2, locale2, strict, isUTC) {
          var c = {};
          if (format2 === true || format2 === false) {
            strict = format2;
            format2 = void 0;
          }
          if (locale2 === true || locale2 === false) {
            strict = locale2;
            locale2 = void 0;
          }
          if (isObject(input) && isObjectEmpty(input) || isArray(input) && input.length === 0) {
            input = void 0;
          }
          c._isAMomentObject = true;
          c._useUTC = c._isUTC = isUTC;
          c._l = locale2;
          c._i = input;
          c._f = format2;
          c._strict = strict;
          return createFromConfig(c);
        }
        function createLocal(input, format2, locale2, strict) {
          return createLocalOrUTC(input, format2, locale2, strict, false);
        }
        var prototypeMin = deprecate(
          "moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/",
          function() {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
              return other < this ? this : other;
            } else {
              return createInvalid();
            }
          }
        ), prototypeMax = deprecate(
          "moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/",
          function() {
            var other = createLocal.apply(null, arguments);
            if (this.isValid() && other.isValid()) {
              return other > this ? this : other;
            } else {
              return createInvalid();
            }
          }
        );
        function pickBy(fn, moments) {
          var res, i;
          if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
          }
          if (!moments.length) {
            return createLocal();
          }
          res = moments[0];
          for (i = 1; i < moments.length; ++i) {
            if (!moments[i].isValid() || moments[i][fn](res)) {
              res = moments[i];
            }
          }
          return res;
        }
        function min() {
          var args = [].slice.call(arguments, 0);
          return pickBy("isBefore", args);
        }
        function max() {
          var args = [].slice.call(arguments, 0);
          return pickBy("isAfter", args);
        }
        var now = function() {
          return Date.now ? Date.now() : +/* @__PURE__ */ new Date();
        };
        var ordering = [
          "year",
          "quarter",
          "month",
          "week",
          "day",
          "hour",
          "minute",
          "second",
          "millisecond"
        ];
        function isDurationValid(m) {
          var key, unitHasDecimal = false, i, orderLen = ordering.length;
          for (key in m) {
            if (hasOwnProp(m, key) && !(indexOf.call(ordering, key) !== -1 && (m[key] == null || !isNaN(m[key])))) {
              return false;
            }
          }
          for (i = 0; i < orderLen; ++i) {
            if (m[ordering[i]]) {
              if (unitHasDecimal) {
                return false;
              }
              if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                unitHasDecimal = true;
              }
            }
          }
          return true;
        }
        function isValid$1() {
          return this._isValid;
        }
        function createInvalid$1() {
          return createDuration(NaN);
        }
        function Duration(duration) {
          var normalizedInput = normalizeObjectUnits(duration), years2 = normalizedInput.year || 0, quarters = normalizedInput.quarter || 0, months2 = normalizedInput.month || 0, weeks2 = normalizedInput.week || normalizedInput.isoWeek || 0, days2 = normalizedInput.day || 0, hours2 = normalizedInput.hour || 0, minutes2 = normalizedInput.minute || 0, seconds2 = normalizedInput.second || 0, milliseconds2 = normalizedInput.millisecond || 0;
          this._isValid = isDurationValid(normalizedInput);
          this._milliseconds = +milliseconds2 + seconds2 * 1e3 + // 1000
          minutes2 * 6e4 + // 1000 * 60
          hours2 * 1e3 * 60 * 60;
          this._days = +days2 + weeks2 * 7;
          this._months = +months2 + quarters * 3 + years2 * 12;
          this._data = {};
          this._locale = getLocale();
          this._bubble();
        }
        function isDuration(obj) {
          return obj instanceof Duration;
        }
        function absRound(number) {
          if (number < 0) {
            return Math.round(-1 * number) * -1;
          } else {
            return Math.round(number);
          }
        }
        function compareArrays(array1, array2, dontConvert) {
          var len = Math.min(array1.length, array2.length), lengthDiff = Math.abs(array1.length - array2.length), diffs = 0, i;
          for (i = 0; i < len; i++) {
            if (dontConvert && array1[i] !== array2[i] || !dontConvert && toInt(array1[i]) !== toInt(array2[i])) {
              diffs++;
            }
          }
          return diffs + lengthDiff;
        }
        function offset(token2, separator) {
          addFormatToken(token2, 0, 0, function() {
            var offset2 = this.utcOffset(), sign2 = "+";
            if (offset2 < 0) {
              offset2 = -offset2;
              sign2 = "-";
            }
            return sign2 + zeroFill(~~(offset2 / 60), 2) + separator + zeroFill(~~offset2 % 60, 2);
          });
        }
        offset("Z", ":");
        offset("ZZ", "");
        addRegexToken("Z", matchShortOffset);
        addRegexToken("ZZ", matchShortOffset);
        addParseToken(["Z", "ZZ"], function(input, array, config) {
          config._useUTC = true;
          config._tzm = offsetFromString(matchShortOffset, input);
        });
        var chunkOffset = /([\+\-]|\d\d)/gi;
        function offsetFromString(matcher, string) {
          var matches = (string || "").match(matcher), chunk, parts, minutes2;
          if (matches === null) {
            return null;
          }
          chunk = matches[matches.length - 1] || [];
          parts = (chunk + "").match(chunkOffset) || ["-", 0, 0];
          minutes2 = +(parts[1] * 60) + toInt(parts[2]);
          return minutes2 === 0 ? 0 : parts[0] === "+" ? minutes2 : -minutes2;
        }
        function cloneWithOffset(input, model) {
          var res, diff2;
          if (model._isUTC) {
            res = model.clone();
            diff2 = (isMoment(input) || isDate(input) ? input.valueOf() : createLocal(input).valueOf()) - res.valueOf();
            res._d.setTime(res._d.valueOf() + diff2);
            hooks.updateOffset(res, false);
            return res;
          } else {
            return createLocal(input).local();
          }
        }
        function getDateOffset(m) {
          return -Math.round(m._d.getTimezoneOffset());
        }
        hooks.updateOffset = function() {
        };
        function getSetOffset(input, keepLocalTime, keepMinutes) {
          var offset2 = this._offset || 0, localAdjust;
          if (!this.isValid()) {
            return input != null ? this : NaN;
          }
          if (input != null) {
            if (typeof input === "string") {
              input = offsetFromString(matchShortOffset, input);
              if (input === null) {
                return this;
              }
            } else if (Math.abs(input) < 16 && !keepMinutes) {
              input = input * 60;
            }
            if (!this._isUTC && keepLocalTime) {
              localAdjust = getDateOffset(this);
            }
            this._offset = input;
            this._isUTC = true;
            if (localAdjust != null) {
              this.add(localAdjust, "m");
            }
            if (offset2 !== input) {
              if (!keepLocalTime || this._changeInProgress) {
                addSubtract(
                  this,
                  createDuration(input - offset2, "m"),
                  1,
                  false
                );
              } else if (!this._changeInProgress) {
                this._changeInProgress = true;
                hooks.updateOffset(this, true);
                this._changeInProgress = null;
              }
            }
            return this;
          } else {
            return this._isUTC ? offset2 : getDateOffset(this);
          }
        }
        function getSetZone(input, keepLocalTime) {
          if (input != null) {
            if (typeof input !== "string") {
              input = -input;
            }
            this.utcOffset(input, keepLocalTime);
            return this;
          } else {
            return -this.utcOffset();
          }
        }
        function setOffsetToUTC(keepLocalTime) {
          return this.utcOffset(0, keepLocalTime);
        }
        function setOffsetToLocal(keepLocalTime) {
          if (this._isUTC) {
            this.utcOffset(0, keepLocalTime);
            this._isUTC = false;
            if (keepLocalTime) {
              this.subtract(getDateOffset(this), "m");
            }
          }
          return this;
        }
        function setOffsetToParsedOffset() {
          if (this._tzm != null) {
            this.utcOffset(this._tzm, false, true);
          } else if (typeof this._i === "string") {
            var tZone = offsetFromString(matchOffset, this._i);
            if (tZone != null) {
              this.utcOffset(tZone);
            } else {
              this.utcOffset(0, true);
            }
          }
          return this;
        }
        function hasAlignedHourOffset(input) {
          if (!this.isValid()) {
            return false;
          }
          input = input ? createLocal(input).utcOffset() : 0;
          return (this.utcOffset() - input) % 60 === 0;
        }
        function isDaylightSavingTime() {
          return this.utcOffset() > this.clone().month(0).utcOffset() || this.utcOffset() > this.clone().month(5).utcOffset();
        }
        function isDaylightSavingTimeShifted() {
          if (!isUndefined(this._isDSTShifted)) {
            return this._isDSTShifted;
          }
          var c = {}, other;
          copyConfig(c, this);
          c = prepareConfig(c);
          if (c._a) {
            other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
            this._isDSTShifted = this.isValid() && compareArrays(c._a, other.toArray()) > 0;
          } else {
            this._isDSTShifted = false;
          }
          return this._isDSTShifted;
        }
        function isLocal() {
          return this.isValid() ? !this._isUTC : false;
        }
        function isUtcOffset() {
          return this.isValid() ? this._isUTC : false;
        }
        function isUtc() {
          return this.isValid() ? this._isUTC && this._offset === 0 : false;
        }
        var aspNetRegex = /^(-|\+)?(?:(\d*)[. ])?(\d+):(\d+)(?::(\d+)(\.\d*)?)?$/, isoRegex = /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;
        function createDuration(input, key) {
          var duration = input, match = null, sign2, ret, diffRes;
          if (isDuration(input)) {
            duration = {
              ms: input._milliseconds,
              d: input._days,
              M: input._months
            };
          } else if (isNumber(input) || !isNaN(+input)) {
            duration = {};
            if (key) {
              duration[key] = +input;
            } else {
              duration.milliseconds = +input;
            }
          } else if (match = aspNetRegex.exec(input)) {
            sign2 = match[1] === "-" ? -1 : 1;
            duration = {
              y: 0,
              d: toInt(match[DATE]) * sign2,
              h: toInt(match[HOUR]) * sign2,
              m: toInt(match[MINUTE]) * sign2,
              s: toInt(match[SECOND]) * sign2,
              ms: toInt(absRound(match[MILLISECOND] * 1e3)) * sign2
              // the millisecond decimal point is included in the match
            };
          } else if (match = isoRegex.exec(input)) {
            sign2 = match[1] === "-" ? -1 : 1;
            duration = {
              y: parseIso(match[2], sign2),
              M: parseIso(match[3], sign2),
              w: parseIso(match[4], sign2),
              d: parseIso(match[5], sign2),
              h: parseIso(match[6], sign2),
              m: parseIso(match[7], sign2),
              s: parseIso(match[8], sign2)
            };
          } else if (duration == null) {
            duration = {};
          } else if (typeof duration === "object" && ("from" in duration || "to" in duration)) {
            diffRes = momentsDifference(
              createLocal(duration.from),
              createLocal(duration.to)
            );
            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
          }
          ret = new Duration(duration);
          if (isDuration(input) && hasOwnProp(input, "_locale")) {
            ret._locale = input._locale;
          }
          if (isDuration(input) && hasOwnProp(input, "_isValid")) {
            ret._isValid = input._isValid;
          }
          return ret;
        }
        createDuration.fn = Duration.prototype;
        createDuration.invalid = createInvalid$1;
        function parseIso(inp, sign2) {
          var res = inp && parseFloat(inp.replace(",", "."));
          return (isNaN(res) ? 0 : res) * sign2;
        }
        function positiveMomentsDifference(base, other) {
          var res = {};
          res.months = other.month() - base.month() + (other.year() - base.year()) * 12;
          if (base.clone().add(res.months, "M").isAfter(other)) {
            --res.months;
          }
          res.milliseconds = +other - +base.clone().add(res.months, "M");
          return res;
        }
        function momentsDifference(base, other) {
          var res;
          if (!(base.isValid() && other.isValid())) {
            return { milliseconds: 0, months: 0 };
          }
          other = cloneWithOffset(other, base);
          if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
          } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
          }
          return res;
        }
        function createAdder(direction, name) {
          return function(val, period) {
            var dur, tmp;
            if (period !== null && !isNaN(+period)) {
              deprecateSimple(
                name,
                "moment()." + name + "(period, number) is deprecated. Please use moment()." + name + "(number, period). See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info."
              );
              tmp = val;
              val = period;
              period = tmp;
            }
            dur = createDuration(val, period);
            addSubtract(this, dur, direction);
            return this;
          };
        }
        function addSubtract(mom, duration, isAdding, updateOffset) {
          var milliseconds2 = duration._milliseconds, days2 = absRound(duration._days), months2 = absRound(duration._months);
          if (!mom.isValid()) {
            return;
          }
          updateOffset = updateOffset == null ? true : updateOffset;
          if (months2) {
            setMonth(mom, get(mom, "Month") + months2 * isAdding);
          }
          if (days2) {
            set$1(mom, "Date", get(mom, "Date") + days2 * isAdding);
          }
          if (milliseconds2) {
            mom._d.setTime(mom._d.valueOf() + milliseconds2 * isAdding);
          }
          if (updateOffset) {
            hooks.updateOffset(mom, days2 || months2);
          }
        }
        var add = createAdder(1, "add"), subtract = createAdder(-1, "subtract");
        function isString(input) {
          return typeof input === "string" || input instanceof String;
        }
        function isMomentInput(input) {
          return isMoment(input) || isDate(input) || isString(input) || isNumber(input) || isNumberOrStringArray(input) || isMomentInputObject(input) || input === null || input === void 0;
        }
        function isMomentInputObject(input) {
          var objectTest = isObject(input) && !isObjectEmpty(input), propertyTest = false, properties = [
            "years",
            "year",
            "y",
            "months",
            "month",
            "M",
            "days",
            "day",
            "d",
            "dates",
            "date",
            "D",
            "hours",
            "hour",
            "h",
            "minutes",
            "minute",
            "m",
            "seconds",
            "second",
            "s",
            "milliseconds",
            "millisecond",
            "ms"
          ], i, property, propertyLen = properties.length;
          for (i = 0; i < propertyLen; i += 1) {
            property = properties[i];
            propertyTest = propertyTest || hasOwnProp(input, property);
          }
          return objectTest && propertyTest;
        }
        function isNumberOrStringArray(input) {
          var arrayTest = isArray(input), dataTypeTest = false;
          if (arrayTest) {
            dataTypeTest = input.filter(function(item) {
              return !isNumber(item) && isString(input);
            }).length === 0;
          }
          return arrayTest && dataTypeTest;
        }
        function isCalendarSpec(input) {
          var objectTest = isObject(input) && !isObjectEmpty(input), propertyTest = false, properties = [
            "sameDay",
            "nextDay",
            "lastDay",
            "nextWeek",
            "lastWeek",
            "sameElse"
          ], i, property;
          for (i = 0; i < properties.length; i += 1) {
            property = properties[i];
            propertyTest = propertyTest || hasOwnProp(input, property);
          }
          return objectTest && propertyTest;
        }
        function getCalendarFormat(myMoment, now2) {
          var diff2 = myMoment.diff(now2, "days", true);
          return diff2 < -6 ? "sameElse" : diff2 < -1 ? "lastWeek" : diff2 < 0 ? "lastDay" : diff2 < 1 ? "sameDay" : diff2 < 2 ? "nextDay" : diff2 < 7 ? "nextWeek" : "sameElse";
        }
        function calendar$1(time, formats) {
          if (arguments.length === 1) {
            if (!arguments[0]) {
              time = void 0;
              formats = void 0;
            } else if (isMomentInput(arguments[0])) {
              time = arguments[0];
              formats = void 0;
            } else if (isCalendarSpec(arguments[0])) {
              formats = arguments[0];
              time = void 0;
            }
          }
          var now2 = time || createLocal(), sod = cloneWithOffset(now2, this).startOf("day"), format2 = hooks.calendarFormat(this, sod) || "sameElse", output = formats && (isFunction(formats[format2]) ? formats[format2].call(this, now2) : formats[format2]);
          return this.format(
            output || this.localeData().calendar(format2, this, createLocal(now2))
          );
        }
        function clone() {
          return new Moment(this);
        }
        function isAfter(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() > localInput.valueOf();
          } else {
            return localInput.valueOf() < this.clone().startOf(units).valueOf();
          }
        }
        function isBefore(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input);
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() < localInput.valueOf();
          } else {
            return this.clone().endOf(units).valueOf() < localInput.valueOf();
          }
        }
        function isBetween(from2, to2, units, inclusivity) {
          var localFrom = isMoment(from2) ? from2 : createLocal(from2), localTo = isMoment(to2) ? to2 : createLocal(to2);
          if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
            return false;
          }
          inclusivity = inclusivity || "()";
          return (inclusivity[0] === "(" ? this.isAfter(localFrom, units) : !this.isBefore(localFrom, units)) && (inclusivity[1] === ")" ? this.isBefore(localTo, units) : !this.isAfter(localTo, units));
        }
        function isSame(input, units) {
          var localInput = isMoment(input) ? input : createLocal(input), inputMs;
          if (!(this.isValid() && localInput.isValid())) {
            return false;
          }
          units = normalizeUnits(units) || "millisecond";
          if (units === "millisecond") {
            return this.valueOf() === localInput.valueOf();
          } else {
            inputMs = localInput.valueOf();
            return this.clone().startOf(units).valueOf() <= inputMs && inputMs <= this.clone().endOf(units).valueOf();
          }
        }
        function isSameOrAfter(input, units) {
          return this.isSame(input, units) || this.isAfter(input, units);
        }
        function isSameOrBefore(input, units) {
          return this.isSame(input, units) || this.isBefore(input, units);
        }
        function diff(input, units, asFloat) {
          var that, zoneDelta, output;
          if (!this.isValid()) {
            return NaN;
          }
          that = cloneWithOffset(input, this);
          if (!that.isValid()) {
            return NaN;
          }
          zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;
          units = normalizeUnits(units);
          switch (units) {
            case "year":
              output = monthDiff(this, that) / 12;
              break;
            case "month":
              output = monthDiff(this, that);
              break;
            case "quarter":
              output = monthDiff(this, that) / 3;
              break;
            case "second":
              output = (this - that) / 1e3;
              break;
            case "minute":
              output = (this - that) / 6e4;
              break;
            case "hour":
              output = (this - that) / 36e5;
              break;
            case "day":
              output = (this - that - zoneDelta) / 864e5;
              break;
            case "week":
              output = (this - that - zoneDelta) / 6048e5;
              break;
            default:
              output = this - that;
          }
          return asFloat ? output : absFloor(output);
        }
        function monthDiff(a, b) {
          if (a.date() < b.date()) {
            return -monthDiff(b, a);
          }
          var wholeMonthDiff = (b.year() - a.year()) * 12 + (b.month() - a.month()), anchor = a.clone().add(wholeMonthDiff, "months"), anchor2, adjust;
          if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, "months");
            adjust = (b - anchor) / (anchor - anchor2);
          } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, "months");
            adjust = (b - anchor) / (anchor2 - anchor);
          }
          return -(wholeMonthDiff + adjust) || 0;
        }
        hooks.defaultFormat = "YYYY-MM-DDTHH:mm:ssZ";
        hooks.defaultFormatUtc = "YYYY-MM-DDTHH:mm:ss[Z]";
        function toString() {
          return this.clone().locale("en").format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        }
        function toISOString(keepOffset) {
          if (!this.isValid()) {
            return null;
          }
          var utc = keepOffset !== true, m = utc ? this.clone().utc() : this;
          if (m.year() < 0 || m.year() > 9999) {
            return formatMoment(
              m,
              utc ? "YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]" : "YYYYYY-MM-DD[T]HH:mm:ss.SSSZ"
            );
          }
          if (isFunction(Date.prototype.toISOString)) {
            if (utc) {
              return this.toDate().toISOString();
            } else {
              return new Date(this.valueOf() + this.utcOffset() * 60 * 1e3).toISOString().replace("Z", formatMoment(m, "Z"));
            }
          }
          return formatMoment(
            m,
            utc ? "YYYY-MM-DD[T]HH:mm:ss.SSS[Z]" : "YYYY-MM-DD[T]HH:mm:ss.SSSZ"
          );
        }
        function inspect() {
          if (!this.isValid()) {
            return "moment.invalid(/* " + this._i + " */)";
          }
          var func = "moment", zone = "", prefix, year, datetime, suffix;
          if (!this.isLocal()) {
            func = this.utcOffset() === 0 ? "moment.utc" : "moment.parseZone";
            zone = "Z";
          }
          prefix = "[" + func + '("]';
          year = 0 <= this.year() && this.year() <= 9999 ? "YYYY" : "YYYYYY";
          datetime = "-MM-DD[T]HH:mm:ss.SSS";
          suffix = zone + '[")]';
          return this.format(prefix + year + datetime + suffix);
        }
        function format(inputString) {
          if (!inputString) {
            inputString = this.isUtc() ? hooks.defaultFormatUtc : hooks.defaultFormat;
          }
          var output = formatMoment(this, inputString);
          return this.localeData().postformat(output);
        }
        function from(time, withoutSuffix) {
          if (this.isValid() && (isMoment(time) && time.isValid() || createLocal(time).isValid())) {
            return createDuration({ to: this, from: time }).locale(this.locale()).humanize(!withoutSuffix);
          } else {
            return this.localeData().invalidDate();
          }
        }
        function fromNow(withoutSuffix) {
          return this.from(createLocal(), withoutSuffix);
        }
        function to(time, withoutSuffix) {
          if (this.isValid() && (isMoment(time) && time.isValid() || createLocal(time).isValid())) {
            return createDuration({ from: this, to: time }).locale(this.locale()).humanize(!withoutSuffix);
          } else {
            return this.localeData().invalidDate();
          }
        }
        function toNow(withoutSuffix) {
          return this.to(createLocal(), withoutSuffix);
        }
        function locale(key) {
          var newLocaleData;
          if (key === void 0) {
            return this._locale._abbr;
          } else {
            newLocaleData = getLocale(key);
            if (newLocaleData != null) {
              this._locale = newLocaleData;
            }
            return this;
          }
        }
        var lang = deprecate(
          "moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.",
          function(key) {
            if (key === void 0) {
              return this.localeData();
            } else {
              return this.locale(key);
            }
          }
        );
        function localeData() {
          return this._locale;
        }
        var MS_PER_SECOND = 1e3, MS_PER_MINUTE = 60 * MS_PER_SECOND, MS_PER_HOUR = 60 * MS_PER_MINUTE, MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;
        function mod$1(dividend, divisor) {
          return (dividend % divisor + divisor) % divisor;
        }
        function localStartOfDate(y, m, d) {
          if (y < 100 && y >= 0) {
            return new Date(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
            return new Date(y, m, d).valueOf();
          }
        }
        function utcStartOfDate(y, m, d) {
          if (y < 100 && y >= 0) {
            return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
          } else {
            return Date.UTC(y, m, d);
          }
        }
        function startOf(units) {
          var time, startOfDate;
          units = normalizeUnits(units);
          if (units === void 0 || units === "millisecond" || !this.isValid()) {
            return this;
          }
          startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;
          switch (units) {
            case "year":
              time = startOfDate(this.year(), 0, 1);
              break;
            case "quarter":
              time = startOfDate(
                this.year(),
                this.month() - this.month() % 3,
                1
              );
              break;
            case "month":
              time = startOfDate(this.year(), this.month(), 1);
              break;
            case "week":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - this.weekday()
              );
              break;
            case "isoWeek":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - (this.isoWeekday() - 1)
              );
              break;
            case "day":
            case "date":
              time = startOfDate(this.year(), this.month(), this.date());
              break;
            case "hour":
              time = this._d.valueOf();
              time -= mod$1(
                time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                MS_PER_HOUR
              );
              break;
            case "minute":
              time = this._d.valueOf();
              time -= mod$1(time, MS_PER_MINUTE);
              break;
            case "second":
              time = this._d.valueOf();
              time -= mod$1(time, MS_PER_SECOND);
              break;
          }
          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
        }
        function endOf(units) {
          var time, startOfDate;
          units = normalizeUnits(units);
          if (units === void 0 || units === "millisecond" || !this.isValid()) {
            return this;
          }
          startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;
          switch (units) {
            case "year":
              time = startOfDate(this.year() + 1, 0, 1) - 1;
              break;
            case "quarter":
              time = startOfDate(
                this.year(),
                this.month() - this.month() % 3 + 3,
                1
              ) - 1;
              break;
            case "month":
              time = startOfDate(this.year(), this.month() + 1, 1) - 1;
              break;
            case "week":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - this.weekday() + 7
              ) - 1;
              break;
            case "isoWeek":
              time = startOfDate(
                this.year(),
                this.month(),
                this.date() - (this.isoWeekday() - 1) + 7
              ) - 1;
              break;
            case "day":
            case "date":
              time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
              break;
            case "hour":
              time = this._d.valueOf();
              time += MS_PER_HOUR - mod$1(
                time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                MS_PER_HOUR
              ) - 1;
              break;
            case "minute":
              time = this._d.valueOf();
              time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
              break;
            case "second":
              time = this._d.valueOf();
              time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
              break;
          }
          this._d.setTime(time);
          hooks.updateOffset(this, true);
          return this;
        }
        function valueOf() {
          return this._d.valueOf() - (this._offset || 0) * 6e4;
        }
        function unix() {
          return Math.floor(this.valueOf() / 1e3);
        }
        function toDate() {
          return new Date(this.valueOf());
        }
        function toArray() {
          var m = this;
          return [
            m.year(),
            m.month(),
            m.date(),
            m.hour(),
            m.minute(),
            m.second(),
            m.millisecond()
          ];
        }
        function toObject() {
          var m = this;
          return {
            years: m.year(),
            months: m.month(),
            date: m.date(),
            hours: m.hours(),
            minutes: m.minutes(),
            seconds: m.seconds(),
            milliseconds: m.milliseconds()
          };
        }
        function toJSON() {
          return this.isValid() ? this.toISOString() : null;
        }
        function isValid$2() {
          return isValid(this);
        }
        function parsingFlags() {
          return extend({}, getParsingFlags(this));
        }
        function invalidAt() {
          return getParsingFlags(this).overflow;
        }
        function creationData() {
          return {
            input: this._i,
            format: this._f,
            locale: this._locale,
            isUTC: this._isUTC,
            strict: this._strict
          };
        }
        addFormatToken("N", 0, 0, "eraAbbr");
        addFormatToken("NN", 0, 0, "eraAbbr");
        addFormatToken("NNN", 0, 0, "eraAbbr");
        addFormatToken("NNNN", 0, 0, "eraName");
        addFormatToken("NNNNN", 0, 0, "eraNarrow");
        addFormatToken("y", ["y", 1], "yo", "eraYear");
        addFormatToken("y", ["yy", 2], 0, "eraYear");
        addFormatToken("y", ["yyy", 3], 0, "eraYear");
        addFormatToken("y", ["yyyy", 4], 0, "eraYear");
        addRegexToken("N", matchEraAbbr);
        addRegexToken("NN", matchEraAbbr);
        addRegexToken("NNN", matchEraAbbr);
        addRegexToken("NNNN", matchEraName);
        addRegexToken("NNNNN", matchEraNarrow);
        addParseToken(
          ["N", "NN", "NNN", "NNNN", "NNNNN"],
          function(input, array, config, token2) {
            var era = config._locale.erasParse(input, token2, config._strict);
            if (era) {
              getParsingFlags(config).era = era;
            } else {
              getParsingFlags(config).invalidEra = input;
            }
          }
        );
        addRegexToken("y", matchUnsigned);
        addRegexToken("yy", matchUnsigned);
        addRegexToken("yyy", matchUnsigned);
        addRegexToken("yyyy", matchUnsigned);
        addRegexToken("yo", matchEraYearOrdinal);
        addParseToken(["y", "yy", "yyy", "yyyy"], YEAR);
        addParseToken(["yo"], function(input, array, config, token2) {
          var match;
          if (config._locale._eraYearOrdinalRegex) {
            match = input.match(config._locale._eraYearOrdinalRegex);
          }
          if (config._locale.eraYearOrdinalParse) {
            array[YEAR] = config._locale.eraYearOrdinalParse(input, match);
          } else {
            array[YEAR] = parseInt(input, 10);
          }
        });
        function localeEras(m, format2) {
          var i, l, date, eras = this._eras || getLocale("en")._eras;
          for (i = 0, l = eras.length; i < l; ++i) {
            switch (typeof eras[i].since) {
              case "string":
                date = hooks(eras[i].since).startOf("day");
                eras[i].since = date.valueOf();
                break;
            }
            switch (typeof eras[i].until) {
              case "undefined":
                eras[i].until = Infinity;
                break;
              case "string":
                date = hooks(eras[i].until).startOf("day").valueOf();
                eras[i].until = date.valueOf();
                break;
            }
          }
          return eras;
        }
        function localeErasParse(eraName, format2, strict) {
          var i, l, eras = this.eras(), name, abbr, narrow;
          eraName = eraName.toUpperCase();
          for (i = 0, l = eras.length; i < l; ++i) {
            name = eras[i].name.toUpperCase();
            abbr = eras[i].abbr.toUpperCase();
            narrow = eras[i].narrow.toUpperCase();
            if (strict) {
              switch (format2) {
                case "N":
                case "NN":
                case "NNN":
                  if (abbr === eraName) {
                    return eras[i];
                  }
                  break;
                case "NNNN":
                  if (name === eraName) {
                    return eras[i];
                  }
                  break;
                case "NNNNN":
                  if (narrow === eraName) {
                    return eras[i];
                  }
                  break;
              }
            } else if ([name, abbr, narrow].indexOf(eraName) >= 0) {
              return eras[i];
            }
          }
        }
        function localeErasConvertYear(era, year) {
          var dir = era.since <= era.until ? 1 : -1;
          if (year === void 0) {
            return hooks(era.since).year();
          } else {
            return hooks(era.since).year() + (year - era.offset) * dir;
          }
        }
        function getEraName() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].name;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].name;
            }
          }
          return "";
        }
        function getEraNarrow() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].narrow;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].narrow;
            }
          }
          return "";
        }
        function getEraAbbr() {
          var i, l, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until) {
              return eras[i].abbr;
            }
            if (eras[i].until <= val && val <= eras[i].since) {
              return eras[i].abbr;
            }
          }
          return "";
        }
        function getEraYear() {
          var i, l, dir, val, eras = this.localeData().eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            dir = eras[i].since <= eras[i].until ? 1 : -1;
            val = this.clone().startOf("day").valueOf();
            if (eras[i].since <= val && val <= eras[i].until || eras[i].until <= val && val <= eras[i].since) {
              return (this.year() - hooks(eras[i].since).year()) * dir + eras[i].offset;
            }
          }
          return this.year();
        }
        function erasNameRegex(isStrict) {
          if (!hasOwnProp(this, "_erasNameRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasNameRegex : this._erasRegex;
        }
        function erasAbbrRegex(isStrict) {
          if (!hasOwnProp(this, "_erasAbbrRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasAbbrRegex : this._erasRegex;
        }
        function erasNarrowRegex(isStrict) {
          if (!hasOwnProp(this, "_erasNarrowRegex")) {
            computeErasParse.call(this);
          }
          return isStrict ? this._erasNarrowRegex : this._erasRegex;
        }
        function matchEraAbbr(isStrict, locale2) {
          return locale2.erasAbbrRegex(isStrict);
        }
        function matchEraName(isStrict, locale2) {
          return locale2.erasNameRegex(isStrict);
        }
        function matchEraNarrow(isStrict, locale2) {
          return locale2.erasNarrowRegex(isStrict);
        }
        function matchEraYearOrdinal(isStrict, locale2) {
          return locale2._eraYearOrdinalRegex || matchUnsigned;
        }
        function computeErasParse() {
          var abbrPieces = [], namePieces = [], narrowPieces = [], mixedPieces = [], i, l, erasName, erasAbbr, erasNarrow, eras = this.eras();
          for (i = 0, l = eras.length; i < l; ++i) {
            erasName = regexEscape(eras[i].name);
            erasAbbr = regexEscape(eras[i].abbr);
            erasNarrow = regexEscape(eras[i].narrow);
            namePieces.push(erasName);
            abbrPieces.push(erasAbbr);
            narrowPieces.push(erasNarrow);
            mixedPieces.push(erasName);
            mixedPieces.push(erasAbbr);
            mixedPieces.push(erasNarrow);
          }
          this._erasRegex = new RegExp("^(" + mixedPieces.join("|") + ")", "i");
          this._erasNameRegex = new RegExp("^(" + namePieces.join("|") + ")", "i");
          this._erasAbbrRegex = new RegExp("^(" + abbrPieces.join("|") + ")", "i");
          this._erasNarrowRegex = new RegExp(
            "^(" + narrowPieces.join("|") + ")",
            "i"
          );
        }
        addFormatToken(0, ["gg", 2], 0, function() {
          return this.weekYear() % 100;
        });
        addFormatToken(0, ["GG", 2], 0, function() {
          return this.isoWeekYear() % 100;
        });
        function addWeekYearFormatToken(token2, getter) {
          addFormatToken(0, [token2, token2.length], 0, getter);
        }
        addWeekYearFormatToken("gggg", "weekYear");
        addWeekYearFormatToken("ggggg", "weekYear");
        addWeekYearFormatToken("GGGG", "isoWeekYear");
        addWeekYearFormatToken("GGGGG", "isoWeekYear");
        addRegexToken("G", matchSigned);
        addRegexToken("g", matchSigned);
        addRegexToken("GG", match1to2, match2);
        addRegexToken("gg", match1to2, match2);
        addRegexToken("GGGG", match1to4, match4);
        addRegexToken("gggg", match1to4, match4);
        addRegexToken("GGGGG", match1to6, match6);
        addRegexToken("ggggg", match1to6, match6);
        addWeekParseToken(
          ["gggg", "ggggg", "GGGG", "GGGGG"],
          function(input, week, config, token2) {
            week[token2.substr(0, 2)] = toInt(input);
          }
        );
        addWeekParseToken(["gg", "GG"], function(input, week, config, token2) {
          week[token2] = hooks.parseTwoDigitYear(input);
        });
        function getSetWeekYear(input) {
          return getSetWeekYearHelper.call(
            this,
            input,
            this.week(),
            this.weekday() + this.localeData()._week.dow,
            this.localeData()._week.dow,
            this.localeData()._week.doy
          );
        }
        function getSetISOWeekYear(input) {
          return getSetWeekYearHelper.call(
            this,
            input,
            this.isoWeek(),
            this.isoWeekday(),
            1,
            4
          );
        }
        function getISOWeeksInYear() {
          return weeksInYear(this.year(), 1, 4);
        }
        function getISOWeeksInISOWeekYear() {
          return weeksInYear(this.isoWeekYear(), 1, 4);
        }
        function getWeeksInYear() {
          var weekInfo = this.localeData()._week;
          return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        }
        function getWeeksInWeekYear() {
          var weekInfo = this.localeData()._week;
          return weeksInYear(this.weekYear(), weekInfo.dow, weekInfo.doy);
        }
        function getSetWeekYearHelper(input, week, weekday, dow, doy) {
          var weeksTarget;
          if (input == null) {
            return weekOfYear(this, dow, doy).year;
          } else {
            weeksTarget = weeksInYear(input, dow, doy);
            if (week > weeksTarget) {
              week = weeksTarget;
            }
            return setWeekAll.call(this, input, week, weekday, dow, doy);
          }
        }
        function setWeekAll(weekYear, week, weekday, dow, doy) {
          var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy), date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);
          this.year(date.getUTCFullYear());
          this.month(date.getUTCMonth());
          this.date(date.getUTCDate());
          return this;
        }
        addFormatToken("Q", 0, "Qo", "quarter");
        addRegexToken("Q", match1);
        addParseToken("Q", function(input, array) {
          array[MONTH] = (toInt(input) - 1) * 3;
        });
        function getSetQuarter(input) {
          return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        }
        addFormatToken("D", ["DD", 2], "Do", "date");
        addRegexToken("D", match1to2, match1to2NoLeadingZero);
        addRegexToken("DD", match1to2, match2);
        addRegexToken("Do", function(isStrict, locale2) {
          return isStrict ? locale2._dayOfMonthOrdinalParse || locale2._ordinalParse : locale2._dayOfMonthOrdinalParseLenient;
        });
        addParseToken(["D", "DD"], DATE);
        addParseToken("Do", function(input, array) {
          array[DATE] = toInt(input.match(match1to2)[0]);
        });
        var getSetDayOfMonth = makeGetSet("Date", true);
        addFormatToken("DDD", ["DDDD", 3], "DDDo", "dayOfYear");
        addRegexToken("DDD", match1to3);
        addRegexToken("DDDD", match3);
        addParseToken(["DDD", "DDDD"], function(input, array, config) {
          config._dayOfYear = toInt(input);
        });
        function getSetDayOfYear(input) {
          var dayOfYear = Math.round(
            (this.clone().startOf("day") - this.clone().startOf("year")) / 864e5
          ) + 1;
          return input == null ? dayOfYear : this.add(input - dayOfYear, "d");
        }
        addFormatToken("m", ["mm", 2], 0, "minute");
        addRegexToken("m", match1to2, match1to2HasZero);
        addRegexToken("mm", match1to2, match2);
        addParseToken(["m", "mm"], MINUTE);
        var getSetMinute = makeGetSet("Minutes", false);
        addFormatToken("s", ["ss", 2], 0, "second");
        addRegexToken("s", match1to2, match1to2HasZero);
        addRegexToken("ss", match1to2, match2);
        addParseToken(["s", "ss"], SECOND);
        var getSetSecond = makeGetSet("Seconds", false);
        addFormatToken("S", 0, 0, function() {
          return ~~(this.millisecond() / 100);
        });
        addFormatToken(0, ["SS", 2], 0, function() {
          return ~~(this.millisecond() / 10);
        });
        addFormatToken(0, ["SSS", 3], 0, "millisecond");
        addFormatToken(0, ["SSSS", 4], 0, function() {
          return this.millisecond() * 10;
        });
        addFormatToken(0, ["SSSSS", 5], 0, function() {
          return this.millisecond() * 100;
        });
        addFormatToken(0, ["SSSSSS", 6], 0, function() {
          return this.millisecond() * 1e3;
        });
        addFormatToken(0, ["SSSSSSS", 7], 0, function() {
          return this.millisecond() * 1e4;
        });
        addFormatToken(0, ["SSSSSSSS", 8], 0, function() {
          return this.millisecond() * 1e5;
        });
        addFormatToken(0, ["SSSSSSSSS", 9], 0, function() {
          return this.millisecond() * 1e6;
        });
        addRegexToken("S", match1to3, match1);
        addRegexToken("SS", match1to3, match2);
        addRegexToken("SSS", match1to3, match3);
        var token, getSetMillisecond;
        for (token = "SSSS"; token.length <= 9; token += "S") {
          addRegexToken(token, matchUnsigned);
        }
        function parseMs(input, array) {
          array[MILLISECOND] = toInt(("0." + input) * 1e3);
        }
        for (token = "S"; token.length <= 9; token += "S") {
          addParseToken(token, parseMs);
        }
        getSetMillisecond = makeGetSet("Milliseconds", false);
        addFormatToken("z", 0, 0, "zoneAbbr");
        addFormatToken("zz", 0, 0, "zoneName");
        function getZoneAbbr() {
          return this._isUTC ? "UTC" : "";
        }
        function getZoneName() {
          return this._isUTC ? "Coordinated Universal Time" : "";
        }
        var proto = Moment.prototype;
        proto.add = add;
        proto.calendar = calendar$1;
        proto.clone = clone;
        proto.diff = diff;
        proto.endOf = endOf;
        proto.format = format;
        proto.from = from;
        proto.fromNow = fromNow;
        proto.to = to;
        proto.toNow = toNow;
        proto.get = stringGet;
        proto.invalidAt = invalidAt;
        proto.isAfter = isAfter;
        proto.isBefore = isBefore;
        proto.isBetween = isBetween;
        proto.isSame = isSame;
        proto.isSameOrAfter = isSameOrAfter;
        proto.isSameOrBefore = isSameOrBefore;
        proto.isValid = isValid$2;
        proto.lang = lang;
        proto.locale = locale;
        proto.localeData = localeData;
        proto.max = prototypeMax;
        proto.min = prototypeMin;
        proto.parsingFlags = parsingFlags;
        proto.set = stringSet;
        proto.startOf = startOf;
        proto.subtract = subtract;
        proto.toArray = toArray;
        proto.toObject = toObject;
        proto.toDate = toDate;
        proto.toISOString = toISOString;
        proto.inspect = inspect;
        if (typeof Symbol !== "undefined" && Symbol.for != null) {
          proto[Symbol.for("nodejs.util.inspect.custom")] = function() {
            return "Moment<" + this.format() + ">";
          };
        }
        proto.toJSON = toJSON;
        proto.toString = toString;
        proto.unix = unix;
        proto.valueOf = valueOf;
        proto.creationData = creationData;
        proto.eraName = getEraName;
        proto.eraNarrow = getEraNarrow;
        proto.eraAbbr = getEraAbbr;
        proto.eraYear = getEraYear;
        proto.year = getSetYear;
        proto.isLeapYear = getIsLeapYear;
        proto.weekYear = getSetWeekYear;
        proto.isoWeekYear = getSetISOWeekYear;
        proto.quarter = proto.quarters = getSetQuarter;
        proto.month = getSetMonth;
        proto.daysInMonth = getDaysInMonth;
        proto.week = proto.weeks = getSetWeek;
        proto.isoWeek = proto.isoWeeks = getSetISOWeek;
        proto.weeksInYear = getWeeksInYear;
        proto.weeksInWeekYear = getWeeksInWeekYear;
        proto.isoWeeksInYear = getISOWeeksInYear;
        proto.isoWeeksInISOWeekYear = getISOWeeksInISOWeekYear;
        proto.date = getSetDayOfMonth;
        proto.day = proto.days = getSetDayOfWeek;
        proto.weekday = getSetLocaleDayOfWeek;
        proto.isoWeekday = getSetISODayOfWeek;
        proto.dayOfYear = getSetDayOfYear;
        proto.hour = proto.hours = getSetHour;
        proto.minute = proto.minutes = getSetMinute;
        proto.second = proto.seconds = getSetSecond;
        proto.millisecond = proto.milliseconds = getSetMillisecond;
        proto.utcOffset = getSetOffset;
        proto.utc = setOffsetToUTC;
        proto.local = setOffsetToLocal;
        proto.parseZone = setOffsetToParsedOffset;
        proto.hasAlignedHourOffset = hasAlignedHourOffset;
        proto.isDST = isDaylightSavingTime;
        proto.isLocal = isLocal;
        proto.isUtcOffset = isUtcOffset;
        proto.isUtc = isUtc;
        proto.isUTC = isUtc;
        proto.zoneAbbr = getZoneAbbr;
        proto.zoneName = getZoneName;
        proto.dates = deprecate(
          "dates accessor is deprecated. Use date instead.",
          getSetDayOfMonth
        );
        proto.months = deprecate(
          "months accessor is deprecated. Use month instead",
          getSetMonth
        );
        proto.years = deprecate(
          "years accessor is deprecated. Use year instead",
          getSetYear
        );
        proto.zone = deprecate(
          "moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/",
          getSetZone
        );
        proto.isDSTShifted = deprecate(
          "isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information",
          isDaylightSavingTimeShifted
        );
        function createUnix(input) {
          return createLocal(input * 1e3);
        }
        function createInZone() {
          return createLocal.apply(null, arguments).parseZone();
        }
        function preParsePostFormat(string) {
          return string;
        }
        var proto$1 = Locale.prototype;
        proto$1.calendar = calendar;
        proto$1.longDateFormat = longDateFormat;
        proto$1.invalidDate = invalidDate;
        proto$1.ordinal = ordinal;
        proto$1.preparse = preParsePostFormat;
        proto$1.postformat = preParsePostFormat;
        proto$1.relativeTime = relativeTime;
        proto$1.pastFuture = pastFuture;
        proto$1.set = set;
        proto$1.eras = localeEras;
        proto$1.erasParse = localeErasParse;
        proto$1.erasConvertYear = localeErasConvertYear;
        proto$1.erasAbbrRegex = erasAbbrRegex;
        proto$1.erasNameRegex = erasNameRegex;
        proto$1.erasNarrowRegex = erasNarrowRegex;
        proto$1.months = localeMonths;
        proto$1.monthsShort = localeMonthsShort;
        proto$1.monthsParse = localeMonthsParse;
        proto$1.monthsRegex = monthsRegex;
        proto$1.monthsShortRegex = monthsShortRegex;
        proto$1.week = localeWeek;
        proto$1.firstDayOfYear = localeFirstDayOfYear;
        proto$1.firstDayOfWeek = localeFirstDayOfWeek;
        proto$1.weekdays = localeWeekdays;
        proto$1.weekdaysMin = localeWeekdaysMin;
        proto$1.weekdaysShort = localeWeekdaysShort;
        proto$1.weekdaysParse = localeWeekdaysParse;
        proto$1.weekdaysRegex = weekdaysRegex;
        proto$1.weekdaysShortRegex = weekdaysShortRegex;
        proto$1.weekdaysMinRegex = weekdaysMinRegex;
        proto$1.isPM = localeIsPM;
        proto$1.meridiem = localeMeridiem;
        function get$1(format2, index, field, setter) {
          var locale2 = getLocale(), utc = createUTC().set(setter, index);
          return locale2[field](utc, format2);
        }
        function listMonthsImpl(format2, index, field) {
          if (isNumber(format2)) {
            index = format2;
            format2 = void 0;
          }
          format2 = format2 || "";
          if (index != null) {
            return get$1(format2, index, field, "month");
          }
          var i, out = [];
          for (i = 0; i < 12; i++) {
            out[i] = get$1(format2, i, field, "month");
          }
          return out;
        }
        function listWeekdaysImpl(localeSorted, format2, index, field) {
          if (typeof localeSorted === "boolean") {
            if (isNumber(format2)) {
              index = format2;
              format2 = void 0;
            }
            format2 = format2 || "";
          } else {
            format2 = localeSorted;
            index = format2;
            localeSorted = false;
            if (isNumber(format2)) {
              index = format2;
              format2 = void 0;
            }
            format2 = format2 || "";
          }
          var locale2 = getLocale(), shift = localeSorted ? locale2._week.dow : 0, i, out = [];
          if (index != null) {
            return get$1(format2, (index + shift) % 7, field, "day");
          }
          for (i = 0; i < 7; i++) {
            out[i] = get$1(format2, (i + shift) % 7, field, "day");
          }
          return out;
        }
        function listMonths(format2, index) {
          return listMonthsImpl(format2, index, "months");
        }
        function listMonthsShort(format2, index) {
          return listMonthsImpl(format2, index, "monthsShort");
        }
        function listWeekdays(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdays");
        }
        function listWeekdaysShort(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdaysShort");
        }
        function listWeekdaysMin(localeSorted, format2, index) {
          return listWeekdaysImpl(localeSorted, format2, index, "weekdaysMin");
        }
        getSetGlobalLocale("en", {
          eras: [
            {
              since: "0001-01-01",
              until: Infinity,
              offset: 1,
              name: "Anno Domini",
              narrow: "AD",
              abbr: "AD"
            },
            {
              since: "0000-12-31",
              until: -Infinity,
              offset: 1,
              name: "Before Christ",
              narrow: "BC",
              abbr: "BC"
            }
          ],
          dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
          ordinal: function(number) {
            var b = number % 10, output = toInt(number % 100 / 10) === 1 ? "th" : b === 1 ? "st" : b === 2 ? "nd" : b === 3 ? "rd" : "th";
            return number + output;
          }
        });
        hooks.lang = deprecate(
          "moment.lang is deprecated. Use moment.locale instead.",
          getSetGlobalLocale
        );
        hooks.langData = deprecate(
          "moment.langData is deprecated. Use moment.localeData instead.",
          getLocale
        );
        var mathAbs = Math.abs;
        function abs() {
          var data = this._data;
          this._milliseconds = mathAbs(this._milliseconds);
          this._days = mathAbs(this._days);
          this._months = mathAbs(this._months);
          data.milliseconds = mathAbs(data.milliseconds);
          data.seconds = mathAbs(data.seconds);
          data.minutes = mathAbs(data.minutes);
          data.hours = mathAbs(data.hours);
          data.months = mathAbs(data.months);
          data.years = mathAbs(data.years);
          return this;
        }
        function addSubtract$1(duration, input, value, direction) {
          var other = createDuration(input, value);
          duration._milliseconds += direction * other._milliseconds;
          duration._days += direction * other._days;
          duration._months += direction * other._months;
          return duration._bubble();
        }
        function add$1(input, value) {
          return addSubtract$1(this, input, value, 1);
        }
        function subtract$1(input, value) {
          return addSubtract$1(this, input, value, -1);
        }
        function absCeil(number) {
          if (number < 0) {
            return Math.floor(number);
          } else {
            return Math.ceil(number);
          }
        }
        function bubble() {
          var milliseconds2 = this._milliseconds, days2 = this._days, months2 = this._months, data = this._data, seconds2, minutes2, hours2, years2, monthsFromDays;
          if (!(milliseconds2 >= 0 && days2 >= 0 && months2 >= 0 || milliseconds2 <= 0 && days2 <= 0 && months2 <= 0)) {
            milliseconds2 += absCeil(monthsToDays(months2) + days2) * 864e5;
            days2 = 0;
            months2 = 0;
          }
          data.milliseconds = milliseconds2 % 1e3;
          seconds2 = absFloor(milliseconds2 / 1e3);
          data.seconds = seconds2 % 60;
          minutes2 = absFloor(seconds2 / 60);
          data.minutes = minutes2 % 60;
          hours2 = absFloor(minutes2 / 60);
          data.hours = hours2 % 24;
          days2 += absFloor(hours2 / 24);
          monthsFromDays = absFloor(daysToMonths(days2));
          months2 += monthsFromDays;
          days2 -= absCeil(monthsToDays(monthsFromDays));
          years2 = absFloor(months2 / 12);
          months2 %= 12;
          data.days = days2;
          data.months = months2;
          data.years = years2;
          return this;
        }
        function daysToMonths(days2) {
          return days2 * 4800 / 146097;
        }
        function monthsToDays(months2) {
          return months2 * 146097 / 4800;
        }
        function as(units) {
          if (!this.isValid()) {
            return NaN;
          }
          var days2, months2, milliseconds2 = this._milliseconds;
          units = normalizeUnits(units);
          if (units === "month" || units === "quarter" || units === "year") {
            days2 = this._days + milliseconds2 / 864e5;
            months2 = this._months + daysToMonths(days2);
            switch (units) {
              case "month":
                return months2;
              case "quarter":
                return months2 / 3;
              case "year":
                return months2 / 12;
            }
          } else {
            days2 = this._days + Math.round(monthsToDays(this._months));
            switch (units) {
              case "week":
                return days2 / 7 + milliseconds2 / 6048e5;
              case "day":
                return days2 + milliseconds2 / 864e5;
              case "hour":
                return days2 * 24 + milliseconds2 / 36e5;
              case "minute":
                return days2 * 1440 + milliseconds2 / 6e4;
              case "second":
                return days2 * 86400 + milliseconds2 / 1e3;
              case "millisecond":
                return Math.floor(days2 * 864e5) + milliseconds2;
              default:
                throw new Error("Unknown unit " + units);
            }
          }
        }
        function makeAs(alias) {
          return function() {
            return this.as(alias);
          };
        }
        var asMilliseconds = makeAs("ms"), asSeconds = makeAs("s"), asMinutes = makeAs("m"), asHours = makeAs("h"), asDays = makeAs("d"), asWeeks = makeAs("w"), asMonths = makeAs("M"), asQuarters = makeAs("Q"), asYears = makeAs("y"), valueOf$1 = asMilliseconds;
        function clone$1() {
          return createDuration(this);
        }
        function get$2(units) {
          units = normalizeUnits(units);
          return this.isValid() ? this[units + "s"]() : NaN;
        }
        function makeGetter(name) {
          return function() {
            return this.isValid() ? this._data[name] : NaN;
          };
        }
        var milliseconds = makeGetter("milliseconds"), seconds = makeGetter("seconds"), minutes = makeGetter("minutes"), hours = makeGetter("hours"), days = makeGetter("days"), months = makeGetter("months"), years = makeGetter("years");
        function weeks() {
          return absFloor(this.days() / 7);
        }
        var round = Math.round, thresholds = {
          ss: 44,
          // a few seconds to seconds
          s: 45,
          // seconds to minute
          m: 45,
          // minutes to hour
          h: 22,
          // hours to day
          d: 26,
          // days to month/week
          w: null,
          // weeks to month
          M: 11
          // months to year
        };
        function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale2) {
          return locale2.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
        }
        function relativeTime$1(posNegDuration, withoutSuffix, thresholds2, locale2) {
          var duration = createDuration(posNegDuration).abs(), seconds2 = round(duration.as("s")), minutes2 = round(duration.as("m")), hours2 = round(duration.as("h")), days2 = round(duration.as("d")), months2 = round(duration.as("M")), weeks2 = round(duration.as("w")), years2 = round(duration.as("y")), a = seconds2 <= thresholds2.ss && ["s", seconds2] || seconds2 < thresholds2.s && ["ss", seconds2] || minutes2 <= 1 && ["m"] || minutes2 < thresholds2.m && ["mm", minutes2] || hours2 <= 1 && ["h"] || hours2 < thresholds2.h && ["hh", hours2] || days2 <= 1 && ["d"] || days2 < thresholds2.d && ["dd", days2];
          if (thresholds2.w != null) {
            a = a || weeks2 <= 1 && ["w"] || weeks2 < thresholds2.w && ["ww", weeks2];
          }
          a = a || months2 <= 1 && ["M"] || months2 < thresholds2.M && ["MM", months2] || years2 <= 1 && ["y"] || ["yy", years2];
          a[2] = withoutSuffix;
          a[3] = +posNegDuration > 0;
          a[4] = locale2;
          return substituteTimeAgo.apply(null, a);
        }
        function getSetRelativeTimeRounding(roundingFunction) {
          if (roundingFunction === void 0) {
            return round;
          }
          if (typeof roundingFunction === "function") {
            round = roundingFunction;
            return true;
          }
          return false;
        }
        function getSetRelativeTimeThreshold(threshold, limit) {
          if (thresholds[threshold] === void 0) {
            return false;
          }
          if (limit === void 0) {
            return thresholds[threshold];
          }
          thresholds[threshold] = limit;
          if (threshold === "s") {
            thresholds.ss = limit - 1;
          }
          return true;
        }
        function humanize(argWithSuffix, argThresholds) {
          if (!this.isValid()) {
            return this.localeData().invalidDate();
          }
          var withSuffix = false, th = thresholds, locale2, output;
          if (typeof argWithSuffix === "object") {
            argThresholds = argWithSuffix;
            argWithSuffix = false;
          }
          if (typeof argWithSuffix === "boolean") {
            withSuffix = argWithSuffix;
          }
          if (typeof argThresholds === "object") {
            th = Object.assign({}, thresholds, argThresholds);
            if (argThresholds.s != null && argThresholds.ss == null) {
              th.ss = argThresholds.s - 1;
            }
          }
          locale2 = this.localeData();
          output = relativeTime$1(this, !withSuffix, th, locale2);
          if (withSuffix) {
            output = locale2.pastFuture(+this, output);
          }
          return locale2.postformat(output);
        }
        var abs$1 = Math.abs;
        function sign(x) {
          return (x > 0) - (x < 0) || +x;
        }
        function toISOString$1() {
          if (!this.isValid()) {
            return this.localeData().invalidDate();
          }
          var seconds2 = abs$1(this._milliseconds) / 1e3, days2 = abs$1(this._days), months2 = abs$1(this._months), minutes2, hours2, years2, s, total = this.asSeconds(), totalSign, ymSign, daysSign, hmsSign;
          if (!total) {
            return "P0D";
          }
          minutes2 = absFloor(seconds2 / 60);
          hours2 = absFloor(minutes2 / 60);
          seconds2 %= 60;
          minutes2 %= 60;
          years2 = absFloor(months2 / 12);
          months2 %= 12;
          s = seconds2 ? seconds2.toFixed(3).replace(/\.?0+$/, "") : "";
          totalSign = total < 0 ? "-" : "";
          ymSign = sign(this._months) !== sign(total) ? "-" : "";
          daysSign = sign(this._days) !== sign(total) ? "-" : "";
          hmsSign = sign(this._milliseconds) !== sign(total) ? "-" : "";
          return totalSign + "P" + (years2 ? ymSign + years2 + "Y" : "") + (months2 ? ymSign + months2 + "M" : "") + (days2 ? daysSign + days2 + "D" : "") + (hours2 || minutes2 || seconds2 ? "T" : "") + (hours2 ? hmsSign + hours2 + "H" : "") + (minutes2 ? hmsSign + minutes2 + "M" : "") + (seconds2 ? hmsSign + s + "S" : "");
        }
        var proto$2 = Duration.prototype;
        proto$2.isValid = isValid$1;
        proto$2.abs = abs;
        proto$2.add = add$1;
        proto$2.subtract = subtract$1;
        proto$2.as = as;
        proto$2.asMilliseconds = asMilliseconds;
        proto$2.asSeconds = asSeconds;
        proto$2.asMinutes = asMinutes;
        proto$2.asHours = asHours;
        proto$2.asDays = asDays;
        proto$2.asWeeks = asWeeks;
        proto$2.asMonths = asMonths;
        proto$2.asQuarters = asQuarters;
        proto$2.asYears = asYears;
        proto$2.valueOf = valueOf$1;
        proto$2._bubble = bubble;
        proto$2.clone = clone$1;
        proto$2.get = get$2;
        proto$2.milliseconds = milliseconds;
        proto$2.seconds = seconds;
        proto$2.minutes = minutes;
        proto$2.hours = hours;
        proto$2.days = days;
        proto$2.weeks = weeks;
        proto$2.months = months;
        proto$2.years = years;
        proto$2.humanize = humanize;
        proto$2.toISOString = toISOString$1;
        proto$2.toString = toISOString$1;
        proto$2.toJSON = toISOString$1;
        proto$2.locale = locale;
        proto$2.localeData = localeData;
        proto$2.toIsoString = deprecate(
          "toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)",
          toISOString$1
        );
        proto$2.lang = lang;
        addFormatToken("X", 0, 0, "unix");
        addFormatToken("x", 0, 0, "valueOf");
        addRegexToken("x", matchSigned);
        addRegexToken("X", matchTimestamp);
        addParseToken("X", function(input, array, config) {
          config._d = new Date(parseFloat(input) * 1e3);
        });
        addParseToken("x", function(input, array, config) {
          config._d = new Date(toInt(input));
        });
        hooks.version = "2.30.1";
        setHookCallback(createLocal);
        hooks.fn = proto;
        hooks.min = min;
        hooks.max = max;
        hooks.now = now;
        hooks.utc = createUTC;
        hooks.unix = createUnix;
        hooks.months = listMonths;
        hooks.isDate = isDate;
        hooks.locale = getSetGlobalLocale;
        hooks.invalid = createInvalid;
        hooks.duration = createDuration;
        hooks.isMoment = isMoment;
        hooks.weekdays = listWeekdays;
        hooks.parseZone = createInZone;
        hooks.localeData = getLocale;
        hooks.isDuration = isDuration;
        hooks.monthsShort = listMonthsShort;
        hooks.weekdaysMin = listWeekdaysMin;
        hooks.defineLocale = defineLocale;
        hooks.updateLocale = updateLocale;
        hooks.locales = listLocales;
        hooks.weekdaysShort = listWeekdaysShort;
        hooks.normalizeUnits = normalizeUnits;
        hooks.relativeTimeRounding = getSetRelativeTimeRounding;
        hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
        hooks.calendarFormat = getCalendarFormat;
        hooks.prototype = proto;
        hooks.HTML5_FMT = {
          DATETIME_LOCAL: "YYYY-MM-DDTHH:mm",
          // <input type="datetime-local" />
          DATETIME_LOCAL_SECONDS: "YYYY-MM-DDTHH:mm:ss",
          // <input type="datetime-local" step="1" />
          DATETIME_LOCAL_MS: "YYYY-MM-DDTHH:mm:ss.SSS",
          // <input type="datetime-local" step="0.001" />
          DATE: "YYYY-MM-DD",
          // <input type="date" />
          TIME: "HH:mm",
          // <input type="time" />
          TIME_SECONDS: "HH:mm:ss",
          // <input type="time" step="1" />
          TIME_MS: "HH:mm:ss.SSS",
          // <input type="time" step="0.001" />
          WEEK: "GGGG-[W]WW",
          // <input type="week" />
          MONTH: "YYYY-MM"
          // <input type="month" />
        };
        return hooks;
      });
    }
  });

  // prototypes/diary/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.DIARY_ICONS) == null ? void 0 : _a[iconId]) || "";
    if (!d) return;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.innerHTML = d;
    container.replaceChildren(svg);
  }
  function encodeSeedFile(content, stat) {
    var _a, _b, _c;
    const now = Date.now();
    const env = { c: content, ct: (_a = stat == null ? void 0 : stat.ctime) != null ? _a : now, mt: (_c = (_b = stat == null ? void 0 : stat.mtime) != null ? _b : stat == null ? void 0 : stat.ctime) != null ? _c : now };
    return JSON.stringify(env);
  }
  function assetManifest() {
    const src = typeof window !== "undefined" && window.DIARY || window.parent && window.parent.DIARY || null;
    return (src == null ? void 0 : src.ASSETS) || [];
  }
  function binMimeOf(name) {
    const dot = name.lastIndexOf(".");
    return dot > 0 && BIN_MIME[name.slice(dot + 1).toLowerCase()] || "application/octet-stream";
  }
  function fakeBinaryUrl(name) {
    const base = (name || "").split("/").pop() || "";
    if (!base) return "";
    const live2 = binUrls.get(base);
    if (live2) return live2;
    try {
      return localStorage.getItem(BIN_PREFIX + base) || "";
    } catch (e) {
      return "";
    }
  }
  function bytesToDataUrl(bytes, mime) {
    let bin = "";
    const CHUNK = 32768;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    return `data:${mime};base64,${btoa(bin)}`;
  }
  function vaultMediaUrl(base) {
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return "";
    if (!MEDIA_EXT_RE.test(base)) return "";
    return "/__vault-media/" + encodeURIComponent(base);
  }
  function parseFrontmatter(content) {
    if (!content.startsWith("---")) return null;
    const end = content.indexOf("\n---", 3);
    if (end < 0) return null;
    const strip = (s) => {
      const t = s.trim();
      if (t.length >= 2 && (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'"))) {
        return t.slice(1, -1);
      }
      return t;
    };
    const fm = {};
    let lastKey = null;
    for (const line of content.slice(3, end).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const listItem = /^\s*-\s*(.+)$/.exec(line);
      if (listItem && lastKey) {
        const arr = Array.isArray(fm[lastKey]) ? fm[lastKey] : [];
        arr.push(strip(listItem[1]));
        fm[lastKey] = arr;
        continue;
      }
      const kv = /^([^\s:][^:]*):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      lastKey = key;
      if (rawVal === "") {
        fm[key] = [];
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        fm[key] = rawVal.slice(1, -1).split(",").map((s) => strip(s)).filter(Boolean);
      } else {
        fm[key] = strip(rawVal);
      }
    }
    return fm;
  }
  var import_moment, Platform, MarkdownRenderer, Component, Setting, KEY_PREFIX, MEDIA_EXT_RE, BIN_PREFIX, BIN_PERSIST_MAX, BIN_MIME, binUrls, FakeVault, FakeMetadataCache, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/diary/fake/fake-obsidian.ts"() {
      import_moment = __toESM(require_moment());
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      MarkdownRenderer = class {
        static async render(_app3, md, container) {
          const block = document.createElement("div");
          block.textContent = md;
          container.appendChild(block);
        }
        static renderMarkdown() {
          return Promise.resolve("");
        }
      };
      Component = class {
        load() {
        }
        unload() {
        }
        onload() {
        }
        onunload() {
        }
        addChild() {
          return null;
        }
        removeChild() {
        }
        registerEvent() {
        }
        register() {
        }
        registerDomEvent() {
        }
        registerInterval() {
          return 0;
        }
      };
      Setting = class {
        constructor(container) {
          this.settingEl = document.createElement("div");
          this.settingEl.className = "setting-item";
          const info = document.createElement("div");
          info.className = "setting-item-info";
          this.nameEl = document.createElement("div");
          this.nameEl.className = "setting-item-name";
          this.descEl = document.createElement("div");
          this.descEl.className = "setting-item-description";
          this.controlEl = document.createElement("div");
          this.controlEl.className = "setting-item-control";
          info.append(this.nameEl, this.descEl);
          this.settingEl.append(info, this.controlEl);
          container.appendChild(this.settingEl);
        }
        setName(t) {
          this.nameEl.textContent = String(t);
          return this;
        }
        setDesc(t) {
          this.descEl.textContent = String(t);
          return this;
        }
        wrap(el) {
          this.controlEl.appendChild(el);
          return el;
        }
        addText(cb) {
          const input = this.wrap(document.createElement("input"));
          input.type = "text";
          input.className = "setting-text-input";
          const comp = {
            inputEl: input,
            setValue: (v) => (input.value = v, comp),
            getValue: () => input.value,
            setPlaceholder: (p) => (input.placeholder = p, comp),
            onChange: (fn) => {
              input.addEventListener("change", () => fn(input.value));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addToggle(cb) {
          const input = this.wrap(document.createElement("input"));
          input.type = "checkbox";
          const comp = {
            toggleEl: input,
            setValue: (v) => (input.checked = !!v, comp),
            getValue: () => input.checked,
            onChange: (fn) => {
              input.addEventListener("change", () => fn(input.checked));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addDropdown(cb) {
          const select = this.wrap(document.createElement("select"));
          const comp = {
            selectEl: select,
            addOptions: (opts) => {
              for (const o of opts) {
                const op = document.createElement("option");
                op.value = o.value;
                op.textContent = o.label;
                select.appendChild(op);
              }
              return comp;
            },
            setValue: (v) => (select.value = v, comp),
            onChange: (fn) => {
              select.addEventListener("change", () => fn(select.value));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addButton(cb) {
          const btn = this.wrap(document.createElement("button"));
          btn.type = "button";
          const comp = {
            buttonEl: btn,
            setButtonText: (t) => (btn.textContent = t, comp),
            setCta: () => (btn.classList.add("mod-cta"), comp),
            setDisabled: (v) => (btn.disabled = v, comp),
            onClick: (fn) => {
              btn.addEventListener("click", () => fn());
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addExtraButton(cb) {
          return this.addButton(cb);
        }
        addColorPicker(cb) {
          const input = this.wrap(document.createElement("input"));
          input.type = "color";
          const comp = {
            setValue: (v) => (input.value = v, comp),
            onChange: (fn) => {
              input.addEventListener("change", () => fn(input.value));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addSearch(cb) {
          return this.addText(cb);
        }
        addTextArea(cb) {
          const ta = this.wrap(document.createElement("textarea"));
          const comp = {
            inputEl: ta,
            setValue: (v) => (ta.value = v, comp),
            getValue: () => ta.value,
            onChange: (fn) => {
              ta.addEventListener("change", () => fn(ta.value));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
        addSlider(cb) {
          const input = this.wrap(document.createElement("input"));
          input.type = "range";
          const comp = {
            inputEl: input,
            setLimits: (min, max, step) => (input.min = String(min), input.max = String(max), input.step = String(step), comp),
            setValue: (v) => (input.value = String(v), comp),
            getValue: () => Number(input.value),
            onChange: (fn) => {
              input.addEventListener("change", () => fn(Number(input.value)));
              return comp;
            }
          };
          cb(comp);
          return this;
        }
      };
      KEY_PREFIX = "bz-sim:";
      MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp4|m4v|webm|mov|ogv|mp3|m4a|aac|wav|flac|ogg|oga)$/i;
      BIN_PREFIX = "bz-sim-bin:";
      BIN_PERSIST_MAX = 1.5 * 1024 * 1024;
      BIN_MIME = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        avif: "image/avif",
        bmp: "image/bmp",
        svg: "image/svg+xml",
        mp4: "video/mp4",
        m4v: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        ogv: "video/ogg",
        mp3: "audio/mpeg",
        m4a: "audio/mp4",
        aac: "audio/aac",
        wav: "audio/wav",
        flac: "audio/flac",
        ogg: "audio/ogg",
        oga: "audio/ogg"
      };
      binUrls = /* @__PURE__ */ new Map();
      FakeVault = class _FakeVault {
        constructor() {
          /** 事件订阅表（ref→cb 映射，offref 按 ref 摘单个监听，见 on/offref 注释） */
          this.listeners = /* @__PURE__ */ new Map();
          this.idSeq = 0;
          /** adapter 直读目录面（data.ts collectMdPaths 递归枚举 md 的数据源）。
           *  与 Obsidian DataAdapter.list 同契约：files/folders 均为【库内全路径】。 */
          this.adapter = {
            list: async (dir) => {
              const clean = String(dir).replace(/^\/+|\/+$/g, "");
              const dirs = /* @__PURE__ */ new Set();
              const files = [];
              for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(KEY_PREFIX)) continue;
                const path = k.slice(KEY_PREFIX.length);
                if (!path) continue;
                const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
                if (parent !== clean && !parent.startsWith(clean ? clean + "/" : "")) continue;
                const rest = clean ? path.slice(clean.length + 1) : path;
                if (!rest) continue;
                const slash = rest.indexOf("/");
                if (slash >= 0) {
                  const name = rest.slice(0, slash);
                  dirs.add(clean ? clean + "/" + name : name);
                } else {
                  files.push(clean ? clean + "/" + rest : rest);
                }
              }
              return { folders: [...dirs].sort(), files };
            }
          };
          if (typeof window !== "undefined") {
            window.addEventListener("storage", (e) => {
              if (!e.key || !e.key.startsWith(KEY_PREFIX)) return;
              this.emit("modify", { path: e.key.slice(KEY_PREFIX.length) });
            });
          }
        }
        static key(path) {
          return KEY_PREFIX + path;
        }
        toFile(path, raw) {
          let content = raw;
          let ct = Date.now();
          let mt = ct;
          try {
            const env = JSON.parse(raw);
            if (env && typeof env === "object" && typeof env.c === "string") {
              content = env.c;
              ct = Number(env.ct) || ct;
              mt = Number(env.mt) || mt;
            }
          } catch (e) {
          }
          const base = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
          const dot = base.lastIndexOf(".");
          return {
            path,
            basename: dot > 0 ? base.slice(0, dot) : base,
            extension: dot > 0 ? base.slice(dot + 1) : "",
            name: base,
            stat: { ctime: ct, mtime: mt },
            content
          };
        }
        getAbstractFileByPath(path) {
          const raw = localStorage.getItem(_FakeVault.key(path));
          return raw == null ? null : this.toFile(path, raw);
        }
        async read(f) {
          return f.content;
        }
        async modify(f, content) {
          f.content = content;
          localStorage.setItem(_FakeVault.key(f.path), encodeSeedFile(content, f.stat));
          this.emit("modify", { path: f.path });
        }
        async create(path, content) {
          localStorage.setItem(_FakeVault.key(path), encodeSeedFile(content));
          const f = this.toFile(path, localStorage.getItem(_FakeVault.key(path)));
          this.emit("create", { path });
          return f;
        }
        /** 删除（写层「整文件删除」分支 + 保险箱清单镜像读写路径） */
        async delete(f) {
          localStorage.removeItem(_FakeVault.key(f.path));
          this.emit("delete", { path: f.path });
        }
        async createFolder(_path) {
          return void 0;
        }
        /**
         * 二进制落盘（ADR-0233「贴一件」经 `vault.createBinary` 写进附件位置）。
         * 评审壳不做真文件系统：小件存 data URL（刷新后照片还在），大件只留内存 objectURL。
         */
        async createBinary(path, data) {
          const bytes = new Uint8Array(data);
          const base = path.split("/").pop() || path;
          let url = "";
          try {
            url = URL.createObjectURL(new Blob([bytes], { type: binMimeOf(base) }));
          } catch (e) {
            url = "";
          }
          if (url) binUrls.set(base, url);
          if (bytes.byteLength <= BIN_PERSIST_MAX) {
            try {
              localStorage.setItem(BIN_PREFIX + base, bytesToDataUrl(bytes, binMimeOf(base)));
            } catch (e) {
            }
          }
          this.emit("create", { path });
          return this.toFile(path, "");
        }
        /** 媒体资源 URL：本机添进来的先认（内存 / data URL）→ 入库子集走 assets/ → 否则按需走预览服务取真实 vault；
         *  file://（双击直开、无服务端）下后者不可用 → ''（墙渐变占位语义）。 */
        getResourcePath(file) {
          const base = file.path.split("/").pop() || "";
          if (!base) return "";
          if (assetManifest().includes(base)) return "./assets/" + encodeURIComponent(base);
          const added = fakeBinaryUrl(base);
          if (added) return added;
          return vaultMediaUrl(base);
        }
        /** 事件订阅（core/app vault.on/offref 同形） */
        on(evt, cb) {
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          const id = ++this.idSeq;
          this.listeners.get(evt).push({ id, cb });
          return { ref: id };
        }
        /** 与宿主 Vault.offref 同语义（ADR-0122）：只摘该 ref 对应的监听，不清空整表
         *  （清空整表会掩盖原型端的重复订阅泄漏）。 */
        offref(ref) {
          const id = ref == null ? void 0 : ref.ref;
          if (id === void 0) return;
          for (const [evt, list] of this.listeners) {
            const idx = list.findIndex((l) => l.id === id);
            if (idx >= 0) {
              list.splice(idx, 1);
              if (list.length === 0) this.listeners.delete(evt);
            }
          }
        }
        emit(evt, file) {
          var _a;
          for (const l of (_a = this.listeners.get(evt)) != null ? _a : []) l.cb(file);
        }
      };
      FakeMetadataCache = class {
        constructor() {
          this.cache = /* @__PURE__ */ new Map();
        }
        getFileCache(file) {
          if (!file || typeof file.path !== "string") return null;
          if (!this.cache.has(file.path)) {
            const raw = typeof file.content === "string" ? file.content : this.readThrough(file.path);
            this.cache.set(file.path, parseFrontmatter(raw));
          }
          const fm = this.cache.get(file.path);
          return fm ? { frontmatter: fm } : null;
        }
        /** 媒体链接解析（data.ts mediaSrc 优先路）：本机添进来的 / 入库清单命中 / 经预览服务可取的真实 vault 媒体
         *  （http 环境 + 媒体扩展名）→ 返回 TFile 形状；否则 null → mediaSrc 回退 '' 走渐变占位。 */
        getFirstLinkpathDest(ref, _sourcePath) {
          const base = (ref || "").split("/").pop() || "";
          if (!base) return null;
          if (fakeBinaryUrl(base)) return { path: base };
          if (assetManifest().includes(base)) return { path: base };
          return vaultMediaUrl(base) ? { path: base } : null;
        }
        readThrough(path) {
          try {
            const raw = localStorage.getItem(FakeVault.key(path));
            if (raw == null) return "";
            const env = JSON.parse(raw);
            return env && typeof env === "object" && typeof env.c === "string" ? env.c : raw;
          } catch (e) {
            return "";
          }
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
          this.metadataCache = new FakeMetadataCache();
          this.fileManager = {
            /**
             * 「附件默认位置」：真宿主读用户设置的 attachmentFolderPath（本机 vault 是 `CONFIG/APPENDIX`），
             * 壳里就按同一个口径回一个不重名的路径——ADR-0233 的 mediaPathFor 优先走这条。
             */
            getAvailablePathForAttachment: async (name, _sourcePath) => {
              const dir = "CONFIG/APPENDIX";
              const dot = name.lastIndexOf(".");
              const base = dot > 0 ? name.slice(0, dot) : name;
              const ext = dot > 0 ? name.slice(dot) : "";
              let path = `${dir}/${name}`;
              for (let i = 2; fakeBinaryUrl(path.split("/").pop()); i++) path = `${dir}/${base}_${i}${ext}`;
              return path;
            }
          };
        }
      };
    }
  });

  // src/core/app.ts
  function setApp(app) {
    _app = app;
  }
  function getApp() {
    if (!_app) {
      throw new Error("bz: app 未初始化（setApp 未调用）");
    }
    return _app;
  }
  var _app;
  var init_app = __esm({
    "src/core/app.ts"() {
      _app = null;
    }
  });

  // src/core/settings-provider.ts
  function setSettingsProvider(fn) {
    _provider = fn;
  }
  function saveSettings() {
    return _saver ? _saver() : Promise.resolve();
  }
  function getSettings() {
    if (!_provider) {
      throw new Error("bz: 设置提供者未注入（main.ts onload 应调用 setSettingsProvider）");
    }
    return _provider();
  }
  function tryGetSettings() {
    return _provider ? _provider() : {};
  }
  function panelSizePersist(keyW, keyH, minW, minH) {
    return {
      load: () => {
        const s = tryGetSettings();
        const w = Number(s[keyW]) || 0;
        const h = Number(s[keyH]) || 0;
        if (w < minW || h < minH) return null;
        return { w, h };
      },
      save: (w, h) => {
        const rec = tryGetSettings();
        rec[keyW] = w;
        rec[keyH] = h;
        void saveSettings().catch((e) => console.error("[bz] 面板尺寸保存失败", e));
      }
    };
  }
  var _provider, _saver;
  var init_settings_provider = __esm({
    "src/core/settings-provider.ts"() {
      _provider = null;
      _saver = null;
    }
  });

  // src/cinema/state.ts
  function resolveCinemaFolderPath() {
    try {
      const s = tryGetSettings();
      return typeof s.cinemaFolderPath === "string" && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : DEFAULT_FOLDER;
    } catch (e) {
      return DEFAULT_FOLDER;
    }
  }
  var DEFAULT_FOLDER;
  var init_state = __esm({
    "src/cinema/state.ts"() {
      init_settings_provider();
      DEFAULT_FOLDER = "我的/影视";
    }
  });

  // src/core/http.ts
  function withTimeout(p, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`请求超时（${label || "未命名请求"}，${ms}ms）`)),
        ms
      );
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
  }
  var init_http = __esm({
    "src/core/http.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/str.ts
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function relTime(s, now = Date.now()) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    const diff = now - d.getTime();
    const m = 6e4, h = 36e5, day = 864e5;
    if (diff < m) return "刚刚";
    if (diff < h) return Math.floor(diff / m) + " 分钟前";
    if (diff < day) return Math.floor(diff / h) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
    return `${d.getMonth() + 1}-${pad2(d.getDate())}`;
  }
  function emptyHtmlStr(icon, title, desc) {
    return `<div class="bz-empty">${icon ? iconSpan(icon, "bz-empty-ic") : ""}<div class="bz-empty-title">${esc(title)}</div>${desc ? `<div class="bz-empty-desc">${esc(desc)}</div>` : ""}</div>`;
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }
  var ESC_MAP;
  var init_str = __esm({
    "src/core/ui/str.ts"() {
      ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    }
  });

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el of alwaysOnTop) {
      if (!el.isConnected) {
        alwaysOnTop.delete(el);
        continue;
      }
      el.style.zIndex = String(zCounter);
    }
  }
  function allocZBlock(n) {
    const base = ++zCounter;
    zCounter += n - 1;
    zCounter++;
    syncAlwaysOnTop();
    return base;
  }
  function allocZ() {
    return allocZBlock(1);
  }
  function topifyZ(...els) {
    const live2 = els.filter((el) => !!el);
    if (live2.length === 0) return;
    const base = allocZBlock(live2.length);
    live2.forEach((el, i) => {
      el.style.zIndex = String(base + i);
    });
  }
  var zCounter, alwaysOnTop;
  var init_z_order = __esm({
    "src/core/z-order.ts"() {
      zCounter = 1e5;
      alwaysOnTop = /* @__PURE__ */ new Set();
    }
  });

  // src/core/notice.ts
  function maxVisible() {
    const v = Number(noticePref("noticeMaxVisible"));
    return v === 3 || v === 8 ? v : MAX_VISIBLE_DEFAULT;
  }
  function notice(msg, type, duration) {
    notify(msg, { type: type || "info", duration });
  }
  function notifySaveError(err, what) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(what ? `保存失败（${what}）：${msg}` : `保存失败：${msg}`, { type: "error" });
  }
  function notifyActionError(err, action, opts) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(`${action}失败：${msg}，请重试`, {
      type: "error",
      action: (opts == null ? void 0 : opts.onRetry) ? { label: "重试", onClick: opts.onRetry } : void 0
    });
  }
  function isMobileView() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }
  function defaultVariant() {
    if (isMobileView()) return "drop";
    const pos = noticePref("noticePosition");
    return pos === "top-left" || pos === "bottom-left" ? "slide-left" : "slide-right";
  }
  function noticePref(key) {
    var _a;
    try {
      const v = (_a = tryGetSettings()) == null ? void 0 : _a[key];
      return typeof v === "string" ? v : void 0;
    } catch (e) {
      return void 0;
    }
  }
  function durationGear() {
    const v = noticePref("noticeDuration");
    if (v === "quick") return { base: 2e3, persistent: false };
    if (v === "relaxed") return { base: 5e3, persistent: false };
    if (v === "persistent") return { base: 3e3, persistent: true };
    return { base: 3e3, persistent: false };
  }
  function defaultDuration(type) {
    const base = durationGear().base;
    return type === "error" ? base + 2e3 : base;
  }
  function suppressedByLevel(kind, opts) {
    const level = noticePref("noticeLevel");
    if (level !== "important" && level !== "error") return false;
    if (kind === "progress") return false;
    if (opts && (opts.action || opts.actions && opts.actions.length > 0)) return false;
    if (level === "error") return kind !== "error";
    return kind !== "warning" && kind !== "error";
  }
  function applyPositionClass(container) {
    const pos = noticePref("noticePosition");
    container.classList.remove(...POSITION_CLASSES);
    const cls = pos === "bottom-right" || pos === "bottom-left" || pos === "top-left" ? `bz-notice-pos--${pos}` : "";
    if (cls) container.classList.add(cls);
  }
  function calcDuration(text, base) {
    const len = text.length;
    if (len <= SHORT_THRESHOLD) return base;
    const extra = (len - SHORT_THRESHOLD) * PER_CHAR_MS;
    return Math.min(base + extra, 15e3);
  }
  function ensureContainer() {
    let container = document.getElementById("bz-notice-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "bz-notice-container";
      document.body.appendChild(container);
    }
    return container;
  }
  function removeInternal(n) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    const i = live.indexOf(n);
    if (i !== -1) live.splice(i, 1);
    if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
  }
  function evictOldest() {
    let quota = live.length - maxVisible() + 1;
    for (let i = 0; quota > 0 && i < live.length; ) {
      const candidate = live[i];
      if (candidate.persistent) {
        i++;
        continue;
      }
      removeInternal(candidate);
      quota--;
    }
  }
  function applyTypeToEl(n, kind) {
    const isProgressNow = kind === "progress";
    n.el.classList.remove(
      "bz-notice--info",
      "bz-notice--success",
      "bz-notice--warning",
      "bz-notice--error",
      "bz-notice--pause",
      "bz-notice--delete",
      "bz-notice--restore",
      "bz-notice--archive",
      "bz-notice--progress"
    );
    n.el.classList.add("bz-notice--" + (isProgressNow ? "progress" : kind));
    n.iconEl.innerHTML = "";
    if (isProgressNow) {
      n.iconEl.innerHTML = SPINNER_SVG;
    } else {
      n.iconEl.textContent = ICONS[kind];
    }
    n.isProgress = isProgressNow;
  }
  function hideNow(n) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    if (!n.el.classList.contains("bz-notice--leaving")) {
      n.el.classList.add("bz-notice--leaving");
      const out = OUT_CLASS[n.variant];
      if (out) n.el.classList.add(out);
      window.setTimeout(() => removeInternal(n), LEAVE_MS);
    }
  }
  function armTimer(n, kind, explicitDuration, text) {
    if (n.timer !== null) {
      window.clearTimeout(n.timer);
      n.timer = null;
    }
    n.persistent = false;
    if (kind === "progress") {
      if (explicitDuration !== void 0 && explicitDuration > 0) {
        n.timer = window.setTimeout(() => hideNow(n), explicitDuration);
      } else {
        n.persistent = true;
      }
    } else {
      const base = defaultDuration(kind);
      const dur = explicitDuration !== void 0 ? explicitDuration : text ? calcDuration(text, base) : base;
      if (dur <= 0) {
        n.persistent = true;
      } else if (explicitDuration === void 0 && durationGear().persistent) {
      } else {
        n.timer = window.setTimeout(() => hideNow(n), dur);
      }
    }
  }
  function noopHandle() {
    return {
      el: document.createElement("div"),
      setMessage() {
      },
      setProgress() {
      },
      setType() {
      },
      setAction() {
      },
      hide() {
      }
    };
  }
  function appendActionBtn(n, action) {
    const btn = document.createElement("span");
    btn.className = "bz-notice-action";
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.textContent = action.label;
    const fire = (e) => {
      e.stopPropagation();
      if (action.onClick) action.onClick();
      hideNow(n);
    };
    btn.addEventListener("click", fire);
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fire(e);
      }
    });
    n.el.appendChild(btn);
  }
  function makeHandle(n) {
    return {
      el: n.el,
      setMessage(text) {
        n.msgEl.textContent = text;
      },
      setType(t) {
        applyTypeToEl(n, t);
        armTimer(n, t, void 0, n.msgEl.textContent || void 0);
      },
      setProgress(pct) {
        if (!n.progressEl) return;
        if (pct === -1) {
          n.progressEl.classList.add("bz-notice-progress--indeterminate");
          return;
        }
        n.progressEl.classList.remove("bz-notice-progress--indeterminate");
        const clamped = Math.max(0, Math.min(100, pct));
        n.progressEl.style.width = clamped + "%";
        if (clamped >= 100) n.progressEl.classList.add("bz-notice-progress--done");
        else n.progressEl.classList.remove("bz-notice-progress--done");
      },
      setAction(actions) {
        const list = Array.isArray(actions) ? actions : [actions];
        const existing = new Set(
          Array.from(n.el.querySelectorAll(".bz-notice-action")).map((el) => el.textContent || "")
        );
        for (const a of list) {
          if (existing.has(a.label)) continue;
          appendActionBtn(n, a);
          existing.add(a.label);
        }
      },
      hide() {
        hideNow(n);
      }
    };
  }
  function notify(msg, opts) {
    const kind = opts && opts.type || "info";
    if (suppressedByLevel(kind, opts)) return noopHandle();
    const isProgress = kind === "progress";
    const type = isProgress ? "info" : kind;
    const variant = opts && opts.variant || defaultVariant();
    const container = ensureContainer();
    applyPositionClass(container);
    if (opts && opts.dedupeKey) {
      const key = opts.dedupeKey;
      const r = recent[key];
      const now = Date.now();
      if (r && r.n && r.n.el.isConnected) {
        r.n.msgEl.textContent = msg;
        if (r.n.isProgress !== isProgress || r.n.el.classList.contains("bz-notice--" + type) === false) {
          applyTypeToEl(r.n, kind);
        }
        const mergeActions = [];
        if (opts.action) mergeActions.push(opts.action);
        if (opts.actions) mergeActions.push(...opts.actions);
        armTimer(r.n, kind, opts.duration, msg);
        const merged = makeHandle(r.n);
        if (mergeActions.length) merged.setAction(mergeActions);
        return merged;
      }
      if (r && now - r.at < DEDUPE_WINDOW_MS) {
        return noopHandle();
      }
      recent[key] = { at: now, n: null };
    }
    evictOldest();
    const el = document.createElement("div");
    el.className = "bz-notice bz-notice--" + (isProgress ? "progress" : type) + " bz-notice--in-" + variant;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    const icon = document.createElement("div");
    icon.className = "bz-notice-icon";
    if (isProgress) {
      icon.innerHTML = SPINNER_SVG;
    } else {
      icon.textContent = ICONS[type];
    }
    el.appendChild(icon);
    const body = document.createElement("div");
    body.className = "bz-notice-body";
    if (opts && opts.title) {
      const titleEl = document.createElement("div");
      titleEl.className = "bz-notice-title";
      titleEl.textContent = opts.title;
      body.appendChild(titleEl);
    }
    const msgEl = document.createElement("div");
    msgEl.className = "bz-notice-msg";
    msgEl.textContent = msg;
    body.appendChild(msgEl);
    el.appendChild(body);
    let progressEl = null;
    if (isProgress) {
      progressEl = document.createElement("div");
      progressEl.className = "bz-notice-progress";
      el.appendChild(progressEl);
    }
    const n = { el, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress, persistent: false };
    const actions = [];
    if (opts && opts.action) actions.push(opts.action);
    if (opts && opts.actions) {
      for (const a of opts.actions) {
        if (!actions.some((x) => x.label === a.label)) actions.push(a);
      }
    }
    for (const a of actions) appendActionBtn(n, a);
    el.addEventListener("click", () => hideNow(n));
    container.style.zIndex = String(allocZ());
    container.appendChild(el);
    live.push(n);
    if (opts && opts.dedupeKey) {
      const r = recent[opts.dedupeKey];
      if (r) r.n = n;
    }
    const fullText = (opts && opts.title ? opts.title + " " : "") + msg;
    armTimer(n, kind, opts && opts.duration, fullText);
    return makeHandle(n);
  }
  var MAX_VISIBLE_DEFAULT, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, OUT_CLASS, POSITION_CLASSES, PER_CHAR_MS, SHORT_THRESHOLD, live, recent;
  var init_notice = __esm({
    "src/core/notice.ts"() {
      init_z_order();
      init_settings_provider();
      MAX_VISIBLE_DEFAULT = 5;
      LEAVE_MS = 200;
      DEDUPE_WINDOW_MS = 3e4;
      MOBILE_QUERY = "(max-width: 768px)";
      ICONS = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        pause: "⏸️",
        delete: "🗑️",
        restore: "↩️",
        archive: "📁"
      };
      SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
      OUT_CLASS = {
        drop: "bz-notice--out-drop",
        pop: "bz-notice--out-pop",
        "slide-left": "bz-notice--out-left",
        "slide-right": "bz-notice--out-right",
        bounce: "bz-notice--out-fade",
        shake: "bz-notice--out-fade"
      };
      POSITION_CLASSES = ["bz-notice-pos--bottom-right", "bz-notice-pos--bottom-left", "bz-notice-pos--top-left"];
      PER_CHAR_MS = 60;
      SHORT_THRESHOLD = 20;
      live = [];
      recent = {};
    }
  });

  // src/core/utils.ts
  function escapeHtml2(str) {
    return str.replace(/[&<>"']/g, (m) => {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return "&#39;";
    });
  }
  function formatRelativeTime(date, now = /* @__PURE__ */ new Date()) {
    const target = (0, import_moment2.default)(date);
    if (!target.isValid()) return "无效日期";
    let hasExplicitTime = true;
    if (typeof date === "string") {
      hasExplicitTime = !/^\d{4}-\d{2}-\d{2}$/.test(date.trim());
    }
    const nowMoment = (0, import_moment2.default)(now);
    const diffSeconds = nowMoment.diff(target, "seconds");
    function shouldShowTime() {
      const timeStr = target.format("HH:mm");
      if (timeStr !== "00:00") return true;
      return hasExplicitTime;
    }
    if (diffSeconds < 0) {
      return target.format(shouldShowTime() ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
    }
    if (diffSeconds < 60) return "刚刚";
    if (target.isSame(nowMoment.startOf("day"), "day")) {
      return relTime(target.format("YYYY-MM-DD HH:mm:ss"), now.getTime());
    }
    const diffMinutes = Math.floor(diffSeconds / 60);
    const yesterdayStart = (0, import_moment2.default)(now).subtract(1, "days").startOf("day");
    const beforeYesterdayStart = (0, import_moment2.default)(now).subtract(2, "days").startOf("day");
    if (target.isSame(yesterdayStart, "day")) {
      return shouldShowTime() ? `昨天 ${target.format("HH:mm")}` : "昨天";
    }
    if (target.isSame(beforeYesterdayStart, "day")) {
      return shouldShowTime() ? `前天 ${target.format("HH:mm")}` : "前天";
    }
    const weekStart = (0, import_moment2.default)(now).startOf("week");
    if (target.isSameOrAfter(weekStart, "day") && target.isBefore(nowMoment.startOf("day"))) {
      return shouldShowTime() ? `${target.format("ddd")} ${target.format("HH:mm")}` : target.format("ddd");
    }
    const isThisYear = target.year() === nowMoment.year();
    if (isThisYear) {
      return shouldShowTime() ? target.format("MM-DD HH:mm") : target.format("MM-DD");
    }
    return shouldShowTime() ? target.format("YYYY-MM-DD HH:mm") : target.format("YYYY-MM-DD");
  }
  function debounce(fn, ms) {
    let t;
    const wrapped = (...args) => {
      if (t !== void 0) clearTimeout(t);
      t = setTimeout(() => {
        t = void 0;
        fn(...args);
      }, ms);
    };
    wrapped.cancel = () => {
      if (t !== void 0) {
        clearTimeout(t);
        t = void 0;
      }
    };
    return wrapped;
  }
  function cancelClipboardClear() {
    if (clipboardClearTimer !== null) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
  }
  function armClipboardClear() {
    if (clipboardClearTimer !== null) clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(() => {
      clipboardClearTimer = null;
      try {
        void navigator.clipboard.writeText("").catch(() => {
        });
      } catch (e) {
      }
    }, CLIPBOARD_CLEAR_DELAY_MS);
  }
  function copySensitiveText(text) {
    try {
      return navigator.clipboard.writeText(text).then(() => armClipboardClear());
    } catch (e) {
      return Promise.reject(e);
    }
  }
  async function copySensitiveWithFallback(text) {
    try {
      await copySensitiveText(text);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) armClipboardClear();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }
  var import_moment2, CLIPBOARD_CLEAR_DELAY_MS, clipboardClearTimer;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      import_moment2 = __toESM(require_moment());
      init_app();
      init_http();
      init_str();
      init_notice();
      CLIPBOARD_CLEAR_DELAY_MS = 6e4;
      clipboardClearTimer = null;
    }
  });

  // src/bookshelf/state.ts
  var init_state2 = __esm({
    "src/bookshelf/state.ts"() {
      init_settings_provider();
    }
  });

  // src/bookshelf/data.ts
  function resolveFolderPath() {
    const s = tryGetSettings();
    const v = typeof s.bookshelfFolderPath === "string" && s.bookshelfFolderPath.trim() ? s.bookshelfFolderPath : typeof s.libraryFolderPath === "string" && s.libraryFolderPath.trim() ? s.libraryFolderPath : "书库";
    return v.replace(/^\/+|\/+$/g, "");
  }
  var init_data = __esm({
    "src/bookshelf/data.ts"() {
      init_fake_obsidian();
      init_settings_provider();
      init_utils();
      init_notice();
      init_state2();
    }
  });

  // src/diary/config.ts
  var config_exports = {};
  __export(config_exports, {
    DIARY_DIRECTORY: () => DIARY_DIRECTORY,
    ENCRYPT_TAG: () => ENCRYPT_TAG,
    LETTER_DIRECTORY: () => LETTER_DIRECTORY,
    applyDirectories: () => applyDirectories,
    bookDirectory: () => bookDirectory,
    buildTagMaps: () => buildTagMaps,
    emojiToTagMap: () => emojiToTagMap,
    getParentPrimaryTag: () => getParentPrimaryTag,
    getPrimaryTagsInDisplayOrder: () => getPrimaryTagsInDisplayOrder,
    getSortedTagsForAddDialog: () => getSortedTagsForAddDialog,
    getSubTagsOfPrimary: () => getSubTagsOfPrimary,
    getTagEmoji: () => getTagEmoji,
    inWallDirs: () => inWallDirs,
    isSubTag: () => isSubTag,
    movieDirectory: () => movieDirectory,
    resetTagsConfig: () => resetTagsConfig,
    tagToEmojiMap: () => tagToEmojiMap
  });
  function movieDirectory() {
    return safeResolve(resolveCinemaFolderPath, "我的/影视");
  }
  function bookDirectory() {
    return safeResolve(resolveFolderPath, "书库");
  }
  function safeResolve(resolver, fallback) {
    try {
      const v = resolver();
      return v && v.trim() ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function inWallDirs(p) {
    return [DIARY_DIRECTORY, movieDirectory(), LETTER_DIRECTORY, bookDirectory()].some(
      (d) => p.startsWith(d + "/") || p === d + ".md"
    );
  }
  function applyDirectories(settings) {
    const clean = (v, fallback) => {
      const t = (v || "").trim().replace(/\/+$/, "");
      return t || fallback;
    };
    DIARY_DIRECTORY = clean(settings.diaryDirectory, "我的/日记");
    LETTER_DIRECTORY = clean(settings.letterDirectory, "我的/信");
  }
  function getPrimaryTagsInDisplayOrder() {
    const tags = Object.keys(PRIMARY_TAGS_CONFIG);
    const idx = tags.indexOf(ENCRYPT_TAG);
    if (idx === -1) return tags;
    const rest = tags.filter((t) => t !== ENCRYPT_TAG);
    rest.push(ENCRYPT_TAG);
    return rest;
  }
  function resetTagsConfig() {
    PRIMARY_TAGS_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));
    buildTagMaps();
  }
  function buildTagMaps() {
    for (const key of Object.keys(tagToEmojiMap)) delete tagToEmojiMap[key];
    for (const key of Object.keys(emojiToTagMap)) delete emojiToTagMap[key];
    for (const [tag, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
      tagToEmojiMap[tag] = config.emoji;
      emojiToTagMap[config.emoji] = tag;
      if (config.subTags) {
        for (const sub of config.subTags) {
          tagToEmojiMap[sub.tag] = sub.emoji;
          emojiToTagMap[sub.emoji] = sub.tag;
        }
      }
    }
  }
  function getTagEmoji(tag) {
    return tagToEmojiMap[tag] || "📖";
  }
  function getSubTagsOfPrimary(primaryTag) {
    const config = PRIMARY_TAGS_CONFIG[primaryTag];
    return config && config.subTags ? config.subTags : null;
  }
  function isSubTag(tag) {
    for (const [, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
      if (config.subTags && config.subTags.some((sub) => sub.tag === tag)) {
        return true;
      }
    }
    return false;
  }
  function getParentPrimaryTag(subTag) {
    for (const [primary, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
      if (config.subTags && config.subTags.some((sub) => sub.tag === subTag)) {
        return primary;
      }
    }
    return null;
  }
  function getSortedTagsForAddDialog() {
    const result = [];
    for (const [primary, config] of Object.entries(PRIMARY_TAGS_CONFIG)) {
      if (primary === "加密") continue;
      if (config.subTags && config.subTags.length > 0) {
        for (const sub of config.subTags) {
          result.push(sub.tag);
        }
      } else {
        result.push(primary);
      }
    }
    return result;
  }
  var DIARY_DIRECTORY, LETTER_DIRECTORY, ENCRYPT_TAG, DEFAULT_TAGS_CONFIG, PRIMARY_TAGS_CONFIG, tagToEmojiMap, emojiToTagMap;
  var init_config = __esm({
    "src/diary/config.ts"() {
      init_state();
      init_data();
      DIARY_DIRECTORY = "我的/日记";
      LETTER_DIRECTORY = "我的/信";
      ENCRYPT_TAG = "加密";
      DEFAULT_TAGS_CONFIG = {
        日记: { emoji: "📖" },
        加密: { emoji: "🔐" },
        念念碎: { emoji: "😶" },
        对谈: { emoji: "🤝" },
        随笔: { emoji: "✍️" },
        梦: { emoji: "🌙" },
        诗: { emoji: "🌟" },
        书: { emoji: "📕" },
        信: { emoji: "✉️" },
        摘抄: { emoji: "📌" },
        摄影: { emoji: "📸" },
        骑行: { emoji: "🚴" },
        代码: { emoji: "⚙️" },
        做饭: { emoji: "🥘" },
        游戏: { emoji: "🎮" },
        音乐: { emoji: "🎧" },
        电影: { emoji: "📽" },
        电视剧: { emoji: "📺" },
        动漫: { emoji: "🎨" },
        纪录片: { emoji: "🎞" },
        猫: { emoji: "🐱" },
        狗: { emoji: "🐶" },
        仓鼠: { emoji: "🐹" },
        熊猫: { emoji: "🐼" },
        博物馆: { emoji: "🏛️" },
        美食: { emoji: "🍔" },
        旅游: {
          emoji: "✈️",
          subTags: [
            { tag: "四川", emoji: "🀄" },
            { tag: "大理", emoji: "🛶" }
          ]
        },
        收藏: {
          emoji: "⭐",
          subTags: [
            { tag: "咪咪", emoji: "🐈" },
            { tag: "广告", emoji: "📢" },
            { tag: "神评", emoji: "🤣" },
            { tag: "冷笑话", emoji: "😅" },
            { tag: "抽象", emoji: "🌀" },
            { tag: "AI", emoji: "🤖" },
            { tag: "愚人节", emoji: "🤪" },
            { tag: "舞蹈", emoji: "🕺" },
            { tag: "达人秀", emoji: "🤹" },
            { tag: "艺术", emoji: "🧑‍🎨" },
            { tag: "摄影集", emoji: "📷" },
            { tag: "植物", emoji: "🌳" },
            { tag: "创意", emoji: "🧩" }
          ]
        }
      };
      PRIMARY_TAGS_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));
      tagToEmojiMap = {};
      emojiToTagMap = {};
      buildTagMaps();
    }
  });

  // src/diary/vendor/page-flip.browser.js
  var require_page_flip_browser = __commonJS({
    "src/diary/vendor/page-flip.browser.js"(exports, module) {
      !function(t, e) {
        "object" == typeof exports && "undefined" != typeof module ? e(exports) : "function" == typeof define && define.amd ? define(["exports"], e) : e((t = t || self).St = {});
      }(exports, function(t) {
        "use strict";
        class e {
          constructor(t2, e2) {
            this.state = { angle: 0, area: [], position: { x: 0, y: 0 }, hardAngle: 0, hardDrawingAngle: 0 }, this.createdDensity = e2, this.nowDrawingDensity = this.createdDensity, this.render = t2;
          }
          setDensity(t2) {
            this.createdDensity = t2, this.nowDrawingDensity = t2;
          }
          setDrawingDensity(t2) {
            this.nowDrawingDensity = t2;
          }
          setPosition(t2) {
            this.state.position = t2;
          }
          setAngle(t2) {
            this.state.angle = t2;
          }
          setArea(t2) {
            this.state.area = t2;
          }
          setHardDrawingAngle(t2) {
            this.state.hardDrawingAngle = t2;
          }
          setHardAngle(t2) {
            this.state.hardAngle = t2, this.state.hardDrawingAngle = t2;
          }
          setOrientation(t2) {
            this.orientation = t2;
          }
          getDrawingDensity() {
            return this.nowDrawingDensity;
          }
          getDensity() {
            return this.createdDensity;
          }
          getHardAngle() {
            return this.state.hardAngle;
          }
        }
        class i extends e {
          constructor(t2, e2, i2) {
            super(t2, i2), this.image = null, this.isLoad = false, this.loadingAngle = 0, this.image = new Image(), this.image.src = e2;
          }
          draw(t2) {
            const e2 = this.render.getContext(), i2 = this.render.convertToGlobal(this.state.position), s2 = this.render.getRect().pageWidth, n2 = this.render.getRect().height;
            e2.save(), e2.translate(i2.x, i2.y), e2.beginPath();
            for (let t3 of this.state.area) null !== t3 && (t3 = this.render.convertToGlobal(t3), e2.lineTo(t3.x - i2.x, t3.y - i2.y));
            e2.rotate(this.state.angle), e2.clip(), this.isLoad ? e2.drawImage(this.image, 0, 0, s2, n2) : this.drawLoader(e2, { x: 0, y: 0 }, s2, n2), e2.restore();
          }
          simpleDraw(t2) {
            const e2 = this.render.getRect(), i2 = this.render.getContext(), s2 = e2.pageWidth, n2 = e2.height, h2 = 1 === t2 ? e2.left + e2.pageWidth : e2.left, r2 = e2.top;
            this.isLoad ? i2.drawImage(this.image, h2, r2, s2, n2) : this.drawLoader(i2, { x: h2, y: r2 }, s2, n2);
          }
          drawLoader(t2, e2, i2, s2) {
            t2.beginPath(), t2.strokeStyle = "rgb(200, 200, 200)", t2.fillStyle = "rgb(255, 255, 255)", t2.lineWidth = 1, t2.rect(e2.x + 1, e2.y + 1, i2 - 1, s2 - 1), t2.stroke(), t2.fill();
            const n2 = { x: e2.x + i2 / 2, y: e2.y + s2 / 2 };
            t2.beginPath(), t2.lineWidth = 10, t2.arc(n2.x, n2.y, 20, this.loadingAngle, 3 * Math.PI / 2 + this.loadingAngle), t2.stroke(), t2.closePath(), this.loadingAngle += 0.07, this.loadingAngle >= 2 * Math.PI && (this.loadingAngle = 0);
          }
          load() {
            this.isLoad || (this.image.onload = () => {
              this.isLoad = true;
            });
          }
          newTemporaryCopy() {
            return this;
          }
          getTemporaryCopy() {
            return this;
          }
          hideTemporaryCopy() {
          }
        }
        class s {
          constructor(t2, e2) {
            this.pages = [], this.currentPageIndex = 0, this.currentSpreadIndex = 0, this.landscapeSpread = [], this.portraitSpread = [], this.render = e2, this.app = t2, this.currentPageIndex = 0, this.isShowCover = this.app.getSettings().showCover;
          }
          destroy() {
            this.pages = [];
          }
          createSpread() {
            this.landscapeSpread = [], this.portraitSpread = [];
            for (let t3 = 0; t3 < this.pages.length; t3++) this.portraitSpread.push([t3]);
            let t2 = 0;
            this.isShowCover && (this.pages[0].setDensity("hard"), this.landscapeSpread.push([t2]), t2++);
            for (let e2 = t2; e2 < this.pages.length; e2 += 2) e2 < this.pages.length - 1 ? this.landscapeSpread.push([e2, e2 + 1]) : (this.landscapeSpread.push([e2]), this.pages[e2].setDensity("hard"));
          }
          getSpread() {
            return "landscape" === this.render.getOrientation() ? this.landscapeSpread : this.portraitSpread;
          }
          getSpreadIndexByPage(t2) {
            const e2 = this.getSpread();
            for (let i2 = 0; i2 < e2.length; i2++) if (t2 === e2[i2][0] || t2 === e2[i2][1]) return i2;
            return null;
          }
          getPageCount() {
            return this.pages.length;
          }
          getPages() {
            return this.pages;
          }
          getPage(t2) {
            if (t2 >= 0 && t2 < this.pages.length) return this.pages[t2];
            throw new Error("Invalid page number");
          }
          nextBy(t2) {
            const e2 = this.pages.indexOf(t2);
            return e2 < this.pages.length - 1 ? this.pages[e2 + 1] : null;
          }
          prevBy(t2) {
            const e2 = this.pages.indexOf(t2);
            return e2 > 0 ? this.pages[e2 - 1] : null;
          }
          getFlippingPage(t2) {
            const e2 = this.currentSpreadIndex;
            if ("portrait" === this.render.getOrientation()) return 0 === t2 ? this.pages[e2].newTemporaryCopy() : this.pages[e2 - 1];
            {
              const i2 = 0 === t2 ? this.getSpread()[e2 + 1] : this.getSpread()[e2 - 1];
              return 1 === i2.length || 0 === t2 ? this.pages[i2[0]] : this.pages[i2[1]];
            }
          }
          getBottomPage(t2) {
            const e2 = this.currentSpreadIndex;
            if ("portrait" === this.render.getOrientation()) return 0 === t2 ? this.pages[e2 + 1] : this.pages[e2 - 1];
            {
              const i2 = 0 === t2 ? this.getSpread()[e2 + 1] : this.getSpread()[e2 - 1];
              return 1 === i2.length ? this.pages[i2[0]] : 0 === t2 ? this.pages[i2[1]] : this.pages[i2[0]];
            }
          }
          showNext() {
            this.currentSpreadIndex < this.getSpread().length && (this.currentSpreadIndex++, this.showSpread());
          }
          showPrev() {
            this.currentSpreadIndex > 0 && (this.currentSpreadIndex--, this.showSpread());
          }
          getCurrentPageIndex() {
            return this.currentPageIndex;
          }
          show(t2 = null) {
            if (null === t2 && (t2 = this.currentPageIndex), t2 < 0 || t2 >= this.pages.length) return;
            const e2 = this.getSpreadIndexByPage(t2);
            null !== e2 && (this.currentSpreadIndex = e2, this.showSpread());
          }
          getCurrentSpreadIndex() {
            return this.currentSpreadIndex;
          }
          setCurrentSpreadIndex(t2) {
            if (!(t2 >= 0 && t2 < this.getSpread().length)) throw new Error("Invalid page");
            this.currentSpreadIndex = t2;
          }
          showSpread() {
            const t2 = this.getSpread()[this.currentSpreadIndex];
            2 === t2.length ? (this.render.setLeftPage(this.pages[t2[0]]), this.render.setRightPage(this.pages[t2[1]])) : "landscape" === this.render.getOrientation() && t2[0] === this.pages.length - 1 ? (this.render.setLeftPage(this.pages[t2[0]]), this.render.setRightPage(null)) : (this.render.setLeftPage(null), this.render.setRightPage(this.pages[t2[0]])), this.currentPageIndex = t2[0], this.app.updatePageIndex(this.currentPageIndex);
          }
        }
        class n extends s {
          constructor(t2, e2, i2) {
            super(t2, e2), this.imagesHref = i2;
          }
          load() {
            for (const t2 of this.imagesHref) {
              const e2 = new i(this.render, t2, "soft");
              e2.load(), this.pages.push(e2);
            }
            this.createSpread();
          }
        }
        class h {
          static GetDistanceBetweenTwoPoint(t2, e2) {
            return null === t2 || null === e2 ? 1 / 0 : Math.sqrt(Math.pow(e2.x - t2.x, 2) + Math.pow(e2.y - t2.y, 2));
          }
          static GetSegmentLength(t2) {
            return h.GetDistanceBetweenTwoPoint(t2[0], t2[1]);
          }
          static GetAngleBetweenTwoLine(t2, e2) {
            const i2 = t2[0].y - t2[1].y, s2 = e2[0].y - e2[1].y, n2 = t2[1].x - t2[0].x, h2 = e2[1].x - e2[0].x;
            return Math.acos((i2 * s2 + n2 * h2) / (Math.sqrt(i2 * i2 + n2 * n2) * Math.sqrt(s2 * s2 + h2 * h2)));
          }
          static PointInRect(t2, e2) {
            return null === e2 ? null : e2.x >= t2.left && e2.x <= t2.width + t2.left && e2.y >= t2.top && e2.y <= t2.top + t2.height ? e2 : null;
          }
          static GetRotatedPoint(t2, e2, i2) {
            return { x: t2.x * Math.cos(i2) + t2.y * Math.sin(i2) + e2.x, y: t2.y * Math.cos(i2) - t2.x * Math.sin(i2) + e2.y };
          }
          static LimitPointToCircle(t2, e2, i2) {
            if (h.GetDistanceBetweenTwoPoint(t2, i2) <= e2) return i2;
            const s2 = t2.x, n2 = t2.y, r2 = i2.x, o2 = i2.y;
            let a2 = Math.sqrt(Math.pow(e2, 2) * Math.pow(s2 - r2, 2) / (Math.pow(s2 - r2, 2) + Math.pow(n2 - o2, 2))) + s2;
            i2.x < 0 && (a2 *= -1);
            let g2 = (a2 - s2) * (n2 - o2) / (s2 - r2) + n2;
            return s2 - r2 + n2 === 0 && (g2 = e2), { x: a2, y: g2 };
          }
          static GetIntersectBetweenTwoSegment(t2, e2, i2) {
            return h.PointInRect(t2, h.GetIntersectBeetwenTwoLine(e2, i2));
          }
          static GetIntersectBeetwenTwoLine(t2, e2) {
            const i2 = t2[0].y - t2[1].y, s2 = e2[0].y - e2[1].y, n2 = t2[1].x - t2[0].x, h2 = e2[1].x - e2[0].x, r2 = t2[0].x * t2[1].y - t2[1].x * t2[0].y, o2 = e2[0].x * e2[1].y - e2[1].x * e2[0].y, a2 = i2 * o2 - s2 * r2, g2 = n2 * o2 - h2 * r2, l2 = -(r2 * h2 - o2 * n2) / (i2 * h2 - s2 * n2), d2 = -(i2 * o2 - s2 * r2) / (i2 * h2 - s2 * n2);
            if (isFinite(l2) && isFinite(d2)) return { x: l2, y: d2 };
            if (Math.abs(a2 - g2) < 0.1) throw new Error("Segment included");
            return null;
          }
          static GetCordsFromTwoPoint(t2, e2) {
            const i2 = Math.abs(t2.x - e2.x), s2 = Math.abs(t2.y - e2.y), n2 = Math.max(i2, s2), h2 = [t2];
            function r2(t3, e3, i3, s3, n3) {
              return e3 > t3 ? t3 + n3 * (i3 / s3) : e3 < t3 ? t3 - n3 * (i3 / s3) : t3;
            }
            for (let o2 = 1; o2 <= n2; o2 += 1) h2.push({ x: r2(t2.x, e2.x, i2, n2, o2), y: r2(t2.y, e2.y, s2, n2, o2) });
            return h2;
          }
        }
        class r extends e {
          constructor(t2, e2, i2) {
            super(t2, i2), this.copiedElement = null, this.temporaryCopy = null, this.isLoad = false, this.element = e2, this.element.classList.add("stf__item"), this.element.classList.add("--" + i2);
          }
          newTemporaryCopy() {
            return "hard" === this.nowDrawingDensity ? this : (null === this.temporaryCopy && (this.copiedElement = this.element.cloneNode(true), this.element.parentElement.appendChild(this.copiedElement), this.temporaryCopy = new r(this.render, this.copiedElement, this.nowDrawingDensity)), this.getTemporaryCopy());
          }
          getTemporaryCopy() {
            return this.temporaryCopy;
          }
          hideTemporaryCopy() {
            null !== this.temporaryCopy && (this.copiedElement.remove(), this.copiedElement = null, this.temporaryCopy = null);
          }
          draw(t2) {
            const e2 = t2 || this.nowDrawingDensity, i2 = this.render.convertToGlobal(this.state.position), s2 = this.render.getRect().pageWidth, n2 = this.render.getRect().height;
            this.element.classList.remove("--simple");
            const h2 = `
            display: block;
            z-index: ${this.element.style.zIndex};
            left: 0;
            top: 0;
            width: ${s2}px;
            height: ${n2}px;
        `;
            "hard" === e2 ? this.drawHard(h2) : this.drawSoft(i2, h2);
          }
          drawHard(t2 = "") {
            const e2 = this.render.getRect().left + this.render.getRect().width / 2, i2 = this.state.hardDrawingAngle, s2 = t2 + "\n                backface-visibility: hidden;\n                -webkit-backface-visibility: hidden;\n                clip-path: none;\n                -webkit-clip-path: none;\n            " + (0 === this.orientation ? `transform-origin: ${this.render.getRect().pageWidth}px 0; 
                   transform: translate3d(0, 0, 0) rotateY(${i2}deg);` : `transform-origin: 0 0; 
                   transform: translate3d(${e2}px, 0, 0) rotateY(${i2}deg);`);
            this.element.style.cssText = s2;
          }
          drawSoft(t2, e2 = "") {
            let i2 = "polygon( ";
            for (const t3 of this.state.area) if (null !== t3) {
              let e3 = 1 === this.render.getDirection() ? { x: -t3.x + this.state.position.x, y: t3.y - this.state.position.y } : { x: t3.x - this.state.position.x, y: t3.y - this.state.position.y };
              e3 = h.GetRotatedPoint(e3, { x: 0, y: 0 }, this.state.angle), i2 += e3.x + "px " + e3.y + "px, ";
            }
            i2 = i2.slice(0, -2), i2 += ")";
            const s2 = e2 + `transform-origin: 0 0; clip-path: ${i2}; -webkit-clip-path: ${i2};` + (this.render.isSafari() && 0 === this.state.angle ? `transform: translate(${t2.x}px, ${t2.y}px);` : `transform: translate3d(${t2.x}px, ${t2.y}px, 0) rotate(${this.state.angle}rad);`);
            this.element.style.cssText = s2;
          }
          simpleDraw(t2) {
            const e2 = this.render.getRect(), i2 = e2.pageWidth, s2 = e2.height, n2 = 1 === t2 ? e2.left + e2.pageWidth : e2.left, h2 = e2.top;
            this.element.classList.add("--simple"), this.element.style.cssText = `
            position: absolute; 
            display: block; 
            height: ${s2}px; 
            left: ${n2}px; 
            top: ${h2}px; 
            width: ${i2}px; 
            z-index: ${this.render.getSettings().startZIndex + 1};`;
          }
          getElement() {
            return this.element;
          }
          load() {
            this.isLoad = true;
          }
          setOrientation(t2) {
            super.setOrientation(t2), this.element.classList.remove("--left", "--right"), this.element.classList.add(1 === t2 ? "--right" : "--left");
          }
          setDrawingDensity(t2) {
            this.element.classList.remove("--soft", "--hard"), this.element.classList.add("--" + t2), super.setDrawingDensity(t2);
          }
        }
        class o extends s {
          constructor(t2, e2, i2, s2) {
            super(t2, e2), this.element = i2, this.pagesElement = s2;
          }
          load() {
            for (const t2 of this.pagesElement) {
              const e2 = new r(this.render, t2, "hard" === t2.dataset.density ? "hard" : "soft");
              e2.load(), this.pages.push(e2);
            }
            this.createSpread();
          }
        }
        class a {
          constructor(t2, e2, i2, s2) {
            this.direction = t2, this.corner = e2, this.topIntersectPoint = null, this.sideIntersectPoint = null, this.bottomIntersectPoint = null, this.pageWidth = parseInt(i2, 10), this.pageHeight = parseInt(s2, 10);
          }
          calc(t2) {
            try {
              return this.position = this.calcAngleAndPosition(t2), this.calculateIntersectPoint(this.position), true;
            } catch (t3) {
              return false;
            }
          }
          getFlippingClipArea() {
            const t2 = [];
            let e2 = false;
            return t2.push(this.rect.topLeft), t2.push(this.topIntersectPoint), null === this.sideIntersectPoint ? e2 = true : (t2.push(this.sideIntersectPoint), null === this.bottomIntersectPoint && (e2 = false)), t2.push(this.bottomIntersectPoint), (e2 || "bottom" === this.corner) && t2.push(this.rect.bottomLeft), t2;
          }
          getBottomClipArea() {
            const t2 = [];
            return t2.push(this.topIntersectPoint), "top" === this.corner ? t2.push({ x: this.pageWidth, y: 0 }) : (null !== this.topIntersectPoint && t2.push({ x: this.pageWidth, y: 0 }), t2.push({ x: this.pageWidth, y: this.pageHeight })), null !== this.sideIntersectPoint ? h.GetDistanceBetweenTwoPoint(this.sideIntersectPoint, this.topIntersectPoint) >= 10 && t2.push(this.sideIntersectPoint) : "top" === this.corner && t2.push({ x: this.pageWidth, y: this.pageHeight }), t2.push(this.bottomIntersectPoint), t2.push(this.topIntersectPoint), t2;
          }
          getAngle() {
            return 0 === this.direction ? -this.angle : this.angle;
          }
          getRect() {
            return this.rect;
          }
          getPosition() {
            return this.position;
          }
          getActiveCorner() {
            return 0 === this.direction ? this.rect.topLeft : this.rect.topRight;
          }
          getDirection() {
            return this.direction;
          }
          getFlippingProgress() {
            return Math.abs((this.position.x - this.pageWidth) / (2 * this.pageWidth) * 100);
          }
          getCorner() {
            return this.corner;
          }
          getBottomPagePosition() {
            return 1 === this.direction ? { x: this.pageWidth, y: 0 } : { x: 0, y: 0 };
          }
          getShadowStartPoint() {
            return "top" === this.corner ? this.topIntersectPoint : null !== this.sideIntersectPoint ? this.sideIntersectPoint : this.topIntersectPoint;
          }
          getShadowAngle() {
            const t2 = h.GetAngleBetweenTwoLine(this.getSegmentToShadowLine(), [{ x: 0, y: 0 }, { x: this.pageWidth, y: 0 }]);
            return 0 === this.direction ? t2 : Math.PI - t2;
          }
          calcAngleAndPosition(t2) {
            let e2 = t2;
            if (this.updateAngleAndGeometry(e2), e2 = "top" === this.corner ? this.checkPositionAtCenterLine(e2, { x: 0, y: 0 }, { x: 0, y: this.pageHeight }) : this.checkPositionAtCenterLine(e2, { x: 0, y: this.pageHeight }, { x: 0, y: 0 }), Math.abs(e2.x - this.pageWidth) < 1 && Math.abs(e2.y) < 1) throw new Error("Point is too small");
            return e2;
          }
          updateAngleAndGeometry(t2) {
            this.angle = this.calculateAngle(t2), this.rect = this.getPageRect(t2);
          }
          calculateAngle(t2) {
            const e2 = this.pageWidth - t2.x + 1, i2 = "bottom" === this.corner ? this.pageHeight - t2.y : t2.y;
            let s2 = 2 * Math.acos(e2 / Math.sqrt(i2 * i2 + e2 * e2));
            i2 < 0 && (s2 = -s2);
            const n2 = Math.PI - s2;
            if (!isFinite(s2) || n2 >= 0 && n2 < 3e-3) throw new Error("The G point is too small");
            return "bottom" === this.corner && (s2 = -s2), s2;
          }
          getPageRect(t2) {
            return "top" === this.corner ? this.getRectFromBasePoint([{ x: 0, y: 0 }, { x: this.pageWidth, y: 0 }, { x: 0, y: this.pageHeight }, { x: this.pageWidth, y: this.pageHeight }], t2) : this.getRectFromBasePoint([{ x: 0, y: -this.pageHeight }, { x: this.pageWidth, y: -this.pageHeight }, { x: 0, y: 0 }, { x: this.pageWidth, y: 0 }], t2);
          }
          getRectFromBasePoint(t2, e2) {
            return { topLeft: this.getRotatedPoint(t2[0], e2), topRight: this.getRotatedPoint(t2[1], e2), bottomLeft: this.getRotatedPoint(t2[2], e2), bottomRight: this.getRotatedPoint(t2[3], e2) };
          }
          getRotatedPoint(t2, e2) {
            return { x: t2.x * Math.cos(this.angle) + t2.y * Math.sin(this.angle) + e2.x, y: t2.y * Math.cos(this.angle) - t2.x * Math.sin(this.angle) + e2.y };
          }
          calculateIntersectPoint(t2) {
            const e2 = { left: -1, top: -1, width: this.pageWidth + 2, height: this.pageHeight + 2 };
            "top" === this.corner ? (this.topIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [t2, this.rect.topRight], [{ x: 0, y: 0 }, { x: this.pageWidth, y: 0 }]), this.sideIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [t2, this.rect.bottomLeft], [{ x: this.pageWidth, y: 0 }, { x: this.pageWidth, y: this.pageHeight }]), this.bottomIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [this.rect.bottomLeft, this.rect.bottomRight], [{ x: 0, y: this.pageHeight }, { x: this.pageWidth, y: this.pageHeight }])) : (this.topIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [this.rect.topLeft, this.rect.topRight], [{ x: 0, y: 0 }, { x: this.pageWidth, y: 0 }]), this.sideIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [t2, this.rect.topLeft], [{ x: this.pageWidth, y: 0 }, { x: this.pageWidth, y: this.pageHeight }]), this.bottomIntersectPoint = h.GetIntersectBetweenTwoSegment(e2, [this.rect.bottomLeft, this.rect.bottomRight], [{ x: 0, y: this.pageHeight }, { x: this.pageWidth, y: this.pageHeight }]));
          }
          checkPositionAtCenterLine(t2, e2, i2) {
            let s2 = t2;
            const n2 = h.LimitPointToCircle(e2, this.pageWidth, s2);
            s2 !== n2 && (s2 = n2, this.updateAngleAndGeometry(s2));
            const r2 = Math.sqrt(Math.pow(this.pageWidth, 2) + Math.pow(this.pageHeight, 2));
            let o2 = this.rect.bottomRight, a2 = this.rect.topLeft;
            if ("bottom" === this.corner && (o2 = this.rect.topRight, a2 = this.rect.bottomLeft), o2.x <= 0) {
              const t3 = h.LimitPointToCircle(i2, r2, a2);
              t3 !== s2 && (s2 = t3, this.updateAngleAndGeometry(s2));
            }
            return s2;
          }
          getSegmentToShadowLine() {
            const t2 = this.getShadowStartPoint();
            return [t2, t2 !== this.sideIntersectPoint && null !== this.sideIntersectPoint ? this.sideIntersectPoint : this.bottomIntersectPoint];
          }
        }
        class g {
          constructor(t2, e2) {
            this.flippingPage = null, this.bottomPage = null, this.calc = null, this.state = "read", this.render = t2, this.app = e2;
          }
          fold(t2) {
            this.setState("user_fold"), null === this.calc && this.start(t2), this.do(this.render.convertToPage(t2));
          }
          flip(t2) {
            if (this.app.getSettings().disableFlipByClick && !this.isPointOnCorners(t2)) return;
            if (null !== this.calc && this.render.finishAnimation(), !this.start(t2)) return;
            const e2 = this.getBoundsRect();
            this.setState("flipping");
            const i2 = e2.height / 10, s2 = "bottom" === this.calc.getCorner() ? e2.height - i2 : i2, n2 = "bottom" === this.calc.getCorner() ? e2.height : 0;
            this.calc.calc({ x: e2.pageWidth - i2, y: s2 }), this.animateFlippingTo({ x: e2.pageWidth - i2, y: s2 }, { x: -e2.pageWidth, y: n2 }, true);
          }
          start(t2) {
            this.reset();
            const e2 = this.render.convertToBook(t2), i2 = this.getBoundsRect(), s2 = this.getDirectionByPoint(e2), n2 = e2.y >= i2.height / 2 ? "bottom" : "top";
            if (!this.checkDirection(s2)) return false;
            try {
              if (this.flippingPage = this.app.getPageCollection().getFlippingPage(s2), this.bottomPage = this.app.getPageCollection().getBottomPage(s2), "landscape" === this.render.getOrientation()) if (1 === s2) {
                const t3 = this.app.getPageCollection().nextBy(this.flippingPage);
                null !== t3 && this.flippingPage.getDensity() !== t3.getDensity() && (this.flippingPage.setDrawingDensity("hard"), t3.setDrawingDensity("hard"));
              } else {
                const t3 = this.app.getPageCollection().prevBy(this.flippingPage);
                null !== t3 && this.flippingPage.getDensity() !== t3.getDensity() && (this.flippingPage.setDrawingDensity("hard"), t3.setDrawingDensity("hard"));
              }
              return this.render.setDirection(s2), this.calc = new a(s2, n2, i2.pageWidth.toString(10), i2.height.toString(10)), true;
            } catch (t3) {
              return false;
            }
          }
          do(t2) {
            if (null !== this.calc && this.calc.calc(t2)) {
              const t3 = this.calc.getFlippingProgress();
              this.bottomPage.setArea(this.calc.getBottomClipArea()), this.bottomPage.setPosition(this.calc.getBottomPagePosition()), this.bottomPage.setAngle(0), this.bottomPage.setHardAngle(0), this.flippingPage.setArea(this.calc.getFlippingClipArea()), this.flippingPage.setPosition(this.calc.getActiveCorner()), this.flippingPage.setAngle(this.calc.getAngle()), 0 === this.calc.getDirection() ? this.flippingPage.setHardAngle(90 * (200 - 2 * t3) / 100) : this.flippingPage.setHardAngle(-90 * (200 - 2 * t3) / 100), this.render.setPageRect(this.calc.getRect()), this.render.setBottomPage(this.bottomPage), this.render.setFlippingPage(this.flippingPage), this.render.setShadowData(this.calc.getShadowStartPoint(), this.calc.getShadowAngle(), t3, this.calc.getDirection());
            }
          }
          flipToPage(t2, e2) {
            const i2 = this.app.getPageCollection().getCurrentSpreadIndex(), s2 = this.app.getPageCollection().getSpreadIndexByPage(t2);
            try {
              s2 > i2 && (this.app.getPageCollection().setCurrentSpreadIndex(s2 - 1), this.flipNext(e2)), s2 < i2 && (this.app.getPageCollection().setCurrentSpreadIndex(s2 + 1), this.flipPrev(e2));
            } catch (t3) {
            }
          }
          flipNext(t2) {
            this.flip({ x: this.render.getRect().left + 2 * this.render.getRect().pageWidth - 10, y: "top" === t2 ? 1 : this.render.getRect().height - 2 });
          }
          flipPrev(t2) {
            this.flip({ x: 10, y: "top" === t2 ? 1 : this.render.getRect().height - 2 });
          }
          stopMove() {
            if (null === this.calc) return;
            const t2 = this.calc.getPosition(), e2 = this.getBoundsRect(), i2 = "bottom" === this.calc.getCorner() ? e2.height : 0;
            t2.x <= 0 ? this.animateFlippingTo(t2, { x: -e2.pageWidth, y: i2 }, true) : this.animateFlippingTo(t2, { x: e2.pageWidth, y: i2 }, false);
          }
          showCorner(t2) {
            if (!this.checkState("read", "fold_corner")) return;
            const e2 = this.getBoundsRect(), i2 = e2.pageWidth;
            if (this.isPointOnCorners(t2)) if (null === this.calc) {
              if (!this.start(t2)) return;
              this.setState("fold_corner"), this.calc.calc({ x: i2 - 1, y: 1 });
              const s2 = 50, n2 = "bottom" === this.calc.getCorner() ? e2.height - 1 : 1, h2 = "bottom" === this.calc.getCorner() ? e2.height - s2 : s2;
              this.animateFlippingTo({ x: i2 - 1, y: n2 }, { x: i2 - s2, y: h2 }, false, false);
            } else this.do(this.render.convertToPage(t2));
            else this.setState("read"), this.render.finishAnimation(), this.stopMove();
          }
          animateFlippingTo(t2, e2, i2, s2 = true) {
            const n2 = h.GetCordsFromTwoPoint(t2, e2), r2 = [];
            for (const t3 of n2) r2.push(() => this.do(t3));
            const o2 = this.getAnimationDuration(n2.length);
            this.render.startAnimation(r2, o2, () => {
              this.calc && (i2 && (1 === this.calc.getDirection() ? this.app.turnToPrevPage() : this.app.turnToNextPage()), s2 && (this.render.setBottomPage(null), this.render.setFlippingPage(null), this.render.clearShadow(), this.setState("read"), this.reset()));
            });
          }
          getCalculation() {
            return this.calc;
          }
          getState() {
            return this.state;
          }
          setState(t2) {
            this.state !== t2 && (this.app.updateState(t2), this.state = t2);
          }
          getDirectionByPoint(t2) {
            const e2 = this.getBoundsRect();
            if ("portrait" === this.render.getOrientation()) {
              if (t2.x - e2.pageWidth <= e2.width / 5) return 1;
            } else if (t2.x < e2.width / 2) return 1;
            return 0;
          }
          getAnimationDuration(t2) {
            const e2 = this.app.getSettings().flippingTime;
            return t2 >= 1e3 ? e2 : t2 / 1e3 * e2;
          }
          checkDirection(t2) {
            return 0 === t2 ? this.app.getCurrentPageIndex() < this.app.getPageCount() - 1 : this.app.getCurrentPageIndex() >= 1;
          }
          reset() {
            this.calc = null, this.flippingPage = null, this.bottomPage = null;
          }
          getBoundsRect() {
            return this.render.getRect();
          }
          checkState(...t2) {
            for (const e2 of t2) if (this.state === e2) return true;
            return false;
          }
          isPointOnCorners(t2) {
            const e2 = this.getBoundsRect(), i2 = e2.pageWidth, s2 = Math.sqrt(Math.pow(i2, 2) + Math.pow(e2.height, 2)) / 5, n2 = this.render.convertToBook(t2);
            return n2.x > 0 && n2.y > 0 && n2.x < e2.width && n2.y < e2.height && (n2.x < s2 || n2.x > e2.width - s2) && (n2.y < s2 || n2.y > e2.height - s2);
          }
        }
        class l {
          constructor(t2, e2) {
            this.leftPage = null, this.rightPage = null, this.flippingPage = null, this.bottomPage = null, this.direction = null, this.orientation = null, this.shadow = null, this.animation = null, this.pageRect = null, this.boundsRect = null, this.timer = 0, this.safari = false, this.setting = e2, this.app = t2;
            const i2 = new RegExp("Version\\/[\\d\\.]+.*Safari/");
            this.safari = null !== i2.exec(window.navigator.userAgent);
          }
          render(t2) {
            if (null !== this.animation) {
              const e2 = Math.round((t2 - this.animation.startedAt) / this.animation.durationFrame);
              e2 < this.animation.frames.length ? this.animation.frames[e2]() : (this.animation.onAnimateEnd(), this.animation = null);
            }
            this.timer = t2, this.drawFrame();
          }
          start() {
            this.update();
            const t2 = (e2) => {
              this.render(e2), requestAnimationFrame(t2);
            };
            requestAnimationFrame(t2);
          }
          startAnimation(t2, e2, i2) {
            this.finishAnimation(), this.animation = { frames: t2, duration: e2, durationFrame: e2 / t2.length, onAnimateEnd: i2, startedAt: this.timer };
          }
          finishAnimation() {
            null !== this.animation && (this.animation.frames[this.animation.frames.length - 1](), null !== this.animation.onAnimateEnd && this.animation.onAnimateEnd()), this.animation = null;
          }
          update() {
            this.boundsRect = null;
            const t2 = this.calculateBoundsRect();
            this.orientation !== t2 && (this.orientation = t2, this.app.updateOrientation(t2));
          }
          calculateBoundsRect() {
            let t2 = "landscape";
            const e2 = this.getBlockWidth(), i2 = e2 / 2, s2 = this.getBlockHeight() / 2, n2 = this.setting.width / this.setting.height;
            let h2 = this.setting.width, r2 = this.setting.height, o2 = i2 - h2;
            return "stretch" === this.setting.size ? (e2 < 2 * this.setting.minWidth && this.app.getSettings().usePortrait && (t2 = "portrait"), h2 = "portrait" === t2 ? this.getBlockWidth() : this.getBlockWidth() / 2, h2 > this.setting.maxWidth && (h2 = this.setting.maxWidth), r2 = h2 / n2, r2 > this.getBlockHeight() && (r2 = this.getBlockHeight(), h2 = r2 * n2), o2 = "portrait" === t2 ? i2 - h2 / 2 - h2 : i2 - h2) : e2 < 2 * h2 && this.app.getSettings().usePortrait && (t2 = "portrait", o2 = i2 - h2 / 2 - h2), this.boundsRect = { left: o2, top: s2 - r2 / 2, width: 2 * h2, height: r2, pageWidth: h2 }, t2;
          }
          setShadowData(t2, e2, i2, s2) {
            if (!this.app.getSettings().drawShadow) return;
            const n2 = 100 * this.getSettings().maxShadowOpacity;
            this.shadow = { pos: t2, angle: e2, width: 3 * this.getRect().pageWidth / 4 * i2 / 100, opacity: (100 - i2) * n2 / 100 / 100, direction: s2, progress: 2 * i2 };
          }
          clearShadow() {
            this.shadow = null;
          }
          getBlockWidth() {
            return this.app.getUI().getDistElement().offsetWidth;
          }
          getBlockHeight() {
            return this.app.getUI().getDistElement().offsetHeight;
          }
          getDirection() {
            return this.direction;
          }
          getRect() {
            return null === this.boundsRect && this.calculateBoundsRect(), this.boundsRect;
          }
          getSettings() {
            return this.app.getSettings();
          }
          getOrientation() {
            return this.orientation;
          }
          setPageRect(t2) {
            this.pageRect = t2;
          }
          setDirection(t2) {
            this.direction = t2;
          }
          setRightPage(t2) {
            null !== t2 && t2.setOrientation(1), this.rightPage = t2;
          }
          setLeftPage(t2) {
            null !== t2 && t2.setOrientation(0), this.leftPage = t2;
          }
          setBottomPage(t2) {
            null !== t2 && t2.setOrientation(1 === this.direction ? 0 : 1), this.bottomPage = t2;
          }
          setFlippingPage(t2) {
            null !== t2 && t2.setOrientation(0 === this.direction && "portrait" !== this.orientation ? 0 : 1), this.flippingPage = t2;
          }
          convertToBook(t2) {
            const e2 = this.getRect();
            return { x: t2.x - e2.left, y: t2.y - e2.top };
          }
          isSafari() {
            return this.safari;
          }
          convertToPage(t2, e2) {
            e2 || (e2 = this.direction);
            const i2 = this.getRect();
            return { x: 0 === e2 ? t2.x - i2.left - i2.width / 2 : i2.width / 2 - t2.x + i2.left, y: t2.y - i2.top };
          }
          convertToGlobal(t2, e2) {
            if (e2 || (e2 = this.direction), null == t2) return null;
            const i2 = this.getRect();
            return { x: 0 === e2 ? t2.x + i2.left + i2.width / 2 : i2.width / 2 - t2.x + i2.left, y: t2.y + i2.top };
          }
          convertRectToGlobal(t2, e2) {
            return e2 || (e2 = this.direction), { topLeft: this.convertToGlobal(t2.topLeft, e2), topRight: this.convertToGlobal(t2.topRight, e2), bottomLeft: this.convertToGlobal(t2.bottomLeft, e2), bottomRight: this.convertToGlobal(t2.bottomRight, e2) };
          }
        }
        class d extends l {
          constructor(t2, e2, i2) {
            super(t2, e2), this.canvas = i2, this.ctx = i2.getContext("2d");
          }
          getContext() {
            return this.ctx;
          }
          reload() {
          }
          drawFrame() {
            this.clear(), "portrait" !== this.orientation && null != this.leftPage && this.leftPage.simpleDraw(0), null != this.rightPage && this.rightPage.simpleDraw(1), null != this.bottomPage && this.bottomPage.draw(), this.drawBookShadow(), null != this.flippingPage && this.flippingPage.draw(), null != this.shadow && (this.drawOuterShadow(), this.drawInnerShadow());
            const t2 = this.getRect();
            "portrait" === this.orientation && (this.ctx.beginPath(), this.ctx.rect(t2.left + t2.pageWidth, t2.top, t2.width, t2.height), this.ctx.clip());
          }
          drawBookShadow() {
            const t2 = this.getRect();
            this.ctx.save(), this.ctx.beginPath();
            const e2 = t2.width / 20;
            this.ctx.rect(t2.left, t2.top, t2.width, t2.height);
            const i2 = { x: t2.left + t2.width / 2 - e2 / 2, y: 0 };
            this.ctx.translate(i2.x, i2.y);
            const s2 = this.ctx.createLinearGradient(0, 0, e2, 0);
            s2.addColorStop(0, "rgba(0, 0, 0, 0)"), s2.addColorStop(0.4, "rgba(0, 0, 0, 0.2)"), s2.addColorStop(0.49, "rgba(0, 0, 0, 0.1)"), s2.addColorStop(0.5, "rgba(0, 0, 0, 0.5)"), s2.addColorStop(0.51, "rgba(0, 0, 0, 0.4)"), s2.addColorStop(1, "rgba(0, 0, 0, 0)"), this.ctx.clip(), this.ctx.fillStyle = s2, this.ctx.fillRect(0, 0, e2, 2 * t2.height), this.ctx.restore();
          }
          drawOuterShadow() {
            const t2 = this.getRect();
            this.ctx.save(), this.ctx.beginPath(), this.ctx.rect(t2.left, t2.top, t2.width, t2.height);
            const e2 = this.convertToGlobal({ x: this.shadow.pos.x, y: this.shadow.pos.y });
            this.ctx.translate(e2.x, e2.y), this.ctx.rotate(Math.PI + this.shadow.angle + Math.PI / 2);
            const i2 = this.ctx.createLinearGradient(0, 0, this.shadow.width, 0);
            0 === this.shadow.direction ? (this.ctx.translate(0, -100), i2.addColorStop(0, "rgba(0, 0, 0, " + this.shadow.opacity + ")"), i2.addColorStop(1, "rgba(0, 0, 0, 0)")) : (this.ctx.translate(-this.shadow.width, -100), i2.addColorStop(0, "rgba(0, 0, 0, 0)"), i2.addColorStop(1, "rgba(0, 0, 0, " + this.shadow.opacity + ")")), this.ctx.clip(), this.ctx.fillStyle = i2, this.ctx.fillRect(0, 0, this.shadow.width, 2 * t2.height), this.ctx.restore();
          }
          drawInnerShadow() {
            const t2 = this.getRect();
            this.ctx.save(), this.ctx.beginPath();
            const e2 = this.convertToGlobal({ x: this.shadow.pos.x, y: this.shadow.pos.y }), i2 = this.convertRectToGlobal(this.pageRect);
            this.ctx.moveTo(i2.topLeft.x, i2.topLeft.y), this.ctx.lineTo(i2.topRight.x, i2.topRight.y), this.ctx.lineTo(i2.bottomRight.x, i2.bottomRight.y), this.ctx.lineTo(i2.bottomLeft.x, i2.bottomLeft.y), this.ctx.translate(e2.x, e2.y), this.ctx.rotate(Math.PI + this.shadow.angle + Math.PI / 2);
            const s2 = 3 * this.shadow.width / 4, n2 = this.ctx.createLinearGradient(0, 0, s2, 0);
            0 === this.shadow.direction ? (this.ctx.translate(-s2, -100), n2.addColorStop(1, "rgba(0, 0, 0, " + this.shadow.opacity + ")"), n2.addColorStop(0.9, "rgba(0, 0, 0, 0.05)"), n2.addColorStop(0.7, "rgba(0, 0, 0, " + this.shadow.opacity + ")"), n2.addColorStop(0, "rgba(0, 0, 0, 0)")) : (this.ctx.translate(0, -100), n2.addColorStop(0, "rgba(0, 0, 0, " + this.shadow.opacity + ")"), n2.addColorStop(0.1, "rgba(0, 0, 0, 0.05)"), n2.addColorStop(0.3, "rgba(0, 0, 0, " + this.shadow.opacity + ")"), n2.addColorStop(1, "rgba(0, 0, 0, 0)")), this.ctx.clip(), this.ctx.fillStyle = n2, this.ctx.fillRect(0, 0, s2, 2 * t2.height), this.ctx.restore();
          }
          clear() {
            this.ctx.fillStyle = "white", this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
          }
        }
        class p {
          constructor(t2, e2, i2) {
            this.touchPoint = null, this.swipeTimeout = 250, this.onResize = () => {
              this.update();
            }, this.onMouseDown = (t3) => {
              if (this.checkTarget(t3.target)) {
                const e3 = this.getMousePos(t3.clientX, t3.clientY);
                this.app.startUserTouch(e3), t3.preventDefault();
              }
            }, this.onTouchStart = (t3) => {
              if (this.checkTarget(t3.target) && t3.changedTouches.length > 0) {
                const e3 = t3.changedTouches[0], i3 = this.getMousePos(e3.clientX, e3.clientY);
                this.touchPoint = { point: i3, time: Date.now() }, setTimeout(() => {
                  null !== this.touchPoint && this.app.startUserTouch(i3);
                }, this.swipeTimeout), this.app.getSettings().mobileScrollSupport || t3.preventDefault();
              }
            }, this.onMouseUp = (t3) => {
              const e3 = this.getMousePos(t3.clientX, t3.clientY);
              this.app.userStop(e3);
            }, this.onMouseMove = (t3) => {
              const e3 = this.getMousePos(t3.clientX, t3.clientY);
              this.app.userMove(e3, false);
            }, this.onTouchMove = (t3) => {
              if (t3.changedTouches.length > 0) {
                const e3 = t3.changedTouches[0], i3 = this.getMousePos(e3.clientX, e3.clientY);
                this.app.getSettings().mobileScrollSupport ? (null !== this.touchPoint && (Math.abs(this.touchPoint.point.x - i3.x) > 10 || "read" !== this.app.getState()) && t3.cancelable && this.app.userMove(i3, true), "read" !== this.app.getState() && t3.preventDefault()) : this.app.userMove(i3, true);
              }
            }, this.onTouchEnd = (t3) => {
              if (t3.changedTouches.length > 0) {
                const e3 = t3.changedTouches[0], i3 = this.getMousePos(e3.clientX, e3.clientY);
                let s3 = false;
                if (null !== this.touchPoint) {
                  const t4 = i3.x - this.touchPoint.point.x, e4 = Math.abs(i3.y - this.touchPoint.point.y);
                  Math.abs(t4) > this.swipeDistance && e4 < 2 * this.swipeDistance && Date.now() - this.touchPoint.time < this.swipeTimeout && (t4 > 0 ? this.app.flipPrev(this.touchPoint.point.y < this.app.getRender().getRect().height / 2 ? "top" : "bottom") : this.app.flipNext(this.touchPoint.point.y < this.app.getRender().getRect().height / 2 ? "top" : "bottom"), s3 = true), this.touchPoint = null;
                }
                this.app.userStop(i3, s3);
              }
            }, this.parentElement = t2, t2.classList.add("stf__parent"), t2.insertAdjacentHTML("afterbegin", '<div class="stf__wrapper"></div>'), this.wrapper = t2.querySelector(".stf__wrapper"), this.app = e2;
            const s2 = this.app.getSettings().usePortrait ? 1 : 2;
            t2.style.minWidth = i2.minWidth * s2 + "px", t2.style.minHeight = i2.minHeight + "px", "fixed" === i2.size && (t2.style.minWidth = i2.width * s2 + "px", t2.style.minHeight = i2.height + "px"), i2.autoSize && (t2.style.width = "100%", t2.style.maxWidth = 2 * i2.maxWidth + "px"), t2.style.display = "block", window.addEventListener("resize", this.onResize, false), this.swipeDistance = i2.swipeDistance;
          }
          destroy() {
            this.app.getSettings().useMouseEvents && this.removeHandlers(), this.distElement.remove(), this.wrapper.remove();
          }
          getDistElement() {
            return this.distElement;
          }
          getWrapper() {
            return this.wrapper;
          }
          setOrientationStyle(t2) {
            this.wrapper.classList.remove("--portrait", "--landscape"), "portrait" === t2 ? (this.app.getSettings().autoSize && (this.wrapper.style.paddingBottom = this.app.getSettings().height / this.app.getSettings().width * 100 + "%"), this.wrapper.classList.add("--portrait")) : (this.app.getSettings().autoSize && (this.wrapper.style.paddingBottom = this.app.getSettings().height / (2 * this.app.getSettings().width) * 100 + "%"), this.wrapper.classList.add("--landscape")), this.update();
          }
          removeHandlers() {
            window.removeEventListener("resize", this.onResize), this.distElement.removeEventListener("mousedown", this.onMouseDown), this.distElement.removeEventListener("touchstart", this.onTouchStart), window.removeEventListener("mousemove", this.onMouseMove), window.removeEventListener("touchmove", this.onTouchMove), window.removeEventListener("mouseup", this.onMouseUp), window.removeEventListener("touchend", this.onTouchEnd);
          }
          setHandlers() {
            window.addEventListener("resize", this.onResize, false), this.app.getSettings().useMouseEvents && (this.distElement.addEventListener("mousedown", this.onMouseDown), this.distElement.addEventListener("touchstart", this.onTouchStart), window.addEventListener("mousemove", this.onMouseMove), window.addEventListener("touchmove", this.onTouchMove, { passive: !this.app.getSettings().mobileScrollSupport }), window.addEventListener("mouseup", this.onMouseUp), window.addEventListener("touchend", this.onTouchEnd));
          }
          getMousePos(t2, e2) {
            const i2 = this.distElement.getBoundingClientRect();
            return { x: t2 - i2.left, y: e2 - i2.top };
          }
          checkTarget(t2) {
            return !this.app.getSettings().clickEventForward || !["a", "button"].includes(t2.tagName.toLowerCase());
          }
        }
        class c extends p {
          constructor(t2, e2, i2, s2) {
            super(t2, e2, i2), this.wrapper.insertAdjacentHTML("afterbegin", '<div class="stf__block"></div>'), this.distElement = t2.querySelector(".stf__block"), this.items = s2;
            for (const t3 of s2) this.distElement.appendChild(t3);
            this.setHandlers();
          }
          clear() {
            for (const t2 of this.items) this.parentElement.appendChild(t2);
          }
          updateItems(t2) {
            this.removeHandlers(), this.distElement.innerHTML = "";
            for (const e2 of t2) this.distElement.appendChild(e2);
            this.items = t2, this.setHandlers();
          }
          update() {
            this.app.getRender().update();
          }
        }
        class u extends p {
          constructor(t2, e2, i2) {
            super(t2, e2, i2), this.wrapper.innerHTML = '<canvas class="stf__canvas"></canvas>', this.canvas = t2.querySelectorAll("canvas")[0], this.distElement = this.canvas, this.resizeCanvas(), this.setHandlers();
          }
          resizeCanvas() {
            const t2 = getComputedStyle(this.canvas), e2 = parseInt(t2.getPropertyValue("width"), 10), i2 = parseInt(t2.getPropertyValue("height"), 10);
            this.canvas.width = e2, this.canvas.height = i2;
          }
          getCanvas() {
            return this.canvas;
          }
          update() {
            this.resizeCanvas(), this.app.getRender().update();
          }
        }
        class w extends l {
          constructor(t2, e2, i2) {
            super(t2, e2), this.outerShadow = null, this.innerShadow = null, this.hardShadow = null, this.hardInnerShadow = null, this.element = i2, this.createShadows();
          }
          createShadows() {
            this.element.insertAdjacentHTML("beforeend", '<div class="stf__outerShadow"></div>\n             <div class="stf__innerShadow"></div>\n             <div class="stf__hardShadow"></div>\n             <div class="stf__hardInnerShadow"></div>'), this.outerShadow = this.element.querySelector(".stf__outerShadow"), this.innerShadow = this.element.querySelector(".stf__innerShadow"), this.hardShadow = this.element.querySelector(".stf__hardShadow"), this.hardInnerShadow = this.element.querySelector(".stf__hardInnerShadow");
          }
          clearShadow() {
            super.clearShadow(), this.outerShadow.style.cssText = "display: none", this.innerShadow.style.cssText = "display: none", this.hardShadow.style.cssText = "display: none", this.hardInnerShadow.style.cssText = "display: none";
          }
          reload() {
            this.element.querySelector(".stf__outerShadow") || this.createShadows();
          }
          drawHardInnerShadow() {
            const t2 = this.getRect(), e2 = this.shadow.progress > 100 ? 200 - this.shadow.progress : this.shadow.progress;
            let i2 = (100 - e2) * (2.5 * t2.pageWidth) / 100 + 20;
            i2 > t2.pageWidth && (i2 = t2.pageWidth);
            let s2 = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 5).toString(10)};
            width: ${i2}px;
            height: ${t2.height}px;
            background: linear-gradient(to right,
                rgba(0, 0, 0, ${this.shadow.opacity * e2 / 100}) 5%,
                rgba(0, 0, 0, 0) 100%);
            left: ${t2.left + t2.width / 2}px;
            transform-origin: 0 0;
        `;
            s2 += 0 === this.getDirection() && this.shadow.progress > 100 || 1 === this.getDirection() && this.shadow.progress <= 100 ? "transform: translate3d(0, 0, 0);" : "transform: translate3d(0, 0, 0) rotateY(180deg);", this.hardInnerShadow.style.cssText = s2;
          }
          drawHardOuterShadow() {
            const t2 = this.getRect();
            let e2 = (100 - (this.shadow.progress > 100 ? 200 - this.shadow.progress : this.shadow.progress)) * (2.5 * t2.pageWidth) / 100 + 20;
            e2 > t2.pageWidth && (e2 = t2.pageWidth);
            let i2 = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 4).toString(10)};
            width: ${e2}px;
            height: ${t2.height}px;
            background: linear-gradient(to left, rgba(0, 0, 0, ${this.shadow.opacity}) 5%, rgba(0, 0, 0, 0) 100%);
            left: ${t2.left + t2.width / 2}px;
            transform-origin: 0 0;
        `;
            i2 += 0 === this.getDirection() && this.shadow.progress > 100 || 1 === this.getDirection() && this.shadow.progress <= 100 ? "transform: translate3d(0, 0, 0) rotateY(180deg);" : "transform: translate3d(0, 0, 0);", this.hardShadow.style.cssText = i2;
          }
          drawInnerShadow() {
            const t2 = this.getRect(), e2 = 3 * this.shadow.width / 4, i2 = 0 === this.getDirection() ? e2 : 0, s2 = 0 === this.getDirection() ? "to left" : "to right", n2 = this.convertToGlobal(this.shadow.pos), r2 = this.shadow.angle + 3 * Math.PI / 2, o2 = [this.pageRect.topLeft, this.pageRect.topRight, this.pageRect.bottomRight, this.pageRect.bottomLeft];
            let a2 = "polygon( ";
            for (const t3 of o2) {
              let e3 = 1 === this.getDirection() ? { x: -t3.x + this.shadow.pos.x, y: t3.y - this.shadow.pos.y } : { x: t3.x - this.shadow.pos.x, y: t3.y - this.shadow.pos.y };
              e3 = h.GetRotatedPoint(e3, { x: i2, y: 100 }, r2), a2 += e3.x + "px " + e3.y + "px, ";
            }
            a2 = a2.slice(0, -2), a2 += ")";
            const g2 = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 10).toString(10)};
            width: ${e2}px;
            height: ${2 * t2.height}px;
            background: linear-gradient(${s2},
                rgba(0, 0, 0, ${this.shadow.opacity}) 5%,
                rgba(0, 0, 0, 0.05) 15%,
                rgba(0, 0, 0, ${this.shadow.opacity}) 35%,
                rgba(0, 0, 0, 0) 100%);
            transform-origin: ${i2}px 100px;
            transform: translate3d(${n2.x - i2}px, ${n2.y - 100}px, 0) rotate(${r2}rad);
            clip-path: ${a2};
            -webkit-clip-path: ${a2};
        `;
            this.innerShadow.style.cssText = g2;
          }
          drawOuterShadow() {
            const t2 = this.getRect(), e2 = this.convertToGlobal({ x: this.shadow.pos.x, y: this.shadow.pos.y }), i2 = this.shadow.angle + 3 * Math.PI / 2, s2 = 1 === this.getDirection() ? this.shadow.width : 0, n2 = 0 === this.getDirection() ? "to right" : "to left", r2 = [{ x: 0, y: 0 }, { x: t2.pageWidth, y: 0 }, { x: t2.pageWidth, y: t2.height }, { x: 0, y: t2.height }];
            let o2 = "polygon( ";
            for (const t3 of r2) if (null !== t3) {
              let e3 = 1 === this.getDirection() ? { x: -t3.x + this.shadow.pos.x, y: t3.y - this.shadow.pos.y } : { x: t3.x - this.shadow.pos.x, y: t3.y - this.shadow.pos.y };
              e3 = h.GetRotatedPoint(e3, { x: s2, y: 100 }, i2), o2 += e3.x + "px " + e3.y + "px, ";
            }
            o2 = o2.slice(0, -2), o2 += ")";
            const a2 = `
            display: block;
            z-index: ${(this.getSettings().startZIndex + 10).toString(10)};
            width: ${this.shadow.width}px;
            height: ${2 * t2.height}px;
            background: linear-gradient(${n2}, rgba(0, 0, 0, ${this.shadow.opacity}), rgba(0, 0, 0, 0));
            transform-origin: ${s2}px 100px;
            transform: translate3d(${e2.x - s2}px, ${e2.y - 100}px, 0) rotate(${i2}rad);
            clip-path: ${o2};
            -webkit-clip-path: ${o2};
        `;
            this.outerShadow.style.cssText = a2;
          }
          drawLeftPage() {
            "portrait" !== this.orientation && null !== this.leftPage && (1 === this.direction && null !== this.flippingPage && "hard" === this.flippingPage.getDrawingDensity() ? (this.leftPage.getElement().style.zIndex = (this.getSettings().startZIndex + 5).toString(10), this.leftPage.setHardDrawingAngle(180 + this.flippingPage.getHardAngle()), this.leftPage.draw(this.flippingPage.getDrawingDensity())) : this.leftPage.simpleDraw(0));
          }
          drawRightPage() {
            null !== this.rightPage && (0 === this.direction && null !== this.flippingPage && "hard" === this.flippingPage.getDrawingDensity() ? (this.rightPage.getElement().style.zIndex = (this.getSettings().startZIndex + 5).toString(10), this.rightPage.setHardDrawingAngle(180 + this.flippingPage.getHardAngle()), this.rightPage.draw(this.flippingPage.getDrawingDensity())) : this.rightPage.simpleDraw(1));
          }
          drawBottomPage() {
            if (null === this.bottomPage) return;
            const t2 = null != this.flippingPage ? this.flippingPage.getDrawingDensity() : null;
            "portrait" === this.orientation && 1 === this.direction || (this.bottomPage.getElement().style.zIndex = (this.getSettings().startZIndex + 3).toString(10), this.bottomPage.draw(t2));
          }
          drawFrame() {
            this.clear(), this.drawLeftPage(), this.drawRightPage(), this.drawBottomPage(), null != this.flippingPage && (this.flippingPage.getElement().style.zIndex = (this.getSettings().startZIndex + 5).toString(10), this.flippingPage.draw()), null != this.shadow && null !== this.flippingPage && ("soft" === this.flippingPage.getDrawingDensity() ? (this.drawOuterShadow(), this.drawInnerShadow()) : (this.drawHardOuterShadow(), this.drawHardInnerShadow()));
          }
          clear() {
            for (const t2 of this.app.getPageCollection().getPages()) t2 !== this.leftPage && t2 !== this.rightPage && t2 !== this.flippingPage && t2 !== this.bottomPage && (t2.getElement().style.cssText = "display: none"), t2.getTemporaryCopy() !== this.flippingPage && t2.hideTemporaryCopy();
          }
          update() {
            super.update(), null !== this.rightPage && this.rightPage.setOrientation(1), null !== this.leftPage && this.leftPage.setOrientation(0);
          }
        }
        class x {
          constructor() {
            this._default = { startPage: 0, size: "fixed", width: 0, height: 0, minWidth: 0, maxWidth: 0, minHeight: 0, maxHeight: 0, drawShadow: true, flippingTime: 1e3, usePortrait: true, startZIndex: 0, autoSize: true, maxShadowOpacity: 1, showCover: false, mobileScrollSupport: true, swipeDistance: 30, clickEventForward: true, useMouseEvents: true, showPageCorners: true, disableFlipByClick: false };
          }
          getSettings(t2) {
            const e2 = this._default;
            if (Object.assign(e2, t2), "stretch" !== e2.size && "fixed" !== e2.size) throw new Error('Invalid size type. Available only "fixed" and "stretch" value');
            if (e2.width <= 0 || e2.height <= 0) throw new Error("Invalid width or height");
            if (e2.flippingTime <= 0) throw new Error("Invalid flipping time");
            return "stretch" === e2.size ? (e2.minWidth <= 0 && (e2.minWidth = 100), e2.maxWidth < e2.minWidth && (e2.maxWidth = 2e3), e2.minHeight <= 0 && (e2.minHeight = 100), e2.maxHeight < e2.minHeight && (e2.maxHeight = 2e3)) : (e2.minWidth = e2.width, e2.maxWidth = e2.width, e2.minHeight = e2.height, e2.maxHeight = e2.height), e2;
          }
        }
        !function(t2, e2) {
          void 0 === e2 && (e2 = {});
          var i2 = e2.insertAt;
          if (t2 && "undefined" != typeof document) {
            var s2 = document.head || document.getElementsByTagName("head")[0], n2 = document.createElement("style");
            n2.type = "text/css", "top" === i2 && s2.firstChild ? s2.insertBefore(n2, s2.firstChild) : s2.appendChild(n2), n2.styleSheet ? n2.styleSheet.cssText = t2 : n2.appendChild(document.createTextNode(t2));
          }
        }(".stf__parent {\n  position: relative;\n  display: block;\n  box-sizing: border-box;\n  transform: translateZ(0);\n\n  -ms-touch-action: pan-y;\n  touch-action: pan-y;\n}\n\n.sft__wrapper {\n  position: relative;\n  width: 100%;\n  box-sizing: border-box;\n}\n\n.stf__parent canvas {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  left: 0;\n  top: 0;\n}\n\n.stf__block {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  box-sizing: border-box;\n  perspective: 2000px;\n}\n\n.stf__item {\n  display: none;\n  position: absolute;\n  transform-style: preserve-3d;\n}\n\n.stf__outerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__innerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__hardShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}\n\n.stf__hardInnerShadow {\n  position: absolute;\n  left: 0;\n  top: 0;\n}");
        t.PageFlip = class extends class {
          constructor() {
            this.events = /* @__PURE__ */ new Map();
          }
          on(t2, e2) {
            return this.events.has(t2) ? this.events.get(t2).push(e2) : this.events.set(t2, [e2]), this;
          }
          off(t2) {
            this.events.delete(t2);
          }
          trigger(t2, e2, i2 = null) {
            if (this.events.has(t2)) for (const s2 of this.events.get(t2)) s2({ data: i2, object: e2 });
          }
        } {
          constructor(t2, e2) {
            super(), this.isUserTouch = false, this.isUserMove = false, this.setting = null, this.pages = null, this.setting = new x().getSettings(e2), this.block = t2;
          }
          destroy() {
            this.ui.destroy(), this.block.remove();
          }
          update() {
            this.render.update(), this.pages.show();
          }
          loadFromImages(t2) {
            this.ui = new u(this.block, this, this.setting);
            const e2 = this.ui.getCanvas();
            this.render = new d(this, this.setting, e2), this.flipController = new g(this.render, this), this.pages = new n(this, this.render, t2), this.pages.load(), this.render.start(), this.pages.show(this.setting.startPage), setTimeout(() => {
              this.ui.update(), this.trigger("init", this, { page: this.setting.startPage, mode: this.render.getOrientation() });
            }, 1);
          }
          loadFromHTML(t2) {
            this.ui = new c(this.block, this, this.setting, t2), this.render = new w(this, this.setting, this.ui.getDistElement()), this.flipController = new g(this.render, this), this.pages = new o(this, this.render, this.ui.getDistElement(), t2), this.pages.load(), this.render.start(), this.pages.show(this.setting.startPage), setTimeout(() => {
              this.ui.update(), this.trigger("init", this, { page: this.setting.startPage, mode: this.render.getOrientation() });
            }, 1);
          }
          updateFromImages(t2) {
            const e2 = this.pages.getCurrentPageIndex();
            this.pages.destroy(), this.pages = new n(this, this.render, t2), this.pages.load(), this.pages.show(e2), this.trigger("update", this, { page: e2, mode: this.render.getOrientation() });
          }
          updateFromHtml(t2) {
            const e2 = this.pages.getCurrentPageIndex();
            this.pages.destroy(), this.pages = new o(this, this.render, this.ui.getDistElement(), t2), this.pages.load(), this.ui.updateItems(t2), this.render.reload(), this.pages.show(e2), this.trigger("update", this, { page: e2, mode: this.render.getOrientation() });
          }
          clear() {
            this.pages.destroy(), this.ui.clear();
          }
          turnToPrevPage() {
            this.pages.showPrev();
          }
          turnToNextPage() {
            this.pages.showNext();
          }
          turnToPage(t2) {
            this.pages.show(t2);
          }
          flipNext(t2 = "top") {
            this.flipController.flipNext(t2);
          }
          flipPrev(t2 = "top") {
            this.flipController.flipPrev(t2);
          }
          flip(t2, e2 = "top") {
            this.flipController.flipToPage(t2, e2);
          }
          updateState(t2) {
            this.trigger("changeState", this, t2);
          }
          updatePageIndex(t2) {
            this.trigger("flip", this, t2);
          }
          updateOrientation(t2) {
            this.ui.setOrientationStyle(t2), this.update(), this.trigger("changeOrientation", this, t2);
          }
          getPageCount() {
            return this.pages.getPageCount();
          }
          getCurrentPageIndex() {
            return this.pages.getCurrentPageIndex();
          }
          getPage(t2) {
            return this.pages.getPage(t2);
          }
          getRender() {
            return this.render;
          }
          getFlipController() {
            return this.flipController;
          }
          getOrientation() {
            return this.render.getOrientation();
          }
          getBoundsRect() {
            return this.render.getRect();
          }
          getSettings() {
            return this.setting;
          }
          getUI() {
            return this.ui;
          }
          getState() {
            return this.flipController.getState();
          }
          getPageCollection() {
            return this.pages;
          }
          startUserTouch(t2) {
            this.mousePosition = t2, this.isUserTouch = true, this.isUserMove = false;
          }
          userMove(t2, e2) {
            this.isUserTouch || e2 || !this.setting.showPageCorners ? this.isUserTouch && h.GetDistanceBetweenTwoPoint(this.mousePosition, t2) > 5 && (this.isUserMove = true, this.flipController.fold(t2)) : this.flipController.showCorner(t2);
          }
          userStop(t2, e2 = false) {
            this.isUserTouch && (this.isUserTouch = false, e2 || (this.isUserMove ? this.flipController.stopMove() : this.flipController.flip(t2)));
          }
        }, Object.defineProperty(t, "__esModule", { value: true });
      });
    }
  });

  // src/core/esc-manager.ts
  function registerPanelEsc(id, isVisible, close) {
    if (panelEscHandles.has(id)) return;
    panelEscHandles.set(id, escManager.register(id, { isVisible, close }));
  }
  function unregisterPanelEsc(id) {
    var _a;
    (_a = panelEscHandles.get(id)) == null ? void 0 : _a.unregister();
    panelEscHandles.delete(id);
  }
  var escManager, panelEscHandles;
  var init_esc_manager = __esm({
    "src/core/esc-manager.ts"() {
      escManager = (() => {
        const layers = [];
        let disabled = false;
        const onKeydown = (e) => {
          if (disabled) return;
          if (e.key !== "Escape") return;
          for (let i = layers.length - 1; i >= 0; i--) {
            const L = layers[i];
            try {
              if (L.isVisible()) {
                L.close();
                e.preventDefault();
                e.stopImmediatePropagation();
                return;
              }
            } catch (err) {
              layers.splice(i, 1);
            }
          }
        };
        if (typeof document !== "undefined") {
          document.addEventListener("keydown", onKeydown);
        }
        return {
          register(id, layer) {
            for (let i = layers.length - 1; i >= 0; i--) {
              if (layers[i].id === id && !layers[i].isVisible()) layers.splice(i, 1);
            }
            const rec = Object.assign({ id }, layer);
            layers.push(rec);
            return {
              unregister: () => {
                const i = layers.indexOf(rec);
                if (i !== -1) layers.splice(i, 1);
              }
            };
          },
          /** 插件卸载时软关（N1）：只置 disabled 旗标——不摘 document 监听（模块 IIFE
           *  常驻单例，Obsidian 禁用→再启用不重新求值，摘了就全站 ESC 永久失效）、
           *  不清 layers（重启用后旧层由 isVisible 判活自愈）。恢复走 arm()。 */
          destroy() {
            disabled = true;
          },
          /** 插件（重）启用时恢复 ESC 处理（main.ts onload 调用；幂等） */
          arm() {
            disabled = false;
          }
        };
      })();
      panelEscHandles = /* @__PURE__ */ new Map();
    }
  });

  // src/core/dom.ts
  function longPress(el, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M4 = 10;
    function start(e) {
      if (filter && !filter(e)) return;
      if (e.button !== void 0 && e.button !== 0) return;
      fired = false;
      moved = false;
      if (e.touches && e.touches.length) {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        touching = true;
      }
      timer = setTimeout(function() {
        timer = null;
        fired = true;
        cb(e);
      }, dur);
    }
    function cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    function move(e) {
      if (!timer || !touching || !e.touches || !e.touches.length) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - sx) > M4 || Math.abs(t.clientY - sy) > M4) {
        moved = true;
        cancel();
      }
    }
    function endFromTouch() {
      if (fired) suppressClick = true;
      touching = false;
      cancel();
    }
    function endFromMouse() {
      touching = false;
      cancel();
    }
    function onClick(e) {
      if (suppressClick) {
        suppressClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", endFromMouse);
    el.addEventListener("mouseleave", endFromMouse);
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", endFromTouch);
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchcancel", endFromTouch);
    el.addEventListener("click", onClick, true);
  }
  function swallowNextClick() {
    const swallow = (e) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      document.removeEventListener("click", swallow, true);
      e.stopPropagation();
    };
    const disarm = () => {
      document.removeEventListener("click", swallow, true);
    };
    document.addEventListener("click", swallow, true);
    document.addEventListener("mousedown", disarm, { capture: true, once: true });
  }
  function pruneDetachedOverlays() {
    for (const entry of liveOverlays) {
      if (!entry.mask.isConnected && !entry.popup.isConnected) liveOverlays.delete(entry);
    }
  }
  function createOverlay(opts) {
    pruneDetachedOverlays();
    const mask = document.createElement("div");
    mask.id = opts.maskId;
    mask.className = "bz-overlay-mask";
    mask.style.display = "none";
    mask.onclick = function(e) {
      if (e.target === mask && typeof opts.onMaskClick === "function") opts.onMaskClick();
    };
    const popup = document.createElement("div");
    popup.id = opts.popupId;
    popup.className = "bz-overlay-popup";
    popup.style.display = "none";
    popup.style.width = opts.width || "90%";
    popup.style.maxWidth = (opts.maxWidth || 400) + "px";
    topifyZ(mask, popup);
    const entry = {
      mask,
      popup,
      close: () => {
        liveOverlays.delete(entry);
        if (mask.isConnected) mask.remove();
        if (popup.isConnected) popup.remove();
      }
    };
    liveOverlays.add(entry);
    return {
      mask,
      popup,
      topify: () => topifyZ(mask, popup),
      /** 注入调用方 close（UP/RSS 管理等自带 esc 注销/单例旗标复位的收尾）：包装为
       *  「先自注销再执行」，重复触发与 closeAllOverlays 兜底都幂等 */
      registerClose: (close) => {
        entry.close = () => {
          liveOverlays.delete(entry);
          close();
        };
      }
    };
  }
  var liveOverlays;
  var init_dom = __esm({
    "src/core/dom.ts"() {
      init_notice();
      init_z_order();
      liveOverlays = /* @__PURE__ */ new Set();
    }
  });

  // src/core/domain-bus.ts
  var domain_bus_exports = {};
  __export(domain_bus_exports, {
    clearDomainEvents: () => clearDomainEvents,
    emitDomainEvent: () => emitDomainEvent,
    onDomainEvent: () => onDomainEvent
  });
  function emitDomainEvent(channel, evt) {
    const handlers = channels.get(channel);
    if (!handlers || handlers.size === 0) return;
    for (const handler of [...handlers]) {
      try {
        handler(evt);
      } catch (e) {
        console.error(`bz: 域事件 handler 异常（channel=${channel}）`, e);
      }
    }
  }
  function onDomainEvent(channel, handler) {
    let set = channels.get(channel);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      channels.set(channel, set);
    }
    set.add(handler);
    let offed = false;
    return () => {
      if (offed) return;
      offed = true;
      const cur = channels.get(channel);
      if (!cur) return;
      cur.delete(handler);
      if (cur.size === 0) channels.delete(channel);
    };
  }
  function clearDomainEvents() {
    channels.clear();
  }
  var channels;
  var init_domain_bus = __esm({
    "src/core/domain-bus.ts"() {
      channels = /* @__PURE__ */ new Map();
    }
  });

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }
  var init_mobile = __esm({
    "src/core/mobile.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/focus-trap.ts
  function isHidden(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.classList.contains("bz-setting-hidden")) return true;
      if (cur.style.display === "none") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function firstFocusable(container) {
    const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
      if (isHidden(el)) return false;
      if (isMobileEnv()) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    return list[0] || null;
  }
  function trapFocus(container) {
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => !isHidden(el) && !el.hasAttribute("disabled")
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && active !== container && container.contains(active);
      if (e.shiftKey) {
        if (active === first || !inside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inside) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeydown);
    return () => container.removeEventListener("keydown", onKeydown);
  }
  function trapPanelFocus(panel) {
    panel.classList.add(PANEL_FOCUS_CLASS);
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    const release = trapFocus(panel);
    panel.focus({ preventScroll: true });
    return release;
  }
  var FOCUSABLE_SELECTOR, PANEL_FOCUS_CLASS;
  var init_focus_trap = __esm({
    "src/core/ui/focus-trap.ts"() {
      init_mobile();
      FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      PANEL_FOCUS_CLASS = "bz-panel-focushost";
    }
  });

  // src/core/flow-dialog.ts
  function buildFlowDialogParts(title, message, actions) {
    var _a;
    let buttons;
    if (actions.length === 2) {
      buttons = [
        { id: FLOW_DIALOG_CANCEL_ID, className: "", label: actions[0].label, value: actions[0].value },
        { id: FLOW_DIALOG_OK_ID, className: "", label: actions[1].label, value: actions[1].value }
      ];
    } else {
      buttons = actions.map((a, i) => {
        const cls = ["bz-flow-dialog-action"];
        if (a.danger) cls.push("bz-flow-dialog-danger");
        if (a.cta) cls.push("bz-flow-dialog-cta");
        return { id: `bz-flow-dialog-action-${i}`, className: cls.join(" "), label: a.label, value: a.value };
      });
    }
    const ctaIdx = actions.findIndex((a) => a.cta);
    const primaryIdx = ctaIdx >= 0 ? ctaIdx : actions.length - 1;
    const dangerPrimary = !!((_a = actions[primaryIdx]) == null ? void 0 : _a.danger);
    let focusIdx = primaryIdx;
    if (dangerPrimary) {
      const safeIdx = actions.findIndex((a, i) => i !== primaryIdx && !a.danger);
      if (safeIdx >= 0) focusIdx = safeIdx;
    }
    const html = "<h4>" + escapeHtml2(title || "确认") + "</h4><p>" + escapeHtml2(message).replace(/\n/g, "<br>") + '</p><div class="confirm-actions">' + buttons.map((b) => {
      const clsAttr = b.className ? ' class="' + b.className + '"' : "";
      return '<button id="' + b.id + '"' + clsAttr + ">" + escapeHtml2(b.label) + "</button>";
    }).join("") + "</div>";
    return { html, buttons, focusId: buttons[focusIdx].id, dangerPrimary };
  }
  function openFlowDialog(opts) {
    if (!opts.actions || opts.actions.length === 0) {
      return Promise.reject(new Error("openFlowDialog：actions 不能为空"));
    }
    return new Promise((resolve) => {
      const prevActive = document.activeElement;
      if (activeSettle) activeSettle(void 0);
      const parts = buildFlowDialogParts(opts.title, opts.message, opts.actions);
      const mask = document.createElement("div");
      mask.id = "__shared_confirm_mask__";
      mask.style.zIndex = String(allocZ());
      mask.onclick = (e) => {
        if (e.target === mask) settle(void 0);
      };
      const popup = document.createElement("div");
      popup.id = "__shared_confirm_popup__";
      popup.className = "bz-overlay-popup bz-flow-dialog" + (parts.dangerPrimary ? " bz-flow-dialog--danger" : "");
      if (opts.className) {
        for (const cls of opts.className.split(/\s+/)) if (cls) popup.classList.add(cls);
      }
      popup.setAttribute("role", "dialog");
      popup.setAttribute("aria-modal", "true");
      popup.innerHTML = parts.html;
      mask.appendChild(popup);
      document.body.appendChild(mask);
      const escHandle = escManager.register("q3-confirm", {
        isVisible: () => mask.isConnected,
        close: () => settle(void 0)
      });
      let settled = false;
      const releaseFocusTrap = trapFocus(popup);
      function restoreFocus() {
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
      function settle(v) {
        if (settled) return;
        settled = true;
        if (activeSettle === settle) activeSettle = null;
        releaseFocusTrap();
        escHandle.unregister();
        mask.remove();
        restoreFocus();
        resolve(v);
      }
      activeSettle = settle;
      for (const b of parts.buttons) {
        const btn = document.getElementById(b.id);
        if (btn) btn.onclick = () => settle(b.value);
      }
      const focusBtn = document.getElementById(parts.focusId);
      if (focusBtn) focusBtn.focus();
    });
  }
  function cancelActiveFlowDialog() {
    if (activeSettle) activeSettle(void 0);
  }
  function confirmDiscard(proceed, message, className) {
    void openFlowDialog({
      title: "放弃未保存的内容？",
      message: message || "弹窗内有未保存的输入，关闭后将丢失",
      className,
      actions: [
        { label: "放弃", value: "ok" },
        { label: "继续编辑", value: "cancel" }
      ]
    }).then((v) => {
      if (v === "ok") proceed();
    });
  }
  var FLOW_DIALOG_CANCEL_ID, FLOW_DIALOG_OK_ID, activeSettle;
  var init_flow_dialog = __esm({
    "src/core/flow-dialog.ts"() {
      init_esc_manager();
      init_utils();
      init_z_order();
      init_focus_trap();
      FLOW_DIALOG_CANCEL_ID = "__shared_confirm_cancel__";
      FLOW_DIALOG_OK_ID = "__shared_confirm_ok__";
      activeSettle = null;
    }
  });

  // src/core/diary-format.ts
  function diaryEntryBaseName(dateStr, timeStr, seq) {
    const d = String(dateStr || "").replace(/-/g, "");
    const t = String(timeStr || "").replace(/:/g, "");
    const stamp = `${d.slice(2, 8)}${t.slice(0, 4)}`;
    return seq && seq > 1 ? `${stamp}-${seq}` : stamp;
  }
  function diaryEntryPath(dir, dateStr, timeStr, seq) {
    return `${dir}/${diaryEntryBaseName(dateStr, timeStr, seq)}.md`;
  }
  function diaryMetaFromEntryPath(path) {
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    const m = DIARY_ENTRY_FILE_RE.exec(base);
    if (!m) return null;
    const date = `20${m[1]}-${m[2]}-${m[3]}`;
    const time = `${m[4]}:${m[5]}`;
    if (!isValidDiaryDate(date) || !isValidDiaryTime(time)) return null;
    return m[6] ? { date, time, seq: Number(m[6]) } : { date, time };
  }
  function diaryDateFromLegacyPath(path) {
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    const m = DIARY_LEGACY_FILE_RE.exec(base);
    if (!m) return null;
    const date = `${m[1]}-${m[2]}-${m[3]}`;
    return isValidDiaryDate(date) ? date : null;
  }
  function resolveDiaryEntryMeta(path, parsed) {
    var _a;
    return (_a = parsed.meta) != null ? _a : diaryMetaFromEntryPath(path);
  }
  function diaryStampText(date, time) {
    return `${date} ${time}`;
  }
  function parseDiaryStamp(value) {
    const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(String(value || "").trim());
    return m && isValidDiaryDate(m[1]) && isValidDiaryTime(m[2]) ? { date: m[1], time: m[2] } : null;
  }
  function isValidDiaryDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1) return false;
    const days = [31, y % 4 === 0 && y % 100 !== 0 || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= days[mo - 1];
  }
  function isValidDiaryTime(s) {
    const m = /^(\d{2}):(\d{2})$/.exec(s || "");
    if (!m) return false;
    return Number(m[1]) <= 23 && Number(m[2]) <= 59;
  }
  function serializeDiaryEntryFile(meta, tags, content) {
    const lines = ["---", `${DIARY_DATE_KEY}: ${diaryStampText(meta.date, meta.time)}`, `${DIARY_TYPE_KEY}:`];
    for (const t of tags) lines.push(`  - ${t}`);
    lines.push("---", "", content);
    let out = lines.join("\n");
    if (!out.endsWith("\n")) out += "\n";
    return out;
  }
  function unquote(v) {
    const t = v.trim();
    if (t.length >= 2 && (t.startsWith('"') && t.endsWith('"') || t.startsWith("'") && t.endsWith("'"))) {
      return t.slice(1, -1);
    }
    return t;
  }
  function serializeDiaryBlockHeader(tags, time) {
    return `# ${tags.join("/")} ${time}`;
  }
  function parseDiaryBlockHeader(line) {
    const m = /^#\s+(.+)\s+(\d{2}:\d{2})$/.exec(String(line || "").trim());
    if (!m) return null;
    const tags = [];
    for (const name of m[1].split("/")) {
      const t = name.trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
    return { tags, time: m[2] };
  }
  function readDiaryFrontmatterFieldRaw(content, key) {
    const text = (content || "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---\n")) return null;
    const end = text.indexOf("\n---", 4);
    if (end < 0) return null;
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = new RegExp(`^${safeKey}:[^\\S\\n]*(.*)$`, "m").exec(text.slice(4, end));
    return m ? m[1].trim() : null;
  }
  function parseDiaryEntryFile(content) {
    const text = (content || "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---\n")) return { meta: null, tags: [], body: content || "" };
    const end = text.indexOf("\n---", 4);
    if (end < 0) return { meta: null, tags: [], body: content || "" };
    const afterClose = text.slice(end + 4);
    if (afterClose && !afterClose.startsWith("\n")) return { meta: null, tags: [], body: content || "" };
    const fmText = text.slice(4, end);
    let body = afterClose;
    if (body.startsWith("\n")) body = body.slice(1);
    if (body.startsWith("\n")) body = body.slice(1);
    let meta = null;
    const tags = [];
    let inTags = false;
    for (const line of fmText.split("\n")) {
      const tagItem = /^\s+-\s*(.*)$/.exec(line);
      if (inTags && tagItem) {
        const v = unquote(tagItem[1]);
        if (v) tags.push(v);
        continue;
      }
      inTags = false;
      const kv = /^([^:]+):(.*)$/.exec(line);
      if (!kv) continue;
      const key = kv[1].trim();
      const val = kv[2].trim();
      if (key === DIARY_DATE_KEY) {
        meta = parseDiaryStamp(unquote(val));
      } else if (key === DIARY_TYPE_KEY) {
        inTags = true;
        if (val.startsWith("[") && val.endsWith("]")) {
          for (const item of val.slice(1, -1).split(",")) {
            const v = unquote(item);
            if (v) tags.push(v);
          }
          inTags = false;
        } else if (val) {
          const v = unquote(val);
          if (v) tags.push(v);
          inTags = false;
        }
      }
    }
    return { meta, tags, body };
  }
  var DIARY_ENTRY_FILE_RE, DIARY_LEGACY_FILE_RE, DIARY_DATE_KEY, DIARY_TYPE_KEY;
  var init_diary_format = __esm({
    "src/core/diary-format.ts"() {
      DIARY_ENTRY_FILE_RE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;
      DIARY_LEGACY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.md$/;
      DIARY_DATE_KEY = "date";
      DIARY_TYPE_KEY = "type";
    }
  });

  // src/core/storage.ts
  function normalizeStorageDir(value) {
    let dir = (value || DEFAULT_STORAGE_DIR).trim().replace(/\/+$/, "");
    if (/\.json$/i.test(dir)) {
      const idx = dir.lastIndexOf("/");
      dir = idx >= 0 ? dir.slice(0, idx) : "";
    }
    return dir || DEFAULT_STORAGE_DIR;
  }
  function storageDir() {
    const s = tryGetSettings();
    return normalizeStorageDir(s && s.storagePath);
  }
  function storageFile(name, base) {
    const dir = (base || storageDir()).trim().replace(/\/+$/, "");
    return `${dir}/${name}`;
  }
  function encryptDir() {
    return `${storageDir()}/.ENCRYPT`;
  }
  function enqueueFileTask(filePath, task) {
    var _a;
    const prev = (_a = fileTaskQueues.get(filePath)) != null ? _a : Promise.resolve();
    const run = prev.then(task, task);
    const tail = run.then(
      () => void 0,
      () => void 0
    );
    fileTaskQueues.set(filePath, tail);
    void tail.then(() => {
      if (fileTaskQueues.get(filePath) === tail) fileTaskQueues.delete(filePath);
    });
    return run;
  }
  function assertPlainObject(filePath, current) {
    if (current && typeof current === "object" && !Array.isArray(current)) return current;
    const got = Array.isArray(current) ? "array" : current === null ? "null" : typeof current;
    throw new Error("storage: 段级合并写要求对象形态 JSON（" + filePath + " 读到 " + got + "），请先归一文件形态");
  }
  function updateFileSections(filePath, writer, opts = {}) {
    return enqueueFileTask(filePath, async () => {
      var _a;
      const store = jsonFileStore(filePath, { ...opts, defaultValue: (_a = opts.defaultValue) != null ? _a : {} });
      const current = assertPlainObject(filePath, await store.read());
      const set = await writer(current) || {};
      const next = { ...current, ...set };
      await store.write(next);
      return next;
    });
  }
  function isAlreadyExistsError(e) {
    const msg = e instanceof Error ? e.message : String(e);
    return /already exist/i.test(msg);
  }
  function corruptStamp(d = /* @__PURE__ */ new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  function baseNameOf(p) {
    return p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;
  }
  async function backupOriginal(app, filePath, raw) {
    try {
      const f = app.vault.getAbstractFileByPath(filePath);
      if (!f) return null;
      const content = raw !== void 0 ? raw : await app.vault.read(f);
      if (!app.vault.getAbstractFileByPath(CORRUPT_BACKUP_DIR)) {
        try {
          await app.vault.createFolder(CORRUPT_BACKUP_DIR);
        } catch (e) {
        }
      }
      const base = baseNameOf(filePath);
      const stamp = corruptStamp();
      let backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}.bak`;
      for (let i = 2; app.vault.getAbstractFileByPath(backupPath); i++) {
        backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}-${i}.bak`;
      }
      await app.vault.create(backupPath, content);
      return backupPath;
    } catch (e) {
      console.warn("[storage] " + filePath + " 留档失败（" + CORRUPT_BACKUP_DIR + "），继续原流程", e);
      return null;
    }
  }
  function notifyBackup(filePath, backupPath, cause) {
    var _a;
    const now = Date.now();
    if (now - ((_a = corruptNotifyAt.get(filePath)) != null ? _a : 0) < CORRUPT_NOTIFY_DEDUPE_MS) return;
    corruptNotifyAt.set(filePath, now);
    try {
      const name = baseNameOf(filePath);
      const msg = cause === "解析失败" ? `数据文件 ${name} 解析失败，原内容已留档到 ${backupPath}，数据不会丢，已重建默认文件继续使用` : `数据文件 ${name} 写入失败，原内容已留档到 ${backupPath}，数据不会丢，请稍后重试`;
      notify(msg, { type: "warning" });
    } catch (e) {
    }
  }
  function serialize(v) {
    return JSON.stringify(v, null, 2);
  }
  function jsonFileStore(filePath, opts = {}) {
    const resolveApp = () => opts.app || getApp();
    const resolveDefault = () => {
      const d = opts.defaultValue;
      return typeof d === "function" ? d() : d === void 0 ? [] : d;
    };
    async function ensureDir(app) {
      const d = filePath.substring(0, filePath.lastIndexOf("/"));
      if (d && !app.vault.getAbstractFileByPath(d)) await app.vault.createFolder(d);
    }
    async function createIfMissing(app, content) {
      await ensureDir(app);
      try {
        await app.vault.create(filePath, content);
        return true;
      } catch (e) {
        if (isAlreadyExistsError(e) && app.vault.getAbstractFileByPath(filePath)) return false;
        throw e;
      }
    }
    async function handleCorrupt(app, err, raw) {
      var _a;
      if (((_a = opts.onCorrupt) == null ? void 0 : _a.call(opts, filePath, err)) === false) {
        return null;
      }
      const backupPath = await backupOriginal(app, filePath, raw);
      if (backupPath && !opts.onCorrupt) notifyBackup(filePath, backupPath, "解析失败");
      const f = app.vault.getAbstractFileByPath(filePath);
      if (f) {
        await app.vault.modify(f, serialize(resolveDefault()));
      } else {
        await createIfMissing(app, serialize(resolveDefault()));
      }
      return resolveDefault();
    }
    async function modifyWithBackup(app, f, c) {
      try {
        await app.vault.modify(f, c);
      } catch (e) {
        const backupPath = await backupOriginal(app, filePath);
        if (backupPath) notifyBackup(filePath, backupPath, "写入失败");
        throw e;
      }
    }
    return {
      async read() {
        const app = resolveApp();
        let f = app.vault.getAbstractFileByPath(filePath);
        if (!f) {
          const created = await createIfMissing(app, serialize(resolveDefault()));
          if (created) return resolveDefault();
          f = app.vault.getAbstractFileByPath(filePath);
          if (!f) return resolveDefault();
        }
        const raw = await app.vault.read(f);
        try {
          return JSON.parse(raw);
        } catch (e) {
          return await handleCorrupt(app, e, raw);
        }
      },
      async write(data) {
        const app = resolveApp();
        const c = serialize(data);
        let f = app.vault.getAbstractFileByPath(filePath);
        if (f) {
          if (opts.writeIfChanged) {
            try {
              const cur2 = await app.vault.read(f);
              if (cur2 === c) return;
            } catch (e) {
            }
          }
          await modifyWithBackup(app, f, c);
          return;
        }
        const created = await createIfMissing(app, c);
        if (created) return;
        let cur = app.vault.getAbstractFileByPath(filePath);
        if (!cur) {
          const retried = await createIfMissing(app, c);
          if (retried) return;
          cur = app.vault.getAbstractFileByPath(filePath);
          if (!cur) throw new Error("storage: create 竞态降级失败（" + filePath + "）");
        }
        await modifyWithBackup(app, cur, c);
      }
    };
  }
  var DEFAULT_STORAGE_DIR, fileTaskQueues, CORRUPT_BACKUP_DIR, CORRUPT_NOTIFY_DEDUPE_MS, corruptNotifyAt;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      DEFAULT_STORAGE_DIR = "CONFIG/STORAGE";
      fileTaskQueues = /* @__PURE__ */ new Map();
      CORRUPT_BACKUP_DIR = "CONFIG/.CORRUPT";
      CORRUPT_NOTIFY_DEDUPE_MS = 3e4;
      corruptNotifyAt = /* @__PURE__ */ new Map();
    }
  });

  // src/core/item-actions.ts
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  function registerSheetCompanion(el) {
    sheetCompanions.add(el);
  }
  function unregisterSheetCompanion(el) {
    sheetCompanions.delete(el);
  }
  function inSheetCompanion(target) {
    for (const c of sheetCompanions) {
      if (c.isConnected && c.contains(target)) return true;
    }
    return false;
  }
  function onMouseDownCapture(ev) {
    if (touchSettlePending) return;
    if (popupEl && popupEl.isConnected && !popupEl.contains(ev.target) && !inSheetCompanion(ev.target)) {
      closeItemMenu();
    }
  }
  function onMouseUpCapture(ev) {
    if (!suppressNextClick) return;
    if (popupEl && popupEl.isConnected && popupEl.contains(ev.target)) return;
    suppressNextClick = false;
    residualClickArmed = true;
  }
  function onClickCapture(ev) {
    const target = ev.target;
    if (residualClickArmed) {
      residualClickArmed = false;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      return;
    }
    if (touchSettlePending) {
      const inPopup = popupEl != null && popupEl.contains(target) || sheetMask != null && sheetMask.contains(target);
      touchSettlePending = false;
      if (inPopup) {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        return;
      }
    }
    if (popupEl && popupEl.isConnected && !popupEl.contains(target) && !inSheetCompanion(target)) {
      closeItemMenu();
    }
  }
  function closeItemMenu() {
    if (menuEsc) {
      menuEsc.unregister();
      menuEsc = null;
    }
    if (touchSettleTimer) {
      clearTimeout(touchSettleTimer);
      touchSettleTimer = null;
    }
    document.removeEventListener("mousedown", onMouseDownCapture, true);
    document.removeEventListener("mouseup", onMouseUpCapture, true);
    document.removeEventListener("click", onClickCapture, true);
    if (sheetMask) {
      sheetMask.remove();
      sheetMask = null;
    }
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
    sheetBodyEl = null;
    sheetHeadEl = null;
    suppressNextClick = false;
    residualClickArmed = false;
    touchSettlePending = false;
    if (prevFocus && prevFocus.isConnected && document.activeElement === document.body) {
      prevFocus.focus();
    }
    prevFocus = null;
  }
  function armTouchSettle() {
    touchSettlePending = true;
    if (touchSettleTimer) clearTimeout(touchSettleTimer);
    touchSettleTimer = setTimeout(() => {
      touchSettlePending = false;
      touchSettleTimer = null;
    }, TOUCH_SETTLE_MS);
  }
  function attachPopupListeners(id) {
    document.addEventListener("mousedown", onMouseDownCapture, true);
    document.addEventListener("mouseup", onMouseUpCapture, true);
    document.addEventListener("click", onClickCapture, true);
    menuEsc = escManager.register(id, {
      isVisible: () => !!(popupEl && popupEl.isConnected),
      close: closeItemMenu
    });
  }
  function positionMenu(m, x, y) {
    const mw = m.offsetWidth || 168;
    const mh = m.offsetHeight || m.children.length * ITEM_HEIGHT + MENU_PADDING;
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    let left = x + ANCHOR_GAP;
    let top = y + ANCHOR_GAP;
    if (vw && left + mw > vw - VIEWPORT_PAD) left = Math.max(VIEWPORT_PAD, x - mw - ANCHOR_GAP);
    if (vh && top + mh > vh - VIEWPORT_PAD) top = Math.max(VIEWPORT_PAD, y - mh - ANCHOR_GAP);
    if (vw) left = Math.min(Math.max(left, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vw - mw - VIEWPORT_PAD));
    if (vh) top = Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, vh - mh - VIEWPORT_PAD));
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
  }
  function attachItemKeyboardNav(host, scope) {
    host.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(scope.querySelectorAll("button"));
      if (items.length === 0) return;
      e.preventDefault();
      const idx = items.indexOf(document.activeElement);
      const next = idx === -1 ? 0 : e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
      items[next].focus();
    });
  }
  function focusMenuFirst(host, scope) {
    prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const first = scope.querySelector("button");
    if (first) first.focus();
    attachItemKeyboardNav(host, scope);
  }
  function openItemMenu(x, y, actions, suppressResidualClick = false, menuClass, menuHeadHtml) {
    closeItemMenu();
    const m = document.createElement("div");
    m.className = "bz-item-menu" + (menuClass ? " " + menuClass : "");
    m.style.visibility = "hidden";
    if (menuHeadHtml) {
      const head = document.createElement("div");
      head.className = "bz-item-menu-head";
      head.innerHTML = menuHeadHtml;
      m.appendChild(head);
      const sep = document.createElement("div");
      sep.className = "bz-item-menu-sep";
      m.appendChild(sep);
    }
    for (const a of actions) {
      const item = document.createElement("button");
      item.type = "button";
      if (a.title) item.title = a.title;
      item.className = "bz-item-menu-item" + (a.kind === "danger" ? " bz-item-menu-item--danger" : "") + (a.tone === "accent" ? " bz-item-menu-item--accent" : "");
      const itemIcon = document.createElement("span");
      itemIcon.className = "bz-item-menu-icon";
      renderIcon(itemIcon, a.icon);
      const itemLabel = document.createElement("span");
      itemLabel.className = "bz-item-menu-label";
      itemLabel.textContent = a.label;
      item.appendChild(itemIcon);
      item.appendChild(itemLabel);
      item.addEventListener("click", (ev) => {
        ev.stopPropagation();
        closeItemMenu();
        a.onClick();
      });
      m.appendChild(item);
    }
    m.style.zIndex = String(allocZ());
    document.body.appendChild(m);
    positionMenu(m, x, y);
    m.style.visibility = "visible";
    popupEl = m;
    suppressNextClick = suppressResidualClick;
    residualClickArmed = false;
    if (!suppressResidualClick) armTouchSettle();
    attachPopupListeners("bz-item-menu");
    focusMenuFirst(m, m);
  }
  function buildSheetItem(a) {
    const item = document.createElement("button");
    item.type = "button";
    if (a.title) item.title = a.title;
    item.className = "bz-item-sheet-item" + (a.kind === "danger" ? " bz-item-sheet-item--danger" : "") + (a.tone === "accent" ? " bz-item-sheet-item--accent" : "");
    const itemIcon = document.createElement("span");
    itemIcon.className = "bz-item-sheet-icon";
    renderIcon(itemIcon, a.icon);
    const itemLabel = document.createElement("span");
    itemLabel.className = "bz-item-sheet-label";
    itemLabel.textContent = a.label;
    item.appendChild(itemIcon);
    item.appendChild(itemLabel);
    if (a.sub) {
      const itemSub = document.createElement("span");
      itemSub.className = "bz-item-sheet-item-sub";
      itemSub.textContent = a.sub;
      item.appendChild(itemSub);
    }
    item.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (a.keepOpen) {
        a.onClick();
        return;
      }
      closeItemMenu();
      a.onClick();
    });
    return item;
  }
  function openItemSheet(actions, opts, suppressResidualClick = false) {
    closeItemMenu();
    const mask = document.createElement("div");
    mask.className = "bz-item-sheet-mask";
    const sheet = document.createElement("div");
    sheet.className = "bz-item-sheet" + ((opts == null ? void 0 : opts.sheetClass) ? " " + opts.sheetClass : "");
    if (opts == null ? void 0 : opts.sheetHead) {
      const head = document.createElement("div");
      head.className = "bz-item-sheet-head";
      head.appendChild(opts.sheetHead);
      sheet.appendChild(head);
      sheetHeadEl = head;
    } else if (opts == null ? void 0 : opts.sheetTitle) {
      const head = document.createElement("div");
      head.className = "bz-item-sheet-head";
      const titleEl = document.createElement("div");
      titleEl.className = "bz-item-sheet-title";
      titleEl.textContent = opts.sheetTitle;
      head.appendChild(titleEl);
      if (opts.sheetSub) {
        const subEl = document.createElement("div");
        subEl.className = "bz-item-sheet-sub";
        subEl.textContent = opts.sheetSub;
        head.appendChild(subEl);
      }
      sheet.appendChild(head);
      sheetHeadEl = head;
    }
    const body = document.createElement("div");
    body.className = "bz-item-sheet-body";
    for (const a of actions) {
      body.appendChild(buildSheetItem(a));
    }
    sheet.appendChild(body);
    mask.style.zIndex = String(allocZ());
    sheet.style.zIndex = String(allocZ());
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    popupEl = sheet;
    sheetMask = mask;
    sheetBodyEl = body;
    suppressNextClick = suppressResidualClick;
    residualClickArmed = false;
    if (!suppressResidualClick) armTouchSettle();
    attachPopupListeners("bz-item-sheet");
    attachSheetDismiss(sheet, body);
    focusMenuFirst(sheet, body);
  }
  function attachSheetDismiss(sheet, body) {
    const CLOSE_AT = 80;
    let startY = 0;
    let dragging = false;
    let dy = 0;
    const reset = () => {
      dragging = false;
      dy = 0;
      sheet.style.transform = "";
      sheet.classList.remove("bz-item-sheet--dragging");
    };
    sheet.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        startY = t.clientY;
        dragging = true;
        dy = 0;
      },
      { passive: true }
    );
    sheet.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const t = e.touches && e.touches[0];
        if (!t) return;
        const cur = t.clientY - startY;
        if (cur <= 0) {
          if (dy !== 0) reset();
          return;
        }
        if (body.scrollTop > 0 && body.contains(e.target)) {
          if (dy !== 0) reset();
          return;
        }
        dy = cur;
        e.preventDefault();
        sheet.classList.add("bz-item-sheet--dragging");
        sheet.style.transform = `translateY(${dy}px)`;
        if (sheetMask) sheetMask.style.opacity = String(Math.max(0, 1 - dy / 400));
      },
      { passive: false }
    );
    const onTouchEnd = () => {
      if (!dragging) return;
      const over = dy > CLOSE_AT;
      dragging = false;
      if (over) {
        sheet.classList.remove("bz-item-sheet--dragging");
        const s = sheet;
        s.style.transform = "translateY(100%)";
        if (sheetMask) sheetMask.style.opacity = "0";
        setTimeout(() => {
          if (popupEl === s) closeItemMenu();
        }, 180);
      } else {
        reset();
        if (sheetMask) sheetMask.style.opacity = "1";
      }
      dy = 0;
    };
    sheet.addEventListener("touchend", onTouchEnd);
    sheet.addEventListener("touchcancel", () => {
      reset();
      if (sheetMask) sheetMask.style.opacity = "1";
    });
  }
  function attachItemActions(card, actions, opts) {
    if (!card || actions.length === 0) return;
    card.classList.add("bz-item-card");
    card.addEventListener("contextmenu", (e) => {
      if (isMobileEnv()) return;
      if ((opts == null ? void 0 : opts.longPressFilter) && !opts.longPressFilter(e)) return;
      e.preventDefault();
      openItemMenu(e.clientX, e.clientY, actions, true, opts == null ? void 0 : opts.menuClass, opts == null ? void 0 : opts.menuHeadHtml);
      suppressNextClick = false;
    });
    longPress(
      card,
      (ev) => {
        if (!isMobileEnv()) return;
        openItemSheet(actions, opts, ev.type !== "touchstart");
      },
      void 0,
      opts == null ? void 0 : opts.longPressFilter
    );
  }
  var VIEWPORT_PAD, ANCHOR_GAP, ITEM_HEIGHT, MENU_PADDING, TOUCH_SETTLE_MS, popupEl, sheetMask, sheetBodyEl, sheetHeadEl, sheetCompanions, menuEsc, prevFocus, suppressNextClick, residualClickArmed, touchSettlePending, touchSettleTimer;
  var init_item_actions = __esm({
    "src/core/item-actions.ts"() {
      init_dom();
      init_esc_manager();
      init_z_order();
      init_mobile();
      init_fake_obsidian();
      VIEWPORT_PAD = 8;
      ANCHOR_GAP = 12;
      ITEM_HEIGHT = 30;
      MENU_PADDING = 10;
      TOUCH_SETTLE_MS = 400;
      popupEl = null;
      sheetMask = null;
      sheetBodyEl = null;
      sheetHeadEl = null;
      sheetCompanions = /* @__PURE__ */ new Set();
      menuEsc = null;
      prevFocus = null;
      suppressNextClick = false;
      residualClickArmed = false;
      touchSettlePending = false;
      touchSettleTimer = null;
    }
  });

  // src/core/ui/icon.ts
  function uiIcon(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }
  var init_icon = __esm({
    "src/core/ui/icon.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/icons.ts
  function uiIconSpan(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }
  function mountIcons(root) {
    root.querySelectorAll("[data-lucide]").forEach((el) => {
      const name = el.getAttribute("data-lucide") || "";
      if (!name) return;
      try {
        const fresh = uiIconSpan(name);
        const cls = el.className;
        if (cls && cls !== "bz-ic") fresh.className = cls;
        el.replaceWith(fresh);
      } catch (e) {
      }
    });
  }
  var init_icons = __esm({
    "src/core/ui/icons.ts"() {
      init_fake_obsidian();
    }
  });

  // src/core/ui/button.ts
  function uiBtn(opts) {
    const b = document.createElement("button");
    b.type = "button";
    const cls = ["bz-btn"];
    if (opts.tone && opts.tone !== "default") cls.push(`bz-btn--${opts.tone}`);
    if (opts.size && opts.size !== "md") cls.push(`bz-btn--${opts.size}`);
    if (opts.chip) cls.push("bz-btn--chip");
    if (opts.on) cls.push("is-on");
    if (opts.className) cls.push(opts.className);
    b.className = cls.join(" ");
    if (opts.title) b.title = opts.title;
    if (opts.disabled) b.disabled = true;
    if (opts.icon) {
      if (opts.chip) {
        const chip = document.createElement("span");
        chip.className = "bz-btn-chip";
        chip.appendChild(uiIcon(opts.icon));
        b.appendChild(chip);
      } else {
        b.appendChild(uiIcon(opts.icon));
      }
    }
    if (opts.label) {
      const span = document.createElement("span");
      span.textContent = opts.label;
      b.appendChild(span);
    }
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }
  var init_button = __esm({
    "src/core/ui/button.ts"() {
      init_icon();
    }
  });

  // src/core/ui/chip.ts
  var init_chip = __esm({
    "src/core/ui/chip.ts"() {
      init_icon();
    }
  });

  // src/core/ui/setlist.ts
  function uiSetlist(opts) {
    var _a;
    const variant = (_a = opts.variant) != null ? _a : "chips";
    const box = document.createElement("div");
    box.className = `bz-setlist bz-setlist--${variant}${opts.className ? ` ${opts.className}` : ""}`;
    if (opts.items.length === 0) {
      if (opts.emptyText) {
        const empty = document.createElement("div");
        empty.className = "bz-setlist-empty";
        empty.textContent = opts.emptyText;
        box.appendChild(empty);
      }
      return box;
    }
    for (const it of opts.items) {
      const item = document.createElement("div");
      item.className = "bz-setlist-item";
      item.dataset.key = it.key;
      if (it.sub) item.title = it.sub;
      if (it.imageUrl) {
        const img = document.createElement("img");
        img.className = "bz-setlist-avatar";
        img.setAttribute("referrerpolicy", "no-referrer");
        img.src = it.imageUrl;
        img.alt = "";
        img.onerror = () => img.remove();
        item.appendChild(img);
      }
      const text = document.createElement("div");
      text.className = "bz-setlist-text";
      const name = document.createElement("div");
      name.className = "bz-setlist-name";
      name.textContent = it.label;
      text.appendChild(name);
      if (it.sub) {
        const sub = document.createElement("div");
        sub.className = "bz-setlist-sub";
        sub.textContent = it.sub;
        text.appendChild(sub);
      }
      item.appendChild(text);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bz-setlist-remove bz-touch-target--xl";
      remove.textContent = opts.removeLabel || "移除";
      if (opts.onRemove) {
        const key = it.key;
        remove.addEventListener("click", () => {
          var _a2;
          return (_a2 = opts.onRemove) == null ? void 0 : _a2.call(opts, key);
        });
      }
      item.appendChild(remove);
      box.appendChild(item);
    }
    return box;
  }
  var init_setlist = __esm({
    "src/core/ui/setlist.ts"() {
    }
  });

  // src/core/ui/field.ts
  function uiInput(opts) {
    const inp = document.createElement("input");
    inp.className = "bz-input" + (opts.error ? " bz-input--error" : "");
    inp.type = opts.type || "text";
    if (opts.placeholder) inp.placeholder = opts.placeholder;
    if (opts.value !== void 0) inp.value = opts.value;
    if (opts.disabled) inp.disabled = true;
    if (opts.onInput) inp.addEventListener("input", () => {
      var _a;
      return (_a = opts.onInput) == null ? void 0 : _a.call(opts, inp.value);
    });
    return inp;
  }
  var init_field = __esm({
    "src/core/ui/field.ts"() {
    }
  });

  // src/core/ui/slider.ts
  var init_slider = __esm({
    "src/core/ui/slider.ts"() {
    }
  });

  // src/core/ui/empty.ts
  function uiEmpty(opts) {
    const el = document.createElement("div");
    el.className = "bz-empty";
    if (opts.icon) {
      const ic = uiIcon(opts.icon);
      ic.classList.add("bz-empty-ic");
      el.appendChild(ic);
    }
    const t = document.createElement("div");
    t.className = "bz-empty-title";
    t.textContent = opts.title;
    el.appendChild(t);
    if (opts.desc) {
      const d = document.createElement("div");
      d.className = "bz-empty-desc";
      d.textContent = opts.desc;
      el.appendChild(d);
    }
    if (opts.actions) el.appendChild(opts.actions);
    return el;
  }
  var init_empty = __esm({
    "src/core/ui/empty.ts"() {
      init_icon();
    }
  });

  // src/core/ui/segmented.ts
  var init_segmented = __esm({
    "src/core/ui/segmented.ts"() {
    }
  });

  // src/core/ui/choice.ts
  var init_choice = __esm({
    "src/core/ui/choice.ts"() {
    }
  });

  // src/core/ui/cardpick.ts
  function uiCardChoice(opts) {
    const el = document.createElement("div");
    el.className = "bz-cardpick" + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "radiogroup");
    if (opts.label) el.setAttribute("aria-label", opts.label);
    const btns = /* @__PURE__ */ new Map();
    let cur = opts.value;
    const sync = (v) => {
      cur = v;
      btns.forEach((b, val) => {
        const on = val === v;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
    };
    opts.options.forEach((o) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "bz-cardpick-card" + (o.value === opts.value ? " is-on" : "");
      card.dataset.value = String(o.value);
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", String(o.value === opts.value));
      const prev = document.createElement("div");
      prev.className = "bz-cardpick-prev" + (o.prevClass ? ` ${o.prevClass}` : "");
      prev.setAttribute("aria-hidden", "true");
      prev.style.height = "62px";
      const name = document.createElement("span");
      name.className = "bz-cardpick-name";
      name.textContent = o.label;
      card.append(prev, name);
      card.addEventListener("click", () => {
        if (cur === o.value) return;
        sync(o.value);
        opts.onChange(o.value);
      });
      btns.set(o.value, card);
      el.appendChild(card);
    });
    el.addEventListener("keydown", (e) => {
      var _a;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = opts.options.map((o) => o.value);
      const idx = list.indexOf(cur);
      const next = e.key === "ArrowRight" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      (_a = btns.get(list[next])) == null ? void 0 : _a.focus();
      e.preventDefault();
    });
    return { el, setValue: sync };
  }
  var init_cardpick = __esm({
    "src/core/ui/cardpick.ts"() {
    }
  });

  // src/core/ui/switch.ts
  var init_switch = __esm({
    "src/core/ui/switch.ts"() {
    }
  });

  // src/core/ui/select.ts
  var init_select = __esm({
    "src/core/ui/select.ts"() {
      init_icon();
      init_esc_manager();
    }
  });

  // src/core/ui/search.ts
  function uiSearch(opts) {
    const el = document.createElement("div");
    el.className = "bz-search";
    el.appendChild(uiIcon("search"));
    const input = uiInput({
      placeholder: opts.placeholder,
      value: opts.value,
      onInput: opts.onInput
    });
    el.appendChild(input);
    let clearBtn = null;
    if (opts.clearable !== false) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "bz-search-clear";
      clearBtn.title = "清除搜索";
      clearBtn.setAttribute("aria-label", "清除搜索");
      clearBtn.hidden = !input.value.trim();
      clearBtn.appendChild(uiIcon("x"));
      clearBtn.addEventListener("click", () => {
        input.value = "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.focus();
      });
      input.addEventListener("input", () => {
        if (clearBtn) clearBtn.hidden = !input.value.trim();
      });
      el.appendChild(clearBtn);
    }
    const syncClear = () => {
      if (clearBtn) clearBtn.hidden = !input.value.trim();
    };
    const setValue = (v) => {
      input.value = v;
      syncClear();
    };
    return { el, input, setValue, syncClear };
  }
  var init_search = __esm({
    "src/core/ui/search.ts"() {
      init_icon();
      init_field();
    }
  });

  // src/core/ui/mainhead.ts
  var init_mainhead = __esm({
    "src/core/ui/mainhead.ts"() {
      init_button();
    }
  });

  // src/core/ui/rail.ts
  var init_rail = __esm({
    "src/core/ui/rail.ts"() {
      init_fake_obsidian();
      init_icon();
    }
  });

  // src/core/ui/mobstrip.ts
  var init_mobstrip = __esm({
    "src/core/ui/mobstrip.ts"() {
    }
  });

  // src/core/ui/stat.ts
  var init_stat = __esm({
    "src/core/ui/stat.ts"() {
      init_icon();
    }
  });

  // src/core/ui/progress.ts
  function uiProgress(opts = {}) {
    const el = document.createElement("div");
    const cls = ["bz-progress"];
    if (opts.thin) cls.push("bz-progress--thin");
    if (opts.tone) cls.push(`bz-progress--${opts.tone}`);
    el.className = cls.join(" ");
    const fill = document.createElement("i");
    el.appendChild(fill);
    const setValue = (n) => {
      const v = Math.min(100, Math.max(0, Number(n) || 0));
      fill.style.width = v + "%";
    };
    if (opts.value !== void 0) setValue(opts.value);
    return { el, setValue };
  }
  var init_progress = __esm({
    "src/core/ui/progress.ts"() {
    }
  });

  // src/core/ui/popover.ts
  var init_popover = __esm({
    "src/core/ui/popover.ts"() {
      init_icon();
      init_esc_manager();
    }
  });

  // src/core/ui/help-tip.ts
  function bodyNodes(text) {
    const out = [];
    for (const raw of String(text != null ? text : "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const isItem = line.startsWith("- ");
      const el = document.createElement("div");
      el.className = isItem ? "bz-help-li" : "bz-help-p";
      el.textContent = isItem ? line.slice(2).trim() : line;
      out.push(el);
    }
    return out;
  }
  function attachHelpTip(anchor, opts) {
    anchor.classList.add("bz-help-anchor");
    let layer = null;
    let escHandle = null;
    let pinned = false;
    let overAnchor = false;
    let overLayer = false;
    let openedAt = 0;
    let closeTimer = null;
    let openTimer = null;
    const isOpen = () => !!layer;
    const clearTimers = () => {
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer);
        closeTimer = null;
      }
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
        openTimer = null;
      }
    };
    const onOutside = (e) => {
      const t = e.target;
      if (t && (anchor.contains(t) || (layer == null ? void 0 : layer.contains(t)))) return;
      close();
    };
    const onScroll = () => close();
    const place = () => {
      if (!layer) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const h = layer.offsetHeight;
      const w = layer.offsetWidth;
      const below = vh - r.bottom;
      const up = below < h + 12 && r.top > below;
      const top = Math.min(Math.max(12, up ? r.top - h - 8 : r.bottom + 8), Math.max(12, vh - h - 12));
      const left = Math.min(Math.max(12, r.left), Math.max(12, vw - w - 12));
      layer.style.top = `${top}px`;
      layer.style.left = `${left}px`;
      layer.classList.toggle("is-up", up);
    };
    function close() {
      clearTimers();
      pinned = false;
      overAnchor = false;
      overLayer = false;
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", place);
      escHandle == null ? void 0 : escHandle.unregister();
      escHandle = null;
      layer == null ? void 0 : layer.remove();
      layer = null;
      anchor.classList.remove("is-open");
      if (currentClose === close) currentClose = null;
    }
    function open() {
      if (layer || !anchor.isConnected) return;
      if (currentClose && currentClose !== close) currentClose();
      const pop = document.createElement("div");
      pop.className = "bz-help-pop" + (opts.skinClassName ? " " + opts.skinClassName : "");
      pop.setAttribute("role", "tooltip");
      for (const n of bodyNodes(opts.text)) pop.appendChild(n);
      pop.addEventListener("mouseenter", () => {
        overLayer = true;
      });
      pop.addEventListener("mouseleave", () => {
        overLayer = false;
        if (!pinned) scheduleClose();
      });
      document.body.appendChild(pop);
      topifyZ(pop);
      layer = pop;
      openedAt = Date.now();
      place();
      anchor.classList.add("is-open");
      document.addEventListener("pointerdown", onOutside, true);
      document.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", place);
      escHandle = escManager.register("bz-help-tip", { isVisible: isOpen, close });
      currentClose = close;
    }
    function scheduleClose() {
      if (pinned) return;
      if (closeTimer !== null) window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        closeTimer = null;
        if (!pinned && !overAnchor && !overLayer) close();
      }, CLOSE_DELAY);
    }
    anchor.addEventListener("mouseenter", () => {
      overAnchor = true;
      if (isOpen() || openTimer !== null) return;
      openTimer = window.setTimeout(() => {
        openTimer = null;
        if (overAnchor) open();
      }, HOVER_OPEN_DELAY);
    });
    anchor.addEventListener("mouseleave", () => {
      overAnchor = false;
      if (openTimer !== null) {
        window.clearTimeout(openTimer);
        openTimer = null;
      }
      scheduleClose();
    });
    anchor.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen() && Date.now() - openedAt < SYNTHETIC_TAP_MS) {
        pinned = true;
        return;
      }
      if (isOpen()) close();
      else {
        open();
        pinned = true;
      }
    });
  }
  var HOVER_OPEN_DELAY, CLOSE_DELAY, SYNTHETIC_TAP_MS, currentClose;
  var init_help_tip = __esm({
    "src/core/ui/help-tip.ts"() {
      init_esc_manager();
      init_z_order();
      HOVER_OPEN_DELAY = 180;
      CLOSE_DELAY = 140;
      SYNTHETIC_TAP_MS = 400;
      currentClose = null;
    }
  });

  // src/core/ui/suggest.ts
  var init_suggest = __esm({
    "src/core/ui/suggest.ts"() {
    }
  });

  // src/core/ui/lightbox.ts
  var init_lightbox = __esm({
    "src/core/ui/lightbox.ts"() {
      init_icon();
      init_esc_manager();
      init_z_order();
    }
  });

  // src/core/ui/modal.ts
  function bindFormSubmit(popup, onSubmit) {
    popup.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.key !== "Enter") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      onSubmit();
    });
    popup.addEventListener("keypress", (e) => {
      if (e.defaultPrevented) return;
      if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.dataset.bzNoFormSubmit !== void 0) return;
      e.preventDefault();
      onSubmit();
    });
  }
  function uiModal(opts) {
    var _a;
    const prevActive = document.activeElement;
    const focusEnabled = opts.autofocus !== false;
    const mask = document.createElement("div");
    mask.className = "bz-overlay-mask";
    mask.style.zIndex = String(allocZ());
    const popup = document.createElement("div");
    popup.className = "bz-overlay-popup" + (opts.className ? " " + opts.className : "");
    if (opts.maxWidth) popup.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - 32px))`;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    if (opts.title) popup.setAttribute("aria-label", opts.title);
    if (opts.head) {
      const head = document.createElement("div");
      head.className = "bz-dialog-head";
      const title = document.createElement("span");
      title.className = "bz-dialog-title";
      title.textContent = opts.title || "";
      head.appendChild(title);
      popup.appendChild(head);
    }
    const body = document.createElement("div");
    body.className = "bz-dialog-body";
    if (typeof opts.content === "string") body.innerHTML = opts.content;
    else body.appendChild(opts.content);
    popup.appendChild(body);
    mask.appendChild(popup);
    let closed = false;
    let escHandle = null;
    const releaseTrap = focusEnabled ? trapFocus(popup) : null;
    function close() {
      var _a2;
      if (closed) return;
      closed = true;
      liveModals.delete(close);
      releaseTrap == null ? void 0 : releaseTrap();
      mask.remove();
      escHandle == null ? void 0 : escHandle.unregister();
      if (focusEnabled && prevActive instanceof HTMLElement && prevActive.isConnected) {
        prevActive.focus();
      }
      (_a2 = opts.onClose) == null ? void 0 : _a2.call(opts);
    }
    const attemptClose = () => {
      if (opts.requestClose) opts.requestClose();
      else close();
    };
    mask.addEventListener("click", (e) => {
      if (e.target === mask) attemptClose();
    });
    escHandle = escManager.register("bz-modal", {
      isVisible: () => mask.isConnected,
      close: attemptClose
    });
    document.body.appendChild(mask);
    if (focusEnabled) (_a = firstFocusable(popup)) == null ? void 0 : _a.focus();
    liveModals.add(close);
    return { mask, popup, close };
  }
  var liveModals;
  var init_modal = __esm({
    "src/core/ui/modal.ts"() {
      init_esc_manager();
      init_z_order();
      init_focus_trap();
      liveModals = /* @__PURE__ */ new Set();
    }
  });

  // src/core/ui/resize.ts
  function hitRegion(rect, x, y, edge) {
    const onE = x >= rect.width - edge;
    const onS = y >= rect.height - edge;
    const onW = x <= edge;
    const onN = y <= edge;
    if (onE && onS) return "se";
    if (onE && !onW) return "e";
    if (onS && !onN) return "s";
    return null;
  }
  function uiResizable(el, opts = {}) {
    var _a, _b, _c, _d, _e;
    const isCoarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (isCoarse) {
      return { flush: () => {
      }, detach: () => {
      } };
    }
    const edge = (_a = opts.edge) != null ? _a : 8;
    const minW = (_b = opts.minW) != null ? _b : 320;
    const minH = (_c = opts.minH) != null ? _c : 240;
    const maxW = (_d = opts.maxW) != null ? _d : Number.POSITIVE_INFINITY;
    const maxH = (_e = opts.maxH) != null ? _e : Number.POSITIVE_INFINITY;
    let dir = null;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    const cap = (isW) => {
      const view = (isW ? window.innerWidth : window.innerHeight) * 0.92;
      return Math.floor(Math.min(isW ? maxW : maxH, view));
    };
    let persistTimer = null;
    let wantW = 0;
    let wantH = 0;
    const renderSize = () => {
      if (wantW <= 0 || wantH <= 0) return;
      el.style.width = Math.min(Math.max(wantW, minW), cap(true)) + "px";
      el.style.height = Math.min(Math.max(wantH, minH), cap(false)) + "px";
    };
    const persist = opts.persist;
    if (persist == null ? void 0 : persist.load) {
      const saved = persist.load();
      if (saved && saved.w > 0 && saved.h > 0) {
        wantW = Math.min(Math.max(saved.w, minW), maxW);
        wantH = Math.min(Math.max(saved.h, minH), maxH);
        renderSize();
      }
    }
    const onWinResize = () => {
      if (!el.isConnected) {
        window.removeEventListener("resize", onWinResize);
        return;
      }
      if (!dragging) renderSize();
    };
    window.addEventListener("resize", onWinResize);
    const regionAt = (e) => {
      const rect = el.getBoundingClientRect();
      return hitRegion(rect, e.clientX - rect.left, e.clientY - rect.top, edge);
    };
    const setCursor = (d) => {
      el.style.cursor = d === "e" ? "ew-resize" : d === "s" ? "ns-resize" : d === "se" ? "nwse-resize" : "";
    };
    const onHover = (e) => {
      if (dragging) return;
      setCursor(regionAt(e));
    };
    const onDragMove = (e) => {
      if (!el.isConnected) {
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onMouseUp);
        return;
      }
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dir === "e" || dir === "se") wantW = Math.min(Math.max(startW + dx, minW), maxW);
      if (dir === "s" || dir === "se") wantH = Math.min(Math.max(startH + dy, minH), maxH);
      renderSize();
      if (opts.onChange) opts.onChange(wantW, wantH);
      if (persist == null ? void 0 : persist.save) {
        if (persistTimer !== null) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          var _a2;
          persistTimer = null;
          (_a2 = persist.save) == null ? void 0 : _a2.call(persist, wantW, wantH);
        }, 300);
      }
    };
    const onMouseLeave = () => {
      if (!dragging) setCursor(null);
    };
    const onMouseDown = (e) => {
      const d = regionAt(e);
      if (!d) return;
      e.preventDefault();
      dir = d;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      startW = rect.width;
      startH = rect.height;
      if (wantW <= 0) wantW = Math.min(Math.max(startW, minW), maxW);
      if (wantH <= 0) wantH = Math.min(Math.max(startH, minH), maxH);
      document.body.style.userSelect = "none";
    };
    const onMouseUp = () => {
      if (!el.isConnected) {
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onMouseUp);
        return;
      }
      if (!dragging) return;
      dragging = false;
      dir = null;
      document.body.style.userSelect = "";
      setCursor(null);
      swallowNextClick();
    };
    el.addEventListener("mousemove", onHover);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onMouseUp);
    const flush = () => {
      if (persistTimer === null) return;
      clearTimeout(persistTimer);
      persistTimer = null;
      if ((persist == null ? void 0 : persist.save) && wantW > 0 && wantH > 0) persist.save(wantW, wantH);
    };
    return {
      flush,
      detach: () => {
        flush();
        el.removeEventListener("mousemove", onHover);
        el.removeEventListener("mouseleave", onMouseLeave);
        el.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("resize", onWinResize);
        document.body.style.userSelect = "";
        setCursor(null);
      }
    };
  }
  var init_resize = __esm({
    "src/core/ui/resize.ts"() {
      init_dom();
    }
  });

  // src/core/ui/splitter.ts
  var init_splitter = __esm({
    "src/core/ui/splitter.ts"() {
      init_dom();
    }
  });

  // src/core/ui/index.ts
  var init_ui = __esm({
    "src/core/ui/index.ts"() {
      init_icon();
      init_icons();
      init_button();
      init_chip();
      init_setlist();
      init_field();
      init_slider();
      init_empty();
      init_segmented();
      init_choice();
      init_cardpick();
      init_switch();
      init_select();
      init_search();
      init_mainhead();
      init_rail();
      init_mobstrip();
      init_stat();
      init_progress();
      init_popover();
      init_help_tip();
      init_suggest();
      init_lightbox();
      init_modal();
      init_resize();
      init_splitter();
    }
  });

  // src/core/settings-btn-state.ts
  function shortFailReason(e) {
    const msg = e instanceof Error ? e.message : String(e != null ? e : "");
    if (/超时|Timeout/.test(msg)) return "超时";
    if (/取消|Abort/.test(msg)) return "已取消";
    if (/未配置.*密钥|密钥.*为空/.test(msg)) return "无密钥";
    if (/401|403|密钥|鉴权|invalid.*key|unauthorized/i.test(msg)) return "密钥无效";
    if (/5\d\d|服务|no healthy|upstream/i.test(msg)) return "服务异常";
    if (/网络|fetch|network|Failed to fetch/i.test(msg)) return "网络不通";
    if (/JSON|解析|answers|畸形|回复为空/.test(msg)) return "响应异常";
    return "请求失败";
  }
  function clearResetTimer(el) {
    const prev = resetTimers.get(el);
    if (prev !== void 0) {
      clearTimeout(prev);
      resetTimers.delete(el);
    }
  }
  function setRowBtnState(el, state, label, failText) {
    if (!el) return;
    el.classList.remove("bz-rowbtn--busy", "bz-rowbtn--ok", "bz-rowbtn--fail");
    el.disabled = state === "busy";
    if (state === "busy") {
      el.classList.add("bz-rowbtn--busy");
      clearResetTimer(el);
    } else if (state === "ok") {
      el.classList.add("bz-rowbtn--ok");
      el.textContent = ROW_BTN_OK_TEXT;
    } else if (state === "fail") {
      el.classList.add("bz-rowbtn--fail");
      el.textContent = (failText || "失败").slice(0, 6);
    } else {
      el.textContent = label;
    }
  }
  function armRowBtnReset(el, label) {
    if (!el) return;
    const prev = resetTimers.get(el);
    if (prev !== void 0) clearTimeout(prev);
    const t = setTimeout(() => {
      resetTimers.delete(el);
      setRowBtnState(el, "idle", label);
      el.disabled = false;
    }, ROW_BTN_RESET_MS);
    resetTimers.set(el, t);
  }
  var ROW_BTN_RESET_MS, ROW_BTN_OK_TEXT, resetTimers;
  var init_settings_btn_state = __esm({
    "src/core/settings-btn-state.ts"() {
      ROW_BTN_RESET_MS = 2e3;
      ROW_BTN_OK_TEXT = "已连通";
      resetTimers = /* @__PURE__ */ new WeakMap();
    }
  });

  // src/core/path-picker.ts
  function isExcludedPath(p) {
    if (!p) return false;
    for (const seg of p.split("/")) {
      if (EXCLUDED_DIR_NAMES.has(seg)) return true;
    }
    return false;
  }
  function foldersFromFiles(paths) {
    const out = /* @__PURE__ */ new Set([""]);
    for (const p of paths) {
      if (isExcludedPath(p)) continue;
      const sep = p.lastIndexOf("/");
      if (sep === -1) continue;
      let dir = p.slice(0, sep);
      while (dir) {
        if (!isExcludedPath(dir)) out.add(dir);
        const i = dir.lastIndexOf("/");
        dir = i === -1 ? "" : dir.slice(0, i);
      }
    }
    return [...out].sort();
  }
  async function collectVaultFolders(app) {
    var _a, _b, _c, _d;
    const out = /* @__PURE__ */ new Set([""]);
    try {
      const files = ((_c = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getFiles) == null ? void 0 : _b.call(_a)) != null ? _c : []).map((f) => f.path);
      for (const p of foldersFromFiles(files)) out.add(p);
    } catch (e) {
    }
    const adapter = (_d = app == null ? void 0 : app.vault) == null ? void 0 : _d.adapter;
    if (adapter && typeof adapter.list === "function") {
      const walk = async (dir, depth) => {
        var _a2;
        if (depth > 40) return;
        let listed = null;
        try {
          listed = await adapter.list(dir);
        } catch (e) {
          if (dir === "") {
            try {
              listed = await adapter.list("/");
            } catch (e2) {
              return;
            }
          } else {
            return;
          }
        }
        for (const f of (_a2 = listed == null ? void 0 : listed.folders) != null ? _a2 : []) {
          const p = String(f).replace(/^\/+|\/+$/g, "");
          if (!p) continue;
          if (isExcludedPath(p)) continue;
          if (!out.has(p)) out.add(p);
          await walk(p, depth + 1);
        }
      };
      try {
        await walk("", 0);
      } catch (e) {
      }
    }
    return [...out].sort();
  }
  function normalizePicked(list) {
    const out = [];
    for (const item of list) {
      const raw = String(item);
      if (raw === "") {
        if (!out.includes("")) out.push("");
        continue;
      }
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const p = trimmed.replace(/^\/+|\/+$/g, "");
      if (p === "") {
        if (!out.includes("")) out.push("");
        continue;
      }
      if (!out.includes(p)) out.push(p);
    }
    return out;
  }
  function renderPathChips(container, selected, onChange, emptyText = "未选择", onChipClick) {
    container.innerHTML = "";
    container.classList.add("bz-path-picker-chips");
    if (selected.length === 0) {
      if (!emptyText) return;
      const empty = document.createElement("span");
      empty.className = "bz-path-picker-chips-empty";
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    for (const path of selected) {
      const label = path === "" ? "（库根目录）" : path;
      const chip = document.createElement("span");
      chip.className = "bz-path-picker-chip" + (onChipClick ? " bz-path-picker-chip--click" : "");
      chip.title = label;
      const name = document.createElement("span");
      name.className = "bz-path-picker-chip-name";
      name.textContent = label;
      if (onChipClick) name.onclick = () => onChipClick(path);
      const x = document.createElement("button");
      x.className = "bz-path-picker-chip-x";
      x.textContent = "✕";
      x.setAttribute("aria-label", `移除 ${label}`);
      x.onclick = () => onChange(selected.filter((p) => p !== path));
      chip.appendChild(name);
      chip.appendChild(x);
      container.appendChild(chip);
    }
  }
  function renderPathSettingRow(opts) {
    const readValue = () => {
      const v = opts.value;
      return Array.isArray(v) ? [...v] : v ? [v] : [];
    };
    let current = readValue();
    const setting = new Setting(opts.parent).setName(opts.name);
    if (opts.desc) setting.setDesc(opts.desc);
    setting.settingEl.classList.add("bz-path-picker-setting-row");
    const chipsWrap = document.createElement("div");
    chipsWrap.className = "bz-path-picker-chips--setting";
    const apply = (list) => {
      try {
        const res = opts.onChange(list);
        if (res && typeof res.then === "function") {
          return Promise.resolve(res).then((final) => {
            current = Array.isArray(final) ? final : list;
            renderAll();
          }).catch((e) => {
            notifySaveError(e, opts.name);
            renderAll();
          });
        }
        current = Array.isArray(res) ? res : list;
        renderAll();
      } catch (e) {
        notifySaveError(e, opts.name);
        renderAll();
      }
    };
    const openPicker = () => openPathPicker({
      title: opts.pickerTitle || opts.name,
      desc: opts.pickerDesc,
      mode: opts.mode,
      selected: current,
      okText: opts.okText,
      onConfirm: (list) => {
        void apply(list);
      }
    });
    const render = () => renderPathChips(chipsWrap, current, (next) => {
      void apply(next);
    }, "", openPicker);
    let btn = null;
    setting.addButton((b) => {
      b.setButtonText(opts.buttonText || (opts.mode === "multi" ? "添加…" : "选择…")).onClick(openPicker);
      b.buttonEl.classList.add("bz-path-picker-btn--slim");
      btn = b.buttonEl;
    });
    const control = setting.settingEl.querySelector(".setting-item-control");
    if (control) control.appendChild(chipsWrap);
    const syncBtn = () => {
      setting.settingEl.dataset.filled = current.length > 0 ? "1" : "0";
      if (!btn || !control) return;
      if (current.length === 0) {
        if (!btn.isConnected) control.appendChild(btn);
      } else if (btn.isConnected) {
        btn.remove();
      }
    };
    const renderAll = () => {
      syncBtn();
      render();
    };
    const refresh = () => {
      current = readValue();
      renderAll();
    };
    renderAll();
    return { refresh, settingEl: setting.settingEl };
  }
  function closePathPicker() {
    if (currentMask) {
      currentMask.remove();
      currentMask = null;
    }
    if (currentPopup) {
      currentPopup.remove();
      currentPopup = null;
    }
    if (currentHandle) {
      currentHandle.unregister();
      currentHandle = null;
    }
    if (focusTimer !== null) {
      window.clearTimeout(focusTimer);
      focusTimer = null;
    }
    if (focusRestore) {
      const el = focusRestore;
      focusRestore = null;
      if (el.isConnected) el.focus();
    }
  }
  function openPathPicker(opts) {
    var _a, _b, _c;
    closePathPicker();
    focusRestore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const app = getApp();
    const mode = opts.mode || "single";
    const selected = new Set(normalizePicked(opts.selected || []));
    const pinnedAtOpen = [...selected];
    const { mask, popup } = createOverlay({
      maskId: "bz-path-picker-mask",
      popupId: "bz-path-picker-popup",
      // ticket 133：桌面/移动端统一一张居中卡——左右各 16px 外边距，宽视口封顶 440px（不分两套样式）
      width: "min(calc(100vw - 32px), 440px)",
      maxWidth: 440,
      onMaskClick: () => closePathPicker()
    });
    currentMask = mask;
    currentPopup = popup;
    const skinClasses = (opts.skinClassName || "").split(/\s+/).filter(Boolean);
    if (skinClasses.length) {
      mask.classList.add(...skinClasses);
      popup.classList.add(...skinClasses);
    }
    popup.classList.add("bz-path-picker");
    popup.style.height = "min(560px, 82vh)";
    const head = document.createElement("div");
    head.className = "bz-path-picker-head";
    const title = document.createElement("h3");
    title.className = "bz-path-picker-title";
    title.textContent = opts.title || "选择文件夹";
    head.appendChild(title);
    if (opts.desc) {
      const desc = document.createElement("div");
      desc.className = "bz-path-picker-desc";
      desc.textContent = opts.desc;
      head.appendChild(desc);
    }
    const search = document.createElement("input");
    search.type = "text";
    search.className = "bz-path-picker-search";
    search.placeholder = "搜索目录…";
    search.spellcheck = false;
    search.setAttribute("aria-label", "搜索目录");
    const listEl = document.createElement("div");
    listEl.className = "bz-path-picker-list";
    const state = { folders: [], q: "" };
    const foot = document.createElement("div");
    foot.className = "bz-path-picker-foot";
    const selinfo = document.createElement("span");
    selinfo.className = "bz-path-picker-selinfo";
    const btns = document.createElement("div");
    btns.className = "bz-path-picker-foot-btns";
    foot.appendChild(selinfo);
    foot.appendChild(btns);
    const mkBtn = (label, primary, onclick) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = "bz-path-picker-btn" + (primary ? " bz-path-picker-btn--primary" : "");
      b.onclick = onclick;
      btns.appendChild(b);
      return b;
    };
    if (mode === "multi") mkBtn("清空", false, () => {
      selected.clear();
      renderList();
      updateSel();
    });
    const submit = () => {
      const list = normalizePicked([...selected]);
      closePathPicker();
      opts.onConfirm(list);
    };
    const newBtn = mkBtn("新建文件夹", false, () => {
      var _a2;
      const name = state.q.trim().replace(/^\/+|\/+$/g, "");
      if (!name) return;
      const parent = (_a2 = [...selected][0]) != null ? _a2 : "";
      const full = parent ? `${parent}/${name}` : name;
      void (async () => {
        if (!state.folders.includes(full)) {
          await app.vault.createFolder(full);
          if (!state.folders.includes(full)) state.folders.push(full);
        }
        if (mode === "single") selected.clear();
        selected.add(full);
        renderList();
        updateSel();
      })().catch((e) => notifyActionError(e, `新建文件夹 ${full}`));
    });
    newBtn.disabled = !state.q.trim();
    mkBtn(opts.okText || "下一步", true, submit);
    function orderedList() {
      const pinned = [];
      const rest = [];
      const pinSet = new Set(pinnedAtOpen);
      for (const f of state.folders) {
        if (pinSet.has(f)) pinned.push(f);
        else rest.push(f);
      }
      const rootIdx = rest.indexOf("");
      const root = rootIdx >= 0 ? rest.splice(rootIdx, 1)[0] : null;
      rest.reverse();
      return [...pinned, ...root === null ? [] : [root], ...rest];
    }
    function renderList() {
      listEl.innerHTML = "";
      const q = state.q.trim().toLowerCase();
      const exact = !!q && state.folders.includes(q);
      const LIMIT = 300;
      let n = 0;
      let total = 0;
      for (const folder of orderedList()) {
        if (q && !exact && !folder.toLowerCase().includes(q)) continue;
        total++;
        if (n >= LIMIT) continue;
        n++;
        const on = selected.has(folder);
        const row = document.createElement("div");
        row.className = "bz-path-picker-row" + (on ? " bz-path-picker-row--sel" : "");
        row.dataset.path = folder;
        row.setAttribute("role", mode === "multi" ? "checkbox" : "option");
        row.setAttribute("aria-checked", on ? "true" : "false");
        const box = document.createElement("span");
        box.className = "bz-path-picker-check";
        box.textContent = on ? "✓" : "";
        const name = document.createElement("span");
        name.className = "bz-path-picker-name";
        name.textContent = folder === "" ? "（库根目录）" : folder;
        name.title = folder === "" ? "（库根目录）" : folder;
        row.appendChild(box);
        row.appendChild(name);
        row.onclick = () => {
          if (mode === "single") {
            selected.clear();
            selected.add(folder);
          } else if (selected.has(folder)) {
            selected.delete(folder);
          } else {
            selected.add(folder);
          }
          renderList();
          updateSel();
        };
        row.tabIndex = 0;
        row.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            row.click();
          }
        });
        if (mode === "single") {
          row.ondblclick = () => {
            row.click();
            submit();
          };
        }
        listEl.appendChild(row);
      }
      if (!total) {
        const empty = document.createElement("div");
        empty.className = "bz-path-picker-empty";
        empty.textContent = "没有匹配的目录";
        listEl.appendChild(empty);
      } else if (total > LIMIT) {
        const more = document.createElement("div");
        more.className = "bz-path-picker-empty";
        more.textContent = `已显示前 ${LIMIT} 个（共 ${total} 个匹配目录），请输入关键词缩小范围`;
        listEl.appendChild(more);
      }
    }
    function updateSel() {
      if (mode === "single") {
        const first = [...selected][0];
        selinfo.textContent = first === void 0 ? "未选择" : first === "" ? "已选（库根目录）" : `已选 ${first}`;
      } else {
        selinfo.textContent = `已选 ${selected.size} 项`;
      }
    }
    search.oninput = () => {
      state.q = search.value;
      newBtn.disabled = !state.q.trim();
      renderList();
    };
    search.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      const first = listEl.querySelector(".bz-path-picker-row");
      if (!first) return;
      ev.preventDefault();
      first.click();
      if (mode === "single") submit();
    });
    try {
      const files = ((_c = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getFiles) == null ? void 0 : _b.call(_a)) != null ? _c : []).map((f) => f.path);
      state.folders = foldersFromFiles(files);
    } catch (e) {
    }
    void collectVaultFolders(app).then((folders) => {
      if (!mask.isConnected) return;
      state.folders = folders;
      popup.dataset.ready = "1";
      renderList();
    });
    renderList();
    updateSel();
    popup.append(head, search, listEl, foot);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    currentHandle = escManager.register("bz-path-picker", {
      isVisible: () => !!currentMask,
      close: () => closePathPicker()
    });
    focusTimer = window.setTimeout(() => {
      focusTimer = null;
      if (mask.isConnected) search.focus();
    }, 30);
  }
  var EXCLUDED_DIR_NAMES, currentMask, currentPopup, currentHandle, focusTimer, focusRestore;
  var init_path_picker = __esm({
    "src/core/path-picker.ts"() {
      init_fake_obsidian();
      init_app();
      init_dom();
      init_esc_manager();
      init_notice();
      EXCLUDED_DIR_NAMES = /* @__PURE__ */ new Set([".obsidian", ".trash", "node_modules", ".git"]);
      currentMask = null;
      currentPopup = null;
      currentHandle = null;
      focusTimer = null;
      focusRestore = null;
    }
  });

  // src/core/settings-schema.ts
  function selectOptionsOf(options, snapshot) {
    return typeof options === "function" ? options(snapshot) : options;
  }
  function selectOptionsSignature(opts) {
    return opts.map((o) => o.value).join("");
  }
  function selectDisplayValue(read, opts) {
    var _a, _b, _c;
    const v = String((_a = read()) != null ? _a : "");
    return opts.some((o) => o.value === v) ? v : (_c = (_b = opts[0]) == null ? void 0 : _b.value) != null ? _c : "";
  }
  function bindValue(binding) {
    if ("key" in binding) {
      const key = binding.key;
      return {
        read: () => getSettings()[key],
        write: (v) => {
          getSettings()[key] = v;
        },
        persist: () => saveSettings()
      };
    }
    return { read: () => binding.get(), write: (v) => binding.set(v), persist: () => binding.save() };
  }
  function safePersist(persist, what) {
    try {
      Promise.resolve(persist()).catch((e) => notifySaveError(e, what));
    } catch (e) {
      notifySaveError(e, what);
    }
  }
  function currentSnapshot() {
    return tryGetSettings();
  }
  function resolveNumberBound(bound, snapshot) {
    if (bound === void 0) return void 0;
    if (typeof bound !== "function") return bound;
    const v = bound(snapshot);
    return typeof v === "number" && Number.isFinite(v) ? v : void 0;
  }
  function parseClampedNumber(raw, min, max) {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    let out = n;
    if (min !== void 0) out = Math.max(min, out);
    if (max !== void 0) out = Math.min(max, out);
    return out;
  }
  function wireSecretEye(setting, el) {
    let revealed = false;
    setting.addExtraButton((b) => {
      b.setIcon("eye").setTooltip("显示 / 隐藏");
      b.extraSettingsEl.setAttribute("aria-label", "显示密钥");
      b.extraSettingsEl.setAttribute("aria-pressed", "false");
      b.onClick(() => {
        revealed = !revealed;
        el.type = revealed ? "text" : "password";
        b.setIcon(revealed ? "eye-off" : "eye");
        b.extraSettingsEl.setAttribute("aria-pressed", String(revealed));
        b.extraSettingsEl.setAttribute("aria-label", revealed ? "隐藏密钥" : "显示密钥");
      });
    });
  }
  function renderSettingsInto(container, schema) {
    var _a;
    const entries = [];
    const customRefreshes = [];
    const reevaluate = () => {
      const snap = currentSnapshot();
      for (const e of entries) {
        e.el.classList.toggle("bz-setting-hidden", e.visibleWhen ? !e.visibleWhen(snap) : false);
      }
      for (const fn of customRefreshes) {
        try {
          fn();
        } catch (e) {
        }
      }
      refreshSettingsGroupCounts(container);
      markSettingSplitRows(container);
    };
    const attachHelp = (setting, help) => {
      if (!help) return;
      const nameEl = setting.nameEl;
      if (nameEl) attachHelpTip(nameEl, { text: help });
    };
    const newRowSetting = (body, row) => {
      const setting = new Setting(body).setName(row.name);
      if (row.desc) setting.setDesc(row.desc);
      attachHelp(setting, row.help);
      if (row.visibleWhen) entries.push({ el: setting.settingEl, visibleWhen: row.visibleWhen });
      return setting;
    };
    const renderTextualRow = (body, row) => {
      var _a2;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      const setting = newRowSetting(body, row);
      const isNumber = row.type === "number";
      const acc = isNumber ? bindValue(row.binding) : bindValue(row.binding);
      const changeCb = row.onChange;
      const initial = String((_a2 = acc.read()) != null ? _a2 : "");
      let pending = null;
      let last = initial;
      let dirty = false;
      let raw = initial;
      const warn = new CommitWarn(initial, row.onCommit);
      let numError = false;
      const markNumberError = () => {
        var _a3, _b;
        if (numError) return;
        numError = true;
        (_a3 = currentText == null ? void 0 : currentText.inputEl) == null ? void 0 : _a3.classList.add("bz-input--error");
        const base = row.desc ? `${row.desc}；` : "";
        setting.setDesc(`${base}需为数字，已保留原值 ${String((_b = acc.read()) != null ? _b : "")}`);
      };
      const clearNumberError = () => {
        var _a3, _b;
        if (!numError) return;
        numError = false;
        (_a3 = currentText == null ? void 0 : currentText.inputEl) == null ? void 0 : _a3.classList.remove("bz-input--error");
        setting.setDesc((_b = row.desc) != null ? _b : "");
      };
      const commit = () => {
        var _a3;
        if (pending !== null) {
          clearTimeout(pending);
          pending = null;
        }
        if (!dirty) return;
        if (isNumber) {
          const snap = currentSnapshot();
          const n = parseClampedNumber(
            raw,
            resolveNumberBound(row.min, snap),
            resolveNumberBound(row.max, snap)
          );
          if (n === null && raw.trim() !== "") {
            dirty = false;
            if (currentText) currentText.setValue(String((_a3 = acc.read()) != null ? _a3 : ""));
            clearNumberError();
          }
        }
        safePersist(acc.persist, row.name);
        warn.fire(last);
        reevaluate();
      };
      let currentText = null;
      const addInto = (t) => {
        currentText = t;
        t.setValue(initial);
        const place = (snap) => typeof row.placeholder === "function" ? row.placeholder(snap) : row.placeholder;
        const applyPlaceholder = () => {
          if (t.setPlaceholder) {
            const p = place(currentSnapshot());
            if (p !== void 0) t.setPlaceholder(p);
          }
        };
        applyPlaceholder();
        t.onChange((v) => {
          dirty = true;
          if (isNumber) {
            raw = v;
            const snap = currentSnapshot();
            const n = parseClampedNumber(
              v,
              resolveNumberBound(row.min, snap),
              resolveNumberBound(row.max, snap)
            );
            if (n === null) {
              if (v.trim() !== "") markNumberError();
              return;
            }
            clearNumberError();
            acc.write(n);
            if (String(n) !== v) {
              last = String(n);
              t.setValue(last);
            } else {
              last = v;
            }
          } else {
            acc.write(v);
            last = v;
          }
          try {
            changeCb == null ? void 0 : changeCb(isNumber ? acc.read() : v, ctx);
          } catch (e) {
            console.error(e);
            notifySaveError(e, row.name);
          }
          if (pending !== null) clearTimeout(pending);
          pending = setTimeout(commit, TEXT_COMMIT_DELAY);
        });
        const inputEl = t.inputEl;
        if (inputEl) {
          if (isNumber) {
            const num = row;
            inputEl.type = "number";
            const applyBounds = () => {
              const snap = currentSnapshot();
              const lo = resolveNumberBound(num.min, snap);
              const hi = resolveNumberBound(num.max, snap);
              inputEl.min = lo === void 0 ? "" : String(lo);
              inputEl.max = hi === void 0 ? "" : String(hi);
            };
            applyBounds();
            if (typeof num.max === "function") customRefreshes.push(applyBounds);
            if (num.step !== void 0) inputEl.step = String(num.step);
          }
          if (row.type === "secret") {
            inputEl.type = "password";
            inputEl.autocomplete = "off";
            inputEl.spellcheck = false;
            wireSecretEye(setting, inputEl);
          }
          const mode = row.inputMode;
          if (mode && mode !== "text") inputEl.inputMode = mode;
          inputEl.addEventListener("blur", commit);
          if (row.type !== "textarea") {
            inputEl.addEventListener("keydown", (e) => {
              if (e.key === "Enter") commit();
            });
          }
        }
        if (typeof row.placeholder === "function") {
          const origReevaluate = ctx.refreshVisibility;
          ctx.refreshVisibility = () => {
            applyPlaceholder();
            origReevaluate();
          };
        }
        if (row.refreshKey !== void 0) {
          const ref = row.refreshKey;
          customRefreshes.push(() => {
            if (currentText) {
              const snap = currentSnapshot();
              const fresh = typeof ref === "function" ? ref(snap) : String(snap[ref]);
              if (currentText.setValue) {
                dirty = false;
                currentText.setValue(String(fresh != null ? fresh : ""));
              }
            }
          });
        }
      };
      const actions = row.actions;
      if (actions) {
        for (const a of actions) {
          setting.addButton((b) => {
            if (a.cta) b.setCta();
            b.setButtonText(a.text).onClick(() => {
              void (async () => {
                var _a3;
                const el = b.buttonEl;
                try {
                  if (a.stateful) setRowBtnState(el, "busy", a.text);
                  await a.onClick(last, ctx);
                  if (a.stateful) setRowBtnState(el, "ok", a.text);
                } catch (e) {
                  if (a.stateful) setRowBtnState(el, "fail", a.text, shortFailReason(e));
                  else throw e;
                } finally {
                  if (a.stateful) armRowBtnReset(el, a.text);
                }
                if (currentText && currentText.setValue) {
                  dirty = false;
                  currentText.setValue(String((_a3 = acc.read()) != null ? _a3 : ""));
                }
                reevaluate();
              })();
            });
          });
        }
      }
      if (row.type === "text") setting.addText(addInto);
      else if (row.type === "textarea") setting.addTextArea(addInto);
      else setting.addText(addInto);
    };
    const renderRow = (body, rowArg, parentToggleKey) => {
      var _a2, _b, _c;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      let row = rowArg;
      if (row.isChild && parentToggleKey) {
        row = {
          ...row,
          visibleWhen: (snap) => snap[parentToggleKey] === true && (rowArg.visibleWhen ? rowArg.visibleWhen(snap) : true)
        };
      }
      switch (row.type) {
        case "custom": {
          const wrap = document.createElement("div");
          body.appendChild(wrap);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          row.render(wrap, { rowEl: wrap, refreshVisibility: reevaluate });
          if (row.onRefresh) customRefreshes.push(() => row.onRefresh({ rowEl: wrap, refreshVisibility: reevaluate }));
          return;
        }
        case "path": {
          const acc = bindValue(row.binding);
          const multi = row.mode === "multi";
          const initialRaw = acc.read();
          const initialKey = multi ? JSON.stringify(initialRaw != null ? initialRaw : []) : String(initialRaw != null ? initialRaw : "");
          const warn = new CommitWarn(initialKey, row.onCommit);
          let applied = multi ? Array.isArray(initialRaw) ? [...initialRaw] : [] : String(initialRaw != null ? initialRaw : "");
          const wrap = document.createElement("div");
          body.appendChild(wrap);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          renderPathSettingRow({
            parent: wrap,
            name: row.name,
            desc: row.desc,
            mode: row.mode,
            value: multi ? Array.isArray(initialRaw) ? [...initialRaw] : [] : String(initialRaw != null ? initialRaw : ""),
            pickerTitle: row.pickerTitle,
            pickerDesc: row.pickerDesc,
            buttonText: row.buttonText,
            okText: row.okText,
            emptyText: row.emptyText,
            onChange: (list) => {
              var _a3;
              const v = multi ? list : (list[0] || "").trim().replace(/^\/+|\/+$/g, "");
              acc.write(v);
              safePersist(() => acc.persist(), row.name);
              let res;
              try {
                res = (_a3 = row.onChange) == null ? void 0 : _a3.call(row, list, ctx);
              } catch (e) {
                notifySaveError(e, row.name);
                acc.write(applied);
                safePersist(() => acc.persist(), row.name);
                reevaluate();
                return multi ? Array.isArray(applied) ? [...applied] : [] : String(applied != null ? applied : "") ? [String(applied)] : [];
              }
              applied = v;
              warn.fire(multi ? JSON.stringify(v) : String(v));
              reevaluate();
              if (res && typeof res.then === "function") {
                return Promise.resolve(res).then(
                  (final) => Array.isArray(final) ? final : list
                );
              }
              return Array.isArray(res) ? res : void 0;
            }
          });
          return;
        }
        case "toggle": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addToggle(
            (t) => t.setValue(acc.read() === true).onChange(async (v) => {
              var _a3;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
            })
          );
          return;
        }
        case "select": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          const readOptions = () => selectOptionsOf(row.options, currentSnapshot());
          let dd = null;
          let optionsSig = null;
          const mount = () => {
            while (setting.controlEl.firstChild) setting.controlEl.removeChild(setting.controlEl.firstChild);
            setting.addDropdown((d) => {
              dd = d;
              const opts = readOptions();
              for (const opt of opts) d.addOption(opt.value, opt.label);
              d.setValue(selectDisplayValue(() => acc.read(), opts));
              d.onChange(async (v) => {
                var _a3;
                acc.write(v);
                reevaluate();
                try {
                  await acc.persist();
                } catch (e) {
                  notifySaveError(e, row.name);
                }
                (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
              });
            });
          };
          mount();
          optionsSig = selectOptionsSignature(readOptions());
          if (row.refreshKey !== void 0 || typeof row.options === "function") {
            const sync = () => {
              const opts = readOptions();
              const sig = selectOptionsSignature(opts);
              if (sig !== optionsSig) {
                optionsSig = sig;
                mount();
                return;
              }
              dd == null ? void 0 : dd.setValue(selectDisplayValue(() => acc.read(), opts));
            };
            customRefreshes.push(sync);
          }
          return;
        }
        case "choiceCards": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          const pick = uiCardChoice({
            value: String((_a2 = acc.read()) != null ? _a2 : "") || row.options[0].value,
            options: row.options,
            label: row.name,
            onChange: async (v) => {
              var _a3;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
            }
          });
          setting.controlEl.appendChild(pick.el);
          return;
        }
        case "slider": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addSlider((sl) => {
            var _a3;
            sl.setLimits(row.min, row.max, (_a3 = row.step) != null ? _a3 : 1);
            sl.setValue(Number(acc.read()) || 0);
            sl.setDynamicTooltip();
            sl.onChange(async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            });
          });
          for (const a of (_b = row.actions) != null ? _b : []) {
            setting.addButton((b) => {
              if (a.cta) b.setCta();
              b.setButtonText(a.text).onClick(() => void a.onClick(void 0, ctx));
            });
          }
          return;
        }
        case "button": {
          const setting = newRowSetting(body, row);
          setting.addButton((b) => {
            if (row.cta) b.setCta();
            b.setDisabled(row.disabled === true);
            b.setButtonText(row.buttonText).onClick(() => row.onClick(ctx));
          });
          setting.settingEl.classList.add("bz-setting-action-row");
          return;
        }
        case "info": {
          const setting = newRowSetting(body, row);
          for (const a of (_c = row.actions) != null ? _c : []) {
            setting.addButton((b) => {
              if (a.cta) b.setCta();
              b.setButtonText(a.text).onClick(() => void a.onClick(void 0, ctx));
            });
          }
          return;
        }
        case "list": {
          const wrap = document.createElement("div");
          wrap.className = "bz-setlist-wrap";
          body.appendChild(wrap);
          const setting = new Setting(wrap).setName(row.name);
          if (row.desc) setting.setDesc(row.desc);
          attachHelp(setting, row.help);
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          const readItems = () => typeof row.items === "function" ? row.items() : row.items;
          const renderItems = () => {
            var _a3;
            (_a3 = wrap.querySelector(".bz-setlist")) == null ? void 0 : _a3.remove();
            wrap.appendChild(uiSetlist({
              items: readItems(),
              variant: row.variant,
              removeLabel: row.removeLabel,
              emptyText: row.emptyText,
              onRemove: (key) => {
                void (async () => {
                  var _a4;
                  const remaining = readItems().map((x) => x.key).filter((k) => k !== key);
                  try {
                    await ((_a4 = row.onChange) == null ? void 0 : _a4.call(row, remaining, ctx));
                  } catch (e) {
                    notifySaveError(e, row.name || "列表项");
                  } finally {
                    reevaluate();
                  }
                })();
              }
            }));
          };
          renderItems();
          customRefreshes.push(renderItems);
          return;
        }
        case "text":
        case "textarea":
        case "number":
        case "secret":
          renderTextualRow(body, row);
          return;
      }
    };
    const renderGroupRows = (body, rows) => {
      var _a2, _b;
      const firstToggleKey = (_b = (_a2 = rows.find((r) => r.type === "toggle" && "key" in r.binding)) == null ? void 0 : _a2.binding.key) != null ? _b : null;
      for (const row of rows) renderRow(body, row, firstToggleKey);
    };
    for (const group of schema.groups) {
      if (group.icon) {
        const body = createSettingsGroup(container, { icon: group.icon, name: group.name });
        const groupEl = (_a = body.parentElement) != null ? _a : container;
        if (group.visibleWhen) entries.push({ el: groupEl, visibleWhen: group.visibleWhen });
        renderGroupRows(body, group.rows);
      } else {
        const title = document.createElement("div");
        title.className = "bz-setting-section-title";
        title.textContent = group.name;
        container.appendChild(title);
        if (group.visibleWhen) entries.push({ el: title, visibleWhen: group.visibleWhen });
        renderGroupRows(container, group.rows);
      }
    }
    reevaluate();
    return { refresh: reevaluate };
  }
  var TEXT_COMMIT_DELAY, CommitWarn;
  var init_settings_schema = __esm({
    "src/core/settings-schema.ts"() {
      init_fake_obsidian();
      init_settings_btn_state();
      init_settings_provider();
      init_path_picker();
      init_settings_modal();
      init_ui();
      init_notice();
      TEXT_COMMIT_DELAY = 800;
      CommitWarn = class {
        constructor(initial, onCommit) {
          this.initial = initial;
          this.onCommit = onCommit;
          this.warnedInitial = null;
        }
        fire(current) {
          if (!this.onCommit) return;
          if (current !== this.initial) {
            if (this.warnedInitial !== this.initial) {
              this.warnedInitial = this.initial;
              this.onCommit();
            }
          } else {
            this.warnedInitial = null;
          }
        }
      };
    }
  });

  // src/core/settings-modal.ts
  function createSettingsGroup(container, opts) {
    const group = document.createElement("div");
    group.className = "bz-settings-group";
    const head = document.createElement("div");
    head.className = "bz-settings-group-head";
    const icon = document.createElement("span");
    icon.className = "bz-settings-group-icon";
    setIcon(icon, opts.icon);
    const name = document.createElement("span");
    name.className = "bz-settings-group-name";
    name.textContent = opts.name;
    const count = document.createElement("span");
    count.className = "bz-settings-group-count";
    count.textContent = "0 项";
    head.append(icon, name, count);
    const body = document.createElement("div");
    body.className = "bz-settings-group-body";
    group.append(head, body);
    container.appendChild(group);
    return body;
  }
  function isItemHidden(el) {
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.classList.contains("bz-setting-hidden")) return true;
      if (cur.style.display === "none") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function refreshSettingsGroupCounts(content) {
    content.querySelectorAll(".bz-settings-group").forEach((g) => {
      const body = g.querySelector(".bz-settings-group-body");
      const countEl = g.querySelector(".bz-settings-group-count");
      if (!body || !countEl) return;
      const n = [...body.querySelectorAll(".setting-item")].filter((el) => {
        const h = el;
        return !h.classList.contains("bz-setting-action-row") && !isItemHidden(h);
      }).length;
      countEl.textContent = `${n} 项`;
      countEl.style.display = n > 0 ? "" : "none";
    });
  }
  function markSettingSplitRows(container) {
    container.querySelectorAll(".setting-item").forEach((el) => {
      if (el.classList.contains("bz-path-picker-setting-row")) return;
      const ctl = el.querySelector(".setting-item-control");
      el.classList.toggle("bz-setting-split", !!ctl && ctl.children.length >= 2);
    });
  }
  function closeSettingsModal() {
    var _a;
    if (currentModal) {
      const m = currentModal;
      currentModal = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && m.popup.contains(active)) active.blur();
      m.dispose();
      (_a = m.onClose) == null ? void 0 : _a.call(m);
    }
  }
  function openSettingsModal(opts) {
    var _a;
    closeSettingsModal();
    const prevActive = document.activeElement;
    const { mask, popup } = createOverlay({
      maskId: "bz-settings-modal-mask",
      popupId: "bz-settings-modal-popup",
      // z-index 动态发号（ADR-0067）：原静态层规家族表随动态层级制退役，
      // 全站规则只有一条——谁后显示谁在上（settings-modal 每次打开新建 DOM，创建即显示）
      maxWidth: opts.maxWidth,
      onMaskClick: () => closeSettingsModal()
    });
    const header = document.createElement("div");
    header.className = "bz-settings-header";
    const title = document.createElement("h3");
    title.className = "bz-settings-title";
    title.textContent = opts.title;
    header.appendChild(title);
    const content = document.createElement("div");
    content.className = "bz-settings-content";
    renderSettingsInto(content, (_a = opts.schema) != null ? _a : { groups: [] });
    const hasVisibleItem = Array.from(content.querySelectorAll(".setting-item")).some(
      (el) => !el.classList.contains("bz-setting-action-row") && !isItemHidden(el)
    );
    if (!hasVisibleItem) {
      content.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "bz-settings-empty";
      empty.textContent = opts.emptyText || "暂无设置项";
      if (opts.emptyDesc) {
        const desc = document.createElement("div");
        desc.className = "bz-settings-empty-desc";
        desc.textContent = opts.emptyDesc;
        empty.appendChild(desc);
      }
      content.appendChild(empty);
    }
    popup.appendChild(header);
    popup.appendChild(content);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-modal", "true");
    const firstFocusable2 = Array.from(popup.querySelectorAll(FOCUSABLE_SELECTOR2)).find((el) => {
      if (isItemHidden(el)) return false;
      if (isMobileEnv()) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    if (firstFocusable2) firstFocusable2.focus();
    const releaseFocusTrap = trapFocus(popup);
    const handle = escManager.register("bz-settings-modal", {
      isVisible: () => !!currentModal,
      close: () => closeSettingsModal()
    });
    currentModal = {
      mask,
      popup,
      onClose: opts.onClose,
      dispose: () => {
        releaseFocusTrap();
        mask.remove();
        popup.remove();
        handle.unregister();
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
    };
  }
  var FOCUSABLE_SELECTOR2, currentModal;
  var init_settings_modal = __esm({
    "src/core/settings-modal.ts"() {
      init_fake_obsidian();
      init_dom();
      init_esc_manager();
      init_mobile();
      init_settings_schema();
      init_focus_trap();
      FOCUSABLE_SELECTOR2 = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
      currentModal = null;
    }
  });

  // src/core/settings-common.ts
  function numStrBinding(key, def) {
    return {
      get: () => {
        const raw = tryGetSettings()[key];
        if (raw === "" || raw === null || raw === void 0) return def;
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : def;
      },
      set: (v) => {
        getSettings()[key] = String(v);
      },
      save: () => saveSettings()
    };
  }
  function makeReloadWarnOnce() {
    let reloadWarned = false;
    return () => {
      if (reloadWarned) return;
      reloadWarned = true;
      notice(RELOAD_SETTINGS_NOTICE, "info");
    };
  }
  var RELOAD_SETTINGS_NOTICE;
  var init_settings_common = __esm({
    "src/core/settings-common.ts"() {
      init_notice();
      init_settings_provider();
      RELOAD_SETTINGS_NOTICE = "设置已保存，重载插件后生效";
    }
  });

  // src/core/crypto.ts
  function toBase64(bytes) {
    const CHUNK = 32768;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function cachePut(cacheKey, password, key) {
    keyCache.delete(cacheKey);
    keyCache.set(cacheKey, { pw: password, key });
    if (keyCache.size > KEY_CACHE_MAX) {
      const oldest = keyCache.keys().next().value;
      if (oldest !== void 0) keyCache.delete(oldest);
    }
  }
  function clearCryptoKeyCache() {
    keyCache.clear();
  }
  var PBKDF2_ITERATIONS, CryptoService, keyCache, KEY_CACHE_MAX;
  var init_crypto = __esm({
    "src/core/crypto.ts"() {
      PBKDF2_ITERATIONS = 1e5;
      CryptoService = class {
        static async deriveKey(password, salt) {
          const cacheKey = toBase64(salt);
          const hit = keyCache.get(cacheKey);
          if (hit && hit.pw === password) {
            keyCache.delete(cacheKey);
            keyCache.set(cacheKey, hit);
            return hit.key;
          }
          const enc = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
            "deriveKey"
          ]);
          const key = await crypto.subtle.deriveKey(
            {
              name: "PBKDF2",
              salt,
              iterations: PBKDF2_ITERATIONS,
              hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
          );
          cachePut(cacheKey, password, key);
          return key;
        }
        static async encrypt(plainText, password) {
          const encoder = new TextEncoder();
          const data = encoder.encode(plainText);
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const key = await this.deriveKey(password, salt);
          const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
          const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
          combined.set(salt, 0);
          combined.set(iv, salt.length);
          combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
          return toBase64(combined);
        }
        static async decrypt(encryptedBase64, password) {
          const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));
          const salt = combined.slice(0, 16);
          const iv = combined.slice(16, 28);
          const ciphertext = combined.slice(28);
          const key = await this.deriveKey(password, salt);
          const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
          );
          return new TextDecoder().decode(decrypted);
        }
      };
      keyCache = /* @__PURE__ */ new Map();
      KEY_CACHE_MAX = 128;
    }
  });

  // src/encrypt/data.ts
  function bytesToBase64(bytes) {
    const CHUNK = 32768;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function fingerprintOf(data) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return bytesToBase64(new Uint8Array(digest));
  }
  function randToken(len) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < len; i++) s += RAND_CHARS[bytes[i] % 64];
    return s;
  }
  function flatName() {
    return "." + randToken(11) + ".enc";
  }
  function isOrphanEncName(name) {
    if (name === ".safe.enc") return false;
    if (!name.startsWith(".") || !name.endsWith(".enc")) return false;
    const stem = name.slice(1, -4);
    return stem !== "" && !stem.includes("/") && !stem.includes("\\") && !stem.includes("..");
  }
  function currentDiaryDirectory() {
    const raw = tryGetSettings().diaryDirectory;
    const t = (raw || "").trim().replace(/\/+$/, "");
    return t || "我的/日记";
  }
  function genNoteId() {
    return "enc-" + Date.now() + "-" + randToken(6);
  }
  function genFileKey() {
    return randToken(43);
  }
  async function mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = [];
    const n = Math.min(limit, items.length);
    for (let w = 0; w < n; w++) {
      workers.push(
        (async () => {
          while (next < items.length) {
            const i = next++;
            out[i] = await fn(items[i], i);
          }
        })()
      );
    }
    const settled = await Promise.allSettled(workers);
    const firstReject = settled.find((s) => s.status === "rejected");
    if (firstReject) throw firstReject.reason;
    return out;
  }
  var ENCRYPT_CHANGED_CHANNEL, ENCRYPT_UNLOCK_CHANGED_CHANNEL, RAND_CHARS, STAGING_DIR, PENDING_FILE, BLOB_CONCURRENCY, SafeManager;
  var init_data2 = __esm({
    "src/encrypt/data.ts"() {
      init_app();
      init_domain_bus();
      init_crypto();
      init_storage();
      init_settings_provider();
      init_diary_format();
      ENCRYPT_CHANGED_CHANNEL = "encrypt:changed";
      ENCRYPT_UNLOCK_CHANGED_CHANNEL = "encrypt:unlock-changed";
      RAND_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
      STAGING_DIR = ".staging";
      PENDING_FILE = "pending.json";
      BLOB_CONCURRENCY = 3;
      SafeManager = class {
        constructor(root) {
          /** encryptRoot（vault 相对路径，默认 CONFIG/.ENCRYPT——点前缀目录 Obsidian 侧栏隐藏） */
          this.root = "CONFIG/.ENCRYPT";
          /** 主密码（只存内存，锁定时清空） */
          this.password = null;
          this.unlocked = false;
          /**
           * 中间主密钥（ADR-0211 信封结构，只存内存，锁定时清空）：解锁 v2 清单时从 masterWrap
           * 解出；wrap/清单加解密的中转密钥，修改主密码不需要触碰它（只换 masterWrap）。
           */
          this.masterKey = null;
          /** v1→v2 信封迁移进行中（issue 508：UI 据此禁用修改密码入口；changePassword 亦拒绝） */
          this.migrating = false;
          /** 迁移进度回调（UI 发通知用；done/total 为镜像数，无进度不回调） */
          this.onMigrationProgress = null;
          /** 迁移收场回调（成功 / 上锁中止 / 失败三态；UI 收进度通知用，空库瞬时升级不回调） */
          this.onMigrationEnd = null;
          this.manifest = { version: 2, keys: {}, notes: [] };
          /**
           * 最近一次解锁时自愈回滚的条目数（ADR-0018；UI 解锁成功提示用，无自愈为 0）。
           * unlock 入口复位，selfHeal 结束时写回本次实际回滚数。
           */
          this.selfHealRolledBack = 0;
          /** 解锁态变化回调（UI 状态栏等订阅；unlock 成功 / 首设成功 / lock() 时触发） */
          this.onUnlockChange = null;
          /**
           * 操作级互斥（P1-6）：lockNote/restoreNote 实例级串行的 promise 链尾。
           * 并发调用按发起顺序排队；前序失败不断链（错误只回给其自己的调用方）。
           */
          this.opQueue = Promise.resolve();
          if (root) this.root = root.replace(/\/+$/, "");
        }
        /** 清单文件完整路径（点前缀，侧栏隐藏） */
        get manifestPath() {
          return this.root + "/.safe.enc";
        }
        /** 信封结构是否就绪（v2 清单 + masterWrap 已解出）：就绪后镜像走 fileKey，否则兜底主密码 */
        get envelopeReady() {
          return this.manifest.version >= 2 && !!this.manifest.masterWrap && !!this.masterKey && !!this.password;
        }
        /**
         * 镜像密钥解析（读路径单源）：信封就绪时按 keys[ref] 用 masterKey 解出 fileKey；
         * v1 运行态（迁移完成前）兜底主密码——迁移是唯一切换点，两条路径不混跑同一镜像
         * （迁移会连清单引用一起切换，切换后 keys[ref] 必在）。
         */
        async blobKey(ref) {
          var _a;
          if (this.envelopeReady) {
            const wrap = (_a = this.manifest.keys) == null ? void 0 : _a[ref];
            if (wrap && this.masterKey) return CryptoService.decrypt(wrap, this.masterKey);
          }
          return this.password;
        }
        /**
         * 镜像加密（写路径单源）：信封就绪时复用 ref 已登记的 fileKey（覆盖写不换钥，wrap 不变），
         * 新 ref 生成 fileKey 并把 wrap 登记进清单（随下一次 saveManifest 落盘）；
         * v1 运行态兜底主密码（迁移会统一转换）。
         * @returns 密文。调用方须保证失败时清理本次新登记的 wrap（forgetKeys），防幽灵登记。
         */
        async encryptForRef(ref, plain) {
          if (this.envelopeReady) {
            this.manifest.keys = this.manifest.keys || {};
            let fileKey;
            const wrap = this.manifest.keys[ref];
            if (wrap && this.masterKey) {
              fileKey = await CryptoService.decrypt(wrap, this.masterKey);
            } else {
              fileKey = genFileKey();
              this.manifest.keys[ref] = await CryptoService.encrypt(fileKey, this.masterKey);
            }
            return CryptoService.encrypt(plain, fileKey);
          }
          return CryptoService.encrypt(plain, this.password);
        }
        /** 从清单 keys 摘除一组 ref 的 wrap（同步纯内存；随调用方的下一次 saveManifest 落盘） */
        forgetKeys(refs) {
          if (!this.manifest.keys) return;
          for (const ref of refs) {
            if (ref) delete this.manifest.keys[ref];
          }
        }
        /** 条目从清单移除时同步摘除其全部镜像 wrap（正文 + 附件原始层/预览层；随 saveManifest 落盘） */
        forgetNoteKeys(note) {
          this.forgetKeys([note.contentRef, ...note.attachments.map((a) => a.blobRef), ...note.attachments.map((a) => a.hasPreview ? a.previewRef : void 0)]);
        }
        /** 镜像相对路径 → vault 完整路径 */
        resolveRef(ref) {
          return this.root + "/" + ref;
        }
        /** 点前缀兼容适配器：Obsidian 对点前缀路径不索引，getAbstractFileByPath 返回 null；
         *  因此加密根目录内的清单/镜像一律走 vault.adapter（直读磁盘，无视隐藏） */
        get adapter() {
          return getApp().vault.adapter || getApp().vault;
        }
        /** 清单是否存在（用于首设判断；adapter 直读磁盘，点前缀可用） */
        async exists() {
          return await this.adapter.exists(this.manifestPath);
        }
        /**
         * 解锁：读 .safe.enc → 解密 → 解析清单。首设（无文件）时创建空清单并设密码。
         * 校验方式=解密成功即通过（GCM 认证，同密码本）。
         * @param password 主密码
         * @param forceReset 清单损坏（空/解析失败）时是否强制重设新密码——
         *   重设会丢弃旧清单（旧密文永久不可解），必须由 UI 在用户明确确认后传入。
         *   返回 false 时用 manifestIssue 区分「密码错误（无 issue）」与「清单损坏（empty/corrupt）」。
         */
        async unlock(password, forceReset = false) {
          var _a;
          this.manifestIssue = void 0;
          this.selfHealRolledBack = 0;
          await this.recoverManifestWrite();
          const existsManifest = await this.exists();
          if (!existsManifest) return this.firstTimeSetup(password);
          const content = await this.adapter.read(this.manifestPath);
          if (!content.trim()) {
            this.manifestIssue = "empty";
            if (!forceReset) return false;
            return this.firstTimeSetup(password);
          }
          try {
            const plain = await CryptoService.decrypt(content.trim(), password);
            let parsed;
            try {
              parsed = JSON.parse(plain);
            } catch (e) {
              this.manifestIssue = "corrupt";
              if (!forceReset) return false;
              return this.firstTimeSetup(password);
            }
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              this.manifestIssue = "corrupt";
              if (!forceReset) return false;
              return this.firstTimeSetup(password);
            }
            if (!Array.isArray(parsed.notes)) parsed.notes = [];
            parsed.version = parsed.version || 1;
            if (parsed.version >= 2) {
              let masterKey = null;
              try {
                if (!parsed.masterWrap || typeof parsed.masterWrap !== "string") throw new Error("masterWrap 缺失");
                if (!parsed.keys || typeof parsed.keys !== "object" || Array.isArray(parsed.keys)) throw new Error("keys 缺失");
                masterKey = await CryptoService.decrypt(parsed.masterWrap, password);
              } catch (e) {
                this.manifestIssue = "corrupt";
                if (!forceReset) return false;
                return this.firstTimeSetup(password);
              }
              this.masterKey = masterKey;
            } else {
              this.masterKey = null;
            }
            this.manifest = parsed;
            this.password = password;
            this.unlocked = true;
            try {
              await this.enqueueOp(() => this.selfHeal());
            } catch (e) {
            }
            (_a = this.onUnlockChange) == null ? void 0 : _a.call(this, true);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
            if (this.manifest.version < 2 || !this.manifest.masterWrap) {
              void this.enqueueOp(() => this.migrateToEnvelope()).catch(() => {
              });
            }
            return true;
          } catch (e) {
            return false;
          }
        }
        /**
         * 校验主密码（只读，不改任何状态）：对 .safe.enc 解密成功即通过（GCM 认证，同 unlock 判据）。
         * 供销毁等高危操作的二次确认用；绝不写 this.unlocked/manifest/password，也不触发解锁事件。
         * @returns true = 密码正确；false = 密码错误或清单不存在/为空/不可读
         */
        async verifyPassword(password) {
          try {
            if (!await this.exists()) return false;
            const content = await this.adapter.read(this.manifestPath);
            if (!content.trim()) return false;
            await CryptoService.decrypt(content.trim(), password);
            return true;
          } catch (e) {
            return false;
          }
        }
        /** 首设/强制重设：生成信封密钥（masterKey + masterWrap）写空清单。写失败必须回滚解锁态（否则下次打开又误判无清单） */
        async firstTimeSetup(password) {
          var _a, _b;
          const masterKey = genFileKey();
          this.password = password;
          this.unlocked = true;
          this.masterKey = masterKey;
          (_a = this.onUnlockChange) == null ? void 0 : _a.call(this, true);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
          this.manifest = { version: 2, keys: {}, notes: [], masterWrap: await CryptoService.encrypt(masterKey, password) };
          try {
            await this.saveManifest();
            return true;
          } catch (e) {
            this.unlocked = false;
            this.password = null;
            this.masterKey = null;
            this.manifest = { version: 2, keys: {}, notes: [] };
            (_b = this.onUnlockChange) == null ? void 0 : _b.call(this, false);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: false });
            return false;
          }
        }
        /** 加锁：清内存态（含派生密钥缓存，密钥不残留）。幂等短路：已锁再锁直接返回，不重复广播 */
        lock() {
          var _a;
          if (!this.unlocked) return;
          this.unlocked = false;
          this.password = null;
          this.masterKey = null;
          this.migrating = false;
          this.manifest = { version: 2, keys: {}, notes: [] };
          (_a = this.onUnlockChange) == null ? void 0 : _a.call(this, false);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: false });
          clearCryptoKeyCache();
        }
        /**
         * 持久化清单（整体加密写回 .safe.enc；adapter 直写磁盘，点前缀可用）。
         * D2 可靠写契约原语 1 收编：整段落盘入 core per-path 串行队列（键 = .safe.enc 路径）——
         * 密文为点前缀文件，vault API 不可见、无法走 jsonFileStore，收编对象即队列原语本身；
         * 此前仅 lockNote/restoreNote 经实例 opQueue 串行，removeNote/updateNotePayload/
         * selfHeal/resolveHealth 的清单写可与 opQueue 内操作并发交错三段式 rename（tmp/bak
         * 互踩），统一入队后同路径清单写全局串行。任务不可重入：任务体内勿再对本清单入队。
         * 原子写，三段式 rename——
         * Obsidian adapter.rename 不支持覆盖已存在目标（报「Destination file already exists」），
         * 故 rename 目标恒为唯一名：S1 写 `.tmp` 完整密文 → S2 旧清单挪走为 `.bak`
         * → S3 `.tmp` 搬入为正本 → S4 删 `.bak`。任一中断点由解锁时 recoverManifestWrite 恢复：
         *   - S2 后崩溃：tmp+bak 在，manifest 缺（用 tmp 恢复，删 bak）
         *   - S3 后崩溃：manifest 新 + bak 旧（删 bak，保留新清单）
         *   - S1 后崩溃：仅 tmp 残留（清理）
         */
        async saveManifest() {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存清单");
          const json = JSON.stringify(this.manifest);
          const encrypted = await CryptoService.encrypt(json, this.password);
          await enqueueFileTask(this.manifestPath, async () => {
            await this.ensureDirFor(this.manifestPath);
            const tmp = this.manifestPath + ".tmp";
            const bak = this.manifestPath + ".bak";
            try {
              await this.adapter.remove(tmp);
            } catch (e) {
            }
            try {
              await this.adapter.remove(bak);
            } catch (e) {
            }
            await this.adapter.write(tmp, encrypted);
            await this.adapter.rename(this.manifestPath, bak);
            try {
              await this.adapter.rename(tmp, this.manifestPath);
            } catch (e) {
              try {
                await this.adapter.rename(bak, this.manifestPath);
              } catch (err) {
              }
              throw e;
            }
            try {
              await this.adapter.remove(bak);
            } catch (e) {
            }
          });
          emitDomainEvent(ENCRYPT_CHANGED_CHANNEL, { noteId: null });
        }
        /**
         * 原子写中断恢复（解锁前调用）：把清单恢复到一致状态，防「清单缺失被误判为首设」
         * 或「旧清单残留覆盖新清单」。失败静默（下次解锁重试；无残留时零开销）。
         */
        async recoverManifestWrite() {
          const adapter = this.adapter;
          const tmp = this.manifestPath + ".tmp";
          const bak = this.manifestPath + ".bak";
          try {
            const hasBak = await adapter.exists(bak);
            const hasTmp = await adapter.exists(tmp);
            if (hasBak) {
              if (hasTmp) {
                await adapter.rename(tmp, this.manifestPath);
              }
              await adapter.remove(bak);
            } else if (hasTmp) {
              await adapter.remove(tmp);
            }
          } catch (e) {
          }
        }
        /** 确保加密根目录存在（平铺布局只需根目录；adapter.mkdir 递归建，点前缀可用） */
        async ensureSafeRootDir() {
          await this.ensureDirFor(this.root + "/x");
        }
        /**
         * 递归确保目标 filePath 的父目录全部存在（用 adapter 直查磁盘 mkdir，
         * 点前缀目录 vault.getAbstractFileByPath 查不到，故不走 vault）。幂等。
         */
        async ensureDirFor(filePath) {
          const adapter = this.adapter;
          const idx = filePath.lastIndexOf("/");
          if (idx <= 0) return;
          let dir = filePath.slice(0, idx);
          const missing = [];
          let probe = dir;
          while (probe && probe !== "." && probe !== "/") {
            let exists = false;
            try {
              exists = await adapter.exists(probe);
            } catch (e) {
              exists = false;
            }
            if (exists) break;
            missing.unshift(probe);
            const slash = probe.lastIndexOf("/");
            if (slash <= 0) break;
            probe = probe.slice(0, slash);
          }
          for (const p of missing) {
            await adapter.mkdir(p);
          }
        }
        /**
         * 递归确保目标文件的父目录全部存在（Obsidian vault 路径、非点前缀，
         * 还原写回原路径用；走 vault 使 Obsidian 认可目录）。
         */
        async ensureVaultParentFolder(filePath) {
          const app = getApp();
          const idx = filePath.lastIndexOf("/");
          if (idx <= 0) return;
          let dir = filePath.slice(0, idx);
          const missing = [];
          let probe = dir;
          while (probe && probe !== "." && probe !== "/") {
            if (app.vault.getAbstractFileByPath(probe)) break;
            missing.unshift(probe);
            const slash = probe.lastIndexOf("/");
            if (slash <= 0) break;
            probe = probe.slice(0, slash);
          }
          for (const p of missing) {
            await app.vault.createFolder(p);
          }
        }
        /**
         * 原子覆盖写镜像密文（P0-1）：新密文先整体落暂存区，再 rename 换入正式位——
         * 复用 writeStaged/promoteStaged（与 .safe.enc 三段式同款思想），任何一步失败
         * （含 adapter.write 半写中断）正式位都保持旧完整密文，绝不出现半截文件。
         * 换入序列：旧镜像先挪 `.bak`（rename 目标恒不存在）→ 暂存镜像搬入正位 → 删 `.bak`；
         * 搬入失败回滚 `.bak`。无旧镜像时直接 promoteStaged（与 lockNote 提交同语义）。
         */
        async replaceMirrorAtomic(ref, ciphertext) {
          const finalPath = this.resolveRef(ref);
          const stagedPath = this.stagingPath + "/" + ref;
          const bakPath = finalPath + ".bak";
          try {
            await this.adapter.remove(bakPath);
          } catch (e) {
          }
          try {
            await this.adapter.remove(stagedPath);
          } catch (e) {
          }
          await this.writeStaged(ref, ciphertext);
          const hasOld = await this.adapter.exists(finalPath);
          if (!hasOld) {
            try {
              await this.promoteStaged(ref);
            } catch (e) {
              try {
                await this.adapter.remove(stagedPath);
              } catch (err) {
              }
              throw e;
            }
            return;
          }
          await this.adapter.rename(finalPath, bakPath);
          try {
            await this.promoteStaged(ref);
          } catch (e) {
            try {
              await this.adapter.rename(bakPath, finalPath);
            } catch (err) {
            }
            try {
              await this.adapter.remove(stagedPath);
            } catch (err) {
            }
            throw e;
          }
          try {
            await this.adapter.remove(bakPath);
          } catch (e) {
          }
        }
        /** 读镜像密文文件 → base64 密文字符串（adapter，点前缀可用） */
        async readMirror(ref) {
          const path = this.resolveRef(ref);
          try {
            if (!await this.adapter.exists(path)) return null;
            const c = await this.adapter.read(path);
            return c.trim();
          } catch (e) {
            return null;
          }
        }
        /** 删除点前缀密文镜像文件（adapter，幂等） */
        async deleteSafeFile(ref) {
          const path = this.resolveRef(ref);
          try {
            if (await this.adapter.exists(path)) await this.adapter.remove(path);
          } catch (e) {
          }
        }
        /**
         * 删除一条条目的全部密文镜像（正文 + 附件原始层/预览层）。
         * 自愈回滚 / 彻底取出 / 失效条目清理共用；deleteSafeFile 幂等，正文缺失时为无害空操作。
         */
        async deleteNoteMirrors(note) {
          if (note.contentRef) await this.deleteSafeFile(note.contentRef);
          for (const a of note.attachments) {
            await this.deleteSafeFile(a.blobRef);
            if (a.hasPreview) await this.deleteSafeFile(a.previewRef);
          }
        }
        /** 删除 vault 原文件（非点前缀，走 vault 使 Obsidian 认可删除；幂等） */
        async deleteVaultFile(path) {
          const app = getApp();
          const file = app.vault.getAbstractFileByPath(path);
          if (file && file.isFolder !== true) {
            await app.vault.delete(file);
          }
        }
        /** 是否存在 vault 文件（非点前缀原路径判断用） */
        fileExists(path) {
          const f = getApp().vault.getAbstractFileByPath(path);
          return !!f && f.isFolder !== true;
        }
        // ---------- 提交式加密（ADR-0018）：暂存区 / 挂起标记 / 自愈 / 手动清理 ----------
        /** 暂存目录 vault 路径（点前缀隐藏，与最终镜像同盘保证 rename 高效） */
        get stagingPath() {
          return this.root + "/" + STAGING_DIR;
        }
        /** 挂起标记文件 vault 路径（暂存区内，明文 noteId 列表） */
        get pendingPath() {
          return this.stagingPath + "/" + PENDING_FILE;
        }
        /** 确保暂存目录存在 */
        async ensureStagingDir() {
          await this.ensureDirFor(this.stagingPath + "/x");
        }
        /** 写镜像密文到暂存区（提交前不触碰数据文件夹正式布局、不占内存） */
        async writeStaged(ref, ciphertext) {
          await this.ensureStagingDir();
          await this.adapter.write(this.stagingPath + "/" + ref, ciphertext);
        }
        /** 暂存镜像搬入正式顶层（同盘 rename；失败抛出 → 整笔放弃，挂起态留待解锁自愈兜底） */
        async promoteStaged(ref) {
          const staged = this.stagingPath + "/" + ref;
          const final = this.resolveRef(ref);
          if (!await this.adapter.exists(staged)) throw new Error("暂存镜像缺失：" + ref);
          await this.adapter.rename(staged, final);
        }
        /** 清空暂存区全部内容（含挂起标记；目录缺失/单文件失败一律幂等，不依赖目录注册） */
        async clearStaging() {
          try {
            const listing = await this.adapter.list(this.stagingPath);
            for (const f of listing.files) {
              try {
                await this.adapter.remove(f);
              } catch (e) {
              }
            }
          } catch (e) {
          }
        }
        /** 读挂起标记（pending.json 的 noteId 列表；缺失/损坏返回空） */
        async readPending() {
          try {
            if (!await this.adapter.exists(this.pendingPath)) return [];
            const raw = await this.adapter.read(this.pendingPath);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
          } catch (e) {
            return [];
          }
        }
        /**
         * 追加一条挂起标记（读-改-写；P1-6）：整写 `[id]` 覆盖会把并发另一笔已登记的
         * 标记互吞掉（其半提交从此失去自愈线索），故先读现列表再追加写回。
         * D2 收编：读改写整体入 core per-path 串行队列（键 = pending.json 路径），
         * 与 removePending 及未来任何同路径写者互斥（原语 1）。
         */
        async addPending(id) {
          await enqueueFileTask(this.pendingPath, async () => {
            const list = await this.readPending();
            if (!list.includes(id)) list.push(id);
            await this.ensureStagingDir();
            await this.adapter.write(this.pendingPath, JSON.stringify(list));
          });
        }
        /**
         * 移除单条挂起标记（读-改-写；P1-6）：只摘除自己的 id，其余笔的标记原样保留；
         * 列表清空则删除文件（对齐原「清除标记」语义，暂存区回归无标记状态）。
         * D2 收编：读改写整体入 pending.json per-path 串行队列（原语 1）。
         */
        async removePending(id) {
          await enqueueFileTask(this.pendingPath, async () => {
            const list = await this.readPending();
            const idx = list.indexOf(id);
            if (idx !== -1) list.splice(idx, 1);
            if (list.length === 0) {
              if (await this.adapter.exists(this.pendingPath)) await this.adapter.remove(this.pendingPath);
              return;
            }
            await this.ensureStagingDir();
            await this.adapter.write(this.pendingPath, JSON.stringify(list));
          });
        }
        /**
         * 自愈回滚（ADR-0018）：对挂起标记仍在的条目判定「半提交」——删除其引用的顶层镜像
         * （已搬入的清掉、未搬入的自然无文件）、从清单丢弃该条目，随后清空暂存区与标记。
         * 关键不变量：标记于删原文件前清除，故标记存在 ⇒ 原文件未删 ⇒ 回滚永远安全、
         * 不产生密文孤儿。无挂起条目时仅清空遗留暂存。解锁成功后调用；失败不阻塞解锁。
         * @returns 本次实际回滚的条目数（挂起标记无对应条目的不计入；无挂起为 0）
         */
        async selfHeal() {
          if (!this.unlocked || !this.password) return 0;
          const pending = await this.readPending();
          let rolledBack = 0;
          if (pending.length) {
            for (const id of pending) {
              const idx = this.manifest.notes.findIndex((n) => n.id === id);
              if (idx === -1) continue;
              const note = this.manifest.notes[idx];
              await this.deleteNoteMirrors(note);
              this.manifest.notes.splice(idx, 1);
              this.forgetNoteKeys(note);
              rolledBack += 1;
            }
            if (rolledBack > 0) await this.saveManifest();
          }
          await this.clearStaging();
          this.selfHealRolledBack = rolledBack;
          return rolledBack;
        }
        /**
         * 体检扫描（用户拍板：右上角「体检」按钮替换原「清理」，先报告后勾选清理）。
         * 扫描分两段：
         * 1. 对账段（不依赖解锁，锁定态也可体检）：
         *    - dead-entry：正文镜像（contentRef）缺失的条目 = 失效条目（正文不可解、还原无意义）；
         *    - orphan-file：顶层未被任何清单条目 contentRef/blobRef/previewRef 引用的
         *      点前缀 `.随机.enc` 形态密文（`.safe.enc` 与目录结构一律不碰）。
         *    仅附件镜像缺失但正文可读的条目保留（预览不受影响）。
         * 2. 完整性段（需解锁，解锁后自动执行）：
         *    - corrupted-body：正文镜像解密失败（文件在但内容损坏/被替换）；
         *    - corrupted-attachment：附件原始层解密失败或指纹与加密时不符（被篡改）；
         *    - missing-attachment：附件原始层镜像缺失（正文可读，还原时该附件不可用）。
         *    预览层不校验——还原不依赖预览层，缺失不致命。
         *    损坏/缺失类只报告、不清理（删了就是真丢数据，由用户决定从备份恢复），
         *    只有 dead-entry 与 orphan-file 可勾选清理。
         * @param onProgress 进度回调（逐项检查时调用：done/total/当前对象/本次新增发现，UI 动态显示）
         * @returns { items: 问题清单, integrityChecked: 是否执行了解密完整性检测（未解锁为 false） }
         */
        async scanHealth(onProgress) {
          const items = [];
          if (!this.unlocked || !this.password) return { items, integrityChecked: false };
          let total = 1;
          for (const n of this.manifest.notes) total += 2 + n.attachments.length;
          let done = 0;
          const emit = (current, fresh) => {
            done += 1;
            if (fresh.length) items.push(...fresh);
            onProgress == null ? void 0 : onProgress({ done, total, current, found: fresh });
          };
          for (const n of this.manifest.notes) {
            let bodyExists = false;
            if (n.contentRef) {
              try {
                bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
              } catch (e) {
                bodyExists = false;
              }
            }
            const fresh = [];
            if (!bodyExists) {
              fresh.push({ cat: "dead-entry", key: "entry:" + n.id, label: n.title, noteId: n.id });
            }
            emit(n.title, fresh);
          }
          const referenced = /* @__PURE__ */ new Set();
          for (const n of this.manifest.notes) {
            if (n.contentRef) referenced.add(n.contentRef);
            for (const a of n.attachments) {
              if (a.blobRef) referenced.add(a.blobRef);
              if (a.hasPreview && a.previewRef) referenced.add(a.previewRef);
            }
          }
          {
            const fresh = [];
            try {
              if (await this.adapter.exists(this.root)) {
                const listing = await this.adapter.list(this.root);
                for (const f of listing.files) {
                  const name = f.slice(f.lastIndexOf("/") + 1);
                  if (!isOrphanEncName(name)) continue;
                  if (referenced.has(name)) continue;
                  fresh.push({ cat: "orphan-file", key: "file:" + name, label: name, ref: name });
                }
              }
            } catch (e) {
            }
            emit("孤儿密文文件", fresh);
          }
          const integrityChecked = !!(this.unlocked && this.password);
          if (integrityChecked) {
            for (const n of this.manifest.notes) {
              if (items.some((i) => i.cat === "dead-entry" && i.noteId === n.id)) {
                emit(n.title + "（失效，跳过校验）", []);
                continue;
              }
              if (!n.contentRef) {
                emit(n.title, []);
                continue;
              }
              const fresh = [];
              try {
                const cipher = await this.readMirror(n.contentRef);
                if (cipher !== null) await CryptoService.decrypt(cipher, await this.blobKey(n.contentRef));
              } catch (e) {
                fresh.push({ cat: "corrupted-body", key: "body:" + n.id, label: n.title, noteId: n.id, ref: n.contentRef });
              }
              emit(n.title, fresh);
            }
            for (const n of this.manifest.notes) {
              for (const a of n.attachments) {
                if (!a.blobRef) {
                  emit(a.path, []);
                  continue;
                }
                const key = "att:" + n.id + ":" + a.path;
                const fresh = [];
                try {
                  const cipher = await this.readMirror(a.blobRef);
                  if (cipher === null) {
                    fresh.push({ cat: "missing-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                  } else {
                    const plain = await CryptoService.decrypt(cipher, await this.blobKey(a.blobRef));
                    const fp = await fingerprintOf(plain);
                    if (fp !== a.fingerprint) {
                      fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                    }
                  }
                } catch (e) {
                  fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                }
                emit(a.path, fresh);
              }
            }
          }
          return { items, integrityChecked };
        }
        /**
         * 按勾选 key 清理（体检页「清理勾选项」执行；只处理可清理类，损坏/缺失类防御性忽略）：
         * 1. dead-entry（key `entry:<id>`）：正文镜像当前仍缺失 → 整条清除（残留附件镜像一并删除）——
         *    判定以当前磁盘为准（幂等：重复执行无副作用）；
         * 2. orphan-file（key `file:<name>`）：删除该顶层密文文件（形态校验同扫描，绝不越界）。
         * 有清单变更时持久化（落盘失败向上抛，下次重试判定幂等）；并清空暂存区。
         * @returns { files: 删除的孤儿密文文件数, notes: 清除的失效条目数 }
         */
        async resolveHealth(keys) {
          return this.enqueueOp(async () => {
            var _a;
            if (!this.unlocked) throw new Error("未解锁，无法清理");
            const want = new Set(keys);
            let notes = 0;
            let files = 0;
            const kept = [];
            for (const n of this.manifest.notes) {
              let bodyExists = false;
              if (n.contentRef) {
                try {
                  bodyExists = await this.adapter.exists(this.resolveRef(n.contentRef));
                } catch (e) {
                  bodyExists = false;
                }
              }
              if (want.has("entry:" + n.id) && !bodyExists) {
                await this.deleteNoteMirrors(n);
                this.forgetNoteKeys(n);
                notes += 1;
              } else {
                kept.push(n);
              }
            }
            if (notes > 0) this.manifest.notes = kept;
            const referencedNow = /* @__PURE__ */ new Set();
            for (const n of this.manifest.notes) {
              if (n.contentRef) referencedNow.add(n.contentRef);
              for (const a of n.attachments) {
                if (a.blobRef) referencedNow.add(a.blobRef);
                if (a.hasPreview && a.previewRef) referencedNow.add(a.previewRef);
              }
            }
            let keysTouched = false;
            for (const key of keys) {
              if (!key.startsWith("file:")) continue;
              const name = key.slice("file:".length);
              if (!isOrphanEncName(name)) continue;
              if (referencedNow.has(name)) continue;
              try {
                if (await this.adapter.exists(this.resolveRef(name))) {
                  await this.adapter.remove(this.resolveRef(name));
                  files += 1;
                  if ((_a = this.manifest.keys) == null ? void 0 : _a[name]) {
                    this.forgetKeys([name]);
                    keysTouched = true;
                  }
                }
              } catch (e) {
              }
            }
            if (notes > 0 || keysTouched) await this.saveManifest();
            await this.clearStaging();
            return { files, notes };
          });
        }
        enqueueOp(op) {
          const run = this.opQueue.then(op, op);
          this.opQueue = run.catch(() => void 0);
          return run;
        }
        /**
         * 加锁一篇笔记（操作级互斥入口，P1-6）：实例级 promise 链串行——
         * 并发 lockNote/restoreNote 按发起顺序排队执行，杜绝挂起标记/清单/暂存区的并发互吞。
         * @param onSkippedStale E14：加密期间原文件被编辑过（删前重读与加密正文不一致）而
         *   保留未删的路径列表——密文为加密时的旧内容，调用方应提示用户可重做。
         */
        lockNote(input, onProgress, onDeleteFailed, onSkippedStale) {
          return this.enqueueOp(() => this.lockNoteSerial(input, onProgress, onDeleteFailed, onSkippedStale));
        }
        /**
         * 加锁一篇笔记：把当前笔记正文 + 双链附件移入保险库（ADR-0018 提交式加密）。
         * 加密阶段密文流式写入暂存区 `.staging/`（不占内存、不进入数据文件夹正式布局）；
         * 全部加密成功后才进入提交序列：
         *   S1 写挂起标记 → S2 清单先行（saveManifest，提交点）→ S3 暂存镜像搬入顶层
         *   → S4 清除挂起标记 → S5 尽力删原文件（失败仅提示，onDeleteFailed 收集，不回滚；
         *   共享附件 keptShared 跳过删除——issue 338 他引保护，原件保留他篇嵌入不断链）。
         * 关键不变量：挂起标记存在 ⇒ 原文件未删 ⇒ 解锁自愈回滚永远安全；标记于删原文件前清除，
         * 标记清除后的意外一律视为已提交、绝不回滚（Q4-A）。
         * 任一失败（附件/正文加密、写暂存、清单写入、搬入、清标记）→ 整笔放弃：清理本次暂存、
         * 原文件不动；清单先行已残留的挂起态由解锁自愈兜底。
         * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
         */
        async lockNoteSerial(input, onProgress, onDeleteFailed, onSkippedStale) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法加密笔记");
          await this.ensureSafeRootDir();
          await this.ensureStagingDir();
          const total = input.attachments.length + 1;
          let done = 0;
          const attachments = [];
          const finalRefs = [];
          const stagedRefs = [];
          const keyedRefs = [];
          let note = null;
          let manifestSaved = false;
          const skippedStale = [];
          try {
            const results = await mapLimit(input.attachments, BLOB_CONCURRENCY, async (a) => {
              const fp = await fingerprintOf(a.data);
              const blobRef = flatName();
              keyedRefs.push(blobRef);
              const enc = await this.encryptForRef(blobRef, a.data);
              await this.writeStaged(blobRef, enc);
              stagedRefs.push(blobRef);
              finalRefs.push(blobRef);
              let hasPreview = false;
              let previewRef = "";
              if (a.previewData) {
                previewRef = flatName();
                keyedRefs.push(previewRef);
                const encP = await this.encryptForRef(previewRef, a.previewData);
                await this.writeStaged(previewRef, encP);
                stagedRefs.push(previewRef);
                finalRefs.push(previewRef);
                hasPreview = true;
              }
              done += 1;
              onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
              return {
                path: a.path,
                kind: a.kind || "image",
                blobRef,
                blobSize: enc.length,
                fingerprint: fp,
                hasPreview,
                previewRef,
                // 共享附件标记随清单记账（issue 338）：仅 true 落账，老清单/非共享不受影响
                keptShared: a.keptShared || void 0
              };
            });
            for (const r of results) attachments.push(r);
            done += 1;
            onProgress == null ? void 0 : onProgress({ done, total, current: input.path });
            const bodyRef = flatName();
            keyedRefs.push(bodyRef);
            const bodyCipher = await this.encryptForRef(bodyRef, input.content);
            await this.writeStaged(bodyRef, bodyCipher);
            stagedRefs.push(bodyRef);
            finalRefs.push(bodyRef);
            note = {
              id: genNoteId(),
              kind: input.kind || void 0,
              path: input.path,
              title: input.title,
              createdAt: (/* @__PURE__ */ new Date()).toISOString(),
              contentRef: bodyRef,
              attachments
            };
            await this.addPending(note.id);
            this.manifest.notes.push(note);
            await this.saveManifest();
            manifestSaved = true;
            for (const ref of finalRefs) await this.promoteStaged(ref);
            try {
              await this.removePending(note.id);
            } catch (e) {
              throw new Error("清除挂起标记失败：" + e.message);
            }
            const deleteFailed = [];
            for (const a of input.attachments) {
              if (a.keptShared) continue;
              try {
                await this.deleteVaultFile(a.path);
              } catch (e) {
                deleteFailed.push(a.path);
              }
            }
            if (input.kind !== "diary-entry" && input.kind !== "password-vault" && input.kind !== "people") {
              let stale = false;
              try {
                const f = getApp().vault.getAbstractFileByPath(input.path);
                if (f && f.isFolder !== true) {
                  const current = await getApp().vault.read(f);
                  stale = current.replace(/\r\n/g, "\n") !== input.content.replace(/\r\n/g, "\n");
                }
              } catch (e) {
              }
              if (stale) {
                skippedStale.push(input.path);
              } else {
                try {
                  await this.deleteVaultFile(input.path);
                } catch (e) {
                  deleteFailed.push(input.path);
                }
              }
            }
            onDeleteFailed == null ? void 0 : onDeleteFailed(deleteFailed);
            onSkippedStale == null ? void 0 : onSkippedStale(skippedStale);
            return note;
          } catch (e) {
            for (const ref of stagedRefs) {
              try {
                await this.adapter.remove(this.stagingPath + "/" + ref);
              } catch (err) {
              }
            }
            this.forgetKeys(keyedRefs);
            if (!manifestSaved && note) {
              const ghostId = note.id;
              const idx = this.manifest.notes.findIndex((n) => n.id === ghostId);
              if (idx !== -1) this.manifest.notes.splice(idx, 1);
            }
            throw e;
          }
        }
        /**
         * 还原（取出即删）一篇笔记（操作级互斥入口，P1-6）：与 lockNote 共享同一串行链。
         *
         * 解原文 + 原质量附件写回原路径。
         * 共享附件（keptShared，issue 338）跳过写回：原件加密时已保留在原路径，还原时不再
         * 解密/校验/落盘该附件（密文镜像照常随条目删除），防覆盖保留的原件。
         * 原子语义（用户决策修订）：阶段一并行解密全部附件 + 正文并完成全部校验
         * （指纹冲突/目标被占/镜像缺失/解密失败），**任一失败 → 整体放弃，零落盘**；
         * 阶段二才批量写回明文（写回中途失败尽力回滚本次创建的文件）。
         * 全部成功（无冲突）后：删除本文全部加密镜像（正文+附件原始层/预览层）、从清单移除，彻底取出。
         * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
         */
        restoreNote(noteId, onProgress) {
          return this.enqueueOp(() => this.restoreNoteSerial(noteId, onProgress));
        }
        async restoreNoteSerial(noteId, onProgress) {
          var _a, _b;
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法还原笔记");
          const app = getApp();
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note) throw new Error("未找到该笔记");
          const conflicts = [];
          const total = note.attachments.length + 1;
          let done = 0;
          const plainAttachments = await mapLimit(note.attachments, BLOB_CONCURRENCY, async (a) => {
            if (a.keptShared) {
              done += 1;
              onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
              return null;
            }
            const plainB64 = await this.prepareRestoreAttachment(a);
            done += 1;
            onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
            return plainB64;
          });
          note.attachments.forEach((a, i) => {
            if (!a.keptShared && plainAttachments[i] === null) conflicts.push(a.path);
          });
          done += 1;
          onProgress == null ? void 0 : onProgress({ done, total, current: note.path });
          const plain = await this.decryptNoteBody(note);
          if (plain === null || plain === void 0) {
            conflicts.push(note.path);
          } else if (note.kind === "diary-entry") {
          } else if (this.fileExists(note.path)) {
            const sameContent = await this.isSameTextFile(note.path, plain);
            if (!sameContent) conflicts.push(note.path);
          }
          if (conflicts.length > 0) return { note, conflicts, removed: false };
          const created = [];
          try {
            for (let i = 0; i < note.attachments.length; i++) {
              const a = note.attachments[i];
              if (a.keptShared) continue;
              const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]);
              if (wasCreated) created.push(a.path);
            }
            if (note.kind === "diary-entry") {
              const mergeOk = await this.mergeDiaryBlock(note.path, plain);
              if (!mergeOk) throw new Error("日记块 merge 失败");
            } else {
              await this.ensureVaultParentFolder(note.path);
              const file = await app.vault.create(note.path, plain);
              created.push(note.path);
              (_b = (_a = app.metadataCache) == null ? void 0 : _a.trigger) == null ? void 0 : _b.call(_a, "changed", file);
            }
          } catch (e) {
            for (const p of created) {
              try {
                await this.deleteVaultFile(p);
              } catch (err) {
              }
            }
            return { note, conflicts: [...conflicts, note.path], removed: false };
          }
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          this.forgetNoteKeys(note);
          try {
            await this.saveManifest();
          } catch (e) {
            return { note, conflicts, removed: false, manifestSaveFailed: true };
          }
          await this.deleteNoteMirrors(note);
          return { note, conflicts, removed: true };
        }
        /** 目标文件内容与待还原明文是否一致（归一化行尾；占用幂等放行判断用） */
        async isSameTextFile(path, plain) {
          try {
            const app = getApp();
            const f = app.vault.getAbstractFileByPath(path);
            if (!f) return false;
            const existing = await app.vault.read(f);
            return existing.replace(/\r\n/g, "\n") === plain.replace(/\r\n/g, "\n");
          } catch (e) {
            return false;
          }
        }
        /** 解笔记正文明文（contentRef 镜像；无镜像返回 null） */
        async decryptNoteBody(note) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          if (!note.contentRef) return null;
          const cipher = await this.readMirror(note.contentRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, await this.blobKey(note.contentRef));
        }
        /**
         * 读条目标题镜像的原始密文字符串（不解密，零 PBKDF2 开销）。
         * 供密码本等高频读侧做「内容未变」判等（密文字节相同 ⇒ 载荷未变，可复用上次解密结果）。
         * 无镜像返回 null。
         */
        async readNotePayloadRaw(note) {
          if (!note.contentRef) return null;
          return this.readMirror(note.contentRef);
        }
        /**
         * 加密日记条目还原（操作级互斥入口）：与 lockNote/restoreNote/removeNote 共享同一串行链
         * （E13 收编补漏——阶段一逐附件解密窗口为 PBKDF2 秒级，此前游离在队列外可与并发
         * removeNote/lockNote 互踩清单）。
         * 还原附件 → 把 finalBlock（由调用方准备，可为原文或改分类降级后重建）merge 回原日期 md → 取出即删。
         * 原子语义同 restoreNote：全部附件解密/校验成功且块就绪才写回；任一失败零落盘。
         * `diaryDir`：当前日记目录（D9 同源真值=diary 域 applyDirectories 维护的 DIARY_DIRECTORY 快照，
         * 由调用方注入——diary 侧直传、encrypt 面板侧动态 import；未注入时回落 settings 读取兜底）。
         */
        restoreDiaryEntry(noteId, finalBlock, diaryDir) {
          return this.enqueueOp(() => this.restoreDiaryEntrySerial(noteId, finalBlock, diaryDir));
        }
        async restoreDiaryEntrySerial(noteId, finalBlock, diaryDir) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法还原加密日记");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note || note.kind !== "diary-entry") throw new Error("未找到该加密日记条目");
          const base = note.path.split("/").pop() || "";
          if (diaryMetaFromEntryPath(base)) {
            const target = (diaryDir || currentDiaryDirectory()) + "/" + base;
            if (target !== note.path) note.path = target;
          }
          const conflicts = [];
          const plainAttachments = await mapLimit(
            note.attachments,
            BLOB_CONCURRENCY,
            async (a) => a.keptShared ? null : this.prepareRestoreAttachment(a)
          );
          note.attachments.forEach((a, i) => {
            if (!a.keptShared && plainAttachments[i] === null) conflicts.push(a.path);
          });
          if (!finalBlock) conflicts.push(note.path);
          if (conflicts.length > 0) return false;
          const created = [];
          try {
            for (let i = 0; i < note.attachments.length; i++) {
              const a = note.attachments[i];
              if (a.keptShared) continue;
              const wasCreated = await this.commitRestoreAttachment(a, plainAttachments[i]);
              if (wasCreated) created.push(a.path);
            }
            const ok = await this.mergeDiaryBlock(note.path, finalBlock);
            if (!ok) throw new Error("日记块 merge 失败");
          } catch (e) {
            for (const p of created) {
              try {
                await this.deleteVaultFile(p);
              } catch (err) {
              }
            }
            return false;
          }
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          this.forgetNoteKeys(note);
          try {
            await this.saveManifest();
          } catch (e) {
            return false;
          }
          await this.deleteNoteMirrors(note);
          return true;
        }
        /** 解加密日记正文明文（供日记域准备还原块；退回 null 表示解密失败） */
        async getDiaryEntryPlain(noteId) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note || note.kind !== "diary-entry") return null;
          return this.decryptNoteBody(note);
        }
        /**
         * 还原日记块 → 条目文件（ADR-0130 v2）：块头 `# 标签名/标签名 HH:mm` + 正文，
         * 序列化为 frontmatter 条目文件写入 note.path（一目一文件，无「按时间序插块」概念）。
         * - 同内容幂等跳过（「块已 merge 但清单没保存」的中断残留/重试）；
         * - 目标被占且内容不同（外来内容）绝不覆盖——后缀让位 `-2/-3…` 新建；
         * - note.path 为旧格式日期文件路径时兜底换算为条目文件路径（历史清单兼容）。
         * @returns 成功写入（或幂等跳过）返回 true；路径无法换算日期返回 false。
         */
        async mergeDiaryBlock(datePath, block) {
          var _a;
          const app = getApp();
          if (!datePath || !block) return false;
          const md = block.replace(/\r\n/g, "\n");
          const lines = md.split("\n");
          const head = parseDiaryBlockHeader((_a = lines[0]) != null ? _a : "");
          if (!head) return false;
          const time = head.time;
          const tags = head.tags.length ? [...head.tags] : ["日记"];
          const bodyLines = [];
          for (let i = 1; i < lines.length; i++) bodyLines.push(lines[i]);
          while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === "") bodyLines.pop();
          while (bodyLines.length && bodyLines[0].trim() === "") bodyLines.shift();
          const body = bodyLines.join("\n");
          const dir = datePath.split("/").slice(0, -1).join("/");
          const meta = diaryMetaFromEntryPath(datePath);
          let date = null;
          let targetPath = datePath;
          if (meta) {
            date = meta.date;
          } else {
            const legacyDate = diaryDateFromLegacyPath(datePath);
            if (legacyDate) {
              date = legacyDate;
              targetPath = diaryEntryPath(dir, date, time);
            } else {
              return false;
            }
          }
          if (!date) return false;
          await this.ensureVaultParentFolder(targetPath);
          await enqueueFileTask(targetPath, async () => {
            var _a2, _b, _c, _d;
            const serialized = serializeDiaryEntryFile({ date, time }, tags, body);
            const existing = app.vault.getAbstractFileByPath(targetPath);
            if (existing && existing.isFolder !== true) {
              const text = await app.vault.read(existing);
              if (text.replace(/\n$/, "") === serialized.replace(/\n$/, "")) return;
              let seq = 2;
              let alt = diaryEntryPath(dir, date, time, seq);
              while (app.vault.getAbstractFileByPath(alt)) {
                seq += 1;
                alt = diaryEntryPath(dir, date, time, seq);
              }
              const shifted = await app.vault.create(alt, serialized);
              (_b = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b.call(_a2, "changed", shifted);
              return;
            }
            const file = await app.vault.create(targetPath, serialized);
            (_d = (_c = app.metadataCache) == null ? void 0 : _c.trigger) == null ? void 0 : _d.call(_c, "changed", file);
          });
          return true;
        }
        /**
         * 还原准备（原子语义）：解镜像 → 完整性指纹校验 → 目标占用检查。
         * 完整性：镜像解密内容指纹必须与加密时记录一致（防镜像被篡改/替换），与目标是否被占无关；
         * 占用：目标已有文件时读其内容比对指纹——相同 = 本系统还原残留（幂等覆盖），不同 = 用户文件（冲突）。
         * @returns 明文 base64；null = 镜像缺失 / 解密失败 / 完整性不符 / 目标被用户占用（整体不落盘）
         */
        async prepareRestoreAttachment(a) {
          if (!this.unlocked || !this.password) return null;
          const cipher = await this.readMirror(a.blobRef);
          if (cipher === null) return null;
          let plainB64;
          try {
            plainB64 = await CryptoService.decrypt(cipher, await this.blobKey(a.blobRef));
          } catch (e) {
            return null;
          }
          const currentFp = await fingerprintOf(plainB64);
          if (currentFp !== a.fingerprint) return null;
          if (this.fileExists(a.path)) {
            try {
              const app = getApp();
              const existing = app.vault.getAbstractFileByPath(a.path);
              const buf = await app.vault.readBinary(existing);
              const existingFp = await fingerprintOf(bytesToBase64(new Uint8Array(buf)));
              if (existingFp !== a.fingerprint) return null;
            } catch (e) {
              return null;
            }
          }
          return plainB64;
        }
        /**
         * 还原提交（仅在全部分解/校验成功后调用）：把准备阶段解出的明文写回原路径（二进制）。
         * @returns 是否本次新建（true 时失败回滚可安全删除；false = 覆盖既有同指纹文件，不删）
         */
        async commitRestoreAttachment(a, plainB64) {
          var _a, _b;
          const app = getApp();
          const data = base64ToBytes(plainB64);
          const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
          const existing = app.vault.getAbstractFileByPath(a.path);
          if (existing) {
            await app.vault.writeBinary(existing, buf);
            return false;
          }
          await this.ensureVaultParentFolder(a.path);
          const file = await app.vault.createBinary(a.path, buf);
          (_b = (_a = app.metadataCache) == null ? void 0 : _a.trigger) == null ? void 0 : _b.call(_a, "changed", file);
          return true;
        }
        /**
         * 删除一条加密笔记（连同镜像文件、清单记录）。谨慎：真删除不可恢复。
         * E13：整体入 opQueue——与 lockNote/restoreNote 同链串行，防内存清单快照互踩
         * （此前可与其并发，后落盘的旧清单快照会抹掉并发 lockNote 新增的条目）。
         */
        removeNote(noteId) {
          return this.enqueueOp(async () => {
            if (!this.unlocked) throw new Error("未解锁");
            const idx = this.manifest.notes.findIndex((n) => n.id === noteId);
            if (idx === -1) return;
            const note = this.manifest.notes[idx];
            await this.deleteNoteMirrors(note);
            this.manifest.notes.splice(idx, 1);
            this.forgetNoteKeys(note);
            await this.saveManifest();
          });
        }
        /**
         * 更新条目正文镜像（覆盖同一 contentRef，不产生孤儿镜像）。
         * 供密码本整表（password-vault）等高频改写载荷用：重用既有镜像名，避免每次新镜像堆积。
         * 覆盖走 replaceMirrorAtomic（P0-1）：暂存+rename 原子换入，任何写失败正式位保持旧完整密文。
         * E13：整体入 opQueue（理由同 removeNote——清单读改写与 lockNote/restoreNote 串行互斥）。
         * 深审新-6：contentRef 已存在时清单零变化——跳过整库重加密落盘（此前密码本每存一条
         * 全量重写 .safe.enc 一次），改为显式广播 encrypt:changed（同频道同事件，noteId 语义补真，
         * 缓解订阅方按 null 盲比对）；仅新分配 contentRef（清单结构变化）才落盘（尾部自带广播）。
         */
        updateNotePayload(noteId, plainContent) {
          return this.enqueueOp(async () => {
            var _a;
            if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存");
            const note = this.manifest.notes.find((n) => n.id === noteId);
            if (!note) throw new Error("未找到清单条目");
            if (note.contentRef && ((_a = this.manifest.keys) == null ? void 0 : _a[note.contentRef])) {
              const encrypted2 = await this.encryptForRef(note.contentRef, plainContent);
              await this.replaceMirrorAtomic(note.contentRef, encrypted2);
              emitDomainEvent(ENCRYPT_CHANGED_CHANNEL, { noteId });
              return;
            }
            const oldRef = note.contentRef;
            const newRef = flatName();
            const encrypted = await this.encryptForRef(newRef, plainContent);
            try {
              await this.writeStaged(newRef, encrypted);
              await this.promoteStaged(newRef);
              note.contentRef = newRef;
              await this.saveManifest();
            } catch (e) {
              note.contentRef = oldRef;
              this.forgetKeys([newRef]);
              await this.deleteSafeFile(newRef);
              throw e;
            }
            if (oldRef) await this.deleteSafeFile(oldRef);
          });
        }
        // ---------- 修改主密码 / 信封迁移（ADR-0211，issue 508） ----------
        /**
         * 修改主密码（信封结构下亚秒级）：只重包 masterWrap + 重加密清单，镜像文件零接触。
         * 整体入 opQueue 与迁移/写操作硬串行（migrating 旗标只作出队后快路径提示）；
         * verifyPassword 二次校验（高危操作口径，同销毁确认；false = 当前密码错，清单未动）→
         * 重包 → saveManifest → 清派生密钥缓存（旧主密码派生不残留；fileKey 派生随用随建）。
         * 迁移未完成时抛错（UI 提示稍后）——迁移是密钥模型切换点，两者串行才可推理。
         */
        changePassword(oldPassword, newPassword) {
          return this.enqueueOp(async () => {
            if (!this.unlocked || !this.password) throw new Error("未解锁，无法修改密码");
            if (this.migrating) throw new Error("加密结构升级进行中，请稍后再试");
            if (!this.envelopeReady) throw new Error("加密结构升级尚未完成，请稍候片刻（或重新解锁）再试");
            if (!await this.verifyPassword(oldPassword)) return false;
            if (!this.unlocked || !this.password) throw new Error("保险库已上锁，修改中止");
            const prevWrap = this.manifest.masterWrap;
            const prevPassword = this.password;
            try {
              this.manifest.masterWrap = await CryptoService.encrypt(this.masterKey, newPassword);
              this.password = newPassword;
              await this.saveManifest();
            } catch (e) {
              if (this.unlocked) {
                this.manifest.masterWrap = prevWrap;
                this.password = prevPassword;
              }
              throw e;
            }
            clearCryptoKeyCache();
            return true;
          });
        }
        /**
         * v1 → v2 信封迁移（解锁后自动触发，opQueue 串行；中断安全）：
         * 逐镜像「主密码解 → 独立 fileKey 加密 → 写暂存区（新 ref；暂存区不在顶层，
         * 体检孤儿扫描不可见，绝不误删）」，全部成功后提交——
         *   P1 promote 全部新镜像到顶层（此刻清单仍 v1：旧镜像俱在，数据完整，新镜像暂成孤儿形态）
         *   P2 清单切 v2（notes 改指新 ref + keys + masterWrap）落盘（提交点，失败则内存回滚保持 v1）
         *   P3 删旧镜像 → 清暂存（失败只留孤儿，体检可清）
         * 任意中断由清单版本裁决：v1 期 = 旧镜像有效（promote 残留孤儿可清）；v2 后 = 新镜像有效
         * （旧镜像成孤儿可清）。下次解锁按版本重试或跳过，最终收敛。
         * 任一镜像解密/缺失失败 → 中止保持 v1（完整性优先，绝不跳过——跳过即静默丢数据）。
         */
        async migrateToEnvelope() {
          var _a, _b, _c, _d;
          if (!this.unlocked || !this.password) return;
          if (this.manifest.version >= 2 && this.manifest.masterWrap && this.manifest.keys) return;
          this.migrating = true;
          try {
            const masterKey = genFileKey();
            const keys = {};
            const notes = this.manifest.notes;
            const jobs = [];
            for (const n of notes) {
              if (n.contentRef) jobs.push({ oldRef: n.contentRef, part: "contentRef" });
              for (const a of n.attachments) {
                if (a.blobRef) jobs.push({ oldRef: a.blobRef, att: a, part: "blobRef" });
                if (a.hasPreview && a.previewRef) jobs.push({ oldRef: a.previewRef, att: a, part: "previewRef" });
              }
            }
            if (jobs.length === 0) {
              this.masterKey = masterKey;
              this.manifest.version = 2;
              this.manifest.keys = keys;
              this.manifest.masterWrap = await CryptoService.encrypt(masterKey, this.password);
              await this.saveManifest();
              return;
            }
            const total = jobs.length;
            let done = 0;
            const staged = [];
            for (const job of jobs) {
              if (!this.unlocked || !this.password) {
                (_a = this.onMigrationEnd) == null ? void 0 : _a.call(this, false, "locked");
                return;
              }
              const cipher = await this.readMirror(job.oldRef);
              if (cipher === null) throw new Error("迁移中止：镜像缺失 " + job.oldRef);
              const plain = await CryptoService.decrypt(cipher, this.password);
              const fileKey = genFileKey();
              const newRef = flatName();
              keys[newRef] = await CryptoService.encrypt(fileKey, masterKey);
              await this.writeStaged(newRef, await CryptoService.encrypt(plain, fileKey));
              staged.push({ oldRef: job.oldRef, newRef });
              done += 1;
              (_b = this.onMigrationProgress) == null ? void 0 : _b.call(this, done, total);
            }
            for (const s of staged) await this.promoteStaged(s.newRef);
            try {
              const refMap = new Map(staged.map((s) => [s.oldRef, s.newRef]));
              for (const n of notes) {
                if (n.contentRef) n.contentRef = refMap.get(n.contentRef) || n.contentRef;
                for (const a of n.attachments) {
                  if (a.blobRef) a.blobRef = refMap.get(a.blobRef) || a.blobRef;
                  if (a.hasPreview && a.previewRef) a.previewRef = refMap.get(a.previewRef) || a.previewRef;
                }
              }
              this.masterKey = masterKey;
              this.manifest.version = 2;
              this.manifest.keys = keys;
              this.manifest.masterWrap = await CryptoService.encrypt(masterKey, this.password);
              await this.saveManifest();
            } catch (e) {
              const backMap = new Map(staged.map((s) => [s.newRef, s.oldRef]));
              for (const n of notes) {
                if (n.contentRef) n.contentRef = backMap.get(n.contentRef) || n.contentRef;
                for (const a of n.attachments) {
                  if (a.blobRef) a.blobRef = backMap.get(a.blobRef) || a.blobRef;
                  if (a.hasPreview && a.previewRef) a.previewRef = backMap.get(a.previewRef) || a.previewRef;
                }
              }
              this.masterKey = null;
              this.manifest.version = 1;
              this.manifest.keys = void 0;
              this.manifest.masterWrap = void 0;
              await this.clearStaging();
              throw e;
            }
            for (const s of staged) await this.deleteSafeFile(s.oldRef);
            await this.clearStaging();
            (_c = this.onMigrationEnd) == null ? void 0 : _c.call(this, true);
          } catch (e) {
            (_d = this.onMigrationEnd) == null ? void 0 : _d.call(this, false, this.unlocked ? "error" : "locked");
            throw e;
          } finally {
            this.migrating = false;
          }
        }
        /** 解附件预览层 → dataUrl 明文（预览窗用；无预览层返回 null） */
        async decryptPreview(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          if (!a.hasPreview) return null;
          const cipher = await this.readMirror(a.previewRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, await this.blobKey(a.previewRef));
        }
        /**
         * 解附件原始层 → 原始 base64（预览窗缩略图点击按需加载原图/视频用）。
         * 与预览层不同：走 blobRef 解原质量密文；无密文返回 null，解密失败向上抛（调用方兜底）。
         */
        async decryptAttachmentOriginal(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          const cipher = await this.readMirror(a.blobRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, await this.blobKey(a.blobRef));
        }
      };
    }
  });

  // src/encrypt/preview.ts
  function canvasAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!c.getContext && !!c.getContext("2d");
    } catch (e) {
      return false;
    }
  }
  function isEmptySrc(src) {
    return !src || !src.trim();
  }
  async function compressImage(src, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY) {
    if (!canvasAvailable() || isEmptySrc(src)) return null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = src;
    });
    try {
      await withTimeout(loaded, PREVIEW_TIMEOUT_MS, "图片加载");
    } catch (e) {
      return null;
    }
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, width: w, height: h };
  }
  async function videoFrame(src, maxSize = PREVIEW_OMIT_SIZE, quality = PREVIEW_OMIT_QUALITY) {
    if (!canvasAvailable() || !document.createElement("video") || isEmptySrc(src)) return null;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    const meta = new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("视频加载失败"));
      video.src = src;
    });
    try {
      await withTimeout(meta, PREVIEW_TIMEOUT_MS, "视频元数据加载");
    } catch (e) {
      return null;
    }
    const seek = new Promise((resolve, reject) => {
      const t = video.duration ? Math.min(0.1, video.duration / 2) : 0.1;
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("视频抽帧失败"));
      try {
        video.currentTime = t;
      } catch (e) {
        resolve();
      }
    });
    try {
      await withTimeout(seek, PREVIEW_TIMEOUT_MS, "视频抽帧");
    } catch (e) {
      return null;
    }
    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (!vw || !vh) return null;
    const scale = Math.min(1, maxSize / Math.max(vw, vh));
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, width: w, height: h };
  }
  var PREVIEW_TIMEOUT_MS, PREVIEW_OMIT_SIZE, PREVIEW_OMIT_QUALITY;
  var init_preview = __esm({
    "src/encrypt/preview.ts"() {
      init_http();
      PREVIEW_TIMEOUT_MS = 5e3;
      PREVIEW_OMIT_SIZE = 384;
      PREVIEW_OMIT_QUALITY = 0.5;
    }
  });

  // src/password-vault/data.ts
  var PASSWORD_VAULT_CHANNEL, VAULT_KIND, VAULT_PATH, VAULT_TITLE, PasswordVaultDataManager, PENDING_QUICK_TTL_MS;
  var init_data3 = __esm({
    "src/password-vault/data.ts"() {
      init_domain_bus();
      init_data2();
      PASSWORD_VAULT_CHANNEL = "password-vault:changed";
      VAULT_KIND = "password-vault";
      VAULT_PATH = "CONFIG/.ENCRYPT/passwords";
      VAULT_TITLE = "密码本";
      PasswordVaultDataManager = class {
        /** 显式注入 SafeManager（与保险库面板同一单例，共享解锁态/清单） */
        constructor(safe) {
          this.pwData = [];
          /** load 缓存（ticket 43 同款）：清单条目 + 原始密文字节；密文未变不重解密 */
          this.loadCache = null;
          /** 域事件退订 */
          this.offChanged = null;
          this.offEncryptChanged = null;
          this.offUnlockChanged = null;
          /** 自身写盘中标志：save() 期间跳过外部事件重载（自己写的 encrypt:changed 广播不触发自重载） */
          this.saving = false;
          /** 外部变更回调（UI 订阅；外部改动 → 重载后回调） */
          this.onExternalChange = null;
          this.safe = safe;
          this.offChanged = onDomainEvent(PASSWORD_VAULT_CHANNEL, (evt) => {
            if ((evt == null ? void 0 : evt.source) === "password-vault") return;
            void this.reloadFromExternal();
          });
          this.offEncryptChanged = onDomainEvent(ENCRYPT_CHANGED_CHANNEL, (evt) => {
            const note = this.vaultNote;
            if (!note || (evt == null ? void 0 : evt.noteId) && evt.noteId !== note.id) return;
            void this.reloadFromExternal();
          });
          this.offUnlockChanged = onDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
            if ((evt == null ? void 0 : evt.unlocked) !== false) return;
            this.clearPlainCaches();
          });
        }
        /** 解锁态 = 保险库解锁态（同一把主密码） */
        get unlocked() {
          return this.safe.unlocked;
        }
        /** 底层 SafeManager（锁屏/首设判定用；与数据层同一实例） */
        get safeManager() {
          return this.safe;
        }
        get vaultNote() {
          return this.safe.manifest.notes.find((n) => n.kind === VAULT_KIND) || null;
        }
        /** 外部变更处理：尝试重载（未解锁/失败静默，由 UI 自行决定展示） */
        async reloadFromExternal() {
          var _a;
          if (this.saving) return;
          if (!this.safe.unlocked) return;
          try {
            await this.load();
            (_a = this.onExternalChange) == null ? void 0 : _a.call(this);
          } catch (e) {
          }
        }
        async load() {
          if (!this.safe.unlocked) {
            throw new Error("未解锁，无法加载数据");
          }
          const note = this.vaultNote;
          if (!note) {
            this.pwData = [];
            this.loadCache = null;
            return;
          }
          const cipher = await this.safe.readNotePayloadRaw(note);
          if (this.loadCache && this.loadCache.noteId === note.id && this.loadCache.cipher === cipher) {
            return;
          }
          const plain = await this.safe.decryptNoteBody(note);
          if (plain === null) throw new Error("密码本数据解密失败");
          let parsed;
          try {
            parsed = JSON.parse(plain);
          } catch (e) {
            throw new Error("密码本数据损坏");
          }
          this.pwData = Array.isArray(parsed) ? parsed.filter((x) => !!x && typeof x === "object" && !Array.isArray(x)) : [];
          this.pwData = this.pwData.map((item) => {
            if (!item.id) item.id = `pw-${Date.now()}-${Math.random()}`;
            if (!item.platform) item.platform = "";
            if (!item.url) item.url = "";
            if (!item.account) item.account = "";
            if (!item.password) item.password = "";
            if (!item.note) item.note = "";
            if (!item.createdAt) item.createdAt = (/* @__PURE__ */ new Date()).toISOString();
            if (item.fav === void 0) item.fav = false;
            return item;
          });
          this.loadCache = { noteId: note.id, cipher };
        }
        async save() {
          if (!this.safe.unlocked) {
            throw new Error("未解锁，无法保存数据");
          }
          this.saving = true;
          try {
            const json = JSON.stringify(this.pwData, null, 2);
            const note = this.vaultNote;
            if (note) {
              await this.safe.updateNotePayload(note.id, json);
            } else {
              await this.safe.lockNote({
                path: VAULT_PATH,
                title: VAULT_TITLE,
                kind: VAULT_KIND,
                content: json,
                attachments: []
              });
            }
          } finally {
            this.saving = false;
          }
          emitDomainEvent(PASSWORD_VAULT_CHANNEL, { source: "password-vault" });
        }
        /** 清明文缓存（pwData 整表明文 + load 缓存）；lock() 与上锁事件订阅共用同一份收口 */
        clearPlainCaches() {
          this.pwData = [];
          this.loadCache = null;
        }
        lock() {
          this.safe.lock();
          this.clearPlainCaches();
        }
        // ---------- 平台聚合 ----------
        platforms() {
          const map = /* @__PURE__ */ new Map();
          for (const d of this.pwData) {
            const key = d.platform || "(无平台)";
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(d);
          }
          const list = [];
          for (const [platform, accounts] of map) {
            accounts.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            list.push({ platform, accounts });
          }
          list.sort((a, b) => {
            var _a, _b;
            return (((_a = a.accounts[0]) == null ? void 0 : _a.createdAt) || "").localeCompare(((_b = b.accounts[0]) == null ? void 0 : _b.createdAt) || "") * -1;
          });
          return list;
        }
        accountsOf(platform) {
          const key = platform || "(无平台)";
          return this.pwData.filter((d) => (d.platform || "(无平台)") === key).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
        }
        hasFav(platform) {
          return this.accountsOf(platform).some((d) => d.fav);
        }
        favCount(platform) {
          return this.accountsOf(platform).filter((d) => d.fav).length;
        }
        // ---------- 条目操作 ----------
        /** 内存快照（E1）：逐条浅拷贝——就地改对象的 mutator（toggleFav/updatePlatform）可回滚 */
        snapshot() {
          return this.pwData.map((d) => ({ ...d }));
        }
        /** 写事务（E1）：save 失败回滚内存到快照再 rethrow——磁盘/加密/清单写任一环节失败
         *  不残留幽灵条目/半改态（改盘前先恢复内存，交由 UI 层兜底提示 + 重渲染） */
        async saveWithRollback(snap) {
          try {
            await this.save();
          } catch (e) {
            this.pwData = snap;
            throw e;
          }
        }
        async addItem(item) {
          if (!this.unlocked) throw new Error("未解锁");
          const snap = this.snapshot();
          item.id = `pw-${Date.now()}-${Math.random()}`;
          item.createdAt = (/* @__PURE__ */ new Date()).toISOString();
          if (item.fav === void 0) item.fav = false;
          this.pwData.unshift(item);
          await this.saveWithRollback(snap);
        }
        async updateItem(id, newData) {
          if (!this.unlocked) throw new Error("未解锁");
          const index = this.pwData.findIndex((d) => d.id === id);
          if (index === -1) throw new Error("条目不存在");
          const snap = this.snapshot();
          this.pwData[index] = { ...this.pwData[index], ...newData };
          await this.saveWithRollback(snap);
        }
        async deleteItem(id) {
          if (!this.unlocked) throw new Error("未解锁");
          const index = this.pwData.findIndex((d) => d.id === id);
          if (index === -1) throw new Error("条目不存在");
          const snap = this.snapshot();
          this.pwData.splice(index, 1);
          await this.saveWithRollback(snap);
        }
        /** 删除整个平台（返回删除的账号数） */
        async removePlatform(platform) {
          if (!this.unlocked) throw new Error("未解锁");
          const key = platform || "(无平台)";
          const n = this.accountsOf(key).length;
          const snap = this.snapshot();
          this.pwData = this.pwData.filter((d) => (d.platform || "(无平台)") !== key);
          await this.saveWithRollback(snap);
          return n;
        }
        /** 编辑平台信息：改名/改链接应用到该平台全部账号 */
        async updatePlatform(platform, patch) {
          if (!this.unlocked) throw new Error("未解锁");
          const key = platform || "(无平台)";
          const target = (patch.platform || "").trim() || key;
          const snap = this.snapshot();
          for (const d of this.pwData) {
            if ((d.platform || "(无平台)") === key) {
              d.platform = target;
              if (patch.url !== void 0) d.url = patch.url.trim();
            }
          }
          await this.saveWithRollback(snap);
        }
        async toggleFav(id) {
          if (!this.unlocked) throw new Error("未解锁");
          const d = this.pwData.find((x) => x.id === id);
          if (!d) throw new Error("条目不存在");
          const snap = this.snapshot();
          d.fav = !d.fav;
          await this.saveWithRollback(snap);
        }
        async clearAll() {
          if (!this.unlocked) throw new Error("未解锁");
          const snap = this.snapshot();
          this.pwData = [];
          await this.saveWithRollback(snap);
        }
        /** 搜索：平台/账号/备注（与旧密码本同口径） */
        search(keyword) {
          if (!this.unlocked) throw new Error("未解锁");
          if (!keyword) return this.pwData.slice();
          const lower = keyword.toLowerCase();
          return this.pwData.filter(
            (item) => (item.platform || "").toLowerCase().includes(lower) || (item.account || "").toLowerCase().includes(lower) || (item.note || "").toLowerCase().includes(lower)
          );
        }
        /** 卸载清理：退订域事件 */
        destroy() {
          var _a, _b, _c;
          (_a = this.offChanged) == null ? void 0 : _a.call(this);
          this.offChanged = null;
          (_b = this.offEncryptChanged) == null ? void 0 : _b.call(this);
          this.offEncryptChanged = null;
          (_c = this.offUnlockChanged) == null ? void 0 : _c.call(this);
          this.offUnlockChanged = null;
        }
      };
      PENDING_QUICK_TTL_MS = 10 * 60 * 1e3;
    }
  });

  // src/encrypt/vault-assets-view.ts
  function vIc(name, size = 14) {
    const lucide = LUCIDE_ALIAS[name] || name;
    return `<i data-lucide="${lucide}" class="bz-vault-ic bz-vault-ic--${size}" aria-hidden="true"></i>`;
  }
  function statusbarHtml(unlocked) {
    return `${vIc(unlocked ? "lock-open" : "lock", 12)} 保险库`;
  }
  function overviewHTML(stats) {
    const { counts, attachments, attBytes, recent: recent2, health } = stats;
    const kb = attBytes > 0 ? (attBytes / 1024).toFixed(1) + " KB" : "—";
    const healthRows = health == null ? `<div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">待处理</span><span class="n">未体检</span></div>` : `<div class="bz-vault-hrow"><span class="dot" style="background:${health.issues ? "var(--bz-danger)" : "var(--bz-success)"}"></span><span class="lbl">待处理</span><span class="n">${health.issues}</span></div>`;
    const recentRows = recent2.length ? recent2.map((r) => {
      const color = r.kind === "note" ? ASSET_COLOR.note : ASSET_COLOR.diary;
      const iconName = r.kind === "note" ? "file-lock" : "book-lock";
      return `<div class="bz-vault-minirow" role="button" tabindex="0" data-recent="${r.kind}"${r.id ? ` data-recent-id="${escapeHtml2(r.id)}"` : ""}>
            <span class="av" style="background:${color}">${vIc(iconName, 14)}</span>
            <div class="mid"><div class="a">${escapeHtml2(r.title)}</div><div class="b">${escapeHtml2(r.sub)}</div></div>
            <span class="tm">${escapeHtml2(r.time)}</span></div>`;
    }).join("") : emptyHtmlStr("lock", "还没有动态", "笔记或日记入库后，最近动态在这里显示");
    return `
  <div class="bz-vault-hero">
    <div class="ht">${vIc("lock", 14)} 保险库已解锁 · 笔记集中管理</div>
    <div class="hn">${counts.note + counts.diary} 项资产${counts.note + counts.diary > 0 ? " · 尽在掌握" : ""}</div>
    <div class="hd">同一把主密码 · AES-256-GCM</div>
    <div class="hbtns">
      <button class="hbtn" data-hero="lock-note">${vIc("file-lock", 14)} 存入笔记</button>
      <button class="hbtn" data-hero="health">${vIc("stethoscope", 14)} 体检</button>
    </div>
  </div>
  <div class="bz-vault-cards">
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc("file-lock", 13)}</span>笔记条目</div>
      <div class="num">${counts.note}<small>篇</small></div>
      <div class="cd">${counts.note ? "正文与附件全量密文" : "还没有笔记"}</div>
    </div>
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc("image", 13)}</span>随库附件</div>
      <div class="num">${attachments}<small>个</small></div>
      <div class="cd">随笔记一并加密镜像</div>
    </div>
    <div class="card" role="button" tabindex="0" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc("lock", 13)}</span>附件密文</div>
      <div class="num">${kb}</div>
      <div class="cd">附件镜像密文字节</div>
    </div>
  </div>
  <div class="bz-vault-two">
    <div class="panel">
      <div class="pt">最近加密<span class="more" role="button" tabindex="0" data-hero="recent-all">查看全部 →</span></div>
      ${recentRows}
    </div>
    <div class="panel" role="button" tabindex="0" data-hero="health" title="打开保险库体检">
      <div class="pt">保险库体检<span class="more">查看 →</span></div>
      ${healthRows}
      <div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">完整性校验</span><span class="n">${(health == null ? void 0 : health.lastChecked) || "—"}</span></div>
    </div>
  </div>`;
  }
  function noteRowHTML(note, kind, active) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const sub = kind === "note" ? `${note.attachments.length} 个附件 · ${escapeHtml2(note.path)}` : (note.path.split("/").pop() || note.title) + (note.attachments.length ? ` · ${note.attachments.length} 个附件` : "");
    return `
    <div class="bz-vault-row ${active ? "on" : ""}" role="button" tabindex="0" data-noteid="${escapeHtml2(note.id)}" data-kind="${kind}">
      <span class="av" style="background:${color}">${vIc(iconName, 16)}</span>
      <div class="mid"><div class="t1">${escapeHtml2(note.title)}</div><div class="t2">${sub}</div></div>
      <span class="tm">${escapeHtml2(formatRelativeTime(note.createdAt))}</span>
    </div>`;
  }
  function noteDetailHTML(note, kind, plainPreview) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const attLine = note.attachments.length ? `<span class="val" title="${escapeHtml2(note.attachments.map((a) => a.path.split("/").pop() || a.path).join("、"))}">${note.attachments.length} 个</span>` : '<span class="val">无附件</span>';
    const pathLine = kind === "note" ? `${escapeHtml2(note.path)} · 已移出` : `${escapeHtml2(note.path)} · 已还原该段`;
    const created = new Date(note.createdAt).toLocaleString("zh-CN", { hour12: false });
    const actionBtns = kind === "note" ? `<button class="bbtn teal" data-detail="preview">${vIc("eye", 14)} 解密预览</button>
         <button class="bbtn" data-detail="restore">${vIc("download", 14)} 取出还原</button>
         <button class="bbtn danger" data-detail="delete">${vIc("trash-2", 14)} 销毁</button>` : `<button class="bbtn indigo" data-detail="restore-diary">${vIc("download", 14)} 还原回日记</button>
         <button class="bbtn" data-detail="copy-diary">${vIc("copy", 14)} 复制正文</button>
         <button class="bbtn danger" data-detail="destroy-diary">${vIc("trash-2", 14)} 彻底销毁</button>`;
    return `
    <div class="bz-vault-dhead">
      <span class="big" style="background:${color}">${vIc(iconName, 21)}</span>
      <div class="ttl"><h2>${escapeHtml2(note.title)}</h2><div class="url">${pathLine}</div></div>
    </div>
    <div class="bz-vault-dcontent">
      ${kind === "note" ? `<div class="field"><div class="lab">附件镜像</div><div class="valrow">${attLine}</div></div>
           <div class="field"><div class="lab">加密时间</div><div class="valrow"><span class="val">${escapeHtml2(created)}</span></div></div>
           <div class="note hint">原笔记正文已 100% 密文化；双击列表行可压缩预览（原图按需加载原层）。</div>` : `<div class="field"><div class="lab">正文预览</div><div class="note pre">${plainPreview ? escapeHtml2(plainPreview).replace(/\n/g, "<br>") : "（未解密预览）"}</div></div>
           <div class="field"><div class="lab">加密于</div><div class="valrow"><span class="val">${escapeHtml2(created)}</span></div></div>`}
      <div class="bigbtns">${actionBtns}</div>
    </div>`;
  }
  var ASSET_COLOR, LUCIDE_ALIAS;
  var init_vault_assets_view = __esm({
    "src/encrypt/vault-assets-view.ts"() {
      init_utils();
      init_str();
      ASSET_COLOR = {
        note: "#2e7d68",
        diary: "#5a63a8"
      };
      LUCIDE_ALIAS = {
        "more-h": "more-horizontal",
        "star-outline": "star"
      };
    }
  });

  // src/core/ui/lock-screen.ts
  function uiLockScreen(opts) {
    const el = document.createElement("div");
    el.className = `bz-lockscreen bz-lockscreen--${opts.kind}` + (opts.inline ? " bz-lockscreen--inline" : " bz-lockscreen--mask");
    el.dataset.ls = opts.inline ? "box" : "mask";
    const box = document.createElement("div");
    box.className = "bz-lockscreen-box";
    box.dataset.ls = "box";
    const seal = document.createElement("div");
    seal.className = "bz-lockscreen-seal";
    seal.dataset.ls = "seal";
    seal.appendChild(uiIcon(opts.icon || "lock", "bz-lockscreen-seal-ic"));
    box.appendChild(seal);
    const title = document.createElement("h4");
    title.className = "bz-lockscreen-title";
    title.dataset.ls = "title";
    title.textContent = opts.title;
    box.appendChild(title);
    const sub = document.createElement("p");
    sub.className = "bz-lockscreen-sub";
    sub.dataset.ls = "sub";
    sub.textContent = opts.sub || "";
    box.appendChild(sub);
    const statsWrap = document.createElement("div");
    statsWrap.className = "bz-lockscreen-stats";
    statsWrap.dataset.ls = "stats";
    const setStats = (list) => {
      statsWrap.innerHTML = "";
      (list || []).forEach((s) => {
        const card = document.createElement("div");
        card.className = "bz-lockscreen-stat";
        const num = document.createElement("b");
        num.className = "bz-lockscreen-num";
        num.textContent = s.num;
        const lab = document.createElement("span");
        lab.className = "bz-lockscreen-label";
        lab.textContent = s.label;
        card.appendChild(num);
        card.appendChild(lab);
        statsWrap.appendChild(card);
      });
      statsWrap.style.display = list && list.length ? "" : "none";
    };
    setStats(opts.stats || []);
    box.appendChild(statsWrap);
    const warning = document.createElement("div");
    warning.className = "bz-lockscreen-warning";
    warning.dataset.ls = "warning";
    warning.innerHTML = opts.warningHtml || "";
    warning.style.display = opts.firstSetup ? "" : "none";
    box.appendChild(warning);
    const ack = document.createElement("label");
    ack.className = "bz-lockscreen-ack";
    ack.dataset.ls = "ack";
    const ackBox = document.createElement("input");
    ackBox.type = "checkbox";
    ack.appendChild(ackBox);
    ack.appendChild(document.createTextNode(opts.ackText || "我已了解：主密码无法找回，遗忘将导致密文永久无法恢复"));
    ack.style.display = opts.firstSetup ? "" : "none";
    box.appendChild(ack);
    const row = document.createElement("div");
    row.className = "bz-lockscreen-row";
    const input = document.createElement("input");
    input.type = "password";
    input.className = "bz-lockscreen-input";
    input.dataset.ls = "p1";
    input.placeholder = opts.placeholder || "主密码";
    input.autocomplete = "off";
    const input2 = document.createElement("input");
    input2.type = "password";
    input2.className = "bz-lockscreen-input";
    input2.dataset.ls = "p2";
    input2.placeholder = "再次输入";
    input2.autocomplete = "off";
    input2.style.display = opts.firstSetup ? "" : "none";
    const actionBtn = document.createElement("button");
    actionBtn.className = "bz-lockscreen-action";
    actionBtn.dataset.ls = "go";
    actionBtn.textContent = opts.action;
    let cancelBtn = null;
    if (opts.cancel) {
      cancelBtn = document.createElement("button");
      cancelBtn.className = "bz-lockscreen-cancel";
      cancelBtn.dataset.ls = "cancel";
      cancelBtn.textContent = opts.cancel;
    }
    row.appendChild(input);
    row.appendChild(input2);
    if (cancelBtn) row.appendChild(cancelBtn);
    row.appendChild(actionBtn);
    box.appendChild(row);
    for (const inp of [input, input2]) {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") actionBtn.click();
      });
    }
    const err = document.createElement("div");
    err.className = "bz-lockscreen-err";
    err.dataset.ls = "err";
    box.appendChild(err);
    const sec = document.createElement("div");
    sec.className = "bz-lockscreen-sec";
    sec.dataset.ls = "sec";
    const dot = document.createElement("span");
    dot.className = "bz-lockscreen-dot";
    sec.appendChild(dot);
    const secText = document.createElement("span");
    secText.textContent = opts.secText || "";
    sec.appendChild(secText);
    if (opts.secTone) sec.classList.add(`bz-lockscreen-sec--${opts.secTone}`);
    sec.style.display = opts.secText ? "" : "none";
    box.appendChild(sec);
    const hint = document.createElement("div");
    hint.className = "bz-lockscreen-hint";
    hint.dataset.ls = "hint";
    hint.textContent = opts.hint || "";
    hint.style.display = opts.hint ? "" : "none";
    box.appendChild(hint);
    if (!opts.inline) el.style.display = "flex";
    el.appendChild(box);
    const focus = () => {
      try {
        input.focus({ preventScroll: true });
      } catch (e) {
        input.focus();
      }
    };
    return {
      el,
      input,
      input2,
      ackBox,
      actionBtn,
      cancelBtn,
      setTitle: (t) => {
        title.textContent = t;
      },
      setMessage: (t) => {
        sub.textContent = t;
      },
      setError: (t) => {
        err.textContent = t;
      },
      setStats,
      setSec: (t, tone) => {
        secText.textContent = t;
        sec.style.display = t ? "" : "none";
        sec.classList.remove("bz-lockscreen-sec--ok", "bz-lockscreen-sec--warn", "bz-lockscreen-sec--bad");
        if (tone) sec.classList.add(`bz-lockscreen-sec--${tone}`);
      },
      setBusy: (busy) => {
        actionBtn.disabled = !!busy;
        input.disabled = !!busy;
        input2.disabled = !!busy;
        if (cancelBtn) cancelBtn.disabled = !!busy;
        if (busy) actionBtn.dataset.busyText = actionBtn.textContent || "";
        actionBtn.textContent = busy ? "处理中…" : actionBtn.dataset.busyText || opts.action;
      },
      showSecondInput: (show) => {
        input2.style.display = show ? "" : "none";
      },
      focus,
      close: () => {
        el.remove();
      }
    };
  }
  var init_lock_screen = __esm({
    "src/core/ui/lock-screen.ts"() {
      init_icon();
    }
  });

  // src/core/lock-stats.ts
  async function readLockStats(kind) {
    try {
      const all = await jsonFileStore(lockStatsPath(), { defaultValue: {} }).read();
      const hit = all[kind];
      return Array.isArray(hit) && hit.length ? hit : null;
    } catch (e) {
      return null;
    }
  }
  function writeLockStats(kind, stats) {
    return updateFileSections(
      lockStatsPath(),
      () => {
        const set = {};
        set[kind] = stats;
        return set;
      },
      { defaultValue: {}, writeIfChanged: true }
    ).then(() => void 0);
  }
  var lockStatsPath;
  var init_lock_stats = __esm({
    "src/core/lock-stats.ts"() {
      init_storage();
      lockStatsPath = () => storageFile("lock-stats.json");
    }
  });

  // src/encrypt/motion.ts
  function motionReduced() {
    try {
      return typeof location !== "undefined" && location.search.includes("rm=1");
    } catch (e) {
      return false;
    }
  }
  function motionWaapi(el, frames, opts) {
    if (!el || motionReduced() || typeof el.animate !== "function") {
      const last = frames[frames.length - 1];
      if (el && last) for (const k of Object.keys(last)) {
        if (k === "offset") continue;
        try {
          el.style[k] = String(last[k]);
        } catch (e) {
        }
      }
      return null;
    }
    try {
      return el.animate(frames, opts);
    } catch (e) {
      return null;
    }
  }
  function motionAfter(ms, fn) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }
  function motionCancelPending() {
    timers.forEach(clearTimeout);
    timers.clear();
  }
  function motionShellAfter(ms, fn) {
    setTimeout(fn, ms);
  }
  function motionLoopAdd(key, stop) {
    motionLoopStop(key);
    loops.set(key, stop);
  }
  function motionLoopStop(key) {
    const stop = loops.get(key);
    if (stop) {
      loops.delete(key);
      try {
        stop();
      } catch (e) {
      }
    }
  }
  function motionLoopStopAll() {
    for (const key of [...loops.keys()]) motionLoopStop(key);
  }
  function motionTeardown() {
    motionCancelPending();
    motionLoopStopAll();
  }
  function motionVeil(rect, cls) {
    if (!rect || rect.width < 5 || rect.height < 5) return null;
    if (typeof document === "undefined" || !document.body) return null;
    const veil = document.createElement("div");
    veil.className = cls;
    veil.setAttribute("aria-hidden", "true");
    veil.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;pointer-events:none;z-index:var(--bz-z-overlay,1000);`;
    document.body.appendChild(veil);
    return veil;
  }
  function motionVeilGone(veil, anim, dur) {
    const gone = () => {
      try {
        veil.remove();
      } catch (e) {
      }
    };
    if (anim) anim.finished.then(gone).catch(gone);
    motionShellAfter(dur + 150, gone);
  }
  function motionVisible(el) {
    return !!el && el.offsetWidth > 0 && el.offsetHeight > 0;
  }
  function motionArmBoot() {
    intent = "boot";
  }
  function motionArmSwitch() {
    if (!intent) intent = "switch";
  }
  function motionArmSearch() {
    if (!intent) intent = "search";
  }
  function rise(el, delay, dur = M2.base, from = {}) {
    var _a, _b, _c;
    const y = (_a = from.y) != null ? _a : 8;
    const blur = (_b = from.blur) != null ? _b : 4;
    const scale = (_c = from.scale) != null ? _c : 1;
    motionAfter(delay, () => {
      motionWaapi(
        el,
        [
          { opacity: 0, transform: `translateY(${y}px)${scale !== 1 ? ` scale(${scale})` : ""}`, filter: `blur(${blur}px)` },
          { opacity: 1, transform: "none", filter: "blur(0px)" }
        ],
        { duration: dur, easing: E.out, fill: "backwards" }
      );
    });
  }
  function motionRendered(popup) {
    motionCancelPending();
    const phase = intent;
    intent = null;
    if (!popup || motionReduced() || !motionVisible(popup)) return;
    const desk = popup.querySelector(".bz-vault-desk");
    const mob = popup.querySelector(".bz-vault-mob");
    const deskOn = motionVisible(desk);
    if (deskOn && desk) {
      const seal = desk.querySelector(".bz-vault-brand .seal");
      const items = [...desk.querySelectorAll(".bz-vault-item")];
      const side = [desk.querySelector(".bz-vault-health"), desk.querySelector(".bz-vault-lockbtn")];
      const rows = [...desk.querySelectorAll(".bz-vault-lc-body .bz-vault-row")];
      const detail = desk.querySelector(".bz-vault-detail");
      if (phase === "boot") {
        if (seal) motionAfter(0, () => motionWaapi(
          seal,
          [
            { opacity: 0, transform: "rotate(-120deg) scale(.55)", filter: "blur(3px)" },
            { opacity: 1, transform: "rotate(8deg) scale(1.06)", filter: "blur(0px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" }
          ],
          { duration: 380, easing: E.out, fill: "backwards" }
        ));
        items.forEach((el, i) => rise(el, 90 + i * 45, M2.base, { y: 6 }));
        side.forEach((el, i) => {
          if (el) rise(el, 240 + i * 60, M2.base, { y: 6 });
        });
        const title = desk.querySelector("[data-vault-title]");
        if (title) rise(title, 60, M2.base, { y: 5 });
        motionBootSweep(popup);
      }
      if (phase === "boot") rows.forEach((el, i) => {
        if (i < 14) rise(el, 300 + i * STAG, M2.base, { y: 7 });
      });
      else if (phase === "switch") rows.forEach((el, i) => {
        if (i < 12) rise(el, i * 20, M2.fast + 60, { y: 6, blur: 3 });
      });
      else if (phase === "search") rows.forEach((el, i) => {
        if (i < 10) rise(el, i * 14, M2.fast + 40, { y: 4, blur: 2 });
      });
      if (detail) {
        if (phase === "boot" || phase === "switch") revealDetail(detail, phase === "boot" ? 220 : 40);
        else if (phase === "search") revealDetail(detail, 30, true);
        else rise(detail, 0, M2.fast + 40, { y: 4, blur: 2 });
      }
    }
    if (motionVisible(mob) && mob) {
      const rows = [...mob.querySelectorAll("[data-mob-body] > .bz-vault-row")];
      if (phase === "boot") rows.forEach((el, i) => {
        if (i < 12) rise(el, 260 + i * STAG, M2.base, { y: 7 });
      });
      else if (phase === "switch") rows.forEach((el, i) => {
        if (i < 10) rise(el, i * 20, M2.fast + 60, { y: 6, blur: 3 });
      });
      else if (phase === "search") rows.forEach((el, i) => {
        if (i < 8) rise(el, i * 14, M2.fast + 40, { y: 4, blur: 2 });
      });
    }
  }
  function revealDetail(detail, base, light = false) {
    const blocks = [
      detail.querySelector(".bz-vault-dhead"),
      detail.querySelector(".bz-vault-hero"),
      detail.querySelector(".bz-vault-cards"),
      detail.querySelector(".bz-vault-two")
    ].filter((b) => !!b);
    blocks.forEach((b, i) => rise(b, base + i * (light ? 40 : 70), light ? M2.fast + 60 : M2.base, { y: light ? 4 : 7 }));
    const fields = [...detail.querySelectorAll(".bz-vault-dcontent .field, .bz-vault-dcontent .bigbtns")];
    fields.forEach((f, i) => rise(f, base + blocks.length * 60 + i * 55, M2.base, { y: 5 }));
    const minis = [...detail.querySelectorAll(".bz-vault-minirow")];
    minis.forEach((m, i) => {
      if (i < 6) rise(m, base + 260 + i * 50, M2.base, { y: 4, blur: 2 });
    });
  }
  function motionPanelIn(popup) {
    if (!popup || motionReduced()) return;
    const mask = document.getElementById("bz-encrypt-mask");
    if (mask) motionWaapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M2.move, easing: E.out });
    const title = popup.querySelector("[data-vault-title]");
    if (title && motionVisible(popup)) {
      motionShellAfter(80, () => {
        motionWaapi(
          title,
          [
            { opacity: 0, transform: "translateY(5px)", filter: "blur(3px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" }
          ],
          { duration: M2.base, easing: E.out, fill: "backwards" }
        );
      });
    }
  }
  function motionPanelCollapse(popup) {
    if (!popup || motionReduced()) return;
    const rect = popup.getBoundingClientRect();
    let bg = "";
    let radius = "12px";
    try {
      const cs = getComputedStyle(popup);
      bg = cs.backgroundColor;
      if (cs.borderRadius) radius = cs.borderRadius;
    } catch (e) {
    }
    const veil = motionVeil(rect, "bz-vlt-collapse");
    if (!veil) return;
    veil.style.cssText += `background:${bg || "var(--bz-surface-2, #20242b)"};border-radius:${radius};box-shadow:var(--bz-shadow-lg, 0 20px 60px rgba(0,0,0,.4));`;
    const anim = motionWaapi(
      veil,
      [
        { opacity: 1, transform: "scale(1)", filter: "brightness(1) blur(0px)" },
        { opacity: 0, transform: "scale(.965)", filter: "brightness(.45) blur(5px)" }
      ],
      { duration: M2.move + 20, easing: E.out }
    );
    motionVeilGone(veil, anim, M2.move + 20);
  }
  function motionLockSealing(popup) {
    if (!popup || motionReduced() || !motionVisible(popup)) return;
    const rect = popup.getBoundingClientRect();
    let radius = "12px";
    let z = 1e3;
    try {
      const cs = getComputedStyle(popup);
      if (cs.borderRadius) radius = cs.borderRadius;
      z = (parseInt(cs.zIndex, 10) || 1e3) + 1;
    } catch (e) {
    }
    const gate = motionVeil(rect, "bz-vlt-gate");
    if (!gate) return;
    gate.style.cssText += `border-radius:${radius};z-index:${z};`;
    const top = document.createElement("div");
    top.className = "bz-vlt-gate-bar is-top";
    const bot = document.createElement("div");
    bot.className = "bz-vlt-gate-bar is-bot";
    gate.append(top, bot);
    motionWaapi(
      top,
      [{ transform: "translateY(-102%)" }, { transform: "translateY(0)" }],
      { duration: 260, easing: E.move, fill: "forwards" }
    );
    motionWaapi(
      bot,
      [{ transform: "translateY(102%)" }, { transform: "translateY(0)" }],
      { duration: 260, easing: E.move, fill: "forwards" }
    );
    motionShellAfter(268, () => {
      motionWaapi(
        top,
        [{ filter: "brightness(1)" }, { filter: "brightness(1.55)" }, { filter: "brightness(1)" }],
        { duration: 240, easing: E.out }
      );
      motionWaapi(
        bot,
        [{ filter: "brightness(1)" }, { filter: "brightness(1.55)" }, { filter: "brightness(1)" }],
        { duration: 240, easing: E.out }
      );
    });
    const seal = popup.querySelector(".bz-vault-brand .seal");
    if (seal) motionWaapi(
      seal,
      [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }],
      { duration: 460, easing: E.move }
    );
    motionShellAfter(430, () => {
      const out = motionWaapi(gate, [{ opacity: 1 }, { opacity: 0 }], { duration: 190, easing: E.out, fill: "forwards" });
      const gone = () => {
        try {
          gate.remove();
        } catch (e) {
        }
      };
      if (out) out.finished.then(gone).catch(gone);
      motionShellAfter(320, gone);
    });
  }
  function motionBootSweep(popup) {
    if (motionReduced() || !motionVisible(popup)) return;
    const sweep = document.createElement("div");
    sweep.className = "bz-vlt-sweep";
    sweep.setAttribute("aria-hidden", "true");
    popup.appendChild(sweep);
    const anim = motionWaapi(
      sweep,
      [{ transform: "translateX(-72%)" }, { transform: "translateX(72%)" }],
      { duration: M2.impulse, easing: E.out }
    );
    motionVeilGone(sweep, anim, M2.impulse);
  }
  function motionLockScreenIn(lsEl) {
    if (!lsEl || motionReduced()) return;
    const box = lsEl.querySelector('[data-ls="box"]');
    if (!box) return;
    motionWaapi(
      box,
      [
        { opacity: 0, transform: "translateY(16px) scale(.985)", filter: "blur(6px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: 360, easing: E.out, fill: "backwards" }
    );
    const seal = lsEl.querySelector('[data-ls="seal"]');
    if (seal) motionWaapi(
      seal,
      [
        { opacity: 0, transform: "rotate(-16deg) scale(1.55)", filter: "blur(3px)" },
        { opacity: 1, transform: "rotate(4deg) scale(.97)", filter: "blur(0px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: 440, easing: E.out, fill: "backwards" }
    );
    const lines = ['[data-ls="title"]', '[data-ls="sub"]', '[data-ls="row"]'];
    lines.forEach((sel, i) => {
      const el = lsEl.querySelector(sel);
      if (el) {
        motionShellAfter(120 + i * 70, () => {
          motionWaapi(
            el,
            [
              { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
              { opacity: 1, transform: "none", filter: "blur(0px)" }
            ],
            { duration: M2.base, easing: E.out, fill: "backwards" }
          );
        });
      }
    });
    const stats = [...lsEl.querySelectorAll('[data-ls="stats"] .bz-lockscreen-stat')];
    stats.forEach((el, i) => {
      motionShellAfter(200 + i * 60, () => {
        motionWaapi(
          el,
          [
            { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" }
          ],
          { duration: M2.base, easing: E.out, fill: "backwards" }
        );
      });
    });
  }
  function motionUnlockBurst(seal) {
    if (!seal || motionReduced()) return;
    const rect = seal.getBoundingClientRect();
    const veil = motionVeil(rect, "bz-vlt-burst");
    if (!veil) return;
    const ring = document.createElement("div");
    ring.className = "bz-vlt-burst-ring";
    veil.appendChild(ring);
    for (let i = 0; i < 7; i++) {
      const bit = document.createElement("div");
      bit.className = "bz-vlt-burst-bit";
      veil.appendChild(bit);
      const ang = i / 7 * Math.PI * 2 + Math.random() * 0.6;
      const dist = 26 + Math.random() * 26;
      motionWaapi(
        bit,
        [
          { opacity: 1, transform: "translate(-50%,-50%) translate(0,0) scale(1)" },
          { opacity: 0, transform: `translate(-50%,-50%) translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(.4)` }
        ],
        { duration: 380 + Math.random() * 120, easing: E.out }
      );
    }
    const anim = motionWaapi(
      ring,
      [
        { opacity: 0.95, transform: "translate(-50%,-50%) scale(.55)" },
        { opacity: 0, transform: "translate(-50%,-50%) scale(2.3)" }
      ],
      { duration: 460, easing: E.out }
    );
    motionVeilGone(veil, anim, 460);
  }
  function motionRejectShake(lsEl) {
    if (!lsEl || motionReduced()) return;
    const box = lsEl.querySelector('[data-ls="box"]');
    if (!box) return;
    motionWaapi(
      box,
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(7px)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 300, easing: E.out }
    );
  }
  function motionPreviewIn(popup) {
    if (!popup || motionReduced() || !motionVisible(popup)) return;
    motionWaapi(
      popup,
      [
        { opacity: 0, transform: "translateY(12px) scale(.985)", filter: "blur(5px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: 300, easing: E.out, fill: "backwards" }
    );
    motionBootSweep(popup);
  }
  function motionRevealBody(el) {
    if (!el || motionReduced() || !motionVisible(el)) return;
    motionWaapi(
      el,
      [
        { opacity: 0.3, filter: "blur(7px) brightness(1.35)" },
        { opacity: 1, filter: "blur(0px) brightness(1)" }
      ],
      { duration: 460, easing: E.out, fill: "backwards" }
    );
  }
  function motionOriginalFlash(slot) {
    if (!slot || motionReduced()) return;
    const media = slot.querySelector("img.bz-encrypt-preview-media, video.bz-encrypt-preview-video");
    const target = media || slot;
    motionWaapi(
      target,
      [{ filter: "brightness(1.6) contrast(1.05)" }, { filter: "brightness(1) contrast(1)" }],
      { duration: 300, easing: E.out }
    );
  }
  function motionHealthIn(box) {
    if (!box || motionReduced() || !motionVisible(box)) return;
    motionWaapi(
      box,
      [
        { opacity: 0, transform: "translateY(12px) scale(.985)", filter: "blur(5px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: 300, easing: E.out, fill: "backwards" }
    );
    motionBootSweep(box);
  }
  function motionScanStart(box) {
    motionScanStop(box);
    if (!box || motionReduced()) return;
    const body = box.querySelector(".bz-encrypt-health-body");
    if (!body || !motionVisible(body)) return;
    const host = document.createElement("div");
    host.className = "bz-vlt-scanhost";
    host.setAttribute("aria-hidden", "true");
    const beam = document.createElement("div");
    beam.className = "bz-vlt-scanbeam";
    host.appendChild(beam);
    box.appendChild(host);
    motionLoopAdd("encrypt-scan", () => {
      try {
        host.remove();
      } catch (e) {
      }
    });
  }
  function motionScanStop(box) {
    motionLoopStop("encrypt-scan");
  }
  function motionReportIn(body) {
    if (!body || motionReduced()) return;
    const summary = body.querySelector(".bz-encrypt-health-summary");
    if (summary) motionWaapi(
      summary,
      [
        { opacity: 0, transform: "translateY(5px)", filter: "blur(3px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: M2.base, easing: E.out, fill: "backwards" }
    );
    const secs = [...body.querySelectorAll(".bz-encrypt-health-section, .bz-encrypt-health-item, .bz-encrypt-health-hint")];
    secs.forEach((el, i) => {
      if (i < 12) rise(el, 90 + i * 35, M2.base, { y: 4, blur: 2 });
    });
  }
  function motionFindRowIn(row) {
    if (!row || motionReduced()) return;
    motionWaapi(
      row,
      [
        { opacity: 0, transform: "translateX(-6px)", filter: "blur(2px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" }
      ],
      { duration: M2.fast + 40, easing: E.out, fill: "backwards" }
    );
  }
  function motionStatusbarSpin(el) {
    if (!el || motionReduced()) return;
    const ic = el.querySelector(".bz-vault-ic");
    if (!ic) return;
    motionWaapi(
      ic,
      [
        { transform: "rotate(-100deg) scale(.7)", opacity: 0.4 },
        { transform: "rotate(10deg) scale(1.08)", opacity: 1 },
        { transform: "none", opacity: 1 }
      ],
      { duration: 360, easing: E.out }
    );
  }
  var M2, E, STAG, timers, loops, intent;
  var init_motion = __esm({
    "src/encrypt/motion.ts"() {
      M2 = { fast: 160, move: 200, base: 280, impulse: 740 };
      E = {
        out: "cubic-bezier(.22,.82,.3,1)",
        move: "cubic-bezier(.34,.06,.16,1)"
      };
      STAG = 30;
      timers = /* @__PURE__ */ new Set();
      loops = /* @__PURE__ */ new Map();
      intent = null;
    }
  });

  // src/encrypt/ui.ts
  function searchClearHtml() {
    return `<button type="button" class="bz-search-clear" data-search-clear title="清除搜索" aria-label="清除搜索" hidden>${vIc("x", 12)}</button>`;
  }
  function safeDecode(s) {
    try {
      return decodeURIComponent(s);
    } catch (e) {
      return s;
    }
  }
  function collectNoteAttachments(content, embedLinks, vaultFiles) {
    const refs = /* @__PURE__ */ new Set();
    for (const l of embedLinks) {
      if (l && typeof l === "string") refs.add(l.trim());
    }
    const wiki = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
    let m;
    while ((m = wiki.exec(content)) !== null) refs.add(m[1].trim());
    const mdImg = /!\[[^\]]*\]\(([^)\s]+)\)/g;
    while ((m = mdImg.exec(content)) !== null) refs.add(m[1].trim());
    const vid = /<video[^>]*src=["']([^"']+)["']/g;
    while ((m = vid.exec(content)) !== null) refs.add(m[1].trim());
    const paths = /* @__PURE__ */ new Set();
    const byName = /* @__PURE__ */ new Map();
    for (const f of vaultFiles) {
      paths.add(f.path);
      const name = f.path.slice(f.path.lastIndexOf("/") + 1);
      if (name && !byName.has(name)) byName.set(name, f.path);
    }
    const valid = /* @__PURE__ */ new Set();
    for (const r of refs) {
      if (!r) continue;
      const clean = safeDecode(r).replace(/^\.\//, "");
      let hit;
      if (paths.has(clean)) hit = clean;
      else if (!clean.includes("/")) hit = byName.get(clean);
      else {
        for (const p of paths) {
          if (p.endsWith("/" + clean)) {
            hit = p;
            break;
          }
        }
      }
      if (hit) valid.add(hit);
    }
    return [...valid];
  }
  function collectNoteAttachmentPaths(app, file, content) {
    var _a, _b, _c;
    const embedLinks = [];
    try {
      const cache = (_b = (_a = app == null ? void 0 : app.metadataCache) == null ? void 0 : _a.getFileCache) == null ? void 0 : _b.call(_a, file);
      const embeds = cache && Array.isArray(cache.embeds) ? cache.embeds : [];
      for (const e of embeds) {
        if (e && typeof e.link === "string") embedLinks.push(e.link);
      }
    } catch (e) {
    }
    const vaultFiles = ((_c = app == null ? void 0 : app.vault) == null ? void 0 : _c.getFiles) && app.vault.getFiles() || [];
    return collectNoteAttachments(content, embedLinks, vaultFiles);
  }
  function findSharedAttachmentPaths(notePath, attPaths, others) {
    const cand = /* @__PURE__ */ new Set();
    for (const p of attPaths) {
      if (p) cand.add(p);
    }
    if (!cand.size || !others.length) return [];
    const byName = /* @__PURE__ */ new Map();
    for (const p of cand) {
      const name = p.slice(p.lastIndexOf("/") + 1);
      if (name && !byName.has(name)) byName.set(name, p);
    }
    const shared = /* @__PURE__ */ new Set();
    for (const o of others) {
      if (!o || o.path === notePath) continue;
      for (const l of o.links || []) {
        if (!l || typeof l !== "string") continue;
        const clean = safeDecode(l.split("#")[0].trim()).replace(/^\.\//, "");
        if (!clean) continue;
        let hit;
        if (cand.has(clean)) hit = clean;
        else if (!clean.includes("/")) hit = byName.get(clean);
        else {
          for (const p of cand) {
            if (p.endsWith("/" + clean)) {
              hit = p;
              break;
            }
          }
        }
        if (hit) shared.add(hit);
      }
    }
    return [...shared];
  }
  function collectSharedAttachmentPaths(app, notePath, attPaths) {
    var _a, _b, _c;
    if (!attPaths.length) return [];
    let mds = [];
    try {
      mds = ((_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getMarkdownFiles) && app.vault.getMarkdownFiles() || [];
    } catch (e) {
      return [];
    }
    const others = [];
    for (const f of mds) {
      const links = [];
      try {
        const cache = (_c = (_b = app == null ? void 0 : app.metadataCache) == null ? void 0 : _b.getFileCache) == null ? void 0 : _c.call(_b, f);
        const embeds = cache && Array.isArray(cache.embeds) ? cache.embeds : [];
        const mdLinks = cache && Array.isArray(cache.links) ? cache.links : [];
        for (const e of embeds) {
          if (e && typeof e.link === "string") links.push(e.link);
        }
        for (const l of mdLinks) {
          if (l && typeof l.link === "string") links.push(l.link);
        }
      } catch (e) {
      }
      others.push({ path: f.path, links });
    }
    return findSharedAttachmentPaths(notePath, attPaths, others);
  }
  function kindOf(path) {
    var _a;
    const ext = ((_a = path.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
    return /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(ext) ? "video" : "image";
  }
  function mimeOf(path) {
    var _a;
    const ext = ((_a = path.split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
    const IMG = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      avif: "image/avif"
    };
    const VID = {
      mp4: "video/mp4",
      m4v: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      mkv: "video/x-matroska",
      avi: "video/x-msvideo",
      ogv: "video/ogg"
    };
    return IMG[ext] || VID[ext] || "application/octet-stream";
  }
  function collectMediaSlots(md, attachments) {
    const re = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]|!\[[^\]]*\]\(([^)\s]+)\)|<video[^>]*src=["']([^"']+)["']/g;
    const slots = [];
    const inlined = /* @__PURE__ */ new Set();
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(md)) !== null) {
      const target = (m[1] || m[2] || m[3] || "").trim().replace(/^\.\//, "");
      const att = findAttachment(target, attachments);
      const token = "@@ENC_MEDIA_" + slots.length + "@@";
      slots.push({ attachment: att != null ? att : null, token });
      if (att) inlined.add(att.path);
      out += md.slice(last, m.index) + token;
      last = m.index + m[0].length;
    }
    out += md.slice(last);
    return { text: out, slots, inlined };
  }
  function findAttachment(target, attachments) {
    const t = safeDecode(target).trim();
    return attachments.find((a) => a.path === t || a.path.endsWith("/" + t));
  }
  function mediaHtml(a, dataUrl) {
    if (!a) return "";
    const alt = escapeHtml2(a.path || "");
    const key = encodeURIComponent(a.path);
    const kindLabel = a.kind === "video" ? "视频" : "图";
    let inner;
    if (dataUrl) {
      inner = `<img class="bz-encrypt-preview-media" src="${dataUrl}" alt="${alt}" loading="lazy">`;
    } else {
      inner = `<div class="bz-encrypt-preview-missing" title="${alt}">
      <span class="bz-encrypt-preview-missing-name">${alt}</span>
      <span>${a.kind === "video" ? "视频抽帧预览不可用" : "无压缩预览"}，点击加载原${kindLabel}</span>
    </div>`;
    }
    return `<span class="bz-encrypt-preview-slot" data-attach="${key}">${inner}<span class="bz-encrypt-preview-spinner"></span></span>`;
  }
  function progressKey() {
    return "encrypt-progress-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  }
  function progressNotify(title) {
    try {
      return notify("0/0", { type: "progress", title, dedupeKey: progressKey(), duration: -1 });
    } catch (e) {
      return null;
    }
  }
  function truncateName(current, maxLen = 20) {
    let name = current.split("/").pop() || current;
    if (name.length > maxLen) name = name.slice(0, maxLen) + "…";
    return name;
  }
  function updateProgress(h, done, total, current) {
    if (!h) return;
    const base = `已处理 ${done}/${total}`;
    h.setMessage(`${base} · 当前：${truncateName(current)}`);
    const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
    h.setProgress(pct);
  }
  function finishProgress(h, done, msg) {
    if (!h) return;
    h.setMessage(`${msg}（${done} 个文件）`);
    h.setType("success");
  }
  function encryptSettingsSchema() {
    const warnReload = makeReloadWarnOnce();
    return {
      groups: [
        {
          // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
          icon: "palette",
          name: "外观",
          rows: [
            { type: "choiceCards", name: "面板布局", binding: { key: "encryptSkin" }, options: [{ value: "default", label: "三栏", prevClass: "bz-sp-prev-panel" }] },
            { type: "choiceCards", name: "面板主题", binding: { key: "encryptSkinTheme" }, layoutKey: "encryptSkin", options: [{ value: "steel", label: "钢灰", layout: "default", prevClass: "bz-sp-prev-steel" }] }
          ]
        },
        // 2026-09-26「目录」组整组退役：密文根目录固定 = <数据存储路径>/.ENCRYPT（core/storage 的
        // encryptDir 单源），不再给用户单独配——面板少一行需要解释「为什么不跟着数据目录走」的设置。
        {
          icon: "shield",
          name: "安全",
          rows: [
            // 统一「安全模式」：密码(securityMode)与加密(encryptSecurityMode)历史双键 OR 读取、
            // 同步双写（键位冻结兼容老用户任一键开启状态；ADR-0085 统一行为=关闭保险库立即自动上锁）
            {
              type: "toggle",
              name: "安全模式",
              desc: "关闭保险库窗口立即自动上锁",
              binding: {
                get: () => !!tryGetSettings().securityMode || !!tryGetSettings().encryptSecurityMode,
                set: (v) => {
                  const s = getSettings();
                  s.securityMode = v;
                  s.encryptSecurityMode = v;
                },
                save: () => saveSettings()
              },
              onChange: warnReload
            }
          ]
        },
        {
          icon: "image",
          name: "预览",
          rows: [
            {
              type: "toggle",
              name: "生成压缩预览",
              desc: "加密时生成图片视频的压缩预览",
              help: "加密图片与视频时同时生成压缩预览层，之后不解密即可看缩略图。下面「预览长边」「预览质量」两行是它的子项，开关关闭时一并隐藏。",
              binding: { key: "encryptPreviewEnabled" },
              onChange: warnReload
            },
            { type: "number", name: "预览长边", desc: "预览图目标长边像素", binding: numStrBinding("encryptPreviewSize", 384), min: 64, max: 1024, step: 16, onCommit: warnReload, isChild: true },
            { type: "number", name: "预览质量", desc: "JPEG 图像压缩质量", binding: numStrBinding("encryptPreviewQuality", 0.5), min: 0.1, max: 1, step: 0.1, onCommit: warnReload, isChild: true },
            {
              type: "toggle",
              name: "预览自动加载原图",
              desc: "打开预览自动解密原图",
              help: "默认关。开启后打开预览即自动解密全部原图替换缩略图，因此明显变慢；明文以 Blob URL 形式短暂驻留内存，关闭预览时统一 revokeObjectURL 回收。",
              binding: { key: "encryptAutoLoadOriginal" },
              onChange: warnReload,
              isChild: true
            }
          ]
        }
      ]
    };
  }
  var PREVIEW_RENDER_TIMEOUT_MS, LOCK_KIND_META, lastVisitedAsset, activeUnlock, PANEL, _UIManager, UIManager, _EncryptAppController, EncryptAppController;
  var init_ui2 = __esm({
    "src/encrypt/ui.ts"() {
      init_fake_obsidian();
      init_notice();
      init_app();
      init_esc_manager();
      init_focus_trap();
      init_flow_dialog();
      init_dom();
      init_item_actions();
      init_utils();
      init_ui();
      init_mobile();
      init_settings_provider();
      init_settings_modal();
      init_settings_common();
      init_data2();
      init_domain_bus();
      init_preview();
      init_data3();
      init_vault_assets_view();
      init_lock_screen();
      init_lock_stats();
      init_motion();
      PREVIEW_RENDER_TIMEOUT_MS = 3e3;
      LOCK_KIND_META = {
        vault: {
          icon: "shield",
          title: "保险库已上锁",
          sub: "解锁前，笔记正文与附件均以密文保存",
          action: "解锁",
          stats: [
            { num: "—", label: "笔记条目" },
            { num: "—", label: "随库附件" },
            { num: "—", label: "附件密文" }
          ]
        },
        "password-vault": {
          icon: "key",
          title: "密码本已上锁",
          sub: "解锁前，平台与口令均以密文保存",
          action: "解锁",
          stats: [
            { num: "—", label: "平台" },
            { num: "—", label: "口令条目" },
            { num: "—", label: "收藏" }
          ]
        },
        diary: {
          icon: "lock",
          title: "加密日记已上锁",
          sub: "解锁前，加密日记条目与附件均为密文",
          action: "解锁",
          stats: [
            { num: "—", label: "加密条目" },
            { num: "—", label: "随库附件" },
            { num: "—", label: "附件密文" }
          ]
        },
        people: {
          icon: "lock",
          title: "脸谱",
          sub: "人物消息脸谱",
          action: "解锁保险库",
          stats: [
            { num: "—", label: "联系人" },
            { num: "—", label: "随记录附件" },
            { num: "—", label: "附件密文" }
          ]
        }
      };
      lastVisitedAsset = "note";
      activeUnlock = null;
      PANEL = { MIN_W: 560, MIN_H: 420, MAX_W: 1e3, MAX_H: 820 };
      _UIManager = class _UIManager {
        constructor(dataManager, config, pwDataManager) {
          /** 顶部「加密当前笔记」按钮回调（由 Controller 注入，调 lockCurrentNote） */
          this.onLockCurrentNote = null;
          // DOM
          this.mask = null;
          this.popup = null;
          this.listContainer = null;
          this.previewMask = null;
          this.previewPopup = null;
          /** 体检弹窗（右上角 🩺 替换原清理扫把：先报告后勾选清理，用户拍板） */
          this.healthMask = null;
          this.healthPopup = null;
          /** 缩略图按需加载产生的 Blob URL（预览窗关闭时统一 revoke，防泄漏） */
          this._previewUrls = [];
          this._initialized = false;
          /** 解锁连续失败次数（P2 节流：冷却 = min(2^(n-1) 秒, 8 秒)；成功复位） */
          this.unlockFailStreak = 0;
          /** 当前冷却截止时间戳（ms）；早于此的尝试被拒绝并提示剩余等待 */
          this.unlockCooldownUntil = 0;
          /** 搜索防抖（180ms 尾触；issue 365 收编 core debounce，原手写无 teardown 取消路径） */
          this.searchDebounced = debounce(() => this.renderAll(), 180);
          /** 列表搜索关键词（笔记列表头搜索框 / 移动端常驻框共用；防抖后触发重绘） */
          this.searchKw = "";
          /** 当前资产视图（概览/笔记/日记） */
          this.asset = "overview";
          /** 加密日记详情临时明文缓存（渲染详情时惰性解密） */
          this._diaryPlain = {};
          /** 最近一次体检结果缓存（E5：概览健康卡随 scanHealth 更新，未体检为 null；上锁清空） */
          this.lastHealth = null;
          /** 本次解锁会话起点（ms；notifyUnlockUi 同步，上锁清空）——左栏「已解锁时长」计时用 */
          this.unlockedAt = null;
          /** 已解锁时长刷新计时器（面板可见时每秒跳一次） */
          this.sessionTimer = null;
          /** 安全模式无交互自动上锁计时器（15 分钟；面板内交互重置） */
          this.idleLockTimer = null;
          /** 桌面拖动缩放句柄（ADR-0084/0094）：show 挂、hide 摘，与面板显隐成对（幂等防重复挂） */
          this.panelResizeDetach = null;
          /** 信封迁移进度通知句柄（迁移是解锁后一次性任务，句柄用完即清） */
          this._migNotify = null;
          /** 上次渲染的资产：资产未变时保留列表头（连同搜索框），避免搜索输入被重建而掉焦点 */
          this._lastRenderedAsset = null;
          /** 空闲计时 bump（document 捕获阶段；见 bindVaultShell 尾部） */
          this._idleBump = null;
          /** encrypt:unlock-changed 订阅句柄（ensureElements 挂 / detachGlobalListeners 摘） */
          this._unlockOff = null;
          /** 体检进行中旗标（T9 重入守卫：扫描中「重新体检」/清理后自动复扫不再并发双扫） */
          this._scanning = false;
          // ---------- 修改主密码（ADR-0211，issue 508） ----------
          /** 改密屏进行中句柄（两屏接力共用；进行中不重开） */
          this.activeChangePw = null;
          // ---------- 统一工作台渲染 ----------
          /**
           * 共享锁密码载荷装载旗标（效率整改 4：load 仅解锁后首次 renderList 执行——
           * 统计无需逐次刷新，loadCache 本就按密文判等；上锁后复位，下次解锁重新装载）
           */
          this._pwLoadedSinceUnlock = false;
          /** 解锁屏统计快照（会话内缓存；冷启动回落 lock-stats.json 上次快照，见 core/lock-stats） */
          this.lockStatsCache = {};
          this._selNoteId = null;
          /** 预览 Markdown 渲染生命周期句柄（T13）：closePreview/下一次填充前 unload，渲染任务不滞留 */
          this._previewComponent = null;
          this.dataManager = dataManager;
          this.config = config;
          this.pwDataManager = pwDataManager || new PasswordVaultDataManager(dataManager);
          dataManager.onMigrationProgress = (done, total) => {
            if (!this._migNotify) this._migNotify = progressNotify("加密结构升级");
            updateProgress(this._migNotify, done, total, "重加密密文镜像");
          };
          dataManager.onMigrationEnd = (ok, reason) => {
            if (!this._migNotify) return;
            if (ok) {
              this._migNotify.setMessage("加密结构升级完成，修改主密码已可用");
              this._migNotify.setType("success");
            } else if (reason === "locked") {
              this._migNotify.setMessage("加密结构升级已中止（保险库上锁）：下次解锁自动继续");
              this._migNotify.setType("warning");
            } else {
              this._migNotify.setMessage("加密结构升级失败：数据未受影响，下次解锁自动重试");
              this._migNotify.setType("error");
            }
            this._migNotify = null;
          };
        }
        /** 解锁成功后复位节流状态 */
        resetUnlockThrottle() {
          this.unlockFailStreak = 0;
          this.unlockCooldownUntil = 0;
        }
        /** 登记一次密码错误：递增失败连击并按 1s/2s/4s…封顶 8s 设置下次可试时间，返回本次冷却秒数 */
        registerUnlockFailure() {
          this.unlockFailStreak += 1;
          const delaySec = Math.min(2 ** (this.unlockFailStreak - 1), 8);
          this.unlockCooldownUntil = Date.now() + delaySec * 1e3;
          return delaySec;
        }
        /**
         * 桌面搜索框（评审 2026-09-12：从顶栏下移到列表头里）——它现在随
         * 列表头一起渲染，故不再缓存引用而按需现取；null = 当前资产没有列表头（概览）。
         */
        get deskSearch() {
          var _a, _b;
          return (_b = (_a = this.popup) == null ? void 0 : _a.querySelector("[data-vault-search]")) != null ? _b : null;
        }
        ensureElements() {
          if (this._initialized) return;
          this.mask = this.createMask("bz-encrypt-mask");
          this.popup = this.createPopup("bz-encrypt-popup");
          this.popup.classList.add("bz-panel-mtop");
          this.popup.innerHTML = `
      <div class="bz-vault-desk">
        <div class="bz-vault-nav">
          <div class="bz-vault-brand">
            <div class="seal">${vIc("lock", 19)}</div>
            <div class="nm">保险库<small>VAULT</small></div>
          </div>
          <div class="bz-vault-item on" role="button" tabindex="0" data-asset="overview">${vIc("layout-grid", 16)}概览<span class="cnt" data-cnt="overview"></span></div>
          <div class="bz-vault-sec">资产档案</div>
          <div class="bz-vault-item k-note" role="button" tabindex="0" data-asset="note">${vIc("file-lock", 16)}笔记<span class="cnt" data-cnt="note"></span></div>
          <div class="bz-vault-item k-diary" role="button" tabindex="0" data-asset="diary">${vIc("book-lock", 16)}加密日记<span class="cnt" data-cnt="diary"></span></div>
          <div class="grow"></div>
          <div class="bz-vault-health" role="button" tabindex="0" data-act="health-card" title="打开保险库体检">
            <div class="ht"><span class="okdot"></span><span data-health-t>保险库健康</span></div>
            <div class="hd" data-health-d>未体检</div>
          </div>
          <div class="bz-vault-lockbtn" role="button" tabindex="0" data-act="lock"><span class="lbl">${vIc("lock", 14)} 立即上锁</span><span class="dur" data-unlock-dur></span><span class="dot"></span></div>
        </div>
        <div class="bz-vault-main">
          <!-- 顶栏只留标题：右侧三按钮（存入笔记/体检/关闭）按评审去掉——关闭走 Esc 或点遮罩，
               体检走左栏健康卡，存入笔记走命令「加密当前笔记」，三条入口都不丢 -->
          <div class="bz-vault-bar">
            <h1 data-vault-title>保险库</h1>
          </div>
          <div class="bz-vault-pane">
            <div class="bz-vault-listcol" data-vault-list></div>
            <div class="bz-vault-detail" data-vault-detail></div>
          </div>
        </div>
      </div>
      <div class="bz-vault-mob">
        <div class="bz-vault-mbar">
          <div class="seal">${vIc("lock", 15)}</div>
          <div class="t">保险库</div>
          <span class="st" data-mob-unlock>已解锁</span>
          <button class="bz-vault-mobclose bz-touch-target--xl" data-act="mob-close" aria-label="关闭">${vIc("x", 15)}</button>
        </div>
        <div class="bz-search bz-vault-msearch"><i data-lucide="search" class="bz-ic"></i><input class="bz-input" placeholder="搜索全部资产…" data-mob-search>${searchClearHtml()}</div>
        <div class="bz-vault-mseg" data-mob-seg>
          <span class="sg on" role="button" tabindex="0" data-masset="overview">概览</span>
          <span class="sg" role="button" tabindex="0" data-masset="note">笔记</span>
          <span class="sg" role="button" tabindex="0" data-masset="diary">日记</span>
        </div>
        <div class="bz-vault-mbody" data-mob-body></div>
      </div>`;
          this.popup.style.display = "none";
          const desk = this.popup.querySelector(".bz-vault-desk");
          this.desk = {
            nav: desk.querySelector(".bz-vault-nav"),
            area: desk.querySelector(".bz-vault-pane"),
            list: desk.querySelector("[data-vault-list]"),
            detail: desk.querySelector("[data-vault-detail]"),
            count: desk.querySelector('[data-cnt="overview"]')
          };
          const mob = this.popup.querySelector(".bz-vault-mob");
          this.mob = {
            body: mob.querySelector("[data-mob-body]"),
            search: mob.querySelector("[data-mob-search]"),
            seg: mob.querySelector("[data-mob-seg]")
          };
          this.listContainer = this.desk.list;
          document.body.appendChild(this.mask);
          document.body.appendChild(this.popup);
          const ov = createOverlay({ maskId: "bz-encrypt-preview-mask", popupId: "bz-encrypt-preview-popup", maxWidth: 640, onMaskClick: () => this.closePreview() });
          this.previewMask = ov.mask;
          this.previewPopup = ov.popup;
          document.body.appendChild(this.previewMask);
          document.body.appendChild(this.previewPopup);
          this.bindVaultShell();
          this.registerEscape();
          mountIcons(this.popup);
          this._unlockOff = onDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
            if (evt && evt.unlocked === false) this.onExternalLock();
          });
          this._initialized = true;
        }
        /** 统一骨架交互：资产导航 / 顶栏动作 / 搜索防抖 / 移动端 seg */
        bindVaultShell() {
          var _a, _b, _c;
          const setAsset = (a) => {
            if (a === "pw") a = "note";
            this.asset = a;
            lastVisitedAsset = a;
            this.searchKw = "";
            const headSearch = this.deskSearch;
            if (headSearch) headSearch.value = "";
            this.mob.search.value = "";
            motionArmSwitch();
            this.renderAll();
          };
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-asset") || "overview"));
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-masset") || "overview"));
          });
          (_a = this.popup.querySelector('[data-act="lock"]')) == null ? void 0 : _a.addEventListener("click", () => this.lockNow());
          (_b = this.popup.querySelector('[data-act="mob-close"]')) == null ? void 0 : _b.addEventListener("click", () => this.hide());
          this.popup.addEventListener("contextmenu", (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.closest(".bz-vault-row, .bz-pwv-plrow, .bz-pwv-acctcard, .bz-pwv-mobcard, .bz-item-menu, input, textarea, button")) return;
            e.preventDefault();
            this.openPanelMenu(e.clientX, e.clientY);
          });
          (_c = this.popup.querySelector('[data-act="health-card"]')) == null ? void 0 : _c.addEventListener("click", () => void this.openHealthDialog());
          this.popup.addEventListener("keydown", (e) => {
            var _a2, _b2;
            if (e.key !== "Enter" && e.key !== " ") return;
            if (e.isComposing || e.defaultPrevented) return;
            const t = e.target;
            const btn = (_a2 = t == null ? void 0 : t.closest) == null ? void 0 : _a2.call(t, '[role="button"]');
            if (!btn || !this.popup.contains(btn)) return;
            e.preventDefault();
            btn.click();
            if (btn.classList.contains("bz-vault-row")) {
              (_b2 = this.popup.querySelector(".bz-vault-row.on")) == null ? void 0 : _b2.focus();
            }
          });
          this.bindSearchInput(this.mob.search, true);
          this.mask.addEventListener("click", () => {
            if (this.mask.style.display === "block") this.hide();
          });
          this._idleBump = () => this.bumpIdleLock();
          document.addEventListener("pointerdown", this._idleBump, true);
          document.addEventListener("keydown", this._idleBump, true);
        }
        /** 全局监听摘除（cleanup 专用）：document 空闲 bump + 域事件订阅均不随 DOM 摘除自动回收 */
        detachGlobalListeners() {
          if (this._idleBump) {
            document.removeEventListener("pointerdown", this._idleBump, true);
            document.removeEventListener("keydown", this._idleBump, true);
            this._idleBump = null;
          }
          if (this._unlockOff) {
            this._unlockOff();
            this._unlockOff = null;
          }
        }
        /**
         * 搜索输入绑定（桌面列表头框 / 移动端常驻框共用一条语义）。
         * 桌面框随列表头重建，故每次渲染都要重挂一次——抽成方法避免两处逻辑漂移。
         * 效率整改 3：ESC 有词清词（stopPropagation 截断 escManager 关面板链，安全模式不误上锁）、
         * 无词放行；尾部 ✕ 一键清除（对齐 clipbook「ESC 清词 + ✕」定稿范式）。
         * @param isMob 输入源是移动端框：决定把关键词同步到哪一侧（桌面框是动态的，现取）
         */
        bindSearchInput(input, isMob) {
          var _a, _b;
          input.addEventListener("input", () => {
            const v = input.value.trim();
            if (this.asset === "overview" && v) {
              this.asset = "note";
              lastVisitedAsset = "note";
            }
            this.searchKw = v;
            if (isMob) {
              const deskSearch = this.deskSearch;
              if (deskSearch) deskSearch.value = v;
            } else {
              this.mob.search.value = v;
            }
            this.syncSearchClear();
            motionArmSearch();
            this.searchDebounced();
          });
          input.addEventListener("keydown", (e) => {
            if (e.key !== "Escape" || !input.value.trim()) return;
            e.preventDefault();
            e.stopPropagation();
            this.clearSearchKw();
            input.focus();
          });
          (_b = (_a = input.parentElement) == null ? void 0 : _a.querySelector("[data-search-clear]")) == null ? void 0 : _b.addEventListener("click", () => {
            this.clearSearchKw();
            input.focus();
          });
        }
        /** ✕ 显隐同步（有词才显示；两框词互同步后一起刷，clipbook syncDeskSearchClear 同款） */
        syncSearchClear() {
          var _a, _b;
          const v = !!this.searchKw || !!this.mob.search.value.trim() || !!((_a = this.deskSearch) == null ? void 0 : _a.value.trim());
          for (const box of [(_b = this.deskSearch) == null ? void 0 : _b.parentElement, this.mob.search.parentElement]) {
            const btn = box == null ? void 0 : box.querySelector("[data-search-clear]");
            if (btn) btn.hidden = !v;
          }
        }
        /** 清词统一出口（ESC / ✕ 共用）：两框同清 + 立即重绘（不走防抖） */
        clearSearchKw() {
          this.searchKw = "";
          const deskSearch = this.deskSearch;
          if (deskSearch) deskSearch.value = "";
          this.mob.search.value = "";
          this.syncSearchClear();
          motionArmSearch();
          this.renderAll();
        }
        createMask(id) {
          const mask = document.createElement("div");
          mask.id = id;
          mask.className = "bz-overlay-mask";
          mask.style.display = "none";
          return mask;
        }
        createPopup(id) {
          const popup = document.createElement("div");
          popup.id = id;
          popup.className = "bz-overlay-popup";
          popup.style.display = "none";
          return popup;
        }
        // ---------- 显示/隐藏 ----------
        show() {
          if (!this._initialized) this.ensureElements();
          topifyZ(this.mask, this.popup);
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          if (!isMobileEnv() && !this.panelResizeDetach && this.popup) {
            this.panelResizeDetach = uiResizable(this.popup, {
              minW: PANEL.MIN_W,
              minH: PANEL.MIN_H,
              maxW: PANEL.MAX_W,
              maxH: PANEL.MAX_H,
              persist: panelSizePersist("encryptPanelWidth", "encryptPanelHeight", PANEL.MIN_W, PANEL.MIN_H)
            });
          }
          motionArmBoot();
          motionPanelIn(this.popup);
          trapPanelFocus(this.popup);
          this.notifyUnlockUi();
          void this.renderList();
          this.startSessionTimers();
        }
        hide(suppressAutoLockNotice = false) {
          var _a;
          this.closePreview();
          this.closeAllDialogs();
          if (this.popup && this.popup.style.display === "flex") motionPanelCollapse(this.popup);
          (_a = this.panelResizeDetach) == null ? void 0 : _a.detach();
          this.panelResizeDetach = null;
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
          this.stopSessionTimers();
          if (this.isSecurityMode()) {
            if (this.dataManager.unlocked) this.captureLockStats();
            this.dataManager.lock();
            this.pwDataManager.lock();
            this._selNoteId = null;
            this._diaryPlain = {};
            if (!suppressAutoLockNotice) this.noticeAutoLock();
          }
        }
        /** 安全模式双口径（config 快照可能落后于设置实时值：单读 config 会漏，历史双键 OR） */
        isSecurityMode() {
          var _a;
          return !!this.config.securityMode || !!((_a = tryGetSettings()) == null ? void 0 : _a.securityMode);
        }
        // ---------- 解锁会话可见性（已解锁时长 + 安全模式无交互自动上锁） ----------
        /** 面板可见期间：每秒刷新「已解锁时长」+ 布防无交互自动上锁 */
        startSessionTimers() {
          this.stopSessionTimers();
          if (!this.dataManager.unlocked) return;
          if (this.unlockedAt === null) this.unlockedAt = Date.now();
          this.updateUnlockDuration();
          this.sessionTimer = setInterval(() => this.updateUnlockDuration(), 1e3);
          this.bumpIdleLock();
        }
        /** 停会话计时（时长刷新 + 无交互自动上锁；hide/上锁/卸载共用） */
        stopSessionTimers() {
          if (this.sessionTimer !== null) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
          }
          this.clearIdleLock();
        }
        /** 左栏「立即上锁」旁的已解锁时长（mm:ss，超 1 小时 h:mm:ss） */
        updateUnlockDuration() {
          var _a;
          const el = (_a = this.popup) == null ? void 0 : _a.querySelector("[data-unlock-dur]");
          if (!el) return;
          if (!this.dataManager.unlocked || this.unlockedAt === null) {
            el.textContent = "";
            return;
          }
          const s = Math.max(0, Math.floor((Date.now() - this.unlockedAt) / 1e3));
          const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
          const ss = String(s % 60).padStart(2, "0");
          const h = Math.floor(s / 3600);
          el.textContent = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
          el.title = "已解锁时长";
        }
        bumpIdleLock() {
          this.clearIdleLock();
          if (!this.isSecurityMode() || !this.dataManager.unlocked) return;
          if (!this.rootVisible()) return;
          this.idleLockTimer = setTimeout(() => {
            this.idleLockTimer = null;
            if (!this.isSecurityMode() || !this.dataManager.unlocked || !this.rootVisible()) return;
            notice("安全模式：15 分钟无操作，已自动上锁");
            this.lockNow(true);
          }, _UIManager.IDLE_LOCK_MS);
        }
        clearIdleLock() {
          if (this.idleLockTimer !== null) {
            clearTimeout(this.idleLockTimer);
            this.idleLockTimer = null;
          }
        }
        noticeAutoLock() {
          notice("安全模式：已自动上锁");
        }
        // ---------- 体检弹窗 ----------
        /**
         * 体检（用户拍板：右上角 🩺 按钮替换原清理扫把，先报告后勾选清理）。
         * 体检需解锁（对账依赖清单明文，完整性检测需解密）——未解锁先弹主密码，取消则不进入。
         * 可清理类（失效条目/孤儿密文）默认不全选、勾选后二次确认才删（ticket 18）；损坏/缺失类只展示不清理（删了就是真丢数据）。
         * 清理后自动重新体检，报告收敛。
         */
        async openHealthDialog() {
          if (!this.dataManager.unlocked) {
            const ok = await this.showPasswordDialog();
            if (!ok) return;
          }
          if (!this.healthMask) this.ensureHealthElements();
          topifyZ(this.healthMask, this.healthPopup);
          this.healthMask.style.display = "flex";
          this.healthPopup.style.display = "flex";
          motionHealthIn(this.healthPopup);
          void this.runHealthScan();
        }
        ensureHealthElements() {
          const mask = document.createElement("div");
          mask.id = "bz-encrypt-health-mask";
          mask.className = "bz-overlay-mask bz-encrypt-health-mask";
          mask.style.display = "none";
          const popup = document.createElement("div");
          popup.id = "bz-encrypt-health-popup";
          popup.className = "bz-encrypt-health-box";
          popup.style.display = "none";
          const head = document.createElement("div");
          head.className = "bz-encrypt-health-head";
          const title = document.createElement("h4");
          title.textContent = "保险库体检";
          head.appendChild(title);
          popup.appendChild(head);
          const body = document.createElement("div");
          body.id = "bz-encrypt-health-body";
          body.className = "bz-encrypt-health-body";
          popup.appendChild(body);
          const foot = document.createElement("div");
          foot.className = "bz-encrypt-health-foot";
          const cleanBtn = document.createElement("button");
          cleanBtn.id = "bz-encrypt-health-clean";
          cleanBtn.className = "bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary";
          cleanBtn.textContent = "清理勾选项 (0)";
          cleanBtn.onclick = () => void this.confirmHealthCleanup();
          const rescanBtn = document.createElement("button");
          rescanBtn.className = "bz-encrypt-dialog-btn";
          rescanBtn.id = "bz-encrypt-health-rescan";
          rescanBtn.textContent = "重新体检";
          rescanBtn.onclick = () => void this.runHealthScan();
          foot.appendChild(cleanBtn);
          foot.appendChild(rescanBtn);
          popup.appendChild(foot);
          mask.appendChild(popup);
          document.body.appendChild(mask);
          mask.onclick = (e) => {
            if (e.target === mask) this.hideHealthDialog();
          };
          escManager.register("encrypt-health", {
            isVisible: () => !!(this.healthMask && this.healthMask.style.display === "flex"),
            close: () => this.hideHealthDialog()
          });
          this.healthMask = mask;
          this.healthPopup = popup;
        }
        hideHealthDialog() {
          if (this.healthMask) this.healthMask.style.display = "none";
          if (this.healthPopup) this.healthPopup.style.display = "none";
        }
        /** 体检执行：动态显示（用户拍板）——扫描是长任务（逐镜像 PBKDF2），
         *  顶部实时进度（计数 + 当前对象），发现的问题即时追加，扫完再整理成完整勾选报告。 */
        async runHealthScan() {
          if (!this.healthPopup) return;
          const body = this.healthPopup.querySelector("#bz-encrypt-health-body");
          if (!body) return;
          if (this._scanning) return;
          this._scanning = true;
          try {
            if (!this.dataManager.unlocked) {
              body.innerHTML = "";
              const locked = document.createElement("div");
              locked.className = "bz-encrypt-health-summary";
              locked.textContent = "保险库已上锁，无法体检";
              body.appendChild(locked);
              this.setHealthButtonsDisabled(true);
              return;
            }
            this.setHealthButtonsDisabled(true);
            body.innerHTML = "";
            const progress = document.createElement("div");
            progress.className = "bz-encrypt-health-progress";
            progress.textContent = "体检中…";
            const bar = uiProgress({ value: 0 });
            bar.el.classList.add("bz-encrypt-health-bar");
            body.appendChild(progress);
            body.appendChild(bar.el);
            const live2 = document.createElement("div");
            live2.className = "bz-encrypt-health-live";
            const liveTitle = document.createElement("div");
            liveTitle.className = "bz-encrypt-health-section-title";
            liveTitle.textContent = "发现的异常";
            live2.appendChild(liveTitle);
            body.appendChild(live2);
            motionScanStart(this.healthPopup);
            try {
              const report = await this.dataManager.scanHealth((p) => {
                progress.textContent = `检查中 ${p.done}/${p.total} · ${truncateName(p.current)}`;
                bar.setValue(Math.round(p.done / p.total * 100));
                for (const item of p.found) {
                  const row = document.createElement("div");
                  row.className = "bz-encrypt-health-item " + (item.cat === "corrupted-body" || item.cat === "corrupted-attachment" ? "bz-encrypt-health-item--bad" : item.cat === "missing-attachment" ? "bz-encrypt-health-item--warn" : "");
                  row.textContent = item.label;
                  live2.appendChild(row);
                  motionFindRowIn(row);
                }
              });
              this.lastHealth = { issues: report.items.length, lastChecked: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", { hour12: false }) };
              this.renderHealthReport(report, body);
              motionReportIn(body);
              this.renderNav();
            } catch (e) {
              body.innerHTML = "";
              const err = document.createElement("div");
              err.textContent = "体检失败：" + e.message;
              body.appendChild(err);
            }
            this.setHealthButtonsDisabled(false);
            motionScanStop(this.healthPopup);
          } finally {
            this._scanning = false;
          }
        }
        /** 体检窗底部两按钮（清理/重扫）禁用态：扫描中与锁定态防重入（true=禁用） */
        setHealthButtonsDisabled(disabled) {
          if (!this.healthPopup) return;
          const clean = this.healthPopup.querySelector("#bz-encrypt-health-clean");
          const rescan = this.healthPopup.querySelector("#bz-encrypt-health-rescan");
          if (clean) clean.disabled = disabled;
          if (rescan) rescan.disabled = disabled;
        }
        /** 渲染体检报告（UI 保证解锁后调用，integrityChecked 恒 true）：可清理类默认不全选；损坏/缺失只展示 */
        renderHealthReport(report, body) {
          body.innerHTML = "";
          const cleanable = report.items.filter((i) => i.cat === "dead-entry" || i.cat === "orphan-file");
          const bad = report.items.filter((i) => i.cat === "corrupted-body" || i.cat === "corrupted-attachment");
          const missing = report.items.filter((i) => i.cat === "missing-attachment");
          const summary = document.createElement("div");
          summary.className = "bz-encrypt-health-summary";
          summary.textContent = "体检完成：" + report.items.length + " 个问题";
          body.appendChild(summary);
          this.appendCleanableSection(body, cleanable);
          if (bad.length) {
            const sec = document.createElement("div");
            sec.className = "bz-encrypt-health-section bz-encrypt-health-section--bad";
            const t = document.createElement("div");
            t.className = "bz-encrypt-health-section-title";
            t.textContent = "损坏镜像（" + bad.length + "）——不可清理，请从备份恢复后重试还原";
            sec.appendChild(t);
            for (const item of bad) {
              const row = document.createElement("div");
              row.className = "bz-encrypt-health-item bz-encrypt-health-item--bad";
              row.textContent = item.label;
              row.title = "损坏的密文镜像，删除即丢失数据";
              sec.appendChild(row);
            }
            body.appendChild(sec);
          }
          if (missing.length) {
            const sec = document.createElement("div");
            sec.className = "bz-encrypt-health-section";
            const t = document.createElement("div");
            t.className = "bz-encrypt-health-section-title";
            t.textContent = "附件镜像缺失（" + missing.length + "）——还原时该附件将不可用";
            sec.appendChild(t);
            for (const item of missing) {
              const row = document.createElement("div");
              row.className = "bz-encrypt-health-item bz-encrypt-health-item--warn";
              row.textContent = item.label;
              sec.appendChild(row);
            }
            body.appendChild(sec);
          }
          if (!bad.length && !missing.length) {
            const ok = document.createElement("div");
            ok.className = "bz-encrypt-health-hint";
            ok.textContent = "全部镜像完整（解密+指纹校验通过）";
            body.appendChild(ok);
          }
          this.updateHealthCleanCount();
        }
        /** 可清理区块：失效条目 + 孤儿密文（checkbox 默认不全选，勾选才计入清理） */
        appendCleanableSection(body, items) {
          const sec = document.createElement("div");
          sec.className = "bz-encrypt-health-section bz-encrypt-health-section--clean";
          const t = document.createElement("div");
          t.className = "bz-encrypt-health-section-title";
          const dead = items.filter((i) => i.cat === "dead-entry").length;
          const orphan = items.filter((i) => i.cat === "orphan-file").length;
          t.textContent = items.length ? "可清理（" + items.length + "）：" + dead + " 个失效条目、" + orphan + " 个孤儿密文" : "可清理：无";
          sec.appendChild(t);
          for (const item of items) {
            const row = document.createElement("label");
            row.className = "bz-encrypt-health-item";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.className = "bz-encrypt-health-check";
            box.value = item.key;
            box.checked = false;
            box.addEventListener("change", () => this.updateHealthCleanCount());
            row.appendChild(box);
            row.appendChild(document.createTextNode(item.label));
            sec.appendChild(row);
          }
          body.appendChild(sec);
        }
        updateHealthCleanCount() {
          const btn = document.getElementById("bz-encrypt-health-clean");
          if (!btn) return;
          btn.textContent = "清理勾选项 (" + this.collectCheckedKeys().length + ")";
        }
        collectCheckedKeys() {
          const popup = this.healthPopup;
          if (!popup) return [];
          return [...popup.querySelectorAll("input.bz-encrypt-health-check:checked")].map((i) => i.value);
        }
        /**
         * 清理勾选项（ticket 18）：执行前二次确认——写明将永久删除的数量（失效条目含残余附件镜像、
         * 孤儿密文），确认后才执行；只处理可清理类（resolveHealth 对损坏/缺失类防御性忽略），
         * 完成后自动重新体检。
         */
        async confirmHealthCleanup() {
          const keys = this.collectCheckedKeys();
          if (!keys.length) {
            notice("未勾选任何可清理项");
            return;
          }
          const dead = keys.filter((k) => k.startsWith("entry:")).length;
          const orphan = keys.filter((k) => k.startsWith("file:")).length;
          const parts = [];
          if (dead > 0) parts.push(dead + " 条失效条目（含残余附件镜像）");
          if (orphan > 0) parts.push(orphan + " 个孤儿密文");
          void openFlowDialog({
            title: "清理确认",
            message: parts.join("、") + "将永久删除，不可恢复",
            actions: [
              { label: "取消", value: "cancel" },
              // danger（issue 291 评审补）：永久删除密文/失效条目，主按钮不得高亮（手册 §9/§10）
              { label: "永久删除", value: "ok", cta: true, danger: true }
            ]
          }).then((v) => {
            if (v === "ok") void this.executeHealthCleanup(keys);
          });
        }
        /** 执行清理（二次确认通过后）：resolveHealth 只处理可清理类，完成后自动重新体检 */
        async executeHealthCleanup(keys) {
          try {
            const { notes, files } = await this.dataManager.resolveHealth(keys);
            const parts = [];
            if (notes > 0) parts.push(notes + " 个失效条目");
            if (files > 0) parts.push(files + " 个孤儿密文");
            notice(parts.length ? "已清理：" + parts.join("、") : "已清理所选项", "success");
            void this.renderList();
            void this.runHealthScan();
          } catch (e) {
            notifyActionError(e, "清理");
          }
        }
        // ---------- 解锁弹窗 ----------
        /**
         * 解锁弹窗：三域共用解锁屏骨架（core/ui/lock-screen，ADR-0124），文案与统计按域注入。
         * 行内报错走 rejectInput（行内 + 通知双通道）；挂 body 弹层自声明 ESC 层（兜底链）。
         */
        /** 解锁输入类失败：行内报错 + 通知双通道（原型为行内报错，插件既有语义保留通知） */
        rejectInput(msg, setErr, tone) {
          setErr(msg);
          notice(msg, tone || void 0);
        }
        /** 面板空白处右键菜单：设置入口（顶栏按原型去掉了设置按钮，收在这里） */
        openPanelMenu(x, y) {
          const actions = [
            { icon: "settings", label: "保险库设置", onClick: () => this.openSettings() },
            { icon: "stethoscope", label: "保险库体检", onClick: () => void this.openHealthDialog() },
            // 修改主密码（ADR-0211）：未解锁不进（菜单本身只在解锁态面板内可达）；迁移中数据层拒绝并提示
            { icon: "key-round", label: "修改主密码", onClick: () => this.openChangePassword() }
          ];
          openItemMenu(x, y, actions, true, "bz-vault-menu");
        }
        /** 解锁屏：三域共用骨架（core/ui/lock-screen），文案与统计按域注入。
         *  N11 单例守卫：已有解锁屏在进行中 → 复用同一 Promise（快速双触发不再连开两层）。 */
        async showPasswordDialog(kind = "vault") {
          if (activeUnlock) {
            if (activeUnlock.el && !activeUnlock.el.isConnected) activeUnlock = null;
            else return activeUnlock.promise;
          }
          let resolveFn;
          let cancelled = false;
          const promise = new Promise((resolve) => {
            resolveFn = resolve;
          });
          activeUnlock = {
            el: null,
            promise,
            cancel: () => {
              cancelled = true;
              if ((activeUnlock == null ? void 0 : activeUnlock.promise) === promise) activeUnlock = null;
              resolveFn(false);
            }
          };
          try {
            return await this.openUnlockScreen(kind, promise, resolveFn, () => cancelled);
          } catch (e) {
            if ((activeUnlock == null ? void 0 : activeUnlock.promise) === promise) activeUnlock = null;
            throw e;
          }
        }
        /** 实际构建解锁屏（单例登记在 showPasswordDialog，唯一收场出口为 done()） */
        async openUnlockScreen(kind, promise, resolveFn, isCancelled) {
          const exists = await this.dataManager.exists();
          const meta = LOCK_KIND_META[kind];
          const stats = this.lockStatsCache[kind] || await readLockStats(kind) || meta.stats.map((s) => ({ ...s, num: "—" }));
          if (isCancelled()) return promise;
          const ls = uiLockScreen({
            kind,
            icon: meta.icon,
            title: exists ? meta.title : "设置主密码",
            sub: exists ? meta.sub : "请设置一个主密码（用于加密所有数据）",
            stats,
            action: exists ? meta.action : "设置并解锁",
            firstSetup: !exists,
            warningHtml: `${vIc("triangle-alert", 14)} <strong>重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，库内笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。`,
            ackText: "我已了解：主密码无法找回，遗忘将导致密文永久无法恢复",
            secText: exists ? "主密码不会存储 · 遗忘将无法恢复密文" : "",
            secTone: "warn",
            hint: exists ? "" : "建议使用密码本保存此密码",
            // 脸谱封面给一颗看得见的退出口（issue 506）：取消 = 不开面板 / 不展示任何数据（ADR-0194 决策 3）
            cancel: kind === "people" ? "取消" : void 0
          });
          topifyZ(ls.el);
          document.body.appendChild(ls.el);
          mountIcons(ls.el);
          motionLockScreenIn(ls.el);
          const esc2 = escManager.register("bz-vault-unlock", {
            isVisible: () => ls.el.isConnected,
            close: () => done(false)
          });
          const done = (ok) => {
            if (activeUnlock && activeUnlock.promise === promise) activeUnlock = null;
            esc2.unregister();
            ls.close();
            resolveFn(ok);
          };
          const setErr = (m) => {
            ls.setError(m);
            setTimeout(() => {
              if (ls.input.value) ls.setError("");
            }, 2600);
          };
          if (ls.cancelBtn) ls.cancelBtn.onclick = () => done(false);
          ls.actionBtn.onclick = async () => {
            const pw = ls.input.value;
            if (!pw) {
              this.rejectInput("请输入密码", setErr);
              return;
            }
            if (!exists) {
              if (ls.input2.style.display === "none") {
                ls.showSecondInput(true);
                ls.input2.value = "";
                ls.setMessage("请再次输入主密码确认");
                ls.focus();
                return;
              }
              if (pw !== ls.input2.value) {
                this.rejectInput("两次密码不一致", setErr);
                return;
              }
              if (pw.length < 4) {
                this.rejectInput("主密码至少 4 位", setErr);
                return;
              }
              if (!ls.ackBox || !ls.ackBox.checked) {
                this.rejectInput("请先勾选风险确认", setErr);
                return;
              }
              ls.setBusy(true);
              try {
                const ok = await this.dataManager.unlock(pw);
                if (ok) {
                  motionUnlockBurst(ls.el.querySelector('[data-ls="seal"]'));
                  done(true);
                  notice("密码已设置，数据已加密", "success");
                } else {
                  notice("设置失败：无法写入清单，请检查磁盘空间后重试", "error");
                  done(false);
                }
              } catch (e) {
                ls.setBusy(false);
                notifyActionError(e, "设置主密码");
                done(false);
              }
              return;
            }
            const remainMs = this.unlockCooldownUntil - Date.now();
            if (remainMs > 0) {
              this.rejectInput(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1e3)} 秒`, setErr, "warning");
              return;
            }
            ls.setBusy(true);
            try {
              const success = await this.dataManager.unlock(pw);
              if (success) {
                this.resetUnlockThrottle();
                motionUnlockBurst(ls.el.querySelector('[data-ls="seal"]'));
                this.captureLockStats();
                done(true);
                const healMsg = this.dataManager.selfHealRolledBack > 0 ? "；上次未完成的加密已自动回滚，原文未动" : "";
                notice("解锁成功" + healMsg, "success");
              } else {
                const issue = this.dataManager.manifestIssue;
                if (issue === "empty" || issue === "corrupt") {
                  ls.setBusy(false);
                  void openFlowDialog({
                    title: "清单疑似损坏",
                    message: "保险库清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？",
                    actions: [
                      { label: "暂不重设", value: "cancel" },
                      // danger（issue 291 评审补）：与 password-vault 同名同义的另一份实现——重设会生成
                      // 全新空清单、旧加密数据永久无法恢复，破坏性主动作不得高亮（手册 §9/§10）。
                      { label: "仍要重设", value: "ok", cta: true, danger: true }
                    ]
                  }).then((v) => {
                    if (v === "ok") {
                      void this.dataManager.unlock(pw, true).then((ok) => {
                        if (ok) {
                          this.resetUnlockThrottle();
                          motionUnlockBurst(ls.el.querySelector('[data-ls="seal"]'));
                          done(true);
                          notice("已重设主密码（旧数据不可恢复）", "warning");
                        } else {
                          this.rejectInput("重设失败：无法写入清单", setErr, "error");
                        }
                      });
                    } else {
                      notice("未重设：请先检查或备份数据文件", "warning");
                    }
                  });
                } else {
                  ls.setBusy(false);
                  const delaySec = this.registerUnlockFailure();
                  motionRejectShake(ls.el);
                  this.rejectInput(`密码错误，${delaySec} 秒后可重试`, setErr, "error");
                  ls.input.value = "";
                  ls.focus();
                }
              }
            } catch (e) {
              ls.setBusy(false);
              notifyActionError(e, "解锁");
            }
          };
          ls.el.addEventListener("click", (e) => {
            if (e.target === ls.el) done(false);
          });
          ls.focus();
          setTimeout(() => ls.focus(), 150);
          activeUnlock = { el: ls.el, promise, cancel: () => done(false) };
          return promise;
        }
        /**
         * 修改主密码入口（面板右键菜单 / 命令）：信封结构下只重包清单内的密钥并重加密清单，
         * 数据镜像零接触（ADR-0211）。两屏接力复用解锁屏骨架——屏1 验证当前主密码
         * （同销毁确认语汇），屏2 双输入设置新密码（首设同款确认）。
         */
        openChangePassword() {
          var _a, _b;
          if ((_b = (_a = this.activeChangePw) == null ? void 0 : _a.el) == null ? void 0 : _b.isConnected) return;
          if (!this.dataManager.unlocked) return;
          this.activeChangePw = null;
          this.openChangePwVerify();
        }
        /** 改密屏共通壳：挂 body + 动效入场 + ESC/点遮罩收场；返回收场函数（重入防抖句柄同清） */
        mountChangePwScreen(ls) {
          topifyZ(ls.el);
          document.body.appendChild(ls.el);
          mountIcons(ls.el);
          motionLockScreenIn(ls.el);
          const done = () => {
            this.activeChangePw = null;
            esc2.unregister();
            ls.close();
          };
          const esc2 = escManager.register("bz-vault-changepw", {
            isVisible: () => ls.el.isConnected,
            close: () => done()
          });
          if (ls.cancelBtn) ls.cancelBtn.onclick = () => done();
          ls.el.addEventListener("click", (e) => {
            if (e.target === ls.el) done();
          });
          ls.focus();
          setTimeout(() => ls.focus(), 150);
          this.activeChangePw = { el: ls.el };
          return done;
        }
        /** 屏1：验证当前主密码（只读 verifyPassword，不触解锁态；同销毁确认「重验封印」语汇） */
        openChangePwVerify() {
          const ls = uiLockScreen({
            kind: "vault",
            icon: "key-round",
            title: "修改主密码",
            sub: "请先验证当前主密码",
            action: "验证",
            placeholder: "当前主密码",
            secText: "修改只重加密清单 · 数据文件保持不变",
            secTone: "ok",
            cancel: "取消"
          });
          const done = this.mountChangePwScreen(ls);
          const setErr = (m) => {
            ls.setError(m);
            setTimeout(() => {
              if (ls.input.value) ls.setError("");
            }, 2600);
          };
          ls.actionBtn.onclick = async () => {
            const pw = ls.input.value;
            if (!pw) {
              this.rejectInput("请输入当前主密码", setErr);
              return;
            }
            ls.setBusy(true);
            try {
              if (await this.dataManager.verifyPassword(pw)) {
                if (!ls.el.isConnected) return;
                done();
                this.openChangePwNew(pw);
              } else {
                if (!ls.el.isConnected) return;
                ls.setBusy(false);
                this.rejectInput("当前主密码不正确", setErr, "error");
                ls.input.value = "";
                ls.focus();
              }
            } catch (e) {
              if (!ls.el.isConnected) return;
              ls.setBusy(false);
              notifyActionError(e, "验证主密码");
            }
          };
        }
        /** 屏2：设置新主密码（双输入 + 牢记勾选，首设同款确认）→ changePassword */
        openChangePwNew(currentPw) {
          const ls = uiLockScreen({
            kind: "vault",
            icon: "key-round",
            title: "设置新主密码",
            sub: "新主密码加密整库清单；各文件密钥随清单保存，数据文件不动",
            action: "修改密码",
            firstSetup: true,
            placeholder: "新主密码",
            warningHtml: `${vIc("triangle-alert", 14)} <strong>重要提醒</strong><br>• 新主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘新密码，保险库将无法解锁。`,
            ackText: "我已牢记新主密码：遗忘将无法解锁保险库",
            secText: "只重加密清单 · 亚秒级完成 · 数据文件不变",
            secTone: "ok",
            cancel: "取消"
          });
          const done = this.mountChangePwScreen(ls);
          const setErr = (m) => {
            ls.setError(m);
            setTimeout(() => {
              if (ls.input.value) ls.setError("");
            }, 2600);
          };
          ls.actionBtn.onclick = async () => {
            var _a;
            const pw = ls.input.value;
            if (!pw) {
              this.rejectInput("请输入新主密码", setErr);
              return;
            }
            if (pw !== ls.input2.value) {
              this.rejectInput("两次密码不一致", setErr);
              return;
            }
            if (pw.length < 4) {
              this.rejectInput("主密码至少 4 位", setErr);
              return;
            }
            if (pw === currentPw) {
              this.rejectInput("新密码不能与当前密码相同", setErr);
              return;
            }
            if (!((_a = ls.ackBox) == null ? void 0 : _a.checked)) {
              this.rejectInput("请先勾选确认", setErr);
              return;
            }
            ls.setBusy(true);
            try {
              const ok = await this.dataManager.changePassword(currentPw, pw);
              if (!ls.el.isConnected) return;
              if (ok) {
                motionUnlockBurst(ls.el.querySelector('[data-ls="seal"]'));
                done();
                notice("主密码已修改，数据文件未变动", "success");
              } else {
                ls.setBusy(false);
                this.rejectInput("当前主密码不正确，未修改", setErr, "error");
                ls.input.value = "";
                ls.focus();
              }
            } catch (e) {
              if (!ls.el.isConnected) return;
              ls.setBusy(false);
              notifyActionError(e, "修改主密码");
            }
          };
        }
        /** show/解锁/外部变更/资产切换统一入口：加载 → 全量重绘 */
        async renderList() {
          if (!this.listContainer) return;
          if (this.dataManager.unlocked) {
            if (!this._pwLoadedSinceUnlock) {
              this._pwLoadedSinceUnlock = true;
              try {
                await this.pwDataManager.load();
              } catch (e) {
              }
            }
          } else {
            this._pwLoadedSinceUnlock = false;
          }
          this.renderAll();
        }
        /** 全量重绘：导航计数 + 概览/资产内容 + 移动端 + 健康卡 + 顶栏标题 */
        renderAll() {
          if (!this.rootVisible()) return;
          this.renderNav();
          this.renderDesktop();
          this.renderMobile();
          if (this.popup) motionRendered(this.popup);
        }
        /** 列表头搜索框聚焦（openManager 渲染收口后补挂；无列表头/面板未显示时静默） */
        focusListSearch() {
          const search = this.deskSearch;
          if (!search) return;
          try {
            search.focus({ preventScroll: true });
          } catch (e) {
            search.focus();
          }
        }
        rootVisible() {
          return !!(this.popup && this.popup.style.display === "flex");
        }
        /** 资产计数 + 导航高亮 */
        counts() {
          const notes = this.dataManager.manifest.notes;
          return {
            note: notes.filter((n) => n.kind !== "diary-entry" && n.kind !== "password-vault" && n.kind !== "people").length,
            diary: notes.filter((n) => n.kind === "diary-entry").length
          };
        }
        /**
         * 快照解锁屏统计项（四域各一份）。
         * 清单本身是密文，锁定态无法读计数 —— 故只在解锁期间快照，供下次上锁后的解锁屏显示；
         * 快照同时写明文档 lock-stats.json（core/lock-stats），冷启动回落上次快照而非「—」。
         */
        /**
         * 卸载前统计快照兜底（issue 492）：直接关 Obsidian / 重载插件不走 lockNow——解锁态下本次
         * 会话的统计从未落盘，下次解锁屏（含 482 的 people 档）冷启动只能回落旧值或「—」。
         * T12 同款守卫：仅解锁态补拍（锁定态清单已清，拍了也是零值）。
         */
        captureForUnload() {
          if (this.dataManager.unlocked) this.captureLockStats();
        }
        captureLockStats() {
          var _a;
          try {
            const all = ((_a = this.dataManager.manifest) == null ? void 0 : _a.notes) || [];
            const kb = (b) => b > 0 ? (b / 1024).toFixed(1) + " KB" : "—";
            const stat = (list, labels) => {
              const atts = list.reduce((s, n) => s + n.attachments.length, 0);
              const bytes = list.reduce((s, n) => s + n.attachments.reduce((b, a) => b + (a.blobSize || 0), 0), 0);
              return [{ num: String(list.length), label: labels[0] }, { num: String(atts), label: labels[1] }, { num: kb(bytes), label: labels[2] }];
            };
            this.lockStatsCache.vault = stat(
              all.filter((n) => n.kind !== "diary-entry" && n.kind !== "password-vault" && n.kind !== "people"),
              ["笔记条目", "随库附件", "附件密文"]
            );
            this.lockStatsCache.diary = stat(
              all.filter((n) => n.kind === "diary-entry"),
              ["加密条目", "随库附件", "附件密文"]
            );
            this.lockStatsCache.people = stat(
              all.filter((n) => n.kind === "people"),
              ["联系人", "随记录附件", "附件密文"]
            );
            const plats = this.pwDataManager.platforms();
            this.lockStatsCache["password-vault"] = [
              { num: String(plats.length), label: "平台" },
              { num: String(this.pwDataManager.pwData.length), label: "口令条目" },
              { num: String(plats.filter((p) => this.pwDataManager.hasFav(p.platform)).length), label: "收藏" }
            ];
            for (const k of ["vault", "diary", "password-vault", "people"]) {
              void writeLockStats(k, this.lockStatsCache[k]).catch(() => {
              });
            }
          } catch (e) {
          }
        }
        renderNav() {
          const c = this.counts();
          const setCnt = (a, v) => {
            const el = this.popup.querySelector(`[data-cnt="${a}"]`);
            if (el) el.textContent = String(v);
          };
          setCnt("overview", c.note + c.diary);
          setCnt("note", c.note);
          setCnt("diary", c.diary);
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            const on = el.getAttribute("data-asset") === this.asset;
            el.classList.toggle("on", on);
            el.setAttribute("aria-current", on ? "true" : "false");
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            const on = el.getAttribute("data-masset") === this.asset;
            el.classList.toggle("on", on);
            el.setAttribute("aria-current", on ? "true" : "false");
          });
          const ht = this.popup.querySelector("[data-health-t]");
          const hd = this.popup.querySelector("[data-health-d]");
          const dot = this.popup.querySelector(".bz-vault-health .okdot");
          if (ht) ht.textContent = c.note + c.diary ? "保险库健康" : "保险库为空";
          if (hd) {
            if (!this.lastHealth) hd.textContent = "未体检 · 点此体检";
            else if (this.lastHealth.issues === 0) hd.textContent = `体检通过 · ${this.lastHealth.lastChecked}`;
            else hd.textContent = `${this.lastHealth.issues} 个待处理 · 点此查看`;
          }
          if (dot) {
            const color = !this.lastHealth ? "var(--bz-text-3)" : this.lastHealth.issues > 0 ? "var(--bz-warning)" : "var(--bz-success)";
            dot.style.background = color;
            dot.style.boxShadow = "none";
          }
        }
        /** 概览统计（供 overviewHTML；口径与 captureLockStats 的 vault 档一致：附件/字节只算纯笔记） */
        overviewStats() {
          const c = this.counts();
          const vaultNotes = [...this.dataManager.manifest.notes].filter((n) => n.kind !== "password-vault" && n.kind !== "people");
          const pureNotes = vaultNotes.filter((n) => n.kind !== "diary-entry");
          const attachments = pureNotes.reduce((s, n) => s + n.attachments.length, 0);
          const attBytes = pureNotes.reduce((s, n) => s + n.attachments.reduce((b, a) => b + (a.blobSize || 0), 0), 0);
          const candidates = vaultNotes.map((n) => ({
            n,
            kind: n.kind === "diary-entry" ? "diary" : "note",
            ts: Date.parse(n.createdAt || "") || 0
          }));
          candidates.sort((a, b) => b.ts - a.ts);
          const recent2 = [];
          for (const { n, kind, ts } of candidates.slice(0, 6)) {
            recent2.push({
              kind,
              id: n.id,
              // 笔记/日记均可定位：点击流水直落对应资产列表并选中该条目
              title: n.title,
              sub: `${n.attachments.length} 个附件 · ${n.path}`,
              time: formatRelativeTime(n.createdAt),
              ts
            });
          }
          return {
            counts: c,
            attachments,
            attBytes,
            recent: recent2.slice(0, 6).map(({ kind, id, title, sub, time }) => ({ kind, id, title, sub, time })),
            health: this.lastHealth
            // E5：随最近一次体检结果更新（未体检 null → 显示「未体检」）
          };
        }
        /** 桌面区渲染（中列表 + 右详情按资产分发） */
        renderDesktop() {
          const keepHead = this._lastRenderedAsset === this.asset && (this.asset === "note" || this.asset === "diary");
          if (!keepHead) this.desk.list.innerHTML = "";
          this.desk.detail.innerHTML = "";
          this.setOverviewSpan(this.asset === "overview");
          this._lastRenderedAsset = this.asset;
          if (this.asset === "overview") {
            this.renderDeskOverview();
            return;
          }
          const kind = this.asset;
          this.renderDeskNotes(kind, keepHead);
        }
        /** 概览跨栏开关：概览内容横跨「中列表 + 右详情」——隐藏中列表栏，让详情铺满整行 */
        setOverviewSpan(on) {
          var _a;
          (_a = this.popup.querySelector(".bz-vault-pane")) == null ? void 0 : _a.classList.toggle("is-overview", on);
        }
        /** 顶栏标题（各资产渲染器共用出口）。副标题已按评审去掉——条目数由列表头「N 项」承担 */
        setVaultHead(title) {
          this.popup.querySelector("[data-vault-title]").textContent = title;
        }
        /** 桌面概览：hero 计数 + 统计卡 + 最近 + 体检摘要（点击跳资产/动作） */
        renderDeskOverview() {
          const stats = this.overviewStats();
          this.setVaultHead("保险库");
          const detail = this.desk.detail;
          const area = document.createElement("div");
          area.className = "bz-vault-area";
          area.innerHTML = overviewHTML(stats);
          this.bindOverviewArea(area);
          detail.appendChild(area);
        }
        /**
         * 概览区交互绑定（桌面跨栏区 / 移动概览页共用，效率整改 4——移动概览此前零绑定全哑：
         * hero 按钮/统计卡/最近流水/体检卡点了没反应）。
         * 流水行按 data-recent 真实资产值分流（diary 行落加密日记列表并定位条目）。
         */
        bindOverviewArea(area) {
          var _a, _b;
          mountIcons(area);
          area.querySelectorAll(".card[data-nav]").forEach(
            (el) => el.addEventListener("click", () => this.setAssetFromNav(el.getAttribute("data-nav")))
          );
          (_a = area.querySelector('[data-hero="lock-note"]')) == null ? void 0 : _a.addEventListener("click", () => {
            var _a2;
            return (_a2 = this.onLockCurrentNote) == null ? void 0 : _a2.call(this);
          });
          area.querySelectorAll('[data-hero="health"]').forEach(
            (el) => el.addEventListener("click", () => void this.openHealthDialog())
          );
          (_b = area.querySelector('[data-hero="recent-all"]')) == null ? void 0 : _b.addEventListener("click", () => this.setAssetFromNav("note"));
          area.querySelectorAll(".bz-vault-minirow[data-recent]").forEach(
            (el) => el.addEventListener("click", () => {
              const rid = el.getAttribute("data-recent-id");
              if (rid) this._selNoteId = rid;
              this.setAssetFromNav(el.getAttribute("data-recent"));
            })
          );
        }
        /** 桌面加密笔记/日记：列表 + 详情（异步解密日记正文预览） */
        /**
         * 桌面加密笔记/日记：列表 + 详情。
         * @param keepHead 复用已有列表头（资产未变的刷新路径）——搜索框就在列表头里，
         *   整块重建会让正在输入的用户掉焦点，故只有切资产/首次渲染才重建它。
         */
        renderDeskNotes(kind, keepHead = false) {
          const list = this.desk.list;
          const detail = this.desk.detail;
          const kw = this.searchKw;
          let notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault" && n.kind !== "people").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          this.setVaultHead(kind === "note" ? "笔记" : "加密日记");
          if (kw) {
            const lower = kw.toLowerCase();
            notes = notes.filter((n) => (n.title || "").toLowerCase().includes(lower) || (n.path || "").toLowerCase().includes(lower));
          }
          let listBody = keepHead ? list.querySelector(".bz-vault-lc-body") : null;
          const prevScroll = listBody ? listBody.scrollTop : 0;
          if (!listBody) {
            list.innerHTML = "";
            if (kind === "note") {
              const head = document.createElement("div");
              head.className = "bz-vault-lc-head";
              head.innerHTML = `<div class="bz-search"><i data-lucide="search" class="bz-ic"></i><input class="bz-input" placeholder="搜索笔记…" data-vault-search>${searchClearHtml()}</div>`;
              list.appendChild(head);
              mountIcons(head);
              const headSearch = head.querySelector("[data-vault-search]");
              if (headSearch) {
                headSearch.value = kw;
                this.bindSearchInput(headSearch, false);
                this.syncSearchClear();
              }
            }
            listBody = document.createElement("div");
            listBody.className = "bz-vault-lc-body";
            list.appendChild(listBody);
          } else {
            listBody.innerHTML = "";
          }
          if (!notes.length) {
            listBody.replaceChildren(
              uiEmpty(
                kind === "note" ? { title: "还没有笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" } : { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" }
              )
            );
            return;
          }
          const selId = this._selNoteId && notes.some((n) => n.id === this._selNoteId) ? this._selNoteId : notes[0].id;
          for (const n of notes) {
            const row = document.createElement("div");
            row.innerHTML = noteRowHTML(n, kind, n.id === selId);
            const el = row.firstElementChild;
            el.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.renderDesktop();
            });
            el.addEventListener("dblclick", () => {
              if (this.previewMask) registerSheetCompanion(this.previewMask);
              void this.openPreview(n);
            });
            this.attachNoteDrawer(el, n, kind);
            listBody.appendChild(el);
          }
          mountIcons(listBody);
          if (keepHead) listBody.scrollTop = prevScroll;
          this.renderNoteDetail(detail, notes.find((n) => n.id === selId) || notes[0], kind);
        }
        /** 加密笔记/日记详情（异步解密日记正文预览） */
        renderNoteDetail(detail, note, kind) {
          const plain = kind === "diary" ? this._diaryPlain[note.id] : void 0;
          detail.innerHTML = noteDetailHTML(note, kind, plain);
          mountIcons(detail);
          const bind = (a, fn) => {
            var _a;
            (_a = detail.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a.addEventListener("click", (e) => {
              e.stopPropagation();
              fn();
            });
          };
          bind("preview", () => {
            if (this.previewMask) registerSheetCompanion(this.previewMask);
            void this.openPreview(note);
          });
          bind("restore", () => this.confirmRestore(note));
          bind("delete", () => this.confirmDeleteNote(note));
          bind("restore-diary", () => this.confirmRestoreDiary(note));
          bind("copy-diary", () => this.copyDiaryText(note));
          bind("destroy-diary", () => this.confirmDestroyDiary(note));
          if (kind === "diary" && !this._diaryPlain[note.id]) {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              if (t !== null && this.asset === "diary" && this._selNoteId === note.id) {
                this._diaryPlain[note.id] = t;
                this.renderNoteDetail(detail, note, kind);
                const pre = detail.querySelector(".note.pre");
                if (pre) motionRevealBody(pre);
              }
            }).catch(() => {
            });
          }
        }
        /** 笔记/日记动作集（行卡抽屉与移动详情页 ⋮ 共用） */
        noteDrawerActions(note, kind) {
          const isDiary = kind === "diary";
          const actions = [];
          actions.push({
            icon: "eye",
            label: isDiary ? "预览正文" : "预览",
            keepOpen: true,
            onClick: () => {
              if (this.previewMask) registerSheetCompanion(this.previewMask);
              void this.openPreview(note);
            }
          });
          if (isDiary) {
            actions.push({
              icon: "download",
              label: "还原回日记",
              onClick: () => this.confirmRestoreDiary(note)
            });
            actions.push({
              icon: "trash-2",
              label: "彻底销毁",
              kind: "danger",
              onClick: () => this.confirmDestroyDiary(note)
            });
          } else {
            actions.push({
              icon: "undo-2",
              label: "还原",
              kind: "danger",
              onClick: () => this.confirmRestore(note)
            });
            actions.push({
              icon: "trash-2",
              label: "删除",
              kind: "danger",
              onClick: () => this.confirmDeleteNote(note)
            });
          }
          return { actions, opts: { sheetHead: this.buildSheetHead(note, isDiary) } };
        }
        /** 笔记行/详情统一右键抽屉（预览/还原/删除） */
        attachNoteDrawer(el, note, kind) {
          const { actions, opts } = this.noteDrawerActions(note, kind);
          attachItemActions(el, actions, opts);
        }
        buildSheetHead(note, isDiary = false) {
          const head = document.createElement("div");
          head.className = "bz-item-sheet-entry";
          const body = document.createElement("div");
          body.style.cssText = "display:flex; align-items:flex-start; gap:10px;";
          const emoji = document.createElement("span");
          emoji.className = "bz-item-sheet-emoji";
          emoji.innerHTML = vIc(isDiary ? "book-lock" : "file-lock", 16);
          mountIcons(emoji);
          body.appendChild(emoji);
          const info = document.createElement("div");
          info.style.cssText = "flex:1; min-width:0;";
          const t = document.createElement("div");
          t.className = "bz-item-sheet-title";
          t.textContent = note.title;
          info.appendChild(t);
          const s = document.createElement("div");
          s.className = "bz-item-sheet-sub";
          s.textContent = `${formatRelativeTime(note.createdAt)} · ${note.attachments.length} 个附件`;
          info.appendChild(s);
          body.appendChild(info);
          head.appendChild(body);
          return head;
        }
        /**
         * 卸载/上锁收场：清 body 上的一次性弹层（幂等）。
         * - 进行中的解锁屏先走正规取消链（done(false)）：解挂 ESC 层 + 等待方 resolve(false) 不悬挂；
         * - 现行解锁屏/销毁确认走 core uiLockScreen 直挂 body（bz-lockscreen--mask）：摘 DOM 后
         *   其 ESC 层 isVisible(=isConnected) 自灭——禁用/重载插件不再残留可交互锁屏（新-3）；
         * - 体检窗挂独立 id 遮罩，一并收起（窗内为密文体检发现，不随上锁残留）。
         */
        closeAllDialogs() {
          var _a;
          if (activeUnlock && ((_a = activeUnlock.el) == null ? void 0 : _a.isConnected)) activeUnlock.cancel();
          this.activeChangePw = null;
          document.querySelectorAll("body > .bz-vault-dlg-mask").forEach((el) => el.remove());
          document.querySelectorAll("body > .bz-lockscreen--mask").forEach((el) => {
            if (el.classList.contains("bz-lockscreen--password-vault") || el.classList.contains("bz-lockscreen--diary")) return;
            el.remove();
          });
          this.hideHealthDialog();
          cancelActiveFlowDialog();
        }
        /**
         * 流程确认框（取消 / 确认 cta）：笔记/日记动作共用。
         * `danger`（issue 291 评审补）= 主动作是删除/销毁类 → 弹窗挂 `.bz-flow-dialog--danger`，
         * 主按钮降为中性底 + 红字（设计手册 §9/§10）。默认 false（还原等非破坏动作保持高亮）。
         * password-vault 的 `askConfirm` 已随 issue 365 一并收编同一 core 流程框（两域同源）。
         */
        askConfirm(title, message, okLabel, danger, onYes) {
          void openFlowDialog({
            title,
            message,
            actions: [
              { label: "取消", value: "cancel" },
              { label: okLabel, value: "ok", cta: true, danger }
            ]
          }).then((v) => {
            if (v === "ok") onYes();
          });
        }
        // 敏感文本复制（含降级兜底）+ 60s 自动清空：收口 core/utils copySensitiveWithFallback
        // （issue 365：与 password-vault 两份逐字雷同的兜底实现一并删除，两域消费同一实现）。
        setAssetFromNav(a) {
          if (a === "pw") a = "note";
          this.asset = a;
          lastVisitedAsset = a;
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-asset") === a)
          );
          this.mob.seg.querySelectorAll(".sg").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-masset") === a)
          );
          motionArmSwitch();
          this.renderAll();
        }
        /**
         * 解锁成功落点：直落加密笔记资产并聚焦搜索框——
         * 面板已只管加密笔记（密码本入口移除），打开即进入笔记列表多点一行都不用。
         * 方法名保留快速取密时代的旧称，稳住调用面与测试面。
         */
        enterPwQuickAccess() {
          if (!this._initialized) return;
          this.setAssetFromNav("note");
          const search = this.deskSearch;
          if (!search) return;
          search.value = "";
          try {
            search.focus({ preventScroll: true });
          } catch (e) {
            search.focus();
          }
        }
        /** 直落上次停留资产（已解锁直接打开面板时；无记忆回落加密笔记） */
        restoreLastAsset() {
          if (!this._initialized) return;
          this.setAssetFromNav(lastVisitedAsset);
        }
        /** 立即上锁（锁屏接管）。@param silent E11：安静上锁（触发方自带通知，如空闲自动上锁），hide 不再补一条 */
        lockNow(silent = false) {
          if (this.popup) motionLockSealing(this.popup);
          if (this.dataManager.unlocked) this.captureLockStats();
          this.dataManager.lock();
          this.pwDataManager.lock();
          this._selNoteId = null;
          this._diaryPlain = {};
          this.asset = "overview";
          this.lastHealth = null;
          this.unlockedAt = null;
          this.stopSessionTimers();
          this.closePreview();
          this.closeAllDialogs();
          this.notifyUnlockUi();
          if (this.isSecurityMode()) {
            this.hide(silent);
          }
        }
        /**
         * 外部上锁清场（N10 事件侧）：他域/密码本面板直调 SafeManager.lock() 不经本域 lockNow/hide，
         * 经 encrypt:unlock-changed(false) 兜底——清会话明文与选择态、收起预览/体检浮层、面板收起
         * （重开走状态栏重新解锁，hero 动态文案归 vault-assets-view 并行批）。
         * 刻意不走 hide()：hide 的安全模式分支会再调 lock()，unlock-changed(false) 会递归重入；
         * 也不全量扫 body 锁屏——他域（如日记）的解锁屏与本次上锁无关，不越界代拆。
         */
        onExternalLock() {
          var _a;
          if (!this._initialized || !((_a = this.popup) == null ? void 0 : _a.isConnected)) return;
          this.closePreview();
          this.hideHealthDialog();
          this._selNoteId = null;
          this._diaryPlain = {};
          this.lastHealth = null;
          this.unlockedAt = null;
          this.stopSessionTimers();
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
          if (this.dataManager.unlocked) this.captureLockStats();
        }
        /** 解锁态变更后 UI 同步（Controller attachStatusBar 也调；锁屏/已解锁文本 + 重绘）。未建 DOM 时静默 */
        notifyUnlockUi() {
          if (!this.popup || !this._initialized) return;
          const st = this.popup.querySelector("[data-mob-unlock]");
          if (st) st.textContent = this.dataManager.unlocked ? "已解锁" : "已锁定";
          if (this.dataManager.unlocked) {
            if (this.unlockedAt === null) this.unlockedAt = Date.now();
          } else {
            this.unlockedAt = null;
          }
          this.updateUnlockDuration();
          this.renderAll();
        }
        // ---------- 移动端渲染 ----------
        renderMobile() {
          const body = this.mob.body;
          body.innerHTML = "";
          const c = this.counts();
          if (this.asset === "overview") {
            const area = document.createElement("div");
            area.className = "bz-vault-mob-overview";
            area.innerHTML = overviewHTML(this.overviewStats());
            this.bindOverviewArea(area);
            body.appendChild(area);
            return;
          }
          const kind = this.asset;
          const notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault" && n.kind !== "people").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          const kw = this.searchKw;
          const filtered = kw ? notes.filter((n) => (n.title || "").toLowerCase().includes(kw.toLowerCase()) || (n.path || "").toLowerCase().includes(kw.toLowerCase())) : notes;
          if (!filtered.length) {
            body.replaceChildren(
              uiEmpty(
                kind === "diary" ? { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" } : { title: "还没有笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" }
              )
            );
            return;
          }
          for (const n of filtered) {
            const row = document.createElement("div");
            row.innerHTML = noteRowHTML(n, kind, false);
            const el = row.firstElementChild;
            el.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.openNoteMobPage(n, kind);
            });
            this.attachNoteDrawer(el, n, kind);
            body.appendChild(el);
          }
        }
        /** 移动端二级页骨架：顶栏（返回 + 标题 + ⋮）+ 内容体；back/menu 绑定由调用方接 */
        createMobPage(titleHtml) {
          const page = document.createElement("div");
          page.className = "bz-vault-mobpage";
          page.innerHTML = `<div class="head"><button class="back bz-touch-target--xl" data-mob-back>${vIc("chevron-left", 16)}</button><div class="t">${titleHtml}</div><button class="ic" data-mob-menu>${vIc("more-h", 16)}</button></div><div class="body"></div>`;
          mountIcons(page);
          return { page, body: page.querySelector(".body") };
        }
        openNoteMobPage(note, kind) {
          var _a, _b;
          const { page, body } = this.createMobPage(kind === "note" ? "笔记" : "加密日记");
          body.innerHTML = noteDetailHTML(note, kind);
          mountIcons(body);
          const bind = (a, fn) => {
            var _a2;
            (_a2 = body.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a2.addEventListener("click", (e) => {
              e.stopPropagation();
              fn();
            });
          };
          bind("preview", () => void this.openPreview(note));
          bind("restore", () => this.confirmRestore(note));
          bind("delete", () => this.confirmDeleteNote(note));
          bind("restore-diary", () => this.confirmRestoreDiary(note));
          bind("copy-diary", () => this.copyDiaryText(note));
          bind("destroy-diary", () => this.confirmDestroyDiary(note));
          (_a = page.querySelector("[data-mob-back]")) == null ? void 0 : _a.addEventListener("click", () => page.remove());
          (_b = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b.addEventListener("click", () => {
            const { actions, opts } = this.noteDrawerActions(note, kind);
            openItemSheet(actions, opts);
          });
          this.mob.body.appendChild(page);
          motionRevealBody(page);
          if (kind === "diary") {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              const pre = body.querySelector(".note.pre");
              if (pre && t !== null) {
                pre.innerHTML = escapeHtml2(t).replace(/\n/g, "<br>");
                motionRevealBody(pre);
              }
            }).catch(() => {
            });
          }
        }
        /** 轻量 toast（保险库窗口内） */
        toast(msg, isErr = false) {
          notice(msg, isErr ? "error" : void 0);
        }
        // ---------- 加密笔记/日记销毁/还原 ----------
        /**
         * 销毁确认共通壳（T4）：复用共享解锁屏（全屏遮罩模式），重输主密码 + verifyPassword
         * 只读校验——通过才执行 onConfirmed。这是防误触确认而非解锁，不进解锁冷却节流。
         * 加密笔记销毁与日记彻底销毁同款防护（此前日记仅普通确认框，防护不对齐）。
         */
        confirmDestroyWithPassword(opts) {
          const ls = uiLockScreen({
            kind: "vault",
            icon: "lock",
            title: opts.title,
            sub: opts.sub,
            stats: [],
            placeholder: "重输主密码确认",
            action: opts.action,
            secText: "销毁后密文不可恢复",
            secTone: "bad"
          });
          topifyZ(ls.el);
          document.body.appendChild(ls.el);
          motionLockScreenIn(ls.el);
          const esc2 = escManager.register("bz-vault-destroy-confirm", {
            isVisible: () => !!ls.el.isConnected,
            close: () => done(false)
          });
          const setErr = (m) => {
            ls.setError(m);
            setTimeout(() => {
              if (ls.input.value) ls.setError("");
            }, 2600);
          };
          const done = (ok) => {
            esc2.unregister();
            ls.close();
            if (!ok) return;
            opts.onConfirmed();
          };
          const submit = async () => {
            const pw = ls.input.value;
            if (!pw) {
              this.rejectInput("请输入主密码确认", setErr);
              return;
            }
            ls.setBusy(true);
            try {
              if (await this.dataManager.verifyPassword(pw)) {
                motionUnlockBurst(ls.el.querySelector('[data-ls="seal"]'));
                done(true);
              } else {
                ls.setBusy(false);
                motionRejectShake(ls.el);
                this.rejectInput("主密码错误，未销毁", setErr, "error");
                ls.input.value = "";
                ls.focus();
              }
            } catch (e) {
              ls.setBusy(false);
              this.rejectInput("校验失败：" + ((e == null ? void 0 : e.message) || "请重试"), setErr, "error");
            }
          };
          ls.actionBtn.addEventListener("click", () => void submit());
          ls.el.addEventListener("click", (e) => {
            if (e.target === ls.el) done(false);
          });
          ls.focus();
          setTimeout(() => ls.focus(), 150);
        }
        /** 销毁加密笔记：重输主密码二次确认（高危操作防误触），通过后执行移除。 */
        confirmDeleteNote(note) {
          this.confirmDestroyWithPassword({
            title: "销毁确认",
            sub: `将永久销毁「${note.title}」的正文与全部附件密文，销毁后不可恢复`,
            action: "确认销毁",
            onConfirmed: () => {
              void this.dataManager.removeNote(note.id).then(() => {
                if (this._selNoteId === note.id) this._selNoteId = null;
                this.renderList();
                this.toast(`已销毁笔记「${note.title}」`);
              }).catch((e) => notifyActionError(e, "销毁"));
            }
          });
        }
        /** 日记还原回日记（复用 diary reclassifyEntry 语义：还原块 merge 回原日期 md） */
        confirmRestoreDiary(note) {
          this.askConfirm(
            "还原回日记",
            `将「${note.title}」的正文与附件还原到 ${note.path} 的时间序位置？`,
            "还原",
            false,
            // 还原是取出动作，非破坏 → 保持普通高亮主动作
            () => {
              const h = progressNotify("还原日记 " + note.title);
              void this.restoreDiaryEntry(note, h);
            }
          );
        }
        /** 实际执行日记还原（调 SafeManager.restoreDiaryEntry——diary 域同款语义） */
        async restoreDiaryEntry(note, h) {
          try {
            const plain = await this.dataManager.decryptNoteBody(note);
            if (plain === null) {
              if (h) h.hide();
              this.toast("正文解密失败，无法还原", true);
              return;
            }
            let diaryDir;
            try {
              diaryDir = (await Promise.resolve().then(() => (init_config(), config_exports))).DIARY_DIRECTORY;
            } catch (e) {
            }
            const ok = await this.dataManager.restoreDiaryEntry(note.id, plain, diaryDir);
            if (h) h.hide();
            if (ok) {
              if (this._selNoteId === note.id) this._selNoteId = null;
              this.renderList();
              this.toast("已还原回日记");
            } else {
              this.toast("还原失败：附件冲突或写回失败", true);
            }
          } catch (e) {
            if (h) h.hide();
            notifyActionError(e, "还原日记");
          }
        }
        copyDiaryText(note) {
          void this.dataManager.decryptNoteBody(note).then((t) => {
            if (t === null) {
              this.toast("正文解密失败", true);
              return;
            }
            void copySensitiveWithFallback(t).then((ok) => this.toast(ok ? "正文已复制（60 秒后自动清空）" : "复制失败", !ok));
          }).catch(() => this.toast("正文解密失败", true));
        }
        confirmDestroyDiary(note) {
          this.confirmDestroyWithPassword({
            title: "彻底销毁日记",
            sub: `将永久销毁「${note.title}」的密文（含附件），销毁后不可恢复`,
            action: "永久销毁",
            onConfirmed: () => {
              void this.dataManager.removeNote(note.id).then(() => {
                delete this._diaryPlain[note.id];
                if (this._selNoteId === note.id) this._selNoteId = null;
                this.renderList();
                this.toast(`已销毁「${note.title}」`);
              }).catch((e) => notifyActionError(e, "销毁"));
            }
          });
        }
        confirmRestore(note) {
          this.askConfirm(
            "还原",
            `将「${note.title}」的原文${note.attachments.length ? "与 " + note.attachments.length + " 个原质量附件" : ""}还原到原路径？`,
            "还原",
            false,
            // 还原是取出动作，非破坏
            () => {
              const h = progressNotify("还原 " + note.title);
              void this.dataManager.restoreNote(note.id, (p) => updateProgress(h, p.done, p.total, p.current)).then(({ conflicts, removed, manifestSaveFailed }) => {
                const total = note.attachments.length + 1;
                if (removed) {
                  finishProgress(h, total, "还原完成");
                  this.hide();
                  this.openRestoredNote(note);
                } else if (manifestSaveFailed) {
                  finishProgress(h, total, "文件已还原（清单保存失败）");
                  notice(
                    "笔记与附件已还原到原位置，但保险库清单保存失败（磁盘异常）；下次解锁后重试还原将自动完成清理",
                    "warning"
                  );
                } else {
                  finishProgress(h, total, "还原未完成（" + conflicts.length + " 个目标有冲突）");
                  const cap = (p) => p.length > 48 ? p.slice(0, 48) + "…" : p;
                  const paths = conflicts.map(cap).join("、");
                  notice(
                    `还原中止：${conflicts.length} 个目标被占用或不可用（${paths}），未写入任何文件，条目保留在保险库`,
                    "warning"
                  );
                }
                void this.renderList();
              }).catch((e) => {
                if (h) h.hide();
                notifyActionError(e, "还原");
              });
            }
          );
        }
        /** 还原成功后打开该笔记（Obsidian 当前叶子页打开） */
        openRestoredNote(note) {
          var _a, _b;
          const app = getApp();
          try {
            const file = app.vault.getAbstractFileByPath(note.path);
            if (file && file.isFolder !== true) {
              (_b = (_a = app.workspace).openLinkText) == null ? void 0 : _b.call(_a, note.path, note.path);
            }
          } catch (e) {
          }
        }
        // ---------- 预览窗 ----------
        /**
         * 打开预览窗。关键：先同步显示弹窗骨架再异步填充正文——
         * 真实 Obsidian 里 MarkdownRenderer.render 可能挂起（历史 b0831de 修过预览挂起），
         * 若把所有 await 跑完才设 display，挂起时单击就毫无反应；故拆成「先显骨架 + 异步填充」。
         */
        async openPreview(note) {
          if (!this.previewPopup) this.ensureElements();
          if (!this.dataManager.unlocked || !this.dataManager.password) {
            notice("保险库已上锁，请先解锁再预览", "warning");
            return;
          }
          this.revokePreviewUrls();
          const popup = this.previewPopup;
          const mask = this.previewMask;
          popup.innerHTML = "";
          const header = document.createElement("div");
          header.className = "bz-encrypt-preview-head";
          const title = document.createElement("h4");
          title.textContent = note.title;
          header.appendChild(title);
          popup.appendChild(header);
          const body = document.createElement("div");
          body.className = "bz-encrypt-preview-body";
          const loadHint = document.createElement("div");
          loadHint.className = "bz-encrypt-preview-loading";
          loadHint.textContent = "解密中…";
          body.appendChild(loadHint);
          popup.appendChild(body);
          topifyZ(this.previewMask, this.previewPopup);
          mask.style.display = "block";
          popup.style.display = "flex";
          motionPreviewIn(popup);
          void this.fillPreviewBody(note, body);
        }
        /** 预览窗正文异步填充：解密 → 渲染（带超时兜底）→ 图随文走 → 画廊 */
        async fillPreviewBody(note, body) {
          try {
            const bodyP = this.dataManager.decryptNoteBody(note);
            const previewP = [];
            const seen = /* @__PURE__ */ new Set();
            for (const a of note.attachments) {
              if (!a.hasPreview || seen.has(a.path)) continue;
              seen.add(a.path);
              previewP.push(
                this.dataManager.decryptPreview(a).then(
                  (du) => ({ path: a.path, du: du || "" }),
                  () => ({ path: a.path, du: "" })
                )
              );
            }
            const [plain, previewResults] = await Promise.all([bodyP, Promise.all(previewP)]);
            const dataUrls = /* @__PURE__ */ new Map();
            for (const r of previewResults) dataUrls.set(r.path, r.du);
            let bodyEl;
            let inlined = /* @__PURE__ */ new Set();
            if (plain === null) {
              const err = document.createElement("div");
              err.textContent = "正文解密失败";
              bodyEl = err;
            } else {
              const { text, slots, inlined: inl } = collectMediaSlots(plain, note.attachments);
              inlined = inl;
              const { ok: rendered, el: mdEl } = await this.renderWithTimeout(getApp(), text, note.path);
              mdEl.className = "bz-encrypt-preview-md";
              if (rendered) {
                let html = mdEl.innerHTML;
                for (const slot of slots) {
                  const a = slot.attachment;
                  if (a) html = html.split(slot.token).join(mediaHtml(a, dataUrls.get(a.path)));
                  else html = html.split(slot.token).join("");
                }
                mdEl.innerHTML = html;
              } else {
                mdEl.textContent = plain;
              }
              bodyEl = mdEl;
            }
            body.innerHTML = "";
            body.appendChild(bodyEl);
            motionRevealBody(bodyEl);
            const residuals = note.attachments.filter((a) => !inlined.has(a.path));
            if (residuals.length) {
              const gallery = document.createElement("div");
              gallery.className = "bz-encrypt-preview-gallery";
              for (const a of residuals) {
                const wrap = document.createElement("div");
                wrap.innerHTML = mediaHtml(a, dataUrls.get(a.path));
                gallery.appendChild(wrap);
              }
              body.appendChild(gallery);
            }
            this.bindMediaClicks(body, note.attachments);
            if (this.config.autoLoadOriginal) {
              body.querySelectorAll(".bz-encrypt-preview-slot").forEach((slot) => slot.click());
            }
          } catch (e) {
            body.innerHTML = "";
            const err = document.createElement("div");
            err.textContent = "正文解密失败";
            body.appendChild(err);
          }
        }
        unloadPreviewComponent() {
          const c = this._previewComponent;
          this._previewComponent = null;
          if (c) {
            try {
              c.unload();
            } catch (e) {
            }
          }
        }
        /**
         * 渲染带超时：PREVIEW_RENDER_TIMEOUT_MS（默认 3000ms）内不完成视为失败（防真实环境 render
         * 挂起导致弹窗永久空白/不可关）。
         * E9：render 渲入私有容器——超时弃用该容器（迟到 promise 追加进孤儿节点永不入 DOM），
         * 返回全新容器给调用方走纯文本兜底，正文不再「纯文本 + 迟到渲染」叠双份。
         * T13：返回渲染 Component，调用链在关窗/下一次填充前 unload 收掉生命周期。
         */
        async renderWithTimeout(app, text, path, timeoutMs = PREVIEW_RENDER_TIMEOUT_MS) {
          this.unloadPreviewComponent();
          const el = document.createElement("div");
          const component = new Component();
          this._previewComponent = component;
          let finished = false;
          const render = MarkdownRenderer.render(app, text, el, path, component).then(
            () => {
              finished = true;
            },
            () => {
              finished = true;
            }
          );
          await Promise.race([render, new Promise((r) => setTimeout(r, timeoutMs))]);
          if (!finished) return { ok: false, el: document.createElement("div"), component };
          return { ok: true, el, component };
        }
        /** 预览窗内所有缩略图/占位 slot 绑定点击：只加载被点的那一张原始层 */
        bindMediaClicks(root, attachments) {
          const slots = root.querySelectorAll(".bz-encrypt-preview-slot");
          for (const slot of slots) {
            const key = slot.getAttribute("data-attach");
            if (!key) continue;
            const a = attachments.find((x) => x.path === decodeURIComponent(key));
            if (!a) continue;
            slot.addEventListener("click", () => void this.loadOriginal(a, slot));
          }
        }
        /**
         * 点击缩略图：该图 slot 显示转圈 → 解密原始层 → 原地替换为原始质量图片 / 可播放视频。
         * 不弹通知（缩略图内加载态更直观）；失败恢复缩略图并提示 title 可重试。
         */
        async loadOriginal(a, slot) {
          if (slot.dataset.loaded === "1" || slot.dataset.loading === "1") return;
          slot.dataset.loading = "1";
          slot.classList.add("bz-encrypt-preview-slot--loading");
          try {
            const b64 = await this.dataManager.decryptAttachmentOriginal(a);
            if (!b64) throw new Error("无密文");
            const url = await this.blobUrlOf(b64, mimeOf(a.path));
            const img = slot.querySelector("img.bz-encrypt-preview-media");
            const missing = slot.querySelector(".bz-encrypt-preview-missing");
            if (a.kind === "video") {
              const video = document.createElement("video");
              video.className = "bz-encrypt-preview-video";
              video.controls = true;
              video.preload = "metadata";
              video.src = url;
              if (img) img.replaceWith(video);
              else if (missing) missing.replaceWith(video);
              else slot.appendChild(video);
            } else if (img) {
              img.src = url;
            } else if (missing) {
              const im = document.createElement("img");
              im.className = "bz-encrypt-preview-media";
              im.alt = escapeHtml2(a.path || "");
              im.src = url;
              missing.replaceWith(im);
            }
            slot.dataset.loaded = "1";
            slot.classList.add("bz-encrypt-preview-slot--loaded");
            motionOriginalFlash(slot);
          } catch (e) {
            const img = slot.querySelector("img.bz-encrypt-preview-media");
            const missing = slot.querySelector(".bz-encrypt-preview-missing");
            if (img) img.title = "加载失败，点击重试";
            if (missing) missing.title = "加载失败，点击重试";
          } finally {
            delete slot.dataset.loading;
            slot.classList.remove("bz-encrypt-preview-slot--loading");
          }
        }
        /** 原始 base64 → 展示 URL：优先 Blob URL（大视频/大图不撑坏内存），环境不支持时退回 dataURL */
        async blobUrlOf(b64, mime) {
          try {
            const bytes = base64ToBytes(b64);
            const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
            if (url) {
              this._previewUrls.push(url);
              return url;
            }
          } catch (e) {
          }
          return `data:${mime};base64,${b64}`;
        }
        /** 释放本次预览积累的全部 Blob URL（关预览/换预览共用，防内存泄漏） */
        revokePreviewUrls() {
          for (const u of this._previewUrls) {
            try {
              URL.revokeObjectURL(u);
            } catch (e) {
            }
          }
          this._previewUrls = [];
        }
        closePreview() {
          this.revokePreviewUrls();
          this.unloadPreviewComponent();
          if (this.previewMask) unregisterSheetCompanion(this.previewMask);
          if (this.previewMask) this.previewMask.style.display = "none";
          if (this.previewPopup) this.previewPopup.style.display = "none";
        }
        // ---------- 设置弹窗 ----------
        openSettings() {
          openSettingsModal({ title: "保险库设置", maxWidth: 560, schema: encryptSettingsSchema() });
        }
        registerEscape() {
          unregisterPanelEsc("bz-encrypt");
          registerPanelEsc(
            "bz-encrypt",
            // isVisible 判活带 isConnected（六域先例口径：判「还在屏上」而非仅样式位）——
            // cleanup 摘 DOM 后旧层自愈失活，不会吞掉重启用后新面板的 ESC
            () => !!(this.mask && this.mask.isConnected && this.mask.style.display === "block") || !!(this.previewMask && this.previewMask.isConnected && this.previewMask.style.display === "block"),
            () => {
              if (this.previewMask && this.previewMask.style.display === "block") this.closePreview();
              else if (this.mask && this.mask.style.display === "block") this.hide();
            }
          );
        }
      };
      /** 安全模式：15 分钟无面板交互自动上锁（交互即重置；非安全模式/未解锁不布防） */
      _UIManager.IDLE_LOCK_MS = 15 * 60 * 1e3;
      UIManager = _UIManager;
      _EncryptAppController = class _EncryptAppController {
        constructor(config) {
          this._initialized = false;
          /** 加密进行中标志（重入保护：处理中拒绝再次触发 lockCurrentNote） */
          this._locking = false;
          /** 状态栏元素（main.ts mount 注入；解锁态变化时刷新，补丁：状态栏锁状态提示） */
          this.statusBarEl = null;
          this.config = config;
          this.dataManager = new SafeManager(config.root);
          this.uiManager = new UIManager(this.dataManager, config);
          this.uiManager.onLockCurrentNote = () => {
            void this.lockCurrentNote();
          };
        }
        static getInstance(config) {
          if (!_EncryptAppController.instance) {
            _EncryptAppController.instance = new _EncryptAppController(config);
          }
          return _EncryptAppController.instance;
        }
        /**
         * 状态栏挂载（main.ts onload 调用）：初始为锁定态；订阅解锁态变化刷新，
         * 点击打开统一保险库面板（openEncrypt 有解锁引导）。
         */
        attachStatusBar(el) {
          this.statusBarEl = el;
          this.dataManager.onUnlockChange = (unlocked) => {
            var _a, _b;
            if (this.statusBarEl) {
              this.statusBarEl.innerHTML = statusbarHtml(unlocked);
              mountIcons(this.statusBarEl);
              motionStatusbarSpin(this.statusBarEl);
            }
            (_b = (_a = this.uiManager).notifyUnlockUi) == null ? void 0 : _b.call(_a);
          };
          this.dataManager.onUnlockChange(this.dataManager.unlocked);
        }
        async init() {
          if (this._initialized) return;
          this.uiManager.ensureElements();
          this._initialized = true;
        }
        /** 打开保险库主面板：解锁成功直落加密笔记资产并聚焦搜索；
         *  已解锁直接打开则恢复上次停留资产（会话级记忆）。 */
        async openManager() {
          const needUnlock = !this.dataManager.unlocked;
          if (needUnlock) {
            const ok = await this.uiManager.showPasswordDialog();
            if (!ok) return;
          }
          if (needUnlock) this.uiManager.enterPwQuickAccess();
          else this.uiManager.restoreLastAsset();
          this.uiManager.show();
          if (needUnlock) this.uiManager.focusListSearch();
        }
        /** 二次确认：正文与附件将移入保险库（原路径消失），点确认才开始；共享附件原件保留（issue 338） */
        async confirmLockProceed(file, attCount, sharedCount = 0) {
          const sharedNote = sharedCount > 0 ? `其中 ${sharedCount} 个附件被其他笔记共用，原件将保留在原位置。` : "";
          return await openFlowDialog({
            title: "加密到保险库",
            message: `把「${file.basename}」的正文${attCount ? "与 " + attCount + " 个附件" : ""}加密移入保险库？加密后原笔记与附件将从原路径移出（保险库内为密文）。${sharedNote}`,
            actions: [
              { label: "取消", value: "cancel" },
              // 刻意不标 danger（issue 291 评审）：加密是「搬进保险库」而非销毁——原路径消失但正文/附件
              // 完整保留在库内（可解密取回），不构成不可逆数据破坏。
              { label: "加密", value: "ok", cta: true }
            ]
          }) === "ok";
        }
        /**
         * 读取附件原始内容并按设置生成预览层。
         * Q3-A：任一附件读取失败 → 整笔放弃（返回 null，不落任何东西、原文件不动）；预览失败不算失败（可选增强）。
         */
        async readAttachmentInputs(app, attPaths) {
          var _a, _b;
          const attachments = [];
          const size = this.config.previewSize || 384;
          const quality = this.config.previewQuality || 0.5;
          for (const p of attPaths) {
            try {
              const f = app.vault.getAbstractFileByPath(p);
              if (!f) throw new Error("附件不存在");
              const buf = await app.vault.readBinary(f);
              const data = bytesToBase64(new Uint8Array(buf));
              let previewData;
              if (this.config.previewEnabled) {
                try {
                  const resourceUrl = ((_b = (_a = app.vault).getResourcePath) == null ? void 0 : _b.call(_a, f)) || "";
                  const result = kindOf(p) === "video" ? await videoFrame(resourceUrl, size, quality) : await compressImage(resourceUrl, size, quality);
                  if (result) previewData = result.dataUrl;
                } catch (e) {
                  previewData = void 0;
                }
              }
              attachments.push({ path: p, kind: kindOf(p), data, previewData });
            } catch (e) {
              notice("加密失败：附件读取失败（" + p + "）", "error");
              return null;
            }
          }
          return attachments;
        }
        /** 加锁当前打开笔记（正文 + 双链图片/视频附件；执行前弹确认）。重入保护：处理中拒绝再次触发 */
        async lockCurrentNote() {
          if (this._locking) {
            notice("正在加密当前笔记，请稍候");
            return;
          }
          this._locking = true;
          try {
            const app = getApp();
            const file = app.workspace.getActiveFile();
            if (!file) {
              notice("请先打开要加密的笔记");
              return;
            }
            if (!this.dataManager.unlocked || !this.dataManager.password) {
              const ok = await this.uiManager.showPasswordDialog();
              if (!ok) {
                notice("未解锁，已取消加密");
                return;
              }
            }
            const content = await app.vault.read(file);
            const attPaths = collectNoteAttachmentPaths(app, file, content);
            const sharedSet = new Set(collectSharedAttachmentPaths(app, file.path, attPaths));
            if (!await this.confirmLockProceed(file, attPaths.length, sharedSet.size)) return;
            const attachments = await this.readAttachmentInputs(app, attPaths);
            if (!attachments) return;
            for (const a of attachments) {
              if (sharedSet.has(a.path)) a.keptShared = true;
            }
            const h = progressNotify("加密 " + file.basename);
            try {
              await this.dataManager.lockNote(
                {
                  path: file.path,
                  title: file.basename,
                  content,
                  attachments
                },
                (p) => updateProgress(h, p.done, p.total, p.current),
                (failed) => {
                  if (failed.length) {
                    notice(failed.length + " 个原文件删除失败（已保留在原位置，可手动删除）", "warning");
                  }
                },
                (stale) => {
                  if (stale.length) {
                    notice("加密期间笔记有新的修改，原文件已保留；保险库内为加密时的内容，可删除后重新加密", "warning");
                  }
                }
              );
              finishProgress(
                h,
                attachments.length + 1,
                sharedSet.size ? `加密完成（${sharedSet.size} 个附件被其他笔记共用，原件保留）` : "加密完成"
              );
              this.uiManager.show();
            } catch (e) {
              if (h) h.hide();
              notifyActionError(e, "加密");
            }
          } catch (e) {
            notifyActionError(e, "加密当前笔记");
          } finally {
            this._locking = false;
          }
        }
        /** 卸载清理 */
        cleanup() {
          this.uiManager.captureForUnload();
          const ids = ["bz-encrypt-mask", "bz-encrypt-popup", "bz-encrypt-preview-mask", "bz-encrypt-preview-popup", "bz-encrypt-health-mask", "bz-encrypt-health-popup"];
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.remove();
          }
          this.uiManager.closeAllDialogs();
          this.uiManager.detachGlobalListeners();
          cancelClipboardClear();
          this.uiManager.stopSessionTimers();
          motionTeardown();
          this.uiManager.pwDataManager.destroy();
          this.uiManager.mask = null;
          this.uiManager.popup = null;
          this.uiManager.previewMask = null;
          this.uiManager.previewPopup = null;
          this.uiManager.healthMask = null;
          this.uiManager.healthPopup = null;
          this.uiManager._initialized = false;
          this.dataManager.onUnlockChange = null;
          this.dataManager.lock();
          _EncryptAppController.instance = null;
        }
      };
      _EncryptAppController.instance = null;
      EncryptAppController = _EncryptAppController;
    }
  });

  // src/encrypt/index.ts
  var encrypt_exports = {};
  __export(encrypt_exports, {
    changeSafePassword: () => changeSafePassword,
    encryptCurrentNote: () => encryptCurrentNote,
    ensureEncrypt: () => ensureEncrypt,
    ensureSafeUnlocked: () => ensureSafeUnlocked,
    getSafeManager: () => getSafeManager,
    lockEncrypt: () => lockEncrypt,
    lockSafe: () => lockSafe,
    mountEncryptStatusBar: () => mountEncryptStatusBar,
    openEncrypt: () => openEncrypt,
    unloadEncrypt: () => unloadEncrypt,
    unmountEncryptStatusBar: () => unmountEncryptStatusBar
  });
  function getController() {
    if (!controller) {
      const s = getSettings();
      const config = {
        // 密文根目录固定跟随数据存储路径（core/storage 的 encryptDir 单源；encryptRoot 键已退役）
        root: encryptDir(),
        previewEnabled: s.encryptPreviewEnabled !== false,
        previewSize: parseInt(s.encryptPreviewSize) || 384,
        previewQuality: parseFloat(s.encryptPreviewQuality) || 0.5,
        autoLoadOriginal: !!s.encryptAutoLoadOriginal,
        securityMode: !!s.encryptSecurityMode
      };
      controller = EncryptAppController.getInstance(config);
    }
    return controller;
  }
  async function ensureEncrypt(app) {
    if (initialized) return;
    await getController().init();
    initialized = true;
  }
  function mountEncryptStatusBar(container) {
    if (statusBarEl) return;
    const el = document.createElement("span");
    el.className = "bz-encrypt-statusbar";
    el.title = "保险库：点击打开";
    el.innerHTML = statusbarHtml(false);
    mountIcons(el);
    el.addEventListener("click", () => openEncrypt(getApp()));
    container.appendChild(el);
    statusBarEl = el;
    void ensureEncrypt(getApp()).then(() => getController().attachStatusBar(el)).catch(() => {
    });
  }
  function unmountEncryptStatusBar() {
    if (statusBarEl) {
      statusBarEl.remove();
      statusBarEl = null;
    }
  }
  function openEncrypt(app) {
    void ensureEncrypt(app).then(() => getController().openManager()).catch(() => notice("保险库初始化失败，请重试", "error"));
  }
  function encryptCurrentNote(app) {
    void ensureEncrypt(app).then(() => getController().lockCurrentNote()).catch(() => notice("保险库初始化失败，请重试", "error"));
  }
  function getSafeManager() {
    return getController().dataManager;
  }
  async function lockSafe(app) {
    try {
      await ensureEncrypt(app);
    } catch (e) {
      return false;
    }
    if (!getSafeManager().unlocked) return false;
    getController().uiManager.lockNow(true);
    return true;
  }
  async function lockEncrypt(app) {
    const ok = await lockSafe(app);
    if (ok) notice("保险库已锁定", "success");
    else notice("保险库本来就是锁着的", "warning");
  }
  async function changeSafePassword(app) {
    try {
      await ensureEncrypt(app);
    } catch (e) {
      notice("保险库初始化失败，请重试", "error");
      return;
    }
    const controller3 = getController();
    if (!controller3.dataManager.unlocked) {
      const ok = await controller3.uiManager.showPasswordDialog("vault");
      if (!ok) return;
    }
    controller3.uiManager.openChangePassword();
  }
  async function ensureSafeUnlocked(kind = "vault") {
    const controller3 = getController();
    if (controller3.dataManager.unlocked) return true;
    const ok = await controller3.uiManager.showPasswordDialog(kind);
    return ok;
  }
  function unloadEncrypt() {
    if (controller) controller.cleanup();
    controller = null;
    initialized = false;
  }
  var initialized, controller, statusBarEl;
  var init_encrypt = __esm({
    "src/encrypt/index.ts"() {
      init_settings_provider();
      init_storage();
      init_app();
      init_notice();
      init_ui2();
      init_vault_assets_view();
      init_ui();
      initialized = false;
      controller = null;
      statusBarEl = null;
    }
  });

  // src/diary/encrypt.ts
  var encrypt_exports2 = {};
  __export(encrypt_exports2, {
    ENCRYPT_TAG: () => ENCRYPT_TAG,
    deleteEncryptedEntry: () => deleteEncryptedEntry,
    encryptEntry: () => encryptEntry,
    isUnlocked: () => isUnlocked,
    loadEncryptedEntries: () => loadEncryptedEntries,
    reclassifyEntry: () => reclassifyEntry
  });
  function isUnlocked() {
    try {
      return getSafeManager().unlocked;
    } catch (e) {
      return false;
    }
  }
  async function collectAttachmentsForContent(content, datePath) {
    const app = getApp();
    const paths = collectNoteAttachmentPaths(app, datePath, content);
    const list = [];
    const oversized = [];
    for (const p of paths) {
      try {
        const f = app.vault.getAbstractFileByPath(p);
        if (!f) continue;
        const stat = f.stat;
        if (stat && typeof stat.size === "number" && stat.size > ATTACHMENT_MAX_BYTES) {
          oversized.push(p);
          continue;
        }
        const buf = await app.vault.readBinary(f);
        list.push({ path: p, kind: kindOf(p), data: bytesToBase64(new Uint8Array(buf)) });
      } catch (e) {
      }
    }
    return { list, oversized };
  }
  async function encryptEntry(entry) {
    const safe = getSafeManager();
    if (!safe.unlocked) throw new Error("未解锁，无法加密日记");
    const tags = [.../* @__PURE__ */ new Set([...entry.tags, ENCRYPT_TAG])];
    const block = `${serializeDiaryBlockHeader(tags, entry.time)}
${entry.content.trim()}`;
    const datePath = entry.filePath || diaryEntryPath(DIARY_DIRECTORY, entry.date, entry.time);
    const { list: attachments, oversized } = await collectAttachmentsForContent(entry.content || "", datePath);
    if (attachments.length === 0 && oversized.length > 0) {
      notify(
        `加密取消：条目引用的 ${oversized.length} 个附件都超过 64MB，未加密（原文件仍留在盘上）。请先移出大媒体再加密。`,
        { type: "error" }
      );
      return null;
    }
    if (oversized.length > 0) {
      notify(`有 ${oversized.length} 个附件过大（超过 64MB）未加密（原文件仍留在盘上）。`, { type: "warning" });
    }
    const note = await safe.lockNote(
      {
        path: datePath,
        title: `${entry.date} · ${entry.time} 日记`,
        kind: "diary-entry",
        content: block,
        attachments
      }
    );
    return {
      ...entry,
      tags,
      emoji: tags.map((t) => getTagEmoji(t)).join(""),
      encrypted: true,
      noteId: note.id
    };
  }
  async function loadEncryptedEntries() {
    var _a;
    const safe = getSafeManager();
    if (!safe.unlocked || !safe.manifest) return [];
    const out = [];
    for (const note of safe.manifest.notes) {
      if (note.kind !== "diary-entry") continue;
      try {
        const plain = await safe.getDiaryEntryPlain(note.id);
        if (plain === null || plain === void 0) continue;
        const meta = diaryMetaFromEntryPath(note.path);
        const date = (_a = meta == null ? void 0 : meta.date) != null ? _a : diaryDateFromLegacyPath(note.path);
        if (!date) continue;
        const entry = parseDiaryBlock(plain, date, note.id, note.path);
        if (entry) out.push(entry);
      } catch (e) {
      }
    }
    return out;
  }
  function parseDiaryBlock(block, date, noteId, notePath) {
    var _a;
    const lines = block.replace(/\r\n/g, "\n").split("\n");
    const head = parseDiaryBlockHeader((_a = lines[0]) != null ? _a : "");
    if (!head) return null;
    const time = head.time;
    const [h, min] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    const tags = head.tags.length ? [...head.tags] : ["日记"];
    const content = lines.slice(1).join("\n").trim();
    return {
      date,
      time,
      timeValue: h * 100 + min,
      tags,
      emoji: tags.map((t) => getTagEmoji(t)).join(""),
      content,
      filename: notePath || date,
      filePath: notePath,
      lineNumber: 0,
      encrypted: true,
      noteId,
      id: `enc-diary-${noteId}`
    };
  }
  async function deleteEncryptedEntry(noteId) {
    const safe = getSafeManager();
    if (!safe.unlocked) throw new Error("未解锁");
    await safe.removeNote(noteId);
  }
  async function realignRestorePath(noteId) {
    var _a, _b;
    const safe = getSafeManager();
    const note = (_b = (_a = safe.manifest) == null ? void 0 : _a.notes) == null ? void 0 : _b.find((n) => n.id === noteId);
    if (!note || note.kind !== "diary-entry") return;
    const base = note.path.split("/").pop() || "";
    if (!diaryMetaFromEntryPath(base)) return;
    const target = `${DIARY_DIRECTORY}/${base}`;
    if (target === note.path) return;
    note.path = target;
    try {
      await safe.saveManifest();
    } catch (e) {
    }
  }
  async function buildRestoreBlock(noteId, newTags) {
    var _a;
    const plain = await getSafeManager().getDiaryEntryPlain(noteId);
    if (plain === null || plain === void 0) return null;
    const lines = plain.replace(/\r\n/g, "\n").split("\n");
    const head = parseDiaryBlockHeader((_a = lines[0]) != null ? _a : "");
    if (!head) return null;
    const kept = (newTags != null ? newTags : []).filter((t) => t !== ENCRYPT_TAG);
    const seqTags = kept.length > 0 ? kept : ["日记"];
    return `${serializeDiaryBlockHeader(seqTags, head.time)}${lines.length > 1 ? "\n" + lines.slice(1).join("\n") : ""}`;
  }
  async function reclassifyEntry(noteId, newTags) {
    await realignRestorePath(noteId);
    const block = await buildRestoreBlock(noteId, newTags);
    if (block === null) return false;
    return getSafeManager().restoreDiaryEntry(noteId, block, DIARY_DIRECTORY);
  }
  var ATTACHMENT_MAX_BYTES;
  var init_encrypt2 = __esm({
    "src/diary/encrypt.ts"() {
      init_app();
      init_notice();
      init_encrypt();
      init_ui2();
      init_data2();
      init_diary_format();
      init_config();
      ATTACHMENT_MAX_BYTES = 64 * 1024 * 1024;
    }
  });

  // prototypes/diary/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootDiarySim: () => bootDiarySim,
    openPanel: () => openPanel,
    openWrite: () => openWrite,
    unloadDiary: () => unloadDiary
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();
  init_config();

  // src/diary/ui.ts
  var import_page_flip_browser = __toESM(require_page_flip_browser());
  init_esc_manager();
  init_dom();
  init_notice();
  init_app();
  init_domain_bus();
  init_utils();
  init_flow_dialog();
  init_config();

  // src/diary/parser.ts
  init_fake_obsidian();
  init_diary_format();
  init_config();
  function parseEntryFile(content, filePath) {
    const parsed = parseDiaryEntryFile(content);
    const meta = resolveDiaryEntryMeta(filePath, parsed);
    if (!meta) return null;
    const [h = 0, min = 0] = meta.time.split(":").map(Number);
    const tags = parsed.tags.length > 0 ? parsed.tags : ["日记"];
    return {
      date: meta.date,
      time: meta.time,
      timeValue: h * 100 + min,
      tags,
      emoji: tags.map((tag) => getTagEmoji(tag)).join(""),
      content: parsed.body.trim(),
      filename: filePath,
      filePath,
      lineNumber: 0,
      /* 稳定 id：书页 UI（ADR-0230）按 `data-eid` 定位条目（便签菜单 / 撕页 / 明信片展信），
         没有 id 时所有日记条目都塌成 `data-eid=""`——右键哪一篇都会落到最后一篇上。
         与影视/信/书同一套 `makeEntryId` 口径（一目一文件，路径即唯一）。 */
      id: makeEntryId("diary", { path: filePath }, meta.date)
    };
  }
  function getFileFrontmatter(file, app) {
    const cache = app.metadataCache.getFileCache(file);
    return cache && cache.frontmatter ? cache.frontmatter : null;
  }
  var FALLBACK_TIME = "00:00";
  var FALLBACK_TIME_VALUE = 0;
  function makeEntryId(prefix, file, dateStr) {
    return `${prefix}-${file.path.replace(/\//g, "-")}-${dateStr}`;
  }
  function pickFmStrings(fm, keys) {
    const out = {};
    for (const k of keys) {
      const v = fm == null ? void 0 : fm[k];
      if (v === void 0 || v === null) continue;
      const s = String(v).trim();
      if (s) out[k] = s;
    }
    return out;
  }
  async function parseMovieFile(file, app) {
    try {
      const fm = getFileFrontmatter(file, app);
      if (!fm) return null;
      let review = fm["影评"];
      if (!review || review.trim() === "") return null;
      let dateStr = fm["观影日期"];
      if (!dateStr || !(0, import_moment.default)(dateStr, "YYYY-MM-DD", true).isValid()) return null;
      dateStr = (0, import_moment.default)(dateStr).format("YYYY-MM-DD");
      let poster = fm["海报"];
      const timeStr = FALLBACK_TIME;
      const timeValue = FALLBACK_TIME_VALUE;
      let rawTag = "";
      if (fm.tags && Array.isArray(fm.tags) && fm.tags.length > 0) {
        rawTag = fm.tags[0];
      } else if (fm.tags && typeof fm.tags === "string") {
        rawTag = fm.tags;
      }
      let mainTag = "日记";
      if (rawTag === "电影") mainTag = "电影";
      else if (rawTag === "纪录片") mainTag = "纪录片";
      else if (rawTag.endsWith("剧")) mainTag = "电视剧";
      else if (rawTag.endsWith("漫")) mainTag = "动漫";
      else if (rawTag === "电视剧") mainTag = "电视剧";
      else if (rawTag === "动漫") mainTag = "动漫";
      const fileNameWithoutExt = file.basename;
      let content = review.trim();
      if (poster && String(poster).trim() !== "") {
        content += `

![[${String(poster).trim()}]]`;
      }
      content += `

#${fileNameWithoutExt}`;
      return {
        date: dateStr,
        time: timeStr,
        timeValue,
        tags: [mainTag],
        emoji: getTagEmoji(mainTag),
        content,
        filename: file.path,
        lineNumber: 0,
        id: makeEntryId("movie", file, dateStr),
        // ADR-0230：票根渲染要的余项（content 里被压平丢掉的那部分 FM）
        extra: {
          title: fileNameWithoutExt.replace(/^《/, "").replace(/》$/, ""),
          review: review.trim(),
          poster: poster && String(poster).trim() !== "" ? String(poster).trim() : void 0,
          meta: pickFmStrings(fm, ["豆瓣评分", "导演", "类型", "片长", "上映日期"])
        }
      };
    } catch (err) {
      console.error(`解析影视文件失败 ${file.path}:`, err);
      return null;
    }
  }
  async function parseLetterFile(file, app) {
    try {
      const fm = getFileFrontmatter(file, app);
      if (!fm) return null;
      if (fm.readonly === true) return null;
      let dateStr = fm.date;
      if (!dateStr) return null;
      let parsed = (0, import_moment.default)(dateStr, ["YYYY-MM-DD", "YYYY-MM-DD HH:mm"], true);
      if (!parsed.isValid()) {
        parsed = (0, import_moment.default)(dateStr);
        if (!parsed.isValid()) return null;
      }
      const dateFormatted = parsed.format("YYYY-MM-DD");
      const timeStr = parsed.format("HH:mm");
      const timeValue = parseInt(parsed.format("HHmm"), 10);
      const fullContent = await app.vault.read(file);
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
      const match = fullContent.match(frontmatterRegex);
      let body = fullContent;
      if (match) {
        body = fullContent.slice(match[0].length);
      }
      body = body.trim();
      const title = file.basename;
      const entryContent = `**${title}**

${body}`.trim();
      return {
        date: dateFormatted,
        time: timeStr,
        timeValue,
        tags: ["信"],
        emoji: getTagEmoji("信"),
        content: entryContent,
        filename: file.path,
        lineNumber: 0,
        id: makeEntryId("letter", file, dateFormatted)
      };
    } catch (err) {
      console.error(`解析信文件失败 ${file.path}:`, err);
      return null;
    }
  }
  async function parseBookFile(file, app) {
    var _a;
    try {
      const fm = getFileFrontmatter(file, app);
      if (!fm) return null;
      const review = fm.bookReview;
      if (!review || String(review).trim() === "") return null;
      let dateStr = (_a = fm.completionDate) != null ? _a : fm.readingDate;
      if (!dateStr || !(0, import_moment.default)(dateStr, "YYYY-MM-DD", true).isValid()) return null;
      dateStr = (0, import_moment.default)(dateStr).format("YYYY-MM-DD");
      const title = (fm.title && String(fm.title).trim() !== "" ? String(fm.title).trim() : null) || file.basename;
      let content = `**《${title}》**`;
      if (review && String(review).trim() !== "") {
        content += `

${String(review).trim()}`;
      }
      const cover = fm.cover;
      if (cover && String(cover).trim() !== "") {
        content += `

![[${String(cover).trim()}]]`;
      }
      const timeStr = FALLBACK_TIME;
      const timeValue = FALLBACK_TIME_VALUE;
      return {
        date: dateStr,
        time: timeStr,
        timeValue,
        tags: ["书"],
        emoji: getTagEmoji("书"),
        content,
        filename: file.path,
        lineNumber: 0,
        id: makeEntryId("book", file, dateStr),
        // ADR-0230：藏书票渲染要的余项（content 里被压平丢掉的那部分 FM）
        extra: {
          title,
          review: String(review).trim(),
          cover: cover && String(cover).trim() !== "" ? String(cover).trim() : void 0,
          author: fm.author && String(fm.author).trim() ? String(fm.author).trim() : void 0,
          category: fm.category && String(fm.category).trim() ? String(fm.category).trim() : void 0
        }
      };
    } catch (err) {
      console.error(`解析书文件失败 ${file.path}:`, err);
      return null;
    }
  }
  function parseNaturalTime(input) {
    if (!input) return null;
    const now = (0, import_moment.default)();
    const lower = input.toLowerCase().trim();
    const relMatch = lower.match(/^(\d+)\s*(分钟?|小时?|天|秒)前$/);
    if (relMatch) {
      const num = parseInt(relMatch[1], 10);
      const unit = relMatch[2];
      if (unit.startsWith("分")) return now.clone().subtract(num, "minutes");
      if (unit.startsWith("小")) return now.clone().subtract(num, "hours");
      if (unit === "天") return now.clone().subtract(num, "days");
      if (unit === "秒") return now.clone().subtract(num, "seconds");
    }
    const yesterdayMatch = lower.match(/^昨天\s*(\d{1,2}:\d{2})$/);
    if (yesterdayMatch) {
      const time = yesterdayMatch[1];
      const yesterday = now.clone().subtract(1, "days");
      return (0, import_moment.default)(`${yesterday.format("YYYY-MM-DD")} ${time}`, "YYYY-MM-DD HH:mm", true);
    }
    const beforeYesterdayMatch = lower.match(/^前天\s*(\d{1,2}:\d{2})$/);
    if (beforeYesterdayMatch) {
      const time = beforeYesterdayMatch[1];
      const before = now.clone().subtract(2, "days");
      return (0, import_moment.default)(`${before.format("YYYY-MM-DD")} ${time}`, "YYYY-MM-DD HH:mm", true);
    }
    const std = (0, import_moment.default)(input, "YYYY-MM-DD HH:mm", true);
    if (std.isValid()) return std;
    return null;
  }
  function parseFlexibleDateTime(input) {
    const natural = parseNaturalTime(input);
    if (natural && natural.isValid()) return natural;
    return (0, import_moment.default)(input, "YYYY-MM-DD HH:mm", true);
  }

  // src/diary/data.ts
  init_diary_format();
  init_config();
  init_domain_bus();
  var MEDIA_EXT_KIND = {
    jpg: "img",
    jpeg: "img",
    png: "img",
    webp: "img",
    gif: "img",
    avif: "img",
    mp4: "video",
    mov: "video",
    webm: "video",
    wav: "audio",
    m4a: "audio",
    mp3: "audio",
    flac: "audio",
    aac: "audio",
    ogg: "audio"
  };
  var WIKILINK_RE = /!\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
  function extractMedia(content, vaultDir) {
    const seen = /* @__PURE__ */ new Set();
    const media = [];
    const re = new RegExp(WIKILINK_RE.source, "g");
    let m;
    while ((m = re.exec(content)) !== null) {
      const ref = m[1].trim();
      const dot = ref.lastIndexOf(".");
      if (dot <= 0 || dot === ref.length - 1) continue;
      const ext = ref.slice(dot + 1).toLowerCase();
      const kind = MEDIA_EXT_KIND[ext];
      if (!kind) continue;
      if (seen.has(ref)) continue;
      seen.add(ref);
      media.push({ name: ref, kind });
    }
    return media;
  }
  function stripMediaLinks(content) {
    const re = new RegExp(WIKILINK_RE.source, "g");
    return content.replace(re, (whole, ref) => {
      const name = ref.trim();
      const dot = name.lastIndexOf(".");
      if (dot <= 0 || dot === name.length - 1) return whole;
      return MEDIA_EXT_KIND[name.slice(dot + 1).toLowerCase()] ? "" : whole;
    }).trim();
  }
  var READ_BATCH_SIZE = 10;
  var progressSinks = /* @__PURE__ */ new Set();
  function onWallProgress(fn) {
    progressSinks.add(fn);
    return () => {
      progressSinks.delete(fn);
    };
  }
  function emitWallProgress(done, total) {
    for (const fn of [...progressSinks]) {
      try {
        fn(done, total);
      } catch (e) {
      }
    }
  }
  async function readBatch(batch, readOne, failed) {
    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          return await readOne(file);
        } catch (e) {
          const path = (file == null ? void 0 : file.path) || String(file);
          failed.push(path);
          return [];
        }
      })
    );
    const out = [];
    for (const r of results) out.push(...r);
    return out;
  }
  function warnFailedBatch(kind, failed) {
    if (failed.length > 0) {
      console.warn(`[diary] ${kind}加载：${failed.length} 个文件读取失败已跳过：`, failed.join(", "));
    }
  }
  async function collectMdPaths(app, dirPath) {
    const out = [];
    const stack = [dirPath.replace(/\/+$/, "") || "/"];
    const seen = /* @__PURE__ */ new Set();
    while (stack.length) {
      const dir = stack.pop();
      if (seen.has(dir)) continue;
      seen.add(dir);
      let listing;
      try {
        listing = await app.vault.adapter.list(dir);
      } catch (e) {
        continue;
      }
      if (!listing) continue;
      for (const f of listing.files || []) {
        if (f.toLowerCase().endsWith(".md")) out.push(f);
      }
      for (const d of listing.folders || []) stack.push(d);
    }
    return out;
  }
  async function mdFilesUnder(app, dirPath) {
    const vault = app.vault;
    const mdPaths = await collectMdPaths(app, dirPath);
    const mdFiles = [];
    for (const p of mdPaths) {
      const f = vault.getAbstractFileByPath(p);
      if (f && !("children" in f) && f.extension === "md") mdFiles.push(f);
    }
    return mdFiles;
  }
  function extractSegments(content) {
    const segs = [];
    const re = new RegExp(WIKILINK_RE.source, "g");
    let last = 0;
    let m;
    const pushText = (raw) => {
      const t = raw.trim();
      if (t) segs.push({ kind: "text", text: t });
    };
    while ((m = re.exec(content)) !== null) {
      pushText(content.slice(last, m.index));
      const ref = m[1].trim();
      const dot = ref.lastIndexOf(".");
      const kind = dot > 0 && dot < ref.length - 1 ? MEDIA_EXT_KIND[ref.slice(dot + 1).toLowerCase()] : void 0;
      if (kind) segs.push({ kind: "media", media: { name: ref, kind } });
      else pushText(m[0]);
      last = re.lastIndex;
    }
    pushText(content.slice(last));
    return segs;
  }
  function toWallEntry(e, kind, dir) {
    return {
      date: e.date,
      time: e.time,
      tags: e.tags,
      emoji: e.emoji,
      content: e.content,
      // 透传解析层条目的定位/标识信息：供 UI 跳转/动作区分
      // （ADR-0130 起日记/影视/信/书的 filename 均为完整 vault 路径）
      filename: e.filename,
      filePath: e.filePath,
      lineNumber: e.lineNumber,
      id: e.id,
      // 加密日记条目的保险箱 SafeNote id（encrypted=true 时存在；UI 解密时用，非加密条目为 undefined）
      noteId: e.noteId,
      kind,
      media: extractMedia(e.content, dir),
      // 渲染用正文：去媒体嵌入，保留 markdown 语法（content 保留原文供复制/跳转）
      text: stripMediaLinks(e.content),
      // 按原文顺序的内容段（issue 213：UI 段序渲染，文字不重复、媒体归位）
      segments: extractSegments(e.content),
      // 附加元信息（ADR-0230）：影视/书库的展示余项——票根 meta/score、藏书票 author/category
      extra: e.extra
    };
  }
  async function loadDiaryEntries(app, diaryDir) {
    const vault = app.vault;
    const mdFiles = await mdFilesUnder(app, diaryDir);
    const entries = [];
    const failed = [];
    for (let i = 0; i < mdFiles.length; i += READ_BATCH_SIZE) {
      const batch = mdFiles.slice(i, i + READ_BATCH_SIZE);
      entries.push(
        ...await readBatch(
          batch,
          async (file) => {
            if (!diaryMetaFromEntryPath(file.name)) return [];
            const content = await vault.read(file);
            const e = parseEntryFile(content, file.path);
            return e ? [toWallEntry(e, "diary", diaryDir)] : [];
          },
          failed
        )
      );
      if (progressSinks.size) emitWallProgress(Math.min(i + READ_BATCH_SIZE, mdFiles.length), mdFiles.length);
    }
    warnFailedBatch("日记", failed);
    return entries;
  }
  async function loadSpecialEntries(app, dir, kind, parse) {
    const mdFiles = await mdFilesUnder(app, dir);
    const entries = [];
    const failed = [];
    for (let i = 0; i < mdFiles.length; i += READ_BATCH_SIZE) {
      const batch = mdFiles.slice(i, i + READ_BATCH_SIZE);
      entries.push(
        ...await readBatch(
          batch,
          async (file) => {
            const e = await parse(file, app);
            return e ? [toWallEntry(e, kind, dir)] : [];
          },
          failed
        )
      );
    }
    warnFailedBatch(kind, failed);
    return entries;
  }
  async function readWallEntriesFresh(app) {
    const [diaryE, movieE, letterE, bookE] = await Promise.all([
      loadDiaryEntries(app, DIARY_DIRECTORY),
      loadSpecialEntries(app, movieDirectory(), "movie", parseMovieFile),
      loadSpecialEntries(app, LETTER_DIRECTORY, "letter", parseLetterFile),
      loadSpecialEntries(app, bookDirectory(), "book", parseBookFile)
    ]);
    const entries = [...diaryE, ...movieE, ...letterE, ...bookE];
    entries.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
    });
    return entries;
  }
  var wallCacheApp = null;
  var currentCtrl = null;
  var offFns = [];
  function detachWallInvalidators() {
    for (const off of offFns) off();
    offFns = [];
  }
  function attachWallInvalidators(ctrl) {
    const onPath = (p) => {
      if (p && currentCtrl === ctrl && inWallDirs(p)) ctrl.invalidated = true;
    };
    const off = (ch, handler) => {
      offFns.push(onDomainEvent(ch, handler));
    };
    off("vault:md-created", (e) => onPath(e == null ? void 0 : e.path));
    off("vault:md-modified", (e) => onPath(e == null ? void 0 : e.path));
    off("vault:md-deleted", (e) => onPath(e == null ? void 0 : e.path));
    off("vault:md-renamed", (e) => {
      onPath(e == null ? void 0 : e.newPath);
      onPath(e == null ? void 0 : e.oldPath);
    });
  }
  async function loadWallEntries(app) {
    if (wallCacheApp !== app) {
      detachWallInvalidators();
      currentCtrl = null;
      wallCacheApp = app;
    }
    if (currentCtrl && !currentCtrl.invalidated) return currentCtrl.promise;
    detachWallInvalidators();
    const ctrl = { promise: readWallEntriesFresh(app), invalidated: false };
    currentCtrl = ctrl;
    attachWallInvalidators(ctrl);
    try {
      const entries = await ctrl.promise;
      if (currentCtrl === ctrl && ctrl.invalidated) currentCtrl = null;
      return entries;
    } catch (e) {
      if (currentCtrl === ctrl) currentCtrl = null;
      throw e;
    }
  }
  function invalidateWallCache() {
    detachWallInvalidators();
    currentCtrl = null;
    wallCacheApp = null;
  }
  function wallCacheFresh(app) {
    return wallCacheApp === app && !!currentCtrl && !currentCtrl.invalidated;
  }
  function mediaSrc(app, mediaName, sourcePath) {
    var _a, _b, _c;
    if (!mediaName) return "";
    const basePath = sourcePath != null ? sourcePath : "";
    const file = (_c = (_b = (_a = app.metadataCache) == null ? void 0 : _a.getFirstLinkpathDest) == null ? void 0 : _b.call(_a, mediaName, basePath)) != null ? _c : app.vault.getAbstractFileByPath(mediaName);
    if (!file || "children" in file) return "";
    try {
      return app.vault.getResourcePath(file);
    } catch (e) {
      return "";
    }
  }

  // src/diary/render.ts
  init_str();
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  var NUM_CN = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  function pad22(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function cnNum(n) {
    const v = Math.floor(Number(n));
    if (!isFinite(v) || v < 0) return "——";
    if (v <= 10) return NUM_CN[v];
    if (v < 20) return "十" + (v % 10 ? NUM_CN[v % 10] : "");
    if (v < 100) return NUM_CN[Math.floor(v / 10)] + "十" + (v % 10 ? NUM_CN[v % 10] : "");
    if (v < 1e3) {
      const r = v % 100;
      const s = NUM_CN[Math.floor(v / 100)] + "百";
      if (!r) return s;
      if (r < 10) return s + "零" + NUM_CN[r];
      if (r < 20) return s + "一十" + (r % 10 ? NUM_CN[r % 10] : "");
      return s + cnNum(r);
    }
    if (v < 1e4) {
      const r = v % 1e3;
      const s = NUM_CN[Math.floor(v / 1e3)] + "千";
      if (!r) return s;
      return s + (r < 100 ? "零" + cnNum(r) : cnNum(r));
    }
    return String(v);
  }
  function weekdayOf(dateStr) {
    const d = /* @__PURE__ */ new Date(dateStr + "T12:00:00");
    return "星期" + WEEK[d.getDay()];
  }
  var TILT_BUCKETS = 6;
  function tiltClassOf(seed) {
    const x = Math.sin(seed * 997) * 1e4;
    const t = (x - Math.floor(x) - 0.5) * 4;
    const k = Math.min(TILT_BUCKETS - 1, Math.max(0, Math.floor((t + 2) / 4 * TILT_BUCKETS)));
    return `bz-diary-tilt-${k}`;
  }
  function inlineMd(s) {
    let t = esc(s);
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target, alias) => {
      const label = alias || target.split("/").pop().replace(/\.md$/, "");
      return '<span class="bz-diary-wikilink" data-target="' + esc(target) + '">' + esc(label) + "</span>";
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<i>$2</i>");
    t = t.replace(/==([^=]+)==/g, '<mark class="bz-diary-hl">$1</mark>');
    t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    return t;
  }
  function splitTextBlocks(text) {
    const blocks = [];
    const lines = String(text).split(/\r?\n/);
    let i = 0;
    let pendingBlank = 0;
    const emit = (b) => {
      if (pendingBlank) {
        blocks.push({ t: "blank", n: Math.min(pendingBlank, 3) });
        pendingBlank = 0;
      }
      blocks.push(b);
    };
    const pushPara = (s) => {
      if (s.length <= 240) {
        emit({ t: "para", text: s });
        return;
      }
      let cur = "";
      let first = true;
      const segs = s.split(/(?<=[。!?;~」”…])/);
      for (const seg of segs) {
        cur += seg;
        if (cur.length > 200) {
          emit({ t: "para", text: cur, cont: !first });
          first = false;
          cur = "";
        }
      }
      if (cur) emit({ t: "para", text: cur, cont: !first });
    };
    while (i < lines.length) {
      const line = lines[i];
      if (/^```/.test(line)) {
        const buf2 = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          buf2.push(lines[i]);
          i++;
        }
        i++;
        emit({ t: "code", text: buf2.join("\n") });
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        emit({ t: "head", level: h[1].length, text: h[2] });
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        const buf2 = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf2.push(lines[i].replace(/^>\s?/, ""));
          i++;
        }
        emit({ t: "quote", text: buf2.join("\n") });
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
          if (!m) break;
          items.push(m[1]);
          i++;
        }
        emit({ t: "list", ordered: false, items });
        continue;
      }
      if (/^\s*\d+[.、]\s+/.test(line)) {
        const items = [];
        while (i < lines.length) {
          const m = lines[i].match(/^\s*\d+[.、]\s+(.*)$/);
          if (!m) break;
          items.push(m[1]);
          i++;
        }
        emit({ t: "list", ordered: true, items });
        continue;
      }
      if (/^(---+|\*\*\*+)$/.test(line.trim())) {
        emit({ t: "hr" });
        i++;
        continue;
      }
      if (line.trim() === "") {
        pendingBlank++;
        i++;
        continue;
      }
      const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+[.、]\s|```|!\[\[)/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      pushPara(buf.join(""));
    }
    return blocks;
  }
  var HASH_RE = new RegExp("(^|[\\s(（【\\[])#([^\\s#,.!?;:、,。!?~»」』”…]+)", "g");
  function stripHashInto(t, out) {
    return String(t).replace(HASH_RE, (_m, pre, tag) => {
      out.push(tag);
      return pre;
    });
  }
  function sealHTML(e, hashes) {
    const tags = e.tags.map((t) => '<span class="bz-diary-seal-tag">' + esc(t) + "</span>").join("");
    const hs = hashes.length ? '<span class="bz-diary-seal-hashes">' + hashes.map((t) => '<span class="bz-diary-seal-hash">#' + esc(t) + "</span>").join("") + "</span>" : "";
    const time = e.kind === "diary" || e.kind === "letter" ? '<span class="bz-diary-seal-time">' + esc(e.time) + "</span>" : "";
    return time + '<span class="bz-diary-seal-tags">' + tags + "</span>" + hs;
  }
  function photoHTML(m, e, lbIndex, ctx) {
    const name = m.name;
    const lazy = !!e.encrypted;
    const hook = lazy ? ' data-enc-name="' + esc(name) + '" data-enc-kind="' + m.kind + '"' : "";
    const src = lazy ? "" : ' src="' + esc(ctx.mediaSrc(name)) + '"';
    if (m.kind === "audio") {
      const label = name.split("/").pop() || name;
      return '<div class="bz-diary-b-audio" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-ba-card"><span class="bz-diary-ba-play">▷</span><span class="bz-diary-ba-mid"><span class="bz-diary-ba-name">♪ ' + esc(label) + '</span><span class="bz-diary-ba-bar"><i></i></span></span><span class="bz-diary-ba-time">--:--</span></div><audio preload="none"' + src + hook + "></audio></div>";
    }
    const stem = String(name.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
    const alt = esc(
      /[^\d\s_\-.]/.test(stem) ? stem.slice(0, 16) : e.date.slice(5).replace("-", "/") + " " + e.time
    );
    const inner = m.kind === "video" ? "<video" + src + ' preload="metadata" muted playsinline' + hook + "></video>" : "<img" + src + ' loading="lazy" alt="' + alt + '"' + hook + ">";
    return '<div class="bz-diary-b-photo" data-eid="' + esc(e.id || "") + '"><figure class="bz-diary-photo ' + tiltClassOf(lbIndex) + '"' + (lazy ? "" : ' data-lb="' + lbIndex + '"') + '><div class="bz-diary-ph-media">' + inner + "</div></figure></div>";
  }
  var TICKET_META_ROWS = [
    ["导演", "导演"],
    ["类型", "类型"],
    ["片长", "片长"],
    ["上映日期", "上映"]
  ];
  function ticketHTML(e, ctx) {
    const x = e.extra || {};
    const meta = x.meta || {};
    const rows = [];
    for (const [key, label] of TICKET_META_ROWS) {
      const v = meta[key];
      if (!v) continue;
      rows.push("<b>" + esc(label) + "</b> " + esc(label === "上映" ? v.slice(0, 10) : v.slice(0, 40)));
    }
    const score = meta["豆瓣评分"] ? '<span class="bz-diary-tk-score">★ ' + esc(meta["豆瓣评分"]) + "</span>" : "";
    const poster = x.poster ? '<img class="bz-diary-tk-poster" data-media-err="bz-diary-ph-empty" src="' + esc(ctx.mediaSrc(x.poster)) + '" loading="lazy" alt="">' : '<i class="bz-diary-tk-poster bz-diary-ph-empty"></i>';
    return '<div class="bz-diary-ticket" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-tk-main"><span class="bz-diary-tk-kind">' + esc(e.tags[0] || "") + ' · 观影票根</span><div class="bz-diary-tk-title">《' + esc(x.title || "") + '》</div><div class="bz-diary-tk-meta">' + rows.join("　") + (rows.length ? "　" : "") + score + '</div><div class="bz-diary-tk-review">' + inlineMd(x.review || "") + '</div><span class="bz-diary-tk-more">… 影评全文</span></div><div class="bz-diary-tk-stub">' + poster + '<span class="bz-diary-tk-date">' + esc(e.date) + "</span>" + esc(e.emoji) + "</div></div>";
  }
  function exlibrisHTML(e, ctx) {
    const x = e.extra || {};
    const cover = x.cover ? '<img class="bz-diary-ex-cover" data-media-err="bz-diary-ex-nothing" src="' + esc(ctx.mediaSrc(x.cover)) + '" loading="lazy" alt="">' : '<i class="bz-diary-ex-nothing"></i>';
    const byline = x.author ? esc(x.author) + (x.category ? " · " + esc(x.category) : "") : esc(x.category || "");
    return '<div class="bz-diary-exlibris" data-eid="' + esc(e.id || "") + '">' + cover + '<div class="bz-diary-ex-main"><div class="bz-diary-ex-title">《' + esc(x.title || "") + '》</div><div class="bz-diary-ex-author">' + byline + '</div><div class="bz-diary-ex-review">' + inlineMd(x.review || "") + '</div><div class="bz-diary-ex-date">读毕 ' + esc(e.date) + " · " + esc(e.emoji) + "</div></div></div>";
  }
  function paraHTML(b, e) {
    return '<div class="bz-diary-b-para ' + (b.cont ? "bz-diary-p-cont" : "bz-diary-p-indent") + '" data-eid="' + esc(e.id || "") + '">' + inlineMd(b.text) + "</div>";
  }
  function envelopeHTML(e) {
    return '<div class="bz-diary-b-envelope"><div class="bz-diary-envelope" data-eid="' + esc(e.id || "") + '"><div class="bz-diary-env-body"><div class="bz-diary-env-flap"></div><div class="bz-diary-env-split"><i class="bz-diary-es-l"></i><i class="bz-diary-es-r"></i></div><div class="bz-diary-env-wax">🔐</div><div class="bz-diary-env-label">火漆封缄 · 拆信需主密码</div></div><span class="bz-diary-env-reseal">重新封缄</span></div></div>';
  }
  function entryBlockHTMLs(e, ctx, opts = {}) {
    const eid = esc(e.id || "");
    const wrap = (cls, inner) => '<div class="' + cls + '" data-eid="' + eid + '">' + inner + "</div>";
    if (e.encrypted && !opts.unwrap) return [envelopeHTML(e)];
    const hashes = [];
    for (const seg of e.segments) {
      if (seg.kind !== "text") continue;
      for (const b of splitTextBlocks(seg.text)) {
        if (b.t === "para" || b.t === "quote") stripHashInto(b.text, hashes);
      }
    }
    const out = [];
    out.push('<div class="bz-diary-b-seal" data-eid="' + eid + '">' + sealHTML(e, hashes) + "</div>");
    if (e.kind === "movie") return out.concat(wrap("bz-diary-b-ticket", ticketHTML(e, ctx)));
    if (e.kind === "book") return out.concat(wrap("bz-diary-b-exlibris", exlibrisHTML(e, ctx)));
    if (e.kind === "letter") {
      out.push(
        '<div class="bz-diary-b-head" data-eid="' + eid + '">' + esc(basenameOf(e.filename)) + "</div>"
      );
    }
    for (const seg of e.segments) {
      if (seg.kind === "media") {
        out.push(photoHTML(seg.media, e, ctx.lbIndexOf(seg.media.name), ctx));
        continue;
      }
      for (const b of splitTextBlocks(seg.text)) {
        switch (b.t) {
          case "blank":
            out.push(
              '<div class="bz-diary-b-blank bz-diary-blank-' + b.n + '" data-eid="' + eid + '"></div>'
            );
            break;
          case "para": {
            const t = stripHashInto(b.text, []);
            if (t.trim()) out.push(paraHTML({ text: t, cont: b.cont }, e));
            break;
          }
          case "head":
            out.push(
              '<div class="bz-diary-b-head' + (b.level > 2 ? " bz-diary-h2" : "") + '" data-eid="' + eid + '">' + esc(b.text.replace(/[#*]/g, "")) + "</div>"
            );
            break;
          case "quote": {
            const t = stripHashInto(b.text, []);
            out.push(wrap("bz-diary-b-quote", inlineMd(t).replace(/\n/g, "<br>")));
            break;
          }
          case "list":
            out.push(
              '<ul class="bz-diary-b-list' + (b.ordered ? " bz-diary-ordered" : "") + '" data-eid="' + eid + '">' + b.items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ul>"
            );
            break;
          case "code":
            out.push(wrap("bz-diary-b-code", esc(b.text)));
            break;
          case "hr":
            out.push('<hr class="bz-diary-b-hr" data-eid="' + eid + '">');
            break;
        }
      }
    }
    return out;
  }
  function daystampHTML(date, count) {
    const [y, m, dd] = date.split("-");
    return '<div class="bz-diary-b-daystamp" data-date="' + esc(date) + '"><div class="bz-diary-dstamp"><span class="bz-diary-ds-day">' + Number(dd) + '</span><span class="bz-diary-ds-side"><b>' + parseInt(m, 10) + "月</b><i>" + weekdayOf(date) + "</i><em>" + cnNum(count) + ' 则</em></span><span class="bz-diary-ds-year">' + esc(y) + '</span></div><div class="bz-diary-ds-wave"></div></div>';
  }
  function writeDaystampHTML(date) {
    const [y, m, dd] = date.split("-");
    return '<div class="bz-diary-dstamp"><span class="bz-diary-ds-day">' + Number(dd) + '</span><span class="bz-diary-ds-side"><b>' + parseInt(m, 10) + "月</b><i>" + weekdayOf(date) + '</i><em><span class="bz-diary-wsp-datebtn">改日子 · 时辰</span></em></span><span class="bz-diary-ds-year">' + esc(y) + '</span></div><div class="bz-diary-ds-wave"></div>';
  }
  function basenameOf(p) {
    return String(p || "").split("/").pop().replace(/\.md$/, "");
  }
  function bookPanelHTML() {
    return `
  <!-- 收起整本：右上角常驻一枚出口（另两条路：点遮罩、Esc——先翻回最新那篇，再按一次收起） -->
  <button class="bz-diary-close" type="button" title="收起日记本（Esc）" aria-label="收起日记本">${iconSpan("x")}</button>

    <div class="bz-diary-desk">
    <!-- 遮罩层（token 底色 + blur）：点空白处收起整本；书：打开就落在最新那篇（第 0 页 = 最近一则） -->
    <div class="bz-diary-book" tabindex="0">
      <!-- 底壳与厚度 -->
      <div class="bz-diary-bk-shell"></div>
      <div class="bz-diary-bk-under"></div>
      <!-- 书口：书页那一摞的侧面，压在书页底下只探出右沿几像素——点它抽出册页索引 -->
      <div class="bz-diary-bk-edge"></div>
      <span class="bz-diary-eb-hint">抽出册页索引</span>

      <!-- 芯：StPageFlip 书（全是正文页，无扉页；库管理翻页动画/拖拽） -->
      <div class="bz-diary-bk-block">
        <div class="bz-diary-flipbook"></div>
      </div>

      <!-- 分类书签条（筛选态） -->
      <div class="bz-diary-filter-tab"><span class="bz-diary-ft-name"></span><span class="bz-diary-ft-x">取下</span></div>

      <!-- 写作内页（ADR-0233）：点「写」就在书上摊开一张素纸，正文写在这一页上。
           摆这一层（书页之上、书壳之内）而不是进 StPageFlip 的书页流：草稿不该被分页，
           而它盖住书页的指针区，「草稿在时不翻页」也就落成了物理事实。
           日戳由 ui 侧填（与 daystampHTML 同源），贴纸 chips 与正文区在这里只是空壳。 -->
      <div class="bz-diary-wsp" hidden>
        <div class="bz-diary-wsp-sheet">
          <div class="bz-diary-wsp-day"></div>
          <textarea class="bz-diary-wsp-area" spellcheck="false" placeholder="笔递给你了，写吧……"></textarea>
          <div class="bz-diary-wsp-tools"></div>
          <div class="bz-diary-wsp-acts">
            <span class="bz-diary-wsp-act" data-wact="discard">揉掉</span>
            <span class="bz-diary-wsp-act bz-diary-wsp-primary" data-wact="save">落笔</span>
          </div>
        </div>
        <div class="bz-diary-wsp-pageno">— 新的一页 —</div>
      </div>
    </div>

    <!-- 开册进度：读全量之前书还是空的（上千篇正文走磁盘读、每批 10），
         桌上先摆一张「正在翻找」的纸条报读到哪儿了，读完换「正在装订」，成册即收。
         不吃指针（pointer-events: none）：读盘期间点遮罩照样能收起整本。 -->
    <div class="bz-diary-loading" hidden>
      <div class="bz-diary-ld-paper">
        <div class="bz-diary-ld-title"></div>
        <div class="bz-diary-ld-bar"></div>
        <div class="bz-diary-ld-count"></div>
      </div>
    </div>

    <!-- 案头文具挂在桌上、不挂在书里：书在窄桌面下会被整体缩小，
         文具跟着缩就成了「小一号的纸签」。挂在桌上按缩放后的书沿定位，尺寸永远是真的。
         文具共四件：写 / 找 / 跳 / 类 —— 原型第五件「抹（抹掉全部本地涂改）」处置见 ADR-0230
         决策 9：那是探索稿 localStorage 覆盖层专有的概念，单源没有对应的真对象，故不搬。 -->
    <div class="bz-diary-tools">
      <span class="bz-diary-tl" data-tact="pencil" title="写一篇"><b>写</b></span>
      <span class="bz-diary-tl" data-tact="lens" title="找一找"><b>找</b></span>
      <span class="bz-diary-tl" data-tact="calendar" title="跳日子"><b>跳</b></span>
      <span class="bz-diary-tl" data-tact="stickers" title="按类翻"><b>类</b></span>
    </div>

    <!-- 明信片（那年今日）与引导便签已整件退役：开册就往桌上摆的非请求物件，
         与「只要日记本本身」冲突（桌面端关闭钮也摘了，收起走 Esc / 点遮罩） -->
  </div>

  <!-- 便签菜单（条目操作） -->
  <div class="bz-diary-menu" hidden>
    <div class="bz-diary-mn-item" data-act="retype">换张贴纸</div>
    <div class="bz-diary-mn-item" data-act="envelope">收进信封</div>
    <div class="bz-diary-mn-item" data-act="unseal">拆信看</div>
    <div class="bz-diary-mn-item" data-act="takeout">从信封取出</div>
    <div class="bz-diary-mn-item" data-act="copytext">誊录正文</div>
    <div class="bz-diary-mn-item" data-act="copylink">誊录位置</div>
    <div class="bz-diary-mn-item bz-diary-danger" data-act="tear">撕掉</div>
  </div>

  <!-- 抽出的一张纸：全文阅读（影评/书评/拆开的信） -->
  <div class="bz-diary-sheet" hidden>
    <div class="bz-diary-sheet-paper">
      <div class="bz-diary-sheet-head"><span class="bz-diary-sh-title"></span><span class="bz-diary-sh-close">收回去</span></div>
      <div class="bz-diary-sheet-body"></div>
    </div>
  </div>

  <!-- 纸条层：输入/确认 通用 -->
  <div class="bz-diary-slip" hidden>
    <div class="bz-diary-slip-paper">
      <div class="bz-diary-slip-title"></div>
      <div class="bz-diary-slip-body"></div>
      <div class="bz-diary-slip-row"></div>
    </div>
  </div>

  <!-- 火漆密码框：拆信/收进信封/看加密照片都要过这道（主密码交给真保险箱校验，
       本域只负责收，绝不碰密码学——原型那个演示用假密码框不搬，见 ui.ts 头部注记） -->
  <div class="bz-diary-pass" hidden>
    <div class="bz-diary-pass-paper">
      <div class="bz-diary-pass-wax">${iconSpan("lock")}</div>
      <div class="bz-diary-pass-title">火漆封缄</div>
      <div class="bz-diary-pass-desc">这一下要动保险箱，先报主密码</div>
      <input class="bz-diary-pass-input" type="password" spellcheck="false"
             autocomplete="off" placeholder="主密码">
      <div class="bz-diary-pass-err"></div>
      <div class="bz-diary-pass-row">
        <span class="bz-diary-pass-btn" data-pact="cancel">算了</span>
        <span class="bz-diary-pass-btn bz-diary-primary" data-pact="ok">拆封</span>
      </div>
    </div>
  </div>

  <!-- 贴纸册弹层 -->
  <div class="bz-diary-album-pop" hidden>
    <div class="bz-diary-ap-book">
      <div class="bz-diary-ap-head">贴纸册<span class="bz-diary-ap-sub"></span></div>
      <div class="bz-diary-ap-grid"></div>
      <div class="bz-diary-ap-foot"><span class="bz-diary-ap-confirm bz-diary-slip-btn bz-diary-primary" hidden>盖上去</span><span class="bz-diary-ap-cancel">合上</span></div>
    </div>
  </div>

  <!-- 台历弹层 -->
  <div class="bz-diary-cal-pop" hidden>
    <div class="bz-diary-cal">
      <div class="bz-diary-cal-head">
        <span class="bz-diary-cal-nav" data-nav="-1">◂</span>
        <span class="bz-diary-cal-ym"></span>
        <span class="bz-diary-cal-nav" data-nav="1">▸</span>
      </div>
      <div class="bz-diary-cal-grid"></div>
      <div class="bz-diary-cal-time-row" hidden>
        <span class="bz-diary-ct-label">时辰</span>
        <input class="bz-diary-ct-input" spellcheck="false" placeholder="21:30 或「1 分钟前」">
        <span class="bz-diary-ct-err"></span>
      </div>
      <div class="bz-diary-cal-foot"><span class="bz-diary-cal-ok">就这天</span><span class="bz-diary-cal-cancel">合上</span></div>
    </div>
  </div>

  <!-- 灯箱：相片显影 -->
  <div class="bz-diary-lightbox" hidden>
    <figure class="bz-diary-lb-photo">
      <div class="bz-diary-lb-media"></div>
      <figcaption class="bz-diary-lb-cap"></figcaption>
    </figure>
    <div class="bz-diary-lb-nav bz-diary-lb-prev">◂</div>
    <div class="bz-diary-lb-nav bz-diary-lb-next">▸</div>
    <div class="bz-diary-lb-count"></div>
  </div>

  <div class="bz-diary-toast" hidden></div>
  <div class="bz-diary-fallback" hidden><div class="bz-diary-fb-paper">册子的数据没读出来。<br>可以把日记本关掉再开一次试试。</div></div>
    `;
  }
  var MIME_BY_EXT = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    avif: "image/avif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    wav: "audio/wav",
    m4a: "audio/mp4",
    mp3: "audio/mpeg",
    flac: "audio/flac",
    aac: "audio/aac",
    ogg: "audio/ogg"
  };
  function mimeOfMediaName(name) {
    const dot = name.lastIndexOf(".");
    const ext = dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
    return MIME_BY_EXT[ext] || "application/octet-stream";
  }

  // src/diary/store.ts
  init_app();
  init_notice();
  init_domain_bus();
  init_storage();
  init_diary_format();

  // src/diary/repair.ts
  init_diary_format();
  function lintEntryFile(path, content) {
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    if (DIARY_LEGACY_FILE_RE.test(base)) return "legacy";
    const raw = readDiaryFrontmatterFieldRaw(content, DIARY_DATE_KEY);
    const rawLegacyKey = readDiaryFrontmatterFieldRaw(content, "日期");
    const fmMeta = raw ? parseDiaryStamp(raw) : null;
    const fileMeta = diaryMetaFromEntryPath(base);
    if (rawLegacyKey && !raw) return "unparsable";
    if (raw && !fmMeta && !fileMeta) return "unparsable";
    if (!fmMeta && !fileMeta) return "unparsable";
    if (raw && !fmMeta && fileMeta) return "unparsable";
    if (fmMeta && !fileMeta) return "name-mismatch";
    if (fmMeta && fileMeta && diaryStampText(fmMeta.date, fmMeta.time) !== diaryStampText(fileMeta.date, fileMeta.time)) {
      return "name-mismatch";
    }
    return null;
  }

  // src/diary/store.ts
  init_config();
  var diaryDataMap = null;
  function setDiaryDataMap(map) {
    diaryDataMap = map;
  }
  function warnUnparsed(msg, dedupeKey) {
    try {
      notify(msg, { type: "warning", dedupeKey });
    } catch (e) {
    }
  }
  function warnReadFailed(msg, dedupeKey) {
    try {
      notify(msg, { type: "error", dedupeKey });
    } catch (e) {
    }
  }
  var UnparsedLineError = class extends Error {
    constructor(dateStr, count) {
      super(`「${dateStr}」无法解析为日记条目，已拒绝处理`);
      this.dateStr = dateStr;
      this.count = count;
      this.name = "UnparsedLineError";
    }
  };
  var DiaryFileReadError = class extends Error {
    constructor(filePath, cause_) {
      super(`日记文件读取失败：${filePath}`);
      this.filePath = filePath;
      this.cause_ = cause_;
      this.name = "DiaryFileReadError";
    }
  };
  function isDiaryReadFailure(e) {
    return e instanceof DiaryFileReadError;
  }
  function extraFrontmatterLines(content) {
    const text = (content || "").replace(/\r\n/g, "\n");
    if (!text.startsWith("---\n")) return [];
    const end = text.indexOf("\n---", 4);
    if (end < 0) return [];
    const out = [];
    let keeping = false;
    for (const line of text.slice(4, end).split("\n")) {
      const kv = /^([^:\s][^:]*):(.*)$/.exec(line);
      if (kv) {
        const key = kv[1].trim();
        keeping = key !== "date" && key !== "type";
        if (keeping) out.push(line);
        continue;
      }
      if (keeping && /^\s+-\s/.test(line)) out.push(line);
    }
    return out;
  }
  function listDateEntryPaths(dateStr) {
    var _a, _b;
    const dirPrefix = `${DIARY_DIRECTORY}/`;
    return (((_b = (_a = getApp().vault).getMarkdownFiles) == null ? void 0 : _b.call(_a)) || []).map((f) => f.path).filter((p) => {
      var _a2;
      return p.startsWith(dirPrefix) && ((_a2 = diaryMetaFromEntryPath(p)) == null ? void 0 : _a2.date) === dateStr;
    });
  }
  async function readEntryCtxInQueue(filePath) {
    const file = getApp().vault.getAbstractFileByPath(filePath);
    let content = "";
    if (file) {
      try {
        content = await getApp().vault.read(file);
      } catch (e) {
        warnReadFailed(
          `「${filePath.split("/").pop()}」日记读取失败，本次修改没有执行（直接写会覆盖整篇日记）。请稍后重试。`,
          `diary-read-failed-${filePath}`
        );
        throw new DiaryFileReadError(filePath, e);
      }
    }
    const entry = file ? parseEntryFile(content, filePath) : null;
    if (file && !entry) {
      warnUnparsed(
        `「${filePath.split("/").pop()}」无法解析为日记条目（文件名非条目形状或日期非法），本次修改没有执行。请检查该文件的文件名与正文里的日期。`,
        `diary-write-refused-${filePath}`
      );
      throw new UnparsedLineError(filePath.split("/").pop() || filePath, 1);
    }
    if (!diaryDataMap) setDiaryDataMap(/* @__PURE__ */ new Map());
    if (file && entry) diaryDataMap.set(filePath, [entry]);
    else diaryDataMap.delete(filePath);
    return { file, content, entry };
  }
  async function withEntryFile(filePath, task) {
    return enqueueFileTask(filePath, async () => task(await readEntryCtxInQueue(filePath)));
  }
  async function addEntry(dateStr, timeStr, tagsArray, content, opts) {
    const [hours = 0, minutes = 0] = timeStr.split(":").map(Number);
    const timeValue = hours * 100 + minutes;
    const dir = (opts == null ? void 0 : opts.filePath) ? opts.filePath.split("/").slice(0, -1).join("/") : DIARY_DIRECTORY;
    const addKey = `${dir}/${dateStr}`;
    const created = await enqueueFileTask(addKey, async () => {
      let seq = 1;
      let filePath = diaryEntryPath(dir, dateStr, timeStr, seq);
      while (getApp().vault.getAbstractFileByPath(filePath)) {
        seq += 1;
        filePath = diaryEntryPath(dir, dateStr, timeStr, seq);
      }
      const finalContent = serializeDiaryEntryFile({ date: dateStr, time: timeStr }, tagsArray, content.trim());
      try {
        await getApp().vault.create(filePath, finalContent);
      } catch (error) {
        console.error(`创建条目文件 ${filePath} 失败:`, error);
        throw error;
      }
      const entry = {
        date: dateStr,
        time: timeStr,
        timeValue,
        tags: tagsArray,
        emoji: tagsArray.map((tag) => getTagEmoji(tag)).join(""),
        content: content.trim(),
        filename: filePath,
        filePath,
        lineNumber: 0,
        id: `${dateStr}-${timeStr.replace(/:/g, "-")}-${Date.now()}`
      };
      if (!diaryDataMap) setDiaryDataMap(/* @__PURE__ */ new Map());
      diaryDataMap.set(filePath, [entry]);
      return entry;
    });
    emitDomainEvent("diary:entry-added", { date: dateStr, time: timeStr, tags: tagsArray, content: content.trim() });
    return created;
  }
  async function removeDiaryEntries(dateStr, match, opts) {
    const paths = (opts == null ? void 0 : opts.filePath) ? [opts.filePath] : listDateEntryPaths(dateStr);
    let removed = 0;
    for (const p of paths) {
      try {
        const del = await enqueueFileTask(p, async () => {
          const { file, entry } = await readEntryCtxInQueue(p);
          if (!file || !entry || !match(entry)) return false;
          await getApp().vault.delete(file);
          if (diaryDataMap) diaryDataMap.delete(p);
          return true;
        });
        if (del) removed += 1;
      } catch (e) {
        if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue;
        throw e;
      }
    }
    return removed;
  }
  async function updateDiaryTags(dateStr, match, newTags, opts) {
    const paths = (opts == null ? void 0 : opts.filePath) ? [opts.filePath] : listDateEntryPaths(dateStr);
    for (const p of paths) {
      let hit = null;
      try {
        hit = await enqueueFileTask(p, async () => {
          const { file, content, entry } = await readEntryCtxInQueue(p);
          if (!file || !entry || !match(entry)) return null;
          if (lintEntryFile(p, content) === "name-mismatch") {
            warnUnparsed(
              `「${p.split("/").pop()}」属性时间与文件名不一致（需人工裁决），本次改标签没有执行。请先修正该文件的文件名或属性时间后再试。`,
              `diary-name-mismatch-${p}`
            );
            return null;
          }
          const changed = entry.tags.join("\0") !== newTags.join("\0");
          if (!changed) return { entry, from: [...entry.tags], changed: false };
          const body = parseDiaryEntryFile(content).body;
          let disk = serializeDiaryEntryFile({ date: entry.date, time: entry.time }, newTags, body);
          const extra = extraFrontmatterLines(content);
          if (extra.length > 0) {
            const closeIdx = disk.indexOf("\n---\n", 4);
            disk = disk.slice(0, closeIdx + 1) + extra.join("\n") + "\n" + disk.slice(closeIdx + 1);
          }
          await getApp().vault.modify(file, disk);
          const from = [...entry.tags];
          entry.tags = [...newTags];
          entry.emoji = newTags.map((tag) => getTagEmoji(tag)).join("");
          if (diaryDataMap) diaryDataMap.set(p, [entry]);
          return { entry, from, changed: true };
        });
      } catch (e) {
        if (isDiaryReadFailure(e) || e instanceof UnparsedLineError) continue;
        throw e;
      }
      if (hit) {
        if (hit.changed) {
          emitDomainEvent("diary:tags-changed", { date: hit.entry.date, time: hit.entry.time, from: hit.from, to: newTags });
        }
        return hit.entry;
      }
    }
    return null;
  }
  async function findDiaryEntry(filename) {
    if (!filename || !filename.includes("/")) return null;
    try {
      return await withEntryFile(filename, ({ entry }) => entry ? { ...entry } : null);
    } catch (e) {
      return null;
    }
  }
  function isUnparsedRefusal(e) {
    return e instanceof UnparsedLineError;
  }
  function rekeyDiaryMapPath(oldPath, newPath) {
    if (!diaryDataMap || !oldPath || !newPath || oldPath === newPath) return false;
    const entries = diaryDataMap.get(oldPath);
    if (!entries) return false;
    diaryDataMap.delete(oldPath);
    for (const e of entries) {
      if (e.filePath === oldPath) e.filePath = newPath;
      if (e.filename === oldPath) e.filename = newPath;
    }
    diaryDataMap.set(newPath, entries);
    return true;
  }
  function dropDiaryMapPath(path) {
    if (!diaryDataMap || !path) return false;
    return diaryDataMap.delete(path);
  }

  // src/diary/ui.ts
  init_encrypt2();

  // src/diary/ui/dialogs.ts
  init_fake_obsidian();
  init_notice();
  init_flow_dialog();
  init_app();
  init_settings_provider();
  init_diary_format();
  init_utils();
  init_domain_bus();
  init_modal();
  init_search();
  init_button();
  init_config();
  init_encrypt2();

  // src/diary/ui/datetime-picker.ts
  init_fake_obsidian();
  init_notice();
  init_esc_manager();
  init_z_order();
  init_app();
  init_diary_format();
  init_config();

  // src/diary/ui/entry-actions.ts
  init_notice();
  init_flow_dialog();
  init_app();
  init_domain_bus();
  init_utils();
  init_encrypt2();

  // src/diary/ui/locator.ts
  function buildLocatorPredicateFor(_dateStr, loc) {
    return (e) => (!loc.filePath || e.filePath === loc.filePath) && e.time === loc.time;
  }

  // src/diary/ui/entry-actions.ts
  function diaryEntryFilePath(entry) {
    return entry.filePath || entry.filename || null;
  }
  async function copyDiaryLink(entry) {
    const filePath = diaryEntryFilePath(entry);
    if (!filePath) {
      notice("找不到原文，无法复制双链", "error");
      return;
    }
    const link = `[[${stripMdExt(filePath)}]]`;
    await navigator.clipboard.writeText(link);
    notice(`已复制双链引用：${link}`, "success");
  }
  function showConfirm(loc) {
    const isEncrypted = !!loc.encrypted;
    void openFlowDialog({
      title: "确认删除",
      // 皮肤类串走域侧惯例（bz-<域>-flow-dialog）：撕页这张是「桌上撕下来的一角纸」，
      // 不是 core 通用流程框
      className: "bz-diary-flow-dialog",
      message: isEncrypted ? "确定删除这篇加密日记吗？\n\n此操作不可撤销，密文将从保险库永久销毁。" : "确定要删除这篇日记吗？\n\n此操作不可撤销，日记将从笔记中永久删除。",
      actions: [
        { label: "取消", value: "cancel" },
        // danger（issue 291 评审补）：删除日记是不可撤销的（加密分支还会销毁保险库密文），
        // 主按钮不得高亮——手册 §9/§10 的慎重决策口径
        { label: "删除日记", value: "ok", cta: true, danger: true }
      ]
    }).then(async (v) => {
      if (v !== "ok") return;
      if (isEncrypted && loc.noteId) {
        await deleteEncryptedEntry(loc.noteId);
        emitDomainEvent("diary:encrypted-purged", { noteId: loc.noteId });
      } else {
        const removed = await removeDiaryEntries(loc.date, await buildLocatorPredicateFor(loc.date, loc), {
          filePath: loc.filePath
        });
        if (removed === 0) {
          notice("未能在日记数据中定位该条目，没有删除", "error");
          return;
        }
        emitDomainEvent("diary:entry-deleted", { date: loc.date, time: loc.time, wasEncrypted: false });
      }
      notice(`已删除日记「${loc.date} ${loc.time}」`, "success");
    }).catch((err) => {
      if (err && (isUnparsedRefusal(err) || isDiaryReadFailure(err))) return;
      notice("删除日记失败：" + ((err == null ? void 0 : err.message) || err), "error");
    });
  }

  // src/diary/motion.ts
  var M3 = { fast: 160, move: 200, base: 280 };
  var E2 = { out: "cubic-bezier(.22,.82,.3,1)" };
  function reduced() {
    try {
      return typeof location !== "undefined" && location.search.includes("rm=1");
    } catch (e) {
      return false;
    }
  }
  function waapi(el, frames, opts) {
    if (!el || reduced() || typeof el.animate !== "function") {
      const last = frames[frames.length - 1];
      if (el && last) {
        for (const k of Object.keys(last)) {
          if (k === "offset") continue;
          try {
            el.style[k] = String(last[k]);
          } catch (e) {
          }
        }
      }
      return null;
    }
    try {
      return el.animate(frames, opts);
    } catch (e) {
      return null;
    }
  }
  function motionSheetDialog(popup) {
    if (reduced()) return;
    const form = popup.querySelector(".bz-diary-form");
    if (!form) return;
    [...form.children].forEach((el, i) => {
      if (i >= 6) return;
      waapi(
        el,
        [
          { opacity: 0, transform: "translateY(7px)", filter: "blur(3px)" },
          { opacity: 1, transform: "none", filter: "blur(0px)" }
        ],
        { duration: M3.base, delay: 40 + i * 50, easing: E2.out, fill: "backwards" }
      );
    });
    popup.querySelectorAll(".diary-tag-selector-btn").forEach((el, i) => {
      if (i >= 14) return;
      waapi(
        el,
        [
          { opacity: 0, transform: "translateY(4px) scale(.94)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: M3.base, delay: 150 + i * 18, easing: E2.out, fill: "backwards" }
      );
    });
  }

  // src/diary/ui/dialogs.ts
  var DIARY_FLOW_SKIN = "bz-diary-flow-dialog";
  var tagUsageCount = /* @__PURE__ */ new Map();
  onDomainEvent("diary:entry-added", (evt) => {
    var _a, _b;
    for (const t of (_a = evt == null ? void 0 : evt.tags) != null ? _a : []) tagUsageCount.set(t, ((_b = tagUsageCount.get(t)) != null ? _b : 0) + 1);
  });
  function sortTagsByUsage(tags) {
    return tags.map((tag, idx) => {
      var _a;
      return { tag, idx, count: (_a = tagUsageCount.get(tag)) != null ? _a : 0 };
    }).sort((a, b) => b.count - a.count || a.idx - b.idx).map((x) => x.tag);
  }
  function createTagOptionButton(tag) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-tag-selector-btn bz-diary-tag-chip bz-touch-target--xl";
    btn.dataset.tag = tag;
    btn.appendChild(document.createTextNode(`${getTagEmoji(tag)} ${tag}`));
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        const badge = document.createElement("span");
        badge.className = "bz-diary-tag-badge";
        badge.textContent = getTagEmoji(parentTag);
        btn.appendChild(badge);
      }
    }
    return btn;
  }
  function renderTagOptions(container, tags, selected) {
    container.innerHTML = "";
    for (const tag of tags) {
      const btn = createTagOptionButton(tag);
      if (selected.has(tag)) btn.classList.add("diary-active");
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle("diary-active");
      };
      container.appendChild(btn);
    }
  }
  function createTagFilter(chipsContainer) {
    const { el, input } = uiSearch({ placeholder: "筛选类型" });
    input.dataset.bzNoFormSubmit = "";
    el.classList.add("bz-diary-tag-filter");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      chipsContainer.querySelectorAll(".diary-tag-selector-btn").forEach((btn) => {
        var _a;
        const tag = (_a = btn.dataset.tag) != null ? _a : "";
        btn.style.display = !q || tag.toLowerCase().includes(q) ? "" : "none";
      });
    });
    return el;
  }
  function collectSelectedTags(container) {
    const names = [];
    container.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
      names.push(btn.dataset.tag);
    });
    return names;
  }
  var activeTagPickerLoc = null;
  var tagPickerUi = null;
  var tagPickerSaveBtn = null;
  var savingTagPicker = false;
  function createTagPicker() {
  }
  function tagPickerOriginalTags(loc) {
    return new Set(loc.encrypted ? loc.tags.filter((t) => t !== ENCRYPT_TAG) : loc.tags);
  }
  function tagPickerDirty() {
    const popup = document.getElementById("diary-tag-selector-popup");
    const loc = activeTagPickerLoc;
    if (!popup || !loc) return false;
    const sel = new Set(collectSelectedTags(popup));
    const orig = tagPickerOriginalTags(loc);
    if (sel.size !== orig.size) return true;
    for (const t of sel) if (!orig.has(t)) return true;
    return false;
  }
  function closeTagPicker() {
    tagPickerUi == null ? void 0 : tagPickerUi.close();
    tagPickerUi = null;
    tagPickerSaveBtn = null;
  }
  function hideTagPicker() {
    closeTagPicker();
  }
  function requestCloseTagPicker() {
    if (tagPickerDirty()) confirmDiscard(closeTagPicker, void 0, DIARY_FLOW_SKIN);
    else closeTagPicker();
  }
  function setTagPickerSavingUi(saving) {
    var _a;
    const btn = tagPickerSaveBtn;
    if (!btn) return;
    btn.disabled = saving;
    const label = (_a = btn.querySelector("span")) != null ? _a : btn;
    label.textContent = saving ? "保存中…" : "保存";
  }
  async function commitTagPickerSave() {
    const loc = activeTagPickerLoc;
    if (!loc) {
      closeTagPicker();
      return;
    }
    if (savingTagPicker) return;
    const popup = document.getElementById("diary-tag-selector-popup");
    if (!popup) return;
    const selTagNames = collectSelectedTags(popup);
    if (selTagNames.length === 0) {
      notice("请至少选择一个标签");
      return;
    }
    savingTagPicker = true;
    setTagPickerSavingUi(true);
    try {
      const ok = await handleTagPickerSave(loc, selTagNames, !!loc.encrypted);
      if (ok) closeTagPicker();
    } finally {
      savingTagPicker = false;
      setTagPickerSavingUi(false);
    }
  }
  function showTagPicker(loc) {
    activeTagPickerLoc = loc;
    if (tagPickerUi) closeTagPicker();
    const isEncrypted = !!loc.encrypted;
    const currentTagsSet = tagPickerOriginalTags(loc);
    const sortedTags = sortTagsByUsage(getSortedTagsForAddDialog());
    const content = document.createElement("div");
    content.className = "bz-diary-form";
    const chips = document.createElement("div");
    chips.className = "diary-tag-selector-buttons bz-diary-chip-scroll";
    renderTagOptions(chips, sortedTags, currentTagsSet);
    content.appendChild(createTagFilter(chips));
    content.appendChild(chips);
    const foot = document.createElement("div");
    foot.className = "bz-diary-dialog-foot bz-diary-dialog-foot--split";
    const deleteBtn = uiBtn({
      label: "删除",
      tone: "danger",
      // 一致#2：删除钮换 .bz-btn--danger 族（原手绘 error 实底退役）
      className: "bz-touch-target--xl",
      onClick: () => {
        const target = activeTagPickerLoc;
        closeTagPicker();
        if (target) showConfirm(target);
      }
    });
    const saveBtn = uiBtn({
      label: "保存",
      // 一致#1：编辑既有条目 = 保存口径
      tone: "primary",
      className: "bz-touch-target--xl",
      onClick: () => void commitTagPickerSave()
    });
    tagPickerSaveBtn = saveBtn;
    foot.appendChild(deleteBtn);
    foot.appendChild(saveBtn);
    content.appendChild(foot);
    const { mask, popup, close } = uiModal({
      content,
      maxWidth: 320,
      head: true,
      title: "选择类型",
      className: "bz-diary-tag-popup",
      requestClose: requestCloseTagPicker
    });
    mask.id = "diary-tag-selector-mask";
    popup.id = "diary-tag-selector-popup";
    tagPickerUi = { mask, popup, close };
    motionSheetDialog(popup);
    bindFormSubmit(popup, () => void commitTagPickerSave());
  }
  async function handleTagPickerSave(loc, selTagNames, isEncryptedEntry) {
    try {
      if (isEncryptedEntry) {
        const { isUnlocked: isUnlocked2 } = await Promise.resolve().then(() => (init_encrypt2(), encrypt_exports2));
        if (!isUnlocked2()) {
          notice("保险箱已上锁，请先解锁再改分类", "error");
          return false;
        }
        const proceed = await openFlowDialog({
          title: "改分类",
          message: "将解密此日记并恢复为普通条目，是否继续？",
          actions: [
            { label: "取消", value: "cancel" },
            { label: "确定", value: "ok", cta: true }
          ]
        }) === "ok";
        if (!proceed) return false;
        if (!loc.noteId) return false;
        const newTags = selTagNames.filter((t) => t !== ENCRYPT_TAG);
        const success = await reclassifyEntry(loc.noteId, selTagNames);
        if (!success) {
          notice("解密改分类失败", "error");
          return false;
        }
        notice("已解密还原", "success");
        emitDomainEvent("diary:entry-decrypted", { noteId: loc.noteId, date: loc.date, newTags });
        return true;
      }
      const dateStr = loc.date;
      const predicate = await buildLocatorPredicateFor(dateStr, loc);
      const updated = await updateDiaryTags(dateStr, predicate, selTagNames, { filePath: loc.filePath });
      if (!updated) {
        notice("未能在日记数据中定位该条目，标签没有修改", "error");
        return false;
      }
      return true;
    } catch (e) {
      if (isUnparsedRefusal(e) || isDiaryReadFailure(e)) return false;
      console.error("改标签失败:", e);
      notice("改标签失败：" + ((e == null ? void 0 : e.message) || e), "error");
      return false;
    }
  }

  // src/diary/media-import.ts
  init_config();
  var PICK_MEDIA_ACCEPT = "image/*,video/*,audio/*";
  var MEDIA_PICK_MAX_MB = 64;
  var FALLBACK_MEDIA_DIR = `${DIARY_DIRECTORY}/附件`;
  async function writePickedMedia(app, file) {
    const path = await mediaPathFor(app, file.name);
    await app.vault.createBinary(path, await file.arrayBuffer());
    return path.split("/").pop() || file.name;
  }
  async function mediaPathFor(app, name) {
    var _a;
    const host = app;
    const getPath = (_a = host.fileManager) == null ? void 0 : _a.getAvailablePathForAttachment;
    if (typeof getPath === "function") {
      return await getPath.call(host.fileManager, name, `${DIARY_DIRECTORY}/`);
    }
    const dot = name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    try {
      if (!await app.vault.adapter.exists(FALLBACK_MEDIA_DIR)) {
        await app.vault.createFolder(FALLBACK_MEDIA_DIR);
      }
    } catch (e) {
    }
    let path = `${FALLBACK_MEDIA_DIR}/${name}`;
    for (let i = 2; app.vault.getAbstractFileByPath(path); i++) {
      path = `${FALLBACK_MEDIA_DIR}/${base}_${i}${ext}`;
    }
    return path;
  }

  // src/diary/ui.ts
  init_ui();
  var SINGLE_MAX_W = 720;
  var FLIP_TIME_MS = 380;
  var PAGE_CUT_MIN_PX = 84;
  var DAYSTAMP_KEEP_PX = 96;
  var REFRESH_DEBOUNCE_MS = 400;
  var WHEEL_LOCK_MS = 560;
  var LOADING_SHOW_DELAY_MS = 120;
  var MEDIA_FIT_MIN_RATIO = 0.6;
  function collectPhotoRefs(entries) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const e of entries) {
      if (e.encrypted) continue;
      for (const seg of e.segments) {
        if (seg.kind !== "media") continue;
        if (seg.media.kind === "audio") continue;
        if (seen.has(seg.media.name)) continue;
        seen.add(seg.media.name);
        out.push({ entry: e, media: seg.media });
      }
    }
    return out;
  }
  function paginateFlow(items, availH, split, heightOf, shrink) {
    const metas = items.map((it) => ({ el: it.el, h: it.h, keep: !!it.keep, fit: !!it.fit }));
    const pages = [];
    let cur = null;
    let used = 0;
    const newPage = () => {
      cur = [];
      pages.push(cur);
      used = 0;
    };
    newPage();
    for (let i = 0; i < metas.length; i++) {
      const it = metas[i];
      if (it.keep && (cur.length || pages.length > 1)) {
        if (pages.length % 2 === 1) pages.push([]);
        newPage();
        used = 0;
      }
      if (!cur.length && it.h > availH) {
        const c2 = split(it.el, availH - 4);
        if (c2) {
          it.h = heightOf(c2[0]);
          metas.splice(i + 1, 0, { el: c2[1], h: c2[2], keep: false, fit: false });
        }
      }
      if (used + it.h > availH && cur.length) {
        const remain = availH - used;
        if (it.fit && shrink) {
          const nh = shrink(it.el, remain);
          if (nh !== null && nh <= remain) it.h = nh;
        }
        if (used + it.h > availH) {
          if (remain >= PAGE_CUT_MIN_PX) {
            const cut = split(it.el, remain - 4);
            if (cut) {
              cur.push(cut[0]);
              metas.splice(i + 1, 0, { el: cut[1], h: cut[2], keep: false, fit: false });
              used = availH;
              continue;
            }
          }
          newPage();
        }
      }
      if (it.keep && used + it.h + DAYSTAMP_KEEP_PX > availH && cur.length) newPage();
      cur.push(it.el);
      used += it.h;
    }
    return pages;
  }
  function monthMarks(pages, entries) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (let pi = 0; pi < pages.length; pi++) {
      const dayEl = pages[pi].find((el) => el.classList.contains("bz-diary-b-daystamp"));
      const date = dayEl == null ? void 0 : dayEl.getAttribute("data-date");
      if (!date) continue;
      const key = date.slice(0, 7);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, page1: pi + 1, n: 0 });
    }
    const byMonth = /* @__PURE__ */ new Map();
    for (const e of entries) {
      const k = e.date.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) || 0) + 1);
    }
    for (const m of out) m.n = byMonth.get(m.key) || 0;
    return out;
  }
  function pageDateOf(page) {
    const el = page.find((n) => n.classList.contains("bz-diary-b-daystamp"));
    return (el == null ? void 0 : el.getAttribute("data-date")) || null;
  }
  function elOf(html) {
    const t = document.createElement("template");
    t.innerHTML = html;
    return t.content.firstElementChild;
  }
  function plainTextOf(e) {
    var _a;
    const x = e.extra || {};
    if (e.kind === "movie") return `《${x.title || ""}》观影于 ${e.date}
${x.review || ""}`;
    if (e.kind === "book") return `《${x.title || ""}》${x.author || ""}
${x.review || ""}`;
    if (e.kind === "letter") return `${e.filename ? ((_a = e.filename.split("/").pop()) == null ? void 0 : _a.replace(/\.md$/, "")) + "\n" : ""}${e.content || ""}`;
    return e.content || "";
  }
  function writeClipboard(text, okMsg, failMsg) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        notice(okMsg, "success");
      } catch (e) {
        notice(failMsg, "error");
      }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      void navigator.clipboard.writeText(text).then(() => notice(okMsg, "success"), fallback);
    } else fallback();
  }
  var _DiaryAppController = class _DiaryAppController {
    constructor() {
      // ---------- DOM ----------
      this.root = null;
      /** 密码框在途的结算器（同一时刻至多一个） */
      this.passSettle = null;
      // ---------- 状态 ----------
      /** 当前册子里的条目（只读聚合结果；加密条目在解锁时才并入） */
      this.entries = [];
      this.byEid = /* @__PURE__ */ new Map();
      this.pages = [];
      this.cursor = 0;
      this.single = false;
      this.filterTag = null;
      this.search = {
        kw: null,
        hits: [],
        i: 0
      };
      this.photoRefs = [];
      this.photoIndex = /* @__PURE__ */ new Map();
      this.lbIdx = 0;
      this.flip = null;
      this.menuEid = null;
      this.bookRect = null;
      this.epoch = 0;
      this.toastTimer = null;
      this.modifyTimer = null;
      this.wheelLock = 0;
      this.toolsRaf = 0;
      this.toolsShown = false;
      this.lastSingle = false;
      this.lastW = 0;
      this.lastH = 0;
      this.resizeTimer = null;
      this.encMediaCache = /* @__PURE__ */ new Map();
      this.lastSpreadCount = 0;
      this.cal = { year: 2026, month: 1 };
      /** 台历当前模式：跳日（文具「跳」）或写作内页的改日子·时辰 */
      this.calMode = "jump";
      /** 写作模式下台历里选中的那天（未选回落草稿当前那天） */
      this.calDate = null;
      /**
       * 写作内页的草稿（ADR-0233）：点「写」时立，落笔/揉掉即销。
       * 只存日子、时辰与已选贴纸——正文以 textarea 的 value 为准（不进状态，免得两份真相）。
       */
      this.draft = null;
      /** 落笔进行中（防连点：写盘慢时双击「落笔」会在同刻落两篇） */
      this.saving = false;
      /** 开册进度条的 `uiProgress` 句柄（首次开册建一次就复用，不随层出入栈——基元没有状态） */
      this.loadBar = null;
      /** 进度条的显示延时器：读得快（缓存命中）就不闪这一下 */
      this.loadShowTimer = null;
      /** 本次开册的读盘 + 成册任务（`bz-diary-write`：等它落地再摆写作内页） */
      this.loadTask = null;
      /** 本轮开册的身份牌：连点命令时旧那一轮在落地前对不上牌，自行让位（不重排第二遍） */
      this.loadToken = null;
      /**
       * 书页是否就是「当前数据排出来的那一册」（`relayout` 落地即置真）。
       * 配合 `bookStillValid()` 构成 `show()` 的快路：重开册子不重读、不重排
       * （用户点名：「再次打开日记本，写的内容不会消失，也不会再重新渲染页面」）。
       */
      this.bookFresh = false;
      /** 上次排版时的保险箱锁态：锁态一变，加密条目要重并 ⇒ 快路作废 */
      this.layoutUnlocked = false;
      // ---------- 生命周期标记 ----------
      this._initialized = false;
      this._shownOnce = false;
      this._hideMotion = false;
      this._allowCacheNext = false;
      this._loadError = null;
      this._subs = [];
      this._vaultRefs = [];
      this.onKeydown = (ev) => {
        if (ev.key === "Escape") {
          this.escapeStack();
          return;
        }
        if (ev.target instanceof Element && ev.target.matches("input, textarea")) return;
        if (!this.lightboxEl.hidden) {
          if (ev.key === "ArrowLeft") {
            this.lbStep(-1);
            return;
          }
          if (ev.key === "ArrowRight") {
            this.lbStep(1);
            return;
          }
        }
        if (ev.key === "ArrowLeft") this.turnPage(-1);
        if (ev.key === "ArrowRight") this.turnPage(1);
      };
      this.onResize = () => {
        if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          this.resizeTimer = null;
          this.applyBookZoom();
          const s = window.innerWidth <= SINGLE_MAX_W;
          const h = window.innerHeight;
          const w = window.innerWidth;
          const hChanged = Math.abs(h - this.lastH) > 40;
          const wChanged = s && Math.abs(w - this.lastW) > 16;
          this.lastH = h;
          this.lastW = w;
          if (s !== this.lastSingle || hChanged || wChanged) {
            this.lastSingle = s;
            this.relayout(true);
          } else this.refreshBookRect();
        }, 380);
      };
      this.onDocPointerDown = (ev) => {
        var _a, _b;
        if (!((_b = (_a = ev.target).closest) == null ? void 0 : _b.call(_a, ".bz-diary-menu"))) this.closeMenu();
      };
      this.onMouseMove = (ev) => {
        if (this.toolsRaf) return;
        const x = ev.clientX;
        const y = ev.clientY;
        this.toolsRaf = requestAnimationFrame(() => {
          this.toolsRaf = 0;
          if (!this.lightboxEl.hidden || !this.sheetEl.hidden || !this.slipEl.hidden) {
            this.setToolsShown(false);
            return;
          }
          if (!this.bookRect) this.refreshBookRect();
          const r = this.bookRect;
          if (!r) return;
          this.setToolsShown(y > r.bottom - 48 && y < r.bottom + 112 && x > r.left - 70 && x < r.right + 70);
        });
      };
      this.onMouseLeave = () => this.setToolsShown(false);
    }
    static getInstance() {
      if (!_DiaryAppController.instance) _DiaryAppController.instance = new _DiaryAppController();
      return _DiaryAppController.instance;
    }
    // ============================================================
    //  DOM 构建
    // ============================================================
    /** 幂等建 DOM + 绑事件（show/init 均经此） */
    ensureElements() {
      if (this._initialized) return;
      this._initialized = true;
      const root = document.createElement("div");
      root.className = "bz-diary-scene";
      root.style.cssText = "position:fixed;inset:0;display:none;";
      root.innerHTML = bookPanelHTML();
      document.body.appendChild(root);
      this.root = root;
      mountIcons(root);
      this.applyBookZoom();
      const q = (sel) => root.querySelector(sel);
      this.bookEl = q(".bz-diary-book");
      this.blockEl = q(".bz-diary-bk-block");
      this.flipHost = q(".bz-diary-flipbook");
      this.edgeEl = q(".bz-diary-bk-edge");
      this.toolsEl = q(".bz-diary-tools");
      this.filterTabEl = q(".bz-diary-filter-tab");
      this.menuEl = q(".bz-diary-menu");
      this.sheetEl = q(".bz-diary-sheet");
      this.sheetTitleEl = q(".bz-diary-sh-title");
      this.sheetBodyEl = q(".bz-diary-sheet-body");
      this.slipEl = q(".bz-diary-slip");
      this.slipTitleEl = q(".bz-diary-slip-title");
      this.slipBodyEl = q(".bz-diary-slip-body");
      this.slipRowEl = q(".bz-diary-slip-row");
      this.albumEl = q(".bz-diary-album-pop");
      this.albumSubEl = q(".bz-diary-ap-sub");
      this.albumGridEl = q(".bz-diary-ap-grid");
      this.calEl = q(".bz-diary-cal-pop");
      this.calYmEl = q(".bz-diary-cal-ym");
      this.calGridEl = q(".bz-diary-cal-grid");
      this.calTimeRowEl = q(".bz-diary-cal-time-row");
      this.calInputEl = q(".bz-diary-ct-input");
      this.calErrEl = q(".bz-diary-ct-err");
      this.calOkEl = q(".bz-diary-cal-ok");
      this.lightboxEl = q(".bz-diary-lightbox");
      this.lbPhotoEl = q(".bz-diary-lb-photo");
      this.lbMediaEl = q(".bz-diary-lb-media");
      this.lbCapEl = q(".bz-diary-lb-cap");
      this.lbCountEl = q(".bz-diary-lb-count");
      this.toastEl = q(".bz-diary-toast");
      this.fallbackEl = q(".bz-diary-fallback");
      this.closeEl = q(".bz-diary-close");
      this.passEl = q(".bz-diary-pass");
      this.passInputEl = q(".bz-diary-pass-input");
      this.passErrEl = q(".bz-diary-pass-err");
      this.loadingEl = q(".bz-diary-loading");
      this.loadingTitleEl = q(".bz-diary-ld-title");
      this.loadingBarEl = q(".bz-diary-ld-bar");
      this.loadingCountEl = q(".bz-diary-ld-count");
      this.wspEl = q(".bz-diary-wsp");
      this.wspDayEl = q(".bz-diary-wsp-day");
      this.wspAreaEl = q(".bz-diary-wsp-area");
      this.wspToolsEl = q(".bz-diary-wsp-tools");
      this.bindChrome();
      this.bindMenu();
      this.bindBlockEvents();
      this.bindLightbox();
      this.bindAlbum();
      this.bindCal();
      this.bindSlip();
      this.bindPass();
      this.bindTools();
      this.bindWrite();
      registerPanelEsc("diary", () => !!this.root && this.root.style.display === "flex", () => this.escapeStack());
      window.__bzDiaryReplay = () => this.show();
    }
    /** 渲染上下文：纯层要的两条回调——媒体地址 + 灯箱序号 */
    ctx() {
      const app = this.app();
      return {
        mediaSrc: (name) => this.mediaUrlOf(app, name),
        lbIndexOf: (name) => {
          var _a;
          return (_a = this.photoIndex.get(name)) != null ? _a : 0;
        }
      };
    }
    /** 媒体地址：data.ts 的解析（vault 相对/全局回退），解析不到返回空串（渲染层走占位） */
    mediaUrlOf(app, name) {
      return mediaSrc(app, name);
    }
    /** 页宽（单页模式跟视口走；桌面读 CSS 变量）——离屏测量盒与 StPageFlip 建书**共用这一个值** */
    pageWidth() {
      if (typeof window !== "undefined" && window.innerWidth <= SINGLE_MAX_W) {
        return Math.min(window.innerWidth * 0.92, 480);
      }
      const w = parseFloat(this.cssVar("--bz-diary-pg-w"));
      return Number.isFinite(w) && w > 0 ? w : 520;
    }
    /** 读域根上的 CSS 变量（宽度/内边距/书高的唯一来源） */
    cssVar(name) {
      if (!this.root) return "";
      return getComputedStyle(this.root).getPropertyValue(name);
    }
    /** 块高 = offsetHeight + 上下 margin（原型那张家手写 GAP 表已被这一步取代） */
    blockHeightOf(el) {
      const cs = getComputedStyle(el);
      return el.offsetHeight + (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    }
    /**
     * 可缩媒体块（照片 / 视频）等比缩到 `maxH` 以内，返回新的块高；缩不动返回 null。
     *
     * 为什么缩**块宽**而不是高度：相框是 img 自己的 padding、媒体盒是 `aspect-ratio: 4/3`，
     * 宽度一缩两者按比例同步收，照片不会被压扁也不会有信封边（改高度只会把框拉成横条）。
     * 缩幅按「内容高 ∝ 块宽」一次算到位——那圈白框与 margin 是常数项，所以算完**再用真的量一遍**
     * 确认；量出来还超就撤回这次缩，交给换页（宁可留白也不要「缩过却仍换页」的怪尺寸）。
     *
     * 内联的是**几何值**（由页面剩余高度反推的块宽），与 `renderEdgeMarks` 的 top/height 同类：
     * 行为性内联值，不是视觉样式——颜色、框体、落影仍全在 `styles.css`。
     */
    fitMedia(el, maxH) {
      const cs = getComputedStyle(el);
      const marg = (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
      const h0 = this.blockHeightOf(el);
      const w0 = el.offsetWidth;
      const body = h0 - marg;
      const room = maxH - marg;
      if (!w0 || body <= 0 || room <= 0) return null;
      const ratio = Math.min(1, room / body);
      const w = Math.floor(w0 * ratio);
      if (w < Math.ceil(w0 * MEDIA_FIT_MIN_RATIO)) return null;
      const prev = el.style.getPropertyValue("--bz-diary-ph-w");
      el.style.setProperty("--bz-diary-ph-w", w + "px");
      const h = this.blockHeightOf(el);
      if (h > maxH) {
        if (prev) el.style.setProperty("--bz-diary-ph-w", prev);
        else el.style.removeProperty("--bz-diary-ph-w");
        return null;
      }
      return h;
    }
    // ============================================================
    //  排版：块流 → 测量 → 切页 → 建书
    // ============================================================
    visibleEntries() {
      if (!this.filterTag) return this.entries;
      const tag = this.filterTag;
      return this.entries.filter((e) => e.tags.includes(tag));
    }
    /**
     * 重排整册。`keepRatio`：视口变化/回刷时按上次页数比例保住阅读位置（跟手不跳回最新）；
     * 换筛选、写完一篇等场景传 false（落回第 0 页 = 最新那篇）。
     */
    relayout(keepRatio) {
      const root = this.root;
      if (!root) return 0;
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      this.epoch++;
      this.closeLightbox();
      this.closeSheet();
      this.pauseAllAudio();
      this.search = { kw: null, hits: [], i: 0 };
      const fbHost = this.flipHost;
      this.blockEl.innerHTML = "";
      if (fbHost) this.blockEl.appendChild(fbHost);
      const single = typeof window !== "undefined" && window.innerWidth <= SINGLE_MAX_W;
      this.single = single;
      root.classList.toggle("bz-diary-single", single);
      const list = this.visibleEntries();
      this.byEid = new Map(list.map((e) => [e.id || "", e]));
      this.photoRefs = collectPhotoRefs(list);
      this.photoIndex = new Map(this.photoRefs.map((p, i) => [p.media.name, i]));
      const probe = document.createElement("div");
      probe.className = "bz-diary-probe";
      root.appendChild(probe);
      const padT = parseFloat(getComputedStyle(probe).paddingTop) || 88;
      const padB = parseFloat(getComputedStyle(probe).paddingBottom) || 66;
      const bookH = this.bookEl.clientHeight || parseFloat(this.cssVar("--bz-diary-pg-h")) || 700;
      const availH = bookH - padT - padB;
      const ctx = this.ctx();
      const flow = [];
      let lastDate = null;
      const dayCount = /* @__PURE__ */ new Map();
      for (const e of list) dayCount.set(e.date, (dayCount.get(e.date) || 0) + 1);
      for (const e of list) {
        if (e.date !== lastDate) {
          lastDate = e.date;
          flow.push({ el: elOf(daystampHTML(e.date, dayCount.get(e.date) || 1)), h: 0, keep: true });
        }
        this.pushEntryBlocks(flow, e, ctx);
      }
      for (const f of flow) probe.appendChild(f.el);
      void probe.offsetHeight;
      for (const f of flow) f.h = this.blockHeightOf(f.el);
      this.pages = paginateFlow(
        flow,
        availH,
        (el, avail) => this.splitParagraph(el, avail, probe),
        (el) => this.blockHeightOf(el),
        (el, maxH) => this.fitMedia(el, maxH)
      );
      probe.innerHTML = "";
      probe.remove();
      this.renderEdgeMarks();
      const last = Math.max(0, this.pages.length - 1);
      let target = 0;
      if (keepRatio && this.lastSpreadCount > 1) {
        target = Math.round(this.cursor / (this.lastSpreadCount - 1) * last);
      }
      this.lastSpreadCount = this.pages.length;
      this.buildBook(Math.max(0, Math.min(last, target)));
      this.refreshBookRect();
      this.bookFresh = true;
      this.layoutUnlocked = isUnlocked();
      return (typeof performance !== "undefined" ? performance.now() : 0) - t0;
    }
    /**
     * 条目 → 块元素。`bz-diary-b-photo`（照片 / 视频）标成**可缩块**：放不下时先等比缩到塞进
     * 剩余高度（见 `paginateFlow` 规则 3a），别为差几十像素就整块换页、在页尾留半页白。
     * 日戳与文字块不缩——文字走逐行续排，日戳必须整块起新纸。
     */
    pushEntryBlocks(flow, e, ctx) {
      for (const html of entryBlockHTMLs(e, ctx)) {
        const el = elOf(html);
        flow.push(el.classList.contains("bz-diary-b-photo") ? { el, h: 0, fit: true } : { el, h: 0 });
      }
    }
    /** 段落内第 idx 个字符落在哪个文本节点的哪个偏移 */
    textPos(root, idx) {
      var _a;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let acc = 0;
      let n;
      while (n = walker.nextNode()) {
        const len = ((_a = n.nodeValue) == null ? void 0 : _a.length) || 0;
        if (idx <= acc + len) return [n, idx - acc];
        acc += len;
      }
      return null;
    }
    /**
     * 段落按目标高度用 Range 二分切两半（逐行续排）；返回 `[上半, 下半, 下半高]` 或 null。
     * 带行内格式（wikilink/加粗/高亮/删除线…）的段同样能切：下半是整段克隆后删掉前缀，
     * 两边的行内格式都保住。切点对齐句读，避免词中腰斩。
     */
    splitParagraph(el, availPx, probe) {
      const text = el.textContent || "";
      if (text.length < 40 || availPx < 70) return null;
      const range = document.createRange();
      let lo = 1;
      let hi = text.length;
      let best = 0;
      while (lo <= hi) {
        const mid = lo + hi >> 1;
        const pos = this.textPos(el, mid);
        if (pos) {
          range.setStart(el, 0);
          range.setEnd(pos[0], pos[1]);
          if (range.getBoundingClientRect().height <= availPx) {
            best = mid;
            lo = mid + 1;
            continue;
          }
        }
        hi = mid - 1;
      }
      if (best < 16) return null;
      let cut = best;
      const from = Math.max(0, best - 24);
      const stops = '。!?;,:、~…」』”" ';
      for (let k = best - 1; k >= from; k--) {
        if (stops.indexOf(text[k]) >= 0) {
          cut = k + 1;
          break;
        }
      }
      if (cut < 10 || cut > text.length - 6) return null;
      const down = el.cloneNode(true);
      const dp = this.textPos(down, cut);
      const up = this.textPos(el, cut);
      if (!dp || !up) return null;
      const rd = document.createRange();
      rd.setStart(down, 0);
      rd.setEnd(dp[0], dp[1]);
      rd.deleteContents();
      const ru = document.createRange();
      ru.setStart(up[0], up[1]);
      ru.setEnd(el, el.childNodes.length);
      ru.deleteContents();
      down.className = el.className.replace("bz-diary-p-indent", "bz-diary-p-cont");
      down.dataset.eid = el.dataset.eid || "";
      probe.insertBefore(down, el.nextSibling);
      return [el, down, this.blockHeightOf(down)];
    }
    /** 建 StPageFlip 书：页元素 → 库，翻页动画/拖拽/纸张弯曲全交库 */
    buildBook(targetPage) {
      const host = this.flipHost;
      if (this.flip) {
        try {
          this.flip.destroy();
        } catch (e) {
        }
        this.flip = null;
      }
      host.innerHTML = "";
      this.blockEl.appendChild(host);
      const items = [];
      for (let pi = 0; pi < this.pages.length; pi++) {
        const d = document.createElement("div");
        d.className = "bz-diary-page-item";
        const inner = document.createElement("div");
        inner.className = "bz-diary-page-inner";
        for (const el of this.pages[pi]) inner.appendChild(el);
        d.appendChild(inner);
        if (this.pages[pi].length) {
          const no = document.createElement("div");
          no.className = "bz-diary-page-no";
          no.textContent = `— ${pi + 1} —`;
          d.appendChild(no);
        }
        items.push(d);
      }
      const pgW = this.pageWidth();
      const pgH = this.bookEl.clientHeight || parseFloat(this.cssVar("--bz-diary-pg-h")) || 700;
      this.flip = new import_page_flip_browser.PageFlip(host, {
        width: pgW,
        height: pgH,
        size: "fixed",
        usePortrait: this.single,
        maxShadowOpacity: 0.5,
        showCover: false,
        // 没有封面页：直接按跨页排（0=左，1=右）
        mobileScrollSupport: false,
        flippingTime: FLIP_TIME_MS,
        useMouseEvents: true,
        disableFlipByClick: true,
        // 点击翻页由本域自管（且已按用户要求取消四角点击）
        showPageCorners: false
      });
      this.flip.loadFromHTML(items);
      this.flip.turnToPage(Math.max(0, targetPage));
      this.flip.on("flip", (e) => {
        this.cursor = e.data;
      });
      this.cursor = Math.max(0, targetPage);
      this.afterPagesBuilt(host);
    }
    /** 每次建书后要重挂的东西：显影 / 媒体失败态 / 录音卡 */
    afterPagesBuilt(scope) {
      this.developPhotos(scope);
      this.bindMediaErrors(scope);
      this.bindAudios(scope);
    }
    turnPage(dir) {
      if (!this.flip) return;
      if (this.writeGuard()) return;
      if (dir > 0) this.flip.flipNext();
      else this.flip.flipPrev();
    }
    jumpToPage(pi) {
      if (!this.flip || !this.pages.length) return;
      if (this.writeGuard()) return;
      this.flip.turnToPage(Math.max(0, Math.min(this.pages.length - 1, pi)));
    }
    // ============================================================
    //  书口：年份染色 + 册页索引
    // ============================================================
    monthMarksOf() {
      return monthMarks(this.pages, this.visibleEntries());
    }
    /**
     * 书口年份染色带：只作「这几年各占多厚」的缩影（整条边缘才是那个大按钮——点开抽索引）。
     * 只有一年时不画：一条通高的色带等于没有信息，只是把整条书口刷成一块颜色。
     * `top`/`height` 是量出来的几何（行为性内联值）；颜色按年序轮转走 `.bz-diary-ey-N` 类。
     */
    renderEdgeMarks() {
      const edge = this.edgeEl;
      edge.querySelectorAll(".bz-diary-edge-year").forEach((b) => b.remove());
      const months = this.monthMarksOf();
      if (!months.length) return;
      const total = Math.max(1, this.pages.length);
      const years = [];
      for (const m of months) {
        const y = m.key.slice(0, 4);
        if (!years.length || years[years.length - 1].y !== y) years.push({ y, from: m.page1 });
      }
      if (years.length < 2) return;
      years.forEach((sg, i) => {
        const top = (sg.from - 1) / total * 100;
        const endFrom = i + 1 < years.length ? years[i + 1].from : total + 1;
        let h = Math.max(1.2, (endFrom - 1) / total * 100 - top);
        h = Math.min(h, 100 - top);
        const b = document.createElement("div");
        b.className = `bz-diary-edge-year bz-diary-ey-${i % 8}`;
        b.style.top = `${top}%`;
        b.style.height = `${h}%`;
        edge.appendChild(b);
      });
    }
    /** 点书口 → 抽出「册页索引」那张纸：一年一段、一月一行 */
    openIndexSheet() {
      const months = this.monthMarksOf();
      const list = this.visibleEntries();
      if (!months.length || !list.length) {
        this.toast("册页还空着");
        return;
      }
      const total = list.length;
      let html = '<div class="bz-diary-sheet-meta">自 ' + list[total - 1].date + " 至 " + list[0].date + " · 凡 " + cnNum(total) + " 则 · " + cnNum(months.length) + " 个月</div>";
      let curY = null;
      let open = false;
      for (const m of months) {
        const parts = m.key.split("-");
        if (parts[0] !== curY) {
          if (open) html += "</div></div>";
          html += `<div class="bz-diary-idx-year"><div class="bz-diary-iy-head">${parts[0]} 年</div><div class="bz-diary-iy-months">`;
          curY = parts[0];
          open = true;
        }
        html += `<div class="bz-diary-idx-row" data-jump-page="${m.page1 - 1}"><span class="bz-diary-ir-m">${parseInt(parts[1], 10)} 月</span><span class="bz-diary-ir-dots"></span><span class="bz-diary-ir-n">${cnNum(m.n)} 则</span><span class="bz-diary-ir-p">第 ${m.page1} 页</span></div>`;
      }
      if (open) html += "</div></div>";
      this.openSheet("册 页 索 引", html);
    }
    // ============================================================
    //  媒体：显影 / 失败态 / 录音卡 / 加密媒体
    // ============================================================
    /** 照片显影：加载完成即从药水里显出；冲不出来的给占位相纸 */
    developPhotos(root) {
      root.querySelectorAll(".bz-diary-ph-media img").forEach((img) => {
        if (img.dataset.dev) return;
        img.dataset.dev = "1";
        const dev = () => img.classList.add("bz-diary-develop");
        if (img.complete && img.naturalWidth) {
          dev();
          return;
        }
        img.addEventListener("load", dev, { once: true });
        img.addEventListener(
          "error",
          () => {
            const m = img.parentElement;
            if (m && m.isConnected) {
              img.remove();
              const ph = document.createElement("div");
              ph.className = "bz-diary-ph-empty";
              ph.textContent = "相片未冲出";
              m.appendChild(ph);
            }
          },
          { once: true }
        );
      });
    }
    /**
     * 媒体失败 → 换占位类（**不写内联样式**：`data-media-err` 的值就是失败时要换上的类全名，
     * 这是 render 层与行为层的约定，见 render.ts 头注第 3 条）。
     */
    bindMediaErrors(root) {
      root.querySelectorAll("img[data-media-err]").forEach((img) => {
        if (img.dataset.mediaErrWired) return;
        img.dataset.mediaErrWired = "1";
        img.addEventListener(
          "error",
          () => {
            const target = img.dataset.mediaErr;
            if (target) img.className = target;
            img.removeAttribute("src");
            delete img.dataset.mediaErr;
          },
          { once: true }
        );
      });
    }
    fmtClock(s) {
      const v = Math.max(0, Math.floor(s || 0));
      return `${Math.floor(v / 60)}:${pad22(v % 60)}`;
    }
    pauseAllAudio() {
      if (!this.root) return;
      this.root.querySelectorAll("audio").forEach((a) => {
        try {
          a.pause();
        } catch (e) {
        }
      });
    }
    toggleAudio(card) {
      var _a;
      const wrap = card.closest(".bz-diary-b-audio");
      const a = wrap == null ? void 0 : wrap.querySelector("audio");
      if (!a) return;
      if (a.paused) {
        (_a = this.root) == null ? void 0 : _a.querySelectorAll("audio").forEach((o) => {
          if (o !== a) {
            try {
              o.pause();
            } catch (e) {
            }
          }
        });
        void a.play().catch(() => this.toast("这段录音放不出来"));
      } else a.pause();
    }
    /** 录音卡：自绘播放键驱动隐藏的 `<audio>` */
    bindAudios(root) {
      root.querySelectorAll(".bz-diary-b-audio").forEach((wrap) => {
        if (wrap.dataset.wired) return;
        wrap.dataset.wired = "1";
        const a = wrap.querySelector("audio");
        const card = wrap.querySelector(".bz-diary-ba-card");
        if (!a || !card) return;
        const bar = card.querySelector(".bz-diary-ba-bar i");
        const tm = card.querySelector(".bz-diary-ba-time");
        const btn = card.querySelector(".bz-diary-ba-play");
        const idle = () => {
          if (btn) btn.textContent = "▷";
          wrap.classList.remove("bz-diary-playing");
          if (bar) bar.style.width = "0";
          if (tm) tm.textContent = isFinite(a.duration) && a.duration ? this.fmtClock(a.duration) : "--:--";
        };
        a.addEventListener("loadedmetadata", () => {
          if (a.paused) idle();
        });
        a.addEventListener("play", () => {
          if (btn) btn.textContent = "❚❚";
          wrap.classList.add("bz-diary-playing");
        });
        a.addEventListener("pause", idle);
        a.addEventListener("ended", idle);
        a.addEventListener("timeupdate", () => {
          if (!isFinite(a.duration) || !a.duration) {
            if (tm) tm.textContent = this.fmtClock(a.currentTime);
            return;
          }
          if (bar) bar.style.width = `${a.currentTime / a.duration * 100}%`;
          if (tm) tm.textContent = `-${this.fmtClock(a.duration - a.currentTime)}`;
        });
        a.addEventListener("error", () => {
          if (tm) tm.textContent = "放不出";
        });
      });
    }
    /**
     * 加密条目的媒体按需解密（保险箱附件镜像 → 原始层 base64 → data URL）。
     * 带缓存（含失败结果，避免渲染风暴下反复解密）；未解锁/无附件/解密失败返回 null（保持占位）。
     */
    encryptedMediaUrl(noteId, k) {
      if (!noteId) return Promise.resolve(null);
      const key = `${noteId}|${k.kind}|${k.name}`;
      let p = this.encMediaCache.get(key);
      if (!p) {
        p = this.decryptEncMedia(noteId, k);
        this.encMediaCache.set(key, p);
      }
      return p;
    }
    async decryptEncMedia(noteId, k) {
      var _a;
      try {
        const { getSafeManager: getSafeManager2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
        const safe = getSafeManager2();
        if (!safe.unlocked) return null;
        const note = (_a = safe.manifest) == null ? void 0 : _a.notes.find((n) => n.id === noteId);
        if (!note) return null;
        const att = note.attachments.find((a) => a.path === k.name || a.path.endsWith(`/${k.name}`));
        if (!att) return null;
        const b64 = await safe.decryptAttachmentOriginal(att);
        if (!b64) return null;
        return `data:${mimeOfMediaName(k.name)};base64,${b64}`;
      } catch (e) {
        return null;
      }
    }
    /** 拆信后的那张纸上若带照片：加密媒体解出后挂 src（并走显影） */
    async mountEncryptedMedia(scope, noteId) {
      const els = scope.querySelectorAll("[data-enc-name]");
      for (const el of Array.from(els)) {
        const name = el.dataset.encName || "";
        const kind = el.dataset.encKind || "img";
        const url = await this.encryptedMediaUrl(noteId, { name, kind });
        if (!url || !el.isConnected) continue;
        if (el instanceof HTMLImageElement) {
          el.addEventListener("load", () => el.classList.add("bz-diary-develop"), { once: true });
          el.src = url;
        } else if (el instanceof HTMLVideoElement) {
          el.src = url;
          el.preload = "metadata";
        } else if (el instanceof HTMLAudioElement) {
          el.src = url;
          el.preload = "metadata";
        }
      }
    }
    // ============================================================
    //  交互：滚轮 / 键盘 / 缩放
    // ============================================================
    bindChrome() {
      this.bookEl.addEventListener(
        "wheel",
        (ev) => {
          var _a, _b;
          if (!this.flip) return;
          if ((_b = (_a = ev.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".bz-diary-wsp")) return;
          ev.preventDefault();
          const now = Date.now();
          if (now - this.wheelLock < WHEEL_LOCK_MS) return;
          this.wheelLock = now;
          this.turnPage(ev.deltaY > 0 ? 1 : -1);
        },
        { passive: false }
      );
      document.addEventListener("keydown", this.onKeydown);
      this.closeEl.addEventListener("click", () => {
        void this.requestClose();
      });
      const root = this.root;
      root == null ? void 0 : root.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t !== root && !t.classList.contains("bz-diary-desk")) return;
        if (!this.lightboxEl.hidden || !this.sheetEl.hidden || !this.slipEl.hidden || !this.albumEl.hidden || !this.calEl.hidden || !this.menuEl.hidden || !this.passEl.hidden) {
          return;
        }
        void this.requestClose();
      });
      this.lastSingle = typeof window !== "undefined" && window.innerWidth <= SINGLE_MAX_W;
      this.lastW = typeof window !== "undefined" ? window.innerWidth : 0;
      this.lastH = typeof window !== "undefined" ? window.innerHeight : 0;
      window.addEventListener("resize", this.onResize);
    }
    /**
     * 书的整体缩放：窗口比书窄时把书缩进遮罩。
     * 原本想用 CSS `calc((100vw - 30px) / 1060)` 得纯数 —— 长度除以数**出来还是长度**，
     * `scale()` 吃不下，整条 `transform` 在 ≤1120px 直接失效变 none，书就偏到右半边
     * （左沿钉在视口中线上）。改由 JS 算成无单位数发号；≤720 单页档恒为 1。
     */
    applyBookZoom() {
      if (!this.root) return;
      const w = window.innerWidth;
      const zoom = w <= SINGLE_MAX_W ? 1 : Math.min(1, (w - 30) / 1072);
      this.root.style.setProperty("--bz-diary-book-zoom", zoom.toFixed(4));
    }
    /** Esc 分流：纸条 → 贴纸册 → 台历 → 抽出的一张纸 → 灯箱 → 便签 → 写作内页 → 翻回最新 */
    escapeStack() {
      if (!this.root || this.root.style.display !== "flex") return;
      if (!this.passEl.hidden) {
        this.closePass(false);
        return;
      }
      if (!this.slipEl.hidden) {
        this.closeSlip();
        return;
      }
      if (!this.albumEl.hidden) {
        this.closeAlbum();
        return;
      }
      if (!this.calEl.hidden) {
        this.closeCal();
        return;
      }
      if (!this.sheetEl.hidden) {
        this.closeSheet();
        return;
      }
      if (!this.lightboxEl.hidden) {
        this.closeLightbox();
        return;
      }
      if (!this.menuEl.hidden) {
        this.closeMenu();
        return;
      }
      if (this.hasDraft()) {
        void this.requestClose();
        return;
      }
      if (this.flip && this.cursor > 0) {
        this.jumpToPage(0);
        this.toast("翻到最新");
        return;
      }
      this.hide();
    }
    // ============================================================
    //  块级事件（一次委托）：录音 / wiki / 重封 / 照片 / 票根·藏书票 / 信封
    // ============================================================
    bindBlockEvents() {
      this.blockEl.addEventListener("click", (ev) => {
        var _a, _b;
        const t = ev.target;
        const aud = t.closest(".bz-diary-ba-card");
        if (aud) {
          this.toggleAudio(aud);
          return;
        }
        const wl = t.closest(".bz-diary-wikilink");
        if (wl) {
          this.openWikilink(wl);
          return;
        }
        const reseal = t.closest(".bz-diary-env-reseal");
        if (reseal) {
          (_a = reseal.closest(".bz-diary-envelope")) == null ? void 0 : _a.classList.remove("bz-diary-unsealed", "bz-diary-opening");
          this.closeSheet();
          this.toast("重新封缄了");
          return;
        }
        const ph = t.closest(".bz-diary-photo");
        if (ph && ph.dataset.lb != null) {
          this.openLightbox(Number(ph.dataset.lb));
          return;
        }
        const more = t.closest(".bz-diary-tk-more");
        if (more) {
          this.openReviewSheet(this.byEid.get(((_b = more.closest(".bz-diary-ticket")) == null ? void 0 : _b.dataset.eid) || ""));
          return;
        }
        const env = t.closest(".bz-diary-envelope");
        if (env) {
          this.onEnvelope(env);
          return;
        }
        const ex = t.closest(".bz-diary-exlibris");
        if (ex) this.openReviewSheet(this.byEid.get(ex.dataset.eid || ""));
      });
    }
    /** `[[双链]]`：书页里点它跳原文 */
    openWikilink(el) {
      const target = el.dataset.target;
      if (!target) return;
      const app = this.app();
      const file = app.metadataCache.getFirstLinkpathDest(target, "");
      if (file) void app.workspace.getLeaf(false).openFile(file);
      else this.toast(`找不到「${el.textContent || target}」`);
    }
    // ============================================================
    //  抽出的一张纸（全文阅读：影评 / 书评 / 拆开的信 / 册页索引）
    // ============================================================
    openSheet(title, src) {
      this.sheetTitleEl.textContent = title || "";
      this.sheetBodyEl.innerHTML = "";
      if (typeof src === "string") this.sheetBodyEl.innerHTML = src;
      else this.sheetBodyEl.appendChild(src);
      this.sheetEl.hidden = false;
      this.developPhotos(this.sheetBodyEl);
      this.bindMediaErrors(this.sheetBodyEl);
      this.bindAudios(this.sheetBodyEl);
    }
    closeSheet() {
      if (!this.sheetEl || this.sheetEl.hidden) return;
      this.sheetEl.hidden = true;
      this.pauseAllAudio();
      this.sheetBodyEl.innerHTML = "";
    }
    bindSheet() {
      this.sheetEl.addEventListener("click", (ev) => {
        const t = ev.target;
        const ph = t.closest(".bz-diary-photo");
        if (ph && ph.dataset.lb != null) {
          this.openLightbox(Number(ph.dataset.lb));
          return;
        }
        const aud = t.closest(".bz-diary-ba-card");
        if (aud) {
          this.toggleAudio(aud);
          return;
        }
        const row = t.closest(".bz-diary-idx-row");
        if (row) {
          this.closeSheet();
          this.jumpToPage(Number(row.dataset.jumpPage || 0));
          return;
        }
        if (t.closest(".bz-diary-sheet-paper") && !t.closest(".bz-diary-sh-close")) return;
        this.closeSheet();
      });
    }
    /** 长文 → 纸上的段落 */
    sheetParas(text) {
      return String(text || "").split(/\r?\n+/).map((s) => s.trim()).filter(Boolean).map((s) => `<div class="bz-diary-b-para bz-diary-p-indent">${inlineMd(s)}</div>`).join("");
    }
    /** 影评 / 书评全文纸 */
    openReviewSheet(e) {
      if (!e) return;
      const x = e.extra || {};
      if (e.kind === "movie") {
        this.openSheet(
          `《${x.title || ""}》影评`,
          `<div class="bz-diary-sheet-meta">${e.date} 观影 · ${e.tags.map((t) => `${getTagEmoji(t)}${t}`).join(" ")}</div>${this.sheetParas(x.review || "")}`
        );
      } else if (e.kind === "book") {
        this.openSheet(
          `《${x.title || ""}》书评`,
          `<div class="bz-diary-sheet-meta">${[x.author, x.category, e.date ? `读毕 ${e.date}` : ""].filter(Boolean).join(" · ")}</div>${this.sheetParas(x.review || "")}`
        );
      }
    }
    /**
     * 拆开的信 / 解封的加密条目：全文（含照片）按需装进一张纸。
     * render 层对 `encrypted` 条目只出信封，故走 `unwrap`（跳过信封分支）——
     * **条目仍带着 `encrypted` 身份**，媒体段才会发出 `data-enc-name` 挂载点，
     * 由 `mountEncryptedMedia` 解密后补 src（内容一字不差，只是不走信封那条分支）。
     */
    buildUnsealed(e) {
      const box = document.createElement("div");
      for (const html of entryBlockHTMLs(e, this.ctx(), { unwrap: true })) {
        box.appendChild(elOf(html));
      }
      return box;
    }
    // ============================================================
    //  灯箱（相纸显影）
    // ============================================================
    openLightbox(i) {
      if (!this.photoRefs[i]) return;
      this.lbIdx = i;
      this.renderLightbox();
      this.lightboxEl.hidden = false;
    }
    lbStep(d) {
      if (this.lightboxEl.hidden || !this.photoRefs.length) return;
      this.lbIdx = (this.lbIdx + d + this.photoRefs.length) % this.photoRefs.length;
      this.renderLightbox();
    }
    renderLightbox() {
      const p = this.photoRefs[this.lbIdx];
      if (!p) return;
      const app = this.app();
      const src = this.mediaUrlOf(app, p.media.name);
      this.lbMediaEl.innerHTML = "";
      if (p.media.kind === "video") {
        const v = document.createElement("video");
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.loop = true;
        v.playsInline = true;
        this.lbMediaEl.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        this.lbMediaEl.appendChild(img);
      }
      this.lbPhotoEl.className = `bz-diary-lb-photo ${tiltClassOf(this.lbIdx + 3)}`;
      const cap = p.media.name.split("/").pop() || "";
      this.lbCapEl.textContent = `${p.entry.date} ${p.entry.time} · ${cap}`;
      this.lbCountEl.textContent = `${this.lbIdx + 1} / ${this.photoRefs.length}`;
    }
    closeLightbox() {
      if (!this.lightboxEl) return;
      this.lightboxEl.hidden = true;
      this.lbMediaEl.innerHTML = "";
    }
    bindLightbox() {
      this.lightboxEl.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest(".bz-diary-lb-prev")) {
          this.lbStep(-1);
          return;
        }
        if (t.closest(".bz-diary-lb-next")) {
          this.lbStep(1);
          return;
        }
        if (t.closest(".bz-diary-lb-media") || t.closest(".bz-diary-lb-photo")) return;
        this.closeLightbox();
      });
    }
    // ============================================================
    //  便签菜单（右键 / 长按）
    // ============================================================
    openMenu(pos, eid) {
      const e = this.byEid.get(eid);
      if (!e) return;
      this.menuEid = eid;
      const show = (act, on) => {
        const el = this.menuEl.querySelector(`.bz-diary-mn-item[data-act="${act}"]`);
        if (el) el.hidden = !on;
      };
      const isDiary = e.kind === "diary";
      const enc = !!e.encrypted;
      show("retype", isDiary && !enc);
      show("envelope", isDiary && !enc);
      show("unseal", enc);
      show("takeout", enc);
      show("copytext", true);
      show("copylink", !enc && !!(e.filePath || e.filename));
      show("tear", isDiary);
      const tear = this.menuEl.querySelector('.bz-diary-mn-item[data-act="tear"]');
      if (tear) tear.textContent = enc ? "撕掉（销毁密文）" : "撕掉";
      this.menuEl.hidden = false;
      const mw = this.menuEl.offsetWidth;
      const mh = this.menuEl.offsetHeight;
      this.menuEl.style.left = `${Math.max(10, Math.min(pos.x, window.innerWidth - mw - 10))}px`;
      this.menuEl.style.top = `${Math.max(10, Math.min(pos.y, window.innerHeight - mh - 10))}px`;
    }
    closeMenu() {
      if (!this.menuEl) return;
      this.menuEl.hidden = true;
      this.menuEid = null;
    }
    bindMenu() {
      this.menuEl.addEventListener("click", (ev) => {
        const it = ev.target.closest(".bz-diary-mn-item");
        if (!it || !this.menuEid) return;
        const e = this.byEid.get(this.menuEid);
        this.closeMenu();
        if (!e) return;
        switch (it.dataset.act) {
          case "retype":
            this.editTags(e);
            break;
          case "envelope":
            void this.encryptEntryAction(e);
            break;
          case "unseal":
            this.unsealEntry(e);
            break;
          case "takeout":
            void this.decryptEntryAction(e);
            break;
          case "copytext":
            writeClipboard(plainTextOf(e), "誊好了，在剪贴板里", "誊不成……");
            break;
          case "copylink":
            void this.copyLink(e);
            break;
          case "tear":
            void this.tearEntry(e);
            break;
        }
      });
      document.addEventListener("pointerdown", this.onDocPointerDown, true);
      this.blockEl.addEventListener("contextmenu", (ev) => {
        const t = ev.target.closest("[data-eid]");
        if (!t) return;
        ev.preventDefault();
        this.closeMenu();
        this.openMenu({ x: ev.clientX, y: ev.clientY }, t.dataset.eid || "");
      });
      let lpTimer = null;
      let lpPos = null;
      this.blockEl.addEventListener(
        "touchstart",
        (ev) => {
          const t = ev.target.closest("[data-eid]");
          if (!t) return;
          const f = ev.touches[0];
          if (!f) return;
          lpPos = { x: f.clientX, y: f.clientY };
          lpTimer = setTimeout(() => {
            if (lpPos) this.openMenu(lpPos, t.dataset.eid || "");
          }, 500);
        },
        { passive: true }
      );
      this.blockEl.addEventListener(
        "touchmove",
        (ev) => {
          if (!lpTimer || !lpPos) return;
          const f = ev.touches[0];
          if (f && (Math.abs(f.clientX - lpPos.x) > 12 || Math.abs(f.clientY - lpPos.y) > 12)) {
            clearTimeout(lpTimer);
            lpTimer = null;
          }
        },
        { passive: true }
      );
      const cancelLp = () => {
        if (lpTimer) clearTimeout(lpTimer);
        lpTimer = null;
      };
      this.blockEl.addEventListener("touchend", cancelLp);
      this.blockEl.addEventListener("touchcancel", cancelLp);
    }
    // ============================================================
    //  条目动作：复制 / 改标签 / 加密 / 解密 / 撕掉
    // ============================================================
    /** 双链：加密条目无 md 锚点 → 复制正文；影视/信/书 → 文件级双链；普通条目 → 本域 copyDiaryLink */
    async copyLink(e) {
      try {
        if (e.encrypted) {
          await navigator.clipboard.writeText(e.content || e.text || "");
          notice("已复制加密日记正文", "success");
          return;
        }
        if (e.kind !== "diary") {
          if (!e.filename) {
            notice("找不到原文，无法复制双链", "error");
            return;
          }
          const path = e.filename.replace(/\.md$/, "");
          await navigator.clipboard.writeText(`[[${path}]]`);
          notice("已复制双链引用", "success");
          return;
        }
        if (!e.filePath && !e.filename) {
          notice("找不到原文，无法复制双链", "error");
          return;
        }
        await copyDiaryLink({ filename: e.filename || "", filePath: e.filePath, emoji: e.emoji, time: e.time });
      } catch (e2) {
        notice("复制双链失败", "error");
      }
    }
    /** 换贴纸：接本域 showTagPicker（写层守卫落盘，结果经 `diary:tags-changed` 回刷整册） */
    editTags(e) {
      try {
        showTagPicker({
          filename: e.filename || e.date,
          filePath: e.filePath,
          date: e.date,
          time: e.time,
          lineNumber: e.lineNumber || 0,
          tags: e.tags,
          encrypted: e.encrypted,
          noteId: e.noteId
        });
      } catch (err) {
        notice(`改标签暂不可用：${err instanceof Error ? err.message : String(err)}`, "error");
      }
    }
    /**
     * 收进信封（加密）：本域 `encryptEntry`（需保险箱解锁）+ 写层摘除原块；
     * 摘除失败必须回滚密文——密文已入库而原文未删时，解锁后同条出现两次且重试越积越多。
     * 与「撕掉」同为「条目当场从册上消失」，同样补二次确认。
     */
    async encryptEntryAction(e) {
      if (e.kind !== "diary") return;
      let enc = null;
      try {
        const unlocked = await this.ensureUnlocked();
        if (!unlocked) return;
        const ok = await openFlowDialog({
          title: "收进信封",
          message: `将把「${e.date} ${e.time}」这条日记移入保险库加密保存，原位置不再保留明文。`,
          actions: [
            { label: "取消", value: "cancel" },
            { label: "收进信封", value: "ok", cta: true, danger: true }
          ]
        });
        if (ok !== "ok") return;
        const entry = await findDiaryEntry(e.filePath || e.filename || e.date);
        if (!entry) {
          notice("找不到原文条目，无法加密", "error");
          return;
        }
        enc = await encryptEntry(entry);
        if (!enc) return;
        let removed = 0;
        try {
          removed = await removeDiaryEntries(
            entry.date,
            (x) => x.filePath === entry.filePath && x.time === entry.time && x.lineNumber === entry.lineNumber,
            { filePath: entry.filePath }
          );
        } catch (err) {
          await this.rollbackEncryptedNote(enc);
          throw err;
        }
        if (removed === 0) {
          await this.rollbackEncryptedNote(enc);
          notice("加密失败：原文块摘除未生效", "error");
          return;
        }
        const { emitDomainEvent: emitDomainEvent2 } = await Promise.resolve().then(() => (init_domain_bus(), domain_bus_exports));
        emitDomainEvent2("diary:entry-deleted", { date: entry.date, time: entry.time, wasEncrypted: false, encrypted: true });
        await this.loadAndRelayout();
      } catch (err) {
        if (err && (isUnparsedRefusal(err) || isDiaryReadFailure(err))) return;
        notice("加密失败", "error");
      }
    }
    /** 加密失败兜底：尽力销毁刚入库的密文（失败只留日志——原始失败原因更要紧） */
    async rollbackEncryptedNote(enc) {
      if (!enc.noteId) return;
      try {
        await deleteEncryptedEntry(enc.noteId);
      } catch (err) {
        console.warn("[bz-diary] 加密回滚失败（保险箱可能残留密文，请手动删除）:", err);
      }
    }
    /** 从信封取出（解密）：本域 `reclassifyEntry` 降级（还原块 merge 回 md，取出即删） */
    async decryptEntryAction(e) {
      try {
        const noteId = e.noteId;
        if (!noteId) {
          notice("无法取出（缺少保险箱记录）", "error");
          return;
        }
        if (!await this.ensureUnlocked()) return;
        const newTags = e.tags.filter((t) => t !== "加密");
        const ok = await reclassifyEntry(noteId, newTags);
        if (!ok) {
          notice("取出失败：主密码可能不正确，密文未受影响", "error");
          return;
        }
        const { emitDomainEvent: emitDomainEvent2 } = await Promise.resolve().then(() => (init_domain_bus(), domain_bus_exports));
        emitDomainEvent2("diary:entry-decrypted", { noteId, date: e.date, newTags });
        await this.loadAndRelayout();
      } catch (e2) {
        notice("取出失败：主密码可能不正确，密文未受影响", "error");
      }
    }
    /** 拆信看：加密条目在册时（保险箱已解锁）直接摊开全文；内容随密文一起存在内存里 */
    unsealEntry(e) {
      const env = this.blockEl.querySelector(
        `.bz-diary-envelope[data-eid="${cssEscape(e.id || "")}"]`
      );
      if (env) this.onEnvelope(env);
      else this.openSheet(e.kind === "letter" ? "火漆封缄 · 全文" : "火漆封缄 · 全文", this.buildUnsealed(e));
    }
    /** 信封被点：演示拆封动效，然后把全文放到抽出来的那张纸上 */
    onEnvelope(env) {
      if (env.classList.contains("bz-diary-unsealed") || env.classList.contains("bz-diary-opening")) return;
      const eid = env.dataset.eid || "";
      const e = this.byEid.get(eid);
      if (!e) return;
      env.classList.add("bz-diary-opening");
      const epoch = this.epoch;
      setTimeout(() => {
        if (epoch !== this.epoch || !env.isConnected) return;
        env.classList.remove("bz-diary-opening");
        env.classList.add("bz-diary-unsealed");
        const box = this.buildUnsealed(e);
        this.openSheet("火漆封缄 · 全文", box);
        if (e.noteId) void this.mountEncryptedMedia(box, e.noteId);
      }, 620);
    }
    /** 撕掉：接本域 `showConfirm`（加密条目走保险箱销毁分支）+ 碎纸动效 */
    async tearEntry(e) {
      try {
        if (e.kind !== "diary") {
          notice("影视、信、书条目请在对应面板中管理", "info");
          return;
        }
        const els = Array.from(this.blockEl.querySelectorAll("[data-eid]")).filter(
          (el) => el.dataset.eid === e.id && el.offsetParent
        );
        this.tearAnim(els);
        showConfirm({
          filename: e.filename || e.date,
          filePath: e.filePath,
          date: e.date,
          time: e.time,
          lineNumber: e.lineNumber || 0,
          tags: e.tags,
          encrypted: e.encrypted,
          noteId: e.noteId
        });
      } catch (e2) {
        notice("删除暂不可用", "error");
      }
    }
    /**
     * 碎纸动效：按元素实测矩形把两片纸撕开抛下（几何是**量出来的**，故走内联；
     * 颜色/材质仍由 `.bz-diary-scrap` 的 CSS 给 —— 零内联视觉样式口径不破）。
     */
    tearAnim(els) {
      if (!els.length) return;
      const r0 = els[0].getBoundingClientRect();
      const rN = els[els.length - 1].getBoundingClientRect();
      const box = {
        l: Math.min(r0.left, rN.left),
        t: r0.top,
        r: Math.max(r0.right, rN.right),
        b: Math.max(r0.bottom, rN.bottom)
      };
      const teeth = 7;
      const pts = ["0% 0%"];
      for (let i = 0; i <= teeth; i++) pts.push(`${i / teeth * 100}% ${28 + Math.random() * 18}%`);
      pts.push("100% 0%");
      const path = `polygon(${pts.join(",")})`;
      [0, 1].forEach((side) => {
        const frag = document.createElement("div");
        frag.className = "bz-diary-scrap";
        frag.style.left = `${box.l}px`;
        frag.style.top = `${box.t}px`;
        frag.style.width = `${box.r - box.l}px`;
        frag.style.height = `${box.b - box.t}px`;
        frag.style.clipPath = path;
        frag.style.transformOrigin = side ? "100% 0" : "0 0";
        document.body.appendChild(frag);
        const dir = side ? 1 : -1;
        frag.animate(
          [
            { transform: "rotate(0deg) translate(0,0)", opacity: 1 },
            { transform: `rotate(${dir * (9 + Math.random() * 13)}deg) translate(${dir * 60}px, 220px)`, opacity: 0 }
          ],
          { duration: 700, easing: "cubic-bezier(.3,.4,.6,1)", fill: "forwards" }
        );
        setTimeout(() => frag.remove(), 760);
      });
      for (let i = 0; i < 7; i++) {
        const s = document.createElement("div");
        s.className = "bz-diary-scrap";
        const sz = 5 + Math.random() * 7;
        s.style.left = `${box.l + Math.random() * (box.r - box.l)}px`;
        s.style.top = `${box.t + Math.random() * (box.b - box.t)}px`;
        s.style.width = `${sz}px`;
        s.style.height = `${sz * (0.7 + Math.random() * 0.7)}px`;
        document.body.appendChild(s);
        s.animate(
          [
            { transform: "translate(0,0) rotate(0)", opacity: 1 },
            {
              transform: `translate(${-90 + Math.random() * 180}px, ${160 + Math.random() * 140}px) rotate(${-260 + Math.random() * 520}deg)`,
              opacity: 0
            }
          ],
          { duration: 650 + Math.random() * 300, easing: "ease-in", fill: "forwards" }
        );
        setTimeout(() => s.remove(), 1e3);
      }
      els.forEach((el) => {
        el.style.visibility = "hidden";
      });
    }
    // ============================================================
    //  贴纸册（按类翻）
    // ============================================================
    tagCounts() {
      const m = /* @__PURE__ */ new Map();
      for (const e of this.entries) {
        if (e.encrypted) continue;
        for (const t of e.tags) m.set(t, (m.get(t) || 0) + 1);
      }
      return m;
    }
    /** 贴纸册：按类重装订一本分类册（原型的「换贴纸」模式改走真 showTagPicker，不在这里） */
    openAlbum() {
      this.albumGridEl.innerHTML = "";
      const counts = this.tagCounts();
      this.albumSubEl.textContent = "点一张，就按它重装订一本分类册";
      const tags = Array.from(counts.keys()).filter((t) => t !== "加密").sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
      if (counts.has("加密")) tags.push("加密");
      for (const t of tags) {
        const isEncrypt = t === "加密";
        const b = document.createElement("span");
        b.className = `bz-diary-ap-sticker${isEncrypt ? " bz-diary-as-encrypt" : ""}`;
        if (this.filterTag === t) b.classList.add("bz-diary-on");
        b.innerHTML = `<span class="bz-diary-as-emoji">${getTagEmoji(t)}</span>${escapeHtml2(t)}` + (isEncrypt ? "" : `<i class="bz-diary-as-count"> ${counts.get(t) || 0}</i>`);
        b.addEventListener("click", () => {
          this.closeAlbum();
          this.filterTag = this.filterTag === t ? null : t;
          this.applyFilter();
        });
        this.albumGridEl.appendChild(b);
      }
      const ok = this.albumEl.querySelector(".bz-diary-ap-confirm");
      if (ok) ok.hidden = true;
      this.albumEl.hidden = false;
    }
    closeAlbum() {
      if (!this.albumEl) return;
      this.albumEl.hidden = true;
    }
    applyFilter() {
      this.relayout(false);
      if (this.filterTag) {
        this.filterTabEl.classList.add("bz-diary-on");
        const name = this.filterTabEl.querySelector(".bz-diary-ft-name");
        if (name) name.textContent = `${getTagEmoji(this.filterTag)} ${this.filterTag}`;
        this.jumpToPage(0);
        this.toast(`分类册装订好了：${this.filterTag}`);
      } else {
        this.filterTabEl.classList.remove("bz-diary-on");
        this.toast("整本册子回来了");
      }
    }
    bindAlbum() {
      this.albumEl.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest(".bz-diary-ap-cancel") || !t.closest(".bz-diary-ap-book")) this.closeAlbum();
      });
      this.filterTabEl.addEventListener("click", () => {
        this.filterTag = null;
        this.applyFilter();
      });
    }
    // ============================================================
    //  台历（跳日子）
    // ============================================================
    /**
     * 台历两种模式（原型同款）：
     * - `jump`（默认，点「跳」文具）：点**落过笔**的日子 → 翻到那天；
     * - `write`（写作内页的「改日子 · 时辰」）：**所有日子都可点**（给空白日子补写是常事），
     *   底下多一行时辰输入——`parseFlexibleDateTime` 认 `21:30` / `1 分钟前` / `昨天 08:00`，
     *   「就这天」一次性回写草稿的日子与时辰。
     */
    openCal(mode = "jump") {
      var _a;
      this.calMode = mode;
      const d = this.draft;
      const base = mode === "write" && d ? d.date : ((_a = this.visibleEntries()[0]) == null ? void 0 : _a.date) || "2026-01-01";
      this.cal.year = Number(base.slice(0, 4));
      this.cal.month = Number(base.slice(5, 7));
      this.calTimeRowEl.hidden = mode !== "write";
      this.calOkEl.hidden = mode !== "write";
      this.calErrEl.textContent = "";
      if (mode === "write" && d) {
        this.calInputEl.value = d.time;
        this.calDate = d.date;
      } else {
        this.calDate = null;
      }
      this.renderCal();
      this.calEl.hidden = false;
    }
    renderCal() {
      const { year, month } = this.cal;
      const writeMode = this.calMode === "write";
      this.calYmEl.textContent = `${year} 年 ${month} 月`;
      const byDay = /* @__PURE__ */ new Map();
      for (const e of this.visibleEntries()) {
        if (e.date.slice(0, 7) === `${year}-${pad22(month)}`) {
          const d = Number(e.date.slice(8, 10));
          byDay.set(d, (byDay.get(d) || 0) + 1);
        }
      }
      const first = new Date(year, month - 1, 1).getDay();
      const days = new Date(year, month, 0).getDate();
      let html = WEEK.map((w) => `<span class="bz-diary-cal-wd">${w}</span>`).join("");
      for (let i = 0; i < first; i++) html += '<span class="bz-diary-cal-cell"></span>';
      for (let d = 1; d <= days; d++) {
        const n = byDay.get(d);
        const sel = this.calDate === `${year}-${pad22(month)}-${pad22(d)}`;
        html += `<span class="bz-diary-cal-cell${n ? " bz-diary-has" : ""}${writeMode ? " bz-diary-pickable" : ""}${sel ? " bz-diary-sel" : ""}" data-d="${d}"${n ? ` data-n="${n}"` : ""}>${d}</span>`;
      }
      this.calGridEl.innerHTML = html;
      const pickable = writeMode ? ".bz-diary-cal-cell[data-d]" : ".bz-diary-cal-cell.bz-diary-has";
      this.calGridEl.querySelectorAll(pickable).forEach((c) => {
        c.addEventListener("click", () => {
          const date = `${year}-${pad22(month)}-${pad22(Number(c.dataset.d))}`;
          if (writeMode) {
            this.calDate = date;
            this.calGridEl.querySelectorAll(".bz-diary-sel").forEach((x) => x.classList.remove("bz-diary-sel"));
            c.classList.add("bz-diary-sel");
            return;
          }
          this.closeCal();
          this.jumpToDay(date);
        });
      });
    }
    closeCal() {
      if (!this.calEl) return;
      this.calEl.hidden = true;
    }
    jumpToDay(date) {
      for (let pi = 0; pi < this.pages.length; pi++) {
        if (pageDateOf(this.pages[pi]) === date) {
          this.jumpToPage(pi);
          return;
        }
      }
      this.toast("这一册里，那天没落笔");
    }
    /**
     * 「就这天」：写作模式才有的提交。
     *
     * 分工与原型一致：**日子从格子来**（选中那天，没选就是草稿原来那天），**时辰从这行字来**——
     * 所以这一行认的是「时辰」而不是完整时刻：`21:30` 直接认，`1 分钟前` / `昨天 21:30`
     * 走 `parseFlexibleDateTime` 取它的时分。认不出来就留在框里报错，不猜。
     */
    commitCalWrite() {
      const d = this.draft;
      if (!d) {
        this.closeCal();
        return;
      }
      const raw = this.calInputEl.value.trim();
      const time = this.parseCalTime(raw);
      if (!time) {
        this.calErrEl.textContent = "这行时辰没认出来";
        return;
      }
      d.date = this.calDate || d.date;
      d.time = time;
      this.renderWspDay();
      this.closeCal();
      this.toast(`写成 ${d.date} ${d.time}`);
    }
    /** 时辰输入 → `HH:mm`；`21:30` 这类直读，其余交自然语言解析取时分 */
    parseCalTime(raw) {
      const bare = raw.match(/^(\d{1,2})[:：](\d{1,2})$/);
      if (bare) {
        const hh = Number(bare[1]);
        const mm = Number(bare[2]);
        if (hh > 23 || mm > 59) return null;
        return `${pad22(hh)}:${pad22(mm)}`;
      }
      const m = parseFlexibleDateTime(raw);
      return m && m.isValid() ? m.format("HH:mm") : null;
    }
    bindCal() {
      this.calEl.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest(".bz-diary-cal-cancel") || !t.closest(".bz-diary-cal")) {
          this.closeCal();
          return;
        }
        if (t.closest(".bz-diary-cal-ok")) {
          this.commitCalWrite();
          return;
        }
        const nav = t.closest(".bz-diary-cal-nav");
        if (nav) {
          this.cal.month += Number(nav.dataset.nav || 0);
          if (this.cal.month > 12) {
            this.cal.month = 1;
            this.cal.year++;
          }
          if (this.cal.month < 1) {
            this.cal.month = 12;
            this.cal.year--;
          }
          this.renderCal();
        }
      });
      this.calInputEl.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        this.commitCalWrite();
      });
    }
    // ============================================================
    //  放大镜（检索：荧光笔）
    // ============================================================
    runSearch(kw) {
      this.clearMarks();
      this.search = { kw, hits: [], i: 0 };
      for (let pi = 0; pi < this.pages.length; pi++) {
        for (const el of this.pages[pi]) {
          if (el.classList.contains("bz-diary-b-photo") || el.classList.contains("bz-diary-b-audio") || el.classList.contains("bz-diary-b-envelope") || el.classList.contains("bz-diary-b-daystamp")) {
            continue;
          }
          if ((el.textContent || "").indexOf(kw) >= 0) this.search.hits.push({ pi, el });
        }
      }
      if (!this.search.hits.length) {
        this.openSlip({ title: "没 找 到", body: `整本册子都翻了，没有「${escapeHtml2(kw)}」这个词。`, ok: "知道了" });
        return;
      }
      this.toast(`寻得 ${this.search.hits.length} 处，荧光笔伺候`);
      this.nextHit();
    }
    nextHit() {
      const s = this.search;
      if (!s.hits.length) return;
      const hit = s.hits[s.i % s.hits.length];
      s.i++;
      this.jumpToPage(hit.pi);
      setTimeout(() => this.markHit(hit.el, s.kw || ""), 80);
    }
    markHit(el, kw) {
      var _a;
      if (!el.isConnected || !kw) return;
      if (!el.dataset.orig) el.dataset.orig = el.innerHTML;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
        acceptNode: (n2) => n2.parentElement && n2.parentElement.closest("mark") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const texts = [];
      let n;
      while (n = walker.nextNode()) texts.push(n);
      for (const node of texts) {
        const t = node.textContent || "";
        if (t.indexOf(kw) < 0) continue;
        const frag = document.createDocumentFragment();
        let rest = t;
        while (rest.indexOf(kw) >= 0) {
          const i = rest.indexOf(kw);
          if (i) frag.appendChild(document.createTextNode(rest.slice(0, i)));
          const mk = document.createElement("mark");
          mk.className = "bz-diary-hl bz-diary-hl-on";
          mk.textContent = kw;
          frag.appendChild(mk);
          rest = rest.slice(i + kw.length);
        }
        if (rest) frag.appendChild(document.createTextNode(rest));
        (_a = node.parentNode) == null ? void 0 : _a.replaceChild(frag, node);
      }
    }
    /**
     * 拆荧光笔。只拆**检索打的那一笔**（`bz-diary-hl-on`）——原文里作者自己写的 `==高亮==`
     * 经 inlineMd 渲染出来也是 `mark`，无差别拆会把全册手写高亮无声拆光。
     */
    clearMarks() {
      if (!this.root) return;
      this.root.querySelectorAll("[data-orig]").forEach((el) => {
        el.innerHTML = el.dataset.orig || "";
        delete el.dataset.orig;
      });
      this.root.querySelectorAll(".bz-diary-page-item mark.bz-diary-hl-on").forEach((m) => {
        const p = m.parentNode;
        if (p) {
          p.replaceChild(document.createTextNode(m.textContent || ""), m);
          p.normalize();
        }
      });
    }
    askSearch() {
      this.openSlip({
        title: "放 大 镜",
        body: "要找哪个词？整本册子替你翻。",
        input: { placeholder: "比如：雨、猫、游戏……" },
        ok: "翻找",
        onSubmit: (v) => {
          if (!v) return "写一个词嘛";
          this.runSearch(v);
          return null;
        }
      });
    }
    // ============================================================
    //  纸条（通用输入 / 确认）
    // ============================================================
    openSlip(opt) {
      this.slipTitleEl.textContent = opt.title || "";
      this.slipBodyEl.innerHTML = opt.body || "";
      this.slipRowEl.innerHTML = "";
      let input = null;
      if (opt.input) {
        input = document.createElement("input");
        input.className = "bz-diary-slip-input";
        input.type = opt.input.type || "text";
        input.placeholder = opt.input.placeholder || "";
        this.slipBodyEl.appendChild(input);
      }
      const cancel = document.createElement("span");
      cancel.className = "bz-diary-slip-btn";
      cancel.textContent = opt.cancelText || "算了";
      cancel.addEventListener("click", () => this.closeSlip());
      this.slipRowEl.appendChild(cancel);
      const ok = document.createElement("span");
      ok.className = `bz-diary-slip-btn bz-diary-primary${opt.danger ? " bz-diary-danger" : ""}`;
      ok.textContent = opt.ok || "好";
      ok.addEventListener("click", () => {
        const v = input ? input.value.trim() : void 0;
        const err = opt.onSubmit ? opt.onSubmit(v) : null;
        if (err) {
          let line = this.slipBodyEl.querySelector(".bz-diary-slip-err-line");
          if (!line) {
            line = document.createElement("div");
            line.className = "bz-diary-slip-err bz-diary-slip-err-line";
            this.slipBodyEl.appendChild(line);
          }
          line.textContent = err;
          return;
        }
        this.closeSlip();
      });
      this.slipRowEl.appendChild(ok);
      this.slipEl.hidden = false;
      if (input) setTimeout(() => input == null ? void 0 : input.focus(), 60);
    }
    closeSlip() {
      if (!this.slipEl) return;
      this.slipEl.hidden = true;
    }
    bindSlip() {
      this.slipEl.addEventListener("click", (ev) => {
        if (!ev.target.closest(".bz-diary-slip-paper")) this.closeSlip();
      });
      this.slipEl.addEventListener("keydown", (ev) => {
        var _a;
        if (ev.key === "Enter") (_a = this.slipRowEl.querySelector(".bz-diary-slip-btn.bz-diary-primary")) == null ? void 0 : _a.click();
      });
    }
    // ============================================================
    //  文具五项（写 / 找 / 跳 / 类）
    // ============================================================
    doTact(name) {
      switch (name) {
        case "pencil":
          this.startWrite();
          break;
        case "lens":
          this.askSearch();
          break;
        case "calendar":
          this.openCal();
          break;
        case "stickers":
          this.openAlbum();
          break;
      }
    }
    // ============================================================
    //  写作内页（ADR-0233）：点「写」在书上摊开一张素纸，正文写在这一页上
    // ============================================================
    /**
     * 摊开写作内页（原型 `.scratch/diary-quill` 的「铅笔写」）。
     *
     * 与旧弹窗（`openAddDialog`）的分工：那边只剩「按类改标签」的标签选择器在用；
     * 新建一篇现在全在这一页上——日子/时辰、正文、贴纸、落笔，四件都在纸面上，
     * 落笔直接进写层（`store.addEntry` 的守卫 / 串行队列 / 同刻唯一一条都不绕）。
     */
    startWrite() {
      if (this.draft) {
        this.toast("先把这张纸写完，或揉掉");
        this.focusWrite();
        return;
      }
      const now = /* @__PURE__ */ new Date();
      this.draft = {
        date: `${now.getFullYear()}-${pad22(now.getMonth() + 1)}-${pad22(now.getDate())}`,
        time: `${pad22(now.getHours())}:${pad22(now.getMinutes())}`,
        tags: []
      };
      this.wspAreaEl.value = "";
      this.renderWspDay();
      this.renderWspTools();
      this.wspEl.hidden = false;
      setTimeout(() => this.focusWrite(), 60);
    }
    focusWrite() {
      const ta = this.wspAreaEl;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    /** 日戳（与正文日戳同源）+ 「改日子 · 时辰」小签 */
    renderWspDay() {
      const d = this.draft;
      if (!d) return;
      this.wspDayEl.innerHTML = writeDaystampHTML(d.date);
    }
    /**
     * 贴纸（标签）chips：口径与写日记弹窗同源（`getSortedTagsForAddDialog`，不含「加密」），
     * 展开过的二级标签在此已是叶子名。选中态走 `bz-diary-on`。
     */
    renderWspTools() {
      var _a;
      const picked = new Set(((_a = this.draft) == null ? void 0 : _a.tags) || []);
      const chips = getSortedTagsForAddDialog().map(
        (t) => `<span class="bz-diary-wsp-chip${picked.has(t) ? " bz-diary-on" : ""}" data-tag="${escapeHtml2(
          t
        )}">${getTagEmoji(t)} ${escapeHtml2(t)}</span>`
      ).join("");
      this.wspToolsEl.innerHTML = `<span class="bz-diary-wsp-media" title="从本机选照片 / 录音 / 视频，放进 vault 里引用">＋ 贴一件</span>` + chips;
    }
    bindWrite() {
      this.wspEl.addEventListener("click", (ev) => {
        const t = ev.target;
        if (t.closest(".bz-diary-wsp-datebtn")) {
          this.openCal("write");
          return;
        }
        if (t.closest(".bz-diary-wsp-media")) {
          this.pickMedia();
          return;
        }
        const chip = t.closest(".bz-diary-wsp-chip");
        if (chip) {
          this.toggleDraftTag(chip);
          return;
        }
        const act = t.closest("[data-wact]");
        if (!act) return;
        if (act.dataset.wact === "discard") this.discardWrite();
        else if (act.dataset.wact === "save") void this.saveWrite();
      });
    }
    toggleDraftTag(chip) {
      const d = this.draft;
      const tag = chip.dataset.tag || "";
      if (!d || !tag) return;
      const i = d.tags.indexOf(tag);
      if (i >= 0) d.tags.splice(i, 1);
      else d.tags.push(tag);
      chip.classList.toggle("bz-diary-on", i < 0);
    }
    /** 揉掉这张纸。写过的字不静默丢：有正文先问一句（纸条层，本域自己的确认件）。 */
    discardWrite() {
      if (!this.draft) return;
      if (this.saving) {
        this.toast("正在落笔，等一下");
        return;
      }
      if (this.wspAreaEl.value.trim()) {
        this.openSlip({
          title: "这张纸还没落笔",
          body: "揉掉就没了。",
          ok: "揉掉",
          cancelText: "接着写",
          danger: true,
          onSubmit: () => {
            this.closeSlip();
            this.dropWrite();
            return null;
          }
        });
        return;
      }
      this.dropWrite();
    }
    dropWrite() {
      this.draft = null;
      this.wspAreaEl.value = "";
      this.wspEl.hidden = true;
    }
    /**
     * 落笔：正文、日子时辰、贴纸一并进写层（`store.addEntry`）。返回是否真写进去了。
     *
     * 落完之后只翻回第 0 页——新条目就是最新那一篇，而 `diary:entry-added` 的域事件会安排
     * 一次防抖回刷把这一篇排进册子（此处不抢着重排，免得同一拍排两遍整册）。
     *
     * 写盘在途时把纸面锁住（`readOnly` + 「揉掉」让路）：`await` 期间用户接着敲的字，
     * 会在成功那一刻被 `dropWrite()` 连纸一起清掉——条目已经落盘，那段字却没人收，静默丢。
     */
    async saveWrite() {
      const d = this.draft;
      if (!d || this.saving) return false;
      const text = this.wspAreaEl.value.trim();
      if (!text) {
        this.toast("一个字都没写呢");
        this.focusWrite();
        return false;
      }
      this.saving = true;
      this.wspAreaEl.readOnly = true;
      try {
        await addEntry(d.date, d.time, d.tags.length ? d.tags : ["日记"], text);
        this.dropWrite();
        this.jumpToPage(0);
        this.toast("记下了，盖个章");
        return true;
      } catch (e) {
        if (!isUnparsedRefusal(e) && !isDiaryReadFailure(e)) {
          console.error("落笔失败:", e);
          notice(`落笔没成：${e instanceof Error ? e.message : String(e)}`, "error");
        }
        return false;
      } finally {
        this.saving = false;
        this.wspAreaEl.readOnly = false;
      }
    }
    // ============================================================
    //  内页媒体：从本机挑一件，写进 vault，正文里留一条 `![[名字]]`
    // ============================================================
    /**
     * 唤起系统文件选择器。`<input type=file>` 挂在 body 上再点（仓内既有先例
     * `core/path-picker.ts`）：游离节点在部分 WebView 里不保证唤起；settle 后自己摘掉。
     */
    pickMedia() {
      if (!this.draft) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = PICK_MEDIA_ACCEPT;
      input.multiple = true;
      input.style.display = "none";
      const cleanup = () => input.remove();
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        cleanup();
        void this.importMedia(files);
      });
      input.addEventListener("cancel", cleanup);
      document.body.appendChild(input);
      input.click();
    }
    async importMedia(files) {
      if (!files.length) return;
      const app = this.app();
      const maxBytes = MEDIA_PICK_MAX_MB * 1024 * 1024;
      const done = [];
      const tooBig = [];
      const failed = [];
      for (const f of files) {
        if (f.size > maxBytes) {
          tooBig.push(f.name);
          continue;
        }
        try {
          this.insertMediaRef(await writePickedMedia(app, f));
          done.push(f.name);
        } catch (e) {
          console.warn("[diary] 媒体放进 vault 失败：", f.name, e);
          failed.push(f.name);
        }
      }
      if (tooBig.length) notice(`超过 ${MEDIA_PICK_MAX_MB}MB，没放进册子：${tooBig.join("、")}`, "warning");
      if (failed.length) notice(`这些写盘没成：${failed.join("、")}`, "error");
      if (done.length) {
        notice(`放进册子 ${done.length} 件`, tooBig.length || failed.length ? "warning" : "success");
      }
    }
    /** 在光标处插一条媒体引用（自占一行：省得排成「字![[图]]字」那种不成块的样子） */
    insertMediaRef(name) {
      var _a, _b;
      const ta = this.wspAreaEl;
      const ref = `![[${name}]]`;
      const start = (_a = ta.selectionStart) != null ? _a : ta.value.length;
      const end = (_b = ta.selectionEnd) != null ? _b : start;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      const lead = before && !before.endsWith("\n") ? "\n" : "";
      const block = `${lead}${ref}
`;
      ta.value = before + block + after;
      const caret = before.length + block.length;
      ta.setSelectionRange(caret, caret);
      ta.focus();
    }
    // ============================================================
    //  火漆密码框（域内自绘）+ 解锁守卫
    // ============================================================
    bindPass() {
      this.passEl.addEventListener("click", (ev) => {
        const t = ev.target;
        const btn = t.closest(".bz-diary-pass-btn");
        if (!btn || !this.passSettle) return;
        if (btn.dataset.pact === "cancel") {
          this.closePass(false);
          return;
        }
        void this.submitPass();
      });
      this.passInputEl.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" || !this.passSettle) return;
        ev.preventDefault();
        void this.submitPass();
      });
    }
    closePass(ok) {
      const settle = this.passSettle;
      this.passSettle = null;
      this.passEl.hidden = true;
      this.passInputEl.value = "";
      this.passErrEl.textContent = "";
      if (settle) settle(ok);
    }
    async submitPass() {
      const pw = this.passInputEl.value;
      if (!pw) {
        this.passErrEl.textContent = "先填主密码";
        return;
      }
      const { getSafeManager: getSafeManager2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
      const safe = getSafeManager2();
      let ok = false;
      try {
        ok = await safe.unlock(pw);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        this.passErrEl.textContent = "主密码不对，再来一次";
        this.passInputEl.select();
        return;
      }
      this.closePass(true);
    }
    /**
     * 动保险箱前的解锁守卫：已解锁直接放行，否则弹本域的火漆密码框。
     * 原型那个演示用假密码框不搬（ui.ts 头部注记）；校验一律走真保险箱，
     * 本域只收字符串、不碰密码学、不存明文。
     */
    async ensureUnlocked() {
      let safe;
      try {
        const mod = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
        safe = mod.getSafeManager();
      } catch (err) {
        notice(`保险箱暂不可用：${err instanceof Error ? err.message : String(err)}`, "error");
        return false;
      }
      if (safe.unlocked) return true;
      if (this.passSettle) return false;
      return new Promise((resolve) => {
        this.passSettle = resolve;
        this.passErrEl.textContent = "";
        this.passInputEl.value = "";
        this.passEl.hidden = false;
        this.passInputEl.focus();
      });
    }
    bindTools() {
      var _a;
      this.bindSheet();
      this.toolsEl.addEventListener("click", (ev) => {
        const tl = ev.target.closest("[data-tact]");
        if (tl) this.doTact(tl.dataset.tact || "");
      });
      this.refreshBookRect();
      document.addEventListener("mousemove", this.onMouseMove);
      document.addEventListener("mouseleave", this.onMouseLeave);
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: none)").matches) {
        const eh = (_a = this.root) == null ? void 0 : _a.querySelector(".bz-diary-eb-hint");
        if (eh) {
          eh.classList.add("bz-diary-peek");
          setTimeout(() => eh.classList.remove("bz-diary-peek"), 4e3);
        }
      }
      this.edgeEl.addEventListener("click", () => {
        if (this.writeGuard()) return;
        this.openIndexSheet();
      });
    }
    setToolsShown(on) {
      if (on === this.toolsShown) return;
      this.toolsShown = on;
      this.toolsEl.classList.toggle("bz-diary-show", on);
    }
    /** 书在屏幕上的位置：只在窗口尺寸变化时刷新，别每帧量（原来鼠标一动就强制一次整页布局） */
    refreshBookRect() {
      if (!this.bookEl) return;
      this.bookRect = this.bookEl.getBoundingClientRect();
    }
    // ============================================================
    //  纸上的小提示
    // ============================================================
    /* 「那年今日」明信片已按用户要求整件退役（连同 checkOnThisDay 与其「展信」跳页）：
       它和引导便签一样是开册就往桌上摆的非请求物件，与「只要日记本本身」冲突。 */
    toast(msg) {
      if (!this.toastEl) return;
      this.toastEl.textContent = msg;
      this.toastEl.hidden = false;
      this.toastEl.classList.remove("bz-diary-out");
      if (this.toastTimer !== null) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.toastEl.classList.add("bz-diary-out");
        setTimeout(() => {
          if (!this.toastEl) return;
          this.toastEl.hidden = true;
          this.toastEl.classList.remove("bz-diary-out");
        }, 420);
      }, 2400);
    }
    // ============================================================
    //  数据：加载 / 回刷 / 订阅
    // ============================================================
    app() {
      return getApp();
    }
    /** 让位首帧：rAF 后再落一拍 setTimeout，等面板画出来再读盘/整册排版 */
    afterPaint() {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame !== "function" || document.hidden) {
          setTimeout(resolve, 0);
          return;
        }
        requestAnimationFrame(() => setTimeout(resolve, 0));
      });
    }
    /** 重新读盘 + 整册重排（事件回刷路径；保阅读位置） */
    async loadAndRelayout() {
      await this.loadEntries(false);
      this.relayout(true);
    }
    /**
     * 读盘。`allowCache`：开册路径命中预热/上次刷新后的缓存秒开；
     * 刷新/写后回刷/重试一律先作废回源（保持「每次刷新即读盘」语义，不赌缓存失效是否触发）。
     */
    async loadEntries(allowCache) {
      try {
        if (allowCache) {
          this._allowCacheNext = false;
        } else {
          invalidateWallCache();
        }
        this.entries = await loadWallEntries(this.app());
        this._loadError = null;
      } catch (e) {
        this.entries = [];
        this._loadError = e instanceof Error ? e.message : String(e);
        notice(`加载日记失败：${this._loadError}`, "error");
      }
      await this.mergeEncryptedEntries();
      if (this._loadError) this.fallbackEl.hidden = false;
      else this.fallbackEl.hidden = true;
    }
    /**
     * 并入加密日记（保险箱已解锁时）。内容随密文一起在内存里，媒体段照常切出来——
     * 纸面只出火漆信封（render 层按 `encrypted` 分流），拆信时再把全文放到抽出的纸上。
     */
    async mergeEncryptedEntries() {
      try {
        if (!isUnlocked()) return;
        const encrypted = await loadEncryptedEntries();
        if (!encrypted.length) return;
        const existingIds = new Set(this.entries.filter((e) => e.noteId).map((e) => e.noteId));
        const added = [];
        for (const e of encrypted) {
          if (!e.noteId || existingIds.has(e.noteId)) continue;
          existingIds.add(e.noteId);
          added.push({
            date: e.date,
            time: e.time,
            tags: e.tags,
            emoji: e.emoji,
            content: e.content,
            text: stripMediaLinks(e.content),
            media: extractMedia(e.content, DIARY_DIRECTORY),
            segments: extractSegments(e.content),
            filename: e.filename,
            filePath: e.filePath,
            lineNumber: e.lineNumber,
            id: e.id,
            noteId: e.noteId,
            encrypted: true,
            extra: e.extra,
            kind: "diary"
          });
        }
        if (!added.length) return;
        this.entries.push(...added);
        this.entries.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date);
          return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
        });
      } catch (e) {
      }
    }
    /** 写链路五通道 + 保险箱锁态 + 引用同步：域事件防抖回刷整册 */
    subscribeEvents() {
      if (this._subs.length) return;
      const chs = [
        "diary:entry-added",
        "diary:tags-changed",
        "diary:entry-deleted",
        "diary:entry-decrypted",
        "diary:encrypted-purged"
      ];
      for (const ch of chs) {
        this._subs.push(
          onDomainEvent(ch, () => {
            var _a;
            if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
            this.scheduleRelayout();
          })
        );
      }
      this._subs.push(
        onDomainEvent("encrypt:unlock-changed", (evt) => {
          var _a;
          if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
          this.encMediaCache.clear();
          if (!evt || !evt.unlocked) {
            if (this.filterTag === "加密") this.filterTag = null;
            void this.loadAndRelayout();
          } else {
            void this.loadAndRelayout();
          }
        })
      );
      this._subs.push(
        onDomainEvent("vault:md-renamed", (evt) => {
          var _a;
          const oldPath = (evt == null ? void 0 : evt.oldPath) || "";
          const newPath = (evt == null ? void 0 : evt.newPath) || "";
          if (!oldPath || !newPath || oldPath === newPath) return;
          if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex" || !inWallDirs(oldPath)) return;
          const movedOut = !inWallDirs(newPath);
          if (movedOut) dropDiaryMapPath(oldPath);
          else rekeyDiaryMapPath(oldPath, newPath);
          let touched = false;
          for (const e of this.entries) {
            if (e.filePath !== oldPath) continue;
            touched = true;
            if (movedOut) continue;
            e.filePath = newPath;
            if (e.filename === oldPath) e.filename = newPath;
          }
          if (movedOut) this.entries = this.entries.filter((e) => e.filePath !== oldPath);
          if (movedOut || touched) this.relayout(true);
        })
      );
      this._subs.push(
        onDomainEvent("vault:md-deleted", (evt) => {
          var _a;
          const path = (evt == null ? void 0 : evt.path) || "";
          if (!path) return;
          if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex" || !inWallDirs(path)) return;
          const hadMap = dropDiaryMapPath(path);
          const before = this.entries.length;
          this.entries = this.entries.filter((e) => e.filePath !== path);
          if (hadMap || this.entries.length !== before) this.relayout(true);
        })
      );
    }
    unsubscribeEvents() {
      this._subs.forEach((off) => off());
      this._subs = [];
    }
    /** vault modify/create 回刷（纯外部变更：其他工具写入条目文件时册子也要跟上）。
     *  **只认 `.md`**：册子只由条目笔记排出来，而 `我的/日记/附件/` 这类媒体落点也在目录命中面内
     *  （写作内页退回落点时就会往那儿写真照片/录音）——不筛扩展名的话，贴一件媒体就换一次
     *  防抖整册重读 + 重排，用户正写着字被卡一下。 */
    subscribeVault() {
      if (this._vaultRefs.length) return;
      const schedule = (p) => {
        var _a;
        if (!p || !p.toLowerCase().endsWith(".md")) return;
        if (!inWallDirs(p)) return;
        if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
        this.scheduleRelayout();
      };
      this._vaultRefs.push(
        this.app().vault.on("modify", (file) => schedule(file == null ? void 0 : file.path))
      );
      this._vaultRefs.push(
        this.app().vault.on("create", (file) => schedule(file == null ? void 0 : file.path))
      );
    }
    unsubscribeVault() {
      for (const ref of this._vaultRefs) {
        try {
          this.app().vault.offref(ref);
        } catch (e) {
        }
      }
      this._vaultRefs = [];
    }
    /** 防抖整册回刷（域事件与 vault 变更共用；重入时后一次覆盖前一次） */
    scheduleRelayout() {
      if (this.modifyTimer !== null) clearTimeout(this.modifyTimer);
      this.modifyTimer = setTimeout(() => {
        var _a;
        this.modifyTimer = null;
        if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
        void this.loadAndRelayout();
      }, REFRESH_DEBOUNCE_MS);
    }
    // ============================================================
    //  显示 / 隐藏 / 卸载
    // ============================================================
    /**
     * 打开日记本（命令路径：ensure 后 show）。
     *
     * 两条路：
     * - **快路**（`bookFresh` + 墙缓存还新 + 保险箱锁态没变）：这一册就是上次排好的那一册
     *   （DOM 与 StPageFlip 实例都还在，`hide()` 只是 `display:none`），直接翻开——不重读、不重排、
     *   纸上没落笔的草稿原样还在。用户点名：「再次打开日记本的时候，写的内容也不会消失，
     *   也不会再重新渲染页面」。
     * - **慢路**：读全量 → 进度条 → 读完一次成册。上千篇正文走磁盘读 + 每批 10，读完要好几秒；
     *   这段时间书还是空的，桌上摆一张报进度的纸条（`showLoading`），读完换「正在装订」，成册即收。
     */
    show() {
      if (!this._initialized) this.ensureElements();
      const reopen = this._shownOnce;
      this._shownOnce = true;
      this._hideMotion = false;
      this.root.style.display = "flex";
      topifyZ(this.root);
      this._allowCacheNext = true;
      this.subscribeEvents();
      this.subscribeVault();
      if (this.bookFresh && this.entries.length && !this._loadError && this.bookStillValid()) {
        this.toast(reopen ? "又翻开了" : "翻开的是最新那篇");
        return;
      }
      const token = {};
      this.loadToken = token;
      const task = (async () => {
        var _a;
        await this.afterPaint();
        this.showLoading();
        const off = onWallProgress((done, total) => this.updateLoading(done, total));
        try {
          await this.loadEntries(this._allowCacheNext);
        } finally {
          off();
        }
        if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") {
          this.hideLoading();
          return;
        }
        if (this.loadToken !== token) return;
        if (this._loadError) {
          this.hideLoading();
          this.toast("这一册没读出来");
          return;
        }
        this.setLoadingBinding();
        await this.afterPaint();
        try {
          this.relayout(false);
        } finally {
          this.hideLoading();
        }
        this.toast(reopen ? "又翻开了" : "翻开的是最新那篇");
      })();
      this.loadTask = task;
    }
    /**
     * 上一册还能用吗：书页排过 + 墙数据缓存没被外部改动作废 + 保险箱锁态与上次排版的相同
     * （锁态变了要重并加密条目，必须重排）。
     */
    bookStillValid() {
      if (!this.pages.length) return false;
      if (!wallCacheFresh(this.app())) return false;
      return isUnlocked() === this.layoutUnlocked;
    }
    /**
     * 写一篇（命令面板 `bz-diary-write`）：先把册子摊开，等这一册排好再在书上摆出写作内页。
     * 原先这条命令不拉主窗口（直接开旧弹窗）；写作内页是书里的一张纸，得先有书。
     */
    openWrite() {
      var _a;
      const already = ((_a = this.root) == null ? void 0 : _a.style.display) === "flex";
      this.show();
      if (already) {
        this.startWrite();
        return;
      }
      void Promise.resolve(this.loadTask).then(() => {
        var _a2;
        if (((_a2 = this.root) == null ? void 0 : _a2.style.display) === "flex") this.startWrite();
      }).catch((e) => {
        console.error("[diary] 写日记打开失败:", e);
        notice(`写日记打开失败：${e instanceof Error ? e.message : String(e)}`, "error");
      });
    }
    // ============================================================
    //  开册进度（读全量 → 一次成册）
    // ============================================================
    /** 摆出进度纸条。读得快（预热缓存命中）时不摆：先压一个 120ms 的延时，读完即撤。 */
    showLoading() {
      this.loadingTitleEl.textContent = "正在翻找…";
      this.loadingCountEl.textContent = "";
      if (!this.loadBar) {
        this.loadBar = uiProgress({ thin: true });
        this.loadingBarEl.appendChild(this.loadBar.el);
      }
      this.loadBar.setValue(0);
      if (this.loadShowTimer !== null) clearTimeout(this.loadShowTimer);
      this.loadShowTimer = setTimeout(() => {
        var _a;
        this.loadShowTimer = null;
        if (((_a = this.root) == null ? void 0 : _a.style.display) === "flex") this.loadingEl.hidden = false;
      }, LOADING_SHOW_DELAY_MS);
    }
    /** 读盘进度（`done / total` = 日记正文篇数，一目一文件 ⇒ 读完就是全量到位） */
    updateLoading(done, total) {
      var _a;
      if (total > 0) (_a = this.loadBar) == null ? void 0 : _a.setValue(Math.round(done / total * 100));
      this.loadingCountEl.textContent = total > 0 ? `${done} / ${total} 篇` : "";
    }
    /** 读齐了，换到「装订」这一段：这一段是同步的，进度条停在 100% 不动 */
    setLoadingBinding() {
      var _a;
      if (this.loadShowTimer !== null) {
        clearTimeout(this.loadShowTimer);
        this.loadShowTimer = null;
      }
      this.loadingEl.hidden = false;
      this.loadingTitleEl.textContent = "正在装订…";
      (_a = this.loadBar) == null ? void 0 : _a.setValue(100);
      this.loadingCountEl.textContent = `共 ${this.entries.length} 则`;
    }
    hideLoading() {
      var _a;
      if (this.loadShowTimer !== null) {
        clearTimeout(this.loadShowTimer);
        this.loadShowTimer = null;
      }
      this.loadingEl.hidden = true;
      (_a = this.loadBar) == null ? void 0 : _a.setValue(0);
    }
    /** 纸上摊着草稿吗（空纸也算摊着：那张纸还在书里） */
    hasDraft() {
      return !!this.draft && !this.wspEl.hidden;
    }
    /** 纸上有字吗（「写了东西」的唯一判据：正文非空白） */
    draftHasText() {
      return this.hasDraft() && !!this.wspAreaEl.value.trim();
    }
    /**
     * 「草稿在纸上」的**翻页门禁**：翻页 / 索引行 / 台历跳日都要先过这道。
     * 与原型同款——写作页摊开时它不是「一个可以顺便翻过去的浮层」，而是当前唯一该处理的东西。
     */
    writeGuard() {
      if (!this.hasDraft()) return false;
      this.toast("先落笔，或把这张纸揉掉");
      return true;
    }
    /**
     * 收起整本的统一入口（点遮罩 / 点收起钮 / Esc 三条路都走它）。
     *
     * 纸上有字 → **先问一句**（用户点名要求）：接着写 / 先收着 / 落笔。
     * 「先收着」不是丢——草稿留在纸上，下次翻开还在（见 `hide()` 的注释）。
     * 空纸直接收：纸上没东西可丢，不值得拦一道。
     */
    async requestClose() {
      if (!this.root || this.root.style.display !== "flex") return;
      if (!this.draftHasText()) {
        this.dropWrite();
        this.hide();
        return;
      }
      let choice;
      try {
        choice = await openFlowDialog({
          title: "这张纸还没落笔",
          message: "先收着的话，下次翻开日记本还在这张纸上。",
          actions: [
            { label: "接着写", value: "stay" },
            { label: "先收着", value: "hold" },
            { label: "落笔", value: "save", cta: true }
          ]
        });
      } catch (e) {
        return;
      }
      if (choice === "save") {
        const saved = await this.saveWrite();
        if (!saved) return;
        this.hide();
        return;
      }
      if (choice !== "hold") return;
      this.hide();
    }
    hide() {
      if (!this.root || this._hideMotion) return;
      this._hideMotion = true;
      this.closeLightbox();
      this.closeSheet();
      this.closeSlip();
      this.closeAlbum();
      this.closeCal();
      this.closeMenu();
      this.closePass(false);
      if (!this.draftHasText()) this.dropWrite();
      this.hideLoading();
      hideTagPicker();
      this.pauseAllAudio();
      this.unsubscribeEvents();
      this.unsubscribeVault();
      if (this.modifyTimer !== null) {
        clearTimeout(this.modifyTimer);
        this.modifyTimer = null;
      }
      this.setToolsShown(false);
      this._hideMotion = false;
      this.root.style.display = "none";
    }
    /** 当前数据的滚轮年份动态范围（无数据返回 null → 控件回落 1900～当前年+1） */
    getYearRange() {
      let earliest = null;
      for (const entry of this.entries) {
        const y = parseInt(String(entry.date).split("-")[0], 10);
        if (!Number.isNaN(y) && (earliest === null || y < earliest)) earliest = y;
      }
      if (earliest === null) return null;
      return { min: Math.max(1900, earliest), max: (/* @__PURE__ */ new Date()).getFullYear() + 1 };
    }
    cleanup() {
      unregisterPanelEsc("diary");
      document.removeEventListener("keydown", this.onKeydown);
      document.removeEventListener("pointerdown", this.onDocPointerDown, true);
      document.removeEventListener("mousemove", this.onMouseMove);
      document.removeEventListener("mouseleave", this.onMouseLeave);
      window.removeEventListener("resize", this.onResize);
      if (this.resizeTimer !== null) {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = null;
      }
      if (this.toastTimer !== null) {
        clearTimeout(this.toastTimer);
        this.toastTimer = null;
      }
      if (this.modifyTimer !== null) {
        clearTimeout(this.modifyTimer);
        this.modifyTimer = null;
      }
      if (this.loadShowTimer !== null) {
        clearTimeout(this.loadShowTimer);
        this.loadShowTimer = null;
      }
      if (this.toolsRaf) cancelAnimationFrame(this.toolsRaf);
      this.unsubscribeEvents();
      this.unsubscribeVault();
      if (this.flip) {
        try {
          this.flip.destroy();
        } catch (e) {
        }
        this.flip = null;
      }
      this.encMediaCache.clear();
      this.byEid.clear();
      this.photoRefs = [];
      this.photoIndex.clear();
      this.pages = [];
      this.entries = [];
      this.bookFresh = false;
      this.draft = null;
      if (this.root) {
        this.root.remove();
        this.root = null;
      }
      this._initialized = false;
      _DiaryAppController.instance = null;
    }
  };
  _DiaryAppController.instance = null;
  var DiaryAppController = _DiaryAppController;
  function cssEscape(s) {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(s);
    return s.replace(/["\\]/g, "\\$&");
  }

  // src/diary/index.ts
  var initialized2 = false;
  var prewarmed = false;
  var controller2 = null;
  function getController2() {
    if (!controller2) {
      controller2 = DiaryAppController.getInstance();
    }
    return controller2;
  }
  async function ensureDiary(_app3) {
    if (initialized2) return;
    initialized2 = true;
    getController2();
    createTagPicker();
  }
  function openDiary(app) {
    void ensureDiary(app).then(() => getController2().show());
  }
  function openDiaryWrite(app) {
    void ensureDiary(app).then(() => {
      getController2().openWrite();
    });
  }
  function unloadDiary() {
    var _a;
    if (controller2) controller2.cleanup();
    controller2 = null;
    initialized2 = false;
    prewarmed = false;
    invalidateWallCache();
    (_a = document.getElementById("diary-tag-selector-mask")) == null ? void 0 : _a.remove();
  }

  // prototypes/diary/fake-sim.ts
  function seedSource() {
    return window.DIARY || window.parent && window.parent.DIARY || null;
  }
  function seedVault() {
    var _a;
    const files = ((_a = seedSource()) == null ? void 0 : _a.FILES) || [];
    if (files.length && !localStorage.getItem("bz-sim:" + files[0].path)) {
      for (const f of files) {
        localStorage.setItem("bz-sim:" + f.path, encodeSeedFile(f.content, { ctime: f.ctime, mtime: f.ctime }));
      }
    }
  }
  function injectSettings() {
    setSettingsProvider(() => ({}));
  }
  var _app2 = null;
  function bootDiarySim() {
    const g = window;
    if (g.__bzDiarySimBooted) return;
    g.__bzDiarySimBooted = true;
    seedVault();
    injectSettings();
    const app = new FakeApp();
    setApp(app);
    _app2 = app;
    applyDirectories({});
  }
  function openPanel() {
    bootDiarySim();
    openDiary(_app2);
  }
  function openWrite() {
    bootDiarySim();
    openDiaryWrite(_app2);
  }
  return __toCommonJS(fake_sim_exports);
})();
/*!
 * page-flip (StPageFlip) v2.0.7 | MIT License | https://github.com/Nodlik/StPageFlip
 * Copyright (c) 2020 Nodlik
 *
 * 原样内嵌（未改一字）—— 完整许可原文见同目录 page-flip.LICENSE；
 * 类型声明见同目录 page-flip.browser.d.ts（只覆盖本域用到的 API 面）。
 */
/*! Bundled license information:

moment/moment.js:
  (*! moment.js *)
  (*! version : 2.30.1 *)
  (*! authors : Tim Wood, Iskren Chernev, Moment.js contributors *)
  (*! license : MIT *)
  (*! momentjs.com *)
*/
