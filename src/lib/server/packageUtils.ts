export type InstallmentInput = { date: string; sum: number; invoice_no?: string };

export function serializeInstallments(items: InstallmentInput[]) {
	if (!items?.length) return '--- {}\n';
	let s = '---\n';
	for (const i of items) {
		s += `'${i.date}':\n`;
		s += `  :date: ${i.date}\n`;
		s += `  :sum: ${Number(i.sum).toString()}\n`;
		s += `  :invoice_no: '${i.invoice_no ?? ''}'\n`;
	}
	return s;
}

export function normalizeDate(value: string | null | undefined) {
	if (!value) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString().slice(0, 10);
}
