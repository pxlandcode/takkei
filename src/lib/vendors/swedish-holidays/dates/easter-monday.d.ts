import { EasterSundayDependant } from './easter-sunday';
import { IHolidayOptions } from '../holidays.interface';
export default class EasterMonday extends EasterSundayDependant implements EasterSundayDependant {
    constructor({ year, language }?: IHolidayOptions);
    static easterOffset: number;
}
