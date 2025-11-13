import type { RequestHandler } from '@sveltejs/kit';

import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
import { buildSalaryWorkbook, parseSalaryReportMonth } from '$lib/services/api/reports/salaryReport';
import { resolveRoleAwareUser } from '$lib/server/roleAwareUser';

function parseParams(url: URL) {
        const monthParam = url.searchParams.get('month');
        const yearParam = url.searchParams.get('year');
        return parseSalaryReportMonth({ month: monthParam, year: yearParam });
}

export const GET: RequestHandler = async ({ url, locals }) => {
        const roleAwareUser = await resolveRoleAwareUser(locals.user ?? null);
        if (!roleAwareUser) {
                return new Response('Unauthorized', { status: 401 });
        }

        if (!hasRole(['Administrator', 'Economy'], roleAwareUser as any)) {
                return new Response('Forbidden', { status: 403 });
        }

        let params;
        try {
                params = parseParams(url);
        } catch (error) {
                console.warn('Invalid salary export parameters', error);
                return new Response('Invalid or missing month parameter', { status: 400 });
        }

        try {
                const { buffer, filename } = await buildSalaryWorkbook(params);
                return new Response(buffer, {
                        headers: {
                                'Content-Type':
                                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                'Content-Disposition': `attachment; filename="${filename}"`
                        }
                });
        } catch (error) {
                if (error instanceof Error && error.message === 'Selected month is in the future') {
                        return new Response(error.message, { status: 400 });
                }
                console.error('Failed to export salary report', error);
                return new Response('Failed to export salary report', { status: 500 });
        }
};
