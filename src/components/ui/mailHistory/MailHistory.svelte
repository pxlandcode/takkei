<script lang="ts">
        import { onDestroy, onMount } from 'svelte';
        import Input from '../../bits/Input/Input.svelte';
        import Button from '../../bits/button/Button.svelte';
        import OptionButton from '../../bits/optionButton/OptionButton.svelte';
        import { openPopup } from '$lib/stores/popupStore';
        import { user } from '$lib/stores/userStore';
        import { hasRole } from '$lib/helpers/userHelpers/roleHelper';
        import { fetchMailHistory, fetchMailHistoryItem } from '$lib/services/mail/mailHistoryClient';
        import type { MailHistoryListItem } from '$lib/types/mailTypes';
        import MailHistoryDetail from './MailHistoryDetail.svelte';

        const PAGE_SIZE = 20;

        let items: MailHistoryListItem[] = [];
        let total = 0;
        let offset = 0;
        let hasMore = false;
        let loading = false;
        let detailLoading = false;
        let error: string | null = null;
        let detailError: string | null = null;

        let searchTerm = '';
        let startDate = '';
        let endDate = '';
        let searchTimeout: ReturnType<typeof setTimeout> | null = null;

        const viewOptions = [
                { value: 'mine', label: 'Mina' },
                { value: 'all', label: 'Alla' }
        ];
        let selectedViewOption = viewOptions[0];

        let currentUser: any = null;
        const unsubscribe = user.subscribe((value) => {
                currentUser = value;
        });

        onDestroy(() => {
                unsubscribe();
                if (searchTimeout) {
                        clearTimeout(searchTimeout);
                        searchTimeout = null;
                }
        });

        $: isAdmin = hasRole('Administrator', currentUser as any);
        $: if (!isAdmin && selectedViewOption.value !== 'mine') {
                selectedViewOption = viewOptions[0];
                loadHistory({ reset: true });
        }

        function formatDateTime(value: string) {
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return value;
                return date.toLocaleString('sv-SE', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                });
        }

        async function loadHistory({ reset = false } = {}) {
                if (loading) return;
                loading = true;
                error = null;
                if (reset) {
                        detailError = null;
                }

                const nextOffset = reset ? 0 : offset;

                try {
                        const onlyMine = !isAdmin || selectedViewOption?.value === 'mine';

                        const response = await fetchMailHistory({
                                limit: PAGE_SIZE,
                                offset: nextOffset,
                                search: searchTerm.trim() ? searchTerm.trim() : undefined,
                                startDate: startDate || undefined,
                                endDate: endDate || undefined,
                                mineOnly: onlyMine
                        });

                        if (reset) {
                                items = response.data;
                        } else {
                                items = [...items, ...response.data];
                        }

                        total = response.pagination?.total ?? items.length;
                        hasMore = response.pagination?.hasMore ?? false;
                        offset = (response.pagination?.offset ?? nextOffset) + response.data.length;
                } catch (err) {
                        console.error('Failed to load mail history', err);
                        error = err instanceof Error ? err.message : 'Kunde inte hämta mailhistorik.';
                } finally {
                        loading = false;
                }
        }

        async function loadMore() {
                if (!hasMore || loading) return;
                await loadHistory({ reset: false });
        }

        function handleSearchInput(event: Event) {
                const value = (event.target as HTMLInputElement)?.value ?? '';
                searchTerm = value;
                if (searchTimeout) clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                        loadHistory({ reset: true });
                }, 300);
        }

        function handleDateChange(event: Event, type: 'start' | 'end') {
                const value = (event.target as HTMLInputElement)?.value ?? '';
                if (type === 'start') {
                        startDate = value;
                } else {
                        endDate = value;
                }
                loadHistory({ reset: true });
        }

        function handleViewSelect(event: CustomEvent<'mine' | 'all'>) {
                const value = event.detail;
                selectedViewOption = viewOptions.find((option) => option.value === value) ?? viewOptions[0];
                loadHistory({ reset: true });
        }

        function resetFilters() {
                searchTerm = '';
                startDate = '';
                endDate = '';
                if (isAdmin) {
                        selectedViewOption = viewOptions[0];
                }
                loadHistory({ reset: true });
        }

        async function openDetails(item: MailHistoryListItem) {
                if (detailLoading) return;
                detailError = null;
                detailLoading = true;
                try {
                        const mail = await fetchMailHistoryItem(item.id);
                        openPopup({
                                header: 'Maildetaljer',
                                icon: 'History',
                                component: MailHistoryDetail,
                                width: '960px',
                                props: { mail }
                        });
                } catch (err) {
                        console.error('Failed to fetch mail history item', err);
                        detailError = err instanceof Error ? err.message : 'Kunde inte hämta mailet.';
                } finally {
                        detailLoading = false;
                }
        }

        onMount(() => {
                loadHistory({ reset: true });
        });
