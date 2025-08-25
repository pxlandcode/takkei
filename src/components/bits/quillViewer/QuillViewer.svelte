<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	export let content: string = ''; // HTML

	let quillContainer: HTMLDivElement | null = null;
	let quill: any = null;

	async function init() {
		// Load only in the browser
		const [{ default: Quill }] = await Promise.all([
			import('quill'),
			import('quill/dist/quill.bubble.css')
		]);

		quill = new Quill(quillContainer!, {
			theme: 'bubble',
			readOnly: true,
			modules: { toolbar: false }
		});

		// Initial content
		if (content) quill.clipboard.dangerouslyPasteHTML(content);
	}

	onMount(() => {
		if (browser && quillContainer) init();
	});

	onDestroy(() => {
		// Quill has no explicit destroy API; drop the ref so GC can collect
		quill = null;
	});

	// React to content changes
	$: if (browser && quill && typeof content === 'string') {
		quill.setContents([]); // clear
		quill.clipboard.dangerouslyPasteHTML(content);
	}
</script>

<!-- Viewer container -->
<div class="quill-viewer">
	<div bind:this={quillContainer}></div>
</div>

<style>
	.quill-viewer {
		border: none;
		background-color: white;
	}
	.quill-viewer .ql-editor {
		font-size: 14px;
		color: #333;
	}

	.quill-viewer .ql-container.ql-snow {
		border: none !important;
	}
	.quill-viewer ul {
		padding-left: 20px;
		list-style-type: disc;
	}
	.quill-viewer ol {
		padding-left: 20px;
		list-style-type: decimal;
	}
	.quill-viewer a {
		color: blue;
		text-decoration: underline;
	}
	.quill-viewer blockquote {
		border-left: 4px solid #ccc;
		padding-left: 10px;
		color: #555;
	}
</style>
