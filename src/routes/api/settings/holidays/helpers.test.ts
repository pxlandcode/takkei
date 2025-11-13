import { describe, expect, it } from 'vitest';
import { validateHolidayPayload } from './helpers';

describe('validateHolidayPayload', () => {
        it('accepts a valid payload and trims values', () => {
                const { errors, values } = validateHolidayPayload({
                        name: '  Nyårsdagen  ',
                        date: '2025-01-01',
                        description: ' Ledigt '
                });

                expect(errors).toEqual({});
                expect(values).toEqual({
                        name: 'Nyårsdagen',
                        date: '2025-01-01',
                        description: 'Ledigt'
                });
        });

        it('requires a name', () => {
                const { errors } = validateHolidayPayload({
                        name: '   ',
                        date: '2025-06-06'
                });

                expect(errors.name).toBe('Namn krävs');
        });

        it('requires a date', () => {
                const { errors } = validateHolidayPayload({
                        name: 'Nationaldagen'
                });

                expect(errors.date).toBe('Datum krävs');
        });

        it('rejects invalid dates', () => {
                const { errors } = validateHolidayPayload({
                        name: 'Valborg',
                        date: '2025-13-40'
                });

                expect(errors.date).toBe('Ogiltigt datum');
        });
});
