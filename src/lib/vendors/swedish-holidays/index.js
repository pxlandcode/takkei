"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.language = exports.isPublicHoliday = exports.isHoliday = exports.getUpcomingHolidays = exports.getHolidays = void 0;
const dates_1 = require("./dates");
const date_utils_1 = require("./date-utils");
const holiday_names_sv_se_1 = __importDefault(require("./holiday-names.sv-se"));
const Holidays = [
    dates_1.AllSaintsDay,
    dates_1.AllSaintsEve,
    dates_1.AscensionDay,
    dates_1.BoxingDay,
    dates_1.ChristmasDay,
    dates_1.ChristmasEve,
    dates_1.EasterMonday,
    dates_1.EasterSunday,
    dates_1.Epiphany,
    dates_1.GoodFriday,
    dates_1.HolySaturday,
    dates_1.MaundyThursday,
    dates_1.MayFirst,
    dates_1.MidsummerDay,
    dates_1.MidsummerEve,
    dates_1.NationalDay,
    dates_1.NewYearsDay,
    dates_1.NewYearsEve,
    dates_1.PentecostEve,
    dates_1.TwelfthNight,
    dates_1.WalpurgisNight,
    dates_1.WhitSunday
];
const getHolidays = (year, language) => {
    return Holidays.map((Holiday) => new Holiday({ year, language })).sort((d1, d2) => d1.date.getTime() - d2.date.getTime());
};
exports.getHolidays = getHolidays;
const getUpcomingHolidays = (language = holiday_names_sv_se_1.default) => {
    const now = new Date();
    const nextYear = (0, date_utils_1.plusYears)(now, 1);
    return [...(0, exports.getHolidays)(now.getFullYear(), language), ...(0, exports.getHolidays)(nextYear.getFullYear(), language)].filter((holiday) => holiday.date.getTime() >= now.getTime() && holiday.date.getTime() < nextYear.getTime());
};
exports.getUpcomingHolidays = getUpcomingHolidays;
const isHoliday = (date = new Date(), options = { language: holiday_names_sv_se_1.default }) => {
    const possible = Holidays.filter((Holiday) => Holiday.mightBe(date));
    options.year = date.getFullYear();
    return possible.map((p) => new p(options)).find((holiday) => (0, date_utils_1.isSameDate)(date, holiday.date));
};
exports.isHoliday = isHoliday;
const isPublicHoliday = (date = new Date(), options) => {
    var _a;
    if (date.getDay() === date_utils_1.Weekday.Sunday) {
        return true;
    }
    return ((_a = (0, exports.isHoliday)(date, options)) === null || _a === void 0 ? void 0 : _a.isPublicHoliday) || false;
};
exports.isPublicHoliday = isPublicHoliday;
exports.language = holiday_names_sv_se_1.default;
__exportStar(require("./dates"), exports);
//# sourceMappingURL=index.js.map