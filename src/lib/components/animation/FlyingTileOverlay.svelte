<script lang="ts">
	import DominoTile from '../DominoTile.svelte';
	import { onMount } from 'svelte';

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
	let rot = $state(rotation);
	let scale = $state(1.05);
	let opacity = $state(0);

	const startTime = performance.now();

	onMount(() => {
		requestAnimationFrame(function tick(now) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Ease-out cubic
			const ease = 1 - Math.pow(1 - progress, 3);

			x = fromX + (toX - fromX) * ease;
			y = fromY + (toY - fromY) * ease - Math.sin(progress * Math.PI) * 20; // slight arc
			rot = rotation * (1 - ease);
			scale = 1.05 - 0.05 * ease;
			opacity = Math.min(1, progress * 3);

			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				x = toX;
				y = toY;
				rot = 0;
				scale = 1;
				opacity = 1;
			}
		});
	});
</script>

<div
	class="pointer-events-none fixed z-50"
	style="left:{x}px; top:{y}px; transform:translate(-50%,-50%) rotate({rot}deg) scale({scale}); opacity:{opacity};"
>
	<DominoTile {tile} isVertical={false} size="md" />
</div>
