<script lang="ts">
	import { onMount } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Icon from '../../bits/icon-component/Icon.svelte';
	import EmojiSelector from '../../bits/emoji/EmojiSelector.svelte';
	import { clickOutside } from '$lib/actions/clickOutside';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { user as userStore } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { Greeting } from '$lib/types/greeting';
	import {
		createGreeting,
		deleteGreeting,
		fetchAdminGreetings,
		updateGreeting
	} from '$lib/services/api/greetingService';
	import { clearGreetingCache } from '$lib/utils/greetings';

	let isAdmin = false;
	let greetings: Greeting[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	let formErrors: Record<string, string> = {};
	let message = '';
	let active = true;
	let showIconPicker = false;
	let pickerRef: HTMLDivElement | null = null;
	let iconRowRef: HTMLDivElement | null = null;

	onMount(() => {
		const unsubscribe = userStore.subscribe((currentUser) => {
			const admin = hasRole('Administrator', currentUser as any);
			if (admin !== isAdmin) {
				isAdmin = admin;
				if (isAdmin) {
					loadGreetings();
				} else {
					greetings = [];
				}
			} else if (admin && !greetings.length && !isLoading) {
				loadGreetings();
			}
		});

		return () => unsubscribe();
	});

	async function loadGreetings() {
		if (!isAdmin) return;
		isLoading = true;
		loadError = null;
		try {
			greetings = await fetchAdminGreetings();
		} catch (error) {
			console.error('Failed to load greetings', error);
			loadError = 'Kunde inte hämta hälsningar just nu.';
			greetings = [];
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
			const created = await createGreeting({
				message: trimmedMessage,
				icon: null,
				active
			});
			greetings = [created, ...greetings];
			clearGreetingCache();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Hälsning sparad',
				description: 'Den nya hälsningen har lagts till.'
			});
			resetForm();
		} catch (error) {
			console.error('Failed to create greeting', error);
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

	async function handleToggleActive(greeting: Greeting) {
		if (!isAdmin || !greeting?.id) return;
		try {
			const updated = await updateGreeting(greeting.id, {
				message: greeting.message,
				icon: greeting.icon ?? null,
				active: !greeting.active
			});
			greetings = greetings.map((g) => (g.id === updated.id ? updated : g));
			clearGreetingCache();
		} catch (error) {
			console.error('Failed to toggle greeting', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ändra status',
				description: 'Försök igen senare.'
			});
		}
	}

	async function handleDelete(greeting: Greeting) {
		if (!isAdmin || !greeting?.id) return;
		const shouldDelete = confirm(`Ta bort hälsningen "${greeting.message}"?`);
		if (!shouldDelete) return;

		try {
			await deleteGreeting(greeting.id);
			greetings = greetings.filter((g) => g.id !== greeting.id);
			clearGreetingCache();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Hälsning borttagen',
				description: 'Den valda hälsningen är borttagen.'
			});
		} catch (error) {
			console.error('Failed to delete greeting', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: 'Försök igen senare.'
			});
		}
	}

	function toggleIconPicker() {
		showIconPicker = !showIconPicker;
	}

	function handleEmojiSelect(value: string) {
		message = `${message || ''}${value}`;
		showIconPicker = false;
	}
</script>

{#if !isAdmin}
	<div class="border-gray/60 rounded border bg-white/40 p-4 text-gray-700">
		Du behöver administratörsbehörighet för att hantera hälsningar.
	</div>
{:else}
	<div class="space-y-6">
		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4">
				<h3 class="text-text text-lg font-semibold">Lägg till hälsning</h3>
				<p class="text-sm text-gray-600">Ställ in om den ska vara aktiv från start.</p>
			</div>

			<div class="relative flex flex-col gap-2" bind:this={iconRowRef}>
				<div class="flex items-start gap-2">
					<div class="flex-1">
						<Input
							label="Meddelande"
							name="message"
							bind:value={message}
							placeholder="Ex. Hej, {name}!"
							errors={formErrors}
						/>
					</div>
					<div class="mt-7.5 hidden md:inline-flex">
						<Button
							variant="secondary"
							icon="ShiningStar"
							iconSize="18px"
							on:click={toggleIconPicker}
							ariaLabel="Välj emoji"
						/>
					</div>
				</div>
				{#if formErrors.message}
					<p class="text-sm text-red-500">{formErrors.message}</p>
				{/if}

				{#if showIconPicker}
					<div
						class="border-gray/20 absolute top-full right-0 z-40 mt-2 min-w-[280px] rounded-xs border bg-white p-2 shadow-xl"
						bind:this={pickerRef}
						use:clickOutside={() => (showIconPicker = false)}
					>
						<EmojiSelector
							closeOnSelect
							on:select={(event) => handleEmojiSelect(event.detail as string)}
							on:close={() => (showIconPicker = false)}
						/>
					</div>
				{/if}
			</div>
			<div class="flex flex-row items-center justify-end gap-5">
				<Checkbox id="greeting-active" label="Aktiv" name="active" bind:checked={active} />

				<Button text="Spara hälsning" iconLeft="Plus" small on:click={handleCreate} />
			</div>
		</section>

		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-text text-lg font-semibold">Befintliga hälsningar</h3>
				{#if isLoading}
					<span class="text-sm text-gray-600">Hämtar...</span>
				{:else if loadError}
					<span class="text-sm text-red-600">{loadError}</span>
				{/if}
			</div>

			{#if greetings.length === 0 && !isLoading}
				<p class="text-sm text-gray-600">Inga hälsningar tillagda ännu.</p>
			{:else}
				<div class="divide-gray/40 border-gray/40 divide-y rounded border bg-white/30">
					{#each greetings as greeting}
						<div class="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<p class="font-semibold text-gray-800">{greeting.message}</p>
									{#if greeting.icon}
										<span class="text-lg">{greeting.icon}</span>
									{/if}
								</div>
								<p class="text-xs text-gray-600">
									Status: {greeting.active ? 'Aktiv' : 'Inaktiv'}
									{#if greeting.createdAt}
										· Skapad {new Date(greeting.createdAt).toLocaleDateString('sv-SE')}
									{/if}
								</p>
							</div>
							<div class="flex items-center gap-3">
								<Checkbox
									id={`greet-${greeting.id}`}
									name={`greet-${greeting.id}`}
									label="Aktiv"
									checked={Boolean(greeting.active)}
									on:change={() => handleToggleActive(greeting)}
								/>
								<Button
									text="Ta bort"
									iconLeft="Trash"
									variant="danger-outline"
									small
									on:click={() => handleDelete(greeting)}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

<style>
</style>
