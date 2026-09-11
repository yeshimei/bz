/* 源指纹 e58449d6c062237d · 仓内输入 57 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/review/fake-sim.ts","prototypes/review/fake/fake-obsidian.ts","src/core/ai.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/settings-provider.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/review/app.ts","src/review/data.ts","src/review/fit.ts","src/review/fsrs.ts","src/review/index.ts","src/review/queue.ts","src/review/quiz-core/generator.ts","src/review/quiz-core/index.ts","src/review/quiz-core/manager.ts","src/review/quiz-core/session.ts","src/review/render.ts","src/review/settings-schema.ts","src/review/sprint.ts","src/review/stats-ui.ts","src/review/stats.ts","src/review/ui.ts","src/review/watch.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/review/fake-sim.ts → window.BZW_review（行为单源预览包，issue 245/ADR-0106） */
var BZW_review = (() => {
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
        function createDate(y, m, d, h, M, s, ms) {
          var date;
          if (y < 100 && y >= 0) {
            date = new Date(y + 400, m, d, h, M, s, ms);
            if (isFinite(date.getFullYear())) {
              date.setFullYear(y);
            }
          } else {
            date = new Date(y, m, d, h, M, s, ms);
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

  // prototypes/review/fake/fake-obsidian.ts
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.RVW_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  function simSeed() {
    var _a, _b;
    const self = (typeof window !== "undefined" ? window.RVW : null) || null;
    const parent = typeof window !== "undefined" ? (_b = (_a = window.parent) == null ? void 0 : _a.RVW) != null ? _b : null : null;
    return self || parent || {};
  }
  function extractBatchIds(prompt) {
    const ids = [];
    const re = /=====\s*笔记ID:(.+?)\s*=====/g;
    let m;
    while (m = re.exec(prompt)) ids.push(m[1].trim());
    return ids;
  }
  function matchSingleNote(prompt) {
    const notes = simSeed().notes || {};
    for (const [path, content] of Object.entries(notes)) {
      if (content && prompt.includes(content)) return path;
    }
    return null;
  }
  async function requestUrl(opts) {
    const seed = simSeed();
    let prompt = "";
    try {
      const body = JSON.parse((opts == null ? void 0 : opts.body) || "{}");
      prompt = (body.messages || []).map((m) => m.content || "").join("\n");
    } catch (e) {
    }
    const bank = seed.quizBank || {};
    const respond = (content) => ({
      status: 200,
      text: JSON.stringify({ choices: [{ message: { content } }] })
    });
    if (prompt.includes(QUIZ_BATCH_MARKER)) {
      const out = {};
      for (const id of extractBatchIds(prompt)) {
        const qs = bank[id];
        if (qs == null ? void 0 : qs.length) out[id] = qs;
      }
      return respond(JSON.stringify(out));
    }
    if (prompt.includes(QUIZ_SINGLE_MARKER)) {
      const path = matchSingleNote(prompt);
      const qs = path ? bank[path] : null;
      if (qs == null ? void 0 : qs.length) return respond(JSON.stringify({ questions: qs }));
    }
    throw new Error("原型环境无网络请求（fake obsidian requestUrl；仅出题请求有 canned 响应）");
  }
  function seedVaultFile(path, content, ctime) {
    localStorage.setItem(LS_PREFIX + path, content);
    if (ctime == null) return;
    let stats = {};
    try {
      stats = JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
    } catch (e) {
      stats = {};
    }
    stats[path] = { ctime, mtime: ctime };
    localStorage.setItem(STAT_KEY, JSON.stringify(stats));
  }
  var import_moment, Platform, TFile, QUIZ_SINGLE_MARKER, QUIZ_BATCH_MARKER, LS_PREFIX, STAT_KEY, FakeVault, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/review/fake/fake-obsidian.ts"() {
      import_moment = __toESM(require_moment());
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      TFile = class {
        constructor() {
          this.path = "";
          this.name = "";
          this.basename = "";
          this.extension = "";
          this.stat = { ctime: 0, mtime: 0 };
        }
      };
      QUIZ_SINGLE_MARKER = "根据以下笔记内容，生成若干道四选一的选择题";
      QUIZ_BATCH_MARKER = "根据以下多篇笔记内容，为每篇笔记生成选择题";
      LS_PREFIX = "bz-sim:";
      STAT_KEY = "bz-sim:__stat__";
      FakeVault = class {
        constructor() {
          this.listeners = /* @__PURE__ */ new Map();
          this.idSeq = 0;
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
          const f = this.makeFile(path);
          if (f) return f;
          const prefix = path + "/";
          const children = [];
          const seen = /* @__PURE__ */ new Set();
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(LS_PREFIX) || k === STAT_KEY) continue;
            const p = k.slice(LS_PREFIX.length);
            if (!p.startsWith(prefix)) continue;
            const rest = p.slice(prefix.length);
            const seg = rest.split("/")[0];
            if (!seg || seen.has(seg)) continue;
            seen.add(seg);
            if (rest.includes("/")) {
              children.push({ path: prefix + seg, name: seg, children: [] });
            } else {
              children.push(this.makeFile(p));
            }
          }
          if (!children.length) return null;
          return { path, name: path.split("/").pop() || path, children };
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
        /** 事件订阅（core/app vault.on/offref 同形） */
        on(evt, cb) {
          if (!this.listeners.has(evt)) this.listeners.set(evt, []);
          this.listeners.get(evt).push(cb);
          const id = ++this.idSeq;
          return { ref: id };
        }
        offref(_ref) {
          this.listeners.clear();
        }
        emit(evt, ...args) {
          var _a;
          for (const cb of (_a = this.listeners.get(evt)) != null ? _a : []) cb(...args);
        }
      };
      FakeApp = class {
        constructor() {
          this.vault = new FakeVault();
          /** 打开笔记（openItemFile 等 getLeaf().openFile）：原型中不跳出，no-op */
          this.workspace = {
            getActiveFile() {
              return null;
            },
            getLeaf() {
              return { openFile: async () => void 0 };
            },
            on(_evt, _cb) {
              return { ref: 0 };
            }
          };
          /** ensureReview 监听 metadataCache 'resolved'：原型不触发（样式染色随用随算） */
          this.metadataCache = {
            on(_evt, _cb) {
              return { ref: 0 };
            },
            offref(_ref) {
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
  var _provider, _saver;
  var init_settings_provider = __esm({
    "src/core/settings-provider.ts"() {
      _provider = null;
      _saver = null;
    }
  });

  // src/core/utils.ts
  function escapeHtml(str) {
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
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    const todayStart = (0, import_moment2.default)(now).startOf("day");
    if (target.isSame(todayStart, "day") && diffMinutes >= 60) {
      const hours = Math.floor(diffMinutes / 60);
      return `${hours}小时前`;
    }
    const yesterdayStart = (0, import_moment2.default)(now).subtract(1, "days").startOf("day");
    const beforeYesterdayStart = (0, import_moment2.default)(now).subtract(2, "days").startOf("day");
    if (target.isSame(yesterdayStart, "day")) {
      return shouldShowTime() ? `昨天 ${target.format("HH:mm")}` : "昨天";
    }
    if (target.isSame(beforeYesterdayStart, "day")) {
      return shouldShowTime() ? `前天 ${target.format("HH:mm")}` : "前天";
    }
    const weekStart = (0, import_moment2.default)(now).startOf("week");
    if (target.isSameOrAfter(weekStart, "day") && target.isBefore(todayStart)) {
      return shouldShowTime() ? `${target.format("ddd")} ${target.format("HH:mm")}` : target.format("ddd");
    }
    const isThisYear = target.year() === nowMoment.year();
    if (isThisYear) {
      return shouldShowTime() ? target.format("MM-DD HH:mm") : target.format("MM-DD");
    }
    return shouldShowTime() ? target.format("YYYY-MM-DD HH:mm") : target.format("YYYY-MM-DD");
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }
  function stripTitleMarks(s) {
    return String(s || "").replace(/^《|》$/g, "");
  }
  function isUnderFolder(folder, path) {
    const f = (folder || "").trim().replace(/\/+$/, "");
    if (!f) return false;
    return path === f || path.startsWith(f + "/");
  }
  var import_moment2;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      import_moment2 = __toESM(require_moment());
      init_fake_obsidian();
      init_app();
    }
  });

  // src/core/z-order.ts
  function syncAlwaysOnTop() {
    for (const el of alwaysOnTop) {
      if (el.isConnected) el.style.zIndex = String(zCounter);
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
  function notice(msg, type, duration) {
    notify(msg, { type: type || "info", duration });
  }
  function notifyUndo(msg, onUndo, opts) {
    return notify(msg, {
      type: opts && opts.type || "delete",
      duration: opts && opts.duration !== void 0 ? opts.duration : UNDO_DURATION_MS,
      action: { label: "撤销", onClick: onUndo }
    });
  }
  function notifySaveError(err, what) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(what ? `保存失败（${what}）：${msg}` : `保存失败：${msg}`, { type: "error" });
  }
  function isMobileView() {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }
  function defaultVariant() {
    return isMobileView() ? "drop" : "slide-right";
  }
  function defaultDuration(type) {
    return type === "error" ? 5e3 : 3e3;
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
    let quota = live.length - MAX_VISIBLE + 1;
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
      "bz-notice--accept",
      "bz-notice--delete",
      "bz-notice--confirm",
      "bz-notice--restore",
      "bz-notice--skip",
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
      return;
    }
    const base = defaultDuration(kind);
    const dur = explicitDuration !== void 0 ? explicitDuration : text ? calcDuration(text, base) : base;
    if (dur <= 0) {
      n.persistent = true;
      return;
    }
    n.timer = window.setTimeout(() => hideNow(n), dur);
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
      hide() {
      }
    };
  }
  function appendActionBtn(n, action) {
    const btn = document.createElement("span");
    btn.className = "bz-notice-action";
    btn.setAttribute("role", "button");
    btn.textContent = action.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (action.onClick) action.onClick();
      hideNow(n);
    });
    n.el.appendChild(btn);
  }
  function notify(msg, opts) {
    const kind = opts && opts.type || "info";
    const isProgress = kind === "progress";
    const type = isProgress ? "info" : kind;
    const variant = opts && opts.variant || defaultVariant();
    const container = ensureContainer();
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
        const existingLabels = new Set(
          Array.from(r.n.el.querySelectorAll(".bz-notice-action")).map((el2) => el2.textContent || "")
        );
        for (const a of mergeActions) {
          if (!existingLabels.has(a.label)) appendActionBtn(r.n, a);
        }
        armTimer(r.n, kind, opts.duration, msg);
        return noopHandle();
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
    const icon2 = document.createElement("div");
    icon2.className = "bz-notice-icon";
    if (isProgress) {
      icon2.innerHTML = SPINNER_SVG;
    } else {
      icon2.textContent = ICONS[type];
    }
    el.appendChild(icon2);
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
    const n = { el, timer: null, msgEl, progressEl, iconEl: icon2, variant, isProgress, persistent: false };
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
    return {
      el,
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
      hide() {
        hideNow(n);
      }
    };
  }
  var MAX_VISIBLE, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, UNDO_DURATION_MS, OUT_CLASS, PER_CHAR_MS, SHORT_THRESHOLD, live, recent;
  var init_notice = __esm({
    "src/core/notice.ts"() {
      init_z_order();
      MAX_VISIBLE = 5;
      LEAVE_MS = 200;
      DEDUPE_WINDOW_MS = 3e4;
      MOBILE_QUERY = "(max-width: 768px)";
      ICONS = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
        pause: "⏸️",
        accept: "✨",
        delete: "🗑️",
        confirm: "✓",
        restore: "↩️",
        skip: "🚫",
        archive: "📁"
      };
      SPINNER_SVG = '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9"/></svg>';
      UNDO_DURATION_MS = 6e3;
      OUT_CLASS = {
        drop: "bz-notice--out-drop",
        pop: "bz-notice--out-pop",
        "slide-left": "bz-notice--out-left",
        "slide-right": "bz-notice--out-right",
        bounce: "bz-notice--out-fade",
        shake: "bz-notice--out-fade"
      };
      PER_CHAR_MS = 60;
      SHORT_THRESHOLD = 20;
      live = [];
      recent = {};
    }
  });

  // src/core/esc-manager.ts
  var escManager;
  var init_esc_manager = __esm({
    "src/core/esc-manager.ts"() {
      escManager = (() => {
        const layers = [];
        const onKeydown = (e) => {
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
          /** 插件卸载时移除全局监听 */
          destroy() {
            if (typeof document !== "undefined") {
              document.removeEventListener("keydown", onKeydown);
            }
          }
        };
      })();
    }
  });

  // src/core/flow-dialog.ts
  function buildFlowDialogParts(title, message, actions) {
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
    const focusIdx = ctaIdx >= 0 ? ctaIdx : actions.length - 1;
    const html = "<h4>" + escapeHtml(title || "确认") + "</h4><p>" + escapeHtml(message) + '</p><div class="confirm-actions">' + buttons.map((b) => {
      const clsAttr = b.className ? ' class="' + b.className + '"' : "";
      return '<button id="' + b.id + '"' + clsAttr + ">" + escapeHtml(b.label) + "</button>";
    }).join("") + "</div>";
    return { html, buttons, focusId: buttons[focusIdx].id };
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
      if (opts.className) popup.classList.add(opts.className);
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
      function restoreFocus() {
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
      function settle(v) {
        if (settled) return;
        settled = true;
        if (activeSettle === settle) activeSettle = null;
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
  var FLOW_DIALOG_CANCEL_ID, FLOW_DIALOG_OK_ID, activeSettle;
  var init_flow_dialog = __esm({
    "src/core/flow-dialog.ts"() {
      init_esc_manager();
      init_utils();
      init_z_order();
      FLOW_DIALOG_CANCEL_ID = "__shared_confirm_cancel__";
      FLOW_DIALOG_OK_ID = "__shared_confirm_ok__";
      activeSettle = null;
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

  // src/core/storage.ts
  function storageDir() {
    const s = tryGetSettings();
    return (s && s.storagePath || "CONFIG/STORAGE").trim().replace(/\/+$/, "");
  }
  function storageFile(name, base) {
    const dir = (base || storageDir()).trim().replace(/\/+$/, "");
    return `${dir}/${name}`;
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
  var fileTaskQueues, CORRUPT_BACKUP_DIR, CORRUPT_NOTIFY_DEDUPE_MS, corruptNotifyAt;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      fileTaskQueues = /* @__PURE__ */ new Map();
      CORRUPT_BACKUP_DIR = "CONFIG/.CORRUPT";
      CORRUPT_NOTIFY_DEDUPE_MS = 3e4;
      corruptNotifyAt = /* @__PURE__ */ new Map();
    }
  });

  // src/review/fsrs.ts
  function scheduleNext(state, rating, now, w = DEFAULT_W) {
    const fsrs = new FSRS(w);
    if (state.phase !== "fsrs" && state.stage < LADDER_MAX) {
      let target;
      if (rating === "again") target = Math.max(0, state.stage - 1);
      else if (rating === "hard") target = state.stage;
      else if (rating === "good") target = state.stage + 1;
      else target = state.stage + 2;
      target = Math.max(0, Math.min(target, LADDER_MAX));
      if (target >= LADDER_MAX) {
        const S2 = fsrs.initS(rating);
        const D2 = rating === "again" ? fsrs.w[4] : 0.3;
        const rS = Math.round(S2 * 100) / 100;
        const rD = Math.round(D2 * 100) / 100;
        return {
          stage: target,
          phase: "fsrs",
          stability: rS,
          difficulty: rD,
          intervalDays: FSRS_FIRST_INTERVALS[target],
          enteringFsrs: true,
          historyStage: target + 1,
          R: null,
          historyStability: rS,
          historyDifficulty: rD
        };
      }
      return {
        stage: target,
        phase: "ladder",
        stability: null,
        difficulty: null,
        intervalDays: FSRS_FIRST_INTERVALS[target],
        enteringFsrs: false,
        historyStage: target + 1,
        R: null,
        historyStability: null,
        historyDifficulty: null
      };
    }
    const S = state.stability || 1;
    const D = state.difficulty || 0.3;
    const last = state.lastReviewed || state.reviewStart;
    const t = last ? (now.getTime() - new Date(last).getTime()) / 864e5 : 0;
    const R = fsrs.R(t, S);
    const result = fsrs.nextInterval(S, D, rating, R);
    return {
      stage: state.stage,
      phase: "fsrs",
      stability: Math.round(result.S * 100) / 100,
      difficulty: Math.round(result.D * 100) / 100,
      intervalDays: result.days,
      enteringFsrs: false,
      historyStage: state.stage + 1,
      R,
      historyStability: Math.round(result.S * 100) / 100,
      historyDifficulty: Math.round(result.D * 100) / 100
    };
  }
  var DEFAULT_W, DEFAULT_D, FSRS, FSRS_FIRST_INTERVALS, FSRS_FIRST_TEXTS, TOTAL_STAGES, LADDER_MAX;
  var init_fsrs = __esm({
    "src/review/fsrs.ts"() {
      DEFAULT_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 1.26, 0.07, 0.35, 2.06, 0.57, 0.09, 0.05, 0.33, 2.15];
      DEFAULT_D = 0.9;
      FSRS = class {
        constructor(w = DEFAULT_W, d = DEFAULT_D) {
          this.w = w;
          this.d = d;
        }
        /** 记忆保留度：R(t, S) = (1 + t/(S·d))^-d */
        R(t, S) {
          return Math.pow(1 + t / (S * this.d), -this.d);
        }
        /** 初始稳定性 */
        initS(rating) {
          const map = { again: 0, hard: 1, good: 2, easy: 3 };
          return this.w[map[rating]] || 1;
        }
        /** 下一难度 */
        nextDiff(D, rating) {
          let newD;
          if (rating === "again") newD = this.w[4];
          else if (rating === "hard") newD = D + this.w[5];
          else if (rating === "easy") newD = D + this.w[6];
          else newD = D;
          return Math.max(0, Math.min(1, newD));
        }
        /** 下一稳定性 */
        nextStab(S, D, rating, R) {
          if (rating === "again") {
            return this.w[11] * Math.pow(D, -this.w[12]) * (Math.pow(S + 1, this.w[13]) - 1) * Math.exp(this.w[14] * R);
          }
          const base = Math.exp(this.w[8]) * (11 - D) * Math.pow(S, -this.w[9]) * (Math.exp(this.w[10] * (1 - R)) - 1);
          if (rating === "hard") return S * base;
          if (rating === "good") return S * (base + 1);
          return S * base * (Math.exp(this.w[17]) + 1);
        }
        /** 下一间隔（天） */
        nextInterval(S, D, rating, R) {
          const newD = this.nextDiff(D, rating);
          const newS = Math.max(0.01, this.nextStab(S, newD, rating, R));
          return { S: newS, D: newD, days: newS };
        }
      };
      FSRS_FIRST_INTERVALS = [1 / 1440, 1 / 48, 1 / 4, 1, 3, 7, 15, 30, 60, 120];
      FSRS_FIRST_TEXTS = ["1m", "30m", "6h", "1d", "3d", "7d", "15d", "30d", "60d", "120d"];
      TOTAL_STAGES = 10;
      LADDER_MAX = 9;
    }
  });

  // src/review/data.ts
  function getReviewFilePath() {
    const s = tryGetSettings();
    return storageFile("review.json", s && s.storagePath || "CONFIG/STORAGE");
  }
  function getReviewFitFilePath() {
    const s = tryGetSettings();
    return storageFile("review-fit.json", s && s.storagePath || "CONFIG/STORAGE");
  }
  async function loadFittedParams(app) {
    const data = await jsonFileStore(getReviewFitFilePath()).read();
    if (!data || !Array.isArray(data.w) || data.w.length < 8) return null;
    return data;
  }
  async function saveFittedParams(app, fit) {
    await enqueueFileTask(getReviewFitFilePath(), () => jsonFileStore(getReviewFitFilePath()).write(fit));
  }
  var ReviewDataManager;
  var init_data = __esm({
    "src/review/data.ts"() {
      init_utils();
      init_storage();
      init_settings_provider();
      init_fsrs();
      ReviewDataManager = class {
        constructor(app) {
          this.app = app;
        }
        /** 加载条目（向后兼容旧字段；日期兼容 ISO 字符串与数字）。
         *  走模块级 getApp（reviewApp 为单例 dataManager，app 参数注入会绑定旧 app 导致跨测试/重开写错 vault） */
        async loadItems() {
          var _a;
          const data = await jsonFileStore(getReviewFilePath()).read();
          const items = Array.isArray(data) ? data : [];
          const valid = [];
          for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(item.filePath);
            if (!file) {
              item.file = null;
              item.isMissing = true;
              item.name = item.name || stripMdExt(item.filePath.split("/").pop() || "") || item.filePath;
              item.isCompleted = item.completed || false;
              item.isOverdue = false;
              item.currentStage = ((_a = item.stage) != null ? _a : (item.reviewStage || 1) - 1) + 1;
              item.totalStages = TOTAL_STAGES;
              valid.push(item);
              continue;
            }
            item.file = file;
            item.name = file.basename;
            if (item.stage === void 0) item.stage = (item.reviewStage || 1) - 1;
            if (item.stability === void 0) item.stability = 1;
            if (item.difficulty === void 0) item.difficulty = 0.3;
            if (item.phase === void 0) item.phase = item.stage >= LADDER_MAX ? "fsrs" : "ladder";
            const now = /* @__PURE__ */ new Date();
            const isCompleted = item.completed || false;
            const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : null;
            const isOverdue = !!nextReview && now > nextReview && !isCompleted;
            item.isCompleted = isCompleted;
            item.isOverdue = isOverdue;
            item.currentStage = item.stage + 1;
            item.totalStages = TOTAL_STAGES;
            valid.push(item);
          }
          return valid;
        }
        /** 保存（白名单剥离运行时字段：file/isCompleted/isOverdue/isMissing/currentStage/totalStages
         *  均为 loadItems 派生或运行时态，不落盘（数据卫生）；走模块级 getApp——见 loadItems 注释） */
        async saveItems(items) {
          const data = items.map((i) => {
            const {
              file: _file,
              isCompleted: _isCompleted,
              isOverdue: _isOverdue,
              isMissing: _isMissing,
              currentStage: _currentStage,
              totalStages: _totalStages,
              ...rest
            } = i;
            return rest;
          });
          await jsonFileStore(getReviewFilePath()).write(data);
        }
        /** 读改写事务：fn 基于磁盘现值改动，整体入 per-path 串行队列（D3 原语 1） */
        mutate(fn) {
          return enqueueFileTask(getReviewFilePath(), async () => {
            const items = await this.loadItems();
            const result = await fn(items);
            await this.saveItems(items);
            return result;
          });
        }
        /** 新增条目 */
        addItem(filePath, fileName) {
          return this.mutate((items) => {
            if (items.some((i) => i.filePath === filePath)) throw new Error("该笔记已在复习计划中");
            const now = /* @__PURE__ */ new Date();
            const newItem = {
              id: `review_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
              filePath,
              name: fileName,
              reviewStart: now.toISOString(),
              stage: 0,
              phase: "ladder",
              stability: 1,
              difficulty: 0.3,
              reviewHistory: [],
              totalReviews: 0,
              averageConfidence: 0,
              nextReviewDate: new Date(now.getTime() + FSRS_FIRST_INTERVALS[0] * 864e5).toISOString(),
              lastReviewed: null,
              lastDifficulty: null,
              completed: false
            };
            items.push(newItem);
            return newItem;
          });
        }
        /** 更新条目（按 filePath 定位 + 就地修改 + 落盘） */
        updateItem(filePath, updateFn) {
          return this.mutate((items) => {
            const idx = items.findIndex((i) => i.filePath === filePath);
            if (idx === -1) throw new Error("条目不存在");
            updateFn(items[idx]);
          }).then(() => void 0);
        }
        /** 移除条目（同路径重复条目全数移除，与旧 filter 语义一致） */
        removeItem(filePath) {
          return this.mutate((items) => {
            for (let i = items.length - 1; i >= 0; i--) {
              if (items[i].filePath === filePath) items.splice(i, 1);
            }
          }).then(() => void 0);
        }
        /** 撤销移出（ticket 141 通病 1）：原条目（含阶段/排期/历史）原样插回，不走 addItem 重置进度。
         *  运行时字段与 saveItems 同口径剥离（file/isCompleted/isOverdue/isMissing/currentStage/totalStages 不落盘） */
        restoreItem(item) {
          return this.mutate((items) => {
            if (items.some((i) => i.filePath === item.filePath)) return;
            const {
              file: _file,
              isCompleted: _isCompleted,
              isOverdue: _isOverdue,
              isMissing: _isMissing,
              currentStage: _currentStage,
              totalStages: _totalStages,
              ...rest
            } = item;
            items.push(rest);
          }).then(() => void 0);
        }
        getOverdueCount(items) {
          return items.filter((i) => i.isOverdue && !i.isCompleted).length;
        }
        /** 文件重命名时更新路径 */
        updateFilePath(oldPath, newPath, newName) {
          return this.mutate((items) => {
            const item = items.find((i) => i.filePath === oldPath);
            if (!item) return false;
            if (items.some((i) => i.filePath === newPath && i.filePath !== oldPath)) return false;
            item.filePath = newPath;
            item.name = newName;
            return true;
          });
        }
      };
    }
  });

  // src/review/fit.ts
  function clip(w) {
    const out = [...w];
    for (let i = 0; i < 4; i++) out[i] = Math.max(0.01, out[i]);
    out[4] = Math.max(0, Math.min(1, out[4]));
    for (let i = 5; i < 8; i++) out[i] = Math.max(0.01, out[i]);
    return out;
  }
  function computeSampleLogLikelihood(w, sample) {
    const d = DEFAULT_D;
    const S = sample.S;
    const t = sample.t;
    const denom = Math.max(0.01, S * d);
    const R = Math.pow(1 + t / denom, -d);
    const remember = sample.rating === 2 || sample.rating === 3;
    const p = remember ? R : 1 - R;
    return Math.log(Math.max(1e-9, Math.min(1 - 1e-9, p)));
  }
  function isFittableSample(sample) {
    return sample.stage >= 9;
  }
  function buildFitSamples(history, opts) {
    const out = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const cur = history[i];
      if (prev.stability === void 0) continue;
      const prevD = prev.difficulty !== void 0 ? prev.difficulty : opts == null ? void 0 : opts.fallbackDifficulty;
      if (prevD === void 0) continue;
      const t = (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 864e5;
      if (!(t > 0)) continue;
      const ratingIdx = RATING_INDEX[cur.rating];
      if (ratingIdx === void 0) continue;
      out.push({
        t,
        S: prev.stability,
        D: prevD,
        rating: ratingIdx,
        stage: cur.stage
      });
    }
    return out;
  }
  function totalLogLikelihood(w, samples) {
    let sum = 0;
    for (const s of samples) {
      if (!isFittableSample(s)) continue;
      sum += computeSampleLogLikelihood(w, s);
    }
    return sum;
  }
  function numericGradient(w, samples, eps = 1e-5) {
    const grad = new Array(w.length).fill(0);
    const base = totalLogLikelihood(w, samples);
    for (let i = 0; i < Math.min(8, w.length); i++) {
      const wp = [...w];
      const wm = [...w];
      wp[i] += eps;
      wm[i] -= eps;
      const fp = totalLogLikelihood(wp, samples);
      const fm = totalLogLikelihood(wm, samples);
      grad[i] = (fp - fm) / (2 * eps);
    }
    return grad;
  }
  function fitFSRSParams(samples, opts = {}) {
    var _a, _b, _c;
    const initW = opts.initW ? [...opts.initW] : [...DEFAULT_W];
    const iterations = (_a = opts.iterations) != null ? _a : 150;
    const lr = (_b = opts.lr) != null ? _b : 0.02;
    const full = (_c = opts.full) != null ? _c : false;
    const fitLen = full ? Math.min(19, initW.length) : Math.min(8, initW.length);
    const w = clip(initW);
    const m = new Array(w.length).fill(0);
    const v = new Array(w.length).fill(0);
    const beta1 = 0.9;
    const beta2 = 0.999;
    const eps = 1e-8;
    let lastLL = totalLogLikelihood(w, samples);
    let bestW = [...w];
    let bestLL = lastLL;
    let stall = 0;
    for (let it = 1; it <= iterations; it++) {
      const lrIt = lr * (1 - 0.75 * (it / iterations));
      const grad = numericGradient(w, samples);
      for (let i = 0; i < fitLen; i++) {
        m[i] = beta1 * m[i] + (1 - beta1) * grad[i];
        v[i] = beta2 * v[i] + (1 - beta2) * grad[i] * grad[i];
        const mHat = m[i] / (1 - Math.pow(beta1, it));
        const vHat = v[i] / (1 - Math.pow(beta2, it));
        w[i] += lrIt * mHat / (Math.sqrt(vHat) + eps);
      }
      for (let i = 0; i < fitLen; i++) {
        if (i < 4) w[i] = Math.max(0.01, w[i]);
        else if (i === 4) w[i] = Math.max(0, Math.min(1, w[i]));
        else w[i] = Math.max(0.01, w[i]);
      }
      const ll = totalLogLikelihood(w, samples);
      if (ll > bestLL) {
        bestLL = ll;
        bestW = [...w];
      }
      if (Math.abs(ll - lastLL) < 1e-6) {
        stall++;
        if (stall >= 10) break;
      } else stall = 0;
      lastLL = ll;
    }
    return { w: clip(bestW), logLikelihood: bestLL, iterations };
  }
  function fitFromItems(items, opts) {
    var _a;
    const samples = items.flatMap((i) => buildFitSamples(i.reviewHistory || [], { fallbackDifficulty: i.difficulty }));
    const fittable = samples.filter(isFittableSample);
    const count = fittable.length;
    if (count < 100) return null;
    const full = (_a = opts == null ? void 0 : opts.full) != null ? _a : count >= 300;
    return { fit: fitFSRSParams(samples, { full }), count };
  }
  function mergeFittedW(fitted) {
    const out = [...DEFAULT_W];
    for (let i = 0; i < Math.min(19, fitted.length); i++) out[i] = fitted[i];
    return out;
  }
  var RATING_INDEX;
  var init_fit = __esm({
    "src/review/fit.ts"() {
      init_fsrs();
      RATING_INDEX = { again: 0, hard: 1, good: 2, easy: 3 };
    }
  });

  // src/review/stats.ts
  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function historyOf(item) {
    return (item.reviewHistory || []).map((h) => ({
      timestamp: h.timestamp,
      rating: h.rating,
      stage: h.stage,
      stability: h.stability,
      difficulty: h.difficulty,
      R: h.R
    }));
  }
  function flattenHistory(items) {
    return items.flatMap((i) => historyOf(i).map((h) => ({ ...h, filePath: i.filePath })));
  }
  function computeStats(items, opts) {
    const history = flattenHistory(items);
    const days = /* @__PURE__ */ new Set();
    for (const h of history) days.add(dateKey(new Date(h.timestamp)));
    const totalReviews = days.size;
    const todayKey = dateKey(/* @__PURE__ */ new Date());
    let streak = 0;
    let cursor = /* @__PURE__ */ new Date();
    if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    const todayCount = history.filter((h) => dateKey(new Date(h.timestamp)) === todayKey).length;
    const ratingDist = { again: 0, hard: 0, good: 0, easy: 0 };
    for (const h of history) {
      if (h.rating in ratingDist) ratingDist[h.rating]++;
    }
    const active2 = items.filter((i) => !i.completed && !i.isCompleted);
    const overdue = active2.filter((i) => i.isOverdue);
    const overdueRate = active2.length ? overdue.length / active2.length : 0;
    const rFsrs = new FSRS((opts == null ? void 0 : opts.w) || DEFAULT_W);
    let rSum = 0;
    let rN = 0;
    for (const i of items) {
      if (i.phase === "fsrs" && i.stability && i.lastReviewed) {
        const t = ((/* @__PURE__ */ new Date()).getTime() - new Date(i.lastReviewed).getTime()) / 864e5;
        if (t > 0) {
          rSum += rFsrs.R(t, i.stability);
          rN++;
        }
      }
    }
    const avgR = rN ? rSum / rN : null;
    let firstReviewAt = null;
    if (history.length) {
      const ts = history.map((h) => new Date(h.timestamp).getTime());
      firstReviewAt = new Date(Math.min(...ts)).toISOString();
    }
    const daily7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const count = history.filter((h) => dateKey(new Date(h.timestamp)) === key).length;
      daily7.push({ date: key, count });
    }
    const reviewedNotes = new Set(history.filter((h) => h.filePath).map((h) => h.filePath)).size;
    return {
      totalReviews,
      streak,
      todayReviews: todayCount,
      ratingDist,
      overdueRate,
      avgR,
      reviewedNotes,
      firstReviewAt,
      daily7
    };
  }
  function loadDistribution(items, nDays) {
    const out = [];
    for (let i = 0; i < nDays; i++) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() + i);
      out.push({ date: dateKey(d), count: 0 });
    }
    for (const item of items) {
      if (item.completed || item.isCompleted || !item.nextReviewDate || item.isMissing) continue;
      const d = new Date(item.nextReviewDate);
      const key = dateKey(d);
      const slot = out.find((x) => x.date === key);
      if (slot) slot.count++;
    }
    return out;
  }
  var RATING_NAMES, RATING_COLORS;
  var init_stats = __esm({
    "src/review/stats.ts"() {
      init_fsrs();
      RATING_NAMES = { again: "忘了", hard: "困难", good: "一般", easy: "简单" };
      RATING_COLORS = { again: "#ff4757", hard: "#ff9f43", good: "#2ed573", easy: "#7bed9f" };
    }
  });

  // src/review/queue.ts
  function isDueToday(item) {
    if (!item.nextReviewDate) return false;
    return dateKey(new Date(item.nextReviewDate)) === dateKey(/* @__PURE__ */ new Date());
  }
  function isEarlyDue(item, rThreshold, w) {
    if (item.phase !== "fsrs" || !item.stability || !item.lastReviewed) return false;
    const t = (Date.now() - new Date(item.lastReviewed).getTime()) / 864e5;
    if (!(t > 0)) return false;
    return new FSRS(w).R(t, item.stability) < rThreshold;
  }
  function active(i) {
    return !i.isCompleted && !i.completed && !i.isMissing;
  }
  function partitionQueue(items, rThreshold = DEFAULT_R_THRESHOLD, w = DEFAULT_W) {
    const overdue = [];
    const today = [];
    const future = [];
    const done = [];
    for (const i of items) {
      if (!active(i)) {
        done.push(i);
        continue;
      }
      if (i.isOverdue) overdue.push(i);
      else if (isDueToday(i) || isEarlyDue(i, rThreshold, w)) today.push(i);
      else future.push(i);
    }
    return { overdue, today, future, done };
  }
  function roundQueue(items, rThreshold, w) {
    return items.filter((i) => {
      if (!active(i)) return false;
      if (i.isOverdue) return true;
      if (isDueToday(i)) return true;
      return isEarlyDue(i, rThreshold, w);
    });
  }
  var DEFAULT_R_THRESHOLD;
  var init_queue = __esm({
    "src/review/queue.ts"() {
      init_fsrs();
      init_stats();
      DEFAULT_R_THRESHOLD = 0.9;
    }
  });

  // src/core/ai.ts
  function getQ3Settings() {
    return _settingsProvider ? _settingsProvider() : {};
  }
  function getProviderDescriptor(id) {
    return AI_PROVIDER_REGISTRY.find((p) => p.id === id) || AI_PROVIDER_REGISTRY.find((p) => p.id === "custom") || AI_PROVIDER_REGISTRY[AI_PROVIDER_REGISTRY.length - 1];
  }
  async function getAIProvider(override) {
    var _a, _b, _c;
    if (!override && _aiProviderCache) return _aiProviderCache;
    const s = getQ3Settings();
    if (override && typeof override === "object" && override.apiKey) {
      return {
        endpoint: String(override.endpoint || "https://api.deepseek.com").replace(/\/+$/, ""),
        apiKey: override.apiKey,
        model: override.model || void 0,
        extraHeaders: override.extraHeaders || void 0,
        contextWindow: override.contextWindow,
        defaultMaxTokens: override.defaultMaxTokens
      };
    }
    const name = typeof override === "string" && override || s.aiProvider || "opencode-go";
    const desc = getProviderDescriptor(name);
    if (name === "custom") {
      const endpoint = (s.aiCustomEndpoint || "").replace(/\/+$/, "");
      if (!endpoint || !s.aiCustomApiKey) {
        throw new Error("未配置自定义 AI 服务：请填写 API 地址与密钥（插件设置 → AI 配置）");
      }
      _aiProviderCache = {
        endpoint,
        apiKey: s.aiCustomApiKey,
        model: s.aiCustomModel || void 0,
        extraHeaders: desc.extraHeaders,
        contextWindow: desc.defaultContextWindow,
        defaultMaxTokens: desc.defaultMaxTokens
      };
      return _aiProviderCache;
    }
    const key = s[desc.apiKeyKey];
    if (!key && name === "deepseek") {
      try {
        const raw = await getApp().vault.adapter.read(".obsidian/plugins/quickadd/data.json");
        const cfg = JSON.parse(raw);
        const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
        if (provider && provider.endpoint && provider.apiKey) {
          _aiProviderCache = {
            endpoint: String(provider.endpoint).replace(/\/+$/, ""),
            apiKey: provider.apiKey,
            contextWindow: desc.defaultContextWindow,
            defaultMaxTokens: desc.defaultMaxTokens
          };
          return _aiProviderCache;
        }
      } catch (e) {
      }
    }
    if (!key && name !== "ollama") {
      throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
    }
    const overrideModel = (_a = s.aiModelOverrides) == null ? void 0 : _a[name];
    const overrideContext = (_b = s.aiContextOverrides) == null ? void 0 : _b[name];
    const overrideMaxTokens = (_c = s.aiMaxTokensOverrides) == null ? void 0 : _c[name];
    _aiProviderCache = {
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: overrideModel || desc.model || void 0,
      noCors: desc.noCors,
      extraHeaders: desc.extraHeaders,
      contextWindow: overrideContext || desc.defaultContextWindow,
      defaultMaxTokens: overrideMaxTokens || desc.defaultMaxTokens
    };
    return _aiProviderCache;
  }
  function abortError() {
    const e = new Error("请求已取消");
    e.name = "AbortError";
    return e;
  }
  async function streamChatCompletions(provider, body, signal, onDelta) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await fetch(`${provider.endpoint}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal
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
  }
  async function chatCompletionsNonStream(provider, body, signal) {
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`,
      ...provider.extraHeaders || {}
    };
    const resp = await requestUrl({
      url: `${provider.endpoint}/chat/completions`,
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, stream: false })
    });
    if (signal == null ? void 0 : signal.aborted) throw abortError();
    const data = JSON.parse(resp.text);
    const errMsg = data.error && (data.error.message || data.error.type) || data.message && data.message;
    if (errMsg) throw new Error(`API ${resp.status}: ${errMsg}`);
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content === void 0 || content === null) throw new Error(`API ${resp.status}: 响应缺少 content`);
    return content;
  }
  function createAI(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}, defaultMaxTokens = 8192) {
    const internalDefaultOptions = {
      modelOptions: {
        max_tokens: defaultMaxTokens,
        ...defaultOptions.modelOptions || {}
      }
    };
    const mergedOptions = { ...internalDefaultOptions, ...defaultOptions };
    if (defaultOptions.modelOptions) {
      mergedOptions.modelOptions = {
        ...internalDefaultOptions.modelOptions,
        ...defaultOptions.modelOptions
      };
    }
    return new AIService(params, defaultModel, mergedOptions);
  }
  var _settingsProvider, AI_PROVIDER_REGISTRY, _aiProviderCache, AIService;
  var init_ai = __esm({
    "src/core/ai.ts"() {
      init_fake_obsidian();
      init_app();
      _settingsProvider = null;
      AI_PROVIDER_REGISTRY = [
        {
          id: "deepseek",
          label: "DeepSeek",
          endpoint: "https://api.deepseek.com",
          model: "",
          // 空 = 沿用调用方默认模型（原行为：deepseek 不强制模型）
          defaultMaxTokens: 8192,
          defaultContextWindow: 65536,
          apiKeyKey: "deepseekApiKey",
          apiKeyLabel: "DeepSeek 密钥",
          apiKeyDesc: "留空则自动回退读取外部配置密钥"
        },
        {
          id: "opencode-go",
          label: "OpenCode Go",
          endpoint: "https://opencode.ai/zen/go/v1",
          model: "deepseek-v4-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "opencodeGoApiKey",
          apiKeyLabel: "OpenCode 密钥",
          apiKeyDesc: "在订阅官网获取后填入这里",
          noCors: true
        },
        {
          id: "openai",
          label: "OpenAI",
          endpoint: "https://api.openai.com/v1",
          model: "gpt-4o-mini",
          defaultMaxTokens: 16384,
          defaultContextWindow: 128e3,
          apiKeyKey: "openaiApiKey",
          apiKeyLabel: "OpenAI 密钥",
          apiKeyDesc: "在 OpenAI 官网获取后填入这里"
        },
        {
          id: "anthropic",
          label: "Anthropic（Claude）",
          endpoint: "https://api.anthropic.com/v1",
          model: "claude-sonnet-4-5",
          defaultMaxTokens: 64e3,
          // claude-sonnet-4-5 最大输出上限 64K（ticket 172 默认最大值）
          defaultContextWindow: 2e5,
          apiKeyKey: "anthropicApiKey",
          apiKeyLabel: "Anthropic 密钥",
          apiKeyDesc: "在 Anthropic 官网获取后填入这里",
          extraHeaders: { "anthropic-version": "2023-06-01" }
        },
        {
          id: "google",
          label: "Google Gemini",
          endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
          model: "gemini-2.0-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 1048576,
          apiKeyKey: "googleApiKey",
          apiKeyLabel: "Gemini 密钥",
          apiKeyDesc: "在 Google AI Studio 获取后填入这里"
        },
        {
          id: "moonshot",
          label: "Moonshot（Kimi）",
          endpoint: "https://api.moonshot.cn/v1",
          model: "kimi-k2-0711-preview",
          defaultMaxTokens: 131072,
          // kimi-k2 最大输出上限 128K（ticket 172 默认最大值）
          defaultContextWindow: 131072,
          apiKeyKey: "moonshotApiKey",
          apiKeyLabel: "Kimi 密钥",
          apiKeyDesc: "在 Moonshot 开放平台获取后填入这里"
        },
        {
          id: "zhipu",
          label: "智谱（GLM）",
          endpoint: "https://open.bigmodel.cn/api/paas/v4",
          model: "glm-4-flash",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "zhipuApiKey",
          apiKeyLabel: "智谱密钥",
          apiKeyDesc: "在智谱开放平台获取后填入这里"
        },
        {
          id: "dashscope",
          label: "阿里云百炼（通义）",
          endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          model: "qwen-plus",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "dashscopeApiKey",
          apiKeyLabel: "百炼密钥",
          apiKeyDesc: "在阿里云百炼获取 API Key 后填入这里"
        },
        {
          id: "siliconflow",
          label: "硅基流动",
          endpoint: "https://api.siliconflow.cn/v1",
          model: "deepseek-ai/DeepSeek-V3",
          defaultMaxTokens: 8192,
          defaultContextWindow: 65536,
          apiKeyKey: "siliconflowApiKey",
          apiKeyLabel: "硅基流动密钥",
          apiKeyDesc: "在硅基流动官网获取后填入这里"
        },
        {
          id: "openrouter",
          label: "OpenRouter",
          endpoint: "https://openrouter.ai/api/v1",
          model: "deepseek/deepseek-chat",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "openrouterApiKey",
          apiKeyLabel: "OpenRouter 密钥",
          apiKeyDesc: "在 OpenRouter 官网获取后填入这里"
        },
        {
          id: "xai",
          label: "xAI（Grok）",
          endpoint: "https://api.x.ai/v1",
          model: "grok-2-latest",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "xaiApiKey",
          apiKeyLabel: "xAI 密钥",
          apiKeyDesc: "在 xAI 控制台获取后填入这里"
        },
        {
          id: "groq",
          label: "Groq",
          endpoint: "https://api.groq.com/openai/v1",
          model: "llama-3.3-70b-versatile",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "groqApiKey",
          apiKeyLabel: "Groq 密钥",
          apiKeyDesc: "在 Groq 控制台获取后填入这里"
        },
        {
          id: "mistral",
          label: "Mistral",
          endpoint: "https://api.mistral.ai/v1",
          model: "mistral-large-latest",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "mistralApiKey",
          apiKeyLabel: "Mistral 密钥",
          apiKeyDesc: "在 Mistral 控制台获取后填入这里"
        },
        {
          id: "together",
          label: "Together AI",
          endpoint: "https://api.together.xyz/v1",
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          defaultMaxTokens: 8192,
          defaultContextWindow: 131072,
          apiKeyKey: "togetherApiKey",
          apiKeyLabel: "Together 密钥",
          apiKeyDesc: "在 Together AI 官网获取后填入这里"
        },
        {
          id: "ollama",
          label: "Ollama（本地）",
          endpoint: "http://localhost:11434/v1",
          model: "llama3.1",
          defaultMaxTokens: 8192,
          defaultContextWindow: 32768,
          apiKeyKey: "ollamaApiKey",
          apiKeyLabel: "Ollama 密钥",
          apiKeyDesc: "本地服务无需密钥，留空即可"
        },
        {
          id: "custom",
          label: "自定义（OpenAI 兼容）",
          endpoint: "",
          model: "",
          defaultMaxTokens: 8192,
          defaultContextWindow: 32768,
          apiKeyKey: "aiCustomApiKey",
          apiKeyLabel: "自定义 API 密钥",
          apiKeyDesc: "在服务官网获取后填入这里"
        }
      ];
      _aiProviderCache = null;
      AIService = class {
        constructor(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
          this.defaultModel = defaultModel;
          this.defaultOptions = defaultOptions;
        }
        /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
         *  options.signal（取消）/ options.onDelta（流式增量回调）为调用方选项（ticket 141），不进请求体，
         *  既有调用（不传这两项）行为零变化 */
        async prompt(promptText, model = this.defaultModel, options = {}) {
          var _a;
          const mergedOptions = this._mergeOptions(options);
          const provider = await getAIProvider(mergedOptions.provider);
          const s = getQ3Settings();
          const isExplicit = model !== this.defaultModel;
          const effModel = isExplicit ? model : provider.model || model;
          const mo = mergedOptions.modelOptions || {};
          const effMaxTokens = (_a = mo.max_tokens) != null ? _a : provider.defaultMaxTokens || 4096;
          const body = {
            model: effModel,
            messages: [{ role: "user", content: promptText }],
            max_tokens: effMaxTokens,
            stream: true
          };
          for (const k of Object.keys(mo)) {
            if (k === "max_tokens") continue;
            body[k] = mo[k];
          }
          const signal = mergedOptions.signal instanceof AbortSignal ? mergedOptions.signal : void 0;
          const onDelta = typeof mergedOptions.onDelta === "function" ? mergedOptions.onDelta : void 0;
          try {
            const content = provider.noCors ? await chatCompletionsNonStream(provider, body, signal) : await streamChatCompletions(provider, body, signal, onDelta);
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
        /** 普通对话模型（deepseek-v4-flash） */
        async chat(promptText, extraOptions = {}) {
          return this.prompt(promptText, "deepseek-v4-flash", extraOptions);
        }
        /** 推理模型，自动开启思考模式 */
        async reason(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, { enable_thinking: true });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 联网搜索（实验性，第三方代理平台生效） */
        async search(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, { search: true });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 要求 AI 返回 JSON 格式（设置 response_format） */
        async json(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, {
            response_format: { type: "json_object" }
          });
          return this.prompt(promptText, "deepseek-v4-flash", options);
        }
        /** 思考 + 联网搜索（实验性） */
        async reasonAndSearch(promptText, extraOptions = {}) {
          const options = this._prepareOptions(extraOptions, {
            enable_thinking: true,
            search: true
          });
          return this.prompt(promptText, "deepseek-v4-flash", options);
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
    }
  });

  // src/review/quiz-core/manager.ts
  function storageDir2() {
    const s = tryGetSettings();
    return s && s.storagePath || "CONFIG/STORAGE";
  }
  function getQuizFilePath() {
    return storageFile("quiz.json", storageDir2());
  }
  function getReviewDataPath() {
    return storageFile("review.json", storageDir2());
  }
  async function loadActiveItems(app) {
    const data = await jsonFileStore(getReviewDataPath(), { app }).read();
    const items = Array.isArray(data) ? data : [];
    return items.filter((f) => f && !f.completed);
  }
  function sameQuestion(a, b) {
    if (a.question !== b.question) return false;
    if (a.options.length !== b.options.length) return false;
    for (let i = 0; i < a.options.length; i++) {
      if (a.options[i] !== b.options[i]) return false;
    }
    const sa = [...a.correctIndices].sort();
    const sb = [...b.correctIndices].sort();
    if (sa.length !== sb.length) return false;
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }
  var QuizManager;
  var init_manager = __esm({
    "src/review/quiz-core/manager.ts"() {
      init_storage();
      init_settings_provider();
      QuizManager = class {
        /** 加载（源码 L33-35；损坏 → {notes:{}}） */
        async loadQuiz(app) {
          try {
            const data = await jsonFileStore(getQuizFilePath(), {
              defaultValue: { notes: {} },
              app
            }).read();
            if (data && typeof data === "object" && data.notes) return data;
            return { notes: {} };
          } catch (e) {
            return { notes: {} };
          }
        }
        async saveQuiz(app, quiz) {
          await jsonFileStore(getQuizFilePath(), { app }).write(quiz);
        }
        /** 源码 L40-43 */
        async getQuestionsForNote(app, notePath) {
          const quiz = await this.loadQuiz(app);
          return quiz.notes[notePath] || null;
        }
        /** 源码 L45-49 */
        async saveQuestionsForNote(app, notePath, questions) {
          const quiz = await this.loadQuiz(app);
          quiz.notes[notePath] = questions.map((q) => ({ ...q }));
          await this.saveQuiz(app, quiz);
        }
        /** 源码 L51-57 splice 语义 + P0-2 稳定定位改造：
         *  会话期 _index 是开考时的快照，题库并发变化（同笔记多题先后答对、复习重出题等）
         *  后按快照下标会删错行/漏删；改为按题目生成标识（question+options+correctIndices，
         *  correctIndices 顺序不敏感）在存储数组内定位。
         *  同内容多题：每次删除首个匹配＝按未答优先逐个消费。
         *  目标题已不在库中（并发刷新等）→ 终态已达成，静默成功；空键仍保留（源码语义）。 */
        async removeQuestion(app, notePath, target) {
          const quiz = await this.loadQuiz(app);
          const list = quiz.notes[notePath];
          if (!list) return;
          const idx = list.findIndex((q) => sameQuestion(q, target));
          if (idx === -1) return;
          list.splice(idx, 1);
          await this.saveQuiz(app, quiz);
        }
        /** 源码 L59-72：遍历补 notePath/_index */
        async getUncompletedQuestions(app) {
          const quiz = await this.loadQuiz(app);
          const out = [];
          for (const [notePath, questions] of Object.entries(quiz.notes)) {
            questions.forEach((q, i) => {
              out.push({ ...q, notePath, _index: i });
            });
          }
          return out;
        }
        /** 源码 L74-87 */
        async getAllQuestions(app) {
          return this.getUncompletedQuestions(app);
        }
      };
    }
  });

  // src/review/quiz-core/generator.ts
  var QuestionGenerator;
  var init_generator = __esm({
    "src/review/quiz-core/generator.ts"() {
      QuestionGenerator = class {
        /** 构建提示词（源码 L92-128 逐字；item 3 增 explain 字段：一句话解析+原文依据） */
        buildPrompt(content, enableMultipleChoice, questionsPerNote, difficulty) {
          const truncated = content.slice(0, 3e3);
          let typeHint = "单选题（四选一）";
          let structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0], "explain": "一句话解析+原文依据" }`;
          if (enableMultipleChoice) {
            typeHint = "可以是单选题或多选题（正确选项数量不限）";
            structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0, 2], "explain": "一句话解析+原文依据" }（数组内为正确选项的索引）`;
          }
          let countHint = "";
          if (questionsPerNote > 0) {
            countHint = `请生成恰好 ${questionsPerNote} 道题目。`;
          } else {
            countHint = "生成若干道题目（数量适中，建议 3~6 道）。";
          }
          let difficultyHint = "";
          if (difficulty === "easy") {
            difficultyHint = "请生成基础概念题，选项区分度明显，避免陷阱，难度较低。";
          } else if (difficulty === "medium") {
            difficultyHint = "生成中等难度题目，可包含细节辨析，选项有一定迷惑性。";
          } else if (difficulty === "hard") {
            difficultyHint = "生成高难度题目，可涉及推理、多知识点交叉，选项具有较强迷惑性。";
          }
          return `根据以下笔记内容，生成若干道四选一的选择题（每题一个正确答案），数量适中，以便复习。请仅返回一个合法的 JSON 对象，结构如下：
{
  "questions": [
    ${structure}
  ]
}
注意：题目类型为 ${typeHint}，${countHint}
${difficultyHint}
每题必须带 explain 字段：用一句话解析正确答案，并附原文依据（简短引用或出处）。
笔记内容：
${truncated}`;
        }
        /** 提取 JSON（源码 L129-138 逐字） */
        extractJSON(text) {
          const code = text.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (code) {
            try {
              return JSON.parse(code[1].trim());
            } catch (e) {
            }
          }
          try {
            return JSON.parse(text.trim());
          } catch (e) {
          }
          const first = text.indexOf("{");
          const last = text.lastIndexOf("}");
          if (first !== -1 && last !== -1 && last > first) {
            try {
              return JSON.parse(text.substring(first, last + 1));
            } catch (e) {
            }
          }
          throw new Error("无法从 AI 响应中提取有效的 JSON");
        }
        /** 生成题目（单篇，源码 L139-159 逐字） */
        async generate(noteContent, aiService, enableMultipleChoice, questionsPerNote, difficulty) {
          var _a;
          const prompt = this.buildPrompt(noteContent, enableMultipleChoice, questionsPerNote, difficulty);
          const result = await aiService.json(prompt);
          const parsed = this.extractJSON(result);
          if (!((_a = parsed.questions) == null ? void 0 : _a.length)) throw new Error("AI 未返回有效题目数组。");
          for (const q of parsed.questions) {
            if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
              throw new Error("题目格式不正确：缺少 question 或 options 不是长度为4的数组");
            }
            if (!Array.isArray(q.correctIndices) || q.correctIndices.length === 0) {
              throw new Error("题目格式不正确：correctIndices 必须是非空数组");
            }
            for (const idx of q.correctIndices) {
              if (typeof idx !== "number" || idx < 0 || idx > 3) {
                throw new Error("correctIndices 元素必须在 0~3 之间");
              }
            }
          }
          return parsed.questions;
        }
        /** 批量提示词（源码 L162-191 逐字；item 3 增 explain 规则） */
        buildBatchPrompt(notes, enableMultipleChoice, questionsPerNote, difficulty) {
          let typeHint = "单选题（四选一）";
          let structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0], "explain": "一句话解析+原文依据" }`;
          if (enableMultipleChoice) {
            typeHint = "可以是单选题或多选题";
            structure = `{ "question": "题目文本", "options": ["A选项","B选项","C选项","D选项"], "correctIndices": [0, 2], "explain": "一句话解析+原文依据" }`;
          }
          const countHint = questionsPerNote > 0 ? `每篇生成恰好 ${questionsPerNote} 道。` : "每篇生成 3~6 道。";
          let difficultyHint = "";
          if (difficulty === "easy") difficultyHint = "生成基础概念题，难度较低。";
          else if (difficulty === "medium") difficultyHint = "生成中等难度题目。";
          else if (difficulty === "hard") difficultyHint = "生成高难度题目，涉及推理和多知识点交叉。";
          let notesBlock = "";
          for (const n of notes) {
            notesBlock += `
===== 笔记ID:${n.id} =====
${n.content.slice(0, 2e3)}
`;
          }
          return `根据以下多篇笔记内容，为每篇笔记生成选择题。请仅返回一个合法的 JSON 对象：
{
  "noteId1": [ { "question": "...", "options": ["A","B","C","D"], "correctIndices": [0], "explain": "..." }, ... ],
  "noteId2": [ ... ]
}
规则：
- 类型：${typeHint}，${countHint}
- ${difficultyHint}
- 每题必须带 explain 字段：一句话解析正确答案并附原文依据
- 键名为笔记ID（即 "笔记ID:xxx" 中的 xxx），值为该笔记的题目数组
- 每题4个选项，correctIndices 为正确选项索引数组
笔记内容：${notesBlock}`;
        }
        /** 批量生成（源码 L193-212 逐字） */
        async generateBatch(notes, aiService, enableMultipleChoice, questionsPerNote, difficulty) {
          const prompt = this.buildBatchPrompt(notes, enableMultipleChoice, questionsPerNote, difficulty);
          const result = await aiService.json(prompt);
          const parsed = this.extractJSON(result);
          const out = {};
          for (const [noteId, qs] of Object.entries(parsed)) {
            if (!Array.isArray(qs)) continue;
            const valid = [];
            for (const q of qs) {
              if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || !Array.isArray(q.correctIndices)) {
                continue;
              }
              const indices = q.correctIndices.filter((i) => typeof i === "number" && i >= 0 && i <= 3);
              if (!indices.length) continue;
              valid.push({ ...q, correctIndices: indices });
            }
            if (valid.length) out[noteId] = valid;
          }
          return out;
        }
      };
    }
  });

  // src/review/quiz-core/session.ts
  function cleanOptionText(text) {
    if (!text) return "";
    const match = text.match(/^([A-D])\s*[.、:：)）]\s*/);
    if (match) {
      return text.substring(match[0].length).trim();
    }
    const matchParen = text.match(/^\(([A-D])\)\s*/);
    if (matchParen) {
      return text.substring(matchParen[0].length).trim();
    }
    return text.trim();
  }
  var CORRECT_JUMP_DELAY_MS, _QuizMasterUI, QuizMasterUI, quizUI;
  var init_session = __esm({
    "src/review/quiz-core/session.ts"() {
      init_notice();
      init_flow_dialog();
      init_esc_manager();
      init_z_order();
      init_app();
      init_manager();
      init_generator();
      init_utils();
      CORRECT_JUMP_DELAY_MS = 800;
      _QuizMasterUI = class _QuizMasterUI {
        constructor() {
          /**
           * 实例镜像：复习域经 quizUI.ai 读取。静态属性不挂在实例上（JS 中 quizUI.ai 恒为
           * undefined），故 ensureQuiz 时同步设置本字段，复习域判断才生效。
           */
          this.ai = null;
          this.mask = null;
          this.popup = null;
          this.currentQuestions = [];
          this.currentIndex = 0;
          // 复习联动（仅经 startReviewSession/endReviewSession 契约访问，复习域不得直接改写）
          // ticket 141：普通做题模式删除（独立入口 ticket 098 退役后已是死代码）——做题家只是
          // 复习流程中的一环，会话只能经 startReviewSession 开启，不再存在「无 onComplete 的裸会话」
          this._sessionActive = false;
          this.onComplete = null;
          this.correctCount = 0;
          this.wrongCount = 0;
          this.totalQuestions = 0;
          this.generator = new QuestionGenerator();
          /** ticket 098:多选提交按钮暂存（renderModal 选项后补挂，保证位于选项下方） */
          this._pendingSubmitBtn = null;
          /** ticket 141：做题键盘快捷键句柄（1-4/A-D 选择、Enter 提交/下一题；ESC 走 escManager） */
          this._keyHandler = null;
          /** ticket 156：答对自动跳题延时句柄（亮绿 0.8s 再进下一题） */
          this._jumpTimer = null;
          this._manager = null;
        }
        shuffleArray(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }
        /** 更新题库（基于活跃笔记，空题目则生成；失败 Notice 逐字） */
        async updateQuiz() {
          const app = getApp();
          try {
            const activeItems = await loadActiveItems(app);
            if (!activeItems.length) {
              await this.manager.saveQuiz(getApp(), { notes: {} });
              return;
            }
            const quiz = await this.manager.loadQuiz(app);
            const activePaths = new Set(activeItems.map((i) => i.filePath));
            for (const notePath of Object.keys(quiz.notes)) {
              if (!activePaths.has(notePath)) {
                delete quiz.notes[notePath];
              }
            }
            await this.manager.saveQuiz(app, quiz);
            const notePaths = activeItems.map((i) => i.filePath);
            await this.ensureQuestions(notePaths);
          } catch (e) {
            notice("更新题库失败：" + e.message + "，请重试", "error");
            console.error(e);
          }
        }
        /** 确保指定笔记都有题目（源码 L346-398 逐字） */
        async ensureQuestions(notePaths) {
          const app = getApp();
          const quiz = await this.manager.loadQuiz(app);
          const settings = _QuizMasterUI.settings || {};
          const enableMultipleChoice = settings.enableMultipleChoice !== false;
          const questionsPerNote = parseInt(settings.questionsPerNote) || 0;
          const difficulty = settings.difficulty || "random";
          const missing = [];
          for (const path of notePaths) {
            const existing = quiz.notes[path];
            if (!existing || existing.length === 0) {
              const file = app.vault.getAbstractFileByPath(path);
              if (!file) continue;
              const content = await app.vault.read(file);
              if (content.trim()) missing.push({ id: path, content });
            }
          }
          if (!missing.length) return;
          if (_QuizMasterUI.ai) {
            try {
              const h = notify(`正在为 ${missing.length} 篇笔记批量生成题目…`, { type: "progress", dedupeKey: "quiz-generate" });
              const batchResult = await this.generator.generateBatch(missing, _QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
              let batchOk = 0;
              for (const [path, qs] of Object.entries(batchResult)) {
                if (qs.length) {
                  quiz.notes[path] = qs;
                  batchOk++;
                }
              }
              await this.manager.saveQuiz(app, quiz);
              h.setType("success");
              h.setMessage(`已为 ${batchOk} 篇笔记生成题目`);
              return;
            } catch (e) {
              console.warn("批量出题失败，降级为逐篇:", e.message);
              notify("批量出题失败，已改为逐篇生成", { type: "warning", dedupeKey: "quiz-generate" });
            }
          }
          let okCount = 0;
          let failCount = 0;
          let firstError = "";
          for (const note of missing) {
            try {
              if (!_QuizMasterUI.ai) throw new Error("AI 未初始化");
              const qs = await this.generator.generate(note.content, _QuizMasterUI.ai, enableMultipleChoice, questionsPerNote, difficulty);
              if (qs.length) {
                quiz.notes[note.id] = qs;
                okCount++;
                await this.manager.saveQuiz(app, quiz);
              } else {
                failCount++;
              }
            } catch (e) {
              console.warn(`出题失败 ${note.id}:`, e.message);
              if (!firstError) firstError = e.message || "未知错误";
              failCount++;
            }
          }
          if (okCount > 0) notify(`已为 ${okCount} 篇笔记生成题目`, { type: "success" });
          if (failCount > 0) notify(`${failCount} 篇笔记出题失败${firstError ? `（${firstError}）` : ""}`, { type: "warning", dedupeKey: "quiz-generate" });
        }
        /** ticket 141：普通做题模式（startQuiz/showLoadingPopup）删除——独立入口 ticket 098 退役后
         *  已无调用方，做题家只作为复习流程一环经 startReviewSession 进入。 */
        /**
         * 复习联动契约：开始一轮做题会话（复习计划经此进入做题模式）——ticket 141 起唯一入口。
         * 会话状态（_sessionActive/currentQuestions/计数/onComplete）只允许在本方法内设置，
         * 复习域禁止直接改写——契约化后复习域只需调用本方法与 endReviewSession。
         * 「打乱出题顺序」设置在会话入口生效（原普通模式行为迁移，设置项保留语义不变）。
         */
        startReviewSession(opts) {
          var _a;
          this._sessionActive = true;
          const shuffle = ((_a = _QuizMasterUI.settings) == null ? void 0 : _a.shuffleQuestions) !== false;
          this.currentQuestions = shuffle ? this.shuffleArray([...opts.questions]) : [...opts.questions];
          this.currentIndex = 0;
          this.correctCount = 0;
          this.wrongCount = 0;
          this.totalQuestions = this.currentQuestions.length;
          this.onComplete = opts.onComplete;
          this.showQuestion();
        }
        /** 复习联动契约：结束做题会话（结算回调已消费后由复习域调用，收尾弹窗；防御性结算防悬挂） */
        endReviewSession() {
          const cb = this.onComplete;
          this.onComplete = null;
          this._sessionActive = false;
          if (cb) cb(this._buildResults());
          this._teardownModal();
        }
        /** 渲染单题（源码 L514-676 逐字） */
        renderModal(q) {
          this._teardownModal();
          this._pendingSubmitBtn = null;
          const mask = document.createElement("div");
          mask.id = "quiz-mask";
          this.mask = mask;
          mask.style.zIndex = String(allocZ());
          const popup = document.createElement("div");
          popup.id = "quiz-popup";
          this.popup = popup;
          const header = document.createElement("div");
          header.className = "bz-quiz-head";
          const title = document.createElement("span");
          title.className = "bz-quiz-title";
          const noteName = q.notePath ? q.notePath.split("/").pop().replace(".md", "") : "";
          const doneCount = this.totalQuestions - this.currentQuestions.length;
          title.textContent = noteName ? `📝 ${noteName} (${doneCount + 1}/${this.totalQuestions})` : `📝 (${doneCount + 1}/${this.totalQuestions})`;
          header.appendChild(title);
          popup.appendChild(header);
          const questionDiv = document.createElement("div");
          questionDiv.className = "bz-quiz-question";
          questionDiv.textContent = q.question;
          popup.appendChild(questionDiv);
          const optionsContainer = document.createElement("div");
          optionsContainer.className = "bz-quiz-options";
          const selectedIndices = /* @__PURE__ */ new Set();
          const answeredRef = { value: false };
          const optionElements = this._buildOptionButtons(q, answeredRef, selectedIndices, optionsContainer);
          optionElements.forEach((el) => optionsContainer.appendChild(el));
          if (this._pendingSubmitBtn) {
            optionsContainer.appendChild(this._pendingSubmitBtn);
            this._pendingSubmitBtn = null;
          }
          popup.appendChild(optionsContainer);
          mask.appendChild(popup);
          document.body.appendChild(mask);
          escManager.register("quiz", {
            isVisible: () => !!(this.mask && this.mask.isConnected),
            close: () => this.finishQuiz()
          });
          this._bindKeyboard();
          mask.addEventListener("click", (e) => {
            if (e.target === mask) this.finishQuiz();
          });
        }
        /**
         * ticket 141：做题键盘快捷键（1-4/A-D 选择、Enter 提交/下一题）。
         * 焦点在按钮/输入框上时原生行为优先（防 Enter 双触发）；ESC 不在此处理（escManager 层级）。
         */
        _bindKeyboard() {
          this._unbindKeyboard();
          this._keyHandler = (e) => {
            var _a, _b, _c;
            if (!this.mask || !this.mask.isConnected) return;
            const target = e.target;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "BUTTON")) return;
            const keys = ["1", "2", "3", "4"];
            const letters = ["a", "b", "c", "d"];
            const key = e.key.toLowerCase();
            const idx = keys.includes(key) ? keys.indexOf(key) : letters.indexOf(key);
            if (idx >= 0 && idx <= 3) {
              const btn = (_a = this.popup) == null ? void 0 : _a.querySelector(`.quiz-option-btn[data-index="${idx}"]`);
              if (btn && !btn.classList.contains("disabled")) btn.click();
              return;
            }
            if (e.key === "Enter") {
              const submit = (_b = this.popup) == null ? void 0 : _b.querySelector(".quiz-submit-btn");
              if (submit && !submit.disabled) {
                submit.click();
                return;
              }
              const next = (_c = this.popup) == null ? void 0 : _c.querySelector(".quiz-next-btn");
              if (next && !next.disabled) next.click();
            }
          };
          document.addEventListener("keydown", this._keyHandler);
        }
        _unbindKeyboard() {
          if (this._keyHandler) {
            document.removeEventListener("keydown", this._keyHandler);
            this._keyHandler = null;
          }
        }
        /** ticket 156：清除答对自动跳题延时（换题/结算/强制关闭时防迟到渲染） */
        _clearJumpTimer() {
          if (this._jumpTimer) {
            clearTimeout(this._jumpTimer);
            this._jumpTimer = null;
          }
        }
        /** 选项按钮组构建与答题逻辑（renderModal 拆分）：单选即点即判 / 多选切换 + 提交 */
        _buildOptionButtons(q, answeredRef, selectedIndices, optionsContainer) {
          const optionLabels = ["A", "B", "C", "D"];
          const isSingle = q.correctIndices.length === 1;
          const app = getApp();
          const optionElements = q.options.map((opt, idx) => {
            const btn = document.createElement("button");
            btn.className = "quiz-option-btn";
            const cleanText = cleanOptionText(opt);
            btn.innerHTML = `<span>${optionLabels[idx]}.</span><span class="bz-quiz-option-text">${escapeHtml(cleanText)}</span><span class="check-mark">✔️</span>`;
            btn.dataset.index = String(idx);
            btn.onclick = () => {
              if (answeredRef.value) return;
              if (isSingle) {
                answeredRef.value = true;
                optionElements.forEach((b) => b.classList.add("disabled"));
                const isCorrect = idx === q.correctIndices[0];
                if (isCorrect) {
                  optionElements.forEach((b, i) => {
                    if (i === q.correctIndices[0]) b.classList.add("correct");
                  });
                  this._answerCorrect(q, app, () => {
                    answeredRef.value = false;
                    optionElements.forEach((b) => b.classList.remove("disabled"));
                  });
                } else {
                  this.wrongCount++;
                  this.currentQuestions.splice(this.currentIndex, 1);
                  optionElements.forEach((b, i) => {
                    if (i === q.correctIndices[0]) b.classList.add("correct");
                    if (i === idx) b.classList.add("wrong");
                  });
                  this.addNextButton(optionsContainer);
                }
              } else {
                if (selectedIndices.has(idx)) {
                  selectedIndices.delete(idx);
                  btn.classList.remove("selected");
                } else {
                  selectedIndices.add(idx);
                  btn.classList.add("selected");
                }
              }
            };
            return btn;
          });
          if (!isSingle) {
            const submitBtn = document.createElement("button");
            submitBtn.className = "quiz-submit-btn";
            submitBtn.textContent = "提交答案";
            submitBtn.onclick = () => {
              if (answeredRef.value) return;
              if (selectedIndices.size === 0) {
                notice("请至少选择一项", "warning");
                return;
              }
              answeredRef.value = true;
              submitBtn.disabled = true;
              const selected = Array.from(selectedIndices).sort();
              const correct = q.correctIndices.slice().sort();
              const isCorrect = selected.length === correct.length && selected.every((v, i) => v === correct[i]);
              optionElements.forEach((b, i) => {
                b.classList.add("disabled");
                if (correct.includes(i)) b.classList.add("correct");
                else if (selectedIndices.has(i) && !isCorrect) b.classList.add("wrong");
              });
              if (isCorrect) {
                this._answerCorrect(q, app, () => {
                  answeredRef.value = false;
                  submitBtn.disabled = false;
                  optionElements.forEach((b) => b.classList.remove("disabled"));
                });
              } else {
                this.wrongCount++;
                this.currentQuestions.splice(this.currentIndex, 1);
                this.addNextButton(optionsContainer);
              }
            };
            this._pendingSubmitBtn = submitBtn;
          }
          return optionElements;
        }
        /** 答对公共链路（ticket 141 重构）：稳定定位删题 → 计数 → splice 出当前题 → 自动进入下一题。
         *  删除按题目内容在存储数组定位（P0-2），不再依赖会话期 _index 快照；
         *  持久化成功后才计数并跳题（P2：失败恢复作答态时不重复计数），失败通知并恢复作答状态；
         *  ticket 153：答对自动跳下一题（答对不出现「下一题」按钮，答错才由用户点按）；
         *  ticket 156：跳题延后 0.8s——亮绿正确选项让用户看到反馈再进入下一题；
         *  延时期间放弃做题/强制关闭 → 清除延时（回调内再校验会话态，防迟到渲染僵尸弹窗）。 */
        _answerCorrect(q, app, onFailRestore) {
          this.manager.removeQuestion(app, q.notePath, { question: q.question, options: q.options, correctIndices: q.correctIndices }).then(() => {
            this.correctCount++;
            this.currentQuestions.splice(this.currentIndex, 1);
            this._clearJumpTimer();
            this._jumpTimer = setTimeout(() => {
              this._jumpTimer = null;
              if (!this._sessionActive) return;
              this.showQuestion();
            }, CORRECT_JUMP_DELAY_MS);
          }).catch((e) => {
            notice("删除题目失败：" + e.message + "，请重试", "error");
            onFailRestore();
          });
        }
        /** 汇总本轮做题统计（showQuestion 完题 / finishQuiz 共用） */
        _buildResults() {
          const total = this.correctCount + this.wrongCount;
          return {
            correct: this.correctCount,
            wrong: this.wrongCount,
            total,
            accuracy: total > 0 ? Math.round(this.correctCount / total * 100) : 0
          };
        }
        /** 渲染单题（源码 L679-697 逐字） */
        showQuestion() {
          if (this.currentIndex >= this.currentQuestions.length) {
            if (this.onComplete) {
              const cb = this.onComplete;
              this.onComplete = null;
              cb(this._buildResults());
            }
            return;
          }
          this.renderModal(this.currentQuestions[this.currentIndex]);
        }
        /**
         * 辅助：添加「下一题」按钮（ticket 153：仅答错时出现——答对自动进入下一题，无需按钮；
         * 答错由用户点按进入下一题）。
         */
        addNextButton(popup) {
          const oldBtn = popup.querySelector(".quiz-next-btn");
          if (oldBtn) oldBtn.remove();
          const nextBtn = document.createElement("button");
          nextBtn.className = "quiz-next-btn";
          nextBtn.textContent = "下一题 →";
          nextBtn.onclick = () => {
            this.showQuestion();
          };
          popup.appendChild(nextBtn);
        }
        /** 仅拆除弹窗 DOM（换题/结果卡等内部过渡用，不走结算语义；连带注销键盘监听） */
        _teardownModal() {
          this._unbindKeyboard();
          if (this.mask && this.mask.parentNode) this.mask.remove();
          this.mask = null;
          this.popup = null;
        }
        /**
         * 点遮罩 / ESC（ticket 141：纯复习会话语义，原「普通模式直接关窗」分支随模式删除）。
         * 答题中途（回调未消费）→ 先确认「放弃本次做题？」，确认才按既有语义结算；
         * 结果卡阶段（回调已消费，复习域驱动下一步）→ 忽略，防止中途拆 DOM 令复习循环 Promise 悬挂。
         */
        finishQuiz() {
          if (!this._sessionActive || !this.onComplete) return;
          void openFlowDialog({
            title: "放弃本次做题？",
            message: "未完成的题目将丢弃，本次复习将按已答题目结算评级",
            actions: [
              { label: "继续做题", value: "cancel" },
              { label: "放弃", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok") return;
            this._clearJumpTimer();
            const cb = this.onComplete;
            this.onComplete = null;
            this._sessionActive = false;
            if (cb) cb(this._buildResults());
            this._teardownModal();
          });
        }
        /** 强制关闭（复习域契约调用，如结果卡「复习此笔记」）：回调防御性结算，避免外层 Promise 悬挂 */
        close() {
          this._clearJumpTimer();
          const cb = this.onComplete;
          this.onComplete = null;
          this._sessionActive = false;
          if (cb) cb(this._buildResults());
          this._teardownModal();
        }
        get manager() {
          if (!this._manager) this._manager = new QuizManager();
          return this._manager;
        }
      };
      _QuizMasterUI.ai = null;
      _QuizMasterUI.settings = {};
      QuizMasterUI = _QuizMasterUI;
      quizUI = new QuizMasterUI();
    }
  });

  // src/review/quiz-core/index.ts
  var quiz_core_exports = {};
  __export(quiz_core_exports, {
    QuizMasterUI: () => QuizMasterUI,
    ensureQuiz: () => ensureQuiz,
    quizUI: () => quizUI,
    quizUpdate: () => quizUpdate
  });
  function ensureQuiz(app) {
    if (initialized) return;
    initialized = true;
    QuizMasterUI.ai = createAI();
    quizUI.ai = QuizMasterUI.ai;
    QuizMasterUI.settings = getSettings();
  }
  async function quizUpdate(app) {
    ensureQuiz(app);
    await quizUI.updateQuiz();
  }
  var initialized;
  var init_quiz_core = __esm({
    "src/review/quiz-core/index.ts"() {
      init_ai();
      init_settings_provider();
      init_session();
      initialized = false;
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
  function uiIconBtn(opts) {
    const b = document.createElement("button");
    b.type = "button";
    const cls = ["bz-icon-btn"];
    if (opts.on) cls.push("bz-icon-btn--on");
    if (opts.lg) cls.push("bz-icon-btn--lg");
    if (opts.xs) cls.push("bz-icon-btn--xs");
    if (opts.close) cls.push("bz-icon-btn--close");
    if (opts.className) cls.push(opts.className);
    b.className = cls.join(" ");
    if (opts.title) b.title = opts.title;
    if (opts.disabled) b.disabled = true;
    if (opts.danger) b.setAttribute("data-danger", "");
    b.appendChild(uiIcon(opts.icon));
    if (opts.onClick) b.addEventListener("click", opts.onClick);
    return b;
  }
  function uiBtnRow(buttons, opts) {
    const row = document.createElement("div");
    const cls = ["bz-btn-row"];
    if (opts == null ? void 0 : opts.center) cls.push("bz-btn-row--center");
    if (opts == null ? void 0 : opts.grow) cls.push("bz-btn-row--grow");
    row.className = cls.join(" ");
    buttons.forEach((x) => row.appendChild(x));
    return row;
  }
  function uiDialogActions(opts) {
    const cancel = uiBtn({ label: opts.cancelText || "取消", onClick: opts.onCancel });
    const ok = uiBtn({ label: opts.okText, tone: opts.okTone || "primary", onClick: opts.onOk });
    const row = uiBtnRow([cancel, ok]);
    return { row, cancelBtn: cancel, okBtn: ok };
  }
  var init_button = __esm({
    "src/core/ui/button.ts"() {
      init_icon();
    }
  });

  // src/core/ui/chip.ts
  function uiChip(opts) {
    const c = document.createElement("button");
    c.type = "button";
    const cls = ["bz-chip"];
    if (opts.selected) cls.push("bz-chip--on");
    else if (opts.selectedSoft) cls.push("bz-chip--sel");
    if (opts.locked) cls.push("bz-chip--locked");
    c.className = cls.join(" ");
    if (opts.title) c.title = opts.title;
    if (opts.disabled) c.disabled = true;
    if (opts.icon) c.appendChild(uiIcon(opts.icon));
    const label = document.createElement("span");
    label.textContent = opts.label;
    c.appendChild(label);
    if (typeof opts.count === "number") {
      const cnt = document.createElement("span");
      cnt.className = "bz-chip-cnt";
      cnt.textContent = String(opts.count);
      c.appendChild(cnt);
    }
    if (opts.removable && !opts.locked) {
      const x = document.createElement("span");
      x.className = "bz-chip-x";
      x.setAttribute("role", "button");
      x.setAttribute("aria-label", `移除 ${opts.label}`);
      x.tabIndex = 0;
      x.appendChild(uiIcon("x"));
      x.addEventListener("click", (e) => {
        var _a;
        e.stopPropagation();
        (_a = opts.onRemove) == null ? void 0 : _a.call(opts);
      });
      x.addEventListener("keydown", (e) => {
        var _a;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          (_a = opts.onRemove) == null ? void 0 : _a.call(opts);
        }
      });
      c.appendChild(x);
    }
    if (opts.onClick) c.addEventListener("click", () => {
      var _a;
      return (_a = opts.onClick) == null ? void 0 : _a.call(opts);
    });
    return c;
  }
  var init_chip = __esm({
    "src/core/ui/chip.ts"() {
      init_icon();
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
  function uiField(opts) {
    const wrap = document.createElement("label");
    wrap.className = "bz-field";
    if (opts.label) {
      const l = document.createElement("span");
      l.className = "bz-field-label";
      l.textContent = opts.label;
      wrap.appendChild(l);
    }
    wrap.appendChild(opts.control);
    if (opts.error) {
      if (opts.control.classList.contains("bz-input")) opts.control.classList.add("bz-input--error");
      const e = document.createElement("span");
      e.className = "bz-field-error";
      e.textContent = opts.error;
      wrap.appendChild(e);
    } else if (opts.desc) {
      const d = document.createElement("span");
      d.className = "bz-field-desc";
      d.textContent = opts.desc;
      wrap.appendChild(d);
    }
    return wrap;
  }
  var init_field = __esm({
    "src/core/ui/field.ts"() {
    }
  });

  // src/core/ui/slider.ts
  function uiRange(opts) {
    const el = document.createElement("input");
    el.type = "range";
    el.className = "bz-range" + (opts.className ? " " + opts.className : "");
    if (opts.min !== void 0) el.min = String(opts.min);
    if (opts.max !== void 0) el.max = String(opts.max);
    if (opts.step !== void 0) el.step = String(opts.step);
    if (opts.value !== void 0) el.value = String(opts.value);
    if (opts.disabled) el.disabled = true;
    if (opts.onInput) el.addEventListener("input", () => {
      var _a;
      return (_a = opts.onInput) == null ? void 0 : _a.call(opts, parseFloat(el.value));
    });
    if (opts.onChange) el.addEventListener("change", () => {
      var _a;
      return (_a = opts.onChange) == null ? void 0 : _a.call(opts, parseFloat(el.value));
    });
    return el;
  }
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
  function uiSegmented(opts) {
    const el = document.createElement("div");
    el.className = "bz-segmented" + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "radiogroup");
    el.setAttribute("aria-label", opts.label || "");
    const btns = /* @__PURE__ */ new Map();
    opts.options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bz-segmented-btn" + (o.value === opts.value ? " is-on" : "");
      b.textContent = o.label;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === opts.value));
      b.addEventListener("click", () => {
        setValue(o.value);
        opts.onChange(o.value);
      });
      b.addEventListener("keydown", (e) => {
        var _a;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const vals = opts.options.map((x) => x.value);
        const curIdx = vals.indexOf(current2());
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (curIdx + delta + vals.length) % vals.length;
        setValue(vals[nextIdx]);
        opts.onChange(vals[nextIdx]);
        (_a = btns.get(vals[nextIdx])) == null ? void 0 : _a.focus();
      });
      btns.set(o.value, b);
      el.appendChild(b);
    });
    let cur = opts.value;
    function current2() {
      return cur;
    }
    function setValue(v) {
      cur = v;
      btns.forEach((b, k) => {
        const on = k === v;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
    }
    return { el, setValue };
  }
  var init_segmented = __esm({
    "src/core/ui/segmented.ts"() {
    }
  });

  // src/core/ui/choice.ts
  function uiChoice(opts) {
    const el = document.createElement("div");
    el.className = "bz-choice" + (opts.float ? " bz-choice--float" : "") + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "radiogroup");
    el.setAttribute("aria-label", opts.label || "");
    const btns = /* @__PURE__ */ new Map();
    let cur = opts.value;
    const seg = document.createElement("span");
    seg.className = "bz-choice-seg";
    let segRAF = 0;
    let segTries = 0;
    const syncSeg = (animate) => {
      if (!opts.float) return;
      const on = el.querySelector(".bz-choice-btn.is-on");
      if (!on) return;
      const tb = el.getBoundingClientRect();
      const bb = on.getBoundingClientRect();
      if (!el.isConnected || !tb.width || !bb.width) {
        if (segTries++ > 120) return;
        cancelAnimationFrame(segRAF);
        segRAF = requestAnimationFrame(() => syncSeg(false));
        return;
      }
      segTries = 0;
      if (!animate) seg.style.transition = "none";
      seg.style.width = `${bb.width}px`;
      seg.style.transform = `translateX(${bb.left - tb.left}px)`;
      if (!animate) {
        void seg.offsetWidth;
        seg.style.transition = "";
      }
    };
    const onWinResize = () => syncSeg(false);
    if (opts.float) {
      window.addEventListener("resize", onWinResize);
    }
    opts.options.forEach((o) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bz-choice-btn" + (o.value === opts.value ? " is-on" : "");
      b.dataset.value = String(o.value);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.value === opts.value));
      if (o.dot) {
        const d = document.createElement("span");
        d.className = "bz-choice-dot";
        d.style.background = o.dot;
        b.appendChild(d);
      }
      b.appendChild(document.createTextNode(o.label));
      b.addEventListener("click", () => {
        setValue(o.value);
        opts.onChange(o.value);
      });
      b.addEventListener("keydown", (e) => {
        var _a;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const vals = opts.options.map((x) => x.value);
        const curIdx = vals.indexOf(cur);
        const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = (curIdx + delta + vals.length) % vals.length;
        setValue(vals[nextIdx]);
        opts.onChange(vals[nextIdx]);
        (_a = btns.get(vals[nextIdx])) == null ? void 0 : _a.focus();
      });
      btns.set(o.value, b);
      el.appendChild(b);
    });
    if (opts.float) el.appendChild(seg);
    function setValue(v) {
      cur = v;
      btns.forEach((b, k) => {
        const on = k === v;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
      if (opts.float) syncSeg(true);
    }
    syncSeg(false);
    const detach = () => {
      cancelAnimationFrame(segRAF);
      window.removeEventListener("resize", onWinResize);
    };
    return { el, setValue, detach };
  }
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
  function uiSwitch(opts) {
    const el = document.createElement("span");
    el.className = "bz-sw" + (opts.checked ? " on" : "") + (opts.disabled ? " is-disabled" : "");
    el.setAttribute("role", "switch");
    el.setAttribute("aria-checked", String(!!opts.checked));
    el.setAttribute("aria-disabled", String(!!opts.disabled));
    el.tabIndex = opts.disabled ? -1 : 0;
    const setChecked = (v) => {
      el.classList.toggle("on", v);
      el.setAttribute("aria-checked", String(v));
    };
    const setDisabled = (v) => {
      el.classList.toggle("is-disabled", v);
      el.setAttribute("aria-disabled", String(v));
      el.tabIndex = v ? -1 : 0;
    };
    const enabled = () => !el.classList.contains("is-disabled");
    const toggle = () => {
      var _a;
      if (!enabled()) return;
      const next = !el.classList.contains("on");
      setChecked(next);
      (_a = opts.onChange) == null ? void 0 : _a.call(opts, next);
    };
    el.addEventListener("click", toggle);
    el.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    });
    return { el, setChecked, setDisabled };
  }
  var init_switch = __esm({
    "src/core/ui/switch.ts"() {
    }
  });

  // src/core/ui/select.ts
  function uiSelect(opts) {
    const el = document.createElement("div");
    el.className = "bz-select" + (opts.className ? " " + opts.className : "");
    el.setAttribute("role", "listbox");
    el.setAttribute("aria-expanded", "false");
    el.tabIndex = 0;
    const val = document.createElement("span");
    val.className = "bz-select-val";
    el.appendChild(val);
    el.appendChild(uiIcon("chevron-down", "bz-select-car"));
    let current2 = opts.value;
    let menu = null;
    const labelOf = (v) => {
      const o = opts.options.find((x) => x.value === v);
      return o ? o.label : "";
    };
    const renderVal = () => {
      val.textContent = labelOf(current2) || opts.placeholder || "";
    };
    renderVal();
    const close = (notify2 = true) => {
      var _a;
      if (menu) {
        menu.remove();
        menu = null;
      }
      el.classList.remove("open");
      el.setAttribute("aria-expanded", "false");
      if (notify2) (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, false);
    };
    const open = () => {
      var _a;
      close(false);
      el.classList.add("open");
      el.setAttribute("aria-expanded", "true");
      (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, true);
      const m = document.createElement("div");
      m.className = "bz-select-menu";
      m.setAttribute("role", "listbox");
      menu = m;
      opts.options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-select-item" + (o.value === current2 ? " is-on" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(o.value === current2));
        b.dataset.index = String(i);
        const span = document.createElement("span");
        span.textContent = o.label;
        b.appendChild(span);
        b.appendChild(uiIcon("check", "bz-select-item-ck"));
        b.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setValue(o.value);
          opts.onChange(o.value);
          close();
        });
        m.appendChild(b);
      });
      el.appendChild(m);
      for (let round = 0; round < 3; round++) {
        let delta = 0;
        m.querySelectorAll(".bz-select-item > span").forEach((sp) => {
          delta = Math.max(delta, sp.scrollWidth - sp.clientWidth);
        });
        if (delta <= 0) break;
        const cs = getComputedStyle(m);
        const border = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
        m.style.minWidth = `${m.clientWidth + delta - border}px`;
      }
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const rect = m.getBoundingClientRect();
      const over = Math.ceil(rect.right - vw) + 2;
      if (over > 0) {
        m.style.right = `${over}px`;
        if (m.getBoundingClientRect().left < 2) m.style.right = "";
      }
    };
    const setValue = (v) => {
      current2 = v;
      renderVal();
      if (menu) {
        opts.options.forEach((o, i) => {
          const item = menu == null ? void 0 : menu.querySelectorAll(".bz-select-item")[i];
          if (!item) return;
          const on = o.value === v;
          item.classList.toggle("is-on", on);
          item.setAttribute("aria-selected", String(on));
        });
      }
    };
    const moveFocus = (delta) => {
      if (!menu) return;
      const curIdx = opts.options.findIndex((o) => o.value === current2);
      const nextIdx = Math.min(opts.options.length - 1, Math.max(0, (curIdx < 0 ? 0 : curIdx) + delta));
      opts.options.forEach((o, i) => {
        const item = menu == null ? void 0 : menu.querySelectorAll(".bz-select-item")[i];
        if (!item) return;
        const on = i === nextIdx;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-selected", String(on));
      });
    };
    el.addEventListener("click", () => {
      if (menu) close();
      else open();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (menu) {
          const on = menu == null ? void 0 : menu.querySelector(".bz-select-item.is-on");
          if (on && on !== el) {
            const v = opts.options[Number(on.dataset.index)];
            if (v) {
              setValue(v.value);
              opts.onChange(v.value);
            }
          }
          close();
        } else open();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!menu) open();
        moveFocus(e.key === "ArrowDown" ? 1 : -1);
      } else if (e.key === "Escape") {
        close();
      }
    });
    const onDocClick = (e) => {
      if (menu && !el.contains(e.target)) close();
    };
    const onDocKey = (e) => {
      if (e.key === "Escape" && menu) close();
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onDocKey);
    return {
      el,
      setValue,
      detach: () => {
        document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onDocKey);
        close(false);
      }
    };
  }
  var init_select = __esm({
    "src/core/ui/select.ts"() {
      init_icon();
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
    const setValue = (v) => {
      input.value = v;
    };
    return { el, input, setValue };
  }
  var init_search = __esm({
    "src/core/ui/search.ts"() {
      init_icon();
      init_field();
    }
  });

  // src/core/ui/mainhead.ts
  function uiMainHead(opts) {
    const el = document.createElement("div");
    el.className = "bz-main-head";
    const title = document.createElement("span");
    title.className = "bz-main-title";
    title.textContent = opts.title;
    el.appendChild(title);
    const count = document.createElement("span");
    count.className = "bz-main-count";
    el.appendChild(count);
    const sp = document.createElement("span");
    sp.className = "bz-main-spacer";
    el.appendChild(sp);
    if (opts.action) {
      el.appendChild(uiBtn({
        label: opts.action.label,
        icon: opts.action.icon,
        tone: "primary",
        className: "bz-btn--md",
        onClick: opts.action.onClick
      }));
    }
    const setCount = (c) => {
      if (c === void 0 || c === null || c === "") {
        count.style.display = "none";
        count.textContent = "";
      } else {
        count.style.display = "";
        count.textContent = c;
      }
    };
    setCount(opts.count);
    return {
      el,
      setTitle: (t) => {
        title.textContent = t;
      },
      setCount
    };
  }
  var init_mainhead = __esm({
    "src/core/ui/mainhead.ts"() {
      init_button();
    }
  });

  // src/core/ui/rail.ts
  function buildRow(item) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bz-rail-item";
    b.dataset.id = item.id;
    if (item.boxedIcon) {
      const box = document.createElement("span");
      box.className = "bz-rail-ic";
      box.appendChild(uiIcon(item.boxedIcon));
      b.appendChild(box);
    } else if (item.icon) {
      b.appendChild(uiIcon(item.icon));
    } else if (item.emoji) {
      const emo = document.createElement("span");
      emo.className = "bz-rail-emoji";
      emo.textContent = item.emoji;
      b.appendChild(emo);
    } else if (item.badge) {
      const badge = document.createElement("span");
      badge.className = "bz-rail-badge";
      badge.textContent = item.badge.t;
      badge.setAttribute("aria-label", item.badge.label);
      if (item.badge.tint) badge.style.setProperty("--bz-rail-tint", item.badge.tint);
      b.appendChild(badge);
    } else if (item.dot) {
      const dot = document.createElement("span");
      dot.className = "bz-rail-dot";
      dot.style.setProperty("--bz-rail-tint", item.dot);
      b.appendChild(dot);
    }
    const name = document.createElement("span");
    name.className = "bz-rail-name";
    name.textContent = item.name;
    b.appendChild(name);
    if (item.count !== void 0 && item.count !== null && item.count !== "") {
      const cnt = document.createElement("span");
      cnt.className = "bz-rail-count" + (item.pill ? " bz-rail-count--pill" : "");
      cnt.textContent = String(item.count);
      b.appendChild(cnt);
    }
    if (item.unread) {
      const u = document.createElement("span");
      u.className = "bz-rail-unread";
      u.textContent = String(item.unread);
      b.appendChild(u);
    }
    if (item.children && item.children.length) {
      b.classList.add("has-sub");
      const caret = document.createElement("span");
      caret.className = "bz-rail-caret";
      setIcon(caret, "chevron-right");
      b.appendChild(caret);
    }
    return b;
  }
  function uiRail(opts) {
    const el = document.createElement("div");
    el.className = "bz-rail";
    const scroll = document.createElement("div");
    scroll.className = "bz-rail-scroll";
    el.appendChild(scroll);
    const rows = /* @__PURE__ */ new Map();
    const setActive = (id) => {
      var _a;
      rows.forEach((row) => row.classList.remove("on"));
      (_a = rows.get(id)) == null ? void 0 : _a.classList.add("on");
    };
    opts.groups.forEach((g) => {
      if (g.label) {
        const lb = document.createElement("div");
        lb.className = "bz-rail-label";
        lb.textContent = g.label;
        scroll.appendChild(lb);
      }
      g.items.forEach((item) => {
        const row = buildRow(item);
        rows.set(item.id, row);
        scroll.appendChild(row);
        if (item.children && item.children.length) {
          const sub = document.createElement("div");
          sub.className = "bz-rail-sub";
          item.children.forEach((child) => {
            const cr = buildRow(child);
            rows.set(child.id, cr);
            cr.addEventListener("click", () => {
              var _a;
              setActive(child.id);
              (_a = opts.onSelect) == null ? void 0 : _a.call(opts, child.id);
            });
            sub.appendChild(cr);
          });
          scroll.appendChild(sub);
          row.addEventListener("click", () => {
            const open = !sub.classList.contains("open");
            sub.classList.toggle("open", open);
            row.classList.toggle("sub-open", open);
          });
        } else {
          row.addEventListener("click", () => {
            var _a;
            setActive(item.id);
            (_a = opts.onSelect) == null ? void 0 : _a.call(opts, item.id);
          });
        }
      });
    });
    if (opts.foot) {
      const foot = document.createElement("div");
      foot.className = "bz-rail-foot";
      foot.appendChild(opts.foot);
      el.appendChild(foot);
    }
    setActive(opts.activeId);
    return { el, setActive };
  }
  var init_rail = __esm({
    "src/core/ui/rail.ts"() {
      init_fake_obsidian();
      init_icon();
    }
  });

  // src/core/ui/mobstrip.ts
  function uiMobStrip(opts) {
    const el = document.createElement("div");
    el.className = "bz-mobstrip";
    const chips = /* @__PURE__ */ new Map();
    const setValue = (id) => {
      chips.forEach((chip) => chip.classList.toggle("is-on", chip.dataset.id === id));
    };
    opts.items.forEach((it) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "bz-mobstrip-chip";
      chip.dataset.id = it.id;
      if (it.dot) {
        const dot = document.createElement("span");
        dot.className = "bz-mobstrip-dot";
        dot.style.setProperty("--bz-rail-tint", it.dot);
        chip.appendChild(dot);
      }
      chip.appendChild(document.createTextNode(it.label));
      chip.addEventListener("click", () => {
        var _a;
        setValue(it.id);
        (_a = opts.onChange) == null ? void 0 : _a.call(opts, it.id);
      });
      chips.set(it.id, chip);
      el.appendChild(chip);
    });
    setValue(opts.value);
    return { el, setValue };
  }
  var init_mobstrip = __esm({
    "src/core/ui/mobstrip.ts"() {
    }
  });

  // src/core/ui/stat.ts
  function uiStat(opts) {
    const el = document.createElement("div");
    const cls = ["bz-stat"];
    if (opts.tone) cls.push(`bz-stat--${opts.tone}`);
    if (opts.click) cls.push("bz-stat--click");
    el.className = cls.join(" ");
    const label = document.createElement("span");
    label.className = "bz-stat-label";
    if (opts.icon) label.appendChild(uiIcon(opts.icon));
    label.appendChild(document.createTextNode(opts.label));
    el.appendChild(label);
    const num = document.createElement("span");
    num.className = "bz-stat-num";
    num.textContent = String(opts.num);
    el.appendChild(num);
    if (opts.hint) {
      const hint = document.createElement("span");
      hint.className = "bz-stat-hint";
      hint.textContent = opts.hint;
      el.appendChild(hint);
    }
    if (opts.onClick) el.addEventListener("click", opts.onClick);
    return el;
  }
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
  function uiPopover(opts) {
    var _a;
    const anchor = opts.anchor;
    let current2 = (_a = opts.value) != null ? _a : "";
    let items = opts.options;
    let layer = null;
    const onDocClick = (e) => {
      if (!layer) return;
      const t = e.target;
      if (anchor.contains(t)) return;
      close();
    };
    const onDocKey = (e) => {
      if (e.key === "Escape" && layer) close();
    };
    const open = () => {
      if (layer) return;
      const m = document.createElement("div");
      m.className = "bz-popover";
      m.setAttribute("role", "listbox");
      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "bz-popover-empty";
        empty.textContent = opts.emptyText || "无匹配项";
        m.appendChild(empty);
      } else {
        items.forEach((o) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "bz-popover-item" + (o.id === current2 ? " is-on" : "");
          b.dataset.id = o.id;
          b.setAttribute("role", "option");
          b.setAttribute("aria-selected", String(o.id === current2));
          if (o.icon) b.appendChild(uiIcon(o.icon));
          const span = document.createElement("span");
          span.textContent = o.label;
          b.appendChild(span);
          b.addEventListener("click", (ev) => {
            var _a2;
            ev.stopPropagation();
            setValue(o.id);
            (_a2 = opts.onPick) == null ? void 0 : _a2.call(opts, o.id);
            close();
          });
          m.appendChild(b);
        });
      }
      (anchor.parentElement || anchor).appendChild(m);
      layer = m;
      document.addEventListener("click", onDocClick);
      document.addEventListener("keydown", onDocKey);
    };
    const close = () => {
      if (!layer) return;
      layer.remove();
      layer = null;
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKey);
    };
    const setValue = (id) => {
      current2 = id;
      if (!layer) return;
      layer.querySelectorAll(".bz-popover-item").forEach((item) => {
        const on = item.dataset.id === id;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-selected", String(on));
      });
    };
    const setOptions = (next) => {
      items = next;
      if (layer) {
        close();
        open();
      }
    };
    anchor.addEventListener("click", () => {
      if (layer) close();
      else open();
    });
    return {
      open,
      close,
      setValue,
      setOptions,
      /** 清理：关浮层并摘除 document 监听（宿主收尾用，对齐 uiSelect.detach） */
      detach: () => {
        document.removeEventListener("click", onDocClick);
        document.removeEventListener("keydown", onDocKey);
        close();
      }
    };
  }
  var init_popover = __esm({
    "src/core/ui/popover.ts"() {
      init_icon();
    }
  });

  // src/core/ui/suggest.ts
  function uiSuggest(opts) {
    var _a;
    const anchor = opts.anchor;
    const max = (_a = opts.max) != null ? _a : 30;
    let layer = null;
    let skipNextOpen = false;
    const close = () => {
      if (!layer) return;
      layer.remove();
      layer = null;
      document.removeEventListener("mousedown", onDocDown, true);
    };
    const onDocDown = (e) => {
      const t = e.target;
      if (!anchor.isConnected) {
        close();
        return;
      }
      if ((layer == null ? void 0 : layer.contains(t)) || anchor.contains(t)) return;
      close();
    };
    const pick = (raw) => {
      var _a2;
      anchor.value = raw;
      close();
      (_a2 = opts.onPick) == null ? void 0 : _a2.call(opts, raw);
      if (document.activeElement !== anchor) {
        skipNextOpen = true;
        anchor.focus();
      }
    };
    const draw = () => {
      if (!layer) return;
      const cur = anchor.value.trim();
      const q = cur.toLowerCase();
      const matched = opts.source().filter((s) => (!opts.excludeCurrent || s !== cur) && (!q || s.toLowerCase().includes(q))).slice(0, max);
      if (!matched.length) {
        close();
        return;
      }
      layer.replaceChildren();
      matched.forEach((raw) => {
        var _a2;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-popover-item";
        b.dataset.value = raw;
        b.setAttribute("role", "option");
        const on = raw === cur;
        if (on) b.classList.add("is-on");
        const icon2 = (_a2 = opts.iconOf) == null ? void 0 : _a2.call(opts, raw);
        if (icon2) {
          const ic = document.createElement("span");
          ic.className = "bz-suggest-ic";
          if (typeof icon2 === "string") ic.textContent = icon2;
          else ic.appendChild(icon2);
          b.appendChild(ic);
        }
        const label = document.createElement("span");
        label.textContent = opts.labelOf ? opts.labelOf(raw) : raw;
        b.appendChild(label);
        b.addEventListener("click", () => pick(raw));
        layer.appendChild(b);
      });
    };
    const open = () => {
      if (skipNextOpen) {
        skipNextOpen = false;
        return;
      }
      if (layer) {
        draw();
        return;
      }
      const m = document.createElement("div");
      m.className = "bz-popover";
      m.setAttribute("role", "listbox");
      (anchor.parentElement || anchor).appendChild(m);
      layer = m;
      document.addEventListener("mousedown", onDocDown, true);
      draw();
    };
    const activeIdx = () => {
      var _a2;
      return [...(_a2 = layer == null ? void 0 : layer.querySelectorAll(".bz-popover-item")) != null ? _a2 : []].findIndex((o) => o.classList.contains("is-on"));
    };
    const moveActive = (to) => {
      var _a2, _b;
      const items = [...(_a2 = layer == null ? void 0 : layer.querySelectorAll(".bz-popover-item")) != null ? _a2 : []];
      if (!items.length) return;
      const next = items[Math.max(0, Math.min(items.length - 1, to))];
      items.forEach((o) => o.classList.toggle("is-on", o === next));
      (_b = next.scrollIntoView) == null ? void 0 : _b.call(next, { block: "nearest" });
    };
    anchor.addEventListener("focus", open);
    anchor.addEventListener("input", () => {
      skipNextOpen = false;
      open();
    });
    anchor.addEventListener("keydown", (e) => {
      if (!layer) return;
      if (e.key === "ArrowDown") {
        moveActive(activeIdx() + 1);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        moveActive(activeIdx() < 0 ? layer.querySelectorAll(".bz-popover-item").length - 1 : activeIdx() - 1);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const on = layer.querySelector(".bz-popover-item.is-on");
        if (on) pick(on.dataset.value);
        e.preventDefault();
      } else if (e.key === "Escape") {
        close();
        e.stopPropagation();
      }
    });
    return {
      close,
      /** 清理：关浮层并摘 document 监听（宿主收尾用；anchor 随表单移除时下次外点自清） */
      detach: () => {
        close();
      }
    };
  }
  var init_suggest = __esm({
    "src/core/ui/suggest.ts"() {
    }
  });

  // src/core/ui/lightbox.ts
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
    const type = opts.type || (opts.src.endsWith(".mp4") || opts.src.endsWith(".webm") ? "video" : "image");
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
      current = null;
      lockBodyScroll(false);
    }
    escHandle = escManager.register("bz-lightbox", {
      isVisible: () => mask.isConnected,
      close
    });
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
      lockBodyScroll(false);
    }
  }
  var current;
  var init_lightbox = __esm({
    "src/core/ui/lightbox.ts"() {
      init_icon();
      init_esc_manager();
      init_z_order();
      current = null;
    }
  });

  // src/core/ui/modal.ts
  function uiModal(opts) {
    const mask = document.createElement("div");
    mask.className = "bz-overlay-mask";
    mask.style.zIndex = String(allocZ());
    const popup = document.createElement("div");
    popup.className = "bz-overlay-popup" + (opts.className ? " " + opts.className : "");
    if (opts.maxWidth) popup.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - 32px))`;
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
    function close() {
      var _a;
      if (closed) return;
      closed = true;
      mask.remove();
      escHandle == null ? void 0 : escHandle.unregister();
      (_a = opts.onClose) == null ? void 0 : _a.call(opts);
    }
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    escHandle = escManager.register("bz-modal", {
      isVisible: () => mask.isConnected,
      close
    });
    document.body.appendChild(mask);
    return { mask, popup, close };
  }
  var init_modal = __esm({
    "src/core/ui/modal.ts"() {
      init_esc_manager();
      init_z_order();
    }
  });

  // src/core/dom.ts
  function longPress(el, cb, dur, filter) {
    if (!dur) dur = 500;
    let timer = null, touching = false, fired = false, moved = false, sx = 0, sy = 0;
    let suppressClick = false;
    const M = 10;
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
      if (Math.abs(t.clientX - sx) > M || Math.abs(t.clientY - sy) > M) {
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
      document.removeEventListener("click", swallow, true);
      e.stopPropagation();
    };
    const disarm = () => {
      document.removeEventListener("click", swallow, true);
    };
    document.addEventListener("click", swallow, true);
    document.addEventListener("mousedown", disarm, { capture: true, once: true });
  }
  var init_dom = __esm({
    "src/core/dom.ts"() {
      init_notice();
      init_z_order();
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
    const persist = opts.persist;
    let persistTimer = null;
    let lastW = 0;
    let lastH = 0;
    if (persist == null ? void 0 : persist.load) {
      const saved = persist.load();
      if (saved && saved.w > 0 && saved.h > 0) {
        lastW = Math.min(Math.max(saved.w, minW), cap(true));
        lastH = Math.min(Math.max(saved.h, minH), cap(false));
        el.style.width = lastW + "px";
        el.style.height = lastH + "px";
      }
    }
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
      if (!dragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      let w = dir === "e" || dir === "se" ? startW + dx : startW;
      let h = dir === "s" || dir === "se" ? startH + dy : startH;
      w = Math.min(Math.max(w, minW), cap(true));
      h = Math.min(Math.max(h, minH), cap(false));
      el.style.width = w + "px";
      el.style.height = h + "px";
      if (opts.onChange) opts.onChange(w, h);
      if (persist == null ? void 0 : persist.save) {
        lastW = w;
        lastH = h;
        if (persistTimer !== null) clearTimeout(persistTimer);
        persistTimer = setTimeout(() => {
          var _a2;
          persistTimer = null;
          (_a2 = persist.save) == null ? void 0 : _a2.call(persist, w, h);
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
      startW = el.getBoundingClientRect().width;
      startH = el.getBoundingClientRect().height;
      document.body.style.userSelect = "none";
    };
    const onMouseUp = () => {
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
      if ((persist == null ? void 0 : persist.save) && lastW > 0 && lastH > 0) persist.save(lastW, lastH);
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
  function uiVSplitter(opts) {
    var _a, _b;
    const left = opts.left;
    const minLeft = (_a = opts.minLeft) != null ? _a : 220;
    const minRight = (_b = opts.minRight) != null ? _b : 320;
    const persist = opts.persist;
    const el = document.createElement("div");
    el.className = "bz-vsplit";
    el.setAttribute("role", "separator");
    el.setAttribute("aria-orientation", "vertical");
    el.title = "拖动调整两侧宽度";
    const isCoarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    if (isCoarse) {
      return { el, restore: () => {
      }, flush: () => {
      }, detach: () => {
      } };
    }
    let dragging = false;
    let startX = 0;
    let startW = 0;
    let persistTimer = null;
    let lastW = 0;
    let restored = false;
    const availW = () => {
      const parent = left.parentElement;
      if (!parent) return 0;
      return parent.clientWidth - el.offsetWidth;
    };
    const clampW = (w) => {
      const avail = availW();
      const max = avail > 0 ? avail - minRight : Number.POSITIVE_INFINITY;
      return Math.min(Math.max(w, minLeft), Math.max(minLeft, max));
    };
    const applyW = (w) => {
      left.style.width = w + "px";
    };
    const debSave = (w) => {
      if (!(persist == null ? void 0 : persist.save)) return;
      lastW = w;
      if (persistTimer !== null) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        var _a2;
        persistTimer = null;
        (_a2 = persist.save) == null ? void 0 : _a2.call(persist, w);
      }, 300);
    };
    const restore = () => {
      if (restored || !(persist == null ? void 0 : persist.load) || !el.isConnected) return;
      if (availW() <= 0) return;
      const saved = persist.load();
      restored = true;
      if (saved != null && saved > 0) {
        const w = clampW(saved);
        applyW(w);
        lastW = w;
      }
    };
    const onDragMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const w = clampW(startW + (e.clientX - startX));
      if (w === lastW) return;
      applyW(w);
      lastW = w;
      if (opts.onChange) opts.onChange(w);
      debSave(w);
    };
    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = left.getBoundingClientRect().width;
      el.classList.add("is-drag");
      document.body.style.userSelect = "none";
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-drag");
      document.body.style.userSelect = "";
      swallowNextClick();
    };
    document.addEventListener("mousemove", onDragMove);
    el.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    const flush = () => {
      if (persistTimer === null) return;
      clearTimeout(persistTimer);
      persistTimer = null;
      if ((persist == null ? void 0 : persist.save) && lastW > 0) persist.save(lastW);
    };
    return {
      el,
      restore,
      flush,
      detach: () => {
        flush();
        document.removeEventListener("mousemove", onDragMove);
        el.removeEventListener("mousedown", onMouseDown);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.userSelect = "";
        el.classList.remove("is-drag");
      }
    };
  }
  var init_splitter = __esm({
    "src/core/ui/splitter.ts"() {
      init_dom();
    }
  });

  // src/core/ui/index.ts
  var ui_exports = {};
  __export(ui_exports, {
    closeLightbox: () => closeLightbox,
    mountIcons: () => mountIcons,
    openLightbox: () => openLightbox,
    uiBtn: () => uiBtn,
    uiBtnRow: () => uiBtnRow,
    uiCardChoice: () => uiCardChoice,
    uiChip: () => uiChip,
    uiChoice: () => uiChoice,
    uiDialogActions: () => uiDialogActions,
    uiEmpty: () => uiEmpty,
    uiField: () => uiField,
    uiIcon: () => uiIcon,
    uiIconBtn: () => uiIconBtn,
    uiIconSpan: () => uiIconSpan,
    uiInput: () => uiInput,
    uiMainHead: () => uiMainHead,
    uiMobStrip: () => uiMobStrip,
    uiModal: () => uiModal,
    uiPopover: () => uiPopover,
    uiProgress: () => uiProgress,
    uiRail: () => uiRail,
    uiRange: () => uiRange,
    uiResizable: () => uiResizable,
    uiSearch: () => uiSearch,
    uiSegmented: () => uiSegmented,
    uiSelect: () => uiSelect,
    uiStat: () => uiStat,
    uiSuggest: () => uiSuggest,
    uiSwitch: () => uiSwitch,
    uiVSplitter: () => uiVSplitter
  });
  var init_ui = __esm({
    "src/core/ui/index.ts"() {
      init_icon();
      init_icons();
      init_button();
      init_chip();
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
      init_suggest();
      init_lightbox();
      init_modal();
      init_resize();
      init_splitter();
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

  // src/core/item-actions.ts
  var item_actions_exports = {};
  __export(item_actions_exports, {
    attachItemActions: () => attachItemActions,
    closeItemMenu: () => closeItemMenu,
    openItemMenu: () => openItemMenu,
    openItemSheet: () => openItemSheet,
    refreshItemSheet: () => refreshItemSheet,
    registerSheetCompanion: () => registerSheetCompanion,
    resetItemMenuClickGuard: () => resetItemMenuClickGuard,
    unregisterSheetCompanion: () => unregisterSheetCompanion
  });
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
      touchSettlePending = false;
      ev.stopImmediatePropagation();
      ev.preventDefault();
      return;
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
  function openItemMenu(x, y, actions, suppressResidualClick = false, menuClass) {
    closeItemMenu();
    const m = document.createElement("div");
    m.className = "bz-item-menu" + (menuClass ? " " + menuClass : "");
    m.style.visibility = "hidden";
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
  function refreshItemSheet(actions, head) {
    if (!popupEl || popupEl.classList.contains("bz-item-sheet") === false || !sheetBodyEl) return;
    sheetBodyEl.innerHTML = "";
    for (const a of actions) {
      sheetBodyEl.appendChild(buildSheetItem(a));
    }
    if (head && sheetHeadEl) {
      sheetHeadEl.innerHTML = "";
      sheetHeadEl.appendChild(head);
    }
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
      openItemMenu(e.clientX, e.clientY, actions, true, opts == null ? void 0 : opts.menuClass);
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

  // src/review/render.ts
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  }
  function icon(name, extra = "bz-q-ic") {
    return `<span class="bz-ic${extra ? " " + extra : ""}" data-lucide="${name}"></span>`;
  }
  function markHtml(kind, size = "") {
    if (kind === "ok") return `<span class="bz-mark ok ${size}"><i data-lucide="check"></i></span>`;
    return `<span class="bz-mark bad ${size}"><i data-lucide="x"></i></span>`;
  }
  function todayLabel(now = /* @__PURE__ */ new Date()) {
    const week = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    return `${now.getMonth() + 1}月${now.getDate()}日 周${week}`;
  }
  function dueLabelOf(item, now = Date.now()) {
    if (item.isMissing) return { label: "文件缺失", cls: "is-missing" };
    if (item.isCompleted) return { label: "已完成", cls: "is-done" };
    if (!item.nextReviewDate) return { label: "待定", cls: "is-future" };
    const diff = new Date(item.nextReviewDate).getTime() - now;
    if (diff > 0) {
      const days = Math.floor(diff / 864e5);
      const hours = Math.floor(diff % 864e5 / 36e5);
      if (days > 0) return { label: `${days} 天后`, cls: "is-future" };
      if (hours > 0) return { label: `${hours} 小时后`, cls: "is-future" };
      return { label: `${Math.max(1, Math.floor(diff / 6e4))} 分钟后`, cls: "is-future" };
    }
    return { label: "已逾期", cls: "is-overdue" };
  }
  function isPlayable(item, now = Date.now()) {
    if (item.isMissing || item.isCompleted || item.completed) return false;
    if (!item.nextReviewDate) return false;
    return new Date(item.nextReviewDate).getTime() <= now;
  }
  function currentRPct(item, w = DEFAULT_W, now = Date.now()) {
    if (item.phase !== "fsrs" || !item.stability || !item.lastReviewed) return null;
    const t = (now - new Date(item.lastReviewed).getTime()) / 864e5;
    if (!(t > 0)) return null;
    return Math.round(new FSRS(w).R(t, item.stability) * 100);
  }
  function stageNum(item) {
    var _a;
    if (item.isMissing) return "挂起";
    if (item.phase === "fsrs") {
      const LADDER_MAX2 = 9;
      return `FSRS Lv.${item.stage - LADDER_MAX2 + 1}`;
    }
    return `${(_a = item.currentStage) != null ? _a : item.stage + 1}/${TOTAL_STAGES}`;
  }
  function stageTagHtml(item, w = DEFAULT_W, now = Date.now()) {
    var _a;
    if (item.completed) return '<span class="bz-q-tag is-done">已完成</span>';
    if (item.phase === "fsrs") {
      const r = currentRPct(item, w, now);
      if (r !== null) {
        const cls = r >= 90 ? "r-high" : r >= 70 ? "r-mid" : "r-low";
        return `<span class="bz-q-tag is-r ${cls}">R=${r}%</span>`;
      }
      return `<span class="bz-q-tag is-r">FSRS</span>`;
    }
    return `<span class="bz-q-tag is-stage">阶段 ${(_a = item.currentStage) != null ? _a : item.stage + 1}/${TOTAL_STAGES}</span>`;
  }
  function sortColumn(items, now = Date.now()) {
    return items.slice().sort((a, b) => {
      var _a, _b;
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const ra = a.phase === "fsrs" && a.stability ? (_a = currentRPct(a, DEFAULT_W, now)) != null ? _a : 999 : 999;
      const rb = b.phase === "fsrs" && b.stability ? (_b = currentRPct(b, DEFAULT_W, now)) != null ? _b : 999 : 999;
      if (ra !== rb) return ra - rb;
      return new Date(a.nextReviewDate || 0).getTime() - new Date(b.nextReviewDate || 0).getTime();
    });
  }
  function colHead(count, name) {
    return `<div class="bz-q-col-head"><span class="cnt">${count}</span><span class="name">${name}</span></div>`;
  }
  function cardHtml(item, ctx = {}) {
    var _a, _b, _c;
    const now = (_a = ctx.now) != null ? _a : Date.now();
    const w = (_b = ctx.w) != null ? _b : DEFAULT_W;
    const due = dueLabelOf(item, now);
    const canPlay = isPlayable(item, now) && !item.isMissing;
    const title = item.isCompleted ? `<s>${esc(item.name)}</s>` : esc(item.name);
    const cls = [
      "bz-q-card",
      item.isOverdue ? "danger" : "",
      item.isCompleted ? "done" : "",
      canPlay ? "" : "no",
      item.isMissing ? "missing" : ""
    ].join(" ").trim();
    const tags = [
      item.isMissing ? `<span class="bz-q-tag is-missing">文件缺失</span>` : `<span class="bz-q-tag ${due.cls}">${due.label}</span>`,
      // R 阈值提前复习卡挂「提前」tag（与开始本轮同口径，落「今天」列）
      !item.isMissing && isEarlyDue(item, (_c = ctx.rThreshold) != null ? _c : 0.9, w) ? `<span class="bz-q-tag is-early">提前</span>` : "",
      // V1 原型拍板（issue 253）：待重做旗标显性化——挂红 tag 提示「这题忘了要重做」
      item.pendingRedo && !item.isCompleted ? `<span class="bz-q-tag is-redo">待重做</span>` : "",
      stageTagHtml(item, w, now)
    ].join("");
    return `
      <div class="${cls}" data-id="${item.id}" role="button" tabindex="0" aria-disabled="${canPlay ? "false" : "true"}">
        <div class="bz-q-card-top"><span class="bz-q-card-title">${title}</span><span class="bz-q-card-stage">${item.isMissing ? "挂起" : stageNum(item)}</span></div>
        <div class="bz-q-card-meta">${tags}</div>
      </div>`;
  }
  function cardsOf(items, ctx) {
    if (!items.length) return `<div class="bz-q-hint">没有条目</div>`;
    return items.map((it) => cardHtml(it, ctx)).join("");
  }
  function queueViewHtml(items, ctx = {}) {
    var _a, _b, _c;
    const now = (_a = ctx.now) != null ? _a : Date.now();
    const w = (_b = ctx.w) != null ? _b : DEFAULT_W;
    const rt = (_c = ctx.rThreshold) != null ? _c : 0.9;
    const full = { ...ctx, now, w, rThreshold: rt };
    const col = partitionQueue(items, rt, w);
    const head = `
      <div class="bz-panel-head">
        <div class="bz-panel-brand">${icon("repeat-2", "bz-ic--sm")}</div>
        <div class="bz-panel-title">复习计划</div>
        <div class="bz-panel-head-pipe"></div>
        <div class="bz-panel-head-sub">${todayLabel(new Date(now))}</div>
        <span class="bz-panel-head-sp"></span>
        <div class="bz-panel-head-btns">
          <!-- ⚙设置直达钮两端退役（issue 254 迭代拍板，设置走插件设置页）；✕ 桌面隐藏
              （styles.css ≥769px 规则，点遮罩/ESC 关），仅移动端全屏保留 -->
          <button class="bz-icon-btn" data-act="close" title="关闭">${icon("x")}</button>
      </div>
      </div>`;
    if (!items.length) {
      const strip2 = `
      <div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">还没有任何复习条目</span>
      </div>`;
      return `<div class="bz-q-view">${head}${strip2}<div class="bz-q-cols bz-q-empty-wrap"><div data-empty-host></div></div></div>`;
    }
    const clearToday = col.overdue.length + col.today.length === 0;
    const futureCount = col.future.length;
    const strip = ctx.showArchived ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>已完成复习</strong>
      </div>` : clearToday ? `<div class="bz-q-strip">
        <span class="bz-q-strip-dot ok"></span>
        <strong>今日已清空</strong>
        <span class="bz-q-strip-txt">${futureCount ? `未来还有 ${futureCount} 篇待复习` : "没有待复习条目"}</span>
      </div>` : `<div class="bz-q-strip">
        <span class="bz-q-strip-dot"></span>
        <strong>开始本轮</strong>
        <span class="bz-q-strip-txt">今日 ${col.today.length} 篇到期 · 逾期 ${col.overdue.length} 篇顺延</span>
        <button class="bz-btn bz-btn--primary" data-act="begin">开始本轮</button>
      </div>`;
    const body = ctx.showArchived ? `<div class="bz-q-cols"><div class="bz-q-col done">${colHead(col.done.length, "已完成")}${cardsOf(sortColumn(col.done, now), full)}</div></div>` : `<div class="bz-q-cols">
          <div class="bz-q-col danger">${colHead(col.overdue.length, "已逾期")}${cardsOf(sortColumn(col.overdue, now), full)}</div>
          <div class="bz-q-col warn">${colHead(col.today.length, "今天到期")}${cardsOf(sortColumn(col.today, now), full)}</div>
          <div class="bz-q-col future">${colHead(col.future.length, "未来")}${cardsOf(sortColumn(col.future, now), full)}</div>
        </div>`;
    const stats = computeStats(items);
    const archItem = ctx.showArchived ? `<span class="bz-q-fitem bz-touch-target--lg is-back" data-act="arch" title="点此返回队列">
        ${icon("undo-2")}<span class="lbl">返回队列</span>
      </span>` : `<span class="bz-q-fitem bz-touch-target--lg" data-act="arch" title="查看已完成复习">
        ${icon("folder")}<span class="lbl">已完成 <b>${col.done.length}</b> 篇</span>
      </span>`;
    const footer = `
      <div class="bz-q-footer">
        ${archItem}
        <i class="sep"></i>
        <span class="bz-q-fitem bz-touch-target--lg" data-act="stats" title="查看复习统计分布">
          ${icon("bar-chart-3")}<span class="lbl">累计 <b>${stats.totalReviews}</b> 天 · 连续 <b>${stats.streak}</b> 天</span>
        </span>
      </div>`;
    return `<div class="bz-q-view">${head}${strip}${body}${footer}</div>`;
  }
  function sprintHeadHtml() {
    return `
      <div class="bz-sprint-head">
        <div class="t">
          <div class="bz-sprint-title">做题冲刺</div>
        </div>
        <div class="tools">
          <button class="bz-icon-btn" data-action="skip" title="跳过此篇（不评级，移到队尾）">${icon("skip-forward", "bz-sprint-ic")}</button>
          <button class="bz-icon-btn" data-action="quit" title="回面板">${icon("x", "bz-sprint-ic")}</button>
        </div>
      </div>`;
  }
  function sprintLoadingHtml() {
    return `<div class="bz-sprint-loading"><span class="spinner"></span>正在获取题目…</div>`;
  }
  function sprintOptsHtml(q, answered, sel, lastCorrect) {
    return q.options.map((opt, i) => {
      const isSel = sel.includes(i);
      let extra = "";
      if (answered) {
        if (q.correctIndices.includes(i)) extra = " is-correct";
        else if (isSel) extra = " is-wrong";
      } else if (isSel) extra = " is-sel";
      const m = answered && q.correctIndices.includes(i) ? markHtml("ok") : answered && isSel && !q.correctIndices.includes(i) ? markHtml("bad") : "";
      return `
          <div class="bz-sprint-opt${extra}${answered ? " is-disabled" : ""}" data-i="${i}" role="button" tabindex="${answered ? "-1" : "0"}" aria-disabled="${answered ? "true" : "false"}">
            <span class="k">${"ABCD"[i]}</span>
            <span class="t">${esc(opt)}</span>
            <span class="m">${m}</span>
          </div>`;
    }).join("");
  }
  function sprintQuestionHtml(entry, question, st) {
    const single = question.correctIndices.length === 1;
    const total = entry.questions.length;
    const done = entry.doneCount;
    const optsHtml = sprintOptsHtml(question, st.answered, st.sel, st.lastCorrect);
    const needSubmit = !single && !st.answered;
    const lastWrong = st.answered && !st.lastCorrect && !st.remaining;
    const nextBtn = st.answered && !st.lastCorrect && st.remaining ? `<button class="bz-btn bz-btn--primary" data-action="next">下一题 →</button>` : lastWrong ? `<button class="bz-btn bz-btn--primary" data-action="note">${icon("flag", "bz-sprint-ic")} 结束并结算</button>` : "";
    const submit = needSubmit ? `<button class="bz-btn bz-btn--primary bz-sprint-submit" data-action="submit">提交答案</button>` : "";
    const explain = st.answered && !st.lastCorrect && question.explain ? `<div class="bz-sprint-explain">${esc(question.explain)}</div>` : "";
    return `
      <div class="bz-sprint-qtop">
        <span class="bz-sprint-progress">${done + 1}/${total}</span>
      </div>
      <div class="bz-sprint-qcard">
        <div class="bz-sprint-qtype">${single ? "单选" : "多选"}</div>
        <div class="bz-sprint-qtext">${esc(question.question)}</div>
        <div class="bz-sprint-opts">${optsHtml}</div>
        ${explain}
        ${submit}
        ${nextBtn ? `<div class="bz-sprint-qfoot">${nextBtn}</div>` : ""}
      </div>`;
  }
  function sprintAsideHtml(entries) {
    const rows = entries.map((e) => {
      const name = esc(e.name);
      if (e.state === "passed") return `<div class="bz-sq-item passed"><span class="nm"><s>${name}</s></span></div>`;
      if (e.state === "failed") return `<div class="bz-sq-item failed"><span class="nm">${name}</span></div>`;
      if (e.state === "doing") return `<div class="bz-sq-item doing"><span class="nm">${name}</span></div>`;
      return `<div class="bz-sq-item"><span class="nm">${name}</span></div>`;
    }).join("");
    return `
      <div class="bz-sq-head"><b>本轮队列</b></div>
      <div class="bz-sq-list">${rows || '<div class="bz-empty"><div class="bz-empty-title">队列完毕</div></div>'}</div>`;
  }
  function sprintBodyHtml(mainHtml, entries) {
    return `
      <div class="bz-sprint-body">
        <div class="bz-sprint-main">${mainHtml}</div>
        <aside class="bz-sprint-queue">${sprintAsideHtml(entries)}</aside>
      </div>`;
  }
  function sprintResultHtml(p) {
    const total = p.acc + p.wrong;
    const inner = p.passed ? `
        <div class="bz-result-ic">${markHtml("ok", "lg")}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating pass">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="next">${p.nextLabel}</button>
        ${p.showEnd ? `<button class="bz-btn bz-btn--ghost bz-btn--block" data-action="end">结束这次复习</button>` : ""}` : `
        <div class="bz-result-ic bad">${markHtml("bad", "lg")}</div>
        <div class="bz-result-name">${esc(p.name)}</div>
        <div class="bz-result-score">${p.acc}<span class="sl">/${total}</span></div>
        <span class="bz-result-rating fail">${p.ratingLine}</span>
        <button class="bz-btn bz-btn--danger bz-btn--block" data-action="note">${icon("file-text", "bz-sprint-ic")} 复习此笔记 · 打开原文</button>`;
    return `<div class="bz-result">${inner}</div>`;
  }
  function sprintSummaryHtml(p) {
    return `
      <div class="bz-summary">
        <div class="bz-summary-title">本轮复习完成</div>
        <div class="bz-summary-stats">
          <div class="st"><b>${p.total}</b><span>复习篇数</span></div>
          <div class="st"><b>${p.passed}</b><span>通过</span></div>
          <div class="st ${p.failed ? "warn" : ""}"><b>${p.failed}</b><span>未通过</span></div>
        </div>
        ${p.streak > 0 ? `<div class="bz-summary-streak">连续复习 <b>${p.streak}</b> 天</div>` : ""}
        <button class="bz-btn bz-btn--primary bz-btn--block" data-action="done">完成 · 回到复习计划</button>
      </div>`;
  }
  function difficultyDialogHtml(item) {
    return `
      <h4>标记复习：${esc(item.name)}</h4>
      <button class="diff-btn" data-diff="again">忘了（Again）</button>
      <button class="diff-btn" data-diff="hard">困难（Hard）</button>
      <button class="diff-btn" data-diff="good">一般（Good）</button>
      <button class="diff-btn" data-diff="easy">简单（Easy）</button>
      <button class="diff-btn diff-btn-cancel" data-diff="cancel">取消</button>
    `;
  }
  function reviewBarHtml(p) {
    const names = { again: "忘了", hard: "困难", good: "一般", easy: "简单" };
    const btns = ["again", "hard", "good", "easy"].map((r) => `<button class="bz-review-bar-btn bz-touch-target--sm is-${r}" data-rating="${r}">${names[r]}</button>`).join("");
    return `
    <span class="bz-review-bar-info">${esc(p.name.replace(/^《|》$/g, ""))}<i>(${p.index}/${p.total})</i></span>
    <span class="bz-review-bar-act">${btns}
      <button class="bz-review-bar-btn bz-touch-target--sm is-skip" data-rating="skip">${"跳过"}</button>
    </span>`;
  }
  var ESC;
  var init_render = __esm({
    "src/review/render.ts"() {
      init_fsrs();
      init_queue();
      init_stats();
      ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    }
  });

  // src/review/sprint.ts
  function accuracyToRating(accuracy) {
    if (accuracy >= 90) return "easy";
    if (accuracy >= 70) return "good";
    if (accuracy >= 50) return "hard";
    return "again";
  }
  var CORRECT_JUMP_DELAY_MS2, SprintSession, RATING_NAMES2;
  var init_sprint = __esm({
    "src/review/sprint.ts"() {
      init_utils();
      init_notice();
      init_flow_dialog();
      init_ui();
      init_esc_manager();
      init_render();
      CORRECT_JUMP_DELAY_MS2 = 800;
      SprintSession = class {
        constructor(opts) {
          this.entries = [];
          this.cur = 0;
          this.q = null;
          this.jumpTimer = null;
          this.escHandle = null;
          /** item 2：document keydown 句柄（finish 注销） */
          this.keyHandler = null;
          /** 当前视图态（键盘路由：题面/结果卡/结算屏 Enter 语义不同） */
          this.view = "loading";
          this.finished = false;
          this.resolveDone = null;
          this.started = false;
          this.opts = opts;
          this.entries = opts.queue.map((item) => ({
            item,
            state: "pending",
            questions: [],
            acc: 0,
            wrong: 0,
            passNote: ""
          }));
        }
        get mode() {
          return this.opts.mode;
        }
        get current() {
          var _a;
          return (_a = this.entries[this.cur]) != null ? _a : null;
        }
        get passedCount() {
          return this.entries.filter((e) => e.state === "passed").length;
        }
        get failedCount() {
          return this.entries.filter((e) => e.state === "failed").length;
        }
        get remainingCount() {
          return this.entries.filter((e) => e.state === "pending").length;
        }
        /** 开始会话（异步直到结束） */
        start() {
          if (this.started) return Promise.resolve("quit");
          this.started = true;
          return new Promise((resolve) => {
            this.resolveDone = resolve;
            this.escHandle = escManager.register("review-sprint", {
              isVisible: () => !this.finished,
              close: () => this.requestQuit()
            });
            this.bindKeys();
            void this.runNext();
          });
        }
        /** 放弃确认（ESC/放弃按钮） */
        requestQuit() {
          if (this.finished) return;
          void openFlowDialog({
            title: "放弃本次做题？",
            message: "未完成的题目将丢弃，本轮复习按已完成篇目结算",
            actions: [
              { label: "继续做题", value: "cancel" },
              { label: "放弃", value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v !== "ok" || this.finished) return;
            this.finish("quit");
          });
        }
        /** 结束会话（清资源 + 回调宿主） */
        finish(reason) {
          var _a;
          if (this.finished) return;
          this.finished = true;
          this.clearJump();
          this.unbindKeys();
          if (this.escHandle) {
            this.escHandle.unregister();
            this.escHandle = null;
          }
          this.opts.onExit();
          (_a = this.resolveDone) == null ? void 0 : _a.call(this, reason);
        }
        /** 宿主强制结束（面板关闭/卸载时调用，跳过确认） */
        destroy() {
          this.finish("quit");
        }
        clearJump() {
          if (this.jumpTimer) {
            clearTimeout(this.jumpTimer);
            this.jumpTimer = null;
          }
        }
        // ================= 键盘答题（item 2） =================
        bindKeys() {
          if (this.keyHandler) return;
          this.keyHandler = (e) => this.handleKey(e);
          document.addEventListener("keydown", this.keyHandler);
        }
        unbindKeys() {
          if (this.keyHandler) {
            document.removeEventListener("keydown", this.keyHandler);
            this.keyHandler = null;
          }
        }
        /** 键盘路由：1-4/a-d 答题；Enter 提交→下一题→结束并结算；结果卡/结算屏走主按钮。
         *  输入框/文本域聚焦时跳过（不劫持打字）。 */
        handleKey(e) {
          if (this.finished) return;
          const t = e.target;
          if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key !== "Enter") {
            if (this.view !== "question" || !this.q || this.q.answered) return;
            const question = this.currentQuestion();
            if (!question) return;
            const k = e.key.toLowerCase();
            const idx = ["1", "2", "3", "4"].indexOf(e.key) >= 0 ? Number(e.key) - 1 : ["a", "b", "c", "d"].indexOf(k);
            if (idx < 0 || idx >= question.options.length) return;
            e.preventDefault();
            this.answer(idx);
            return;
          }
          e.preventDefault();
          if (this.view === "question" && this.q) {
            const q = this.q;
            if (!q.answered) {
              const question = this.currentQuestion();
              if (question && question.correctIndices.length > 1) this.submitMulti();
              return;
            }
            if (q.lastCorrect) return;
            if (q.list.length) this.nextQuestion();
            else void this.finishNote();
            return;
          }
          if (this.view === "result") {
            const entry = this.entry();
            void this.handleResult(entry && entry.state === "passed" ? "next" : "note");
            return;
          }
          if (this.view === "summary") this.finish("done");
        }
        // ================= 跳过此篇（item 7） =================
        /** 当前篇回 pending 移到队尾：不评级不写盘；仅剩它自己待做时直接结算（防自环） */
        skipCurrent() {
          if (this.finished) return;
          const entry = this.entry();
          if (!entry || entry.state !== "doing") return;
          const othersPending = this.entries.some((en, i) => i !== this.cur && en.state === "pending");
          entry.state = "pending";
          if (!othersPending) {
            this.showSummary();
            return;
          }
          const idx = this.cur;
          this.entries.splice(idx, 1);
          this.entries.push(entry);
          this.cur = Math.max(0, idx - 1);
          this.q = null;
          void this.runNext();
        }
        // ================= 流程推进 =================
        async runNext() {
          var _a, _b;
          if (this.finished) return;
          const nextIdx = this.entries.findIndex((e) => e.state === "pending");
          if (nextIdx === -1) {
            this.showSummary();
            return;
          }
          this.cur = nextIdx;
          const entry = this.entries[nextIdx];
          entry.state = "doing";
          this.showLoading(entry);
          const questions = await this.opts.fetchQuestions(entry.item);
          if (this.finished) return;
          if (!questions || !questions.length) {
            notice(`「${entry.item.name}」暂无题目，已跳过`, "warning");
            entry.state = "pending";
            this.entries.splice(nextIdx, 1);
            this.cur = Math.max(0, nextIdx - 1);
            await this.runNext();
            return;
          }
          entry.questions = questions;
          this.q = {
            list: questions.slice(),
            cur: (_a = questions[0]) != null ? _a : null,
            answered: false,
            sel: /* @__PURE__ */ new Set(),
            lastCorrect: false,
            single: ((_b = questions[0]) == null ? void 0 : _b.correctIndices.length) === 1,
            doneCount: 0,
            totalCount: questions.length
          };
          this.renderQuestion();
        }
        async finishNote() {
          var _a, _b;
          const entry = this.entry();
          if (!entry || entry.state !== "doing" || this.finished) return;
          const total = entry.acc + entry.wrong;
          const acc = total ? Math.round(entry.acc / total * 100) : 0;
          const rating = accuracyToRating(acc);
          const passed = rating === "easy" || rating === "good";
          if (passed) {
            const nextReviewAt = await this.opts.onPassed(entry.item, rating, { acc: entry.acc, wrong: entry.wrong });
            if (this.finished) return;
            entry.state = "passed";
            entry.passNote = this.nextIntervalNote(nextReviewAt || entry.item.nextReviewDate);
          } else {
            await this.opts.onFailed(entry.item, rating, { acc: entry.acc, wrong: entry.wrong });
            if (this.finished) return;
            entry.state = "failed";
            this.finish("fail");
            return;
          }
          this.renderResult(entry);
          (_b = (_a = this.opts).onProgress) == null ? void 0 : _b.call(_a);
        }
        entry() {
          return this.entries[this.cur];
        }
        /** 通过后的下次间隔展示（onPassed 返回的写盘后 nextReviewDate） */
        nextIntervalNote(nextReviewAt) {
          if (!nextReviewAt) return "";
          const days = Math.max(1, Math.round((new Date(nextReviewAt).getTime() - Date.now()) / 864e5));
          return `${days} 天后`;
        }
        // ================= 答题 =================
        /** 渲染目标题：优先刚作答的题（答题反馈期），否则剩余队列首题 */
        currentQuestion() {
          var _a;
          if ((_a = this.q) == null ? void 0 : _a.cur) return this.q.cur;
          return this.q && this.q.list.length ? this.q.list[0] : null;
        }
        /** 单选点选 / 多选勾选 */
        answer(idx) {
          const q = this.q;
          if (!q || q.answered) return;
          const question = this.currentQuestion();
          if (!question) return;
          const single = question.correctIndices.length === 1;
          if (!single) {
            if (q.sel.has(idx)) q.sel.delete(idx);
            else q.sel.add(idx);
            this.renderQuestion();
            return;
          }
          q.answered = true;
          q.sel = /* @__PURE__ */ new Set([idx]);
          const correct = idx === question.correctIndices[0];
          q.lastCorrect = correct;
          this.consume(question, correct);
        }
        /** 多选提交 */
        submitMulti() {
          const q = this.q;
          if (!q || q.answered) return;
          const question = this.currentQuestion();
          if (!question) return;
          if (!q.sel.size) {
            notice("请至少选择一项", "warning");
            return;
          }
          q.answered = true;
          const sel = Array.from(q.sel).sort();
          const correctArr = question.correctIndices.slice().sort();
          const correct = sel.length === correctArr.length && sel.every((v, i) => v === correctArr[i]);
          q.lastCorrect = correct;
          this.consume(question, correct);
        }
        /** 消费当前题（出本轮；答对持久化删库后自动下一题，答错等「下一题」按钮） */
        consume(question, correct) {
          const q = this.q;
          const entry = this.entry();
          q.cur = question;
          q.list.shift();
          if (correct) entry.acc++;
          else entry.wrong++;
          q.doneCount++;
          if (correct) {
            void this.removeQuestionPersist(question).then(() => {
              if (this.finished) return;
              this.clearJump();
              this.jumpTimer = setTimeout(() => {
                this.jumpTimer = null;
                if (this.finished) return;
                this.advanceAfterAnswer();
              }, CORRECT_JUMP_DELAY_MS2);
            });
          }
          this.renderQuestion();
        }
        async removeQuestionPersist(q) {
          const quiz = this.opts.quiz;
          if (!quiz || !q.notePath) return;
          try {
            await quiz.manager.removeQuestion(this.opts.app, q.notePath, {
              question: q.question,
              options: q.options,
              correctIndices: q.correctIndices
            });
          } catch (e) {
            notice("删除题目失败：" + e.message + "，请重试", "error");
          }
        }
        /** 答错后「下一题」 / 答对自动跳 */
        nextQuestion() {
          var _a;
          if (!((_a = this.q) == null ? void 0 : _a.answered)) return;
          this.advanceAfterAnswer();
        }
        advanceAfterAnswer() {
          const entry = this.entry();
          if (this.q.list.length) {
            this.q.answered = false;
            this.q.sel = /* @__PURE__ */ new Set();
            this.q.cur = this.q.list[0];
            this.renderQuestion();
            return;
          }
          void this.finishNote();
        }
        // ================= 结果/结算动作 =================
        async handleResult(action) {
          if (action === "note") {
            this.finish("quit");
            return;
          }
          if (action === "end") {
            this.showSummary();
            return;
          }
          await this.runNext();
        }
        // ================= 视图构建（markup 单源：render.ts，issue 253） =================
        showLoading(entry) {
          this.view = "loading";
          this.opts.host.innerHTML = `${sprintHeadHtml()}${sprintLoadingHtml()}`;
          this.bindTop();
        }
        asideStates() {
          return this.entries.map((e) => ({ name: stripTitleMarks(e.item.name), state: e.state }));
        }
        renderQuestion() {
          var _a, _b, _c, _d, _e;
          const entry = this.entry();
          const q = this.q;
          const question = this.currentQuestion();
          if (!question) return;
          const main = sprintQuestionHtml(
            { questions: entry.questions, doneCount: q.doneCount },
            question,
            { answered: q.answered, sel: [...q.sel], lastCorrect: q.lastCorrect, remaining: q.list.length }
          );
          this.view = "question";
          this.opts.host.innerHTML = `${sprintHeadHtml()}${sprintBodyHtml(main, this.asideStates())}`;
          mountIcons(this.opts.host);
          this.bindTop();
          (_a = this.opts.host.querySelector('[data-action="submit"]')) == null ? void 0 : _a.addEventListener("click", () => this.submitMulti());
          (_b = this.opts.host.querySelector('[data-action="next"]')) == null ? void 0 : _b.addEventListener("click", () => this.nextQuestion());
          (_c = this.opts.host.querySelector('[data-action="note"]')) == null ? void 0 : _c.addEventListener("click", () => {
            void this.finishNote();
          });
          this.opts.host.querySelectorAll(".bz-sprint-opt").forEach((el) => {
            const activate = () => this.answer(Number(el.dataset.i));
            el.addEventListener("click", activate);
            el.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            });
          });
          (_e = (_d = this.opts).onProgress) == null ? void 0 : _e.call(_d);
        }
        renderResult(entry) {
          var _a, _b, _c, _d, _e;
          const total = entry.acc + entry.wrong;
          const acc = total ? Math.round(entry.acc / total * 100) : 0;
          const rating = accuracyToRating(acc);
          const passed = rating === "easy" || rating === "good";
          const remain = this.remainingCount;
          const name = stripTitleMarks(entry.item.name);
          const nextLabel = this.mode === "single" ? "完成 · 回面板" : remain > 0 ? `下一篇 · ${this.nextPendingName()}` : "完成本轮 · 结算";
          const ratingLine = this.mode === "redo" ? `${RATING_NAMES2[rating]} · 已解除待重做` : `${RATING_NAMES2[rating]} · 下次 ${entry.passNote || "已排期"}`;
          this.view = "result";
          this.opts.host.innerHTML = `${sprintHeadHtml()}${sprintBodyHtml(
            sprintResultHtml({
              name,
              acc: entry.acc,
              wrong: entry.wrong,
              passed,
              ratingLine: passed ? ratingLine : `${RATING_NAMES2[rating]} · 待重做`,
              nextLabel,
              showEnd: remain > 0 && this.mode !== "single"
            }),
            this.asideStates()
          )}`;
          mountIcons(this.opts.host);
          this.bindTop();
          (_a = this.opts.host.querySelector('[data-action="next"]')) == null ? void 0 : _a.addEventListener("click", () => void this.handleResult("next"));
          (_b = this.opts.host.querySelector('[data-action="end"]')) == null ? void 0 : _b.addEventListener("click", () => void this.handleResult("end"));
          (_c = this.opts.host.querySelector('[data-action="note"]')) == null ? void 0 : _c.addEventListener("click", () => void this.handleResult("note"));
          (_e = (_d = this.opts).onProgress) == null ? void 0 : _e.call(_d);
        }
        nextPendingName() {
          const nx = this.entries.find((e) => e.state === "pending");
          return nx ? stripTitleMarks(nx.item.name).slice(0, 12) : "";
        }
        showSummary() {
          var _a, _b;
          this.view = "summary";
          const passed = this.passedCount;
          const failed = this.failedCount;
          const total = passed + failed;
          const streak = (_a = this.opts.streakDays) != null ? _a : 0;
          this.opts.host.innerHTML = `${sprintHeadHtml()}${sprintSummaryHtml({ total, passed, failed, streak })}`;
          mountIcons(this.opts.host);
          this.bindTop();
          (_b = this.opts.host.querySelector('[data-action="done"]')) == null ? void 0 : _b.addEventListener("click", () => this.finish("done"));
        }
        /** 顶部/队列共同动作（跳过此篇 / 退出按钮） */
        bindTop() {
          var _a, _b;
          (_a = this.opts.host.querySelector('[data-action="quit"]')) == null ? void 0 : _a.addEventListener("click", () => this.finish("quit"));
          (_b = this.opts.host.querySelector('[data-action="skip"]')) == null ? void 0 : _b.addEventListener("click", () => this.skipCurrent());
        }
      };
      RATING_NAMES2 = { easy: "轻松", good: "一般", hard: "困难", again: "忘了" };
    }
  });

  // src/review/settings-schema.ts
  function reviewSettingsSchema(deps) {
    return {
      groups: [
        {
          // 外观组（issue 246 占位单卡）：布局/主题各一档，域 UI 消费待皮肤设计时接入
          icon: "palette",
          name: "外观",
          rows: [
            { type: "choiceCards", name: "面板布局", binding: { key: "reviewSkin" }, options: [{ value: "default", label: "三区队列", prevClass: "bz-sp-prev-panel" }] },
            { type: "choiceCards", name: "面板主题", binding: { key: "reviewSkinTheme" }, layoutKey: "reviewSkin", options: [{ value: "sage", label: "苔绿", layout: "default", prevClass: "bz-sp-prev-sage" }] }
          ]
        },
        {
          icon: "bell",
          name: "检查提醒",
          rows: [
            { type: "toggle", name: "到期提醒", desc: "有笔记到期待复习时自动弹出提醒", binding: { key: "enableAutoNotify" } },
            { type: "toggle", name: "新笔记加入提醒", desc: "新笔记被自动加入时弹出提示，多条合并成一条", binding: { key: "reviewAutoAddNotice" } }
          ]
        },
        {
          icon: "graduation-cap",
          name: "做题家",
          rows: [
            { type: "toggle", name: "用做题测难度", desc: "开始复习即做题，按正确率自动定难度", binding: { key: "forceQuizForReview" } },
            // 出题子项：仅「用做题测难度」开启时显示（ticket 170 isChild 联动 + visibleWhen 兜底）
            { type: "toggle", name: "允许多选题", desc: "开启后 AI 可能出多选题，关闭则只出单选题", binding: { key: "enableMultipleChoice" }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
            { type: "text", name: "每篇笔记出题数量", desc: "固定每篇笔记出题的数量，留空/0=自动", binding: { key: "questionsPerNote" }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
            { type: "toggle", name: "打乱出题顺序", desc: "做题时随机排列题目顺序", binding: { key: "shuffleQuestions" }, visibleWhen: (s) => s.forceQuizForReview === true, isChild: true },
            {
              type: "select",
              name: "出题难度",
              desc: "控制 AI 出题深浅",
              binding: { key: "difficulty" },
              options: [
                { value: "random", label: "随机" },
                { value: "easy", label: "简单" },
                { value: "medium", label: "中等" },
                { value: "hard", label: "困难" }
              ],
              visibleWhen: (s) => s.forceQuizForReview === true,
              isChild: true
            }
          ]
        },
        {
          icon: "timer",
          name: "复习节奏",
          rows: [
            // 非正数钳制为 0（原 onChange 口径：>0 保留否则 0）；空串不写（防脏值落盘）
            { type: "number", name: "每日复习上限", desc: "一轮最多复习的篇数，不填则不限制", binding: { key: "reviewDailyLimit" }, min: 0 },
            // 原钳制「n>0 且 n<=5 保留、否则回 1」：渲染器 min/max 只做边界钳制，超上界回 1 语义在 onChange 复刻
            {
              type: "number",
              name: "复习间隔缩放",
              desc: "数值越小复习越频繁，数值越大越宽松",
              binding: { key: "reviewIntervalScale" },
              onChange: (v) => {
                if (!(v > 0 && v <= 5)) getSettings().reviewIntervalScale = 1;
              }
            },
            // ADR-0077：R 目标阈值（低于该值视为可复习/提前；默认 0.9）
            {
              type: "number",
              name: "R 目标阈值",
              desc: "记忆保留度低于该值视为该复习了",
              binding: { key: "reviewRThreshold" },
              min: 0.5,
              max: 0.99
            }
          ]
        },
        {
          icon: "brain",
          name: "记忆算法",
          rows: [
            // ADR-0077：FSRS 参数自动拟合（全自动定期重算）
            { type: "toggle", name: "参数自动拟合", desc: "按个人复习历史拟合记忆参数，优化复习节奏", binding: { key: "reviewEnableFit" } },
            {
              type: "number",
              name: "每 N 次复习重算",
              desc: "累计 N 次评级后自动重拟合一次",
              binding: { key: "reviewFitEveryN" },
              min: 1,
              visibleWhen: (s) => s.reviewEnableFit === true,
              isChild: true
            }
          ]
        },
        {
          icon: "sliders-horizontal",
          name: "自动化",
          rows: [
            // 监听文件夹：通用 path 行（multi chips + 添加… 按钮，ticket 133 形态）。
            // 落盘走外部 binding 自管（权威写盘在 onChange）：新增目录需先确认存量收编（取消=不加入，
            // 回传回退清单否决本次变更），移除目录需连带清理其下排除记录（ticket 099）。
            {
              type: "path",
              mode: "multi",
              name: "监听文件夹",
              desc: "文件夹里的新笔记自动加入复习计划，包括子文件夹",
              binding: {
                get: () => getSettings().reviewWatchedFolders || [],
                set: () => {
                },
                save: () => {
                }
              },
              pickerTitle: "选择监听文件夹",
              pickerDesc: "文件夹里的新笔记自动加入复习计划，包括子文件夹",
              onChange: (list) => {
                const prev = [...getSettings().reviewWatchedFolders || []];
                return (async () => {
                  const { ReviewWatcher: ReviewWatcher2 } = await Promise.resolve().then(() => (init_watch(), watch_exports));
                  const watcher = new ReviewWatcher2(deps.app, deps.dataManager);
                  const kept = [];
                  for (const folder of list) {
                    if (!folder) {
                      notice("暂不支持监听库根目录", "warning");
                      continue;
                    }
                    if (prev.includes(folder)) {
                      kept.push(folder);
                      continue;
                    }
                    if (await watcher.confirmBatchAddForFolder(folder)) kept.push(folder);
                  }
                  for (const folder of prev) {
                    if (list.includes(folder)) continue;
                    const cleared = await watcher.removeWatchedFolder(folder);
                    notice(cleared > 0 ? `已移除监听文件夹，并清理其下 ${cleared} 条排除记录` : "已移除监听文件夹", "success");
                  }
                  getSettings().reviewWatchedFolders = kept;
                  await saveSettings();
                  return kept;
                })();
              }
            },
            // 排除名单（通用 list 行，chips 自绘 DOM 已退役）：单条解除 = 移除按钮，逐条清理
            {
              type: "list",
              name: "排除名单",
              desc: "不参与监听自动加入的笔记，可在此单条解除",
              items: () => (getSettings().reviewExcludedNotes || []).map((path) => ({ key: path, label: path })),
              emptyText: "暂无排除笔记",
              removeLabel: "解除",
              onChange: (keys) => {
                void (async () => {
                  const prev = getSettings().reviewExcludedNotes || [];
                  const removed = prev.filter((p) => !keys.includes(p));
                  if (removed.length === 0) return;
                  const { ReviewWatcher: ReviewWatcher2 } = await Promise.resolve().then(() => (init_watch(), watch_exports));
                  const watcher = new ReviewWatcher2(deps.app, deps.dataManager);
                  for (const path of removed) await watcher.removeExcludedNote(path);
                  notice("已解除排除", "success");
                })();
              }
            }
          ]
        },
        {
          icon: "eye",
          name: "界面",
          rows: [
            { type: "toggle", name: "文件树标记", desc: "在文件树中为复习笔记着色并标到期时间", binding: { key: "reviewTreeBadge" } }
          ]
        }
      ]
    };
  }
  var init_settings_schema = __esm({
    "src/review/settings-schema.ts"() {
      init_notice();
      init_settings_provider();
    }
  });

  // src/review/stats-ui.ts
  var stats_ui_exports = {};
  __export(stats_ui_exports, {
    closeStatsModal: () => closeStatsModal,
    closeTimeline: () => closeTimeline,
    showStatsModal: () => showStatsModal,
    showTimeline: () => showTimeline
  });
  function statCardHTML(label, value, idx) {
    const bg = PASTEL_CARDS[idx % PASTEL_CARDS.length];
    return `<div class="bz-stats-card" style="background:${bg};">
    <div class="bz-stats-card-val">${value}</div>
    <div class="bz-stats-card-lbl">${label}</div>
  </div>`;
  }
  function sectionHTML(title, body, accent = "#D6E4FF") {
    return `<div class="bz-stats-section">
    <div class="bz-stats-section-head">
      <span class="bz-stats-section-accent" style="background:${accent};"></span>
      <span>${title}</span>
    </div>
    ${body}
  </div>`;
  }
  function emptyHTML() {
    return '<p class="bz-stats-empty">暂无数据</p>';
  }
  function softBarHTML(entries, color) {
    if (!entries.length) return emptyHTML();
    const max = Math.max(...entries.map((e) => e.value), 1);
    return entries.map((e) => `
    <div class="bz-stats-bar-row">
      <span class="bz-stats-bar-lbl">${e.label}</span>
      <div class="bz-stats-bar-track">
        <div class="bz-stats-bar-fill" style="width:${Math.max(e.value / max * 100, 2)}%;background:${color};"></div>
      </div>
      <span class="bz-stats-bar-val">${e.value}</span>
    </div>`).join("");
  }
  function barChartHTML(entries, color) {
    if (!entries.length) return emptyHTML();
    const max = Math.max(...entries.map((e) => e.value), 1);
    const minH = 26, maxH = 92;
    return `
    <div class="bz-stats-chart-scroll">
      <div class="bz-stats-chart" style="min-width:${Math.max(entries.length * 34, 200)}px;">
      ${entries.map((e) => {
      const h = max > 0 ? minH + e.value / max * (maxH - minH) : minH;
      return `
        <div class="bz-stats-chart-col">
          <div class="bz-stats-chart-bar" style="height:${h}px;background:${color};">${e.value || ""}</div>
          <div class="bz-stats-chart-lbl">${e.label}</div>
        </div>`;
    }).join("")}
      </div>
    </div>`;
  }
  function statInlineHTML(items) {
    return `<div class="bz-stats-inline">${items.map((s) => `
    <span class="bz-stats-inline-chip">${s}</span>`).join("")}</div>`;
  }
  function rankListHTML(items) {
    if (!items.length) return emptyHTML();
    const badges = ["#FFF3C4", "#D8F3DC", "#D6E4FF"];
    return items.map((it, i) => {
      const rank = i < 3 ? `<span class="bz-stats-rank-badge" style="background:${badges[i]};">${i + 1}</span>` : `<span class="bz-stats-rank-plain">${i + 1}</span>`;
      return `<div class="bz-review-stats-tl-row" data-idx="${i}">
      ${rank}
      <span class="bz-stats-rank-name">${escapeHtml(it.name)}</span>
      ${it.sub ? `<span class="bz-stats-rank-sub">${it.sub}</span>` : ""}
      <span class="bz-stats-rank-meta">${it.meta}</span>
    </div>`;
    }).join("");
  }
  async function showStatsModal(app, dm) {
    lastDm = dm;
    const items = await dm.loadItems();
    let w;
    try {
      w = (await Promise.resolve().then(() => (init_app2(), app_exports))).reviewApp.currentW();
    } catch (e) {
      w = void 0;
    }
    renderStatsModal(app, dm, items, w);
  }
  function renderStatsModal(app, dm, items, w) {
    closeStatsModal();
    statsMask = document.createElement("div");
    statsMask.id = "review-stats-mask";
    statsMask.style.display = "block";
    statsMask.style.zIndex = String(allocZ());
    statsMask.onclick = closeStatsModal;
    statsPopup = document.createElement("div");
    statsPopup.id = "review-stats-popup";
    statsPopup.style.display = "flex";
    statsPopup.style.zIndex = String(allocZ());
    topifyZ(statsMask, statsPopup);
    const header = document.createElement("div");
    header.className = "bz-win-head bz-review-stats-head";
    header.innerHTML = `
    <h3 class="bz-review-title">复习统计</h3>
  `;
    statsPopup.appendChild(header);
    const body = document.createElement("div");
    body.id = "review-stats-body";
    body.className = "bz-review-stats-body";
    statsPopup.appendChild(body);
    document.body.appendChild(statsMask);
    document.body.appendChild(statsPopup);
    const stats = computeStats(items, { w });
    body.innerHTML = buildStatsHTML(app, dm, items, stats);
    body.querySelectorAll(".bz-review-stats-tl-row").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.idx);
        const target = items.filter((i) => (i.reviewHistory || []).length).sort((a, b) => {
          var _a, _b, _c, _d;
          const la = ((_b = (_a = a.reviewHistory) == null ? void 0 : _a[a.reviewHistory.length - 1]) == null ? void 0 : _b.timestamp) || "";
          const lb = ((_d = (_c = b.reviewHistory) == null ? void 0 : _c[b.reviewHistory.length - 1]) == null ? void 0 : _d.timestamp) || "";
          return lb.localeCompare(la);
        })[idx];
        if (target) void showTimeline(app, dm, target);
      });
    });
    statsEsc = escManager.register("review-stats", {
      isVisible: () => !!statsMask && statsMask.style.display === "block",
      close: closeStatsModal
    });
  }
  function buildStatsHTML(app, dm, items, stats) {
    var _a, _b;
    const cards = `
    <div class="bz-stats-cards">
      ${statCardHTML("总复习（天）", stats.totalReviews, 0)}
      ${statCardHTML("连续天数", stats.streak, 1)}
      ${statCardHTML("今日复习", stats.todayReviews, 2)}
      ${statCardHTML("逾期率", Math.round(stats.overdueRate * 100) + "%", 3)}
      ${statCardHTML("平均 R", stats.avgR === null ? "-" : Math.round(stats.avgR * 100) + "%", 4)}
      ${statCardHTML("复习笔记", stats.reviewedNotes, 5)}
    </div>`;
    const total = Object.values(stats.ratingDist).reduce((a, b) => a + b, 0) || 1;
    const ratingBars = ["again", "hard", "good", "easy"].map((r) => ({
      label: RATING_NAMES[r],
      value: stats.ratingDist[r] || 0
    }));
    const ratingHTML = sectionHTML(
      "评级分布",
      softBarHTML(ratingBars, "#D6E4FF") + statInlineHTML([`共 ${total} 次评级`]),
      "#FFE5CC"
    );
    const dist = loadDistribution(items, 14);
    const tmr = /* @__PURE__ */ new Date();
    tmr.setDate(tmr.getDate() + 1);
    const todayKey = dateKey(/* @__PURE__ */ new Date());
    const tmrKey = dateKey(tmr);
    const todayCnt = ((_a = dist.find((d) => d.date === todayKey)) == null ? void 0 : _a.count) || 0;
    const tmrCnt = ((_b = dist.find((d) => d.date === tmrKey)) == null ? void 0 : _b.count) || 0;
    const maxDist = Math.max(1, ...dist.map((d) => d.count));
    const distBars = dist.map((d) => ({
      label: d.date === todayKey ? "今" : `+${dist.indexOf(d)}`,
      value: d.count
    }));
    const loadHTML = sectionHTML(
      "复习负载",
      statInlineHTML([`今日 ${todayCnt} 篇`, `明日 ${tmrCnt} 篇`, `峰值 ${maxDist} 篇/天`]) + barChartHTML(distBars, "#D6E4FF"),
      "#D6E4FF"
    );
    const withHistory = items.filter((i) => (i.reviewHistory || []).length).sort((a, b) => {
      var _a2, _b2, _c, _d;
      const la = ((_b2 = (_a2 = a.reviewHistory) == null ? void 0 : _a2[a.reviewHistory.length - 1]) == null ? void 0 : _b2.timestamp) || "";
      const lb = ((_d = (_c = b.reviewHistory) == null ? void 0 : _c[b.reviewHistory.length - 1]) == null ? void 0 : _d.timestamp) || "";
      return lb.localeCompare(la);
    });
    const tlItems = withHistory.slice(0, 10).map((i) => {
      var _a2;
      const h = i.reviewHistory || [];
      const lastTs = (_a2 = h[h.length - 1]) == null ? void 0 : _a2.timestamp;
      const cnt = h.length;
      return {
        name: stripTitleMarks(i.name),
        sub: `${cnt} 次`,
        meta: lastTs ? formatRelativeTime(new Date(lastTs)) : ""
      };
    });
    const timelineHTML = sectionHTML(
      "复习时间线",
      rankListHTML(tlItems) + '<div class="bz-stats-hint">点击笔记查看复习历史</div>',
      "#FADDE1"
    );
    const daily7 = stats.daily7.map((d) => ({ label: d.date.slice(5).replace("-", "/"), value: d.count }));
    const weekHTML = sectionHTML("最近 7 天复习量", barChartHTML(daily7, "#E6DFF5"), "#E6DFF5");
    return cards + ratingHTML + loadHTML + timelineHTML + weekHTML;
  }
  async function showTimeline(app, dm, item) {
    closeTimeline();
    let w;
    try {
      w = (await Promise.resolve().then(() => (init_app2(), app_exports))).reviewApp.currentW();
    } catch (e) {
      w = void 0;
    }
    const history = historyOf(item);
    histMask = document.createElement("div");
    histMask.id = "review-history-mask";
    histMask.style.display = "block";
    histMask.style.zIndex = String(allocZ());
    histMask.onclick = closeTimeline;
    histPopup = document.createElement("div");
    histPopup.id = "review-history-popup";
    histPopup.style.display = "flex";
    histPopup.style.zIndex = String(allocZ());
    topifyZ(histMask, histPopup);
    const body = document.createElement("div");
    body.id = "review-history-body";
    body.className = "bz-review-history-body";
    histPopup.appendChild(body);
    document.body.appendChild(histMask);
    document.body.appendChild(histPopup);
    const status = document.createElement("div");
    status.className = "bz-review-history-status";
    const stageText = item.phase === "fsrs" ? `FSRS Lv.${(item.stage || 0) - 9 + 1}` : `${(item.stage || 0) + 1}/10`;
    let curR = null;
    if (item.phase === "fsrs" && item.stability && item.lastReviewed) {
      const t = ((/* @__PURE__ */ new Date()).getTime() - new Date(item.lastReviewed).getTime()) / 864e5;
      if (t > 0) {
        const R = new FSRS(w || DEFAULT_W).R(t, item.stability);
        curR = ` · 当前 R ${Math.round(R * 100)}%`;
      }
    }
    status.innerHTML = `
    <div class="bz-review-history-name">${escapeHtml(stripTitleMarks(item.name))}</div>
    <div class="bz-review-history-sub">${stageText} · 共 ${history.length} 次复习${curR || ""}</div>
  `;
    body.appendChild(status);
    if (!history.length) {
      const empty = document.createElement("div");
      empty.className = "bz-review-history-empty";
      empty.textContent = "暂无复习记录";
      body.appendChild(empty);
      histEsc = escManager.register("review-history", { isVisible: () => !!histMask && histMask.style.display === "block", close: closeTimeline });
      return;
    }
    const tl = document.createElement("div");
    tl.className = "bz-review-history-tl";
    const itemsHTML = history.map((h, i) => {
      const isLast = i === history.length - 1;
      const ratingName = RATING_NAMES[h.rating] || h.rating;
      const color = RATING_COLORS[h.rating] || "#888";
      const rText = h.R !== void 0 ? `R=${h.R <= 1 ? Math.round(h.R * 100) : Math.round(h.R)}%` : "";
      const sText = h.stability !== void 0 ? `S=${h.stability}` : "";
      const meta = [rText, sText].filter(Boolean).join(" · ");
      const line = isLast ? "" : '<div class="bz-review-history-line"></div>';
      return `
      <div class="bz-review-history-item${isLast ? " is-last" : ""}">
        ${line}
        <div class="bz-review-history-dot" style="background:${color};"></div>
        <div class="bz-review-history-row">
          <span class="bz-review-history-time">${formatRelativeTime(new Date(h.timestamp))}</span>
          <span class="bz-review-history-rating" style="color:${color};">${ratingName}</span>
          <span class="bz-review-history-stage">阶段${h.stage}${meta ? " · " + meta : ""}</span>
        </div>
      </div>`;
    }).join("");
    tl.innerHTML = itemsHTML;
    body.appendChild(tl);
    histEsc = escManager.register("review-history", {
      isVisible: () => !!histMask && histMask.style.display === "block",
      close: closeTimeline
    });
  }
  function closeTimeline() {
    histEsc == null ? void 0 : histEsc.unregister();
    histEsc = null;
    if (histMask) histMask.remove();
    if (histPopup) histPopup.remove();
    histMask = null;
    histPopup = null;
  }
  function closeStatsModal() {
    statsEsc == null ? void 0 : statsEsc.unregister();
    statsEsc = null;
    if (statsMask) statsMask.remove();
    if (statsPopup) statsPopup.remove();
    statsMask = null;
    statsPopup = null;
    closeTimeline();
  }
  var statsMask, statsPopup, statsEsc, lastDm, PASTEL_CARDS, histMask, histPopup, histEsc;
  var init_stats_ui = __esm({
    "src/review/stats-ui.ts"() {
      init_z_order();
      init_esc_manager();
      init_utils();
      init_stats();
      init_fsrs();
      statsMask = null;
      statsPopup = null;
      statsEsc = null;
      lastDm = null;
      PASTEL_CARDS = ["#D6E4FF", "#D8F3DC", "#CDF0EA", "#FADDE1", "#FFE5CC", "#E6DFF5"];
      histMask = null;
      histPopup = null;
      histEsc = null;
    }
  });

  // src/review/ui.ts
  var ui_exports2 = {};
  __export(ui_exports2, {
    UIManager: () => UIManager,
    isDueToday: () => isDueToday,
    isPlayable: () => isPlayable,
    mountFloatingRatingBar: () => mountFloatingRatingBar,
    reviewSettingsSchema: () => reviewSettingsSchema
  });
  function mountFloatingRatingBar(opts) {
    const el = document.createElement("div");
    el.className = "bz-review-bar";
    el.style.zIndex = String(allocZ());
    el.innerHTML = reviewBarHtml(opts);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      el.remove();
    };
    el.querySelectorAll(".bz-review-bar-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = btn.dataset.rating;
        if (r === "skip") opts.onSkip();
        else if (r === "again" || r === "hard" || r === "good" || r === "easy") opts.onRate(r);
        close();
      });
    });
    document.body.appendChild(el);
    return { close };
  }
  var isPlayable2, UIManager;
  var init_ui2 = __esm({
    "src/review/ui.ts"() {
      init_z_order();
      init_notice();
      init_flow_dialog();
      init_esc_manager();
      init_settings_provider();
      init_ui();
      init_item_actions();
      init_fsrs();
      init_render();
      init_queue();
      init_sprint();
      init_settings_schema();
      isPlayable2 = isPlayable;
      UIManager = class {
        constructor(app, dataManager2) {
          /** R 展示口径权重源（item 12：与调度排期同读拟合权重；ensureReview 注入 reviewApp.currentW，缺省回退默认） */
          this.wSource = () => DEFAULT_W;
          this.mask = null;
          this.popup = null;
          /** 内容区容器（队列/冲刺共用宿主） */
          this.entriesContainer = null;
          /** 当前冲刺会话（内容区被占用时队列交互禁用） */
          this.sprint = null;
          /** 冲刺入口 in-flight 防抖（双击/并发触发只放行一次，防双开会话双倍 AI 调用） */
          this.sprintStarting = false;
          this.showArchived = false;
          this.escHandle = null;
          this.app = app;
          this.dataManager = dataManager2;
          this.createMainUI();
          this.registerEscLayer();
        }
        get inSprint() {
          return !!this.sprint;
        }
        // ================= 面板构建 =================
        createMainUI() {
          if (this.mask && document.body.contains(this.mask)) return;
          this.mask = document.createElement("div");
          this.mask.id = "review-mask";
          this.mask.classList.add("bz-panel-overlay");
          this.mask.style.display = "none";
          this.mask.style.zIndex = String(allocZ());
          this.mask.onclick = () => {
            if (!this.sprint) this.hideMain();
          };
          this.popup = document.createElement("div");
          this.popup.id = "review-popup";
          this.popup.classList.add("bz-panel-frame");
          this.popup.classList.add("bz-panel-mtop");
          this.popup.style.display = "none";
          this.popup.style.zIndex = String(allocZ());
          const content = document.createElement("div");
          content.id = "review-entries-container";
          this.popup.appendChild(content);
          this.entriesContainer = content;
          document.body.appendChild(this.mask);
          document.body.appendChild(this.popup);
        }
        registerEscLayer() {
          if (this.escHandle) return;
          this.escHandle = escManager.register("review-main", {
            isVisible: () => !!this.mask && this.mask.style.display === "block",
            close: () => this.hideMain()
          });
        }
        // ================= 显示/隐藏 =================
        async showMain() {
          this.createMainUI();
          if (!this.mask || !this.popup) return;
          topifyZ(this.mask, this.popup);
          this.mask.style.display = "block";
          this.popup.style.display = "flex";
          await this.showQueue();
        }
        hideMain() {
          if (this.sprint) return;
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
        }
        destroy() {
          const sprint = this.sprint;
          this.sprint = null;
          sprint == null ? void 0 : sprint.destroy();
          this.hideMain();
          if (this.escHandle) {
            this.escHandle.unregister();
            this.escHandle = null;
          }
          if (this.mask) this.mask.remove();
          if (this.popup) this.popup.remove();
          this.mask = null;
          this.popup = null;
          this.entriesContainer = null;
        }
        // ================= 队列渲染（三区） =================
        /** 读盘并渲染三区队列（外部刷新入口） */
        async refreshPanel() {
          if (this.sprint) return;
          const items = await this.dataManager.loadItems();
          this.renderEntries(items);
        }
        /** 渲染队列视图（冲刺态不响应） */
        renderEntries(items) {
          if (this.sprint) return;
          const container = this.entriesContainer;
          if (!container) return;
          container.innerHTML = this.queueViewHtml(items);
          if (!items.length) {
            const host = container.querySelector("[data-empty-host]");
            if (host) {
              const acts = document.createElement("div");
              acts.className = "bz-btn-row";
              const addBtn = document.createElement("button");
              addBtn.className = "bz-btn bz-btn--primary";
              addBtn.dataset.act = "add-current";
              addBtn.textContent = "把当前笔记加入复习";
              const helpBtn = document.createElement("button");
              helpBtn.className = "bz-btn bz-btn--ghost";
              helpBtn.dataset.act = "watch-help";
              helpBtn.textContent = "如何配置监听文件夹";
              acts.appendChild(addBtn);
              acts.appendChild(helpBtn);
              host.appendChild(
                uiEmpty({
                  icon: "inbox",
                  title: "复习计划还是空的",
                  desc: "在 设置 → 复习计划 → 监听文件夹 添加文件夹后，新笔记会自动加入复习；也可以先把当前笔记加入。",
                  actions: acts
                })
              );
            }
          }
          mountIcons(container);
          this.bindQueueEvents(container, items);
        }
        /** 切回队列视图（冲刺结束回调）；遇仍活动的会话先销毁再置空（防孤儿 ESC 层） */
        async showQueue() {
          if (!this.entriesContainer) return;
          const active2 = this.sprint;
          this.sprint = null;
          active2 == null ? void 0 : active2.destroy();
          await this.refreshPanel();
        }
        // ================= 队列视图 HTML（markup 单源：render.queueViewHtml，issue 253） =================
        /** R 阈值提前复习判定（item 6：与开始本轮同口径；wSource=拟合权重） */
        rThreshold() {
          const s = tryGetSettings();
          return Number(s == null ? void 0 : s.reviewRThreshold) || DEFAULT_R_THRESHOLD;
        }
        queueViewHtml(items) {
          return queueViewHtml(items, {
            showArchived: this.showArchived,
            rThreshold: this.rThreshold(),
            w: this.wSource()
          });
        }
        // ================= 队列事件 =================
        bindQueueEvents(container, items) {
          var _a, _b, _c, _d, _e, _f;
          (_a = container.querySelector('[data-act="close"]')) == null ? void 0 : _a.addEventListener("click", () => this.hideMain());
          (_b = container.querySelector('[data-act="begin"]')) == null ? void 0 : _b.addEventListener("click", () => void this.beginRound());
          (_c = container.querySelector('[data-act="arch"]')) == null ? void 0 : _c.addEventListener("click", () => {
            this.showArchived = !this.showArchived;
            void this.refreshPanel();
          });
          (_d = container.querySelector('[data-act="stats"]')) == null ? void 0 : _d.addEventListener("click", () => void this.openStats());
          (_e = container.querySelector('[data-act="add-current"]')) == null ? void 0 : _e.addEventListener("click", () => void this.addCurrentNote());
          (_f = container.querySelector('[data-act="watch-help"]')) == null ? void 0 : _f.addEventListener("click", () => void this.showWatchHelp());
          container.querySelectorAll(".bz-q-card[data-id]:not(.no)").forEach((card) => {
            const activate = () => {
              const it = items.find((x) => x.id === card.dataset.id);
              if (it && isPlayable2(it)) void this.beginSingle(it);
            };
            card.addEventListener("click", activate);
            card.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activate();
              }
            });
          });
          container.querySelectorAll(".bz-q-card[data-id]").forEach((card) => {
            this.attachDrawer(card, items);
          });
        }
        // ================= 空态两条路（item 10） =================
        /** 把当前笔记加入复习（空库引导动作；命令同语义） */
        async addCurrentNote() {
          const file = this.app.workspace.getActiveFile();
          if (!file) {
            notice("请先打开一个笔记", "warning");
            return;
          }
          const { reviewApp: reviewApp2 } = await Promise.resolve().then(() => (init_app2(), app_exports));
          try {
            await reviewApp2.addCurrentToReview(file);
            await this.refreshPanel();
            await reviewApp2.applyReviewStyles(this.app);
          } catch (e) {
            notice("加入复习计划失败：" + ((e == null ? void 0 : e.message) || e) + "，请重试", "error");
          }
        }
        /** 配置监听文件夹说明（空库引导动作；设置面板路径指路） */
        async showWatchHelp() {
          await openFlowDialog({
            title: "配置监听文件夹",
            message: "打开 设置 → 复习计划 → 监听文件夹，添加文件夹后，其中新建的笔记会自动加入复习计划；已存在的笔记可在添加时选择一并加入。",
            actions: [{ label: "知道了", value: "ok", cta: true }]
          });
        }
        // ================= 冲刺入口（连接 app 编排） =================
        async beginRound() {
          if (this.sprintStarting) return;
          this.sprintStarting = true;
          try {
            const { reviewApp: reviewApp2 } = await Promise.resolve().then(() => (init_app2(), app_exports));
            await reviewApp2.autoJumpOverdue();
          } finally {
            this.sprintStarting = false;
          }
        }
        async beginSingle(item) {
          if (this.sprintStarting) return;
          this.sprintStarting = true;
          try {
            const { reviewApp: reviewApp2 } = await Promise.resolve().then(() => (init_app2(), app_exports));
            await reviewApp2.startSingleSprint(item);
          } finally {
            this.sprintStarting = false;
          }
        }
        /** 供 app 编排：进入做题冲刺会话（宿主接管内容区）。
         *  互斥：进入前强制销毁旧会话（防孤儿冲刺 ESC 层 + 旧题面覆盖队列视图）。 */
        startSprint(opts) {
          const container = this.entriesContainer;
          if (!container) return Promise.resolve("quit");
          const old = this.sprint;
          this.sprint = null;
          old == null ? void 0 : old.destroy();
          this.sprint = new SprintSession({
            app: this.app,
            host: container,
            queue: opts.queue,
            mode: opts.mode,
            quiz: opts.quiz,
            streakDays: opts.streakDays,
            fetchQuestions: opts.fetchQuestions,
            onPassed: opts.onPassed,
            onFailed: opts.onFailed,
            onExit: () => this.showQueue()
          });
          return this.sprint.start();
        }
        // ================= 归档 / 统计 =================
        async openStats() {
          const { showStatsModal: showStatsModal2 } = await Promise.resolve().then(() => (init_stats_ui(), stats_ui_exports));
          await showStatsModal2(this.app, this.dataManager);
        }
        // ================= 难度弹窗（评分命令用；markup 单源 render.difficultyDialogHtml） =================
        showDifficultyDialog(item, onSelect) {
          const old = document.querySelector(".difficulty-dialog");
          if (old) old.remove();
          const div = document.createElement("div");
          div.className = "difficulty-dialog";
          div.style.zIndex = String(allocZ());
          div.innerHTML = difficultyDialogHtml(item);
          document.body.appendChild(div);
          div.style.display = "block";
          div.querySelectorAll(".diff-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              unregisterSheetCompanion(div);
              div.remove();
              const diff = btn.dataset.diff;
              if (diff !== "cancel" && diff && onSelect) onSelect(diff);
            });
          });
          setTimeout(() => {
            const handler = (e) => {
              if (!div.contains(e.target)) {
                unregisterSheetCompanion(div);
                div.remove();
                document.removeEventListener("click", handler);
              }
            };
            document.addEventListener("click", handler);
          }, 100);
        }
        // ================= 抽屉（右键/长按） =================
        attachDrawer(card, items) {
          const item = items.find((x) => x.id === card.dataset.id);
          if (!item) return;
          card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            void this.openDrawer(item, card);
          });
        }
        async openDrawer(item, anchor) {
          const { attachItemActions: attachItemActions2, closeItemMenu: closeItemMenu2 } = await Promise.resolve().then(() => (init_item_actions(), item_actions_exports));
          const actions = [
            {
              icon: "file-text",
              label: "打开原文",
              onClick: () => void this.openItemFile(item)
            },
            {
              icon: "history",
              label: "查看历史",
              onClick: () => {
                void (async () => {
                  const { showTimeline: showTimeline2 } = await Promise.resolve().then(() => (init_stats_ui(), stats_ui_exports));
                  showTimeline2(this.app, this.dataManager, item);
                })();
              }
            },
            {
              icon: "trash-2",
              label: "移出复习计划",
              kind: "danger",
              onClick: () => {
                void openFlowDialog({
                  title: "移出复习计划",
                  message: `确定移出「${item.name}」吗？移出后可在通知中撤销。`,
                  actions: [
                    { label: "取消", value: "cancel" },
                    { label: "移出", value: "ok", cta: true }
                  ]
                }).then(async (v) => {
                  if (v !== "ok") return;
                  try {
                    await this.dataManager.removeItem(item.filePath);
                    await this.refreshPanel();
                    const { reviewApp: reviewApp2 } = await Promise.resolve().then(() => (init_app2(), app_exports));
                    await reviewApp2.applyReviewStyles(this.app);
                    notifyUndo(`已移出「${item.name}」`, () => {
                      void (async () => {
                        try {
                          await this.dataManager.restoreItem(item);
                          await this.refreshPanel();
                          const { reviewApp: ra } = await Promise.resolve().then(() => (init_app2(), app_exports));
                          await ra.applyReviewStyles(this.app);
                        } catch (e) {
                          notifySaveError(e, "恢复复习条目");
                        }
                      })();
                    });
                  } catch (e) {
                    notifySaveError(e, "移出复习条目");
                  }
                });
              }
            }
          ];
          attachItemActions2(anchor, actions);
        }
        async openItemFile(item) {
          const file = this.app.vault.getAbstractFileByPath(item.filePath);
          if (!file) {
            notice(`笔记「${item.name}」的文件已删除`, "warning");
            return;
          }
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file);
        }
      };
    }
  });

  // src/review/app.ts
  var app_exports = {};
  __export(app_exports, {
    REVIEW_AWAY_GRACE_MS: () => REVIEW_AWAY_GRACE_MS,
    __setReviewAwayGraceMsForTests: () => __setReviewAwayGraceMsForTests,
    reviewApp: () => reviewApp
  });
  function __setReviewAwayGraceMsForTests(ms) {
    REVIEW_AWAY_GRACE_MS = ms;
  }
  var REVIEW_AWAY_GRACE_MS, reviewApp;
  var init_app2 = __esm({
    "src/review/app.ts"() {
      init_notice();
      init_app();
      init_settings_provider();
      init_fsrs();
      init_data();
      init_data();
      init_fit();
      init_fsrs();
      init_queue();
      init_stats();
      init_domain_bus();
      REVIEW_AWAY_GRACE_MS = 12e4;
      reviewApp = {
        checkInterval: null,
        dataManager: null,
        /** 测试注入：对齐源码 window.__quiz 语义 */
        _quizOverride: null,
        /** 连续复习单框通知（同键合并，动态更新消息） */
        _reviewNotice: null,
        /** 已通知逾期的笔记路径（ticket 100：diff 记忆集合，避免重复刷屏） */
        _notifiedOverdue: /* @__PURE__ */ new Set(),
        /** 逾期常驻通知句柄：同键合并时 notify 返回空操作，留存真句柄供逾期清零时主动收起 */
        _overdueNotice: null,
        /** ticket 48：已染色/挂徽章的文件路径（移出计划后据此回退；仅提交计划路径 + 曾染色路径，不再全库扫描） */
        _styledPaths: /* @__PURE__ */ new Set(),
        /** ADR-0077：最近一次复习的累计计数（每 N 次触发拟合重算） */
        _reviewCountSinceFit: 0,
        /** ADR-0077：当前生效的拟合权重（null=用默认 DEFAULT_W） */
        _fittedW: null,
        /** ADR-0077：拟合运行防重入 */
        _fitRunning: false,
        /** P3：reviewLoop 活动轮询句柄（卸载统一清理；插件禁用后不得继续读盘翻篇弹通知） */
        _reviewLoops: /* @__PURE__ */ new Set(),
        /** item 4：普通复习悬浮迷你评级条句柄（reviewLoop 存续期间挂屏幕底部） */
        _reviewBar: null,
        /** item 5：本轮队列断点（中断/超时可恢复继续） */
        _pendingRound: null,
        /** P3：终止全部 reviewLoop 轮询（unloadReview 调用；幂等） */
        stopReviewLoops() {
          for (const t of this._reviewLoops) clearInterval(t);
          this._reviewLoops.clear();
          this.hideReviewBar();
          this._pendingRound = null;
        },
        /** item 4：收起悬浮评级条（幂等） */
        hideReviewBar() {
          var _a;
          (_a = this._reviewBar) == null ? void 0 : _a.close();
          this._reviewBar = null;
        },
        async getQuiz() {
          if (this._quizOverride) return this._quizOverride;
          return (await Promise.resolve().then(() => (init_quiz_core(), quiz_core_exports))).quizUI;
        },
        /** 做题家就绪兜底：已初始化但缺 AI → 幂等 ensureQuiz 补建（ensureQuiz 就地写 quizUI.ai，同一单例引用生效） */
        async quizWithAI() {
          const quiz = await this.getQuiz();
          if (quiz && !quiz.ai) {
            try {
              const { ensureQuiz: ensureQuiz2 } = await Promise.resolve().then(() => (init_quiz_core(), quiz_core_exports));
              ensureQuiz2(getApp());
            } catch (e) {
            }
          }
          return quiz;
        },
        ensure(app) {
          if (!this.dataManager) this.dataManager = new ReviewDataManager(app);
        },
        /** ADR-0077：加载拟合参数到 _fittedW（无则 null 回退默认）；ensureReview 启动时调用 */
        async loadFitParams(app) {
          try {
            const fit = await loadFittedParams(app);
            this._fittedW = fit ? mergeFittedW(fit.w) : null;
          } catch (e) {
            this._fittedW = null;
          }
        },
        /**
         * ADR-0077：每 N 次复习自动重拟合（全自动定期重算）。
         * markReview 每次评级后调用（count+1）；达阈值且开关开 → 异步后台跑，完成后轻提示；
         * 样本不足/失败静默回退默认；防重入。
         */
        async maybeRunFit(app) {
          const s = getSettings();
          if (s.reviewEnableFit === false) return;
          const n = Number(s.reviewFitEveryN) || 10;
          this._reviewCountSinceFit++;
          if (this._reviewCountSinceFit < n || this._fitRunning) return;
          this._fitRunning = true;
          this._reviewCountSinceFit = 0;
          try {
            const dm = this.dataManager;
            const items = await dm.loadItems();
            const result = fitFromItems(items);
            if (result) {
              await saveFittedParams(app, {
                w: result.fit.w,
                fitAt: (/* @__PURE__ */ new Date()).toISOString(),
                fitCount: result.count,
                full: result.fit.w.length >= 19
              });
              this._fittedW = mergeFittedW(result.fit.w);
              notice(`已根据 ${result.count} 条复习记录拟合记忆参数`, "success");
            }
          } catch (e) {
            console.warn("复习参数拟合失败，回退默认:", e);
          } finally {
            this._fitRunning = false;
          }
        },
        /** ADR-0077：获取当前生效权重（拟合参数优先，回退默认） */
        currentW() {
          return this._fittedW || DEFAULT_W;
        },
        /** ADR-0077：某条目当前记忆保留度 R（FSRS 相位且已复习过才可算；否则 null） */
        currentR(item) {
          if (item.phase !== "fsrs" || !item.stability || !item.lastReviewed) return null;
          const t = ((/* @__PURE__ */ new Date()).getTime() - new Date(item.lastReviewed).getTime()) / 864e5;
          if (!(t > 0)) return null;
          return new FSRS(this.currentW()).R(t, item.stability);
        },
        /** ADR-0077：逾期队列排序 + 每日上限截断。
         *  R 升序（遗忘风险最高优先，仅可算 R 的条目）→ nextReviewDate 升序。
         *  ticket 174：移除置顶（用户拍板去掉置顶功能）。 */
        sortOverdue(items, dailyLimit = 0) {
          const sorted = [...items].sort((a, b) => {
            const rA = this.currentR(a);
            const rB = this.currentR(b);
            if (rA !== null && rB !== null && rA !== rB) return rA - rB;
            return new Date(a.nextReviewDate).getTime() - new Date(b.nextReviewDate).getTime();
          });
          return dailyLimit > 0 ? sorted.slice(0, dailyLimit) : sorted;
        },
        async markReview(filePath, selectedDifficulty, opts) {
          const app = getApp();
          this.ensure(app);
          const dm = this.dataManager;
          const items = await dm.loadItems();
          const item = items.find((i) => i.filePath === filePath);
          if (!item) {
            notice("条目不存在");
            return;
          }
          if (item.completed) {
            notice("该笔记已完成全部复习");
            return;
          }
          const now = /* @__PURE__ */ new Date();
          const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : /* @__PURE__ */ new Date(0);
          if (now < nextReview) {
            const rThreshold = Number(getSettings().reviewRThreshold) || DEFAULT_R_THRESHOLD;
            if (!isEarlyDue(item, rThreshold, this.currentW())) {
              const diff = nextReview.getTime() - now.getTime();
              const mins = Math.ceil(diff / 6e4);
              notice(`还未到复习时间（${mins}分钟后）`);
              return;
            }
          }
          const rating = selectedDifficulty;
          const decision = scheduleNext(
            {
              stage: item.stage,
              phase: item.phase,
              stability: item.stability,
              difficulty: item.difficulty,
              lastReviewed: item.lastReviewed,
              reviewStart: item.reviewStart
            },
            rating,
            now,
            this.currentW()
          );
          const scaleRaw = Number(getSettings().reviewIntervalScale);
          const scale = decision.phase === "fsrs" && !decision.enteringFsrs && scaleRaw > 0 ? scaleRaw : 1;
          const scaledDays = Math.max(0.01, decision.intervalDays * scale);
          const nextDate = new Date(now.getTime() + scaledDays * 864e5);
          await dm.updateItem(filePath, (it) => {
            it.stage = decision.stage;
            it.phase = decision.phase;
            if (decision.stability !== null) it.stability = decision.stability;
            if (decision.difficulty !== null) it.difficulty = decision.difficulty;
            it.lastReviewed = now.toISOString();
            it.lastDifficulty = rating;
            it.totalReviews = (it.totalReviews || 0) + 1;
            if (!it.reviewHistory) it.reviewHistory = [];
            const entry = { timestamp: now.toISOString(), stage: decision.historyStage, rating };
            if (decision.historyStability !== null) {
              entry.stability = decision.historyStability;
              entry.difficulty = decision.historyDifficulty;
            }
            if (decision.R !== null) entry.R = Math.round(decision.R * 100);
            it.reviewHistory.push(entry);
            it.nextReviewDate = nextDate.toISOString();
            if (decision.enteringFsrs) it.completed = false;
            if (opts == null ? void 0 : opts.autoPending) it.pendingRedo = rating === "again" || rating === "hard";
            else if (rating === "good" || rating === "easy") it.pendingRedo = false;
          });
          if (decision.enteringFsrs) {
            notice(`进入深度复习，${FSRS_FIRST_TEXTS[decision.stage]}后复习`, "success");
          } else if (decision.phase === "ladder") {
            notice(`${FSRS_FIRST_TEXTS[decision.stage]}后复习`, "success");
          } else {
            const days = Math.round(scaledDays);
            const rPct = Math.round((decision.R || 0) * 100);
            notice(`R=${rPct}%，下次复习：${days > 0 ? days + "天" : "1天"}后`, "success");
          }
          void this.maybeRunFit(getApp());
          emitDomainEvent("review", { kind: "rated", title: item.name || filePath, rating });
        },
        /** 跳转逾期（bz-review-start/overdue 命令入口）：完整复习流程 = startRoundSprint */
        async autoJumpOverdue() {
          await this.startRoundSprint();
        },
        /** 待重做条目（文件存在、未完成；按进入顺序 = lastReviewed 升序 FIFO） */
        pendingRedoItems(items) {
          return items.filter((i) => i.pendingRedo && !i.isCompleted && i.file).sort(
            (a, b) => new Date(a.lastReviewed || a.reviewStart).getTime() - new Date(b.lastReviewed || b.reviewStart).getTime()
          );
        },
        /** 重做出题（ADR-0044/Q7-②）：清空旧题 → ensureQuestions 全新生成；失败或空题回退剩余错题 */
        async regenerateQuestions(filePath) {
          const quiz = await this.getQuiz();
          if (!quiz || !quiz.ai) return [];
          const leftover = await quiz.manager.getQuestionsForNote(getApp(), filePath) || [];
          await quiz.manager.saveQuestionsForNote(getApp(), filePath, []);
          await quiz.ensureQuestions([filePath]);
          const fresh = await quiz.manager.getQuestionsForNote(getApp(), filePath) || [];
          const picked = fresh.length ? fresh : leftover;
          return picked.map((q, i) => ({ ...q, notePath: filePath, _index: i }));
        },
        /** 批量生成题目（返回 {filePath: questions[]} 映射）：先清空存量题再 ensureQuestions 全新生成 */
        async batchGenerateQuestions(items) {
          const quiz = await this.getQuiz();
          if (!quiz || !quiz.ai) {
            console.warn("做题家未初始化（缺少 AI）");
            notify("做题家未初始化（缺少 AI），已改用普通复习", { type: "warning", dedupeKey: "review-quiz-ai" });
            return {};
          }
          for (const item of items) {
            await quiz.manager.saveQuestionsForNote(getApp(), item.filePath, []);
          }
          await quiz.ensureQuestions(items.map((i) => i.filePath));
          const out = {};
          for (const item of items) {
            const qs = await quiz.manager.getQuestionsForNote(getApp(), item.filePath);
            if (qs && qs.length) {
              out[item.filePath] = qs.map((q, i) => ({
                ...q,
                notePath: item.filePath,
                _index: i
              }));
            }
          }
          return out;
        },
        /** 单条做题冲刺（点队列到期卡片）：该篇直接进入做题会话 */
        async startSingleSprint(item) {
          const app = getApp();
          this.ensure(app);
          emitDomainEvent("review", { kind: "started" });
          const quiz = await this.quizWithAI();
          if (!quiz || !quiz.ai) {
            notify("做题家未初始化，改用普通复习", { type: "warning", dedupeKey: "review-quiz-ai" });
            await this.reviewLoop([item], 0);
            return;
          }
          await this.runSprintSession([item], "single");
        },
        /** 开始本轮（队列视图「开始本轮」）：待重做优先 → 逾期队列 → 做题/普通分流 */
        async startRoundSprint() {
          const app = getApp();
          this.ensure(app);
          emitDomainEvent("review", { kind: "started" });
          let items = await this.dataManager.loadItems();
          const pend = this.pendingRedoItems(items);
          if (pend.length && getSettings().forceQuizForReview) {
            const quiz2 = await this.quizWithAI();
            if (quiz2 && quiz2.ai) {
              await this.runSprintSession(pend, "redo");
              const fresh = await this.dataManager.loadItems();
              const passedSet = new Set(
                fresh.filter((i) => pend.some((p) => p.filePath === i.filePath) && !i.pendingRedo).map((i) => i.filePath)
              );
              if (passedSet.size) items = fresh.filter((i) => !passedSet.has(i.filePath));
              else items = fresh;
            } else {
              notify("做题家未初始化，跳过待重做队列", { type: "warning", dedupeKey: "review-quiz-ai" });
            }
          }
          const rThreshold = Number(getSettings().reviewRThreshold) || DEFAULT_R_THRESHOLD;
          const round = roundQueue(items, rThreshold, this.currentW());
          if (!round.length) {
            notice("没有逾期笔记", "success");
            return;
          }
          const earlyToday = round.filter((i) => !i.isOverdue && !isEarlyDue(i, rThreshold, this.currentW()));
          if (earlyToday.length) {
            notice(`今日到期 ${earlyToday.length} 篇已提前纳入本轮`, "info");
          }
          const dailyLimit = Number(getSettings().reviewDailyLimit) || 0;
          const limited = this.sortOverdue(round, dailyLimit);
          if (limited.length < round.length) {
            notice(`本轮复习 ${limited.length} 篇，剩余 ${round.length - limited.length} 篇留到下次`, "info");
          }
          if (!getSettings().forceQuizForReview) {
            await this.reviewLoop(limited, 0);
            return;
          }
          let quiz = null;
          try {
            quiz = await this.quizWithAI();
          } catch (e) {
          }
          if (!quiz || !quiz.ai) {
            notify("做题家未初始化，已改用普通复习", { type: "warning", dedupeKey: "review-quiz-ai" });
            await this.reviewLoop(limited, 0);
            return;
          }
          await this.runSprintSession(limited, "round");
        },
        /** 当前逾期条目（item 6：改用 roundQueue 同口径——逾期 ∪ R 阈值提前 ∪ 今日到期） */
        dueItems(items) {
          const rThreshold = Number(getSettings().reviewRThreshold) || DEFAULT_R_THRESHOLD;
          return roundQueue(items, rThreshold, this.currentW());
        },
        /**
         * 统一冲刺会话驱动：把队列交给 UI 层 SprintSession 渲染，本层只提供
         * 取题/评级写盘回调。会话结束（done/quit/fail）后刷新列表与染色。
         *  - round/single：通过 → markReview autoPending；未通过 → markReview autoPending + 开笔记
         *  - redo：通过 → 仅清 pendingRedo（ADR-0044 不写 FSRS）；未通过 → 开笔记（保持待重做）
         */
        async runSprintSession(items, mode) {
          const app = getApp();
          const { uiManager: uiManager2 } = await Promise.resolve().then(() => (init_review(), review_exports));
          if (!uiManager2) return;
          let streakDays = 0;
          try {
            streakDays = computeStats(await this.dataManager.loadItems()).streak;
          } catch (e) {
          }
          const quiz = await this.getQuiz();
          let batchStarted = false;
          let batchMap = null;
          const ensureBatch = async () => {
            if (batchStarted) return;
            batchStarted = true;
            try {
              batchMap = await this.batchGenerateQuestions(items);
            } catch (e) {
              batchMap = {};
            }
          };
          await uiManager2.startSprint({
            queue: items,
            mode,
            quiz,
            streakDays,
            fetchQuestions: async (item) => {
              var _a;
              const qs = await ((_a = quiz == null ? void 0 : quiz.manager) == null ? void 0 : _a.getQuestionsForNote(app, item.filePath));
              if (qs && qs.length) {
                return qs.map((q, i) => ({ ...q, notePath: item.filePath, _index: i }));
              }
              if (!(quiz == null ? void 0 : quiz.ai)) return null;
              if (mode === "round") {
                await ensureBatch();
                const mapped = batchMap == null ? void 0 : batchMap[item.filePath];
                if (mapped && mapped.length) {
                  return mapped;
                }
                return null;
              }
              const fresh = await this.regenerateQuestions(item.filePath);
              return fresh.length ? fresh : null;
            },
            onPassed: async (item, rating, entry) => {
              if (mode === "redo") {
                await this.dataManager.updateItem(item.filePath, (it) => {
                  it.pendingRedo = false;
                });
                return void 0;
              }
              await this.markReview(item.filePath, rating, { autoPending: true });
              await this.applyReviewStyles(app);
              const fresh = await this.dataManager.loadItems();
              const updated = fresh.find((i) => i.filePath === item.filePath);
              return (updated == null ? void 0 : updated.nextReviewDate) || void 0;
            },
            onFailed: async (item, rating, entry) => {
              if (mode !== "redo") {
                await this.markReview(item.filePath, rating, { autoPending: true });
                await this.applyReviewStyles(app);
              }
              const file = app.vault.getAbstractFileByPath(item.filePath);
              if (file) {
                const leaf = app.workspace.getLeaf(false);
                await leaf.openFile(file);
              }
            }
          });
          await this.refreshPanel();
          await this.applyReviewStyles(app);
        },
        /** 顺序复习循环（源码 L686-709 逐字；item 4 悬浮评级条 + item 5 离篇宽限/断点可恢复）
         *  - 屏幕底部挂迷你评级条（忘了/困难/一般/简单 + 跳过）：点评级写盘 → 轮询检测翻篇；跳过不评级直接下一篇
         *  - 离篇持续 REVIEW_AWAY_GRACE_MS 才判中断（宽限期内回篇继续）；中断/超时保留 _pendingRound，
         *    通知挂「继续本轮」action 断点续跑 */
        async reviewLoop(overdueNotes, index) {
          const app = getApp();
          this.ensure(app);
          const dm = this.dataManager;
          if (index >= overdueNotes.length) {
            this._pendingRound = null;
            this.hideReviewBar();
            if (this._reviewNotice) {
              this._reviewNotice.setType("success");
              this._reviewNotice.setMessage("所有逾期笔记已复习完成");
              this._reviewNotice = null;
            } else {
              notice("所有逾期笔记已复习完成", "success");
            }
            return;
          }
          const item = overdueNotes[index];
          const file = app.vault.getAbstractFileByPath(item.filePath);
          if (!file) {
            await dm.removeItem(item.filePath);
            await this.reviewLoop(overdueNotes, index + 1);
            return;
          }
          this._pendingRound = { items: overdueNotes, index };
          const leaf = app.workspace.getLeaf(false);
          await leaf.openFile(file);
          const reviewMsg = `复习中 (${index + 1}/${overdueNotes.length}): ${item.name}`;
          if (this._reviewNotice) {
            this._reviewNotice.setMessage(reviewMsg);
          } else {
            this._reviewNotice = notify(reviewMsg, { type: "progress", dedupeKey: "review-loop" });
          }
          this.hideReviewBar();
          void (async () => {
            try {
              const { mountFloatingRatingBar: mountFloatingRatingBar2 } = await Promise.resolve().then(() => (init_ui2(), ui_exports2));
              this._reviewBar = mountFloatingRatingBar2({
                name: item.name,
                index: index + 1,
                total: overdueNotes.length,
                onRate: (rating) => {
                  void this.markReview(item.filePath, rating);
                },
                onSkip: () => {
                  void advance();
                }
              });
            } catch (e) {
            }
          })();
          let checkCount = 0;
          const maxChecks = 300;
          let advanced = false;
          let awaySince = null;
          const advance = async () => {
            if (advanced) return;
            advanced = true;
            this.hideReviewBar();
            clearLoop();
            await this.reviewLoop(overdueNotes, index + 1);
          };
          const interval = setInterval(async () => {
            checkCount++;
            const activeFile = app.workspace.getActiveFile();
            if (!activeFile || activeFile.path !== item.filePath) {
              const nowMs = Date.now();
              if (awaySince === null) awaySince = nowMs;
              if (nowMs - awaySince < REVIEW_AWAY_GRACE_MS) return;
              advanced = true;
              this.hideReviewBar();
              clearLoop();
              if (this._reviewNotice) {
                this._reviewNotice.setMessage("已离开当前笔记，本轮复习中断");
                this._reviewNotice.setType("warning");
                this._reviewNotice = null;
              }
              notify("已离开当前笔记，本轮复习中断", {
                type: "warning",
                dedupeKey: "review-loop-interrupted",
                action: { label: "继续本轮", onClick: () => void reviewApp.resumeRound() }
              });
              return;
            }
            awaySince = null;
            const updatedItems = await dm.loadItems();
            const updated = updatedItems.find((i) => i.filePath === item.filePath);
            if (updated && updated.lastReviewed) {
              const last = new Date(updated.lastReviewed);
              if (Date.now() - last.getTime() < 3e4) {
                await advance();
                return;
              }
            }
            if (checkCount >= maxChecks) {
              advanced = true;
              this.hideReviewBar();
              clearLoop();
              if (this._reviewNotice) {
                this._reviewNotice.setMessage("复习超时，请手动继续");
                this._reviewNotice.setType("warning");
                this._reviewNotice = null;
              } else {
                notice("复习超时，请手动继续", "warning");
              }
              notify("复习超时，可从断点继续本轮", {
                type: "info",
                dedupeKey: "review-loop-timeout",
                action: { label: "继续本轮", onClick: () => void reviewApp.resumeRound() }
              });
            }
          }, 1e3);
          this._reviewLoops.add(interval);
          const clearLoop = () => {
            clearInterval(interval);
            this._reviewLoops.delete(interval);
          };
        },
        /** item 5：从断点恢复本轮（中断/超时后「继续本轮」入口；无断点给明确反馈） */
        resumeRound() {
          const r = this._pendingRound;
          if (!r) {
            notice("没有进行中的本轮复习");
            return;
          }
          void this.reviewLoop(r.items, r.index);
        },
        /** 加入当前笔记到复习计划 */
        async addCurrentToReview(file) {
          this.ensure(getApp());
          const dm = this.dataManager;
          const items = await dm.loadItems();
          if (items.some((i) => i.filePath === file.path)) throw new Error("该笔记已在复习计划中");
          await dm.addItem(file.path, file.basename);
          notice("已加入复习计划，首次复习：1分钟后", "success");
          emitDomainEvent("review", { kind: "added", title: file.basename });
        },
        /** 文件树染色 + 阶段徽标（源码 L719-772 逐字；ticket 100 加「文件树标记」开关；
         *   ticket 48 收敛：不再全库 getMarkdownFiles + 逐路径 querySelector——
         *   处理范围 = 复习条目路径 + 曾染色路径（移出计划后回退），树节点一次 querySelectorAll 建 Map 查找；
         *   可选 items 参数：checkOverdueAndNotify 传本轮已加载结果，避免每轮二次读盘。 */
        async applyReviewStyles(app, changedFile, items) {
          if (getSettings().reviewTreeBadge === false) return;
          this.ensure(app);
          const allItems = items || await this.dataManager.loadItems();
          const itemByPath = /* @__PURE__ */ new Map();
          for (const item of allItems) {
            if (item.filePath) itemByPath.set(item.filePath, item);
          }
          const paths = /* @__PURE__ */ new Set();
          if (changedFile) {
            paths.add(changedFile.path);
          } else {
            for (const p of itemByPath.keys()) paths.add(p);
            for (const p of this._styledPaths) paths.add(p);
          }
          const els = /* @__PURE__ */ new Map();
          for (const el of Array.from(document.querySelectorAll("div[data-path]"))) {
            const p = el.getAttribute("data-path");
            if (p && !els.has(p)) els.set(p, el);
          }
          const fsrs = new FSRS(this.currentW());
          for (const path of paths) {
            const el = els.get(path);
            if (!el) {
              this._styledPaths.delete(path);
              continue;
            }
            const target = el.querySelector("div.tree-item-inner");
            if (!target) continue;
            const badge = target.querySelector(".review-stage-badge");
            if (badge) badge.remove();
            const item = itemByPath.get(path);
            if (!item) {
              if (this._styledPaths.has(path)) {
                target.style.color = "";
                this._styledPaths.delete(path);
              }
              continue;
            }
            const currentStage = item.stage || 0;
            const now = /* @__PURE__ */ new Date();
            const nextReview = item.nextReviewDate ? new Date(item.nextReviewDate) : null;
            let color = "currentColor";
            let status = "";
            if (item.completed) {
              color = "#52c41a";
              status = "complete";
            } else if (nextReview && now > nextReview) {
              color = "#ff4757";
              status = "overdue";
            } else if (item.phase === "fsrs" && item.stability && item.lastReviewed) {
              const t = (now.getTime() - new Date(item.lastReviewed).getTime()) / 864e5;
              const r = fsrs.R(t, item.stability);
              if (r >= 0.9) color = "#52c41a";
              else if (r >= 0.7) color = "#faad14";
              else color = "#ff9f43";
            } else if (currentStage <= 2) {
              color = "#1890ff";
            } else if (currentStage <= 6) {
              color = "#faad14";
            } else {
              color = "#52c41a";
            }
            target.style.color = color;
            let timeText = "";
            let badgeIcon = null;
            if (status === "complete") badgeIcon = "check";
            else if (nextReview) {
              const diff = nextReview.getTime() - now.getTime();
              if (diff > 0) {
                const d = Math.floor(diff / (1e3 * 60 * 60 * 24));
                const h = Math.floor(diff % (1e3 * 60 * 60 * 24) / (1e3 * 60 * 60));
                const m = Math.floor(diff % (1e3 * 60 * 60) / (1e3 * 60));
                if (d > 0) timeText = `${d}d`;
                else if (h > 0) timeText = `${h}h`;
                else timeText = `${m}m`;
              } else badgeIcon = "calendar";
            }
            if (badgeIcon || timeText) {
              const badgeEl = document.createElement("span");
              badgeEl.className = "review-stage-badge";
              if (badgeIcon) {
                const { uiIcon: uiIcon2 } = await Promise.resolve().then(() => (init_ui(), ui_exports));
                badgeEl.appendChild(uiIcon2(badgeIcon));
              } else {
                badgeEl.textContent = timeText;
              }
              badgeEl.style.cssText = `font-size:0.7em;opacity:0.8;margin-left:6px;color:${color};background:color-mix(in srgb, ${color} 10%, transparent);padding:1px 4px;border-radius:3px;border:1px solid color-mix(in srgb, ${color} 30%, transparent);font-weight:500;`;
              target.appendChild(badgeEl);
            }
            this._styledPaths.add(path);
          }
        },
        /**
         * 到期提醒 + 染色刷新（ticket 100：原只刷染色，重写为 diff + 通知；染色职责保留）
         * 每轮与已通知集合对比：新增逾期 → 弹篇数常驻通知（duration 0，逾期清零主动收起；不列题目）；
         * 移出逾期（评级/完成/挂起）从集合剔除 → 之后再次逾期重新提醒。
         * 启动首查把存量逾期当新产生 → 汇总篇数（Q1 拍板接受）。
         * ticket 48 收敛：与本轮 loadItems 共用结果，不再二次读盘；
         * ticket 58：通知挂「去复习」action → 打开最早逾期笔记；
         * ticket 153：「去复习」升级为走 autoJumpOverdue 完整流程（做题决定难度分流）。
         */
        async checkOverdueAndNotify() {
          var _a;
          try {
            this.ensure(getApp());
            const dm = this.dataManager;
            const items = await dm.loadItems();
            await this.applyReviewStyles(getApp(), void 0, items);
            if (getSettings().enableAutoNotify === false) return;
            const overdueMap = new Map(
              items.filter((i) => i.isOverdue && !i.completed && !i.isMissing).map((i) => [i.filePath, i])
            );
            const newly = [...overdueMap.entries()].filter(([p]) => !this._notifiedOverdue.has(p));
            for (const p of this._notifiedOverdue) {
              if (!overdueMap.has(p)) this._notifiedOverdue.delete(p);
            }
            if (newly.length) {
              for (const [p] of newly) this._notifiedOverdue.add(p);
              const handle = notify(`有 ${overdueMap.size} 篇笔记逾期`, {
                type: "info",
                duration: 0,
                // 常驻不自动消失，靠点击「去复习」/本体收起
                dedupeKey: "review-overdue-notice",
                action: {
                  label: "去复习",
                  // action 文案不带 emoji（通知规范）
                  onClick: () => {
                    void reviewApp.autoJumpOverdue();
                  }
                }
              });
              const cur = this._overdueNotice;
              if (!cur || !cur.el.isConnected) this._overdueNotice = handle;
            } else if (!overdueMap.size) {
              (_a = this._overdueNotice) == null ? void 0 : _a.hide();
              this._overdueNotice = null;
            }
          } catch (e) {
            console.error("复习计划检查出错:", e);
          }
        },
        /** 刷新面板（源码 refreshPanel） */
        async refreshPanel() {
          const { uiManager: uiManager2 } = await Promise.resolve().then(() => (init_review(), review_exports));
          if (!uiManager2) return;
          const items = await this.dataManager.loadItems();
          uiManager2.renderEntries(items);
        }
      };
    }
  });

  // src/review/watch.ts
  var watch_exports = {};
  __export(watch_exports, {
    RENAME_MERGE_MS: () => RENAME_MERGE_MS,
    REVIEW_AUTO_ADD_MERGE_MS: () => REVIEW_AUTO_ADD_MERGE_MS,
    ReviewWatcher: () => ReviewWatcher,
    __setAutoAddMergeMsForTests: () => __setAutoAddMergeMsForTests,
    __setRenameMergeMsForTests: () => __setRenameMergeMsForTests,
    isUnderFolder: () => isUnderFolder2
  });
  function isUnderFolder2(folder, path) {
    return isUnderFolder(folder, path);
  }
  function __setAutoAddMergeMsForTests(ms) {
    REVIEW_AUTO_ADD_MERGE_MS = ms;
  }
  function __setRenameMergeMsForTests(ms) {
    RENAME_MERGE_MS = ms;
  }
  var REVIEW_AUTO_ADD_MERGE_MS, RENAME_MERGE_MS, ReviewWatcher;
  var init_watch = __esm({
    "src/review/watch.ts"() {
      init_utils();
      init_notice();
      init_flow_dialog();
      init_settings_provider();
      REVIEW_AUTO_ADD_MERGE_MS = 3e3;
      RENAME_MERGE_MS = 3e3;
      ReviewWatcher = class {
        constructor(app, dataManager2) {
          /** 删除确认防抖缓冲（多文件删除合并为一次确认） */
          this.deleteQueue = [];
          this.deleteTimer = null;
          /** ticket 100：新笔记自动加入提醒合并缓冲（3 秒窗口收集，多条合并一条通知） */
          this.autoAddQueue = [];
          this.autoAddTimer = null;
          /** ticket n2：改名通知合并缓冲（3 秒窗口收集；列表/文件树更新仍即时） */
          this.renameQueue = [];
          this.renameTimer = null;
          this.app = app;
          this.dataManager = dataManager2;
        }
        get watchedFolders() {
          const s = tryGetSettings();
          return Array.isArray(s == null ? void 0 : s.reviewWatchedFolders) ? s.reviewWatchedFolders.filter((x) => typeof x === "string" && x.trim().length > 0) : [];
        }
        get excludedNotes() {
          const s = tryGetSettings();
          return Array.isArray(s == null ? void 0 : s.reviewExcludedNotes) ? s.reviewExcludedNotes : [];
        }
        isWatched(path) {
          return this.watchedFolders.some((f) => isUnderFolder2(f, path));
        }
        isExcluded(path) {
          return this.excludedNotes.includes(path);
        }
        /** 追加排除名单（去重 + 落盘；手动/确认四类表态共用） */
        async excludePaths(paths) {
          const s = tryGetSettings();
          const cur = Array.isArray(s == null ? void 0 : s.reviewExcludedNotes) ? [...s.reviewExcludedNotes] : [];
          let changed = false;
          for (const p of paths) {
            if (p && !cur.includes(p)) {
              cur.push(p);
              changed = true;
            }
          }
          if (!changed) return;
          if (s) s.reviewExcludedNotes = cur;
          await saveSettings();
        }
        /** ticket 57：单条解除排除记录（数据 reviewExcludedNotes 既有；仅补 UI 管理入口） */
        async removeExcludedNote(path) {
          const s = tryGetSettings();
          if (!s) return;
          const cur = Array.isArray(s.reviewExcludedNotes) ? [...s.reviewExcludedNotes] : [];
          const kept = cur.filter((p) => p !== path);
          if (kept.length === cur.length) return;
          s.reviewExcludedNotes = kept;
          await saveSettings();
        }
        /** vault create：监听目录内新建 md → 自动加入（未排除、未在计划）；ticket 100：3 秒窗口合并提醒 + 开关 */
        async onVaultCreate(file) {
          if (file.extension !== "md") return;
          if (!this.isWatched(file.path)) return;
          if (this.isExcluded(file.path)) return;
          const items = await this.dataManager.loadItems();
          if (items.some((i) => i.filePath === file.path)) return;
          await this.dataManager.addItem(file.path, file.basename);
          const s = tryGetSettings();
          if (s && s.reviewAutoAddNotice === false) return;
          this.autoAddQueue.push(file.basename);
          if (this.autoAddTimer) return;
          this.autoAddTimer = setTimeout(() => {
            this.autoAddTimer = null;
            const batch = this.autoAddQueue;
            this.autoAddQueue = [];
            if (!batch.length) return;
            const shown = batch.slice(0, 3).join("、");
            const tail = batch.length > 3 ? ` 等 ${batch.length - 3} 篇` : "";
            notice(batch.length > 1 ? `已自动加入复习计划：${shown}${tail}` : `已自动加入复习计划：${shown}`, "success");
          }, REVIEW_AUTO_ADD_MERGE_MS);
        }
        /** vault delete：计划内文件删除 → 防抖合并确认「同步移除复习记录？」 */
        onVaultDelete(file) {
          void (async () => {
            const items = await this.dataManager.loadItems();
            if (!items.some((i) => i.filePath === file.path)) return;
            this.deleteQueue.push(file.path);
            if (this.deleteTimer) return;
            this.deleteTimer = setTimeout(async () => {
              this.deleteTimer = null;
              const batch = this.deleteQueue;
              this.deleteQueue = [];
              if (!batch.length) return;
              const n = batch.length;
              const firstName = (batch[0] || "").split("/").pop();
              void openFlowDialog({
                title: n > 1 ? `删除 ${n} 篇笔记` : "笔记已删除",
                message: n > 1 ? `有 ${n} 篇笔记已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。` : `「${firstName}」已从 vault 删除，是否同步移除复习计划里的记录？不移除则保留（文件恢复后继续复习，列表现删除线）。`,
                actions: [
                  { label: "保留", value: "cancel" },
                  { label: "移除", value: "ok", cta: true }
                ]
              }).then(async (v) => {
                if (v === "ok") {
                  for (const path of batch) await this.dataManager.removeItem(path);
                  await this.excludePaths(batch.filter((p) => this.isWatched(p)));
                  notice(`已移除 ${n} 条复习记录`, "success");
                  await this.refresh();
                } else {
                  void this.refresh();
                }
              });
            }, 300);
          })();
        }
        /** vault rename：计划内文件改名/移动 → 自动更新路径（ticket 099：不再弹确认）；
         *   ticket n2：通知改合并窗口（窗口内多条合并一条；列表/文件树刷新仍即时） */
        onVaultRename(file, oldPath) {
          void (async () => {
            if (file.extension !== "md") return;
            if (oldPath === file.path) return;
            const items = await this.dataManager.loadItems();
            if (!items.some((i) => i.filePath === oldPath)) return;
            const updated = await this.dataManager.updateFilePath(oldPath, file.path, file.basename);
            if (!updated) return;
            await this.refresh();
            this.renameQueue.push(file.basename);
            if (this.renameTimer) return;
            this.renameTimer = setTimeout(() => {
              this.renameTimer = null;
              const batch = this.renameQueue;
              this.renameQueue = [];
              if (!batch.length) return;
              const shown = batch.slice(0, 3).join("、");
              const tail = batch.length > 3 ? `，等 ${batch.length - 3} 篇` : "";
              notice(
                batch.length > 1 ? `已更新 ${batch.length} 篇笔记的复习路径：${shown}${tail}` : "已更新复习计划路径",
                "success"
              );
            }, RENAME_MERGE_MS);
          })();
        }
        /** 未加入候选：目录内全部 md − 已加入 − 已排除（递归；挂起记录占位路径天然排除） */
        collectAutoaddCandidates(folder, items) {
          return this.app.vault.getMarkdownFiles().map((f) => f.path).filter((p) => isUnderFolder2(folder, p)).filter((p) => !items.some((i) => i.filePath === p)).filter((p) => !this.isExcluded(p));
        }
        /** 选择监听文件夹后的存量收编确认（ticket 099）：确认 → 批量全部加入并返回 true；取消 → 什么都不做返回 false（不写排除名单） */
        async confirmBatchAddForFolder(folder) {
          const items = await this.dataManager.loadItems();
          const candidates = this.collectAutoaddCandidates(folder, items);
          if (!candidates.length) return true;
          const v = await openFlowDialog({
            title: "批量加入复习计划",
            message: `监听文件夹「${folder}」下有 ${candidates.length} 篇笔记未加入复习计划，是否一并加入？`,
            actions: [
              { label: "取消", value: "cancel" },
              { label: "加入", value: "ok", cta: true }
            ]
          });
          if (v !== "ok") return false;
          let ok = 0;
          for (const p of candidates) {
            try {
              await this.dataManager.addItem(p, stripMdExt(p.split("/").pop()));
              ok++;
            } catch (e) {
            }
          }
          notice(`已加入 ${ok} 篇笔记到复习计划`, "success");
          await this.refresh();
          return true;
        }
        /** 移除监听文件夹（ticket 099 追加）：同时清空该目录下全部排除记录——否则二次添加时存量被旧黑名单挡住。
         *  返回清理的排除条数（仅用于提示文案）。 */
        async removeWatchedFolder(folder) {
          const s = tryGetSettings();
          if (!s) return 0;
          const folders = Array.isArray(s.reviewWatchedFolders) ? [...s.reviewWatchedFolders] : [];
          const idx = folders.indexOf(folder);
          if (idx !== -1) folders.splice(idx, 1);
          s.reviewWatchedFolders = folders;
          const before = Array.isArray(s.reviewExcludedNotes) ? [...s.reviewExcludedNotes] : [];
          const kept = before.filter((p) => !isUnderFolder2(folder, p));
          s.reviewExcludedNotes = kept;
          await saveSettings();
          return before.length - kept.length;
        }
        async refresh() {
          const { uiManager: uiManager2 } = await Promise.resolve().then(() => (init_review(), review_exports));
          await (uiManager2 == null ? void 0 : uiManager2.refreshPanel());
          const { reviewApp: reviewApp2 } = await Promise.resolve().then(() => (init_app2(), app_exports));
          await reviewApp2.applyReviewStyles(this.app);
        }
        /** 卸载清理（定时器/缓冲） */
        destroy() {
          if (this.deleteTimer) {
            clearTimeout(this.deleteTimer);
            this.deleteTimer = null;
          }
          this.deleteQueue = [];
          if (this.autoAddTimer) {
            clearTimeout(this.autoAddTimer);
            this.autoAddTimer = null;
          }
          this.autoAddQueue = [];
          if (this.renameTimer) {
            clearTimeout(this.renameTimer);
            this.renameTimer = null;
          }
          this.renameQueue = [];
        }
      };
    }
  });

  // src/review/index.ts
  var review_exports = {};
  __export(review_exports, {
    dataManager: () => dataManager,
    ensureReview: () => ensureReview,
    openReviewPanel: () => openReviewPanel,
    openReviewReport: () => openReviewReport,
    reviewAddCurrent: () => reviewAddCurrent,
    reviewJumpOverdue: () => reviewJumpOverdue,
    reviewMarkDialog: () => reviewMarkDialog,
    reviewMarkRating: () => reviewMarkRating,
    reviewRemoveCurrent: () => reviewRemoveCurrent,
    reviewStart: () => reviewStart,
    reviewWatcher: () => reviewWatcher,
    uiManager: () => uiManager,
    unloadReview: () => unloadReview
  });
  function listen(source, event, cb) {
    const ref = source.on(event, cb);
    if (!ref) return;
    unsubscribers.push(() => {
      var _a;
      return (_a = source.offref) == null ? void 0 : _a.call(source, ref);
    });
  }
  function listenBus(channel, cb) {
    unsubscribers.push(onDomainEvent(channel, cb));
  }
  function pseudoMdFile(path) {
    const base = path.split("/").pop() || "";
    return { path, basename: stripMdExt(base), extension: "md" };
  }
  function ensureReview(app) {
    if (initialized2) return;
    initialized2 = true;
    reviewApp.ensure(app);
    dataManager = new ReviewDataManager(app);
    uiManager = new UIManager(app, dataManager);
    uiManager.wSource = () => reviewApp.currentW();
    reviewWatcher = new ReviewWatcher(app, dataManager);
    void reviewApp.loadFitParams(app).catch(() => {
    });
    firstCheckTimer = setTimeout(() => {
      firstCheckTimer = null;
      reviewApp.checkOverdueAndNotify();
      checkInterval = setInterval(() => reviewApp.checkOverdueAndNotify(), 6e4);
    }, 2e3);
    listen(app.metadataCache, "resolved", async () => {
      await reviewApp.applyReviewStyles(app);
    });
    listen(app.vault, "modify", async (file) => {
      if (file.extension === "md") await reviewApp.applyReviewStyles(app, file);
    });
    listenBus("vault:md-created", (evt) => {
      void (reviewWatcher == null ? void 0 : reviewWatcher.onVaultCreate(pseudoMdFile(evt.path)));
    });
    listenBus("vault:md-deleted", (evt) => {
      reviewWatcher == null ? void 0 : reviewWatcher.onVaultDelete(pseudoMdFile(evt.path));
    });
    listenBus("vault:md-renamed", (evt) => {
      const file = pseudoMdFile(evt.newPath);
      file.oldPath = evt.oldPath;
      reviewWatcher == null ? void 0 : reviewWatcher.onVaultRename(file, evt.oldPath);
    });
    listen(app.workspace, "quit", () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
    });
  }
  function openReviewPanel(app) {
    ensureReview(app);
    uiManager == null ? void 0 : uiManager.showMain();
  }
  async function openReviewReport(app) {
    ensureReview(app);
    const { showStatsModal: showStatsModal2 } = await Promise.resolve().then(() => (init_stats_ui(), stats_ui_exports));
    await showStatsModal2(app, dataManager);
  }
  async function reviewAddCurrent(app) {
    ensureReview(app);
    const file = app.workspace.getActiveFile();
    if (!file) {
      notice("请先打开一个笔记");
      return;
    }
    try {
      await reviewApp.addCurrentToReview(file);
      await uiManager.refreshPanel();
      await reviewApp.applyReviewStyles(app);
    } catch (e) {
      notice("加入复习计划失败：" + e.message + "，请重试", "error");
    }
  }
  async function reviewRemoveCurrent(app) {
    ensureReview(app);
    const file = app.workspace.getActiveFile();
    if (!file) {
      notice("请先打开一个笔记");
      return;
    }
    const items = await dataManager.loadItems();
    const target = items.find((i) => i.filePath === file.path);
    if (!target) {
      notice("该笔记不在复习计划中");
      return;
    }
    void openFlowDialog({
      title: "移出复习计划",
      message: `确定把「${file.basename}」移出复习计划吗？所有复习数据将被删除，移出后可在通知中撤销。`,
      actions: [
        { label: "取消", value: "cancel" },
        { label: "移出", value: "ok", cta: true }
      ]
    }).then(async (v) => {
      if (v !== "ok") return;
      await dataManager.removeItem(file.path);
      emitDomainEvent("review", { kind: "removed", title: file.basename });
      notifyUndo(`已移出「${file.basename}」`, () => {
        void (async () => {
          try {
            await dataManager.restoreItem(target);
            await uiManager.refreshPanel();
          } catch (e) {
            notifySaveError(e, "恢复复习条目");
          }
        })();
      });
      await uiManager.refreshPanel();
      await reviewApp.applyReviewStyles(app);
    });
  }
  async function reviewJumpOverdue(app) {
    ensureReview(app);
    await reviewApp.autoJumpOverdue();
  }
  async function reviewStart(app) {
    ensureReview(app);
    await reviewApp.autoJumpOverdue();
  }
  async function reviewMarkDialog(app) {
    ensureReview(app);
    const file = app.workspace.getActiveFile();
    if (!file) {
      notice("请先打开一个笔记");
      return;
    }
    const items = await dataManager.loadItems();
    const item = items.find((i) => i.filePath === file.path);
    if (!item) {
      notice("该笔记不在复习计划中");
      return;
    }
    if (item.completed) {
      notice("该笔记已完成全部复习");
      return;
    }
    uiManager == null ? void 0 : uiManager.showDifficultyDialog(item, async (diff) => {
      await reviewApp.markReview(file.path, diff);
      await reviewApp.applyReviewStyles(app);
    });
  }
  async function reviewMarkRating(app, rating) {
    ensureReview(app);
    const file = app.workspace.getActiveFile();
    if (!file) {
      notice("请先打开一个笔记");
      return;
    }
    const items = await dataManager.loadItems();
    const item = items.find((i) => i.filePath === file.path);
    if (!item) {
      notice("该笔记不在复习计划中");
      return;
    }
    if (item.completed) {
      notice("该笔记已完成全部复习");
      return;
    }
    await reviewApp.markReview(file.path, rating);
    await reviewApp.applyReviewStyles(app);
  }
  function unloadReview() {
    initialized2 = false;
    if (firstCheckTimer) {
      clearTimeout(firstCheckTimer);
      firstCheckTimer = null;
    }
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    reviewApp.stopReviewLoops();
    reviewApp.dataManager = null;
    for (const off of unsubscribers) {
      try {
        off();
      } catch (e) {
      }
    }
    unsubscribers = [];
    uiManager == null ? void 0 : uiManager.destroy();
    uiManager = null;
    dataManager = null;
    reviewWatcher == null ? void 0 : reviewWatcher.destroy();
    reviewWatcher = null;
  }
  var initialized2, dataManager, uiManager, reviewWatcher, checkInterval, firstCheckTimer, unsubscribers;
  var init_review = __esm({
    "src/review/index.ts"() {
      init_utils();
      init_notice();
      init_flow_dialog();
      init_domain_bus();
      init_data();
      init_watch();
      init_ui2();
      init_app2();
      initialized2 = false;
      dataManager = null;
      uiManager = null;
      reviewWatcher = null;
      checkInterval = null;
      firstCheckTimer = null;
      unsubscribers = [];
    }
  });

  // prototypes/review/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootReviewSim: () => bootReviewSim,
    ensureReview: () => ensureReview,
    openReviewPanel: () => openReviewPanel2,
    unloadReview: () => unloadReview
  });
  init_fake_obsidian();
  init_app();
  init_settings_provider();
  init_review();
  var REVIEW_KEY = "bz-sim:CONFIG/STORAGE/review.json";
  var QUIZ_KEY = "bz-sim:CONFIG/STORAGE/quiz.json";
  function readStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      return null;
    }
  }
  function seedDatabase() {
    var _a, _b, _c;
    const src = window.RVW || ((_b = (_a = window.parent) == null ? void 0 : _a.RVW) != null ? _b : null);
    const seed = (src == null ? void 0 : src.SEED) || {};
    const review = readStore(REVIEW_KEY);
    if ((!Array.isArray(review) || review.length === 0) && ((_c = seed.reviewItems) == null ? void 0 : _c.length)) {
      localStorage.setItem(REVIEW_KEY, JSON.stringify(seed.reviewItems));
    }
    const quiz = readStore(QUIZ_KEY);
    if ((!(quiz == null ? void 0 : quiz.notes) || Object.keys(quiz.notes).length === 0) && seed.quizBank) {
      localStorage.setItem(QUIZ_KEY, JSON.stringify({ notes: seed.quizBank }));
    }
    for (const [path, content] of Object.entries(seed.notes || {})) {
      const key = "bz-sim:" + path;
      if (!localStorage.getItem(key)) seedVaultFile(path, content, Date.now());
    }
    setApp(new FakeApp());
  }
  function injectSettings() {
    setSettingsProvider(
      () => ({
        storagePath: "CONFIG/STORAGE",
        forceQuizForReview: true,
        enableMultipleChoice: true,
        questionsPerNote: "",
        shuffleQuestions: true,
        reviewRThreshold: 0.9,
        reviewDailyLimit: 0,
        watchFolders: []
      })
    );
  }
  function bootReviewSim() {
    const g = window;
    if (g.__bzReviewSimBooted) return;
    g.__bzReviewSimBooted = true;
    seedDatabase();
    injectSettings();
  }
  function openReviewPanel2() {
    openReviewPanel(getApp());
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
