<script lang="ts">
	import { onMount } from 'svelte';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import { roleLabel } from '$lib/constants/roles';
	import MailComponent from '../mailComponent/MailComponent.svelte';
	import { openPopup } from '$lib/stores/popupStore';
	import type { Role } from '$lib/types/userTypes';
	import Button from '../../bits/button/Button.svelte';
	import BookingGrid from '../bookingGrid/BookingGrid.svelte';
	import ProfileEdit from '../ProfileEdit/ProfileEdit.svelte';
	import AchievementsComponent from '../achievementsComponent/AchievementsComponent.svelte';

	type ProfileField = {
		label: string;
		value: string | number | null | undefined;
		href?: string;
		action?: () => void;
	};

	export let trainer;

	let isEditing = false;
	let defaultLocation = null;
	let locationsLoaded = false;

	onMount(async () => {
		if ($locations.length === 0) {
			await fetchLocations();
		}
		locationsLoaded = true;
	});

	$: if (trainer?.default_location_id && locationsLoaded && $locations.length > 0) {
		defaultLocation = $locations.find((l) => l.id === trainer.default_location_id) || null;
	}

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

	function primaryLocationLabel() {
		if (trainer?.default_location) return trainer.default_location;
		if (!trainer?.default_location_id) return 'Ingen vald';
		if (!locationsLoaded) return 'Laddar...';
		return defaultLocation?.name ?? 'Okänd lokal';
	}

	function openMailPopup(email: string) {
		if (!email) return;
		const fullName = `${trainer?.firstname ?? ''} ${trainer?.lastname ?? ''}`.trim();
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

	let contactLeftFields: ProfileField[] = [];
	let contactRightFields: ProfileField[] = [];
	let roles: Role[] = [];
	let hasRoles = false;

	$: contactLeftFields = [
		{ label: 'Förnamn', value: trainer?.firstname },
		{ label: 'Efternamn', value: trainer?.lastname },
		{
			label: 'E-post',
			value: trainer?.email,
			action: trainer?.email ? () => openMailPopup(trainer.email) : undefined
		},
		{
			label: 'Mobiltelefon',
			value: trainer?.mobile,
			href: trainer?.mobile ? `tel:${trainer.mobile.replace(/\s+/g, '')}` : undefined
		}
	];

	$: contactRightFields = [
		{ label: 'Initialer', value: trainer?.initials },
		{ label: 'Aktiv', value: boolToLabel(trainer?.active) },
		{ label: 'Primär lokal', value: primaryLocationLabel() }
	];

	$: roles = trainer?.roles ?? [];
	$: hasRoles = Array.isArray(roles) && roles.length > 0;
	function handleProfileSaved(updatedUser?: typeof trainer) {
		if (updatedUser) {
			Object.assign(trainer, updatedUser);
		}
		isEditing = false;
	}
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-lg bg-white p-6 shadow-md">
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
					<div class="space-y-6">
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
						<div>
							<p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
								Roller & behörigheter
							</p>
							<div class="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-4">
								{#if hasRoles}
									<div class="flex flex-wrap gap-2">
										{#each roles as role (role.id ?? role.name)}
											<span class="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700">
												{roleLabel(role?.name) || role?.name || 'Okänd roll'}
											</span>
										{/each}
									</div>
								{:else}
									<p class="text-sm text-gray-500">Inga roller tilldelade.</p>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{:else}
				<ProfileEdit {trainer} onSave={handleProfileSaved} />
			{/if}
	</div>

	<BookingGrid trainerId={trainer.id} />
	<AchievementsComponent userId={trainer.id} />
</div>
