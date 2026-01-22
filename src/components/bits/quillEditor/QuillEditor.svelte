<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import 'quill/dist/quill.snow.css';

	let editor: any = null;
	let container: HTMLDivElement | null = null;
	export let content = '';
	export let placeholder = 'Skriv ditt meddelande här...';

	const dispatch = createEventDispatcher();
	let lastHtml = '';

	function syncEditorContent(nextContent: string) {
		if (!editor) return;
		const html = nextContent ?? '';
		if (html === lastHtml) return;

		editor.setContents([], 'silent');
		if (html) {
			editor.clipboard.dangerouslyPasteHTML(html, 'silent');
		}
		lastHtml = html;
	}

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

		syncEditorContent(content);

		// ✅ Handle changes
		editor.on('text-change', () => {
			const html = editor.root.innerHTML;
			if (html === lastHtml) return;
			lastHtml = html;
			dispatch('change', html);
		});
	});

	onDestroy(() => {
		if (editor) editor.off('text-change');
	});

	$: if (editor) {
		syncEditorContent(content);
	}
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
