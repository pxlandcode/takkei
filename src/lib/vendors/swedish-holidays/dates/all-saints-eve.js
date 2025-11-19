"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const date_utils_1 = require("../date-utils");
class AllSaintsEve {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        this.isPublicHoliday = false;
        const y = year || new Date().getFullYear();
        this.year = y;
        this.date = (0, date_utils_1.fixedDate)((0, date_utils_1.firstOfWeekdayAfterDate)(date_utils_1.Weekday.Friday, new Date(y, 9, 30)));
        this.month = this.date.getMonth() + 1;
        this.day = this.date.getDate();
        this.name = language.allSaintsEve;
    }
    static mightBe(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        // Earliest 30:th October
        if (month === 10) {
            return day >= 30;
        }
        // Latest 5:th November
        if (month === 11) {
            return day <= 5;
        }
        return false;
    }
}
exports.default = AllSaintsEve;
//# sourceMappingURL=all-saints-eve.js.map