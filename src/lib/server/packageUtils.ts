export type InstallmentInput = { date: string; sum: number; invoice_no?: string };

export function serializeInstallments(items: InstallmentInput[]) {
	if (!items?.length) return '--- {}\n';
	let s = '---\n';
	for (const i of items) {
		const normalizedDate = normalizeDate(i.date) ?? (i.date ?? '').toString();
		const invoiceNo = i.invoice_no != null ? String(i.invoice_no) : '';
		const sumValue = Number.isFinite(Number(i.sum)) ? Number(i.sum) : 0;
		const sumStr = sumValue.toString();

		s += `'${normalizedDate}':\n`;
		s += `  :date: '${normalizedDate}'\n`;
		s += `  :sum: ${sumStr}\n`;
		s += `  :invoice_no: '${invoiceNo}'\n`;
	}
	return s;
}

export function normalizeDate(value: string | Date | null | undefined) {
	if (!value) return null;
	const parsed = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(parsed.getTime())) return null;
	return parsed.toISOString().slice(0, 10);
}
