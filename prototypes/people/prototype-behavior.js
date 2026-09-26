/* 源指纹 aae39f8ded7babf4 · 仓内输入 53 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/people/fake-sim.ts","prototypes/people/fake/fake-obsidian.ts","src/core/ai.ts","src/core/app.ts","src/core/crypto.ts","src/core/dom.ts","src/core/esc-manager.ts","src/core/mobile.ts","src/core/model-limits.ts","src/core/notice.ts","src/core/settings-provider.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/z-order.ts","src/people/data.ts","src/people/datasource.ts","src/people/digest.ts","src/people/incremental.ts","src/people/insights.ts","src/people/jobs.ts","src/people/media.ts","src/people/parse.ts","src/people/render.ts","src/people/settings.ts","src/people/stats.ts","src/people/types.ts","src/people/ui.ts"]*/
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

  // prototypes/people/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootPeopleSim: () => bootPeopleSim,
    demoOpenDataSource: () => demoOpenDataSource,
    demoReset: () => demoReset,
    openPanel: () => openPanel,
    togglePanel: () => togglePanel
  });

  // prototypes/people/fake/fake-obsidian.ts
  var import_moment = __toESM(require_moment());
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768
  };
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
  var FakeWorkspace = class {
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
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
      this.workspace = new FakeWorkspace();
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
  function tryGetSettings() {
    return _provider ? _provider() : {};
  }

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

  // src/core/z-order.ts
  var zCounter = 1e5;
  var alwaysOnTop = /* @__PURE__ */ new Set();
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
  var OUT_CLASS = {
    drop: "bz-notice--out-drop",
    pop: "bz-notice--out-pop",
    "slide-left": "bz-notice--out-left",
    "slide-right": "bz-notice--out-right",
    bounce: "bz-notice--out-fade",
    shake: "bz-notice--out-fade"
  };
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
  var POSITION_CLASSES = ["bz-notice-pos--bottom-right", "bz-notice-pos--bottom-left", "bz-notice-pos--top-left"];
  function applyPositionClass(container) {
    const pos = noticePref("noticePosition");
    container.classList.remove(...POSITION_CLASSES);
    const cls = pos === "bottom-right" || pos === "bottom-left" || pos === "top-left" ? `bz-notice-pos--${pos}` : "";
    if (cls) container.classList.add(cls);
  }
  var PER_CHAR_MS = 60;
  var SHORT_THRESHOLD = 20;
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
    var _a2;
    (_a2 = panelEscHandles.get(id)) == null ? void 0 : _a2.unregister();
    panelEscHandles.delete(id);
  }

  // src/core/ui/focus-trap.ts
  var FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
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
  var PANEL_FOCUS_CLASS = "bz-panel-focushost";
  function trapPanelFocus(panel) {
    panel.classList.add(PANEL_FOCUS_CLASS);
    if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    const release = trapFocus(panel);
    panel.focus({ preventScroll: true });
    return release;
  }

  // src/core/storage.ts
  var DEFAULT_STORAGE_DIR = "CONFIG/STORAGE";
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
  var fileTaskQueues = /* @__PURE__ */ new Map();
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

  // src/people/types.ts
  function personOf(d) {
    var _a2, _b2;
    return (_b2 = (_a2 = d == null ? void 0 : d.person) != null ? _a2 : d == null ? void 0 : d.portrait) != null ? _b2 : "";
  }
  function bondOf(d) {
    var _a2;
    return (_a2 = d == null ? void 0 : d.bond) != null ? _a2 : "";
  }
  function emptyPeopleData() {
    return { version: 1, people: [] };
  }

  // src/people/data.ts
  function getPeopleFilePath() {
    const s = tryGetSettings();
    return storageFile("people.json", s && s.storagePath || "CONFIG/STORAGE");
  }
  var PeopleStore = class {
    constructor(app) {
      this.app = app;
      this.filePath = getPeopleFilePath();
    }
    open() {
      return jsonFileStore(this.filePath, { defaultValue: emptyPeopleData, app: this.app });
    }
    /** 人物列表（建卡时间升序） */
    async list() {
      return enqueueFileTask(this.filePath, async () => {
        const data = await this.open().read();
        return [...data.people].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      });
    }
    /** 新增或整体替换人物卡（按 id） */
    async upsert(entry) {
      await enqueueFileTask(this.filePath, async () => {
        const store2 = this.open();
        const data = await store2.read();
        const i = data.people.findIndex((p) => p.id === entry.id);
        if (i >= 0) data.people[i] = entry;
        else data.people.push(entry);
        await store2.write(data);
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
      if (fromId === toId) return;
      await enqueueFileTask(this.filePath, async () => {
        var _a2, _b2, _c, _d;
        const store2 = this.open();
        const data = await store2.read();
        const from = data.people.find((p) => p.id === fromId);
        const to = data.people.find((p) => p.id === toId);
        if (!from || !to) throw new Error(`人物不存在: ${!from ? fromId : toId}`);
        to.imports.push(...from.imports);
        to.imports.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
        to.manualEvents = [...(_a2 = to.manualEvents) != null ? _a2 : [], ...(_b2 = from.manualEvents) != null ? _b2 : []].sort((a, b) => a.ts.localeCompare(b.ts));
        if (!to.profile && from.profile) to.profile = from.profile;
        if (!to.digest && from.digest) to.digest = from.digest;
        to.lastProcessedTs = Math.max((_c = to.lastProcessedTs) != null ? _c : 0, (_d = from.lastProcessedTs) != null ? _d : 0);
        data.people = data.people.filter((p) => p.id !== fromId);
        await store2.write(data);
      });
    }
    async remove(id) {
      await enqueueFileTask(this.filePath, async () => {
        const store2 = this.open();
        const data = await store2.read();
        data.people = data.people.filter((p) => p.id !== id);
        await store2.write(data);
      });
    }
    /** 队列内单人物变更（不存在抛错——静默丢失比失败更糟） */
    async mutate(id, fn) {
      await enqueueFileTask(this.filePath, async () => {
        const store2 = this.open();
        const data = await store2.read();
        const p = data.people.find((x) => x.id === id);
        if (!p) throw new Error(`人物不存在: ${id}`);
        fn(p);
        await store2.write(data);
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
    const overrideModel = (_a2 = s.aiModelOverrides) == null ? void 0 : _a2[name];
    const overrideMaxTokens = (_b2 = s.aiMaxTokensOverrides) == null ? void 0 : _b2[name];
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
    fingerprintOf: () => fingerprintOf,
    getJobsFilePath: () => getJobsFilePath,
    pauseJobs: () => pauseJobs,
    removeJob: () => removeJob,
    resume: () => resume,
    resumeJobs: () => resumeJobs,
    snapshot: () => snapshot,
    startJobs: () => startJobs,
    subscribe: () => subscribe,
    whenIdle: () => whenIdle
  });

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
  function emptyPreviewData() {
    return { version: 1, contacts: {} };
  }
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
      let out = null;
      switch (raw.type) {
        case 1:
          out = text2 || null;
          break;
        case 34: {
          if (!opts.previewVoice) continue;
          const tagged = text2 ? parseMediaTag(text2) : null;
          if (tagged) {
            out = text2;
            bumpEmotion(tagged.emotion);
            break;
          }
          const v = voiceByWav.get(String((_i = raw.wav) != null ? _i : "").trim());
          const merged = buildVoiceText(raw, v);
          const parsed = parseMediaTag(merged);
          if (!parsed) continue;
          out = merged;
          bumpEmotion(parsed.emotion);
          break;
        }
        case 3: {
          if (opts.imageDescMode !== "file") continue;
          const hit = matchImageDesc(raw, descByFile, descByMonth, descUsed);
          out = hit ? `[图片] ${hit}` : null;
          break;
        }
        case 43: {
          if (!opts.previewVideo) continue;
          const dur = Number.isFinite(raw.dur) && raw.dur > 0 ? Math.round(raw.dur) : 0;
          if (!dur) continue;
          out = `[视频 ${dur}秒]`;
          break;
        }
        case 47: {
          signals.emojiCount++;
          if (!EMOJI_NAMED_RE.test(text2)) continue;
          out = text2;
          signals.emojiNamedCount++;
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
            out = text2 || null;
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
          if (!opts.keepSystem) continue;
          out = text2 || null;
          break;
        }
        default:
          continue;
      }
      if (!out) continue;
      const who = String((_j = raw.who) != null ? _j : "").trim();
      if (group && who && !isSelfWho(who) && raw.type !== 1e4) out = `[${who}] ${out}`;
      msgs.push({ key: msgKey(raw), ts, isSender: isSelfWho(raw.who), text: out.replace(/\r\n?/g, "\n") });
    }
    msgs.sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
    const stats = previewStatsOf(msgs);
    const insights = computeInsights(msgs, signals);
    return { msgs, kindCounts, stats, insights, maxSid, skippedCount: Math.max(0, rawTotal - msgs.length) };
  }
  function bump(counts, kind) {
    var _a2;
    counts[kind] = ((_a2 = counts[kind]) != null ? _a2 : 0) + 1;
  }
  function previewStatsOf(msgs) {
    const unified = msgs.map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
    const media = collectMediaStats(unified);
    return { msgCount: msgs.length, voiceCount: media.voiceCount, voiceTotalSec: media.voiceTotalSec, imageCount: media.imageCount };
  }
  function mergePreview(existing, incoming, nowIso2) {
    var _a2, _b2, _c, _d;
    const seen = new Set(((_a2 = existing == null ? void 0 : existing.msgs) != null ? _a2 : []).map((m) => m.key));
    const fresh = incoming.msgs.filter((m) => !seen.has(m.key));
    const msgs = [...(_b2 = existing == null ? void 0 : existing.msgs) != null ? _b2 : [], ...fresh].sort((a, b) => a.ts - b.ts || a.key.localeCompare(b.key));
    const contact = {
      msgs,
      watermarkSid: Math.max((_c = existing == null ? void 0 : existing.watermarkSid) != null ? _c : 0, incoming.maxSid),
      stats: previewStatsOf(msgs),
      // 全量形态计数 / 互动画像每次导入重算覆盖（normalize 按原始消息全量跑，幂等；不随增量累加）
      kindCounts: { ...(_d = existing == null ? void 0 : existing.kindCounts) != null ? _d : {}, ...incoming.kindCounts },
      insights: incoming.insights,
      updatedAt: nowIso2
    };
    return { contact, added: fresh.length };
  }
  function previewToUnified(msgs) {
    return msgs.map((m) => ({ ts: m.ts, isSender: m.isSender, text: m.text }));
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
  function avatarFileOf(fs, dir) {
    for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
      const p = `${dir}/avatar.${ext}`;
      try {
        if (fs.existsSync(p)) return p;
      } catch (e) {
      }
    }
    return null;
  }
  function getPreviewFilePath() {
    const s = tryGetSettings();
    return storageFile("people-preview.json", s && s.storagePath || "CONFIG/STORAGE");
  }
  var PreviewStore = class {
    constructor(app) {
      this.app = app;
      this.filePath = getPreviewFilePath();
    }
    open() {
      return jsonFileStore(this.filePath, { defaultValue: emptyPreviewData, app: this.app });
    }
    async read() {
      return enqueueFileTask(this.filePath, async () => this.open().read());
    }
    /** 合并写回一位联系人（读→改→写整体入队） */
    async upsertContact(name, contact) {
      await enqueueFileTask(this.filePath, async () => {
        const store2 = this.open();
        const data = await store2.read();
        data.contacts[name] = contact;
        await store2.write(data);
      });
    }
    /** 清空全部预览（保留文件框架；不动 people.json 的 PersonEntry） */
    async clear() {
      await enqueueFileTask(this.filePath, async () => {
        const store2 = this.open();
        await store2.write(emptyPreviewData());
      });
    }
  };
  function previewMediaBadge(stats) {
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
  function getJobsFilePath() {
    const s = tryGetSettings();
    return storageFile("people-jobs.json", s && s.storagePath || "CONFIG/STORAGE");
  }
  var JobStore = class {
    constructor(app) {
      this.app = app;
      this.filePath = getJobsFilePath();
    }
    open() {
      return jsonFileStore(this.filePath, { defaultValue: emptyJobsData, app: this.app });
    }
    async read() {
      return enqueueFileTask(this.filePath, async () => this.open().read());
    }
    /** 整文件写回（引擎是本会话唯一写方；队列整体在内存，读→改→写整体入队） */
    async write(data) {
      await enqueueFileTask(this.filePath, async () => {
        await this.open().write(data);
      });
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
  function hash322(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }
  function fingerprintOf(msgs) {
    const last = msgs[msgs.length - 1];
    return { msgCount: msgs.length, lastMsgKey: last ? `${last.ts}|${hash322(last.text)}` : "" };
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
    if (prev.msgCount !== fp.msgCount || prev.lastMsgKey !== fp.lastMsgKey) return false;
    if (prev.mode !== mode) return false;
    const po = { ...DEFAULTS, ...prev.chunkOpts };
    return po.maxChars === opts.maxChars && po.maxCount === opts.maxCount && po.maxBatches === opts.maxBatches;
  }
  async function startJobs(app, targets, opts = {}) {
    var _a2, _b2, _c, _d, _e, _f;
    if (!st) {
      st = {
        app,
        store: new JobStore(app),
        queue: [],
        injected: null,
        retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
        runningJob: null,
        pauseRequested: false
      };
    }
    st.app = app;
    st.store = new JobStore(app);
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
      const fp = fingerprintOf(t.msgs);
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
        lastMsgKey: fp.lastMsgKey,
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
    if (st) {
      st.app = app;
      return;
    }
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
      queue,
      injected: ai.askExtract || ai.askPortrait ? ai : null,
      retry: { maxRetries: DEFAULT_MAX_RETRIES, sleep: realSleep },
      runningJob: null,
      pauseRequested: false
    };
    runPromise = null;
    if (dirty) await store2.write({ version: 1, queue });
    emit();
  }
  function resume(talker) {
    if (!st) return false;
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
      if (!st || st.pauseRequested) break;
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
    var _a2, _b2, _c;
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
      const pv = await new PreviewStore(st.app).read();
      if (gone(job)) return;
      const contact = pv.contacts[job.talker];
      const bucketMsgs = contact ? previewToUnified(contact.msgs) : [];
      const fp = fingerprintOf(bucketMsgs);
      if (fp.msgCount !== job.msgCount || fp.lastMsgKey !== job.lastMsgKey) {
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
        mediaNote: (_a2 = job.material) == null ? void 0 : _a2.mediaNote,
        statsNote: (_b2 = job.material) == null ? void 0 : _b2.statsNote,
        profileNote: (_c = job.material) == null ? void 0 : _c.profileNote,
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
    const norm = path.replace(/\\/g, "/");
    if (typeof window !== "undefined") {
      const base = window.BZW_MEDIA_BASE;
      if (base) return base + encodeURI(norm).replace(/#/g, "%23").replace(/\?/g, "%3F");
    }
    if (/^(https?:)?\/\//.test(norm) || norm.startsWith("/")) return norm;
    const rel = norm.replace(/^[A-Za-z]:/, "").replace(/^\/+/, "");
    return `app://local/${encodeURI(rel).replace(/#/g, "%23").replace(/\?/g, "%3F")}`;
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
    b.appendChild(el("img", "", { src: localResourceUri(avatar), alt: p.name }));
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
      opts.avatar ? el("img", "bz-people-dt-avatar", { src: localResourceUri(opts.avatar), alt: p.name }) : el("div", "bz-people-dt-seal", { style: `background:${avatarColor(p.name)}` }, text(initials(p.name))),
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
  function socialRow(platform, handle) {
    return el("div", "bz-people-prof-social-row", [
      profInput(platform, "平台（微信 / 微博…）", ["data-people-prof-social-platform", ""], "bz-people-prof-input bz-people-prof-social-platform"),
      profInput(handle, "账号", ["data-people-prof-social-handle", ""], "bz-people-prof-input bz-people-prof-social-handle"),
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
      row.avatar ? el("img", "bz-people-ds-ava bz-people-ds-ava-img", { src: localResourceUri(row.avatar), alt: row.name }) : el("div", "bz-people-ds-ava", { style: `background:${avatarColor(row.name)}` }, text(initials(row.name))),
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
    pop.appendChild(el("div", "bz-people-ds-head", [
      el("div", "bz-people-ds-title", text("数据源")),
      el("div", "bz-people-ds-headmeta", text([
        s.scanning ? "正在扫描…" : s.rows ? `${s.rows.length} 位联系人` : "",
        s.hiddenGroups > 0 ? `${s.hiddenGroups} 个群聊未纳入` : ""
      ].filter(Boolean).join(" · "))),
      iconButton(
        "refresh-cw",
        `bz-people-btn bz-people-btn-ghost bz-people-icon-btn bz-people-ds-rescan${s.scanning ? " bz-people-spin" : ""}`,
        { "data-people-ds-scan": "", "aria-label": s.scanning ? "扫描中" : "重扫", title: s.scanning ? "扫描中…" : "重扫" }
      )
    ]));
    pop.appendChild(el("div", "bz-people-ds-path", text(s.dataDir || "尚未配置数据文件夹——到「设置 → 脸谱」粘贴预处理导出目录。" + (s.scannedAt ? ` · 扫描于 ${s.scannedAt}` : ""))));
    if (s.desktopOnly) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("数据源扫描仅桌面端支持（需要读取库外文件夹）。")));
    } else if (s.scanning) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("正在扫描数据文件夹…")));
    } else if (!s.rows) {
      pop.appendChild(el("div", "bz-people-ds-empty", text("还没扫描。点右上刷新图标读取数据文件夹里的联系人。")));
    } else if (!s.rows.length) {
      pop.appendChild(el("div", "bz-people-ds-empty", text(
        s.hiddenGroups > 0 ? `没有可导入的单聊（另有 ${s.hiddenGroups} 个群聊未纳入，可在设置开启）。` : "数据文件夹里没有找到联系人（各联系人目录下需有 chat.json）。"
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
      ...s.generateable && !s.importing ? [button("bz-people-btn bz-people-btn-acc", "画脸谱", { "data-people-ds-generate": "", title: "关闭弹窗，用预览素材生成脸谱" })] : [],
      button("bz-people-btn bz-people-btn-acc", s.importing ? "导入中…" : "导入所选", { "data-people-ds-import": "" })
    ]);
    pop.appendChild(foot);
    if (s.notice) pop.appendChild(el("div", "bz-people-ds-notice", { "data-people-ds-notice": "" }, text(s.notice)));
    wrap.appendChild(pop);
    return wrap;
  }
  function footerLabel(s) {
    if (!s.rows) return "";
    if (!s.selectedCount) return "未勾选联系人";
    return s.freshCount ? `已选 ${s.selectedCount} 位 · 新素材 ${s.freshCount} 条` : `已选 ${s.selectedCount} 位 · 所选暂无新素材`;
  }
  function importMeta(rec, textMsgs) {
    return `${rec.timeFrom.slice(0, 7)} ~ ${rec.timeTo.slice(0, 7)} · 共 ${formatCount(textMsgs)} 条文本（形态占比含图片/语音等全部消息形态）`;
  }

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

  // src/people/ui.ts
  var ESC_ID = "people-panel";
  var overlay = null;
  var store = null;
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
  function openPeoplePanel(app) {
    var _a2;
    if (overlay) {
      topifyZ(overlay);
      return;
    }
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
    void renderBody();
    void restoreJobsView();
  }
  function closePeoplePanel() {
    const backgrounded = jobsRunning();
    unregisterPanelEsc(ESC_ID);
    overlay == null ? void 0 : overlay.remove();
    overlay = null;
    store = null;
    detailId = null;
    detailFold = "p";
    stage = "list";
    listCache = [];
    previewCache = null;
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
      const badge = previewMediaBadge(c.stats);
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
      scannedAt: dsScannedAt
    };
  }
  async function runScan(force = false) {
    var _a2, _b2, _c, _d;
    const dataDir = dsDataDir();
    if (!overlay || !store || !dataDir || dsScanning || dsImporting || jobsBusy()) return;
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
      const previewStore = new PreviewStore(getApp());
      const [previewData2, people] = await Promise.all([previewStore.read(), store.list()]);
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
        const pv = previewData2.contacts[name];
        const keys = new Set(((_b2 = pv == null ? void 0 : pv.msgs) != null ? _b2 : []).map((m) => m.key));
        const entry = people.find((p) => p.id === name);
        contacts.push({
          name,
          rawCount: bundle.raws.length,
          isGroup: group,
          stats: norm.stats,
          previewCount: (_c = pv == null ? void 0 : pv.msgs.length) != null ? _c : 0,
          newCount: norm.msgs.reduce((s, m) => s + (keys.has(m.key) ? 0 : 1), 0),
          processedTs: (_d = entry == null ? void 0 : entry.lastProcessedTs) != null ? _d : null,
          avatar: bundle.avatar
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
    const dataDir = dsDataDir();
    if (!overlay || !dataDir || dsImporting || dsScanning || jobsBusy()) return;
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
    dsNotice = "正在导入预览…";
    renderBody();
    const opts = normalizeOptionsFromSettings();
    const previewStore = new PreviewStore(getApp());
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
        const existing = (await previewStore.read()).contacts[c.name];
        const { contact, added } = mergePreview(existing, norm, now);
        if (bundle.avatar) contact.avatar = bundle.avatar;
        await previewStore.upsertContact(c.name, contact);
        addedOf.set(c.name, added);
        c.previewCount = contact.msgs.length;
        c.newCount = 0;
        c.stats = contact.stats;
      }
    } catch (e) {
      console.warn("[people] 预览导入失败:", e);
      dsNotice = "导入失败：读数据文件时出错。";
      dsImporting = false;
      renderBody();
      return;
    }
    dsImporting = false;
    previewCache = null;
    const fresh = [...addedOf.values()].reduce((s, n) => s + n, 0);
    const summary = `已导入预览（新增 ${fresh} 条）${readFail.length ? ` · ${readFail.length} 位读文件失败` : ""}`;
    dsNotice = fresh > 0 && !readFail.length ? `${summary}。点「画脸谱」调用 AI 生成。` : summary;
    dsGenerateable = fresh > 0 && !readFail.length;
    renderBody();
  }
  async function generateFromDs() {
    var _a2;
    if (!overlay || !store || dsImporting || dsScanning) return;
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
      const previewData2 = await new PreviewStore(getApp()).read();
      for (const name of names) {
        const pv = previewData2.contacts[name];
        if (!(pv == null ? void 0 : pv.msgs.length)) continue;
        targets.push({
          talker: name,
          name,
          msgs: previewToUnified(pv.msgs),
          kindCounts: (_a2 = pv.kindCounts) != null ? _a2 : {},
          skippedCount: 0,
          // 预览桶内全是有效文本；原始过滤数已计入 chat.json 口径，不在导入记录重复报
          fileLabel: `数据源:${name}`,
          insights: pv.insights
        });
      }
    } catch (e) {
      console.warn("[people] 读取预览桶失败:", e);
      dsNotice = "生成失败：读不到预览缓存。";
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
    var _a2;
    const name = id != null ? id : detailId;
    if (!store || !name) return;
    if (!opts.force && resumeExisting(name)) return;
    if (jobsBusy()) {
      notice("已有生成在进行——等它完成或暂停后再画", "info");
      return;
    }
    let target = null;
    try {
      const pv = (await new PreviewStore(getApp()).read()).contacts[name];
      if (pv == null ? void 0 : pv.msgs.length) {
        target = {
          talker: name,
          name,
          msgs: previewToUnified(pv.msgs),
          kindCounts: (_a2 = pv.kindCounts) != null ? _a2 : {},
          skippedCount: 0,
          fileLabel: `数据源:${name}`,
          insights: pv.insights
        };
      }
    } catch (e) {
      console.warn("[people] 读取预览桶失败:", e);
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
    const { runnable, skipped } = await planTargets(targets);
    for (const t of runnable) {
      targetsInFlight.set(t.talker, t);
      jobsPersisted.delete(t.talker);
    }
    let engineSkipped = 0;
    let resumed = [];
    if (runnable.length) {
      const res = await jobs().startJobs(getApp(), runnable, {});
      engineSkipped = res.skipped.length;
      resumed = (_a2 = res.resumed) != null ? _a2 : [];
      await ensureJobsWatch();
    }
    const started = runnable.length - engineSkipped;
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
    const runnable = [];
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
      runnable.push({ ...t, profile: existing == null ? void 0 : existing.profile, monthly: mergedMonthlyOf((_a2 = existing == null ? void 0 : existing.imports) != null ? _a2 : []) });
    }
    return { runnable, skipped };
  }
  async function persistJobDone(job, target) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
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
      const lastTs = msgs ? msgs[msgs.length - 1].ts : Number(String((_u = job.lastMsgKey) != null ? _u : "").split("|")[0]);
      if (Number.isFinite(lastTs)) {
        await store2.setLastProcessedTs(talker, Math.max((_v = existing == null ? void 0 : existing.lastProcessedTs) != null ? _v : 0, lastTs));
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
  }
  async function sealAction(kind, id) {
    var _a2;
    const api = jobs();
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
    if (t.closest("[data-people-ds-scan]")) {
      void runScan(true);
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
    var _a2;
    const body = overlay == null ? void 0 : overlay.querySelector("[data-people-body]");
    if (!body || !store || !overlay) return;
    const people = await wallPeople();
    if (stage === "list") await renderList(body, people);
    else await renderDetail(body, people);
    (_a2 = overlay.querySelector(".bz-people-panel")) == null ? void 0 : _a2.classList.toggle("bz-people-panel-detail", stage === "detail");
    renderDsLayer();
    renderPopLayer(people);
    renderJobs();
    mountIcons(overlay);
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
  var previewCache = null;
  async function previewData() {
    if (previewCache) return previewCache;
    try {
      previewCache = await new PreviewStore(getApp()).read();
    } catch (e) {
      console.warn("[people] 读取预览桶失败:", e);
      previewCache = { version: 1, contacts: {} };
    }
    return previewCache;
  }
  function poolRecord(id, contact) {
    var _a2, _b2, _c, _d, _e, _f, _g;
    if (!contact) return null;
    const msgs = (_a2 = contact.msgs) != null ? _a2 : [];
    if (!msgs.length) return null;
    return {
      file: `数据源:${id}`,
      importedAt: contact.updatedAt || new Date(msgs[msgs.length - 1].ts).toISOString(),
      messageCount: msgs.length,
      skippedCount: 0,
      timeFrom: new Date(msgs[0].ts).toISOString(),
      timeTo: new Date(msgs[msgs.length - 1].ts).toISOString(),
      // issue 454：媒体计数取预览桶侧写（导入时从原始消息算的，语音总时长只有它知道）——
      // 缺了它，合成卡与详情头的「语音 / 图片」永远是「—」（大琳 1289 条语音 / 1615 张图看不见）。
      // 只带媒体三项：月度 / 时段明细预览桶没有，不在这编造——「数据」折见无 monthly 即出占位。
      stats: {
        voiceCount: (_c = (_b2 = contact.stats) == null ? void 0 : _b2.voiceCount) != null ? _c : 0,
        voiceTotalSec: (_e = (_d = contact.stats) == null ? void 0 : _d.voiceTotalSec) != null ? _e : 0,
        imageCount: (_g = (_f = contact.stats) == null ? void 0 : _f.imageCount) != null ? _g : 0
      }
    };
  }
  async function wallPeople() {
    var _a2;
    const people = store ? await store.list() : [];
    const contacts = (_a2 = (await previewData()).contacts) != null ? _a2 : {};
    const out = people.map((p) => {
      const rec = p.imports.length ? null : poolRecord(p.id, contacts[p.id]);
      return rec ? { ...p, imports: [rec] } : p;
    });
    const known = new Set(people.map((p) => p.id));
    for (const [id, contact] of Object.entries(contacts)) {
      if (known.has(id)) continue;
      const rec = poolRecord(id, contact);
      if (!rec) continue;
      out.push({ id, name: id, createdAt: rec.importedAt, imports: [rec] });
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
    const preview = await previewData();
    applyWall(people, wall, (name) => {
      var _a3;
      return (_a3 = preview.contacts[name]) == null ? void 0 : _a3.avatar;
    });
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
    var _a2;
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
    const avatar = (_a2 = (await previewData()).contacts[p.name]) == null ? void 0 : _a2.avatar;
    body.appendChild(foldDetailHead(p, media, { canGenerate: !p.digest, job: sealJobOf(jobViews().get(p.id)), avatar }));
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
              name: "数据文件夹",
              desc: "预处理导出的联系人数据目录，粘贴完整路径；空 = 面板不显示数据源入口",
              binding: { key: "peopleDataDir" },
              placeholder: "例如 D:\\微信备份\\export_full"
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
          name: "预览",
          rows: [
            {
              type: "toggle",
              name: "语音转写",
              desc: "语音消息以转写文本进预览",
              binding: { key: "peoplePreviewVoice" }
            },
            {
              type: "select",
              name: "图片描述",
              desc: "有描述的图片以描述文本进预览（chat.json 已回填，读文件为兼容兜底）；无描述只计数",
              binding: { key: "peopleImageDescMode" },
              options: [
                { value: "file", label: "文件描述" },
                { value: "off", label: "仅标签" }
              ]
            },
            {
              type: "toggle",
              name: "视频标签",
              desc: "视频消息以时长标签进预览",
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
              name: "原始媒体不入库",
              desc: "图片语音视频文件留在外部数据目录，不复制进库"
            },
            {
              type: "info",
              name: "预览只存文本",
              desc: "语音转写与图片描述以文本进预览缓存"
            },
            {
              type: "button",
              name: "清空预览",
              buttonText: "清空",
              cta: true,
              desc: "清掉全部导入预览缓存，不动已生成的脸谱",
              onClick: () => {
                var _a2;
                return void ((_a2 = opts == null ? void 0 : opts.onClearPreview) == null ? void 0 : _a2.call(opts));
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
        var _a2;
        return {
          key: `s${m.sid}:${m.ct}`,
          ts: m.ct * 1e3,
          isSender: m.who === "我",
          text: String((_a2 = m.msg) != null ? _a2 : "")
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
    return JSON.stringify({ version: 1, contacts });
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