</script>

<div class="flex flex-col gap-6">
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Input
                        label="Sök"
                        name="mail-history-search"
                        placeholder="Sök ämne, avsändare eller mottagare"
                        bind:value={searchTerm}
                        on:input={handleSearchInput}
                />

                <Input
                        label="Från datum"
                        name="mail-history-start"
                        type="date"
                        bind:value={startDate}
                        on:change={(event) => handleDateChange(event, 'start')}
                />

                <Input
                        label="Till datum"
                        name="mail-history-end"
                        type="date"
                        bind:value={endDate}
                        on:change={(event) => handleDateChange(event, 'end')}
                />

                <div class="flex items-end justify-end gap-2">
                        {#if isAdmin}
                                <OptionButton
                                        label="Visa"
                                        options={viewOptions}
                                        bind:selectedOption={selectedViewOption}
                                        variant="gray"
                                        size="small"
                                        on:select={handleViewSelect}
                                />
                        {/if}
                        <Button text="Rensa filter" variant="secondary" on:click={resetFilters} small />
                </div>
        </div>

        {#if error}
                <div class="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        {/if}
        {#if detailError}
                <div class="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">{detailError}</div>
        {/if}

        <div class="overflow-x-auto rounded border border-gray-200 bg-white">
                <table class="min-w-full divide-y divide-gray-200 text-left text-sm">
                        <thead class="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                        <th class="px-4 py-3">Skickat</th>
                                        <th class="px-4 py-3">Ämne</th>
                                        <th class="px-4 py-3">Mottagare</th>
                                        {#if isAdmin && selectedViewOption.value === 'all'}
                                                <th class="px-4 py-3">Avsändare</th>
                                        {/if}
                                        <th class="px-4 py-3 text-right">Åtgärder</th>
                                </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100">
                                {#if loading && items.length === 0}
                                        <tr>
                                                <td colspan={isAdmin && selectedViewOption.value === 'all' ? 5 : 4} class="px-4 py-6">
                                                        <div class="flex items-center justify-center gap-2 text-gray-500">
                                                                <svg
                                                                        class="h-5 w-5 animate-spin text-gray-400"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        fill="none"
                                                                        viewBox="0 0 24 24"
                                                                >
                                                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                                                        <path
                                                                                class="opacity-75"
                                                                                fill="currentColor"
                                                                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                                                        ></path>
                                                                </svg>
                                                                <span>Laddar mailhistorik...</span>
                                                        </div>
                                                </td>
                                        </tr>
                                {:else if items.length === 0}
                                        <tr>
                                                <td colspan={isAdmin && selectedViewOption.value === 'all' ? 5 : 4} class="px-4 py-6 text-center text-gray-500">
                                                        Inga utskick hittades.
                                                </td>
                                        </tr>
                                {:else}
                                        {#each items as item}
                                                <tr class="cursor-pointer hover:bg-gray-50" on:click={() => openDetails(item)}>
                                                        <td class="px-4 py-3 align-top text-gray-600">{formatDateTime(item.sent_at)}</td>
                                                        <td class="px-4 py-3 align-top">
                                                                <div class="font-semibold text-gray-900">{item.subject}</div>
                                                                {#if item.body_text_preview}
                                                                        <div class="mt-1 line-clamp-2 text-xs text-gray-500">{item.body_text_preview}</div>
                                                                {/if}
                                                        </td>
                                                        <td class="px-4 py-3 align-top text-gray-700">{item.recipients_count}</td>
                                                        {#if isAdmin && selectedViewOption.value === 'all'}
                                                                <td class="px-4 py-3 align-top text-gray-700">
                                                                        {item.sender_name || item.sender_email || '—'}
                                                                </td>
                                                        {/if}
                                                        <td class="px-4 py-3 align-top text-right">
                                                                <Button
                                                                        text="Visa"
                                                                        variant="secondary"
                                                                        small
                                                                        iconRight="ArrowRight"
                                                                        on:click|stopPropagation={() => openDetails(item)}
                                                                />
                                                        </td>
                                                </tr>
                                        {/each}
                                {/if}
                        </tbody>
                </table>
        </div>

        {#if loading && items.length > 0}
                <div class="flex items-center justify-center gap-2 text-sm text-gray-500">
                        <svg
                                class="h-4 w-4 animate-spin text-gray-400"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                        >
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                        </svg>
                        <span>Laddar fler utskick...</span>
                </div>
        {/if}

        {#if hasMore && !loading}
                <div class="flex justify-center">
                        <Button text="Hämta fler" variant="secondary" on:click={loadMore} />
                </div>
        {/if}

        {#if !hasMore && !loading && items.length > 0}
                <p class="text-center text-xs text-gray-400">Alla resultat visas.</p>
        {/if}
</div>
