import type { Package, NewPackagePayload } from '$lib/types/packageTypes';
import { invalidateByPrefix, wrapFetch } from '$lib/services/api/apiCache';

type Installment = { date: string; sum: number; invoice_no: string };

function normalizeIsoDate(value: unknown): string | null {
	if (!value) return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'string') {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) return value;
		return parsed.toISOString().slice(0, 10);
	}
	return null;
}

function buildInstallmentsPayload(payload: NewPackagePayload) {
	const normalizedFirstDate = normalizeIsoDate(payload.firstPaymentDate) ?? '';
	const rawInstallments = Array.isArray(payload.installmentBreakdown) ? payload.installmentBreakdown : [];

	const normalizedInstallments: Installment[] = rawInstallments.map((i) => {
		const normalizedDate = normalizeIsoDate(i?.date) ?? normalizedFirstDate;
		return {
			date: normalizedDate || '',
			sum: Number(i?.sum) || 0,
			invoice_no: i?.invoice_no != null ? String(i.invoice_no) : ''
		};
	});

	const perDate: Record<string, Installment> = {};
	for (const inst of normalizedInstallments) {
		const key = inst.date || normalizedFirstDate;
		if (!key) continue;
		perDate[key] = { ...inst, date: inst.date || key };
	}

	return {
		firstPaymentDate: normalizedFirstDate || payload.firstPaymentDate || '',
		installmentBreakdown: normalizedInstallments,
		payment_installments_per_date: perDate
	};
}

function withSerializedInstallments(payload: NewPackagePayload): NewPackagePayload {
	const { firstPaymentDate, installmentBreakdown, payment_installments_per_date } =
		buildInstallmentsPayload(payload);

	return {
		...payload,
		firstPaymentDate,
		installments: Number(payload.installments ?? installmentBreakdown.length ?? 0),
		installmentBreakdown,
		payment_installments_per_date
	};
}

export async function getPackages(): Promise<Package[]> {
	const res = await wrapFetch(fetch)('/api/packages');
	if (!res.ok) throw new Error('Failed to fetch packages');
	return res.json();
}

export async function getPackageById(id: number): Promise<Package> {
	const res = await wrapFetch(fetch)(`/api/packages/${id}`);
	if (!res.ok) throw new Error('Failed to fetch package');
	return res.json();
}

export async function createPackage(payload: NewPackagePayload): Promise<{ id: number }> {
        const res = await fetch('/api/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(withSerializedInstallments(payload))
        });
	if (!res.ok) throw new Error('Failed to create package');
	invalidateByPrefix('/api/packages');
	return res.json();
}

export async function updatePackage(id: number, payload: NewPackagePayload): Promise<{ id: number }> {
	const res = await fetch(`/api/packages/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(withSerializedInstallments(payload))
	});
	if (!res.ok) throw new Error('Failed to update package');
	invalidateByPrefix('/api/packages');
	return res.json();
}

export async function getArticles() {
	const res = await wrapFetch(fetch)('/api/articles');
	if (!res.ok) throw new Error('Failed to fetch articles');
	return res.json();
}

export async function getClientsForCustomer(customerId: number) {
	const res = await wrapFetch(fetch)(`/api/clients?customerId=${customerId}`);
	if (!res.ok) throw new Error('Failed to fetch clients');
	return res.json();
}
