<script lang="ts">
	import Input from '../../bits/Input/Input.svelte';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import { createEventDispatcher } from 'svelte';
	import { closePopup } from '$lib/stores/popupStore';

	const dispatch = createEventDispatcher();

	let currentPassword = '';
	let newPassword = '';
	let confirmPassword = '';
	let errors: Record<string, string> = {};
	let saving = false;

	async function handleSave() {
		errors = {};

		if (!currentPassword) errors.currentPassword = 'Ange nuvarande lösenord';
		if (!newPassword) errors.newPassword = 'Ange nytt lösenord';
		if (newPassword && newPassword.length < 8) errors.newPassword = 'Minst 8 tecken';
		if (newPassword !== confirmPassword) errors.confirmPassword = 'Lösenorden matchar inte';

		if (Object.keys(errors).length > 0) return;

		saving = true;
		try {
			const res = await fetch('/api/client/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
			});

			const payload = await res.json().catch(() => ({}));

			if (!res.ok) {
				errors = payload.errors || { general: payload.error || 'Kunde inte uppdatera lösenord.' };
				return;
			}

			currentPassword = '';
			newPassword = '';
			confirmPassword = '';

			addToast({
				type: AppToastType.SUCCESS,
				message: 'Lösenord uppdaterat',
				description: 'Ditt lösenord har ändrats.'
			});
			dispatch('success');
			closePopup();
		} catch (err) {
			errors = { general: 'Ett fel uppstod. Försök igen.' };
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-4">
	<Input
		label="Nuvarande lösenord"
		name="currentPassword"
		type="password"
		bind:value={currentPassword}
		{errors}
	/>
	<Input
		label="Nytt lösenord"
		name="newPassword"
		type="password"
		bind:value={newPassword}
		{errors}
	/>
	<Input
		label="Bekräfta nytt lösenord"
		name="confirmPassword"
		type="password"
		bind:value={confirmPassword}
		{errors}
	/>

	{#if errors.general}
		<p class="text-sm text-red-500">{errors.general}</p>
	{/if}

	<Button
		text="Byt lösenord"
		variant="primary"
		full
		on:click={handleSave}
		disabled={saving}
	/>
</div>
