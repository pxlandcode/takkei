<script lang="ts">
        import { onMount } from 'svelte';
        import { Datepicker } from '@pixelcode_/blocks/components';

        import Table from '../../../bits/table/Table.svelte';
        import Button from '../../../bits/button/Button.svelte';
        import OptionButton from '../../../bits/optionButton/OptionButton.svelte';
        import Icon from '../../../bits/icon-component/Icon.svelte';

        import { addToast } from '$lib/stores/toastStore';
        import { AppToastType } from '$lib/types/toastTypes';
        import type { TableType } from '$lib/types/componentTypes';
        import { debounce } from '$lib/utils/debounce';

        type SalaryReportDetail = {
                id: number;
                startTime: string;
                endTime: string | null;
                durationMinutes: number;
                obMinutes?: number;
                clientName: string | null;
                customerName: string | null;
                bookingType: string | null;
                locationName: string | null;
        };

        type SalaryReportExtraDuty = {
                id: number;
                name: string;
                approved: boolean;
                note: string | null;
        };

        type SalaryReportTrainer = {
                id: number;
                name: string;
                email: string | null;
                locationId: number | null;
                locationName: string | null;
                weekdayHours: number;
                obHours: number;
                weekendHours: number;
                holidayHours: number;
                educationHours: number;
                tryOutHours: number;
                internalHours: number;
                totalHours: number;
                sessionCount: number;
                approvedExtra: number;
                pendingExtra: number;
                weekday: SalaryReportDetail[];
                ob: SalaryReportDetail[];
                weekend: SalaryReportDetail[];
                holiday: SalaryReportDetail[];
                education: SalaryReportDetail[];
                tryOut: SalaryReportDetail[];
                internal: SalaryReportDetail[];
                extraDuties: SalaryReportExtraDuty[];
        };

        type SalaryReportResponse = {
                month: number;
                year: number;
                generatedAt: string;
                range: { start: string; end: string };
                isMonthComplete: boolean;
                trainers: SalaryReportTrainer[];
        };

        type Option = { value: string; label: string };

        const dateFormatter = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium' });
        const dateTimeFormatter = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });

        function formatDate(value: string | null | undefined) {
                if (!value) return '—';
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return value;
                try {
                        return dateFormatter.format(date);
                } catch (error) {
                        console.warn('Failed to format date', error);
                        return value;
                }
        }

        function formatDateTime(value: string | null | undefined) {
                if (!value) return '—';
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return value;
                try {
                        return dateTimeFormatter.format(date);
                } catch (error) {
                        console.warn('Failed to format datetime', error);
                        return value;
                }
        }

        function monthString(date: Date) {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                return `${year}-${month}`;
        }

        function previousMonthKey(reference: string) {
                if (!reference) return monthString(new Date());
                const [yearStr, monthStr] = reference.split('-');
                const date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
                date.setMonth(date.getMonth() - 1);
                return monthString(date);
        }

        function normalizeMonth(value: string | null | undefined) {
                return value ? value.slice(0, 7) : '';
        }

        function minutesToHours(minutes: number) {
                if (!minutes) return 0;
                return Math.round(((minutes / 60) + Number.EPSILON) * 100) / 100;
        }

        const monthPickerOptions = {
                view: 'months',
                minView: 'months',
                dateFormat: 'yyyy-MM',
                maxDate: new Date()
        } as const;

        const quickOptions: Option[] = [
                { value: 'current', label: 'Nuvarande månad' },
                { value: 'previous', label: 'Föregående månad' }
        ];

        let selectedQuickOption: Option = quickOptions[0];
        let monthInput = monthString(new Date());
        let selectedMonth = monthInput;

        let loading = false;
        let isExporting = false;
        let filtersReady = false;
        let errorMessage: string | null = null;

        let report: SalaryReportResponse | null = null;
        let trainers: SalaryReportTrainer[] = [];
        let tableRows: TableType = [];
        let filteredRows: TableType = [];
        let searchQuery = '';
        let selectedTrainerId: number | null = null;
        let selectedTrainer: SalaryReportTrainer | null = null;
        let summary = {
                trainerCount: 0,
                totalHours: 0,
                obHours: 0,
                weekendHours: 0,
                pendingExtra: 0
        };

        const debouncedSearch = debounce(() => {
                applySearchFilter();
        }, 200);

        const headers = [
                { label: 'Tränare', key: 'trainer', sort: true, isSearchable: true },
                { label: 'E-post', key: 'email', isSearchable: true },
                { label: 'Plats', key: 'location', isSearchable: true },
                { label: 'Totala timmar', key: 'totalHours', sort: true },
                { label: 'Vardagstimmar', key: 'weekdayHours', sort: true },
                { label: 'OB-timmar', key: 'obHours', sort: true },
                { label: 'Helgtimmar', key: 'weekendHours', sort: true },
                { label: 'Helgdagstimmar', key: 'holidayHours', sort: true },
                { label: 'Utbildning', key: 'educationHours', sort: true },
                { label: 'Prova-på', key: 'tryOutHours', sort: true },
                { label: 'Interna', key: 'internalHours', sort: true },
                { label: 'Pass', key: 'sessionCount', sort: true },
                { label: 'Godkända extra', key: 'approvedExtra', sort: true },
                { label: 'Avvaktande extra', key: 'pendingExtra', sort: true },
                { label: 'Åtgärder', key: 'actions' }
        ];

        onMount(() => {
                filtersReady = true;
        });

        $: normalizedInput = normalizeMonth(monthInput);
        $: if (monthInput !== normalizedInput) {
                monthInput = normalizedInput;
        }
        $: if (selectedMonth !== monthInput) {
                selectedMonth = monthInput;
        }

        $: filterSignature = filtersReady ? selectedMonth : '';
        $: if (filtersReady && filterSignature) {
                fetchReport();
        }

        $: if (filtersReady) {
                searchQuery;
                debouncedSearch();
        }

        $: selectedTrainer = selectedTrainerId
                ? trainers.find((trainer) => trainer.id === selectedTrainerId) ?? null
                : null;

        $: {
                const base = {
                        trainerCount: 0,
                        totalHours: 0,
                        obHours: 0,
                        weekendHours: 0,
                        pendingExtra: 0
                };
                summary = trainers.reduce((acc, trainer) => {
                        acc.totalHours += trainer.totalHours;
                        acc.obHours += trainer.obHours;
                        acc.weekendHours += trainer.weekendHours;
                        acc.pendingExtra += trainer.pendingExtra;
                        return acc;
                }, base);
                summary.trainerCount = trainers.length;
        }

        function mapTrainerToRow(trainer: SalaryReportTrainer) {
                return {
                        id: trainer.id,
                        trainer: trainer.name,
                        email: trainer.email ?? '—',
                        location: trainer.locationName ?? '—',
                        totalHours: trainer.totalHours,
                        weekdayHours: trainer.weekdayHours,
                        obHours: trainer.obHours,
                        weekendHours: trainer.weekendHours,
                        holidayHours: trainer.holidayHours,
                        educationHours: trainer.educationHours,
                        tryOutHours: trainer.tryOutHours,
                        internalHours: trainer.internalHours,
                        sessionCount: trainer.sessionCount,
                        approvedExtra: trainer.approvedExtra,
                        pendingExtra: trainer.pendingExtra,
                        actions: [
                                {
                                        type: 'button',
                                        label: 'Visa detaljer',
                                        icon: 'Eye',
                                        variant: 'secondary',
                                        action: () => selectTrainer(trainer.id)
                                }
                        ]
                };
        }

        function applySearchFilter() {
                const query = searchQuery.trim().toLowerCase();
                if (!query) {
                        filteredRows = [...tableRows];
                        return;
                }

                filteredRows = tableRows.filter((row) => {
                        const searchableKeys = ['trainer', 'email', 'location'];
                        return searchableKeys.some((key) => {
                                const value = row[key];
                                if (typeof value === 'string') {
                                        return value.toLowerCase().includes(query);
                                }
                                if (typeof value === 'number') {
                                        return value.toString().includes(query);
                                }
                                return false;
                        });
                });
        }

        async function fetchReport() {
                if (!selectedMonth) return;
                loading = true;
                errorMessage = null;
                selectedTrainerId = null;

                try {
                        const params = new URLSearchParams({ month: selectedMonth });
                        const res = await fetch(`/api/reports/salary?${params.toString()}`);
                        if (!res.ok) {
                                const text = await res.text();
                                throw new Error(text || 'Request failed');
                        }
                        report = (await res.json()) as SalaryReportResponse;
                        trainers = report.trainers;
                        tableRows = trainers.map(mapTrainerToRow);
                        applySearchFilter();
                } catch (error) {
                        console.error('Failed to load salary report', error);
                        errorMessage = 'Kunde inte hämta rapporten.';
                        addToast({
                                type: AppToastType.ERROR,
                                message: 'Misslyckades med att hämta löneunderlaget.'
                        });
                        trainers = [];
                        tableRows = [];
                        filteredRows = [];
                        report = null;
                } finally {
                        loading = false;
                }
        }

        async function exportReport() {
                if (!selectedMonth || isExporting) return;
                isExporting = true;
                try {
                        const params = new URLSearchParams({ month: selectedMonth });
                        const res = await fetch(`/api/reports/salary/export?${params.toString()}`);
                        if (!res.ok) {
                                const text = await res.text();
                                throw new Error(text || 'Export failed');
                        }
                        const blob = await res.blob();
                        const disposition = res.headers.get('Content-Disposition');
                        let filename = 'loneunderlag.xlsx';
                        if (disposition) {
                                const match = disposition.match(/filename="?([^";]+)"?/i);
                                if (match?.[1]) filename = match[1];
                        }
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                        addToast({
                                type: AppToastType.SUCCESS,
                                message: 'Exporten har påbörjats.'
                        });
                } catch (error) {
                        console.error('Failed to export salary report', error);
                        addToast({
                                type: AppToastType.ERROR,
                                message: 'Kunde inte exportera löneunderlaget.'
                        });
                } finally {
                        isExporting = false;
                }
        }

        function selectTrainer(id: number) {
                selectedTrainerId = selectedTrainerId === id ? null : id;
        }

        function onQuickSelect(event: CustomEvent<string>) {
                const value = event.detail;
                const option = quickOptions.find((item) => item.value === value);
                if (!option) return;
                selectedQuickOption = option;
                if (option.value === 'current') {
                                monthInput = monthString(new Date());
                } else if (option.value === 'previous') {
                                monthInput = previousMonthKey(monthInput);
                }
        }

        function bucketMinutes(values: SalaryReportDetail[], extractor: (item: SalaryReportDetail) => number) {
                return values.reduce((acc, item) => acc + extractor(item), 0);
        }

        const detailBuckets = (
                trainer: SalaryReportTrainer | null
        ) =>
                trainer
                        ? [
                                        {
                                                key: 'weekday',
                                                label: 'Vardagar',
                                                entries: trainer.weekday,
                                                minutes: bucketMinutes(trainer.weekday, (item) => item.durationMinutes)
                                        },
                                        {
                                                key: 'ob',
                                                label: 'OB',
                                                entries: trainer.ob,
                                                minutes: bucketMinutes(
                                                        trainer.ob,
                                                        (item) => item.obMinutes ?? item.durationMinutes
                                                )
                                        },
                                        {
                                                key: 'weekend',
                                                label: 'Helg',
                                                entries: trainer.weekend,
                                                minutes: bucketMinutes(trainer.weekend, (item) => item.durationMinutes)
                                        },
                                        {
                                                key: 'holiday',
                                                label: 'Helgdag',
                                                entries: trainer.holiday,
                                                minutes: bucketMinutes(trainer.holiday, (item) => item.durationMinutes)
                                        },
                                        {
                                                key: 'education',
                                                label: 'Utbildning',
                                                entries: trainer.education,
                                                minutes: bucketMinutes(trainer.education, (item) => item.durationMinutes)
                                        },
                                        {
                                                key: 'tryOut',
                                                label: 'Prova-på',
                                                entries: trainer.tryOut,
                                                minutes: bucketMinutes(trainer.tryOut, (item) => item.durationMinutes)
                                        },
                                        {
                                                key: 'internal',
                                                label: 'Interna',
                                                entries: trainer.internal,
                                                minutes: bucketMinutes(trainer.internal, (item) => item.durationMinutes)
                                        }
                                ]
                        : [];
