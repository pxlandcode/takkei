<script lang="ts">
	import { onMount } from 'svelte';
	import TextArea from '../../bits/textarea/TextArea.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { user as userStore } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { EmailFooterMessage } from '$lib/types/emailFooterMessage';
	import {
		createEmailFooterMessage,
		deleteEmailFooterMessage,
		fetchAdminEmailFooterMessages,
		updateEmailFooterMessage
	} from '$lib/services/api/emailFooterMessageService';

	let isAdmin = false;
	let footerMessages: EmailFooterMessage[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	let formErrors: Record<string, string> = {};
	let message = '';
	let active = true;
	let draftMessages: Record<number, string> = {};
	let rowErrors: Record<number, string> = {};
	let savingIds: Record<number, boolean> = {};

	onMount(() => {
		const unsubscribe = userStore.subscribe((currentUser) => {
			const admin = hasRole('Administrator', currentUser as any);
			if (admin !== isAdmin) {
				isAdmin = admin;
				if (isAdmin) {
					loadFooterMessages();
				} else {
					footerMessages = [];
					draftMessages = {};
				}
			} else if (admin && !footerMessages.length && !isLoading) {
				loadFooterMessages();
			}
		});

		return () => unsubscribe();
	});

	function syncDrafts(messages: EmailFooterMessage[]) {
		draftMessages = Object.fromEntries(
			messages
				.filter((footerMessage) => typeof footerMessage.id === 'number')
				.map((footerMessage) => [footerMessage.id as number, footerMessage.message])
		);
	}

	async function loadFooterMessages() {
		if (!isAdmin) return;
		isLoading = true;
		loadError = null;
		try {
			footerMessages = await fetchAdminEmailFooterMessages();
			syncDrafts(footerMessages);
		} catch (error) {
			console.error('Failed to load email footer messages', error);
			loadError = 'Kunde inte hämta mailfoten just nu.';
			footerMessages = [];
			draftMessages = {};
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		message = '';
		active = true;
		formErrors = {};
	}

	async function handleCreate() {
		if (!isAdmin || isLoading) return;
		formErrors = {};
		const trimmedMessage = message.trim();
		if (!trimmedMessage) {
			formErrors = { message: 'Meddelande krävs' };
			return;
		}

		try {
			const created = await createEmailFooterMessage({
				message: trimmedMessage,
				active
			});
			footerMessages = [created, ...footerMessages];
			syncDrafts(footerMessages);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Mailfot sparad',
				description: 'Den nya mailfoten har lagts till.'
			});
			resetForm();
		} catch (error) {
			console.error('Failed to create email footer message', error);
			const err = error as { errors?: Record<string, string> };
			if (err?.errors) {
				formErrors = err.errors;
			}
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte spara',
				description: 'Försök igen senare.'
			});
		}
	}

	function setSaving(id: number, value: boolean) {
		savingIds = { ...savingIds, [id]: value };
	}

	function setRowError(id: number, value: string = '') {
		rowErrors = { ...rowErrors, [id]: value };
	}

	async function handleSave(footerMessage: EmailFooterMessage) {
		if (!isAdmin || typeof footerMessage.id !== 'number') return;
		const id = footerMessage.id;
		const trimmedMessage = (draftMessages[id] ?? '').trim();
		if (!trimmedMessage) {
			setRowError(id, 'Meddelande krävs');
			return;
		}

		setSaving(id, true);
		setRowError(id);
		try {
			const updated = await updateEmailFooterMessage(id, {
				message: trimmedMessage,
				active: footerMessage.active ?? true
			});
			footerMessages = footerMessages.map((item) => (item.id === updated.id ? updated : item));
			draftMessages = { ...draftMessages, [id]: updated.message };
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Mailfot uppdaterad',
				description: 'Meddelandet har sparats.'
			});
		} catch (error) {
			console.error('Failed to update email footer message', error);
			const err = error as { errors?: Record<string, string> };
			if (err?.errors?.message) {
				setRowError(id, err.errors.message);
			}
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte uppdatera',
				description: 'Försök igen senare.'
			});
		} finally {
			setSaving(id, false);
		}
	}

	async function handleToggleActive(footerMessage: EmailFooterMessage) {
		if (!isAdmin || typeof footerMessage.id !== 'number') return;
		const id = footerMessage.id;
		setSaving(id, true);
		try {
			const updated = await updateEmailFooterMessage(id, {
				message: footerMessage.message,
				active: !(footerMessage.active ?? true)
			});
			footerMessages = footerMessages.map((item) => (item.id === updated.id ? updated : item));
			draftMessages = { ...draftMessages, [id]: updated.message };
		} catch (error) {
			console.error('Failed to toggle email footer message', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ändra status',
				description: 'Försök igen senare.'
			});
		} finally {
			setSaving(id, false);
		}
	}

	async function handleDelete(footerMessage: EmailFooterMessage) {
		if (!isAdmin || typeof footerMessage.id !== 'number') return;
		const id = footerMessage.id;
		try {
			await deleteEmailFooterMessage(id);
			footerMessages = footerMessages.filter((item) => item.id !== id);
			const { [id]: _removedDraft, ...remainingDrafts } = draftMessages;
			const { [id]: _removedError, ...remainingErrors } = rowErrors;
			draftMessages = remainingDrafts;
			rowErrors = remainingErrors;
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Mailfot borttagen',
				description: 'Den valda mailfoten är borttagen.'
			});
		} catch (error) {
			console.error('Failed to delete email footer message', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: 'Försök igen senare.'
			});
		}
	}
