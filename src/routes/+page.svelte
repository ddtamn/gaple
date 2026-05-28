<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';
	import { orientTileForSide } from '../engine/board';
	import { calculateBoardLayout, calculateBoardPreviewPosition } from '../engine/boardLayout';
	import { generateLegalMoves } from '../engine/moves';
	import type { Domino } from '../engine/types';

	const dotPatterns: Record<number, number[]> = {
		0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
		2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
		3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
		5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
		6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
	};

	const TILE_W = 112;
	const TILE_H = 56;
	const GAP = 4;

	const game = new SvelteGameManager([
		'Pemain Bawah',
		'Pemain Kanan',
		'Pemain Atas',
		'Pemain Kiri'
	]);
	let showResultDialog = $state(true);
	let starterPlayerId = $state<string | null>(null);

	function syncStarterMarker() {
		starterPlayerId = game.state.players[game.state.turnIndex]?.id ?? null;
	}

	game.startGame();
	syncStarterMarker();
	game.setBotPlayers(['1', '2', '3']);

	function restartGame() {
		const previousWinnerId = game.state.result?.winnerId;
		game.startGame(previousWinnerId);
		syncStarterMarker();
		game.setBotPlayers(['1', '2', '3']);
		showResultDialog = true;
	}

	// ── Interaction state ──────────────────────────────────────────────────────
	// Supports both drag-and-drop AND click-to-select + click-to-place.
	let draggedTile: Domino | null = $state(null);
	let selectedTile: Domino | null = $state(null); // click-to-select mode
	let mouseX = $state(0);
	let mouseY = $state(0);
	let dropZoneHovered: 'left' | 'right' | 'center' | null = $state(null);

	// Active tile = whichever is currently being dragged or selected.
	const activeTile: Domino | null = $derived(draggedTile ?? selectedTile);
	const isDragging = $derived(draggedTile !== null);
	// Show drop zones whenever there is an active tile and it's player 0's turn.
	const showDropZones = $derived(activeTile !== null && game.state.turnIndex === 0);
	const leftPreview = $derived.by(() => getPlacementPreview('left'));
	const rightPreview = $derived.by(() => getPlacementPreview('right'));
	const winner = $derived.by(() => {
		if (!game.state.result) return null;
		return game.state.players.find((player) => player.id === game.state.result?.winnerId) ?? null;
	});
	const markerPlayerId = $derived.by(() => {
		if (game.state.result && winner) {
			return winner.id;
		}
		return starterPlayerId;
	});

	function onWindowMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
	}
	// Release anywhere outside a drop zone cancels the drag (not the selection).
	function onWindowMouseUp() {
		draggedTile = null;
		dropZoneHovered = null;
	}

	function placeTile(side: 'left' | 'right') {
		if (!activeTile || game.state.result) return;
		game.nextTurn(game.state.players[0].id, activeTile.id, side);
		draggedTile = null;
		selectedTile = null;
		dropZoneHovered = null;
	}

	function getPlacementPreview(side: 'left' | 'right') {
		if (!activeTile || game.state.turnIndex !== 0 || game.state.result) return null;

		const orientedTile = orientTileForSide(game.state.board, activeTile, side);
		if (!orientedTile) return null;

		return {
			...orientedTile,
			...calculateBoardPreviewPosition(
				game.state.board.playedTiles,
				game.state.board.initialTileIndex,
				side,
				TILE_W,
				TILE_H,
				GAP
			)
		};
	}

	// ── Board Layout ───────────────────────────────────────────────────────────
	let boardLayout = $derived.by(() => {
		const tiles = game.state.board.playedTiles;
		if (!tiles || tiles.length === 0) return [];
		return calculateBoardLayout(tiles, game.state.board.initialTileIndex, TILE_W, TILE_H, GAP);
	});
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} />

