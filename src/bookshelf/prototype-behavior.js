/* 构建产物（勿手改）：node scripts/build-preview.mjs — src/bookshelf/fake-sim.ts → window.BZW_bookshelf（行为单源预览包，issue 245/ADR-0106） */
var BZW_bookshelf = (() => {
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

  // src/bookshelf/fake-sim.ts
  var fake_sim_exports = {};
  __export(fake_sim_exports, {
    bootBookshelfSim: () => bootBookshelfSim,
    openBookshelf: () => openBookshelf2,
    openReport: () => openReport
  });

  // src/bookshelf/fake/fake-obsidian.ts
  var Platform = {
    isMobile: typeof window !== "undefined" && window.innerWidth <= 768
  };
  function setIcon(container, iconId) {
    var _a;
    const d = typeof window !== "undefined" && ((_a = window.BS_ICONS) == null ? void 0 : _a[iconId]) || "";
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
  var TFile = class {
    constructor(path, content, stat) {
      this.path = path;
      this.content = content;
      const slash = path.lastIndexOf("/");
      const dot = path.lastIndexOf(".");
      this.name = slash >= 0 ? path.slice(slash + 1) : path;
      this.basename = dot > slash + 1 ? this.name.slice(0, dot - slash - 1) : this.name;
      this.extension = dot > slash + 1 ? this.name.slice(dot - slash - 1 + 1).toLowerCase() : "";
      this.stat = stat || { ctime: 0, mtime: 0 };
    }
  };
  var VAULT_PREFIX = "bz-sim:";
  var META_PREFIX = "bz-sim-meta:";
  var FakeVault = class _FakeVault {
    constructor() {
      this.listeners = /* @__PURE__ */ new Map();
      this.idSeq = 0;
      /** adapter 面（readWeaveAggregates 读 weave-data.json 走这里） */
      this.adapter = {
        read: async (path) => {
          const raw = localStorage.getItem(_FakeVault.key(path));
          if (raw == null) throw new Error(`文件不存在：${path}`);
          return raw;
        }
      };
      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          if (!e.key || !e.key.startsWith(VAULT_PREFIX)) return;
          this.emit("modify", new TFile(e.key.slice(VAULT_PREFIX.length), ""));
        });
      }
    }
    static key(path) {
      return VAULT_PREFIX + path;
    }
    statOf(path) {
      var _a;
      try {
        const raw = localStorage.getItem(META_PREFIX + path);
        const c = raw ? (_a = JSON.parse(raw)) == null ? void 0 : _a.c : 0;
        if (typeof c === "number" && c > 0) return { ctime: c, mtime: c };
      } catch (e) {
      }
      return { ctime: 0, mtime: 0 };
    }
    /** 写入文件（种子与 modify 共用；ctime 元数据随种落） */
    putFile(path, content, ctime) {
      localStorage.setItem(_FakeVault.key(path), content);
      if (typeof ctime === "number" && ctime > 0) {
        localStorage.setItem(META_PREFIX + path, JSON.stringify({ c: ctime }));
      }
    }
    getAbstractFileByPath(path) {
      const raw = localStorage.getItem(_FakeVault.key(path));
      if (raw == null) return null;
      return new TFile(path, raw, this.statOf(path));
    }
    /** 全库 md 文件（getAllBookNotes / scanMarkdownBooks 回落分支用） */
    getMarkdownFiles() {
      const files = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(VAULT_PREFIX)) continue;
        const path = key.slice(VAULT_PREFIX.length);
        if (!path.endsWith(".md")) continue;
        files.push(this.getAbstractFileByPath(path));
      }
      return files;
    }
    async read(f) {
      var _a;
      return (_a = localStorage.getItem(_FakeVault.key(f.path))) != null ? _a : f.content;
    }
    async modify(f, content) {
      f.content = content;
      this.putFile(f.path, content);
      this.emit("modify", f);
    }
    /** 原子读改写（bookshelf/notes.ts 编辑批注/删划线收口） */
    async process(f, fn) {
      const latest = await this.read(f);
      await this.modify(f, fn(latest));
    }
    async create(path, content) {
      this.putFile(path, content);
      return this.getAbstractFileByPath(path);
    }
    async createFolder(_path) {
      return void 0;
    }
    /** 资源 URL：种子把封面图内容存成 data URI，直接回它（借书卡封面可显示） */
    getResourcePath(f) {
      return f.content.startsWith("data:") ? f.content : "";
    }
    /** 事件订阅（index.ts registerAutoRefresh 的 vault.on/offref 同形） */
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
  function parseFrontmatter(content) {
    if (!content.startsWith("---")) return null;
    const end = content.indexOf("\n---", 3);
    if (end < 0) return null;
    const fm = {};
    let listKey = null;
    for (const line of content.slice(3, end).split("\n")) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item && listKey) {
        fm[listKey].push(parseScalar(item[1].trim()));
        continue;
      }
      const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!kv) continue;
      if (kv[2].trim() === "") {
        fm[kv[1]] = [];
        listKey = kv[1];
      } else {
        listKey = null;
        fm[kv[1]] = parseScalar(kv[2].trim());
      }
    }
    return { frontmatter: fm };
  }
  function parseScalar(v) {
    if (v === "null") return null;
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    if (v.startsWith('"') && v.endsWith('"') || v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }
  var FakeApp = class {
    constructor() {
      this.vault = new FakeVault();
      /** parseBookFile/getAllBookNotes 的 frontmatter 来源：按文件内容即时解析 */
      this.metadataCache = {
        getFileCache: (file) => parseFrontmatter(file.content)
      };
      /** EPUB 笔记双击深链（notes-ui jumpToHighlight/openLinkText）：原型无工作台，no-op 降级 */
      this.workspace = {
        openLinkText: () => void 0
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
  function setSettingsProvider(fn) {
    _provider = fn;
  }
  function tryGetSettings() {
    return _provider ? _provider() : {};
  }

  // src/core/ui/str.ts
  var ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  }
  function esc(s) {
    return escapeHtml(String(s != null ? s : ""));
  }
  function iconSpan(name, extra = "") {
    return `<i data-lucide="${name}" class="bz-ic${extra ? " " + extra : ""}"></i>`;
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

  // src/bookshelf/state.ts
  var M = {
    currentOverlay: null,
    items: [],
    side: "all",
    catFilter: "all",
    sortMode: "recent",
    searchKeyword: "",
    searchDebounceTimer: null,
    appRef: null,
    renderFn: null,
    view: "shelf"
  };
  function applyDefaultView() {
    const s = tryGetSettings();
    const side = s.bookshelfDefaultSide;
    M.side = side === "reading" || side === "unread" || side === "done" ? side : "all";
    const sort = s.bookshelfSortMode;
    if (sort === "title") M.sortMode = "title";
    else if (sort === "progress") M.sortMode = "time";
    else M.sortMode = "recent";
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
  var SORT_LABEL = {
    recent: "最近读完",
    time: "时长最长",
    title: "书名"
  };
  var ICON = {
    report: "bar-chart-3",
    close: "x"
  };
  var EMPTY_BOOKS_ICON = "library-big";
  var EMPTY_SEARCH_ICON = "search-x";
  var EMPTY_FILTER_ICON = "funnel";

  // src/bookshelf/shared.ts
  function statusColor(status) {
    return STATUS_COLORS[status] || "var(--bz-text-3)";
  }
  function itemId(it) {
    var _a, _b, _c, _d;
    return (_d = (_c = (_b = (_a = it.file) == null ? void 0 : _a.path) != null ? _b : it.epubVaultPath) != null ? _c : it.id) != null ? _d : "";
  }
  function primaryDate(it) {
    var _a, _b;
    const d = it.completionDate || it.readingDate;
    if (d) {
      const t = new Date(d).getTime();
      if (!isNaN(t)) return t;
    }
    if ((_b = (_a = it.file) == null ? void 0 : _a.stat) == null ? void 0 : _b.ctime) return it.file.stat.ctime;
    return it.ctime || 0;
  }
  function sortItems(list, key) {
    const sorted = [...list];
    if (key === "title") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || "", "zh"));
    } else if (key === "time") {
      sorted.sort((a, b) => b.readingTimeMs - a.readingTimeMs || primaryDate(b) - primaryDate(a));
    } else {
      sorted.sort((a, b) => primaryDate(b) - primaryDate(a) || b.readingTimeMs - a.readingTimeMs);
    }
    return sorted;
  }
  function currentSideItems(items, side) {
    if (side === "all") return items;
    const status = side === "reading" ? "在读" : side === "unread" ? "未读" : "已读";
    return items.filter((it) => it.status === status);
  }
  function categoryLabel(it) {
    return it.category || "未分类";
  }
  function catFilterItems(list, cat) {
    if (!cat || cat === "all") return list;
    return list.filter((it) => categoryLabel(it) === cat);
  }
  function kwFilter(list, kw) {
    if (!kw) return list;
    const k = kw.trim().toLowerCase();
    return list.filter((it) => `${it.title} ${it.author || ""} ${it.category || ""}`.toLowerCase().includes(k));
  }
  function getDisplayItems(items, view) {
    let list = currentSideItems(items, view.side);
    list = catFilterItems(list, view.catFilter);
    list = kwFilter(list, view.q);
    return sortItems(list, view.sortMode);
  }
  function detailBodyHtml(it, coverSrc) {
    const cover = coverSrc ? `<img src="${esc(coverSrc)}" alt="">` : `<div class="bz-bs-d-cover-ph">${iconSpan("library")}<span>无封面</span></div>`;
    const review = it.bookReview ? `<div class="bz-bs-d-quote">“${esc(it.bookReview)}”</div>` : '<div class="bz-bs-d-quote dim">——尚无书评——</div>';
    const dense = it.highlights + it.thinks;
    const seal = it.status === "已读" ? "讫" : it.status === "在读" ? "阅" : "藏";
    const hoursText = it.readingTimeFormat || (it.readingTimeMs > 0 ? (it.readingTimeMs / 36e5).toFixed(1) + " 小时" : "—");
    const prog = Math.round(it.progress);
    return `
    <div class="bz-bs-d-pull">已抽出这本书</div>
    <button type="button" class="bz-bs-d-x" data-bs-d-close title="放回书架">×</button>
    <div class="bz-bs-d-card">
      <div class="bz-bs-d-cover">${cover}</div>
      <div class="bz-bs-d-info">
        <h2 class="bz-bs-d-title">${esc(it.title)}</h2>
        <div class="bz-bs-d-sub">${esc(it.author)} · ${esc(it.category || "未分类")}${it.isEpub ? " · EPUB" : ""}</div>
        ${review}
        <table class="bz-bs-d-ledger">
          <tr><td>状 态</td><td><span class="bz-bs-d-stdot" style="background:${statusColor(it.status)}"></span>${esc(it.status)}</td></tr>
          <tr><td>累计时长</td><td>${esc(hoursText)}</td></tr>
          <tr><td>起读 · 读完</td><td>${esc(it.readingDate || "—")} · ${esc(it.completionDate || "—")}</td></tr>
          <tr><td>划线 / 想法</td><td>${it.highlights} 条 / ${it.thinks} 条</td></tr>
          ${it.pages ? `<tr><td>页 数</td><td>${it.pages} 页</td></tr>` : ""}
          ${it.wordCount ? `<tr><td>字 数</td><td>${it.wordCount.toLocaleString()} 字</td></tr>` : ""}
        </table>
        <div class="bz-bs-d-meter">
          <div class="cap"><span>阅读进度</span><b class="bz-bs-d-prognum">${prog}%</b></div>
          <div class="bar"><i style="width:${prog}%"></i></div>
        </div>
        <div class="bz-bs-d-meter">
          <div class="cap">批注密度（划线 + 想法 = ${dense}）</div>
          <div class="bar"><i style="width:${Math.min(100, dense / Math.max(10, dense) * 100)}%"></i></div>
        </div>
      </div>
      <div class="bz-bs-d-seal">${seal}</div>
    </div>`;
  }

  // src/bookshelf/layouts/wall/render.ts
  var CAT = {
    "文学": { bg: "#8f4a3a", fg: "#f2e4d8" },
    "推理": { bg: "#7a3b52", fg: "#f2dee6" },
    "哲学": { bg: "#4f6f52", fg: "#e9efe6" },
    "科幻": { bg: "#3d5a73", fg: "#e2ecf4" },
    "心理学": { bg: "#5c5273", fg: "#e9e4f2" },
    "摄影": { bg: "#2f4858", fg: "#dbe8f0" },
    "天文学": { bg: "#1f3242", fg: "#c9dde9" },
    "生物学": { bg: "#6d7a3f", fg: "#eef0dc" },
    "龙与地下城": { bg: "#4a3626", fg: "#e8d9b0" },
    "历史": { bg: "#8a6d3b", fg: "#f5ecd8" },
    "武侠": { bg: "#9a5a2f", fg: "#f7ead9" },
    "奇幻": { bg: "#3f5a4a", fg: "#dfeee4" },
    "艺术": { bg: "#6b4a6e", fg: "#efe2f0" },
    "未分类": { bg: "#6b6257", fg: "#ded8ce" }
  };
  var FALLBACKS = ["#8a6d3b", "#4f6f52", "#3d5a73", "#8f4a3a", "#5c5273", "#7a3b52", "#6d7a3f", "#2f4858"];
  function fallbackColor(seed) {
    let h = 0;
    for (const ch of seed) h = h * 31 + (ch.codePointAt(0) || 0) >>> 0;
    return { bg: FALLBACKS[h % FALLBACKS.length], fg: "#f0e8d8" };
  }
  function catColor(cat) {
    return CAT[cat] || fallbackColor(cat);
  }
  function shade(hex, p) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, v + p));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function wallScale(items) {
    return {
      maxHrs: Math.max(36e5, ...items.map((b) => b.readingTimeMs)),
      maxWc: Math.max(1e4, ...items.map((b) => b.wordCount))
    };
  }
  function spineVars(it, scale) {
    const dense = it.highlights + it.thinks;
    const wc = it.wordCount > 0 ? it.wordCount : dense * 800;
    const h = 150 + it.readingTimeMs / scale.maxHrs * 80;
    const th = 22 + Math.sqrt(Math.min(wc, scale.maxWc) / scale.maxWc) * 34;
    const c = it.status === "未读" ? { bg: "#6b6257", fg: "#ded8ce" } : catColor(it.category || "未分类");
    let sh = 0;
    for (const ch of it.title) sh = sh * 31 + (ch.codePointAt(0) || 0) >>> 0;
    const jit = sh % 15 - 7;
    return `height:${Math.round(h)}px;width:${Math.round(th)}px;--c1:${shade(c.bg, jit)};--c2:${c.fg}`;
  }
  function fitTitle(spine, it) {
    const t = spine.querySelector(".bz-bs-spine-title");
    const avail = parseFloat(spine.style.height) - 36;
    let parts = it.title.split(/[:：]/);
    if (parts.length > 2) parts = [parts[0], parts.slice(1).join("：")];
    const fitFs = (n) => Math.max(9, Math.min(14, Math.floor(avail / (1.18 * Math.max(1, n)))));
    const cols = parts.map((p) => ({ p, fs: fitFs([...p].length) }));
    let width = 24;
    for (const c of cols) width += Math.ceil(c.fs * 1.25) + 6;
    t.innerHTML = cols.map((c, i) => `<span class="${i === 0 ? "t-main" : "t-sub"}" style="font-size:${c.fs}px;letter-spacing:${Math.max(1, Math.round(c.fs * 0.18))}px">${esc(c.p)}</span>`).join("");
    spine.style.width = `${Math.min(64, Math.max(parseFloat(spine.style.width), width))}px`;
  }
  function spineHTML(it, scale) {
    const cls = it.status === "已读" ? "read" : it.status === "在读" ? "reading" : "unread";
    return `<div class="bz-bs-spine ${cls}" style="${spineVars(it, scale)}" data-bs-id="${esc(itemId(it))}" data-bs-epub="${it.isEpub ? "1" : ""}" title="${esc(it.title)} · ${esc(it.status)}${it.progress > 0 ? " " + it.progress + "%" : ""}">
    <span class="bz-bs-spine-title"></span>
    ${it.status === "已读" ? '<span class="stamp">讫</span>' : ""}
    ${it.status === "在读" ? '<span class="ribbon"></span>' : ""}
  </div>`;
  }
  function mkBookend() {
    const d = document.createElement("div");
    d.className = "bz-bs-bookend";
    return d;
  }
  function mkSpine(it, scale) {
    const wrap = document.createElement("div");
    wrap.innerHTML = spineHTML(it, scale);
    const sp = wrap.firstElementChild;
    fitTitle(sp, it);
    return sp;
  }
  function packZone(shelf, cat, books, scale) {
    let zone = null;
    const newRow = () => {
      zone = document.createElement("div");
      zone.className = "bz-bs-zone";
      zone.appendChild(mkBookend());
      const dv = document.createElement("div");
      dv.className = "bz-bs-divider";
      dv.textContent = cat + " 区";
      zone.appendChild(dv);
      shelf.appendChild(zone);
    };
    for (let i = 0; i < books.length; i++) {
      if (!zone) newRow();
      const sp = mkSpine(books[i], scale);
      zone.appendChild(sp);
      if (zone.scrollWidth > zone.clientWidth) {
        zone.removeChild(sp);
        if (!zone.querySelector(".bz-bs-spine")) zone.appendChild(sp);
        else {
          i--;
          zone = null;
        }
      }
    }
    zone = null;
  }
  function bzEmptyHtml(icon, title, desc) {
    return `<div class="bz-empty">${iconSpan(icon, "bz-empty-ic")}<div class="bz-empty-title">${esc(title)}</div><div class="bz-empty-desc">${esc(desc)}</div></div>`;
  }
  function wallEmptyHTML(itemsTotal, q, folder, tag) {
    const cfg = !itemsTotal ? { icon: EMPTY_BOOKS_ICON, title: "书库还是空的", desc: `把书籍笔记放进「${folder}」文件夹，并在 frontmatter 添加 tags: ${tag} 标签` } : q ? { icon: EMPTY_SEARCH_ICON, title: "没有找到相关的书", desc: "试试其他关键词，或换一个筛选" } : { icon: EMPTY_FILTER_ICON, title: "这个筛选下还没有书", desc: "换一个状态或分类标签，或用搜索找找" };
    return `<div class="bz-bs-wall-empty">${bzEmptyHtml(cfg.icon, cfg.title, cfg.desc)}</div>`;
  }
  function wallLoadingHTML() {
    return `<div class="bz-bs-wall-empty">${bzEmptyHtml("loader", "正在整理书架…", "")}</div>`;
  }
  function labelsHtml(items, side, catFilter) {
    const statusDefs = [
      { f: "all", n: items.length, t: "全馆藏书" },
      { f: "done", n: items.filter((x) => x.status === "已读").length, t: "已读 · 讫" },
      { f: "reading", n: items.filter((x) => x.status === "在读").length, t: "在读 · 抽出" },
      { f: "unread", n: items.filter((x) => x.status === "未读").length, t: "未读 · 倒叠" }
    ];
    const cats = /* @__PURE__ */ new Map();
    for (const b of items) {
      if (b.status === "未读") continue;
      const k = b.category || "未分类";
      const c = cats.get(k) || { n: 0, ms: 0 };
      c.n++;
      c.ms += b.readingTimeMs;
      cats.set(k, c);
    }
    const catPairs = [...cats.entries()].sort((a, b) => b[1].n - a[1].n);
    const filtering = side !== "all" || catFilter !== "all";
    const html = statusDefs.map((d) => {
      const on = d.f === "all" ? side === "all" && catFilter === "all" : side === d.f;
      const off = filtering && !on && d.f !== "all";
      return `
    <div class="bz-bs-taglabel${on ? " on" : ""}${off ? " off" : ""}" data-bs-side="${d.f}">
      <span class="pin"></span><div class="n">${d.n}</div><div class="t">${d.t}</div>
    </div>`;
    }).join("");
    const catHtml = catPairs.map(([cat, c]) => {
      const hrs = c.ms > 0 ? ` · ${Math.round(c.ms / 36e5)} 时` : "";
      const off = filtering && catFilter !== cat;
      return `<div class="bz-bs-taglabel dim-cat${catFilter === cat ? " on" : ""}${off ? " off" : ""}" data-bs-cat="${esc(cat)}">
      <span class="pin"></span><div class="n">${esc(cat)}</div><div class="t">${c.n} 册${hrs}</div>
    </div>`;
    }).join("");
    return `${html}<div class="bz-bs-cats">${catHtml}</div>`;
  }
  function sortSegHtml(sortMode) {
    return Object.keys(SORT_LABEL).map((k) => `<button type="button" data-bs-sort="${k}"${sortMode === k ? ' class="on"' : ""}>${SORT_LABEL[k]}</button>`).join("");
  }
  function panelHtml(skinClass) {
    return `
    <div class="bz-panel-frame bz-bs-panel bz-panel-mtop ${esc(skinClass)}">
      <div class="bz-bs-wallpage">
      <div class="bz-bs-header">
        <div class="bz-bs-plaque" data-bs-plaque><h1>书库</h1><p>LIBRARY</p></div>
        <div class="bz-bs-labels" id="bz-bs-labels"></div>
      </div>
        <div class="bz-bs-tools">
          <input id="bz-bs-dsearch" class="bz-bs-search" type="text" placeholder="检索书名或作者…" autocomplete="off">
          <div class="bz-bs-seg" id="bz-bs-sortseg"></div>
          <div class="bz-bs-hint" id="bz-bs-hint"></div>
        </div>
        <div class="bz-bs-view bz-bs-view-shelf active">
          <div class="bz-bs-room">
            <div class="bz-bs-shelf" id="bz-bs-shelf"></div>
            <div class="bz-bs-wallnote">—— 书脊的高度是时长，厚度是批注，抽出的是正在进行 ——</div>
          </div>
        </div>
        <div class="bz-bs-view bz-bs-view-report">
          <div class="bz-rr-head">
            <span class="bz-rr-title">${iconSpan(ICON.report, "bz-ic--sm")}阅读分析报告</span>
            <button class="bz-icon-btn bz-rr-close" data-rr-goto-shelf title="返回书库">${iconSpan(ICON.close)}</button>
          </div>
          <div class="bz-rr-content"></div>
        </div>
      </div>
    </div>`;
  }
  function renderWallInto(shelf, opts) {
    var _a;
    const scale = wallScale(opts.all);
    const onShelf = opts.list.filter((b) => b.status !== "未读");
    const unread = opts.list.filter((b) => b.status === "未读");
    shelf.innerHTML = "";
    if (opts.hint) opts.hint.textContent = `${onShelf.length + unread.length} 册在墙`;
    if (!onShelf.length && !unread.length) {
      shelf.innerHTML = wallEmptyHTML(opts.all.length, opts.q, opts.emptyFolder, opts.emptyTag);
      (_a = opts.hooks) == null ? void 0 : _a.mountIcons(shelf);
      return;
    }
    const zones = /* @__PURE__ */ new Map();
    for (const b of onShelf) {
      const k = b.category || "未分类";
      const arr = zones.get(k) || [];
      arr.push(b);
      zones.set(k, arr);
    }
    const sortedZones = [...zones.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [cat, books] of sortedZones) packZone(shelf, cat, books, scale);
    if (unread.length) {
      const zone = document.createElement("div");
      zone.className = "bz-bs-zone";
      const dv = document.createElement("div");
      dv.className = "bz-bs-divider";
      dv.textContent = "倒 叠 区";
      zone.appendChild(dv);
      zone.appendChild(mkBookend());
      for (const b of unread) zone.appendChild(mkSpine(b, scale));
      zone.appendChild(mkBookend());
      shelf.appendChild(zone);
    }
  }

  // src/bookshelf/data.ts
  var WEAVE_PLUGIN_ID = "weave-epub-reader";
  var WEAVE_DATA_FILE = "weave-data.json";
  var COVER_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
  function resolveFolderPath() {
    const s = tryGetSettings();
    const v = typeof s.bookshelfFolderPath === "string" && s.bookshelfFolderPath.trim() ? s.bookshelfFolderPath : typeof s.libraryFolderPath === "string" && s.libraryFolderPath.trim() ? s.libraryFolderPath : "书库";
    return v.replace(/^\/+|\/+$/g, "");
  }
  function resolveBookTag() {
    const s = tryGetSettings();
    return typeof s.bookTag === "string" && s.bookTag.trim() ? s.bookTag.trim() : "book";
  }
  function parseStatus(readingDate, completionDate) {
    if (readingDate && !completionDate) return "在读";
    if (readingDate && completionDate) return "已读";
    return "未读";
  }
  function parseReadingTimeMs(fm) {
    var _a;
    const raw = Number(fm == null ? void 0 : fm.readingTime);
    if (Number.isFinite(raw) && raw > 0) return Math.round(raw);
    const fmt = String((_a = fm == null ? void 0 : fm.readingTimeFormat) != null ? _a : "").trim();
    if (!fmt) return 0;
    let ms = 0;
    for (const m of fmt.matchAll(/(\d+(?:\.\d+)?)\s*(小时|h|分|min|m|秒|s)/gi)) {
      const v = parseFloat(m[1]);
      const unit = m[2].toLowerCase();
      if (unit === "小时" || unit === "h") ms += v * 36e5;
      else if (unit === "分" || unit === "min" || unit === "m") ms += v * 6e4;
      else ms += v * 1e3;
    }
    return Math.round(ms);
  }
  function parseBookFile(file, app, folderPath, bookTag) {
    var _a, _b, _c;
    const metadata = app.metadataCache.getFileCache(file);
    const fm = metadata == null ? void 0 : metadata.frontmatter;
    if (!fm) return null;
    let tags = fm.tags;
    if (!tags) return null;
    if (!Array.isArray(tags)) tags = [tags];
    if (!tags.includes(bookTag)) return null;
    const title = file.basename;
    const author = ((_a = fm.author) == null ? void 0 : _a.toString()) || "未知作者";
    const category = ((_b = fm.category) == null ? void 0 : _b.toString()) || "未分类";
    let cover = fm.cover ? fm.cover.toString() : null;
    if (cover && !cover.includes("/")) {
      cover = `CONFIG/BOOK/${title}/${cover}`;
    }
    const bookReview = fm.bookReview ? fm.bookReview.toString() : null;
    const readingDate = fm.readingDate ? fm.readingDate.toString() : null;
    const completionDate = fm.completionDate ? fm.completionDate.toString() : null;
    const progress = fm.readingProgress !== void 0 ? Number(fm.readingProgress) || 0 : 0;
    const readingTimeFormat = ((_c = fm.readingTimeFormat) == null ? void 0 : _c.toString()) || null;
    const highlights = Number(fm.highlights) || 0;
    const thinks = Number(fm.thinks) || 0;
    return {
      file,
      title,
      author,
      category,
      cover,
      bookReview,
      readingDate,
      completionDate,
      progress: progress > 100 ? 100 : progress,
      readingTimeFormat,
      readingTimeMs: parseReadingTimeMs(fm),
      highlights,
      thinks,
      // 书脊厚度量（issue 218）：字数（缺省 0，UI 层回退批注密度）
      wordCount: Number(fm.wordCount) || 0,
      pages: Number(fm.pages) || 0,
      status: parseStatus(readingDate, completionDate),
      isEpub: false,
      epubVaultPath: null
    };
  }
  function scanMarkdownBooks(app) {
    const folderPath = resolveFolderPath();
    const bookTag = resolveBookTag();
    const folder = app.vault.getAbstractFileByPath(folderPath);
    const files = [];
    if (folder && Array.isArray(folder.children)) {
      const stack = [...folder.children];
      while (stack.length) {
        const cur = stack.pop();
        if (Array.isArray(cur == null ? void 0 : cur.children)) stack.push(...cur.children);
        else if ((cur == null ? void 0 : cur.extension) === "md") files.push(cur);
      }
    } else {
      files.push(...app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(folderPath + "/") || f.path === folderPath + ".md"));
    }
    const items = [];
    for (const file of files) {
      try {
        const item = parseBookFile(file, app, folderPath, bookTag);
        if (item) items.push(item);
      } catch (e) {
        console.warn("处理书目文件失败:", file.path, e);
      }
    }
    return items;
  }
  function normalizeWeaveDataPath(value) {
    const raw = String(value || "").trim().replace(/^\/+|\/+$/g, "");
    return raw || "CONFIG/STORAGE";
  }
  function resolveWeaveDataPath(app) {
    var _a, _b, _c;
    const plugins = (_a = app.plugins) == null ? void 0 : _a.plugins;
    const fromWeave = (_c = (_b = plugins == null ? void 0 : plugins[WEAVE_PLUGIN_ID]) == null ? void 0 : _b.settings) == null ? void 0 : _c.dataPath;
    return normalizeWeaveDataPath(fromWeave);
  }
  function isVaultImageFile(app, path) {
    var _a, _b;
    const file = (_b = (_a = app.vault) == null ? void 0 : _a.getAbstractFileByPath) == null ? void 0 : _b.call(_a, path);
    return Boolean(file) && /\.(png|jpe?g|gif|webp)$/i.test(file.name || path);
  }
  function resolveEpubCoverPath(app, meta) {
    const coverPath = typeof (meta == null ? void 0 : meta.coverPath) === "string" ? meta.coverPath.trim() : "";
    if (coverPath && isVaultImageFile(app, coverPath)) return coverPath;
    const title = typeof (meta == null ? void 0 : meta.title) === "string" ? meta.title.trim() : "";
    if (title) {
      for (const ext of COVER_EXTENSIONS) {
        const candidate = `CONFIG/BOOK/EPUB COVER/${title}.${ext}`;
        if (isVaultImageFile(app, candidate)) return candidate;
      }
    }
    return null;
  }
  function formatReadingTime(totalReadTimeMs) {
    const totalMinutes = Math.round((Number(totalReadTimeMs) || 0) / 6e4);
    if (totalMinutes <= 0) return null;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
    return `${minutes}分`;
  }
  function toDateString(timestamp) {
    if (!Number.isFinite(timestamp) || !timestamp) return null;
    const d = new Date(timestamp);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function buildEpubItem(app, aggregate) {
    var _a, _b, _c;
    const meta = aggregate == null ? void 0 : aggregate.meta;
    const fileRef = aggregate == null ? void 0 : aggregate.file;
    const reading = aggregate == null ? void 0 : aggregate.reading;
    const notes = aggregate == null ? void 0 : aggregate.notes;
    const stats = reading == null ? void 0 : reading.stats;
    const vaultPath = typeof (fileRef == null ? void 0 : fileRef.vaultPath) === "string" ? fileRef.vaultPath.trim() : "";
    const title = typeof (meta == null ? void 0 : meta.title) === "string" ? meta.title.trim() : "";
    if (!vaultPath || !title) return null;
    const rawPercent = typeof ((_a = reading == null ? void 0 : reading.position) == null ? void 0 : _a.percent) === "number" ? reading.position.percent : 0;
    const progress = rawPercent > 1 ? Math.min(100, Math.round(rawPercent)) : Math.round(Math.max(0, Math.min(1, rawPercent)) * 100);
    const lastReadTime = Number.isFinite(stats == null ? void 0 : stats.lastReadTime) ? stats.lastReadTime : 0;
    const completedTime = Number.isFinite(stats == null ? void 0 : stats.completedTime) ? stats.completedTime : 0;
    const totalReadTimeMs = Number.isFinite(stats == null ? void 0 : stats.totalReadTime) ? stats.totalReadTime : 0;
    const readingDate = progress > 0 ? toDateString(lastReadTime) : null;
    const completionDate = toDateString(completedTime);
    const vaultFile = (_c = (_b = app == null ? void 0 : app.vault) == null ? void 0 : _b.getAbstractFileByPath) == null ? void 0 : _c.call(_b, vaultPath);
    const subjects = Array.isArray(meta == null ? void 0 : meta.subjects) ? meta.subjects : [];
    const epubCategory = typeof subjects[0] === "string" && subjects[0].trim() ? subjects[0].trim() : null;
    return {
      file: vaultFile instanceof TFile ? vaultFile : null,
      title,
      author: typeof (meta == null ? void 0 : meta.author) === "string" && meta.author.trim() ? meta.author.trim() : "未知作者",
      category: epubCategory,
      cover: resolveEpubCoverPath(app, meta),
      bookReview: null,
      readingDate,
      completionDate,
      progress,
      readingTimeFormat: formatReadingTime(totalReadTimeMs),
      readingTimeMs: totalReadTimeMs,
      highlights: Array.isArray(notes == null ? void 0 : notes.highlights) ? notes.highlights.length : 0,
      thinks: Array.isArray(notes == null ? void 0 : notes.excerpts) ? notes.excerpts.length : 0,
      wordCount: 0,
      pages: 0,
      status: completionDate ? "已读" : progress > 0 ? "在读" : "未读",
      isEpub: true,
      epubVaultPath: vaultPath
    };
  }
  async function readWeaveAggregates(app) {
    var _a, _b;
    try {
      const dataPath = resolveWeaveDataPath(app);
      const dataFilePath = `${dataPath}/${WEAVE_DATA_FILE}`;
      const file = (_b = (_a = app == null ? void 0 : app.vault) == null ? void 0 : _a.getAbstractFileByPath) == null ? void 0 : _b.call(_a, dataFilePath);
      if (!file) return [];
      const content = await app.vault.adapter.read(dataFilePath);
      const parsed = JSON.parse(content);
      const books = parsed == null ? void 0 : parsed.books;
      if (!books || typeof books !== "object") return [];
      return Object.values(books);
    } catch (e) {
      return [];
    }
  }
  async function loadEpubItems(app) {
    const aggregates = await readWeaveAggregates(app);
    const items = [];
    for (const aggregate of aggregates) {
      const item = buildEpubItem(app, aggregate);
      if (item) items.push(item);
    }
    return items;
  }
  var rebuildSeq = 0;
  async function rebuildItems(app) {
    const seq = ++rebuildSeq;
    const mdItems = scanMarkdownBooks(app);
    const epubItems = await loadEpubItems(app);
    if (seq !== rebuildSeq) return M.items;
    const merged = [...mdItems, ...epubItems];
    M.items.length = 0;
    M.items.push(...merged);
    return merged;
  }
  function getDisplayItems2() {
    return getDisplayItems(M.items, { side: M.side, catFilter: M.catFilter, q: M.searchKeyword, sortMode: M.sortMode });
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

  // src/core/mobile.ts
  function isMobileEnv() {
    return typeof Platform !== "undefined" && !!Platform.isMobile;
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
  function uiBtnRow(buttons, opts) {
    const row = document.createElement("div");
    const cls = ["bz-btn-row"];
    if (opts == null ? void 0 : opts.center) cls.push("bz-btn-row--center");
    if (opts == null ? void 0 : opts.grow) cls.push("bz-btn-row--grow");
    row.className = cls.join(" ");
    buttons.forEach((x) => row.appendChild(x));
    return row;
  }

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
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "bz-icon-btn bz-icon-btn--lg";
      closeBtn.title = "关闭";
      closeBtn.appendChild(uiIcon("x"));
      closeBtn.addEventListener("click", () => close());
      head.appendChild(title);
      head.appendChild(closeBtn);
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
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // src/reading-report/stats.ts
  function mapWeaveSessionToReport(session) {
    const start = typeof (session == null ? void 0 : session.start) === "number" ? session.start : 0;
    const end = typeof (session == null ? void 0 : session.end) === "number" ? session.end : start;
    const durationSeconds = typeof (session == null ? void 0 : session.durationSeconds) === "number" ? Math.round(session.durationSeconds) : 0;
    return { start, end, duration: durationSeconds };
  }
  function toIsoDate(timestamp) {
    if (!Number.isFinite(timestamp) || !timestamp) return null;
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function buildEpubBookNoteEntry(aggregate) {
    var _a, _b;
    const meta = aggregate == null ? void 0 : aggregate.meta;
    const fileRef = aggregate == null ? void 0 : aggregate.file;
    const reading = aggregate == null ? void 0 : aggregate.reading;
    const notes = aggregate == null ? void 0 : aggregate.notes;
    const stats = reading == null ? void 0 : reading.stats;
    const vaultPath = typeof (fileRef == null ? void 0 : fileRef.vaultPath) === "string" ? fileRef.vaultPath.trim() : "";
    const title = typeof (meta == null ? void 0 : meta.title) === "string" ? meta.title.trim() : "";
    if (!vaultPath || !title) return null;
    const rawPercent = typeof ((_a = reading == null ? void 0 : reading.position) == null ? void 0 : _a.percent) === "number" ? reading.position.percent : 0;
    const progress = rawPercent > 1 ? Math.min(100, Math.round(rawPercent)) : Math.round(Math.max(0, Math.min(1, rawPercent)) * 100);
    const wordCount = typeof (meta == null ? void 0 : meta.wordCount) === "number" && meta.wordCount > 0 ? meta.wordCount : 0;
    const pages = Math.floor(wordCount / 500);
    const sessions = Array.isArray(reading == null ? void 0 : reading.sessions) ? reading.sessions : [];
    const readingDate = (stats == null ? void 0 : stats.lastReadTime) ? toIsoDate(stats.lastReadTime) : null;
    return {
      file: {
        path: vaultPath,
        name: vaultPath.split("/").pop() || title,
        basename: ((_b = vaultPath.split("/").pop()) == null ? void 0 : _b.replace(/\.[^./]+$/, "")) || title
      },
      frontmatter: {
        title,
        author: typeof (meta == null ? void 0 : meta.author) === "string" && meta.author.trim() ? meta.author.trim() : "未知作者",
        category: "未分类",
        readingProgress: progress,
        readingTime: typeof (stats == null ? void 0 : stats.totalReadTime) === "number" ? stats.totalReadTime : 0,
        readingSessions: sessions.map(mapWeaveSessionToReport),
        readingDate,
        completionDate: toIsoDate(stats == null ? void 0 : stats.completedTime),
        highlights: Array.isArray(notes == null ? void 0 : notes.highlights) ? notes.highlights.length : 0,
        thinks: Array.isArray(notes == null ? void 0 : notes.excerpts) ? notes.excerpts.length : 0,
        dialogue: 0,
        outlinks: 0,
        pages,
        wordCount
      },
      cache: null
    };
  }
  async function getEpubBookNotes(app) {
    const aggregates = await readWeaveAggregates(app);
    const entries = [];
    for (const aggregate of aggregates) {
      const entry = buildEpubBookNoteEntry(aggregate);
      if (entry) entries.push(entry);
    }
    return entries;
  }
  function getAllBookNotes(app) {
    const bookTag = resolveBookTag();
    const folderPath = resolveFolderPath();
    const files = app.vault.getMarkdownFiles();
    const bookNotes = [];
    for (const file of files) {
      try {
        if (file.path !== `${folderPath}.md` && !file.path.startsWith(`${folderPath}/`)) continue;
        const cache = app.metadataCache.getFileCache(file);
        if (!cache || !cache.frontmatter) continue;
        const tags = cache.frontmatter.tags;
        let isBook = false;
        if (typeof tags === "string") {
          isBook = tags === bookTag;
        } else if (Array.isArray(tags)) {
          isBook = tags.includes(bookTag);
        }
        if (isBook) {
          bookNotes.push({
            file,
            frontmatter: cache.frontmatter,
            cache
          });
        }
      } catch (error) {
        console.warn(`处理文件 ${file.path} 时出错:`, error);
      }
    }
    return bookNotes;
  }
  function emptyMonthlyStats() {
    return {
      booksRead: 0,
      booksCompleted: 0,
      totalReadingTime: 0,
      totalHighlights: 0,
      readingProgress: 0
    };
  }
  function emptyYearlyStats() {
    return {
      booksRead: 0,
      booksCompleted: 0,
      totalReadingTime: 0,
      totalHighlights: 0,
      averageProgress: 0
    };
  }
  function calculateReadingStats(books) {
    const stats = {
      totalBooks: books.length,
      readBooks: 0,
      readingBooks: 0,
      unreadBooks: 0,
      totalReadingTime: 0,
      totalHighlights: 0,
      totalThinks: 0,
      totalDialogue: 0,
      totalOutlinks: 0,
      monthlyStats: {},
      yearlyStats: {},
      authorStats: {},
      readingSessions: [],
      progressDistribution: {
        unread: 0,
        justStarted: 0,
        inProgress: 0,
        almostDone: 0,
        completed: 0
      },
      readingSpeed: {
        totalPages: 0,
        totalWords: 0,
        averagePagesPerHour: 0,
        averageWordsPerHour: 0
      }
    };
    books.forEach((book, index) => {
      try {
        const fm = book.frontmatter;
        const readingProgress = parseFloat(fm.readingProgress) || 0;
        const readingTime = parseFloat(fm.readingTime) || 0;
        if (fm.readingSessions && Array.isArray(fm.readingSessions)) {
          stats.readingSessions = stats.readingSessions.concat(fm.readingSessions).filter((d) => d.duration > 60);
        }
        if (fm.readingDate && fm.completionDate) {
          stats.readBooks++;
        } else if (fm.readingDate) {
          stats.readingBooks++;
        } else {
          stats.unreadBooks++;
        }
        stats.totalReadingTime += readingTime;
        stats.totalHighlights += parseInt(fm.highlights) || 0;
        stats.totalThinks += parseInt(fm.thinks) || 0;
        stats.totalDialogue += parseInt(fm.dialogue) || 0;
        stats.totalOutlinks += parseInt(fm.outlinks) || 0;
        if (readingProgress === 0) stats.progressDistribution.unread++;
        else if (readingProgress <= 20) stats.progressDistribution.justStarted++;
        else if (readingProgress <= 80) stats.progressDistribution.inProgress++;
        else if (readingProgress < 100) stats.progressDistribution.almostDone++;
        else stats.progressDistribution.completed++;
        const author = fm.author || "未知作者";
        if (!stats.authorStats[author]) {
          stats.authorStats[author] = {
            count: 0,
            totalReadingTime: 0,
            totalBooks: 0,
            completedBooks: 0
          };
        }
        stats.authorStats[author].count++;
        stats.authorStats[author].totalReadingTime += readingTime;
        stats.authorStats[author].totalBooks++;
        if (readingProgress >= 100) stats.authorStats[author].completedBooks++;
        const pages = parseInt(fm.pages) || 0;
        const words = parseInt(fm.wordCount) || 0;
        stats.readingSpeed.totalPages += pages;
        stats.readingSpeed.totalWords += words;
        if (fm.readingDate) {
          try {
            const date = new Date(fm.readingDate);
            const monthKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
            const yearKey = date.getFullYear().toString();
            if (!stats.monthlyStats[monthKey]) stats.monthlyStats[monthKey] = emptyMonthlyStats();
            stats.monthlyStats[monthKey].booksRead++;
            stats.monthlyStats[monthKey].totalReadingTime += readingTime;
            stats.monthlyStats[monthKey].totalHighlights += parseInt(fm.highlights) || 0;
            if (!stats.yearlyStats[yearKey]) stats.yearlyStats[yearKey] = emptyYearlyStats();
            stats.yearlyStats[yearKey].booksRead++;
            stats.yearlyStats[yearKey].totalReadingTime += readingTime;
            stats.yearlyStats[yearKey].totalHighlights += parseInt(fm.highlights) || 0;
          } catch (dateError) {
            console.warn(`日期解析错误: ${fm.readingDate}`, dateError);
          }
        }
        if (fm.completionDate) {
          try {
            const compDate = new Date(fm.completionDate);
            const compMonthKey = `${compDate.getFullYear()}-${pad2(compDate.getMonth() + 1)}`;
            const compYearKey = compDate.getFullYear().toString();
            if (!stats.monthlyStats[compMonthKey]) stats.monthlyStats[compMonthKey] = emptyMonthlyStats();
            stats.monthlyStats[compMonthKey].booksCompleted++;
            if (!stats.yearlyStats[compYearKey]) stats.yearlyStats[compYearKey] = emptyYearlyStats();
            stats.yearlyStats[compYearKey].booksCompleted++;
          } catch (dateError) {
            console.warn(`完成日期解析错误: ${fm.completionDate}`, dateError);
          }
        }
      } catch (error) {
        console.warn(`处理第 ${index + 1} 本书时出错:`, error, book);
      }
    });
    if (stats.totalReadingTime > 0) {
      const totalHours = stats.totalReadingTime / 36e5;
      stats.readingSpeed.averagePagesPerHour = stats.readingSpeed.totalPages / totalHours;
      stats.readingSpeed.averageWordsPerHour = stats.readingSpeed.totalWords / totalHours;
    }
    return stats;
  }
  function formatReadingTime2(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? `${minutes}m` : ""}`;
    } else {
      return `${minutes}m`;
    }
  }
  function formatSessionDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }
  function analyzeReadingSessions(sessions) {
    const totalSessions = sessions.length;
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    const avgDuration = totalDuration / totalSessions;
    const completedSessions = sessions.filter((s) => s.type === "completed").length;
    const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    sessions.forEach((session) => {
      const hour = new Date(session.start).getHours();
      if (hour >= 6 && hour < 12) timeSlots.morning++;
      else if (hour >= 12 && hour < 18) timeSlots.afternoon++;
      else if (hour >= 18 && hour < 24) timeSlots.evening++;
      else timeSlots.night++;
    });
    return { totalSessions, totalDuration, avgDuration, completedSessions, timeSlots };
  }
  function analyzeReadingHabits(sessions) {
    const stats = analyzeReadingSessions(sessions);
    const avgDuration = stats.avgDuration;
    let readingPattern = "";
    if (avgDuration < 600) readingPattern = "碎片化阅读 (短时间多次)";
    else if (avgDuration < 1800) readingPattern = "均衡型阅读";
    else readingPattern = "深度沉浸式阅读";
    const longSessions = sessions.filter((s) => s.duration > 1800).length;
    const focusPercentage = (longSessions / sessions.length * 100).toFixed(1);
    let focusLevel = "";
    if (parseFloat(focusPercentage) > 50) focusLevel = "高度专注";
    else if (parseFloat(focusPercentage) > 25) focusLevel = "中等专注";
    else focusLevel = "轻度专注";
    const timeDistribution = {};
    Object.entries(stats.timeSlots).forEach(([slot, count]) => {
      timeDistribution[slot] = (count / sessions.length * 100).toFixed(1);
    });
    const peakTime = Object.entries(stats.timeSlots).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const peakLabels = {
      morning: "早晨时段最活跃",
      afternoon: "下午时段最活跃",
      evening: "晚间时段最活跃",
      night: "深夜时段最活跃"
    };
    return {
      readingPattern,
      focusLevel: `${focusLevel} (${focusPercentage}%长时间会话)`,
      peakTime: peakLabels[peakTime],
      timeDistribution
    };
  }
  function getMonthlyTrendData(stats) {
    const monthlyEntries = Object.entries(stats.monthlyStats).sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
    return monthlyEntries.map(([month, data]) => ({
      month,
      booksRead: data.booksRead,
      booksCompleted: data.booksCompleted || 0,
      readingTime: data.totalReadingTime,
      highlights: data.totalHighlights
    }));
  }
  function calculateMonthlyAverage(monthlyData) {
    if (monthlyData.length === 0) return "0.0";
    const total = monthlyData.reduce((sum, data) => sum + data.booksRead, 0);
    return (total / monthlyData.length).toFixed(1);
  }
  function getCurrentMonthStats(monthlyData, now = /* @__PURE__ */ new Date()) {
    var _a, _b;
    const key = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
    const current = monthlyData.find((m) => m.month === key);
    return {
      books: (_a = current == null ? void 0 : current.booksRead) != null ? _a : 0,
      completed: (_b = current == null ? void 0 : current.booksCompleted) != null ? _b : 0
    };
  }
  function calculateQuarterlyAverage(monthlyData) {
    if (monthlyData.length < 3) return calculateMonthlyAverage(monthlyData);
    const lastThree = monthlyData.slice(-3);
    return calculateMonthlyAverage(lastThree);
  }
  function calculateCompletionRate(stats) {
    const totalRead = stats.readBooks + stats.readingBooks;
    if (totalRead === 0) return "0%";
    const rate = (stats.readBooks / totalRead * 100).toFixed(0);
    return rate + "%";
  }
  function analyzeTrendDirection(monthlyData) {
    if (monthlyData.length < 2) return "→";
    const recentAvg = calculateMonthlyAverage(monthlyData.slice(-3));
    const previousAvg = monthlyData.length >= 6 ? calculateMonthlyAverage(monthlyData.slice(-6, -3)) : recentAvg;
    const diff = parseFloat(recentAvg) - parseFloat(previousAvg);
    if (Math.abs(diff) < 0.5) return "→";
    return diff > 0 ? "↑" : "↓";
  }
  function analyzeReadingTrends(stats, bookNotes, now = /* @__PURE__ */ new Date()) {
    const monthlyData = getMonthlyTrendData(stats);
    const ascendingRecent = monthlyData.slice(-6);
    const recentMonths = [...ascendingRecent].reverse();
    return {
      recentMonths,
      monthlyAvg: calculateMonthlyAverage(ascendingRecent),
      currentMonth: getCurrentMonthStats(ascendingRecent, now),
      quarterlyAvg: calculateQuarterlyAverage(ascendingRecent),
      completionRate: calculateCompletionRate(stats),
      trendDirection: analyzeTrendDirection(ascendingRecent),
      focusScore: calculateFocusScore(bookNotes),
      focusLevel: getFocusLevel(bookNotes),
      consistencyDays: calculateConsistencyDays(stats),
      consistencyLevel: getConsistencyLevel(stats),
      efficiency: calculateReadingEfficiency(stats, bookNotes),
      recommendations: generatePracticalRecommendations(stats, bookNotes)
    };
  }
  function calculateFocusScore(bookNotes) {
    const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate && book.frontmatter.readingTime);
    if (completedBooks.length === 0) return 0;
    let totalScore = 0;
    completedBooks.forEach((book) => {
      const pages = parseInt(book.frontmatter.pages) || 200;
      const readingTime = parseFloat(book.frontmatter.readingTime) || 0;
      const hours = readingTime / 36e5;
      if (hours > 0) {
        const pagesPerHour = pages / hours;
        let score = Math.max(0, Math.min(100, (pagesPerHour - 20) / 40 * 100));
        totalScore += score;
      }
    });
    return Math.round(totalScore / completedBooks.length);
  }
  function getFocusLevel(bookNotes) {
    const score = calculateFocusScore(bookNotes);
    if (score >= 80) return "高度专注";
    if (score >= 60) return "中等专注";
    if (score >= 40) return "一般专注";
    return "需要提升";
  }
  function calculateConsistencyDays(stats) {
    const monthlyCount = Object.keys(stats.monthlyStats).length;
    return Math.min(monthlyCount * 7, 30);
  }
  function getConsistencyLevel(stats) {
    const days = calculateConsistencyDays(stats);
    if (days >= 20) return "优秀";
    if (days >= 10) return "良好";
    return "待加强";
  }
  function calculateReadingEfficiency(stats, bookNotes) {
    const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate);
    const totalReadingTime = stats.totalReadingTime / 36e5;
    const totalPages = bookNotes.reduce((sum, book) => sum + (parseInt(book.frontmatter.pages) || 0), 0);
    return {
      pagesPerHour: totalReadingTime > 0 ? (totalPages / totalReadingTime).toFixed(1) : "0.0",
      notesPerBook: completedBooks.length > 0 ? (stats.totalHighlights / completedBooks.length).toFixed(1) : "0.0",
      timePerBook: completedBooks.length > 0 ? (totalReadingTime / completedBooks.length).toFixed(1) : "0.0"
    };
  }
  function generatePracticalRecommendations(stats, bookNotes) {
    const recommendations = [];
    const completionRate = parseFloat(calculateCompletionRate(stats));
    if (completionRate < 50) {
      recommendations.push("建议优先完成已开始的书籍，提高完成率");
    }
    const efficiency = calculateReadingEfficiency(stats, bookNotes);
    if (parseFloat(efficiency.pagesPerHour) < 20) {
      recommendations.push("阅读速度较慢，可以尝试提升阅读技巧");
    }
    if (calculateConsistencyDays(stats) < 15) {
      recommendations.push("建立每日阅读习惯，保持连续性");
    }
    const focusScore = calculateFocusScore(bookNotes);
    if (focusScore < 60) {
      recommendations.push("提升阅读时的专注度，减少干扰");
    }
    return recommendations.length > 0 ? recommendations.join("；") : "您的阅读习惯很优秀，继续保持！";
  }
  function processHeatmapData(readingSessions) {
    const dailyData = {};
    let totalDuration = 0;
    let totalSessions = 0;
    readingSessions.forEach((session) => {
      const date = new Date(session.start);
      const dateKey = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
      const duration = session.duration || 0;
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          sessions: 0,
          duration: 0,
          weekday: date.getDay()
        };
      }
      dailyData[dateKey].sessions += 1;
      dailyData[dateKey].duration += duration;
      totalDuration += duration;
      totalSessions += 1;
    });
    const sortedDates = Object.keys(dailyData).sort();
    let longestStreak = 0;
    let currentStreak = 0;
    let lastDate = null;
    sortedDates.forEach((dateKey) => {
      const currentDate = new Date(dateKey);
      if (lastDate) {
        const diffTime = currentDate.getTime() - lastDate.getTime();
        const diffDays = diffTime / (1e3 * 60 * 60 * 24);
        if (diffDays === 1) {
          currentStreak += 1;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      lastDate = currentDate;
    });
    return {
      dailyData,
      totalDays: Object.keys(dailyData).length,
      totalSessions,
      totalDuration,
      longestStreak,
      monthlyData: groupByMonth(dailyData)
    };
  }
  function groupByMonth(dailyData) {
    const monthlyData = {};
    Object.values(dailyData).forEach((day) => {
      const monthKey = day.date.substring(0, 7);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          days: 0,
          sessions: 0,
          duration: 0,
          dailyData: {}
        };
      }
      monthlyData[monthKey].days += 1;
      monthlyData[monthKey].sessions += day.sessions;
      monthlyData[monthKey].duration += day.duration;
      monthlyData[monthKey].dailyData[day.date] = day;
    });
    return monthlyData;
  }
  function getHeatmapMonthKeys(heatmapData) {
    return Object.keys((heatmapData == null ? void 0 : heatmapData.monthlyData) || {}).sort();
  }
  function getYearMonthBars(monthlyStats, year) {
    const bars = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${pad2(m)}`;
      const bucket = monthlyStats == null ? void 0 : monthlyStats[key];
      bars.push({
        month: key,
        label: `${m}月`,
        booksRead: (bucket == null ? void 0 : bucket.booksRead) || 0,
        booksCompleted: (bucket == null ? void 0 : bucket.booksCompleted) || 0
      });
    }
    return bars;
  }
  function calculateIntensityLevel(durationHours) {
    if (durationHours >= 4) return 4;
    if (durationHours >= 2) return 3;
    if (durationHours >= 1) return 2;
    if (durationHours >= 0.5) return 1;
    return 0;
  }
  function getHeatmapColor(level) {
    const colors = [
      "var(--background-secondary)",
      // 0级：无阅读（p1 主题中性色，暗色主题可读）
      "#9be9a8",
      // 1级：0.5-1小时
      "#40c463",
      // 2级：1-2小时
      "#30a14e",
      // 3级：2-4小时
      "#216e39"
      // 4级：4小时以上
    ];
    return colors[level] || colors[0];
  }
  function analyzeReadingFocus(readingSessions, bookNotes) {
    if (!readingSessions || readingSessions.length === 0) {
      return getDefaultFocusData();
    }
    const sessionAnalysis = analyzeSessionFocus(readingSessions);
    const timeAnalysis = analyzeFocusTimePatterns(readingSessions);
    const trendAnalysis = analyzeFocusTrend(readingSessions);
    const consistencyAnalysis = analyzeFocusConsistency(readingSessions);
    return {
      focusScore: calculateOverallFocusScore(sessionAnalysis, timeAnalysis, consistencyAnalysis),
      deepSessions: sessionAnalysis.deepSessions,
      avgSessionTime: formatSessionDuration(sessionAnalysis.avgDuration),
      bestTimeSlot: timeAnalysis.bestTimeSlot,
      sessionDistribution: sessionAnalysis.distribution,
      completionRate: sessionAnalysis.completionRate,
      trend: trendAnalysis.trend,
      trendDescription: trendAnalysis.description,
      trendIcon: trendAnalysis.icon,
      recommendations: generateFocusRecommendations(sessionAnalysis, timeAnalysis, consistencyAnalysis),
      consistencyScore: consistencyAnalysis.score,
      efficiencyScore: calculateEfficiencyScore(bookNotes)
    };
  }
  function analyzeSessionFocus(sessions) {
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.type === "completed").length;
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    const avgDuration = totalDuration / totalSessions;
    const distribution = [
      { type: "short", max: 600, count: 0 },
      // <10分钟
      { type: "light", max: 1800, count: 0 },
      // 10-30分钟
      { type: "medium", max: 3600, count: 0 },
      // 30-60分钟
      { type: "deep", max: 7200, count: 0 },
      // 1-2小时
      { type: "intense", max: Infinity, count: 0 }
      // >2小时
    ];
    sessions.forEach((session) => {
      const duration = session.duration;
      for (const category of distribution) {
        if (duration <= category.max) {
          category.count++;
          break;
        }
      }
    });
    distribution.forEach((cat) => {
      cat.percentage = totalSessions > 0 ? Math.round(cat.count / totalSessions * 100) : 0;
    });
    return {
      totalSessions,
      completedSessions,
      completionRate: Math.round(completedSessions / totalSessions * 100),
      totalDuration,
      avgDuration,
      deepSessions: distribution.slice(2).reduce((sum, cat) => sum + cat.count, 0),
      distribution
    };
  }
  function analyzeFocusTimePatterns(sessions) {
    const timeSlots = {
      morning: { count: 0, totalDuration: 0 },
      // 6-12
      afternoon: { count: 0, totalDuration: 0 },
      // 12-18
      evening: { count: 0, totalDuration: 0 },
      // 18-24
      night: { count: 0, totalDuration: 0 }
      // 0-6
    };
    sessions.forEach((session) => {
      const hour = new Date(session.start).getHours();
      let slot;
      if (hour >= 6 && hour < 12) slot = "morning";
      else if (hour >= 12 && hour < 18) slot = "afternoon";
      else if (hour >= 18 && hour < 24) slot = "evening";
      else slot = "night";
      timeSlots[slot].count++;
      timeSlots[slot].totalDuration += session.duration;
    });
    let bestSlot = "morning";
    let maxAvgDuration = 0;
    Object.entries(timeSlots).forEach(([slot, data]) => {
      if (data.count > 0) {
        const avgDuration = data.totalDuration / data.count;
        if (avgDuration > maxAvgDuration) {
          maxAvgDuration = avgDuration;
          bestSlot = slot;
        }
      }
    });
    const slotLabels = {
      morning: "早晨 (6-12点)",
      afternoon: "下午 (12-18点)",
      evening: "晚上 (18-24点)",
      night: "深夜 (0-6点)"
    };
    return {
      bestTimeSlot: slotLabels[bestSlot],
      timeSlots
    };
  }
  function analyzeFocusTrend(sessions) {
    if (sessions.length < 5) {
      return { trend: "数据不足", description: "需要更多会话数据进行趋势分析", icon: "minus" };
    }
    const sortedSessions = [...sessions].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const earlySessions = sortedSessions.slice(0, Math.floor(sessions.length / 2));
    const recentSessions = sortedSessions.slice(-Math.floor(sessions.length / 2));
    const earlyAvg = earlySessions.reduce((sum, s) => sum + s.duration, 0) / earlySessions.length;
    const recentAvg = recentSessions.reduce((sum, s) => sum + s.duration, 0) / recentSessions.length;
    const trendPercentage = (recentAvg - earlyAvg) / earlyAvg * 100;
    if (trendPercentage > 20) {
      return { trend: "显著提升", description: `+${Math.round(trendPercentage)}%`, icon: "trending-up" };
    } else if (trendPercentage > 5) {
      return { trend: "稳步提升", description: `+${Math.round(trendPercentage)}%`, icon: "arrow-up-right" };
    } else if (trendPercentage < -10) {
      return { trend: "需要关注", description: `-${Math.round(Math.abs(trendPercentage))}%`, icon: "trending-down" };
    } else {
      return { trend: "保持稳定", description: "0%", icon: "arrow-right" };
    }
  }
  function analyzeFocusConsistency(sessions) {
    if (sessions.length < 5) {
      return { score: 5, description: "数据不足" };
    }
    const dates = [...new Set(sessions.map((s) => new Date(s.start).toDateString()))].sort();
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1e3 * 60 * 60 * 24));
      if (diffDays === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }
    let score;
    if (maxConsecutive >= 7) score = 10;
    else if (maxConsecutive >= 5) score = 8;
    else if (maxConsecutive >= 3) score = 6;
    else if (maxConsecutive >= 2) score = 4;
    else score = 2;
    return {
      score,
      maxConsecutiveDays: maxConsecutive,
      description: `最长连续阅读${maxConsecutive}天`
    };
  }
  function calculateOverallFocusScore(sessionAnalysis, timeAnalysis, consistencyAnalysis) {
    let score = 0;
    const durationScore = Math.min(sessionAnalysis.avgDuration / 1800 * 40, 40);
    const completionScore = sessionAnalysis.completionRate * 0.3;
    const consistencyScore = consistencyAnalysis.score * 3;
    score = durationScore + completionScore + consistencyScore;
    return Math.min(Math.round(score), 100);
  }
  function calculateEfficiencyScore(bookNotes) {
    const completedBooks = bookNotes.filter((book) => book.frontmatter.completionDate);
    if (completedBooks.length === 0) return 5;
    let totalEfficiency = 0;
    completedBooks.forEach((book) => {
      const pages = parseInt(book.frontmatter.pages) || 200;
      const readingTime = parseFloat(book.frontmatter.readingTime) || 0;
      const highlights = parseInt(book.frontmatter.highlights) || 0;
      if (readingTime > 0) {
        const hours = readingTime / 36e5;
        const pagesPerHour = pages / hours;
        const notesDensity = highlights / pages;
        let bookEfficiency = 0;
        if (pagesPerHour >= 30 && pagesPerHour <= 60) bookEfficiency += 5;
        if (notesDensity >= 0.1) bookEfficiency += 3;
        if (notesDensity >= 0.05) bookEfficiency += 2;
        totalEfficiency += Math.min(bookEfficiency, 10);
      }
    });
    return Math.round(totalEfficiency / completedBooks.length);
  }
  function generateFocusRecommendations(sessionAnalysis, timeAnalysis, consistencyAnalysis) {
    const recommendations = [];
    if (sessionAnalysis.avgDuration < 900) {
      recommendations.push("尝试延长单次阅读时间至20-30分钟");
    } else if (sessionAnalysis.avgDuration > 3600) {
      recommendations.push("您的专注时长优秀，注意适当休息");
    }
    if (sessionAnalysis.completionRate < 60) {
      recommendations.push("提高会话完成率，设定明确的阅读目标");
    }
    if (consistencyAnalysis.maxConsecutiveDays < 3) {
      recommendations.push("建立每日固定阅读时段，培养连续性");
    }
    if (timeAnalysis.bestTimeSlot.includes("深夜")) {
      recommendations.push("深夜阅读可能影响睡眠质量，建议调整时段");
    }
    if (recommendations.length === 0) {
      return "您的阅读专注度表现优秀！继续保持良好的阅读习惯。";
    }
    return recommendations.slice(0, 3).join("；");
  }
  function getDefaultFocusData() {
    return {
      focusScore: 50,
      deepSessions: 0,
      avgSessionTime: "0分钟",
      bestTimeSlot: "暂无数据",
      sessionDistribution: [
        { type: "short", count: 0, percentage: 0 },
        { type: "light", count: 0, percentage: 0 },
        { type: "medium", count: 0, percentage: 0 },
        { type: "deep", count: 0, percentage: 0 },
        { type: "intense", count: 0, percentage: 0 }
      ],
      completionRate: 0,
      trend: "暂无趋势",
      trendDescription: "需要更多阅读数据",
      trendIcon: "minus",
      recommendations: "开始记录阅读会话以获得专注度分析",
      consistencyScore: 0,
      efficiencyScore: 0
    };
  }
  function analyzeReadingSpeed(stats) {
    const avgPagesPerHour = stats.readingSpeed.averagePagesPerHour || 0;
    const avgWordsPerHour = stats.readingSpeed.averageWordsPerHour || 0;
    let speedLevel, speedPercentage, efficiencyScore, readingType;
    if (avgPagesPerHour < 20) {
      speedLevel = "较慢阅读";
      speedPercentage = 30;
      efficiencyScore = 4;
      readingType = "精读型";
    } else if (avgPagesPerHour < 40) {
      speedLevel = "适中速度";
      speedPercentage = 60;
      efficiencyScore = 7;
      readingType = "平衡型";
    } else if (avgPagesPerHour < 60) {
      speedLevel = "快速阅读";
      speedPercentage = 80;
      efficiencyScore = 9;
      readingType = "速读型";
    } else {
      speedLevel = "极速阅读";
      speedPercentage = 95;
      efficiencyScore = 10;
      readingType = "扫描型";
    }
    let recommendation;
    if (avgPagesPerHour < 15) {
      recommendation = "建议通过速读训练提高基础阅读速度，目标达到20-30页/小时";
    } else if (avgPagesPerHour < 30) {
      recommendation = "您的阅读速度适中，可以尝试不同的阅读技巧来进一步提升效率";
    } else if (avgPagesPerHour < 50) {
      recommendation = "优秀的阅读速度！继续保持并注意理解深度的平衡";
    } else {
      recommendation = "极佳的阅读速度！建议关注阅读质量与知识吸收效果";
    }
    const monthlyTrend = generateMonthlySpeedTrend(stats);
    return {
      speedLevel,
      speedPercentage,
      efficiencyScore,
      readingType,
      recommendation,
      monthlyTrend,
      bestSpeed: Math.round(avgPagesPerHour * 1.2),
      avgSessionTime: formatReadingTime2(stats.totalReadingTime / Math.max(stats.readBooks, 1))
    };
  }
  function generateMonthlySpeedTrend(stats) {
    const monthlyData = Object.entries(stats.monthlyStats || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
    if (monthlyData.length === 0) {
      return '<div style="text-align: center; color: #666; padding: 20px 0;">暂无月度数据</div>';
    }
    const trendData = monthlyData.map(([month, data]) => {
      const estimatedSpeed = 25 + Math.random() * 15;
      return {
        month: month.substring(5),
        speed: Math.round(estimatedSpeed),
        books: data.booksRead || 0
      };
    });
    const maxSpeed = Math.max(...trendData.map((d) => d.speed));
    return `
  <div style="overflow-x: auto; margin: 8px 0;">
  <div style="display: flex; gap: 8px; min-width: ${trendData.length * 80}px; padding: 8px 0;">
  ${trendData.map((data) => {
      const height = data.speed / maxSpeed * 40;
      return `
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">${data.month}月</div>
    <div style="width: 100%; height: 40px; display: flex; align-items: end; justify-content: center;">
    <div style="width: 80%; height: ${height}px; background: linear-gradient(to top, #667eea, #764ba2); border-radius: 2px 2px 0 0;"></div>
    </div>
    <div style="font-size: 12px; font-weight: 600; color: #2c3e50; margin-top: 4px;">${data.speed}</div>
    <div style="font-size: 10px; color: #999;">${data.books}本</div>
    </div>
    `;
    }).join("")}
  </div>
  </div>
  `;
  }
  function extractAndCategorizeBooks(bookNotes) {
    const categorizedBooks = [];
    const autoCategorizedCount = 0;
    bookNotes.forEach((book) => {
      let categories = [];
      if (book.frontmatter.category) {
        const rawCategories = Array.isArray(book.frontmatter.category) ? book.frontmatter.category : String(book.frontmatter.category).split(/[,，\/]/);
        categories = rawCategories.map((cat) => cat.trim()).filter((cat) => cat);
      }
      categorizedBooks.push({
        title: book.file ? book.file.name : "未知书籍",
        categories,
        readingDate: book.frontmatter.readingDate,
        completionDate: book.frontmatter.completionDate
      });
    });
    return { categorizedBooks, autoCategorizedCount };
  }
  function calculateCategoryDistribution(categorizedBooks) {
    const categoryCount = {};
    categorizedBooks.forEach((book) => {
      book.categories.forEach((category) => {
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
    });
    const totalBooks = categorizedBooks.length;
    return Object.entries(categoryCount).map(([name, count]) => ({
      name,
      count,
      percentage: (count / totalBooks * 100).toFixed(1)
    })).sort((a, b) => b.count - a.count);
  }
  function calculateTop3Percentage(categoryDistribution) {
    if (categoryDistribution.length === 0) return 0;
    const top3Count = categoryDistribution.slice(0, 3).reduce((sum, cat) => sum + cat.count, 0);
    const totalCount = categoryDistribution.reduce((sum, cat) => sum + cat.count, 0);
    return totalCount > 0 ? (top3Count / totalCount * 100).toFixed(1) : 0;
  }
  function calculateCategoryDiversity(categoryDistribution, totalBooks) {
    if (categoryDistribution.length <= 1) return 0;
    let diversity = 0;
    categoryDistribution.forEach((cat) => {
      const p = cat.count / totalBooks;
      if (p > 0) {
        diversity -= p * Math.log(p);
      }
    });
    const maxDiversity = Math.log(categoryDistribution.length);
    const score = maxDiversity > 0 ? diversity / maxDiversity * 100 : 0;
    return Math.round(score);
  }
  function getDiversityLevel(categoryDistribution, totalBooks) {
    const score = calculateCategoryDiversity(categoryDistribution, totalBooks);
    if (score >= 80) return "非常广泛";
    if (score >= 60) return "较为多样";
    if (score >= 40) return "相对集中";
    if (score >= 20) return "比较专一";
    return "高度集中";
  }
  function calculateBalanceScore(categoryDistribution) {
    if (categoryDistribution.length <= 1) return 100;
    const percentages = categoryDistribution.map((cat) => parseFloat(cat.percentage) / 100);
    const sortedPercentages = percentages.sort((a, b) => a - b);
    let cumulative = 0;
    let inequality = 0;
    sortedPercentages.forEach((p, i) => {
      cumulative += p;
      inequality += (i + 1) * p;
    });
    const n = sortedPercentages.length;
    const gini = (2 * inequality - n - 1) / n;
    return Math.round((1 - gini) * 100);
  }
  function getBalanceDescription(categoryDistribution) {
    const balanceScore = calculateBalanceScore(categoryDistribution);
    if (balanceScore >= 80) return "非常均衡";
    if (balanceScore >= 60) return "较为均衡";
    if (balanceScore >= 40) return "相对集中";
    return "高度集中";
  }
  function analyzeCategoryTrends(categorizedBooks) {
    const recentBooks = categorizedBooks.filter((book) => book.completionDate && isRecentDate(book.completionDate)).sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime()).slice(0, 10);
    const recentCategories = {};
    recentBooks.forEach((book) => {
      book.categories.forEach((cat) => {
        recentCategories[cat] = (recentCategories[cat] || 0) + 1;
      });
    });
    return Object.entries(recentCategories).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }
  function isRecentDate(dateString) {
    try {
      const date = new Date(dateString);
      const sixMonthsAgo = /* @__PURE__ */ new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return date > sixMonthsAgo;
    } catch (e) {
      return false;
    }
  }
  function generateCategoryRecommendations(categoryDistribution, totalBooks) {
    const recommendations = [];
    const diversityScore = calculateCategoryDiversity(categoryDistribution, totalBooks);
    if (diversityScore < 30) {
      recommendations.push("您的阅读分类比较集中，建议尝试不同类型的书籍来扩展视野");
    } else if (diversityScore > 70) {
      recommendations.push("您的阅读分类非常广泛，继续保持这种探索精神");
    } else {
      recommendations.push("您的阅读分类相对均衡，可以在现有基础上尝试相近领域");
    }
    if (categoryDistribution.length < 3 && totalBooks >= 5) {
      recommendations.push("阅读分类较少，建议设定每月尝试一个新分类的目标");
    }
    if (categoryDistribution.length > 0) {
      const topCategory = categoryDistribution[0];
      if (parseFloat(topCategory.percentage) > 40) {
        recommendations.push(`您对"${topCategory.name}"类书籍有强烈偏好，可以尝试该分类下的不同子类型`);
      }
    }
    const uncategorized = categoryDistribution.find((cat) => cat.name === "未分类");
    if (uncategorized && uncategorized.count > 0) {
      recommendations.push(`您有${uncategorized.count}本书未分类，建议为这些书籍添加分类标签`);
    }
    return recommendations;
  }
  function getSuggestedCategories(categoryDistribution) {
    const allCategories = ["小说", "文学", "历史", "科技", "哲学", "心理学", "经济", "管理", "自我提升", "传记", "科普", "艺术", "教育", "健康", "旅行", "美食", "文化", "社会"];
    const currentCategories = new Set(categoryDistribution.map((cat) => cat.name));
    const suggested = allCategories.filter((cat) => !currentCategories.has(cat));
    return suggested.slice(0, 6);
  }
  function analyzeReadingCategories(bookNotes) {
    const categoryData = extractAndCategorizeBooks(bookNotes);
    const categoryDistribution = calculateCategoryDistribution(categoryData.categorizedBooks);
    const totalBooks = bookNotes.length;
    return {
      categoryDistribution,
      totalBooks,
      totalCategories: categoryDistribution.length,
      topCategory: categoryDistribution.length > 0 ? categoryDistribution[0] : { name: "无数据", count: 0, percentage: "0" },
      top3Percentage: calculateTop3Percentage(categoryDistribution),
      diversityScore: calculateCategoryDiversity(categoryDistribution, totalBooks),
      diversityLevel: getDiversityLevel(categoryDistribution, totalBooks),
      balanceScore: calculateBalanceScore(categoryDistribution),
      balanceDescription: getBalanceDescription(categoryDistribution),
      categoryTrends: analyzeCategoryTrends(categoryData.categorizedBooks),
      recommendations: generateCategoryRecommendations(categoryDistribution, totalBooks),
      suggestedCategories: getSuggestedCategories(categoryDistribution),
      analyzedBooks: totalBooks,
      autoCategorized: categoryData.autoCategorizedCount
    };
  }
  function extractNotesInteractions(bookNotes) {
    let totalHighlights = 0;
    let totalThinks = 0;
    let totalDialogue = 0;
    let totalOutlinks = 0;
    let booksWithInteractions = 0;
    bookNotes.forEach((book) => {
      const fm = book.frontmatter;
      const highlights = parseInt(fm.highlights) || 0;
      const thinks = parseInt(fm.thinks) || 0;
      const dialogue = parseInt(fm.dialogue) || 0;
      const outlinks = parseInt(fm.outlinks) || 0;
      totalHighlights += highlights;
      totalThinks += thinks;
      totalDialogue += dialogue;
      totalOutlinks += outlinks;
      if (highlights > 0 || thinks > 0 || dialogue > 0 || outlinks > 0) {
        booksWithInteractions++;
      }
    });
    const totalInteractions = totalHighlights + totalThinks + totalDialogue + totalOutlinks;
    const interactionDistribution = [
      {
        type: "highlights",
        count: totalHighlights,
        percentage: totalInteractions > 0 ? (totalHighlights / totalInteractions * 100).toFixed(1) : "0.0",
        avgPerBook: (totalHighlights / Math.max(booksWithInteractions, 1)).toFixed(1)
      },
      {
        type: "thinks",
        count: totalThinks,
        percentage: totalInteractions > 0 ? (totalThinks / totalInteractions * 100).toFixed(1) : "0.0",
        avgPerBook: (totalThinks / Math.max(booksWithInteractions, 1)).toFixed(1)
      },
      {
        type: "dialogue",
        count: totalDialogue,
        percentage: totalInteractions > 0 ? (totalDialogue / totalInteractions * 100).toFixed(1) : "0.0",
        avgPerBook: (totalDialogue / Math.max(booksWithInteractions, 1)).toFixed(1)
      },
      {
        type: "outlinks",
        count: totalOutlinks,
        percentage: totalInteractions > 0 ? (totalOutlinks / totalInteractions * 100).toFixed(1) : "0.0",
        avgPerBook: (totalOutlinks / Math.max(booksWithInteractions, 1)).toFixed(1)
      }
    ];
    return {
      totalHighlights,
      totalThinks,
      totalDialogue,
      totalOutlinks,
      totalInteractions,
      booksWithInteractions,
      interactionDistribution,
      avgHighlightsPerBook: (totalHighlights / Math.max(booksWithInteractions, 1)).toFixed(1)
    };
  }
  function calculateThinkRatio(highlights, thinks) {
    if (highlights === 0) return 0;
    return Math.round(thinks / highlights * 100);
  }
  function calculateInteractionScore(interactionData) {
    let score = 0;
    score += Math.min(interactionData.totalHighlights * 0.1, 30);
    const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
    score += Math.min(thinkRatio * 0.25, 25);
    score += Math.min(interactionData.totalDialogue * 0.5, 20);
    score += Math.min(interactionData.totalOutlinks * 0.5, 25);
    return Math.min(Math.round(score), 100);
  }
  function calculateEngagementLevel(interactionData, totalBooks) {
    const avgInteractionsPerBook = interactionData.totalInteractions / Math.max(totalBooks, 1);
    if (avgInteractionsPerBook >= 20) return "深度参与";
    if (avgInteractionsPerBook >= 10) return "积极参与";
    if (avgInteractionsPerBook >= 5) return "一般参与";
    if (avgInteractionsPerBook >= 1) return "轻度参与";
    return "观察者";
  }
  function analyzeInteractionPattern(interactionData) {
    const { totalHighlights, totalThinks, totalDialogue, totalOutlinks } = interactionData;
    const maxType = Math.max(totalHighlights, totalThinks, totalDialogue, totalOutlinks);
    if (maxType === totalHighlights && totalHighlights > totalThinks * 2) return "标记型读者";
    if (maxType === totalThinks && totalThinks > totalHighlights * 0.5) return "思考型读者";
    if (maxType === totalDialogue) return "交流型读者";
    if (maxType === totalOutlinks) return "连接型读者";
    if (totalThinks > totalHighlights * 0.3) return "平衡思考型";
    return "综合型读者";
  }
  function getPatternDescription(interactionData) {
    const pattern = analyzeInteractionPattern(interactionData);
    const descriptions = {
      标记型读者: "注重重点内容的标记和整理",
      思考型读者: "善于深入思考并提出个人见解",
      交流型读者: "喜欢与他人讨论和分享观点",
      连接型读者: "擅长建立知识之间的联系",
      平衡思考型: "在标记和思考之间保持良好平衡",
      综合型读者: "综合运用多种互动方式"
    };
    return descriptions[pattern] || "独特的阅读互动方式";
  }
  function analyzeThinkingDepth(interactionData) {
    const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
    if (thinkRatio >= 40) return "深度思考";
    if (thinkRatio >= 25) return "中度思考";
    if (thinkRatio >= 10) return "基础思考";
    return "初步思考";
  }
  function getThinkingDescription(interactionData) {
    const depth = analyzeThinkingDepth(interactionData);
    const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
    return `想法占比 ${thinkRatio}%，${depth}水平`;
  }
  function analyzeConnectionLevel(interactionData) {
    const linkRatio = interactionData.totalHighlights > 0 ? interactionData.totalOutlinks / interactionData.totalHighlights * 100 : 0;
    if (linkRatio >= 30) return "高度连接";
    if (linkRatio >= 15) return "中度连接";
    if (linkRatio >= 5) return "基础连接";
    return "初步连接";
  }
  function getConnectionDescription(interactionData) {
    const level = analyzeConnectionLevel(interactionData);
    const linkRatio = interactionData.totalHighlights > 0 ? Math.round(interactionData.totalOutlinks / interactionData.totalHighlights * 100) : 0;
    return `链接密度 ${linkRatio}%，${level}水平`;
  }
  function analyzeNotesInteractions(bookNotes) {
    const interactionData = extractNotesInteractions(bookNotes);
    const totalBooks = bookNotes.length;
    return {
      ...interactionData,
      totalBooks,
      thinkRatio: calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks),
      interactionScore: calculateInteractionScore(interactionData),
      engagementLevel: calculateEngagementLevel(interactionData, totalBooks),
      interactionPattern: analyzeInteractionPattern(interactionData),
      patternDescription: getPatternDescription(interactionData),
      thinkingDepth: analyzeThinkingDepth(interactionData),
      thinkingDescription: getThinkingDescription(interactionData),
      connectionLevel: analyzeConnectionLevel(interactionData),
      connectionDescription: getConnectionDescription(interactionData),
      recommendations: generateInteractionRecommendations(interactionData, totalBooks)
    };
  }
  function generateInteractionRecommendations(interactionData, totalBooks) {
    const recommendations = [];
    const thinkRatio = calculateThinkRatio(interactionData.totalHighlights, interactionData.totalThinks);
    const avgInteractions = interactionData.totalInteractions / Math.max(totalBooks, 1);
    if (avgInteractions < 5) {
      recommendations.push("建议增加阅读时的互动频率，尝试对重要内容进行标记");
    } else if (avgInteractions > 20) {
      recommendations.push("您的互动频率很高，继续保持这种深度参与的习惯");
    }
    if (thinkRatio < 15) {
      recommendations.push("可以尝试在划线时多加入个人思考和评论");
    } else if (thinkRatio > 40) {
      recommendations.push("您的思考深度很好，考虑将想法整理成更系统的笔记");
    }
    if (interactionData.totalDialogue === 0) {
      recommendations.push("尝试参与书籍讨论，分享观点可以加深理解");
    }
    if (interactionData.totalOutlinks < interactionData.totalHighlights * 0.1) {
      recommendations.push("可以多建立知识之间的连接，构建知识网络");
    }
    if (recommendations.length === 0) {
      recommendations.push("您的笔记互动模式很均衡，继续保持！");
    }
    return recommendations;
  }

  // src/core/chart-palette.ts
  var CHART_PASTEL_SERIES = ["#D6E4FF", "#D8F3DC", "#CDF0EA", "#FADDE1", "#FFE5CC", "#E6DFF5"];
  var CHART_INK = "#3D4456";
  var CHART_FALLBACK = "#95a5a6";
  var CHART_HIGHLIGHT = "#FFE5CC";
  var CHART_GRADIENT_VIOLET = "linear-gradient(135deg, #667eea, #764ba2)";
  var CHART_GRADIENT_PINK = "linear-gradient(135deg, #f093fb, #f5576c)";
  var CHART_GRADIENT_AQUA = "linear-gradient(135deg, #4facfe, #00f2fe)";
  var CHART_GRADIENT_MINT = "linear-gradient(135deg, #43e97b, #38f9d7)";
  var CHART_GRADIENT_CORAL = "linear-gradient(135deg, #ff6b6b, #ff8e8e)";
  var CHART_METRIC_VIOLET = "#667eea";
  var CHART_METRIC_AQUA = "#4facfe";
  var CHART_METRIC_MINT = "#43e97b";
  var CHART_METRIC_CORAL = "#ff6b6b";
  var CHART_METRIC_RED = "#e74c3c";
  var CHART_METRIC_BLUE = "#3498db";
  var CHART_METRIC_PURPLE = "#9b59b6";
  var CHART_METRIC_GREEN = "#27ae60";
  var CHART_METRIC_ORANGE = "#e67e22";
  var CHART_METRIC_SKY = "#64d6f3";
  var CHART_AUTHOR_RANK_COLORS = ["#ffd700", "#c0c0c0", "#cd7f32", "#3498db", "#9b59b6"];
  var CHART_RANK_FALLBACK_DEEP = "#7f8c8d";
  var CHART_SPEED_BAR_GRADIENT = "linear-gradient(90deg, #4CAF50, #45a049)";
  var CHART_FOCUS_SERIES = ["#ff6b6b", "#ff9ff3", "#feca57", "#48dbfb", "#1dd1a1"];

  // src/reading-report/report.ts
  function generateBarRows(rows) {
    return rows.map((row, index) => {
      const color = CHART_PASTEL_SERIES[index % CHART_PASTEL_SERIES.length];
      const width = Math.max(0, Math.min(100, row.value));
      const attrs = row.linkAttr ? ` ${row.linkAttr.name}="${escapeHtml2(row.linkAttr.value)}" title="在书架中查看"` : "";
      const cls = row.linkAttr ? "bz-rr-bar-row bz-rr-bar-row--link" : "bz-rr-bar-row";
      const trophies = row.rank !== void 0 && row.rank >= 1 && row.rank <= 3 ? '<i data-lucide="trophy" class="bz-ic bz-ic--xs bz-rr-trophy"></i>'.repeat(4 - row.rank) : "";
      return `
    <div class="${cls}"${attrs}>
    <div class="bz-rr-bar-label" title="${escapeHtml2(row.label)}">${escapeHtml2(row.label)}</div>
    <div class="bz-progress bz-progress--lg bz-rr-bar-track"><i style="width:${width}%;background:${color}"></i></div>
    ${trophies}
    <div class="bz-rr-bar-val">${escapeHtml2(row.display)}</div>
    </div>`;
    }).join("");
  }
  function generateMonthBarColumns(cols) {
    const max = Math.max(0, ...cols.map((c) => c.count));
    return `
  <div class="bz-rr-mwrap">
  ${cols.map((col) => {
      const height = max > 0 && col.count > 0 ? 12 + Math.round(col.count / max * 44) : 3;
      const bg = col.accent ? CHART_HIGHLIGHT : CHART_PASTEL_SERIES[0];
      const num = col.count > 0 ? `<span style="color:${CHART_INK}">${col.count}</span>` : "";
      return `
    <div class="bz-rr-mcol">
    <div class="bz-rr-mbar${col.accent ? " bz-rr-mbar--accent" : ""}" style="height:${height}px;background:${bg}">${num}</div>
    <div class="bz-rr-mlabel">${escapeHtml2(col.label)}</div>
    </div>`;
    }).join("")}
  </div>`;
  }
  function buildReportSections(stats, bookNotes) {
    return [
      { key: "stats", label: "统计概览", generate: () => generateStatsReport(stats) },
      { key: "interaction", label: "笔记互动分析", generate: () => generateReadingNotesInteractionAnalysis(bookNotes) },
      { key: "heatmap", label: "阅读热力图", generate: () => generateReadingHeatmap(stats.readingSessions) },
      { key: "habits", label: "阅读习惯分析", generate: () => generateReadingHabitsDeepAnalysis2(stats.readingSessions) },
      { key: "focus", label: "阅读专注度分析", generate: () => generateReadingFocusAnalysis(stats, bookNotes) },
      { key: "yearly", label: "年度统计", generate: () => generateYearlyStats(stats) },
      { key: "trends", label: "阅读趋势分析", generate: () => generateReadingTrendsAnalysis(stats, bookNotes) },
      { key: "authors", label: "作者统计", generate: () => generateAuthorStats(stats) },
      { key: "categories", label: "分类分析", generate: () => generateReadingCategoryAnalysis(bookNotes) },
      { key: "speed", label: "阅读速度分析", generate: () => generateReadingSpeedAnalysis(stats) }
    ];
  }
  function generateStatsReport(stats) {
    const totalFormattedTime = formatReadingTime2(stats.totalReadingTime);
    const avgReadingTime = formatReadingTime2(stats.totalReadingTime / Math.max(stats.readBooks, 1));
    return `
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">

  <div style="background: ${CHART_GRADIENT_VIOLET}; padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.totalBooks}</div>
  <div>书库</div>
  </div>
   
  <div style="background: ${CHART_GRADIENT_PINK}; padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.readBooks}</div>
  <div>已读</div>
  </div>

  <div style="background: ${CHART_GRADIENT_AQUA}; padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.readingBooks}</div>
  <div>在读</div>
  </div>

  <div style="background: ${CHART_GRADIENT_MINT}; padding: 20px; border-radius: 10px; color: white; text-align: center;">
  <div style="font-size: 2em; font-weight: bold;">${stats.unreadBooks}</div>
  <div>未读</div>
  </div>
  </div>
  
  <div style="background: var(--background-secondary); padding: 20px; border-radius: 10px; margin: 20px 0;">
  <div style="font-size: 2.5em; font-weight: bold; color: var(--text-normal); text-align: center; margin: 20px 0;">
  ${totalFormattedTime.replace("h", "小时").replace("m", "分钟")}
  </div>

  <div style="display: flex; justify-content: space-around; text-align: center; margin-top: 30px;">
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_RED};">${stats.totalHighlights}</div>
  <div>划线</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_BLUE};">${stats.totalThinks}</div>
  <div>想法</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_PURPLE};">${stats.totalDialogue}</div>
  <div>讨论</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_PURPLE};">${stats.totalOutlinks}</div>
  <div>出链</div>
  </div>
  <div>
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_GREEN};">${avgReadingTime}</div>
  <div>平均每本</div>
  </div>
  </div>
  </div>
  `;
  }
  function generateYearlyStats(stats) {
    const yearlyData = Object.entries(stats.yearlyStats).sort((a, b) => b[0].localeCompare(a[0]));
    if (yearlyData.length === 0) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted); padding: 40px 0;">暂无年度阅读数据</p>
    </div>`;
    }
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
  ${yearlyData.map(([year, data]) => {
      const monthCols = generateMonthBarColumns(
        getYearMonthBars(stats.monthlyStats, year).map((b) => ({ label: b.label, count: b.booksRead }))
      );
      return `
    <div class="bz-rr-year-cell">
    <div class="bz-rr-year-card" data-rr-year="${year}" title="点击展开 ${year} 年逐月阅读" role="button">
    <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">${year}年<i data-lucide="chevron-down" class="bz-ic bz-ic--sm bz-rr-year-chev"></i></div>
    <div style="font-size: 2em; font-weight: bold;">${data.booksRead}</div>
    <div>阅读数量</div>
    <div style="font-size: 0.8em; opacity: 0.8; margin-top: 3px;">
    ${formatReadingTime2(data.totalReadingTime)}
    </div>
    </div>
    <div class="bz-rr-year-cols" data-rr-year-body="${year}">${monthCols}</div>
    </div>
    `;
    }).join("")}
  </div>
  </div>
  `;
  }
  function generateAuthorStats(stats) {
    const topAuthors = Object.entries(stats.authorStats).sort((a, b) => b[1].count - a[1].count).slice(0, 5);
    if (topAuthors.length === 0) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无作者统计数据</p>
    </div>`;
    }
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
  ${topAuthors.map(([author, data], index) => {
      const completionRate = data.totalBooks > 0 ? (data.completedBooks / data.totalBooks * 100).toFixed(1) : 0;
      const rankColors = CHART_AUTHOR_RANK_COLORS;
      return `
    <div class="bz-rr-author-card" data-rr-author="${escapeHtml2(author)}" title="在书架中搜索该作者" role="button"
    style="background: linear-gradient(135deg, ${rankColors[index] || CHART_FALLBACK}, ${rankColors[index] ? rankColors[index] + "cc" : CHART_RANK_FALLBACK_DEEP});
    padding: 15px; border-radius: 8px; color: white; position: relative;">
    <div style="font-size: 2em; position: absolute; top: 10px; right: 15px; opacity: 0.3;">${index + 1}</div>
    <div style="font-weight: bold; font-size: 1.1em;">${escapeHtml2(author)}</div>
    <div style="display: flex; justify-content: space-between; margin-top: 8px;">
    <span>作品数: ${data.totalBooks}</span>
    <span>完成: ${completionRate}%</span>
    </div>
    <div style="margin-top: 5px; font-size: 0.9em;">
    阅读时长: ${formatReadingTime2(data.totalReadingTime)}
    </div>
    </div>
    `;
    }).join("")}
  </div>
  </div>
  `;
  }
  function generateReadingSpeedAnalysis(stats) {
    if (stats.readingSpeed.totalPages === 0 && stats.readingSpeed.totalWords === 0) {
      return "";
    }
    const speedAnalysis = analyzeReadingSpeed(stats);
    return `
  <div style="background: var(--background-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--background-modifier-border); margin: 16px 0; ">

  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">

  <div style="background: ${CHART_GRADIENT_VIOLET}; padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">总阅读量</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.totalPages / 1e3).toFixed(1)}k</div>
  <div style="font-size: 12px; opacity: 0.8;">页数</div>
  </div>


  <div style="background: ${CHART_GRADIENT_AQUA}; padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">阅读速度</div>
  <div style="font-size: 20px; font-weight: 600;">${stats.readingSpeed.averagePagesPerHour.toFixed(0)}</div>
  <div style="font-size: 12px; opacity: 0.8;">页/小时</div>
  </div>


  <div style="background: ${CHART_GRADIENT_MINT}; padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">总字数</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.totalWords / 1e4).toFixed(1)}w</div>
  <div style="font-size: 12px; opacity: 0.8;">万字</div>
  </div>


  <div style="background: ${CHART_GRADIENT_CORAL}; padding: 16px; border-radius: 8px; color: white; text-align: center;">
  <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">字速</div>
  <div style="font-size: 20px; font-weight: 600;">${(stats.readingSpeed.averageWordsPerHour / 1e3).toFixed(1)}k</div>
  <div style="font-size: 12px; opacity: 0.8;">字/小时</div>
  </div>
  </div>


  <div style="background: var(--background-secondary); padding: 16px; border-radius: 8px; margin-bottom: 16px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div style="font-size: 15px; font-weight: 500; color: var(--text-normal);">速度等级</div>
  <div style="font-size: 14px; color: var(--text-muted);">${speedAnalysis.speedLevel}</div>
  </div>


  <div style="width: 100%; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
  <div style="width: ${speedAnalysis.speedPercentage}%; height: 100%; background: ${CHART_SPEED_BAR_GRADIENT}; border-radius: 4px;"></div>
  </div>

  <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
  <span>较慢</span>
  <span>适中</span>
  <span>快速</span>
  </div>
  </div>


  <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px;">

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">效率评分</div>
  <div style="font-size: 18px; font-weight: 600; color: ${CHART_METRIC_CORAL};">${speedAnalysis.efficiencyScore}/10</div>
  </div>


  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">阅读类型</div>
  <div style="font-size: 14px; font-weight: 500; color: ${CHART_METRIC_VIOLET};">${speedAnalysis.readingType}</div>
  </div>

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">最佳速度</div>
  <div style="font-size: 18px; font-weight: 600; color: ${CHART_METRIC_SKY};">${speedAnalysis.bestSpeed}页/小时</div>
  </div>

  <div style="background: var(--background-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--background-modifier-border); text-align: center;">
  <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">平均时长</div>
  <div style="font-size: 18px; font-weight: 600; color: ${CHART_METRIC_CORAL};">${speedAnalysis.avgSessionTime}</div>
  </div>
  </div>
  </div>
  `;
  }
  var TIME_SLOT_LABELS = {
    morning: "早晨 (6-12点)",
    afternoon: "下午 (12-18点)",
    evening: "晚上 (18-24点)",
    night: "深夜 (0-6点)"
  };
  function generateReadingHabitsDeepAnalysis2(readingSessions) {
    if (!readingSessions || readingSessions.length < 5) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">需要更多会话数据进行分析</p>
    </div>`;
    }
    const analysis = analyzeReadingHabits(readingSessions);
    const slotRows = Object.entries(analysis.timeDistribution).map(([slot, percentage]) => ({
      label: TIME_SLOT_LABELS[slot] || slot,
      value: parseFloat(String(percentage)),
      display: `${percentage}%`
    }));
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
  <div class="bz-rr-bar-head"><span>会话时段分布</span><span>共 ${readingSessions.length} 次会话</span></div>
  <div style="margin: 12px 0;">
  ${generateBarRows(slotRows)}
  </div>
  </div>
  `;
  }
  function generateReadingTrendsAnalysis(stats, bookNotes) {
    const trends = analyzeReadingTrends(stats, bookNotes);
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <!-- 核心指标概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: ${CHART_METRIC_VIOLET};">${trends.currentMonth.books}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">本月阅读</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: ${CHART_METRIC_AQUA};">${trends.quarterlyAvg}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">季度平均</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: ${CHART_METRIC_MINT};">${trends.completionRate}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">完成率</div>
  </div>
  <div style="text-align: center; padding: 15px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.8em; font-weight: bold; color: ${CHART_METRIC_CORAL};">${trends.trendDirection}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">趋势方向</div>
  </div>
  </div>

  <!-- 移动端优化的月度趋势 -->
  <div style="margin: 25px 0;">
  <div style="font-weight: bold; color: var(--text-normal); margin-bottom: 15px; display: flex; align-items: center; justify-content: space-between;">

  </div>
  ${generateMobileFriendlyTrendChart(trends.recentMonths)}
  </div>
  </div>
  `;
  }
  function generateMobileFriendlyTrendChart(recentMonths) {
    if (recentMonths.length === 0) {
      return '<p style="text-align: center; color: var(--text-muted); padding: 20px 0;">暂无月度数据</p>';
    }
    return generateMonthBarColumns(
      recentMonths.map((data, index) => ({
        label: data.month.split("-")[1] + "月",
        count: data.booksRead,
        accent: index === 0
        // 首位 = 最近月份（图表高亮语义保留）
      }))
    );
  }
  var HEATMAP_MONTH_NAMES = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
  function heatmapMonthTitle(monthKey) {
    const [year, month] = monthKey.split("-");
    const name = HEATMAP_MONTH_NAMES[parseInt(month, 10) - 1] || month;
    return `${year}年${name}`;
  }
  function generateReadingHeatmap(readingSessions, cursorMonth) {
    if (!readingSessions || readingSessions.length === 0) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无阅读会话数据，无法生成热力图</p>
    </div>`;
    }
    const heatmapData = processHeatmapData(readingSessions);
    const monthKeys = getHeatmapMonthKeys(heatmapData);
    const cursor = cursorMonth && monthKeys.includes(cursorMonth) ? cursorMonth : monthKeys[monthKeys.length - 1];
    const idx = monthKeys.indexOf(cursor);
    const navBtn = (dir, disabled) => `<button class="bz-rr-hm-nav" data-rr-hm-${dir}${disabled ? " disabled" : ""} title="${dir === "prev" ? "上一月" : "下一月"}" aria-label="${dir === "prev" ? "上一月" : "下一月"}"><i data-lucide="chevron-${dir === "prev" ? "left" : "right"}" class="bz-ic bz-ic--sm"></i></button>`;
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <!-- 热力图统计概览 -->
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 20px 0;">
  <div style="text-align: center; padding: 12px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_VIOLET};">${heatmapData.totalDays}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">有阅读天数</div>
  </div>

  <div style="text-align: center; padding: 12px; background: var(--background-secondary); border-radius: 8px;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_CORAL};">${heatmapData.longestStreak}</div>
  <div style="font-size: 0.8em; color: var(--text-muted);">最长连续天数</div>
  </div>
  </div>

  <!-- 热力图主体（段头翻月：processHeatmapData 已算全部月度数据，‹ › 逐月切换） -->
  <div style="margin: 25px 0;">
  <div class="bz-rr-hm-head">
  ${navBtn("prev", idx <= 0)}
  <div class="bz-rr-hm-title" data-rr-hm-title>${heatmapMonthTitle(cursor)}</div>
  ${navBtn("next", idx >= monthKeys.length - 1)}
  </div>
  <div class="bz-rr-hm-body" data-rr-hm-body>
  ${generateHeatmapGrid(heatmapData, cursor)}
  </div>
  </div>


  </div>
  `;
  }
  function generateHeatmapGrid(heatmapData, cursorMonth) {
    const months = getHeatmapMonthKeys(heatmapData);
    if (months.length === 0) {
      return '<p style="text-align: center; color: var(--text-muted); padding: 40px 0;">暂无数据</p>';
    }
    const cursor = cursorMonth && months.includes(cursorMonth) ? cursorMonth : months[months.length - 1];
    return generateMonthHeatmap(heatmapData.monthlyData[cursor], cursor);
  }
  function generateMonthHeatmap(monthData, monthKey) {
    const [year, month] = monthKey.split("-");
    const monthName = HEATMAP_MONTH_NAMES[parseInt(month, 10) - 1] || month;
    const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1);
    const lastDay = new Date(parseInt(year), parseInt(month), 0);
    const daysInMonth = lastDay.getDate();
    let firstWeekday = firstDay.getDay();
    firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const weekRows = [];
    let currentWeek = [];
    const todayEnd = /* @__PURE__ */ new Date();
    todayEnd.setHours(23, 59, 59, 999);
    for (let i = 0; i < firstWeekday; i++) {
      currentWeek.push({ type: "empty" });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
      const dayData = monthData.dailyData[dateKey];
      const isFuture = new Date(parseInt(year), parseInt(month) - 1, day) > todayEnd;
      currentWeek.push({
        type: dayData ? "data" : isFuture ? "future" : "nodata",
        date: dateKey,
        data: dayData,
        day
      });
      if (currentWeek.length === 7 || day === daysInMonth) {
        weekRows.push([...currentWeek]);
        currentWeek = [];
      }
    }
    return `
  <div style="margin-bottom: 25px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
  <div style="font-weight: bold; color: var(--text-normal); font-size: 1.1em;">
  ${year}年${monthName}
  </div>

  </div>

  <!-- 星期标签 -->
  <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-bottom: 8px; ">
  ${["一", "二", "三", "四", "五", "六", "日"].map(
      (day) => `
    <div style="text-align: center; font-size: 0.75em; color: var(--text-faint); padding: 2px;">${day}</div>
    `
    ).join("")}
  </div>

  <!-- 热力图网格 -->
  <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-right:-20px ">
  ${weekRows.flatMap((week) => week.map((cell) => generateHeatmapCell(cell))).join("")}
  </div>
  </div>
  `;
  }
  function generateHeatmapCell(cell) {
    if (cell.type === "empty") {
      return '<div class="bz-rr-hm-cell"></div>';
    }
    if (cell.type === "future") {
      return `<div class="bz-rr-hm-cell" style="background: var(--background-secondary);"
    title="${cell.date} - 未来日期"></div>`;
    }
    if (cell.type === "nodata") {
      return `<div class="bz-rr-hm-cell" style="background: var(--background-secondary);"
    title="${cell.date} - 无阅读记录"></div>`;
    }
    const durationHours = cell.data.duration / 3600;
    const color = getHeatmapColor(calculateIntensityLevel(durationHours));
    const tooltip = `${cell.date}
