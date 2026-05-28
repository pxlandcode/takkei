import { type RequestHandler } from '@sveltejs/kit';
import { buildClientsPackagesStatusWorkbook } from '$lib/server/exports/clientsPackagesStatus';

async function exportWorkbook(sessionsLimit: unknown) {
	const { buffer, filename } = await buildClientsPackagesStatusWorkbook({ sessionsLimit });

	return new Response(buffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		return await exportWorkbook(url.searchParams.get('sessions_limit'));
	} catch (error) {
		console.error('Failed to export clients packages status', error);
		return new Response('Failed to export clients packages status', { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const formData = await request.formData();
		return await exportWorkbook(formData.get('sessions_limit'));
	} catch (error) {
		console.error('Failed to export clients packages status', error);
		return new Response('Failed to export clients packages status', { status: 500 });
	}
};
