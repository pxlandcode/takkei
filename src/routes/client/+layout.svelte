<script lang="ts">
        import { ParaglideJS } from '@inlang/paraglide-sveltekit';
        import { i18n } from '$lib/i18n';
        import { user } from '$lib/stores/userStore';
        import '../../app.css';

        export let data;
        $user = data.user;
</script>

<ParaglideJS {i18n}>
        <main class="min-h-dvh bg-surface px-4 py-8 text-gray-900">
                <div class="mx-auto flex w-full max-w-4xl flex-col gap-6">
                        <header class="flex flex-col gap-2">
                                <h1 class="text-3xl font-semibold">Hej {$user?.firstname}!</h1>
                                <p class="text-gray-600">
                                        Välkommen till din klientvy. Här kommer du att kunna följa dina pass och kommunicera med din tränare.
                                </p>
                        </header>
                        <section class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                                <slot />
                        </section>
                </div>
        </main>
</ParaglideJS>

<style>
        :global(body) {
                background: var(--surface, #f6f6f9);
        }
</style>
