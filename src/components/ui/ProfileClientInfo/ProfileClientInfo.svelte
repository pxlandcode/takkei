<script lang="ts">
	import Button from '../../bits/button/Button.svelte';
	import BookingGrid from '../bookingGrid/BookingGrid.svelte';
	import ProfileClientEdit from '../ProfileClientEdit/ProfileClientEdit.svelte';
	import ProfileClientPackages from '../ProfileClientPackages/ProfileClientPackages.svelte';

	export let client;

	let isEditing = false;
	let primaryTrainerName = 'Ingen';

	// Extract name from primary trainer object if available
	$: if (client?.trainer_firstname && client?.trainer_lastname) {
		primaryTrainerName = `${client.trainer_firstname} ${client.trainer_lastname}`;
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Profile Card -->
	<div class="rounded-sm bg-white p-6 shadow-md">
		<div class="mb-4 flex items-center justify-between">
			<h4 class="text-xl font-semibold">{!isEditing ? 'Profil' : 'Redigera'}</h4>
			<Button
				text={isEditing ? 'Spara' : 'Redigera'}
				on:click={() => (isEditing = !isEditing)}
				variant="primary"
			/>
		</div>

		{#if !isEditing}
			<p class="text-gray-600"><strong>Förnamn:</strong> {client.firstname}</p>
			<p class="text-gray-600"><strong>Efternamn:</strong> {client.lastname}</p>
			<p class="text-gray-600"><strong>Personnummer:</strong> {client.person_number}</p>
			<p class="text-gray-600"><strong>Email:</strong> {client.email}</p>
			<p class="text-gray-600">
				<strong>Alternativ Email:</strong>
				{client.alternative_email || 'Ingen'}
			</p>
			<p class="text-gray-600"><strong>Telefon:</strong> {client.phone}</p>
			<p class="text-gray-600"><strong>Primär tränare:</strong> {primaryTrainerName}</p>
			<p class="text-gray-600"><strong>Aktiv:</strong> {client.active ? 'Ja' : 'Nej'}</p>
		{:else}
			<ProfileClientEdit {client} onSave={() => (isEditing = false)} />
		{/if}
	</div>

	<ProfileClientPackages clientId={client.id} />

	<div class="pb-8">
		<BookingGrid clientId={client.id} />
	</div>
</div>
