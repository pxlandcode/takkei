<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { user } from '$lib/stores/userStore';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';
	import Icon from '../../bits/icon-component/Icon.svelte';

	import {
		getTargetGoals,
		setYearGoal,
		setMonthGoal,
		getWeekGoals,
		setWeekGoal
	} from '$lib/services/api/targetGoalsService';

	import {
		splitYearToMonths,
		splitMonthToWeeks
	} from '$lib/helpers/allocGoalHelpers/allocGoalHelpers';
	import { debounce } from '$lib/utils/debounce';

	import MonthBarInput from '../targets/MonthBarInput.svelte';
	import WeekBarInput from '../targets/WeekBarInput.svelte';

	// ---- Local state ---------------------------------------------------------
	let ownerType: 'trainer' | 'location' = $state('trainer');
	let selectedUserId: number | null = $state(null);
	let selectedLocationId: number | null = $state(null);

	let year = $state(new Date().getFullYear());

	let isEditing = $state(false);

	// target kind matches new targets (1=trainer bookings, 2=location bookings)
	let targetKindId = $derived(ownerType === 'trainer' ? 1 : 2);

	// Active owner context
	let activeOwnerId: number | null = $state(null);

	// SERVER snapshot
	let persistedYearGoal: number | null = $state(null);
	let persistedMonthAnchors: { month: number; value: number }[] = $state([]);

	// DRAFT (local)
	let yearDraft: number | '' = $state(''); // numeric (or empty while editing)
	let monthDraftAnchors: { month: number; value: number }[] = $state([]); // local anchored months
	let monthInputs: (string | number)[] = $state(Array(13).fill('')); // 1..12; bound to inputs
	let editedMonths = $state(new Set<number>()); // months user has touched in this session

	// Derived
	let monthsView: { month: number; value: number; isAnchor: boolean }[] = $state([]);
	let yearTotal = $state(0);

	// Weeks (read-only preview)
	let showWeeksForMonth: number | null = $state(null);
	let weeksView: { week_start: string; week_end: string; value: number; isAnchor: boolean }[] =
		$state([]);

	// Weeks (expandable per month)
	let expandedMonths: number[] = $state([]); // which months have weeks expanded (array for reactivity)
	let weekDraftsByMonth: Record<
		number,
		{ week_start: string; week_end: string; value: number; isAnchor: boolean }[]
	> = $state({});
	let weekEditedByMonth: Record<number, Set<string>> = $state({}); // tracks edited weeks per month

	// Shared visual scale across rows — use the current max value only
	let scaleMaxDisplay = $derived(Math.max(1, ...monthsView.map((m) => m.value || 0)));

	// Safe Swedish month name helper that accepts 1..12
	function svMonthName(monthOneBased: number): string {
		if (!Number.isFinite(monthOneBased)) return '';
		return new Date(2000, monthOneBased - 1, 1).toLocaleDateString('sv-SE', { month: 'long' });
	}

	onMount(async () => {
		await Promise.all([fetchUsers(), fetchLocations()]);

		if (ownerType === 'trainer') {
			selectedUserId = Number($user?.id ?? null) || null;
			setActiveOwnerFromSelections();
			await loadAnchors();
		}
	});

	function setActiveOwnerFromSelections() {
		// Coerce dropdown values (which might be strings) to numbers
		const userIdNum = selectedUserId != null ? Number(selectedUserId) : null;
		const locationIdNum = selectedLocationId != null ? Number(selectedLocationId) : null;
		activeOwnerId = ownerType === 'trainer' ? userIdNum : locationIdNum;
	}

	function resetOwnerAndDraft() {
		selectedUserId = null;
		selectedLocationId = null;
		activeOwnerId = null;
		resetLocal();
	}

	/** Runs when switching between 'trainer' and 'location' */
	async function handleOwnerTypeChange(): Promise<void> {
		resetOwnerAndDraft();

		// If trainer mode, pick current user by default
		if (ownerType === 'trainer') {
			selectedUserId = Number($user?.id ?? null) || null;
			setActiveOwnerFromSelections();
			await loadAnchors();
		}
	}

	// ----------------- LOAD & INIT DRAFTS ------------------------------------
	async function loadAnchors() {
		if (!activeOwnerId) {
			resetLocal();
			return;
		}

		try {
			const payload = await getTargetGoals(ownerType, Number(activeOwnerId), year, targetKindId);
			persistedYearGoal = payload?.yearGoal == null ? null : Math.trunc(Number(payload.yearGoal));
			yearDraft = persistedYearGoal == null ? '' : persistedYearGoal;

			const lockedMonths = (payload?.months || []).filter((r: any) =>
				r?.is_anchor === undefined ? true : Boolean(r.is_anchor)
			);
			persistedMonthAnchors = lockedMonths.map((r: any) => ({
				month: Number(r.month),
				value: Math.trunc(Number(r.goal_value))
			}));

			// start draft as a COPY of persisted
			monthDraftAnchors = persistedMonthAnchors.map((a) => ({ ...a }));
			editedMonths.clear();

			recomputeFromDraft(); // also fills monthInputs
			weeksView = [];
			showWeeksForMonth = null;
		} catch (err) {
			addToast({ type: AppToastType.ERROR, message: 'Kunde inte hämta mål' });
			resetLocal();
			console.error(err);
		}
	}

	function resetLocal() {
		persistedYearGoal = null;
		persistedMonthAnchors = [];
		yearDraft = '';
		monthDraftAnchors = [];
		monthsView = [];
		monthInputs = Array(13).fill('');
		editedMonths.clear();
		weeksView = [];
		showWeeksForMonth = null;
		yearTotal = 0;
	}

	// ------------- RECOMPUTE (purely local, reactive) ------------------------
	function recomputeFromDraft() {
		const numericYearDraft = yearDraft === '' ? NaN : Number(yearDraft);
		const yearGoalValue = Number.isFinite(numericYearDraft) ? numericYearDraft : null;

		const result = splitYearToMonths({
			year,
			yearGoal: yearGoalValue, // can be null: then anchors define the distribution
			monthAnchors: monthDraftAnchors // [{month:1..12,value:number}]
		});

		monthsView = result.months;

		// If service returns no months (yearGoal missing and no anchors), show 12 zero-rows so UI stays usable.
		if (!monthsView?.length) {
			monthsView = Array.from({ length: 12 }, (_, i) => ({
				month: i + 1,
				value: 0,
				isAnchor: false
			}));
		}

		yearTotal = result.yearTotal ?? monthsView.reduce((s, m) => s + (m.value || 0), 0);

		// Sync inputs: anchors show anchor value, autos show computed
		for (const m of monthsView) {
			const anchor = monthDraftAnchors.find((x) => x.month === m.month);
			monthInputs[m.month] = String(anchor ? anchor.value : m.value);
		}
		monthInputs = monthInputs.slice(); // notify Svelte
	}

	// Debounced reactions to user typing
	const applyYearDraft = debounce(() => {
		recomputeFromDraft(); // keeps total fixed and redistributes unlocked months
	}, 100);

	const applyMonthDrafts = debounce(() => {
		if (!isEditing) return;

		let changed = false;

		// Only process months the user actually edited
		for (const m of editedMonths) {
			const raw = monthInputs[m];
			const txt = raw == null ? '' : String(raw);

			// Empty => remove local anchor (unlock)
			if (txt.trim() === '') {
				const idx = monthDraftAnchors.findIndex((a) => a.month === m);
				if (idx !== -1) {
					monthDraftAnchors.splice(idx, 1);
					changed = true;
				}
				continue;
			}

			// Otherwise, parse and upsert anchor
			const v = Number(txt);
			if (!Number.isFinite(v)) continue;

			const i = monthDraftAnchors.findIndex((a) => a.month === m);
			if (i >= 0) {
				if (monthDraftAnchors[i].value !== v) {
					monthDraftAnchors[i].value = v;
					changed = true;
				}
			} else {
				monthDraftAnchors.push({ month: m, value: v });
				changed = true;
			}
		}

		if (changed) recomputeFromDraft();
	}, 120);

	// ---------------- LOCK / UNLOCK (LOCAL) -----------------------------------
	function lockAllMonths() {
		monthDraftAnchors = monthsView.map(({ month, value }) => ({ month, value }));
		editedMonths = new Set(monthDraftAnchors.map((a) => a.month));
		recomputeFromDraft();
	}
	function unlockAllMonths() {
		monthDraftAnchors = [];
		editedMonths.clear();
		recomputeFromDraft();
	}
	function allLocked() {
		return monthsView.length > 0 && monthsView.every((m) => m.isAnchor);
	}
	function resetDistributionByDays() {
		monthDraftAnchors = [];
		editedMonths.clear();
		recomputeFromDraft();
	}

	// ----------------------- SAVE ALL (ONE CLICK) -----------------------------
	async function saveAll() {
		if (!activeOwnerId) {
			addToast({ type: AppToastType.CANCEL, message: 'Välj mottagare' });
			return;
		}
		try {
			// 1) Save year goal
			const yearValueToSave = yearDraft === '' ? 0 : Math.max(0, Math.trunc(Number(yearDraft)));
			await setYearGoal({
				ownerType,
				ownerId: Number(activeOwnerId),
				year,
				targetKindId,
				goalValue: yearValueToSave,
				title: `Årsmål ${year}`,
				description: ''
			});

			// 2) Save *every* month (persist what is currently shown in the UI)
			//    `monthsView` already contains the final values (anchors + auto).
			const monthPayloads = monthsView.map(({ month, value, isAnchor }) => ({
				ownerType,
				ownerId: Number(activeOwnerId),
				year,
				month, // 1..12
				targetKindId,
				goalValue: Math.max(0, Math.trunc(Number(value))),
				isAnchor,
				title: `Månadsmål ${year}-${String(month).padStart(2, '0')}`,
				description: ''
			}));

			// Save in parallel to speed things up
			await Promise.all(monthPayloads.map((p) => setMonthGoal(p)));

			// 3) Save week goals for expanded months
			const weekSavePromises: Promise<any>[] = [];
			for (const month of expandedMonths) {
				const weeks = weekDraftsByMonth[month] || [];
				for (const w of weeks) {
					weekSavePromises.push(
						setWeekGoal({
							ownerType,
							ownerId: Number(activeOwnerId),
							year,
							month,
							week_start: w.week_start,
							week_end: w.week_end,
							targetKindId,
							goalValue: Math.max(0, Math.trunc(Number(w.value))),
							isAnchor: w.isAnchor,
							title: `Veckomål ${w.week_start}`,
							description: ''
						})
					);
				}
			}
			await Promise.all(weekSavePromises);

			await loadAnchors(); // reload from DB (will now reflect all 12 months)
			// Reset week state
			expandedMonths = [];
			weekDraftsByMonth = {};
			weekEditedByMonth = {};
			isEditing = false;
			addToast({ type: AppToastType.SUCCESS, message: 'Mål sparade' });
		} catch (err) {
			addToast({ type: AppToastType.ERROR, message: 'Kunde inte spara mål' });
			console.error(err);
		}
	}

	function commitYear() {
		if (yearDraft === '') return; // allow clearing
		yearDraft = Math.max(0, Math.trunc(Number(yearDraft)));
		recomputeFromDraft();
	}

	function monthMaxCap(monthNo: number) {
		const current = monthsView.find((m) => m.month === monthNo)?.value ?? 0;
		const sumAnchOther = monthsView
			.filter((m) => m.month !== monthNo && m.isAnchor)
			.reduce((s, m) => s + m.value, 0);

		const numericYearDraft = yearDraft === '' ? NaN : Number(yearDraft);
		const yearTarget = Number.isFinite(numericYearDraft) ? numericYearDraft : yearTotal;

		// This month can take everything not already reserved by other anchors.
		const theoreticalMax = Math.max(0, Math.floor(yearTarget - sumAnchOther));
		return Math.max(current, theoreticalMax);
	}

	function anchorMonthLocally(month: number, newVal: number) {
		const i = monthDraftAnchors.findIndex((a) => a.month === month);
		if (i >= 0) monthDraftAnchors[i].value = newVal;
		else monthDraftAnchors.push({ month, value: newVal });
	}
	function unanchorMonthLocally(month: number) {
		const i = monthDraftAnchors.findIndex((a) => a.month === month);
		if (i >= 0) monthDraftAnchors.splice(i, 1);
		editedMonths.delete(month); // allow toggled month to stay unlocked
	}

	// fired on every keystroke (already clamped to cap)
	function onMonthTyped(month: number, v: number) {
		editedMonths.add(month);
		anchorMonthLocally(month, v);
		recomputeFromDraft(); // redistribute other unlocked months by days
	}

	// fired on blur/Enter — keep same logic; optionally persist here if you want autosave
	async function onMonthCommit(month: number, v: number) {
		anchorMonthLocally(month, v);
		recomputeFromDraft();
		// Optional: await setMonthGoal(...)
	}

	function onToggleMonth(month: number) {
		const isLocked = monthsView.find((m) => m.month === month)?.isAnchor;
		if (isLocked) unanchorMonthLocally(month);
		else {
			const v = monthsView.find((m) => m.month === month)?.value ?? 0;
			anchorMonthLocally(month, v);
		}
		recomputeFromDraft();
	}

	// ------------- WEEKS EXPANSION & EDITING ----------------------------------
	async function toggleWeeksForMonth(month: number) {
		if (expandedMonths.includes(month)) {
			// Collapse
			expandedMonths = expandedMonths.filter((m) => m !== month);
		} else {
			// Expand: load weeks from server first, then distribute
			expandedMonths = [...expandedMonths, month];
			await loadWeeksForMonth(month);
		}
	}

	async function loadWeeksForMonth(month: number) {
		if (!activeOwnerId) return;

		const monthGoal = monthsView.find((m) => m.month === month)?.value ?? 0;

		try {
			// Get persisted weeks from DB
			const serverWeeks = await getWeekGoals(
				ownerType,
				Number(activeOwnerId),
				year,
				month,
				targetKindId
			);

			// Build anchors from server (only anchored weeks)
			const anchors = (serverWeeks || [])
				.filter((w: any) => w.is_anchor)
				.map((w: any) => ({
					start: w.week_start,
					end: w.week_end,
					value: Math.trunc(Number(w.goal_value))
				}));

			// Distribute month goal across weeks
			const result = splitMonthToWeeks({
				year,
				month,
				monthTotal: monthGoal,
				weekAnchors: anchors
			});

			weekDraftsByMonth[month] = result.weeks.map((w) => ({
				week_start: w.week_start,
				week_end: w.week_end,
				value: w.value,
				isAnchor: w.isAnchor
			}));
			weekDraftsByMonth = { ...weekDraftsByMonth };
			weekEditedByMonth[month] = new Set();
		} catch (err) {
			console.error('Error loading weeks for month', month, err);
			weekDraftsByMonth[month] = [];
		}
	}

	function recomputeWeeksForMonth(month: number) {
		const monthGoal = monthsView.find((m) => m.month === month)?.value ?? 0;
		const currentWeeks = weekDraftsByMonth[month] || [];

		// Build anchors from current draft
		const anchors = currentWeeks
			.filter((w) => w.isAnchor)
			.map((w) => ({
				start: w.week_start,
				end: w.week_end,
				value: w.value
			}));

		const result = splitMonthToWeeks({ year, month, monthTotal: monthGoal, weekAnchors: anchors });

		weekDraftsByMonth[month] = result.weeks.map((w) => ({
			week_start: w.week_start,
			week_end: w.week_end,
			value: w.value,
			isAnchor: w.isAnchor
		}));
		weekDraftsByMonth = { ...weekDraftsByMonth };
	}

	function onWeekTyped(month: number, weekStart: string, value: number) {
		if (!weekEditedByMonth[month]) weekEditedByMonth[month] = new Set();
		weekEditedByMonth[month].add(weekStart);

		const weeks = weekDraftsByMonth[month] || [];
		const idx = weeks.findIndex((w) => w.week_start === weekStart);
		if (idx >= 0) {
			weeks[idx].value = value;
			weeks[idx].isAnchor = true;
		}
		weekDraftsByMonth[month] = [...weeks];
		recomputeWeeksForMonth(month);
	}

	function onWeekCommit(month: number, weekStart: string, value: number) {
		const weeks = weekDraftsByMonth[month] || [];
		const idx = weeks.findIndex((w) => w.week_start === weekStart);
		if (idx >= 0) {
			weeks[idx].value = value;
			weeks[idx].isAnchor = true;
		}
		weekDraftsByMonth[month] = [...weeks];
		recomputeWeeksForMonth(month);
	}

	function onToggleWeek(month: number, weekStart: string) {
		console.log('onToggleWeek called', { month, weekStart });
		const weeks = weekDraftsByMonth[month] || [];
		const idx = weeks.findIndex((w) => w.week_start === weekStart);
		if (idx >= 0) {
			weeks[idx].isAnchor = !weeks[idx].isAnchor;
		}
		weekDraftsByMonth[month] = [...weeks];
		recomputeWeeksForMonth(month);
	}

	function weekMaxCap(month: number, weekStart: string) {
		const weeks = weekDraftsByMonth[month] || [];
		const current = weeks.find((w) => w.week_start === weekStart)?.value ?? 0;
		const sumAnchOther = weeks
			.filter((w) => w.week_start !== weekStart && w.isAnchor)
			.reduce((s, w) => s + w.value, 0);

		const monthGoal = monthsView.find((m) => m.month === month)?.value ?? 0;
		const theoreticalMax = Math.max(0, Math.floor(monthGoal - sumAnchOther));
		return Math.max(current, theoreticalMax);
	}

	function weekScaleMax(month: number) {
		const weeks = weekDraftsByMonth[month] || [];
		return Math.max(1, ...weeks.map((w) => w.value || 0));
	}
