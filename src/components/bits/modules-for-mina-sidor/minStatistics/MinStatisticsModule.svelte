<script lang="ts">
        import { onMount } from 'svelte';
        import Icon from '../../icon-component/Icon.svelte';
        import Button from '../../button/Button.svelte';
        import {
                formatDateInputValue,
                getMockTrainerStatistics,
                getPresetRange,
                type StatisticsPreset,
                type TrainerStatisticsResponse
        } from '$lib/api/statistics';

        let statistics: TrainerStatisticsResponse | null = null;
        let loading = true;
        let detailsDialog: HTMLDialogElement | null = null;
        let isDialogOpen = false;

        let startDate = '';
        let endDate = '';
        let activePreset: StatisticsPreset | null = 'currentMonth';

        onMount(async () => {
                const initialRange = getPresetRange('currentMonth');
                startDate = formatDateInputValue(initialRange.start);
                endDate = formatDateInputValue(initialRange.end);

                statistics = await getMockTrainerStatistics();
                loading = false;
        });

        function openDialog() {
                if (!detailsDialog) return;
                if (typeof detailsDialog.showModal === 'function') {
                        detailsDialog.showModal();
                        isDialogOpen = true;
                }
        }

        function setPreset(preset: StatisticsPreset) {
                activePreset = preset;
                const range = getPresetRange(preset);
                startDate = formatDateInputValue(range.start);
                endDate = formatDateInputValue(range.end);
        }

        function handleManualDateChange() {
                activePreset = null;
        }

        function handleExport() {
                if (typeof window !== 'undefined') {
                        window.alert('Export kommer snart!');
                } else {
                        console.info('Export kommer snart!');
                }
        }

        function deltaClasses(delta?: string) {
                if (!delta) return 'hidden';
                const trimmed = delta.trim();
                if (trimmed.startsWith('-')) {
                        return 'inline-flex items-center rounded-full bg-red-background px-2 py-0.5 text-xs font-medium text-error';
                }
                return 'inline-flex items-center rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-success';
        }

        $: tableRows = statistics?.table.rows ?? [];
        $: tableTotal = statistics?.table.total;
</script>

