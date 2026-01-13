export const ARTICLE_KIND_LABELS: Record<string, string> = {
	Membership: 'Medlemskap',
	Sessions: 'Träningspaket'
};

export function kindLabel(kind?: string | null) {
	if (!kind) return '—';
	return ARTICLE_KIND_LABELS[kind] ?? kind;
}

export function formatPrice(value: string | number | null | undefined) {
	if (value === null || value === undefined) return '—';
	const raw = typeof value === 'number' ? value.toString() : String(value);
	const trimmed = raw.trim();
	if (!trimmed) return '—';
	return trimmed.replace('.', ',');
}

export function formatPriceWithCurrency(value: string | number | null | undefined) {
	const formatted = formatPrice(value);
	return formatted === '—' ? formatted : `${formatted} kr`;
}

export function formatValidityRange(start?: string | null, end?: string | null) {
	if (!start && !end) return '—';
	if (start && end) return `${start} - ${end}`;
	return start ?? end ?? '—';
}

export function canDeleteArticle(article: {
	kind?: string | null;
	packages_count?: number | null;
	memberships_count?: number | null;
}) {
	if (article.kind === 'Sessions') {
		return Number(article.packages_count ?? 0) === 0;
	}
	if (article.kind === 'Membership') {
		return Number(article.memberships_count ?? 0) === 0;
	}
	return false;
}

export function deleteBlockedMessage(article: { kind?: string | null }) {
	if (article.kind === 'Sessions') {
		return 'Artikeln kan inte tas bort då det finns sålda paket av denna typ.';
	}
	if (article.kind === 'Membership') {
		return 'Kunden kan inte tas bort då det finns paket eller medlemskap som köpts på kunden. Dessa måste i så fall tas bort först.';
	}
	return 'Artikeln kan inte tas bort.';
}
