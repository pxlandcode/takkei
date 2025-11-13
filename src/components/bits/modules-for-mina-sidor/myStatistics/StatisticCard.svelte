<script lang="ts">
	import { tooltip } from '$lib/actions/tooltip';

	export let label: string;
	export let value: string | number;
	export let valueClass = 'text-2xl';
	export let deltaLabel: string | undefined = undefined;
	export let detailLabel: string | null = null;
	export let detailValue: string | number | null = null;
	export let detailValueSuffix: string | null = null;
	export let detailValueClass = 'text-text font-medium';
	export let description: string | null = null;

	function getDeltaShort(delta?: string) {
		if (!delta) return null;
		const match = delta.match(/[+-]\s*\d+(?:[.,]\d+)?/);
		if (!match) return null;
		return match[0].replace(/\s+/g, '');
	}

	function deltaClasses(deltaShort?: string | null) {
		if (!deltaShort) return 'hidden';
		if (deltaShort.startsWith('-')) {
			return 'inline-flex items-center rounded-full bg-red-background px-2 py-0.5 text-xs font-medium text-error';
		}
		return 'inline-flex items-center rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-success';
	}

	$: deltaShort = getDeltaShort(deltaLabel);
</script>

<div class="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
	<div class="flex items-center justify-between">
		<p class="text-gray-medium text-xs font-semibold uppercase tracking-wide">{label}</p>
		{#if deltaShort}
			<span class={deltaClasses(deltaShort)} use:tooltip={deltaLabel ? { content: deltaLabel } : null}>
				{deltaShort}
			</span>
		{/if}
	</div>
	<p class={`text-text mt-2 font-semibold ${valueClass}`}>{value}</p>
	{#if detailLabel}
		<p class="text-gray-medium text-xs">
			{detailLabel}
			{#if detailValue !== null && detailValue !== undefined}
				<span class={detailValueClass}>
					{detailValue}{detailValueSuffix}
				</span>
			{/if}
		</p>
	{:else if description}
		<p class="text-gray-medium text-xs">{description}</p>
	{/if}
	<slot />
</div>
