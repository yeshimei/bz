/* 源指纹 a64c94430641deef · 仓内输入 35 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/knowledge/fake-sim.ts","prototypes/knowledge/fake/ai-index.ts","prototypes/knowledge/fake/fake-obsidian.ts","src/core/ai.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/item-actions.ts","src/core/knowledge-boxes.ts","src/core/link-now.ts","src/core/mobile.ts","src/core/notice.ts","src/core/settings-provider.ts","src/core/storage.ts","src/core/ui/icons.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/utils.ts","src/core/z-order.ts","src/knowledge/data.ts","src/knowledge/mount-canvas.ts","src/knowledge/mount-data.ts","src/knowledge/mount-geom.ts","src/knowledge/mount-layout.ts","src/knowledge/mount-route.ts","src/knowledge/mount-suggest.ts","src/knowledge/note-gen.ts","src/knowledge/processor.ts","src/knowledge/range-bar.ts","src/knowledge/source.ts","src/knowledge/ui.ts","src/knowledge/video-meta.ts","src/secondbrain/readonly.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/knowledge/fake-sim.ts → window.BZW_knowledge（行为单源预览包，issue 245/ADR-0106） */
var BZW_knowledge = (() => {
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
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
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
              var args = [], arg, i, key2, argLen = arguments.length;
              for (i = 0; i < argLen; i++) {
                arg = "";
                if (typeof arguments[i] === "object") {
                  arg += "\n[" + i + "] ";
                  for (key2 in arguments[0]) {
                    if (hasOwnProp(arguments[0], key2)) {
                      arg += key2 + ": " + arguments[0][key2] + ", ";
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
        function calendar(key2, mom, now2) {
          var output = this._calendar[key2] || this._calendar["sameElse"];
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
        function longDateFormat(key2) {
          var format2 = this._longDateFormat[key2], formatUpper = this._longDateFormat[key2.toUpperCase()];
          if (format2 || !formatUpper) {
            return format2;
          }
          this._longDateFormat[key2] = formatUpper.match(formattingTokens).map(function(tok) {
            if (tok === "MMMM" || tok === "MM" || tok === "DD" || tok === "dddd") {
              return tok.slice(1);
            }
            return tok;
          }).join("");
          return this._longDateFormat[key2];
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
        function normalizeLocale(key2) {
          return key2 ? key2.toLowerCase().replace("_", "-") : key2;
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
        function getSetGlobalLocale(key2, values) {
          var data;
          if (key2) {
            if (isUndefined(values)) {
              data = getLocale(key2);
            } else {
              data = defineLocale(key2, values);
            }
            if (data) {
              globalLocale = data;
            } else {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  "Locale " + key2 + " not found. Did you forget to load it?"
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
        function getLocale(key2) {
          var locale2;
          if (key2 && key2._locale && key2._locale._abbr) {
            key2 = key2._locale._abbr;
          }
          if (!key2) {
            return globalLocale;
          }
          if (!isArray(key2)) {
            locale2 = loadLocale(key2);
            if (locale2) {
              return locale2;
            }
            key2 = [key2];
          }
          return chooseLocale(key2);
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
          var key2, unitHasDecimal = false, i, orderLen = ordering.length;
          for (key2 in m) {
            if (hasOwnProp(m, key2) && !(indexOf.call(ordering, key2) !== -1 && (m[key2] == null || !isNaN(m[key2])))) {
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
        function createDuration(input, key2) {
          var duration = input, match = null, sign2, ret, diffRes;
          if (isDuration(input)) {
            duration = {
              ms: input._milliseconds,
              d: input._days,
              M: input._months
            };
          } else if (isNumber(input) || !isNaN(+input)) {
            duration = {};
            if (key2) {
              duration[key2] = +input;
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
        function locale(key2) {
          var newLocaleData;
          if (key2 === void 0) {
            return this._locale._abbr;
          } else {
            newLocaleData = getLocale(key2);
            if (newLocaleData != null) {
              this._locale = newLocaleData;
            }
            return this;
          }
        }
        var lang = deprecate(
          "moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.",
          function(key2) {
            if (key2 === void 0) {
              return this.localeData();
            } else {
              return this.locale(key2);
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

  // prototypes/knowledge/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    boot: () => boot,
    bootKnowledgeSim: () => bootKnowledgeSim,
    loadDemoPlate: () => loadDemoPlate,
    openImage: () => openImage,
    openMountTree: () => openMountTree2,
    openPanel: () => openPanel,
    openPassage: () => openPassage,
    openTerm: () => openTerm,
    openVideo: () => openVideo,
    openVideoHistory: () => openVideoHistory,
    openVideoTasks: () => openVideoTasks
  });

  // prototypes/knowledge/fake/fake-obsidian.ts
  var import_moment = __toESM(require_moment());

  // prototypes/knowledge/fake/ai-index.ts
  var AI_INDEX = [
    { path: "卡片盒/睡眠卫生.md", keys: ["卫生", "作息", "咖啡因", "减光", "环境", "习惯", "固定", "睡前"], chunk: "固定作息、睡前减光、卧室只留睡眠功能、下午后不碰咖啡因。" },
    { path: "文献盒/睡眠日记.md", keys: ["日记", "记录", "两周", "入睡", "卧床", "效率", "上床"], chunk: "连续两周逐日记录上床时间、入睡耗时、夜醒次数、起床时间与白天困倦程度。" },
    { path: "文献盒/睡眠债.md", keys: ["债", "补觉", "不足", "白天", "熬夜", "欠", "补"], chunk: "睡眠债按「需要量减去实际量」逐日累加，单次补觉还不清。" },
    { path: "卡片盒/认知行为疗法.md", keys: ["失眠", "干预", "认知", "行为", "治疗", "焦虑", "疗法"], chunk: "通过改变认知与行为模式干预心理问题，CBTI 是其在失眠域的具体形态。" },
    { path: "卡片盒/多重记忆系统.md", keys: ["记忆", "陈述性", "程序性", "海马", "编码", "巩固"], chunk: "陈述性与程序性记忆分属不同系统，睡眠结构对记忆巩固有影响。" },
    { path: "文献盒/昼夜节律.md", keys: ["昼夜", "节律", "生物钟", "光照", "褪黑素", "时相", "晒光", "光"], chunk: "以约 24 小时为周期的内在计时机制，光照是最强的同步因子。" },
    { path: "文献盒/松果体.md", keys: ["褪黑素", "松果体", "激素", "夜间", "分泌"], chunk: "夜间分泌褪黑素，把光照信息转译为激素信号，是睡眠-觉醒节律的激素执行器。" },
    // 带标题 / 段落的邻居：定位官能给出 heading / paragraph 单元（`## 功能分工` + ` ^bz-3f7a1c02` 都在库里）
    { path: "文献盒/睡眠结构.md", keys: ["深睡", "REM", "周期", "分期", "功能", "恢复", "突触"], chunk: "深睡承担体力恢复与突触下调，REM 承担情绪加工与部分记忆整合，两者不能互相替代。" },
    { path: "文献盒/CBTI.md", keys: ["失眠", "睡眠限制", "刺激控制", "循证", "治疗", "床"], chunk: "非药物治疗失眠的循证心理干预，含睡眠限制、刺激控制、认知重构等模块。" },
    { path: "卡片盒/间隔重复.md", keys: ["间隔", "复习", "遗忘", "长期", "保持"], chunk: "按遗忘曲线安排复习间隔，用检索 effort 换长期保持。" }
  ];

  // prototypes/knowledge/fake/fake-obsidian.ts
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768
  };
  function setIcon(container, iconId) {
    var _a, _b;
    const d = typeof window !== "undefined" && (((_a = window.BZ_ICONS) == null ? void 0 : _a[iconId]) || ((_b = window.BZ_SP_ICONS) == null ? void 0 : _b[iconId])) || "";
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
  function suggestCanned(prompt) {
    if (/你是卡片盒挂载树的检索查询官/.test(prompt)) return cannedQuery(prompt);
    if (/你是卡片盒挂载树的采纳官/.test(prompt)) return cannedAdopt(prompt);
    if (/你是卡片盒挂载树的定位官/.test(prompt)) return cannedLocate(prompt);
    return null;
  }
  function plainText(s) {
    return String(s != null ? s : "").replace(/!?\[\[([^\[\]|]+)(?:\|([^\[\]]+))?\]\]/g, (_m, target, alias) => (alias || target).replace(/#\^?[^\]]*$/, "")).replace(/[*`>]/g, "").replace(/^[-•]\s*/gm, "").replace(/\s+/g, " ").trim();
  }
  function cannedQuery(prompt) {
    const segs = [...prompt.matchAll(/^### s(\d+)：(.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }));
    const items = segs.map((s) => {
      var _a;
      const plain = plainText(s.text);
      const first = (_a = plain.split(/[。！？；]/)[0]) != null ? _a : plain;
      const sentence = (first.length > 40 ? `${first.slice(0, 39)}…` : first) || plain.slice(0, 40);
      const lower = plain.toLowerCase();
      const keys = AI_INDEX.flatMap((it) => it.keys).filter((k) => lower.includes(k.toLowerCase()));
      return {
        seg: s.n,
        sentence: /[。！？]$/.test(sentence) ? sentence : `${sentence}。`,
        keywords: [...new Set(keys)].slice(0, 5).join(" "),
        why: `这一段在讲「${sentence.slice(0, 18)}」`
      };
    });
    return JSON.stringify(items);
  }
  function ngramOverlap(a, b) {
    const grams = (s) => {
      const t = plainText(s).replace(/\s+/g, "");
      const out = /* @__PURE__ */ new Set();
      for (let i = 0; i + 1 < t.length; i++) out.add(t.slice(i, i + 2));
      return out;
    };
    const ga = grams(a);
    const gb = grams(b);
    let hit = 0;
    for (const g of ga) if (gb.has(g)) hit++;
    return hit;
  }
  function cannedAdopt(prompt) {
    const segs = [...prompt.matchAll(/^### s(\d+)：(.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2] }));
    const cands = [...prompt.matchAll(/^- c\d+：(.*?)（(.+?)）命中 (\d+) 次 · 最高分 ([\d.]+)｜片段 ([^\n]*)$/gm)].map((m) => {
      var _a, _b;
      return {
        name: m[1].trim(),
        path: m[2].trim(),
        hits: Number(m[3]),
        score: Number(m[4]),
        segs: [...m[5].matchAll(/s(\d+)/g)].map((x) => Number(x[1])),
        chunk: (_b = (_a = m[5].split("｜").pop()) == null ? void 0 : _a.trim()) != null ? _b : ""
      };
    });
    const ranked = cands.slice().sort((a, b) => b.score - a.score || b.hits - a.hits || a.path.localeCompare(b.path));
    const used = /* @__PURE__ */ new Set();
    const out = [];
    for (const c of ranked) {
      if (out.length >= 3) break;
      const pool = (c.segs.length ? c.segs : segs.map((s) => s.n)).filter((n) => !used.has(n));
      if (!pool.length) continue;
      let best = pool[0];
      let bestHit = -1;
      for (const n of pool) {
        const seg = segs.find((s) => s.n === n);
        if (!seg) continue;
        const hit = ngramOverlap(seg.text, `${c.name} ${c.chunk}`);
        if (hit > bestHit) {
          bestHit = hit;
          best = n;
        }
      }
      used.add(best);
      out.push({
        seg: best,
        path: c.path,
        score: Math.min(0.95, Math.max(0.75, c.score)),
        reason: `这一段与《${c.name}》讲的是同一件事（召回命中 ${c.hits} 次）`
      });
    }
    return JSON.stringify(out.sort((a, b) => a.seg - b.seg));
  }
  function cannedLocate(prompt) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const parts = prompt.split(/^## n(\d+) · .*$/gm);
    const out = [];
    for (let i = 1; i < parts.length; i += 2) {
      const n = Number(parts[i]);
      const block = (_a = parts[i + 1]) != null ? _a : "";
      const anchor = ((_c = (_b = /^主卡锚点原文：(.*)$/m.exec(block)) == null ? void 0 : _b[1]) != null ? _c : "").trim();
      const body = (_d = block.split("### 目标笔记全文")[1]) != null ? _d : "";
      const heading = ((_f = (_e = /^#{1,6}[ \t]+(.+)$/m.exec(body)) == null ? void 0 : _e[1]) != null ? _f : "").trim();
      const para = ((_h = (_g = /^（\d+）(.+)$/m.exec(body)) == null ? void 0 : _g[1]) != null ? _h : "").trim();
      const idx = out.length;
      const unit = idx === 0 ? "whole" : heading ? "heading" : para ? "paragraph" : "whole";
      out.push({
        n,
        unit,
        heading: unit === "heading" ? heading : "",
        quote: unit === "paragraph" ? para.slice(0, 60) : "",
        anchor,
        reason: unit === "heading" ? `只有「${heading}」这一节与主卡相关` : unit === "paragraph" ? "目标笔记里这一段与主卡直接呼应" : "整篇都与主卡同一主题",
        skip: false
      });
    }
    return JSON.stringify(out);
  }
  async function requestUrl(opts) {
    var _a, _b, _c, _d, _e, _f, _g;
    const url = String((_a = opts == null ? void 0 : opts.url) != null ? _a : "");
    if (/^https:\/\/(www\.)?b23\.tv\//.test(url)) {
      return {
        status: 200,
        text: '<html><head><title>（演示）短链落地页_哔哩哔哩_bilibili</title><meta property="og:url" content="https://www.bilibili.com/video/BV1awbg6XELn/"></head><body><script>window.__INITIAL_STATE__=' + JSON.stringify({
          videoData: {
            bvid: "BV1awbg6XELn",
            title: "（演示）短链落地页",
            owner: { name: "短链 UP 主" },
            duration: 1800,
            pages: [
              { cid: 1, page: 1, part: "上集 · 开场", duration: 720 },
              { cid: 2, page: 2, part: "中集 · 展开", duration: 600 },
              { cid: 3, page: 3, part: "下集 · 收尾", duration: 480 }
            ]
          }
        }) + ";(function(){})();<\/script></body></html>"
      };
    }
    const view = /web-interface\/view\?bvid=(BV[0-9A-Za-z]{10})/.exec(url);
    if (view) {
      return {
        status: 200,
        text: JSON.stringify({
          code: 0,
          message: "0",
          data: {
            bvid: view[1],
            title: `（演示标题）${view[1]}：一条可回放的 B 站视频`,
            owner: { mid: 42, name: "演示 UP 主" },
            duration: 1800,
            pages: [
              { cid: 1, page: 1, part: "上集 · 开场", duration: 720 },
              { cid: 2, page: 2, part: "中集 · 展开", duration: 600 },
              { cid: 3, page: 3, part: "下集 · 收尾", duration: 480 }
            ]
          }
        })
      };
    }
    if (!/chat\/completions/.test(url)) throw new Error("原型环境无网络请求（fake obsidian requestUrl）");
    let prompt = "";
    let imgCount = 0;
    let imgChars = 0;
    try {
      const body = JSON.parse(String((_b = opts == null ? void 0 : opts.body) != null ? _b : "{}"));
      const texts = [];
      for (const m of body.messages || []) {
        const c = m == null ? void 0 : m.content;
        if (typeof c === "string") {
          texts.push(c);
          continue;
        }
        if (!Array.isArray(c)) continue;
        for (const part of c) {
          const p = part;
          if (!p) continue;
          if (p.type === "text") texts.push(String((_c = p.text) != null ? _c : ""));
          else if (p.type === "image_url") {
            imgCount++;
            imgChars += String((_e = (_d = p.image_url) == null ? void 0 : _d.url) != null ? _e : "").length;
          }
        }
      }
      prompt = texts.join("\n");
    } catch (e) {
    }
    let content;
    const suggest = suggestCanned(prompt);
    const passage = /把下方这段文字整理成一篇文献笔记/.exec(prompt);
    const term = /为术语「([^」]+)」生成一篇文献笔记/.exec(prompt);
    const img = /看这张图片|看下面这 \d+ 张图片/.exec(prompt);
    if (suggest !== null) {
      content = suggest;
    } else if (img) {
      const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
      const domain = domains ? domains[1].split("、")[0] : "艺术";
      const multi = imgCount > 1;
      content = JSON.stringify({
        title: `（演示图题）${multi ? `${imgCount} 张图` : "一张图"}的内容整理`,
        summary: `（演示读图）已收到图片（${imgCount} 张，base64 ${imgChars} 字符）——这里回放的是图版录入的读图结果，用于评审拖图 / 粘贴 / 多图、自动图题与关联行；图片本体在确认写入时落进图片目录（默认文献目录下的 assets/，可在设置里改）。`,
        domain
      });
    } else if (passage) {
      const src = ((_g = (_f = /【原文】\n([\s\S]+)/.exec(prompt)) == null ? void 0 : _f[1]) != null ? _g : "").replace(/\s+/g, " ").trim();
      const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
      const domain = domains ? domains[1].split("、")[0] : "心理";
      content = JSON.stringify({
        title: `（演示标题）${src.slice(0, 14)}${src.length > 14 ? "…" : ""}的要点整理`,
        summary: `（演示整理）${src.slice(0, 120)}……原型环境由 fake AI 罐头回放生成，用于评审段落录入、自动标题与关联行交互。`,
        domain
      });
    } else if (term) {
      const domains = /从以下领域选一个最贴近的：([^；」]+)/.exec(prompt);
      const domain = domains ? domains[1].split("、")[0] : "心理";
      content = JSON.stringify({
        summary: `（演示简介）${term[1]}：一段百科式介绍——定义、核心要点与必要背景。原型环境由 fake AI 罐头回放生成，用于评审术语录入、来源行与词典皮交互，内容本身不代表真实生成质量。`,
        domain
      });
    } else if (prompt.includes("压缩成更精简")) {
      const src = /【原文】\n([\s\S]+)/.exec(prompt);
      content = `（演示总结）${(src ? src[1] : "").replace(/\s+/g, "").slice(0, 60)}……`;
    } else if (prompt.includes("所属的领域")) {
      content = JSON.stringify({ domain: "心理" });
    } else {
      throw new Error("原型环境无网络请求（fake obsidian requestUrl：未识别的 AI 调用）");
    }
    return { status: 200, text: JSON.stringify({ choices: [{ message: { content } }] }) };
  }
  var MarkdownRenderer = class {
    /** 演示级 Markdown 渲染：视频 ![[mp4]] 内嵌为可播放 <video>（统一映射壳内 demo 片段）+ 基础排版 */
    static async render(_app2, markdown, el, _sourcePath, _component) {
      const md = String(markdown != null ? markdown : "");
      const esc2 = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      const inline = (s) => {
        let t = esc2(s);
        t = t.replace(/!\[\[([^\]]+)\]\]/g, (_m, p1) => {
          if (/\.(mp4|webm|mkv)$/i.test(p1)) return '<video controls preload="metadata" src="./assets/demo.mp4"></video>';
          const url = fakeResourceUrl(p1);
          if (url) return `<img class="bz-kb-embed-img" src="${url}" alt="">`;
          return `<span class="bz-kb-cite">${p1}</span>`;
        });
        t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, p1, p2) => `<span class="bz-kb-cite">${p2 || p1}</span>`);
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
        return t;
      };
      const out = [];
      let list = null;
      const closeList = () => {
        if (list) {
          out.push(`</${list}>`);
          list = null;
        }
      };
      for (const rawLine of md.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) {
          closeList();
          continue;
        }
        const fullEmbed = /^!\[\[([^\]]+)\]\]$/.exec(line);
        if (fullEmbed) {
          closeList();
          if (/\.(mp4|webm|mkv)$/i.test(fullEmbed[1])) {
            out.push('<video controls preload="metadata" src="./assets/demo.mp4"></video>');
          } else {
            const imgUrl = fakeResourceUrl(fullEmbed[1]);
            if (imgUrl) out.push(`<p><img class="bz-kb-embed-img" src="${imgUrl}" alt=""></p>`);
            else out.push(`<p><span class="bz-kb-cite">${esc2(fullEmbed[1])}</span></p>`);
          }
          continue;
        }
        const h = /^(#{1,3})\s+(.*)$/.exec(line);
        if (h) {
          closeList();
          out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
          continue;
        }
        if (/^>\s?/.test(line)) {
          closeList();
          out.push(`<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`);
          continue;
        }
        const ul = /^[-*]\s+(.*)$/.exec(line);
        if (ul) {
          if (list !== "ul") {
            closeList();
            out.push("<ul>");
            list = "ul";
          }
          out.push(`<li>${inline(ul[1])}</li>`);
          continue;
        }
        const ol = /^\d+[.、]\s+(.*)$/.exec(line);
        if (ol) {
          if (list !== "ol") {
            closeList();
            out.push("<ol>");
            list = "ol";
          }
          out.push(`<li>${inline(ol[1])}</li>`);
          continue;
        }
        if (line === "---") {
          closeList();
          out.push("<hr>");
          continue;
        }
        closeList();
        out.push(`<p>${inline(line)}</p>`);
      }
      closeList();
      const tpl = document.createElement("template");
      tpl.innerHTML = out.join("\n");
      el.appendChild(tpl.content);
    }
  };
  var Component = class {
    load() {
    }
    unload() {
    }
  };
  var KEY_PREFIX = "bz-sim:";
  function encodeSeedFile(content, stat) {
    var _a, _b, _c;
    const now = Date.now();
    const env = { c: content, ct: (_a = stat == null ? void 0 : stat.ctime) != null ? _a : now, mt: (_c = (_b = stat == null ? void 0 : stat.mtime) != null ? _b : stat == null ? void 0 : stat.ctime) != null ? _c : now };
    return JSON.stringify(env);
  }
  function fakeFileContent(path) {
    const raw = localStorage.getItem(KEY_PREFIX + path);
    if (raw == null) return "";
    try {
      const env = JSON.parse(raw);
      if (env && typeof env === "object" && typeof env.c === "string") return env.c;
    } catch (e) {
    }
    return raw;
  }
  function fakeResourceUrl(path) {
    const v = fakeFileContent(path);
    return /^data:image\//i.test(v) ? v : "";
  }
  function bytesToBase64(u8) {
    let bin = "";
    const CHUNK = 32768;
    for (let i = 0; i < u8.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
    }
    return btoa(bin);
  }
  var FakeVault = class _FakeVault {
    constructor() {
      this.adapter = {
        /** writeUniqueNote 建目录守卫：目录下任一文件存在（或自身是文件）即视为存在 */
        exists: async (path) => {
          const clean = String(path).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
          if (!clean) return true;
          if (localStorage.getItem(_FakeVault.key(clean)) != null) return true;
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(`${_FakeVault.key(clean)}/`)) return true;
          }
          return false;
        }
      };
    }
    static key(path) {
      return KEY_PREFIX + path;
    }
    getResourcePath(file) {
      var _a;
      const path = typeof file === "string" ? file : String((_a = file == null ? void 0 : file.path) != null ? _a : "");
      return path ? fakeResourceUrl(path) : "";
    }
    /** 二进制落盘（图版 issue 312）：壳里存成 data URL，getResourcePath / MarkdownRenderer 直接可用 */
    async createBinary(path, data) {
      var _a;
      const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      const ext = ((_a = String(path).split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "png"}`;
      const raw = encodeSeedFile(`data:${mime};base64,${bytesToBase64(u8)}`);
      localStorage.setItem(KEY_PREFIX + path, raw);
      return this.toFile(path, raw);
    }
    /** localStorage 封套 → FakeFile（内容内藏，read 吐 content） */
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
    getFiles() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(KEY_PREFIX)) continue;
        const path = k.slice(KEY_PREFIX.length);
        if (!path || path.split("/").some((seg) => seg.startsWith("."))) continue;
        out.push(this.toFile(path, localStorage.getItem(k)));
      }
      return out;
    }
    getMarkdownFiles() {
      return this.getFiles().filter((f) => f.extension === "md");
    }
    async read(f) {
      return f.content;
    }
    async modify(f, content) {
      f.content = content;
      localStorage.setItem(_FakeVault.key(f.path), encodeSeedFile(content, f.stat));
    }
    async create(path, content) {
      localStorage.setItem(_FakeVault.key(path), encodeSeedFile(content));
      return this.toFile(path, encodeSeedFile(content));
    }
    async createFolder(_path) {
      return void 0;
    }
    /** 落卡建目录守卫用（saveCard：不存在则 createFolder）——localStorage 视目录恒存在 */
    getFolderByPath(_path) {
      return null;
    }
  };
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
      const key2 = kv[1].trim();
      const rawVal = kv[2].trim();
      lastKey = key2;
      if (rawVal === "") {
        fm[key2] = [];
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        fm[key2] = rawVal.slice(1, -1).split(",").map((s) => strip(s)).filter(Boolean);
      } else {
        fm[key2] = strip(rawVal);
      }
    }
    return fm;
  }
  var FakeMetadataCache = class {
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
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
      this.metadataCache = new FakeMetadataCache();
      this.workspace = {
        getLeaf: () => ({
          openFile: async (f) => {
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("bz-sim:open-file", { detail: f }));
          }
        })
      };
    }
    openUrl(url) {
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener");
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

  // src/core/link-now.ts
  var _bridge = null;
  function setLinkBridge(bridge) {
    _bridge = bridge;
  }
  function getLinkBridge() {
    return _bridge;
  }

  // src/secondbrain/readonly.ts
  var source = null;
  function setVectorSearchSource(s) {
    source = s;
  }
  function exportVectorSearch() {
    return source;
  }

  // src/core/settings-provider.ts
  var _provider = null;
  function setSettingsProvider(fn) {
    _provider = fn;
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
      // Coding 套餐（Lite/Pro/Max）额度只在 coding 专用端点生效；走标准 paas/v4 会按量计费报余额不足
      id: "zhipu-plan",
      label: "智谱 Plan",
      endpoint: "https://open.bigmodel.cn/api/coding/paas/v4",
      model: "glm-5.3-flash",
      defaultMaxTokens: 8192,
      defaultContextWindow: 131072,
      apiKeyKey: "zhipuPlanApiKey",
      apiKeyLabel: "智谱 Plan 密钥",
      apiKeyDesc: "智谱 Coding 套餐专用端点，密钥与智谱开放平台相同"
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
    const key2 = s[desc.apiKeyKey];
    if (!key2 && name === "deepseek") {
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
    if (!key2 && name !== "ollama") {
      throw new Error(`未配置 ${desc.label} API Key：插件设置 → AI 配置 → ${desc.apiKeyLabel}`);
    }
    const overrideModel = (_a = s.aiModelOverrides) == null ? void 0 : _a[name];
    const overrideContext = (_b = s.aiContextOverrides) == null ? void 0 : _b[name];
    const overrideMaxTokens = (_c = s.aiMaxTokensOverrides) == null ? void 0 : _c[name];
    return cachePut({
      endpoint: desc.endpoint,
      apiKey: key2 || "",
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
  var AI_IMAGE_MIME = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp"
  };
  var AI_IMAGE_MAX_BYTES = 32 * 1024 * 1024;
  function imageMimeOfPath(path) {
    var _a;
    const ext = ((_a = String(path || "").split(".").pop()) == null ? void 0 : _a.toLowerCase()) || "";
    return AI_IMAGE_MIME[ext] || null;
  }
  function imageExtOfMime(mime) {
    const m = String(mime || "").toLowerCase();
    for (const [ext, known] of Object.entries(AI_IMAGE_MIME)) {
      if (known === m && ext !== "jpeg") return ext;
    }
    return null;
  }
  function imageDataUrl(bytes, mime) {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (u8.byteLength === 0) throw new Error("图片内容为空");
    if (u8.byteLength > AI_IMAGE_MAX_BYTES) {
      throw new Error(`图片过大（${Math.round(u8.byteLength / 1024 / 1024)} MiB），上限 ${AI_IMAGE_MAX_BYTES / 1024 / 1024} MiB`);
    }
    let bin = "";
    const CHUNK = 32768;
    for (let i = 0; i < u8.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
    }
    return `data:${mime};base64,${btoa(bin)}`;
  }
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
  var AIService = class {
    constructor(params, defaultModel = "deepseek-v4-flash", defaultOptions = {}) {
      this.defaultModel = defaultModel;
      this.defaultOptions = defaultOptions;
    }
    /** 通用 AI 请求（fetch 流式，失败自动 fallback requestUrl 非流式）；
     *  input 为字符串（纯文本，报文同旧版）或 {text, images}（带图 → 多模态 content 数组）；
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
      const effMaxTokens = (_a = mo.max_tokens) != null ? _a : provider.defaultMaxTokens || 4096;
      const body = {
        model: effModel,
        messages: [{ role: "user", content: buildUserContent(input) }],
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
    /** 普通对话模型（deepseek-v4-flash；收纯文本或 {text, images}） */
    async chat(input, extraOptions = {}) {
      return this.prompt(input, "deepseek-v4-flash", extraOptions);
    }
    /** 推理模型，自动开启思考模式 */
    async reason(input, extraOptions = {}) {
      const options = this._prepareOptions(extraOptions, { enable_thinking: true });
      return this.prompt(input, "deepseek-v4-flash", options);
    }
    /** 联网搜索（实验性，第三方代理平台生效） */
    async search(input, extraOptions = {}) {
      const options = this._prepareOptions(extraOptions, { search: true });
      return this.prompt(input, "deepseek-v4-flash", options);
    }
    /** 要求 AI 返回 JSON 格式（设置 response_format；知识盒等域走这条，故同样要能吃图） */
    async json(input, extraOptions = {}) {
      const options = this._prepareOptions(extraOptions, {
        response_format: { type: "json_object" }
      });
      return this.prompt(input, "deepseek-v4-flash", options);
    }
    /** 思考 + 联网搜索（实验性） */
    async reasonAndSearch(input, extraOptions = {}) {
      const options = this._prepareOptions(extraOptions, {
        enable_thinking: true,
        search: true
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

  // src/knowledge/data.ts
  var import_moment3 = __toESM(require_moment());

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
  function noticePref(key2) {
    var _a;
    try {
      const v = (_a = tryGetSettings()) == null ? void 0 : _a[key2];
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
    if (explicitDuration === void 0 && durationGear().persistent) return;
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
    if (suppressedByLevel(kind, opts)) return noopHandle();
    const isProgress = kind === "progress";
    const type = isProgress ? "info" : kind;
    const variant = opts && opts.variant || defaultVariant();
    const container = ensureContainer();
    applyPositionClass(container);
    if (opts && opts.dedupeKey) {
      const key2 = opts.dedupeKey;
      const r = recent[key2];
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
      recent[key2] = { at: now, n: null };
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

  // src/core/storage.ts
  function storageDir() {
    const s = tryGetSettings();
    return (s && s.storagePath || "CONFIG/STORAGE").trim().replace(/\/+$/, "");
  }
  function storageFile(name, base) {
    const dir = (base || storageDir()).trim().replace(/\/+$/, "");
    return `${dir}/${name}`;
  }
  var fileTaskQueues = /* @__PURE__ */ new Map();
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
  var CORRUPT_BACKUP_DIR = "CONFIG/.CORRUPT";
  var CORRUPT_NOTIFY_DEDUPE_MS = 3e4;
  var corruptNotifyAt = /* @__PURE__ */ new Map();
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

  // src/core/utils.ts
  var import_moment2 = __toESM(require_moment());
  function escapeHtml(str2) {
    return str2.replace(/[&<>"']/g, (m) => {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return "&#39;";
    });
  }
  function generateId(prefix) {
    prefix = prefix || "item";
    return prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
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
  async function fetchPageTitle(url) {
    try {
      const r = await requestUrl({
        url,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (r.status === 200) {
        const m = r.text.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (m && m[1]) return m[1].trim();
      }
    } catch (e) {
    }
    return null;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }
  function isUnderFolder(folder, path) {
    const f = (folder || "").trim().replace(/\/+$/, "");
    if (!f) return false;
    return path === f || path.startsWith(f + "/");
  }
  function hash31(str2) {
    let h = 0;
    const t = String(str2 || "");
    for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
    return h >>> 0;
  }

  // src/knowledge/source.ts
  function noteSourceName(path, name) {
    const explicit = String(name != null ? name : "").trim();
    if (explicit) return explicit;
    const base = String(path != null ? path : "").replace(/\\/g, "/").split("/").pop() || "";
    return stripMdExt(base) || String(path != null ? path : "");
  }
  var URL_LIKE_RE = /^(?:[\w-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/;
  function isUrlLikeSourceText(text) {
    const s = String(text != null ? text : "").trim();
    if (!s || /\s/.test(s)) return false;
    if (/^https?:\/\/\S+$/i.test(s)) return true;
    return URL_LIKE_RE.test(s);
  }
  function cleanUrlText(text) {
    return String(text != null ? text : "").trim().replace(/[，。！？；、,;.!?…'"’”\])}>】」』]+$/, "");
  }
  var TRACK_KEYS = /* @__PURE__ */ new Set([
    "vd_source",
    "vd_src",
    "seid",
    "unique_k",
    "from",
    "share_source",
    "share_medium",
    "share_token",
    "share_plat",
    "share_to",
    "share_from",
    "share_times",
    "gcid",
    "refer",
    "scene"
  ]);
  function normalizeSourceUrl(input) {
    const s = cleanUrlText(input);
    const m = s.match(/^(https?:\/\/)([^/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
    if (!m) return s;
    const [, scheme, host, path, query, hash] = m;
    const bare = host.toLowerCase().replace(/^www\./, "");
    if (bare === "b23.tv") return scheme + host + path;
    if (bare.endsWith("bilibili.com") && /^\/video\//.test(path)) {
      const keep = (query != null ? query : "").slice(1).split("&").filter((kv) => /^(p|t)=/.test(kv));
      return scheme + host + path + (keep.length ? "?" + keep.join("&") : "");
    }
    if (!query) return s;
    const kept = query.slice(1).split("&").filter(Boolean).filter((kv) => {
      const k = kv.split("=")[0].toLowerCase();
      return !k.startsWith("utm_") && !k.startsWith("spm_") && !TRACK_KEYS.has(k);
    });
    return scheme + host + path + (kept.length ? "?" + kept.join("&") : "") + (hash != null ? hash : "");
  }
  function canonicalVideoUrl(bvid) {
    return `https://www.bilibili.com/video/${String(bvid != null ? bvid : "").trim()}/`;
  }
  function decodeHtmlEntities(s) {
    return s.replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'").replace(/&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&");
  }
  function cleanSourceTitle(raw) {
    let t = decodeHtmlEntities(String(raw != null ? raw : "")).replace(/\s+/g, " ").trim();
    t = t.replace(/\s*[_\-–—|｜]\s*哔哩哔哩(?:_bilibili)?\s*$/i, "");
    t = t.replace(/\s*[_\-–—|｜]\s*bilibili\s*$/i, "");
    t = t.replace(/\s*[-–—|｜]\s*知乎(?:日报|专栏)?\s*$/, "");
    return t.trim();
  }
  function serializeTermSource(src) {
    var _a;
    if (!src) return null;
    if (src.kind === "external") {
      const url = normalizeSourceUrl(src.url);
      if (!url) return null;
      const out = { source: url };
      const title = src.title ? cleanSourceTitle(src.title) : "";
      if (title) out.sourceTitle = title;
      return out;
    }
    const path = String((_a = src.path) != null ? _a : "").trim();
    if (!path) return null;
    const name = noteSourceName(path, src.name);
    return { source: `[[${path}|${name}]]` };
  }
  function quoteYaml(s) {
    return '"' + String(s != null ? s : "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  }

  // src/knowledge/data.ts
  var TIME_RE = /^\d{1,3}:\d{1,2}(:\d{1,2}(\.\d{1,3})?)?$/;
  function normalizeLooseTime(t) {
    const s = (t != null ? t : "").trim();
    if (!s) return "";
    if (TIME_RE.test(s)) return s;
    const parts = s.split(/[:：.。\-—_、，,\s]+/).filter(Boolean);
    if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
    const [a, b, c] = parts;
    let canon;
    if (c !== void 0) canon = `${a}:${b.padStart(2, "0")}:${c.padStart(2, "0")}`;
    else if (b !== void 0) canon = `${a}:${b.padStart(2, "0")}`;
    else canon = `${a}:00`;
    return TIME_RE.test(canon) ? canon : null;
  }
  function normalizeUrl(raw) {
    return normalizeSourceUrl(cleanUrlText(raw));
  }
  function secToTimeText(sec) {
    const s = Number.isFinite(Number(sec)) && Number(sec) > 0 ? Math.round(Number(sec)) : 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const ss = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
  }
  function timeTextToSec(t) {
    const canon = normalizeLooseTime(t);
    if (!canon) return null;
    const parts = canon.split(":").map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    if (parts.length === 3) return Math.round(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    if (parts.length === 2) return Math.round(parts[0] * 60 + parts[1]);
    return Math.round(parts[0]);
  }
  var KnowledgeData = {
    filePath: "",
    _store: null,
    /** 旧数据文件 literature.json → knowledge.json 一次性迁移（ADR-0112：只复制不改写，旧文件保留在原处） */
    _legacyMigrated: false,
    /** 初始化（幂等）：固化文件路径与 store。未调用时 read/write 按当前设置惰性补齐（统一数据读写重构） */
    init(settings) {
      const folder = (settings.storagePath || "CONFIG/STORAGE").trim().replace(/\/+$/, "");
      this.filePath = folder + "/knowledge.json";
      this._store = jsonFileStore(this.filePath);
    },
    /** 一次性迁移：knowledge.json 不存在而 literature.json 存在时原样复制一份（任务历史零丢失，ADR-0112） */
    async migrateLegacy() {
      if (this._legacyMigrated) return;
      this._legacyMigrated = true;
      try {
        const app = getApp();
        if (app.vault.getAbstractFileByPath(this.filePath)) return;
        const legacyPath = this.filePath.replace(/knowledge\.json$/, "literature.json");
        const legacy = app.vault.getAbstractFileByPath(legacyPath);
        if (legacy) await app.vault.create(this.filePath, await app.vault.read(legacy));
      } catch (e) {
      }
    },
    /** 惰性 store 获取：init 前调用时按当前设置补建（消除 init 前 _store 空指针） */
    _ensureStore() {
      var _a;
      if (!this._store) this.init({ storagePath: (_a = tryGetSettings()) == null ? void 0 : _a.storagePath });
      return this._store;
    },
    /**
     * 读整表（形状兜底，issue 310）：文件被手改/旧格式写成非数组时按空库读取——
     * 不兜底的话 `data.push is not a function` 会直接打断面板刷新与保存（用户实测踩到）。
     * 读取本身不改盘；但 loadTasks/增删改都走 `_mutate`（读→改→写），首次调用即把文件收敛回数组形状。
     */
    async read() {
      const data = await this._ensureStore().read();
      return Array.isArray(data) ? data : [];
    },
    async write(data) {
      return this._ensureStore().write(data);
    },
    /** 读改写事务：fn 基于磁盘现值改动，整体入 per-path 串行队列（D3 原语 1） */
    async _mutate(fn) {
      return enqueueFileTask(this.filePath, async () => {
        const data = await this.read();
        const result = await fn(data);
        await this.write(data);
        return result;
      });
    },
    /** 全量读取并统一字段形状（缺省补默认值，旧/手改数据零迁移） */
    async loadTasks() {
      await this.migrateLegacy();
      return this._mutate(async (raw) => {
        let needWrite = false;
        const tasks = raw.map((item) => {
          if (!item.id) {
            item.id = generateId("knowledge-task");
            needWrite = true;
          }
          return {
            id: item.id,
            url: item.url || "",
            start: item.start || null,
            end: item.end || null,
            status: item.status || "pending",
            reason: item.reason || null,
            remark: item.remark || null,
            notePath: item.notePath || null,
            videoPath: item.videoPath || null,
            created: item.created || (0, import_moment3.default)().format("YYYY-MM-DD HH:mm:ss"),
            processedAt: item.processedAt || null,
            title: item.title || null,
            uploader: item.uploader || null,
            archived: item.archived === true,
            archivedAt: item.archivedAt || null,
            quality: item.quality || null,
            page: Number.isInteger(item.page) && Number(item.page) > 0 ? Number(item.page) : null,
            duration: Number.isFinite(Number(item.duration)) && Number(item.duration) > 0 ? Math.round(Number(item.duration)) : null
          };
        });
        if (needWrite) await this.write(raw);
        return tasks;
      });
    },
    /** 追加一条待处理任务（队列尾 = 处理顺序尾） */
    addTask(input) {
      var _a, _b, _c, _d, _e;
      const task = {
        id: generateId("knowledge-task"),
        url: normalizeUrl(input.url),
        start: ((_a = input.start) == null ? void 0 : _a.trim()) || null,
        end: ((_b = input.end) == null ? void 0 : _b.trim()) || null,
        status: "pending",
        reason: null,
        remark: ((_c = input.remark) == null ? void 0 : _c.trim()) || null,
        title: ((_d = input.title) == null ? void 0 : _d.trim()) || null,
        uploader: ((_e = input.uploader) == null ? void 0 : _e.trim()) || null,
        notePath: null,
        videoPath: null,
        created: (0, import_moment3.default)().format("YYYY-MM-DD HH:mm:ss"),
        processedAt: null,
        archived: false,
        archivedAt: null,
        quality: input.quality || null,
        page: Number.isInteger(input.page) && Number(input.page) > 0 ? Number(input.page) : null,
        duration: Number.isFinite(Number(input.duration)) && Number(input.duration) > 0 ? Math.round(Number(input.duration)) : null
      };
      return this._mutate((data) => {
        data.push(task);
        return task;
      });
    },
    updateTask(id, patch) {
      return this._mutate(async (data) => {
        const idx = data.findIndex((d) => d.id === id);
        if (idx === -1) throw new Error("任务不存在");
        data[idx] = { ...data[idx], ...patch, id: data[idx].id };
      }).then(() => void 0);
    },
    async deleteTask(id) {
      await this._mutate((data) => {
        const idx = data.findIndex((d) => d.id === id);
        if (idx !== -1) data.splice(idx, 1);
      });
    },
    /** 重试：失败/中止项回到待处理（保留旧结果字段，下次成功覆盖） */
    async retryTask(id) {
      await this.updateTask(id, {
        status: "pending",
        reason: null,
        processedAt: null
      });
    },
    /** 清空历史（archived 条目；主列表待处理/失败项不受影响，ADR-0067） */
    async clearHistory() {
      await this._mutate((data) => {
        for (let i = data.length - 1; i >= 0; i--) {
          if (data[i].archived === true) data.splice(i, 1);
        }
      });
    }
  };

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }

  // src/core/knowledge-boxes.ts
  var DEFAULT_LIT_DIR = "文献盒";
  var DEFAULT_CARDBOX_DIR = "卡片盒";
  var DEFAULT_TOPIC_DIR = "主题盒";
  function normalizeBoxDir(raw, fallback) {
    const s = String(raw != null ? raw : "").replace(/\\/g, "/").trim().replace(/^\/+|\/+$/g, "");
    return s || fallback;
  }
  function getKnowledgeBoxes(s) {
    var _a;
    const st = (_a = s != null ? s : tryGetSettings()) != null ? _a : {};
    return {
      lit: normalizeBoxDir(st.knowledgeDirectory, DEFAULT_LIT_DIR),
      cardbox: normalizeBoxDir(st.knowledgeCardboxDirectory, DEFAULT_CARDBOX_DIR),
      topic: normalizeBoxDir(st.knowledgeTopicDirectory, DEFAULT_TOPIC_DIR)
    };
  }

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

  // src/core/flow-dialog.ts
  var FLOW_DIALOG_CANCEL_ID = "__shared_confirm_cancel__";
  var FLOW_DIALOG_OK_ID = "__shared_confirm_ok__";
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
    return { html, buttons, focusId: buttons[focusIdx].id, dangerPrimary: !!actions[focusIdx].danger };
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

  // src/core/ui/str.ts
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
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
      const q2 = cur.toLowerCase();
      const matched = opts.source().filter((s) => (!opts.excludeCurrent || s !== cur) && (!q2 || s.toLowerCase().includes(q2))).slice(0, max);
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
        const icon = (_a2 = opts.iconOf) == null ? void 0 : _a2.call(opts, raw);
        if (icon) {
          const ic = document.createElement("span");
          ic.className = "bz-suggest-ic";
          if (typeof icon === "string") ic.textContent = icon;
          else ic.appendChild(icon);
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

  // src/knowledge/mount-data.ts
  var DEFAULT_CARDBOX = "卡片盒";
  var DEFAULT_LIT = "文献盒";
  var IMAGE_EXTS = /* @__PURE__ */ new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"]);
  var VIDEO_EXTS = /* @__PURE__ */ new Set(["mp4", "webm", "mov", "mkv", "avi"]);
  function normSlashes(s) {
    return String(s != null ? s : "").replace(/\\/g, "/");
  }
  function normDir(raw, fallback) {
    const s = normSlashes(raw).trim();
    if (!s) return fallback;
    return s.replace(/^\/+|\/+$/g, "");
  }
  function baseName(path) {
    const p = normSlashes(path);
    return p.split("/").pop() || "";
  }
  function stripMd(name) {
    return String(name != null ? name : "").replace(/\.md$/i, "");
  }
  function stemOf(path) {
    const b = baseName(path);
    return stripMd(b) || b;
  }
  function extOf(name) {
    const b = baseName(name).toLowerCase();
    const i = b.lastIndexOf(".");
    return i > 0 ? b.slice(i + 1) : "";
  }
  function pathKey(path) {
    return stripMd(normSlashes(path)).toLowerCase();
  }
  function inDir(path, dir) {
    const d = normDir(dir, "");
    const p = normSlashes(path);
    if (!d) return true;
    return p === d || p.startsWith(d + "/");
  }
  function samePath(a, b) {
    return pathKey(a) === pathKey(b);
  }
  function byDepthThenPath(a, b) {
    const da = normSlashes(a).split("/").length;
    const db = normSlashes(b).split("/").length;
    return da - db || a.localeCompare(b);
  }
  function stripFrontmatter(text) {
    const src = String(text != null ? text : "");
    const m = src.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return (m ? src.slice(m[0].length) : src).replace(/^\r?\n+/, "");
  }
  function splitLinkText(inner) {
    const raw = String(inner != null ? inner : "").trim();
    const bar = raw.indexOf("|");
    const left = bar >= 0 ? raw.slice(0, bar) : raw;
    const aliasRaw = bar >= 0 ? raw.slice(bar + 1).trim() : "";
    const hash = left.indexOf("#");
    return {
      target: (hash >= 0 ? left.slice(0, hash) : left).trim(),
      alias: aliasRaw || null,
      subpath: hash >= 0 ? left.slice(hash + 1).trim() || null : null
    };
  }
  function linkKey(target, subpath) {
    return `${target.trim().toLowerCase()}#${(subpath != null ? subpath : "").trim().toLowerCase()}`;
  }
  function safeApp() {
    try {
      return getApp();
    } catch (e) {
      return null;
    }
  }
  function numOr(v, fallback) {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }
  function mountCtx(app) {
    var _a;
    const s = (_a = tryGetSettings()) != null ? _a : {};
    return {
      app: app != null ? app : safeApp(),
      cardboxDir: normDir(s == null ? void 0 : s.knowledgeCardboxDirectory, DEFAULT_CARDBOX) || DEFAULT_CARDBOX,
      litDir: normDir(s == null ? void 0 : s.knowledgeDirectory, DEFAULT_LIT) || DEFAULT_LIT
    };
  }
  function allFiles(ctx) {
    var _a;
    const v = (_a = ctx == null ? void 0 : ctx.app) == null ? void 0 : _a.vault;
    const files = typeof (v == null ? void 0 : v.getFiles) === "function" ? v.getFiles() : null;
    return Array.isArray(files) ? files.filter((f) => f && f.path) : [];
  }
  function mdFiles(ctx) {
    var _a;
    const v = (_a = ctx == null ? void 0 : ctx.app) == null ? void 0 : _a.vault;
    const files = typeof (v == null ? void 0 : v.getMarkdownFiles) === "function" ? v.getMarkdownFiles() : allFiles(ctx).filter((f) => f.extension === "md");
    return (Array.isArray(files) ? files.filter((f) => f && f.path) : []).slice().sort((a, b) => String(a.path).localeCompare(String(b.path)));
  }
  function cardFiles(ctx) {
    const dir = normDir(ctx == null ? void 0 : ctx.cardboxDir, "");
    return mdFiles(ctx).filter((f) => inDir(f.path, dir));
  }
  async function readText(file, ctx) {
    var _a, _b, _c, _d, _e, _f, _g;
    const v = (_a = ctx == null ? void 0 : ctx.app) == null ? void 0 : _a.vault;
    if (!v || file === null || file === void 0) return "";
    let target = file;
    if (typeof file === "string") {
      const p = normSlashes(file);
      if (!p) return "";
      target = (_e = (_d = (_b = v.getAbstractFileByPath) == null ? void 0 : _b.call(v, p)) != null ? _d : (_c = v.getFileByPath) == null ? void 0 : _c.call(v, p)) != null ? _e : p;
    }
    try {
      if (typeof v.cachedRead === "function") return String((_f = await v.cachedRead(target)) != null ? _f : "");
      if (typeof v.read === "function") return String((_g = await v.read(target)) != null ? _g : "");
    } catch (e) {
    }
    return "";
  }
  async function bodyOf(path, ctx) {
    return stripFrontmatter(await readText(path, ctx));
  }
  function parseMountLinks(body) {
    const src = String(body != null ? body : "");
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const re = /(!?)\[\[([^\[\]]+?)\]\]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const raw = m[0];
      const embed = m[1] === "!";
      const { target, alias, subpath } = splitLinkText(m[2]);
      if (!target) continue;
      const key2 = linkKey(target, subpath);
      if (seen.has(key2)) continue;
      seen.add(key2);
      out.push({
        raw,
        target,
        alias,
        subpath,
        embed,
        kind: classifyKind(target, subpath, embed, null, ""),
        missing: false,
        path: null,
        anchor: { from: m.index, to: m.index + raw.length, text: raw }
      });
    }
    return out;
  }
  function classifyKind(target, subpath, embed, path, cardboxDir) {
    const t = String(target != null ? target : "").trim();
    const p = path && String(path).trim() ? normSlashes(String(path)) : null;
    const exts = [p ? extOf(p) : "", extOf(t)].filter(Boolean);
    if (exts.some((e) => IMAGE_EXTS.has(e))) return "image";
    if (exts.some((e) => VIDEO_EXTS.has(e))) return "video";
    const dir = normDir(cardboxDir, "");
    if (p && dir && (p === dir || p.startsWith(dir + "/"))) return "card";
    const sp = String(subpath != null ? subpath : "").trim().replace(/^#/, "").trim();
    if (sp.startsWith("^")) return "para";
    if (sp) return "head";
    return "note";
  }
  function findBySameName(target, ctx) {
    var _a;
    const t = normSlashes(target).trim();
    if (!t) return null;
    const files = allFiles(ctx);
    const wantFull = pathKey(t);
    const wantBase = stripMd(baseName(t)).toLowerCase();
    const exact = files.filter((f) => pathKey(f.path) === wantFull).map((f) => normSlashes(f.path));
    const named = files.filter((f) => stemOf(f.path).toLowerCase() === wantBase).map((f) => normSlashes(f.path));
    const pool = (exact.length ? exact : named).slice().sort(byDepthThenPath);
    return (_a = pool[0]) != null ? _a : null;
  }
  function resolveLinkPath(target, ctx, sourcePath) {
    var _a, _b, _c, _d;
    const t = String(target != null ? target : "").trim();
    if (!t) return null;
    try {
      const dest = (_d = (_c = (_b = (_a = ctx == null ? void 0 : ctx.app) == null ? void 0 : _a.metadataCache) == null ? void 0 : _b.getFirstLinkpathDest) == null ? void 0 : _c.call(_b, t, sourcePath)) != null ? _d : null;
      const p = dest && typeof dest === "object" ? dest.path : typeof dest === "string" ? dest : null;
      if (p) return normSlashes(String(p));
    } catch (e) {
    }
    return findBySameName(t, ctx);
  }
  async function resolveMountLinks(links, ctx, sourcePath = "") {
    var _a, _b;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const dir = (_a = ctx == null ? void 0 : ctx.cardboxDir) != null ? _a : "";
    for (const link of links != null ? links : []) {
      if (!link) continue;
      const path = resolveLinkPath(link.target, ctx, sourcePath);
      const kind = classifyKind(link.target, link.subpath, link.embed, path, dir);
      const key2 = path ? `${pathKey(path)}#${((_b = link.subpath) != null ? _b : "").toLowerCase()}` : `missing:${linkKey(link.target, link.subpath)}`;
      if (seen.has(key2)) continue;
      seen.add(key2);
      out.push({ ...link, path, missing: !path, kind });
    }
    return out;
  }
  function relocateAnchor(body, anchor) {
    var _a;
    const src = String(body != null ? body : "");
    const text = String((_a = anchor == null ? void 0 : anchor.text) != null ? _a : "");
    if (!text) return null;
    const exact = src.indexOf(text);
    if (exact >= 0) return exact;
    const flat = flattenWs(src);
    const needle = flattenWs(text).text;
    if (!needle) return null;
    const at = flat.text.indexOf(needle);
    return at < 0 ? null : flat.map[at];
  }
  function flattenWs(s) {
    const map = [];
    let text = "";
    for (let i = 0; i < s.length; i++) {
      if (/\s/.test(s[i])) continue;
      map.push(i);
      text += s[i];
    }
    return { text, map };
  }
  function joinSnippet(chunk) {
    const text = chunk.join("\n").replace(/^\s*\n+/, "").replace(/\s+$/, "");
    return text.trim() ? text : null;
  }
  function splitBlocks(lines) {
    const out = [];
    let cur = [];
    let start = 0;
    const flush = (end) => {
      if (cur.length) out.push({ start, end, text: cur.join("\n") });
      cur = [];
    };
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "") {
        flush(i);
        continue;
      }
      if (!cur.length) start = i;
      cur.push(lines[i]);
    }
    flush(lines.length);
    return out;
  }
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function headingSnippet(lines, heading, cache) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const want = heading.trim().toLowerCase();
    const hs = Array.isArray(cache == null ? void 0 : cache.headings) ? cache.headings : null;
    if (hs) {
      const idx = hs.findIndex((h) => {
        var _a2;
        return String((_a2 = h == null ? void 0 : h.heading) != null ? _a2 : "").trim().toLowerCase() === want;
      });
      if (idx >= 0) {
        const start = numOr((_c = (_b = (_a = hs[idx]) == null ? void 0 : _a.position) == null ? void 0 : _b.start) == null ? void 0 : _c.line, -1);
        if (start >= 0) {
          const level = numOr((_d = hs[idx]) == null ? void 0 : _d.level, 1);
          let end = lines.length;
          for (let j = idx + 1; j < hs.length; j++) {
            if (numOr((_e = hs[j]) == null ? void 0 : _e.level, 1) <= level) {
              end = numOr((_h = (_g = (_f = hs[j]) == null ? void 0 : _f.position) == null ? void 0 : _g.start) == null ? void 0 : _h.line, lines.length);
              break;
            }
          }
          return joinSnippet(lines.slice(start + 1, end));
        }
      }
    }
    for (let i = 0; i < lines.length; i++) {
      const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
      if (!m || m[2].trim().toLowerCase() !== want) continue;
      let end = lines.length;
      for (let j = i + 1; j < lines.length; j++) {
        const mm = /^(#{1,6})\s+/.exec(lines[j]);
        if (mm && mm[1].length <= m[1].length) {
          end = j;
          break;
        }
      }
      return joinSnippet(lines.slice(i + 1, end));
    }
    return null;
  }
  function blockSnippet(lines, id, cache) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const re = new RegExp(`(^|\\s)\\^${escapeRe(id)}(\\s|$)`);
    const start = numOr((_d = (_c = (_b = (_a = cache == null ? void 0 : cache.blocks) == null ? void 0 : _a[id]) == null ? void 0 : _b.position) == null ? void 0 : _c.start) == null ? void 0 : _d.line, -1);
    if (start >= 0) {
      const end = numOr((_h = (_g = (_f = (_e = cache == null ? void 0 : cache.blocks) == null ? void 0 : _e[id]) == null ? void 0 : _f.position) == null ? void 0 : _g.end) == null ? void 0 : _h.line, start);
      const text = lines.slice(start, end + 1).join("\n").replace(re, " ");
      return joinSnippet([text]);
    }
    const blocks = splitBlocks(lines);
    for (let i = 0; i < blocks.length; i++) {
      const text = blocks[i].text;
      if (!re.test(text)) continue;
      if (!text.replace(re, " ").trim() && i > 0) return joinSnippet([blocks[i - 1].text]);
      return joinSnippet([text.replace(re, " ").trim()]);
    }
    return null;
  }
  async function readSubpathBody(file, subpath, ctx) {
    var _a, _b, _c, _d;
    const sp = String(subpath != null ? subpath : "").trim().replace(/^#/, "").trim();
    if (!sp) return null;
    const path = typeof file === "string" ? normSlashes(file) : normSlashes((_a = file == null ? void 0 : file.path) != null ? _a : "");
    if (!path) return null;
    const content = await readText(file, ctx);
    if (!content) return null;
    const lines = String(content).split(/\r?\n/);
    const cache = (_d = (_c = (_b = ctx == null ? void 0 : ctx.app) == null ? void 0 : _b.metadataCache) == null ? void 0 : _c.getFileCache) == null ? void 0 : _d.call(_c, typeof file === "string" ? path : file);
    if (sp.startsWith("^")) return blockSnippet(lines, sp.slice(1), cache);
    return headingSnippet(lines, sp, cache);
  }
  async function findSameNameNote(cardPath, ctx) {
    var _a;
    const stem = stemOf(cardPath).toLowerCase();
    if (!stem) return null;
    const dir = normDir(ctx == null ? void 0 : ctx.litDir, "");
    const hits = mdFiles(ctx).filter((f) => inDir(f.path, dir) && stemOf(f.path).toLowerCase() === stem).map((f) => normSlashes(f.path)).sort(byDepthThenPath);
    return (_a = hits[0]) != null ? _a : null;
  }
  function fmListLineInner(line) {
    const m = /^\s*-\s*(.*?)\s*$/.exec(line);
    if (!m) return null;
    const v = m[1].replace(/^["']|["']$/g, "").replace(/^["']|["']$/g, "");
    const mm = v.match(/\[\[([^\]]+)\]\]/);
    return mm ? mm[1].trim() : v.trim();
  }
  function fmList(text, key2) {
    var _a;
    const lines = String(text != null ? text : "").split(/\r?\n/);
    if (((_a = lines[0]) == null ? void 0 : _a.trim()) !== "---") return [];
    const head = new RegExp(`^${key2}\\s*:`);
    const out = [];
    let inList = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "---") break;
      if (head.test(line)) {
        inList = true;
        continue;
      }
      if (!inList) continue;
      const inner = fmListLineInner(line);
      if (inner !== null) out.push(inner);
      else if (line.trim() !== "") break;
    }
    return out;
  }
  function newScan(ctx) {
    return { ctx, items: /* @__PURE__ */ new Map(), bodies: /* @__PURE__ */ new Map() };
  }
  async function scanBody(scan, path) {
    const key2 = pathKey(path);
    if (!scan.bodies.has(key2)) scan.bodies.set(key2, await bodyOf(path, scan.ctx));
    return scan.bodies.get(key2);
  }
  function itemFromLink(text, source2, ctx, sourcePath) {
    var _a;
    const { target, alias, subpath } = splitLinkText(text);
    if (!target) return null;
    const path = resolveLinkPath(target, ctx, sourcePath);
    return {
      source: source2,
      kind: classifyKind(target, subpath, false, path, (_a = ctx == null ? void 0 : ctx.cardboxDir) != null ? _a : ""),
      target,
      path,
      subpath,
      alias,
      anchor: null,
      missing: !path
    };
  }
  async function outboundItems(scan, path) {
    const key2 = pathKey(path);
    const cached = scan.items.get(key2);
    if (cached) return cached;
    const text = await readText(path, scan.ctx);
    scan.bodies.set(key2, stripFrontmatter(text));
    const items = [];
    const links = await resolveMountLinks(parseMountLinks(stripFrontmatter(text)), scan.ctx, path);
    for (const l of links) {
      items.push({ source: "link", kind: l.kind, target: l.target, path: l.path, subpath: l.subpath, alias: l.alias, anchor: l.anchor, missing: l.missing });
    }
    for (const t of fmList(text, "related")) {
      const it = itemFromLink(t, "related", scan.ctx, path);
      if (it) items.push(it);
    }
    for (const t of fmList(text, "mounted")) {
      const it = itemFromLink(t, "manual", scan.ctx, path);
      if (it) items.push(it);
    }
    const seen = /* @__PURE__ */ new Set();
    const deduped = items.filter((it) => {
      var _a;
      const k = `${it.source}:${it.path ? `${pathKey(it.path)}#${((_a = it.subpath) != null ? _a : "").toLowerCase()}` : `missing#${linkKey(it.target, it.subpath)}`}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    scan.items.set(key2, deduped);
    return deduped;
  }
  async function inboundItems(scan, targetPath) {
    const out = [];
    for (const f of mdFiles(scan.ctx)) {
      if (samePath(f.path, targetPath)) continue;
      const items = await outboundItems(scan, f.path);
      for (const it of items) {
        if (!it.path || !samePath(it.path, targetPath)) continue;
        out.push({ ...it, container: normSlashes(f.path) });
      }
    }
    return out;
  }
  function itemId(it) {
    var _a;
    const p = (_a = it.path) != null ? _a : it.target;
    return it.subpath ? `${p}#${it.subpath}` : p;
  }
  function isSelfItem(it, nodePath) {
    if (it.path) return samePath(it.path, nodePath);
    return pathKey(it.target) === pathKey(nodePath) || stemOf(it.target).toLowerCase() === stemOf(nodePath).toLowerCase();
  }
  async function rootNode(path, scan) {
    return {
      id: path,
      path,
      title: stemOf(path),
      kind: "card",
      source: "self",
      depth: 0,
      anchor: null,
      missing: false,
      suggested: false,
      attached: false,
      parent: null,
      body: await scanBody(scan, path)
    };
  }
  async function materialize(scan, it, depth, parent, upstream) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (upstream) {
      const path2 = normSlashes((_b = (_a = it.container) != null ? _a : it.path) != null ? _b : it.target);
      return {
        id: path2,
        path: path2,
        title: stemOf(path2),
        kind: classifyKind(path2, null, false, path2, (_d = (_c = scan.ctx) == null ? void 0 : _c.cardboxDir) != null ? _d : ""),
        source: it.source,
        depth,
        anchor: it.anchor,
        missing: false,
        suggested: false,
        attached: false,
        parent,
        body: await scanBody(scan, path2)
      };
    }
    const path = (_e = it.path) != null ? _e : it.target;
    let body = null;
    if (it.path && (it.kind === "note" || it.kind === "card")) body = await scanBody(scan, it.path);
    else if (it.path && (it.kind === "head" || it.kind === "para") && it.subpath) body = await readSubpathBody({ path: it.path }, it.subpath, scan.ctx);
    let title;
    if (it.kind === "head") title = (_f = it.subpath) != null ? _f : stemOf(path);
    else if (it.kind === "para") title = (body ? body.split("\n")[0].trim().slice(0, 24) : "") || `^${String((_g = it.subpath) != null ? _g : "").replace(/^\^/, "")}`;
    else title = it.missing ? it.target : baseName(path) || it.target;
    return {
      id: itemId(it),
      path,
      title,
      kind: it.kind,
      source: it.source,
      depth,
      anchor: it.anchor,
      missing: it.missing,
      suggested: false,
      attached: false,
      parent,
      body
    };
  }
  async function buildMountTree(cardPath, opts) {
    var _a, _b, _c, _d;
    const ctx = (_a = opts == null ? void 0 : opts.ctx) != null ? _a : mountCtx();
    const direction = (opts == null ? void 0 : opts.direction) === "upstream" ? "upstream" : "downstream";
    const upstream = direction === "upstream";
    const rootPath = normSlashes(String(cardPath != null ? cardPath : "")).replace(/^\/+|\/+$/g, "");
    const scan = newScan(ctx);
    const nodes = /* @__PURE__ */ new Map();
    const order = [];
    const edges = [];
    const edgeKeys = /* @__PURE__ */ new Set();
    const root = await rootNode(rootPath, scan);
    nodes.set(root.id, root);
    order.push(root.id);
    const queue = [root.id];
    while (queue.length) {
      const node = nodes.get(queue.shift());
      if (node.kind !== "card" || node.missing) continue;
      const sameNote = await findSameNameNote(node.path, ctx);
      if (sameNote && !nodes.has(sameNote)) {
        const child = {
          id: sameNote,
          path: sameNote,
          title: stemOf(sameNote),
          kind: classifyKind(sameNote, null, false, sameNote, ctx.cardboxDir),
          source: "sameName",
          depth: node.depth + 1,
          anchor: null,
          missing: false,
          suggested: false,
          attached: true,
          parent: node.id,
          // 同名文献吸附在**所属卡片**下（不是根、也不为 null）
          body: await scanBody(scan, sameNote)
        };
        nodes.set(child.id, child);
        order.push(child.id);
      }
      const items = upstream ? await inboundItems(scan, node.path) : await outboundItems(scan, node.path);
      for (const it of items) {
        if (!upstream && isSelfItem(it, node.path)) continue;
        const id = upstream ? normSlashes((_c = (_b = it.container) != null ? _b : it.path) != null ? _c : it.target) : itemId(it);
        let child = (_d = nodes.get(id)) != null ? _d : null;
        let fresh = false;
        if (!child) {
          child = await materialize(scan, it, node.depth + 1, node.id, upstream);
          nodes.set(child.id, child);
          order.push(child.id);
          fresh = true;
        }
        if (!child.attached && child.depth > node.depth) {
          const ek = `${node.id}\0${child.id}`;
          if (!edgeKeys.has(ek)) {
            edgeKeys.add(ek);
            edges.push({ from: node.id, to: child.id, suggested: false });
          }
        }
        if (fresh && child.kind === "card" && !child.missing) queue.push(child.id);
      }
    }
    const firstIdx = new Map(order.map((id, i) => [id, i]));
    const list = order.map((id) => nodes.get(id)).filter(Boolean);
    list.sort((a, b) => {
      var _a2, _b2;
      return a.depth - b.depth || ((_a2 = firstIdx.get(a.id)) != null ? _a2 : 0) - ((_b2 = firstIdx.get(b.id)) != null ? _b2 : 0);
    });
    const pos = new Map(list.map((n, i) => [n.id, i]));
    const sortedEdges = edges.slice().sort((a, b) => {
      var _a2, _b2, _c2, _d2;
      return ((_a2 = pos.get(a.from)) != null ? _a2 : -1) - ((_b2 = pos.get(b.from)) != null ? _b2 : -1) || ((_c2 = pos.get(a.to)) != null ? _c2 : -1) - ((_d2 = pos.get(b.to)) != null ? _d2 : -1);
    });
    return { root: root.id, direction, nodes: list, edges: sortedEdges };
  }
  async function refCounts(ctx) {
    var _a;
    const scan = newScan(ctx);
    const cards = cardFiles(ctx);
    const byKey = new Map(cards.map((c) => [pathKey(c.path), normSlashes(c.path)]));
    const counts = {};
    for (const c of cards) counts[normSlashes(c.path)] = 0;
    for (const f of mdFiles(ctx)) {
      const items = await outboundItems(scan, f.path);
      for (const it of items) {
        if (!it.path) continue;
        if (samePath(it.path, f.path)) continue;
        const card = byKey.get(pathKey(it.path));
        if (card) counts[card] = ((_a = counts[card]) != null ? _a : 0) + 1;
      }
    }
    return counts;
  }
  async function orphanCards(ctx, counts) {
    var _a;
    const scan = newScan(ctx);
    const refs = counts != null ? counts : await refCounts(ctx);
    const out = [];
    for (const card of cardFiles(ctx)) {
      const path = normSlashes(card.path);
      if (((_a = refs[path]) != null ? _a : 0) > 0) continue;
      const items = (await outboundItems(scan, path)).filter((it) => !isSelfItem(it, path));
      if (items.length) continue;
      out.push(path);
    }
    return out.sort();
  }

  // src/knowledge/note-gen.ts
  function parseDomainList(raw) {
    return [...new Set(String(raw != null ? raw : "").split(/[,，、]/).map((s) => s.trim()).filter(Boolean))];
  }
  function sanitizeMdTitle(s) {
    const t = String(s != null ? s : "").replace(/[\\/:*?"<>|#^[\]]/g, "_").replace(/\s+/g, " ").trim().slice(0, 50);
    return t || "文献笔记";
  }
  function chunkTranscript(text, maxLen = 4e3) {
    const src = String(text || "").trim();
    if (!src) return [];
    const segs = src.split(/(?<=[。！？!?；;])/).map((s) => s.trim()).filter(Boolean);
    const chunks = [];
    let cur = "";
    for (const seg of segs) {
      if (cur && (cur + seg).length > maxLen) {
        chunks.push(cur);
        cur = "";
      }
      if (seg.length <= maxLen) {
        cur += seg;
        continue;
      }
      if (cur) {
        chunks.push(cur);
        cur = "";
      }
      let rest = seg;
      while (rest.length > maxLen) {
        chunks.push(rest.slice(0, maxLen));
        rest = rest.slice(maxLen);
      }
      cur = rest;
    }
    if (cur) chunks.push(cur);
    return chunks;
  }
  function parseAiJson(raw) {
    const cleaned = String(raw || "").replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e) {
    }
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e) {
      }
    }
    throw new Error("AI 返回的不是 JSON：" + cleaned.slice(0, 120));
  }
  function domainInstruction(list) {
    if (!list.length) return '"domain": "领域，用一个中文词"';
    return `"domain": "从以下领域选一个最贴近的：${list.join("、")}；都不贴切可写一个新的中文领域词"`;
  }
  function nowStamp() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  var BACKFILL_AI_TIMEOUT_MS = 25e3;
  function withTimeout(p, ms, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`AI 请求超时（${label}，${ms}ms）`)), ms);
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
  async function writeUniqueNote(dir, baseName2, content) {
    const app = getApp();
    const folder = String(dir || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    let path = `${folder}/${baseName2}.md`;
    for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName2}_${i}.md`;
    try {
      const exists = await app.vault.adapter.exists(folder);
      if (!exists) await app.vault.createFolder(folder);
    } catch (e) {
    }
    await app.vault.create(path, content);
    return path;
  }
  function findDuplicateTermNote(term) {
    const app = getApp();
    const s = tryGetSettings();
    const dir = String(s.knowledgeDirectory || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const path = `${dir}/${sanitizeMdTitle(term)}.md`;
    return app.vault.getAbstractFileByPath(path) ? path : null;
  }
  async function generateVideoNote(opts) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const chunks = chunkTranscript(opts.transcript);
    const metaRaw = await ai.json(
      `你是文献整理助手。基于下方 B站视频《${opts.videoTitle || "未命名"}》的转写文稿片段，生成文献笔记元数据。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句，不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","tags":["3-6个中文标签，每个不超过5个字，涵盖主题领域、关键概念、应用场景"],"summary":"一句话简介，不超过60字",${domainInstruction(list)}}
所有字段一律使用简体中文。

【转写文稿片段】
${chunks[0] || ""}`,
      { modelOptions: { max_tokens: 600 } }
    );
    const meta = parseAiJson(metaRaw);
    const title = String((meta == null ? void 0 : meta.title) || "").trim() || opts.videoTitle || "未命名";
    const tags = Array.isArray(meta == null ? void 0 : meta.tags) ? meta.tags.map(String).filter(Boolean).slice(0, 6) : [];
    const summary = String((meta == null ? void 0 : meta.summary) || "").trim();
    const domain = String((meta == null ? void 0 : meta.domain) || "").trim();
    const polished = [];
    for (const c of chunks) {
      const p = await ai.chat(
        `你是文字编辑。把下面的视频转写文稿轻度润色为书面语：口语转书面、删除口水词与重复内容，保持原顺序、原事实（数字与专名不变）。转写可能存在语音误听，专名与术语（如火箭型号、人名、地名、专业词）若明显是误听则按上下文纠正为最合理的写法；无法确定的保持原文。输出必须是简体中文（繁体转写一律转为简体）。直接输出润色后的正文，不要解释、不要加标题、不要列表。

【转写文稿】
${c}`,
        // deepseek-v4-flash（带思考）长文润色时 reasoning_content 会吃光 max_tokens 导致 content 空串
        // （ticket 复现：finish_reason=length、content=''）；deepseek-chat 无思考、输出直达 content，稳
        { model: "deepseek-chat", modelOptions: { max_tokens: 8192 } }
      );
      polished.push(String(p || "").trim());
    }
    const whole = polished.join("");
    const videoSection = opts.videoPath ? `![[${String(opts.videoPath).replace(/\\/g, "/")}]]` : null;
    const fm = [
      "---",
      `title: ${quoteYaml(title)}`,
      "tags:",
      tags.map((t) => `  - ${quoteYaml(t)}`).join("\n"),
      `summary: ${quoteYaml(summary)}`,
      `url: ${quoteYaml(opts.url)}`,
      `date: ${quoteYaml(nowStamp())}`,
      `author: ${quoteYaml(opts.uploader)}`,
      `videoTitle: ${quoteYaml(opts.videoTitle)}`,
      "type: video",
      `domain: ${quoteYaml(domain)}`,
      "---"
    ].join("\n");
    const body = [fm, whole, videoSection].filter(Boolean).join("\n\n");
    return writeUniqueNote(String(s.knowledgeDirectory || "文献盒"), sanitizeMdTitle(title), body);
  }
  function termPrompt(term, list) {
    return `你是百科知识整理助手。为术语「${term}」生成一篇文献笔记。只输出 JSON，不要任何解释：
{"summary":"一段关于该术语的简明介绍（百科总结式，150-300字简体中文，连贯成文，涵盖定义、核心要点与必要背景）","domain": ${domainInstruction(list)}}`;
  }
  async function generateTermDraft(term) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const t = String(term || "").trim();
    if (!t) throw new Error("术语为空");
    const raw = await ai.json(termPrompt(t, list));
    const meta = parseAiJson(raw);
    return {
      summary: String((meta == null ? void 0 : meta.summary) || "").trim(),
      domain: String((meta == null ? void 0 : meta.domain) || "").trim()
    };
  }
  async function summarizeTermSummary(text) {
    const ai = createAI();
    const t = String(text || "").trim();
    if (!t) throw new Error("内容为空");
    const out = await ai.chat(
      `你是文字编辑。把下面的术语介绍压缩成更精简的一段话：保留术语定义与关键事实，删除冗余表述与重复内容，长度约为原文的一半。输出必须是简体中文。直接输出结果，不要解释、不要加标题、不要列表。

【原文】
${t}`,
      { modelOptions: { max_tokens: 1024 } }
    );
    const s = String(out || "").trim();
    if (!s) throw new Error("AI 返回为空");
    return s;
  }
  async function generateTermNote(opts) {
    var _a;
    const s = tryGetSettings();
    const term = String(opts.term || "").trim();
    if (!term) throw new Error("术语为空");
    let summary;
    let domain;
    if (opts.summary === void 0) {
      const draft = await generateTermDraft(term);
      summary = draft.summary;
      domain = draft.domain;
    } else {
      summary = String(opts.summary).trim();
      domain = String((_a = opts.domain) != null ? _a : "").trim();
    }
    const fm = [
      "---",
      `title: ${quoteYaml(term)}`,
      "type: term",
      `domain: ${quoteYaml(domain)}`,
      `term: ${quoteYaml(term)}`,
      `date: ${quoteYaml(nowStamp())}`
    ];
    const src = serializeTermSource(opts.source);
    if (src) {
      fm.push(`source: ${quoteYaml(src.source)}`);
      if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
    }
    fm.push("---");
    const body = [fm.join("\n"), summary].filter(Boolean).join("\n\n");
    return writeUniqueNote(String(s.knowledgeDirectory || "文献盒"), sanitizeMdTitle(term), body);
  }
  function passagePrompt(text, list) {
    return `你是文献整理助手。把下方这段文字整理成一篇文献笔记。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句，概括这段文字在讲什么；不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","summary":"整理后的正文（保留原文的全部事实与要点，删去口水话、重复表述，可分自然段）","domain": ${domainInstruction(list)}}
硬约束：正文只能来自原文，不得添加原文没有的事实、数字或结论，不得写成读后感。所有字段一律使用简体中文。

【原文】
${text}`;
  }
  async function generatePassageDraft(text) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const t = String(text || "").trim();
    if (!t) throw new Error("段落为空");
    const raw = await ai.json(passagePrompt(t, list), { modelOptions: { max_tokens: 4096 } });
    const meta = parseAiJson(raw);
    return {
      title: String((meta == null ? void 0 : meta.title) || "").trim(),
      summary: String((meta == null ? void 0 : meta.summary) || "").trim(),
      domain: String((meta == null ? void 0 : meta.domain) || "").trim()
    };
  }
  async function generatePassageNote(opts) {
    var _a, _b;
    const s = tryGetSettings();
    const title = String(opts.title || "").trim();
    const summary = String((_a = opts.summary) != null ? _a : "").trim();
    if (!title && !summary) throw new Error("段落为空");
    const domain = String((_b = opts.domain) != null ? _b : "").trim();
    const fm = [
      "---",
      `title: ${quoteYaml(title || summary.slice(0, 30))}`,
      "type: passage",
      `domain: ${quoteYaml(domain)}`,
      `date: ${quoteYaml(nowStamp())}`
    ];
    const src = serializeTermSource(opts.source);
    if (src) {
      fm.push(`source: ${quoteYaml(src.source)}`);
      if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
    }
    fm.push("---");
    const body = [fm.join("\n"), summary].filter(Boolean).join("\n\n");
    return writeUniqueNote(String(s.knowledgeDirectory || "文献盒"), sanitizeMdTitle(title || summary), body);
  }
  var IMAGE_ASSETS_DIR = "assets";
  async function writeUniqueBinary(dir, baseName2, ext, bytes) {
    const app = getApp();
    const folder = String(dir || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    let path = `${folder}/${baseName2}.${ext}`;
    for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = `${folder}/${baseName2}_${i}.${ext}`;
    try {
      const exists = await app.vault.adapter.exists(folder);
      if (!exists) await app.vault.createFolder(folder);
    } catch (e) {
    }
    await app.vault.createBinary(path, bytes);
    return path;
  }
  function imagePrompt(list, count, descs) {
    const multi = count > 1;
    const scope = multi ? `看下面这 ${count} 张图片，把它们**作为一组**生成一篇文献笔记` : "看这张图片，为它生成一篇文献笔记";
    const bodyAsk = multi ? "对这组图的整理说明（150-300字简体中文，连贯成文）：先说这组图共同在讲什么，再按图交代各自可见的内容与信息，图中含文字则整理其要点" : "对这张图的整理说明（150-300字简体中文，连贯成文）：图中含文字则整理其要点，是照片、示意图或图表则客观描述其可见内容与信息";
    let prompt = `你是文献整理助手。${scope}。只输出 JSON，不要任何解释：
{"title":"15-30字的中文完整陈述句，概括${multi ? "这组图" : "这张图"}在讲什么；不得使用疑问句或疑问语气（为何/为什么/怎么/如何/吗/呢），禁止冒号、破折号、句中句号问号，需要连接时用逗号","summary":"${bodyAsk}","domain": ${domainInstruction(list)}}
硬约束：只能写图中确实能看到的内容，不得臆测、不得补充图中没有的事实与数字、不得写成观后感。所有字段一律使用简体中文。`;
    const notes = (Array.isArray(descs) ? descs : []).map((d, i) => ({ n: i + 1, d: String(d != null ? d : "").trim() })).filter((x) => x.d);
    if (notes.length) {
      prompt += `

【用户图注】用户为其中部分图片写的描述，解读请贴合这些关注点：
${notes.map((x) => `第 ${x.n} 张：${x.d}`).join("\n")}`;
    }
    return prompt;
  }
  async function generateImageDraft(imageUrls, descs) {
    const ai = createAI();
    const s = tryGetSettings();
    const list = parseDomainList(s.knowledgeDomainList);
    const pairs = (Array.isArray(imageUrls) ? imageUrls : []).map((u, i) => {
      var _a;
      return {
        url: String(u || "").trim(),
        desc: String((_a = Array.isArray(descs) ? descs[i] : "") != null ? _a : "").trim()
      };
    });
    const valid = pairs.filter((p) => p.url);
    if (!valid.length) throw new Error("图片为空");
    const raw = await ai.json(
      { text: imagePrompt(list, valid.length, valid.map((p) => p.desc)), images: valid.map((p) => p.url) },
      { modelOptions: { max_tokens: 4096 } }
    );
    const meta = parseAiJson(raw);
    return {
      title: String((meta == null ? void 0 : meta.title) || "").trim(),
      summary: String((meta == null ? void 0 : meta.summary) || "").trim(),
      domain: String((meta == null ? void 0 : meta.domain) || "").trim()
    };
  }
  function resolveImageDir(settings) {
    const configured = String((settings == null ? void 0 : settings.knowledgeImageFolder) || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (configured) return configured;
    const dir = String((settings == null ? void 0 : settings.knowledgeDirectory) || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || "文献盒";
    return `${dir}/${IMAGE_ASSETS_DIR}`;
  }
  async function generateImageNote(opts) {
    var _a, _b;
    const s = tryGetSettings();
    const title = String(opts.title || "").trim();
    const summary = String((_a = opts.summary) != null ? _a : "").trim();
    if (!title && !summary) throw new Error("图版为空");
    const images = (Array.isArray(opts.images) ? opts.images : []).filter((im) => im && im.bytes);
    if (!images.length) throw new Error("图版没有图片");
    const dir = String(s.knowledgeDirectory || "文献盒");
    const name = sanitizeMdTitle(title || summary.slice(0, 30));
    const imageRoot = resolveImageDir(s);
    const imagePaths = [];
    for (const im of images) imagePaths.push(await writeUniqueBinary(imageRoot, name, im.ext || "png", im.bytes));
    const domain = String((_b = opts.domain) != null ? _b : "").trim();
    const fm = [
      "---",
      `title: ${quoteYaml(title || name)}`,
      "type: image",
      `domain: ${quoteYaml(domain)}`,
      `date: ${quoteYaml(nowStamp())}`
    ];
    const src = serializeTermSource(opts.source);
    if (src) {
      fm.push(`source: ${quoteYaml(src.source)}`);
      if (src.sourceTitle) fm.push(`sourceTitle: ${quoteYaml(src.sourceTitle)}`);
    }
    fm.push("---");
    const imageLines = imagePaths.map((p, i) => {
      var _a2, _b2;
      const desc = String((_b2 = (_a2 = images[i]) == null ? void 0 : _a2.desc) != null ? _b2 : "").trim();
      return desc ? `![[${p}|${desc}]]` : `![[${p}]]`;
    });
    const body = [fm.join("\n"), summary, ...imageLines].filter(Boolean).join("\n\n");
    return writeUniqueNote(dir, name, body);
  }
  function parseFrontmatter2(content) {
    var _a;
    const out = {};
    const m = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return out;
    for (const line of m[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z\u4e00-\u9fa5_]+):\s*(.*)$/);
      if (kv) {
        const raw = String((_a = kv[2]) != null ? _a : "").trim();
        const quoted = raw.startsWith('"') && raw.endsWith('"') || raw.startsWith("'") && raw.endsWith("'");
        out[kv[1].trim()] = quoted ? raw.slice(1, -1) : raw;
      }
    }
    return out;
  }
  function injectFrontmatter(content, entries) {
    const head = entries.map((kv) => {
      const [k, ...rest] = kv.split(":");
      const v = rest.join(":").trim();
      return `${k}: ${quoteYaml(v.replace(/^"(.*)"$/, "$1"))}`;
    }).join("\n");
    const m = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (m) return content.replace(/^---\r?\n[\s\S]*?\r?\n---/, `---
${m[1]}
${head}
---`);
    return `---
${head}
---

${content || ""}`;
  }
  async function backfillNotes(opts = {}) {
    var _a, _b;
    const app = getApp();
    const s = tryGetSettings();
    const aiTimeoutMs = (_a = opts.aiTimeoutMs) != null ? _a : BACKFILL_AI_TIMEOUT_MS;
    const dir = String(s.knowledgeDirectory || "文献盒").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    const files = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(dir + "/") && f.path.endsWith(".md"));
    const needDomain = [];
    let filled = 0;
    for (const f of files) {
      const content = await app.vault.read(f);
      const fm = parseFrontmatter2(content);
      const hasType = fm.type === "video" || fm.type === "term";
      const hasDomain = !!fm.domain;
      if (hasType && hasDomain) continue;
      const patch = [];
      if (!hasType) {
        const type = fm.url || fm.author || fm.videoTitle ? "video" : fm.term ? "term" : "";
        if (type) patch.push(`type:${type}`);
      }
      if (!hasDomain) needDomain.push({ file: f });
      if (patch.length) {
        const updated = injectFrontmatter(content, patch);
        if (updated !== content) {
          await app.vault.modify(f, updated);
          filled++;
        }
      }
    }
    let aiSkipped = false;
    if (needDomain.length) {
      const ai = createAI();
      const list = parseDomainList(s.knowledgeDomainList);
      for (const { file } of needDomain) {
        try {
          const latest = await app.vault.read(file);
          const sample = latest.replace(/^---[\s\S]*?---/, "").slice(0, 2e3);
          const raw = await withTimeout(
            ai.json(
              `请判断下面这段文字所属的领域（${domainInstruction(list)}）。只输出 JSON：{"domain":"<领域词>"}

【文本】
${sample}`,
              { modelOptions: { max_tokens: 80 } }
            ),
            aiTimeoutMs,
            "领域判定"
          );
          const domain = String(((_b = parseAiJson(raw)) == null ? void 0 : _b.domain) || "").trim();
          if (domain) {
            await app.vault.modify(file, injectFrontmatter(latest, [`domain:${domain}`]));
            filled++;
          }
        } catch (e) {
          if (/API Key|AI 配置/.test(String((e == null ? void 0 : e.message) || ""))) aiSkipped = true;
        }
      }
    }
    return { scanned: files.length, filled, aiSkipped };
  }

  // src/knowledge/processor.ts
  var INSTALL_HINT = "请先运行 npm install -g @jwbz/bili-downloader";
  var STEP_RE = /^\[bz-step\]\s*(.+)$/;
  var RESULT_RE = /^\[bz-result\]\s*(\{.*\})$/;
  var PROGRESS_RE = /^\[bz-p\]\s*(\{.*\})$/;
  var INFO_RE = /^\[bz-info\]\s*(\{.*\})$/;
  var AI_STEP_TEXT = "AI 生成文献笔记中";
  var NOTE_STEP_TEXT = "笔记落盘中";
  function getChildProcess() {
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("child_process");
    } catch (e) {
      return null;
    }
  }
  function getFs() {
    const w = window;
    if (!w.require) return null;
    try {
      return w.require("fs");
    } catch (e) {
      return null;
    }
  }
  function resolveBatchSpawn(taskJson) {
    const b64 = Buffer.from(taskJson, "utf8").toString("base64");
    return { cmd: "bili-dl", args: ["--batch", `b64:${b64}`], shell: true };
  }
  function tryUnlink(path) {
    if (!path) return;
    try {
      const fsMod = getFs();
      if (fsMod && typeof fsMod.unlinkSync === "function") fsMod.unlinkSync(path);
    } catch (e) {
    }
  }
  function getVaultBasePath() {
    var _a, _b, _c;
    try {
      const bp = (_c = (_b = (_a = getApp().vault) == null ? void 0 : _a.adapter) == null ? void 0 : _b.getBasePath) == null ? void 0 : _c.call(_b);
      return typeof bp === "string" ? bp : "";
    } catch (e) {
      return "";
    }
  }
  function tailStderr(chunks) {
    let s = "";
    for (const c of chunks) {
      s += String(c);
      if (s.length > 2048) s = s.slice(-2048);
    }
    return s.trim();
  }
  function nowTs() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  var BatchRunner = {
    running: false,
    aborted: false,
    /** 遇错即停（设置 knowledgeStopOnFailure）：当前任务失败后中断整批，未开始项保持待处理 */
    stoppedFail: false,
    _child: null,
    _cp: null,
    /** 桌面端可用（window.require('child_process') 存在） */
    available() {
      return !!getChildProcess();
    },
    /**
     * 串行处理全部「待处理 + 失败」任务（按数组顺序，一次一部；ADR-0067 断点续跑：
     * 失败项重跑时工具自动跳过已成功步骤、从出错步骤继续）。
     * 已成功（归档）项不动；默认失败后继续（遇错即停设置开启时失败后中断）。
     */
    async runAll(tasks, events) {
      if (this.running) return;
      this.running = true;
      this.aborted = false;
      this.stoppedFail = false;
      const cp = getChildProcess();
      this._cp = cp;
      if (!cp) {
        notice("仅桌面端可用：文献盒处理需要 Node.js 外部进程", "error");
        this.running = false;
        return;
      }
      const stopOnFailure = tryGetSettings().knowledgeStopOnFailure === true;
      try {
        let success = 0;
        let failed = 0;
        for (const task of tasks) {
          if (this.aborted) break;
          if (task.status !== "pending" && task.status !== "failed") continue;
          let itemFailed = false;
          await this._runOne(cp, task, events, (ok) => {
            if (ok) success++;
            else {
              failed++;
              itemFailed = true;
            }
          });
          if (itemFailed && stopOnFailure) {
            this.stoppedFail = true;
            break;
          }
        }
        events.onBatchDone({ success, failed, aborted: this.aborted, stopped: this.stoppedFail });
      } finally {
        this.running = false;
      }
    },
    /** 中止整批：杀死当前子进程，未开始项保持待处理，当前项由 close 标记失败「已中止」 */
    abort() {
      var _a, _b;
      this.aborted = true;
      try {
        (_b = (_a = this._child) == null ? void 0 : _a.kill) == null ? void 0 : _b.call(_a);
      } catch (e) {
      }
    },
    /** 单部执行：spawn → 解析步骤/进度/信息/结果行 → CLI 终态 → 插件侧 AI 阶段 → 落库；Promise 在终态落库后 resolve */
    _runOne(cp, task, events, onEnd) {
      return new Promise((resolve) => {
        var _a, _b, _c, _d;
        const s = tryGetSettings();
        const nonEmpty = (v) => {
          const t = typeof v === "string" ? v.trim() : "";
          return t ? t : void 0;
        };
        const taskJson = JSON.stringify({
          url: task.url,
          start: (_a = task.start) != null ? _a : null,
          end: (_b = task.end) != null ? _b : null,
          page: task.page && task.page > 0 ? task.page : null,
          options: {
            quality: task.quality || s && s.knowledgeQuality || "highest",
            keepVideo: !s || s.knowledgeKeepVideo !== false,
            outputDir: nonEmpty(s && s.knowledgeOutputDir),
            compress: !s || s.knowledgeCompress !== false,
            crf: s && s.knowledgeCrf || 23,
            vaultPath: getVaultBasePath(),
            ffmpegPath: nonEmpty(s && s.knowledgeFfmpegPath),
            ffprobePath: nonEmpty(s && s.knowledgeFfprobePath),
            pythonPath: nonEmpty(s && s.knowledgePythonPath),
            whisperModel: nonEmpty(s && s.knowledgeWhisperModel),
            cacheDir: nonEmpty(s && s.knowledgeCacheDir),
            cacheRetentionDays: s && s.knowledgeCacheRetentionDays || 7
          }
        });
        void KnowledgeData.updateTask(task.id, { status: "processing", reason: "启动中…", processedAt: null }).then(() => {
          task.status = "processing";
          task.reason = "启动中…";
          events.onTaskProgress({ ...task }, "启动中…");
        });
        const { cmd, args, shell } = resolveBatchSpawn(taskJson);
        let child;
        let settled = false;
        let transcriptPath = null;
        let videoPath = null;
        const finish = (ok, reason, notePath, video) => {
          if (settled) return;
          settled = true;
          void this._finish(task, events, onEnd, ok, reason, notePath, video).then(resolve, () => {
            onEnd(false);
            resolve();
          });
        };
        try {
          child = cp.spawn(cmd, args, { shell, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) {
          const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}。${INSTALL_HINT}`;
          finish(false, reason, null, null);
          return;
        }
        this._child = child;
        const errChunks = [];
        const onData = (d) => {
          const text = String(d);
          for (const line of text.split(/\r?\n/)) {
            let m = line.match(STEP_RE);
            if (m) {
              const stepText = m[1].trim();
              task.reason = stepText;
              void KnowledgeData.updateTask(task.id, { reason: stepText });
              events.onTaskProgress({ ...task }, stepText, null);
              continue;
            }
            m = line.match(PROGRESS_RE);
            if (m) {
              try {
                const p = JSON.parse(m[1]);
                const progress = {
                  phase: p && typeof p.phase === "string" ? p.phase : null,
                  pct: p && Number.isFinite(p.pct) ? Number(p.pct) : null
                };
                events.onTaskProgress({ ...task }, task.reason || "", progress);
              } catch (e) {
              }
              continue;
            }
            m = line.match(INFO_RE);
            if (m) {
              try {
                const info = JSON.parse(m[1]);
                const infoTitle = info && typeof info.title === "string" ? String(info.title).trim() : "";
                const infoUploader = info && typeof info.uploader === "string" ? String(info.uploader).trim() : "";
                if (infoTitle || infoUploader) {
                  const prevTitle = task.title || "";
                  const prevUploader = task.uploader || "";
                  task.title = prevTitle || infoTitle;
                  task.uploader = prevUploader || infoUploader;
                  if (task.title !== prevTitle || task.uploader !== prevUploader) {
                    const patch = { title: task.title || null, uploader: task.uploader || null };
                    void KnowledgeData.updateTask(task.id, patch).then(() => {
                      events.onTaskInfo({ ...task });
                    });
                  }
                }
              } catch (e) {
              }
              continue;
            }
            m = line.match(RESULT_RE);
            if (m) {
              try {
                const r = JSON.parse(m[1]);
                transcriptPath = r && typeof r.transcript === "string" && r.transcript ? r.transcript : null;
                videoPath = r && typeof r.video === "string" && r.video ? r.video : null;
              } catch (e) {
              }
            }
          }
        };
        (_c = child.stdout) == null ? void 0 : _c.on("data", onData);
        (_d = child.stderr) == null ? void 0 : _d.on("data", (d) => {
          errChunks.push(d);
        });
        child.on("error", (e) => {
          if (settled) return;
          const reason = /ENOENT/.test(e.message) ? `未找到 bili-dl。${INSTALL_HINT}` : `启动失败：${e.message}`;
          finish(false, reason, null, null);
        });
        child.on("close", (code) => {
          if (settled) return;
          if (this.aborted) {
            finish(false, "已中止", null, null);
            return;
          }
          if (code === 0) {
            void this._aiStep(task, events, transcriptPath, videoPath, finish);
          } else {
            tryUnlink(transcriptPath);
            const errTail = tailStderr(errChunks);
            const reason = errTail || `处理失败（退出码 ${code}）。${INSTALL_HINT}`;
            finish(false, reason, null, null);
          }
        });
      });
    },
    /**
     * 插件侧 AI 阶段（ADR-0071）：CLI close(0) 后由插件接管——
     * 「AI 生成文献笔记中」→ 读转录临时文件 → generateVideoNote（元数据 + 分块润色 + 落盘）→
     * 读毕删临时文件 → 「笔记落盘中」→ 成功终态。
     * 转录读取失败 / AI 失败（含 AI 未配置）→ 该任务 failed（reason 中文、不落半成品笔记），
     * 转录临时文件尽力清理；单部失败即整批语义与 CLI 失败一致（继续剩余 / 遇错即停）。
     */
    async _aiStep(task, events, transcriptPath, videoPath, finish) {
      task.reason = AI_STEP_TEXT;
      void KnowledgeData.updateTask(task.id, { reason: AI_STEP_TEXT });
      events.onTaskProgress({ ...task }, AI_STEP_TEXT);
      let transcript;
      try {
        const fsMod = getFs();
        if (!fsMod || typeof fsMod.readFileSync !== "function" || !transcriptPath) {
          throw new Error("无转录文件");
        }
        transcript = fsMod.readFileSync(transcriptPath, "utf8");
      } catch (e) {
        tryUnlink(transcriptPath);
        finish(false, "转录文件读取失败", null, null);
        return;
      }
      let notePath;
      try {
        notePath = await generateVideoNote({
          transcript,
          videoTitle: task.title || "",
          url: task.url,
          uploader: task.uploader || "",
          // ticket 151：CLI 交付的 mp4 路径随笔记落盘（正文视频双链）；keepVideo=false 时为 null → 无视频段
          videoPath
        });
      } catch (e) {
        tryUnlink(transcriptPath);
        finish(false, `AI 生成文献笔记失败：${(e == null ? void 0 : e.message) || String(e)}`, null, null);
        return;
      }
      tryUnlink(transcriptPath);
      task.reason = NOTE_STEP_TEXT;
      void KnowledgeData.updateTask(task.id, { reason: NOTE_STEP_TEXT });
      events.onTaskProgress({ ...task }, NOTE_STEP_TEXT);
      finish(true, null, notePath, videoPath);
    },
    /** 终态落库 + 事件（resolve 于落库完成后）；成功 → 自动归档历史（archived+归档时间，ADR-0067） */
    async _finish(task, events, onEnd, ok, reason, notePath, videoPath) {
      var _a;
      task.status = ok ? "success" : "failed";
      task.reason = reason;
      task.notePath = ok ? notePath : task.notePath;
      task.videoPath = ok ? videoPath : task.videoPath;
      task.processedAt = nowTs();
      if (ok) {
        task.archived = true;
        task.archivedAt = task.processedAt;
      }
      try {
        await KnowledgeData.updateTask(task.id, {
          status: task.status,
          reason,
          notePath: task.notePath,
          videoPath: task.videoPath,
          processedAt: task.processedAt,
          archived: task.archived,
          archivedAt: task.archivedAt,
          // 内存态解析信息一并落库（ADR-0067）：终态写与信息写并发时，终态写携带新字段，
          // 避免读-改-写竞态把已落库的 title/uploader 覆盖丢失
          title: task.title,
          uploader: task.uploader
        });
      } catch (e) {
      }
      events.onTaskDone({ ...task });
      if (ok) {
        emitDomainEvent("knowledge:tasks", { kind: "converted", id: task.id, url: task.url, notePath: task.notePath });
      } else {
        emitDomainEvent("knowledge:tasks", { kind: "failed", id: task.id, url: task.url, notePath: (_a = task.notePath) != null ? _a : null });
      }
      onEnd(ok);
    }
  };

  // src/knowledge/mount-layout.ts
  var LAYOUT_PARAMS = {
    /** 斥力系数：rep = REP²/d，近距（d < need）×2.4 */
    REP: 150,
    /** Hooke 弹簧自然长度：rest = half(A)+half(B)+REST */
    REST: 160,
    /** 远距斥力截断倍数（× 作用半径 need），不截断图会炸开 */
    CUTOFF: 2.5,
    /** 每代 x 弱锚步长（只防漂移，单向流方向由「子卡在父卡右侧」软约束给） */
    X_STEP: 640,
    /** 退火轮数 */
    ITER: 420,
    /** 世界内边距：归一化基准（左/上）+ 右/下余量 */
    PAD: 60,
    /** 默认布局上限，超过按输入序降级进 `culled`（spec 风险 1） */
    MAX_NODES: 120
  };
  var NEED_GAP = 90;
  var REP_OVERLAP_BOOST = 2.4;
  var SPRING_K = 0.34;
  var ORDER_GAP = 56;
  var ORDER_K = 0.16;
  var ANCHOR_K = 0.012;
  var GRAVITY_X = 0.03;
  var GRAVITY_Y = 0.06;
  var COOL_SPAN = 0.85;
  var STEP_COOL = 12;
  var STEP_BASE = 3;
  var STEP_SCALE = 0.5;
  var SEPARATE_ROUNDS = 60;
  var SEPARATE_GAP_X = 40;
  var SEPARATE_GAP_Y = 34;
  var RESIDUAL_EPS = 1e-3;
  var RESIDUAL_GAP = 1;
  var RESIDUAL_ROUNDS = 300;
  var SEED_BASE_R = 150;
  var SEED_STEP_R = 46;
  var GOLDEN_ANGLE_RAD = 137.5 * Math.PI / 180;
  function positiveSize(v) {
    return Number.isFinite(v) && v > 0 ? v : 1;
  }
  function resolveMaxNodes(v) {
    if (v === void 0 || !Number.isFinite(v)) return LAYOUT_PARAMS.MAX_NODES;
    return Math.max(0, Math.floor(v));
  }
  function buildNodes(boxes, count) {
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const b = boxes[i];
      nodes.push({
        id: b.id,
        w: positiveSize(b.w),
        h: positiveSize(b.h),
        depth: Number.isFinite(b.depth) ? Math.max(0, Math.floor(b.depth)) : 0,
        active: true,
        x: 0,
        y: 0
      });
    }
    return nodes;
  }
  function seedPositions(nodes) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const ang = i * GOLDEN_ANGLE_RAD;
      const r = SEED_BASE_R + SEED_STEP_R * Math.sqrt(i);
      n.x = Math.cos(ang) * r + n.w / 2;
      n.y = Math.sin(ang) * r + n.h / 2;
    }
  }
  function markActive(nodes, viewport) {
    if (!viewport) return;
    const { x, y, w, h } = viewport;
    if (![x, y, w, h].every((v) => Number.isFinite(v)) || w <= 0 || h <= 0) return;
    for (const n of nodes) {
      n.active = n.x + n.w / 2 >= x && n.x - n.w / 2 <= x + w && n.y + n.h / 2 >= y && n.y - n.h / 2 <= y + h;
    }
    if (nodes.every((n) => !n.active)) {
      for (const n of nodes) n.active = true;
    }
  }
  function buildLinks(nodes, edges) {
    const indexById = /* @__PURE__ */ new Map();
    for (let i = 0; i < nodes.length; i++) indexById.set(nodes[i].id, i);
    const links = [];
    const seen = /* @__PURE__ */ new Set();
    for (const e of edges) {
      if (!e) continue;
      const a = indexById.get(e.from);
      const b = indexById.get(e.to);
      if (a === void 0 || b === void 0 || a === b) continue;
      const key2 = a + ">" + b;
      if (seen.has(key2)) continue;
      seen.add(key2);
      links.push({ a, b });
    }
    return links;
  }
  function relax(nodes, links) {
    const n = nodes.length;
    const fx = new Float64Array(n);
    const fy = new Float64Array(n);
    const ITER = LAYOUT_PARAMS.ITER;
    const REP = LAYOUT_PARAMS.REP;
    const PAD = LAYOUT_PARAMS.PAD;
    for (let it = 0; it < ITER; it++) {
      const cool = 1 - it / ITER * COOL_SPAN;
      fx.fill(0);
      fy.fill(0);
      for (let i = 0; i < n; i++) {
        const A = nodes[i];
        if (!A.active) continue;
        for (let j = i + 1; j < n; j++) {
          const B = nodes[j];
          if (!B.active) continue;
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const d = Math.hypot(dx, dy) || 1;
          const need = (A.w + A.h) / 4 + (B.w + B.h) / 4 + NEED_GAP;
          if (d > LAYOUT_PARAMS.CUTOFF * need) continue;
          const rep = REP * REP / d * (d < need ? REP_OVERLAP_BOOST : 1);
          const ux = dx / d;
          const uy = dy / d;
          fx[i] -= ux * rep;
          fy[i] -= uy * rep;
          fx[j] += ux * rep;
          fy[j] += uy * rep;
        }
      }
      for (const l of links) {
        const A = nodes[l.a];
        const B = nodes[l.b];
        if (!A.active || !B.active) continue;
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1;
        const rest = (A.w + A.h) / 4 + (B.w + B.h) / 4 + LAYOUT_PARAMS.REST;
        const att = (d - rest) * SPRING_K;
        const ux = dx / d;
        const uy = dy / d;
        fx[l.a] += ux * att;
        fy[l.a] += uy * att;
        fx[l.b] -= ux * att;
        fy[l.b] -= uy * att;
        const minDx = (A.w + B.w) / 2 + ORDER_GAP;
        if (B.x - A.x < minDx) {
          const push = (minDx - (B.x - A.x)) * ORDER_K;
          fx[l.b] += push;
          fx[l.a] -= push;
        }
      }
      let gx = 0;
      let gy = 0;
      for (const node of nodes) {
        gx += node.x;
        gy += node.y;
      }
      gx /= n;
      gy /= n;
      for (let i = 0; i < n; i++) {
        const node = nodes[i];
        if (!node.active) continue;
        const want = PAD + node.w / 2 + node.depth * LAYOUT_PARAMS.X_STEP;
        fx[i] += (want - node.x) * ANCHOR_K;
        fx[i] += (gx - node.x) * GRAVITY_X;
        fy[i] += (gy - node.y) * GRAVITY_Y;
      }
      for (let i = 0; i < n; i++) {
        const node = nodes[i];
        if (!node.active) continue;
        const f = Math.hypot(fx[i], fy[i]) || 1;
        const cap = STEP_COOL * cool + STEP_BASE;
        const k = f > cap ? cap / f : 1;
        node.x += fx[i] * k * STEP_SCALE;
        node.y += fy[i] * k * STEP_SCALE;
      }
    }
  }
  function pushRound(nodes, gapX, gapY, eps) {
    const n = nodes.length;
    let moved = false;
    for (let i = 0; i < n; i++) {
      const A = nodes[i];
      if (!A.active) continue;
      for (let j = i + 1; j < n; j++) {
        const B = nodes[j];
        if (!B.active) continue;
        const ox = (A.w + B.w) / 2 + gapX - Math.abs(B.x - A.x);
        const oy = (A.h + B.h) / 2 + gapY - Math.abs(B.y - A.y);
        if (ox <= eps || oy <= eps) continue;
        moved = true;
        if (ox <= oy) {
          const s = (B.x >= A.x ? 1 : -1) * (ox / 2);
          A.x -= s;
          B.x += s;
        } else {
          const s = (B.y >= A.y ? 1 : -1) * (oy / 2);
          A.y -= s;
          B.y += s;
        }
      }
    }
    return moved;
  }
  function separate(nodes) {
    for (let round = 0; round < SEPARATE_ROUNDS; round++) {
      if (!pushRound(nodes, SEPARATE_GAP_X, SEPARATE_GAP_Y, 0)) return;
    }
    resolveResidual(nodes);
  }
  function resolveResidual(nodes) {
    const n = nodes.length;
    for (let round = 0; round < RESIDUAL_ROUNDS; round++) {
      if (!pushRound(nodes, 0, 0, RESIDUAL_EPS)) return;
    }
    for (let sweep = 0; sweep < n; sweep++) {
      let moved = false;
      for (let j = 1; j < n; j++) {
        const B = nodes[j];
        if (!B.active) continue;
        for (let i = 0; i < j; i++) {
          const A = nodes[i];
          if (!A.active) continue;
          const ox = (A.w + B.w) / 2 - Math.abs(B.x - A.x);
          const oy = (A.h + B.h) / 2 - Math.abs(B.y - A.y);
          if (ox <= RESIDUAL_EPS || oy <= RESIDUAL_EPS) continue;
          const want = A.x + A.w / 2 + B.w / 2 + RESIDUAL_GAP;
          if (want > B.x) {
            B.x = want;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
  }
  function finalize(nodes, culled) {
    let minLeft = Infinity;
    let minTop = Infinity;
    for (const n of nodes) {
      if (n.x - n.w / 2 < minLeft) minLeft = n.x - n.w / 2;
      if (n.y - n.h / 2 < minTop) minTop = n.y - n.h / 2;
    }
    const shiftX = LAYOUT_PARAMS.PAD - minLeft;
    const shiftY = LAYOUT_PARAMS.PAD - minTop;
    const pos = {};
    let right = LAYOUT_PARAMS.PAD;
    let bottom = LAYOUT_PARAMS.PAD;
    for (const n of nodes) {
      const x = n.x - n.w / 2 + shiftX;
      const y = n.y - n.h / 2 + shiftY;
      pos[n.id] = { x, y };
      if (x + n.w > right) right = x + n.w;
      if (y + n.h > bottom) bottom = y + n.h;
    }
    return { pos, world: { w: right + LAYOUT_PARAMS.PAD, h: bottom + LAYOUT_PARAMS.PAD }, culled };
  }
  function layoutTree(boxes, edges, opts) {
    const maxNodes = resolveMaxNodes(opts == null ? void 0 : opts.maxNodes);
    const keptCount = Math.min(boxes.length, maxNodes);
    const culled = [];
    for (let i = keptCount; i < boxes.length; i++) culled.push(boxes[i].id);
    const nodes = buildNodes(boxes, keptCount);
    if (nodes.length === 0) {
      return { pos: {}, world: { w: LAYOUT_PARAMS.PAD * 2, h: LAYOUT_PARAMS.PAD * 2 }, culled };
    }
    seedPositions(nodes);
    markActive(nodes, opts == null ? void 0 : opts.viewport);
    relax(nodes, buildLinks(nodes, edges));
    separate(nodes);
    return finalize(nodes, culled);
  }

  // src/knowledge/mount-geom.ts
  function rectOf(b) {
    return { left: b.x, top: b.y, right: b.x + b.w, bottom: b.y + b.h };
  }
  function segRectHit(p, q2, r, margin = 0) {
    const dx = q2.x - p.x;
    const dy = q2.y - p.y;
    const pv = [-dx, dx, -dy, dy];
    const qv = [
      p.x - (r.left - margin),
      r.right + margin - p.x,
      p.y - (r.top - margin),
      r.bottom + margin - p.y
    ];
    let t0 = 0;
    let t1 = 1;
    for (let k = 0; k < 4; k++) {
      if (pv[k] === 0) {
        if (qv[k] < 0) return false;
      } else {
        const t = qv[k] / pv[k];
        if (pv[k] < 0) {
          if (t > t1) return false;
          if (t > t0) t0 = t;
        } else {
          if (t < t0) return false;
          if (t < t1) t1 = t;
        }
      }
    }
    return t1 > 0 && t0 < 1;
  }
  function cubicHit(r, P, c1, c2, Q, margin = 0) {
    const len = Math.hypot(c1.x - P.x, c1.y - P.y) + Math.hypot(c2.x - c1.x, c2.y - c1.y) + Math.hypot(Q.x - c2.x, Q.y - c2.y);
    const n = Math.max(4, Math.min(2e3, Math.ceil(len / 2)));
    const left = r.left - margin;
    const right = r.right + margin;
    const top = r.top - margin;
    const bottom = r.bottom + margin;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      const x = a * P.x + b * c1.x + c * c2.x + d * Q.x;
      const y = a * P.y + b * c1.y + c * c2.y + d * Q.y;
      if (x > left && x < right && y > top && y < bottom) return true;
    }
    return false;
  }

  // src/knowledge/mount-route.ts
  var ROUTE_PARAMS = { CS: 18, INF: 8, STUB: 12, PORT_PAD: 18, PORT_MIN: 14, ASTAR_MAX_NODES: 120 };
  var PULL_MARGIN = 5;
  var SMOOTH_MARGIN = 2;
  var TANGENT_SCALES = [1, 0.55, 0.3];
  var GRID_MARGIN_CELLS = 8;
  var SNAP_RADII = [3, 6, 9];
  var MAX_GRID_CELLS = 2e6;
  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }
  function exitCandidates(S, sb, portPad) {
    const ye = clamp(S.y, sb.top + portPad, sb.bottom - portPad);
    const xe = clamp(S.x, sb.left + portPad, sb.right - portPad);
    const cands = [
      { side: "L", d: S.x - sb.left, E: { x: sb.left, y: ye }, nOut: { x: -1, y: 0 } },
      { side: "R", d: sb.right - S.x, E: { x: sb.right, y: ye }, nOut: { x: 1, y: 0 } },
      { side: "T", d: S.y - sb.top, E: { x: xe, y: sb.top }, nOut: { x: 0, y: -1 } },
      { side: "B", d: sb.bottom - S.y, E: { x: xe, y: sb.bottom }, nOut: { x: 0, y: 1 } }
    ];
    const order = ["L", "R", "T", "B"];
    return cands.sort((a, b) => a.d !== b.d ? a.d - b.d : order.indexOf(a.side) - order.indexOf(b.side));
  }
  function entrySideOrder(b, a) {
    const ax = (a.left + a.right) / 2;
    const ay = (a.top + a.bottom) / 2;
    const bcx = (b.left + b.right) / 2;
    const bcy = (b.top + b.bottom) / 2;
    const cands = [
      { s: "L", d: Math.hypot(b.left - ax, bcy - ay) },
      { s: "T", d: Math.hypot(bcx - ax, b.top - ay) },
      { s: "B", d: Math.hypot(bcx - ax, b.bottom - ay) },
      { s: "R", d: Math.hypot(b.right - ax, bcy - ay) }
    ];
    const order = ["L", "T", "B", "R"];
    cands.sort((p, q2) => p.d !== q2.d ? p.d - q2.d : order.indexOf(p.s) - order.indexOf(q2.s));
    return cands.map((c) => c.s);
  }
  function sidePortAndNormal(side, b, portPad) {
    const vert = side === "L" || side === "R";
    if (vert) {
      const lo2 = b.top + portPad;
      const hi2 = b.bottom - portPad;
      return {
        T: { x: side === "L" ? b.left : b.right, y: clamp((b.top + b.bottom) / 2, lo2, hi2) },
        nOut: { x: side === "L" ? -1 : 1, y: 0 }
      };
    }
    const lo = b.left + portPad;
    const hi = b.right - portPad;
    return {
      T: { x: clamp((b.left + b.right) / 2, lo, hi), y: side === "T" ? b.top : b.bottom },
      nOut: { x: 0, y: side === "T" ? -1 : 1 }
    };
  }
  function along(p, dir, k) {
    return { x: p.x + dir.x * k, y: p.y + dir.y * k };
  }
  function rayCardDistance(p, dir, rects, margin) {
    const len = Math.hypot(dir.x, dir.y);
    if (!(len > 0)) return Infinity;
    const ux = dir.x / len;
    const uy = dir.y / len;
    const EPS = 1e-6;
    let best = Infinity;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const l = r.left - margin;
      const rr = r.right + margin;
      const t = r.top - margin;
      const b = r.bottom + margin;
      let t0 = 0;
      let t1 = Infinity;
      if (ux === 0) {
        if (p.x <= l || p.x >= rr) continue;
      } else {
        const a = (l - p.x) / ux;
        const c = (rr - p.x) / ux;
        t0 = Math.max(t0, Math.min(a, c));
        t1 = Math.min(t1, Math.max(a, c));
      }
      if (uy === 0) {
        if (p.y <= t || p.y >= b) continue;
      } else {
        const a = (t - p.y) / uy;
        const c = (b - p.y) / uy;
        t0 = Math.max(t0, Math.min(a, c));
        t1 = Math.min(t1, Math.max(a, c));
      }
      if (t1 <= EPS || t0 > t1) continue;
      const d = Math.max(t0, 0);
      if (d < best) best = d;
    }
    return best;
  }
  function stubDirty(p0, p1, rects) {
    if (Math.abs(p1.x - p0.x) < 1e-9 && Math.abs(p1.y - p0.y) < 1e-9) {
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (p0.x > r.left && p0.x < r.right && p0.y > r.top && p0.y < r.bottom) return true;
      }
      return false;
    }
    return segHitsAny(p0, p1, rects, 0);
  }
  function polylineClean(pts, rects) {
    for (let i = 0; i + 1 < pts.length; i++) if (segHitsAny(pts[i], pts[i + 1], rects, 0)) return false;
    return true;
  }
  function spread(vals, lo, hi, min) {
    if (hi < lo) {
      const mid = (lo + hi) / 2;
      lo = mid;
      hi = mid;
    }
    for (let i = 0; i < vals.length; i++) vals[i] = clamp(vals[i], lo, hi);
    for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] < min) vals[i] = vals[i - 1] + min;
    const over = vals.length > 0 ? vals[vals.length - 1] - hi : 0;
    if (over > 0) {
      for (let i = 0; i < vals.length; i++) vals[i] -= over;
      for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] < min) vals[i] = vals[i - 1] + min;
    }
  }
  function segHitsAny(p, q2, rects, margin) {
    for (let i = 0; i < rects.length; i++) {
      if (segRectHit(p, q2, rects[i], margin)) return true;
    }
    return false;
  }
  function curveHitsAny(P, c1, c2, Q, rects, margin) {
    for (let i = 0; i < rects.length; i++) {
      if (cubicHit(rects[i], P, c1, c2, Q, margin)) return true;
    }
    return false;
  }
  function pull(pts, rects, margin) {
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      for (; j > i + 1; j--) {
        if (!segHitsAny(pts[i], pts[j], rects, margin)) break;
      }
      out.push(pts[j]);
      i = j;
    }
    return out;
  }
  function isCurve(it) {
    return it.b !== void 0;
  }
  function pt(p) {
    return p.x.toFixed(1) + " " + p.y.toFixed(1);
  }
  function pathD(items) {
    let d = "M" + pt(items[0]);
    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      if (isCurve(it)) d += " C" + pt(it.b[1]) + " " + pt(it.b[2]) + " " + pt(it.b[3]);
      else d += " L" + pt(it);
    }
    return d;
  }
  function buildAstar(rects, cs, inf) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of rects) {
      if (r.left < minX) minX = r.left;
      if (r.top < minY) minY = r.top;
      if (r.right > maxX) maxX = r.right;
      if (r.bottom > maxY) maxY = r.bottom;
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    const margin = GRID_MARGIN_CELLS * cs;
    const ox = minX - margin;
    const oy = minY - margin;
    const gcols = Math.max(4, Math.ceil((maxX + margin - ox) / cs));
    const grows = Math.max(4, Math.ceil((maxY + margin - oy) / cs));
    if (gcols * grows > MAX_GRID_CELLS) return null;
    const blocked = new Uint8Array(gcols * grows);
    const inBounds = (x, y) => x >= 0 && y >= 0 && x < gcols && y < grows;
    const cx = (ix) => ox + ix * cs + cs / 2;
    const cy = (iy) => oy + iy * cs + cs / 2;
    const colOf = (px) => Math.floor((px - ox) / cs);
    const rowOf = (py) => Math.floor((py - oy) / cs);
    for (let x = 0; x < gcols; x++) {
      blocked[x] = 1;
      blocked[(grows - 1) * gcols + x] = 1;
    }
    for (let y = 0; y < grows; y++) {
      blocked[y * gcols] = 1;
      blocked[y * gcols + gcols - 1] = 1;
    }
    for (const r of rects) {
      const y0 = Math.max(0, Math.floor((r.top - inf - cs / 2 - oy) / cs));
      const y1 = Math.min(grows - 1, Math.ceil((r.bottom + inf - cs / 2 - oy) / cs));
      for (let iy = y0; iy <= y1; iy++) {
        const py = cy(iy);
        if (py < r.top - inf || py > r.bottom + inf) continue;
        const x0 = Math.max(0, Math.floor((r.left - inf - cs / 2 - ox) / cs));
        const x1 = Math.min(gcols - 1, Math.ceil((r.right + inf - cs / 2 - ox) / cs));
        for (let ix = x0; ix <= x1; ix++) {
          const px = cx(ix);
          if (px >= r.left - inf && px <= r.right + inf) blocked[iy * gcols + ix] = 1;
        }
      }
    }
    const scratch = [];
    function cellInCard(ix, iy) {
      const px = cx(ix);
      const py = cy(iy);
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (px > r.left && px < r.right && py > r.top && py < r.bottom) return true;
      }
      return false;
    }
    function free(idx, ix, iy) {
      if (!inBounds(ix, iy)) return;
      if (cellInCard(ix, iy)) return;
      if (blocked[idx]) {
        blocked[idx] = 0;
        scratch.push(idx);
      }
    }
    function openCell(p, dir) {
      const cxi = clamp(colOf(p.x), 0, gcols - 1);
      const cyi = clamp(rowOf(p.y), 0, grows - 1);
      for (let y = cyi - 2; y <= cyi + 2; y++) {
        for (let x = cxi - 2; x <= cxi + 2; x++) free(y * gcols + x, x, y);
      }
      for (let k = 1; k <= 6; k++) {
        const ex = cxi + Math.round((dir.x || 0) * k);
        const ey = cyi + Math.round((dir.y || 0) * k);
        if (!inBounds(ex, ey)) break;
        let reached = false;
        for (let y = ey - 1; y <= ey + 1; y++) {
          for (let x = ex - 1; x <= ex + 1; x++) {
            if (inBounds(x, y) && !cellInCard(x, y) && !blocked[y * gcols + x]) reached = true;
            free(y * gcols + x, x, y);
          }
        }
        if (reached) break;
      }
    }
    function restore() {
      for (let i = 0; i < scratch.length; i++) blocked[scratch[i]] = 1;
      scratch.length = 0;
    }
    function walkable(ix, iy) {
      return !cellInCard(ix, iy) && !blocked[iy * gcols + ix];
    }
    function snapCell(p) {
      const cxi = clamp(colOf(p.x), 0, gcols - 1);
      const cyi = clamp(rowOf(p.y), 0, grows - 1);
      if (walkable(cxi, cyi) && !segHitsAny(p, { x: cx(cxi), y: cy(cyi) }, rects, 0)) {
        return { x: cxi, y: cyi };
      }
      let fallback = null;
      let fbDist = Infinity;
      for (let ri = 0; ri < SNAP_RADII.length; ri++) {
        const rad = SNAP_RADII[ri];
        let best = null;
        let bestD = Infinity;
        for (let y = Math.max(0, cyi - rad); y <= Math.min(grows - 1, cyi + rad); y++) {
          for (let x = Math.max(0, cxi - rad); x <= Math.min(gcols - 1, cxi + rad); x++) {
            if (!walkable(x, y)) continue;
            const d = (x - cxi) * (x - cxi) + (y - cyi) * (y - cyi);
            if (d < fbDist) {
              fbDist = d;
              fallback = { x, y };
            }
            if (d < bestD && !segHitsAny(p, { x: cx(x), y: cy(y) }, rects, 0)) {
              bestD = d;
              best = { x, y };
            }
          }
        }
        if (best) return best;
      }
      return fallback;
    }
    const DX = [0, 1, 0, -1, 1, 1, -1, -1];
    const DY = [-1, 0, 1, 0, -1, 1, 1, -1];
    function solve(a, b, dirA, dirB) {
      openCell(a, dirA);
      openCell(b, dirB);
      const sC = snapCell(a);
      const gC = snapCell(b);
      if (!sC || !gC) {
        restore();
        return null;
      }
      const n = gcols * grows;
      const start = sC.y * gcols + sC.x;
      const goal = gC.y * gcols + gC.x;
      const dist = new Float64Array(n);
      dist.fill(Infinity);
      const prev = new Int32Array(n);
      prev.fill(-1);
      const done = new Uint8Array(n);
      const buckets = [];
      let maxc = 0;
      let found = false;
      dist[start] = 0;
      buckets[0] = [start];
      for (let c = 0; c <= maxc && !found; c++) {
        const q2 = buckets[c];
        if (!q2) continue;
        for (let qi = 0; qi < q2.length; qi++) {
          const cur = q2[qi];
          if (done[cur]) continue;
          done[cur] = 1;
          if (cur === goal) {
            found = true;
            break;
          }
          const ix = cur % gcols;
          const iy = (cur - ix) / gcols;
          for (let d = 0; d < 8; d++) {
            const nx = ix + DX[d];
            const ny = iy + DY[d];
            if (!inBounds(nx, ny)) continue;
            const ni = ny * gcols + nx;
            if (blocked[ni]) continue;
            const diag = DX[d] !== 0 && DY[d] !== 0;
            if (diag && (blocked[iy * gcols + nx] || blocked[ny * gcols + ix])) continue;
            const nc = c + (diag ? 14 : 10);
            if (nc < dist[ni]) {
              dist[ni] = nc;
              prev[ni] = cur;
              if (!buckets[nc]) buckets[nc] = [];
              buckets[nc].push(ni);
              if (nc > maxc) maxc = nc;
            }
          }
        }
      }
      restore();
      if (!found) return null;
      const points = [];
      let k = goal;
      while (k >= 0) {
        const kx = k % gcols;
        const ky = (k - kx) / gcols;
        points.push({ x: cx(kx), y: cy(ky) });
        k = prev[k];
      }
      points.reverse();
      points.unshift({ x: a.x, y: a.y });
      points.push({ x: b.x, y: b.y });
      return points;
    }
    return solve;
  }
  function routeEdges(boxes, edges, opts) {
    var _a;
    const out = new Array(edges.length);
    if (edges.length === 0) return out;
    const { CS, INF, STUB, PORT_PAD, PORT_MIN, ASTAR_MAX_NODES } = ROUTE_PARAMS;
    const strategy = (_a = opts == null ? void 0 : opts.strategy) != null ? _a : "astar";
    const nodes = boxes.map((b) => ({ box: b, rect: rectOf(b) }));
    const byId = /* @__PURE__ */ new Map();
    for (const n of nodes) if (!byId.has(n.box.id)) byId.set(n.box.id, n);
    const rects = nodes.map((n) => n.rect);
    const jobs = [];
    const groupKeys = [];
    const groups = /* @__PURE__ */ new Map();
    edges.forEach((e, idx) => {
      const src = byId.get(e.from);
      const dst = byId.get(e.to);
      if (!src || !dst) {
        out[idx] = { from: e.from, to: e.to, d: "", exit: "L", entry: "L", fallback: true };
        return;
      }
      const order = entrySideOrder(dst.rect, src.rect);
      let entry = order[0];
      let clean = false;
      for (const side of order) {
        const { T, nOut } = sidePortAndNormal(side, dst.rect, PORT_PAD);
        if (rayCardDistance(T, nOut, rects, 0) >= STUB) {
          entry = side;
          clean = true;
          break;
        }
      }
      if (!clean) {
        for (const side of order) {
          const { T, nOut } = sidePortAndNormal(side, dst.rect, PORT_PAD);
          if (rayCardDistance(T, nOut, rects, 0) >= 1) {
            entry = side;
            clean = true;
            break;
          }
        }
      }
      const key2 = dst.box.id + "\0" + entry;
      let g = groups.get(key2);
      if (!g) {
        g = [];
        groups.set(key2, g);
        groupKeys.push(key2);
      }
      const job = {
        idx,
        edge: e,
        src,
        dst,
        entry,
        T: { x: 0, y: 0 },
        nIn: { x: 0, y: 0 },
        T1: { x: 0, y: 0 },
        stub: STUB,
        clean
      };
      g.push(job);
      jobs.push(job);
    });
    for (const key2 of groupKeys) {
      const g = groups.get(key2);
      const side = g[0].entry;
      const b = g[0].dst.rect;
      const vert = side === "L" || side === "R";
      const lo = vert ? b.top + PORT_PAD : b.left + PORT_PAD;
      const hi = vert ? b.bottom - PORT_PAD : b.right - PORT_PAD;
      const coord = (j) => vert ? (j.src.rect.top + j.src.rect.bottom) / 2 : (j.src.rect.left + j.src.rect.right) / 2;
      const sorted = g.slice().sort((a, c) => {
        const d = coord(a) - coord(c);
        if (d < 0) return -1;
        if (d > 0) return 1;
        if (a.edge.from !== c.edge.from) return a.edge.from < c.edge.from ? -1 : 1;
        if (a.edge.to !== c.edge.to) return a.edge.to < c.edge.to ? -1 : 1;
        return a.idx - c.idx;
      });
      const mid = vert ? (b.top + b.bottom) / 2 : (b.left + b.right) / 2;
      const vals = [];
      for (let i = 0; i < sorted.length; i++) vals.push(mid + (i - (sorted.length - 1) / 2) * PORT_MIN);
      spread(vals, lo, hi, PORT_MIN);
      sorted.forEach((j, i) => {
        const v = vals[i];
        j.T = vert ? { x: side === "L" ? b.left : b.right, y: v } : { x: v, y: side === "T" ? b.top : b.bottom };
        j.nIn = vert ? { x: side === "L" ? 1 : -1, y: 0 } : { x: 0, y: side === "T" ? 1 : -1 };
        const nOut = { x: -j.nIn.x, y: -j.nIn.y };
        const gap = rayCardDistance(j.T, nOut, rects, 0);
        if (gap >= STUB) j.stub = STUB;
        else if (gap >= 1) j.stub = Math.max(0, gap - 1);
        else {
          j.stub = 0;
          j.clean = false;
        }
        j.T1 = along(j.T, nOut, j.stub);
      });
    }
    const astar = strategy === "astar" && nodes.length > 0 && boxes.length <= ASTAR_MAX_NODES ? buildAstar(rects, CS, INF) : null;
    for (const j of jobs) {
      const e = j.edge;
      const sb = j.src.rect;
      const S = e.anchor && Number.isFinite(e.anchor.x) && Number.isFinite(e.anchor.y) ? { x: e.anchor.x, y: e.anchor.y } : { x: sb.left, y: sb.top + 26 };
      const cands = exitCandidates(S, sb, PORT_PAD);
      let pick = null;
      let stub = STUB;
      for (const c of cands) {
        if (rayCardDistance(c.E, c.nOut, rects, 0) >= STUB) {
          pick = c;
          break;
        }
      }
      if (!pick) {
        for (const c of cands) {
          const gap = rayCardDistance(c.E, c.nOut, rects, 0);
          if (gap >= 1) {
            pick = c;
            stub = Math.max(0, gap - 1);
            break;
          }
        }
      }
      const exitClean = pick !== null;
      if (!pick) {
        pick = cands[0];
        stub = 0;
      }
      const exit = pick.side;
      const E = pick.E;
      const nOut = pick.nOut;
      const E1 = along(E, nOut, stub);
      const T = j.T;
      const nOutT = { x: -j.nIn.x, y: -j.nIn.y };
      const T1 = j.T1;
      const raw = astar ? astar(E1, T1, nOut, nOutT) : null;
      let dirty = !exitClean || !j.clean || stubDirty(E, E1, rects) || stubDirty(T1, T, rects);
      const items = [S, E, E1];
      if (raw) {
        const base = pull(raw, rects, PULL_MARGIN);
        if (!polylineClean(base, rects)) dirty = true;
        for (let i = 0; i < base.length - 1; i++) {
          const P0 = base[i];
          const P3 = base[i + 1];
          const len = Math.hypot(P3.x - P0.x, P3.y - P0.y) || 1;
          let done = false;
          for (let si = 0; si < TANGENT_SCALES.length && !done; si++) {
            const sc = TANGENT_SCALES[si];
            const c1 = i === 0 ? { x: P0.x + nOut.x * len * 0.34 * sc, y: P0.y + nOut.y * len * 0.34 * sc } : { x: P0.x + (P3.x - base[i - 1].x) / 6 * sc, y: P0.y + (P3.y - base[i - 1].y) / 6 * sc };
            const c2 = i === base.length - 2 ? { x: P3.x - j.nIn.x * len * 0.34 * sc, y: P3.y - j.nIn.y * len * 0.34 * sc } : { x: P3.x - (base[i + 2].x - P0.x) / 6 * sc, y: P3.y - (base[i + 2].y - P0.y) / 6 * sc };
            if (!curveHitsAny(P0, c1, c2, P3, rects, SMOOTH_MARGIN)) {
              items.push({ b: [P0, c1, c2, P3] });
              done = true;
            }
          }
          if (!done) items.push(P3);
        }
      } else {
        items.push(T1);
      }
      items.push(T);
      out[j.idx] = {
        from: e.from,
        to: e.to,
        d: pathD(items),
        exit,
        entry: j.entry,
        fallback: !raw || dirty
      };
    }
    return out;
  }

  // src/knowledge/mount-suggest.ts
  var SUGGEST_MIN_SCORE = 0.7;
  var SUGGEST_MIN_ANCHOR_CHARS = 6;
  var SUGGEST_MAX_ANCHORS = 12;
  var SUGGEST_TOPK = 8;
  var SUGGEST_POOL_SIZE = 10;
  var SUGGEST_MAX_PER_TARGET = 2;
  var SUGGEST_MAX_LOCATE_NOTES = 6;
  var SUGGEST_LOCATE_TEXT_CAP = 8e3;
  var SUGGEST_JUDGE_MAX_TOKENS = 131072;
  var SUGGEST_REASONING_EFFORT = "low";
  var REASON_MAX_CHARS = 80;
  var SUGGEST_CACHE_FILE = "mount-suggest.json";
  var SUGGEST_CACHE_VERSION = 4;
  var HAS_MEANING_RE = /[\p{L}\p{N}]/u;
  var WIKILINK_RE = /!?\[\[([^\[\]]+)\]\]/g;
  var BLOCK_ID_PREFIX = "bz-";
  function hash8(s) {
    const h = hash31(String(s != null ? s : "")) >>> 0;
    const hi = h >>> 16 & 65535;
    const lo = h & 65535;
    return hi.toString(36).padStart(4, "0") + lo.toString(36).padStart(4, "0");
  }
  function normLite(s) {
    return String(s != null ? s : "").replace(/[*_`~#]/g, "").replace(/\s+/g, "").trim().toLowerCase();
  }
  function idPath(path) {
    return String(path != null ? path : "").replace(/\\/g, "/").replace(/^\.\//, "").trim();
  }
  function subKeyOf(s) {
    var _a, _b;
    const sub = String((_a = s == null ? void 0 : s.subpath) != null ? _a : "").trim();
    if (sub) return hash8(normLite(sub));
    const q2 = String((_b = s == null ? void 0 : s.quote) != null ? _b : "").trim();
    return q2 ? hash8(normLite(q2)) : "";
  }
  function nextIsBoundary(text, i) {
    if (i >= text.length) return true;
    return /\s/.test(text[i]);
  }
  var LEADING_MARK_RE = /^(?:#{1,6}\s*|\[![^\]]*\]\s*|[-*+>]\s+|\d{1,3}[.)]\s+)+/;
  function wikiDisplay(inner) {
    const afterAlias = inner.includes("|") ? inner.slice(inner.lastIndexOf("|") + 1) : inner;
    const afterBlock = afterAlias.includes("^") ? afterAlias.slice(0, afterAlias.indexOf("^")) : afterAlias;
    const noHead = afterBlock.includes("#") ? afterBlock.slice(0, afterBlock.lastIndexOf("#") + 1) : afterBlock;
    return noHead || afterAlias || inner;
  }
  function stripUnclosedWiki(raw) {
    let text = String(raw != null ? raw : "");
    for (let guard = 0; guard < 8; guard++) {
      const open = text.lastIndexOf("[[");
      if (open < 0) break;
      if (text.indexOf("]]", open) > open) break;
      const inner = text.slice(open + 2);
      const afterAlias = inner.includes("|") ? inner.slice(inner.lastIndexOf("|") + 1) : "";
      text = text.slice(0, open) + afterAlias;
    }
    return text;
  }
  function cleanAnchorText(raw) {
    return stripUnclosedWiki(raw).replace(/!\[\[[^\[\]]*\]\]/g, " ").replace(/\[\[([^\[\]]+)\]\]/g, (_m, inner) => wikiDisplay(inner)).replace(/`+/g, "").replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim();
  }
  function pushAnchor(out, text, from, to) {
    let s = from;
    let e = to;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    const lead = text.slice(s, e).match(LEADING_MARK_RE);
    if (lead) s += lead[0].length;
    if (s >= e) return;
    const cleaned = cleanAnchorText(text.slice(s, e));
    if (!cleaned) return;
    if ([...cleaned].length < SUGGEST_MIN_ANCHOR_CHARS) return;
    if (!HAS_MEANING_RE.test(cleaned)) return;
    out.push({ from: s, to: e, text: cleaned });
  }
  function splitAnchors(body) {
    const text = String(body != null ? body : "");
    const out = [];
    let start = 0;
    for (let i = 0; i <= text.length; i++) {
      const ch = i === text.length ? "" : text[i];
      let boundary = i === text.length;
      if (!boundary) {
        if (ch === "\n" || ch === "。" || ch === "！" || ch === "？" || ch === "；" || ch === "…") boundary = true;
        else if (ch === "!") boundary = text[i - 1] !== "[" && text[i + 1] !== "[";
        else if (ch === "." || ch === "?" || ch === ";") boundary = nextIsBoundary(text, i + 1);
      }
      if (!boundary) continue;
      pushAnchor(out, text, start, i);
      start = i + 1;
    }
    return out;
  }
  function normalizeAnchorText(text) {
    return String(text != null ? text : "").replace(/\s+/g, " ").replace(/^[\s"'“”‘’《》〈〉「」『』]+/, "").replace(/[\s"'“”‘’《》〈〉「」『』]+$/, "").trim().toLowerCase();
  }
  function normalizeTargetPath(path) {
    return String(path != null ? path : "").replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.md$/i, "").trim().toLowerCase();
  }
  function suggestKey(s) {
    var _a;
    const sub = subKeyOf(s);
    return normalizeAnchorText((_a = s.anchor) == null ? void 0 : _a.text) + "\0" + normalizeTargetPath(s.target) + (sub ? "#" + sub : "");
  }
  function suggestionId(s) {
    const sub = subKeyOf(s);
    return `ai:${idPath(s == null ? void 0 : s.target)}${sub ? "#" + sub : ""}`;
  }
  function parseExistingLink(raw) {
    const s = String(raw != null ? raw : "").trim();
    const hash = s.indexOf("#");
    if (hash < 0) return { path: s, subpath: null };
    return { path: s.slice(0, hash), subpath: s.slice(hash + 1).trim() || null };
  }
  function matchesExisting(target, subpath, existing) {
    const t = normalizeTargetPath(target);
    if (!t) return false;
    const tBase = t.includes("/") ? t.slice(t.lastIndexOf("/") + 1) : t;
    const sub = String(subpath != null ? subpath : "").trim().toLowerCase();
    for (const raw of existing || []) {
      const e = parseExistingLink(raw);
      const ep = normalizeTargetPath(e.path);
      if (!ep) continue;
      if (ep !== t && ep !== tBase) continue;
      if (!e.subpath) return true;
      if (sub && e.subpath.toLowerCase() === sub) return true;
    }
    return false;
  }
  function filterSuggestions(list, opts) {
    var _a;
    const dismissed = new Set(((opts == null ? void 0 : opts.dismissed) || []).map((k) => String(k).trim().toLowerCase()));
    const existing = (opts == null ? void 0 : opts.existing) || [];
    const minScore = Number.isFinite(opts == null ? void 0 : opts.minScore) ? Number(opts == null ? void 0 : opts.minScore) : SUGGEST_MIN_SCORE;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const s of list || []) {
      if (!s || !s.target) continue;
      if (s.state === "dismissed" || s.state === "fixed") continue;
      if (!(Number(s.score) >= minScore)) continue;
      const key2 = suggestKey(s);
      if (dismissed.has(key2) || seen.has(key2)) continue;
      if (existing.length > 0 && matchesExisting(s.target, (_a = s.subpath) != null ? _a : null, existing)) continue;
      seen.add(key2);
      out.push(s);
    }
    return out;
  }
  function cacheStore() {
    return jsonFileStore(storageFile(SUGGEST_CACHE_FILE), { defaultValue: () => ({ cards: {} }) });
  }
  async function readSuggestCache() {
    const data = await cacheStore().read();
    const cards = data && typeof data === "object" && data.cards && typeof data.cards === "object" && !Array.isArray(data.cards) ? data.cards : {};
    return { cards };
  }
  function mutateSuggestCache(fn) {
    const path = storageFile(SUGGEST_CACHE_FILE);
    return enqueueFileTask(path, async () => {
      const file = await readSuggestCache();
      const result = await fn(file);
      await cacheStore().write(file);
      return result;
    });
  }
  function cacheValid(entry, bodyHash) {
    return !!entry && entry.ver === SUGGEST_CACHE_VERSION && !!bodyHash && typeof entry.bodyHash === "string" && entry.bodyHash === bodyHash;
  }
  function collectDismissedKeys(file) {
    const out = [];
    for (const entry of Object.values(file.cards || {})) {
      for (const s of (entry == null ? void 0 : entry.suggestions) || []) {
        if ((s == null ? void 0 : s.state) === "dismissed") out.push(suggestKey(s));
      }
    }
    return out;
  }
  function collectFixedKeys(entry) {
    return ((entry == null ? void 0 : entry.suggestions) || []).filter((s) => (s == null ? void 0 : s.state) === "fixed").map(suggestKey);
  }
  function persistCardCache(cardPath, bodyHash, generatedAt, suggestions) {
    return mutateSuggestCache((file) => {
      const prev = file.cards[cardPath];
      const kept = ((prev == null ? void 0 : prev.suggestions) || []).filter((s) => s && s.state !== "pending");
      const keptKeys = new Set(kept.map(suggestKey));
      const fresh = suggestions.filter((s) => !keptKeys.has(suggestKey(s)));
      file.cards[cardPath] = { bodyHash, generatedAt, suggestions: [...kept, ...fresh], ver: SUGGEST_CACHE_VERSION };
    }).then(() => void 0);
  }
  async function markSuggestion(cardPath, s, state2, ctx) {
    if (!cardPath || !s || !s.target) return;
    const key2 = suggestKey(s);
    const now = Date.now();
    await mutateSuggestCache((file) => {
      const prev = file.cards[cardPath];
      const entry = prev && typeof prev === "object" && Array.isArray(prev.suggestions) ? prev : { bodyHash: "", generatedAt: now, suggestions: [], ver: SUGGEST_CACHE_VERSION };
      const idx = entry.suggestions.findIndex((it) => suggestKey(it) === key2);
      const marked = { ...idx >= 0 ? entry.suggestions[idx] : s, state: state2 };
      if (idx >= 0) entry.suggestions[idx] = marked;
      else entry.suggestions.push(marked);
      file.cards[cardPath] = entry;
    });
  }
  function stripFrontmatter2(content) {
    return String(content != null ? content : "").replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
  }
  async function readNoteText(app, path) {
    var _a, _b, _c;
    try {
      const file = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getAbstractFileByPath) == null ? void 0 : _b.call(_a, path);
      if (!file) return null;
      return String((_c = await app.vault.read(file)) != null ? _c : "");
    } catch (e) {
      return null;
    }
  }
  function inRecallScope(path, cardboxDir) {
    const p = idPath(path);
    if (!p) return false;
    const dir = idPath(cardboxDir != null ? cardboxDir : getKnowledgeBoxes().cardbox);
    if (!dir) return false;
    return p === dir || p.startsWith(dir + "/");
  }
  function kindOfTarget(path, ctx, unit) {
    if (unit === "heading") return "head";
    if (unit === "paragraph") return "para";
    if (isUnderFolder((ctx == null ? void 0 : ctx.cardboxDir) || "", path)) return "card";
    if ((ctx == null ? void 0 : ctx.topicDir) && isUnderFolder(ctx.topicDir, path)) return "note";
    return "note";
  }
  function displayName(path) {
    const base = String(path || "").split("/").pop() || String(path || "");
    return stripMdExt(base);
  }
  function collectExistingTargets(body) {
    const text = String(body != null ? body : "");
    const out = [];
    WIKILINK_RE.lastIndex = 0;
    let m;
    while ((m = WIKILINK_RE.exec(text)) !== null) {
      const target = m[1].split("|")[0].trim();
      if (target) out.push(target);
    }
    return out;
  }
  function flattenForMatch(text) {
    const flat = [];
    const map = [];
    let i = 0;
    const src = String(text != null ? text : "");
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === "*" || ch === "_" || ch === "`" || ch === "~" || ch === ">" || ch === "|") {
        i++;
        continue;
      }
      if (ch === "…" || ch === "." && src.slice(i, i + 3) === "...") {
        i += ch === "…" ? 1 : 3;
        continue;
      }
      flat.push(ch.toLowerCase());
      map.push(i);
      i++;
    }
    return { flat: flat.join(""), map };
  }
  function keywordsOf(s) {
    const text = String(s != null ? s : "");
    const words = [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0].toLowerCase());
    const out = [];
    for (const w of words) {
      if (/[\p{Script=Han}]/u.test(w)) {
        if (w.length <= 2) out.push(w);
        else for (let i = 0; i + 2 <= w.length; i++) out.push(w.slice(i, i + 2));
      } else if (w.length >= 2) out.push(w);
    }
    return out.slice(0, 24);
  }
  function locateInText(text, needle, from = 0) {
    const src = String(text != null ? text : "");
    const want = String(needle != null ? needle : "").trim();
    if (!src || !want) return null;
    const start = Math.max(0, Math.min(Number(from) || 0, src.length));
    const exact = src.indexOf(want, start);
    if (exact >= 0) return { at: exact, len: want.length, level: 1 };
    const tail = src.slice(start);
    const { flat, map } = flattenForMatch(tail);
    const flatWant = flattenForMatch(want).flat;
    if (flatWant) {
      const hit = flat.indexOf(flatWant);
      if (hit >= 0 && map[hit] !== void 0) {
        const at = start + map[hit];
        const endIdx = hit + flatWant.length - 1;
        const end = map[endIdx] !== void 0 ? start + map[endIdx] + 1 : src.length;
        return { at, len: Math.max(1, end - at), level: 2 };
      }
    }
    const kws = keywordsOf(want);
    if (kws.length === 0) return null;
    const need = Math.max(1, Math.ceil(kws.length / 2));
    let best = null;
    const blockRe = /[^\n][\s\S]*?(?=\n\s*\n|$)/g;
    let m;
    while ((m = blockRe.exec(tail)) !== null) {
      const raw = m[0];
      if (!raw.trim()) continue;
      const flatBlock = flattenForMatch(raw).flat;
      let score = 0;
      for (const k of kws) if (flatBlock.includes(k)) score++;
      if (score < need) continue;
      const lead = raw.length - raw.trimStart().length;
      const at = start + m.index + lead;
      const len = raw.trimEnd().length - lead;
      if (!best || score > best.score) best = { at, len, score };
    }
    if (!best) return null;
    return { at: best.at, len: best.len, level: 3 };
  }
  function expandBlock(text, at, len) {
    const src = String(text != null ? text : "");
    let s = Math.max(0, Math.min(Number(at) || 0, src.length));
    let e = Math.max(s, Math.min(src.length, s + Math.max(0, Number(len) || 0)));
    const lb = src.slice(0, s).search(/\n[ \t]*\n[^\n]*$/);
    s = lb >= 0 ? lb + 1 : 0;
    const nb = src.slice(e).search(/\n[ \t]*\n/);
    e = nb >= 0 ? e + nb : src.length;
    while (s < e && /\s/.test(src[s])) s++;
    while (e > s && /\s/.test(src[e - 1])) e--;
    return { at: s, len: Math.max(0, e - s) };
  }
  function findHeadingText(content, heading) {
    const want = String(heading != null ? heading : "").trim();
    if (!want) return null;
    const wantKey = normLite(want);
    for (const line of String(content != null ? content : "").split(/\r?\n/)) {
      const m = /^(#{1,6})[ \t]+(.*)$/.exec(line);
      if (!m) continue;
      const text = m[2].trim();
      if (!text) continue;
      if (text === want || normLite(text) === wantKey) return text;
    }
    return null;
  }
  function sliceHeadingSection(content, headingText) {
    const src = String(content != null ? content : "");
    const lines = src.split(/\r?\n/);
    let start = -1;
    let level = 6;
    for (let i = 0; i < lines.length; i++) {
      const m = /^(#{1,6})[ \t]+(.*)$/.exec(lines[i]);
      if (!m) continue;
      if (m[2].trim() !== headingText) continue;
      start = i;
      level = m[1].length;
      break;
    }
    if (start < 0) return src.trim();
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const m = /^(#{1,6})[ \t]+/.exec(lines[i]);
      if (m && m[1].length <= level) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join("\n").trim();
  }
  function sliceUnitText(content, s) {
    var _a, _b;
    const text = stripFrontmatter2(content).trim();
    if (!text) return "";
    const unit = (s == null ? void 0 : s.unit) === "heading" || (s == null ? void 0 : s.unit) === "paragraph" ? s.unit : "whole";
    if (unit === "heading") {
      const real = findHeadingText(text, String((_a = s == null ? void 0 : s.heading) != null ? _a : ""));
      if (!real) return text;
      return sliceHeadingSection(text, real);
    }
    if (unit === "paragraph") {
      const hit = String((_b = s == null ? void 0 : s.quote) != null ? _b : "").trim() ? locateInText(text, String(s.quote)) : null;
      if (!hit) return text;
      const block = expandBlock(text, hit.at, hit.len);
      return text.slice(block.at, block.at + block.len).trim();
    }
    return text;
  }
  async function suggestionUnitMarkdown(app, s) {
    var _a;
    const reason = String((_a = s == null ? void 0 : s.reason) != null ? _a : "").trim() || "AI 建议：这张卡与主卡有实质关联。";
    const head = `> ${reason}`;
    const content = await readNoteText(app, s == null ? void 0 : s.target);
    if (content === null) return head;
    const unit = sliceUnitText(content, s);
    return unit ? `${head}

${unit}` : head;
  }
  function blockIdFor(path, blockText) {
    return BLOCK_ID_PREFIX + hash8(`${idPath(path)}
${String(blockText != null ? blockText : "").trim()}`);
  }
  async function ensureSuggestionBlockId(app, targetPath, quote) {
    const path = idPath(targetPath);
    if (!path || !String(quote != null ? quote : "").trim()) return { blockId: "", ok: false };
    try {
      return await enqueueFileTask(path, async () => {
        var _a, _b, _c;
        const file = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getAbstractFileByPath) == null ? void 0 : _b.call(_a, path);
        if (!file) return { blockId: "", ok: false };
        const text = String((_c = await app.vault.read(file)) != null ? _c : "");
        const hit = locateInText(text, quote);
        if (!hit) return { blockId: "", ok: false };
        const block = expandBlock(text, hit.at, hit.len);
        const blockText = text.slice(block.at, block.at + block.len);
        const existing = /\^([A-Za-z0-9-]+)\s*$/.exec(blockText);
        if (existing && existing[1].startsWith(BLOCK_ID_PREFIX)) return { blockId: existing[1], ok: true };
        const blockId = blockIdFor(path, blockText.replace(/\^([A-Za-z0-9-]+)\s*$/, "").trim());
        const trimmed = blockText.replace(/\s+$/, "");
        const next = text.slice(0, block.at) + `${trimmed} ^${blockId}` + text.slice(block.at + block.len);
        if (next !== text) await app.vault.modify(file, next);
        return { blockId, ok: true };
      });
    } catch (e) {
      console.warn("[mount-suggest] 补写块 id 失败", e);
      return { blockId: "", ok: false };
    }
  }
  function suggestionSubpath(s) {
    var _a;
    const sub = String((_a = s == null ? void 0 : s.subpath) != null ? _a : "").trim();
    if (!sub) return "";
    return (s == null ? void 0 : s.unit) === "paragraph" ? sub.startsWith("^") ? sub : `^${sub}` : sub;
  }
  function suggestionLink(s) {
    const core = idPath(s == null ? void 0 : s.target).replace(/\.md$/i, "");
    if (!core) return "";
    const sub = suggestionSubpath(s);
    return sub ? `[[${core}#${sub}]]` : `[[${core}]]`;
  }
  function suggestionLinkTarget(s) {
    return suggestionLink(s).replace(/^\[\[/, "").replace(/\]\]$/, "");
  }
  function replaceAnchorWithAlias(body, anchor, target, subpath) {
    var _a;
    const src = String(body != null ? body : "");
    const text = String((_a = anchor == null ? void 0 : anchor.text) != null ? _a : "").trim();
    const core = idPath(target).replace(/\.md$/i, "");
    if (!src || !text || !core) return null;
    if (src.includes(`[[${core}`)) return src;
    const hit = locateInText(src, text);
    if (!hit) return null;
    if (hit.level === 3) return null;
    if (/\[\[|\]\]/.test(src.slice(hit.at, hit.at + hit.len))) return null;
    const link = subpath ? `[[${core}#${subpath}|${text}]]` : `[[${core}|${text}]]`;
    return src.slice(0, hit.at) + link + src.slice(hit.at + hit.len);
  }
  var QUERY_PROMPT_PREFIX = [
    "你是卡片盒挂载树的检索查询官。给定一张主卡正文里带编号的若干片段，为**每个片段**生成两条检索查询：",
    "1) sentence：把该片段改写成一句 20–40 字的完整短句（保留原意与关键术语，用于语义向量召回——",
    "   关键词堆在向量查询侧会失配，召回质量差）；",
    "2) keywords：该片段的 3–6 个检索关键词（空格分隔，不要写句子）。",
    '输出要求：严格 JSON 数组 [{"seg":<片段编号>,"sentence":"…","keywords":"…","why":"一句话说明该片段在讲什么"}]，',
    "按片段编号升序；不要输出 JSON 以外的任何文字。"
  ].join("");
  function buildQueryPrompt(anchors) {
    const lines = [QUERY_PROMPT_PREFIX, "", "## 主卡正文片段"];
    anchors.forEach((a, i) => lines.push(`### s${i + 1}：${a.text}`));
    return lines.join("\n");
  }
  var ADOPT_PROMPT_PREFIX = [
    "你是卡片盒挂载树的采纳官。给定主卡正文里带编号的片段，以及每个片段经检索召回的候选笔记",
    "（名称 / 路径 / 命中次数 / 最高分 / 命中块摘要），判断「片段」与「候选笔记」是否存在实质知识关联",
    "（共同主题、直接引用、同一事件或人物、强互补上下文）。",
    "标准：只推实质关联，弱关联（仅任务级/提及级）不推，存疑不推；宁缺勿滥。",
    "重要：下一轮还有定位官会**现读候选全文**复核，并且**可以否决**你选的配对——只要整体相关就选，",
    "不要为了自洽硬凑，也不要因为看不到全文就放弃。",
    `同一目标笔记最多选 ${SUGGEST_MAX_PER_TARGET} 条；关联分低于 ${SUGGEST_MIN_SCORE} 的一律不输出。`,
    '输出要求：严格 JSON 数组 [{"seg":<片段编号>,"path":"<候选路径原文>","score":<0到1>,"reason":"一句话理由"}]，',
    "按关联强度降序；确实没有关联就输出 []；不要输出 JSON 以外的任何文字。"
  ].join("");
  function buildAdoptPrompt(segs, pool) {
    const lines = [ADOPT_PROMPT_PREFIX, "", "## 主卡正文片段"];
    segs.forEach((a, i) => lines.push(`### s${i + 1}：${a.text}`));
    lines.push("", "## 候选笔记（检索召回池）");
    pool.forEach((c, i) => {
      const snippet = c.snippet ? "｜" + c.snippet.replace(/\s+/g, " ") : "";
      lines.push(
        `- c${i + 1}：${displayName(c.path)}（${c.path}）命中 ${c.hitCount} 次 · 最高分 ${c.maxScore.toFixed(3)}｜片段 ${c.segs.map((s) => "s" + (s + 1)).join("/")}${snippet}`
      );
    });
    return lines.join("\n");
  }
  var LOCATE_PROMPT_PREFIX = [
    "你是卡片盒挂载树的定位官。上一轮采纳官已选出若干「主卡片段 → 目标笔记」配对，现在**现读目标笔记全文**，",
    "为每条配对决定挂载粒度与锚定位置：",
    '- unit="whole"：整篇都相关（理由里说清为什么整篇相关）；',
    '- unit="heading"：只有某个标题下的小节相关 → heading 填**该小节标题的原文**（逐字，不得改写）；',
    '- unit="paragraph"：只有某一段相关 → quote 填**该段原文摘录**（逐字，20–80 字，不得改写、不得加省略号、',
    "  不要把表格行改写成空格分隔）；",
    "- skip=true：其实不相关，否决这条（宁可少推，也不要泛泛的链接）。",
    "anchor 填**主卡正文里的锚点原文**（逐字摘录自该片段，不要改写、不要加引号、不要加省略号）。",
    '输出要求：严格 JSON 数组 [{"n":<配对编号>,"unit":"whole|heading|paragraph","heading":"…","quote":"…",',
    '"anchor":"…","reason":"一句话理由","skip":false}]，按配对编号升序；全部否决输出 []；',
    "不要输出 JSON 以外的任何文字。"
  ].join("");
  function outlineForLocate(content) {
    const body = stripFrontmatter2(content);
    const out = [];
    let p = 0;
    for (const line of body.split(/\r?\n/)) {
      if (/^#{1,6}[ \t]+/.test(line)) {
        out.push(line);
        continue;
      }
      if (!line.trim()) continue;
      p++;
      out.push(`（${p}）${line}`);
    }
    const text = out.join("\n");
    return text.length > SUGGEST_LOCATE_TEXT_CAP ? text.slice(0, SUGGEST_LOCATE_TEXT_CAP) + "\n…（后文略）" : text;
  }
  function buildLocatePrompt(items) {
    const lines = [LOCATE_PROMPT_PREFIX, ""];
    items.forEach((it, i) => {
      lines.push(`## n${i + 1} · ${it.path}`);
      lines.push(`主卡锚点原文：${it.anchor.text}`);
      lines.push("", "### 目标笔记全文", outlineForLocate(it.content), "");
    });
    return lines.join("\n");
  }
  function pickIndex(v) {
    if (typeof v === "number") return Number.isInteger(v) ? v : NaN;
    const m = String(v != null ? v : "").trim().match(/\d+/);
    return m ? parseInt(m[0], 10) : NaN;
  }
  function digArray(value, depth = 0) {
    if (Array.isArray(value)) return value;
    if (depth > 3) return null;
    if (typeof value === "string") {
      const s = value.trim();
      if (!s.startsWith("[") && !s.startsWith("{")) return null;
      try {
        return digArray(JSON.parse(s), depth + 1);
      } catch (e) {
        return null;
      }
    }
    if (!value || typeof value !== "object") return null;
    const obj = value;
    for (const key2 of ["suggestions", "picks", "result", "items", "data", "list", "queries", "content"]) {
      const hit = digArray(obj[key2], depth + 1);
      if (hit) return hit;
    }
    for (const v of Object.values(obj)) {
      const hit = digArray(v, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  function takeArray(raw) {
    const text = String(raw != null ? raw : "").replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
    if (!text) return null;
    let value = null;
    try {
      value = JSON.parse(text);
    } catch (e) {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) {
        try {
          value = JSON.parse(m[0]);
        } catch (e2) {
          value = null;
        }
      }
    }
    return digArray(value);
  }
  function str(v, cap = 0) {
    const s = String(v != null ? v : "").replace(/\s+/g, " ").trim();
    return cap > 0 ? s.slice(0, cap) : s;
  }
  function bool(v) {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return /^(true|yes|y|是|1)$/i.test(String(v != null ? v : "").trim());
  }
  function parseQueryList(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const arr = takeArray(raw);
    if (!arr) return { found: false, count: 0, items: [] };
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const it = item;
      const seg = pickIndex((_c = (_b = (_a = it.seg) != null ? _a : it.segment) != null ? _b : it.n) != null ? _c : it.anchor);
      const sentence = str((_e = (_d = it.sentence) != null ? _d : it.query) != null ? _e : it.q);
      const keywords = str((_h = (_g = (_f = it.keywords) != null ? _f : it.keyword) != null ? _g : it.terms) != null ? _h : it.kw);
      if (!Number.isInteger(seg) || !sentence && !keywords) continue;
      out.push({ seg, sentence: sentence || keywords, keywords: keywords || sentence, why: str(it.why, REASON_MAX_CHARS) });
    }
    return { found: true, count: arr.length, items: out };
  }
  function parseAdoptPicks(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const arr = takeArray(raw);
    if (!arr) return { found: false, count: 0, items: [] };
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const it = item;
      const seg = pickIndex((_c = (_b = (_a = it.seg) != null ? _a : it.segment) != null ? _b : it.n) != null ? _c : it.anchor);
      const path = str((_f = (_e = (_d = it.path) != null ? _d : it.target) != null ? _e : it.note) != null ? _f : it.file);
      const score = Number((_h = (_g = it.score) != null ? _g : it.s) != null ? _h : it.confidence);
      if (!Number.isInteger(seg) || !path || !Number.isFinite(score)) continue;
      out.push({ seg, path, score: Math.max(0, Math.min(1, score)), reason: str(it.reason, REASON_MAX_CHARS) });
    }
    return { found: true, count: arr.length, items: out };
  }
  function normalizeUnit(v) {
    const s = String(v != null ? v : "").trim().toLowerCase();
    if (!s) return "";
    if (/^(whole|all|note|整篇|全文|整篇笔记)$/.test(s)) return "whole";
    if (/^(heading|head|headline|section|h[1-6]?|标题|小节)$/.test(s)) return "heading";
    if (/^(paragraph|para|block|quote|passage|段落|段)$/.test(s)) return "paragraph";
    if (/^(skip|none|null|否决|不相关)$/.test(s)) return "skip";
    return "";
  }
  function parseLocatePicks(raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const arr = takeArray(raw);
    if (!arr) return { found: false, count: 0, items: [] };
    const out = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const it = item;
      const n = pickIndex((_d = (_c = (_b = (_a = it.n) != null ? _a : it.seg) != null ? _b : it.index) != null ? _c : it.i) != null ? _d : it.pair);
      if (!Number.isInteger(n)) continue;
      const rawUnit = normalizeUnit((_f = (_e = it.unit) != null ? _e : it.type) != null ? _f : it.level);
      const skip = bool((_h = (_g = it.skip) != null ? _g : it.reject) != null ? _h : it.veto) || rawUnit === "skip";
      const unit = rawUnit === "" || rawUnit === "skip" ? "whole" : rawUnit;
      out.push({
        n,
        skip,
        unit,
        heading: str((_j = (_i = it.heading) != null ? _i : it.title) != null ? _j : it.section),
        quote: str((_l = (_k = it.quote) != null ? _k : it.excerpt) != null ? _l : it.text),
        anchor: str(it.anchor),
        reason: str(it.reason, REASON_MAX_CHARS)
      });
    }
    return { found: true, count: arr.length, items: out };
  }
  function aggregatePool(hits, opts) {
    var _a, _b, _c, _d;
    const limit = Number.isFinite(opts == null ? void 0 : opts.limit) ? Math.max(1, Number(opts == null ? void 0 : opts.limit)) : SUGGEST_POOL_SIZE;
    const selfKey = normalizeTargetPath((opts == null ? void 0 : opts.selfPath) || "");
    const byPath = /* @__PURE__ */ new Map();
    const seenQuery = /* @__PURE__ */ new Map();
    for (const h of hits || []) {
      const p = String((_a = h == null ? void 0 : h.path) != null ? _a : "").trim();
      if (!p) continue;
      const key2 = normalizeTargetPath(p);
      if (!key2 || key2 === selfKey) continue;
      if (!inRecallScope(p, opts == null ? void 0 : opts.cardboxDir)) continue;
      let entry = byPath.get(key2);
      if (!entry) {
        entry = { path: p, hitCount: 0, maxScore: 0, snippet: "", segs: [] };
        byPath.set(key2, entry);
        seenQuery.set(key2, /* @__PURE__ */ new Set());
      }
      const qk = `${(_b = h == null ? void 0 : h.seg) != null ? _b : -1}\0${String((_c = h == null ? void 0 : h.query) != null ? _c : "")}`;
      const qs = seenQuery.get(key2);
      if (!qs.has(qk)) {
        qs.add(qk);
        entry.hitCount++;
      }
      const score = Number(h == null ? void 0 : h.score);
      if (Number.isFinite(score) && score > entry.maxScore) {
        entry.maxScore = score;
        entry.snippet = String((_d = h == null ? void 0 : h.chunk) != null ? _d : "").slice(0, 200);
      }
      if (Number.isInteger(h == null ? void 0 : h.seg) && !entry.segs.includes(h.seg)) entry.segs.push(h.seg);
    }
    const all = [...byPath.values()];
    for (const e of all) e.segs.sort((a, b) => a - b);
    const ranked = all.slice().sort((a, b) => b.hitCount - a.hitCount || b.maxScore - a.maxScore);
    const out = [];
    const taken = /* @__PURE__ */ new Set();
    const segBest = /* @__PURE__ */ new Map();
    for (const e of ranked) {
      for (const seg of e.segs) {
        const cur = segBest.get(seg);
        if (!cur || e.maxScore > cur.maxScore) segBest.set(seg, e);
      }
    }
    for (const e of ranked) {
      if (!e.segs.some((seg) => segBest.get(seg) === e)) continue;
      const key2 = normalizeTargetPath(e.path);
      if (taken.has(key2)) continue;
      taken.add(key2);
      out.push(e);
      if (out.length >= limit) return out;
    }
    for (const e of ranked) {
      const key2 = normalizeTargetPath(e.path);
      if (taken.has(key2)) continue;
      taken.add(key2);
      out.push(e);
      if (out.length >= limit) break;
    }
    return out;
  }
  var STAGE_LABEL = {
    query: "查询官：为正文片段生成检索查询",
    recall: "检索：召回候选笔记",
    adopt: "采纳官：判断片段与候选的关联",
    locate: "定位官：现读全文定粒度",
    save: "落缓存"
  };
  var STAGE_PERCENT = {
    query: 15,
    recall: 40,
    adopt: 65,
    locate: 90,
    save: 100
  };
  function suggestProgressLabel(p) {
    var _a;
    const base = (_a = STAGE_LABEL[p == null ? void 0 : p.stage]) != null ? _a : "";
    const total = Number(p == null ? void 0 : p.total);
    const done = Number(p == null ? void 0 : p.done);
    const tail = Number.isFinite(total) && total > 0 && Number.isFinite(done) ? `（${done}/${total}）` : "";
    return base + tail;
  }
  function suggestProgressPercent(p) {
    var _a;
    const base = (_a = STAGE_PERCENT[p == null ? void 0 : p.stage]) != null ? _a : 0;
    const total = Number(p == null ? void 0 : p.total);
    const done = Number(p == null ? void 0 : p.done);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(done)) return base;
    const prev = p.stage === "recall" ? STAGE_PERCENT.query : p.stage === "locate" ? STAGE_PERCENT.adopt : base;
    return Math.round(prev + (base - prev) * Math.min(1, Math.max(0, done / total)));
  }
  function aiPrompt(text) {
    return createAI().prompt(text, void 0, {
      modelOptions: { max_tokens: SUGGEST_JUDGE_MAX_TOKENS, reasoning_effort: SUGGEST_REASONING_EFFORT }
    });
  }
  async function generateSuggestions(cardPath, ctx, opts) {
    var _a, _b, _c, _d, _e, _f, _g;
    const empty = (status) => ({ status, suggestions: [] });
    const tell = (stage, done, total) => {
      var _a2;
      const p = { stage, label: "", done, total };
      p.label = suggestProgressLabel(p);
      try {
        (_a2 = opts == null ? void 0 : opts.onProgress) == null ? void 0 : _a2.call(opts, p);
      } catch (e) {
      }
    };
    if (isMobileEnv()) return empty("no-index");
    const searchApi = exportVectorSearch();
    if (!searchApi || !searchApi.isIndexReady()) return empty("no-index");
    const auto = ((_a = tryGetSettings()) == null ? void 0 : _a.knowledgeMountAutoSuggest) !== false;
    if (!auto && !(opts == null ? void 0 : opts.force)) return empty("off");
    try {
      await getAIProvider();
    } catch (e) {
      return empty("no-ai");
    }
    const file = (_d = (_c = (_b = ctx == null ? void 0 : ctx.app) == null ? void 0 : _b.vault) == null ? void 0 : _c.getAbstractFileByPath) == null ? void 0 : _d.call(_c, cardPath);
    let content = "";
    if (file) {
      try {
        content = await ctx.app.vault.read(file);
      } catch (e) {
        console.warn("[mount-suggest] 主卡读取失败", e);
      }
    }
    const body = stripFrontmatter2(content);
    if (!body.trim()) return empty("fresh");
    const bodyHash = String(hash31(body));
    const cacheFile = await readSuggestCache();
    const entry = cacheFile.cards[cardPath];
    const dismissed = collectDismissedKeys(cacheFile);
    const existing = collectExistingTargets(body);
    if (!(opts == null ? void 0 : opts.force) && cacheValid(entry, bodyHash)) {
      return {
        status: "cached",
        suggestions: filterSuggestions(entry.suggestions, { dismissed, existing, minScore: SUGGEST_MIN_SCORE }),
        generatedAt: entry.generatedAt
      };
    }
    const anchors = splitAnchors(body).slice(0, SUGGEST_MAX_ANCHORS);
    if (anchors.length === 0) {
      const generatedAt2 = Date.now();
      await persistCardCache(cardPath, bodyHash, generatedAt2, []);
      return { status: "fresh", suggestions: [], generatedAt: generatedAt2 };
    }
    const dismissedSet = new Set(dismissed);
    const fixedSet = new Set(collectFixedKeys(entry));
    tell("query", 0, anchors.length);
    const queries = anchors.map((a) => [a.text]);
    try {
      const raw = await aiPrompt(buildQueryPrompt(anchors));
      const parsed = parseQueryList(raw);
      if (parsed.found) {
        for (const it of parsed.items) {
          const i = it.seg - 1;
          if (i < 0 || i >= anchors.length) continue;
          const pair = [it.sentence, it.keywords].filter((s) => String(s != null ? s : "").trim());
          if (pair.length) queries[i] = pair;
        }
      } else {
        console.warn("[mount-suggest] 查询官回答不可用，退回机械分句当查询");
      }
    } catch (e) {
      console.warn("[mount-suggest] 查询官失败，退回机械分句当查询", e);
    }
    tell("query", anchors.length, anchors.length);
    const recallTotal = queries.reduce((n, q2) => n + q2.length, 0);
    let recallDone = 0;
    const hits = [];
    let searchFailed = false;
    for (let i = 0; i < queries.length; i++) {
      for (const q2 of queries[i]) {
        try {
          const got = await searchApi.search(q2, SUGGEST_TOPK) || [];
          for (const h of got) {
            if (!h || !h.path) continue;
            hits.push({ seg: i, query: q2, path: h.path, score: Number(h.score) || 0, chunk: String(h.chunk || "") });
          }
        } catch (e) {
          console.warn("[mount-suggest] 向量检索失败，按降级处理", e);
          searchFailed = true;
          break;
        }
        recallDone++;
        tell("recall", recallDone, recallTotal);
      }
      if (searchFailed) break;
    }
    if (searchFailed) return empty("no-index");
    const pool = aggregatePool(hits, { selfPath: cardPath, limit: SUGGEST_POOL_SIZE, cardboxDir: ctx.cardboxDir }).filter((c) => {
      if (!ctx.app.vault.getAbstractFileByPath(c.path)) return false;
      return !matchesExisting(c.path, null, existing);
    });
    if (pool.length === 0) {
      const generatedAt2 = Date.now();
      await persistCardCache(cardPath, bodyHash, generatedAt2, []);
      return { status: "fresh", suggestions: [], generatedAt: generatedAt2 };
    }
    tell("adopt");
    let rawAdopt = "";
    try {
      rawAdopt = await aiPrompt(buildAdoptPrompt(anchors, pool));
    } catch (e) {
      console.warn("[mount-suggest] 采纳官失败", e);
      return empty("no-ai");
    }
    const adoptedParsed = parseAdoptPicks(rawAdopt);
    if (!adoptedParsed.found || adoptedParsed.count > 0 && adoptedParsed.items.length === 0) {
      console.warn(
        `[mount-suggest] 采纳官回答不可用（${rawAdopt ? `${rawAdopt.length} 字` : "空"}，数组 ${adoptedParsed.count} 条）：${String(
          rawAdopt
        ).slice(0, 120)}`
      );
      return empty("no-answer");
    }
    const pathToEntry = /* @__PURE__ */ new Map();
    for (const c of pool) {
      pathToEntry.set(normalizeTargetPath(c.path), c);
      const base = normalizeTargetPath(c.path).split("/").pop() || "";
      if (base && !pathToEntry.has(base)) pathToEntry.set(base, c);
    }
    const adopted = [];
    const perTarget = /* @__PURE__ */ new Map();
    for (const pick of adoptedParsed.items) {
      if (pick.score < SUGGEST_MIN_SCORE) continue;
      const a = anchors[pick.seg - 1];
      const c = (_e = pathToEntry.get(normalizeTargetPath(pick.path))) != null ? _e : pathToEntry.get(normalizeTargetPath(pick.path).split("/").pop() || "");
      if (!a || !c) continue;
      const tKey = normalizeTargetPath(c.path);
      if (((_f = perTarget.get(tKey)) != null ? _f : 0) >= SUGGEST_MAX_PER_TARGET) continue;
      if (dismissedSet.has(suggestKey({ anchor: a, target: c.path }))) continue;
      if (fixedSet.has(suggestKey({ anchor: a, target: c.path }))) continue;
      perTarget.set(tKey, ((_g = perTarget.get(tKey)) != null ? _g : 0) + 1);
      adopted.push({ anchor: a, entry: c, score: pick.score, reason: pick.reason });
    }
    if (adoptedParsed.count === 0 || adopted.length === 0) {
      const generatedAt2 = Date.now();
      await persistCardCache(cardPath, bodyHash, generatedAt2, []);
      return { status: "fresh", suggestions: [], generatedAt: generatedAt2 };
    }
    const locateList = adopted.slice(0, SUGGEST_MAX_LOCATE_NOTES);
    tell("locate", 0, locateList.length);
    const texts = [];
    for (const ad of locateList) texts.push(await readNoteText(ctx.app, ad.entry.path));
    let located = null;
    try {
      const rawLocate = await aiPrompt(
        buildLocatePrompt(
          locateList.map((ad, i) => {
            var _a2;
            return { anchor: ad.anchor, path: ad.entry.path, content: (_a2 = texts[i]) != null ? _a2 : "" };
          })
        )
      );
      const parsed = parseLocatePicks(rawLocate);
      if (parsed.found && parsed.items.length > 0) located = parsed.items;
      else console.warn("[mount-suggest] 定位官回答不可用，采纳结果按整篇兜底");
    } catch (e) {
      console.warn("[mount-suggest] 定位官失败，采纳结果按整篇兜底", e);
    }
    const suggestions = [];
    locateList.forEach((ad, i) => {
      var _a2;
      const pick = located ? (_a2 = located.find((p) => p.n === i + 1)) != null ? _a2 : null : null;
      if (located && !pick) {
        console.warn(`[mount-suggest] 定位官未给出 n${i + 1}（${ad.entry.path}），按整篇兜底`);
      }
      if (pick == null ? void 0 : pick.skip) return;
      suggestions.push(buildSuggestion(ctx, ad, pick, texts[i]));
    });
    tell("locate", locateList.length, locateList.length);
    for (let i = SUGGEST_MAX_LOCATE_NOTES; i < adopted.length; i++) {
      suggestions.push(buildSuggestion(ctx, adopted[i], null, null));
    }
    const filtered = filterSuggestions(suggestions, { dismissed, existing, minScore: SUGGEST_MIN_SCORE });
    tell("save");
    const generatedAt = Date.now();
    await persistCardCache(cardPath, bodyHash, generatedAt, filtered);
    return { status: "fresh", suggestions: filtered, generatedAt };
  }
  function buildSuggestion(ctx, ad, pick, targetText) {
    var _a, _b, _c, _d, _e, _f;
    let anchor = { ...ad.anchor };
    const modelAnchor = String((_a = pick == null ? void 0 : pick.anchor) != null ? _a : "").trim();
    if (modelAnchor && modelAnchor !== ad.anchor.text) {
      const hit = locateInText(ad.anchor.text, modelAnchor);
      if (hit) anchor = { from: ad.anchor.from + hit.at, to: ad.anchor.from + hit.at + hit.len, text: ad.anchor.text.slice(hit.at, hit.at + hit.len) };
    }
    const reason = String((_c = (_b = pick == null ? void 0 : pick.reason) != null ? _b : ad.reason) != null ? _c : "").trim() || "相关主题";
    let unit = (_d = pick == null ? void 0 : pick.unit) != null ? _d : "whole";
    let heading = String((_e = pick == null ? void 0 : pick.heading) != null ? _e : "").trim();
    let quote = String((_f = pick == null ? void 0 : pick.quote) != null ? _f : "").trim();
    let subpath = "";
    if (unit === "heading") {
      const real = targetText ? findHeadingText(targetText, heading) : null;
      if (!real) {
        unit = "whole";
        heading = "";
      } else {
        heading = real;
        subpath = real;
      }
    } else if (unit === "paragraph") {
      const hit = targetText && quote ? locateInText(targetText, quote) : null;
      if (!hit) {
        unit = "whole";
        quote = "";
      }
    }
    if (unit === "whole") {
      heading = "";
      quote = "";
    }
    return {
      anchor,
      target: ad.entry.path,
      kind: kindOfTarget(ad.entry.path, ctx, unit),
      reason,
      score: ad.score,
      state: "pending",
      unit,
      heading,
      quote,
      subpath
    };
  }
  function mergeSuggestions(tree, run) {
    var _a;
    const nodes = Array.isArray(tree == null ? void 0 : tree.nodes) ? tree.nodes : [];
    const edges = Array.isArray(tree == null ? void 0 : tree.edges) ? tree.edges : [];
    const rootNode2 = nodes.find((n) => n.id === (tree == null ? void 0 : tree.root));
    const rootDepth = rootNode2 ? rootNode2.depth : 0;
    const rootPath = rootNode2 ? normalizeTargetPath(rootNode2.path) : "";
    const known = new Set(nodes.map((n) => normalizeTargetPath(n.path)));
    const ghostNodes = [];
    const ghostEdges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const s of (run == null ? void 0 : run.suggestions) || []) {
      if (!s || !s.target) continue;
      const key2 = normalizeTargetPath(s.target);
      if (!key2 || key2 === rootPath || known.has(key2)) continue;
      const id = suggestionId(s);
      if (seen.has(id)) continue;
      seen.add(id);
      const title = s.unit === "heading" && s.heading ? s.heading : s.unit === "paragraph" && s.quote ? s.quote.slice(0, 24) : displayName(s.target);
      ghostNodes.push({
        id,
        path: s.target,
        title,
        kind: s.kind,
        source: "ai",
        depth: rootDepth + 1,
        anchor: (_a = s.anchor) != null ? _a : null,
        missing: false,
        suggested: true,
        attached: false,
        body: null,
        parent: tree.root
      });
      ghostEdges.push({ from: tree.root, to: id, suggested: true });
    }
    return { ...tree, nodes: [...nodes, ...ghostNodes], edges: [...edges, ...ghostEdges] };
  }

  // src/knowledge/mount-canvas.ts
  var MASK_ID = "bz-kb-mt-mask";
  var WIN_ID = "bz-kb-mt-window";
  var ESC_ID = "bz-kb-mt";
  var CANVAS_FALLBACK_W = 960;
  var CANVAS_FALLBACK_H = 620;
  var ZOOM_MIN = 0.3;
  var ZOOM_MAX = 2.5;
  var ZOOM_STEP = 1.2;
  var ZOOM_FIT_MAX = 1.15;
  var FIT_PAD = 90;
  var DRAG_SLOP = 6;
  var LONG_PRESS_MS = 500;
  var LONG_PRESS_SLOP = 10;
  var DOCK_GAP = 8;
  var WIDTH_ROOT = 560;
  var WIDTH_BY_KIND = {
    card: 470,
    note: 430,
    head: 400,
    para: 380,
    image: 320,
    video: 320
  };
  var HEIGHT_BY_KIND = {
    card: 220,
    note: 190,
    head: 170,
    para: 160,
    image: 130,
    video: 130
  };
  var KIND_COLOR = {
    note: "#5dcaa5",
    head: "#6ea8e8",
    card: "#a99ef0",
    para: "#8b8c94",
    image: "#d9a441",
    video: "#d4537e"
  };
  var KIND_LABEL = {
    card: "卡片",
    note: "整篇",
    head: "标题",
    para: "段落",
    image: "图片",
    video: "视频"
  };
  var SOURCE_LABEL = {
    self: "主卡",
    sameName: "文献",
    link: "双链",
    related: "关联",
    manual: "手动",
    ai: "AI 建议"
  };
  var state = null;
  function mountKindColor(kind) {
    var _a;
    const fallback = (_a = KIND_COLOR[kind]) != null ? _a : KIND_COLOR.para;
    return `var(--bz-kb-mt-c-${kind}, ${fallback})`;
  }
  function clampMountScale(scale) {
    if (!Number.isFinite(scale)) return 1;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scale));
  }
  function mountStatusText(status, boardEmpty = false) {
    switch (status) {
      case "cached":
        return "已缓存建议";
      case "fresh":
        return "新生成建议";
      case "off":
        return "自动建议已关闭";
      case "no-index":
        return "未建向量索引 · 只画双链";
      case "no-ai":
        return "AI 不可用 · 只画双链";
      case "no-answer":
        return "AI 未给出可用建议 · 只画双链（可点「重新生成」）";
      default:
        return boardEmpty ? "生成中 · 建议就绪后一起上屏" : "生成中 · 真实双链已上屏";
    }
  }
  function mountLinkText(node) {
    const raw = String((node.missing ? node.path : node.id) || node.path || "").trim();
    const core = raw.replace(/\.md$/i, "");
    if (node.kind === "image" || node.kind === "video") return `![[${raw}]]`;
    return `[[${core}]]`;
  }
  function crumbTrail(nodes, id) {
    var _a, _b;
    if (!id) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const chain = [];
    const seen = /* @__PURE__ */ new Set();
    let cur = (_a = byId.get(id)) != null ? _a : null;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parent ? (_b = byId.get(cur.parent)) != null ? _b : null : null;
    }
    return chain;
  }
  function lineageOf(edges, id) {
    const push = (map, key2, val) => {
      const list = map.get(key2);
      if (list) list.push(val);
      else map.set(key2, [val]);
    };
    const par = /* @__PURE__ */ new Map();
    const chd = /* @__PURE__ */ new Map();
    for (const e of edges != null ? edges : []) {
      if (!e) continue;
      push(chd, e.from, e.to);
      push(par, e.to, e.from);
    }
    const walk = (map) => {
      var _a;
      const out = /* @__PURE__ */ new Set([id]);
      const stack = [id];
      while (stack.length) {
        const cur = stack.pop();
        for (const next of (_a = map.get(cur)) != null ? _a : []) {
          if (out.has(next)) continue;
          out.add(next);
          stack.push(next);
        }
      }
      return out;
    };
    return { anc: walk(par), desc: walk(chd) };
  }
  function anchorNeedles(anchor) {
    var _a;
    const raw = String((_a = anchor == null ? void 0 : anchor.text) != null ? _a : "");
    if (!raw) return [];
    const out = [raw];
    if (raw.includes("[[")) {
      const display = raw.replace(/!?\[\[([^\[\]]+)\]\]/g, (_m, inner) => {
        const afterAlias = inner.includes("|") ? inner.slice(inner.lastIndexOf("|") + 1) : inner;
        const noBlock = afterAlias.includes("^") ? afterAlias.slice(0, afterAlias.indexOf("^")) : afterAlias;
        const noHead = noBlock.includes("#") ? noBlock.slice(noBlock.lastIndexOf("#") + 1) : noBlock;
        return noHead || afterAlias || inner;
      });
      if (display && display !== raw) out.push(display);
    }
    return out;
  }
  function alreadyLinked(body, link) {
    const target = String(link != null ? link : "").trim().replace(/\.md$/i, "");
    if (!target) return true;
    return new RegExp(`!?\\[\\[${escapeRegExp(target)}(\\||#|\\]\\])`, "i").test(body);
  }
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function insertLinkAtAnchor(body, anchor, link) {
    var _a, _b, _c;
    const src = String(body != null ? body : "");
    const wiki = `[[${String(link != null ? link : "").trim().replace(/\.md$/i, "")}]]`;
    if (wiki === "[[]]") return src;
    if (alreadyLinked(src, link)) return src;
    const text = String((_a = anchor == null ? void 0 : anchor.text) != null ? _a : "").trim();
    if (text) {
      const at = relocateAnchor(src, { from: (_b = anchor == null ? void 0 : anchor.from) != null ? _b : 0, to: (_c = anchor == null ? void 0 : anchor.to) != null ? _c : 0, text });
      if (at !== null && at >= 0) return src.slice(0, at + text.length) + wiki + src.slice(at + text.length);
      const compact = text.replace(/\s+/g, "");
      const flat = src.replace(/\s+/g, "");
      for (const len of [10, 6, 4, 2]) {
        const head = compact.slice(0, len);
        if (head.length < len && len > 2) continue;
        const hit = head ? flat.indexOf(head) : -1;
        if (hit < 0) continue;
        let count = 0;
        let pos = -1;
        for (let i = 0; i < src.length; i++) {
          if (/\s/.test(src[i])) continue;
          if (count === hit) {
            pos = i;
            break;
          }
          count++;
        }
        if (pos < 0) continue;
        const tail = src.slice(pos, Math.min(src.length, pos + 300));
        const m = /[。！？；…!?;\n]/.exec(tail);
        const end = m ? pos + m.index + 1 : Math.min(src.length, pos + head.length);
        return src.slice(0, end) + wiki + src.slice(end);
      }
    }
    const trimmed = src.replace(/\s+$/, "");
    return `${trimmed}${trimmed ? "\n" : ""}${wiki}
`;
  }
  function defaultDeps(over) {
    var _a, _b, _c, _d;
    return {
      measure: (_a = over == null ? void 0 : over.measure) != null ? _a : (el) => ({ w: el.offsetWidth || 0, h: el.offsetHeight || 0 }),
      notice: (_b = over == null ? void 0 : over.notice) != null ? _b : (msg, type) => notice(msg, type != null ? type : "info"),
      openNote: (_c = over == null ? void 0 : over.openNote) != null ? _c : (path) => {
        var _a2, _b2, _c2;
        try {
          void ((_c2 = (_b2 = (_a2 = getApp()) == null ? void 0 : _a2.workspace) == null ? void 0 : _b2.openLinkText) == null ? void 0 : _c2.call(_b2, path, "", false, { active: true }));
        } catch (e) {
        }
      },
      writeClipboard: (_d = over == null ? void 0 : over.writeClipboard) != null ? _d : (text) => writeClipboard(text)
    };
  }
  async function writeClipboard(text) {
    var _a, _b;
    try {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if ((_a = nav == null ? void 0 : nav.clipboard) == null ? void 0 : _a.writeText) {
        await nav.clipboard.writeText(text);
        return;
      }
    } catch (e) {
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      (_b = document.execCommand) == null ? void 0 : _b.call(document, "copy");
      ta.remove();
    } catch (e) {
    }
  }
  function buildShell() {
    if (state) return state;
    if (typeof document === "undefined") return null;
    const mask = document.createElement("div");
    mask.id = MASK_ID;
    mask.className = "bz-kb-mask bz-kb-mt-mask";
    mask.style.display = "none";
    mask.addEventListener("click", () => closeMountTree());
    const win = document.createElement("div");
    win.id = WIN_ID;
    win.className = "bz-kb-window kb bz-kb-mt-window";
    if (isMobileEnv()) win.classList.add("bz-panel-mtop");
    win.style.display = "none";
    win.innerHTML = `
    <div class="bz-kb-mt-top">
      <div class="bz-kb-mt-crumbs" id="bz-kb-mt-crumbs"></div>
      <div class="bz-kb-mt-dir" id="bz-kb-mt-dir"></div>
      <button class="bz-kb-mt-btn" data-mt-act="refresh" title="重跑当前主卡的挂载建议">重新生成</button>
      <div class="bz-kb-mt-status" id="bz-kb-mt-status"></div>
      <button class="bz-kb-mt-close bz-touch-target bz-touch-target--lg" data-mt-act="close" title="关闭挂载树">✕</button>
    </div>
    <div class="bz-kb-mt-canvas" id="bz-kb-mt-canvas">
      <div class="bz-kb-mt-world" id="bz-kb-mt-world"></div>
      <div class="bz-kb-mt-loading" id="bz-kb-mt-loading" style="display:none">
        <div class="bz-kb-mt-pbar"><i class="bz-kb-mt-pbar-fill" id="bz-kb-mt-pbar"></i></div>
        <div class="bz-kb-mt-pline"><span class="bz-kb-mt-pstage" id="bz-kb-mt-pstage">准备生成建议</span><span class="bz-kb-mt-ptimer" id="bz-kb-mt-ptimer">0s</span></div>
        <div class="bz-kb-mt-pempty" id="bz-kb-mt-pempty"></div>
      </div>
    </div>
    <div class="bz-kb-mt-zoomer">
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-in" title="放大">＋</button>
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-out" title="缩小">−</button>
      <button class="bz-kb-mt-zbtn bz-touch-target" data-mt-act="zoom-fit" title="适应窗口">⟲</button>
    </div>
    <div class="bz-kb-mt-hint" id="bz-kb-mt-hint"></div>`;
    document.body.appendChild(mask);
    document.body.appendChild(win);
    const canvasEl = win.querySelector("#bz-kb-mt-canvas");
    const worldEl = win.querySelector("#bz-kb-mt-world");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "bz-kb-mt-lines");
    worldEl.appendChild(svg);
    const st = {
      cardPath: "",
      direction: "downstream",
      deps: defaultDeps(),
      ctx: mountCtx(),
      tree: { root: "", direction: "downstream", nodes: [], edges: [] },
      run: null,
      ghosts: /* @__PURE__ */ new Map(),
      token: 0,
      loading: false,
      sizes: /* @__PURE__ */ new Map(),
      pos: {},
      world: { w: CANVAS_FALLBACK_W, h: CANVAS_FALLBACK_H },
      edges: [],
      cards: /* @__PURE__ */ new Map(),
      folded: /* @__PURE__ */ new Set(),
      selected: null,
      scale: 1,
      tx: 0,
      ty: 0,
      drag: null,
      downPt: null,
      downNode: null,
      longPressTimer: null,
      longPressFired: false,
      pinch: null,
      menu: null,
      esc: null,
      mask,
      win,
      canvasEl,
      worldEl,
      svg,
      loadingEl: win.querySelector("#bz-kb-mt-loading"),
      progressBar: win.querySelector("#bz-kb-mt-pbar"),
      progressText: win.querySelector("#bz-kb-mt-pstage"),
      progressTimer: win.querySelector("#bz-kb-mt-ptimer"),
      progressHint: win.querySelector("#bz-kb-mt-pempty"),
      timerId: null,
      startedAt: 0
    };
    state = st;
    bindShellEvents(st);
    return st;
  }
  function bindShellEvents(st) {
    st.win.addEventListener("click", (e) => {
      var _a, _b;
      const btn = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, "[data-mt-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-mt-act") || "";
      if (act === "close") closeMountTree();
      else if (act === "refresh") void confirmRefresh();
      else if (act === "zoom-in") zoomAtCenter(ZOOM_STEP);
      else if (act === "zoom-out") zoomAtCenter(1 / ZOOM_STEP);
      else if (act === "zoom-fit") fit();
      else if (act === "crumb") {
        const path = btn.getAttribute("data-path") || "";
        const id = btn.getAttribute("data-id") || "";
        if (!path) return;
        if (id === st.tree.root) {
          st.selected = null;
          applySelection(st);
          renderTop(st);
          return;
        }
        void openMountTree(path, { direction: st.direction, deps: depsOf(st) });
      } else if (act === "build-index") requestBuildIndex(st);
    });
    const canvas = st.canvasEl;
    canvas.addEventListener("pointerdown", (e) => {
      var _a, _b, _c, _d;
      if (st.menu) closeMenu();
      st.longPressFired = false;
      st.downPt = { x: num(e.clientX), y: num(e.clientY) };
      st.downNode = (_c = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".bz-kb-mt-node")) != null ? _c : null;
      st.drag = { x: num(e.clientX), y: num(e.clientY), tx: st.tx, ty: st.ty };
      try {
        (_d = canvas.setPointerCapture) == null ? void 0 : _d.call(canvas, e.pointerId);
      } catch (e2) {
      }
      if (isMobileEnv() && st.downNode) {
        const x = num(e.clientX);
        const y = num(e.clientY);
        const id = st.downNode.getAttribute("data-mt-id") || "";
        st.longPressTimer = setTimeout(() => {
          st.longPressTimer = null;
          st.longPressFired = true;
          openNodeMenu(id, x, y);
        }, LONG_PRESS_MS);
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!st.drag) return;
      const dx = num(e.clientX) - st.drag.x;
      const dy = num(e.clientY) - st.drag.y;
      if (st.longPressTimer && Math.hypot(dx, dy) > LONG_PRESS_SLOP) cancelLongPress(st);
      st.tx = st.drag.tx + dx;
      st.ty = st.drag.ty + dy;
      applyTransform(st);
    });
    const endDrag = () => {
      cancelLongPress(st);
      st.drag = null;
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("click", (e) => {
      var _a, _b, _c;
      if (st.longPressFired) {
        st.longPressFired = false;
        return;
      }
      if (st.downPt && Math.hypot(num(e.clientX) - st.downPt.x, num(e.clientY) - st.downPt.y) > DRAG_SLOP) return;
      const nodeEl = (_c = (_b = (_a = e.target) == null ? void 0 : _a.closest) == null ? void 0 : _b.call(_a, ".bz-kb-mt-node")) != null ? _c : st.downNode;
      const id = (nodeEl == null ? void 0 : nodeEl.getAttribute("data-mt-id")) || "";
      st.selected = id && st.selected !== id ? id : null;
      applySelection(st);
      renderTop(st);
    });
    canvas.addEventListener(
      "wheel",
      (e) => {
        var _a, _b, _c, _d;
        (_a = e.preventDefault) == null ? void 0 : _a.call(e);
        const rect = (_c = (_b = canvas.getBoundingClientRect) == null ? void 0 : _b.call(canvas)) != null ? _c : { left: 0, top: 0 };
        zoomAt(st, num(e.clientX) - num(rect.left), num(e.clientY) - num(rect.top), ((_d = e.deltaY) != null ? _d : 0) < 0 ? 1.1 : 0.9);
      },
      { passive: false }
    );
    canvas.addEventListener("contextmenu", (e) => {
      var _a, _b, _c, _d, _e, _f;
      (_a = e.preventDefault) == null ? void 0 : _a.call(e);
      const nodeEl = (_d = (_c = (_b = e.target) == null ? void 0 : _b.closest) == null ? void 0 : _c.call(_b, ".bz-kb-mt-node")) != null ? _d : null;
      if (nodeEl) {
        openNodeMenu(nodeEl.getAttribute("data-mt-id") || "", num(e.clientX), num(e.clientY));
        return;
      }
      const edgeEl = (_f = (_e = e.target) == null ? void 0 : _e.closest) == null ? void 0 : _f.call(_e, ".bz-kb-mt-edge");
      const key2 = (edgeEl == null ? void 0 : edgeEl.getAttribute("data-mt-key")) || "";
      const hit = st.edges.find((x) => x.key === key2);
      if (hit) {
        const targetId = st.direction === "downstream" ? hit.to : hit.from;
        openNodeMenu(targetId, num(e.clientX), num(e.clientY));
        return;
      }
      if (st.menu) closeMenu();
    });
    canvas.addEventListener(
      "touchstart",
      (e) => {
        var _a;
        if (((_a = e.touches) == null ? void 0 : _a.length) === 2) {
          cancelLongPress(st);
          st.pinch = { d: touchDistance(e.touches), scale: st.scale };
        }
      },
      { passive: true }
    );
    canvas.addEventListener(
      "touchmove",
      (e) => {
        var _a, _b, _c, _d;
        if (!st.pinch || ((_a = e.touches) == null ? void 0 : _a.length) !== 2) return;
        (_b = e.preventDefault) == null ? void 0 : _b.call(e);
        const d = touchDistance(e.touches);
        if (!st.pinch.d) return;
        const rect = (_d = (_c = canvas.getBoundingClientRect) == null ? void 0 : _c.call(canvas)) != null ? _d : { left: 0, top: 0 };
        const cx = (num(e.touches[0].clientX) + num(e.touches[1].clientX)) / 2 - num(rect.left);
        const cy = (num(e.touches[0].clientY) + num(e.touches[1].clientY)) / 2 - num(rect.top);
        const want = st.pinch.scale * (d / st.pinch.d);
        zoomAtAbsolute(st, cx, cy, want);
      },
      { passive: false }
    );
    canvas.addEventListener("touchend", () => {
      st.pinch = null;
    });
    st.win.addEventListener("mouseover", (e) => {
      var _a, _b, _c;
      const el = e.target;
      const dot = (_a = el == null ? void 0 : el.closest) == null ? void 0 : _a.call(el, "[data-mt-edge]");
      if (dot) {
        setHover(st, dot.getAttribute("data-mt-edge") || "", true);
        return;
      }
      const edgeEl = (_b = el == null ? void 0 : el.closest) == null ? void 0 : _b.call(el, ".bz-kb-mt-edge");
      if (edgeEl) {
        setHover(st, edgeEl.getAttribute("data-mt-key") || "", true);
        return;
      }
      const nodeEl = (_c = el == null ? void 0 : el.closest) == null ? void 0 : _c.call(el, ".bz-kb-mt-node");
      if (nodeEl) setHover(st, edgeKeyTo(st, nodeEl.getAttribute("data-mt-id") || ""), true);
    });
    st.win.addEventListener("mouseout", (e) => {
      var _a;
      const el = e.target;
      if ((_a = el == null ? void 0 : el.closest) == null ? void 0 : _a.call(el, "[data-mt-edge], .bz-kb-mt-edge, .bz-kb-mt-node")) setHover(st, "", false);
    });
  }
  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  }
  function displayTitle(node) {
    return String(node.title || node.path || node.id).replace(/\.md$/i, "");
  }
  function touchDistance(touches) {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(num(a.clientX) - num(b.clientX), num(a.clientY) - num(b.clientY));
  }
  function cancelLongPress(st) {
    if (st.longPressTimer) {
      clearTimeout(st.longPressTimer);
      st.longPressTimer = null;
    }
  }
  function depsOf(st) {
    return {
      measure: st.deps.measure,
      notice: st.deps.notice,
      openNote: st.deps.openNote,
      writeClipboard: st.deps.writeClipboard
    };
  }
  function mountTreeOpen() {
    return !!state && state.mask.style.display !== "none";
  }
  function closeMountTree() {
    var _a;
    const st = state;
    if (!st) return;
    closeMenu();
    cancelLongPress(st);
    st.mask.style.display = "none";
    st.win.style.display = "none";
    st.selected = null;
    st.token++;
    hideProgress(st);
    (_a = st.esc) == null ? void 0 : _a.unregister();
    st.esc = null;
  }
  async function openMountTree(cardPath, opts) {
    const path = String(cardPath != null ? cardPath : "").trim();
    const st = buildShell();
    if (!st) return;
    if (!path) {
      defaultDeps(opts == null ? void 0 : opts.deps).notice("看挂载树：这张卡没有可解析的路径");
      return;
    }
    const direction = (opts == null ? void 0 : opts.direction) === "upstream" ? "upstream" : "downstream";
    st.deps = defaultDeps(opts == null ? void 0 : opts.deps);
    topifyZ(st.mask, st.win);
    st.mask.style.display = "block";
    st.win.style.display = "flex";
    if (!st.esc) {
      st.esc = escManager.register(ESC_ID, {
        isVisible: () => mountTreeOpen() || !!st.menu,
        close: () => {
          if (st.menu) closeMenu();
          else closeMountTree();
        }
      });
    }
    const sameTree = path === st.cardPath && direction === st.direction && st.tree.root === path && st.tree.nodes.length > 0;
    if (sameTree && !st.loading && !(opts == null ? void 0 : opts.force)) {
      hideProgress(st);
      renderTop(st);
      return;
    }
    st.cardPath = path;
    st.direction = direction;
    st.selected = null;
    st.folded = /* @__PURE__ */ new Set();
    await load(st, !!(opts == null ? void 0 : opts.force));
  }
  async function confirmRefresh() {
    const st = state;
    if (!st || !mountTreeOpen()) return;
    const v = await openFlowDialog({
      title: "重新生成挂载建议",
      message: "会重跑一遍 AI 建议（查询官 → 检索 → 采纳官 → 定位官），大约半分钟到一分钟；已在正文里的双链不受影响，已固定 / 已取消的不会再推。",
      // 弹窗挂 body，必须自带 'kb'（token 作用域）+ 'bz-kb-flow-dialog'（域皮），同 ui.ts 的几处确认框
      className: "kb bz-kb-flow-dialog",
      actions: [
        { label: "取消", value: "cancel" },
        { label: "重新生成", value: "ok" }
      ]
    });
    if (v !== "ok") return;
    if (state !== st || !mountTreeOpen()) return;
    await reload(true);
  }
  async function reload(force) {
    const st = state;
    if (!st) return;
    await load(st, force);
  }
  async function load(st, force) {
    var _a;
    const token = ++st.token;
    const path = st.cardPath;
    const direction = st.direction;
    st.loading = true;
    st.edges = [];
    st.cards.clear();
    st.ghosts = /* @__PURE__ */ new Map();
    st.run = null;
    st.tree = { root: path, direction, nodes: [], edges: [] };
    clearCanvas(st);
    renderTop(st);
    const ctx = mountCtx();
    st.ctx = ctx;
    let tree;
    try {
      tree = await buildMountTree(path, { direction, ctx });
    } catch (e) {
      tree = { root: path, direction, nodes: [], edges: [] };
    }
    const autoOn = ((_a = tryGetSettings()) == null ? void 0 : _a.knowledgeMountAutoSuggest) !== false;
    const bare = tree.nodes.filter((n) => !n.attached).length <= 1;
    const waitFirst = autoOn && (bare || force);
    if (token !== st.token) return;
    st.tree = tree;
    if (waitFirst) {
      renderTop(st);
    } else {
      await renderCanvas(st);
      renderTop(st);
      fit();
    }
    if (token !== st.token) return;
    st.loading = false;
    if (!autoOn) {
      hideProgress(st);
      renderTop(st);
      return;
    }
    showProgress(st, waitFirst ? force ? EMPTY_HINT_REFRESH : EMPTY_HINT_BARE : "");
    let run = null;
    try {
      run = await runSuggest(st, path, ctx, force, (p) => {
        if (token === st.token) setProgress(st, p);
      });
    } catch (e) {
      run = null;
    }
    if (token !== st.token) return;
    st.run = run;
    try {
      if (run && run.suggestions.length) {
        for (const s of run.suggestions) {
          if (s == null ? void 0 : s.target) st.ghosts.set(suggestionId(s), s);
        }
        st.tree = mergeSuggestions(tree, run);
        await renderCanvas(st);
        if (waitFirst) fit();
      } else if (waitFirst) {
        st.tree = tree;
        await renderCanvas(st);
        fit();
      } else {
        st.tree = tree;
      }
    } finally {
      if (token === st.token) hideProgress(st);
    }
    renderTop(st);
  }
  var EMPTY_HINT_BARE = "这张卡还没有挂载——先看 AI 能不能找到关联";
  var EMPTY_HINT_REFRESH = "重新生成中——建议回来连同已有的挂载一起显示";
  function showProgress(st, emptyHint = "") {
    st.loading = true;
    if (st.progressHint) st.progressHint.textContent = emptyHint;
    st.loadingEl.classList.toggle("is-bare", !!emptyHint);
    st.loadingEl.style.display = "";
    st.startedAt = Date.now();
    if (st.progressBar) st.progressBar.style.width = "4%";
    if (st.progressText) st.progressText.textContent = "准备生成建议";
    if (st.progressTimer) st.progressTimer.textContent = "0s";
    stopTimer(st);
    st.timerId = setInterval(() => {
      const el = st.progressTimer;
      if (el) el.textContent = `${Math.round((Date.now() - st.startedAt) / 1e3)}s`;
    }, 500);
  }
  function setProgress(st, p) {
    if (st.progressBar) st.progressBar.style.width = `${Math.min(100, Math.max(4, suggestProgressPercent(p)))}%`;
    if (st.progressText) st.progressText.textContent = p.label || "生成中…";
  }
  function hideProgress(st) {
    stopTimer(st);
    st.loading = false;
    st.loadingEl.style.display = "none";
  }
  function stopTimer(st) {
    if (st.timerId) clearInterval(st.timerId);
    st.timerId = null;
  }
  function clearCanvas(st) {
    for (const el of Array.from(st.worldEl.querySelectorAll(".bz-kb-mt-node"))) el.remove();
    st.svg.innerHTML = "";
    st.cards.clear();
    st.sizes.clear();
    st.edges = [];
    st.pos = {};
  }
  async function runSuggest(st, path, ctx, force, onProgress) {
    var _a;
    try {
      return await generateSuggestions(
        path,
        {
          app: ctx.app,
          cardboxDir: ctx.cardboxDir,
          litDir: ctx.litDir,
          topicDir: ((_a = tryGetSettings()) == null ? void 0 : _a.knowledgeTopicDirectory) || "主题盒"
        },
        { force, onProgress }
      );
    } catch (e) {
      return { status: "no-ai", suggestions: [] };
    }
  }
  async function rebuildTreeOnly(st) {
    const token = ++st.token;
    const path = st.cardPath;
    let tree;
    try {
      tree = await buildMountTree(path, { direction: st.direction, ctx: st.ctx });
    } catch (e) {
      return;
    }
    if (token !== st.token) return;
    st.tree = st.run && st.run.suggestions.length ? mergeSuggestions(tree, st.run) : tree;
    await renderCanvas(st);
    renderTop(st);
  }
  function renderTop(st) {
    var _a, _b, _c;
    const rootNode2 = (_a = st.tree.nodes.find((n) => n.id === st.tree.root)) != null ? _a : null;
    const crumbs = crumbTrail(st.tree.nodes, (_b = st.selected) != null ? _b : st.tree.root);
    const chain = crumbs.length ? crumbs : rootNode2 ? [rootNode2] : [];
    st.win.querySelector("#bz-kb-mt-crumbs").innerHTML = chain.map((n, i) => {
      const last = i === chain.length - 1;
      const label = escapeHtml(displayTitle(n));
      const sep = i === 0 ? "" : '<span class="bz-kb-mt-sep">›</span>';
      if (last && !st.selected) return `${sep}<span class="bz-kb-mt-crumb is-cur">${label}</span>`;
      return `${sep}<button class="bz-kb-mt-crumb bz-touch-target" data-mt-act="crumb" data-path="${escapeHtml(n.path)}" data-id="${escapeHtml(n.id)}" title="以《${label}》为主卡重开">${label}</button>`;
    }).join("");
    const dirEl = st.win.querySelector("#bz-kb-mt-dir");
    dirEl.textContent = st.direction === "upstream" ? "上游 · 谁挂了我" : "下游 · 我挂了谁";
    dirEl.setAttribute("data-mt-dir", st.direction);
    const statusEl = st.win.querySelector("#bz-kb-mt-status");
    const culled = st.sizes.size ? countCulled(st) : 0;
    let text;
    let extra = "";
    if (st.loading) text = mountStatusText("generating", st.cards.size === 0);
    else if (st.run) text = mountStatusText(st.run.status);
    else text = "本卡建议未跑（自动建议已关闭）";
    if (!st.loading && culled > 0) extra = `<span class="bz-kb-mt-kind">· 图大，已按 ${LAYOUT_PARAMS.MAX_NODES} 张封顶</span>`;
    statusEl.innerHTML = `<span class="bz-kb-mt-status-t">${escapeHtml(text)}</span>${extra}${!st.loading && ((_c = st.run) == null ? void 0 : _c.status) === "no-index" ? '<button class="bz-kb-mt-btn is-mini" data-mt-act="build-index" title="打开第二大脑重建索引（绝不自动建）">去建索引</button>' : ""}`;
    const hint = st.win.querySelector("#bz-kb-mt-hint");
    hint.textContent = isMobileEnv() ? "点卡片血缘高亮 · 长按卡片出菜单 · 双指缩放 · 单指拖拽平移" : "点卡片血缘高亮（再点取消）· 右键菜单 · 拖拽平移 · 滚轮缩放 · 点标题折/展";
  }
  function countCulled(st) {
    const laid = st.tree.nodes.filter((n) => !n.attached && st.sizes.has(n.id)).length;
    return Math.max(0, laid - Math.min(laid, LAYOUT_PARAMS.MAX_NODES));
  }
  function requestBuildIndex(st) {
    var _a;
    try {
      const app = getApp();
      if (typeof ((_a = app == null ? void 0 : app.commands) == null ? void 0 : _a.executeCommandById) === "function") {
        app.commands.executeCommandById("bz-secondbrain-rebuild-index");
        st.deps.notice("已转交「重建索引」——建完回到白板点「重新生成」");
        return;
      }
    } catch (e) {
    }
    st.deps.notice("未建向量索引：请先在第二大脑执行「重建索引」，再回白板点「重新生成」");
  }
  async function renderCanvas(st) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const worldEl = st.worldEl;
    for (const el of Array.from(worldEl.querySelectorAll(".bz-kb-mt-node"))) el.remove();
    st.svg.innerHTML = "";
    st.cards.clear();
    st.sizes.clear();
    st.edges = [];
    const nodes = (_a = st.tree.nodes) != null ? _a : [];
    if (nodes.length === 0) {
      st.world = { w: CANVAS_FALLBACK_W, h: CANVAS_FALLBACK_H };
      syncWorld(st);
      return;
    }
    for (const n of nodes) if (n.attached && !st.folded.has(n.id)) st.folded.add(n.id);
    const rootId = st.tree.root;
    const jobs = [];
    for (const node of nodes) {
      const el = buildCard(st, node, rootId);
      worldEl.appendChild(el);
      st.cards.set(node.id, el);
      jobs.push(fillBody(st, node, el));
    }
    worldEl.appendChild(st.svg);
    await Promise.all(jobs);
    for (const node of nodes) {
      const el = st.cards.get(node.id);
      if (!el) continue;
      const raw = st.deps.measure(el, node.kind);
      const w = (raw == null ? void 0 : raw.w) && raw.w > 0 ? raw.w : widthOf(st, node);
      const h = (raw == null ? void 0 : raw.h) && raw.h > 0 ? raw.h : (_b = HEIGHT_BY_KIND[node.kind]) != null ? _b : HEIGHT_BY_KIND.card;
      st.sizes.set(node.id, { w, h });
    }
    const laid = nodes.filter((n) => !n.attached && st.sizes.has(n.id));
    const boxIds = new Set(laid.map((n) => n.id));
    const boxes = laid.map((n) => {
      const s = st.sizes.get(n.id);
      return { id: n.id, w: s.w, h: s.h, depth: n.depth, kind: n.kind };
    });
    const layoutEdges = [];
    for (const e of (_c = st.tree.edges) != null ? _c : []) {
      if (boxIds.has(e.from) && boxIds.has(e.to)) layoutEdges.push({ from: e.from, to: e.to });
    }
    const layout = layoutTree(boxes, layoutEdges);
    st.pos = layout.pos;
    st.world = { w: layout.world.w, h: layout.world.h };
    for (const n of laid) {
      const el = st.cards.get(n.id);
      const p = layout.pos[n.id];
      if (!p) {
        el.style.display = "none";
        continue;
      }
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    }
    const dockGroups = /* @__PURE__ */ new Map();
    for (const n of nodes) {
      if (!n.attached || !n.parent) continue;
      if (!dockGroups.has(n.parent)) dockGroups.set(n.parent, []);
      dockGroups.get(n.parent).push(n);
    }
    for (const [parentId, group] of dockGroups) {
      const parentPos = layout.pos[parentId];
      const parentEl = st.cards.get(parentId);
      if (!parentPos || !parentEl || parentEl.style.display === "none") {
        for (const n of group) {
          const el = st.cards.get(n.id);
          if (el) el.style.display = "none";
        }
        continue;
      }
      const pw = (_e = (_d = st.sizes.get(parentId)) == null ? void 0 : _d.w) != null ? _e : widthOf(st, { id: parentId, kind: "card" });
      const ph = (_g = (_f = st.sizes.get(parentId)) == null ? void 0 : _f.h) != null ? _g : HEIGHT_BY_KIND.card;
      let top = parentPos.y + ph + DOCK_GAP;
      let right = parentPos.x + pw;
      for (const n of group) {
        const el = st.cards.get(n.id);
        const size = st.sizes.get(n.id);
        if (!el) continue;
        el.style.left = `${parentPos.x}px`;
        el.style.top = `${top}px`;
        el.style.width = `${pw}px`;
        if (size) size.w = pw;
        top += ((_h = size == null ? void 0 : size.h) != null ? _h : HEIGHT_BY_KIND.note) + DOCK_GAP;
        if (top > st.world.h) st.world.h = top;
      }
      if (right > st.world.w) st.world.w = right;
    }
    syncWorld(st);
    drawEdges(st);
    applySelection(st);
  }
  function widthOf(st, node) {
    var _a;
    if (node.id && node.id === st.tree.root) return WIDTH_ROOT;
    return (_a = WIDTH_BY_KIND[node.kind]) != null ? _a : WIDTH_BY_KIND.card;
  }
  function syncWorld(st) {
    const { w, h } = st.world;
    st.worldEl.style.width = `${w}px`;
    st.worldEl.style.height = `${h}px`;
    st.svg.setAttribute("width", String(w));
    st.svg.setAttribute("height", String(h));
    st.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    applyTransform(st);
  }
  function buildCard(st, node, rootId) {
    var _a, _b, _c;
    const el = document.createElement("div");
    const ghost = st.ghosts.has(node.id);
    const stale = !!node.missing || ghost && !ghostTargetExists(st, node);
    const classes = ["bz-kb-mt-node", `is-${node.kind}`];
    if (stale) classes.push("is-missing");
    if (node.attached) classes.push("is-dock");
    if (node.source === "sameName") classes.push("is-lit");
    if (ghost) classes.push("is-ghost");
    if (node.id === rootId) classes.push("is-root");
    if (st.folded.has(node.id)) classes.push("is-folded");
    el.className = classes.join(" ");
    el.setAttribute("data-mt-id", node.id);
    el.setAttribute("data-mt-kind", node.kind);
    el.setAttribute("data-mt-source", node.source);
    el.style.width = `${widthOf(st, node)}px`;
    const head = document.createElement("div");
    head.className = "bz-kb-mt-head";
    const ttl = document.createElement("span");
    ttl.className = "bz-kb-mt-ttl";
    ttl.textContent = stale ? `${displayTitle(node)}（失效）` : displayTitle(node);
    ttl.title = "点击标题折 / 展这张卡";
    ttl.setAttribute("data-mt-fold", "1");
    head.appendChild(ttl);
    head.appendChild(chip(node.source === "ai" ? "AI 建议" : (_a = KIND_LABEL[node.kind]) != null ? _a : "", "kind"));
    if (node.source && node.source !== "ai") head.appendChild(chip((_b = SOURCE_LABEL[node.source]) != null ? _b : "", `src src-${node.source}`));
    if (node.id === rootId) head.appendChild(chip("主 卡", "root"));
    if (ghost) {
      const reason = ((_c = st.ghosts.get(node.id)) == null ? void 0 : _c.reason) || "";
      if (reason) {
        const why = chip("看理由", "why");
        why.setAttribute("data-mt-why", reason);
        why.title = reason;
        head.appendChild(why);
      }
    }
    el.appendChild(head);
    const body = document.createElement("div");
    body.className = "bz-kb-mt-body";
    el.appendChild(body);
    ttl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (st.folded.has(node.id)) st.folded.delete(node.id);
      else st.folded.add(node.id);
      const folded = st.folded.has(node.id);
      el.classList.toggle("is-folded", folded);
      const body2 = el.querySelector(".bz-kb-mt-body");
      if (!folded && body2 && !body2.querySelector("*")) void fillBody(st, node, el);
    });
    return el;
  }
  function chip(text, kind) {
    const s = document.createElement("span");
    s.className = `bz-kb-mt-chip ${kind}`;
    s.textContent = text;
    return s;
  }
  async function fillBody(st, node, cardEl) {
    var _a;
    const bodyEl = cardEl.querySelector(".bz-kb-mt-body");
    if (!bodyEl) return;
    if (node.attached && st.folded.has(node.id)) return;
    const stale = !!node.missing || st.ghosts.has(node.id) && !ghostTargetExists(st, node);
    if (stale) {
      bodyEl.innerHTML = '<div class="bz-kb-mt-ph is-missing">失效：目标已不存在（改名或删除后残留）</div>';
      return;
    }
    if (node.kind === "image" || node.kind === "video") {
      bodyEl.innerHTML = `<div class="bz-kb-mt-ph">${escapeHtml(node.path)}</div>`;
      return;
    }
    const app = (_a = st.ctx.app) != null ? _a : getApp();
    const ghost = st.ghosts.get(node.id);
    const md = ghost ? await suggestionUnitMarkdown(app, ghost) : bodyMarkdown(st, node);
    if (md === null) {
      bodyEl.innerHTML = '<div class="bz-kb-mt-ph">（无正文）</div>';
      return;
    }
    if (!md.trim()) {
      bodyEl.innerHTML = '<div class="bz-kb-mt-ph">（无正文）</div>';
      return;
    }
    let ok = false;
    if (app == null ? void 0 : app.vault) {
      try {
        const comp = new Component();
        await MarkdownRenderer.render(app, md, bodyEl, node.path, comp);
        comp.unload();
        ok = true;
      } catch (e) {
        ok = false;
      }
    }
    if (ok && bodyEl.querySelector("*")) {
      tagBodyLinks(st, node, bodyEl);
      return;
    }
    bodyEl.textContent = "";
    for (const part of md.split(/\r?\n\r?\n+/)) {
      const t = part.trim();
      if (!t) continue;
      const p = document.createElement("div");
      p.className = "bz-kb-mt-ptext";
      p.textContent = t;
      bodyEl.appendChild(p);
    }
    tagBodyLinks(st, node, bodyEl);
  }
  function normRef(v) {
    return String(v != null ? v : "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/\.md$/i, "").replace(/^\/+/, "").toLowerCase();
  }
  function refKeys(node) {
    const out = /* @__PURE__ */ new Set();
    const add = (v) => {
      const k = normRef(v);
      if (k) out.add(k);
    };
    add(node.path);
    add(node.id);
    add(node.title);
    const base = String(node.path || "").replace(/\\/g, "/").split("/").pop() || "";
    add(base);
    const hash = String(node.id).indexOf("#");
    if (hash >= 0) {
      const sub = String(node.id).slice(hash);
      add(base.replace(/\.md$/i, "") + sub);
    }
    return out;
  }
  function tagBodyLinks(st, node, bodyEl) {
    var _a;
    const links = Array.from(bodyEl.querySelectorAll("a.internal-link, a[data-href]"));
    if (!links.length) return;
    const outgoing = ((_a = st.tree.edges) != null ? _a : []).filter(
      (e) => (st.direction === "downstream" ? e.from : e.to) === node.id
    );
    if (!outgoing.length) return;
    for (const a of links) {
      const href = normRef(a.getAttribute("data-href") || a.getAttribute("href") || "");
      if (!href) continue;
      for (const e of outgoing) {
        const otherId = st.direction === "downstream" ? e.to : e.from;
        const other = st.tree.nodes.find((n) => n.id === otherId);
        if (!other) continue;
        const keys = refKeys(other);
        const hit = [...keys].some((k) => k === href || k.endsWith("/" + href) || href.endsWith("/" + k));
        if (hit) {
          a.setAttribute("data-mt-to", otherId);
          break;
        }
      }
    }
  }
  function bodyMarkdown(st, node) {
    if (node.missing) return null;
    const ghost = st.ghosts.get(node.id);
    if (ghost) return `> ${ghost.reason || "AI 建议：这张卡与主卡有实质关联。"}`;
    if (node.body && node.body.trim()) return node.body;
    return null;
  }
  function ghostTargetExists(st, node) {
    var _a, _b, _c;
    if (!node.suggested) return true;
    const app = (_a = st.ctx.app) != null ? _a : getApp();
    try {
      return !!((_c = (_b = app == null ? void 0 : app.vault) == null ? void 0 : _b.getAbstractFileByPath) == null ? void 0 : _c.call(_b, node.path));
    } catch (e) {
      return true;
    }
  }
  function edgeId(from, to) {
    return `${from}\0${to}`;
  }
  function domKeys(list) {
    const map = /* @__PURE__ */ new Map();
    list.forEach((e, i) => map.set(edgeId(e.from, e.to), `e${i}`));
    return map;
  }
  function placeAnchors(st, list, keys) {
    var _a, _b, _c, _d;
    const out = /* @__PURE__ */ new Map();
    const cursor = /* @__PURE__ */ new Map();
    const kindById = new Map(st.tree.nodes.map((n) => [n.id, n.kind]));
    for (const e of list) {
      const id = edgeId(e.from, e.to);
      const key2 = (_a = keys.get(id)) != null ? _a : "";
      const bearerId = st.direction === "downstream" ? e.from : e.to;
      const colorKind = (_b = kindById.get(st.direction === "downstream" ? e.to : e.from)) != null ? _b : "para";
      const cardEl = st.cards.get(bearerId);
      if (!cardEl || cardEl.style.display === "none") continue;
      const bodyEl = cardEl.querySelector(".bz-kb-mt-body");
      if (!bodyEl) continue;
      const anchor = (_d = (_c = st.tree.nodes.find((n) => n.id === e.to)) == null ? void 0 : _c.anchor) != null ? _d : null;
      const point = measureDot(st, cardEl, bodyEl, anchor, key2, colorKind, cursor, !!e.suggested);
      if (point) out.set(id, point);
    }
    return out;
  }
  function measureDot(st, cardEl, bodyEl, anchor, key2, colorKind, cursor, highlight = false) {
    var _a;
    if (!anchor) return null;
    const needles = anchorNeedles(anchor);
    if (needles.length === 0) return null;
    const color = mountKindColor(colorKind);
    const dot = insertAnchorDot(bodyEl, needles, key2, (_a = cursor.get(bodyEl)) != null ? _a : 0, highlight, color);
    if (!dot) return null;
    cursor.set(bodyEl, Number(dot.getAttribute("data-mt-at") || 0));
    dot.style.color = color;
    const nodeId = cardEl.getAttribute("data-mt-id") || "";
    const base = st.pos[nodeId];
    const size = st.sizes.get(nodeId);
    if (!base || !size) return null;
    if (!dot.offsetWidth && !dot.offsetHeight) return null;
    return {
      x: base.x + dot.offsetLeft + dot.offsetWidth / 2,
      y: base.y + dot.offsetTop + dot.offsetHeight / 2
    };
  }
  function insertAnchorDot(bodyEl, needles, key2, from, highlight = false, color = "") {
    var _a, _b;
    const idx = textIndexOf(bodyEl);
    const hit = locateInText2(idx.text, needles, from);
    if (!hit) return null;
    const dot = document.createElement("i");
    dot.className = "bz-kb-mt-anch";
    dot.setAttribute("data-mt-edge", key2);
    dot.setAttribute("data-mt-at", String(hit.at + hit.len));
    dot.setAttribute("title", highlight ? "AI 建议的挂载点：这句挂到虚线那头" : "挂载点：这条线从这句话扯出");
    if (highlight) {
      const end = hit.at + hit.len;
      const covered = idx.parts.filter((p) => p.start < end && p.start + p.node.data.length > hit.at);
      if (covered.length === 0) return null;
      let last = null;
      for (const p of covered) {
        const start = Math.max(0, hit.at - p.start);
        let node = p.node;
        if (start > 0) node = node.splitText(start);
        const take = Math.min(node.data.length, end - (p.start + start));
        if (take < node.data.length) node.splitText(take);
        const span = document.createElement("span");
        span.className = "bz-kb-mt-anch-hl";
        span.setAttribute("data-mt-edge", key2);
        span.setAttribute("data-mt-sug", "1");
        if (color) span.style.color = color;
        (_a = node.parentNode) == null ? void 0 : _a.insertBefore(span, node);
        span.appendChild(node);
        last = span;
      }
      last == null ? void 0 : last.appendChild(dot);
      return dot;
    }
    const part = [...idx.parts].reverse().find((p) => hit.at >= p.start);
    if (!part) return null;
    const offset = Math.min(Math.max(0, hit.at - part.start), part.node.data.length);
    const after = part.node.splitText(offset);
    const len = Math.min(hit.len, after.data.length);
    const tail = after.splitText(len);
    (_b = after.parentNode) == null ? void 0 : _b.insertBefore(dot, tail);
    return dot;
  }
  function textIndexOf(container) {
    var _a;
    const walker = document.createTreeWalker(
      container,
      4
      /* NodeFilter.SHOW_TEXT */
    );
    const parts = [];
    let text = "";
    let cur = walker.nextNode();
    while (cur) {
      const data = (_a = cur.data) != null ? _a : "";
      if (data) {
        parts.push({ node: cur, start: text.length });
        text += data;
      }
      cur = walker.nextNode();
    }
    return { text, parts };
  }
  function locateInText2(text, needles, from) {
    if (!text) return null;
    const start = Math.min(Math.max(0, from), text.length);
    for (const needle of needles) {
      if (!needle) continue;
      const seg = text.slice(start);
      if (seg) {
        const rel = relocateAnchor(seg, { from: 0, to: needle.length, text: needle });
        if (rel !== null && rel >= 0) return { at: start + rel, len: needle.length };
      }
      const abs = relocateAnchor(text, { from: 0, to: needle.length, text: needle });
      if (abs !== null && abs >= 0) return { at: abs, len: needle.length };
    }
    return null;
  }
  function drawEdges(st) {
    var _a;
    const boxes = [];
    for (const n of st.tree.nodes) {
      if (n.attached) continue;
      const p = st.pos[n.id];
      const s = st.sizes.get(n.id);
      const el = st.cards.get(n.id);
      if (!p || !s || !el || el.style.display === "none") continue;
      boxes.push({ id: n.id, x: p.x, y: p.y, w: s.w, h: s.h });
    }
    const boxIds = new Set(boxes.map((b) => b.id));
    const list = ((_a = st.tree.edges) != null ? _a : []).filter((e) => boxIds.has(e.from) && boxIds.has(e.to));
    st.edges = [];
    if (list.length === 0) {
      st.svg.innerHTML = "";
      return;
    }
    const keys = domKeys(list);
    const anchors = placeAnchors(st, list, keys);
    const inputs = list.map((e) => {
      var _a2;
      return {
        from: e.from,
        to: e.to,
        anchor: (_a2 = anchors.get(edgeId(e.from, e.to))) != null ? _a2 : null
      };
    });
    const routed = routeEdges(boxes, inputs);
    const kindById = new Map(st.tree.nodes.map((n) => [n.id, n.kind]));
    const suggestedOf = new Map(list.map((e) => [edgeId(e.from, e.to), !!e.suggested]));
    let html = "";
    routed.forEach((r, i) => {
      var _a2, _b, _c, _d;
      if (!(r == null ? void 0 : r.d)) return;
      const id = edgeId(r.from, r.to);
      const key2 = (_a2 = keys.get(id)) != null ? _a2 : `e${i}`;
      const bearerId = st.direction === "downstream" ? r.from : r.to;
      const otherId = st.direction === "downstream" ? r.to : r.from;
      (_b = st.cards.get(bearerId)) == null ? void 0 : _b.querySelectorAll("[data-mt-to]").forEach((el) => {
        if (el.getAttribute("data-mt-to") === otherId) el.setAttribute("data-mt-edge", key2);
      });
      const colorKind = (_c = kindById.get(st.direction === "downstream" ? r.to : r.from)) != null ? _c : "para";
      const color = mountKindColor(colorKind);
      const isSug = (_d = suggestedOf.get(id)) != null ? _d : false;
      const isFb = !!r.fallback;
      const entry = lastPoint(r.d);
      const cls = `bz-kb-mt-edge${isSug ? " is-sug" : ""}${isFb ? " is-fb" : ""}`;
      html += `<path class="${cls}" data-mt-key="${key2}" data-i="${i}" d="${r.d}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.6"${isSug || isFb ? ' stroke-dasharray="6 5"' : ""}/>`;
      if (entry) {
        html += `<circle class="bz-kb-mt-edot" data-mt-key="${key2}" cx="${entry.x.toFixed(1)}" cy="${entry.y.toFixed(
          1
        )}" r="3" fill="${isSug ? "none" : color}" stroke="${isSug ? color : "none"}" stroke-width="1.5" opacity="0.85"/>`;
      }
      st.edges.push({ ...r, key: key2, color, suggested: isSug });
    });
    st.svg.innerHTML = html;
  }
  function lastPoint(d) {
    const m = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/.exec(d);
    if (!m) return null;
    const x = Number(m[1]);
    const y = Number(m[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }
  function edgeKeyTo(st, nodeId) {
    var _a;
    if (!nodeId) return "";
    const hit = st.edges.find((e) => st.direction === "downstream" ? e.to === nodeId : e.from === nodeId);
    return (_a = hit == null ? void 0 : hit.key) != null ? _a : "";
  }
  function applySelection(st) {
    var _a, _b;
    const sel = st.selected;
    const dockSelected = !!sel && !!((_a = st.cards.get(sel)) == null ? void 0 : _a.classList.contains("is-dock"));
    const set = sel && !dockSelected ? lineageOf((_b = st.tree.edges) != null ? _b : [], sel) : null;
    for (const [id, el] of st.cards) {
      el.classList.remove("is-sel", "is-anc", "is-desc", "is-dim");
      if (!set || el.classList.contains("is-dock")) continue;
      if (id === sel) el.classList.add("is-sel");
      else if (set.anc.has(id)) el.classList.add("is-anc");
      else if (set.desc.has(id)) el.classList.add("is-desc");
      else el.classList.add("is-dim");
    }
    for (const e of st.edges) {
      const path = st.svg.querySelector(`.bz-kb-mt-edge[data-mt-key="${cssEscape(e.key)}"]`);
      if (!path) continue;
      path.classList.remove("is-anc", "is-desc", "is-off");
      if (!set) continue;
      const isAnc = set.anc.has(e.from) && (e.to === sel || set.anc.has(e.to));
      const isDesc = (e.from === sel || set.desc.has(e.from)) && set.desc.has(e.to);
      if (isAnc) path.classList.add("is-anc");
      else if (isDesc) path.classList.add("is-desc");
      else path.classList.add("is-off");
    }
  }
  function setHover(st, key2, on) {
    var _a;
    if (!key2) {
      st.win.querySelectorAll(".is-hot").forEach((el) => el.classList.remove("is-hot"));
      return;
    }
    const edge = st.edges.find((e) => e.key === key2);
    if (!edge) return;
    const otherId = st.direction === "downstream" ? edge.to : edge.from;
    const list = [
      st.svg.querySelector(`.bz-kb-mt-edge[data-mt-key="${cssEscape(key2)}"]`),
      st.svg.querySelector(`.bz-kb-mt-edot[data-mt-key="${cssEscape(key2)}"]`),
      ...Array.from(st.win.querySelectorAll(`[data-mt-edge="${cssEscape(key2)}"]`)),
      (_a = st.cards.get(otherId)) != null ? _a : null
    ];
    for (const el of list) {
      if (!el) continue;
      el.classList.toggle("is-hot", on);
    }
  }
  function cssEscape(s) {
    return String(s).replace(/["\\]/g, "\\$&");
  }
  function applyTransform(st) {
    st.worldEl.style.transform = `translate(${st.tx}px, ${st.ty}px) scale(${st.scale})`;
  }
  function zoomAt(st, px, py, factor) {
    zoomAtAbsolute(st, px, py, st.scale * factor);
  }
  function zoomAtAbsolute(st, px, py, want) {
    const ns = clampMountScale(want);
    const k = ns / st.scale;
    st.tx = px - (px - st.tx) * k;
    st.ty = py - (py - st.ty) * k;
    st.scale = ns;
    applyTransform(st);
  }
  function zoomAtCenter(factor) {
    const st = state;
    if (!st) return;
    const w = st.canvasEl.clientWidth || CANVAS_FALLBACK_W;
    const h = st.canvasEl.clientHeight || CANVAS_FALLBACK_H;
    zoomAt(st, w / 2, h / 2, factor);
  }
  function fit() {
    const st = state;
    if (!st) return;
    const cw = st.canvasEl.clientWidth || CANVAS_FALLBACK_W;
    const ch = st.canvasEl.clientHeight || CANVAS_FALLBACK_H;
    const w = Math.max(1, st.world.w);
    const h = Math.max(1, st.world.h);
    st.scale = Math.min(ZOOM_FIT_MAX, Math.max(ZOOM_MIN, Math.min((cw - FIT_PAD) / w, (ch - FIT_PAD) / h)));
    st.tx = (cw - w * st.scale) / 2;
    st.ty = (ch - h * st.scale) / 2;
    applyTransform(st);
  }
  function openNodeMenu(nodeId, x, y) {
    var _a, _b, _c, _d, _e;
    const st = state;
    if (!st || !nodeId) return;
    const node = st.tree.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    closeMenu();
    const ghost = (_a = st.ghosts.get(nodeId)) != null ? _a : null;
    const litChild = (_b = st.tree.nodes.find((n) => n.attached && n.parent === nodeId)) != null ? _b : null;
    const isAttachment = node.kind === "image" || node.kind === "video";
    const entries = [
      { act: "open", label: "打开笔记", disabled: !!node.missing },
      { act: "lit", label: "看文献笔记", disabled: !litChild, title: litChild ? litChild.path : "这篇卡片没有同名文献" },
      { act: "copy", label: "复制双链", disabled: false },
      { act: "root", label: "设为主卡", disabled: !!node.missing || isAttachment || node.id === st.tree.root },
      { act: "who", label: "看谁挂了我（翻向上游）", disabled: !!node.missing || isAttachment },
      { act: "pin", label: "固定（正文写入双链）", disabled: !ghost },
      { act: "dismiss", label: "取消建议", disabled: !ghost },
      { act: "why", label: "看理由", disabled: !ghost }
    ];
    const menu = document.createElement("div");
    menu.className = "bz-kb-mt-ctx";
    menu.id = "bz-kb-mt-ctx";
    const head = document.createElement("div");
    head.className = "bz-kb-mt-ctx-head";
    head.textContent = displayTitle(node);
    menu.appendChild(head);
    if (ghost == null ? void 0 : ghost.reason) {
      const reason = document.createElement("div");
      reason.className = "bz-kb-mt-ctx-reason";
      reason.textContent = ghost.reason;
      menu.appendChild(reason);
    }
    for (const item of entries) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "bz-kb-mt-ctx-item";
      b.setAttribute("data-mt-menu", item.act);
      b.textContent = item.label;
      if (item.disabled) {
        b.disabled = true;
        b.classList.add("is-dis");
      }
      if (item.title) b.title = item.title;
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (item.disabled) return;
        closeMenu();
        runMenuAction(st, item.act, node, ghost);
      });
      menu.appendChild(b);
    }
    st.win.appendChild(menu);
    const rect = (_e = (_d = (_c = st.win).getBoundingClientRect) == null ? void 0 : _d.call(_c)) != null ? _e : { left: 0, top: 0, width: CANVAS_FALLBACK_W, height: CANVAS_FALLBACK_H };
    const mw = menu.offsetWidth || 240;
    const mh = menu.offsetHeight || 280;
    const left = Math.max(8, Math.min(x - num(rect.left), (rect.width || CANVAS_FALLBACK_W) - mw - 8));
    const top = Math.max(8, Math.min(y - num(rect.top), (rect.height || CANVAS_FALLBACK_H) - mh - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    st.menu = menu;
    const outside = (ev) => {
      var _a2, _b2;
      if (!st.menu) return;
      if ((_b2 = (_a2 = ev.target) == null ? void 0 : _a2.closest) == null ? void 0 : _b2.call(_a2, "#bz-kb-mt-ctx")) return;
      closeMenu();
    };
    setOutsideHandler(outside);
  }
  var menuOutsideHandler = null;
  function setOutsideHandler(fn) {
    if (menuOutsideHandler) document.removeEventListener("pointerdown", menuOutsideHandler, true);
    menuOutsideHandler = fn;
    document.addEventListener("pointerdown", fn, true);
  }
  function closeMenu() {
    var _a;
    const st = state;
    (_a = st == null ? void 0 : st.menu) == null ? void 0 : _a.remove();
    if (st) st.menu = null;
    if (menuOutsideHandler) {
      document.removeEventListener("pointerdown", menuOutsideHandler, true);
      menuOutsideHandler = null;
    }
  }
  function runMenuAction(st, act, node, ghost) {
    if (act === "open") {
      st.deps.openNote(node.path);
      return;
    }
    if (act === "lit") {
      const lit = st.tree.nodes.find((n) => n.attached && n.parent === node.id);
      if (lit) st.deps.openNote(lit.path);
      return;
    }
    if (act === "copy") {
      const text = mountLinkText(node);
      void st.deps.writeClipboard(text).then(() => st.deps.notice(`已复制：${text}`, "success")).catch(() => st.deps.notice("复制失败：剪贴板不可用", "error"));
      return;
    }
    if (act === "root") {
      void openMountTree(node.path, { direction: st.direction, deps: depsOf(st) });
      return;
    }
    if (act === "who") {
      void openMountTree(node.path, { direction: "upstream", deps: depsOf(st) });
      return;
    }
    if (act === "why") {
      if (ghost) st.deps.notice(`建议理由：${ghost.reason || "（无理由）"}`);
      return;
    }
    if (act === "pin" && ghost) {
      void pinSuggestion(st, ghost);
      return;
    }
    if (act === "dismiss" && ghost) {
      void dismissSuggestion(st, ghost);
    }
  }
  async function pinSuggestion(st, ghost) {
    var _a, _b, _c, _d, _e;
    const rootPath = st.tree.root;
    const app = (_a = st.ctx.app) != null ? _a : getApp();
    let unit = ghost.unit === "heading" || ghost.unit === "paragraph" ? ghost.unit : "whole";
    let subpath = String((_b = ghost.subpath) != null ? _b : "").trim();
    if (unit === "paragraph") {
      const got = ghost.quote ? await ensureSuggestionBlockId(app, ghost.target, ghost.quote) : { blockId: "", ok: false };
      if (got.ok && got.blockId) subpath = got.blockId;
      else unit = "whole";
    } else if (unit === "heading" && !subpath) {
      unit = "whole";
    }
    const shape = { target: ghost.target, unit, subpath };
    const linkInner = suggestionLinkTarget(shape);
    const anchorText = String((_d = (_c = ghost.anchor) == null ? void 0 : _c.text) != null ? _d : "").trim();
    let written = `[[${linkInner}]]`;
    let found = false;
    let changed = false;
    try {
      await enqueueFileTask(rootPath, async () => {
        var _a2, _b2;
        const file = (_b2 = (_a2 = app == null ? void 0 : app.vault) == null ? void 0 : _a2.getAbstractFileByPath) == null ? void 0 : _b2.call(_a2, rootPath);
        if (!file) return;
        found = true;
        const text = await app.vault.read(file);
        const aliasNext = replaceAnchorWithAlias(text, ghost.anchor, ghost.target, suggestionSubpath(shape));
        if (aliasNext !== null) written = `[[${linkInner}|${anchorText}]]`;
        const next = aliasNext != null ? aliasNext : insertLinkAtAnchor(text, ghost.anchor, linkInner);
        if (next !== text) {
          await app.vault.modify(file, next);
          changed = true;
        }
      });
    } catch (e) {
      st.deps.notice(`固定失败：${(_e = e == null ? void 0 : e.message) != null ? _e : String(e)}`, "error");
      return;
    }
    if (!found) {
      st.deps.notice("固定失败：读不到主卡文件", "error");
      return;
    }
    try {
      await markSuggestion(rootPath, ghost, "fixed", { app, cardboxDir: st.ctx.cardboxDir, litDir: st.ctx.litDir });
    } catch (e) {
    }
    const gid = suggestionId(ghost);
    if (st.run) st.run = { ...st.run, suggestions: st.run.suggestions.filter((s) => suggestionId(s) !== gid) };
    st.ghosts.delete(gid);
    st.deps.notice(
      changed ? `已固定：正文写入 ${written}` : `已固定：正文里已有 [[${linkInner}]]，本次只留档`,
      "success"
    );
    await rebuildTreeOnly(st);
  }
  async function dismissSuggestion(st, ghost) {
    var _a;
    const rootPath = st.tree.root;
    const app = (_a = st.ctx.app) != null ? _a : getApp();
    try {
      await markSuggestion(rootPath, ghost, "dismissed", { app, cardboxDir: st.ctx.cardboxDir, litDir: st.ctx.litDir });
    } catch (e) {
    }
    if (st.run) st.run = { ...st.run, suggestions: st.run.suggestions.filter((s) => suggestionId(s) !== suggestionId(ghost)) };
    st.ghosts.delete(suggestionId(ghost));
    st.deps.notice("已取消建议：永久不再推荐这条", "success");
    await rebuildTreeOnly(st);
  }

  // src/knowledge/video-meta.ts
  var BVID_RE = /BV[0-9A-Za-z]{10}/;
  var BVID_EXACT_RE = /^BV[0-9A-Za-z]{10}$/;
  var BILI_HOST_RE = /(^|\.)(bilibili\.com|b23\.tv)$/i;
  function isBiliUrl(text) {
    const m = text.match(/^https?:\/\/([^/?#]+)/i);
    return !!m && BILI_HOST_RE.test(m[1].toLowerCase().replace(/^www\./i, ""));
  }
  function parseBvid(input) {
    const m = String(input != null ? input : "").match(BVID_RE);
    return m ? m[0] : null;
  }
  var VIEW_TIMEOUT_MS = 1e4;
  var QUALITY_TIMEOUT_MS = 1e4;
  var NAV_TIMEOUT_MS = 1e4;
  function withTimeout2(p, ms) {
    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    });
    const done = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    return Promise.race([p, timeout]).then(
      (v) => {
        done();
        return v === null ? null : v;
      },
      (e) => {
        done();
        throw e;
      }
    );
  }
  function parseJson(resp) {
    if (!resp || resp.status < 200 || resp.status >= 300) return null;
    try {
      return JSON.parse(resp.text);
    } catch (e) {
      return null;
    }
  }
  function posInt(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }
  function metaFromVideoData(d) {
    if (!d || typeof d !== "object") return null;
    const meta = {};
    const title = typeof d.title === "string" ? d.title.trim() : "";
    const ownerName = d.owner && typeof d.owner.name === "string" ? d.owner.name.trim() : "";
    const bvid = bvidFromVideoData(d);
    if (title) meta.title = title;
    if (ownerName) meta.uploader = ownerName;
    if (bvid) meta.bvid = bvid;
    const duration = posInt(d.duration);
    if (duration) meta.duration = duration;
    let pages = [];
    if (Array.isArray(d.pages)) {
      d.pages.forEach((p, i) => {
        const cid = posInt(p && p.cid);
        if (!cid) return;
        pages.push({
          page: posInt(p.page) || i + 1,
          part: typeof p.part === "string" ? p.part.trim() : "",
          duration: posInt(p.duration) || duration,
          cid
        });
      });
    }
    if (pages.length) meta.pages = pages;
    return meta.title || meta.uploader || meta.pages ? meta : null;
  }
  function videoDataFromState(state2) {
    const s = state2;
    if (!s || typeof s !== "object") return null;
    if (s.videoData && typeof s.videoData === "object") return s.videoData;
    const v = s.video;
    if (v && typeof v === "object" && v.viewInfo && typeof v.viewInfo === "object") return v.viewInfo;
    return null;
  }
  function extractInitialState(html) {
    const i = html.indexOf("__INITIAL_STATE__");
    if (i < 0) return null;
    const start = html.indexOf("{", i);
    if (start < 0) return null;
    let depth = 0;
    let end = -1;
    let inStr = false;
    let esc2 = false;
    for (let k = start; k < html.length; k++) {
      const ch = html[k];
      if (inStr) {
        if (esc2) esc2 = false;
        else if (ch === "\\") esc2 = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = k + 1;
          break;
        }
      }
    }
    if (end < 0) return null;
    try {
      return JSON.parse(html.slice(start, end));
    } catch (e) {
      return null;
    }
  }
  function bvidFromVideoData(d) {
    const b = d && typeof d.bvid === "string" ? d.bvid.trim() : "";
    return BVID_EXACT_RE.test(b) ? b : null;
  }
  function bvidFromOgUrl(html) {
    const og = /og:url["']?\s+content=["']([^"']+)["']/i.exec(html);
    if (!og) return null;
    const m = /\/video\/(BV[0-9A-Za-z]{10})/.exec(og[1]);
    return m ? m[1] : null;
  }
  async function fetchFromViewApi(bvid) {
    try {
      const json = parseJson(await withTimeout2(requestUrl({ url: `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, method: "GET" }), VIEW_TIMEOUT_MS));
      if (!json || json.code !== 0 || !json.data) return null;
      return metaFromVideoData(json.data);
    } catch (e) {
      return null;
    }
  }
  var PAGE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    Referer: "https://www.bilibili.com/"
  };
  async function fetchFromPage(url) {
    var _a;
    let html = "";
    try {
      const resp = await withTimeout2(requestUrl({ url, method: "GET", headers: { ...PAGE_HEADERS } }), VIEW_TIMEOUT_MS);
      if (!resp || resp.status < 200 || resp.status >= 300) return null;
      html = String((_a = resp.text) != null ? _a : "");
    } catch (e) {
      return null;
    }
    if (!html) return null;
    const state2 = extractInitialState(html);
    const videoData = videoDataFromState(state2);
    const viaState = metaFromVideoData(videoData);
    const bvid = bvidFromOgUrl(html) || bvidFromVideoData(videoData);
    if (viaState) return { bvid: bvid || viaState.bvid || null, meta: viaState };
    const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
    const title = t && t[1] ? cleanSourceTitle(t[1].trim()) : "";
    if (title) return { bvid, meta: bvid ? { title, bvid } : { title } };
    return { bvid, meta: null };
  }
  async function fetchVideoMeta(input) {
    const text = String(input != null ? input : "").trim();
    if (!text) return null;
    const bvid = parseBvid(text);
    if (bvid) {
      const viaApi = await fetchFromViewApi(bvid);
      if (viaApi) return { ...viaApi, bvid: viaApi.bvid || bvid };
      if (!isBiliUrl(text)) return null;
      const page2 = await fetchFromPage(text);
      if (!page2) return null;
      if (!page2.meta && !page2.bvid) return null;
      const known = page2.bvid || bvid;
      return { ...page2.meta || {}, bvid: page2.meta && page2.meta.bvid || known };
    }
    if (!isUrlLikeSourceText(text)) return null;
    const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    if (!isBiliUrl(url)) return null;
    const page = await fetchFromPage(url);
    if (!page) return null;
    if (page.bvid) {
      const viaApi = await fetchFromViewApi(page.bvid);
      if (viaApi) return { ...viaApi, bvid: viaApi.bvid || page.bvid };
    }
    if (!page.meta) return page.bvid ? { bvid: page.bvid } : null;
    return page.bvid && !page.meta.bvid ? { ...page.meta, bvid: page.bvid } : page.meta;
  }
  function needsBvidRepair(url) {
    const text = String(url != null ? url : "").trim();
    return !!text && isBiliUrl(text) && !parseBvid(text);
  }
  async function isCookieLoggedIn(cookie) {
    const c = String(cookie != null ? cookie : "").trim();
    if (!c) return false;
    try {
      const json = parseJson(await withTimeout2(
        requestUrl({ url: "https://api.bilibili.com/x/web-interface/nav", method: "GET", headers: { Cookie: c } }),
        NAV_TIMEOUT_MS
      ));
      return !!(json && json.code === 0 && json.data && json.data.isLogin === true);
    } catch (e) {
      return false;
    }
  }
  async function fetchVideoQualities(bvid, cid, cookie) {
    const c = String(cookie != null ? cookie : "").trim();
    if (!c || !bvid || !posInt(cid)) return null;
    try {
      const url = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${posInt(cid)}&qn=127&fnval=4048&fourk=1`;
      const json = parseJson(await withTimeout2(
        requestUrl({ url, method: "GET", headers: { Cookie: c } }),
        QUALITY_TIMEOUT_MS
      ));
      const videos = json && json.code === 0 && json.data && json.data.dash ? json.data.dash.video : null;
      if (!Array.isArray(videos)) return null;
      const heights = Array.from(new Set(videos.map((f) => posInt(f && f.height)).filter((h) => h > 0))).sort((a, b) => b - a);
      return heights.length ? heights : null;
    } catch (e) {
      return null;
    }
  }
  async function fetchCheckedQualities(bvid, cid, cookie) {
    const c = String(cookie != null ? cookie : "").trim();
    if (!c || !bvid || !posInt(cid)) return null;
    if (!await isCookieLoggedIn(c)) return null;
    return await fetchVideoQualities(bvid, cid, c);
  }
  async function resolveVideo(input, cookie, pageIndex = 0) {
    const meta = await fetchVideoMeta(input);
    if (!meta) return null;
    const bvid = meta.bvid || parseBvid(input);
    const pages = meta.pages || [];
    const sel = pages[pageIndex] || pages[0];
    const qualities = bvid && sel && sel.cid ? await fetchCheckedQualities(bvid, sel.cid, cookie) : null;
    return { meta, qualities };
  }

  // src/knowledge/range-bar.ts
  var RangeBar = class {
    constructor(opts) {
      this.total = 0;
      this.start = 0;
      this.end = 0;
      this.onChange = opts.onChange;
      this.el = document.createElement("div");
      this.el.className = "bz-lit-rb";
      this.track = document.createElement("div");
      this.track.className = "bz-lit-rb-track";
      this.fill = document.createElement("div");
      this.fill.className = "bz-lit-rb-fill";
      this.hStart = this._makeHandle("start", "开始把手");
      this.hEnd = this._makeHandle("end", "结束把手");
      this.track.appendChild(this.fill);
      this.track.appendChild(this.hStart);
      this.track.appendChild(this.hEnd);
      this.el.appendChild(this.track);
    }
    _makeHandle(which, label) {
      const h = document.createElement("div");
      h.className = `bz-lit-rb-handle bz-lit-rb-${which === "start" ? "hs" : "he"}`;
      h.setAttribute("role", "slider");
      h.setAttribute("aria-label", label);
      h.tabIndex = 0;
      h.addEventListener("pointerdown", (e) => this._beginDrag(e, which));
      h.addEventListener("keydown", (e) => this._onKey(e, which));
      return h;
    }
    /** 重设量程与值（秒；整数化 + 钳制），只重绘不回调 */
    set(totalSec, startSec, endSec) {
      this.total = Math.max(0, Math.round(totalSec) || 0);
      let s = Math.max(0, Math.min(Math.round(startSec) || 0, this.total));
      let e = Math.max(0, Math.min(Math.round(endSec) || 0, this.total));
      if (this.total >= 2) {
        s = Math.min(s, this.total - 1);
        e = Math.max(e, Math.min(this.total, s + 1));
      }
      this.start = s;
      this.end = e;
      this._paint();
    }
    /** 拖拽中更新（内部用，立即回调） */
    _apply(s, e) {
      this.start = s;
      this.end = e;
      this._paint();
      this.onChange(s, e);
    }
    _paint() {
      const T = this.total || 1;
      const sp = this.total > 0 ? this.start / T * 100 : 0;
      const ep = this.total > 0 ? this.end / T * 100 : 100;
      this.hStart.style.left = `${sp}%`;
      this.hEnd.style.left = `${ep}%`;
      this.fill.style.left = `${sp}%`;
      this.fill.style.width = `${Math.max(0, ep - sp)}%`;
      for (const [h, v] of [[this.hStart, this.start], [this.hEnd, this.end]]) {
        h.setAttribute("aria-valuemin", "0");
        h.setAttribute("aria-valuemax", String(this.total));
        h.setAttribute("aria-valuenow", String(v));
      }
      this.el.classList.toggle("is-disabled", this.total < 2);
    }
    _beginDrag(e, which) {
      if (this.total < 2 || e.button !== 0) return;
      e.preventDefault();
      const handle = e.currentTarget;
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (e2) {
      }
      const rect0 = this.track.getBoundingClientRect();
      const grabSec = which === "start" ? this.start : this.end;
      const grabX = rect0.left + (rect0.width > 0 ? grabSec / this.total * rect0.width : 0);
      const offset = e.clientX - grabX;
      const move = (ev) => {
        const rect = this.track.getBoundingClientRect();
        const ratio = rect.width > 0 ? (ev.clientX - offset - rect.left) / rect.width : 0;
        const sec = Math.round(Math.max(0, Math.min(1, ratio)) * this.total);
        if (which === "start") this._apply(Math.max(0, Math.min(sec, this.end - 1)), this.end);
        else this._apply(this.start, Math.min(this.total, Math.max(sec, this.start + 1)));
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    }
    _onKey(e, which) {
      if (this.total < 2) return;
      const step = e.shiftKey ? 10 : 1;
      let delta = 0;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -step;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = step;
      else return;
      e.preventDefault();
      if (which === "start") this._apply(Math.max(0, Math.min(this.start + delta, this.end - 1)), this.end);
      else this._apply(this.start, Math.min(this.total, Math.max(this.end + delta, this.start + 1)));
    }
  };

  // src/knowledge/ui.ts
  function litKindPlain(type) {
    if (type === "video") return "影像";
    if (type === "passage") return "段落";
    if (type === "image") return "图版";
    return "名词";
  }
  function litKindLabel(type) {
    return litKindPlain(type).split("").join(" ");
  }
  var IMAGE_ENTRY_MAX = 9;
  var REL_BG_NOTICE_KEY = "bz-kb-entry-rel";
  var STATUS_META = {
    pending: { label: "待处理", cls: "bz-kb-pending" },
    processing: { label: "处理中", cls: "bz-kb-processing" },
    success: { label: "成功", cls: "bz-kb-success" },
    failed: { label: "失败", cls: "bz-kb-failed" }
  };
  function q(root, sel) {
    return root.querySelector(sel);
  }
  function clipboardImageFiles(dt) {
    var _a;
    if (!dt) return [];
    const out = [];
    const items = dt.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if ((it == null ? void 0 : it.kind) === "file" && /^image\//i.test(it.type)) {
          const f = it.getAsFile();
          if (f) out.push(f);
        }
      }
    }
    if (out.length) return out;
    const files = dt.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        if (/^image\//i.test(((_a = files[i]) == null ? void 0 : _a.type) || "")) out.push(files[i]);
      }
    }
    return out;
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function shortNoteName(path) {
    const base = String(path || "").replace(/\\/g, "/").split("/").pop() || "";
    return stripMdExt(base) || String(path || "");
  }
  function parseRelatedNames(text) {
    var _a;
    const lines = String(text != null ? text : "").split(/\r?\n/);
    if (((_a = lines[0]) == null ? void 0 : _a.trim()) !== "---") return [];
    const out = [];
    let inRelated = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === "---") break;
      if (/^related:/.test(line)) {
        inRelated = true;
        continue;
      }
      if (!inRelated) continue;
      if (/^\s+-\s/.test(line)) {
        const mm = line.match(/^\s*-\s*"?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]"?\s*$/);
        if (mm) out.push(mm[2] || shortNoteName(mm[1]));
      } else if (line.trim() !== "") {
        break;
      }
    }
    return out;
  }
  function humanizeError(reason) {
    const s = String(reason != null ? reason : "").trim();
    if (!s) return "";
    if (/未找到 bili-dl|npm install -g @jwbz\/bili-downloader|ENOENT.*bili-dl/i.test(s)) {
      return "下载工具未安装：在电脑上运行 npm install -g @jwbz/bili-downloader 后重试";
    }
    if (/ffmpeg/i.test(s)) return "视频处理工具（ffmpeg）不可用：检查电脑是否已安装，或设置里的「ffmpeg 路径」";
    if (/ffprobe/i.test(s)) return "视频探测工具（ffprobe）不可用：检查电脑是否已安装，或设置里的「ffprobe 路径」";
    if (/找不到 Python|无法启动 Python|python.*ENOENT/i.test(s)) {
      return "语音转写失败：未找到 Python——设置里「Python 路径」填 python（一般装了 Python 即可），或运行 where python 查绝对路径填入";
    }
    if (/未配置 pythonPath/i.test(s)) {
      return "语音转写未配置：知识盒设置「Python 路径」填 python 即可（一般装了 Python 就能用，走系统 PATH），或填绝对路径（Windows 在命令提示符运行 where python 可查）";
    }
    if (/pip install faster-whisper|faster-whisper 环境已安装/i.test(s)) {
      return "语音转写失败：faster-whisper 未安装，请在目标 Python 中运行 pip install faster-whisper";
    }
    if (/whisper|faster.whisper|no module/i.test(s)) {
      return "语音转写失败：检查设置里的「Python 路径」与「Whisper 模型」";
    }
    if (/API Key|AI 配置|未配置|Unauthorized|\b401\b|invalid_api_key|insufficient|quota/i.test(s)) {
      return "AI 配置不可用：请在插件设置 → AI 配置里检查 API Key";
    }
    if (/AI 请求超时|AI 返回的不是 JSON/i.test(s)) return "AI 响应异常：网络不稳定或服务繁忙，稍后重试";
    if (/转录文件读取失败|无转录文件/i.test(s)) return "转写稿缺失：视频处理步骤未完成，可重试";
    if (/ETIMEDOUT|ESOCKETTIMEDOUT|timed? ?out|超时/i.test(s)) return "网络超时：请检查网络连接后重试";
    if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed/i.test(s)) {
      return "网络连接失败：请检查网络或代理设置后重试";
    }
    if (/^-352|\b412\b|风控|请求过于频繁/i.test(s)) return "B 站风控拦截：稍后再试，或在设置里配置登录 Cookie";
    if (/视频不存在|稿件不存在|\b404\b|not found/i.test(s)) return "视频不存在或已删除：请检查链接是否正确";
    return s.length > 160 ? s.slice(0, 160) + "…" : s;
  }
  var STEP_DONE_MAP = {
    "AI 生成文献笔记中": "已生成文献笔记",
    "笔记落盘中": "已落盘笔记"
  };
  function stepDoneLabel(step) {
    const mapped = STEP_DONE_MAP[step];
    if (mapped) return mapped;
    return step.endsWith("中") ? `已${step.slice(0, -1)}` : `已${step}`;
  }
  function shortUrlText(url) {
    const m = url.match(/BV[0-9A-Za-z]{8,12}/i) || url.match(/b23\.tv\/([0-9A-Za-z]+)/i);
    if (m) return m[0];
    return url.length > 28 ? url.slice(0, 28) + "…" : url;
  }
  var fmtElapsed = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1e3));
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
  };
  function dateStamp() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function litDirOf(s) {
    return getKnowledgeBoxes(s || {}).lit;
  }
  function cardboxDirOf(s) {
    return getKnowledgeBoxes(s || {}).cardbox;
  }
  function topicDirOf(s) {
    return getKnowledgeBoxes(s || {}).topic;
  }
  function parseDateRaw(raw) {
    const s = String(raw != null ? raw : "").trim();
    if (!s) return NaN;
    const d1 = new Date(s.replace(" ", "T"));
    if (!isNaN(d1.valueOf())) return d1.valueOf();
    const d2 = new Date(s);
    return d2.valueOf();
  }
  function stripFrontmatter3(text) {
    const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    return text.slice(m ? m[0].length : 0).replace(/^\r?\n+/, "");
  }
  function appendRelatedLine(text, link) {
    var _a;
    const lines = text.split(/\r?\n/);
    if (((_a = lines[0]) == null ? void 0 : _a.trim()) !== "---") return text;
    let close = -1;
    let relatedAt = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        close = i;
        break;
      }
      if (/^related:/.test(lines[i])) relatedAt = i;
    }
    if (close === -1) return text;
    if (relatedAt === -1) {
      lines.splice(close, 0, "related:", `  - "${link}"`);
    } else {
      let end = relatedAt + 1;
      while (end < close && /^\s*-\s/.test(lines[end])) end++;
      lines.splice(end, 0, `  - "${link}"`);
    }
    return lines.join("\n");
  }
  var UIManager = class {
    constructor(app) {
      // ---- 主壳（三部）----
      this.mask = null;
      this.popup = null;
      this.contentEl = null;
      this.part = "z1";
      this.allNotes = [];
      this.allCards = [];
      this.allTopics = [];
      /** 已渲染的卡片行数（issue 323：翻页只**追加**新行，不再整表 innerHTML 重建） */
      this.cardsShown = 0;
      /** 卡片行容器（与表头/页脚分离，追加与徽标补丁都打在它身上） */
      this.cardRowsEl = null;
      /**
       * 挂载引用索引（issue 320 / 323）：整库扫描一次并**缓存到面板对象上**——
       * 行引用计数徽标（refCounts）、孤儿筛选与行标记（orphanCards）共用这一份；
       * counts 算好后**传给 orphanCards 复用**（其内部不再自行复算一遍）。
       *
       * 323 起改**面板会话缓存 + 脏标记**：切到卡片部不再整库重扫（1503+ 文件逐个解析出站链是切换卡顿的大头），
       * 只有**落卡 / 库内文件变更 / 目录变更 / 显式刷新**才置脏重算。
       */
      this.mountIndex = null;
      this.mountIndexDirty = true;
      /** 部贰「只看孤儿」筛选开关（内存态，重渲染 / 换部来回都保留） */
      this.cardOrphanOnly = false;
      this.editor = null;
      this.sessionNewPaths = /* @__PURE__ */ new Set();
      this.loadedLitDir = "";
      this.loadedCardDir = "";
      this.loadedTopicDir = "";
      this.backfilledDir = "";
      // ---- 影像：录入弹层 / 处理面板（内含历史视图）（issue 310）----
      this.videoMask = null;
      this.videoPopup = null;
      this.videoList = null;
      /** 批量钮的图标容器（play ↔ square 就地换字符，issue 310 去 emoji） */
      this.runIcon = null;
      // ---- 添加任务弹窗 ----
      this.addMask = null;
      this.addPopup = null;
      /** 用户动过表单（issue 326 关闭二次确认的脏标记）：只在真实用户事件点打标、开窗/保存成功复位——
       *  不做数值比对，因为打开即自动重抓（ADR-0133）会程序化改写 url 与时长区间，比值必假阳 */
      this.addDirty = false;
      // ---- 添加弹窗解析态（ADR-0133：解析按钮 + 只读信息区 + 双把手范围）----
      /** 解析序列号：新解析/关弹窗使在途响应过期（回填前校验丢弃） */
      this.addUrlSeq = 0;
      /** 解析中（解析按钮 loading、保存禁用） */
      this.addResolving = false;
      /**
       * 下半个表单是否展开（issue 310：录入界面初始**只显示链接行**，解析跑完才展开
       * 信息 / 分P / 剪辑 / 清晰度 / 保存）。置 true 的时机：解析流程结束（成功或失败）、
       * 编辑既有任务（已有数据）；置 false：新开弹窗、链接被改动（旧信息作废，需重新解析）。
       */
      this.addRevealed = false;
      /** 解析成功的信息（null = 未解析 / 失败态） */
      this.addMeta = null;
      /** 实测清晰度档位（null = 未取到 → 固定列表回落） */
      this.addQualities = null;
      /** 当前选中分 P（1 起） */
      this.addPage = 1;
      /** 当前 P 时长（秒；0 = 未知 → 进度条不可用、只出时间框） */
      this.addDuration = 0;
      /** 范围选择（秒；全选 = 整片） */
      this.addStart = 0;
      this.addEnd = 0;
      /** 双把手范围条实例（重建时销毁旧的） */
      this.addBar = null;
      /** 主面板自动重抓（ADR-0133）：进行中标记 + 已尝试任务 id 集（防重入/防重复请求） */
      this.backfillRunning = false;
      this.backfillTried = /* @__PURE__ */ new Set();
      /** 处理面板当前视图：tasks=任务队列 / history=归档（2026-09-14 复核起同面板切换，无独立历史窗） */
      this.videoView = "tasks";
      // ---- 文字录入面板（名词 / 段落 / 图版同壳三态，issue 309/312）----
      this.termMask = null;
      this.termPopup = null;
      /** 当前录入态：term = 一个词（名词）/ passage = 一段文字（段落）/ image = 一张图（图版） */
      this.entryMode = "term";
      this.termPreview = null;
      this.termGenerating = false;
      this.termSummarizing = false;
      this.termHasDraft = false;
      this.termSource = null;
      // 来源（名词/段落/图版共用行，ADR-0116；null = 未填）
      /**
       * 图版待落盘图片（issue 312；多图 issue 313）：拖入/粘贴/选择后**只留在内存**
       * （bytes 原样 + 预览用 data URL），确认写入时才 createBinary 进图片目录——
       * 与「草稿不落盘」同口径，取消不留孤儿文件。顺序 = 用户放入顺序（就是笔记里的图片顺序）。
       * desc = 该张的用户图注（ADR-0145 逐图描述框；属于草稿态——删图连描述一起没，关面板即清）。
       */
      this.entryImages = [];
      /** 确认写入成功后的回调（issue 329 剪藏本工具框流程）：有回调则写入后**不自动打开笔记**（ADR-0144），路径交调用方 */
      this.entryOnCreated = null;
      /** 关联行状态机：idle（未生成）→ loading（预演中）→ done/empty/queued/failed/off */
      this.entryRelState = "idle";
      /** 关联行结果文案（done 时 = 关联标题顿号串） */
      this.entryRelText = "";
      /** 预演命中的目标路径（确认写入时据此写 related，不重跑检索与裁判） */
      this.entryPreviewPicks = [];
      /** 预演是否已给出确定结果（done）——确定过就连「0 命中」也算结论，写入时不再重跑管线 */
      this.entryPreviewDone = false;
      /** 在跑预演的中断器（issue 327）：重新生成 / 总结 / 关面板 / 确认写入转后台时 abort 在途裁判请求 */
      this.entryRelAbort = null;
      /** 预演序号：重新生成 / 关闭面板让在途结果作废（晚到的响应不得覆盖新状态） */
      this.entryRelSeq = 0;
      this.termSrcSuggest = null;
      this.termSrcTimer = null;
      this.editingId = null;
      this.onKeydown = () => {
      };
      /** Ctrl+V 粘贴截图监听（issue 312；document 级，图版态才接管——见 createTermUI） */
      this.onPaste = () => {
      };
      this.batchAbortLabel = null;
      this.runState = /* @__PURE__ */ new Map();
      this.runTimer = null;
      this.fileListenerRefs = [];
      this.fileListenerAttached = false;
      this.refreshTimer = null;
      this.pendingRefreshPaths = /* @__PURE__ */ new Set();
      this.pendingDeletePaths = /* @__PURE__ */ new Set();
      this._previewNote = null;
      /** 独立弹层宿主（issue 329 文献预览直达）：主面板不在场时预览弹层的全屏定位底座——
       *  纸墨变量随 .kb 作用域生效，topifyZ 发号；用完由 closeSheet 撤除，不常驻空壳节点 */
      this.previewHostEl = null;
      this.app = app;
      this.createMainUI();
      this.createVideoUI();
      this.createAddDialog();
      this.createTermUI();
      this.onKeydown = (e) => {
        if (e.key !== "Escape") return;
        if (this.termPopup && this.termPopup.style.display === "flex") this.requestTermClose();
        else if (this.addPopup && this.addPopup.style.display === "flex") this.requestAddClose();
        else if (this.videoPopup && this.videoPopup.style.display === "flex") {
          if (this.videoView === "history") this.switchVideoView("tasks");
          else this.hideVideo();
        } else if (this.popup && this.popup.style.display === "flex") this.hideMain();
      };
      document.addEventListener("keydown", this.onKeydown);
    }
    // ==================== 主壳（三部） ====================
    createMainUI() {
      var _a;
      if (this.mask && this.mask.isConnected || this.popup && this.popup.isConnected) return;
      const mask = document.createElement("div");
      mask.id = "knowledge-mask";
      mask.className = "bz-kb-mask";
      mask.style.display = "none";
      mask.onclick = () => this.hideMain();
      const popup = document.createElement("div");
      popup.id = "knowledge-popup";
      popup.className = "bz-kb-window kb";
      if (isMobileEnv()) popup.classList.add("bz-panel-mtop");
      popup.style.display = "none";
      const partBtns = `
          <button class="bz-kb-part is-on" data-kb-act="part" data-part="z1">部壹 · 文献</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z2">部贰 · 卡片</button>
          <button class="bz-kb-part" data-kb-act="part" data-part="z3">部叁 · 主题</button>`;
      popup.innerHTML = isMobileEnv() ? `
      <div class="bz-kb-head">
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
        <button class="bz-kb-mclose" data-kb-act="kb-close" title="关闭知识盒">✕</button>
      </div>
      <div class="bz-kb-parts">${partBtns}
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>` : `
      <div class="bz-kb-head">
        <div class="bz-kb-parts">${partBtns}
        </div>
        <div class="bz-kb-brand">
          <div class="bz-kb-top">LEXICON · BOX OF NOTES</div>
          <div class="bz-kb-title">知 识 盒</div>
        </div>
      </div>
      <div class="bz-kb-sc" id="kb-sc"></div>`;
      document.body.appendChild(mask);
      document.body.appendChild(popup);
      this.mask = mask;
      this.popup = popup;
      this.contentEl = q(popup, "#kb-sc");
      popup.addEventListener("click", (e) => this.onShellClick(e));
      (_a = this.contentEl) == null ? void 0 : _a.addEventListener("scroll", () => this.onContentScroll());
      this.attachFileListener();
    }
    /** 主壳点击委托（部切换 / 录入入口 / 文献行 / 主题行 / 返回） */
    onShellClick(e) {
      const t = e.target.closest("[data-kb-act]");
      if (!t) return;
      const act = t.getAttribute("data-kb-act");
      if (act === "part") {
        this.part = t.getAttribute("data-part") || "z1";
        void this.refreshCurrent();
        this.syncPartButtons();
      } else if (act === "term-entry") this.showTermEntry();
      else if (act === "passage-entry") this.showPassageEntry();
      else if (act === "video-entry") this.showVideoEntry();
      else if (act === "image-entry") this.showImageEntry();
      else if (act === "lit-peek") {
        const p = t.getAttribute("data-path") || "";
        const n = this.allNotes.find((x) => x.path === p);
        if (n) void this.openPreview(n);
      } else if (act === "card-peek") {
        const p = t.getAttribute("data-path") || "";
        const c = this.allCards.find((x) => x.path === p);
        if (c) void this.openPreview(c, "card");
      } else if (act === "mount-tree") {
        const p = t.getAttribute("data-path") || "";
        if (p) void openMountTree(p);
      } else if (act === "cards-orphan") {
        if (!this.mountIndex) return;
        this.cardOrphanOnly = !this.cardOrphanOnly;
        this.renderCards();
      } else if (act === "topic-open") {
        const p = t.getAttribute("data-path") || "";
        const tp = this.allTopics.find((x) => x.path === p);
        if (tp) void this.openPreview({ file: tp.file, path: tp.path, title: tp.title, domain: tp.where }, "topic");
      } else if (act === "kb-close") this.hideMain();
    }
    syncPartButtons() {
      if (!this.popup) return;
      this.popup.querySelectorAll(".bz-kb-part").forEach((b) => {
        b.classList.toggle("is-on", b.getAttribute("data-part") === this.part);
      });
    }
    showMain() {
      this.createMainUI();
      if (!this.popup || !this.mask || !this.contentEl) return;
      topifyZ(this.mask, this.popup);
      this.mask.style.display = "block";
      this.popup.style.display = "flex";
      void this.refreshCurrent();
      void this.runBackfill();
    }
    hideMain() {
      if (this.mask) this.mask.style.display = "none";
      if (this.popup) this.popup.style.display = "none";
    }
    /** 当前部数据 + 渲染（目录变更检测 → 清缓存重扫） */
    async refreshCurrent() {
      if (!this.contentEl) return;
      const s = tryGetSettings();
      if (this.part === "z1") {
        const dir = litDirOf(s);
        if (this.loadedLitDir && this.loadedLitDir !== dir) this.allNotes = [];
        await this.loadLiterature(dir);
        this.renderLiterature();
      } else if (this.part === "z2") {
        const dir = cardboxDirOf(s);
        if (this.loadedCardDir && this.loadedCardDir !== dir) {
          this.allCards = [];
          this.markCardsDirty();
        }
        await this.loadCards(dir);
        this.renderCards();
        if (this.part !== "z2") return;
        if (this.mountIndexDirty) await this.loadMountIndex();
        if (this.part === "z2") this.applyMountIndex();
      } else {
        const dir = topicDirOf(s);
        if (this.loadedTopicDir && this.loadedTopicDir !== dir) this.allTopics = [];
        await this.loadTopics(dir);
        this.renderTopics();
      }
    }
    /** 部壹文献扫描：文献目录下全部 .md（含子目录），metadataCache 解析 frontmatter */
    async loadLiterature(dir) {
      const app = getApp();
      this.loadedLitDir = dir;
      const prefix = dir + "/";
      const mdFiles2 = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
      const entries = [];
      for (const f of mdFiles2) {
        const e = await this.parseNoteFile(f);
        if (e) entries.push(e);
      }
      entries.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
      this.allNotes = entries;
    }
    async parseNoteFile(file) {
      const app = getApp();
      try {
        const cache = app.metadataCache.getFileCache(file);
        const fm = cache && cache.frontmatter;
        const title = fm && fm.title ? String(fm.title) : file.basename;
        const date = fm && fm.date ? String(fm.date) : "";
        let created = parseDateRaw(date);
        if (isNaN(created)) {
          try {
            const st = file.stat;
            created = st && st.ctime ? new Date(st.ctime).valueOf() : 0;
          } catch (e) {
            created = 0;
          }
        }
        return {
          file,
          path: file.path,
          title,
          type: fm && fm.type ? String(fm.type) : "",
          domain: fm && fm.domain ? String(fm.domain) : "",
          summary: fm && fm.summary ? String(fm.summary) : "",
          url: fm && fm.url ? String(fm.url) : "",
          source: fm && fm.source ? String(fm.source) : "",
          sourceTitle: fm && fm.sourceTitle ? String(fm.sourceTitle) : "",
          date,
          created
        };
      } catch (e) {
        console.warn("解析文献笔记失败:", file.path, e);
        return null;
      }
    }
    renderLiterature() {
      if (!this.contentEl) return;
      const rows = this.allNotes.map((n, i) => {
        const no = String(i + 1).padStart(2, "0");
        const kind = litKindLabel(n.type);
        return `<div class="bz-kb-lexrow" data-kb-act="lit-peek" data-path="${esc(n.path)}">
        <div class="bz-kb-hw"><span class="bz-kb-w">${esc(n.title)}</span><span class="bz-kb-pos ${n.type === "video" ? "hot" : ""}">${kind}</span><span class="bz-kb-dom">${esc(n.domain || "未分类")}</span></div>
        <div class="bz-kb-tail"><span class="bz-kb-meta">LIT-${no} · ${esc(n.date || "")}</span></div>
      </div>`;
      }).join("");
      this.contentEl.innerHTML = `
      <div class="bz-kb-pd">
        <div class="bz-kb-entryrow">
          <button class="bz-kb-entrybtn" data-kb-act="term-entry"><b>名词</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="passage-entry"><b>段落</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="image-entry"><b>图版</b></button>
          <button class="bz-kb-entrybtn" data-kb-act="video-entry"><b>影像</b></button>
        </div>
        ${rows || '<div class="bz-kb-empty">「文献目录」还没有文献笔记——从上面的四种录入开始。</div>'}
      </div>`;
    }
    /** 三部共用预览弹层（文献/卡片/主题同一样式）：正文真 Markdown 渲染（视频 ![[mp4]] 内嵌可播）+ 关联 + 可点来源（只读；关闭走 ✕/ESC） */
    async openPreview(n, kind = "lit") {
      const app = getApp();
      let raw = "";
      try {
        raw = await app.vault.read(n.file);
      } catch (e) {
        raw = "";
      }
      const body = stripFrontmatter3(raw);
      const parasHtml = body.split(/\r?\n\r?\n+/).map((b) => b.trim()).filter(Boolean).map((b) => `<p>${esc(b)}</p>`).join("") || "<p>（无正文）</p>";
      const rels = await this.noteRels(n);
      const srcHtml = n.url ? `<div class="bz-kb-sec">原 文</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.url)}" href="#">${esc(n.url)}</a></div>` : n.source && !n.source.startsWith("[[") ? `<div class="bz-kb-sec">来 源</div><div class="bz-kb-cliplink"><a class="bz-lit-srcopen" data-lit-src-url="${esc(n.source)}" href="#">${esc(n.sourceTitle || n.source)}</a></div>` : "";
      const head = kind === "card" ? { title: "卡片预览 · 卡片盒", badge: "卡 片", hot: false } : kind === "topic" ? { title: "主题预览 · 主题笔记", badge: "主 题", hot: false } : { title: `文献预览 · ${litKindPlain(n.type || "")}`, badge: litKindLabel(n.type || ""), hot: n.type === "video" };
      const ovl = this.openSheet(this.sheetWrap(head.title, `
      <div class="bz-kb-hw"><span class="bz-kb-w" style="font-size:17px">${esc(n.title)}</span>
        <span class="bz-kb-pos ${head.hot ? "hot" : ""}">${head.badge}</span>
        <span class="bz-kb-dom">${esc(n.domain || "未分类")}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${esc(n.date || "")}</span><button class="bz-kb-mt-openbtn" data-kb-act="mount-tree" data-path="${esc(n.path)}" title="以这篇为主卡打开挂载树">看挂载树</button></div>
      <div class="bz-kb-paras" id="bz-kb-preview-body"></div>
      ${rels.length ? `<div class="bz-kb-sec">关 联</div><div class="bz-kb-rels">${rels.map((r) => `<span class="bz-kb-cite">${esc(r)}</span>`).join("")}</div>` : ""}
      ${srcHtml}`));
      this._previewNote = n;
      const bodyEl = ovl ? q(ovl, "#bz-kb-preview-body") : null;
      if (bodyEl) {
        bodyEl.textContent = "";
        if (body) {
          try {
            const comp = new Component();
            await MarkdownRenderer.render(this.app, body, bodyEl, n.path, comp);
            comp.unload();
          } catch (e) {
          }
          if (!bodyEl.querySelector("*")) {
            bodyEl.innerHTML = parasHtml;
          }
        } else {
          bodyEl.innerHTML = parasHtml;
        }
      }
      const srcLinks = ovl ? ovl.querySelectorAll("[data-lit-src-url]") : [];
      srcLinks.forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._openExternal(a.getAttribute("data-lit-src-url") || "");
        });
      });
    }
    /**
     * 按 path 直达文献预览（issue 329 跨域 API，ADR-0144 划词锚定双链点击）：主面板不出场——
     * openPreview 同一渲染入口与样式（ADR-0122 渲染契约），主窗不在场时落独立弹层宿主。
     * 命中并打开返回 true；路径不在文献目录 / 文件缺失 / 解析失败返回 false，由调用方
     * notice 后回退 app.workspace.openLinkText（Obsidian 原生环境维持原生跳转）。
     */
    async openPreviewByPath(path) {
      const p = String(path || "").trim().replace(/\\/g, "/");
      if (!p || !p.toLowerCase().endsWith(".md")) return false;
      const dir = litDirOf(tryGetSettings());
      if (!p.startsWith(dir + "/")) return false;
      const file = getApp().vault.getAbstractFileByPath(p);
      if (!file || file.isFolder) return false;
      const entry = await this.parseNoteFile(file);
      if (!entry) return false;
      await this.openPreview(entry);
      return true;
    }
    /** 提炼成卡编辑弹层（原型唯一真理：词头可改 / 源文献+领域自动带，落 related 双链互链 / 连一张旧卡 / 为什么相关） */
    async openCardEditor(n) {
      await this.ensureCards();
      const dom = n.domain || "未分类";
      const sameDom = this.allCards.filter((c) => c.domain === dom).map((c) => c.title);
      const others = this.allCards.map((c) => c.title).filter((t) => !sameDom.includes(t));
      const olds = [...sameDom.slice(0, 5)];
      for (const t of others) {
        if (olds.length >= 6) break;
        olds.push(t);
      }
      if (olds.length === 0) olds.push(n.title);
      const whySug = `《${n.title}》与这张旧卡讨论同一主题——读后补全了机制细节，整理为显式连接。`;
      const oldsHtml = olds.map((o, i) => `<button class="bz-kb-old" data-kb-old="${esc(o)}">${esc(o)}${i === 0 ? '<span class="bz-kb-rec">推荐</span>' : ""}</button>`).join("");
      this.openSheet(this.sheetWrap("提炼成卡 → 卡片盒", `
      <div class="bz-kb-f"><div class="bz-kb-flb">词 头（可 改）</div>
        <input type="text" data-kb-role="cardtitle" value="${esc(n.title)}"></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">来 源 与 领 域（自 动 带，落 related 双链）</div>
        <div class="bz-kb-srcline"><span class="bz-kb-srchip"><b>源</b>${esc(n.path)}</span>
        <span class="bz-kb-srchip"><b>领域</b>〔${esc(dom)}〕自动继承</span></div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">连 一 张 旧 卡（铁律：不 解 释 的 链 接 不 产 生 知 识）</div>
        <div class="bz-kb-olds">${oldsHtml}</div></div>
      <div class="bz-kb-f"><div class="bz-kb-flb">为 什 么 相 关（一 句 话，可 改）</div>
        <input type="text" data-kb-role="why" value="${esc(whySug)}"></div>
      <div style="margin-top:18px;display:flex;gap:10px">
        <button class="bz-kb-bigbtn" data-kb-act="card-save" disabled>落 卡</button>
        <button class="bz-kb-ghost" data-kb-close>取消</button>
      </div>
      <div class="bz-kb-note" style="font-size:11px;margin-top:14px">落卡后它躺在卡片盒，随时被任何笔记引用——不强迫挂进哪篇，也不强迫复习。</div>`));
      this.editor = { source: n, pick: null, why: whySug, title: n.title };
    }
    syncSaveBtn() {
      var _a;
      const btn = (_a = this.popup) == null ? void 0 : _a.querySelector("[data-kb-act=card-save]");
      if (btn && this.editor) btn.disabled = !(this.editor.pick && this.editor.why.trim());
    }
    /** 落卡：写卡片盒笔记（category=领域、related=源文献）+ 源文献 related 追加新卡（互链） */
    async saveCard() {
      var _a;
      if (!this.editor || !this.editor.pick || !this.editor.why.trim()) return;
      const app = getApp();
      const s = tryGetSettings();
      const dir = cardboxDirOf(s);
      const src = this.editor.source;
      const why = this.editor.why.trim();
      let base = this.editor.title.trim() || src.title;
      const stamp = dateStamp();
      try {
        let idx = 2;
        while (app.vault.getAbstractFileByPath(`${dir}/${base}.md`)) {
          base = `${this.editor.title.trim() || src.title} ${idx}`;
          idx++;
        }
        const path = `${dir}/${base}.md`;
        try {
          if (!app.vault.getFolderByPath(dir)) await app.vault.createFolder(dir);
        } catch (e) {
        }
        const md = ["---", "tags: []", `category: ${src.domain || "未分类"}`, "related:", `  - "[[${src.path}|${src.title}]]"`, `date: "${stamp}"`, "---", "", why, ""].join("\n");
        await app.vault.create(path, md);
        const srcFile = app.vault.getAbstractFileByPath(src.path);
        if (srcFile) {
          const text = await app.vault.read(srcFile);
          const linkText = `[[${stripMdExt(path)}|${base}]]`;
          const updated = appendRelatedLine(text, linkText);
          if (updated !== text) await app.vault.modify(srcFile, updated);
        }
        this.allCards.unshift({ file: null, path, title: base, domain: src.domain || "未分类", review: false, created: Date.now() });
        this.sessionNewPaths.add(path);
        this.editor = null;
        this.closeSheet();
        notice("已落卡 卡片盒/" + base + ".md · 它随时被任何笔记引用", "success");
        if (this.part === "z2") {
          this.markCardsDirty();
          await this.loadMountIndex();
          this.renderCards();
        }
      } catch (e) {
        notice("落卡失败：" + ((_a = e == null ? void 0 : e.message) != null ? _a : String(e)), "error");
      }
    }
    /** 部贰卡片扫描（存量零迁移：领域读序 domain → category → 未分类） */
    async loadCards(dir) {
      var _a;
      const app = getApp();
      this.loadedCardDir = dir;
      const prefix = dir + "/";
      const mdFiles2 = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
      const out = [];
      for (const f of mdFiles2) {
        try {
          const cache = app.metadataCache.getFileCache(f);
          const fm = cache && cache.frontmatter || {};
          let created = 0;
          try {
            created = ((_a = f.stat) == null ? void 0 : _a.ctime) ? new Date(f.stat.ctime).valueOf() : 0;
          } catch (e) {
            created = 0;
          }
          out.push({
            file: f,
            path: f.path,
            title: fm && fm.title ? String(fm.title) : f.basename,
            domain: fm && fm.domain ? String(fm.domain) : fm && fm.category ? String(fm.category) : "未分类",
            review: fm && fm.reviewStart != null,
            created
          });
        } catch (e) {
        }
      }
      out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
      this.allCards = out;
    }
    /**
     * 挂载引用索引（issue 320；ADR-0138 §5 同包四项）：整库扫描一次并**缓存到面板对象上**——
     * 行引用计数徽标（refCounts）、孤儿筛选与行标记（orphanCards）共用这一份；
     * counts 算好后**传给 orphanCards 复用**（其内部不再自行复算一遍）。
     *
     * **323 起按面板会话缓存 + 脏标记**：切到「卡片」部不再整库重扫（1500+ 文件逐个解析出站链
     * 是切换卡顿的最大头），只有**落卡 / 库内文件变更 / 目录变更 / 显式刷新**才置脏重算。
     * 扫描异常按空索引降级：芯片显「未统计」并置灰，列表照常渲染（异常时留脏，下次再试）。
     */
    async loadMountIndex() {
      try {
        const ctx = mountCtx();
        const counts = await refCounts(ctx);
        this.mountIndex = { counts, orphans: new Set(await orphanCards(ctx, counts)) };
      } catch (e) {
        this.mountIndex = null;
      }
      if (this.mountIndex) this.mountIndexDirty = false;
    }
    /** 卡片列表与挂载索引一起置脏（落卡 / 库内文件变更 / 目录变更 → 下次进部贰重算） */
    markCardsDirty() {
      this.mountIndexDirty = true;
      this.cardsShown = 0;
      this.cardRowsEl = null;
    }
    /** 当前筛选后的卡片池（只有孤儿筛选依赖挂载索引；不筛选时池 = 全部卡片） */
    cardPool() {
      const idx = this.mountIndex;
      return this.cardOrphanOnly && idx ? this.allCards.filter((c) => idx.orphans.has(c.path)) : this.allCards;
    }
    /** 表头芯片（原地同步：索引落地后只改这一个节点，不重建整表） */
    cardBarHtml() {
      const idx = this.mountIndex;
      return `<div class="bz-kb-cbar"><button class="bz-kb-cfilter${this.cardOrphanOnly ? " is-on" : ""}" data-kb-act="cards-orphan"${idx ? "" : " disabled"} title="${idx ? "只列既无入链也无挂载的卡" : "挂载索引未统计（扫描失败）"}">孤 儿${idx ? ` · ${idx.orphans.size}` : " · 未统计"}</button><span class="bz-kb-meta">全部 ${this.allCards.length} 张</span></div>`;
    }
    /** 单行 HTML（全量重建与增量追加共用同一份模板） */
    cardRowHtml(c) {
      var _a, _b;
      const idx = this.mountIndex;
      const n = (_a = idx == null ? void 0 : idx.counts[c.path]) != null ? _a : 0;
      const orphan = (_b = idx == null ? void 0 : idx.orphans.has(c.path)) != null ? _b : false;
      return `<div class="bz-kb-lexrow" data-kb-act="card-peek" data-path="${esc(c.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(c.title)}</span>${this.sessionNewPaths.has(c.path) ? '<span class="bz-kb-pos ok">新 落</span>' : ""}${orphan ? '<span class="bz-kb-orphan" title="既无入链也无挂载">孤 儿</span>' : ""}<span class="bz-kb-dom">${esc(
        c.domain
      )}</span></div>
      <div class="bz-kb-tail"><span>${c.review ? "复习中 · 到期由闹钟安排" : "未入复习"}</span>${n > 0 ? `<span class="bz-kb-refbadge" title="被 ${n} 处用户双链引用">被引 ${n}</span>` : ""}<button class="bz-kb-mt-openbtn" data-kb-act="mount-tree" data-path="${esc(c.path)}" title="以这张卡为主卡打开挂载树">看挂载树</button></div>
    </div>`;
    }
    /**
     * 全量重建（换部 / 换筛选 / 落卡）：只搭表头 + 空行容器 + 页脚，行由 `appendCardRows` 追加。
     * 此后翻页与徽标落地都**不再**走 innerHTML 全表重建（issue 323：滚动到底反复触发时 O(n²) 抖动）。
     */
    renderCards() {
      if (!this.contentEl) return;
      this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${this.cardBarHtml()}
      <div class="bz-kb-rows" id="kb-card-rows"></div>
      <div class="bz-kb-empty" id="kb-card-more" data-kb-act="cards-more" style="display:none"></div>
    </div>`;
      this.cardRowsEl = q(this.contentEl, "#kb-card-rows");
      this.cardsShown = 0;
      this.appendCardRows(80);
    }
    /** 追加 n 行（增量：已渲染的行不动，滚动位置与 DOM 节点都保住） */
    appendCardRows(n) {
      const rowsEl = this.cardRowsEl;
      if (!rowsEl) return;
      const pool = this.cardPool();
      if (pool.length === 0) {
        rowsEl.innerHTML = `<div class="bz-kb-empty">${this.cardOrphanOnly ? "没有孤儿卡——每张卡都有人挂或挂着谁。" : "卡片目录还没有卡片——在部壹文献预览里「提炼成卡」。"}</div>`;
        this.cardsShown = 0;
        this.updateCardMore(pool);
        return;
      }
      const from = Math.max(0, this.cardsShown);
      const to = Math.min(pool.length, from + n);
      if (to > from) {
        const tmp = document.createElement("div");
        tmp.innerHTML = pool.slice(from, to).map((c) => this.cardRowHtml(c)).join("");
        const frag = document.createDocumentFragment();
        while (tmp.firstChild) frag.appendChild(tmp.firstChild);
        rowsEl.appendChild(frag);
        this.cardsShown = to;
      }
      this.updateCardMore(pool);
    }
    /** 页脚「还有 N 张」原地更新（不重渲整表） */
    updateCardMore(pool) {
      const moreEl = this.contentEl ? q(this.contentEl, "#kb-card-more") : null;
      if (!moreEl) return;
      const rest = pool.length - this.cardsShown;
      moreEl.style.display = rest > 0 ? "" : "none";
      moreEl.textContent = rest > 0 ? `↓ 还有 ${rest} 张，滚动或点此加载` : "";
    }
    /** 索引落地后**原地**补徽标与孤儿标记（按行 querySelector 定位，不重建已渲染行） */
    patchCardBadges() {
      var _a;
      const rowsEl = this.cardRowsEl;
      const idx = this.mountIndex;
      if (!rowsEl || !idx) return;
      for (const row of Array.from(rowsEl.querySelectorAll(".bz-kb-lexrow"))) {
        const path = row.getAttribute("data-path") || "";
        if (idx.orphans.has(path)) {
          const hw = row.querySelector(".bz-kb-hw");
          if (hw && !hw.querySelector(".bz-kb-orphan")) {
            const span = document.createElement("span");
            span.className = "bz-kb-orphan";
            span.title = "既无入链也无挂载";
            span.textContent = "孤 儿";
            const dom = hw.querySelector(".bz-kb-dom");
            if (dom) hw.insertBefore(span, dom);
            else hw.appendChild(span);
          }
        }
        const n = (_a = idx.counts[path]) != null ? _a : 0;
        if (n > 0) {
          const tail = row.querySelector(".bz-kb-tail");
          if (tail && !tail.querySelector(".bz-kb-refbadge")) {
            const b = document.createElement("span");
            b.className = "bz-kb-refbadge";
            b.title = `被 ${n} 处用户双链引用`;
            b.textContent = `被引 ${n}`;
            const btn = tail.querySelector(".bz-kb-mt-openbtn");
            if (btn) tail.insertBefore(b, btn);
            else tail.appendChild(b);
          }
        }
      }
    }
    /** 芯片原地同步（索引落地时改这一个节点：计数 / 置灰 / 点亮，不重建整表） */
    syncCardChip() {
      const chip2 = this.contentEl ? this.contentEl.querySelector('[data-kb-act="cards-orphan"]') : null;
      if (!chip2) return;
      const idx = this.mountIndex;
      chip2.classList.toggle("is-on", this.cardOrphanOnly);
      chip2.textContent = `孤 儿${idx ? ` · ${idx.orphans.size}` : " · 未统计"}`;
      chip2.setAttribute("title", idx ? "只列既无入链也无挂载的卡" : "挂载索引未统计（扫描失败）");
      chip2.disabled = !idx;
    }
    /**
     * 索引落地：孤儿筛选开着时**池会变** → 全量重建；否则只打徽标补丁 + 更新页脚
     * （保住已渲染行与滚动位置——issue 323 的第二处根因）。
     */
    applyMountIndex() {
      this.syncCardChip();
      if (!this.mountIndex) return;
      if (this.cardOrphanOnly) this.renderCards();
      else {
        this.patchCardBadges();
        this.updateCardMore(this.cardPool());
      }
    }
    moreCards() {
      if (this.cardsShown >= this.cardPool().length) return;
      this.appendCardRows(80);
    }
    onContentScroll() {
      const sc = this.contentEl;
      if (!sc || this.part !== "z2") return;
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 60) this.moreCards();
    }
    /** 部叁主题扫描（仅展示） */
    async loadTopics(dir) {
      const app = getApp();
      this.loadedTopicDir = dir;
      const prefix = dir + "/";
      const mdFiles2 = (app.vault.getFiles() || []).filter((f) => f.path.startsWith(prefix) && f.extension === "md");
      const out = mdFiles2.map((f) => {
        var _a;
        let created = 0;
        try {
          created = ((_a = f.stat) == null ? void 0 : _a.mtime) ? new Date(f.stat.mtime).valueOf() : 0;
        } catch (e) {
          created = 0;
        }
        return { file: f, path: f.path, title: f.basename, where: dir, created };
      });
      out.sort((a, b) => b.created - a.created || a.path.localeCompare(b.path));
      this.allTopics = out;
    }
    renderTopics() {
      if (!this.contentEl) return;
      const rows = this.allTopics.map((t) => {
        const rel = formatRelativeTime(String(t.created || ""));
        return `<div class="bz-kb-lexrow" data-kb-act="topic-open" data-path="${esc(t.path)}">
      <div class="bz-kb-hw"><span class="bz-kb-w">${esc(t.title)}</span><span class="bz-kb-dom">${esc(t.where)}</span></div>
      <div class="bz-kb-tail"><span class="bz-kb-meta">${rel === "无效日期" ? "" : esc(rel)}</span></div>
    </div>`;
      }).join("");
      this.contentEl.innerHTML = `<div class="bz-kb-pd">
      ${rows || '<div class="bz-kb-empty">主题目录还没有笔记。</div>'}
    </div>`;
    }
    async ensureCards() {
      const dir = cardboxDirOf(tryGetSettings());
      if (!this.loadedCardDir || this.loadedCardDir !== dir || this.allCards.length === 0) await this.loadCards(dir);
    }
    /** 读笔记 frontmatter related 展示名列表（预览「关联」区；解析见 parseRelatedNames） */
    async noteRels(n) {
      try {
        return parseRelatedNames(await getApp().vault.read(n.file));
      } catch (e) {
        return [];
      }
    }
    /** 弹层宿主：主窗显示中挂主窗（既有路径零变化）；否则落独立宿主（直达预览不强行展开主面板） */
    sheetHost() {
      if (this.popup && this.popup.style.display === "flex") return this.popup;
      if (!this.previewHostEl || !this.previewHostEl.isConnected) {
        const host = document.createElement("div");
        host.className = "bz-kb-sheet-host kb";
        document.body.appendChild(host);
        topifyZ(host);
        this.previewHostEl = host;
      }
      return this.previewHostEl;
    }
    /** 弹层（面板内覆盖；返回 ovl 供调用方就地查询——独立宿主场景 this.popup 查不到） */
    openSheet(html) {
      this.closeSheet();
      const host = this.sheetHost();
      const ovl = document.createElement("div");
      ovl.className = "bz-kb-ovl";
      ovl.innerHTML = `<div class="bz-kb-sheet">${html}</div>`;
      ovl.addEventListener("click", (e) => {
        var _a, _b;
        const t = e.target.closest("[data-kb-act],[data-kb-close]");
        if (e.target === ovl || t && t.hasAttribute("data-kb-close")) {
          this.closeSheet();
          return;
        }
        if (!t) return;
        const act = t.getAttribute("data-kb-act");
        if (act === "card-new") {
          const w = ((_b = (_a = t.closest(".bz-kb-sheet")) == null ? void 0 : _a.querySelector(".bz-kb-hw .bz-kb-w")) == null ? void 0 : _b.textContent) || "";
          const n = this.allNotes.find((x) => x.title === w);
          if (n) void this.openCardEditor(n);
        } else if (act === "card-save") {
          void this.saveCard();
        } else if (act === "mount-tree" && host !== this.popup) {
          const p = t.getAttribute("data-path") || "";
          if (p) void openMountTree(p);
        }
      });
      host.appendChild(ovl);
      const titleInput = ovl.querySelector("[data-kb-role=cardtitle]");
      if (titleInput) titleInput.addEventListener("input", () => {
        if (this.editor) this.editor.title = titleInput.value;
        this.syncSaveBtn();
      });
      const whyInput = ovl.querySelector("[data-kb-role=why]");
      if (whyInput) whyInput.addEventListener("input", () => {
        if (this.editor) this.editor.why = whyInput.value;
        this.syncSaveBtn();
      });
      ovl.querySelectorAll("[data-kb-old]").forEach((b) => {
        b.addEventListener("click", () => {
          if (!this.editor) return;
          this.editor.pick = b.getAttribute("data-kb-old");
          ovl.querySelectorAll("[data-kb-old]").forEach((x) => x.classList.toggle("is-on", x === b));
          this.syncSaveBtn();
        });
      });
      this.syncSaveBtn();
      return ovl;
    }
    closeSheet() {
      for (const host of [this.popup, this.previewHostEl]) {
        host == null ? void 0 : host.querySelectorAll(".bz-kb-ovl").forEach((x) => x.remove());
      }
      this.editor = null;
      if (this.previewHostEl && !this.previewHostEl.querySelector(".bz-kb-ovl")) {
        this.previewHostEl.remove();
        this.previewHostEl = null;
      }
    }
    sheetWrap(title, body) {
      return `<div class="bz-kb-sheet-head"><span class="bz-kb-sheet-title">${esc(title)}</span></div><div class="bz-kb-sheet-body">${body}</div>`;
    }
    /** 旧笔记自动补全（note-gen；AI 未配置跳过并提示一句）；每目录至多跑一次 */
    async runBackfill() {
      const dir = litDirOf(tryGetSettings());
      if (this.backfilledDir === dir) return;
      this.backfilledDir = dir;
      try {
        const res = await backfillNotes();
        if (res && res.aiSkipped) {
          notice("AI 未配置：部分旧笔记缺少领域分类，已跳过补全（配置 AI 后重新打开面板可补全）", "info");
        }
        if (res && res.filled > 0 && this.part === "z1") await this.refreshCurrent();
      } catch (e) {
      }
    }
    // ---- 主面板增量刷新（knowledge:file-* 四通道 300ms 防抖） ----
    scheduleRefreshFlush() {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(async () => {
        const deletes = Array.from(this.pendingDeletePaths);
        const modifies = Array.from(this.pendingRefreshPaths);
        this.pendingDeletePaths.clear();
        this.pendingRefreshPaths.clear();
        for (const p of deletes) this.removeCached(p);
        for (const p of modifies) this.invalidateCached(p);
        if (this.popup && this.popup.style.display === "flex") await this.refreshCurrent();
      }, 300);
    }
    removeCached(path) {
      this.allNotes = this.allNotes.filter((n) => n.path !== path);
      this.allCards = this.allCards.filter((c) => c.path !== path);
      this.allTopics = this.allTopics.filter((t) => t.path !== path);
    }
    invalidateCached(_path) {
      this.loadedLitDir = "";
      this.loadedCardDir = "";
      this.loadedTopicDir = "";
      this.mountIndexDirty = true;
    }
    attachFileListener() {
      if (this.fileListenerAttached) return;
      const inAnyDir = (path) => {
        const s = tryGetSettings();
        return path.startsWith(litDirOf(s) + "/") || path.startsWith(cardboxDirOf(s) + "/") || path.startsWith(topicDirOf(s) + "/");
      };
      const modifyHandler = (p) => {
        if (inAnyDir(p)) {
          this.pendingRefreshPaths.add(p);
          this.scheduleRefreshFlush();
        }
      };
      const deleteHandler = (evt) => {
        if (inAnyDir(evt.path)) {
          this.pendingDeletePaths.add(evt.path);
          this.scheduleRefreshFlush();
        }
      };
      const renameHandler = (evt) => {
        if (inAnyDir(evt.oldPath)) this.pendingDeletePaths.add(evt.oldPath);
        if (!evt.movedOut && inAnyDir(evt.newPath)) this.pendingRefreshPaths.add(evt.newPath);
        this.scheduleRefreshFlush();
      };
      this.fileListenerRefs = [
        onDomainEvent("knowledge:file-created", (evt) => modifyHandler(evt.path)),
        onDomainEvent("knowledge:file-modified", (evt) => modifyHandler(evt.path)),
        onDomainEvent("knowledge:file-deleted", deleteHandler),
        onDomainEvent("knowledge:file-renamed", renameHandler)
      ];
      this.fileListenerAttached = true;
    }
    // ==================== 影像 · 处理队列面板（issue 310） ====================
    createVideoUI() {
      const mask = document.createElement("div");
      mask.id = "knowledge-video-mask";
      mask.className = "bz-kb-mask";
      mask.style.display = "none";
      mask.onclick = () => this.hideVideo();
      const popup = document.createElement("div");
      popup.id = "knowledge-video-popup";
      popup.className = "bz-kb-window kb";
      popup.style.display = "none";
      const header = document.createElement("div");
      header.className = "bz-kb-head";
      header.innerHTML = `
      <div class="bz-kb-vmeta" id="lit-video-counts"></div>
      <div class="bz-kb-brand">
        <div class="bz-kb-top">VIDEO · TO LITERATURE</div>
        <div class="bz-kb-title">影 像</div>
      </div>
      <div class="bz-lit-head-btns">
        <button id="lit-btn-video-add" title="新增影像">${iconSpan("plus")}</button>
        <button id="lit-btn-video-run" class="bz-lit-run-btn" title="批量处理（桌面端）">${iconSpan("play")}</button>
        <button id="lit-btn-video-history" title="历史">${iconSpan("history")}</button>
        <button id="lit-btn-video-back" title="返回处理队列" style="display:none;">${iconSpan("arrow-left")}</button>
      </div>`;
      const list = document.createElement("div");
      list.id = "knowledge-video-list";
      list.className = "bz-kb-list";
      popup.appendChild(header);
      popup.appendChild(list);
      document.body.appendChild(mask);
      document.body.appendChild(popup);
      this.videoMask = mask;
      this.videoPopup = popup;
      this.videoList = list;
      mountIcons(popup);
      this.runIcon = q(popup, "#lit-btn-video-run .bz-ic");
      this._bindVideoHeaderEvents();
      this._syncVideoHead();
    }
    _bindVideoHeaderEvents() {
      const p = this.videoPopup;
      if (!p) return;
      q(p, "#lit-btn-video-add").onclick = () => this.showAddDialog();
      q(p, "#lit-btn-video-run").onclick = () => {
        if (BatchRunner.running) void this.onAbortBatch();
        else void this.onRunBatch();
      };
      q(p, "#lit-btn-video-history").onclick = () => this.showHistory();
      q(p, "#lit-btn-video-back").onclick = () => this.switchVideoView("tasks");
    }
    /**
     * 处理面板头部同步（issue 310 复核）：按当前视图换题字与图标组——
     * 处理视图 = 新增 / 批量 / 历史；历史视图 = 只留返回箭头（退回处理队列）。
     * 移动端无批处理能力：批量与历史钮恒藏（故历史视图在移动端不可达）。
     */
    _syncVideoHead() {
      const p = this.videoPopup;
      if (!p) return;
      const inHistory = this.videoView === "history";
      const mobile = isMobileEnv();
      const title = q(p, ".bz-kb-title");
      const top = q(p, ".bz-kb-top");
      if (title) title.textContent = inHistory ? "历 史" : "影 像";
      if (top) top.textContent = inHistory ? "VIDEO · ARCHIVE" : "VIDEO · TO LITERATURE";
      const show = (sel, v) => {
        const el = q(p, sel);
        if (el) el.style.display = v ? "" : "none";
      };
      show("#lit-btn-video-add", !inHistory);
      show("#lit-btn-video-run", !inHistory && !mobile);
      show("#lit-btn-video-history", !inHistory && !mobile);
      show("#lit-btn-video-back", inHistory);
    }
    /**
     * 打开「影像」录入界面（issue 310：主窗入口 / 命令 / 聚合讯直达录入界面，
     * 不再先落到处理队列；处理队列与历史从**保存后**进入——保存即落队列并打开处理面板）。
     * prefill 存在则预填链接（聚合讯「保存至文献」入口，ADR-0068；有链接即自动解析）。
     */
    showVideoEntry(prefill) {
      var _a, _b;
      this.showAddDialog(prefill ? { url: prefill.url, title: (_a = prefill.title) != null ? _a : null, uploader: (_b = prefill.uploader) != null ? _b : null } : void 0);
    }
    /** 打开「影像 · 处理」队列面板（面板默认视图）；打开即自动重抓缺信息任务（ADR-0133） */
    showVideoTasks() {
      if (!this.videoPopup || !this.videoMask) return;
      this.videoView = "tasks";
      this._showVideoWindow();
      void this.backfillVideoTasks();
    }
    /**
     * 切到「历史」视图（2026-09-14 复核）：历史在**同一个面板内**打开，不再另开弹窗——
     * 题字换「历 史」、图标组只留返回箭头、计数换「共 N 条」。
     */
    showHistory() {
      if (!this.videoPopup || !this.videoMask) return;
      this.videoView = "history";
      this._showVideoWindow();
    }
    /** 面板内视图切换（处理 ⇄ 历史） */
    switchVideoView(view) {
      this.videoView = view;
      void this.refreshVideoPanel();
    }
    /** 面板显示 + 按当前视图重绘（两个入口共用的收尾） */
    _showVideoWindow() {
      if (!this.videoMask || !this.videoPopup) return;
      topifyZ(this.videoMask, this.videoPopup);
      this.videoMask.style.display = "block";
      this.videoPopup.style.display = "flex";
      void this.refreshVideoPanel();
    }
    /**
     * 打开面板时的自动重抓（ADR-0133）：对缺标题任务串行补信息（标题/UP/时长，只补缺失），
     * 成功即落库；任务间 300ms 间隔防风控；已尝试过的 id 会话内不再重试，失败静默。
     * ADR-0134：链接里没有 BV 号的 **B 站**任务（b23.tv 短链）一并重抓——顺手把 url 修成规范链接，
     * 否则下载阶段认不出 BV 号（存量任务也据此自愈）。非 B 站链接（YouTube 等）不纳入；
     * 已成功的任务只补信息、不改 url（成败判别口径随 `isTerminal` 的「成功」侧）。
     */
    async backfillVideoTasks() {
      var _a;
      if (this.backfillRunning) return;
      this.backfillRunning = true;
      try {
        const tasks = await KnowledgeData.loadTasks();
        const todo = tasks.filter((t) => !t.archived && t.url && !this.backfillTried.has(t.id) && (!t.title || t.status !== "success" && needsBvidRepair(t.url)));
        if (todo.length) {
          const cookie = String(((_a = tryGetSettings()) == null ? void 0 : _a.bilibiliCookie) || "");
          for (const t of todo) {
            this.backfillTried.add(t.id);
            try {
              const res = await resolveVideo(t.url, cookie, Math.max(0, (t.page || 1) - 1));
              if (res) await this._persistResolved(t, res);
            } catch (e) {
            }
            await new Promise((r) => setTimeout(r, 300));
          }
          await this.refreshVideoPanel();
        }
      } catch (e) {
      } finally {
        this.backfillRunning = false;
      }
    }
    hideVideo() {
      if (this.videoMask) this.videoMask.style.display = "none";
      if (this.videoPopup) this.videoPopup.style.display = "none";
    }
    async refreshVideoPanel() {
      const tasks = await KnowledgeData.loadTasks();
      if (!this.videoList) return;
      this._syncVideoHead();
      this.videoList.innerHTML = "";
      if (this.videoView === "history") {
        this.renderHistory(tasks);
        return;
      }
      const active = tasks.filter((t) => !t.archived);
      const running = BatchRunner.running;
      if (running) {
        const idx = active.findIndex((t) => t.status === "processing");
        const banner = document.createElement("div");
        banner.className = "bz-kb-banner";
        banner.innerHTML = `${iconSpan("loader")} ${idx >= 0 ? `正在处理 第 ${idx + 1}/${active.length} 部…` : "正在准备处理…"}`;
        mountIcons(banner);
        this.videoList.appendChild(banner);
      }
      this._syncStatusCounts(active);
      if (active.length === 0) {
        const empty = document.createElement("div");
        empty.className = "bz-kb-empty";
        empty.textContent = "暂无转文献任务。点右上角加号添加视频链接与起止时间，回到桌面端即可批量处理。";
        this.videoList.appendChild(empty);
        this._syncRunButton(active);
        return;
      }
      for (const t of active) this.videoList.appendChild(this.renderRow(t));
      this._syncRunButton(active);
    }
    _syncStatusCounts(tasks) {
      const el = this.videoPopup ? q(this.videoPopup, "#lit-video-counts") : null;
      if (!el) return;
      const count = (s) => tasks.filter((t) => t.status === s).length;
      const parts = [];
      if (count("pending")) parts.push(`${count("pending")} 待处理`);
      if (count("processing")) parts.push(`${count("processing")} 处理中`);
      if (count("failed")) parts.push(`${count("failed")} 失败`);
      el.textContent = parts.join(" · ");
    }
    /** 单钮态机：空闲 play / 运行中 square（终止靠 title hover 区分），移动端整钮隐藏 */
    _syncRunButton(tasks) {
      if (!this.videoPopup) return;
      const run = q(this.videoPopup, "#lit-btn-video-run");
      if (!run) return;
      const running = BatchRunner.running;
      const hasWork = tasks.some((t) => t.status === "pending" || t.status === "failed");
      if (running) {
        run.disabled = false;
        const retry = this.batchAbortLabel === "终止整批";
        if (this.runIcon) setIcon(this.runIcon, "square");
        run.title = retry ? "中止整批（处理失败任务中）" : "中止批量处理";
      } else {
        run.disabled = !hasWork;
        if (this.runIcon) setIcon(this.runIcon, "play");
        run.title = "批量处理（桌面端）";
      }
    }
    renderRow(task) {
      var _a;
      const card = document.createElement("div");
      card.className = "bz-kb-taskcard";
      card.dataset.id = task.id;
      const meta = (_a = STATUS_META[task.status]) != null ? _a : STATUS_META.pending;
      const pageTag = task.page && task.page > 1 ? `P${task.page} · ` : "";
      const timeText = task.start && task.end ? `${pageTag}${task.start} ~ ${task.end}` : `${pageTag}整片`;
      const durText = task.duration ? ` · ${secToTimeText(task.duration)}` : "";
      const linkLine = task.title ? `<a class="bz-kb-tlink" href="${esc(task.url)}" title="${esc(task.url)}">${esc(task.title)}</a>` : `<span class="bz-kb-turl" title="${esc(task.url)}">${esc(shortUrlText(task.url))}</span>`;
      const upText = task.uploader ? ` · UP主 ${esc(task.uploader)}` : "";
      card.innerHTML = `
      <div class="bz-kb-trow">
        <span class="bz-kb-status ${meta.cls}">${meta.label}</span>
        ${linkLine}
      </div>
      <div class="bz-kb-tmeta">${timeText}${durText}${upText}${task.remark ? " · " + esc(task.remark) : ""}</div>
      ${task.status === "processing" ? this.runState.has(task.id) ? '<div class="bz-kb-progress-box"></div>' : task.reason ? `<div class="bz-kb-progress">${esc(task.reason)}</div>` : "" : ""}
      ${task.status === "failed" && task.reason ? `<div class="bz-kb-progress bz-kb-progress-error" title="${esc(task.reason)}">${esc(humanizeError(task.reason))}</div>` : ""}
      ${task.status === "success" && task.notePath ? `<div class="bz-kb-notepath">${iconSpan("file-text")} ${esc(task.notePath)}</div>` : ""}`;
      mountIcons(card);
      const actions = this.buildCardActions(task);
      if (actions.length) attachItemActions(card, actions);
      const titleLink = q(card, ".bz-kb-tlink");
      if (titleLink) titleLink.onclick = (e) => {
        e.stopPropagation();
        this._openExternal(titleLink.href || task.url);
      };
      card.addEventListener("click", () => {
        if (task.status === "success" && task.notePath) this.openNote(task.notePath);
        else if (task.status === "pending" || task.status === "failed") this.showAddDialog(task);
      });
      return card;
    }
    buildCardActions(task) {
      const actions = [];
      if (task.status === "success") {
        if (task.notePath) actions.push({ icon: "book-open", label: "打开文献笔记", onClick: () => this.openNote(task.notePath) });
        if (task.videoPath) actions.push({ icon: "copy", label: "复制视频路径", onClick: () => void this.copyText(task.videoPath) });
        actions.push({ icon: "pencil", label: "编辑", onClick: () => this.showAddDialog(task) });
      } else if (task.status === "failed" || task.status === "pending") {
        actions.push({ icon: "pencil", label: "编辑", onClick: () => this.showAddDialog(task) });
      }
      actions.push({ icon: "trash-2", label: "删除", kind: "danger", onClick: () => void this.confirmDelete(task) });
      return actions;
    }
    /** 行内进度定点更新（不等 storage 落库，一到立即刷 DOM） */
    updateRowProgress(id) {
      if (!this.videoList) return;
      const st = this.runState.get(id);
      const card = q(this.videoList, `.bz-kb-taskcard[data-id="${id}"]`);
      if (!card || !st) return;
      let box = q(card, ".bz-kb-progress-box");
      if (!box) {
        box = document.createElement("div");
        box.className = "bz-kb-progress-box";
        const meta = q(card, ".bz-kb-tmeta");
        if (meta) meta.after(box);
        else card.appendChild(box);
      }
      if (tryGetSettings().knowledgeProgressDetail === false) {
        const cur = st.steps[st.steps.length - 1] || "处理中…";
        box.innerHTML = `<div class="bz-kb-progress">${esc(cur)}</div>`;
        return;
      }
      const segs = st.steps.map(
        (s, i) => i === st.steps.length - 1 ? `<span class="bz-kb-step-cur">${esc(s)}</span>` : `<span class="bz-kb-step-done">✓ ${esc(stepDoneLabel(s))}</span>`
      );
      const pct = st.phase === "download" ? st.pct : null;
      const bar = pct != null ? `<div class="bz-kb-progress-track"><div class="bz-kb-progress-fill" style="width:${Math.min(100, Math.max(0, pct))}%"></div></div>` : "";
      box.innerHTML = `
      <div class="bz-kb-steps">${segs.join('<span class="bz-kb-step-arrow">→</span>')}${pct != null ? ` <span class="bz-kb-step-pct">${Math.round(pct)}%</span>` : ""}</div>
      ${bar}
      <div class="bz-kb-elapsed">${iconSpan("timer")} ${fmtElapsed(Date.now() - st.startAt)}</div>`;
      mountIcons(box);
    }
    startRunTimer() {
      this.clearRunTimer();
      this.runTimer = setInterval(() => {
        for (const id of Array.from(this.runState.keys())) this.updateRowProgress(id);
      }, 1e3);
    }
    clearRunTimer() {
      if (this.runTimer !== null) {
        clearInterval(this.runTimer);
        this.runTimer = null;
      }
    }
    async onRunBatch() {
      if (!BatchRunner.available()) {
        notice("仅桌面端可用：批量处理需要 Node.js 外部进程", "error");
        return;
      }
      if (BatchRunner.running) return;
      const tasks = await KnowledgeData.loadTasks();
      const work = tasks.filter((t) => !t.archived && (t.status === "pending" || t.status === "failed"));
      if (work.length === 0) {
        notice("没有待处理或失败的任务", "info");
        return;
      }
      this.batchAbortLabel = work.every((t) => t.status === "failed") ? "终止整批" : "终止";
      const ui2 = this;
      ui2.startRunTimer();
      const events = {
        onTaskProgress: (t, stepText, progress) => {
          let st = ui2.runState.get(t.id);
          if (!st) {
            st = { steps: [], phase: null, pct: null, startAt: Date.now() };
            ui2.runState.set(t.id, st);
          }
          if (stepText && stepText !== "启动中…" && !st.steps.includes(stepText)) st.steps.push(stepText);
          if (progress) {
            if (progress.phase) st.phase = progress.phase;
            if (progress.pct != null) st.pct = progress.pct;
          }
          ui2.updateRowProgress(t.id);
        },
        onTaskInfo: () => {
          void ui2.refreshVideoPanel();
        },
        onTaskDone: () => {
          void ui2.refreshVideoPanel();
        },
        onBatchDone: (summary) => {
          ui2.clearRunTimer();
          ui2.runState.clear();
          const head = `处理完成：成功 ${summary.success} 部`;
          const tail = summary.failed ? `，失败 ${summary.failed} 部` : "";
          const end = summary.aborted ? "（已中止）" : summary.stopped ? "（遇错即停）" : "";
          notice(head + tail + end, summary.failed || summary.aborted || summary.stopped ? "warning" : "success");
          void ui2.refreshVideoPanel();
        }
      };
      const runP = BatchRunner.runAll(work, events);
      void this.refreshVideoPanel();
      try {
        await runP;
      } finally {
        this.batchAbortLabel = null;
      }
    }
    async onAbortBatch() {
      if (!BatchRunner.running) return;
      const v = await openFlowDialog({
        title: "中止批量处理？",
        message: "当前正在处理的视频将停止，已成功的保留在列表；未开始的项保持待处理，可稍后继续。",
        // issue 291：流程框挂 document.body，脱离面板根后纸墨 token 与域弹窗类全部失效。
        // 必须显式带两个类——'kb' = 纸墨变量作用域（本域 styles.css :7-33，亮暗两档），
        // 'bz-kb-flow-dialog' = 域弹窗类（供 id 选择器把共享壳改写成本域材质），
        // 否则本框与同域的「添加文献」「术语录入」弹窗不同皮（缺 'kb' 连底色都失效，同 issue 257 事故）。
        className: "kb bz-kb-flow-dialog",
        actions: [
          { label: "取消", value: "cancel" },
          { label: "中止", value: "ok", danger: true }
        ]
      });
      if (v !== "ok") return;
      BatchRunner.abort();
      await this.refreshVideoPanel();
    }
    async confirmDelete(task) {
      const v = await openFlowDialog({
        title: "删除转文献任务",
        message: "仅从列表移除记录，已生成的文献笔记与视频不受影响。",
        // issue 291：同上——弹窗挂 body 必须自带 'kb'（token 作用域）+ 'bz-kb-flow-dialog'（域皮）
        className: "kb bz-kb-flow-dialog",
        actions: [
          { label: "取消", value: "cancel" },
          { label: "删除", value: "ok", danger: true }
        ]
      });
      if (v !== "ok") return;
      await KnowledgeData.deleteTask(task.id);
      await this.refreshVideoPanel();
    }
    async confirmClearHistory() {
      const v = await openFlowDialog({
        title: "清空历史",
        message: "将移除全部「成功」归档记录；文献笔记与视频文件保留在原处。",
        // issue 291：同上——挂 body 的流程框须显式带皮肤类才与「处理面板」同皮
        className: "kb bz-kb-flow-dialog",
        actions: [
          { label: "取消", value: "cancel" },
          { label: "清空", value: "ok", danger: true }
        ]
      });
      if (v !== "ok") return;
      await KnowledgeData.clearHistory();
      await this.refreshVideoPanel();
    }
    // ==================== 影像 · 录入界面（词典皮 + 解析后展开，issue 310） ====================
    createAddDialog() {
      var _a, _b;
      const addMask = document.createElement("div");
      addMask.id = "knowledge-add-mask";
      addMask.className = "bz-kb-mask";
      addMask.style.display = "none";
      addMask.onclick = () => this.requestAddClose();
      const popup = document.createElement("div");
      popup.id = "knowledge-add-popup";
      popup.className = "bz-lit-dialog kb";
      popup.style.display = "none";
      popup.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title">影 像</span>
        <span id="lit-add-mode" class="bz-lit-mode-tag" style="display:none;">编辑任务</span>
      </div>
      <div id="lit-add-fail" class="bz-lit-form-alert" style="display:none;"></div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">链接</span>
        <input id="lit-add-url" type="text" autocomplete="off">
        <button id="lit-add-resolve" type="button">解析</button>
      </div>
      <div id="lit-add-rstate" class="bz-lit-rstate" style="display:none;"></div>
      <div id="lit-add-more" style="display:none;">
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">标题</span>
          <span id="lit-add-ititle" class="bz-lit-term-meta-v"></span>
        </div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">UP 主</span>
          <span id="lit-add-iuploader" class="bz-lit-term-meta-v"></span>
        </div>
        <div class="bz-lit-term-row" id="lit-add-page-row" style="display:none;">
          <span class="bz-lit-term-meta-k">分P</span>
          <select id="lit-add-page"></select>
        </div>
        <div class="bz-lit-term-row" id="lit-add-pagenum-row" style="display:none;">
          <span class="bz-lit-term-meta-k">分P</span>
          <input id="lit-add-page-num" type="number" min="1" step="1">
        </div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">剪辑</span>
          <input id="lit-add-start" type="text" autocomplete="off">
          <span class="bz-lit-range-dash">~</span>
          <input id="lit-add-end" type="text" autocomplete="off">
          <button id="lit-add-whole" type="button">整片</button>
        </div>
        <div id="lit-add-rb"></div>
        <div class="bz-lit-term-row">
          <span class="bz-lit-term-meta-k">清晰度</span>
          <select id="lit-add-quality"></select>
        </div>
        <div id="lit-add-rhint" class="bz-lit-rhint" style="display:none;"></div>
        <div class="bz-lit-term-actions">
          <button id="lit-add-save" class="bz-lit-accent-btn">保存</button>
        </div>
      </div>`;
      document.body.appendChild(addMask);
      document.body.appendChild(popup);
      this.addMask = addMask;
      this.addPopup = popup;
      q(popup, "#lit-add-save").onclick = () => void this._handleAddSave();
      q(popup, "#lit-add-resolve").onclick = () => void this._handleResolve();
      q(popup, "#lit-add-whole").onclick = () => {
        this.addDirty = true;
        this._resetAddRange();
      };
      (_a = q(popup, "#lit-add-quality")) == null ? void 0 : _a.addEventListener("change", () => {
        this.addDirty = true;
      });
      const addUrlInput = q(popup, "#lit-add-url");
      if (addUrlInput) {
        addUrlInput.addEventListener("input", () => {
          this.addDirty = true;
          this.addUrlSeq++;
          this.addResolving = false;
          this._setResolveState(null);
          this.addRevealed = false;
          if (this.addMeta || this.addDuration > 0) {
            this.addMeta = null;
            this.addQualities = null;
            this.addDuration = 0;
            this.addStart = 0;
            this.addEnd = 0;
            this.addPage = 1;
          }
          this._renderAdd();
        });
        addUrlInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (this.addResolving) return;
            void this._handleResolve();
          }
        });
      }
      (_b = q(popup, "#lit-add-page")) == null ? void 0 : _b.addEventListener("change", (e) => {
        this.addDirty = true;
        void this._switchAddPage(Number(e.target.value) || 1);
      });
      for (const [sel, which] of [["#lit-add-start", "start"], ["#lit-add-end", "end"]]) {
        const input = q(popup, sel);
        if (!input) continue;
        input.addEventListener("change", () => {
          this.addDirty = true;
          this._commitTimeInput(which);
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            this.addDirty = true;
            this._nudgeTime(which, e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? 10 : 1);
          } else if (e.key === "Enter") {
            e.preventDefault();
            this._commitTimeInput(which, true);
            void this._handleAddSave();
          }
        });
      }
      const numInput = q(popup, "#lit-add-page-num");
      if (numInput) {
        numInput.addEventListener("input", () => {
          this.addDirty = true;
          const n = Number(numInput.value.trim());
          this.addPage = Number.isInteger(n) && n > 0 ? n : 1;
        });
        numInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void this._handleAddSave();
          }
        });
      }
      this._renderAdd();
    }
    showAddDialog(editItem) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (!this.addPopup || !this.addMask) return;
      this.addUrlReset();
      this.addDirty = false;
      this.editingId = (_a = editItem == null ? void 0 : editItem.id) != null ? _a : null;
      this.addRevealed = !!this.editingId;
      const modeTag = q(this.addPopup, "#lit-add-mode");
      if (modeTag) modeTag.style.display = this.editingId ? "inline-block" : "none";
      q(this.addPopup, "#lit-add-url").value = (_b = editItem == null ? void 0 : editItem.url) != null ? _b : "";
      this.addMeta = editItem && (editItem.title || editItem.uploader) ? { title: editItem.title || void 0, uploader: editItem.uploader || void 0 } : null;
      this.addQualities = null;
      this.addResolving = false;
      this.addPage = (editItem == null ? void 0 : editItem.page) && editItem.page > 0 ? editItem.page : 1;
      this.addDuration = (editItem == null ? void 0 : editItem.duration) && editItem.duration > 0 ? editItem.duration : 0;
      this.addStart = (_d = timeTextToSec((_c = editItem == null ? void 0 : editItem.start) != null ? _c : "")) != null ? _d : 0;
      this.addEnd = (_f = timeTextToSec((_e = editItem == null ? void 0 : editItem.end) != null ? _e : "")) != null ? _f : this.addDuration;
      this._setResolveState(null);
      this._renderAdd(this.editingId !== null);
      if (editItem == null ? void 0 : editItem.quality) {
        const qSel = q(this.addPopup, "#lit-add-quality");
        if (qSel) qSel.value = editItem.quality;
      }
      const fail = q(this.addPopup, "#lit-add-fail");
      if (fail) {
        const reason = (editItem == null ? void 0 : editItem.status) === "failed" ? editItem.reason || "" : "";
        fail.style.display = reason ? "block" : "none";
        fail.textContent = reason ? `上次处理失败：${humanizeError(reason)}` : "";
        fail.title = reason;
      }
      topifyZ(this.addMask, this.addPopup);
      this.addMask.style.display = "block";
      this.addPopup.style.display = "flex";
      const urlInput = q(this.addPopup, "#lit-add-url");
      if (urlInput) setTimeout(() => urlInput.focus(), 100);
      if (((_g = editItem == null ? void 0 : editItem.url) != null ? _g : "").trim()) void this._handleResolve({ auto: true });
    }
    /** 弹窗全量重绘（ADR-0133 状态单源）：信息区 / 分P 控件 / 范围条 / 档位下拉 / 按钮态 */
    _renderAdd(preserveQuality = false) {
      var _a, _b;
      const popup = this.addPopup;
      if (!popup) return;
      const prevQuality = preserveQuality ? (_b = (_a = q(popup, "#lit-add-quality")) == null ? void 0 : _a.value) != null ? _b : null : null;
      const meta = this.addMeta;
      const pages = (meta == null ? void 0 : meta.pages) || [];
      const multi = pages.length > 1;
      const more = q(popup, "#lit-add-more");
      if (more) more.style.display = this.addRevealed ? "block" : "none";
      const tEl = q(popup, "#lit-add-ititle");
      if (tEl) {
        tEl.textContent = (meta == null ? void 0 : meta.title) || "（未取到标题）";
        tEl.title = (meta == null ? void 0 : meta.title) || "";
      }
      const uEl = q(popup, "#lit-add-iuploader");
      if (uEl) {
        uEl.textContent = (meta == null ? void 0 : meta.uploader) || "（未取到）";
        uEl.title = (meta == null ? void 0 : meta.uploader) || "";
      }
      const pageRow = q(popup, "#lit-add-page-row");
      const numRow = q(popup, "#lit-add-pagenum-row");
      if (pageRow) pageRow.style.display = multi ? "" : "none";
      if (numRow) numRow.style.display = pages.length ? "none" : "";
      const sel = q(popup, "#lit-add-page");
      if (multi && sel) {
        sel.innerHTML = pages.map((p) => `<option value="${p.page}">${esc(this._pageLabel(p))}</option>`).join("");
        sel.value = String(this.addPage);
      }
      const num2 = q(popup, "#lit-add-page-num");
      if (num2 && !pages.length) num2.value = this.addPage > 1 ? String(this.addPage) : "";
      this._rebuildBar();
      this._paintRange();
      this._renderQualitySelect(prevQuality);
      const rBtn = q(popup, "#lit-add-resolve");
      if (rBtn) {
        rBtn.disabled = this.addResolving;
        rBtn.textContent = this.addResolving ? "解析中…" : "解析";
      }
      const sBtn = q(popup, "#lit-add-save");
      if (sBtn) sBtn.disabled = this.addResolving;
    }
    /** 分P 下拉项文案：P{n} · {标题} · {时长}（时长未知省略） */
    _pageLabel(p) {
      const parts = [`P${p.page}`];
      if (p.part) parts.push(p.part);
      if (p.duration > 0) parts.push(secToTimeText(p.duration));
      return parts.join(" · ");
    }
    /** 档位标签：4K / 2K / {h}P（口径随 CLI qualityLabel，不带帧率） */
    _heightLabel(h) {
      return h >= 2160 ? "4K" : h >= 1440 ? "2K" : `${h}P`;
    }
    /**
     * 清晰度下拉重绘（ADR-0133）：有实测档位 → [最高, 实测各档]，默认选中全局设置对应的具体档
     * （不可用回落最高可用 + 提示）；无实测档位 → 固定 [最高, 1080P, 720P]，默认全局档。
     * prevValue 仍在新列表内时优先保留（编辑态回显 / 切 P 重查）。
     */
    _renderQualitySelect(prevValue) {
      var _a;
      const popup = this.addPopup;
      if (!popup) return;
      const sel = q(popup, "#lit-add-quality");
      if (!sel) return;
      const hint = q(popup, "#lit-add-rhint");
      const globalQ = String(((_a = tryGetSettings()) == null ? void 0 : _a.knowledgeQuality) || "highest");
      const heights = this.addQualities;
      const opts = [];
      let def = "highest";
      let hintText = "";
      if (heights && heights.length) {
        opts.push({ value: "highest", label: "最高" });
        for (const h of heights) opts.push({ value: String(h), label: this._heightLabel(h) });
        const gv = /^\d+$/.test(globalQ) ? Number(globalQ) : 0;
        if (gv) {
          if (heights.includes(gv)) def = String(gv);
          else {
            def = String(heights[0]);
            hintText = `全局 ${gv}P 在该视频不可用，已选最高可用 ${heights[0]}P`;
          }
        }
      } else {
        opts.push({ value: "highest", label: "最高" }, { value: "1080", label: "1080P" }, { value: "720", label: "720P" });
        if (/^\d+$/.test(globalQ) && (globalQ === "1080" || globalQ === "720")) def = globalQ;
      }
      const keep = prevValue && opts.some((o) => o.value === prevValue) ? prevValue : null;
      sel.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join("");
      sel.value = keep || def;
      if (hint) {
        hint.style.display = hintText ? "" : "none";
        hint.textContent = hintText;
      }
    }
    /** 范围条重建（量程 < 2 秒 = 无进度条：失败态/未知时长只出时间框）；实例在宿主上时只 set 复用（重绘不摘把手） */
    _rebuildBar() {
      const popup = this.addPopup;
      if (!popup) return;
      const host = q(popup, "#lit-add-rb");
      if (!host) return;
      if (this.addDuration < 2) {
        host.innerHTML = "";
        host.style.display = "none";
        this.addBar = null;
        return;
      }
      host.style.display = "";
      if (this.addBar && this.addBar.el.parentElement === host) {
        this.addBar.set(this.addDuration, this.addStart, this.addEnd);
        return;
      }
      host.innerHTML = "";
      const bar = new RangeBar({
        onChange: (s, e) => {
          this.addDirty = true;
          this.addStart = s;
          this.addEnd = e;
          this._paintRange();
        }
      });
      bar.set(this.addDuration, this.addStart, this.addEnd);
      host.appendChild(bar.el);
      this.addBar = bar;
    }
    /** 范围值 → 进度条 + 时间框（`only` = 只重写该框、不碰另一个——防覆盖用户正在输入的框；null = 两个都写） */
    _paintRange(only = null) {
      const popup = this.addPopup;
      if (!popup) return;
      if (this.addBar && this.addDuration >= 2) this.addBar.set(this.addDuration, this.addStart, this.addEnd);
      const sEl = q(popup, "#lit-add-start");
      const eEl = q(popup, "#lit-add-end");
      if (sEl && only !== "end") sEl.value = this.addStart > 0 || this.addDuration > 0 ? secToTimeText(this.addStart) : "";
      if (eEl && only !== "start") eEl.value = this.addEnd > 0 ? secToTimeText(this.addEnd) : "";
    }
    /** 「整片」一键重置（ADR-0133）：有量程 → 全选；无时长 → 清空时间框 */
    _resetAddRange() {
      this.addStart = 0;
      this.addEnd = this.addDuration > 0 ? this.addDuration : 0;
      this._paintRange();
    }
    /** 时间框提交（blur/回车）：宽松解析 → 钳制到量程 → 回写状态与把手；非法值时回填旧值 */
    _commitTimeInput(which, silent = false) {
      const popup = this.addPopup;
      if (!popup) return;
      const input = q(popup, which === "start" ? "#lit-add-start" : "#lit-add-end");
      if (!input) return;
      const raw = input.value.trim();
      const sec = timeTextToSec(raw);
      if (sec === null) {
        if (raw && !silent) notice("时间格式看不懂：支持 12.2 / 12-2 / 1:30:05 等，单个数字按分钟算", "error");
        input.value = this.addDuration > 0 ? secToTimeText(which === "start" ? this.addStart : this.addEnd) : "";
        return;
      }
      if (which === "start") this.addStart = Math.max(0, Math.min(sec, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
      else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(sec, this.addDuration > 0 ? this.addStart + 1 : 0));
      this._paintRange(which);
    }
    /** 时间框 ↑/↓ 微调（ADR-0133：一次 1 秒，Shift ±10） */
    _nudgeTime(which, dir, step) {
      if (which === "start") this.addStart = Math.max(0, Math.min(this.addStart + dir * step, this.addDuration > 0 ? this.addEnd - 1 : Number.MAX_SAFE_INTEGER));
      else this.addEnd = Math.min(this.addDuration > 0 ? this.addDuration : Number.MAX_SAFE_INTEGER, Math.max(this.addEnd + dir * step, this.addDuration > 0 ? this.addStart + 1 : 0));
      this._paintRange(which);
    }
    /** 解析态提示行（解析中/失败原因；null = 隐藏） */
    _setResolveState(text, kind = "error") {
      const el = this.addPopup ? q(this.addPopup, "#lit-add-rstate") : null;
      if (!el) return;
      el.style.display = text ? "" : "none";
      el.textContent = text || "";
      el.classList.toggle("is-error", !!text && kind === "error");
    }
    /** 分P 切换（ADR-0133）：量程与范围重置为全选，档位按该 P 的 cid 静默重查（未登录/失败 → 清档回落固定列表） */
    async _switchAddPage(p) {
      var _a, _b, _c, _d, _e, _f, _g;
      const popup = this.addPopup;
      if (!popup) return;
      this.addPage = p;
      const pages = ((_a = this.addMeta) == null ? void 0 : _a.pages) || [];
      const sel = pages.find((x) => x.page === p) || pages[0];
      const dur = (sel == null ? void 0 : sel.duration) || ((_b = this.addMeta) == null ? void 0 : _b.duration) || 0;
      this.addDuration = dur;
      this.addStart = 0;
      this.addEnd = dur;
      this._rebuildBar();
      this._paintRange();
      const cookie = String(((_c = tryGetSettings()) == null ? void 0 : _c.bilibiliCookie) || "");
      const bvid = ((_d = this.addMeta) == null ? void 0 : _d.bvid) || parseBvid(((_e = q(popup, "#lit-add-url")) == null ? void 0 : _e.value) || "");
      if (!cookie || !bvid || !(sel == null ? void 0 : sel.cid)) return;
      const cur = (_g = (_f = q(popup, "#lit-add-quality")) == null ? void 0 : _f.value) != null ? _g : null;
      const seq = this.addUrlSeq;
      const qualities = await fetchCheckedQualities(bvid, sel.cid, cookie);
      if (this.addPopup !== popup || this.addPage !== p || this.addUrlSeq !== seq) return;
      this.addQualities = qualities;
      this._renderQualitySelect(cur);
    }
    /**
     * 「解析」按钮 / 打开弹窗自动重抓（ADR-0133）：净化写回 → resolveVideo（meta + 实测档位）→ 渲染。
     * 手动解析：按钮 loading + 保存禁用；自动重抓：全程静默、不阻塞保存（失败保留已有值）。
     * 手动解析失败进失败态（可手填分 P 与时间范围）；编辑态自动重抓成功 → 即落库（只补缺失字段）。
     */
    async _handleResolve(opts) {
      var _a;
      const popup = this.addPopup;
      if (!popup) return;
      const urlInput = q(popup, "#lit-add-url");
      if (!urlInput) return;
      const cleaned = normalizeSourceUrl(urlInput.value.trim());
      if (!cleaned) {
        if (!(opts == null ? void 0 : opts.auto)) {
          notice("请填写视频链接或 BV 号", "error");
          urlInput.focus();
        }
        return;
      }
      if (cleaned !== urlInput.value) urlInput.value = cleaned;
      const seq = ++this.addUrlSeq;
      const manual = !(opts == null ? void 0 : opts.auto);
      if (manual) {
        this.addResolving = true;
        this._setResolveState("解析中…", "busy");
        this._renderAdd(true);
      }
      const cookie = String(((_a = tryGetSettings()) == null ? void 0 : _a.bilibiliCookie) || "");
      const res = await resolveVideo(cleaned, cookie, Math.max(0, this.addPage - 1));
      if (seq !== this.addUrlSeq || this.addPopup !== popup) return;
      this.addResolving = false;
      this.addRevealed = true;
      if (!res) {
        if (!(opts == null ? void 0 : opts.auto)) {
          this.addMeta = null;
          this.addQualities = null;
          this.addDuration = 0;
          this.addStart = 0;
          this.addEnd = 0;
          this._setResolveState("解析失败：拿不到视频信息（网络不可达 / 视频被删 / 非 B 站链接）——可手动填写分 P 与时间范围");
        }
        this._renderAdd(true);
        return;
      }
      this._setResolveState(null);
      this._applyResolved(res);
      if (res.meta.bvid && !parseBvid(cleaned)) urlInput.value = canonicalVideoUrl(res.meta.bvid);
      this._renderAdd((opts == null ? void 0 : opts.auto) === true);
      if (opts == null ? void 0 : opts.auto) {
        const editId = this.editingId;
        if (editId) {
          const tasks = await KnowledgeData.loadTasks();
          const cur = tasks.find((t) => t.id === editId);
          if (cur && this.editingId === editId && this.addPopup === popup) await this._persistResolved(cur, res);
        }
      }
    }
    /** 解析结果落地到弹窗状态：分 P 校正 / 量程 / 范围（首次拿到时长 → 全选；已有范围 → 钳制保持） */
    _applyResolved(res) {
      var _a, _b;
      const meta = res.meta;
      const pages = meta.pages || [];
      if (pages.length > 1) {
        if (!pages.some((p) => p.page === this.addPage)) this.addPage = pages[0].page;
      } else {
        this.addPage = (_b = (_a = pages[0]) == null ? void 0 : _a.page) != null ? _b : 1;
      }
      const sel = pages.find((p) => p.page === this.addPage) || pages[0];
      const newDur = (sel == null ? void 0 : sel.duration) || meta.duration || 0;
      const dur = newDur > 0 ? newDur : this.addDuration;
      const hadRange = this.addDuration > 0;
      this.addMeta = meta;
      this.addQualities = res.qualities || null;
      this.addDuration = dur;
      if (dur > 0) {
        if (hadRange) {
          this.addStart = Math.max(0, Math.min(this.addStart, dur - 1));
          this.addEnd = Math.min(dur, Math.max(this.addEnd, this.addStart + 1));
        } else {
          this.addStart = 0;
          this.addEnd = dur;
        }
      }
    }
    /** 抓取成功即落库（ADR-0133）：只补缺失字段（标题/UP/时长），失败静默不打断录入 */
    async _persistResolved(task, res) {
      try {
        const patch = {};
        const meta = res.meta;
        if (meta.bvid && needsBvidRepair(task.url)) patch.url = canonicalVideoUrl(meta.bvid);
        if (!task.title && meta.title) patch.title = meta.title;
        if (!task.uploader && meta.uploader) patch.uploader = meta.uploader;
        const pages = meta.pages || [];
        const pageIdx = Math.max(0, (task.page || 1) - 1);
        const sel = pages[pageIdx] || pages[0];
        const dur = (sel && sel.duration > 0 ? sel.duration : 0) || meta.duration || 0;
        if (!task.duration && dur > 0) patch.duration = dur;
        if (!Object.keys(patch).length) return;
        await KnowledgeData.updateTask(task.id, patch);
        if (this.videoPopup && this.videoPopup.style.display === "flex") await this.refreshVideoPanel();
      } catch (e) {
      }
    }
    hideAddDialog() {
      if (this.addMask) this.addMask.style.display = "none";
      if (this.addPopup) this.addPopup.style.display = "none";
      this.editingId = null;
      this.addUrlReset();
      this.addMeta = null;
      this.addQualities = null;
      this.addResolving = false;
      this.addRevealed = false;
      this.addPage = 1;
      this.addDuration = 0;
      this.addStart = 0;
      this.addEnd = 0;
      this.addBar = null;
      const qSel = this.addPopup ? q(this.addPopup, "#lit-add-quality") : null;
      if (qSel) qSel.innerHTML = "";
    }
    /** 录入解析清理：序列号失效在途响应（开/关弹窗共用，ADR-0133） */
    addUrlReset() {
      this.addUrlSeq++;
    }
    async _handleAddSave() {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
      if (!this.addPopup) return;
      if (this.addResolving) {
        notice("解析中，请稍候", "info");
        return;
      }
      let url = normalizeSourceUrl(((_b = (_a = q(this.addPopup, "#lit-add-url")) == null ? void 0 : _a.value) != null ? _b : "").trim());
      if (!url) {
        notice("请填写视频链接或 BV 号", "error");
        (_c = q(this.addPopup, "#lit-add-url")) == null ? void 0 : _c.focus();
        return;
      }
      const resolvedBvid = (_d = this.addMeta) == null ? void 0 : _d.bvid;
      if (resolvedBvid && needsBvidRepair(url)) url = canonicalVideoUrl(resolvedBvid);
      this._commitTimeInput("start", true);
      this._commitTimeInput("end", true);
      const dur = this.addDuration;
      const whole = this.addStart <= 0 && (dur > 0 ? this.addEnd >= dur : this.addEnd <= 0);
      let start = null;
      let end = null;
      if (!whole) {
        if (!(this.addStart > 0) || !(this.addEnd > 0)) {
          notice("开始与结束时间需成对填写", "error");
          return;
        }
        if (this.addStart >= this.addEnd) {
          notice("结束时间需大于开始时间", "error");
          return;
        }
        start = secToTimeText(this.addStart);
        end = secToTimeText(this.addEnd);
      }
      let page = null;
      const pages = ((_e = this.addMeta) == null ? void 0 : _e.pages) || [];
      if (pages.length > 1) {
        page = this.addPage > 1 ? this.addPage : null;
      } else if (!pages.length) {
        const raw = ((_g = (_f = q(this.addPopup, "#lit-add-page-num")) == null ? void 0 : _f.value) != null ? _g : "").trim();
        if (raw) {
          const n = Number(raw);
          if (!Number.isInteger(n) || n < 1) {
            notice("分P 应为正整数（留空 = 第 1 P）", "error");
            (_h = q(this.addPopup, "#lit-add-page-num")) == null ? void 0 : _h.focus();
            return;
          }
          page = n > 1 ? n : null;
        }
      }
      const quality = ((_j = (_i = q(this.addPopup, "#lit-add-quality")) == null ? void 0 : _i.value) != null ? _j : "").trim() || null;
      const editing = this.editingId;
      try {
        const patch = {
          url,
          start,
          end,
          quality,
          page,
          title: ((_k = this.addMeta) == null ? void 0 : _k.title) || null,
          uploader: ((_l = this.addMeta) == null ? void 0 : _l.uploader) || null,
          duration: dur > 0 ? dur : null
        };
        if (editing) {
          await KnowledgeData.updateTask(editing, patch);
        } else {
          await KnowledgeData.addTask(patch);
        }
        this.hideAddDialog();
        notice(editing ? "任务已更新" : "已加入影像处理队列", "success");
        this.showVideoTasks();
      } catch (e) {
        notice("保存失败：" + ((_m = e == null ? void 0 : e.message) != null ? _m : String(e)), "error");
      }
    }
    // ==================== 历史（处理面板内的第二视图，2026-09-14 复核） ====================
    /** 归档行渲染进面板内容区（`tasks` 由调用方一次读库后传入，避免一次刷新读两遍） */
    renderHistory(tasks) {
      if (!this.videoList) return;
      this.videoList.innerHTML = "";
      const rows = tasks.filter((t) => t.archived);
      const countsEl = this.videoPopup ? q(this.videoPopup, "#lit-video-counts") : null;
      if (countsEl) countsEl.textContent = `共 ${rows.length} 条`;
      if (rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "bz-kb-empty";
        empty.textContent = "暂无历史记录。成功的任务完成时会自动归档到这里。";
        this.videoList.appendChild(empty);
        return;
      }
      const groups = /* @__PURE__ */ new Map();
      for (const t of rows) {
        const key2 = t.url || t.id;
        const g = groups.get(key2);
        if (g) g.push(t);
        else groups.set(key2, [t]);
      }
      const sortedGroups = Array.from(groups.values()).map((g) => {
        g.sort((a, b) => String(a.processedAt || a.created).localeCompare(String(b.processedAt || b.created)));
        return g;
      });
      sortedGroups.sort((a, b) => {
        var _a, _b, _c, _d;
        const la = String(((_a = a[a.length - 1]) == null ? void 0 : _a.processedAt) || ((_b = a[a.length - 1]) == null ? void 0 : _b.created) || "");
        const lb = String(((_c = b[b.length - 1]) == null ? void 0 : _c.processedAt) || ((_d = b[b.length - 1]) == null ? void 0 : _d.created) || "");
        return lb.localeCompare(la);
      });
      for (const g of sortedGroups) this.videoList.appendChild(this.renderHistoryGroup(g));
    }
    renderHistoryGroup(group) {
      const head = group[0];
      const card = document.createElement("div");
      card.className = "bz-kb-taskcard bz-kb-hgroup";
      card.dataset.url = head.url || "";
      const href = head.url ? `href="${esc(head.url)}"` : "";
      const upText = head.uploader ? `<span class="bz-kb-hup">${esc(head.uploader)}</span>` : "";
      card.innerHTML = `
      <div class="bz-kb-trow">
        ${head.title ? `<a class="bz-kb-tlink" ${href} title="${esc(head.url || "")}">${esc(head.title)}</a>` : `<span class="bz-kb-turl" title="${esc(head.url || "")}">${esc(shortUrlText(head.url || ""))}</span>`}
        ${upText}
      </div>`;
      for (const task of group) {
        const line = document.createElement("div");
        line.className = "bz-kb-hnote";
        line.innerHTML = `${iconSpan("file-text")} ${esc(shortNoteName(task.notePath || ""))}<span class="bz-kb-hnote-time">${iconSpan("clock")} ${esc(formatRelativeTime(task.processedAt || task.created || ""))}</span>`;
        mountIcons(line);
        line.addEventListener("click", () => {
          if (task.notePath) this.openNote(task.notePath);
        });
        const actions = [];
        if (task.notePath) actions.push({ icon: "book-open", label: "打开文献笔记", onClick: () => this.openNote(task.notePath) });
        if (task.videoPath) actions.push({ icon: "copy", label: "复制视频路径", onClick: () => void this.copyText(task.videoPath) });
        actions.push({ icon: "trash-2", label: "移出历史", kind: "danger", onClick: () => void this.confirmDelete(task) });
        attachItemActions(line, actions);
        card.appendChild(line);
      }
      const link = q(card, ".bz-kb-tlink");
      if (link && head.url) link.onclick = (e) => {
        e.stopPropagation();
        this._openExternal(head.url);
      };
      return card;
    }
    // ============ 录入面板：名词 / 段落 / 图版同壳三态（142 简洁版 + 155 总结 + issue 309/312） ============
    createTermUI() {
      var _a, _b, _c, _d, _e;
      const mask = document.createElement("div");
      mask.id = "knowledge-term-mask";
      mask.className = "bz-kb-mask";
      mask.style.display = "none";
      mask.onclick = () => this.requestTermClose();
      const popup = document.createElement("div");
      popup.id = "knowledge-term-popup";
      popup.className = "bz-lit-dialog bz-lit-term-dialog kb";
      popup.setAttribute("data-lit-entry", "term");
      popup.style.display = "none";
      const body = document.createElement("div");
      body.className = "bz-lit-term-body";
      body.innerHTML = `
      <div class="bz-lit-sheet-head">
        <span class="bz-lit-sheet-title" id="lit-entry-title">名词</span>
      </div>
      <div class="bz-lit-term-row bz-lit-term-only">
        <span class="bz-lit-term-meta-k">名词</span>
        <input id="lit-term-input" type="text" autocomplete="off">
      </div>
      <div id="lit-term-dup" class="bz-lit-dup-hint bz-lit-term-only" style="display:none;"></div>
      <div class="bz-lit-term-row bz-lit-passage-only">
        <span class="bz-lit-term-meta-k">段落</span>
        <textarea id="lit-passage-input" rows="6" placeholder="粘贴一段文字…"></textarea>
      </div>
      <div class="bz-lit-term-row bz-lit-image-only">
        <span class="bz-lit-term-meta-k">图版</span>
        <div id="lit-image-drop" class="bz-lit-drop" tabindex="0" role="button">
          <div id="lit-image-grid" class="bz-lit-drop-grid" style="display:none;"></div>
          <span id="lit-image-hint" class="bz-lit-drop-hint">拖入图片，或 Ctrl+V 粘贴截图</span>
        </div>
        <input id="lit-image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple style="display:none;">
      </div>
      <div class="bz-lit-term-row">
        <span class="bz-lit-term-meta-k">来源</span>
        <input id="lit-term-src" type="text" autocomplete="off">
        <span id="lit-term-src-chip" class="bz-lit-srcchip" style="display:none;"></span>
      </div>
      <div class="bz-lit-term-actions">
        <button id="lit-term-generate" class="bz-lit-accent-btn">生成</button>
      </div>
      <div id="lit-term-preview" style="display:none;">
        <div class="bz-lit-term-card">
          <div class="bz-lit-term-meta">
            <div class="bz-lit-term-meta-row bz-lit-term-only"><span class="bz-lit-term-meta-k">名词</span><span id="lit-term-meta-term" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row bz-lit-titled-only"><span class="bz-lit-term-meta-k">标题</span><input id="lit-entry-meta-title" type="text" autocomplete="off"></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">领域</span><span id="lit-term-meta-domain" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">日期</span><span id="lit-term-meta-date" class="bz-lit-term-meta-v"></span></div>
            <div class="bz-lit-term-meta-row" id="lit-term-meta-srcrow" style="display:none;"><span class="bz-lit-term-meta-k">来源</span><span id="lit-term-meta-src" class="bz-lit-term-meta-v bz-lit-srcopen" data-term-src-open="1"></span></div>
            <div class="bz-lit-term-meta-row"><span class="bz-lit-term-meta-k">关联</span><span id="lit-term-meta-rel" class="bz-lit-term-meta-v bz-lit-rel-idle">待写入</span></div>
          </div>
        </div>
        <div class="bz-lit-term-card">
          <div id="lit-term-content" class="bz-lit-term-content"></div>
        </div>
        <div class="bz-lit-term-actions">
          <button id="lit-term-regenerate">总结</button>
          <button id="lit-term-save" class="bz-lit-accent-btn">确认写入</button>
        </div>
      </div>`;
      popup.appendChild(body);
      document.body.appendChild(mask);
      document.body.appendChild(popup);
      this.termMask = mask;
      this.termPopup = popup;
      q(popup, "#lit-term-generate").onclick = () => void this.onTermGenerate();
      q(popup, "#lit-term-regenerate").onclick = () => void this.onTermSummarize();
      q(popup, "#lit-term-save").onclick = () => void this.onTermConfirm();
      (_a = q(popup, "#lit-term-input")) == null ? void 0 : _a.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.onTermGenerate();
        }
      });
      (_b = q(popup, "#lit-term-input")) == null ? void 0 : _b.addEventListener("input", () => this.refreshTermDupHint());
      (_c = q(popup, "#lit-passage-input")) == null ? void 0 : _c.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void this.onTermGenerate();
        }
      });
      const zone = q(popup, "#lit-image-drop");
      const fileInput = q(popup, "#lit-image-file");
      if (zone && fileInput) {
        zone.addEventListener("dragover", (e) => {
          e.preventDefault();
          zone.classList.add("is-over");
        });
        zone.addEventListener("dragleave", () => zone.classList.remove("is-over"));
        zone.addEventListener("drop", (e) => {
          var _a2;
          e.preventDefault();
          zone.classList.remove("is-over");
          const files = Array.from(((_a2 = e.dataTransfer) == null ? void 0 : _a2.files) || []);
          if (files.length) void this.acceptImageFiles(files);
        });
        zone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
          const files = Array.from(fileInput.files || []);
          fileInput.value = "";
          if (files.length) void this.acceptImageFiles(files);
        });
        (_d = q(popup, "#lit-image-grid")) == null ? void 0 : _d.addEventListener("click", (e) => {
          var _a2, _b2, _c2, _d2;
          const btn = (_b2 = (_a2 = e.target) == null ? void 0 : _a2.closest) == null ? void 0 : _b2.call(_a2, "[data-lit-image-remove]");
          if (btn) {
            e.stopPropagation();
            this.removeEntryImage(Number(btn.getAttribute("data-lit-image-remove")));
            return;
          }
          if ((_d2 = (_c2 = e.target) == null ? void 0 : _c2.closest) == null ? void 0 : _d2.call(_c2, "[data-lit-image-desc]")) e.stopPropagation();
        });
        (_e = q(popup, "#lit-image-grid")) == null ? void 0 : _e.addEventListener("input", (e) => {
          var _a2, _b2;
          const inp = (_b2 = (_a2 = e.target) == null ? void 0 : _a2.closest) == null ? void 0 : _b2.call(_a2, "[data-lit-image-desc]");
          if (!inp) return;
          const i = Number(inp.getAttribute("data-lit-image-desc"));
          if (Number.isInteger(i) && i >= 0 && i < this.entryImages.length) this.entryImages[i].desc = inp.value;
        });
      }
      this.onPaste = (e) => {
        if (!this.termPopup || this.termPopup.style.display !== "flex" || this.entryMode !== "image") return;
        const files = clipboardImageFiles(e.clipboardData);
        if (!files.length) return;
        e.preventDefault();
        void this.acceptImageFiles(files);
      };
      document.addEventListener("paste", this.onPaste);
      const srcInput = q(popup, "#lit-term-src");
      if (srcInput) {
        srcInput.addEventListener("input", () => {
          if (this.termSrcTimer) clearTimeout(this.termSrcTimer);
          this.termSrcTimer = setTimeout(() => this.termSrcTryCommit(srcInput), 450);
        });
        srcInput.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          const raw = (srcInput.value || "").trim();
          if (raw && isUrlLikeSourceText(raw)) {
            e.preventDefault();
            this.termSrcSet({ kind: "external", url: normalizeSourceUrl(raw) }, srcInput);
          }
        });
        this.termSrcSuggest = uiSuggest({
          anchor: srcInput,
          max: 12,
          iconOf: () => "📄",
          labelOf: (p) => noteSourceName(p),
          source: () => {
            if (!srcInput.value.trim()) return [];
            return (getApp().vault.getFiles() || []).filter((f) => f.extension === "md").map((f) => f.path);
          },
          onPick: (p) => this.termSrcSet({ kind: "note", path: p }, srcInput)
        });
      }
      popup.addEventListener("click", (e) => {
        const t = e.target.closest("[data-term-src-clear],[data-term-src-open]");
        if (!t) return;
        e.stopPropagation();
        if (t.hasAttribute("data-term-src-clear")) {
          const input = q(popup, "#lit-term-src");
          this.termSrcClear(input);
        } else if (this.termSource) {
          if (this.termSource.kind === "note") this.openNote(this.termSource.path);
          else this._openExternal(this.termSource.url);
        }
      });
    }
    /**
     * 打开「名词」录入（一个词）；term 预填（命令带选中词时自动生成）；src 预填来源（ADR-0116——
     * 仅命令入口带当前笔记，主窗按钮入口不预填）。
     * opts（issue 329 预填扩展，全可选）：见 EntryPrefill——text/images/onCreated；source 走 src 参数。
     */
    showTermEntry(term, src, opts) {
      this.showEntry("term", term, src, opts);
    }
    /**
     * 打开「段落」录入（一段文字，AI 自动出标题）；来源行与名词同构（ADR-0116）。
     * issue 326：支持选区预填（命令入口）——与名词不同，预填**不自动生成**（大段文字让用户确认后再生成），
     * showEntry 里自动生成只挂 term 态。opts（issue 329）：text/images/onCreated 预填。
     */
    showPassageEntry(text, src, opts) {
      this.showEntry("passage", text, src, opts);
    }
    /**
     * 打开「图版」录入（可放多张图，AI 读图成文，issue 312/313）；来源行与名词/段落同构（ADR-0116）。
     * opts（issue 329）：images = data URL 数组预填进内存图列表（走 acceptImageFiles 同构校验与上限）；
     * onCreated = 写入成功回调（不自动打开笔记）。
     */
    showImageEntry(src, opts) {
      this.showEntry("image", "", src, opts);
    }
    /**
     * 同壳三态入口（issue 309/312）：三种录入态共用一套 DOM，只切 `data-lit-entry` 与首行控件——
     * 名词=单行 input（有预填即自动生成），段落=多行 textarea（回车换行，Ctrl/Cmd+回车生成），
     * 图版=图片拖入区（拖/点选/Ctrl+V 三条路都收，**可多张**，图只在内存，确认写入才落盘）。
     * 每次打开即回到全新态：草稿清空、来源清空、图片清空、关联行归位到「待写入」。
     * opts（issue 329）：images 在全新态就位后预填进内存（等价粘贴路径）；onCreated 挂到确认写入——
     * 有回调时写入成功**不自动打开笔记**（ADR-0144 工具框流程：不打断阅读），路径交调用方处置。
     */
    showEntry(mode, text, src, opts) {
      var _a, _b;
      if (!this.termPopup || !this.termMask) return;
      this.entryMode = mode;
      this.termPreview = null;
      this.termHasDraft = false;
      this.entryOnCreated = (_a = opts == null ? void 0 : opts.onCreated) != null ? _a : null;
      this.resetEntryRel();
      this.clearEntryImage();
      this.termPopup.setAttribute("data-lit-entry", mode);
      const titleEl = q(this.termPopup, "#lit-entry-title");
      if (titleEl) titleEl.textContent = mode === "passage" ? "段落" : mode === "image" ? "图版" : "名词";
      const input = q(this.termPopup, "#lit-term-input");
      const area = q(this.termPopup, "#lit-passage-input");
      const value = (text != null ? text : "").trim();
      if (input) input.value = mode === "term" ? value : "";
      if (area) area.value = mode === "passage" ? value : "";
      this.termSrcReset(q(this.termPopup, "#lit-term-src"));
      if (src) this.termSrcSet(src, q(this.termPopup, "#lit-term-src"));
      this.setTermPreviewVisible(false);
      this.setTermGenLoading(false);
      topifyZ(this.termMask, this.termPopup);
      this.termMask.style.display = "block";
      this.termPopup.style.display = "flex";
      const zone = q(this.termPopup, "#lit-image-drop");
      const focusEl = mode === "passage" ? area : mode === "image" ? zone : input;
      if (focusEl && !value) setTimeout(() => focusEl.focus(), 100);
      if (mode === "term" && value) void this.onTermGenerate();
      if (mode === "image" && ((_b = opts == null ? void 0 : opts.images) == null ? void 0 : _b.length)) void this.acceptImageDataUrls(opts.images);
      this.resetTermDupHint();
    }
    /** 名词重名实时提醒（ADR-0143/issue 328）：同步查 vault（getAbstractFileByPath 内存索引，无需防抖），
     *  命中内联显示既有笔记名，改名即消；仅提醒不阻断、不锁按钮。 */
    refreshTermDupHint() {
      var _a, _b, _c;
      if (!this.termPopup) return;
      const hint = q(this.termPopup, "#lit-term-dup");
      if (!hint) return;
      const term = ((_b = (_a = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _a.value) != null ? _b : "").trim();
      const dup = term ? findDuplicateTermNote(term) : null;
      hint.textContent = dup ? "已存在同名文献笔记：" + ((_c = String(dup).split("/").pop()) == null ? void 0 : _c.replace(/\.md$/, "")) : "";
      hint.style.display = dup ? "" : "none";
    }
    /** 重名提醒复位（开面板 / 关面板即全新态） */
    resetTermDupHint() {
      const hint = this.termPopup ? q(this.termPopup, "#lit-term-dup") : null;
      if (hint) {
        hint.textContent = "";
        hint.style.display = "none";
      }
    }
    // ---------- 图版图片收发（issue 312；多图 issue 313） ----------
    /**
     * 收下若干张图（拖入 / 点选 / 粘贴共用，一次可多张）：格式与体积在 core/ai 侧校验
     * （只认 PNG/JPEG/GIF/WebP、单图 ≤32MiB），不合规的那张就地提示并跳过，其余照收。
     * **追加到列表尾部** = 笔记里的图片顺序就是放入顺序；上限 IMAGE_ENTRY_MAX 张。
     * 收下后**作废已有草稿**（图组变了，旧解读不再对应）：预览收起、关联行归位。
     */
    async acceptImageFiles(files) {
      if (!this.termPopup || this.entryMode !== "image" || !files.length) return;
      if (this.termGenerating) return;
      this.syncImageDescsFromDom();
      let hitLimit = false;
      let added = 0;
      for (const file of files) {
        if (this.entryImages.length >= IMAGE_ENTRY_MAX) {
          hitLimit = true;
          break;
        }
        const item = await this.readImageFile(file);
        if (!this.termPopup || this.entryMode !== "image") return;
        if (!item) continue;
        this.entryImages.push(item);
        added++;
      }
      if (hitLimit) notice(`一次最多放 ${IMAGE_ENTRY_MAX} 张图`, "error");
      if (!added) return;
      this.renderEntryImage();
      this.draftInvalidate();
    }
    /**
     * data URL 图片预填（issue 329 剪藏本工具框「存为图版」）：程序化入口没有 File 对象——
     * 把 data URL 解码转 File 后交 acceptImageFiles，校验链（MIME 白名单 / 体积 / ≤9 张上限 /
     * 收下作废旧草稿）与粘贴路径完全同构。坏串 / 非 data URL 静默跳过。
     */
    async acceptImageDataUrls(urls) {
      const files = [];
      (Array.isArray(urls) ? urls : []).forEach((u, i) => {
        const m = String(u || "").trim().match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i);
        if (!m) return;
        try {
          const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          files.push(new File([bytes], `prefill-${i + 1}.png`, { type: m[1] }));
        } catch (e) {
        }
      });
      await this.acceptImageFiles(files);
    }
    /** 单张校验与读取（MIME 白名单 / 读失败 / 转 data URL 失败均就地提示并返回 null） */
    async readImageFile(file) {
      var _a, _b;
      const mime = (String(file.type || "").toLowerCase() === "image/jpg" ? "image/jpeg" : String(file.type || "").toLowerCase()) || imageMimeOfPath(file.name) || "";
      if (!imageExtOfMime(mime)) {
        notice("只支持 PNG / JPEG / GIF / WebP 图片", "error");
        return null;
      }
      let bytes;
      try {
        bytes = await file.arrayBuffer();
      } catch (e) {
        notice("读取图片失败", "error");
        return null;
      }
      try {
        return { mime, bytes, dataUrl: imageDataUrl(bytes, mime), desc: "" };
      } catch (e) {
        notice(String((_b = (_a = e == null ? void 0 : e.message) != null ? _a : e) != null ? _b : "图片不可用"), "error");
        return null;
      }
    }
    /** 删掉第 i 张（缩略图上的 ✕）：同样作废已有草稿（图组变了） */
    removeEntryImage(i) {
      if (!Number.isInteger(i) || i < 0 || i >= this.entryImages.length) return;
      if (this.termGenerating) return;
      this.entryImages.splice(i, 1);
      this.renderEntryImage();
      this.draftInvalidate();
    }
    /** 草稿失效（图组 / 输入变了）：预览收起、生成按钮复位、关联行归位到「待写入」 */
    draftInvalidate() {
      this.termPreview = null;
      this.termHasDraft = false;
      this.setTermPreviewVisible(false);
      this.setTermGenLoading(false);
      this.resetEntryRel();
    }
    /** 把 DOM 上的逐图描述框值同步回内存图项——只在索引不变的时机调用（加图前/生成前/写入前）；
     *  删图后剩余项索引前移，旧 DOM 索引会错位覆写，故 removeEntryImage 路径绝不走这里。 */
    syncImageDescsFromDom() {
      if (!this.termPopup) return;
      this.termPopup.querySelectorAll("[data-lit-image-desc]").forEach((inp) => {
        const i = Number(inp.getAttribute("data-lit-image-desc"));
        if (Number.isInteger(i) && i >= 0 && i < this.entryImages.length) this.entryImages[i].desc = inp.value;
      });
    }
    /**
     * 图片行渲染：有图显示缩略图网格（每张带 ✕ 与逐图描述框，可继续加），无图回到提示文案。
     * 描述框（ADR-0145）：每张图一个（单图即一框），属图片项——删图连描述一起没。
     * 注意：这里**不做** DOM→内存的描述同步——删图后剩余项索引前移，旧 DOM 索引会错位覆写；
     * 同步只在索引不变的时机做（加图前 / 生成前 / 写入前，见 syncImageDescsFromDom 调用点）。
     */
    renderEntryImage() {
      if (!this.termPopup) return;
      const grid = q(this.termPopup, "#lit-image-grid");
      const hint = q(this.termPopup, "#lit-image-hint");
      const list = this.entryImages;
      if (grid) {
        if (list.length) {
          grid.style.display = "";
          grid.innerHTML = list.map((im, i) => `<div class="bz-lit-drop-item">
            <img src="${im.dataUrl}" alt="">
            <button type="button" data-lit-image-remove="${i}" title="移除这张" aria-label="移除这张">${iconSpan("x")}</button>
            <input type="text" class="bz-lit-drop-desc" data-lit-image-desc="${i}" placeholder="图注（可选）" value="${esc(im.desc || "")}">
          </div>`).join("");
          mountIcons(grid);
        } else {
          grid.style.display = "none";
          grid.innerHTML = "";
        }
      }
      if (hint) {
        hint.textContent = list.length ? `已放 ${list.length} 张 · 继续拖入 / 粘贴，或点此添加` : "拖入图片，或 Ctrl+V 粘贴截图（可多张）";
      }
    }
    /** 图片状态清空（关面板 / 重开 / 写入完成后）——内存里的字节一并丢掉，不留孤儿文件 */
    clearEntryImage() {
      this.entryImages = [];
      this.renderEntryImage();
    }
    /** 来源状态清空（chip 收起、输入框复位、计时器/联想层归零）——每次打开弹层即全新 */
    termSrcReset(input) {
      if (this.termSrcTimer) {
        clearTimeout(this.termSrcTimer);
        this.termSrcTimer = null;
      }
      this.termSource = null;
      if (input) {
        input.value = "";
        input.style.display = "";
      }
      this.renderTermSrcChip(input);
      this.termSrcRefreshMeta();
    }
    termSrcClear(input) {
      this.termSrcReset(input);
      if (input) setTimeout(() => input.focus(), 0);
    }
    /** 输入惰性提交：整串 URL 字样 → 外部 chip；其余文本等联想点选（不自动认领） */
    termSrcTryCommit(input) {
      this.termSrcTimer = null;
      const raw = (input.value || "").trim();
      if (!raw || !isUrlLikeSourceText(raw)) return;
      this.termSrcSet({ kind: "external", url: normalizeSourceUrl(raw) }, input);
    }
    /** 落来源：记录 + chip 渲染 + meta 行同步；外部来源异步抓标题（已有 title（如剪藏本预填）不重复抓；失败静默降级为纯链接） */
    termSrcSet(src, input) {
      this.termSource = src;
      this.renderTermSrcChip(input);
      this.termSrcRefreshMeta();
      if (src.kind === "external" && !src.title) void this.termSrcFetchTitle(src);
    }
    async termSrcFetchTitle(src) {
      try {
        const t = await fetchPageTitle(src.url);
        if (!t || this.termSource !== src) return;
        src.title = cleanSourceTitle(t);
        const inp = this.termPopup ? q(this.termPopup, "#lit-term-src") : null;
        this.renderTermSrcChip(inp);
        this.termSrcRefreshMeta();
      } catch (e) {
      }
    }
    /** chip 渲染：有来源 → 徽标（内/外）+ 名称 + ✕；无 → 输入框可见 */
    renderTermSrcChip(input) {
      const popup = this.termPopup;
      if (!popup) return;
      const chip2 = q(popup, "#lit-term-src-chip");
      if (!chip2) return;
      const src = this.termSource;
      if (!src) {
        chip2.style.display = "none";
        chip2.textContent = "";
        if (input) input.style.display = "";
        return;
      }
      const isNote = src.kind === "note";
      const label = isNote ? noteSourceName(src.path) : src.title || shortUrlText(src.url);
      chip2.title = isNote ? src.path : src.url;
      chip2.style.display = "inline-flex";
      chip2.innerHTML = `<b>${isNote ? "内 部" : "外 部"}</b><span>${esc(label)}</span><button type="button" data-term-src-clear title="清除来源" aria-label="清除来源">✕</button>`;
      if (input) input.style.display = "none";
    }
    /** 预览属性卡第 4 行「来源」：有来源显行（可点开），无来源隐行 */
    termSrcRefreshMeta() {
      const popup = this.termPopup;
      if (!popup) return;
      const row = q(popup, "#lit-term-meta-srcrow");
      const val = q(popup, "#lit-term-meta-src");
      if (!row || !val) return;
      const src = this.termSource;
      if (!src) {
        row.style.display = "none";
        val.textContent = "";
        return;
      }
      row.style.display = "";
      val.textContent = src.kind === "note" ? noteSourceName(src.path) : src.title || src.url;
      val.title = src.kind === "note" ? src.path : src.url;
    }
    setTermPreviewVisible(v) {
      if (!this.termPopup) return;
      const p = q(this.termPopup, "#lit-term-preview");
      if (p) p.style.display = v ? "flex" : "none";
    }
    setTermGenLoading(loading) {
      if (!this.termPopup) return;
      const gen = q(this.termPopup, "#lit-term-generate");
      if (gen) {
        gen.disabled = loading;
        gen.textContent = loading ? "生成中…" : this.termHasDraft ? "重新生成" : "生成";
      }
      const regen = q(this.termPopup, "#lit-term-regenerate");
      if (regen) regen.disabled = loading;
      const save = q(this.termPopup, "#lit-term-save");
      if (save) save.disabled = loading;
    }
    /**
     * 关联行渲染（issue 309）：按 entryRelState 出文案与墨色档；两类录入共用同一行。
     * loading 态给一条滑动的墨色小条 + 「分析中…」——建链要跑近邻检索与 AI 裁判，
     * 面板必须让「正在跑」这件事看得见（而不是一行静止的灰字）。
     */
    entryRelRefresh() {
      const el = this.termPopup ? q(this.termPopup, "#lit-term-meta-rel") : null;
      if (!el) return;
      el.className = "bz-lit-term-meta-v";
      const st = this.entryRelState;
      if (st === "loading") {
        el.classList.add("bz-lit-rel-idle");
        el.innerHTML = '<span class="bz-lit-rel-bar" aria-hidden="true"></span>分析中…';
        return;
      }
      if (st === "done") {
        el.classList.add("bz-lit-rel-ok");
        el.textContent = this.entryRelText || "已建立关联";
        return;
      }
      if (st === "empty") {
        el.classList.add("bz-lit-rel-idle");
        el.textContent = "暂无关联";
        return;
      }
      if (st === "queued") {
        el.classList.add("bz-lit-rel-idle");
        el.textContent = "向量服务不可达，已入队";
        return;
      }
      if (st === "failed") {
        el.classList.add("bz-lit-rel-err");
        el.textContent = "关联失败";
        return;
      }
      if (st === "off") {
        el.classList.add("bz-lit-rel-idle");
        el.textContent = "自动双链未开启";
        return;
      }
      el.classList.add("bz-lit-rel-idle");
      el.textContent = "—";
    }
    /** 关联行与预演状态整体复位（打开/关闭面板、出新草稿、重生成/总结点下时共用）：abort 在途请求、结果清空、回到起点 */
    resetEntryRel() {
      var _a;
      this.entryRelSeq++;
      (_a = this.entryRelAbort) == null ? void 0 : _a.abort();
      this.entryRelAbort = null;
      this.entryPreviewPicks = [];
      this.entryPreviewDone = false;
      this.entryRelText = "";
      this.setEntryRel("idle");
    }
    /** 关联行状态切换（单一出口，避免各处直接改字段后忘记重绘） */
    setEntryRel(st) {
      this.entryRelState = st;
      this.entryRelRefresh();
    }
    /**
     * 关联预演（issue 309）：AI 出内容后**立刻**跑——近邻检索 + AI 裁判，**只算不写**（草稿尚未落盘，
     * 故走 preview 而非 now）。属性区「关联」行就地走 loading → 关联名，这正是「生成完就看得到过程」。
     * 序号守卫：重新生成 / 关面板让在途结果作废，晚到的响应不得覆盖新状态。
     * issue 327：起跑前 abort 上一轮（真中断，不白烧 token）；分析期间**不锁任何按钮**——
     * 重新生成 / 总结随点随断随重跑，确认写入转后台。
     */
    async runEntryRelPreview(content, title) {
      var _a;
      const bridge = getLinkBridge();
      const seq = ++this.entryRelSeq;
      this.entryPreviewPicks = [];
      if (!bridge) {
        this.setEntryRel("off");
        return;
      }
      (_a = this.entryRelAbort) == null ? void 0 : _a.abort();
      const ac = new AbortController();
      this.entryRelAbort = ac;
      this.entryRelText = "";
      this.setEntryRel("loading");
      try {
        const out = await bridge.preview(content, title, { signal: ac.signal });
        if (seq !== this.entryRelSeq) return;
        if (out.status === "done") {
          this.entryPreviewDone = true;
          this.entryPreviewPicks = out.picks.map((p) => p.path);
          this.entryRelText = out.picks.map((p) => p.title).join(" · ");
          this.setEntryRel(out.picks.length ? "done" : "empty");
        } else if (out.status === "queued") this.setEntryRel("queued");
        else if (out.status === "skipped") this.setEntryRel("off");
        else this.setEntryRel("failed");
      } catch (e) {
        if (seq === this.entryRelSeq) this.setEntryRel("failed");
      }
    }
    /**
     * 确认写入后的关联落库（issue 309 / 327 改版）：**全程不动关联行**——面板上显示过什么就是什么，
     * 不把行打回 loading（那会被读成「又在重新分析」，实际只是本地写 related）。
     * - 预演 done 有命中 → apply 落库（不重跑检索与裁判）；
     * - 预演 done 零命中（确定「无关联」）→ 无可写；
     * - 预演仍在分析 → 作废面板绑定的这次（省 token），后台重起 预演→apply，挂动态通知；
     * - 预演 failed → 兜底 now 同样转后台；
     * - 通道未接线 / off → 无可写。
     */
    async commitEntryLinks(path) {
      var _a, _b, _c;
      const bridge = getLinkBridge();
      if (!bridge) return;
      if (this.entryRelState === "loading") {
        (_a = this.entryRelAbort) == null ? void 0 : _a.abort();
        this.entryRelAbort = null;
        void this.backgroundRelCommit(path, (_c = (_b = this.termPreview) == null ? void 0 : _b.body) != null ? _c : "", this.entryHeadTitle());
        return;
      }
      if (this.entryPreviewDone && !this.entryPreviewPicks.length) return;
      if (this.entryPreviewPicks.length) {
        await bridge.apply(path, this.entryPreviewPicks);
        return;
      }
      if (this.entryRelState === "failed") void this.backgroundRelNow(path);
    }
    /**
     * 后台建链（issue 327）：分析中确认写入 / 预演失败兜底共用——不占面板，动态通知（同键原地更新）
     * 报进度与结果：分析中… → 已写入 N 条 / 未发现实质关联 / 已入队 / 失败原因。
     */
    async backgroundRelCommit(path, content, title) {
      const bridge = getLinkBridge();
      if (!bridge) return;
      notify("知识盒关联：后台分析中…", { type: "progress", dedupeKey: REL_BG_NOTICE_KEY });
      try {
        const out = await bridge.preview(content, title);
        if (out.status === "skipped") {
          notify("知识盒关联：自动关联未开启，未写入", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
          return;
        }
        if (out.status === "queued") {
          notify("知识盒关联：向量服务不可达，已入队，服务可达后自动处理", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
          return;
        }
        if (out.status === "failed") {
          notify(`知识盒关联失败：${out.error || "未知错误"}`, { type: "error", dedupeKey: REL_BG_NOTICE_KEY });
          return;
        }
        if (!out.picks.length) {
          notify("知识盒关联：未发现实质关联", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
          return;
        }
        const r = await bridge.apply(path, out.picks.map((p) => p.path));
        notify(r.status === "done" ? `知识盒关联：已写入 ${r.created} 条关联` : "知识盒关联：自动关联未开启，未写入", {
          type: r.status === "done" ? "success" : "info",
          dedupeKey: REL_BG_NOTICE_KEY
        });
      } catch (e) {
        notify(`知识盒关联失败：${e instanceof Error ? e.message : String(e)}`, { type: "error", dedupeKey: REL_BG_NOTICE_KEY });
      }
    }
    /** 后台兜底建链（issue 327）：预演失败时的 bridge.now 完整管线，通知口径同 backgroundRelCommit */
    async backgroundRelNow(path) {
      const bridge = getLinkBridge();
      if (!bridge) return;
      notify("知识盒关联：后台建链中…", { type: "progress", dedupeKey: REL_BG_NOTICE_KEY });
      try {
        const out = await bridge.now(path);
        if (out.status === "done" || out.status === "skipped-related") {
          const created = out.status === "done" ? out.created : 0;
          notify(created > 0 ? `知识盒关联：已写入 ${created} 条关联` : "知识盒关联：未发现实质关联", {
            type: created > 0 ? "success" : "info",
            dedupeKey: REL_BG_NOTICE_KEY
          });
        } else if (out.status === "queued") {
          notify("知识盒关联：向量服务不可达，已入队，服务可达后自动处理", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
        } else if (out.status === "out-of-scope") {
          notify("知识盒关联：该笔记不在三个盒子内，未写入", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
        } else if (out.status === "failed") {
          notify(`知识盒关联失败：${out.error}`, { type: "error", dedupeKey: REL_BG_NOTICE_KEY });
        } else {
          notify("知识盒关联：自动关联未开启，未写入", { type: "info", dedupeKey: REL_BG_NOTICE_KEY });
        }
      } catch (e) {
        notify(`知识盒关联失败：${e instanceof Error ? e.message : String(e)}`, { type: "error", dedupeKey: REL_BG_NOTICE_KEY });
      }
    }
    setTermSummarizing(s) {
      if (!this.termPopup) return;
      const regen = q(this.termPopup, "#lit-term-regenerate");
      if (regen) {
        regen.disabled = s;
        regen.textContent = s ? "总结中…" : "总结";
      }
      const save = q(this.termPopup, "#lit-term-save");
      if (save) save.disabled = s;
      const gen = q(this.termPopup, "#lit-term-generate");
      if (gen) gen.disabled = s;
    }
    /** 当前录入的头部标题：段落取属性卡里（可改）的标题，名词取输入框的词 */
    entryHeadTitle() {
      var _a, _b, _c, _d;
      if (!this.termPopup) return "";
      return this.entryTitled ? ((_b = (_a = q(this.termPopup, "#lit-entry-meta-title")) == null ? void 0 : _a.value) != null ? _b : "").trim() : ((_d = (_c = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _c.value) != null ? _d : "").trim();
    }
    /** 属性首行是否「可改标题」态（段落 / 图版共用；名词的属性首行是只读的名词文本） */
    get entryTitled() {
      return this.entryMode === "passage" || this.entryMode === "image";
    }
    noticeTermError(e) {
      const msg = String(e && e.message || e || "未知错误");
      if (/API Key|AI 配置|未配置/.test(msg)) {
        notice("未配置 AI：请到插件设置「AI 配置」页填 API Key 后再生成", "error");
      } else {
        notice("生成失败：" + msg, "error");
      }
    }
    async onTermGenerate() {
      var _a, _b, _c, _d;
      if (!this.termPopup || this.termGenerating) return;
      const mode = this.entryMode;
      if (mode === "image") {
        await this.onImageGenerate();
        return;
      }
      const passage = mode === "passage";
      const text = passage ? ((_b = (_a = q(this.termPopup, "#lit-passage-input")) == null ? void 0 : _a.value) != null ? _b : "").trim() : ((_d = (_c = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _c.value) != null ? _d : "").trim();
      if (!text) {
        notice(passage ? "请粘贴要整理的段落" : "请输入名词", "error");
        return;
      }
      this.resetEntryRel();
      this.termGenerating = true;
      this.setTermGenLoading(true);
      try {
        const draft = passage ? await generatePassageDraft(text) : await generateTermDraft(text);
        this.presentTermPreview(draft);
        this.runEntryRelPreview(draft.summary, this.entryHeadTitle() || text);
      } catch (e) {
        this.noticeTermError(e);
      } finally {
        this.termGenerating = false;
        this.setTermGenLoading(false);
      }
    }
    /**
     * 图版读图（issue 312；多图 issue 313）：图片 data URL 列表一次投给多模态模型
     * （core/ai 的 `{text, images}` 通道），出标题 / 领域 / 解读正文后与其余两态走同一套预览 + 关联预演。
     */
    async onImageGenerate() {
      if (!this.termPopup || this.termGenerating) return;
      this.syncImageDescsFromDom();
      const images = this.entryImages;
      if (!images.length) {
        notice("请先拖入或粘贴图片", "error");
        return;
      }
      this.resetEntryRel();
      this.termGenerating = true;
      this.setTermGenLoading(true);
      try {
        const draft = await generateImageDraft(images.map((im) => im.dataUrl), images.map((im) => im.desc));
        this.presentTermPreview(draft);
        this.runEntryRelPreview(draft.summary, this.entryHeadTitle());
      } catch (e) {
        this.noticeTermError(e);
      } finally {
        this.termGenerating = false;
        this.setTermGenLoading(false);
      }
    }
    async onTermSummarize() {
      if (!this.termPopup || this.termSummarizing || this.termGenerating) return;
      if (!this.termPreview || !this.termPreview.body.trim()) {
        notice("请先生成简介", "info");
        return;
      }
      this.resetEntryRel();
      this.termSummarizing = true;
      this.setTermSummarizing(true);
      try {
        const summarized = await summarizeTermSummary(this.termPreview.body);
        this.termPreview.body = summarized;
        const contentEl = q(this.termPopup, "#lit-term-content");
        if (contentEl) contentEl.textContent = summarized;
        this.runEntryRelPreview(summarized, this.entryHeadTitle());
      } catch (e) {
        this.noticeTermError(e);
      } finally {
        this.termSummarizing = false;
        this.setTermSummarizing(false);
      }
    }
    presentTermPreview(draft) {
      var _a, _b, _c;
      this.termPreview = { domain: draft.domain, body: draft.summary, title: draft.title };
      this.termHasDraft = true;
      if (!this.termPopup) return;
      if (this.entryTitled) {
        const titleInput = q(this.termPopup, "#lit-entry-meta-title");
        if (titleInput) titleInput.value = draft.title || "";
      } else {
        const term = ((_b = (_a = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _a.value) != null ? _b : "").trim();
        const termEl = q(this.termPopup, "#lit-term-meta-term");
        if (termEl) termEl.textContent = term || "—";
      }
      const domainEl = q(this.termPopup, "#lit-term-meta-domain");
      if (domainEl) domainEl.textContent = draft.domain || "—";
      const dateEl = q(this.termPopup, "#lit-term-meta-date");
      if (dateEl) dateEl.textContent = dateStamp();
      const contentEl = q(this.termPopup, "#lit-term-content");
      if (contentEl) contentEl.textContent = draft.summary;
      this.resetEntryRel();
      this.setTermPreviewVisible(true);
      const prev = q(this.termPopup, "#lit-term-preview");
      (_c = prev == null ? void 0 : prev.scrollIntoView) == null ? void 0 : _c.call(prev, { behavior: "smooth", block: "nearest" });
    }
    async onTermConfirm() {
      var _a, _b, _c, _d;
      if (!this.termPopup || this.termGenerating) return;
      const mode = this.entryMode;
      const source2 = this.termSource;
      if (!this.termPreview) {
        notice("请先点击「生成」获取预览", "info");
        return;
      }
      const summary = this.termPreview.body;
      const domain = this.termPreview.domain;
      let term = "";
      let title = "";
      if (this.entryTitled) {
        title = ((_b = (_a = q(this.termPopup, "#lit-entry-meta-title")) == null ? void 0 : _a.value) != null ? _b : "").trim();
        if (!title) {
          notice("标题不能为空", "error");
          return;
        }
      } else {
        term = ((_d = (_c = q(this.termPopup, "#lit-term-input")) == null ? void 0 : _c.value) != null ? _d : "").trim();
        if (!term) {
          notice("请输入名词", "error");
          return;
        }
        const dup = findDuplicateTermNote(term);
        if (dup) {
          notice("已存在同名文献笔记：" + dup, "error");
          return;
        }
      }
      this.syncImageDescsFromDom();
      const images = this.entryImages;
      if (mode === "image" && !images.length) {
        notice("图片已丢失，请重新拖入", "error");
        return;
      }
      const onCreated = this.entryOnCreated;
      this.termGenerating = true;
      this.setTermGenLoading(true);
      const save = q(this.termPopup, "#lit-term-save");
      if (save) save.textContent = "写入中…";
      try {
        let path;
        if (mode === "image") {
          path = await generateImageNote({
            title,
            summary,
            domain,
            source: source2,
            images: images.map((im) => ({ bytes: im.bytes, ext: imageExtOfMime(im.mime) || "png", desc: String(im.desc || "").trim() }))
          });
          emitDomainEvent("knowledge:tasks", { kind: "image-generated", title, notePath: path });
          await this.commitEntryLinks(path);
          this.clearEntryImage();
          notice("已生成图版文献笔记：" + title, "success");
        } else {
          path = mode === "passage" ? await generatePassageNote({ title, summary, domain, source: source2 }) : await generateTermNote({ term, summary, domain, source: source2 });
          emitDomainEvent("knowledge:tasks", mode === "passage" ? { kind: "passage-generated", title, notePath: path } : { kind: "term-generated", term, title: term, notePath: path });
          await this.commitEntryLinks(path);
          notice(mode === "passage" ? "已生成段落文献笔记：" + title : "已生成名词文献笔记：" + term, "success");
        }
        this.hideTermEntry();
        if (onCreated) {
          try {
            onCreated(path);
          } catch (e) {
            console.warn("[knowledge] onCreated 回调失败（笔记已写入）", e);
          }
        } else {
          this.openNote(path);
        }
      } catch (e) {
        this.noticeTermError(e);
      } finally {
        this.termGenerating = false;
        if (save) save.textContent = "确认写入";
        this.setTermGenLoading(false);
      }
    }
    hideTermEntry() {
      this.termPreview = null;
      this.entryOnCreated = null;
      this.resetEntryRel();
      this.clearEntryImage();
      this.resetTermDupHint();
      const srcInput = this.termPopup ? q(this.termPopup, "#lit-term-src") : null;
      this.termSrcReset(srcInput);
      if (this.termMask) this.termMask.style.display = "none";
      if (this.termPopup) this.termPopup.style.display = "none";
      void this.refreshCurrent();
    }
    /**
     * 同壳三态脏判定（issue 326 关闭二次确认）：当前态输入非空 / 已有预览 / 生成中 / 图版有内存图，
     * 任一即脏。来源行**单独不算脏**——命令入口本就预填来源（ADR-0116），一打开就关就弹确认是骚扰。
     */
    entryDirty() {
      if (!this.termPopup) return false;
      if (this.termGenerating || this.termPreview) return true;
      if (this.entryMode === "image") return this.entryImages.length > 0;
      const el = this.entryMode === "passage" ? q(this.termPopup, "#lit-passage-input") : q(this.termPopup, "#lit-term-input");
      return !!(el && el.value.trim());
    }
    /** 录入面板关闭请求（issue 326）：脏 → 风格化二次确认（ADR-0125 统一壳 + 知识盒域皮）；干净态直关。
     *  遮罩点击与 ESC 都走这里；确认写入成功路径直接调 hideTermEntry（不自带确认）。 */
    requestTermClose() {
      if (!this.entryDirty()) {
        this.hideTermEntry();
        return;
      }
      const what = this.entryMode === "image" ? "图片" : this.entryMode === "passage" ? "段落" : "名词";
      confirmDiscard(() => this.hideTermEntry(), `${what}还没生成写入，关闭后将丢失`, "kb bz-kb-flow-dialog");
    }
    /** 影像录入弹窗关闭请求（issue 326）：用户动过表单（addDirty 事件打标）→ 二次确认；纯打开未动 → 直关。
     *  保存成功路径直接调 hideAddDialog（刚落库无可丢）。 */
    requestAddClose() {
      if (this.addDirty) confirmDiscard(() => this.hideAddDialog(), "影像信息还没保存，关闭后将丢失", "kb bz-kb-flow-dialog");
      else this.hideAddDialog();
    }
    // ==================== 通用小工具 ====================
    openNote(path) {
      const app = getApp();
      const file = app.vault.getAbstractFileByPath(path);
      if (file) {
        void app.workspace.getLeaf(false).openFile(file);
        this.hideMain();
        this.hideVideo();
      } else {
        notice("文献笔记不存在：" + path, "error");
      }
    }
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        notice("已复制：" + text, "success");
      } catch (e) {
        notice("复制失败", "error");
      }
    }
    _openExternal(url) {
      const app = getApp();
      try {
        app.openUrl(url);
      } catch (e) {
        const w = window;
        const electron = w.require && w.require("electron");
        if (electron && electron.shell) electron.shell.openExternal(url);
      }
    }
    destroy() {
      var _a;
      this.clearRunTimer();
      this.runState.clear();
      if (this.termSrcTimer) {
        clearTimeout(this.termSrcTimer);
        this.termSrcTimer = null;
      }
      this.addUrlReset();
      try {
        (_a = this.termSrcSuggest) == null ? void 0 : _a.detach();
      } catch (e) {
      }
      this.termSrcSuggest = null;
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      for (const unsub of this.fileListenerRefs) {
        try {
          unsub();
        } catch (e) {
        }
      }
      this.fileListenerRefs = [];
      this.fileListenerAttached = false;
      document.removeEventListener("keydown", this.onKeydown);
      document.removeEventListener("paste", this.onPaste);
      this.onPaste = () => {
      };
      this.termPreview = null;
      this.entryImages = [];
      this.entryOnCreated = null;
      for (const el of [this.mask, this.popup, this.videoMask, this.videoPopup, this.addMask, this.addPopup, this.termMask, this.termPopup, this.previewHostEl]) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      this.previewHostEl = null;
      this.mask = null;
      this.popup = null;
      this.contentEl = null;
      this.videoMask = null;
      this.videoPopup = null;
      this.videoList = null;
      this.addMask = null;
      this.addPopup = null;
      this.termMask = null;
      this.termPopup = null;
    }
  };

  // prototypes/knowledge/fake-sim.ts
  var SEED_MARKER = "bz-sim:__kb_seed_v3";
  var key = (path) => `bz-sim:${path}`;
  var SEED_TASKS = [
    {
      id: "kb-demo-processing",
      url: "https://www.bilibili.com/video/BV1awbg6XELn/",
      start: "00:00:00",
      end: "00:12:00",
      status: "processing",
      reason: "AI 生成文献笔记中",
      remark: null,
      notePath: null,
      videoPath: null,
      created: "2026-09-13 21:40:12",
      processedAt: null,
      title: "CBTI：告别失眠的认知行为疗法",
      uploader: "演示 UP 主",
      archived: false,
      archivedAt: null,
      quality: "1080",
      page: 1,
      duration: 720
    },
    {
      id: "kb-demo-pending-info",
      url: "https://www.bilibili.com/video/BV1mepartial01/",
      start: "00:01:30",
      end: "00:04:00",
      status: "pending",
      reason: null,
      remark: "睡前看的那期",
      notePath: null,
      videoPath: null,
      created: "2026-09-13 22:05:40",
      processedAt: null,
      title: "（演示）多 P 视频 · 只看中集片段",
      uploader: "演示 UP 主",
      archived: false,
      archivedAt: null,
      quality: "720",
      page: 2,
      duration: 600
    },
    {
      id: "kb-demo-pending-bare",
      url: "https://www.bilibili.com/video/BV1nometadata/",
      start: null,
      end: null,
      status: "pending",
      reason: null,
      remark: null,
      notePath: null,
      videoPath: null,
      created: "2026-09-14 08:02:11",
      processedAt: null,
      title: null,
      uploader: null,
      archived: false,
      archivedAt: null,
      quality: null,
      page: null,
      duration: null
    },
    {
      id: "kb-demo-failed",
      url: "https://www.bilibili.com/video/BV1failcase01/",
      start: null,
      end: null,
      status: "failed",
      reason: "yt-dlp 下载失败：HTTP Error 403 Forbidden（示例原因，评审壳不真跑管线）",
      remark: null,
      notePath: null,
      videoPath: null,
      created: "2026-09-13 19:20:00",
      processedAt: "2026-09-13 19:21:35",
      title: "（演示）一条失败的任务",
      uploader: "演示 UP 主",
      archived: false,
      archivedAt: null,
      quality: null,
      page: null,
      duration: 1800
    },
    {
      id: "kb-demo-arch-1",
      url: "https://www.bilibili.com/video/BV1awbg6XELn/",
      start: null,
      end: null,
      status: "success",
      reason: null,
      remark: null,
      notePath: "文献盒/CBTI.md",
      videoPath: "CONFIG/APPENDIX/CBTI演示.mp4",
      created: "2026-09-04 07:40:00",
      processedAt: "2026-09-04 07:47:38",
      title: "CBTI：告别失眠的认知行为疗法",
      uploader: "演示 UP 主",
      archived: true,
      archivedAt: "2026-09-04 07:47:38",
      quality: "highest",
      page: null,
      duration: 1800
    },
    {
      id: "kb-demo-arch-2",
      url: "https://www.bilibili.com/video/BV1awbg6XELn/",
      start: "00:12:00",
      end: "00:20:00",
      status: "success",
      reason: null,
      remark: null,
      notePath: "文献盒/CBTI 睡眠限制一节.md",
      videoPath: "CONFIG/APPENDIX/CBTI-切片.mp4",
      created: "2026-09-10 22:30:00",
      processedAt: "2026-09-10 22:41:07",
      title: "CBTI：告别失眠的认知行为疗法",
      uploader: "演示 UP 主",
      archived: true,
      archivedAt: "2026-09-10 22:41:07",
      quality: "1080",
      page: null,
      duration: 1800
    },
    {
      id: "kb-demo-arch-3",
      url: "https://www.bilibili.com/video/BV1sleepless9/",
      start: null,
      end: null,
      status: "success",
      reason: null,
      remark: null,
      notePath: "文献盒/昼夜节律.md",
      videoPath: "CONFIG/APPENDIX/昼夜节律.mp4",
      created: "2026-09-03 21:00:00",
      processedAt: "2026-09-03 21:10:00",
      title: "（演示）昼夜节律与睡眠",
      uploader: "另一演示 UP 主",
      archived: true,
      archivedAt: "2026-09-03 21:10:00",
      quality: "720",
      page: null,
      duration: 900
    }
  ];
  var SEED_NOTES = [
    {
      path: "文献盒/CBTI.md",
      ctime: Date.parse("2026-09-04T07:47:38"),
      content: `---
title: "CBTI 即针对失眠的认知行为疗法"
tags:
  - "睡眠"
  - "心理学"
summary: "非药物治疗失眠的循证心理干预，重建健康睡眠模式。"
url: "https://www.bilibili.com/video/BV1awbg6XELn/"
date: "2026-09-04 07:47:38"
author: "演示 UP 主"
videoTitle: "CBTI：告别失眠的认知行为疗法"
type: video
domain: "心理"
related:
  - "[[卡片盒/多重记忆系统|多重记忆系统]]"
  - "[[卡片盒/认知行为疗法|认知行为疗法]]"
---

CBTI 即针对失眠的认知行为疗法，是一种非药物治疗失眠的循证心理干预方法。其核心观点认为：失眠的持续与**不良的睡眠认知和行为习惯**密切相关，通过改变这些因素来重建健康的睡眠模式。

## 核心模块

- **睡眠限制**——压缩卧床时间，提高睡眠效率
- **刺激控制**——把床留给睡眠
- 认知重构、放松训练与睡眠卫生教育

> 大量临床研究证实：CBTI 对慢性失眠具有显著且持久的疗效，被国际指南推荐为成人慢性失眠的一线治疗。

![[CONFIG/APPENDIX/CBTI演示.mp4]]`
    },
    {
      path: "文献盒/既视感.md",
      ctime: Date.parse("2026-09-04T07:00:00"),
      content: `---
title: "既视感"
type: term
domain: "心理"
term: "既视感"
date: "2026-09-04 07:47:38"
---

既视感，又称"似曾相识感"，指经历全新情境时产生的主观熟悉感，仿佛此事曾发生过，实为大脑信息处理中的错觉。它与颞叶活动异常、识别与记忆系统短暂错位有关，在疲劳、压力大时更常见，也可能是癫痫等神经系统疾病的前兆。`
    },
    {
      path: "文献盒/昼夜节律.md",
      ctime: Date.parse("2026-09-03T21:10:00"),
      content: `---
title: "昼夜节律"
type: term
domain: "心理"
term: "昼夜节律"
date: "2026-09-03 21:10:00"
source: "https://zhuanlan.zhihu.com/p/12345678"
sourceTitle: "什么是昼夜节律"
---

生物体以约 24 小时为周期的内在计时机制，由视交叉上核主导，调控睡眠-觉醒、体温与激素分泌；光照是最强的同步因子。`
    },
    {
      path: "文献盒/松果体.md",
      ctime: Date.parse("2026-08-28T10:00:00"),
      content: `---
title: "松果体"
type: term
domain: "医学"
term: "松果体"
date: "2026-08-28 10:00:00"
---

松果体是大脑内豌豆大小的内分泌腺，夜间分泌褪黑素，把光照信息转译为激素信号，是睡眠-觉醒节律的激素执行器。`
    },
    {
      path: "卡片盒/多重记忆系统.md",
      ctime: Date.parse("2026-09-05T09:00:00"),
      content: `---
tags: []
category: "心理"
related:
  - "[[文献盒/CBTI.md|CBTI]]"
date: "2026-09-05 09:00:00"
---

多重记忆系统：陈述性与程序性记忆分属不同系统。与 CBTI 关联——睡眠结构对记忆巩固的影响是这条连接的解释。`
    },
    {
      path: "卡片盒/认知行为疗法.md",
      ctime: Date.parse("2026-09-05T08:30:00"),
      content: `---
tags: []
category: "心理"
related:
  - "[[文献盒/CBTI.md|CBTI]]"
date: "2026-09-05 08:30:00"
---

认知行为疗法：通过改变认知与行为模式干预心理问题。CBTI 是其在失眠域的具体形态。`
    },
    {
      path: "卡片盒/间隔重复.md",
      ctime: Date.parse("2026-09-01T12:00:00"),
      content: `---
tags: []
category: "学习"
related: []
date: "2026-09-01 12:00:00"
---

间隔重复：按遗忘曲线安排复习间隔，用检索 effort 换长期保持。`
    },
    {
      path: "主题盒/认知觉醒.md",
      ctime: Date.parse("2026-08-20T09:00:00"),
      content: `# 认知觉醒

大脑的本能脑、情绪脑与理智脑三层结构……（主题笔记就是普通笔记，自己写自己组织。）`
    },
    {
      path: "我的/读书笔记/心流体验.md",
      ctime: Date.parse("2026-08-15T09:00:00"),
      content: `# 心流体验

心流（flow）：全情投入、忘却时间的最优体验状态——术语录入「内部笔记来源」的联想目标。`
    }
  ];
  var SEED_MOUNT_NOTES = [
    {
      path: "卡片盒/睡眠结构.md",
      ctime: Date.parse("2026-09-12T21:10:00"),
      content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 睡眠结构是一夜里各睡眠阶段的组成与轮转：非快速眼动与快速眼动交替，约九十分钟一个周期。)

## 分期

- N1/N2 是浅睡，[[睡眠纺锤波]] 出现在 N2
- N3 又叫 [[慢波睡眠]]，高幅 delta 波占两成以上
- [[快速眼动睡眠]] 眼球快速转动、肌张力消失，梦多在这一段

## 一夜的周期

成年人一夜走四到六个周期。深睡集中在头两个周期，管体力恢复；快速眼动在后半程补量，跟 [[记忆巩固]] 的关系更紧一些。

什么时候想睡由 [[昼夜节律]] 定，有多想睡由睡眠压定，两套机制叠起来才是困意曲线。

![[CONFIG/APPENDIX/CBTI演示.mp4]]

早上晒光这一节我一直没整理成卡，先记一笔 [[晨间光照方案]]。`
    },
    {
      path: "卡片盒/慢波睡眠.md",
      ctime: Date.parse("2026-09-12T20:40:00"),
      content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 慢波睡眠（N3）即深睡，脑电以高幅低频的 delta 波为主，生长激素在这一段脉冲式分泌。)

深睡与 [[快速眼动睡眠]] 的分工不可互相替代：砍掉深睡第二天会累，砍掉快速眼动会「心里发空」。

它跟 [[记忆巩固]] 的接口在海马：慢波期的尖波涟漪把白天的经历反复重放。

深睡占比随年龄掉得很快——二十岁前后约两成，六十岁后常不足一成，这就是「年纪大了觉变浅」的生理来源。

![[文献盒/assets/睡眠周期图.png]]`
    },
    {
      path: "卡片盒/快速眼动睡眠.md",
      ctime: Date.parse("2026-09-12T20:10:00"),
      content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 快速眼动睡眠（REM）眼球快速转动、肌张力几乎消失，脑电接近清醒但人不易被叫醒。)

它的时长在后半夜显著拉长，所以熬夜被砍掉的大多是这一段，情绪加工与联想的损失比「少睡几小时」更大。

与 [[记忆巩固]]、[[慢波睡眠]] 不是一回事：那一套管陈述性记忆，这一套管情绪与模式的重新组合。

失眠的人为什么总说「睡了一夜比没睡还累」，可以对着 [[文献盒/CBTI#核心模块|CBTI · 核心模块]] 里的几条看。`
    },
    {
      path: "卡片盒/记忆巩固.md",
      ctime: Date.parse("2026-09-09T21:30:00"),
      content: `---
tags: [学习, 睡眠]
category: 学习
---
(描述:: 记忆巩固是新记忆先在海马快速编码，再在睡眠里被重放、逐步转写到皮层长时记忆的过程。)

慢波期的重放效率最高，所以「睡够」对考试周比「再刷一套」更值钱，这也正是 [[间隔重复]] 安排复习间隔的生理依据。

侧写见 [[卡片盒/多重记忆系统]]，失眠侧的代价见 [[文献盒/睡眠结构#^bz-3f7a1c02|睡眠结构 · 深睡那段]]。`
    },
    {
      path: "卡片盒/睡眠纺锤波.md",
      ctime: Date.parse("2026-09-11T22:30:00"),
      content: `---
tags: [睡眠, 神经科学]
category: 医学
---
(描述:: 睡眠纺锤波是 N2 期 11–16 Hz 的成串脑电，由丘脑网状核与丘脑皮层回路往复产生，一夜可上万次。)

纺锤波密度高的人更抗噪：它把外界声音关在 [[丘脑]] 门外，是「感觉门控」的睡眠版本。

生成回路和激素背景都不是孤立现象，跟 [[文献盒/松果体]] 那条夜间通路合起来看更清楚。`
    },
    {
      path: "卡片盒/丘脑.md",
      ctime: Date.parse("2026-09-11T22:00:00"),
      content: `---
tags: [神经科学]
category: 医学
---
(描述:: 丘脑是除嗅觉外所有感觉通往皮层的中继站，也是睡眠与觉醒的开关。)

觉醒时它放大输入，N3 时切换成节律性爆发把输入挡在门外——[[睡眠纺锤波]] 就是这套开关在 N2 期的产物。

所以「睡觉时听不见」不是耳朵关机，是中继站下班了。`
    },
    {
      path: "卡片盒/睡眠卫生.md",
      ctime: Date.parse("2026-09-02T21:00:00"),
      content: `---
tags: [睡眠]
category: 医学
---
固定作息、睡前减光、卧室只留睡眠功能、下午后不碰咖啡因——听上去都对，落地时大多数人只做到第一条。`
    }
  ];
  var SEED_MOUNT_LITERATURE = [
    {
      path: "文献盒/睡眠结构.md",
      ctime: Date.parse("2026-09-12T21:20:00"),
      content: `---
title: 睡眠结构
type: term
domain: 医学
term: 睡眠结构
date: 2026-09-12 21:20:00
related:
  - "[[卡片盒/睡眠结构]]"
---

睡眠结构指一夜里各睡眠阶段的组成与轮转顺序。非快速眼动睡眠（NREM）分 N1、N2、N3 三期，其中 N3 又称慢波睡眠，脑电以高幅低频 delta 波为主，生长激素分泌高峰落在这里；快速眼动睡眠（REM）眼球快速转动、肌张力几乎消失，脑电接近清醒状态。一个完整周期约九十分钟，成人一夜经历四到六个周期，深睡集中在前半程，REM 在后半程逐渐拉长。睡眠结构的判读依赖多导睡眠图，脑电、眼动、肌电与呼吸信号同步记录，可用于评估睡眠效率、入睡潜伏期与睡眠呼吸暂停。随年龄增长，深睡比例下降、夜间觉醒增多，是老年睡眠变浅的主要来源。

## 功能分工

深睡承担体力恢复与突触下调，REM 承担情绪加工与部分记忆整合，两者不能互相替代。睡眠限制疗法与刺激控制都以「先压缩卧床时间、再让睡眠压把效率顶回来」为操作核心。

被砍掉深睡的人第二天更困、更怕冷，被砍掉 REM 的人则更容易烦躁、注意力涣散。 ^bz-3f7a1c02

结构的时相由昼夜节律系统定，深度由睡眠稳态（睡眠压）定，两者叠加才构成完整的困意曲线。`
    },
    {
      path: "文献盒/慢波睡眠.md",
      ctime: Date.parse("2026-09-12T20:50:00"),
      content: `---
title: 慢波睡眠
type: term
domain: 医学
term: 慢波睡眠
date: 2026-09-12 20:50:00
related:
  - "[[卡片盒/慢波睡眠]]"
---

慢波睡眠是深度非快速眼动睡眠，脑电以 0.5–4 Hz 的高幅 delta 波为主，占整夜睡眠的一到两成。它由丘脑皮层回路的同步化放电产生，生长激素在此期脉冲式分泌，组织修复与免疫调节集中发生。慢波睡眠集中在入睡后的前两个周期，后半夜快速眼动睡眠占比上升，因此熬夜最先牺牲的是深睡。慢波活动的功率可作为睡眠压的生理指标：清醒越久，入睡后的慢波活动越高，随夜衰减越快。深睡不足与代谢紊乱、免疫力下降相关，也直接影响陈述性记忆的隔夜巩固效果。`
    },
    {
      path: "文献盒/睡眠纺锤波.md",
      ctime: Date.parse("2026-09-11T22:40:00"),
      content: `---
title: 睡眠纺锤波
type: term
domain: 医学
term: 睡眠纺锤波
date: 2026-09-11 22:40:00
related:
  - "[[卡片盒/睡眠纺锤波]]"
---

睡眠纺锤波是 N2 期出现的 11–16 Hz 成串脑电活动，由丘脑网状核与丘脑皮层神经元往复抑制产生，单个纺锤持续 0.5–2 秒，一夜可达上万次。纺锤波密度存在明显的个体差异与遗传背景，密度高者对夜间噪声的唤醒阈值更高，睡眠更不容易被打断。纺锤波还与部分记忆任务的隔夜提升相关：它与慢波睡眠、快速眼动睡眠共同构成睡眠期记忆重放的三个环节。`
    },
    {
      path: "文献盒/睡眠日记.md",
      ctime: Date.parse("2026-09-08T20:00:00"),
      content: `---
title: 睡眠日记
type: term
domain: 医学
term: 睡眠日记
date: 2026-09-08 20:00:00
---

睡眠日记要求连续两周逐日记录上床时间、入睡耗时、夜醒次数与时长、起床时间、白天困倦程度及咖啡因与酒精摄入。它比一次多导睡眠图更能反映习惯性睡眠模式，是计算睡眠效率、判断睡眠相位前后移的一手材料，也是睡眠限制疗法调整卧床窗口的唯一依据。记录时只求当天如实填写，不必修饰——数据连续两周后，卧床里清醒的时间占比通常一眼可见。`
    },
    {
      path: "文献盒/睡眠债.md",
      ctime: Date.parse("2026-09-07T20:30:00"),
      content: `---
title: 睡眠债
type: term
domain: 医学
term: 睡眠债
date: 2026-09-07 20:30:00
---

睡眠债指累积的睡眠不足，按「需要量减去实际量」逐日累加。它不会因为单次补觉清零：恢复一夜只能还掉一部分，被砍掉的深睡与快速眼动睡眠份额尤其还不回来。睡眠债的典型表现是日间嗜睡、反应变慢与情绪波动，长期欠债则以代谢与免疫代价结算。判断自己欠了多少，靠主观感觉并不可靠——人对自身警觉度的自评在欠债状态下明显偏高。`
    },
    {
      path: "文献盒/睡眠周期图.md",
      ctime: Date.parse("2026-09-13T09:10:00"),
      content: `---
title: （图版）睡眠周期图：一夜的阶梯
type: image
domain: 医学
date: 2026-09-13 09:10:00
---

（演示读图）以阶梯带表示一夜的睡眠阶段：暖黄为清醒，蓝色为快速眼动，越深的蓝代表越深的非快速眼动睡眠。可见深睡集中在头两个周期，快速眼动在后半程逐周期拉长。

![[文献盒/assets/睡眠周期图.png]]`
    }
  ];
  var SEED_MEDIA = [
    {
      path: "文献盒/assets/睡眠周期图.png",
      content: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAC0CAIAAABqhmJGAAADnUlEQVR42u3coVEDURCA4VSCQGCYiYpAoTLUkBIoAIGiAApAoNDUQQEoJBpFDWgwt8dsHruPb+ZXiPDeu/1yNxG32e72kpq2cQQSwJIAlgSwBLCk8oDf3j9//Ol3f0lvsoUNyMKmWZg7sOQRWhLAkgCWlAHY715+xbGwIgtzB5Y8QksCWBLA0n8C7Oclv3tZ2N8uzB1Y8ggtCWBJAEsCWAJYEsCSUgGfnG4lNQ1gCWBJAEsCWAJYUn3AHy+3kS6vDh2be3d9c1GyTikKuOn309y765uLknVKAJsVgAEGWAADDLDRdFEABhhggAEWwAADLIABBhhgpwSwWQEYYIAFMMAAG00XBWCAAQYYYAEMMMACGGCAjaaLAjDAAAMMsAAGGGABDDDAADulb4Adk9Q3gCWAJQEsaR3gvm/NvXt6XWzu9wYXPIHIkmpel8HLzvp3je/AkSOY+9u34AkEATvMrH8HMMAAA2x8nQDAAAMMMMAAAwwwwMbXCQAMMMAAAwwwwAADDDDAAANsfJ0AwAADDDDAAAMMMMDG1wkADDDAAAMMMMAAAwwwwAADbHydAMAAAwwwwAADDDDAkwCWBLAEsCSAJa0DHHyN7ePzw2J9X7BccHdZS4p8TuJH1bwoBQ8zq+gdOLLuvl9jBXeXtaTgzBU8pcR/V/AwRz9CAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAAAMMMMAAAwwwwAADDDDAkooHsASwJIAlrQOc+Iraw839YuM/yu6aLilr2XMfZuYdOLLu8R9ld02XlLXsuQ8TYLsDGGAjbncAAwwwwAADDDDAABtxuwMYYCMOMMAAAwwwwADbHcAAG3G7AxhggAEGGGCAAQbYiNsdwAAbcbsDGGCAAQYYYIABBtiI2x3AABtxgAEGGGCAAT4WYEmDA1gCWBLAktYBHvzK3N3+OlLBVxDbnQo2+g4cHPGmX4dz704eoQEGWAADLAFsdwLYiAMsgAGWAAZYABtxuxPAAAMsgAGWALY7AWzEARbAAEsAAyyAjbjdCWAjDrAABlgCGGABbMTtTgBLAlgSwBLAkmoA9mZdyXuhJXmElgSwBLAkgCUBLAlgCWBJAEsCWAJYUkfAZ+cXkpoGsASwJIAlASwBLAlgSQBLAlgCWBLAkgCWAJYEsCSAJQEsASwJYElH6AsPIXBF5tbWTgAAAABJRU5ErkJggg=="
    },
    {
      path: "CONFIG/APPENDIX/CBTI演示.mp4",
      content: "（演示）视频文件占位：评审壳不加载真媒体，正文与卡片里的 mp4 嵌入统一映射到壳内 assets/demo.mp4 回放。"
    }
  ];
  function ensureTaskSeedShape() {
    var _a;
    const taskKey = key("CONFIG/STORAGE/knowledge.json");
    const raw = localStorage.getItem(taskKey);
    if (raw) {
      try {
        const env = JSON.parse(raw);
        const inner = JSON.parse(String((_a = env == null ? void 0 : env.c) != null ? _a : ""));
        if (Array.isArray(inner)) return;
      } catch (e) {
      }
    }
    localStorage.setItem(taskKey, encodeSeedFile(JSON.stringify(SEED_TASKS)));
  }
  function seedVault() {
    ensureTaskSeedShape();
    if (localStorage.getItem(SEED_MARKER)) return;
    for (const n of [...SEED_NOTES, ...SEED_MOUNT_NOTES, ...SEED_MOUNT_LITERATURE]) {
      localStorage.setItem(key(n.path), encodeSeedFile(n.content, { ctime: n.ctime, mtime: n.ctime }));
    }
    for (const m of SEED_MEDIA) localStorage.setItem(key(m.path), encodeSeedFile(m.content));
    localStorage.setItem(key("CONFIG/STORAGE/knowledge.json"), encodeSeedFile(JSON.stringify(SEED_TASKS)));
    localStorage.setItem(SEED_MARKER, (/* @__PURE__ */ new Date()).toISOString());
  }
  function injectSettings() {
    const settings = {
      storagePath: "CONFIG/STORAGE",
      aiProvider: "deepseek",
      deepseekApiKey: "sk-demo",
      // 假层罐头不校验；仅为让 getAIProvider 放行到 fake requestUrl
      knowledgeDirectory: "文献盒",
      knowledgeCardboxDirectory: "卡片盒",
      knowledgeTopicDirectory: "主题盒",
      knowledgeDomainList: "心理, 医学, 计算机, 学习",
      knowledgeProgressDetail: true,
      knowledgeKeepVideo: false,
      knowledgeQuality: "highest",
      knowledgeStopOnFailure: false,
      knowledgeOutputDir: "",
      knowledgeCompress: true,
      knowledgeCrf: 23,
      knowledgeFfmpegPath: "",
      knowledgeFfprobePath: "",
      knowledgePythonPath: "",
      knowledgeWhisperModel: "small",
      knowledgeCacheDir: "",
      knowledgeCacheRetentionDays: 7
    };
    setSettingsProvider(() => settings);
    setAISettingsProvider(() => settings);
  }
  var ui = null;
  function injectDemoPlate() {
    const zone = document.getElementById("lit-image-drop");
    if (!zone || zone.querySelector("[data-demo-plate]")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-demo-plate", "1");
    btn.textContent = "载入示例图";
    btn.title = "点一下加一张（可连点，演示多图）";
    btn.style.cssText = "border:1px solid var(--line);background:none;color:var(--ink3);font:11px/1.6 inherit;padding:2px 10px;border-radius:999px;cursor:pointer;";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void loadDemoPlate();
    });
    zone.appendChild(btn);
  }
  var DEMO_PLATE_PALETTES = [
    ["#2b3a55", "#8f6a63", "#d9b18a", "#f2d9a8", "落日与山脊"],
    ["#2f4a44", "#7d9c8b", "#cfe0cf", "#f4f0d8", "晨雾与松林"],
    ["#1b2338", "#3d4a72", "#7f8fbf", "#e8ecf7", "夜色与湖面"]
  ];
  async function makeDemoPlateFile(seed) {
    const [sky0, sky1, sky2, sun, title] = DEMO_PLATE_PALETTES[seed % DEMO_PLATE_PALETTES.length];
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const sky = ctx.createLinearGradient(0, 0, 0, 160);
    sky.addColorStop(0, sky0);
    sky.addColorStop(0.55, sky1);
    sky.addColorStop(1, sky2);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 240, 160);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(168, 78, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3c4a63";
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(58, 96);
    ctx.lineTo(116, 160);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#28324a";
    ctx.beginPath();
    ctx.moveTo(84, 160);
    ctx.lineTo(160, 108);
    ctx.lineTo(240, 160);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText(`示例图版 ${seed + 1} · ${title}`, 12, 150);
    const blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return null;
    return new File([blob], `demo-plate-${seed + 1}.png`, { type: "image/png" });
  }
  async function loadDemoPlate(count = 1) {
    bootKnowledgeSim();
    const zone = document.getElementById("lit-image-drop");
    if (!zone) return;
    const dt = new DataTransfer();
    for (let i = 0; i < Math.max(1, count); i++) {
      const file = await makeDemoPlateFile(i);
      if (file) dt.items.add(file);
    }
    if (!dt.items.length) return;
    zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  }
  var fakeLinkCandidates = [
    { path: "卡片盒/多重记忆系统.md", title: "多重记忆系统" },
    { path: "卡片盒/认知行为疗法.md", title: "认知行为疗法" },
    { path: "卡片盒/间隔重复.md", title: "间隔重复" }
  ];
  function injectFakeLinkNow(app) {
    const stripRelated = (head) => {
      const out = [];
      let skipping = false;
      for (const line of head.split("\n")) {
        if (/^related:/.test(line)) {
          skipping = true;
          continue;
        }
        if (skipping) {
          if (/^\s+-\s/.test(line) || line.trim() === "") continue;
          skipping = false;
        }
        if (line.trim() !== "") out.push(line);
      }
      return out.join("\n");
    };
    const candidates = () => fakeLinkCandidates.filter((c) => !!app.vault.getAbstractFileByPath(c.path)).slice(0, 2);
    const writeLinks = async (path, picks) => {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || !picks.length) return 0;
      const text = await app.vault.read(file);
      const lines = picks.map((c) => `  - "[[${c.path}|${c.title}]]"`).join("\n");
      const next = /^---\n[\s\S]*?\n---/.test(text) ? text.replace(/^---\n([\s\S]*?)\n---/, (_m, head) => `---
${stripRelated(head)}
related:
${lines}
---`) : `---
related:
${lines}
---

${text}`;
      if (next !== text) await app.vault.modify(file, next);
      return picks.length;
    };
    setLinkBridge({
      preview: async () => {
        await new Promise((r) => setTimeout(r, 2600));
        return { status: "done", picks: candidates() };
      },
      apply: async (path, targetPaths) => {
        const map = new Map(fakeLinkCandidates.map((c) => [c.path, c.title]));
        const picks = targetPaths.map((p) => ({ path: p, title: map.get(p) || p }));
        return { status: "done", created: await writeLinks(path, picks) };
      },
      now: async (path) => ({ status: "done", created: await writeLinks(path, candidates()) }),
      // ADR-0141：通道第四段（批量补链）——原型壳不跑批量，恒报无目标
      backfill: async () => ({ status: "no-targets" })
    });
  }
  function injectFakeVectorSearch() {
    const index = AI_INDEX.filter((it) => !!localStorage.getItem(key(it.path)));
    setVectorSearchSource({
      isIndexReady: () => true,
      search: async (query, topK = 5) => {
        const q2 = String(query != null ? query : "").toLowerCase();
        if (!q2.trim()) return [];
        const hits = [];
        for (const it of index) {
          let hit = 0;
          for (const k of it.keys) if (q2.includes(k.toLowerCase())) hit++;
          if (!hit) continue;
          const score = Math.min(0.93, 0.62 + hit * 0.06 + Math.min(0.12, it.chunk.length / 900));
          hits.push({ path: it.path, chunk: it.chunk, score: Number(score.toFixed(3)) });
        }
        hits.sort((x, y) => y.score - x.score || x.path.localeCompare(y.path));
        return hits.slice(0, Math.max(1, topK));
      }
    });
  }
  function bootKnowledgeSim() {
    const g = window;
    if (g.__bzKbSimBooted) return;
    g.__bzKbSimBooted = true;
    seedVault();
    const app = new FakeApp();
    setApp(app);
    injectSettings();
    injectFakeLinkNow(app);
    injectFakeVectorSearch();
    KnowledgeData.init({ storagePath: "CONFIG/STORAGE" });
    ui = new UIManager(app);
    injectDemoPlate();
  }
  function openPanel() {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showMain();
  }
  function openTerm(term) {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showTermEntry(term);
  }
  function openPassage() {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showPassageEntry();
  }
  function openImage() {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showImageEntry();
  }
  function openVideo(prefill) {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showVideoEntry(prefill);
  }
  function openVideoTasks() {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showVideoTasks();
  }
  function openVideoHistory() {
    bootKnowledgeSim();
    ui == null ? void 0 : ui.showHistory();
  }
  function openMountTree2(cardPath = "卡片盒/睡眠结构.md") {
    bootKnowledgeSim();
    void openMountTree(cardPath);
  }
  var boot = bootKnowledgeSim;
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
