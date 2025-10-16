import { type RequestHandler } from '@sveltejs/kit';
import { buildClientReportWorkbook } from '$lib/services/api/reports/clientSummary';

function parseActiveParam(value: string | null): 'all' | 'active' | 'inactive' {
	if (!value) return 'all';
	const lower = value.toLowerCase();
	if (['active', '1', 'true', 'yes'].includes(lower)) return 'active';
	if (['inactive', '0', 'false', 'no'].includes(lower)) return 'inactive';
	return 'all';
}

export const GET: RequestHandler = async ({ url }) => {
	const active = parseActiveParam(url.searchParams.get('active'));

	try {
		const { buffer, filename } = await buildClientReportWorkbook({ active });

		return new Response(buffer, {
			headers: {
				'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (error) {
		console.error('Failed to export client report', error);
		return new Response('Failed to export client report', { status: 500 });
	}
};
