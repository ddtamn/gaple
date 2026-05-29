<script lang="ts">
	import type { IconProps } from './types';

	interface Props extends IconProps {
		value?: number;
	}

	let {
		value = 0,
		color = 'currentColor',
		size = 24,
		strokeWidth = 2,
		absoluteStrokeWidth = false,
		...restProps
	}: Props = $props();

	const calculatedStrokeWidth = $derived(
		absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
	);

	const pipRadius = 2;

	const positions = {
		topLeft: [8, 8],
		topRight: [16, 8],

		middleLeft: [8, 12],
		center: [12, 12],
		middleRight: [16, 12],

		bottomLeft: [8, 16],
		bottomRight: [16, 16]
	} as const;

	const pips = $derived.by(() => {
		switch (value) {
			case 0:
				return [];

			case 1:
				return [positions.center];

			case 2:
				return [positions.topRight, positions.bottomLeft];

			case 3:
				return [positions.topRight, positions.center, positions.bottomLeft];

			case 4:
				return [positions.topLeft, positions.topRight, positions.bottomLeft, positions.bottomRight];

			case 5:
				return [
					positions.topLeft,
					positions.topRight,
					positions.center,
					positions.bottomLeft,
					positions.bottomRight
				];

			case 6:
				return [
					positions.topLeft,
					positions.middleLeft,
					positions.bottomLeft,

					positions.topRight,
					positions.middleRight,
					positions.bottomRight
				];

			default:
				return [];
		}
	});
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	stroke={color}
	stroke-width={calculatedStrokeWidth}
	{...restProps}
>
	<rect x="3" y="3" width="18" height="18" rx="2" stroke-linecap="round" stroke-linejoin="round" />

	{#each pips as pip (`${pip[0]}-${pip[1]}`)}
		<circle cx={pip[0]} cy={pip[1]} r={pipRadius} fill={color} stroke="none" />
	{/each}
</svg>
