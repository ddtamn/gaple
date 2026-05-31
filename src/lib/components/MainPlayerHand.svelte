<script lang="ts">
	import { getRemainingTilesCount } from '../../engine/utils';
	import TileIcon from '$lib/icons/TileIcon.svelte';
	import DominoTile from './DominoTile.svelte';

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

	let tracker = $derived(getRemainingTilesCount(boardTiles, player.hand));
	const remainings = $derived(
		Array.from({ length: 7 }, (_, value) => ({
			value,
			remain: tracker[value]
		}))
	);

	// ── Reorder / placement drag state (unified pointer events) ──
	let dragState = $state<{
		tileId: string;
		fromIndex: number;
		isReordering: boolean;
		startX: number;
		startY: number;
	} | null>(null);

	// Flag to prevent onclick after a reorder drag (plain var, not reactive — only used in event handlers)
	let _wasReordered = false;

	// Calculate which slot the cursor is hovering over based on X position
	function getTargetIndex(clientX: number): number {
		const container = document.querySelector('.hand-container');
		if (!container) return -1;
		const buttons = container.querySelectorAll('button');
		for (let i = 0; i < buttons.length; i++) {
			const rect = buttons[i].getBoundingClientRect();
			if (clientX < rect.left + rect.width / 2) {
				return i;
			}
		}
		return buttons.length - 1;
	}
</script>

<div
	class="hand-container flex justify-center gap-0.5 px-1 md:gap-1 md:px-2 [&::-webkit-scrollbar]:hidden"
	style="flex-wrap:nowrap;"
>
	{#each player.hand as tile, index (tile.id)}
		{@const isActive = activeTileId === tile.id}
		{@const isPlayable = playableTileIds.has(tile.id)}
		{@const isReordering = dragState?.tileId === tile.id && dragState?.isReordering}

		<button
			animate:flip={{ duration: 400, easing: quintOut }}
			disabled={!isMyTurn || !isPlayable}
			class="flex cursor-grab transition-all duration-150 select-none hover:-translate-y-2
                {isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
                {isActive && !isReordering ? '-translate-y-2 opacity-30' : ''}
                {isReordering ? 'opacity-40' : ''}
               "
			style="touch-action:none"
			onpointerdown={(e) => {
				if (!isMyTurn || !isPlayable) return;
				e.preventDefault();
				const btn = e.currentTarget as HTMLElement;
				btn.setPointerCapture(e.pointerId);
				_wasReordered = false;
				dragState = {
					tileId: tile.id,
					fromIndex: index,
					isReordering: false,
					startX: e.clientX,
					startY: e.clientY
				};
			}}
			onpointermove={(e) => {
				if (!dragState || dragState.tileId !== tile.id) return;

				const dx = e.clientX - dragState.startX;
				const dy = e.clientY - dragState.startY;
				const absDx = Math.abs(dx);
				const absDy = Math.abs(dy);

				if (!dragState.isReordering) {
					// Upward movement → placement drag
					if (absDy > 12 && dy < 0 && absDy > absDx) {
						const btn = e.currentTarget as HTMLElement;
						btn.releasePointerCapture(e.pointerId);
						ondragstart(tile, e);
						dragState = null;
						return;
					}
					// Sideways movement → start reorder
					if (absDx > 15 && absDx > absDy) {
						dragState = { ...dragState, isReordering: true };
					}
					// Cancel if movement is too ambiguous
					if (absDy > 40 && absDx > 40) {
						dragState = null;
						return;
					}
				}

				if (dragState?.isReordering) {
					const targetIndex = getTargetIndex(e.clientX);
					if (targetIndex >= 0 && targetIndex !== dragState.fromIndex) {
						const moved = player.hand.splice(dragState.fromIndex, 1)[0];
						player.hand.splice(targetIndex, 0, moved);
						_wasReordered = true;
						dragState = { ...dragState, fromIndex: targetIndex };
					}
				}
			}}
			onpointerup={() => {
				if (dragState?.isReordering) {
					_wasReordered = true;
					// Reset flag after click has a chance to fire
					requestAnimationFrame(() => {
						_wasReordered = false;
					});
				}
				dragState = null;
			}}
			onpointercancel={() => {
				dragState = null;
			}}
			onclick={(e) => {
				if (!isMyTurn || !isPlayable) return;
				if (_wasReordered) return; // don't fire click after reorder
				ontileclick(tile, e);
			}}
		>
			<DominoTile {tile} isVertical={true} size="xs" />
		</button>
	{/each}
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

