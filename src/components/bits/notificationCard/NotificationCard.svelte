<script lang="ts">
	import { tick } from 'svelte';
	import Icon from '../icon-component/Icon.svelte';

	type Props = {
		icon?: string;
		title?: string;
		message?: string;
		timeAgo?: string;
		type?: string;
		startTime?: string | null;
		endTime?: string | null;
		createdBy?: string | null;
		link?: string | null;
		linkLabel?: string;
		showActionLink?: boolean;
		actionLinkLabel?: string;
		small?: boolean;
		onDone?: () => void;
	};

	let {
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
		showActionLink = false,
		actionLinkLabel = 'Läs mer',
		small = false,
		onDone
	}: Props = $props();

	let expanded = $state(false);
	let messageContainer = $state<HTMLDivElement | null>(null);
	let hiddenMeasure = $state<HTMLDivElement | null>(null);
	let fullHeight = $state(0);

	const borderColors: Record<string, string> = {
		client: 'orange',
		alert: 'error',
		info: 'success',
		article: 'primary'
	};

	const iconMap: Record<string, string> = {
		client: 'CircleUser',
		alert: 'CircleAlert',
		info: 'CircleInfo',
		article: 'Newspaper'
	};

	let isLong = $derived(message.length > 120 || message.includes('\n'));
	let collapsedHeight = $derived(small ? 64 : 110);
	let iconName = $derived(iconMap[type] ?? icon);
	let iconColor = $derived(borderColors[type] ?? borderColors.info);
	let actionLink = $derived(showActionLink && link ? link : null);

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

	$effect(() => {
		message;
		link;
		expanded;
		small;
		void updateHeights();
	});
</script>

<div
	class="rounded-sm border border-l-0 shadow-xs"
	class:border-orange={type === 'client'}
	class:border-error={type === 'alert'}
	class:border-success={type === 'info' || !borderColors[type]}
	class:border-primary={type === 'article'}
>
	<div
		class="rounded-sm border-l-4 bg-white {small ? 'p-2' : 'p-4'}"
		class:border-orange={type === 'client'}
		class:border-error={type === 'alert'}
		class:border-success={type === 'info' || !borderColors[type]}
		class:border-primary={type === 'article'}
	>
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="flex items-center justify-between">
					<div class="flex flex-col gap-0.5">
						<div class="flex items-center gap-2">
							<Icon icon={iconName} size="18" color={iconColor} />
							<span class="text-text text-sm font-semibold">{title}</span>
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
							class="mt-1 text-xs text-nowrap text-green-700 hover:underline"
							onclick={() => onDone?.()}
							type="button"
						>
							Markera som klar
						</button>
						{#if actionLink}
							<a
								href={actionLink}
								class="text-primary hover:text-primary-hover mt-1 text-xs font-semibold text-nowrap hover:underline"
							>
								{actionLinkLabel}
							</a>
						{/if}
					</div>
				</div>

				<div
					class="message-wrapper relative mt-2 text-sm text-gray-700"
					class:expanded
					style={`max-height: ${expanded ? fullHeight : collapsedHeight}px`}
				>
					<div class="message-body pl-6 whitespace-pre-line" bind:this={messageContainer}>
						{message}
						{#if expanded && link}
							<br />
							<a
								href={link}
								class="text-primary hover:text-primary-hover text-sm font-semibold underline"
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

				<div class="pointer-events-none invisible absolute w-full">
					<div class="pl-6 whitespace-pre-line" bind:this={hiddenMeasure}>
						{message}
						{#if link}
							<br />
							<span>{linkLabel}</span>
						{/if}
					</div>
				</div>

				{#if isLong}
					<div class="mt-1 flex justify-center">
						<button
							onclick={() => (expanded = !expanded)}
							class="toggle-link"
							aria-expanded={expanded}
							aria-label={expanded ? 'Visa mindre' : 'Visa mer'}
							type="button"
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
	.message-wrapper {
		max-height: 110px;
		overflow: hidden;
		transition:
			max-height 0.35s ease,
			opacity 0.25s ease;
	}

	.message-wrapper.expanded {
		max-height: 1200px;
		overflow: visible;
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
