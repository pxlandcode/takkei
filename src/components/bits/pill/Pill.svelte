<script lang="ts">
	import Icon from '../icon-component/Icon.svelte';

	export let variant: 'default' | 'info' | 'success' | 'warning' | 'danger' = 'default';
	export let size: 'xs' | 'sm' = 'sm';
	export let icon: string | null = null;
	export let iconSize: string | null = null;
	let className = '';
	export { className as class };

	$: variantClasses =
		variant === 'success'
			? 'border-success/20 bg-success/10 text-success'
			: variant === 'danger'
				? 'border-error/20 bg-error/10 text-error'
				: variant === 'warning'
					? 'border-amber-200 bg-amber-100 text-amber-800'
					: variant === 'info'
						? 'border-blue/20 bg-blue/10 text-blue'
						: 'border-gray/20 bg-gray/10 text-gray';
	$: sizeClasses = size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
	$: resolvedIconSize = iconSize ?? (size === 'xs' ? '12px' : '14px');
</script>

<span
	class={`inline-flex items-center justify-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${variantClasses} ${sizeClasses} ${className}`}
>
	{#if icon}
		<Icon {icon} size={resolvedIconSize} />
	{/if}
	<slot />
</span>
