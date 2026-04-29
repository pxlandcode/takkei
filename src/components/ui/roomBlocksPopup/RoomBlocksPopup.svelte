<script lang="ts">
	import { onMount } from 'svelte';
	import { Datepicker } from '@pixelcode_/blocks/components';

	import Button from '../../bits/button/Button.svelte';
	import Input from '../../bits/Input/Input.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import type {
		RoomBlockMutationPayload,
		RoomBlockRecord
	} from '$lib/services/api/roomBlockService';
	import {
		createRoomBlocks,
		deleteRoomBlock,
		listRoomBlocks,
		updateRoomBlock
	} from '$lib/services/api/roomBlockService';

	type LocationRoom = {
		id: number;
		name: string;
		active: boolean;
		halfHourStart?: boolean;
		half_hour_start?: boolean;
	};

	type LocationShape = {
		id: number;
		name: string;
		rooms?: LocationRoom[];
	};

	type FormState = {
		roomId: number | string | null;
		startDate: string;
		startTime: string;
		endDate: string;
		endTime: string;
		reason: string;
		repeatWeekly: boolean;
		repeatUntil: string;
	};

	type ServiceError = Error & {
		fieldErrors?: Record<string, string>;
	};

	export let location: LocationShape;

	const stockholmPartsFormatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Stockholm',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const datepickerOptions = {
		dateFormat: 'yyyy-MM-dd'
	} as const;

	let roomBlocks: RoomBlockRecord[] = [];
	let loading = false;
	let saving = false;
	let editingId: number | null = null;
	let errors: Record<string, string> = {};
	let roomOptions: Array<LocationRoom & { label: string }> = [];
	let allowedMinute: '00' | '30' | null = null;
	let timeInputMin = '00:00';
	let timeInputStep = 1800;

	function roomStartsOnHalfHour(room: LocationRoom | null | undefined) {
		return Boolean(room?.halfHourStart ?? room?.half_hour_start ?? false);
	}

	function findRoomById(roomId: FormState['roomId']) {
		return roomOptions.find((room) => String(room.id) === String(roomId)) ?? null;
	}

	function allowedMinuteForRoomId(roomId: FormState['roomId']) {
		const room = findRoomById(roomId);
		return room ? (roomStartsOnHalfHour(room) ? '30' : '00') : null;
	}

	function normalizeTimeToAllowedMinute(value: string, allowedMinute: '00' | '30' | null) {
		if (!value || !allowedMinute) return value;

		const [hoursString] = value.split(':');
		const hours = Number(hoursString);

		if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
			return value;
		}

		return `${String(hours).padStart(2, '0')}:${allowedMinute}`;
	}

	function getStockholmDateParts(value: string | Date) {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) {
			return null;
		}

		const formattedParts = stockholmPartsFormatter.formatToParts(date);
		let year = '';
		let month = '';
		let day = '';
		let hour = '';
		let minute = '';

		for (const part of formattedParts) {
			if (part.type === 'year') year = part.value;
			if (part.type === 'month') month = part.value;
			if (part.type === 'day') day = part.value;
			if (part.type === 'hour') hour = part.value;
			if (part.type === 'minute') minute = part.value;
		}

		if (!year || !month || !day) return null;

		return {
			date: `${year}-${month}-${day}`,
			time: hour && minute ? `${hour}:${minute}` : ''
		};
	}

	function getTodayStockholm() {
		return getStockholmDateParts(new Date())?.date ?? '';
	}

	function defaultRoomId() {
		return roomOptions.find((room) => room.active)?.id ?? roomOptions[0]?.id ?? null;
	}

	function normalizeFormTimes(nextForm: FormState): FormState {
		const nextAllowedMinute = allowedMinuteForRoomId(nextForm.roomId);

		return {
			...nextForm,
			startTime: normalizeTimeToAllowedMinute(nextForm.startTime, nextAllowedMinute),
			endTime: normalizeTimeToAllowedMinute(nextForm.endTime, nextAllowedMinute)
		};
	}

	function handleRoomChange(event: Event) {
		const roomId = (event.currentTarget as HTMLSelectElement).value;
		form = normalizeFormTimes({
			...form,
			roomId
		});
	}

	function handleTimeChange(field: 'startTime' | 'endTime') {
		const normalized = normalizeTimeToAllowedMinute(form[field], allowedMinute);
		if (normalized !== form[field]) {
			form = {
				...form,
				[field]: normalized
			};
		}
	}

	function createEmptyForm(): FormState {
		const today = getTodayStockholm();
		return {
			roomId: defaultRoomId(),
			startDate: today,
			startTime: '',
			endDate: today,
			endTime: '',
			reason: '',
			repeatWeekly: false,
			repeatUntil: ''
		};
	}

	let form: FormState = createEmptyForm();

	$: roomOptions = [...(location?.rooms ?? [])]
		.map((room) => ({
			...room,
			label: `${room.name}${room.active ? '' : ' (inaktivt)'}`
		}))
		.sort((left, right) => left.name.localeCompare(right.name, 'sv'));

	$: allowedMinute = allowedMinuteForRoomId(form.roomId);
	$: timeInputMin = allowedMinute === '30' ? '00:30' : '00:00';
	$: timeInputStep = allowedMinute ? 3600 : 1800;

	$: if (editingId === null && !form.roomId && roomOptions.length > 0) {
		form = normalizeFormTimes({ ...form, roomId: defaultRoomId() });
	}

	async function loadBlocks() {
		loading = true;
		try {
			roomBlocks = await listRoomBlocks(location.id);
		} catch (error) {
			console.error('Failed to load room blocks', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte hämta blockeringar',
				description: 'Försök igen om en stund.'
			});
		} finally {
			loading = false;
		}
	}

	function resetForm() {
		editingId = null;
		errors = {};
		form = normalizeFormTimes(createEmptyForm());
	}

	function startEdit(roomBlock: RoomBlockRecord) {
		const start = getStockholmDateParts(roomBlock.startTime);
		const end = getStockholmDateParts(roomBlock.endTime);
		errors = {};
		editingId = roomBlock.id;
		form = normalizeFormTimes({
			roomId: roomBlock.roomId,
			startDate: start?.date ?? '',
			startTime: start?.time ?? '',
			endDate: end?.date ?? '',
			endTime: end?.time ?? '',
			reason: roomBlock.reason ?? '',
			repeatWeekly: false,
			repeatUntil: ''
		});
	}

	function basePayload(): Omit<RoomBlockMutationPayload, 'repeatWeekly' | 'repeatUntil'> {
		return {
			roomId: Number(form.roomId),
			locationId: location.id,
			startDate: form.startDate,
			startTime: form.startTime,
			endDate: form.endDate,
			endTime: form.endTime,
			reason: form.reason.trim() || null
		};
	}

	async function submit() {
		saving = true;
		errors = {};

		try {
			if (editingId) {
				await updateRoomBlock(editingId, basePayload());
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Blockeringen uppdaterades',
					description: `${location.name} har uppdaterats.`
				});
			} else {
				await createRoomBlocks({
					...basePayload(),
					repeatWeekly: form.repeatWeekly,
					repeatUntil: form.repeatWeekly ? form.repeatUntil || null : null
				});
				addToast({
					type: AppToastType.SUCCESS,
					message: 'Blockeringen skapades',
					description: `${location.name} har uppdaterats.`
				});
			}

			resetForm();
			await loadBlocks();
		} catch (error) {
			console.error('Failed to save room block', error);
			const serviceError = error as ServiceError;
			errors = serviceError.fieldErrors ?? {};
			addToast({
				type: AppToastType.CANCEL,
				message: editingId ? 'Kunde inte uppdatera blockeringen' : 'Kunde inte skapa blockeringen',
				description: serviceError.message || 'Kontrollera formuläret och försök igen.'
			});
		} finally {
			saving = false;
		}
	}

	async function remove(roomBlockId: number) {
		try {
			await deleteRoomBlock(roomBlockId);
			if (editingId === roomBlockId) {
				resetForm();
			}
			await loadBlocks();
			addToast({
				type: AppToastType.SUCCESS,
				message: 'Blockeringen togs bort',
				description: `${location.name} har uppdaterats.`
			});
		} catch (error) {
			console.error('Failed to delete room block', error);
			addToast({
				type: AppToastType.CANCEL,
				message: 'Kunde inte ta bort blockeringen',
				description: error instanceof Error ? error.message : 'Försök igen om en stund.'
			});
		}
	}

	function formatRoomBlockRange(roomBlock: RoomBlockRecord) {
		const start = getStockholmDateParts(roomBlock.startTime);
		const end = getStockholmDateParts(roomBlock.endTime);
		if (!start || !end) return 'Ogiltig tid';

		if (start.date === end.date) {
			return `${start.date} kl. ${start.time} - ${end.time}`;
		}

		return `${start.date} kl. ${start.time} - ${end.date} kl. ${end.time}`;
	}

	onMount(loadBlocks);
