/* 源指纹 5909811cbab8cb4d · 仓内输入 49 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/favorites/fake-sim.ts","prototypes/favorites/fake/fake-obsidian.ts","src/core/ai.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/json-store.ts","src/core/mobile.ts","src/core/notice.ts","src/core/settings-provider.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/favorites/ai.ts","src/favorites/config.ts","src/favorites/data.ts","src/favorites/layouts/board/render.ts","src/favorites/render.ts","src/favorites/shared.ts","src/favorites/ui.ts","src/smartcat/favorites-source.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/favorites/fake-sim.ts → window.BZW_favorites（行为单源预览包，issue 245/ADR-0106） */
var BZW_favorites = (() => {
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

  // prototypes/favorites/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootFavoritesSim: () => bootFavoritesSim,
    closePanel: () => closePanel,
    openForm: () => openForm,
    openPanel: () => openPanel2,
    resetFavoritesState: () => resetFavoritesState
  });

  // prototypes/favorites/fake/fake-obsidian.ts
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768
  };
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.FAV_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  var FakeVault = class _FakeVault {
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
    emit(evt, file) {
      var _a;
      for (const cb of (_a = this.listeners.get(evt)) != null ? _a : []) cb(file);
    }
  };
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
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
  function setSettingsProvider(fn) {
    _provider = fn;
  }
  function getSettings() {
    if (!_provider) {
      throw new Error("bz: 设置提供者未注入（main.ts onload 应调用 setSettingsProvider）");
    }
    return _provider();
  }

  // src/favorites/config.ts
  var CONFIG = {
    /** 默认存储目录（文件名固定 favorites.json，设置只允许改目录） */
    DEFAULT_STORAGE_PATH: "CONFIG/STORAGE",
    /** 数据文件名（固定，不允许用户修改） */
    STORAGE_FILE: "favorites.json"
  };
  var TAGS = [
    { label: "GitHub", ic: "github" },
    { label: "桌面软件", ic: "app-window" },
    { label: "网站", ic: "globe" },
    { label: "大模型", ic: "brain-circuit" },
    { label: "pi", ic: "keyboard" },
    { label: "Claude", ic: "bot" },
    { label: "skills", ic: "zap" },
    { label: "酒馆", ic: "beer" },
    { label: "DeepSeek Harness", ic: "waypoints" }
  ];
  function getStorageDir(value) {
    let dir = (value || CONFIG.DEFAULT_STORAGE_PATH).trim().replace(/\/+$/, "");
    if (/\.json$/i.test(dir)) {
      const idx = dir.lastIndexOf("/");
      dir = idx >= 0 ? dir.slice(0, idx) : "";
    }
    return dir || CONFIG.DEFAULT_STORAGE_PATH;
  }
  function getStoragePath(value) {
    return getStorageDir(value) + "/" + CONFIG.STORAGE_FILE;
  }
  function normalizeUrl(url) {
    const u = (url || "").trim();
    return /^https?:\/\//i.test(u) ? u : "https://" + u;
  }
  function isUrlLike(text) {
    const t = (text || "").trim();
    return t.length > 0 && !/\s/.test(t) && (/^https?:\/\//i.test(t) || /^www\./i.test(t));
  }

  // src/core/z-order.ts
  var zCounter = 1e5;
  var alwaysOnTop = /* @__PURE__ */ new Set();
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
  var UNDO_DURATION_MS = 6e3;
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

  // src/core/storage.ts
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

  // src/core/json-store.ts
  function jsonStore(filePath) {
    return jsonFileStore(filePath);
  }

  // src/favorites/data.ts
  var DataManager = class {
    constructor(storagePath) {
      this.store = jsonStore(storagePath);
      this.filePath = storagePath;
    }
    async read() {
      return this.store.read();
    }
    async write(data) {
      return this.store.write(data);
    }
    /** 读改写事务：fn 基于磁盘现值就地改动（或返回新数组），整体入串行队列执行 */
    async mutateAll(fn) {
      return enqueueFileTask(this.filePath, async () => {
        const data = await this.read();
        const next = fn(data) || data;
        await this.write(next);
        return next;
      });
    }
    add(item) {
      return this.mutateAll((data) => {
        data.unshift(item);
      });
    }
    delete(id) {
      return this.mutateAll((data) => {
        const idx = data.findIndex((d) => d.id === id);
        if (idx !== -1) data.splice(idx, 1);
      });
    }
    /**
     * 撤销删除（ticket 141 通病 1）：删除前取到的完整条目原样插回（含 archived/llmConfig 等全部字段），
     * 不走 add() 重排——同 id 已存在（并发写回）则幂等跳过。参照 review/data.ts restoreItem 先例。
     */
    restoreItem(item) {
      return this.mutateAll((data) => {
        if (data.some((d) => d.id === item.id)) return;
        data.push(item);
      }).then(() => void 0);
    }
    update(id, newData) {
      return this.mutateAll((data) => {
        const idx = data.findIndex((d) => d.id === id);
        if (idx !== -1) data[idx] = { ...data[idx], ...newData };
      });
    }
    async getAll() {
      return await this.read();
    }
  };

  // src/core/ai.ts
  var _settingsProvider = null;
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

  // src/favorites/ai.ts
  var FavoritesAIService = class {
    constructor() {
      this.ai = createAI();
    }
    /**
     * AI 是否已配置（ticket 23 + 审查建议 C：真实读取插件 AI 配置，替代恒真的 !!this.ai）。
     * 判定口径与 core/ai.ts getAIProvider 一致：provider = aiProvider || 'opencode-go'；
     * - opencode-go 无 legacy 兜底：缺 opencodeGoApiKey 即拦截；
     * - deepseek 的 quickadd data.json 兜底是异步文件读取（core/ai getAIProvider 运行时判定），
     *   插件设置缺 key 不判死——交给运行时兜底，避免误拦仅 QuickAdd data.json 配置的老用户；
     * - 其余注册表提供商（ticket 171）：缺 apiKeyKey 对应键即拦截（ollama 本地服务无密钥豁免）；
     * - custom（ticket 170）：需 endpoint + key 齐全才算已配置。
     */
    isAvailable() {
      if (!this.ai) return false;
      const s = getSettings();
      const provider = s.aiProvider || "opencode-go";
      if (provider === "opencode-go") return !!s.opencodeGoApiKey;
      if (provider === "custom") return !!s.aiCustomEndpoint && !!s.aiCustomApiKey;
      if (provider === "ollama") return true;
      const desc = getProviderDescriptor(provider);
      if (provider === "deepseek") return true;
      return !!s[desc.apiKeyKey];
    }
    /**
     * 获取 GitHub 仓库信息（真实 API，增强：原稿为纯 AI 生成，现改为
     * https://api.github.com/repos/{owner}/{repo} 取仓库名与简介原文）。
     * 返回 {title, description, fetched}：fetched=false 表示请求失败/限流
     * （此时 description 恒为空串，调用方不得让 AI 编造简介）；
     * 非 GitHub 地址抛「无效的 GitHub 地址」。8s 超时 + 重试 1 次（api.github.com 网络不稳）。
     */
    async fetchGitHubInfo(url) {
      const match = url.match(/github\.com\/([^\/?#]+)\/([^\/?#]+)/);
      if (!match) throw new Error("无效的 GitHub 地址");
      const [, owner, repo] = match;
      let title = repo;
      let description = "";
      let fetched = false;
      for (let attempt = 0; attempt < 2 && !fetched; attempt++) {
        try {
          const resp = await this._requestUrlWithTimeout(
            {
              url: `https://api.github.com/repos/${owner}/${repo}`,
              method: "GET",
              headers: { Accept: "application/vnd.github+json", "User-Agent": "obsidian-bz" }
            },
            8e3
          );
          if (resp.status && resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
          const data = JSON.parse(resp.text || "{}");
          title = data.name || repo;
          description = String(data.description || "").trim();
          fetched = true;
        } catch (e) {
          if (attempt === 1) console.warn("GitHub API 获取失败，使用降级方案", e);
        }
      }
      return { title, description, fetched };
    }
    /** requestUrl 包超时（避免 api.github.com 长时间挂起） */
    _requestUrlWithTimeout(opts, timeoutMs) {
      let timer = null;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("GitHub API 请求超时")), timeoutMs);
      });
      return Promise.race([requestUrl(opts), timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    }
  };

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

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
  }

  // src/core/utils.ts
  var import_moment = __toESM(require_moment());
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => {
      if (m === "&") return "&amp;";
      if (m === "<") return "&lt;";
      if (m === ">") return "&gt;";
      if (m === '"') return "&quot;";
      return "&#39;";
    });
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
    return { html, buttons, focusId: buttons[focusIdx].id };
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
  function confirmDiscard(proceed, message) {
    void openFlowDialog({
      title: "放弃未保存的内容？",
      message: message || "弹窗内有未保存的输入，关闭后将丢失",
      actions: [
        { label: "放弃", value: "ok" },
        { label: "继续编辑", value: "cancel" }
      ]
    }).then((v) => {
      if (v === "ok") proceed();
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

  // src/smartcat/favorites-source.ts
  function favoritesEditChanges(oldItem, nextItem) {
    const changes = [];
    if ((oldItem.title || "").trim() !== (nextItem.title || "").trim()) changes.push("改了标题");
    if ((oldItem.description || "").trim() !== (nextItem.description || "").trim()) changes.push("改了简介");
    if ((oldItem.url || "").trim() !== (nextItem.url || "").trim()) changes.push("改了链接");
    if ((oldItem.tags || []).join(",") !== (nextItem.tags || []).join(",")) changes.push("改了分类");
    return changes;
  }

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml2(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml2(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
  }

  // src/favorites/shared.ts
  var ICON = {
    close: "x",
    add: "plus",
    open: "external-link",
    pin: "pin",
    pinOff: "pin-off",
    edit: "pencil",
    archive: "archive",
    unarchive: "archive-restore",
    del: "trash-2",
    ai: "sparkles"
  };
  function localNow() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function relTime(s) {
    if (!s) return "";
    const d = new Date(s.replace(" ", "T"));
    if (isNaN(d.getTime())) return s;
    const diff = Date.now() - d.getTime();
    const m = 6e4, h = 36e5, day = 864e5;
    if (diff < m) return "刚刚";
    if (diff < h) return Math.floor(diff / m) + " 分钟前";
    if (diff < day) return Math.floor(diff / h) + " 小时前";
    if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getMonth() + 1}-${p(d.getDate())}`;
  }
  function hueOf(label) {
    const m = {
      GitHub: 215,
      桌面软件: 160,
      网站: 30,
      大模型: 265,
      pi: 100,
      Claude: 20,
      skills: 50,
      酒馆: 330,
      "DeepSeek Harness": 195
    };
    return m[label] != null ? m[label] : 200;
  }
  function visibleItems(items) {
    return items.filter((i) => !i.archived);
  }
  function archivedItems(items) {
    return items.filter((i) => !!i.archived);
  }
  function poolOf(items, view) {
    return view.archived ? archivedItems(items) : visibleItems(items);
  }
  function tagCount(items, label) {
    return visibleItems(items).filter((i) => (i.tags || []).includes(label)).length;
  }
  function filteredItems(items, view) {
    let list = poolOf(items, view);
    if (!view.archived && view.tag) list = list.filter((i) => (i.tags || []).includes(view.tag));
    const byTime = (a, b) => (b.created || "").localeCompare(a.created || "") || (b.id || "").localeCompare(a.id || "");
    const base = [...list].sort(byTime);
    const pinned = base.filter((i) => i.pinned);
    const rest = base.filter((i) => !i.pinned);
    return [...pinned, ...rest];
  }
  function cardHtml(it, idx) {
    const pinnedCls = it.pinned ? " bz-fav-pinc" : "";
    const archCls = it.archived ? " bz-fav-arch" : "";
    const hue = hueOf((it.tags || [])[0] || "");
    const tape = "bz-fav-tape" + (idx % 3 ? [" bz-fav-tape--r", " bz-fav-tape--g"][idx % 3 - 1] : "");
    return `<div class="bz-fav-card${pinnedCls}${archCls}" data-fav-id="${esc(it.id)}">
    <span class="${tape}"></span>
    <span class="bz-fav-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <h3>${esc(it.title || "无标题")}</h3>
    <p>${esc(it.description || "（这张卡只写了个名字）")}</p>
    <div class="bz-fav-ft"><span class="bz-fav-tags-row">${(it.tags || []).map((t) => {
      const h = hueOf(t);
      const ic = (TAGS.find((x) => x.label === t) || { ic: "" }).ic;
      return `<span class="bz-fav-tagb" style="background:hsl(${h} 70% 95%);color:hsl(${h} 45% 42%)">${ic ? iconSpan(ic, "bz-ic--xs") : ""}<span>${esc(t)}</span></span>`;
    }).join("")}</span>
      <span>${esc(relTime(it.created))}</span></div>
  </div>`;
  }
  function emptyHtml() {
    return '<div class="bz-fav-empty">这块板上还没有卡片</div>';
  }
  function actionSpecs(it) {
    const acts = [];
    if ((it.url || "").trim()) acts.push({ icon: ICON.open, label: "打开", act: "open" });
    acts.push({
      icon: it.pinned ? ICON.pinOff : ICON.pin,
      label: it.pinned ? "取消置顶" : "置顶",
      act: "pin"
    });
    acts.push({ icon: ICON.edit, label: "编辑", act: "edit" });
    acts.push(it.archived ? { icon: ICON.unarchive, label: "取消归档", act: "unarchive" } : { icon: ICON.archive, label: "归档", act: "archive" });
    acts.push({ icon: ICON.del, label: "删除", act: "del", danger: true });
    return acts;
  }
  function ctxMenuHtml(acts) {
    return acts.map((a, k) => {
      const last = k === acts.length - 1;
      const btn = `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ""}>${iconSpan(a.icon, "bz-ic--sm")}<span>${esc(a.label)}</span></button>`;
      return last ? `<div class="bz-fav-ctx-sep"></div>${btn}` : btn;
    }).join("");
  }
  function sheetHtml(it, acts) {
    const hue = hueOf((it.tags || [])[0] || "");
    return `<div class="bz-fav-sh-head"><span class="bz-fav-sh-dot" style="--c:hsl(${hue} 52% 58%)"></span>
    <div><div class="bz-fav-sh-title">${esc(it.title || "无标题")}</div>
    <div class="bz-fav-sh-meta">${esc(relTime(it.created))}${it.pinned ? " · 已置顶" : ""}${it.archived ? " · 已归档" : ""}</div></div></div>
  <div class="bz-fav-sh-acts">${acts.map((a, k) => `<button data-k="${k}"${a.danger ? ' class="bz-fav-danger"' : ""}>${iconSpan(a.icon)}<span>${esc(a.label)}</span></button>`).join("")}</div>`;
  }
  function pickChipsHtml(sel) {
    return TAGS.map(
      (t) => `<button type="button" class="${sel.has(t.label) ? "bz-fav-on" : ""}" data-tag="${esc(t.label)}">${iconSpan(t.ic, "bz-ic--xs")}<span>${esc(t.label)}</span></button>`
    ).join("");
  }
  function formHtml(it) {
    const editing = !!it;
    return `<div class="bz-fav-form">
    <h2>${editing ? "编辑收藏" : "添加收藏"}</h2>
    <div class="bz-fav-fld"><label>标题</label><input id="fz-title" value="${esc(it ? it.title : "")}" placeholder="如：某篇好文"></div>
    <div class="bz-fav-fld"><label>链接</label><input id="fz-url" value="${esc(it ? it.url : "")}" placeholder="https://…"></div>
    <div class="bz-fav-fld"><label>简介</label><textarea id="fz-desc" placeholder="一句话记住它…">${esc(it ? it.description || "" : "")}</textarea></div>
    <div class="bz-fav-fld"><label>标签（可多选）</label><div class="bz-fav-pick" id="fz-tags"></div></div>
    <div class="bz-fav-fld bz-fav-inline"><span class="bz-fav-sw${it && it.pinned ? " bz-fav-on" : ""}" id="fz-pin"></span><span class="bz-fav-fld-desc">置顶后恒排最前</span></div>
    <div class="bz-fav-err" id="fz-err"></div>
    <div class="bz-fav-btns">
      <button type="button" id="fz-ai" class="bz-fav-ai-btn">${iconSpan(ICON.ai, "bz-ic--xs")} <span>AI 整理</span></button>
      <button type="button" data-fz-cancel>取消</button>
      <button type="button" id="fz-save" class="bz-fav-pri">${editing ? "更新" : "保存"}</button>
    </div>
  </div>`;
  }

  // src/favorites/layouts/board/render.ts
  function panelHtml(mobile) {
    const mob = mobile ? " bz-fav-mob bz-panel-mtop" : "";
    return `<div class="bz-fav-panel bz-fav-scope${mob}">
  <div class="bz-fav-head"><h1>收藏本</h1><button class="bz-fav-mob-close bz-touch-target bz-touch-target--xl" data-fav-close title="关闭">${iconSpan(ICON.close, "bz-ic--xs")}</button></div>
  <div class="bz-fav-tags" data-fav-tags></div>
  <div class="bz-fav-board" data-fav-content></div>
</div>`;
  }
  function chipsHtml(items, view, mobile) {
    const mk = (label, ic, cnt, active, grey = false) => `<button class="bz-fav-chip${active ? " bz-fav-on" : ""}${grey ? " bz-fav-chip--grey" : ""}" data-fav-tag="${esc(label)}">${ic ? iconSpan(ic, "bz-ic--xs") : ""}<span>${esc(label)} ${cnt}</span></button>`;
    const add = `<button class="bz-fav-chip-add" data-fav-add title="添加收藏">${iconSpan(ICON.add, "bz-ic--xs")}<span>新收藏</span></button>`;
    const chips = mk("全部", "", visibleItems(items).length, !view.archived && view.tag === null) + mk("已归档", "archive", archivedItems(items).length, view.archived, true) + TAGS.map((t) => {
      const n = tagCount(items, t.label);
      return n ? mk(t.label, t.ic, n, !view.archived && view.tag === t.label) : "";
    }).join("");
    return mobile ? add + chips : chips + add;
  }
  function boardHtml(items, view) {
    const list = filteredItems(items, view);
    if (!list.length) return emptyHtml();
    return list.map((it) => cardHtml(it, items.indexOf(it))).join("");
  }
  function renderTagsInto(mount, items, view, hooks) {
    mount.innerHTML = chipsHtml(items, view, hooks.mobile);
    hooks.mountIcons(mount);
  }
  function renderBoardInto(board, items, view, hooks) {
    board.innerHTML = boardHtml(items, view);
    hooks.mountIcons(board);
  }
  function renderPanelView(panel, items, view, hooks) {
    const tags = panel.querySelector("[data-fav-tags]");
    if (tags) renderTagsInto(tags, items, view, hooks);
    const board = panel.querySelector("[data-fav-content]");
    if (board) renderBoardInto(board, items, view, hooks);
  }

  // src/favorites/ui.ts
  var M = {
    overlay: null,
    items: [],
    tag: null,
    archived: false,
    renderFn: null
  };
  function resetFavoritesState() {
    M.overlay = null;
    M.items = [];
    M.tag = null;
    M.archived = false;
    M.renderFn = null;
  }
  var mainEscRegistered = false;
  function ensureFavoritesEsc() {
    if (mainEscRegistered) return;
    mainEscRegistered = true;
    escManager.register("bz-fav", {
      isVisible: () => !!M.overlay || !!document.querySelector(".bz-fav-form") || !!document.querySelector(".bz-fav-sheet-mask"),
      close: () => {
        if (closeMenu()) return;
        if (document.querySelector(".bz-fav-sheet-mask")) {
          closeSheet();
          return;
        }
        const form = document.querySelector(".bz-fav-form");
        if (form) requestCloseForm(form);
        else closePanel();
      }
    });
  }
  var _dm = null;
  var _ai = null;
  var _app2 = null;
  function initFavoritesUI(app, dm, ai) {
    _app2 = app;
    _dm = dm;
    _ai = ai;
  }
  function openPanel(app, dm, ai) {
    initFavoritesUI(app, dm, ai);
    if (M.overlay) {
      closePanel();
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "bz-panel-overlay";
    overlay.innerHTML = panelHtml(isMobileEnv());
    document.body.appendChild(overlay);
    topifyZ(overlay);
    M.overlay = overlay;
    M.renderFn = () => renderAll();
    mountIcons(overlay);
    ensureFavoritesEsc();
    overlay.addEventListener("click", (e) => {
      const t = e.target;
      if (e.target === overlay) {
        closePanel();
        return;
      }
      if (t.closest("[data-fav-add]")) {
        openForm(null);
        return;
      }
      if (t.closest("[data-fav-close]")) {
        closePanel();
        return;
      }
    });
    const stickers = overlay.querySelector("[data-fav-tags]");
    stickers.addEventListener("click", (e) => {
      const b = e.target.closest("[data-fav-tag]");
      if (!b) return;
      applyTagFilter(b.dataset.favTag);
    });
    const content = overlay.querySelector("[data-fav-content]");
    content.addEventListener("click", (e) => {
      const t = e.target;
      const card = t.closest("[data-fav-id]");
      if (!card) return;
      e.stopPropagation();
      const it = itemById(card.dataset.favId);
      if (!it) return;
      if (isMobileEnv()) {
        openMobSheet(it);
        return;
      }
      const rawUrl = (it.url || "").trim();
      if (rawUrl) openExternal(normalizeUrl(rawUrl));
    });
    content.addEventListener("contextmenu", (e) => {
      const card = e.target.closest("[data-fav-id]");
      if (!card || isMobileEnv()) return;
      e.preventDefault();
      const it = itemById(card.dataset.favId);
      if (it) openRowMenuAt(it, e.clientX, e.clientY);
    });
    void (async () => {
      await loadItems();
      renderAll();
    })();
  }
  function closePanel() {
    if (M.overlay) {
      M.overlay.remove();
      M.overlay = null;
    }
    M.renderFn = null;
  }
  async function loadItems() {
    try {
      M.items = await dataManagerOf().getAll();
    } catch (e) {
      M.items = [];
      notice("收藏数据读取失败，已显示为空列表", "error");
      console.error("[favorites-load]", e);
    }
  }
  async function reload() {
    var _a;
    await loadItems();
    (_a = M.renderFn) == null ? void 0 : _a.call(M);
  }
  function renderAll() {
    if (!M.overlay) return;
    const panel = M.overlay.querySelector(".bz-fav-panel");
    renderPanelView(panel, M.items, M, { mountIcons, mobile: isMobileEnv() });
  }
  function applyTagFilter(label) {
    if (label === "全部" || label === "__all") {
      M.tag = null;
      M.archived = false;
    } else if (label === "已归档" || label === "__archived") {
      M.tag = null;
      M.archived = !M.archived;
    } else {
      M.archived = false;
      M.tag = M.tag === label ? null : label;
    }
    renderAll();
  }
  function itemById(id) {
    return M.items.find((i) => i.id === id);
  }
  function runAction(it, spec) {
    const rawUrl = (it.url || "").trim();
    if (spec.act === "open") {
      openExternal(normalizeUrl(rawUrl));
    } else if (spec.act === "pin") {
      const next = !it.pinned;
      const prev = it.pinned;
      it.pinned = next;
      void dataManagerOf().update(it.id, { pinned: next }).catch((e) => {
        it.pinned = prev;
        notifySaveError(e, "置顶收藏");
      }).finally(() => {
        void reload();
      });
    } else if (spec.act === "edit") {
      openForm(it);
    } else if (spec.act === "archive") {
      void openFlowDialog({
        title: "归档收藏",
        message: `确定归档收藏「${it.title}」吗？归档后不在主列表显示（数据保留），可在通知中撤销。`,
        actions: [
          { label: "取消", value: "cancel" },
          { label: "归档", value: "ok", cta: true }
        ]
      }).then((v) => {
        if (v === "ok") void archiveItem(it);
      });
    } else if (spec.act === "unarchive") {
      void unarchiveItem(it);
    } else if (spec.act === "del") {
      void openFlowDialog({
        title: "删除收藏",
        message: `确定删除收藏「${it.title}」吗？删除后可在通知中撤销。`,
        actions: [
          { label: "取消", value: "cancel" },
          { label: "删除", value: "del", danger: true, cta: true }
        ]
      }).then((v) => {
        if (v === "del") void deleteItem(it);
      });
    }
  }
  var menuEl = null;
  var menuOutsideHandler = null;
  function closeMenu() {
    if (!menuEl) return false;
    menuEl.remove();
    menuEl = null;
    if (menuOutsideHandler) {
      document.removeEventListener("click", menuOutsideHandler, true);
      menuOutsideHandler = null;
    }
    return true;
  }
  function openRowMenuAt(it, x, y) {
    closeMenu();
    const acts = actionSpecs(it);
    menuEl = document.createElement("div");
    menuEl.className = "bz-fav-ctx bz-fav-scope";
    menuEl.innerHTML = ctxMenuHtml(acts);
    menuEl.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      closeMenu();
      runAction(it, acts[+b.dataset.k]);
    });
    document.body.appendChild(menuEl);
    mountIcons(menuEl);
    topifyZ(menuEl);
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = Math.min(x, window.innerWidth - r.width - 8) + "px";
    menuEl.style.top = Math.min(y, window.innerHeight - r.height - 8) + "px";
    menuOutsideHandler = (e) => {
      if (menuEl && e.target instanceof Node && menuEl.contains(e.target)) return;
      closeMenu();
    };
    document.addEventListener("click", menuOutsideHandler, true);
  }
  function openMobSheet(it) {
    closeSheet();
    const acts = actionSpecs(it);
    const mask = document.createElement("div");
    mask.className = "bz-fav-sheet-mask bz-fav-scope bz-fav-show";
    mask.innerHTML = `<div class="bz-fav-sheet">${sheetHtml(it, acts)}</div>`;
    mask.addEventListener("click", (e) => {
      if (e.target === mask) {
        closeSheet();
        return;
      }
      const b = e.target.closest("button");
      if (!b) return;
      closeSheet();
      runAction(it, acts[+b.dataset.k]);
    });
    document.body.appendChild(mask);
    mountIcons(mask);
    topifyZ(mask);
  }
  function closeSheet() {
    var _a;
    (_a = document.querySelector(".bz-fav-sheet-mask")) == null ? void 0 : _a.remove();
  }
  async function archiveItem(it) {
    try {
      await dataManagerOf().update(it.id, { archived: true, archivedAt: localNow() });
      emitDomainEvent("favorites", { kind: "archive", title: it.title });
      await reload();
      notifyUndo(`已归档收藏「${it.title}」`, () => {
        void (async () => {
          try {
            await dataManagerOf().update(it.id, { archived: false, archivedAt: null });
            emitDomainEvent("favorites", { kind: "unarchive", title: it.title });
            await reload();
          } catch (e) {
            notifySaveError(e, "恢复收藏");
          }
        })();
      }, { type: "archive" });
    } catch (e) {
      notifySaveError(e, "归档收藏");
    }
  }
  async function unarchiveItem(it) {
    try {
      await dataManagerOf().update(it.id, { archived: false, archivedAt: null });
      emitDomainEvent("favorites", { kind: "unarchive", title: it.title });
      await reload();
      notice(`已取消归档，「${it.title}」回到主列表`, "success");
    } catch (e) {
      notifySaveError(e, "取消归档");
    }
  }
  async function deleteItem(it) {
    const snapshot = it;
    try {
      await dataManagerOf().delete(it.id);
      emitDomainEvent("favorites", { kind: "delete", title: it.title });
      await reload();
      notifyUndo(`已删除收藏「${it.title}」`, () => {
        void (async () => {
          try {
            await dataManagerOf().restoreItem(snapshot);
            await reload();
          } catch (e) {
            notifySaveError(e, "恢复收藏");
          }
        })();
      });
    } catch (e) {
      notifySaveError(e, "删除收藏");
    }
  }
  function dataManagerOf() {
    if (!_dm) throw new Error("收藏本数据管理器未初始化");
    return _dm;
  }
  function aiServiceOf() {
    if (!_ai) throw new Error("收藏本 AI 服务未初始化");
    return _ai;
  }
  function appOf() {
    return _app2 || getApp();
  }
  function openExternal(url) {
    const app = appOf();
    try {
      app.openUrl(url);
    } catch (e) {
      const electron = window.require && window.require("electron");
      if (electron && electron.shell) electron.shell.openExternal(url);
    }
  }
  var _saving = false;
  var _baseline = null;
  function formTagsNow(popup) {
    return [...popup.querySelectorAll("#fz-tags [data-tag].bz-fav-on")].map((b) => b.dataset.tag || "").sort().join("|");
  }
  function formPinNow(popup) {
    var _a;
    return !!((_a = popup.querySelector("#fz-pin")) == null ? void 0 : _a.classList.contains("bz-fav-on"));
  }
  function formDirty() {
    if (!_baseline) return false;
    const popup = document.querySelector(".bz-fav-form");
    if (!popup) return false;
    return inputVal(popup, "#fz-title") !== _baseline.title || inputVal(popup, "#fz-url") !== _baseline.url || inputVal(popup, "#fz-desc") !== _baseline.desc || formPinNow(popup) !== _baseline.pinned || formTagsNow(popup) !== _baseline.tags;
  }
  function requestCloseForm(popup) {
    if (formDirty()) confirmDiscard(() => closeForm(popup));
    else closeForm(popup);
  }
  function closeForm(popup) {
    var _a;
    _baseline = null;
    _saving = false;
    closeMenu();
    ((_a = popup.closest(".bz-fav-form-mask")) != null ? _a : popup).remove();
  }
  function inputVal(popup, id) {
    var _a, _b;
    return (_b = (_a = popup.querySelector(id)) == null ? void 0 : _a.value) != null ? _b : "";
  }
  function openForm(item) {
    var _a, _b, _c;
    ensureFavoritesEsc();
    const it = item;
    const mask = document.createElement("div");
    mask.className = "bz-fav-form-mask bz-fav-scope";
    mask.innerHTML = formHtml(it);
    document.body.appendChild(mask);
    topifyZ(mask);
    mountIcons(mask);
    const popup = mask.querySelector(".bz-fav-form");
    _baseline = {
      title: (it == null ? void 0 : it.title) || "",
      url: (it == null ? void 0 : it.url) || "",
      desc: (it == null ? void 0 : it.description) || "",
      pinned: !!(it == null ? void 0 : it.pinned),
      // 与 DOM 脏比较同口径（只数九类 chip）：TAGS 外标签不进基线，一开表单不误判脏（F10）
      tags: ((it == null ? void 0 : it.tags) || []).filter((t) => TAGS.some((x) => x.label === t)).sort().join("|")
    };
    const titleInp = popup.querySelector("#fz-title");
    const urlInp = popup.querySelector("#fz-url");
    titleInp.addEventListener("paste", (e) => {
      var _a2, _b2;
      const text = ((_b2 = (_a2 = e.clipboardData || window.clipboardData) == null ? void 0 : _a2.getData("text")) == null ? void 0 : _b2.trim()) || "";
      if (!isUrlLike(text)) return;
      e.preventDefault();
      if (!urlInp.value.trim()) urlInp.value = normalizeUrl(text);
      setTimeout(() => titleInp.focus(), 0);
    });
    const pick = popup.querySelector("#fz-tags");
    const sel = new Set((it == null ? void 0 : it.tags) || []);
    const drawPick = () => {
      pick.innerHTML = pickChipsHtml(sel);
      pick.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
        const label = b.dataset.tag;
        if (sel.has(label)) sel.delete(label);
        else sel.add(label);
        b.classList.toggle("bz-fav-on", sel.has(label));
      }));
      mountIcons(pick);
    };
    drawPick();
    const pinEl = popup.querySelector("#fz-pin");
    pinEl.addEventListener("click", () => pinEl.classList.toggle("bz-fav-on"));
    const errEl = popup.querySelector("#fz-err");
    mask.addEventListener("mousedown", (e) => {
      if (e.target === mask) requestCloseForm(popup);
    });
    (_a = popup.querySelector("[data-fz-cancel]")) == null ? void 0 : _a.addEventListener("click", () => requestCloseForm(popup));
    (_b = popup.querySelector("#fz-ai")) == null ? void 0 : _b.addEventListener("click", () => void runAiFill(popup, sel, drawPick, errEl));
    (_c = popup.querySelector("#fz-save")) == null ? void 0 : _c.addEventListener("click", () => void saveForm(popup, it, sel, errEl));
    setTimeout(() => {
      var _a2;
      return (_a2 = popup.querySelector("#fz-title")) == null ? void 0 : _a2.focus();
    }, 100);
  }
  async function runAiFill(popup, sel, redraw, errEl) {
    const ai = aiServiceOf();
    if (!ai.isAvailable()) {
      notice("AI 服务未配置或不可用", "warning");
      return;
    }
    const title = inputVal(popup, "#fz-title").trim();
    const url = inputVal(popup, "#fz-url").trim();
    const desc = inputVal(popup, "#fz-desc").trim();
    if (!title && !url && !desc) {
      notice("请至少输入标题、链接或简介中的一项，以便 AI 参考");
      return;
    }
    const btn = popup.querySelector("#fz-ai");
    const aiLabel = btn.lastElementChild;
    btn.disabled = true;
    aiLabel.textContent = "AI 整理中…";
    const handle = notify("AI 分析中…", { type: "progress" });
    try {
      let ghInfo = null;
      if (/github\.com\//.test(url)) {
        try {
          ghInfo = await ai.fetchGitHubInfo(url);
          handle.setMessage(ghInfo.fetched ? "已获取仓库信息，正在整理…" : "仓库简介获取失败，按常规整理…");
        } catch (e) {
          ghInfo = null;
        }
      }
      const text = aiPrompt(title, url, desc, ghInfo);
      if (!ai.ai) throw new Error("AI 服务不可用");
      const raw = await ai.ai.chat(text);
      const data = parseAiJson(raw);
      if (!data) throw new Error("AI 返回格式错误");
      const setVal = (id, v) => {
        const el = popup.querySelector(id);
        if (el && !el.value.trim() && v) el.value = String(v);
      };
      if (ghInfo == null ? void 0 : ghInfo.fetched) setVal("#fz-title", ghInfo.title);
      setVal("#fz-title", data.title);
      setVal("#fz-url", data.url);
      setVal("#fz-desc", data.description);
      const rawTags = Array.isArray(data.tags) ? data.tags.map((x) => String(x)) : data.tags ? [String(data.tags)] : [];
      const known = TAGS.map((t) => t.label);
      const valid = rawTags.filter((t) => known.includes(t));
      const unknown = rawTags.filter((t) => !known.includes(t));
      if (unknown.length) notice(`AI 整理的标签「${unknown.join("、")}」不在列表中，已忽略`, "warning");
      if (ghInfo && !valid.includes("GitHub")) valid.unshift("GitHub");
      sel.clear();
      valid.forEach((t) => sel.add(t));
      redraw();
      handle.setType("success");
      handle.setMessage("AI 整理完成");
    } catch (e) {
      handle.setType("error");
      handle.setMessage(`AI 整理失败：${(e == null ? void 0 : e.message) || "未知错误"}`);
    } finally {
      btn.disabled = false;
      aiLabel.textContent = "AI 整理";
      errEl.textContent = "";
    }
  }
  function aiPrompt(title, url, desc, ghInfo) {
    const known = TAGS.map((t) => t.label).join("、");
    const base = `你是收藏整理助手。把用户输入的收藏信息整理成 JSON（只输出 JSON，不输出任何多余文字），严格以下格式：
{"title":"标题","url":"链接","description":"简介","tags":["标签1","标签2"]}
规则：
- 标题 ≤ 10 字；
- 简介 20-50 字；
- 链接缺协议头自动补 https://，无法判断则原样返回；
- 标签只能从固定列表选 1-3 个：${known}；
- 简介必须忠实，禁止编造。`;
    const gh = ghInfo ? `
GitHub 仓库：${ghInfo.title}
仓库简介${ghInfo.fetched ? "" : "（获取失败，简介必须返回空字符串，严禁编造或自行生成简介）"}：${ghInfo.description}
- 简介忠实翻译成中文（保持原意，不扩写、不总结、不凑字数；若原简介已是中文则原样保留）；
- GitHub 链接必须包含 GitHub 标签。` : "";
    return `${base}${gh}
输入：标题「${title}」链接「${url}」简介「${desc}」`;
  }
  function parseAiJson(raw) {
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      return o && typeof o === "object" ? o : null;
    } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch (e2) {
        return null;
      }
    }
  }
  async function saveForm(popup, it, sel, errEl) {
    if (_saving) return;
    const title = inputVal(popup, "#fz-title").trim();
    const url = inputVal(popup, "#fz-url").trim();
    if (!title) {
      errEl.textContent = "请输入标题";
      return;
    }
    if (url && !/^https?:\/\//i.test(url)) {
      errEl.textContent = "链接需以 http(s):// 开头";
      return;
    }
    if (sel.size === 0) {
      errEl.textContent = "请至少选择一个标签";
      return;
    }
    const desc = inputVal(popup, "#fz-desc").trim();
    const tags = [...sel];
    const pin = formPinNow(popup);
    _saving = true;
    const saveBtn = popup.querySelector("#fz-save");
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中…";
    const dm = dataManagerOf();
    try {
      if (it) {
        const old = it;
        const next = {
          ...old,
          title,
          url,
          description: desc,
          tags,
          pinned: pin
        };
        const changes = favoritesEditChanges(old, next);
        await dm.update(old.id, next);
        emitDomainEvent("favorites", { kind: "edit", title: next.title, changes });
        notice("收藏已更新", "success");
      } else {
        const data = {
          id: Date.now().toString(),
          tags,
          title,
          description: desc,
          pinned: pin,
          url,
          balance: null,
          balanceCacheTime: null,
          balanceError: null,
          linkedNote: null,
          created: localNow(),
          type: tags[0]
        };
        await dm.add(data);
        emitDomainEvent("favorites", { kind: "add", item: data });
        notice("收藏已添加", "success");
      }
      closeForm(popup);
      await reload();
    } catch (e) {
      notice(`保存失败：${(e == null ? void 0 : e.message) || "未知错误"}`, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = it ? "更新" : "保存";
    } finally {
      _saving = false;
    }
  }

  // prototypes/favorites/fake-sim.ts
  var VAULT_KEY = "bz-sim:CONFIG/STORAGE/favorites.json";
  var _app3 = null;
  var _dm2 = null;
  var _ai2 = null;
  function seedDatabase() {
    const src = window.FAV || window.parent && window.parent.FAV || null;
    const items = (src == null ? void 0 : src.ITEMS) || [];
    if (!localStorage.getItem(VAULT_KEY)) {
      localStorage.setItem(VAULT_KEY, JSON.stringify(items, null, 2));
    }
    const app = new FakeApp();
    setApp(app);
    _app3 = app;
    _dm2 = new DataManager(getStoragePath());
    _ai2 = new FavoritesAIService();
    initFavoritesUI(_app3, _dm2, _ai2);
  }
  function injectSettings() {
    setSettingsProvider(
      () => ({})
    );
  }
  function bootFavoritesSim() {
    const g = window;
    if (g.__bzFavSimBooted) return;
    g.__bzFavSimBooted = true;
    seedDatabase();
    injectSettings();
  }
  function openPanel2() {
    bootFavoritesSim();
    openPanel(_app3, _dm2, _ai2);
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
