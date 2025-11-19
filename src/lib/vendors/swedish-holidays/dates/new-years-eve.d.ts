import Fixed from './fixed';
import { IHolidayOptions } from '../holidays.interface';
export default class NewYearsEve extends Fixed {
    static day: number;
    static month: number;
    constructor({ year, language }?: IHolidayOptions);
}
