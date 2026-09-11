/* 源指纹 3281b8eedb8cf874 · 仓内输入 52 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/cinema/fake-sim.ts","prototypes/cinema/fake/fake-obsidian.ts","src/cinema/analysis.ts","src/cinema/constants.ts","src/cinema/data.ts","src/cinema/douban-queue.ts","src/cinema/index.ts","src/cinema/layouts/midnight/render.ts","src/cinema/recommend.ts","src/cinema/render.ts","src/cinema/shared.ts","src/cinema/state.ts","src/cinema/ui.ts","src/core/ai.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/obsidian-adapter.ts","src/core/path-classify.ts","src/core/settings-provider.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts"]*/
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
  async function requestUrl() {
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
      return this.makeFile(path);
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
  function seedVaultFile(path, content, ctime) {
    localStorage.setItem(LS_PREFIX + path, content);
    let stats = {};
    try {
      stats = JSON.parse(localStorage.getItem(STAT_KEY) || "{}");
    } catch (e) {
      stats = {};
    }
    stats[path] = { ctime, mtime: ctime };
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

  // src/core/ai.ts
  var _settingsProvider = null;
  function setAISettingsProvider(fn) {
    _settingsProvider = fn;
  }
  function getQ3Settings() {
    return _settingsProvider ? _settingsProvider() : {};
  }
  var AI_PROVIDER_REGISTRY = [
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
  function getProviderDescriptor(id) {
    return AI_PROVIDER_REGISTRY.find((p) => p.id === id) || AI_PROVIDER_REGISTRY.find((p) => p.id === "custom") || AI_PROVIDER_REGISTRY[AI_PROVIDER_REGISTRY.length - 1];
  }
  var _aiProviderCache = null;
  async function getAIProvider(override) {
    var _a, _b, _c;
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
      return cachePut({
        endpoint,
        apiKey: s.aiCustomApiKey,
        model: s.aiCustomModel || void 0,
        extraHeaders: desc.extraHeaders,
        contextWindow: desc.defaultContextWindow,
        defaultMaxTokens: desc.defaultMaxTokens
      });
    }
    const key = s[desc.apiKeyKey];
    if (!key && name === "deepseek") {
      try {
        const raw = await getApp().vault.adapter.read(".obsidian/plugins/quickadd/data.json");
        const cfg = JSON.parse(raw);
        const provider = cfg.ai && cfg.ai.providers && cfg.ai.providers[0];
        if (provider && provider.endpoint && provider.apiKey) {
          return cachePut({
            endpoint: String(provider.endpoint).replace(/\/+$/, ""),
            apiKey: provider.apiKey,
            contextWindow: desc.defaultContextWindow,
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
    const overrideContext = (_b = s.aiContextOverrides) == null ? void 0 : _b[name];
    const overrideMaxTokens = (_c = s.aiMaxTokensOverrides) == null ? void 0 : _c[name];
    return cachePut({
      endpoint: desc.endpoint,
      apiKey: key || "",
      model: overrideModel || desc.model || void 0,
      noCors: desc.noCors,
      extraHeaders: desc.extraHeaders,
      contextWindow: overrideContext || desc.defaultContextWindow,
      defaultMaxTokens: overrideMaxTokens || desc.defaultMaxTokens
    });
  }
  function abortError() {
    const e = new Error("请求已取消");
    e.name = "AbortError";
    return e;
  }
  var AI_IDLE_TIMEOUT_MS = 6e4;
  function timeoutError() {
    const e = new Error(`AI 请求超时（${AI_IDLE_TIMEOUT_MS / 1e3} 秒无响应）`);
    e.name = "TimeoutError";
    return e;
  }
  async function streamChatCompletions(provider, body, signal, onDelta) {
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
      idleTimer = setTimeout(() => controller.abort(), AI_IDLE_TIMEOUT_MS);
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
      if (controller.signal.aborted && !(signal && signal.aborted)) throw timeoutError();
      throw e;
    } finally {
      if (idleTimer !== null) clearTimeout(idleTimer);
      if (outerLinked && signal) signal.removeEventListener("abort", onOuterAbort);
    }
  }
  async function chatCompletionsNonStream(provider, body, signal) {
    if (signal == null ? void 0 : signal.aborted) throw abortError();
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
      timer = setTimeout(() => settle(() => reject(timeoutError())), AI_IDLE_TIMEOUT_MS);
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
  var AIService = class {
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
    const base = (path || "").replace(/\\/g, "/").split("/").pop() || "";
    const m = base.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
    return m ? m[1] : null;
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
  var TYPE_GROUPS = {
    电影: ["电影"],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: ["纪录片"],
    公开课: ["公开课", "TED"]
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

  // src/cinema/data.ts
  function parseMovieFile(file, app) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const cache = app.metadataCache.getFileCache(file);
    if (!cache || !cache.frontmatter) return null;
    const fm = cache.frontmatter;
    const basename = file.basename;
    const name = (_b = (_a = basename.match(/《(.+)》/)) == null ? void 0 : _a[1]) != null ? _b : basename;
    let rawTags = fm.tags;
    if (typeof rawTags === "string") rawTags = [rawTags];
    const tags = Array.isArray(rawTags) ? rawTags.map((t) => String(t)) : [];
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
    const watchDate = (_d = (_c = fm["观影日期"]) == null ? void 0 : _c.toString()) != null ? _d : null;
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
      poster: (_f = (_e = fm["海报"]) == null ? void 0 : _e.toString()) != null ? _f : null,
      review: (_h = (_g = fm["影评"]) == null ? void 0 : _g.toString()) != null ? _h : null,
      genre: (_j = (_i = fm["类型"]) == null ? void 0 : _i.toString()) != null ? _j : null,
      director: (_l = (_k = fm["导演"]) == null ? void 0 : _k.toString()) != null ? _l : null,
      actors: (_n = (_m = fm["主演"]) == null ? void 0 : _m.toString()) != null ? _n : null,
      region: (_p = (_o = fm["制片国家/地区"]) == null ? void 0 : _o.toString()) != null ? _p : null,
      year: fm["上映日期"] ? String(fm["上映日期"]).slice(0, 4) : null,
      doubanRating: fm["豆瓣评分"] !== void 0 && fm["豆瓣评分"] !== "" ? String(fm["豆瓣评分"]) : null,
      doubanUrl: /^https?:\/\//.test(String((_q = fm["豆瓣链接"]) != null ? _q : "")) ? String(fm["豆瓣链接"]) : null,
      synopsis: (_s = (_r = fm["简介"]) == null ? void 0 : _r.toString()) != null ? _s : null,
      // 片长/季集：原独立观影报告的两项统计源字段（ADR-0090 并入内嵌分析页）
      duration: (_u = (_t = fm["片长"]) == null ? void 0 : _t.toString()) != null ? _u : null,
      seasonText: (_w = (_v = fm["季集"]) == null ? void 0 : _v.toString()) != null ? _w : null
    };
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
  var MAX_VISIBLE = 5;
  var LEAVE_MS = 200;
  var DEDUPE_WINDOW_MS = 3e4;
  var MOBILE_QUERY = "(max-width: 768px)";
  var ICONS = {
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
    return isMobileView() ? "drop" : "slide-right";
  }
  var OUT_CLASS = {
    drop: "bz-notice--out-drop",
    pop: "bz-notice--out-pop",
    "slide-left": "bz-notice--out-left",
    "slide-right": "bz-notice--out-right",
    bounce: "bz-notice--out-fade",
    shake: "bz-notice--out-fade"
  };
  function defaultDuration(type) {
    return type === "error" ? 5e3 : 3e3;
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

  // src/core/esc-manager.ts
  var escManager = (() => {
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
  var panelEscHandles = /* @__PURE__ */ new Map();
  function registerPanelEsc(id, isVisible, close) {
    if (panelEscHandles.has(id)) return;
    panelEscHandles.set(id, escManager.register(id, { isVisible, close }));
  }

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
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

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function localNow() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/core/utils.ts
  var import_moment = __toESM(require_moment());
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

  // src/cinema/douban-queue.ts
  var FETCH_GAP_MS = 15e3;
  var FETCH_TIMEOUT_MS = 3 * 60 * 1e3;
  var queue = [];
  var pending = /* @__PURE__ */ new Map();
  var attempted = /* @__PURE__ */ new Set();
  var cancelled = /* @__PURE__ */ new Set();
  var failedNames = [];
  var pumping = false;
  var cliPath = null;
  var cliUnavailableNotified = false;
  var nodePath = null;
  var nodeUnavailableNotified = false;
  var spawnFn = null;
  var gapMs = FETCH_GAP_MS;
  var refreshDelayMs = 1500;
  var POLL_COMPLETE_MS = 3e3;
  var pollCompleteMs = POLL_COMPLETE_MS;
  var activeKill = null;
  function getChildProcess() {
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("child_process");
    } catch (e) {
      return null;
    }
  }
  function resolveCli() {
    if (cliPath !== null) return cliPath;
    const cp = getChildProcess();
    if (!cp) {
      cliPath = "";
      return "";
    }
    try {
      const npmRoot = cp.execSync("npm root -g", { encoding: "utf-8", timeout: 1e4 }).trim();
      const fs = window.require("fs");
      const path = window.require("path");
      const candidate = path.join(npmRoot, "@jwbz", "obsidian-douban-poster", "cli.js");
      if (fs.existsSync(candidate)) {
        cliPath = candidate;
        return candidate;
      }
    } catch (e) {
    }
    cliPath = "";
    if (!cliUnavailableNotified) {
      cliUnavailableNotified = true;
      notice("豆瓣抓取不可用：未找到全局安装的 douban-poster（npm i -g @jwbz/obsidian-douban-poster 后重载插件）", "error");
    }
    return "";
  }
  function resolveNode() {
    if (nodePath !== null) return nodePath;
    const cp = getChildProcess();
    if (!cp) {
      nodePath = "";
      return "";
    }
    try {
      const out = cp.execSync("node -p process.execPath", { encoding: "utf-8", timeout: 1e4 }).trim();
      if (out) {
        nodePath = out;
        return out;
      }
    } catch (e) {
    }
    nodePath = "";
    if (!nodeUnavailableNotified) {
      nodeUnavailableNotified = true;
      notice("豆瓣抓取不可用：未找到系统 Node.js（安装 node 后重载 Obsidian）", "error");
    }
    return "";
  }
  async function defaultSpawn(cliJs, notePath) {
    const cp = getChildProcess();
    const node = resolveNode();
    if (!cp || !node) throw new Error("spawn 环境不可用");
    const child = cp.spawn(node, [cliJs, "fetch", notePath], {
      windowsHide: true,
      stdio: "ignore"
    });
    activeKill = () => {
      try {
        child.kill();
      } catch (e) {
      }
    };
    await waitForExit(child, FETCH_TIMEOUT_MS, () => child.kill());
    activeKill = null;
  }
  function absPath(app, path) {
    try {
      const adapter = (app == null ? void 0 : app.vault).adapter;
      if (adapter == null ? void 0 : adapter.getFullPath) return adapter.getFullPath(path);
    } catch (e) {
    }
    return path;
  }
  function waitForExit(child, timeoutMs, kill) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const killer = setTimeout(() => {
        kill();
        finish();
      }, timeoutMs);
      child.on("close", () => {
        clearTimeout(killer);
        finish();
      });
      child.on("error", () => {
        clearTimeout(killer);
        finish();
      });
    });
  }
  function fieldValue(content, key) {
    const m = content.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
    if (!m) return null;
    const v = m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
    return v || null;
  }
  async function fetchComplete(app, file) {
    if (!app) return false;
    try {
      const content = await app.vault.read(file);
      const poster = fieldValue(content, "海报");
      const url = fieldValue(content, "豆瓣链接");
      return !!(poster && url && /^https?:\/\//.test(url));
    } catch (e) {
      return false;
    }
  }
  function isFetching(path) {
    if (!path) return false;
    const at = pending.get(path);
    if (!at) return false;
    return Date.now() - at < FETCH_TIMEOUT_MS + 3e4;
  }
  function enqueueDoubanFetch(file, name) {
    if (!file) return false;
    if (!resolveCli() || !resolveNode()) return false;
    const key = file.path;
    if (attempted.has(key)) return false;
    attempted.add(key);
    pending.set(key, Date.now());
    queue.push({ file, name });
    void pump();
    return true;
  }
  function dequeueDoubanFetch(path) {
    if (!path) return;
    const at = queue.findIndex((e) => e.file.path === path);
    if (at >= 0) queue.splice(at, 1);
    pending.delete(path);
    cancelled.add(path);
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
  async function waitCompleteOrExit(entry, running) {
    let settled = false;
    return new Promise((resolve) => {
      const finish = (v) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        resolve(v);
      };
      const timer = setInterval(() => {
        void fetchComplete(M.appRef, entry.file).then((ok) => {
          if (!ok) return;
          activeKill == null ? void 0 : activeKill();
          finish(true);
        });
      }, pollCompleteMs);
      running.then((ok) => finish(ok), () => finish(false));
    });
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      let first = true;
      while (queue.length > 0) {
        const entry = queue.shift();
        if (!first) await sleep(gapMs);
        first = false;
        const ok = await waitCompleteOrExit(entry, runOne(entry));
        pending.delete(entry.file.path);
        if (cancelled.delete(entry.file.path)) {
          refreshAfterFetch();
          continue;
        }
        if (!ok) failedNames.push(entry.name);
        refreshAfterFetch();
      }
    } finally {
      pumping = false;
    }
    if (failedNames.length > 0) {
      notice(`以下影片豆瓣信息获取失败：${failedNames.join("、")}（重启 Obsidian 后会自动重试）`, "error");
      failedNames.length = 0;
    }
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
  async function runOne(entry) {
    const cli = resolveCli();
    if (!cli) return false;
    const spawn = spawnFn != null ? spawnFn : defaultSpawn;
    try {
      await spawn(cli, absPath(M.appRef, entry.file.path));
    } catch (e) {
      return false;
    }
    return fetchComplete(M.appRef, entry.file);
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
      const codeBlockMatch = cleaned.match(/```json\s*([\s\S]*?)```/);
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
观影日期: ${now}
评分: -1
海报: 
---
`;
    try {
      const f = await app.vault.create(filePath, content);
      notice(`已加入想看：${trimmedName}`, "success");
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

  // src/cinema/analysis.ts
  var REVIEW_KEYWORDS = ["好看", "喜欢", "推荐", "经典", "感动", "治愈", "失望", "无聊", "一般", "神作", "烂片", "封神", "震撼", "催泪", "熬夜", "二刷", "满分"];
  function ratingBucketOf(r) {
    if (r >= 9) return "≥9";
    if (r >= 8) return "8~9";
    if (r >= 7) return "7~8";
    if (r >= 6) return "6~7";
    if (r >= 5) return "5~6";
    return "<5";
  }
  function createEmptyAnalysis() {
    return {
      total: 0,
      watched: 0,
      watching: 0,
      want: 0,
      ratingSum: 0,
      ratingCount: 0,
      doubanSum: 0,
      doubanCount: 0,
      groups: {},
      tags: {},
      years: {},
      months: {},
      buckets: { "≥9": 0, "8~9": 0, "7~8": 0, "6~7": 0, "5~6": 0, "<5": 0 },
      genres: {},
      countries: {},
      directors: {},
      actors: {},
      topRated: [],
      wantList: [],
      ageBuckets: { "当年": 0, "1-3年": 0, "4-10年": 0, "≥10年": 0 },
      ageSum: 0,
      ageCount: 0,
      eras: {},
      durBuckets: { "<90": 0, "90-120": 0, ">120": 0 },
      durSum: 0,
      durCount: 0,
      groupDur: {},
      weekdays: [0, 0, 0, 0, 0, 0, 0],
      monthKeys: /* @__PURE__ */ new Set(),
      diffSum: 0,
      diffCount: 0,
      treasure: [],
      disappoint: [],
      reviewKeywords: {},
      reviewCount: 0,
      reviewCharSum: 0,
      series: {},
      seasonSum: 0,
      seasonCount: 0,
      seasons: [],
      wantDoubanSum: 0,
      wantDoubanCount: 0,
      wantTags: {},
      yearRating: {}
    };
  }
  function accumulateStats(data, it) {
    const { status, group, typeTag, rating } = it;
    data.total++;
    if (status === STATUS_WATCHED) {
      data.watched++;
      if (rating !== null && rating > 0) {
        data.ratingSum += rating;
        data.ratingCount++;
        data.topRated.push(it);
      }
    } else if (status === STATUS_WATCHING) data.watching++;
    else if (status === STATUS_WANT) {
      data.want++;
      data.wantList.push(it);
    }
    if (group) data.groups[group] = (data.groups[group] || 0) + 1;
    if (typeTag) data.tags[typeTag] = (data.tags[typeTag] || 0) + 1;
    const d = it.watchDate ? new Date(it.watchDate) : null;
    const validD = d && !isNaN(d.getTime()) ? d : null;
    if (validD) {
      const y = validD.getFullYear();
      data.years[y] = (data.years[y] || 0) + 1;
      data.months[validD.getMonth() + 1] = (data.months[validD.getMonth() + 1] || 0) + 1;
      data.weekdays[validD.getDay()]++;
      data.monthKeys.add(y + "-" + (validD.getMonth() + 1));
    }
    if (rating !== null && rating > 0) data.buckets[ratingBucketOf(rating)]++;
    const db = it.doubanRating ? Number(it.doubanRating) : NaN;
    if (!isNaN(db) && db > 0) {
      data.doubanSum += db;
      data.doubanCount++;
    }
    const splitAdd = (str, map) => String(str || "").split("/").map((s) => s.trim()).filter(Boolean).forEach((v) => {
      map[v] = (map[v] || 0) + 1;
    });
    splitAdd(it.genre, data.genres);
    splitAdd(it.region, data.countries);
    splitAdd(it.director, data.directors);
    splitAdd(it.actors, data.actors);
    const relYear = it.year ? Number(it.year) : NaN;
    if (!isNaN(relYear) && validD) {
      const diff = validD.getFullYear() - relYear;
      if (diff >= 0) {
        if (diff === 0) data.ageBuckets["当年"]++;
        else if (diff <= 3) data.ageBuckets["1-3年"]++;
        else if (diff <= 10) data.ageBuckets["4-10年"]++;
        else data.ageBuckets["≥10年"]++;
        data.ageSum += diff;
        data.ageCount++;
      }
      const era = Math.floor(relYear / 10) * 10;
      data.eras[era] = (data.eras[era] || 0) + 1;
    }
    const durMatch = String(it.duration || "").match(/^(\d+)/);
    if (durMatch) {
      const mins = Number(durMatch[1]);
      if (mins < 90) data.durBuckets["<90"]++;
      else if (mins <= 120) data.durBuckets["90-120"]++;
      else data.durBuckets[">120"]++;
      data.durSum += mins;
      data.durCount++;
      const gd = data.groupDur[group] = data.groupDur[group] || { sum: 0, count: 0 };
      gd.sum += mins;
      gd.count++;
    }
    if (rating !== null && rating > 0 && validD) {
      const yr = validD.getFullYear();
      const yrStat = data.yearRating[yr] = data.yearRating[yr] || { sum: 0, count: 0 };
      yrStat.sum += rating;
      yrStat.count++;
    }
  }
  function accumulateExtras(data, it) {
    const { status, typeTag, rating, name } = it;
    const db = it.doubanRating ? Number(it.doubanRating) : NaN;
    if (status === STATUS_WATCHED && rating !== null && rating > 0 && !isNaN(db) && db > 0) {
      data.diffSum += rating - db;
      data.diffCount++;
      if (rating >= 9 && db < 8) data.treasure.push({ name, typeTag, rating, douban: db });
      if (rating <= 4 && db >= 8.5) data.disappoint.push({ name, typeTag, rating, douban: db });
    }
    const review = it.review ? String(it.review).trim() : "";
    if (review) {
      data.reviewCount++;
      data.reviewCharSum += review.length;
      REVIEW_KEYWORDS.forEach((w) => {
        if (review.includes(w)) data.reviewKeywords[w] = (data.reviewKeywords[w] || 0) + 1;
      });
    }
    const serMatch = name.match(/^(.*?)(\d+)$/);
    const serBase = serMatch && serMatch[1] ? serMatch[1] : name;
    data.series[serBase] = (data.series[serBase] || 0) + 1;
    const seasonMatch = String(it.seasonText || "").match(/(\d+)/);
    if (seasonMatch) {
      const n = Number(seasonMatch[1]);
      data.seasonSum += n;
      data.seasonCount++;
      data.seasons.push({ name, seasons: n });
    }
    if (status === STATUS_WANT && !isNaN(db) && db > 0) {
      data.wantDoubanSum += db;
      data.wantDoubanCount++;
    }
    if (status === STATUS_WANT && typeTag) {
      data.wantTags[typeTag] = (data.wantTags[typeTag] || 0) + 1;
    }
  }
  function finalizeAnalysis(data) {
    data.topRated.sort((a, b) => b.rating - a.rating);
    data.topRated = data.topRated.slice(0, 10);
    data.wantTotal = data.wantList.length;
    data.wantList = data.wantList.slice(0, 10);
    data.treasure = data.treasure.sort((a, b) => b.rating - a.rating).slice(0, 10);
    data.disappoint = data.disappoint.sort((a, b) => a.rating - b.rating).slice(0, 10);
    data.seasons = data.seasons.sort((a, b) => b.seasons - a.seasons).slice(0, 5);
    data.seriesList = Object.entries(data.series).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
    data.avgAge = data.ageCount ? (data.ageSum / data.ageCount).toFixed(1) : "—";
    data.avgDur = data.durCount ? (data.durSum / data.durCount).toFixed(0) : "—";
    data.avgDiff = data.diffCount ? (data.diffSum / data.diffCount).toFixed(2) : "—";
    data.avgSeason = data.seasonCount ? (data.seasonSum / data.seasonCount).toFixed(1) : "—";
    data.monthFreq = data.monthKeys.size ? (data.total / data.monthKeys.size).toFixed(1) : "—";
    data.reviewRate = data.total ? Math.round(data.reviewCount / data.total * 100) : 0;
    data.reviewAvgChars = data.reviewCount ? Math.round(data.reviewCharSum / data.reviewCount) : 0;
    data.wantAvgDouban = data.wantDoubanCount ? (data.wantDoubanSum / data.wantDoubanCount).toFixed(2) : "—";
    data.dirRepeat = Object.values(data.directors).filter((c) => c >= 3).length;
    data.actRepeat = Object.values(data.actors).filter((c) => c >= 3).length;
    data.eraEntries = Object.keys(data.eras).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y + "s", value: data.eras[y] }));
    data.yearRatingEntries = Object.keys(data.yearRating).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: Number((data.yearRating[y].sum / data.yearRating[y].count).toFixed(2)) }));
    data.weekdayEntries = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((w, i) => ({ label: w, value: data.weekdays[i] }));
    data.groupDurEntries = Object.entries(data.groupDur).map(([g, v]) => ({ label: g, value: Math.round(v.sum / v.count) })).sort((a, b) => b.value - a.value);
    data.keywordEntries = Object.entries(data.reviewKeywords).sort((a, b) => b[1] - a[1]).slice(0, 12);
    data.yearTrend = (() => {
      const ys = Object.keys(data.years).sort((a, b) => Number(a) - Number(b));
      const out = [];
      for (let i = 1; i < ys.length; i++) {
        const prev = data.years[ys[i - 1]], cur = data.years[ys[i]];
        out.push({ label: ys[i - 1] + "→" + ys[i], value: prev ? Math.round((cur - prev) / prev * 100) : 0 });
      }
      return out;
    })();
  }
  function buildAnalysisData() {
    const data = createEmptyAnalysis();
    for (const it of M.items) {
      accumulateStats(data, it);
      accumulateExtras(data, it);
    }
    finalizeAnalysis(data);
    return data;
  }
  function esc2(s) {
    return escapeHtml2(String(s != null ? s : ""));
  }
  function emptyHTML() {
    return '<div class="cn-empty">暂无数据</div>';
  }
  function barHTML(entries, opt) {
    if (!entries || !entries.length) return emptyHTML();
    const max = Math.max(1, ...entries.map((e) => e.value));
    return entries.map((e) => `<div class="bar-row"><span class="bar-label">${esc2(e.label)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round(e.value / max * 100)}%;${(opt == null ? void 0 : opt.color) ? "background:" + opt.color + ";" : ""}"></span></span><span class="bar-num">${e.value}</span></div>`).join("");
  }
  function softHTML(entries) {
    if (!entries || !entries.length) return emptyHTML();
    const max = Math.max(1, ...entries.map((e) => e.value));
    return entries.map((e) => `<div class="soft-row"><span class="bar-label">${esc2(e.label)}</span><span class="soft-track"><span class="soft-fill" style="width:${Math.round(e.value / max * 100)}%"></span></span><span class="bar-num">${e.value}</span></div>`).join("");
  }
  function secHTML(title, icon, body) {
    return `<div class="sec"><div class="sec-title"><i data-lucide="${icon}" class="bz-ic"></i>${esc2(title)}</div>${body}</div>`;
  }
  function kvInline(items) {
    return `<div class="kv-inline">${items.map((s) => `<span>${s}</span>`).join("")}</div>`;
  }
  function topRow(no, name, val) {
    return `<div class="top-row"><span class="top-no">${no}</span><span class="top-name">${name}</span><span class="top-val">${val}</span></div>`;
  }
  var topN = (map, n) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
  function buildAnalysisHTML() {
    var _a;
    const data = buildAnalysisData();
    if (data.total === 0) {
      return `<div class="cn-empty-page"><div class="big">还没有可统计的影视记录</div>
      <div style="font-size:11.5px;color:var(--ink-3)">影视文件夹「${esc2(M.folderPath)}」里还没有可分析的条目，添加影视后这里会生成你的观影统计</div>
      <div style="margin-top:8px"><button class="dm-btn" data-cinema-analysis-add>添加影视</button></div></div>`;
    }
    const avgRating = data.ratingCount ? (data.ratingSum / data.ratingCount).toFixed(1) : "";
    const yearEntries = Object.keys(data.years).sort((a, b) => Number(a) - Number(b)).map((y) => ({ label: y, value: data.years[y] }));
    const monthEntries = Array.from({ length: 12 }, (_, i) => ({ label: i + 1 + "月", value: data.months[i + 1] || 0 }));
    const bucketEntries = ["≥9", "8~9", "7~8", "6~7", "5~6", "<5"].map((b) => ({ label: b, value: data.buckets[b] }));
    const ageEntries = Object.entries(data.ageBuckets).map(([label, value]) => ({ label, value }));
    const durEntries = [["<90分", data.durBuckets["<90"]], ["90-120分", data.durBuckets["90-120"]], [">120分", data.durBuckets[">120"]]].map(([label, value]) => ({ label, value }));
    const weekend = data.weekdays[0] + data.weekdays[6];
    const weekEntries = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map((w, i) => ({ label: w, value: data.weekdays[(i + 1) % 7] }));
    const cmpRow = (it) => topRow("", `《${esc2(it.name)}》`, `我 ${Number(it.rating).toFixed(1)} / 豆 ${Number(it.douban).toFixed(1)}`);
    return `${kvInline([`月均 <b>${data.monthFreq}</b> 部`, `周末 <b>${weekend}</b> 部`, `有影评 <b>${data.reviewCount}</b> 篇`])}
  <div class="stat-cards">
    <div class="stat-card"><div class="v">${data.total}</div><div class="k">馆藏总数</div></div>
    <div class="stat-card"><div class="v">${data.watched}</div><div class="k">已放映</div></div>
    <div class="stat-card"><div class="v">${avgRating || "—"}</div><div class="k">平均评分</div></div>
    <div class="stat-card"><div class="v">${data.avgDiff === "—" ? "—" : (Number(data.avgDiff) >= 0 ? "+" : "") + data.avgDiff}</div><div class="k">个人−豆瓣</div></div>
  </div>
  ${secHTML("类型分布", "clapperboard", softHTML(topN(data.groups, 8)))}
  ${secHTML("年度观影趋势", "bar-chart-3", barHTML(yearEntries))}
  ${secHTML("片龄画像", "bar-chart-3", kvInline([`平均片龄 <b>${data.avgAge}</b> 年`, `片龄≥10年 <b>${data.ageBuckets["≥10年"]}</b> 部`]) + softHTML(ageEntries) + '<div style="margin-top:10px">' + barHTML(data.eraEntries) + "</div>")}
  ${secHTML("片长画像", "bar-chart-3", data.durCount ? kvInline([`平均片长 <b>${data.avgDur}</b> 分钟`]) + softHTML(durEntries) : '<div class="cn-empty">暂无片长数据（笔记 frontmatter 未含时长字段）</div>')}
  ${secHTML("月度观影分布", "bar-chart-3", barHTML(monthEntries))}
  ${secHTML("观影节奏", "bar-chart-3", kvInline([`月均 <b>${data.monthFreq}</b> 部`, `周末 <b>${weekend}</b> 部（${data.total ? Math.round(weekend / data.total * 100) : 0}%）`]) + barHTML(weekEntries))}
  ${secHTML("个人评分分布", "bar-chart-3", barHTML(bucketEntries))}
  ${secHTML("评分趋势（个人10分制）", "bar-chart-3", barHTML(data.yearRatingEntries, { color: "#8fa3bd" }))}
  ${secHTML("打分习惯（个人−豆瓣）", "bar-chart-3", kvInline([`平均差值 <b>${data.avgDiff === "—" ? "—" : (Number(data.avgDiff) >= 0 ? "+" : "") + data.avgDiff}</b>（个人−豆瓣）`]) + '<div style="font-weight:600;font-size:12px;margin:6px 0 4px">宝藏片（个人≥9 豆瓣&lt;8）</div>' + (data.treasure.length ? data.treasure.map(cmpRow).join("") : emptyHTML()) + '<div style="font-weight:600;font-size:12px;margin:10px 0 4px">失望榜（个人≤4 豆瓣≥8.5）</div>' + (data.disappoint.length ? data.disappoint.map(cmpRow).join("") : emptyHTML()))}
  ${secHTML("题材偏好 TOP10", "bar-chart-3", softHTML(topN(data.genres, 10)))}
  ${secHTML("制片国家/地区 TOP10", "bar-chart-3", softHTML(topN(data.countries, 10)))}
  ${secHTML("最爱导演 TOP10", "bar-chart-3", softHTML(topN(data.directors, 10)))}
  ${secHTML("最爱主演 TOP10", "bar-chart-3", softHTML(topN(data.actors, 10)))}
  ${secHTML("真爱重复", "bar-chart-3", kvInline([`导演≥3部 <b>${data.dirRepeat}</b> 人`, `主演≥3部 <b>${data.actRepeat}</b> 人`]) + softHTML([{ label: "导演≥3部", value: data.dirRepeat }, { label: "主演≥3部", value: data.actRepeat }]))}
  ${secHTML("影评关键词", "bar-chart-3", kvInline([`有影评 <b>${data.reviewCount}</b> 篇（${data.reviewRate}%）`]) + (data.keywordEntries.length ? `<div class="tag-cloud">${data.keywordEntries.map(([k, v]) => `<span class="tag-pill">${esc2(k)} <b>${v}</b></span>`).join("")}</div>` : emptyHTML()))}
  ${secHTML("我的高分 TOP10", "bar-chart-3", data.topRated.length ? data.topRated.map((it, i) => topRow(String(i + 1), esc2(it.name), Number(it.rating).toFixed(1))).join("") : emptyHTML())}
  ${secHTML("系列追踪", "bar-chart-3", data.seriesList.length ? data.seriesList.map(([k, v], i) => topRow(String(i + 1), `《${esc2(k)}》`, `${v} 部`)).join("") : emptyHTML())}
  ${secHTML("追剧深度", "bar-chart-3", data.seasons.length ? kvInline([`平均 <b>${data.avgSeason}</b> 季`]) + data.seasons.map((s, i) => topRow(String(i + 1), `《${esc2(s.name)}》`, `${s.seasons} 季`)).join("") : emptyHTML())}
  ${secHTML(`想看清单（${(_a = data.wantTotal) != null ? _a : data.wantList.length}）`, "bar-chart-3", (data.wantList.length ? data.wantList.map((it, i) => topRow(String(i + 1), esc2(it.name) + (it.doubanRating ? " · 豆瓣 " + esc2(it.doubanRating) : ""), "")).join("") : emptyHTML()) + (Object.keys(data.wantTags).length ? '<div class="tag-cloud" style="margin-top:10px">' + Object.entries(data.wantTags).sort((a, b) => b[1] - a[1]).map(([t, c]) => `<span class="tag-pill">${esc2(t)} <b>${c}</b></span>`).join("") + "</div>" : ""))}`;
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
  function pcardHtml(it, posterUrl2, fetching = false) {
    const r = it.rating;
    return `<div class="pcard" data-cinema-key="${esc(itemKey(it))}"><div class="pw">${posterInner(it, posterUrl2)}${fetching ? '<div class="pw-fetch"><span class="pw-spin"></span></div>' : ""}
    ${(() => {
      const st = statusNum(it.status);
      return st !== STATUS_WATCHED ? `<span class="badge" style="background:${statusColor(st)}">${statusText(st)}</span>` : "";
    })()}</div>
    <div class="pname">${esc(it.name)}</div>
    <div class="pmeta">${esc(it.year || "")}${it.year && it.director ? " · " : ""}${esc(it.director || "")}</div>
    <div class="pstars">${r && r > 0 ? getStarString(r) + `<span class="num">${Number(r).toFixed(1)}</span>` : '<span style="opacity:.35">未评分</span>'}</div></div>`;
  }
  function viewFiltered(view) {
    return !!(view.typeFilter || view.statusFilter || view.searchKeyword);
  }
  function detailModalHtml(it, posterUrl2) {
    var _a, _b, _c, _d, _e, _f;
    const badge = (color, text) => `<span class="dm-chip" style="background:${color}">${esc(text)}</span>`;
    const rows = [
      ["类型", (_a = it.genre) != null ? _a : ""],
      ["导演", (_b = it.director) != null ? _b : ""],
      ["主演", (_c = it.actors) != null ? _c : ""],
      ["制片国家/地区", (_d = it.region) != null ? _d : ""],
      ["上映日期", (_e = it.year) != null ? _e : ""],
      ["豆瓣评分", (_f = it.doubanRating) != null ? _f : ""]
    ].filter(([, v]) => v !== "");
    return `<div class="cn-modal" style="max-width:400px;width:100%">
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
    ${it.synopsis ? `<div class="dm-sec">简 介</div><div style="font-size:12px;line-height:1.8;color:var(--ink-2);text-align:justify">${esc(it.synopsis)}</div>` : ""}
    <div class="dm-actions"><button class="dm-btn j-similar">${iconSpan(ICON.ai)}找同类</button><button class="dm-btn j-edit">${iconSpan(ICON.edit)}编辑</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
  }
  var GROUP_SUBS_OF = {
    电影: [],
    剧集: ["国产剧", "美剧", "英剧", "德剧", "日剧", "韩剧", "哥伦比亚剧"],
    动漫: ["日漫", "国漫", "美漫"],
    纪录片: [],
    公开课: ["公开课", "TED"]
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
    const ratingVal = opts.rating;
    return `<div class="cn-modal" style="width:100%">
    <div class="cn-modal-title">${editing ? "编辑影视" : "添加影视"}</div>
    <div class="f-field"><span class="f-label">名 称</span><input class="f-input j-name" value="${esc(opts.name)}" placeholder="影视名称"></div>
    <div class="f-field"><span class="f-label">类 型</span><div class="f-choice j-tags">${formChoicesHtml(formAllTags(), opts.typeTag, "f-tag")}</div></div>
    <div class="f-field"><span class="f-label">状 态</span><div class="f-choice j-sts">${formChoicesHtml(["想看", "在看", "已看"], initSt, "f-st")}</div></div>
    <div class="f-field j-rating" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">评 分</span>
      <div class="f-range-row"><input type="range" class="f-range j-range" min="1" max="10" step="0.1" value="${ratingVal}"><span class="f-range-val j-rval">${Number(ratingVal).toFixed(1)}</span></div></div>
    <div class="f-field j-review" style="display:${initSt === "已看" ? "" : "none"}"><span class="f-label">影 评</span><textarea class="f-input j-review-t" placeholder="写点什么…">${esc(opts.review)}</textarea></div>
    <div class="dm-actions"><button class="dm-btn gold j-save">${editing ? "保存" : "添加"}</button></div>
  </div>`;
  }
  function confirmModalHtml(item) {
    return `<div class="cn-modal cn-confirm" style="max-width:320px;width:100%">
    <span class="cn-confirm-ic">${iconSpan(ICON.confirm)}</span>
    <div class="cn-confirm-title">删除影视</div>
    <p>确定删除「${esc(item.name)}」吗？</p>
    <div class="cn-confirm-sub">将移入系统回收站，可在回收站恢复</div>
    <div class="dm-actions"><button class="dm-btn j-cancel">取消</button><button class="dm-btn danger j-del">${iconSpan(ICON.del)}删除</button></div>
  </div>`;
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
          <button class="rail-item j-tool" data-tool="stat">${iconSpan(ICON.stat)}观影分析</button>
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
        <button class="add j-madd" data-cinema-add title="添加影片">${iconSpan(ICON.add)}</button>
        <button class="m-tool j-mai" title="AI 荐片">${iconSpan(ICON.ai)}</button>
        <button class="m-tool j-mstat" title="观影分析">${iconSpan(ICON.stat)}</button>
        <button class="m-tool j-mclose" title="关闭">${iconSpan(ICON.close)}</button>
      </span>
    </div>
    <div class="m-chips j-chips"></div>
    <label class="m-search">${iconSpan(ICON.search)}<input class="j-mq" placeholder="搜索片名 / 导演…"></label>
    <div class="m-scroll j-mview"></div>
  </section>`;
  }
  var railRow = (on, attr, color, name, n) => `<button class="rail-item${on ? " is-on" : ""}" ${attr}><span class="dot" style="background:${color}"></span>${esc(name)}<span class="n">${n}</span></button>`;
  function railHtml(items, view) {
    const listOn = view.view === "list";
    const g = {};
    const c = { 想看: 0, 在看: 0, 已看: 0 };
    items.forEach((it) => {
      g[it.group] = (g[it.group] || 0) + 1;
      c[statusText(it.status)]++;
    });
    let groups = railRow(listOn && !view.typeFilter && !view.statusFilter, 'data-g="全部"', "var(--gold)", "全部", items.length);
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
    let html = `<button class="chip${listOn && !view.typeFilter && !view.statusFilter ? " is-on" : ""}" data-c="all">${iconSpan(ICON.grid)}全部</button>`;
    for (const name of GROUP_ORDER) {
      html += `<button class="chip${listOn && view.typeFilter === name && !view.statusFilter ? " is-on" : ""}" data-c="${name}">${name}</button>`;
    }
    for (const s of ["想看", "在看", "已看"]) {
      html += `<button class="chip${listOn && view.statusFilter === s ? " is-on" : ""}" data-s="${s}">${s}</button>`;
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
  function listHeadHtml(inp) {
    return `<div class="d-head"><h2 class="j-title">${esc(inp.title)}</h2><span class="cnt j-cnt">· ${inp.list.length} 部</span>
    <button class="add j-add" data-cinema-add>${iconSpan(ICON.add)}添加影片</button></div>`;
  }
  function listToolsHtml(view) {
    return `<div class="d-tools"><label class="d-search">${iconSpan(ICON.search)}<input class="j-q" placeholder="搜索影视（名称、类型、影评）..." value="${esc(view.searchKeyword)}"></label>
    <div class="seg j-sort">${[["date", "最近观看"], ["created", "加入先后"], ["rating", "按评分"]].map(([k, l]) => `<button data-k="${k}" class="${view.sortMode === k ? "is-on" : ""}">${l}</button>`).join("")}</div></div>`;
  }
  function renderMidnightDesk(root, inp) {
    const rail = railHtml(inp.items, inp.view);
    const groupsEl = root.querySelector(".j-groups");
    const statusEl = root.querySelector(".j-status");
    if (groupsEl) groupsEl.innerHTML = rail.groups;
    if (statusEl) statusEl.innerHTML = rail.status;
    const view = root.querySelector(".j-view");
    if (!view) return;
    const v = inp.view;
    if (v.view === "ai") {
      view.innerHTML = spHeadHtml("AI 荐片", inp.aiCount ? `· ${inp.aiCount} 部` : "") + `<div class="sp-body">${inp.aiHtml}</div>`;
    } else if (v.view === "stat") {
      view.innerHTML = spHeadHtml("观影分析", `· ${inp.watchedCount} 部已看`) + `<div class="sp-body">${inp.statHtml}</div>`;
    } else {
      const body = inp.list.length ? `<div class="d-scroll"><div class="grid" style="grid-template-columns:repeat(${inp.cols},1fr)">${inp.list.map((it) => {
        var _a, _b;
        return pcardHtml(it, inp.poster(it), (_b = (_a = inp.fetching) == null ? void 0 : _a.call(inp, it)) != null ? _b : false);
      }).join("")}</div></div>` : emptyPageHtml(viewFiltered(v));
      view.innerHTML = listHeadHtml(inp) + listToolsHtml(v) + body;
    }
  }
  function renderMidnightMob(root, inp) {
    const v = inp.view;
    const t = v.view === "list" ? inp.title : v.view === "ai" ? "AI 荐片" : "观影分析";
    const titleEl = root.querySelector(".j-mtitle");
    const cntEl = root.querySelector(".j-mcnt");
    if (titleEl) titleEl.textContent = t;
    if (cntEl) cntEl.textContent = v.view === "list" ? `· ${inp.list.length}` : "";
    const mv = root.querySelector(".j-mview");
    if (mv) {
      if (v.view === "list") {
        mv.className = "m-scroll j-mview";
        mv.innerHTML = `<div class="m-grid">${inp.list.map((it) => {
          var _a, _b;
          return pcardHtml(it, inp.poster(it), (_b = (_a = inp.fetching) == null ? void 0 : _a.call(inp, it)) != null ? _b : false);
        }).join("")}</div>`;
      } else if (v.view === "ai") {
        mv.className = "sp-body j-mview";
        mv.innerHTML = inp.aiHtml;
      } else {
        mv.className = "sp-body j-mview";
        mv.innerHTML = inp.statHtml;
      }
    }
    const chips = root.querySelector(".j-chips");
    if (chips) chips.innerHTML = chipsHtml(v);
  }

  // src/cinema/ui.ts
  function posterUrl(item, app) {
    if (!item.poster) return null;
    const f = app.vault.getAbstractFileByPath(item.poster);
    if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
      return app.vault.getResourcePath(f);
    }
    return null;
  }
  function itemByKeyInState(key) {
    return itemByKey(M.items, key);
  }
  function openDouban(item) {
    const url = item.doubanUrl || doubanSearchUrl(item.name);
    try {
      window.open(url, "_blank");
    } catch (e) {
    }
  }
  async function markStatus(item, target, sec, app) {
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
      panelToast(sec, `已把「${item.name}」标记为${target}`);
      const toSt = target === "已看" ? "watched" : "watching";
      if (toSt !== fromSt) emitDomainEvent("movie", { kind: "status", name: item.name, from: fromSt, to: toSt });
      if (item.rating !== null && item.rating > 0 && item.rating !== prevRating) {
        emitDomainEvent("movie", { kind: "rated", name: item.name, fromRating: prevRating, toRating: item.rating });
      }
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
      out.push({ icon: ICON.play, label: "标记在看", run: () => void markStatus(it, "在看", sec, app) });
    }
    if (it.status !== STATUS_WATCHED) {
      out.push({ icon: "check", label: "标记已看", run: () => openForm(sec, it, app, "已看") });
    }
    out.push(
      { icon: ICON.ai, label: "找同类", run: () => void runSimilarRecommend(it, app) },
      { icon: ICON.globe, label: "在豆瓣打开", run: () => openDouban(it) },
      { icon: ICON.edit, label: "编辑", run: () => openForm(sec, it, app) },
      { icon: ICON.del, label: "删除", danger: true, run: () => openConfirm(sec, it, app) }
    );
    return out;
  }
  var ILLEGAL_NAME_RE = /[\\/:*?"<>|]/;
  async function persistItem(item, app, edit) {
    var _a;
    if (!item.file) {
      const folder = M.folderPath;
      if (!app.vault.getAbstractFileByPath(folder)) {
        await app.vault.createFolder(folder);
      }
      const filePath = `${folder}/《${item.name}》.md`;
      const content = `---
tags:
- ${item.typeTag}
观影日期: ${item.watchDate || localNow()}
评分: ${(_a = item.rating) != null ? _a : 0}
${item.review ? `影评: ${item.review}
` : ""}海报: 
---
`;
      const f = await app.vault.create(filePath, content);
      item.file = f;
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
        const tags = Array.isArray(fm["tags"]) ? fm["tags"].map((t) => String(t)) : typeof fm["tags"] === "string" && fm["tags"] ? [fm["tags"]] : [];
        const at = tags.indexOf(edit.prevTag);
        if (at >= 0) tags[at] = item.typeTag;
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
  function watchedCount() {
    return M.items.filter((it) => it.status === STATUS_WATCHED).length;
  }
  function listTitle() {
    return (M.typeFilter || "全部") + (M.statusFilter ? ` · ${M.statusFilter}` : "");
  }
  function gridColumns() {
    const raw = Number(tryGetSettings().cinemaGridColumns);
    if (!Number.isFinite(raw) || raw <= 0) return 5;
    return Math.min(12, Math.max(2, Math.round(raw)));
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
  var ovlSeq = 0;
  function ovl(sec, html, opts = {}) {
    const el = document.createElement("div");
    el.className = "cn-ovl";
    el.innerHTML = html;
    ovHost(sec).appendChild(el);
    let close = () => {
    };
    const handle = escManager.register(`bz-cinema-ovl-${++ovlSeq}`, { isVisible: () => el.isConnected, close: () => close() });
    close = () => {
      handle.unregister();
      el.remove();
    };
    el.addEventListener("click", (e) => {
      if (e.target === el && !opts.sticky) close();
    });
    return { el, close };
  }
  function panelToast(sec, msg) {
    if (!sec || !sec.isConnected) {
      notice(msg);
      return;
    }
    const t = document.createElement("div");
    t.className = "cn-toast";
    t.textContent = msg;
    ovHost(sec).appendChild(t);
    setTimeout(() => t.remove(), 1800);
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
  function sheetHeadEl2(it, url) {
    var _a;
    const box = document.createElement("div");
    box.innerHTML = sheetHeadHtml(it, url);
    return (_a = box.firstElementChild) != null ? _a : box;
  }
  function attachLongPress(sec, app) {
    sec.querySelectorAll(".m-grid .pcard").forEach((c) => {
      c.addEventListener("contextmenu", (ev) => ev.preventDefault());
      longPress(c, () => {
        const it = itemByKeyInState(c.dataset.cinemaKey);
        if (!it) return;
        openSheet(sec, it, app);
      });
    });
  }
  function openSheet(sec, it, app) {
    if (!sec.isConnected) return;
    openItemSheet(toItemActions(itemActions(it, sec, app)), {
      sheetClass: SHEET_SKIN,
      sheetHead: sheetHeadEl2(it, posterUrl(it, app))
    });
  }
  function openDetail(sec, it, app) {
    var _a, _b, _c;
    const url = posterUrl(it, app);
    const { el, close } = ovl(sec, detailModalHtml(it, url));
    mountIcons(el);
    (_a = el.querySelector(".j-edit")) == null ? void 0 : _a.addEventListener("click", () => {
      close();
      openForm(sec, it, app);
    });
    (_b = el.querySelector(".j-del")) == null ? void 0 : _b.addEventListener("click", () => {
      close();
      openConfirm(sec, it, app);
    });
    (_c = el.querySelector(".j-similar")) == null ? void 0 : _c.addEventListener("click", () => {
      close();
      void runSimilarRecommend(it, app);
    });
  }
  function openForm(sec, item, app, presetSt) {
    var _a, _b;
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
    const cur = { tag: initTag, st: initSt };
    el.querySelectorAll("[data-f-tag]").forEach((b) => b.addEventListener("click", () => {
      var _a2;
      cur.tag = (_a2 = b.dataset.fTag) != null ? _a2 : cur.tag;
      el.querySelectorAll("[data-f-tag]").forEach((x) => x.classList.toggle("is-on", x === b));
    }));
    el.querySelectorAll("[data-f-st]").forEach((b) => b.addEventListener("click", () => {
      var _a2;
      cur.st = (_a2 = b.dataset.fSt) != null ? _a2 : cur.st;
      el.querySelectorAll("[data-f-st]").forEach((x) => x.classList.toggle("is-on", x === b));
      const show = cur.st === "已看";
      el.querySelector(".j-rating").style.display = show ? "" : "none";
      el.querySelector(".j-review").style.display = show ? "" : "none";
    }));
    (_b = el.querySelector(".j-save")) == null ? void 0 : _b.addEventListener("click", () => {
      const name = el.querySelector(".j-name").value.trim();
      if (!name) {
        panelToast(sec, "请输入名称");
        return;
      }
      if (editing && item && name !== item.name && M.items.some((x) => x.name === name)) {
        panelToast(sec, "已存在同名影视，请换个名称");
        return;
      }
      if (!editing && M.items.some((x) => x.name === name)) {
        panelToast(sec, "已存在同名影视，请换个名称");
        return;
      }
      const stChanged = !editing || !item || item.status !== (cur.st === "想看" ? STATUS_WANT : cur.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED);
      const date = stChanged ? localNow() : item.watchDate || localNow();
      const rating = cur.st === "已看" ? parseFloat(el.querySelector(".j-range").value) : cur.st === "在看" ? 0 : null;
      const review = cur.st === "已看" ? el.querySelector(".j-review-t").value.trim() : "";
      if (editing && item) {
        void saveEdit(sec, item, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, close);
      } else {
        void saveNew(sec, { name, tag: cur.tag, st: cur.st, rating, date, review }, app, close);
      }
    });
  }
  async function saveNew(sec, p, app, close) {
    var _a;
    const group = (_a = getGroupForTag(p.tag)) != null ? _a : "其他";
    const st = p.st === "想看" ? STATUS_WANT : p.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
    const it = { file: null, name: p.name, typeTag: p.tag, group, status: st, rating: p.rating, watchDate: p.date, review: p.review, poster: null, genre: null, director: null, actors: null, region: null, year: null, doubanRating: null, doubanUrl: null, synopsis: null, duration: null, seasonText: null };
    try {
      if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
        panelToast(sec, "已存在同名影视，请换个名称");
        return;
      }
      M.items.unshift(it);
      await persistItem(it, app);
      emitDomainEvent("movie", { kind: "created", name: p.name, status: st === STATUS_WANT ? "want" : st === STATUS_WATCHING ? "watching" : "watched", rating: p.rating, review: p.review || null });
      if (it.file) enqueueDoubanFetch(it.file, it.name);
      close();
      panelToast(sec, `已添加「${p.name}」`);
      renderAll(app);
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
  async function saveEdit(sec, item, p, app, close) {
    var _a;
    const group = (_a = getGroupForTag(p.tag)) != null ? _a : "其他";
    const st = p.st === "想看" ? STATUS_WANT : p.st === "在看" ? STATUS_WATCHING : STATUS_WATCHED;
    const prev = { name: item.name, typeTag: item.typeTag, group: item.group, status: item.status, rating: item.rating, watchDate: item.watchDate, review: item.review };
    if (p.name !== item.name) {
      if (ILLEGAL_NAME_RE.test(p.name)) {
        notice('名称含非法字符（\\ / : * ? " < > |），请修改', "error");
        return;
      }
      if (app.vault.getAbstractFileByPath(`${M.folderPath}/《${p.name}》.md`)) {
        panelToast(sec, "已存在同名影视，请换个名称");
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
      close();
      panelToast(sec, `已保存「${p.name}」`);
      renderAll(app);
    } catch (e) {
      Object.assign(item, prev);
      notifySaveError(e);
      console.error(e);
    }
  }
  function openConfirm(sec, item, app) {
    var _a, _b;
    const { el, close } = ovl(sec, confirmModalHtml(item), { sticky: true });
    mountIcons(el);
    (_a = el.querySelector(".j-cancel")) == null ? void 0 : _a.addEventListener("click", close);
    (_b = el.querySelector(".j-del")) == null ? void 0 : _b.addEventListener("click", async () => {
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
      close();
      panelToast(sec, `已删除「${item.name}」`);
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
    return {
      items: M.items,
      list: getDisplayItems(),
      view: {
        view: M.view,
        typeFilter: M.typeFilter,
        statusFilter: M.statusFilter,
        sortMode: M.sortMode,
        searchKeyword: M.searchKeyword
      },
      cols: gridColumns(),
      title: listTitle(),
      watchedCount: watchedCount(),
      aiHtml: aiPageHtml(aiInput()),
      aiCount: M.aiResult && M.aiResult.length ? M.aiResult.length : null,
      statHtml: buildAnalysisHTML(),
      poster: (it) => posterUrl(it, app),
      fetching: (it) => {
        var _a;
        return isFetching((_a = it.file) == null ? void 0 : _a.path);
      }
    };
  }
  function onSearchInput(app, sec, isMob, raw) {
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
      return;
    }
    const cnt = head.querySelector(".j-cnt");
    if (cnt) cnt.textContent = `· ${list.length} 部`;
    const grid = body.querySelector(".grid");
    if (grid) grid.innerHTML = list.map((it) => {
      var _a;
      return pcardHtml(it, posterUrl(it, app), isFetching((_a = it.file) == null ? void 0 : _a.path));
    }).join("");
    mountIcons(sec);
  }
  function bindMidnight(sec, app) {
    sec.addEventListener("click", (e) => {
      var _a, _b, _c;
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
        renderAll(app);
        return;
      }
      const tool = t.closest(".j-tool");
      if (tool && tool.dataset.tool) {
        M.view = M.view === tool.dataset.tool ? "list" : tool.dataset.tool;
        renderAll(app);
        return;
      }
      const mb = t.closest(".j-mai,.j-mstat,.j-mclose");
      if (mb) {
        if (mb.classList.contains("j-mclose")) closeOverlay();
        else {
          const v = mb.classList.contains("j-mai") ? "ai" : "stat";
          M.view = M.view === v ? "list" : v;
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
          const s = (_b = railBtn.dataset.s) != null ? _b : null;
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
          const s = (_c = chip.dataset.s) != null ? _c : null;
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
        const it = itemByKeyInState(cardEl.dataset.cinemaKey);
        if (it) openDetail(sec, it, app);
      }
    });
    sec.addEventListener("contextmenu", (e) => {
      if (sec.classList.contains("mob")) return;
      const cardEl = e.target.closest(".pcard");
      if (!cardEl) return;
      e.preventDefault();
      const it = itemByKeyInState(cardEl.dataset.cinemaKey);
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
    M.renderFn = () => renderAll(app);
    const root = overlay.querySelector("[data-cinema-root]");
    if (!root) return;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    bindMidnight(root, app);
    root.addEventListener("input", (e) => {
      const t = e.target;
      if (t.classList.contains("j-q") || t.classList.contains("j-mq")) {
        onSearchInput(app, root, t.classList.contains("j-mq"), t.value);
      } else if (t.classList.contains("j-range")) {
        const out = root.querySelector(".j-rval");
        if (out) out.textContent = Number(t.value).toFixed(1);
      }
    });
    rebuildItems(app);
    renderAll(app);
  }
  function renderAll(app) {
    const overlay = M.currentOverlay;
    if (!overlay) return;
    const root = overlay.querySelector("[data-cinema-root]");
    if (!root) return;
    const inp = midnightInput(app);
    if (root.classList.contains("mob")) {
      renderMidnightMob(root, inp);
      attachLongPress(root, app);
    } else renderMidnightDesk(root, inp);
    mountIcons(root);
  }
  function closeOverlay() {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
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
        renderAll(app);
      }, 300);
    };
    onDomainEvent("cinema:file-created", (evt) => schedule({ path: evt.path }));
    onDomainEvent("cinema:file-deleted", (evt) => schedule({ path: evt.path }));
    onDomainEvent("cinema:file-modified", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-created", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-deleted", (evt) => schedule({ path: evt.path }));
    onDomainEvent("vault:md-modified", (evt) => schedule({ path: evt.path }));
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
  var SEED_MARK = "bz-sim:__cinema-seed-v1";
  var SETTINGS_KEY = "bz-sim:__settings";
  function one(v) {
    return String(v != null ? v : "").replace(/\s*\n+\s*/g, " ").trim();
  }
  function mdOf(raw) {
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
      `上映日期: ${one(raw.year)}`,
      `豆瓣评分: ${one(raw.doubanRating)}`,
      `豆瓣链接: ${one(raw.doubanUrl)}`,
      `简介: ${one(raw.synopsis)}`,
      `影评: ${one(raw.review)}`,
      "---",
      ""
    ].join("\n");
  }
  function seedDatabase() {
    const src = window.CINEMA_DATA || window.parent && window.parent.CINEMA_DATA || null;
    const items = src || [];
    if (localStorage.getItem(SEED_MARK)) return;
    const base = 17e11;
    const n = items.length;
    items.forEach((raw, i) => {
      if (!raw || !raw.name) return;
      seedVaultFile(`${FOLDER}/《${raw.name}》.md`, mdOf(raw), base + (n - i) * 1e3);
    });
    localStorage.setItem(SEED_MARK, (/* @__PURE__ */ new Date()).toISOString());
  }
  var settingsStore = {
    cinemaStyle: "midnight",
    cinemaFolderPath: FOLDER,
    cinemaSortMode: "date",
    cinemaStatusFilter: "",
    cinemaGridColumns: "5"
  };
  function injectSettings() {
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
