<script lang="ts">
	import { onMount } from 'svelte';
	import Input from '../../bits/Input/Input.svelte';
	import Checkbox from '../../bits/checkbox/Checkbox.svelte';
	import Button from '../../bits/button/Button.svelte';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
	import { user as userStore } from '$lib/stores/userStore';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type { BookingContent } from '$lib/types/bookingContent';
	import type { BookingContentIcon } from '$lib/helpers/bookingContentIcons';
	import {
		createBookingContent,
		deleteBookingContent,
		fetchAdminBookingContents,
		updateBookingContent
	} from '$lib/services/api/bookingContentService';
	import { fetchBookingContents } from '$lib/stores/bookingContentStore';

	const iconOptions: { value: BookingContentIcon; label: string; icon: BookingContentIcon }[] = [
		{ value: 'Training', label: 'Träning', icon: 'Training' },
		{ value: 'Dumbbell', label: 'Hantel', icon: 'Dumbbell' },
		{ value: 'Gymnastics', label: 'Gymnastik', icon: 'Gymnastics' },
		{ value: 'Mobility', label: 'Mobility', icon: 'Mobility' },
		{ value: 'Running', label: 'Löpning', icon: 'Running' },
		{ value: 'Trophy', label: 'Tävling', icon: 'Trophy' },
		{ value: 'GraduationCap', label: 'Utbildning', icon: 'GraduationCap' },
		{ value: 'ShiningStar', label: 'Stjärna', icon: 'ShiningStar' }
	];

	let isAdmin = false;
	let passTypes: BookingContent[] = [];
	let isLoading = false;
	let loadError: string | null = null;

	let formErrors: Record<string, string> = {};
	let kind = '';
	let icon: BookingContentIcon = 'Training';
	let active = true;

	let draftKinds: Record<number, string> = {};
	let draftIcons: Record<number, BookingContentIcon> = {};
	let rowErrors: Record<number, string> = {};
	let savingIds: Record<number, boolean> = {};

	onMount(() => {
		const unsubscribe = userStore.subscribe((currentUser) => {
			const admin = hasRole('Administrator', currentUser as any);
			if (admin !== isAdmin) {
				isAdmin = admin;
				if (isAdmin) {
					loadPassTypes();
				} else {
					passTypes = [];
					draftKinds = {};
					draftIcons = {};
				}
			} else if (admin && !passTypes.length && !isLoading) {
				loadPassTypes();
			}
		});

		return () => unsubscribe();
	});

	function syncDrafts(items: BookingContent[]) {
		draftKinds = Object.fromEntries(items.map((item) => [item.id, item.kind]));
		draftIcons = Object.fromEntries(items.map((item) => [item.id, item.icon]));
	}

	function sortPassTypes(items: BookingContent[]) {
		return [...items].sort((a, b) => {
			if (a.active !== b.active) return a.active ? -1 : 1;
			return a.kind.localeCompare(b.kind, 'sv-SE', { sensitivity: 'base', numeric: true });
		});
	}

	async function refreshPublicBookingContents() {
		try {
			await fetchBookingContents();
		} catch {
			// The store helper already logs fetch failures.
		}
	}

	async function loadPassTypes() {
		if (!isAdmin) return;
		isLoading = true;
		loadError = null;
		try {
			passTypes = await fetchAdminBookingContents();
			syncDrafts(passTypes);
		} catch (error) {
			console.error('Failed to load pass types', error);
			loadError = 'Kunde inte hämta passtyper just nu.';
			passTypes = [];
			draftKinds = {};
			draftIcons = {};
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		kind = '';
		icon = 'Training';
		active = true;
		formErrors = {};
	}

	function setSaving(id: number, value: boolean) {
		savingIds = { ...savingIds, [id]: value };
	}

	function setRowError(id: number, value = '') {
		rowErrors = { ...rowErrors, [id]: value };
	}

	function upsertPassType(updated: BookingContent) {
		passTypes = sortPassTypes(passTypes.map((item) => (item.id === updated.id ? updated : item)));
		draftKinds = { ...draftKinds, [updated.id]: updated.kind };
		draftIcons = { ...draftIcons, [updated.id]: updated.icon };
	}

	async function handleCreate() {
		if (!isAdmin || isLoading) return;
		formErrors = {};
		const trimmedKind = kind.trim();
		if (!trimmedKind) {
			formErrors = { kind: 'Namn krävs' };
			return;
		}

		try {
			const created = await createBookingContent({
				kind: trimmedKind,
				icon,
				active
			});
			passTypes = sortPassTypes([created, ...passTypes]);
			syncDrafts(passTypes);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Passtyp sparad',
				description: 'Den nya passtypen har lagts till.'
			});
			resetForm();
			await refreshPublicBookingContents();
		} catch (error) {
			console.error('Failed to create pass type', error);
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

	async function handleSave(passType: BookingContent) {
		const id = passType.id;
		const trimmedKind = (draftKinds[id] ?? '').trim();
		if (!trimmedKind) {
			setRowError(id, 'Namn krävs');
			return;
		}

		setSaving(id, true);
		setRowError(id);
		try {
			const updated = await updateBookingContent(id, {
				kind: trimmedKind,
				icon: draftIcons[id] ?? passType.icon,
				active: passType.active
			});
			upsertPassType(updated);
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Passtyp uppdaterad',
				description: 'Ändringarna har sparats.'
			});
			await refreshPublicBookingContents();
		} catch (error) {
			console.error('Failed to update pass type', error);
			const err = error as { errors?: Record<string, string> };
			if (err?.errors?.kind) {
				setRowError(id, err.errors.kind);
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

	async function handleToggleActive(passType: BookingContent) {
		const id = passType.id;
		setSaving(id, true);
		try {
			const updated = await updateBookingContent(id, {
				kind: passType.kind,
				icon: draftIcons[id] ?? passType.icon,
				active: !passType.active
			});
			upsertPassType(updated);
			await refreshPublicBookingContents();
		} catch (error) {
			console.error('Failed to toggle pass type', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ändra status',
				description: 'Försök igen senare.'
			});
		} finally {
			setSaving(id, false);
		}
	}

	async function handleDelete(passType: BookingContent) {
		const id = passType.id;
		try {
			const result = await deleteBookingContent(id);
			if (result.deleted) {
				passTypes = passTypes.filter((item) => item.id !== id);
				const { [id]: _removedKind, ...remainingKinds } = draftKinds;
				const { [id]: _removedIcon, ...remainingIcons } = draftIcons;
				const { [id]: _removedError, ...remainingErrors } = rowErrors;
				draftKinds = remainingKinds;
				draftIcons = remainingIcons;
				rowErrors = remainingErrors;
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Passtyp borttagen',
					description: 'Den valda passtypen är borttagen.'
				});
			} else if (result.deactivated && result.data && 'kind' in result.data) {
				upsertPassType(result.data as BookingContent);
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Passtyp inaktiverad',
					description: 'Den används i historiska bokningar och togs därför bort från nya val.'
				});
			}
			await refreshPublicBookingContents();
		} catch (error) {
			console.error('Failed to delete pass type', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort',
				description: 'Försök igen senare.'
			});
		}
	}

	function deleteDescription(passType: BookingContent) {
		const count = passType.bookingsCount ?? 0;
		if (count > 0) {
			return `"${passType.kind}" används i ${count} bokningar och kommer därför att inaktiveras.`;
		}
		return `Ta bort "${passType.kind}"?`;
	}