阅读时长: ${(cell.data.duration / 3600).toFixed(1)}小时
会话次数: ${cell.data.sessions}次`;
    return `
  <div class="bz-rr-hm-cell bz-rr-hm-cell--data" style="background: ${color};"
  title="${tooltip}">
  </div>
  `;
  }
  function generateReadingFocusAnalysis(stats, bookNotes) {
    const focusData = analyzeReadingFocus(stats.readingSessions, bookNotes);
    return `
 <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    
    <!-- 核心指标卡片 -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 20px 0;">
      
        <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_AQUA}; color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.deepSessions}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">深度会话</div>
        </div>
        
        <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_MINT}; color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.trendDescription}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">专注趋势</div>
        </div>
        
        <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_CORAL}; color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.bestTimeSlot}</div>
            <div style="font-size: 0.8em; opacity: 0.9;">最佳时段</div>
            
            
        </div>
        
          <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_VIOLET}; color: white; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold;">${focusData.focusScore}/100</div>
            <div style="font-size: 0.8em; opacity: 0.9;">专注度评分</div>
        </div>
        
        
        <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: ${CHART_METRIC_GREEN};">${focusData.consistencyScore}/10</div>
                <div style="font-size: 0.85em; color: var(--text-normal);">连续性评分</div>
            </div>
            
            <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
                <div style="font-size: 2em; font-weight: bold; color: ${CHART_METRIC_ORANGE};">${focusData.efficiencyScore}/10</div>
                <div style="font-size: 0.85em; color: var(--text-normal);">效率评分</div>
            </div>
    </div>
    
    <!-- 专注度分布图表 -->
    <div style="margin: 25px 0;">
        
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${focusData.sessionDistribution.map((item, index) => {
      const colors = CHART_FOCUS_SERIES;
      const labels = ["碎片化 (<10分钟)", "轻度专注 (10-30分钟)", "中等专注 (30-60分钟)", "深度专注 (1-2小时)", "高度专注 (>2小时)"];
      return `
                <div style="display: flex; align-items: center; background: var(--background-secondary); padding: 10px; border-radius: 8px;">
                    <div style="width: 60px; font-size: 0.85em; color: var(--text-normal); font-weight: bold;">${labels[index]}</div>
                    <div style="flex: 1; margin: 0 15px;">
                        <div style="width: 100%; height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${item.percentage}%; height: 100%; background: ${colors[index]}; border-radius: 4px;"></div>
                        </div>
                    </div>
                    <div style="width: 50px; text-align: right; font-size: 0.9em; color: var(--text-muted);">${item.count}次 (${item.percentage}%)</div>
                </div>
                `;
    }).join("")}
        </div>
    </div>
    
    
    </div>
    
    <!-- 专注度对比 -->
    <div style="margin: 20px 0;">
   
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            
            
            
        </div>
    </div>
