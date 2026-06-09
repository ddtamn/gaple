<script lang="ts">
	import DominoTile from '../DominoTile.svelte';
	import { onMount } from 'svelte';
	import { createPlayCardAnimation } from '$lib/animation/card-animations';
	import type { FlyingTileAnimData } from '$lib/animation/types';

	interface Props {
		data: FlyingTileAnimData;
		tile: { left: number; right: number; id: string };
	}

	let { data, tile }: Props = $props();

	let x = $state(data.fromX);
	let y = $state(data.fromY);
	let rot = $state(data.rotation);
	let scale = $state(0.5);
	let opacity = $state(0);
	let shadowX = $state(data.fromX);
	let shadowY = $state(data.fromY);
	let shadowSize = $state(0.2);
	let shadowOpacity = $state(0.1);

	onMount(() => {
		// Delegate all GSAP work to card-animations.ts
		const cleanup = createPlayCardAnimation({
			id: data.id,
			fromX: data.fromX,
			fromY: data.fromY,
			toX: data.toX,
			toY: data.toY,
			rotation: data.rotation,
			duration: data.duration,
			onUpdate: (state) => {
				x = state.x;
				y = state.y;
				rot = state.rot;
				scale = state.scale;
				opacity = state.opacity;
				shadowX = state.shadowX;
				shadowY = state.shadowY;
				shadowSize = state.shadowSize;
				shadowOpacity = state.shadowOpacity;
			},
			onComplete: () => {
				// Sparkle and cleanup handled by controller's playMove
			}
		});

		return cleanup;
	});
</script>

<div class="pointer-events-none fixed z-50" style="left:{x}px; top:{y}px;">
	<!-- Shadow anchored to the ground (straight-line position), tile arcs above it -->
	<div
		class="absolute rounded-full bg-black/30"
		style="left:{shadowX - x}px; top:{shadowY - y}px; width:{60 * shadowSize}px; height:{16 * shadowSize}px; opacity:{shadowOpacity}; filter:blur({shadowSize * 3}px); transform:translate(-50%,-50%);"
	></div>
	<!-- Tile -->
	<div
		style="transform:translate(-50%,-50%) rotate({rot}deg) scale({scale}); opacity:{opacity}; will-change:transform;"
	>
		<DominoTile {tile} isVertical={false} size="md" />
	</div>
</div>
