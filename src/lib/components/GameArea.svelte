<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';
	import { getMultiplayer } from '$lib/multiplayer/room.svelte';
	import { calculateBoardLayout, calculateBoardPreviewPosition } from '../../engine/boardLayout';
	import { orientTileForSide } from '../../engine/board';
	import { generateLegalMoves } from '../../engine/moves';
	import type { Domino, TeamConfig, TilePosition } from '../../engine/types';

	import DominoTile from './DominoTile.svelte';
	import PlacementGhost from './PlacementGhost.svelte';
	import BotAvatar from './BotAvatar.svelte';
	import PlayerHand from './PlayerHand.svelte';
	import MainPlayerHand from './MainPlayerHand.svelte';

	// PROPS DARI LOBI
	let {
		mode = 'vs-ai',
		rounds = 3,
		onExit
	}: { rounds: number | string; mode: string; onExit: () => void } = $props();

	// ── Determine if multiplayer ──────────────────────────────────────
	const isMultiplayer = $derived(mode === 'multiplayer');
	const mp = isMultiplayer ? getMultiplayer() : null;

	const TILE_W = 112;
	const TILE_H = 56;
	const GAP = 0;

	// ── Game State Resolution ─────────────────────────────────────────
	// In multiplayer mode, game state comes from the server via the multiplayer store.
	// In local mode, we use SvelteGameManager.
	let game = $state<SvelteGameManager | null>(null);

	// Reactive game state (from whichever source)
	const currentGameState = $derived(mp?.gameState ?? game?.state ?? null);

	$effect(() => {
		if (!isMultiplayer && !game) {
			initLocalGame();
		}
	});

	// Placeholder for non-interactive bot hand events
	function handleSampleDisabled() {}

	function initLocalGame() {
		const teamConfig = resolveTeamConfig(mode);
		const g = new SvelteGameManager(
			['Pemain Bawah', 'AI Kanan', 'AI Tengah', 'AI Kiri'],
			undefined,
			teamConfig
		);
		g.startGame();
		g.setBotPlayers(['1', '2', '3']);
		game = g;
		starterPlayerId = g.state.players[g.state.turnIndex]?.id ?? null;
	}

	function resolveTeamConfig(gameMode: string): TeamConfig | undefined {
		if (gameMode === 'vs-ai') return undefined;
		if (gameMode === 'multiplayer') return undefined;
		return { mode: 'teams', layout: [[0, 2], [1, 3]] };
	}

	let showResultDialog = $state(true);
	let starterPlayerId = $state<string | null>(null);

	// STATE UNTUK RONDE
	let currentRound = $state(1);

	function syncStarterMarker() {
		if (!game || !game.state) return;
		starterPlayerId = game.state.players[game.state.turnIndex]?.id ?? null;
	}

	// FUNGSI LANJUT RONDE
	function nextRound() {
		if (!game) return;
		const previousWinnerId = game.state.result?.winnerId;
		currentRound++;
		game.startGame(previousWinnerId);
		syncStarterMarker();
		game.setBotPlayers(['1', '2', '3']);
		showResultDialog = true;
	}

	// ── Interaction state ──────────────────────────────────────────────────────
	let draggedTile = $state<Domino | null>(null);
	let selectedTile = $state<Domino | null>(null);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let dropZoneHovered = $state<'left' | 'right' | 'center' | null>(null);

	const activeTile = $derived(draggedTile ?? selectedTile);
	const isDragging = $derived(draggedTile !== null);
	// Show drop zones when it's the player's turn
	const isMyTurn = $derived(
		isMultiplayer
			? mp?.myPlayerId === currentGameState?.players[currentGameState?.turnIndex]?.id
			: currentGameState?.turnIndex === 0
	);
	const showDropZones = $derived(activeTile !== null && !!isMyTurn && !currentGameState?.result);
	const leftPreview = $derived.by(() => getPlacementPreview('left'));
	const rightPreview = $derived.by(() => getPlacementPreview('right'));

	const winner = $derived.by(() => {
		if (!currentGameState?.result) return null;
		return currentGameState.players.find((p) => p.id === currentGameState.result?.winnerId) ?? null;
	});

	const markerPlayerId = $derived.by(() => {
		if (currentGameState?.result && winner) return winner.id;
		return starterPlayerId;
	});

	// Mengecek apakah pertandingan (seluruh ronde) sudah selesai
	const isMatchOver = $derived(
		currentGameState?.result && !isMultiplayer && rounds !== 'custom' && currentRound >= (rounds as number)
	);

	// Mengurutkan klasemen skor untuk akhir pertandingan
	const finalStandings = $derived.by(() => {
		if (!currentGameState?.result) return [];
		const standings = currentGameState.players.map((p) => ({
			name: p.name,
			points: currentGameState.pointStandings[p.id] || 0
		}));
		return standings.sort((a, b) => b.points - a.points);
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
		if (!activeTile || currentGameState?.result) return;
		if (isMultiplayer && mp) {
			mp.playTile(activeTile.id, side);
		} else if (game && currentGameState) {
			game.nextTurn(currentGameState.players[0].id, activeTile.id, side);
		}
		draggedTile = null;
		selectedTile = null;
		dropZoneHovered = null;
	}

	function getPlacementPreview(side: 'left' | 'right') {
		if (!activeTile || !currentGameState || currentGameState.result) return null;
		if (!isMultiplayer && currentGameState.turnIndex !== 0) return null;
		if (isMultiplayer && mp && currentGameState.players[currentGameState.turnIndex]?.id !== mp.myPlayerId) return null;

		if (currentGameState.board.playedTiles.length === 0) {
			if (side === 'left') return null;
			return { ...activeTile, x: 0, y: 0, rotation: 90, side };
		}

		const orientedTile = orientTileForSide(currentGameState.board, activeTile, side);
		if (!orientedTile) return null;

		return {
			...orientedTile,
			...calculateBoardPreviewPosition(
				currentGameState.board.playedTiles,
				currentGameState.board.initialTileIndex,
				side,
				activeTile,
				TILE_W,
				TILE_H,
				GAP
			)
		};
	}

	let boardLayout = $derived.by(() => {
		if (!currentGameState) return [];
		const tiles = currentGameState.board.playedTiles;
		if (!tiles || tiles.length === 0) return [];
		return calculateBoardLayout(tiles, currentGameState.board.initialTileIndex, TILE_W, TILE_H, GAP);
	});

	let boardWidth = $state(950);
	let boardHeight = $state(650);
	let mainHandHeight = $state(0);

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
		const PADDING_H = isMobile ? mainHandHeight + 100 : mainHandHeight + 160;

		const maxW = Math.max(boardWidth - PADDING_W, 200);
		const maxH = Math.max(boardHeight - PADDING_H, 200);

		const boundingWidth = maxX - minX;
		const boundingHeight = maxY - minY;
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		const scale = Math.min(1, maxW / (boundingWidth || 1), maxH / (boundingHeight || 1));
		return { scale, offsetX: -centerX, offsetY: -centerY };
	});

	function handleTileDragStart(tile: Domino, e: MouseEvent) {
		e.preventDefault();
		draggedTile = tile;
		selectedTile = null;
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	function handleTileClick(tile: Domino, e: MouseEvent) {
		e.stopPropagation();
		if (currentGameState?.result) return;
		if (selectedTile?.id === tile.id) selectedTile = null;
		else {
			selectedTile = tile;
			draggedTile = null;
		}
	}
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} />