<!-- ── Ghost tile follows cursor while dragging ──────────────────────────── -->
{#if isDragging && draggedTile}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80 drop-shadow-2xl"
		style="left:{mouseX}px; top:{mouseY}px;"
	>
		{@render DominoTile(draggedTile, false)}
	</div>
{/if}

<!-- CENTER — first tile on empty board -->
{#if showDropZones && game.state.board.playedTiles.length === 0}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
		<div
			role="button"
			tabindex="0"
			class="pointer-events-auto flex h-64 w-96 cursor-copy flex-col items-center
				justify-center gap-3 rounded-2xl transition-colors
				{dropZoneHovered === 'center'
				? 'border-4 border-green-300 bg-green-500/50'
				: 'border-4 border-green-400 bg-green-500/20'}"
			onmouseenter={() => (dropZoneHovered = 'center')}
			onmouseleave={() => (dropZoneHovered = null)}
			onmouseup={() => placeTile('right')}
			onclick={() => placeTile('right')}
		>
			<span class="text-4xl text-green-300">+</span>
			<span class="text-base font-bold text-green-300">Letakkan Kartu Pertama</span>
		</div>
	</div>
{/if}

<!-- ── DominoTile snippet ─────────────────────────────────────────────────── -->
{#snippet DominoTile(tile: { left: number; right: number }, isVertical: boolean)}
	<div
		class="flex overflow-hidden rounded-xl bg-neutral-200 shadow-md
			{isVertical ? 'h-28 w-14 flex-col' : 'h-14 w-28 flex-row'}"
	>
		<div
			class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2
			{!isVertical ? 'rotate-90' : ''}"
		>
			{#each dotPatterns[tile.left] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
		<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
			<div class="{isVertical ? 'h-full w-[70%]' : 'h-[70%] w-full'} bg-red-700/25"></div>
		</div>
		<div
			class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2
			{!isVertical ? 'rotate-90' : ''}"
		>
			{#each dotPatterns[tile.right] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
	</div>
{/snippet}

<!-- ── PlayerHand snippet ────────────────────────────────────────────────── -->
{#snippet PlacementGhost(tile: {
	left: number;
	right: number;
	x: number;
	y: number;
	rotation: number;
	side: 'left' | 'right';
})}
	{@const isVertical = tile.rotation % 180 !== 0}
	{@const cssRotation = isVertical ? tile.rotation - 90 : tile.rotation}
	<div
		class="absolute z-40 transition-all duration-200 ease-out"
		style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
	>
		<button
			class="cursor-copy rounded-2xl border-2 border-dashed border-green-300 bg-green-400/15 p-2
				opacity-70 shadow-[0_0_24px_rgba(74,222,128,0.28)] transition
				hover:bg-green-400/25 hover:opacity-95
				{dropZoneHovered === tile.side ? 'scale-105 opacity-95' : ''}"
			onmouseenter={() => (dropZoneHovered = tile.side)}
			onmouseleave={() => (dropZoneHovered = null)}
			onmousedown={(e) => e.preventDefault()}
			onmouseup={(e) => {
				e.stopPropagation();
				placeTile(tile.side);
			}}
			onclick={(e) => {
				e.stopPropagation();
				placeTile(tile.side);
			}}
		>
			{@render DominoTile(tile, isVertical)}
		</button>
	</div>
{/snippet}

{#snippet PlayerHand(index: number)}
	<!-- index 0 (bottom) and 2 (top) display tiles vertically (portrait).
	     index 1 (right) and 3 (left) display tiles horizontally (landscape). -->
	{@const isHandVertical = index === 0 || index === 2}
	{@const player = game.state.players[index]}
	{@const isMyTurn = game.state.turnIndex === index}
	{@const playableTileIds = new Set(
		generateLegalMoves(game.state, player.id).map((move) => move.tileId)
	)}
	<div
		class="relative flex gap-2 rounded-2xl bg-black/70 p-2
					{isMyTurn
			? 'border border-amber-300/70 shadow-[0_0_0_1px_rgba(252,211,77,0.35),0_0_20px_rgba(251,191,36,0.22)]'
			: 'border border-white/10'}
					{index === 1 || index === 3 ? 'flex-col-reverse' : 'flex-row'}"
	>
		{#each player.hand as tile (tile.id)}
			{@const isActive = activeTile?.id === tile.id}
			{@const isPlayable = playableTileIds.has(tile.id)}
			<button
				disabled={!isMyTurn || !isPlayable}
				class="flex cursor-pointer transition-all duration-150 select-none
				{isHandVertical ? 'hover:-translate-y-2' : 'hover:-translate-x-2'}
				{isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
				
				{isActive ? 'scale-90 opacity-30' : ''}
				{isMyTurn && selectedTile !== null && !isActive ? 'rounded-xl ring-2 ring-white/20' : ''}
			"
				onmousedown={(e) => {
					if (!isMyTurn || !isPlayable) return;
					e.preventDefault();
					// Start a drag. Clicking without dragging also triggers the tile
					// selection (handled in onclick below).
					draggedTile = tile;
					selectedTile = null;
					mouseX = e.clientX;
					mouseY = e.clientY;
				}}
				onclick={(e) => {
					if (!isMyTurn || !isPlayable) return;
					e.stopPropagation();
					// Toggle selection for click-to-place flow.
					if (selectedTile?.id === tile.id) {
						selectedTile = null;
					} else {
						selectedTile = tile;
						draggedTile = null;
					}
				}}
			>
				{@render DominoTile(tile, isHandVertical)}
			</button>
		{/each}
	</div>
{/snippet}

<!-- ── Root layout ────────────────────────────────────────────────────────── -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
	role="presentation"
	class="relative flex h-screen w-full items-center justify-center overflow-hidden bg-neutral-900 text-white select-none"
	onclick={() => {
		selectedTile = null;
	}}
>
	<!-- HUD -->
	<div class="absolute top-6 left-6 z-20 flex flex-col items-start gap-2 text-sm">
		{#if game.state.result && winner}
			<p class="font-bold text-yellow-400">Pemenang: {winner.name}</p>
		{/if}
		{#if game.state.result}
			<p class="rounded bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-200">
				{game.state.result.reason === 'empty-hand'
					? 'Kartu habis duluan'
					: 'Permainan buntu, skor tangan terkecil menang'}
			</p>
		{/if}
		{#if selectedTile}
			<p class="rounded bg-green-800/60 px-3 py-1 text-xs text-green-300">
				Kartu dipilih — klik ← / → untuk menempatkan
			</p>
		{/if}
	</div>

	{#if game.state.result && winner && !showResultDialog}
		<div class="absolute top-6 right-6 z-20">
			<button
				class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 transition hover:bg-green-400 active:scale-95"
				onclick={restartGame}
			>
				Main Lagi
			</button>
		</div>
	{/if}

	<!-- Board -->
	<div class="absolute inset-0 z-0 flex items-center justify-center p-20">
		<div
			class="relative flex h-full w-full items-center justify-center
				overflow-visible rounded-3xl bg-green-950/30 p-10 shadow-inner ring-2 ring-green-900"
		>
			{#if game.state.board.playedTiles.length === 0}
				<p class="text-lg font-bold text-neutral-500">Meja kosong. Pemain pertama mulai.</p>
			{:else}
				{#each boardLayout as tile (tile.id)}
					{@const isVertical = tile.rotation % 180 !== 0}
					{@const cssRotation = isVertical ? tile.rotation - 90 : tile.rotation}
					<div
						class="absolute transition-all duration-500 ease-out"
						style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
					>
						{@render DominoTile(tile, isVertical)}
					</div>
				{/each}
				{#if showDropZones && leftPreview}
					{@render PlacementGhost(leftPreview)}
				{/if}
				{#if showDropZones && rightPreview}
					{@render PlacementGhost(rightPreview)}
				{/if}
			{/if}
		</div>
	</div>

	<!-- Player Hands -->
	{#each game.state.players as player, i (player.id)}
		{@const isMarked = markerPlayerId === player.id}
		<div
			class="absolute z-10 flex flex-col gap-2 rounded-2xl bg-black/40 p-3 shadow-lg
				ring-1 ring-white/10 backdrop-blur-sm
				{i === 0
				? 'bottom-8 left-1/2 -translate-x-1/2'
				: i === 1
					? 'top-1/2 right-8 -translate-y-1/2'
					: i === 2
						? 'top-8 left-1/2 -translate-x-1/2'
						: 'top-1/2 left-8 -translate-y-1/2'}"
		>
			<div
				class="flex items-center justify-between gap-2 text-[10px] tracking-[0.25em] text-yellow-200/90 uppercase"
			>
				<span>{player.name}</span>
				<div class="flex items-center gap-1">
					{#if isMarked}
						<span
							class="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-950"
						>
							D
						</span>
					{/if}
					<span
						class="rounded-full bg-yellow-400/15 px-2 py-1 font-bold text-yellow-100 ring-1 ring-yellow-300/20"
						>{game.getWinCount(player.id)}</span
					>
				</div>
			</div>

			{@render PlayerHand(i)}
		</div>
	{/each}
</div>

{#if game.state.result && winner && showResultDialog}
	<div class="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
		<div
			class="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-6 shadow-2xl ring-1 ring-white/10"
		>
			<p class="text-sm tracking-[0.25em] text-yellow-300 uppercase">Permainan Selesai</p>
			<h2 class="mt-3 text-3xl font-black text-white">{winner.name} Menang!</h2>
			<p class="mt-3 text-sm text-neutral-300">
				{game.state.result.reason === 'empty-hand'
					? 'Pemain ini menghabiskan semua kartu lebih dulu.'
					: 'Permainan buntu, dan skor tangan terkecil yang menang.'}
			</p>
			<div class="mt-6 flex justify-end gap-3">
				<button
					class="rounded-xl bg-neutral-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-600 active:scale-95"
					onclick={() => (showResultDialog = false)}
				>
					Tutup
				</button>
				<button
					class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 transition hover:bg-green-400 active:scale-95"
					onclick={restartGame}
				>
					Main Lagi
				</button>
			</div>
		</div>
	</div>
{/if}
