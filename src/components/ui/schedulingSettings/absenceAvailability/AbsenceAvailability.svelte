<script lang="ts">
	import Button from '../../../bits/button/Button.svelte';
	import Icon from '../../../bits/icon-component/Icon.svelte';
	import { createEventDispatcher } from 'svelte';
	import Input from '../../../bits/Input/Input.svelte';

	type Absence = {
		id?: number;
		description?: string;
		start_time?: string;
		end_time?: string | null;
		status?: string;
		approved_by_id?: number;
	};

	let {
		absences = [],
		canEdit = false,
		canApprove = false
	} = $props<{
		absences?: Absence[];
		canEdit?: boolean;
		canApprove?: boolean;
	}>();

	const dispatch = createEventDispatcher<{
		save: Absence;
		close: Absence;
		approve: Absence;
	}>();
	let description = $state('');

	function addAbsence() {
		if (description.trim()) {
			const absence: Absence = {
				start_time: new Date().toISOString(),
				end_time: null,
				status: 'Open',
				description
			};
			dispatch('save', absence);
			description = '';
		}
	}

	function closeAbsence(absence: Absence) {
		dispatch('close', absence);
	}

	function approveAbsence(absence: Absence) {
		dispatch('approve', absence);
	}
</script>

<div class="rounded-sm border border-gray-200 bg-white p-4 shadow-md">
	<div class="mb-3 flex items-center gap-2">
		<div class="flex h-6 w-6 items-center justify-center rounded-full bg-text text-white">
			<Icon icon="Cancel" size="14px" />
		</div>
		<h3 class="text-lg font-semibold text-text">Frånvaro</h3>
	</div>

		{#if canEdit}
			<div class="mb-4 flex w-full flex-col gap-2 md:flex-row md:items-end">
				<div class="grow">
					<Input bind:value={description} label="Kort beskrivning" maxlength={50} />
				</div>
				<div class="mb-4 w-full md:ml-2 md:mb-0 md:w-auto">
					<Button text="Starta frånvaro" full on:click={addAbsence} />
				</div>
			</div>
		{/if}

	{#if absences.length > 0}
		<ul class="space-y-3">
			{#each absences as a (`${a.id ?? a.start_time}-${a.description ?? ''}`)}
				<li
					class="flex flex-col gap-4 rounded-sm border px-4 py-3 text-sm md:flex-row md:items-start md:justify-between"
				>
					<div class="flex grow flex-col gap-1">
						<div class="flex items-center gap-2">
							<strong class={a.status === 'Open' ? 'text-error' : 'text-success'}>
								{a.status === 'Open' ? 'Pågående' : 'Avslutad'}
							</strong>
							{#if a.approved_by_id}
								<Icon icon="CircleCheck" color="success" size="16px" />
							{/if}
							<span class="text-gray-700">– {a.description || 'Ingen beskrivning'}</span>
						</div>
						<div class="text-xs text-gray-500">
							Från: {new Date(a.start_time).toLocaleDateString()}
							{#if a.end_time}
								– Till: {new Date(a.end_time).toLocaleDateString()}
							{/if}
						</div>
					</div>

					{#if a.status === 'Open'}
						<div class="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
							{#if canEdit}
								<Button
									small
									variant="secondary"
									text="Avsluta"
									full
									on:click={() => closeAbsence(a)}
								/>
							{/if}
							{#if canApprove && !a.approved_by_id}
								<Button
									small
									variant="primary"
									text="Godkänn"
									full
									on:click={() => approveAbsence(a)}
								/>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm italic text-gray-400">Ingen frånvaro registrerad.</p>
	{/if}
</div>
