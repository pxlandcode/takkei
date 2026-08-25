<script module lang="ts">
	export type FilterOption = {
		value: string;
		label: string;
		icon?: string;
		count?: number | null;
	};
</script>

<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';

	type Props = {
		options: FilterOption[];
		value: string;
		onSelect?: (value: string) => void;
		label?: string;
		size?: 'small' | 'medium';
	};

	let { options, value, onSelect, label = 'Filter', size = 'small' }: Props = $props();

	let buttonHeight = $derived(size === 'small' ? 'h-8' : 'h-10');
	let textSize = $derived(size === 'small' ? 'text-sm' : 'text-base');

	function select(option: FilterOption) {
		if (option.value === value) return;
		onSelect?.(option.value);
	}
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label={label}>
	{#each options as option (option.value)}
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-sm border px-3 font-medium transition {buttonHeight} {textSize} {value ===
			option.value
				? 'border-gray bg-gray text-white'
				: 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}"
			onclick={() => select(option)}
			aria-pressed={value === option.value}
		>
			{#if option.icon}
				<Icon icon={option.icon} size="14px" />
			{/if}
			<span>{option.label}</span>
			{#if option.count != null}
				<span
					class="rounded-sm px-1.5 py-0.5 text-xs {value === option.value
						? 'bg-white/15 text-white'
						: 'bg-gray-100 text-gray-500'}"
				>
					{option.count}
				</span>
			{/if}
		</button>
	{/each}
</div>
