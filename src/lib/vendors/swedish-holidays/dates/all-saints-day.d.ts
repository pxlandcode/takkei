import AllSaintsEve from './all-saints-eve';
import { IHolidayOptions } from '../holidays.interface';
export default class AllSaintsDay extends AllSaintsEve {
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static mightBe(date: Date): boolean;
}
