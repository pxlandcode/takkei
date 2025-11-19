"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const fixed_1 = __importDefault(require("./fixed"));
class ChristmasEve extends fixed_1.default {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        super(ChristmasEve.day, ChristmasEve.month, language.christmasEve, false, year);
    }
}
exports.default = ChristmasEve;
ChristmasEve.day = 24;
ChristmasEve.month = 12;
//# sourceMappingURL=christmas-eve.js.map