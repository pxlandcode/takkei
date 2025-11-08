export type RoleOption = {
	name: string;
	value: string;
};

export const ROLE_OPTIONS: RoleOption[] = [
	{ name: 'Admin', value: 'Administrator' },
	{ name: 'Lokaladmin', value: 'LocationAdmin' },
	{ name: 'Ekonomi', value: 'Economy' },
	{ name: 'Tränare', value: 'Trainer' },
	{ name: 'Utbildare', value: 'Educator' }
];

export const ROLE_LABEL_LOOKUP: Record<string, string> = ROLE_OPTIONS.reduce(
	(acc, option) => {
		acc[option.value] = option.name;
		return acc;
	},
	{} as Record<string, string>
);

export function roleLabel(name?: string | null) {
	if (!name) return '';
	return ROLE_LABEL_LOOKUP[name] ?? name;
}
