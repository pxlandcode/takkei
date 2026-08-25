<script lang="ts">
	import Icon from '../../bits/icon-component/Icon.svelte';

	type RoleOption = {
		name: string;
		value: string;
	};

	type Props = {
		options: RoleOption[];
		selectedRoles: string[];
		summary: string;
		onChange?: (roles: string[]) => void;
	};

	let { options, selectedRoles, summary, onChange }: Props = $props();

	function toggleRole(role: string) {
		const nextRoles = selectedRoles.includes(role)
			? selectedRoles.filter((selectedRole) => selectedRole !== role)
			: [...selectedRoles, role];

		onChange?.(nextRoles);
	}
</script>

<section class="rounded-sm border border-gray-100 bg-gray-50 p-4">
	<div class="mb-3 flex items-start justify-between gap-3">
		<div>
			<h4 class="text-text text-sm font-semibold">Synlighet</h4>
			<p class="mt-1 text-xs text-gray-500">{summary}</p>
		</div>
		<Icon icon="Eye" size="18px" extraClasses="text-gray-400" />
	</div>

	<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
		{#each options as role (role.value)}
			<label
				for={`news-role-${role.value}`}
				class="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
			>
				<input
					id={`news-role-${role.value}`}
					type="checkbox"
					class="accent-primary h-4 w-4"
					checked={selectedRoles.includes(role.value)}
					onchange={() => toggleRole(role.value)}
				/>
				<span>{role.name}</span>
			</label>
		{/each}
	</div>
</section>