</script>

<div class="custom-scrollbar m-4 flex h-full flex-col gap-6 overflow-x-auto">
        <div class="flex items-center gap-2">
                <div class="bg-text flex h-7 w-7 items-center justify-center rounded-full text-white">
                        <Icon icon="Money" size="14px" />
                </div>
                <h2 class="text-text text-3xl font-semibold">Löneunderlag</h2>
        </div>

        <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div class="flex flex-col gap-4">
                        <label class="flex flex-col gap-1">
                                <span class="text-text/70 text-sm">Månad</span>
                                <Datepicker bind:value={monthInput} options={monthPickerOptions} placeholder="Välj månad" />
                        </label>
                        <div class="max-w-sm">
                                <OptionButton
                                        options={quickOptions}
                                        bind:selectedOption={selectedQuickOption}
                                        size="small"
                                        on:select={onQuickSelect}
                                />
                        </div>
                        <input
                                class="w-full rounded-sm border border-gray-300 p-2 focus:border-blue-500 focus:outline-hidden"
                                type="search"
                                bind:value={searchQuery}
                                placeholder="Sök tränare, e-post eller plats"
                        />
                        {#if report}
                                <div class="text-text/70 text-sm">
                                        <div>Period: {formatDate(report.range.start)} – {formatDate(report.range.end)}</div>
                                        <div>Genererad: {formatDateTime(report.generatedAt)}</div>
                                        <div>
                                                Status: {report.isMonthComplete ? 'Månaden är avslutad' : 'Månaden pågår'}
                                        </div>
                                </div>
                        {/if}
                </div>
                <div class="flex justify-end">
                        <Button
                                text="Exportera"
                                variant="primary"
                                iconLeft="Download"
                                iconColor="white"
                                iconSize="12px"
                                disabled={isExporting || loading}
                                on:click={exportReport}
                        />
                </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <p class="text-text/60 text-xs uppercase">Tränare</p>
                        <p class="text-text text-2xl font-semibold">{summary.trainerCount}</p>
                </div>
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <p class="text-text/60 text-xs uppercase">Totala timmar</p>
                        <p class="text-text text-2xl font-semibold">{summary.totalHours.toFixed(2)}</p>
                </div>
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <p class="text-text/60 text-xs uppercase">OB-timmar</p>
                        <p class="text-text text-2xl font-semibold">{summary.obHours.toFixed(2)}</p>
                </div>
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <p class="text-text/60 text-xs uppercase">Helgtimmar</p>
                        <p class="text-text text-2xl font-semibold">{summary.weekendHours.toFixed(2)}</p>
                </div>
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <p class="text-text/60 text-xs uppercase">Avvaktande extra</p>
                        <p class="text-text text-2xl font-semibold">{summary.pendingExtra}</p>
                </div>
        </div>

        {#if errorMessage && !loading}
                <div class="rounded-sm border border-red-200 bg-red-50 p-4 text-red-700">
                        <p class="mb-2 font-semibold">{errorMessage}</p>
                        <Button text="Försök igen" variant="secondary" on:click={fetchReport} />
                </div>
        {/if}

        {#if loading}
                <div class="text-text/60 py-10">Laddar löneunderlag…</div>
        {:else if errorMessage}
                <!-- Fel visas ovan -->
        {:else if trainers.length === 0}
                <div class="text-text/70 py-10">Inga bokningar hittades för vald månad.</div>
        {:else}
                <Table {headers} data={filteredRows} noSelect sideScrollable />
        {/if}

        {#if selectedTrainer}
                <div class="rounded-sm border border-gray-200 bg-white p-4 shadow-sm">
                        <div class="mb-4 flex items-start justify-between gap-4">
                                <div>
                                        <h3 class="text-text text-xl font-semibold">{selectedTrainer.name}</h3>
                                        <p class="text-text/70 text-sm">
                                                {selectedTrainer.email ?? 'Ingen e-post'} · {selectedTrainer.locationName ?? 'Ingen plats'}
                                        </p>
                                </div>
                                <Button text="Stäng" variant="ghost" on:click={() => (selectedTrainerId = null)} />
                        </div>

                        <div class="grid gap-4 md:grid-cols-2">
                                {#each detailBuckets(selectedTrainer) as bucket}
                                        <details class="rounded-sm border border-gray-200 p-3" open>
                                                <summary class="cursor-pointer font-semibold">
                                                        {bucket.label} ({bucket.entries.length} st, {minutesToHours(bucket.minutes).toFixed(2)} h)
                                                </summary>
                                                {#if bucket.entries.length === 0}
                                                        <p class="text-text/60 mt-2 text-sm">Ingen data.</p>
                                                {:else}
                                                        <ul class="mt-2 space-y-2 text-sm">
                                                                {#each bucket.entries as entry}
                                                                        <li class="rounded-sm bg-gray-50 p-2">
                                                                                <p class="font-medium">
                                                                                        {formatDateTime(entry.startTime)} – {formatDateTime(entry.endTime)}
                                                                                </p>
                                                                                <p class="text-text/70">
                                                                                        {minutesToHours(
                                                                                                bucket.key === 'ob'
                                                                                                        ? entry.obMinutes ?? entry.durationMinutes
                                                                                                        : entry.durationMinutes
                                                                                        ).toFixed(2)}
                                                                                        h ({entry.durationMinutes} min)
                                                                                </p>
                                                                                <p class="text-text/70">
                                                                                        {entry.clientName ?? 'Okänd klient'}
                                                                                        {#if entry.customerName}
                                                                                                · {entry.customerName}
                                                                                        {/if}
                                                                                        {#if entry.bookingType}
                                                                                                · {entry.bookingType}
                                                                                        {/if}
                                                                                        {#if entry.locationName}
                                                                                                · {entry.locationName}
                                                                                        {/if}
                                                                                </p>
                                                                        </li>
                                                                {/each}
                                                        </ul>
                                                {/if}
                                        </details>
                                {/each}
                        </div>

                        <div class="mt-6">
                                <h4 class="text-text text-lg font-semibold">Extra uppdrag</h4>
                                {#if selectedTrainer.extraDuties.length === 0}
                                        <p class="text-text/70 text-sm">Inga extra uppdrag registrerade.</p>
                                {:else}
                                        <ul class="mt-2 space-y-2 text-sm">
                                                {#each selectedTrainer.extraDuties as duty}
                                                        <li class="rounded-sm border border-gray-200 p-2">
                                                                <p class="font-medium">{duty.name}</p>
                                                                <p class="text-text/70">
                                                                        Status: {duty.approved ? 'Godkänd' : 'Avvaktande'}
                                                                        {#if duty.note}
                                                                                · {duty.note}
                                                                        {/if}
                                                                </p>
                                                        </li>
                                                {/each}
                                        </ul>
                                {/if}
                        </div>
                </div>
        {/if}
</div>
