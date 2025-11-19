<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { confirm } from '$lib/actions/confirm';

	type WeeklySlot = {
		id: number | null;
		userId: number | null;
		weekday: number;
		start_time?: string;
		end_time?: string;
		from?: string;
		to?: string;
	};

	type EditableSlot = {
		id: number | null;
		userId: number | null;
		weekday: number;
		start_time: string;
		end_time: string;
	};

	let {
		weeklyAvailability = [],
		canEdit = false,
		userId = null
	} = $props<{
		weeklyAvailability?: WeeklySlot[];
		canEdit?: boolean;
		userId?: number | null;
	}>();

	let editing = $state(false);
	let fullWeekAvailability = $state<EditableSlot[]>([]);
	const dispatch = createEventDispatcher<{ save: EditableSlot[] }>();

	const weekdays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

	$effect(() => {
		fullWeekAvailability = Array.from({ length: 7 }, (_, i) => {
			const weekday = i === 6 ? 0 : i + 1; // DB: 1..6,0 (Sun=0)
			const match = weeklyAvailability.find((d) => d.weekday === weekday);
			return {
				id: match?.id ?? null,
				userId,
				weekday,
				start_time: match?.start_time || match?.from || '',
				end_time: match?.end_time || match?.to || ''
			};
		});
	});

	function weekdayLabel(weekday: number) {
		return weekdays[weekday === 0 ? 6 : weekday - 1];
	}

	function checkAvailableWholeDayByIndex(i: number) {
		fullWeekAvailability[i] = {
			...fullWeekAvailability[i],
			start_time: '',
			end_time: ''
		};

		fullWeekAvailability = [...fullWeekAvailability];
	}

	function markUnavailableWholeDayByIndex(i: number) {
		fullWeekAvailability[i] = {
			...fullWeekAvailability[i],
			start_time: '00:00',
			end_time: '00:00'
		};

		fullWeekAvailability = [...fullWeekAvailability];
	}

	function timeValue(time?: string) {
		if (!time) return '';
		const trimmed = time.trim();
		if (!trimmed) return '';
		const [hour = '00', minute = '00'] = trimmed.split(':');
		return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
	}

	function isAvailableAllDay(slot: EditableSlot) {
		const start = slot.start_time?.trim();
		const end = slot.end_time?.trim();
		return !start && !end;
	}

	function isUnavailableAllDay(slot: EditableSlot) {
		return timeValue(slot.start_time) === '00:00' && timeValue(slot.end_time) === '00:00';
	}

	function timelineLeft(time?: string) {
		if (!time) return 0;
		const [hour = '0'] = time.split(':');
		const parsed = Number.parseInt(hour, 10);
		return Math.max(0, (parsed - 5) / 15) * 100;
	}

	function timelineWidth(start?: string, end?: string) {
		if (!start || !end) return 100;
		const startHour = Number.parseInt(start.split(':')[0] ?? '0', 10);
		const endHour = Number.parseInt(end.split(':')[0] ?? '0', 10);
		const span = Math.max(0, endHour - startHour);
		return Math.min(1, span / 15) * 100;
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between gap-2">
		<div class="flex items-center gap-2">
			<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
				<Icon icon="Calendar" size="14px" />
			</div>
			<h3 class="text-lg font-semibold text-text">Veckoschema</h3>
		</div>

		{#if canEdit}
			{#if editing}
				<Button
					text="Spara schema"
					on:click={() => {
						editing = false;
						const payload = fullWeekAvailability.map((day) => ({ ...day }));
						dispatch('save', payload);
					}}
				/>
			{:else}
				<Button text="Redigera" on:click={() => (editing = true)} />
			{/if}
		{/if}
	</div>

	<!-- Mobile layout -->
	<div class="space-y-3 md:hidden">
		{#each fullWeekAvailability as day, i}
			<div class="rounded-sm border border-gray-200 p-3 shadow-xs">
				<div class="flex items-center justify-between">
					<div class="text-sm font-semibold text-gray-700">{weekdayLabel(day.weekday)}</div>
					{#if editing && canEdit}
						<div class="flex items-center gap-3">
							{#if isAvailableAllDay(day)}
								<button
									use:confirm={{
										title: 'Ej tillgänglig hela dagen',
										description: `Vill du markera ${weekdayLabel(
											day.weekday
										)}ar som ej tillgänglig hela dagen?`,
										action: () => markUnavailableWholeDayByIndex(i)
									}}
									class="flex items-center gap-1 text-xs font-semibold text-error hover:text-error-hover"
									aria-label="Ej tillgänglig hela dagen"
								>
									<Icon icon="CalendarCross" size="14" />
									<span>Ej tillgänglig</span>
								</button>
							{:else}
								<button
									use:confirm={{
										title: 'Tillgänglig hela dagen',
										description: `Vill du markera ${weekdayLabel(day.weekday)}ar som tillgänglig hela dagen?`,
										action: () => checkAvailableWholeDayByIndex(i)
									}}
									class="flex items-center gap-1 text-xs font-semibold text-success hover:text-success-hover"
									aria-label="Tillgänglig hela dagen"
								>
									<Icon icon="CalendarCheck" size="14" />
									<span>Hela dagen</span>
								</button>
							{/if}
						</div>
					{/if}
				</div>

				{#if canEdit}
					<div class="mt-3 grid gap-3 text-sm">
						<div class="grid gap-1">
							<span class="text-xs font-medium text-gray-500">Från</span>
							<input
								type="time"
								step="900"
								class="w-full rounded border px-2 py-1 text-sm"
								bind:value={day.start_time}
								disabled={!editing}
							/>
						</div>
						<div class="grid gap-1">
							<span class="text-xs font-medium text-gray-500">Till</span>
							<input
								type="time"
								step="900"
								class="w-full rounded border px-2 py-1 text-sm"
								bind:value={day.end_time}
								disabled={!editing}
							/>
						</div>
					</div>
				{:else}
					<div class="mt-2 text-sm text-gray-600">
						{#if day.start_time && day.end_time}
							{#if isUnavailableAllDay(day)}
								Ej tillgänglig
							{:else}
								{timeValue(day.start_time)} – {timeValue(day.end_time)}
							{/if}
						{:else}
							Ej tillgänglig
						{/if}
					</div>
				{/if}

				<div class="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-error/20">
					{#if day.start_time && day.end_time}
						<div
							class="absolute inset-y-0 bg-green"
							style="
								left: {timelineLeft(day.start_time)}%;
								width: {timelineWidth(day.start_time, day.end_time)}%;
							"
						/>
					{:else}
						<div class="absolute inset-0 bg-green opacity-60" />
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Desktop layout -->
	<div class="hidden md:block">
		<div class="ml-[343px] hidden justify-between text-xs text-gray-500 lg:flex">
			{#each [5, 8, 11, 14, 17, 20] as h}
				<span>{h}</span>
			{/each}
		</div>

		<div class="overflow-x-auto">
			<div
				class="grid min-w-[640px] gap-x-4 gap-y-4"
				style="grid-template-columns: 1px 1px 45px 1px  90px 1px 90px 1fr;"
			>
				{#each fullWeekAvailability as day, i}
					{#if editing}
						<div class="flex items-center gap-2">
							{#if isAvailableAllDay(day)}
								<button
									use:confirm={{
										title: 'Ej tillgänglig hela dagen',
										description: `Vill du markera ${weekdayLabel(
											day.weekday
										)}ar som ej tillgänglig hela dagen?`,
										action: () => markUnavailableWholeDayByIndex(i)
									}}
									class="cursor-pointer text-error transition hover:text-error-hover"
									aria-label="Ej tillgänglig hela dagen"
								>
									<Icon icon="CalendarCross" size="18" />
								</button>
							{:else}
								<button
									use:confirm={{
										title: 'Tillgänglig hela dagen',
										description: `Vill du markera ${weekdayLabel(day.weekday)}ar som tillgänglig hela dagen?`,
										action: () => checkAvailableWholeDayByIndex(i)
									}}
									class="cursor-pointer text-success transition hover:text-success-hover"
									aria-label="Tillgänglig hela dagen"
								>
									<Icon icon="CalendarCheck" size="18" />
								</button>
							{/if}
						</div>
					{:else}
						<span></span>
					{/if}
					<span></span>
					<div class="flex items-center text-sm font-medium text-gray-700">
						{weekdays[day.weekday === 0 ? 6 : day.weekday - 1]}
					</div>
					<span></span>
					{#if canEdit}
						<input
							type="time"
							step="900"
							class="w-full rounded border px-2 py-1 text-sm"
							bind:value={day.start_time}
							disabled={!editing}
						/>
						<div class="flex items-center justify-center text-sm">–</div>
						<input
							type="time"
							step="900"
							class="w-full rounded border px-2 py-1 text-sm"
							bind:value={day.end_time}
							disabled={!editing}
						/>
					{:else}
						<div class="col-span-3 flex items-center text-sm text-gray-500">
							{#if day.start_time && day.end_time}
								{#if isUnavailableAllDay(day)}
									Ej tillgänglig
								{:else}
									{timeValue(day.start_time)} – {timeValue(day.end_time)}
								{/if}
							{:else}
								Ej tillgänglig
							{/if}
						</div>
					{/if}

					<div class="hidden h-full items-center lg:flex">
						<div class="relative h-4 w-full overflow-hidden rounded-sm bg-error/20">
							{#if day.start_time && day.end_time}
								<div
									class="absolute bottom-0 top-0 bg-green"
									style="
										left: {timelineLeft(day.start_time)}%;
										width: {timelineWidth(day.start_time, day.end_time)}%;
									"
								/>
							{:else}
								<div class="absolute bottom-0 top-0 w-full bg-green" />
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
