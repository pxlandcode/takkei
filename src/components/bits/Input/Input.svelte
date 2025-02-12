<script lang="ts">
	export let label: string = '';
	export let name: string = '';
	export let type: string = 'text';
	export let placeholder: string = '';
	export let value: string = '';

	// Accept errors object where `name` is the key for this input's error
	export let errors: Record<string, string> = {};
</script>

<div class="mb-4 w-full">
	{#if label}
		<label for={name} class="mb-1 block text-sm font-medium">
			{label}
		</label>
	{/if}

	<input
		id={name}
		{name}
		{type}
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
	/>

	{#if errors[name]}
		<p class="mt-1 text-sm text-red-500">{errors[name]}</p>
	{/if}
</div>
