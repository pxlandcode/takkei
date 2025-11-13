import { json, type RequestHandler } from '@sveltejs/kit';

import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
import { resolveRoleAwareUser } from '$lib/server/roleAwareUser';
import { getSalaryReport, parseSalaryReportMonth } from '$lib/services/api/reports/salaryReport';

function parseParams(url: URL) {
        const monthParam = url.searchParams.get('month');
        const yearParam = url.searchParams.get('year');
        return parseSalaryReportMonth({ month: monthParam, year: yearParam });
}

export const GET: RequestHandler = async ({ url, locals }) => {
        const roleAwareUser = await resolveRoleAwareUser(locals.user ?? null);
        if (!roleAwareUser) {
                return json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!hasRole(['Administrator', 'Economy'], roleAwareUser as any)) {
                return json({ error: 'Forbidden' }, { status: 403 });
        }

        let params;
        try {
                params = parseParams(url);
        } catch (error) {
                console.warn('Invalid salary report parameters', error);
                return json({ error: 'Invalid or missing month parameter' }, { status: 400 });
        }

        try {
                const report = await getSalaryReport(params);
                return json(report);
        } catch (error) {
                if (error instanceof Error && error.message === 'Selected month is in the future') {
                        return json({ error: error.message }, { status: 400 });
                }
                console.error('Failed to generate salary report', error);
                return json({ error: 'Failed to generate salary report' }, { status: 500 });
        }
};
