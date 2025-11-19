import { Holiday, IHolidayOptions } from '../holidays.interface';
export default class AllSaintsEve implements Holiday {
    name: string;
    year: number;
    month: number;
    day: number;
    date: Date;
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static mightBe(date: Date): boolean;
}
