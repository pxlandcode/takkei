<script lang="ts">
        import { onMount } from 'svelte';
        import Button from '../../bits/button/Button.svelte';
        import Input from '../../bits/Input/Input.svelte';
        import TextArea from '../../bits/textarea/TextArea.svelte';
        import { user as userStore } from '$lib/stores/userStore';
        import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
        import {
                createHoliday,
                deleteHoliday,
                fetchAdminHolidays,
                updateHoliday,
                type HolidayServiceError
        } from '$lib/services/api/holidayService';
        import type { Holiday, HolidayPayload } from '$lib/types/holiday';

        let isAdmin = false;
        let holidays: Holiday[] = [];
        let isLoading = false;
        let loadError: string | null = null;
        let showPassed = false;
        let hasFetched = false;

        let name = '';
        let date = '';
        let description = '';
        let editingId: number | null = null;
        let saving = false;
        let validationErrors: Record<string, string> = {};
        let generalError: string | null = null;

        let selectedYear = String(new Date().getFullYear());
        let selectedYearNumber = Number(selectedYear);
        let yearOptions: number[] = [];

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
                                }
                        } else if (admin && !hasFetched && !isLoading) {
                                loadHolidays();
                        }
                });

                return () => unsubscribe();
        });

        $: selectedYearNumber = Number(selectedYear);

        $: yearOptions = (() => {
                const baseYear = new Date().getFullYear();
                const years = new Set<number>([baseYear, baseYear + 1, selectedYearNumber]);
                for (const holiday of holidays) {
                        if (holiday?.date && /^\d{4}-\d{2}-\d{2}$/.test(holiday.date)) {
                                years.add(Number(holiday.date.slice(0, 4)));
                        }
                }
                return Array.from(years).sort((a, b) => a - b);
        })();

        function formatDisplayDate(value: string) {
                if (!value) return '';
                const parsed = new Date(`${value}T00:00:00`);
                if (Number.isNaN(parsed.getTime())) return value;
                return parsed.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
        }

        function resetForm() {
                editingId = null;
                name = '';
                date = '';
                description = '';
                validationErrors = {};
                generalError = null;
        }

        async function loadHolidays() {
                if (!isAdmin) return;
                isLoading = true;
                loadError = null;
                try {
                        const data = await fetchAdminHolidays(showPassed);
                        holidays = [...data].sort((a, b) => a.date.localeCompare(b.date));
                        hasFetched = true;
                } catch (error) {
                        console.error('Failed to load holidays', error);
                        loadError = 'Kunde inte hämta helgdagar. Försök igen senare.';
                        holidays = [];
                } finally {
                        isLoading = false;
                }
        }

        function startEdit(holiday: Holiday) {
                editingId = holiday.id;
                name = holiday.name ?? '';
                date = holiday.date ?? '';
                description = holiday.description ?? '';
                validationErrors = {};
                generalError = null;
                if (holiday.date && /^\d{4}/.test(holiday.date)) {
                        const yr = Number(holiday.date.slice(0, 4));
                        if (!Number.isNaN(yr)) selectedYear = String(yr);
                }
        }

        function applySelectedYear() {
                const fallback = `${selectedYearNumber}-01-01`;
                if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                        date = fallback;
                        return;
                }
                const monthDay = date.slice(5);
                date = `${selectedYearNumber}-${monthDay}`;
        }

        async function handleSubmit(event: Event) {
                event.preventDefault();
                if (!isAdmin) return;

                validationErrors = {};
                generalError = null;

                const trimmedName = name.trim();
                const trimmedDate = date.trim();

                const payload: HolidayPayload = {
                        name: trimmedName,
                        date: trimmedDate,
                        description: description.trim() ? description.trim() : undefined
                };

                if (!payload.date) {
                        validationErrors.date = 'Datum krävs';
                        generalError = 'Kontrollera formuläret.';
                        return;
                }

                saving = true;
                try {
                        let saved: Holiday;
                        if (editingId) {
                                saved = await updateHoliday(editingId, payload);
                                holidays = holidays.map((holiday) => (holiday.id === saved.id ? saved : holiday));
                        } else {
                                saved = await createHoliday(payload);
                                holidays = [...holidays, saved];
                        }
                        holidays = holidays.sort((a, b) => a.date.localeCompare(b.date));
                        resetForm();
                } catch (error) {
                        console.error('Failed to save holiday', error);
                        const apiError = error as HolidayServiceError;
                        if (apiError?.errors) {
                                validationErrors = apiError.errors;
                        }
                        generalError = apiError?.message ?? 'Kunde inte spara helgdag.';
                } finally {
                        saving = false;
                }
        }

        function handleCancel() {
                resetForm();
        }

        async function handleDelete(holiday: Holiday) {
                if (!isAdmin) return;
                if (!confirm(`Är du säker på att du vill ta bort ${holiday.name}?`)) {
                        return;
                }
                try {
                        await deleteHoliday(holiday.id);
                        holidays = holidays.filter((item) => item.id !== holiday.id);
                        if (editingId === holiday.id) {
                                resetForm();
                        }
                } catch (error) {
                        console.error('Failed to delete holiday', error);
                        loadError = 'Kunde inte ta bort helgdagen. Försök igen senare.';
                }
        }
