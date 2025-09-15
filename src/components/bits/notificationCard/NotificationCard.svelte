<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';
	import { createEventDispatcher } from 'svelte';

	const {
		icon = 'Info',
		title = 'Meddelande',
		message = '',
		timeAgo = 'just nu',
		type = 'info',
		startTime = null,
		endTime = null,
		createdBy = null,
		small = false
	} = $$props;

	let expanded = false;
	const dispatch = createEventDispatcher();

	const borderColors = {
		client: 'orange',
		alert: 'error',
		info: 'success'
	};

	const iconMap = {
		client: 'CircleUser',
		alert: 'CircleAlert',
		info: 'CircleInfo'
	};

	function handleDone() {
		dispatch('done');
	}

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
</script>

<div
	class="rounded border border-l-0 shadow-sm"
	class:border-orange={type === 'client'}
	class:border-error={type === 'alert'}
	class:border-success={type === 'info'}
>
	<div
		class="rounded border-l-4 bg-white {small ? 'p-2' : 'p-4'}"
		class:border-orange={type === 'client'}
		class:border-error={type === 'alert'}
		class:border-success={type === 'info'}
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-0.5">
						<div class="flex items-center gap-2 color-[{borderColors[type]}]">
							<Icon icon={iconMap[type]} size="18" color={borderColors[type]} />
							<span class="text-sm font-semibold text-text">{title}</span>
						</div>
						<div class="flex flex-row gap-2 text-xs text-gray-500">
							{#if startTime}
								<p class="pl-6">{getDateRange(startTime, endTime)}</p>
							{/if}
							{#if createdBy && startTime}
								<p>-</p>
							{/if}
							<p>{createdBy}</p>
						</div>
					</div>

					<div class="flex flex-col items-end">
						<span class="text-xs text-gray-400">{timeAgo}</span>
						<button
							class="mt-1 text-nowrap text-xs text-green-700 hover:underline"
							on:click={handleDone}
						>
							Markera som klar
						</button>
					</div>
				</div>

				<div class="relative mt-2 text-sm text-gray-700">
					<p
						class="whitespace-pre-line pl-6"
						class:line-clamp-2={!expanded && !small}
						class:line-clamp-1={!expanded && small}
					>
						{#if message.length > 120 && !expanded}
							{message.slice(0, 120)}...
						{:else if message.includes('\n') && !expanded}
							{message.split('\n')[0]}...
						{/if}
						{#if expanded}
							<br />
						{/if}
						{#if message.includes('\n')}
							{#each message.split('\n') as line, index}
								{#if index > 0}
									<br />
								{/if}
								{line}
							{/each}
						{:else}
							{message}
						{/if}
					</p>
					{#if !expanded && (message.length > 120 || message.includes('\n'))}
						<div
							class="fade-footer pointer-events-none absolute bottom-0 left-0 h-8 w-full rounded-b bg-gradient-to-t from-white via-white/80 to-transparent"
						></div>
					{/if}
				</div>

				{#if message.length > 120 || message.includes('\n')}
					<div class="mt-1 flex justify-center">
						<button
							on:click={() => (expanded = !expanded)}
							class="text-sm text-blue-600 underline hover:text-blue-800"
						>
							{expanded ? 'Visa mindre –' : 'Visa mer +'}
						</button>
					</div>
				{/if}
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
	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
