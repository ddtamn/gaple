<script lang="ts">
	import { getRemainingTilesCount } from '../../engine/utils';
	import TileIcon from '$lib/icons/TileIcon.svelte';
	import DominoTile from './DominoTile.svelte';

	let {
		game,
		player,
		isMyTurn,
		isMain = false,
		isMarked,
		winCount,
		playableTileIds,
		activeTileId,
		selectedTileId,
		ondragstart,
		ontileclick
	} = $props();

	let boardTiles = $derived(game.state.board.playedTiles);
	let hand = $derived(game.state.players[0].hand);
	let tracker = $derived(getRemainingTilesCount(boardTiles, hand));

	const remainings = $derived(
		Array.from({ length: 7 }, (_, value) => ({
			value,
			remain: tracker[value]
		}))
	);
</script>

<div class="mb-2 flex w-full flex-wrap items-center justify-center gap-2">
	{#each player.hand as tile (tile.id)}
		{@const isActive = activeTileId === tile.id}
		{@const isPlayable = playableTileIds.has(tile.id)}
		<button
			disabled={!isMyTurn || !isPlayable}
			class="flex cursor-pointer transition-all duration-150 select-none hover:-translate-y-2
                {isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
                {isActive ? 'scale-90 opacity-30' : ''}
                {isMyTurn && selectedTileId !== null && !isActive
				? 'rounded-xl ring-2 ring-white/20'
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
			<DominoTile {tile} isVertical={true} />
		</button>
	{/each}
</div>

<div
	class="flex w-full items-center justify-center gap-2 rounded-md bg-black/25 p-1 text-slate-200"
>
	{#each remainings as item (item.value)}
		<div class="flex items-center justify-center gap-1">
			<TileIcon value={item.value} size="18" />
			<p>{item.remain}</p>
		</div>
	{/each}
</div>
