import { query } from '$lib/db';

// Fetch targets for a user within a date range
export async function getUserTargets(userId: number, date: string) {
	const targetQuery = `
        SELECT targets.*, target_kinds.name AS target_kind_name, target_kinds.rules
        FROM targets
        LEFT JOIN target_kinds ON targets.target_kind_id = target_kinds.id
        WHERE $1 = ANY(targets.user_ids) 
        AND $2::date BETWEEN targets.start_date AND targets.end_date
    `;

	const params = [userId, date];
	const targets = await query(targetQuery, params);

	// Process targets and compute `achieved`
	const processedTargets = await Promise.all(targets.map(processTarget));

	return processedTargets;
}

// Process each target: apply rules & fetch additional data if needed
async function processTarget(target: any) {
	const rules = target.rules ? JSON.parse(target.rules) : {};

	let achieved = 0;

	if (rules.filter_by === 'internal_education' && rules.value === true) {
		achieved = await getInternalEducationCount(target);
	} else if (rules.filter_by === 'booking_count') {
		achieved = await getBookingCount(target);
	} else if (rules.filter_by === 'location' && target.location_ids?.length > 0) {
		achieved = await getBookingCountByLocation(target);
	}

	return { ...target, achieved, rules }; // Include rules in the response
}

// Fetch count of bookings with `internal_education = true`
async function getInternalEducationCount(target: any) {
	const bookingQuery = `
        SELECT COUNT(*) FROM bookings 
        WHERE user_id = ANY($1) 
        AND internal_education = true 
        AND start_time BETWEEN $2 AND $3
    `;
	const params = [target.user_ids, target.start_date, target.end_date];
	const result = await query(bookingQuery, params);
	return Number(result[0].count);
}

// Fetch count of all bookings within the target period
async function getBookingCount(target: any) {
	const bookingQuery = `
        SELECT COUNT(*) FROM bookings 
        WHERE trainer_id = ANY($1) 
        AND start_time BETWEEN $2 AND $3 
        AND bookings.status != 'Cancelled'
    `;
	const params = [target.user_ids, target.start_date, target.end_date];
	const result = await query(bookingQuery, params);

	return Number(result[0].count);
}

// Fetch count of bookings for a specific location
async function getBookingCountByLocation(target: any) {
	const bookingQuery = `
        SELECT COUNT(*) FROM bookings 
        WHERE location_id = ANY($1) 
        AND start_time BETWEEN $2 AND $3
    `;
	const params = [target.location_ids, target.start_date, target.end_date];
	const result = await query(bookingQuery, params);
	return Number(result[0].count);
}
