// Import as JSON to ensure bundlers don't treat it as an asset URL
import rawData from './emoji-data.json' assert { type: 'json' };

export type Emoji = {
	char: string;
	name: string;
	slug: string;
	keywords: string[];
	category: string;
	subgroup?: string;
};

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function buildKeywords(name: string, subgroup?: string): string[] {
	const base = `${name} ${subgroup ?? ''}`.toLowerCase();
	const parts = base
		.split(/[\s,_-]+/)
		.map((p) => p.trim())
		.filter(Boolean);
	return Array.from(new Set(parts));
}

type RawEmoji = {
	codes: string;
	char: string;
	name: string;
	category?: string;
	group?: string;
	subgroup?: string;
};

function normalizeRaw(): RawEmoji[] {
	if (Array.isArray(rawData)) return rawData as RawEmoji[];
	if (Array.isArray((rawData as any)?.default)) return (rawData as any).default as RawEmoji[];
	console.warn('[emoji-data] unexpected emoji JSON shape', typeof rawData);
	return [];
}

const mapped = normalizeRaw().map((item) => {
	const category = item.group ?? item.category ?? 'Other';
	return {
		char: item.char,
		name: item.name,
		slug: slugify(item.name),
		keywords: buildKeywords(item.name, item.subgroup),
		category,
		subgroup: item.subgroup
	};
});

const fallback: Emoji[] = [
	{ char: '😀', name: 'grinning face', slug: 'grinning_face', keywords: ['smile', 'happy'], category: 'Smileys & Emotion' },
	{ char: '😂', name: 'face with tears of joy', slug: 'face_with_tears_of_joy', keywords: ['laugh', 'joy'], category: 'Smileys & Emotion' },
	{ char: '🥳', name: 'partying face', slug: 'partying_face', keywords: ['party', 'celebrate'], category: 'Smileys & Emotion' },
	{ char: '😎', name: 'smiling face with sunglasses', slug: 'smiling_face_with_sunglasses', keywords: ['cool'], category: 'Smileys & Emotion' },
	{ char: '🐶', name: 'dog face', slug: 'dog_face', keywords: ['dog', 'pet'], category: 'Animals & Nature' },
	{ char: '🍔', name: 'hamburger', slug: 'hamburger', keywords: ['burger', 'food'], category: 'Food & Drink' },
	{ char: '⚽️', name: 'soccer ball', slug: 'soccer_ball', keywords: ['football', 'sports'], category: 'Activities' },
	{ char: '✈️', name: 'airplane', slug: 'airplane', keywords: ['travel', 'flight'], category: 'Travel & Places' },
	{ char: '💡', name: 'light bulb', slug: 'light_bulb', keywords: ['idea', 'light'], category: 'Objects' },
	{ char: '🎉', name: 'party popper', slug: 'party_popper', keywords: ['celebration'], category: 'Activities' }
];

export const emojis: Emoji[] = mapped.filter((e) => e?.char && e?.name) ?? [];
if (emojis.length === 0) {
	console.warn('[emoji-data] dataset empty, using fallback set');
	emojis.push(...fallback);
} else {
	console.log('[emoji-data] loaded emojis', emojis.length, 'sample', emojis.slice(0, 3));
}
