<script lang="ts">
	import { onMount } from 'svelte';
	import DominoTile from './DominoTile.svelte';

	interface Props {
		tile: {
			left: number;
			right: number;
			x: number;
			y: number;
			rotation: number;
			side: 'left' | 'right';
		};
		dropZoneHovered: 'left' | 'right' | 'center' | null;
		onhover: (side: 'left' | 'right' | null) => void;
		onplace: (side: 'left' | 'right') => void;
	}

	let { tile, dropZoneHovered, onhover, onplace }: Props = $props();

	const isVertical = $derived(tile.rotation % 180 !== 0);
	const cssRotation = $derived(isVertical ? tile.rotation - 90 : tile.rotation);

	const isHovered = $derived(dropZoneHovered === tile.side);

	let animIn = $state(false);

	onMount(() => {
		// Trigger appear animation after mount
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				animIn = true;
			});
		});
	});

	function handleHover(side: 'left' | 'right' | null) {
		onhover(side);
	}
</script>

<div
	class="absolute z-40 transition-all duration-500 ease-out"
	style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
>
	<button
		data-ghost-side={tile.side}		class="cursor-copy rounded-lg border-2 border-dashed p-2
			transition-all duration-200
			border-stone-500/40 bg-stone-500/10
			{isHovered
				? 'scale-110 border-primary/70 bg-primary/20 shadow-lg shadow-primary/20'
				: animIn
					? 'opacity-70'
					: 'scale-75 opacity-0'}"
		onmouseenter={() => handleHover(tile.side)}
		onmouseleave={() => handleHover(null)}
		onmousedown={(e) => e.preventDefault()}
		onmouseup={(e) => {
			e.stopPropagation();
			onplace(tile.side);
		}}
		onclick={(e) => {
			e.stopPropagation();
			onplace(tile.side);
		}}
		onpointerenter={() => handleHover(tile.side)}
		onpointerleave={() => handleHover(null)}
		onpointerdown={(e) => e.preventDefault()}
		onpointerup={(e) => {
			e.stopPropagation();
			onplace(tile.side);
		}}
	>
		<DominoTile {tile} {isVertical} />
	</button>
</div>
