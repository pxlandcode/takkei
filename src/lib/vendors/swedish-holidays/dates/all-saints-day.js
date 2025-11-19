"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const date_utils_1 = require("../date-utils");
const all_saints_eve_1 = __importDefault(require("./all-saints-eve"));
class AllSaintsDay extends all_saints_eve_1.default {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super({ year });
        this.isPublicHoliday = true;
        this.name = language.allSaintsDay;
        this.date = (0, date_utils_1.plusDays)(this.date, 1);
        this.month = this.date.getMonth() + 1;
        this.day = this.date.getDate();
    }
    static mightBe(date) {
        return super.mightBe((0, date_utils_1.plusDays)(date, -1));
    }
}
exports.default = AllSaintsDay;
//# sourceMappingURL=all-saints-day.js.map