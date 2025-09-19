<script lang="ts">
	import { onMount } from 'svelte';
	import { users, fetchUsers } from '$lib/stores/usersStore';
	import { locations, fetchLocations } from '$lib/stores/locationsStore';
	import Dropdown from '../../bits/dropdown/Dropdown.svelte';
	import { user } from '$lib/stores/userStore';
	import Button from '../../bits/button/Button.svelte';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	import {
		getTargetGoals,
		setYearGoal,
		setMonthGoal,
		getWeekGoals
	} from '$lib/services/api/targetGoalsService';

	import {
		splitYearToMonths,
		splitMonthToWeeks
	} from '$lib/helpers/allocGoalHelpers/allocGoalHelpers';
	import { debounce } from '$lib/utils/debounce';

	import MonthBarInput from '../targets/MonthBarInput.svelte';

	// ---- Local state ---------------------------------------------------------
	let ownerType: 'trainer' | 'location' = 'trainer';
	let selectedUserId: number | null = null;
	let selectedLocationId: number | null = null;

	let year = new Date().getFullYear();

	let isEditing = false;

	// target kind matches new targets (1=trainer bookings, 2=location bookings)
	$: targetKindId = ownerType === 'trainer' ? 1 : 2;

	// Active owner context
	let activeOwnerId: number | null = null;

	// SERVER snapshot
	let persistedYearGoal: number | null = null;
	let persistedMonthAnchors: { month: number; value: number }[] = [];

	// DRAFT (local)
	let yearDraft: number | '' = ''; // numeric (or empty while editing)
	let monthDraftAnchors: { month: number; value: number }[] = []; // local anchored months
	let monthInputs: (string | number)[] = Array(13).fill(''); // 1..12; bound to inputs
	let editedMonths = new Set<number>(); // months user has touched in this session

	// Derived
	let monthsView: { month: number; value: number; isAnchor: boolean }[] = [];
	let yearTotal = 0;

	// Weeks (read-only preview)
	let showWeeksForMonth: number | null = null;
	let weeksView: { week_start: string; week_end: string; value: number; isAnchor: boolean }[] = [];

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
			const payload = await getTargetGoals(
				ownerType,
				Number(activeOwnerId),
				year,
				targetKindId
			);
			persistedYearGoal = payload?.yearGoal == null ? null : Math.trunc(Number(payload.yearGoal));
			yearDraft = persistedYearGoal == null ? '' : persistedYearGoal;

			persistedMonthAnchors = (payload?.months || []).map((r: any) => ({
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

	// Reactive triggers while editing
	$: if (isEditing) {
		yearDraft; // trigger debounce when year changes
		applyYearDraft();
	}

	$: if (isEditing) {
		monthInputs;
		applyMonthDrafts();
	}

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
			const monthPayloads = monthsView.map(({ month, value }) => ({
				ownerType,
				ownerId: Number(activeOwnerId),
				year,
				month, // 1..12
				targetKindId,
				goalValue: Math.max(0, Math.trunc(Number(value))),
				title: `Månadsmål ${year}-${String(month).padStart(2, '0')}`,
				description: ''
			}));

			// Save in parallel to speed things up
			await Promise.all(monthPayloads.map((p) => setMonthGoal(p)));

			await loadAnchors(); // reload from DB (will now reflect all 12 months)
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

	// keep ownerId derived reactively
	$: setActiveOwnerFromSelections();

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

	// Shared visual scale across rows — use the current max value only
	$: scaleMaxDisplay = Math.max(1, ...monthsView.map((m) => m.value || 0));

	function anchorMonthLocally(month: number, newVal: number) {
		const i = monthDraftAnchors.findIndex((a) => a.month === month);
		if (i >= 0) monthDraftAnchors[i].value = newVal;
		else monthDraftAnchors.push({ month, value: newVal });
	}
	function unanchorMonthLocally(month: number) {
		const i = monthDraftAnchors.findIndex((a) => a.month === month);
		if (i >= 0) monthDraftAnchors.splice(i, 1);
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
		<div class="mb-4 rounded-lg border bg-gray-50 p-4">
			<div class="mb-3 flex flex-row items-center gap-4">
				<h3 class=" text-lg font-semibold">Årsmål</h3>

				<input
					type="number"
					min="2000"
					max="2100"
					bind:value={year}
					class="rounded border p-2"
					on:change={() => {
						if (activeOwnerId) loadAnchors();
					}}
				/>
			</div>

			<div class="flex flex-wrap items-end gap-3">
				<input
					type="number"
					class="rounded border p-2"
					bind:value={yearDraft}
					disabled={!isEditing}
					min="0"
					step="1"
					inputmode="numeric"
					on:blur={commitYear}
					on:keydown={(e) => (e.key === 'Enter' ? commitYear() : null)}
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
			<div class="rounded-lg border bg-white p-4">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-lg font-semibold">Mål per månad</h3>
				</div>

				<div class="space-y-3">
					{#each monthsView as m}
						<MonthBarInput
							name={svMonthName(m.month)}
							month={m.month}
							value={m.value}
							cap={monthMaxCap(m.month)}
							scaleMax={scaleMaxDisplay}
							locked={m.isAnchor}
							disabled={!isEditing}
							on:input={(e) => onMonthTyped(e.detail.month, e.detail.value)}
							on:commit={(e) => onMonthCommit(e.detail.month, e.detail.value)}
							on:toggle={(e) => onToggleMonth(e.detail.month)}
						/>
					{/each}
				</div>

				<p class="mt-3 text-xs text-gray-500">
					Skriv exakta värden per månad. Låsta månader ändras inte när övriga fördelas.
				</p>
			</div>
		{/if}

		<!-- Weeks (read-only preview) -->
		{#if showWeeksForMonth}
			<div class="rounded-lg border bg-gray-50 p-4">
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
						<div class="rounded-xl border p-3">
							<div class="mb-1 text-sm font-medium">{w.week_start} – {w.week_end}</div>
							{#if w.isAnchor}
								<span
									class="mb-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700"
									>låst</span
								>
							{:else}
								<span
									class="mb-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
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
