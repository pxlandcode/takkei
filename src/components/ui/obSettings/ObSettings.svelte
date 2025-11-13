<script lang="ts">
        import { onMount } from 'svelte';
        import Button from '../../bits/button/Button.svelte';
        import Input from '../../bits/Input/Input.svelte';
        import Icon from '../../bits/icon-component/Icon.svelte';
        import { user as userStore } from '$lib/stores/userStore';
        import { hasRole } from '$lib/helpers/userHelpers/roleHelper';

        type ObWindow = {
                id: number;
                name: string;
                start_minutes: number;
                end_minutes: number;
                weekday_mask: number;
                include_holidays: boolean;
                active: boolean;
                created_at: string;
                updated_at: string;
        };

        const WEEKDAYS = [
                { value: 'mon', label: 'Mån', bit: 1 << 0 },
                { value: 'tue', label: 'Tis', bit: 1 << 1 },
                { value: 'wed', label: 'Ons', bit: 1 << 2 },
                { value: 'thu', label: 'Tor', bit: 1 << 3 },
                { value: 'fri', label: 'Fre', bit: 1 << 4 },
                { value: 'sat', label: 'Lör', bit: 1 << 5 },
                { value: 'sun', label: 'Sön', bit: 1 << 6 }
        ];

        let isAdmin = false;
        let windows: ObWindow[] = [];
        let isLoading = false;
        let loadError: string | null = null;
        let saving = false;
        let formError: string | null = null;
        let formErrors: Record<string, string> = {};
        let selectedId: number | null = null;
        let hasFetched = false;

        let name = '';
        let startTime = '';
        let endTime = '';
        let selectedDays = new Set<string>();
        let includeHolidays = false;
        let active = true;

        onMount(() => {
                const unsubscribe = userStore.subscribe((current) => {
                        const admin = hasRole('Administrator', current);
                        if (admin !== isAdmin) {
                                isAdmin = admin;
                                if (!isAdmin) {
                                        windows = [];
                                        hasFetched = false;
                                }
                        }

                        if (admin && !hasFetched && !isLoading) {
                                fetchWindows();
                        }
                });

                return () => unsubscribe();
        });

        function resetForm() {
                selectedId = null;
                name = '';
                startTime = '';
                endTime = '';
                selectedDays = new Set(['mon', 'tue', 'wed', 'thu', 'fri']);
                includeHolidays = false;
                active = true;
                formError = null;
                formErrors = {};
        }

        resetForm();

        async function fetchWindows() {
                isLoading = true;
                loadError = null;
                try {
                        const res = await fetch('/api/settings/ob-time-windows');
                        if (!res.ok) {
                                throw new Error('Request failed');
                        }
                        const body = await res.json();
                        const fetched: ObWindow[] = body.data ?? [];
                        windows = [...fetched].sort(compareWindows);
                        hasFetched = true;
                } catch (error) {
                        console.error('Failed to load OB windows', error);
                        loadError = 'Kunde inte hämta OB-fönster. Försök igen senare.';
                } finally {
                        isLoading = false;
                }
        }

        function compareWindows(a: ObWindow, b: ObWindow) {
                if (a.start_minutes === b.start_minutes) {
                        return a.name.localeCompare(b.name);
                }
                return a.start_minutes - b.start_minutes;
        }

        function minutesToTimeString(minutes: number) {
                if (!Number.isFinite(minutes)) return '';
                if (minutes === 1440) return '24:00';
                const h = Math.floor(minutes / 60);
                const m = minutes % 60;
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        }

        function maskToDays(mask: number): string[] {
                // Monday is bit 0 (1 << 0) and Sunday is bit 6 (1 << 6).
                return WEEKDAYS.filter((day) => (mask & day.bit) !== 0).map((day) => day.value);
        }

        function daysToMask(days: Iterable<string>): number {
                let mask = 0;
                for (const day of days) {
                        const match = WEEKDAYS.find((d) => d.value === day);
                        if (match) mask |= match.bit;
                }
                return mask;
        }

        function selectWindow(window: ObWindow) {
                selectedId = window.id;
                name = window.name;
                startTime = minutesToTimeString(window.start_minutes);
                endTime = minutesToTimeString(window.end_minutes);
                selectedDays = new Set(maskToDays(window.weekday_mask));
                includeHolidays = window.include_holidays;
                active = window.active;
                formError = null;
                formErrors = {};
        }

        function toggleDay(day: string) {
                const next = new Set(selectedDays);
                if (next.has(day)) {
                        next.delete(day);
                } else {
                        next.add(day);
                }
                selectedDays = next;
        }

        function parseTime(value: string): number | null {
                const trimmed = value.trim();
                if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
                const [hoursStr, minutesStr] = trimmed.split(':');
                const hours = Number(hoursStr);
                const minutes = Number(minutesStr);
                if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
                if (minutes < 0 || minutes > 59) return null;
                const total = hours * 60 + minutes;
                if (total < 0 || total > 1440) return null;
                if (total === 1440 && minutes !== 0) return null;
                return total;
        }

        async function handleSubmit(event: Event) {
                event.preventDefault();
                formErrors = {};
                formError = null;

                const localErrors: Record<string, string> = {};

                const trimmedName = name.trim();
                if (!trimmedName) {
                        localErrors.name = 'Namn krävs';
                }

                const start = parseTime(startTime);
                if (start === null) {
                        localErrors.start_minutes = 'Ange giltig starttid (HH:MM)';
                } else if (start < 0 || start > 1439) {
                        localErrors.start_minutes = 'Starttid måste vara mellan 00:00 och 23:59';
                }

                const end = parseTime(endTime);
                if (end === null) {
                        localErrors.end_minutes = 'Ange giltig sluttid (HH:MM)';
                } else if (end <= 0 || end > 1440) {
                        localErrors.end_minutes = 'Sluttid måste vara mellan 00:01 och 24:00';
                }

                if (start !== null && end !== null && start >= end) {
                        localErrors.end_minutes = 'Sluttid måste vara senare än starttid';
                }

                const mask = daysToMask(selectedDays);
                if (mask < 0 || mask > 127) {
                        localErrors.weekday_mask = 'Ogiltig veckodagsmask';
                }

                if (Object.keys(localErrors).length > 0) {
                        formErrors = localErrors;
                        return;
                }

                const payload = {
                        name: trimmedName,
                        start_minutes: start,
                        end_minutes: end,
                        weekday_mask: mask,
                        include_holidays: includeHolidays,
                        active
                };

                saving = true;

                try {
                        const res = await fetch(
                                selectedId
                                        ? `/api/settings/ob-time-windows/${selectedId}`
                                        : '/api/settings/ob-time-windows',
                                {
                                        method: selectedId ? 'PUT' : 'POST',
                                        headers: { 'content-type': 'application/json' },
                                        body: JSON.stringify(payload)
                                }
                        );

                        if (res.status === 400) {
                                const data = await res.json();
                                formErrors = data.errors ?? {};
                                return;
                        }

                        if (!res.ok) {
                                formError = 'Kunde inte spara fönstret. Försök igen.';
                                return;
                        }

                        const data = await res.json();
                        const saved: ObWindow = data.data;

                        if (selectedId) {
                                windows = windows
                                        .map((item) => (item.id === saved.id ? saved : item))
                                        .sort(compareWindows);
                        } else {
                                windows = [...windows, saved].sort(compareWindows);
                        }

                        resetForm();
                } catch (error) {
                        console.error('Failed to save OB window', error);
                        formError = 'Ett oväntat fel uppstod.';
                } finally {
                        saving = false;
                }
        }

        async function deleteWindow(window: ObWindow) {
                if (!globalThis.confirm(`Ta bort "${window.name}"?`)) {
                        return;
                }

                try {
                        const res = await fetch(`/api/settings/ob-time-windows/${window.id}`, {
                                method: 'DELETE'
                        });
                        if (!res.ok && res.status !== 204) {
                                throw new Error('Delete failed');
                        }
                        windows = windows.filter((item) => item.id !== window.id);
                        if (selectedId === window.id) {
                                resetForm();
                        }
                } catch (error) {
                        console.error('Failed to delete OB window', error);
                        formError = 'Kunde inte ta bort fönstret. Försök igen.';
                }
        }

        function formatRange(window: ObWindow) {
                return `${minutesToTimeString(window.start_minutes)}–${minutesToTimeString(window.end_minutes)}`;
        }