</script>

<div class="space-y-6">
        <div class="rounded-md bg-white p-6 shadow-sm">
                <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                                <h3 class="text-xl font-semibold text-gray-900">Helgdagar</h3>
                                <p class="text-sm text-gray-500">Hantera helgdagar som visas i kalender och rapporter.</p>
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

                {#if !isAdmin}
                        <p class="mt-6 rounded-md bg-gray-100 p-4 text-sm text-gray-600">
                                Du behöver administratörsbehörighet för att se och redigera helgdagar.
                        </p>
                {:else}
                        {#if loadError}
                                <div class="mt-6 rounded-md bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
                        {/if}

                        <div class="mt-6 overflow-hidden rounded-md border border-gray-200">
                                {#if isLoading}
                                        <div class="p-6 text-center text-sm text-gray-500">Laddar helgdagar...</div>
                                {:else if holidays.length === 0}
                                        <div class="p-6 text-center text-sm text-gray-500">
                                                {showPassed
                                                        ? 'Inga helgdagar hittades.'
                                                        : 'Inga kommande helgdagar hittades.'}
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
                                                        {#each holidays as holiday (holiday.id)}
                                                                <tr class="hover:bg-orange/5">
                                                                        <td class="px-4 py-3 font-medium text-gray-900">{holiday.name}</td>
                                                                        <td class="px-4 py-3 text-gray-700">{formatDisplayDate(holiday.date)}</td>
                                                                        <td class="px-4 py-3 text-gray-600">{holiday.description || '—'}</td>
                                                                        <td class="px-4 py-3 text-right">
                                                                                <div class="flex justify-end gap-2">
                                                                                        <Button
                                                                                                text="Redigera"
                                                                                                small
                                                                                                variant="secondary"
                                                                                                on:click={() => startEdit(holiday)}
                                                                                        />
                                                                                        <Button
                                                                                                text="Ta bort"
                                                                                                small
                                                                                                variant="danger-outline"
                                                                                                on:click={() => handleDelete(holiday)}
                                                                                        />
                                                                                </div>
                                                                        </td>
                                                                </tr>
                                                        {/each}
                                                </tbody>
                                        </table>
                                {/if}
                        </div>

                        <form class="mt-8 space-y-4 rounded-md border border-gray-200 bg-white p-6" on:submit|preventDefault={handleSubmit}>
                                <h4 class="text-lg font-semibold text-gray-900">
                                        {editingId ? 'Redigera helgdag' : 'Lägg till helgdag'}
                                </h4>

                                {#if generalError}
                                        <div class="rounded-md bg-red-50 p-3 text-sm text-red-700">{generalError}</div>
                                {/if}

                                <Input label="Namn" name="holiday-name" bind:value={name} errors={validationErrors} />

                                <div class="flex flex-wrap gap-4">
                                        <div class="min-w-[200px] flex-1">
                                                <Input
                                                        label="Datum"
                                                        name="holiday-date"
                                                        type="date"
                                                        bind:value={date}
                                                        errors={validationErrors}
                                                />
                                        </div>
                                        <div class="flex items-end gap-2">
                                                <label class="text-sm font-medium text-gray-700">År</label>
                                                <select
                                                        bind:value={selectedYear}
                                                        class="rounded border border-gray-300 px-2 py-1 text-sm focus:border-orange focus:outline-hidden"
                                                >
                                                        {#each yearOptions as year}
                                                                <option value={year}>{year}</option>
                                                        {/each}
                                                </select>
                                                <button
                                                        type="button"
                                                        class="rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                                                        on:click={applySelectedYear}
                                                >
                                                        Lägg till datum för år {selectedYearNumber}
                                                </button>
                                        </div>
                                </div>

                                <TextArea
                                        label="Beskrivning"
                                        name="holiday-description"
                                        bind:value={description}
                                        errors={validationErrors}
                                />

                                <div class="flex flex-wrap justify-end gap-2 pt-2">
                                        <Button
                                                type="submit"
                                                text={editingId ? 'Spara ändringar' : 'Spara helgdag'}
                                                variant="primary"
                                                disabled={saving}
                                        />
                                        {#if editingId}
                                                <Button text="Avbryt" variant="secondary" disabled={saving} on:click={handleCancel} />
                                        {/if}
                                </div>
                        </form>
                {/if}
</div>
</div>
