"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const fixed_1 = __importDefault(require("./fixed"));
class NewYearsDay extends fixed_1.default {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super(NewYearsDay.day, NewYearsDay.month, language.newYearsDay, true, year);
    }
}
exports.default = NewYearsDay;
NewYearsDay.day = 1;
NewYearsDay.month = 1;
//# sourceMappingURL=new-years-day.js.map