{#if isDragging && draggedTile}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80"
		style="left:{mouseX}px; top:{mouseY}px;"
	>
		<DominoTile tile={draggedTile} isVertical={false} />
	</div>
{/if}

<div
	role="presentation"
	class="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-background text-stone-100 select-none"
	onclick={() => (selectedTile = null)}
>
	<div
		class="absolute top-2 left-2 z-20 flex flex-col items-start gap-2 text-sm md:top-6 md:left-6"
	>
		<div
			class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3 py-1.5"
		>
			<span class="font-body text-xs text-stone-500">Mode:</span>
			<span class="font-body text-xs font-semibold text-stone-100 uppercase">{mode?.replace(/-/g, ' ')}</span>
			<span class="text-stone-500">|</span>
			<span class="font-body text-xs text-stone-500">Ronde</span>
			<span class="font-body text-xs font-bold text-primary"
				>{currentRound} / {rounds === 'custom' ? '∞' : rounds}</span
			>
		</div>

		{#if selectedTile && !currentGameState?.result}
			<p class="rounded bg-warm-hover px-3 py-1 font-body text-xs text-primary">
				Kartu dipilih — klik ← / → untuk menempatkan
			</p>
		{/if}

		{#if isMultiplayer && !isMyTurn && !currentGameState?.result}
			<p class="rounded bg-warm-hover px-3 py-1 font-body text-xs text-amber-400">
				Menunggu giliran pemain lain...
			</p>
		{/if}
	</div>

	{#if currentGameState?.result && winner}
		<div
			class="pointer-events-none absolute top-36 left-1/2 z-20 w-full -translate-x-1/2 px-4 text-center md:top-40"
		>
			<h2
				class="font-headline text-3xl font-bold tracking-wide md:text-5xl
				{winner.id === currentGameState.players[0].id ? 'text-primary' : 'text-stone-200'}"
			>
				{#if !isMultiplayer && winner.id === currentGameState.players[0].id}
					🎉 Anda Menang Ronde Ini!
				{:else}
					{winner.name} Menang!
				{/if}
			</h2>				{#if currentGameState.result}
					<p class="mt-2 font-body text-lg font-semibold text-stone-300 md:text-xl">
						{currentGameState.result.winType}
						<span class="text-primary">(+{currentGameState.result.points} Poin)</span>
					</p>
				{/if}
		</div>
	{/if}

	{#if currentGameState?.result && !showResultDialog}
		<div class="absolute top-2 right-2 z-20 flex gap-2 md:top-6 md:right-6">
			<button
				class="rounded border-[1.5px] border-primary bg-transparent px-4 py-2 font-body text-sm font-semibold text-primary transition hover:bg-warm-hover active:scale-[0.98]"
				onclick={onExit}
			>
				Ke Lobi
			</button>
			{#if !isMatchOver && !isMultiplayer}
				<button
					class="rounded bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active active:scale-[0.98]"
					onclick={nextRound}
				>
					Lanjut Ronde
				</button>
			{/if}
		</div>
	{/if}

	<div class="absolute inset-0 z-0 flex items-center justify-center">
		<div
			class="relative flex h-full w-full items-center justify-center overflow-hidden bg-background"
			bind:clientWidth={boardWidth}
			bind:clientHeight={boardHeight}
		>
			<div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,163,115,0.12)_0%,transparent_70%)]"></div>
			{#if currentGameState?.board.playedTiles.length === 0 && !showDropZones}
				<p class="px-4 text-center font-body text-sm font-medium text-stone-500 md:text-lg">
					Meja kosong. Pemain pertama mulai.
				</p>
			{/if}

			<div
				class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out {currentGameState
					?.board.playedTiles.length === 0 && !showDropZones
					? 'invisible opacity-0'
					: ''}"
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
							<DominoTile {tile} {isVertical} />
						</div>
					{/each}

					{#if showDropZones && leftPreview}
						<PlacementGhost
							tile={leftPreview}
							{dropZoneHovered}
							onhover={(v) => (dropZoneHovered = v)}
							onplace={placeTile}
						/>
					{/if}
					{#if showDropZones && rightPreview}
						<PlacementGhost
							tile={rightPreview}
							{dropZoneHovered}
							onhover={(v) => (dropZoneHovered = v)}
							onplace={placeTile}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div
		class="pointer-events-none absolute top-16 left-2 z-10 sm:top-20 sm:left-4 md:top-8 md:left-12"
	>
		<div
			class="flex origin-top-left scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{#if currentGameState}
				<BotAvatar
					player={currentGameState.players[3]}
					isMyTurn={currentGameState.turnIndex === 3}
					isMarked={markerPlayerId === currentGameState.players[3].id}
					winCount={currentGameState.pointStandings[currentGameState.players[3].id] || 0}
				/>
				<div class="pointer-events-auto">
					<PlayerHand
						player={currentGameState.players[3]}
						isMyTurn={currentGameState.turnIndex === 3}
						isMarked={markerPlayerId === currentGameState.players[3].id}
						winCount={currentGameState.pointStandings[currentGameState.players[3].id] || 0}
						playableTileIds={new Set(
							generateLegalMoves(currentGameState, currentGameState.players[3].id).map((m) => m.tileId)
						)}
						activeTileId={activeTile?.id ?? null}
						selectedTileId={selectedTile?.id ?? null}
						ondragstart={handleSampleDisabled}
						ontileclick={handleSampleDisabled}
					/>
				</div>
			{/if}
		</div>
	</div>

	<div class="pointer-events-none absolute top-8 left-1/2 z-10 -translate-x-1/2">
		<div
			class="flex origin-top scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{#if currentGameState}
				<BotAvatar
					player={currentGameState.players[2]}
					isMyTurn={currentGameState.turnIndex === 2}
					isMarked={markerPlayerId === currentGameState.players[2].id}
					winCount={currentGameState.pointStandings[currentGameState.players[2].id] || 0}
				/>
				<div class="pointer-events-auto">
					<PlayerHand
						player={currentGameState.players[2]}
						isMyTurn={currentGameState.turnIndex === 2}
						isMarked={markerPlayerId === currentGameState.players[2].id}
						winCount={currentGameState.pointStandings[currentGameState.players[2].id] || 0}
						playableTileIds={new Set(
							generateLegalMoves(currentGameState, currentGameState.players[2].id).map((m) => m.tileId)
						)}
						activeTileId={activeTile?.id ?? null}
						selectedTileId={selectedTile?.id ?? null}
						ondragstart={handleSampleDisabled}
						ontileclick={handleSampleDisabled}
					/>
				</div>
			{/if}
		</div>
	</div>

	<div
		class="pointer-events-none absolute top-16 right-2 z-10 sm:top-20 sm:right-4 md:top-8 md:right-12"
	>
		<div
			class="flex origin-top-right scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			{#if currentGameState}
				<BotAvatar
					player={currentGameState.players[1]}
					isMyTurn={currentGameState.turnIndex === 1}
					isMarked={markerPlayerId === currentGameState.players[1].id}
					winCount={currentGameState.pointStandings[currentGameState.players[1].id] || 0}
				/>
				<div class="pointer-events-auto">
					<PlayerHand
						player={currentGameState.players[1]}
						isMyTurn={currentGameState.turnIndex === 1}
						isMarked={markerPlayerId === currentGameState.players[1].id}
						winCount={currentGameState.pointStandings[currentGameState.players[1].id] || 0}
						playableTileIds={new Set(
							generateLegalMoves(currentGameState, currentGameState.players[1].id).map((m) => m.tileId)
						)}
						activeTileId={activeTile?.id ?? null}
						selectedTileId={selectedTile?.id ?? null}
						ondragstart={handleSampleDisabled}
						ontileclick={handleSampleDisabled}
					/>
				</div>
			{/if}
		</div>
	</div>

	<div
		bind:clientHeight={mainHandHeight}
		class="absolute bottom-2 left-1/2 z-10 w-full -translate-x-1/2  md:w-fit"
	>
		{#if currentGameState}
			<MainPlayerHand
				player={currentGameState.players[0]}
				isMyTurn={currentGameState.turnIndex === 0}
				isMain={true}
				isMarked={markerPlayerId === currentGameState.players[0].id}
				winCount={currentGameState.pointStandings[currentGameState.players[0].id] || 0}
				playableTileIds={new Set(
					generateLegalMoves(currentGameState, currentGameState.players[0].id).map((m) => m.tileId)
				)}
				activeTileId={activeTile?.id ?? null}
				selectedTileId={selectedTile?.id ?? null}
				ondragstart={handleTileDragStart}
				ontileclick={handleTileClick}
				game={game}
			/>
		{/if}
	</div>
</div>

{#if currentGameState?.result && winner && showResultDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm">
		<div
			class="w-full max-w-md rounded-lg border border-stone-700 bg-surface p-8"
		>
			{#if isMatchOver}
				<p class="text-center font-body text-xs font-bold tracking-[0.25em] text-primary uppercase">
					Match Completed
				</p>
				<h2 class="mt-2 text-center font-headline text-3xl font-bold text-stone-100">
					🏆 {finalStandings[0].name} Juara!
				</h2>

				<div class="mt-6 flex flex-col gap-2">
					<p class="mb-1 font-body text-xs font-semibold tracking-widest text-stone-500 uppercase">
						Klasemen Akhir
					</p>
					{#each finalStandings as rank, index (index)}
						<div
							class="flex items-center justify-between rounded-lg border border-stone-700 bg-warm-hover px-4 py-3"
						>
							<div class="flex items-center gap-3">
								<span class="w-4 font-headline text-lg font-bold text-stone-400">{index + 1}</span>
								<span
									class="font-body font-semibold text-stone-100 {rank.name === 'Pemain Bawah'
										? 'text-primary'
										: ''}">{rank.name}</span
								>
							</div>
							<span class="font-headline text-lg font-bold text-primary"
								>{rank.points} <span class="font-body text-xs font-normal text-primary/60">pts</span></span
							>
						</div>
					{/each}
				</div>

				<div class="mt-8 flex justify-center">
					<button
						class="w-full rounded bg-primary px-6 py-4 font-body text-base font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active active:scale-[0.98]"
						onclick={onExit}
					>
						KEMBALI KE LOBI
					</button>
				</div>
			{:else}
				<div class="mb-4 flex items-center justify-between border-b border-stone-700 pb-4">
					<p class="font-body text-xs font-bold tracking-[0.2em] text-stone-500 uppercase">
						Ronde {currentRound} Berakhir
					</p>
					<button
						class="text-stone-500 transition hover:text-stone-100 hover:bg-stone-800"
						onclick={() => (showResultDialog = false)}>✕</button
					>
				</div>

				<div class="my-8 text-center">
					<h2 class="mb-2 font-headline text-3xl font-bold text-stone-100">{winner.name} Menang!</h2>
					<div class="inline-block rounded-lg border border-primary/20 bg-warm-hover px-6 py-3">
						<p class="mb-1 font-body text-xs font-semibold tracking-wide text-primary uppercase">
							Mendapatkan
						</p>
					<p class="font-headline text-4xl font-bold text-primary">
						+{currentGameState.result.points} <span class="font-body text-lg">Poin</span>
					</p>
					</div>
					{#if currentGameState.result}
						<p
							class="mt-4 inline-block rounded-lg border border-stone-700 bg-surface px-4 py-2 font-body text-sm font-medium text-stone-300"
						>
							Tipe Kemenangan: <span class="font-bold text-stone-100">{currentGameState.result.winType}</span>
						</p>
					{/if}
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						class="w-full rounded bg-primary px-6 py-3 font-body text-sm font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active active:scale-[0.98]"
						onclick={nextRound}
					>
						LANJUT RONDE {currentRound + 1} ➔
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
