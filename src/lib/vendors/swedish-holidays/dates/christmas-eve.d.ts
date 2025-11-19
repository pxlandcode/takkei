import Fixed from './fixed';
import { IHolidayOptions } from '../holidays.interface';
export default class ChristmasEve extends Fixed {
    static day: number;
    static month: number;
    constructor({ year, language }?: IHolidayOptions);
}
