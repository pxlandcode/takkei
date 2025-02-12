// import { fetchBookings } from '$lib/services/api/calendarService';
// import { calendarStore } from '$lib/stores/calendarStore';

// export async function load({ url, fetch }) {
// 	// const from = url.searchParams.get('from');
// 	// const to = url.searchParams.get('to');
// 	// const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10); // Default to today
// 	// const roomId = url.searchParams.get('roomId') ? Number(url.searchParams.get('roomId')) : null;
// 	// const locationIds = url.searchParams.getAll('locationId').map(Number);
// 	// const trainerId = url.searchParams.get('trainerId')
// 	// 	? Number(url.searchParams.get('trainerId'))
// 	// 	: null;
// 	// const clientId = url.searchParams.get('clientId')
// 	// 	? Number(url.searchParams.get('clientId'))
// 	// 	: null;
// 	// const filters = { from, to, date, roomId, locationIds, trainerId, clientId };
// 	// // ✅ Fetch new bookings
// 	// const bookings = await fetchBookings(filters, fetch);
// 	// // ✅ Update the store with new filters & bookings
// 	// calendarStore.set({ filters, bookings });
// 	// // ✅ Return data to the page
// 	// return { bookings, filters };
// }
