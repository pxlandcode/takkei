<script lang="ts">
	export let hour: number;
	export let index: number;
	export let hourHeight: number;
</script>

<div
	class="absolute w-full border-t border-gray-300 pl-2 text-left text-xs text-gray-600"
	style="top: {index * hourHeight}px;"
>
	{hour}:00
</div>