<div class="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div class="flex items-center justify-between bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
                <div class="flex items-center gap-3">
                        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                                <Icon icon="Charts" size="22px" />
                        </div>
                        <div>
                                <h3 class="text-lg font-semibold text-text">Min statistik</h3>
                                <p class="text-xs text-gray-medium">Snabb överblick över dina debiterbara insatser</p>
                        </div>
                </div>
                <Button
                        text="Visa mer statistik"
                        variant="secondary"
                        small
                        iconRight="ChevronRight"
                        on:click={openDialog}
                        aria-haspopup="dialog"
                        aria-expanded={isDialogOpen}
                />
        </div>

        <div class="flex flex-1 flex-col gap-4 p-4 text-sm">
                {#if loading}
                        <p class="text-gray-medium">Laddar statistik…</p>
                {:else if !statistics}
                        <p class="text-gray-medium">Kunde inte läsa in statistik just nu.</p>
                {:else}
                        <section class="flex flex-col gap-3">
                                <h4 class="text-sm font-semibold uppercase tracking-wide text-gray-medium">Debiterbara bokningar</h4>
                                <div class="grid gap-3 md:grid-cols-3">
                                        {#each Object.values(statistics.debiterbaraBokningar) as entry (entry.label)}
                                                <div class="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                                                        <div class="flex items-center justify-between">
                                                                <p class="text-xs font-medium uppercase text-gray-medium">{entry.label}</p>
                                                                <span class={deltaClasses(entry.deltaLabel)}>{entry.deltaLabel}</span>
                                                        </div>
                                                        <p class="mt-1 text-2xl font-semibold text-text">{entry.totalBookings}</p>
                                                        <p class="mt-1 text-xs text-gray-medium">
                                                                Pass med OB-tillägg: <span class="font-medium text-text">{entry.obBookings}</span>
                                                        </p>
                                                </div>
                                        {/each}
                                </div>
                        </section>

                        <section class="grid gap-3 md:grid-cols-2">
                                <div class="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <div class="flex items-center justify-between">
                                                <h4 class="text-sm font-semibold text-text">Debiterade pass hittills</h4>
                                                <span class={deltaClasses(statistics.debiteradePass.deltaLabel)}>
                                                        {statistics.debiteradePass.deltaLabel}
                                                </span>
                                        </div>
                                        <p class="mt-2 text-3xl font-semibold text-text">{statistics.debiteradePass.monthHours} h</p>
                                        <p class="text-xs text-gray-medium">Denna månad</p>
                                </div>
                                <div class="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <div class="flex items-center justify-between">
                                                <h4 class="text-sm font-semibold text-text">Bokade demoträningar</h4>
                                                <span class={deltaClasses(statistics.demotraningar.deltaLabel)}>
                                                        {statistics.demotraningar.deltaLabel}
                                                </span>
                                        </div>
                                        <p class="mt-2 text-3xl font-semibold text-text">{statistics.demotraningar.monthCount}</p>
                                        <p class="text-xs text-gray-medium">Denna månad</p>
                                </div>
                        </section>

                        <section class="grid gap-3 md:grid-cols-2">
                                <div class="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <div class="flex items-center justify-between">
                                                <h4 class="text-sm font-semibold text-text">Debiterbara timmar</h4>
                                                <span class={deltaClasses(statistics.debiterbaraTimmar.deltaLabel)}>
                                                        {statistics.debiterbaraTimmar.deltaLabel}
                                                </span>
                                        </div>
                                        <div class="mt-3 grid gap-2 text-xs text-gray-medium">
                                                <div class="flex items-center justify-between rounded-md bg-gray-50 p-2">
                                                        <span class="font-medium text-text">Denna vecka</span>
                                                        <span class="font-semibold text-text">{statistics.debiterbaraTimmar.weekHours} h</span>
                                                </div>
                                                <div class="flex items-center justify-between rounded-md bg-gray-50 p-2">
                                                        <span class="font-medium text-text">Denna månad</span>
                                                        <span class="font-semibold text-text">{statistics.debiterbaraTimmar.monthHours} h</span>
                                                </div>
                                        </div>
                                </div>
                                <div class="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                                        <h4 class="text-sm font-semibold text-text">Anteckning</h4>
                                        <p class="mt-2 text-xs text-gray-medium">
                                                Statistikdata hämtas i dagsläget från en mockad källa via <code class="rounded bg-gray-50 px-1 py-0.5">getMockTrainerStatistics</code>.
                                                Byt till riktigt API-anrop när endpointen är redo.
                                        </p>
                                </div>
                        </section>
                {/if}
        </div>
</div>

<dialog
        bind:this={detailsDialog}
        class="w-full max-w-3xl rounded-xl border border-gray-200 p-0 shadow-2xl backdrop:bg-black/40"
        on:close={() => (isDialogOpen = false)}
>
        <form method="dialog" class="flex flex-col gap-4">
                <header class="flex items-start justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4">
                        <div>
                                <h3 class="text-lg font-semibold text-text">Detaljerad statistik</h3>
                                <p class="text-sm text-gray-medium">Filtrera perioden och exportera dina siffror.</p>
                        </div>
                        <button
                                type="submit"
                                class="rounded-full border border-gray-200 p-2 text-gray-medium transition hover:border-gray-300 hover:text-text"
                                aria-label="Stäng statistik"
                        >
                                <Icon icon="Close" size="16px" />
                        </button>
                </header>

                <section class="px-6">
                        <h4 class="text-sm font-semibold text-text">Välj period</h4>
                        <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div class="flex items-center gap-2 text-sm">
                                        <label class="text-gray-medium" for="statistics-start">Från</label>
                                        <input
                                                id="statistics-start"
                                                class="rounded border border-gray-200 px-3 py-1 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                                type="date"
                                                bind:value={startDate}
                                                on:change={handleManualDateChange}
                                        />
                                        <label class="text-gray-medium" for="statistics-end">Till</label>
                                        <input
                                                id="statistics-end"
                                                class="rounded border border-gray-200 px-3 py-1 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                                type="date"
                                                bind:value={endDate}
                                                on:change={handleManualDateChange}
                                        />
                                </div>
                                <div class="flex flex-wrap gap-2">
                                        <button
                                                type="button"
                                                class={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                                                        activePreset === 'currentWeek'
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-gray-200 text-text hover:border-primary/60'
                                                }`}
                                                on:click={() => setPreset('currentWeek')}
                                                aria-pressed={activePreset === 'currentWeek'}
                                        >
                                                Denna vecka
                                        </button>
                                        <button
                                                type="button"
                                                class={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                                                        activePreset === 'currentMonth'
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-gray-200 text-text hover:border-primary/60'
                                                }`}
                                                on:click={() => setPreset('currentMonth')}
                                                aria-pressed={activePreset === 'currentMonth'}
                                        >
                                                Denna månad
                                        </button>
                                        <button
                                                type="button"
                                                class={`rounded-full border px-3 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                                                        activePreset === 'previousMonth'
                                                                ? 'border-primary bg-primary/10 text-primary'
                                                                : 'border-gray-200 text-text hover:border-primary/60'
                                                }`}
                                                on:click={() => setPreset('previousMonth')}
                                                aria-pressed={activePreset === 'previousMonth'}
                                        >
                                                Föregående månad
                                        </button>
                                </div>
                        </div>
                </section>

                <section class="overflow-x-auto px-6">
                        <table class="min-w-full divide-y divide-gray-200 text-sm">
                                <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-medium">
                                        <tr>
                                                <th scope="col" class="px-3 py-3">Typ</th>
                                                <th scope="col" class="px-3 py-3">Timmar</th>
                                                <th scope="col" class="px-3 py-3">Sena avbokningar</th>
                                                <th scope="col" class="px-3 py-3">Summa OB-tillägg</th>
                                        </tr>
                                </thead>
                                <tbody class="divide-y divide-gray-100 text-text">
                                        {#if statistics}
                                                {#each tableRows as row (row.type)}
                                                        <tr>
                                                                <td class="whitespace-nowrap px-3 py-3 font-medium">{row.type}</td>
                                                                <td class="px-3 py-3">{row.hours}</td>
                                                                <td class="px-3 py-3">{row.lateCancellations}</td>
                                                                <td class="px-3 py-3">{row.obTotal}</td>
                                                        </tr>
                                                {/each}
                                                {#if tableTotal}
                                                        <tr class="bg-gray-50 font-semibold">
                                                                <td class="px-3 py-3">{tableTotal.type}</td>
                                                                <td class="px-3 py-3">{tableTotal.hours}</td>
                                                                <td class="px-3 py-3">{tableTotal.lateCancellations}</td>
                                                                <td class="px-3 py-3">{tableTotal.obTotal}</td>
                                                        </tr>
                                                {/if}
                                        {/if}
                                </tbody>
                        </table>
                </section>

                <footer class="flex flex-col items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 text-sm md:flex-row">
                        <p class="text-gray-medium">
                                Exportfunktion är mockad. Anslut mot backend-API när statistikexport är implementerad.
                        </p>
                        <button
                                type="button"
                                class="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-text transition hover:border-primary/60 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                on:click={handleExport}
                        >
                                <Icon icon="Download" size="16px" />
                                Exportera CSV
                        </button>
                </footer>
        </form>
</dialog>