</script>

{#if !isAdmin}
	<div class="border-gray/60 rounded border bg-white/40 p-4 text-gray-700">
		Du behöver administratörsbehörighet för att hantera passtyper.
	</div>
{:else}
	<div class="space-y-6">
		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4">
				<h3 class="text-text text-lg font-semibold">Lägg till passtyp</h3>
				<p class="text-sm text-gray-600">Aktiva passtyper visas när nya bokningar skapas.</p>
			</div>

			<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start">
				<Input
					label="Namn"
					name="kind"
					bind:value={kind}
					placeholder="Ex. Weightlifting"
					errors={formErrors}
				/>
				<Dropdown
					id="pass-type-icon"
					label="Ikon"
					options={iconOptions}
					bind:selectedValue={icon}
				/>
			</div>

			<div
				class="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-end md:gap-4"
			>
				<div>
					<Checkbox id="pass-type-active" label="Aktiv" name="active" bind:checked={active} />
				</div>
				<Button text="Spara passtyp" iconLeft="Plus" small on:click={handleCreate} />
			</div>
		</section>

		<section class="border-gray/60 rounded border bg-white/40 p-4 shadow-sm">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-text text-lg font-semibold">Befintliga passtyper</h3>
				{#if isLoading}
					<span class="text-sm text-gray-600">Hämtar...</span>
				{:else if loadError}
					<span class="text-sm text-red-600">{loadError}</span>
				{/if}
			</div>

			{#if passTypes.length === 0 && !isLoading}
				<p class="text-sm text-gray-600">Inga passtyper tillagda ännu.</p>
			{:else}
				<div class="divide-gray/40 border-gray/40 divide-y rounded border bg-white/30">
					{#each passTypes as passType}
						{@const id = passType.id}
						<div class="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between">
							<div class="min-w-0 flex-1">
								<div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
									<Input
										label="Namn"
										name={`pass-type-${id}`}
										bind:value={draftKinds[id]}
										errors={rowErrors[id] ? { [`pass-type-${id}`]: rowErrors[id] } : {}}
									/>
									<Dropdown
										id={`pass-type-${id}-icon`}
										label="Ikon"
										options={iconOptions}
										bind:selectedValue={draftIcons[id]}
									/>
								</div>

								<div class="flex flex-wrap items-center gap-2 text-xs text-gray-600">
									<span>Status: {passType.active ? 'Aktiv' : 'Inaktiv'}</span>
									<span>·</span>
									<span>{passType.bookingsCount ?? 0} bokningar</span>
									{#if passType.createdAt}
										<span>· Skapad {new Date(passType.createdAt).toLocaleDateString('sv-SE')}</span>
									{/if}
								</div>
							</div>

							<div class="flex shrink-0 flex-wrap items-center gap-3 md:pt-8">
								<Checkbox
									id={`pass-type-active-${id}`}
									name={`pass-type-active-${id}`}
									label="Aktiv"
									checked={Boolean(passType.active)}
									on:change={() => handleToggleActive(passType)}
								/>
								<Button
									text={savingIds[id] ? 'Sparar...' : 'Spara'}
									iconLeft="Save"
									variant="secondary"
									small
									disabled={Boolean(savingIds[id])}
									on:click={() => handleSave(passType)}
								/>
								<Button
									text={passType.bookingsCount ? 'Inaktivera' : 'Ta bort'}
									iconLeft="Trash"
									variant="danger-outline"
									small
									confirmOptions={{
										title: passType.bookingsCount ? 'Inaktivera passtyp' : 'Ta bort passtyp',
										description: deleteDescription(passType),
										actionLabel: passType.bookingsCount ? 'Inaktivera' : 'Ta bort',
										action: () => handleDelete(passType)
									}}
								/>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}
