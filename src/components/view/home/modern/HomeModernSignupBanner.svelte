<script lang="ts">
	import { goto } from '$app/navigation';
	import { signupOnboardingStore } from '$lib/stores/signupOnboardingStore';
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
</script>

{#if $signupOnboardingStore.available && $signupOnboardingStore.pending > 0}
	<section
		class="mb-4 flex flex-col gap-3 rounded-sm border border-red-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between"
		aria-label="Nya klientregistreringar"
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
					{$signupOnboardingStore.pending === 1
						? 'ny registrering väntar'
						: 'nya registreringar väntar'}
				</p>
				<p class="text-xs text-gray-500">Öppna klientregistreringar</p>
			</div>
		</div>
		<Button
			text="Öppna nya klienter"
			iconRight="ChevronRight"
			iconRightSize="14px"
			small
			on:click={() => goto('/clients?view=new')}
		/>
	</section>
{/if}