</div> `;
  }
  function generateReadingCategoryAnalysis(bookNotes) {
    const categoryAnalysis = analyzeReadingCategories(bookNotes);
    if (categoryAnalysis.totalBooks === 0) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无书籍分类数据</p>
    </div>`;
    }
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 20px 0;">
  <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_VIOLET}; color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.totalCategories}</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">阅读分类</div>
  </div>

  <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_MINT}; color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.5em; font-weight: bold; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml2(categoryAnalysis.topCategory.name)}</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">最常阅读</div>
  </div>

  <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_AQUA}; color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.diversityScore}%</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">多样性</div>
  </div>

  <div style="text-align: center; padding: 15px; background: ${CHART_GRADIENT_CORAL}; color: white; border-radius: 8px; min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
  <div style="font-size: 1.8em; font-weight: bold; line-height: 1.2;">${categoryAnalysis.balanceScore}%</div>
  <div style="font-size: 0.8em; opacity: 0.9; margin-top: 5px;">平衡度</div>
  </div>
  </div>

  <div style="margin: 25px 0;">
  <div class="bz-rr-bar-head">
  <span>分类分布 · 共 ${categoryAnalysis.totalBooks} 本 / ${categoryAnalysis.totalCategories} 类</span>
  <span>点分类行回书架查看</span>
  </div>
  <div style="margin: 12px 0;">
  ${generateBarRows(
      categoryAnalysis.categoryDistribution.map((category, index) => ({
        label: category.name,
        value: parseFloat(category.percentage),
        display: `${category.count}本 · ${category.percentage}%`,
        linkAttr: { name: "data-rr-cat", value: String(category.name) },
        rank: index + 1
      }))
    )}
  </div>
  </div>
  </div>
  </div>
  `;
  }
  var INTERACTION_TYPE_LABELS = {
    highlights: "划线",
    thinks: "想法",
    dialogue: "讨论",
    outlinks: "出链"
  };
  function generateReadingNotesInteractionAnalysis(bookNotes) {
    const interactionAnalysis = analyzeNotesInteractions(bookNotes);
    if (interactionAnalysis.totalBooks === 0) {
      return `<div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">
    <p style="text-align: center; color: var(--text-muted);">暂无笔记互动数据</p>
    </div>`;
    }
    return `
  <div style="background: var(--background-primary); padding: 20px; border-radius: 10px; border: 1px solid var(--background-modifier-border); margin: 20px 0;">

  <div class="bz-rr-bar-head"><span>互动分布</span><span>总互动 ${interactionAnalysis.totalInteractions}</span></div>
  <div style="margin: 12px 0;">
  ${generateBarRows(
      interactionAnalysis.interactionDistribution.map((item) => ({
        label: INTERACTION_TYPE_LABELS[item.type] || item.type,
        value: parseFloat(item.percentage),
        display: `${item.count}条 · ${item.percentage}%`
      }))
    )}
  </div>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_VIOLET};">${interactionAnalysis.avgHighlightsPerBook}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">平均每本划线</div>
  </div>

  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_AQUA};">${interactionAnalysis.thinkRatio}%</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">想法比例</div>
  </div>

  <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_MINT};">${interactionAnalysis.interactionScore}/100</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">互动评分</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_BLUE};">${interactionAnalysis.interactionPattern}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.patternDescription}</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_PURPLE};">${interactionAnalysis.thinkingDepth}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.thinkingDescription}</div>
  </div>

   <div style="padding: 15px; background: var(--background-secondary); border-radius: 8px; text-align: center;">
  <div style="font-size: 1.5em; font-weight: bold; color: ${CHART_METRIC_CORAL};">${interactionAnalysis.connectionLevel}</div>
  <div style="font-size: 0.9em; color: var(--text-muted);">${interactionAnalysis.connectionDescription}</div>
  </div>
  </div>
  </div>
  `;
  }

  // src/reading-report/index.ts
  var renderSeq = 0;
  var progressToastSeq = 0;
  var activeProgress = null;
  var lastHeatmap = null;
  var SKELETON_HTML = '<div style="text-align: center; padding: 48px 0; color: var(--text-muted);">统计中…</div>';
  var ERROR_HTML = `<div style="padding: 24px 0; text-align: center; color: var(--text-muted);">
  <div style="font-size: 1.2em; margin-bottom: 8px; color: var(--text-normal);">统计失败</div>
  <div>读取书库时出错，请查看控制台获取详情</div>
