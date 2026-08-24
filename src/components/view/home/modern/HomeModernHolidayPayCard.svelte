<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { fetchHolidayPayForUser } from '$lib/services/api/holidayPayService';
	import { user } from '$lib/stores/userStore';
	import { formatCurrency } from './homeModernUtils';

	let mounted = false;
	let holidayPayAmount: number | null = null;
	let holidayPayUpdatedAt: string | null = null;
	let holidayPayLoading = false;
	let hasLoadedHolidayPay = false;
	let holidayPayUserId: number | null = null;

	onMount(() => {
		mounted = true;

		if ($user?.id) {
			holidayPayUserId = $user.id;
			void loadHolidayPay();
		} else {
			hasLoadedHolidayPay = true;
		}
	});

	$: if (mounted && $user?.id && $user.id !== holidayPayUserId) {
		holidayPayUserId = $user.id;
		holidayPayAmount = null;
		holidayPayUpdatedAt = null;
		hasLoadedHolidayPay = false;
		void loadHolidayPay();
	}

	$: if (mounted && !$user?.id && holidayPayUserId !== null) {
		holidayPayUserId = null;
		holidayPayAmount = null;
		holidayPayUpdatedAt = null;
		hasLoadedHolidayPay = true;
	}

	async function loadHolidayPay() {
		if (!$user?.id) return;

		holidayPayLoading = true;
		try {
			const entry = await fetchHolidayPayForUser();
			holidayPayAmount = entry?.amount ?? 0;
			holidayPayUpdatedAt = entry?.updatedAt ?? entry?.createdAt ?? null;
		} catch (error) {
			console.error('Failed to load holiday pay', error);
		} finally {
			holidayPayLoading = false;
			hasLoadedHolidayPay = true;
		}
	}

	function getUpdatedAtText(value: string | null) {
		if (!value) return 'Ingen uppdatering registrerad ännu.';
		const parsed = new Date(value);
		const formatted = Number.isNaN(parsed.getTime())
			? value
			: parsed.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
		return `Senast uppdaterad ${formatted}`;
	}
</script>

<section class="bg-white p-4 shadow-sm transition hover:shadow-md">
	<div class="flex items-center gap-3">
		<div class="bg-green/10 flex h-10 w-10 items-center justify-center">
			<Icon icon="Money" size="20px" color="green" />
		</div>
		<div>
			<p class="text-2xl font-bold text-gray-900">
				{holidayPayLoading && !hasLoadedHolidayPay ? '–' : formatCurrency(holidayPayAmount)}
			</p>
			<p class="text-xs text-gray-500">Semesterersättning</p>
			<p class="mt-1 text-xs text-gray-500">
				{holidayPayLoading && !hasLoadedHolidayPay
					? 'Hämtar uppdatering...'
					: getUpdatedAtText(holidayPayUpdatedAt)}
			</p>
		</div>
	</div>
</section>
