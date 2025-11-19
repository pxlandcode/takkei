<script lang="ts">
        import { onMount } from 'svelte';
        import Button from '../../bits/button/Button.svelte';
        import Dropdown from '../../bits/dropdown/Dropdown.svelte';
        import { user as userStore } from '$lib/stores/userStore';
        import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
        import {
                deleteHoliday,
                fetchAdminHolidays,
                importSwedishHolidays,
                type HolidayServiceError
        } from '$lib/services/api/holidayService';
        import type { Holiday } from '$lib/types/holiday';
        import { openPopup } from '$lib/stores/popupStore';
        import HolidayFormPopup from './HolidayFormPopup.svelte';

        let isAdmin = false;
        let holidays: Holiday[] = [];
        let isLoading = false;
        let loadError: string | null = null;
        let showPassed = false;
        let hasFetched = false;

        let importing = false;
        type ImportFeedback = { type: 'success' | 'error'; message: string };
        let importFeedback: ImportFeedback | null = null;

        let selectedYear = String(new Date().getFullYear());
        let selectedYearNumber = Number(selectedYear);
        let yearOptions: number[] = [];
        let yearDropdownOptions: { label: string; value: string }[] = [];
        let availableYears: number[] = [];
        let filteredHolidays: Holiday[] = [];

        onMount(() => {
                const unsubscribe = userStore.subscribe((currentUser) => {
                        const admin = hasRole('Administrator', currentUser as any);
                        if (admin !== isAdmin) {
                                isAdmin = admin;
                                if (isAdmin) {
                                        loadHolidays();
                                } else {
                                        holidays = [];
                                        hasFetched = false;
                                        availableYears = [];
                                }
                        } else if (admin && !hasFetched && !isLoading) {
                                loadHolidays();
                        }
                });

                return () => unsubscribe();
        });

        $: selectedYearNumber = Number(selectedYear);
        $: selectedYearLabel = Number.isFinite(selectedYearNumber)
                ? String(selectedYearNumber)
                : 'valt år';

        $: yearOptions = (() => {
                const currentYear = new Date().getFullYear();
                const years = new Set<number>();

                for (let offset = 0; offset <= 5; offset += 1) {
                        years.add(currentYear + offset);
                }

                for (const year of availableYears) {
                        if (Number.isFinite(year)) {
                                years.add(Number(year));
                        }
                }

                for (const holiday of holidays) {
                        if (holiday?.date && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) {
                                years.add(Number(holiday.date.slice(0, 4)));
                        }
                }

                if (Number.isFinite(selectedYearNumber)) {
                        years.add(selectedYearNumber);
                }

                return Array.from(years).sort((a, b) => a - b);
        })();

        $: yearDropdownOptions = yearOptions.map((year) => ({
                label: String(year),
                value: String(year)
        }));

        function formatDisplayDate(value: string) {
                if (!value) return '';
                const parsed = new Date(`${value}T00:00:00`);
                if (Number.isNaN(parsed.getTime())) return value;
                return parsed.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
        }

        async function loadHolidays() {
                if (!isAdmin) return;
                isLoading = true;
                loadError = null;
                importFeedback = null;
                try {
                        const { holidays: fetched, years } = await fetchAdminHolidays(showPassed);
                        holidays = [...fetched].sort((a, b) => a.date.localeCompare(b.date));
                        availableYears = Array.isArray(years) ? years : [];
                        hasFetched = true;
                } catch (error) {
                        console.error('Failed to load holidays', error);
                        loadError = 'Kunde inte hämta helgdagar. Försök igen senare.';
                        holidays = [];
                } finally {
                        isLoading = false;
                }
        }

        $: filteredHolidays = (() => {
                if (!Number.isFinite(selectedYearNumber)) {
                        return holidays;
                }
                const selected = selectedYearNumber;
                return holidays.filter((holiday) => {
                        if (!holiday?.date || holiday.date.length < 4) return false;
                        const yr = Number(holiday.date.slice(0, 4));
                        return yr === selected;
                });
        })();

        async function handleImport() {
                if (!isAdmin || importing) return;
                if (!Number.isFinite(selectedYearNumber)) {
                        importFeedback = {
                                type: 'error',
                                message: 'Välj ett giltigt år för import.'
                        };
                        return;
                }
                importing = true;
                importFeedback = null;
                try {
                        const { meta } = await importSwedishHolidays(selectedYearNumber);
                        await loadHolidays();
                        const inserted = meta?.inserted ?? 0;
                        if (inserted > 0) {
                                importFeedback = {
                                        type: 'success',
                                        message: `Importerade ${inserted} helgdag${inserted === 1 ? '' : 'ar'} för ${selectedYearLabel}.`
                                };
                        } else {
                                importFeedback = {
                                        type: 'success',
                                        message: `Inga nya helgdagar att importera för ${selectedYearLabel}.`
                                };
                        }
                } catch (error) {
                        console.error('Failed to import swedish holidays', error);
                        const apiError = error as HolidayServiceError;
                        const message =
                                (apiError?.errors && Object.values(apiError.errors)[0]) ??
                                apiError?.message ??
                                'Kunde inte importera helgdagar.';
                        importFeedback = { type: 'error', message };
                } finally {
                        importing = false;
                }
        }

        async function handleDelete(holiday: Holiday) {
                if (!isAdmin) return;
                try {
                        await deleteHoliday(holiday.id);
                        holidays = holidays.filter((item) => item.id !== holiday.id);
                } catch (error) {
                        console.error('Failed to delete holiday', error);
                        loadError = 'Kunde inte ta bort helgdagen. Försök igen senare.';
                }
        }

        function handlePopupSaved(saved: Holiday) {
                const exists = holidays.some((item) => item.id === saved.id);
                if (exists) {
                        holidays = holidays.map((item) => (item.id === saved.id ? saved : item));
                } else {
                        holidays = [...holidays, saved];
                }
                holidays = holidays.sort((a, b) => a.date.localeCompare(b.date));
        }

        function openHolidayPopup(holiday?: Holiday) {
                openPopup({
                        header: holiday ? 'Redigera helgdag' : 'Lägg till helgdag',
                        icon: holiday ? 'Edit' : 'Plus',
                        component: HolidayFormPopup,
                        maxWidth: '520px',
                        props: {
                                holiday: holiday ?? null,
                                onSaved: handlePopupSaved
                        }
                });
        }
