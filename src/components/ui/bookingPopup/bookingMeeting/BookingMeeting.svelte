<script lang="ts">
	import { get } from 'svelte/store';
	import { afterUpdate, onDestroy, onMount } from 'svelte';

	import Button from '../../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import { user } from '$lib/stores/userStore';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';

	export let bookingObject: {
		id?: number | null;
		name?: string;
		text?: string;
		user_id?: number | null;
		user_ids?: number[];
		attendees?: number[];
		date: string;
		time: string;
		endTime: string;
		repeat: boolean;
		repeatWeeks?: number;
		emailBehavior?: { label: string; value: string };
	};

	export let users: { name: string; value: number }[] = [];
	export let isMeeting: boolean = true;
	export let repeatedBookings: any[] = [];
	export let selectedIsUnavailable: boolean = false;
	export let isEditing: boolean = false;
	export let errors: Record<string, string> = {};
	let endTimeLimit: string | null = null;
	let endTimeLimitMessage: string | null = null;
	let boundaryKey: string | null = null;
	let boundaryAbortController: AbortController | null = null;
	let isBoundaryLoading = false;

	function timeStringToMinutes(value?: string | null): number | null {
		if (!value) return null;
		const [hoursStr, minutesStr] = value.split(':');
		const hours = Number(hoursStr);
		const minutes = Number(minutesStr);
		if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
		return hours * 60 + minutes;
	}

	function minutesToTimeString(totalMinutes: number): string {
		const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
		const hours = Math.floor(normalized / 60)
			.toString()
			.padStart(2, '0');
		const minutes = (normalized % 60).toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	}

	function getBaseDurationMinutes(): number | null {
		const start = timeStringToMinutes(bookingObject.time);
		const end = timeStringToMinutes(bookingObject.endTime);
		if (start === null || end === null || end <= start) return null;
		return end - start;
	}

	function clampWeekTimes(week: any) {
		if (!week) return;
		if (!week.selectedTime) {
			week.selectedTime = week.time ?? bookingObject.time;
		}

		const duration = getBaseDurationMinutes();
		let startMinutes = timeStringToMinutes(week.selectedTime);
		if (startMinutes === null) {
			week.selectedTime = bookingObject.time;
			startMinutes = timeStringToMinutes(week.selectedTime);
		}

		let endCandidate = week.selectedEndTime ?? bookingObject.endTime;
		let endMinutes = timeStringToMinutes(endCandidate);

		if (startMinutes !== null && (endMinutes === null || endMinutes <= startMinutes)) {
			if (duration !== null) {
				endMinutes = startMinutes + duration;
				endCandidate = minutesToTimeString(endMinutes);
			} else if (bookingObject.endTime && bookingObject.endTime > week.selectedTime) {
				endCandidate = bookingObject.endTime;
				endMinutes = timeStringToMinutes(endCandidate);
			} else if (startMinutes !== null) {
				endMinutes = startMinutes + 30;
				endCandidate = minutesToTimeString(endMinutes);
			}
		}

		const boundaryMinutes = timeStringToMinutes(week.nextBoundary);
		if (boundaryMinutes !== null && endMinutes !== null && endMinutes > boundaryMinutes) {
			endMinutes = boundaryMinutes;
			endCandidate = minutesToTimeString(endMinutes);
		}

		if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
			if (boundaryMinutes !== null && boundaryMinutes > startMinutes) {
				endMinutes = boundaryMinutes;
				endCandidate = minutesToTimeString(endMinutes);
			} else if (duration !== null) {
				endMinutes = startMinutes + duration;
				endCandidate = minutesToTimeString(endMinutes);
			}
		}

		if (endCandidate && week.selectedEndTime !== endCandidate) {
			week.selectedEndTime = endCandidate;
		}

		week.boundaryConflict =
			boundaryMinutes !== null && startMinutes !== null && boundaryMinutes <= startMinutes;
	}

	function handleWeekTimeChange(week: any) {
		clampWeekTimes(week);
	}

	if (!bookingObject.repeatWeeks) {
		bookingObject.repeatWeeks = 4;
	}

	onMount(() => {
		const currentUser = get(user);
		bookingObject.attendees = bookingObject.attendees ?? [];
		bookingObject.user_ids = bookingObject.user_ids ?? [...bookingObject.attendees];

		if (!isMeeting) {
			if (!isEditing) {
				if (currentUser?.id) {
					bookingObject.user_id = currentUser.id;
					bookingObject.attendees = [currentUser.id];
					bookingObject.user_ids = [currentUser.id];
				}
			} else {
				if ((!bookingObject.user_id || bookingObject.user_id === null) && currentUser?.id) {
					bookingObject.user_id = currentUser.id;
				}
				if (bookingObject.attendees.length === 0 && currentUser?.id) {
					bookingObject.attendees = [currentUser.id];
				}
				if (bookingObject.user_ids.length === 0 && currentUser?.id) {
					bookingObject.user_ids = [currentUser.id];
				}
			}
		}
	});

	function handleEmailBehaviorSelect(event: CustomEvent<string>) {
		bookingObject.emailBehavior = {
			value: event.detail,
			label: capitalizeFirstLetter(event.detail)
		};
	}

	function handleUserSelection(event) {
		bookingObject.attendees = [...event.detail.selected];
		bookingObject.user_ids = [...event.detail.selected];
		bookingObject.user_id = bookingObject.attendees?.[0] ?? null;
	}

	function onSelectAllUsers() {
		const selectedIds = users.map((user) => user.value);
		bookingObject.attendees = selectedIds;
		bookingObject.user_ids = selectedIds;
		bookingObject.user_id = selectedIds[0] ?? null;
	}

	function onDeSelectAllUsers() {
		bookingObject.attendees = [];
		bookingObject.user_ids = [];
		bookingObject.user_id = null;
	}
	async function checkRepeatAvailability() {
		const payload: Record<string, any> = {
			date: bookingObject.date,
			time: bookingObject.time,
			endTime: bookingObject.endTime, // ✅ ADD THIS
			user_ids: bookingObject.user_ids,
			repeatWeeks: bookingObject.repeatWeeks
		};
		if (isEditing) {
			const parsedId = Number(bookingObject.id);
			if (Number.isFinite(parsedId)) {
				payload.ignoreBookingId = parsedId;
			}
		}

		const res = await fetch('/api/bookings/check-repeat-meeting', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const data = await res.json();

		if (data.success && data.repeatedBookings) {
			repeatedBookings = data.repeatedBookings.map((week) => {
				const mapped = {
					...week,
					selectedTime: week.time ?? bookingObject.time,
					selectedEndTime: bookingObject.endTime
				};

				clampWeekTimes(mapped);

				if (mapped.boundaryConflict && week.suggestedTimes?.length) {
					const alternative = week.suggestedTimes.find((candidate: string) => {
						const candidateMinutes = timeStringToMinutes(candidate);
						const boundaryMinutes = timeStringToMinutes(week.nextBoundary);
						return (
							candidateMinutes !== null &&
							(boundaryMinutes === null || candidateMinutes < boundaryMinutes)
						);
					});

					if (alternative) {
						mapped.selectedTime = alternative;
						clampWeekTimes(mapped);
					}
				}

				return mapped;
			});
		} else {
			repeatedBookings = [];
		}
	}

	function ignoreConflict(weekNumber: number) {
		repeatedBookings = repeatedBookings.filter((w) => w.week !== weekNumber);
	}

	function resolveConflict(weekNumber: number) {
		repeatedBookings = repeatedBookings.map((w) =>
			w.week === weekNumber ? { ...w, conflict: false } : w
		);
	}

	function ignoreUserConflict(weekNumber: number, userId: number) {
		repeatedBookings = repeatedBookings.map((week) => {
			if (week.week !== weekNumber) return week;

			const ignoredSet = new Set(week.ignoredUserIds ?? []);
			ignoredSet.add(userId);

			const stillConflictsWith = week.conflictingUserIds.filter(
				(id: number) => !ignoredSet.has(id)
			);
			const stillHasConflict = stillConflictsWith.length > 0;

			return {
				...week,
				conflict: stillHasConflict,
				conflictingUserIds: stillConflictsWith,
				ignoredUserIds: Array.from(ignoredSet)
			};
		});
	}

	function getUserName(id: number): string {
		return users.find((u) => u.value === id)?.name ?? `ID ${id}`;
	}

	function removeUserFromBooking(userId: number) {
		bookingObject.attendees = bookingObject.attendees?.filter((id) => id !== userId);
		bookingObject.user_ids = bookingObject.user_ids?.filter((id) => id !== userId);
		if (bookingObject.user_id === userId) {
			bookingObject.user_id = bookingObject.attendees?.[0] ?? null;
		}
	}

	function removeUserFromWeekConflict(weekNumber: number, userId: number) {
		removeUserFromBooking(userId);
		repeatedBookings = repeatedBookings.map((w) => {
			if (w.week !== weekNumber) return w;

			const stillConflictsWith = w.conflictingUserIds.filter((id) => id !== userId);
			const newConflict = stillConflictsWith.length > 0;

			return {
				...w,
				conflict: newConflict,
				conflictingUserIds: stillConflictsWith
			};
		});
	}

	function collectRelevantUserIds(): number[] {
		const uniqueIds = new Set<number>();
		const addIfValid = (value: unknown) => {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) uniqueIds.add(parsed);
		};

		if (isMeeting) {
			(bookingObject.attendees ?? []).forEach(addIfValid);
		} else {
			(bookingObject.user_ids ?? []).forEach(addIfValid);
			addIfValid(bookingObject.user_id);
		}

		return Array.from(uniqueIds).sort((a, b) => a - b);
	}

	async function updateEndTimeLimit(userIds: number[], keySnapshot: string) {
		if (!bookingObject.date || !bookingObject.time) return;

		boundaryAbortController?.abort();
		const controller = new AbortController();
		boundaryAbortController = controller;

		isBoundaryLoading = true;
		try {
			const payload: Record<string, any> = {
				date: bookingObject.date,
				time: bookingObject.time,
				user_ids: userIds
			};
			if (isEditing) {
				const parsedId = Number(bookingObject.id);
				if (Number.isFinite(parsedId)) {
					payload.ignoreBookingId = parsedId;
				}
			}

			const res = await fetch('/api/bookings/next-boundary', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: controller.signal
			});

			if (!res.ok) {
				throw new Error('Failed to fetch next boundary');
			}

			const data = await res.json();
			if (controller.signal.aborted || boundaryKey !== keySnapshot) {
				return;
			}

			endTimeLimit = data.nextBoundary ?? null;

			if (endTimeLimit && bookingObject.endTime && bookingObject.endTime > endTimeLimit) {
				bookingObject.endTime = endTimeLimit;
			}

			if (endTimeLimit && endTimeLimit > bookingObject.time) {
				endTimeLimitMessage = `Nästa bokning startar ${endTimeLimit}. Sluttiden kan inte gå förbi detta.`;
			} else if (endTimeLimit && endTimeLimit <= bookingObject.time) {
				endTimeLimitMessage = `Vald starttid kolliderar med en annan bokning ${endTimeLimit}. Välj en annan starttid.`;
			} else {
				endTimeLimitMessage = null;
			}
		} catch (error) {
			if (controller.signal.aborted) return;
			console.error('❌ Failed to fetch meeting boundary', error);
			endTimeLimit = null;
			endTimeLimitMessage = null;
		} finally {
			if (!controller.signal.aborted && boundaryKey === keySnapshot) {
				isBoundaryLoading = false;
			}
		}
	}

	onDestroy(() => {
		boundaryAbortController?.abort();
	});

	$: {
		const userIds = collectRelevantUserIds();
		const hasInputs = bookingObject.date && bookingObject.time && userIds.length > 0;
		const nextKey = hasInputs
			? JSON.stringify([bookingObject.date, bookingObject.time, userIds])
			: null;

		if (nextKey === boundaryKey) {
			// no-op
		} else {
			boundaryKey = nextKey;
			if (!nextKey) {
				endTimeLimit = null;
				endTimeLimitMessage = null;
				boundaryAbortController?.abort();
				boundaryAbortController = null;
			} else {
				updateEndTimeLimit(userIds, nextKey);
			}
		}
	}

	$: {
		if (endTimeLimit && bookingObject.endTime && bookingObject.endTime > endTimeLimit) {
			bookingObject.endTime = endTimeLimit;
		}
	}

	afterUpdate(() => {
		if (!bookingObject.repeat || repeatedBookings.length === 0) return;
		repeatedBookings.forEach((week) => clampWeekTimes(week));
	});
