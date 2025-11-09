<script lang="ts">
        import type { FullBooking } from '$lib/types/calendarTypes';

        export let bookings: FullBooking[] = [];

        const statusLabels: Record<string, string> = {
                Confirmed: 'Bekräftad',
                Cancelled: 'Avbokad',
                Late_cancelled: 'Sen avbokning'
        };

        function formatDateTime(isoDate: string) {
                const date = new Date(isoDate);
                return {
                        date: date.toLocaleDateString('sv-SE', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                        }),
                        time: date.toLocaleTimeString('sv-SE', {
                                hour: '2-digit',
                                minute: '2-digit'
                        })
                };
        }

        function displayStatus(status: string | null | undefined, isPersonal: boolean) {
                if (isPersonal) return 'Planerad';
                if (!status) return 'Okänt';
                return statusLabels[status] ?? status;
        }

        function trainerName(booking: FullBooking) {
                if (booking.isPersonalBooking) {
                        return booking.personalBooking?.name?.trim() || 'Personlig bokning';
                }
                if (booking.trainer) {
                        return `${booking.trainer.firstname ?? ''} ${booking.trainer.lastname ?? ''}`.trim() || 'Ej tilldelad';
                }
                return 'Ej tilldelad';
        }

        function locationName(booking: FullBooking) {
                return booking.location?.name ?? 'Ej angiven';
        }

        $: sortedBookings = [...bookings].sort(
                (a, b) => new Date(a.booking.startTime).getTime() - new Date(b.booking.startTime).getTime()
        );

        const now = Date.now();
        $: upcoming = sortedBookings.filter((booking) => new Date(booking.booking.startTime).getTime() >= now);
        $: past = sortedBookings
                .filter((booking) => new Date(booking.booking.startTime).getTime() < now)
                .reverse();
</script>

<section class="space-y-6 rounded-sm bg-white p-6 shadow-md">
        <div class="flex flex-col gap-1 border-b border-gray-200 pb-4">
                <h2 class="text-xl font-semibold text-gray-900">Mina bokningar</h2>
                <p class="text-sm text-gray-600">
                        Här ser du dina kommande tider och historik. Kontakta din tränare om du behöver göra ändringar.
                </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
                <div class="space-y-4">
                        <h3 class="text-lg font-medium text-gray-800">Kommande</h3>
                        {#if upcoming.length === 0}
                                <p class="text-sm text-gray-500">Du har inga kommande bokningar.</p>
                        {:else}
                                <table class="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
                                        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                <tr>
                                                        <th class="px-3 py-2">Datum</th>
                                                        <th class="px-3 py-2">Tid</th>
                                                        <th class="px-3 py-2">Tränare</th>
                                                        <th class="px-3 py-2">Plats</th>
                                                        <th class="px-3 py-2">Status</th>
                                                </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100">
                                                {#each upcoming as booking (booking.booking.id)}
                                                        {@const formatted = formatDateTime(booking.booking.startTime)}
                                                        <tr class="hover:bg-gray-50">
                                                                <td class="px-3 py-2 font-medium text-gray-900">{formatted.date}</td>
                                                                <td class="px-3 py-2">{formatted.time}</td>
                                                                <td class="px-3 py-2">{trainerName(booking)}</td>
                                                                <td class="px-3 py-2">{locationName(booking)}</td>
                                                                <td class="px-3 py-2">{displayStatus(booking.booking.status, booking.isPersonalBooking)}</td>
                                                        </tr>
                                                {/each}
                                        </tbody>
                                </table>
                        {/if}
                </div>

                <div class="space-y-4">
                        <h3 class="text-lg font-medium text-gray-800">Tidigare</h3>
                        {#if past.length === 0}
                                <p class="text-sm text-gray-500">Det finns inga tidigare bokningar att visa.</p>
                        {:else}
                                <table class="min-w-full divide-y divide-gray-200 text-left text-sm text-gray-700">
                                        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                <tr>
                                                        <th class="px-3 py-2">Datum</th>
                                                        <th class="px-3 py-2">Tid</th>
                                                        <th class="px-3 py-2">Tränare</th>
                                                        <th class="px-3 py-2">Plats</th>
                                                        <th class="px-3 py-2">Status</th>
                                                </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100">
                                                {#each past as booking (booking.booking.id)}
                                                        {@const formatted = formatDateTime(booking.booking.startTime)}
                                                        <tr class="hover:bg-gray-50">
                                                                <td class="px-3 py-2 font-medium text-gray-900">{formatted.date}</td>
                                                                <td class="px-3 py-2">{formatted.time}</td>
                                                                <td class="px-3 py-2">{trainerName(booking)}</td>
                                                                <td class="px-3 py-2">{locationName(booking)}</td>
                                                                <td class="px-3 py-2">{displayStatus(booking.booking.status, booking.isPersonalBooking)}</td>
                                                        </tr>
                                                {/each}
                                        </tbody>
                                </table>
                        {/if}
                </div>
        </div>
</section>
