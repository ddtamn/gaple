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
		ontileclick,
		onCaptureMoveSource
	} = $props();

	let boardTiles = $derived(game?.state?.board?.playedTiles ?? currentGameState?.board?.playedTiles ?? []);

	let tracker = $derived(getRemainingTilesCount(boardTiles, player.hand));
	const remainings = $derived(
		Array.from({ length: 7 }, (_, value) => ({
			value,
			remain: tracker[value]
		}))
	);

	// ── Local hand order (UI-only reorder, doesn't mutate player.hand) ──
	// When round starts, sync from player.hand order
	let localHandOrder = $state<string[]>([]);
	let initialized = $state(false);

	$effect(() => {
		if (player?.hand && player.hand.length > 0) {
			const ids = player.hand.map((t: { id: string }) => t.id);
			// Only re-initialize if length changed significantly (new round / dealt hand)
			if (!initialized || ids.length !== localHandOrder.length) {
				localHandOrder = [...ids];
				initialized = true;
			}
		} else if (player?.hand && player.hand.length === 0) {
			localHandOrder = [];
			initialized = false;
		}
	});

	// Derived ordered hand based on localHandOrder
	const orderedHand = $derived(
		localHandOrder
			.map((id) => player.hand.find((t: { id: string }) => t.id === id))
			.filter(Boolean)
	);

	// ── Reorder / placement drag state ──
	let dragState = $state<{
		tileId: string;
		fromIndex: number;
		isReordering: boolean;
		startX: number;
		startY: number;
	} | null>(null);

	let _wasReordered = false;

	// Whether the round is active (no result) — reorder always allowed when active
	const roundActive = $derived(!currentGameState?.result);

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

	function handlePointerDown(e: PointerEvent, tile: { id: string }, index: number) {
		// Always allow reorder start (when round active) — we'll filter play vs reorder in move handler
		if (!roundActive) return;
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
	}

	function handlePointerMove(e: PointerEvent, tile: { id: string }) {
		if (!dragState || dragState.tileId !== tile.id) return;

		const dx = e.clientX - dragState.startX;
		const dy = e.clientY - dragState.startY;
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		if (!dragState.isReordering) {
			// Upward movement → placement drag (only when isMyTurn && isPlayable)
			if (absDy > 12 && dy < 0 && absDy > absDx) {
				if (isMyTurn && playableTileIds.has(tile.id)) {
					const btn = e.currentTarget as HTMLElement;
					btn.releasePointerCapture(e.pointerId);
					// Capture source for animation before game state updates
					onCaptureMoveSource?.(tile.id, btn);
					ondragstart(tile, e);
				}
				dragState = null;
				return;
			}
			// Sideways movement → start reorder (allowed always when round active)
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
				// Reorder local hand order array instead of mutating player.hand
				const newOrder = [...localHandOrder];
				const [moved] = newOrder.splice(dragState.fromIndex, 1);
				newOrder.splice(targetIndex, 0, moved);
				localHandOrder = newOrder;
				_wasReordered = true;
				dragState = { ...dragState, fromIndex: targetIndex };
			}
		}
	}

	function handlePointerUp() {
		if (dragState?.isReordering) {
			_wasReordered = true;
			requestAnimationFrame(() => {
				_wasReordered = false;
			});
		}
		dragState = null;
	}

	function handlePointerCancel() {
		dragState = null;
	}
</script>

<div
	class="hand-container flex justify-center gap-0.5 px-1 md:gap-1 md:px-2 [&::-webkit-scrollbar]:hidden"
	data-player-id={player.id}
	style="flex-wrap:nowrap;"
>
	{#each orderedHand as tile, index (tile.id)}
		{@const isActive = activeTileId === tile.id}
		{@const isPlayable = playableTileIds.has(tile.id)}
		{@const isReordering = dragState?.tileId === tile.id && dragState?.isReordering}
		{@const canPlay = isMyTurn && isPlayable && roundActive}

		<button
			animate:flip={{ duration: 400, easing: quintOut }}
			class="flex cursor-grab transition-all duration-150 select-none
				{canPlay
					? 'opacity-100 hover:-translate-y-2'
					: roundActive && !isMyTurn
						? 'opacity-100'
						: roundActive
							? 'opacity-50'
							: 'opacity-40 cursor-default'}
				{isActive && !isReordering ? '-translate-y-2 opacity-30' : ''}
				{isReordering ? 'opacity-40' : ''}
				{!canPlay && isPlayable && roundActive && isMyTurn ? 'opacity-70' : ''}
			"
			style="touch-action:none"
			onpointerdown={(e) => handlePointerDown(e, tile, index)}
			onpointermove={(e) => handlePointerMove(e, tile)}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerCancel}
			onclick={(e) => {
				if (_wasReordered) return;
				if (!canPlay) return;
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
