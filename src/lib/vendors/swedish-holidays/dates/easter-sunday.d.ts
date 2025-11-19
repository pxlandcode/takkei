import { Holiday, IHolidayOptions } from '../holidays.interface';
export default class EasterSunday implements Holiday {
    name: string;
    year: number;
    month: number;
    day: number;
    date: Date;
    isPublicHoliday: boolean;
    constructor({ year, language }?: IHolidayOptions);
    static mightBe(date: Date): boolean;
}
export declare class EasterSundayDependant extends EasterSunday {
    constructor(offsetDays: number, year?: number);
    static mightBe(date: Date): boolean;
    static easterOffset: number;
}
