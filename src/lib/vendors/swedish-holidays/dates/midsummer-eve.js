"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const date_utils_1 = require("../date-utils");
class MidsummerEve {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        this.isPublicHoliday = false;
        const y = year || new Date().getFullYear();
        this.year = y;
        this.date = (0, date_utils_1.fixedDate)((0, date_utils_1.firstOfWeekdayAfterDate)(date_utils_1.Weekday.Friday, new Date(y, 5, 19)));
        this.month = this.date.getMonth() + 1;
        this.day = this.date.getDate();
        this.name = language.midsummerEve;
    }
    static mightBe(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        // Earliest 19:th June
        // Latest 25:th June
        if (month === 6) {
            return day >= 19 && day <= 25;
        }
        return false;
    }
}
exports.default = MidsummerEve;
//# sourceMappingURL=midsummer-eve.js.map