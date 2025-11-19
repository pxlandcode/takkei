"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const easter_sunday_1 = require("./easter-sunday");
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
class AscensionDay extends easter_sunday_1.EasterSundayDependant {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super(AscensionDay.easterOffset, year);
        this.name = language.ascensionDay;
    }
}
exports.default = AscensionDay;
AscensionDay.easterOffset = 6 * 7 - 3;
//# sourceMappingURL=ascension-day.js.map