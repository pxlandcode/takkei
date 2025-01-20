/**
 * Returns a color based on the location ID.
 * This will later be updated to fetch colors from the database.
 */
export function getLocationColor(locationId: number): string {
	const locationColors: Record<number, string> = {
		67: '#3C82F6', // Example color for location 1
		68: '#c04c3d', // Example color for location 2
		69: '#29793D', // Example color for location 3 (green)
		70: '#AA8554', // Example color for location 4 (bronze)
		71: '#C0645F' // Example color for location 5 (red)
	};

	return locationColors[locationId] || '#6b7280'; // Gray as default
}
