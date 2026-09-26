/* 源指纹 efaf5413da43a0ba · 仓内输入 83 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/people/fake-sim.ts","prototypes/people/fake/fake-obsidian.ts","src/bookshelf/data.ts","src/bookshelf/state.ts","src/cinema/state.ts","src/core/ai.ts","src/core/app.ts","src/core/crypto.ts","src/core/diary-format.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/external-tool.ts","src/core/flow-dialog.ts","src/core/http.ts","src/core/item-actions.ts","src/core/lock-stats.ts","src/core/mobile.ts","src/core/model-limits.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/settings-btn-state.ts","src/core/settings-common.ts","src/core/settings-modal.ts","src/core/settings-provider.ts","src/core/settings-schema.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/help-tip.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/lock-screen.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/diary/config.ts","src/encrypt/data.ts","src/encrypt/index.ts","src/encrypt/motion.ts","src/encrypt/preview.ts","src/encrypt/ui.ts","src/encrypt/vault-assets-view.ts","src/password-vault/data.ts","src/people/data.ts","src/people/datasource.ts","src/people/digest.ts","src/people/incremental.ts","src/people/insights.ts","src/people/jobs.ts","src/people/media.ts","src/people/migrate.ts","src/people/parse.ts","src/people/render.ts","src/people/safe-store.ts","src/people/settings.ts","src/people/stats.ts","src/people/sync.ts","src/people/types.ts","src/people/ui.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/people/fake-sim.ts → window.BZW_people（行为单源预览包，issue 245/ADR-0106） */
var BZW_people = (() => {
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
        var YEAR = 0, MONTH = 1, DATE = 2, HOUR = 3, MINUTE = 4, SECOND = 5, MILLISECOND = 6, WEEK = 7, WEEKDAY = 8;
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
        function createDate(y, m, d, h, M3, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M3, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M3, s, ms);
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
              overflow = WEEK;
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
          var normalizedInput = normalizeObjectUnits(duration), years2 = normalizedInput.year || 0, quarters = normalizedInput.quarter || 0, months3 = normalizedInput.month || 0, weeks2 = normalizedInput.week || normalizedInput.isoWeek || 0, days2 = normalizedInput.day || 0, hours2 = normalizedInput.hour || 0, minutes2 = normalizedInput.minute || 0, seconds2 = normalizedInput.second || 0, milliseconds2 = normalizedInput.millisecond || 0;
          this._isValid = isDurationValid(normalizedInput);
          this._milliseconds = +milliseconds2 + seconds2 * 1e3 + // 1000
          minutes2 * 6e4 + // 1000 * 60
          hours2 * 1e3 * 60 * 60;
          this._days = +days2 + weeks2 * 7;
          this._months = +months3 + quarters * 3 + years2 * 12;
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
          var milliseconds2 = duration._milliseconds, days2 = absRound(duration._days), months3 = absRound(duration._months);
          if (!mom.isValid()) {
            return;
          }
          updateOffset = updateOffset == null ? true : updateOffset;
          if (months3) {
            setMonth(mom, get(mom, "Month") + months3 * isAdding);
          }
          if (days2) {
            set$1(mom, "Date", get(mom, "Date") + days2 * isAdding);
          }
          if (milliseconds2) {
            mom._d.setTime(mom._d.valueOf() + milliseconds2 * isAdding);
          }
          if (updateOffset) {
            hooks.updateOffset(mom, days2 || months3);
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
          var milliseconds2 = this._milliseconds, days2 = this._days, months3 = this._months, data = this._data, seconds2, minutes2, hours2, years2, monthsFromDays;
          if (!(milliseconds2 >= 0 && days2 >= 0 && months3 >= 0 || milliseconds2 <= 0 && days2 <= 0 && months3 <= 0)) {
            milliseconds2 += absCeil(monthsToDays(months3) + days2) * 864e5;
            days2 = 0;
            months3 = 0;
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
          months3 += monthsFromDays;
          days2 -= absCeil(monthsToDays(monthsFromDays));
          years2 = absFloor(months3 / 12);
          months3 %= 12;
          data.days = days2;
          data.months = months3;
          data.years = years2;
          return this;
        }
        function daysToMonths(days2) {
          return days2 * 4800 / 146097;
        }
        function monthsToDays(months3) {
          return months3 * 146097 / 4800;
        }
        function as(units) {
          if (!this.isValid()) {
            return NaN;
          }
          var days2, months3, milliseconds2 = this._milliseconds;
          units = normalizeUnits(units);
          if (units === "month" || units === "quarter" || units === "year") {
            days2 = this._days + milliseconds2 / 864e5;
            months3 = this._months + daysToMonths(days2);
            switch (units) {
              case "month":
                return months3;
              case "quarter":
                return months3 / 3;
              case "year":
                return months3 / 12;
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
        var milliseconds = makeGetter("milliseconds"), seconds = makeGetter("seconds"), minutes = makeGetter("minutes"), hours = makeGetter("hours"), days = makeGetter("days"), months2 = makeGetter("months"), years = makeGetter("years");
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
          var duration = createDuration(posNegDuration).abs(), seconds2 = round(duration.as("s")), minutes2 = round(duration.as("m")), hours2 = round(duration.as("h")), days2 = round(duration.as("d")), months3 = round(duration.as("M")), weeks2 = round(duration.as("w")), years2 = round(duration.as("y")), a = seconds2 <= thresholds2.ss && ["s", seconds2] || seconds2 < thresholds2.s && ["ss", seconds2] || minutes2 <= 1 && ["m"] || minutes2 < thresholds2.m && ["mm", minutes2] || hours2 <= 1 && ["h"] || hours2 < thresholds2.h && ["hh", hours2] || days2 <= 1 && ["d"] || days2 < thresholds2.d && ["dd", days2];
          if (thresholds2.w != null) {
            a = a || weeks2 <= 1 && ["w"] || weeks2 < thresholds2.w && ["ww", weeks2];
          }
          a = a || months3 <= 1 && ["M"] || months3 < thresholds2.M && ["MM", months3] || years2 <= 1 && ["y"] || ["yy", years2];
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
          var seconds2 = abs$1(this._milliseconds) / 1e3, days2 = abs$1(this._days), months3 = abs$1(this._months), minutes2, hours2, years2, s, total = this.asSeconds(), totalSign, ymSign, daysSign, hmsSign;
          if (!total) {
            return "P0D";
          }
          minutes2 = absFloor(seconds2 / 60);
          hours2 = absFloor(minutes2 / 60);
          seconds2 %= 60;
          minutes2 %= 60;
          years2 = absFloor(months3 / 12);
          months3 %= 12;
          s = seconds2 ? seconds2.toFixed(3).replace(/\.?0+$/, "") : "";
          totalSign = total < 0 ? "-" : "";
          ymSign = sign(this._months) !== sign(total) ? "-" : "";
          daysSign = sign(this._days) !== sign(total) ? "-" : "";
          hmsSign = sign(this._milliseconds) !== sign(total) ? "-" : "";
          return totalSign + "P" + (years2 ? ymSign + years2 + "Y" : "") + (months3 ? ymSign + months3 + "M" : "") + (days2 ? daysSign + days2 + "D" : "") + (hours2 || minutes2 || seconds2 ? "T" : "") + (hours2 ? hmsSign + hours2 + "H" : "") + (minutes2 ? hmsSign + minutes2 + "M" : "") + (seconds2 ? hmsSign + s + "S" : "");
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
        proto$2.months = months2;
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

  // prototypes/people/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a2;
    const d = typeof window !== "undefined" && ((_a2 = window.BZW_PEOPLE_ICONS) == null ? void 0 : _a2[iconId]) || "";
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
  async function requestUrl() {
    throw new Error("原型环境无网络请求（fake obsidian requestUrl）");
  }
  var import_moment, Platform, Setting, MarkdownRenderer, Component, FakeVault, FakeWorkspace, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/people/fake/fake-obsidian.ts"() {
      import_moment = __toESM(require_moment());
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      Setting = class {
        constructor(_container) {
          this.settingEl = document.createElement("div");
        }
      };
      MarkdownRenderer = class {
      };
      Component = class {
      };
      FakeVault = class _FakeVault {
        constructor() {
          this.listeners = /* @__PURE__ */ new Map();
          this.idSeq = 0;
          if (typeof window !== "undefined") {
            window.addEventListener("storage", (e) => {
              if (!e.key || !e.key.startsWith("bz-sim:")) return;
              const path = e.key.slice("bz-sim:".length);
              this.emit("modify", { path });
            });
          }
        }
        static key(path) {
          return "bz-sim:" + path;
        }
        getAbstractFileByPath(path) {
          const raw = localStorage.getItem(_FakeVault.key(path));
          return raw == null ? null : { path, content: raw };
        }
        async read(f) {
          return f.content;
        }
        async modify(f, content) {
          f.content = content;
          localStorage.setItem(_FakeVault.key(f.path), content);
        }
        async create(path, content) {
          const f = { path, content };
          localStorage.setItem(_FakeVault.key(path), content);
          return f;
        }
        async createFolder(_path) {
          return void 0;
        }
        /** rename（obsidian vault 语义）：键改名 + 事件 (file, oldPath)——引用同步演示用 */
        rename(oldPath, newPath) {
          const raw = localStorage.getItem(_FakeVault.key(oldPath));
          if (raw == null) return null;
          localStorage.removeItem(_FakeVault.key(oldPath));
          localStorage.setItem(_FakeVault.key(newPath), raw);
          const f = { path: newPath, content: raw };
          this.emit("rename", f, oldPath);
          return f;
        }
        /** delete（obsidian vault 语义）：删键 + 事件 (file, prev)——引用同步演示用 */
        delete(path) {
          const raw = localStorage.getItem(_FakeVault.key(path));
          if (raw == null) return null;
          localStorage.removeItem(_FakeVault.key(path));
          const f = { path, content: raw };
          this.emit("delete", f, f);
          return f;
        }
        /** 事件订阅（core/app vault.on/offref 同形） */
        on(evt, cb) {
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          this.listeners.get(evt).push(cb);
          const id = ++this.idSeq;
          return { ref: id };
        }
        offref(ref) {
          this.listeners.clear();
        }
        emit(evt, ...args) {
          var _a2;
          for (const cb of (_a2 = this.listeners.get(evt)) != null ? _a2 : []) cb(...args);
        }
      };
      FakeWorkspace = class {
        constructor() {
          this.handlers = /* @__PURE__ */ new Map();
          this.idSeq = 0;
        }
        on(evt, cb) {
          if (!this.handlers.has(evt)) this.handlers.set(evt, []);
          this.handlers.get(evt).push(cb);
          const id = ++this.idSeq;
          return { ref: id };
        }
        offref(ref) {
        }
        /** 触发 file-open（壳演示钩子） */
        fileOpen(path) {
          var _a2;
          const file = path ? { path } : null;
          for (const cb of (_a2 = this.handlers.get("file-open")) != null ? _a2 : []) cb(file);
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
          this.workspace = new FakeWorkspace();
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
  var _provider, _saver;
  var init_settings_provider = __esm({
    "src/core/settings-provider.ts"() {
      _provider = null;
      _saver = null;
    }
  });

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el2 of alwaysOnTop) {
      if (!el2.isConnected) {
        alwaysOnTop.delete(el2);
        continue;
      }
      el2.style.zIndex = String(zCounter);
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
    const live2 = els.filter((el2) => !!el2);
    if (live2.length === 0) return;
    const base = allocZBlock(live2.length);
    live2.forEach((el2, i) => {
      el2.style.zIndex = String(base + i);
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
    var _a2;
    try {
      const v = (_a2 = tryGetSettings()) == null ? void 0 : _a2[key];
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
  function calcDuration(text2, base) {
    const len = text2.length;
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
  function armTimer(n, kind, explicitDuration, text2) {
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
      const dur = explicitDuration !== void 0 ? explicitDuration : text2 ? calcDuration(text2, base) : base;
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
      setMessage(text2) {
        n.msgEl.textContent = text2;
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
          Array.from(n.el.querySelectorAll(".bz-notice-action")).map((el2) => el2.textContent || "")
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
    const el2 = document.createElement("div");
    el2.className = "bz-notice bz-notice--" + (isProgress ? "progress" : type) + " bz-notice--in-" + variant;
    el2.setAttribute("role", "status");
    el2.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
    const icon = document.createElement("div");
    icon.className = "bz-notice-icon";
    if (isProgress) {
      icon.innerHTML = SPINNER_SVG;
    } else {
      icon.textContent = ICONS[type];
    }
    el2.appendChild(icon);
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
    el2.appendChild(body);
    let progressEl = null;
    if (isProgress) {
      progressEl = document.createElement("div");
      progressEl.className = "bz-notice-progress";
      el2.appendChild(progressEl);
    }
    const n = { el: el2, timer: null, msgEl, progressEl, iconEl: icon, variant, isProgress, persistent: false };
    const actions = [];
    if (opts && opts.action) actions.push(opts.action);
    if (opts && opts.actions) {
      for (const a of opts.actions) {
        if (!actions.some((x) => x.label === a.label)) actions.push(a);
      }
    }
    for (const a of actions) appendActionBtn(n, a);
    el2.addEventListener("click", () => hideNow(n));
    container.style.zIndex = String(allocZ());
    container.appendChild(el2);
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

  // src/core/esc-manager.ts
  function registerPanelEsc(id, isVisible, close) {
    if (panelEscHandles.has(id)) return;
    panelEscHandles.set(id, escManager.register(id, { isVisible, close }));
  }
  function unregisterPanelEsc(id) {
    var _a2;
    (_a2 = panelEscHandles.get(id)) == null ? void 0 : _a2.unregister();
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
  function isHidden(el2) {
    let cur = el2;
    while (cur && cur !== document.body) {
      if (cur.classList.contains("bz-setting-hidden")) return true;
      if (cur.style.display === "none") return true;
      cur = cur.parentElement;
    }
    return false;
  }
  function trapFocus(container) {
    const onKeydown = (e) => {
      if (e.key !== "Tab") return;
      const items = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el2) => !isHidden(el2) && !el2.hasAttribute("disabled")
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

  // src/core/domain-bus.ts
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
  var channels;
  var init_domain_bus = __esm({
    "src/core/domain-bus.ts"() {
      channels = /* @__PURE__ */ new Map();
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
  var CryptoService, keyCache, KEY_CACHE_MAX;
  var init_crypto = __esm({
    "src/core/crypto.ts"() {
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
              iterations: 1e5,
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
    var _a2;
    const prev = (_a2 = fileTaskQueues.get(filePath)) != null ? _a2 : Promise.resolve();
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
      var _a2;
      const store2 = jsonFileStore(filePath, { ...opts, defaultValue: (_a2 = opts.defaultValue) != null ? _a2 : {} });
      const current = assertPlainObject(filePath, await store2.read());
      const set = await writer(current) || {};
      const next = { ...current, ...set };
      await store2.write(next);
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
    var _a2;
    const now = Date.now();
    if (now - ((_a2 = corruptNotifyAt.get(filePath)) != null ? _a2 : 0) < CORRUPT_NOTIFY_DEDUPE_MS) return;
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
      var _a2;
      if (((_a2 = opts.onCorrupt) == null ? void 0 : _a2.call(opts, filePath, err)) === false) {
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
  function diaryStampText(date, time) {
    return `${date} ${time}`;
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
  var DIARY_ENTRY_FILE_RE, DIARY_LEGACY_FILE_RE, DIARY_DATE_KEY, DIARY_TYPE_KEY;
  var init_diary_format = __esm({
    "src/core/diary-format.ts"() {
      DIARY_ENTRY_FILE_RE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;
      DIARY_LEGACY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})\.md$/;
      DIARY_DATE_KEY = "date";
      DIARY_TYPE_KEY = "type";
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
  var init_data = __esm({
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
          this.manifest = { version: 1, notes: [] };
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
          var _a2;
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
            this.manifest = parsed;
            this.password = password;
            this.unlocked = true;
            try {
              await this.enqueueOp(() => this.selfHeal());
            } catch (e) {
            }
            (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, true);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
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
        /** 首设/强制重设：写空清单。写失败必须回滚解锁态（否则下次打开又误判无清单） */
        async firstTimeSetup(password) {
          var _a2, _b2;
          this.password = password;
          this.unlocked = true;
          (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, true);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
          this.manifest = { version: 1, notes: [] };
          try {
            await this.saveManifest();
            return true;
          } catch (e) {
            this.unlocked = false;
            this.password = null;
            this.manifest = { version: 1, notes: [] };
            (_b2 = this.onUnlockChange) == null ? void 0 : _b2.call(this, false);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: false });
            return false;
          }
        }
        /** 加锁：清内存态（含派生密钥缓存，密钥不残留）。幂等短路：已锁再锁直接返回，不重复广播 */
        lock() {
          var _a2;
          if (!this.unlocked) return;
          this.unlocked = false;
          this.password = null;
          this.manifest = { version: 1, notes: [] };
          (_a2 = this.onUnlockChange) == null ? void 0 : _a2.call(this, false);
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
          const emit2 = (current, fresh) => {
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
            emit2(n.title, fresh);
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
            emit2("孤儿密文文件", fresh);
          }
          const integrityChecked = !!(this.unlocked && this.password);
          if (integrityChecked) {
            const password = this.password;
            for (const n of this.manifest.notes) {
              if (items.some((i) => i.cat === "dead-entry" && i.noteId === n.id)) {
                emit2(n.title + "（失效，跳过校验）", []);
                continue;
              }
              if (!n.contentRef) {
                emit2(n.title, []);
                continue;
              }
              const fresh = [];
              try {
                const cipher = await this.readMirror(n.contentRef);
                if (cipher !== null) await CryptoService.decrypt(cipher, password);
              } catch (e) {
                fresh.push({ cat: "corrupted-body", key: "body:" + n.id, label: n.title, noteId: n.id, ref: n.contentRef });
              }
              emit2(n.title, fresh);
            }
            for (const n of this.manifest.notes) {
              for (const a of n.attachments) {
                if (!a.blobRef) {
                  emit2(a.path, []);
                  continue;
                }
                const key = "att:" + n.id + ":" + a.path;
                const fresh = [];
                try {
                  const cipher = await this.readMirror(a.blobRef);
                  if (cipher === null) {
                    fresh.push({ cat: "missing-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                  } else {
                    const plain = await CryptoService.decrypt(cipher, password);
                    const fp = await fingerprintOf(plain);
                    if (fp !== a.fingerprint) {
                      fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                    }
                  }
                } catch (e) {
                  fresh.push({ cat: "corrupted-attachment", key, label: a.path, noteId: n.id, ref: a.blobRef });
                }
                emit2(a.path, fresh);
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
                notes += 1;
              } else {
                kept.push(n);
              }
            }
            if (notes > 0) this.manifest.notes = kept;
            for (const key of keys) {
              if (!key.startsWith("file:")) continue;
              const name = key.slice("file:".length);
              if (!isOrphanEncName(name)) continue;
              try {
                if (await this.adapter.exists(this.resolveRef(name))) {
                  await this.adapter.remove(this.resolveRef(name));
                  files += 1;
                }
              } catch (e) {
              }
            }
            if (notes > 0) await this.saveManifest();
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
          const password = this.password;
          const total = input.attachments.length + 1;
          let done = 0;
          const attachments = [];
          const finalRefs = [];
          const stagedRefs = [];
          let note = null;
          let manifestSaved = false;
          const skippedStale = [];
          try {
            const results = await mapLimit(input.attachments, BLOB_CONCURRENCY, async (a) => {
              const fp = await fingerprintOf(a.data);
              const enc = await CryptoService.encrypt(a.data, password);
              const blobRef = flatName();
              await this.writeStaged(blobRef, enc);
              stagedRefs.push(blobRef);
              finalRefs.push(blobRef);
              let hasPreview = false;
              let previewRef = "";
              if (a.previewData) {
                const encP = await CryptoService.encrypt(a.previewData, password);
                previewRef = flatName();
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
            const bodyCipher = await CryptoService.encrypt(input.content, this.password);
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
          var _a2, _b2;
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
              (_b2 = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b2.call(_a2, "changed", file);
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
          return CryptoService.decrypt(cipher, this.password);
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
          var _a2;
          const app = getApp();
          if (!datePath || !block) return false;
          const md = block.replace(/\r\n/g, "\n");
          const lines = md.split("\n");
          const head = parseDiaryBlockHeader((_a2 = lines[0]) != null ? _a2 : "");
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
            var _a3, _b2, _c, _d;
            const serialized = serializeDiaryEntryFile({ date, time }, tags, body);
            const existing = app.vault.getAbstractFileByPath(targetPath);
            if (existing && existing.isFolder !== true) {
              const text2 = await app.vault.read(existing);
              if (text2.replace(/\n$/, "") === serialized.replace(/\n$/, "")) return;
              let seq = 2;
              let alt = diaryEntryPath(dir, date, time, seq);
              while (app.vault.getAbstractFileByPath(alt)) {
                seq += 1;
                alt = diaryEntryPath(dir, date, time, seq);
              }
              const shifted = await app.vault.create(alt, serialized);
              (_b2 = (_a3 = app.metadataCache) == null ? void 0 : _a3.trigger) == null ? void 0 : _b2.call(_a3, "changed", shifted);
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
          const password = this.password;
          if (!password) return null;
          const cipher = await this.readMirror(a.blobRef);
          if (cipher === null) return null;
          let plainB64;
          try {
            plainB64 = await CryptoService.decrypt(cipher, password);
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
          var _a2, _b2;
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
          (_b2 = (_a2 = app.metadataCache) == null ? void 0 : _a2.trigger) == null ? void 0 : _b2.call(_a2, "changed", file);
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
            if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存");
            const note = this.manifest.notes.find((n) => n.id === noteId);
            if (!note) throw new Error("未找到清单条目");
            const encrypted = await CryptoService.encrypt(plainContent, this.password);
            if (note.contentRef) {
              await this.replaceMirrorAtomic(note.contentRef, encrypted);
              emitDomainEvent(ENCRYPT_CHANGED_CHANNEL, { noteId });
            } else {
              const ref = flatName();
              await this.replaceMirrorAtomic(ref, encrypted);
              note.contentRef = ref;
              await this.saveManifest();
            }
          });
        }
        /** 解附件预览层 → dataUrl 明文（预览窗用；无预览层返回 null） */
        async decryptPreview(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          if (!a.hasPreview) return null;
          const cipher = await this.readMirror(a.previewRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, this.password);
        }
        /**
         * 解附件原始层 → 原始 base64（预览窗缩略图点击按需加载原图/视频用）。
         * 与预览层不同：走 blobRef 解原质量密文；无密文返回 null，解密失败向上抛（调用方兜底）。
         */
        async decryptAttachmentOriginal(a) {
          if (!this.unlocked || !this.password) throw new Error("未解锁");
          const cipher = await this.readMirror(a.blobRef);
          if (!cipher) return null;
          return CryptoService.decrypt(cipher, this.password);
        }
      };
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
  var ESC_MAP;
  var init_str = __esm({
    "src/core/ui/str.ts"() {
      ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    }
  });

  // src/core/utils.ts
  function escapeHtml2(str2) {
    return str2.replace(/[&<>"']/g, (m) => {
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
  function copySensitiveText(text2) {
    try {
      return navigator.clipboard.writeText(text2).then(() => armClipboardClear());
    } catch (e) {
      return Promise.reject(e);
    }
  }
  async function copySensitiveWithFallback(text2) {
    try {
      await copySensitiveText(text2);
      return true;
    } catch (e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text2;
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

  // src/core/flow-dialog.ts
  function buildFlowDialogParts(title, message, actions) {
    var _a2;
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
    const dangerPrimary = !!((_a2 = actions[primaryIdx]) == null ? void 0 : _a2.danger);
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

  // src/core/dom.ts
  function longPress(el2, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M3 = 10;
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
      if (Math.abs(t.clientX - sx) > M3 || Math.abs(t.clientY - sy) > M3) {
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
    el2.addEventListener("mousedown", start);
    el2.addEventListener("mouseup", endFromMouse);
    el2.addEventListener("mouseleave", endFromMouse);
    el2.addEventListener("touchstart", start, { passive: true });
    el2.addEventListener("touchend", endFromTouch);
    el2.addEventListener("touchmove", move, { passive: true });
    el2.addEventListener("touchcancel", endFromTouch);
    el2.addEventListener("click", onClick, true);
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

  // src/core/item-actions.ts
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  function registerSheetCompanion(el2) {
    sheetCompanions.add(el2);
  }
  function unregisterSheetCompanion(el2) {
    sheetCompanions.delete(el2);
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
    root.querySelectorAll("[data-lucide]").forEach((el2) => {
      const name = el2.getAttribute("data-lucide") || "";
      if (!name) return;
      try {
        const fresh = uiIconSpan(name);
        const cls = el2.className;
        if (cls && cls !== "bz-ic") fresh.className = cls;
        el2.replaceWith(fresh);
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
    var _a2;
    const variant = (_a2 = opts.variant) != null ? _a2 : "chips";
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
      const text2 = document.createElement("div");
      text2.className = "bz-setlist-text";
      const name = document.createElement("div");
      name.className = "bz-setlist-name";
      name.textContent = it.label;
      text2.appendChild(name);
      if (it.sub) {
        const sub = document.createElement("div");
        sub.className = "bz-setlist-sub";
        sub.textContent = it.sub;
        text2.appendChild(sub);
      }
      item.appendChild(text2);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "bz-setlist-remove bz-touch-target--xl";
      remove.textContent = opts.removeLabel || "移除";
      if (opts.onRemove) {
        const key = it.key;
        remove.addEventListener("click", () => {
          var _a3;
          return (_a3 = opts.onRemove) == null ? void 0 : _a3.call(opts, key);
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
    const el2 = document.createElement("div");
    el2.className = "bz-empty";
    if (opts.icon) {
      const ic = uiIcon(opts.icon);
      ic.classList.add("bz-empty-ic");
      el2.appendChild(ic);
    }
    const t = document.createElement("div");
    t.className = "bz-empty-title";
    t.textContent = opts.title;
    el2.appendChild(t);
    if (opts.desc) {
      const d = document.createElement("div");
      d.className = "bz-empty-desc";
      d.textContent = opts.desc;
      el2.appendChild(d);
    }
    if (opts.actions) el2.appendChild(opts.actions);
    return el2;
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
    const el2 = document.createElement("div");
    el2.className = "bz-cardpick" + (opts.className ? " " + opts.className : "");
    el2.setAttribute("role", "radiogroup");
    if (opts.label) el2.setAttribute("aria-label", opts.label);
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
      el2.appendChild(card);
    });
    el2.addEventListener("keydown", (e) => {
      var _a2;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const list = opts.options.map((o) => o.value);
      const idx = list.indexOf(cur);
      const next = e.key === "ArrowRight" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
      (_a2 = btns.get(list[next])) == null ? void 0 : _a2.focus();
      e.preventDefault();
    });
    return { el: el2, setValue: sync };
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
    const el2 = document.createElement("div");
    const cls = ["bz-progress"];
    if (opts.thin) cls.push("bz-progress--thin");
    if (opts.tone) cls.push(`bz-progress--${opts.tone}`);
    el2.className = cls.join(" ");
    const fill = document.createElement("i");
    el2.appendChild(fill);
    const setValue = (n) => {
      const v = Math.min(100, Math.max(0, Number(n) || 0));
      fill.style.width = v + "%";
    };
    if (opts.value !== void 0) setValue(opts.value);
    return { el: el2, setValue };
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
  function bodyNodes(text2) {
    const out = [];
    for (const raw of String(text2 != null ? text2 : "").split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const isItem = line.startsWith("- ");
      const el2 = document.createElement("div");
      el2.className = isItem ? "bz-help-li" : "bz-help-p";
      el2.textContent = isItem ? line.slice(2).trim() : line;
      out.push(el2);
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
  var init_modal = __esm({
    "src/core/ui/modal.ts"() {
      init_esc_manager();
      init_z_order();
      init_focus_trap();
    }
  });

  // src/core/ui/resize.ts
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
  function clearResetTimer(el2) {
    const prev = resetTimers.get(el2);
    if (prev !== void 0) {
      clearTimeout(prev);
      resetTimers.delete(el2);
    }
  }
  function setRowBtnState(el2, state2, label, failText) {
    if (!el2) return;
    el2.classList.remove("bz-rowbtn--busy", "bz-rowbtn--ok", "bz-rowbtn--fail");
    el2.disabled = state2 === "busy";
    if (state2 === "busy") {
      el2.classList.add("bz-rowbtn--busy");
      clearResetTimer(el2);
    } else if (state2 === "ok") {
      el2.classList.add("bz-rowbtn--ok");
      el2.textContent = ROW_BTN_OK_TEXT;
    } else if (state2 === "fail") {
      el2.classList.add("bz-rowbtn--fail");
      el2.textContent = (failText || "失败").slice(0, 6);
    } else {
      el2.textContent = label;
    }
  }
  function armRowBtnReset(el2, label) {
    if (!el2) return;
    const prev = resetTimers.get(el2);
    if (prev !== void 0) clearTimeout(prev);
    const t = setTimeout(() => {
      resetTimers.delete(el2);
      setRowBtnState(el2, "idle", label);
      el2.disabled = false;
    }, ROW_BTN_RESET_MS);
    resetTimers.set(el2, t);
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
    var _a2, _b2, _c, _d;
    const out = /* @__PURE__ */ new Set([""]);
    try {
      const files = ((_c = (_b2 = (_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getFiles) == null ? void 0 : _b2.call(_a2)) != null ? _c : []).map((f) => f.path);
      for (const p of foldersFromFiles(files)) out.add(p);
    } catch (e) {
    }
    const adapter = (_d = app == null ? void 0 : app.vault) == null ? void 0 : _d.adapter;
    if (adapter && typeof adapter.list === "function") {
      const walk = async (dir, depth) => {
        var _a3;
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
        for (const f of (_a3 = listed == null ? void 0 : listed.folders) != null ? _a3 : []) {
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
      const el2 = focusRestore;
      focusRestore = null;
      if (el2.isConnected) el2.focus();
    }
  }
  function openPathPicker(opts) {
    var _a2, _b2, _c;
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
    const state2 = { folders: [], q: "" };
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
      renderList2();
      updateSel();
    });
    const submit = () => {
      const list = normalizePicked([...selected]);
      closePathPicker();
      opts.onConfirm(list);
    };
    const newBtn = mkBtn("新建文件夹", false, () => {
      var _a3;
      const name = state2.q.trim().replace(/^\/+|\/+$/g, "");
      if (!name) return;
      const parent = (_a3 = [...selected][0]) != null ? _a3 : "";
      const full = parent ? `${parent}/${name}` : name;
      void (async () => {
        if (!state2.folders.includes(full)) {
          await app.vault.createFolder(full);
          if (!state2.folders.includes(full)) state2.folders.push(full);
        }
        if (mode === "single") selected.clear();
        selected.add(full);
        renderList2();
        updateSel();
      })().catch((e) => notifyActionError(e, `新建文件夹 ${full}`));
    });
    newBtn.disabled = !state2.q.trim();
    mkBtn(opts.okText || "下一步", true, submit);
    function orderedList() {
      const pinned = [];
      const rest = [];
      const pinSet = new Set(pinnedAtOpen);
      for (const f of state2.folders) {
        if (pinSet.has(f)) pinned.push(f);
        else rest.push(f);
      }
      const rootIdx = rest.indexOf("");
      const root = rootIdx >= 0 ? rest.splice(rootIdx, 1)[0] : null;
      rest.reverse();
      return [...pinned, ...root === null ? [] : [root], ...rest];
    }
    function renderList2() {
      listEl.innerHTML = "";
      const q = state2.q.trim().toLowerCase();
      const exact = !!q && state2.folders.includes(q);
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
          renderList2();
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
      state2.q = search.value;
      newBtn.disabled = !state2.q.trim();
      renderList2();
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
      const files = ((_c = (_b2 = (_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getFiles) == null ? void 0 : _b2.call(_a2)) != null ? _c : []).map((f) => f.path);
      state2.folders = foldersFromFiles(files);
    } catch (e) {
    }
    void collectVaultFolders(app).then((folders) => {
      if (!mask.isConnected) return;
      state2.folders = folders;
      popup.dataset.ready = "1";
      renderList2();
    });
    renderList2();
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
  function selectOptionsOf(options, snapshot2) {
    return typeof options === "function" ? options(snapshot2) : options;
  }
  function selectOptionsSignature(opts) {
    return opts.map((o) => o.value).join("");
  }
  function selectDisplayValue(read, opts) {
    var _a2, _b2, _c;
    const v = String((_a2 = read()) != null ? _a2 : "");
    return opts.some((o) => o.value === v) ? v : (_c = (_b2 = opts[0]) == null ? void 0 : _b2.value) != null ? _c : "";
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
  function safePersist(persist2, what) {
    try {
      Promise.resolve(persist2()).catch((e) => notifySaveError(e, what));
    } catch (e) {
      notifySaveError(e, what);
    }
  }
  function currentSnapshot() {
    return tryGetSettings();
  }
  function resolveNumberBound(bound, snapshot2) {
    if (bound === void 0) return void 0;
    if (typeof bound !== "function") return bound;
    const v = bound(snapshot2);
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
  function wireSecretEye(setting, el2) {
    let revealed = false;
    setting.addExtraButton((b) => {
      b.setIcon("eye").setTooltip("显示 / 隐藏");
      b.extraSettingsEl.setAttribute("aria-label", "显示密钥");
      b.extraSettingsEl.setAttribute("aria-pressed", "false");
      b.onClick(() => {
        revealed = !revealed;
        el2.type = revealed ? "text" : "password";
        b.setIcon(revealed ? "eye-off" : "eye");
        b.extraSettingsEl.setAttribute("aria-pressed", String(revealed));
        b.extraSettingsEl.setAttribute("aria-label", revealed ? "隐藏密钥" : "显示密钥");
      });
    });
  }
  function renderSettingsInto(container, schema) {
    var _a2;
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
      var _a3;
      const ctx = { rowEl: body, refreshVisibility: reevaluate };
      const setting = newRowSetting(body, row);
      const isNumber = row.type === "number";
      const acc = isNumber ? bindValue(row.binding) : bindValue(row.binding);
      const changeCb = row.onChange;
      const initial = String((_a3 = acc.read()) != null ? _a3 : "");
      let pending = null;
      let last = initial;
      let dirty = false;
      let raw = initial;
      const warn = new CommitWarn(initial, row.onCommit);
      let numError = false;
      const markNumberError = () => {
        var _a4, _b2;
        if (numError) return;
        numError = true;
        (_a4 = currentText == null ? void 0 : currentText.inputEl) == null ? void 0 : _a4.classList.add("bz-input--error");
        const base = row.desc ? `${row.desc}；` : "";
        setting.setDesc(`${base}需为数字，已保留原值 ${String((_b2 = acc.read()) != null ? _b2 : "")}`);
      };
      const clearNumberError = () => {
        var _a4, _b2;
        if (!numError) return;
        numError = false;
        (_a4 = currentText == null ? void 0 : currentText.inputEl) == null ? void 0 : _a4.classList.remove("bz-input--error");
        setting.setDesc((_b2 = row.desc) != null ? _b2 : "");
      };
      const commit = () => {
        var _a4;
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
            if (currentText) currentText.setValue(String((_a4 = acc.read()) != null ? _a4 : ""));
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
                var _a4;
                const el2 = b.buttonEl;
                try {
                  if (a.stateful) setRowBtnState(el2, "busy", a.text);
                  await a.onClick(last, ctx);
                  if (a.stateful) setRowBtnState(el2, "ok", a.text);
                } catch (e) {
                  if (a.stateful) setRowBtnState(el2, "fail", a.text, shortFailReason(e));
                  else throw e;
                } finally {
                  if (a.stateful) armRowBtnReset(el2, a.text);
                }
                if (currentText && currentText.setValue) {
                  dirty = false;
                  currentText.setValue(String((_a4 = acc.read()) != null ? _a4 : ""));
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
      var _a3, _b2, _c;
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
              var _a4;
              const v = multi ? list : (list[0] || "").trim().replace(/^\/+|\/+$/g, "");
              acc.write(v);
              safePersist(() => acc.persist(), row.name);
              let res;
              try {
                res = (_a4 = row.onChange) == null ? void 0 : _a4.call(row, list, ctx);
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
              var _a4;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
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
            value: String((_a3 = acc.read()) != null ? _a3 : "") || row.options[0].value,
            options: row.options,
            label: row.name,
            onChange: async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            }
          });
          setting.controlEl.appendChild(pick.el);
          return;
        }
        case "slider": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addSlider((sl) => {
            var _a4;
            sl.setLimits(row.min, row.max, (_a4 = row.step) != null ? _a4 : 1);
            sl.setValue(Number(acc.read()) || 0);
            sl.setDynamicTooltip();
            sl.onChange(async (v) => {
              var _a5;
              acc.write(v);
              reevaluate();
              try {
                await acc.persist();
              } catch (e) {
                notifySaveError(e, row.name);
              }
              (_a5 = row.onChange) == null ? void 0 : _a5.call(row, v, ctx);
            });
          });
          for (const a of (_b2 = row.actions) != null ? _b2 : []) {
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
            var _a4;
            (_a4 = wrap.querySelector(".bz-setlist")) == null ? void 0 : _a4.remove();
            wrap.appendChild(uiSetlist({
              items: readItems(),
              variant: row.variant,
              removeLabel: row.removeLabel,
              emptyText: row.emptyText,
              onRemove: (key) => {
                void (async () => {
                  var _a5;
                  const remaining = readItems().map((x) => x.key).filter((k) => k !== key);
                  try {
                    await ((_a5 = row.onChange) == null ? void 0 : _a5.call(row, remaining, ctx));
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
      var _a3, _b2;
      const firstToggleKey = (_b2 = (_a3 = rows.find((r) => r.type === "toggle" && "key" in r.binding)) == null ? void 0 : _a3.binding.key) != null ? _b2 : null;
      for (const row of rows) renderRow(body, row, firstToggleKey);
    };
    for (const group of schema.groups) {
      if (group.icon) {
        const body = createSettingsGroup(container, { icon: group.icon, name: group.name });
        const groupEl = (_a2 = body.parentElement) != null ? _a2 : container;
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
  function isItemHidden(el2) {
    let cur = el2;
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
      const n = [...body.querySelectorAll(".setting-item")].filter((el2) => {
        const h = el2;
        return !h.classList.contains("bz-setting-action-row") && !isItemHidden(h);
      }).length;
      countEl.textContent = `${n} 项`;
      countEl.style.display = n > 0 ? "" : "none";
    });
  }
  function markSettingSplitRows(container) {
    container.querySelectorAll(".setting-item").forEach((el2) => {
      if (el2.classList.contains("bz-path-picker-setting-row")) return;
      const ctl = el2.querySelector(".setting-item-control");
      el2.classList.toggle("bz-setting-split", !!ctl && ctl.children.length >= 2);
    });
  }
  function closeSettingsModal() {
    var _a2;
    if (currentModal) {
      const m = currentModal;
      currentModal = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement && m.popup.contains(active)) active.blur();
      m.dispose();
      (_a2 = m.onClose) == null ? void 0 : _a2.call(m);
    }
  }
  function openSettingsModal(opts) {
    var _a2;
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
    renderSettingsInto(content, (_a2 = opts.schema) != null ? _a2 : { groups: [] });
    const hasVisibleItem = Array.from(content.querySelectorAll(".setting-item")).some(
      (el2) => !el2.classList.contains("bz-setting-action-row") && !isItemHidden(el2)
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
    const firstFocusable2 = Array.from(popup.querySelectorAll(FOCUSABLE_SELECTOR2)).find((el2) => {
      if (isItemHidden(el2)) return false;
      if (isMobileEnv()) {
        const tag = el2.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    if (firstFocusable2) firstFocusable2.focus();
    const releaseFocusTrap = trapFocus(popup);
    const handle2 = escManager.register("bz-settings-modal", {
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
        handle2.unregister();
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
  var init_data2 = __esm({
    "src/password-vault/data.ts"() {
      init_domain_bus();
      init_data();
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
          var _a2;
          if (this.saving) return;
          if (!this.safe.unlocked) return;
          try {
            await this.load();
            (_a2 = this.onExternalChange) == null ? void 0 : _a2.call(this);
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
            var _a2, _b2;
            return (((_a2 = a.accounts[0]) == null ? void 0 : _a2.createdAt) || "").localeCompare(((_b2 = b.accounts[0]) == null ? void 0 : _b2.createdAt) || "") * -1;
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
          var _a2, _b2, _c;
          (_a2 = this.offChanged) == null ? void 0 : _a2.call(this);
          this.offChanged = null;
          (_b2 = this.offEncryptChanged) == null ? void 0 : _b2.call(this);
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
    const el2 = document.createElement("div");
    el2.className = `bz-lockscreen bz-lockscreen--${opts.kind}` + (opts.inline ? " bz-lockscreen--inline" : " bz-lockscreen--mask");
    el2.dataset.ls = opts.inline ? "box" : "mask";
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
    row.appendChild(input);
    row.appendChild(input2);
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
    if (!opts.inline) el2.style.display = "flex";
    el2.appendChild(box);
    const focus = () => {
      try {
        input.focus({ preventScroll: true });
      } catch (e) {
        input.focus();
      }
    };
    return {
      el: el2,
      input,
      input2,
      ackBox,
      actionBtn,
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
        if (busy) actionBtn.dataset.busyText = actionBtn.textContent || "";
        actionBtn.textContent = busy ? "处理中…" : actionBtn.dataset.busyText || opts.action;
      },
      showSecondInput: (show) => {
        input2.style.display = show ? "" : "none";
      },
      focus,
      close: () => {
        el2.remove();
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
  function motionWaapi(el2, frames, opts) {
    if (!el2 || motionReduced() || typeof el2.animate !== "function") {
      const last = frames[frames.length - 1];
      if (el2 && last) for (const k of Object.keys(last)) {
        if (k === "offset") continue;
        try {
          el2.style[k] = String(last[k]);
        } catch (e) {
        }
      }
      return null;
    }
    try {
      return el2.animate(frames, opts);
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
    const gone2 = () => {
      try {
        veil.remove();
      } catch (e) {
      }
    };
    if (anim) anim.finished.then(gone2).catch(gone2);
    motionShellAfter(dur + 150, gone2);
  }
  function motionVisible(el2) {
    return !!el2 && el2.offsetWidth > 0 && el2.offsetHeight > 0;
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
  function rise(el2, delay, dur = M.base, from = {}) {
    var _a2, _b2, _c;
    const y = (_a2 = from.y) != null ? _a2 : 8;
    const blur = (_b2 = from.blur) != null ? _b2 : 4;
    const scale = (_c = from.scale) != null ? _c : 1;
    motionAfter(delay, () => {
      motionWaapi(
        el2,
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
        items.forEach((el2, i) => rise(el2, 90 + i * 45, M.base, { y: 6 }));
        side.forEach((el2, i) => {
          if (el2) rise(el2, 240 + i * 60, M.base, { y: 6 });
        });
        const title = desk.querySelector("[data-vault-title]");
        if (title) rise(title, 60, M.base, { y: 5 });
        motionBootSweep(popup);
      }
      if (phase === "boot") rows.forEach((el2, i) => {
        if (i < 14) rise(el2, 300 + i * STAG, M.base, { y: 7 });
      });
      else if (phase === "switch") rows.forEach((el2, i) => {
        if (i < 12) rise(el2, i * 20, M.fast + 60, { y: 6, blur: 3 });
      });
      else if (phase === "search") rows.forEach((el2, i) => {
        if (i < 10) rise(el2, i * 14, M.fast + 40, { y: 4, blur: 2 });
      });
      if (detail) {
        if (phase === "boot" || phase === "switch") revealDetail(detail, phase === "boot" ? 220 : 40);
        else if (phase === "search") revealDetail(detail, 30, true);
        else rise(detail, 0, M.fast + 40, { y: 4, blur: 2 });
      }
    }
    if (motionVisible(mob) && mob) {
      const rows = [...mob.querySelectorAll("[data-mob-body] > .bz-vault-row")];
      if (phase === "boot") rows.forEach((el2, i) => {
        if (i < 12) rise(el2, 260 + i * STAG, M.base, { y: 7 });
      });
      else if (phase === "switch") rows.forEach((el2, i) => {
        if (i < 10) rise(el2, i * 20, M.fast + 60, { y: 6, blur: 3 });
      });
      else if (phase === "search") rows.forEach((el2, i) => {
        if (i < 8) rise(el2, i * 14, M.fast + 40, { y: 4, blur: 2 });
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
    blocks.forEach((b, i) => rise(b, base + i * (light ? 40 : 70), light ? M.fast + 60 : M.base, { y: light ? 4 : 7 }));
    const fields = [...detail.querySelectorAll(".bz-vault-dcontent .field, .bz-vault-dcontent .bigbtns")];
    fields.forEach((f, i) => rise(f, base + blocks.length * 60 + i * 55, M.base, { y: 5 }));
    const minis = [...detail.querySelectorAll(".bz-vault-minirow")];
    minis.forEach((m, i) => {
      if (i < 6) rise(m, base + 260 + i * 50, M.base, { y: 4, blur: 2 });
    });
  }
  function motionPanelIn(popup) {
    if (!popup || motionReduced()) return;
    const mask = document.getElementById("bz-encrypt-mask");
    if (mask) motionWaapi(mask, [{ opacity: 0 }, { opacity: 1 }], { duration: M.move, easing: E.out });
    const title = popup.querySelector("[data-vault-title]");
    if (title && motionVisible(popup)) {
      motionShellAfter(80, () => {
        motionWaapi(
          title,
          [
            { opacity: 0, transform: "translateY(5px)", filter: "blur(3px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" }
          ],
          { duration: M.base, easing: E.out, fill: "backwards" }
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
      { duration: M.move + 20, easing: E.out }
    );
    motionVeilGone(veil, anim, M.move + 20);
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
      const gone2 = () => {
        try {
          gate.remove();
        } catch (e) {
        }
      };
      if (out) out.finished.then(gone2).catch(gone2);
      motionShellAfter(320, gone2);
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
      { duration: M.impulse, easing: E.out }
    );
    motionVeilGone(sweep, anim, M.impulse);
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
      const el2 = lsEl.querySelector(sel);
      if (el2) {
        motionShellAfter(120 + i * 70, () => {
          motionWaapi(
            el2,
            [
              { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
              { opacity: 1, transform: "none", filter: "blur(0px)" }
            ],
            { duration: M.base, easing: E.out, fill: "backwards" }
          );
        });
      }
    });
    const stats = [...lsEl.querySelectorAll('[data-ls="stats"] .bz-lockscreen-stat')];
    stats.forEach((el2, i) => {
      motionShellAfter(200 + i * 60, () => {
        motionWaapi(
          el2,
          [
            { opacity: 0, transform: "translateY(6px)", filter: "blur(3px)" },
            { opacity: 1, transform: "none", filter: "blur(0px)" }
          ],
          { duration: M.base, easing: E.out, fill: "backwards" }
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
  function motionRevealBody(el2) {
    if (!el2 || motionReduced() || !motionVisible(el2)) return;
    motionWaapi(
      el2,
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
      { duration: M.base, easing: E.out, fill: "backwards" }
    );
    const secs = [...body.querySelectorAll(".bz-encrypt-health-section, .bz-encrypt-health-item, .bz-encrypt-health-hint")];
    secs.forEach((el2, i) => {
      if (i < 12) rise(el2, 90 + i * 35, M.base, { y: 4, blur: 2 });
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
      { duration: M.fast + 40, easing: E.out, fill: "backwards" }
    );
  }
  function motionStatusbarSpin(el2) {
    if (!el2 || motionReduced()) return;
    const ic = el2.querySelector(".bz-vault-ic");
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
  var M, E, STAG, timers, loops, intent;
  var init_motion = __esm({
    "src/encrypt/motion.ts"() {
      M = { fast: 160, move: 200, base: 280, impulse: 740 };
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
  var init_data3 = __esm({
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
      init_data3();
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
    var _a2, _b2, _c;
    const embedLinks = [];
    try {
      const cache = (_b2 = (_a2 = app == null ? void 0 : app.metadataCache) == null ? void 0 : _a2.getFileCache) == null ? void 0 : _b2.call(_a2, file);
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
    const shared2 = /* @__PURE__ */ new Set();
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
        if (hit) shared2.add(hit);
      }
    }
    return [...shared2];
  }
  function collectSharedAttachmentPaths(app, notePath, attPaths) {
    var _a2, _b2, _c;
    if (!attPaths.length) return [];
    let mds = [];
    try {
      mds = ((_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getMarkdownFiles) && app.vault.getMarkdownFiles() || [];
    } catch (e) {
      return [];
    }
    const others = [];
    for (const f of mds) {
      const links = [];
      try {
        const cache = (_c = (_b2 = app == null ? void 0 : app.metadataCache) == null ? void 0 : _b2.getFileCache) == null ? void 0 : _c.call(_b2, f);
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
    var _a2;
    const ext = ((_a2 = path.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) || "";
    return /^(mp4|webm|mov|mkv|avi|m4v|ogv)$/.test(ext) ? "video" : "image";
  }
  function mimeOf(path) {
    var _a2;
    const ext = ((_a2 = path.split(".").pop()) == null ? void 0 : _a2.toLowerCase()) || "";
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
  var LOCK_KIND_META, lastVisitedAsset, activeUnlock, _UIManager, UIManager, _EncryptAppController, EncryptAppController;
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
      init_settings_provider();
      init_settings_modal();
      init_settings_common();
      init_data();
      init_domain_bus();
      init_preview();
      init_data2();
      init_vault_assets_view();
      init_lock_screen();
      init_lock_stats();
      init_motion();
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
        }
      };
      lastVisitedAsset = "note";
      activeUnlock = null;
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
          /** 上次渲染的资产：资产未变时保留列表头（连同搜索框），避免搜索输入被重建而掉焦点 */
          this._lastRenderedAsset = null;
          /** 空闲计时 bump（document 捕获阶段；见 bindVaultShell 尾部） */
          this._idleBump = null;
          /** encrypt:unlock-changed 订阅句柄（ensureElements 挂 / detachGlobalListeners 摘） */
          this._unlockOff = null;
          /** 体检进行中旗标（T9 重入守卫：扫描中「重新体检」/清理后自动复扫不再并发双扫） */
          this._scanning = false;
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
          var _a2, _b2;
          return (_b2 = (_a2 = this.popup) == null ? void 0 : _a2.querySelector("[data-vault-search]")) != null ? _b2 : null;
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
          var _a2, _b2, _c;
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
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el2) => {
            el2.addEventListener("click", () => setAsset(el2.getAttribute("data-asset") || "overview"));
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el2) => {
            el2.addEventListener("click", () => setAsset(el2.getAttribute("data-masset") || "overview"));
          });
          (_a2 = this.popup.querySelector('[data-act="lock"]')) == null ? void 0 : _a2.addEventListener("click", () => this.lockNow());
          (_b2 = this.popup.querySelector('[data-act="mob-close"]')) == null ? void 0 : _b2.addEventListener("click", () => this.hide());
          this.popup.addEventListener("contextmenu", (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.closest(".bz-vault-row, .bz-pwv-plrow, .bz-pwv-acctcard, .bz-pwv-mobcard, .bz-item-menu, input, textarea, button")) return;
            e.preventDefault();
            this.openPanelMenu(e.clientX, e.clientY);
          });
          (_c = this.popup.querySelector('[data-act="health-card"]')) == null ? void 0 : _c.addEventListener("click", () => void this.openHealthDialog());
          this.popup.addEventListener("keydown", (e) => {
            var _a3, _b3;
            if (e.key !== "Enter" && e.key !== " ") return;
            if (e.isComposing || e.defaultPrevented) return;
            const t = e.target;
            const btn = (_a3 = t == null ? void 0 : t.closest) == null ? void 0 : _a3.call(t, '[role="button"]');
            if (!btn || !this.popup.contains(btn)) return;
            e.preventDefault();
            btn.click();
            if (btn.classList.contains("bz-vault-row")) {
              (_b3 = this.popup.querySelector(".bz-vault-row.on")) == null ? void 0 : _b3.focus();
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
          var _a2, _b2;
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
          (_b2 = (_a2 = input.parentElement) == null ? void 0 : _a2.querySelector("[data-search-clear]")) == null ? void 0 : _b2.addEventListener("click", () => {
            this.clearSearchKw();
            input.focus();
          });
        }
        /** ✕ 显隐同步（有词才显示；两框词互同步后一起刷，clipbook syncDeskSearchClear 同款） */
        syncSearchClear() {
          var _a2, _b2;
          const v = !!this.searchKw || !!this.mob.search.value.trim() || !!((_a2 = this.deskSearch) == null ? void 0 : _a2.value.trim());
          for (const box of [(_b2 = this.deskSearch) == null ? void 0 : _b2.parentElement, this.mob.search.parentElement]) {
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
          motionArmBoot();
          motionPanelIn(this.popup);
          trapPanelFocus(this.popup);
          this.notifyUnlockUi();
          void this.renderList();
          this.startSessionTimers();
        }
        hide(suppressAutoLockNotice = false) {
          this.closePreview();
          this.closeAllDialogs();
          if (this.popup && this.popup.style.display === "flex") motionPanelCollapse(this.popup);
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
          var _a2;
          return !!this.config.securityMode || !!((_a2 = tryGetSettings()) == null ? void 0 : _a2.securityMode);
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
          var _a2;
          const el2 = (_a2 = this.popup) == null ? void 0 : _a2.querySelector("[data-unlock-dur]");
          if (!el2) return;
          if (!this.dataManager.unlocked || this.unlockedAt === null) {
            el2.textContent = "";
            return;
          }
          const s = Math.max(0, Math.floor((Date.now() - this.unlockedAt) / 1e3));
          const mm = String(Math.floor(s / 60) % 60).padStart(2, "0");
          const ss = String(s % 60).padStart(2, "0");
          const h = Math.floor(s / 3600);
          el2.textContent = h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
          el2.title = "已解锁时长";
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
            { icon: "stethoscope", label: "保险库体检", onClick: () => void this.openHealthDialog() }
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
            hint: exists ? "" : "建议使用密码本保存此密码"
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
         * 快照解锁屏统计项（三域各一份）。
         * 清单本身是密文，锁定态无法读计数 —— 故只在解锁期间快照，供下次上锁后的解锁屏显示；
         * 快照同时写明文档 lock-stats.json（core/lock-stats），冷启动回落上次快照而非「—」。
         */
        captureLockStats() {
          var _a2;
          try {
            const all = ((_a2 = this.dataManager.manifest) == null ? void 0 : _a2.notes) || [];
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
            const plats = this.pwDataManager.platforms();
            this.lockStatsCache["password-vault"] = [
              { num: String(plats.length), label: "平台" },
              { num: String(this.pwDataManager.pwData.length), label: "口令条目" },
              { num: String(plats.filter((p) => this.pwDataManager.hasFav(p.platform)).length), label: "收藏" }
            ];
            for (const k of ["vault", "diary", "password-vault"]) {
              void writeLockStats(k, this.lockStatsCache[k]).catch(() => {
              });
            }
          } catch (e) {
          }
        }
        renderNav() {
          const c = this.counts();
          const setCnt = (a, v) => {
            const el2 = this.popup.querySelector(`[data-cnt="${a}"]`);
            if (el2) el2.textContent = String(v);
          };
          setCnt("overview", c.note + c.diary);
          setCnt("note", c.note);
          setCnt("diary", c.diary);
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el2) => {
            const on = el2.getAttribute("data-asset") === this.asset;
            el2.classList.toggle("on", on);
            el2.setAttribute("aria-current", on ? "true" : "false");
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el2) => {
            const on = el2.getAttribute("data-masset") === this.asset;
            el2.classList.toggle("on", on);
            el2.setAttribute("aria-current", on ? "true" : "false");
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
          var _a2;
          (_a2 = this.popup.querySelector(".bz-vault-pane")) == null ? void 0 : _a2.classList.toggle("is-overview", on);
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
          var _a2, _b2;
          mountIcons(area);
          area.querySelectorAll(".card[data-nav]").forEach(
            (el2) => el2.addEventListener("click", () => this.setAssetFromNav(el2.getAttribute("data-nav")))
          );
          (_a2 = area.querySelector('[data-hero="lock-note"]')) == null ? void 0 : _a2.addEventListener("click", () => {
            var _a3;
            return (_a3 = this.onLockCurrentNote) == null ? void 0 : _a3.call(this);
          });
          area.querySelectorAll('[data-hero="health"]').forEach(
            (el2) => el2.addEventListener("click", () => void this.openHealthDialog())
          );
          (_b2 = area.querySelector('[data-hero="recent-all"]')) == null ? void 0 : _b2.addEventListener("click", () => this.setAssetFromNav("note"));
          area.querySelectorAll(".bz-vault-minirow[data-recent]").forEach(
            (el2) => el2.addEventListener("click", () => {
              const rid = el2.getAttribute("data-recent-id");
              if (rid) this._selNoteId = rid;
              this.setAssetFromNav(el2.getAttribute("data-recent"));
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
            const el2 = row.firstElementChild;
            el2.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.renderDesktop();
            });
            el2.addEventListener("dblclick", () => {
              if (this.previewMask) registerSheetCompanion(this.previewMask);
              void this.openPreview(n);
            });
            this.attachNoteDrawer(el2, n, kind);
            listBody.appendChild(el2);
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
            var _a2;
            (_a2 = detail.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a2.addEventListener("click", (e) => {
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
        attachNoteDrawer(el2, note, kind) {
          const { actions, opts } = this.noteDrawerActions(note, kind);
          attachItemActions(el2, actions, opts);
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
          var _a2;
          if (activeUnlock && ((_a2 = activeUnlock.el) == null ? void 0 : _a2.isConnected)) activeUnlock.cancel();
          document.querySelectorAll("body > .bz-vault-dlg-mask").forEach((el2) => el2.remove());
          document.querySelectorAll("body > .bz-lockscreen--mask").forEach((el2) => {
            if (el2.classList.contains("bz-lockscreen--password-vault") || el2.classList.contains("bz-lockscreen--diary")) return;
            el2.remove();
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
            (el2) => el2.classList.toggle("on", el2.getAttribute("data-asset") === a)
          );
          this.mob.seg.querySelectorAll(".sg").forEach(
            (el2) => el2.classList.toggle("on", el2.getAttribute("data-masset") === a)
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
          var _a2;
          if (!this._initialized || !((_a2 = this.popup) == null ? void 0 : _a2.isConnected)) return;
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
          const st2 = this.popup.querySelector("[data-mob-unlock]");
          if (st2) st2.textContent = this.dataManager.unlocked ? "已解锁" : "已锁定";
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
            const el2 = row.firstElementChild;
            el2.addEventListener("click", () => {
              this._selNoteId = n.id;
              this.openNoteMobPage(n, kind);
            });
            this.attachNoteDrawer(el2, n, kind);
            body.appendChild(el2);
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
          var _a2, _b2;
          const { page, body } = this.createMobPage(kind === "note" ? "笔记" : "加密日记");
          body.innerHTML = noteDetailHTML(note, kind);
          mountIcons(body);
          const bind = (a, fn) => {
            var _a3;
            (_a3 = body.querySelector(`[data-detail="${a}"]`)) == null ? void 0 : _a3.addEventListener("click", (e) => {
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
          (_a2 = page.querySelector("[data-mob-back]")) == null ? void 0 : _a2.addEventListener("click", () => page.remove());
          (_b2 = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b2.addEventListener("click", () => {
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
          var _a2, _b2;
          const app = getApp();
          try {
            const file = app.vault.getAbstractFileByPath(note.path);
            if (file && file.isFolder !== true) {
              (_b2 = (_a2 = app.workspace).openLinkText) == null ? void 0 : _b2.call(_a2, note.path, note.path);
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
              const { text: text2, slots, inlined: inl } = collectMediaSlots(plain, note.attachments);
              inlined = inl;
              const { ok: rendered, el: mdEl } = await this.renderWithTimeout(getApp(), text2, note.path);
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
         * 渲染带超时：3000ms 内不完成视为失败（防真实环境 render 挂起导致弹窗永久空白/不可关）。
         * E9：render 渲入私有容器——超时弃用该容器（迟到 promise 追加进孤儿节点永不入 DOM），
         * 返回全新容器给调用方走纯文本兜底，正文不再「纯文本 + 迟到渲染」叠双份。
         * T13：返回渲染 Component，调用链在关窗/下一次填充前 unload 收掉生命周期。
         */
        async renderWithTimeout(app, text2, path, timeoutMs = 3e3) {
          this.unloadPreviewComponent();
          const el2 = document.createElement("div");
          const component = new Component();
          this._previewComponent = component;
          let finished = false;
          const render = MarkdownRenderer.render(app, text2, el2, path, component).then(
            () => {
              finished = true;
            },
            () => {
              finished = true;
            }
          );
          await Promise.race([render, new Promise((r) => setTimeout(r, timeoutMs))]);
          if (!finished) return { ok: false, el: document.createElement("div"), component };
          return { ok: true, el: el2, component };
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
        attachStatusBar(el2) {
          this.statusBarEl = el2;
          this.dataManager.onUnlockChange = (unlocked) => {
            var _a2, _b2;
            if (this.statusBarEl) {
              this.statusBarEl.innerHTML = statusbarHtml(unlocked);
              mountIcons(this.statusBarEl);
              motionStatusbarSpin(this.statusBarEl);
            }
            (_b2 = (_a2 = this.uiManager).notifyUnlockUi) == null ? void 0 : _b2.call(_a2);
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
          var _a2, _b2;
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
                  const resourceUrl = ((_b2 = (_a2 = app.vault).getResourcePath) == null ? void 0 : _b2.call(_a2, f)) || "";
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
          const ids = ["bz-encrypt-mask", "bz-encrypt-popup", "bz-encrypt-preview-mask", "bz-encrypt-preview-popup", "bz-encrypt-health-mask", "bz-encrypt-health-popup"];
          for (const id of ids) {
            const el2 = document.getElementById(id);
            if (el2) el2.remove();
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
    const el2 = document.createElement("span");
    el2.className = "bz-encrypt-statusbar";
    el2.title = "保险库：点击打开";
    el2.innerHTML = statusbarHtml(false);
    mountIcons(el2);
    el2.addEventListener("click", () => openEncrypt(getApp()));
    container.appendChild(el2);
    statusBarEl = el2;
    void ensureEncrypt(getApp()).then(() => getController().attachStatusBar(el2)).catch(() => {
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
  async function ensureSafeUnlocked(kind = "vault") {
    const controller2 = getController();
    if (controller2.dataManager.unlocked) return true;
    const ok = await controller2.uiManager.showPasswordDialog(kind);
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

  // prototypes/people/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootPeopleSim: () => bootPeopleSim,
    demoOpenDataSource: () => demoOpenDataSource,
    demoReset: () => demoReset,
    openPanel: () => openPanel,
    togglePanel: () => togglePanel
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();

  // src/people/media.ts
  function parseMediaTag(msg) {
    let s = String(msg != null ? msg : "").trim();
    const stripped = s.replace(/^\[(?!(?:语音|图片|视频|通话|文件|分享|引用|表情|链接|撤回|小程序))[^[\]]{1,16}\]\s*/, "");
    if (stripped !== s && /^\[(语音|图片)\s*([^\]]*)\]/.test(stripped)) s = stripped;
    const m = /^\[(语音|图片)\s*([^\]]*)\]\s*([\s\S]+)$/.exec(s);
    if (!m) return null;
    const body = m[3].trim();
    if (!body) return null;
    const kind = m[1] === "语音" ? "voice" : "image";
    const out = { kind, text: body };
    if (kind === "voice") {
      let durationSec;
      const emos = [];
      for (const part of m[2].split("·")) {
        const t = part.trim();
        if (!t) continue;
        const dm = /^(\d+(?:\.\d+)?)(?:s|秒)$/i.exec(t);
        if (dm) {
          if (durationSec === void 0) durationSec = Number(dm[1]);
        } else {
          emos.push(t);
        }
      }
      if (durationSec !== void 0) out.durationSec = durationSec;
      const emotion = emos.join("·").trim();
      if (emotion) out.emotion = emotion;
    }
    return out;
  }
  function emptyMediaStats() {
    return { voiceCount: 0, voiceTotalSec: 0, imageCount: 0 };
  }
  function collectMediaStats(messages) {
    var _a2;
    const out = emptyMediaStats();
    for (const m of messages) {
      const mat = parseMediaTag((_a2 = m == null ? void 0 : m.text) != null ? _a2 : "");
      if (!mat) continue;
      if (mat.kind === "voice") {
        out.voiceCount++;
        if (mat.durationSec !== void 0 && Number.isFinite(mat.durationSec)) out.voiceTotalSec += mat.durationSec;
      } else {
        out.imageCount++;
      }
    }
    return out;
  }
  function formatDuration(sec) {
    const s = Math.max(0, Math.round(sec || 0));
    if (s < 60) return `${s} 秒`;
    if (s < 3600) return `${Math.round(s / 60)} 分`;
    return `${Math.round(s / 3600)} 时`;
  }
  function formatMediaCount(s) {
    const parts = [];
    if (s.voiceCount > 0) {
      parts.push(`语音 ${s.voiceCount} 条`);
      if (s.voiceTotalSec > 0) parts.push(formatDuration(s.voiceTotalSec));
    }
    if (s.imageCount > 0) parts.push(`图片 ${s.imageCount} 张`);
    return parts.join(" · ");
  }
  function buildMediaNote(s) {
    const count = formatMediaCount(s);
    if (!count) return "";
    const emo = s.voiceCount > 0 ? "；语音行内「·」后的标记是语音情感识别结果（如平静、开心），可作情绪判断的参考" : "";
    return `聊天里还有${count}的媒体素材——语音已转写成文字并入对话（引用原话时只写转写文本，不带标签），图片以画面描述入列${emo}。`;
  }

  // src/people/ui.ts
  init_notice();
  init_z_order();
  init_esc_manager();
  init_focus_trap();
  init_app();
  init_domain_bus();
  init_data();
  init_encrypt();

  // src/people/safe-store.ts
  init_domain_bus();
  init_data();
  var PEOPLE_KIND = "people";
  var PEOPLE_NOTE_PATH_PREFIX = "CONFIG/STORAGE/people/";
  function peopleNotePath(talker) {
    return PEOPLE_NOTE_PATH_PREFIX + talker;
  }
  function talkerOfPath(path) {
    if (!path || !path.startsWith(PEOPLE_NOTE_PATH_PREFIX)) return null;
    const talker = path.slice(PEOPLE_NOTE_PATH_PREFIX.length);
    return talker || null;
  }
  function emptyStoreContact(nowIso2 = (/* @__PURE__ */ new Date()).toISOString()) {
    return { msgs: [], watermarkSid: 0, stats: { msgCount: 0, voiceCount: 0, voiceTotalSec: 0, imageCount: 0 }, updatedAt: nowIso2 };
  }
  function emptyPersonEntry(id, name, nowIso2) {
    return { id, name, createdAt: nowIso2, imports: [] };
  }
  function normalizeRecord(talker, parsed) {
    var _a2, _b2, _c, _d, _e;
    const raw = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const personRaw = raw.person && typeof raw.person === "object" ? raw.person : {};
    const person = {
      ...personRaw,
      id: String((_a2 = personRaw.id) != null ? _a2 : talker),
      name: String((_b2 = personRaw.name) != null ? _b2 : talker),
      createdAt: String((_c = personRaw.createdAt) != null ? _c : (/* @__PURE__ */ new Date()).toISOString()),
      imports: Array.isArray(personRaw.imports) ? personRaw.imports : []
    };
    const storeRaw = raw.store && typeof raw.store === "object" ? raw.store : {};
    const store2 = {
      ...storeRaw,
      msgs: Array.isArray(storeRaw.msgs) ? storeRaw.msgs : [],
      watermarkSid: Number((_d = storeRaw.watermarkSid) != null ? _d : 0) || 0,
      stats: storeRaw.stats && typeof storeRaw.stats === "object" ? storeRaw.stats : emptyStoreContact().stats,
      updatedAt: String((_e = storeRaw.updatedAt) != null ? _e : "")
    };
    const job = raw.job && typeof raw.job === "object" ? raw.job : null;
    return { version: 1, person, store: store2, job };
  }
  var PeopleSafeStore = class {
    constructor(safe) {
      /** 解密记录缓存（明文）；上锁 / 外部清单变更即清 */
      this.cache = /* @__PURE__ */ new Map();
      /** 头像 data URL 缓存；同上 */
      this.avatarUrls = /* @__PURE__ */ new Map();
      /** per-talker 写串行链（读→改→写整体入队，防并发互吞） */
      this.chains = /* @__PURE__ */ new Map();
      this.offUnlock = null;
      this.offChanged = null;
      this.safe = safe;
      this.offUnlock = onDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
        if ((evt == null ? void 0 : evt.unlocked) !== false) return;
        this.clearPlainCaches();
      });
      this.offChanged = onDomainEvent(ENCRYPT_CHANGED_CHANNEL, () => {
        this.clearPlainCaches();
      });
    }
    /** 底层 SafeManager（解锁态判定 / 测试断言用） */
    get safeManager() {
      return this.safe;
    }
    /** 解锁态 = 共锁保险库的解锁态 */
    get unlocked() {
      return this.safe.unlocked;
    }
    /** 清明文缓存（记录 + 头像 data URL）；上锁事件与外部变更订阅共用同一收口 */
    clearPlainCaches() {
      this.cache.clear();
      this.avatarUrls.clear();
    }
    /** 退订域事件（测试隔离 / 卸载清理用） */
    destroy() {
      var _a2, _b2;
      (_a2 = this.offUnlock) == null ? void 0 : _a2.call(this);
      this.offUnlock = null;
      (_b2 = this.offChanged) == null ? void 0 : _b2.call(this);
      this.offChanged = null;
    }
    noteOf(talker) {
      return this.safe.manifest.notes.find((n) => n.kind === PEOPLE_KIND && n.path === peopleNotePath(talker)) || null;
    }
    requireUnlocked() {
      if (!this.safe.unlocked) throw new Error("保险库未解锁，脸谱数据不可读");
    }
    /** 全部联系人 talker（清单级定位，不解密正文；未解锁抛错——索引也不可读） */
    talkers() {
      this.requireUnlocked();
      const out = [];
      for (const n of this.safe.manifest.notes) {
        if (n.kind !== PEOPLE_KIND) continue;
        const t = talkerOfPath(n.path);
        if (t) out.push(t);
      }
      return out.sort((a, b) => a.localeCompare(b, "zh"));
    }
    /** 是否已有该联系人的保库记录（迁移幂等键；不解密正文） */
    has(talker) {
      this.requireUnlocked();
      return this.noteOf(talker) !== null;
    }
    /** 该人记录的附件数（头像存在性校验用；不解密） */
    attachmentCount(talker) {
      var _a2, _b2, _c;
      this.requireUnlocked();
      return (_c = (_b2 = (_a2 = this.noteOf(talker)) == null ? void 0 : _a2.attachments) == null ? void 0 : _b2.length) != null ? _c : 0;
    }
    /** 读一位联系人的保库记录（缓存优先；无记录返回 null） */
    async read(talker) {
      this.requireUnlocked();
      const hit = this.cache.get(talker);
      if (hit) return hit;
      const note = this.noteOf(talker);
      if (!note) return null;
      const plain = await this.safe.decryptNoteBody(note);
      if (plain === null) throw new Error("保库记录解密失败");
      let parsed;
      try {
        parsed = JSON.parse(plain);
      } catch (e) {
        throw new Error("保库记录损坏（解密成功但解析失败）");
      }
      const rec = normalizeRecord(talker, parsed);
      this.cache.set(talker, rec);
      return rec;
    }
    /** 读全部联系人记录（面板墙一次拉全量） */
    async readAll() {
      const out = /* @__PURE__ */ new Map();
      for (const t of this.talkers()) {
        const rec = await this.read(t);
        if (rec) out.set(t, rec);
      }
      return out;
    }
    /**
     * 头像 → 内存 data URL（渲染用；不解密正文，只解附件原始层）。
     * 无头像 / 解密失败返回 null；不落任何明文文件。
     */
    async avatarDataUrl(talker) {
      var _a2;
      this.requireUnlocked();
      const hit = this.avatarUrls.get(talker);
      if (hit !== void 0) return hit;
      const note = this.noteOf(talker);
      const att = (_a2 = note == null ? void 0 : note.attachments) == null ? void 0 : _a2[0];
      if (!att) {
        this.avatarUrls.set(talker, "");
        return null;
      }
      const b64 = await this.safe.decryptAttachmentOriginal(att);
      if (!b64) {
        this.avatarUrls.set(talker, "");
        return null;
      }
      const ext = (att.path.split(".").pop() || "jpg").toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
      const url = `data:${mime};base64,${b64}`;
      this.avatarUrls.set(talker, url);
      return url;
    }
    /**
     * 读改写一位联系人的记录（per-talker 串行）：
     * mutate 在最新记录上就地改（无记录则先落空骨架）；opts.avatar 传 AvatarInput 为设置头像、
     * 传 null 为移除头像、不传为不动。头像字节与既有密文指纹一致时零重写。
     * 返回 'created' | 'updated' | 'unchanged'（头像一致且无其他变化语义由调用方自行判定，
     * 这里只区分记录级动作）。
     */
    write(talker, mutate, opts) {
      var _a2;
      const prev = (_a2 = this.chains.get(talker)) != null ? _a2 : Promise.resolve();
      const run = prev.catch(() => void 0).then(() => this.writeSerial(talker, mutate, opts));
      this.chains.set(talker, run);
      return run;
    }
    async writeSerial(talker, mutate, opts) {
      var _a2, _b2;
      this.requireUnlocked();
      const existing = this.noteOf(talker);
      let rec;
      if (existing) {
        const cur = await this.read(talker);
        if (!cur) throw new Error("保库记录读取失败");
        rec = cur;
      } else {
        const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
        rec = { version: 1, person: emptyPersonEntry(talker, talker, nowIso2), store: emptyStoreContact(nowIso2), job: null };
      }
      await mutate(rec);
      let avatar = opts == null ? void 0 : opts.avatar;
      let avatarChanged = false;
      const oldAtt = (_a2 = existing == null ? void 0 : existing.attachments) == null ? void 0 : _a2[0];
      if (avatar !== void 0) {
        const newFp = avatar ? await fingerprintOf(avatar.base64) : null;
        const oldFp = (_b2 = oldAtt == null ? void 0 : oldAtt.fingerprint) != null ? _b2 : null;
        avatarChanged = newFp !== oldFp;
        if (avatar && !avatarChanged) avatar = void 0;
      }
      if (!existing) {
        await this.lockNoteFresh(talker, rec, avatar != null ? avatar : null);
        this.cache.set(talker, rec);
        return "created";
      }
      if (avatarChanged) {
        await this.safe.removeNote(existing.id);
        await this.lockNoteFresh(talker, rec, avatar != null ? avatar : null);
        this.cache.set(talker, rec);
        return "updated";
      }
      const json = JSON.stringify(rec);
      await this.safe.updateNotePayload(existing.id, json);
      this.cache.set(talker, rec);
      if (avatar === null) this.avatarUrls.delete(talker);
      return "updated";
    }
    /** 首建 / 重建整条记录（含头像附件；keptShared 置真——脸谱不删任何源文件） */
    async lockNoteFresh(talker, rec, avatar) {
      const input = {
        path: peopleNotePath(talker),
        title: `脸谱：${rec.person.name || talker}`,
        kind: PEOPLE_KIND,
        content: JSON.stringify(rec),
        attachments: avatar ? [
          {
            path: `${peopleNotePath(talker)}/avatar.${avatar.ext}`,
            kind: "image",
            data: avatar.base64,
            // 不删源：存量明文头像目录退役不删文件；新头像源在 vault 外数据根（issue 338 他引保护通道复用）
            keptShared: true
          }
        ] : []
      };
      await this.safe.lockNote(input);
      this.avatarUrls.delete(talker);
    }
    /** 删除一位联系人的整条保库记录（连同头像镜像；二次确认由 UI 层管） */
    async removeContact(talker) {
      this.requireUnlocked();
      const note = this.noteOf(talker);
      if (note) await this.safe.removeNote(note.id);
      this.cache.delete(talker);
      this.avatarUrls.delete(talker);
    }
    /** 清空全部联系人的聊天仓（设置页「清空聊天仓」；不动人物卡与任务——原 MessageStore.clear 同语义） */
    async clearStores() {
      this.requireUnlocked();
      for (const talker of this.talkers()) {
        await this.write(talker, (rec) => {
          rec.store = emptyStoreContact();
        });
      }
    }
  };
  var shared = null;
  async function getPeopleSafeStore() {
    if (!shared) {
      const enc = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
      shared = new PeopleSafeStore(enc.getSafeManager());
    }
    return shared;
  }

  // src/people/data.ts
  var PeopleStore = class {
    constructor(_app2) {
    }
    async safe() {
      return getPeopleSafeStore();
    }
    /** 人物列表（建卡时间升序；未解锁抛错——门禁在面板入口） */
    async list() {
      const safe = await this.safe();
      const all = await safe.readAll();
      return [...all.values()].map((r) => r.person).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    /** 新增或整体替换人物卡（按 id；无记录自动落骨架） */
    async upsert(entry) {
      const safe = await this.safe();
      await safe.write(entry.id, (rec) => {
        rec.person = entry;
      });
    }
    /** 追加一条导入记录 */
    async appendImport(id, rec) {
      await this.mutate(id, (p) => {
        p.imports.push(rec);
      });
    }
    /** 覆盖脸谱（重画） */
    async setDigest(id, digest) {
      await this.mutate(id, (p) => {
        p.digest = digest;
      });
    }
    /** 设置人物档案（传 undefined 清空） */
    async updateProfile(id, profile) {
      await this.mutate(id, (p) => {
        if (profile) p.profile = profile;
        else delete p.profile;
      });
    }
    /** 改称呼 */
    async rename(id, name) {
      await this.mutate(id, (p) => {
        p.name = name;
      });
    }
    /** 追加一条随手记（按日期序保持有序） */
    async addManualEvent(id, ev) {
      await this.mutate(id, (p) => {
        var _a2;
        ((_a2 = p.manualEvents) != null ? _a2 : p.manualEvents = []).push(ev);
        p.manualEvents.sort((a, b) => a.ts.localeCompare(b.ts));
      });
    }
    /** 删除一条随手记 */
    async removeManualEvent(id, evId) {
      await this.mutate(id, (p) => {
        var _a2;
        p.manualEvents = ((_a2 = p.manualEvents) != null ? _a2 : []).filter((e) => e.id !== evId);
      });
    }
    /** 记录增量提炼锚点（毫秒时间戳） */
    async setLastProcessedTs(id, ts) {
      await this.mutate(id, (p) => {
        p.lastProcessedTs = ts;
      });
    }
    /**
     * 合并人物：把 from 的导入记录 / 随手记 / 档案并进 to，然后移除 from。
     * 用于同一人在数据里出现两个 wxid 的情况（两个不同号、或改过号）。
     * 两份画像不自动混（混出来没有意义）：to 没有画像时才继承 from 的。
     */
    async mergeInto(fromId, toId) {
      var _a2, _b2;
      if (fromId === toId) return;
      const safe = await this.safe();
      const all = await safe.readAll();
      const from = (_a2 = all.get(fromId)) == null ? void 0 : _a2.person;
      const to = (_b2 = all.get(toId)) == null ? void 0 : _b2.person;
      if (!from || !to) throw new Error(`人物不存在: ${!from ? fromId : toId}`);
      await safe.write(toId, (rec) => {
        var _a3, _b3, _c, _d;
        const t = rec.person;
        t.imports.push(...from.imports);
        t.imports.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
        t.manualEvents = [...(_a3 = t.manualEvents) != null ? _a3 : [], ...(_b3 = from.manualEvents) != null ? _b3 : []].sort((a, b) => a.ts.localeCompare(b.ts));
        if (!t.profile && from.profile) t.profile = from.profile;
        if (!t.digest && from.digest) t.digest = from.digest;
        t.lastProcessedTs = Math.max((_c = t.lastProcessedTs) != null ? _c : 0, (_d = from.lastProcessedTs) != null ? _d : 0);
      });
      await safe.removeContact(fromId);
    }
    async remove(id) {
      const safe = await this.safe();
      if (!await safe.read(id)) throw new Error(`人物不存在: ${id}`);
      await safe.removeContact(id);
    }
    /** 单人物卡变更（不存在抛错——静默丢失比失败更糟） */
    async mutate(id, fn) {
      const safe = await this.safe();
      if (!await safe.read(id)) throw new Error(`人物不存在: ${id}`);
      await safe.write(id, (rec) => {
        fn(rec.person);
      });
    }
  };

  // src/people/digest.ts
  var DEFAULTS = { maxChars: 12e3, maxCount: 400, maxBatches: 60 };
  var MATERIAL_LIMITS = { quotes: 60, moments: 40, traits: 30, interests: 40, threads: 30, chronicle: 300 };
  function chunkMessages(messages, opts = {}) {
    var _a2;
    const { maxChars, maxCount, maxBatches } = { ...DEFAULTS, ...opts };
    const chunks = [];
    let lines = [];
    let chars = 0;
    let voice = 0;
    let image = 0;
    for (const m of messages) {
      const text2 = ((_a2 = m.text) != null ? _a2 : "").trim();
      if (!text2) continue;
      const line = renderLine(m.ts, m.isSender, text2);
      const fits = lines.length === 0 || lines.length < maxCount && chars + line.length <= maxChars;
      if (!fits) {
        chunks.push(makeChunk(lines, voice, image));
        lines = [];
        chars = 0;
        voice = 0;
        image = 0;
      }
      const mat = parseMediaTag(text2);
      if ((mat == null ? void 0 : mat.kind) === "voice") voice++;
      else if ((mat == null ? void 0 : mat.kind) === "image") image++;
      lines.push(line);
      chars += line.length;
    }
    if (lines.length) chunks.push(makeChunk(lines, voice, image));
    if (chunks.length <= maxBatches) return chunks;
    return evenlySample(chunks, maxBatches);
  }
  function evenlySample(items, max) {
    if (items.length <= max) return items;
    const picked = [];
    for (let i = 0; i < max; i++) picked.push(items[Math.round(i * (items.length - 1) / (max - 1))]);
    return picked.filter((v, i, a) => i === 0 || v !== a[i - 1]);
  }
  function makeChunk(lines, voice = 0, image = 0) {
    var _a2, _b2;
    const first = (_a2 = lines[0]) != null ? _a2 : "";
    const last = (_b2 = lines[lines.length - 1]) != null ? _b2 : "";
    const chunk = { from: first.slice(1, 11), to: last.slice(1, 11), count: lines.length, lines };
    if (voice || image) chunk.media = { voice, image };
    return chunk;
  }
  function chunkMetaOf(c) {
    const meta = { from: c.from, to: c.to, count: c.count };
    if (c.media) {
      meta.voice = c.media.voice;
      meta.image = c.media.image;
    }
    return meta;
  }
  function renderLine(ts, isSender, text2) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `[${day} ${hm}][${isSender ? "我" : "对方"}] ${text2}`;
  }
  function buildExtractPrompt(chunk, personName) {
    const media = chunk.media;
    const head = [
      `你在帮用户整理与好友「${personName}」的微信聊天记录。以下是 ${chunk.from} 至 ${chunk.to} 的片段（[我] = 用户发出，[对方] = 好友发出）。`,
      // 新对话行的语义说明（issue 449）：分享 / 引用 / 通话 / 命名表情是口味审美与关系温度的证据来源
      "行首方括号标签说明：`[分享]…` 与 `[小程序]…` 是分享 / 安利的内容标题（口味与审美的证据，可进 moments 与 traits）；`[文件]…` 是发送的文件；`[引用「…」]` 开头的行是引用回复（引号内为被引内容，其后是回复）；`[通话 …]` / `[通话中断 …]` / `[未接通·…]` 是通话事件（通话时长是关系温度的直接证据，可进 events 与 moments）；`[表情·名]` 是带名称的表情。群聊导出的行首会多一层 `[成员名]`——那不是标签，是群成员的名字，忽略它，谁在说仍看后面的 [我] / [对方]。"
    ];
    if ((media == null ? void 0 : media.voice) || (media == null ? void 0 : media.image)) {
      head.push(
        "本段含媒体消息：`[语音 …]` 开头的行是语音转写——] 后的文本就是原话内容，标签里可能带时长与情感标记（如 12s·平静）；`[图片]` 开头的行是一张图片的画面描述。"
      );
    }
    return [
      ...head,
      "",
      ...chunk.lines,
      "",
      "请采集以下六类素材，宁缺毋滥，没有就给空数组：",
      "",
      "1. events：交往事件，大事小事都要收。",
      "   每条含 ts（YYYY-MM-DD，事件发生日期）、kind 与 summary（一句话，不超过 40 字）。",
      '   kind = "major"：约定 / 见面 / 计划 / 重要话题 / 情绪事件 / 矛盾 / 承诺。',
      '   kind = "minor"：第一次做某事 / 分享的具体内容 / 习惯性互动 / 有画面的日常片段。',
      "   日常寒暄、表情包刷屏、无实义闲聊不要收。",
      "",
      "2. traits：对方的性格 / 兴趣 / 习惯线索短语（每条不超过 15 字）。",
      "   只收反复出现或特征鲜明的，不因单次提及就下判断。",
      "",
      "3. quotes：对方说过的有代表性原话（口头禅 / 典型语气 / 情绪外露的句子 / 冲突时的说法 / 关心人的说法）。",
      '   每条含 ts（YYYY-MM-DD）、who（固定为 "对方" 或 "我"）与 text（原话，可截断但**不要改写**）。',
      "   优先收能体现说话风格与脾气秉性的句子，最多 8 条。",
      ...(media == null ? void 0 : media.voice) ? ["   `[语音 …]` 行是亲口说的话：quotes 优先收这里的口语原话，text 只写转写文本（不要把标签、时长、情感标记写进去）。"] : [],
      "",
      "4. moments：具体场景或细节（反复出现的地点 / 物件 / 习惯动作 / 难忘画面）。",
      "   每条含 ts（YYYY-MM-DD）与 summary（不超过 30 字）。抽象的形容词不要收。",
      "   反复分享的内容来源（如网易云 / B站 / 豆瓣）也是难忘画面。",
      ...(media == null ? void 0 : media.image) ? ["   `[图片]` 行的画面描述就是现成的「难忘画面」，summary 直接用描述本身（不带标签）。"] : [],
      "",
      "5. interests：兴趣信号——对方分享 / 安利的具体内容、反复聊起的话题、正在投入的事。",
      "   每条含 ts（YYYY-MM-DD）与 topic（话题名，不超过 15 字）。",
      "   单次顺带一提不收，反复出现或特征鲜明才收。",
      "",
      "6. threads：未竟之事——约定、邀约、「下次一起…」、聊到一半没下文的话题。",
      "   每条含 ts（YYYY-MM-DD）与 text（不超过 30 字）。",
      "   只采集，不判断是否兑现。",
      "",
      "只输出 JSON，不要任何解释或代码围栏：",
      '{"events":[{"ts":"YYYY-MM-DD","kind":"major","summary":"..."}],"traits":["..."],"quotes":[{"ts":"YYYY-MM-DD","who":"对方","text":"..."}],"moments":[{"ts":"YYYY-MM-DD","summary":"..."}],"interests":[{"ts":"YYYY-MM-DD","topic":"..."}],"threads":[{"ts":"YYYY-MM-DD","text":"..."}]}'
    ].join("\n");
  }
  function buildChroniclePrompt(name, events, mediaNote, statsNote) {
    const eventLines = events.length ? events.map((e) => `- ${e.ts}：${e.summary}`).join("\n") : "（无）";
    return [
      `你在帮用户整理与好友「${name}」的交往史。以下是按时间顺序排列的交往事件（从认识到现在）。`,
      ...mediaNote ? ["", `素材说明：${mediaNote}`] : [],
      // statsNote 自带「互动画像：」标签，原文成行即可（不再叠加前缀）
      ...statsNote ? ["", statsNote] : [],
      "",
      eventLines,
      "",
      "请把这段关系写成一份「关系时间线」：",
      "",
      "要求：",
      "- 按时间顺序组织，用 `## 2023 年` 这样的年份小节分隔；素材密集的年份可用 `### 上半年 / 下半年` 再分。",
      "- 每个时期用 `-` 列表逐条写发生的事，**大事小事都要**：谁先开口、第一次做什么、一起去过哪、聊过什么重要话题、闹过什么别扭、怎么和好的。",
      "- 沉默期（断联与回联）也写进对应年份的叙事：哪段时间明显话少或断了联系、后来又怎么重新热络起来。",
      "- 通话或分享特别密集的时期，写成「这段关系的季节」——那是关系的高温期。",
      "- 有明确日期的条目以 `（YYYY-MM-DD）` 收在句尾；同一天的事合并成一条。",
      "- 开头先用一句话交代关系的起点（第一次说话是什么时候、从什么由头开始的）。",
      "- 只写素材里有的事，**不要编造**；素材稀疏的时期宁可只写一两条，也不要为填充而杜撰。",
      "- 可以适度归纳（如「这阵子聊得最多的是那家店」），但事实必须来自素材。",
      "- 总长 1500 字以内，直接输出 markdown 正文，不要代码围栏。"
    ].join("\n");
  }
  function buildProfileNote(profile) {
    var _a2;
    if (!profile) return "";
    const lines = [];
    if (profile.birthday) lines.push(`生日：${profile.birthday}`);
    if (profile.job) lines.push(`职业：${profile.job}`);
    if (profile.hometown) lines.push(`家乡：${profile.hometown}`);
    if (profile.metVia) lines.push(`怎么认识：${profile.metVia}`);
    if (profile.metAt) lines.push(`什么时候认识：${profile.metAt}`);
    if ((_a2 = profile.tags) == null ? void 0 : _a2.length) lines.push(`关系标签：${profile.tags.join("、")}`);
    if (profile.note) lines.push(`备注：${profile.note}`);
    return lines.join("\n");
  }
  var HARD_RULES = [
    "## 硬性要求",
    "- 输出 markdown，只允许这几种语法：`##` 二级小节、`-` 列表项、`**加粗**`、`> ` 引用块。不要一级标题、不要表格、不要代码块。",
    "- 优先写模式，不要写传记：写「TA 习惯用玩笑化解尴尬」，不要写「TA 三月去了北京」。",
    "- 证据与推断分开：有素材支撑的直接写；属于推断的用「看来」「似乎」起头。",
    "- 情绪要具体：不写抽象形容词（如「性格复杂」），写能看见的行为。",
    "- 保留矛盾：素材里相互张力的特征（如恋旧又独立、记仇又复盘）是特征不是噪声，如实保留，不许抹平。",
    "- 素材不足以支撑的小节，写「（素材不足）」，绝不编造。",
    "- 全文 1200 字以内，直接输出 markdown 正文，不要代码围栏。"
  ].join("\n");
  function linesOrNone(lines) {
    return lines.length ? lines.join("\n") : "（无）";
  }
  function buildPersonPrompt(name, material, sampleWarn) {
    const { events, traits, quotes, moments, interests, mediaNote, statsNote, profileNote } = material;
    return [
      `你在帮用户为好友「${name}」画一张「脸谱」的卷一《其人》——基于以下从聊天记录里提炼的素材，写出这个人本身的人物画像。人物与关系是两条轴：TA 是个什么样的人归本卷，「我们」怎么相处归卷二《我们》，本卷不写关系。`,
      ...sampleWarn ? [sampleWarn] : [],
      ...mediaNote ? ["", `素材说明：${mediaNote}`, ""] : [],
      "",
      ...profileNote ? ["## 素材〇：档案（手动信息，与聊天印象冲突时以档案为准）", profileNote, ""] : [],
      "## 素材一：交往事件",
      linesOrNone(events.map((e) => `- ${e.ts}：${e.summary}`)),
      "",
      "## 素材二：代表性原话",
      linesOrNone(quotes.map((q) => `- [${q.who}]「${q.text}」（${q.ts}）`)),
      "",
      "## 素材三：场景与细节",
      linesOrNone(moments.map((m) => `- ${m.ts}：${m.summary}`)),
      "",
      "## 素材四：特质线索",
      linesOrNone(traits.map((t) => `- ${t}`)),
      "",
      "## 素材五：兴趣信号",
      linesOrNone(interests.map((i) => `- ${i.ts}：${i.topic}`)),
      ...statsNote ? ["", "## 素材六：互动统计", statsNote] : [],
      "",
      "## 要产出的卷一《其人》（按此顺序，每节用 ## 二级标题）",
      "",
      "## 画像速写",
      "两三句话抓住这个人给人的整体感觉。必须写出一组矛盾感（相互张力的特征）——矛盾是特征不是噪声，不许抹平。",
      "",
      "## 性格与思维",
      "处事风格、脾气秉性、社交姿态，加上思维模式：怎么想问题、自我对话的方式、对尝试与第一次的态度。",
      "写法用行为规则：「当 X 时，TA Y」。TA 对自己的描述（自嘲 / 自剖 / 人格梗）只当线索引述，不当下结论。",
      "",
      "## 表达 DNA",
      "口头禅、高频词、句式节奏、标点与语气习惯、表情使用习惯、「不想理人」的信号。",
      "每条特征后面跟一个 `> ` 引用块，放素材里的真实原话当证据。称呼 / 昵称不写在这节（归卷二《我们》）。",
      "",
      "## 兴趣爱好",
      "分三层写：实际投入（愿意花时间做的事）→ 内容口味（爱看什么听什么）→ 精神底色（审美取向）。",
      "每层要有具体名目（作品名 / 活动名），不许只写形容词；没有的层写「（素材不足）」。",
      "",
      "## 价值观与红线",
      "在乎什么、反感什么、评判人和事的角度、绝不做什么。本节全部属推断：每条必须以「看来」或「似乎」起头；素材不足整节写「（素材不足）」。",
      "",
      "## 习惯",
      "生活习惯与聊天习惯：写可感知的模式，不罗列数字。",
      "",
      "## 情感倾向",
      "情绪基线（素材里的语音情感计数可直引）、表达情绪的方式（外露 / 憋着 / 反话）、什么能点亮 TA、什么让 TA 沉默。",
      "",
      HARD_RULES
    ].join("\n");
  }
  function buildBondPrompt(name, material, sampleWarn) {
    const { events, quotes, moments, threads, mediaNote, statsNote, profileNote } = material;
    return [
      `你在帮用户为好友「${name}」画一张「脸谱」的卷二《我们》——基于以下从聊天记录里提炼的素材，写出「用户与 TA」这段关系的画像。TA 本身是个什么样的人归卷一《其人》，本卷只写这段关系。`,
      ...sampleWarn ? [sampleWarn] : [],
      ...mediaNote ? ["", `素材说明：${mediaNote}`, ""] : [],
      "",
      ...profileNote ? ["## 素材〇：档案（手动信息，与聊天印象冲突时以档案为准）", profileNote, ""] : [],
      "## 素材一：交往事件",
      linesOrNone(events.map((e) => `- ${e.ts}：${e.summary}`)),
      "",
      "## 素材二：代表性原话",
      linesOrNone(quotes.map((q) => `- [${q.who}]「${q.text}」（${q.ts}）`)),
      "",
      "## 素材三：场景与细节",
      linesOrNone(moments.map((m) => `- ${m.ts}：${m.summary}`)),
      "",
      "## 素材四：未竟之事线索",
      linesOrNone(threads.map((t) => `- ${t.ts}：${t.text}`)),
      ...statsNote ? ["", "## 素材五：互动统计", statsNote] : [],
      "",
      "## 要产出的卷二《我们》（按此顺序，每节用 ## 二级标题）",
      "",
      "## 关系定性",
      "一段什么关系、TA 在用户生活里的独特角色、现在处在什么阶段。手动档案（关系标签 / 怎么认识）优先；档案与聊天印象冲突时，以档案为准并注明。",
      "",
      "## 互动结构",
      "谁更常先开口、回复节奏差、活跃时段、语音文字视频偏好、通话密度。互动统计是事实依据，但不要罗列数字——写可感知的相处模式与解读。",
      "",
      "## 演变阶段",
      "按素材把这段关系划成几个阶段（如热络期 / 转折 / 渐冷 / 回联），每个阶段一句定性 + 转折点事件。转淡或沉默是怎么发生的、后来是谁先开口回联。最后一句写「现在」——这段关系此刻在哪。",
      "",
      "## 我们的语言",
      "称呼演变：TA 怎么叫用户、用户怎么叫 TA、随情绪或亲密度的变化。再整理一份只属于这段关系的梗与暗语小词典。",
      "",
      "## 共同记忆",
      "反复出现的地点、物件、习惯、画面。要具体到能想起当时的场景。",
      "",
      "## 冲突与修复",
      "按行为链写：触发点清单（素材明说的标「直接」，推断的标「推断」）→ 冲突时的第一反应谱 → 升级信号 → 怎么收场。和解信号单独写——和解不一定是道歉，可能是发来一个梗、一句「有空吗」。收尾给一份雷区清单。",
      "",
      "## 未竟之事",
      "没兑现的约定、想一起做还没做的、聊一半断掉的话题。对照交往事件判断：约定过且后来一起做了的不收。",
      "",
      "## 经营建议",
      "怎么经营这段关系：什么能升温、什么会伤害、别踩什么。把档案标签翻译成具体的相处规则。",
      "",
      HARD_RULES
    ].join("\n");
  }
  function extractJsonLoose(raw) {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    const start = s.search(/[{[]/);
    if (start < 0) throw new Error("AI 回执里没有 JSON");
    const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (end <= start) throw new Error("AI 回执 JSON 不完整");
    return JSON.parse(s.slice(start, end + 1));
  }
  function parseBatchExtract(raw) {
    const data = extractJsonLoose(raw);
    const events = [];
    for (const e of arrOf(data.events)) {
      const ts = str(e.ts);
      const summary = str(e.summary);
      if (!ts || !summary) continue;
      const kind = str(e.kind);
      events.push(kind === "major" || kind === "minor" ? { ts, summary, kind } : { ts, summary });
    }
    const quotes = [];
    for (const q of arrOf(data.quotes)) {
      const ts = str(q.ts);
      const text2 = str(q.text);
      if (ts && text2) quotes.push({ ts, who: str(q.who) || "对方", text: text2 });
    }
    const moments = [];
    for (const m of arrOf(data.moments)) {
      const ts = str(m.ts);
      const summary = str(m.summary);
      if (ts && summary) moments.push({ ts, summary });
    }
    const traits = rawArr(data.traits).filter((t) => typeof t !== "object" || t === null).map((t) => str(t)).filter(Boolean);
    const interests = [];
    for (const it of arrOf(data.interests)) {
      const ts = str(it.ts);
      const topic = str(it.topic);
      if (ts && topic) interests.push({ ts, topic });
    }
    const threads = [];
    for (const t of arrOf(data.threads)) {
      const ts = str(t.ts);
      const text2 = str(t.text);
      if (ts && text2) threads.push({ ts, text: text2 });
    }
    return { events, traits, quotes, moments, interests, threads };
  }
  function arrOf(v) {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => !!x && typeof x === "object");
  }
  function rawArr(v) {
    return Array.isArray(v) ? v : [];
  }
  function str(v) {
    return String(v != null ? v : "").trim();
  }
  async function extractBatch(ask, chunk, personName) {
    return parseBatchExtract(await ask(buildExtractPrompt(chunk, personName)));
  }
  function mergeBatches(batches) {
    return {
      events: mergeEvents(batches.flatMap((b) => b.events)),
      quotes: dedupeBy(batches.flatMap((b) => b.quotes), (q) => q.text),
      moments: dedupeBy(batches.flatMap((b) => b.moments), (m) => m.summary),
      traits: dedupeBy(batches.flatMap((b) => b.traits), (t) => t),
      interests: dedupeBy(batches.flatMap((b) => b.interests), (i) => i.topic),
      threads: dedupeBy(batches.flatMap((b) => b.threads), (t) => t.text)
    };
  }
  function toPortraitMaterial(merged, o = {}) {
    return {
      events: o.sampleEvents ? evenlySample(merged.events, MATERIAL_LIMITS.chronicle) : merged.events,
      traits: evenlySample(merged.traits, MATERIAL_LIMITS.traits),
      quotes: evenlySample(merged.quotes, MATERIAL_LIMITS.quotes),
      moments: evenlySample(merged.moments, MATERIAL_LIMITS.moments),
      interests: evenlySample(merged.interests, MATERIAL_LIMITS.interests),
      threads: evenlySample(merged.threads, MATERIAL_LIMITS.threads),
      mediaNote: o.mediaNote,
      statsNote: o.statsNote,
      profileNote: o.profileNote
    };
  }
  var SAMPLE_WARN_THRESHOLD = 200;
  function sampleWarnOf(count) {
    return count < SAMPLE_WARN_THRESHOLD ? `注意：本次样本仅 ${count} 条消息，素材偏少——证据不足的小节直接写（素材不足），不要脑补。` : void 0;
  }
  function mergeEvents(events) {
    const byKey = /* @__PURE__ */ new Map();
    for (const e of events) {
      const key = `${e.ts}|${e.summary}`;
      const prev = byKey.get(key);
      if (!prev) byKey.set(key, e);
      else if (!prev.kind && e.kind) byKey.set(key, { ...prev, kind: e.kind });
    }
    return [...byKey.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  }
  function dedupeBy(items, key) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of items) {
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  }

  // src/core/ai.ts
  init_fake_obsidian();
  init_app();

  // src/core/model-limits.ts
  var MODEL_LIMITS = [
    // ---- DeepSeek 官方（2026-09-16 核对官方「模型 & 价格」页：上下文 1M / 最大输出 384K，在售模型同档）
    {
      id: "deepseek-flash",
      aliases: ["deepseek-v4-flash", "deepseek-v4-flash-vision-exp", "deepseek-flash-latest", "deepseek-v4.1-flash"],
      maxOutput: 393216,
      contextWindow: 1048576
    },
    {
      id: "deepseek-v4-pro",
      aliases: ["deepseek-pro", "deepseek-pro-latest"],
      maxOutput: 393216,
      contextWindow: 1048576
    },
    // ---- 阿里云百炼 Qwen3.7 系（2026-09-16 核对官方帮助中心；qwen-plus / qwen-max 等短名指向当前主力版本）
    { id: "qwen3.7-plus", aliases: ["qwen-plus"], maxOutput: 131072, contextWindow: 1e6 },
    { id: "qwen3.7-max", aliases: ["qwen-max"], maxOutput: 65536, contextWindow: 1e6 },
    { id: "qwen3.7-flash", aliases: ["qwen-flash", "qwen-turbo"], maxOutput: 16384, contextWindow: 1e6 },
    // ---- 智谱 GLM-5.3 系（2026-09-23 核对官方「核心参数」：最大输出 131072 / 默认 65536 / 上下文 1M）
    { id: "glm-5.3-flash", aliases: ["glm-5.3-flashx", "glm-5.3"], maxOutput: 131072, contextWindow: 1e6 },
    // ---- 以下条目沿用注册表既有口径（未二次核对官方文档，数值与注册表默认一致，勿据此调大）
    { id: "claude-sonnet-4-5", aliases: ["claude-sonnet-4.5"], maxOutput: 64e3, contextWindow: 2e5 },
    { id: "gpt-4o-mini", maxOutput: 16384, contextWindow: 128e3 },
    { id: "gemini-2.0-flash", maxOutput: 8192, contextWindow: 1048576 },
    { id: "kimi-k2-0711-preview", aliases: ["kimi-k2"], maxOutput: 131072, contextWindow: 131072 },
    { id: "glm-4-flash", maxOutput: 8192, contextWindow: 131072 }
  ];
  function normalizeModelId(model) {
    return String(model || "").trim().toLowerCase().split(":")[0].split("/").pop().trim();
  }
  function resolveModelLimits(model) {
    const key = normalizeModelId(model || "");
    if (!key) return null;
    let best = null;
    for (const entry of MODEL_LIMITS) {
      for (const k of [entry.id, ...entry.aliases || []]) {
        if (key === k) return { maxOutput: entry.maxOutput, contextWindow: entry.contextWindow };
        if (key.includes(k) && (!best || k.length > best.len)) best = { entry, len: k.length };
      }
    }
    return best ? { maxOutput: best.entry.maxOutput, contextWindow: best.entry.contextWindow } : null;
  }

  // src/core/ai.ts
  init_crypto();
  var _settingsProvider = null;
  function getQ3Settings() {
    return _settingsProvider ? _settingsProvider() : {};
  }
  var THINK_AUTO = { value: "auto", label: "跟随模型默认", body: null };
  var THINK_OFF = { value: "off", label: "关闭（省 token）", body: null };
  var THINK_LOW = { value: "low", label: "低", body: null };
  var THINK_MEDIUM = { value: "medium", label: "中", body: null };
  var THINK_HIGH = { value: "high", label: "高", body: null };
  var THINK_MAX = { value: "max", label: "最高", body: null };
  var DEFAULT_AI_PROVIDER = "deepseek";
  var AI_PROVIDER_REGISTRY = [
    {
      id: "deepseek",
      label: "DeepSeek",
      endpoint: "https://api.deepseek.com",
      model: "",
      // 空 = 沿用调用方默认模型（原行为：deepseek 不强制模型）
      // 兜底 = 端点在售模型的官方最大档（2026-09-16 核对：上下文 1M / 最大输出 384K）；
      // 用户在「模型名称」行指定模型时，以 model-limits 查表值为准（issue 342/ADR-0151）
      defaultMaxTokens: 393216,
      // 硬护栏同值：此家缺省模型名留空（由调用方传），model-limits 兜不到，须显式声明
      maxOutputCap: 393216,
      apiKeyKey: "deepseekApiKey",
      apiKeyLabel: "DeepSeek 密钥",
      apiKeyDesc: "DeepSeek 官方的接口密钥",
      // 思考：官方 OpenAI 格式开关 thinking.type + 强度 reasoning_effort（默认开、默认 high）
      thinking: {
        levels: [
          THINK_AUTO,
          { ...THINK_OFF, body: { thinking: { type: "disabled" } } },
          { ...THINK_LOW, body: { thinking: { type: "enabled" }, reasoning_effort: "low" } },
          { ...THINK_HIGH, body: { thinking: { type: "enabled" }, reasoning_effort: "high" } },
          { ...THINK_MAX, body: { thinking: { type: "enabled" }, reasoning_effort: "max" } }
        ]
      }
    },
    {
      // Coding 套餐（Lite/Pro/Max）额度只在 coding 专用端点生效；走标准 paas/v4 会按量计费报余额不足
      id: "zhipu-plan",
      label: "智谱 Plan",
      endpoint: "https://open.bigmodel.cn/api/coding/paas/v4",
      model: "glm-5.3-flash",
      // glm-5.3 / 5.3-flash 官方最大输出 131072（默认 65536，上下文 1M）
      defaultMaxTokens: 131072,
      maxOutputCap: 131072,
      // 硬护栏：glm-5.3 系官方最大输出（填超即服务端 400 / 1210）
      apiKeyKey: "zhipuPlanApiKey",
      apiKeyLabel: "智谱 Plan 密钥",
      apiKeyDesc: "智谱 Coding 套餐的接口密钥",
      // 思考：glm-5.3 / 5.3-flash **强制思考**（发 disabled 无效），故只给强度档
      thinking: {
        levels: [
          THINK_AUTO,
          { ...THINK_LOW, body: { reasoning_effort: "low" } },
          { ...THINK_HIGH, body: { reasoning_effort: "high" } },
          { ...THINK_MAX, body: { reasoning_effort: "max" } }
        ]
      }
    },
    {
      id: "ollama",
      label: "Ollama（本地）",
      endpoint: "http://localhost:11434/v1",
      model: "llama3.1",
      defaultMaxTokens: 8192,
      // 有意不设 maxOutputCap：本地模型输出上限因所装模型而异、无官方档位可依；8192 只是兜底档，
      // 面板可自由调大（既有口径，不因本票收紧）
      apiKeyKey: "ollamaApiKey",
      apiKeyLabel: "Ollama 密钥",
      apiKeyDesc: "本地服务无需密钥",
      // 思考：兼容层把 reasoning_effort 映射为内部 Think（none = 关；省略 = 有能力则开）
      thinking: {
        levels: [
          THINK_AUTO,
          { ...THINK_OFF, body: { reasoning_effort: "none" } },
          { ...THINK_LOW, body: { reasoning_effort: "low" } },
          { ...THINK_MEDIUM, body: { reasoning_effort: "medium" } },
          { ...THINK_HIGH, body: { reasoning_effort: "high" } }
        ]
      }
    }
  ];
  function getProviderDescriptor(id) {
    return AI_PROVIDER_REGISTRY.find((p) => p.id === id) || AI_PROVIDER_REGISTRY.find((p) => p.id === DEFAULT_AI_PROVIDER) || AI_PROVIDER_REGISTRY[0];
  }
  function thinkingLevelsOf(providerId) {
    var _a2, _b2;
    return (_b2 = (_a2 = getProviderDescriptor(providerId).thinking) == null ? void 0 : _a2.levels) != null ? _b2 : [];
  }
  function maxOutputCapOf(providerId, modelName) {
    const desc = getProviderDescriptor(providerId);
    const hit = resolveModelLimits(modelName || desc.model || "");
    return hit ? hit.maxOutput : desc.maxOutputCap;
  }
  function thinkingBodyFor(providerId, level) {
    var _a2;
    if (!providerId || !level || level === "auto") return null;
    const hit = thinkingLevelsOf(providerId).find((l) => l.value === level);
    return (_a2 = hit == null ? void 0 : hit.body) != null ? _a2 : null;
  }
  function hasExplicitThinkingOption(mo) {
    return "enable_thinking" in mo || "reasoning_effort" in mo || "thinking" in mo;
  }
  var _aiProviderCache = null;
  async function getAIProvider(override) {
    var _a2, _b2;
    if (!override && _aiProviderCache) return _aiProviderCache;
    const cacheable = !override;
    const cachePut2 = (p) => {
      if (cacheable) _aiProviderCache = p;
      return p;
    };
    const s = getQ3Settings();
    if (override && typeof override === "object" && override.apiKey) {
      return {
        endpoint: String(override.endpoint || "https://api.deepseek.com").replace(/\/+$/, ""),
        apiKey: override.apiKey,
        model: override.model || void 0,
        extraHeaders: override.extraHeaders || void 0,
        defaultMaxTokens: override.defaultMaxTokens
      };
    }
    const name = typeof override === "string" && override || s.aiProvider || DEFAULT_AI_PROVIDER;
    const desc = getProviderDescriptor(name);
    const key = s[desc.apiKeyKey];
    if (!key && name === "deepseek") {
      try {
        const raw = await getApp().vault.adapter.read(".obsidian/plugins/quickadd/data.json");
        const cfg = JSON.parse(raw);
        const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
        if (provider && provider.endpoint && provider.apiKey) {
          return cachePut2({
            id: "deepseek",
            endpoint: String(provider.endpoint).replace(/\/+$/, ""),
            apiKey: provider.apiKey,
            defaultMaxTokens: desc.defaultMaxTokens
          });
        }
      } catch (e) {
      }
    }
    if (!key && name !== "ollama") {
      throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
    }
    const overrideModel = (_a2 = s.aiModelOverrides) == null ? void 0 : _a2[name];
    const effModel = overrideModel || desc.model || "";
    const cap = maxOutputCapOf(name, effModel);
    const requested = Number((_b2 = s.aiMaxTokensOverrides) == null ? void 0 : _b2[name]);
    const defaultMaxTokens = requested > 0 ? cap === void 0 ? requested : Math.min(requested, cap) : cap != null ? cap : desc.defaultMaxTokens;
    return cachePut2({
      id: name,
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: effModel || void 0,
      defaultMaxTokens
    });
  }
  function abortError() {
    const e = new Error("请求已取消");
    e.name = "AbortError";
    return e;
  }
  var AI_IDLE_TIMEOUT_MS = 6e4;
  var AI_IMAGE_IDLE_TIMEOUT_MS = 18e4;
  function timeoutError(idleMs = AI_IDLE_TIMEOUT_MS) {
    const e = new Error(`AI 请求超时（${Math.round(idleMs / 1e3)} 秒无响应）`);
    e.name = "TimeoutError";
    return e;
  }
  function idleTimeoutOf(body) {
    const msgs = Array.isArray(body == null ? void 0 : body.messages) ? body.messages : [];
    const hasImage = msgs.some(
      (m) => Array.isArray(m == null ? void 0 : m.content) && m.content.some((p) => (p == null ? void 0 : p.type) === "image_url")
    );
    return hasImage ? AI_IMAGE_IDLE_TIMEOUT_MS : AI_IDLE_TIMEOUT_MS;
  }
  async function streamChatCompletions(provider, body, signal, onDelta) {
    const idleMs = idleTimeoutOf(body);
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const controller2 = new AbortController();
    const onOuterAbort = () => controller2.abort();
    let outerLinked = false;
    if (signal) {
      if (signal.aborted) controller2.abort();
      else {
        signal.addEventListener("abort", onOuterAbort);
        outerLinked = true;
      }
    }
    let idleTimer = null;
    const armIdle = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller2.abort(), idleMs);
    };
    try {
      armIdle();
      const resp = await fetch(`${provider.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller2.signal
      });
      if (!resp.ok) {
        let msg = `API ${resp.status}`;
        try {
          const err = await resp.json();
          if (err.error && err.error.message) msg = err.error.message;
        } catch (e) {
        }
        throw new Error(msg);
      }
      if (!resp.body || typeof resp.body.getReader !== "function") {
        const data = await resp.json();
        return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || "";
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "", buf = "";
      while (true) {
        armIdle();
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            try {
              reader.cancel();
            } catch (e) {
            }
            return full;
          }
          try {
            const chunk = JSON.parse(payload);
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
            if (delta) {
              full += delta;
              try {
                onDelta == null ? void 0 : onDelta(delta);
              } catch (e) {
              }
            }
          } catch (e) {
          }
        }
      }
      return full;
    } catch (e) {
      if (controller2.signal.aborted && !(signal && signal.aborted)) throw timeoutError(idleMs);
      throw e;
    } finally {
      if (idleTimer !== null) clearTimeout(idleTimer);
      if (outerLinked && signal) signal.removeEventListener("abort", onOuterAbort);
    }
  }
  async function chatCompletionsNonStream(provider, body, signal) {
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const idleMs = idleTimeoutOf(body);
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await new Promise((resolve, reject) => {
      let timer = null;
      const settle = (fn) => {
        if (timer !== null) clearTimeout(timer);
        fn();
      };
      timer = setTimeout(() => settle(() => reject(timeoutError(idleMs))), idleMs);
      requestUrl({
        url: `${provider.endpoint}/chat/completions`,
        method: "POST",
        headers,
        body: JSON.stringify({ ...body, stream: false })
      }).then(
        (r) => settle(() => resolve(r)),
        (e) => settle(() => reject(e))
      );
    });
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const data = JSON.parse(resp.text);
    const errMsg = data.error && (data.error.message || data.error.type) || data.message && data.message;
    if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content === void 0 || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
    return content;
  }
  var AI_IMAGE_MAX_BYTES = 32 * 1024 * 1024;
  function buildUserContent(input) {
    var _a2;
    if (typeof input === "string") return input;
    const text2 = String((_a2 = input == null ? void 0 : input.text) != null ? _a2 : "");
    const images = (Array.isArray(input == null ? void 0 : input.images) ? input.images : []).map((u) => String(u != null ? u : "").trim()).filter((u) => u.length > 0);
    if (!images.length) return text2;
    return [
      { type: "text", text: text2 },
      ...images.map((url) => ({ type: "image_url", image_url: { url } }))
    ];
  }
  function buildMessages(input) {
    if (input && typeof input === "object" && Array.isArray(input.messages)) {
      return input.messages;
    }
    return [{ role: "user", content: buildUserContent(input) }];
  }
  var AIService = class {
    constructor(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
      this.defaultModel = defaultModel;
      this.defaultOptions = defaultOptions;
    }
    /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
     *  input 为字符串（纯文本，报文同旧版）、{text, images}（带图 → 多模态 content 数组）
     *  或 {messages}（多轮完整报文，原样进请求）；
     *  options.signal（取消）/ options.onDelta（流式增量回调）为调用方选项（ticket 141），不进请求体，
     *  既有调用（不传这两项）行为零变化 */
    async prompt(input, model = this.defaultModel, options = {}) {
      var _a2;
      const mergedOptions = this._mergeOptions(options);
      const provider = await getAIProvider(mergedOptions.provider);
      const s = getQ3Settings();
      const isExplicit = model !== this.defaultModel;
      const effModel = isExplicit ? model : provider.model || model;
      const mo = mergedOptions.modelOptions || {};
      const effMaxTokens = provider.defaultMaxTokens || 4096;
      const body = {
        model: effModel,
        messages: buildMessages(input),
        max_tokens: effMaxTokens,
        stream: true
      };
      for (const k of Object.keys(mo)) {
        if (k === "max_tokens") continue;
        body[k] = mo[k];
      }
      if (!hasExplicitThinkingOption(mo)) {
        const thinking = thinkingBodyFor(provider.id, (_a2 = s.aiThinkingOverrides) == null ? void 0 : _a2[provider.id || ""]);
        if (thinking) Object.assign(body, thinking);
      }
      const signal = mergedOptions.signal instanceof AbortSignal ? mergedOptions.signal : void 0;
      const onDelta = typeof mergedOptions.onDelta === "function" ? mergedOptions.onDelta : void 0;
      try {
        const content = await streamChatCompletions(provider, body, signal, onDelta);
        return content;
      } catch (streamError) {
        if (signal == null ? void 0 : signal.aborted) throw streamError;
        try {
          const content = await chatCompletionsNonStream(provider, body, signal);
          return content;
        } catch (e) {
          throw new Error(`AI 请求失败: ${streamError.message}（fallback: ${e.message}）`);
        }
      }
    }
    /** 普通对话模型（deepseek-v4-flash；收纯文本或 {text, images}） */
    async chat(input, extraOptions = {}) {
      return this.prompt(input, "deepseek-v4-flash", extraOptions);
    }
    /** 要求 AI 返回 JSON 格式（设置 response_format；知识盒等域走这条，故同样要能吃图） */
    async json(input, extraOptions = {}) {
      const options = this._prepareOptions(extraOptions, {
        response_format: { type: "json_object" }
      });
      return this.prompt(input, "deepseek-v4-flash", options);
    }
    setDefaultModel(model) {
      this.defaultModel = model;
    }
    setDefaultOptions(options) {
      this.defaultOptions = options;
    }
    // ---------- 内部辅助方法 ----------
    _mergeOptions(options) {
      const merged = { ...this.defaultOptions, ...options };
      if (this.defaultOptions.modelOptions || options.modelOptions) {
        merged.modelOptions = {
          ...this.defaultOptions.modelOptions || {},
          ...options.modelOptions || {}
        };
      }
      return merged;
    }
    /** 准备选项：复制 extraOptions，并设置指定的 modelOptions 字段（用户显式传入优先） */
    _prepareOptions(extraOptions, modelSettings) {
      const options = { ...extraOptions };
      if (!options.modelOptions) options.modelOptions = {};
      const userModelOpts = options.modelOptions;
      options.modelOptions = { ...modelSettings, ...userModelOpts };
      return options;
    }
  };
  function createAI(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
    return new AIService(params, defaultModel, defaultOptions);
  }

  // src/people/incremental.ts
  function planIncremental(msgs, existing) {
    const anchor = existing == null ? void 0 : existing.lastProcessedTs;
    if (!anchor) return { mode: "full", msgs, olderCount: 0 };
    const from = new Date(msgs[0].ts).toISOString();
    const to = new Date(msgs[msgs.length - 1].ts).toISOString();
    const dup = existing.imports.some((r) => r.messageCount === msgs.length && r.timeFrom === from && r.timeTo === to);
    if (dup) return { mode: "skip", msgs: [], olderCount: msgs.length };
    const newer = msgs.filter((m) => m.ts > anchor - 1);
    if (newer.length) return { mode: "newer", msgs: newer, olderCount: msgs.length - newer.length };
    return { mode: "older", msgs, olderCount: 0 };
  }
  function mergeWithOld(merged, old) {
    var _a2, _b2, _c, _d, _e, _f;
    return {
      events: dedupeEvents([...(_a2 = old == null ? void 0 : old.events) != null ? _a2 : [], ...merged.events]),
      quotes: dedupeByText([...(_b2 = old == null ? void 0 : old.quotes) != null ? _b2 : [], ...merged.quotes], (q) => q.text),
      moments: dedupeByText([...(_c = old == null ? void 0 : old.moments) != null ? _c : [], ...merged.moments], (m) => m.summary),
      traits: dedupeByText([...(_d = old == null ? void 0 : old.traits) != null ? _d : [], ...merged.traits], (t) => t),
      interests: dedupeByText([...(_e = old == null ? void 0 : old.interests) != null ? _e : [], ...merged.interests], (i) => i.topic),
      threads: dedupeByText([...(_f = old == null ? void 0 : old.threads) != null ? _f : [], ...merged.threads], (t) => t.text)
    };
  }
  function dedupeEvents(events) {
    const byKey = /* @__PURE__ */ new Map();
    for (const e of events) {
      const key = `${e.ts}|${e.summary}`;
      const prev = byKey.get(key);
      if (!prev) byKey.set(key, e);
      else if (!prev.kind && e.kind) byKey.set(key, { ...prev, kind: e.kind });
    }
    return [...byKey.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  }
  function dedupeByText(items, key) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of items) {
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
    return out;
  }
  function mergeManualEvents(events, manual) {
    if (!(manual == null ? void 0 : manual.length)) return events;
    const seen = new Set(events.map((e) => `${e.ts}|${e.summary}`));
    const extra = manual.map((m) => ({ ts: m.ts, summary: m.summary })).filter((e) => e.ts && e.summary && !seen.has(`${e.ts}|${e.summary}`));
    if (!extra.length) return events;
    return [...events, ...extra].sort((a, b) => a.ts.localeCompare(b.ts));
  }

  // src/people/stats.ts
  var SESSION_GAP_MS = 30 * 60 * 1e3;
  var REPLY_CAP_SEC = 3600;
  function monthKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function avgOf(samples) {
    if (!samples.length) return 0;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  function medianOf(samples) {
    if (!samples.length) return 0;
    const s = [...samples].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function computeStats(messages, kindCounts) {
    var _a2;
    const msgs = [...messages].sort((a, b) => a.ts - b.ts);
    const monthly = /* @__PURE__ */ new Map();
    const myHourly = new Array(24).fill(0);
    const otherHourly = new Array(24).fill(0);
    let initiatedByMe = 0;
    let initiatedByOther = 0;
    const mySamples = [];
    const otherSamples = [];
    let prev = null;
    for (const m of msgs) {
      if (!Number.isFinite(m.ts)) continue;
      const d = new Date(m.ts);
      monthly.set(monthKey(m.ts), ((_a2 = monthly.get(monthKey(m.ts))) != null ? _a2 : 0) + 1);
      myHourly[d.getHours()] += m.isSender ? 1 : 0;
      otherHourly[d.getHours()] += m.isSender ? 0 : 1;
      if (!prev || m.ts - prev.ts >= SESSION_GAP_MS) {
        if (m.isSender) initiatedByMe++;
        else initiatedByOther++;
      } else if (m.isSender !== prev.isSender) {
        const sec = (m.ts - prev.ts) / 1e3;
        if (sec <= REPLY_CAP_SEC) (m.isSender ? mySamples : otherSamples).push(sec);
      }
      prev = m;
    }
    const media = collectMediaStats(msgs);
    return {
      monthly: [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      initiatedByMe,
      initiatedByOther,
      myAvgReplySec: avgOf(mySamples),
      otherAvgReplySec: avgOf(otherSamples),
      myMedianReplySec: medianOf(mySamples),
      otherMedianReplySec: medianOf(otherSamples),
      myHourly,
      otherHourly,
      kindCounts: { ...kindCounts },
      // 浅拷贝：与调用方数据脱钩，改返回值不伤原对象
      voiceCount: media.voiceCount,
      voiceTotalSec: media.voiceTotalSec,
      imageCount: media.imageCount
    };
  }
  function formatReplySec(sec) {
    if (!Number.isFinite(sec) || sec <= 0) return "无样本";
    if (sec < 60) return `${Math.max(1, Math.round(sec))} 秒`;
    if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))} 分钟`;
    return `${Math.max(1, Math.round(sec / 3600))} 小时`;
  }

  // src/people/jobs.ts
  var jobs_exports = {};
  __export(jobs_exports, {
    DEFAULT_MAX_RETRIES: () => DEFAULT_MAX_RETRIES,
    DRIFT_ERROR: () => DRIFT_ERROR,
    JobStore: () => JobStore,
    __resetJobsForTests: () => __resetJobsForTests,
    emptyJobsData: () => emptyJobsData,
    fingerprintOf: () => fingerprintOf2,
    pauseJobs: () => pauseJobs,
    removeJob: () => removeJob,
    resume: () => resume,
    resumeJobs: () => resumeJobs,
    snapshot: () => snapshot,
    startJobs: () => startJobs,
    subscribe: () => subscribe,
    whenIdle: () => whenIdle
  });
  init_domain_bus();
  init_data();

  // src/people/insights.ts
  var SESSION_GAP_MS2 = 30 * 60 * 1e3;
  var REPLY_CAP_SEC2 = 3600;
  var SILENCE_GAP_MS = 14 * 24 * 3600 * 1e3;
  var SILENCE_GAP_MAX = 12;
  var NIGHT_HOURS = /* @__PURE__ */ new Set([0, 1, 2, 3, 4, 5]);
  function emptyInsightSignals() {
    return {
      shareCount: 0,
      emojiCount: 0,
      emojiNamedCount: 0,
      callCount: 0,
      callTotalSec: 0,
      callMissedCount: 0,
      recantByMe: 0,
      recantByOther: 0,
      voiceEmotion: {}
    };
  }
  function dateKeyOf(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function computeInsights(msgs, signals) {
    const sorted = msgs.filter((m) => m && Number.isFinite(m.ts)).sort((a, b) => a.ts - b.ts);
    let sessionStartedByMe = 0;
    let sessionStartedByOther = 0;
    const mySamples = [];
    const otherSamples = [];
    let night = 0;
    const gaps = [];
    let prev = null;
    for (const m of sorted) {
      if (NIGHT_HOURS.has(new Date(m.ts).getHours())) night++;
      if (!prev) {
        if (m.isSender) sessionStartedByMe++;
        else sessionStartedByOther++;
        prev = m;
        continue;
      }
      const gapMs = m.ts - prev.ts;
      if (gapMs >= SESSION_GAP_MS2) {
        if (m.isSender) sessionStartedByMe++;
        else sessionStartedByOther++;
      } else if (m.isSender !== prev.isSender) {
        const sec = gapMs / 1e3;
        if (sec <= REPLY_CAP_SEC2) (m.isSender ? mySamples : otherSamples).push(sec);
      }
      if (gapMs >= SILENCE_GAP_MS) {
        gaps.push({
          from: dateKeyOf(prev.ts),
          to: dateKeyOf(m.ts),
          // 日历日差（与 from/to 字面日期自洽；24h 时段的 floor 会出现「01-05 至 01-20（14 天）」式矛盾）
          days: Math.round((Date.parse(dateKeyOf(m.ts)) - Date.parse(dateKeyOf(prev.ts))) / (24 * 3600 * 1e3))
        });
      }
      prev = m;
    }
    const silenceGaps = gaps.sort((a, b) => b.days - a.days).slice(0, SILENCE_GAP_MAX).sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
    return {
      sessionStartedByMe,
      sessionStartedByOther,
      myReplyMedianSec: medianOf(mySamples),
      otherReplyMedianSec: medianOf(otherSamples),
      nightSharePct: sorted.length ? Math.round(night / sorted.length * 1e3) / 10 : 0,
      callCount: signals.callCount,
      callTotalSec: signals.callTotalSec,
      callMissedCount: signals.callMissedCount,
      recantByMe: signals.recantByMe,
      recantByOther: signals.recantByOther,
      voiceEmotion: { ...signals.voiceEmotion },
      silenceGaps,
      shareCount: signals.shareCount,
      emojiCount: signals.emojiCount,
      emojiNamedCount: signals.emojiNamedCount
    };
  }
  function buildStatsNote(i, monthly) {
    const parts = [];
    const sessions = [
      i.sessionStartedByMe ? `我发起 ${i.sessionStartedByMe} 次` : "",
      i.sessionStartedByOther ? `对方发起 ${i.sessionStartedByOther} 次` : ""
    ].filter(Boolean);
    if (sessions.length) parts.push(`会话${sessions.join("、")}`);
    const replies = [
      i.myReplyMedianSec ? `我中位 ${formatReplySec(i.myReplyMedianSec)}` : "",
      i.otherReplyMedianSec ? `对方中位 ${formatReplySec(i.otherReplyMedianSec)}` : ""
    ].filter(Boolean);
    if (replies.length) parts.push(`回复时延${replies.join("、")}`);
    if (i.nightSharePct > 0) parts.push(`深夜（0-6 点）消息占 ${i.nightSharePct}%`);
    if (i.callCount > 0) {
      let call = `通话 ${i.callCount} 次`;
      if (i.callTotalSec > 0) call += `（累计 ${formatReplySec(i.callTotalSec)}）`;
      if (i.callMissedCount > 0) call += `，其中未接通 ${i.callMissedCount} 次`;
      parts.push(call);
    }
    const recants = [
      i.recantByMe ? `我撤回 ${i.recantByMe} 条` : "",
      i.recantByOther ? `对方撤回 ${i.recantByOther} 条` : ""
    ].filter(Boolean);
    if (recants.length) parts.push(recants.join("、"));
    const emotions = Object.entries(i.voiceEmotion).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (emotions.length) parts.push(`语音情感 ${emotions.map(([k, n]) => `${k} ${n}`).join("、")}`);
    const shares = [];
    if (i.shareCount > 0) shares.push(`分享链接 ${i.shareCount} 条`);
    if (i.emojiCount > 0) {
      shares.push(`表情包 ${i.emojiCount} 个${i.emojiNamedCount > 0 ? `（其中 ${i.emojiNamedCount} 个带名称）` : ""}`);
    }
    if (shares.length) parts.push(shares.join("，"));
    if (i.silenceGaps.length) {
      const top3 = [...i.silenceGaps].sort((a, b) => b.days - a.days).slice(0, 3);
      parts.push(`最长的沉默 ${top3.map((g) => `${g.from} 至 ${g.to}（${g.days} 天）`).join("、")}`);
    }
    if (monthly == null ? void 0 : monthly.length) parts.push(monthlyDensity(monthly));
    return parts.length ? `互动画像：${parts.join("；")}。` : "";
  }
  function monthlyDensity(monthly) {
    var _a2;
    const asc = [...monthly].sort((a, b) => a[0].localeCompare(b[0]));
    if (asc.length > 12) {
      const byYear = /* @__PURE__ */ new Map();
      for (const [m, n] of asc) {
        const y = m.slice(0, 4);
        byYear.set(y, ((_a2 = byYear.get(y)) != null ? _a2 : 0) + n);
      }
      return `消息密度：${[...byYear.entries()].map(([y, n]) => `${y} 年合计 ${n} 条`).join("、")}`;
    }
    return `消息密度：${asc.map(([m, n]) => `${m} ${n} 条`).join("、")}`;
  }

  // src/people/datasource.ts
  init_settings_provider();

  // src/people/parse.ts
  function normalizeKind(typeName, typeNum, text2) {
    if (typeName !== void 0 && typeName !== "") return kindFromTypeName(typeName);
    if (typeNum !== void 0 && typeNum !== "") {
      const k = kindFromTypeNum(typeNum, text2);
      if (k) return k;
    }
    return kindFromLabel(text2);
  }
  function kindFromTypeName(raw) {
    const n = raw.trim();
    if (!n) return "其他";
    if (/^(文本|文字|text)$/i.test(n)) return "文本";
    if (n.includes("通话")) return "通话";
    if (n.includes("撤回") || n.includes("系统")) return "系统";
    if (n.includes("引用")) return "引用";
    if (n.includes("表情")) return "表情";
    if (n.includes("图片")) return "图片";
    if (n.includes("视频")) return "视频";
    if (n.includes("语音")) return "语音";
    if (n.includes("文件")) return "文件";
    if (n.includes("分享") || n.includes("链接")) return "分享";
    return "其他";
  }
  function kindFromTypeNum(raw, text2) {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    switch (Number(s)) {
      case 1:
        return "文本";
      case 3:
        return "图片";
      case 34:
        return "语音";
      case 43:
        return "视频";
      case 47:
        return "表情";
      case 50:
        return "通话";
      case 49:
        if (text2.startsWith("[引用")) return "引用";
        if (text2.startsWith("[文件")) return "文件";
        return "分享";
      case 1e4:
      case 10002:
        return "系统";
      default:
        return "其他";
    }
  }
  function kindFromLabel(text2) {
    const t = text2.trim();
    if (t.startsWith("[图片")) return "图片";
    if (t.startsWith("[视频")) return "视频";
    if (t.startsWith("[语音")) return "语音";
    if (t.startsWith("[通话") || t.includes("通话时长")) return "通话";
    if (t.startsWith("[表情")) return "表情";
    if (t.startsWith("[文件")) return "文件";
    if (t.startsWith("[引用")) return "引用";
    if (t.startsWith("[分享") || t.startsWith("[链接")) return "分享";
    if (t.startsWith("[撤回")) return "系统";
    return "文本";
  }

  // src/people/datasource.ts
  function hash32(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  function msgKey(raw) {
    var _a2, _b2, _c;
    const sid = typeof raw.sid === "number" && Number.isFinite(raw.sid) && raw.sid !== 0 ? raw.sid : 0;
    if (sid) return `s${sid}:${(_a2 = raw.ct) != null ? _a2 : 0}`;
    return `h${hash32(`${(_b2 = raw.ct) != null ? _b2 : 0}|${String((_c = raw.msg) != null ? _c : "")}`)}`;
  }
  var SELF_WHO = "我";
  function isSelfWho(who) {
    return String(who != null ? who : "").trim() === SELF_WHO;
  }
  var IMG_DESC_NEAREST_SEC = 12 * 3600;
  function matchImageDesc(raw, descByFile, descByMonth, descUsed) {
    var _a2, _b2, _c, _d;
    const img = String((_a2 = raw.img) != null ? _a2 : "").trim();
    if (img) {
      const exact = descByFile.get(img);
      return exact ? String((_b2 = exact.desc) != null ? _b2 : "").trim() : "";
    }
    const ct = Number(raw.ct);
    if (!Number.isFinite(ct)) return "";
    const list = descByMonth.get(monthOf(ct));
    if (!(list == null ? void 0 : list.length)) return "";
    let best = null;
    let bestDiff = Infinity;
    for (const it of list) {
      const ict = Number(it.ct);
      if (!Number.isFinite(ict)) continue;
      const diff = Math.abs(ict - ct);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = it;
      }
    }
    if (!best || bestDiff > IMG_DESC_NEAREST_SEC) return "";
    const file = String((_c = best.file) != null ? _c : "").trim();
    const usedKey = file || `ct:${Number(best.ct)}`;
    if (descUsed.has(usedKey)) return "";
    descUsed.add(usedKey);
    return String((_d = best.desc) != null ? _d : "").trim();
  }
  function isGroupChat(raws) {
    var _a2;
    const others = /* @__PURE__ */ new Set();
    for (const r of raws) {
      if (!r || typeof r !== "object") continue;
      const who = String((_a2 = r.who) != null ? _a2 : "").trim();
      if (!who || isSelfWho(who)) continue;
      others.add(who);
      if (others.size > 1) return true;
    }
    return false;
  }
  function monthOf(sec) {
    const d = new Date(sec * 1e3);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  var EMOTION_ZH = {
    NEUTRAL: "平静",
    HAPPY: "开心",
    ANGRY: "生气",
    SAD: "难过"
  };
  function emotionZh(emotion) {
    var _a2;
    const e = emotion.trim();
    return (_a2 = EMOTION_ZH[e.toUpperCase()]) != null ? _a2 : e;
  }
  function buildVoiceText(raw, voice) {
    var _a2, _b2;
    const dur = Number.isFinite(raw.dur) && raw.dur > 0 ? Math.round(raw.dur) : 0;
    const emo = emotionZh(String((_a2 = voice == null ? void 0 : voice.emotion) != null ? _a2 : ""));
    const text2 = String((_b2 = voice == null ? void 0 : voice.text) != null ? _b2 : "").trim();
    const head = dur ? `[语音 ${dur}秒${emo ? `·${emo}` : ""}]` : "[语音]";
    return text2 ? `${head} ${text2}` : head;
  }
  var EMOJI_NAMED_RE = /^\[表情·[^\]]+\]/;
  var SHARE_MAX_CHARS = 80;
  var QUOTE_HEAD_MAX_CHARS = 60;
  var CALL_MISSED_REASONS = [
    "对方已拒绝",
    "未应答",
    "对方无应答",
    "对方已取消",
    "已取消",
    "对方忙线中",
    "忙线未接听"
  ];
  function truncateChars(s, max) {
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
  }
  function truncateQuoteHead(text2) {
    const m = /^(\[引用「)([\s\S]*?)(」[\s\S]*)$/.exec(text2);
    if (!m) return text2;
    const quote = m[2];
    if (quote.length <= QUOTE_HEAD_MAX_CHARS) return text2;
    return `${m[1]}${quote.slice(0, QUOTE_HEAD_MAX_CHARS)}…」${m[3].slice(1)}`;
  }
  function parseCallDurationSec(text2) {
    var _a2, _b2, _c;
    const colon = /\[通话(?:中断)?(?:时长)?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*\]/.exec(text2);
    if (colon) {
      const [a, b, c] = [Number(colon[1]), Number(colon[2]), Number((_a2 = colon[3]) != null ? _a2 : 0)];
      return colon[3] !== void 0 ? a * 3600 + b * 60 + c : a * 60 + b;
    }
    const zh = /\[通话(?:中断)?(?:时长)?\s+(?:(\d+)\s*分)?(?:(\d+)\s*秒)?\s*\]/.exec(text2);
    if (zh && (zh[1] || zh[2])) return Number((_b2 = zh[1]) != null ? _b2 : 0) * 60 + Number((_c = zh[2]) != null ? _c : 0);
    return null;
  }
  function formatCallDur(totalSec) {
    const sec = Math.max(0, Math.round(totalSec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor(sec % 3600 / 60);
    const s = sec % 60;
    if (h > 0) return `${h}时${m}分`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  }
  function missedCallReason(text2) {
    for (const r of CALL_MISSED_REASONS) {
      if (text2.includes(r)) return r;
    }
    return null;
  }
  function normalizeChatJson(raws, opts, extras) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
    const voiceByWav = /* @__PURE__ */ new Map();
    for (const v of (_a2 = extras == null ? void 0 : extras.voice) != null ? _a2 : []) {
      if (!v || typeof v !== "object") continue;
      const wav = String((_b2 = v.wav) != null ? _b2 : "").trim();
      if (!wav) continue;
      voiceByWav.set(wav, v);
      const base = wav.includes("/") ? wav.slice(wav.lastIndexOf("/") + 1) : wav;
      if (base) voiceByWav.set(base, v);
    }
    const descByFile = /* @__PURE__ */ new Map();
    const descByMonth = /* @__PURE__ */ new Map();
    for (const it of (_c = extras == null ? void 0 : extras.imageDesc) != null ? _c : []) {
      if (!it || typeof it !== "object") continue;
      const desc = String((_d = it.desc) != null ? _d : "").trim();
      if (!desc) continue;
      const file = String((_e = it.file) != null ? _e : "").trim();
      if (file) descByFile.set(file, it);
      const month = file.includes("/") ? file.slice(0, file.indexOf("/")) : monthOf(Number(it.ct));
      if (!month) continue;
      let list = descByMonth.get(month);
      if (!list) {
        list = [];
        descByMonth.set(month, list);
      }
      list.push(it);
    }
    for (const list of descByMonth.values()) list.sort((a, b) => (Number(a.ct) || 0) - (Number(b.ct) || 0));
    const descUsed = /* @__PURE__ */ new Set();
    const group = isGroupChat(raws);
    const signals = emptyInsightSignals();
    const bumpEmotion = (emo) => {
      var _a3;
      const k = String(emo != null ? emo : "").trim();
      if (k) signals.voiceEmotion[k] = ((_a3 = signals.voiceEmotion[k]) != null ? _a3 : 0) + 1;
    };
    const kindCounts = {};
    const msgs = [];
    let maxSid = 0;
    let rawTotal = 0;
    for (const item of raws) {
      rawTotal++;
      if (!item || typeof item !== "object") {
        kindCounts["其他"] = ((_f = kindCounts["其他"]) != null ? _f : 0) + 1;
        continue;
      }
      const raw = item;
      const typeNum = String((_g = raw.type) != null ? _g : "");
      const text2 = String((_h = raw.msg) != null ? _h : "").trim();
      bump(kindCounts, normalizeKind(void 0, typeNum, text2));
      const sid = typeof raw.sid === "number" && Number.isFinite(raw.sid) && raw.sid !== 0 ? raw.sid : 0;
      if (sid && sid > maxSid) maxSid = sid;
      const ts = Number.isFinite(raw.ct) ? Math.round(raw.ct * 1e3) : NaN;
      if (!Number.isFinite(ts) || !Number.isFinite(raw.ct)) continue;
      let out = "";
      switch (raw.type) {
        case 1:
          out = text2;
          break;
        case 34: {
          if (opts.previewVoice) {
            const tagged = text2 ? parseMediaTag(text2) : null;
            if (tagged) {
              out = text2;
              bumpEmotion(tagged.emotion);
            } else {
              const v = voiceByWav.get(String((_i = raw.wav) != null ? _i : "").trim());
              const merged = buildVoiceText(raw, v);
              const parsed = parseMediaTag(merged);
              if (parsed) {
                out = merged;
                bumpEmotion(parsed.emotion);
              }
            }
          }
          break;
        }
        case 3: {
          if (opts.imageDescMode === "file") {
            const hit = matchImageDesc(raw, descByFile, descByMonth, descUsed);
            if (hit) out = `[图片] ${hit}`;
          }
          break;
        }
        case 43: {
          if (opts.previewVideo) {
            const dur = Number.isFinite(raw.dur) && raw.dur > 0 ? Math.round(raw.dur) : 0;
            if (dur) out = `[视频 ${dur}秒]`;
          }
          break;
        }
        case 47: {
          signals.emojiCount++;
          if (EMOJI_NAMED_RE.test(text2)) {
            out = text2;
            signals.emojiNamedCount++;
          }
          break;
        }
        case 49: {
          if (text2.startsWith("[分享]") || text2.startsWith("[小程序]")) {
            signals.shareCount++;
            out = truncateChars(text2, SHARE_MAX_CHARS);
          } else if (text2.startsWith("[引用「")) {
            out = truncateQuoteHead(text2);
          } else {
            out = text2;
          }
          break;
        }
        case 50: {
          signals.callCount++;
          const missed = missedCallReason(text2);
          if (missed) {
            signals.callMissedCount++;
            out = `[未接通·${missed}]`;
            break;
          }
          const sec = parseCallDurationSec(text2);
          if (sec === null) {
            out = text2;
            break;
          }
          signals.callTotalSec += sec;
          out = `[${text2.startsWith("[通话中断") ? "通话中断" : "通话"} ${formatCallDur(sec)}]`;
          break;
        }
        case 1e4: {
          if (text2.includes("撤回")) {
            if (isSelfWho(raw.who)) signals.recantByMe++;
            else signals.recantByOther++;
          }
          if (opts.keepSystem) out = text2;
          break;
        }
        default:
          break;
      }
      if (out) {
        const who = String((_j = raw.who) != null ? _j : "").trim();
        if (group && who && !isSelfWho(who) && raw.type !== 1e4) out = `[${who}] ${out}`;
        out = out.replace(/\r\n?/g, "\n");
      }
      msgs.push({
        key: msgKey(raw),
        ts,
        isSender: isSelfWho(raw.who),
        type: typeof raw.type === "number" && Number.isFinite(raw.type) ? raw.type : 0,
        ...raw.who !== void 0 && { who: raw.who },
        ...sid !== 0 && { sid },
        ...typeof raw.dur === "number" && Number.isFinite(raw.dur) && raw.dur > 0 && { dur: raw.dur },
        ...typeof raw.wav === "string" && raw.wav && { wav: raw.wav },
        ...typeof raw.img === "string" && raw.img && { img: raw.img },
        text: out
      });
    }
    msgs.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
    const stats = storeStatsOf(msgs);
    const insights = computeInsights(msgs.filter((m) => m.text !== ""), signals);
    return { msgs, kindCounts, stats, insights, maxSid, skippedCount: Math.max(0, rawTotal - msgs.length) };
  }
  function bump(counts, kind) {
    var _a2;
    counts[kind] = ((_a2 = counts[kind]) != null ? _a2 : 0) + 1;
  }
  function storeStatsOf(msgs) {
    const unified = msgs.filter((m) => m.text !== "").map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
    const media = collectMediaStats(unified);
    return { msgCount: unified.length, voiceCount: media.voiceCount, voiceTotalSec: media.voiceTotalSec, imageCount: media.imageCount };
  }
  function mergeStore(existing, incoming, nowIso2) {
    var _a2, _b2, _c;
    const prev = new Map(((_a2 = existing == null ? void 0 : existing.msgs) != null ? _a2 : []).map((m) => [m.key, m]));
    let added = 0;
    let updated = 0;
    for (const m of incoming.msgs) {
      if (prev.has(m.key)) updated++;
      else added++;
      prev.set(m.key, m);
    }
    const msgs = [...prev.values()].sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
    const contact = {
      msgs,
      watermarkSid: Math.max((_b2 = existing == null ? void 0 : existing.watermarkSid) != null ? _b2 : 0, incoming.maxSid),
      stats: storeStatsOf(msgs),
      // 全量形态计数 / 互动画像每次导入重算或合并覆盖（normalize 按原始消息全量跑，幂等；不随增量累加）
      kindCounts: { ...(_c = existing == null ? void 0 : existing.kindCounts) != null ? _c : {}, ...incoming.kindCounts },
      insights: incoming.insights,
      updatedAt: nowIso2
    };
    return { contact, added, updated };
  }
  function storeToUnified(msgs) {
    return msgs.filter((m) => m.text !== "").map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
  }
  function normalizeOptionsFromSettings() {
    var _a2, _b2;
    const s = (_a2 = tryGetSettings()) != null ? _a2 : {};
    const mode = String((_b2 = s.peopleImageDescMode) != null ? _b2 : "file");
    return {
      previewVoice: s.peoplePreviewVoice !== false,
      imageDescMode: mode === "off" ? "off" : "file",
      previewVideo: s.peoplePreviewVideo !== false,
      keepSystem: s.peopleKeepSystem !== false
    };
  }
  function getFs() {
    const w = window;
    if (!w || !w.require) return null;
    try {
      return w.require("fs");
    } catch (e) {
      return null;
    }
  }
  function listContactDirs(dataDir) {
    const fs = getFs();
    if (!fs || !dataDir) return [];
    try {
      return fs.readdirSync(dataDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => String(d.name)).filter((name) => {
        try {
          return fs.existsSync(`${dataDir}/${name}/chat.json`);
        } catch (e) {
          return false;
        }
      }).sort((a, b) => a.localeCompare(b, "zh"));
    } catch (e) {
      return [];
    }
  }
  function readContactBundle(dataDir, name) {
    var _a2, _b2;
    const fs = getFs();
    if (!fs) return null;
    const readJson = (path) => {
      try {
        const parsed = JSON.parse(String(fs.readFileSync(path, "utf8")).replace(/^\uFEFF/, ""));
        return Array.isArray(parsed) ? parsed : null;
      } catch (e) {
        return null;
      }
    };
    const raws = readJson(`${dataDir}/${name}/chat.json`);
    if (!raws) return null;
    return {
      raws,
      voice: (_a2 = readJson(`${dataDir}/${name}/voice.json`)) != null ? _a2 : [],
      imageDesc: (_b2 = readJson(`${dataDir}/${name}/image_desc.json`)) != null ? _b2 : [],
      avatar: avatarFileOf(fs, `${dataDir}/${name}`)
    };
  }
  var AVA_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
  function avatarFileOf(fs, dir) {
    for (const ext of AVA_EXTS) {
      const p = `${dir}/avatar.${ext}`;
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {
      }
    }
    return null;
  }
  function readAvatarInput(absolutePath) {
    var _a2;
    const fs = getFs();
    const p = String(absolutePath != null ? absolutePath : "").trim();
    if (!fs || !p) return null;
    let srcExt = "";
    try {
      if (!fs.existsSync(p)) return null;
      srcExt = String((_a2 = p.split(".").pop()) != null ? _a2 : "").toLowerCase();
    } catch (e) {
      return null;
    }
    if (!AVA_EXTS.includes(srcExt)) return null;
    try {
      const buf = fs.readFileSync(p);
      if (!buf || !buf.length) return null;
      return { base64: bytesToBase64Of(buf), ext: srcExt };
    } catch (e) {
      return null;
    }
  }
  function bytesToBase64Of(bytes) {
    const CHUNK = 32768;
    let bin = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }
  function storeMediaBadge(stats) {
    var _a2, _b2, _c;
    if (!stats) return null;
    const acc = emptyMediaStats();
    acc.voiceCount = (_a2 = stats.voiceCount) != null ? _a2 : 0;
    acc.voiceTotalSec = (_b2 = stats.voiceTotalSec) != null ? _b2 : 0;
    acc.imageCount = (_c = stats.imageCount) != null ? _c : 0;
    return acc.voiceCount || acc.imageCount ? acc : null;
  }

  // src/people/jobs.ts
  function emptyJobsData() {
    return { version: 1, queue: [] };
  }
  var JobStore = class {
    constructor(app) {
      this.app = app;
      void this.app;
    }
    /**
     * 读全队列：各保库记录的 job 段按 startedAt 组装（引擎拾起顺序与旧文件数组序等价——
     * 同人至多一任务，跨人按开始时间先后）。上锁期返回空队列（无明文可读；引擎此时也已暂停）。
     */
    async read() {
      const safe = await getPeopleSafeStore();
      if (!safe.unlocked) return emptyJobsData();
      const all = await safe.readAll();
      const queue = [...all.values()].map((r) => r.job).filter((j) => !!j).sort(
        (a, b) => (a.startedAt || "").localeCompare(b.startedAt || "") || (a.updatedAt || "").localeCompare(b.updatedAt || "")
      );
      return { version: 1, queue };
    }
    /**
     * 整队列对账写回（引擎是本会话唯一写方）：队列里有的任务按 talker 写进对应记录的 job 段；
     * 记录里有而队列里没有的任务摘除（done 清队 / 删除任务）。未变零重写。
     * 未解锁抛错（persist 侧只告警不阻断——内存队列不丢，解锁后下一 checkpoint 补落）。
     */
    async write(data) {
      var _a2, _b2;
      const safe = await getPeopleSafeStore();
      if (!safe.unlocked) throw new Error("未解锁，无法保存任务");
      const all = await safe.readAll();
      const want = /* @__PURE__ */ new Map();
      for (const j of data.queue) if (j == null ? void 0 : j.talker) want.set(String(j.talker), j);
      for (const [talker, rec] of all) {
        const job = (_a2 = want.get(talker)) != null ? _a2 : null;
        if (JSON.stringify((_b2 = rec.job) != null ? _b2 : null) === JSON.stringify(job)) continue;
        await safe.write(talker, (r) => {
          r.job = job;
        });
      }
      for (const [talker, job] of want) {
        if (all.has(talker)) continue;
        await safe.write(talker, (r) => {
          r.job = job;
        });
      }
    }
  };
  var DEFAULT_MAX_RETRIES = 2;
  var RETRY_BACKOFF_MS = [1e3, 3e3];
  function realSleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function isAbortError(e) {
    return e instanceof Error && e.name === "AbortError";
  }
  var st = null;
  var runPromise = null;
  var subs = /* @__PURE__ */ new Set();
  var DRIFT_ERROR = "消息集已变化（导入过新数据），请删除任务后重新生成";
  function fingerprintOf2(msgs) {
    let h = 2166136261;
    const mix = (s) => {
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
    };
    mix(`n:${msgs.length};`);
    for (const m of msgs) mix(`${m.ts}|${m.isSender ? 1 : 0}|${m.text}
`);
    return { msgCount: msgs.length, contentHash: (h >>> 0).toString(36) };
  }
  function nowIso() {
    return (/* @__PURE__ */ new Date()).toISOString();
  }
  function errorMessage(e) {
    return e instanceof Error ? e.message : String(e);
  }
  function chunkedMessage(msgCount, batchCount, opts) {
    return `消息 ${msgCount} 条 → ${batchCount} 批（每批 ≤${opts.maxCount} 条 · ≤${opts.maxChars} 字），共 ${batchCount + 3} 次 AI 调用`;
  }
  function sampledMessage(msgCount, allCount, kept, spanFrom, spanTo) {
    return `消息 ${msgCount} 条 → ${allCount} 批超上限，均匀抽样 ${kept} 批（覆盖 ${spanFrom} ~ ${spanTo} 全时段，首尾必保，未抽中的批次不送 AI）`;
  }
  function batchMessage(i, total, c) {
    return `第 ${i}/${total} 批 · ${c.from} ~ ${c.to} · ${c.count} 条`;
  }
  function materialMessage(c) {
    return `素材采集完成：事件 ${c.events} · 原话 ${c.quotes} · 场景 ${c.moments} · 特质 ${c.traits} → 正在生成《其人》`;
  }
  function batchRetryMessage(i, total, attempt, maxRetries, err) {
    return `第 ${i + 1}/${total} 批失败（${err}）——正在重试 ${attempt}/${maxRetries}…`;
  }
  function batchFailMessage(i, total, done, err) {
    return `第 ${i + 1}/${total} 批提炼失败（已完成 ${done} 批保留，可从失败批续跑）`;
  }
  function snapshot() {
    if (!st) return { queue: [], currentIndex: -1, running: false };
    const currentIndex = st.queue.findIndex((j) => j.status === "running");
    const total = st.queue.length;
    const queue = st.queue.map((j, i) => ({
      ...JSON.parse(JSON.stringify(j)),
      batchesTotal: j.chunks.length,
      queueIndex: i + 1,
      queueTotal: total
    }));
    return { queue, currentIndex, running: currentIndex >= 0 };
  }
  function subscribe(fn) {
    subs.add(fn);
    if (st) fn(snapshot());
    return () => subs.delete(fn);
  }
  function emit() {
    const snap = snapshot();
    for (const fn of subs) {
      try {
        fn(snap);
      } catch (e) {
      }
    }
  }
  async function persist() {
    if (!st) return;
    try {
      await st.store.write({ version: 1, queue: st.queue });
    } catch (e) {
      console.warn("[people] 任务进度落盘失败:", e);
    }
  }
  function importRecordOf(t, digestMsgs) {
    var _a2;
    return {
      fileLabel: t.fileLabel,
      skippedCount: (_a2 = t.skippedCount) != null ? _a2 : 0,
      messageCount: digestMsgs.length,
      timeFrom: new Date(t.msgs[0].ts).toISOString(),
      timeTo: new Date(t.msgs[t.msgs.length - 1].ts).toISOString()
    };
  }
  function reusableJob(prev, fp, mode, opts) {
    if (prev.status === "done" || prev.batchesDone <= 0) return false;
    if (prev.msgCount !== fp.msgCount || prev.contentHash !== fp.contentHash) return false;
    if (prev.mode !== mode) return false;
    const po = { ...DEFAULTS, ...prev.chunkOpts };
    return po.maxChars === opts.maxChars && po.maxCount === opts.maxCount && po.maxBatches === opts.maxBatches;
  }
  var lockWired = false;
  function wireLock() {
    if (lockWired) return;
    lockWired = true;
    onDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
      if ((evt == null ? void 0 : evt.unlocked) === false) pauseJobs();
      else if ((evt == null ? void 0 : evt.unlocked) === true) kick();
    });
  }
  function runnable() {
    var _a2;
    return !!st && !st.pauseRequested && !!((_a2 = st.safe) == null ? void 0 : _a2.unlocked);
  }
  async function startJobs(app, targets, opts = {}) {
    var _a2, _b2, _c, _d, _e, _f;
    if (!st) {
      st = {
        app,
        store: new JobStore(app),
        safe: null,
        queue: [],
        injected: null,
        retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
        runningJob: null,
        pauseRequested: false
      };
    }
    st.app = app;
    st.store = new JobStore(app);
    st.safe = await getPeopleSafeStore();
    wireLock();
    if (!st.safe.unlocked) {
      return { queued: [], skipped: targets.map((t) => t.name || t.talker), resumed: [] };
    }
    st.injected = opts.askExtract || opts.askPortrait ? { askExtract: opts.askExtract, askPortrait: opts.askPortrait } : null;
    if (opts.maxRetries !== void 0) st.retry.maxRetries = opts.maxRetries;
    if (opts.sleep) st.retry.sleep = opts.sleep;
    const people = new PeopleStore(app);
    const entries = await people.list();
    const queued = [];
    const skipped = [];
    const resumed = [];
    const chunkFull = { ...DEFAULTS, ...opts.chunkOpts };
    for (const t of targets) {
      const label = t.name || t.talker;
      if (!t.msgs.length) {
        skipped.push(label);
        continue;
      }
      if (st.runningJob === t.talker) {
        skipped.push(label);
        continue;
      }
      const existing = entries.find((p) => p.id === t.talker);
      let effective;
      let digestMsgs;
      if (opts.mode === "full") {
        effective = "full";
        digestMsgs = t.msgs;
      } else {
        const plan = planIncremental(t.msgs, existing);
        if (plan.mode === "skip" || !plan.msgs.length) {
          skipped.push(label);
          continue;
        }
        effective = opts.mode === "incremental" ? "incremental" : plan.mode === "full" ? "full" : "incremental";
        digestMsgs = plan.msgs;
      }
      const all = chunkMessages(digestMsgs, { ...chunkFull, maxBatches: Number.MAX_SAFE_INTEGER });
      if (!all.length) {
        skipped.push(label);
        continue;
      }
      const sampled = all.length > chunkFull.maxBatches;
      const chunks = sampled ? evenlySample(all, chunkFull.maxBatches) : all;
      const fp = fingerprintOf2(t.msgs);
      const stats = computeStats(t.msgs, (_a2 = t.kindCounts) != null ? _a2 : {});
      const mediaNote = buildMediaNote({
        voiceCount: (_b2 = stats.voiceCount) != null ? _b2 : 0,
        voiceTotalSec: (_c = stats.voiceTotalSec) != null ? _c : 0,
        imageCount: (_d = stats.imageCount) != null ? _d : 0
      });
      const now = nowIso();
      const prev = st.queue.find((j) => j.talker === t.talker);
      st.queue = st.queue.filter((j) => j.talker !== t.talker);
      const importRecord = importRecordOf(t, digestMsgs);
      const noteMaterial = {
        mediaNote: mediaNote || void 0,
        statsNote: t.insights ? buildStatsNote(t.insights, t.monthly) || void 0 : void 0,
        // 手动档案段（issue 455）：入参优先，回落人物卡现有档案；排队时定稿（与 statsNote 同一语义）
        profileNote: buildProfileNote((_e = t.profile) != null ? _e : existing == null ? void 0 : existing.profile) || void 0
      };
      if (prev && reusableJob(prev, fp, effective, chunkFull)) {
        Object.assign(prev, {
          name: t.name,
          fileLabel: t.fileLabel,
          importRecord,
          stats,
          material: { ...(_f = prev.material) != null ? _f : { traits: [], moments: [] }, ...noteMaterial },
          message: `继续生成：已完成 ${prev.batchesDone}/${prev.chunks.length} 批`,
          status: "paused",
          error: void 0,
          updatedAt: now
        });
        st.queue.push(prev);
        queued.push(label);
        resumed.push(label);
        continue;
      }
      st.queue.push({
        talker: t.talker,
        name: t.name,
        mode: effective,
        fileLabel: t.fileLabel,
        status: "paused",
        // 排队待跑（与用户暂停同态：runner 按序拾起）
        stage: "chunked",
        msgCount: fp.msgCount,
        contentHash: fp.contentHash,
        chunkOpts: chunkFull,
        chunks: chunks.map(chunkMetaOf),
        batchesDone: 0,
        results: [],
        material: {
          traits: [],
          moments: [],
          ...noteMaterial
        },
        stats,
        importRecord,
        message: sampled ? sampledMessage(t.msgs.length, all.length, chunks.length, all[0].from, all[all.length - 1].to) : chunkedMessage(t.msgs.length, chunks.length, chunkFull),
        startedAt: now,
        updatedAt: now
      });
      queued.push(label);
    }
    if (queued.length) {
      await persist();
      emit();
    }
    kick();
    return { queued, skipped, resumed };
  }
  async function resumeJobs(app, ai = {}) {
    var _a2;
    if (st) {
      st.app = app;
      st.safe = (_a2 = st.safe) != null ? _a2 : await getPeopleSafeStore();
      return;
    }
    const safe = await getPeopleSafeStore();
    if (!safe.unlocked) return;
    const store2 = new JobStore(app);
    const data = await store2.read();
    const queue = Array.isArray(data == null ? void 0 : data.queue) ? data.queue : [];
    let dirty = false;
    for (const j of queue) {
      if (!j || typeof j !== "object") continue;
      if (!Array.isArray(j.results)) j.results = [];
      if (!Array.isArray(j.chunks)) j.chunks = [];
      const legacy = j.portrait;
      if (!j.person && typeof legacy === "string" && legacy) {
        j.person = legacy;
        dirty = true;
      }
      if (j.status === "running") {
        j.status = "interrupted";
        j.message = "上次未完成，可从断点继续";
        j.updatedAt = nowIso();
        dirty = true;
      }
    }
    st = {
      app,
      store: store2,
      safe,
      queue,
      injected: ai.askExtract || ai.askPortrait ? ai : null,
      retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
      runningJob: null,
      pauseRequested: false
    };
    wireLock();
    runPromise = null;
    if (dirty) await store2.write({ version: 1, queue });
    emit();
  }
  function resume(talker) {
    var _a2;
    if (!st || !((_a2 = st.safe) == null ? void 0 : _a2.unlocked)) return false;
    const job = st.queue.find((j) => j.talker === talker);
    if (!job) return false;
    if (job.status === "error" && job.error === DRIFT_ERROR) return false;
    if (job.status !== "paused" && job.status !== "interrupted" && job.status !== "error") return false;
    job.status = "paused";
    job.error = void 0;
    job.updatedAt = nowIso();
    void persist().then(emit);
    kick();
    return true;
  }
  function pauseJobs() {
    if (st) st.pauseRequested = true;
  }
  async function removeJob(talker) {
    if (!st) return false;
    const before = st.queue.length;
    st.queue = st.queue.filter((j) => j.talker !== talker);
    if (st.runningJob === talker) st.runningJob = null;
    if (st.queue.length < before) {
      await persist();
      emit();
      return true;
    }
    return false;
  }
  function whenIdle() {
    return runPromise != null ? runPromise : Promise.resolve();
  }
  function kick() {
    if (!st || runPromise) return runPromise != null ? runPromise : Promise.resolve();
    runPromise = runQueue().finally(() => {
      runPromise = null;
      if (st) st.pauseRequested = false;
    });
    return runPromise;
  }
  async function runQueue() {
    for (; ; ) {
      if (!st || !runnable()) break;
      const job = st.queue.find((j) => j.status === "paused");
      if (!job) break;
      await runJob(job);
    }
    if (st) st.pauseRequested = false;
  }
  function gone(job) {
    return !st || st.queue.indexOf(job) < 0;
  }
  async function runJob(job) {
    var _a2, _b2, _c, _d, _e;
    const asks = asksOf();
    st.runningJob = job.talker;
    job.status = "running";
    job.error = void 0;
    job.updatedAt = nowIso();
    await persist();
    emit();
    const finish = async (patch) => {
      Object.assign(job, patch, { updatedAt: nowIso() });
      await persist();
      emit();
    };
    try {
      const safe = st.safe;
      if (!(safe == null ? void 0 : safe.unlocked)) return;
      const contact = (_a2 = await safe.read(job.talker)) == null ? void 0 : _a2.store;
      if (gone(job)) return;
      const bucketMsgs = contact ? storeToUnified(contact.msgs) : [];
      const fp = fingerprintOf2(bucketMsgs);
      if (fp.msgCount !== job.msgCount || fp.contentHash !== job.contentHash) {
        await finish({ status: "error", error: DRIFT_ERROR, message: DRIFT_ERROR });
        return;
      }
      const existing = (await new PeopleStore(st.app).list()).find((p) => p.id === job.talker);
      if (gone(job)) return;
      let digestMsgs;
      if (job.mode === "full") {
        digestMsgs = bucketMsgs;
      } else {
        const plan = planIncremental(bucketMsgs, existing);
        if (plan.mode === "skip" || !plan.msgs.length) {
          await finish({ status: "error", error: "没有可提炼的新消息，请删除任务后重新生成", message: "没有可提炼的新消息" });
          return;
        }
        digestMsgs = plan.msgs;
      }
      const optsC = { ...DEFAULTS, ...job.chunkOpts };
      const all = chunkMessages(digestMsgs, { ...optsC, maxBatches: Number.MAX_SAFE_INTEGER });
      if (!all.length) {
        await finish({ status: "error", error: "没有可提炼的文本消息", message: "没有可提炼的文本消息" });
        return;
      }
      const sampled = all.length > optsC.maxBatches;
      const chunks = sampled ? evenlySample(all, optsC.maxBatches) : all;
      const metas = chunks.map(chunkMetaOf);
      if (job.chunks.length && JSON.stringify(job.chunks) !== JSON.stringify(metas)) {
        await finish({ status: "error", error: DRIFT_ERROR, message: DRIFT_ERROR });
        return;
      }
      job.chunks = metas;
      job.stage = "extracting";
      const total = chunks.length;
      for (let i = job.batchesDone; i < total; i++) {
        if (st.pauseRequested) {
          await finish({ status: "paused", message: `已暂停（${job.batchesDone}/${total} 批）` });
          return;
        }
        if (gone(job)) return;
        const c = chunks[i];
        job.message = batchMessage(i + 1, total, c);
        emit();
        let result;
        let attempt = 0;
        for (; ; ) {
          try {
            result = await extractBatch(asks.extract, c, job.name);
            break;
          } catch (e) {
            if (gone(job)) return;
            const err = errorMessage(e);
            if (isAbortError(e) || attempt >= st.retry.maxRetries) {
              await finish({ status: "error", error: err, message: batchFailMessage(i, total, job.batchesDone, err) });
              return;
            }
            attempt += 1;
            job.message = batchRetryMessage(i, total, attempt, st.retry.maxRetries, err);
            emit();
            await st.retry.sleep(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
            if (gone(job)) return;
            if (st.pauseRequested) {
              await finish({ status: "paused", message: `已暂停（${job.batchesDone}/${total} 批）` });
              return;
            }
          }
        }
        if (gone(job)) return;
        job.results.push(result);
        job.batchesDone = i + 1;
        await persist();
        emit();
      }
      let merged = mergeBatches(job.results);
      if (job.mode === "incremental") merged = mergeWithOld(merged, existing == null ? void 0 : existing.digest);
      if (gone(job)) return;
      const counts = {
        events: merged.events.length,
        quotes: merged.quotes.length,
        moments: merged.moments.length,
        traits: merged.traits.length
      };
      const material = toPortraitMaterial(merged, {
        mediaNote: (_b2 = job.material) == null ? void 0 : _b2.mediaNote,
        statsNote: (_c = job.material) == null ? void 0 : _c.statsNote,
        profileNote: (_d = job.material) == null ? void 0 : _d.profileNote,
        sampleEvents: job.mode === "incremental"
      });
      const sampleWarn = sampleWarnOf(job.msgCount);
      await finish({
        stage: "person",
        message: materialMessage(counts)
      });
      let person = "";
      try {
        person = (await asks.portrait(buildPersonPrompt(job.name, material, sampleWarn))).trim();
      } catch (e) {
        await finish({ status: "error", error: errorMessage(e), message: `《其人》生成失败：${errorMessage(e)}` });
        return;
      }
      if (gone(job)) return;
      if (!person) {
        await finish({ status: "error", error: "卷一《其人》生成为空", message: "卷一《其人》生成为空" });
        return;
      }
      job.person = person;
      job.updatedAt = nowIso();
      await persist();
      emit();
      await finish({ stage: "bond", message: "《其人》完成，正在生成《我们》…" });
      let bond = "";
      try {
        bond = (await asks.portrait(buildBondPrompt(job.name, material, sampleWarn))).trim();
      } catch (e) {
        await finish({ status: "error", error: errorMessage(e), message: `《我们》生成失败：${errorMessage(e)}` });
        return;
      }
      if (gone(job)) return;
      if (!bond) {
        await finish({ status: "error", error: "卷二《我们》生成为空", message: "卷二《我们》生成为空" });
        return;
      }
      job.bond = bond;
      job.updatedAt = nowIso();
      await persist();
      emit();
      await finish({ stage: "chronicle", message: "双卷完成，正在生成关系时间线…" });
      let chronicle = "";
      if (merged.events.length) {
        try {
          chronicle = (await asks.portrait(
            buildChroniclePrompt(job.name, evenlySample(merged.events, MATERIAL_LIMITS.chronicle), material.mediaNote, material.statsNote)
          )).trim();
        } catch (e) {
          chronicle = "";
        }
      }
      if (gone(job)) return;
      await finish({
        stage: "done",
        status: "done",
        chronicle,
        events: merged.events,
        quotes: material.quotes,
        material: {
          traits: material.traits,
          moments: material.moments,
          interests: material.interests,
          threads: material.threads,
          mediaNote: material.mediaNote,
          statsNote: material.statsNote,
          profileNote: material.profileNote
        },
        message: `「${job.name}」脸谱已生成`
      });
    } catch (e) {
      if (gone(job)) return;
      if (!((_e = st == null ? void 0 : st.safe) == null ? void 0 : _e.unlocked)) {
        await finish({ status: "paused", message: "保险库已上锁，任务已暂停（解锁后可继续）" });
        return;
      }
      await finish({ status: "error", error: errorMessage(e), message: `生成失败：${errorMessage(e)}` });
    } finally {
      if (st && st.runningJob === job.talker) st.runningJob = null;
    }
  }
  function asksOf() {
    var _a2, _b2, _c, _d, _e;
    if (((_a2 = st == null ? void 0 : st.injected) == null ? void 0 : _a2.askExtract) && st.injected.askPortrait) {
      return { extract: st.injected.askExtract, portrait: st.injected.askPortrait };
    }
    const ai = createAI();
    return {
      extract: (_c = (_b2 = st == null ? void 0 : st.injected) == null ? void 0 : _b2.askExtract) != null ? _c : (p) => ai.json(p),
      portrait: (_e = (_d = st == null ? void 0 : st.injected) == null ? void 0 : _d.askPortrait) != null ? _e : (p) => ai.chat(p)
    };
  }
  function __resetJobsForTests() {
    st = null;
    runPromise = null;
    subs.clear();
  }

  // src/people/types.ts
  function personOf(d) {
    var _a2, _b2;
    return (_b2 = (_a2 = d == null ? void 0 : d.person) != null ? _a2 : d == null ? void 0 : d.portrait) != null ? _b2 : "";
  }
  function bondOf(d) {
    var _a2;
    return (_a2 = d == null ? void 0 : d.bond) != null ? _a2 : "";
  }

  // src/people/migrate.ts
  init_data();
  init_storage();
  init_settings_provider();
  function legacyPaths() {
    const s = tryGetSettings();
    const base = s && s.storagePath || "CONFIG/STORAGE";
    return {
      people: storageFile("people.json", base),
      preview: storageFile("people-preview.json", base),
      jobs: storageFile("people-jobs.json", base)
    };
  }
  async function readLegacyJson(adapter, path) {
    try {
      if (!await adapter.exists(path)) return null;
      const raw = await adapter.read(path);
      if (!raw || !raw.trim()) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  var AVA_EXTS2 = ["jpg", "jpeg", "png", "webp", "gif"];
  function isVaultRelative(p) {
    const norm = String(p != null ? p : "").replace(/\\/g, "/");
    return Boolean(norm) && !/^[A-Za-z]:\//.test(norm) && !norm.startsWith("/");
  }
  function getFs2() {
    const w = globalThis.window;
    if (!w || !w.require) return null;
    try {
      return w.require("fs");
    } catch (e) {
      return null;
    }
  }
  async function readAvatarInput2(app, path) {
    var _a2;
    const p = String(path != null ? path : "").trim();
    if (!p) return null;
    try {
      if (isVaultRelative(p)) {
        const adapter = app.vault.adapter;
        if (!adapter) return null;
        for (const candidate of [p, ...AVA_EXTS2.map((e) => `${p.replace(/\.[^.]+$/, "")}.${e}`)]) {
          try {
            if (!await adapter.exists(candidate)) continue;
            const buf2 = await adapter.readBinary(candidate);
            const bytes = new Uint8Array(buf2);
            if (!bytes.length) continue;
            const ext2 = (candidate.split(".").pop() || "jpg").toLowerCase();
            return { base64: bytesToBase64(bytes), ext: ext2 };
          } catch (e) {
          }
        }
        return null;
      }
      const fs = getFs2();
      if (!fs || !fs.existsSync(p)) return null;
      const buf = fs.readFileSync(p);
      if (!buf || !buf.length) return null;
      const ext = String((_a2 = p.split(".").pop()) != null ? _a2 : "").toLowerCase();
      return AVA_EXTS2.includes(ext) ? { base64: bytesToBase64(buf), ext } : null;
    } catch (e) {
      return null;
    }
  }
  async function resolveLegacyAvatar(app, contact) {
    return readAvatarInput2(app, contact == null ? void 0 : contact.avatar);
  }
  async function migrateLegacyPeopleData(app, safe) {
    var _a2;
    if (!safe.unlocked) throw new Error("保险库未解锁，迁移不能执行");
    const adapter = app.vault.adapter;
    const paths = legacyPaths();
    const people = await readLegacyJson(adapter, paths.people);
    const preview = await readLegacyJson(adapter, paths.preview);
    const jobs2 = await readLegacyJson(adapter, paths.jobs);
    const cards = Array.isArray(people == null ? void 0 : people.people) ? people.people : [];
    const contacts = preview && preview.version === 2 && preview.contacts && typeof preview.contacts === "object" ? preview.contacts : {};
    const legacyJobs = Array.isArray(jobs2 == null ? void 0 : jobs2.queue) ? jobs2.queue : [];
    const talkers = /* @__PURE__ */ new Set();
    for (const c of cards) if (c == null ? void 0 : c.id) talkers.add(String(c.id));
    for (const name of Object.keys(contacts)) if (name) talkers.add(name);
    for (const j of legacyJobs) if (j == null ? void 0 : j.talker) talkers.add(String(j.talker));
    let migrated = 0;
    let skipped = 0;
    for (const talker of talkers) {
      if (safe.has(talker)) {
        skipped += 1;
        continue;
      }
      const card = cards.find((c) => String(c.id) === talker);
      const contact = contacts[talker];
      const jobList = legacyJobs.filter((j) => {
        var _a3;
        return String((_a3 = j == null ? void 0 : j.talker) != null ? _a3 : "") === talker;
      });
      const job = jobList.length ? jobList[jobList.length - 1] : null;
      const nowIso2 = (/* @__PURE__ */ new Date()).toISOString();
      const avatar = await resolveLegacyAvatar(app, contact != null ? contact : {});
      await safe.write(
        talker,
        (rec) => {
          rec.person = card != null ? card : { id: talker, name: talker, createdAt: nowIso2, imports: [] };
          if (contact) {
            const { avatar: _dropped, ...rest } = contact;
            rec.store = { ...rest };
          } else {
            rec.store = emptyStoreContact(nowIso2);
          }
          rec.job = job;
        },
        { avatar: avatar != null ? avatar : null }
      );
      migrated += 1;
    }
    const verifyFail = [];
    for (const talker of talkers) {
      try {
        const rec = await safe.read(talker);
        if (!rec) {
          verifyFail.push(talker);
          continue;
        }
        const expectedAvatar = Boolean((_a2 = contacts[talker]) == null ? void 0 : _a2.avatar);
        if (expectedAvatar && safe.attachmentCount(talker) === 0) verifyFail.push(talker);
      } catch (e) {
        verifyFail.push(talker);
      }
    }
    const cleaned = [];
    const keptBack = [];
    if (verifyFail.length === 0) {
      for (const path of [paths.people, paths.preview, paths.jobs]) {
        try {
          if (await adapter.exists(path)) {
            await adapter.remove(path);
            cleaned.push(path);
          }
        } catch (e) {
          keptBack.push(path);
        }
      }
    } else {
      keptBack.push(paths.people, paths.preview, paths.jobs);
    }
    return { migrated, skipped, cleaned, keptBack };
  }

  // src/core/external-tool.ts
  var BZ_LINE_PREFIX_RE = /^\[bz-(step|p|info|result)\]/;
  function parseBzLine(line) {
    const text2 = line.endsWith("\r") ? line.slice(0, -1) : line;
    const m = text2.match(BZ_LINE_PREFIX_RE);
    if (!m) {
      if (!text2.trim()) return null;
      return { kind: "raw", text: text2 };
    }
    const body = text2.slice(m[0].length).trim();
    switch (m[1]) {
      case "step":
        return body ? { kind: "step", text: body } : null;
      case "p": {
        const p = parseJsonObject(body);
        if (!p) return null;
        return {
          kind: "progress",
          phase: typeof p.phase === "string" ? p.phase : null,
          // pct 允许 null = 该阶段不可估；缺失/非有限数一律归 null（绝不假报）
          pct: Number.isFinite(p.pct) ? Number(p.pct) : null
        };
      }
      case "info": {
        const info = parseJsonObject(body);
        return info ? { kind: "info", data: info } : null;
      }
      default: {
        const r = parseJsonObject(body);
        return r ? { kind: "result", data: r } : null;
      }
    }
  }
  function parseJsonObject(body) {
    try {
      const v = JSON.parse(body);
      return v && typeof v === "object" && !Array.isArray(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  var MAX_LINE_BYTES = 1024 * 1024;
  var BzLineSplitter = class {
    constructor(maxLineBytes = MAX_LINE_BYTES) {
      this.maxLineBytes = maxLineBytes;
      this.parts = [];
      this.len = 0;
      this.overflowed = false;
    }
    /** 喂一段 stdout（Buffer 或 string），返回其中切出的完整行（不含行尾符） */
    push(chunk) {
      const buf = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
      const lines = [];
      let pos = 0;
      while (pos < buf.length) {
        const nl = buf.indexOf(10, pos);
        if (nl === -1) {
          this.accumulate(buf.subarray(pos));
          break;
        }
        this.accumulate(buf.subarray(pos, nl));
        lines.push(this.takeLine());
        pos = nl + 1;
      }
      return lines;
    }
    /** 进程终结时冲刷残留半行（无残留返回 null）——无尾换行的最后一行靠这里出列 */
    flush() {
      return this.len > 0 || this.overflowed ? this.takeLine() : null;
    }
    /** 累积字节；超出单行上限后丢弃后续字节（截断语义，待换行时一并出列） */
    accumulate(part) {
      if (this.overflowed) return;
      const room = this.maxLineBytes - this.len;
      if (part.length <= room) {
        this.parts.push(part);
        this.len += part.length;
      } else {
        this.parts.push(part.subarray(0, room));
        this.len = this.maxLineBytes;
        this.overflowed = true;
      }
    }
    /** 出列一行（overflow 时为截断行）；CRLF 的 \r 在此剥除 */
    takeLine() {
      const s = Buffer.concat(this.parts).toString("utf8");
      this.parts = [];
      this.len = 0;
      this.overflowed = false;
      return s.endsWith("\r") ? s.slice(0, -1) : s;
    }
  };
  var STDERR_TAIL_CHARS = 2048;
  function defaultChildProcess() {
    if (typeof window === "undefined") return null;
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("child_process");
    } catch (e) {
      return null;
    }
  }
  function runExternalTool(spec, cb, deps) {
    var _a2, _b2;
    const cp = deps && deps.cp ? deps.cp : defaultChildProcess();
    const splitter = new BzLineSplitter();
    let stderrTail = "";
    let settled = false;
    let stopped = false;
    let child = null;
    let resolveDone;
    const done = new Promise((r) => {
      resolveDone = r;
    });
    const settle = (o) => {
      if (settled) return;
      settled = true;
      resolveDone(o);
    };
    const collectStderr = (d) => {
      stderrTail += String(d);
      if (stderrTail.length > STDERR_TAIL_CHARS) stderrTail = stderrTail.slice(-STDERR_TAIL_CHARS);
    };
    const dispatchLine = (line) => {
      const ev = parseBzLine(line);
      if (!ev) return;
      switch (ev.kind) {
        case "step":
          cb.onStep(ev.text);
          break;
        case "progress":
          cb.onProgress(ev.phase, ev.pct);
          break;
        case "info":
          cb.onInfo(ev.data);
          break;
        case "result":
          cb.onResult(ev.data);
          break;
        case "raw":
          if (cb.onRaw) cb.onRaw(ev.text);
          break;
      }
    };
    if (!cp) {
      settle({ ok: false, stopped: false, code: null, stderr: "", error: new Error("仅桌面端可用：外部工具需要 Node.js 子进程") });
      return { stop: () => {
      }, done };
    }
    const spawnOpts = { shell: !!spec.shell, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] };
    if (spec.cwd) spawnOpts.cwd = spec.cwd;
    if (spec.env) spawnOpts.env = spec.env;
    try {
      child = cp.spawn(spec.cmd, spec.args || [], spawnOpts);
    } catch (e) {
      settle({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${(e == null ? void 0 : e.message) || String(e)}`) });
      return { stop: () => {
      }, done };
    }
    (_a2 = child.stdout) == null ? void 0 : _a2.on("data", (d) => {
      for (const line of splitter.push(d)) dispatchLine(line);
    });
    (_b2 = child.stderr) == null ? void 0 : _b2.on("data", collectStderr);
    child.on("error", (e) => {
      if (settled) return;
      settle({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${e.message}`) });
    });
    child.on("close", (code) => {
      if (settled) return;
      const rest = splitter.flush();
      if (rest !== null) dispatchLine(rest);
      const stderr = stderrTail.trim();
      if (stopped) {
        settle({ ok: false, stopped: true, code, stderr, error: null });
        return;
      }
      if (code === 0) {
        settle({ ok: true, stopped: false, code: 0, stderr, error: null });
        return;
      }
      const err = new Error(code === null ? `外部工具异常退出（无退出码）${stderr ? "：" + stderr : ""}` : `外部工具异常退出（退出码 ${code}）${stderr ? "：" + stderr : ""}`);
      err.stderr = stderr;
      settle({ ok: false, stopped: false, code, stderr, error: err });
    });
    return {
      stop: () => {
        var _a3;
        if (settled || stopped) return;
        stopped = true;
        try {
          (_a3 = child == null ? void 0 : child.kill) == null ? void 0 : _a3.call(child);
        } catch (e) {
        }
      },
      done
    };
  }

  // src/people/sync.ts
  init_notice();
  init_settings_provider();
  var BZ_FACE_INSTALL_HINT = "未找到 bz-face 命令——先安装脸谱工具包（@jwbz/obsidian-face）：在仓库 tools/obsidian-face 目录下运行 npm link，或 npm install -g <仓库>/tools/obsidian-face，装好后重试";
  var DOCTOR_HINT = "到终端运行 bz-face doctor 可自检环境";
  var PHASE_LABELS = {
    key: "取密钥",
    decrypt: "解密数据库",
    contacts: "导出聊天",
    avatar: "头像源"
  };
  function syncPhaseLabel(phase) {
    return phase && PHASE_LABELS[phase] || "";
  }
  function emptySyncStats() {
    return { contacts: 0, written: 0, unchanged: 0, skipped: 0, failed: 0, msgTotal: 0, named: 0, failures: [] };
  }
  function buildSyncSpec(opts) {
    var _a2, _b2;
    const src = ((_a2 = opts.src) == null ? void 0 : _a2.trim()) || void 0;
    const python = ((_b2 = opts.python) == null ? void 0 : _b2.trim()) || void 0;
    const q = (v) => process.platform === "win32" ? `"${v}"` : v;
    return {
      cmd: "bz-face",
      args: [
        "sync",
        "--data-root",
        q(opts.dataRoot),
        ...src ? ["--src", q(src)] : [],
        ...python ? ["--python", python] : []
      ],
      shell: true
    };
  }
  function collectContactInfo(stats, data) {
    if (data.phase !== "contact" || typeof data.name !== "string" || !data.name) return false;
    if (data.status === "ok") {
      stats.contacts++;
      if (data.chat === "unchanged") stats.unchanged++;
      else stats.written++;
      if (Number.isFinite(data.msgs)) stats.msgTotal += Number(data.msgs);
      if (Number.isFinite(data.named)) stats.named += Number(data.named);
      return true;
    }
    if (data.status === "skipped") {
      stats.skipped++;
      return true;
    }
    if (data.status === "failed") {
      stats.failed++;
      stats.failures.push({ name: data.name, error: typeof data.error === "string" ? data.error : "导出失败" });
      return true;
    }
    return false;
  }
  function statsFromResult(result, live2) {
    const num = (v, fallback) => Number.isFinite(v) ? Number(v) : fallback;
    const failures = Array.isArray(result.failures) ? result.failures.map((f) => {
      const o = f;
      if (!o || typeof o.name !== "string") return null;
      return { name: o.name, error: typeof o.error === "string" ? o.error : "导出失败" };
    }).filter((f) => f !== null) : live2.failures;
    const written = num(result.written, live2.written);
    const unchanged = num(result.unchanged, live2.unchanged);
    return {
      contacts: num(result.contacts, written + unchanged),
      written,
      unchanged,
      skipped: num(result.skipped, live2.skipped),
      failed: num(result.failed, live2.failed),
      msgTotal: num(result.msgTotal, live2.msgTotal),
      named: num(result.named, live2.named),
      failures
    };
  }
  function describeSyncStats(st2) {
    const parts = [`更新 ${st2.written} 位`, `未变 ${st2.unchanged} 位`, `跳过 ${st2.skipped} 位`];
    if (st2.failed > 0) parts.push(`${st2.failed} 位失败`);
    return `同步完成：${parts.join(" · ")}，消息 ${st2.msgTotal} 条`;
  }
  function firstLine(text2, max = 200) {
    const line = String(text2 || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
    return line.length > max ? line.slice(0, max) + "…" : line;
  }
  function classifySyncFailure(outcome) {
    var _a2, _b2;
    const msg = (_b2 = (_a2 = outcome.error) == null ? void 0 : _a2.message) != null ? _b2 : "";
    if (/ENOENT/.test(msg)) return { message: "未找到 bz-face 命令", hint: BZ_FACE_INSTALL_HINT };
    if (/EACCES|权限/.test(msg)) return { message: "bz-face 命令没有执行权限", hint: "检查命令权限，或重新 link 后重试" };
    const stderr = outcome.stderr || "";
    if (/ModuleNotFoundError|ImportError/.test(stderr) || /ModuleNotFoundError|ImportError/.test(msg)) {
      return { message: "Python 缺少同步依赖", hint: `${DOCTOR_HINT}，按提示安装缺的依赖后重试` };
    }
    if (/微信/.test(msg)) return { message: firstLine(msg), hint: "" };
    return {
      message: firstLine(msg || "同步进程异常退出，没有给出原因"),
      hint: /bz-face|doctor|pip|npm/.test(msg) ? "" : DOCTOR_HINT
    };
  }
  var state = {
    outcome: "idle",
    phase: null,
    pct: null,
    step: "",
    message: "",
    hint: "",
    stats: emptySyncStats()
  };
  var handle = null;
  var listeners = /* @__PURE__ */ new Set();
  function setState(patch) {
    state = { ...state, ...patch };
    for (const fn of [...listeners]) fn(state);
  }
  function syncState() {
    return state;
  }
  function isSyncing() {
    return state.outcome === "running";
  }
  function subscribeSync(fn) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }
  var runner = runExternalTool;
  function nonEmpty(v) {
    const t = typeof v === "string" ? v.trim() : "";
    return t || void 0;
  }
  function emitNotice(s) {
    if (s.outcome === "ok") {
      if (s.stats.failed > 0) {
        const names = s.stats.failures.slice(0, 3).map((f) => f.name).join("、");
        notice(`同步完成，${s.stats.failed} 位联系人失败${names ? `（${names}${s.stats.failures.length > 3 ? "等" : ""}）` : ""}——重跑同步只补失败项`, "warning");
      } else {
        notice(`同步完成：更新 ${s.stats.written} 位、未变 ${s.stats.unchanged} 位联系人`, "success");
      }
      return;
    }
    if (s.outcome === "error") notice(`同步失败：${firstLine(s.message)}`, "error");
    if (s.outcome === "stopped") notice("同步已停止——已导出的部分保留，重跑可续传", "info");
  }
  function startSync() {
    var _a2;
    if (state.outcome === "running") return;
    const s = tryGetSettings();
    const dataRoot = String((_a2 = s == null ? void 0 : s.peopleDataDir) != null ? _a2 : "").trim();
    if (!dataRoot) {
      setState({
        outcome: "error",
        phase: null,
        pct: null,
        step: "",
        message: "先在下方配置数据根目录——同步会把微信数据解密导出到那里",
        hint: "到「设置 → 脸谱 → 数据源」粘贴数据根目录路径，再点同步",
        stats: emptySyncStats()
      });
      return;
    }
    const spec = buildSyncSpec({
      dataRoot,
      src: nonEmpty(s == null ? void 0 : s.peopleWxAccountDir),
      python: nonEmpty(s == null ? void 0 : s.pythonPath)
    });
    const live2 = emptySyncStats();
    let result = null;
    const cbs = {
      onStep: (text2) => setState({ step: text2 }),
      onProgress: (phase, pct) => setState({ phase, pct }),
      onInfo: (data) => {
        if (collectContactInfo(live2, data)) setState({});
      },
      onResult: (data) => {
        result = data;
      }
    };
    handle = runner(spec, cbs);
    setState({ outcome: "running", phase: null, pct: null, step: "", message: "", hint: "", stats: live2 });
    void handle.done.then((outcome) => {
      handle = null;
      finishSync(outcome, result);
    });
  }
  function finishSync(outcome, result) {
    if (outcome.stopped) {
      setState({
        outcome: "stopped",
        pct: null,
        message: "已停止",
        hint: "点「同步」重跑续传——已导出的部分不会重复搬"
      });
      emitNotice(state);
      return;
    }
    if (result && result.ok === false) {
      const msg = typeof result.error === "string" && String(result.error).trim() ? String(result.error).trim() : "同步失败：工具报错，没有给出原因";
      setState({ outcome: "error", phase: null, pct: null, message: firstLine(msg), hint: /微信|数据根/.test(msg) ? "" : DOCTOR_HINT });
      emitNotice(state);
      return;
    }
    if (outcome.ok && result && result.ok === true) {
      const st2 = statsFromResult(result, state.stats);
      setState({ outcome: "ok", phase: null, pct: 100, step: "", message: describeSyncStats(st2), hint: "", stats: st2 });
      emitNotice(state);
      return;
    }
    const classified = classifySyncFailure(outcome);
    setState({ outcome: "error", phase: null, pct: null, message: classified.message, hint: classified.hint });
    emitNotice(state);
  }
  function stopSync() {
    handle == null ? void 0 : handle.stop();
  }

  // src/people/render.ts
  var AVATAR_COLORS = ["#b5534a", "#5a8f6d", "#4a7d9e", "#8a6bb0", "#b08a3e", "#7a8b4a", "#a05d7a", "#5f6b7a"];
  function el(tag, cls, arg, ...rest) {
    const flat = (ns) => ns.flatMap((n) => Array.isArray(n) ? n : [n]);
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (arg === void 0) {
      for (const c of flat(rest)) node.appendChild(c);
    } else if (Array.isArray(arg)) {
      for (const c of flat([...arg, ...rest])) node.appendChild(c);
    } else if (arg instanceof Node) {
      node.appendChild(arg);
      for (const c of flat(rest)) node.appendChild(c);
    } else {
      for (const [k, v] of Object.entries(arg)) node.setAttribute(k, v);
      for (const c of flat(rest)) node.appendChild(c);
    }
    return node;
  }
  function text(s) {
    return document.createTextNode(s);
  }
  function textEl(tag, s) {
    const node = document.createElement(tag);
    node.textContent = s;
    return node;
  }
  function button(cls, label, attrs) {
    const b = el("button", cls, attrs);
    b.type = "button";
    b.textContent = label;
    return b;
  }
  function initials(name) {
    const s = name.trim();
    return s ? [...s][0] : "?";
  }
  function avatarColor(name) {
    let h = 0;
    for (const ch of name) h = h * 31 + ch.codePointAt(0) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function formatDay(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function formatCount(n) {
    if (n >= 1e4) return `${(n / 1e4).toFixed(n % 1e4 >= 100 ? 1 : 0)} 万`;
    return n.toLocaleString("en-US");
  }
  function replyLatencySec(median, avg) {
    var _a2;
    return (_a2 = median != null ? median : avg) != null ? _a2 : 0;
  }
  function vtName(name) {
    const s = String(name != null ? name : "").trim();
    return [...s].length <= 7 ? s : `${[...s].slice(0, 6).join("")}…`;
  }
  function mediaLabel(s) {
    if (!s) return "";
    const parts = [];
    if (s.voiceCount > 0) {
      parts.push(`语音 ${s.voiceCount} 条`);
      if (s.voiceTotalSec > 0) parts.push(formatDuration2(s.voiceTotalSec));
    }
    if (s.imageCount > 0) parts.push(`图片 ${s.imageCount} 张`);
    return parts.join(" · ");
  }
  function formatDuration2(sec) {
    if (sec < 60) return `${Math.round(sec)} 秒`;
    if (sec < 3600) return `${Math.round(sec / 60)} 分`;
    return `${(sec / 3600).toFixed(1)} 时`;
  }
  function localResourceUri(path) {
    var _a2, _b2;
    const norm = path.replace(/\\/g, "/");
    const escape = (s) => s.replace(/#/g, "%23").replace(/\?/g, "%3F");
    if (typeof window !== "undefined") {
      const base = window.BZW_MEDIA_BASE;
      if (base) return base + escape(encodeURI(norm));
      const w = window;
      const adapter = (_b2 = (_a2 = w.app) == null ? void 0 : _a2.vault) == null ? void 0 : _b2.adapter;
      const res = adapter == null ? void 0 : adapter.getResourcePath;
      if (adapter && res && !/^[A-Za-z]:/.test(norm) && !/^(https?:)?\/\//.test(norm) && !norm.startsWith("/")) {
        try {
          return res.call(adapter, norm);
        } catch (e) {
        }
      }
    }
    if (/^(https?:)?\/\//.test(norm) || norm.startsWith("/")) return norm;
    const rel = norm.replace(/^[A-Za-z]:/, "").replace(/^\/+/, "");
    return `app://local/${escape(encodeURI(rel))}`;
  }
  function avatarUri(a) {
    return a.startsWith("data:") ? a : localResourceUri(a);
  }
  function iconButton(icon, cls, attrs) {
    const b = el("button", cls, attrs);
    b.type = "button";
    b.appendChild(el("i", "bz-ic", { "data-lucide": icon, "aria-hidden": "true" }));
    return b;
  }
  function panelShell() {
    return el("div", "bz-people-panel", [
      el("div", "bz-people-head", [
        el("div", "bz-people-brand", [
          el("div", "bz-people-mark", { "aria-hidden": "true" }, el("i", "bz-ic", { "data-lucide": "smile" })),
          el("div", "bz-people-brand-text", [
            el("h1", "bz-people-title", text("脸谱")),
            el("div", "bz-people-sub", text("人物消息脸谱"))
          ])
        ]),
        el("div", "bz-people-head-actions", [
          iconButton("database", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-ds-open": "", "aria-label": "数据源", title: "数据源" })
        ])
      ]),
      el("div", "bz-people-stats", { "data-people-stats": "" }),
      el("div", "bz-people-jobs-slot", { "data-people-jobs-slot": "", hidden: "" }),
      el("div", "bz-people-body", { "data-people-body": "" }),
      el("div", "bz-people-ds-layer", { "data-people-ds-layer": "", hidden: "" }),
      el("div", "bz-people-pop-layer", { "data-people-pop-layer": "", hidden: "" })
    ]);
  }
  function jobsPercent(batchesDone, batchesTotal, stagesDone) {
    const denom = (batchesTotal > 0 ? batchesTotal : 0) + 3;
    const numer = Math.max(0, batchesDone || 0) + Math.max(0, stagesDone || 0);
    return Math.min(100, Math.round(numer / denom * 100));
  }
  function jobsStagesDone(stage2, status) {
    if (status === "done") return 3;
    if (stage2 === "chronicle") return 2;
    if (stage2 === "bond") return 1;
    return 0;
  }
  var JOBS_ACTIONS = {
    running: { label: "暂停", hook: "data-people-jobs-pause" },
    paused: { label: "继续生成", hook: "data-people-jobs-resume" },
    interrupted: { label: "继续生成", hook: "data-people-jobs-resume" },
    // issue 453：error 也出「继续生成」——451 已放宽 resume 接受 error（从 batchesDone 续跑）。
    // 450 时这里只有「删除任务」，把用户逼到别的入口（详情头 / 数据源弹窗）去「重新画」，那才是重烧。
    error: { label: "继续生成", hook: "data-people-jobs-resume" },
    done: null
  };
  function jobsActionOf(s) {
    if (s.status === "error" && s.resumable === false) return { label: "删除任务", hook: "data-people-jobs-dismiss" };
    return JOBS_ACTIONS[s.status];
  }
  function progressBlock(s) {
    const pct = jobsPercent(s.batchesDone, s.batchesTotal, s.stagesDone);
    const block = el("div", "bz-people-jobs", {
      "data-people-jobs": "",
      "data-people-jobs-talker": s.talker,
      role: "status"
    });
    block.appendChild(el("div", "bz-people-jobs-meter", [
      el(
        "div",
        "bz-people-jobs-bar",
        { "aria-hidden": "true" },
        el("div", "bz-people-jobs-fill", { style: `width:${pct}%` })
      ),
      el("span", "bz-people-jobs-pct", text(`${pct}%`))
    ]));
    const next = Math.min(s.batchesDone + 1, s.batchesTotal);
    const main = s.status === "error" ? `生成失败 · 已完成 ${s.batchesDone}/${s.batchesTotal} 批` : s.status === "paused" ? "已暂停" : s.status === "interrupted" ? "上次生成中断了" : s.status === "done" ? "脸谱已生成" : `正在生成 · 第 ${next}/${s.batchesTotal} 批`;
    block.appendChild(el("div", "bz-people-jobs-main", text(main)));
    const action = jobsActionOf(s);
    const foot = [];
    if (s.status === "error" && s.errorText) foot.push(el("span", "bz-people-jobs-err", text(s.errorText)));
    if (action) foot.push(button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", action.label, { [action.hook]: "" }));
    if (foot.length) block.appendChild(el("div", "bz-people-jobs-foot", foot));
    return block;
  }
  function statsText(people) {
    const total = people.reduce((s, p) => s + p.imports.reduce((x, r) => x + r.messageCount, 0), 0);
    const faces = people.filter((p) => p.digest).length;
    return people.length ? `${people.length} 位人物 · ${formatCount(total)} 条消息 · ${faces} 张脸谱` : "还没有人物";
  }
  function mergeBar(fromName, toName) {
    return toName ? el("div", "bz-people-merge-bar", [
      el("div", "bz-people-merge-text", text(`确认合并：把「${fromName}」的导入记录与随手记并到「${toName}」，「${fromName}」将被删除；对方的脸谱不带入，合并后建议重画。`)),
      button("bz-people-btn bz-people-btn-acc", "确认合并", { "data-people-merge-confirm": "" }),
      button("bz-people-btn bz-people-btn-ghost", "取消", { "data-people-merge-cancel": "" })
    ]) : el("div", "bz-people-merge-bar", [
      el("div", "bz-people-merge-text", text(`合并重复人物：点选一张折子，把「${fromName}」的导入记录与随手记并过去——对方保留，「${fromName}」这本将删除。`)),
      button("bz-people-btn bz-people-btn-ghost", "取消合并", { "data-people-merge-cancel": "" })
    ]);
  }
  function foldSeal(p, job) {
    const name = p.name || p.id;
    if (job && job.status !== "done") {
      const prog = job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal} 批` : "尚未切批";
      if (job.status === "running") {
        const pct = jobsPercent(job.batchesDone, job.batchesTotal, job.stagesDone);
        return {
          state: "running",
          text: `画谱中
${pct}%`,
          title: `正在生成「${name}」的脸谱（${prog}）——点这里在本批做完后暂停`,
          action: { kind: "pause", label: "暂停" }
        };
      }
      if (job.status === "error" && !job.resumable) {
        return {
          state: "halted",
          text: "画谱中断",
          title: `「${name}」上次生成中断且接不上（消息集已变）——点这里重新生成`,
          action: { kind: "redraw", label: "重新生成" }
        };
      }
      return {
        state: "halted",
        text: `画谱中断
${job.batchesTotal ? `${job.batchesDone}/${job.batchesTotal}` : "待续"}`,
        title: `「${name}」${job.status === "error" ? "上次生成失败" : "上次没画完"}（${prog}）——点这里从断点继续，已画完的批次不重画`,
        action: { kind: "resume", label: "继续生成" }
      };
    }
    if (p.digest) {
      return {
        state: "done",
        text: p.lastProcessedTs ? `画到
${formatDay(p.lastProcessedTs).slice(2)}` : "已画",
        title: `「${name}」的脸谱已画到这天——点这里用新导入的消息补画（没有新消息会跳过）`,
        action: { kind: "redraw", label: "补画" }
      };
    }
    return {
      state: "todo",
      text: "待画",
      title: `「${name}」还没有脸谱——点这里用已导入的消息画一张`,
      action: { kind: "draw", label: "画脸谱" }
    };
  }
  function foldSealNode(p, job) {
    const seal = foldSeal(p, job);
    const b = el("button", `bz-people-seal bz-people-seal-${seal.state}`, {
      "data-people-seal-act": seal.action.kind,
      "aria-label": `${seal.action.label}：${p.name || p.id}`,
      title: seal.title
    });
    b.type = "button";
    b.textContent = seal.text;
    return b;
  }
  function foldAvaNode(p, seal, avatar) {
    const b = el("button", `bz-people-seal bz-people-seal-${seal.state} bz-people-fold-ava`, {
      "data-people-seal-act": seal.action.kind,
      "aria-label": `${seal.action.label}：${p.name || p.id}`,
      title: seal.title
    });
    b.type = "button";
    b.appendChild(el("img", "", { src: avatarUri(avatar), alt: p.name }));
    return b;
  }
  function foldCard(p, opts) {
    var _a2, _b2, _c, _d, _e;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const from = p.imports.map((r) => r.timeFrom).sort()[0];
    const to = p.imports.map((r) => r.timeTo).sort().pop();
    const span = from && to ? `${from.slice(0, 7)} ~ ${to.slice(0, 7)}` : "";
    const rel = (_c = ((_b2 = (_a2 = p.profile) == null ? void 0 : _a2.tags) != null ? _b2 : []).filter(Boolean)[0]) != null ? _c : "";
    const label = mediaLabel(opts.media);
    const seal = foldSeal(p, (_d = opts.job) != null ? _d : null);
    const card = el("div", "bz-people-fold", [
      el("div", "bz-people-fold-inner", [
        opts.avatar ? foldAvaNode(p, seal, opts.avatar) : foldSealNode(p, (_e = opts.job) != null ? _e : null),
        el("div", "bz-people-fold-title vt", { title: p.name }, text(vtName(p.name))),
        // 无关系、无跨度时不再兜底「N 条」——meta 行已有同一数字，卡面重复（448 评审 P2）
        el("div", "bz-people-fold-who", text(rel || (span ? span : "新折"))),
        el("div", "bz-people-fold-meta", text([
          total ? `${formatCount(total)} 条` : "尚无消息",
          label,
          seal.state === "done" && p.lastProcessedTs ? `画到 ${formatDay(p.lastProcessedTs).slice(2)}` : ""
        ].filter(Boolean).join(" · ")))
      ])
    ]);
    if (opts.mergeFrom) card.classList.add("bz-people-fold-merge-src");
    else if (opts.mergePick) card.classList.add("bz-people-fold-merge-pick");
    card.setAttribute("data-people-card", p.id);
    return card;
  }
  function foldWall() {
    return el("div", "bz-people-wall", { "data-people-wall": "" });
  }
  function wallEmpty() {
    return el("div", "bz-people-empty", [
      el("div", "bz-people-empty-mark", { "aria-hidden": "true" }, el("i", "bz-ic", { "data-lucide": "smile" })),
      el("div", "bz-people-empty-title", text("还没有脸谱")),
      el("div", "bz-people-empty-hint", text("打开「数据源」勾选联系人导入预览，再点「画脸谱」——AI 会为对方修一册脸谱：画像、性格、共同回忆。聊天原文只在本机提炼，不落盘。")),
      button("bz-people-btn bz-people-btn-acc", "打开数据源", { "data-people-ds-open": "" })
    ]);
  }
  var FOLD_TITLES = [
    ["p", "其人", "卷一 · 人物画像与代表原话"],
    ["b", "相交", "卷二 · 关系画像"],
    ["e", "纪事", "关系时间线（编年）+ 交往事件（按月）"]
  ];
  function foldDetailHead(p, media, opts) {
    var _a2, _b2;
    const total = p.imports.reduce((s, r) => s + r.messageCount, 0);
    const job = opts.job && opts.job.status !== "done" ? opts.job : null;
    const action = job ? iconButton("refresh-cw", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", {
      "data-people-generate-one": "",
      "aria-label": job.status === "running" ? "正在生成" : "继续生成",
      title: job.status === "running" ? `正在生成「${p.name}」的脸谱（${job.batchesDone}/${job.batchesTotal} 批）——进度看面板顶部` : `继续生成（已完成 ${job.batchesDone}/${job.batchesTotal} 批，不会从头重烧）`
    }) : opts.canGenerate ? iconButton("paintbrush", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-generate-one": "", "aria-label": "画脸谱", title: "画脸谱（用已导入的消息生成）" }) : null;
    const tags = ((_b2 = (_a2 = p.profile) == null ? void 0 : _a2.tags) != null ? _b2 : []).filter(Boolean).slice(0, 3);
    const meta = el("div", "bz-people-card-meta");
    if (total) {
      meta.appendChild(textEl("b", formatCount(total)));
      meta.appendChild(text(` 条消息 · ${p.imports.length} 次导入`));
      if (p.digest) meta.appendChild(text(` · 脸谱生成于 ${p.digest.generatedAt.slice(0, 10)}`));
    } else meta.appendChild(text("尚无导入"));
    const id = el("div", "bz-people-dt-id", [
      el("div", "bz-people-dt-name", [
        text(p.name),
        ...tags.length ? [el("span", "bz-people-dt-tags", tags.map((t) => el("span", "bz-people-dt-tag", [text(t)])))] : []
      ]),
      meta
    ]);
    return el("div", "bz-people-dt-head", [
      opts.avatar ? el("img", "bz-people-dt-avatar", { src: avatarUri(opts.avatar), alt: p.name }) : el("div", "bz-people-dt-seal", { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
      id,
      el("div", "bz-people-dt-actions", [
        ...action ? [action] : [],
        // 455 评审：记一笔自纪事折抽出，独立弹窗，入口在互动统计之前
        iconButton("pencil", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-note-open": "", "aria-label": "记一笔", title: "记一笔" }),
        // issue 455：数据统计 / 补充背景两页折改独立弹窗，入口收进详情头工具条（返回钮在前、DOM 序居其左）
        iconButton("bar-chart-3", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-stats-open": "", "aria-label": "互动统计", title: "互动统计" }),
        iconButton("contact", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-prof-open": "", "aria-label": "补充背景", title: "补充背景" }),
        iconButton("arrow-left", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-back-btn": "", "aria-label": "返回列表", title: "返回列表" })
      ])
    ]);
  }
  function foldBook(p, opts, bodies) {
    var _a2;
    const book = el("div", "bz-people-book", { "data-people-book": "" });
    for (const [id, title] of FOLD_TITLES) {
      const on = opts.fold === id;
      const leaf = el("div", `bz-people-leaf${on ? " bz-people-leaf-on" : ""}`, on ? { "data-people-leaf": id } : { "data-people-leaf": id, "data-people-leaf-head": id });
      leaf.appendChild(el("div", "bz-people-leaf-spine", { "aria-hidden": "true" }));
      leaf.appendChild(el("div", "bz-people-leaf-head", [
        el("span", "bz-people-leaf-zh", text(title))
      ]));
      if (on) {
        const body = el("div", "bz-people-leaf-body");
        for (const node of (_a2 = bodies[id]) != null ? _a2 : []) body.appendChild(node);
        leaf.appendChild(body);
      }
      book.appendChild(leaf);
    }
    return book;
  }
  function profileFilled(prof) {
    var _a2, _b2, _c, _d, _e, _f;
    if (!prof) return false;
    return Boolean(
      prof.socials && prof.socials.length || prof.tags && prof.tags.length || ((_a2 = prof.birthday) != null ? _a2 : "").trim() || ((_b2 = prof.metVia) != null ? _b2 : "").trim() || ((_c = prof.metAt) != null ? _c : "").trim() || ((_d = prof.hometown) != null ? _d : "").trim() || ((_e = prof.job) != null ? _e : "").trim() || ((_f = prof.note) != null ? _f : "").trim()
    );
  }
  function foldHint(msg, action) {
    const d = el("div", "bz-people-empty-hint");
    d.appendChild(text(msg));
    if (action) {
      d.appendChild(el("br"));
      d.appendChild(button("bz-people-btn bz-people-btn-ghost", action, { "data-people-ds-open": "" }));
    }
    return d;
  }
  function foldPersonBody(mdRoot, p) {
    var _a2, _b2;
    const out = mdRoot ? [mdRoot] : [foldHint("还没有其人画像。从数据源导入一次即可生成。", "打开数据源")];
    if ((_b2 = (_a2 = p.digest) == null ? void 0 : _a2.quotes) == null ? void 0 : _b2.length) {
      out.push(el("div", "bz-people-section-title", text("代表原话")));
      const quotes = el("div", "bz-people-quotes");
      for (const q of p.digest.quotes) {
        quotes.appendChild(el("div", "bz-people-quote", [
          el("div", "bz-people-quote-text", text(`「${q.text}」`)),
          el("div", "bz-people-quote-meta", text(`${q.who === "我" ? "我" : p.name} · ${q.ts}`))
        ]));
      }
      out.push(quotes);
    }
    return out;
  }
  function foldBondBody(mdRoot) {
    return mdRoot ? [mdRoot] : [foldHint("还没有关系画像。从数据源导入一次即可生成。", "打开数据源")];
  }
  function foldEventsBody(p) {
    var _a2, _b2, _c;
    const out = [];
    if ((_a2 = p.digest) == null ? void 0 : _a2.chronicle) {
      out.push(el("div", "bz-people-chronicle", [miniMarkdown(p.digest.chronicle)]));
      out.push(el("div", "bz-people-ev-divider", [el("span", "", [text("纪事 · 按月")])]));
    }
    if ((_b2 = p.digest) == null ? void 0 : _b2.events.length) {
      const byMonth = /* @__PURE__ */ new Map();
      for (const ev of p.digest.events) {
        const month = ev.ts.slice(0, 7);
        const list = byMonth.get(month);
        if (list) list.push(ev);
        else byMonth.set(month, [ev]);
      }
      const months2 = el("div", "bz-people-ev-months");
      for (const [month, evs2] of [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        evs2.sort((a, b) => (a.kind === "major" ? 0 : 1) - (b.kind === "major" ? 0 : 1));
        const group = el("div", "bz-people-ev-mon");
        group.appendChild(el("button", "bz-people-ev-mon-head", { "data-people-ev-mon": "", "aria-label": `展开 ${month}` }, [
          el("span", "bz-people-ev-mon-plus", text("+")),
          el("span", "bz-people-ev-mon-name", text(month)),
          el("span", "bz-people-ev-mon-cnt", text(`${evs2.length} 条`))
        ]));
        const body = el("div", "bz-people-ev-mon-body");
        for (const ev of evs2) {
          body.appendChild(el("div", `bz-people-event${ev.kind === "major" ? " bz-people-event-major" : ""}`, [
            el("span", "bz-people-event-ts", text(ev.ts)),
            el("span", "bz-people-event-dot"),
            el("span", "bz-people-event-summary", text(ev.summary))
          ]));
        }
        group.appendChild(body);
        months2.appendChild(group);
      }
      out.push(months2);
    } else if (!out.length) {
      out.push(el("div", "bz-people-empty-hint", text("还没有交往纪事。导入聊天生成脸谱后会提炼出来。")));
    }
    const evs = (_c = p.manualEvents) != null ? _c : [];
    if (evs.length) {
      out.push(el("div", "bz-people-section-title", text("随手记")));
      const list = el("div", "bz-people-notes");
      for (const ev of evs) {
        list.appendChild(el("div", "bz-people-note", [
          el("span", "bz-people-note-ts", text(ev.ts)),
          el("span", "bz-people-note-summary", text(ev.summary)),
          button("bz-people-btn bz-people-btn-ghost bz-people-note-del", "删", { "data-people-ev-del": ev.id })
        ]));
      }
      out.push(list);
    }
    return out;
  }
  function statsPopBody(card, p) {
    const out = [];
    if (card) out.push(card);
    else if (p.imports.length) {
      const poolOnly = p.imports.some((r) => {
        var _a2;
        return r.stats && !((_a2 = r.stats.monthly) == null ? void 0 : _a2.length);
      });
      out.push(el("div", "bz-people-empty-hint", { "data-people-data-hint": "" }, text(poolOnly ? "这些消息还没画过脸谱——画完脸谱后这里会有完整的互动统计（月度分布 / 回复时延 / 活跃时段）。" : "这次导入还没有互动统计（旧版数据）。从数据源再导入一次即可生成。")));
    } else out.push(el("div", "bz-people-empty-hint", { "data-people-data-hint": "" }, text("还没有导入记录。")));
    return out;
  }
  function insightsCard(range, file, chart, rows) {
    const card = el("div", "bz-people-insights", [
      el("div", "bz-people-ins-head", [
        el("div", "bz-people-ins-range", text(range)),
        el("div", "bz-people-ins-file", text(file))
      ])
    ]);
    if (chart) card.appendChild(chart);
    card.appendChild(rows);
    return card;
  }
  function monthlyChart(monthly) {
    if (!monthly.length) return null;
    const max = monthly.reduce((a, [, n]) => Math.max(a, n), 0);
    const wrap = el("div", "bz-people-chart-wrap");
    const chart = el("div", "bz-people-chart");
    for (const [month, n] of monthly) {
      const h = max > 0 ? Math.max(Math.round(n / max * 100), 4) : 0;
      chart.appendChild(el(
        "div",
        "bz-people-col",
        { title: `${month} · ${n} 条` },
        el("div", "bz-people-col-bar", { style: `height:${h}%` })
      ));
    }
    wrap.appendChild(chart);
    const labels = el("div", "bz-people-chart-labels");
    const step = monthly.length <= 8 ? 1 : Math.ceil(monthly.length / 6);
    monthly.forEach(([month], i) => {
      const show = i === 0 || i === monthly.length - 1 || i % step === 0;
      labels.appendChild(el("span", "", text(show ? month.slice(2) : "")));
    });
    wrap.appendChild(labels);
    return wrap;
  }
  function duoBar(mePct, otherPct) {
    return el("div", "bz-people-duo", [
      mePct > 0 ? el("div", "bz-people-duo-me", { style: `width:${mePct}%` }) : el("div", "bz-people-duo-me"),
      otherPct > 0 ? el("div", "bz-people-duo-other", { style: `width:${otherPct}%` }) : el("div", "bz-people-duo-other")
    ]);
  }
  function kindChips(kinds) {
    const total = kinds.reduce((a, [, n]) => a + n, 0);
    return el("div", "bz-people-kinds", kinds.map(([k, n]) => el("span", "bz-people-kind", text(`${k} ${formatCount(n)} · ${Math.round(n / total * 100)}%`))));
  }
  function profileView(prof) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    const rows = [];
    const addRow = (label, value) => {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text(label)),
        el("span", "bz-people-prof-value", text(value))
      ]));
    };
    if ((_a2 = prof == null ? void 0 : prof.socials) == null ? void 0 : _a2.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("社交账号")),
        el("span", "bz-people-prof-value", text(prof.socials.map((s) => [s.platform, s.handle].filter(Boolean).join(" ")).filter(Boolean).join(" · ")))
      ]));
    }
    if ((_b2 = prof == null ? void 0 : prof.birthday) == null ? void 0 : _b2.trim()) addRow("生日", prof.birthday.trim());
    if ((_c = prof == null ? void 0 : prof.metVia) == null ? void 0 : _c.trim()) addRow("认识方式", prof.metVia.trim());
    if ((_d = prof == null ? void 0 : prof.metAt) == null ? void 0 : _d.trim()) addRow("认识时间", prof.metAt.trim());
    if ((_e = prof == null ? void 0 : prof.hometown) == null ? void 0 : _e.trim()) addRow("家乡 / 现居", prof.hometown.trim());
    if ((_f = prof == null ? void 0 : prof.job) == null ? void 0 : _f.trim()) addRow("职业", prof.job.trim());
    if ((_g = prof == null ? void 0 : prof.tags) == null ? void 0 : _g.length) {
      rows.push(el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        el("span", "bz-people-prof-tags", prof.tags.filter(Boolean).map((t) => el("span", "bz-people-chip", text(t))))
      ]));
    }
    if ((_h = prof == null ? void 0 : prof.note) == null ? void 0 : _h.trim()) addRow("备注", prof.note.trim());
    rows.push(el("div", "bz-people-prof-actions", [
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "编辑档案", { "data-people-prof-edit": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 读交往素材推断缺失字段，填进表单待你确认" })
    ]));
    return el("div", "bz-people-prof", rows);
  }
  function profInput(value, placeholder, attr, cls = "bz-people-prof-input") {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.className = cls;
    inp.value = value;
    inp.placeholder = placeholder;
    inp.setAttribute(attr[0], attr[1]);
    return inp;
  }
  function socialRow(platform, handle2) {
    return el("div", "bz-people-prof-social-row", [
      profInput(platform, "平台（微信 / 微博…）", ["data-people-prof-social-platform", ""], "bz-people-prof-input bz-people-prof-social-platform"),
      profInput(handle2, "账号", ["data-people-prof-social-handle", ""], "bz-people-prof-input bz-people-prof-social-handle"),
      button("bz-people-btn bz-people-btn-ghost bz-people-prof-x", "×", { "data-people-prof-social-del": "", "aria-label": "删除这条社交账号" })
    ]);
  }
  function tagChip(t) {
    return el("span", "bz-people-prof-tag", [
      el("span", "bz-people-prof-tag-text", text(t)),
      button("bz-people-btn bz-people-btn-ghost bz-people-prof-x", "×", { "data-people-prof-tag-del": "", "aria-label": `删除标签 ${t}` })
    ]);
  }
  function profileEditor(prof) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    const grid = (label, input) => el("div", "bz-people-prof-row", [el("span", "bz-people-prof-label", text(label)), input]);
    const socialList = el("div", "bz-people-prof-social-list", { "data-people-prof-social-list": "" });
    for (const s of (_a2 = prof == null ? void 0 : prof.socials) != null ? _a2 : []) socialList.appendChild(socialRow(s.platform, s.handle));
    const tagList = el("div", "bz-people-prof-tag-list", { "data-people-prof-tag-list": "" });
    for (const t of (_b2 = prof == null ? void 0 : prof.tags) != null ? _b2 : []) tagList.appendChild(tagChip(t));
    const tagInput = profInput("", "加标签…", ["data-people-prof-tag-input", ""], "bz-people-prof-input bz-people-prof-tag-input");
    return el("div", "bz-people-prof bz-people-prof-edit", [
      el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("社交账号")),
        el("div", "bz-people-prof-social", [
          socialList,
          el("div", "bz-people-prof-social-tools", [
            button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "+ 社交账号", { "data-people-prof-add-social": "" })
          ])
        ])
      ]),
      grid("生日", profInput((_c = prof == null ? void 0 : prof.birthday) != null ? _c : "", "YYYY-MM-DD 或 MM-DD", ["data-people-prof-field", "birthday"])),
      grid("认识方式", profInput((_d = prof == null ? void 0 : prof.metVia) != null ? _d : "", "怎么认识的", ["data-people-prof-field", "metVia"])),
      grid("认识时间", profInput((_e = prof == null ? void 0 : prof.metAt) != null ? _e : "", "比如 2023 年夏天", ["data-people-prof-field", "metAt"])),
      grid("家乡 / 现居", profInput((_f = prof == null ? void 0 : prof.hometown) != null ? _f : "", "家乡 · 现居", ["data-people-prof-field", "hometown"])),
      grid("职业", profInput((_g = prof == null ? void 0 : prof.job) != null ? _g : "", "职业", ["data-people-prof-field", "job"])),
      el("div", "bz-people-prof-row", [
        el("span", "bz-people-prof-label", text("标签")),
        el("div", "bz-people-prof-tags-edit", [
          tagList,
          el("div", "bz-people-prof-tag-tools", [
            tagInput,
            button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "+ 标签", { "data-people-prof-tag-add": "" })
          ])
        ])
      ]),
      grid("备注", profInput((_h = prof == null ? void 0 : prof.note) != null ? _h : "", "一句话备注", ["data-people-prof-field", "note"])),
      el("div", "bz-people-prof-actions", [
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 只填空白字段，填完你可检查再保存" }),
        button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "保存档案", { "data-people-prof-save": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "取消", { "data-people-prof-cancel": "" })
      ])
    ]);
  }
  function profilePopBody(p, editing) {
    const out = [];
    const hasProf = profileFilled(p.profile);
    if (hasProf || editing) out.push(editing ? profileEditor(p.profile) : profileView(p.profile));
    if (!hasProf && !editing) {
      out.push(el("div", "bz-people-prof-entry bz-people-prof-entry-solo", [
        el("span", "bz-people-prof-entry-hint", text("聊天之外的也可以记：")),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "补人物档案", { "data-people-prof-new": "" }),
        button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "AI 补充", { "data-people-prof-ai": "", title: "AI 读交往素材推断档案，填进表单待你确认" })
      ]));
    }
    return out;
  }
  function popShell(title, rootHook, body) {
    const wrap = el("div", "bz-people-pop", { [rootHook]: "" });
    wrap.appendChild(el("div", "bz-people-pop-dim", { "data-people-pop-close": "" }));
    const pop = el("div", "bz-people-pop-panel", { role: "dialog", "aria-label": title });
    pop.appendChild(el("div", "bz-people-pop-head", [
      el("div", "bz-people-pop-title", text(title)),
      iconButton("x", "bz-people-btn bz-people-btn-ghost bz-people-icon-btn", { "data-people-pop-close": "", "aria-label": "关闭", title: "关闭" })
    ]));
    const content = el("div", "bz-people-pop-body");
    for (const node of body) content.appendChild(node);
    pop.appendChild(content);
    wrap.appendChild(pop);
    return wrap;
  }
  function noteAddRow(today) {
    const date = document.createElement("input");
    date.type = "date";
    date.className = "bz-people-prof-input bz-people-note-date";
    date.value = today;
    date.setAttribute("data-people-note-date", "");
    const txt = profInput("", "一句话记下这一天……", ["data-people-note-text", ""], "bz-people-prof-input bz-people-note-text");
    return el("div", "bz-people-note-add", [
      date,
      txt,
      button("bz-people-btn bz-people-btn-acc bz-people-btn-sm", "记一笔", { "data-people-note-save": "" }),
      button("bz-people-btn bz-people-btn-ghost bz-people-btn-sm", "收起", { "data-people-note-cancel": "" })
    ]);
  }
  var MD_SEALS = {
    画像速写: "速",
    性格与思维: "性",
    "表达 DNA": "言",
    兴趣爱好: "趣",
    价值观与红线: "则",
    习惯: "常",
    情感倾向: "情",
    关系定性: "定",
    互动结构: "动",
    演变阶段: "变",
    我们的语言: "语",
    共同记忆: "忆",
    冲突与修复: "克",
    未竟之事: "未",
    经营建议: "营"
  };
  var MD_CN_NO = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  var MD_DATE_RE = /^（([-\d至~\/\s年]+?)）\s*/;
  function miniMarkdown(md) {
    const root = el("div", "bz-people-portrait");
    let sec = null;
    let body = null;
    let list = null;
    let quote = null;
    let no = 0;
    const appendInline = (elm, str2) => {
      const parts = str2.split(/\*\*(.+?)\*\*/g);
      parts.forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) elm.appendChild(textEl("strong", part));
        else elm.appendChild(document.createTextNode(part));
      });
    };
    const openSec = (title) => {
      var _a2, _b2;
      sec = document.createElement("section");
      sec.className = "bz-md-sec";
      const head = document.createElement("div");
      head.className = "bz-md-sec-h";
      const seal = document.createElement("span");
      seal.className = "bz-md-seal";
      seal.textContent = (_b2 = (_a2 = MD_SEALS[title]) != null ? _a2 : MD_CN_NO[no]) != null ? _b2 : "·";
      const rule = document.createElement("i");
      rule.className = "bz-md-rule";
      head.append(seal, textEl("h4", title), rule);
      body = document.createElement("div");
      body.className = "bz-md-sec-b";
      sec.append(head, body);
      root.appendChild(sec);
      list = null;
      quote = null;
      no++;
    };
    for (const raw of String(md != null ? md : "").replace(/```+/g, "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) {
        list = null;
        quote = null;
        continue;
      }
      if (line.startsWith("## ")) {
        openSec(line.slice(3).trim());
        continue;
      }
      if (!sec) openSec("概述");
      if (line.startsWith("### ")) {
        list = null;
        quote = null;
        body.appendChild(textEl("h5", line.slice(4)));
        continue;
      }
      if (line.startsWith("- ")) {
        quote = null;
        if (!list) {
          list = document.createElement("div");
          list.className = "bz-md-items";
          body.appendChild(list);
        }
        const it = document.createElement("div");
        it.className = "bz-md-it";
        it.appendChild(el("span", "bz-md-mk"));
        let rest = line.slice(2).trim();
        const m = rest.match(MD_DATE_RE);
        if (m) {
          it.appendChild(el("span", "bz-md-date", [text(m[1])]));
          rest = rest.slice(m[0].length);
        }
        const tx = document.createElement("span");
        tx.className = "bz-md-tx";
        appendInline(tx, rest);
        it.appendChild(tx);
        list.appendChild(it);
        continue;
      }
      if (line.startsWith(">")) {
        list = null;
        if (!quote) {
          quote = document.createElement("div");
          quote.className = "bz-md-quote";
          body.appendChild(quote);
        }
        const p2 = document.createElement("p");
        appendInline(p2, line.slice(1).replace(/^\s/, ""));
        quote.appendChild(p2);
        continue;
      }
      list = null;
      quote = null;
      const p = document.createElement("p");
      appendInline(p, line);
      body.appendChild(p);
    }
    return root;
  }
  function dsWatermark(row) {
    if (!row.previewCount) return "未导入";
    const drawn = row.processedTs ? ` · 画到 ${formatDay(row.processedTs).slice(2)}` : " · 未画脸谱";
    return `已导 ${formatCount(row.previewCount)} 条${drawn}`;
  }
  function dsRow(row, on) {
    const fresh = row.newCount > 0;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = on;
    cb.disabled = row.isGroup;
    cb.setAttribute("data-people-ds-check", row.name);
    const cls = `bz-people-ds-row${on ? " bz-people-ds-on" : ""}${fresh ? " bz-people-ds-fresh" : ""}${row.isGroup ? " bz-people-ds-off" : ""}`;
    return el("label", cls, [
      cb,
      row.avatar ? el("img", "bz-people-ds-ava bz-people-ds-ava-img", { src: avatarUri(row.avatar), alt: row.name }) : el("div", "bz-people-ds-ava", { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
      el("div", "bz-people-ds-main", [
        el("div", "bz-people-ds-name", text(row.name + (row.isGroup ? "（群）" : ""))),
        el("div", "bz-people-ds-meta", text([
          `${formatCount(row.rawCount)} 条`,
          row.media
        ].filter(Boolean).join(" · ")))
      ]),
      el("div", "bz-people-ds-side", [
        ...fresh ? [el("span", "bz-people-ds-new", text(`新 ${row.newCount} 条`))] : [],
        el("span", "bz-people-ds-mark", text(dsWatermark(row)))
      ])
    ]);
  }
  function dsModal(s) {
    const wrap = el("div", "bz-people-ds-pop", { "data-people-ds-pop": "" });
    wrap.appendChild(el("div", "bz-people-ds-dim", { "data-people-ds-dim": "" }));
    const pop = el("div", "bz-people-ds-panel", { role: "dialog", "aria-label": "数据源" });
    const syncBtn = s.syncing ? button("bz-people-btn bz-people-btn-ghost bz-people-ds-syncbtn", "停止", {
      "data-people-ds-sync-stop": "",
      "aria-label": "停止同步",
      title: "停止同步——已导出的部分保留，重跑可续传"
    }) : button("bz-people-btn bz-people-btn-ghost bz-people-ds-syncbtn", "同步", {
      "data-people-ds-sync": "",
      "aria-label": "同步",
      title: "从微信重新解密并导出，需要微信已登录"
    });
    pop.appendChild(el("div", "bz-people-ds-head", [
      el("div", "bz-people-ds-title", text("数据源")),
      el("div", "bz-people-ds-headmeta", text([
        s.syncing ? "正在同步…" : s.scanning ? "正在扫描…" : s.rows ? `${s.rows.length} 位联系人` : "",
        s.hiddenGroups > 0 ? `${s.hiddenGroups} 个群聊未纳入` : ""
      ].filter(Boolean).join(" · "))),
      syncBtn
    ]));
    pop.appendChild(el("div", "bz-people-ds-path", text(s.dataDir || "尚未配置数据根目录——到「设置 → 脸谱」粘贴预处理导出目录。" + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ""))));
    if (s.sync) pop.appendChild(dsSyncLineNode(s.sync));
    if (s.desktopOnly) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("数据源扫描仅桌面端支持（需要读取库外文件夹）。")));
    } else if (s.scanning) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("正在扫描数据根目录…")));
    } else if (!s.rows) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("还没扫描。点右上「同步」从微信取数，或等同步完成后自动刷新。")));
    } else if (!s.rows.length) {
      pop.appendChild(el("div", "bz-people-ds-empty", text(
        s.hiddenGroups > 0 ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。` : "数据根目录里没有找到联系人（各联系人目录下需有 chat.json）。"
      )));
    } else {
      const list = el("div", "bz-people-ds-list");
      for (const r of s.rows) list.appendChild(dsRow(r, s.selected.includes(r.name)));
      pop.appendChild(list);
      const hasFresh = s.rows.some((r) => r.newCount > 0);
      pop.appendChild(el("div", "bz-people-ds-legend", [
        el("span", "", [el("i", "bz-people-dot bz-people-dot-ok"), text("有更新")]),
        el("span", "", [el("i", "bz-people-dot bz-people-dot-idle"), text("已导无更新")]),
        el("span", "", [el("i", "bz-people-dot bz-people-dot-none"), text("未导入")]),
        ...hasFresh ? [button("bz-people-ds-pickfresh", "勾有更新的", { "data-people-ds-pickfresh": "" })] : []
      ]));
    }
    const foot = el("div", "bz-people-ds-foot", [
      el("span", "bz-people-ds-count", { "data-people-ds-count": "" }, text(footerLabel(s))),
      ...s.generateable && !s.importing ? [button("bz-people-btn bz-people-btn-acc", "画脸谱", s.syncing ? { "data-people-ds-generate": "", disabled: "", title: "同步进行中——完成后可画脸谱" } : { "data-people-ds-generate": "", title: "关闭弹窗，用预览素材生成脸谱" })] : [],
      button("bz-people-btn bz-people-btn-acc", s.importing ? "导入中…" : "导入所选", s.syncing ? { "data-people-ds-import": "", disabled: "", title: "同步进行中——完成后可导入" } : { "data-people-ds-import": "" })
    ]);
    pop.appendChild(foot);
    if (s.notice) pop.appendChild(el("div", "bz-people-ds-notice", { "data-people-ds-notice": "" }, text(s.notice)));
    wrap.appendChild(pop);
    return wrap;
  }
  function dsSyncLineNode(line) {
    const mod = line.status === "running" ? "run" : line.status === "error" ? "err" : line.status === "stopped" ? "stop" : "done";
    const row = el("div", `bz-people-ds-syncline bz-people-ds-syncline-${mod}`, { "data-people-ds-sync-line": "" });
    row.appendChild(el("div", "bz-people-ds-sync-head", [
      el("span", "bz-people-ds-sync-text", { "data-people-ds-sync-text": "" }, text(line.text + (line.pct != null ? ` ${line.pct}%` : "")))
    ]));
    if (line.status === "running" && line.pct != null) {
      row.appendChild(el("div", "bz-people-ds-sync-track", [
        el("div", "bz-people-ds-sync-bar", { "data-people-ds-sync-bar": "", style: `width:${Math.max(0, Math.min(100, line.pct))}%` })
      ]));
    }
    const subNode = el("div", "bz-people-ds-sync-sub", { "data-people-ds-sync-sub": "" }, text(line.sub));
    if (!line.sub) subNode.hidden = true;
    row.appendChild(subNode);
    const shown = line.failures.slice(0, 3);
    for (const f of shown) row.appendChild(el("div", "bz-people-ds-sync-fail", text(f)));
    if (line.failures.length > 3) row.appendChild(el("div", "bz-people-ds-sync-fail", text(`等共 ${line.failures.length} 位失败——重跑同步只补失败项`)));
    if (line.hint) row.appendChild(el("div", "bz-people-ds-sync-hint", text(line.hint)));
    return row;
  }
  function footerLabel(s) {
    if (!s.rows) return "";
    if (!s.selectedCount) return "未勾选联系人";
    return s.freshCount ? `已选 ${s.selectedCount} 位 · 新素材 ${s.freshCount} 条` : `已选 ${s.selectedCount} 位 · 所选暂无新素材`;
  }
  function importMeta(rec, textMsgs) {
    return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
  }

  // src/people/ui.ts
  init_ui();
  init_settings_provider();
  var ESC_ID = "people-panel";
  var overlay = null;
  var store = null;
  var peopleSafe = null;
  var opening = false;
  var offUnlockWatch = null;
  var offSyncWatch = null;
  var stage = "list";
  var detailId = null;
  var detailFold = "p";
  var deleteArmId = null;
  var deleteArmTimer = null;
  var listCache = [];
  var mergeFromId = null;
  var mergeToId = null;
  var jobsUnsub = null;
  var jobsCache = null;
  var targetsInFlight = /* @__PURE__ */ new Map();
  var jobsPersisted = /* @__PURE__ */ new Set();
  var jobsBooted = false;
  var dsOpen = false;
  var dsContacts = null;
  var dsSelected = /* @__PURE__ */ new Set();
  var dsScanning = false;
  var dsImporting = false;
  var dsHiddenGroups = 0;
  var dsNotice = "";
  var dsGenerateable = false;
  var dsScannedAt = "";
  var statsOpen = false;
  var profOpen = false;
  var noteOpen = false;
  function openStatsPop() {
    statsOpen = true;
    profOpen = false;
    noteOpen = false;
    void renderBody();
  }
  function openProfPop() {
    profOpen = true;
    statsOpen = false;
    noteOpen = false;
    void renderBody();
  }
  function openNotePop() {
    noteOpen = true;
    statsOpen = false;
    profOpen = false;
    void renderBody();
  }
  function closePops() {
    if (!statsOpen && !profOpen && !noteOpen) return;
    statsOpen = false;
    profOpen = false;
    noteOpen = false;
    void renderBody();
  }
  function isPeopleOpen() {
    return overlay !== null;
  }
  var unlockGate = ensureSafeUnlocked;
  function openPeoplePanel(app) {
    if (overlay) {
      topifyZ(overlay);
      return;
    }
    if (opening) return;
    opening = true;
    void (async () => {
      try {
        const safe = await getPeopleSafeStore();
        if (!safe.unlocked) {
          const ok = await unlockGate();
          if (!ok) {
            notice("脸谱数据在保险库里——解锁后才能查看", "info");
            return;
          }
        }
        peopleSafe = safe;
        buildPanelShell(app);
        await runLegacyMigration();
        void renderBody();
        await restoreJobsView();
      } catch (e) {
        console.warn("[people] 打开面板失败:", e);
        notice("脸谱面板打开失败，请重试", "error");
      } finally {
        opening = false;
      }
    })();
  }
  function buildPanelShell(app) {
    var _a2;
    if (overlay) return;
    store = new PeopleStore(app != null ? app : getApp());
    overlay = document.createElement("div");
    overlay.className = "bz-panel-overlay bz-people-scope";
    overlay.appendChild(panelShell());
    document.body.appendChild(overlay);
    topifyZ(overlay);
    registerPanelEsc(ESC_ID, isPeopleOpen, () => {
      if (statsOpen || profOpen) closePops();
      else if (dsOpen) closeDs();
      else closePeoplePanel();
    });
    trapPanelFocus((_a2 = overlay.querySelector(".bz-people-panel")) != null ? _a2 : overlay);
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("change", onOverlayChange);
    overlay.addEventListener("keydown", (e) => {
      const input = e.target instanceof HTMLInputElement ? e.target : null;
      if (e.key !== "Enter" || !input) return;
      if (!input.hasAttribute("data-people-prof-tag-input") && !input.hasAttribute("data-people-note-text")) return;
      e.preventDefault();
      if (input.hasAttribute("data-people-prof-tag-input")) addTagChip();
      else void saveManualNote();
    });
    offUnlockWatch = onDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, (evt) => {
      if (!overlay) return;
      if ((evt == null ? void 0 : evt.unlocked) === false) {
        peopleSafe == null ? void 0 : peopleSafe.clearPlainCaches();
        recordCache = null;
        void renderBody();
      } else if ((evt == null ? void 0 : evt.unlocked) === true) {
        void renderBody();
      }
    });
    offSyncWatch = subscribeSync(onSyncState);
  }
  async function runLegacyMigration() {
    if (!(peopleSafe == null ? void 0 : peopleSafe.unlocked)) return;
    try {
      const out = await migrateLegacyPeopleData(getApp(), peopleSafe);
      if (out.migrated > 0) {
        recordCache = null;
        const extra = out.keptBack.length ? "。旧明文文件校验未全部通过，暂未删除（下次打开自动重试）" : "，旧明文文件已清理";
        notice(`已把 ${out.migrated} 位联系人的数据迁入保险库加密记录${extra}`, "success");
      }
    } catch (e) {
      console.warn("[people] 存量迁移失败:", e);
      notice("存量数据迁移没有完成，将在下次打开时重试", "warning");
    }
  }
  function closePeoplePanel() {
    const backgrounded = jobsRunning();
    unregisterPanelEsc(ESC_ID);
    offUnlockWatch == null ? void 0 : offUnlockWatch();
    offUnlockWatch = null;
    offSyncWatch == null ? void 0 : offSyncWatch();
    offSyncWatch = null;
    overlay == null ? void 0 : overlay.remove();
    overlay = null;
    store = null;
    detailId = null;
    detailFold = "p";
    stage = "list";
    listCache = [];
    recordCache = null;
    mergeFromId = null;
    mergeToId = null;
    profEditId = null;
    noteAddId = null;
    statsOpen = false;
    profOpen = false;
    noteOpen = false;
    disarmDelete();
    closeDsState();
    if (backgrounded) notice("已转后台继续生成，重开面板查看进度", "info");
  }
  function closeDsState() {
    dsOpen = false;
    dsContacts = null;
    dsSelected = /* @__PURE__ */ new Set();
    dsScanning = false;
    dsImporting = false;
    dsHiddenGroups = 0;
    dsNotice = "";
    dsGenerateable = false;
    dsScannedAt = "";
  }
  function openDataSource() {
    if (!overlay) openPeoplePanel();
    void openDsIfIdle();
  }
  async function openDsIfIdle() {
    await ensureJobsBoot();
    await ensureJobsWatch();
    if (!overlay) return;
    if (jobsBusy()) {
      notice("正在生成脸谱，请等这批结束再开数据源", "info");
      return;
    }
    openDs();
  }
  function dsDataDir() {
    var _a2, _b2;
    return String((_b2 = (_a2 = tryGetSettings()) == null ? void 0 : _a2.peopleDataDir) != null ? _b2 : "").trim();
  }
  function isDesktop() {
    return typeof window !== "undefined" && Boolean(window.require);
  }
  function dataUrlOf(a) {
    if (!a) return null;
    const mime = a.ext === "png" ? "image/png" : a.ext === "webp" ? "image/webp" : a.ext === "gif" ? "image/gif" : "image/jpeg";
    return `data:${mime};base64,${a.base64}`;
  }
  function openDs() {
    if (dsOpen) return;
    dsOpen = true;
    renderBody();
    if (dsContacts === null) void runScan();
  }
  function closeDs() {
    if (!dsOpen) return;
    dsOpen = false;
    dsGenerateable = false;
    renderBody();
  }
  function dsRowStates() {
    return (dsContacts != null ? dsContacts : []).map((c) => {
      const badge = storeMediaBadge(c.stats);
      return {
        name: c.name,
        rawCount: c.rawCount,
        isGroup: c.isGroup,
        media: badge ? formatMediaCount(badge) : "",
        previewCount: c.previewCount,
        newCount: c.newCount,
        processedTs: c.processedTs,
        avatar: c.avatar
      };
    });
  }
  function dsModalState() {
    const sel = (dsContacts != null ? dsContacts : []).filter((c) => dsSelected.has(c.name));
    return {
      dataDir: dsDataDir(),
      scanning: dsScanning,
      importing: dsImporting,
      rows: dsContacts === null ? null : dsRowStates(),
      selectedCount: sel.length,
      selected: sel.map((c) => c.name),
      freshCount: sel.reduce((s, c) => s + c.newCount, 0),
      hiddenGroups: dsHiddenGroups,
      notice: dsNotice,
      generateable: dsGenerateable,
      desktopOnly: !isDesktop(),
      scannedAt: dsScannedAt,
      syncing: isSyncing(),
      sync: dsSyncLine()
    };
  }
  function dsSyncLine() {
    const s = syncState();
    if (s.outcome === "idle") return null;
    if (s.outcome === "running") {
      const phase = syncPhaseLabel(s.phase) || "正在同步";
      return { status: "running", text: phase, sub: s.step, pct: s.pct, hint: "", failures: [] };
    }
    if (s.outcome === "ok") {
      return {
        status: "ok",
        text: s.stats.failed > 0 ? `同步完成（${s.stats.failed} 位失败）` : "同步完成",
        sub: s.message || describeSyncStats(s.stats),
        pct: 100,
        hint: "",
        failures: s.stats.failures.map((f) => `${f.name}：${f.error}`)
      };
    }
    if (s.outcome === "stopped") {
      return {
        status: "stopped",
        text: "已停止",
        sub: `已导出的部分保留——本次已更新 ${s.stats.written} 位，重跑可续传`,
        pct: null,
        hint: s.hint,
        failures: []
      };
    }
    return { status: "error", text: "同步失败", sub: s.message, pct: null, hint: s.hint, failures: [] };
  }
  function onSyncState(s) {
    if (!overlay) return;
    if (s.outcome === "running") {
      if (!updateSyncLine()) void renderBody();
      return;
    }
    if (s.outcome === "ok") {
      void runScan(true);
      return;
    }
    void renderBody();
  }
  function updateSyncLine() {
    const line = overlay == null ? void 0 : overlay.querySelector("[data-people-ds-sync-line]");
    if (!line) return false;
    const view = dsSyncLine();
    if (!view) return false;
    const main = line.querySelector("[data-people-ds-sync-text]");
    const sub = line.querySelector("[data-people-ds-sync-sub]");
    const bar = line.querySelector("[data-people-ds-sync-bar]");
    if (main) main.textContent = view.text + (view.pct != null ? ` ${view.pct}%` : "");
    if (sub) {
      sub.textContent = view.sub;
      sub.hidden = !view.sub;
    }
    if (bar && view.pct != null) bar.style.width = `${Math.max(0, Math.min(100, view.pct))}%`;
    return true;
  }
  function handleSyncClick() {
    if (isSyncing()) return;
    if (jobsBusy()) {
      notice("正在生成脸谱——等这批结束再同步", "info");
      return;
    }
    if (!isDesktop()) {
      dsNotice = "同步仅桌面端支持（需要调用外部工具 bz-face）。";
      renderBody();
      return;
    }
    dsNotice = "";
    startSync();
  }
  function applySyncLockdown() {
    const lock = isSyncing();
    overlay == null ? void 0 : overlay.querySelectorAll("[data-people-seal-act], [data-people-generate-one]").forEach((b) => {
      if (lock) {
        b.disabled = true;
        b.setAttribute("data-people-sync-lock", "1");
        b.title = "同步进行中——等同步完成再画脸谱";
      } else if (b.hasAttribute("data-people-sync-lock")) {
        b.disabled = false;
        b.removeAttribute("data-people-sync-lock");
      }
    });
  }
  async function runScan(force = false) {
    var _a2, _b2, _c, _d, _e;
    const dataDir = dsDataDir();
    if (!overlay || !store || !dataDir || dsScanning || dsImporting || jobsBusy() || isSyncing()) return;
    if (!isDesktop()) {
      dsNotice = "";
      renderBody();
      return;
    }
    dsScanning = true;
    dsGenerateable = false;
    if (force) dsContacts = null;
    dsNotice = "";
    renderBody();
    const contacts = [];
    let hidden = 0;
    try {
      const dirNames = listContactDirs(dataDir);
      const includeGroups = ((_a2 = tryGetSettings()) == null ? void 0 : _a2.peopleIncludeGroups) === true;
      const opts = normalizeOptionsFromSettings();
      const [storeData, people] = await Promise.all([records(), store.list()]);
      for (const name of dirNames) {
        if (!overlay) return;
        const bundle = readContactBundle(dataDir, name);
        if (!bundle) continue;
        const group = isGroupChat(bundle.raws);
        if (group && !includeGroups) {
          hidden++;
          continue;
        }
        const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
        const pv = (_b2 = storeData.get(name)) == null ? void 0 : _b2.store;
        const keys = new Set(((_c = pv == null ? void 0 : pv.msgs) != null ? _c : []).map((m) => m.key));
        const entry = people.find((p) => p.id === name);
        contacts.push({
          name,
          rawCount: bundle.raws.length,
          isGroup: group,
          stats: norm.stats,
          previewCount: (_d = pv == null ? void 0 : pv.msgs.length) != null ? _d : 0,
          newCount: norm.msgs.reduce((s, m) => s + (keys.has(m.key) ? 0 : 1), 0),
          processedTs: (_e = entry == null ? void 0 : entry.lastProcessedTs) != null ? _e : null,
          // 头像预览（467）：直接读数据根字节解成内存 data URL（不再复制进库内明文目录）
          avatar: dataUrlOf(readAvatarInput(bundle.avatar))
        });
      }
    } catch (e) {
      console.warn("[people] 数据源扫描失败:", e);
      dsNotice = "扫描失败：读不到数据文件夹或文件格式不对。";
    }
    dsScanning = false;
    dsHiddenGroups = hidden;
    if (overlay) {
      dsContacts = contacts.sort((a, b) => b.newCount - a.newCount || a.name.localeCompare(b.name, "zh"));
      const names = new Set(dsContacts.map((c) => c.name));
      dsSelected = new Set([...dsSelected].filter((n) => names.has(n)));
      const now = /* @__PURE__ */ new Date();
      dsScannedAt = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      renderBody();
    }
  }
  async function importDsSelected() {
    var _a2;
    const dataDir = dsDataDir();
    if (!overlay || !dataDir || dsImporting || dsScanning || jobsBusy() || isSyncing()) return;
    const chosen = (dsContacts != null ? dsContacts : []).filter((c) => dsSelected.has(c.name));
    if (!chosen.length) {
      notice("还没有勾选联系人", "warning");
      return;
    }
    if (!isDesktop()) {
      dsNotice = "数据源导入仅桌面端支持（需要读取库外文件夹）。";
      renderBody();
      return;
    }
    dsImporting = true;
    dsGenerateable = false;
    dsNotice = "正在导入聊天仓…";
    renderBody();
    const opts = normalizeOptionsFromSettings();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const addedOf = /* @__PURE__ */ new Map();
    const readFail = [];
    try {
      for (const c of chosen) {
        if (!overlay) return;
        const bundle = readContactBundle(dataDir, c.name);
        if (!bundle) {
          readFail.push(c.name);
          continue;
        }
        const norm = normalizeChatJson(bundle.raws, opts, { voice: bundle.voice, imageDesc: bundle.imageDesc });
        const existing = (_a2 = (await records()).get(c.name)) == null ? void 0 : _a2.store;
        const { contact, added } = mergeStore(existing, norm, now);
        const avatar = readAvatarInput(bundle.avatar);
        delete contact.avatar;
        await peopleSafe.write(c.name, (rec) => {
          rec.store = contact;
        }, { avatar });
        addedOf.set(c.name, added);
        c.previewCount = contact.msgs.length;
        c.newCount = 0;
        c.stats = contact.stats;
      }
    } catch (e) {
      console.warn("[people] 聊天仓导入失败:", e);
      dsNotice = "导入失败：读数据文件时出错。";
      dsImporting = false;
      renderBody();
      return;
    }
    dsImporting = false;
    const fresh = [...addedOf.values()].reduce((s, n) => s + n, 0);
    const summary = `已导入（新增 ${fresh} 条）${readFail.length ? ` · ${readFail.length} 位读文件失败` : ""}`;
    dsNotice = fresh > 0 && !readFail.length ? `${summary}。点「画脸谱」调用 AI 生成。` : summary;
    dsGenerateable = fresh > 0 && !readFail.length;
    renderBody();
  }
  async function generateFromDs() {
    var _a2, _b2, _c;
    if (!overlay || !store || dsImporting || dsScanning) return;
    if (isSyncing()) {
      notice("正在同步微信数据——同步完成后再画脸谱", "info");
      return;
    }
    if (jobsBusy()) {
      notice("已有生成在进行——等它完成或暂停后再画", "info");
      return;
    }
    const names = (dsContacts != null ? dsContacts : []).filter((c) => dsSelected.has(c.name)).map((c) => c.name);
    if (!names.length) {
      notice("还没有勾选联系人", "warning");
      return;
    }
    const targets = [];
    try {
      const storeData = await records();
      for (const name of names) {
        const pv = (_a2 = storeData.get(name)) == null ? void 0 : _a2.store;
        const unified = storeToUnified((_b2 = pv == null ? void 0 : pv.msgs) != null ? _b2 : []);
        if (!unified.length) continue;
        targets.push({
          talker: name,
          name,
          msgs: unified,
          kindCounts: (_c = pv == null ? void 0 : pv.kindCounts) != null ? _c : {},
          skippedCount: 0,
          // 仓内时间线全是有效文本；原始过滤数已计入 chat.json 口径，不在导入记录重复报
          fileLabel: `数据源:${name}`,
          insights: pv == null ? void 0 : pv.insights
        });
      }
    } catch (e) {
      console.warn("[people] 读取聊天仓失败:", e);
      dsNotice = "生成失败：读不到聊天仓。";
      renderBody();
      return;
    }
    if (!targets.length) {
      dsNotice = "所选还没有预览数据，先「导入所选」。";
      renderBody();
      return;
    }
    closeDs();
    await startGeneration(targets);
  }
  async function generateOne(id, opts = {}) {
    var _a2, _b2, _c;
    const name = id != null ? id : detailId;
    if (!store || !name) return;
    if (isSyncing()) {
      notice("正在同步微信数据——同步完成后再画脸谱", "info");
      return;
    }
    if (!opts.force && resumeExisting(name)) return;
    if (jobsBusy()) {
      notice("已有生成在进行——等它完成或暂停后再画", "info");
      return;
    }
    let target = null;
    try {
      const pv = (_a2 = (await records()).get(name)) == null ? void 0 : _a2.store;
      const unified = storeToUnified((_b2 = pv == null ? void 0 : pv.msgs) != null ? _b2 : []);
      if (unified.length) {
        target = {
          talker: name,
          name,
          msgs: unified,
          kindCounts: (_c = pv == null ? void 0 : pv.kindCounts) != null ? _c : {},
          skippedCount: 0,
          fileLabel: `数据源:${name}`,
          insights: pv == null ? void 0 : pv.insights
        };
      }
    } catch (e) {
      console.warn("[people] 读取聊天仓失败:", e);
    }
    if (!target) {
      notice("还没有可画的消息素材——点右上「数据源」导入后再画", "warning");
      return;
    }
    await startGeneration([target]);
  }
  function resumeExisting(name) {
    var _a2;
    const pending = ((_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : []).find((j) => j.talker === name);
    if (!pending || pending.status === "running" || pending.status === "done") return false;
    if (jobs().resume(name)) {
      notice(`「${name}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画`, "info");
      return true;
    }
    notice(`「${name}」的消息集已变，断点接不上——点印章上的「重新生成」会从头重画`, "warning");
    return true;
  }
  function mergedMonthlyOf(imports) {
    var _a2, _b2, _c;
    const acc = /* @__PURE__ */ new Map();
    for (const r of imports) {
      for (const [month, n] of (_b2 = (_a2 = r.stats) == null ? void 0 : _a2.monthly) != null ? _b2 : []) acc.set(month, ((_c = acc.get(month)) != null ? _c : 0) + n);
    }
    if (!acc.size) return void 0;
    return [...acc.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  var jobsOverride = null;
  function jobs() {
    return jobsOverride != null ? jobsOverride : jobs_exports;
  }
  function applySnapshot(s) {
    jobsCache = s;
    if (s) handleJobsSnapshot(s);
    else renderJobs();
  }
  async function restoreJobsView() {
    if (!overlay) return;
    await ensureJobsBoot();
    await ensureJobsWatch();
  }
  async function ensureJobsBoot() {
    if (jobsBooted) return;
    const safe = peopleSafe != null ? peopleSafe : await getPeopleSafeStore();
    if (!safe.unlocked) return;
    jobsBooted = true;
    await jobs().resumeJobs(getApp());
  }
  async function ensureJobsWatch() {
    if (!jobsUnsub) jobsUnsub = jobs().subscribe((s) => applySnapshot(s));
    applySnapshot(jobs().snapshot());
  }
  function handleJobsSnapshot(s) {
    for (const job of s.queue) {
      if (job.status !== "done") continue;
      const target = targetsInFlight.get(job.talker);
      if (target) {
        targetsInFlight.delete(job.talker);
        jobsPersisted.add(job.talker);
        void persistJobDone(job, target);
      } else if (!jobsPersisted.has(job.talker) && job.person) {
        jobsPersisted.add(job.talker);
        void persistJobDone(job);
      }
    }
    renderJobs();
  }
  async function startGeneration(targets) {
    var _a2;
    const { runnable: runnable2, skipped } = await planTargets(targets);
    for (const t of runnable2) {
      targetsInFlight.set(t.talker, t);
      jobsPersisted.delete(t.talker);
    }
    let engineSkipped = 0;
    let resumed = [];
    if (runnable2.length) {
      const res = await jobs().startJobs(getApp(), runnable2, {});
      engineSkipped = res.skipped.length;
      resumed = (_a2 = res.resumed) != null ? _a2 : [];
      await ensureJobsWatch();
    }
    const started = runnable2.length - engineSkipped;
    const fresh = Math.max(0, started - resumed.length);
    const parts = [];
    if (fresh > 0) parts.push(`已开始生成 ${fresh} 张脸谱（后台进行，可关面板）`);
    if (resumed.length) parts.push(`${resumed.join("、")} 接着上次没画完的批次继续（已完成的不重烧）`);
    if (skipped.length + engineSkipped > 0) parts.push(`${skipped.length + engineSkipped} 位没有新消息、无需重画`);
    if (parts.length) notice(parts.join("，"), "success");
    renderJobs();
  }
  async function planTargets(targets) {
    var _a2;
    const store2 = new PeopleStore(getApp());
    const people = await store2.list();
    const runnable2 = [];
    const skipped = [];
    for (const t of targets) {
      const existing = people.find((p) => p.id === t.talker);
      const plan = planIncremental(t.msgs, existing);
      if (plan.mode === "skip") {
        if (existing) {
          let imports = existing.imports;
          if (imports.length && !imports.some((r) => r.stats)) {
            imports = [...imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
            imports[0] = { ...imports[0], stats: computeStats(t.msgs, t.kindCounts) };
            await store2.upsert({ ...existing, name: t.name, imports });
          } else {
            await store2.upsert({ ...existing, name: t.name });
          }
        }
        skipped.push(t.name);
        continue;
      }
      if (plan.mode === "older") {
        notice(`「${t.name}」这批 ${plan.msgs.length} 条消息早于上次提炼点，将作为补充素材提炼`);
      } else if (plan.olderCount > 0) {
        notice(`「${t.name}」另有 ${plan.olderCount} 条消息早于上次提炼点，本次不重复提炼`);
      }
      runnable2.push({ ...t, profile: existing == null ? void 0 : existing.profile, monthly: mergedMonthlyOf((_a2 = existing == null ? void 0 : existing.imports) != null ? _a2 : []) });
    }
    return { runnable: runnable2, skipped };
  }
  async function persistJobDone(job, target) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const talker = (_a2 = target == null ? void 0 : target.talker) != null ? _a2 : job.talker;
    const name = (_b2 = target == null ? void 0 : target.name) != null ? _b2 : job.name;
    try {
      const person = job.person;
      if (!person) {
        notice(`「${name}」生成完成但其人画像为空`, "warning");
        return;
      }
      const store2 = new PeopleStore(getApp());
      const existing = (await store2.list()).find((p) => p.id === talker);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const msgs = target == null ? void 0 : target.msgs;
      const rec = {
        file: (_f = (_e = (_d = target == null ? void 0 : target.fileLabel) != null ? _d : (_c = job.importRecord) == null ? void 0 : _c.fileLabel) != null ? _e : job.fileLabel) != null ? _f : `数据源:${talker}`,
        importedAt: now,
        messageCount: target ? (_h = (_g = job.importRecord) == null ? void 0 : _g.messageCount) != null ? _h : msgs.length : (_j = (_i = job.importRecord) == null ? void 0 : _i.messageCount) != null ? _j : 0,
        skippedCount: (_m = (_l = target == null ? void 0 : target.skippedCount) != null ? _l : (_k = job.importRecord) == null ? void 0 : _k.skippedCount) != null ? _m : 0,
        timeFrom: msgs ? new Date(msgs[0].ts).toISOString() : (_o = (_n = job.importRecord) == null ? void 0 : _n.timeFrom) != null ? _o : now,
        timeTo: msgs ? new Date(msgs[msgs.length - 1].ts).toISOString() : (_q = (_p = job.importRecord) == null ? void 0 : _p.timeTo) != null ? _q : now,
        stats: target ? computeStats(msgs, target.kindCounts) : job.stats
      };
      const entry = existing ? { ...existing, name } : { id: talker, name, createdAt: now, imports: [] };
      await store2.upsert(entry);
      await store2.appendImport(talker, rec);
      const digest = {
        person,
        // 卷一《其人》
        bond: job.bond || void 0,
        // 卷二《我们》（旧引擎无此产物）
        events: mergeManualEvents((_r = job.events) != null ? _r : [], existing == null ? void 0 : existing.manualEvents),
        // 439：手动随手记并入事件素材
        quotes: job.quotes,
        moments: (_s = job.material) == null ? void 0 : _s.moments,
        // 449：场景 / 特质随生成落盘
        traits: (_t = job.material) == null ? void 0 : _t.traits,
        chronicle: job.chronicle || void 0,
        generatedAt: now
      };
      await store2.setDigest(talker, digest);
      const lastTs = msgs ? msgs[msgs.length - 1].ts : Date.parse((_v = (_u = job.importRecord) == null ? void 0 : _u.timeTo) != null ? _v : "");
      if (Number.isFinite(lastTs)) {
        await store2.setLastProcessedTs(talker, Math.max((_w = existing == null ? void 0 : existing.lastProcessedTs) != null ? _w : 0, lastTs));
      }
      notice(`「${name}」的脸谱已生成`, "success");
      jobs().removeJob(talker);
      if (overlay) void renderBody();
    } catch (e) {
      if (target) targetsInFlight.set(talker, target);
      notifyActionError(e, `写入「${name}」的脸谱`);
    }
  }
  function renderJobs() {
    var _a2;
    const slot = overlay == null ? void 0 : overlay.querySelector("[data-people-jobs-slot]");
    if (!slot) return;
    const item = currentJobsItem();
    const show = Boolean(item && item.status !== "done" && stage === "detail" && detailId === item.talker);
    if (show && item) {
      slot.hidden = false;
      slot.replaceChildren(progressBlock(toBlockState(item)));
    } else {
      slot.hidden = true;
      slot.replaceChildren();
    }
    (_a2 = overlay == null ? void 0 : overlay.querySelector(".bz-people-panel")) == null ? void 0 : _a2.classList.toggle("bz-people-jobs-showing", show);
    syncWallSeals();
  }
  function currentJobsItem() {
    var _a2;
    const queue = (_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : [];
    if (!queue.length) return null;
    const rank = { running: 0, paused: 1, interrupted: 1, error: 2, done: 3 };
    return [...queue].map((job, i) => ({ job, i })).sort((a, b) => rank[a.job.status] - rank[b.job.status] || a.i - b.i)[0].job;
  }
  function toBlockState(job) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h;
    const queue = (_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : [];
    const pos = queue.findIndex((j) => j.talker === job.talker);
    return {
      talker: job.talker,
      name: job.name || job.talker,
      status: job.status,
      message: (_b2 = job.message) != null ? _b2 : "",
      batchesDone: (_c = job.batchesDone) != null ? _c : 0,
      batchesTotal: (_f = (_e = job.batchesTotal) != null ? _e : (_d = job.chunks) == null ? void 0 : _d.length) != null ? _f : 0,
      stagesDone: jobsStagesDone(job.stage, job.status),
      queueIndex: (_g = job.queueIndex) != null ? _g : pos + 1,
      queueTotal: (_h = job.queueTotal) != null ? _h : queue.length,
      errorText: job.error,
      resumable: isResumable(job)
    };
  }
  function isResumable(job) {
    return job.error !== DRIFT_ERROR;
  }
  function jobsBusy() {
    var _a2;
    return ((_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : []).some((j) => j.status === "running" || j.status === "paused");
  }
  function jobsRunning() {
    var _a2;
    return ((_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : []).some((j) => j.status === "running");
  }
  function jobsAction(kind) {
    var _a2, _b2, _c;
    const api = jobs();
    const talker = (_b2 = (_a2 = overlay == null ? void 0 : overlay.querySelector("[data-people-jobs]")) == null ? void 0 : _a2.getAttribute("data-people-jobs-talker")) != null ? _b2 : "";
    if (kind === "pause") {
      api.pauseJobs();
      notice("这一批做完就暂停", "info");
      return;
    }
    if (kind === "resume") {
      if (isSyncing()) {
        notice("正在同步微信数据——同步完成后再继续生成", "info");
        return;
      }
      const who = talker || ((_c = currentJobsItem()) == null ? void 0 : _c.talker) || "";
      if (!who) return;
      api.resume(who);
      notice("继续生成——已完成的批次不重画", "info");
      return;
    }
    if (talker && api.removeJob(talker)) {
      notice("已删除该任务", "delete");
      renderJobs();
    }
  }
  function jobViews() {
    var _a2;
    const m = /* @__PURE__ */ new Map();
    for (const j of (_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : []) m.set(j.talker, j);
    return m;
  }
  function sealJobOf(job) {
    var _a2, _b2, _c, _d;
    if (!job) return null;
    return {
      status: job.status,
      batchesDone: (_a2 = job.batchesDone) != null ? _a2 : 0,
      batchesTotal: (_d = (_c = job.batchesTotal) != null ? _c : (_b2 = job.chunks) == null ? void 0 : _b2.length) != null ? _d : 0,
      stagesDone: jobsStagesDone(job.stage, job.status),
      // 漂移类失败（消息集已变）接不上——印章改出「重新生成」
      resumable: isResumable(job)
    };
  }
  function syncWallSeals() {
    var _a2;
    const wall = overlay == null ? void 0 : overlay.querySelector("[data-people-wall]");
    if (!wall) return;
    const map = jobViews();
    const byId = new Map(listCache.map((p) => [p.id, p]));
    for (const card of Array.from(wall.querySelectorAll("[data-people-card]"))) {
      const p = byId.get((_a2 = card.dataset.peopleCard) != null ? _a2 : "");
      const old = card.querySelector(".bz-people-seal");
      if (!p || !old) continue;
      old.replaceWith(foldSealNode(p, sealJobOf(map.get(p.id))));
    }
    applySyncLockdown();
  }
  async function sealAction(kind, id) {
    var _a2;
    const api = jobs();
    if (isSyncing()) {
      notice("正在同步微信数据——同步完成后再操作脸谱", "info");
      return;
    }
    if (kind === "pause") {
      api.pauseJobs();
      notice("这一批做完就暂停", "info");
      return;
    }
    if (kind === "resume") {
      const pending = ((_a2 = jobsCache == null ? void 0 : jobsCache.queue) != null ? _a2 : []).find((j) => j.talker === id);
      if (!api.resume(id)) {
        notice("这个任务接不上了，请点「重新生成」", "info");
        return;
      }
      notice(pending ? `「${id}」从第 ${pending.batchesDone + 1} 批继续——已完成的 ${pending.batchesDone} 批不重画` : "继续生成——已完成的批次不重画", "info");
      return;
    }
    if (kind === "draw") await generateOne(id);
    else if (kind === "redraw") await generateOne(id, { force: true });
  }
  function onOverlayClick(e) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const t = e.target;
    if (e.target === overlay) {
      closePeoplePanel();
      return;
    }
    if (t.closest("[data-people-jobs-pause]")) {
      jobsAction("pause");
      return;
    }
    if (t.closest("[data-people-jobs-resume]")) {
      jobsAction("resume");
      return;
    }
    if (t.closest("[data-people-jobs-dismiss]")) {
      jobsAction("dismiss");
      return;
    }
    if (t.closest("[data-people-stats-open]")) {
      openStatsPop();
      return;
    }
    if (t.closest("[data-people-prof-open]")) {
      openProfPop();
      return;
    }
    if (t.closest("[data-people-pop-close]")) {
      closePops();
      return;
    }
    if (t.closest("[data-people-ds-open]")) {
      void openDsIfIdle();
      return;
    }
    if (t.closest("[data-people-ds-close]") || t.closest("[data-people-ds-dim]")) {
      closeDs();
      return;
    }
    if (t.closest("[data-people-ds-sync]")) {
      handleSyncClick();
      return;
    }
    if (t.closest("[data-people-ds-sync-stop]")) {
      stopSync();
      return;
    }
    if (t.closest("[data-people-ds-pickfresh]")) {
      pickFresh();
      return;
    }
    if (t.closest("[data-people-ds-import]")) {
      void importDsSelected();
      return;
    }
    if (t.closest("[data-people-ds-generate]")) {
      void generateFromDs();
      return;
    }
    if (t.closest("[data-people-back-btn]")) {
      stage = "list";
      detailId = null;
      detailFold = "p";
      void renderBody();
      return;
    }
    if (t.closest("[data-people-generate-one]")) {
      void generateOne(detailId != null ? detailId : void 0);
      return;
    }
    const mergeBtn = t.closest("[data-people-merge]");
    if (mergeBtn) {
      mergeFromId = mergeBtn.dataset.peopleMerge || null;
      mergeToId = null;
      stage = "list";
      detailId = null;
      detailFold = "p";
      void renderBody();
      return;
    }
    if (t.closest("[data-people-merge-cancel]")) {
      mergeFromId = null;
      mergeToId = null;
      void renderBody();
      return;
    }
    if (t.closest("[data-people-merge-confirm]")) {
      void handleMergeConfirm();
      return;
    }
    const mergePick = mergeFromId ? t.closest("[data-people-card]") : null;
    if (mergePick) {
      const id = mergePick.dataset.peopleCard || "";
      if (id && id !== mergeFromId) {
        mergeToId = id;
        void renderBody();
      }
      return;
    }
    const del = t.closest("[data-people-del]");
    if (del) {
      void handleDelete((_a2 = del.dataset.peopleDel) != null ? _a2 : "");
      return;
    }
    const seal = t.closest("[data-people-seal-act]");
    if (seal) {
      const id = (_c = (_b2 = seal.closest("[data-people-card]")) == null ? void 0 : _b2.dataset.peopleCard) != null ? _c : "";
      if (id) void sealAction((_d = seal.dataset.peopleSealAct) != null ? _d : "", id);
      return;
    }
    const leafHead = t.closest("[data-people-leaf-head]");
    if (leafHead) {
      const id = leafHead.dataset.peopleLeafHead;
      if (id && id !== detailFold) {
        detailFold = id;
        profEditId = null;
        noteAddId = null;
        void renderBody();
      }
      return;
    }
    const evMonHead = t.closest("[data-people-ev-mon]");
    if (evMonHead) {
      const group = evMonHead.closest(".bz-people-ev-mon");
      if (group) {
        const on = group.classList.toggle("bz-people-ev-mon-on");
        evMonHead.setAttribute("aria-label", `${on ? "收起" : "展开"} ${(_f = (_e = evMonHead.querySelector(".bz-people-ev-mon-name")) == null ? void 0 : _e.textContent) != null ? _f : ""}`);
      }
      return;
    }
    const card = t.closest("[data-people-card]");
    if (card) {
      detailId = (_g = card.dataset.peopleCard) != null ? _g : null;
      detailFold = "p";
      stage = "detail";
      void renderBody();
      return;
    }
    if (t.closest("[data-people-prof-new]") || t.closest("[data-people-prof-edit]")) {
      profEditId = detailId;
      void renderBody();
      return;
    }
    if (t.closest("[data-people-prof-cancel]")) {
      profEditId = null;
      void renderBody();
      return;
    }
    if (t.closest("[data-people-prof-save]")) {
      void saveProfile();
      return;
    }
    if (t.closest("[data-people-prof-ai]")) {
      void aiFillProfile();
      return;
    }
    if (t.closest("[data-people-prof-add-social]")) {
      (_h = overlay == null ? void 0 : overlay.querySelector("[data-people-prof-social-list]")) == null ? void 0 : _h.appendChild(socialRow("", ""));
      return;
    }
    if (t.closest("[data-people-prof-tag-add]")) {
      addTagChip();
      return;
    }
    if (t.closest("[data-people-prof-tag-del]")) {
      (_i = t.closest(".bz-people-prof-tag")) == null ? void 0 : _i.remove();
      return;
    }
    if (t.closest("[data-people-prof-social-del]")) {
      (_j = t.closest(".bz-people-prof-social-row")) == null ? void 0 : _j.remove();
      return;
    }
    if (t.closest("[data-people-note-open]")) {
      openNotePop();
      return;
    }
    if (t.closest("[data-people-note-cancel]")) {
      noteOpen = false;
      void renderBody();
      return;
    }
    if (t.closest("[data-people-note-save]")) {
      void saveManualNote();
      return;
    }
    const evDel = t.closest("[data-people-ev-del]");
    if (evDel) {
      void removeManualNote((_k = evDel.dataset.peopleEvDel) != null ? _k : "");
      return;
    }
  }
  function onOverlayChange(e) {
    var _a2;
    const el2 = e.target;
    if (el2.matches("[data-people-ds-check]")) {
      const name = (_a2 = el2.dataset.peopleDsCheck) != null ? _a2 : "";
      if (el2.checked) dsSelected.add(name);
      else dsSelected.delete(name);
      updateDsFooter();
    }
  }
  function pickFresh() {
    for (const c of dsContacts != null ? dsContacts : []) {
      if (c.newCount > 0 && !c.isGroup) dsSelected.add(c.name);
    }
    syncDsChecks();
  }
  function syncDsChecks() {
    overlay == null ? void 0 : overlay.querySelectorAll("[data-people-ds-check]").forEach((cb) => {
      var _a2, _b2;
      const name = (_a2 = cb.dataset.peopleDsCheck) != null ? _a2 : "";
      cb.checked = dsSelected.has(name);
      (_b2 = cb.closest(".bz-people-ds-row")) == null ? void 0 : _b2.classList.toggle("bz-people-ds-on", cb.checked);
    });
    updateDsFooter();
  }
  function updateDsFooter() {
    const sel = (dsContacts != null ? dsContacts : []).filter((c) => dsSelected.has(c.name));
    const fresh = sel.reduce((s, c) => s + c.newCount, 0);
    const label = !sel.length ? "未勾选联系人" : fresh ? `已选 ${sel.length} 位 · 新素材 ${fresh} 条` : `已选 ${sel.length} 位 · 所选暂无新素材`;
    const count = overlay == null ? void 0 : overlay.querySelector("[data-people-ds-count]");
    if (count) count.textContent = label;
    overlay == null ? void 0 : overlay.querySelectorAll("[data-people-ds-check]").forEach((cb) => {
      var _a2;
      (_a2 = cb.closest(".bz-people-ds-row")) == null ? void 0 : _a2.classList.toggle("bz-people-ds-on", cb.checked);
    });
  }
  async function renderBody() {
    var _a2, _b2;
    const body = overlay == null ? void 0 : overlay.querySelector("[data-people-body]");
    if (!body || !store || !overlay) return;
    if (!(peopleSafe == null ? void 0 : peopleSafe.unlocked)) {
      listCache = [];
      recordCache = null;
      body.replaceChildren(lockedBody());
      (_a2 = overlay.querySelector(".bz-people-panel")) == null ? void 0 : _a2.classList.toggle("bz-people-panel-detail", false);
      renderDsLayer();
      renderJobs();
      applySyncLockdown();
      mountIcons(overlay);
      return;
    }
    const people = await wallPeople();
    if (!overlay || !(peopleSafe == null ? void 0 : peopleSafe.unlocked)) return;
    if (stage === "list") await renderList(body, people);
    else await renderDetail(body, people);
    (_b2 = overlay.querySelector(".bz-people-panel")) == null ? void 0 : _b2.classList.toggle("bz-people-panel-detail", stage === "detail");
    renderDsLayer();
    renderPopLayer(people);
    renderJobs();
    applySyncLockdown();
    mountIcons(overlay);
  }
  function lockedBody() {
    const wrap = document.createElement("div");
    wrap.className = "bz-people-locked";
    const tip = document.createElement("div");
    tip.className = "bz-people-locked-tip";
    tip.textContent = "保险库已上锁——脸谱数据已加密，解锁后才能查看。";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bz-people-locked-btn";
    btn.textContent = "解锁保险库";
    btn.addEventListener("click", () => {
      void (async () => {
        if (!peopleSafe && overlay) peopleSafe = await getPeopleSafeStore();
        if ((peopleSafe == null ? void 0 : peopleSafe.unlocked) || await unlockGate()) void renderBody();
      })();
    });
    wrap.appendChild(tip);
    wrap.appendChild(btn);
    return wrap;
  }
  function renderDsLayer() {
    const layer = overlay == null ? void 0 : overlay.querySelector("[data-people-ds-layer]");
    if (!layer) return;
    layer.hidden = !dsOpen;
    layer.replaceChildren();
    if (dsOpen) layer.appendChild(dsModal(dsModalState()));
  }
  function renderPopLayer(people) {
    const layer = overlay == null ? void 0 : overlay.querySelector("[data-people-pop-layer]");
    if (!layer) return;
    const p = statsOpen || profOpen || noteOpen ? people.find((x) => x.id === detailId) : null;
    if (!p) {
      statsOpen = false;
      profOpen = false;
      noteOpen = false;
      layer.hidden = true;
      layer.replaceChildren();
      return;
    }
    layer.hidden = false;
    layer.replaceChildren(
      statsOpen ? popShell("互动统计", "data-people-stats-pop", statsPopBody(buildInsightsCard(p), p)) : profOpen ? popShell("补充背景", "data-people-prof-pop", profilePopBody(p, profEditId === p.id)) : popShell("记一笔", "data-people-note-pop", [noteAddRow(todayStr())])
    );
  }
  var recordCache = null;
  async function records() {
    if (recordCache) return recordCache;
    if (!peopleSafe) peopleSafe = await getPeopleSafeStore();
    try {
      recordCache = await peopleSafe.readAll();
    } catch (e) {
      console.warn("[people] 读取保库记录失败:", e);
      recordCache = /* @__PURE__ */ new Map();
    }
    return recordCache;
  }
  function poolRecord(id, contact) {
    var _a2, _b2, _c, _d, _e, _f, _g;
    if (!contact) return null;
    const msgs = storeToUnified((_a2 = contact.msgs) != null ? _a2 : []);
    if (!msgs.length) return null;
    return {
      file: `数据源:${id}`,
      importedAt: contact.updatedAt || new Date(msgs[msgs.length - 1].ts).toISOString(),
      messageCount: msgs.length,
      skippedCount: 0,
      timeFrom: new Date(msgs[0].ts).toISOString(),
      timeTo: new Date(msgs[msgs.length - 1].ts).toISOString(),
      // issue 454：媒体计数取聊天仓侧写（导入时从原始消息算的，语音总时长只有它知道）——
      // 缺了它，合成卡与详情头的「语音 / 图片」永远是「—」（大琳 1289 条语音 / 1615 张图看不见）。
      // 只带媒体三项：月度 / 时段明细聊天仓没有，不在这编造——「数据」折见无 monthly 即出占位。
      stats: {
        voiceCount: (_c = (_b2 = contact.stats) == null ? void 0 : _b2.voiceCount) != null ? _c : 0,
        voiceTotalSec: (_e = (_d = contact.stats) == null ? void 0 : _d.voiceTotalSec) != null ? _e : 0,
        imageCount: (_g = (_f = contact.stats) == null ? void 0 : _f.imageCount) != null ? _g : 0
      }
    };
  }
  async function wallPeople() {
    const people = store ? await store.list() : [];
    const recs = await records();
    const out = people.map((p) => {
      var _a2;
      const rec = p.imports.length ? null : poolRecord(p.id, (_a2 = recs.get(p.id)) == null ? void 0 : _a2.store);
      return rec ? { ...p, imports: [rec] } : p;
    });
    const known = new Set(people.map((p) => p.id));
    for (const [id, r] of recs) {
      if (known.has(id)) continue;
      const pool = poolRecord(id, r.store);
      if (!pool) continue;
      out.push({ ...r.person, id, name: r.person.name || id, imports: [...r.person.imports, pool] });
    }
    return out;
  }
  async function ensureEntry(id) {
    var _a2, _b2;
    if (!store || !id) return;
    if ((await store.list()).some((p) => p.id === id)) return;
    const name = (_b2 = (_a2 = listCache.find((x) => x.id === id)) == null ? void 0 : _a2.name) != null ? _b2 : id;
    await store.upsert({ id, name, createdAt: (/* @__PURE__ */ new Date()).toISOString(), imports: [] });
  }
  async function renderList(body, people) {
    var _a2;
    const statsEl = overlay == null ? void 0 : overlay.querySelector("[data-people-stats]");
    if (statsEl) statsEl.textContent = statsText(people);
    listCache = people;
    body.replaceChildren();
    if (!people.length) {
      body.appendChild(wallEmpty());
      return;
    }
    const from = mergeFromId ? people.find((x) => x.id === mergeFromId) : null;
    if (mergeFromId && !from) {
      mergeFromId = null;
      mergeToId = null;
    } else if (from) {
      const to = mergeToId && mergeToId !== mergeFromId ? people.find((x) => x.id === mergeToId) : null;
      body.appendChild(mergeBar(from.name, (_a2 = to == null ? void 0 : to.name) != null ? _a2 : null));
    }
    const wall = foldWall();
    const avaMap = /* @__PURE__ */ new Map();
    if (peopleSafe == null ? void 0 : peopleSafe.unlocked) {
      for (const id of await peopleSafe.talkers()) {
        const url = await peopleSafe.avatarDataUrl(id);
        if (url) avaMap.set(id, url);
      }
    }
    applyWall(people, wall, (id) => avaMap.get(id));
    body.appendChild(wall);
  }
  async function handleDelete(id) {
    if (deleteArmId !== id) {
      disarmDelete();
      deleteArmId = id;
      deleteArmTimer = setTimeout(() => {
        disarmDelete();
        void renderBody();
      }, 3e3);
      void renderBody();
      return;
    }
    disarmDelete();
    if (!store) return;
    try {
      await store.remove(id);
      if (detailId === id) {
        detailId = null;
        stage = "list";
      }
      notice("已删除", "delete");
    } catch (e) {
      notifyActionError(e, "删除脸谱");
    }
    void renderBody();
  }
  function disarmDelete() {
    deleteArmId = null;
    if (deleteArmTimer) clearTimeout(deleteArmTimer);
    deleteArmTimer = null;
  }
  async function renderDetail(body, people) {
    const statsEl = overlay == null ? void 0 : overlay.querySelector("[data-people-stats]");
    if (statsEl) statsEl.textContent = statsText(people);
    const p = people.find((x) => x.id === detailId);
    body.replaceChildren();
    if (!p) {
      stage = "list";
      await renderList(body, people);
      return;
    }
    const media = personMedia(p);
    const avatar = (peopleSafe == null ? void 0 : peopleSafe.unlocked) ? await peopleSafe.avatarDataUrl(p.id) : null;
    body.appendChild(foldDetailHead(p, media, { canGenerate: !p.digest, job: sealJobOf(jobViews().get(p.id)), avatar: avatar != null ? avatar : void 0 }));
    const person = personOf(p.digest);
    const bond = bondOf(p.digest);
    const bodies = {
      p: detailFold === "p" ? foldPersonBody(person ? miniMarkdown(person) : null, p) : [],
      b: detailFold === "b" ? foldBondBody(bond ? miniMarkdown(bond) : null) : [],
      e: detailFold === "e" ? foldEventsBody(p) : []
    };
    body.appendChild(foldBook(p, { fold: detailFold }, bodies));
  }
  function buildInsightsCard(p) {
    var _a2, _b2, _c, _d, _e;
    if (!p.imports.length) return null;
    const latest = [...p.imports].sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
    const s = latest.stats;
    if (!((_a2 = s == null ? void 0 : s.monthly) == null ? void 0 : _a2.length)) return null;
    const totalMsg = s.monthly.reduce((a, [, n]) => a + n, 0);
    const rows = document.createElement("div");
    rows.className = "bz-people-ins-rows";
    const byMe = (_b2 = s.initiatedByMe) != null ? _b2 : 0;
    const byOther = (_c = s.initiatedByOther) != null ? _c : 0;
    const initiated = byMe + byOther;
    rows.appendChild(insRow("谁主动", initiated ? duoBar(Math.round(byMe / initiated * 100), Math.round(byOther / initiated * 100)) : duoBar(0, 0), initiated ? `我 ${byMe} · 对方 ${byOther}` : "暂无会话"));
    rows.appendChild(insRow("回复时延", "", `我 ${formatReplySec(replyLatencySec(s.myMedianReplySec, s.myAvgReplySec))} · 对方 ${formatReplySec(replyLatencySec(s.otherMedianReplySec, s.otherAvgReplySec))}`));
    const hourly = ((_d = s.myHourly) != null ? _d : []).map((n, i) => {
      var _a3, _b3;
      return n + ((_b3 = (_a3 = s.otherHourly) == null ? void 0 : _a3[i]) != null ? _b3 : 0);
    });
    const max = hourly.length ? Math.max(...hourly) : 0;
    const total = hourly.reduce((a, n) => a + n, 0);
    const strip = el("div", "bz-people-strip", hourly.map((n, i) => {
      const h = max > 0 && n > 0 ? Math.max(Math.round(n / max * 100), 6) : 0;
      return el("div", "bz-people-strip-bar", { style: `height:${h}%`, title: `${i} 点 · ${n} 条` });
    }));
    rows.appendChild(insRow("活跃时段", strip, total ? `峰值 ${hourly.indexOf(max)} 点` : "—"));
    const kinds = Object.entries((_e = s.kindCounts) != null ? _e : {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (kinds.length) rows.appendChild(insRow("消息形态", kindChips(kinds), ""));
    return insightsCard(importMeta(latest, totalMsg), latest.file, monthlyChart(s.monthly), rows);
  }
  function insRow(label, mid, val) {
    return el("div", "bz-people-ins-row", [
      el("span", "bz-people-ins-label", text(label)),
      typeof mid === "string" ? textEl("span", "") : mid,
      el("span", "bz-people-ins-val", text(val))
    ]);
  }
  function personMedia(p) {
    var _a2, _b2, _c;
    const acc = emptyMediaStats();
    for (const r of p.imports) {
      const s = r.stats;
      if (!s) continue;
      acc.voiceCount += (_a2 = s.voiceCount) != null ? _a2 : 0;
      acc.voiceTotalSec += (_b2 = s.voiceTotalSec) != null ? _b2 : 0;
      acc.imageCount += (_c = s.imageCount) != null ? _c : 0;
    }
    return acc.voiceCount || acc.imageCount ? acc : null;
  }
  function sortPeople(list) {
    const lastSeen = (p) => p.imports.reduce((m, r) => r.timeTo > m ? r.timeTo : m, "");
    return [...list].sort((a, b) => (lastSeen(b) || b.createdAt).localeCompare(lastSeen(a) || a.createdAt));
  }
  function applyWall(people, wall, avatarOf) {
    wall.replaceChildren();
    const map = jobViews();
    for (const p of sortPeople(people)) {
      wall.appendChild(foldCard(p, {
        media: personMedia(p),
        mergeFrom: p.id === mergeFromId,
        mergePick: Boolean(mergeFromId) && p.id !== mergeFromId,
        job: sealJobOf(map.get(p.id)),
        // 451：印章四态（任务态压过脸谱水位）
        avatar: avatarOf(p.name)
      }));
    }
  }
  async function handleMergeConfirm() {
    var _a2, _b2;
    const fromId = mergeFromId;
    const toId = mergeToId;
    if (!store || !fromId || !toId || fromId === toId) return;
    const from = listCache.find((x) => x.id === fromId);
    const to = listCache.find((x) => x.id === toId);
    try {
      await store.mergeInto(fromId, toId);
      notice(`已把「${(_a2 = from == null ? void 0 : from.name) != null ? _a2 : fromId}」的导入记录与随手记并到「${(_b2 = to == null ? void 0 : to.name) != null ? _b2 : toId}」，原人物已删除。要更新脸谱可从数据源补画`, "success");
    } catch (e) {
      notifyActionError(e, "合并人物");
    }
    mergeFromId = null;
    mergeToId = null;
    void renderBody();
  }
  var profEditId = null;
  var noteAddId = null;
  function addTagChip() {
    var _a2;
    const input = overlay == null ? void 0 : overlay.querySelector("[data-people-prof-tag-input]");
    const list = overlay == null ? void 0 : overlay.querySelector("[data-people-prof-tag-list]");
    const v = ((_a2 = input == null ? void 0 : input.value) != null ? _a2 : "").trim();
    if (!input || !list || !v) return;
    const dupes = new Set(
      Array.from(list.querySelectorAll(".bz-people-prof-tag-text")).map((n) => {
        var _a3;
        return ((_a3 = n.textContent) != null ? _a3 : "").trim();
      })
    );
    if (!dupes.has(v)) list.appendChild(tagChip(v));
    input.value = "";
    input.focus();
  }
  var profAiBusy = false;
  async function aiFillProfile() {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j;
    if (profAiBusy || !store || !detailId || !overlay) return;
    const p = listCache.find((x) => x.id === detailId);
    if (!p) return;
    const dg = p.digest;
    if (!dg) {
      notice("还没有脸谱素材——先导入并画脸谱，AI 才有据可依", "warning");
      return;
    }
    if (profEditId !== detailId) {
      profEditId = detailId;
      await renderBody();
    }
    profAiBusy = true;
    notice("AI 正在读交往素材补充背景…", "info");
    try {
      const majors = dg.events.filter((e) => e.kind === "major");
      const mat = [
        ["交往事件", [...majors, ...dg.events.filter((e) => e.kind !== "major")].slice(0, 200).map((e) => `${e.ts} ${e.summary}`).join("\n")],
        ...((_a2 = dg.quotes) == null ? void 0 : _a2.length) ? [["代表性原话", dg.quotes.slice(0, 40).map((q) => `${q.who}：${q.text}`).join("\n")]] : [],
        ...((_b2 = dg.moments) == null ? void 0 : _b2.length) ? [["场景细节", dg.moments.slice(0, 30).map((m) => `${m.ts} ${m.summary}`).join("\n")]] : []
      ].map(([t, s]) => `【${t}】
${s}`).join("\n\n");
      const known = [
        ((_c = p.profile) == null ? void 0 : _c.birthday) ? `生日 ${p.profile.birthday}` : "",
        ((_d = p.profile) == null ? void 0 : _d.hometown) ? `家乡/现居 ${p.profile.hometown}` : "",
        ((_e = p.profile) == null ? void 0 : _e.job) ? `职业 ${p.profile.job}` : "",
        ((_f = p.profile) == null ? void 0 : _f.metVia) ? `认识方式 ${p.profile.metVia}` : "",
        ((_g = p.profile) == null ? void 0 : _g.metAt) ? `认识时间 ${p.profile.metAt}` : "",
        ((_i = (_h = p.profile) == null ? void 0 : _h.tags) == null ? void 0 : _i.length) ? `标签 ${p.profile.tags.join("、")}` : ""
      ].filter(Boolean).join("；");
      const prompt = [
        `你在帮用户完善好友「${p.name}」的档案。以下是已落盘的交往提炼素材。`,
        ...known ? [`已知档案（用户手填，不要覆盖也不要重复推断）：${known}`] : [],
        "",
        mat,
        "",
        "请推断档案缺失字段，只输出 JSON，不要解释、不要代码围栏：",
        '{"birthday":"","hometown":"","job":"","metVia":"","metAt":"","tags":[],"note":""}',
        "规则：",
        "- 只填素材能明确支撑的；没有证据的字段给空串 / 空数组，绝不编造。",
        "- birthday 仅当素材明确提到出生日期或生日时填（YYYY-MM-DD 或 MM-DD）。",
        "- metVia 一句话写怎么认识的；metAt 写认识时间（如 2023 年夏天）。",
        "- tags 2-3 个、每个不超过 6 字；note 一句话整体备注。"
      ].join("\n");
      const data = extractJsonLoose(await createAI().json(prompt));
      let filled = 0;
      for (const f of ["birthday", "metVia", "metAt", "hometown", "job", "note"]) {
        const v = String((_j = data[f]) != null ? _j : "").trim();
        if (!v) continue;
        const inp = overlay.querySelector(`[data-people-prof-field="${f}"]`);
        if (inp && !inp.value.trim()) {
          inp.value = v;
          filled++;
        }
      }
      const tags = Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim()).filter(Boolean) : [];
      const tagList = overlay.querySelector("[data-people-prof-tag-list]");
      if (tagList && tagList.children.length === 0 && tags.length) {
        for (const t of tags.slice(0, 3)) tagList.appendChild(tagChip(t));
        filled++;
      }
      if (filled > 0) notice(`AI 已补 ${filled} 项，请检查后点「保存档案」`, "success");
      else notice("素材里没有能支撑的档案信息，未作补充", "info");
    } catch (e) {
      notifyActionError(e, "AI 补充背景");
    } finally {
      profAiBusy = false;
    }
  }
  async function saveProfile() {
    if (!store || !detailId || !overlay) return;
    await ensureEntry(detailId);
    const val = (sel) => {
      var _a2, _b2, _c;
      return (_c = (_b2 = (_a2 = overlay.querySelector(sel)) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim()) != null ? _c : "";
    };
    const rows = Array.from(overlay.querySelectorAll(".bz-people-prof-social-row"));
    const socials = rows.map((row) => {
      var _a2, _b2, _c, _d, _e, _f;
      return {
        platform: (_c = (_b2 = (_a2 = row.querySelector("[data-people-prof-social-platform]")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim()) != null ? _c : "",
        handle: (_f = (_e = (_d = row.querySelector("[data-people-prof-social-handle]")) == null ? void 0 : _d.value) == null ? void 0 : _e.trim()) != null ? _f : ""
      };
    }).filter((s) => s.platform && s.handle);
    const partial = rows.length - socials.length;
    const tagTexts = Array.from(overlay.querySelectorAll("[data-people-prof-tag-list] .bz-people-prof-tag-text")).map((n) => {
      var _a2;
      return ((_a2 = n.textContent) != null ? _a2 : "").trim();
    }).filter(Boolean);
    const tags = [...new Set(tagTexts)];
    const profile = {};
    const f = {
      birthday: val('[data-people-prof-field="birthday"]'),
      metVia: val('[data-people-prof-field="metVia"]'),
      metAt: val('[data-people-prof-field="metAt"]'),
      hometown: val('[data-people-prof-field="hometown"]'),
      job: val('[data-people-prof-field="job"]'),
      note: val('[data-people-prof-field="note"]')
    };
    if (f.birthday) profile.birthday = f.birthday;
    if (f.metVia) profile.metVia = f.metVia;
    if (f.metAt) profile.metAt = f.metAt;
    if (f.hometown) profile.hometown = f.hometown;
    if (f.job) profile.job = f.job;
    if (f.note) profile.note = f.note;
    if (socials.length) profile.socials = socials;
    if (tags.length) profile.tags = tags;
    const empty = !socials.length && !tags.length && !Object.keys(profile).length;
    try {
      await store.updateProfile(detailId, empty ? void 0 : profile);
      profEditId = null;
      notice(empty ? "档案已清空" : "档案已保存", "success");
      if (partial > 0) notice(`${partial} 行社交账号没填完整，已跳过`, "warning");
    } catch (e) {
      notifyActionError(e, "保存档案");
    }
    void renderBody();
  }
  async function saveManualNote() {
    var _a2, _b2, _c, _d, _e;
    if (!store || !detailId || !overlay) return;
    const summary = (_c = (_b2 = (_a2 = overlay.querySelector("[data-people-note-text]")) == null ? void 0 : _a2.value) == null ? void 0 : _b2.trim()) != null ? _c : "";
    if (!summary) {
      notice("随手记还没写内容", "warning");
      return;
    }
    const ts = ((_e = (_d = overlay.querySelector("[data-people-note-date]")) == null ? void 0 : _d.value) == null ? void 0 : _e.trim()) || todayStr();
    try {
      await ensureEntry(detailId);
      await store.addManualEvent(detailId, { id: genId(), ts, summary, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      noteAddId = null;
      noteOpen = false;
      notice("已记一笔", "success");
    } catch (e) {
      notifyActionError(e, "记随手记");
    }
    void renderBody();
  }
  async function removeManualNote(evId) {
    var _a2, _b2;
    if (!store || !detailId || !evId) return;
    try {
      const found = (_b2 = (_a2 = (await store.list()).find((p) => p.id === detailId)) == null ? void 0 : _a2.manualEvents) == null ? void 0 : _b2.find((m) => m.id === evId);
      await store.removeManualEvent(detailId, evId);
      const brief = (found == null ? void 0 : found.summary) ? `：${[...found.summary].slice(0, 20).join("")}${[...found.summary].length > 20 ? "…" : ""}` : "";
      notice(`已删除随手记${brief}`, "delete");
    } catch (e) {
      notifyActionError(e, "删除随手记");
    }
    void renderBody();
  }
  function todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function genId() {
    const c = typeof crypto !== "undefined" ? crypto : null;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
    return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  // src/people/settings.ts
  function peopleSettingsSchema(opts) {
    return {
      groups: [
        {
          icon: "folder-open",
          name: "数据源",
          rows: [
            {
              type: "text",
              name: "数据根目录",
              desc: "预处理导出的联系人数据目录，粘贴完整路径；空 = 面板不显示数据源入口",
              binding: { key: "peopleDataDir" },
              placeholder: "例如 D:\\微信备份\\export_full"
            },
            // 微信账号目录（issue 462）：多账号数据目录下指定用哪个账号；空 = 自动探测
            // （探测与覆盖逻辑由后续票接入，本票只加键位与文案）
            {
              type: "text",
              name: "微信账号目录",
              desc: "数据目录下的微信账号文件夹，留空自动探测",
              binding: { key: "peopleWxAccountDir" },
              placeholder: "空 = 自动探测"
            },
            {
              type: "toggle",
              name: "群聊纳入列表",
              desc: "多位发送者的会话也进勾选列表",
              binding: { key: "peopleIncludeGroups" }
            }
          ]
        },
        {
          icon: "eye",
          name: "聊天仓",
          rows: [
            {
              type: "toggle",
              name: "语音转写",
              desc: "语音消息以转写文本进时间线",
              binding: { key: "peoplePreviewVoice" }
            },
            {
              type: "select",
              name: "图片描述",
              desc: "有描述的图片以描述文本进时间线（chat.json 已回填，读文件为兼容兜底）；无描述只计数",
              binding: { key: "peopleImageDescMode" },
              options: [
                { value: "file", label: "文件描述" },
                { value: "off", label: "仅标签" }
              ]
            },
            {
              type: "toggle",
              name: "视频标签",
              desc: "视频消息以时长标签进时间线",
              binding: { key: "peoplePreviewVideo" }
            },
            {
              type: "toggle",
              name: "系统消息",
              desc: "撤回与打招呼等锚点消息保留",
              binding: { key: "peopleKeepSystem" }
            }
          ]
        },
        {
          icon: "shield",
          name: "隐私",
          rows: [
            {
              type: "info",
              name: "数据在保险库里",
              desc: "人物卡、聊天数据、任务与头像按联系人各存一条保险库加密记录，与保险库共用主密码；上锁即不可读"
            },
            {
              type: "info",
              name: "媒体本体不入库",
              desc: "图片语音视频文件留在外部数据目录，加密记录只存消息与路径；头像以密文附件随记录走"
            },
            {
              type: "button",
              name: "清空聊天数据",
              buttonText: "清空",
              cta: true,
              desc: "清掉各加密记录里的消息数据（需先解锁），不动已生成的脸谱",
              onClick: () => {
                var _a2;
                return void ((_a2 = opts == null ? void 0 : opts.onClearStore) == null ? void 0 : _a2.call(opts));
              }
            }
          ]
        }
      ]
    };
  }

  // prototypes/people/fake-sim.ts
  var PEOPLE_KEY = "bz-sim:CONFIG/STORAGE/people.json";
  var PREVIEW_KEY = "bz-sim:CONFIG/STORAGE/people-preview.json";
  var DS_ROOT = "D:/演示数据/export_full";
  var sidSeq = 9e11;
  var ctSeq = Math.floor((/* @__PURE__ */ new Date("2024-01-02T09:00:00")).getTime() / 1e3);
  function mk(n, who, msg, over = {}) {
    sidSeq += 7;
    ctSeq += 180 + sidSeq % 7 * 60;
    return { ct: ctSeq, type: 1, who, msg, sid: sidSeq, ...over };
  }
  function flow(n, name, startSid) {
    const out = [];
    sidSeq = startSid;
    ctSeq = Math.floor((/* @__PURE__ */ new Date("2024-01-02T09:00:00")).getTime() / 1e3);
    const lines = [
      ["我", "早，今天碰一下进度？"],
      [name, "好，十点会议室"],
      ["我", "接口那块我晚上再过一遍"],
      [name, "[语音 12秒·平静] 行，不急，把边界确认清楚就行"],
      [name, "[图片] 这是现在的报错截图"],
      ["我", "看到了，午休后我改完发你"],
      [name, "辛苦"],
      ["我", "[语音 8秒·开心] 搞定了，你瞅瞅"],
      [name, '"对方" 撤回了一条消息'],
      [name, "没问题了，收工"]
    ];
    for (let i = 0; i < n; i++) {
      const [who, msg] = lines[i % lines.length];
      out.push(mk(1, who, msg));
    }
    return out;
  }
  function statsOf(monthly, voice, sec, image, text2) {
    const kinds = { 文本: text2, 语音: voice, 图片: image, 系统: Math.round(voice / 8) + 2 };
    return {
      monthly,
      initiatedByMe: 42,
      initiatedByOther: 61,
      myAvgReplySec: 310,
      otherAvgReplySec: 640,
      myHourly: [1, 0, 0, 0, 0, 2, 6, 14, 22, 18, 12, 9, 16, 11, 8, 10, 14, 19, 23, 30, 42, 51, 38, 12],
      otherHourly: [2, 0, 0, 0, 0, 1, 3, 9, 17, 25, 14, 8, 12, 9, 7, 12, 18, 26, 31, 44, 57, 66, 45, 16],
      kindCounts: kinds,
      voiceCount: voice,
      voiceTotalSec: sec,
      imageCount: image
    };
  }
  function months(count, base, drift) {
    const out = [];
    const start = (/* @__PURE__ */ new Date("2024-06-01T00:00:00")).getTime();
    for (let i = 0; i < count; i++) {
      const d = new Date(start + i * 30 * 864e5);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push([label, Math.max(4, Math.round(base + Math.sin(i / 2.2) * drift + i * 3))]);
    }
    return out;
  }
  function seedPeople() {
    const iso = (s) => new Date(s).toISOString();
    return JSON.stringify({
      version: 1,
      people: [
        {
          id: "陈默",
          name: "陈默",
          createdAt: iso("2026-03-01T10:00:00"),
          lastProcessedTs: ctSeq * 1e3 - 864e5 * 30,
          imports: [{
            file: "数据源:陈默",
            importedAt: iso("2026-03-12T21:00:00"),
            messageCount: 12847,
            skippedCount: 921,
            timeFrom: iso("2024-06-01T00:00:00"),
            timeTo: iso("2026-03-12T21:00:00"),
            stats: statsOf(months(21, 520, 300), 891, 15120, 342, 11200)
          }],
          digest: {
            portrait: "## 相处模式\n陈默把情绪都收进工作节奏里：白天的回复短促克制，深夜的语音语速会慢下来。\n\n## 表达 DNA\n- 口头禅：「不急」「稳两年」「瞅瞅」\n- 少发长文字，生日凌晨的一段六十秒语音四年没断过\n> 有你在心里有底\n\n## 情绪底色\n平静占七成，开心对齐项目节点；生气只出现过三次，两次与临时改需求有关。",
            events: [
              { ts: "2026-03-02", summary: "项目上线前连续一周陪他改方案到凌晨，他说「有你在心里有底」。", kind: "major" },
              { ts: "2025-11-18", summary: "父亲体检结果出来那天他请了假，晚上发来很长的语音。", kind: "major" },
              { ts: "2025-06-14", summary: "一起出差杭州，高铁上聊职业转型，他倾向再稳两年。", kind: "minor" }
            ],
            quotes: [
              { ts: "2026-03-02", who: "对方", text: "有你在心里有底。" },
              { ts: "2025-11-18", who: "对方", text: "人到中年就是这样。" }
            ],
            chronicle: "## 2022\n六月入职同组，第一句话是「工位插排在哪」。\n\n## 2024\n搬到你家附近三公里，深夜语音明显变多。\n\n## 2025\n父亲一场大病，半年回老家四次；开始规律跑步。\n\n## 2026\n主导新系统迁移，上线后语音里第一次说出「成就感」。",
            generatedAt: iso("2026-03-12T21:30:00")
          },
          profile: { tags: ["同事", "项目搭档"], job: "后端工程师", metVia: "入职同组", note: "项目主力搭档" },
          manualEvents: [{ id: "ev-seed-1", ts: "2026-03-15", summary: "他推荐的那家面馆确实好吃。", createdAt: iso("2026-03-15T12:00:00") }]
        },
        {
          id: "林晚",
          name: "林晚",
          createdAt: iso("2026-02-20T10:00:00"),
          lastProcessedTs: ctSeq * 1e3 - 864e5 * 40,
          imports: [{
            file: "数据源:林晚",
            importedAt: iso("2026-03-01T20:00:00"),
            messageCount: 8432,
            skippedCount: 512,
            timeFrom: iso("2024-06-01T00:00:00"),
            timeTo: iso("2026-03-01T20:00:00"),
            stats: statsOf(months(21, 340, 200), 512, 9360, 901, 6900)
          }],
          digest: {
            portrait: "## 相处模式\n家人档：大事说一半留一半，怕你担心；日常全是「吃了吗」「降温了」。\n\n## 表达 DNA\n- 语音比文字多，转发养生文章会补一句「别嫌我啰嗦」",
            events: [{ ts: "2026-01-28", summary: "过年回家的票她提前一个月就买好了。", kind: "major" }],
            generatedAt: iso("2026-03-01T20:30:00")
          }
        },
        {
          id: "周远山",
          name: "周远山",
          createdAt: iso("2026-03-10T10:00:00"),
          imports: [{
            file: "数据源:周远山",
            importedAt: iso("2026-03-10T22:00:00"),
            messageCount: 6920,
            skippedCount: 210,
            timeFrom: iso("2024-06-01T00:00:00"),
            timeTo: iso("2026-03-10T22:00:00"),
            stats: statsOf(months(21, 280, 160), 320, 6480, 188, 6300)
          }]
        },
        {
          id: "77",
          name: "77",
          createdAt: iso("2026-03-18T10:00:00"),
          imports: [{
            file: "数据源:77",
            importedAt: iso("2026-03-18T12:00:00"),
            messageCount: 1060,
            skippedCount: 7,
            timeFrom: iso("2024-06-01T00:00:00"),
            timeTo: iso("2026-03-18T12:00:00"),
            stats: statsOf(months(21, 44, 30), 0, 0, 8, 1040)
          }]
        },
        {
          id: "A8号公寓连锁酒店18295475558",
          name: "A8号公寓连锁酒店18295475558",
          createdAt: iso("2026-03-20T10:00:00"),
          imports: [{
            file: "数据源:A8号公寓连锁酒店",
            importedAt: iso("2026-03-20T12:00:00"),
            messageCount: 1,
            skippedCount: 0,
            timeFrom: iso("2026-03-01T00:00:00"),
            timeTo: iso("2026-03-01T00:00:00")
          }]
        }
      ]
    });
  }
  function seedPreview(dsFiles) {
    const read = (name) => {
      try {
        return JSON.parse(dsFiles[`${DS_ROOT}/${name}/chat.json`]);
      } catch (e) {
        return [];
      }
    };
    const contacts = {};
    const build = (name, take) => {
      const raws = read(name).slice(0, take);
      const msgs = raws.map((m) => {
        var _a2, _b2;
        return {
          key: `s${m.sid}:${m.ct}`,
          ts: m.ct * 1e3,
          isSender: m.who === "我",
          type: (_a2 = m.type) != null ? _a2 : 1,
          text: String((_b2 = m.msg) != null ? _b2 : "")
        };
      });
      const media = collectMediaStats(msgs);
      contacts[name] = {
        msgs,
        watermarkSid: raws.length ? Math.max(...raws.map((m) => m.sid)) : 0,
        stats: { msgCount: msgs.length, voiceCount: media.voiceCount, voiceTotalSec: media.voiceTotalSec, imageCount: media.imageCount },
        updatedAt: "2026-03-12T21:00:00.000Z"
      };
    };
    build("陈默", Math.max(0, read("陈默").length - 12));
    build("林晚", read("林晚").length);
    build("周远山", read("周远山").length);
    build("苏黎", read("苏黎").length);
    return JSON.stringify({ version: 2, contacts });
  }
  function buildDsFiles() {
    const files = {};
    files[`${DS_ROOT}/陈默/chat.json`] = JSON.stringify([...flow(52, "陈默", 91e10)]);
    files[`${DS_ROOT}/林晚/chat.json`] = JSON.stringify([...flow(40, "林晚", 92e10)]);
    files[`${DS_ROOT}/周远山/chat.json`] = JSON.stringify([...flow(36, "周远山", 93e10)]);
    files[`${DS_ROOT}/77/chat.json`] = JSON.stringify([...flow(22, "77", 94e10)]);
    files[`${DS_ROOT}/苏黎/chat.json`] = JSON.stringify([...flow(12, "苏黎", 95e10)]);
    const group = [
      mk(1, "老周", "周末回不回来吃饭", { sid: 960000000001 }),
      mk(1, "大姐", "票我买好了", { sid: 960000000002 }),
      mk(1, "我", "回", { sid: 960000000003 })
    ];
    files[`${DS_ROOT}/老周家/chat.json`] = JSON.stringify(group);
    return files;
  }
  function installFakeFs(files) {
    if (typeof window === "undefined") return;
    const w = window;
    w.require = (m) => {
      if (m !== "fs") return void 0;
      return {
        readdirSync: (p, _opts) => Object.keys(files).filter((k) => k.startsWith(p.replace(/\\/g, "/") + "/")).map((k) => k.slice(p.length + 1).split("/")[0]).filter((v, i, a) => a.indexOf(v) === i).map((name) => ({ isDirectory: () => true, name })),
        existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p.replace(/\\/g, "/")),
        readFileSync: (p) => {
          const hit = files[p.replace(/\\/g, "/")];
          if (hit === void 0) throw new Error(`fake fs: ${p} 不存在`);
          return hit;
        }
      };
    };
  }
  var _a, _b;
  var demoSettings = {
    storagePath: "CONFIG/STORAGE",
    // 数据目录可由壳启动钩子覆盖（window.BZW_PEOPLE.SEED.DATA_DIR，评审页注入真实目录用）；缺省演示目录
    peopleDataDir: typeof window !== "undefined" && ((_b = (_a = window.BZW_PEOPLE) == null ? void 0 : _a.SEED) == null ? void 0 : _b.DATA_DIR) || DS_ROOT,
    peopleIncludeGroups: false,
    peoplePreviewVoice: true,
    peopleImageDescMode: "file",
    peoplePreviewVideo: true,
    peopleKeepSystem: true
  };
  var booted = false;
  function bootPeopleSim() {
    var _a2, _b2, _c;
    if (booted) return;
    booted = true;
    const app = new FakeApp();
    setApp(app);
    if (localStorage.getItem(PEOPLE_KEY) == null) localStorage.setItem(PEOPLE_KEY, seedPeople());
    const dsFiles = (_c = (_b2 = (_a2 = window.BZW_PEOPLE) == null ? void 0 : _a2.SEED) == null ? void 0 : _b2.DS_FILES) != null ? _c : buildDsFiles();
    window.BZW_PEOPLE = { SEED: { DS_FILES: dsFiles } };
    if (localStorage.getItem(PREVIEW_KEY) == null) localStorage.setItem(PREVIEW_KEY, seedPreview(dsFiles));
    installFakeFs(dsFiles);
    setSettingsProvider(() => demoSettings);
    void peopleSettingsSchema();
  }
  function openPanel() {
    openPeoplePanel();
  }
  function togglePanel() {
    if (isPeopleOpen()) closePeoplePanel();
    else openPeoplePanel();
  }
  function demoOpenDataSource() {
    openPeoplePanel();
    openDataSource();
  }
  function demoReset() {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("bz-sim:")) kill.push(k);
    }
    for (const k of kill) localStorage.removeItem(k);
    location.reload();
  }
  return __toCommonJS(fake_sim_exports);
})();
/*! Bundled license information:

moment/moment.js:
  (*! moment.js *)
  (*! version : 2.30.1 *)
  (*! authors : Tim Wood, Iskren Chernev, Moment.js contributors *)
  (*! license : MIT *)
  (*! momentjs.com *)
*/
