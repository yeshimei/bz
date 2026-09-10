/* 源指纹 1d7693ffeb504e61 · 仓内输入 73 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/diary/fake-sim.ts","prototypes/diary/fake/fake-obsidian.ts","src/bookshelf/constants.ts","src/bookshelf/data.ts","src/bookshelf/layouts/wall/render.ts","src/bookshelf/render.ts","src/bookshelf/shared.ts","src/bookshelf/state.ts","src/cinema/state.ts","src/core/app.ts","src/core/crypto.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/flow-dialog.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/settings-common.ts","src/core/settings-modal.ts","src/core/settings-provider.ts","src/core/settings-schema.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/diary/config.ts","src/diary/data.ts","src/diary/encrypt.ts","src/diary/index.ts","src/diary/parser.ts","src/diary/render.ts","src/diary/store.ts","src/diary/thumb-cache.ts","src/diary/ui.ts","src/diary/ui/datetime-picker.ts","src/diary/ui/dialogs.ts","src/diary/ui/entry-actions.ts","src/diary/ui/locator.ts","src/encrypt/data.ts","src/encrypt/index.ts","src/encrypt/preview.ts","src/encrypt/pw-picker.ts","src/encrypt/ui.ts","src/encrypt/vault-assets-view.ts","src/encrypt/vault-data.ts","src/encrypt/vault-pw-view.ts"]*/
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
  var import_moment, Platform, MarkdownRenderer, MarkdownView, Component, Setting, KEY_PREFIX, MEDIA_EXT_RE, FakeVault, FakeMetadataCache, FakeApp;
  var init_fake_obsidian = __esm({
    "prototypes/diary/fake/fake-obsidian.ts"() {
      import_moment = __toESM(require_moment());
      Platform = {
        isMobile: typeof window !== "undefined" && window.innerWidth <= 768
      };
      MarkdownRenderer = class {
        static async render(_app3, md, container) {
          container.textContent = md;
        }
        static renderMarkdown() {
          return Promise.resolve("");
        }
      };
      MarkdownView = class {
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
      FakeVault = class _FakeVault {
        constructor() {
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
        /** 媒体资源 URL：入库子集命中 → assets/ 相对路径；否则按需走预览服务的真实 vault 取流；
         *  file://（双击直开、无服务端）下两者都不可用 → ''（墙渐变占位语义）。 */
        getResourcePath(file) {
          const base = file.path.split("/").pop() || "";
          if (!base) return "";
          if (assetManifest().includes(base)) return "./assets/" + encodeURIComponent(base);
          return vaultMediaUrl(base);
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
        emit(evt, file) {
          var _a;
          for (const cb of (_a = this.listeners.get(evt)) != null ? _a : []) cb(file);
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
        /** 媒体链接解析（data.ts mediaSrc 优先路）：入库清单命中、或经预览服务可取真实 vault 媒体
         *  （http 环境 + 媒体扩展名）→ 返回 TFile 形状；否则 null → mediaSrc 回退 '' 走渐变占位。 */
        getFirstLinkpathDest(ref, _sourcePath) {
          const base = (ref || "").split("/").pop() || "";
          if (!base) return null;
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
  function pad2(n) {
    return String(n).padStart(2, "0");
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
  function localDayKey(ts = Date.now()) {
    const d = ts instanceof Date ? ts : new Date(ts);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function stripMdExt(name) {
    return String(name || "").replace(/\.md$/i, "");
  }
  function hash31(str) {
    let h = 0;
    const t = String(str || "");
    for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) >>> 0;
    return h >>> 0;
  }
  var import_moment2;
  var init_utils = __esm({
    "src/core/utils.ts"() {
      import_moment2 = __toESM(require_moment());
      init_fake_obsidian();
      init_app();
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
  function notifyActionError(err, action) {
    const msg = err instanceof Error ? err.message : String(err);
    notify(`${action}失败：${msg}，请重试`, { type: "error" });
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
  var MAX_VISIBLE, LEAVE_MS, DEDUPE_WINDOW_MS, MOBILE_QUERY, ICONS, SPINNER_SVG, OUT_CLASS, PER_CHAR_MS, SHORT_THRESHOLD, live, recent;
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
  function createSiteIcon(domain, size = 16) {
    if (!domain) return null;
    const mappedDomain = DOMAIN_MAP[domain] || domain;
    const cacheKey = `favicon_v2_${mappedDomain}_${size}`;
    const img = document.createElement("img");
    img.className = "bz-site-icon";
    img.style.cssText = `width:${size}px; height:${size}px;`;
    img.alt = "";
    img.crossOrigin = "anonymous";
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        img.src = cached;
        return img;
      }
    } catch (e) {
    }
    const networkUrl = `https://favicon.yandex.net/favicon/v2/${mappedDomain}?size=${size}`;
    img.src = networkUrl;
    img.onload = function() {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        try {
          localStorage.setItem(cacheKey, dataUrl);
        } catch (e) {
        }
      } catch (e) {
      }
      img.onload = null;
    };
    img.onerror = function() {
      img.style.display = "none";
      img.onerror = null;
    };
    return img;
  }
  function createOverlay(opts) {
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
    return { mask, popup, topify: () => topifyZ(mask, popup) };
  }
  var DOMAIN_MAP;
  var init_dom = __esm({
    "src/core/dom.ts"() {
      init_notice();
      init_z_order();
      DOMAIN_MAP = {
        "guokrapp.guokr.com": "guokr.com",
        "daily.zhihu.com": "zhihu.com"
      };
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
      init_icon();
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

  // src/core/storage.ts
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
  var fileTaskQueues;
  var init_storage = __esm({
    "src/core/storage.ts"() {
      init_app();
      init_settings_provider();
      init_notice();
      fileTaskQueues = /* @__PURE__ */ new Map();
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
      const res = opts.onChange(list);
      if (res && typeof res.then === "function") {
        return Promise.resolve(res).then((final) => {
          current = Array.isArray(final) ? final : list;
          renderAll();
        });
      }
      current = Array.isArray(res) ? res : list;
      renderAll();
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
  }
  function openPathPicker(opts) {
    var _a, _b, _c;
    closePathPicker();
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
    mkBtn(opts.okText || "下一步", true, () => {
      const list = normalizePicked([...selected]);
      closePathPicker();
      opts.onConfirm(list);
    });
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
      const LIMIT2 = 300;
      let n = 0;
      let total = 0;
      for (const folder of orderedList()) {
        if (q && !exact && !folder.toLowerCase().includes(q)) continue;
        total++;
        if (n >= LIMIT2) continue;
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
        listEl.appendChild(row);
      }
      if (!total) {
        const empty = document.createElement("div");
        empty.className = "bz-path-picker-empty";
        empty.textContent = "没有匹配的目录";
        listEl.appendChild(empty);
      } else if (total > LIMIT2) {
        const more = document.createElement("div");
        more.className = "bz-path-picker-empty";
        more.textContent = `已显示前 ${LIMIT2} 个（共 ${total} 个匹配目录），请输入关键词缩小范围`;
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
      renderList();
    };
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
  var EXCLUDED_DIR_NAMES, currentMask, currentPopup, currentHandle, focusTimer;
  var init_path_picker = __esm({
    "src/core/path-picker.ts"() {
      init_fake_obsidian();
      init_app();
      init_dom();
      init_esc_manager();
      EXCLUDED_DIR_NAMES = /* @__PURE__ */ new Set([".obsidian", ".trash", "node_modules", ".git"]);
      currentMask = null;
      currentPopup = null;
      currentHandle = null;
      focusTimer = null;
    }
  });

  // src/core/settings-schema.ts
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
  function currentSnapshot() {
    return tryGetSettings();
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
    const newRowSetting = (body, row) => {
      const setting = new Setting(body).setName(row.name);
      if (row.desc) setting.setDesc(row.desc);
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
      const warn = new CommitWarn(initial, row.onCommit);
      const commit = () => {
        if (pending !== null) {
          clearTimeout(pending);
          pending = null;
        }
        if (!dirty) return;
        void acc.persist();
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
            const n = parseClampedNumber(v, row.min, row.max);
            if (n === null) return;
            acc.write(n);
          } else {
            acc.write(v);
          }
          last = v;
          changeCb == null ? void 0 : changeCb(isNumber ? acc.read() : v, ctx);
          if (pending !== null) clearTimeout(pending);
          pending = setTimeout(commit, TEXT_COMMIT_DELAY);
        });
        const inputEl = t.inputEl;
        if (inputEl) {
          if (isNumber) {
            const num = row;
            inputEl.type = "number";
            if (num.min !== void 0) inputEl.min = String(num.min);
            if (num.max !== void 0) inputEl.max = String(num.max);
            if (num.step !== void 0) inputEl.step = String(num.step);
          }
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
                await a.onClick(last, ctx);
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
              void acc.persist();
              const res = (_a3 = row.onChange) == null ? void 0 : _a3.call(row, list, ctx);
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
              await acc.persist();
              (_a3 = row.onChange) == null ? void 0 : _a3.call(row, v, ctx);
            })
          );
          return;
        }
        case "select": {
          const acc = bindValue(row.binding);
          const setting = newRowSetting(body, row);
          setting.addDropdown((dd) => {
            var _a3;
            for (const opt of row.options) dd.addOption(opt.value, opt.label);
            dd.setValue(String((_a3 = acc.read()) != null ? _a3 : "") || row.options[0].value);
            dd.onChange(async (v) => {
              var _a4;
              acc.write(v);
              reevaluate();
              await acc.persist();
              (_a4 = row.onChange) == null ? void 0 : _a4.call(row, v, ctx);
            });
          });
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
              await acc.persist();
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
              await acc.persist();
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
          if (row.visibleWhen) entries.push({ el: wrap, visibleWhen: row.visibleWhen });
          const box = document.createElement("div");
          box.className = "bz-setlist";
          wrap.appendChild(box);
          const readItems = () => typeof row.items === "function" ? row.items() : row.items;
          const renderItems = () => {
            const items = readItems();
            box.innerHTML = "";
            if (items.length === 0) {
              if (row.emptyText) {
                const empty = document.createElement("div");
                empty.className = "bz-setlist-empty";
                empty.textContent = row.emptyText;
                box.appendChild(empty);
              }
              return;
            }
            for (const it of items) {
              const item = document.createElement("div");
              item.className = "bz-setlist-item";
              item.dataset.key = it.key;
              if (it.imageUrl) {
                const img = document.createElement("img");
                img.className = "bz-setlist-avatar";
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
              remove.className = "bz-setlist-remove bz-touch-target--xl";
              remove.textContent = row.removeLabel || "移除";
              remove.onclick = () => {
                void (async () => {
                  var _a3;
                  const remaining = readItems().map((x) => x.key).filter((k) => k !== it.key);
                  await ((_a3 = row.onChange) == null ? void 0 : _a3.call(row, remaining, ctx));
                  renderItems();
                  reevaluate();
                })();
              };
              item.appendChild(remove);
              box.appendChild(item);
            }
          };
          renderItems();
          return;
        }
        case "text":
        case "textarea":
        case "number":
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
      init_settings_provider();
      init_path_picker();
      init_settings_modal();
      init_ui();
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
    const firstFocusable = Array.from(popup.querySelectorAll(FOCUSABLE_SELECTOR)).find((el) => {
      if (isItemHidden(el)) return false;
      if (isMobileEnv()) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return false;
      }
      return true;
    });
    if (firstFocusable) firstFocusable.focus();
    const handle = escManager.register("bz-settings-modal", {
      isVisible: () => !!currentModal,
      close: () => closeSettingsModal()
    });
    currentModal = {
      mask,
      popup,
      onClose: opts.onClose,
      dispose: () => {
        mask.remove();
        popup.remove();
        handle.unregister();
        if (prevActive && prevActive instanceof HTMLElement && prevActive.isConnected) {
          prevActive.focus();
        }
      }
    };
  }
  var FOCUSABLE_SELECTOR, currentModal;
  var init_settings_modal = __esm({
    "src/core/settings-modal.ts"() {
      init_fake_obsidian();
      init_dom();
      init_esc_manager();
      init_mobile();
      init_settings_schema();
      FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
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
  function clearCryptoKeyCache() {
    keyCache.clear();
  }
  var CryptoService, keyCache;
  var init_crypto = __esm({
    "src/core/crypto.ts"() {
      CryptoService = class {
        static async deriveKey(password, salt) {
          const cacheKey = toBase64(salt);
          const hit = keyCache.get(cacheKey);
          if (hit && hit.pw === password) return hit.key;
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
          keyCache.set(cacheKey, { pw: password, key });
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
            if (!parsed || !Array.isArray(parsed.notes)) parsed.notes = [];
            parsed.version = parsed.version || 1;
            this.manifest = parsed;
            this.password = password;
            this.unlocked = true;
            (_a = this.onUnlockChange) == null ? void 0 : _a.call(this, true);
            emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
            try {
              await this.selfHeal();
            } catch (e) {
            }
            return true;
          } catch (e) {
            return false;
          }
        }
        /** 首设/强制重设：写空清单。写失败必须回滚解锁态（否则下次打开又误判无清单） */
        async firstTimeSetup(password) {
          var _a;
          this.password = password;
          this.unlocked = true;
          (_a = this.onUnlockChange) == null ? void 0 : _a.call(this, true);
          emitDomainEvent(ENCRYPT_UNLOCK_CHANGED_CHANNEL, { unlocked: true });
          this.manifest = { version: 1, notes: [] };
          try {
            await this.saveManifest();
            return true;
          } catch (e) {
            this.unlocked = false;
            this.password = null;
            this.manifest = { version: 1, notes: [] };
            return false;
          }
        }
        /** 加锁：清内存态（含派生密钥缓存，密钥不残留） */
        lock() {
          var _a;
          this.unlocked = false;
          this.password = null;
          this.manifest = { version: 1, notes: [] };
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
                  if (name === ".safe.enc") continue;
                  if (!name.startsWith(".") || !name.endsWith(".enc")) continue;
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
            const password = this.password;
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
                if (cipher !== null) await CryptoService.decrypt(cipher, password);
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
                    const plain = await CryptoService.decrypt(cipher, password);
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
            if (!name.startsWith(".") || !name.endsWith(".enc")) continue;
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
        }
        enqueueOp(op) {
          const run = this.opQueue.then(op, op);
          this.opQueue = run.catch(() => void 0);
          return run;
        }
        /**
         * 加锁一篇笔记（操作级互斥入口，P1-6）：实例级 promise 链串行——
         * 并发 lockNote/restoreNote 按发起顺序排队执行，杜绝挂起标记/清单/暂存区的并发互吞。
         */
        lockNote(input, onProgress, onDeleteFailed) {
          return this.enqueueOp(() => this.lockNoteSerial(input, onProgress, onDeleteFailed));
        }
        /**
         * 加锁一篇笔记：把当前笔记正文 + 双链附件移入保险库（ADR-0018 提交式加密）。
         * 加密阶段密文流式写入暂存区 `.staging/`（不占内存、不进入数据文件夹正式布局）；
         * 全部加密成功后才进入提交序列：
         *   S1 写挂起标记 → S2 清单先行（saveManifest，提交点）→ S3 暂存镜像搬入顶层
         *   → S4 清除挂起标记 → S5 尽力删原文件（失败仅提示，onDeleteFailed 收集，不回滚）。
         * 关键不变量：挂起标记存在 ⇒ 原文件未删 ⇒ 解锁自愈回滚永远安全；标记于删原文件前清除，
         * 标记清除后的意外一律视为已提交、绝不回滚（Q4-A）。
         * 任一失败（附件/正文加密、写暂存、清单写入、搬入、清标记）→ 整笔放弃：清理本次暂存、
         * 原文件不动；清单先行已残留的挂起态由解锁自愈兜底。
         * onProgress：按文件回调（附件逐个 + 笔记本身），UI 驱动进度通知。
         */
        async lockNoteSerial(input, onProgress, onDeleteFailed) {
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
                previewRef
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
              try {
                await this.deleteVaultFile(a.path);
              } catch (e) {
                deleteFailed.push(a.path);
              }
            }
            if (input.kind !== "diary-entry" && input.kind !== "password-vault") {
              try {
                await this.deleteVaultFile(input.path);
              } catch (e) {
                deleteFailed.push(input.path);
              }
            }
            onDeleteFailed == null ? void 0 : onDeleteFailed(deleteFailed);
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
          if (!note) throw new Error("未找到该加密笔记");
          const conflicts = [];
          const total = note.attachments.length + 1;
          let done = 0;
          const plainAttachments = await mapLimit(note.attachments, BLOB_CONCURRENCY, async (a) => {
            const plainB64 = await this.prepareRestoreAttachment(a);
            done += 1;
            onProgress == null ? void 0 : onProgress({ done, total, current: a.path });
            return plainB64;
          });
          note.attachments.forEach((a, i) => {
            if (plainAttachments[i] === null) conflicts.push(a.path);
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
          await this.deleteNoteMirrors(note);
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          try {
            await this.saveManifest();
          } catch (e) {
            return { note, conflicts, removed: false, manifestSaveFailed: true };
          }
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
         * 加密日记条目还原：还原附件 → 把 finalBlock（由调用方准备，可为原文或改分类降级后重建）merge 回原日期 md → 取出即删。
         * 原子语义同 restoreNote：全部附件解密/校验成功且块就绪才写回；任一失败零落盘。
         */
        async restoreDiaryEntry(noteId, finalBlock) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法还原加密日记");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note || note.kind !== "diary-entry") throw new Error("未找到该加密日记条目");
          const conflicts = [];
          const plainAttachments = await mapLimit(
            note.attachments,
            BLOB_CONCURRENCY,
            async (a) => this.prepareRestoreAttachment(a)
          );
          note.attachments.forEach((a, i) => {
            if (plainAttachments[i] === null) conflicts.push(a.path);
          });
          if (!finalBlock) conflicts.push(note.path);
          if (conflicts.length > 0) return false;
          const created = [];
          try {
            for (let i = 0; i < note.attachments.length; i++) {
              const a = note.attachments[i];
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
          await this.deleteNoteMirrors(note);
          const idx = this.manifest.notes.indexOf(note);
          if (idx !== -1) this.manifest.notes.splice(idx, 1);
          try {
            await this.saveManifest();
          } catch (e) {
            return false;
          }
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
         * 加密日记条目还原辅助：把 `# emoji HH:mm\n正文` 块 merge 回目标日期 md 文件。
         * 解析块首行标题取时间 → 按时间序把块重插进该日期文件（文件已删则新建）；非整文件覆盖（ADR-0017 Q23-A）。
         * @returns 成功写入返回 true；目标路径被占且非本系统（fingerprint 冲突）由附件层处理，正文 merge 属幂等写回。
         */
        async mergeDiaryBlock(datePath, block) {
          var _a, _b;
          const app = getApp();
          if (!datePath || !block) return false;
          const md = block.replace(/\r\n/g, "\n");
          const lines = md.split("\n");
          const headMatch = lines[0] ? lines[0].match(/^#\s+\S+\s+(\d{2}:\d{2})$/) : null;
          const time = headMatch ? headMatch[1] : null;
          const timeValue = time ? parseInt(time.slice(0, 2), 10) * 100 + parseInt(time.slice(3, 5), 10) : null;
          if (timeValue === null || Number.isNaN(timeValue)) return false;
          await this.ensureVaultParentFolder(datePath);
          const existing = app.vault.getAbstractFileByPath(datePath);
          let existingText = "";
          if (existing && existing.isFolder !== true) {
            existingText = await app.vault.read(existing);
          }
          const existingLines = existingText ? existingText.replace(/\r\n/g, "\n").split("\n") : [];
          const blockRows = [lines[0].trim()];
          const blockLines = [];
          for (let i = 1; i < lines.length; i++) blockLines.push(lines[i]);
          while (blockLines.length && blockLines[blockLines.length - 1].trim() === "") blockLines.pop();
          while (blockLines.length && blockLines[0].trim() === "") blockLines.shift();
          if (blockLines.length) {
            blockRows.push("");
            blockRows.push(...blockLines);
          }
          const headingRe = /^#\s+\S+\s+(\d{2}:\d{2})$/;
          const sigLines = (ls) => ls.map((l) => l.trim()).filter((l) => l !== "");
          const blockSig = sigLines(blockRows);
          let alreadyMerged = false;
          for (let i = 0; i < existingLines.length; i++) {
            if (existingLines[i].trim() !== lines[0].trim()) continue;
            const seg = [];
            for (let k = i + 1; k < existingLines.length && !headingRe.test(existingLines[k]); k++) seg.push(existingLines[k]);
            if (sigLines(seg).join("\n") === blockSig.slice(1).join("\n")) {
              alreadyMerged = true;
              break;
            }
          }
          if (alreadyMerged) return true;
          let insertIdx = existingLines.length;
          for (let i = 0; i < existingLines.length; i++) {
            const m = existingLines[i].match(headingRe);
            if (m) {
              const tv = parseInt(m[1].slice(0, 2), 10) * 100 + parseInt(m[1].slice(3, 5), 10);
              if (tv >= timeValue) {
                insertIdx = i;
                break;
              }
            }
          }
          const out = [];
          for (let i = 0; i < insertIdx; i++) out.push(existingLines[i]);
          if (insertIdx > 0 && existingLines[insertIdx - 1].trim() !== "") out.push("");
          out.push(...blockRows);
          if (insertIdx < existingLines.length && existingLines[insertIdx].trim() !== "") out.push("");
          for (let i = insertIdx; i < existingLines.length; i++) out.push(existingLines[i]);
          const clean = [];
          for (const ln of out) {
            if (ln.trim() === "") {
              if (clean.length && clean[clean.length - 1] !== "") clean.push("");
            } else {
              clean.push(ln);
            }
          }
          while (clean.length && clean[0] === "") clean.shift();
          while (clean.length && clean[clean.length - 1] === "") clean.pop();
          const finalText = clean.join("\n");
          if (existing && existing.isFolder !== true) {
            await app.vault.modify(existing, finalText);
          } else {
            const file = await app.vault.create(datePath, finalText);
            (_b = (_a = app.metadataCache) == null ? void 0 : _a.trigger) == null ? void 0 : _b.call(_a, "changed", file);
          }
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
        /** 删除一条加密笔记（连同镜像文件、清单记录）。谨慎：真删除不可恢复。 */
        async removeNote(noteId) {
          if (!this.unlocked) throw new Error("未解锁");
          const idx = this.manifest.notes.findIndex((n) => n.id === noteId);
          if (idx === -1) return;
          const note = this.manifest.notes[idx];
          await this.deleteNoteMirrors(note);
          this.manifest.notes.splice(idx, 1);
          await this.saveManifest();
        }
        /**
         * 更新条目正文镜像（覆盖同一 contentRef，不产生孤儿镜像；清单同步持久化）。
         * 供密码本整表（password-vault）等高频改写载荷用：重用既有镜像名，避免每次新镜像堆积。
         * 覆盖走 replaceMirrorAtomic（P0-1）：暂存+rename 原子换入，任何写失败正式位保持旧完整密文。
         */
        async updateNotePayload(noteId, plainContent) {
          if (!this.unlocked || !this.password) throw new Error("未解锁，无法保存");
          const note = this.manifest.notes.find((n) => n.id === noteId);
          if (!note) throw new Error("未找到清单条目");
          const encrypted = await CryptoService.encrypt(plainContent, this.password);
          if (note.contentRef) {
            await this.replaceMirrorAtomic(note.contentRef, encrypted);
          } else {
            const ref = flatName();
            await this.replaceMirrorAtomic(ref, encrypted);
            note.contentRef = ref;
          }
          await this.saveManifest();
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

  // src/encrypt/preview.ts
  function canvasAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!c.getContext && !!c.getContext("2d");
    } catch (e) {
      return false;
    }
  }
  function withTimeout(promise, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label + " 超时")), timeoutMs);
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
    });
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
      PREVIEW_TIMEOUT_MS = 5e3;
      PREVIEW_OMIT_SIZE = 384;
      PREVIEW_OMIT_QUALITY = 0.5;
    }
  });

  // src/encrypt/vault-data.ts
  var PASSWORD_VAULT_CHANNEL, ENCRYPT_CHANGED_CHANNEL2, VAULT_KIND, VAULT_PATH, VAULT_TITLE, PasswordVaultDataManager;
  var init_vault_data = __esm({
    "src/encrypt/vault-data.ts"() {
      init_domain_bus();
      PASSWORD_VAULT_CHANNEL = "password-vault:changed";
      ENCRYPT_CHANGED_CHANNEL2 = "encrypt:changed";
      VAULT_KIND = "password-vault";
      VAULT_PATH = "CONFIG/.ENCRYPT/passwords";
      VAULT_TITLE = "密码本";
      PasswordVaultDataManager = class {
        /** 显式注入 SafeManager（ADR-0085：encrypt Controller 装配同一单例，避免域内循环依赖默认取单例） */
        constructor(safe) {
          this.pwData = [];
          /** load 缓存（ticket 43 同款）：清单条目 + 原始密文字节；密文未变不重解密 */
          this.loadCache = null;
          /** 域事件退订 */
          this.offChanged = null;
          this.offEncryptChanged = null;
          /** 自身写盘中标志：save() 期间跳过外部事件重载（自己写的 encrypt:changed 广播不触发自重载） */
          this.saving = false;
          /** 外部变更回调（UI 订阅；外部改动 → 重载后回调） */
          this.onExternalChange = null;
          this.safe = safe;
          this.offChanged = onDomainEvent(PASSWORD_VAULT_CHANNEL, (evt) => {
            if ((evt == null ? void 0 : evt.source) === "password-vault") return;
            void this.reloadFromExternal();
          });
          this.offEncryptChanged = onDomainEvent(ENCRYPT_CHANGED_CHANNEL2, (evt) => {
            const note = this.vaultNote;
            if (!note || (evt == null ? void 0 : evt.noteId) && evt.noteId !== note.id) return;
            void this.reloadFromExternal();
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
          if (plain === null) throw new Error("保险库数据解密失败");
          let parsed;
          try {
            parsed = JSON.parse(plain);
          } catch (e) {
            throw new Error("保险库数据损坏");
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
        lock() {
          this.safe.lock();
          this.pwData = [];
          this.loadCache = null;
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
          if (!keyword) return this.pwData;
          const lower = keyword.toLowerCase();
          return this.pwData.filter(
            (item) => (item.platform || "").toLowerCase().includes(lower) || (item.account || "").toLowerCase().includes(lower) || (item.note || "").toLowerCase().includes(lower)
          );
        }
        /** 卸载清理：退订域事件 */
        destroy() {
          var _a, _b;
          (_a = this.offChanged) == null ? void 0 : _a.call(this);
          this.offChanged = null;
          (_b = this.offEncryptChanged) == null ? void 0 : _b.call(this);
          this.offEncryptChanged = null;
        }
      };
    }
  });

  // src/encrypt/vault-pw-view.ts
  function relTime(iso) {
    if (!iso) return "";
    return formatRelativeTime(iso);
  }
  function dots(p) {
    return "•".repeat(Math.min((p || "").length, 18));
  }
  function colorOf(platform) {
    const k = Object.keys(PLATFORM_COLOR_MAP).find((x) => (platform || "").toLowerCase().includes(x.toLowerCase()));
    if (k) return PLATFORM_COLOR_MAP[k];
    const h = hash31(platform || "?");
    return PALETTE[h % PALETTE.length];
  }
  function avatarHTML(platform, url, cls = "bz-pwv-avatar") {
    const ch = (platform || "?").slice(0, 1);
    return `<div class="${cls}" style="background:${colorOf(platform)}" data-pwv-avatar="1" data-url="${escAttr(url || "")}"><span>${escAttr(ch)}</span></div>`;
  }
  function escAttr(s) {
    return String(s != null ? s : "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function hydratePwAvatars(scope) {
    scope.querySelectorAll("[data-pwv-avatar]").forEach((box) => {
      if (box.querySelector("img")) return;
      const url = box.getAttribute("data-url");
      let domain = null;
      try {
        domain = url ? new URL(url).hostname : null;
      } catch (e) {
        domain = null;
      }
      const img = createSiteIcon(domain, 64);
      if (img) {
        img.className = "bz-pwv-favicon";
        img.removeAttribute("style");
        img.addEventListener("load", () => {
          const ch = box.querySelector("span");
          if (ch) ch.style.display = "none";
        });
        box.appendChild(img);
      }
    });
  }
  var PLATFORM_COLOR_MAP, PALETTE, DEFAULT_PW_STATE, PW_REVEAL_AUTO_MASK_MS, DEFAULT_PW_CHARSET, VaultPwView, ICON_PATHS;
  var init_vault_pw_view = __esm({
    "src/encrypt/vault-pw-view.ts"() {
      init_dom();
      init_item_actions();
      init_utils();
      init_ui();
      PLATFORM_COLOR_MAP = {
        github: "#5a5f73",
        微信: "#3eb575",
        支付宝: "#4f7cf7",
        notion: "#111111",
        哔哩哔哩: "#fb7299",
        招商银行: "#d43d3d",
        豆瓣: "#3fa34d"
      };
      PALETTE = ["#7c6bd6", "#3e8e5a", "#c98a1e", "#4f7cf7", "#d43d3d", "#2a9d8f", "#b4551d", "#5a5f73"];
      DEFAULT_PW_STATE = {
        asset: "pw",
        view: "all",
        searchKw: "",
        selPlatform: null,
        selAccount: null,
        shownIds: {}
      };
      PW_REVEAL_AUTO_MASK_MS = 15e3;
      DEFAULT_PW_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ~!@$%^&*()_+";
      VaultPwView = class {
        constructor(dm, host, cfg) {
          /** 明文自动回遮计时器（按条目 id；手动隐藏/上锁即撤） */
          this.revealTimers = {};
          this.dm = dm;
          this.host = host;
          this.charset = cfg.charset || DEFAULT_PW_CHARSET;
          this.length = parseInt(String(cfg.length)) || 16;
        }
        /** 收藏星内联图标（替代 ★ 文本符号；图标一律 lucide——ui-kit 手册铁律） */
        starIc() {
          return `<span class="star">${this.ic("star", 11)}</span>`;
        }
        /** 撤销单条明文自动回遮计时 */
        clearRevealTimer(id) {
          if (this.revealTimers[id]) {
            clearTimeout(this.revealTimers[id]);
            delete this.revealTimers[id];
          }
        }
        /** 卸载清理：撤销全部明文自动回遮计时器（防插件禁用后定时器仍触发改 UI） */
        disposeRevealTimers() {
          for (const id of Object.keys(this.revealTimers)) {
            clearTimeout(this.revealTimers[id]);
            delete this.revealTimers[id];
          }
        }
        // ---------- 桌面列表 ----------
        /**
         * 渲染密码资产桌面列表（平台聚合行 / 搜索展平行）到 container。
         * row 点击 → onPick(platform 或 account)；右键/长按 → 统一抽屉（平台/账号动作）。
         */
        renderDeskList(container, st, onPick) {
          var _a;
          container.innerHTML = "";
          const kw = st.searchKw;
          if (kw) {
            const hits = this.dm.search(kw).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            if (!hits.length) {
              container.replaceChildren(this.emptyState("没有匹配的条目", "换个关键词，或清空搜索"));
              return;
            }
            for (const d of hits) {
              const r = document.createElement("div");
              r.className = "bz-pwv-row" + (d.id === st.selAccount ? " on" : "");
              r.innerHTML = `${avatarHTML(d.platform, d.url)}
          <div class="mid"><div class="pl">${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}</div><div class="ac">${this.esc(d.account || "(无账号)")}</div></div>
          <div class="tm">${relTime(d.createdAt)}</div>`;
              r.addEventListener("click", () => onPick(d.platform, d.id));
              this.attachAccountActions(r, d);
              container.appendChild(r);
            }
            hydratePwAvatars(container);
            return;
          }
          let plats = this.dm.platforms();
          if (st.view === "fav") plats = plats.filter((p) => this.dm.hasFav(p.platform));
          if (!plats.length) {
            if (st.view === "fav") {
              container.replaceChildren(this.emptyState("还没有收藏", "右键或长按条目可收藏，常用账号一目了然"));
            } else {
              container.replaceChildren(this.emptyState("保险库还没有密码", "收录第一条账号开始使用", { add: true }));
              (_a = container.querySelector('[data-pwv="empty-add"]')) == null ? void 0 : _a.addEventListener("click", () => this.host.openPwEntryDialog());
            }
            return;
          }
          for (const p of plats) {
            const r = document.createElement("div");
            r.className = "bz-pwv-plrow" + (p.platform === st.selPlatform ? " on" : "");
            const recent2 = p.accounts[0];
            const favStar = this.dm.hasFav(p.platform) ? " " + this.starIc() : "";
            const countBadge = p.accounts.length > 1 ? `<span class="bz-pwv-cnt">${p.accounts.length}</span>` : "";
            r.innerHTML = `${avatarHTML(p.platform, recent2 == null ? void 0 : recent2.url)}
        <div class="mid"><div class="pl">${this.esc(p.platform)}${favStar}${countBadge}</div><div class="ac">${recent2 ? this.esc(recent2.account || "(无账号)") : ""}</div></div>
        <div class="tm">${relTime(recent2 && recent2.createdAt)}</div>`;
            r.addEventListener("click", () => onPick(p.platform, null));
            this.attachPlatformActions(r, p.platform);
            container.appendChild(r);
          }
          hydratePwAvatars(container);
        }
        /** 渲染密码资产桌面详情区（平台账号卡流 / 搜索态单卡） */
        renderDeskDetail(container, st) {
          var _a, _b;
          container.innerHTML = "";
          const kw = st.searchKw;
          let d;
          if (kw) {
            d = this.dm.pwData.find((x) => x.id === st.selAccount);
            if (!d) {
              container.replaceChildren(this.emptyState("选择一条结果", "点击左侧结果查看详情"));
              return;
            }
          } else if (st.selPlatform) {
            const accs = this.dm.accountsOf(st.selPlatform);
            const filtered = st.view === "fav" ? accs.filter((x) => x.fav) : accs;
            const first = accs[0];
            const favStar = this.dm.hasFav(st.selPlatform) ? " " + this.starIc() : "";
            container.innerHTML = `<div class="bz-pwv-dhead">
        <div class="av big">${avatarHTML(st.selPlatform, first == null ? void 0 : first.url, "bz-pwv-avatar big")}</div>
        <div class="ttl"><h2>${this.esc(st.selPlatform)}${favStar}</h2>
          ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
        <div class="acts">
          <button class="bz-pwv-ic" data-pwv="plat-edit" title="编辑平台信息">${this.ic("pencil")}</button>
        </div>
      </div>
      <div class="bz-pwv-accthead">
        <div class="t">${filtered.length} 个账号</div>
        <button class="bz-pwv-addacct" data-pwv="plat-add">${this.ic("plus", 12)} 在该平台新增账号</button>
      </div>
      <div class="bz-pwv-accts"></div>`;
            const acctsEl = container.querySelector(".bz-pwv-accts");
            if (!filtered.length) {
              acctsEl.replaceChildren(this.emptyState("该平台暂无账号", "点上方「在该平台新增账号」录入"));
            } else {
              for (const x of filtered) acctsEl.appendChild(this.buildAccountCard(x, st));
            }
            (_a = container.querySelector('[data-pwv="plat-edit"]')) == null ? void 0 : _a.addEventListener("click", () => this.host.openPwPlatformEdit(st.selPlatform));
            (_b = container.querySelector('[data-pwv="plat-add"]')) == null ? void 0 : _b.addEventListener(
              "click",
              () => this.host.openPwEntryDialog(null, { platform: st.selPlatform || "", url: (first == null ? void 0 : first.url) || "" })
            );
            return;
          } else {
            container.replaceChildren(this.emptyState("选择一个平台", "左侧选择平台后，这里显示其全部账号", { icon: "key" }));
            return;
          }
          container.appendChild(this.buildAccountCard(d, st, true));
        }
        /** 单张账号卡（详情区复用）：复制账号常驻 + 密码行（显隐/复制）+ 备注 + 创建时间 */
        buildAccountCard(d, st, withHead = false) {
          const card = document.createElement("div");
          card.className = "bz-pwv-acctcard";
          const shown = !!st.shownIds[d.id];
          const accMeta = withHead ? `${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}` : `${this.esc(d.account || "(无账号)")}${d.fav ? " " + this.starIc() : ""}`;
          card.innerHTML = `<div class="accrow">
      <div class="name">${accMeta}</div>
      <button class="copyac bz-touch-target--lg" data-pwv="copy-ac">${this.ic("copy")} 复制账号</button>
    </div>
    <div class="pwrow">
      <div class="pw ${shown ? "" : "mask"}">${shown ? this.esc(d.password) : dots(d.password)}</div>
      <button class="mini" data-pwv="eye" title="${shown ? "隐藏密码" : "显示密码"}">${shown ? this.ic("eye-off") : this.ic("eye")}</button>
      <button class="mini" data-pwv="copy-pw" title="复制密码">${this.ic("copy")}</button>
    </div>
    ${d.note ? `<div class="note">${this.esc(d.note)}</div>` : ""}
    <div class="meta">创建于 ${this.esc(new Date(d.createdAt).toLocaleDateString("zh-CN"))}${d.url ? ' · <a href="' + this.esc(d.url) + '" target="_blank" rel="noopener">' + this.esc(d.url.replace("https://", "")) + " ↗</a>" : ""}</div>`;
          card.querySelectorAll("[data-pwv]").forEach(
            (b) => b.addEventListener("click", (e) => {
              e.stopPropagation();
              this.dispatchAccountAction(d, b.dataset.pwv, st);
            })
          );
          this.attachAccountActions(card, d);
          return card;
        }
        /** 账号动作分发（卡片按钮 + 抽屉共用） */
        dispatchAccountAction(d, act, st) {
          var _a, _b;
          const t = (m, err = false) => this.host.toast(m, err);
          if (act === "copy-ac") {
            void this.host.copySensitive(d.account || "").then((ok) => ok ? t("账号已复制（60 秒后自动清空）") : t("复制失败，请手动复制", true), () => t("复制失败，请手动复制", true));
          } else if (act === "copy-pw") {
            void this.host.copySensitive(d.password || "").then((ok) => ok ? t("密码已复制（60 秒后自动清空）") : t("复制失败，请手动复制", true), () => t("复制失败，请手动复制", true));
          } else if (act === "eye") {
            const showing = !st.shownIds[d.id];
            st.shownIds[d.id] = showing;
            if (showing) {
              this.clearRevealTimer(d.id);
              this.revealTimers[d.id] = setTimeout(() => {
                var _a2, _b2;
                delete this.revealTimers[d.id];
                if (st.shownIds[d.id]) {
                  delete st.shownIds[d.id];
                  (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
                }
              }, PW_REVEAL_AUTO_MASK_MS);
            } else {
              this.clearRevealTimer(d.id);
            }
            (_b = (_a = this.host).onPwChanged) == null ? void 0 : _b.call(_a);
          } else if (act === "edit") {
            this.host.openPwEntryDialog(d);
          } else if (act === "fav") {
            void this.dm.toggleFav(d.id).then(() => {
              var _a2, _b2;
              return (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
            }).catch((e) => this.failToast(e));
          } else if (act === "del") {
            this.host.askConfirm("删除密码条目", `确定删除账号「${d.account}」吗？此操作不可撤销。`, "删除", () => {
              void this.dm.deleteItem(d.id).then(() => {
                var _a2, _b2;
                if (st.selAccount === d.id) st.selAccount = null;
                (_b2 = (_a2 = this.host).onPwChanged) == null ? void 0 : _b2.call(_a2);
                t(`已删除账号「${d.account}」`);
              }).catch((e) => this.failToast(e));
            });
          }
        }
        /** E2：写动作失败统一提示 + 重渲染（数据层已回滚内存，按真实状态收敛） */
        failToast(e) {
          var _a, _b;
          this.host.toast(`保存失败：${(e == null ? void 0 : e.message) || e}`, true);
          (_b = (_a = this.host).onPwChanged) == null ? void 0 : _b.call(_a);
        }
        /** 账号动作集（行卡右键/长按与移动账号详情页 ⋮ 共用） */
        accountActions(d) {
          return [
            {
              icon: "copy",
              label: "复制账号",
              onClick: () => void this.host.copySensitive(d.account || "").then((ok) => this.host.toast(ok ? "账号已复制（60 秒后自动清空）" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            },
            {
              icon: "key",
              label: "复制密码",
              onClick: () => void this.host.copySensitive(d.password || "").then((ok) => this.host.toast(ok ? "密码已复制（60 秒后自动清空）" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            },
            {
              icon: "star",
              label: d.fav ? "取消收藏" : "收藏",
              onClick: () => void this.dm.toggleFav(d.id).then(() => {
                var _a, _b;
                return (_b = (_a = this.host).onPwChanged) == null ? void 0 : _b.call(_a);
              }).catch((e) => this.failToast(e))
            },
            {
              icon: "external-link",
              label: "打开链接",
              onClick: () => d.url ? this.host.openExternal(d.url) : this.host.toast("该条目没有链接", true)
            },
            { icon: "pencil", label: "编辑", onClick: () => this.host.openPwEntryDialog(d) },
            {
              icon: "trash-2",
              label: "删除",
              kind: "danger",
              onClick: () => this.host.askConfirm("删除密码条目", `确定删除账号「${d.account}」吗？此操作不可撤销。`, "删除", () => {
                void this.dm.deleteItem(d.id).then(() => {
                  var _a, _b;
                  (_b = (_a = this.host).onPwChanged) == null ? void 0 : _b.call(_a);
                  this.host.toast(`已删除账号「${d.account}」`);
                }).catch((e) => this.failToast(e));
              })
            }
          ];
        }
        attachAccountActions(el, d) {
          attachItemActions(el, this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
        }
        /** 移动端账号详情页 ⋮：直接开底部抽屉（抽屉手势挂行卡上，详情页按钮触达不了——E6） */
        openAccountSheet(d) {
          openItemSheet(this.accountActions(d), { sheetHead: this.buildSheetHead(d) });
        }
        /** 平台动作集（行卡右键/长按与移动平台详情页 ⋮ 共用） */
        platformActions(platform) {
          const accs = this.dm.accountsOf(platform);
          const recent2 = accs[0];
          const count = accs.length;
          const actions = [
            {
              icon: "plus",
              label: "在该平台新增账号",
              onClick: () => this.host.openPwEntryDialog(null, { platform, url: (recent2 == null ? void 0 : recent2.url) || "" })
            }
          ];
          if (recent2) {
            actions.push({
              icon: "copy",
              label: "复制最近账号",
              onClick: () => void this.host.copySensitive(recent2.account || "").then((ok) => this.host.toast(ok ? "最近账号已复制" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            });
            actions.push({
              icon: "key",
              label: "复制最近密码",
              onClick: () => void this.host.copySensitive(recent2.password || "").then((ok) => this.host.toast(ok ? "最近密码已复制" : "复制失败", !ok), () => this.host.toast("复制失败", true))
            });
          }
          actions.push({ icon: "pencil", label: "编辑平台信息", onClick: () => this.host.openPwPlatformEdit(platform) });
          actions.push({
            icon: "trash-2",
            label: "删除整个平台",
            kind: "danger",
            onClick: () => this.host.askConfirm("删除整个平台", `将删除「${platform}」的 ${count} 个账号，此操作不可撤销。确定继续？`, "删除", () => {
              void this.dm.removePlatform(platform).then(() => {
                var _a, _b;
                (_b = (_a = this.host).onPwChanged) == null ? void 0 : _b.call(_a);
                this.host.toast(`已删除平台与 ${count} 个账号`);
              }).catch((e) => this.failToast(e));
            })
          });
          return actions;
        }
        platformSheetOpts(platform) {
          const recent2 = this.dm.accountsOf(platform)[0];
          return { sheetHead: this.buildSheetHead(recent2 != null ? recent2 : { account: platform, platform, createdAt: "" }) };
        }
        attachPlatformActions(el, platform) {
          attachItemActions(el, this.platformActions(platform), this.platformSheetOpts(platform));
        }
        /** 移动端平台详情页 ⋮：直接开底部抽屉（E6 同款） */
        openPlatformSheet(platform) {
          openItemSheet(this.platformActions(platform), this.platformSheetOpts(platform));
        }
        // ---------- 移动端卡流 ----------
        /** 渲染移动端密码卡流（平台卡；fav 过滤 view 由调用方传入 st） */
        renderMobList(container, st, onOpenPlatform) {
          var _a;
          container.innerHTML = "";
          const kw = st.searchKw;
          if (kw) {
            const hits = this.dm.search(kw).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || "") * -1);
            if (!hits.length) {
              container.replaceChildren(this.emptyState("没有匹配的条目", "换个关键词试试"));
              return;
            }
            for (const d of hits) {
              const c = document.createElement("div");
              c.className = "bz-pwv-mobcard";
              c.innerHTML = `${avatarHTML(d.platform, d.url, "bz-pwv-avatar av")}
          <div class="mid"><div class="a">${this.esc(d.platform)}${d.fav ? " " + this.starIc() : ""}</div><div class="b">${this.esc(d.account || "(无账号)")}</div></div>
          <span class="go">${this.ic("chevron-right")}</span>`;
              c.addEventListener("click", () => {
                var _a2, _b;
                return (_b = (_a2 = this.host).openPwAccountPage) == null ? void 0 : _b.call(_a2, d, st);
              });
              this.attachAccountActions(c, d);
              container.appendChild(c);
            }
            hydratePwAvatars(container);
            return;
          }
          let plats = this.dm.platforms();
          if (st.view === "fav") plats = plats.filter((p) => this.dm.hasFav(p.platform));
          if (!plats.length) {
            if (st.view === "fav") {
              container.replaceChildren(this.emptyState("还没有收藏", "右键或长按条目可收藏，常用账号一目了然"));
            } else {
              container.replaceChildren(this.emptyState("保险库还没有密码", "收录第一条账号开始使用", { add: true }));
              (_a = container.querySelector('[data-pwv="empty-add"]')) == null ? void 0 : _a.addEventListener("click", () => this.host.openPwEntryDialog());
            }
            return;
          }
          for (const p of plats) {
            const recent2 = p.accounts[0];
            const c = document.createElement("div");
            c.className = "bz-pwv-mobcard";
            const favStar = this.dm.hasFav(p.platform) ? " " + this.starIc() : "";
            const cnt = p.accounts.length > 1 ? `<span class="cnt">${p.accounts.length}</span>` : "";
            c.innerHTML = `${avatarHTML(p.platform, recent2 == null ? void 0 : recent2.url, "bz-pwv-avatar av")}
        <div class="mid"><div class="a">${this.esc(p.platform)}${favStar}${cnt}</div><div class="b">${recent2 ? this.esc(recent2.account || "(无账号)") : ""}</div></div>
        <span class="go">${this.ic("chevron-right")}</span>`;
            c.addEventListener("click", () => onOpenPlatform(p));
            this.attachPlatformActions(c, p.platform);
            container.appendChild(c);
          }
          hydratePwAvatars(container);
        }
        /** 平台详情页（移动）HTML 注入 body；含账号卡与操作 */
        renderMobPlatformPage(body, p, st) {
          var _a;
          const accs = p.accounts;
          const first = accs[0];
          const favStar = this.dm.hasFav(p.platform) ? ' <span class="star">★</span>' : "";
          body.innerHTML = `<div class="bz-pwv-mobplathead">
      <div class="av big">${avatarHTML(p.platform, first == null ? void 0 : first.url, "bz-pwv-avatar big")}</div>
      <div><div class="nm">${this.esc(p.platform)}${favStar}</div>
        ${first && first.url ? `<a class="url" href="${this.esc(first.url)}" target="_blank" rel="noopener">${this.esc(first.url)} ↗</a>` : '<div class="url faint">无链接</div>'}</div>
      <button class="bz-pwv-btn gold" data-pwv="plat-add">${this.ic("plus", 12)} 新增账号</button>
    </div>
    <div class="bz-pwv-accts"></div>`;
          const acctsEl = body.querySelector(".bz-pwv-accts");
          if (!accs.length) {
            acctsEl.replaceChildren(this.emptyState("该平台暂无账号", "点上方「在该平台新增账号」录入"));
          } else {
            for (const d of accs) acctsEl.appendChild(this.buildAccountCard(d, st));
          }
          (_a = body.querySelector('[data-pwv="plat-add"]')) == null ? void 0 : _a.addEventListener(
            "click",
            () => this.host.openPwEntryDialog(null, { platform: p.platform, url: (first == null ? void 0 : first.url) || "" })
          );
        }
        // ---------- 抽屉头 ----------
        buildSheetHead(d) {
          const head = document.createElement("div");
          head.className = "bz-item-sheet-entry";
          const body = document.createElement("div");
          body.style.cssText = "display:flex; align-items:flex-start; gap:10px;";
          const emoji = document.createElement("span");
          emoji.className = "bz-item-sheet-emoji";
          emoji.textContent = "🔑";
          body.appendChild(emoji);
          const info = document.createElement("div");
          info.style.cssText = "flex:1; min-width:0;";
          const t = document.createElement("div");
          t.className = "bz-item-sheet-title";
          t.textContent = d.account || d.platform;
          info.appendChild(t);
          const s = document.createElement("div");
          s.className = "bz-item-sheet-sub";
          s.textContent = `${d.platform}${d.platform ? " · " : ""}${relTime(d.createdAt)}`;
          info.appendChild(s);
          body.appendChild(info);
          head.appendChild(body);
          return head;
        }
        // ---------- lucide 图标 ----------
        ic(name, size = 14) {
          return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ""}</svg>`;
        }
        /** 空态（组件库 uiEmpty = .bz-empty 基线）；add = 附「新增密码」金色 CTA（金库主题色，域内样式） */
        emptyState(title, desc, opts) {
          const empty = uiEmpty((opts == null ? void 0 : opts.icon) ? { icon: opts.icon, title, desc } : { title, desc });
          if (opts == null ? void 0 : opts.add) {
            const add = document.createElement("button");
            add.className = "bz-pwv-empty-add bz-touch-target--lg";
            add.setAttribute("data-pwv", "empty-add");
            add.innerHTML = `${this.ic("plus")} 新增密码`;
            empty.appendChild(add);
          }
          return empty;
        }
        esc(s) {
          return escapeHtml(String(s != null ? s : ""));
        }
      };
      ICON_PATHS = {
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
        star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
        "external-link": '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        "trash-2": '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        "eye-off": '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        "chevron-right": '<path d="m9 18 6-6-6-6"/>'
      };
    }
  });

  // src/encrypt/pw-picker.ts
  function fuzzyScore(hay, query) {
    if (!query) return 0;
    const h = (hay || "").toLowerCase();
    const q = query.toLowerCase();
    const idx = h.indexOf(q);
    if (idx >= 0) return 1e3 - idx;
    let hi = 0;
    for (let qi = 0; qi < q.length; qi++) {
      hi = h.indexOf(q[qi], hi);
      if (hi === -1) return -1;
      hi++;
    }
    return 100;
  }
  function fuzzyFilterEntries(entries, query) {
    const hits = [];
    for (const e of entries) {
      const score = Math.max(
        fuzzyScore(e.platform || "", query),
        fuzzyScore(e.account || "", query),
        fuzzyScore(e.note || "", query)
      );
      if (score >= 0) hits.push({ e, score });
    }
    hits.sort((a, b) => b.score - a.score || (b.e.createdAt || "").localeCompare(a.e.createdAt || ""));
    return hits.map((h) => h.e);
  }
  function closePasswordQuickPicker() {
    if (currentMask2) {
      currentMask2.remove();
      currentMask2 = null;
    }
    if (currentPopup2) {
      currentPopup2.remove();
      currentPopup2 = null;
    }
    if (currentHandle2) {
      currentHandle2.unregister();
      currentHandle2 = null;
    }
    if (focusTimer2 !== null) {
      window.clearTimeout(focusTimer2);
      focusTimer2 = null;
    }
  }
  function openPasswordQuickPicker(entries, onPick) {
    closePasswordQuickPicker();
    const { mask, popup } = createOverlay({
      maskId: "bz-encrypt-pw-picker-mask",
      popupId: "bz-encrypt-pw-picker-popup",
      width: "min(calc(100vw - 32px), 420px)",
      maxWidth: 420,
      onMaskClick: () => closePasswordQuickPicker()
    });
    currentMask2 = mask;
    currentPopup2 = popup;
    popup.classList.add("bz-encrypt-pwqp");
    popup.style.height = "min(420px, 72vh)";
    const head = document.createElement("div");
    head.className = "bz-encrypt-pwqp-head";
    const title = document.createElement("h3");
    title.className = "bz-encrypt-pwqp-title";
    title.textContent = "快速复制密码";
    head.appendChild(title);
    const search = document.createElement("input");
    search.type = "text";
    search.className = "bz-input bz-encrypt-pwqp-search";
    search.placeholder = "搜索平台 / 账号…";
    search.spellcheck = false;
    search.setAttribute("aria-label", "搜索密码条目");
    const listEl = document.createElement("div");
    listEl.className = "bz-encrypt-pwqp-list";
    const state = { hits: [], active: 0 };
    const setActive = (i) => {
      var _a;
      if (!state.hits.length) return;
      state.active = Math.max(0, Math.min(state.hits.length - 1, i));
      listEl.querySelectorAll(".bz-popover-item").forEach((el, k) => {
        el.classList.toggle("is-on", k === state.active);
      });
      (_a = listEl.querySelector(".bz-popover-item.is-on")) == null ? void 0 : _a.scrollIntoView({ block: "nearest" });
    };
    const renderList = () => {
      listEl.innerHTML = "";
      state.hits = fuzzyFilterEntries(entries, search.value.trim());
      state.active = 0;
      if (!state.hits.length) {
        const empty = document.createElement("div");
        empty.className = "bz-popover-empty";
        empty.textContent = "没有匹配的密码条目";
        listEl.appendChild(empty);
        return;
      }
      const shown = state.hits.slice(0, LIMIT);
      shown.forEach((d, i) => {
        const row = document.createElement("div");
        row.className = "bz-popover-item" + (i === 0 ? " is-on" : "");
        row.setAttribute("role", "option");
        const mid = document.createElement("div");
        mid.className = "mid";
        const pl = document.createElement("div");
        pl.className = "pl";
        pl.textContent = d.platform || "(无平台)";
        const ac = document.createElement("div");
        ac.className = "ac";
        ac.textContent = d.account || "(无账号)";
        mid.appendChild(pl);
        mid.appendChild(ac);
        const key = document.createElement("span");
        key.className = "key";
        key.textContent = "Enter 复制";
        row.appendChild(mid);
        row.appendChild(key);
        row.addEventListener("click", () => {
          closePasswordQuickPicker();
          onPick(d);
        });
        listEl.appendChild(row);
      });
      if (state.hits.length > LIMIT) {
        const more = document.createElement("div");
        more.className = "bz-popover-empty";
        more.textContent = `已显示前 ${LIMIT} 条（共 ${state.hits.length} 条命中），请输入关键词缩小范围`;
        listEl.appendChild(more);
      }
    };
    search.addEventListener("input", () => renderList());
    search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(state.active + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(state.active - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const d = state.hits[state.active];
        if (d) {
          closePasswordQuickPicker();
          onPick(d);
        }
      }
    });
    popup.append(head, search, listEl);
    document.body.appendChild(mask);
    document.body.appendChild(popup);
    mask.style.display = "block";
    popup.style.display = "flex";
    currentHandle2 = escManager.register("bz-encrypt-pw-picker", {
      isVisible: () => !!currentMask2,
      close: () => closePasswordQuickPicker()
    });
    renderList();
    focusTimer2 = window.setTimeout(() => {
      focusTimer2 = null;
      if (mask.isConnected) search.focus();
    }, 30);
  }
  var LIMIT, currentMask2, currentPopup2, currentHandle2, focusTimer2;
  var init_pw_picker = __esm({
    "src/encrypt/pw-picker.ts"() {
      init_dom();
      init_esc_manager();
      LIMIT = 100;
      currentMask2 = null;
      currentPopup2 = null;
      currentHandle2 = null;
      focusTimer2 = null;
    }
  });

  // src/encrypt/vault-assets-view.ts
  function vIc(name, size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS2[name] || ""}</svg>`;
  }
  function overviewHTML(stats) {
    const { counts, pwPlatforms, pwFavPlatforms, attachments, recent: recent2, health } = stats;
    const total = counts.pw + counts.note + counts.diary;
    const pwFav = counts.pw ? `${pwFavPlatforms} 个平台已收藏 · ` : "";
    const noteCd = counts.note ? `含 ${attachments} 个附件镜像` : "还没有加密笔记";
    const pwCd = counts.pw ? `${pwFav}${pwPlatforms} 个平台` : "还没有密码";
    const healthRows = health == null ? `<div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">待处理</span><span class="n">未体检</span></div>` : `<div class="bz-vault-hrow"><span class="dot" style="background:${health.issues ? "var(--bz-danger)" : "var(--bz-success)"}"></span><span class="lbl">待处理</span><span class="n">${health.issues}</span></div>`;
    const recentRows = recent2.length ? recent2.map((r) => {
      const color = r.kind === "pw" ? ASSET_COLOR.pw : r.kind === "note" ? ASSET_COLOR.note : ASSET_COLOR.diary;
      const iconName = r.kind === "pw" ? "key" : r.kind === "note" ? "file-lock" : "book-lock";
      return `<div class="bz-vault-minirow" data-recent="${r.kind}">
            <span class="av" style="background:${color}">${vIc(iconName, 14)}</span>
            <div class="mid"><div class="a">${escapeHtml(r.title)}</div><div class="b">${escapeHtml(r.sub)}</div></div>
            <span class="tm">${escapeHtml(r.time)}</span></div>`;
    }).join("") : '<div class="bz-empty"><span class="bz-empty-ic">' + vIc("lock", 28) + '</span><div class="bz-empty-title">还没有加密资产</div><div class="bz-empty-desc">录入密码、加密笔记或加密日记后，最近动态在这里显示</div></div>';
    return `
  <div class="bz-vault-hero">
    <div class="ht">${vIc("lock", 14)} 保险库已解锁 · 三类资产集中管理</div>
    <div class="hn">${total} 项资产${total > 0 ? " · 尽在掌握" : ""}</div>
    <div class="hd">密码 · 加密笔记 · 加密日记 — 同一把主密码，AES-256-GCM</div>
    <div class="hbtns">
      <button class="hbtn" data-hero="lock-note">${vIc("file-lock", 14)} 加密当前笔记</button>
      <button class="hbtn" data-hero="add-pw">${vIc("key", 14)} 新增密码</button>
      <button class="hbtn" data-hero="health">${vIc("stethoscope", 14)} 体检</button>
    </div>
  </div>
  <div class="bz-vault-cards">
    <div class="card" data-nav="pw">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.pw}">${vIc("key", 13)}</span>密码条目</div>
      <div class="num">${counts.pw}<small>个账号</small></div>
      <div class="cd">${pwCd}</div>
    </div>
    <div class="card" data-nav="note">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.note}">${vIc("file-lock", 13)}</span>加密笔记</div>
      <div class="num">${counts.note}<small>篇</small></div>
      <div class="cd">${noteCd}</div>
    </div>
    <div class="card" data-nav="diary">
      <div class="ct"><span class="k" style="background:${ASSET_COLOR.diary}">${vIc("book-lock", 13)}</span>加密日记</div>
      <div class="num">${counts.diary}<small>篇</small></div>
      <div class="cd">随日记面板「加密」分类移入</div>
    </div>
  </div>
  <div class="bz-vault-two">
    <div class="panel">
      <div class="pt">最近加密<span class="more" data-hero="recent-all">查看全部 →</span></div>
      ${recentRows}
    </div>
    <div class="panel" data-hero="health" title="打开保险库体检">
      <div class="pt">保险库体检<span class="more">查看 →</span></div>
      ${healthRows}
      <div class="bz-vault-hrow"><span class="dot" style="background:var(--bz-text-3)"></span><span class="lbl">完整性校验</span><span class="n">${(health == null ? void 0 : health.lastChecked) || "—"}</span></div>
    </div>
  </div>`;
  }
  function noteRowHTML(note, kind, active) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const sub = kind === "note" ? `${note.attachments.length} 个附件 · ${escapeHtml(note.path)}` : (note.path.split("/").pop() || note.title) + (note.attachments.length ? ` · ${note.attachments.length} 个附件` : "");
    return `
    <div class="bz-vault-row ${active ? "on" : ""}" data-noteid="${escapeHtml(note.id)}" data-kind="${kind}">
      <span class="av" style="background:${color}">${vIc(iconName, 16)}</span>
      <div class="mid"><div class="t1">${escapeHtml(note.title)}</div><div class="t2">${sub}</div></div>
      <span class="tm">${escapeHtml(formatRelativeTime(note.createdAt))}</span>
    </div>`;
  }
  function noteDetailHTML(note, kind, plainPreview) {
    const color = ASSET_COLOR[kind];
    const iconName = kind === "note" ? "file-lock" : "book-lock";
    const attChips = note.attachments.length ? note.attachments.slice(0, 6).map((a) => {
      const kb = a.blobSize ? Math.max(1, Math.round(a.blobSize / 1024)) : 0;
      const kindIc = vIc(a.kind === "video" ? "film" : "image", 12);
      return `<span class="chip att">${kindIc} ${escapeHtml(a.path.split("/").pop() || a.path)}${kb ? ` · ${kb} KB` : ""}</span>`;
    }).join("") + (note.attachments.length > 6 ? `<span class="chip">+${note.attachments.length - 6} 更多</span>` : "") : '<span class="chip">无附件</span>';
    const pathLine = kind === "note" ? `${escapeHtml(note.path)} · 已移出` : `${escapeHtml(note.path)} · 已还原该段`;
    const created = new Date(note.createdAt).toLocaleString("zh-CN", { hour12: false });
    const actionBtns = kind === "note" ? `<button class="bbtn teal" data-detail="preview">${vIc("eye", 14)} 预览</button>
         <button class="bbtn" data-detail="restore">${vIc("download", 14)} 还原到原路径</button>
         <button class="bbtn danger" data-detail="delete">${vIc("trash-2", 14)} 删除</button>` : `<button class="bbtn" style="background:${color};color:#fff" data-detail="restore-diary">${vIc("download", 14)} 还原回日记</button>
         <button class="bbtn" data-detail="copy-diary">${vIc("copy", 14)} 复制正文</button>
         <button class="bbtn danger" data-detail="destroy-diary">${vIc("trash-2", 14)} 彻底销毁</button>`;
    return `
    <div class="bz-vault-dhead">
      <span class="big" style="background:${color}">${vIc(iconName, 21)}</span>
      <div class="ttl"><h2>${escapeHtml(note.title)}</h2><div class="url">${pathLine}</div></div>
      <div class="acts"><button class="ic" data-detail="menu" title="更多操作">${vIc("more-h", 15)}</button></div>
    </div>
    <div class="bz-vault-dcontent">
      ${kind === "note" ? `<div class="field"><div class="lab">附件镜像</div><div class="valrow chips">${attChips}</div></div>
           <div class="field"><div class="lab">加密时间</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>
           <div class="note hint">原笔记正文已 100% 密文化；双击列表行可压缩预览（原图按需加载原层）。</div>` : `<div class="field"><div class="lab">正文预览</div><div class="note pre">${plainPreview ? escapeHtml(plainPreview).replace(/\n/g, "<br>") : "（未解密预览）"}</div></div>
           <div class="field"><div class="lab">加密于</div><div class="valrow"><span class="val">${escapeHtml(created)}</span></div></div>`}
      <div class="bigbtns">${actionBtns}</div>
    </div>`;
  }
  var ASSET_COLOR, ICON_PATHS2;
  var init_vault_assets_view = __esm({
    "src/encrypt/vault-assets-view.ts"() {
      init_utils();
      ASSET_COLOR = {
        pw: "var(--bz-brand)",
        note: "#2e7d68",
        diary: "#5a63a8"
      };
      ICON_PATHS2 = {
        lock: '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        "lock-open": '<rect x="4" y="10" width="16" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 7.9-.9"/>',
        key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3z"/>',
        "file-lock": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 12v4"/><circle cx="12" cy="9" r="1.4" fill="currentColor" stroke="none"/>',
        "book-lock": '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
        eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        "trash-2": '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
        copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        "more-h": '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
        stethoscope: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
        "refresh-cw": '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
        settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        "chevron-left": '<path d="m15 18-6-6 6-6"/>',
        star: '<path d="M12 2 15 9l7 .8-5.3 4.7 1.6 6.9L12 17.8 5.7 21.4l1.6-6.9L2 9.8 9 9z"/>',
        "star-outline": '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
        "layout-grid": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        "eye-off": '<path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
        "triangle-alert": '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 20h16a2 2 0 0 0 1.73-2"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
        image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
      };
    }
  });

  // src/encrypt/ui.ts
  function statusbarHtml(unlocked) {
    return `${vIc(unlocked ? "lock-open" : "lock", 12)} 保险库`;
  }
  function secureRandomPassword(length, charset) {
    const n = charset.length;
    if (!(length > 0) || n === 0) return "";
    const LIMIT2 = Math.floor(4294967296 / n) * n;
    let pwd = "";
    while (pwd.length < length) {
      const buf = new Uint32Array(length - pwd.length);
      crypto.getRandomValues(buf);
      for (let i = 0; i < buf.length && pwd.length < length; i++) {
        if (buf[i] >= LIMIT2) continue;
        pwd += charset.charAt(buf[i] % n);
      }
    }
    return pwd;
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
  function passwordStrength(pw) {
    if (!pw) return "weak";
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score <= 2 ? "weak" : score <= 4 ? "mid" : "strong";
  }
  function pwStrengthLabel(s) {
    return s === "weak" ? "弱" : s === "mid" ? "中" : "强";
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
      const clean = decodeURIComponent(r).replace(/^\.\//, "");
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
    const t = decodeURIComponent(target).trim();
    return attachments.find((a) => a.path === t || a.path.endsWith("/" + t));
  }
  function mediaHtml(a, dataUrl) {
    if (!a) return "";
    const alt = escapeHtml(a.path || "");
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
          icon: "folder-open",
          name: "存储",
          rows: [
            // ticket 128：保险库根目录（统一路径选择器录入，无手输文本框；点前缀目录可选自 CONFIG/.ENCRYPT）
            {
              type: "path",
              mode: "single",
              name: "保险库根目录",
              desc: "加密文件的存放位置",
              binding: { key: "encryptRoot" },
              onCommit: warnReload
            }
          ]
        },
        {
          icon: "image",
          name: "预览",
          rows: [
            { type: "toggle", name: "生成压缩预览", desc: "加密时生成图片视频的压缩预览", binding: { key: "encryptPreviewEnabled" }, onChange: warnReload },
            { type: "number", name: "预览长边", desc: "预览图目标长边像素", binding: numStrBinding("encryptPreviewSize", 384), min: 64, max: 1024, step: 16, onCommit: warnReload, isChild: true },
            { type: "number", name: "预览质量", desc: "JPEG 图像压缩质量", binding: numStrBinding("encryptPreviewQuality", 0.5), min: 0.1, max: 1, step: 0.1, onCommit: warnReload, isChild: true },
            { type: "toggle", name: "预览自动加载原图", desc: "打开预览自动解密原图", binding: { key: "encryptAutoLoadOriginal" }, onChange: warnReload, isChild: true }
          ]
        }
      ]
    };
  }
  var CLIPBOARD_CLEAR_DELAY_MS, clipboardClearTimer, lastVisitedAsset, _UIManager, UIManager, _EncryptAppController, EncryptAppController;
  var init_ui2 = __esm({
    "src/encrypt/ui.ts"() {
      init_fake_obsidian();
      init_notice();
      init_app();
      init_esc_manager();
      init_flow_dialog();
      init_dom();
      init_item_actions();
      init_utils();
      init_ui();
      init_settings_provider();
      init_settings_modal();
      init_settings_common();
      init_data();
      init_preview();
      init_vault_data();
      init_vault_pw_view();
      init_pw_picker();
      init_vault_assets_view();
      CLIPBOARD_CLEAR_DELAY_MS = 6e4;
      clipboardClearTimer = null;
      lastVisitedAsset = "pw";
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
          /** 搜索防抖计时器 */
          this.searchTimer = null;
          /** 密码资产状态（列表筛选/选中/显隐） */
          this.pwState = { ...DEFAULT_PW_STATE };
          /** 当前资产视图（概览/密码/笔记/日记） */
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
          this._selNoteId = null;
          this._pwEditingId = null;
          /** 同平台+账号查重命中后的放行标志（同一弹窗会话内再点一次保存即放行） */
          this._pwDupConfirmed = false;
          /** 弹窗内联动刷新（强度提示等）；ensurePwDialog 首建时注入 */
          this.pwDlgSyncUi = null;
          this.pwDlg = null;
          /** 密码添加/编辑弹窗的 ESC 层（E7：弹窗可见时 ESC 只关弹窗，不穿透关掉主面板） */
          this.pwDlgEsc = null;
          this.dataManager = dataManager;
          this.config = config;
          this.pwDataManager = pwDataManager || new PasswordVaultDataManager(dataManager);
          this.pwView = new VaultPwView(
            this.pwDataManager,
            {
              toast: (m, err) => this.toast(m, err),
              openPwEntryDialog: (edit, prefill) => this.openPwEntryDialog(edit, prefill),
              openPwPlatformEdit: (p) => this.openPwPlatformEdit(p),
              askConfirm: (t, m, okLabel, cb) => this.askConfirm(t, m, okLabel, cb),
              copySensitive: (t) => this.copySensitive(t),
              openExternal: (u) => this.openExternal(u),
              onPwChanged: () => this.renderAll(),
              openPwAccountPage: (d, st) => this.openPwAccountPage(d, st)
            },
            { charset: config.pwCharset, length: config.pwLength }
          );
          this.pwDataManager.onExternalChange = () => this.renderAll();
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
          <div class="bz-vault-item on" data-asset="overview">${vIc("layout-grid", 16)}概览<span class="cnt" data-cnt="overview"></span></div>
          <div class="bz-vault-sec">资产档案</div>
          <div class="bz-vault-item" data-asset="pw">${vIc("key", 16)}密码<span class="cnt" data-cnt="pw"></span></div>
          <div class="bz-vault-item k-note" data-asset="note">${vIc("file-lock", 16)}加密笔记<span class="cnt" data-cnt="note"></span></div>
          <div class="bz-vault-item k-diary" data-asset="diary">${vIc("book-lock", 16)}加密日记<span class="cnt" data-cnt="diary"></span></div>
          <div class="grow"></div>
          <div class="bz-vault-health" data-act="health-card" title="打开保险库体检">
            <div class="ht"><span class="okdot"></span><span data-health-t>保险库健康</span></div>
            <div class="hd" data-health-d>未体检</div>
          </div>
          <div class="bz-vault-lockbtn" data-act="lock"><span class="lbl">${vIc("lock", 14)} 立即上锁</span><span class="dur" data-unlock-dur></span><span class="dot"></span></div>
        </div>
        <div class="bz-vault-main">
          <div class="bz-vault-bar">
            <h1 data-vault-title>保险库</h1>
            <div class="sub" data-vault-sub></div>
            <div class="bz-vault-search">${vIc("search", 14)}<input placeholder="搜索全部资产…" data-vault-search></div>
            <button class="bz-vault-ic" data-act="gen" title="生成密码">${vIc("refresh-cw", 15)}</button>
            <button class="bz-vault-ic" data-act="lock-note" title="加密当前笔记">${vIc("file-lock", 15)}</button>
            <button class="bz-vault-ic" data-act="health" title="保险库体检">${vIc("stethoscope", 15)}</button>
            <button class="bz-vault-ic" data-act="settings" title="保险库设置">${vIc("settings", 15)}</button>
            <button class="bz-vault-ic close" data-act="close" title="关闭">${vIc("x", 15)}</button>
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
        <div class="bz-vault-msearch">${vIc("search", 13)}<input placeholder="搜索全部资产…" data-mob-search></div>
        <div class="bz-vault-mseg" data-mob-seg>
          <span class="sg on" data-masset="overview">概览</span>
          <span class="sg" data-masset="pw">密码</span>
          <span class="sg" data-masset="note">笔记</span>
          <span class="sg" data-masset="diary">日记</span>
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
            count: desk.querySelector('[data-cnt="overview"]'),
            search: desk.querySelector("[data-vault-search]")
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
          this._initialized = true;
        }
        /** 统一骨架交互：资产导航 / 顶栏动作 / 搜索防抖 / 移动端 seg */
        bindVaultShell() {
          var _a, _b, _c, _d, _e, _f, _g, _h;
          const setAsset = (a) => {
            this.asset = a;
            lastVisitedAsset = a;
            this.pwState.searchKw = "";
            this.desk.search.value = "";
            this.mob.search.value = "";
            this.renderAll();
          };
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-asset") || "overview"));
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            el.addEventListener("click", () => setAsset(el.getAttribute("data-masset") || "overview"));
          });
          (_a = this.popup.querySelector('[data-act="lock"]')) == null ? void 0 : _a.addEventListener("click", () => this.lockNow());
          (_b = this.popup.querySelector('[data-act="close"]')) == null ? void 0 : _b.addEventListener("click", () => this.hide());
          (_c = this.popup.querySelector('[data-act="mob-close"]')) == null ? void 0 : _c.addEventListener("click", () => this.hide());
          (_d = this.popup.querySelector('[data-act="settings"]')) == null ? void 0 : _d.addEventListener("click", () => this.openSettings());
          (_e = this.popup.querySelector('[data-act="health"]')) == null ? void 0 : _e.addEventListener("click", () => void this.openHealthDialog());
          (_f = this.popup.querySelector('[data-act="health-card"]')) == null ? void 0 : _f.addEventListener("click", () => void this.openHealthDialog());
          (_g = this.popup.querySelector('[data-act="lock-note"]')) == null ? void 0 : _g.addEventListener("click", () => {
            var _a2;
            return (_a2 = this.onLockCurrentNote) == null ? void 0 : _a2.call(this);
          });
          (_h = this.popup.querySelector('[data-act="gen"]')) == null ? void 0 : _h.addEventListener("click", () => this.genAndToast());
          const bindSearch = (input, isMob) => {
            input.addEventListener("input", () => {
              const v = input.value.trim();
              if (this.asset === "overview" && v) {
                this.asset = "pw";
                lastVisitedAsset = "pw";
              }
              this.pwState.searchKw = v;
              this.desk.search.value = isMob ? v : this.desk.search.value;
              this.mob.search.value = isMob ? this.mob.search.value : v;
              if (this.searchTimer) clearTimeout(this.searchTimer);
              this.searchTimer = setTimeout(() => this.renderAll(), 180);
            });
          };
          bindSearch(this.desk.search, false);
          bindSearch(this.mob.search, true);
          this.mask.addEventListener("click", () => {
            if (this.mask.style.display === "block") this.hide();
          });
          const bump = () => this.bumpIdleLock();
          this.popup.addEventListener("pointerdown", bump, true);
          this.popup.addEventListener("keydown", bump, true);
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
          this.notifyUnlockUi();
          void this.renderList();
          this.startSessionTimers();
        }
        hide() {
          if (this.mask) this.mask.style.display = "none";
          if (this.popup) this.popup.style.display = "none";
          this.stopSessionTimers();
          if (this.isSecurityMode()) {
            this.dataManager.lock();
            this.pwDataManager.lock();
            this.pwState = { ...DEFAULT_PW_STATE };
            this._selNoteId = null;
            this._diaryPlain = {};
            this.noticeAutoLock();
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
            this.lockNow();
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
          void this.runHealthScan();
        }
        ensureHealthElements() {
          const mask = document.createElement("div");
          mask.id = "bz-encrypt-health-mask";
          mask.className = "bz-encrypt-health-mask";
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
          try {
            const report = await this.dataManager.scanHealth((p) => {
              progress.textContent = `检查中 ${p.done}/${p.total} · ${truncateName(p.current)}`;
              bar.setValue(Math.round(p.done / p.total * 100));
              for (const item of p.found) {
                const row = document.createElement("div");
                row.className = "bz-encrypt-health-item " + (item.cat === "corrupted-body" || item.cat === "corrupted-attachment" ? "bz-encrypt-health-item--bad" : item.cat === "missing-attachment" ? "bz-encrypt-health-item--warn" : "");
                row.textContent = item.label;
                live2.appendChild(row);
              }
            });
            this.lastHealth = { issues: report.items.length, lastChecked: (/* @__PURE__ */ new Date()).toLocaleString() };
            this.renderHealthReport(report, body);
            this.renderNav();
          } catch (e) {
            body.innerHTML = "";
            const err = document.createElement("div");
            err.textContent = "体检失败：" + e.message;
            body.appendChild(err);
          }
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
              { label: "永久删除", value: "ok", cta: true }
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
         * 主密码弹窗（首设两次确认 + 损坏清单重设确认）。视觉样式已收敛至 styles.css
         * （铁律 9：.bz-encrypt-dialog-* 类）；内联仅保留功能性 zIndex/显隐（display）。
         */
        async showPasswordDialog() {
          const exists = await this.dataManager.exists();
          return new Promise((resolve) => {
            const mask = document.createElement("div");
            mask.className = "bz-encrypt-dialog-mask";
            topifyZ(mask);
            mask.style.display = "flex";
            const box = document.createElement("div");
            box.className = "bz-encrypt-dialog-box";
            const title = document.createElement("h4");
            title.className = "bz-encrypt-dialog-title";
            const message = document.createElement("p");
            message.className = "bz-encrypt-dialog-msg";
            const input = document.createElement("input");
            input.type = "password";
            input.placeholder = "输入主密码";
            input.className = "bz-encrypt-dialog-input";
            const input2 = document.createElement("input");
            input2.type = "password";
            input2.placeholder = "再次输入";
            input2.className = "bz-encrypt-dialog-input";
            input2.style.display = "none";
            const warning = document.createElement("div");
            warning.className = "bz-encrypt-dialog-warning";
            warning.style.display = "none";
            warning.innerHTML = `${vIc("triangle-alert", 14)} <strong>重要提醒</strong><br>• 主密码 <b>不会存储</b>，也无法找回，请务必牢记！<br>• 若遗忘密码，加密笔记及其附件将永久丢失。<br>• 建议使用密码本（如 Bitwarden）保存此密码。`;
            const ack = document.createElement("label");
            ack.className = "bz-encrypt-dialog-ack";
            ack.style.display = "none";
            const ackBox = document.createElement("input");
            ackBox.type = "checkbox";
            ack.appendChild(ackBox);
            ack.appendChild(document.createTextNode("我已了解：主密码无法找回，遗忘将导致密文永久无法恢复"));
            if (exists) {
              title.textContent = "输入主密码";
              message.textContent = "请输入您设置的主密码以解锁保险库";
              input2.style.display = "none";
              warning.style.display = "none";
              ack.style.display = "none";
            } else {
              title.textContent = "设置主密码";
              message.textContent = "请设置一个主密码（用于加密所有数据）";
              input2.style.display = "block";
              input2.placeholder = "再次输入";
              warning.style.display = "block";
              ack.style.display = "block";
            }
            const btnContainer = document.createElement("div");
            btnContainer.className = "bz-encrypt-dialog-btns";
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "取消";
            cancelBtn.className = "bz-encrypt-dialog-btn";
            cancelBtn.onclick = () => {
              document.body.removeChild(mask);
              resolve(false);
            };
            const confirmBtn = document.createElement("button");
            confirmBtn.textContent = "确认";
            confirmBtn.className = "bz-encrypt-dialog-btn bz-encrypt-dialog-btn--primary";
            confirmBtn.onclick = async () => {
              const pw = input.value;
              if (!pw) {
                notice("请输入密码");
                return;
              }
              if (!exists) {
                if (input2.style.display === "none") {
                  input2.style.display = "block";
                  input2.value = "";
                  this.focusUnlockInput(input2);
                  message.textContent = "请再次输入主密码确认";
                  return;
                } else {
                  if (pw !== input2.value) {
                    notice("两次密码不一致");
                    return;
                  }
                  if (!ackBox.checked) {
                    notice("请先勾选风险确认");
                    return;
                  }
                  try {
                    const ok = await this.dataManager.unlock(pw);
                    if (ok) {
                      document.body.removeChild(mask);
                      resolve(true);
                      notice("密码已设置，数据已加密", "success");
                    } else {
                      notice("设置失败：无法写入清单，请检查磁盘空间后重试", "error");
                      resolve(false);
                    }
                  } catch (e) {
                    notifyActionError(e, "设置主密码");
                    resolve(false);
                  }
                  return;
                }
              } else {
                const remainMs = this.unlockCooldownUntil - Date.now();
                if (remainMs > 0) {
                  notice(`尝试过于频繁，请再等 ${Math.ceil(remainMs / 1e3)} 秒`, "warning");
                  return;
                }
                const success = await this.dataManager.unlock(pw);
                if (success) {
                  this.resetUnlockThrottle();
                  document.body.removeChild(mask);
                  resolve(true);
                  const healMsg = this.dataManager.selfHealRolledBack > 0 ? "；上次未完成的加密已自动回滚，原文未动" : "";
                  notice("解锁成功" + healMsg, "success");
                } else {
                  const issue = this.dataManager.manifestIssue;
                  if (issue === "empty" || issue === "corrupt") {
                    void openFlowDialog({
                      title: "清单疑似损坏",
                      message: "保险库清单文件为空或无法解析（可能因写入中断/同步冲突损坏）。重设主密码将生成全新空清单，旧加密数据将永久无法恢复。确定重设吗？",
                      actions: [
                        { label: "暂不重设", value: "cancel" },
                        { label: "仍要重设", value: "ok", cta: true }
                      ]
                    }).then((v) => {
                      if (v === "ok") {
                        void this.dataManager.unlock(pw, true).then((ok) => {
                          if (ok) {
                            this.resetUnlockThrottle();
                            document.body.removeChild(mask);
                            resolve(true);
                            notice("已重设主密码（旧数据不可恢复）", "warning");
                          } else {
                            notice("重设失败：无法写入清单", "error");
                          }
                        });
                      } else {
                        notice("未重设：请先检查或备份数据文件", "warning");
                      }
                    });
                  } else {
                    notice("密码错误，请重试", "error");
                    const delaySec = this.registerUnlockFailure();
                    notice(`${delaySec} 秒后可再次尝试`, "warning");
                    input.value = "";
                    this.focusUnlockInput(input);
                  }
                }
              }
            };
            input.addEventListener("keydown", (e) => {
              if (e.key === "Enter") confirmBtn.click();
            });
            input2.addEventListener("keydown", (e) => {
              if (e.key === "Enter") confirmBtn.click();
            });
            btnContainer.appendChild(cancelBtn);
            btnContainer.appendChild(confirmBtn);
            box.appendChild(title);
            box.appendChild(warning);
            box.appendChild(ack);
            box.appendChild(message);
            box.appendChild(input);
            box.appendChild(input2);
            box.appendChild(btnContainer);
            mask.appendChild(box);
            document.body.appendChild(mask);
            mask.onclick = (e) => {
              if (e.target === mask) {
                try {
                  document.body.removeChild(mask);
                } catch (err) {
                }
                resolve(false);
              }
            };
            this.focusUnlockInput(input);
            setTimeout(() => this.focusUnlockInput(input), 150);
          });
        }
        /** 输入框聚焦（不滚动页面）+ 兼容性兜底；移动端靠二次聚焦触发系统键盘 */
        focusUnlockInput(el) {
          try {
            el.focus({ preventScroll: true });
          } catch (e) {
            el.focus();
          }
        }
        // ---------- 统一工作台渲染 ----------
        /** show/解锁/外部变更/资产切换统一入口：加载 → 全量重绘 */
        async renderList() {
          if (!this.listContainer) return;
          if (this.dataManager.unlocked) {
            try {
              await this.pwDataManager.load();
            } catch (e) {
            }
          }
          this.renderAll();
        }
        /** 全量重绘：导航计数 + 概览/资产内容 + 移动端 + 健康卡 + 顶栏标题 */
        renderAll() {
          if (!this.rootVisible()) return;
          this.renderNav();
          this.renderDesktop();
          this.renderMobile();
        }
        rootVisible() {
          return !!(this.popup && this.popup.style.display === "flex");
        }
        /** 资产计数 + 导航高亮 */
        counts() {
          const notes = this.dataManager.manifest.notes;
          return {
            pw: this.pwDataManager.pwData.length,
            note: notes.filter((n) => n.kind !== "diary-entry" && n.kind !== "password-vault").length,
            diary: notes.filter((n) => n.kind === "diary-entry").length
          };
        }
        renderNav() {
          const c = this.counts();
          const setCnt = (a, v) => {
            const el = this.popup.querySelector(`[data-cnt="${a}"]`);
            if (el) el.textContent = String(v);
          };
          setCnt("overview", c.pw + c.note + c.diary);
          setCnt("pw", c.pw);
          setCnt("note", c.note);
          setCnt("diary", c.diary);
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach((el) => {
            el.classList.toggle("on", el.getAttribute("data-asset") === this.asset);
          });
          this.mob.seg.querySelectorAll(".sg").forEach((el) => {
            el.classList.toggle("on", el.getAttribute("data-masset") === this.asset);
          });
          const ht = this.popup.querySelector("[data-health-t]");
          const hd = this.popup.querySelector("[data-health-d]");
          const dot = this.popup.querySelector(".bz-vault-health .okdot");
          if (ht) ht.textContent = c.pw + c.note + c.diary ? "保险库健康" : "保险库为空";
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
        /** 概览统计（供 overviewHTML） */
        overviewStats() {
          const c = this.counts();
          const allNotes = [...this.dataManager.manifest.notes].filter((n) => n.kind !== "password-vault");
          const attachments = allNotes.reduce((s, n) => s + n.attachments.length, 0);
          const pwPlats = this.pwDataManager.platforms();
          const recent2 = [];
          const pushRecent = (kind, title, sub, time, ts) => recent2.push({ kind, title, sub, time, ts });
          for (const p of pwPlats.slice(0, 3)) {
            const r = p.accounts[0];
            const created = r && r.createdAt || "";
            pushRecent("pw", p.platform, r ? r.account || "(无账号)" : "", relTime(created), Date.parse(created) || 0);
          }
          for (const n of allNotes.slice(0, 3)) {
            const kind = n.kind === "diary-entry" ? "diary" : "note";
            pushRecent(kind, n.title, `${n.attachments.length} 个附件`, formatRelativeTime(n.createdAt), Date.parse(n.createdAt || "") || 0);
          }
          recent2.sort((a, b) => b.ts - a.ts);
          return {
            counts: c,
            pwPlatforms: pwPlats.length,
            pwFavPlatforms: pwPlats.filter((p) => this.pwDataManager.hasFav(p.platform)).length,
            attachments,
            recent: recent2.slice(0, 6).map(({ kind, title, sub, time }) => ({ kind, title, sub, time })),
            health: this.lastHealth
            // E5：随最近一次体检结果更新（未体检 null → 显示「未体检」）
          };
        }
        /** 桌面区渲染（中列表 + 右详情按资产分发） */
        renderDesktop() {
          var _a;
          this.desk.list.innerHTML = "";
          this.desk.detail.innerHTML = "";
          if (this.asset !== "pw") {
            (_a = this.popup.querySelector('.bz-vault-bar [data-act="pw-fav"]')) == null ? void 0 : _a.remove();
          }
          if (this.asset === "overview") {
            this.renderDeskOverview();
            return;
          }
          if (this.asset === "pw") {
            this.renderDeskPw();
            return;
          }
          const kind = this.asset;
          this.renderDeskNotes(kind);
        }
        /** 顶栏标题/副标题（各资产渲染器共用出口） */
        setVaultHead(title, sub) {
          this.popup.querySelector("[data-vault-title]").textContent = title;
          this.popup.querySelector("[data-vault-sub]").textContent = sub;
        }
        /** 桌面概览：hero 计数 + 统计卡 + 最近 + 体检摘要（点击跳资产/动作） */
        renderDeskOverview() {
          var _a, _b, _c;
          const c = this.counts();
          this.setVaultHead("保险库", `${c.pw} 密码 · ${c.note} 笔记 · ${c.diary} 日记`);
          const detail = this.desk.detail;
          const area = document.createElement("div");
          area.className = "bz-vault-area";
          area.innerHTML = overviewHTML(this.overviewStats());
          area.querySelectorAll(".card[data-nav]").forEach(
            (el) => el.addEventListener("click", () => this.setAssetFromNav(el.getAttribute("data-nav")))
          );
          (_a = area.querySelector('[data-hero="lock-note"]')) == null ? void 0 : _a.addEventListener("click", () => {
            var _a2;
            return (_a2 = this.onLockCurrentNote) == null ? void 0 : _a2.call(this);
          });
          (_b = area.querySelector('[data-hero="add-pw"]')) == null ? void 0 : _b.addEventListener("click", () => this.openPwEntryDialog());
          area.querySelectorAll('[data-hero="health"]').forEach(
            (el) => el.addEventListener("click", () => void this.openHealthDialog())
          );
          (_c = area.querySelector('[data-hero="recent-all"]')) == null ? void 0 : _c.addEventListener("click", () => this.setAssetFromNav("pw"));
          area.querySelectorAll(".bz-vault-minirow[data-recent]").forEach(
            (el) => el.addEventListener("click", () => this.setAssetFromNav(el.getAttribute("data-recent")))
          );
          detail.appendChild(area);
        }
        /** 桌面密码资产：平台列表 + 账号详情 + 顶栏收藏切换钮 */
        renderDeskPw() {
          var _a;
          const list = this.desk.list;
          const detail = this.desk.detail;
          const kw = this.pwState.searchKw;
          const c = this.counts();
          this.setVaultHead("密码", kw ? `${this.pwDataManager.search(kw).length} 条匹配` : `${this.pwDataManager.platforms().length} 平台 · ${c.pw} 账号`);
          const barActs = this.popup.querySelector(".bz-vault-bar");
          const favBtn = barActs.querySelector('[data-act="pw-fav"]');
          const favIcon = vIc(this.pwState.view === "fav" ? "star" : "star-outline", 15);
          const favTitle = this.pwState.view === "fav" ? "全部平台" : "只看收藏";
          if (!favBtn) {
            const btn = document.createElement("button");
            btn.className = "bz-vault-ic";
            btn.dataset.act = "pw-fav";
            btn.title = favTitle;
            btn.innerHTML = favIcon;
            barActs.appendChild(btn);
            btn.addEventListener("click", () => {
              this.pwState.view = this.pwState.view === "fav" ? "all" : "fav";
              this.renderAll();
            });
          } else {
            favBtn.title = favTitle;
            favBtn.innerHTML = favIcon;
          }
          const listHead = document.createElement("div");
          listHead.className = "bz-vault-lc-head";
          listHead.innerHTML = `<div class="t">平台</div><button class="lc-add" data-lc-add="pw" title="新增密码">${vIc("plus", 13)} 新增密码</button>`;
          (_a = listHead.querySelector('[data-lc-add="pw"]')) == null ? void 0 : _a.addEventListener("click", () => this.openPwEntryDialog());
          const listBody = document.createElement("div");
          listBody.className = "bz-vault-lc-body";
          list.appendChild(listHead);
          list.appendChild(listBody);
          this.pwView.renderDeskList(listBody, this.pwState, (p, a) => {
            this.pwState.selPlatform = p;
            this.pwState.selAccount = a;
            this.renderDesktop();
          });
          this.pwView.renderDeskDetail(detail, this.pwState);
        }
        /** 桌面加密笔记/日记：列表 + 详情（异步解密日记正文预览） */
        renderDeskNotes(kind) {
          const list = this.desk.list;
          const detail = this.desk.detail;
          const kw = this.pwState.searchKw;
          let notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          this.setVaultHead(
            kind === "note" ? "加密笔记" : "加密日记",
            kind === "note" ? `${notes.length} 篇 · 原路径已移出` : `${notes.length} 篇 · 日记面板「加密」分类移入`
          );
          if (kw) {
            const lower = kw.toLowerCase();
            notes = notes.filter((n) => (n.title || "").toLowerCase().includes(lower) || (n.path || "").toLowerCase().includes(lower));
          }
          const listHead = document.createElement("div");
          listHead.className = "bz-vault-lc-head";
          listHead.innerHTML = `<div class="t">${kind === "note" ? "全部加密笔记" : "加密日记条目"}</div><span class="lc-count">${notes.length} 项</span>`;
          const listBody = document.createElement("div");
          listBody.className = "bz-vault-lc-body";
          list.appendChild(listHead);
          list.appendChild(listBody);
          if (!notes.length) {
            listBody.replaceChildren(
              uiEmpty(
                kind === "note" ? { title: "还没有加密笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" } : { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" }
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
          this.renderNoteDetail(detail, notes.find((n) => n.id === selId) || notes[0], kind);
        }
        /** 详情 ⋮ → 弹行级抽屉（attachItemActions 需要真实元素承载，临时挂到 detail 根再触发 contextmenu） */
        openNoteDetailMenu(note, kind) {
          const holder = document.createElement("div");
          holder.style.display = "none";
          this.desk.detail.appendChild(holder);
          this.attachNoteDrawer(holder, note, kind);
          holder.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 }));
        }
        /** 加密笔记/日记详情（异步解密日记正文预览） */
        renderNoteDetail(detail, note, kind) {
          const plain = kind === "diary" ? this._diaryPlain[note.id] : void 0;
          detail.innerHTML = noteDetailHTML(note, kind, plain);
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
          bind("menu", () => this.openNoteDetailMenu(note, kind));
          if (kind === "diary" && !this._diaryPlain[note.id]) {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              if (t !== null && this._selNoteId === note.id) {
                this._diaryPlain[note.id] = t;
                this.renderNoteDetail(detail, note, kind);
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
        // ---------- 密码条目弹窗（添加/编辑/平台编辑/确认/toast） ----------
        /** 密码添加/编辑弹窗（移动端复用桌面弹窗 DOM；双端共享 pwDataManager） */
        openPwEntryDialog(edit, prefill) {
          var _a;
          if (!this.dataManager.unlocked) {
            notice("请先解锁保险库");
            return;
          }
          this._pwEditingId = edit ? edit.id : null;
          this._pwDupConfirmed = false;
          const dlg = this.ensurePwDialog();
          const title = dlg.querySelector(".bz-vault-dlg h3");
          title.textContent = edit ? "编辑密码条目" : "添加密码条目";
          const fields = ["platform", "url", "account", "password", "note"];
          fields.forEach((f) => {
            const input = dlg.querySelector(`[data-f="${f}"]`);
            input.value = edit ? edit[f] || "" : prefill && f !== "password" ? prefill[f] || "" : "";
          });
          const pw = edit ? edit.password : this.generatePassword();
          const pwInput = dlg.querySelector('[data-f="password"]');
          pwInput.value = pw;
          pwInput.type = "password";
          const eyeBtn = dlg.querySelector('[data-pwv-dlg="eye"]');
          if (eyeBtn) {
            eyeBtn.title = "显示密码";
            eyeBtn.innerHTML = vIc("eye", 14);
          }
          dlg.querySelector("[data-f-err]").textContent = "";
          (_a = this.pwDlgSyncUi) == null ? void 0 : _a.call(this);
          this.openPwDialogOverlay(true);
          const first = dlg.querySelector('[data-f="platform"]');
          first == null ? void 0 : first.focus();
        }
        ensurePwDialog() {
          var _a, _b, _c, _d, _e;
          if (this.pwDlg && document.body.contains(this.pwDlg)) return this.pwDlg;
          const dlg = document.createElement("div");
          dlg.className = "bz-vault-dlg-mask";
          dlg.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>添加密码条目</h3>
        <div class="sub">带 * 为必填 · 平台与账号密码不可为空</div>
        <label>平台 *</label><input data-f="platform" placeholder="如 GitHub">
        <label>链接（可选）</label><input data-f="url" placeholder="https://…">
        <label>账号 *</label><input data-f="account" placeholder="登录账号 / 邮箱 / 手机号">
        <label>密码 *</label>
        <div class="pwdrow"><input data-f="password" type="password" placeholder="密码" autocomplete="new-password"><button class="gen" data-pwv-dlg="gen">生成</button><button class="mini" data-pwv-dlg="eye" type="button" title="显示密码">${vIc("eye", 14)}</button></div>
        <div class="pwstrength" data-pw-strength></div>
        <label>备注（可选）</label><input data-f="note" placeholder="备用信息…">
        <div class="err" data-f-err></div>
        <div class="btns"><button class="cancel" data-pwv-dlg="cancel">取消</button><button class="save" data-pwv-dlg="save">保存</button></div>
      </div>`;
          const errEl = dlg.querySelector("[data-f-err]");
          const get = (f) => dlg.querySelector(`[data-f="${f}"]`).value.trim();
          (_a = dlg.querySelector('[data-pwv-dlg="eye"]')) == null ? void 0 : _a.addEventListener("click", () => {
            const input = dlg.querySelector('[data-f="password"]');
            const show = input.type === "password";
            input.type = show ? "text" : "password";
            const eye = dlg.querySelector('[data-pwv-dlg="eye"]');
            eye.title = show ? "隐藏密码" : "显示密码";
            eye.innerHTML = vIc(show ? "eye-off" : "eye", 14);
            input.focus();
          });
          const strengthEl = dlg.querySelector("[data-pw-strength]");
          const syncStrength = () => {
            const v = dlg.querySelector('[data-f="password"]').value;
            if (!v) {
              strengthEl.textContent = "";
              delete strengthEl.dataset.level;
              return;
            }
            const s = passwordStrength(v);
            strengthEl.textContent = "强度：" + pwStrengthLabel(s);
            strengthEl.dataset.level = s;
          };
          this.pwDlgSyncUi = syncStrength;
          dlg.querySelector('[data-f="password"]').addEventListener("input", syncStrength);
          const flow = [
            ["platform", "url"],
            ["url", "account"],
            ["account", "password"],
            ["password", "note"],
            ["note", null]
          ];
          for (const [f, next] of flow) {
            (_b = dlg.querySelector(`[data-f="${f}"]`)) == null ? void 0 : _b.addEventListener("keydown", (e) => {
              var _a2, _b2;
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (next) (_a2 = dlg.querySelector(`[data-f="${next}"]`)) == null ? void 0 : _a2.focus();
              else (_b2 = dlg.querySelector('[data-pwv-dlg="save"]')) == null ? void 0 : _b2.click();
            });
          }
          dlg.addEventListener("click", (e) => {
            if (e.target === dlg) this.openPwDialogOverlay(false);
          });
          (_c = dlg.querySelector('[data-pwv-dlg="gen"]')) == null ? void 0 : _c.addEventListener("click", () => {
            dlg.querySelector('[data-f="password"]').value = this.generatePassword();
            syncStrength();
            this.toast("已生成新密码");
          });
          (_d = dlg.querySelector('[data-pwv-dlg="cancel"]')) == null ? void 0 : _d.addEventListener("click", () => this.openPwDialogOverlay(false));
          (_e = dlg.querySelector('[data-pwv-dlg="save"]')) == null ? void 0 : _e.addEventListener("click", async () => {
            var _a2, _b2;
            const platform = get("platform");
            if (!platform) {
              errEl.textContent = "平台不能为空";
              return;
            }
            if (!get("account") || !get("password")) {
              errEl.textContent = "账号和密码不能为空";
              return;
            }
            const account = get("account");
            const dup = this.pwDataManager.pwData.find(
              (d) => d.id !== this._pwEditingId && (d.platform || "").trim() === platform && (d.account || "").trim() === account
            );
            if (dup && !this._pwDupConfirmed) {
              this._pwDupConfirmed = true;
              errEl.textContent = `该平台已有同名账号（${dup.account || account}），再次点击保存将放行`;
              return;
            }
            const item = { platform, url: get("url"), account, password: get("password"), note: get("note") };
            try {
              if (this._pwEditingId) {
                await this.pwDataManager.updateItem(this._pwEditingId, item);
                this.pwState.selPlatform = item.platform;
                this.pwState.selAccount = this._pwEditingId;
              } else {
                await this.pwDataManager.addItem(item);
                this.pwState.selPlatform = item.platform;
                this.pwState.selAccount = (_b2 = (_a2 = this.pwDataManager.pwData[0]) == null ? void 0 : _a2.id) != null ? _b2 : null;
              }
              this.openPwDialogOverlay(false);
              this.renderAll();
              this.toast("已保存");
            } catch (e) {
              errEl.textContent = "保存失败：" + e.message;
            }
          });
          document.body.appendChild(dlg);
          this.pwDlg = dlg;
          return dlg;
        }
        openPwDialogOverlay(open) {
          var _a;
          if (!this.pwDlg) return;
          if (open) {
            topifyZ(this.pwDlg);
            if (!this.pwDlgEsc) {
              this.pwDlgEsc = escManager.register("bz-vault-pw-dlg", {
                isVisible: () => !!this.pwDlg && this.pwDlg.style.display !== "none" && document.body.contains(this.pwDlg),
                close: () => this.openPwDialogOverlay(false)
              });
            }
          } else {
            (_a = this.pwDlgEsc) == null ? void 0 : _a.unregister();
            this.pwDlgEsc = null;
          }
          this.pwDlg.style.display = open ? "flex" : "none";
        }
        /** 卸载辅助：关密码弹窗（注销 ESC 层）并移除 body 上无 id 的弹窗遮罩（G：cleanup 此前不清） */
        closeAllDialogs() {
          this.openPwDialogOverlay(false);
          document.querySelectorAll("body > .bz-vault-dlg-mask").forEach((el) => el.remove());
        }
        /** 平台信息编辑弹窗（独立自绘） */
        openPwPlatformEdit(platform) {
          var _a, _b;
          const accs = this.pwDataManager.accountsOf(platform);
          const d = accs[0];
          const mask = document.createElement("div");
          mask.className = "bz-vault-dlg-mask";
          topifyZ(mask);
          mask.style.display = "flex";
          mask.innerHTML = `
      <div class="bz-vault-dlg">
        <h3>编辑平台 · ${escapeHtml(platform)}</h3>
        <div class="sub">改名/改链接将应用到该平台全部账号</div>
        <label>平台名 *</label><input data-pf="platform" value="${escapeHtml(platform === "(无平台)" ? "" : platform)}">
        <label>链接（可选）</label><input data-pf="url" value="${escapeHtml((d == null ? void 0 : d.url) || "")}">
        <div class="err" data-pf-err></div>
        <div class="btns"><button class="cancel" data-pf-act="cancel">取消</button><button class="save" data-pf-act="save">保存</button></div>
      </div>`;
          const errEl = mask.querySelector("[data-pf-err]");
          let escH = null;
          const closePf = () => {
            escH == null ? void 0 : escH.unregister();
            escH = null;
            mask.remove();
          };
          escH = escManager.register("bz-vault-pw-platform-edit", {
            isVisible: () => mask.isConnected,
            close: closePf
          });
          mask.addEventListener("click", (e) => {
            if (e.target === mask) closePf();
          });
          (_a = mask.querySelector('[data-pf-act="cancel"]')) == null ? void 0 : _a.addEventListener("click", () => closePf());
          (_b = mask.querySelector('[data-pf-act="save"]')) == null ? void 0 : _b.addEventListener("click", async () => {
            const name = mask.querySelector('[data-pf="platform"]').value.trim();
            if (!name) {
              errEl.textContent = "平台名不能为空";
              return;
            }
            const url = mask.querySelector('[data-pf="url"]').value;
            try {
              await this.pwDataManager.updatePlatform(platform, { platform: name, url });
              this.pwState.selPlatform = name;
              this.pwState.selAccount = null;
              closePf();
              this.renderAll();
              this.toast("平台信息已更新");
            } catch (e) {
              errEl.textContent = "保存失败：" + e.message;
            }
          });
          document.body.appendChild(mask);
        }
        /** 流程确认框（取消 / 确认 cta）：密码资产与笔记/日记动作共用 */
        askConfirm(title, message, okLabel, onYes) {
          void openFlowDialog({
            title,
            message,
            actions: [
              { label: "取消", value: "cancel" },
              { label: okLabel, value: "ok", cta: true }
            ]
          }).then((v) => {
            if (v === "ok") onYes();
          });
        }
        /** 敏感文本复制 + 60s 自动清空（密码资产与日记共用） */
        async copySensitive(text) {
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
        openExternal(url) {
          try {
            const w = window;
            const electron = w.require && w.require("electron");
            if (electron && electron.shell) {
              electron.shell.openExternal(url);
              return;
            }
          } catch (e) {
          }
          window.open(url, "_blank");
        }
        generatePassword() {
          const length = parseInt(this.config.pwLength || "") || 16;
          const charset = this.config.pwCharset || DEFAULT_PW_CHARSET;
          return secureRandomPassword(length, charset);
        }
        genAndToast() {
          if (!this.dataManager.unlocked) {
            notice("请先解锁保险库");
            return;
          }
          void this.copySensitive(this.generatePassword()).then((ok) => {
            if (ok) this.toast("新密码已生成并复制（60 秒后自动清空），可「新增密码」粘贴使用");
            else this.toast("生成失败，请重试", true);
          });
        }
        setAssetFromNav(a) {
          this.asset = a;
          lastVisitedAsset = a;
          this.desk.nav.querySelectorAll(".bz-vault-item").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-asset") === a)
          );
          this.mob.seg.querySelectorAll(".sg").forEach(
            (el) => el.classList.toggle("on", el.getAttribute("data-masset") === a)
          );
          this.renderAll();
        }
        /**
         * 快速取密落点（解锁成功后调用）：直接切到密码资产并聚焦搜索框——
         * 打开面板就是为了取密/管密，不再停留在概览多点一步。
         */
        enterPwQuickAccess() {
          if (!this._initialized) return;
          this.setAssetFromNav("pw");
          this.desk.search.value = "";
          try {
            this.desk.search.focus({ preventScroll: true });
          } catch (e) {
            this.desk.search.focus();
          }
        }
        /** 直落上次停留资产（已解锁直接打开面板时；无记忆回落密码资产） */
        restoreLastAsset() {
          if (!this._initialized) return;
          this.setAssetFromNav(lastVisitedAsset);
        }
        /** 立即上锁（锁屏接管） */
        lockNow() {
          this.dataManager.lock();
          this.pwDataManager.lock();
          this.pwState = { ...DEFAULT_PW_STATE };
          this._selNoteId = null;
          this._diaryPlain = {};
          this._pwEditingId = null;
          this.asset = "overview";
          this.lastHealth = null;
          this.unlockedAt = null;
          this.stopSessionTimers();
          this.notifyUnlockUi();
          if (this.isSecurityMode()) {
            this.hide();
          }
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
            body.appendChild(area);
            return;
          }
          if (this.asset === "pw") {
            const card = document.createElement("div");
            card.className = "bz-vault-mob-pwlist";
            this.pwView.renderMobList(card, this.pwState, (p) => this.openPwMobPage(p));
            body.appendChild(card);
            return;
          }
          const kind = this.asset;
          const notes = [...this.dataManager.manifest.notes].filter((n) => kind === "diary" ? n.kind === "diary-entry" : n.kind !== "diary-entry" && n.kind !== "password-vault").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          const kw = this.pwState.searchKw;
          const filtered = kw ? notes.filter((n) => (n.title || "").toLowerCase().includes(kw.toLowerCase()) || (n.path || "").toLowerCase().includes(kw.toLowerCase())) : notes;
          if (!filtered.length) {
            body.replaceChildren(
              uiEmpty(
                kind === "diary" ? { title: "还没有加密日记", desc: "日记面板把条目改分类为「加密」后移入这里" } : { title: "还没有加密笔记", desc: "用「加密当前笔记」把整篇笔记移入保险库" }
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
          return { page, body: page.querySelector(".body") };
        }
        openNoteMobPage(note, kind) {
          var _a, _b;
          const { page, body } = this.createMobPage(kind === "note" ? "加密笔记" : "加密日记");
          body.innerHTML = noteDetailHTML(note, kind);
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
          if (kind === "diary") {
            void this.dataManager.decryptNoteBody(note).then((t) => {
              const pre = body.querySelector(".note.pre");
              if (pre && t !== null) pre.innerHTML = escapeHtml(t).replace(/\n/g, "<br>");
            }).catch(() => {
            });
          }
        }
        openPwMobPage(p) {
          var _a, _b;
          const { page } = this.createMobPage(escapeHtml(p.platform));
          this.pwView.renderMobPlatformPage(page.querySelector(".body"), p, this.pwState);
          (_a = page.querySelector("[data-mob-back]")) == null ? void 0 : _a.addEventListener("click", () => page.remove());
          (_b = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b.addEventListener("click", () => this.pwView.openPlatformSheet(p.platform));
          this.mob.body.appendChild(page);
        }
        openPwAccountPage(d, st) {
          var _a, _b;
          const { page, body } = this.createMobPage(escapeHtml(d.platform));
          this.pwView.renderDeskDetail(body, { ...st, selPlatform: d.platform, selAccount: d.id });
          (_a = page.querySelector("[data-mob-back]")) == null ? void 0 : _a.addEventListener("click", () => page.remove());
          (_b = page.querySelector("[data-mob-menu]")) == null ? void 0 : _b.addEventListener("click", () => this.pwView.openAccountSheet(d));
          this.mob.body.appendChild(page);
        }
        /** 轻量 toast（保险库窗口内） */
        toast(msg, isErr = false) {
          notice(msg, isErr ? "error" : void 0);
        }
        // ---------- 加密笔记/日记销毁/还原 ----------
        confirmDeleteNote(note) {
          this.askConfirm(
            "删除加密笔记",
            `将永久删除「${note.title}」的正文与全部附件密文，不可恢复。确定删除？`,
            "永久删除",
            () => {
              void this.dataManager.removeNote(note.id).then(() => {
                if (this._selNoteId === note.id) this._selNoteId = null;
                this.renderList();
                this.toast(`已删除加密笔记「${note.title}」`);
              }).catch((e) => this.toast("删除失败：" + e.message, true));
            }
          );
        }
        /** 日记还原回日记（复用 diary reclassifyEntry 语义：还原块 merge 回原日期 md） */
        confirmRestoreDiary(note) {
          this.askConfirm(
            "还原回日记",
            `将「${note.title}」的正文与附件还原到 ${note.path} 的时间序位置？`,
            "还原",
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
            const ok = await this.dataManager.restoreDiaryEntry(note.id, plain);
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
            this.toast("还原失败：" + e.message, true);
          }
        }
        copyDiaryText(note) {
          void this.dataManager.decryptNoteBody(note).then((t) => {
            if (t === null) {
              this.toast("正文解密失败", true);
              return;
            }
            void this.copySensitive(t).then((ok) => this.toast(ok ? "正文已复制（60 秒后自动清空）" : "复制失败", !ok));
          }).catch(() => this.toast("正文解密失败", true));
        }
        confirmDestroyDiary(note) {
          this.askConfirm(
            "彻底销毁日记",
            `将永久销毁「${note.title}」的密文（含附件）。此操作不可撤销，确定继续吗？`,
            "永久销毁",
            () => {
              void this.dataManager.removeNote(note.id).then(() => {
                delete this._diaryPlain[note.id];
                if (this._selNoteId === note.id) this._selNoteId = null;
                this.renderList();
                this.toast(`已销毁「${note.title}」`);
              }).catch((e) => this.toast("销毁失败：" + e.message, true));
            }
          );
        }
        confirmRestore(note) {
          this.askConfirm(
            "还原",
            `将「${note.title}」的原文${note.attachments.length ? "与 " + note.attachments.length + " 个原质量附件" : ""}还原到原路径？`,
            "还原",
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
          if (!this.dataManager.unlocked || !this.dataManager.password) return;
          this.revokePreviewUrls();
          const popup = this.previewPopup;
          const mask = this.previewMask;
          popup.innerHTML = "";
          const header = document.createElement("div");
          header.className = "bz-encrypt-preview-head";
          const title = document.createElement("h4");
          title.textContent = note.title;
          const closeBtn = document.createElement("button");
          closeBtn.innerHTML = vIc("x", 14);
          closeBtn.className = "bz-encrypt-btn bz-win-close";
          closeBtn.title = "关闭";
          closeBtn.setAttribute("aria-label", "关闭");
          closeBtn.onclick = () => this.closePreview();
          header.appendChild(title);
          header.appendChild(closeBtn);
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
            const { text, slots, inlined } = collectMediaSlots(plain != null ? plain : "", note.attachments);
            const mdEl = document.createElement("div");
            mdEl.className = "bz-encrypt-preview-md";
            const rendered = await this.renderWithTimeout(getApp(), text, mdEl, note.path);
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
            body.innerHTML = "";
            body.appendChild(mdEl);
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
        /** 渲染带超时：3000ms 内不完成视为失败（防真实环境 render 挂起导致弹窗永久空白/不可关） */
        async renderWithTimeout(app, text, el, path, timeoutMs = 3e3) {
          let finished = false;
          const render = MarkdownRenderer.render(app, text, el, path, new Component()).then(
            () => {
              finished = true;
            },
            () => {
              finished = true;
            }
          );
          await Promise.race([render, new Promise((r) => setTimeout(r, timeoutMs))]);
          return finished;
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
              im.alt = escapeHtml(a.path || "");
              im.src = url;
              missing.replaceWith(im);
            }
            slot.dataset.loaded = "1";
            slot.classList.add("bz-encrypt-preview-slot--loaded");
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
          if (this.previewMask) unregisterSheetCompanion(this.previewMask);
          if (this.previewMask) this.previewMask.style.display = "none";
          if (this.previewPopup) this.previewPopup.style.display = "none";
        }
        // ---------- 设置弹窗 ----------
        openSettings() {
          openSettingsModal({ title: "保险库设置", maxWidth: 560, schema: encryptSettingsSchema() });
        }
        registerEscape() {
          escManager.register("encrypt", {
            isVisible: () => !!(this.mask && this.mask.style.display === "block") || !!(this.previewMask && this.previewMask.style.display === "block"),
            close: () => {
              if (this.previewMask && this.previewMask.style.display === "block") this.closePreview();
              else if (this.mask && this.mask.style.display === "block") this.hide();
            }
          });
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
            if (this.statusBarEl) this.statusBarEl.innerHTML = statusbarHtml(unlocked);
            (_b = (_a = this.uiManager).notifyUnlockUi) == null ? void 0 : _b.call(_a);
          };
          this.dataManager.onUnlockChange(this.dataManager.unlocked);
        }
        async init() {
          if (this._initialized) return;
          this.uiManager.ensureElements();
          this._initialized = true;
        }
        /** 打开保险库主面板：解锁成功直落密码资产并聚焦搜索（快速取密路径）；
         *  已解锁直接打开则恢复上次停留资产（会话级记忆）。 */
        async openManager() {
          if (!this.dataManager.unlocked) {
            const ok = await this.uiManager.showPasswordDialog();
            if (ok) {
              this.uiManager.show();
              this.uiManager.enterPwQuickAccess();
            }
          } else {
            this.uiManager.show();
            this.uiManager.restoreLastAsset();
          }
        }
        /**
         * 快速复制密码（命令 bz-encrypt-copy-password；不打开主面板）：
         * 未解锁先弹主密码 → 轻量 fuzzy 选择器选条目 → 复制到剪贴板（60s 自动清空）。
         */
        async quickCopyPassword() {
          if (!this.dataManager.unlocked) {
            const ok = await this.uiManager.showPasswordDialog();
            if (!ok) return;
          }
          try {
            await this.uiManager.pwDataManager.load();
          } catch (e) {
          }
          const entries = this.uiManager.pwDataManager.pwData;
          if (!entries.length) {
            notice("保险库还没有密码，打开面板后可新增");
            return;
          }
          void openPasswordQuickPicker(entries, (d) => {
            void this.uiManager.copySensitive(d.password).then((ok) => {
              notice(
                ok ? `已复制「${d.platform}」${d.account ? `（${d.account}）` : ""}的密码，60 秒后自动清空` : "复制失败，请手动复制",
                ok ? "success" : "error"
              );
            });
          });
        }
        /** 二次确认：正文与附件将移入保险库（原路径消失），点确认才开始 */
        async confirmLockProceed(file, attCount) {
          return await openFlowDialog({
            title: "加密到保险库",
            message: `把「${file.basename}」的正文${attCount ? "与 " + attCount + " 个附件" : ""}加密移入保险库？加密后原笔记与附件将从原路径移出（保险库内为密文）。`,
            actions: [
              { label: "取消", value: "cancel" },
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
            if (!await this.confirmLockProceed(file, attPaths.length)) return;
            const attachments = await this.readAttachmentInputs(app, attPaths);
            if (!attachments) return;
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
                }
              );
              finishProgress(h, attachments.length + 1, "加密完成");
              this.uiManager.show();
            } catch (e) {
              if (h) h.hide();
              notifyActionError(e, "加密");
            }
          } finally {
            this._locking = false;
          }
        }
        /** 卸载清理 */
        cleanup() {
          const ids = ["bz-encrypt-mask", "bz-encrypt-popup", "bz-encrypt-preview-mask", "bz-encrypt-preview-popup", "bz-encrypt-health-mask", "bz-encrypt-health-popup"];
          for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.remove();
          }
          this.uiManager.closeAllDialogs();
          cancelClipboardClear();
          this.uiManager.stopSessionTimers();
          this.uiManager.pwView.disposeRevealTimers();
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
        }
      };
      _EncryptAppController.instance = null;
      EncryptAppController = _EncryptAppController;
    }
  });

  // src/encrypt/index.ts
  var encrypt_exports = {};
  __export(encrypt_exports, {
    copyVaultPassword: () => copyVaultPassword,
    encryptCurrentNote: () => encryptCurrentNote,
    ensureEncrypt: () => ensureEncrypt,
    ensureSafeUnlocked: () => ensureSafeUnlocked,
    getSafeManager: () => getSafeManager,
    mountEncryptStatusBar: () => mountEncryptStatusBar,
    openEncrypt: () => openEncrypt,
    unloadEncrypt: () => unloadEncrypt,
    unmountEncryptStatusBar: () => unmountEncryptStatusBar
  });
  function getController() {
    if (!controller) {
      const s = getSettings();
      const config = {
        root: (s.encryptRoot || "CONFIG/.ENCRYPT").replace(/\/+$/, ""),
        previewEnabled: s.encryptPreviewEnabled !== false,
        previewSize: parseInt(s.encryptPreviewSize) || 384,
        previewQuality: parseFloat(s.encryptPreviewQuality) || 0.5,
        autoLoadOriginal: !!s.encryptAutoLoadOriginal,
        securityMode: !!s.encryptSecurityMode,
        // ADR-0085：密码资产并入保险库；生成器沿用全局键（旧密码本同源）
        pwCharset: s.passwordCharset || DEFAULT_PW_CHARSET,
        pwLength: String(parseInt(s.passwordLength) || 16)
      };
      controller = EncryptAppController.getInstance(config);
    }
    return controller;
  }
  async function ensureEncrypt(app) {
    if (initialized) return;
    initialized = true;
    await getController().init();
  }
  function statusbarHtml2(unlocked) {
    return `${vIc(unlocked ? "lock-open" : "lock", 12)} 保险库`;
  }
  function mountEncryptStatusBar(container) {
    if (statusBarEl) return;
    const el = document.createElement("span");
    el.className = "bz-encrypt-statusbar";
    el.title = "保险库：点击打开";
    el.innerHTML = statusbarHtml2(false);
    el.addEventListener("click", () => openEncrypt(getApp()));
    container.appendChild(el);
    statusBarEl = el;
    void ensureEncrypt(getApp()).then(() => getController().attachStatusBar(el));
  }
  function unmountEncryptStatusBar() {
    if (statusBarEl) {
      statusBarEl.remove();
      statusBarEl = null;
    }
  }
  function openEncrypt(app) {
    void ensureEncrypt(app).then(() => getController().openManager());
  }
  function encryptCurrentNote(app) {
    void ensureEncrypt(app).then(() => getController().lockCurrentNote());
  }
  function copyVaultPassword(app) {
    void ensureEncrypt(app).then(() => getController().quickCopyPassword());
  }
  function getSafeManager() {
    return getController().dataManager;
  }
  async function ensureSafeUnlocked() {
    const controller3 = getController();
    if (controller3.dataManager.unlocked) return true;
    const ok = await controller3.uiManager.showPasswordDialog();
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
      init_app();
      init_ui2();
      init_vault_assets_view();
      initialized = false;
      controller = null;
      statusBarEl = null;
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

  // src/cinema/state.ts
  init_settings_provider();
  var DEFAULT_FOLDER = "我的/影视";
  function resolveCinemaFolderPath() {
    try {
      const s = tryGetSettings();
      return typeof s.cinemaFolderPath === "string" && s.cinemaFolderPath.trim() ? s.cinemaFolderPath : DEFAULT_FOLDER;
    } catch (e) {
      return DEFAULT_FOLDER;
    }
  }

  // src/bookshelf/data.ts
  init_fake_obsidian();
  init_settings_provider();
  init_utils();

  // src/bookshelf/state.ts
  init_settings_provider();

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml2(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml2(String(s != null ? s : ""));
  }

  // src/bookshelf/constants.ts
  var STATUS_UNREAD = "未读";
  var STATUS_READING = "在读";
  var STATUS_DONE = "已读";
  var STATUS_COLORS = {
    [STATUS_UNREAD]: "var(--bz-text-3)",
    [STATUS_READING]: "var(--bz-brand)",
    [STATUS_DONE]: "var(--bz-success)"
  };

  // src/bookshelf/data.ts
  function resolveFolderPath() {
    const s = tryGetSettings();
    const v = typeof s.bookshelfFolderPath === "string" && s.bookshelfFolderPath.trim() ? s.bookshelfFolderPath : typeof s.libraryFolderPath === "string" && s.libraryFolderPath.trim() ? s.libraryFolderPath : "书库";
    return v.replace(/^\/+|\/+$/g, "");
  }

  // src/diary/config.ts
  var DIARY_DIRECTORY = "我的/日记";
  var MOVIE_DIRECTORY = "我的/影视";
  var LETTER_DIRECTORY = "我的/信";
  var BOOK_DIRECTORY = "书库";
  function safeResolve(resolver, fallback) {
    try {
      const v = resolver();
      return v && v.trim() ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function applyDirectories(settings) {
    DIARY_DIRECTORY = settings.diaryDirectory || "我的/日记";
    LETTER_DIRECTORY = settings.letterDirectory || "我的/信";
    MOVIE_DIRECTORY = safeResolve(resolveCinemaFolderPath, "我的/影视");
    BOOK_DIRECTORY = safeResolve(resolveFolderPath, "书库");
  }
  var ENCRYPT_TAG = "加密";
  function getPrimaryTagsInDisplayOrder() {
    const tags = Object.keys(PRIMARY_TAGS_CONFIG);
    const idx = tags.indexOf(ENCRYPT_TAG);
    if (idx === -1) return tags;
    const rest = tags.filter((t) => t !== ENCRYPT_TAG);
    rest.push(ENCRYPT_TAG);
    return rest;
  }
  var DEFAULT_TAGS_CONFIG = {
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
  var PRIMARY_TAGS_CONFIG = JSON.parse(JSON.stringify(DEFAULT_TAGS_CONFIG));
  var tagToEmojiMap = {};
  var emojiToTagMap = {};
  buildTagMaps();
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

  // src/diary/ui.ts
  init_fake_obsidian();
  init_esc_manager();
  init_dom();
  init_ui();
  init_item_actions();
  init_utils();
  init_domain_bus();
  init_notice();
  init_app();

  // src/diary/parser.ts
  init_fake_obsidian();
  var HEADING_REGEX = /^#\s*((?:\S+)+)\s+(\d{2}:\d{2})/u;
  function parseFile(content, dateStr, onUnparsed) {
    const entries = [];
    const lines = content.split("\n");
    let currentEntry = null;
    let contentLines = [];
    let unparsedLines = 0;
    const headingRegex = HEADING_REGEX;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(headingRegex);
      if (headingMatch) {
        if (currentEntry) {
          currentEntry.content = contentLines.join("\n").trim();
          entries.push(currentEntry);
          contentLines = [];
        }
        const emojiSequence = headingMatch[1];
        const time = headingMatch[2];
        const [hours, minutes] = time.split(":").map(Number);
        if (isNaN(hours) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          unparsedLines++;
          continue;
        }
        const timeValue = hours * 100 + minutes;
        const segmenter = new Intl.Segmenter(void 0, { granularity: "grapheme" });
        const segments = segmenter.segment(emojiSequence);
        const tags = [];
        for (const seg of segments) {
          const ch = seg.segment;
          const mappedTag = emojiToTagMap[ch];
          if (mappedTag) {
            tags.push(mappedTag);
          }
        }
        if (tags.length === 0) {
          tags.push("日记");
        }
        currentEntry = {
          date: dateStr,
          time,
          timeValue,
          tags,
          emoji: emojiSequence,
          content: "",
          filename: dateStr,
          lineNumber: i + 1
        };
      } else if (currentEntry) {
        if (line.trim() === "" && i + 1 < lines.length && lines[i + 1].match(/^#\s/)) {
          currentEntry.content = contentLines.join("\n").trim();
          entries.push(currentEntry);
          currentEntry = null;
          contentLines = [];
        } else {
          contentLines.push(line);
        }
      } else if (line.trim() !== "") {
        unparsedLines++;
      }
    }
    if (currentEntry) {
      currentEntry.content = contentLines.join("\n").trim();
      entries.push(currentEntry);
    }
    if (onUnparsed && unparsedLines > 0) onUnparsed(unparsedLines);
    for (const entry of entries) {
      if (entry.type !== void 0) {
        entry.tags = [entry.type];
        delete entry.type;
      }
      if (!entry.tags || entry.tags.length === 0) {
        entry.tags = ["日记"];
      }
      entry.emoji = entry.tags.map((tag) => getTagEmoji(tag)).join("");
    }
    return entries;
  }
  function getFileFrontmatter(file, app) {
    const cache = app.metadataCache.getFileCache(file);
    return cache && cache.frontmatter ? cache.frontmatter : null;
  }
  async function getFileTimeParts(file) {
    const stat = await file.stat;
    const createTime = stat.ctime || stat.birthtime;
    const m = (0, import_moment.default)(createTime);
    return { timeStr: m.format("HH:mm"), timeValue: parseInt(m.format("HHmm")) };
  }
  function makeEntryId(prefix, file, dateStr) {
    return `${prefix}-${file.path.replace(/\//g, "-")}-${dateStr}`;
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
      const { timeStr, timeValue } = await getFileTimeParts(file);
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
      const content = `${review.trim()}

![[${poster}]]

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
        id: makeEntryId("movie", file, dateStr)
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
      const { timeStr, timeValue } = await getFileTimeParts(file);
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
      const { timeStr, timeValue } = await getFileTimeParts(file);
      return {
        date: dateStr,
        time: timeStr,
        timeValue,
        tags: ["书"],
        emoji: getTagEmoji("书"),
        content,
        filename: file.path,
        lineNumber: 0,
        id: makeEntryId("book", file, dateStr)
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
  var DIARY_FILE_RE = /^(\d{4}-\d{2}-\d{2})\.md$/;
  function isValidDateStr(s) {
    const [y, mo, d] = s.split("-").map(Number);
    const dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
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
      // （日记 filename=dateStr；影视/信/书 filename=完整 vault 路径）
      filename: e.filename,
      lineNumber: e.lineNumber,
      id: e.id,
      // 加密日记条目的保险箱 SafeNote id（encrypted=true 时存在；UI 解密时用，非加密条目为 undefined）
      noteId: e.noteId,
      kind,
      media: extractMedia(e.content, dir),
      // 渲染用正文：去媒体嵌入，保留 markdown 语法（content 保留原文供复制/跳转）
      text: stripMediaLinks(e.content),
      // 按原文顺序的内容段（issue 213：UI 段序渲染，文字不重复、媒体归位）
      segments: extractSegments(e.content)
    };
  }
  async function loadDiaryEntries(app, diaryDir) {
    const vault = app.vault;
    const mdFiles = await mdFilesUnder(app, diaryDir);
    const entries = [];
    for (let i = 0; i < mdFiles.length; i += READ_BATCH_SIZE) {
      const batch = mdFiles.slice(i, i + READ_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const m = DIARY_FILE_RE.exec(file.name);
          if (!m || !isValidDateStr(m[1])) return [];
          const dateStr = m[1];
          const content = await vault.read(file);
          return parseFile(content, dateStr).map((e) => toWallEntry(e, "diary", diaryDir));
        })
      );
      for (const r of batchResults) entries.push(...r);
    }
    return entries;
  }
  async function loadSpecialEntries(app, dir, kind, parse) {
    const mdFiles = await mdFilesUnder(app, dir);
    const entries = [];
    for (let i = 0; i < mdFiles.length; i += READ_BATCH_SIZE) {
      const batch = mdFiles.slice(i, i + READ_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          const e = await parse(file, app);
          return e ? [toWallEntry(e, kind, dir)] : [];
        })
      );
      for (const r of batchResults) entries.push(...r);
    }
    return entries;
  }
  async function loadWallEntries(app) {
    const entries = await loadDiaryEntries(app, DIARY_DIRECTORY);
    entries.push(...await loadSpecialEntries(app, MOVIE_DIRECTORY, "movie", parseMovieFile));
    entries.push(...await loadSpecialEntries(app, LETTER_DIRECTORY, "letter", parseLetterFile));
    entries.push(...await loadSpecialEntries(app, BOOK_DIRECTORY, "book", parseBookFile));
    entries.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
    });
    return entries;
  }
  function groupByMonth(entries) {
    const map = /* @__PURE__ */ new Map();
    for (const e of entries) {
      const key = e.date.slice(0, 7);
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
      }
      list.push(e);
    }
    return map;
  }
  function pickOnThisDay(entries, today) {
    const mmdd = (today || "").slice(5);
    const thisYear = (today || "").slice(0, 4);
    if (!mmdd || mmdd.length !== 5) return [];
    return entries.filter((e) => e.date.slice(5) === mmdd && e.date.slice(0, 4) !== thisYear);
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

  // src/diary/thumb-cache.ts
  var DB_NAME = "bz-diary-thumbs-v2";
  var LEGACY_DB_NAME = "bz-diary-thumbs";
  var STORE = "thumbs";
  var THUMB_SIZE = 48;
  var FLAT_TOLERANCE = 12;
  var VIDEO_TIMEOUT = 8e3;
  var SEEK_TIMEOUT = 3e3;
  var SEEK_MAX = 0.5;
  var BLOB_MAX_BYTES = 48 * 1024 * 1024;
  var directBlocked = false;
  var legacyCleaned = false;
  var NO_DRAW = { url: null, tainted: false };
  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("no idb"));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        cleanLegacyDb();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  function cleanLegacyDb() {
    if (legacyCleaned) return;
    legacyCleaned = true;
    try {
      indexedDB.deleteDatabase(LEGACY_DB_NAME);
    } catch (e) {
    }
  }
  function railThumbKey(entryDate, mediaName) {
    return `${entryDate}|${mediaName}`;
  }
  async function getRailThumb(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return null;
    }
  }
  async function putRailThumb(key, dataUrl) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(dataUrl, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
    }
  }
  function isFlatFrameData(data, tolerance = FLAT_TOLERANCE) {
    let rMin = 255;
    let rMax = 0;
    let gMin = 255;
    let gMax = 0;
    let bMin = 255;
    let bMax = 0;
    for (let i = 0; i + 2 < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < rMin) rMin = r;
      if (r > rMax) rMax = r;
      if (g < gMin) gMin = g;
      if (g > gMax) gMax = g;
      if (b < bMin) bMin = b;
      if (b > bMax) bMax = b;
      if (rMax - rMin > tolerance || gMax - gMin > tolerance || bMax - bMin > tolerance) return false;
    }
    return true;
  }
  function isFlatFrame(ctx, size) {
    return isFlatFrameData(ctx.getImageData(0, 0, size, size).data);
  }
  function drawCover(source, w, h, size = THUMB_SIZE) {
    try {
      if (typeof document === "undefined" || !w || !h) return NO_DRAW;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return NO_DRAW;
      const side = Math.min(w, h);
      ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
      if (isFlatFrame(ctx, size)) return NO_DRAW;
      return { url: canvas.toDataURL("image/webp", 0.8) || null, tainted: false };
    } catch (e) {
      const name = e && typeof e === "object" ? e.name : "";
      return { url: null, tainted: name === "SecurityError" };
    }
  }
  async function makeImageThumb(src) {
    try {
      const blob = await (await fetch(src)).blob();
      const bmp = await createImageBitmap(blob);
      const { url } = drawCover(bmp, bmp.width, bmp.height);
      bmp.close();
      return url;
    } catch (e) {
      return null;
    }
  }
  function waitMediaEvent(el, event, ms) {
    return new Promise((resolve) => {
      let timer;
      const done = (ok) => {
        clearTimeout(timer);
        el.removeEventListener(event, onHit);
        el.removeEventListener("error", onErr);
        resolve(ok);
      };
      const onHit = () => done(true);
      const onErr = () => done(false);
      timer = setTimeout(() => done(false), ms);
      el.addEventListener(event, onHit, { once: true });
      el.addEventListener("error", onErr, { once: true });
    });
  }
  function seekPlan(duration) {
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const plan = [Math.min(SEEK_MAX, duration * 0.1), duration * 0.25, duration * 0.5];
    return [...new Set(plan)].filter((t) => t > 0.05 && t < duration - 0.05);
  }
  async function frameFromUrl(src) {
    if (typeof document === "undefined") return NO_DRAW;
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = src;
    try {
      if (!await waitMediaEvent(v, "canplay", VIDEO_TIMEOUT)) return NO_DRAW;
      const plan = seekPlan(v.duration);
      if (!plan.length) return drawCover(v, v.videoWidth, v.videoHeight);
      for (const t of plan) {
        v.currentTime = t;
        await waitMediaEvent(v, "seeked", SEEK_TIMEOUT);
        const r = drawCover(v, v.videoWidth, v.videoHeight);
        if (r.url || r.tainted) return r;
      }
      return NO_DRAW;
    } catch (e) {
      return NO_DRAW;
    } finally {
      v.removeAttribute("src");
      try {
        v.load();
      } catch (e) {
      }
    }
  }
  async function frameFromBlob(src) {
    var _a, _b;
    let objectUrl = null;
    try {
      const res = await fetch(src);
      const declared = Number(((_b = (_a = res.headers) == null ? void 0 : _a.get) == null ? void 0 : _b.call(_a, "content-length")) || 0);
      if (declared > BLOB_MAX_BYTES) return NO_DRAW;
      const blob = await res.blob();
      if (blob.size > BLOB_MAX_BYTES) return NO_DRAW;
      objectUrl = URL.createObjectURL(blob);
      return await frameFromUrl(objectUrl);
    } catch (e) {
      return NO_DRAW;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }
  async function makeVideoThumb(src) {
    if (!directBlocked) {
      const r = await frameFromUrl(src);
      if (r.url) return r.url;
      if (!r.tainted) return null;
      directBlocked = true;
    }
    return (await frameFromBlob(src)).url;
  }

  // src/diary/render.ts
  var ACT_ICON = {
    add: "pen-line",
    search: "search",
    "lb-close": "x",
    "lb-prev": "chevron-left",
    "lb-next": "chevron-right"
  };
  var KIND_ICON = {
    img: "image",
    video: "video-off",
    audio: "music"
  };
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
  function wallPanelHTML() {
    return `
      <div class="bz-diary-head bz-win-head">
        <div class="bz-diary-brand" data-act="date-picker" title="按日期筛选">
          <span class="bz-diary-bookname">日记本</span>
          <span class="bz-diary-range"></span>
        </div>
        <div class="bz-diary-btns">
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="add" title="写日记"></button>
          <button class="bz-diary-icon-btn bz-touch-target--xl" data-act="search" title="搜索"></button>
        </div>
      </div>
      <div class="bz-diary-chiprow"></div>
      <div class="bz-diary-subrow" style="display:none"></div>
      <div class="bz-diary-searchrow" style="display:none"></div>
      <div class="bz-diary-body">
        <div class="bz-rail bz-diary-rail"></div>
        <div class="bz-diary-wall"></div>
      </div>
      <div class="bz-diary-lb">
        <button class="bz-diary-lbnav bz-diary-lbnav--prev" data-act="lb-prev" title="上一个（←）"></button>
        <button class="bz-diary-lbclose" data-act="lb-close" title="关闭"></button>
        <button class="bz-diary-lbnav bz-diary-lbnav--next" data-act="lb-next" title="下一个（→）"></button>
        <div class="bz-diary-lbmedia"></div>
        <div class="bz-diary-lbcap"></div>
        <div class="bz-diary-lbsub"></div>
      </div>
      <div class="bz-sheet-mask bz-diary-sheet-mask"></div>
      <div class="bz-sheet bz-diary-sheet">
        <div class="bz-sheet-grip"></div>
        <div class="bz-sheet-head bz-diary-sheet-head">
          <span class="bz-diary-sheet-emoji"></span>
          <div class="bz-diary-sheet-info">
            <div class="bz-sheet-title bz-diary-sheet-time"></div>
            <div class="bz-diary-sheet-content"></div>
            <div class="bz-diary-sheet-media"></div>
          </div>
        </div>
        <div class="bz-sheet-body bz-sheet-actions bz-diary-sheet-actions"></div>
      </div>
    `;
  }
  function dayStats(list) {
    let imgs = 0;
    let vids = 0;
    let auds = 0;
    let texts = 0;
    list.forEach((e) => {
      e.media.forEach((k) => {
        if (k.kind === "video") vids++;
        else if (k.kind === "audio") auds++;
        else imgs++;
      });
      if (e.content) texts++;
    });
    return { imgs, vids, auds, texts };
  }
  function statHtml(s) {
    const parts = [];
    if (s.imgs) parts.push(`<b>${s.imgs}</b> 图`);
    if (s.vids) parts.push(`<b>${s.vids}</b> 视频`);
    if (s.auds) parts.push(`<b>${s.auds}</b> 音频`);
    if (s.texts) parts.push(`<b>${s.texts}</b> 条文字`);
    return parts.join(" · ") || "空";
  }
  var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  function lbCaption(entry) {
    return `${entry.date} ${entry.time}` + (entry.tags.length ? ` · ${entry.tags.join(" ")}` : "");
  }
  function lbSubText(entry) {
    return entry.text || entry.content || "";
  }
  function mediaCapHtml(entry) {
    const tagText = entry.tags.filter((t) => t !== "加密").join(" ");
    return `<span style="opacity:.75">${esc(entry.emoji)} ${esc(entry.time)}</span>${tagText ? `　${esc(tagText)}` : ""}`;
  }

  // src/diary/ui/dialogs.ts
  init_fake_obsidian();
  init_z_order();
  init_notice();
  init_flow_dialog();
  init_app();
  init_settings_provider();

  // src/diary/store.ts
  init_utils();
  init_notice();
  init_domain_bus();
  init_storage();
  init_app();
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
  var UnparsedLineError = class extends Error {
    constructor(dateStr, count) {
      super(`「${dateStr}」有 ${count} 行内容无法解析，已拒绝处理`);
      this.dateStr = dateStr;
      this.count = count;
      this.name = "UnparsedLineError";
    }
  };
  async function syncDateFromDisk(dateStr) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    const file = getApp().vault.getAbstractFileByPath(filePath);
    if (!file) {
      if (diaryDataMap) diaryDataMap.delete(dateStr);
      return { entries: [], exists: false };
    }
    let unparsed = 0;
    let entries = [];
    try {
      const content = await getApp().vault.read(file);
      entries = parseFile(content, dateStr, (n) => unparsed = n);
    } catch (e) {
      return { entries: [], exists: true };
    }
    if (unparsed > 0) {
      warnUnparsed(
        `「${dateStr}」有 ${unparsed} 行内容无法解析，本次修改没有写入文件（直接处理会丢失这些行）。请先在日记本设置中运行「检测日记解析」修复后再试。`,
        `diary-write-refused-${dateStr}`
      );
      throw new UnparsedLineError(dateStr, unparsed);
    }
    if (!diaryDataMap) setDiaryDataMap(/* @__PURE__ */ new Map());
    if (entries.length === 0) diaryDataMap.delete(dateStr);
    else diaryDataMap.set(dateStr, entries);
    return { entries, exists: true };
  }
  function serializeDateFile(entries) {
    entries.sort((a, b) => a.timeValue - b.timeValue);
    let headingCursor = 0;
    const fileLines = entries.map((entry) => {
      const emojiSeq = entry.tags.map((tag) => getTagEmoji(tag)).join("");
      const lines = [`# ${emojiSeq} ${entry.time}`, ""];
      if (entry.content.trim()) lines.push(entry.content.trim());
      lines.push("");
      entry.lineNumber = headingCursor + 1;
      headingCursor += lines.length;
      return lines;
    }).flat().slice(0, -1);
    return fileLines.join("\n");
  }
  async function withDateFile(dateStr, task) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    return enqueueFileTask(filePath, async () => {
      const { entries } = await syncDateFromDisk(dateStr);
      const result = await task(entries);
      const file = getApp().vault.getAbstractFileByPath(filePath);
      if (entries.length === 0) {
        if (file) await getApp().vault.delete(file);
        return result;
      }
      const finalContent = serializeDateFile(entries);
      try {
        if (file) await getApp().vault.modify(file, finalContent);
        else await getApp().vault.create(filePath, finalContent);
      } catch (error) {
        console.error(`重新生成文件 ${dateStr}.md 失败:`, error);
        throw error;
      }
      return result;
    });
  }
  async function listDateEntries(dateStr) {
    const filePath = `${DIARY_DIRECTORY}/${dateStr}.md`;
    return enqueueFileTask(filePath, async () => {
      const { entries } = await syncDateFromDisk(dateStr);
      return entries.map((e) => ({ ...e }));
    });
  }
  async function addEntry(dateStr, timeStr, tagsArray, content) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const timeValue = hours * 100 + minutes;
    const newEntry = {
      date: dateStr,
      time: timeStr,
      timeValue,
      tags: tagsArray,
      emoji: "",
      content: content.trim(),
      filename: dateStr,
      lineNumber: 0
    };
    newEntry.emoji = tagsArray.map((tag) => getTagEmoji(tag)).join("");
    await withDateFile(dateStr, (entries) => {
      let insertIndex = entries.findIndex((e) => e.timeValue > timeValue);
      if (insertIndex === -1) insertIndex = entries.length;
      entries.splice(insertIndex, 0, newEntry);
    });
    const finalEntry = { ...newEntry };
    finalEntry.id = `${dateStr}-${timeStr.replace(/:/g, "-")}-${Date.now()}`;
    emitDomainEvent("diary:entry-added", { date: dateStr, time: timeStr, tags: tagsArray, content: content.trim() });
    return finalEntry;
  }
  async function removeDiaryEntries(dateStr, match) {
    let removed = [];
    let vacated = false;
    await withDateFile(dateStr, (entries) => {
      removed = entries.filter(match);
      if (removed.length === 0) return;
      for (const r of removed) {
        const idx = entries.indexOf(r);
        if (idx !== -1) entries.splice(idx, 1);
      }
      vacated = entries.length === 0;
    });
    if (removed.length === 0) return 0;
    if (vacated) {
      emitDomainEvent("diary:file-vacated", { date: dateStr });
    }
    return removed.length;
  }
  async function updateDiaryTags(dateStr, match, newTags) {
    const res = { oldTags: [], changed: false, entry: null };
    await withDateFile(dateStr, (entries) => {
      var _a;
      const hit = (_a = entries.find(match)) != null ? _a : null;
      if (!hit) return;
      res.entry = hit;
      if (hit.tags.length === newTags.length && hit.tags.every((t) => newTags.includes(t))) {
        return;
      }
      res.oldTags = [...hit.tags];
      hit.tags = newTags;
      hit.emoji = newTags.map((tag) => getTagEmoji(tag)).join("");
      res.changed = true;
    });
    if (!res.entry) return null;
    if (res.changed) {
      emitDomainEvent("diary:tags-changed", {
        date: res.entry.date,
        time: res.entry.time,
        from: res.oldTags,
        to: newTags
      });
    }
    return res.entry;
  }
  async function findDiaryEntry(filename, lineNumber) {
    const dateStr = filename.includes("/") ? stripMdExt(filename.split("/").pop()) : filename;
    const lookup = (map) => {
      var _a;
      const entries = map == null ? void 0 : map.get(dateStr);
      if (!entries) return null;
      return (_a = entries.find((e) => e.filename === filename && e.lineNumber === lineNumber)) != null ? _a : null;
    };
    const hit = lookup(diaryDataMap);
    if (hit) return hit;
    try {
      await listDateEntries(dateStr);
    } catch (e) {
      return null;
    }
    return lookup(diaryDataMap);
  }
  function isUnparsedRefusal(e) {
    return e instanceof UnparsedLineError;
  }

  // src/diary/encrypt.ts
  init_utils();
  init_app();
  init_encrypt();
  init_ui2();
  init_data();
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
    const out = [];
    for (const p of paths) {
      try {
        const f = app.vault.getAbstractFileByPath(p);
        if (!f) continue;
        const buf = await app.vault.readBinary(f);
        out.push({ path: p, kind: kindOf(p), data: bytesToBase64(new Uint8Array(buf)) });
      } catch (e) {
      }
    }
    return out;
  }
  async function encryptEntry(entry) {
    var _a;
    const safe = getSafeManager();
    if (!safe.unlocked) throw new Error("未解锁，无法加密日记");
    const tags = [.../* @__PURE__ */ new Set([...entry.tags, ENCRYPT_TAG])];
    const emojiSeq = tags.map((t) => getTagEmoji(t)).join("");
    const block = `# ${emojiSeq} ${entry.time}
${entry.content.trim()}`;
    const datePath = `${DIARY_DIRECTORY}/${entry.date}.md`;
    const attachments = await collectAttachmentsForContent(entry.content || "", datePath);
    await safe.lockNote(
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
      emoji: emojiSeq,
      encrypted: true,
      noteId: (_a = safe.manifest.notes[safe.manifest.notes.length - 1]) == null ? void 0 : _a.id
    };
  }
  async function loadEncryptedEntries() {
    const safe = getSafeManager();
    if (!safe.unlocked || !safe.manifest) return [];
    const out = [];
    for (const note of safe.manifest.notes) {
      if (note.kind !== "diary-entry") continue;
      try {
        const plain = await safe.getDiaryEntryPlain(note.id);
        if (plain === null || plain === void 0) continue;
        const date = stripMdExt(note.path.split("/").pop() || "");
        const entry = parseDiaryBlock(plain, date, note.id);
        if (entry) out.push(entry);
      } catch (e) {
      }
    }
    return out;
  }
  function parseDiaryBlock(block, date, noteId) {
    var _a;
    const lines = block.replace(/\r\n/g, "\n").split("\n");
    const m = (_a = lines[0]) == null ? void 0 : _a.match(/^#\s+(\S+)\s+(\d{2}:\d{2})$/);
    if (!m) return null;
    const emojiSeq = m[1];
    const time = m[2];
    const [h, min] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    const tags = emojiTagsToLabels(emojiSeq);
    const content = lines.slice(1).join("\n").trim();
    return {
      date,
      time,
      timeValue: h * 100 + min,
      tags,
      emoji: emojiSeq,
      content,
      filename: date,
      lineNumber: 0,
      encrypted: true,
      noteId,
      id: `enc-diary-${noteId}`
    };
  }
  function emojiTagsToLabels(emojiSeq) {
    const tags = [];
    const seg = new Intl.Segmenter(void 0, { granularity: "grapheme" });
    for (const s of seg.segment(emojiSeq)) {
      const label = emojiToTagMap[s.segment];
      if (label && !tags.includes(label)) tags.push(label);
    }
    if (tags.length === 0) tags.push("日记");
    return tags;
  }
  async function deleteEncryptedEntry(noteId) {
    const safe = getSafeManager();
    if (!safe.unlocked) throw new Error("未解锁");
    await safe.removeNote(noteId);
  }
  async function buildRestoreBlock(noteId, newTags) {
    var _a;
    const plain = await getSafeManager().getDiaryEntryPlain(noteId);
    if (plain === null || plain === void 0) return null;
    if (!newTags || newTags.length === 0) return plain;
    const lines = plain.replace(/\r\n/g, "\n").split("\n");
    const m = (_a = lines[0]) == null ? void 0 : _a.match(/^#\s+\S+\s+(\d{2}:\d{2})$/);
    if (!m) return null;
    const newSeq = newTags.filter((t) => t !== ENCRYPT_TAG).map((t) => getTagEmoji(t)).join("");
    return `# ${newSeq} ${m[1]}${lines.length > 1 ? "\n" + lines.slice(1).join("\n") : ""}`;
  }
  async function reclassifyEntry(noteId, newTags) {
    const block = await buildRestoreBlock(noteId, newTags);
    if (block === null) return false;
    return getSafeManager().restoreDiaryEntry(noteId, block);
  }

  // src/diary/ui/dialogs.ts
  init_domain_bus();

  // src/diary/ui/datetime-picker.ts
  init_fake_obsidian();
  init_notice();
  init_esc_manager();
  init_z_order();
  var yearRangeProvider = null;
  function setDateTimeYearRangeProvider(p) {
    yearRangeProvider = p;
  }
  function createWheelColumn(field, colIndex, picker) {
    const column = document.createElement("div");
    column.style.cssText = `
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  `;
    const label = document.createElement("div");
    label.textContent = field.name;
    label.style.cssText = `
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
    padding: 8px 4px;
    font-weight: 500;
    border-bottom: 1px solid var(--background-modifier-border);
    flex-shrink: 0;
  `;
    column.appendChild(label);
    const wheelScrollContainer = document.createElement("div");
    wheelScrollContainer.className = "diary-datetime-scroll-container";
    wheelScrollContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    scrollbar-width: none;
    -ms-overflow-style: none;
  `;
    column.appendChild(wheelScrollContainer);
    const numbersContainer = document.createElement("div");
    numbersContainer.className = "datetime-numbers-container";
    numbersContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 120px 0;
  `;
    wheelScrollContainer.appendChild(numbersContainer);
    const items = [];
    let min = typeof field.min === "function" ? field.min() : field.min;
    let max = typeof field.max === "function" ? field.max() : field.max;
    for (let i = min; i <= max; i++) {
      const item = document.createElement("div");
      item.className = "datetime-number-item";
      item.dataset.value = String(i);
      item.textContent = i < 10 ? `0${i}` : String(i);
      item.style.cssText = `
      padding: 12px 8px;
      font-size: 18px;
      font-weight: 400;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      width: 100%;
      text-align: center;
      border-radius: 8px;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    `;
      items.push(item);
      numbersContainer.appendChild(item);
    }
    picker.numberItems[colIndex] = items;
    const updateSelection = () => {
      const currentVal = field.get(picker.tempMoment);
      items.forEach((item) => {
        const val = parseInt(item.dataset.value);
        if (val === currentVal) {
          item.style.color = "var(--text-on-accent)";
          item.style.fontWeight = "900";
          item.style.background = "var(--text-muted)";
        } else {
          item.style.color = "var(--text-muted)";
          item.style.fontWeight = "400";
          item.style.background = "transparent";
        }
      });
    };
    const scrollToSelected = () => {
      const currentVal = field.get(picker.tempMoment);
      const index = currentVal - min;
      if (items[index]) {
        const itemHeight = items[index].offsetHeight || 44;
        const containerHeight = wheelScrollContainer.clientHeight;
        const targetScrollTop = index * itemHeight - containerHeight / 2 + itemHeight / 2;
        wheelScrollContainer.scrollTop = targetScrollTop;
      }
    };
    items.forEach((item) => {
      item.addEventListener("click", () => {
        const newVal = parseInt(item.dataset.value);
        if (newVal !== field.get(picker.tempMoment)) {
          field.set(picker.tempMoment, newVal);
          if (field.unit === "year" || field.unit === "month") {
            const dayField = picker.fields.find((f) => f.unit === "day");
            if (dayField) {
              const dayMax = picker.tempMoment.daysInMonth();
              const currentDay = dayField.get(picker.tempMoment);
              if (currentDay > dayMax) {
                dayField.set(picker.tempMoment, dayMax);
              }
              regenerateDayNumbers(picker);
            }
          }
          updateSelection();
        }
      });
    });
    wheelScrollContainer.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        wheelScrollContainer.scrollTop += e.deltaY * 0.5;
      },
      { passive: false }
    );
    let touchStartY = 0;
    let scrollStartTop = 0;
    let isScrolling = false;
    wheelScrollContainer.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        touchStartY = e.touches[0].clientY;
        scrollStartTop = wheelScrollContainer.scrollTop;
        isScrolling = true;
      },
      { passive: true }
    );
    wheelScrollContainer.addEventListener(
      "touchmove",
      (e) => {
        if (!isScrolling || e.touches.length !== 1) return;
        e.preventDefault();
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        wheelScrollContainer.scrollTop = scrollStartTop + deltaY;
      },
      { passive: false }
    );
    wheelScrollContainer.addEventListener(
      "touchend",
      () => {
        isScrolling = false;
      },
      { passive: true }
    );
    column.updateSelection = updateSelection;
    column.scrollToSelected = scrollToSelected;
    return column;
  }
  function regenerateDayNumbers(picker) {
    const dayField = picker.fields.find((f) => f.unit === "day");
    const dayColIndex = picker.fields.findIndex((f) => f.unit === "day");
    const dayItems = picker.numberItems[dayColIndex];
    const dayMin = 1;
    const dayMax = picker.tempMoment.daysInMonth();
    const currentCount = dayItems.length;
    const targetCount = dayMax;
    if (targetCount < currentCount) {
      for (let i = currentCount - 1; i >= targetCount; i--) {
        dayItems[i].remove();
        dayItems.pop();
      }
    } else if (targetCount > currentCount) {
      const container = dayItems[0].parentElement;
      for (let i = currentCount + 1; i <= targetCount; i++) {
        const item = document.createElement("div");
        item.className = "datetime-number-item";
        item.dataset.value = String(i);
        item.textContent = i < 10 ? `0${i}` : String(i);
        item.style.cssText = `
        padding: 12px 8px;
        font-size: 18px;
        font-weight: 400;
        color: var(--text-muted);
        cursor: pointer;
        user-select: none;
        transition: all 0.15s;
        width: 100%;
        text-align: center;
        border-radius: 8px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
      `;
        item.addEventListener("click", () => {
          const newVal = parseInt(item.dataset.value);
          if (newVal !== dayField.get(picker.tempMoment)) {
            dayField.set(picker.tempMoment, newVal);
            picker.columns[dayColIndex].updateSelection();
          }
        });
        container.appendChild(item);
        dayItems.push(item);
      }
    }
    dayItems.forEach((item, index) => {
      const value = index + 1;
      item.dataset.value = String(value);
      item.textContent = value < 10 ? `0${value}` : String(value);
    });
    const currentDay = dayField.get(picker.tempMoment);
    if (currentDay > dayMax) {
      dayField.set(picker.tempMoment, dayMax);
    }
    picker.columns[dayColIndex].updateSelection();
  }
  function updateAllColumns(picker, shouldScroll = false) {
    picker.columns.forEach((col) => {
      if (col.updateSelection) {
        col.updateSelection();
        if (shouldScroll && col.scrollToSelected) {
          col.scrollToSelected();
        }
      }
    });
  }
  function getYearRange() {
    if (yearRangeProvider) {
      try {
        const r = yearRangeProvider();
        if (r && Number.isFinite(r.min) && Number.isFinite(r.max) && r.min <= r.max) return r;
      } catch (e) {
      }
    }
    return {
      min: 1900,
      max: (/* @__PURE__ */ new Date()).getFullYear() + 1
    };
  }
  function showDateTimePicker(initialMoment, onConfirm) {
    const existing = document.getElementById("unified-datetime-picker-mask");
    if (existing) existing.remove();
    const picker = {
      tempMoment: initialMoment.clone(),
      fields: [
        {
          name: "年",
          unit: "year",
          // UX-34：动态范围——min 数据最早年份（下限放宽至 1900）、max 当前年份+1
          min: () => getYearRange().min,
          max: () => getYearRange().max,
          get: (m) => m.year(),
          set: (m, v) => m.year(v)
        },
        {
          name: "月",
          unit: "month",
          min: 1,
          max: 12,
          get: (m) => m.month() + 1,
          set: (m, v) => m.month(v - 1)
        },
        {
          name: "日",
          unit: "day",
          min: 1,
          max: () => picker.tempMoment.daysInMonth(),
          get: (m) => m.date(),
          set: (m, v) => m.date(v)
        },
        {
          name: "时",
          unit: "hour",
          min: 0,
          max: 23,
          get: (m) => m.hour(),
          set: (m, v) => m.hour(v)
        },
        {
          name: "分",
          unit: "minute",
          min: 0,
          max: 59,
          get: (m) => m.minute(),
          set: (m, v) => m.minute(v)
        }
      ],
      columns: [],
      numberItems: []
    };
    const mask = document.createElement("div");
    mask.id = "unified-datetime-picker-mask";
    mask.style.cssText = `
    position: fixed; top:0; left:0; right:0; bottom:0;
    background: var(--background-modifier-cover);
    display: flex;
    align-items: center;
    justify-content: center;
  `;
    const popup = document.createElement("div");
    popup.style.cssText = `
    background: var(--background-primary);
    border-radius: 16px;
    padding: 20px 24px 24px 24px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
  `;
    const title = document.createElement("h4");
    title.textContent = "选择日期时间";
    title.style.cssText = `
    margin:0 0 20px 0;
    font-size:18px;
    font-weight:600;
    color:var(--text-normal);
    text-align:center;
  `;
    popup.appendChild(title);
    const columnsContainer = document.createElement("div");
    columnsContainer.style.cssText = `
    display: flex;
    flex: 1;
    gap: 8px;
    min-height: 320px;
    overflow: hidden;
  `;
    picker.fields.forEach((field, colIndex) => {
      const col = createWheelColumn(field, colIndex, picker);
      columnsContainer.appendChild(col);
      picker.columns.push(col);
    });
    popup.appendChild(columnsContainer);
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = `
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--background-modifier-border);
  `;
    const todayBtn = document.createElement("button");
    todayBtn.textContent = "此刻";
    todayBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  `;
    todayBtn.onclick = () => {
      picker.tempMoment = (0, import_moment.default)();
      regenerateDayNumbers(picker);
      updateAllColumns(picker, true);
    };
    const okBtn = document.createElement("button");
    okBtn.textContent = "确定";
    okBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    flex: 1;
  `;
    okBtn.onclick = () => {
      if (onConfirm) onConfirm(picker.tempMoment.clone());
      mask.remove();
    };
    btnContainer.appendChild(todayBtn);
    btnContainer.appendChild(okBtn);
    popup.appendChild(btnContainer);
    mask.appendChild(popup);
    mask.style.zIndex = String(allocZ());
    document.body.appendChild(mask);
    updateAllColumns(picker, true);
    mask.addEventListener("click", (e) => {
      if (e.target === mask) mask.remove();
    });
    escManager.register("diary-datetime", { isVisible: () => mask.isConnected, close: () => mask.remove() });
    return mask;
  }
  var activeMomentReset = null;
  function resetDateTimeControl(m) {
    if (activeMomentReset) activeMomentReset(m);
  }
  function createDateTimeControl() {
    const container = document.createElement("div");
    container.style.cssText = "margin-bottom:16px;";
    container.classList.add("datetime-picker-container");
    const label = document.createElement("label");
    label.textContent = "日期";
    label.style.cssText = "display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;";
    container.appendChild(label);
    const displayArea = document.createElement("div");
    displayArea.id = "datetime-display-area";
    displayArea.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 12px;
    background: var(--background-primary);
    cursor: pointer;
    flex-wrap: wrap;
  `;
    const yearSpan = document.createElement("span");
    yearSpan.className = "dt-part";
    yearSpan.setAttribute("data-part", "year");
    yearSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
    yearSpan.textContent = "----";
    const monthSpan = document.createElement("span");
    monthSpan.className = "dt-part";
    monthSpan.setAttribute("data-part", "month");
    monthSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
    monthSpan.textContent = "--";
    const daySpan = document.createElement("span");
    daySpan.className = "dt-part";
    daySpan.setAttribute("data-part", "day");
    daySpan.style.cssText = "padding:2px 6px; border-radius:4px;";
    daySpan.textContent = "--";
    const hourSpan = document.createElement("span");
    hourSpan.className = "dt-part";
    hourSpan.setAttribute("data-part", "hour");
    hourSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
    hourSpan.textContent = "--";
    const minuteSpan = document.createElement("span");
    minuteSpan.className = "dt-part";
    minuteSpan.setAttribute("data-part", "minute");
    minuteSpan.style.cssText = "padding:2px 6px; border-radius:4px;";
    minuteSpan.textContent = "--";
    const sep1 = document.createTextNode("-");
    const sep2 = document.createTextNode("-");
    const space = document.createTextNode(" ");
    const colon = document.createTextNode(":");
    displayArea.appendChild(yearSpan);
    displayArea.appendChild(sep1);
    displayArea.appendChild(monthSpan);
    displayArea.appendChild(sep2);
    displayArea.appendChild(daySpan);
    displayArea.appendChild(space);
    displayArea.appendChild(hourSpan);
    displayArea.appendChild(colon);
    displayArea.appendChild(minuteSpan);
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "text";
    hiddenInput.id = "add-diary-datetime";
    hiddenInput.style.display = "none";
    const manualInput = document.createElement("input");
    manualInput.type = "text";
    manualInput.placeholder = "YYYY-MM-DD HH:mm 或 1分钟前";
    manualInput.style.cssText = `
    width: 100%;
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    font-size: 14px;
    box-sizing: border-box;
    padding: 8px 12px;
    display: none;
  `;
    let currentMoment = (0, import_moment.default)();
    let isManualMode = false;
    let clickTimer = null;
    const setMoment = (m) => {
      if (!m || typeof m.isValid !== "function" || !m.isValid()) return;
      currentMoment = m.clone();
      updateDisplay(currentMoment);
    };
    activeMomentReset = setMoment;
    function updateDisplay(momentObj) {
      if (!momentObj || !momentObj.isValid()) {
        yearSpan.textContent = "----";
        monthSpan.textContent = "--";
        daySpan.textContent = "--";
        hourSpan.textContent = "--";
        minuteSpan.textContent = "--";
        hiddenInput.value = "";
        return;
      }
      yearSpan.textContent = momentObj.format("YYYY");
      monthSpan.textContent = momentObj.format("MM");
      daySpan.textContent = momentObj.format("DD");
      hourSpan.textContent = momentObj.format("HH");
      minuteSpan.textContent = momentObj.format("mm");
      hiddenInput.value = momentObj.format("YYYY-MM-DD HH:mm");
    }
    updateDisplay(currentMoment);
    function openUnifiedPicker() {
      if (isManualMode) return;
      showDateTimePicker(currentMoment, (newMoment) => {
        if (newMoment && newMoment.isValid()) {
          currentMoment = newMoment;
          updateDisplay(currentMoment);
        }
      });
    }
    function onSingleClick() {
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        openUnifiedPicker();
      }, 200);
    }
    function onDoubleClick() {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      if (isManualMode) return;
      isManualMode = true;
      displayArea.style.display = "none";
      manualInput.style.display = "block";
      manualInput.value = hiddenInput.value;
      manualInput.focus();
      manualInput.select();
    }
    displayArea.addEventListener("click", onSingleClick);
    displayArea.addEventListener("dblclick", onDoubleClick);
    function commitManualEdit() {
      const raw = manualInput.value.trim();
      const newMoment = parseFlexibleDateTime(raw);
      if (newMoment && newMoment.isValid()) {
        currentMoment = newMoment;
        updateDisplay(currentMoment);
      } else {
        manualInput.value = hiddenInput.value;
        notice("日期时间格式无效，已恢复");
      }
      isManualMode = false;
      manualInput.style.display = "none";
      displayArea.style.display = "flex";
    }
    manualInput.addEventListener("blur", commitManualEdit);
    manualInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitManualEdit();
      }
    });
    container.appendChild(displayArea);
    container.appendChild(manualInput);
    container.appendChild(hiddenInput);
    return container;
  }

  // src/diary/ui/entry-actions.ts
  init_notice();
  init_flow_dialog();
  init_app();
  init_domain_bus();

  // src/diary/ui/locator.ts
  async function buildLocatorPredicateFor(dateStr, loc) {
    let uniqueTime = true;
    try {
      const entries = await listDateEntries(dateStr);
      uniqueTime = entries.filter((e) => e.time === loc.time).length === 1;
    } catch (e) {
    }
    return (e) => e.time === loc.time && (uniqueTime || e.lineNumber === loc.lineNumber);
  }

  // src/diary/ui/entry-actions.ts
  async function jumpToDiaryEntry(entry) {
    const fileName = entry.filename;
    const filePath = `${DIARY_DIRECTORY}/${fileName}.md`;
    const anchor = `${entry.emoji} ${entry.time}`;
    const link = `${DIARY_DIRECTORY}/${fileName}#${anchor}`;
    const file = getApp().vault.getAbstractFileByPath(filePath);
    if (!file) {
      notice("找不到日记文件");
      return;
    }
    await getApp().workspace.openLinkText(link, "", false, { active: true });
  }
  async function copyDiaryLink(entry) {
    const link = `[[${DIARY_DIRECTORY}/${entry.filename}#${entry.emoji} ${entry.time}]]`;
    await navigator.clipboard.writeText(link);
    notice(`已复制双链引用：${link}`, "success");
  }
  function showConfirm(loc) {
    const isEncrypted = !!loc.encrypted;
    void openFlowDialog({
      title: "确认删除",
      message: isEncrypted ? "确定删除这篇加密日记吗？\n\n此操作不可撤销，密文将从保险库永久销毁。" : "确定要删除这篇日记吗？\n\n此操作不可撤销，日记将从笔记中永久删除。",
      actions: [
        { label: "取消", value: "cancel" },
        { label: "删除日记", value: "ok", cta: true }
      ]
    }).then(async (v) => {
      if (v !== "ok") return;
      if (isEncrypted && loc.noteId) {
        await deleteEncryptedEntry(loc.noteId);
        emitDomainEvent("diary:encrypted-purged", { noteId: loc.noteId });
      } else {
        const removed = await removeDiaryEntries(loc.date, await buildLocatorPredicateFor(loc.date, loc));
        if (removed === 0) {
          notice("未能在日记数据中定位该条目，没有删除", "error");
          return;
        }
        emitDomainEvent("diary:entry-deleted", { date: loc.date, time: loc.time, wasEncrypted: false });
      }
      notice("日记条目已删除", "success");
    }).catch((err) => {
      if (err && isUnparsedRefusal(err)) return;
      notice("删除日记失败：" + ((err == null ? void 0 : err.message) || err), "error");
    });
  }

  // src/diary/ui/dialogs.ts
  function createTagOptionButton(tag) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diary-tag-selector-btn";
    btn.dataset.tag = tag;
    let buttonText = `${getTagEmoji(tag)} ${tag}`;
    if (isSubTag(tag)) {
      const parentTag = getParentPrimaryTag(tag);
      if (parentTag) {
        buttonText += ` <span style="font-size: 12px;margin-left:4px;position: absolute;top: 0;right: 0;translate: 5px -5px;">${getTagEmoji(parentTag)}</span>`;
      }
    }
    btn.innerHTML = buttonText;
    btn.style.cssText = "padding:6px 12px;border-radius:20px;background:var(--background-secondary);border:none;cursor:pointer;font-size:14px;color:var(--text-normal);position: relative;";
    return btn;
  }
  var activeTagPickerLoc = null;
  function createTagPicker() {
    const existingPopup = document.getElementById("diary-tag-selector-popup");
    const existingMask = document.getElementById("diary-tag-selector-mask");
    if (existingPopup) existingPopup.remove();
    if (existingMask) existingMask.remove();
    const mask = document.createElement("div");
    mask.id = "diary-tag-selector-mask";
    mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;";
    mask.onclick = (e) => e.target === mask && (mask.style.display = "none");
    const popup = document.createElement("div");
    popup.id = "diary-tag-selector-popup";
    popup.className = "diary-tag-selector-popup";
    popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:20px;max-width:300px;width:90%;max-height:80vh;overflow-y:auto;display:none;";
    const title = document.createElement("h4");
    title.className = "diary-tag-selector-title";
    title.textContent = "选择类型";
    const buttonsContainer = document.createElement("div");
    buttonsContainer.className = "diary-tag-selector-buttons";
    const actionsContainer = document.createElement("div");
    actionsContainer.className = "diary-tag-selector-actions";
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "diary-action-btn diary-delete-btn";
    deleteBtn.textContent = "删除";
    deleteBtn.style.cssText = "background:var(--background-modifier-error);color:var(--background-primary);margin-right:auto;";
    deleteBtn.onclick = () => {
      const loc = activeTagPickerLoc;
      hideTagPicker();
      if (loc) showConfirm(loc);
    };
    const saveBtn = document.createElement("button");
    saveBtn.className = "diary-action-btn diary-save-btn";
    saveBtn.textContent = "保存";
    saveBtn.onclick = () => {
      const loc = activeTagPickerLoc;
      if (!loc) {
        hideTagPicker();
        return;
      }
      const selTagNames = [];
      buttonsContainer.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
        selTagNames.push(btn.dataset.tag);
      });
      if (selTagNames.length === 0) {
        notice("请至少选择一个标签");
        return;
      }
      hideTagPicker();
      void handleTagPickerSave(loc, selTagNames, !!loc.encrypted);
    };
    actionsContainer.appendChild(deleteBtn);
    actionsContainer.appendChild(saveBtn);
    popup.appendChild(title);
    popup.appendChild(buttonsContainer);
    popup.appendChild(actionsContainer);
    mask.appendChild(popup);
    document.body.appendChild(mask);
  }
  function hideTagPicker() {
    const mask = document.getElementById("diary-tag-selector-mask");
    const popup = document.getElementById("diary-tag-selector-popup");
    if (mask) mask.style.display = "none";
    if (popup) popup.style.display = "none";
  }
  async function handleTagPickerSave(loc, selTagNames, isEncryptedEntry2) {
    if (isEncryptedEntry2) {
      const proceed = await openFlowDialog({
        title: "改分类",
        message: "将解密此日记并恢复为普通条目，是否继续？",
        actions: [
          { label: "取消", value: "cancel" },
          { label: "确定", value: "ok", cta: true }
        ]
      }) === "ok";
      if (!proceed) return;
      if (!loc.noteId) return;
      const newTags = selTagNames.filter((t) => t !== ENCRYPT_TAG);
      const success = await reclassifyEntry(loc.noteId, selTagNames);
      if (!success) {
        notice("解密改分类失败", "error");
        return;
      }
      notice("已解密还原", "success");
      emitDomainEvent("diary:entry-decrypted", { noteId: loc.noteId, date: loc.date, newTags });
      return;
    }
    const dateStr = loc.date;
    const predicate = await buildLocatorPredicateFor(dateStr, loc);
    try {
      const updated = await updateDiaryTags(dateStr, predicate, selTagNames);
      if (!updated) {
        notice("未能在日记数据中定位该条目，标签没有修改", "error");
      }
    } catch (e) {
      if (!isUnparsedRefusal(e)) throw e;
    }
  }
  function showTagPicker(loc) {
    const mask = document.getElementById("diary-tag-selector-mask");
    const popup = document.getElementById("diary-tag-selector-popup");
    if (!mask || !popup) return;
    activeTagPickerLoc = loc;
    const buttonsContainer = popup.querySelector(".diary-tag-selector-buttons");
    if (!buttonsContainer) return;
    buttonsContainer.innerHTML = "";
    const isEncrypted = !!loc.encrypted;
    const sortedTags = getSortedTagsForAddDialog();
    const currentTagsSet = new Set(isEncrypted ? loc.tags.filter((t) => t !== ENCRYPT_TAG) : loc.tags);
    for (const tag of sortedTags) {
      const button = createTagOptionButton(tag);
      if (currentTagsSet.has(tag)) {
        button.classList.add("diary-active");
        button.style.background = "var(--interactive-accent)";
        button.style.color = "var(--background-primary)";
      } else {
        button.style.background = "var(--background-secondary)";
        button.style.color = "var(--text-normal)";
      }
      button.onclick = (e) => {
        e.stopPropagation();
        button.classList.toggle("diary-active");
        if (button.classList.contains("diary-active")) {
          button.style.background = "var(--interactive-accent)";
          button.style.color = "var(--background-primary)";
        } else {
          button.style.background = "var(--background-secondary)";
          button.style.color = "var(--text-normal)";
        }
      };
      buttonsContainer.appendChild(button);
    }
    topifyZ(mask, popup);
    mask.style.display = "block";
    popup.style.display = "block";
  }
  function createAddDialog() {
    const existingMask = document.getElementById("add-diary-mask");
    const existingPopup = document.getElementById("add-diary-popup");
    if (existingMask) existingMask.remove();
    if (existingPopup) existingPopup.remove();
    const mask = document.createElement("div");
    mask.id = "add-diary-mask";
    mask.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.3);display:none;";
    mask.onclick = (e) => e.target === mask && (mask.style.display = "none");
    const popup = document.createElement("div");
    popup.id = "add-diary-popup";
    popup.className = "add-diary-popup";
    popup.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--background-primary);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:24px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;display:none;";
    const title = document.createElement("h4");
    title.className = "add-diary-title";
    title.textContent = "写日记";
    title.style.cssText = "margin:0 0 20px 0;font-size:18px;font-weight:600;color:var(--text-normal);";
    const dateTimePicker = createDateTimeControl();
    const typeLabel = document.createElement("label");
    typeLabel.textContent = "类型";
    typeLabel.style.cssText = "display:block;margin-bottom:6px;font-size:14px;color:var(--text-muted);font-weight:500;";
    const typeContainer = document.createElement("div");
    typeContainer.id = "add-diary-type-container";
    typeContainer.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px;";
    const allTags = getSortedTagsForAddDialog();
    for (const tag of allTags) {
      const btn = createTagOptionButton(tag);
      btn.onclick = (e) => {
        e.preventDefault();
        btn.classList.toggle("diary-active");
      };
      typeContainer.appendChild(btn);
    }
    const buttonsContainer = document.createElement("div");
    buttonsContainer.style.cssText = "display:flex;gap:12px;justify-content:flex-end;";
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "保存";
    saveBtn.style.cssText = "padding:8px 16px;border-radius:6px;border:none;background:var(--interactive-accent);color:var(--background-primary);cursor:pointer;font-size:14px;font-weight:500;";
    saveBtn.onclick = async () => await saveNewEntry();
    buttonsContainer.appendChild(saveBtn);
    popup.appendChild(title);
    popup.appendChild(dateTimePicker);
    popup.appendChild(typeLabel);
    popup.appendChild(typeContainer);
    popup.appendChild(buttonsContainer);
    mask.appendChild(popup);
    document.body.appendChild(mask);
  }
  function openAddDialog(opts) {
    const mask = document.getElementById("add-diary-mask");
    const popup = document.getElementById("add-diary-popup");
    if (!mask || !popup) return;
    if (opts == null ? void 0 : opts.yearRange) {
      const range = opts.yearRange;
      setDateTimeYearRangeProvider(() => range);
    } else {
      setDateTimeYearRangeProvider(null);
    }
    const typeContainer = document.getElementById("add-diary-type-container");
    if (typeContainer) {
      typeContainer.innerHTML = "";
      const sortedTags = getSortedTagsForAddDialog();
      for (const tag of sortedTags) {
        const btn = createTagOptionButton(tag);
        btn.onclick = (e) => {
          e.preventDefault();
          btn.classList.toggle("diary-active");
        };
        typeContainer.appendChild(btn);
      }
    }
    let defaultDateStr = (0, import_moment.default)().format("YYYY-MM-DD");
    let defaultTimeStr = (0, import_moment.default)().format("HH:mm");
    if (getUseFileDateTimeSetting()) {
      const activeView = getApp().workspace.getActiveViewOfType(MarkdownView);
      if (activeView && activeView.file) {
        const file = activeView.file;
        if (file.path.startsWith(DIARY_DIRECTORY)) {
          const fileName = file.basename;
          if (/^\d{4}-\d{2}-\d{2}$/.test(fileName)) {
            defaultDateStr = fileName;
          }
        }
      }
    }
    const defaultDateTime = `${defaultDateStr} ${defaultTimeStr}`;
    resetDateTimeControl((0, import_moment.default)(defaultDateTime, "YYYY-MM-DD HH:mm", true));
    const datetimeInput = document.getElementById("add-diary-datetime");
    if (datetimeInput) {
      datetimeInput.value = defaultDateTime;
    }
    topifyZ(mask, popup);
    mask.style.display = "block";
    popup.style.display = "block";
    setTimeout(() => datetimeInput && datetimeInput.focus(), 100);
  }
  function getUseFileDateTimeSetting() {
    const s = tryGetSettings();
    return (s == null ? void 0 : s.useFileDateTime) === true;
  }
  async function saveNewEntry() {
    const datetimeInput = document.getElementById("add-diary-datetime");
    const mask = document.getElementById("add-diary-mask");
    const popup = document.getElementById("add-diary-popup");
    if (!datetimeInput || !mask || !popup) return;
    const userInput = datetimeInput.value.trim();
    const typeContainer = document.getElementById("add-diary-type-container");
    const selTagNames = [];
    typeContainer.querySelectorAll(".diary-tag-selector-btn.diary-active").forEach((btn) => {
      selTagNames.push(btn.dataset.tag);
    });
    if (selTagNames.length === 0) {
      notice("请至少选择一个类型");
      return;
    }
    let targetMoment = parseFlexibleDateTime(userInput);
    if (!targetMoment || !targetMoment.isValid()) {
      notice("日期时间格式不正确");
      return;
    }
    const dateStr = targetMoment.format("YYYY-MM-DD");
    const timeStr = targetMoment.format("HH:mm");
    try {
      await addEntry(dateStr, timeStr, selTagNames, "");
      notice("已保存日记", "success");
      mask.style.display = "none";
      popup.style.display = "none";
    } catch (error) {
      if (isUnparsedRefusal(error)) return;
      console.error("保存日记失败:", error);
      notice("保存日记失败：" + error.message, "error");
    }
  }

  // src/diary/ui.ts
  var ACTION_ICON = {
    open: "external-link",
    copyLink: "copy",
    copyContent: "file-text",
    attachment: "paperclip",
    editTags: "tags",
    encrypt: "lock",
    decrypt: "lock-open",
    remove: "trash-2",
    play: "play",
    music: "music",
    image: "image"
  };
  var WIDE_TEXT_MIN_CHARS = 800;
  var SEARCH_DEBOUNCE_MS = 250;
  var DBLCLICK_WINDOW_MS = 300;
  var LB_SWIPE_THRESHOLD_PX = 40;
  var RAIL_HIGHLIGHT_EPSILON_PX = 8;
  var SCROLL_FIX_DELAY_MS = 480;
  var MODIFY_REFRESH_DEBOUNCE_MS = 400;
  function pickCurrentMonth(heads) {
    let current = null;
    for (const h of heads) {
      if (h.relTop <= RAIL_HIGHLIGHT_EPSILON_PX) current = h.date.slice(0, 7);
      else break;
    }
    return current;
  }
  var _DiaryAppController = class _DiaryAppController {
    constructor() {
      /** 根容器（固定全屏遮罩层） */
      this.root = null;
      /** 数据 */
      this.entries = [];
      /** 当前筛选标签（null = 全部） */
      this.selTag = null;
      /** 搜索关键词（空 = 全部） */
      this.searchKeyword = "";
      /** 日期筛选（null = 全部；{ year } = 年份；{ year, month } = 某月）——回忆墙自包含，不再依赖 diary 面板 filter */
      this.selDateFilter = null;
      /** 二级标签筛选（选中主标签后其子标签） */
      this.selSubTag = null;
      /** 加密条目是否可见（原型 S.locked：默认锁定隐藏） */
      this.lockedVisible = false;
      this.escUnregister = null;
      this._initialized = false;
      /** DW3：vault modify 自动刷新订阅（show 挂 / hide+cleanup 摘）+ 防抖计时 */
      this._modifyRef = null;
      this._modifyTimer = null;
      /** DW6：章节跳转落定校正计时 */
      this._scrollFixTimer = null;
      /** 媒体懒加载 observer + 章节滚动高亮 cleanup：按 desk/mob 实例分存（双实例各自独立，互不覆盖） */
      this.observers = { desk: null, mob: null };
      /** issue 210：章节栏视频缩略懒加载 observer（desk/mob 各自独立） */
      this.railObservers = { desk: null, mob: null };
      this.rafCleanups = { desk: null, mob: null };
      this.sheetEntry = null;
      this._searchTimer = null;
      /** 日期筛选弹窗元素（null = 未打开） */
      this._dateFilterEl = null;
      /** 当前渲染条目列表（右键委托按 dataset.widx 反查条目；renderWall 时重建） */
      this._wallEntries = [];
      /** 右键委托已挂载标记（按 desk/mob 实例，防重复绑定） */
      this._ctxBound = { desk: false, mob: false };
      /** 增强 #1：灯箱连看序列（filtered 列表媒体平铺，renderWall 重建）与当前下标（-1 = 未开） */
      this._lbSeq = [];
      /** issue 217 F1：时光条灯箱打开期间暂存的墙内主序列（关闭时还原） */
      this._lbSeqMain = null;
      this._lbIdx = -1;
      /** issue 217 F3：桌面/移动断点（renderAll 只渲染可见端；跨断点变化补渲染） */
      this._mql = null;
      this._onMqChange = null;
      /** 增强 #1：方向键切图（bindLightbox 单次注册，灯箱可见时才生效） */
      this._onLbKeydown = (ev) => {
        if (!this.lbVisible()) return;
        if (ev.key === "ArrowLeft") {
          ev.preventDefault();
          this.stepLightbox(-1);
        } else if (ev.key === "ArrowRight") {
          ev.preventDefault();
          this.stepLightbox(1);
        }
      };
      /** 增强 #9：保险箱解锁状态订阅（show 挂 / hide+cleanup 摘；encrypt:unlock-changed 域事件） */
      this._unlockOff = null;
      /** 写链路事件订阅退订（show 挂 / hide+cleanup 摘；entry-added 等 diary 域事件防抖回刷） */
      this._writeOff = null;
      /** 增强 #11：跳走前捕获的墙视图状态（回墙恢复；一次性消费） */
      this._restore = null;
      /** 增强 #8：加密媒体解密结果缓存（noteId|kind|name → dataURL promise；失败也缓存避免重复解密风暴） */
      this.encMediaCache = /* @__PURE__ */ new Map();
    }
    static getInstance() {
      if (!_DiaryAppController.instance) {
        _DiaryAppController.instance = new _DiaryAppController();
      }
      return _DiaryAppController.instance;
    }
    // ---------- 创建 DOM（桌面 + 移动双实例，幂等） ----------
    ensureElements() {
      if (this._initialized) return;
      this._initialized = true;
      this.root = document.createElement("div");
      this.root.className = "bz-diary";
      this.root.style.cssText = "position:fixed;inset:0;z-index:var(--bz-z-overlay,1000);display:none;";
      document.body.appendChild(this.root);
      const desk = document.createElement("div");
      desk.className = "bz-diary-desk";
      desk.innerHTML = this.panelHTML();
      this.mountSearch(desk);
      this.root.appendChild(desk);
      this.desk = this.bindRefs(desk);
      const mob = document.createElement("div");
      mob.className = "bz-diary-mob bz-panel-mtop";
      mob.innerHTML = this.panelHTML();
      this.mountSearch(mob);
      this.root.appendChild(mob);
      this.mob = this.bindRefs(mob);
      this.bindPanel(this.desk);
      this.bindPanel(this.mob);
      this.decorateIcons(desk);
      this.decorateIcons(mob);
      this.bindLightbox();
      this.bindSheet();
      this.registerEscape();
      document.addEventListener("keydown", this._onLbKeydown);
      if (typeof matchMedia === "function") {
        this._mql = matchMedia("(max-width: 768px)");
        this._onMqChange = () => {
          var _a;
          if (((_a = this.root) == null ? void 0 : _a.style.display) === "flex") this.renderAll();
        };
        this._mql.addEventListener("change", this._onMqChange);
      }
    }
    /** 从实例 HTML 收集 DOM 引用 */
    bindRefs(scope) {
      const q = (sel) => scope.querySelector(sel);
      return {
        head: q(".bz-diary-head"),
        range: q(".bz-diary-range"),
        chipRow: q(".bz-diary-chiprow"),
        subRow: q(".bz-diary-subrow"),
        searchRow: q(".bz-diary-searchrow"),
        searchBox: q(".bz-diary-searchrow .bz-search input"),
        body: q(".bz-diary-body"),
        wall: q(".bz-diary-wall"),
        rail: q(".bz-diary-rail"),
        lb: q(".bz-diary-lb"),
        lbMedia: q(".bz-diary-lbmedia"),
        lbCap: q(".bz-diary-lbcap"),
        lbSub: q(".bz-diary-lbsub"),
        sheetMask: q(".bz-diary-sheet-mask"),
        sheet: q(".bz-diary-sheet"),
        sheetEmoji: q(".bz-diary-sheet-emoji"),
        sheetTime: q(".bz-diary-sheet-time"),
        sheetContent: q(".bz-diary-sheet-content"),
        sheetMedia: q(".bz-diary-sheet-media"),
        sheetActions: q(".bz-diary-sheet-actions")
      };
    }
    /**
     * 面板骨架（桌面/移动共用——真全屏由 CSS ≤768px 控制，两份 HTML 一字不差）。
     * 增强包 #4：头行/灯箱按钮 emoji 换 lucide（ensureElements 后 decorateIcons 按 data-act 注入 uiIcon）；
     * 头行精简（2026-09-10 用户要求）：关闭/设置/按年月跳转三枚按钮移除，日期入口只留品牌行；
     * 增强包 #1：灯箱加左右切换按钮（连看）。
     */
    panelHTML() {
      return wallPanelHTML();
    }
    /** 搜索框：组件库 uiSearch（.bz-search 壳 + 前缀搜索图标 + .bz-input），双实例各挂一份 */
    mountSearch(scope) {
      const row = scope.querySelector(".bz-diary-searchrow");
      if (!row) return;
      row.appendChild(uiSearch({ placeholder: "搜索日记（正文、类型、时间）…" }).el);
    }
    /** 增强包 #4/#10：按 data-act 给空按钮注入 lucide 图标（ensureElements 时各实例跑一次） */
    decorateIcons(scope) {
      for (const [act, name] of Object.entries(ACT_ICON)) {
        scope.querySelectorAll(`[data-act="${act}"]`).forEach((btn) => {
          if (btn.tagName !== "BUTTON" || btn.firstChild) return;
          btn.appendChild(uiIcon(name));
        });
      }
    }
    // ---------- 交互绑定 ----------
    bindPanel(ui) {
      var _a, _b, _c;
      ui.head.querySelectorAll('[data-act="date-picker"]').forEach((el) => {
        el.addEventListener("click", () => this.openDatePicker());
      });
      (_a = ui.head.querySelector('[data-act="add"]')) == null ? void 0 : _a.addEventListener("click", () => this.openAddEntry());
      (_b = ui.head.querySelector('[data-act="search"]')) == null ? void 0 : _b.addEventListener("click", () => this.toggleSearch(ui));
      (_c = ui.lb.querySelector('[data-act="lb-close"]')) == null ? void 0 : _c.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeLightbox();
      });
      ui.rail.addEventListener("click", (e) => {
        const item = e.target.closest(".bz-diary-month");
        if (!item) return;
        this.scrollToMonth(item.dataset.month || "", ui.wall);
      });
      ui.searchBox.addEventListener("input", () => {
        if (this._searchTimer) clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => {
          this._searchTimer = null;
          this.searchKeyword = ui.searchBox.value;
          this.renderAll();
        }, SEARCH_DEBOUNCE_MS);
      });
      ui.searchBox.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          ui.searchBox.value = "";
          this.searchKeyword = "";
          this.renderAll();
          ui.searchBox.blur();
        }
      });
    }
    /** 灯箱通用绑定（双实例各一份；增强 #1：左右按钮 + 触摸滑动连看） */
    bindLightbox() {
      [this.desk, this.mob].forEach((ui) => {
        var _a, _b;
        ui.lb.addEventListener("click", (e) => {
          if (e.target === ui.lb) this.closeLightbox();
        });
        (_a = ui.lb.querySelector('[data-act="lb-prev"]')) == null ? void 0 : _a.addEventListener("click", (e) => {
          e.stopPropagation();
          this.stepLightbox(-1);
        });
        (_b = ui.lb.querySelector('[data-act="lb-next"]')) == null ? void 0 : _b.addEventListener("click", (e) => {
          e.stopPropagation();
          this.stepLightbox(1);
        });
        let touchX = null;
        ui.lb.addEventListener(
          "touchstart",
          (e) => {
            var _a2, _b2;
            touchX = (_b2 = (_a2 = e.touches[0]) == null ? void 0 : _a2.clientX) != null ? _b2 : null;
          },
          { passive: true }
        );
        ui.lb.addEventListener(
          "touchend",
          (e) => {
            var _a2, _b2;
            if (touchX === null) return;
            const dx = ((_b2 = (_a2 = e.changedTouches[0]) == null ? void 0 : _a2.clientX) != null ? _b2 : touchX) - touchX;
            touchX = null;
            if (Math.abs(dx) >= LB_SWIPE_THRESHOLD_PX) this.stepLightbox(dx < 0 ? 1 : -1);
          },
          { passive: true }
        );
      });
      this.root.addEventListener("click", (e) => {
        if (e.target === this.root && this.root.style.display === "flex") this.hide();
      });
    }
    /** 灯箱是否可见（任一实例） */
    lbVisible() {
      return !!this.root && (this.desk.lb.classList.contains("bz-diary-lb--show") || this.mob.lb.classList.contains("bz-diary-lb--show"));
    }
    /** 增强 #1：灯箱步进（dir=1 下一张 / -1 上一张；到头循环——相册式连看，与移动端滑动同口径） */
    stepLightbox(dir) {
      if (!this.lbVisible() || !this._lbSeq.length) return;
      this.showLightboxAt(this._lbIdx + dir);
    }
    // ---------- 渲染 ----------
    /** 重新渲染（筛选变化 / 数据加载后）。
     *  issue 217 F3：只渲染当前可见端实例——隐藏端全量渲染（每条正文 MarkdownRenderer ×2）
     *  是开墙耗时翻倍的隐性大头；断点切换由 _onMqChange 补渲染。jsdom 无 matchMedia 保留双渲染。 */
    renderAll() {
      if (!this.root) return;
      this.renderChips();
      const list = this.filtered();
      const range = `${list.length} 条`;
      this.desk.range.textContent = range;
      this.mob.range.textContent = range;
      if (this._mql) {
        if (this._mql.matches) this.renderWall(this.mob, true, list);
        else this.renderWall(this.desk, false, list);
        return;
      }
      this.renderWall(this.desk, false, list);
      this.renderWall(this.mob, true, list);
    }
    /** 过滤后的条目（加密条目默认隐藏，选中「加密」标签时显示；支持标签/二级标签/搜索/日期） */
    filtered() {
      const kw = this.searchKeyword.trim().toLowerCase();
      const df = this.selDateFilter;
      return this.entries.filter((e) => {
        const isEnc = e.encrypted || e.tags.includes("加密");
        if (this.selTag === "加密") {
          if (!isEnc) return false;
        } else {
          if (this.selSubTag) {
            if (!e.tags.includes(this.selSubTag)) return false;
          } else {
            if (this.selTag && !e.tags.includes(this.selTag)) return false;
          }
          if (isEnc) return false;
        }
        if (df) {
          if (df.month) {
            if (!e.date.startsWith(`${df.year}-${df.month}`)) return false;
          } else if (!e.date.startsWith(df.year)) {
            return false;
          }
        }
        if (kw) {
          const hit = (e.text || "").toLowerCase().includes(kw) || e.tags.some((t) => t.toLowerCase().includes(kw)) || e.time.toLowerCase().includes(kw) || e.date.includes(kw);
          if (!hit) return false;
        }
        return true;
      });
    }
    /** 类型 chips 行（主标签胶囊 + 计数；「加密」锁定态 🔒 虚线）——标签表取自 config（含旅游/收藏等带二级标签的主标签），非硬编码 */
    renderChips() {
      const countFor = (tag) => tag === "加密" ? this.entries.filter((e) => e.encrypted || e.tags.includes("加密")).length : this.entries.filter((e) => e.tags.includes(tag)).length;
      const tagChips = getPrimaryTagsInDisplayOrder().map((tag) => [tag, getTagEmoji(tag)]);
      [this.desk.chipRow, this.mob.chipRow].forEach((row) => {
        row.innerHTML = "";
        tagChips.forEach(([tag, emoji]) => {
          const locked = tag === "加密" && !this.lockedVisible;
          const b = document.createElement("button");
          b.className = "bz-diary-chip bz-touch-target--xl" + (locked ? " bz-diary-chip--locked" : "") + (this.selTag === tag ? " bz-diary-chip--on" : "");
          b.dataset.tag = tag;
          if (locked) b.appendChild(uiIcon("lock"));
          else b.appendChild(document.createTextNode(emoji));
          b.appendChild(document.createTextNode(" " + tag + " "));
          const cnt = document.createElement("span");
          cnt.className = "bz-diary-chip-cnt";
          cnt.textContent = String(countFor(tag));
          b.appendChild(cnt);
          b.addEventListener("click", () => {
            if (tag === "加密") {
              if (locked) {
                void this.unlockAndSelectEncrypt();
                return;
              }
              this.selTag = this.selTag === "加密" ? null : "加密";
              this.renderAll();
              return;
            }
            if (this.selTag !== tag) this.selSubTag = null;
            this.selTag = this.selTag === tag ? null : tag;
            this.renderAll();
          });
          row.appendChild(b);
        });
      });
      this.renderSubRow(this.desk);
      this.renderSubRow(this.mob);
    }
    /** 加密 chip 锁定态点击：弹保险箱解锁 → 解锁后并入加密日记 → 选中「加密」筛选（对齐日记本） */
    async unlockAndSelectEncrypt() {
      try {
        const { ensureSafeUnlocked: ensureSafeUnlocked2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
        const ok = await ensureSafeUnlocked2();
        if (!ok) return;
        this.lockedVisible = true;
        this.selTag = "加密";
        await this.mergeEncryptedEntries();
        this.renderAll();
      } catch (e) {
        notice("解密失败：主密码可能不正确，密文未受影响", "error");
      }
    }
    /**
     * 并入保险箱里的加密日记条目（ADR-0017：加密日记 = 保险箱 kind='diary-entry' 的 SafeNote）。
     * 未解锁/无加密条目/加载失败均为幂等空操作；合并后与普通条目统一按日期时间降序混排。
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
            lineNumber: e.lineNumber,
            id: e.id,
            noteId: e.noteId,
            encrypted: true,
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
    /** 二级标签行：选中的主标签有二级标签时显示（如 旅游 → 四川/大理） */
    renderSubRow(ui) {
      const row = ui.subRow;
      if (!row) return;
      row.innerHTML = "";
      if (!this.selTag) {
        row.style.display = "none";
        return;
      }
      const subs = getSubTagsOfPrimary(this.selTag);
      if (!subs || subs.length === 0) {
        row.style.display = "none";
        return;
      }
      row.style.display = "flex";
      subs.forEach((sub) => {
        const b = document.createElement("button");
        b.className = "bz-diary-subchip bz-touch-target--xl" + (this.selSubTag === sub.tag ? " bz-diary-subchip--on" : "");
        b.dataset.tag = sub.tag;
        b.innerHTML = `${sub.emoji} ${sub.tag}`;
        b.addEventListener("click", () => {
          this.selSubTag = this.selSubTag === sub.tag ? null : sub.tag;
          this.renderAll();
        });
        row.appendChild(b);
      });
    }
    /** 渲染章节栏 + 瀑布（桌面/移动各一份；list = 本次过滤结果，renderAll 一次计算共享） */
    renderWall(ui, mobile, list) {
      this.teardownScrollers(mobile ? "mob" : "desk");
      ui.wall.innerHTML = "";
      ui.rail.innerHTML = "";
      this._lbSeq = list.flatMap((e) => e.media.map((m) => ({ entry: e, media: m })));
      if (!list.length) {
        ui.wall.appendChild(this.mkEmpty());
        return;
      }
      const memories = pickOnThisDay(list, this.todayStr()).filter((e) => e.media.length > 0);
      if (memories.length) ui.wall.appendChild(this.mkMemories(memories));
      if (!mobile) {
        ui.rail.appendChild(this.mkRailScroll(list));
        this.setupRailLazy(ui.rail, "desk");
      }
      this._wallEntries = list;
      this.renderMasonry(ui, mobile, list);
      this.setupLazy(ui.wall, mobile ? "mob" : "desk");
      this.bindWallContext(ui.wall, mobile ? "mob" : "desk");
      if (!mobile && ui.rail.children.length > 0) {
        this.setupRailHighlight(ui.wall, ui.rail, "desk");
      }
    }
    /**
     * 章节栏构建（仅桌面调用）：年份分组月份行（含胶卷缩略条）。
     * 月份 = groupByMonth(list) 的 key 倒序（对齐数据层契约）。
     * 2026-09-10：栏顶「章 节」标题块按用户要求移除——一列月份本身自明，标题是多余噪点。
     */
    mkRailScroll(list) {
      const scroll = document.createElement("div");
      scroll.className = "bz-rail-scroll";
      const byMonth = groupByMonth(list);
      const months = [...byMonth.keys()].sort().reverse();
      let lastYear = "";
      months.forEach((mk) => {
        const yr = mk.slice(0, 4);
        if (yr !== lastYear) {
          lastYear = yr;
          const yLabel = document.createElement("div");
          yLabel.className = "bz-diary-rail-year";
          yLabel.textContent = yr;
          scroll.appendChild(yLabel);
        }
        const it = document.createElement("div");
        it.className = "bz-rail-item bz-diary-month";
        it.dataset.month = mk;
        const name = document.createElement("span");
        name.className = "bz-rail-name";
        name.textContent = `${Number(mk.slice(5))}月`;
        const cnt = document.createElement("span");
        cnt.className = "bz-rail-count";
        cnt.textContent = `${byMonth.get(mk).length} 条`;
        it.append(name, cnt);
        const strip = document.createElement("div");
        strip.className = "bz-diary-month-strip";
        byMonth.get(mk).map((e) => ({ e, m: e.media.find((x) => x.kind === "img" || x.kind === "video") })).filter((x) => x.m).slice(0, 5).forEach(({ e, m }) => strip.appendChild(this.thumbEl(m, e)));
        if (!strip.children.length) strip.style.display = "none";
        it.appendChild(strip);
        scroll.appendChild(it);
      });
      return scroll;
    }
    /** 瀑布流：按日期分节渲染（节头 sticky + 当日 masonry 容器；媒体卡/文字卡） */
    renderMasonry(ui, mobile, list) {
      const byDate = /* @__PURE__ */ new Map();
      list.forEach((e) => {
        const l = byDate.get(e.date);
        if (l) l.push(e);
        else byDate.set(e.date, [e]);
      });
      let widx = 0;
      let lastDate = null;
      list.forEach((e) => {
        if (e.date !== lastDate) {
          lastDate = e.date;
          const dayList = byDate.get(e.date);
          const head = document.createElement("div");
          head.className = "bz-diary-day-head";
          head.dataset.date = e.date;
          const date = document.createElement("span");
          date.className = "bz-diary-day-date";
          date.textContent = e.date;
          const week = document.createElement("span");
          week.className = "bz-diary-day-week";
          week.textContent = "周" + WEEK[(/* @__PURE__ */ new Date(e.date + "T00:00:00")).getDay()];
          const stat = document.createElement("span");
          stat.className = "bz-diary-day-stat";
          stat.innerHTML = this.statHtml(this.dayStats(dayList));
          head.append(date, week, stat);
          ui.wall.appendChild(head);
          const n = dayList.length;
          const sparseCls = n === 1 ? " bz-diary-masonry--sparse-1" : "";
          const m = document.createElement("div");
          m.className = "bz-diary-masonry" + (mobile ? " bz-diary-masonry--mob" : "") + sparseCls;
          ui.wall.appendChild(m);
        }
        const hasMedia = e.media.length > 0;
        const isLongText = (e.text || "").length >= WIDE_TEXT_MIN_CHARS;
        const container = ui.wall.lastChild;
        if (hasMedia || isLongText) {
          const item = document.createElement("div");
          item.className = "bz-diary-item bz-diary-media-wrap" + (isLongText ? " bz-diary-wide" : "");
          item.dataset.widx = String(widx);
          if (e.text) {
            const row = document.createElement("div");
            row.className = "bz-diary-text-row";
            const t = document.createElement("span");
            t.className = "bz-diary-text-t";
            t.textContent = e.time;
            const em = document.createElement("span");
            em.className = "bz-diary-text-em";
            em.textContent = e.emoji;
            row.append(t, em);
            const tx = document.createElement("div");
            tx.className = "bz-diary-text-tx bz-diary-md" + (isLongText ? " bz-diary-wide-md" : "");
            if (this.isEncHidden(e)) {
              tx.textContent = "（已加密）";
            } else {
              void this.renderText(tx, e.text, e);
            }
            item.append(row, tx);
          }
          if (isLongText) {
            if (e.media.length) {
              const grid = document.createElement("div");
              grid.className = "bz-diary-wide-media";
              e.media.forEach((k) => grid.appendChild(this.mediaEl(k, e, mobile)));
              item.appendChild(grid);
            }
          } else {
            e.media.forEach((k) => item.appendChild(this.mediaEl(k, e, mobile)));
          }
          this.bindItem(item, e, mobile);
          container.appendChild(item);
        } else {
          const item = this.textItem(e, e.text, widx);
          this.bindItem(item, e, mobile);
          container.appendChild(item);
        }
        widx++;
      });
    }
    /** 文字卡（时间 + emoji + markdown 正文；加密未解锁显示占位）——纯文字条目与段序渲染共用 */
    textItem(e, text, widx) {
      const item = document.createElement("div");
      item.className = "bz-diary-item bz-diary-text";
      item.dataset.widx = String(widx);
      const row = document.createElement("div");
      row.className = "bz-diary-text-row";
      const t = document.createElement("span");
      t.className = "bz-diary-text-t";
      t.textContent = e.time;
      const em = document.createElement("span");
      em.className = "bz-diary-text-em";
      em.textContent = e.emoji;
      row.append(t, em);
      const tx = document.createElement("div");
      tx.className = "bz-diary-text-tx bz-diary-md";
      if (this.isEncHidden(e)) {
        tx.textContent = "（已加密）";
      } else {
        void this.renderText(tx, text, e);
      }
      item.append(row, tx);
      return item;
    }
    /**
     * Markdown 渲染正文（支持 Obsidian 语法；sourcePath 用条目 filename 供链接解析）。
     * issue 215 三轮定位终版：真凶是 `await import('obsidian')` 动态导入——打包后插件
     * 环境解析不了裸模块名，导入即抛 TypeError（用户控制台 Failed to resolve module
     * specifier 'obsidian'），渲染从未开始、永远走纯文本回退。全仓仅此一处动态导入，
     * 改静态 import（diary/encrypt 域同款）；直挂已挂载容器、无超时、失败回退纯文本。
     */
    async renderText(container, md, e) {
      if (!md) {
        container.textContent = "";
        return;
      }
      try {
        const sourcePath = e.filename && e.filename.includes("/") ? e.filename : `${DIARY_DIRECTORY}/${e.date}.md`;
        const comp = new Component();
        try {
          container.textContent = "";
          await Promise.resolve(MarkdownRenderer.render(this.app(), md, container, sourcePath, comp));
        } finally {
          comp.unload();
        }
        if (container.isConnected && !container.firstChild) container.textContent = md;
      } catch (err) {
        if (container.isConnected) container.textContent = md;
        console.warn("[bz-diary] markdown 渲染失败，已回退纯文本", e.date, err);
      }
    }
    /** 条目级交互：移动端单击 → 抽屉；双击 → 跳转原文；右键 → 跟手上下文菜单（桌面）；加密隐藏时不弹 */
    bindItem(item, e, mobile) {
      let lastClick = 0;
      item.addEventListener("click", (ev) => {
        if (this.isEncHidden(e)) return;
        const now = Date.now();
        if (now - lastClick < DBLCLICK_WINDOW_MS) {
          lastClick = 0;
          void this.jumpTo(e);
          return;
        }
        lastClick = now;
        if (mobile) this.openSheet(e);
      });
    }
    /** 在瀑布容器上挂右键委托：正文/图片/视频任意子元素右键都能打开条目菜单（#9） */
    bindWallContext(wall, key) {
      if (this._ctxBound[key]) return;
      this._ctxBound[key] = true;
      wall.addEventListener(
        "contextmenu",
        (ev) => {
          const item = ev.target.closest(".bz-diary-item");
          if (!item) return;
          const idx = Number(item.dataset.widx);
          const e = this._wallEntries[idx];
          if (!e || Number.isNaN(idx)) return;
          if (this.isEncHidden(e)) return;
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          openItemMenu(ev.clientX, ev.clientY, this.buildMenuActions(e), true);
          resetItemMenuClickGuard();
        },
        true
      );
    }
    /** 双击跳转原文（普通日记走 entry-actions 标题锚点；加密/影视/信/书分流） */
    async jumpTo(e) {
      try {
        this.captureRestore();
        if (e.encrypted) {
          const { openEncrypt: openEncrypt2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
          openEncrypt2(this.app());
          this.hide();
          return;
        }
        if (e.kind === "book" && e.filename) {
          const file = this.app().vault.getAbstractFileByPath(e.filename);
          if (!file) {
            notice("找不到书文件", "error");
            return;
          }
          await this.app().workspace.openLinkText(file.path, "", false, { active: true });
          this.hide();
          return;
        }
        if ((e.kind === "movie" || e.kind === "letter") && e.filename && e.filename.includes("/")) {
          const file = this.app().vault.getAbstractFileByPath(e.filename);
          if (!file) {
            notice("找不到原文", "error");
            return;
          }
          await this.app().workspace.openLinkText(file.path, "", false, { active: true });
          this.hide();
          return;
        }
        await jumpToDiaryEntry({ filename: e.filename || e.date, emoji: e.emoji, time: e.time });
        this.hide();
      } catch (err) {
        notice("跳转失败", "error");
      }
    }
    /** 增强 #11：捕获当前墙视图状态（筛选 + 双实例滚动位置），show 恢复路径一次性消费 */
    captureRestore() {
      this._restore = {
        selTag: this.selTag,
        selSubTag: this.selSubTag,
        selDateFilter: this.selDateFilter ? { ...this.selDateFilter } : null,
        searchKeyword: this.searchKeyword,
        lockedVisible: this.lockedVisible,
        scrollTop: { desk: this.desk.wall.scrollTop, mob: this.mob.wall.scrollTop }
      };
    }
    /** 增强 #11：回墙恢复（loadAndRender 渲染完成后调；wall 有 scroll-behavior:smooth，临时关掉即时归位） */
    applyRestore() {
      const r = this._restore;
      if (!r) return;
      this._restore = null;
      [["desk", this.desk.wall], ["mob", this.mob.wall]].forEach(([key, wall]) => {
        const top = r.scrollTop[key];
        if (!top) return;
        wall.style.scrollBehavior = "auto";
        wall.scrollTop = top;
        wall.style.scrollBehavior = "";
      });
    }
    /** 特殊条目（影视/信/书）：整文件即条目，无日记 md 块语义（对齐旧面板 !special 语义） */
    isSpecialWallEntry(e) {
      return e.kind === "movie" || e.kind === "letter" || e.kind === "book";
    }
    /** 加密条目锁定态（encrypted 标志或「加密」标签，且保险箱未解锁）：正文显示占位、不响应动作 */
    isEncHidden(e) {
      return (e.encrypted || e.tags.includes("加密")) && !this.lockedVisible;
    }
    /**
     * 右键菜单动作集（core item-actions ItemAction 形制；顺序与旧自绘菜单逐项一致）：
     * 加密条目给「解密」（accent）；影视/信/书特殊条目不给「加密/删除」（对齐旧面板 !special 语义）；
     * 删除 danger。「在日记本中查看」随旧编辑面板退役（ADR-0115：墙即日记本）。
     */
    buildMenuActions(e) {
      const acts = [];
      const special = this.isSpecialWallEntry(e);
      acts.push({ icon: ACTION_ICON.open, label: "打开原文", onClick: () => void this.jumpTo(e) });
      acts.push({ icon: ACTION_ICON.copyLink, label: "复制双链", onClick: () => this.copyLink(e) });
      acts.push({ icon: ACTION_ICON.copyContent, label: "复制正文", onClick: () => this.copyContent(e) });
      if (!e.encrypted && !e.tags.includes("加密")) {
        acts.push({ icon: ACTION_ICON.editTags, label: "改标签", onClick: () => this.editTags(e) });
        if (!special) {
          acts.push({ icon: ACTION_ICON.encrypt, label: "加密", tone: "accent", onClick: () => void this.encryptEntryAction(e) });
        }
      } else {
        acts.push({ icon: ACTION_ICON.decrypt, label: "解密", tone: "accent", onClick: () => void this.decryptEntryAction(e) });
      }
      if (!special) {
        acts.push({ icon: ACTION_ICON.remove, label: "删除", kind: "danger", onClick: () => void this.deleteEntryAction(e) });
      }
      return acts;
    }
    /** 本地今天 YYYY-MM-DD（那年今天口径用） */
    todayStr() {
      return localDayKey();
    }
    /**
     * 增强 #5：那年今天时光条——mmdd 命中的历史媒体条目横滑条（wall 首屏顶部，独立块不打断瀑布流；
     * 调用方已过滤无媒体条目）。点击缩略 → 灯箱连看（与主墙灯箱同一序列外条目，单条目内步进）。
     */
    mkMemories(entries) {
      const box = document.createElement("div");
      box.className = "bz-diary-memories";
      const head = document.createElement("div");
      head.className = "bz-diary-memories-head";
      const ic = uiIcon("history");
      const t = document.createElement("span");
      t.textContent = "那年今天";
      head.append(ic, t);
      const row = document.createElement("div");
      row.className = "bz-diary-memories-row";
      entries.forEach((e) => {
        const cell = document.createElement("button");
        cell.className = "bz-diary-memory bz-touch-target--xl";
        cell.title = `${e.date} ${e.time}`;
        const thumb = document.createElement("div");
        thumb.className = "bz-diary-memory-thumb";
        const m = e.media[0];
        const src = this.mediaSrcFor(e, m.name);
        const isVid = m.kind === "video";
        if (isVid) {
          thumb.classList.add("bz-diary-memory-thumb--v");
          thumb.appendChild(uiIcon(ACTION_ICON.play));
        }
        if ((m.kind === "img" || isVid) && src) {
          const img = document.createElement("img");
          img.loading = "lazy";
          img.alt = e.date;
          const key = railThumbKey(e.date, m.name);
          const showThumb = (url) => {
            img.src = url;
            thumb.querySelectorAll("[data-icon]").forEach((ic2) => ic2.remove());
          };
          void getRailThumb(key).then((small) => {
            if (!img.isConnected) return;
            if (small) {
              showThumb(small);
              return;
            }
            if (isVid) {
              if (typeof IntersectionObserver === "undefined") return;
              void makeVideoThumb(src).then((t2) => {
                if (!t2) return;
                void putRailThumb(key, t2);
                if (img.isConnected) showThumb(t2);
              });
              return;
            }
            img.src = src;
            if (typeof IntersectionObserver !== "undefined") {
              void makeImageThumb(src).then((t2) => {
                if (t2) void putRailThumb(key, t2);
              });
            }
          });
          thumb.appendChild(img);
        } else if (m.kind === "audio") {
          thumb.appendChild(uiIcon(ACTION_ICON.music));
        }
        const year = document.createElement("span");
        year.className = "bz-diary-memory-year";
        year.textContent = e.date.slice(0, 4);
        cell.append(thumb, year);
        cell.addEventListener("click", () => {
          this._lbSeqMain = this._lbSeq;
          this._lbSeq = e.media.map((mm) => ({ entry: e, media: mm }));
          this.openLightbox(m, e);
        });
        row.appendChild(cell);
      });
      box.append(head, row);
      return box;
    }
    /** 空态 */
    mkEmpty() {
      const empty = document.createElement("div");
      empty.className = "bz-diary-empty";
      const ic = document.createElement("div");
      ic.className = "bz-diary-empty-ic";
      ic.appendChild(uiIcon("book-open"));
      const t = document.createElement("div");
      t.className = "bz-diary-empty-title";
      t.textContent = this.selTag ? "这个类型还没有记录" : "这一页还空着";
      const d = document.createElement("div");
      d.className = "bz-diary-empty-desc";
      d.textContent = "写下第一篇，或放上第一张照片";
      const b = document.createElement("button");
      b.className = "bz-diary-empty-btn";
      b.textContent = "写第一篇";
      b.addEventListener("click", () => {
        this.openAddEntry();
      });
      empty.append(ic, t, d, b);
      return empty;
    }
    // ---------- 媒体构建（视口懒加载） ----------
    /** 媒体 URL：带 sourcePath 解析（日记条目 → 我的/日记/日期.md；影视/信/书 → filename 完整路径），修复纯文件名全局解析失败 */
    mediaSrcFor(entry, name) {
      const src = entry.kind === "diary" ? `${DIARY_DIRECTORY}/${entry.date}.md` : entry.filename || "";
      return mediaSrc(this.app(), name, src);
    }
    /** 媒体块（图片/视频/音频 + 渐变占位 + 描述；无 emoji 角标——用户要求去掉） */
    mediaEl(k, entry, mobile) {
      const wrap = document.createElement("div");
      wrap.className = "bz-diary-media" + (k.kind === "audio" ? " bz-diary-media--audio" : "");
      if (k.kind !== "audio") wrap.style.aspectRatio = k.kind === "video" ? "16 / 9" : this.mediaAspect(entry, k.name);
      const ph = document.createElement("div");
      ph.className = "bz-diary-ph";
      if (k.kind === "audio") {
        ph.appendChild(uiIcon(ACTION_ICON.music));
        ph.style.fontSize = "28px";
      }
      wrap.appendChild(ph);
      if (k.kind === "img") {
        const img = document.createElement("img");
        img.alt = k.name;
        img.style.opacity = "0";
        if (entry.encrypted) {
          img.dataset.enc = "1";
          img.dataset.encName = k.name;
          img.dataset.encKind = k.kind;
          if (entry.noteId) img.dataset.encNote = entry.noteId;
        } else {
          const src = this.mediaSrcFor(entry, k.name);
          if (src) {
            img.dataset.lazy = src;
            img.onload = () => {
              ph.style.opacity = "0";
              img.style.opacity = "1";
            };
            img.onerror = () => {
              ph.style.opacity = "1";
            };
          }
        }
        wrap.appendChild(img);
      } else if (k.kind === "video") {
        const v = document.createElement("video");
        v.muted = true;
        v.preload = "none";
        v.playsInline = true;
        if (entry.encrypted) {
          v.dataset.enc = "1";
          v.dataset.encName = k.name;
          v.dataset.encKind = k.kind;
          if (entry.noteId) v.dataset.encNote = entry.noteId;
        } else {
          const src = this.mediaSrcFor(entry, k.name);
          if (src) v.dataset.src = src;
        }
        v.onerror = () => {
          ph.style.opacity = "1";
        };
        wrap.appendChild(v);
        const play = document.createElement("div");
        play.className = "bz-diary-play";
        play.appendChild(uiIcon(ACTION_ICON.play));
        wrap.appendChild(play);
        const dur = document.createElement("span");
        dur.className = "bz-diary-dur";
        dur.appendChild(uiIcon(ACTION_ICON.play));
        wrap.appendChild(dur);
      }
      if (k.name) {
        const cap = document.createElement("div");
        cap.className = "bz-diary-cap";
        cap.innerHTML = mediaCapHtml(entry);
        wrap.appendChild(cap);
      }
      wrap.addEventListener("click", (e) => {
        e.stopPropagation();
        if (mobile) this.openSheet(entry);
        else this.openLightbox(k, entry);
      });
      wrap.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (mobile) return;
        if (this.isEncHidden(entry)) return;
        if (this.lbVisible()) this.closeLightbox();
        void this.jumpTo(entry);
      });
      return wrap;
    }
    /**
     * 增强 #8：加密媒体按需解密（保险箱附件镜像 → 原始层 base64 → data URL）。
     * 带缓存（含失败结果——避免渲染风暴下反复解密）；未解锁/无附件/解密失败返回 null（保持占位）。
     */
    encMediaUrl(noteId, k) {
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
      try {
        const { getSafeManager: getSafeManager2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
        const safe = getSafeManager2();
        if (!safe.unlocked || !safe.manifest) return null;
        const note = safe.manifest.notes.find((n) => n.id === noteId);
        if (!note) return null;
        const att = note.attachments.find((a) => a.path === k.name || a.path.endsWith("/" + k.name));
        if (!att) return null;
        const b64 = await safe.decryptAttachmentOriginal(att);
        if (!b64) return null;
        return `data:${mimeOfMediaName(k.name)};base64,${b64}`;
      } catch (e) {
        return null;
      }
    }
    /** 增强 #8：懒加载挂载点调用——解密并点亮单个加密媒体元素（dataset.enc 系列标记） */
    async mountEncMedia(el) {
      var _a;
      const name = el.dataset.encName || "";
      const kind = el.dataset.encKind || "img";
      const noteId = el.dataset.encNote || "";
      const url = await this.encMediaUrl(noteId, { name, kind });
      if (!el.isConnected) return;
      const ph = (_a = el.parentElement) == null ? void 0 : _a.querySelector(".bz-diary-ph");
      if (!url) {
        if (ph) ph.style.opacity = "1";
        return;
      }
      if (el.tagName === "IMG") {
        const img = el;
        img.onload = () => {
          if (ph) ph.style.opacity = "0";
          img.style.opacity = "1";
        };
        img.onerror = () => {
          if (ph) ph.style.opacity = "1";
        };
        img.src = url;
      } else if (el.tagName === "VIDEO") {
        const v = el;
        v.src = url;
        v.preload = "metadata";
        this.bindVideoDuration(v);
      }
    }
    /** 媒体宽高比稳定散列：按条目日期+媒体名派生（DW7——全局递增 seed 双实例/重渲染下漂移） */
    mediaAspect(entry, name) {
      const h = hash31(`${entry.date}|${name}`);
      return h % 3 === 0 ? "1 / 1" : "4 / 3";
    }
    /**
     * 章节栏缩略图（issue 210/212）：调用方保证只传图片/视频媒体。
     * 渲染时零加载——图片挂 data-thumb-src 占位、视频挂 data-src 占位，
     * 交 setupRailLazy 进视口才走「查小图缓存 → 命中贴 48px 小图 / 未命中压图回存」，
     * 20px 小格永不触发原图整张解码（issue 212 卡顿病根）。
     *
     * 视频格不出现播放角标（用户 2026-09-10 明确要求）：格内始终只有一个视觉主体——
     * 小图就绪前是 --v 的 teal 渐变底（自身即「这是视频」的标记），就绪后直接贴小图。
     */
    thumbEl(m, entry) {
      const t = document.createElement("span");
      t.className = "bz-diary-month-thumb" + (m.kind === "video" ? " bz-diary-month-thumb--v" : "");
      const src = entry.encrypted ? "" : this.mediaSrcFor(entry, m.name);
      if (!src) {
        if (entry.encrypted && entry.noteId) {
          t.dataset.thumbEnc = "1";
          t.dataset.encName = m.name;
          t.dataset.encKind = m.kind;
          t.dataset.encNote = entry.noteId;
          t.dataset.thumbKey = railThumbKey(entry.date, m.name);
        }
        if (m.kind !== "video") t.appendChild(uiIcon(ACTION_ICON.image));
        return t;
      }
      if (m.kind === "video") {
        const v = document.createElement("video");
        v.muted = true;
        v.preload = "none";
        v.dataset.src = src;
        v.dataset.thumbKey = railThumbKey(entry.date, m.name);
        t.appendChild(v);
      } else {
        const img = document.createElement("img");
        img.decoding = "async";
        img.dataset.thumbSrc = src;
        img.dataset.thumbKey = railThumbKey(entry.date, m.name);
        img.addEventListener("error", () => {
          img.remove();
          if (!t.querySelector("img")) t.appendChild(uiIcon(ACTION_ICON.image));
        });
        t.appendChild(img);
      }
      return t;
    }
    /**
     * 章节栏缩略懒加载（issue 212，机制沿 issue 209/210）：root = 章节栏滚动容器，
     * 进视口才挂载。图片/视频统一走小图缓存：命中贴 48px dataURL（零原图解码）；
     * 未命中后台压图回存后贴小图，压缩失败回退直挂原 src（旧行为）。
     * 无 IO 环境（jsdom/旧内核）直接按未命中路径挂载，保证测试确定性。
     */
    setupRailLazy(rail, key) {
      if (this.railObservers[key]) this.railObservers[key].disconnect();
      const scroller = rail.querySelector(".bz-rail-scroll") || rail;
      const thumbs = Array.from(
        rail.querySelectorAll("img[data-thumb-src], video[data-src], [data-thumb-enc]")
      );
      if (typeof IntersectionObserver === "undefined") {
        thumbs.forEach((el) => {
          if (el.tagName === "VIDEO") this.hydrateRailVideo(el);
          else if (el.tagName === "IMG") el.src = el.dataset.thumbSrc;
        });
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            const el = en.target;
            if (en.isIntersecting) {
              this.hydrateRailThumb(el);
            } else {
              const v = el;
              if (el.tagName === "VIDEO" && !v.paused) v.pause();
            }
          });
        },
        { root: scroller, rootMargin: "120px 0px 120px 0px", threshold: 0 }
      );
      thumbs.forEach((el) => io.observe(el));
      this.railObservers[key] = io;
    }
    /**
     * 章节栏缩略格挂载：查缓存贴小图 / 后台压图回存；失败回退原 src 直挂（视频 = 旧行为读首帧）。
     * data-thumb-src 挂载后即移除，防重复触发。
     */
    hydrateRailThumb(el) {
      if (el.dataset.thumbEnc === "1") {
        delete el.dataset.thumbEnc;
        const key2 = el.dataset.thumbKey;
        const name = el.dataset.encName || "";
        const kind = el.dataset.encKind || "img";
        const noteId = el.dataset.encNote || "";
        void this.encMediaUrl(noteId, { name, kind }).then((url) => {
          if (!el.isConnected || !url) return;
          this.hydrateThumbViaCache(el, url, key2, kind === "video");
        });
        return;
      }
      const isVideo = el.tagName === "VIDEO";
      const key = el.dataset.thumbKey;
      if (isVideo) {
        const v = el;
        const src = v.dataset.src;
        if (!src || v.getAttribute("src")) return;
        this.hydrateThumbViaCache(el, src, key, true);
      } else {
        const img = el;
        const src = img.dataset.thumbSrc;
        if (!src) return;
        img.removeAttribute("data-thumb-src");
        this.hydrateThumbViaCache(el, src, key, false);
      }
    }
    /** 查小图缓存 → 命中贴图；未命中后台压图回存；压缩失败回退原 src（视频 = 旧读首帧行为） */
    hydrateThumbViaCache(el, src, key, isVideo) {
      if (!key) {
        if (isVideo && el.tagName === "VIDEO") this.hydrateRailVideo(el);
        else if (!isVideo && el.tagName === "IMG") el.src = src;
        return;
      }
      void getRailThumb(key).then((cached) => {
        if (cached) {
          this.swapThumbToImg(el, cached);
          return;
        }
        void (isVideo ? makeVideoThumb(src) : makeImageThumb(src)).then((small) => {
          if (small) {
            void putRailThumb(key, small);
            this.swapThumbToImg(el, small);
            return;
          }
          if (isVideo && el.tagName === "VIDEO") this.hydrateRailVideo(el);
          else if (!isVideo && el.tagName === "IMG") el.src = src;
        });
      });
    }
    /**
     * 缩略格换成小图（图片/视频/加密格三路共用）。
     * 播放角标只在「还没有图」时当占位——小图一落地就撤掉（用户 2026-09-10 要求：
     * 章节栏视频图上不要再压一个播放图标）。
     * 载体两种：加密格 el 是 span（自身即格）；其余 el 是格内的 img/video 元素。
     */
    swapThumbToImg(el, dataUrl) {
      const img = document.createElement("img");
      img.src = dataUrl;
      img.decoding = "async";
      const cell = el.tagName === "SPAN" ? el : el.parentElement;
      if (!cell) return;
      cell.querySelectorAll("[data-icon]").forEach((ic) => ic.remove());
      const cur = cell.querySelector("img, video");
      if (cur) cell.replaceChild(img, cur);
      else cell.appendChild(img);
    }
    /**
     * 章节栏视频缩略挂载（issue 210 旧行为，现为压缩失败兜底）：data-src → src。
     * preload 必须是 auto：`metadata` 只到 readyState=1，浏览器不解码帧，格子永远是空的
     * （与 issue 212 的 loadeddata 取帧全黑同一实测结论）。元素在 IO 离开视口时 pause，
     * 真实用途是「压缩管线失败时至少还看得到首帧」。
     */
    hydrateRailVideo(v) {
      const src = v.dataset.src;
      if (!src || v.getAttribute("src")) return;
      v.setAttribute("src", src);
      delete v.dataset.src;
      v.preload = "auto";
    }
    // ---------- 视口懒加载控制器 ----------
    /** DW9：视频元数据就绪后把时长角标从 ▶ 换成真实 mm:ss（preload=metadata 读首帧元数据时触发） */
    bindVideoDuration(v) {
      v.addEventListener("loadedmetadata", () => {
        var _a;
        const dur = (_a = v.parentElement) == null ? void 0 : _a.querySelector(".bz-diary-dur");
        if (!dur || !Number.isFinite(v.duration) || v.duration <= 0) return;
        const m = Math.floor(v.duration / 60);
        const s = Math.round(v.duration % 60);
        dur.textContent = `${m}:${String(s).padStart(2, "0")}`;
      }, { once: true });
    }
    /** 懒加载挂载：普通媒体挂 src；加密媒体触发按需解密（增强 #8；fallback 与 IO 命中共用） */
    hydrateMediaEl(el) {
      const lazySrc = el.dataset.lazy;
      if (lazySrc && el.tagName === "IMG" && !el.getAttribute("src")) {
        el.setAttribute("src", lazySrc);
        delete el.dataset.lazy;
      }
      const vidSrc = el.dataset.src;
      if (el.tagName === "VIDEO" && vidSrc && el.getAttribute("src") === null) {
        el.setAttribute("src", vidSrc);
        delete el.dataset.src;
        const v = el;
        v.preload = "metadata";
        this.bindVideoDuration(v);
      }
      if (el.dataset.enc === "1") {
        delete el.dataset.enc;
        void this.mountEncMedia(el);
      }
    }
    setupLazy(wall, key) {
      if (this.observers[key]) this.observers[key].disconnect();
      if (typeof IntersectionObserver === "undefined") {
        wall.querySelectorAll("img[data-lazy], video[data-src], [data-enc]").forEach((el) => {
          this.hydrateMediaEl(el);
        });
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            const el = en.target;
            if (en.isIntersecting) {
              this.hydrateMediaEl(el);
            } else {
              const v = el;
              if (el.tagName === "VIDEO" && !v.paused) v.pause();
            }
          });
        },
        { root: wall, rootMargin: "200px 0px 200px 0px", threshold: 0 }
      );
      wall.querySelectorAll("img[data-lazy], video[data-src], [data-enc]").forEach((el) => io.observe(el));
      this.observers[key] = io;
    }
    // ---------- 滚动 → 章节自动高亮 ----------
    /**
     * 章节点击：平滑滚动定位到该月的第一个 day-head（不重渲染、不切过滤）。
     * P2/G 审查修复：day-head 是 sticky 吸顶头，月份滚过后 rect 恒贴墙顶，rect 差值
     * 推不出目标位置（点已滚过的月份 no-op）——改用 flowTopOf 流式位置推算（见下），
     * 定位仍不依赖 offsetTop（content-visibility 的屏外占位高度不可靠），smooth 滚动
     * 途中条目陆续真渲染导致文档流漂移，落定后按最终几何校正一次（DW6 保留）。
     */
    scrollToMonth(mk, wall) {
      const head = wall.querySelector(`.bz-diary-day-head[data-date^="${mk}"]`);
      if (!head) return;
      const wallRect = wall.getBoundingClientRect();
      const top = wall.scrollTop + (this.flowTopOf(head, wallRect) - 6);
      wall.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      if (this._scrollFixTimer !== null) clearTimeout(this._scrollFixTimer);
      this._scrollFixTimer = setTimeout(() => {
        var _a;
        this._scrollFixTimer = null;
        if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
        const h = wall.querySelector(`.bz-diary-day-head[data-date^="${mk}"]`);
        if (!h) return;
        const t2 = wall.scrollTop + (this.flowTopOf(h, wall.getBoundingClientRect()) - 6);
        if (Math.abs(t2 - wall.scrollTop) > 2) wall.scrollTo({ top: Math.max(0, t2) });
      }, SCROLL_FIX_DELAY_MS);
    }
    /**
     * 节头的流式相对位置（相对墙体顶）：节头是 sticky，滚过后自身 rect 不再反映流式位置；
     * 其后的 masonry 容器不是 sticky，rect 即流式真实位置——用 masonry 顶 − 节头高反推。
     * 无后续块（防御）时回退节头自身 rect 差值。
     */
    flowTopOf(head, wallRect) {
      const next = head.nextElementSibling;
      if (next && !next.classList.contains("bz-diary-day-head")) {
        return next.getBoundingClientRect().top - wallRect.top - head.offsetHeight;
      }
      return head.getBoundingClientRect().top - wallRect.top;
    }
    /** 滚动高亮：rAF 节流，当前月份在章节栏高亮并滚到可见。
     *  与 scrollToMonth 同口径用 getBoundingClientRect 差值（content-visibility 下 offsetTop 不可靠，P2-1 审查修复）。
     *  ADR-0094：滚动容器收敛为 .bz-rail 内的 .bz-rail-scroll（共享族结构）。
     *  2026-09-10：绑定后立即 schedule 一次——旧实现只挂 scroll 监听，开墙不滚动就一个月份
     *  都不亮（用户要求「打开日记本默认高亮当前月份」）。 */
    setupRailHighlight(wall, rail, key) {
      const scroller = rail.querySelector(".bz-rail-scroll") || rail;
      const rafFn = (cb) => typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : setTimeout(() => cb(0), 16);
      const cafFn = (h) => {
        if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(h);
        else clearTimeout(h);
      };
      let rafId = null;
      const sync = () => {
        const headEls = wall.querySelectorAll(".bz-diary-day-head");
        if (!headEls.length) return;
        const wallRect = wall.getBoundingClientRect();
        const items = Array.from(headEls, (h) => ({
          date: h.dataset.date,
          relTop: h.getBoundingClientRect().top - wallRect.top
        }));
        let currentMonth = pickCurrentMonth(items);
        if (!currentMonth) currentMonth = items[0].date.slice(0, 7);
        rail.querySelectorAll(".bz-diary-month").forEach((it) => {
          it.classList.toggle("on", it.getAttribute("data-month") === currentMonth);
        });
        const active = rail.querySelector(`.bz-diary-month[data-month="${currentMonth}"]`);
        if (active) {
          const railRect = scroller.getBoundingClientRect();
          const actRect = active.getBoundingClientRect();
          if (actRect.top < railRect.top || actRect.bottom > railRect.bottom) {
            scroller.scrollTop += actRect.top - railRect.top - (scroller.clientHeight - actRect.height) / 2;
          }
        }
      };
      const schedule = () => {
        if (rafId !== null) return;
        rafId = rafFn(() => {
          rafId = null;
          sync();
        });
      };
      wall.addEventListener("scroll", schedule, { passive: true });
      this.rafCleanups[key] = () => {
        wall.removeEventListener("scroll", schedule);
        if (rafId !== null) {
          cafFn(rafId);
          rafId = null;
        }
      };
      schedule();
    }
    teardownScrollers(key) {
      if (this.rafCleanups[key]) {
        this.rafCleanups[key]();
        this.rafCleanups[key] = null;
      }
      if (this.observers[key]) {
        this.observers[key].disconnect();
        this.observers[key] = null;
      }
      if (this.railObservers[key]) {
        this.railObservers[key].disconnect();
        this.railObservers[key] = null;
      }
    }
    // ---------- 灯箱 ----------
    /** 打开灯箱：定位连看序列下标后展示（增强 #1；找不到 = 非墙内入口，退化为单条序列） */
    openLightbox(k, entry) {
      let idx = this._lbSeq.findIndex((s) => s.entry === entry && s.media.name === k.name && s.media.kind === k.kind);
      if (idx === -1) {
        this._lbSeq = [{ entry, media: k }];
        idx = 0;
      }
      this.showLightboxAt(idx);
    }
    /**
     * 展示连看序列第 idx 项（到头循环——与移动端滑动、桌面按钮、方向键同一口径）。
     * P3 审查修复保留：只填充当前端实例（另一实例 lbMedia 保持为空，无双份加载/播放）。
     */
    showLightboxAt(idx) {
      const seq = this._lbSeq;
      if (!seq.length) return;
      const n = seq.length;
      this._lbIdx = (idx % n + n) % n;
      const { entry, media: k } = seq[this._lbIdx];
      this.pauseLbMedia();
      const mobileNow = typeof matchMedia === "function" && matchMedia("(max-width: 768px)").matches;
      this.fillLbMedia(mobileNow ? this.mob.lbMedia : this.desk.lbMedia, k, entry);
      const cap = lbCaption(entry);
      const sub = lbSubText(entry);
      this.desk.lbCap.textContent = cap;
      this.desk.lbSub.textContent = sub;
      this.mob.lbCap.textContent = cap;
      this.mob.lbSub.textContent = sub;
      if (mobileNow) this.mob.lb.classList.add("bz-diary-lb--show");
      else this.desk.lb.classList.add("bz-diary-lb--show");
    }
    /** 停掉双实例灯箱内正在播放的媒体（切换/关闭前调用） */
    pauseLbMedia() {
      [this.desk, this.mob].forEach((ui) => {
        ui.lbMedia.querySelectorAll("video, audio").forEach((m) => {
          try {
            m.pause();
          } catch (e) {
          }
        });
      });
    }
    /** 灯箱加载失败占位（lucide 图标 + 文字） */
    mkLbErr(k) {
      const d = document.createElement("div");
      d.className = "bz-diary-lberr";
      d.appendChild(uiIcon(KIND_ICON[k.kind]));
      d.appendChild(document.createTextNode(" 无法加载"));
      return d;
    }
    /** 构建灯箱媒体元素（真实 src；视频/音频 controls + autoplay） */
    mkLbMediaEl(k, src) {
      if (k.kind === "img") {
        const img = document.createElement("img");
        img.src = src;
        img.alt = k.name;
        img.className = "bz-diary-lb-media";
        return img;
      }
      if (k.kind === "video") {
        const v = document.createElement("video");
        v.src = src;
        v.controls = true;
        v.autoplay = true;
        v.className = "bz-diary-lb-media";
        return v;
      }
      const a = document.createElement("audio");
      a.src = src;
      a.controls = true;
      a.autoplay = true;
      a.className = "bz-diary-lb-media";
      return a;
    }
    /**
     * 填充单个实例的灯箱媒体容器：
     * - 普通条目：mediaSrc 同步解析，onerror 换失败占位；
     * - 加密条目（增强 #8）：先占位，按需解密保险箱附件原图后异步替换；未解锁/失败保持失败占位。
     */
    fillLbMedia(box, k, entry) {
      box.innerHTML = "";
      if (entry.encrypted) {
        const pend = document.createElement("div");
        pend.className = "bz-diary-lb-pending";
        box.appendChild(pend);
        void this.encMediaUrl(entry.noteId || "", k).then((url) => {
          if (!box.isConnected) return;
          box.innerHTML = "";
          if (!url) {
            box.appendChild(this.mkLbErr(k));
            return;
          }
          box.appendChild(this.mkLbMediaEl(k, url));
        });
        return;
      }
      const src = this.mediaSrcFor(entry, k.name);
      if (!src) {
        box.appendChild(this.mkLbErr(k));
        return;
      }
      const el = this.mkLbMediaEl(k, src);
      el.addEventListener("error", () => {
        if (!box.isConnected) return;
        box.innerHTML = "";
        box.appendChild(this.mkLbErr(k));
      });
      box.appendChild(el);
    }
    closeLightbox() {
      this.pauseLbMedia();
      [this.desk, this.mob].forEach((ui) => {
        ui.lb.classList.remove("bz-diary-lb--show");
        ui.lbMedia.innerHTML = "";
      });
      if (this._lbSeqMain) {
        this._lbSeq = this._lbSeqMain;
        this._lbSeqMain = null;
      }
      this._lbIdx = -1;
    }
    // ---------- 条目动作（复制/改标签/加密/删除；自包含前复用 diary 域） ----------
    async copyLink(e) {
      try {
        if (e.encrypted) {
          await navigator.clipboard.writeText(e.content || e.text || "");
          notice("已复制加密日记正文", "success");
          return;
        }
        if (this.isSpecialWallEntry(e)) {
          if (!e.filename) {
            notice("找不到原文，无法复制双链", "error");
            return;
          }
          await navigator.clipboard.writeText(`[[${stripMdExt(e.filename)}]]`);
          notice("已复制双链引用", "success");
          return;
        }
        await copyDiaryLink({ filename: e.filename || e.date, emoji: e.emoji, time: e.time });
      } catch (err) {
        notice("复制双链失败", "error");
      }
    }
    async copyContent(e) {
      try {
        await navigator.clipboard.writeText(e.content || e.text || "");
        notice("已复制日记正文", "success");
      } catch (err) {
        notice("复制失败", "error");
      }
    }
    /** 改标签：接本域 showTagPicker（filename+lineNumber 定位，写层守卫落盘；结果经域事件回刷本墙） */
    async editTags(e) {
      try {
        showTagPicker({
          filename: e.filename || e.date,
          date: e.date,
          time: e.time,
          lineNumber: e.lineNumber || 0,
          tags: e.tags,
          encrypted: e.encrypted,
          noteId: e.noteId
        });
      } catch (err) {
        notice("改标签暂不可用", "error");
      }
    }
    /** 加密：本域 encryptEntry（需保险箱解锁）+ 写层摘除原块；结果经域事件回刷本墙 */
    async encryptEntryAction(e) {
      try {
        if (this.isSpecialWallEntry(e)) return;
        const { ensureSafeUnlocked: ensureSafeUnlocked2 } = await Promise.resolve().then(() => (init_encrypt(), encrypt_exports));
        const unlocked = await ensureSafeUnlocked2();
        if (!unlocked) return;
        const filename = e.filename || e.date;
        const entry = await findDiaryEntry(filename, e.lineNumber || 0);
        if (!entry) {
          notice("找不到原文条目，无法加密", "error");
          return;
        }
        const enc = await encryptEntry(entry);
        if (enc) {
          const removed = await removeDiaryEntries(entry.date, (x) => x.time === entry.time && x.lineNumber === entry.lineNumber);
          if (removed === 0) {
            notice("加密失败：原文块摘除未生效", "error");
            return;
          }
          notice("已加密移入保险箱", "success");
          void this.loadAndRender();
        }
      } catch (err) {
        if (err && isUnparsedRefusal(err)) return;
        notice("加密失败", "error");
      }
    }
    /** 解密：本域 reclassifyEntry 降级（还原块 merge 回 md，取出即删） */
    async decryptEntryAction(e) {
      try {
        const noteId = e.noteId;
        if (!noteId) {
          notice("无法解密（缺少保险箱记录）", "error");
          return;
        }
        const newTags = e.tags.filter((t) => t !== "加密");
        const ok = await reclassifyEntry(noteId, newTags);
        if (ok) {
          notice("已解密还原", "success");
          void this.loadAndRender();
        } else {
          notice("解密失败：主密码可能不正确，密文未受影响", "error");
        }
      } catch (err) {
        notice("解密失败：主密码可能不正确，密文未受影响", "error");
      }
    }
    /** 删除：接本域 showConfirm 流程（加密条目走保险箱销毁分支） */
    async deleteEntryAction(e) {
      try {
        if (this.isSpecialWallEntry(e)) {
          notice("影视、信、书条目请在对应面板中管理", "info");
          return;
        }
        showConfirm({
          filename: e.filename || e.date,
          date: e.date,
          time: e.time,
          lineNumber: e.lineNumber || 0,
          tags: e.tags,
          encrypted: e.encrypted,
          noteId: e.noteId
        });
      } catch (err) {
        notice("删除暂不可用", "error");
      }
    }
    // ---------- 底部抽屉（移动端单击条目弹出；壳 = 共享 .bz-sheet 族） ----------
    openSheet(e) {
      this.sheetEntry = e;
      [this.desk, this.mob].forEach((ui) => {
        ui.sheetEmoji.textContent = e.emoji;
        ui.sheetTime.textContent = `${e.date}  ${e.time}  ·  ${e.tags.join(" ")}`;
        ui.sheetContent.textContent = stripMediaLinks(e.content) || "（仅媒体）";
        this.fillSheetMedia(ui, e);
        this.fillSheetActions(ui, e);
        ui.sheet.classList.add("bz-sheet--show");
        ui.sheetMask.classList.add("open");
      });
    }
    /** 抽屉媒体缩略（点击进灯箱；加密条目缩略图走按需解密——增强 #8） */
    fillSheetMedia(ui, e) {
      const mbox = ui.sheetMedia;
      mbox.innerHTML = "";
      e.media.forEach((k) => {
        const mt = document.createElement("div");
        mt.className = "bz-diary-sheet-thumb";
        const src = this.mediaSrcFor(e, k.name);
        if (k.kind === "img") {
          const img = document.createElement("img");
          img.alt = k.name;
          if (e.encrypted) {
            void this.encMediaUrl(e.noteId || "", k).then((url) => {
              if (url && img.isConnected) img.src = url;
            });
          } else if (src) {
            img.src = src;
          }
          mt.appendChild(img);
        } else {
          mt.appendChild(uiIcon(k.kind === "video" ? ACTION_ICON.play : ACTION_ICON.music));
        }
        mt.addEventListener("click", () => this.openLightbox(k, e));
        mbox.appendChild(mt);
      });
    }
    /** 抽屉动作行 = 共享 .bz-sheet-act（icon + 文案 + 右侧小字；danger/accent 语义档） */
    fillSheetActions(ui, e) {
      const acts = ui.sheetActions;
      acts.innerHTML = "";
      const mk = (icon, label, sub, mod, fn) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-sheet-act" + (mod ? " " + mod : "");
        const ic = document.createElement("span");
        ic.className = "bz-sheet-act-ic";
        ic.appendChild(uiIcon(icon));
        b.appendChild(ic);
        b.appendChild(document.createTextNode(label));
        if (sub) {
          const subEl = document.createElement("span");
          subEl.className = "bz-sheet-act-sub";
          subEl.textContent = sub;
          b.appendChild(subEl);
        }
        b.addEventListener("click", fn);
        acts.appendChild(b);
      };
      mk(ACTION_ICON.open, "打开", null, null, () => {
        this.closeSheet();
        void this.jumpTo(e);
      });
      mk(ACTION_ICON.copyLink, "复制双链", null, null, () => {
        this.closeSheet();
        void this.copyLink(e);
      });
      mk(ACTION_ICON.copyContent, "复制正文", `${(e.content || "").trim().length} 字`, null, () => {
        this.closeSheet();
        void this.copyContent(e);
      });
      if (e.media.length) {
        mk(ACTION_ICON.attachment, "附件", `${e.media.length} 个媒体`, null, () => {
          this.closeSheet();
          notice(`附件：${e.media.map((m) => m.name).join("、")}`);
        });
      }
      const special = this.isSpecialWallEntry(e);
      if (!e.encrypted && !e.tags.includes("加密")) {
        mk(ACTION_ICON.editTags, "改标签", null, null, () => {
          this.closeSheet();
          this.editTags(e);
        });
        if (!special) {
          mk(ACTION_ICON.encrypt, "加密", null, "bz-sheet-act--accent", () => {
            this.closeSheet();
            void this.encryptEntryAction(e);
          });
        }
      } else {
        mk(ACTION_ICON.decrypt, "解密", null, "bz-sheet-act--accent", () => {
          this.closeSheet();
          void this.decryptEntryAction(e);
        });
      }
      if (!special) {
        mk(ACTION_ICON.remove, "删除", null, "bz-sheet-act--danger", () => {
          this.closeSheet();
          void this.deleteEntryAction(e);
        });
      }
    }
    closeSheet() {
      [this.desk, this.mob].forEach((ui) => {
        ui.sheet.classList.remove("bz-sheet--show");
        ui.sheetMask.classList.remove("open");
      });
      this.sheetEntry = null;
    }
    bindSheet() {
      [this.desk, this.mob].forEach((ui) => {
        ui.sheet.addEventListener("click", (e) => {
          if (e.target === ui.sheet) this.closeSheet();
        });
        ui.sheetMask.addEventListener("click", () => this.closeSheet());
      });
    }
    // ---------- 统计 ----------
    dayStats(list) {
      return dayStats(list);
    }
    statHtml(s) {
      return statHtml(s);
    }
    // ---------- ESC ----------
    registerEscape() {
      this.escUnregister = escManager.register("diary", {
        isVisible: () => !!this.root && this.root.style.display === "flex",
        close: () => {
          if (this._dateFilterEl) {
            this.closeDateFilter();
            return;
          }
          if ([this.desk, this.mob].some((u) => u.sheet.classList.contains("bz-sheet--show"))) {
            this.closeSheet();
            return;
          }
          if ([this.desk, this.mob].some((u) => u.lb.classList.contains("bz-diary-lb--show"))) {
            this.closeLightbox();
            return;
          }
          this.hide();
        }
      });
    }
    // ---------- 显示/隐藏 ----------
    /** 幂等初始化（ensureElements 创建 DOM + 绑定事件） */
    async init() {
      if (this._initialized) return;
      this.ensureElements();
    }
    /** 打开日记本：加载数据并渲染 */
    async openManager() {
      await this.init();
      this.show();
    }
    show() {
      if (!this._initialized) this.ensureElements();
      this.root.style.display = "flex";
      topifyZ(this.root);
      this.subscribeVaultModify();
      this.subscribeUnlockEvents();
      this.subscribeWriteEvents();
      void this.loadAndRender().then(() => this.applyRestore());
    }
    hide() {
      if (!this.root) return;
      this.closeDateFilter();
      this.closeLightbox();
      this.closeSheet();
      closeItemMenu();
      this.root.style.display = "none";
      this.unsubscribeVaultModify();
      this.unsubscribeUnlockEvents();
      this.unsubscribeWriteEvents();
    }
    /**
     * 写链路域事件回刷（issue 256）：entry-added/tags-changed/entry-deleted/entry-decrypted/
     * encrypted-purged/file-vacated 六通道防抖 loadAndRender——写日记命令（域外弹窗保存）、
     * recap 写回、整文件删除（vault 只发 delete 无 modify，DW3 通道收不到）等路径统一收口。
     */
    subscribeWriteEvents() {
      if (this._writeOff) return;
      const chs = [
        "diary:entry-added",
        "diary:tags-changed",
        "diary:entry-deleted",
        "diary:entry-decrypted",
        "diary:encrypted-purged",
        "diary:file-vacated"
      ];
      const offs = chs.map(
        (ch) => onDomainEvent(ch, () => {
          var _a;
          if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
          if (this._modifyTimer !== null) clearTimeout(this._modifyTimer);
          this._modifyTimer = setTimeout(() => {
            var _a2;
            this._modifyTimer = null;
            if (((_a2 = this.root) == null ? void 0 : _a2.style.display) !== "flex") return;
            void this.loadAndRender();
          }, MODIFY_REFRESH_DEBOUNCE_MS);
        })
      );
      this._writeOff = () => offs.forEach((off) => off());
    }
    unsubscribeWriteEvents() {
      if (this._writeOff) {
        this._writeOff();
        this._writeOff = null;
      }
    }
    /**
     * 增强 #9：订阅保险箱解锁状态（encrypt:unlock-changed 域事件，复用既有 channel 不动 encrypt 域）。
     * - 上锁（unlocked=false）：加密条目实时回不可见——剔除条目、清锁定筛选态、收灯箱/抽屉/菜单；
     * - 解锁（unlocked=true）：并入加密日记（默认仍隐藏，点「加密」chip 查看；已可见则媒体可按需解密）。
     */
    subscribeUnlockEvents() {
      if (this._unlockOff) return;
      this._unlockOff = onDomainEvent("encrypt:unlock-changed", (evt) => {
        if (!evt || !evt.unlocked) this.relockWallMedia();
        else void this.onSafeUnlockedWhileOpen();
      });
    }
    unsubscribeUnlockEvents() {
      if (this._unlockOff) {
        this._unlockOff();
        this._unlockOff = null;
      }
    }
    /** 上锁：加密内容实时归位（不可见）——增强 #9 主路径 */
    relockWallMedia() {
      const hadEnc = this.entries.some((x) => x.encrypted);
      this.lockedVisible = false;
      this.entries = this.entries.filter((x) => !x.encrypted);
      this.encMediaCache.clear();
      if (this.selTag === "加密") {
        this.selTag = null;
        this.selSubTag = null;
      }
      this.closeLightbox();
      this.closeSheet();
      closeItemMenu();
      if (hadEnc) this.renderAll();
    }
    /** 墙开着时解锁：并入加密条目（lockedVisible 不自动置真——默认仍按锁定态隐藏） */
    async onSafeUnlockedWhileOpen() {
      var _a;
      if (((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
      await this.mergeEncryptedEntries();
      this.renderAll();
    }
    /** DW3：vault modify 自动刷新（clipbook 同款模式）——墙开着时日记/影视/信/书被编辑 → 防抖重读重渲染；
     *  只关心四个数据源目录（config 常量）；隐藏期不订阅不刷新。 */
    subscribeVaultModify() {
      if (this._modifyRef) return;
      const dirs = [DIARY_DIRECTORY, MOVIE_DIRECTORY, LETTER_DIRECTORY, BOOK_DIRECTORY];
      this._modifyRef = this.app().vault.on("modify", (file) => {
        var _a;
        const p = file == null ? void 0 : file.path;
        if (!p || ((_a = this.root) == null ? void 0 : _a.style.display) !== "flex") return;
        if (!dirs.some((d) => p.startsWith(d + "/") || p === d + ".md")) return;
        if (this._modifyTimer !== null) clearTimeout(this._modifyTimer);
        this._modifyTimer = setTimeout(() => {
          var _a2;
          this._modifyTimer = null;
          if (((_a2 = this.root) == null ? void 0 : _a2.style.display) !== "flex") return;
          void this.loadAndRender();
        }, MODIFY_REFRESH_DEBOUNCE_MS);
      });
    }
    unsubscribeVaultModify() {
      if (this._modifyRef) {
        try {
          this.app().vault.offref(this._modifyRef);
        } catch (e) {
        }
        this._modifyRef = null;
      }
      if (this._modifyTimer !== null) {
        clearTimeout(this._modifyTimer);
        this._modifyTimer = null;
      }
    }
    /** 加载数据并渲染（openManager 主路径） */
    async loadAndRender() {
      try {
        this.entries = await loadWallEntries(this.app());
      } catch (e) {
        this.entries = [];
        notice("加载日记失败：" + (e && e.message ? e.message : String(e)), "error");
      }
      await this.mergeEncryptedEntries();
      this.renderAll();
    }
    // ---------- 头部动作（写日记 / 搜索 / 日期选择器） ----------
    /** 写日记：本域 openAddDialog（滚轮年份动态范围取自当前数据，UX-34） */
    openAddEntry() {
      var _a;
      try {
        openAddDialog({ yearRange: (_a = this.getYearRange()) != null ? _a : void 0 });
      } catch (e) {
        notice("写日记暂不可用：" + (e instanceof Error ? e.message : String(e)), "error");
      }
    }
    /** 当前数据的滚轮年份动态范围（UX-34；无数据返回 null → 控件回落 1900～当前年+1） */
    getYearRange() {
      let earliest = null;
      for (const entry of this.entries) {
        const y = parseInt(String(entry.date).split("-")[0], 10);
        if (!Number.isNaN(y) && (earliest === null || y < earliest)) earliest = y;
      }
      if (earliest === null) return null;
      return { min: Math.max(1900, earliest), max: (/* @__PURE__ */ new Date()).getFullYear() + 1 };
    }
    /** 标题点击 → 回忆墙自包含日期选择器（按年份/月份过滤本域数据；不再调 diary showDatePicker——那是 diary 面板的 filter） */
    openDatePicker() {
      var _a, _b;
      this.showDateFilter((_b = (_a = this.selDateFilter) == null ? void 0 : _a.year) != null ? _b : this.defaultFilterYear());
    }
    /**
     * 打开时的默认浏览年份 = 当前年份（用户要求「打开日期筛选默认选中当前年份」）。
     * 当前年若没有任何数据（跨年空窗），回落最新有数据的年份——否则月份网格不渲染，
     * 打开只剩一句提示。
     */
    defaultFilterYear() {
      const years = Array.from(new Set(this.entries.map((e) => e.date.slice(0, 4))));
      if (!years.length) return null;
      const now = String((/* @__PURE__ */ new Date()).getFullYear());
      return years.includes(now) ? now : years.sort((a, b) => b.localeCompare(a))[0];
    }
    /** 显示日期筛选弹窗：viewYear 只是「正在浏览的年份」临时值（P2 审查修复：
     *  旧实现点年份即写入 selDateFilter，ESC 关闭后筛选已悄悄生效）。
     *  只有点月份或「全部」才提交筛选。 */
    showDateFilter(viewYear) {
      this.closeDateFilter();
      this._dateFilterEl = this.mkDateFilter(viewYear);
      document.body.appendChild(this._dateFilterEl);
      topifyZ(this._dateFilterEl);
      this._dateFilterEl.style.display = "flex";
    }
    /** 自绘日期筛选弹窗（年份行 + 月份网格 + 全部/关闭）；viewYear 为正在浏览的年份临时值 */
    mkDateFilter(viewYear) {
      var _a;
      const wrap = document.createElement("div");
      wrap.className = "bz-diary-datefilter";
      const card = document.createElement("div");
      card.className = "bz-diary-datefilter-card";
      const years = Array.from(new Set(this.entries.map((e) => e.date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
      const cur = this.selDateFilter;
      const activeYear = (_a = viewYear != null ? viewYear : cur == null ? void 0 : cur.year) != null ? _a : null;
      const head = document.createElement("div");
      head.className = "bz-diary-datefilter-head";
      const title = document.createElement("div");
      title.className = "bz-diary-datefilter-title";
      title.textContent = "按日期筛选";
      head.appendChild(title);
      if (cur) {
        const resetBtn = document.createElement("button");
        resetBtn.className = "bz-diary-datefilter-reset";
        resetBtn.textContent = "全部";
        resetBtn.addEventListener("click", () => {
          this.selDateFilter = null;
          this.closeDateFilter();
          this.renderAll();
        });
        head.appendChild(resetBtn);
      }
      const closeBtn = document.createElement("button");
      closeBtn.className = "bz-diary-datefilter-close";
      closeBtn.title = "关闭";
      closeBtn.appendChild(uiIcon("x"));
      closeBtn.addEventListener("click", () => this.closeDateFilter());
      head.appendChild(closeBtn);
      card.appendChild(head);
      const yearLabel = document.createElement("div");
      yearLabel.className = "bz-diary-datefilter-label";
      yearLabel.textContent = "年份";
      card.appendChild(yearLabel);
      const yearRow = document.createElement("div");
      yearRow.className = "bz-diary-datefilter-years";
      const yearCount = /* @__PURE__ */ new Map();
      this.entries.forEach((e) => {
        const y = e.date.slice(0, 4);
        yearCount.set(y, (yearCount.get(y) || 0) + 1);
      });
      years.forEach((y) => {
        const b = document.createElement("button");
        b.className = "bz-diary-datefilter-year" + (activeYear === y ? " bz-diary-datefilter-year--on" : "");
        b.dataset.year = y;
        b.innerHTML = `<span class="bz-diary-datefilter-year-name">${y}</span><span class="bz-diary-datefilter-year-cnt">${yearCount.get(y) || 0}</span>`;
        b.addEventListener("click", () => {
          this.showDateFilter(y);
        });
        yearRow.appendChild(b);
      });
      card.appendChild(yearRow);
      if (viewYear && years.includes(viewYear)) {
        const monthLabel = document.createElement("div");
        monthLabel.className = "bz-diary-datefilter-label";
        monthLabel.textContent = "月份";
        card.appendChild(monthLabel);
        const monthRow = document.createElement("div");
        monthRow.className = "bz-diary-datefilter-months";
        const monthCounts = /* @__PURE__ */ new Map();
        this.entries.filter((e) => e.date.startsWith(viewYear)).forEach((e) => {
          const m = e.date.slice(5, 7);
          monthCounts.set(m, (monthCounts.get(m) || 0) + 1);
        });
        for (let i = 1; i <= 12; i++) {
          const ms = String(i).padStart(2, "0");
          const cnt = monthCounts.get(ms) || 0;
          const isOn = (cur == null ? void 0 : cur.year) === viewYear && cur.month === ms;
          const cardEl = document.createElement("button");
          cardEl.className = "bz-diary-datefilter-month" + (cnt === 0 ? " bz-diary-datefilter-month--empty" : "") + (isOn ? " bz-diary-datefilter-month--on" : "");
          cardEl.innerHTML = `<span class="bz-diary-datefilter-month-name">${i}月</span><span class="bz-diary-datefilter-month-cnt">${cnt || ""}</span>`;
          cardEl.addEventListener("click", () => {
            if (cnt === 0) return;
            this.selDateFilter = { year: viewYear, month: ms };
            this.closeDateFilter();
            this.renderAll();
          });
          monthRow.appendChild(cardEl);
        }
        card.appendChild(monthRow);
      } else {
        const hint = document.createElement("div");
        hint.className = "bz-diary-datefilter-hint";
        hint.textContent = "点击年份查看该年各月";
        card.appendChild(hint);
      }
      wrap.appendChild(card);
      wrap.addEventListener("click", (e) => {
        if (e.target === wrap) this.closeDateFilter();
      });
      return wrap;
    }
    closeDateFilter() {
      if (this._dateFilterEl) {
        this._dateFilterEl.remove();
        this._dateFilterEl = null;
      }
    }
    /** 搜索：toggle 搜索框（桌面/移动各一），输入过滤；打开/收起同步按钮高亮态 */
    toggleSearch(ui) {
      const row = ui.searchRow;
      const box = ui.searchBox;
      const btn = ui.head.querySelector('[data-act="search"]');
      if (!row || !box) return;
      const other = ui === this.desk ? this.mob : this.desk;
      if (row.style.display === "none") {
        row.style.display = "block";
        box.value = this.searchKeyword;
        box.focus();
        box.select();
        btn == null ? void 0 : btn.classList.add("bz-diary-icon-btn--on");
      } else {
        row.style.display = "none";
        box.value = "";
        this.searchKeyword = "";
        if (other == null ? void 0 : other.searchBox) other.searchBox.value = "";
        this.renderAll();
        btn == null ? void 0 : btn.classList.remove("bz-diary-icon-btn--on");
      }
    }
    /** App 实例（生产由主实现注入；测试 setApp——diary/app.ts 单例，与 diary 域同口径） */
    app() {
      return getApp();
    }
    // ---------- 卸载 ----------
    cleanup() {
      var _a;
      this.closeDateFilter();
      closeItemMenu();
      this.teardownScrollers("desk");
      this.teardownScrollers("mob");
      this.unsubscribeVaultModify();
      this.unsubscribeUnlockEvents();
      this.unsubscribeWriteEvents();
      document.removeEventListener("keydown", this._onLbKeydown);
      if (this._mql && this._onMqChange) {
        this._mql.removeEventListener("change", this._onMqChange);
        this._mql = null;
        this._onMqChange = null;
      }
      if (this._scrollFixTimer !== null) {
        clearTimeout(this._scrollFixTimer);
        this._scrollFixTimer = null;
      }
      (_a = this.escUnregister) == null ? void 0 : _a.unregister();
      this.escUnregister = null;
      this._ctxBound = { desk: false, mob: false };
      this._wallEntries = [];
      this._lbSeq = [];
      this._lbSeqMain = null;
      this._lbIdx = -1;
      this._restore = null;
      this.encMediaCache.clear();
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

  // src/diary/index.ts
  var initialized2 = false;
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
    createAddDialog();
  }
  function openDiary(app) {
    void ensureDiary(app).then(() => getController2().show());
  }
  function openDiaryWrite(app) {
    void ensureDiary(app).then(() => {
      var _a;
      openAddDialog({ yearRange: (_a = getController2().getYearRange()) != null ? _a : void 0 });
    });
  }
  function unloadDiary() {
    if (controller2) controller2.cleanup();
    controller2 = null;
    initialized2 = false;
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
/*! Bundled license information:

moment/moment.js:
  (*! moment.js *)
  (*! version : 2.30.1 *)
  (*! authors : Tim Wood, Iskren Chernev, Moment.js contributors *)
  (*! license : MIT *)
  (*! momentjs.com *)
*/