</script>

<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
	<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
		<div class="mb-4 flex items-start justify-between gap-3">
			<div>
				<h3 class="text-lg font-semibold text-gray-900">
					{editingId ? 'Redigera blockering' : 'Ny blockering'}
				</h3>
				<p class="text-sm text-gray-500">{location.name}</p>
			</div>
			{#if editingId}
				<Button text="Avbryt" small variant="secondary" on:click={resetForm} />
			{/if}
		</div>

		{#if roomOptions.length === 0}
			<p class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
				Det finns inga rum att blockera för denna plats.
			</p>
		{:else}
			<div class="mb-4">
				<label for="room-block-room" class="mb-2 block text-sm font-medium">Rum</label>
				<select
					id="room-block-room"
					value={form.roomId ?? ''}
					on:change={handleRoomChange}
					class="w-full rounded border border-gray-300 bg-white px-3 py-2 text-black focus:border-gray-500 focus:outline-hidden"
				>
					<option value="">Välj rum</option>
					{#each roomOptions as room}
						<option value={room.id}>{room.label}</option>
					{/each}
				</select>
				{#if errors.roomId}
					<p class="mt-1 text-sm text-red-500">{errors.roomId}</p>
				{/if}
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<div class="flex flex-col gap-1">
					<p class="mb-2 block text-sm font-medium">Startdatum</p>
					<Datepicker
						bind:value={form.startDate}
						options={datepickerOptions}
						placeholder="Välj startdatum"
						class="border-gray !h-[42px] rounded border bg-white text-sm text-black transition-colors duration-150 focus-visible:outline-blue-500"
					/>
					{#if errors.startDate}
						<p class="text-sm text-red-500">{errors.startDate}</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<label class="mb-2 block text-sm font-medium" for="room-block-start-time">Starttid</label>
					<input
						id="room-block-start-time"
						bind:value={form.startTime}
						on:change={() => handleTimeChange('startTime')}
						type="time"
						min={timeInputMin}
						step={timeInputStep}
						class="h-[42px] w-full rounded border border-gray-300 bg-white px-3 text-sm text-black transition-colors duration-150 focus:border-gray-500 focus:outline-hidden"
					/>
					{#if errors.startTime}
						<p class="text-sm text-red-500">{errors.startTime}</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<p class="mb-2 block text-sm font-medium">Slutdatum</p>
					<Datepicker
						bind:value={form.endDate}
						options={datepickerOptions}
						placeholder="Välj slutdatum"
						class="border-gray !h-[42px] rounded border bg-white text-sm text-black transition-colors duration-150 focus-visible:outline-blue-500"
					/>
					{#if errors.endDate}
						<p class="text-sm text-red-500">{errors.endDate}</p>
					{/if}
				</div>

				<div class="flex flex-col gap-1">
					<label class="mb-2 block text-sm font-medium" for="room-block-end-time">Sluttid</label>
					<input
						id="room-block-end-time"
						bind:value={form.endTime}
						on:change={() => handleTimeChange('endTime')}
						type="time"
						min={timeInputMin}
						step={timeInputStep}
						class="h-[42px] w-full rounded border border-gray-300 bg-white px-3 text-sm text-black transition-colors duration-150 focus:border-gray-500 focus:outline-hidden"
					/>
					{#if errors.endTime}
						<p class="text-sm text-red-500">{errors.endTime}</p>
					{/if}
				</div>
			</div>

			<Input
				bind:value={form.reason}
				name="reason"
				label="Orsak"
				placeholder="Valfri anledning"
				{errors}
			/>

			{#if !editingId}
				<div class="rounded border border-gray-200 bg-gray-50 p-3">
					<label class="flex items-center gap-2 text-sm font-medium text-gray-800">
						<input type="checkbox" bind:checked={form.repeatWeekly} class="h-4 w-4" />
						Upprepa varje vecka
					</label>

					{#if form.repeatWeekly}
						<div class="mt-3">
							<div class="flex flex-col gap-1">
								<p class="mb-2 block text-sm font-medium">Upprepa till och med</p>
								<Datepicker
									bind:value={form.repeatUntil}
									options={datepickerOptions}
									placeholder="Välj slutdatum"
									class="border-gray !h-[42px] rounded border bg-white text-sm text-black transition-colors duration-150 focus-visible:outline-blue-500"
								/>
								{#if errors.repeatUntil}
									<p class="text-sm text-red-500">{errors.repeatUntil}</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if errors._form}
				<p class="mt-3 text-sm text-red-500">{errors._form}</p>
			{/if}

			<div class="mt-4 flex justify-end">
				<Button
					text={editingId ? 'Uppdatera' : 'Skapa'}
					iconRight={editingId ? 'Save' : 'Plus'}
					disabled={saving}
					on:click={submit}
				/>
			</div>
		{/if}
	</section>

	<section class="rounded-lg border border-gray-200 bg-white p-4 shadow-xs">
		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900">Nuvarande och kommande blockeringar</h3>
			<p class="text-sm text-gray-500">Visar blockeringar där sluttiden inte har passerat.</p>
		</div>

		{#if loading}
			<p class="text-sm text-gray-500">Laddar blockeringar...</p>
		{:else if roomBlocks.length === 0}
			<p class="rounded border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
				Inga aktuella eller kommande blockeringar.
			</p>
		{:else}
			<div class="space-y-3">
				{#each roomBlocks as roomBlock}
					<div class="rounded-lg border border-gray-200 p-3">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="space-y-1">
								<h4 class="font-medium text-gray-900">{roomBlock.roomName}</h4>
								<p class="text-sm text-gray-700">{formatRoomBlockRange(roomBlock)}</p>
								{#if roomBlock.reason}
									<p class="text-sm text-gray-600">{roomBlock.reason}</p>
								{/if}
								{#if roomBlock.addedByName}
									<p class="text-xs text-gray-400">Senast sparad av {roomBlock.addedByName}</p>
								{/if}
							</div>

							<div class="flex items-center gap-2">
								<Button
									icon="Edit"
									variant="secondary"
									small
									on:click={() => startEdit(roomBlock)}
								/>
								<Button
									icon="Trash"
									variant="danger-outline"
									small
									confirmOptions={{
										title: 'Ta bort blockering?',
										description: 'Den här blockeringen tas bort permanent.',
										action: () => remove(roomBlock.id),
										actionLabel: 'Ta bort'
									}}
								/>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>
