import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import { fallbackCancellationReasonOptions } from '$lib/helpers/bookingHelpers/cancellation';

export async function GET(event?: { url?: URL }) {
	const includeInactive = event?.url?.searchParams.get('includeInactive') === 'true';
	try {
		const rows = await query<{ value: string; label: string }>(
			`SELECT value, label
			 FROM cancellation_reasons
			 ${includeInactive ? '' : 'WHERE active = TRUE'}
			 ORDER BY LOWER(label) ASC, id ASC`
		);

		return json(rows.map((row) => ({ value: row.value, label: row.label })));
	} catch (error) {
		console.error('Failed to fetch cancellation reasons, using fallback options', error);
		return json(fallbackCancellationReasonOptions);
	}
}
