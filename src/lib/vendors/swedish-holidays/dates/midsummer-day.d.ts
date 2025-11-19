import MidsummerEve from './midsummer-eve';
import { IHolidayOptions } from '../holidays.interface';
export default class MidsummerDay extends MidsummerEve {
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static mightBe(date: Date): boolean;
}
