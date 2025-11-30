<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import BookingGrid from '../bookingGrid/BookingGrid.svelte';
	import ProfileClientEdit from '../ProfileClientEdit/ProfileClientEdit.svelte';
	import ProfileClientPackages from '../ProfileClientPackages/ProfileClientPackages.svelte';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { openPopup } from '$lib/stores/popupStore';

	type ProfileField = {
		label: string;
		value: string | number | null | undefined;
		href?: string;
		action?: () => void;
	};

	export let client;
	export let readOnly = false;
	export let showPackages = true;
	export let showBookingGrid = true;
	export let allowEditing = true;
	export let allowMailPopup = true;

	let isEditing = false;

	const EMPTY_VALUE = 'Inte angivet';
	const boolToLabel = (value?: boolean | null) => (value ? 'Ja' : 'Nej');

	function renderFieldValue(value: string | number | null | undefined) {
		if (value === null || value === undefined) return EMPTY_VALUE;
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length ? trimmed : EMPTY_VALUE;
		}
		return value.toString();
	}

	function openMailPopup(email: string) {
		if (!email || !canUseMailPopup) return;
		const fullName = `${client?.firstname ?? ''} ${client?.lastname ?? ''}`.trim();
		openPopup({
			header: fullName ? `Maila ${fullName}` : `Maila ${email}`,
			icon: 'Mail',
			component: MailComponent,
			maxWidth: '900px',
			props: {
				prefilledRecipients: [email],
				lockedFields: ['recipients'],
				autoFetchUsersAndClients: false
			}
		});
	}

	function primaryTrainerName() {
		if (client?.trainer_firstname && client?.trainer_lastname) {
			return `${client.trainer_firstname} ${client.trainer_lastname}`;
		}
		return 'Ingen';
	}

	let contactLeftFields: ProfileField[] = [];
	let contactRightFields: ProfileField[] = [];

	$: canEdit = !readOnly && allowEditing;
	$: canUseMailPopup = !readOnly && allowMailPopup;
	$: canShowPackages = !readOnly && showPackages;
	$: shouldShowBookingGrid = showBookingGrid && Boolean(client?.id);

	$: contactLeftFields = [
		{ label: 'Förnamn', value: client?.firstname },
		{ label: 'Efternamn', value: client?.lastname },
		{
			label: 'E-post',
			value: client?.email,
			action: client?.email && canUseMailPopup ? () => openMailPopup(client.email) : undefined
		},
		{
			label: 'Alternativ e-post',
			value: client?.alternative_email,
			action:
				client?.alternative_email && canUseMailPopup
					? () => openMailPopup(client.alternative_email)
					: undefined
		},
		{
			label: 'Telefon',
			value: client?.phone,
			href: client?.phone && !readOnly ? `tel:${client.phone.replace(/\s+/g, '')}` : undefined
		}
	];

	$: contactRightFields = [
		{ label: 'Personnummer', value: client?.person_number },
		{ label: 'Primär tränare', value: primaryTrainerName() },
		{ label: 'Aktiv', value: boolToLabel(client?.active) }
	];

	$: if (!canEdit && isEditing) {
		isEditing = false;
	}

	function handleClientSaved(updated?: typeof client) {
		if (updated) {
			Object.assign(client, updated);
		}
		isEditing = false;
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-sm border border-gray-200 bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{canEdit && isEditing ? 'Redigera' : 'Profil'}</h4>
			{#if canEdit}
				<Button
					text={isEditing ? 'Avbryt' : 'Redigera'}
					on:click={() => (isEditing = !isEditing)}
					variant="primary"
				/>
			{/if}
		</div>

		{#if !(canEdit && isEditing)}
			<div class="grid gap-6 md:grid-cols-2">
				<dl class="space-y-4">
					{#each contactLeftFields as field (field.label)}
						<div>
							<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								{field.label}
							</dt>
							{#if field.action && field.value}
								<dd>
									<button
										type="button"
										class="text-primary text-base font-medium hover:underline"
										on:click={field.action}
									>
										{renderFieldValue(field.value)}
									</button>
								</dd>
							{:else if field.href && field.value}
								<dd>
									<a class="text-primary text-base font-medium hover:underline" href={field.href}>
										{renderFieldValue(field.value)}
									</a>
								</dd>
							{:else}
								<dd class="text-base font-medium text-gray-800">
									{renderFieldValue(field.value)}
								</dd>
							{/if}
						</div>
					{/each}
				</dl>
				<dl class="space-y-4">
					{#each contactRightFields as field (field.label)}
						<div>
							<dt class="text-xs font-semibold tracking-wide text-gray-500 uppercase">
								{field.label}
							</dt>
							<dd class="text-base font-medium text-gray-800">
								{renderFieldValue(field.value)}
							</dd>
						</div>
					{/each}
				</dl>
			</div>
		{:else}
			<ProfileClientEdit {client} onSave={handleClientSaved} />
		{/if}
	</div>

	{#if canShowPackages && client?.id}
		<ProfileClientPackages clientId={client.id} />
	{/if}

	{#if shouldShowBookingGrid}
		<div class="pb-8">
			<BookingGrid clientId={client.id} />
		</div>
	{/if}
</div>
