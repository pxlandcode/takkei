<script>
    export let size = '40px';
    export let color = 'black';
    export let extraClasses = '';

    $: classString = `text-${color} ${extraClasses}`;
</script>

<svg
    width={size}
    height={size}
    class={classString}
    fill="currentColor"
    viewBox="0 0 40 40"
    xmlns="http://www.w3.org/2000/svg"
>
    <path d="M4 40L0 36L16 20L0 4L4 0L20 16L36 0L40 4L24 20L40 36L36 40L20 24L4 40Z" />
</svg>

<style>
    @import './_icons.scss';
</style>
