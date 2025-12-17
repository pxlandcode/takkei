import type { Emoji } from './emoji-data';

export type EmojiCategory = {
	id: string;
	label: string;
	icon: string;
};

export const emojiCategories: EmojiCategory[] = [
	{ id: 'Smileys & Emotion', label: 'Smileys', icon: '😀' },
	{ id: 'People & Body', label: 'People', icon: '🧑' },
	{ id: 'Animals & Nature', label: 'Animals', icon: '🐶' },
	{ id: 'Food & Drink', label: 'Food', icon: '🍔' },
	{ id: 'Travel & Places', label: 'Travel', icon: '✈️' },
	{ id: 'Activities', label: 'Activities', icon: '⚽️' },
	{ id: 'Objects', label: 'Objects', icon: '💡' },
	{ id: 'Symbols', label: 'Symbols', icon: '💟' },
	{ id: 'Flags', label: 'Flags', icon: '🏳️' }
];

export function categoriesFromData(data: Emoji[]): EmojiCategory[] {
	const unique = Array.from(new Set(data.map((item) => item.category)));
	const mapped = unique.map((cat) => {
		const preset = emojiCategories.find((c) => c.id === cat);
		return (
			preset ?? {
				id: cat,
				label: cat,
				icon: '❖'
			}
		);
	});
	return mapped;
}
