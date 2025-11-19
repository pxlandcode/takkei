"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSameDate = exports.fixedDate = exports.firstOfWeekdayAfterDate = exports.Weekday = exports.plusYears = exports.plusDays = void 0;
function plusDays(d, days) {
    const date = new Date(d);
    date.setDate(date.getDate() + (days || 0));
    return date;
}
exports.plusDays = plusDays;
function plusYears(d, years = 0) {
    const date = new Date(d);
    date.setFullYear(date.getFullYear() + years);
    return date;
}
exports.plusYears = plusYears;
var Weekday;
(function (Weekday) {
    Weekday[Weekday["Friday"] = 5] = "Friday";
    Weekday[Weekday["Sunday"] = 0] = "Sunday";
})(Weekday = exports.Weekday || (exports.Weekday = {}));
function firstOfWeekdayAfterDate(weekday, refDate) {
    return plusDays(refDate, (refDate.getDay() > weekday ? 7 : 0) - refDate.getDay() + weekday);
}
exports.firstOfWeekdayAfterDate = firstOfWeekdayAfterDate;
function fixedDate(date) {
    const d = new Date(date);
    d.setMilliseconds(0);
    d.setSeconds(0);
    d.setMinutes(0);
    d.setHours(0);
    d.setMinutes(-d.getTimezoneOffset());
    return d;
}
exports.fixedDate = fixedDate;
function isSameDate(dateA, dateB) {
    return fixedDate(dateA).getTime() === fixedDate(dateB).getTime();
}
exports.isSameDate = isSameDate;
//# sourceMappingURL=date-utils.js.map