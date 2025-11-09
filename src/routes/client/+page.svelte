<script lang="ts">
        import { goto } from '$app/navigation';
        import BookingGrid from '../../components/ui/bookingGrid/BookingGrid.svelte';
        import ProfileClientInfo from '../../components/ui/ProfileClientInfo/ProfileClientInfo.svelte';
        import ClientBookingsList from '../../components/ui/clientBookingsList/ClientBookingsList.svelte';

        export let data;

        const { client, bookings } = data;

        async function logout() {
                await fetch('/api/logout', { method: 'POST' });
                goto('/login');
        }

        const greetingName = client?.firstname ?? '';
</script>

<div class="client-dashboard flex flex-1 flex-col gap-6">
        <header class="flex flex-col gap-2 border-b border-gray-200 pb-4">
                <h1 class="text-2xl font-semibold text-gray-900">Hej {greetingName || 'där'}!</h1>
                <p class="text-sm text-gray-600">
                        Här hittar du din profil och dina bokningar. Allt är skrivskyddat – kontakta ditt tränarteam om något
                        behöver justeras.
                </p>
        </header>

        <ProfileClientInfo
                {client}
                readOnly
                showPackages={false}
                showBookingGrid={false}
                allowEditing={false}
                allowMailPopup={false}
        />

        {#if client?.id}
                <section class="rounded-sm bg-white p-6 shadow-md">
                        <div class="mb-4 flex flex-col gap-1">
                                <h2 class="text-xl font-semibold text-gray-900">Bokningsöversikt</h2>
                                <p class="text-sm text-gray-600">
                                        En snabb överblick av hur dina pass har legat under det senaste året.
                                </p>
                        </div>
                        <BookingGrid clientId={client.id} border />
                </section>
        {/if}

        <ClientBookingsList {bookings} />

        <div class="flex justify-end">
                <button
                        class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/80"
                        on:click={logout}
                >
                        Logga ut
                </button>
        </div>
</div>

<style>
        .client-dashboard {
                min-height: calc(100dvh - 3rem);
        }
</style>
