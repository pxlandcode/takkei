<script lang="ts">
        import { goto } from '$app/navigation';
        import { user } from '$lib/stores/userStore';

        $: account = $user;

        async function logout() {
                await fetch('/api/logout', { method: 'POST' });
                user.set(null);
                goto('/login');
        }
</script>

<div class="client-dashboard flex flex-1 flex-col gap-6">
        <header class="flex flex-col gap-2 border-b border-gray-200 pb-4">
                <h1 class="text-2xl font-semibold text-gray-900">Hej {account?.firstname}!</h1>
                <p class="text-sm text-gray-600">
                        Du är inloggad som klient. Här kommer dina personliga bokningar och träningsplaner att visas.
                </p>
        </header>

        <section class="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-800">
                <h2 class="text-lg font-medium">Kommande funktioner</h2>
                <ul class="list-disc space-y-2 pl-6">
                        <li>Överblick över dina pass och noteringar</li>
                        <li>Direktkontakt med din tränare</li>
                        <li>Enkla verktyg för att följa dina mål</li>
                </ul>
        </section>

        <button
                class="mt-auto w-fit rounded-md bg-primary px-4 py-2 text-white transition hover:bg-primary/80"
                on:click={logout}
        >
                Logga ut
        </button>
</div>

<style>
        .client-dashboard {
                min-height: calc(100dvh - 3rem);
        }
</style>
