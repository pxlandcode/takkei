<script lang="ts">
	import ClientsPackagesStatusReport from '../../../components/ui/reports/clientsPackagesStatusReport/ClientsPackagesStatusReport.svelte';

	export let data: {
		defaultSessionsLimit: number;
	};
</script>

<div class="p-6">
	<ClientsPackagesStatusReport defaultSessionsLimit={data.defaultSessionsLimit} />
</div>
