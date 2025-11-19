"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const fixed_1 = __importDefault(require("./fixed"));
class NationalDay extends fixed_1.default {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super(NationalDay.day, NationalDay.month, language.swedishNationalDay, true, year);
    }
}
exports.default = NationalDay;
NationalDay.day = 6;
NationalDay.month = 6;
//# sourceMappingURL=national-day.js.map