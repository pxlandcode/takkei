<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { emojis } from '$lib/emoji/emoji-data';
	import { categoriesFromData, emojiCategories } from '$lib/emoji/emojiCategories';
	import { useEmojiSearch } from '$lib/emoji/useEmojiSearch';

	type EmojiEvents = { select: string; close: void };

	const props = $props<{
		onSelect?: (emoji: string) => void;
		closeOnSelect?: boolean;
	}>();

	const dispatch = createEventDispatcher<EmojiEvents>();

	const { query, activeCategory, filtered, setQuery, setCategory, clear } = useEmojiSearch(emojis);
	let filteredList = $state<typeof emojis>([]);
	let queryValue = $state('');
	let activeCategoryValue = $state<string | null>(null);
	let visibleEmojis = $state<typeof emojis>([]);

	const unsubFiltered = filtered.subscribe((value) => {
		filteredList = value ?? [];
		visibleEmojis = filteredList;
	});
	const unsubQuery = query.subscribe((value) => {
		queryValue = value ?? '';
	});
	const unsubCategory = activeCategory.subscribe((value) => {
		activeCategoryValue = value ?? null;
	});
	let searchInput: HTMLInputElement | null = null;
	let gridEl: HTMLDivElement | null = null;

	const resolvedOnSelect = $derived(() => props.onSelect ?? (() => {}));
	const resolvedCloseOnSelect = $derived(() => Boolean(props.closeOnSelect));
	const FIXED_HEIGHT = '340px';

	let hoverIndex = 0;
	let isOpen = true;
	const navColumns = 8; // used for keyboard navigation only
	const derivedCategories = categoriesFromData(emojis);
	const categories = derivedCategories.length ? derivedCategories : emojiCategories;

	$effect(() => {
		if (hoverIndex >= filteredList.length) {
			hoverIndex = Math.max(filteredList.length - 1, 0);
		}
	});

	onDestroy(() => {
		unsubFiltered();
		unsubQuery();
		unsubCategory();
	});

	function selectEmoji(char: string) {
		resolvedOnSelect?.(char);
		dispatch('select', char);
		if (resolvedCloseOnSelect()) {
			isOpen = false;
			dispatch('close', undefined);
		}
	}

	function handleCategory(id: string | null) {
		setCategory(id);
		hoverIndex = 0;
		if (gridEl) {
			gridEl.scrollTop = 0;
		}
	}

	function moveHover(delta: number) {
		const total = filteredList.length;
		if (total === 0) return;
		const next = Math.min(Math.max(hoverIndex + delta, 0), total - 1);
		hoverIndex = next;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) return;
		if (event.key === 'ArrowRight') {
			moveHover(1);
			event.preventDefault();
		} else if (event.key === 'ArrowLeft') {
			moveHover(-1);
			event.preventDefault();
		} else if (event.key === 'ArrowDown') {
			moveHover(navColumns);
			event.preventDefault();
		} else if (event.key === 'ArrowUp') {
			moveHover(-navColumns);
			event.preventDefault();
		} else if (event.key === 'Enter') {
			const emoji = filteredList[hoverIndex];
			if (emoji) {
				selectEmoji(emoji.char);
				event.preventDefault();
			}
		} else if (event.key === 'Escape') {
			isOpen = false;
			dispatch('close', undefined);
		}
	}
</script>

{#if isOpen}
	<div
		class="w-full max-w-[380px] text-gray-900 outline-none select-none"
		role="listbox"
		tabindex="0"
		on:keydown={handleKeydown}
	>
		<div class="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-2xl">
			<div class="border-b border-slate-200 px-3 py-2">
				<label
					class="focus-within:ring-primary flex items-center gap-2 rounded-xs bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-transparent"
				>
					<svg class="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
						<path
							fill-rule="evenodd"
							d="M12.9 14.32a7 7 0 1 1 1.414-1.414l3.39 3.389a1 1 0 0 1-1.414 1.415l-3.39-3.39Zm.59-5.82a5 5 0 1 0-10 0a5 5 0 0 0 10 0Z"
							clip-rule="evenodd"
						/>
					</svg>
					<input
						bind:this={searchInput}
						class="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
						type="text"
						placeholder="Search emojis…"
						bind:value={queryValue}
						on:input={(event) => setQuery((event.target as HTMLInputElement).value)}
					/>
					{#if queryValue}
						<button
							type="button"
							class="text-xs text-slate-500 transition hover:text-slate-800"
							on:click={() => clear()}
						>
							Clear
						</button>
					{/if}
				</label>
			</div>

			<div class="relative" style={`height:${FIXED_HEIGHT};`}>
				<div
					class="grid grid-cols-[repeat(auto-fill,_minmax(44px,_1fr))] gap-1 overflow-y-auto px-2 py-2"
					style={`height:${FIXED_HEIGHT};max-height:${FIXED_HEIGHT};min-height:${FIXED_HEIGHT};`}
					bind:this={gridEl}
				>
					{#if filteredList.length === 0}
						<p class="col-span-full px-2 py-6 text-center text-sm text-slate-500">
							No emojis found.
						</p>
					{:else}
						{#each visibleEmojis as emoji, idx (emoji.char + idx)}
							<button
								type="button"
								class={`focus-visible:outline-primary flex h-11 items-center justify-center rounded-xs text-2xl transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 ${hoverIndex === idx ? 'ring-primary/40 bg-slate-100 ring-1' : 'bg-white'}`}
								aria-label={emoji.name}
								on:mouseenter={() => (hoverIndex = idx)}
								on:focus={() => (hoverIndex = idx)}
								on:click={() => selectEmoji(emoji.char)}
							>
								<span>{emoji.char}</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>

			<div class="flex items-center gap-1 overflow-x-auto border-t border-slate-200 px-2 py-2">
				<button
					type="button"
					class={`flex h-9 w-9 items-center justify-center rounded-xs text-lg transition ${activeCategoryValue === null ? 'bg-primary/10 text-primary ring-primary/30 ring-1' : 'hover:bg-slate-100'}`}
					on:click={() => handleCategory(null)}
					title="All"
					aria-label="All categories"
				>
					⭐
				</button>
				{#each categories as category}
					<button
						type="button"
						class={`flex h-9 w-9 items-center justify-center rounded-xs text-lg transition ${activeCategoryValue === category.id ? 'bg-primary/10 text-primary ring-primary/30 ring-1' : 'hover:bg-slate-100'}`}
						on:click={() => handleCategory(category.id)}
						title={category.label}
						aria-label={category.label}
					>
						<span>{category.icon}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
{/if}
