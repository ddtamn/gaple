<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';
	import { orientTileForSide } from '../engine/board';
	import { calculateBoardLayout, calculateBoardPreviewPosition } from '../engine/boardLayout';
	import { generateLegalMoves } from '../engine/moves';
	import type { Domino } from '../engine/types';
	import type { TilePosition } from '../engine/types';

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
	const GAP = 0;

	const game = new SvelteGameManager(['Pemain Bawah', 'AI Kanan', 'AI Tengah', 'AI Kiri']);

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
	let draggedTile: Domino | null = $state(null);
	let selectedTile: Domino | null = $state(null);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let dropZoneHovered: 'left' | 'right' | 'center' | null = $state(null);

	const activeTile: Domino | null = $derived(draggedTile ?? selectedTile);
	const isDragging = $derived(draggedTile !== null);
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
				activeTile,
				TILE_W,
				TILE_H,
				GAP
			)
		};
	}

	let boardLayout = $derived.by(() => {
		const tiles = game.state.board.playedTiles;
		if (!tiles || tiles.length === 0) return [];
		return calculateBoardLayout(tiles, game.state.board.initialTileIndex, TILE_W, TILE_H, GAP);
	});

	// ── Auto-Scale Camera Math ─────────────────────────────────────────────────
	let boardWidth = $state(950);
	let boardHeight = $state(650);

	let camera = $derived.by(() => {
		const items = [...boardLayout];
		if (showDropZones && leftPreview) items.push(leftPreview as TilePosition);
		if (showDropZones && rightPreview) items.push(rightPreview as TilePosition);

		if (items.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;

		for (const item of items) {
			const isVertical = item.rotation % 180 !== 0;
			const w = isVertical ? TILE_H : TILE_W;
			const h = isVertical ? TILE_W : TILE_H;

			minX = Math.min(minX, item.x - w / 2);
			maxX = Math.max(maxX, item.x + w / 2);
			minY = Math.min(minY, item.y - h / 2);
			maxY = Math.max(maxY, item.y + h / 2);
		}

		const isMobile = boardWidth < 768;

		const PADDING_W = isMobile ? 40 : 100;
		const PADDING_H = isMobile ? 280 : 340;

		const maxW = Math.max(boardWidth - PADDING_W, 200);
		const maxH = Math.max(boardHeight - PADDING_H, 200);

		const boundingWidth = maxX - minX;
		const boundingHeight = maxY - minY;
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;
		const scale = Math.min(1, maxW / (boundingWidth || 1), maxH / (boundingHeight || 1));
		return { scale, offsetX: -centerX, offsetY: -centerY };
	});
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} />

