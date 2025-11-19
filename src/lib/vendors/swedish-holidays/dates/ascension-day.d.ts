import { EasterSundayDependant } from './easter-sunday';
import { IHolidayOptions } from '../holidays.interface';
export default class AscensionDay extends EasterSundayDependant implements EasterSundayDependant {
    constructor({ year, language }?: IHolidayOptions);
    static easterOffset: number;
}
