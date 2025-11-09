<script lang="ts">
        import { user } from '$lib/stores/userStore';
</script>

<div class="flex flex-col gap-6">
        <section class="space-y-3">
                <h2 class="text-2xl font-semibold">Dina kommande aktiviteter</h2>
                <p class="text-gray-600">
                        Här visas snart en översikt över bokade pass, rekommendationer och senaste uppdateringar från din tränare.
                </p>
        </section>
        <section class="grid gap-4 md:grid-cols-2">
                <article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h3 class="text-lg font-semibold">Profil</h3>
                        <p class="text-gray-600">
                                {$user?.firstname} {$user?.lastname}<br />
                                {$user?.email}<br />
                                {$user?.mobile ?? 'Ingen telefon angiven'}
                        </p>
                </article>
                <article class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <h3 class="text-lg font-semibold">Snart</h3>
                        <p class="text-gray-600">Vi jobbar på att göra klientvyn ännu bättre. Håll utkik!</p>
                </article>
        </section>
</div>
