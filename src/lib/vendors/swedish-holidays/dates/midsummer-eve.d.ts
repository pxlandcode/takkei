import { Holiday, IHolidayOptions } from '../holidays.interface';
export default class MidsummerEve implements Holiday {
    name: string;
    year: number;
    month: number;
    day: number;
    date: Date;
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static mightBe(date: Date): boolean;
}
