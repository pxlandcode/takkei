"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const date_utils_1 = require("../date-utils");
class Fixed {
    constructor(day, month, name, isPublicHoliday, year) {
        this.year = year || new Date().getFullYear();
        this.month = month;
        this.day = day;
        this.date = (0, date_utils_1.fixedDate)(new Date(this.year, this.month - 1, this.day));
        this.name = name;
        this.isPublicHoliday = isPublicHoliday;
    }
    static mightBe(date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return this.month === month && this.day === day;
    }
}
exports.default = Fixed;
//# sourceMappingURL=fixed.js.map