</script>

<!-- Booking Meeting UI -->
<div
	class="border-gray-bright bg-gray-bright/10 flex flex-col gap-4 rounded-sm border border-dashed p-6"
>
	<!-- Name Input -->
	<Input
		label="Namn"
		name="name"
		type="text"
		placeholder="Ange namn på bokningen"
		bind:value={bookingObject.name}
		{errors}
	/>

	<!-- Description Text Area -->
	<TextArea
		label="Beskrivning"
		name="text"
		placeholder="Lägg till en beskrivning..."
		bind:value={bookingObject.text}
	/>

	<!-- Attendees Selection -->
	{#if isMeeting}
		<div class="flex flex-row gap-2">
			<DropdownCheckbox
				label="Deltagare"
				placeholder="Välj deltagare"
				id="users"
				options={users}
				maxNumberOfSuggestions={15}
				infiniteScroll={true}
				search
				bind:selectedValues={bookingObject.attendees}
				on:change={handleUserSelection}
				error={!!errors.attendees}
				errorMessage={errors.attendees}
			/>
			<div class="mt-6 flex flex-row gap-2">
				<Button
					icon="MultiCheck"
					variant="secondary"
					on:click={onSelectAllUsers}
					iconColor="green"
				/>
				<Button icon="Trash" iconColor="red" variant="secondary" on:click={onDeSelectAllUsers} />
			</div>
		</div>
	{/if}

	<!-- Date & Time -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="date" class="text-gray text-sm font-medium">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class={`text-gray w-full rounded-sm border p-2 ${errors.date ? 'border-red-500' : ''}`}
			/>
			{#if errors.date}
				<p class="mt-1 text-sm text-red-500">{errors.date}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="time" class="text-gray text-sm font-medium">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class={`text-gray w-full rounded-sm border p-2 ${errors.time ? 'border-red-500' : ''}`}
			/>
			{#if errors.time}
				<p class="mt-1 text-sm text-red-500">{errors.time}</p>
			{/if}
		</div>
		<div>
			<label for="endTime" class="text-gray text-sm font-medium">Sluttid</label>
			<input
				type="time"
				id="endTime"
				bind:value={bookingObject.endTime}
				max={endTimeLimit ?? undefined}
				class={`text-gray w-full rounded-sm border p-2 ${errors.endTime ? 'border-red-500' : ''}`}
			/>
			{#if errors.endTime}
				<p class="mt-1 text-sm text-red-500">{errors.endTime}</p>
			{:else if endTimeLimitMessage}
				<p class="text-gray mt-1 text-xs">
					{#if isBoundaryLoading}
						Kollar krockar...
					{:else}
						{endTimeLimitMessage}
					{/if}
				</p>
			{/if}
		</div>
	</div>

	<!-- Repeat Booking -->
	<div class="flex flex-col gap-2">
		<label class="text-gray flex items-center gap-2 text-sm font-medium">
			<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
			{#if isMeeting}
				Upprepa detta möte
			{:else}
				Upprepa denna bokning
			{/if}
		</label>

		{#if bookingObject.repeat}
			<Input
				label="Antal veckor framåt"
				name="repeatWeeks"
				type="number"
				bind:value={bookingObject.repeatWeeks}
				placeholder="Ex: 4"
				min="1"
				max="52"
				{errors}
			/>

			<Button
				text="Kontrollera"
				iconRight="MultiCheck"
				iconRightSize="16"
				variant="primary"
				full
				on:click={checkRepeatAvailability}
				disabled={!bookingObject.repeatWeeks}
			/>

			{#if repeatedBookings.length > 0}
				<div class="flex flex-col gap-2 rounded-sm border border-gray-300 bg-gray-50 p-4">
					{#if repeatedBookings.filter((b) => b.conflict).length > 0}
						<h3 class="flex items-center justify-between text-lg font-semibold">
							Konflikter
							<span class="text-sm text-gray-600">
								{repeatedBookings.filter((b) => b.conflict).length} konflikter /
								{repeatedBookings.length} veckor
							</span>
						</h3>
					{/if}

					<!-- Conflicts -->
					{#each repeatedBookings.filter((b) => b.conflict) as week}
						<div class="border-red bg-red/10 mb-2 rounded-sm border p-3">
							<div class="flex flex-col gap-1">
								<span class="font-semibold">
									{week.date}, kl {week.selectedTime}
								</span>

								{#if week.conflictingUserIds?.length > 0}
									<div class="mt-1 text-sm text-red-700">
										Konflikt med:
										<ul class="ml-4 list-disc">
											{#each week.conflictingUserIds as userId}
												<li class="flex items-center gap-2">
													{getUserName(userId)}
													<Button
														icon="Check"
														small
														variant="secondary"
														iconColor="success"
														iconSize="16"
														on:click={() => ignoreUserConflict(week.week, userId)}
													/>
													<Button
														icon="Close"
														small
														variant="cancel"
														iconColor="red"
														iconSize="16"
														on:click={() => removeUserFromWeekConflict(week.week, userId)}
													/>
												</li>
											{/each}
										</ul>
									</div>
								{/if}

								<div class="mt-2 grid grid-cols-2 gap-2">
									<div>
										<label class="text-gray text-xs font-semibold">Starttid</label>
										<input
											type="time"
											class="text-gray w-full rounded border p-2"
											bind:value={week.selectedTime}
											on:change={() => handleWeekTimeChange(week)}
										/>
									</div>
									<div>
										<label class="text-gray text-xs font-semibold">Sluttid</label>
										<input
											type="time"
											class="text-gray w-full rounded border p-2"
											min={week.selectedTime}
											max={week.nextBoundary ?? undefined}
											bind:value={week.selectedEndTime}
											on:change={() => handleWeekTimeChange(week)}
										/>
										{#if week.nextBoundary}
											<p class="text-gray mt-1 text-[11px]">Senast {week.nextBoundary}</p>
										{/if}
									</div>
								</div>

								{#if week.boundaryConflict}
									<p class="text-xs text-red-600">
										Starttid ligger efter nästa bokning {week.nextBoundary}. Välj en tidigare tid.
									</p>
								{/if}

								<div class="mt-2 flex gap-2">
									<Button
										text="Lös"
										variant="primary"
										small
										on:click={() => resolveConflict(week.week)}
									/>
									<Button
										text="Avboka vecka"
										variant="secondary"
										small
										on:click={() => ignoreConflict(week.week)}
									/>
								</div>
							</div>
						</div>
					{/each}

					<!-- Ready bookings -->
					<h3 class="text-lg font-semibold">Bokningar klara att bokas:</h3>
					{#each repeatedBookings.filter((b) => !b.conflict) as week}
						<div class="border-green bg-green-bright/10 mb-1 rounded-sm border p-2">
							{week.date}, kl {week.selectedTime}
							{#if week.selectedEndTime}
								&ndash; {week.selectedEndTime}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	{#if isMeeting}
		<OptionButton
			label="Bekräftelsemail"
			labelIcon="Mail"
			options={[
				{ value: 'none', label: 'Skicka inte' },
				{ value: 'send', label: 'Skicka direkt' },
				{ value: 'edit', label: 'Redigera innan' }
			]}
			bind:selectedOption={bookingObject.emailBehavior}
			on:select={handleEmailBehaviorSelect}
			size="small"
			full
		/>
	{/if}
</div>
