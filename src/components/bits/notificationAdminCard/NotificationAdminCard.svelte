<script lang="ts">
	import { text } from '@sveltejs/kit';
	import Icon from '../icon-component/Icon.svelte';
	import { createEventDispatcher } from 'svelte';

	import { confirm } from '$lib/actions/confirm';
	import { addToast } from '$lib/stores/toastStore';
	import { AppToastType } from '$lib/types/toastTypes';

	export let title = '';
	export let message = '';
	export let timeAgo = 'just nu';
	export let eventType: 'client' | 'alert' | 'info' = 'info';
	export let startTime: string | null = null;
	export let endTime: string | null = null;
	export let doneCount = 0;
	export let totalCount = 0;
	export let recipients: { id: number; name: string; hasMarkedDone: boolean }[] = [];
	export let expanded = false;

	const dispatch = createEventDispatcher();

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('sv-SE', {
			month: 'short',
			day: 'numeric'
		});
	}

	function getDateRange(start: string | null, end: string | null): string {
		if (!start) return '';
		if (!end || formatDate(start) === formatDate(end)) {
			return formatDate(start);
		}
		return `${formatDate(start)} – ${formatDate(end)}`;
	}

	function handleDelete() {
		dispatch('delete');
	}

	function toggle() {
		expanded = !expanded;
	}

	async function handleToggleDone(recipient) {
		try {
			const method = recipient.hasMarkedDone ? 'PATCH' : 'PUT';

			const res = await fetch('/api/notifications', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event_id: recipient.event_id,
					user_id: recipient.id
				})
			});

			if (!res.ok) throw new Error('Misslyckades att uppdatera');

			// ✅ Find and replace recipient in array to trigger reactivity
			const index = recipients.findIndex((r) => r.id === recipient.id);
			if (index !== -1) {
				const updated = {
					...recipients[index],
					hasMarkedDone: !recipients[index].hasMarkedDone
				};

				recipients = [...recipients.slice(0, index), updated, ...recipients.slice(index + 1)];

				addToast({
					type: AppToastType.SUCCESS,
					message: updated.hasMarkedDone ? 'Markerad som klar' : 'Avmarkerad',
					description: `${updated.name} är nu ${updated.hasMarkedDone ? 'klar' : 'inte klar'}`
				});
			}
		} catch (err) {
			console.error(err);
			alert('Ett fel inträffade. Försök igen.');
		}
	}
</script>

<div
	class="rounded-sm border border-l-0 shadow-xs"
	class:border-orange={eventType === 'client'}
	class:border-error={eventType === 'alert'}
	class:border-success={eventType === 'info'}
>
	<div
		class="rounded-sm border-l-4 bg-white p-4"
		class:border-orange={eventType === 'client'}
		class:border-error={eventType === 'alert'}
		class:border-success={eventType === 'info'}
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-0.5">
						<div
							class="flex items-center gap-2"
							class:text-orange={eventType === 'client'}
							class:text-error={eventType === 'alert'}
							class:text-success={eventType === 'info'}
						>
							<Icon
								icon={eventType === 'client'
									? 'CircleUser'
									: eventType === 'alert'
										? 'CircleAlert'
										: 'CircleInfo'}
								size="18"
							/>
							<span class="text-sm font-semibold text-text">{title}</span>
						</div>
						<p class="pl-6 text-xs text-gray-500">{getDateRange(startTime, endTime)}</p>
					</div>

					<div class="flex flex-col items-end gap-2">
						<span class="text-xs text-gray-400">{timeAgo}</span>
						<button
							use:confirm={{
								title: 'Radera notifikation?',
								description: 'Detta kommer att ta bort notifikationen för alla mottagare.',
								action: handleDelete
							}}
							class="mt-1 text-xs text-red-600 hover:underline"
						>
							Radera
						</button>
					</div>
				</div>

				<div class="mt-1 pl-6 text-sm text-gray-600">
					{doneCount} av {totalCount} markerade som klar
				</div>

				{#if message}
					<div class="relative mt-2 text-sm text-gray-700">
						<p class="whitespace-pre-line pl-6" class:line-clamp-2={!expanded}>
							{expanded ? message : message.slice(0, 250)}
						</p>
					</div>
				{/if}

				{#if expanded && recipients.length > 0}
					<div class="mt-3 space-y-1 text-sm text-gray-800">
						{#each recipients as r (r.id + '-' + r.hasMarkedDone)}
							<div
								class="flex items-center justify-between border-b py-1 pl-6 pr-2"
								class:text-green={r.hasMarkedDone}
								class:text-error={!r.hasMarkedDone}
							>
								<span>{r.name}</span>
								<button
									use:confirm={{
										title: r.hasMarkedDone ? 'Ångra markering?' : 'Markera som klar?',
										description: `Detta kommer att ${r.hasMarkedDone ? 'avmarkera' : 'markera'} denna notifikation som klar för ${r.name}.`,
										action: () => handleToggleDone(r)
									}}
									class="transition-transform hover:scale-110"
								>
									<Icon icon={r.hasMarkedDone ? 'CircleCheck' : 'CircleCross'} size="18" />
								</button>
							</div>
						{/each}
					</div>
				{/if}

				<div class="mt-1 flex justify-center">
					<button on:click={toggle} class="text-sm text-blue-600 underline hover:text-blue-800">
						{expanded ? 'Visa mindre –' : 'Visa mer +'}
					</button>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
