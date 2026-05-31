<script lang="ts">
	import type { Domino } from '../../engine/types';
	import DominoTile from './DominoTile.svelte';
	import type { TileSize } from './DominoTile.svelte';

	interface Props {
		player: { id: string; name: string; hand: Domino[] };
		isMyTurn: boolean;
		isMain?: boolean;
		isMarked: boolean;
		winCount: number;
		playableTileIds: Set<string>;
		activeTileId: string | null;
		selectedTileId: string | null;
		showCardFaces?: boolean;
		tileSize?: TileSize;
		ondragstart: (tile: Domino, e: MouseEvent) => void;
		ontileclick: (tile: Domino, e: MouseEvent) => void;
	}

	let {
		player,
		isMyTurn,
		isMain = false,
		isMarked,
		winCount,
		playableTileIds,
		activeTileId,
		selectedTileId,
		showCardFaces = true,
		tileSize = 'sm',
		ondragstart,
		ontileclick
	}: Props = $props();

	const isHandVertical = true;

	const hiddenTileSize = $derived(
		tileSize === 'sm' ? 'h-[56px] w-[1px] flex-col' : 'h-28 w-14 flex-col'
	);
	const hiddenDotSize = $derived(tileSize === 'sm' ? 'h-5 w-5' : 'h-8 w-8');
</script>

<div class="relative flex flex-col items-center justify-center {isMain ? 'origin-bottom scale-[1.3]' : ''}">
	<div
		class="transition-all duration-150 flex flex-wrap justify-center items-center gap-1"
	>
		{#each player.hand as tile (tile.id)}
			{@const isActive = activeTileId === tile.id}
			{@const isPlayable = showCardFaces && playableTileIds.has(tile.id)}
			{@const tileDisabled = !isMyTurn || !isPlayable}
			<button
				disabled={tileDisabled}
				class="flex cursor-pointer transition-all duration-150 select-none
                {isHandVertical ? 'hover:-translate-y-2' : 'hover:-translate-x-2'}
                {isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
                {isActive && showCardFaces ? 'scale-90 opacity-30' : ''}
                {isMyTurn && selectedTileId !== null && !isActive
					? 'rounded-lg ring-2 ring-primary/20'
					: ''}"
				onmousedown={(e) => {
					if (!isMyTurn || !isPlayable) return;
					ondragstart(tile, e);
				}}
				onclick={(e) => {
					if (!isMyTurn || !isPlayable) return;
					ontileclick(tile, e);
				}}
			>
				{#if showCardFaces}
					<DominoTile {tile} isVertical={isHandVertical} size={tileSize} />
				{:else}
					<div
						class="flex overflow-hidden rounded-lg border border-stone-600 bg-stone-800 {hiddenTileSize}"
					>
						<div class="flex h-full w-full items-center justify-center">
							<div class="{hiddenDotSize} rounded-full border-2 border-stone-600/50 bg-stone-700/30"></div>
						</div>
					</div>
				{/if}
			</button>
		{/each}
	</div>

	{#if isMain}
		<div class="w-full scale-[0.8] bg-black/20">t</div>
		<div class="hidden w-full origin-bottom scale-[0.8] bg-red-300">
			<div class="relative flex w-fit items-center gap-2">
				{#if !isMarked}
					<span
						class="flex size-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950 shadow-md"
						>D</span
					>
				{/if}
				<div class="flex items-center gap-1.5">
					<span
						class="flex size-6 min-w-[24px] items-center justify-center rounded-full bg-black/75 px-2 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/40"
					>
						{winCount}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>
