<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import StepActionFooter from './StepActionFooter.svelte';

	export let currentCase: any;
	export let payload: any;
	export let isOpen = false;
	export let busy = false;
	export let editingDetails = false;
	export let detailForm: Record<string, string> = {};
	export let detailErrors: Record<string, string> = {};
	export let onCancel: () => void;
	export let onSave: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<div class="mb-3 flex items-center justify-between gap-3">
		<h2 class="text-base font-semibold text-gray-900">Inskickade uppgifter</h2>
		{#if isOpen && currentCase.client_resolution !== 'merged' && !editingDetails}
			<Button
				text="Redigera"
				iconLeft="Edit"
				variant="secondary"
				small
				on:click={() => (editingDetails = true)}
			/>
		{/if}
	</div>
	{#if editingDetails}
		<div class="grid gap-x-4 sm:grid-cols-2">
			<Input
				label="Förnamn"
				name="firstname"
				bind:value={detailForm.firstname}
				errors={detailErrors}
			/>
			<Input
				label="Efternamn"
				name="lastname"
				bind:value={detailForm.lastname}
				errors={detailErrors}
			/>
			<Input
				label="E-post"
				name="email"
				type="email"
				bind:value={detailForm.email}
				errors={detailErrors}
			/>
			<Input label="Telefon" name="phone" bind:value={detailForm.phone} errors={detailErrors} />
			<Input
				label="Personnummer"
				name="person_number"
				bind:value={detailForm.person_number}
				errors={detailErrors}
			/>
			<Input
				label="Gatuadress"
				name="streetAddress"
				bind:value={detailForm.streetAddress}
				errors={detailErrors}
			/>
			<Input label="Postnummer" name="zip" bind:value={detailForm.zip} errors={detailErrors} />
			<Input label="Ort" name="city" bind:value={detailForm.city} errors={detailErrors} />
		</div>
		<StepActionFooter>
			<Button text="Avbryt" variant="secondary" small disabled={busy} on:click={onCancel} />
			<Button text="Spara" iconLeft="Check" small disabled={busy} on:click={onSave} />
		</StepActionFooter>
	{:else}
		<div class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
			<div>
				<span class="text-gray-500">E-post</span>
				<p>{payload.email || '–'}</p>
			</div>
			<div>
				<span class="text-gray-500">Telefon</span>
				<p>{payload.phone || '–'}</p>
			</div>
			<div>
				<span class="text-gray-500">Personnummer</span>
				<p>{payload.person_number || payload.personnummer || '–'}</p>
			</div>
			<div>
				<span class="text-gray-500">Adress</span>
				<p>{payload.streetAddress}, {payload.zip} {payload.city}</p>
			</div>
			<div>
				<span class="text-gray-500">Paket</span>
				<p>
					{payload.existingPackage
						? `Befintligt · ${payload.existingPackageOwner}`
						: payload.selectedTrainingPackage}
				</p>
			</div>
			<div>
				<span class="text-gray-500">Betalning</span>
				<p>
					{payload.paymentChoice === 'company' ? 'Företag' : 'Privat'}{payload.autogiro
						? ' · Autogiro'
						: ''}
				</p>
			</div>
		</div>
	{/if}
</div>
