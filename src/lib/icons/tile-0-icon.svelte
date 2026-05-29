<script lang="ts">
	import type { IconProps } from './types';
	let {
		color = 'currentColor',
		size = 24,
		strokeWidth = 2,
		absoluteStrokeWidth = false,
		...restProps
	}: IconProps = $props();

	const calculatedStrokeWidth = $derived(
		absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
	);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	stroke={color}
	stroke-width={calculatedStrokeWidth}
	{...restProps}
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
>
	<path
		d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
</svg>
