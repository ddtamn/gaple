<script lang="ts">
	import emblaCarouselSvelte from 'embla-carousel-svelte';
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

	// Konfigurasi Embla Carousel
	const emblaOptions = {
		align: 'center', // Membuat kartu aktif/terdekat selalu berada di tengah
		containScroll: 'trimSnaps', // Menghapus ruang kosong berlebih di ujung scroll
		dragFree: true // Kartu akan otomatis "magnetis" berhenti pas di tengah (snap)
	};
</script>

<div
	class="embla mb-2 w-full overflow-hidden px-2 py-2 md:max-w-2xl"
	use:emblaCarouselSvelte={emblaOptions}
>
	<div class="embla__container flex gap-3">
		{#each player.hand as tile (tile.id)}
			{@const isActive = activeTileId === tile.id}
			{@const isPlayable = playableTileIds.has(tile.id)}
			<button
				disabled={!isMyTurn || !isPlayable}
				class="embla__slide flex flex-[0_0_auto] cursor-pointer transition-all duration-150 select-none hover:-translate-y-2
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
</div>

<div
	class="flex w-full items-center justify-between gap-2 rounded-md bg-black/25 p-1 px-4 text-slate-50/35"
>
	<div class="flex items-center justify-center gap-2">
		{#each remainings as item (item.value)}
			<div class="flex items-center justify-center gap-px">
				<TileIcon value={item.value} size="16" />
				<p class="text-xs">{item.remain}</p>
			</div>
		{/each}
	</div>
	<div class="flex items-center gap-2 text-xs">
		{#if isMarked}
			<span
				class="flex size-5 items-center justify-center rounded-md bg-amber-400 text-xs font-black text-amber-950 shadow-md"
				>D</span
			>
		{/if}
		<span
			class="flex size-5 min-w-[24px] items-center justify-center rounded-md bg-black/75 px-2 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/40"
		>
			{winCount}
		</span>
	</div>
</div>

<style>
	.embla__container {
		/* Mengizinkan halaman web utama di-scroll vertikal saat user mengusap area kartu */
		touch-action: pan-y;
	}
</style>