{#if isDragging && draggedTile}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80 drop-shadow-2xl"
		style="left:{mouseX}px; top:{mouseY}px;"
	>
		{@render DominoTile(draggedTile, false)}
	</div>
{/if}

{#if showDropZones && game.state.board.playedTiles.length === 0}
	<div class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
		<div
			role="button"
			tabindex="0"
			class="pointer-events-auto flex h-48 w-72 cursor-copy flex-col items-center justify-center gap-3
        rounded-2xl transition-colors md:h-64 md:w-96
        {dropZoneHovered === 'center'
				? 'border-4 border-green-300 bg-green-500/50'
				: 'border-4 border-green-400 bg-green-500/20'}"
			onmouseenter={() => (dropZoneHovered = 'center')}
			onmouseleave={() => (dropZoneHovered = null)}
			onmouseup={() => placeTile('right')}
			onclick={() => placeTile('right')}
			onkeydown={(e) => e.key === 'Enter' && placeTile('right')}
		>
			<span class="text-3xl text-green-300 md:text-4xl">+</span>
			<span class="text-sm font-bold text-green-300 md:text-base">Letakkan Kartu Pertama</span>
		</div>
	</div>
{/if}

{#snippet DominoTile(tile: { left: number; right: number }, isVertical: boolean)}
	<div
		class="flex overflow-hidden rounded-xl bg-neutral-200 shadow-md
      {isVertical ? 'h-28 w-14 flex-col' : 'h-14 w-28 flex-row'}"
	>
		<div
			class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical
				? 'rotate-90'
				: ''}"
		>
			{#each dotPatterns[tile.left] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
		<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
			<div class="{isVertical ? 'h-full w-[70%]' : 'h-[70%] w-full'} bg-red-700/25"></div>
		</div>
		<div
			class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical
				? 'rotate-90'
				: ''}"
		>
			{#each dotPatterns[tile.right] as hasDot, j (j)}
				<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
			{/each}
		</div>
	</div>
{/snippet}

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
		class="absolute z-40 transition-all duration-500 ease-out"
		style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
	>
		<button
			class="cursor-copy rounded-2xl border-2 border-dashed border-green-300 bg-green-400/15 p-2
        opacity-70 shadow-[0_0_24px_rgba(74,222,128,0.28)] transition hover:bg-green-400/25 hover:opacity-95
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

{#snippet BotAvatar(index: number)}
	{@const player = game.state.players[index]}
	{@const isMarked = markerPlayerId === player.id}
	{@const isMyTurn = game.state.turnIndex === index}

	<div
		class="pointer-events-auto relative z-20 mb-8 flex w-[64px] scale-[1.8] flex-col items-center justify-center gap-1 rounded-2xl bg-black/70 p-2 shadow-lg ring-1 ring-white/10 backdrop-blur-md md:w-[80px] md:scale-none"
	>
		{#if isMyTurn}
			<div
				class="pointer-events-none absolute inset-0 animate-pulse rounded-2xl border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)]"
			></div>
		{/if}

		<div class="relative">
			<img
				src={`https://api.dicebear.com/9.x/bottts/svg?seed=${player.name}`}
				alt="Avatar AI"
				class="h-10 w-10 rounded-full bg-neutral-800 object-cover shadow-inner ring-2 ring-white/20 md:h-12 md:w-12"
			/>
			{#if isMarked}
				<span
					class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-black text-amber-950 shadow-md"
					>D</span
				>
			{/if}
		</div>
		<span
			class="mt-2 w-full rounded-full bg-black/50 py-0.5 text-center text-[12px] font-bold text-yellow-400 ring-1 ring-yellow-400/20"
		>
			{game.getWinCount(player.id)}
		</span>
	</div>
{/snippet}

{#snippet MainPlayerBadge()}
	{@const player = game.state.players[0]}
	{@const isMarked = markerPlayerId === player.id}

	<div class="relative flex w-fit items-center gap-2">
		{#if isMarked}
			<span
				class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950 shadow-md"
				>D</span
			>
		{/if}

		<div class="flex items-center gap-1.5">
			<span
				class="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-black/75 px-2 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/40"
			>
				{game.getWinCount(player.id)}
			</span>
		</div>
	</div>
{/snippet}

{#snippet PlayerHand(index: number, isMain: boolean)}
	{@const isHandVertical = true}
	{@const player = game.state.players[index]}
	{@const isMyTurn = game.state.turnIndex === index}
	{@const playableTileIds = new Set(
		generateLegalMoves(game.state, player.id).map((move) => move.tileId)
	)}

	<div
		class="relative flex flex-col items-center gap-2 {isMain ? 'origin-bottom scale-[1.3]' : ''}
       "
	>
		{#if isMain}
			<div class="origin-bottom scale-[0.8]">
				{@render MainPlayerBadge()}
			</div>
		{/if}
		<div
			class="flex flex-row flex-wrap justify-center rounded-2xl transition-all duration-150 md:flex-nowrap {isMain
				? 'w-[90vw] gap-1 sm:w-[280px] md:w-max md:gap-2'
				: 'w-[270px] gap-1 p-2 md:w-max md:gap-2 md:p-3'}"
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
        {isMyTurn && selectedTile !== null && !isActive ? 'rounded-xl ring-2 ring-white/20' : ''}"
					onmousedown={(e) => {
						if (!isMyTurn || !isPlayable) return;
						e.preventDefault();
						draggedTile = tile;
						selectedTile = null;
						mouseX = e.clientX;
						mouseY = e.clientY;
					}}
					onclick={(e) => {
						if (!isMyTurn || !isPlayable) return;
						e.stopPropagation();
						if (selectedTile?.id === tile.id) selectedTile = null;
						else {
							selectedTile = tile;
							draggedTile = null;
						}
					}}
				>
					{@render DominoTile(tile, isHandVertical)}
				</button>
			{/each}
		</div>
	</div>
{/snippet}

<div
	role="presentation"
	class="relative flex h-screen w-full items-center justify-center overflow-hidden bg-neutral-900 text-white select-none"
	onclick={() => {
		selectedTile = null;
	}}
>
	<div
		class="absolute top-2 left-2 z-20 flex flex-col items-start gap-2 text-sm md:top-6 md:left-6"
	>
		{#if game.state.result && winner}
			<p class="font-bold text-yellow-400">Pemenang: {winner.name}</p>
		{/if}
		{#if game.state.result}
			<p class="rounded bg-yellow-500/15 px-3 py-1 text-xs font-semibold text-yellow-200">
				{game.state.result.reason === 'empty-hand'
					? 'Kartu habis duluan'
					: 'Permainan buntu, skor terkecil menang'}
			</p>
		{/if}
		{#if selectedTile}
			<p class="rounded bg-green-800/60 px-3 py-1 text-xs text-green-300">
				Kartu dipilih — klik ← / → untuk menempatkan
			</p>
		{/if}
	</div>

	{#if game.state.result && winner && !showResultDialog}
		<div class="absolute top-2 right-2 z-20 md:top-6 md:right-6">
			<button
				class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 transition hover:bg-green-400 active:scale-95"
				onclick={restartGame}
			>
				Main Lagi
			</button>
		</div>
	{/if}

	<div class="absolute inset-0 z-0 flex items-center justify-center">
		<div
			class="relative flex h-full w-full items-center justify-center overflow-hidden bg-green-950/30 shadow-inner ring-2 ring-green-900"
			bind:clientWidth={boardWidth}
			bind:clientHeight={boardHeight}
		>
			{#if game.state.board.playedTiles.length === 0}
				<p class="px-4 text-center text-sm font-bold text-neutral-500 md:text-lg">
					Meja kosong. Pemain pertama mulai.
				</p>
			{:else}
				<div
					class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out"
					style="transform: scale({camera.scale});"
				>
					<div
						class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out"
						style="transform: translate({camera.offsetX}px, {camera.offsetY}px);"
					>
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
					</div>
				</div>
			{/if}
		</div>
	</div>

	<div
		class="pointer-events-none absolute top-16 left-2 z-10 sm:top-20 sm:left-4 md:top-8 md:left-12"
	>
		<div
			class="flex origin-top-left scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{@render BotAvatar(3)}
			<div class="pointer-events-auto">
				{@render PlayerHand(3, false)}
			</div>
		</div>
	</div>

	<div class="pointer-events-none absolute top-8 left-1/2 z-10 -translate-x-1/2">
		<div
			class="flex origin-top scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{@render BotAvatar(2)}
			<div class="pointer-events-auto">
				{@render PlayerHand(2, false)}
			</div>
		</div>
	</div>

	<div
		class="pointer-events-none absolute top-16 right-2 z-10 sm:top-20 sm:right-4 md:top-8 md:right-12"
	>
		<div
			class="flex origin-top-right scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{@render BotAvatar(1)}
			<div class="pointer-events-auto">
				{@render PlayerHand(1, false)}
			</div>
		</div>
	</div>

	<div class="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
		<div
			class="flex origin-bottom scale-[0.85] flex-col items-center gap-2 transition-transform duration-300 sm:scale-100"
		>
			<div class="pointer-events-auto relative flex flex-col items-center">
				{@render PlayerHand(0, true)}
			</div>
		</div>
	</div>
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
