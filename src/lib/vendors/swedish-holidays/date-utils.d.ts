export declare function plusDays(d: Date, days: number): Date;
export declare function plusYears(d: Date, years?: number): Date;
export declare enum Weekday {
    Friday = 5,
    Sunday = 0
}
export declare function firstOfWeekdayAfterDate(weekday: Weekday, refDate: Date): Date;
export declare function fixedDate(date: Date): Date;
export declare function isSameDate(dateA: Date, dateB: Date): boolean;
