<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	export let icon: string;
	export let size: string = '24px';
	export let type: 'primary' | 'secondary' | 'cancel' = '';
	export let transparent: boolean = false;
	export let small: boolean = false;
	const dispatch = createEventDispatcher();

	function handleClick() {
		dispatch('click');
	}
</script>

<button
	on:click={handleClick}
	class={`flex cursor-pointer items-center justify-center rounded-full text-black shadow-lg transition-all duration-200
        ${type === 'primary' ? 'bg-black text-white hover:bg-gray-800' : ''}
        ${type === 'secondary' ? 'bg-gray-600 text-white hover:bg-gray-500' : ''}
        ${type === 'cancel' ? 'bg-red-600 text-white hover:bg-red-500' : ''}
        ${transparent ? 'bg-transparent text-gray-800 shadow-none hover:bg-gray-800 hover:text-white' : ''}
        ${transparent && type === 'cancel' ? 'hover:text-red-500' : ''}
        h-12 w-12
        ${small ? 'h-8 w-8' : ''}
        focus:outline-none active:translate-y-1 active:scale-95
        active:shadow-sm`}
>
	<Icon {icon} {size} />
</button>
