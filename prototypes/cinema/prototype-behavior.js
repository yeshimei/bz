/* 源指纹 c1717d3f6338c8f2 · 仓内输入 71 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/cinema/fake-sim.ts","prototypes/cinema/fake/fake-obsidian.ts","src/cinema/constants.ts","src/cinema/data.ts","src/cinema/douban-fetcher.ts","src/cinema/douban-queue.ts","src/cinema/index.ts","src/cinema/layouts/midnight/render.ts","src/cinema/motion.ts","src/cinema/recommend.ts","src/cinema/render.ts","src/cinema/seasons.ts","src/cinema/shared.ts","src/cinema/state.ts","src/cinema/type-decide.ts","src/cinema/ui.ts","src/cinema/yearbook/data.ts","src/cinema/yearbook/engine.ts","src/cinema/yearbook/index.ts","src/cinema/yearbook/kits.ts","src/cinema/yearbook/motions.ts","src/cinema/yearbook/scenes.ts","src/core/ai.ts","src/core/app.ts","src/core/crypto.ts","src/core/diary-format.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/http.ts","src/core/item-actions.ts","src/core/jev-fallback.ts","src/core/jev.ts","src/core/mobile.ts","src/core/model-limits.ts","src/core/notice.ts","src/core/obsidian-adapter.ts","src/core/path-classify.ts","src/core/settings-provider.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slide-pill.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/cinema/fake-sim.ts → window.BZW_cinema（行为单源预览包，issue 245/ADR-0106） */
var BZW_cinema = (() => {
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
        function createDate(y, m, d, h, M2, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M2, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M2, s, ms);
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

  // prototypes/cinema/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    addCinemaModal: () => addCinemaModal,
    bootCinemaSim: () => bootCinemaSim,
    closeCinema: () => closeCinema,
    openCinema: () => openCinema2
  });

  // prototypes/cinema/fake/fake-obsidian.ts
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768
  };
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.CN_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  var CANNED_PRESETS = [
    { keys: ["千与千寻", "宫崎骏", "龙猫", "动画"], genre: "剧情, 动画, 奇幻", area: "日本", isTv: false, director: "宫崎骏", actor: "柊瑠美, 入野自由", year: "2001", duration: "125分钟", score: "9.4", poster: "/__vault-media/1049345607.jpg", shortComment: "不管前方的路有多苦，只要走的方向正确，都比站在原地更接近幸福。" },
    { keys: ["三体"], genre: "剧情, 科幻", area: "中国大陆", isTv: true, director: "杨磊", actor: "张鲁一, 于和伟", year: "2023", duration: "45分钟", score: "8.7", poster: "/__vault-media/1164394344.jpg", shortComment: "不要回答。" },
    { keys: ["绝命毒师", "毒师", "美剧"], genre: "剧情, 犯罪, 惊悚", area: "美国", isTv: true, director: "文斯·吉里根", actor: "布莱恩·科兰斯顿", year: "2008", duration: "45分钟", score: "9.6", poster: "/__vault-media/1170083317.jpg", shortComment: "我就是危险本身。" },
    { keys: ["地球脉动", "纪录片", "行星"], genre: "纪录片", area: "英国", isTv: true, director: "阿拉斯泰尔·福瑟吉尔", actor: "大卫·爱登堡", year: "2006", duration: "50分钟", score: "9.7", poster: "/__vault-media/1214927835.jpg", shortComment: "这颗星球远比我们想象的更壮丽。" },
    { keys: ["星际穿越", "诺兰"], genre: "剧情, 科幻, 冒险", area: "美国", isTv: false, director: "克里斯托弗·诺兰", actor: "马修·麦康纳", year: "2014", duration: "169分钟", score: "9.4", poster: "/__vault-media/1215062315.jpg", shortComment: "爱是唯一可以超越时间与空间的事物。" }
  ];
  function presetIndexOf(q) {
    const i = CANNED_PRESETS.findIndex((p) => p.keys.some((k) => q.includes(k)));
    return i < 0 ? 0 : i;
  }
  function sidOf(i) {
    return `900${i + 1}`;
  }
  var CANNED_DOUBAN_MS = 500;
  var CANNED_JEV_MS = 1e3;
  var cannedDelay = (ms) => new Promise((r) => setTimeout(r, ms));
  function presetFromSid(url) {
    const m = /id=(\d+)/.exec(url);
    const i = m ? Number(m[1].slice(3)) - 1 : 0;
    return CANNED_PRESETS[i >= 0 && i < CANNED_PRESETS.length ? i : 0];
  }
  var PNG_1PX = new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    0,
    0,
    0,
    13,
    73,
    72,
    68,
    82,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    1,
    8,
    6,
    0,
    0,
    0,
    31,
    21,
    196,
    137,
    0,
    0,
    0,
    10,
    73,
    68,
    65,
    84,
    120,
    156,
    99,
    0,
    1,
    0,
    0,
    5,
    0,
    1,
    13,
    10,
    45,
    180,
    0,
    0,
    0,
    0,
    73,
    69,
    78,
    68,
    174,
    66,
    96,
    130
  ]);
  function bytesToDataUrl(data) {
    const bytes = new Uint8Array(data);
    const mime = bytes[0] === 137 && bytes[1] === 80 ? "image/png" : "image/jpeg";
    let bin = "";
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return `data:${mime};base64,${btoa(bin)}`;
  }
  async function shrinkMedia(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("media " + resp.status);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const w = Math.max(1, Math.min(240, bmp.width));
    const h = Math.max(1, Math.round(bmp.height / bmp.width * w));
    const cv = new OffscreenCanvas(w, h);
    const ctx = cv.getContext("2d");
    if (!ctx) return await blob.arrayBuffer();
    ctx.drawImage(bmp, 0, 0, w, h);
    return await (await cv.convertToBlob({ type: "image/jpeg", quality: 0.82 })).arrayBuffer();
  }
  function cannedSuggestJson(title, idx) {
    const p = CANNED_PRESETS[idx];
    return JSON.stringify([
      {
        title,
        id: sidOf(idx),
        img: p.poster,
        type: p.isTv ? "tv" : "movie",
        url: `https://movie.douban.com/subject/${sidOf(idx)}/?suggest=${encodeURIComponent(title)}`
      }
    ]);
  }
  function cannedApizero(p) {
    return JSON.stringify({
      code: 0,
      data: {
        name: "",
        year: p.year,
        score: p.score,
        director: p.director,
        actor: p.actor,
        genre: p.genre,
        area: p.area,
        duration: p.duration,
        episodes: "",
        is_tv: p.isTv,
        douban_url: "https://movie.douban.com/subject/1291561/",
        short_comment: p.shortComment,
        comment_author: "豆瓣用户"
      }
    });
  }
  var CANNED_AREA_TAG = {
    中国大陆: "国产剧",
    美国: "美剧",
    英国: "英剧",
    德国: "德剧",
    日本: "日剧",
    韩国: "韩剧",
    哥伦比亚: "哥伦比亚剧"
  };
  var CANNED_AREA_ANIME = { 日本: "日漫", 中国大陆: "国漫", 美国: "美漫" };
  function cannedChoice(state, keys) {
    var _a, _b;
    const grab = (re) => {
      var _a2, _b2, _c;
      return (_c = (_b2 = (_a2 = re.exec(state)) == null ? void 0 : _a2[1]) == null ? void 0 : _b2.trim()) != null ? _c : "";
    };
    const area = grab(/制片国家\/地区：([^\n]+)/).split(/[,，/]/)[0].trim();
    const genre = grab(/豆瓣类型：([^\n]+)/);
    const isTv = /是否剧集：是/.test(state);
    let guess = "";
    if (genre.includes("纪录片")) guess = "纪录片";
    else if (genre.includes("动画")) guess = (_a = CANNED_AREA_ANIME[area]) != null ? _a : "";
    else if (!isTv) guess = "电影";
    else guess = (_b = CANNED_AREA_TAG[area]) != null ? _b : "";
    return keys.includes(guess) ? guess : "以上都不是";
  }
  function cannedJev(body) {
    var _a, _b, _c;
    let state = "";
    let questions = {};
    try {
      const req = JSON.parse(body || "{}");
      state = String((_a = req.state) != null ? _a : "");
      questions = (_b = req.questions) != null ? _b : {};
    } catch (e) {
    }
    const answers = {};
    for (const [key, q] of Object.entries(questions)) {
      if ((q == null ? void 0 : q.type) === "choice") {
        const pick = cannedChoice(state, Object.keys((_c = q.criteria) != null ? _c : {}));
        answers[key] = { type: "choice", choice: pick, confidence: pick === "以上都不是" ? 0.31 : 0.93, probabilities: {} };
      } else if ((q == null ? void 0 : q.type) === "noul") {
        answers[key] = { type: "noul", noul: 0.88 };
      } else {
        answers[key] = { type: "score", score: 3, confidence: 0.8, legend: [] };
      }
    }
    return JSON.stringify({ model: "jev-canned", answers, usage: { input_tokens: 0, output_tokens: 0 } });
  }
  async function requestUrl(req) {
    var _a, _b, _c, _d;
    const url = typeof req === "string" ? req : String((_a = req == null ? void 0 : req.url) != null ? _a : "");
    const body = typeof req === "string" ? "" : String((_b = req == null ? void 0 : req.body) != null ? _b : "");
    const ok = (text) => ({
      status: 200,
      text,
      json: (() => {
        try {
          return JSON.parse(text || "null");
        } catch (e) {
          return null;
        }
      })(),
      arrayBuffer: new ArrayBuffer(0)
    });
    if (url.includes("subject_suggest")) {
      await cannedDelay(CANNED_DOUBAN_MS);
      const q = decodeURIComponent(((_d = (_c = /[?&]q=([^&]*)/.exec(url)) == null ? void 0 : _c[1]) != null ? _d : "").replace(/\+/g, " "));
      return ok(cannedSuggestJson(q || "未命名", presetIndexOf(q)));
    }
    if (url.includes("v1.apizero.cn")) {
      await cannedDelay(CANNED_DOUBAN_MS);
      return ok(cannedApizero(presetFromSid(url)));
    }
    if (url.includes("api.typesafe.ai")) {
      await cannedDelay(CANNED_JEV_MS);
      return ok(cannedJev(body));
    }
    if (url.includes("doubanio.com")) {
      return { status: 200, text: "", json: null, arrayBuffer: PNG_1PX.buffer.slice(0) };
    }
    if (url.startsWith("/__vault-media/")) {
      try {
        return { status: 200, text: "", json: null, arrayBuffer: await shrinkMedia(new URL(url, location.href).href) };
      } catch (e) {
        return { status: 200, text: "", json: null, arrayBuffer: PNG_1PX.buffer.slice(0) };
      }
    }
    if (url.includes("m.douban.com/rexxar")) return { status: 404, text: "", json: null, arrayBuffer: new ArrayBuffer(0) };
    throw new Error("原型环境无网络请求（fake obsidian requestUrl）");
  }
  var TFile = class {
    constructor() {
      this.path = "";
      this.name = "";
      this.basename = "";
      this.extension = "";
      this.stat = { ctime: 0, mtime: 0 };
    }
  };
  var MEDIA_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
  function absoluteMediaPath(path) {
    if (!path || !/^(file|https?):\/\//i.test(path)) return null;
    const base = decodeURIComponent(path.split("?")[0].split("/").pop() || "");
    return MEDIA_EXT_RE.test(base) ? base : null;
  }
  function mediaFile(base) {
    const f = new TFile();
    f.path = base;
    f.name = base;
    f.basename = base.replace(/\.[^.]+$/, "");
    f.extension = base.includes(".") ? base.split(".").pop() : "";
    return f;
  }
  function stripQuotes(v) {
    if (v.length >= 2 && (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  }
  function parseYaml(text) {
    const fm = {};
    let lastKey = null;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (/^\s*-\s+/.test(line)) {
        const v = stripQuotes(line.replace(/^\s*-\s+/, "").trim());
        if (!lastKey) continue;
        const cur = fm[lastKey];
        if (Array.isArray(cur)) cur.push(v);
        else fm[lastKey] = cur === "" || cur === void 0 ? [v] : [String(cur), v];
        continue;
      }
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      lastKey = key;
      if (val.startsWith("[") && val.endsWith("]")) {
        const inner = val.slice(1, -1).trim();
        fm[key] = inner ? inner.split(",").map((s) => stripQuotes(s.trim())) : [];
      } else {
        fm[key] = stripQuotes(val);
      }
    }
    return fm;
  }
  function serializeYaml(fm) {
    const lines = ["---"];
    for (const [k, v] of Object.entries(fm)) {
      if (v === void 0 || v === null) continue;
      if (Array.isArray(v)) {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`- ${String(item)}`);
      } else if (v === "") {
        lines.push(`${k}:`);
      } else {
        lines.push(`${k}: ${String(v)}`);
      }
    }
    lines.push("---", "");
    return lines.join("\n");
  }
  function splitFrontmatter(content) {
    var _a;
    const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/.exec(content);
    if (!m) return { frontmatter: null, body: content, had: false };
    return { frontmatter: parseYaml(m[1]), body: (_a = m[2]) != null ? _a : "", had: true };
  }
  var LS_PREFIX = "bz-sim:";
  var STAT_KEY = "bz-sim:__stat__";
  var FakeVault = class {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
      this.idSeq = 0;
      /** 文件系统 adapter（守卫面 = 影院海报下载用的 writeBinary / mkdir）。
       *  真机写的是 vault 相对路径下的真图；评审壳写进 localStorage 文件表的 **data URL**
       *  （getResourcePath 认 data: 直出）——「保存即落海报」这条链在原型里也要能闭环，
       *  否则建档后只能回落后台抓取，评审壳会弹出真机不会出现的抓取失败通知。 */
      this.adapter = {
        mkdir: async (_path) => void 0,
        writeBinary: async (path, data) => {
          localStorage.setItem(LS_PREFIX + path, bytesToDataUrl(data));
          const stats = this.stats();
          stats[path] = { ctime: Date.now(), mtime: Date.now() };
          this.saveStats(stats);
          this.emit("create", { path });
        }
      };
      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          if (!e.key || !e.key.startsWith(LS_PREFIX) || e.key === STAT_KEY) return;
          const path = e.key.slice(LS_PREFIX.length);
          this.emit(e.newValue == null ? "delete" : "modify", { path });
        });
      }
    }
    raw(path) {
      return localStorage.getItem(LS_PREFIX + path);
    }
    stats() {
      try {
        return JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
      } catch (e) {
        return {};
      }
    }
    saveStats(stats) {
      localStorage.setItem(STAT_KEY, JSON.stringify(stats));
    }
    makeFile(path) {
      if (this.raw(path) == null) return null;
      const s = this.stats()[path] || { ctime: 0, mtime: 0 };
      const f = new TFile();
      f.path = path;
      f.name = path.split("/").pop() || path;
      f.basename = f.name.replace(/\.[^.]+$/, "");
      f.extension = f.name.includes(".") ? f.name.split(".").pop() : "";
      f.stat = { ...s };
      return f;
    }
    getAbstractFileByPath(path) {
      const media = absoluteMediaPath(path);
      if (media) return mediaFile(media);
      return this.makeFile(path);
    }
    /** 资源 URL（真插件返回 vault 资源路径）：
     *  - http(s) 环境（`node scripts/preview-live.mjs` 起的评审服务）：`/__vault-media/<文件名>`，
     *    服务端按 basename 从**真实 vault** 现场取流——海报全量 1.8G 不可能入库，只留名不入图；
     *  - file:// 双击直开：无服务端 → 返回绝对路径，浏览器直读本地文件（原口径）。 */
    getResourcePath(f) {
      const raw = this.raw(f.path);
      if (raw && raw.startsWith("data:")) return raw;
      if (typeof location !== "undefined" && /^https?:$/.test(location.protocol)) {
        return "/__vault-media/" + encodeURIComponent(f.name);
      }
      return f.path;
    }
    /** 列 md 文件（getMarkdownFiles：跳过 __stat__ 等内部键；顺序 = localStorage 插入序） */
    getMarkdownFiles() {
      const paths = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
        const p = k.slice(LS_PREFIX.length);
        if (p.endsWith(".md")) paths.push(p);
      }
      return paths.map((p) => this.makeFile(p));
    }
    async read(f) {
      const raw = this.raw(f.path);
      if (raw == null) throw new Error("文件不存在：" + f.path);
      return raw;
    }
    async modify(f, content) {
      localStorage.setItem(LS_PREFIX + f.path, content);
      const stats = this.stats();
      const cur = stats[f.path] || { ctime: Date.now(), mtime: Date.now() };
      stats[f.path] = { ctime: cur.ctime, mtime: Date.now() };
      this.saveStats(stats);
      this.emit("modify", { path: f.path });
    }
    async create(path, content) {
      if (this.raw(path) != null) throw new Error("文件已存在：" + path);
      localStorage.setItem(LS_PREFIX + path, content);
      const stats = this.stats();
      stats[path] = { ctime: Date.now(), mtime: Date.now() };
      this.saveStats(stats);
      const f = this.makeFile(path);
      this.emit("create", f);
      return f;
    }
    async createFolder(_path) {
      return void 0;
    }
    /** 回收站删除（openConfirm 的 vault.trash；system 参数与 Obsidian 同形，原型的回收站即消失） */
    async trash(f, _system) {
      localStorage.removeItem(LS_PREFIX + f.path);
      const stats = this.stats();
      delete stats[f.path];
      this.saveStats(stats);
      this.emit("delete", { path: f.path });
    }
    /** 事件订阅（core/obsidian-adapter 的 vault.on/offref 同形；cb 可带第二参 rename oldPath） */
    on(evt, cb) {
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(cb);
      const id = ++this.idSeq;
      return { ref: id };
    }
    offref(_ref) {
      this.listeners.clear();
    }
    /** 内部派发（FakeFileManager 改名回放 rename 事件用） */
    emitEvent(evt, ...args) {
      this.emit(evt, ...args);
    }
    /** 内部迁移 stat（FakeFileManager.renameFile 用；源无记录则给当下时刻） */
    moveStat(from, to) {
      const stats = this.stats();
      stats[to] = stats[from] || { ctime: Date.now(), mtime: Date.now() };
      delete stats[from];
      this.saveStats(stats);
    }
    emit(evt, ...args) {
      var _a;
      for (const cb of (_a = this.listeners.get(evt)) != null ? _a : []) cb(...args);
    }
  };
  var FakeFileManager = class {
    constructor(vault) {
      this.vault = vault;
    }
    async renameFile(file, newPath) {
      const content = localStorage.getItem(LS_PREFIX + file.path);
      if (content == null) throw new Error("改名失败，源文件不存在：" + file.path);
      localStorage.setItem(LS_PREFIX + newPath, content);
      localStorage.removeItem(LS_PREFIX + file.path);
      this.vault.moveStat(file.path, newPath);
      const oldPath = file.path;
      file.path = newPath;
      file.name = newPath.split("/").pop() || newPath;
      file.basename = file.name.replace(/\.[^.]+$/, "");
      this.vault.emitEvent("rename", file, oldPath);
    }
    /** frontmatter 读改写：fn 就地改 fm → 序列化回写（body 保留；无 frontmatter 的文件按 Obsidian 语义补建）→ 走 vault.modify（含事件） */
    async processFrontMatter(file, fn) {
      var _a;
      const content = (_a = localStorage.getItem(LS_PREFIX + file.path)) != null ? _a : "";
      const { frontmatter, body } = splitFrontmatter(content);
      const fm = frontmatter != null ? frontmatter : {};
      fn(fm);
      await this.vault.modify(file, serializeYaml(fm) + body);
    }
  };
  function seedVaultFiles(list) {
    let stats = {};
    try {
      stats = JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
    } catch (e) {
      stats = {};
    }
    for (const f of list) {
      localStorage.setItem(LS_PREFIX + f.path, f.content);
      stats[f.path] = { ctime: f.ctime, mtime: f.ctime };
    }
    localStorage.setItem(STAT_KEY, JSON.stringify(stats));
  }
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
      this.fileManager = new FakeFileManager(this.vault);
      this.metadataCache = {
        /** data.ts parseMovieFile 唯一消费面：现场解析 frontmatter（文件缺失/无 frontmatter → null） */
        getFileCache(file) {
          const content = localStorage.getItem(LS_PREFIX + file.path);
          if (content == null) return null;
          const { frontmatter } = splitFrontmatter(content);
          return frontmatter ? { frontmatter } : null;
        }
      };
    }
  };

  // src/core/app.ts
  var _app = null;
  function setApp(app) {
    _app = app;
  }
  function getApp() {
    if (!_app) {
      throw new Error("bz: app 未初始化（setApp 未调用）");
    }
    return _app;
  }

  // src/core/settings-provider.ts
  var _provider = null;
  var _saver = null;
  function setSettingsProvider(fn) {
    _provider = fn;
  }
  function setSettingsSaver(fn) {
    _saver = fn;
  }
  function tryGetSettings() {
    return _provider ? _provider() : {};
  }

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
  var _settingsProvider = null;
  function setAISettingsProvider(fn) {
    _settingsProvider = fn;
  }
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
      apiKeyKey: "deepseekApiKey",
      apiKeyLabel: "DeepSeek 密钥",
      apiKeyDesc: "留空则自动回退读取外部配置密钥",
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
      apiKeyKey: "zhipuPlanApiKey",
      apiKeyLabel: "智谱 Plan 密钥",
      apiKeyDesc: "智谱 Coding 套餐专用端点，密钥与智谱开放平台相同",
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
      apiKeyKey: "ollamaApiKey",
      apiKeyLabel: "Ollama 密钥",
      apiKeyDesc: "本地服务无需密钥，留空即可",
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
    var _a, _b;
    return (_b = (_a = getProviderDescriptor(providerId).thinking) == null ? void 0 : _a.levels) != null ? _b : [];
  }
  function thinkingBodyFor(providerId, level) {
    var _a;
    if (!providerId || !level || level === "auto") return null;
    const hit = thinkingLevelsOf(providerId).find((l) => l.value === level);
    return (_a = hit == null ? void 0 : hit.body) != null ? _a : null;
  }
  function hasExplicitThinkingOption(mo) {
    return "enable_thinking" in mo || "reasoning_effort" in mo || "thinking" in mo;
  }
  var _aiProviderCache = null;
  async function getAIProvider(override) {
    var _a, _b;
    if (!override && _aiProviderCache) return _aiProviderCache;
    const cacheable = !override;
    const cachePut = (p) => {
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
          return cachePut({
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
    const overrideModel = (_a = s.aiModelOverrides) == null ? void 0 : _a[name];
    const overrideMaxTokens = (_b = s.aiMaxTokensOverrides) == null ? void 0 : _b[name];
    const limits = resolveModelLimits(overrideModel || desc.model || "");
    return cachePut({
      id: name,
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: overrideModel || desc.model || void 0,
      defaultMaxTokens: overrideMaxTokens || (limits == null ? void 0 : limits.maxOutput) || desc.defaultMaxTokens
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
    const controller = new AbortController();
    const onOuterAbort = () => controller.abort();
    let outerLinked = false;
    if (signal) {
      if (signal.aborted) controller.abort();
      else {
        signal.addEventListener("abort", onOuterAbort);
        outerLinked = true;
      }
    }
    let idleTimer = null;
    const armIdle = () => {
      if (idleTimer !== null) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), idleMs);
    };
    try {
      armIdle();
      const resp = await fetch(`${provider.endpoint}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
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
      if (controller.signal.aborted && !(signal && signal.aborted)) throw timeoutError(idleMs);
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
    var _a;
    if (typeof input === "string") return input;
    const text = String((_a = input == null ? void 0 : input.text) != null ? _a : "");
    const images = (Array.isArray(input == null ? void 0 : input.images) ? input.images : []).map((u) => String(u != null ? u : "").trim()).filter((u) => u.length > 0);
    if (!images.length) return text;
    return [
      { type: "text", text },
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
      var _a;
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
        const thinking = thinkingBodyFor(provider.id, (_a = s.aiThinkingOverrides) == null ? void 0 : _a[provider.id || ""]);
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

  // src/core/domain-bus.ts
  var channels = /* @__PURE__ */ new Map();
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

  // src/core/diary-format.ts
  var DIARY_ENTRY_FILE_RE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:-(\d+))?\.md$/;
  function diaryMetaFromEntryPath(path) {
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    const m = DIARY_ENTRY_FILE_RE.exec(base);
    if (!m) return null;
    const date = `20${m[1]}-${m[2]}-${m[3]}`;
    const time = `${m[4]}:${m[5]}`;
    if (!isValidDiaryDate(date) || !isValidDiaryTime(time)) return null;
    return m[6] ? { date, time, seq: Number(m[6]) } : { date, time };
  }
  function diaryDateFromEntryPath(path) {
    var _a, _b;
    return (_b = (_a = diaryMetaFromEntryPath(path)) == null ? void 0 : _a.date) != null ? _b : null;
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

  // src/core/path-classify.ts
  function normalizeDir(dir) {
    return (dir || "").trim().replace(/\\/g, "/").replace(/\/+$/, "");
  }
  function isUnderDir(dir, p) {
    const d = normalizeDir(dir);
    if (!d) return false;
    return p === d || p.startsWith(d + "/");
  }
  function matchSettingDir(value, p, fallback) {
    const raw = typeof value === "string" && value.trim() ? value : fallback;
    return isUnderDir(raw, p);
  }
  function classifyFilePath(path) {
    if (!path) return null;
    const p = String(path).replace(/\\/g, "/");
    if (!p.endsWith(".md")) return null;
    const s = tryGetSettings();
    if (matchSettingDir(s.diaryDirectory, p, "我的/日记")) return "diary";
    if (isUnderDir("卡片盒", p)) return "flash";
    if (matchSettingDir(s.articleDirectory, p, "归档/网页剪藏")) return "clipping";
    if (matchSettingDir(s.cinemaFolderPath, p, "我的/影视")) return "cinema";
    if (isUnderDir("我的/现代诗", p)) return "poem";
    if (matchSettingDir(s.letterDirectory, p, "我的/信")) return "letter";
    if (matchSettingDir(s.knowledgeDirectory, p, "文献盒")) return "knowledge";
    return null;
  }
  function diaryDateFromPath(path) {
    return diaryDateFromEntryPath(path);
  }

  // src/core/obsidian-adapter.ts
  var attached = false;
  var boundVault = null;
  var boundRefs = [];
  function isMarkdownFile(file, path) {
    if (file && typeof file.extension === "string") return file.extension === "md";
    if (file && Array.isArray(file.children)) return false;
    return path.endsWith(".md");
  }
  function dispatchBasic(action, file) {
    const path = file && typeof file.path === "string" ? file.path : void 0;
    if (!path || !isMarkdownFile(file, path)) return;
    emitDomainEvent(`vault:md-${action}`, { path });
    const kind = classifyFilePath(path);
    if (!kind) return;
    if (kind === "diary") {
      const date = diaryDateFromPath(path);
      emitDomainEvent(`diary:file-${action}`, date ? { path, date } : { path });
      return;
    }
    emitDomainEvent(`${kind}:file-${action}`, { path });
  }
  function isFolder(file) {
    return !!(file && Array.isArray(file.children));
  }
  function dispatchRename(file, oldPath) {
    const newPath = file && typeof file.path === "string" ? file.path : void 0;
    if (!newPath || typeof oldPath !== "string" || !oldPath) return;
    if (isFolder(file)) return;
    const wasMd = oldPath.endsWith(".md");
    if (!wasMd && !isMarkdownFile(file, newPath)) return;
    emitDomainEvent("vault:md-renamed", { oldPath, newPath });
    const after = classifyFilePath(newPath);
    if (!after) return;
    const before = classifyFilePath(oldPath);
    const payload = {
      oldPath,
      newPath,
      movedOut: before !== after
      // 含旧无新有（移入域）；旧有新无时 after 为空、本事件不派发
    };
    if (after === "diary") {
      const date = diaryDateFromPath(newPath);
      if (date) payload.date = date;
    }
    emitDomainEvent(`${after}:file-renamed`, payload);
  }
  function attachObsidianAdapter(app, registerRef) {
    if (attached) return;
    const vault = app && app.vault;
    if (!vault || typeof vault.on !== "function") return;
    attached = true;
    boundVault = vault;
    const subscribe = (name, cb) => {
      const ref = vault.on(name, cb);
      boundRefs.push(ref);
      if (registerRef) registerRef(ref);
    };
    subscribe("create", (file) => dispatchBasic("created", file));
    subscribe("modify", (file) => dispatchBasic("modified", file));
    subscribe("delete", (file) => dispatchBasic("deleted", file));
    subscribe("rename", (file, oldPath) => dispatchRename(file, oldPath));
  }

  // src/core/esc-manager.ts
  var escManager = (() => {
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
  var panelEscHandles = /* @__PURE__ */ new Map();
  function registerPanelEsc(id, isVisible, close) {
    if (panelEscHandles.has(id)) return;
    panelEscHandles.set(id, escManager.register(id, { isVisible, close }));
  }
  function unregisterPanelEsc(id) {
    var _a;
    (_a = panelEscHandles.get(id)) == null ? void 0 : _a.unregister();
    panelEscHandles.delete(id);
  }

  // src/cinema/state.ts
  var DEFAULT_FOLDER = "我的/影视";
  function resolveCinemaFolderPath() {
    try {
      const s = tryGetSettings();
      return typeof s.cinemaFolderPath === "string" && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : DEFAULT_FOLDER;
    } catch (e) {
      return DEFAULT_FOLDER;
    }
  }
  var M = {
    currentOverlay: null,
    items: [],
    typeFilter: null,
    statusFilter: null,
    sortMode: "date",
    view: "list",
    searchKeyword: "",
    searchDebounceTimer: null,
    lastInputAt: 0,
    appRef: null,
    folderPath: DEFAULT_FOLDER,
    renderFn: null,
    aiRunning: false,
    aiWaitMsg: "",
    aiResult: null,
    aiError: null,
    aiBase: null
  };

  // src/cinema/constants.ts
  var STATUS_WANT = 0;
  var STATUS_WATCHING = 1;
  var STATUS_WATCHED = 2;
  var DEFAULT_RATING = 5;
  var ILLEGAL_NAME_CHARS = '\\\\/:*?"<>|';
  var ILLEGAL_NAME_RE = new RegExp(`[${ILLEGAL_NAME_CHARS}]`);
  var ILLEGAL_NAME_RE_GLOBAL = new RegExp(`[${ILLEGAL_NAME_CHARS}]`, "g");
  var TYPE_GROUPS = {
    电影: ["电影"],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: ["纪录片"],
    公开课: ["公开课"]
  };
  var ALL_TAGS = Object.values(TYPE_GROUPS).flat();
  var GROUP_ORDER = ["电影", "剧集", "动漫", "纪录片", "公开课", "其他"];
  var TYPE_COLORS = {
    电影: "#e6951d",
    剧集: "#3d7bd6",
    动漫: "#d64d8f",
    纪录片: "#45a35c",
    公开课: "#9b6dd4",
    其他: "#888"
  };
  function getGroupForTag(tag) {
    for (const [group, tags] of Object.entries(TYPE_GROUPS)) {
      if (tags.includes(tag)) return group;
    }
    return null;
  }
  function getGroupSafe(tag) {
    var _a;
    return (_a = getGroupForTag(tag)) != null ? _a : "其他";
  }
  function getStarString(rating) {
    if (!rating || rating <= 0) return "";
    const stars = Math.min(Math.round(rating / 2 * 2) / 2, 5);
    const full = Math.floor(stars);
    let s = "";
    for (let i = 0; i < full; i++) s += "★";
    for (let j = full; j < 5; j++) s += "☆";
    return s;
  }
  var ILLEGAL_NAME_HINT = '名称含非法字符（\\ / : * ? " < > |）';
  function hasIllegalNameChar(name) {
    return ILLEGAL_NAME_RE.test(name);
  }

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function pad2(n) {
    return String(n).padStart(2, "0");
  }
  function localNow() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }

  // src/core/utils.ts
  var import_moment = __toESM(require_moment());

  // src/core/z-order.ts
  var zCounter = 1e5;
  var alwaysOnTop = /* @__PURE__ */ new Set();
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

  // src/core/notice.ts
  var MAX_VISIBLE_DEFAULT = 5;
  function maxVisible() {
    const v = Number(noticePref("noticeMaxVisible"));
    return v === 3 || v === 8 ? v : MAX_VISIBLE_DEFAULT;
  }
  var LEAVE_MS = 200;
  var DEDUPE_WINDOW_MS = 3e4;
  var MOBILE_QUERY = "(max-width: 768px)";
  var ICONS = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    error: "❌",
    pause: "⏸️",
    delete: "🗑️",
    restore: "↩️",
    archive: "📁"
  };
  var SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
  function notice(msg, type, duration) {
    notify(msg, { type: type || "info", duration });
  }
  function notifySaveError(err, what) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(what ? `保存失败（${what}）：${msg}` : `保存失败：${msg}`, { type: "error" });
  }
  function isMobileView() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }
  function defaultVariant() {
    if (isMobileView()) return "drop";
    const pos = noticePref("noticePosition");
    return pos === "top-left" || pos === "bottom-left" ? "slide-left" : "slide-right";
  }
  var OUT_CLASS = {
    drop: "bz-notice--out-drop",
    pop: "bz-notice--out-pop",
    "slide-left": "bz-notice--out-left",
    "slide-right": "bz-notice--out-right",
    bounce: "bz-notice--out-fade",
    shake: "bz-notice--out-fade"
  };
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
  var POSITION_CLASSES = ["bz-notice-pos--bottom-right", "bz-notice-pos--bottom-left", "bz-notice-pos--top-left"];
  function applyPositionClass(container) {
    const pos = noticePref("noticePosition");
    container.classList.remove(...POSITION_CLASSES);
    const cls = pos === "bottom-right" || pos === "bottom-left" || pos === "top-left" ? `bz-notice-pos--${pos}` : "";
    if (cls) container.classList.add(cls);
  }
  var PER_CHAR_MS = 60;
  var SHORT_THRESHOLD = 20;
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
  var live = [];
  var recent = {};
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

  // src/core/utils.ts
  function escapeYamlText(s) {
    return String(s != null ? s : "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
  }
  function yamlScalarOf(val) {
    let s = String(val);
    if (/[\r\n]/.test(s)) s = s.replace(/[ \t]*[\r\n]+[ \t]*/g, " ");
    if (/[:"\-#[\]{}|>'?]/.test(s) || s.includes(" ")) {
      return '"' + escapeYamlText(s) + '"';
    }
    return s;
  }
  function escapeHtml2(str) {
    return str.replace(/[&<>"']/g, (m) => {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return "&#39;";
    });
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function openExternalUrl(app, url) {
    try {
      app.openUrl(url);
      return;
    } catch (e) {
    }
    try {
      const electron = window.require && window.require("electron");
      if (electron && electron.shell) {
        electron.shell.openExternal(url);
        return;
      }
    } catch (e) {
    }
    try {
      const w = window.open(url, "_blank");
      if (w) return;
    } catch (e) {
    }
    notice("无法打开链接，请复制到浏览器打开", "error");
  }

  // src/cinema/douban-fetcher.ts
  var POSTER_FOLDER = "CONFIG/MOVIE POSTER";
  function extractMovieName(filename) {
    const basename = stripMdExt(filename);
    const m = basename.match(/《(.+)》/);
    return m ? m[1] : basename;
  }
  function parseSuggestResults(jsonText) {
    var _a, _b;
    let items;
    try {
      items = JSON.parse(jsonText);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(items)) return [];
    const results = [];
    for (const it of items) {
      if (!it || it.type !== "movie" && it.type !== "tv" || !it.id) continue;
      results.push({
        title: String((_a = it.title) != null ? _a : "").trim(),
        detailUrl: `https://movie.douban.com/subject/${it.id}/`,
        posterUrl: String((_b = it.img) != null ? _b : "")
      });
    }
    return results;
  }
  function suggestLooksBlocked(jsonText) {
    if (!jsonText) return true;
    try {
      JSON.parse(jsonText);
      return false;
    } catch (e) {
      return true;
    }
  }
  function parseRexxarSearch(jsonText) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      return [];
    }
    const items = (_a = data == null ? void 0 : data.subjects) == null ? void 0 : _a.items;
    if (!Array.isArray(items)) return [];
    const results = [];
    for (const it of items) {
      const type = it == null ? void 0 : it.target_type;
      const sid = (_d = (_c = (_b = it == null ? void 0 : it.target) == null ? void 0 : _b.uri) == null ? void 0 : _c.match(/\/(\d+)/)) == null ? void 0 : _d[1];
      if (type !== "movie" && type !== "tv" || !sid) continue;
      results.push({
        title: String((_f = (_e = it.target) == null ? void 0 : _e.title) != null ? _f : "").trim(),
        detailUrl: `https://movie.douban.com/subject/${sid}/`,
        posterUrl: String((_h = (_g = it.target) == null ? void 0 : _g.cover_url) != null ? _h : "")
      });
    }
    return results;
  }
  function parseSearchResults(html) {
    const results = [];
    const itemRegex = /class="result"[\s\S]*?<div class="pic">[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?<div class="title">[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
    let match;
    while ((match = itemRegex.exec(html)) !== null) {
      const rawUrl = match[1];
      const posterUrl2 = match[2];
      const title = match[3].trim();
      const urlMatch = rawUrl.match(/url=([^&]+)/);
      const detailUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : rawUrl;
      results.push({ title, detailUrl, posterUrl: posterUrl2 });
    }
    return results;
  }
  function searchPageLooksBlocked(html) {
    if (!html) return true;
    if (html.length < 8e3) return true;
    return !html.includes('class="result"') && !html.includes("没有找到") && !html.includes("没有相关的搜索结果");
  }
  function upgradePosterUrl(url) {
    return url.replace("s_ratio_poster", "l_ratio_poster");
  }
  function normalizeListValue(val) {
    return val.replace(/[,，]\s*/g, " / ");
  }
  function extractSid(detailUrl) {
    const m = detailUrl.match(/subject\/(\d+)/);
    return m ? m[1] : null;
  }
  function parseCelebrities(data) {
    if (!data || data.msg) return { directors: "", writers: "", casts: "" };
    const directors = (data.directors || []).map((d) => d.name || d).join(" / ");
    const ws = (data.celebrities || []).filter((c) => (c.roles || []).some((r) => /编剧/.test(r)));
    const writers = ws.map((w) => w.name).join(" / ");
    const actors = data.actors || [];
    const casts = actors.length ? (typeof actors[0] === "object" ? actors.slice(0, 6).map((a) => a.name || "").filter(Boolean) : actors.slice(0, 6)).join(" / ") : "";
    return { directors, writers, casts };
  }
  async function fetchApizeroInfo(sid, key, httpGet2) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const text = await httpGet2(`https://v1.apizero.cn/api/douban-movie?id=${encodeURIComponent(sid)}`, {
      Authorization: `Bearer ${key}`
    });
    if (!text) return null;
    try {
      const j = JSON.parse(text);
      if (!j || j.code !== 0 || !j.data) return null;
      const d = j.data;
      return {
        name: String((_a = d.name) != null ? _a : ""),
        year: String((_b = d.year) != null ? _b : ""),
        score: String((_c = d.score) != null ? _c : ""),
        director: String((_d = d.director) != null ? _d : ""),
        actor: String((_e = d.actor) != null ? _e : ""),
        genre: String((_f = d.genre) != null ? _f : ""),
        area: String((_g = d.area) != null ? _g : ""),
        duration: String((_h = d.duration) != null ? _h : ""),
        episodes: String((_i = d.episodes) != null ? _i : ""),
        isTv: d.is_tv === true,
        doubanUrl: String(d.douban_url || `https://movie.douban.com/subject/${sid}/`),
        shortComment: String((_j = d.short_comment) != null ? _j : ""),
        commentAuthor: String((_k = d.comment_author) != null ? _k : "")
      };
    } catch (e) {
      return null;
    }
  }
  async function fetchCelebrities(sid, httpGet2, cookie) {
    const headers = { Referer: `https://m.douban.com/movie/subject/${sid}/` };
    if (cookie) headers.Cookie = cookie;
    for (const type of ["tv", "movie"]) {
      const text = await httpGet2(`https://m.douban.com/rexxar/api/v2/${type}/${sid}/celebrities`, headers);
      if (text && text.length > 150) {
        try {
          const data = JSON.parse(text);
          if (!data.msg) {
            const c = parseCelebrities(data);
            return { ...c, mediaType: type };
          }
        } catch (e) {
        }
      }
    }
    return null;
  }
  function updateFrontmatterFields(content, fields) {
    const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
    if (!fmMatch) {
      const fmLines = ["---"];
      for (const [k, spec] of Object.entries(fields)) {
        const v = typeof spec === "string" ? spec : spec.value;
        if (v) fmLines.push(`${k}: ${formatYamlValue(v)}`);
      }
      fmLines.push("---");
      return fmLines.join("\n") + "\n" + content;
    }
    const header = fmMatch[1];
    const footer = fmMatch[3];
    const rest = content.slice(fmMatch[0].length);
    const lines = fmMatch[2].split(/\r?\n/);
    let insertIdx = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(/^\s+- /)) insertIdx = i + 1;
    }
    const existingKeys = /* @__PURE__ */ new Map();
    for (const line of lines) {
      const m = line.match(/^([^:]+):/);
      if (m) existingKeys.set(m[1].trim(), m[1]);
    }
    const lineValue = (key) => {
      const m = lines.map((l) => l.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"))).find(Boolean);
      if (!m) return null;
      const v = m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
      return v || null;
    };
    const newLines = [];
    for (const [key, spec] of Object.entries(fields)) {
      const val = typeof spec === "string" ? spec : spec.value;
      if (!val || val === "") continue;
      if (existingKeys.has(key)) {
        if (typeof spec !== "string" && spec.ifMissing && lineValue(key)) continue;
        const lineKey = existingKeys.get(key);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(new RegExp(`^${lineKey}:`))) {
            lines[i] = `${lineKey}: ${formatYamlValue(val)}`;
            break;
          }
        }
      } else {
        newLines.push(`${key}: ${formatYamlValue(val)}`);
      }
    }
    if (newLines.length > 0) lines.splice(insertIdx, 0, ...newLines);
    return header + lines.join("\n") + footer + rest;
  }
  function formatYamlValue(val) {
    return yamlScalarOf(val);
  }
  function insertPosterEmbed(content, posterPath) {
    const embedLink = `![[${posterPath}]]`;
    if (content.includes(embedLink)) return content;
    const fmMatch = content.match(/^(---\r?\n[\s\S]*?\r?\n---)(\r?\n)?/);
    if (fmMatch) {
      if (fmMatch[2]) {
        return fmMatch[0] + embedLink + "\n" + content.slice(fmMatch[0].length);
      }
      return fmMatch[1] + "\n" + embedLink + "\n" + content.slice(fmMatch[1].length);
    }
    return embedLink + "\n" + content;
  }
  function fieldValue(content, key) {
    const m = content.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
    if (!m) return null;
    const v = m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
    return v || null;
  }
  async function probeSuggest(name, deps) {
    const headers = { Referer: "https://movie.douban.com/", "Accept-Language": "zh-CN,zh;q=0.9" };
    if (deps.doubanCookie) headers.Cookie = deps.doubanCookie;
    const json = await deps.httpGet(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(name)}`, headers);
    if (suggestLooksBlocked(json)) return { kind: "blocked" };
    const results = parseSuggestResults(json);
    return results.length > 0 ? { kind: "hit", results } : { kind: "empty" };
  }
  async function probeRexxarSearch(name, deps) {
    const headers = { Referer: "https://m.douban.com/movie/" };
    if (deps.doubanCookie) headers.Cookie = deps.doubanCookie;
    const json = await deps.httpGet(`https://m.douban.com/rexxar/api/v2/search?q=${encodeURIComponent(name)}&count=5`, headers);
    if (!json) return { kind: "blocked" };
    const results = parseRexxarSearch(json);
    return results.length > 0 ? { kind: "hit", results } : { kind: "empty" };
  }
  async function probeSearchPage(name, deps) {
    const headers = { Referer: "https://movie.douban.com/", "Accept-Language": "zh-CN,zh;q=0.9" };
    if (deps.doubanCookie) headers.Cookie = deps.doubanCookie;
    const html = await deps.httpGet(`https://www.douban.com/search?cat=1002&q=${encodeURIComponent(name)}`, headers);
    if (searchPageLooksBlocked(html)) return { kind: "blocked" };
    const results = parseSearchResults(html);
    return results.length > 0 ? { kind: "hit", results } : { kind: "empty" };
  }
  async function queryDoubanByName(name, deps) {
    let first = null;
    let sawBlocked = false;
    try {
      for (const probe of [probeSuggest, probeRexxarSearch, probeSearchPage]) {
        const r = await probe(name, deps);
        if (r.kind === "hit") {
          first = r.results[0];
          break;
        }
        if (r.kind === "blocked") sawBlocked = true;
      }
    } catch (e) {
      return { ok: false, reason: "network" };
    }
    if (!first) return { ok: false, reason: sawBlocked ? "blocked" : "notfound" };
    const sid = extractSid(first.detailUrl);
    if (!sid) return { ok: false, reason: "notfound" };
    let az = null;
    if (deps.apizeroKey) az = await fetchApizeroInfo(sid, deps.apizeroKey, deps.httpGet);
    let celebrities = null;
    if (!az || !az.director || !az.actor) {
      celebrities = await fetchCelebrities(sid, deps.httpGet, deps.doubanCookie);
    }
    return { ok: true, data: { title: first.title, detailUrl: first.detailUrl, sid, posterUrl: first.posterUrl, apizero: az, celebrities } };
  }
  async function downloadPosterToVault(name, posterUrl2, deps) {
    var _a, _b;
    let buf;
    try {
      buf = await deps.downloadBinary(upgradePosterUrl(posterUrl2), { Referer: "https://movie.douban.com/" });
    } catch (e) {
      return { ok: false, reason: "network" };
    }
    if (!buf) return { ok: false, reason: "network" };
    try {
      const posterFolder = ((_a = deps.posterFolder) == null ? void 0 : _a.trim()) || POSTER_FOLDER;
      await deps.mkdir(posterFolder);
      const ext = ((_b = posterUrl2.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) == null ? void 0 : _b[1]) || "jpg";
      const safeName = name.replace(ILLEGAL_NAME_RE_GLOBAL, "_");
      const path = `${posterFolder}/${safeName}_${(deps.now || Date.now)()}.${ext}`;
      await deps.writeBinary(path, buf);
      return { ok: true, path };
    } catch (e) {
      return { ok: false, reason: "write" };
    }
  }
  async function fetchNoteDouban(app, file, deps) {
    const name = extractMovieName(file.name);
    let content;
    try {
      content = await app.vault.read(file);
    } catch (e) {
      return { ok: false, reason: "network" };
    }
    const hasPoster = !!fieldValue(content, "海报");
    const doubanUrlRaw = fieldValue(content, "豆瓣链接");
    const hasDoubanInfo = !!doubanUrlRaw && /^https?:\/\//.test(doubanUrlRaw);
    if (hasPoster && hasDoubanInfo) return { ok: true, skipped: true };
    const q = await queryDoubanByName(name, deps);
    if (!q.ok) return { ok: false, reason: q.reason };
    const { detailUrl, posterUrl: posterUrl2, sid, apizero: az, celebrities: cel } = q.data;
    let posterRelative = fieldValue(content, "海报");
    if (!hasPoster && posterUrl2) {
      const dl = await downloadPosterToVault(name, posterUrl2, deps);
      if (!dl.ok) return { ok: false, reason: dl.reason };
      posterRelative = dl.path;
    }
    const fields = {};
    if (posterRelative) fields["海报"] = { value: posterRelative, ifMissing: true };
    fields["豆瓣链接"] = detailUrl;
    if (az) {
      if (az.score) fields["豆瓣评分"] = { value: az.score, ifMissing: true };
      if (az.director) fields["导演"] = { value: normalizeListValue(az.director), ifMissing: true };
      if (az.actor) fields["主演"] = { value: normalizeListValue(az.actor), ifMissing: true };
      if (az.genre) fields["类型"] = { value: normalizeListValue(az.genre), ifMissing: true };
      if (az.area) fields["制片国家/地区"] = { value: normalizeListValue(az.area), ifMissing: true };
      if (az.duration) fields["片长"] = { value: az.duration, ifMissing: true };
      if (az.year) fields["上映日期"] = { value: az.year, ifMissing: true };
      if (az.shortComment) fields["热门短评"] = { value: az.shortComment, ifMissing: true };
    }
    if (cel) {
      if (!fields["导演"] && cel.directors) fields["导演"] = { value: cel.directors, ifMissing: true };
      if (cel.writers) fields["编剧"] = { value: cel.writers, ifMissing: true };
      if (!fields["主演"] && cel.casts) fields["主演"] = { value: cel.casts, ifMissing: true };
    }
    try {
      await app.vault.process(file, (c) => {
        let next = updateFrontmatterFields(c, fields);
        if (posterRelative && !hasPoster && !fieldValue(c, "海报")) next = insertPosterEmbed(next, posterRelative);
        return next;
      });
    } catch (e) {
      return { ok: false, reason: "write" };
    }
    return { ok: true };
  }

  // src/cinema/data.ts
  function normalizeTags(raw) {
    if (Array.isArray(raw)) return raw.map((t) => String(t));
    if (typeof raw === "string" && raw) return [raw];
    return [];
  }
  function parseMovieFile(file, app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const cache = app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return null;
    const fm = cache.frontmatter;
    const name = extractMovieName(file.basename);
    const tags = normalizeTags(fm.tags);
    let typeTag = null;
    for (const t of ALL_TAGS) {
      if (tags.includes(t)) {
        typeTag = t;
        break;
      }
    }
    if (!typeTag) {
      if (tags.length === 0) return null;
      typeTag = tags[0];
    }
    const watchDate = (_b = (_a = fm["观影日期"]) == null ? void 0 : _a.toString()) != null ? _b : null;
    const rawRating = fm["评分"];
    const rating = rawRating === void 0 || rawRating === null || rawRating === "" ? null : Number(rawRating);
    let status;
    if (rating === -1) status = STATUS_WANT;
    else if (rating === 0) status = STATUS_WATCHING;
    else status = STATUS_WATCHED;
    return {
      file,
      name,
      typeTag,
      group: getGroupSafe(typeTag),
      watchDate,
      rating,
      status,
      poster: (_d = (_c = fm["海报"]) == null ? void 0 : _c.toString()) != null ? _d : null,
      review: (_f = (_e = fm["影评"]) == null ? void 0 : _e.toString()) != null ? _f : null,
      genre: (_h = (_g = fm["类型"]) == null ? void 0 : _g.toString()) != null ? _h : null,
      director: (_j = (_i = fm["导演"]) == null ? void 0 : _i.toString()) != null ? _j : null,
      actors: (_l = (_k = fm["主演"]) == null ? void 0 : _k.toString()) != null ? _l : null,
      region: (_n = (_m = fm["制片国家/地区"]) == null ? void 0 : _m.toString()) != null ? _n : null,
      year: fm["上映日期"] ? String(fm["上映日期"]).slice(0, 4) : null,
      releaseDate: fm["上映日期"] ? String(fm["上映日期"]) : null,
      doubanRating: fm["豆瓣评分"] !== void 0 && fm["豆瓣评分"] !== "" ? String(fm["豆瓣评分"]) : null,
      doubanUrl: /^https?:\/\//.test(String((_o = fm["豆瓣链接"]) != null ? _o : "")) ? String(fm["豆瓣链接"]) : null,
      synopsis: (_q = (_p = fm["简介"]) == null ? void 0 : _p.toString()) != null ? _q : null,
      // 片长/季集：原独立观影报告的两项统计源字段（ADR-0090 并入内嵌分析页）
      duration: (_s = (_r = fm["片长"]) == null ? void 0 : _r.toString()) != null ? _s : null,
      seasonText: (_u = (_t = fm["季集"]) == null ? void 0 : _t.toString()) != null ? _u : null,
      hotComment: (_w = (_v = fm["热门短评"]) == null ? void 0 : _v.toString()) != null ? _w : null
    };
  }
  function findPosterRenameTargets(app, oldPath) {
    var _a;
    if (!oldPath) return [];
    const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + "/"));
    const hits = [];
    for (const file of files) {
      const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
      if (fm && fm["海报"] != null && String(fm["海报"]) === oldPath) hits.push(file);
    }
    return hits;
  }
  function rebuildItems(app) {
    const newItems = [];
    const files = app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(M.folderPath + "/"));
    for (const file of files) {
      try {
        const item = parseMovieFile(file, app);
        if (item) {
          newItems.push(item);
          continue;
        }
        if (!app.metadataCache.getFileCache(file)) {
          const kept = M.items.find((p) => {
            var _a;
            return ((_a = p.file) == null ? void 0 : _a.path) === file.path;
          });
          if (kept) newItems.push(kept);
        }
      } catch (error) {
        console.warn("处理影视文件失败:", file.path, error);
      }
    }
    M.items.length = 0;
    M.items.push(...newItems);
    return newItems;
  }
  function dateVal(it) {
    if (!it.watchDate) return 0;
    const t = new Date(it.watchDate).getTime();
    return isNaN(t) ? 0 : t;
  }
  function sortByDateDesc(list) {
    return [...list].sort((a, b) => dateVal(b) - dateVal(a));
  }
  function sortByCreatedDesc(list) {
    return [...list].sort((a, b) => {
      const ta = a.file ? a.file.stat.ctime : 0;
      const tb = b.file ? b.file.stat.ctime : 0;
      if (ta !== tb) return tb - ta;
      return (b.name || "").localeCompare(a.name || "");
    });
  }
  function sortByRatingDesc(list) {
    return [...list].sort((a, b) => {
      const ar = a.rating && a.rating > 0 ? a.rating : -1;
      const br = b.rating && b.rating > 0 ? b.rating : -1;
      if (ar !== br) return br - ar;
      return dateVal(b) - dateVal(a);
    });
  }
  function applySortMode(list, mode) {
    if (mode === "created") return sortByCreatedDesc(list);
    if (mode === "rating") return sortByRatingDesc(list);
    return sortByDateDesc(list);
  }
  function getDisplayItems() {
    let list = [...M.items];
    if (M.typeFilter) list = list.filter((it) => it.group === M.typeFilter);
    if (M.statusFilter) list = list.filter((it) => it.status === (M.statusFilter === "想看" ? STATUS_WANT : M.statusFilter === "在看" ? STATUS_WATCHING : STATUS_WATCHED));
    if (M.searchKeyword) {
      const kw = M.searchKeyword.toLowerCase();
      list = list.filter((it) => {
        return it.name && it.name.toLowerCase().includes(kw) || it.typeTag && it.typeTag.toLowerCase().includes(kw) || it.review && it.review.toLowerCase().includes(kw) || it.director && it.director.toLowerCase().includes(kw) || it.actors && it.actors.toLowerCase().includes(kw);
      });
    }
    return applySortMode(list, M.sortMode);
  }
  function refreshDataAndView(app) {
    var _a, _b;
    rebuildItems(app);
    (_b = (_a = M).renderFn) == null ? void 0 : _b.call(_a);
  }

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }

  // src/core/ui/focus-trap.ts
  var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  function isHidden(el) {
    let cur = el;
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
  var PANEL_FOCUS_CLASS = "bz-panel-focushost";
  function trapPanelFocus(panel) {
    panel.classList.add(PANEL_FOCUS_CLASS);
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    const release = trapFocus(panel);
    panel.focus({ preventScroll: true });
    return release;
  }

  // src/core/flow-dialog.ts
  var FLOW_DIALOG_CANCEL_ID = "__shared_confirm_cancel__";
  var FLOW_DIALOG_OK_ID = "__shared_confirm_ok__";
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
  var activeSettle = null;
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
      function restoreFocus2() {
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
        restoreFocus2();
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

  // src/core/dom.ts
  function longPress(el, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M2 = 10;
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
      if (Math.abs(t.clientX - sx) > M2 || Math.abs(t.clientY - sy) > M2) {
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

  // src/core/item-actions.ts
  function renderIcon(container, iconId) {
    try {
      setIcon(container, iconId);
    } catch (e) {
    }
  }
  var VIEWPORT_PAD = 8;
  var ANCHOR_GAP = 12;
  var ITEM_HEIGHT = 30;
  var MENU_PADDING = 10;
  var TOUCH_SETTLE_MS = 400;
  var popupEl = null;
  var sheetMask = null;
  var sheetBodyEl = null;
  var sheetHeadEl = null;
  var sheetCompanions = /* @__PURE__ */ new Set();
  var menuEsc = null;
  var prevFocus = null;
  var suppressNextClick = false;
  var residualClickArmed = false;
  var touchSettlePending = false;
  var touchSettleTimer = null;
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
  function resetItemMenuClickGuard() {
    suppressNextClick = false;
    residualClickArmed = false;
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

  // src/core/ui/icon.ts
  function uiIcon(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }

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

  // src/core/ui/lightbox.ts
  var current = null;
  var currentEscHandle = null;
  function lockBodyScroll(lock) {
    const body = document.body;
    if (lock) {
      body.dataset.bzLightboxScroll = body.style.overflow || "";
      body.style.overflow = "hidden";
    } else if (body.dataset.bzLightboxScroll !== void 0) {
      body.style.overflow = body.dataset.bzLightboxScroll === "" ? "" : body.dataset.bzLightboxScroll;
      delete body.dataset.bzLightboxScroll;
    }
  }
  function openLightbox(opts) {
    closeLightbox();
    const mask = document.createElement("div");
    mask.className = "bz-lightbox";
    mask.style.zIndex = String(allocZ());
    const head = document.createElement("div");
    head.className = "bz-lightbox-head";
    const title = document.createElement("span");
    title.className = "bz-lightbox-title";
    title.textContent = opts.title || "";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "bz-lightbox-close";
    closeBtn.setAttribute("aria-label", "关闭");
    closeBtn.appendChild(uiIcon("x"));
    head.appendChild(title);
    head.appendChild(closeBtn);
    const media = document.createElement("div");
    media.className = "bz-lightbox-media";
    const bareSrc = opts.src.split("?")[0].split("#")[0];
    const type = opts.type || (bareSrc.endsWith(".mp4") || bareSrc.endsWith(".webm") ? "video" : "image");
    if (type === "video") {
      const v = document.createElement("video");
      v.src = opts.src;
      v.controls = true;
      v.autoplay = true;
      media.appendChild(v);
    } else if (type === "audio") {
      const a = document.createElement("audio");
      a.src = opts.src;
      a.controls = true;
      a.autoplay = true;
      media.appendChild(a);
    } else {
      const img = document.createElement("img");
      img.src = opts.src;
      img.alt = opts.title || "";
      media.appendChild(img);
    }
    const foot = document.createElement("div");
    foot.className = "bz-lightbox-foot";
    foot.textContent = opts.caption || "";
    mask.appendChild(head);
    mask.appendChild(media);
    mask.appendChild(foot);
    document.body.appendChild(mask);
    lockBodyScroll(true);
    let escHandle = null;
    function close() {
      if (current !== mask) return;
      mask.remove();
      escHandle == null ? void 0 : escHandle.unregister();
      if (currentEscHandle === escHandle) currentEscHandle = null;
      current = null;
      lockBodyScroll(false);
    }
    escHandle = escManager.register("bz-lightbox", {
      isVisible: () => mask.isConnected,
      close
    });
    currentEscHandle = escHandle;
    mask.addEventListener("click", (e) => {
      if (!e.target.closest(".bz-lightbox-media, .bz-lightbox-head, .bz-lightbox-foot")) close();
    });
    closeBtn.addEventListener("click", close);
    current = mask;
    return { close };
  }
  function closeLightbox() {
    if (current) {
      current.remove();
      current = null;
      currentEscHandle == null ? void 0 : currentEscHandle.unregister();
      currentEscHandle = null;
      lockBodyScroll(false);
    }
  }

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

  // src/core/ui/slide-pill.ts
  var BZ_PILL_CLS = "bz-slide-pill";
  function hoverCapable() {
    try {
      return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (e) {
      return false;
    }
  }
  function pillKeyOf(el, keys) {
    for (const k of keys) {
      const v = el.dataset[k];
      if (v) return v;
    }
    return "";
  }
  function ensurePillBound(box, t, hoverable) {
    if (box.dataset.pillBound) return;
    box.dataset.pillBound = "1";
    const resync = (animate) => syncSlidePill(box, t, hoverable, animate);
    if (hoverable) {
      box.addEventListener("mouseover", (e) => {
        var _a;
        const el = (_a = e.target) == null ? void 0 : _a.closest(t.item);
        if (!el || !box.contains(el)) return;
        const k = pillKeyOf(el, t.keys);
        if (!k || box.dataset.pillHover === k) return;
        box.dataset.pillHover = k;
        resync(true);
      });
      box.addEventListener("mouseleave", () => {
        if (!box.dataset.pillHover) return;
        delete box.dataset.pillHover;
        resync(true);
      });
    }
    box.addEventListener("scroll", () => resync(false), true);
  }
  function syncSlidePill(box, t, hoverable, animate = true) {
    var _a, _b;
    ensurePillBound(box, t, hoverable);
    const onClass = (_a = t.onClass) != null ? _a : "is-on";
    let pill = box.querySelector(`:scope > .${BZ_PILL_CLS}`);
    if (!pill) {
      pill = document.createElement("span");
      pill.className = BZ_PILL_CLS;
      pill.setAttribute("aria-hidden", "true");
      if (getComputedStyle(box).position === "static") box.style.position = "relative";
      box.prepend(pill);
    }
    const items = [...box.querySelectorAll(t.item)];
    const hoverKey = (_b = box.dataset.pillHover) != null ? _b : "";
    const hovered = hoverKey ? items.find((el) => pillKeyOf(el, t.keys) === hoverKey) : void 0;
    const target = hovered != null ? hovered : items.find((el) => el.classList.contains(onClass));
    if (!target) {
      pill.classList.remove("is-visible");
      return;
    }
    const r = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (t.clip) {
      const sc = target.closest(t.clip);
      if (sc) {
        const sr = sc.getBoundingClientRect();
        if (r.bottom < sr.top + 1 || r.top > sr.bottom - 1) {
          pill.classList.remove("is-visible");
          return;
        }
      }
    }
    if (!animate) pill.classList.add("is-instant");
    pill.style.width = `${Math.round(r.width)}px`;
    pill.style.height = `${Math.round(r.height)}px`;
    pill.style.transform = `translate(${Math.round(r.left - b.left)}px, ${Math.round(r.top - b.top)}px)`;
    pill.classList.add("is-visible");
    if (!animate) {
      void pill.offsetWidth;
      pill.classList.remove("is-instant");
    }
  }
  function syncSlidePills(root, targets, hoverable = hoverCapable()) {
    for (const t of targets) {
      const box = root.querySelector(t.box);
      if (box) syncSlidePill(box, t, hoverable, false);
    }
  }

  // src/cinema/douban-queue.ts
  var FETCH_GAP_MS = 15e3;
  var FETCH_TIMEOUT_MS = 3 * 60 * 1e3;
  var HTTP_TIMEOUT_MS = 15e3;
  var queue = [];
  var pending = /* @__PURE__ */ new Map();
  var waitAhead = /* @__PURE__ */ new Map();
  var attempted = /* @__PURE__ */ new Set();
  var cancelled = /* @__PURE__ */ new Set();
  var failedNames = [];
  var failedEntries = [];
  var blockedNames = [];
  var blockedEntries = [];
  var pumping = false;
  var fetchFn = null;
  var gapMs = FETCH_GAP_MS;
  var refreshDelayMs = 1500;
  async function httpGet(url, headers) {
    const timer = new Promise((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS));
    const req = requestUrl({ url, method: "GET", headers, throw: false }).then((resp) => {
      return resp.status >= 200 && resp.status < 300 ? resp.text : null;
    });
    req.catch(() => {
    });
    return await Promise.race([req, timer]);
  }
  async function downloadBinary(url, headers) {
    const timer = new Promise((resolve) => setTimeout(() => resolve(null), HTTP_TIMEOUT_MS * 2));
    const req = requestUrl({ url, method: "GET", headers, throw: false }).then((resp) => {
      return resp.status >= 200 && resp.status < 300 ? resp.arrayBuffer : null;
    });
    req.catch(() => {
    });
    return await Promise.race([req, timer]);
  }
  function fetchDepsFromSettings(app) {
    var _a;
    const s = (_a = tryGetSettings()) != null ? _a : {};
    const adapter = app.vault.adapter;
    const uaHeaders = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" };
    return {
      httpGet: (url, headers) => httpGet(url, { ...uaHeaders, ...headers || {} }),
      downloadBinary: (url, headers) => downloadBinary(url, { ...uaHeaders, ...headers || {} }),
      writeBinary: async (path, data) => {
        if (!(adapter == null ? void 0 : adapter.writeBinary)) throw new Error("adapter.writeBinary 不可用");
        await adapter.writeBinary(path, data);
      },
      mkdir: async (path) => {
        var _a2;
        await ((_a2 = adapter == null ? void 0 : adapter.mkdir) == null ? void 0 : _a2.call(adapter, path));
      },
      apizeroKey: typeof s.cinemaApizeroKey === "string" ? s.cinemaApizeroKey.trim() : "",
      doubanCookie: typeof s.cinemaDoubanCookie === "string" ? s.cinemaDoubanCookie.trim() : "",
      posterFolder: typeof s.cinemaPosterFolder === "string" ? s.cinemaPosterFolder.trim() : ""
    };
  }
  var previewFn = null;
  async function queryDoubanForPreview(app, name) {
    return previewFn ? previewFn(app, name) : queryDoubanByName(name, fetchDepsFromSettings(app));
  }
  var posterFn = null;
  async function downloadPreviewPoster(app, name, posterUrl2) {
    if (posterFn) return posterFn(app, name, posterUrl2);
    const r = await downloadPosterToVault(name, posterUrl2, fetchDepsFromSettings(app));
    return r.ok ? r.path : null;
  }
  function isFetching(path) {
    var _a;
    if (!path) return false;
    const at2 = pending.get(path);
    if (!at2) return false;
    const ahead = (_a = waitAhead.get(path)) != null ? _a : 0;
    return Date.now() - at2 < ahead * gapMs + FETCH_TIMEOUT_MS + 3e4;
  }
  function enqueueDoubanFetch(file, name) {
    if (!file) return false;
    const key = file.path;
    cancelled.delete(key);
    if (attempted.has(key)) return false;
    attempted.add(key);
    pending.set(key, Date.now());
    waitAhead.set(key, queue.length);
    queue.push({ file, name });
    void pump();
    return true;
  }
  function dequeueDoubanFetch(path) {
    if (!path) return;
    const at2 = queue.findIndex((e) => e.file.path === path);
    if (at2 >= 0) queue.splice(at2, 1);
    pending.delete(path);
    waitAhead.delete(path);
    cancelled.add(path);
    attempted.delete(path);
  }
  function sweepDoubanFetch(_app2) {
    var _a, _b;
    let added = 0;
    for (const it of M.items) {
      if (!it.file) continue;
      if (!it.poster || !it.doubanUrl) {
        if (enqueueDoubanFetch(it.file, it.name)) added++;
      }
    }
    if (added > 0 && M.currentOverlay) (_b = (_a = M).renderFn) == null ? void 0 : _b.call(_a);
  }
  async function runOne(entry) {
    const fn = fetchFn != null ? fetchFn : defaultFetchNote;
    try {
      return await Promise.race([
        fn(entry.file, entry.name),
        new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: "network" }), FETCH_TIMEOUT_MS))
      ]);
    } catch (e) {
      return { ok: false, reason: "network" };
    }
  }
  async function defaultFetchNote(file, _name) {
    const app = M.appRef;
    if (!app) return { ok: false, reason: "network" };
    return fetchNoteDouban(app, file, fetchDepsFromSettings(app));
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      let first = true;
      while (queue.length > 0) {
        const entry = queue.shift();
        pending.set(entry.file.path, Date.now());
        waitAhead.delete(entry.file.path);
        if (!first) await sleep(gapMs);
        first = false;
        const r = await runOne(entry);
        pending.delete(entry.file.path);
        waitAhead.delete(entry.file.path);
        if (cancelled.delete(entry.file.path)) {
          refreshAfterFetch();
          continue;
        }
        if (M.appRef && !M.appRef.vault.getAbstractFileByPath(entry.file.path)) {
          console.info(`bz 影院：豆瓣抓取目标笔记已删除，静默出队：${entry.file.path}`);
          attempted.delete(entry.file.path);
          refreshAfterFetch();
          continue;
        }
        if (!r.ok) {
          if (r.reason === "blocked") {
            blockedNames.push(entry.name);
            blockedEntries.push(entry);
          } else {
            failedNames.push(entry.name);
            failedEntries.push(entry);
          }
        }
        refreshAfterFetch();
      }
    } finally {
      pumping = false;
    }
    if (blockedNames.length > 0) {
      const entries = blockedEntries;
      notify(`豆瓣风控拦截，以下影片本轮未抓到：${blockedNames.join("、")}（重启 Obsidian（重载插件）后会自动重试）`, {
        type: "error",
        action: { label: "重试", onClick: () => requeueFailed(entries) }
      });
      blockedNames = [];
      blockedEntries = [];
    }
    if (failedNames.length > 0) {
      const entries = failedEntries;
      notify(`以下影片豆瓣信息获取失败：${failedNames.join("、")}（重启 Obsidian（重载插件）后会自动重试）`, {
        type: "error",
        action: { label: "重试", onClick: () => requeueFailed(entries) }
      });
      failedNames.length = 0;
      failedEntries = [];
    }
  }
  function requeueFailed(entries) {
    const app = M.appRef;
    if (!app) return;
    let added = 0;
    let gone = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      entries.splice(i, 1);
      attempted.delete(e.file.path);
      const file = app.vault.getAbstractFileByPath(e.file.path);
      if (!file) {
        gone++;
        continue;
      }
      if (enqueueDoubanFetch(file, e.name)) added++;
    }
    if (added > 0) notice(`已重新入队 ${added} 部影片的豆瓣抓取`);
    else if (gone > 0) notice("没有可重试的影片", "warning");
  }
  function refreshAfterFetch() {
    var _a, _b;
    if (!M.currentOverlay || !M.appRef) return;
    rebuildItems(M.appRef);
    (_b = (_a = M).renderFn) == null ? void 0 : _b.call(_a);
    setTimeout(() => {
      var _a2, _b2;
      if (!M.currentOverlay || !M.appRef) return;
      rebuildItems(M.appRef);
      (_b2 = (_a2 = M).renderFn) == null ? void 0 : _b2.call(_a2);
    }, refreshDelayMs);
  }

  // src/cinema/recommend.ts
  var GROUP_DEFAULT_TAG = {
    电影: "电影",
    剧集: "国产剧",
    动漫: "日漫",
    纪录片: "纪录片",
    公开课: "公开课"
  };
  function buildTasteProfile() {
    const watched = M.items.filter((i) => i.status === STATUS_WATCHED && i.rating !== null && i.rating > 0);
    const weight = (i) => i.rating;
    const topBy = (key) => {
      const acc = {};
      watched.forEach((i) => {
        const val = key(i);
        if (!val) return;
        String(val).split("/").map((s) => s.trim()).filter(Boolean).forEach((part) => {
          acc[part] = (acc[part] || 0) + weight(i);
        });
      });
      return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}×${v.toFixed(1)}`);
    };
    const recent2 = [...watched].sort((a, b) => {
      const da = a.watchDate ? new Date(a.watchDate).getTime() : 0;
      const db = b.watchDate ? new Date(b.watchDate).getTime() : 0;
      return db - da;
    }).slice(0, 10).map((i) => `${i.name}(${i.group},评分${i.rating}${i.review ? "，影评：" + i.review.slice(0, 60) : ""})`);
    return {
      total: watched.length,
      groups: topBy((i) => i.group),
      genres: topBy((i) => i.genre),
      directors: topBy((i) => i.director),
      actors: topBy((i) => i.actors),
      regions: topBy((i) => i.region),
      recent: recent2
    };
  }
  var RECOMMEND_ASK = 20;
  var RECOMMEND_TAKE = 5;
  var FOLLOWUP_ASK = 10;
  function buildRecommendPrompt(profile, recent2) {
    return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~10加权统计，数值为加权分）：
品类分布：${profile.groups.join("、") || "无"}
类型偏好：${profile.genres.join("、") || "无"}
导演偏好：${profile.directors.join("、") || "无"}
主演偏好：${profile.actors.join("、") || "无"}
地区偏好：${profile.regions.join("、") || "无"}
最近看的10部：${recent2.join("；")}

请基于画像推荐 ${RECOMMEND_ASK} 部用户可能喜欢的影视（电影/剧集/动漫/纪录片/公开课均可），按与口味的匹配度从高到低排序。推荐理由必须具体引用画像中的偏好信号（如"你偏爱X导演的Y风格"）。只推荐真实存在的影视，避免编造。

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
  }
  function buildFollowupPrompt(profile, recent2, excludeNames) {
    return `你是资深影视推荐官。用户已看 ${profile.total} 部影视，以下是其口味画像（个人评分1~10加权统计，数值为加权分）：
品类分布：${profile.groups.join("、") || "无"}
类型偏好：${profile.genres.join("、") || "无"}
导演偏好：${profile.directors.join("、") || "无"}
主演偏好：${profile.actors.join("、") || "无"}
地区偏好：${profile.regions.join("、") || "无"}
最近看的10部：${recent2.join("；")}

刚才已经向你推荐过以下影片（不要重复推荐）：${excludeNames.join("、")}

请再推荐 ${FOLLOWUP_ASK} 部用户可能喜欢的影视（电影/剧集/动漫/纪录片/公开课均可），按与口味的匹配度从高到低排序，避开上面已出现过的。推荐理由必须具体引用画像中的偏好信号（如"你偏爱X导演的Y风格"）。只推荐真实存在的影视，避免编造。

严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","director":"导演","type":"电影|剧集|动漫|纪录片|公开课","reason":"推荐理由"}]}`;
  }
  function recTitle(r) {
    return String((r == null ? void 0 : r.title) || (r == null ? void 0 : r.name) || "").trim();
  }
  function dedupeRecommendations(cands, taken) {
    const out = [];
    for (const r of cands != null ? cands : []) {
      const name = recTitle(r);
      if (!name || taken.has(name)) continue;
      taken.add(name);
      if (M.items.some((it) => it.name === name)) continue;
      out.push(r);
    }
    return out;
  }
  async function refineRecommend(first) {
    var _a, _b;
    const taken = /* @__PURE__ */ new Set();
    const picked = dedupeRecommendations(first, taken).slice(0, RECOMMEND_TAKE);
    if (picked.length >= RECOMMEND_TAKE) return picked;
    M.aiWaitMsg = `首轮候选在库较多，正在补充推荐…`;
    (_b = (_a = M).renderFn) == null ? void 0 : _b.call(_a);
    try {
      const profile = buildTasteProfile();
      const ai = createAI();
      const raw = await ai.json(buildFollowupPrompt(profile, profile.recent, [...taken]), {});
      const more = parseRecommendJson(raw);
      if (more) picked.push(...dedupeRecommendations(more, taken));
    } catch (e) {
    }
    return picked.slice(0, RECOMMEND_TAKE);
  }
  function parseRecommendJson(raw) {
    try {
      let cleaned = raw.trim();
      const codeBlockMatch = cleaned.match(/```[a-zA-Z]*\s*([\s\S]*?)```/);
      if (codeBlockMatch) cleaned = codeBlockMatch[1].trim();
      const data = JSON.parse(cleaned);
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        for (const key of ["recommendations", "similar", "similar_movies", "suggestions", "items", "movies"]) {
          if (Array.isArray(data[key]) && data[key].length > 0) return data[key];
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  async function quickAddWant(app, name, type) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      notice("推荐条目缺少片名，已跳过加入想看");
      return;
    }
    if (hasIllegalNameChar(trimmedName)) {
      notice(`${ILLEGAL_NAME_HINT}，已跳过加入想看`, "error");
      return;
    }
    const tag = GROUP_DEFAULT_TAG[type] || "电影";
    let folderObj = app.vault.getAbstractFileByPath(M.folderPath);
    if (!folderObj) await app.vault.createFolder(M.folderPath);
    const filePath = `${M.folderPath}/《${trimmedName}》.md`;
    if (app.vault.getAbstractFileByPath(filePath)) {
      notice(`影视「${trimmedName}」已在库中`);
      return;
    }
    const now = localNow();
    const content = `---
tags:
- ${tag}
观影日期: "${now}"
评分: -1
海报: 
---
`;
    try {
      const f = await app.vault.create(filePath, content);
      notice(`已加入想看：「${trimmedName}」`, "success");
      emitDomainEvent("movie", { kind: "created", name: trimmedName, status: "want", rating: null, review: null });
      enqueueDoubanFetch(f, trimmedName);
      refreshDataAndView(app);
    } catch (e) {
      notifySaveError(e, "加入想看");
      console.error(e);
    }
  }
  async function runAIPage(app, opts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    if (M.aiRunning) return;
    M.aiRunning = true;
    M.aiWaitMsg = opts.initWaitMsg;
    M.aiResult = null;
    M.aiError = null;
    M.aiBase = opts.base;
    M.view = "ai";
    (_b = (_a = M).renderFn) == null ? void 0 : _b.call(_a);
    try {
      const { prompt, waitMsg } = opts.prepare();
      M.aiWaitMsg = waitMsg;
      (_d = (_c = M).renderFn) == null ? void 0 : _d.call(_c);
      const ai = createAI();
      const raw = await ai.json(prompt, {});
      const parsed = parseRecommendJson(raw);
      if (!parsed || parsed.length === 0) {
        M.aiRunning = false;
        M.aiError = "AI 分析失败：返回格式无法解析";
        (_f = (_e = M).renderFn) == null ? void 0 : _f.call(_e);
        return;
      }
      const final = opts.refine ? await opts.refine(parsed) : parsed;
      M.aiRunning = false;
      if (!final.length) {
        M.aiError = "没有凑齐可推荐的库外新片，换一批再试";
        (_h = (_g = M).renderFn) == null ? void 0 : _h.call(_g);
        return;
      }
      M.aiResult = final;
      (_j = (_i = M).renderFn) == null ? void 0 : _j.call(_i);
    } catch (e) {
      M.aiRunning = false;
      M.aiError = "AI 分析失败：" + (e.message || e);
      (_l = (_k = M).renderFn) == null ? void 0 : _l.call(_k);
    }
  }
  function runAIRecommend(app) {
    return runAIPage(app, {
      base: null,
      // 荐片模式（「换一批」重跑荐片而非找同类）
      initWaitMsg: "AI 正在分析你的观影口味…",
      prepare: () => {
        const profile = buildTasteProfile();
        return {
          prompt: buildRecommendPrompt(profile, profile.recent),
          waitMsg: `已分析 ${profile.total} 部观影历史，正在生成推荐…`
        };
      },
      refine: refineRecommend
    });
  }
  function runSimilarRecommend(item, app) {
    return runAIPage(app, {
      base: item,
      // 记录基准影片供「换一批」重跑
      initWaitMsg: "AI 正在分析同类影片…",
      prepare: () => ({
        prompt: buildSimilarPrompt(item, M.items.filter((i) => i.status === STATUS_WATCHED && i.name !== item.name)),
        waitMsg: `已分析 ${M.items.length} 部影视，正在生成同类推荐…`
      })
    });
  }
  function buildSimilarPrompt(item, watched) {
    const self = `片名《${item.name}》（${item.typeTag || "未知类型"}${item.rating !== null && item.rating > 0 ? `，我的评分 ${item.rating}` : ""}${item.review ? `，我的影评「${item.review.slice(0, 80)}」` : ""}${item.director ? `，导演 ${item.director}` : ""}）`;
    const list = watched.map((i) => `${i.name}（${i.typeTag || ""}${i.rating !== null && i.rating > 0 ? `，评分${i.rating}` : ""}）`).join("、");
    return `你是资深影视推荐官。以下是我的影视库里的「基准影片」和我「已看过的影片清单」。
基准影片：${self}
我已看过：${list || "（暂无）"}
请推荐 3~5 部与基准影片气质相近、但我还没看过的同类佳作（可从真实世界影视中挑选），结合我的观影口味说明理由。
严格输出 JSON（不要输出其他内容）：{"recommendations":[{"title":"片名","year":"年份","type":"类型","director":"导演","reason":"为何与基准影片同类、为何适合我"}]}`;
  }

  // src/cinema/yearbook/data.ts
  var YB_TITLE = "观影分析";
  function parseMinutes(raw) {
    if (!raw) return null;
    const s = String(raw);
    const hm = s.match(/(\d+)\s*小时\s*(\d+)?\s*分?/);
    if (hm) return Number(hm[1]) * 60 + (hm[2] ? Number(hm[2]) : 0);
    const m = s.match(/(\d+)\s*分/);
    if (m) return Number(m[1]);
    const bare = s.match(/^\s*(\d+)\s*$/);
    return bare ? Number(bare[1]) : null;
  }
  function parseEpisodes(raw) {
    if (!raw) return null;
    const m = String(raw).match(/(\d+)/);
    return m ? Number(m[1]) : null;
  }
  var dayOf = (it) => it.watchDate ? String(it.watchDate).slice(0, 10) : null;
  var byDate = (a, b) => {
    var _a, _b;
    return ((_a = dayOf(a)) != null ? _a : "") < ((_b = dayOf(b)) != null ? _b : "") ? -1 : 1;
  };
  var rankOf = (m) => [...m.entries()].map(([name, films]) => ({ name, films })).sort((a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name, "zh"));
  var splitList = (raw) => String(raw != null ? raw : "").split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  function deriveYb(items) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const watched = items.filter((it) => it.status === STATUS_WATCHED);
    const want = items.filter((it) => it.status === STATUS_WANT);
    const watching = items.filter((it) => it.status === STATUS_WATCHING);
    const groupMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      const k = it.typeTag || "未分类";
      ((_a = groupMap.get(k)) != null ? _a : groupMap.set(k, []).get(k)).push(it);
    }
    const dated = watched.filter((it) => !!dayOf(it)).sort(byDate);
    const years = [];
    for (const it of dated) {
      const y = Number(dayOf(it).slice(0, 4));
      const last = years[years.length - 1];
      if (last && last.y === y) last.films.push(it);
      else years.push({ y, films: [it] });
    }
    const months = Array(12).fill(0);
    for (const it of dated) months[Number(dayOf(it).slice(5, 7)) - 1]++;
    const weekN = [0, 0, 0, 0, 0, 0, 0];
    for (const it of dated) weekN[((/* @__PURE__ */ new Date(`${dayOf(it)}T00:00:00`)).getDay() + 6) % 7]++;
    const days = /* @__PURE__ */ new Map();
    for (const it of dated) {
      const d = dayOf(it);
      ((_b = days.get(d)) != null ? _b : days.set(d, []).get(d)).push(it);
    }
    let busiest = { date: "", films: [] };
    for (const [date, films] of days) if (films.length > busiest.films.length || films.length === busiest.films.length && date < busiest.date) busiest = { date, films };
    const sortedDays = [...days.keys()].sort();
    let streak = { days: 0, from: "", to: "", films: [] };
    let runStart = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      if (i > 0) {
        const gap = (Date.parse(sortedDays[i]) - Date.parse(sortedDays[i - 1])) / 864e5;
        if (gap !== 1) runStart = i;
      }
      const len = i - runStart + 1;
      if (len > streak.days) {
        const slice = sortedDays.slice(runStart, i + 1);
        streak = { days: len, from: slice[0], to: slice[slice.length - 1], films: slice.flatMap((d) => {
          var _a2;
          return (_a2 = days.get(d)) != null ? _a2 : [];
        }) };
      }
    }
    const spanDays = sortedDays.length ? Math.round((Date.parse(sortedDays[sortedDays.length - 1]) - Date.parse(sortedDays[0])) / 864e5) + 1 : 0;
    const monthFreq = new Set(dated.map((it) => dayOf(it).slice(0, 7))).size ? (dated.length / new Set(dated.map((it) => dayOf(it).slice(0, 7))).size).toFixed(1) : "0";
    const minutes = [];
    let longest = null, longestMin = 0, shortest = null, shortestMin = 0;
    for (const it of items) {
      const m = parseMinutes(it.duration);
      if (m === null) continue;
      minutes.push(m);
      if (m > longestMin) {
        longestMin = m;
        longest = it;
      }
      if (!shortestMin || m < shortestMin) {
        shortestMin = m;
        shortest = it;
      }
    }
    const totalMinutes = minutes.reduce((s, m) => s + m, 0);
    const BIN_DEF = [["≤59 分", 0, 59], ["60–89 分", 60, 89], ["90–119 分", 90, 119], ["120–149 分", 120, 149], ["≥150 分", 150, 1e9]];
    const bins = BIN_DEF.map(([label, lo, hi]) => ({
      label,
      lo,
      hi,
      films: items.filter((it) => {
        const m = parseMinutes(it.duration);
        return m !== null && m >= lo && m <= hi;
      })
    }));
    const genreMap = /* @__PURE__ */ new Map(), regionMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      for (const g of splitList(it.genre)) ((_c = genreMap.get(g)) != null ? _c : genreMap.set(g, []).get(g)).push(it);
      for (const r of splitList(it.region)) ((_d = regionMap.get(r)) != null ? _d : regionMap.set(r, []).get(r)).push(it);
    }
    const genres = rankOf(genreMap);
    const regions = rankOf(regionMap);
    const mCols = genres.slice(0, 6).map((g) => g.name);
    const mRows = regions.slice(0, 6).map((r) => r.name);
    const matrix = {
      cols: mCols,
      rows: mRows,
      max: 0,
      n: mRows.map((r) => mCols.map((c) => items.filter((it) => splitList(it.genre).includes(c) && splitList(it.region).includes(r)).length))
    };
    matrix.max = Math.max(1, ...matrix.n.flat());
    const relYear = (it) => {
      const y = Number(it.year);
      return Number.isFinite(y) && y > 1800 ? y : null;
    };
    const relCount = /* @__PURE__ */ new Map();
    for (const it of items) {
      const y = relYear(it);
      if (y !== null) relCount.set(y, ((_e = relCount.get(y)) != null ? _e : 0) + 1);
    }
    const releaseYears = [...relCount.entries()].map(([y, n]) => ({ y, n })).sort((a, b) => a.y - b.y);
    let oldest = null, newest = null;
    for (const it of items) {
      const y = relYear(it);
      if (y === null) continue;
      if (!oldest || y < Number(oldest.year)) oldest = it;
      if (!newest || y > Number(newest.year)) newest = it;
    }
    const TOOLS = [["当年", (a) => a <= 0], ["1–3 年", (a) => a > 0 && a <= 3], ["4–10 年", (a) => a > 3 && a <= 10], ["≥10 年", (a) => a > 10]];
    const ageBuckets = TOOLS.map(([label, hit]) => ({
      label,
      films: watched.filter((it) => {
        const y = relYear(it), d = dayOf(it);
        if (y === null || !d) return false;
        return hit(Number(d.slice(0, 4)) - y);
      })
    }));
    const ageVals = [];
    for (const it of watched) {
      const y = relYear(it), d = dayOf(it);
      if (y !== null && d) ageVals.push(Number(d.slice(0, 4)) - y);
    }
    const avgAge = ageVals.length ? (ageVals.reduce((s, a) => s + a, 0) / ageVals.length).toFixed(1) : "0";
    const rated = items.filter((it) => {
      var _a2;
      return it.status === STATUS_WATCHED && ((_a2 = it.rating) != null ? _a2 : 0) > 0;
    }).sort((a, b) => {
      var _a2, _b2;
      return ((_a2 = b.rating) != null ? _a2 : 0) - ((_b2 = a.rating) != null ? _b2 : 0) || byDate(a, b);
    });
    const myHist = Array(11).fill(0), dbHist = Array(11).fill(0);
    for (const it of rated) myHist[Math.max(0, Math.min(10, Math.round((_f = it.rating) != null ? _f : 0)))]++;
    const withDb = rated.filter((it) => it.doubanRating && Number.isFinite(parseFloat(it.doubanRating)));
    for (const it of withDb) dbHist[Math.max(0, Math.min(10, Math.round(parseFloat(it.doubanRating))))]++;
    const avgMine = rated.length ? rated.reduce((s, it) => {
      var _a2;
      return s + ((_a2 = it.rating) != null ? _a2 : 0);
    }, 0) / rated.length : 0;
    const avgDb = withDb.length ? withDb.reduce((s, it) => s + parseFloat(it.doubanRating), 0) / withDb.length : 0;
    const diffs = withDb.map((it) => {
      var _a2;
      return { it, diff: ((_a2 = it.rating) != null ? _a2 : 0) - parseFloat(it.doubanRating) };
    }).sort((a, b) => b.diff - a.diff);
    const avgDiff = diffs.length ? diffs.reduce((s, d) => s + d.diff, 0) / diffs.length : 0;
    const treasure = diffs.filter((d) => d.diff >= 0.9).slice(0, 4).map((d) => d.it);
    const disappoint = diffs.filter((d) => d.diff <= -1.5).slice(-4).reverse().map((d) => d.it);
    const top3 = rated.slice(0, 3);
    const nineUp = rated.filter((it) => {
      var _a2;
      return ((_a2 = it.rating) != null ? _a2 : 0) >= 9;
    });
    const people = (field) => {
      var _a2;
      const m = /* @__PURE__ */ new Map();
      for (const it of items) for (const p of splitList(it[field])) ((_a2 = m.get(p)) != null ? _a2 : m.set(p, []).get(p)).push(it);
      return rankOf(m).filter((r) => r.films.length >= 2).slice(0, 6);
    };
    const seriesMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      const m = String(it.name).match(/^(.*?)\s*第[一二三四五六七八九十0-9]+\s*[季部集]/);
      if (!m || !m[1]) continue;
      ((_g = seriesMap.get(m[1])) != null ? _g : seriesMap.set(m[1], []).get(m[1])).push(it);
    }
    const series = [...seriesMap.entries()].map(([base, films]) => ({ base, films })).filter((s) => s.films.length >= 2).sort((a, b) => b.films.length - a.films.length).slice(0, 4);
    const epsMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      const ep = parseEpisodes(it.seasonText);
      if (ep === null) continue;
      const base = String(it.name).replace(/\s*第[一二三四五六七八九十0-9]+\s*[季部].*/, "");
      const got = epsMap.get(base);
      if (got) {
        got.ep = Math.max(got.ep, ep);
        got.films.push(it);
      } else epsMap.set(base, { ep, films: [it] });
    }
    const episodes = [...epsMap.entries()].map(([base, v]) => ({ base, ep: v.ep, films: v.films })).sort((a, b) => b.ep - a.ep);
    const epVals = items.map((it) => parseEpisodes(it.seasonText)).filter((n) => n !== null);
    const epTotal = epVals.reduce((s2, n) => s2 + n, 0);
    const reviews = items.filter((it) => it.review && String(it.review).trim().length >= 8).sort((a, b) => String(b.review).length - String(a.review).length).slice(0, 8).map((it) => ({ name: it.name, text: String(it.review).trim(), rating: it.rating }));
    const hotComments = items.filter((it) => it.hotComment && String(it.hotComment).trim().length >= 10).map((it) => ({ name: it.name, text: String(it.hotComment).trim(), rating: it.rating })).filter((c) => c.text.length <= 120).slice(0, 60);
    const scatter = rated.filter((it) => !!dayOf(it)).map((it) => {
      var _a2;
      return { y: Number(dayOf(it).slice(0, 4)), r: (_a2 = it.rating) != null ? _a2 : 0, it };
    }).sort((a, b) => a.y - b.y);
    const ageDots = [];
    for (const it of watched) {
      const y = relYear(it), d = dayOf(it);
      if (y === null || !d) continue;
      ageDots.push({ age: Number(d.slice(0, 4)) - y, it });
    }
    ageDots.sort((a, b) => b.age - a.age);
    const pairMap = /* @__PURE__ */ new Map();
    for (const it of items) {
      const gs = splitList(it.genre);
      for (let i = 0; i < gs.length; i++) {
        for (let j = i + 1; j < gs.length; j++) {
          const [a, b] = gs[i] < gs[j] ? [gs[i], gs[j]] : [gs[j], gs[i]];
          const k = `${a}|${b}`;
          pairMap.set(k, ((_h = pairMap.get(k)) != null ? _h : 0) + 1);
        }
      }
    }
    const genrePairs = [...pairMap.entries()].map(([k, n]) => {
      const [a, b] = k.split("|");
      return { a, b, n };
    }).filter((p2) => p2.n >= 2).sort((a, b) => b.n - a.n).slice(0, 12);
    const durFilms = [];
    for (const it of items) {
      const m = parseMinutes(it.duration);
      if (m !== null) durFilms.push({ min: m, it });
    }
    durFilms.sort((a, b) => a.min - b.min);
    return {
      total: items.length,
      watchedCount: watched.length,
      wantCount: want.length,
      watchingCount: watching.length,
      typeGroups: rankOf(groupMap),
      ratedCount: rated.length,
      years,
      yearMin: years.length ? years[0].y : 0,
      yearMax: years.length ? years[years.length - 1].y : 0,
      months,
      peakMonth: months.indexOf(Math.max(...months)),
      weekN,
      peakDay: weekN.indexOf(Math.max(...weekN)),
      weekendN: weekN[5] + weekN[6],
      days,
      busiest,
      streak,
      spanDays,
      monthFreq,
      minutes,
      totalMinutes,
      avgMinutes: minutes.length ? totalMinutes / minutes.length : 0,
      bins,
      longest,
      longestMin,
      shortest,
      shortestMin,
      genres,
      regions,
      matrix,
      releaseYears,
      oldest,
      newest,
      ageBuckets,
      avgAge,
      rated,
      myHist,
      dbHist,
      avgMine,
      avgDb,
      avgDiff,
      diffs,
      treasure,
      disappoint,
      top3,
      nineUp,
      tenUp: rated.filter((it) => {
        var _a2;
        return ((_a2 = it.rating) != null ? _a2 : 0) >= 10;
      }).length,
      directors: people("director"),
      actors: people("actors"),
      series,
      episodes,
      epItems: epVals.length,
      epTotal,
      reviews,
      hotComments,
      posters: items.filter((it) => !!it.poster),
      scatter,
      ageDots,
      genrePairs,
      durFilms
    };
  }
  function humanMinutes(min) {
    const d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60), m = Math.round(min % 60);
    if (d > 0) return `${d} 天 ${h} 小时`;
    if (h > 0) return `${h} 小时 ${m} 分`;
    return `${m} 分钟`;
  }

  // src/cinema/yearbook/kits.ts
  var clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  var clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
  var lerp = (a, b, t) => a + (b - a) * t;
  var at = (t, dur, delay = 0) => clamp01((t - delay) / Math.max(dur, 1e-4));
  var easeOut = (x) => 1 - Math.pow(1 - x, 3);
  var easeInOut = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  var easeBack = (x) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  };
  var easeElastic = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const p = 0.42;
    return Math.pow(2, -10 * x) * Math.sin((x - p / 4) * (2 * Math.PI) / p) + 1;
  };
  var spring = (x, damp = 6, freq = 3) => x >= 1 ? 1 : 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * x);
  var stagger = (t, i, step = 0.07, dur = 0.7) => at(t, dur, i * step);
  var humanDur = (min) => {
    const d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60);
    return d > 0 ? `${d} 天 ${h} 小时` : `${h} 小时 ${Math.round(min % 60)} 分`;
  };
  var humanDurShort = (min) => {
    const d = Math.floor(min / 1440), h = Math.floor(min % 1440 / 60);
    return d > 0 ? `${d}天${h}时` : `${h}小时`;
  };
  var dotted = (d) => d.replace(/-/g, ".");
  var rgb = (host, name, fallback) => {
    const v = getComputedStyle(host).getPropertyValue(name).trim();
    return v || fallback;
  };
  var luma = (triplet) => {
    var _a, _b, _c;
    const n = triplet.split(",").map((x) => Number(x.trim()));
    return 0.299 * ((_a = n[0]) != null ? _a : 0) + 0.587 * ((_b = n[1]) != null ? _b : 0) + 0.114 * ((_c = n[2]) != null ? _c : 0);
  };
  function palette(host) {
    const inkRgb = rgb(host, "--yb-ink-rgb", "32,26,20");
    const redRgb = rgb(host, "--yb-red-rgb", "190,58,38");
    const blueRgb = rgb(host, "--yb-blue-rgb", "44,80,140");
    const jadeRgb = rgb(host, "--yb-jade-rgb", "38,110,96");
    const goldRgb = rgb(host, "--yb-gold-rgb", "168,118,26");
    const paper = rgb(host, "--yb-paper", "#f6f2e9");
    const dim = rgb(host, "--yb-dim-rgb", "120,108,92");
    const faint = rgb(host, "--yb-faint-rgb", "168,156,138");
    const dark = luma(inkRgb) > 140;
    return {
      ink: `rgb(${inkRgb})`,
      dim: `rgb(${dim})`,
      faint: `rgb(${faint})`,
      line: `rgb(${inkRgb} / .16)`,
      red: `rgb(${redRgb})`,
      blue: `rgb(${blueRgb})`,
      jade: `rgb(${jadeRgb})`,
      gold: `rgb(${goldRgb})`,
      paper,
      inkRgb,
      redRgb,
      blueRgb,
      jadeRgb,
      goldRgb,
      onStrong: dark ? "12,10,8" : "255,255,255",
      dark
    };
  }
  var rgba = (triplet, a) => `rgba(${triplet},${a})`;
  function canvas(host, key) {
    const el = host.querySelector(`canvas[data-cv="${key}"]`);
    if (!el) return null;
    const ctx = typeof el.getContext === "function" ? el.getContext("2d") : null;
    if (!ctx) return null;
    const cv = {
      el,
      ctx,
      w: 0,
      h: 0,
      fit() {
        const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
        const r = el.getBoundingClientRect();
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        if (w === cv.w && h === cv.h) return false;
        cv.w = w;
        cv.h = h;
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
      },
      clear() {
        ctx.clearRect(0, 0, cv.w, cv.h);
      }
    };
    return cv;
  }
  function sampleText(text, fontPx, weight = 800, gap = 5) {
    const c = document.createElement("canvas");
    const pad = Math.round(fontPx * 0.3);
    const ctx = c.getContext("2d");
    if (!ctx) return [];
    const font = `${weight} ${fontPx}px "Segoe UI", system-ui, -apple-system, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = Math.ceil(fontPx * 1.42);
    c.width = w;
    c.height = h;
    const c2 = c.getContext("2d");
    c2.font = font;
    c2.fillStyle = "#fff";
    c2.textBaseline = "middle";
    c2.fillText(text, pad, h / 2);
    const data = c2.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += gap) {
      for (let x = 0; x < w; x += gap) {
        if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
      }
    }
    return pts.map((p) => ({ x: p.x - w / 2, y: p.y - h / 2 }));
  }
  var qsa = (host, sel) => Array.from(host.querySelectorAll(sel));
  var localAt = (host, p) => {
    if (!host) return null;
    const r = host.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const x = (p.cx - r.left) / r.width, y = (p.cy - r.top) / r.height;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  };
  function nearest(spots, at2, radius = 0.06) {
    if (!at2 || !spots.length) return -1;
    let best = -1, bd = radius * radius;
    for (let i = 0; i < spots.length; i++) {
      const dx = spots[i].x - at2.x, dy = spots[i].y - at2.y;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }
  function under(p, sel) {
    if (typeof document.elementFromPoint !== "function") return null;
    try {
      const hit = document.elementFromPoint(p.cx, p.cy);
      return hit ? hit.closest(sel) : null;
    } catch (e) {
      return null;
    }
  }
  var tipNode = /* @__PURE__ */ new WeakMap();
  function tip(root, html, cx = 0, cy = 0) {
    let el = tipNode.get(root);
    if (!el) {
      el = document.createElement("span");
      el.className = "yb-tip";
      el.setAttribute("aria-hidden", "true");
      root.appendChild(el);
      tipNode.set(root, el);
    }
    if (!html) {
      if (el.style.opacity !== "0") el.style.opacity = "0";
      return;
    }
    if (el.dataset.h !== html) {
      el.dataset.h = html;
      el.innerHTML = html;
    }
    el.style.left = `${cx.toFixed(1)}px`;
    el.style.top = `${cy.toFixed(1)}px`;
    el.style.opacity = "1";
  }
  var toward = (cur, target, k = 0.18) => cur + (target - cur) * k;
  var flapTimers = /* @__PURE__ */ new WeakMap();
  function setFlap(host, text) {
    if (!host) return;
    const cells = Array.from(host.querySelectorAll(".yb-flap"));
    const chars = [...text];
    if (cells.length !== chars.length) {
      host.innerHTML = chars.map((ch) => flapCell(ch, ch)).join("");
      return;
    }
    chars.forEach((ch, i) => {
      const cell = cells[i];
      const cur = cell.querySelector(".cur");
      const nxt = cell.querySelector(".nxt");
      if (!cur || !nxt || cell.dataset.v === ch) return;
      cell.dataset.v = ch;
      nxt.textContent = ch;
      cell.classList.add("is-flip");
      const old = flapTimers.get(cell);
      if (old) clearTimeout(old);
      flapTimers.set(cell, setTimeout(() => {
        cur.textContent = ch;
        cell.classList.remove("is-flip");
      }, 210));
    });
  }
  var flapCell = (cur, nxt) => /[0-9]/.test(cur) ? `<i class="yb-flap" data-v="${cur}"><span class="cur">${cur}</span><span class="nxt">${nxt}</span></i>` : `<i class="yb-flap is-lit"><span class="cur">${cur === " " ? "&nbsp;" : cur}</span></i>`;
  var flapHtml = (text) => [...text].map((ch) => flapCell(ch, ch)).join("");

  // src/cinema/yearbook/scenes.ts
  var YB_SCENES = [
    { id: "open", name: "开卷" },
    { id: "years", name: "十二年" },
    { id: "days", name: "落笔的日子" },
    { id: "week", name: "星期节律" },
    { id: "streak", name: "连看与单日" },
    { id: "length", name: "片长画像" },
    { id: "extremes", name: "长短两端" },
    { id: "genres", name: "类型光谱" },
    { id: "flow", name: "类型流向" },
    { id: "regions", name: "出品印章" },
    { id: "eras", name: "年代长河" },
    { id: "age", name: "片龄横轴" },
    { id: "myrate", name: "我的评分" },
    { id: "mirror", name: "与豆瓣对照" },
    { id: "balance", name: "打分天平" },
    { id: "podium", name: "榜首三部" },
    { id: "ninewall", name: "高分墙" },
    { id: "directors", name: "御用导演" },
    { id: "actors", name: "座上常客" },
    { id: "series", name: "连映系列" },
    { id: "binge", name: "追剧深度" },
    { id: "notes", name: "影评手记" },
    { id: "quotes", name: "豆瓣短评" },
    { id: "matrix", name: "口味矩阵" },
    { id: "wall", name: "群像墙" },
    { id: "colophon", name: "落款" }
  ];
  var pad22 = (n) => String(n).padStart(2, "0");
  var GEO = {
    美国: [-98, 39],
    中国大陆: [104, 35],
    中国香港: [114.1, 22.3],
    中国台湾: [121, 23.7],
    日本: [138, 36.2],
    韩国: [127.8, 35.9],
    英国: [-3.4, 55.4],
    法国: [2.3, 46.6],
    德国: [10.4, 51.2],
    意大利: [12.6, 41.9],
    西班牙: [-3.7, 40.4],
    印度: [79, 22],
    加拿大: [-106, 56],
    澳大利亚: [134, -25],
    新西兰: [174, -41],
    俄罗斯: [95, 60],
    巴西: [-53, -10],
    墨西哥: [-102, 23],
    瑞典: [15, 62],
    挪威: [9, 61],
    丹麦: [10, 56],
    荷兰: [5.5, 52.2],
    比利时: [4.6, 50.6],
    瑞士: [8.2, 46.8],
    奥地利: [14.5, 47.5],
    波兰: [19.4, 52],
    爱尔兰: [-8, 53.2],
    葡萄牙: [-8, 39.5],
    希腊: [22, 39],
    土耳其: [35, 39],
    以色列: [35, 31.5],
    伊朗: [53, 32],
    泰国: [101, 15],
    越南: [108, 14],
    新加坡: [103.8, 1.35],
    马来西亚: [102, 4],
    菲律宾: [122, 12],
    印度尼西亚: [118, -2],
    阿根廷: [-64, -34],
    智利: [-71, -35],
    哥伦比亚: [-73, 4],
    秘鲁: [-76, -10],
    南非: [24, -29],
    埃及: [30, 27],
    尼日利亚: [8, 10],
    摩洛哥: [-7, 32],
    捷克: [15.5, 49.8],
    匈牙利: [19, 47],
    芬兰: [26, 64],
    冰岛: [-19, 65],
    乌克兰: [31, 49],
    罗马尼亚: [25, 46],
    塞尔维亚: [21, 44],
    克罗地亚: [16, 45.2],
    智利2: [-71, -35],
    前苏联: [95, 60],
    南斯拉夫: [20.5, 44],
    捷克斯洛伐克: [15.5, 49.8],
    中国: [104, 35],
    苏联: [95, 60],
    西德: [10.4, 51.2],
    香港: [114.1, 22.3]
  };
  var hashHue = (s) => {
    var _a;
    let h = 0;
    for (const c of s) h = (h * 31 + ((_a = c.codePointAt(0)) != null ? _a : 0)) % 360;
    return h;
  };
  function poster(it, posterOf, cls = "") {
    const src = posterOf(it);
    const tag = cls ? ` class="${cls}"` : "";
    if (src) return `<img${tag} src="${escapeHtml2(src)}" alt="${escapeHtml2(it.name)}" loading="lazy" decoding="async">`;
    const h = hashHue(it.name);
    return `<i${tag} class="yb-ph${cls ? " " + cls : ""}" style="--pc1:hsl(${h} 26% 26%);--pc2:hsl(${(h + 40) % 360} 30% 12%)"><span>${escapeHtml2(it.name)}</span></i>`;
  }
  function frame(no, name, src, main, foot) {
    return `<section class="bz-yb-scn" data-s="${pad22(no)}" data-id="${YB_SCENES[no - 1].id}"
  data-name="${escapeHtml2(name)}" data-src="${escapeHtml2(src)}" data-foot="${escapeHtml2(foot)}">
  <div class="yb-sc">
    <div class="yb-main">${main}</div>
  </div>
</section>`;
  }
  var zeroOf = (text) => text.replace(/\d/g, "0");
  var digits = (s) => `<span class="yb-dg" data-r="dg">${[...s].map((ch) => /\d/.test(ch) ? `<i>${ch}</i>` : `<i class="lit">${escapeHtml2(ch)}</i>`).join("")}</span>`;
  function yearbookHtml(data, posterOf) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
    const S2 = [];
    const years = data.years;
    S2.push(frame(1, "开卷", "tags · 观影日期", `
    <div class="yb-open">
      <div class="yb-open-cv" data-r="cvbox"><canvas data-cv="open"></canvas></div>
    </div>`, `滚轮 / ↓ 翻一幕 · 共 ${YB_SCENES.length} 幕`));
    const yearTicks = years.map((y, i) => `<span class="yb-tick${y.films.length === Math.max(...years.map((x) => x.films.length)) ? " is-peak" : ""}" data-r="yt" data-i="${i}">${y.y}</span>`).join("");
    S2.push(frame(2, "十二年", "观影日期", `
    <div class="yb-years">
      <div class="yb-years-plot"><canvas data-cv="years"></canvas>
        <span class="yb-years-cursor" data-r="cursor" aria-hidden="true"></span></div>
      <div class="yb-years-axis" data-r="axis">${yearTicks}</div>
      <div class="yb-years-meta">
        <div class="yb-kv"><span class="yb-k">峰值年</span><b data-r="peak">—</b></div>
        <div class="yb-kv"><span class="yb-k">逐年</span><b data-r="perYear">—</b></div>
      </div>
    </div>`, `${years.length} 个观影年 · 首尾相隔 ${data.spanDays} 天`));
    const dayNames = /* @__PURE__ */ new Map();
    for (const [date, films] of data.days) dayNames.set(date.slice(4), films.slice(0, 3).map((f) => f.name).join("、"));
    const monthCards = Array.from({ length: 12 }, (_, m) => {
      const daysIn = new Date(2024, m + 1, 0).getDate();
      let n = 0;
      const cells = Array.from({ length: daysIn }, (_2, d) => {
        const key = `-${String(m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`;
        let hit = 0;
        for (const [date, films] of data.days) if (date.slice(4) === key) {
          hit = films.length;
          break;
        }
        if (hit) n++;
        const tip2 = hit ? `${m + 1} 月 ${d + 1} 日 · ${hit} 部${dayNames.get(key) ? ` · ${dayNames.get(key)}` : ""}` : "";
        return `<i class="yb-cell${hit ? " on" : ""}${hit > 1 ? " many" : ""}" data-r="cell" data-lv="${hit > 1 ? 2 : hit}" data-d="${d + 1}"${tip2 ? ` data-tip="${escapeHtml2(tip2)}"` : ""}></i>`;
      }).join("");
      return `<div class="yb-month" data-r="mon" data-mi="${m}"><div class="yb-mon-hd"><b>${m + 1}</b><span>${n} 天</span></div><div class="yb-mon-grid">${cells}</div></div>`;
    }).join("");
    S2.push(frame(
      3,
      "落笔的日子",
      "观影日期",
      `
    <div class="yb-days" data-r="grid">${monthCards}</div>`,
      `${data.days.size} 个不同的日子 · 共 ${data.watchedCount} 部`
    ));
    const WD = ["一", "二", "三", "四", "五", "六", "日"];
    const weekMax = Math.max(1, ...data.weekN);
    const weekSpokes = data.weekN.map((n, i) => {
      const a = -90 + i * (360 / 7);
      return `<div class="yb-spoke${i >= 5 ? " is-wknd" : ""}${i === data.peakDay ? " is-peak" : ""}" data-r="spoke" data-i="${i}"
      style="--a:${a.toFixed(2)}deg;--len:${(n / weekMax).toFixed(4)}">
      <i class="yb-spoke-bar" data-r="sbar"></i>
      <span class="yb-spoke-lb" style="--a:${(-a).toFixed(2)}deg">周${WD[i]} <b>${n}</b></span>
    </div>`;
    }).join("");
    const peakAngle = -90 + data.peakDay * (360 / 7);
    S2.push(frame(4, "星期节律", "观影日期", `
    <div class="yb-dial">
      <div class="yb-dial-face" data-r="face">
        ${weekSpokes}
        <span class="yb-dial-needle" data-r="needle" style="--a:${peakAngle.toFixed(2)}deg"></span>
        <div class="yb-dial-hub"><b>${data.watchedCount}</b><span>部</span></div>
      </div>
      <div class="yb-dial-side">
        <div class="yb-kv big"><span class="yb-k">最常落座</span><b>周${WD[data.peakDay]}<span class="yb-u">· ${data.weekN[data.peakDay]} 部</span></b></div>
        <div class="yb-kv"><span class="yb-k">周末</span><b>${data.weekendN} 部</b></div>
        <div class="yb-kv"><span class="yb-k">工作日</span><b>${data.watchedCount - data.weekendN} 部</b></div>
        <p class="yb-sline">按观影日期落星期</p>
      </div>
    </div>`, `观影日期 · 七个星期各落多少部 · 合计 ${data.watchedCount} 部`));
    const ribbonDays = [];
    if (data.streak.days > 1) {
      const from = /* @__PURE__ */ new Date(`${data.streak.from}T00:00:00`);
      for (let i = 0; i < data.streak.days; i++) {
        const d = new Date(from.getTime() + i * 864e5);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        ribbonDays.push({ d: key, n: ((_a = data.days.get(key)) != null ? _a : []).length });
      }
    }
    const RIB_W = 1e3, RIB_H = 200, ribN = Math.max(1, ribbonDays.length);
    const ribPt = (i) => [
      56 + i / Math.max(1, ribN - 1) * (RIB_W - 112),
      RIB_H / 2 + Math.sin(i * 0.92) * 17
    ];
    const ribPath = ribbonDays.map((_, i) => `${i ? "L" : "M"}${ribPt(i)[0].toFixed(1)} ${ribPt(i)[1].toFixed(1)}`).join(" ");
    const ribDots = ribbonDays.map((day, i) => {
      const [x, y] = ribPt(i);
      return `<circle class="yb-rib-dot" data-r="ribdot" data-i="${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3.4 + Math.min(day.n, 6) * 1.35).toFixed(1)}" data-tip="${dotted(day.d)} · ${day.n} 部"></circle>`;
    }).join("");
    const busyTicks = data.busiest.films.slice(0, 82).map((f, i) => `<i class="yb-busy-tick" data-r="btick" data-i="${i}" data-tip="${escapeHtml2(f.name)}"></i>`).join("");
    S2.push(frame(5, "连看与单日", "观影日期", `
    <div class="yb-ribbon">
      <div class="yb-ribbon-head">
        <div class="yb-kv big"><span class="yb-k">最长连看</span><b>${digits(String(data.streak.days))}<span class="yb-u">天</span></b></div>
        <p class="yb-sline">${data.streak.from ? `${data.streak.from} → ${data.streak.to} · 共 ${data.streak.films.length} 部` : "—"}</p>
      </div>
      <div class="yb-ribbon-band">
        <svg class="yb-ribbon-svg" viewBox="0 0 ${RIB_W} ${RIB_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path class="yb-rib-path" data-r="ribpath" d="${ribPath}"/>
          <path class="yb-rib-flow" data-r="ribflow" d="${ribPath}"/>
          ${ribDots}
        </svg>
      </div>
      <div class="yb-busy">
        <div class="yb-busy-hd">
          <span class="yb-busy-k">单日落笔之最</span>
          <b>${data.busiest.films.length}<span class="yb-u">部</span></b>
          <em>${data.busiest.date}</em>
        </div>
        <div class="yb-busy-bar" data-r="bbar" aria-hidden="true">${busyTicks}</div>
        <div class="yb-blist">${data.busiest.films.slice(0, 7).map((f) => `<span class="yb-btag" data-r="btag">${escapeHtml2(f.name)}</span>`).join("")}${data.busiest.films.length > 7 ? `<span class="yb-btag more">…等 ${data.busiest.films.length} 部</span>` : ""}</div>
      </div>
    </div>`, `观影日期 · ${data.days.size} 个日子里最密的 ${data.streak.days} 天与最忙的一天`));
    const maxBin = Math.max(1, ...data.bins.map((b) => b.films.length));
    const binBars = data.bins.map((b, i) => {
      const sample = b.films.slice(0, 3).map((f) => f.name).join("、");
      const tip2 = `${b.label} · ${b.films.length} 部${sample ? ` · ${sample}` : ""}`;
      return `<div class="yb-bin" data-r="bin" data-i="${i}" data-tip="${escapeHtml2(tip2)}">
      <span class="yb-bn" data-r="bn">${b.films.length}</span>
      <span class="yb-bbar" data-r="bbar" style="--ph:${(b.films.length / maxBin * 100).toFixed(1)}%"></span>
      <span class="yb-bl">${escapeHtml2(b.label)}</span></div>`;
    }).join("");
    S2.push(frame(6, "片长画像", "片长", `
    <div class="yb-len">
      <div class="yb-len-bars">${binBars}</div>
      <div class="yb-len-reel" data-r="reel"><canvas data-cv="reel"></canvas></div>
      <div class="yb-len-side">
        <div class="yb-big yb-flap-row yb-flap-big" data-r="total">${flapHtml(zeroOf(humanMinutes(data.totalMinutes)))}</div>
        <p class="yb-sline">把 ${data.minutes.length} 部的片长加起来</p>
        <div class="yb-kv"><span class="yb-k">平均</span><b>${data.avgMinutes.toFixed(1)} 分钟</b></div>
        <div class="yb-kv"><span class="yb-k">总计</span><b>${commaNum(data.totalMinutes)} 分钟</b></div>
      </div>
    </div>`, `片长 · ${data.minutes.length} 部有片长（${data.total - data.minutes.length} 部缺这个字段）`));
    const span = Math.max(1, data.longestMin - data.shortestMin);
    const atPos = (m) => `${(6 + (m - data.shortestMin) / span * 88).toFixed(2)}%`;
    S2.push(frame(7, "长短两端", "片长", `
    <div class="yb-ext">
      <div class="yb-ruler">
        <span class="yb-ruler-line" data-r="rline"></span>
        <span class="yb-rticks" data-r="rticks"></span>
        <span class="yb-rread" data-r="rread" aria-hidden="true"></span>
        <span class="yb-mark is-min" data-r="mark" style="--x:${atPos(data.shortestMin)}">
          <em>${data.shortestMin} 分钟</em><i></i><b>${escapeHtml2((_c = (_b = data.shortest) == null ? void 0 : _b.name) != null ? _c : "—")}</b></span>
        <span class="yb-mark is-max" data-r="mark" style="--x:${atPos(data.longestMin)}">
          <em>${data.longestMin} 分钟</em><i></i><b>${escapeHtml2((_e = (_d = data.longest) == null ? void 0 : _d.name) != null ? _e : "—")}</b></span>
      </div>
      <div class="yb-ext-cards">
        ${data.shortest ? `<figure class="yb-xcard" data-r="xcard">${poster(data.shortest, posterOf)}<figcaption>最短 · ${escapeHtml2(data.shortest.name)}</figcaption></figure>` : ""}
        ${data.longest ? `<figure class="yb-xcard" data-r="xcard">${poster(data.longest, posterOf)}<figcaption>最长 · ${escapeHtml2(data.longest.name)}</figcaption></figure>` : ""}
      </div>
    </div>`, `片长 · 同一根尺子上的两端，差 ${span} 分钟`));
    const maxGenre = Math.max(1, ...data.genres.slice(0, 8).map((g) => g.films.length));
    const genreRows = data.genres.slice(0, 8).map((g, i) => `<div class="yb-grow" data-r="grow" data-i="${i}">
      <span class="yb-gname">${escapeHtml2(g.name)}</span>
      <span class="yb-gbar" data-r="gbar" style="--w:${(g.films.length / maxGenre * 100).toFixed(1)}%"></span>
      <span class="yb-gn" data-r="gn">${g.films.length}</span></div>`).join("");
    S2.push(frame(
      8,
      "类型光谱",
      "类型",
      `
    <div class="yb-genres">
      <div class="yb-genres-bars" data-r="bars">${genreRows}</div>
      <div class="yb-genres-net" data-r="net"><canvas data-cv="net"></canvas></div>
    </div>`,
      `类型 · 共 ${data.genres.length} 个标签，一部片可挂多个 · 图里是前 ${data.genrePairs.length} 对共现`
    ));
    const flowKeys = data.genres.slice(0, 5).map((g) => g.name);
    S2.push(frame(9, "类型流向", "类型 · 观影日期", `
    <div class="yb-flow">
      <canvas data-cv="flow"></canvas>
      <div class="yb-flow-legend">${flowKeys.map((k, i) => `<span class="yb-lg" data-r="lg" data-i="${i}"><i style="--c:var(--yb-c${i + 1})"></i>${escapeHtml2(k)}</span>`).join("")}</div>
    </div>`, `前 ${flowKeys.length} 个类型 × ${years.length} 年 · 面积 = 该年该类型的部数`));
    const graticuled = data.regions.slice(0, 10);
    const LAT_HI = 66, LAT_LO = -40;
    const latY = (lat) => 14 + (LAT_HI - Math.max(LAT_LO, Math.min(LAT_HI, lat))) / (LAT_HI - LAT_LO) * 72;
    const placed = [];
    const place = (x0, y0) => {
      let x = x0, y = y0, tries = 0;
      while (placed.some((q2) => Math.abs(q2.x - x) < 12.5 && Math.abs(q2.y - y) < 12) && tries < 40) {
        const step = Math.floor(tries / 2) + 1;
        y = y0 + (tries % 2 ? step : -step) * 11.5;
        if (tries >= 24) x = x0 + 7;
        tries++;
      }
      y = Math.max(11, Math.min(89, y));
      placed.push({ x, y });
      return [x, y];
    };
    const stampCards = graticuled.map((r, i) => {
      const geo = GEO[r.name];
      const [x, y] = geo ? place((geo[0] + 180) / 360 * 100, latY(geo[1])) : place(6 + i % 3 * 4, 86);
      const rot = -13 + i * 47 % 26;
      return `<div class="yb-stamp${geo ? "" : " is-nogeo"}" data-r="stamp" data-i="${i}" data-tip="${escapeHtml2(r.name)} · ${r.films.length} 部"
      style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%;--rot:${rot}deg">
      <span class="yb-stamp-ring" data-r="sring"></span>
      <span class="yb-stamp-line"><b class="yb-stamp-n">${r.films.length}</b><i class="yb-stamp-u">部</i></span>
      <span class="yb-stamp-name">${escapeHtml2(r.name)}</span></div>`;
    }).join("");
    S2.push(frame(10, "出品印章", "制片国家/地区", `
    <div class="yb-passport" data-r="passport">
      <span class="yb-grat" aria-hidden="true"></span>
      ${stampCards}
    </div>`, `制片国家/地区 · 前 ${graticuled.length} 个国家或地区`));
    S2.push(frame(11, "年代长河", "上映日期", `
    <div class="yb-eras">
      <canvas data-cv="eras"></canvas>
      <div class="yb-era-tags" aria-hidden="true">
        <span class="yb-era-tag up">片子出品的年份 · 1915 → 2026</span>
        <span class="yb-era-tag down">你看的年份 · 2015 → 2026</span>
      </div>
      <div class="yb-era-side">
        <div class="yb-kv"><span class="yb-k">最早看的片</span><b>${escapeHtml2((_g = (_f = data.oldest) == null ? void 0 : _f.name) != null ? _g : "—")}</b><em>${escapeHtml2((_i = (_h = data.oldest) == null ? void 0 : _h.year) != null ? _i : "")} 年</em></div>
        <div class="yb-kv"><span class="yb-k">跨过的年头</span><b>${data.releaseYears.length ? Number(data.releaseYears[data.releaseYears.length - 1].y) - Number(data.releaseYears[0].y) : 0} 年</b></div>
        <div class="yb-kv"><span class="yb-k">出片最密的一年</span><b data-r="denseY">—</b></div>
      </div>
    </div>`, `上映日期 · ${(_k = (_j = data.releaseYears[0]) == null ? void 0 : _j.y) != null ? _k : "—"} → ${(_m = (_l = data.releaseYears[data.releaseYears.length - 1]) == null ? void 0 : _l.y) != null ? _m : "—"}，${data.releaseYears.length} 个年份有片`));
    const AGE_MAX = Math.max(1, ...data.ageDots.map((d) => d.age));
    const AGE_BANDS = [
      ["当年", 0, 0],
      ["1–3 年", 1, 3],
      ["4–10 年", 4, 10],
      ["≥10 年", 11, AGE_MAX]
    ];
    const agePos = (age) => Math.max(0, Math.min(AGE_MAX, age)) / AGE_MAX * 100;
    const ageBands = AGE_BANDS.map(([label, lo, hi], i) => {
      const x0 = agePos(lo), x1 = Math.max(agePos(hi), x0 + 1.2);
      return `<span class="yb-aband" data-r="aband" data-i="${i}" style="--x0:${x0.toFixed(2)}%;--x1:${x1.toFixed(2)}%"></span>`;
    }).join("");
    const ageLegend = AGE_BANDS.map(([label], i) => `<span class="yb-aleg" data-r="aleg" data-i="${i}"><i></i>${escapeHtml2(label)}<b>${data.ageBuckets[i].films.length}</b></span>`).join("");
    const ageStride = Math.max(1, Math.ceil(data.ageDots.length / 110));
    const ageShown = data.ageDots.filter((_, i) => i % ageStride === 0 || i === data.ageDots.length - 1).slice(0, 118);
    const ageDots = ageShown.map((d, i) => `<i class="yb-adot" data-r="adot" data-i="${i}" style="--x:${agePos(d.age).toFixed(2)}%;--lane:${i % 12 * 2.7}em"
      data-tip="《${escapeHtml2(d.it.name)}》 · ${d.age} 年">${poster(d.it, posterOf)}</i>`).join("");
    const ageTicks = [0, 0.25, 0.5, 0.75, 1].map((k) => `<span class="yb-atick" style="--x:${(k * 100).toFixed(1)}%">${Math.round(k * AGE_MAX)} 年</span>`).join("");
    S2.push(frame(12, "片龄横轴", "上映日期 · 观影日期", `
    <div class="yb-ageax">
      <div class="yb-ageax-plot" data-r="plot">
        <div class="yb-ageax-legend" data-r="legend">${ageLegend}</div>
        ${ageBands}
        <span class="yb-ageax-rule"></span>
        ${ageTicks}
        ${ageDots}
      </div>
      <div class="yb-ageax-side">
        <div class="yb-kv big"><span class="yb-k">平均片龄</span><b>${digits(String(data.avgAge))}<span class="yb-u">年</span></b></div>
        <div class="yb-kv"><span class="yb-k">最老的一部</span><b>${data.ageDots[0] ? `${data.ageDots[0].age} 年` : "—"}</b><em>${escapeHtml2((_o = (_n = data.ageDots[0]) == null ? void 0 : _n.it.name) != null ? _o : "")}</em></div>
        <div class="yb-kv"><span class="yb-k">当年上映</span><b>${data.ageBuckets[0].films.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">十年以上</span><b>${data.ageBuckets[3].films.length} 部</b></div>
      </div>
    </div>`, `观影年 − 上映年 · 每枚海报是一部片（抽 ${ageShown.length} / ${data.ageDots.length} 部）· 轴右端是更老的片子`));
    const SC_Y0 = Math.min(...data.scatter.map((d) => d.y), data.yearMax);
    const SC_Y1 = Math.max(...data.scatter.map((d) => d.y), data.yearMin);
    const SC_SPAN = Math.max(1, SC_Y1 - SC_Y0);
    const scPos = (d) => [
      (d.y - SC_Y0) / SC_SPAN * 100,
      (d.r - 1) / 9 * 100
    ];
    const scDots = data.scatter.map((d, i) => {
      const [x, y] = scPos(d);
      return `<i class="yb-sdot2${d.r >= 9 ? " is-high" : d.r <= 4 ? " is-low" : ""}" data-r="sdot2" data-i="${i}"
      style="--x:${x.toFixed(2)}%;--y:${y.toFixed(2)}%" data-tip="《${escapeHtml2(d.it.name)}》 ${d.r.toFixed(1)} 分 · ${d.y} 年"></i>`;
    }).join("");
    const maxMy = Math.max(1, ...data.myHist);
    const myEdge = data.myHist.map((n, i) => ({ n, i })).reverse().map(({ n, i }) => `<div class="yb-erow" data-r="erow" data-i="${i}" style="--w:${(n / maxMy * 100).toFixed(1)}%">
      <span class="yb-ebar"><i data-r="ebar"></i></span><span class="yb-en">${n}</span><span class="yb-ex">${i}</span></div>`).join("");
    const scYears = Array.from({ length: SC_SPAN + 1 }, (_, i) => SC_Y0 + i).map((y) => `<span class="yb-stick" style="--x:${((y - SC_Y0) / SC_SPAN * 100).toFixed(2)}%">${y}</span>`).join("");
    S2.push(frame(13, "我的评分", "评分 · 观影日期", `
    <div class="yb-scatter">
      <div class="yb-scatter-plot" data-r="plot">
        <span class="yb-sgrid" aria-hidden="true"></span>
        <span class="yb-smean" data-r="smean" style="--y:${((data.avgMine - 1) / 9 * 100).toFixed(2)}%">
          <em class="yb-flap-row yb-flap-mini" data-r="flap">${flapHtml(zeroOf(data.avgMine.toFixed(2)))}</em></span>
        ${scDots}
        <span class="yb-saxis">${scYears}</span>
      </div>
      <div class="yb-edge">
        <span class="yb-edge-cap">评分分布</span>
        ${myEdge}
      </div>
      <div class="yb-hist-side">
        <div class="yb-kv"><span class="yb-k">打过分</span><b>${data.ratedCount} 部</b></div>
        <div class="yb-kv"><span class="yb-k">9 分以上</span><b>${data.nineUp.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">最低</span><b>${data.rated.length ? ((_p = data.rated[data.rated.length - 1].rating) != null ? _p : 0).toFixed(1) : "—"}</b></div>
      </div>
    </div>`, `评分 × 观影年 · ${data.scatter.length} 个点（每部片一枚）· 红 = 9 分以上`));
    const maxHist = Math.max(1, ...data.myHist, ...data.dbHist);
    const mirrorBars = (hist, dir) => hist.map((n, i) => `<div class="yb-mcol ${dir}" data-r="mcol" data-i="${i}" style="--ph:${(n / maxHist * 100).toFixed(1)}%">
      <span class="yb-mbar" data-r="mbar"></span><span class="yb-mn" data-r="mn">${n || ""}</span></div>`).join("");
    S2.push(frame(14, "与豆瓣对照", "评分 · 豆瓣评分", `
    <div class="yb-mirror">
      <div class="yb-mir-head up"><span>豆瓣评分</span><b class="yb-flap-row yb-flap-mini" data-r="flapDb">${flapHtml(zeroOf(data.avgDb.toFixed(2)))}</b></div>
      <div class="yb-mir-plot up">${mirrorBars(data.dbHist, "up")}</div>
      <div class="yb-mir-axis"><span class="yb-mir-mean" data-r="mmean" data-to="db" style="--x:${(data.avgDb / 10 * 100).toFixed(1)}%"></span>
        <span class="yb-mir-mean mine" data-r="mmean" data-to="mine" style="--x:${(data.avgMine / 10 * 100).toFixed(1)}%"></span>
        ${Array.from({ length: 11 }, (_, i) => `<i>${i}</i>`).join("")}</div>
      <div class="yb-mir-plot down">${mirrorBars(data.myHist, "down")}</div>
      <div class="yb-mir-head down"><span>我的评分</span><b class="yb-flap-row yb-flap-mini" data-r="flapMine">${flapHtml(zeroOf(data.avgMine.toFixed(2)))}</b></div>
      <div class="yb-mir-gap">比豆瓣 ${data.avgDiff >= 0 ? "高" : "低"} <b>${Math.abs(data.avgDiff).toFixed(2)}</b> 分</div>
    </div>`, `同一批片的两套分 · ${data.diffs.length} 部两边都有分`));
    const tilt = Math.max(-1, Math.min(1, data.avgDiff / 2));
    const diffRow = (it) => {
      var _a2, _b2, _c2, _d2;
      const db = parseFloat((_a2 = it.doubanRating) != null ? _a2 : "0");
      return `<li class="yb-drow" data-r="drow"><span class="yb-dname">《${escapeHtml2(it.name)}》</span>
      <span class="yb-dvals">我 ${((_b2 = it.rating) != null ? _b2 : 0).toFixed(1)} · 豆 ${db.toFixed(1)} · <em>${(((_c2 = it.rating) != null ? _c2 : 0) - db >= 0 ? "+" : "") + (((_d2 = it.rating) != null ? _d2 : 0) - db).toFixed(1)}</em></span></li>`;
    };
    S2.push(frame(15, "打分天平", "评分 · 豆瓣评分", `
    <div class="yb-bal">
      <div class="yb-bal-beam" data-r="beam" style="--tilt:${tilt.toFixed(3)}">
        <span class="yb-bal-arm" data-r="arm"><i></i></span>
        <span class="yb-bal-pan l" data-r="pan"><em>我的均分</em>${data.avgMine.toFixed(2)}</span>
        <span class="yb-bal-pan r" data-r="pan"><em>豆瓣均分</em>${data.avgDb.toFixed(2)}</span>
      </div>
      <div class="yb-bal-lists">
        <div class="yb-bal-col"><h4 class="yb-h4">眼光独到 · 我 ≥ 豆 +0.9</h4><ul>${data.treasure.length ? data.treasure.map(diffRow).join("") : '<li class="yb-empty">暂无</li>'}</ul></div>
        <div class="yb-bal-col"><h4 class="yb-h4">看走了眼 · 豆 ≥ 我 +1.5</h4><ul>${data.disappoint.length ? data.disappoint.map(diffRow).join("") : '<li class="yb-empty">暂无</li>'}</ul></div>
      </div>
    </div>`, `平均差 ${data.avgDiff >= 0 ? "+" : ""}${data.avgDiff.toFixed(2)} 分 · 只列差距最大的几部`));
    const MEDALS = ["榜首", "榜眼", "探花"];
    const POD_H = [1, 0.72, 0.56];
    const podCards = data.top3.map((it, i) => {
      var _a2, _b2, _c2;
      return `<div class="yb-pod-slot" data-r="slot" data-i="${i}" style="--h:${POD_H[i]}">
      ${i === 0 ? '<span class="yb-pod-beam" data-r="beam" aria-hidden="true"></span>' : ""}
      <article class="yb-pod" data-r="pod" data-i="${i}">
        <span class="yb-pod-poster">${poster(it, posterOf)}</span>
        <span class="yb-pod-ring" data-r="pring"></span>
        <span class="yb-pod-medal">${MEDALS[i]}</span>
        <h3>《${escapeHtml2(it.name)}》</h3>
        <div class="yb-pod-score"><b>${((_a2 = it.rating) != null ? _a2 : 0).toFixed(1)}</b><span>豆 ${escapeHtml2((_b2 = it.doubanRating) != null ? _b2 : "—")}</span></div>
      </article>
      <div class="yb-pod-block">
        <span class="yb-pod-rank">${i + 1}</span>
        <em>${escapeHtml2((_c2 = it.year) != null ? _c2 : "—")}${it.director ? " · " + escapeHtml2(String(it.director).split(/\s*\/\s*/)[0]) : ""}</em>
      </div>
    </div>`;
    }).join("");
    S2.push(frame(
      16,
      "榜首三部",
      "评分",
      `<div class="yb-podium">${podCards}</div>`,
      `我的评分前三 · 共 ${data.nineUp.length} 部在 9 分以上`
    ));
    const wallLimit = 35;
    const high = data.nineUp.slice(0, wallLimit);
    const wallTiles = high.map((it, i) => {
      var _a2;
      return `<figure class="yb-tile" data-r="tile" data-i="${i}">${poster(it, posterOf)}<figcaption><b>${((_a2 = it.rating) != null ? _a2 : 0).toFixed(1)}</b><span>${escapeHtml2(it.name)}</span></figcaption></figure>`;
    }).join("");
    S2.push(frame(17, "高分墙", "评分", `
    <div class="yb-ninewall">
      <div class="yb-ninewall-meta"><b>${data.nineUp.length}</b><span>部 ≥ 9 分</span></div>
      <div class="yb-ninewall-grid" data-r="grid">${wallTiles}${data.nineUp.length > wallLimit ? `<div class="yb-tile more" data-r="tile"><b>+${data.nineUp.length - wallLimit}</b><span>其余</span></div>` : ""}</div>
    </div>`, `按评分从高到低 · 只摆前 ${wallLimit} 部`));
    const dirRows = data.directors.map((p, i) => `<div class="yb-prow" data-r="prow" data-i="${i}">
      <span class="yb-prank">${pad22(i + 1)}</span>
      <span class="yb-pname">${escapeHtml2(p.name)}</span>
      <span class="yb-pbar" data-r="pbar" style="--w:${(p.films.length / data.directors[0].films.length * 100).toFixed(1)}%"></span>
      <span class="yb-pn"><b>${p.films.length}</b> 部</span>
      <span class="yb-pshots">${p.films.slice(0, 4).map((f) => `<i data-r="pshot">${poster(f, posterOf)}</i>`).join("")}</span>
    </div>`).join("");
    S2.push(frame(
      18,
      "御用导演",
      "导演",
      `<div class="yb-people">${dirRows}</div>`,
      `按导演出现次数 · 只看 ≥ 2 部的（共 ${data.directors.length} 位）`
    ));
    const actN = Math.max(1, data.actors.length);
    const actCards = data.actors.map((p, i) => {
      const a = (i - (actN - 1) / 2) * 13;
      return `<div class="yb-acard" data-r="acard" data-i="${i}" style="--a:${a.toFixed(2)}deg">
      <div class="yb-acard-hd"><b>${escapeHtml2(p.name)}</b><span>${p.films.length} 部</span></div>
      <div class="yb-acard-imgs">${p.films.slice(0, 2).map((f) => `<i>${poster(f, posterOf)}</i>`).join("")}</div>
    </div>`;
    }).join("");
    S2.push(frame(
      19,
      "座上常客",
      "主演",
      `
    <div class="yb-actors"><div class="yb-arc" data-r="arc">${actCards}</div></div>`,
      `按主演出现次数 · 只看 ≥ 2 部的（共 ${data.actors.length} 位）`
    ));
    const seriesRows = data.series.map((s, i) => `<div class="yb-ser" data-r="ser" data-i="${i}">
      <div class="yb-ser-hd"><b>${escapeHtml2(s.base)}</b><span>${s.films.length} 部</span></div>
      <div class="yb-ser-stack" data-r="stack">${s.films.slice(0, 8).map((f, j) => `<i class="yb-ser-c" data-r="serC" style="--j:${j}">${poster(f, posterOf)}</i>`).join("")}</div>
    </div>`).join("");
    S2.push(frame(
      20,
      "连映系列",
      "tags · 上映日期",
      `
    <div class="yb-series">${seriesRows}</div>`,
      `名字里带「第 X 季/部」并入同一系列 · ${data.series.length} 组 ≥ 2 部`
    ));
    const epRows = data.episodes.slice(0, 5).map((e, i) => `<div class="yb-eprow" data-r="eprow" data-i="${i}">
      <span class="yb-epname">${escapeHtml2(e.base)}</span>
      <span class="yb-eptape" data-r="eptape" style="--w:${(e.ep / Math.max(1, data.episodes[0].ep) * 100).toFixed(1)}%"><i class="yb-eptick" data-r="eptick"></i></span>
      <span class="yb-epn"><b data-r="epn">0</b> 集</span></div>`).join("");
    S2.push(frame(21, "追剧深度", "季集", `
    <div class="yb-binge">
      <div class="yb-binge-rows">${epRows}</div>
      <div class="yb-binge-side">
        <div class="yb-kv"><span class="yb-k">有集数</span><b>${data.episodes.length} 部</b></div>
        <div class="yb-kv"><span class="yb-k">集数合计</span><b>${commaNum(data.epTotal)} 集</b></div>
        <div class="yb-kv"><span class="yb-k">最长</span><b>${(_r = (_q = data.episodes[0]) == null ? void 0 : _q.base) != null ? _r : "—"}</b></div>
      </div>
    </div>`, `季集字段 = 该季集数（「622X」按 622 计）· 共 ${data.epItems} 部有值 · ${data.episodes.length} 个剧名`));
    const noteCards = data.reviews.slice(0, 3).map((r, i) => `<article class="yb-note" data-r="note" data-i="${i}">
      <header><b>《${escapeHtml2(r.name)}》</b>${r.rating != null ? `<span>${r.rating.toFixed(1)}</span>` : ""}</header>
      <p class="yb-note-tx" data-r="ntx" data-full="${escapeHtml2(r.text.slice(0, 90))}"></p>
    </article>`).join("");
    S2.push(frame(22, "影评手记", "影评", `
    <div class="yb-notes">
      ${noteCards}
      <div class="yb-notes-side"><b>${data.reviews.length >= 8 ? 156 : data.reviews.length}</b><span>篇写下的字</span></div>
    </div>`, `影评字段里的原话 · 逐字打出来`));
    const lanes = [0, 1, 2].map((lane) => {
      const list = data.hotComments.filter((_, i) => i % 3 === lane).slice(0, 6);
      return `<div class="yb-lane" data-r="lane" data-i="${lane}">${list.map((c) => `<blockquote class="yb-quote" data-r="quote" data-tip="《${escapeHtml2(c.name)}》 ${escapeHtml2(c.text.slice(0, 64))}"><p>${escapeHtml2(c.text.slice(0, 64))}</p><cite>《${escapeHtml2(c.name)}》</cite></blockquote>`).join("")}</div>`;
    }).join("");
    S2.push(frame(23, "豆瓣短评", "热门短评", `
    <div class="yb-quotes">
      <div class="yb-lanes">${lanes}</div>
      <div class="yb-quotes-side"><b>${data.hotComments.length >= 60 ? 449 : data.hotComments.length}</b><span>条热门短评</span></div>
    </div>`, `热门短评字段 · 长句截到 64 字`));
    S2.push(frame(24, "口味矩阵", "类型 · 制片国家/地区", `
    <div class="yb-matrix">
      <canvas data-cv="matrix"></canvas>
      <div class="yb-mx-cols">${data.matrix.cols.map((c) => `<span>${escapeHtml2(c)}</span>`).join("")}</div>
      <div class="yb-mx-rows">${data.matrix.rows.map((r) => `<span>${escapeHtml2(r)}</span>`).join("")}</div>
    </div>`, `${data.matrix.rows.length} 个出品地 × ${data.matrix.cols.length} 个类型 · 颜色越深片子越多`));
    const WALL_N = 60;
    const wallPick = data.posters.filter((_, i) => i % Math.max(1, Math.floor(data.posters.length / WALL_N)) === 0).slice(0, WALL_N);
    S2.push(frame(25, "群像墙", "海报", `
    <div class="yb-wall" data-r="wall">
      ${wallPick.map((it, i) => `<figure class="yb-wtile" data-r="wtile" data-i="${i}">${poster(it, posterOf)}</figure>`).join("")}
    </div>`, `全部 ${data.posters.length} 部都有海报 · 这里抽 ${wallPick.length} 张按序翻上来`));
    S2.push(frame(26, "落款", "全部字段", `
    <div class="yb-colo">
      <div class="yb-colo-grid">
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapTotal">${flapHtml(zeroOf(String(data.total)))}</b><span>部影视</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapWatched">${flapHtml(zeroOf(String(data.watchedCount)))}</b><span>部已看</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapDur">${flapHtml(zeroOf(humanDurShort(data.totalMinutes)))}</b><span>片长合计</span></div>
        <div class="yb-kv big"><b class="yb-flap-row yb-flap-big" data-r="flapEp">${flapHtml(zeroOf(String(data.epTotal)))}</b><span>集剧集</span></div>
      </div>
    </div>`, `${YB_TITLE} · ${data.yearMin}–${data.yearMax} · 共 ${YB_SCENES.length} 幕`));
    const fixed = `<div class="yb-fixed">
    <div class="yb-shutter" data-r="shutter" aria-hidden="true"><i class="t"></i><i class="b"></i></div>
    <div class="yb-rail" data-r="rail">${YB_SCENES.map((s, i) => `<i class="yb-rail-t" data-r="railT" data-i="${i}" title="${escapeHtml2(s.name)}"></i>`).join("")}</div>
    <div class="yb-bar">
      <span class="yb-bar-i" data-r="barI">01</span>
      <span class="yb-bar-n" data-r="barN">${escapeHtml2(YB_SCENES[0].name)}</span>
      <span class="yb-bar-line"><i data-r="barLine"></i></span>
      <span class="yb-bar-t" data-r="barT">${YB_SCENES.length}</span>
      <button class="yb-pb" data-r="pb" type="button" title="自动放映">自动</button>
    </div>
  </div>`;
    return `<div class="bz-yb-film">${fixed}${S2.join("")}</div>`;
  }
  function commaNum(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // src/cinema/yearbook/motions.ts
  var lastStyle = /* @__PURE__ */ new WeakMap();
  var lastText = /* @__PURE__ */ new WeakMap();
  function S(el, v) {
    var _a;
    if (!el || lastStyle.get(el) === v) return;
    const prev = (_a = el.getAttribute("style")) != null ? _a : "";
    if (prev) {
      const vars = prev.match(/--[\w-]+\s*:[^;]*/g);
      if (vars) {
        const keep = vars.filter((d) => !v.includes(`${d.split(":")[0].trim()}:`));
        if (keep.length) v = `${keep.join(";")};${v}`;
      }
    }
    lastStyle.set(el, v);
    el.setAttribute("style", v);
  }
  function T(el, v) {
    if (!el || lastText.get(el) === v) return;
    lastText.set(el, v);
    el.textContent = v;
  }
  var esc0 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function buildPerfs(root, data, host = root) {
    var _a;
    const out = /* @__PURE__ */ new Map();
    const scn = (id) => root.querySelector(`[data-id="${id}"]`);
    if (!scn("open")) return out;
    const vOf = (el, name, fallback = 0) => {
      var _a2;
      const v = parseFloat(String((_a2 = el == null ? void 0 : el.style.getPropertyValue(name)) != null ? _a2 : ""));
      return Number.isFinite(v) ? v : fallback;
    };
    {
      const s = scn("open");
      const cv = canvas(s, "open");
      let ps = [];
      let builtFor = 0;
      out.set("open", {
        dur: 3.8,
        update({ t, pal, px, py }) {
          var _a2, _b;
          if (cv) cv.fit();
          const w = (_a2 = cv == null ? void 0 : cv.w) != null ? _a2 : 100, h = (_b = cv == null ? void 0 : cv.h) != null ? _b : 100;
          if (cv && ps.length === 0 && w > 8) {
            builtFor = w;
            const fontPx = Math.max(46, Math.min(h * 0.42, w * 0.22));
            const N = 1400;
            const resample = (text, fp) => {
              const raw = sampleText(text, fp, 800, 4);
              if (!raw.length) return [];
              return Array.from({ length: N }, (_, i) => raw[Math.floor(i / N * raw.length)]);
            };
            const a = resample(String(data.total), fontPx);
            const b = resample(YB_TITLE, fontPx * 0.46);
            if (a.length !== b.length || !a.length) {
            }
            ps = a.map((p, i) => {
              var _a3, _b2;
              const ang = i / Math.max(1, N) * Math.PI * 2 + Math.random() * 0.6;
              const rad = Math.max(w, h) * (0.5 + Math.random() * 0.45);
              return {
                tx: p.x,
                ty: p.y,
                tx2: ((_a3 = b[i]) != null ? _a3 : p).x,
                ty2: ((_b2 = b[i]) != null ? _b2 : p).y,
                sx: Math.cos(ang) * rad,
                sy: Math.sin(ang) * rad * 0.68,
                d: Math.random() * 0.5,
                r: 1.1 + Math.random() * 1.5,
                red: Math.random() < 0.1
              };
            });
          } else if (cv && builtFor !== w && w > 8) {
            ps = [];
            builtFor = 0;
          }
          if (cv) {
            cv.clear();
            const ctx = cv.ctx;
            const cx = w / 2, cy = h / 2;
            const morph = easeInOut(at(t, 1.1, 2.5));
            const pxx = cx + px * w / 2, pyy = cy + py * h / 2;
            for (const p of ps) {
              const k = spring(clamp01((t - p.d) / 1.5), 5.2, 2.6);
              const txx = lerp(p.tx, p.tx2, morph), tyy = lerp(p.ty, p.ty2, morph);
              const jit = t > 1.8 ? 1.2 : 0;
              let x = cx + lerp(p.sx, txx, k) + Math.sin(t * 1.3 + p.tx * 0.05) * jit;
              let y = cy + lerp(p.sy, tyy, k) + Math.cos(t * 1.1 + p.ty * 0.06) * jit;
              if (px || py) {
                const dx = x - pxx, dy = y - pyy;
                const dist = Math.hypot(dx, dy);
                const R = Math.min(w, h) * 0.17;
                if (dist < R && dist > 1e-3) {
                  const f = (1 - dist / R) * 26 * (0.35 + 0.65 * (1 - clamp01(k) * 0.6));
                  x += dx / dist * f;
                  y += dy / dist * f;
                }
              }
              ctx.globalAlpha = 0.16 + 0.84 * clamp01(k);
              ctx.fillStyle = rgba(p.red ? pal.redRgb : pal.inkRgb, 0.78);
              ctx.beginPath();
              ctx.arc(x, y, p.r * (0.45 + 0.55 * clamp01(k)), 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.globalAlpha = 1;
            const sweep = at(t, 0.5, 1.6);
            if (sweep > 0 && sweep < 1) {
              const g = ctx.createLinearGradient(0, 0, w, 0);
              g.addColorStop(0, rgba(pal.redRgb, 0));
              g.addColorStop(0.5, rgba(pal.redRgb, 0.13 * Math.sin(sweep * Math.PI)));
              g.addColorStop(1, rgba(pal.redRgb, 0));
              ctx.fillStyle = g;
              ctx.fillRect(0, cy - h * 0.3, w * sweep, h * 0.6);
            }
          }
        }
      });
    }
    {
      const s = scn("years");
      const cv = canvas(s, "years");
      const axis = s.querySelector('[data-r="axis"]');
      const peakEl = s.querySelector('[data-r="peak"]');
      const perEl = s.querySelector('[data-r="perYear"]');
      const ticks = qsa(s, ".yb-tick");
      const cursor = s.querySelector('[data-r="cursor"]');
      const n = data.years.length;
      const counts = data.years.map((y) => y.films.length);
      const max = Math.max(1, ...counts);
      const peakI = counts.indexOf(max);
      const axisStagger = ticks.map((_, i) => i * 0.07);
      let hotY = -1;
      out.set("years", {
        dur: 3.2,
        move(p) {
          const l = localAt(cv == null ? void 0 : cv.el, p);
          hotY = l ? Math.max(0, Math.min(n - 1, Math.round(l.x * (n - 1)))) : -1;
          if (hotY >= 0) tip(host, `<b>${data.years[hotY].y}</b> 年 · ${counts[hotY]} 部`, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t, pal }) {
          if (cv) {
            cv.fit();
            cv.clear();
            const ctx = cv.ctx, w = cv.w, h = cv.h;
            const padT = h * 0.14, padB = h * 0.2, padL = w * 0.04, padR = w * 0.04;
            const X = (i) => padL + i / Math.max(1, n - 1) * (w - padL - padR);
            const Y = (v) => h - padB - v / max * (h - padT - padB);
            const g = easeInOut(at(t, 1.7));
            const span = Math.max(0, g * (n - 1));
            const hx = X(span), hy = Y(lerp(counts[Math.floor(span)], counts[Math.min(n - 1, Math.ceil(span))], span % 1));
            ctx.beginPath();
            ctx.moveTo(X(0), h - padB);
            for (let i = 0; i <= Math.floor(span); i++) ctx.lineTo(X(i), Y(counts[i]));
            if (span > Math.floor(span)) ctx.lineTo(hx, hy);
            ctx.lineTo(hx, h - padB);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
            grad.addColorStop(0, rgba(pal.inkRgb, 0.16));
            grad.addColorStop(1, rgba(pal.inkRgb, 0));
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            for (let i = 0; i <= Math.floor(span); i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), Y(counts[i]));
            if (span > Math.floor(span)) ctx.lineTo(hx, hy);
            ctx.strokeStyle = rgba(pal.inkRgb, 0.92);
            ctx.lineWidth = 2;
            ctx.lineJoin = "round";
            ctx.stroke();
            if (cursor) {
              const ci = hotY >= 0 ? hotY : g < 1 ? Math.min(n - 1, Math.round(span)) : peakI;
              const show = hotY >= 0 ? 1 : at(t, 0.5, 0.5);
              const label = `${data.years[ci].y} 年 · ${counts[ci]} 部`;
              if (cursor.dataset.label !== label) cursor.dataset.label = label;
              const pct = X(ci) / w * 100;
              S(cursor, `left:${pct.toFixed(2)}%;opacity:${(show * (g < 1 ? 0.85 : 1)).toFixed(3)}`);
            }
            if (g < 1) {
              const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 24);
              halo.addColorStop(0, rgba(pal.redRgb, 0.5));
              halo.addColorStop(1, rgba(pal.redRgb, 0));
              ctx.fillStyle = halo;
              ctx.beginPath();
              ctx.arc(hx, hy, 24, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = pal.red;
              ctx.beginPath();
              ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
              ctx.fill();
            } else {
              const post = at(t, 0.8, 1.7);
              for (let i = 0; i < n; i++) {
                const k = clamp01(post * 1.8 - i * 0.06);
                if (k <= 0) continue;
                const hot = i === hotY;
                ctx.fillStyle = rgba(pal.inkRgb, (hot ? 0.95 : 0.55 * (hotY >= 0 ? 0.5 : 1)) * k);
                ctx.beginPath();
                ctx.arc(X(i), Y(counts[i]), hot ? 4 : 2.4, 0, Math.PI * 2);
                ctx.fill();
                if (i === peakI || hot) {
                  ctx.strokeStyle = rgba(pal.redRgb, (hot ? 0.95 : 0.85) * k);
                  ctx.lineWidth = 1.6;
                  ctx.beginPath();
                  ctx.arc(X(i), Y(counts[i]), hot ? 11 : 6 + 12 * (1 - k), 0, Math.PI * 2);
                  ctx.stroke();
                }
              }
            }
          }
          ticks.forEach((el, i) => {
            const p = at(t, 0.5, 0.45 + axisStagger[i]);
            S(el, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 8).toFixed(1)}px)`);
          });
          S(axis, `opacity:${at(t, 0.6, 0.4).toFixed(3)}`);
          const pp = at(t, 0.5, 1.5);
          S(peakEl, `opacity:${pp.toFixed(3)}`);
          T(peakEl, `${data.years[peakI].y} 年 · ${max} 部`);
          T(perEl, `${(data.watchedCount / Math.max(1, n)).toFixed(1)} 部`);
        }
      });
    }
    {
      const s = scn("days");
      const grid = s.querySelector(".yb-days");
      const dayCount = /* @__PURE__ */ new Map();
      for (const [date, films] of data.days) dayCount.set(date.slice(4), films.length);
      const orderOf = /* @__PURE__ */ new Map();
      [...data.days.keys()].sort().forEach((d, i) => orderOf.set(d.slice(4), i));
      const cells = qsa(s, ".yb-cell").map((el) => {
        var _a2, _b, _c, _d, _e, _f;
        const mi = Number((_b = (_a2 = el.closest(".yb-month")) == null ? void 0 : _a2.dataset.mi) != null ? _b : 0);
        const day = Number((_c = el.dataset.d) != null ? _c : 0);
        const key = `-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        return { el, n: (_d = dayCount.get(key)) != null ? _d : 0, o: (_e = orderOf.get(key)) != null ? _e : -1, tipTxt: (_f = el.dataset.tip) != null ? _f : "" };
      });
      const months = qsa(s, ".yb-month");
      let hotCell = -1;
      out.set("days", {
        dur: 3,
        move(p) {
          const cell = under(p, ".yb-cell[data-tip]");
          hotCell = cell ? cells.findIndex((c) => c.el === cell) : -1;
          if (hotCell >= 0) tip(host, cells[hotCell].tipTxt, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          const hot = hotCell >= 0 && t > 1.2 ? hotCell : -1;
          for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            if (!c.n) {
              S(c.el, "opacity:.3");
              continue;
            }
            const p = at(t, 0.34, 0.25 + c.o * 34e-4);
            const on = i === hot;
            S(c.el, `opacity:${(on ? 1 : (0.28 + 0.72 * p) * (hot >= 0 ? 0.45 : 1)).toFixed(3)};transform:scale(${(on ? 1.5 : 0.55 + 0.45 * easeBack(p)).toFixed(3)})` + (on ? ";z-index:3" : ""));
          }
          S(grid, `--scan:${(t % 4.6 / 4.6).toFixed(4)}`);
        }
      });
    }
    {
      const s = scn("week");
      const spokes = qsa(s, ".yb-spoke");
      const needle = s.querySelector('[data-r="needle"]');
      const hub = s.querySelector(".yb-dial-hub");
      const hubB = s.querySelector(".yb-dial-hub b");
      const hubS = s.querySelector(".yb-dial-hub span");
      const face = s.querySelector('[data-r="face"]');
      const labels = spokes.map((sp) => sp.querySelector(".yb-spoke-lb"));
      const target = vOf(needle, "--a", -90);
      let aim = NaN, hotSpoke = -1, shownDeg = target;
      out.set("week", {
        dur: 3,
        move(p) {
          const l = localAt(face, p);
          if (!l) {
            aim = NaN;
            hotSpoke = -1;
            return;
          }
          aim = Math.atan2(l.x - 0.5, 0.5 - l.y) * 180 / Math.PI;
          const k = Math.round(((aim + 90) % 360 + 360) % 360 / (360 / 7)) % 7;
          hotSpoke = k;
        },
        update({ t }) {
          var _a2, _b;
          spokes.forEach((sp, i) => {
            const p = stagger(t, i, 0.09, 0.8);
            const on = t > 1.8 && i === hotSpoke;
            S(sp.querySelector(".yb-spoke-bar"), `transform:scaleX(${(easeElastic(p) * (on ? 1.06 : 1)).toFixed(4)})`);
            S(sp, `opacity:${(at(t, 0.4, i * 0.09) * (hotSpoke >= 0 && !on && t > 1.8 ? 0.42 : 1)).toFixed(3)}`);
            S(labels[i], `opacity:${at(t, 0.5, 0.5 + i * 0.09).toFixed(3)}`);
          });
          if (needle) {
            const p = at(t, 1.5, 0.7);
            if (p < 1) {
              shownDeg = -90 + (target + 90) * easeBack(p);
              S(needle, `transform:rotate(${shownDeg.toFixed(2)}deg);opacity:${at(t, 0.4, 0.7).toFixed(3)}`);
            } else {
              const idle = target + Math.sin((t - 2.2) * 1.1) * 1.4;
              shownDeg = toward(shownDeg, Number.isFinite(aim) ? aim : idle, 0.2);
              S(needle, `transform:rotate(${shownDeg.toFixed(2)}deg);opacity:1`);
            }
          }
          if (hubB && hubS) {
            if (hotSpoke >= 0) {
              T(hubB, String(data.weekN[hotSpoke]));
              T(hubS, ((_b = (_a2 = labels[hotSpoke]) == null ? void 0 : _a2.textContent) != null ? _b : "").split(/\s+/)[0] || "部");
            } else {
              T(hubB, String(data.watchedCount));
              T(hubS, "部");
            }
          }
          const hp = at(t, 0.6, 0.4);
          S(hub, `opacity:${hp.toFixed(3)};transform:translate(-50%,-50%) scale(${(0.7 + 0.3 * easeBack(hp)).toFixed(3)})`);
        }
      });
    }
    {
      const s = scn("streak");
      const path = s.querySelector('[data-r="ribpath"]');
      const flow = s.querySelector('[data-r="ribflow"]');
      const dots = qsa(s, ".yb-rib-dot");
      const ticks = qsa(s, ".yb-busy-tick");
      const tags = qsa(s, ".yb-btag");
      const tickH = ticks.map((_, i) => 34 + i * 37 % 58);
      let len = 1400;
      try {
        if (path && typeof path.getTotalLength === "function") len = path.getTotalLength() || len;
      } catch (e) {
      }
      if (path) {
        path.style.strokeDasharray = `${len}`;
        path.style.strokeDashoffset = `${len}`;
      }
      let hotDot = -1, hotTick = -1;
      out.set("streak", {
        dur: 3.2,
        move(p) {
          var _a2, _b, _c;
          const dot = under(p, ".yb-rib-dot");
          const tick = under(p, ".yb-busy-tick");
          hotDot = dot ? Number((_a2 = dot.dataset.i) != null ? _a2 : -1) : -1;
          hotTick = tick ? Number((_b = tick.dataset.i) != null ? _b : -1) : -1;
          const el = dot != null ? dot : tick;
          const txt = (_c = el == null ? void 0 : el.dataset.tip) != null ? _c : "";
          if (txt) tip(host, txt, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          const draw = easeInOut(at(t, 1.7, 0.15));
          if (path) path.style.strokeDashoffset = `${(len * (1 - draw)).toFixed(1)}`;
          if (flow) {
            flow.style.strokeDasharray = "12 18";
            const boost = hotDot >= 0 || hotTick >= 0 ? 2.2 : 1;
            flow.style.strokeDashoffset = `${(-(t * 30 * boost % 30)).toFixed(1)}`;
            S(flow, `opacity:${(at(t, 0.5, 1.4) * 0.55).toFixed(3)}`);
          }
          dots.forEach((d, i) => {
            const p = at(t, 0.42, 0.5 + i * 0.085);
            const on = i === hotDot;
            S(d, `opacity:${(on ? 1 : p * (hotDot >= 0 ? 0.4 : 1)).toFixed(3)};transform:scale(${(on ? 2.1 : 0.35 + 0.65 * easeBack(p)).toFixed(3)})`);
          });
          ticks.forEach((el, i) => {
            const p = at(t, 0.34, 1.25 + i * 0.011);
            const on = i === hotTick;
            S(el, `height:${(tickH[i] * easeOut(p) * (on ? 1.35 : 1)).toFixed(1)}%;opacity:${(on ? 1 : p * (hotTick >= 0 ? 0.45 : 1)).toFixed(3)}`);
          });
          tags.forEach((el, i) => {
            const p = stagger(t, i, 0.06, 0.5);
            S(el, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 12).toFixed(1)}px)`);
          });
        }
      });
    }
    {
      const s = scn("length");
      const bins = qsa(s, ".yb-bin");
      const heights = bins.map((b) => vOf(b.querySelector(".yb-bbar"), "--ph"));
      const nums = data.bins.map((b) => b.films.length);
      const total = s.querySelector('[data-r="total"]');
      const side = s.querySelector(".yb-len-side");
      const cvReel = canvas(s, "reel");
      const durs = data.durFilms.map((d) => d.min);
      const durTotal = durs.reduce((a, b) => a + b, 0);
      let flapDone = false;
      let hotBin = -1, reelAt = null, spin = 0;
      out.set("length", {
        dur: 3.4,
        move(p) {
          var _a2;
          const bin = under(p, ".yb-bin");
          hotBin = bin ? Number((_a2 = bin.dataset.i) != null ? _a2 : -1) : -1;
          if (bin == null ? void 0 : bin.dataset.tip) tip(host, bin.dataset.tip, p.cx, p.cy);
          else tip(host, "");
          reelAt = localAt(cvReel == null ? void 0 : cvReel.el, p);
        },
        update({ t, pal }) {
          bins.forEach((b, i) => {
            const p = stagger(t, i, 0.11, 0.9);
            const on = i === hotBin;
            S(b.querySelector(".yb-bbar"), `height:${(heights[i] * easeOut(p)).toFixed(2)}%;transform:scaleY(${on ? 1.04 : 1});transform-origin:bottom center;opacity:${on ? 1 : hotBin >= 0 ? 0.5 : 1}`);
            S(b, `opacity:${at(t, 0.4, i * 0.11).toFixed(3)}`);
            T(b.querySelector(".yb-bn"), String(Math.round(nums[i] * easeOut(p))));
          });
          if (cvReel) {
            cvReel.fit();
            cvReel.clear();
            const ctx = cvReel.ctx, w = cvReel.w, h = cvReel.h;
            const cx = w / 2, cy = h / 2;
            const rMax = Math.min(w, h) * 0.46, rMin = Math.min(w, h) * 0.12;
            const laps = Math.max(1, durTotal / 1440);
            const grow = easeInOut(at(t, 2.2, 0.4));
            const steps = 900;
            const aimSpin = reelAt ? Math.max(-0.34, Math.min(0.34, Math.atan2(reelAt.y - 0.5, reelAt.x - 0.5) + Math.PI / 2)) : 0;
            spin = toward(spin, aimSpin, 0.12);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(spin);
            ctx.translate(-cx, -cy);
            ctx.lineWidth = Math.max(1.4, rMax * 0.028);
            ctx.lineCap = "round";
            let acc = 0, di = 0;
            for (let i2 = 0; i2 < steps; i2++) {
              const u0 = i2 / steps, u1 = (i2 + 1) / steps;
              const a0 = u0 * laps * Math.PI * 2 - Math.PI / 2;
              const a1 = u1 * laps * Math.PI * 2 - Math.PI / 2;
              if (u1 > grow) break;
              const r0 = rMin + (rMax - rMin) * u0, r1 = rMin + (rMax - rMin) * u1;
              const at2 = u0 * durTotal;
              while (di < durs.length - 1 && acc + durs[di] < at2) {
                acc += durs[di];
                di++;
              }
              const hot = di % 2 === 0;
              ctx.strokeStyle = rgba(hot ? pal.inkRgb : pal.redRgb, 0.72);
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
              ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
              ctx.stroke();
            }
            ctx.restore();
            ctx.fillStyle = rgba(pal.inkRgb, 0.16);
            ctx.beginPath();
            ctx.arc(cx, cy, rMin * 0.5, 0, Math.PI * 2);
            ctx.fill();
            if (reelAt && grow > 0.85) {
              const ang = Math.atan2(reelAt.y - 0.5, reelAt.x - 0.5);
              ctx.strokeStyle = rgba(pal.redRgb, 0.5);
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(ang) * rMin * 0.5, cy + Math.sin(ang) * rMin * 0.5);
              ctx.lineTo(cx + Math.cos(ang) * rMax, cy + Math.sin(ang) * rMax);
              ctx.stroke();
              ctx.fillStyle = pal.red;
              ctx.beginPath();
              ctx.arc(cx + Math.cos(ang) * rMax, cy + Math.sin(ang) * rMax, 3.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          if (t < 0.1) flapDone = false;
          if (!flapDone && t > 1.9) {
            setFlap(total, humanDur(data.totalMinutes));
            flapDone = true;
          }
          S(side, `opacity:${at(t, 0.6, 0.3).toFixed(3)}`);
        }
      });
    }
    {
      const s = scn("extremes");
      const line = s.querySelector('[data-r="rline"]');
      const ticks = s.querySelector('[data-r="rticks"]');
      const rread = s.querySelector('[data-r="rread"]');
      const ruler = s.querySelector(".yb-ruler");
      const marks = qsa(s, ".yb-mark");
      const xs = marks.map((m) => vOf(m, "--x", 50));
      const cards = qsa(s, ".yb-xcard");
      const durs2 = data.durFilms.map((d) => d.min).sort((a, b) => a - b);
      const lo = data.shortestMin, hi = data.longestMin;
      let readX = null, readN = 0, readMin = 0, hotEnd = -1;
      out.set("extremes", {
        dur: 2.8,
        move(p) {
          const l = localAt(ruler, p);
          if (!l) {
            readX = null;
            hotEnd = -1;
            return;
          }
          const rx = Math.max(0.06, Math.min(0.94, l.x));
          readX = rx;
          readMin = Math.round(lo + (rx - 0.06) / 0.88 * Math.max(1, hi - lo));
          readN = durs2.filter((m) => Math.abs(m - readMin) <= 12).length;
          hotEnd = xs.findIndex((x) => Math.abs(x - rx * 100) < 3);
          tip(host, `<b>${readMin}</b> 分钟 · 上下 12 分钟里有 ${readN} 部`, p.cx, p.cy);
        },
        update({ t }) {
          const grow = easeInOut(at(t, 1.1, 0.2));
          S(line, `transform:scaleX(${grow.toFixed(4)});transform-origin:center`);
          S(ticks, `transform:scaleX(${grow.toFixed(4)});transform-origin:center;opacity:${at(t, 0.5, 0.5).toFixed(3)}`);
          marks.forEach((m, i) => {
            const p = at(t, 1, 0.8 + i * 0.18);
            const k = easeBack(p);
            const on = i === hotEnd;
            S(m, `left:${(50 + (xs[i] - 50) * k).toFixed(2)}%;opacity:${at(t, 0.4, 0.8 + i * 0.18).toFixed(3)};transform:scale(${((0.72 + 0.28 * easeOut(p)) * (on ? 1.14 : 1)).toFixed(3)})`);
          });
          cards.forEach((c, i) => {
            const p = at(t, 0.8, 1.5 + i * 0.16);
            const on = i === hotEnd && t > 1.6;
            S(c, `opacity:${p.toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 18 - (on ? 10 : 0)).toFixed(1)}px) rotate(${((1 - p) * (i ? 3 : -3)).toFixed(2)}deg)`);
          });
          if (rread) {
            const rx = readX;
            if (rx == null || t < 1.4) S(rread, "opacity:0");
            else S(rread, `left:${(rx * 100).toFixed(2)}%;opacity:${at(t, 0.3, 1.4).toFixed(3)}`);
          }
        }
      });
    }
    {
      const s = scn("genres");
      const rows = qsa(s, ".yb-grow");
      const cvNet = canvas(s, "net");
      const netKeys = data.genres.slice(0, 8).map((g) => g.name);
      const pairs = data.genrePairs.filter((pr) => netKeys.includes(pr.a) && netKeys.includes(pr.b));
      const pairMax = Math.max(1, ...pairs.map((pr) => pr.n));
      const widths = rows.map((r) => {
        var _a2;
        return ((_a2 = r.querySelector(".yb-gbar")) == null ? void 0 : _a2.style.getPropertyValue("--w")) || "0%";
      });
      const nums = data.genres.slice(0, 8).map((g) => g.films.length);
      let focus = -1;
      let nodeAt = [];
      out.set("genres", {
        dur: 3,
        move(p) {
          var _a2;
          const row = under(p, ".yb-grow");
          if (row) {
            focus = Number((_a2 = row.dataset.i) != null ? _a2 : -1);
            return;
          }
          focus = nearest(nodeAt, localAt(cvNet == null ? void 0 : cvNet.el, p), 0.14);
        },
        update({ t, pal }) {
          const hot = t > 2.2 ? focus : -1;
          if (cvNet) {
            cvNet.fit();
            cvNet.clear();
            const ctx = cvNet.ctx, w = cvNet.w, h = cvNet.h;
            const R = Math.min(w, h) * 0.34, cx = w / 2, cy = h / 2;
            const pos = netKeys.map((_, i) => {
              const a = -Math.PI / 2 + i / netKeys.length * Math.PI * 2;
              return [cx + Math.cos(a) * R, cy + Math.sin(a) * R];
            });
            nodeAt = pos.map(([x, y]) => ({ x: x / Math.max(1, w), y: y / Math.max(1, h) }));
            pairs.forEach((pr, i) => {
              const a = netKeys.indexOf(pr.a), b = netKeys.indexOf(pr.b);
              const draw = easeInOut(at(t, 0.7, 0.5 + i * 0.06));
              if (draw <= 0) return;
              const touch = hot >= 0 && (a === hot || b === hot);
              const [x1, y1] = pos[a], [x2, y2] = pos[b];
              const mx = lerp(x1, x2, draw), my = lerp(y1, y2, draw);
              const wgt = pr.n / pairMax;
              ctx.strokeStyle = touch ? rgba(pal.redRgb, 0.82) : rgba(wgt > 0.6 ? pal.redRgb : pal.inkRgb, (0.1 + 0.32 * wgt) * (hot >= 0 ? 0.28 : 1));
              ctx.lineWidth = (0.7 + 2.6 * wgt) * (touch ? 1.8 : 1);
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(mx, my);
              ctx.stroke();
            });
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            netKeys.forEach((k, i) => {
              const p = at(t, 0.5, 0.5 + i * 0.06);
              if (p <= 0) return;
              const [x, y] = pos[i];
              const on = i === hot;
              const rad = (3 + 5 * (nums[i] / Math.max(1, nums[0]))) * (on ? 1.7 : 1);
              ctx.globalAlpha = p * (hot >= 0 && !on ? 0.42 : 1);
              ctx.fillStyle = on ? pal.red : pal.paper;
              ctx.beginPath();
              ctx.arc(x, y, rad, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = on ? pal.red : rgba(pal.inkRgb, 0.5);
              ctx.lineWidth = on ? 2 : 1.2;
              ctx.stroke();
              ctx.fillStyle = on ? pal.red : rgba(pal.inkRgb, 0.82);
              ctx.font = `${Math.round(Math.max(11, Math.min(w, h) * 0.045) * (on ? 1.06 : 1))}px "Segoe UI", system-ui, sans-serif`;
              ctx.fillText(k, x, y + rad + 10);
              ctx.globalAlpha = 1;
            });
          }
          rows.forEach((row, i) => {
            const p = stagger(t, i, 0.09, 0.8);
            const on = i === hot;
            S(row.querySelector(".yb-gbar"), `width:${widths[i]};transform:scaleX(${(easeOut(p) * (on ? 1.04 : 1)).toFixed(4)});transform-origin:left center;opacity:${on ? 1 : hot >= 0 ? 0.5 : 1}`);
            const scan = i === 0 && t > 1.3 ? (t - 1.3) % 3.4 / 3.4 : 0;
            S(row, `opacity:${at(t, 0.4, i * 0.09).toFixed(3)};transform:translateX(${((1 - easeOut(at(t, 0.6, i * 0.09))) * -16).toFixed(1)}px);--scan:${scan.toFixed(4)}`);
            T(row.querySelector(".yb-gn"), String(Math.round(nums[i] * easeOut(p))));
          });
        }
      });
    }
    {
      const s = scn("flow");
      const cv = canvas(s, "flow");
      const legend = qsa(s, ".yb-lg");
      const keys = data.genres.slice(0, 5).map((g) => g.name);
      const years = data.years.map((y) => y.y);
      const series = keys.map((k) => data.years.map((y) => y.films.filter((f) => {
        var _a2;
        return String((_a2 = f.genre) != null ? _a2 : "").split(/\s*\/\s*/).includes(k);
      }).length));
      const maxTotal = Math.max(1, ...years.map((_, i) => series.reduce((s2, arr) => s2 + arr[i], 0)));
      const triplets = (pal) => [pal.goldRgb, pal.redRgb, pal.blueRgb, pal.jadeRgb, pal.inkRgb];
      let atFlow = null;
      out.set("flow", {
        dur: 3.4,
        move(p) {
          atFlow = localAt(cv == null ? void 0 : cv.el, p);
        },
        update({ t, pal }) {
          if (cv) {
            cv.fit();
            cv.clear();
            const ctx = cv.ctx, w = cv.w, h = cv.h;
            const padT = h * 0.12, padB = h * 0.12;
            const X = (i) => i / Math.max(1, years.length - 1) * w;
            const g = easeInOut(at(t, 2));
            const wake = (i) => {
              if (!atFlow) return 0;
              const dx = X(i) / Math.max(1, w) - atFlow.x;
              return Math.exp(-(dx * dx) / 0.01) * (atFlow.y - 0.5) * h * 0.2;
            };
            const wob = (i, j) => t > 2 ? Math.sin(t * 0.7 + j * 1.3 + i * 0.5) * h * 8e-3 : 0;
            const at3 = triplets(pal);
            ctx.strokeStyle = rgba(pal.inkRgb, 0.2);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h - padB);
            ctx.lineTo(w * g, h - padB);
            ctx.stroke();
            const yOf = (i, j, which) => {
              const acc = series[j][i] + (which === "bot" ? 0 : 0);
              const below = series.slice(0, j).reduce((s2, arr) => s2 + arr[i], 0);
              const up = (below + acc) / maxTotal;
              const dn = below / maxTotal;
              return h - padB - (which === "top" ? up : dn) * (h - padT - padB) + wob(i, j) + wake(i);
            };
            for (let j = 0; j < series.length; j++) {
              ctx.beginPath();
              for (let i = 0; i < years.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, X(i), yOf(i, j, "top"));
              for (let i = years.length - 1; i >= 0; i--) ctx.lineTo(X(i), yOf(i, j, "bot"));
              ctx.closePath();
              ctx.fillStyle = rgba(at3[j], 0.48);
              ctx.fill();
              ctx.strokeStyle = rgba(at3[j], 0.9);
              ctx.lineWidth = 1.2;
              ctx.stroke();
            }
            ctx.strokeStyle = rgba(pal.inkRgb, 0.12);
            for (let i = 0; i < years.length; i++) {
              if (X(i) > w * g) break;
              ctx.beginPath();
              ctx.moveTo(X(i), padT * 0.55);
              ctx.lineTo(X(i), h - padB);
              ctx.stroke();
            }
            if (g < 1) {
              ctx.fillStyle = rgba(pal.redRgb, 0.85);
              ctx.beginPath();
              ctx.arc(w * g, padT, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          legend.forEach((el, i) => {
            const p = at(t, 0.5, 1.9 + i * 0.1);
            S(el, `opacity:${p.toFixed(3)};transform:translateX(${((1 - easeOut(p)) * -10).toFixed(1)}px)`);
          });
        }
      });
    }
    {
      const s = scn("regions");
      const stamps = qsa(s, ".yb-stamp");
      const rings = stamps.map((el) => el.querySelector(".yb-stamp-ring"));
      let hotStamp = -1;
      out.set("regions", {
        dur: 3.2,
        move(p) {
          var _a2;
          const el = under(p, ".yb-stamp");
          hotStamp = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
          if (el == null ? void 0 : el.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          stamps.forEach((el, i) => {
            const p = stagger(t, i, 0.13, 0.55);
            const k = easeBack(p);
            const rot = vOf(el, "--rot", 0);
            const on = i === hotStamp && t > 1.4;
            S(el, `opacity:${(Math.min(1, p * 1.7) * (hotStamp >= 0 && !on ? 0.4 : 1)).toFixed(3)};transform:translate(-50%,-50%) rotate(${(rot * (0.4 + 0.6 * easeOut(p)) * (on ? 0.92 : 1)).toFixed(2)}deg) scale(${((1.34 - 0.34 * k) * (on ? 1.14 : 1)).toFixed(3)})` + (on ? ";z-index:3;filter:brightness(1.1)" : ""));
            const rp = at(t, 0.7, 0.1 + i * 0.13);
            S(rings[i], `opacity:${((1 - rp) * 0.8).toFixed(3)};transform:scale(${(0.5 + rp * 1.5).toFixed(3)})`);
          });
        }
      });
    }
    {
      const s = scn("eras");
      const cv = canvas(s, "eras");
      const dense = s.querySelector('[data-r="denseY"]');
      const side = s.querySelector(".yb-era-side");
      const ry = data.releaseYears;
      const wy = data.years.map((y2) => ({ y: y2.y, n: y2.films.length }));
      const maxN = Math.max(1, ...ry.map((r) => r.n));
      const maxW = Math.max(1, ...wy.map((r) => r.n));
      const denseY = ry.reduce((b, r) => r.n > b.n ? r : b, (_a = ry[0]) != null ? _a : { y: 0, n: 0 });
      T(dense, `${denseY.y} 年 · ${denseY.n} 部`);
      let atEra = null;
      out.set("eras", {
        dur: 3.2,
        move(p) {
          atEra = localAt(cv == null ? void 0 : cv.el, p);
        },
        update({ t, pal }) {
          var _a2, _b, _c, _d;
          if (cv) {
            cv.fit();
            cv.clear();
            const ctx = cv.ctx, w = cv.w, h = cv.h;
            const mid = h * 0.34, mid2 = h * 0.7, amp = h * 0.26, amp2 = h * 0.2;
            const g = easeInOut(at(t, 1.9));
            const X = (i) => i / Math.max(1, ry.length - 1) * w;
            const wake = (u, k) => {
              if (!atEra) return 0;
              const dx = u - atEra.x;
              return Math.exp(-(dx * dx) / 0.012) * (atEra.y - 0.5) * h * 0.22 * k;
            };
            const Y = (n, i) => mid - n / maxN * amp + wake(X(i) / Math.max(1, w), 1);
            const X2 = (i) => i / Math.max(1, wy.length - 1) * w * 0.82 + w * 0.18;
            const Y2 = (n, i) => mid2 - n / maxW * amp2 + wake(X2(i) / Math.max(1, w), 0.5);
            const upto = Math.max(1, Math.floor(g * (ry.length - 1)));
            ctx.beginPath();
            ctx.moveTo(X2(0), Y2((_b = (_a2 = wy[0]) == null ? void 0 : _a2.n) != null ? _b : 0, 0));
            for (let i = 0; i < wy.length; i++) {
              const px2 = X2(i), py2 = Y2(wy[i].n, i);
              const nx2 = X2(Math.min(wy.length - 1, i + 1)), ny2 = Y2(wy[Math.min(wy.length - 1, i + 1)].n, Math.min(wy.length - 1, i + 1));
              ctx.bezierCurveTo((px2 + nx2) / 2, py2, (px2 + nx2) / 2, ny2, nx2, ny2);
            }
            const tip2 = X2(Math.max(0, Math.floor(g * (wy.length - 1))));
            ctx.lineTo(tip2, mid2 + amp2 * 0.6);
            ctx.lineTo(X2(0), mid2 + amp2 * 0.6);
            ctx.closePath();
            const grad2 = ctx.createLinearGradient(0, mid2 - amp2, 0, mid2 + amp2 * 0.6);
            grad2.addColorStop(0, rgba(pal.blueRgb, 0.3));
            grad2.addColorStop(1, rgba(pal.blueRgb, 0));
            ctx.fillStyle = grad2;
            ctx.fill();
            ctx.beginPath();
            for (let i = 0; i < wy.length; i++) {
              const px2 = X2(i), py2 = Y2(wy[i].n, i);
              const nx2 = X2(Math.min(wy.length - 1, i + 1)), ny2 = Y2(wy[Math.min(wy.length - 1, i + 1)].n, Math.min(wy.length - 1, i + 1));
              if (i === 0) ctx.moveTo(px2, py2);
              ctx.bezierCurveTo((px2 + nx2) / 2, py2, (px2 + nx2) / 2, ny2, nx2, ny2);
            }
            ctx.strokeStyle = rgba(pal.blueRgb, 0.9);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, Y((_d = (_c = ry[0]) == null ? void 0 : _c.n) != null ? _d : 0, 0));
            for (let i = 0; i <= upto; i++) {
              const px = X(i), py = Y(ry[i].n, i);
              const nx = X(Math.min(ry.length - 1, i + 1)), ny = Y(ry[Math.min(ry.length - 1, i + 1)].n, Math.min(ry.length - 1, i + 1));
              ctx.bezierCurveTo((px + nx) / 2, py, (px + nx) / 2, ny, nx, ny);
            }
            const tipX = X(upto);
            ctx.lineTo(tipX, mid + amp * 0.5);
            ctx.lineTo(0, mid + amp * 0.5);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, mid - amp, 0, mid + amp * 0.5);
            grad.addColorStop(0, rgba(pal.blueRgb, 0.26));
            grad.addColorStop(1, rgba(pal.blueRgb, 0));
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.beginPath();
            for (let i = 0; i <= upto; i++) {
              const px = X(i), py = Y(ry[i].n, i);
              const nx = X(Math.min(ry.length - 1, i + 1)), ny = Y(ry[Math.min(ry.length - 1, i + 1)].n, Math.min(ry.length - 1, i + 1));
              if (i === 0) ctx.moveTo(px, py);
              ctx.bezierCurveTo((px + nx) / 2, py, (px + nx) / 2, ny, nx, ny);
            }
            ctx.strokeStyle = rgba(pal.blueRgb, 0.92);
            ctx.lineWidth = 2;
            ctx.stroke();
            if (t > 1.7) {
              for (let i = 0; i < 64; i++) {
                const u = (i * 37 % ry.length / ry.length + (t - 1.7) * 0.05) % 1;
                const idx = Math.min(ry.length - 1, Math.round(u * (ry.length - 1)));
                const py = mid - ry[idx].n / maxN * amp * (1 + 0.05 * Math.sin(t * 1.4 + i)) + wake(u, 1);
                ctx.fillStyle = rgba(pal.blueRgb, 0.38);
                ctx.beginPath();
                ctx.arc(u * w, py - 3, 1.3, 0, Math.PI * 2);
                ctx.fill();
              }
            } else {
              const hx = w * g;
              ctx.fillStyle = rgba(pal.redRgb, 0.9);
              ctx.beginPath();
              ctx.arc(hx, mid, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          S(side, `opacity:${at(t, 0.6, 0.6).toFixed(3)}`);
        }
      });
    }
    {
      const s = scn("age");
      const bands = qsa(s, ".yb-aband");
      const dots = qsa(s, ".yb-adot");
      const rule = s.querySelector(".yb-ageax-rule");
      const ticks = qsa(s, ".yb-atick");
      const side = s.querySelector(".yb-ageax-side");
      const order = dots.map((_, i) => i).sort((a, b) => b - a);
      const rank = /* @__PURE__ */ new Map();
      order.forEach((idx, k) => rank.set(idx, k));
      let hotDot = -1;
      out.set("age", {
        dur: 3.4,
        move(p) {
          var _a2;
          const dot = under(p, ".yb-adot");
          hotDot = dot ? Number((_a2 = dot.dataset.i) != null ? _a2 : -1) : -1;
          if (dot == null ? void 0 : dot.dataset.tip) tip(host, dot.dataset.tip, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          bands.forEach((b, i) => S(b, `opacity:${at(t, 0.5, 0.1 + i * 0.1).toFixed(3)}`));
          qsa(s, ".yb-aleg").forEach((el, i) => S(el, `opacity:${at(t, 0.4, 0.4 + i * 0.1).toFixed(3)}`));
          S(rule, `transform:scaleX(${easeInOut(at(t, 0.8, 0.1)).toFixed(4)});transform-origin:left center`);
          ticks.forEach((el, i) => S(el, `opacity:${at(t, 0.4, 0.5 + i * 0.08).toFixed(3)}`));
          const hover = t > 1.6 ? hotDot : -1;
          dots.forEach((d, i) => {
            var _a2;
            const k = (_a2 = rank.get(i)) != null ? _a2 : i;
            const p = at(t, 0.5, 0.35 + k * 0.017);
            const on = i === hover;
            S(d, `opacity:${(on ? 1 : p * (hover >= 0 ? 0.45 : 1)).toFixed(3)};transform:translateY(${((1 - easeOut(p)) * 9 - (on ? 6 : 0)).toFixed(1)}px) scale(${(on ? 1.9 : 0.7 + 0.3 * easeOut(p)).toFixed(3)})` + (on ? ";z-index:3" : ""));
          });
          S(side, `opacity:${at(t, 0.6, 0.6).toFixed(3)}`);
        }
      });
    }
    {
      const s = scn("myrate");
      const plot = s.querySelector('[data-r="plot"]');
      const dots = qsa(s, ".yb-sdot2");
      const rows = qsa(s, ".yb-erow");
      const smean = s.querySelector('[data-r="smean"]');
      const flap = s.querySelector('[data-r="flap"]');
      const widths = rows.map((r) => r.style.getPropertyValue("--w"));
      let flapDone = false;
      let hotDot = -1, hotScore = -1;
      out.set("myrate", {
        dur: 3.6,
        move(p) {
          var _a2, _b, _c;
          const dot = under(p, ".yb-sdot2");
          hotDot = dot ? Number((_a2 = dot.dataset.i) != null ? _a2 : -1) : -1;
          const rowEl = under(p, ".yb-erow");
          hotScore = rowEl ? Number((_b = rowEl.dataset.i) != null ? _b : -1) : -1;
          const dotTip = dot == null ? void 0 : dot.dataset.tip;
          if (dotTip) tip(host, dotTip, p.cx, p.cy);
          else if (rowEl) tip(host, `<b>${hotScore}</b> 分 · ${(_c = data.myHist[hotScore]) != null ? _c : 0} 部`, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t, py }) {
          const hover = t > 2.2 ? hotDot : -1;
          dots.forEach((d, i) => {
            const p2 = at(t, 0.5, 0.3 + i * 42e-4);
            const k = easeOut(p2);
            const on = i === hover;
            S(d, `opacity:${(p2 * 0.95 * (on ? 1 : hover >= 0 ? 0.35 : 1)).toFixed(3)};transform:translateY(${((1 - k) * -12 - (on ? 5 : 0)).toFixed(1)}px) scale(${((0.6 + 0.4 * easeBack(p2)) * (on ? 2.1 : 1)).toFixed(3)})` + (on ? ";z-index:3" : ""));
          });
          rows.forEach((r, i) => {
            var _a2;
            const p2 = at(t, 0.5, 0.8 + i * 0.05);
            const on = hotScore === Number((_a2 = r.dataset.i) != null ? _a2 : -1);
            S(r.querySelector('[data-r="ebar"]'), `width:${widths[i]};transform:scaleX(${(easeOut(p2) * (on ? 1.05 : 1)).toFixed(4)});transform-origin:left center`);
            S(r, `opacity:${(at(t, 0.3, 0.8 + i * 0.05) * (hotScore >= 0 && !on ? 0.45 : 1)).toFixed(3)}`);
          });
          const lp = easeInOut(at(t, 0.8, 1.9));
          const y = vOf(smean, "--y", 50);
          S(smean, `bottom:calc(2.4em + ${(y * lp).toFixed(2)}% * (100% - 2.4em) / 100%);opacity:${at(t, 0.4, 1.9).toFixed(3)}`);
          if (plot) S(plot, `transform:perspective(1200px) rotateY(${(py * 1.6).toFixed(2)}deg)`);
          if (t < 0.1) flapDone = false;
          if (!flapDone && t > 2.4) {
            setFlap(flap, data.avgMine.toFixed(2));
            flapDone = true;
          }
        }
      });
    }
    {
      const s = scn("mirror");
      const ups = qsa(s, ".yb-mcol.up"), downs = qsa(s, ".yb-mcol.down");
      const upPh = ups.map((c) => c.style.getPropertyValue("--ph"));
      const dnPh = downs.map((c) => c.style.getPropertyValue("--ph"));
      const means = qsa(s, ".yb-mir-mean");
      const mx = means.map((m) => vOf(m, "--x", 50));
      const dbN = data.dbHist.slice(), myN = data.myHist.slice();
      const flapDb = s.querySelector('[data-r="flapDb"]');
      const flapMine = s.querySelector('[data-r="flapMine"]');
      let flapDone = false;
      let hotScore = -1;
      out.set("mirror", {
        dur: 3,
        move(p) {
          var _a2, _b, _c;
          const col = under(p, ".yb-mcol");
          hotScore = col ? Number((_a2 = col.dataset.i) != null ? _a2 : -1) : -1;
          if (hotScore >= 0) tip(host, `<b>${hotScore}</b> 分 · 我的 ${(_b = myN[hotScore]) != null ? _b : 0} 部 · 豆瓣 ${(_c = dbN[hotScore]) != null ? _c : 0} 部`, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          const hot = t > 2.2 ? hotScore : -1;
          const draw = (list, phs, nums, origin) => list.forEach((c, i) => {
            if (!phs[i]) return;
            const p = stagger(t, i, 0.06, 0.8);
            const on = i === hot;
            S(c.querySelector(".yb-mbar"), `height:${phs[i]};transform:scaleY(${(easeOut(p) * (on ? 1.06 : 1)).toFixed(4)});transform-origin:${origin};opacity:${on ? 1 : hot >= 0 ? 0.45 : 1}`);
            S(c, `opacity:${at(t, 0.3, i * 0.06).toFixed(3)}`);
            const v = Math.round(nums[i] * easeOut(p));
            T(c.querySelector(".yb-mn"), v ? String(v) : "");
          });
          draw(ups, upPh, dbN, "bottom center");
          draw(downs, dnPh, myN, "top center");
          means.forEach((m, i) => {
            const p = easeInOut(at(t, 0.9, 1.2 + i * 0.15));
            S(m, `left:${(mx[i] * p).toFixed(2)}%;opacity:${at(t, 0.4, 1.2 + i * 0.15).toFixed(3)}`);
          });
          const gp = at(t, 0.6, 2);
          S(s.querySelector(".yb-mir-gap"), `opacity:${gp.toFixed(3)};transform:scale(${(0.9 + 0.1 * easeBack(gp)).toFixed(3)})`);
          if (t < 0.1) flapDone = false;
          if (!flapDone && t > 2) {
            setFlap(flapDb, data.avgDb.toFixed(2));
            setFlap(flapMine, data.avgMine.toFixed(2));
            flapDone = true;
          }
        }
      });
    }
    {
      const s = scn("balance");
      const beam = s.querySelector('[data-r="beam"]');
      const arm = s.querySelector('[data-r="arm"]');
      const pans = qsa(s, ".yb-bal-pan");
      const rows = qsa(s, ".yb-drow");
      const lists = s.querySelector(".yb-bal-lists");
      const tilt = vOf(beam, "--tilt", 0);
      let hoverPan = -1, pressPan = -1, shown = 0;
      const panOf = (p) => {
        const el = under(p, ".yb-bal-pan");
        return el ? el.classList.contains("l") ? 0 : 1 : -1;
      };
      out.set("balance", {
        dur: 3,
        move(p) {
          hoverPan = panOf(p);
        },
        down(p) {
          pressPan = panOf(p);
        },
        up() {
          pressPan = -1;
        },
        update({ t }) {
          const p = at(t, 2);
          const extra = pressPan === 0 ? 0.55 : pressPan === 1 ? -0.55 : hoverPan === 0 ? 0.16 : hoverPan === 1 ? -0.16 : 0;
          shown = p < 1 ? tilt * spring(p, 3.4, 2.2) : toward(shown, tilt + extra, pressPan >= 0 ? 0.05 : 0.12) + Math.sin(t * 1.1) * 0.012;
          const deg = -shown * 9;
          S(arm, `transform:rotate(${deg.toFixed(3)}deg)`);
          pans.forEach((pan, i) => {
            const base = i === 0 ? "left:17%;right:auto" : "left:auto;right:17%";
            const on = i === pressPan || pressPan < 0 && i === hoverPan;
            S(pan, `${base};opacity:${at(t, 0.5, 0.5 + i * 0.15).toFixed(3)}` + (on ? ";filter:brightness(1.12);cursor:grab" : ""));
          });
          rows.forEach((r, i) => {
            const q = stagger(t, i, 0.07, 0.6);
            S(r, `opacity:${q.toFixed(3)};transform:translateX(${((1 - easeOut(q)) * 14).toFixed(1)}px)`);
          });
          S(lists, `opacity:${at(t, 0.5, 1).toFixed(3)}`);
        }
      });
    }
    {
      const s = scn("podium");
      const slots = qsa(s, ".yb-pod-slot");
      const cards = qsa(s, ".yb-pod");
      const rings = cards.map((c) => c.querySelector(".yb-pod-ring"));
      const beam = s.querySelector('[data-r="beam"]');
      let hotPod = -1;
      out.set("podium", {
        dur: 3.6,
        move(p) {
          var _a2;
          const el = under(p, ".yb-pod");
          hotPod = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
        },
        update({ t, px, py }) {
          slots.forEach((slot, i) => {
            var _a2;
            const rank = Number((_a2 = slot.dataset.i) != null ? _a2 : 0);
            const delay = 0.15 + rank * 0.28;
            const rise = easeOut(at(t, 0.75, delay));
            S(slot, `opacity:${at(t, 0.4, delay).toFixed(3)}`);
            const block = slot.querySelector(".yb-pod-block");
            S(block, `transform:translateY(${((1 - rise) * 42).toFixed(1)}px);opacity:${(0.2 + 0.8 * rise).toFixed(3)}`);
            const card = cards[i];
            const cp = at(t, 0.95, delay + 0.45);
            const ck = easeOut(cp);
            const ringP = at(t, 1.2, delay + 0.8);
            S(rings[i], `opacity:${((1 - ringP) * 0.9).toFixed(3)};transform:scale(${(0.4 + ringP * 1.4).toFixed(3)})`);
            if (t > 2.2) {
              const shine = ((t - 2.2 + i * 0.7) % 4.2 / 4.2).toFixed(4);
              const float = Math.sin((t - 2.2) * 1.2 + i) * 1.8;
              const on = i === hotPod;
              S(card, `opacity:1;transform:translate(${(-px * 5 + (on ? 0 : 0)).toFixed(2)}px,${(float - py * 3.4 - (on ? 10 : 0)).toFixed(2)}px) scale(${on ? 1.045 : 1});--shine:${shine}` + (on ? ";z-index:3" : ""));
            } else {
              S(card, `opacity:${Math.min(1, cp * 1.9).toFixed(3)};transform:translate3d(0,${((1 - ck) * 30).toFixed(1)}px,${((1 - ck) * -170).toFixed(0)}px) scale(${(1.3 - 0.3 * ck).toFixed(3)})`);
            }
          });
          if (beam) S(beam, `opacity:${(at(t, 0.8, 2.1) * (t > 2.6 ? 0.72 + 0.28 * Math.sin((t - 2.6) * 1.4) : 1)).toFixed(3)}` + (t > 2.2 ? `;transform:translateX(${(px * 26).toFixed(1)}px)` : ""));
        }
      });
    }
    {
      const s = scn("ninewall");
      const grid = s.querySelector('[data-r="grid"]');
      const tiles = qsa(s, ".yb-tile");
      const cols = 9;
      let hotTile = -1;
      out.set("ninewall", {
        dur: 3.4,
        move(p) {
          var _a2;
          const el = under(p, ".yb-tile");
          hotTile = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
        },
        update({ t, px, py }) {
          tiles.forEach((el, i) => {
            const r = Math.floor(i / cols), c = i % cols;
            const p = at(t, 0.62, 0.25 + (r + c) * 0.055);
            const k = easeOut(p);
            const on = i === hotTile;
            S(el, `opacity:${k.toFixed(3)};transform:perspective(700px) rotateY(${((1 - k) * 68).toFixed(2)}deg) translateY(${((1 - k) * 14 - (on ? 8 : 0)).toFixed(1)}px) scale(${((0.86 + 0.14 * k) * (on ? 1.06 : 1)).toFixed(3)})` + (on ? ";z-index:3;filter:brightness(1.06)" : ""));
          });
          S(grid, `--sweep:${(t > 1.7 ? (t - 1.7) % 5 / 5 : -1).toFixed(4)}` + (t > 2.2 ? `;transform:perspective(1400px) rotateX(${(-py * 2.4).toFixed(2)}deg) rotateY(${(px * 2.8).toFixed(2)}deg)` : ""));
        }
      });
    }
    {
      const s = scn("directors");
      const rows = qsa(s, ".yb-prow");
      const shotsRow = rows.map((r) => qsa(r, ".yb-pshots i"));
      let hotRow = -1;
      out.set("directors", {
        dur: 2.9,
        move(p) {
          var _a2;
          const el = under(p, ".yb-prow");
          hotRow = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
        },
        update({ t, px }) {
          const hot = t > 1.8 ? hotRow : -1;
          rows.forEach((row, i) => {
            const p = stagger(t, i, 0.11, 0.7);
            const on = i === hot;
            S(row, `opacity:${(at(t, 0.4, i * 0.11) * (hot >= 0 && !on ? 0.4 : 1)).toFixed(3)};transform:translateX(${((1 - easeOut(p)) * 34 - (on ? 12 : 0) - px * 3).toFixed(1)}px)`);
            S(row.querySelector(".yb-pbar"), `transform:scaleX(${(easeOut(p) * (on ? 1.03 : 1)).toFixed(4)});transform-origin:left center`);
            shotsRow[i].forEach((shot, j) => {
              const q = stagger(t, j, 0.06, 0.5);
              const spread = on ? j * 5 : 0;
              S(shot, `opacity:${q.toFixed(3)};transform:translate(${spread.toFixed(1)}px,${((1 - easeOut(q)) * 8 - (on ? Math.abs(j - 1.5) * 1.2 : 0)).toFixed(1)}px)` + (on ? ` rotate(${(j - 1.5) * 2.2}deg) scale(1.06)` : ""));
            });
          });
        }
      });
    }
    {
      const s = scn("actors");
      const cards = qsa(s, ".yb-acard");
      const arc = s.querySelector('[data-r="arc"]');
      const mid = (cards.length - 1) / 2;
      let hotCard = -1;
      out.set("actors", {
        dur: 3,
        move(p) {
          var _a2;
          const el = under(p, ".yb-acard");
          hotCard = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
        },
        update({ t, px }) {
          const tw = t > 1.8 ? px : 0;
          S(arc, `transform:translateX(${(tw * 10).toFixed(1)}px) rotate(${(tw * 1.5).toFixed(2)}deg)`);
          cards.forEach((c, i) => {
            const p = at(t, 0.95, i * 0.13);
            const k = easeOut(p);
            const breath = t > 1.4 ? Math.sin((t - 1.4) * 1.1 + i * 0.7) * 0.45 : 0;
            const d = hotCard < 0 ? 0 : i - hotCard;
            const stand = d === 0 ? -0.9 : Math.abs(d) === 1 ? 0.35 : 0;
            S(c, `opacity:${Math.min(1, p * 1.5).toFixed(3)};--dy:${((1 - k) * 16 + stand).toFixed(2)}em;--br:${breath.toFixed(2)}em` + (p >= 1 ? "" : `;transform:scale(${(0.9 + 0.1 * k).toFixed(3)})`) + (d === 0 ? ";z-index:3" : ""));
          });
        }
      });
    }
    {
      const s = scn("series");
      const groups = qsa(s, ".yb-ser");
      const stacks = groups.map((g) => qsa(g, ".yb-ser-c"));
      let hotSer = -1;
      out.set("series", {
        dur: 3,
        move(p) {
          var _a2;
          const el = under(p, ".yb-ser");
          hotSer = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
        },
        update({ t }) {
          const hot = t > 1.8 ? hotSer : -1;
          groups.forEach((g, gi) => {
            const gp = at(t, 0.6, gi * 0.18);
            const on = gi === hot;
            S(g, `opacity:${(gp * (hot >= 0 && !on ? 0.42 : 1)).toFixed(3)};transform:translateY(${((1 - easeOut(gp)) * 14 - (on ? 6 : 0)).toFixed(1)}px)`);
            stacks[gi].forEach((c, j) => {
              const p = at(t, 0.8, 0.25 + gi * 0.18 + j * 0.07);
              const k = easeBack(p);
              const fan = on ? 1.55 : 1;
              const ang = j * 7.5 * k * fan + (t > 1.8 ? Math.sin((t - 1.8) * 1.1 + j * 0.5 + gi) * 0.7 : 0);
              S(c, `opacity:${clamp01(p).toFixed(3)};transform:translateX(${(j * 16 * k * fan).toFixed(1)}px) translateY(${(-j * 3 * k * fan).toFixed(1)}px) rotate(${ang.toFixed(2)}deg) scale(${on ? 1.03 : 1})`);
            });
          });
        }
      });
    }
    {
      const s = scn("binge");
      const rows = qsa(s, ".yb-eprow");
      let hotEp = -1;
      out.set("binge", {
        dur: 3.2,
        move(p) {
          var _a2;
          const el = under(p, ".yb-eprow");
          hotEp = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
          const e = hotEp >= 0 ? data.episodes[hotEp] : null;
          if (e) tip(host, `${esc0(e.base)} · ${e.ep} 集`, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          const hot = t > 1.8 ? hotEp : -1;
          rows.forEach((row, i) => {
            const e = data.episodes[i];
            if (!e) return;
            const p = stagger(t, i, 0.14, 1.1);
            const on = i === hot;
            S(row.querySelector(".yb-eptape"), `transform:scaleX(${(easeInOut(p) * (on ? 1.02 : 1)).toFixed(4)});transform-origin:left center`);
            S(row, `opacity:${(at(t, 0.4, i * 0.14) * (hot >= 0 && !on ? 0.42 : 1)).toFixed(3)}`);
            S(row.querySelector(".yb-eptick"), `opacity:${on ? 1 : 0.5};transform:scale(${on ? 2.2 : 1})`);
            T(row.querySelector(".yb-epn b"), String(Math.round(e.ep * easeOut(p))));
          });
        }
      });
    }
    {
      const s = scn("notes");
      const notes = qsa(s, ".yb-note");
      const paras = notes.map((n) => n.querySelector('[data-r="ntx"]'));
      const KEY = ["喜欢", "好看", "感动", "治愈", "孤独", "时间", "自由", "生活", "我们", "自己", "温柔", "漫长"];
      const re = new RegExp(`(${KEY.join("|")})`, "g");
      const full = paras.map((p) => {
        var _a2;
        return (_a2 = p == null ? void 0 : p.dataset.full) != null ? _a2 : "";
      });
      const chars = full.map((f) => [...f]);
      let hotNote = -1, notePtr = null;
      out.set("notes", {
        dur: 4.4,
        move(p) {
          var _a2;
          const el = under(p, ".yb-note");
          hotNote = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
          notePtr = p;
        },
        update({ t }) {
          const hot = t > 1.6 ? hotNote : -1;
          notes.forEach((n, i) => {
            const cardP = at(t, 0.5, i * 0.5);
            const on = i === hot;
            const l = on && notePtr ? localAt(n, notePtr) : null;
            const ry = l ? (l.x - 0.5) * 9 : 0, rx = l ? (0.5 - l.y) * 7 : 0;
            S(n, `opacity:${(cardP * (hot >= 0 && !on ? 0.5 : 1)).toFixed(3)};transform:translateY(${((1 - easeOut(cardP)) * 16 - (on ? 6 : 0)).toFixed(1)}px)` + (on ? ` perspective(900px) rotateY(${ry.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg)` : "") + (on ? ";z-index:3" : ""));
            const p = paras[i];
            if (!p) return;
            const cps = chars[i];
            const typed = Math.floor(clamp01((t - (i * 0.5 + 0.3)) / (cps.length * 0.026)) * cps.length);
            const done = typed >= cps.length;
            const html = esc0(cps.slice(0, typed).join("")).replace(re, "<mark>$1</mark>") + (done ? '<i class="yb-caret done"></i>' : '<i class="yb-caret"></i>');
            if (p.dataset.shown !== html) {
              p.dataset.shown = html;
              p.innerHTML = html;
            }
          });
        }
      });
    }
    {
      const s = scn("quotes");
      const lanes = qsa(s, ".yb-lane");
      const quotes = lanes.map((l) => qsa(l, ".yb-quote"));
      const laneOff = [0, 0, 0];
      const SPAN = 420;
      let lastT = 0, hotLane = -1, hotQuote = null;
      out.set("quotes", {
        dur: 2,
        move(p) {
          var _a2, _b;
          const el = under(p, ".yb-quote");
          hotQuote = el;
          hotLane = el ? Number((_b = (_a2 = el.closest(".yb-lane")) == null ? void 0 : _a2.dataset.i) != null ? _b : -1) : -1;
          if (el == null ? void 0 : el.dataset.tip) tip(host, el.dataset.tip, p.cx, p.cy);
          else tip(host, "");
        },
        update({ t }) {
          const dt = Math.max(0, Math.min(0.12, t - lastT));
          lastT = t;
          if (t < 0.1) {
            laneOff[0] = laneOff[1] = laneOff[2] = 0;
          }
          lanes.forEach((lane, i) => {
            const dir = i % 2 === 0 ? -1 : 1;
            const speed = (14 + i * 8) * (i === hotLane ? 0.12 : 1);
            laneOff[i] = (laneOff[i] + dt * speed * dir) % SPAN;
            S(lane, `transform:translateY(${laneOff[i].toFixed(1)}px)`);
            quotes[i].forEach((qt, j) => {
              const on = qt === hotQuote;
              S(qt, `opacity:${(at(t, 0.5, 0.1 + j * 0.09) * (on ? 1 : hotLane >= 0 && hotLane === i ? 0.42 : 0.94)).toFixed(3)}` + (on ? ";transform:scale(1.04)" : ";transform:none"));
            });
          });
        }
      });
    }
    {
      const s = scn("matrix");
      const cv = canvas(s, "matrix");
      const m = data.matrix;
      const colLabels = qsa(s, ".yb-mx-cols span");
      const rowLabels = qsa(s, ".yb-mx-rows span");
      let hotCell = null;
      out.set("matrix", {
        dur: 3.4,
        move(p) {
          const l = localAt(cv == null ? void 0 : cv.el, p);
          if (!l) {
            hotCell = null;
            tip(host, "");
            return;
          }
          const c = Math.min(m.cols.length - 1, Math.max(0, Math.floor(l.x * m.cols.length)));
          const r = Math.min(m.rows.length - 1, Math.max(0, Math.floor(l.y * m.rows.length)));
          hotCell = { r, c };
          tip(host, `${esc0(m.rows[r])} × ${esc0(m.cols[c])} · ${m.n[r][c]} 部`, p.cx, p.cy);
        },
        update({ t, pal }) {
          if (cv) {
            cv.fit();
            cv.clear();
            const ctx = cv.ctx, w = cv.w, h = cv.h;
            const cols = m.cols.length, rows = m.rows.length;
            const cw = w / cols, ch = h / rows;
            const sweep = t > 1.8 && !hotCell ? (t - 1.8) % 5.5 / 5.5 : -1;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `${Math.round(Math.min(cw, ch) * 0.34)}px "Segoe UI", system-ui, sans-serif`;
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const n = m.n[r][c];
                const p = at(t, 0.5, 0.2 + (r + c) * 0.07);
                if (p <= 0) continue;
                const k = easeOut(p);
                const x = c * cw, y = r * ch;
                const ratio = n / m.max;
                const inCross = sweep >= 0 && (Math.abs(sweep * cols - (c + 0.5)) < 0.6 || Math.abs(sweep * rows - (r + 0.5)) < 0.6);
                const onCell = !!hotCell && hotCell.r === r && hotCell.c === c;
                const inPtr = !!hotCell && (hotCell.r === r || hotCell.c === c);
                ctx.globalAlpha = k;
                ctx.fillStyle = onCell ? rgba(pal.redRgb, 0.35 + 0.45 * ratio) : inPtr ? rgba(pal.blueRgb, 0.18 + 0.34 * ratio) : inCross ? rgba(pal.blueRgb, 0.18 + 0.34 * ratio) : rgba(n === 0 ? pal.inkRgb : pal.redRgb, n === 0 ? 0.05 : 0.1 + 0.62 * ratio);
                ctx.fillRect(x + 1.5, y + 1.5, cw - 3, ch - 3);
                if (onCell) {
                  ctx.strokeStyle = rgba(pal.redRgb, 0.95);
                  ctx.lineWidth = 2;
                  ctx.strokeRect(x + 2.5, y + 2.5, cw - 5, ch - 5);
                }
                ctx.fillStyle = ratio > 0.55 || onCell ? rgba(pal.onStrong, 0.95) : rgba(pal.inkRgb, 0.8);
                ctx.fillText(String(Math.round(n * k)), x + cw / 2, y + ch / 2);
              }
            }
            ctx.globalAlpha = 1;
          }
          colLabels.forEach((el, i) => S(el, `opacity:${(hotCell && hotCell.c === i ? 1 : at(t, 0.5, 0.2 + i * 0.05) * (hotCell ? 0.45 : 1)).toFixed(3)}`));
          rowLabels.forEach((el, i) => S(el, `opacity:${(hotCell && hotCell.r === i ? 1 : at(t, 0.5, 0.2 + i * 0.05) * (hotCell ? 0.45 : 1)).toFixed(3)}`));
        }
      });
    }
    {
      const s = scn("wall");
      const tiles = qsa(s, ".yb-wtile");
      const wall = s.querySelector('[data-r="wall"]');
      const cols = 12, rowsN = 5;
      let hotTile = -1, wallAt = null;
      out.set("wall", {
        dur: 3.6,
        move(p) {
          var _a2;
          const el = under(p, ".yb-wtile");
          hotTile = el ? Number((_a2 = el.dataset.i) != null ? _a2 : -1) : -1;
          wallAt = localAt(wall, p);
        },
        update({ t, px, py }) {
          const tw = t > 1.9 ? 1 : 0;
          S(wall, tw ? `transform:perspective(1400px) rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 3.4).toFixed(2)}deg)` : "");
          tiles.forEach((el, i) => {
            const r = Math.floor(i / cols), c = i % cols;
            const p = at(t, 0.6, 0.15 + (r + c) * 0.045);
            const k = easeOut(p);
            const on = i === hotTile;
            const drift = t > 1.7 ? Math.sin((t - 1.7) * 0.8 + r * 0.6 + c * 0.3) * 2.6 : 0;
            let pull = 0;
            if (wallAt && tw) {
              const dx = (c + 0.5) / cols - wallAt.x, dy = (r + 0.5) / rowsN - wallAt.y;
              const d2 = dx * dx + dy * dy;
              pull = Math.exp(-d2 / 0.012) * 9;
            }
            S(el, `opacity:${(k * (hotTile >= 0 && !on ? 0.55 : 1)).toFixed(3)};transform:perspective(900px) translateY(${((1 - k) * 22 + drift - pull - (on ? 10 : 0)).toFixed(1)}px) rotateX(${((1 - k) * 42).toFixed(2)}deg) scale(${((0.9 + 0.1 * k) * (on ? 1.07 : 1)).toFixed(3)})` + (on ? ";z-index:3" : ""));
          });
        }
      });
    }
    {
      const s = scn("colophon");
      const items = ["flapTotal", "flapWatched", "flapDur", "flapEp"].map((k) => s.querySelector(`[data-r="${k}"]`));
      const groups = items.map((el) => {
        var _a2;
        return (_a2 = el == null ? void 0 : el.closest(".yb-kv")) != null ? _a2 : null;
      });
      const flapVals = [String(data.total), String(data.watchedCount), humanDurShort(data.totalMinutes), String(data.epTotal)];
      let flapDone = false;
      let hotG = -1;
      out.set("colophon", {
        dur: 3,
        move(p) {
          const el = under(p, ".yb-colo-grid .yb-kv");
          hotG = el ? groups.findIndex((g) => g === el) : -1;
        },
        update({ t, px, py }) {
          if (t < 0.1) flapDone = false;
          if (!flapDone && t > 0.5) {
            items.forEach((el, i) => setTimeout(() => setFlap(el, flapVals[i]), i * 110));
            flapDone = true;
          }
          groups.forEach((g, i) => {
            var _a2;
            if (!g) return;
            const on = i === hotG && t > 1.4;
            S(g, `transform:translateY(${on ? -4 : 0}px) scale(${on ? 1.05 : 1});opacity:${hotG >= 0 && !on ? 0.55 : 1}`);
            (_a2 = items[i]) == null ? void 0 : _a2.querySelectorAll(".yb-flap").forEach((cell) => {
              S(cell, on ? `transform:perspective(500px) rotateX(${(py * -9).toFixed(2)}deg) rotateY(${(px * 9).toFixed(2)}deg)` : "transform:none");
            });
          });
        }
      });
    }
    return out;
  }

  // src/cinema/motion.ts
  var MOTION = { fast: 160, move: 200, base: 280, impulse: 740 };
  var STAGGER = 30;
  var EASE = {
    out: "cubic-bezier(.22,.82,.3,1)",
    move: "cubic-bezier(.34,.06,.16,1)"
  };

  // src/cinema/yearbook/engine.ts
  var GESTURE_GAP = 340;
  function bindYearbook(root, data) {
    const sc = root.querySelector(".bz-yb-scroll");
    const film = root.querySelector(".bz-yb-film");
    const handle = { stop: () => void 0, goTo: () => void 0 };
    if (!sc || !film) return handle;
    const scEl = sc;
    const filmEl = film;
    const scenes = qsa(film, ".bz-yb-scn");
    if (!scenes.length) return handle;
    const perfs = buildPerfs(film, data, root);
    const names = scenes.map((s) => {
      var _a;
      return (_a = s.dataset.name) != null ? _a : "";
    });
    const rails = qsa(film, ".yb-rail-t");
    const barI = film.querySelector('[data-r="barI"]');
    const barN = film.querySelector('[data-r="barN"]');
    const barLine = film.querySelector('[data-r="barLine"]');
    const pb = film.querySelector('[data-r="pb"]');
    let pal = palette(root);
    let cur = -1;
    let t0 = performance.now();
    let raf = 0;
    let fallback = 0;
    let dead = false;
    let autoplay = false;
    let autoAt = 0;
    let navTarget = -1;
    let navUntil = 0;
    const settled = /* @__PURE__ */ new Set();
    const shutter = film.querySelector('[data-r="shutter"]');
    let cutTimers = [];
    let px = 0, py = 0, pin = 0;
    const unit = () => Math.max(1, scEl.clientHeight);
    const indexAt = () => clamp(Math.round(scEl.scrollTop / unit()), 0, scenes.length - 1);
    function hud(i, p) {
      var _a;
      if (rails.length) {
        rails.forEach((r, k) => {
          if (k === i) r.setAttribute("data-on", "1");
          else r.removeAttribute("data-on");
        });
      }
      filmEl.dataset.cur = String(i + 1).padStart(2, "0");
      if (barI) barI.textContent = String(i + 1).padStart(2, "0");
      if (barN) barN.textContent = (_a = names[i]) != null ? _a : "";
      if (barLine) barLine.style.transform = `scaleX(${p.toFixed(4)})`;
    }
    function activate(i, replay = true, force = false) {
      var _a, _b;
      if (dead || i === cur && !force) return;
      if (cur >= 0 && cur !== i) {
        const prev = perfs.get((_a = scenes[cur].dataset.id) != null ? _a : "");
        if (prev && !settled.has(cur)) {
          prev.update({ t: prev.dur, pal, px: px * pin, py: py * pin });
          settled.add(cur);
        }
        tip(root, "");
      }
      cur = i;
      settled.delete(i);
      const perf = perfs.get((_b = scenes[i].dataset.id) != null ? _b : "");
      if (replay) t0 = performance.now();
      if (perf) perf.update({ t: replay ? 0 : perf.dur, pal, px: px * pin, py: py * pin });
      const sc2 = scenes[i];
      sc2.classList.remove("is-in");
      void sc2.offsetWidth;
      sc2.classList.add("is-in");
      hud(i, 0);
      autoAt = performance.now();
    }
    const clearCut = () => {
      for (const id of cutTimers) clearTimeout(id);
      cutTimers = [];
    };
    const cutTo = (target, replay) => {
      navTarget = target;
      scEl.scrollTop = target * unit();
      activate(target, replay, true);
    };
    function goTo(i, opts) {
      var _a, _b;
      const target = clamp(i, 0, scenes.length - 1);
      navTarget = target;
      navUntil = performance.now() + 900;
      if (target === cur || (opts == null ? void 0 : opts.cut) === false) {
        activate(target, (_a = opts == null ? void 0 : opts.replay) != null ? _a : true, true);
        return;
      }
      if (!shutter) {
        cutTo(target, (_b = opts == null ? void 0 : opts.replay) != null ? _b : true);
        return;
      }
      clearCut();
      shutter.classList.remove("is-open");
      shutter.classList.add("is-close");
      cutTimers.push(setTimeout(() => {
        var _a2;
        cutTo(target, (_a2 = opts == null ? void 0 : opts.replay) != null ? _a2 : true);
        shutter.classList.remove("is-close");
        shutter.classList.add("is-open");
        cutTimers.push(setTimeout(() => shutter.classList.remove("is-open"), MOTION.move + 60));
      }, MOTION.fast));
    }
    handle.goTo = goTo;
    const goRel = (d) => goTo(cur < 0 ? 0 : cur + d, { cut: true });
    function syncFromScroll() {
      if (dead) return;
      const i = indexAt();
      if (performance.now() < navUntil && i !== navTarget) return;
      if (i !== cur) activate(i, true);
    }
    let lastWheel = 0;
    function onWheel(e) {
      if (dead) return;
      const now = performance.now();
      const fresh = now - lastWheel > GESTURE_GAP;
      lastWheel = now;
      if (!fresh) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      setAuto(false);
      goRel(e.deltaY > 0 ? 1 : -1);
    }
    function onKey(e) {
      if (dead || !root.isConnected) return;
      const k = e.key;
      if (k === "ArrowDown" || k === "PageDown") {
        e.preventDefault();
        setAuto(false);
        goRel(1);
      } else if (k === "ArrowUp" || k === "PageUp") {
        e.preventDefault();
        setAuto(false);
        goRel(-1);
      } else if (k === "Home") {
        e.preventDefault();
        goTo(0, { cut: true });
      } else if (k === "End") {
        e.preventDefault();
        goTo(scenes.length - 1, { cut: true });
      }
    }
    const rafFn = typeof requestAnimationFrame === "function" ? (cb) => requestAnimationFrame(cb) : (cb) => setTimeout(cb, 16);
    const rafStop = (id) => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
      else clearTimeout(id);
    };
    function pump2() {
      if (dead) return;
      clearTimeout(fallback);
      tick(performance.now());
      raf = rafFn(() => {
        clearTimeout(fallback);
        pump2();
      });
      fallback = setTimeout(() => {
        rafStop(raf);
        pump2();
      }, 220);
    }
    function tick(now) {
      var _a;
      if (dead || cur < 0) return;
      const perf = perfs.get((_a = scenes[cur].dataset.id) != null ? _a : "");
      if (!perf) return;
      const t = (now - t0) / 1e3;
      perf.update({ t, pal, px: px * pin, py: py * pin });
      hud(cur, clamp(t / perf.dur, 0, 1));
      if (autoplay && now - autoAt > (perf.dur + 1.4) * 1e3) {
        if (cur >= scenes.length - 1) setAuto(false);
        else goRel(1);
      }
    }
    function setAuto(on) {
      if (autoplay === on) return;
      autoplay = on;
      if (pb) {
        pb.textContent = on ? "暂停" : "自动";
        pb.classList.toggle("is-on", on);
      }
      autoAt = performance.now();
    }
    const onOvlClick = (e) => {
      var _a;
      const t = e.target;
      if (t.closest('[data-r="pb"]')) {
        setAuto(!autoplay);
        return;
      }
      const rail = t.closest(".yb-rail-t");
      if (rail) {
        setAuto(false);
        goTo(Number((_a = rail.dataset.i) != null ? _a : 0), { cut: true });
      }
    };
    const onPointer = (e) => {
      var _a, _b;
      const r = root.getBoundingClientRect();
      px = (e.clientX - r.left) / Math.max(1, r.width) * 2 - 1;
      py = (e.clientY - r.top) / Math.max(1, r.height) * 2 - 1;
      pin = 1;
      (_b = (_a = curPerf()) == null ? void 0 : _a.move) == null ? void 0 : _b.call(_a, { cx: e.clientX, cy: e.clientY, px, py });
    };
    const onPtrDown = (e) => {
      var _a, _b;
      const r = root.getBoundingClientRect();
      (_b = (_a = curPerf()) == null ? void 0 : _a.down) == null ? void 0 : _b.call(_a, { cx: e.clientX, cy: e.clientY, px: (e.clientX - r.left) / Math.max(1, r.width) * 2 - 1, py: (e.clientY - r.top) / Math.max(1, r.height) * 2 - 1 });
    };
    const onPtrUp = () => {
      var _a, _b;
      (_b = (_a = curPerf()) == null ? void 0 : _a.up) == null ? void 0 : _b.call(_a);
    };
    const onPtrLeave = () => {
      pin = 0;
      tip(root, "");
    };
    const curPerf = () => {
      var _a;
      return cur >= 0 ? perfs.get((_a = scenes[cur].dataset.id) != null ? _a : "") : void 0;
    };
    const mo = new MutationObserver(() => {
      pal = palette(root);
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      if (dead || cur < 0) return;
      const want = cur * unit();
      if (Math.abs(scEl.scrollTop - want) > 1) scEl.scrollTop = want;
    }) : null;
    ro == null ? void 0 : ro.observe(scEl);
    root.addEventListener("pointermove", onPointer);
    root.addEventListener("pointerdown", onPtrDown);
    root.addEventListener("pointerup", onPtrUp);
    root.addEventListener("pointerleave", onPtrLeave);
    root.addEventListener("pointercancel", onPtrUp);
    scEl.addEventListener("wheel", onWheel, { passive: false });
    scEl.addEventListener("scroll", syncFromScroll, { passive: true });
    filmEl.addEventListener("click", onOvlClick);
    document.addEventListener("keydown", onKey);
    activate(0, true);
    pump2();
    handle.stop = () => {
      dead = true;
      rafStop(raf);
      clearTimeout(fallback);
      mo.disconnect();
      ro == null ? void 0 : ro.disconnect();
      clearCut();
      root.removeEventListener("pointermove", onPointer);
      root.removeEventListener("pointerdown", onPtrDown);
      root.removeEventListener("pointerup", onPtrUp);
      root.removeEventListener("pointerleave", onPtrLeave);
      root.removeEventListener("pointercancel", onPtrUp);
      tip(root, "");
      scEl.removeEventListener("wheel", onWheel);
      scEl.removeEventListener("scroll", syncFromScroll);
      filmEl.removeEventListener("click", onOvlClick);
      document.removeEventListener("keydown", onKey);
    };
    return handle;
  }

  // src/core/jev.ts
  var JEV_DEFAULT_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
  var JEV_DEFAULT_MODEL = "jev-1.13.0";
  var JEV_DEFAULT_TIMEOUT_MS = 1e4;
  function resolveJevConfig(override) {
    var _a, _b, _c, _d;
    const s = tryGetSettings();
    const pick = (key, fallback) => {
      const v = s == null ? void 0 : s[key];
      return v === void 0 || v === null || v === "" ? fallback : v;
    };
    const timeoutRaw = Number(pick("jevTimeoutMs", JEV_DEFAULT_TIMEOUT_MS));
    return {
      endpoint: String((_a = override == null ? void 0 : override.endpoint) != null ? _a : pick("jevEndpoint", JEV_DEFAULT_ENDPOINT)),
      apiKey: String((_b = override == null ? void 0 : override.apiKey) != null ? _b : pick("jevApiKey", "")),
      model: String((_c = override == null ? void 0 : override.model) != null ? _c : pick("jevModel", JEV_DEFAULT_MODEL)),
      timeoutMs: (_d = override == null ? void 0 : override.timeoutMs) != null ? _d : Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : JEV_DEFAULT_TIMEOUT_MS
    };
  }
  function isJevConfigured() {
    const s = tryGetSettings();
    if ((s == null ? void 0 : s.jevEnabled) !== true) return false;
    const cfg = resolveJevConfig();
    return !!cfg.endpoint && !!cfg.apiKey;
  }
  function abortError2() {
    const e = new Error("Jev 请求已取消");
    e.name = "AbortError";
    return e;
  }
  function timeoutError2(ms) {
    const e = new Error(`Jev 请求超时（${Math.round(ms / 1e3)} 秒无响应）`);
    e.name = "TimeoutError";
    return e;
  }
  function buildJevBody(state, questions, model) {
    return { model, state, questions };
  }
  function parseJevResponse(text, status) {
    var _a;
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Jev 响应不是合法 JSON（HTTP ${status}）`);
    }
    const answers = data == null ? void 0 : data.answers;
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      const detail = (data == null ? void 0 : data.detail) ? `: ${JSON.stringify(data.detail)}` : "";
      throw new Error(`Jev 响应缺少 answers 字段（HTTP ${status}）${detail}`);
    }
    return {
      model: String((_a = data.model) != null ? _a : ""),
      answers,
      usage: data.usage
    };
  }
  async function askJev(state, questions, opts = {}) {
    var _a, _b;
    const keys = Object.keys(questions || {});
    if (!keys.length) return { model: "", answers: {} };
    const cfg = resolveJevConfig(opts.config);
    const signal = opts.signal;
    if (signal == null ? void 0 : signal.aborted) throw abortError2();
    if (!cfg.endpoint) throw new Error("未配置 Jev 端点");
    if (!cfg.apiKey) throw new Error("未配置 Jev 密钥（插件设置 → AI → Jev 决策通道）");
    const body = buildJevBody(state, questions, cfg.model);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`
    };
    const resp = await new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      const onAbort = () => settle(() => reject(abortError2()));
      function settle(fn) {
        if (settled) return;
        settled = true;
        if (timer !== null) clearTimeout(timer);
        signal == null ? void 0 : signal.removeEventListener("abort", onAbort);
        fn();
      }
      timer = setTimeout(() => settle(() => reject(timeoutError2(cfg.timeoutMs))), cfg.timeoutMs);
      signal == null ? void 0 : signal.addEventListener("abort", onAbort);
      requestUrl({
        url: cfg.endpoint,
        method: "POST",
        headers,
        body: JSON.stringify(body),
        throw: false
      }).then(
        (r) => settle(() => resolve(r)),
        (e) => settle(() => reject(e))
      );
    });
    if (signal == null ? void 0 : signal.aborted) throw abortError2();
    const status = Number((_a = resp == null ? void 0 : resp.status) != null ? _a : 0);
    const text = String((_b = resp == null ? void 0 : resp.text) != null ? _b : "");
    if (status < 200 || status >= 300) {
      const brief = text.length > 300 ? `${text.slice(0, 300)}…` : text;
      throw new Error(`Jev API ${status}: ${brief || "无响应正文"}`);
    }
    return parseJevResponse(text, status);
  }

  // src/core/jev-fallback.ts
  function abortError3() {
    const e = new Error("判定请求已取消");
    e.name = "AbortError";
    return e;
  }
  async function judgeOrFallback(plan) {
    const signal = plan.signal;
    if (signal == null ? void 0 : signal.aborted) throw abortError3();
    if (!isJevConfigured()) return plan.fallback();
    try {
      const { state, questions } = plan.request();
      const result = await askJev(state, questions, { signal, config: plan.config });
      return plan.parse(result.answers);
    } catch (e) {
      if (signal == null ? void 0 : signal.aborted) throw e;
      console.debug("[jev] 判定通道不可用，回落 LLM：", e instanceof Error ? e.message : e);
      return plan.fallback();
    }
  }

  // src/cinema/type-decide.ts
  var TYPE_SENTINEL = "以上都不是";
  var CONFIDENCE_FLOOR = 0.5;
  var EXCLUDED_FROM_DECIDE = ["公开课"];
  var Q_KEY = "type";
  var DECIDE_HINTS = "判断线索：是否剧集区分「电影」与其他剧种；制片国家/地区决定是国产剧、美剧、日剧、韩剧、英剧还是德剧；豆瓣类型里含「动画」时按地区归入日漫、国漫或美漫；含「纪录片」时归「纪录片」（此时不按剧集判）。";
  var JEV_INSTRUCTIONS = `根据下面这部影视的豆瓣信息，从候选清单里选出最贴切的分类标签。候选值的说明是该标签所属的组。${DECIDE_HINTS}若都不贴切，请选「${TYPE_SENTINEL}」。`;
  function buildTypeCriteria() {
    var _a;
    const criteria = {};
    for (const tag of ALL_TAGS) {
      if (EXCLUDED_FROM_DECIDE.includes(tag)) continue;
      criteria[tag] = (_a = getGroupForTag(tag)) != null ? _a : "其他";
    }
    criteria[TYPE_SENTINEL] = "以上候选都不匹配";
    return criteria;
  }
  function buildTypeState(info) {
    const lines = [];
    if (info.title) lines.push(`片名：${info.title}`);
    if (info.isTv !== null && info.isTv !== void 0) lines.push(`是否剧集：${info.isTv ? "是" : "否"}`);
    if (info.area) lines.push(`制片国家/地区：${info.area}`);
    if (info.genre) lines.push(`豆瓣类型：${info.genre}`);
    if (info.year) lines.push(`年份：${info.year}`);
    return lines.join("\n");
  }
  function judgeTypeChoice(answer, criteria) {
    const choice = answer.choice;
    if (!(choice in criteria)) return null;
    if (choice === TYPE_SENTINEL) return null;
    if (answer.confidence < CONFIDENCE_FLOOR) return null;
    return choice;
  }
  function buildTypeLlmPrompt(info, criteria) {
    const menu = Object.keys(criteria).map((tag) => tag === TYPE_SENTINEL ? tag : `${tag}（${criteria[tag]}）`).join("、");
    return [
      "你是影视分类助手。根据下面的豆瓣信息，从候选分类里选出最贴切的一个。",
      `候选分类：${menu}`,
      DECIDE_HINTS,
      `若都不贴切，选「${TYPE_SENTINEL}」。`,
      '只输出 JSON 对象：{"type":"候选分类之一"}',
      "",
      buildTypeState(info)
    ].join("\n");
  }
  function parseTypeLlmOutput(raw, criteria) {
    var _a;
    let text = String(raw || "").trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (e) {
      return null;
    }
    const tag = String((_a = obj == null ? void 0 : obj.type) != null ? _a : "").trim();
    if (!tag || tag === TYPE_SENTINEL || !(tag in criteria)) return null;
    return tag;
  }
  async function decideTypeByLlm(info, criteria) {
    const raw = await createAI().json(buildTypeLlmPrompt(info, criteria));
    return parseTypeLlmOutput(raw, criteria);
  }
  async function decideCinemaType(info, opts) {
    const criteria = buildTypeCriteria();
    return judgeOrFallback({
      signal: opts == null ? void 0 : opts.signal,
      config: opts == null ? void 0 : opts.config,
      request: () => {
        const question = { type: "choice", instructions: JEV_INSTRUCTIONS, criteria };
        return { state: buildTypeState(info), questions: { [Q_KEY]: question } };
      },
      parse: (answers) => {
        const answer = answers[Q_KEY];
        if (!answer || answer.type !== "choice") throw new Error("Jev 未返回有效的 choice 答案");
        return judgeTypeChoice(answer, criteria);
      },
      fallback: () => decideTypeByLlm(info, criteria)
    });
  }

  // src/cinema/seasons.ts
  var MERGE_GROUPS = ["剧集", "动漫"];
  var CN_NUM = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  function seasonNumber(raw) {
    if (/^\d+$/.test(raw)) return Number(raw);
    if (raw === "十") return 10;
    const m = raw.match(/^(.)?十(.)?$/);
    if (m) {
      const tens = m[1] ? CN_NUM[m[1]] : 1;
      const ones = m[2] ? CN_NUM[m[2]] : 0;
      return tens == null || ones == null ? null : tens * 10 + ones;
    }
    return raw.length === 1 && CN_NUM[raw] != null ? CN_NUM[raw] : null;
  }
  var SEASON_RE = /(?:第\s*([0-9]+|[零一二三四五六七八九十]+)\s*季)|(?:season\s*([0-9]+))/i;
  function parseSeasonName(name) {
    var _a, _b;
    const m = SEASON_RE.exec(name);
    if (!m) return null;
    const season = seasonNumber((_b = (_a = m[1]) != null ? _a : m[2]) != null ? _b : "");
    if (season == null || season <= 0) return null;
    const base = (name.slice(0, m.index) + name.slice(m.index + m[0].length)).replace(/[\s\-–—·:：]+$/, "").replace(/[\s\-–—·:：]{2,}/g, " ").replace(/\s{2,}/g, " ").trim();
    return base ? { base, season } : null;
  }
  function cmpByRelease(a, b) {
    var _a, _b, _c, _d;
    const ra = (_b = (_a = a.releaseDate) != null ? _a : a.year) != null ? _b : "";
    const rb = (_d = (_c = b.releaseDate) != null ? _c : b.year) != null ? _d : "";
    if (ra === rb) return 0;
    if (!ra) return 1;
    if (!rb) return -1;
    return ra < rb ? -1 : 1;
  }
  function seasonsByRelease(slots) {
    return [...slots].sort((a, b) => cmpByRelease(a.item, b.item) || a.no - b.no);
  }
  var SPECIAL_SEP_RE = /^[\s:：·\-—－]+/;
  function seriesKeyOf(group, base) {
    return `series:${group}:${base}`;
  }
  function isSeriesKey(key) {
    return !!key && key.startsWith("series:");
  }
  function cardFace(e) {
    return e.kind === "series" ? e.face : e.item;
  }
  function cardGroup(e) {
    return e.kind === "series" ? e.group : e.item.group;
  }
  function watchTs(it) {
    if (!it.watchDate) return 0;
    const t = new Date(it.watchDate).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  function pickFace(slots) {
    let best = slots[0];
    for (const s of slots) {
      const t = watchTs(s.item);
      const bt = watchTs(best.item);
      if (t > bt || t === bt && s.no > best.no) best = s;
    }
    return best.item;
  }
  function latestRated(items) {
    const rated = items.filter((it) => it.rating != null && it.rating > 0);
    if (!rated.length) return null;
    return rated.reduce((best, it) => watchTs(it) >= watchTs(best) ? it : best, rated[0]).rating;
  }
  function specialHostOf(name, cards) {
    let hit = null;
    for (const c of cards) {
      if (!c.name || name.length <= c.name.length) continue;
      if (hit && c.name.length <= hit.name.length) continue;
      if (!name.startsWith(c.name)) continue;
      const rest = name.slice(c.name.length);
      const sep = SPECIAL_SEP_RE.exec(rest);
      if (!sep || !rest.slice(sep[0].length).trim()) continue;
      hit = c;
    }
    return hit;
  }
  function mergeSeasonCards(list, merge) {
    if (!merge) return list.map((item) => ({ kind: "single", item }));
    const grouped = /* @__PURE__ */ new Map();
    for (const it of list) {
      if (!MERGE_GROUPS.includes(it.group)) continue;
      const parsed = parseSeasonName(it.name);
      if (!parsed) continue;
      const key = seriesKeyOf(it.group, parsed.base);
      const slots = grouped.get(key);
      if (slots) {
        if (!slots.some((s) => s.no === parsed.season)) slots.push({ no: parsed.season, item: it });
      } else {
        grouped.set(key, [{ no: parsed.season, item: it }]);
      }
    }
    const merged = /* @__PURE__ */ new Map();
    for (const [key, slots] of grouped) {
      if (slots.length < 2) continue;
      slots.sort((a, b) => a.no - b.no);
      merged.set(key, {
        kind: "series",
        key,
        name: parseSeasonName(slots[0].item.name).base,
        group: slots[0].item.group,
        seasons: slots,
        specials: [],
        face: pickFace(slots),
        rating: null
        // 统一在特别篇并入后算（口径含特别篇）
      });
    }
    const cards = [...merged.values()];
    const absorbed = /* @__PURE__ */ new Set();
    for (const it of list) {
      if (MERGE_GROUPS.includes(it.group) && parseSeasonName(it.name)) continue;
      const host = specialHostOf(it.name, cards);
      if (!host) continue;
      host.specials.push(it);
      absorbed.add(it);
    }
    const allItemsOf = (c) => c.seasons.map((s) => s.item).concat(c.specials);
    for (const c of cards) c.rating = latestRated(allItemsOf(c));
    const out = [];
    const emitted = /* @__PURE__ */ new Set();
    for (const it of list) {
      if (absorbed.has(it)) continue;
      let key = null;
      if (MERGE_GROUPS.includes(it.group)) {
        const parsed = parseSeasonName(it.name);
        key = parsed ? seriesKeyOf(it.group, parsed.base) : null;
      }
      const card = key ? merged.get(key) : void 0;
      if (card) {
        if (!emitted.has(card.key)) {
          out.push(card);
          emitted.add(card.key);
        }
        continue;
      }
      out.push({ kind: "single", item: it });
    }
    return out;
  }

  // src/cinema/shared.ts
  var ICON = {
    ai: "bot",
    stat: "bar-chart-3",
    close: "x",
    search: "search",
    add: "plus",
    edit: "pencil",
    del: "trash-2",
    confirm: "alert-circle",
    back: "chevron-left",
    grid: "layout-grid",
    eye: "eye",
    play: "play",
    globe: "globe"
  };
  function typeColor(group) {
    var _a;
    return group === "其他" ? "#8a8578" : (_a = TYPE_COLORS[group]) != null ? _a : "#8a8578";
  }
  var ST_COLOR = { 想看: "#98917f", 在看: "#d97c1d", 已看: "#4a9a5c" };
  function statusNum(status) {
    if (typeof status === "number") return status;
    return status === "想看" ? STATUS_WANT : status === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
  }
  function statusColor(status) {
    const v = statusNum(status);
    return v === STATUS_WANT ? ST_COLOR["想看"] : v === STATUS_WATCHING ? ST_COLOR["在看"] : ST_COLOR["已看"];
  }
  function statusText(status) {
    const v = statusNum(status);
    return v === STATUS_WANT ? "想看" : v === STATUS_WATCHING ? "在看" : "已看";
  }
  function doubanSearchUrl(name) {
    return "https://movie.douban.com/search?q=" + encodeURIComponent(name);
  }
  function itemKey(it) {
    var _a, _b;
    return (_b = (_a = it.file) == null ? void 0 : _a.path) != null ? _b : `new:${it.name}`;
  }
  function itemByKey(items, key) {
    if (!key) return void 0;
    return items.find((it) => itemKey(it) === key);
  }
  function posterInner(item, url) {
    var _a, _b;
    const ph = `<div class="ph">${esc((_a = item.name[0]) != null ? _a : "")}</div>`;
    if (!url) return ph;
    return `<img loading="lazy" src="${esc(url)}" onerror="this.outerHTML='<div class=\\'ph\\'>${esc((_b = item.name[0]) != null ? _b : "")}</div>'">`;
  }
  function seasonSegState(item) {
    const st = statusNum(item.status);
    return st === STATUS_WATCHED ? "watched" : st === STATUS_WATCHING ? "watching" : "empty";
  }
  function seriesStatus(seasons, extra = []) {
    const states = seasons.map((s) => statusNum(s.item.status)).concat(extra.map((it) => statusNum(it.status)));
    if (states.includes(STATUS_WATCHING)) return STATUS_WATCHING;
    if (states.includes(STATUS_WANT)) return STATUS_WANT;
    return STATUS_WATCHED;
  }
  function cardStatus(e) {
    return e.kind === "series" ? seriesStatus(e.seasons, e.specials) : statusNum(e.item.status);
  }
  function seasonDotsHtml(seasons) {
    const n = { watched: 0, watching: 0, empty: 0 };
    const dots = seasons.map((s) => {
      const st = seasonSegState(s.item);
      n[st]++;
      return `<i class="${st}" data-cinema-season-key="${esc(itemKey(s.item))}"></i>`;
    }).join("");
    const label = `各季进度：共 ${seasons.length} 季，已看 ${n.watched}、在看 ${n.watching}、未看 ${n.empty}`;
    return `<span class="season-dots" role="img" aria-label="${esc(label)}">${dots}</span>`;
  }
  function facePiecesHtml(it, posterUrl2, opts = {}) {
    var _a;
    const r = opts.rating !== void 0 ? opts.rating : it.rating;
    return {
      poster: posterInner(it, posterUrl2),
      name: esc((_a = opts.name) != null ? _a : it.name),
      meta: esc([it.year || "", it.director || ""].filter(Boolean).join(" · ")),
      stars: r && r > 0 ? starsHtml(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span class="star-none">未评分</span>'
    };
  }
  function starsHtml(rating) {
    const lit = starsLit(rating);
    return Array.from({ length: 5 }, (_, i) => i < lit ? '<i class="is-on">★</i>' : "<i>☆</i>").join("");
  }
  function starsLit(rating) {
    var _a;
    return ((_a = getStarString(rating).match(/★/g)) != null ? _a : []).length;
  }
  function cardHtml(e, posterUrl2, fetching = false) {
    const it = e.kind === "series" ? e.face : e.item;
    const st = cardStatus(e);
    const p = facePiecesHtml(it, posterUrl2, e.kind === "series" ? { name: e.name, rating: e.rating } : {});
    const label = `${e.kind === "series" ? e.name : it.name}，${statusText(st)}`;
    return `<div class="pcard${e.kind === "series" ? " pcard-series" : ""}" data-cinema-key="${esc(e.kind === "series" ? e.key : itemKey(it))}" tabindex="0" role="button" aria-label="${esc(label)}"><div class="pw"><div class="pw-face">${p.poster}</div>${fetching ? '<div class="pw-fetch"><span class="pw-spin"></span></div>' : ""}
    ${st !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(st)}">${statusText(st)}</span>` : ""}${e.kind === "series" ? seasonDotsHtml(e.seasons) : ""}</div>
    <div class="pname">${p.name}</div>
    <div class="pmeta">${p.meta}</div>
    <div class="pstars">${p.stars}</div></div>`;
  }
  function viewFiltered(view) {
    return !!(view.typeFilter || view.statusFilter || view.searchKeyword);
  }
  var HOT_FOLD_MIN = 120;
  function detailModalHtml(it, posterUrl2) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const badge = (color, text) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
    const rows = [
      ["类型", (_a = it.genre) != null ? _a : ""],
      ["导演", (_b = it.director) != null ? _b : ""],
      ["主演", (_c = it.actors) != null ? _c : ""],
      ["制片国家/地区", (_d = it.region) != null ? _d : ""],
      ["上映日期", (_f = (_e = it.releaseDate) != null ? _e : it.year) != null ? _f : ""],
      // 完整年月日（year 只留年，卡片/统计用）
      ["片长", (_g = it.duration) != null ? _g : ""],
      ["季集", it.seasonText ? `${it.seasonText} 集` : ""],
      ["豆瓣评分", (_h = it.doubanRating) != null ? _h : ""]
    ].filter(([, v]) => v !== "");
    const hot = ((_i = it.hotComment) != null ? _i : "").trim();
    const hotFold = hot.length > HOT_FOLD_MIN;
    return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${posterUrl2 ? `<img src="${esc(posterUrl2)}" onerror="this.remove()">` : ""}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(it.name)}</div>
        <div class="dm-badges">${badge(typeColor(it.group), it.typeTag)}
          ${(() => {
      const st = statusNum(it.status);
      return st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : "";
    })()}
          ${it.rating && it.rating > 0 ? `<span class="dm-stars">${getStarString(it.rating)}</span><span class="dm-rating">${Number(it.rating).toFixed(1)}</span>` : ""}
          ${it.watchDate ? `<span class="dm-date">${esc((it.watchDate || "").slice(0, 10))}</span>` : ""}</div>
        ${it.review ? `<div class="dm-review">${esc(it.review)}</div>` : ""}</div></div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join("") : ""}
    ${it.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(it.doubanUrl)}" target="_blank" rel="noopener">${esc(it.doubanUrl)}</a></span></div>` : ""}
    ${hot ? `<div class="dm-sec">热 门 短 评</div><div class="dm-quote${hotFold ? " is-fold" : ""}" data-dm-quote>${esc(hot)}</div>${hotFold ? `<button type="button" class="dm-fold j-quote-fold" data-dm-fold>展开全文（${hot.length} 字）</button>` : ""}` : ""}
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div class="dm-synopsis">${esc(it.synopsis)}</div>` : ""}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
  }
  function seriesCountsText(card) {
    var _a;
    const byType = /* @__PURE__ */ new Map();
    for (const it of card.specials) {
      const t = it.typeTag || it.group;
      byType.set(t, ((_a = byType.get(t)) != null ? _a : 0) + 1);
    }
    const extra = [...byType].map(([t, n]) => `${n} 部${t}`).join(" · ");
    return `共 ${card.seasons.length} 季` + (extra ? ` · ${extra}` : "");
  }
  function seriesDetailModalHtml(card, posterOf) {
    const face = card.face;
    const url = posterOf(face);
    const st = seriesStatus(card.seasons, card.specials);
    const badge = (color, text) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
    const thumb = (it) => {
      const t = posterOf(it);
      return `<div class="s-thumb">${t ? `<img src="${esc(t)}" alt="" onerror="this.remove()">` : ""}</div>`;
    };
    const rowOf = (it, cls) => {
      const sub = [
        it.group !== card.group ? esc(it.group) : "",
        // 特别篇常是电影/纪录片：标出组，免得看着像「某一季」
        it.watchDate ? `观影 ${esc(it.watchDate.slice(0, 10))}` : "",
        it.seasonText ? esc(it.seasonText) : ""
        // 深审批 B #6：季集原文自带单位（「2季」），不再拼「 集」出「2季 集」叠字
      ].filter(Boolean).join(" · ");
      const r = it.rating;
      return `<div class="s-row${cls}" data-cinema-season-key="${esc(itemKey(it))}">${thumb(it)}
      <div class="s-mid"><div class="s-name">${esc(it.name)}</div>${sub ? `<div class="s-sub">${sub}</div>` : ""}</div>
      <span class="s-chip" style="background:${statusColor(it.status)}">${statusText(it.status)}</span>
      <span class="s-rate${r && r > 0 ? "" : " none"}">${r && r > 0 ? Number(r).toFixed(1) : "—"}</span></div>`;
    };
    const rowSrc = [
      ...seasonsByRelease(card.seasons).map((s) => ({ it: s.item, special: false })),
      ...card.specials.map((it) => ({ it, special: true }))
    ].sort((a, b) => cmpByRelease(a.it, b.it) || (a.special === b.special ? 0 : a.special ? 1 : -1));
    const rows = rowSrc.map(({ it, special }) => rowOf(it, special ? " s-row-special" : "")).join("");
    return `<div class="cn-modal cn-modal--detail">
    <div class="dm-head"><div class="dm-poster">${url ? `<img src="${esc(url)}" onerror="this.remove()">` : ""}</div>
      <div style="flex:1;min-width:0"><div class="dm-title">${esc(card.name)}<span class="dm-n">${seriesCountsText(card)}</span></div>
        <div class="dm-badges">${badge(typeColor(card.group), face.typeTag)}
          ${st !== STATUS_WATCHED ? badge(statusColor(st), statusText(st)) : ""}
          ${card.rating && card.rating > 0 ? `<span class="dm-stars">${getStarString(card.rating)}</span><span class="dm-rating">${Number(card.rating).toFixed(1)}</span>` : ""}
          ${face.watchDate ? `<span class="dm-date">${esc(face.watchDate.slice(0, 10))}</span>` : ""}</div></div></div>
    <div class="s-list">${rows}</div>
  </div>`;
  }
  var GROUP_SUBS_OF = {
    电影: [],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: [],
    公开课: ["公开课"]
  };
  function formAllTags() {
    const out = [];
    for (const g of GROUP_ORDER) {
      if (g === "其他") continue;
      const subs = GROUP_SUBS_OF[g];
      if (subs.length) subs.forEach((t) => out.push(t));
      else out.push(g);
    }
    return out;
  }
  function formChoicesHtml(values, cur, attr) {
    return values.map((v) => {
      var _a, _b;
      return `<button type="button" class="f-choice-btn${v === cur ? " is-on" : ""}" data-${attr}="${v}"><span class="dot" style="background:${attr === "f-tag" ? typeColor((_a = getGroupForTag(v)) != null ? _a : "其他") : (_b = ST_COLOR[v]) != null ? _b : "#888"}"></span>${v}</button>`;
    }).join("");
  }
  function formModalHtml(opts) {
    const { editing } = opts;
    const initSt = opts.stText;
    const nameField = `<div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${esc(opts.name)}" placeholder="影视名称"></div>`;
    const stField = `<div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${formChoicesHtml(["想看", "在看", "已看"], initSt, "f-st")}</div></div>`;
    const ratingField = `<div class="f-field j-rating" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${opts.rating}"><span class="f-range-val j-rval">${Number(opts.rating).toFixed(1)}</span><span class="f-stars j-stars" data-lit="${starsLit(opts.rating)}">${starsHtml(opts.rating)}</span></div></div>`;
    const reviewField = `<div class="f-field j-review" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${esc(opts.review)}</textarea></div>`;
    if (editing) {
      return `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">编辑影视</div>
    ${nameField}
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${formChoicesHtml(formAllTags(), opts.typeTag, "f-tag")}</div></div>
    ${stField}${ratingField}${reviewField}
    <div class="dm-actions"><button class="dm-btn gold j-save">保存</button></div>
  </div>`;
    }
    return `<div class="cn-modal cn-modal--flip" style="width:100%">
    <div class="form-flip j-flip">
      <div class="form-face form-face--front">
        <div class="cn-modal-title">添加影视</div>
        ${nameField}${stField}${ratingField}${reviewField}
        <div class="dm-actions"><button class="dm-btn gold j-parse"><span class="f-spin"></span><span class="j-parse-text">解析</span></button></div>
      </div>
      <div class="form-face form-face--back">
        <div class="j-back"></div>
        <div class="dm-actions"><button class="dm-btn gold j-save">保存</button></div>
      </div>
    </div>
  </div>`;
  }
  function formTagChipHtml(typeTag, pending2 = false) {
    var _a;
    if (pending2) return '<span class="dm-chip dm-chip--pick is-pending"><span class="dm-skel"></span></span>';
    return `<button type="button" class="dm-chip dm-chip--pick" data-pick="tag" style="background:${typeColor((_a = getGroupForTag(typeTag)) != null ? _a : "其他")}">${esc(typeTag)}</button>`;
  }
  function formStChipHtml(stText) {
    var _a;
    return `<button type="button" class="dm-chip dm-chip--pick" data-pick="st" style="background:${(_a = ST_COLOR[stText]) != null ? _a : "#888"}">${esc(stText)}</button>`;
  }
  function formBackHtml(d, o) {
    var _a, _b, _c, _d;
    if (!d) return "";
    const rows = [
      ["豆瓣类型", d.genre],
      ["导演", d.director],
      ["主演", d.actors],
      ["制片国家/地区", d.region],
      ["上映日期", d.releaseDate],
      ["片长", d.duration],
      ["豆瓣评分", d.doubanRating]
    ].filter(([, v]) => v !== "");
    const hot = ((_a = d.hotComment) != null ? _a : "").trim();
    const rc = ((_b = o.rating) != null ? _b : 0) > 0 ? o.rating : 0;
    const dateText = ((_c = o.watchDate) != null ? _c : "").slice(0, 10);
    const reviewText = ((_d = o.review) != null ? _d : "").trim();
    const tagItems = formAllTags().map((t) => {
      var _a2;
      return `<button type="button" class="dm-pick-item${t === o.typeTag ? " is-on" : ""}" data-f-tag="${esc(t)}"><span class="dot" style="background:${typeColor((_a2 = getGroupForTag(t)) != null ? _a2 : "其他")}"></span>${esc(t)}</button>`;
    }).join("");
    const stItems = ["想看", "在看", "已看"].map((s) => {
      var _a2;
      return `<button type="button" class="dm-pick-item${s === o.stText ? " is-on" : ""}" data-f-st="${esc(s)}"><span class="dot" style="background:${(_a2 = ST_COLOR[s]) != null ? _a2 : "#888"}"></span>${esc(s)}</button>`;
    }).join("");
    return `
    <div class="dm-head">
      <div class="dm-poster">${d.posterUrl ? `<img src="${esc(d.posterUrl)}" alt="" onload="this.parentNode.classList.add('is-ready')" onerror="this.remove()">` : ""}</div>
      <div style="flex:1;min-width:0">
        <div class="dm-title">${esc(d.title)}</div>
        <div class="dm-badges">${formTagChipHtml(o.typeTag, !!o.classifying)}${formStChipHtml(o.stText)}</div>
        ${rc || dateText ? `<div class="dm-record">
          ${rc ? `<span class="dm-stars">${getStarString(rc)}</span><span class="dm-rating">${Number(rc).toFixed(1)}</span>` : ""}
          ${dateText ? `<span class="dm-date">${esc(dateText)}</span>` : ""}</div>` : ""}
        ${reviewText ? `<div class="dm-review">${esc(reviewText)}</div>` : ""}
      </div>
    </div>
    <div class="dm-pick-list" data-pick-list="tag">${tagItems}</div>
    <div class="dm-pick-list" data-pick-list="st">${stItems}</div>
    ${rows.length ? '<div class="dm-sec">豆 瓣 信 息</div>' + rows.map(([k, v]) => `<div class="dm-kv"><span class="dm-kv-k">${k}</span><span class="dm-kv-v">${esc(v)}</span></div>`).join("") : ""}
    ${d.doubanUrl ? `<div class="dm-kv"><span class="dm-kv-k">豆瓣链接</span><span class="dm-kv-v"><a href="${esc(d.doubanUrl)}" target="_blank" rel="noopener">${esc(d.doubanUrl)}</a></span></div>` : ""}
    ${hot ? `<div class="dm-sec">热 门 短 评</div><div class="dm-quote">${esc(hot)}</div>` : ""}
  `;
  }
  function aiRecName(r) {
    return (r == null ? void 0 : r.title) || (r == null ? void 0 : r.name) || "未命名";
  }
  function aiRecMeta(r) {
    return (r == null ? void 0 : r.meta) || [r == null ? void 0 : r.type, r == null ? void 0 : r.director].filter(Boolean).join(" · ");
  }
  function aiPageHtml(inp) {
    if (inp.running) {
      return `<div class="ai-guide"><div class="ai-spin"></div>
      <span class="ai-ic">${iconSpan(ICON.ai)}</span><div class="ai-title">${esc(inp.waitMsg || "AI 正在分析你的观影口味…")}</div>
      <div class="ai-sub">正在生成推荐，请稍候</div></div>`;
    }
    if (inp.error) {
      return `<div class="ai-guide"><span class="ai-ic ai-err-ic">${iconSpan(ICON.ai)}</span>
      <div class="ai-title">AI 分析失败</div><div class="ai-sub">${esc(inp.error)}</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>重试</button></div>`;
    }
    if (inp.results && inp.results.length > 0) {
      const cards = inp.results.map((rec, i) => {
        const name = aiRecName(rec);
        const inLib = inp.inLibrary(name);
        return `<div class="rec-card"><div class="rec-main"><div class="rec-name">${esc(name)}
        <a href="${esc(doubanSearchUrl(name))}" target="_blank" rel="noopener" title="在豆瓣搜索">${iconSpan(ICON.globe)}</a></div>
        <div class="rec-meta">${esc(aiRecMeta(rec))}</div><div class="rec-reason">${esc((rec == null ? void 0 : rec.reason) || "")}</div></div>
        <button class="rec-add" data-rec-add="${i}"${inLib ? " disabled" : ""}>${inLib ? "已在库中" : "＋ 想看"}</button></div>`;
      }).join("");
      return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
      <div class="rec-list">${cards}</div>
      <div style="text-align:center;margin-top:14px"><button class="dm-btn j-ai-more" data-cinema-ai-start>${iconSpan(ICON.ai)}换一批</button></div>`;
    }
    return `<div class="ai-pref">偏好：<b>${esc(inp.pref)}</b></div>
    <div class="ai-guide">
      <div class="ai-title">让 AI 读懂你的片库</div>
      <div class="ai-sub">基于你的评分、影评与偏好标签生成荐片，<br>结果可直接加入想看清单</div>
      <button class="ai-start j-ai-start" data-cinema-ai-start>${iconSpan(ICON.ai)}开始推荐</button></div>`;
  }
  function sheetHeadHtml(it, posterUrl2) {
    return `<div class="cn-sheet-head">${posterUrl2 ? `<img class="cn-sheet-poster" src="${esc(posterUrl2)}" onerror="this.remove()">` : ""}
    <div><div class="cn-sheet-name">${esc(it.name)}</div><div class="cn-sheet-sub">${esc(it.year || "")} · ${esc(it.director || it.group)} · ${statusText(it.status)}</div></div></div>`;
  }
  function seriesSheetHeadHtml(card, posterUrl2) {
    return `<div class="cn-sheet-head">${posterUrl2 ? `<img class="cn-sheet-poster" src="${esc(posterUrl2)}" onerror="this.remove()">` : ""}
    <div><div class="cn-sheet-name">${esc(card.name)}</div><div class="cn-sheet-sub">${esc(seriesCountsText(card))}</div></div></div>`;
  }

  // src/cinema/layouts/midnight/render.ts
  function midnightDeskHtml() {
    return `<section class="bz-cinema--midnight" data-cinema-root="midnight">
    <div class="d-body">
      <aside class="d-rail">
        <div class="rail-brand"><h1>影院</h1><div class="en">CINEMA CLUB</div></div>
        <div class="rail-sec">
          <div class="rail-label">类 型</div>
          <div class="j-groups"></div>
          <div class="rail-label" style="padding-top:14px">状 态</div>
          <div class="j-status"></div>
        </div>
        <div class="rail-foot">
          <button class="rail-item j-tool" data-tool="ai">${iconSpan(ICON.ai)}AI 荐片</button>
          <button class="rail-item j-tool" data-film-open>${iconSpan(ICON.stat)}观影分析</button>
        </div>
      </aside>
      <div class="d-main j-view"></div>
    </div>
  </section>`;
  }
  function midnightMobHtml() {
    return `<section class="mob bz-cinema--midnight bz-panel-mtop" data-cinema-root="midnight">
    <div class="m-head"><h2 class="j-mtitle">全部</h2><span class="cnt j-mcnt"></span>
      <span class="m-acts">
        <button class="add j-madd bz-touch-target bz-touch-target--lg" data-cinema-add title="添加影片">${iconSpan(ICON.add)}</button>
        <button class="m-tool j-mai bz-touch-target bz-touch-target--lg" title="AI 荐片">${iconSpan(ICON.ai)}</button>
        <button class="m-tool j-mstat bz-touch-target bz-touch-target--lg" title="观影分析" data-film-open>${iconSpan(ICON.stat)}</button>
        <button class="m-tool j-mclose bz-touch-target bz-touch-target--lg" title="关闭">${iconSpan(ICON.close)}</button>
      </span>
    </div>
    <div class="m-chips j-chips"></div>
    <label class="m-search">${iconSpan(ICON.search)}<input class="j-mq" placeholder="搜索片名、类型、导演、主演、影评…"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索" hidden>${iconSpan(ICON.close)}</button></label>
    <div class="m-scroll j-mview"></div>
  </section>`;
  }
  var railRow = (on, attr, color, name, n) => `<button class="rail-item${on ? " is-on" : ""}" ${attr}><span class="dot" style="background:${color}"></span>${esc(name)}<span class="n">${n}</span></button>`;
  function railHtml(cards, view) {
    const listOn = view.view === "list";
    const g = {};
    const c = { 想看: 0, 在看: 0, 已看: 0 };
    cards.forEach((e) => {
      const grp = cardGroup(e);
      g[grp] = (g[grp] || 0) + 1;
      c[statusText(cardStatus(e))]++;
    });
    let groups = railRow(listOn && !view.typeFilter && !view.statusFilter, 'data-g="全部"', "var(--gold)", "全部", cards.length);
    for (const name of GROUP_ORDER) {
      groups += railRow(listOn && view.typeFilter === name && !view.statusFilter, `data-g="${name}"`, typeColor(name), name, g[name] || 0);
    }
    let status = "";
    for (const s of ["想看", "在看", "已看"]) {
      status += railRow(listOn && view.statusFilter === s, `data-s="${s}"`, ST_COLOR[s], s, c[s]);
    }
    return { groups, status };
  }
  function chipsHtml(view) {
    const listOn = view.view === "list";
    let html = `<button class="chip bz-touch-target--lg${listOn && !view.typeFilter && !view.statusFilter ? " is-on" : ""}" data-c="all">${iconSpan(ICON.grid)}全部</button>`;
    for (const name of GROUP_ORDER) {
      html += `<button class="chip bz-touch-target--lg${listOn && view.typeFilter === name && !view.statusFilter ? " is-on" : ""}" data-c="${name}">${name}</button>`;
    }
    for (const s of ["想看", "在看", "已看"]) {
      html += `<button class="chip bz-touch-target--lg${listOn && view.statusFilter === s ? " is-on" : ""}" data-s="${s}">${s}</button>`;
    }
    return html;
  }
  function emptyPageHtml(filtered) {
    return `<div class="cn-empty-page"><div class="big">${filtered ? "无匹配影片" : "影片空空如也"}</div>
    ${filtered ? '<button class="dm-btn j-clear" data-cinema-clear style="margin-top:6px">清空筛选</button>' : '<span style="font-size:11.5px">点右上「添加影片」开始记录</span>'}</div>`;
  }
  function spHeadHtml(title, cnt) {
    return `<div class="sp-head"><button class="sp-back j-back">${iconSpan(ICON.back)}</button><span class="sp-title">${esc(title)}</span><span class="sp-cnt j-spcnt">${cnt}</span></div>`;
  }
  function cardsHtml(cards, inp) {
    return cards.map((e) => {
      var _a, _b;
      const face = cardFace(e);
      return cardHtml(e, inp.poster(face), (_b = (_a = inp.fetching) == null ? void 0 : _a.call(inp, face)) != null ? _b : false);
    }).join("");
  }
  function listHeadHtml(inp) {
    return `<div class="d-head"><h2 class="j-title">${esc(inp.title)}</h2><span class="cnt j-cnt">· ${inp.cards.length} 部</span>
    <button class="add j-add" data-cinema-add>${iconSpan(ICON.add)}添加影片</button></div>`;
  }
  function listToolsHtml(view) {
    return `<div class="d-tools"><label class="d-search">${iconSpan(ICON.search)}<input class="j-q" placeholder="搜索片名、类型、导演、主演、影评…" value="${esc(view.searchKeyword)}"><button type="button" class="q-clear" data-cinema-clear title="清空搜索" aria-label="清空搜索"${view.searchKeyword ? "" : " hidden"}>${iconSpan(ICON.close)}</button></label>
    <div class="seg j-sort">${[["date", "最近观看"], ["created", "加入先后"], ["rating", "按评分"]].map(([k, l]) => `<button data-k="${k}" class="${view.sortMode === k ? "is-on" : ""}">${l}</button>`).join("")}</div></div>`;
  }
  function renderMidnightDesk(root, inp) {
    const rail = railHtml(inp.allCards, inp.view);
    const groupsEl = root.querySelector(".j-groups");
    const statusEl = root.querySelector(".j-status");
    if (groupsEl) groupsEl.innerHTML = rail.groups;
    if (statusEl) statusEl.innerHTML = rail.status;
    const view = root.querySelector(".j-view");
    if (!view) return;
    const v = inp.view;
    root.querySelectorAll(".rail-foot .j-tool").forEach((b) => b.classList.toggle("is-on", v.view === "ai" && b.dataset.tool === "ai"));
    if (v.view === "ai") {
      view.innerHTML = spHeadHtml("AI 荐片", inp.aiCount ? `· ${inp.aiCount} 部` : "") + `<div class="sp-body">${inp.aiHtml}</div>`;
    } else {
      const body = inp.cards.length ? `<div class="d-scroll"><div class="grid" style="grid-template-columns:repeat(${inp.cols},1fr)">${cardsHtml(inp.cards, inp)}</div></div>` : emptyPageHtml(viewFiltered(v));
      view.innerHTML = listHeadHtml(inp) + listToolsHtml(v) + body;
    }
  }
  function renderMidnightMob(root, inp) {
    const v = inp.view;
    const t = v.view === "list" ? inp.title : "AI 荐片";
    const titleEl = root.querySelector(".j-mtitle");
    const cntEl = root.querySelector(".j-mcnt");
    if (titleEl) titleEl.textContent = t;
    if (cntEl) cntEl.textContent = v.view === "list" ? `· ${inp.cards.length}` : "";
    const q = root.querySelector(".j-mq");
    if (q && q.value !== v.searchKeyword) q.value = v.searchKeyword;
    const qClear = root.querySelector(".m-search .q-clear");
    if (qClear) qClear.hidden = !v.searchKeyword;
    const mv = root.querySelector(".j-mview");
    if (mv) {
      if (v.view === "list") {
        mv.className = inp.cards.length ? "m-scroll j-mview" : "m-scroll j-mview cn-mempty";
        mv.innerHTML = inp.cards.length ? `<div class="m-grid">${cardsHtml(inp.cards, inp)}</div>` : emptyPageHtml(viewFiltered(v));
      } else {
        mv.className = "sp-body j-mview";
        mv.innerHTML = inp.aiHtml;
      }
    }
    const chips = root.querySelector(".j-chips");
    if (chips) chips.innerHTML = chipsHtml(v);
  }

  // src/cinema/ui.ts
  function posterUrl(item, app) {
    if (!item.poster) return null;
    const f = app.vault.getAbstractFileByPath(item.poster);
    if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(f.name)) {
      return app.vault.getResourcePath(f);
    }
    return null;
  }
  function itemByKeyInState(key) {
    return itemByKey(M.items, key);
  }
  function openDouban(item) {
    const url = item.doubanUrl || doubanSearchUrl(item.name);
    openExternalUrl(M.appRef, url);
  }
  async function markStatus(item, target, app) {
    const fromSt = item.status === STATUS_WANT ? "want" : item.status === STATUS_WATCHING ? "watching" : "watched";
    const prevRating = item.rating && item.rating > 0 ? item.rating : null;
    const prev = { status: item.status, rating: item.rating, watchDate: item.watchDate };
    item.status = target === "已看" ? STATUS_WATCHED : STATUS_WATCHING;
    if (target === "在看") {
      item.rating = 0;
    } else if (!prevRating) {
      item.rating = DEFAULT_RATING;
    }
    item.watchDate = localNow();
    try {
      await persistItem(item, app);
      notice(`已把「${item.name}」标记为${target}`, "success");
      const toSt = target === "已看" ? "watched" : "watching";
      if (toSt !== fromSt) emitDomainEvent("movie", { kind: "status", name: item.name, from: fromSt, to: toSt });
      if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
        emitDomainEvent("movie", { kind: "rated", name: item.name, fromRating: prevRating, toRating: item.rating });
      }
      markCardFlash(itemKey(item), item.rating !== prevRating);
      renderAll(app);
    } catch (e) {
      Object.assign(item, prev);
      notifySaveError(e);
      console.error(e);
      renderAll(app);
    }
  }
  function itemActions(it, sec, app) {
    const out = [{ icon: ICON.eye, label: "打开详情", run: () => openDetail(sec, it, app) }];
    if (it.status !== STATUS_WATCHING && it.status !== STATUS_WATCHED) {
      out.push({ icon: ICON.play, label: "标记在看", run: () => void markStatus(it, "在看", app) });
    }
    if (it.status !== STATUS_WATCHED) {
      out.push({ icon: "check", label: "标记已看", run: () => openForm(sec, it, app, "已看") });
    }
    out.push(
      { icon: ICON.ai, label: "找同类", run: () => void runSimilarRecommend(it, app) },
      { icon: ICON.globe, label: "在豆瓣打开", run: () => openDouban(it) },
      { icon: ICON.edit, label: "编辑", run: () => openForm(sec, it, app) },
      { icon: ICON.del, label: "删除", danger: true, run: () => openConfirm(it, app) }
    );
    return out;
  }
  async function persistItem(item, app, edit, douban, posterRel) {
    var _a;
    if (!item.file) {
      const folder = M.folderPath;
      if (!app.vault.getAbstractFileByPath(folder)) {
        await app.vault.createFolder(folder);
      }
      const filePath = `${folder}/《${item.name}》.md`;
      let content = `---
tags:
- ${item.typeTag}
观影日期: "${item.watchDate || localNow()}"
评分: ${(_a = item.rating) != null ? _a : 0}
海报: 
---
`;
      if (posterRel) content = insertPosterEmbed(content, posterRel);
      const f = await app.vault.create(filePath, content);
      item.file = f;
      if (item.review || douban || posterRel) {
        await app.fileManager.processFrontMatter(f, (fm) => {
          var _a2, _b, _c, _d, _e;
          if (posterRel) fm["海报"] = posterRel;
          if (item.review) fm["影评"] = item.review;
          if (douban) {
            const az = douban.apizero;
            if (douban.detailUrl) fm["豆瓣链接"] = douban.detailUrl;
            if (az) {
              if (az.score) fm["豆瓣评分"] = az.score;
              if (az.genre) fm["类型"] = normalizeListValue(az.genre);
              if (az.area) fm["制片国家/地区"] = normalizeListValue(az.area);
              if (az.duration) fm["片长"] = az.duration;
              if (az.year) fm["上映日期"] = az.year;
              if (az.shortComment) fm["热门短评"] = az.shortComment;
            }
            const director = (az == null ? void 0 : az.director) ? normalizeListValue(az.director) : (_b = (_a2 = douban.celebrities) == null ? void 0 : _a2.directors) != null ? _b : "";
            const actors = (az == null ? void 0 : az.actor) ? normalizeListValue(az.actor) : (_d = (_c = douban.celebrities) == null ? void 0 : _c.casts) != null ? _d : "";
            if (director) fm["导演"] = director;
            if (actors) fm["主演"] = actors;
            if ((_e = douban.celebrities) == null ? void 0 : _e.writers) fm["编剧"] = douban.celebrities.writers;
          }
        });
      }
      return;
    }
    if (edit && item.name !== edit.prevName) {
      const newPath = `${M.folderPath}/《${item.name}》.md`;
      if (newPath !== item.file.path) {
        await app.fileManager.renameFile(item.file, newPath);
        item.file = app.vault.getAbstractFileByPath(newPath) || item.file;
      }
    }
    await app.fileManager.processFrontMatter(item.file, (fm) => {
      var _a2;
      fm["评分"] = (_a2 = item.rating) != null ? _a2 : 0;
      fm["观影日期"] = item.watchDate || localNow();
      if (item.review) fm["影评"] = item.review;
      else delete fm["影评"];
      if (edit) {
        const tags = normalizeTags(fm["tags"]);
        const at2 = tags.indexOf(edit.prevTag);
        if (at2 >= 0) tags[at2] = item.typeTag;
        else if (!tags.includes(item.typeTag)) tags.unshift(item.typeTag);
        fm["tags"] = tags;
      }
    });
  }
  function openAddModalDirect(app) {
    var _a;
    if (!M.currentOverlay) createOverlay(app);
    const root = (_a = M.currentOverlay) == null ? void 0 : _a.querySelector("[data-cinema-root]");
    if (root) openForm(root, null, app);
  }
  function listTitle() {
    return (M.typeFilter || "全部") + (M.statusFilter ? ` · ${M.statusFilter}` : "");
  }
  function gridColumns() {
    const raw = Number(tryGetSettings().cinemaGridColumns);
    if (!Number.isFinite(raw) || raw <= 0) return 5;
    return Math.min(12, Math.max(2, Math.round(raw)));
  }
  function mergeSeasonsOn() {
    return tryGetSettings().cinemaMergeSeasons === true;
  }
  function seriesCardByKey(key) {
    return mergeSeasonCards(getDisplayItems(), mergeSeasonsOn()).find((c) => c.kind === "series" && c.key === key);
  }
  function seriesAllAct(sec, key, app) {
    return { icon: "layers", label: "查看全部", run: () => openSeriesDetail(sec, key, app) };
  }
  function cardEntryHtml(e, app) {
    var _a;
    const face = cardFace(e);
    return cardHtml(e, posterUrl(face, app), isFetching((_a = face.file) == null ? void 0 : _a.path));
  }
  function ovHost(sec) {
    let host = sec.querySelector("[data-cinema-ovhost]");
    if (!host) {
      host = document.createElement("div");
      host.className = "bz-cinema--midnight";
      host.setAttribute("data-cinema-ovhost", "");
      host.style.display = "contents";
      sec.appendChild(host);
    }
    return host;
  }
  var liveOvlCloses = /* @__PURE__ */ new Set();
  function ovl(sec, html, opts = {}) {
    const el = document.createElement("div");
    el.className = "cn-ovl";
    el.innerHTML = html;
    ovHost(sec).appendChild(el);
    let close = () => {
    };
    const finish = () => {
      handle.unregister();
      liveOvlCloses.delete(close);
      el.remove();
    };
    const handle = escManager.register("bz-cinema-ovl", { isVisible: () => el.isConnected, close: () => close() });
    close = (o) => {
      var _a;
      if (!(o == null ? void 0 : o.skipReturn) && ((_a = opts.onWillClose) == null ? void 0 : _a.call(opts, finish))) return;
      finish();
    };
    liveOvlCloses.add(close);
    el.addEventListener("click", (e) => {
      if (e.target === el && !opts.sticky) close();
    });
    return { el, close };
  }
  var MENU_SKIN = "cn-skin cn-menu-skin";
  var SHEET_SKIN = "cn-skin cn-sheet-skin";
  function toItemActions(acts) {
    return acts.map((a) => ({
      icon: a.icon,
      label: a.label,
      kind: a.danger ? "danger" : void 0,
      onClick: a.run
    }));
  }
  function deferClose(acts, close) {
    return acts.map((a) => ({ ...a, run: () => {
      close();
      a.run();
    } }));
  }
  function headElOf(html) {
    var _a;
    const box = document.createElement("div");
    box.innerHTML = html;
    return (_a = box.firstElementChild) != null ? _a : box;
  }
  function sheetHeadEl2(it, url) {
    return headElOf(sheetHeadHtml(it, url));
  }
  function seriesSheetHeadEl(card, url) {
    return headElOf(seriesSheetHeadHtml(card, url));
  }
  var peekStates = /* @__PURE__ */ new WeakMap();
  var PEEK_MS = MOTION.base;
  var PEEK_BACK_MS = MOTION.move;
  function faceSlots(card) {
    return ["pw-face", "pname", "pmeta", "pstars"].map((c) => card.querySelector(`.${c}`)).filter((x) => !!x);
  }
  function rippleOrigin(pw, dot) {
    const pr = pw.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    const x = dr.left + dr.width / 2 - pr.left;
    const y = dr.top + dr.height / 2 - pr.top;
    return { x, y, r: Math.hypot(Math.max(x, pr.width - x), Math.max(y, pr.height - y)) };
  }
  function peekLayer(pw) {
    var _a;
    let layer = pw.querySelector(".pw-in");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "pw-in";
      (_a = pw.querySelector(".pw-face")) == null ? void 0 : _a.after(layer);
    }
    return layer;
  }
  function peekTextFade(els) {
    els.forEach((el, i) => {
      try {
        el.animate(
          [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
          { duration: MOTION.move, delay: i * STAGGER, easing: EASE.out, fill: "backwards" }
        );
      } catch (e) {
      }
    });
  }
  function isFaceSeason(card, dot) {
    const key = card.dataset.cinemaKey;
    const seasonKey = dot.dataset.cinemaSeasonKey;
    if (!key || !seasonKey || !isSeriesKey(key)) return false;
    const sc = seriesCardByKey(key);
    return !!sc && itemKey(cardFace(sc)) === seasonKey;
  }
  function peekSeasonDot(dot, app) {
    var _a;
    const card = dot.closest(".pcard");
    const pw = card == null ? void 0 : card.querySelector(".pw");
    const it = itemByKeyInState(dot.dataset.cinemaSeasonKey);
    const slots = card ? faceSlots(card) : [];
    if (!card || !pw || !it || slots.length !== 4) return false;
    let st = peekStates.get(card);
    if (!st) {
      st = { snap: slots.map((s) => s.innerHTML), anim: null, origin: null, gen: 0 };
      peekStates.set(card, st);
    }
    st.gen++;
    if (isFaceSeason(card, dot)) {
      if (card.classList.contains("is-peek") || pw.querySelector(".pw-in")) collapsePeek(card);
      const p2 = facePiecesHtml(it, posterUrl(it, app));
      slots[1].innerHTML = p2.name;
      slots[2].innerHTML = p2.meta;
      slots[3].innerHTML = p2.stars;
      card.classList.add("is-peek");
      return true;
    }
    const layer = peekLayer(pw);
    if (layer.firstChild) slots[0].innerHTML = layer.innerHTML;
    (_a = st.anim) == null ? void 0 : _a.cancel();
    st.anim = null;
    const o = rippleOrigin(pw, dot);
    st.origin = o;
    layer.style.clipPath = `circle(${o.r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`;
    const p = facePiecesHtml(it, posterUrl(it, app));
    layer.innerHTML = p.poster;
    slots[1].innerHTML = p.name;
    slots[2].innerHTML = p.meta;
    slots[3].innerHTML = p.stars;
    peekTextFade(slots.slice(1));
    card.classList.add("is-peek");
    try {
      st.anim = layer.animate(
        [
          { clipPath: `circle(0px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` },
          { clipPath: `circle(${o.r.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` }
        ],
        { duration: PEEK_MS, easing: EASE.out, fill: "forwards" }
      );
    } catch (e) {
    }
    return true;
  }
  function collapsePeek(card) {
    var _a, _b;
    const st = peekStates.get(card);
    if (!st) return;
    card.classList.remove("is-peek");
    (_a = st.anim) == null ? void 0 : _a.cancel();
    st.anim = null;
    st.gen++;
    (_b = card.querySelector(".pw-in")) == null ? void 0 : _b.remove();
    const slots = faceSlots(card);
    if (slots.length !== 4) return;
    slots.forEach((s, i) => {
      s.innerHTML = st.snap[i];
    });
  }
  function restFace(dot) {
    var _a;
    const card = dot.closest(".pcard");
    const st = card ? peekStates.get(card) : void 0;
    if (!card || !st) return;
    const layer = card.querySelector(".pw-in");
    card.classList.remove("is-peek");
    const slotsNow = faceSlots(card);
    if (slotsNow.length === 4) slotsNow[0].innerHTML = st.snap[0];
    const gen = ++st.gen;
    let closed = false;
    const done = () => {
      if (closed || st.gen !== gen) return;
      closed = true;
      st.anim = null;
      layer == null ? void 0 : layer.remove();
      const slots = faceSlots(card);
      if (slots.length !== 4) return;
      slots.forEach((s, i) => {
        s.innerHTML = st.snap[i];
      });
      peekTextFade(slots.slice(1));
    };
    if (!layer || !st.origin) {
      done();
      return;
    }
    const o = st.origin;
    (_a = st.anim) == null ? void 0 : _a.cancel();
    st.anim = null;
    try {
      const fold = layer.animate(
        [{ clipPath: getComputedStyle(layer).clipPath }, { clipPath: `circle(0px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)` }],
        { duration: PEEK_BACK_MS, easing: EASE.out }
      );
      st.anim = fold;
      fold.finished.then(done).catch(done);
    } catch (e) {
      done();
      return;
    }
    window.setTimeout(done, PEEK_BACK_MS + 400);
  }
  var TILT_DEG = 5.5;
  function bindCardTilt(sec) {
    let card = null;
    let box = null;
    const rest = () => {
      if (!card) return;
      card.style.setProperty("--tlt-x", "0deg");
      card.style.setProperty("--tlt-y", "0deg");
      card.classList.remove("is-tilt");
      card = null;
      box = null;
    };
    sec.addEventListener("pointermove", (e) => {
      var _a, _b, _c;
      const pw = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".pw");
      const next = (_c = pw == null ? void 0 : pw.closest(".pcard")) != null ? _c : null;
      if (!pw || !next) {
        rest();
        return;
      }
      if (next !== card) {
        rest();
        const r = pw.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        card = next;
        box = r;
        next.classList.add("is-tilt");
      }
      if (!box) return;
      const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
      card.style.setProperty("--tlt-y", `${((x - 0.5) * 2 * TILT_DEG).toFixed(2)}deg`);
      card.style.setProperty("--tlt-x", `${((0.5 - y) * 2 * TILT_DEG).toFixed(2)}deg`);
    });
    sec.addEventListener("pointerleave", rest);
    sec.addEventListener("click", rest, true);
  }
  function attachLongPress(sec, app) {
    sec.querySelectorAll(".m-grid .pcard").forEach((c) => {
      c.addEventListener("contextmenu", (ev) => ev.preventDefault());
      longPress(c, () => {
        const key = c.dataset.cinemaKey;
        if (isSeriesKey(key)) {
          const card = seriesCardByKey(key);
          if (card) openSheet(sec, seriesSheetTarget(card, sec, app));
          return;
        }
        const it = itemByKeyInState(key);
        if (!it) return;
        openSheet(sec, itemSheetTarget(it, sec, app));
      });
    });
  }
  function itemSheetTarget(it, sec, app) {
    return { acts: itemActions(it, sec, app), head: sheetHeadEl2(it, posterUrl(it, app)) };
  }
  function seriesSheetTarget(card, sec, app) {
    return { acts: [seriesAllAct(sec, card.key, app)], head: seriesSheetHeadEl(card, posterUrl(card.face, app)) };
  }
  function openSheet(sec, target, preFire) {
    if (!sec.isConnected) return;
    openItemSheet(toItemActions(preFire ? deferClose(target.acts, preFire) : target.acts), {
      sheetClass: SHEET_SKIN,
      sheetHead: target.head
    });
  }
  function openDetail(sec, it, app, opts = {}) {
    var _a, _b, _c, _d, _e, _f;
    const url = posterUrl(it, app);
    const from = (_a = opts.from) != null ? _a : sec.querySelector(`.pcard[data-cinema-key="${CSS.escape(itemKey(it))}"]`);
    const se = from ? createSharedFlight() : null;
    const { el, close } = ovl(sec, detailModalHtml(it, url), { onWillClose: se == null ? void 0 : se.willClose });
    mountIcons(el);
    if (se) se.begin(el, { el: from, borrow: (_b = opts.borrow) != null ? _b : "card" });
    (_c = el.querySelector(".j-edit")) == null ? void 0 : _c.addEventListener("click", () => {
      close({ skipReturn: true });
      openForm(sec, it, app);
    });
    (_d = el.querySelector(".j-del")) == null ? void 0 : _d.addEventListener("click", () => {
      close({ skipReturn: true });
      openConfirm(it, app);
    });
    (_e = el.querySelector(".j-similar")) == null ? void 0 : _e.addEventListener("click", () => {
      close({ skipReturn: true });
      void runSimilarRecommend(it, app);
    });
    const foldBtn = el.querySelector("[data-dm-fold]");
    const quote = el.querySelector("[data-dm-quote]");
    if (foldBtn && quote) {
      const foldText = (_f = foldBtn.textContent) != null ? _f : "展开全文";
      foldBtn.addEventListener("click", () => toggleQuoteFold(quote, foldBtn, foldText));
    }
    const dmPoster = el.querySelector(".dm-poster");
    dmPoster == null ? void 0 : dmPoster.addEventListener("click", () => {
      var _a2;
      const src = (_a2 = dmPoster.querySelector("img")) == null ? void 0 : _a2.getAttribute("src");
      if (src) openLightbox({ src, type: "image", title: it.name });
    });
  }
  var foldGens = /* @__PURE__ */ new WeakMap();
  function toggleQuoteFold(quote, btn, expandText) {
    var _a;
    const folded = quote.classList.contains("is-fold");
    const lh = parseFloat(getComputedStyle(quote).lineHeight);
    const collapsed = Number.isFinite(lh) && lh > 0 ? lh * 3 : 0;
    const setText = () => {
      btn.textContent = folded ? "收起" : expandText;
    };
    if (!collapsed || typeof quote.animate !== "function") {
      quote.classList.toggle("is-fold");
      setText();
      return;
    }
    let full;
    if (folded) {
      quote.classList.remove("is-fold");
      full = quote.getBoundingClientRect().height;
      if (!full || full <= collapsed) {
        setText();
        return;
      }
      quote.style.maxHeight = `${collapsed}px`;
    } else {
      full = quote.getBoundingClientRect().height;
      quote.style.maxHeight = `${full}px`;
    }
    quote.style.overflow = "hidden";
    const gen = ((_a = foldGens.get(quote)) != null ? _a : 0) + 1;
    foldGens.set(quote, gen);
    const done = () => {
      if (foldGens.get(quote) !== gen) return;
      quote.style.maxHeight = "";
      quote.style.overflow = "";
      if (!folded) quote.classList.add("is-fold");
      setText();
    };
    try {
      const a = quote.animate(
        [{ maxHeight: `${folded ? collapsed : full}px` }, { maxHeight: `${folded ? full : collapsed}px` }],
        { duration: MOTION.base, easing: EASE.out }
      );
      a.finished.then(done).catch(done);
      window.setTimeout(done, MOTION.base + 400);
    } catch (e) {
      done();
    }
  }
  var SE_FLIGHT = MOTION.move;
  var SE_GROW = MOTION.move;
  var SE_GROW_OPEN = 300;
  function spawnFlyClone(host, imgSrc, w, h, radius) {
    const clone = document.createElement("div");
    clone.className = "cn-fly";
    clone.style.width = `${Math.round(w)}px`;
    clone.style.height = `${Math.round(h)}px`;
    clone.style.borderRadius = radius;
    const img = document.createElement("img");
    img.alt = "";
    img.src = imgSrc;
    clone.appendChild(img);
    host.appendChild(clone);
    return clone;
  }
  function flyKeyframes(base, w, h, ...stops) {
    const at2 = (r) => `translate(${(r.left + r.width / 2 - base.left - w / 2).toFixed(1)}px, ${(r.top + r.height / 2 - base.top - h / 2).toFixed(1)}px) scale(${(r.width / w).toFixed(4)}, ${(r.height / h).toFixed(4)})`;
    return stops.map((r) => ({ transform: at2(r) }));
  }
  function measureFlip(targets, mutate) {
    const before = targets.map((c) => c.getBoundingClientRect());
    mutate();
    return targets.map((c, i) => {
      const now = c.getBoundingClientRect();
      return { el: c, dx: before[i].left - now.left, dy: before[i].top - now.top, before: before[i], now };
    });
  }
  function playFlip(deltas, viewport, duration = SE_FLIGHT) {
    const near = (r) => r.width > 0 && r.top < viewport.bottom + 120 && r.bottom > viewport.top - 120 && r.left < viewport.right + 120 && r.right > viewport.left - 120;
    for (const d of deltas) {
      if (typeof d.el.animate !== "function") continue;
      if (Math.abs(d.dx) < 1 && Math.abs(d.dy) < 1 || !near(d.now) && !near(d.before)) continue;
      d.el.animate(
        [{ transform: `translate(${d.dx.toFixed(1)}px, ${d.dy.toFixed(1)}px)` }, { transform: "none" }],
        { duration, easing: EASE.out }
      );
    }
  }
  function createSharedFlight() {
    let phase = "idle";
    let overlay = null;
    let target = null;
    let src = null;
    let taken = null;
    let borrow = "card";
    let boxEl = null;
    let flyingClone = null;
    let srcRect = null;
    const reflowSet = () => {
      if (!boxEl) return [];
      const sibs = [...boxEl.querySelectorAll(borrow === "row" ? ".s-row" : ".pcard")];
      const panel = borrow === "row" ? boxEl.closest(".cn-modal") : null;
      return panel ? [panel, ...sibs] : sibs;
    };
    const extractSrc = () => {
      const t = taken;
      if (!t) return;
      const set = reflowSet().filter((c) => c !== t);
      const viewport = (boxEl != null ? boxEl : t).getBoundingClientRect();
      playFlip(measureFlip(set, () => {
        t.style.display = "none";
      }), viewport);
    };
    const reinsertSrc = (reflowMs) => {
      const t = taken;
      if (!t || !t.isConnected || !(boxEl == null ? void 0 : boxEl.isConnected)) return null;
      const set = reflowSet().filter((c) => c !== t);
      const viewport = boxEl.getBoundingClientRect();
      const deltas = measureFlip(set, () => {
        t.style.display = "";
        t.style.visibility = "hidden";
      });
      const to = (src == null ? void 0 : src.isConnected) ? src.getBoundingClientRect() : null;
      playFlip(deltas, viewport, reflowMs);
      return to;
    };
    const restoreSrc = () => {
      if (taken) {
        taken.style.display = "";
        taken.style.visibility = "";
      }
    };
    return {
      /** 关闭接管：返回 true = 本模块收下这次关闭，finish 由动效结束（或超时兜底）调用 */
      willClose(finish) {
        var _a, _b, _c;
        const ov = overlay;
        const t = target;
        const s = src;
        if (phase === "idle" || !ov || !t || !s) return false;
        if (phase === "flying") {
          phase = "closing";
          const host2 = ov.parentNode;
          const frame3 = (_a = ov.offsetParent) != null ? _a : host2;
          const clone = flyingClone;
          const back = srcRect;
          const land = () => {
            if (phase !== "closing") return;
            clone == null ? void 0 : clone.remove();
            restoreSrc();
            phase = "idle";
            finish();
          };
          try {
            ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOTION.move, easing: "linear" });
          } catch (e) {
          }
          const modal2 = ov.querySelector(".cn-modal--detail");
          if (modal2) modal2.style.visibility = "hidden";
          if (clone && back && host2 && frame3) {
            host2.appendChild(clone);
            const cur = clone.getBoundingClientRect();
            const w = clone.offsetWidth || cur.width;
            const h = clone.offsetHeight || cur.height;
            try {
              const fly = clone.animate(
                flyKeyframes(frame3.getBoundingClientRect(), w, h, cur, back),
                { duration: MOTION.move, easing: EASE.move }
              );
              fly.finished.then(land).catch(land);
              window.setTimeout(land, MOTION.move + 400);
            } catch (e) {
              land();
            }
          } else land();
          return true;
        }
        if (phase === "closing") {
          finish();
          return true;
        }
        phase = "closing";
        const host = ov.parentNode;
        const frame2 = (_b = ov.offsetParent) != null ? _b : host;
        const modal = (_c = ov.querySelector(".cn-modal--detail")) != null ? _c : ov;
        const or = ov.getBoundingClientRect();
        const posterR = t.getBoundingClientRect();
        const panelRadius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
        const foldInset = `inset(${Math.max(0, posterR.top - or.top)}px ${Math.max(0, or.right - posterR.right)}px ${Math.max(0, or.bottom - posterR.bottom)}px ${Math.max(0, posterR.left - or.left)}px round 8px)`;
        let handed = false;
        const handOver = () => {
          var _a2;
          if (handed || phase !== "closing") return;
          handed = true;
          const fb = frame2.getBoundingClientRect();
          const to = reinsertSrc(SE_FLIGHT);
          finish();
          if (!to) {
            phase = "idle";
            return;
          }
          const clone = spawnFlyClone(host, (_a2 = s.getAttribute("src")) != null ? _a2 : "", posterR.width, posterR.height, getComputedStyle(t).borderTopLeftRadius);
          const fly = clone.animate(
            flyKeyframes(fb, posterR.width, posterR.height, posterR, to),
            { duration: SE_FLIGHT, easing: EASE.move, fill: "forwards" }
          );
          const done = () => {
            if (taken) taken.style.visibility = "";
            clone.remove();
            phase = "idle";
          };
          fly.finished.then(done).catch(done);
        };
        ov.animate([
          { clipPath: `inset(-64px round ${panelRadius}px)`, backgroundColor: "rgba(20,16,8,.45)" },
          { clipPath: foldInset, backgroundColor: "rgba(20,16,8,0)" }
        ], { duration: SE_GROW, easing: EASE.out });
        const fold = ov.getAnimations().pop();
        if (fold) fold.finished.then(handOver).catch(handOver);
        else handOver();
        window.setTimeout(handOver, SE_GROW + 1200);
        return true;
      },
      begin(ovlEl, from) {
        overlay = ovlEl;
        borrow = from.borrow;
        target = overlay.querySelector(".cn-modal--detail .dm-poster");
        taken = from.el;
        src = from.el.querySelector(borrow === "row" ? ".s-thumb img" : ".pw img");
        boxEl = borrow === "row" ? from.el.closest(".s-list") : from.el.closest(".d-scroll, .m-scroll");
        if (!overlay || !target || !(src == null ? void 0 : src.getAttribute("src"))) {
          this.bail();
          return;
        }
        const dstImg = target.querySelector("img");
        if (!dstImg || dstImg.getAttribute("src") !== src.getAttribute("src")) {
          this.bail();
          return;
        }
        try {
          const modal = overlay.querySelector(".cn-modal--detail");
          if (!modal) {
            this.bail();
            return;
          }
          modal.classList.add("cn-modal--fly");
          modal.style.visibility = "hidden";
          phase = "flying";
          const sr = src.getBoundingClientRect();
          const tr = target.getBoundingClientRect();
          const base = overlay.getBoundingClientRect();
          if (sr.width < 8 || sr.height < 8 || tr.width < 8 || tr.height < 8) {
            this.bail();
            return;
          }
          srcRect = sr;
          extractSrc();
          const clone = spawnFlyClone(overlay, src.getAttribute("src"), tr.width, tr.height, getComputedStyle(target).borderTopLeftRadius);
          flyingClone = clone;
          const fly = clone.animate(flyKeyframes(base, tr.width, tr.height, sr, tr), { duration: SE_FLIGHT, easing: EASE.move, fill: "forwards" });
          if (overlay.parentNode) {
            const moo = new MutationObserver(() => {
              if (overlay == null ? void 0 : overlay.isConnected) return;
              moo.disconnect();
              if (phase !== "closing") restoreSrc();
            });
            moo.observe(overlay.parentNode, { childList: true });
          }
          let revealed = false;
          const reveal = () => {
            if (revealed || phase !== "flying") return;
            revealed = true;
            modal.style.visibility = "";
            try {
              const pr = modal.getBoundingClientRect();
              const t2 = target.getBoundingClientRect();
              const radius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
              modal.animate([
                { clipPath: `inset(${Math.max(0, t2.top - pr.top)}px ${Math.max(0, pr.right - t2.right)}px ${Math.max(0, pr.bottom - t2.bottom)}px ${Math.max(0, t2.left - pr.left)}px round 8px)` },
                { clipPath: `inset(-64px round ${radius}px)` }
              ], { duration: SE_GROW_OPEN, easing: EASE.out });
            } catch (e) {
            }
          };
          const land = () => {
            if (phase !== "flying") return;
            reveal();
            phase = "open";
            clone.remove();
            flyingClone = null;
          };
          fly.finished.then(land).catch(() => {
            if (phase === "flying") this.bail();
          });
        } catch (e) {
          this.bail();
        }
      },
      /** 任何一步走不下去就整体回到「没飞过」的形态，不留半藏的面板或缺一块的列表 */
      bail() {
        var _a;
        (_a = overlay == null ? void 0 : overlay.querySelector(".cn-modal--detail")) == null ? void 0 : _a.classList.remove("cn-modal--fly");
        const modal = overlay == null ? void 0 : overlay.querySelector(".cn-modal--detail");
        if (modal) modal.style.visibility = "";
        restoreSrc();
        overlay = null;
        target = null;
        src = null;
        taken = null;
        borrow = "card";
        boxEl = null;
        flyingClone = null;
        srcRect = null;
        phase = "idle";
      }
    };
  }
  function openSeriesDetail(sec, key, app, opts = {}) {
    var _a;
    const card = seriesCardByKey(key);
    if (!card) return;
    const mobile = sec.classList.contains("mob");
    const from = (_a = opts.from) != null ? _a : sec.querySelector(`.pcard[data-cinema-key="${CSS.escape(key)}"]`);
    const se = from ? createSharedFlight() : null;
    const { el, close } = ovl(sec, seriesDetailModalHtml(card, (it) => posterUrl(it, app)), { onWillClose: se == null ? void 0 : se.willClose });
    mountIcons(el);
    if (se) se.begin(el, { el: from, borrow: "card" });
    const rowItem = (row) => itemByKeyInState(row.dataset.cinemaSeasonKey);
    el.querySelectorAll(".s-row").forEach((row) => {
      row.addEventListener("click", () => {
        const it = rowItem(row);
        if (!it) return;
        openDetail(sec, it, app, { from: row, borrow: "row" });
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const it = rowItem(row);
        if (!it || !hoverCapable2()) return;
        openItemMenu(e.clientX, e.clientY, toItemActions(deferClose(itemActions(it, sec, app), close)), true, MENU_SKIN);
        resetItemMenuClickGuard();
      });
      if (mobile) {
        longPress(row, () => {
          const it = rowItem(row);
          if (it) openSheet(sec, itemSheetTarget(it, sec, app), close);
        });
      }
    });
  }
  var ybOvl = null;
  var ybHandle = null;
  var ybSync = null;
  var ybRo = null;
  function fitYbBox(box, panel) {
    const r = panel == null ? void 0 : panel.getBoundingClientRect();
    if (!panel || !r || r.width < 40 || r.height < 40) return;
    box.style.left = `${Math.round(r.left)}px`;
    box.style.top = `${Math.round(r.top)}px`;
    box.style.width = `${Math.round(r.width)}px`;
    box.style.height = `${Math.round(r.height)}px`;
    const base = Math.max(12, Math.min(19, 12 * Math.min(r.width / 900, r.height / 620)));
    box.style.fontSize = `${base.toFixed(2)}px`;
    box.style.borderRadius = getComputedStyle(panel).borderTopLeftRadius || "";
  }
  function openYearbookOverlay(app) {
    var _a, _b;
    if (ybOvl == null ? void 0 : ybOvl.isConnected) {
      const box2 = ybOvl.querySelector(".bz-yb-box");
      if (box2) {
        box2.classList.remove("is-nudge");
        void box2.offsetWidth;
        box2.classList.add("is-nudge");
      }
      return;
    }
    rebuildItems(app);
    const data = deriveYb(M.items);
    const panel = (_b = (_a = M.currentOverlay) == null ? void 0 : _a.querySelector("[data-cinema-root]")) != null ? _b : null;
    const ovl2 = document.createElement("div");
    ovl2.className = "bz-yb";
    ovl2.innerHTML = `
    <div class="bz-yb-box">
      ${isMobileEnv() ? `<button class="bz-yb-close" data-yb-close title="关闭观影分析" aria-label="关闭观影分析">${iconSpan(ICON.close)}</button>` : ""}
      <div class="bz-yb-scroll">${data.total ? yearbookHtml(data, (it) => posterUrl(it, app)) : `<div class="bz-yb-blank"><p>影院还是空的——先添一部，这一页才有得放。</p><button class="bz-btn" data-cinema-analysis-add type="button">添加影视</button></div>`}</div>
    </div>`;
    document.body.appendChild(ovl2);
    mountIcons(ovl2);
    topifyZ(ovl2);
    ybOvl = ovl2;
    const box = ovl2.querySelector(".bz-yb-box");
    if (box) {
      fitYbBox(box, panel);
      ybSync = () => fitYbBox(box, panel);
      window.addEventListener("resize", ybSync);
      if (typeof ResizeObserver === "function" && panel) {
        ybRo = new ResizeObserver(ybSync);
        ybRo.observe(panel);
      }
    }
    ovl2.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("[data-cinema-analysis-add]")) {
        closeYearbookOverlay();
        openAddModalDirect(app);
        return;
      }
      if (t.closest("[data-yb-close]")) {
        closeYearbookOverlay();
        return;
      }
      if (!t.closest(".bz-yb-box")) closeYearbookOverlay();
    });
    registerPanelEsc("cinema-yearbook", () => !!(ybOvl == null ? void 0 : ybOvl.isConnected), closeYearbookOverlay);
    if (data.total) ybHandle = bindYearbook(ovl2, data);
  }
  function closeYearbookOverlay() {
    ybHandle == null ? void 0 : ybHandle.stop();
    ybHandle = null;
    if (ybSync) {
      window.removeEventListener("resize", ybSync);
      ybSync = null;
    }
    ybRo == null ? void 0 : ybRo.disconnect();
    ybRo = null;
    unregisterPanelEsc("cinema-yearbook");
    ybOvl == null ? void 0 : ybOvl.remove();
    ybOvl = null;
  }
  var DUP_NAME_HINT = "已存在同名影视";
  var DUP_NAME_HINT_FULL = `${DUP_NAME_HINT}，请换个名称`;
  function isDuplicateName(name, selfName) {
    return name !== (selfName != null ? selfName : "") && M.items.some((x) => x.name === name);
  }
  function openForm(sec, item, app, presetSt) {
    var _a, _b, _c;
    const editing = !!item;
    const initTag = item ? item.typeTag : "电影";
    const initSt = presetSt != null ? presetSt : item ? statusText(item.status) : "想看";
    const ratingVal = item && item.rating && item.rating > 0 ? item.rating : DEFAULT_RATING;
    const { el, close } = ovl(sec, formModalHtml({
      editing,
      name: item ? item.name : "",
      typeTag: initTag,
      stText: initSt,
      rating: ratingVal,
      review: item ? (_a = item.review) != null ? _a : "" : ""
    }));
    mountIcons(el);
    if (!editing) el.classList.add("cn-ovl--flip");
    const cur = { tag: initTag, st: initSt };
    let phase = editing ? "parsed" : "idle";
    let classifying = false;
    let parsed = null;
    let userPickedTag = false;
    const nameInput = el.querySelector(".j-name");
    const parseBtn = el.querySelector(".j-parse");
    const saveBtn = el.querySelector(".j-save");
    const flipEl = el.querySelector(".j-flip");
    const backSlot = el.querySelector(".j-back");
    const refreshFormState = () => {
      var _a2;
      const name = (_a2 = nameInput == null ? void 0 : nameInput.value.trim()) != null ? _a2 : "";
      const dup = !!name && isDuplicateName(name, item == null ? void 0 : item.name);
      if (nameInput) nameInput.classList.toggle("is-dup", dup);
      if (parseBtn) {
        const busy = phase === "parsing";
        parseBtn.disabled = dup || busy;
        parseBtn.classList.toggle("is-parsing", busy);
        const txt = parseBtn.querySelector(".j-parse-text");
        if (txt) txt.textContent = dup ? DUP_NAME_HINT : busy ? "解析中" : "解析";
      }
      if (saveBtn) {
        saveBtn.disabled = dup || phase === "parsing" || classifying;
        saveBtn.textContent = dup ? DUP_NAME_HINT : "保存";
      }
      el.querySelectorAll("[data-f-tag]").forEach((x) => x.classList.toggle("is-scanning", phase === "parsing"));
    };
    const applyTagOn = () => {
      el.querySelectorAll("[data-f-tag]").forEach((b) => b.classList.toggle("is-on", b.dataset.fTag === cur.tag));
    };
    const applyStOn = () => {
      el.querySelectorAll("[data-f-st]").forEach((b) => b.classList.toggle("is-on", b.dataset.fSt === cur.st));
      const show = cur.st === "已看";
      el.querySelectorAll(".j-rating").forEach((x) => {
        x.style.display = show ? "" : "none";
      });
      el.querySelectorAll(".j-review").forEach((x) => {
        x.style.display = show ? "" : "none";
      });
    };
    const flipToBack = () => {
      if (!flipEl) return;
      void flipEl.offsetHeight;
      const start = () => {
        if (!el.isConnected) return;
        flipEl.classList.add("is-flipped", "is-flipping");
        const clear = () => flipEl.classList.remove("is-flipping");
        flipEl.addEventListener("animationend", clear, { once: true });
        window.setTimeout(clear, 1200);
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(start);
      else window.setTimeout(start, 16);
    };
    const previewDataOf = (q) => {
      var _a2, _b2, _c2, _d, _e, _f, _g, _h;
      if (!q) return null;
      const az = q.apizero;
      return {
        posterUrl: "",
        title: q.title || (nameInput == null ? void 0 : nameInput.value.trim()) || "",
        typeTag: cur.tag,
        genre: (az == null ? void 0 : az.genre) ? normalizeListValue(az.genre) : "",
        director: (az == null ? void 0 : az.director) ? normalizeListValue(az.director) : (_b2 = (_a2 = q.celebrities) == null ? void 0 : _a2.directors) != null ? _b2 : "",
        actors: (az == null ? void 0 : az.actor) ? normalizeListValue(az.actor) : (_d = (_c2 = q.celebrities) == null ? void 0 : _c2.casts) != null ? _d : "",
        region: (az == null ? void 0 : az.area) ? normalizeListValue(az.area) : "",
        releaseDate: (_e = az == null ? void 0 : az.year) != null ? _e : "",
        duration: (_f = az == null ? void 0 : az.duration) != null ? _f : "",
        doubanRating: (_g = az == null ? void 0 : az.score) != null ? _g : "",
        doubanUrl: q.detailUrl,
        hotComment: (_h = az == null ? void 0 : az.shortComment) != null ? _h : ""
      };
    };
    let previewPosterRel = null;
    let posterKicked = false;
    const applyPreviewPoster = (rel) => {
      const box = backSlot == null ? void 0 : backSlot.querySelector(".dm-poster");
      if (!box) return;
      const f = app.vault.getAbstractFileByPath(rel);
      if (!(f instanceof TFile)) return;
      let img = box.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.alt = "";
        img.addEventListener("load", () => box.classList.add("is-ready"), { once: true });
        img.addEventListener("error", () => img == null ? void 0 : img.remove(), { once: true });
        box.appendChild(img);
      }
      img.src = app.vault.getResourcePath(f);
    };
    const ensurePreviewPoster = async (url) => {
      var _a2;
      if (!url || posterKicked) return;
      posterKicked = true;
      try {
        const rel = await downloadPreviewPoster(app, (_a2 = nameInput == null ? void 0 : nameInput.value.trim()) != null ? _a2 : "", url);
        if (!rel || !el.isConnected) return;
        previewPosterRel = rel;
        applyPreviewPoster(rel);
      } catch (e) {
      }
    };
    async function runParse() {
      var _a2, _b2, _c2, _d, _e, _f;
      const name = (_a2 = nameInput == null ? void 0 : nameInput.value.trim()) != null ? _a2 : "";
      if (!name) {
        notice("请输入名称", "warning");
        return;
      }
      if (hasIllegalNameChar(name)) {
        notice(`${ILLEGAL_NAME_HINT}，请修改`, "error");
        return;
      }
      phase = "parsing";
      refreshFormState();
      const q = await queryDoubanForPreview(app, name);
      if (!q.ok) {
        phase = "idle";
        refreshFormState();
        notice(
          q.reason === "blocked" ? "豆瓣搜索被风控，稍后再试" : q.reason === "notfound" ? "豆瓣没有找到这部影视" : "网络不畅，未能获取豆瓣信息",
          "warning"
        );
        return;
      }
      parsed = q.data;
      phase = "parsed";
      classifying = true;
      renderBack();
      flipToBack();
      refreshFormState();
      void ensurePreviewPoster(q.data.posterUrl);
      try {
        const az = q.data.apizero;
        const mediaType = (_c2 = (_b2 = q.data.celebrities) == null ? void 0 : _b2.mediaType) != null ? _c2 : null;
        const decided = await decideCinemaType({
          title: q.data.title,
          isTv: az ? az.isTv : mediaType ? mediaType === "tv" : null,
          area: (_d = az == null ? void 0 : az.area) != null ? _d : null,
          genre: (_e = az == null ? void 0 : az.genre) != null ? _e : null,
          year: (_f = az == null ? void 0 : az.year) != null ? _f : null
        });
        if (decided && !userPickedTag) cur.tag = decided;
      } catch (e) {
      }
      classifying = false;
      updateBadges();
      refreshFormState();
    }
    const watchDateOf = () => {
      const stChanged = !editing || !item || item.status !== (cur.st === "想看" ? STATUS_WANT : cur.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED);
      return stChanged ? localNow() : item.watchDate || localNow();
    };
    function renderBack() {
      var _a2, _b2, _c2, _d;
      if (!backSlot) return;
      const watched = cur.st === "已看";
      backSlot.innerHTML = formBackHtml(previewDataOf(parsed), {
        typeTag: cur.tag,
        stText: cur.st,
        classifying,
        rating: watched ? Number((_b2 = (_a2 = el.querySelector(".j-range")) == null ? void 0 : _a2.value) != null ? _b2 : 0) : 0,
        review: watched ? (_d = (_c2 = el.querySelector(".j-review-t")) == null ? void 0 : _c2.value) != null ? _d : "" : "",
        watchDate: watched ? watchDateOf() : ""
      });
      applyTagOn();
      applyStOn();
    }
    const closePickLists = () => {
      el.querySelectorAll("[data-pick-list]").forEach((l) => l.classList.remove("is-open"));
    };
    const updateBadges = () => {
      const row = backSlot == null ? void 0 : backSlot.querySelector(".dm-badges");
      if (row) row.innerHTML = formTagChipHtml(cur.tag) + formStChipHtml(cur.st);
      applyTagOn();
      applyStOn();
    };
    nameInput == null ? void 0 : nameInput.addEventListener("input", refreshFormState);
    refreshFormState();
    applyStOn();
    el.addEventListener("click", (e) => {
      var _a2, _b2;
      const t = e.target;
      const pick = t.closest("[data-pick]");
      if (pick) {
        const key = pick.dataset.pick;
        const target = el.querySelector(`[data-pick-list="${key}"]`);
        const willOpen = !!target && !target.classList.contains("is-open");
        closePickLists();
        if (target && willOpen) target.classList.add("is-open");
        return;
      }
      const tagBtn = t.closest("[data-f-tag]");
      if (tagBtn) {
        cur.tag = (_a2 = tagBtn.dataset.fTag) != null ? _a2 : cur.tag;
        userPickedTag = true;
        closePickLists();
        updateBadges();
        return;
      }
      const stBtn = t.closest("[data-f-st]");
      if (stBtn) {
        cur.st = (_b2 = stBtn.dataset.fSt) != null ? _b2 : cur.st;
        closePickLists();
        updateBadges();
      }
    });
    bindFormSubmit(el, () => {
      var _a2;
      if (phase === "idle" && !editing) {
        void runParse();
        return;
      }
      (_a2 = el.querySelector(".j-save")) == null ? void 0 : _a2.click();
    });
    if (!isMobileEnv()) (_b = el.querySelector(".j-name")) == null ? void 0 : _b.focus();
    parseBtn == null ? void 0 : parseBtn.addEventListener("click", () => {
      void runParse();
    });
    (_c = el.querySelector(".j-save")) == null ? void 0 : _c.addEventListener("click", () => {
      var _a2;
      if (phase === "parsing" || classifying) return;
      const name = el.querySelector(".j-name").value.trim();
      if (!name) {
        notice("请输入名称", "warning");
        return;
      }
      if (isDuplicateName(name, item == null ? void 0 : item.name)) {
        notice(DUP_NAME_HINT_FULL, "warning");
        return;
      }
      const date = watchDateOf();
      const ratingBox = el.querySelector(".j-range");
      const rating = cur.st === "已看" ? ratingBox ? parseFloat(ratingBox.value) : DEFAULT_RATING : cur.st === "在看" ? 0 : -1;
      const reviewBox = el.querySelector(".j-review-t");
      const review = reviewBox ? reviewBox.value.trim() : editing && item ? (_a2 = item.review) != null ? _a2 : "" : "";
      if (editing && item) {
        void saveEdit(item, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, { el, close });
      } else {
        void saveNew({ name, tag: cur.tag, st: cur.st, rating, date, review, douban: parsed, posterRel: previewPosterRel }, app, { el, close });
      }
    });
  }
  async function saveNew(p, app, form) {
    var _a, _b, _c;
    if (hasIllegalNameChar(p.name)) {
      notice(`${ILLEGAL_NAME_HINT}，请修改`, "error");
      return;
    }
    const group = (_a = getGroupForTag(p.tag)) != null ? _a : "其他";
    const st = p.st === "想看" ? STATUS_WANT : p.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
    const it = { file: null, name: p.name, typeTag: p.tag, group, status: st, rating: p.rating, watchDate: p.date, review: p.review, poster: null, genre: null, director: null, actors: null, region: null, year: null, releaseDate: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null, hotComment: null };
    try {
      if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
        notice(DUP_NAME_HINT_FULL, "warning");
        return;
      }
      M.items.unshift(it);
      const posterRel = (_c = p.posterRel) != null ? _c : ((_b = p.douban) == null ? void 0 : _b.posterUrl) ? await downloadPreviewPoster(app, p.name, p.douban.posterUrl) : null;
      await persistItem(it, app, void 0, p.douban, posterRel);
      if (posterRel) it.poster = posterRel;
      emitDomainEvent("movie", { kind: "created", name: p.name, status: st === STATUS_WANT ? "want" : st === STATUS_WATCHING ? "watching" : "watched", rating: p.rating, review: p.review || null });
      if (it.file && !posterRel) enqueueDoubanFetch(it.file, it.name);
      notice(`已添加「${p.name}」`, "success");
      markCardFlash(itemKey(it), p.rating !== null && p.rating > 0);
      renderAll(app);
      foldOverlayToCard(form, itemKey(it));
    } catch (e) {
      if (!it.file) {
        const i = M.items.indexOf(it);
        if (i >= 0) M.items.splice(i, 1);
        renderAll(app);
      }
      notifySaveError(e);
      console.error(e);
    }
  }
  async function saveEdit(item, p, app, form) {
    var _a, _b, _c;
    const group = (_a = getGroupForTag(p.tag)) != null ? _a : "其他";
    const st = p.st === "想看" ? STATUS_WANT : p.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
    const prev = { name: item.name, typeTag: item.typeTag, group: item.group, status: item.status, rating: item.rating, watchDate: item.watchDate, review: item.review, file: item.file, filePath: (_c = (_b = item.file) == null ? void 0 : _b.path) != null ? _c : null };
    if (p.name !== item.name) {
      if (hasIllegalNameChar(p.name)) {
        notice(`${ILLEGAL_NAME_HINT}，请修改`, "error");
        return;
      }
      if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
        notice(DUP_NAME_HINT_FULL, "warning");
        return;
      }
    }
    item.name = p.name;
    item.typeTag = p.tag;
    item.group = group;
    item.status = st;
    item.rating = p.rating;
    item.watchDate = p.date;
    item.review = p.review;
    try {
      await persistItem(item, app, { prevName: prev.name, prevTag: prev.typeTag });
      const fromSt = prev.status === STATUS_WANT ? "want" : prev.status === STATUS_WATCHING ? "watching" : "watched";
      if (st !== prev.status) {
        const toSt = st === STATUS_WANT ? "want" : st === STATUS_WATCHING ? "watching" : "watched";
        emitDomainEvent("movie", { kind: "status", name: item.name, from: fromSt, to: toSt });
      }
      const prevRating = prev.rating && prev.rating > 0 ? prev.rating : null;
      if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
        emitDomainEvent("movie", { kind: "rated", name: item.name, fromRating: prevRating, toRating: item.rating });
      }
      const prevReview = prev.review || null;
      const toReview = item.review || null;
      if (prevReview !== toReview) {
        emitDomainEvent("movie", { kind: "review", name: item.name, fromReview: prevReview, toReview });
      }
      notice(`已保存「${p.name}」`, "success");
      markCardFlash(itemKey(item), item.rating !== null && item.rating > 0 && item.rating !== prev.rating);
      renderAll(app);
      foldOverlayToCard(form, itemKey(item));
    } catch (e) {
      if (item.file && prev.filePath && item.file.path !== prev.filePath) {
        try {
          await app.fileManager.renameFile(item.file, prev.filePath);
        } catch (re) {
          console.error("回滚影视笔记改名失败:", re);
          renderAll(app);
        }
      }
      Object.assign(item, prev);
      notifySaveError(e);
      console.error(e);
    }
  }
  function openConfirm(item, app) {
    void openFlowDialog({
      title: "删除影视",
      // message 经 core escapeHtml（片名注入防护），\n 渲染为 <br> 分行
      message: `确定删除「${item.name}」吗？
将移入系统回收站，可在回收站恢复`,
      // 流程框挂 document.body、不在面板树内：cn-skin 取午夜场调色板（菜单/抽屉皮肤同一通道），
      // bz-cinema-flow-dialog = 本域确认框专属类；删除是危险主动作 → core 另挂 bz-flow-dialog--danger
      className: "cn-skin bz-cinema-flow-dialog",
      actions: [
        { label: "取消", value: "cancel" },
        { label: "删除", value: "ok", cta: true, danger: true }
      ]
    }).then(async (v) => {
      if (v !== "ok") return;
      if (item.file) {
        try {
          await app.vault.trash(item.file, true);
        } catch (e) {
          console.error("删除影视笔记失败:", e);
          notice("删除失败：文件可能被占用，请重试", "error");
          return;
        }
        dequeueDoubanFetch(item.file.path);
      }
      const idx = M.items.indexOf(item);
      if (idx > -1) M.items.splice(idx, 1);
      emitDomainEvent("movie", { kind: "deleted", name: item.name });
      notice(`已删除「${item.name}」`, "success");
      renderAll(app);
    });
  }
  function aiPrefLine() {
    const p = buildTasteProfile();
    const parts = [p.groups[0] || "", p.genres[0] || "", p.directors[0] || "", p.actors[0] || ""].filter(Boolean);
    return parts.length ? parts.join(" · ") : "暂无";
  }
  function aiInput() {
    return {
      running: M.aiRunning,
      waitMsg: M.aiWaitMsg,
      error: M.aiError,
      results: M.aiResult,
      pref: aiPrefLine(),
      inLibrary: (name) => M.items.some((it) => it.name === name)
    };
  }
  function midnightInput(app) {
    const merge = mergeSeasonsOn();
    const onList = M.view === "list";
    return {
      allCards: mergeSeasonCards(M.items, merge),
      cards: mergeSeasonCards(getDisplayItems(), merge),
      view: {
        view: M.view,
        typeFilter: M.typeFilter,
        statusFilter: M.statusFilter,
        sortMode: M.sortMode,
        searchKeyword: M.searchKeyword
      },
      cols: gridColumns(),
      title: listTitle(),
      aiHtml: onList ? "" : aiPageHtml(aiInput()),
      aiCount: M.aiResult && M.aiResult.length ? M.aiResult.length : null,
      poster: (it) => posterUrl(it, app),
      fetching: (it) => {
        var _a;
        return isFetching((_a = it.file) == null ? void 0 : _a.path);
      }
    };
  }
  function onSearchInput(app, sec, isMob, raw) {
    const clearBtn = sec.querySelector("[data-cinema-clear]");
    if (clearBtn) clearBtn.hidden = !raw.trim();
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = setTimeout(() => {
      M.searchKeyword = raw.trim();
      M.view = "list";
      if (isMob) {
        renderAll(app);
        const el = sec.querySelector(".j-mq");
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      } else {
        refreshDeskList(app, sec);
      }
    }, 300);
  }
  function clearSearchKeyword(app, sec, isMob) {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    M.searchDebounceTimer = null;
    M.searchKeyword = "";
    renderAll(app);
    const el = sec.querySelector(isMob ? ".j-mq" : ".j-q");
    if (el) {
      el.value = "";
      el.focus();
    }
    const clearBtn = sec.querySelector("[data-cinema-clear]");
    if (clearBtn) clearBtn.hidden = true;
  }
  function refreshDeskList(app, sec) {
    const view = sec.querySelector(".j-view");
    if (!view) {
      renderAll(app);
      return;
    }
    const body = view.querySelector(".d-scroll");
    const head = view.querySelector(".d-head");
    const list = getDisplayItems();
    if (!body || !head || !list.length) {
      renderAll(app);
      const el = sec.querySelector(".j-q");
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
      return;
    }
    const cards = mergeSeasonCards(list, mergeSeasonsOn());
    const cnt = head.querySelector(".j-cnt");
    if (cnt) cnt.textContent = `· ${cards.length} 部`;
    const grid = body.querySelector(".grid");
    if (grid) grid.innerHTML = cards.map((e) => cardEntryHtml(e, app)).join("");
    mountIcons(sec);
  }
  function hoverCapable2() {
    try {
      return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (e) {
      return false;
    }
  }
  var ARROW_DIR = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  };
  function nearestCardInDir(cur, dx, dy) {
    const grid = cur.closest(".grid, .m-grid");
    if (!grid) return null;
    const cr = cur.getBoundingClientRect();
    if (!cr.width) return null;
    const cx = cr.left + cr.width / 2;
    const cy = cr.top + cr.height / 2;
    let best = null;
    let bestScore = Infinity;
    grid.querySelectorAll(".pcard[data-cinema-key]").forEach((el) => {
      if (el === cur) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const px = r.left + r.width / 2;
      const py = r.top + r.height / 2;
      const ahead = (px - cx) * dx + (py - cy) * dy;
      if (ahead <= 1) return;
      const cross = Math.abs((px - cx) * dy) + Math.abs((py - cy) * dx);
      const score = ahead + cross * 2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best;
  }
  function bindMidnight(sec, app, hoverable = hoverCapable2()) {
    const nearestSeasonDot = (target, e) => {
      var _a;
      const el = target;
      const box = (_a = el == null ? void 0 : el.closest) == null ? void 0 : _a.call(el, ".season-dots");
      if (!box) return null;
      const direct = el.closest(".season-dots i");
      if (direct) return direct;
      let best = null;
      let bestDist = Infinity;
      box.querySelectorAll("i").forEach((d) => {
        const r = d.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      });
      return best;
    };
    let peekedDot = null;
    const endPeek = () => {
      if (!peekedDot) return;
      restFace(peekedDot);
      peekedDot = null;
    };
    const peekNearest = (e) => {
      const dot = nearestSeasonDot(e.target, e);
      if (dot === peekedDot) return;
      peekedDot = dot && peekSeasonDot(dot, app) ? dot : null;
    };
    if (hoverable) {
      sec.addEventListener("mouseover", peekNearest);
      sec.addEventListener("mousemove", peekNearest);
      sec.addEventListener("mouseout", (e) => {
        var _a;
        const to = e.relatedTarget;
        if ((_a = to == null ? void 0 : to.closest) == null ? void 0 : _a.call(to, ".season-dots")) return;
        endPeek();
      });
      bindCardTilt(sec);
    }
    sec.addEventListener("keydown", (e) => {
      var _a, _b, _c, _d;
      const dir = ARROW_DIR[e.key];
      if (dir && !e.isComposing) {
        const cur = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".pcard[data-cinema-key]");
        const next = cur ? nearestCardInDir(cur, dir[0], dir[1]) : null;
        if (next) {
          e.preventDefault();
          next.focus();
          next.scrollIntoView({ block: "nearest", inline: "nearest" });
          return;
        }
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const cardEl = (_d = (_c = e.target) == null ? void 0 : _c.closest) == null ? void 0 : _d.call(_c, ".pcard[data-cinema-key]");
      if (!cardEl) return;
      e.preventDefault();
      endPeek();
      const key = cardEl.dataset.cinemaKey;
      if (isSeriesKey(key)) openSeriesDetail(sec, key, app, { from: cardEl });
      else {
        const it = itemByKeyInState(key);
        if (it) openDetail(sec, it, app, { from: cardEl });
      }
    });
    sec.addEventListener("click", (e) => {
      var _a, _b, _c, _d;
      const t = e.target;
      const aiBtn = t.closest("[data-cinema-ai-start],[data-rec-add]");
      if (aiBtn) {
        if (aiBtn.hasAttribute("data-rec-add")) {
          if (aiBtn.hasAttribute("disabled")) return;
          const rec = (_a = M.aiResult) == null ? void 0 : _a[Number(aiBtn.dataset.recAdd)];
          if (rec) void quickAddWant(app, rec.title || rec.name || "", rec.type || "");
        } else {
          if (M.aiBase) void runSimilarRecommend(M.aiBase, app);
          else void runAIRecommend(app);
        }
        return;
      }
      const clear = t.closest("[data-cinema-clear]");
      if (clear) {
        M.typeFilter = null;
        M.statusFilter = null;
        M.searchKeyword = "";
        const inp = (_b = clear.closest("label")) == null ? void 0 : _b.querySelector("input");
        if (inp) inp.value = "";
        clear.hidden = true;
        renderAll(app);
        return;
      }
      const tool = t.closest(".j-tool");
      if (tool && tool.dataset.tool) {
        M.view = M.view === tool.dataset.tool ? "list" : tool.dataset.tool;
        renderAll(app);
        return;
      }
      if (t.closest("[data-film-open]")) {
        openYearbookOverlay(app);
        return;
      }
      const mb = t.closest(".j-mai,.j-mstat,.j-mclose");
      if (mb) {
        if (mb.classList.contains("j-mclose")) closeOverlay();
        else if (mb.classList.contains("j-mstat")) openYearbookOverlay(app);
        else {
          M.view = M.view === "ai" ? "list" : "ai";
          renderAll(app);
        }
        return;
      }
      const back = t.closest(".j-back");
      if (back) {
        M.view = "list";
        renderAll(app);
        return;
      }
      const railBtn = t.closest("[data-g],[data-s]");
      if (railBtn) {
        M.view = "list";
        if (railBtn.dataset.g) {
          M.typeFilter = railBtn.dataset.g === "全部" ? null : railBtn.dataset.g;
          M.statusFilter = null;
        } else {
          const s = (_c = railBtn.dataset.s) != null ? _c : null;
          M.statusFilter = M.statusFilter === s ? null : s;
        }
        renderAll(app);
        return;
      }
      const chip = t.closest(".chip");
      if (chip) {
        M.view = "list";
        if (chip.dataset.c) {
          M.typeFilter = chip.dataset.c === "all" ? null : chip.dataset.c;
          M.statusFilter = null;
        } else {
          const s = (_d = chip.dataset.s) != null ? _d : null;
          M.statusFilter = M.statusFilter === s ? null : s;
        }
        renderAll(app);
        return;
      }
      const sortBtn = t.closest(".j-sort button");
      if (sortBtn && sortBtn.dataset.k) {
        M.sortMode = sortBtn.dataset.k;
        renderAll(app);
        return;
      }
      const add = t.closest("[data-cinema-analysis-add],[data-cinema-add]");
      if (add) {
        openForm(sec, null, app);
        return;
      }
      const cardEl = t.closest(".pcard");
      if (cardEl) {
        endPeek();
        const key = cardEl.dataset.cinemaKey;
        if (isSeriesKey(key)) openSeriesDetail(sec, key, app, { from: cardEl });
        else {
          const it = itemByKeyInState(key);
          if (it) openDetail(sec, it, app, { from: cardEl });
        }
      }
    });
    sec.addEventListener("contextmenu", (e) => {
      if (!hoverCapable2()) return;
      const cardEl = e.target.closest(".pcard");
      if (!cardEl) return;
      e.preventDefault();
      const key = cardEl.dataset.cinemaKey;
      if (isSeriesKey(key)) {
        openItemMenu(e.clientX, e.clientY, toItemActions([seriesAllAct(sec, key, app)]), true, MENU_SKIN);
        resetItemMenuClickGuard();
        return;
      }
      const it = itemByKeyInState(key);
      if (!it) return;
      openItemMenu(e.clientX, e.clientY, toItemActions(itemActions(it, sec, app)), true, MENU_SKIN);
      resetItemMenuClickGuard();
    });
  }
  function createOverlay(app) {
    const overlay = document.createElement("div");
    overlay.className = "bz-panel-overlay";
    const mobile = isMobileEnv();
    overlay.innerHTML = mobile ? midnightMobHtml() : midnightDeskHtml();
    document.body.appendChild(overlay);
    topifyZ(overlay);
    M.currentOverlay = overlay;
    M.renderFn = () => renderSoft(app);
    const root = overlay.querySelector("[data-cinema-root]");
    if (!root) return;
    trapPanelFocus(root);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    bindMidnight(root, app);
    root.addEventListener("input", (e) => {
      M.lastInputAt = Date.now();
      const t = e.target;
      if (t.classList.contains("j-q") || t.classList.contains("j-mq")) {
        onSearchInput(app, root, t.classList.contains("j-mq"), t.value);
      } else if (t.classList.contains("j-range")) {
        const out = root.querySelector(".j-rval");
        const r = Number(t.value);
        if (out) out.textContent = r.toFixed(1);
        updateFormStars(t, r);
      }
    });
    root.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || e.isComposing || e.defaultPrevented) return;
      const t = e.target;
      if (!(t.classList.contains("j-q") || t.classList.contains("j-mq"))) return;
      if (!M.searchKeyword) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      clearSearchKeyword(app, root, t.classList.contains("j-mq"));
    });
    rebuildItems(app);
    renderAll(app);
  }
  var TYPING_GUARD_MS = 400;
  var SOFT_RENDER_DELAY_MS = 400;
  var softRenderTimer = null;
  function isTextField(el) {
    if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
    return !/^(range|checkbox|radio|button|submit|reset|file|color|image)$/i.test(el.type);
  }
  function focusSelector(el) {
    const cls = Array.from(el.classList).filter((c) => /^[A-Za-z][\w-]*$/.test(c));
    return cls.length ? `${el.tagName.toLowerCase()}.${cls.join(".")}` : null;
  }
  function snapshotFocus(root) {
    const el = document.activeElement;
    if (!isTextField(el) || !root.contains(el)) return null;
    const sel = focusSelector(el);
    if (!sel) return null;
    let start = null;
    let end = null;
    try {
      start = el.selectionStart;
      end = el.selectionEnd;
    } catch (e) {
    }
    return { sel, value: el.value, start, end };
  }
  function restoreFocus(root, snap) {
    if (!snap) return;
    const el = root.querySelector(snap.sel);
    if (!isTextField(el)) return;
    if (el.value !== snap.value) el.value = snap.value;
    el.focus();
    if (snap.start !== null && snap.end !== null) {
      try {
        el.setSelectionRange(snap.start, snap.end);
      } catch (e) {
      }
    }
  }
  function isTyping(root) {
    if (!M.lastInputAt || Date.now() - M.lastInputAt >= TYPING_GUARD_MS) return false;
    return isTextField(document.activeElement) && root.contains(document.activeElement);
  }
  function clearSoftRender() {
    if (softRenderTimer) {
      clearTimeout(softRenderTimer);
      softRenderTimer = null;
    }
  }
  function renderSoft(app) {
    const overlay = M.currentOverlay;
    if (!overlay) return;
    const root = overlay.querySelector("[data-cinema-root]");
    if (!root) return;
    if (isTyping(root)) {
      if (softRenderTimer) clearTimeout(softRenderTimer);
      softRenderTimer = setTimeout(() => {
        softRenderTimer = null;
        renderAll(app);
      }, SOFT_RENDER_DELAY_MS);
      return;
    }
    renderAll(app);
  }
  var PILL_TARGETS = [
    { box: ".d-rail", item: ".rail-item", keys: ["g", "s", "tool", "k"], clip: ".rail-sec" },
    { box: ".j-sort", item: "button", keys: ["k"] }
  ];
  function updateFormStars(range, rating) {
    var _a, _b;
    const box = (_a = range.closest(".f-range-row")) == null ? void 0 : _a.querySelector(".j-stars");
    if (!box) return;
    const lit = starsLit(rating);
    const before = Number((_b = box.dataset.lit) != null ? _b : "-1");
    if (lit === before) return;
    box.dataset.lit = String(lit);
    box.innerHTML = starsHtml(rating);
    if (before < 0 || lit <= before) return;
    [...box.querySelectorAll("i.is-on")].slice(before).forEach((el) => {
      if (typeof el.animate !== "function") return;
      try {
        el.animate([{ transform: "scale(1.45)" }, { transform: "none" }], { duration: MOTION.fast, easing: EASE.out });
      } catch (e) {
      }
    });
  }
  var pendingFlash = null;
  function markCardFlash(key, stars = false) {
    pendingFlash = { key, stars };
  }
  function flushCardFlash(root) {
    const p = pendingFlash;
    pendingFlash = null;
    if (!p) return;
    const card = root.querySelector(`.pcard[data-cinema-key="${CSS.escape(p.key)}"]`);
    const pw = card == null ? void 0 : card.querySelector(".pw");
    if (!card || !pw) return;
    if (typeof pw.animate === "function") {
      try {
        pw.animate([
          { boxShadow: "0 0 0 0 rgba(224,170,75,0)" },
          { boxShadow: "0 0 0 3px rgba(224,170,75,.55)" },
          { boxShadow: "0 0 0 0 rgba(224,170,75,0)" }
        ], { duration: MOTION.impulse, easing: EASE.out });
      } catch (e) {
      }
    }
    if (!p.stars) return;
    card.querySelectorAll(".pstars i.is-on").forEach((el, i) => {
      if (typeof el.animate !== "function") return;
      try {
        el.animate(
          [{ opacity: 0.2, transform: "scale(.7)" }, { opacity: 1, transform: "none" }],
          { duration: MOTION.move, delay: i * STAGGER, easing: EASE.out, fill: "backwards" }
        );
      } catch (e) {
      }
    });
  }
  function foldOverlayToCard(form, key) {
    var _a, _b;
    const { el, close } = form;
    const card = (_a = M.currentOverlay) == null ? void 0 : _a.querySelector(`.pcard[data-cinema-key="${CSS.escape(key)}"]`);
    const modal = el.querySelector(".cn-modal");
    const r = (_b = card == null ? void 0 : card.querySelector(".pw")) == null ? void 0 : _b.getBoundingClientRect();
    if (!modal || !r || r.width < 8 || typeof modal.animate !== "function") {
      close();
      return;
    }
    const o = el.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(modal).borderTopLeftRadius) || 12;
    const inset = `inset(${Math.max(0, r.top - o.top)}px ${Math.max(0, o.right - r.right)}px ${Math.max(0, o.bottom - r.bottom)}px ${Math.max(0, r.left - o.left)}px round 8px)`;
    try {
      const a = el.animate([
        { clipPath: `inset(-64px round ${radius}px)`, backgroundColor: "rgba(20,16,8,.45)" },
        { clipPath: inset, backgroundColor: "rgba(20,16,8,0)" }
      ], { duration: MOTION.base, easing: EASE.out });
      const done = () => close();
      a.finished.then(done).catch(done);
      window.setTimeout(done, MOTION.base + 400);
    } catch (e) {
      close();
    }
  }
  function measureGridCards(root) {
    const out = /* @__PURE__ */ new Map();
    root.querySelectorAll(".pcard[data-cinema-key]").forEach((el) => {
      var _a, _b;
      const key = el.dataset.cinemaKey;
      if (!key) return;
      out.set(key, { rect: el.getBoundingClientRect(), src: (_b = (_a = el.querySelector(".pw img")) == null ? void 0 : _a.getAttribute("src")) != null ? _b : null });
    });
    return out;
  }
  var GHOST_MAX = 40;
  var ENTER_MAX = 12;
  var lastViewIdentity = null;
  var viewIdentity = () => {
    var _a, _b;
    return [M.view, (_a = M.typeFilter) != null ? _a : "", (_b = M.statusFilter) != null ? _b : "", M.sortMode, M.searchKeyword].join("|");
  };
  function playGridMotion(root, before) {
    var _a;
    const identity = viewIdentity();
    const identityChanged = identity !== lastViewIdentity;
    lastViewIdentity = identity;
    const grid = root.querySelector(".grid, .m-grid");
    if (!grid) return;
    const frame2 = grid.getBoundingClientRect();
    if (!frame2.width || !frame2.height) return;
    const viewport = ((_a = grid.closest(".d-scroll, .m-scroll")) != null ? _a : grid).getBoundingClientRect();
    const near = (r) => r.width > 0 && r.top < viewport.bottom + 120 && r.bottom > viewport.top - 120 && r.left < viewport.right + 120 && r.right > viewport.left - 120;
    const animate = (el, frames, opts) => {
      if (typeof el.animate !== "function") return null;
      try {
        return el.animate(frames, opts);
      } catch (e) {
        return null;
      }
    };
    const seen = /* @__PURE__ */ new Set();
    let arrival = 0;
    for (const el of grid.querySelectorAll(".pcard[data-cinema-key]")) {
      const key = el.dataset.cinemaKey;
      seen.add(key);
      const prev = before.get(key);
      if (prev) {
        const now = el.getBoundingClientRect();
        const dx = prev.rect.left - now.left;
        const dy = prev.rect.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 || !near(now) && !near(prev.rect)) continue;
        animate(
          el,
          [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: "none" }],
          { duration: MOTION.move, easing: EASE.out }
        );
      } else if (identityChanged && arrival < ENTER_MAX) {
        if (!near(el.getBoundingClientRect())) continue;
        animate(
          el,
          [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }],
          { duration: MOTION.base, delay: arrival * STAGGER, easing: EASE.out, fill: "backwards" }
        );
        arrival++;
      }
    }
    const gone = [...before.entries()].filter(([k]) => !seen.has(k));
    if (!gone.length || gone.length > GHOST_MAX) return;
    for (const [, snap] of gone) {
      if (!near(snap.rect)) continue;
      const ghost = document.createElement("div");
      ghost.className = "cn-exit";
      ghost.style.left = `${(snap.rect.left - frame2.left).toFixed(1)}px`;
      ghost.style.top = `${(snap.rect.top - frame2.top).toFixed(1)}px`;
      ghost.style.width = `${snap.rect.width.toFixed(1)}px`;
      ghost.style.height = `${snap.rect.height.toFixed(1)}px`;
      if (snap.src) {
        const img = document.createElement("img");
        img.alt = "";
        img.src = snap.src;
        ghost.appendChild(img);
      }
      grid.appendChild(ghost);
      const drop = () => ghost.remove();
      const a = animate(
        ghost,
        [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }],
        { duration: MOTION.fast, easing: EASE.out }
      );
      if (a) {
        a.finished.then(drop).catch(drop);
        window.setTimeout(drop, MOTION.fast + 400);
      } else drop();
    }
  }
  function renderAll(app) {
    const overlay = M.currentOverlay;
    if (!overlay) return;
    const root = overlay.querySelector("[data-cinema-root]");
    if (!root) return;
    clearSoftRender();
    const snap = snapshotFocus(root);
    const beforeCards = measureGridCards(root);
    const scrollMemo = /* @__PURE__ */ new Map();
    for (const sel of [".d-scroll", ".m-scroll"]) {
      const sc = root.querySelector(sel);
      if (sc) scrollMemo.set(sel, sc.scrollTop);
    }
    const mob = root.classList.contains("mob");
    const inp = midnightInput(app);
    if (mob) {
      renderMidnightMob(root, inp);
      attachLongPress(root, app);
    } else renderMidnightDesk(root, inp);
    for (const [sel, top] of scrollMemo) {
      const sc = root.querySelector(sel);
      if (sc) sc.scrollTop = top;
    }
    mountIcons(root);
    syncSlidePills(root, PILL_TARGETS);
    playGridMotion(root, beforeCards);
    flushCardFlash(root);
    restoreFocus(root, snap);
  }
  function closeOverlay() {
    clearSoftRender();
    pendingFlash = null;
    lastViewIdentity = null;
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    for (const close of [...liveOvlCloses]) close();
    closeItemMenu();
    if (M.currentOverlay) {
      M.currentOverlay.remove();
      M.currentOverlay = null;
    }
    M.renderFn = null;
    M.view = "list";
  }
  function registerEscapeHandler() {
    registerPanelEsc("bz-cinema", () => !!M.currentOverlay, () => closeOverlay());
  }

  // src/cinema/index.ts
  var initialized = false;
  var autoRefreshRegistered = false;
  function applyDefaultView() {
    const s = tryGetSettings();
    const sort = s.cinemaSortMode;
    M.sortMode = sort === "created" || sort === "rating" ? sort : "date";
    const st = s.cinemaStatusFilter;
    M.statusFilter = st === "想看" || st === "在看" || st === "已看" ? st : null;
  }
  function ensureCinema(app) {
    M.folderPath = resolveCinemaFolderPath();
    if (initialized) return;
    initialized = true;
    M.appRef = app;
    registerEscapeHandler();
    registerAutoRefresh(app);
    registerPosterRenameSync(app);
  }
  function registerAutoRefresh(app) {
    if (autoRefreshRegistered) return;
    autoRefreshRegistered = true;
    let timer = null;
    const schedule = (file) => {
      if (file && file.path && !file.path.startsWith(M.folderPath + "/")) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!M.currentOverlay) return;
        rebuildItems(app);
        renderSoft(app);
      }, 300);
    };
    onDomainEvent("cinema:file-created", (evt) => schedule({ path: evt.path }));
    onDomainEvent("cinema:file-deleted", (evt) => schedule({ path: evt.path }));
    onDomainEvent("cinema:file-modified", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-created", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-deleted", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-modified", (evt) => schedule({ path: evt.path }));
  }
  var POSTER_RENAME_DEBOUNCE_MS = 300;
  var posterSyncRegistered = false;
  var posterRenameQueue = [];
  var posterRenameTimer = null;
  function registerPosterRenameSync(app) {
    if (posterSyncRegistered) return;
    posterSyncRegistered = true;
    onDomainEvent("vault:md-renamed", (evt) => {
      if (!evt || typeof evt.oldPath !== "string" || !evt.oldPath || typeof evt.newPath !== "string" || !evt.newPath) return;
      posterRenameQueue.push({ oldPath: evt.oldPath, newPath: evt.newPath });
      if (posterRenameTimer) clearTimeout(posterRenameTimer);
      posterRenameTimer = setTimeout(() => void flushPosterRenames(app), POSTER_RENAME_DEBOUNCE_MS);
    });
  }
  async function flushPosterRenames(app) {
    posterRenameTimer = null;
    const batch = posterRenameQueue;
    posterRenameQueue = [];
    for (const { oldPath, newPath } of batch) {
      for (const file of findPosterRenameTargets(app, oldPath)) {
        try {
          await app.fileManager.processFrontMatter(file, (fm) => {
            if (fm["海报"] != null && String(fm["海报"]) === oldPath) fm["海报"] = newPath;
          });
        } catch (e) {
          console.warn("bz 影院：海报路径联动改写失败:", file.path, e);
        }
      }
    }
  }
  function openCinema(app) {
    ensureCinema(app);
    if (M.currentOverlay) {
      closeOverlay();
      return;
    }
    applyDefaultView();
    createOverlay(app);
    sweepDoubanFetch(app);
  }

  // prototypes/cinema/fake-sim.ts
  var FOLDER = "我的/影视";
  var SEED_MARK = "bz-sim:__cinema-seed-v5";
  var SETTINGS_KEY = "bz-sim:__settings";
  function one(v) {
    return String(v != null ? v : "").replace(/\s*\n+\s*/g, " ").trim();
  }
  function mdOf(raw) {
    var _a;
    const rating = raw.status === "想看" ? "-1" : raw.status === "在看" ? "0" : raw.rating == null ? "" : String(raw.rating);
    return [
      "---",
      "tags:",
      `- ${one(raw.typeTag) || "电影"}`,
      `观影日期: ${one(raw.watchDate)}`,
      `评分: ${rating}`,
      `海报: ${one(raw.poster)}`,
      `类型: ${one(raw.genre)}`,
      `导演: ${one(raw.director)}`,
      `主演: ${one(raw.actors)}`,
      `制片国家/地区: ${one(raw.region)}`,
      `上映日期: ${one((_a = raw.releaseDate) != null ? _a : raw.year)}`,
      `豆瓣评分: ${one(raw.doubanRating)}`,
      `豆瓣链接: ${one(raw.doubanUrl)}`,
      `简介: ${one(raw.synopsis)}`,
      `影评: ${one(raw.review)}`,
      `片长: ${one(raw.duration)}`,
      `季集: ${one(raw.seasonText)}`,
      `热门短评: ${one(raw.hotComment)}`,
      "---",
      ""
    ].join("\n");
  }
  function clearSeedFolder() {
    const prefix = "bz-sim:";
    const statsKey = "bz-sim:__stat__";
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k.slice(prefix.length).startsWith(`${FOLDER}/`)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
    try {
      const stats = JSON.parse(localStorage.getItem(statsKey) || "{}");
      for (const k of Object.keys(stats)) if (k.startsWith(`${FOLDER}/`)) delete stats[k];
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch (e) {
      localStorage.setItem(statsKey, "{}");
    }
  }
  function seedDatabase() {
    const src = window.CINEMA_DATA || window.parent && window.parent.CINEMA_DATA || null;
    const items = src || [];
    if (localStorage.getItem(SEED_MARK)) return;
    clearSeedFolder();
    const base = 17e11;
    const n = items.length;
    seedVaultFiles(items.filter((raw) => raw && raw.name).map((raw, i) => ({
      // ctime 递减：导出序靠前者越新 → 「加入先后」排序 = 导出序（旧壳同语义）
      path: `${FOLDER}/《${raw.name}》.md`,
      content: mdOf(raw),
      ctime: base + (n - i) * 1e3
    })));
    localStorage.setItem(SEED_MARK, (/* @__PURE__ */ new Date()).toISOString());
  }
  var settingsStore = {
    cinemaStyle: "midnight",
    cinemaFolderPath: FOLDER,
    cinemaSortMode: "date",
    cinemaStatusFilter: "",
    cinemaGridColumns: "5",
    cinemaMergeSeasons: true,
    // 「解析」链路（issue 395）：原型走 fake requestUrl 的罐头网关，
    // 这里的密钥非空只为让 isJevConfigured / ApiZero 分支成立，不会真的发出去。
    cinemaApizeroKey: "fake-apizero-key",
    cinemaDoubanCookie: "",
    jevEnabled: true,
    jevApiKey: "fake-jev-key",
    jevEndpoint: "https://api.typesafe.ai/v1/systemone",
    jevModel: "jev-1.13.0"
  };
  function injectSettings() {
    if (new URLSearchParams(location.search).get("merge") === "0") settingsStore.cinemaMergeSeasons = false;
    setSettingsProvider(() => settingsStore);
    setSettingsSaver(async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsStore));
    });
    setAISettingsProvider(() => settingsStore);
  }
  var simApp = null;
  function bootCinemaSim() {
    const g = window;
    if (g.__bzCinSimBooted) return;
    g.__bzCinSimBooted = true;
    seedDatabase();
    const app = new FakeApp();
    simApp = app;
    setApp(app);
    injectSettings();
    attachObsidianAdapter(app);
    ensureCinema(app);
  }
  function openCinema2() {
    if (!simApp) bootCinemaSim();
    openCinema(simApp);
  }
  function closeCinema() {
    closeOverlay();
  }
  function addCinemaModal() {
    if (!simApp) bootCinemaSim();
    openAddModalDirect(simApp);
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
