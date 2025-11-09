<script lang="ts">
	import ClientProfileView from '../../../components/view/client/ClientProfileView.svelte';

	export let data;
	const { client } = data;
</script>

<ClientProfileView {client} />
