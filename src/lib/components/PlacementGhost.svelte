<script lang="ts">
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
</script>

<div
	class="absolute z-40 transition-all duration-500 ease-out"
	style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
>
	<button
		class="cursor-copy rounded-2xl border-2 border-dashed border-amber-300 bg-amber-400/15 p-2
        opacity-70 shadow-[0_0_24px_rgba(74,222,128,0.28)] transition hover:bg-amber-400/25 hover:opacity-95
        {dropZoneHovered === tile.side ? 'scale-105 opacity-95' : ''}"
		onmouseenter={() => onhover(tile.side)}
		onmouseleave={() => onhover(null)}
		onmousedown={(e) => e.preventDefault()}
		onmouseup={(e) => {
			e.stopPropagation();
			onplace(tile.side);
		}}
		onclick={(e) => {
			e.stopPropagation();
			onplace(tile.side);
		}}
	>
		<DominoTile {tile} {isVertical} />
	</button>
</div>
