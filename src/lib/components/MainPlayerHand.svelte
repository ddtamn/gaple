<script lang="ts">
	import emblaCarouselSvelte from 'embla-carousel-svelte';
	import { getRemainingTilesCount } from '../../engine/utils';
	import TileIcon from '$lib/icons/TileIcon.svelte';
	import DominoTile from './DominoTile.svelte';
	import { untrack } from 'svelte';

	// 1. IMPORT ANIMASI FLIP BAWAAN SVELTE
	import { flip } from 'svelte/animate';
	import { quintOut } from 'svelte/easing';

	let {
		game,
		currentGameState,
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

	let boardTiles = $derived(game?.state?.board?.playedTiles ?? currentGameState?.board?.playedTiles ?? []);
	let sortedHand = $state<any[]>([]);

	$effect(() => {
		if (isMyTurn && player.hand.length > 4) {
			const unplayable = [];
			const playable = [];

			for (const tile of player.hand) {
				if (playableTileIds.has(tile.id)) {
					playable.push(tile);
				} else {
					unplayable.push(tile);
				}
			}

			const half = Math.ceil(unplayable.length / 2);
			const leftUnplayable = unplayable.slice(0, half);
			const rightUnplayable = unplayable.slice(half);

			sortedHand = [...leftUnplayable, ...playable, ...rightUnplayable];
		} else {
			const currentSortedHand = untrack(() => sortedHand);

			const currentHandIds = new Set(player.hand.map((t: any) => t.id));
			let updated = currentSortedHand.filter((tile) => currentHandIds.has(tile.id));

			if (updated.length === 0 || currentSortedHand.length !== player.hand.length) {
				updated = [...player.hand];
			}

			sortedHand = updated;
		}
	});

	let tracker = $derived(getRemainingTilesCount(boardTiles, player.hand));
	const remainings = $derived(
		Array.from({ length: 7 }, (_, value) => ({
			value,
			remain: tracker[value]
		}))
	);

	const emblaOptions = {
		options: {
			align: 'center' as const,
			dragFree: true,
			// Prevent Embla from swallowing click events on tile buttons
			watchDrag: (emblaApi: any, event: MouseEvent | TouchEvent) => {
				const target = event.target as HTMLElement;
				// Don't start drag when interacting with a tile button
				if (target.closest('button')) return false;
				return true;
			}
		},
		plugins: []
	};

	let emblaApi = $state<any>(null);

	function onEmblaInit(event: CustomEvent) {
		emblaApi = event.detail;
	}

	$effect(() => {
		if (emblaApi && isMyTurn && sortedHand.length > 4) {
			// 3. TAMBAH JEDA: Tunggu animasi FLIP selesai (300ms) sebelum auto-scroll ke tengah
			setTimeout(() => {
				const middleIndex = Math.floor(sortedHand.length / 2);
				emblaApi.scrollTo(middleIndex);
			}, 300);
		}
	});
</script>

<div
	class="embla mb-2 w-full rounded-lg md:max-w-2xl"
	use:emblaCarouselSvelte={emblaOptions}
	onemblaInit={onEmblaInit}
>
	<div class="embla__container flex justify-center gap-1">
		{#each sortedHand as tile (tile.id)}
			{@const isActive = activeTileId === tile.id}
			{@const isPlayable = playableTileIds.has(tile.id)}

			<button
				animate:flip={{ duration: 400, easing: quintOut }}
				disabled={!isMyTurn || !isPlayable}
				class="embla__slide flex flex-[0_0_auto] cursor-pointer transition-all duration-150 select-none hover:-translate-y-2
                {isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
                {isActive ? '-translate-y-2 opacity-30' : ''}
               "
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

<div class="px-8">

<div
	class="flex w-full items-center justify-between gap-2 rounded border border-stone-700 bg-surface p-1 px-4 text-stone-400"
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
				class="flex size-5 items-center justify-center rounded bg-secondary font-body text-xs font-bold text-white"
				>D</span
			>
		{/if}
		<span
			class="flex size-5 min-w-[24px] items-center justify-center rounded border border-primary/30 bg-warm-hover px-2 font-body text-xs font-bold text-primary"
		>
			{winCount}
		</span>
	</div>
</div>
</div>

<style>
	.embla__container {
		touch-action: pan-y;
	}
</style>
