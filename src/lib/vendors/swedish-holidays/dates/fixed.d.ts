import { Holiday } from '../holidays.interface';
export default class Fixed implements Holiday {
    name: string;
    year: number;
    month: number;
    day: number;
    date: Date;
    isPublicHoliday: boolean;
    static day: number;
    static month: number;
    constructor(day: number, month: number, name: string, isPublicHoliday: boolean, year?: number);
    static mightBe(date: Date): boolean;
}
