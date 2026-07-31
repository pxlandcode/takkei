<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Table from '../../bits/table/Table.svelte';
	import type { TableType } from '$lib/types/componentTypes';
	import { loadingStore } from '$lib/stores/loading';

	type AnonymizedProfile = {
		lifecycle_id: number;
		profile_type: 'client' | 'customer';
		profile_id: number;
		display_name: string;
		gdpr_deleted_at: string;
		gdpr_delete_token?: string | null;
		merged_into_id?: number | null;
		merged_into_name?: string | null;
		deleted_by_name?: string | null;
	};

	let profiles: AnonymizedProfile[] = [];
	let tableData: TableType = [];
	let isLoading = false;
	let error = '';

	const headers = [
		{ label: 'Typ', key: 'type', width: '120px' },
		{ label: 'Profil', key: 'profile' },
		{ label: 'Raderad', key: 'deletedAt', sort: true },
		{ label: 'Slagen ihop med', key: 'mergedInto' },
		{ label: 'Utförd av', key: 'deletedBy' },
		{ label: 'Referens', key: 'token' }
	];

	function profileTypeLabel(type: AnonymizedProfile['profile_type']) {
		return type === 'client' ? 'Klient' : 'Kund';
	}

	function profileUrl(profile: AnonymizedProfile) {
		return profile.profile_type === 'client'
			? `/clients/${profile.profile_id}`
			: `/settings/customers/${profile.profile_id}`;
	}

	function mergedIntoUrl(profile: AnonymizedProfile) {
		if (!profile.merged_into_id) return null;
		return profile.profile_type === 'client'
			? `/clients/${profile.merged_into_id}`
			: `/settings/customers/${profile.merged_into_id}`;
	}

	function formatDate(value: string | null | undefined) {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return date.toLocaleString('sv-SE', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function buildTableData(rows: AnonymizedProfile[]): TableType {
		return rows.map((profile) => {
			const mergedUrl = mergedIntoUrl(profile);
			return {
				id: profile.lifecycle_id,
				type: profileTypeLabel(profile.profile_type),
				profile: [
					{
						type: 'link',
						label: `${profile.display_name} (#${profile.profile_id})`,
						action: () => goto(profileUrl(profile))
					}
				],
				deletedAt: formatDate(profile.gdpr_deleted_at),
				mergedInto:
					mergedUrl && profile.merged_into_name
						? [
								{
									type: 'link',
									label: `${profile.merged_into_name} (#${profile.merged_into_id})`,
									action: () => goto(mergedUrl)
								}
						  ]
						: '-',
				deletedBy: profile.deleted_by_name || '-',
				token: profile.gdpr_delete_token || '-'
			};
		});
	}

	async function loadProfiles() {
		isLoading = true;
		error = '';
		loadingStore.loading(true, 'Hämtar anonymiserade profiler...');

		try {
			const res = await fetch('/api/settings/anonymized-profiles');
			const payload = await res.json();
			if (!res.ok) throw new Error(payload?.error || 'Kunde inte hämta anonymiserade profiler');
			profiles = Array.isArray(payload) ? payload : [];
			tableData = buildTableData(profiles);
		} catch (err: any) {
			error = err?.message ?? 'Kunde inte hämta anonymiserade profiler';
			profiles = [];
			tableData = [];
		} finally {
			loadingStore.loading(false);
			isLoading = false;
		}
	}

	onMount(() => {
		void loadProfiles();
	});
</script>

<div class="flex h-full flex-col gap-4">
	<div class="flex flex-col gap-1">
		<h2 class="text-xl font-semibold">Anonymiserade</h2>
		<p class="text-sm text-gray-500">
			Klienter och kunder som har anonymiserats men fortfarande finns kvar för historik.
		</p>
	</div>

	{#if error}
		<div class="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-800">
			{error}
		</div>
	{/if}

	{#if isLoading}
		<p class="text-sm text-gray-500">Laddar anonymiserade profiler...</p>
	{:else if tableData.length === 0}
		<p class="text-sm text-gray-500">Inga anonymiserade profiler finns registrerade.</p>
	{:else}
		<Table headers={headers} data={tableData} sideScrollable />
	{/if}
</div>
