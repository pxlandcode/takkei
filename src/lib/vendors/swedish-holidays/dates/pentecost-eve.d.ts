import { EasterSundayDependant } from './easter-sunday';
import { IHolidayOptions } from '../holidays.interface';
export default class PentecostEve extends EasterSundayDependant implements EasterSundayDependant {
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static easterOffset: number;
}