</script>

<div class="flex w-full max-w-[1100px] flex-col gap-4">
	<div class=" flex flex-row items-center justify-between">
		<h2 class="text-xl font-semibold">Mål</h2>
	</div>

	<div class=" flex flex-row items-center justify-between">
		<p class="text-sm text-gray-500">
			Sätt årsmål som du sen kan fördela på månader för tränare och platser
		</p>
	</div>

	<!-- Toolbar -->
	<div class="">
		<!-- Owner selection -->
		<div class="mb-4 flex flex-row gap-3">
			<div class="min-w-24">
				<Dropdown
					label="Ägare"
					id="owner-type"
					placeholder="Välj ägare"
					options={[
						{ label: 'Tränare', value: 'trainer' },
						{ label: 'Plats', value: 'location' }
					]}
					bind:selectedValue={ownerType}
					on:change={handleOwnerTypeChange}
				/>
			</div>

			{#if ownerType === 'trainer'}
				<Dropdown
					label="Tränare"
					placeholder="Välj tränare"
					id="users"
					options={($users || []).map((u) => ({
						label: `${u.firstname} ${u.lastname}`,
						value: u.id
					}))}
					search
					maxNumberOfSuggestions={15}
					infiniteScroll
					bind:selectedValue={selectedUserId}
					on:change={async () => {
						selectedUserId = selectedUserId != null ? Number(selectedUserId) : null;
						setActiveOwnerFromSelections();
						await loadAnchors();
					}}
				/>
			{:else}
				<Dropdown
					label="Plats"
					placeholder="Välj plats"
					id="locations"
					options={($locations || []).map((l) => ({ label: l.name, value: l.id }))}
					maxNumberOfSuggestions={15}
					infiniteScroll
					bind:selectedValue={selectedLocationId}
					on:change={async () => {
						selectedLocationId = selectedLocationId != null ? Number(selectedLocationId) : null;
						setActiveOwnerFromSelections();
						await loadAnchors();
					}}
				/>
			{/if}
		</div>

		<div class="mb-4 flex flex-row justify-end gap-4">
			<Button
				variant={isEditing ? 'secondary' : 'primary'}
				text={isEditing ? 'Redigerar' : 'Redigera'}
				iconLeft={isEditing ? 'LockOpen' : 'Edit'}
				iconLeftSize="16"
				small
				on:click={() => {
					isEditing = !isEditing;
					if (isEditing) {
						yearDraft = persistedYearGoal ?? '';
						monthDraftAnchors = persistedMonthAnchors.map((a) => ({ ...a }));
						editedMonths.clear();
						recomputeFromDraft();
					}
				}}
			/>
			<Button
				variant="primary"
				text="Spara"
				iconLeft="Save"
				iconLeftSize="16"
				small
				on:click={saveAll}
				disabled={!isEditing || activeOwnerId === null || yearDraft === ''}
			/>
		</div>

		<!-- Year -->
		<div class="mb-4 rounded-sm border bg-gray-50 p-4">
			<div class="mb-3 flex flex-row items-center gap-4">
				<h3 class=" text-lg font-semibold">Årsmål</h3>

				<input
					type="number"
					min="2000"
					max="2100"
					bind:value={year}
					class="rounded-sm border p-2"
					onchange={() => {
						if (activeOwnerId) loadAnchors();
					}}
				/>
			</div>

			<div class="flex flex-wrap items-end gap-3">
				<input
					type="number"
					class="rounded-sm border p-2"
					bind:value={yearDraft}
					disabled={!isEditing}
					min="0"
					step="1"
					inputmode="numeric"
					onblur={commitYear}
					onkeydown={(e) => (e.key === 'Enter' ? commitYear() : null)}
				/>
				{#if yearDraft !== ''}<div class="text-sm text-gray-600">
						Summa månader: <strong>{yearTotal}</strong>
					</div>{/if}
				<p class="mt-2 basis-full text-xs text-gray-500">
					Fördelning sker alltid efter antal dagar i månaden.
				</p>
			</div>
		</div>

		{#if monthsView.length > 0}
			<div class="rounded-sm border bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-lg font-semibold">Mål per månad</h3>
				</div>

				<div class="space-y-3">
					{#each monthsView as m}
						<div class="flex flex-col">
							<MonthBarInput
								name={svMonthName(m.month)}
								month={m.month}
								value={m.value}
								cap={monthMaxCap(m.month)}
								scaleMax={scaleMaxDisplay}
								locked={m.isAnchor}
								disabled={!isEditing}
								showExpandButton={true}
								expanded={expandedMonths.includes(m.month)}
								oninput={(e) => onMonthTyped(e.month, e.value)}
								oncommit={(e) => onMonthCommit(e.month, e.value)}
								ontoggle={(e) => onToggleMonth(e.month)}
								onexpand={(e) => toggleWeeksForMonth(e.month)}
							/>

							<!-- Expanded weeks section -->
							{#if expandedMonths.includes(m.month)}
								<div
									class="border-orange/30 mt-2 ml-4 space-y-2 rounded-r-sm border-l-2 bg-gray-50 py-2 pl-4"
								>
									<div class="mb-2 flex items-center justify-between">
										<span class="text-xs font-medium text-gray-500"
											>Veckomål för {svMonthName(m.month)}</span
										>
										<span class="text-xs text-gray-400">
											Summa: {(weekDraftsByMonth[m.month] || []).reduce((s, w) => s + w.value, 0)} /
											{m.value}
										</span>
									</div>
									{#each weekDraftsByMonth[m.month] || [] as w}
										<WeekBarInput
											weekStart={w.week_start}
											weekEnd={w.week_end}
											value={w.value}
											cap={weekMaxCap(m.month, w.week_start)}
											scaleMax={weekScaleMax(m.month)}
											locked={w.isAnchor}
											disabled={!isEditing}
											oninput={(e) => onWeekTyped(m.month, e.weekStart, e.value)}
											oncommit={(e) => onWeekCommit(m.month, e.weekStart, e.value)}
											ontoggle={(e) => onToggleWeek(m.month, e.weekStart)}
										/>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>

				<p class="mt-3 text-xs text-gray-500">
					Skriv exakta värden per månad. Låsta månader ändras inte när övriga fördelas. Klicka på +
					för att visa veckor.
				</p>
			</div>
		{/if}

		<!-- Weeks (read-only preview) -->
		{#if showWeeksForMonth}
			<div class="rounded-sm border bg-gray-50 p-4">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-lg font-semibold">
						Veckor – {year}-{String(showWeeksForMonth).padStart(2, '0')}
					</h3>
					<Button
						variant="secondary"
						text="Stäng"
						on:click={() => {
							showWeeksForMonth = null;
							weeksView = [];
						}}
					/>
				</div>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each weeksView as w}
						<div class="rounded-sm border p-3">
							<div class="mb-1 text-sm font-medium">{w.week_start} – {w.week_end}</div>
							{#if w.isAnchor}
								<span
									class="mb-1 inline-block rounded-sm bg-green-100 px-2 py-0.5 text-xs text-green-700"
									>låst</span
								>
							{:else}
								<span
									class="mb-1 inline-block rounded-sm bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
									>automatisk</span
								>
							{/if}
							<!-- weeks editing can be added later -->
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
