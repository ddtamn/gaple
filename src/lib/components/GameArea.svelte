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

	// ── Determine if multiplayer (coop modes use PartyKit) ─────────────
	const isMultiplayer = $derived(mode === 'coop-vs-ai' || mode === 'coop-vs-coop');
	const mp = $derived(isMultiplayer ? getMultiplayer() : null);

	// Coop-specific helpers
	const isCoopMode = $derived(mode === 'coop-vs-ai' || mode === 'coop-vs-coop');

	// In multiplayer, find our player index in the game state (for POV rotation)
	const myPlayerIndex = $derived(isMultiplayer ? (mp?.myPlayerIndex ?? -1) : 0);

	// Helper: map position offset (0=bottom, 1=right, 2=top, 3=left) to actual player index
	// In single-player, human is always index 0. In multiplayer, rotate based on myPlayerIndex.
	function p(offset: number) {
		const players = currentGameState?.players;
		if (!players || players.length === 0) return null;
		if (isMultiplayer && myPlayerIndex >= 0) {
			return players[(myPlayerIndex + offset) % players.length];
		}
		return players[offset];
	}

	// Coop visibility: teammates (same teamId) see each other's cards; opponents see card backs.
	// In vs-ai mode, all cards are visible.
	function getShowCardFaces(gamePlayerIndex: number): boolean {
		if (!isCoopMode) return true;
		const mainPlayer = p(0);
		const targetPlayer = currentGameState?.players[gamePlayerIndex];
		if (!mainPlayer || !targetPlayer) return true;
		return mainPlayer.teamId === targetPlayer.teamId;
	}

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
		// For coop modes, team config comes from the server via the game state
		return undefined;
	}

	let starterPlayerId = $state<string | null>(null);

	// STATE UNTUK RONDE (from server for multiplayer, local for vs-ai)
	let currentRound = $state(1);
	// In multiplayer, round counter comes from server
	const mpCurrentRound = $derived(isMultiplayer ? (mp?.currentRound ?? 1) : currentRound);

	function syncStarterMarker() {
		if (!game || !game.state) return;
		starterPlayerId = game.state.players[game.state.turnIndex]?.id ?? null;
	}

	// FUNGSI LANJUT RONDE
	function nextRound() {
		if (isMultiplayer && mp) {
			mp.nextRound();
			currentRound++;
			return;
		}
		if (!game) return;
		const previousWinnerId = game.state.result?.winnerId;
		currentRound++;
		game.startGame(previousWinnerId);
		syncStarterMarker();
		game.setBotPlayers(['1', '2', '3']);
	}

	// ── Team Scores (Coop Mode) ──────────────────────────────────────
	const teamScores = $derived.by(() => {
		if (!currentGameState || !isCoopMode) return null;
		const scores: Record<string, number> = {};
		for (const player of currentGameState.players) {
			const key = player.teamId !== undefined ? `team-${player.teamId}` : 'team-0';
			scores[key] = (scores[key] || 0) + (currentGameState.pointStandings[player.id] || 0);
		}
		return scores;
	});
	const teamScoreEntries = $derived.by(() => teamScores ? Object.entries(teamScores) : []);

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
			? currentGameState?.turnIndex === myPlayerIndex
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
	const effectiveRound = $derived(mpCurrentRound);
	const isMatchOver = $derived(
		currentGameState?.result && rounds !== 'custom' && effectiveRound >= (rounds as number)
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
		if (currentGameState.turnIndex !== myPlayerIndex) return null;

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

<!-- Dragged tile follow-mouse overlay -->
{#if isDragging && draggedTile}
	<div
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80"
		style="left:{mouseX}px; top:{mouseY}px;"
	>
		<DominoTile tile={draggedTile} isVertical={false} />
	</div>
{/if}

<!-- ══════════════════ MAIN FLEXBOX LAYOUT ══════════════════ -->
<div
	role="presentation"
	class="flex h-dvh w-full flex-col overflow-hidden bg-background text-stone-100 select-none"
	onclick={() => (selectedTile = null)}
>
	<!-- ── LAYER 1: Game Info Bar ─────────────────────────────── -->
	<div class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-800 px-3 py-2 md:px-6 md:py-3">
		<div class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3 py-1.5">
			<span class="font-body text-xs text-stone-500">Mode:</span>
			<span class="font-body text-xs font-semibold text-stone-100 uppercase">{mode?.replace(/-/g, ' ')}</span>
			<span class="text-stone-500">|</span>
			<span class="font-body text-xs text-stone-500">Ronde</span>
			<span class="font-body text-xs font-bold text-primary"
				>{mpCurrentRound} / {rounds === 'custom' ? '∞' : rounds}</span
			>
		</div>

		<!-- Coop team scores -->
		{#if isCoopMode && teamScores}
			<div class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3 py-1.5">
				<span class="font-body text-xs text-stone-500">Score:</span>
				{#each teamScoreEntries as [teamKey, score], i}
					<span class="font-body text-xs font-bold {i === 0 ? 'text-emerald-400' : 'text-red-400'}">
						{score}
					</span>
					{#if i < teamScoreEntries.length - 1}
						<span class="text-stone-600">|</span>
					{/if}
				{/each}
			</div>
		{/if}

		<!-- Status messages -->
		<div class="flex items-center gap-2">
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
	</div>

	<!-- ── LAYER 2: Round Result / Match Over (inline, no modal) ── -->
	{#if currentGameState?.result}
		<div class="shrink-0 border-b border-stone-800 px-4 py-3">
			{#if isMatchOver}
				<!-- Match completed -->
				<div class="mx-auto max-w-lg text-center">
					<p class="font-body text-xs font-bold tracking-[0.25em] text-primary uppercase">
						Match Completed
					</p>
					<h2 class="mt-1 font-headline text-2xl font-bold text-stone-100 md:text-3xl">
						🏆 {finalStandings[0].name} Juara!
					</h2>
					<div class="mt-3 flex flex-col gap-1.5">
						{#each finalStandings as rank, index (index)}
							<div
								class="flex items-center justify-between rounded-lg border border-stone-700 bg-warm-hover px-4 py-2"
							>
								<div class="flex items-center gap-3">
									<span class="w-4 font-headline text-lg font-bold text-stone-400">{index + 1}</span>
									<span
										class="font-body font-semibold text-stone-100 {rank.name === 'Pemain Bawah'
											? 'text-primary'
											: ''}"
									>
										{rank.name}
									</span>
								</div>
								<span class="font-headline text-lg font-bold text-primary"
									>{rank.points} <span class="font-body text-xs font-normal text-primary/60">pts</span></span
								>
							</div>
						{/each}
					</div>
				</div>
			{:else if winner}
				<!-- Single round result -->
				<div class="text-center">
					<h2
						class="font-headline text-2xl font-bold tracking-wide md:text-3xl
						{winner.id === (p(0)?.id ?? '') ? 'text-primary' : 'text-stone-200'}"
					>
						{#if winner.id === (p(0)?.id ?? '')}
							🎉 Anda Menang Ronde Ini!
						{:else}
							{winner.name} Menang!
						{/if}
					</h2>
					{#if currentGameState.result}
						<p class="mt-1 font-body text-base font-semibold text-stone-300 md:text-lg">
							{currentGameState.result.winType}
							<span class="text-primary">(+{currentGameState.result.points} Poin)</span>
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── LAYER 3: 3 Opponent Players ────────────────────────── -->
	<div class="shrink-0 border-b border-stone-800 px-2 py-2 md:px-4">
		{#if currentGameState}
			{@const leftPlayer = p(3)}
			{@const leftTurnIndex = (myPlayerIndex + 3) % 4}
			{@const topPlayer = p(2)}
			{@const topTurnIndex = (myPlayerIndex + 2) % 4}
			{@const rightPlayer = p(1)}
			{@const rightTurnIndex = (myPlayerIndex + 1) % 4}
			<div class="flex items-start justify-around gap-2">
				<!-- Left Opponent (index 3) -->
				{#if leftPlayer}
					<div class="flex flex-col items-center gap-2">
						<BotAvatar
							player={leftPlayer}
							isMyTurn={currentGameState.turnIndex === leftTurnIndex}
							isMarked={markerPlayerId === leftPlayer.id}
							winCount={currentGameState.pointStandings[leftPlayer.id] || 0}
							showScore={!isCoopMode}
						/>
						<div class="pointer-events-auto">
							<PlayerHand
								player={leftPlayer}
								isMyTurn={currentGameState.turnIndex === leftTurnIndex}
								isMarked={markerPlayerId === leftPlayer.id}
								winCount={currentGameState.pointStandings[leftPlayer.id] || 0}
								playableTileIds={new Set(
									generateLegalMoves(currentGameState, leftPlayer.id).map((m) => m.tileId)
								)}
								activeTileId={activeTile?.id ?? null}
								selectedTileId={selectedTile?.id ?? null}
								ondragstart={handleSampleDisabled}
								ontileclick={handleSampleDisabled}
								showCardFaces={getShowCardFaces((myPlayerIndex + 3) % 4)}
							/>
						</div>
					</div>
				{/if}

				<!-- Top Opponent (index 2) -->
				{#if topPlayer}
					<div class="flex flex-col items-center gap-2">
						<BotAvatar
							player={topPlayer}
							isMyTurn={currentGameState.turnIndex === topTurnIndex}
							isMarked={markerPlayerId === topPlayer.id}
							winCount={currentGameState.pointStandings[topPlayer.id] || 0}
							showScore={!isCoopMode}
						/>
						<div class="pointer-events-auto">
							<PlayerHand
								player={topPlayer}
								isMyTurn={currentGameState.turnIndex === topTurnIndex}
								isMarked={markerPlayerId === topPlayer.id}
								winCount={currentGameState.pointStandings[topPlayer.id] || 0}
								playableTileIds={new Set(
									generateLegalMoves(currentGameState, topPlayer.id).map((m) => m.tileId)
								)}
								activeTileId={activeTile?.id ?? null}
								selectedTileId={selectedTile?.id ?? null}
								ondragstart={handleSampleDisabled}
								ontileclick={handleSampleDisabled}
								showCardFaces={getShowCardFaces((myPlayerIndex + 2) % 4)}
							/>
						</div>
					</div>
				{/if}

				<!-- Right Opponent (index 1) -->
				{#if rightPlayer}
					<div class="flex flex-col items-center gap-2">
						<BotAvatar
							player={rightPlayer}
							isMyTurn={currentGameState.turnIndex === rightTurnIndex}
							isMarked={markerPlayerId === rightPlayer.id}
							winCount={currentGameState.pointStandings[rightPlayer.id] || 0}
							showScore={!isCoopMode}
						/>
						<div class="pointer-events-auto">
							<PlayerHand
								player={rightPlayer}
								isMyTurn={currentGameState.turnIndex === rightTurnIndex}
								isMarked={markerPlayerId === rightPlayer.id}
								winCount={currentGameState.pointStandings[rightPlayer.id] || 0}
								playableTileIds={new Set(
									generateLegalMoves(currentGameState, rightPlayer.id).map((m) => m.tileId)
								)}
								activeTileId={activeTile?.id ?? null}
								selectedTileId={selectedTile?.id ?? null}
								ondragstart={handleSampleDisabled}
								ontileclick={handleSampleDisabled}
								showCardFaces={getShowCardFaces((myPlayerIndex + 1) % 4)}
							/>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- ── LAYER 4: Board Area (flex-1 = fills remaining space) ── -->
	<div class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
		<div
			class="flex h-full w-full items-center justify-center overflow-hidden"
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

	<!-- ── LAYER 5: Round Actions (between board and main hand) ── -->
	{#if currentGameState?.result}
		<div class="shrink-0 border-t border-stone-800 px-4 py-3">
			<div class="flex justify-center gap-3">
				<button
					class="rounded border-[1.5px] border-primary bg-transparent px-5 py-2.5 font-body text-sm font-semibold text-primary transition hover:bg-warm-hover active:scale-[0.98]"
					onclick={onExit}
				>
					Ke Lobi
				</button>
				{#if !isMatchOver}
					<button
						class="rounded bg-primary px-5 py-2.5 font-body text-sm font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active active:scale-[0.98]"
						onclick={nextRound}
					>
						Lanjut Ronde {mpCurrentRound + 1} ➔
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ── LAYER 6: Main Player Hand ──────────────────────────── -->
	<div
		bind:clientHeight={mainHandHeight}
		class="shrink-0 border-t border-stone-800 pb-2 pt-1 md:pb-4"
	>
		{#if currentGameState}
			{@const mainPlayer = p(0)}
			{#if mainPlayer}
				<MainPlayerHand
					player={mainPlayer}
					isMyTurn={currentGameState.turnIndex === myPlayerIndex}
					isMain={true}
					isMarked={markerPlayerId === mainPlayer.id}
					winCount={currentGameState.pointStandings[mainPlayer.id] || 0}
					playableTileIds={new Set(
						generateLegalMoves(currentGameState, mainPlayer.id).map((m) => m.tileId)
					)}
					activeTileId={activeTile?.id ?? null}
					selectedTileId={selectedTile?.id ?? null}
					ondragstart={handleTileDragStart}
					ontileclick={handleTileClick}
					{game}
					{currentGameState}
				/>
			{/if}
		{/if}
	</div>
</div>
