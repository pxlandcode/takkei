<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import type { MailHistoryItem } from '$lib/types/mailTypes';

	export let mail: MailHistoryItem;

	function formatDateTime(value: string) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString('sv-SE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function openInMailComponent() {
		const recipients = (mail.recipients ?? [])
			.map((recipient) => recipient?.email)
			.filter((email): email is string => Boolean(email));

		openPopup({
			header: 'Mailutskick',
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: recipients,
				subject: mail.subject ?? '',
				header: mail.header ?? '',
				subheader: mail.subheader ?? '',
				body: mail.body_html ?? '',
				prefilledFrom: mail.sent_from?.email ?? null
			}
		});
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-2">
		<h3 class="text-xl font-semibold">{mail.subject}</h3>
		<p class="text-sm text-gray-500">
			Skickat {formatDateTime(mail.sent_at)}
			{#if mail.sent_from?.email}
				· Från {mail.sent_from?.name ?? mail.sent_from.email} &lt;{mail.sent_from.email}&gt;
			{/if}
		</p>
		{#if mail.sender_name || mail.sender_email}
			<p class="text-sm text-gray-500">
				Av {mail.sender_name ?? mail.sender_email}
				{#if mail.sender_email && mail.sender_name}
					({mail.sender_email})
				{/if}
			</p>
		{/if}
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		<div>
			<h4 class="text-sm font-semibold text-gray-500 uppercase">
				Mottagare ({mail.recipients_count})
			</h4>
			{#if mail.recipients && mail.recipients.length}
				<ul class="mt-2 space-y-1 text-sm">
					{#each mail.recipients as recipient}
						<li>
							{recipient.name ? `${recipient.name} ` : ''}&lt;{recipient.email}&gt;
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-2 text-sm text-gray-400">Inga mottagare registrerade.</p>
			{/if}
		</div>

		<div class="space-y-2 text-sm">
			{#if mail.header}
				<div>
					<span class="font-semibold">Rubrik:</span>
					{mail.header}
				</div>
			{/if}
			{#if mail.subheader}
				<div>
					<span class="font-semibold">Underrubrik:</span>
					{mail.subheader}
				</div>
			{/if}
			<div>
				<span class="font-semibold">Status:</span>
				{mail.status ?? 'sent'}
			</div>
			{#if mail.error}
				<div class="text-red-600">
					<span class="font-semibold">Fel:</span>
					{mail.error}
				</div>
			{/if}
		</div>
	</div>

	<div class="rounded border border-gray-200 bg-white p-4">
		<h4 class="text-sm font-semibold text-gray-500 uppercase">Innehåll</h4>
		<div class="prose mt-3 max-w-none" class:empty={!(mail.body_html ?? '').trim()}>
			{@html mail.body_html ?? '<p class="text-sm text-gray-400">Ingen HTML sparad.</p>'}
		</div>
	</div>

	<div class="flex justify-end">
		<Button
			text="Öppna i Mailutskick"
			iconLeft="Mail"
			variant="primary"
			on:click={openInMailComponent}
		/>
	</div>
</div>

<style>
	.empty {
		color: #9ca3af;
	}
</style>
