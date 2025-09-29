<script lang="ts">
	import { get } from 'svelte/store';
	import { onMount } from 'svelte';

	import Button from '../../../bits/button/Button.svelte';
	import DropdownCheckbox from '../../../bits/dropdown-checkbox/DropdownCheckbox.svelte';
	import Dropdown from '../../../bits/dropdown/Dropdown.svelte';
	import Input from '../../../bits/Input/Input.svelte';
	import TextArea from '../../../bits/textarea/TextArea.svelte';
	import { user } from '$lib/stores/userStore';
	import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
	import { capitalizeFirstLetter } from '$lib/helpers/generic/genericHelpers';

	export let bookingObject: {
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
		const res = await fetch('/api/bookings/check-repeat-meeting', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date: bookingObject.date,
				time: bookingObject.time,
				endTime: bookingObject.endTime, // ✅ ADD THIS
				user_ids: bookingObject.user_ids,
				repeatWeeks: bookingObject.repeatWeeks
			})
		});

		const data = await res.json();

		if (data.success && data.repeatedBookings) {
			repeatedBookings = data.repeatedBookings.map((week) => ({
				...week,
				selectedTime:
					week.conflict && week.suggestedTimes.length > 0 ? week.suggestedTimes[0] : week.time
			}));
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
</script>

<!-- Booking Meeting UI -->
<div
	class="flex flex-col gap-4 rounded-lg border border-dashed border-gray-bright bg-gray-bright/10 p-6"
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
			<label for="date" class="text-sm font-medium text-gray">Datum</label>
			<input
				type="date"
				id="date"
				bind:value={bookingObject.date}
				class={`w-full rounded-lg border p-2 text-gray ${errors.date ? 'border-red-500' : ''}`}
			/>
			{#if errors.date}
				<p class="mt-1 text-sm text-red-500">{errors.date}</p>
			{/if}
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="time" class="text-sm font-medium text-gray">Starttid</label>
			<input
				type="time"
				id="time"
				bind:value={bookingObject.time}
				class={`w-full rounded-lg border p-2 text-gray ${errors.time ? 'border-red-500' : ''}`}
			/>
			{#if errors.time}
				<p class="mt-1 text-sm text-red-500">{errors.time}</p>
			{/if}
		</div>
		<div>
			<label for="endTime" class="text-sm font-medium text-gray">Sluttid</label>
			<input
				type="time"
				id="endTime"
				bind:value={bookingObject.endTime}
				class={`w-full rounded-lg border p-2 text-gray ${errors.endTime ? 'border-red-500' : ''}`}
			/>
			{#if errors.endTime}
				<p class="mt-1 text-sm text-red-500">{errors.endTime}</p>
			{/if}
		</div>
	</div>

	<!-- Repeat Meeting (only if meeting) -->
	{#if isMeeting}
		<div class="flex flex-col gap-2">
			<label class="flex items-center gap-2 text-sm font-medium text-gray">
				<input type="checkbox" bind:checked={bookingObject.repeat} class="h-4 w-4" />
				Upprepa detta möte
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
							<div class="mb-2 rounded-sm border border-red bg-red/10 p-3">
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

									{#if week.suggestedTimes?.length > 0}
										<div class="mt-2">
											<Dropdown
												label="Välj alternativ tid"
												placeholder="Tillgängliga tider"
												id={`week-${week.week}-time`}
												options={week.suggestedTimes.map((t) => ({ label: t, value: t }))}
												bind:selectedValue={week.selectedTime}
											/>
										</div>
									{/if}

									<div class="mt-2 flex gap-2">
										<Button
											text="Lös"
											variant="primary"
											small
											on:click={() => resolveConflict(week.week)}
										/>
										<Button
											text="Ta bort vecka"
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
							<div class="mb-1 rounded-sm border border-green bg-green-bright/10 p-2">
								{week.date}, kl {week.selectedTime}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

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
