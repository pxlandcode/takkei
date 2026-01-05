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
		link = null,
		linkLabel = 'Läs mer',
		small = false
	} = $$props;

	import { tick } from 'svelte';

	let expanded = false;
	$: isLong = message.length > 120 || message.includes('\n');
	let messageContainer: HTMLDivElement | null = null;
	let hiddenMeasure: HTMLDivElement | null = null;
	let fullHeight = 0;
	let collapsedHeight = small ? 64 : 110;
	const dispatch = createEventDispatcher();

	const borderColors = {
		client: 'orange',
		alert: 'error',
		info: 'success',
		article: 'primary'
	};

	const iconMap = {
		client: 'CircleUser',
		alert: 'CircleAlert',
		info: 'CircleInfo',
		article: 'Newspaper'
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

	async function updateHeights() {
		await tick();
		const measured = hiddenMeasure?.scrollHeight ?? collapsedHeight;
		fullHeight = Math.max(measured, collapsedHeight + 4);
	}

	$: message, link, expanded, updateHeights();
</script>

<div
	class="rounded-sm border border-l-0 shadow-xs"
	class:border-orange={type === 'client'}
	class:border-error={type === 'alert'}
	class:border-success={type === 'info'}
	class:border-primary={type === 'article'}
>
	<div
		class="rounded-sm border-l-4 bg-white {small ? 'p-2' : 'p-4'}"
		class:border-orange={type === 'client'}
		class:border-error={type === 'alert'}
		class:border-success={type === 'info'}
		class:border-primary={type === 'article'}
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

				<div
					class="message-wrapper relative mt-2 text-sm text-gray-700"
					class:expanded={expanded}
					style={`max-height: ${expanded ? fullHeight : collapsedHeight}px`}
				>
					<div class="message-body whitespace-pre-line pl-6" bind:this={messageContainer}>
						{message}
						{#if expanded && link}
							<br />
							<a
								href={link}
								class="text-sm font-semibold text-primary underline hover:text-primary-hover"
							>
								{linkLabel}
							</a>
						{/if}
					</div>
					{#if !expanded && isLong}
						<div
							class="fade-footer pointer-events-none absolute bottom-0 left-0 h-8 w-full rounded-b bg-linear-to-t from-white via-white/80 to-transparent"
						></div>
					{/if}
				</div>

				<!-- Hidden measure to capture full height for animation -->
				<div class="invisible absolute pointer-events-none w-full">
					<div class="whitespace-pre-line pl-6" bind:this={hiddenMeasure}>
						{message}
						{#if link}
							<br />
							<a>{linkLabel}</a>
						{/if}
					</div>
				</div>

				{#if isLong}
					<div class="mt-1 flex justify-center">
						<button
							on:click={() => (expanded = !expanded)}
							class="toggle-link"
							aria-expanded={expanded}
							aria-label={expanded ? 'Visa mindre' : 'Visa mer'}
						>
							<span>{expanded ? 'Visa mindre' : 'Visa mer'}</span>
							<span class:rotated={expanded}>
								<Icon icon="ChevronDown" size="12" />
							</span>
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

	.message-wrapper {
		max-height: 110px;
		overflow: hidden;
		transition: max-height 0.35s ease, opacity 0.25s ease;
	}

	.message-wrapper.expanded {
		max-height: 1200px;
		overflow: visible;
	}

	.toggle-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid #d1d5db;
		border-radius: 9999px;
		background: #fff;
		transition: transform 0.2s ease, background-color 0.2s ease;
	}

	.toggle-btn:hover {
		background-color: #f3f4f6;
	}

	.toggle-btn :global(.rotated) {
		transform: rotate(180deg);
	}

	.toggle-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: none;
		border: none;
		color: #1f2937;
		font-size: 0.9rem;
		cursor: pointer;
		transition: color 0.2s ease;
		padding: 4px 6px;
	}

	.toggle-link:hover {
		color: #0f172a;
	}

	.rotated {
		display: inline-flex;
		transition: transform 0.2s ease;
		transform: rotate(180deg);
	}

	.toggle-link span:not(.rotated) {
		display: inline-flex;
		align-items: center;
	}

	.toggle-link span.rotated {
		display: inline-flex;
		align-items: center;
	}
</style>
