<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import 'quill/dist/quill.snow.css';

	let editor: any = null;
	let container: HTMLDivElement | null = null;
	export let content = '';
	export let placeholder = 'Skriv ditt meddelande här...';

	const dispatch = createEventDispatcher();

	onMount(async () => {
		// ✅ SSR safety check
		if (typeof window === 'undefined' || !container) return;

		// ✅ Dynamically import only in browser
		const Quill = (await import('quill')).default;

		editor = new Quill(container, {
			theme: 'snow',
			placeholder,
			modules: {
				toolbar: [
					['bold', 'italic', 'underline', 'strike'],
					[{ list: 'ordered' }, { list: 'bullet' }],
					['link'],
					[{ header: [1, 2, false] }],
					[{ align: [] }],
					['clean']
				]
			}
		});

		// ✅ Set initial content
		if (content) editor.root.innerHTML = content;

		// ✅ Handle changes
		editor.on('text-change', () => {
			dispatch('change', editor.root.innerHTML);
		});
	});

	onDestroy(() => {
		if (editor) editor.off('text-change');
	});
</script>

<div class="quill-container">
	<div bind:this={container} class="editor" />
</div>

<style>
	.quill-container {
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
		padding: 5px;
	}
	.editor {
		min-height: 150px;
	}
</style>
