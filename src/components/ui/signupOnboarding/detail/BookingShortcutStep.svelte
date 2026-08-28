<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import StepActionFooter from './StepActionFooter.svelte';

	export let currentCase: any;
	export let clientStepDone = false;
	export let busy = false;
	export let openBooking: () => void;
	export let goToClientProfile: () => void;
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4">
	<h2 class="mb-3 text-base font-semibold text-gray-900">
		5. Första bokning <span class="font-normal text-gray-500">(valfritt)</span>
	</h2>
	{#if currentCase.booking_id}
		<p class="text-sm text-green-700">Bokning #{currentCase.booking_id} är kopplad.</p>
	{/if}
	<StepActionFooter>
		<Button
			text="Gå till klientprofil"
			iconLeft="GoTo"
			variant="secondary"
			small
			disabled={!clientStepDone || busy}
			on:click={goToClientProfile}
		/>
		{#if !currentCase.booking_id}
			<Button
				text="Boka träning"
				iconLeft="Plus"
				small
				disabled={!clientStepDone || busy}
				on:click={openBooking}
			/>
		{/if}
	</StepActionFooter>
</div>
