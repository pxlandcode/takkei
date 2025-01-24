/**
 * Returns a color based on the location ID.
 * This will later be updated to fetch colors from the database.
 */
export function getLocationColor(locationId: number): string {
	const locationColors: Record<number, string> = {
		67: '#3C82F6',
		68: '#c04c3d',
		69: '#29793D',
		70: '#AA8554',
		71: '#8B5CF6'
	};

	return locationColors[locationId] || '#6b7280'; // Gray as default
}
