<script lang="ts">
	import ProfileClientInfo from '../../ui/ProfileClientInfo/ProfileClientInfo.svelte';
	import BookingGrid from '../../ui/bookingGrid/BookingGrid.svelte';

	export let client;
</script>

<div class="flex flex-1 flex-col gap-6 p-6">
	<header class="flex flex-col gap-2 border-b border-gray-200 pb-4">
		<h1 class="text-3xl font-semibold text-gray-900">Hej {client?.firstname ?? 'där'}!</h1>
		<p class="text-sm text-gray-600">
			Kontrollera dina uppgifter. Kontakta ditt tränarteam om något behöver ändras.
		</p>
	</header>

	<section class="rounded-sm border border-gray-200 bg-white p-6 shadow-md">
		<ProfileClientInfo
			{client}
			readOnly
			showPackages={false}
			showBookingGrid={false}
			allowEditing={false}
			allowMailPopup={false}
		/>
	</section>

	{#if client?.id}
		<section class="rounded-sm border border-gray-200 bg-white p-6 shadow-md">
			<div class="mb-4 flex flex-col gap-1">
				<h2 class="text-xl font-semibold text-gray-900">Bokningsöversikt</h2>
				<p class="text-sm text-gray-600">
					En snabb överblick av hur dina pass har legat under det senaste året.
				</p>
			</div>
			<BookingGrid clientId={client.id} border />
		</section>
	{/if}
</div>
