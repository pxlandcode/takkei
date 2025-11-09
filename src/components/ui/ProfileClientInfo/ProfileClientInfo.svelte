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
		if (!email) return;
		const fullName = `${client?.firstname ?? ''} ${client?.lastname ?? ''}`.trim();
		openPopup({
			header: fullName ? `Maila ${fullName}` : `Maila ${email}`,
			icon: 'Mail',
			component: MailComponent,
			width: '900px',
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

	$: contactLeftFields = [
		{ label: 'Förnamn', value: client?.firstname },
		{ label: 'Efternamn', value: client?.lastname },
		{
			label: 'E-post',
			value: client?.email,
			action: client?.email ? () => openMailPopup(client.email) : undefined
		},
		{
			label: 'Alternativ e-post',
			value: client?.alternative_email,
			action: client?.alternative_email ? () => openMailPopup(client.alternative_email) : undefined
		},
		{
			label: 'Telefon',
			value: client?.phone,
			href: client?.phone ? `tel:${client.phone.replace(/\s+/g, '')}` : undefined
		}
	];

	$: contactRightFields = [
		{ label: 'Personnummer', value: client?.person_number },
		{ label: 'Primär tränare', value: primaryTrainerName() },
		{ label: 'Aktiv', value: boolToLabel(client?.active) }
	];

	function handleClientSaved(updated?: typeof client) {
		if (updated) {
			Object.assign(client, updated);
		}
		isEditing = false;
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-sm bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{!isEditing ? 'Profil' : 'Redigera'}</h4>
			<Button
				text={isEditing ? 'Avbryt' : 'Redigera'}
				on:click={() => (isEditing = !isEditing)}
				variant="primary"
			/>
		</div>

		{#if !isEditing}
			<div class="grid gap-6 md:grid-cols-2">
				<dl class="space-y-4">
					{#each contactLeftFields as field (field.label)}
						<div>
							<dt class="text-xs font-semibold uppercase tracking-wide text-gray-500">
								{field.label}
							</dt>
							{#if field.action && field.value}
								<dd>
									<button
										type="button"
										class="text-base font-medium text-primary hover:underline"
										on:click={field.action}
									>
										{renderFieldValue(field.value)}
									</button>
								</dd>
							{:else if field.href && field.value}
								<dd>
									<a class="text-base font-medium text-primary hover:underline" href={field.href}>
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
							<dt class="text-xs font-semibold uppercase tracking-wide text-gray-500">
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

	<ProfileClientPackages clientId={client.id} />

	<div class="pb-8">
		<BookingGrid clientId={client.id} />
	</div>
</div>
