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

	const calculatedCircleRadius = $derived((Number(size) * 2) / 24);
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
		d="M12 12H12.01M5 3H19C20.1046 3 21 3.89543 21 5V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3Z"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<circle cx="9" cy="15" r={calculatedCircleRadius} fill={color} />
	<circle cx="15" cy="9" r={calculatedCircleRadius} fill={color} />
</svg>
