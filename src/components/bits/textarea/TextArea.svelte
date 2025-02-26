<script lang="ts">
	export let label: string = '';
	export let name: string = '';
	export let placeholder: string = '';
	export let value: string = '';

	export let errors: Record<string, string> = {};
</script>

<div class="mb-4 w-full">
	{#if label}
		<label for={name} class="mb-1 block text-sm font-medium">
			{label}
		</label>
	{/if}

	<textarea
		id={name}
		{name}
		class="
			w-full
			rounded
			border
			bg-white
			px-3
			py-2
			text-black
			transition-colors
			duration-150
			focus:outline-none
			{errors[name] ? 'border-red-500' : 'border-gray-300 focus:border-gray-500'}"
		{placeholder}
		bind:value
		rows="4"
	></textarea>

	{#if errors[name]}
		<p class="mt-1 text-sm text-red-500">{errors[name]}</p>
	{/if}
</div>
