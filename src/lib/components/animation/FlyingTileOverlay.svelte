<script lang="ts">
	import DominoTile from '../DominoTile.svelte';
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';

	interface Props {
		tile: { left: number; right: number };
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
		rotation: number;
		duration: number;
	}

	let { tile, fromX, fromY, toX, toY, rotation, duration }: Props = $props();

	let x = $state(fromX);
	let y = $state(fromY);
	let rot = $state(rotation * 1.5);
	let scale = $state(1.15);
	let opacity = $state(0);

	/** Vertical arc height (px) — gives the tile a "thrown" feel. */
	const ARC_HEIGHT = 60;
	/** Initial rotation multiplier — tile tilts more at start, settles on land. */
	const TILT_OVERSHOOT = 1.6;

	onMount(() => {
		const controller = new AbortController();
		// Capture props at mount time — flying tile is one-shot
		const fx = fromX,
			fy = fromY,
			tx = toX,
			ty = toY,
			rot0 = rotation;
		runAnimation({
			duration,
			easing: easeOutCubic,
			abortSignal: controller.signal,
			onUpdate: (p) => {
				x = fx + (tx - fx) * p;
				y = fy + (ty - fy) * p - Math.sin(p * Math.PI) * ARC_HEIGHT;
				rot = rot0 * TILT_OVERSHOOT * (1 - p);
				scale = 1.15 - 0.15 * p;
				opacity = Math.min(1, p * 4);
			}
		});
		return () => controller.abort();
	});
</script>

<div
	class="pointer-events-none fixed z-50"
	style="left:{x}px; top:{y}px; transform:translate(-50%,-50%) rotate({rot}deg) scale({scale}); opacity:{opacity};"
>
	<DominoTile {tile} isVertical={false} size="md" />
</div>
