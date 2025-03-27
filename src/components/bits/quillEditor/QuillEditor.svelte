<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import Quill from 'quill';
	import 'quill/dist/quill.snow.css';

	let editor: Quill | null = null;
	let container: HTMLDivElement | null = null;
	export let content = ''; // Initial content
	export let placeholder = 'Skriv din anteckning här...';
	const dispatch = createEventDispatcher();

	// ✅ Initialize Quill
	onMount(() => {
		if (container) {
			editor = new Quill(container, {
				modules: {
					toolbar: [
						['bold', 'italic', 'underline', 'strike'], // Text styles
						[{ list: 'ordered' }, { list: 'bullet' }], // Lists
						['link'], // Links
						[{ header: [1, 2, false] }], // Headers
						[{ align: [] }], // Alignments
						['clean'] // Remove formatting
					]
				},
				theme: 'snow',
				placeholder
			});

			// ✅ Set initial content
			editor.root.innerHTML = content;

			// ✅ Listen for changes
			editor.on('text-change', () => {
				const htmlContent = editor.root.innerHTML;
				dispatch('change', htmlContent);
			});
		}
	});

	// ✅ Cleanup
	onDestroy(() => {
		if (editor) {
			editor.off('text-change');
			editor = null;
		}
	});
</script>

<!-- Quill Container -->
<div class="quill-container">
	<div bind:this={container} class="editor"></div>
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
