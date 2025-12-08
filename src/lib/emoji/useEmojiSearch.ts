import { derived, writable, type Readable, type Writable } from 'svelte/store';
import type { Emoji } from './emoji-data';

export type EmojiSearchResult = {
	query: Writable<string>;
	debouncedQuery: Readable<string>;
	activeCategory: Writable<string | null>;
	filtered: Readable<Emoji[]>;
	setQuery: (value: string) => void;
	setCategory: (value: string | null) => void;
	clear: () => void;
};

export function useEmojiSearch(source: Emoji[], debounceMs = 80): EmojiSearchResult {
	const query = writable('');
	const activeCategory = writable<string | null>(null);

	const indexed = source.map((emoji, index) => {
		const haystack = [
			emoji.name,
			emoji.slug,
			emoji.category,
			emoji.subgroup,
			...(emoji.keywords ?? [])
		]
			.join(' ')
			.toLowerCase();

		return { emoji, index, haystack };
	});

	const debouncedQuery = derived(query, ($q, set) => {
		const timer = setTimeout(() => set($q), debounceMs);
		return () => clearTimeout(timer);
	}, '');

	const filtered = derived([debouncedQuery, activeCategory], ([$q, $cat]) => {
		const q = ($q ?? '').trim().toLowerCase();
		let list = indexed;
		if ($cat) {
			list = list.filter((item) => item.emoji.category === $cat);
		}
		if (q) {
			list = list.filter((item) => item.haystack.includes(q));
		}
		return list.map((item) => item.emoji);
	});

	const setQuery = (value: string) => query.set(value);
	const setCategory = (value: string | null) => activeCategory.set(value);
	const clear = () => {
		query.set('');
		activeCategory.set(null);
	};

	return {
		query,
		debouncedQuery,
		activeCategory,
		filtered,
		setQuery,
		setCategory,
		clear
	};
}
