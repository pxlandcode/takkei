"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const fixed_1 = __importDefault(require("./fixed"));
class BoxingDay extends fixed_1.default {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super(BoxingDay.day, BoxingDay.month, language.boxingDay, true, year);
    }
}
exports.default = BoxingDay;
BoxingDay.day = 26;
BoxingDay.month = 12;
//# sourceMappingURL=boxing-day.js.map