export function getShortAddress(address: string): string {
	const firstLetter = address.trim().charAt(0).toUpperCase();
	const numbers = address.match(/\d+/);

	return numbers ? `${firstLetter}${numbers[0]}` : firstLetter;
}
