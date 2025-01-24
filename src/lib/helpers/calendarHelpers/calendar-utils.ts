import type { FullBooking } from '$lib/types/calendarTypes';

export function getTopOffset(time: string, startHour: number, hourHeight: number): number {
	const date = new Date(time);
	const hours = date.getHours() - startHour;
	const minutes = date.getMinutes();
	return hours * hourHeight + (minutes / 60) * hourHeight;
}

export function getMeetingHeight(startTime: string, endTime: string, hourHeight: number): number {
	const start = new Date(startTime);
	const end = new Date(endTime);
	const diff = (end.getTime() - start.getTime()) / 60000; // minutes
	return (diff / 60) * hourHeight;
}

export function getCurrentTimeOffset(startHour: number, hourHeight: number): number {
	const now = new Date();
	const hours = now.getHours() - startHour;
	const minutes = now.getMinutes();
	return hours * hourHeight + ((minutes / 60) * hourHeight) / 2;
}

export function formatTime(isoString: string): string {
	const date = new Date(isoString);
	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getStartOfWeek(date: Date) {
	const start = new Date(date);
	const day = start.getDay();
	const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday (0) is the first day of the week
	start.setDate(diff);
	return start;
}

export function groupOverlappingBookings(bookings: FullBooking[]): FullBooking[][] {
	const groupedBookings: FullBooking[][] = [];

	bookings.forEach((booking) => {
		let placed = false;

		for (const group of groupedBookings) {
			// Check if this booking can be added to an existing group without overlapping
			if (!group.some((b) => overlaps(b.booking, booking.booking))) {
				group.push(booking);
				placed = true;
				break;
			}
		}

		// If no group could contain this booking, create a new group
		if (!placed) {
			groupedBookings.push([booking]);
		}
	});

	return groupedBookings;
}

export function overlaps(
	a: { startTime: string; endTime?: string | null },
	b: { startTime: string; endTime?: string | null }
): boolean {
	const startA = new Date(a.startTime);
	const endA = new Date(a.endTime ?? new Date(startA.getTime() + 60 * 60 * 1000)); // Default to +1 hour
	const startB = new Date(b.startTime);
	const endB = new Date(b.endTime ?? new Date(startB.getTime() + 60 * 60 * 1000));

	// Allow bookings that start exactly when another ends (no overlap)
	return startA < endB && startB < endA;
}

export function shiftUTCIndex(date: Date): number {
	const sundayBased = date.getUTCDay();
	// shift so Monday=0, Sunday=6:

	return (sundayBased + 6) % 7;
}
