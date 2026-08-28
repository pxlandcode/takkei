<script lang="ts">
	import { goto } from '$app/navigation';
	import { signupOnboardingStore } from '$lib/stores/signupOnboardingStore';
	import Icon from '../../../bits/icon-component/Icon.svelte';

	let className = '';
	export { className as class };
</script>

{#if $signupOnboardingStore.available && $signupOnboardingStore.pending > 0}
	<div class={className}>
		<button
			type="button"
			class="group flex w-full items-center justify-between gap-3 rounded-sm bg-white px-4 py-3 text-left shadow-xs transition-all duration-150 hover:scale-[1.015] hover:shadow-md focus:outline-blue-500 active:scale-[0.995]"
			aria-label="Nya klientregistreringar"
			on:click={() => goto('/clients?view=new')}
		>
			<div class="flex min-w-0 items-center gap-3">
				<div
					class="bg-notification flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
				>
					<Icon icon="Clients" size="17px" color="white" />
				</div>
				<div class="min-w-0">
					<p class="text-sm font-semibold text-gray-900">
						{$signupOnboardingStore.pending}
						{$signupOnboardingStore.pending === 1 ? 'ny klient' : 'nya klienter'}
					</p>
				</div>
			</div>
			<span
				class="text-gray flex h-8 w-8 shrink-0 items-center justify-center rounded-sm transition-transform duration-150 group-hover:translate-x-1"
			>
				<Icon icon="ChevronRight" size="16px" />
			</span>
		</button>
	</div>
{/if}
