<script lang="ts">
	import { onMount } from 'svelte';
	import Quill from 'quill';
	import 'quill/dist/quill.snow.css';

	export let content: string; // ✅ Quill-formatted HTML content

	let quillContainer: HTMLDivElement;

	onMount(() => {
		if (quillContainer) {
			const quill = new Quill(quillContainer, {
				theme: 'snow',
				readOnly: true,
				modules: { toolbar: false } // ✅ Disable toolbar
			});

			quill.root.innerHTML = content; // ✅ Set the content
		}
	});
</script>

<!-- ✅ Quill Viewer Container -->
<div class="quill-viewer" bind:this={quillContainer}></div>

<style>
	.quill-viewer {
		border: none; /* ✅ Remove border */
		background-color: white;
	}

	.quill-viewer .ql-editor {
		font-size: 14px;
		color: #333;
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
