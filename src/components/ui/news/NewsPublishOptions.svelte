<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';

	type Props = {
		pinned: boolean;
		sendEmail: boolean;
		showSendEmail?: boolean;
		onPinnedChange?: (pinned: boolean) => void;
		onSendEmailChange?: (sendEmail: boolean) => void;
	};

	let {
		pinned,
		sendEmail,
		showSendEmail = false,
		onPinnedChange,
		onSendEmailChange
	}: Props = $props();
</script>

<section class="rounded-sm border border-gray-100 bg-gray-50 p-4">
	<div class="mb-3 flex items-start justify-between gap-3">
		<div>
			<h4 class="text-text text-sm font-semibold">Publicering</h4>
			<p class="mt-1 text-xs text-gray-500">Håll nyheten enkel och tydlig.</p>
		</div>
		<Icon icon="Newspaper" size="18px" extraClasses="text-gray-400" />
	</div>

	<div class="flex flex-col gap-3">
		<label class="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-gray-700">
			<input
				type="checkbox"
				class="accent-primary h-4 w-4"
				checked={pinned}
				onchange={(event) => onPinnedChange?.((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>Fäst högst upp</span>
		</label>

		{#if showSendEmail}
			<label class="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-gray-700">
				<input
					type="checkbox"
					class="accent-primary h-4 w-4"
					checked={sendEmail}
					onchange={(event) =>
						onSendEmailChange?.((event.currentTarget as HTMLInputElement).checked)}
				/>
				<span>Skicka som mail</span>
			</label>
		{/if}
	</div>
</section>
