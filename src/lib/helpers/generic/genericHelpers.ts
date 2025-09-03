export function capitalizeFirstLetter(string: string) {
	return String(string).charAt(0).toUpperCase() + String(string).slice(1);
}

export function svMonth(monthInput: number | string | null | undefined): string {
	if (monthInput == null) return '';

	let numericMonth: number;
	if (typeof monthInput === 'string') {
		const noLeadingZeros = monthInput.replace(/^0+/, '') || '0';
		numericMonth = Number(noLeadingZeros);
	} else {
		numericMonth = monthInput;
	}

	if (!Number.isFinite(numericMonth)) return '';

	let zeroBasedMonth: number;
	if (numericMonth >= 1 && numericMonth <= 12) {
		zeroBasedMonth = numericMonth - 1;
	} else if (numericMonth >= 0 && numericMonth <= 11) {
		zeroBasedMonth = numericMonth;
	} else {
		return '';
	}

	return new Date(2000, zeroBasedMonth, 1).toLocaleDateString('sv-SE', { month: 'long' });
}
