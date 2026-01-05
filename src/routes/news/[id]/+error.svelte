<script lang="ts">
	import Button from '../../../components/bits/button/Button.svelte';
	import Icon from '../../../components/bits/icon-component/Icon.svelte';

	export let error;
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
	<div class="flex items-center gap-2 text-error">
		<Icon icon="Newspaper" size="24px" />
		<h1 class="text-2xl font-semibold text-text">Nyheten finns inte</h1>
	</div>
	<p class="text-gray-600">
		{#if error?.status === 404}
			Den här nyheten har tagits bort eller finns inte längre.
		{:else}
			Ett fel inträffade ({error?.status ?? 'okänt fel'}).
		{/if}
	</p>
	<a
		class="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-primary-hover"
		href="/news"
	>
		<Icon icon="ChevronLeft" size="16px" />
		Till nyhetslistan
	</a>
</div>
