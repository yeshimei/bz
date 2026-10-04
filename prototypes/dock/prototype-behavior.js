/* 源指纹 175c9410ccdee87f · 仓内输入 58 个（校验见 tests/preview-freshness.test.ts） */
/*#preview-inputs=["prototypes/dock/fake-sim.ts","prototypes/dock/fake/fake-obsidian.ts","src/core/app.ts","src/core/dom.ts","src/core/domain-bus.ts","src/core/esc-manager.ts","src/core/external-tool.ts","src/core/flow-dialog.ts","src/core/http.ts","src/core/item-actions.ts","src/core/mobile.ts","src/core/notice.ts","src/core/path-picker.ts","src/core/settings-provider.ts","src/core/storage.ts","src/core/ui/button.ts","src/core/ui/cardpick.ts","src/core/ui/chip.ts","src/core/ui/choice.ts","src/core/ui/empty.ts","src/core/ui/field.ts","src/core/ui/focus-trap.ts","src/core/ui/help-tip.ts","src/core/ui/icon.ts","src/core/ui/icons.ts","src/core/ui/index.ts","src/core/ui/lightbox.ts","src/core/ui/mainhead.ts","src/core/ui/mobstrip.ts","src/core/ui/modal.ts","src/core/ui/popover.ts","src/core/ui/progress.ts","src/core/ui/rail.ts","src/core/ui/resize.ts","src/core/ui/search.ts","src/core/ui/segmented.ts","src/core/ui/select.ts","src/core/ui/setlist.ts","src/core/ui/slider.ts","src/core/ui/splitter.ts","src/core/ui/stat.ts","src/core/ui/str.ts","src/core/ui/suggest.ts","src/core/ui/switch.ts","src/core/utils.ts","src/core/z-order.ts","src/dock/command.ts","src/dock/data.ts","src/dock/declaration.ts","src/dock/index.ts","src/dock/registry.ts","src/dock/rules.ts","src/dock/runner.ts","src/dock/schedule.ts","src/dock/scheduler.ts","src/dock/schema.ts","src/dock/store.ts","src/dock/ui.ts"]*/
/* 构建产物（勿手改）：node scripts/build-preview.mjs — prototypes/dock/fake-sim.ts → window.BZW_dock（行为单源预览包，issue 245/ADR-0106） */
var BZW_dock = (() => {
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
        var YEAR = 0, MONTH = 1, DATE = 2, HOUR2 = 3, MINUTE = 4, SECOND = 5, MILLISECOND = 6, WEEK = 7, WEEKDAY = 8;
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
        addParseToken(["H", "HH"], HOUR2);
        addParseToken(["k", "kk"], function(input, array, config) {
          var kInput = toInt(input);
          array[HOUR2] = kInput === 24 ? 0 : kInput;
        });
        addParseToken(["a", "A"], function(input, array, config) {
          config._isPm = config._locale.isPM(input);
          config._meridiem = input;
        });
        addParseToken(["h", "hh"], function(input, array, config) {
          array[HOUR2] = toInt(input);
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR2] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR2] = toInt(input.substr(0, pos1));
          array[MINUTE] = toInt(input.substr(pos1, 2));
          array[SECOND] = toInt(input.substr(pos2));
          getParsingFlags(config).bigHour = true;
        });
        addParseToken("Hmm", function(input, array, config) {
          var pos = input.length - 2;
          array[HOUR2] = toInt(input.substr(0, pos));
          array[MINUTE] = toInt(input.substr(pos));
        });
        addParseToken("Hmmss", function(input, array, config) {
          var pos1 = input.length - 4, pos2 = input.length - 2;
          array[HOUR2] = toInt(input.substr(0, pos1));
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
            overflow = a[MONTH] < 0 || a[MONTH] > 11 ? MONTH : a[DATE] < 1 || a[DATE] > daysInMonth(a[YEAR], a[MONTH]) ? DATE : a[HOUR2] < 0 || a[HOUR2] > 24 || a[HOUR2] === 24 && (a[MINUTE] !== 0 || a[SECOND] !== 0 || a[MILLISECOND] !== 0) ? HOUR2 : a[MINUTE] < 0 || a[MINUTE] > 59 ? MINUTE : a[SECOND] < 0 || a[SECOND] > 59 ? SECOND : a[MILLISECOND] < 0 || a[MILLISECOND] > 999 ? MILLISECOND : -1;
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
        function defaults2(a, b, c) {
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
            yearToUse = defaults2(config._a[YEAR], currentDate[YEAR]);
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
          if (config._a[HOUR2] === 24 && config._a[MINUTE] === 0 && config._a[SECOND] === 0 && config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR2] = 0;
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
            config._a[HOUR2] = 24;
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
            weekYear = defaults2(
              w.GG,
              config._a[YEAR],
              weekOfYear(createLocal(), 1, 4).year
            );
            week = defaults2(w.W, 1);
            weekday = defaults2(w.E, 1);
            if (weekday < 1 || weekday > 7) {
              weekdayOverflow = true;
            }
          } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;
            curWeek = weekOfYear(createLocal(), dow, doy);
            weekYear = defaults2(w.gg, config._a[YEAR], curWeek.year);
            week = defaults2(w.w, curWeek.week);
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
          if (config._a[HOUR2] <= 12 && getParsingFlags(config).bigHour === true && config._a[HOUR2] > 0) {
            getParsingFlags(config).bigHour = void 0;
          }
          getParsingFlags(config).parsedDateParts = config._a.slice(0);
          getParsingFlags(config).meridiem = config._meridiem;
          config._a[HOUR2] = meridiemFixWrap(
            config._locale,
            config._a[HOUR2],
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
              h: toInt(match[HOUR2]) * sign2,
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

  // prototypes/dock/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootDockSim: () => bootDockSim,
    closeDockPanel: () => closeDock,
    openDockPanel: () => openDockPanel,
    resetDockSim: () => resetDockSim,
    unloadDockSim: () => unloadDockSim
  });

  // prototypes/dock/fake/fake-obsidian.ts
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768,
    isDesktop: true,
    isDesktopApp: true,
    isMobileApp: false
  };
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.DOCK_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  var FakeVault = class _FakeVault {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          var _a;
          if (!e.key || !e.key.startsWith("bz-sim:")) return;
          const path = e.key.slice("bz-sim:".length);
          for (const cb of (_a = this.listeners.get("modify")) != null ? _a : []) cb({ path });
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
    on(evt, cb) {
      var _a, _b;
      if (!this.listeners.has(evt)) this.listeners.set(evt, []);
      this.listeners.get(evt).push(cb);
      return { ref: (_b = (_a = crypto.randomUUID) == null ? void 0 : _a.call(crypto)) != null ? _b : String(Math.random()) };
    }
    offref(_ref) {
      this.listeners.clear();
    }
  };
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
    }
  };

  // src/core/app.ts
  var _app = null;
  function setApp(app2) {
    _app = app2;
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
  function saveSettings() {
    return _saver ? _saver() : Promise.resolve();
  }
  function tryGetSettings() {
    return _provider ? _provider() : {};
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
    const live3 = els.filter((el2) => !!el2);
    if (live3.length === 0) return;
    const base = allocZBlock(live3.length);
    live3.forEach((el2, i) => {
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

  // src/core/dom.ts
  function longPress(el2, cb, dur, filter) {
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
    el2.addEventListener("mousedown", start);
    el2.addEventListener("mouseup", endFromMouse);
    el2.addEventListener("mouseleave", endFromMouse);
    el2.addEventListener("touchstart", start, { passive: true });
    el2.addEventListener("touchend", endFromTouch);
    el2.addEventListener("touchmove", move, { passive: true });
    el2.addEventListener("touchcancel", endFromTouch);
    el2.addEventListener("click", onClick, true);
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

  // src/core/path-picker.ts
  var systemPickerImpl = null;
  function setSystemFolderPicker(fn) {
    systemPickerImpl = fn;
  }
  function requireNode(moduleName) {
    var _a;
    try {
      const w = window;
      return w.require ? (_a = w.require(moduleName)) != null ? _a : null : null;
    } catch (e) {
      return null;
    }
  }
  function normalizeSystemPath(p) {
    const s = String(p != null ? p : "").trim().replace(/\\/g, "/");
    return s.length > 1 ? s.replace(/\/+$/, "") : s;
  }
  function parentDirOf(filePath) {
    const s = String(filePath).replace(/\\/g, "/");
    const i = s.lastIndexOf("/");
    return i <= 0 ? s : s.slice(0, i);
  }
  function fileDiskPath(f) {
    var _a, _b;
    const legacy = f.path;
    if (typeof legacy === "string" && legacy) return legacy;
    const webUtils = (_a = requireNode("electron")) == null ? void 0 : _a.webUtils;
    if (webUtils == null ? void 0 : webUtils.getPathForFile) {
      try {
        return String((_b = webUtils.getPathForFile(f)) != null ? _b : "");
      } catch (e) {
      }
    }
    return "";
  }
  function pickDirViaInput() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.style.display = "none";
      document.body.appendChild(input);
      let settled = false;
      const finish = (v) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("focus", onFocus);
        input.remove();
        resolve(v);
      };
      const onFocus = () => {
        window.setTimeout(() => {
          var _a;
          const f = (_a = input.files) == null ? void 0 : _a[0];
          if (!f) finish(null);
        }, 200);
      };
      input.addEventListener("change", () => {
        var _a;
        const f = (_a = input.files) == null ? void 0 : _a[0];
        const p = f ? fileDiskPath(f) : "";
        finish(p ? parentDirOf(p) : null);
      });
      window.addEventListener("focus", onFocus);
      input.click();
    });
  }
  async function nativePickSystemFolder() {
    var _a, _b, _c, _d;
    const remote = (_c = (_b = requireNode("@electron/remote")) != null ? _b : (_a = requireNode("electron")) == null ? void 0 : _a.remote) != null ? _c : null;
    const dialog = remote == null ? void 0 : remote.dialog;
    if (dialog == null ? void 0 : dialog.showOpenDialog) {
      const res = await dialog.showOpenDialog({
        title: "选择文件夹",
        properties: ["openDirectory", "dontAddToRecent"]
      });
      const picked = (_d = res == null ? void 0 : res.filePaths) == null ? void 0 : _d[0];
      if (picked && !(res == null ? void 0 : res.canceled)) return normalizeSystemPath(picked);
      return null;
    }
    return pickDirViaInput();
  }
  async function pickSystemFolder() {
    try {
      const pick = systemPickerImpl != null ? systemPickerImpl : nativePickSystemFolder;
      const dir = await pick();
      return dir ? normalizeSystemPath(dir) : null;
    } catch (e) {
      notifyActionError(e, "选择文件夹");
      return null;
    }
  }
  async function pickSystemFiles(title, filters) {
    var _a, _b, _c, _d;
    const remote = (_c = (_b = requireNode("@electron/remote")) != null ? _b : (_a = requireNode("electron")) == null ? void 0 : _a.remote) != null ? _c : null;
    const dialog = remote == null ? void 0 : remote.dialog;
    if (!(dialog == null ? void 0 : dialog.showOpenDialog)) return [];
    try {
      const res = await dialog.showOpenDialog({
        title,
        properties: ["openFile", "multiSelections", "dontAddToRecent"],
        // Electron 认 extensions 字段（PickFilesFilter.ext 是域侧叫法，这里做一次映射）
        filters: filters.map((f) => ({ name: f.name, extensions: f.ext }))
      });
      if (res == null ? void 0 : res.canceled) return [];
      return ((_d = res == null ? void 0 : res.filePaths) != null ? _d : []).map((p) => normalizeSystemPath(p)).filter(Boolean);
    } catch (e) {
      notifyActionError(e, "选择文件");
      return [];
    }
  }

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
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
  function firstFocusable(container) {
    const list = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el2) => {
      if (isHidden(el2)) return false;
      if (isMobileEnv()) {
        const tag = el2.tagName;
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

  // src/core/ui/icon.ts
  function uiIcon(name, extraClass = "") {
    const i = document.createElement("span");
    i.className = "bz-ic" + (extraClass ? " " + extraClass : "");
    setIcon(i, name);
    return i;
  }

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

  // src/core/ui/chip.ts
  function uiChip(opts) {
    const c = document.createElement("button");
    c.type = "button";
    const cls = ["bz-chip"];
    const pressed = opts.selected !== void 0 ? !!opts.selected : opts.selectedSoft !== void 0 ? !!opts.selectedSoft : null;
    if (opts.selected) cls.push("bz-chip--on");
    else if (opts.selectedSoft) cls.push("bz-chip--sel");
    if (opts.locked) cls.push("bz-chip--locked");
    c.className = cls.join(" ");
    if (pressed !== null) c.setAttribute("aria-pressed", String(pressed));
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
  function isLabelable(ctrl) {
    const tag = ctrl.tagName;
    if (tag === "BUTTON" || tag === "SELECT" || tag === "TEXTAREA") return true;
    if (tag === "INPUT") return ctrl.type !== "hidden";
    return false;
  }
  function uiField(opts) {
    const wrap = isLabelable(opts.control) ? document.createElement("label") : document.createElement("div");
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

  // src/core/ui/choice.ts
  function uiChoice(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-choice" + (opts.float ? " bz-choice--float" : "") + (opts.className ? " " + opts.className : "");
    el2.setAttribute("role", "radiogroup");
    el2.setAttribute("aria-label", opts.label || "");
    const btns = /* @__PURE__ */ new Map();
    let cur = opts.value;
    const seg = document.createElement("span");
    seg.className = "bz-choice-seg";
    let segRAF = 0;
    let segTries = 0;
    const syncSeg = (animate) => {
      if (!opts.float) return;
      const on = el2.querySelector(".bz-choice-btn.is-on");
      if (!on) return;
      const tb = el2.getBoundingClientRect();
      const bb = on.getBoundingClientRect();
      if (!el2.isConnected || !tb.width || !bb.width) {
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
    const onWinResize = () => {
      if (!el2.isConnected) {
        window.removeEventListener("resize", onWinResize);
        return;
      }
      syncSeg(false);
    };
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
      el2.appendChild(b);
    });
    if (opts.float) el2.appendChild(seg);
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
    return { el: el2, setValue, detach };
  }

  // src/core/ui/switch.ts
  function uiSwitch(opts) {
    const el2 = document.createElement("span");
    el2.className = "bz-sw" + (opts.checked ? " on" : "") + (opts.disabled ? " is-disabled" : "");
    el2.setAttribute("role", "switch");
    el2.setAttribute("aria-checked", String(!!opts.checked));
    el2.setAttribute("aria-disabled", String(!!opts.disabled));
    el2.tabIndex = opts.disabled ? -1 : 0;
    const setChecked = (v) => {
      el2.classList.toggle("on", v);
      el2.setAttribute("aria-checked", String(v));
    };
    const setDisabled = (v) => {
      el2.classList.toggle("is-disabled", v);
      el2.setAttribute("aria-disabled", String(v));
      el2.tabIndex = v ? -1 : 0;
    };
    const enabled = () => !el2.classList.contains("is-disabled");
    const toggle = () => {
      var _a;
      if (!enabled()) return;
      const next = !el2.classList.contains("on");
      setChecked(next);
      (_a = opts.onChange) == null ? void 0 : _a.call(opts, next);
    };
    el2.addEventListener("click", toggle);
    el2.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        toggle();
      }
    });
    return { el: el2, setChecked, setDisabled };
  }

  // src/core/ui/select.ts
  function uiSelect(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-select" + (opts.className ? " " + opts.className : "");
    el2.setAttribute("role", "listbox");
    el2.setAttribute("aria-expanded", "false");
    el2.tabIndex = 0;
    const val = document.createElement("span");
    val.className = "bz-select-val";
    el2.appendChild(val);
    el2.appendChild(uiIcon("chevron-down", "bz-select-car"));
    let current = opts.value;
    let menu = null;
    let escHandle2 = null;
    const labelOf = (v) => {
      const o = opts.options.find((x) => x.value === v);
      return o ? o.label : "";
    };
    const renderVal = () => {
      val.textContent = labelOf(current) || opts.placeholder || "";
    };
    renderVal();
    const close = (notify2 = true) => {
      var _a;
      if (menu) {
        menu.remove();
        menu = null;
      }
      if (escHandle2) {
        escHandle2.unregister();
        escHandle2 = null;
      }
      el2.classList.remove("open");
      el2.setAttribute("aria-expanded", "false");
      if (notify2) (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, false);
    };
    const open = () => {
      var _a;
      close(false);
      el2.classList.add("open");
      el2.setAttribute("aria-expanded", "true");
      (_a = opts.onOpenChange) == null ? void 0 : _a.call(opts, true);
      const m = document.createElement("div");
      m.className = "bz-select-menu";
      m.setAttribute("role", "listbox");
      menu = m;
      opts.options.forEach((o, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "bz-select-item" + (o.value === current ? " is-on" : "");
        b.setAttribute("role", "option");
        b.setAttribute("aria-selected", String(o.value === current));
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
      el2.appendChild(m);
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
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const mRect = m.getBoundingClientRect();
      const need = mRect.height || m.offsetHeight;
      const spaceBelow = vh - mRect.bottom;
      if (need > 0 && spaceBelow < need && spaceBelow < mRect.top) {
        m.classList.add("is-flip-up");
      }
      escHandle2 = escManager.register("bz-ui-select", {
        isVisible: () => !!menu && menu.isConnected,
        close: () => close()
      });
    };
    const setValue = (v) => {
      current = v;
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
      const curIdx = opts.options.findIndex((o) => o.value === current);
      const nextIdx = Math.min(opts.options.length - 1, Math.max(0, (curIdx < 0 ? 0 : curIdx) + delta));
      opts.options.forEach((o, i) => {
        const item = menu == null ? void 0 : menu.querySelectorAll(".bz-select-item")[i];
        if (!item) return;
        const on = i === nextIdx;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-selected", String(on));
      });
    };
    el2.addEventListener("click", () => {
      if (menu) close();
      else open();
    });
    el2.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (menu) {
          const on = menu == null ? void 0 : menu.querySelector(".bz-select-item.is-on");
          if (on && on !== el2) {
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
        e.stopPropagation();
        close();
      }
    });
    const onDocClick = (e) => {
      if (menu && !el2.contains(e.target)) close();
    };
    document.addEventListener("click", onDocClick);
    return {
      el: el2,
      setValue,
      detach: () => {
        document.removeEventListener("click", onDocClick);
        close(false);
      }
    };
  }

  // src/core/ui/search.ts
  function uiSearch(opts) {
    const el2 = document.createElement("div");
    el2.className = "bz-search";
    el2.appendChild(uiIcon("search"));
    const input = uiInput({
      placeholder: opts.placeholder,
      value: opts.value,
      onInput: opts.onInput
    });
    el2.appendChild(input);
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
      el2.appendChild(clearBtn);
    }
    const syncClear = () => {
      if (clearBtn) clearBtn.hidden = !input.value.trim();
    };
    const setValue = (v) => {
      input.value = v;
      syncClear();
    };
    return { el: el2, input, setValue, syncClear };
  }

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
  var liveModals = /* @__PURE__ */ new Set();
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
    let escHandle2 = null;
    const releaseTrap = focusEnabled ? trapFocus(popup) : null;
    function close() {
      var _a2;
      if (closed) return;
      closed = true;
      liveModals.delete(close);
      releaseTrap == null ? void 0 : releaseTrap();
      mask.remove();
      escHandle2 == null ? void 0 : escHandle2.unregister();
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
    escHandle2 = escManager.register("bz-modal", {
      isVisible: () => mask.isConnected,
      close: attemptClose
    });
    document.body.appendChild(mask);
    if (focusEnabled) (_a = firstFocusable(popup)) == null ? void 0 : _a.focus();
    liveModals.add(close);
    return { mask, popup, close };
  }

  // src/core/utils.ts
  var import_moment = __toESM(require_moment());

  // src/core/ui/str.ts
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

  // src/core/utils.ts
  function escapeHtml(str3) {
    return str3.replace(/[&<>"']/g, (m) => {
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
    const html = "<h4>" + escapeHtml(title || "确认") + "</h4><p>" + escapeHtml(message).replace(/\n/g, "<br>") + '</p><div class="confirm-actions">' + buttons.map((b) => {
      const clsAttr = b.className ? ' class="' + b.className + '"' : "";
      return '<button id="' + b.id + '"' + clsAttr + ">" + escapeHtml(b.label) + "</button>";
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
      const escHandle2 = escManager.register("q3-confirm", {
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
        escHandle2.unregister();
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
  async function diskPathExists(app2, p) {
    var _a, _b, _c;
    try {
      return !!await ((_c = (_b = (_a = app2.vault) == null ? void 0 : _a.adapter) == null ? void 0 : _b.exists) == null ? void 0 : _c.call(_b, p));
    } catch (e) {
      return false;
    }
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
  async function backupOriginal(app2, filePath, raw) {
    try {
      const f = app2.vault.getAbstractFileByPath(filePath);
      const content = raw !== void 0 ? raw : f ? await app2.vault.read(f) : void 0;
      if (content === void 0) return null;
      if (!app2.vault.getAbstractFileByPath(CORRUPT_BACKUP_DIR)) {
        try {
          await app2.vault.createFolder(CORRUPT_BACKUP_DIR);
        } catch (e) {
        }
      }
      const base = baseNameOf(filePath);
      const stamp = corruptStamp();
      let backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}.bak`;
      for (let i = 2; app2.vault.getAbstractFileByPath(backupPath); i++) {
        backupPath = `${CORRUPT_BACKUP_DIR}/${base}.${stamp}-${i}.bak`;
      }
      await app2.vault.create(backupPath, content);
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
  async function readFromDisk(app2, filePath) {
    const raw = await app2.vault.adapter.read(filePath);
    return raw.charCodeAt(0) === 65279 ? raw.substring(1) : raw;
  }
  function jsonFileStore(filePath, opts = {}) {
    const resolveApp = () => opts.app || getApp();
    const resolveDefault = () => {
      const d = opts.defaultValue;
      return typeof d === "function" ? d() : d === void 0 ? [] : d;
    };
    async function ensureDir(app2) {
      const d = filePath.substring(0, filePath.lastIndexOf("/"));
      if (!d || app2.vault.getAbstractFileByPath(d)) return;
      if (await diskPathExists(app2, d)) return;
      try {
        await app2.vault.createFolder(d);
      } catch (e) {
        if (await diskPathExists(app2, d)) return;
        throw e;
      }
    }
    async function createIfMissing(app2, content) {
      await ensureDir(app2);
      try {
        await app2.vault.create(filePath, content);
        return true;
      } catch (e) {
        if (isAlreadyExistsError(e) && (app2.vault.getAbstractFileByPath(filePath) || await diskPathExists(app2, filePath)))
          return false;
        throw e;
      }
    }
    async function handleCorrupt(app2, err, raw) {
      var _a;
      if (((_a = opts.onCorrupt) == null ? void 0 : _a.call(opts, filePath, err)) === false) {
        return null;
      }
      const backupPath = await backupOriginal(app2, filePath, raw);
      if (backupPath && !opts.onCorrupt) notifyBackup(filePath, backupPath, "解析失败");
      const f = app2.vault.getAbstractFileByPath(filePath);
      if (f) {
        await app2.vault.modify(f, serialize(resolveDefault()));
      } else if (await diskPathExists(app2, filePath)) {
        await app2.vault.adapter.write(filePath, serialize(resolveDefault()));
      } else {
        await createIfMissing(app2, serialize(resolveDefault()));
      }
      return resolveDefault();
    }
    async function modifyWithBackup(app2, f, c) {
      try {
        await app2.vault.modify(f, c);
      } catch (e) {
        const backupPath = await backupOriginal(app2, filePath);
        if (backupPath) notifyBackup(filePath, backupPath, "写入失败");
        throw e;
      }
    }
    async function parseRaw(app2, raw) {
      try {
        return JSON.parse(raw);
      } catch (e) {
        return await handleCorrupt(app2, e, raw);
      }
    }
    return {
      async read() {
        const app2 = resolveApp();
        let f = app2.vault.getAbstractFileByPath(filePath);
        if (!f) {
          const created = await createIfMissing(app2, serialize(resolveDefault()));
          if (created) return resolveDefault();
          f = app2.vault.getAbstractFileByPath(filePath);
          if (!f && await diskPathExists(app2, filePath)) {
            return parseRaw(app2, await readFromDisk(app2, filePath));
          }
          if (!f) return resolveDefault();
        }
        return parseRaw(app2, await app2.vault.read(f));
      },
      async write(data) {
        const app2 = resolveApp();
        const c = serialize(data);
        let f = app2.vault.getAbstractFileByPath(filePath);
        if (f) {
          if (opts.writeIfChanged) {
            try {
              const cur2 = await app2.vault.read(f);
              if (cur2 === c) return;
            } catch (e) {
            }
          }
          await modifyWithBackup(app2, f, c);
          return;
        }
        const created = await createIfMissing(app2, c);
        if (created) return;
        let cur = app2.vault.getAbstractFileByPath(filePath);
        if (!cur && await diskPathExists(app2, filePath)) {
          try {
            if (opts.writeIfChanged) {
              try {
                if (await readFromDisk(app2, filePath) === c) return;
              } catch (e) {
              }
            }
            await app2.vault.adapter.write(filePath, c);
            return;
          } catch (e) {
            const backupPath = await backupOriginal(app2, filePath);
            if (backupPath) notifyBackup(filePath, backupPath, "写入失败");
            throw e;
          }
        }
        if (!cur) {
          const retried = await createIfMissing(app2, c);
          if (retried) return;
          cur = app2.vault.getAbstractFileByPath(filePath);
          if (!cur) throw new Error("storage: create 竞态降级失败（" + filePath + "）");
        }
        await modifyWithBackup(app2, cur, c);
      }
    };
  }

  // src/dock/store.ts
  var DOCK_STORE_VERSION = 1;
  var DOCK_STORE_FILENAME = "dock.json";
  var DOCK_TRUST_SETTINGS_KEY = "dockTrust";
  function defaults() {
    return { v: DOCK_STORE_VERSION, tools: [], runState: {}, autoRun: true, notifyMissed: true };
  }
  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function normalizeDockStore(raw) {
    if (!isPlainObject(raw)) return defaults();
    if (raw.v !== DOCK_STORE_VERSION) return defaults();
    return {
      v: DOCK_STORE_VERSION,
      tools: Array.isArray(raw.tools) ? raw.tools : [],
      runState: isPlainObject(raw.runState) ? raw.runState : {},
      // 两个开关缺省都是「开」：键缺失/形态不对一律视为开，与旧口径（`!== false` 即开）一致
      autoRun: raw.autoRun !== false,
      notifyMissed: raw.notifyMissed !== false
    };
  }
  function dockStorePath() {
    return storageFile(DOCK_STORE_FILENAME);
  }
  function readTrustMap() {
    var _a;
    const raw = (_a = tryGetSettings()) == null ? void 0 : _a[DOCK_TRUST_SETTINGS_KEY];
    if (!isPlainObject(raw)) return {};
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
      if (!isPlainObject(v)) continue;
      const at = v.at;
      if (typeof at !== "string" || at === "") continue;
      const run = typeof v.run === "string" && v.run !== "" ? v.run : void 0;
      out[id] = run !== void 0 ? { at, run } : { at };
    }
    return out;
  }
  async function writeTrustMap(map) {
    const before = JSON.stringify(readTrustMap());
    const after = JSON.stringify(map);
    if (before === after) return false;
    const s = tryGetSettings();
    s[DOCK_TRUST_SETTINGS_KEY] = map;
    await saveSettings();
    return true;
  }
  var snapshot = null;
  function dockStoreSnapshot() {
    return snapshot != null ? snapshot : defaults();
  }
  function store() {
    return jsonFileStore(dockStorePath(), {
      defaultValue: defaults,
      // 写前比对：面板开关反复点、台账无变化时不刷 mtime（Syncthing 止血）
      writeIfChanged: true
    });
  }
  async function loadDockStore(seed) {
    const path = dockStorePath();
    const app2 = getApp();
    const existed = !!app2.vault.getAbstractFileByPath(path) || await diskPathExists(app2, path);
    const raw = await store().read();
    const next = !existed && seed ? seed : normalizeDockStore(raw);
    if (!existed && seed) await store().write(next);
    snapshot = next;
    return next;
  }
  function setDockStoreMemory(patch) {
    snapshot = { ...dockStoreSnapshot(), ...patch, v: DOCK_STORE_VERSION };
  }
  async function persistDockStore() {
    await enqueueFileTask(dockStorePath(), async () => {
      await store().write(dockStoreSnapshot());
    });
  }
  async function mutateDockStore(patch) {
    setDockStoreMemory(patch);
    await persistDockStore();
  }

  // src/dock/schema.ts
  var DOCK_CONTRACT_VERSION = 1;
  var DOCK_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
  var DOCK_ID_MAX_LEN = 64;
  var PARAM_TYPES = /* @__PURE__ */ new Set([
    "text",
    "multiline",
    "number",
    "bool",
    "choice",
    "multichoice",
    "path",
    "secret"
  ]);
  var SCHEDULE_KINDS = /* @__PURE__ */ new Set([
    "daily",
    "weekly",
    "interval",
    "on-demand",
    "unknown"
  ]);
  var RUN_STATUSES = /* @__PURE__ */ new Set([
    "ok",
    "failed",
    "stopped",
    "running",
    "timeout"
  ]);
  var ERROR_KINDS = /* @__PURE__ */ new Set([
    "auth",
    "network",
    "config",
    "timeout",
    "aborted",
    "unknown"
  ]);
  var DOCK_RUNS_PER_TOOL_LIMIT = 200;
  function isPlainObject2(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function str(v) {
    return typeof v === "string" ? v : void 0;
  }
  function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : void 0;
  }
  function bool(v) {
    return typeof v === "boolean" ? v : void 0;
  }
  function nonEmptyStr(v) {
    const s = str(v);
    return s !== void 0 && s.trim() !== "" ? s : void 0;
  }
  function intInRange(v, lo, hi) {
    return typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : void 0;
  }
  function parseJsonObjectText(text) {
    if (typeof text !== "string") return null;
    const trimmed = text.charCodeAt(0) === 65279 ? text.slice(1) : text;
    if (trimmed.trim() === "") return null;
    try {
      const v = JSON.parse(trimmed);
      return isPlainObject2(v) ? v : null;
    } catch (e) {
      return null;
    }
  }
  function parseParam(raw) {
    var _a;
    if (!isPlainObject2(raw)) return null;
    const key = nonEmptyStr(raw.key);
    const label = nonEmptyStr(raw.label);
    const type = str(raw.type);
    if (!key || !label || !type || !PARAM_TYPES.has(type)) return null;
    let options;
    if (type === "choice" || type === "multichoice") {
      if (Array.isArray(raw.options)) {
        const kept = [];
        for (const o of raw.options) {
          if (!isPlainObject2(o)) continue;
          const value = str(o.value);
          if (value === void 0) continue;
          kept.push({ value, label: (_a = nonEmptyStr(o.label)) != null ? _a : value });
        }
        options = kept;
      }
    }
    const out = { key, label, type };
    if ("default" in raw) out.default = raw.default;
    const help = nonEmptyStr(raw.help);
    if (help) out.help = help;
    const placeholder = nonEmptyStr(raw.placeholder);
    if (placeholder) out.placeholder = placeholder;
    const required = bool(raw.required);
    if (required !== void 0) out.required = required;
    const min = num(raw.min);
    if (min !== void 0) out.min = min;
    const max = num(raw.max);
    if (max !== void 0) out.max = max;
    const step = num(raw.step);
    if (step !== void 0) out.step = step;
    const rows = num(raw.rows);
    if (rows !== void 0) out.rows = rows;
    if (type === "path") {
      const mode = str(raw.mode);
      out.mode = mode === "file" || mode === "dir" ? mode : "file";
    }
    if (options) out.options = options;
    return out;
  }
  function parseSchedule(raw) {
    if (!isPlainObject2(raw)) return void 0;
    const kind = str(raw.kind);
    if (!kind || !SCHEDULE_KINDS.has(kind)) return void 0;
    const s = { kind };
    const note = nonEmptyStr(raw.note);
    if (note) s.note = note;
    const hour = intInRange(raw.hour, 0, 23);
    if (hour !== void 0) s.hour = hour;
    const weekday = intInRange(raw.weekday, 0, 6);
    if (weekday !== void 0) s.weekday = weekday;
    const everyHours = num(raw.everyHours);
    if (everyHours !== void 0 && everyHours > 0) s.everyHours = everyHours;
    return s;
  }
  function parseManifest(raw) {
    var _a, _b;
    if (!isPlainObject2(raw)) return null;
    if (raw.v !== DOCK_CONTRACT_VERSION) return null;
    const id = str(raw.id);
    if (!id || id.length > DOCK_ID_MAX_LEN || !DOCK_ID_RE.test(id)) return null;
    const name = nonEmptyStr(raw.name);
    if (!name) return null;
    const params = [];
    if (Array.isArray(raw.params)) {
      const seen = /* @__PURE__ */ new Set();
      for (const p of raw.params) {
        const parsed = parseParam(p);
        if (!parsed) continue;
        if (seen.has(parsed.key)) continue;
        seen.add(parsed.key);
        params.push(parsed);
      }
    }
    const out = { ...raw, v: DOCK_CONTRACT_VERSION, id, name, params };
    out.description = nonEmptyStr(raw.description);
    out.author = nonEmptyStr(raw.author);
    out.toolVersion = nonEmptyStr(raw.toolVersion);
    out.icon = nonEmptyStr(raw.icon);
    out.group = nonEmptyStr(raw.group);
    out.docs = nonEmptyStr(raw.docs);
    out.desktopOnly = bool(raw.desktopOnly);
    if (Array.isArray(raw.produces)) {
      out.produces = raw.produces.filter((x) => typeof x === "string");
    }
    if (isPlainObject2(raw.run)) {
      const cmd = (_a = nonEmptyStr(raw.run.cmd)) == null ? void 0 : _a.trim();
      if (cmd) {
        const r = { cmd };
        if (Array.isArray(raw.run.args)) {
          const args = raw.run.args.filter((x) => typeof x === "string");
          if (args.length) r.args = args;
        }
        const cwd = (_b = nonEmptyStr(raw.run.cwd)) == null ? void 0 : _b.trim();
        if (cwd) r.cwd = cwd;
        const shell = bool(raw.run.shell);
        if (shell !== void 0) r.shell = shell;
        out.run = r;
      } else {
        delete out.run;
      }
    } else {
      delete out.run;
    }
    const schedule = parseSchedule(raw.schedule);
    if (schedule) out.schedule = schedule;
    else delete out.schedule;
    if (isPlainObject2(raw.runtime)) {
      const estimatedSec = num(raw.runtime.estimatedSec);
      out.runtime = estimatedSec !== void 0 && estimatedSec > 0 ? { estimatedSec } : {};
    } else {
      delete out.runtime;
    }
    return out;
  }
  function parseRunRecord(raw) {
    var _a, _b;
    if (!isPlainObject2(raw)) return null;
    const startedAt = nonEmptyStr(raw.startedAt);
    const status = str(raw.status);
    if (!startedAt || !status || !RUN_STATUSES.has(status)) return null;
    const runId = (_a = nonEmptyStr(raw.runId)) != null ? _a : startedAt;
    const trigger = str(raw.trigger) === "auto" ? "auto" : "manual";
    const out = { ...raw, runId, trigger, status, startedAt };
    out.finishedAt = nonEmptyStr(raw.finishedAt);
    if (raw.exitCode === null) out.exitCode = null;
    else out.exitCode = num(raw.exitCode);
    out.durationMs = num(raw.durationMs);
    out.message = nonEmptyStr(raw.message);
    if (isPlainObject2(raw.params)) out.params = raw.params;
    else delete out.params;
    if (Array.isArray(raw.steps)) {
      const steps = [];
      for (const s of raw.steps) {
        if (!isPlainObject2(s)) continue;
        const text = nonEmptyStr(s.text);
        if (!text) continue;
        const step = { text };
        const at = nonEmptyStr(s.at);
        if (at) step.at = at;
        const st = nonEmptyStr(s.status);
        if (st) step.status = st;
        steps.push(step);
      }
      if (steps.length) out.steps = steps;
      else delete out.steps;
    } else {
      delete out.steps;
    }
    if (isPlainObject2(raw.progress)) {
      const phase = (_b = nonEmptyStr(raw.progress.phase)) != null ? _b : null;
      const pctRaw = raw.progress.pct;
      const pct = typeof pctRaw === "number" && Number.isFinite(pctRaw) ? pctRaw : null;
      out.progress = { phase, pct };
    } else {
      delete out.progress;
    }
    if (!Array.isArray(raw.info)) delete out.info;
    if (!("result" in raw)) delete out.result;
    if (isPlainObject2(raw.metrics)) {
      const metrics = {};
      for (const [k, v] of Object.entries(raw.metrics)) {
        const n = num(v);
        if (n !== void 0) metrics[k] = n;
      }
      if (Object.keys(metrics).length) out.metrics = metrics;
      else delete out.metrics;
    } else {
      delete out.metrics;
    }
    if (Array.isArray(raw.artifacts)) {
      const artifacts = [];
      for (const a of raw.artifacts) {
        if (!isPlainObject2(a)) continue;
        const path = nonEmptyStr(a.path);
        if (!path) continue;
        const label = nonEmptyStr(a.label);
        artifacts.push(label ? { path, label } : { path });
      }
      if (artifacts.length) out.artifacts = artifacts;
      else delete out.artifacts;
    } else {
      delete out.artifacts;
    }
    if (isPlainObject2(raw.error)) {
      const kindRaw = str(raw.error.kind);
      const kind = kindRaw && ERROR_KINDS.has(kindRaw) ? kindRaw : "unknown";
      const error = { kind };
      const detail = nonEmptyStr(raw.error.detail);
      if (detail) error.detail = detail;
      const stderr = nonEmptyStr(raw.error.stderr);
      if (stderr) error.stderr = stderr;
      out.error = error;
    } else {
      delete out.error;
    }
    return out;
  }
  function parseRunsFile(raw, expectToolId) {
    if (!isPlainObject2(raw)) return null;
    if (raw.v !== DOCK_CONTRACT_VERSION) return null;
    const tool = str(raw.tool);
    if (!tool) return null;
    if (expectToolId !== void 0 && tool !== expectToolId) return null;
    const runs = [];
    if (Array.isArray(raw.runs)) {
      for (const r of raw.runs) {
        const parsed = parseRunRecord(r);
        if (parsed) runs.push(parsed);
      }
    }
    const out = { ...raw, v: DOCK_CONTRACT_VERSION, tool, runs };
    const updatedAt = nonEmptyStr(raw.updatedAt);
    if (updatedAt) out.updatedAt = updatedAt;
    else delete out.updatedAt;
    return out;
  }
  function parseRunsFileText(text, expectToolId) {
    return parseRunsFile(parseJsonObjectText(text), expectToolId);
  }
  function buildArgs(manifest, values) {
    const args = [];
    for (const p of manifest.params) {
      const v = values[p.key];
      if (v === void 0 || v === null) continue;
      if (p.type === "bool") {
        if (v === true) args.push(`--${p.key}`);
        continue;
      }
      if (p.type === "multichoice") {
        const list = Array.isArray(v) ? v : [v];
        for (const item of list) {
          const s2 = String(item);
          if (s2 !== "") args.push(`--${p.key}=${s2}`);
        }
        continue;
      }
      const s = String(v);
      if (s === "" && !p.required) continue;
      args.push(`--${p.key}=${s}`);
    }
    return args;
  }

  // src/dock/rules.ts
  var TRIGGER_KINDS = [
    "daily",
    "interval",
    "on-launch",
    "panel-open",
    "tool-ok",
    "tool-fail",
    "domain-event",
    "vault-file",
    "data-threshold"
  ];
  var TRIGGER_LABEL = {
    daily: "每天某时",
    interval: "每隔一段时间",
    "on-launch": "启动 Obsidian 后",
    "panel-open": "打开工具坞时",
    "tool-ok": "某个工具成功后",
    "tool-fail": "某个工具失败后",
    "domain-event": "某个事件发生时",
    "vault-file": "某个目录有变动",
    "data-threshold": "某个数值达到条件"
  };
  function atSecondsOf(at) {
    if (!at) return void 0;
    const m = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/.exec(at.trim());
    if (!m) return void 0;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    const s = m[3] === void 0 ? 0 : Number(m[3]);
    if (h > 23 || mi > 59 || s > 59) return void 0;
    return h * 3600 + mi * 60 + s;
  }
  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function todayAt(trigger, now) {
    const sec = atSecondsOf(trigger.at);
    if (sec === void 0) return void 0;
    return startOfDay(now) + sec * 1e3;
  }
  function ruleDue(rule, ctx) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const t = rule.trigger;
    switch (t.kind) {
      case "daily": {
        const at = todayAt(t, ctx.now);
        if (at === void 0) return false;
        if (ctx.now < at) return false;
        return ((_a = ctx.lastFiredAt) != null ? _a : 0) < at;
      }
      case "interval": {
        if (!(t.everyMin > 0)) return false;
        if (ctx.lastFiredAt === void 0) return true;
        return ctx.now - ctx.lastFiredAt >= t.everyMin * 6e4;
      }
      case "on-launch": {
        const base = ctx.sessionStart;
        if (base === void 0) return false;
        if (ctx.now < base + t.delayMin * 6e4) return false;
        return ((_b = ctx.lastFiredAt) != null ? _b : 0) < base;
      }
      case "panel-open":
        return ((_c = ctx.event) == null ? void 0 : _c.kind) === "panel-open";
      case "tool-ok":
        return ((_d = ctx.event) == null ? void 0 : _d.kind) === "tool-ok" && ctx.event.toolId === t.toolId;
      case "tool-fail":
        return ((_e = ctx.event) == null ? void 0 : _e.kind) === "tool-fail" && ctx.event.toolId === t.toolId;
      case "domain-event":
        return ((_f = ctx.event) == null ? void 0 : _f.kind) === "domain-event" && ctx.event.channel === t.channel;
      case "vault-file": {
        if (((_g = ctx.event) == null ? void 0 : _g.kind) !== "vault-file") return false;
        const p = (_h = ctx.event.path) != null ? _h : "";
        if (!p) return false;
        const target = t.target.replace(/\/+$/, "");
        return p === target || p.startsWith(target + "/");
      }
      case "data-threshold": {
        if (ctx.value === void 0) return false;
        if (t.op === ">") return ctx.value > t.value;
        if (t.op === "<") return ctx.value < t.value;
        return ctx.value === t.value;
      }
    }
  }
  var pad22 = (n) => String(n).padStart(2, "0");
  function clockText(at) {
    const sec = atSecondsOf(at);
    if (sec === void 0) return at;
    return `${pad22(Math.floor(sec / 3600))}:${pad22(Math.floor(sec % 3600 / 60))}`;
  }
  function durationText(min) {
    if (min % 60 === 0 && min >= 60) return `${min / 60} 小时`;
    return `${min} 分钟`;
  }
  function triggerText(t, toolNameOf) {
    const name = (id) => toolNameOf ? toolNameOf(id) : id;
    switch (t.kind) {
      case "daily":
        return `每天 ${clockText(t.at)}`;
      case "interval":
        return `每 ${durationText(t.everyMin)}`;
      case "on-launch":
        return `启动后 ${durationText(t.delayMin)}`;
      case "panel-open":
        return "打开工具坞时";
      case "tool-ok":
        return `${name(t.toolId)} 成功后`;
      case "tool-fail":
        return `${name(t.toolId)} 失败后`;
      case "domain-event":
        return `事件 ${t.channel}`;
      case "vault-file":
        return `${t.target} 有变动`;
      case "data-threshold":
        return `${t.path} ${t.key} ${t.op} ${t.value}`;
    }
  }
  function actionText(a) {
    if (a.kind === "remind") return a.open ? "只提醒（通知可跳转）" : "只提醒";
    return a.notify === "always" ? "运行并提醒" : a.notify === "fail" ? "运行（失败才提醒）" : "运行";
  }
  function newRuleId(now = Date.now()) {
    return `r${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  }
  function defaultAction() {
    return { kind: "run", notify: "fail" };
  }
  function seedRuleFromSchedule(s, id) {
    var _a;
    if (!s) return null;
    if (s.kind === "daily") {
      const h = (_a = s.hour) != null ? _a : 12;
      return { id, trigger: { kind: "daily", at: `${pad22(h)}:00` }, action: defaultAction() };
    }
    if (s.kind === "interval" && s.everyHours) {
      return {
        id,
        trigger: { kind: "interval", everyMin: s.everyHours * 60 },
        action: defaultAction()
      };
    }
    return null;
  }
  function effectiveRules(rules, override, declared) {
    var _a;
    if (rules && rules.length) return rules.slice();
    const seed = (_a = seedRuleFromSchedule(override, "seed")) != null ? _a : seedRuleFromSchedule(declared, "seed");
    return seed ? [seed] : [];
  }
  function hasActiveRule(rules) {
    return rules.some((r) => r.enabled !== false);
  }
  function str2(v) {
    return typeof v === "string" ? v.trim() : void 0;
  }
  function intOf(v, min, max) {
    if (typeof v !== "number" || !Number.isFinite(v)) return void 0;
    const n = Math.floor(v);
    if (n < min || n > max) return void 0;
    return n;
  }
  function parseTrigger(raw) {
    var _a, _b, _c, _d, _e, _f;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const r = raw;
    switch (r.kind) {
      case "daily": {
        const at = str2(r.at);
        if (!at || atSecondsOf(at) === void 0) return null;
        return { kind: "daily", at: clockText(at) };
      }
      case "interval": {
        const everyMin = intOf(r.everyMin, 1, 43200);
        return everyMin === void 0 ? null : { kind: "interval", everyMin };
      }
      case "on-launch": {
        const delayMin = intOf(r.delayMin, 0, 1440);
        return delayMin === void 0 ? null : { kind: "on-launch", delayMin };
      }
      case "panel-open":
        return { kind: "panel-open" };
      case "tool-ok":
        return { kind: "tool-ok", toolId: (_a = str2(r.toolId)) != null ? _a : "" };
      case "tool-fail":
        return { kind: "tool-fail", toolId: (_b = str2(r.toolId)) != null ? _b : "" };
      case "domain-event":
        return { kind: "domain-event", channel: (_c = str2(r.channel)) != null ? _c : "" };
      case "vault-file":
        return { kind: "vault-file", target: (_d = str2(r.target)) != null ? _d : "" };
      case "data-threshold": {
        const op = r.op;
        if (op !== ">" && op !== "<" && op !== "=") return null;
        const value = r.value;
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return {
          kind: "data-threshold",
          path: (_e = str2(r.path)) != null ? _e : "",
          key: (_f = str2(r.key)) != null ? _f : "",
          op,
          value
        };
      }
      default:
        return null;
    }
  }
  function parseAction(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const r = raw;
    if (r.kind === "remind") {
      const open = str2(r.open);
      return open ? { kind: "remind", open } : { kind: "remind" };
    }
    if (r.kind !== "run") return null;
    const n = r.notify;
    return { kind: "run", notify: n === "always" || n === "fail" || n === "never" ? n : "fail" };
  }
  function parseRule(raw) {
    var _a;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const r = raw;
    const id = str2(r.id);
    if (!id) return null;
    const trigger = parseTrigger(r.trigger);
    if (!trigger) return null;
    const out = { id, trigger, action: (_a = parseAction(r.action)) != null ? _a : defaultAction() };
    const name = str2(r.name);
    if (name) out.name = name;
    if (typeof r.enabled === "boolean") out.enabled = r.enabled;
    const jit = intOf(r.jitterMin, 0, 720);
    if (jit !== void 0) out.jitterMin = jit;
    return out;
  }
  function parseRules(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of raw) {
      const parsed = parseRule(item);
      if (!parsed || seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      out.push(parsed);
    }
    return out;
  }
  function parseRuleState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return void 0;
    const out = {};
    let any = false;
    for (const [k, v] of Object.entries(raw)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const at = str2(v.lastFiredAt);
      if (!at) continue;
      out[k] = { lastFiredAt: at };
      any = true;
    }
    return any ? out : void 0;
  }

  // src/dock/registry.ts
  var TOOL_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
  var TOOL_ID_MAX_LEN = 64;
  function runSignature(run) {
    var _a;
    return [run.cmd, run.shell ? "shell" : "raw", ...(_a = run.args) != null ? _a : []].join("\0");
  }
  function parseToolEntry(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const r = raw;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const path = typeof r.path === "string" ? r.path.trim() : "";
    if (!id || id.length > TOOL_ID_MAX_LEN || !TOOL_ID_RE.test(id)) return null;
    if (!path) return null;
    const out = { id, path };
    if (typeof r.enabled === "boolean") out.enabled = r.enabled;
    if (typeof r.trustedAt === "string" && r.trustedAt.trim()) out.trustedAt = r.trustedAt.trim();
    if (typeof r.trustedRun === "string" && r.trustedRun !== "") out.trustedRun = r.trustedRun;
    if (typeof r.autoRun === "boolean") out.autoRun = r.autoRun;
    const rules = parseRules(r.rules);
    if (rules.length) out.rules = rules;
    const ruleState = parseRuleState(r.ruleState);
    if (ruleState) out.ruleState = ruleState;
    const override = parseSchedule(r.scheduleOverride);
    if (override) {
      out.scheduleOverride = override;
      if (typeof r.overrideDeclSig === "string" && r.overrideDeclSig !== "") {
        out.overrideDeclSig = r.overrideDeclSig;
      }
    }
    return out;
  }
  function parseToolEntries(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of raw) {
      const parsed = parseToolEntry(item);
      if (!parsed || seen.has(parsed.id)) continue;
      seen.add(parsed.id);
      out.push(parsed);
    }
    return out;
  }

  // src/dock/declaration.ts
  var DECLARATION_FILENAME = "manifest.json";
  var DECLARATION_FILENAME_LEGACY = "dock.json";
  var SETTINGS_FILENAME = "data.json";
  var SETTINGS_FILENAME_LEGACY = "dock.settings.json";
  var RUNS_FILENAME = "runs.json";
  var RUNS_FILENAME_LEGACY = "dock.runs.json";
  var MAIN_ENTRY_FILENAME = "main.mjs";
  var DOCK_SETTINGS_VERSION = 1;
  var injectedFs;
  function setDockFs(fs) {
    injectedFs = fs;
  }
  function defaultDockFs() {
    if (typeof window === "undefined") return null;
    const w = window;
    if (!w.require) return null;
    try {
      const fs = w.require("fs");
      return {
        readText: (p) => {
          try {
            return fs.readFileSync(p, "utf8");
          } catch (e) {
            return null;
          }
        },
        writeText: (p, d) => fs.writeFileSync(p, d),
        rename: typeof fs.renameSync === "function" ? (a, b) => fs.renameSync(a, b) : void 0,
        exists: typeof fs.existsSync === "function" ? (p) => {
          try {
            if (!fs.existsSync(p)) return false;
            return fs.statSync ? fs.statSync(p).isFile() : true;
          } catch (e) {
            return false;
          }
        } : void 0,
        unlink: typeof fs.unlinkSync === "function" ? (p) => fs.unlinkSync(p) : void 0
      };
    } catch (e) {
      return null;
    }
  }
  function currentFs() {
    return injectedFs !== void 0 ? injectedFs : defaultDockFs();
  }
  function dirOf(p) {
    const s = p.replace(/\\/g, "/");
    const i = s.lastIndexOf("/");
    if (i < 0) return "";
    if (i === 0) return "/";
    if (s[i - 1] === ":") return s.slice(0, i + 1);
    return s.slice(0, i);
  }
  function joinPath(dir, name) {
    const d = dir.replace(/\\/g, "/").replace(/\/+$/, "");
    return d === "" ? name : `${d}/${name}`;
  }
  function settingsPathFor(declPath) {
    return joinPath(dirOf(declPath), SETTINGS_FILENAME);
  }
  function runsPathFor(declPath) {
    return joinPath(dirOf(declPath), RUNS_FILENAME);
  }
  function aliasOf(p, from, to) {
    var _a;
    const base = (_a = p.replace(/\\/g, "/").split("/").pop()) != null ? _a : "";
    if (base !== from) return null;
    return joinPath(dirOf(p), to);
  }
  function resolveRun(manifest, declPath, conventional) {
    var _a, _b, _c, _d;
    const run = (_a = manifest == null ? void 0 : manifest.run) != null ? _a : conventional;
    if (!run || !run.cmd) return null;
    return {
      cmd: run.cmd,
      args: [...(_b = run.args) != null ? _b : []],
      cwd: (_c = run.cwd) != null ? _c : dirOf(declPath) || void 0,
      shell: (_d = run.shell) != null ? _d : /\.(cmd|bat)$/i.test(run.cmd)
    };
  }
  function hasMainEntry(dir, fs) {
    const p = joinPath(dir, MAIN_ENTRY_FILENAME);
    return fs.exists ? fs.exists(p) : fs.readText(p) !== null;
  }
  function readDeclaration(declPath, fs = currentFs()) {
    var _a;
    if (!fs) return { ok: false, error: "读声明需要桌面端（移动端只读面板）" };
    let text = fs.readText(declPath);
    let usedPath = declPath;
    if (text === null) {
      const alias = (_a = aliasOf(declPath, DECLARATION_FILENAME, DECLARATION_FILENAME_LEGACY)) != null ? _a : aliasOf(declPath, DECLARATION_FILENAME_LEGACY, DECLARATION_FILENAME);
      if (alias !== null) {
        const alt = fs.readText(alias);
        if (alt !== null) {
          text = alt;
          usedPath = alias;
        }
      }
    }
    if (text === null) return { ok: false, error: `声明文件读不到：${declPath}` };
    const raw = parseJsonObjectText(text);
    if (raw === null) return { ok: false, error: `声明文件不是合法 JSON：${usedPath}` };
    const manifest = parseManifest(raw);
    if (!manifest) {
      return {
        ok: false,
        error: `声明文件校验不过（v 须为 1、id 只能小写字母数字连字符、name 不能空）：${usedPath}`
      };
    }
    const conventionalRun = manifest.run || !hasMainEntry(dirOf(usedPath), fs) ? void 0 : { cmd: "node", args: [MAIN_ENTRY_FILENAME] };
    return { ok: true, manifest, path: usedPath, conventionalRun };
  }
  function isPlainObject3(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }
  function parseSettingsText(text, toolId) {
    if (text === null) return null;
    const raw = parseJsonObjectText(text);
    if (!raw) return {};
    if (raw.v !== DOCK_SETTINGS_VERSION) return {};
    if (raw.tool !== toolId) return {};
    return isPlainObject3(raw.values) ? { ...raw.values } : {};
  }
  function readSettings(declPath, toolId, fs = currentFs()) {
    if (!fs) return {};
    const direct = parseSettingsText(fs.readText(settingsPathFor(declPath)), toolId);
    if (direct !== null) return direct;
    const legacy = parseSettingsText(fs.readText(joinPath(dirOf(declPath), SETTINGS_FILENAME_LEGACY)), toolId);
    return legacy != null ? legacy : {};
  }
  function writeSettings(declPath, toolId, values, fs = currentFs()) {
    if (!fs) return false;
    const target = settingsPathFor(declPath);
    const payload = { v: DOCK_SETTINGS_VERSION, tool: toolId, values };
    const text = JSON.stringify(payload, null, 2);
    try {
      if (fs.rename) {
        const tmp = `${target}.tmp`;
        fs.writeText(tmp, text);
        fs.rename(tmp, target);
      } else {
        fs.writeText(target, text);
      }
    } catch (e) {
      return false;
    }
    const legacy = joinPath(dirOf(declPath), SETTINGS_FILENAME_LEGACY);
    if (fs.unlink) {
      try {
        const gone = fs.exists ? fs.exists(legacy) : fs.readText(legacy) !== null;
        if (gone) fs.unlink(legacy);
      } catch (e) {
      }
    }
    return true;
  }
  function readRunsText(declPath, fs = currentFs()) {
    var _a;
    if (!fs) return null;
    return (_a = fs.readText(runsPathFor(declPath))) != null ? _a : fs.readText(joinPath(dirOf(declPath), RUNS_FILENAME_LEGACY));
  }

  // src/dock/schedule.ts
  var TERMINAL = /* @__PURE__ */ new Set(["ok", "failed", "stopped", "timeout"]);
  function triggerOf(schedule) {
    if (!schedule) return "manual";
    return schedule.kind === "on-demand" || schedule.kind === "unknown" ? "manual" : "auto";
  }
  function effectiveSchedule(declared, override) {
    return override != null ? override : declared;
  }
  function scheduleSignature(s) {
    var _a, _b, _c;
    if (!s) return "";
    return [s.kind, (_a = s.hour) != null ? _a : "", (_b = s.weekday) != null ? _b : "", (_c = s.everyHours) != null ? _c : ""].join("|");
  }
  function isDueToRun(schedule, runs, now = Date.now()) {
    if (!schedule || schedule.kind === "on-demand" || schedule.kind === "unknown") return false;
    if (schedule.kind === "interval" && lastRun(runs) === void 0) return true;
    return judgeDue(schedule, runs, now).state === "due";
  }
  function missingRequiredParams(params, values) {
    const out = [];
    for (const p of params != null ? params : []) {
      if (!p.required) continue;
      const v = values[p.key];
      const empty = v === void 0 || v === null || v === "" || Array.isArray(v) && v.length === 0;
      if (empty) out.push(p.label || p.key);
    }
    return out;
  }
  function dayKey(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function timeOf(s) {
    if (!s) return void 0;
    const t = new Date(s.replace(" ", "T")).getTime();
    return Number.isFinite(t) ? t : void 0;
  }
  function terminalRuns(runs) {
    return runs.filter((r) => TERMINAL.has(r.status)).slice().sort((a, b) => {
      var _a, _b;
      return ((_a = timeOf(b.startedAt)) != null ? _a : 0) - ((_b = timeOf(a.startedAt)) != null ? _b : 0);
    });
  }
  function lastRun(runs) {
    return terminalRuns(runs)[0];
  }
  function isAlarm(runs, overdue) {
    if (overdue) return true;
    const last = lastRun(runs);
    return !!last && (last.status === "failed" || last.status === "timeout");
  }
  function judgeDue(schedule, runs, now = Date.now()) {
    if (!schedule || schedule.kind === "on-demand" || schedule.kind === "unknown") {
      return { state: "none", detail: "未声明节奏" };
    }
    const latest = lastRun(runs);
    const latestAt = latest ? timeOf(latest.startedAt) : void 0;
    const d = new Date(now);
    const DAY2 = 864e5;
    switch (schedule.kind) {
      case "daily": {
        if (schedule.hour !== void 0 && d.getHours() < schedule.hour) {
          return { state: "pending", detail: `今天 ${String(schedule.hour).padStart(2, "0")}:00 之后应有记录` };
        }
        if (latestAt !== void 0 && dayKey(latestAt) === dayKey(now)) {
          return { state: "ok", detail: "今天已有记录" };
        }
        return { state: "due", detail: "今天还没有记录" };
      }
      case "weekly": {
        if (schedule.weekday !== void 0) {
          const back = (d.getDay() - schedule.weekday + 7) % 7;
          const expected = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
          if (latestAt !== void 0 && latestAt >= expected) {
            return { state: "ok", detail: "本周这份记录已到位" };
          }
          return { state: "due", detail: "本周该跑的还没跑" };
        }
        const weekAgo = now - 7 * DAY2;
        if (latestAt !== void 0 && latestAt >= weekAgo) {
          return { state: "ok", detail: "最近 7 天内有记录" };
        }
        return { state: "due", detail: "最近 7 天没有任何记录" };
      }
      case "interval": {
        if (schedule.everyHours === void 0) return { state: "none", detail: "未声明间隔时长" };
        if (latestAt === void 0) {
          return { state: "unknown", detail: "还没有任何运行记录，无法判定" };
        }
        const gap = now - latestAt;
        const limit = schedule.everyHours * 36e5;
        if (gap <= limit) return { state: "ok", detail: `距上次 ${Math.round(gap / 6e4)} 分钟` };
        const overdueH = Math.floor(gap / 36e5);
        return { state: "due", detail: `距上次已 ${overdueH} 小时，超过声明的 ${schedule.everyHours} 小时` };
      }
      default:
        return { state: "none", detail: "未声明节奏" };
    }
  }
  var ERROR_KIND_LABEL = {
    auth: "认证失效",
    network: "网络异常",
    config: "配置不对",
    timeout: "超时",
    aborted: "被中止",
    unknown: "未知错误"
  };
  function overviewOf(items, now = Date.now()) {
    var _a, _b, _c;
    const d = new Date(now);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const weekAgo = now - 7 * 864e5;
    let autoTotal = 0;
    let autoDoneToday = 0;
    let runs7d = 0;
    let ok7d = 0;
    let alarms = 0;
    let alarmHint = null;
    let nextDue = null;
    for (const it of items) {
      if (it.trigger === "auto") {
        autoTotal += 1;
        const done = terminalRuns(it.runs).some(
          (r) => {
            var _a2;
            return r.status === "ok" && ((_a2 = timeOf(r.startedAt)) != null ? _a2 : 0) >= dayStart;
          }
        );
        if (done) autoDoneToday += 1;
      }
      for (const r of terminalRuns(it.runs)) {
        const at = timeOf(r.startedAt);
        if (at === void 0 || at < weekAgo) continue;
        runs7d += 1;
        if (r.status === "ok") ok7d += 1;
      }
      const last = lastRun(it.runs);
      if (isAlarm(it.runs, it.overdue)) {
        alarms += 1;
        if (!alarmHint) {
          alarmHint = {
            name: it.name,
            reason: it.overdue ? "该跑没跑" : (_c = ERROR_KIND_LABEL[(_b = (_a = last == null ? void 0 : last.error) == null ? void 0 : _a.kind) != null ? _b : "unknown"]) != null ? _c : "未知错误"
          };
        }
      }
      const dueAt = nextDueAt(it.schedule, it.runs, now);
      if (dueAt !== null && dueAt > now && (nextDue === null || dueAt < nextDue.at)) {
        nextDue = { at: dueAt, name: it.name };
      }
    }
    return {
      autoDoneToday,
      autoTotal,
      runs7d,
      ok7d,
      rate7d: runs7d ? ok7d / runs7d : null,
      alarms,
      alarmHint,
      nextDue
    };
  }
  function nextDueAt(schedule, runs, now = Date.now()) {
    var _a;
    if (!schedule) return null;
    const d = new Date(now);
    const DAY2 = 864e5;
    switch (schedule.kind) {
      case "daily": {
        const hour = (_a = schedule.hour) != null ? _a : 0;
        const todayAt2 = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour).getTime();
        return todayAt2 > now ? todayAt2 : todayAt2 + DAY2;
      }
      case "weekly": {
        if (schedule.weekday === void 0) return null;
        const back = (d.getDay() - schedule.weekday + 7) % 7;
        const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
        return slot > now ? slot : slot + 7 * DAY2;
      }
      case "interval": {
        if (schedule.everyHours === void 0) return null;
        const latest = lastRun(runs);
        const latestAt = latest ? timeOf(latest.startedAt) : void 0;
        if (latestAt === void 0) return null;
        return latestAt + schedule.everyHours * 36e5;
      }
      default:
        return null;
    }
  }
  function recentRuns(runs, n = 7) {
    const list = terminalRuns(runs).slice(0, n).reverse();
    const out = [];
    for (let i = 0; i < n - list.length; i++) out.push(null);
    for (const r of list) out.push(r);
    return out;
  }
  function successRate(runs) {
    const list = terminalRuns(runs);
    if (!list.length) return null;
    return list.filter((r) => r.status === "ok").length / list.length;
  }
  function durationText2(run) {
    let ms = run.durationMs;
    if (ms === void 0) {
      const a = timeOf(run.startedAt);
      const b = timeOf(run.finishedAt);
      if (a !== void 0 && b !== void 0 && b >= a) ms = b - a;
    }
    if (ms === void 0) return "";
    if (ms < 1e3) return `${ms} 毫秒`;
    const s = ms / 1e3;
    if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} 秒`;
    const m = Math.floor(s / 60);
    return `${m} 分 ${Math.round(s - m * 60)} 秒`;
  }

  // src/dock/data.ts
  function runsPathOf(entry) {
    return runsPathFor(entry.path);
  }
  function stripTrustFields(e) {
    delete e.trustedAt;
    delete e.trustedRun;
    return e;
  }
  function entriesFromFile(raw) {
    return parseToolEntries(raw).map(stripTrustFields);
  }
  function entriesToFile(entries) {
    return entries.map((e) => stripTrustFields({ ...e }));
  }
  function trustFromEntries(entries) {
    const trust = {};
    for (const e of entries) {
      if (typeof e.trustedAt !== "string" || e.trustedAt === "") continue;
      const t = { at: e.trustedAt };
      if (typeof e.trustedRun === "string") t.run = e.trustedRun;
      trust[e.id] = t;
    }
    return trust;
  }
  function readToolEntries() {
    const trust = readTrustMap();
    return entriesFromFile(dockStoreSnapshot().tools).map((e) => {
      const t = trust[e.id];
      if (!t) return e;
      e.trustedAt = t.at;
      if (t.run !== void 0) e.trustedRun = t.run;
      return e;
    });
  }
  async function saveToolEntries(entries) {
    await mutateDockStore({ tools: entriesToFile(entries) });
    await writeTrustMap(trustFromEntries(entries));
  }
  function isTrusted(entry) {
    return typeof entry.trustedAt === "string" && entry.trustedAt !== "";
  }
  function isEnabled(entry) {
    return entry.enabled !== false;
  }
  async function updateToolEntry(id, patch) {
    const entries = readToolEntries();
    const i = entries.findIndex((e) => e.id === id);
    if (i < 0) return;
    const next = { ...entries[i] };
    for (const [k, v] of Object.entries(patch)) {
      if (v === void 0) delete next[k];
      else next[k] = v;
    }
    entries[i] = next;
    await saveToolEntries(entries);
  }
  async function patchRuleFired(toolId, ruleId, at) {
    var _a;
    const entry = readToolEntries().find((e) => e.id === toolId);
    if (!entry) return;
    const state = { ...(_a = entry.ruleState) != null ? _a : {} };
    state[ruleId] = { lastFiredAt: new Date(at).toISOString() };
    await updateToolEntry(toolId, { ruleState: state });
  }
  function parseRunState(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const r = raw;
    const out = {};
    if (typeof r.lastAttemptAt === "string" && r.lastAttemptAt !== "") out.lastAttemptAt = r.lastAttemptAt;
    if (typeof r.lastAttemptOk === "boolean") out.lastAttemptOk = r.lastAttemptOk;
    if (typeof r.consecutiveFailures === "number" && Number.isInteger(r.consecutiveFailures) && r.consecutiveFailures > 0) {
      out.consecutiveFailures = r.consecutiveFailures;
    }
    if (typeof r.pausedAt === "string" && r.pausedAt !== "") out.pausedAt = r.pausedAt;
    return out;
  }
  function readRunStates() {
    const raw = dockStoreSnapshot().runState;
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
      const st = parseRunState(v);
      if (Object.keys(st).length) out[id] = st;
    }
    return out;
  }
  async function patchRunState(id, patch) {
    const all = readRunStates();
    if (patch === null) {
      delete all[id];
    } else {
      const next = { ...all[id] };
      for (const [k, v] of Object.entries(patch)) {
        if (v === void 0) delete next[k];
        else next[k] = v;
      }
      const st = parseRunState(next);
      if (Object.keys(st).length) all[id] = st;
      else delete all[id];
    }
    await mutateDockStore({ runState: all });
  }
  async function recordRunSuccess(id, finishedAt) {
    await patchRunState(id, {
      lastAttemptAt: finishedAt,
      lastAttemptOk: true,
      consecutiveFailures: 0,
      pausedAt: void 0
    });
  }
  function readDockSwitch(key) {
    return dockStoreSnapshot()[key] !== false;
  }
  function readRunsFile(entry) {
    const raw = readRunsText(entry.path);
    if (raw === null) return { file: null, existed: false };
    return { file: parseRunsFileText(raw, entry.id), existed: true };
  }
  function readToolValues(entry) {
    return readSettings(entry.path, entry.id);
  }
  function saveToolValues(entry, values) {
    return writeSettings(entry.path, entry.id, values);
  }
  function displayName(view2) {
    var _a;
    return ((_a = view2.manifest) == null ? void 0 : _a.name) || view2.entry.id;
  }
  function displayDesc(view2) {
    var _a;
    return ((_a = view2.manifest) == null ? void 0 : _a.description) || "";
  }
  function displayIcon(view2) {
    var _a;
    return ((_a = view2.manifest) == null ? void 0 : _a.icon) || "square-terminal";
  }
  function triggerOfView(view2) {
    return triggerOf(view2.schedule);
  }
  function isOverdue(state) {
    return state === "due";
  }
  async function loadToolViews(app2) {
    const entries = readToolEntries();
    const states = readRunStates();
    return Promise.all(entries.map((entry) => loadToolView(app2, entry, states)));
  }
  function firedAtMapOf(entry) {
    var _a;
    const out = {};
    for (const [key, v] of Object.entries((_a = entry.ruleState) != null ? _a : {})) {
      const t = (v == null ? void 0 : v.lastFiredAt) ? Date.parse(v.lastFiredAt) : NaN;
      if (Number.isFinite(t)) out[key] = t;
    }
    return out;
  }
  async function loadToolView(app2, entry, runStates = readRunStates()) {
    var _a, _b, _c, _d, _e;
    const decl = readDeclaration(entry.path);
    const manifest = (_a = decl.manifest) != null ? _a : null;
    const declPath = (_b = decl.path) != null ? _b : entry.path;
    const run = resolveRun(manifest, declPath, decl.conventionalRun);
    const trustStale = isTrusted(entry) && (run ? runSignature(run) : void 0) !== entry.trustedRun;
    const runsRead = readRunsFile(entry);
    const runs = (_d = (_c = runsRead.file) == null ? void 0 : _c.runs) != null ? _d : [];
    const declaredSchedule = manifest == null ? void 0 : manifest.schedule;
    const schedule = effectiveSchedule(declaredSchedule, entry.scheduleOverride);
    const scheduleOverridden = entry.scheduleOverride !== void 0;
    const declChangedSinceOverride = scheduleOverridden && entry.overrideDeclSig !== void 0 && entry.overrideDeclSig !== scheduleSignature(declaredSchedule);
    return {
      entry,
      manifest,
      declError: manifest ? null : (_e = decl.error) != null ? _e : "声明读不到",
      declPath,
      valuesPath: settingsPathFor(declPath),
      run,
      values: readToolValues(entry),
      trustStale,
      runs,
      runsUnreadable: runsRead.existed && runsRead.file === null,
      due: judgeDue(schedule, runs),
      dueToRun: isDueToRun(schedule, runs),
      declaredSchedule,
      schedule,
      scheduleOverridden,
      declChangedSinceOverride,
      rules: effectiveRules(entry.rules, entry.scheduleOverride, declaredSchedule),
      ruleFiredAt: firedAtMapOf(entry),
      nextDue: nextDueAt(schedule, runs),
      runState: runStates[entry.id],
      overLimit: runs.length > DOCK_RUNS_PER_TOOL_LIMIT,
      runsPath: runsPathOf(entry)
    };
  }
  function summarize(views2) {
    let auto = 0;
    let manual = 0;
    let overdue = 0;
    let totalRuns = 0;
    for (const v of views2) {
      if (triggerOfView(v) === "auto") auto += 1;
      else manual += 1;
      if (isOverdue(v.due.state)) overdue += 1;
      totalRuns += v.runs.length;
    }
    return { total: views2.length, auto, manual, overdue, totalRuns };
  }
  function overview(views2, now = Date.now()) {
    return overviewOf(
      views2.map((v) => ({
        trigger: triggerOfView(v),
        name: displayName(v),
        schedule: v.schedule,
        runs: v.runs,
        overdue: isOverdue(v.due.state)
      })),
      now
    );
  }

  // src/core/external-tool.ts
  var BZ_LINE_PREFIX_RE = /^\[bz-(step|p|info|result)\]/;
  function parseBzLine(line) {
    const text = line.endsWith("\r") ? line.slice(0, -1) : line;
    const m = text.match(BZ_LINE_PREFIX_RE);
    if (!m) {
      if (!text.trim()) return null;
      return { kind: "raw", text };
    }
    const body = text.slice(m[0].length).trim();
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
  var FORCE_KILL_GRACE_MS = 3e3;
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
  function runExternalTool(spec, cb, deps2) {
    var _a, _b;
    const cp = deps2 && deps2.cp ? deps2.cp : defaultChildProcess();
    const splitter = new BzLineSplitter();
    let stderrTail = "";
    let settled = false;
    let stopped = false;
    let child = null;
    let exitSeen = false;
    let exitCode = null;
    let forceTimer = null;
    let resolveDone;
    const done = new Promise((r) => {
      resolveDone = r;
    });
    const settle = (o) => {
      if (settled) return;
      settled = true;
      if (forceTimer !== null) {
        clearTimeout(forceTimer);
        forceTimer = null;
      }
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
    (_a = child.stdout) == null ? void 0 : _a.on("data", (d) => {
      for (const line of splitter.push(d)) dispatchLine(line);
    });
    (_b = child.stderr) == null ? void 0 : _b.on("data", collectStderr);
    child.on("error", (e) => {
      if (settled) return;
      settle({ ok: false, stopped: false, code: null, stderr: stderrTail.trim(), error: new Error(`外部工具启动失败：${e.message}`) });
    });
    child.on("exit", (code) => {
      exitSeen = true;
      exitCode = code;
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
    const isWindows = () => process.platform === "win32";
    const spawnSuppressed = (cmd, args) => {
      var _a2;
      try {
        const killer = cp.spawn(cmd, args, { stdio: "ignore", windowsHide: true });
        (_a2 = killer.on) == null ? void 0 : _a2.call(killer, "error", () => {
        });
      } catch (e) {
      }
    };
    const escalateForceKill = () => {
      forceTimer = null;
      if (settled) return;
      const pid = child == null ? void 0 : child.pid;
      if (typeof pid !== "number" || pid <= 0) return;
      if (exitSeen) {
        settle({ ok: false, stopped: true, code: exitCode, stderr: stderrTail.trim(), error: null });
        return;
      }
      if (isWindows()) {
        spawnSuppressed("taskkill", ["/pid", String(pid), "/T", "/F"]);
        return;
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch (e) {
      }
    };
    const stopChild = () => {
      var _a2;
      const pid = child == null ? void 0 : child.pid;
      if (spec.shell && isWindows() && typeof pid === "number" && pid > 0) {
        spawnSuppressed("taskkill", ["/pid", String(pid), "/T"]);
      } else {
        try {
          (_a2 = child == null ? void 0 : child.kill) == null ? void 0 : _a2.call(child);
        } catch (e) {
        }
      }
      if (typeof pid === "number" && pid > 0) {
        forceTimer = setTimeout(escalateForceKill, FORCE_KILL_GRACE_MS);
      }
    };
    return {
      stop: () => {
        if (settled || stopped) return;
        stopped = true;
        stopChild();
      },
      done
    };
  }

  // src/dock/runner.ts
  var deps;
  function setDockRuntimeDeps(d) {
    deps = d;
  }
  function vaultBasePath(app2) {
    var _a;
    const adapter = app2.vault.adapter;
    try {
      return (_a = adapter == null ? void 0 : adapter.getBasePath) == null ? void 0 : _a.call(adapter);
    } catch (e) {
      return void 0;
    }
  }
  function dockEnvOf(entry, app2, trigger = "manual") {
    const vaultPath = vaultBasePath(app2);
    const env = {
      BZ_DOCK_CONTRACT: "1",
      BZ_DOCK_TOOL: entry.id,
      // 本次是 bz 按节奏自动触发（auto）还是用户手动（manual）—— 工具据此给记录标 `trigger`。
      // 工具**不需要**猜：bz 是父进程，它最清楚这次是被谁拉起来的。
      BZ_DOCK_TRIGGER: trigger,
      // 记录就写在工具目录里（与声明、参数值同一层）—— 路径从声明文件位置推出来，天然是绝对值。
      // 从前这里是「vault 根 + vault 内相对路径」，而工具进程的 cwd 是它自己的目录，相对路径
      // 会被解析到那儿去（记录写进了 `<工具目录>/CONFIG/...`，bz 在 vault 里找不到）。
      BZ_DOCK_RUNS_FILE: runsPathFor(entry.path)
    };
    if (vaultPath) env.BZ_DOCK_VAULT = vaultPath.replace(/[\\/]+$/, "");
    return env;
  }
  var live2 = /* @__PURE__ */ new Map();
  var lastRawTails = /* @__PURE__ */ new Map();
  function lastRawTailOf(toolId) {
    return lastRawTails.get(toolId);
  }
  function liveRunOf(toolId) {
    return live2.get(toolId);
  }
  function liveRunsAll() {
    const at = (r) => {
      const t = Date.parse(r.startedAt);
      return Number.isFinite(t) ? t : 0;
    };
    return Array.from(live2.values()).sort((a, b) => at(a) - at(b));
  }
  function stopRun(toolId) {
    var _a;
    (_a = live2.get(toolId)) == null ? void 0 : _a.handle.stop();
  }
  function runTool(app2, entry, launch, manifest, values, cb = {}, opts = {}) {
    var _a;
    const startedAtDate = /* @__PURE__ */ new Date();
    const startedAt = startedAtDate.toISOString();
    const rawTail = [];
    const spec = {
      cmd: launch.cmd,
      args: [...launch.args, ...buildArgs(manifest != null ? manifest : { params: [] }, values)],
      shell: launch.shell,
      cwd: launch.cwd,
      env: dockEnvOf(entry, app2, (_a = opts.trigger) != null ? _a : "manual")
    };
    const steps = [];
    const infos = [];
    let result;
    const myProgress = { phase: null, pct: null };
    const handle = runExternalTool(
      spec,
      {
        onStep: (text) => {
          var _a2;
          steps.push({ text, at: (/* @__PURE__ */ new Date()).toISOString(), status: "ok" });
          (_a2 = cb.onStep) == null ? void 0 : _a2.call(cb, text);
        },
        onProgress: (phase, pct) => {
          var _a2;
          myProgress.phase = phase;
          myProgress.pct = pct;
          (_a2 = cb.onProgress) == null ? void 0 : _a2.call(cb, phase, pct);
        },
        onInfo: (data) => {
          var _a2;
          infos.push({ at: (/* @__PURE__ */ new Date()).toISOString(), data });
          (_a2 = cb.onInfo) == null ? void 0 : _a2.call(cb, data);
        },
        onResult: (data) => {
          var _a2;
          result = data;
          (_a2 = cb.onResult) == null ? void 0 : _a2.call(cb, data);
        },
        onRaw: (t) => {
          rawTail.push(t);
          if (rawTail.length > 200) rawTail.shift();
        }
      },
      deps
    );
    const run = {
      toolId: entry.id,
      startedAt,
      steps,
      progress: myProgress,
      infos,
      result,
      rawTail,
      handle,
      done: void 0
    };
    run.done = handle.done.then((o) => {
      var _a2;
      const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
      const outcome = {
        ok: o.ok,
        stopped: o.stopped,
        code: o.code,
        stderr: o.stderr,
        error: o.error,
        kind: classify(o),
        startedAt,
        finishedAt,
        durationMs: new Date(finishedAt).getTime() - startedAtDate.getTime()
      };
      live2.delete(entry.id);
      if (rawTail.length) lastRawTails.set(entry.id, rawTail.slice(-50));
      (_a2 = cb.onDone) == null ? void 0 : _a2.call(cb, outcome, run);
      return outcome;
    });
    live2.set(entry.id, run);
    return run;
  }
  function classify(o) {
    if (o.stopped) return "aborted";
    if (o.ok) return "unknown";
    if (o.code === null) return "config";
    return "unknown";
  }
  function statusText(status) {
    switch (status) {
      case "ok":
        return "成功";
      case "failed":
        return "失败";
      case "stopped":
        return "已中止";
      case "timeout":
        return "超时";
      case "running":
        return "运行中";
      default:
        return status;
    }
  }
  function errorHint(kind) {
    switch (kind) {
      case "auth":
        return "登录态已失效，去重新导出凭据（cookie / token）";
      case "network":
        return "网络不通，检查代理或稍后重试";
      case "config":
        return "命令或参数配错了，检查工具的命令路径与工作目录";
      case "timeout":
        return "执行超时，可能是网络慢或任务量变大";
      case "aborted":
        return "被手动中止";
      default:
        return "查看运行记录里的 stderr 尾部定位";
    }
  }
  function notifyRunOutcome(name, outcome, onView) {
    const secs = (outcome.durationMs / 1e3).toFixed(outcome.durationMs < 1e4 ? 1 : 0);
    const action = onView ? { label: "查看", onClick: onView } : void 0;
    if (outcome.ok) {
      notify(`${name} 完成（${secs} 秒）`, { type: "success", action });
      return;
    }
    if (outcome.stopped) {
      notify(`${name} 已中止`, { type: "warning", action });
      return;
    }
    notify(`${name} 失败：${errorHint(outcome.kind)}`, { type: "error", action });
  }
  function initialValuesOf(params, stored = {}) {
    const out = {};
    for (const p of params != null ? params : []) {
      if (p.default !== void 0) out[p.key] = p.default;
      else if (p.type === "bool") out[p.key] = false;
      else if (p.type === "multichoice") out[p.key] = [];
    }
    for (const p of params != null ? params : []) {
      if (Object.prototype.hasOwnProperty.call(stored, p.key)) out[p.key] = stored[p.key];
    }
    return out;
  }

  // src/core/domain-bus.ts
  var channels = /* @__PURE__ */ new Map();
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

  // src/dock/scheduler.ts
  var FAIL_COOLDOWN_MS = 15 * 6e4;
  var BREAKER_THRESHOLD = 3;
  var RUN_TIMEOUT_MS = 10 * 6e4;
  var VAULT_CHANNELS = ["vault:md-created", "vault:md-modified", "vault:md-deleted"];
  var app = null;
  var isUnloaded = null;
  var sessionStart = 0;
  var inFlight = /* @__PURE__ */ new Set();
  var cooldownUntil = /* @__PURE__ */ new Map();
  var chain = Promise.resolve();
  var warnedParams = /* @__PURE__ */ new Set();
  var pendingEvents = [];
  var subscriptions = /* @__PURE__ */ new Map();
  var ticking = false;
  var kickQueued = false;
  function globalAutoOn() {
    return readDockSwitch("autoRun");
  }
  function kickDockScheduler() {
    if (app === null) return;
    void tick();
  }
  function notifyDockEvent(ev) {
    if (app === null) return;
    pendingEvents.push(ev);
    if (ticking) {
      kickQueued = true;
      return;
    }
    kickDockScheduler();
  }
  function pathOfPayload(evt) {
    var _a;
    const e = evt;
    if (!e) return "";
    if (typeof e.path === "string") return e.path;
    const p = (_a = e.file) == null ? void 0 : _a.path;
    return typeof p === "string" ? p : "";
  }
  function fromBus(channel, evt) {
    if (channel.startsWith("vault:")) return { kind: "vault-file", path: pathOfPayload(evt) };
    return { kind: "domain-event", channel };
  }
  function syncSubscriptions(views2) {
    const wanted = /* @__PURE__ */ new Set();
    for (const v of views2) {
      for (const r of v.rules) {
        if (r.enabled === false) continue;
        if (r.trigger.kind === "domain-event") wanted.add(r.trigger.channel);
        else if (r.trigger.kind === "vault-file") for (const c of VAULT_CHANNELS) wanted.add(c);
      }
    }
    for (const [ch, off] of [...subscriptions]) {
      if (!wanted.has(ch)) {
        off();
        subscriptions.delete(ch);
      }
    }
    for (const ch of wanted) {
      if (subscriptions.has(ch)) continue;
      subscriptions.set(
        ch,
        onDomainEvent(ch, (evt) => notifyDockEvent(fromBus(ch, evt)))
      );
    }
  }
  function runGate(v, now) {
    var _a, _b, _c;
    if (!isEnabled(v.entry)) return "disabled";
    if (!isTrusted(v.entry)) return "untrusted";
    if (v.trustStale) return "trust-stale";
    if (!v.run) return "no-run";
    if ((_a = v.runState) == null ? void 0 : _a.pausedAt) return "paused";
    if (inFlight.has(v.entry.id) || liveRunOf(v.entry.id) !== void 0) return "running";
    if (((_b = cooldownUntil.get(v.entry.id)) != null ? _b : 0) > now) return "cooldown";
    if (missingRequiredParams((_c = v.manifest) == null ? void 0 : _c.params, v.values).length > 0) return "params";
    return null;
  }
  function remindGate(v) {
    return isEnabled(v.entry) ? null : "disabled";
  }
  var valueCache = /* @__PURE__ */ new Map();
  var VALUE_TTL_MS = 1e4;
  async function readJsonNumber(a, path, key) {
    try {
      const raw = await a.vault.adapter.read(path);
      const obj = JSON.parse(raw);
      const v = key.split(".").reduce(
        (o, k) => typeof o === "object" && o !== null ? o[k] : void 0,
        obj
      );
      return typeof v === "number" ? v : void 0;
    } catch (e) {
      return void 0;
    }
  }
  async function cachedValue(key, read) {
    const hit = valueCache.get(key);
    const now = Date.now();
    if (hit && now - hit.at < VALUE_TTL_MS) return hit.v;
    const v = await read();
    valueCache.set(key, { at: now, v });
    return v;
  }
  async function thresholdValueOf(a, t) {
    if (t.kind !== "data-threshold") return void 0;
    return cachedValue(`${t.path}#${t.key}`, () => readJsonNumber(a, t.path, t.key));
  }
  async function tick() {
    if (app === null || isUnloaded === null) return;
    if (isUnloaded()) return;
    if (ticking) return;
    ticking = true;
    try {
      try {
        await loadDockStore();
      } catch (e) {
      }
      if (!globalAutoOn()) return;
      let views2;
      try {
        views2 = await loadToolViews(app);
      } catch (e) {
        return;
      }
      if (isUnloaded()) return;
      syncSubscriptions(views2);
      const now = Date.now();
      const events = pendingEvents;
      pendingEvents = [];
      for (const v of views2) {
        if (!v.rules.length) continue;
        for (const rule of v.rules) {
          if (rule.enabled === false) continue;
          const lastFiredAt = v.ruleFiredAt[rule.id];
          const base = { now, lastFiredAt, sessionStart };
          const value = rule.trigger.kind === "data-threshold" ? await thresholdValueOf(app, rule.trigger) : void 0;
          const ctx = value === void 0 ? base : { ...base, value };
          const hit = ruleDue(rule, ctx) || events.some((e) => {
            if ((e.kind === "tool-ok" || e.kind === "tool-fail") && e.toolId === v.entry.id) {
              return false;
            }
            return ruleDue(rule, { ...ctx, event: e });
          });
          if (!hit) continue;
          const isRemind = rule.action.kind === "remind";
          const gate = isRemind ? remindGate(v) : runGate(v, now);
          if (gate === "params" && !warnedParams.has(v.entry.id)) {
            warnedParams.add(v.entry.id);
            notify(`${displayName(v)} 没自动跑：必填参数还没填`, { type: "warning" });
          }
          if (gate) continue;
          await patchRuleFired(v.entry.id, rule.id, now);
          if (isRemind) remindOf(v, rule);
          else scheduleRun(v, rule);
        }
      }
    } finally {
      ticking = false;
      if (kickQueued) {
        kickQueued = false;
        void tick();
      }
    }
  }
  function remindOf(v, rule) {
    var _a;
    const why = ((_a = rule.name) == null ? void 0 : _a.trim()) ? rule.name.trim() : "规则";
    notify(`${displayName(v)}：该手动跑一次了（${why}）`, {
      type: "info",
      action: { label: "查看", onClick: () => openDockTool(app, v.entry.id) }
    });
  }
  function scheduleRun(v, rule) {
    var _a;
    const min = (_a = rule.jitterMin) != null ? _a : 0;
    const delayMs = min > 0 ? Math.floor(Math.random() * min * 6e4) : 0;
    const go = () => {
      const batch = chain.then(() => runOne(v));
      chain = batch.then(
        () => void 0,
        () => void 0
      );
    };
    if (delayMs > 0) setTimeout(go, delayMs);
    else go();
  }
  async function runOne(view2) {
    var _a, _b;
    const launch = view2.run;
    if (app === null || !launch) return "skip";
    const entry = view2.entry;
    inFlight.add(entry.id);
    const handle = runTool(app, entry, launch, view2.manifest, view2.values, {}, { trigger: "auto" });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      stopRun(entry.id);
    }, RUN_TIMEOUT_MS);
    let outcome;
    try {
      outcome = await handle.done;
    } finally {
      clearTimeout(timer);
      inFlight.delete(entry.id);
    }
    if (outcome.ok) {
      await recordRunSuccess(entry.id, outcome.finishedAt);
      notifyDockEvent({ kind: "tool-ok", toolId: entry.id });
      return "ok";
    }
    if (outcome.stopped && !timedOut) return "skip";
    const failures = ((_b = (_a = view2.runState) == null ? void 0 : _a.consecutiveFailures) != null ? _b : 0) + 1;
    const trip = failures >= BREAKER_THRESHOLD;
    await patchRunState(entry.id, {
      lastAttemptAt: outcome.finishedAt,
      lastAttemptOk: false,
      consecutiveFailures: failures,
      ...trip ? { pausedAt: outcome.finishedAt } : {}
    });
    cooldownUntil.set(entry.id, Date.now() + FAIL_COOLDOWN_MS);
    notify(`${displayName(view2)} 自动运行失败：${errorHint(timedOut ? "timeout" : outcome.kind)}`, {
      type: "error",
      action: { label: "查看", onClick: () => openDockTool(app, view2.entry.id) }
    });
    if (trip) {
      notify(`${displayName(view2)} 连续失败 ${failures} 次，已暂停自动运行（面板里可恢复）`, {
        type: "warning"
      });
    }
    notifyDockEvent({ kind: "tool-fail", toolId: entry.id });
    return "fail";
  }

  // src/dock/ui.ts
  var hostApp = null;
  var overlay = null;
  var escHandle = null;
  var view = { kind: "list" };
  var query = "";
  var searchOpen = false;
  var kpiFilter = "all";
  var refreshing = false;
  var views = [];
  var draftValues = /* @__PURE__ */ new Map();
  var valueSaveTimers = /* @__PURE__ */ new Map();
  var VALUE_SAVE_DEBOUNCE_MS = 500;
  var dueNotified = /* @__PURE__ */ new Set();
  var autoDraft = /* @__PURE__ */ new Map();
  var OVERLAY_ID = "bz-dock-mask";
  var FRAME_ID = "bz-dock-panel";
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== void 0) n.textContent = text;
    return n;
  }
  function todayKey() {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function openArtifact(p) {
    var _a, _b, _c, _d;
    const w = window;
    const shell = (_b = (_a = w.require) == null ? void 0 : _a.call(w, "electron")) == null ? void 0 : _b.shell;
    if (!shell) {
      void copyText(p, "产物路径");
      return;
    }
    const norm = p.replace(/\\/g, "/");
    const isAbsolute = /^[a-zA-Z]:\//.test(norm) || norm.startsWith("//") || norm.startsWith("/");
    if (!isAbsolute && hostApp) {
      const file = hostApp.vault.getAbstractFileByPath(norm);
      if (file) {
        void hostApp.workspace.openLinkText(norm, "", true);
        return;
      }
    }
    const base = hostApp ? (_d = (_c = hostApp.vault.adapter) == null ? void 0 : _c.getBasePath) == null ? void 0 : _d.call(_c) : void 0;
    shell.showItemInFolder(isAbsolute || !base ? p : `${base}/${norm}`);
  }
  async function copyText(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      notice(`已复制${what}`);
    } catch (e) {
      notice(`复制失败，请手动复制：${text}`, "warning");
    }
  }
  function dotClass(health) {
    switch (health) {
      case "ok":
        return "bz-dock-dot bz-dock-dot--ok";
      case "due":
      case "failed":
      case "timeout":
        return "bz-dock-dot bz-dock-dot--bad";
      case "pending":
      case "running":
      case "stopped":
        return "bz-dock-dot bz-dock-dot--warn";
      default:
        return "bz-dock-dot bz-dock-dot--idle";
    }
  }
  function whenTextOf(v, last) {
    if (v.runsUnreadable) return "记录读不懂";
    if (!last) return "还没有运行过";
    return relTime(last.startedAt.replace("T", " "));
  }
  function messageTextOf(v, last) {
    if (v.runsUnreadable) return "文件在，但内容不合契约";
    const live3 = liveRunOf(v.entry.id);
    if (live3) return live3.progress.phase ? `正在${live3.progress.phase}…` : "正在运行…";
    if (!v.manifest) return "声明文件读不到，先把路径修好";
    if (!v.run) return "没写怎么跑（既无 run 段，目录里也没有 main.mjs）";
    if (!last) return "等它按自己的节奏跑一次";
    return last.message || statusText(last.status);
  }
  function failHintOf(last) {
    if (!last || !last.error) return null;
    if (last.status === "ok" || last.status === "running") return null;
    return errorHint(last.error.kind);
  }
  function viewById(id) {
    return views.find((v) => v.entry.id === id);
  }
  function canRun() {
    return !Platform.isMobile;
  }
  function canStart(v) {
    return canRun() && isTrusted(v.entry) && !v.trustStale && !!v.run;
  }
  function trustTagOf(v) {
    if (!isTrusted(v.entry)) return "未信任";
    if (v.trustStale) return "命令已变，待重新确认";
    return null;
  }
  function openDock(app2) {
    var _a;
    hostApp = app2;
    if (!overlay) build(app2);
    topifyZ(overlay);
    overlay.classList.remove("is-off");
    trapPanelFocus((_a = overlay.querySelector(`#${FRAME_ID}`)) != null ? _a : overlay);
    escHandle == null ? void 0 : escHandle.unregister();
    escHandle = escManager.register("bz-dock", {
      isVisible: () => isPanelVisible(),
      close: () => closeDock()
    });
    render();
    void refresh();
    notifyDockEvent({ kind: "panel-open" });
  }
  function closeDock() {
    overlay == null ? void 0 : overlay.classList.add("is-off");
  }
  function openDockTool(app2, id) {
    view = { kind: "detail", id };
    openDock(app2);
  }
  function unloadDock() {
    for (const v of views) saveValuesNow(v);
    hostApp = null;
    escHandle == null ? void 0 : escHandle.unregister();
    escHandle = null;
    overlay == null ? void 0 : overlay.remove();
    overlay = null;
    views = [];
    view = { kind: "list" };
    draftValues.clear();
    for (const t of valueSaveTimers.values()) clearTimeout(t);
    valueSaveTimers.clear();
    dueNotified.clear();
    autoDraft.clear();
  }
  function isPanelVisible() {
    return !!overlay && !overlay.classList.contains("is-off");
  }
  function build(app2) {
    const ov = el("div", "bz-panel-overlay bz-dock-mask is-off");
    ov.id = OVERLAY_ID;
    const frame = el("div", "bz-panel-frame bz-dock-panel bz-panel-mtop");
    frame.id = FRAME_ID;
    const head = el("div", "bz-panel-head");
    const brand = el("div", "bz-panel-brand");
    brand.appendChild(uiIcon("square-terminal"));
    const title = el("div", "bz-panel-title", "工具坞");
    const pipe = el("div", "bz-panel-head-pipe");
    const sub = el("div", "bz-panel-head-sub");
    sub.id = "bz-dock-headsub";
    const sp = el("div", "bz-panel-head-sp");
    const btns = el("div", "bz-panel-head-btns");
    btns.id = "bz-dock-headbtns";
    head.append(brand, title, pipe, sub, sp, btns);
    const kpi = el("div", "bz-dock-kpi");
    kpi.id = "bz-dock-kpi";
    const runbar = el("div", "bz-dock-runbar");
    runbar.id = "bz-dock-runbar";
    const bar = el("div", "bz-dock-bar");
    bar.id = "bz-dock-bar";
    const body = el("div", "bz-dock-body");
    body.id = "bz-dock-body";
    frame.append(head, kpi, runbar, bar, body);
    ov.appendChild(frame);
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeDock();
    });
    document.body.appendChild(ov);
    overlay = ov;
  }
  function kpiEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-kpi")) != null ? _a : null;
  }
  function runbarEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-runbar")) != null ? _a : null;
  }
  function barEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-bar")) != null ? _a : null;
  }
  function bodyEl() {
    var _a;
    return (_a = overlay == null ? void 0 : overlay.querySelector("#bz-dock-body")) != null ? _a : null;
  }
  async function refresh() {
    if (!hostApp || refreshing) return;
    refreshing = true;
    renderHead();
    try {
      await loadDockStore();
      views = await loadToolViews(hostApp);
      runDueNotifications();
    } catch (e) {
      console.warn("[dock] 载入工具视图失败", e);
      notice("工具坞载入失败，详见控制台", "error");
    } finally {
      refreshing = false;
      render();
    }
  }
  function runDueNotifications() {
    if (!readDockSwitch("notifyMissed")) return;
    const day = todayKey();
    for (const v of views) {
      if (!isEnabled(v.entry)) continue;
      if (v.due.state !== "due") continue;
      if (willAutoRun(v)) continue;
      const key = `${v.entry.id}:${day}`;
      if (dueNotified.has(key)) continue;
      dueNotified.add(key);
      notify(`${displayName(v)} 今天该跑没跑：${v.due.detail}`, {
        type: "warning",
        dedupeKey: `dock-due-${key}`,
        action: { label: "查看", onClick: () => openDockTool(hostApp, v.entry.id) }
      });
    }
  }
  function willAutoRun(v) {
    var _a, _b;
    if (!readDockSwitch("autoRun")) return false;
    if (!isEnabled(v.entry) || !isTrusted(v.entry) || v.trustStale) return false;
    if (!v.run || !hasActiveRule(v.rules)) return false;
    if ((_a = v.runState) == null ? void 0 : _a.pausedAt) return false;
    return missingRequiredParams((_b = v.manifest) == null ? void 0 : _b.params, v.values).length === 0;
  }
  function render() {
    renderHead();
    renderKpi();
    renderRunbar();
    renderBar();
    renderBody();
  }
  function renderKpi() {
    const host = kpiEl();
    if (!host) return;
    host.innerHTML = "";
    if (!views.length || view.kind === "detail") {
      host.classList.add("is-off");
      return;
    }
    host.classList.remove("is-off");
    const o = overview(views);
    const tile = (num2, unit, label, sub, tone, key) => {
      const t = el("div", tone ? `bz-dock-kpi-tile is-${tone}` : "bz-dock-kpi-tile");
      const v = el("div", "bz-dock-kpi-v", num2);
      if (unit) v.appendChild(el("small", void 0, unit));
      t.appendChild(v);
      t.appendChild(el("div", "bz-dock-kpi-l", label));
      t.appendChild(el("div", tone === "up" ? "bz-dock-kpi-d is-up" : "bz-dock-kpi-d", sub));
      if (key) {
        t.classList.add("is-click");
        if (kpiFilter === key) t.classList.add("is-selected");
        t.addEventListener("click", () => {
          kpiFilter = kpiFilter === key ? "all" : key;
          renderKpi();
          renderBody();
        });
      }
      return t;
    };
    const left = o.autoTotal - o.autoDoneToday;
    host.appendChild(
      tile(
        String(o.autoDoneToday),
        ` / ${o.autoTotal}`,
        "今日自动化达标",
        o.autoTotal === 0 ? "还没有自动化工具" : left > 0 ? `还差 ${left} 个` : "今天都跑成了",
        o.autoTotal > 0 && left > 0 ? "warn" : void 0
      )
    );
    host.appendChild(
      tile(
        o.rate7d === null ? "—" : String(Math.round(o.rate7d * 100)),
        o.rate7d === null ? "" : "%",
        "近 7 天成功率",
        o.runs7d ? `${o.runs7d} 次里成功 ${o.ok7d} 次` : "还没有可比的记录"
      )
    );
    host.appendChild(
      tile(
        String(o.alarms),
        "",
        "待处理异常",
        o.alarmHint ? `${o.alarmHint.name} · ${o.alarmHint.reason}` : "没有要管的事",
        o.alarms ? "bad" : void 0,
        "alarms"
      )
    );
    if (o.nextDue) {
      const left2 = untilText(o.nextDue.at - Date.now());
      host.appendChild(tile(left2.num, left2.unit, "距下次到期", o.nextDue.name));
    } else {
      host.appendChild(tile("—", "", "距下次到期", "没有能算出下次到期的工具"));
    }
  }
  function untilText(ms) {
    const m = ms / 6e4;
    if (m < 60) return { num: String(Math.max(1, Math.round(m))), unit: "m" };
    const h = m / 60;
    if (h < 24) return { num: String(Math.round(h)), unit: "h" };
    return { num: String(Math.round(h / 24)), unit: "d" };
  }
  function renderRunbar() {
    const host = runbarEl();
    if (!host) return;
    host.innerHTML = "";
    const runs = liveRunsAll();
    if (!runs.length || view.kind === "detail") {
      host.classList.add("is-off");
      return;
    }
    host.classList.remove("is-off");
    for (const run of runs) host.appendChild(makeRunbarRow(run));
  }
  function makeRunbarRow(run) {
    var _a;
    const row = el("div", "bz-dock-rb");
    row.dataset.tool = run.toolId;
    row.appendChild(el("span", "bz-dock-rb-pulse"));
    const v = viewById(run.toolId);
    row.appendChild(el("span", "bz-dock-rb-name", v ? displayName(v) : run.toolId));
    row.appendChild(
      el("span", "bz-dock-rb-phase", run.progress.phase ? `正在${run.progress.phase}…` : "运行中…")
    );
    const lastStep = run.steps.length ? run.steps[run.steps.length - 1].text : "";
    row.appendChild(el("span", "bz-dock-rb-step", lastStep));
    const bar = uiProgress({ value: (_a = run.progress.pct) != null ? _a : 0 });
    bar.el.classList.add("bz-dock-rb-track");
    if (run.progress.pct === null) bar.el.classList.add("is-indeterminate");
    row.appendChild(bar.el);
    row.appendChild(el("span", "bz-dock-rb-pct", run.progress.pct === null ? "—" : `${Math.round(run.progress.pct)}%`));
    if (canRun()) {
      row.appendChild(
        uiBtn({
          label: "停止",
          icon: "square",
          tone: "danger",
          size: "sm",
          onClick: () => stopRun(run.toolId)
        })
      );
    }
    return row;
  }
  function renderHead() {
    var _a;
    const headEl = (_a = overlay == null ? void 0 : overlay.querySelector(".bz-panel-head")) != null ? _a : null;
    if (!headEl) return;
    if (view.kind === "detail") {
      const v = viewById(view.id);
      if (v) {
        renderToolHead(headEl, v);
        return;
      }
    }
    headEl.classList.remove("bz-dock-toolhead");
    let sub = headEl.querySelector("#bz-dock-headsub");
    let btns = headEl.querySelector("#bz-dock-headbtns");
    if (!sub || !btns) {
      headEl.innerHTML = "";
      const brand = el("div", "bz-panel-brand");
      brand.appendChild(uiIcon("square-terminal"));
      sub = el("div", "bz-panel-head-sub");
      sub.id = "bz-dock-headsub";
      btns = el("div", "bz-panel-head-btns");
      btns.id = "bz-dock-headbtns";
      headEl.append(
        brand,
        el("div", "bz-panel-title", "工具坞"),
        el("div", "bz-panel-head-pipe"),
        sub,
        el("div", "bz-panel-head-sp"),
        btns
      );
    }
    const s = summarize(views);
    sub.textContent = views.length ? `${s.total} 个工具${s.overdue ? ` · ${s.overdue} 个待关注` : ""}` : "还没有登记任何外部工具";
    btns.innerHTML = "";
    btns.append(
      uiIconBtn({
        icon: "search",
        title: "搜索工具",
        on: searchOpen,
        onClick: () => {
          searchOpen = !searchOpen;
          render();
        }
      }),
      uiIconBtn({
        icon: "refresh-cw",
        title: "重新读取运行记录",
        disabled: refreshing,
        onClick: () => void refresh()
      }),
      uiIconBtn({
        icon: "plus",
        title: "导入工具声明",
        onClick: () => importToolFlow()
      }),
      uiIconBtn({
        icon: "x",
        title: "关闭",
        // ⚠️ 刻意**不**传 close:true —— 那个标记会带上 `bz-icon-btn--close`，而 core/styles.css 有
        // `button.bz-icon-btn--close { display: none !important }`（「非真全屏一律隐藏关闭钮」），
        // 域内后置的移动端 display 覆盖不动 !important。桌面对齐：关闭钮显隐由本域自己管。
        className: "bz-dock-close",
        onClick: () => closeDock()
      })
    );
  }
  function renderToolHead(host, v) {
    host.innerHTML = "";
    host.classList.add("bz-dock-toolhead");
    const back = uiIconBtn({
      icon: "chevron-left",
      title: "返回列表",
      className: "bz-dock-back",
      onClick: () => {
        view = { kind: "list" };
        render();
      }
    });
    const main = el("div", "bz-dock-covermain");
    const ic = el("div", "bz-dock-coveric");
    ic.appendChild(uiIcon(displayIcon(v), "bz-ic--lg"));
    const txt = el("div", "bz-dock-covertxt");
    const line = el("div", "bz-dock-coverline");
    line.appendChild(el("div", "bz-dock-detail-name", displayName(v)));
    const tags = el("div", "bz-dock-detail-tags");
    if (isOverdue(v.due.state)) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--due", v.due.detail));
    const trustTag = trustTagOf(v);
    if (trustTag) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", trustTag));
    if (tags.children.length) line.appendChild(tags);
    txt.appendChild(line);
    const desc = displayDesc(v);
    if (desc) txt.appendChild(el("div", "bz-dock-detail-desc", desc));
    main.append(back, ic, txt);
    host.appendChild(main);
  }
  function renderBar() {
    const bar = barEl();
    if (!bar) return;
    bar.innerHTML = "";
    if (refreshing) bar.classList.add("is-loading");
    else bar.classList.remove("is-loading");
    if (!searchOpen || view.kind === "detail") {
      bar.classList.add("is-off");
      return;
    }
    bar.classList.remove("is-off");
    const sp = el("div", "bz-dock-search");
    const search = uiSearch({
      placeholder: "搜工具名 / 描述 / 命令",
      value: query,
      onInput: (v) => {
        query = v;
        renderBody();
      }
    });
    sp.appendChild(search.el);
    bar.appendChild(sp);
    if (!Platform.isMobile) queueMicrotask(() => search.input.focus());
  }
  function isAlarmView(v) {
    return isAlarm(v.runs, isOverdue(v.due.state));
  }
  function filtered() {
    let list = views.slice();
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((v) => {
        var _a, _b;
        const hay = [v.entry.id, displayName(v), displayDesc(v), (_b = (_a = v.run) == null ? void 0 : _a.cmd) != null ? _b : v.declPath].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (kpiFilter === "alarms") list = list.filter(isAlarmView);
    return list;
  }
  function renderBody() {
    const body = bodyEl();
    if (!body) return;
    body.innerHTML = "";
    if (view.kind === "detail") {
      const v = viewById(view.id);
      if (v) {
        renderDetail(body, v);
        return;
      }
      view = { kind: "list" };
    }
    renderList(body);
  }
  function renderList(body) {
    if (!views.length) {
      body.appendChild(
        uiEmpty({
          icon: "square-terminal",
          title: "还没有外部工具",
          desc: "选一个工具的声明文件（manifest.json），工具坞就知道它叫什么、有哪些参数、该怎么跑；运行记录也归它收口",
          actions: uiBtnRow(
            [uiBtn({ label: "导入声明文件", icon: "file-input", tone: "primary", onClick: () => importToolFlow() })],
            { center: true }
          )
        })
      );
      return;
    }
    const list = filtered();
    if (!list.length) {
      body.appendChild(
        uiEmpty({
          icon: "search-x",
          title: "没有匹配的工具",
          desc: kpiFilter === "alarms" ? "这个口径下没有 —— 点顶上的 KPI 格回到全部" : "换个词试试"
        })
      );
      return;
    }
    const grid = el("div", "bz-dock-grid");
    for (const v of list) grid.appendChild(makeCard(v));
    body.appendChild(grid);
  }
  function makeCard(v) {
    var _a;
    const id = v.entry.id;
    const card = el("article", "bz-dock-card");
    card.dataset.tool = id;
    if (isOverdue(v.due.state)) card.classList.add("is-due");
    if (!isEnabled(v.entry)) card.classList.add("is-disabled");
    if (liveRunOf(id)) card.classList.add("is-running");
    const top = el("div", "bz-dock-card-top");
    const ic = el("span", "bz-dock-card-ic");
    ic.appendChild(uiIcon(displayIcon(v), "bz-ic--md"));
    const idbox = el("div", "bz-dock-card-idbox");
    const name = el("div", "bz-dock-card-name", displayName(v));
    const tags = el("div", "bz-dock-card-tags");
    if (isOverdue(v.due.state)) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--due", "今日未跑"));
    const trustTag = trustTagOf(v);
    if (trustTag) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", trustTag));
    if (!v.manifest) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--muted", "声明读不到"));
    if (v.manifest && !v.run) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--muted", "只能看"));
    if ((_a = v.runState) == null ? void 0 : _a.pausedAt) tags.appendChild(el("span", "bz-dock-tag bz-dock-tag--warn", "自动已暂停"));
    idbox.append(name, tags);
    top.append(ic, idbox);
    card.appendChild(top);
    const desc = displayDesc(v);
    if (desc) card.appendChild(el("div", "bz-dock-card-desc", desc));
    const state = el("div", "bz-dock-card-state");
    const last = lastOf(v);
    state.appendChild(el("span", dotClass(last ? last.status : v.due.state)));
    state.appendChild(el("span", "bz-dock-card-when", whenTextOf(v, last)));
    state.appendChild(el("span", "bz-dock-card-msg", messageTextOf(v, last)));
    const rate = successRate(v.runs);
    if (rate !== null) {
      const rateEl = el("span", "bz-dock-rate", `${Math.round(rate * 100)}% 成功`);
      rateEl.title = `${v.runs.length} 条记录里成功了几条`;
      if (rate < 1) rateEl.classList.add("is-warn");
      state.appendChild(rateEl);
    }
    card.appendChild(state);
    const hint = failHintOf(last);
    if (hint) {
      const box = el("div", "bz-dock-card-fail");
      box.appendChild(uiIcon("alert-triangle", "bz-ic--xs"));
      box.appendChild(el("span", "bz-dock-card-failtext", hint));
      card.appendChild(box);
    }
    const strip = el("div", "bz-dock-strip");
    strip.title = "最近 7 次运行（左旧右新）";
    for (const r of recentRuns(v.runs, 7)) {
      const cell = el("i", "bz-dock-pip");
      if (r) {
        cell.classList.add(`bz-dock-pip--${r.status}`);
        cell.title = `${relTime(r.startedAt.replace("T", " "))} · ${statusText(r.status)}${r.message ? ` · ${r.message}` : ""}`;
      } else {
        cell.title = "这一次没有运行记录";
      }
      strip.appendChild(cell);
    }
    card.appendChild(strip);
    const foot = el("div", "bz-dock-card-foot");
    if (canRun()) {
      const live3 = liveRunOf(id);
      if (live3) {
        foot.appendChild(
          uiBtn({
            label: "停止",
            icon: "square",
            tone: "danger",
            size: "sm",
            onClick: () => {
              stopRun(id);
            }
          })
        );
      } else {
        foot.appendChild(
          uiBtn({
            label: "运行",
            icon: "play",
            tone: "primary",
            size: "sm",
            disabled: !canStart(v),
            onClick: () => void runFlow(v)
          })
        );
      }
    } else {
      foot.appendChild(el("span", "bz-dock-mobilehint", "移动端仅查看"));
    }
    card.appendChild(foot);
    attachItemActions(card, cardActions(v));
    card.addEventListener("click", (e) => {
      const t = e.target;
      if (t.closest("button")) return;
      view = { kind: "detail", id };
      render();
    });
    return card;
  }
  function lastOf(v) {
    return v.runs.slice().sort((a, b) => {
      var _a, _b;
      return ((_a = timeOf(b.startedAt)) != null ? _a : 0) - ((_b = timeOf(a.startedAt)) != null ? _b : 0);
    })[0];
  }
  function cardActions(v) {
    var _a;
    const id = v.entry.id;
    const acts = [
      {
        icon: "chevron-right",
        label: "打开详情",
        onClick: () => {
          view = { kind: "detail", id };
          render();
        }
      },
      {
        icon: "refresh-cw",
        label: "重新读声明",
        onClick: () => void reloadDeclaration(v)
      }
    ];
    if (canStart(v)) {
      acts.push({
        icon: "play",
        label: "运行",
        onClick: () => void runFlow(v)
      });
    }
    if ((_a = v.runState) == null ? void 0 : _a.pausedAt) {
      acts.push({ icon: "play", label: "恢复并立即重试", onClick: () => void resumeAndRetry(v) });
    }
    acts.push({ icon: "pencil", label: "重新导入声明", onClick: () => void importToolFlow(v.entry) });
    acts.push({
      icon: "trash-2",
      label: v.entry.enabled === false ? "启用" : "停用",
      onClick: () => void toggleEnabled(v.entry)
    });
    acts.push({
      icon: "x-circle",
      label: "移除登记",
      kind: "danger",
      onClick: () => void removeToolFlow(v)
    });
    return acts;
  }
  function clampInt(raw, lo, hi, fallback) {
    if (raw.trim() === "") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(hi, Math.max(lo, Math.round(n)));
  }
  function defaultTriggerOf(kind) {
    switch (kind) {
      case "daily":
        return { kind: "daily", at: "12:00" };
      case "interval":
        return { kind: "interval", everyMin: 60 };
      case "on-launch":
        return { kind: "on-launch", delayMin: 5 };
      case "panel-open":
        return { kind: "panel-open" };
      case "tool-ok":
        return { kind: "tool-ok", toolId: "" };
      case "tool-fail":
        return { kind: "tool-fail", toolId: "" };
      case "domain-event":
        return { kind: "domain-event", channel: "" };
      case "vault-file":
        return { kind: "vault-file", target: "" };
      case "data-threshold":
        return { kind: "data-threshold", path: "", key: "", op: ">", value: 0 };
    }
  }
  async function saveRules(v, next) {
    await updateToolEntry(v.entry.id, { rules: next });
    kickDockScheduler();
    await refresh();
  }
  async function removeRule(v, ruleId) {
    await saveRules(v, v.rules.filter((r) => r.id !== ruleId));
  }
  function openRuleEditor(v, rule) {
    var _a;
    const draft = rule ? { ...rule, trigger: { ...rule.trigger }, action: { ...rule.action } } : { id: newRuleId(), trigger: defaultTriggerOf("daily"), action: { kind: "run", notify: "fail" } };
    const form = el("div", "bz-dock-ruleform");
    const params = el("div", "bz-dock-ruleparams");
    const err = el("div", "bz-dock-ruleformerr");
    const preview = el("div", "bz-dock-rulepreview");
    const syncPreview = () => {
      const jit = draft.jitterMin ? ` · 抖 ${durationText(draft.jitterMin)}` : "";
      preview.textContent = `${triggerText(draft.trigger)} → ${actionText(draft.action)}${jit}`;
    };
    const rebuild = () => {
      params.replaceChildren(...triggerFields(draft, rebuild));
      syncPreview();
    };
    const triggerPick = uiChoice({
      options: TRIGGER_KINDS.map((k) => ({ value: k, label: TRIGGER_LABEL[k] })),
      value: draft.trigger.kind,
      label: "触发条件",
      onChange: (kind) => {
        draft.trigger = defaultTriggerOf(kind);
        rebuild();
      }
    });
    const actionPick = uiChoice({
      options: [
        { value: "run", label: "运行" },
        { value: "run-notify", label: "运行并提醒" },
        { value: "remind", label: "只提醒" }
      ],
      value: draft.action.kind === "remind" ? "remind" : draft.action.notify === "always" ? "run-notify" : "run",
      label: "执行",
      onChange: (val) => {
        draft.action = val === "remind" ? { kind: "remind" } : { kind: "run", notify: val === "run-notify" ? "always" : "fail" };
        syncPreview();
      }
    });
    const jitter = uiInput({
      type: "number",
      value: String((_a = draft.jitterMin) != null ? _a : 0),
      onInput: (val) => {
        draft.jitterMin = clampInt(val, 0, 720, 0);
        syncPreview();
      }
    });
    jitter.min = "0";
    form.appendChild(sectionOf("触发条件", [triggerPick.el, params]));
    form.appendChild(sectionOf("执行", [actionPick.el]));
    form.appendChild(
      sectionOf("随机延迟（错峰用）", [
        uiField({ label: "到点后再等", desc: "0 = 不抖", control: jitter }),
        quickRow(
          [
            { label: "不抖", value: 0 },
            { label: "2 分", value: 2 },
            { label: "10 分", value: 10 },
            { label: "30 分", value: 30 }
          ],
          (n) => {
            draft.jitterMin = n;
            jitter.value = String(n);
            syncPreview();
          }
        )
      ])
    );
    form.appendChild(preview);
    form.appendChild(err);
    rebuild();
    const { popup, close } = uiModal({
      head: true,
      title: rule ? "编辑规则" : "新建规则",
      content: form,
      maxWidth: 480,
      className: "bz-dock-rulemodal"
    });
    const problem = () => {
      const t = draft.trigger;
      if (t.kind === "tool-ok" || t.kind === "tool-fail") return t.toolId ? null : "还没选工具";
      if (t.kind === "domain-event") return t.channel.trim() ? null : "还没填事件通道";
      if (t.kind === "vault-file") return t.target.trim() ? null : "还没填目录";
      if (t.kind === "data-threshold") return t.path.trim() && t.key.trim() ? null : "还没填文件与键";
      return null;
    };
    const commit = () => {
      const next = rule ? v.rules.map((r) => r.id === rule.id ? draft : r) : [...v.rules, draft];
      close();
      void saveRules(v, next);
    };
    const ok = uiBtn({
      label: "保存",
      tone: "primary",
      size: "sm",
      onClick: () => {
        const p = problem();
        if (p) {
          err.textContent = p;
          return;
        }
        err.textContent = "";
        commit();
      }
    });
    const foot = el("div", "bz-dock-ruleformfoot");
    foot.appendChild(
      uiBtn({
        label: "取消",
        size: "sm",
        onClick: () => close()
      })
    );
    foot.appendChild(el("div", "bz-dock-ruleformsp"));
    if (rule) {
      foot.appendChild(
        uiBtn({
          label: "删除",
          size: "sm",
          danger: true,
          onClick: () => {
            close();
            void removeRule(v, rule.id);
          }
        })
      );
    }
    foot.appendChild(ok);
    form.appendChild(foot);
    bindFormSubmit(popup, () => ok.click());
  }
  function sectionOf(title, children) {
    const sec = el("div", "bz-dock-ruleformsec");
    sec.appendChild(el("div", "bz-dock-ruleformlegend", title));
    for (const c of children) sec.appendChild(c);
    return sec;
  }
  function quickRow(items, onPick) {
    const row = el("div", "bz-dock-rulequick");
    for (const it of items) {
      row.appendChild(uiBtn({ label: it.label, size: "sm", onClick: () => onPick(it.value) }));
    }
    return row;
  }
  function triggerFields(draft, rebuild) {
    const t = draft.trigger;
    switch (t.kind) {
      case "daily": {
        const inp = uiInput({
          type: "time",
          value: atSecondsOf(t.at) === void 0 ? "" : t.at,
          onInput: (val) => {
            draft.trigger = { kind: "daily", at: val || "12:00" };
          }
        });
        return [
          uiField({ label: "时刻", control: inp }),
          quickRow(
            [
              { label: "08:00", value: 8 * 60 },
              { label: "12:00", value: 12 * 60 },
              { label: "20:00", value: 20 * 60 }
            ],
            (mins) => {
              const at = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
              draft.trigger = { kind: "daily", at };
              rebuild();
            }
          )
        ];
      }
      case "interval": {
        const inp = uiInput({
          type: "number",
          value: String(t.everyMin),
          onInput: (val) => {
            draft.trigger = { kind: "interval", everyMin: clampInt(val, 1, 43200, 60) };
          }
        });
        inp.min = "1";
        return [
          uiField({ label: "每隔（分钟）", control: inp }),
          quickRow(
            [
              { label: "30 分", value: 30 },
              { label: "1 小时", value: 60 },
              { label: "6 小时", value: 360 },
              { label: "1 天", value: 1440 }
            ],
            (n) => {
              draft.trigger = { kind: "interval", everyMin: n };
              rebuild();
            }
          )
        ];
      }
      case "on-launch": {
        const inp = uiInput({
          type: "number",
          value: String(t.delayMin),
          onInput: (val) => {
            draft.trigger = { kind: "on-launch", delayMin: clampInt(val, 0, 1440, 5) };
          }
        });
        inp.min = "0";
        return [
          uiField({ label: "启动后等（分钟）", control: inp }),
          quickRow(
            [
              { label: "立刻", value: 0 },
              { label: "1 分", value: 1 },
              { label: "5 分", value: 5 },
              { label: "30 分", value: 30 }
            ],
            (n) => {
              draft.trigger = { kind: "on-launch", delayMin: n };
              rebuild();
            }
          )
        ];
      }
      case "panel-open":
        return [el("div", "bz-dock-ruleformhint", "打开工具坞面板时触发，没有要填的")];
      case "tool-ok":
      case "tool-fail": {
        const sel = uiSelect({
          options: [{ value: "", label: "选一个工具" }, ...toolOptions()],
          value: t.toolId,
          onChange: (val) => {
            draft.trigger = { kind: t.kind, toolId: val };
          }
        });
        return [uiField({ label: t.kind === "tool-ok" ? "哪个工具成功后" : "哪个工具失败后", control: sel.el })];
      }
      case "domain-event": {
        const inp = uiInput({
          type: "text",
          value: t.channel,
          placeholder: "域名:事件",
          onInput: (val) => {
            draft.trigger = { kind: "domain-event", channel: val };
          }
        });
        return [uiField({ label: "事件通道", desc: "如 people:changed", control: inp })];
      }
      case "vault-file": {
        const inp = uiInput({
          type: "text",
          value: t.target,
          placeholder: "vault 里的目录",
          onInput: (val) => {
            draft.trigger = { kind: "vault-file", target: val };
          }
        });
        return [uiField({ label: "哪个目录有变动", control: inp })];
      }
      case "data-threshold": {
        const path = uiInput({
          type: "text",
          value: t.path,
          placeholder: "数据文件",
          onInput: (val) => {
            draft.trigger = { ...t, path: val };
          }
        });
        const key = uiInput({
          type: "text",
          value: t.key,
          placeholder: "键",
          onInput: (val) => {
            draft.trigger = { ...t, key: val };
          }
        });
        const op = uiSelect({
          options: [
            { value: ">", label: "大于" },
            { value: "<", label: "小于" },
            { value: "=", label: "等于" }
          ],
          value: t.op,
          onChange: (val) => {
            draft.trigger = { ...t, op: val };
          }
        });
        const num2 = uiInput({
          type: "number",
          value: String(t.value),
          onInput: (val) => {
            draft.trigger = { ...t, value: Number(val) || 0 };
          }
        });
        const grid = el("div", "bz-dock-rulegrid");
        grid.append(uiField({ label: "文件", control: path }), uiField({ label: "键", control: key }));
        grid.append(uiField({ label: "比较", control: op.el }), uiField({ label: "阈值", control: num2 }));
        return [grid];
      }
    }
  }
  function ruleRow(v, rule) {
    const row = el("div", "bz-dock-rule");
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    const main = el("div", "bz-dock-rulemain");
    main.appendChild(el("div", "bz-dock-ruleline", triggerText(rule.trigger)));
    main.appendChild(el("div", "bz-dock-rulemeta", actionText(rule.action) + (rule.jitterMin ? ` · 抖 ${durationText(rule.jitterMin)}` : "")));
    row.append(main, el("span", "bz-dock-rulearrow", "›"));
    const open = () => openRuleEditor(v, rule);
    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open();
    });
    return row;
  }
  function toolOptions() {
    return readToolEntries().map((e) => ({ value: e.id, label: e.id }));
  }
  function autoSection(v) {
    var _a;
    const sec = el("section", "bz-dock-pane bz-dock-autopane");
    const head = el("div", "bz-dock-pane-head");
    head.appendChild(el("h3", "bz-dock-pane-title", "自动运行"));
    sec.appendChild(head);
    if ((_a = v.runState) == null ? void 0 : _a.pausedAt) {
      const last = lastRun(v.runs);
      const hint = (last == null ? void 0 : last.error) ? errorHint(last.error.kind) : null;
      const bar = el("div", "bz-dock-runbtns");
      bar.appendChild(
        uiBtn({
          label: hint ? `恢复并重试（上次：${hint}）` : "恢复并重试",
          size: "sm",
          tone: "primary",
          onClick: () => void resumeAndRetry(v)
        })
      );
      sec.appendChild(bar);
    }
    const list = el("div", "bz-dock-rulelist");
    if (v.rules.length) for (const rule of v.rules) list.appendChild(ruleRow(v, rule));
    else list.appendChild(el("div", "bz-dock-ruleempty", "没有规则 —— 加一条就有了"));
    sec.appendChild(list);
    sec.appendChild(
      uiBtn({ label: "添加规则", size: "sm", onClick: () => openRuleEditor(v, null) })
    );
    return sec;
  }
  function renderDetail(body, v) {
    var _a, _b, _c;
    const wrap = el("div", "bz-dock-detail");
    if (v.declError) {
      const box = el("div", "bz-dock-meta-warn");
      box.textContent = v.declError;
      wrap.appendChild(box);
    }
    wrap.appendChild(toolStats(v));
    const meta = el("div", "bz-dock-meta");
    const who = [(_a = v.manifest) == null ? void 0 : _a.author, (_b = v.manifest) == null ? void 0 : _b.toolVersion].filter(Boolean).join(" · ");
    if (who) meta.appendChild(metaRow("作者", who));
    if ((_c = v.manifest) == null ? void 0 : _c.docs) {
      const docs = v.manifest.docs;
      const row = el("div", "bz-dock-meta-row");
      row.appendChild(el("span", "bz-dock-meta-label", "文档"));
      row.appendChild(el("span", "bz-dock-meta-val", docs));
      if (/^https?:\/\//i.test(docs)) {
        row.appendChild(
          uiIconBtn({ icon: "external-link", title: "打开文档", xs: true, onClick: () => window.open(docs, "_blank") })
        );
      } else {
        row.appendChild(uiIconBtn({ icon: "copy", title: "复制", xs: true, onClick: () => void copyText(docs, "文档地址") }));
      }
      meta.appendChild(row);
    }
    meta.appendChild(
      metaRow("声明文件", v.declPath, true, () => void copyText(v.declPath, "声明文件路径"))
    );
    if (v.run) {
      meta.appendChild(metaRow("命令", v.run.cmd, true));
      if (v.run.args.length) meta.appendChild(metaRow("固定参数", v.run.args.join(" "), true));
      if (v.run.cwd) meta.appendChild(metaRow("工作目录", v.run.cwd, true));
      if (v.run.shell) meta.appendChild(metaRow("经 shell 启动", "是"));
    } else {
      meta.appendChild(metaRow("命令", "没写怎么跑（既无 run 段，目录里也没有 main.mjs）"));
    }
    meta.appendChild(
      metaRow("参数值文件", v.valuesPath, true, () => void copyText(v.valuesPath, "参数值文件路径"))
    );
    meta.appendChild(metaRow("运行记录", v.runsPath, true, () => void copyText(v.runsPath, "运行记录路径")));
    if (v.overLimit) {
      meta.appendChild(el("div", "bz-dock-meta-warn", "记录条数已超约定上限 —— 裁剪是工具自己的活，去检查它的 GC"));
    }
    if (v.runsUnreadable) {
      meta.appendChild(el("div", "bz-dock-meta-warn", "运行记录文件读不懂（坏 JSON 或结构不符）；工具坞不打补丁、不改写，等工具自己修好"));
    }
    wrap.appendChild(meta);
    wrap.appendChild(autoSection(v));
    const cols = el("div", "bz-dock-cols");
    cols.appendChild(runPane(v));
    cols.appendChild(histPane(v));
    wrap.appendChild(cols);
    body.appendChild(wrap);
  }
  function toolStats(v) {
    const host = el("div", "bz-dock-kpi bz-dock-toolstats");
    const tile = (num2, unit, label, sub, tone) => {
      const t = el("div", tone ? `bz-dock-kpi-tile is-${tone}` : "bz-dock-kpi-tile");
      const v2 = el("div", "bz-dock-kpi-v", num2);
      if (unit) v2.appendChild(el("small", void 0, unit));
      t.appendChild(v2);
      t.appendChild(el("div", "bz-dock-kpi-l", label));
      t.appendChild(el("div", "bz-dock-kpi-d", sub));
      return t;
    };
    const rate = successRate(v.runs);
    host.appendChild(
      tile(
        rate === null ? "—" : String(Math.round(rate * 100)),
        rate === null ? "" : "%",
        "成功率",
        rate === null ? "还没有运行记录" : `共 ${v.runs.length} 条记录`,
        rate !== null && rate < 1 ? "warn" : void 0
      )
    );
    const last = lastOf(v);
    host.appendChild(
      tile(
        last ? relTime(last.startedAt.replace("T", " ")) : "—",
        "",
        "最近一次",
        last ? statusText(last.status) + (last.message ? ` · ${last.message}` : "") : "这个脚本还没跑过",
        (last == null ? void 0 : last.status) === "failed" ? "bad" : void 0
      )
    );
    const next = nextDueOfView(v);
    if (next) {
      const left = untilText(next.at - Date.now());
      host.appendChild(tile(left.num, left.unit, "下次预计", next.sub, next.at < Date.now() ? "warn" : void 0));
    } else {
      host.appendChild(tile("—", "", "下次预计", "没有基于时间的规则（事件触发不算钟点）"));
    }
    return host;
  }
  function nextDueOfView(v) {
    const now = Date.now();
    let best = null;
    for (const r of v.rules) {
      if (r.enabled === false) continue;
      const last = v.ruleFiredAt[r.id];
      let at;
      if (r.trigger.kind === "daily") {
        const t = todayAt(r.trigger, now);
        if (t === void 0) continue;
        at = now < t && (last != null ? last : 0) < t ? t : t + 864e5;
      } else if (r.trigger.kind === "interval" && r.trigger.everyMin > 0) {
        at = (last != null ? last : now) + r.trigger.everyMin * 6e4;
      }
      if (at === void 0) continue;
      if (!best || at < best.at) best = { at, sub: triggerText(r.trigger) };
    }
    return best;
  }
  function metaRow(label, value, mono = false, onCopy) {
    const row = el("div", "bz-dock-meta-row");
    row.appendChild(el("span", "bz-dock-meta-label", label));
    const val = el("span", "bz-dock-meta-val" + (mono ? " is-mono" : ""), value);
    val.title = value;
    row.appendChild(val);
    if (onCopy) {
      row.appendChild(uiIconBtn({ icon: "copy", title: "复制", xs: true, onClick: onCopy }));
    }
    return row;
  }
  function runPane(v) {
    var _a, _b;
    const pane = el("section", "bz-dock-pane bz-dock-runpane");
    pane.appendChild(el("h3", "bz-dock-pane-title", "运行台"));
    if (!v.manifest) {
      const box = el("div", "bz-dock-noManifest");
      box.appendChild(el("div", "bz-dock-note", (_a = v.declError) != null ? _a : "声明文件读不到。"));
      box.appendChild(
        uiBtn({
          label: "重新读声明",
          icon: "refresh-cw",
          onClick: () => void reloadDeclaration(v)
        })
      );
      pane.appendChild(box);
      pane.appendChild(liveHost(v.entry.id));
      return pane;
    }
    const params = (_b = v.manifest.params) != null ? _b : [];
    if (params.length) {
      const form = el("div", "bz-dock-form");
      const values = valuesOf(v);
      for (const p of params) form.appendChild(paramRow(p, values, v));
      pane.appendChild(form);
    } else {
      pane.appendChild(el("div", "bz-dock-note", "这个工具没有参数。"));
    }
    if (!v.run) {
      pane.appendChild(
        el("div", "bz-dock-meta-warn", "这份声明没写 run 段 —— 能看它的记录，但不知道该怎么跑。")
      );
    }
    const btns = el("div", "bz-dock-runbtns");
    if (canRun()) {
      const live3 = liveRunOf(v.entry.id);
      btns.appendChild(
        live3 ? uiBtn({ label: "停止", icon: "square", tone: "danger", onClick: () => stopRun(v.entry.id) }) : uiBtn({
          label: "运行",
          icon: "play",
          tone: "primary",
          disabled: !canStart(v),
          onClick: () => void runFlow(v)
        })
      );
      if (params.length) {
        btns.appendChild(
          uiBtn({ label: "重置参数", size: "sm", onClick: () => resetValues(v) })
        );
      }
    } else {
      btns.appendChild(el("span", "bz-dock-mobilehint", "移动端不能启动进程，只能看"));
    }
    pane.appendChild(btns);
    if (!liveRunOf(v.entry.id)) {
      const lastTail = lastRawTailOf(v.entry.id);
      if (lastTail == null ? void 0 : lastTail.length) {
        const box = el("div", "bz-dock-lastraw");
        box.appendChild(el("div", "bz-dock-lastraw-head", "上次现场输出（尾部）"));
        const tail = el("pre", "bz-dock-raw");
        tail.textContent = lastTail.slice(-12).join("\n");
        box.appendChild(tail);
        pane.appendChild(box);
      }
    }
    pane.appendChild(liveHost(v.entry.id));
    return pane;
  }
  function liveHost(id) {
    const host = el("div", "bz-dock-live");
    host.dataset.tool = id;
    renderLiveInto(host, id);
    return host;
  }
  function renderLiveInto(host, id) {
    var _a;
    host.innerHTML = "";
    const run = liveRunOf(id);
    if (!run) {
      host.classList.add("is-off");
      return;
    }
    host.classList.remove("is-off");
    host.appendChild(el("div", "bz-dock-live-head", "正在跑（bz 亲手启动的，所以有实时进度）"));
    const ptxt = run.progress.phase ? `${run.progress.phase}${run.progress.pct === null ? "" : ` ${Math.round(run.progress.pct)}%`}` : "进行中";
    host.appendChild(el("div", "bz-dock-live-phase", ptxt));
    const bar = uiProgress({ value: (_a = run.progress.pct) != null ? _a : 0 });
    if (run.progress.pct === null) bar.el.classList.add("is-indeterminate");
    host.appendChild(bar.el);
    const steps = el("ol", "bz-dock-steps");
    for (const s of run.steps.slice(-8)) {
      const li = el("li", "bz-dock-step");
      li.appendChild(el("span", "bz-dock-step-dot"));
      li.appendChild(el("span", "bz-dock-step-text", s.text));
      steps.appendChild(li);
    }
    host.appendChild(steps);
    if (run.rawTail.length) {
      const tail = el("pre", "bz-dock-raw");
      tail.textContent = run.rawTail.slice(-12).join("\n");
      host.appendChild(tail);
    }
  }
  function valuesOf(v) {
    var _a;
    const id = v.entry.id;
    if (!draftValues.has(id)) {
      draftValues.set(id, initialValuesOf((_a = v.manifest) == null ? void 0 : _a.params, v.values));
    }
    return draftValues.get(id);
  }
  function queueValueSave(v) {
    const id = v.entry.id;
    const prev = valueSaveTimers.get(id);
    if (prev) clearTimeout(prev);
    valueSaveTimers.set(
      id,
      setTimeout(() => {
        valueSaveTimers.delete(id);
        saveValuesNow(v);
      }, VALUE_SAVE_DEBOUNCE_MS)
    );
  }
  function saveValuesNow(v) {
    const id = v.entry.id;
    const t = valueSaveTimers.get(id);
    if (t) {
      clearTimeout(t);
      valueSaveTimers.delete(id);
    }
    const draft = draftValues.get(id);
    if (!draft) return;
    if (!saveToolValues(v.entry, draft)) {
      notice("参数没存住（写不进工具目录），检查那个目录是否能写", "warning");
    }
  }
  function resetValues(v) {
    var _a;
    draftValues.set(v.entry.id, initialValuesOf((_a = v.manifest) == null ? void 0 : _a.params));
    saveValuesNow(v);
    render();
  }
  function paramRow(p, values, v) {
    var _a, _b, _c, _d;
    const set = (val) => {
      values[p.key] = val;
      queueValueSave(v);
    };
    let control;
    switch (p.type) {
      case "bool": {
        const sw = uiSwitch({ checked: values[p.key] === true, onChange: (c) => set(c) });
        control = sw.el;
        break;
      }
      case "choice": {
        const opts = ((_a = p.options) != null ? _a : []).map((o) => ({ value: o.value, label: o.label }));
        if (!opts.length) opts.push({ value: "", label: "（无选项）" });
        const seed = values[p.key] !== void 0 ? String(values[p.key]) : String((_b = p.default) != null ? _b : opts[0].value);
        const picked = opts.some((o) => o.value === seed) ? seed : opts[0].value;
        set(picked);
        const sel = uiSelect({
          options: opts,
          value: picked,
          placeholder: "请选择",
          onChange: (val) => set(val)
        });
        control = sel.el;
        break;
      }
      case "multichoice": {
        const box = el("div", "bz-dock-multichoice");
        const cur = new Set(Array.isArray(values[p.key]) ? values[p.key] : []);
        for (const o of (_c = p.options) != null ? _c : []) {
          box.appendChild(
            uiChip({
              label: o.label,
              selectedSoft: cur.has(o.value),
              onClick: () => {
                if (cur.has(o.value)) cur.delete(o.value);
                else cur.add(o.value);
                set([...cur]);
                render();
              }
            })
          );
        }
        control = box;
        break;
      }
      case "number": {
        const inp = uiInput({
          type: "number",
          value: values[p.key] === void 0 ? "" : String(values[p.key]),
          placeholder: p.placeholder,
          onInput: (val) => set(val === "" ? void 0 : Number(val))
        });
        if (p.min !== void 0) inp.min = String(p.min);
        if (p.max !== void 0) inp.max = String(p.max);
        if (p.step !== void 0) inp.step = String(p.step);
        control = inp;
        break;
      }
      case "multiline": {
        const ta = el("textarea", "bz-dock-textarea");
        ta.rows = (_d = p.rows) != null ? _d : 4;
        ta.value = values[p.key] === void 0 ? "" : String(values[p.key]);
        if (p.placeholder) ta.placeholder = p.placeholder;
        ta.addEventListener("input", () => set(ta.value));
        control = ta;
        break;
      }
      case "path": {
        const row = el("div", "bz-dock-pathrow");
        const inp = uiInput({
          value: values[p.key] === void 0 ? "" : String(values[p.key]),
          placeholder: p.placeholder,
          onInput: (val) => set(val)
        });
        row.appendChild(inp);
        row.appendChild(
          uiIconBtn({
            icon: "folder-open",
            title: p.mode === "dir" ? "选择文件夹" : "选择文件",
            onClick: () => {
              void (async () => {
                if (p.mode === "dir") {
                  const dir = await pickSystemFolder();
                  if (dir) {
                    inp.value = dir;
                    set(dir);
                  }
                } else {
                  const files = await pickSystemFiles(`选择${p.label}`, []);
                  if (files.length) {
                    inp.value = files[0];
                    set(files[0]);
                  }
                }
              })();
            }
          })
        );
        control = row;
        break;
      }
      case "secret": {
        const inp = uiInput({
          type: "password",
          value: values[p.key] === void 0 ? "" : String(values[p.key]),
          placeholder: p.placeholder || "只存在本机工具目录",
          onInput: (val) => set(val)
        });
        control = inp;
        break;
      }
      default: {
        const inp = uiInput({
          value: values[p.key] === void 0 ? "" : String(values[p.key]),
          placeholder: p.placeholder,
          onInput: (val) => set(val)
        });
        control = inp;
        break;
      }
    }
    const desc = p.help || (p.type === "secret" ? "存在本机工具目录里，不进 vault、不写运行记录" : void 0);
    return uiField({ label: p.label + (p.required ? " *" : ""), desc, control });
  }
  function histPane(v) {
    const pane = el("section", "bz-dock-pane bz-dock-histpane");
    const head = el("div", "bz-dock-pane-head");
    head.appendChild(el("h3", "bz-dock-pane-title", "运行记录"));
    head.appendChild(el("span", "bz-dock-pane-count", `${v.runs.length} 条`));
    pane.appendChild(head);
    if (!v.runs.length) {
      pane.appendChild(
        uiEmpty({
          icon: "history",
          title: v.runsUnreadable ? "记录读不懂" : "还没有运行记录",
          desc: v.runsUnreadable ? "文件在，但内容不合契约；工具坞只读不改" : "跑一次，或等它按声明的节奏自动跑完，记录就会出现"
        })
      );
      return pane;
    }
    const list = el("div", "bz-dock-histlist");
    const newestFirst = [...v.runs].sort(
      (a, b) => {
        var _a, _b;
        return ((_a = timeOf(b.startedAt)) != null ? _a : 0) - ((_b = timeOf(a.startedAt)) != null ? _b : 0);
      }
    );
    for (const r of newestFirst.slice(0, 60)) list.appendChild(histRow(r));
    pane.appendChild(list);
    if (v.runs.length > 60) pane.appendChild(el("div", "bz-dock-note", "只显示最近 60 条"));
    return pane;
  }
  function histRow(r) {
    var _a, _b, _c, _d, _e;
    const row = el("article", "bz-dock-histrow");
    const head = el("div", "bz-dock-histhead");
    head.appendChild(el("span", dotClass(r.status)));
    head.appendChild(el("span", "bz-dock-histtime", relTime(r.startedAt.replace("T", " "))));
    head.appendChild(el("span", "bz-dock-histstatus", statusText(r.status)));
    const dur = durationText2(r);
    if (dur) head.appendChild(el("span", "bz-dock-histdur", dur));
    head.appendChild(el("span", "bz-dock-histtrig", r.trigger === "auto" ? "自动" : "手动"));
    row.appendChild(head);
    if (r.message) row.appendChild(el("div", "bz-dock-histmsg", r.message));
    if (r.error) {
      const box = el("div", "bz-dock-histerr");
      box.appendChild(el("div", "bz-dock-histerr-hint", errorHint(r.error.kind)));
      if (r.error.detail) box.appendChild(el("div", "bz-dock-histerr-detail", r.error.detail));
      row.appendChild(box);
    }
    const hasMore = r.steps && r.steps.length > 0 || r.info && r.info.length > 0 || r.result !== void 0 || r.metrics !== void 0 || r.artifacts && r.artifacts.length > 0 || ((_a = r.error) == null ? void 0 : _a.stderr);
    if (hasMore) {
      const btn = uiBtn({
        label: "展开",
        size: "sm",
        className: "bz-dock-histtoggle",
        onClick: () => {
          const open = row.classList.toggle("is-open");
          btn.querySelector("span").textContent = open ? "收起" : "展开";
        }
      });
      row.appendChild(btn);
      const more = el("div", "bz-dock-histmore");
      if ((_b = r.steps) == null ? void 0 : _b.length) more.appendChild(block("步骤", r.steps.map((s) => s.text).join("\n")));
      if (r.metrics) more.appendChild(block("指标", JSON.stringify(r.metrics, null, 2)));
      if ((_c = r.artifacts) == null ? void 0 : _c.length) {
        const box = el("div", "bz-dock-block");
        box.appendChild(el("div", "bz-dock-block-label", "产物"));
        for (const a of r.artifacts) {
          const row2 = el("div", "bz-dock-artrow");
          row2.appendChild(el("span", "bz-dock-artrow-path", `${a.label ? a.label + " · " : ""}${a.path}`));
          row2.appendChild(
            uiIconBtn({ icon: "external-link", title: "打开 / 定位产物", xs: true, onClick: () => openArtifact(a.path) })
          );
          box.appendChild(row2);
        }
        more.appendChild(box);
      }
      if (r.result !== void 0) more.appendChild(block("结果", JSON.stringify(r.result, null, 2)));
      if ((_d = r.info) == null ? void 0 : _d.length) more.appendChild(block("信息", JSON.stringify(r.info, null, 2)));
      if ((_e = r.error) == null ? void 0 : _e.stderr) more.appendChild(block("stderr 尾部", r.error.stderr));
      row.appendChild(more);
    }
    if (r.startedAt) {
      const exact = el("div", "bz-dock-histexact", r.startedAt.replace("T", " ").replace(/\..*$/, ""));
      row.appendChild(exact);
    }
    return row;
  }
  function block(label, text) {
    const b = el("div", "bz-dock-block");
    b.appendChild(el("div", "bz-dock-block-label", label));
    const pre = el("pre", "bz-dock-json");
    pre.textContent = text;
    b.appendChild(pre);
    return b;
  }
  async function runFlow(v) {
    var _a;
    if (!hostApp) return;
    if (!canRun()) {
      notice("移动端不能启动本机进程", "warning");
      return;
    }
    if (!v.run) {
      notice("这份声明没写怎么跑：既无 run 段，目录里也没有 main.mjs", "warning");
      return;
    }
    if (!isTrusted(v.entry) || v.trustStale) {
      const ok = await applyTrust(v.entry, v.manifest, v.declPath, v.run, {
        title: v.trustStale ? "启动命令变了，重新确认信任" : "信任此命令",
        accept: "信任"
      });
      if (!ok) return;
    }
    saveValuesNow(v);
    const values = valuesOf(v);
    const missing = missingRequiredParams((_a = v.manifest) == null ? void 0 : _a.params, values);
    if (missing.length) {
      notice(`还差必填参数：${missing.join("、")}`, "warning");
      return;
    }
    const run = runTool(hostApp, v.entry, v.run, v.manifest, values, {
      ...liveCallbacks(v.entry.id),
      onDone: (outcome) => {
        notifyRunOutcome(displayName(v), outcome, () => openDockTool(hostApp, v.entry.id));
        if (outcome.ok) void recordRunSuccess(v.entry.id, outcome.finishedAt);
        void refresh();
        updateLive(v.entry.id);
      }
    });
    render();
  }
  function liveCallbacks(id) {
    return {
      onStep: () => updateLive(id),
      onProgress: () => updateLive(id),
      onInfo: () => updateLive(id),
      onResult: () => updateLive(id)
    };
  }
  async function resumeAndRetry(v) {
    await patchRunState(v.entry.id, null);
    kickDockScheduler();
    await refresh();
    const nv = viewById(v.entry.id);
    if (nv && canStart(nv)) await runFlow(nv);
  }
  function updateLive(id) {
    const hosts = overlay == null ? void 0 : overlay.querySelectorAll(`.bz-dock-live[data-tool="${id}"]`);
    hosts == null ? void 0 : hosts.forEach((h) => renderLiveInto(h, id));
    renderRunbar();
  }
  async function reloadDeclaration(v) {
    var _a, _b, _c;
    const res = readDeclaration(v.entry.path);
    if (!res.ok || !res.manifest) {
      notice((_a = res.error) != null ? _a : "声明读不到", "error");
      return;
    }
    const m = res.manifest;
    if (m.id !== v.entry.id) {
      notice(
        `声明里的 id 是「${m.id}」，与登记的「${v.entry.id}」不一致 —— 当两个工具看，或移除后重新导入`,
        "warning"
      );
    }
    const run = resolveRun(m, (_b = res.path) != null ? _b : v.entry.path, res.conventionalRun);
    const sig = run ? runSignature(run) : void 0;
    if (isTrusted(v.entry) && sig !== v.entry.trustedRun) {
      if (await applyTrust(v.entry, m, (_c = res.path) != null ? _c : v.entry.path, run, {
        title: "启动命令变了，重新确认信任",
        accept: "信任"
      })) {
        return;
      }
      notice("已保留原样 —— 但这条命令在你重新确认之前不会被运行", "warning");
      return;
    }
    notice(`声明已重新读取：${m.params.length} 个参数`, "success");
    await refresh();
  }
  function scheduleTextOf(s) {
    var _a;
    if (!s) return "未声明";
    const base = {
      daily: "每天一次",
      weekly: s.weekday !== void 0 ? `每周${"日一二三四五六"[s.weekday]}` : "每周一次",
      interval: s.everyHours !== void 0 ? `每 ${s.everyHours} 小时` : "按间隔",
      "on-demand": "按需（只手动）",
      unknown: "未声明"
    };
    const parts = [(_a = base[s.kind]) != null ? _a : s.kind];
    if (s.kind === "daily" && s.hour !== void 0) parts.push(`${String(s.hour).padStart(2, "0")}:00 前`);
    if (s.note) parts.push(`（${s.note}）`);
    return parts.join("");
  }
  function scheduleText(m) {
    return scheduleTextOf(m.schedule);
  }
  function runTextOf(run) {
    if (!run) return "没写怎么跑（既无 run 段，目录里也没有 main.mjs）";
    return [run.cmd, ...run.args].join(" ");
  }
  async function confirmTrust(manifest, declPath, run, title, accept) {
    const lines = [manifest.name];
    if (manifest.description) lines.push(manifest.description);
    lines.push("", `会跑：${runTextOf(run)}`);
    if (run == null ? void 0 : run.cwd) lines.push(`工作目录：${run.cwd}`);
    lines.push(`声明文件：${declPath}`, "");
    lines.push(
      manifest.schedule ? `节奏：${scheduleText(manifest)}（自动化；bz 会在它开着时按节奏跑）` : "节奏：未声明（手动）"
    );
    lines.push(`参数：${manifest.params.length} 个`, "");
    lines.push(
      "建立信任之后工具坞才会运行它（读声明不需要信任）。信任的对象是「那条命令」，",
      "建立一次长期有效；以后命令变了会重新问一次。"
    );
    const v = await openFlowDialog({
      title,
      message: lines.join("\n"),
      actions: [
        { label: "取消", value: "cancel" },
        { label: accept, value: "ok", cta: true }
      ]
    });
    return v === "ok";
  }
  async function applyTrust(entry, manifest, declPath, run, opts) {
    const ok = await confirmTrust(manifest, declPath, run, opts.title, opts.accept);
    if (!ok) return false;
    const next = { ...entry, trustedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (run) next.trustedRun = runSignature(run);
    else delete next.trustedRun;
    await persist(readToolEntries().map((e) => e.id === entry.id ? next : e), `已信任 ${manifest.name}`);
    return true;
  }
  async function importToolFlow(entry) {
    var _a, _b;
    if (!canRun()) {
      notice("导入声明需要桌面端（要读本机文件）", "warning");
      return;
    }
    const picked = await pickSystemFiles(
      entry ? "重新选择该工具的声明文件" : `选择工具声明（${DECLARATION_FILENAME}）`,
      [{ name: "工具声明", ext: ["json"] }]
    );
    if (!picked.length) return;
    const declPath = picked[0];
    const res = readDeclaration(declPath);
    if (!res.ok || !res.manifest) {
      notice((_a = res.error) != null ? _a : "声明读不到", "error");
      return;
    }
    const manifest = res.manifest;
    const run = resolveRun(manifest, declPath, res.conventionalRun);
    const entries = readToolEntries();
    if (entries.some((e) => e.id === manifest.id && e.id !== (entry == null ? void 0 : entry.id))) {
      notice(`id「${manifest.id}」已被另一个登记占用 —— 改声明里的 id，或先移除那个`, "warning");
      return;
    }
    const next = { id: (_b = entry == null ? void 0 : entry.id) != null ? _b : manifest.id, path: declPath };
    if (entry) {
      if (entry.enabled !== void 0) next.enabled = entry.enabled;
      if (entry.scheduleOverride !== void 0) next.scheduleOverride = entry.scheduleOverride;
      if (entry.overrideDeclSig !== void 0) next.overrideDeclSig = entry.overrideDeclSig;
      const sig = run ? runSignature(run) : void 0;
      if (sig !== void 0 && sig === entry.trustedRun) {
        next.trustedAt = entry.trustedAt;
        next.trustedRun = entry.trustedRun;
      }
    }
    if (!isTrusted(next)) {
      const ok = await confirmTrust(
        manifest,
        declPath,
        run,
        entry ? "重新导入声明" : "导入工具声明",
        entry ? "确认并信任" : "信任并登记"
      );
      if (!ok) return;
      next.trustedAt = (/* @__PURE__ */ new Date()).toISOString();
      const sig = run ? runSignature(run) : void 0;
      if (sig !== void 0) next.trustedRun = sig;
    }
    const list = entry ? entries.map((e) => e.id === entry.id ? next : e) : [...entries, next];
    await persist(list, entry ? `已更新 ${manifest.name}` : `已登记 ${manifest.name}`);
  }
  function nameOfEntry(id) {
    const v = viewById(id);
    return v ? displayName(v) : id;
  }
  async function persist(list, msg) {
    var _a;
    for (const v of views) saveValuesNow(v);
    try {
      await saveToolEntries(list);
      notice(msg, "success");
    } catch (e) {
      notice(`保存失败：${(_a = e == null ? void 0 : e.message) != null ? _a : e}`, "error");
      return;
    }
    draftValues.clear();
    await refresh();
  }
  async function toggleEnabled(entry) {
    const entries = readToolEntries();
    const next = { ...entry, enabled: entry.enabled === false };
    const name = nameOfEntry(entry.id);
    await persist(
      entries.map((e) => e.id === entry.id ? next : e),
      next.enabled ? `已启用 ${name}` : `已停用 ${name}`
    );
  }
  async function removeToolFlow(v) {
    const res = await openFlowDialog({
      title: "移除登记",
      message: `确定把「${displayName(v)}」从工具坞移除？

只移除 bz 这边的登记 —— 声明文件、参数值文件、运行记录文件都不会被删（前两个是工具目录里的，后一个是工具的账本）。调度台账（失败计数 / 熔断标记）一并清掉。`,
      actions: [
        { label: "取消", value: "cancel" },
        { label: "移除", value: "ok", cta: true, danger: true }
      ]
    });
    if (res !== "ok") return;
    const entries = readToolEntries().filter((e) => e.id !== v.entry.id);
    if (view.kind === "detail" && view.id === v.entry.id) view = { kind: "list" };
    await patchRunState(v.entry.id, null);
    await persist(entries, `已移除 ${displayName(v)}`);
  }

  // prototypes/dock/fake-sim.ts
  var TOOLS_DIR = "C:/Users/PC/scripts";
  var KEY = "bz-sim:";
  var SEED_MARK = "bz-sim:__dock_seed_v3";
  var declPathOf = (id) => `${TOOLS_DIR}/${id}/dock.json`;
  var MiniBuffer = class _MiniBuffer {
    constructor(bytes) {
      this.bytes = bytes;
    }
    static from(input, _encoding) {
      return input instanceof Uint8Array ? new _MiniBuffer(input) : new _MiniBuffer(new TextEncoder().encode(input));
    }
    static concat(parts) {
      const total = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const p of parts) {
        out.set(p.bytes, off);
        off += p.length;
      }
      return new _MiniBuffer(out);
    }
    get length() {
      return this.bytes.length;
    }
    indexOf(value, from = 0) {
      for (let i = from; i < this.bytes.length; i++) if (this.bytes[i] === value) return i;
      return -1;
    }
    subarray(start = 0, end = this.bytes.length) {
      return new _MiniBuffer(this.bytes.subarray(start, end));
    }
    toString(_encoding) {
      return new TextDecoder().decode(this.bytes);
    }
  };
  function installBufferPolyfill() {
    const w = window;
    if (!w.Buffer) w.Buffer = MiniBuffer;
  }
  function iso(msAgo) {
    return new Date(Date.now() - msAgo).toISOString();
  }
  var MIN = 6e4;
  var HOUR = 60 * MIN;
  var DAY = 24 * HOUR;
  var DECLARATIONS = {
    "iamtxt-signin": {
      v: 1,
      id: "iamtxt-signin",
      name: "iamtxt 每日签到",
      description: "每天在 iamtxt.com 自动签到拿积分；cookie 失效时要重新导出。",
      author: "叫我包仔",
      toolVersion: "1.0.2",
      icon: "calendar-check",
      produces: ["info", "result"],
      schedule: { kind: "daily", hour: 9, note: "09:00 起随机 0~2 分钟" },
      runtime: { estimatedSec: 25 },
      run: { cmd: `${TOOLS_DIR}/iamtxt-signin/run.cmd` },
      params: [{ key: "cookie", label: "Cookie", type: "secret", help: "登录后在浏览器里复制整串 Cookie" }]
    },
    "rss-fetch": {
      v: 1,
      id: "rss-fetch",
      name: "订阅源抓取",
      description: "把订阅源的新文章拉进剪藏目录，按增量落盘。",
      icon: "rss",
      schedule: { kind: "interval", everyHours: 6 },
      produces: ["result"],
      run: { cmd: "node", args: ["fetch.mjs"] },
      params: [
        { key: "since", label: "回溯天数", type: "number", default: 3, min: 1, max: 30, step: 1, help: "只抓这个天数以内的新文章" },
        { key: "full", label: "抓全文", type: "bool", default: true },
        {
          key: "comment",
          label: "备注",
          type: "multiline",
          rows: 2,
          placeholder: "写进这次运行记录的备注（选填）"
        }
      ]
    },
    "drive-backup": {
      v: 1,
      id: "drive-backup",
      name: "网盘备份",
      description: "把 vault 里的加密目录打包上云，每周日跑一次。",
      icon: "hard-drive-upload",
      schedule: { kind: "weekly", weekday: 0, note: "周日任意时刻" },
      runtime: { estimatedSec: 900 },
      run: { cmd: `${TOOLS_DIR}/backup/push.exe`, args: ["--quiet"] },
      params: [
        {
          key: "mode",
          label: "模式",
          type: "choice",
          options: [
            { value: "incr", label: "增量" },
            { value: "full", label: "全量" }
          ],
          default: "incr"
        },
        { key: "target", label: "本地中转目录", type: "path", mode: "dir" },
        { key: "token", label: "网盘令牌", type: "secret" }
      ]
    },
    "clipping-export": {
      v: 1,
      id: "clipping-export",
      name: "剪藏导出 Markdown",
      description: "把剪藏本里的文章按标签导出成一份可分享的 Markdown 包。",
      icon: "file-down",
      run: { cmd: `${TOOLS_DIR}/clipping/export.cmd` },
      params: [
        {
          key: "tags",
          label: "标签",
          type: "multichoice",
          options: [
            { value: "tech", label: "技术" },
            { value: "life", label: "生活" },
            { value: "read", label: "阅读" }
          ]
        },
        { key: "note", label: "备注", type: "text", placeholder: "选填" }
      ]
    },
    // 未建立信任的那个：声明在、能看清它要跑什么，但用户还没点「信任」
    "imported-tool": {
      v: 1,
      id: "imported-tool",
      name: "从朋友那拷来的工具",
      description: "朋友给的脚本，声明写得挺全 —— 但命令不是我自己的，运行前得先看一眼。",
      icon: "package",
      run: { cmd: `${TOOLS_DIR}/from-a-friend/run.cmd` },
      params: [{ key: "target", label: "输出目录", type: "path", mode: "dir" }]
    }
    // 故意**不给** local-report 声明文件：面板上它只该有「声明读不到 + 重新读」这一条路
  };
  var PENDING_DECL_ID = "newcomer";
  var PENDING_DECLARATION = {
    v: 1,
    id: PENDING_DECL_ID,
    name: "新搬来的工具",
    description: "刚放到工具目录里的脚本：选它的 dock.json 就够了，面板自己读得出标题、参数和怎么跑。",
    icon: "sparkles",
    schedule: { kind: "daily", hour: 21 },
    run: { cmd: `node`, args: ["newcomer.mjs"] },
    params: [{ key: "greeting", label: "问候语", type: "text", default: "你好" }]
  };
  var SETTINGS = {
    "clipping-export": { tags: ["tech", "read"], note: "给同事的版本" },
    "iamtxt-signin": { cookie: "session=sim-cookie-value; uid=10086" }
  };
  var RUNS = {
    // 今天已跑：ok
    "iamtxt-signin": [
      { runId: "s-1", trigger: "auto", status: "ok", startedAt: iso(6 * HOUR), finishedAt: iso(6 * HOUR - 1800), durationMs: 1800, exitCode: 0, message: "签到成功，+2 分", progress: { phase: "签到", pct: 100 }, result: { balance: 52, signedDate: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) }, metrics: { pointsGained: 2 }, steps: [{ text: "检查登录态" }, { text: "发起签到" }] },
      { runId: "s-2", trigger: "auto", status: "ok", startedAt: iso(1 * DAY + 5 * HOUR), finishedAt: iso(1 * DAY + 5 * HOUR - 1500), durationMs: 1500, exitCode: 0, message: "签到成功，+1 分" },
      { runId: "s-3", trigger: "auto", status: "failed", startedAt: iso(3 * DAY + 5 * HOUR), finishedAt: iso(3 * DAY + 5 * HOUR - 900), durationMs: 900, exitCode: 2, message: "登录态已失效", error: { kind: "auth", detail: "cookie 里的 session 字段过期", stderr: "ERROR auth: session expired at signin.ts:42" } },
      { runId: "s-4", trigger: "auto", status: "ok", startedAt: iso(4 * DAY + 5 * HOUR), exitCode: 0, message: "签到成功，+3 分" }
    ],
    // 超过声明间隔：逾期（最近 7 次有两次失败）
    "rss-fetch": [
      { runId: "r-1", trigger: "auto", status: "ok", startedAt: iso(9 * HOUR), durationMs: 42e3, exitCode: 0, message: "抓到 12 篇新文章", result: { fetched: 12, skipped: 3 }, metrics: { fetched: 12 }, steps: [{ text: "读取订阅源（18 个）" }, { text: "增量比对" }, { text: "落盘 12 篇" }] },
      { runId: "r-2", trigger: "auto", status: "failed", startedAt: iso(15 * HOUR), exitCode: 1, message: "有三个源连不上", error: { kind: "network", detail: "ETIMEDOUT", stderr: "fetch failed: 3 sources timed out" } },
      { runId: "r-3", trigger: "auto", status: "ok", startedAt: iso(21 * HOUR), exitCode: 0, message: "抓到 5 篇新文章" },
      { runId: "r-4", trigger: "auto", status: "failed", startedAt: iso(27 * HOUR), exitCode: 1, message: "源站返回 403", error: { kind: "auth" } },
      { runId: "r-5", trigger: "auto", status: "ok", startedAt: iso(33 * HOUR), exitCode: 0, message: "抓到 0 篇新文章" },
      { runId: "r-6", trigger: "auto", status: "ok", startedAt: iso(39 * HOUR), exitCode: 0, message: "抓到 7 篇新文章" },
      { runId: "r-7", trigger: "auto", status: "ok", startedAt: iso(45 * HOUR), exitCode: 0, message: "抓到 2 篇新文章" }
    ],
    // 上周日过、本周日也过，且**最近一次是失败**：卡面该同时给出「逾期 + 怎么办」
    "drive-backup": [
      { runId: "d-1", trigger: "auto", status: "failed", startedAt: iso(9 * DAY), finishedAt: iso(9 * DAY - 4e3), exitCode: 2, message: "网盘令牌过期，上传被拒", error: { kind: "auth", detail: "refresh_token 已失效", stderr: "ERROR auth: refresh_token expired (drive.ts:88)" } },
      { runId: "d-2", trigger: "auto", status: "ok", startedAt: iso(16 * DAY), durationMs: 812e3, exitCode: 0, message: "备份完成，上传 1.2 GB", artifacts: [{ path: "D:/backup/2026-09-18.tar.zst", label: "归档包" }] },
      { runId: "d-3", trigger: "auto", status: "timeout", startedAt: iso(23 * DAY), exitCode: null, message: "上传超时", error: { kind: "timeout", detail: "超过 15 分钟硬上限" } }
    ],
    // 只有手动记录；含一次带可操作提示的失败 + 结构化产出
    "clipping-export": [
      { runId: "c-1", trigger: "manual", status: "ok", startedAt: iso(2 * DAY), durationMs: 6400, exitCode: 0, message: "导出 38 篇，共 412 KB", params: { tags: ["tech", "read"], note: "给同事的版本" }, metrics: { articles: 38, bytes: 421888 }, result: { files: 38, path: "CONFIG/STORAGE/dock/out/clipping-2026-10-01.zip" }, artifacts: [{ path: "CONFIG/STORAGE/dock/out/clipping-2026-10-01.zip", label: "导出包" }], steps: [{ text: "收集带标签的条目" }, { text: "渲染 Markdown" }, { text: "打包" }] },
      { runId: "c-2", trigger: "manual", status: "failed", startedAt: iso(5 * DAY), exitCode: 3, message: "缺必填的标签", error: { kind: "config", detail: "--tags 为空", stderr: "usage: clipping-export --tags=a,b" } }
    ],
    // 一条都没有：记录文件的「空账本」（工具写过、但还没跑过）
    "local-report": []
  };
  function seedRulesOf(id) {
    if (id === "iamtxt-signin") {
      return {
        rules: [
          {
            id: "r1",
            trigger: { kind: "daily", at: "09:00" },
            action: { kind: "run", notify: "fail" },
            jitterMin: 2
          },
          { id: "r2", trigger: { kind: "on-launch", delayMin: 1 }, action: { kind: "remind" } }
        ]
      };
    }
    if (id === "rss-fetch") {
      return {
        rules: [
          {
            id: "r1",
            trigger: { kind: "interval", everyMin: 360 },
            action: { kind: "run", notify: "fail" }
          }
        ]
      };
    }
    return {};
  }
  function seedEntries() {
    const list = [];
    for (const [id, decl] of Object.entries(DECLARATIONS)) {
      list.push({ id, path: declPathOf(id), ...seedRulesOf(id) });
    }
    list.push({ id: "local-report", path: declPathOf("local-report") });
    return list;
  }
  function seedTrust() {
    const trustedAt = iso(30 * DAY);
    const trust = {};
    for (const id of Object.keys(DECLARATIONS).concat("local-report")) {
      if (id === "imported-tool") continue;
      const run = id in DECLARATIONS ? resolveRun(DECLARATIONS[id], declPathOf(id)) : null;
      trust[id] = run ? { at: trustedAt, run: runSignature(run) } : { at: trustedAt };
    }
    return trust;
  }
  function wipeSimFiles() {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(KEY)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
  }
  var fileKeyOf = (p) => KEY + p.replace(/\\/g, "/");
  function seedStore() {
    var _a;
    if (localStorage.getItem(SEED_MARK)) return;
    wipeSimFiles();
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const [id, decl] of Object.entries(DECLARATIONS)) {
      const declPath = declPathOf(id);
      localStorage.setItem(fileKeyOf(declPath), JSON.stringify(decl, null, 2));
      const values = SETTINGS[id];
      if (values) {
        localStorage.setItem(
          fileKeyOf(settingsPathFor(declPath)),
          JSON.stringify({ v: 1, tool: id, values }, null, 2)
        );
      }
    }
    localStorage.setItem(
      fileKeyOf(declPathOf(PENDING_DECL_ID)),
      JSON.stringify(PENDING_DECLARATION, null, 2)
    );
    localStorage.setItem(
      fileKeyOf(dockStorePath()),
      JSON.stringify({ v: 1, tools: seedEntries(), runState: {}, autoRun: true, notifyMissed: true }, null, 2)
    );
    for (const id of Object.keys(DECLARATIONS).concat("local-report")) {
      const runsFile = runsPathFor(declPathOf(id));
      localStorage.setItem(
        fileKeyOf(runsFile),
        JSON.stringify({ v: 1, tool: id, updatedAt, runs: (_a = RUNS[id]) != null ? _a : [] }, null, 2)
      );
    }
    localStorage.setItem(SEED_MARK, (/* @__PURE__ */ new Date()).toISOString());
  }
  var MiniEmitter = class {
    constructor() {
      this.map = /* @__PURE__ */ new Map();
    }
    on(evt, fn) {
      if (!this.map.has(evt)) this.map.set(evt, []);
      this.map.get(evt).push(fn);
    }
    emit(evt, ...args) {
      var _a;
      for (const fn of (_a = this.map.get(evt)) != null ? _a : []) fn(...args);
    }
  };
  function runsKeyOf(envPath) {
    return envPath ? KEY + envPath.replace(/\\/g, "/") : null;
  }
  function appendRun(envPath, record) {
    const key = runsKeyOf(envPath);
    if (!key) return;
    let file;
    try {
      file = JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      file = null;
    }
    if (!file || !Array.isArray(file.runs)) {
      const tool = (envPath != null ? envPath : "").split("/").pop().replace(/\.json$/, "");
      file = { v: 1, tool, updatedAt: "", runs: [] };
    }
    file.runs.unshift(record);
    if (file.runs.length > 200) file.runs.length = 200;
    file.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    localStorage.setItem(key, JSON.stringify(file, null, 2));
  }
  function makeFakeCp() {
    return {
      spawn(cmd, args, opts = {}) {
        var _a, _b, _c;
        const emitter = new MiniEmitter();
        const tool = (_b = (_a = opts.env) == null ? void 0 : _a.BZ_DOCK_TOOL) != null ? _b : "unknown";
        const runsFile = (_c = opts.env) == null ? void 0 : _c.BZ_DOCK_RUNS_FILE;
        let killed = false;
        let timer = 0;
        const write = (line) => {
          if (killed) return;
          emitter.emit("out", line + "\n");
        };
        const later = (ms, fn) => {
          timer = window.setTimeout(() => {
            if (!killed) fn();
          }, ms);
        };
        const finish = (code, stderr = "") => {
          if (killed) return;
          if (stderr) emitter.emit("err", stderr);
          window.clearTimeout(timer);
          emitter.emit("close", code);
        };
        const startedAt = (/* @__PURE__ */ new Date()).toISOString();
        const willFail = tool === "unknown" || tool.includes("fail");
        const steps = willFail ? ["检查登录态", "发起请求"] : ["检查登录态", "发起请求", "读取返回", "落盘"];
        const STEP_MS = 420;
        steps.forEach((s, i) => later(150 + i * STEP_MS, () => write(`[bz-step] ${s}`)));
        const total = steps.length;
        let phase = 0;
        const tick2 = window.setInterval(() => {
          if (killed) return;
          phase += 1;
          write(`[bz-p] ${JSON.stringify({ phase: steps[Math.min(phase, total - 1)], pct: Math.min(100, Math.round(phase / total * 100)) })}`);
        }, STEP_MS);
        later(150 + total * STEP_MS, () => {
          window.clearInterval(tick2);
          const finishedAt = (/* @__PURE__ */ new Date()).toISOString();
          if (willFail) {
            write(`[bz-info] ${JSON.stringify({ reason: "模拟失败", at: finishedAt })}`);
            const rec2 = {
              runId: `sim-${Date.now()}`,
              trigger: "manual",
              status: "failed",
              startedAt,
              finishedAt,
              exitCode: 1,
              message: "模拟失败：命令返回非零退出码",
              steps: steps.map((t) => ({ text: t })),
              error: { kind: "unknown", detail: "这是壳里的模拟失败", stderr: "simulated failure (prototype)" }
            };
            appendRun(runsFile, rec2);
            finish(1, "simulated failure (prototype)");
            return;
          }
          write(`[bz-result] ${JSON.stringify({ ok: true, at: finishedAt, note: "壳内模拟执行" })}`);
          const rec = {
            runId: `sim-${Date.now()}`,
            trigger: "manual",
            status: "ok",
            startedAt,
            finishedAt,
            exitCode: 0,
            message: "壳内模拟执行完成（这条记录由「工具」自己落账）",
            steps: steps.map((t) => ({ text: t })),
            progress: { phase: steps[total - 1], pct: 100 },
            result: { ok: true, tool, cmd, args, at: finishedAt }
          };
          appendRun(runsFile, rec);
          finish(0);
        });
        return makeChild(emitter, () => {
          killed = true;
          window.clearTimeout(timer);
        });
      }
    };
  }
  function makeChild(emitter, kill) {
    return {
      stdout: { on: (evt, fn) => emitter.on(evt === "data" ? "out" : evt, fn) },
      stderr: { on: (evt, fn) => emitter.on(evt === "data" ? "err" : evt, fn) },
      on: (evt, fn) => emitter.on(evt, fn),
      // 杀掉也要补一条 close（code=null）：core/external-tool 靠 close 才算终结，
      // 不补的话「停止」在壳里会把运行卡在 running（真机上进程被 kill 是会 close 的）。
      kill: () => {
        kill();
        window.setTimeout(() => emitter.emit("close", null), 60);
      }
    };
  }
  function makeFakeFs() {
    return {
      readText: (p) => localStorage.getItem(fileKeyOf(p)),
      writeText: (p, d) => localStorage.setItem(fileKeyOf(p), d),
      rename: (from, to) => {
        const v = localStorage.getItem(fileKeyOf(from));
        if (v === null) throw new Error("ENOENT: " + from);
        localStorage.setItem(fileKeyOf(to), v);
        localStorage.removeItem(fileKeyOf(from));
      }
    };
  }
  var settingsStore = {
    storagePath: "CONFIG/STORAGE",
    // 面板数据（登记表 / 台账 / 两个开关）自 ADR-0239 起住数据目录的 dock.json —— 见 seedStore()
    // 里的种子；信任这份住**这里**（dockTrust，ADR-0239），与实现侧同一份合并结果
    dockTrust: seedTrust()
  };
  var simApp = null;
  function installPathPickers() {
    setSystemFolderPicker(async () => "C:/Users/PC/backup-staging");
    const w = window;
    w.require = (m) => m === "@electron/remote" ? {
      dialog: {
        showOpenDialog: async (o) => {
          var _a;
          return /声明/.test((_a = o == null ? void 0 : o.title) != null ? _a : "") ? { canceled: false, filePaths: [declPathOf(PENDING_DECL_ID)] } : { canceled: true, filePaths: [] };
        }
      }
    } : null;
  }
  function bootDockSim() {
    var _a, _b, _c, _d, _e;
    const g = window;
    if (g.__bzDockSimBooted) return;
    g.__bzDockSimBooted = true;
    installBufferPolyfill();
    installPathPickers();
    seedStore();
    const app2 = new FakeApp();
    simApp = app2;
    setApp(app2);
    setSettingsProvider(() => settingsStore);
    setSettingsSaver(async () => {
      localStorage.setItem("bz-sim:__dock_settings", JSON.stringify(settingsStore));
    });
    setDockFs(makeFakeFs());
    setDockRuntimeDeps({ cp: makeFakeCp() });
    const entries = seedEntries();
    const scheduleOf = (id) => {
      var _a2;
      return (_a2 = DECLARATIONS[id]) == null ? void 0 : _a2.schedule;
    };
    window.DOCK_SEED = {
      total: entries.length,
      auto: entries.filter((e) => triggerOf(scheduleOf(e.id)) === "auto").length,
      manual: entries.filter((e) => triggerOf(scheduleOf(e.id)) === "manual").length,
      noDecl: entries.filter((e) => !(e.id in DECLARATIONS)).length,
      untrusted: entries.filter((e) => !(e.id in seedTrust())).length,
      runs: Object.fromEntries(
        Object.keys(DECLARATIONS).concat("local-report").map((id) => {
          var _a2;
          return [id, ((_a2 = RUNS[id]) != null ? _a2 : []).length];
        })
      ),
      // 详情页要断言的几个字符串也从种子里现取，别在壳里复述
      clippingCmd: String(
        (_b = (_a = DECLARATIONS["clipping-export"].run) == null ? void 0 : _a.cmd) != null ? _b : ""
      ),
      clippingDeclPath: declPathOf("clipping-export"),
      // 「导入声明」演示：它躺在工具目录里但还没登记，导入后总数 +1
      pendingImport: {
        id: PENDING_DECL_ID,
        name: String((_c = PENDING_DECLARATION.name) != null ? _c : ""),
        cmd: String((_e = (_d = PENDING_DECLARATION.run) == null ? void 0 : _d.cmd) != null ? _e : ""),
        params: Array.isArray(PENDING_DECLARATION.params) ? PENDING_DECLARATION.params.length : 0
      }
    };
  }
  function openDockPanel() {
    bootDockSim();
    openDock(simApp);
  }
  function unloadDockSim() {
    unloadDock();
    simApp = null;
  }
  function resetDockSim() {
    wipeSimFiles();
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
