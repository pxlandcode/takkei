"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EasterSundayDependant = void 0;
const holiday_names_sv_se_1 = __importDefault(require("../holiday-names.sv-se"));
const date_utils_1 = require("../date-utils");
class EasterSunday {
    constructor({ year, language = holiday_names_sv_se_1.default } = { language: holiday_names_sv_se_1.default }) {
        this.isPublicHoliday = true;
        const y = year || new Date().getFullYear();
        if (y < 1582 || y > 8702) {
            throw new Error('Requested year is out of range');
        }
        const goldenNumber = Math.floor((y % 19) + 1);
        const century = Math.floor(y / 100 + 1);
        const corx = Math.floor((3 * century) / 4 - 12);
        const corz = Math.floor((8 * century + 5) / 25 - 5);
        const sunday = Math.floor((5 * y) / 4 - corx - 10);
        let epact = Math.floor((11 * goldenNumber + 20 + corz - corx + 30) % 30);
        if ((epact === 25 && goldenNumber > 11) || epact === 24) {
            epact += 1;
        }
        let moon = 44 - epact;
        if (moon < 21) {
            moon += 30;
        }
        moon = moon + 7 - ((sunday + moon) % 7);
        let month = 3;
        let day = moon;
        if (moon > 31) {
            month = 4;
            day = moon - 31;
        }
        this.year = y;
        this.month = month;
        this.day = day;
        this.date = (0, date_utils_1.fixedDate)(new Date(y, month - 1, day, 0, 0, 0, 0));
        this.name = language.easterSunday;
    }
    static mightBe(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        // Earliest 22:nd March
        if (month === 3) {
            return day >= 22;
        }
        // Latest 25:th April
        if (month === 4) {
            return day <= 25;
        }
        return false;
    }
}
exports.default = EasterSunday;
class EasterSundayDependant extends EasterSunday {
    constructor(offsetDays, year) {
        super({ year });
        this.date = (0, date_utils_1.plusDays)(this.date, offsetDays);
        this.month = this.date.getMonth() + 1;
        this.day = this.date.getDate();
    }
    static mightBe(date) {
        return super.mightBe((0, date_utils_1.plusDays)(date, -this.easterOffset));
    }
}
exports.EasterSundayDependant = EasterSundayDependant;
EasterSundayDependant.easterOffset = 0;
//# sourceMappingURL=easter-sunday.js.map