import { Holiday, IHolidayOptions, IHolidayNames } from './holidays.interface';
export declare const getHolidays: (year?: number, language?: IHolidayNames) => Holiday[];
export declare const getUpcomingHolidays: (language?: IHolidayNames) => Holiday[];
export declare const isHoliday: (date?: Date, options?: IHolidayOptions) => Holiday | undefined;
export declare const isPublicHoliday: (date?: Date, options?: IHolidayOptions) => boolean;
export declare const language: IHolidayNames;
export * from './dates';
export { IHolidayOptions, IHolidayNames } from './holidays.interface';