</div>`;
  function yieldToMainThread() {
    return new Promise((resolve) => {
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") {
        ric(() => resolve(), { timeout: 50 });
      } else {
        window.setTimeout(resolve, 0);
      }
    });
  }
  function cancelReadingReport() {
    renderSeq++;
    if (activeProgress) {
      activeProgress.hide();
      activeProgress = null;
    }
  }
  function buildEmptyState(opts, folderPath) {
    const actions = uiBtnRow(
      [
        uiBtn({
          label: "去书库添加",
          icon: "book-open",
          tone: "primary",
          onClick: () => {
            var _a;
            return (_a = opts.onBack) == null ? void 0 : _a.call(opts);
          }
        })
      ],
      { center: true }
    );
    const empty = uiEmpty({
      icon: "library-big",
      title: "书库还没有可统计的书",
      desc: `把书籍笔记放进「${folderPath}」文件夹并在 frontmatter 加 book 标签，收录后这里自动生成阅读报告`,
      actions
    });
    return empty;
  }
  function renderReadingReport(container, app, opts = {}) {
    cancelReadingReport();
    const seq = renderSeq;
    const alive = () => seq === renderSeq && container.isConnected;
    container.innerHTML = SKELETON_HTML;
    const progress = notify("正在统计阅读数据…", {
      type: "progress",
      duration: 0,
      dedupeKey: `bz-reading-report-progress-${++progressToastSeq}`
    });
    activeProgress = progress;
    const finishAbort = () => {
      progress.hide();
      if (activeProgress === progress) activeProgress = null;
    };
    const finishDone = (isEmpty) => {
      if (activeProgress === progress) activeProgress = null;
      if (isEmpty) {
        progress.hide();
      } else {
        progress.setType("success");
        progress.setMessage("阅读统计完成");
      }
    };
    const step = async () => {
      progress.setMessage("正在读取书库…");
      await yieldToMainThread();
      if (!alive()) return finishAbort();
      const bookNotes = getAllBookNotes(app);
      progress.setMessage("正在读取 EPUB 书目…");
      await yieldToMainThread();
      if (!alive()) return finishAbort();
      const epubEntries = await getEpubBookNotes(app);
      if (!alive()) return finishAbort();
      const allNotes = epubEntries.length > 0 ? [...bookNotes, ...epubEntries] : bookNotes;
      if (allNotes.length === 0) {
        container.innerHTML = "";
        container.appendChild(buildEmptyState(opts, resolveFolderPath()));
        mountIcons(container);
        return finishDone(true);
      }
      progress.setMessage("正在计算统计数据…");
      await yieldToMainThread();
      if (!alive()) return finishAbort();
      const stats = calculateReadingStats(allNotes);
      const hmData = processHeatmapData(stats.readingSessions);
      const hmKeys = getHeatmapMonthKeys(hmData);
      lastHeatmap = { data: hmData, keys: hmKeys, cursor: hmKeys[hmKeys.length - 1] || "" };
      const sections = buildReportSections(stats, allNotes);
      container.innerHTML = "";
      for (const section of sections) {
        if (!alive()) return finishAbort();
        await yieldToMainThread();
        if (!alive()) return finishAbort();
        container.insertAdjacentHTML("beforeend", section.generate());
        progress.setMessage(`正在生成${section.label}…`);
      }
      if (alive()) {
        mountIcons(container);
        finishDone(false);
      } else {
        finishAbort();
      }
    };
    void step().catch((error) => {
      console.error("读取阅读统计报告失败:", error);
      if (activeProgress === progress) activeProgress = null;
      if (alive()) {
        progress.setType("error");
        progress.setMessage("统计失败：读取书库时出错，请重试；若反复出现请重新打开面板");
        container.innerHTML = ERROR_HTML;
      } else {
        progress.hide();
      }
    });
  }
  function handleReportInteraction(container, target) {
    const prevBtn = target.closest("[data-rr-hm-prev]");
    const nextBtn = target.closest("[data-rr-hm-next]");
    if (prevBtn || nextBtn) {
      navHeatmap(container, nextBtn ? 1 : -1);
      return true;
    }
    const yearCard = target.closest("[data-rr-year]");
    if (yearCard) {
      const year = yearCard.getAttribute("data-rr-year") || "";
      const body = container.querySelector(`[data-rr-year-body="${year}"]`);
      if (body) {
        body.classList.toggle("open");
        yearCard.classList.toggle("open");
      }
      return true;
    }
    return false;
  }
  function navHeatmap(container, dir) {
    if (!lastHeatmap || lastHeatmap.keys.length === 0) return;
    const idx = lastHeatmap.keys.indexOf(lastHeatmap.cursor);
    const nextIdx = Math.min(lastHeatmap.keys.length - 1, Math.max(0, idx + dir));
    if (nextIdx === idx) return;
    lastHeatmap.cursor = lastHeatmap.keys[nextIdx];
    const body = container.querySelector("[data-rr-hm-body]");
    if (body) {
      body.innerHTML = generateHeatmapGrid(lastHeatmap.data, lastHeatmap.cursor);
      mountIcons(body);
    }
    const title = container.querySelector("[data-rr-hm-title]");
    if (title) title.textContent = heatmapMonthTitle(lastHeatmap.cursor);
  }

  // src/bookshelf/notes-ui.ts
  var mdNotesClose = null;
  var bookNotesLoadSeq = 0;
  function closeMdNotesModal() {
    if (mdNotesClose) {
      const close = mdNotesClose;
      mdNotesClose = null;
      close();
    }
  }
  var epubNotesClose = null;
  function closeEpubNotesModal() {
    if (epubNotesClose) {
      const close = epubNotesClose;
      epubNotesClose = null;
      close();
    }
  }
  function closeBookNoteModals() {
    closeMdNotesModal();
    closeEpubNotesModal();
    bookNotesLoadSeq = 0;
  }

  // src/bookshelf/ui.ts
  var HOOKS = { mountIcons };
  function coverUrl(it, app) {
    if (!it.cover) return null;
    const f = app.vault.getAbstractFileByPath(it.cover);
    if (f && f instanceof TFile && /\.(png|jpe?g|gif|webp)$/i.test(f.name)) {
      return app.vault.getResourcePath(f);
    }
    return null;
  }
  function bindCoverFallback(container) {
    if (container.dataset.bsCoverFallbackBound === "1") return;
    container.dataset.bsCoverFallbackBound = "1";
    container.addEventListener("error", (e) => {
      const img = e.target;
      if (!img || img.tagName !== "IMG") return;
      const ph = document.createElement("div");
      ph.className = "bz-bs-d-cover-ph";
      ph.innerHTML = `<i data-lucide="library" class="bz-ic"></i><span>无封面</span>`;
      mountIcons(ph);
      img.replaceWith(ph);
    }, true);
  }
  function renderAll(_app2) {
    const overlay = M.currentOverlay;
    if (!overlay) return;
    const labels = overlay.querySelector("#bz-bs-labels");
    if (labels) labels.innerHTML = labelsHtml(M.items, M.side, M.catFilter);
    const seg = overlay.querySelector("#bz-bs-sortseg");
    if (seg) seg.innerHTML = sortSegHtml(M.sortMode);
    const shelf = overlay.querySelector("#bz-bs-shelf");
    if (!shelf) return;
    renderWallInto(shelf, {
      hint: overlay.querySelector("#bz-bs-hint"),
      all: M.items,
      list: getDisplayItems2(),
      q: M.searchKeyword,
      emptyFolder: resolveFolderPath(),
      emptyTag: resolveBookTag(),
      hooks: HOOKS
    });
  }
  function syncSearchInputs() {
    var _a;
    const input = (_a = M.currentOverlay) == null ? void 0 : _a.querySelector("#bz-bs-dsearch");
    if (input) input.value = M.searchKeyword;
  }
  function startReportRender(app) {
    var _a;
    const container = (_a = M.currentOverlay) == null ? void 0 : _a.querySelector(".bz-rr-content");
    if (!container) return;
    renderReadingReport(container, app, {
      onFilter: (kind, value) => applyReportFilter(app, kind, value),
      onBack: () => showView(app, "shelf")
    });
  }
  function applyReportFilter(app, kind, value) {
    if (!value) return;
    if (kind === "author") {
      M.searchKeyword = value;
      M.catFilter = "all";
    } else {
      M.catFilter = value;
      M.searchKeyword = "";
    }
    syncSearchInputs();
    showView(app, "shelf");
    renderAll();
  }
  function showView(app, view) {
    const changed = M.view !== view;
    M.view = view;
    paintViewContainers();
    if (view === "report") {
      startReportRender(app);
    } else if (changed) {
      cancelReadingReport();
    }
  }
  function openReportView(app) {
    if (!M.currentOverlay) {
      M.view = "report";
      applyDefaultView();
      createOverlay(app);
    } else {
      showView(app, "report");
    }
  }
  function refreshReportView(app) {
    if (M.view === "report" && M.currentOverlay) startReportRender(app);
  }
  function paintViewContainers() {
    var _a, _b;
    const overlay = M.currentOverlay;
    if (!overlay) return;
    (_a = overlay.querySelector(".bz-bs-view-shelf")) == null ? void 0 : _a.classList.toggle("active", M.view === "shelf");
    (_b = overlay.querySelector(".bz-bs-view-report")) == null ? void 0 : _b.classList.toggle("active", M.view === "report");
  }
  var detailModalClose = null;
  function closeDomainModals() {
    closeBookNoteModals();
    if (detailModalClose) {
      detailModalClose();
      detailModalClose = null;
    }
  }
  function openBookDetail(it, app) {
    var _a;
    const body = document.createElement("div");
    body.className = "bz-bs-detail";
    body.innerHTML = detailBodyHtml(it, coverUrl(it, app));
    const { popup, close } = uiModal({
      content: body,
      maxWidth: 640,
      head: false,
      className: `bz-bs-d-popup ${bsSkinClass()}`,
      onClose: () => {
        detailModalClose = null;
      }
    });
    detailModalClose = close;
    (_a = popup.querySelector("[data-bs-d-close]")) == null ? void 0 : _a.addEventListener("click", () => close());
    bindCoverFallback(popup);
  }
  var SKIN_IDS = ["nordic", "noir", "kraft", "velvet", "mono"];
  function normalizeSkin(v) {
    return SKIN_IDS.includes(v) ? v : "nordic";
  }
  function bsModeClass() {
    return document.body.classList.contains("theme-dark") ? "bz-bs-mode-dark" : "bz-bs-mode-light";
  }
  function bsSkinClass() {
    return `bz-bs-skin-${normalizeSkin(tryGetSettings().bookshelfSkin)} ${bsModeClass()}`;
  }
  var wallResizeHandler = null;
  var wallResizeTimer = null;
  function createOverlay(app) {
    const overlay = document.createElement("div");
    overlay.className = "bz-panel-overlay";
    overlay.style.zIndex = String(allocZ());
    overlay.innerHTML = panelHtml(bsSkinClass());
    document.body.appendChild(overlay);
    M.currentOverlay = overlay;
    M.renderFn = () => renderAll();
    overlay.addEventListener("click", (e) => {
      const t = e.target;
      if (e.target === overlay) {
        closeOverlay();
        return;
      }
      if (t.closest("[data-bs-plaque]")) {
        if (isMobileEnv()) closeOverlay();
        return;
      }
      const side = t.closest("[data-bs-side]");
      if (side) {
        const id = side.dataset.bsSide || "all";
        if (id === "all") {
          M.side = "all";
          M.catFilter = "all";
        } else {
          M.side = M.side === id ? "all" : id;
        }
        renderAll();
        return;
      }
      const cat = t.closest("[data-bs-cat]");
      if (cat) {
        const name = cat.dataset.bsCat || "all";
        M.catFilter = name !== "all" && M.catFilter === name ? "all" : name;
        renderAll();
        return;
      }
      const sortBtn = t.closest("[data-bs-sort]");
      if (sortBtn) {
        M.sortMode = sortBtn.dataset.bsSort || "recent";
        renderAll();
        return;
      }
      if (M.view === "report") {
        const rrContent = overlay.querySelector(".bz-rr-content");
        if (rrContent && handleReportInteraction(rrContent, t)) return;
        if (t.closest("[data-rr-goto-shelf]")) {
          showView(app, "shelf");
          return;
        }
        const rrAuthor = t.closest("[data-rr-author]");
        if (rrAuthor) {
          applyReportFilter(app, "author", rrAuthor.getAttribute("data-rr-author") || "");
          return;
        }
        const rrCat = t.closest("[data-rr-cat]");
        if (rrCat) {
          applyReportFilter(app, "category", rrCat.getAttribute("data-rr-cat") || "");
          return;
        }
      }
      const spine = t.closest("[data-bs-id]");
      if (spine && M.view === "shelf") {
        const epub = spine.dataset.bsEpub === "1";
        const it = M.items.find((x) => {
          var _a;
          return epub ? x.epubVaultPath === spine.dataset.bsId : ((_a = x.file) == null ? void 0 : _a.path) === spine.dataset.bsId;
        });
        if (it) openBookDetail(it, app);
        return;
      }
    });
    const searchInput = overlay.querySelector("#bz-bs-dsearch");
    searchInput.addEventListener("input", () => {
      if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
      M.searchDebounceTimer = setTimeout(() => {
        M.searchKeyword = searchInput.value.trim();
        renderAll();
      }, 200);
    });
    if (M.searchKeyword) searchInput.value = M.searchKeyword;
    wallResizeHandler = () => {
      if (wallResizeTimer) clearTimeout(wallResizeTimer);
      wallResizeTimer = setTimeout(() => {
        wallResizeTimer = null;
        if (M.currentOverlay && M.view === "shelf") renderAll();
      }, 150);
    };
    window.addEventListener("resize", wallResizeHandler);
    mountIcons(overlay);
    paintViewContainers();
    const shelf0 = overlay.querySelector("#bz-bs-shelf");
    if (shelf0) shelf0.innerHTML = wallLoadingHTML();
    void rebuildItems(app).then(() => {
      if (M.view === "report") showView(app, "report");
      else renderAll();
    });
  }
  function closeOverlay() {
    if (M.searchDebounceTimer) clearTimeout(M.searchDebounceTimer);
    if (wallResizeTimer) {
      clearTimeout(wallResizeTimer);
      wallResizeTimer = null;
    }
    if (wallResizeHandler) {
      window.removeEventListener("resize", wallResizeHandler);
      wallResizeHandler = null;
    }
    closeDomainModals();
    cancelReadingReport();
    if (M.currentOverlay) {
      M.currentOverlay.remove();
      M.currentOverlay = null;
    }
    M.renderFn = null;
  }
  var mainEscRegistered = false;
  var mainEscHandle = null;
  function registerEscapeHandler() {
    if (mainEscRegistered) return;
    mainEscRegistered = true;
    mainEscHandle = escManager.register("bz-bookshelf", {
      isVisible: () => !!M.currentOverlay,
      close: () => closeOverlay()
    });
  }

  // src/bookshelf/index.ts
  var initialized = false;
  var autoRefreshRegistered = false;
  var autoRefreshOffs = [];
  var weaveVaultRef = null;
  function ensureBookshelf(app) {
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
      if (file && file.path && !file.path.endsWith(WEAVE_DATA_FILE) && !file.path.startsWith(resolveFolderPath() + "/")) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!M.currentOverlay) return;
        void rebuildItems(app).then(() => {
          if (M.view === "report") refreshReportView(app);
          else renderAll(app);
        });
      }, 300);
    };
    for (const ch of ["vault:md-created", "vault:md-deleted", "vault:md-modified"]) {
      autoRefreshOffs.push(onDomainEvent(ch, (evt) => schedule({ path: evt.path })));
    }
    weaveVaultRef = app.vault.on("modify", (file) => {
      schedule({ path: file == null ? void 0 : file.path });
    });
  }
  function openBookshelf(app) {
    ensureBookshelf(app);
    if (M.currentOverlay) {
      closeOverlay();
      return;
    }
    applyDefaultView();
    createOverlay(app);
  }

  // src/bookshelf/fake-sim.ts
  function seedItems() {
    const src = window.BS || window.parent && window.parent.BS || null;
    return (src == null ? void 0 : src.ITEMS) || [];
  }
  function dateToTs(date) {
    if (!date || date.length < 10) return 0;
    const y = Number(date.slice(0, 4));
    const m = Number(date.slice(5, 7));
    const d = Number(date.slice(8, 10));
    if (!y || !m || !d) return 0;
    return new Date(y, m - 1, d, 12).getTime();
  }
  function mdContent(it) {
    const lines = [
      "---",
      "tags:",
      "  - book",
      `author: ${it.author}`,
      `category: ${it.category || "未分类"}`
    ];
    if (it.cover) lines.push(`cover: ${it.cover}`);
    if (it.bookReview) lines.push(`bookReview: ${it.bookReview}`);
    if (it.readingDate) lines.push(`readingDate: ${it.readingDate}`);
    if (it.completionDate) lines.push(`completionDate: ${it.completionDate}`);
    lines.push(`readingProgress: ${it.progress}`);
    if (it.readingTimeMs > 0) lines.push(`readingTime: ${it.readingTimeMs}`);
    if (it.readingTimeFormat) lines.push(`readingTimeFormat: ${it.readingTimeFormat}`);
    lines.push(
      `highlights: ${it.highlights}`,
      `thinks: ${it.thinks}`,
      `wordCount: ${it.wordCount}`,
      `pages: ${it.pages}`,
      "---",
      "",
      `${it.title}`,
      ""
    );
    return lines.join("\n");
  }
  function coverDataUri(it) {
    const c = catColor(it.category || "未分类");
    const t = String(it.title || "");
    const mid = Math.ceil(t.length / 2);
    const lines = t.length <= 7 ? [t] : [t.slice(0, mid), t.slice(mid)];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="210"><rect width="150" height="210" fill="${c.bg}"/><rect x="9" y="9" width="132" height="192" fill="none" stroke="${c.fg}" stroke-opacity=".4"/>` + lines.map((ln, i) => `<text x="75" y="${104 + (i - (lines.length - 1) / 2) * 26}" text-anchor="middle" font-family="Songti SC,SimSun,serif" font-size="17" fill="${c.fg}">${esc(ln)}</text>`).join("") + `<text x="75" y="186" text-anchor="middle" font-family="Songti SC,SimSun,serif" font-size="10" fill="${c.fg}" fill-opacity=".75">${esc(it.author || "")}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function epubAggregate(it) {
    return {
      meta: {
        title: it.title,
        author: it.author,
        subjects: it.category ? [it.category] : [],
        coverPath: it.cover || ""
      },
      file: { vaultPath: it.epubVaultPath || it.id },
      reading: {
        position: { percent: (it.progress || 0) / 100 },
        stats: {
          lastReadTime: dateToTs(it.readingDate),
          completedTime: dateToTs(it.completionDate),
          totalReadTime: it.readingTimeMs || 0
        },
        sessions: []
      },
      notes: { highlights: [], excerpts: [] }
    };
  }
  function seedDatabase(app) {
    const vault = app.vault;
    const books = {};
    for (const it of seedItems()) {
      if (it.isEpub) {
        books[it.epubVaultPath || it.id] = epubAggregate(it);
        continue;
      }
      vault.putFile(it.id, mdContent(it), it.ctime);
      if (it.cover) vault.putFile(it.cover, coverDataUri(it));
    }
    if (Object.keys(books).length) {
      vault.putFile("CONFIG/STORAGE/weave-data.json", JSON.stringify({ books }));
    }
  }
  function injectSettings() {
    const skin = new URLSearchParams(location.search).get("skin") || "nordic";
    setSettingsProvider(
      () => ({
        bookshelfFolderPath: "书库",
        bookTag: "book",
        bookshelfSkin: skin,
        bookshelfDefaultSide: "all",
        bookshelfSortMode: "recent"
      })
    );
  }
  function bootBookshelfSim() {
    const g = window;
    if (g.__bzBsSimBooted) return;
    g.__bzBsSimBooted = true;
    const app = new FakeApp();
    seedDatabase(app);
    setApp(app);
    injectSettings();
    ensureBookshelf(getApp());
  }
  function openBookshelf2() {
    openBookshelf(getApp());
  }
  function openReport() {
    openReportView(getApp());
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
