<script lang="ts" module>
	function handleSampleDisabled() {}
</script>

<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';
	import { calculateBoardLayout, calculateBoardPreviewPosition } from '../../engine/boardLayout';
	import { orientTileForSide } from '../../engine/board';
	import { generateLegalMoves } from '../../engine/moves';
	import type { Domino, TilePosition } from '../../engine/types';

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

	const TILE_W = 112;
	const TILE_H = 56;
	const GAP = 0;

	// Inisialisasi Game Manager
	const game = new SvelteGameManager(['Pemain Bawah', 'AI Kanan', 'AI Tengah', 'AI Kiri']);

	let showResultDialog = $state(true);
	let starterPlayerId = $state<string | null>(null);

	// STATE UNTUK RONDE
	let currentRound = $state(1);

	function syncStarterMarker() {
		starterPlayerId = game.state.players[game.state.turnIndex]?.id ?? null;
	}

	game.startGame();
	syncStarterMarker();
	game.setBotPlayers(['1', '2', '3']);

	// FUNGSI LANJUT RONDE
	function nextRound() {
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
	const showDropZones = $derived(activeTile !== null && game.state.turnIndex === 0);
	const leftPreview = $derived.by(() => getPlacementPreview('left'));
	const rightPreview = $derived.by(() => getPlacementPreview('right'));

	const winner = $derived.by(() => {
		if (!game.state.result) return null;
		return game.state.players.find((p) => p.id === game.state.result?.winnerId) ?? null;
	});

	const markerPlayerId = $derived.by(() => {
		if (game.state.result && winner) return winner.id;
		return starterPlayerId;
	});

	// Mengecek apakah pertandingan (seluruh ronde) sudah selesai
	const isMatchOver = $derived(
		game.state.result && rounds !== 'custom' && currentRound >= (rounds as number)
	);

	// Mengurutkan klasemen skor untuk akhir pertandingan
	const finalStandings = $derived.by(() => {
		if (!game.state.result) return [];
		const standings = game.state.players.map((p) => ({
			name: p.name,
			points: game.state.pointStandings[p.id] || 0
		}));
		return standings.sort((a, b) => b.points - a.points); // Urutkan dari poin tertinggi
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

		if (game.state.board.playedTiles.length === 0) {
			if (side === 'left') return null;
			return { ...activeTile, x: 0, y: 0, rotation: 90 };
		}

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
		if (game.state.result) return;
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
		class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80 drop-shadow-2xl"
		style="left:{mouseX}px; top:{mouseY}px;"
	>
		<DominoTile tile={draggedTile} isVertical={false} />
	</div>
{/if}

<div
	role="presentation"
	class="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-neutral-900 text-white select-none"
	onclick={() => (selectedTile = null)}
>
	<div
		class="absolute top-2 left-2 z-20 flex flex-col items-start gap-2 text-sm md:top-6 md:left-6"
	>
		<div
			class="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur-sm"
		>
			<span class="text-neutral-400">Mode:</span>
			<span class="font-bold text-white uppercase">{mode?.replace(/-/g, ' ')}</span>
			<span class="text-neutral-600">|</span>
			<span class="text-neutral-400">Ronde</span>
			<span class="font-black text-green-400"
				>{currentRound} / {rounds === 'custom' ? '∞' : rounds}</span
			>
		</div>

		{#if selectedTile && !game.state.result}
			<p class="rounded bg-green-800/60 px-3 py-1 text-xs text-green-300 shadow-md">
				Kartu dipilih — klik ← / → untuk menempatkan
			</p>
		{/if}
	</div>

	{#if game.state.result && winner}
		<div
			class="pointer-events-none absolute top-36 left-1/2 z-20 w-full -translate-x-1/2 px-4 text-center md:top-40"
		>
			<h2
				class="text-3xl font-black tracking-wide drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] md:text-5xl
				{winner.id === game.state.players[0].id ? 'text-yellow-400' : 'text-red-500'}"
			>
				{#if winner.id === game.state.players[0].id}
					🎉 Anda Menang Ronde Ini!
				{:else}
					{winner.name} Menang!
				{/if}
			</h2>
			<p class="mt-2 text-lg font-bold text-white drop-shadow-md md:text-xl">
				{game.state.result.winType}
				<span class="text-green-400">(+{game.state.result.points} Poin)</span>
			</p>
		</div>
	{/if}

	{#if game.state.result && !showResultDialog}
		<div class="absolute top-2 right-2 z-20 flex gap-2 md:top-6 md:right-6">
			<button
				class="rounded-xl bg-neutral-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 active:scale-95"
				onclick={onExit}
			>
				Ke Lobi
			</button>
			{#if !isMatchOver}
				<button
					class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-green-950 shadow-lg transition hover:bg-green-400 active:scale-95"
					onclick={nextRound}
				>
					Lanjut Ronde
				</button>
			{/if}
		</div>
	{/if}

	<div class="absolute inset-0 z-0 flex items-center justify-center">
		<div
			class="relative flex h-full w-full items-center justify-center overflow-hidden bg-green-950/30 shadow-inner ring-2 ring-green-900"
			bind:clientWidth={boardWidth}
			bind:clientHeight={boardHeight}
		>
			{#if game.state.board.playedTiles.length === 0 && !showDropZones}
				<p class="px-4 text-center text-sm font-bold text-neutral-500 md:text-lg">
					Meja kosong. Pemain pertama mulai.
				</p>
			{/if}

			<div
				class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out {game
					.state.board.playedTiles.length === 0 && !showDropZones
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
			<BotAvatar
				player={game.state.players[3]}
				isMyTurn={game.state.turnIndex === 3}
				isMarked={markerPlayerId === game.state.players[3].id}
				winCount={game.state.pointStandings[game.state.players[3].id] || 0}
			/>
			<div class="pointer-events-auto">
				<PlayerHand
					player={game.state.players[3]}
					isMyTurn={game.state.turnIndex === 3}
					isMarked={markerPlayerId === game.state.players[3].id}
					winCount={game.state.pointStandings[game.state.players[3].id] || 0}
					playableTileIds={new Set(
						generateLegalMoves(game.state, game.state.players[3].id).map((m) => m.tileId)
					)}
					activeTileId={activeTile?.id ?? null}
					selectedTileId={selectedTile?.id ?? null}
					ondragstart={handleSampleDisabled}
					ontileclick={handleSampleDisabled}
				/>
			</div>
		</div>
	</div>

	<div class="pointer-events-none absolute top-8 left-1/2 z-10 -translate-x-1/2">
		<div
			class="flex origin-top scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			<BotAvatar
				player={game.state.players[2]}
				isMyTurn={game.state.turnIndex === 2}
				isMarked={markerPlayerId === game.state.players[2].id}
				winCount={game.state.pointStandings[game.state.players[2].id] || 0}
			/>
			<div class="pointer-events-auto">
				<PlayerHand
					player={game.state.players[2]}
					isMyTurn={game.state.turnIndex === 2}
					isMarked={markerPlayerId === game.state.players[2].id}
					winCount={game.state.pointStandings[game.state.players[2].id] || 0}
					playableTileIds={new Set(
						generateLegalMoves(game.state, game.state.players[2].id).map((m) => m.tileId)
					)}
					activeTileId={activeTile?.id ?? null}
					selectedTileId={selectedTile?.id ?? null}
					ondragstart={handleSampleDisabled}
					ontileclick={handleSampleDisabled}
				/>
			</div>
		</div>
	</div>

	<div
		class="pointer-events-none absolute top-16 right-2 z-10 sm:top-20 sm:right-4 md:top-8 md:right-12"
	>
		<div
			class="flex origin-top-right scale-[0.40] flex-col items-center gap-2 transition-transform duration-300 md:scale-none"
		>
			<BotAvatar
				player={game.state.players[1]}
				isMyTurn={game.state.turnIndex === 1}
				isMarked={markerPlayerId === game.state.players[1].id}
				winCount={game.state.pointStandings[game.state.players[1].id] || 0}
			/>
			<div class="pointer-events-auto">
				<PlayerHand
					player={game.state.players[1]}
					isMyTurn={game.state.turnIndex === 1}
					isMarked={markerPlayerId === game.state.players[1].id}
					winCount={game.state.pointStandings[game.state.players[1].id] || 0}
					playableTileIds={new Set(
						generateLegalMoves(game.state, game.state.players[1].id).map((m) => m.tileId)
					)}
					activeTileId={activeTile?.id ?? null}
					selectedTileId={selectedTile?.id ?? null}
					ondragstart={handleSampleDisabled}
					ontileclick={handleSampleDisabled}
				/>
			</div>
		</div>
	</div>

	<div
		bind:clientHeight={mainHandHeight}
		class="absolute bottom-2 left-1/2 z-10 w-full -translate-x-1/2 px-8 md:w-fit"
	>
		<MainPlayerHand
			player={game.state.players[0]}
			isMyTurn={game.state.turnIndex === 0}
			isMain={true}
			isMarked={markerPlayerId === game.state.players[0].id}
			winCount={game.state.pointStandings[game.state.players[0].id] || 0}
			playableTileIds={new Set(
				generateLegalMoves(game.state, game.state.players[0].id).map((m) => m.tileId)
			)}
			activeTileId={activeTile?.id ?? null}
			selectedTileId={selectedTile?.id ?? null}
			ondragstart={handleTileDragStart}
			ontileclick={handleTileClick}
			{game}
		/>
	</div>
</div>

{#if game.state.result && winner && showResultDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
		<div
			class="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-8 shadow-2xl ring-1 ring-white/10"
		>
			{#if isMatchOver}
				<p class="text-center text-sm font-bold tracking-[0.25em] text-green-400 uppercase">
					Match Completed
				</p>
				<h2 class="mt-2 text-center text-3xl font-black text-white">
					🏆 {finalStandings[0].name} Juara!
				</h2>

				<div class="mt-6 flex flex-col gap-2">
					<p class="mb-1 text-xs font-semibold tracking-widest text-neutral-400 uppercase">
						Klasemen Akhir
					</p>
					{#each finalStandings as rank, index (index)}
						<div
							class="flex items-center justify-between rounded-xl border border-white/5 bg-neutral-800/80 px-4 py-3"
						>
							<div class="flex items-center gap-3">
								<span class="w-4 text-lg font-bold text-neutral-500">{index + 1}</span>
								<span
									class="font-bold text-white {rank.name === 'Pemain Bawah'
										? 'text-yellow-400'
										: ''}">{rank.name}</span
								>
							</div>
							<span class="text-lg font-black text-green-400"
								>{rank.points} <span class="text-xs font-normal text-green-600">pts</span></span
							>
						</div>
					{/each}
				</div>

				<div class="mt-8 flex justify-center">
					<button
						class="w-full rounded-xl bg-amber-500 px-6 py-4 text-base font-black text-amber-950 shadow-xl transition hover:bg-amber-400 active:scale-95"
						onclick={onExit}
					>
						KEMBALI KE LOBI
					</button>
				</div>
			{:else}
				<div class="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
					<p class="text-sm font-bold tracking-[0.2em] text-neutral-400 uppercase">
						Ronde {currentRound} Berakhir
					</p>
					<button
						class="text-neutral-500 transition hover:text-white"
						onclick={() => (showResultDialog = false)}>✕</button
					>
				</div>

				<div class="my-8 text-center">
					<h2 class="mb-2 text-3xl font-black text-white">{winner.name} Menang!</h2>
					<div class="inline-block rounded-xl border border-green-500/30 bg-green-900/40 px-6 py-3">
						<p class="mb-1 text-sm font-semibold tracking-wide text-green-400 uppercase">
							Mendapatkan
						</p>
						<p class="text-4xl font-black text-green-400">
							+{game.state.result.points} <span class="text-lg">Poin</span>
						</p>
					</div>
					<p
						class="mt-4 inline-block rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300"
					>
						Tipe Kemenangan: <span class="font-bold text-white">{game.state.result.winType}</span>
					</p>
				</div>

				<div class="mt-6 flex justify-end gap-3">
					<button
						class="w-full rounded-xl bg-green-500 px-6 py-3 text-sm font-black text-green-950 shadow-xl transition hover:bg-green-400 active:scale-95"
						onclick={nextRound}
					>
						LANJUT RONDE {currentRound + 1} ➔
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
