<script lang="ts">
	import DominoTile from '../DominoTile.svelte';
	import { onMount } from 'svelte';
	import { createDealCardAnimation } from '$lib/animation/card-animations';

	interface Props {
		tiles: { left: number; right: number; id: string }[];
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
	}

	let { tiles, fromX, fromY, toX, toY }: Props = $props();

	// Reactive state for each tile's position
	let tileStates = $state<Record<string, { x: number; y: number; scale: number; opacity: number; rotation: number }>>({});

	onMount(() => {
		const cleanups: (() => void)[] = [];

		tiles.forEach((tile, index) => {
			// Initialize state for this tile
			tileStates[tile.id] = { x: fromX, y: fromY, scale: 0.3, opacity: 0, rotation: 0 };

			const cleanup = createDealCardAnimation({
				fromX,
				fromY,
				toX,
				toY,
				index,
				total: tiles.length,
				onUpdate: (state) => {
					tileStates[tile.id] = { ...state };
					// Trigger reactivity by reassigning
					tileStates = { ...tileStates };
				},
				onComplete: () => {
					// Tile has landed — could reset state
				}
			});

			cleanups.push(cleanup);
		});

		return () => {
			cleanups.forEach((fn) => fn());
		};
	});
</script>

{#each tiles as tile (tile.id)}
	{@const state = tileStates[tile.id] ?? { x: fromX, y: fromY, scale: 0.3, opacity: 0, rotation: 0 }}
	{#if state.opacity > 0}
		<div
			class="pointer-events-none fixed z-50"
			style="left:{state.x}px; top:{state.y}px; transform:translate(-50%,-50%) scale({state.scale}) rotate({state.rotation}deg); opacity:{state.opacity}; will-change:transform;"
		>
			<DominoTile tile={tile} isVertical={true} size="xs" />
		</div>
	{/if}
{/each}