</script>

{#if !isAdmin}
        <p class="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
                Du har inte behörighet att hantera OB-fönster.
        </p>
{:else}
        <div class="space-y-6">
                <div class="flex flex-col gap-2 border-b border-gray pb-4">
                        <h2 class="text-xl font-semibold">OB-fönster</h2>
                        <p class="text-sm text-gray-600">
                                Hantera tidsintervall för OB-ersättning. Veckodagsmasken använder måndag som första bit och söndag som sista bit.
                        </p>
                </div>

                <div class="grid gap-6 lg:grid-cols-[2fr,1fr]">
                        <div class="space-y-4">
                                {#if loadError}
                                        <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
                                {/if}
                                {#if isLoading}
                                        <div class="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
                                                Laddar OB-fönster...
                                        </div>
                                {:else if windows.length === 0}
                                        <div class="rounded border border-gray-200 bg-white p-4 text-sm text-gray-600">
                                                Inga OB-fönster ännu. Lägg till ett via formuläret.
                                        </div>
                                {:else}
                                        <div class="space-y-4">
                                                {#each windows as window (window.id)}
                                                        <div
                                                                class={`rounded border border-gray-200 bg-white p-4 shadow-sm transition ${
                                                                        selectedId === window.id ? 'border-primary ring-1 ring-primary/20' : 'hover:border-primary'
                                                                }`}
                                                        >
                                                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                                        <div>
                                                                                <div class="flex items-center gap-2">
                                                                                        <h3 class="text-lg font-semibold">{window.name}</h3>
                                                                                        <span
                                                                                                class={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                                                        window.active
                                                                                                                ? 'bg-green-100 text-green-700'
                                                                                                                : 'bg-gray-200 text-gray-600'
                                                                                                }`}
                                                                                        >
                                                                                                {window.active ? 'Aktiv' : 'Inaktiv'}
                                                                                        </span>
                                                                                </div>
                                                                                <p class="text-sm text-gray-600">{formatRange(window)}</p>
                                                                        </div>
                                                                        <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                                                                <div class="flex items-center gap-1">
                                                                                        <Icon icon={window.include_holidays ? 'Check' : 'Close'} size="16px" />
                                                                                        <span>Helgdagar</span>
                                                                                </div>
                                                                                <Button
                                                                                        text="Redigera"
                                                                                        variant="secondary"
                                                                                        small
                                                                                        on:click={() => selectWindow(window)}
                                                                                />
                                                                                <Button
                                                                                        icon="Trash"
                                                                                        variant="danger-outline"
                                                                                        small
                                                                                        on:click={() => deleteWindow(window)}
                                                                                />
                                                                        </div>
                                                                </div>
                                                                <div class="mt-3 flex flex-wrap gap-2 text-xs font-medium uppercase">
                                                                        {#each WEEKDAYS as day}
                                                                                <span
                                                                                        class={`rounded-full border px-2 py-1 ${
                                                                                                (window.weekday_mask & day.bit) !== 0
                                                                                                        ? 'border-primary bg-primary/10 text-primary'
                                                                                                        : 'border-gray-200 text-gray-400'
                                                                                        }`}
                                                                                >
                                                                                        {day.label}
                                                                                </span>
                                                                        {/each}
                                                                </div>
                                                        </div>
                                                {/each}
                                        </div>
                                {/if}
                        </div>

                        <form class="rounded border border-gray-200 bg-white p-4 shadow-sm" on:submit|preventDefault={handleSubmit}>
                                <h3 class="mb-4 text-lg font-semibold">
                                        {selectedId ? 'Redigera OB-fönster' : 'Nytt OB-fönster'}
                                </h3>
                                <Input label="Namn" name="name" bind:value={name} {formErrors} />

                                <div class="grid gap-4 md:grid-cols-2">
                                        <Input
                                                label="Start"
                                                name="start_minutes"
                                                placeholder="HH:MM"
                                                bind:value={startTime}
                                                {formErrors}
                                        />
                                        <Input
                                                label="Slut"
                                                name="end_minutes"
                                                placeholder="HH:MM"
                                                bind:value={endTime}
                                                {formErrors}
                                        />
                                </div>

                                <div class="mb-2 mt-4">
                                        <p class="mb-2 text-sm font-medium text-gray-700">Veckodagar</p>
                                        <div class="flex flex-wrap gap-2">
                                                {#each WEEKDAYS as day}
                                                        <button
                                                                type="button"
                                                                class={`rounded-full border px-3 py-1 text-sm transition ${
                                                                        selectedDays.has(day.value)
                                                                                ? 'border-primary bg-primary text-white'
                                                                                : 'border-gray-200 text-gray-600 hover:border-primary'
                                                                }`}
                                                                on:click={() => toggleDay(day.value)}
                                                        >
                                                                {day.label}
                                                        </button>
                                                {/each}
                                        </div>
                                        {#if formErrors.weekday_mask}
                                                <p class="mt-2 text-sm text-red-500">{formErrors.weekday_mask}</p>
                                        {/if}
                                </div>

                                <div class="mt-4 flex flex-col gap-3 text-sm text-gray-700">
                                        <label class="flex items-center gap-2">
                                                <input type="checkbox" bind:checked={includeHolidays} class="h-4 w-4" />
                                                Inkludera helgdagar
                                        </label>
                                        <label class="flex items-center gap-2">
                                                <input type="checkbox" bind:checked={active} class="h-4 w-4" />
                                                Aktivt fönster
                                        </label>
                                </div>

                                {#if formError}
                                        <p class="mt-4 text-sm text-red-600">{formError}</p>
                                {/if}

                                <div class="mt-6 flex flex-wrap gap-2">
                                        <Button
                                                type="submit"
                                                text={selectedId ? 'Spara ändringar' : 'Lägg till fönster'}
                                                variant="primary"
                                                disabled={saving}
                                        />
                                        <Button
                                                type="button"
                                                text="Rensa"
                                                variant="secondary"
                                                small
                                                disabled={saving}
                                                on:click={resetForm}
                                        />
                                </div>
                        </form>
                </div>
        </div>
{/if}
