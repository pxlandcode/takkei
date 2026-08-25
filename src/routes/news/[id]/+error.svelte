<script lang="ts">
	import Icon from '../../../components/bits/icon-component/Icon.svelte';

	type Props = {
		error?: {
			status?: number;
			message?: string;
		} | null;
	};

	let { error = null }: Props = $props();
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
	<div class="text-error flex items-center gap-2">
		<Icon icon="Newspaper" size="24px" />
		<h1 class="text-text text-2xl font-semibold">Nyheten finns inte</h1>
	</div>
	<p class="text-gray-600">
		{#if error?.status === 404}
			Den här nyheten har tagits bort eller finns inte längre.
		{:else}
			Ett fel inträffade ({error?.status ?? 'okänt fel'}).
		{/if}
	</p>
	<a
		class="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold text-white shadow-xs transition"
		href="/news"
	>
		<Icon icon="ChevronLeft" size="16px" />
		Till nyhetslistan
	</a>
</div>