</script>

<div class="space-y-6">
        <div class="rounded-md bg-white p-6 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                                <h3 class="text-xl font-semibold text-gray-900">Helgdagar</h3>
                                <p class="text-sm text-gray-500">Hantera helgdagar som visas i kalender och rapporter.</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-3">
                                <Button
                                        text="Lägg till helgdag"
                                        iconLeft="Plus"
                                        variant="primary"
                                        small
                                        on:click={() => openHolidayPopup()}
                                />
                                <Button
                                        text={importing ? 'Hämtar...' : `Hämta helgdagar`}
                                        iconLeft="Refresh"
                                        small
                                        variant="secondary"
                                        disabled={importing || isLoading}
                                        on:click={handleImport}
                                />
                                <div class="min-w-[200px]">
                                        <Dropdown
                                                id="holiday-year-filter"
                                                label="Visar år"
                                                options={yearDropdownOptions}
                                                bind:selectedValue={selectedYear}
                                                placeholder="Välj år"
                                        />
                                </div>
                                <label class="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                                type="checkbox"
                                                bind:checked={showPassed}
                                                on:change={loadHolidays}
                                                class="h-4 w-4 rounded border-gray-300 text-orange focus:ring-orange"
                                        />
                                        <span>Visa passerade dagar</span>
                                </label>
                        </div>
                </div>

                {#if !isAdmin}
                        <p class="mt-6 rounded-md bg-gray-100 p-4 text-sm text-gray-600">
                                Du behöver administratörsbehörighet för att se och redigera helgdagar.
                        </p>
                {:else}
                        {#if loadError}
                                <div class="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
                        {/if}
                        {#if importFeedback}
                                <div
                                        class={`mt-4 rounded-md p-4 text-sm ${importFeedback.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                                >
                                        {importFeedback.message}
                                </div>
                        {/if}

                        <div class="mt-6 overflow-hidden rounded-md border border-gray-200">
                                {#if isLoading}
                                        <div class="p-6 text-center text-sm text-gray-500">Laddar helgdagar...</div>
                                {:else if filteredHolidays.length === 0}
                                        <div class="p-6 text-center text-sm text-gray-500">
                                                {`Inga helgdagar hittades för år ${selectedYearLabel}.`}
                                        </div>
                                {:else}
                                        <table class="min-w-full divide-y divide-gray-200 bg-white text-sm">
                                                <thead class="bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                                                        <tr>
                                                                <th class="px-4 py-3">Namn</th>
                                                                <th class="px-4 py-3">Datum</th>
                                                                <th class="px-4 py-3">Beskrivning</th>
                                                                <th class="px-4 py-3 text-right">Åtgärder</th>
                                                        </tr>
                                                </thead>
                                                <tbody class="divide-y divide-gray-100 bg-white">
                                                        {#each filteredHolidays as holiday (holiday.id)}
                                                                <tr class="hover:bg-orange/5">
                                                                        <td class="px-4 py-3 font-medium text-gray-900">{holiday.name}</td>
                                                                        <td class="px-4 py-3 text-gray-700">{formatDisplayDate(holiday.date)}</td>
                                                                        <td class="px-4 py-3 text-gray-600">{holiday.description || '—'}</td>
                                                                        <td class="px-4 py-3 text-right">
                                                                                <div class="flex justify-end gap-2">
                                                                                        <Button
                                                                                                text="Redigera"
                                                                                                iconLeft="Edit"
                                                                                                small
                                                                                                variant="secondary"
                                                                                                on:click={() => openHolidayPopup(holiday)}
                                                                                        />
                                                                                        <Button
                                                                                                small
                                                                                                variant="cancel"
                                                                                                icon="Trash"
                                                                                                iconSize="18px"
                                                                                                confirmOptions={{
                                                                                                        title: `Ta bort ${holiday.name}?`,
                                                                                                        description: 'Detta går inte att ångra.',
                                                                                                        actionLabel: 'Ta bort',
                                                                                                        action: () => handleDelete(holiday)
                                                                                                }}
                                                                                        />
                                                                                </div>
                                                                        </td>
                                                                </tr>
                                                        {/each}
                                                </tbody>
                                        </table>
                                {/if}
                        </div>
                {/if}
        </div>
</div>