</script>

{#if !isAdmin}
	<div class="border-gray/60 rounded border bg-white/40 p-4 text-gray-700">
		Du behöver administratörsbehörighet för att hantera mailfoten.
	</div>
{:else}
	<div class="space-y-6">
		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4">
				<h3 class="text-text text-lg font-semibold">Lägg till mailfot</h3>
				<p class="text-sm text-gray-600">Ställ in om den ska vara aktiv från start.</p>
			</div>

			<TextArea
				label="Meddelande"
				name="message"
				bind:value={message}
				placeholder="Ex. En timme i veckan&#10;Hela kroppen&#10;Repetera"
				errors={formErrors}
			/>

			<div
				class="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-end md:gap-4"
			>
				<div>
					<Checkbox id="email-footer-active" label="Aktiv" name="active" bind:checked={active} />
				</div>
				<Button text="Spara mailfot" iconLeft="Plus" small on:click={handleCreate} />
			</div>
		</section>

		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-text text-lg font-semibold">Befintliga mailfötter</h3>
				{#if isLoading}
					<span class="text-sm text-gray-600">Hämtar...</span>
				{:else if loadError}
					<span class="text-sm text-red-600">{loadError}</span>
				{/if}
			</div>

			{#if footerMessages.length === 0 && !isLoading}
				<p class="text-sm text-gray-600">Inga mailfötter tillagda ännu.</p>
			{:else}
				<div class="divide-gray/40 border-gray/40 divide-y rounded border bg-white/30">
					{#each footerMessages as footerMessage}
						{@const id = footerMessage.id}
						<div class="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between">
							<div class="min-w-0 flex-1">
								{#if typeof id === 'number'}
									<TextArea
										label="Meddelande"
										name={`email-footer-${id}`}
										bind:value={draftMessages[id]}
										errors={rowErrors[id] ? { [`email-footer-${id}`]: rowErrors[id] } : {}}
									/>
								{/if}
								<p class="text-xs text-gray-600">
									Status: {footerMessage.active ? 'Aktiv' : 'Inaktiv'}
									{#if footerMessage.createdAt}
										· Skapad {new Date(footerMessage.createdAt).toLocaleDateString('sv-SE')}
									{/if}
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-3">
								{#if typeof id === 'number'}
									<Checkbox
										id={`email-footer-active-${id}`}
										name={`email-footer-active-${id}`}
										label="Aktiv"
										checked={Boolean(footerMessage.active)}
										on:change={() => handleToggleActive(footerMessage)}
									/>
									<Button
										text={savingIds[id] ? 'Sparar...' : 'Spara'}
										iconLeft="Save"
										variant="secondary"
										small
										disabled={Boolean(savingIds[id])}
										on:click={() => handleSave(footerMessage)}
									/>
									<Button
										text="Ta bort"
										iconLeft="Trash"
										variant="danger-outline"
										small
										confirmOptions={{
											title: 'Ta bort mailfot',
											description: `Ta bort "${footerMessage.message}"?`,
											actionLabel: 'Ta bort',
											action: () => handleDelete(footerMessage)
										}}
									/>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
