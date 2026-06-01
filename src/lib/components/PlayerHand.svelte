<script lang="ts">
	import type { Domino } from '../../engine/types';
	import DominoTile from './DominoTile.svelte';
	import type { TileSize } from './DominoTile.svelte';

	import { fade } from 'svelte/transition';

	interface Props {
		player: { id: string; name: string; hand: Domino[] };
		isMyTurn: boolean;
		isMain?: boolean;
		isMarked: boolean;
		winCount: number;
		playableTileIds: Set<string>;
		activeTileId: string | null;
		selectedTileId: string | null;
		showCardFaces?: boolean;
		tileSize?: TileSize;
		ondragstart: (tile: Domino, e: MouseEvent) => void;
		ontileclick: (tile: Domino, e: MouseEvent) => void;
		/** Timestamp of when this player passed, for animation. 0 = no pass. */
		passTimestamp?: number;
		/** Turn countdown remaining seconds. 0 = not this player's turn. */
		turnCountdown?: number;
	}

	let {
		player,
		isMyTurn,
		isMain = false,
		isMarked,
		winCount,
		playableTileIds,
		activeTileId,
		selectedTileId,
		showCardFaces = true,
		tileSize = 'sm',
		ondragstart,
		ontileclick,
		passTimestamp = 0,
		turnCountdown = 0
	}: Props = $props();

	const isHandVertical = true;

	// ── Click-to-reveal hidden cards ───────────────────────────────
	let revealed = $state(false);
	let revealTimer: ReturnType<typeof setTimeout> | null = null;
	const REVEAL_DURATION_MS = 4000;

	const effectiveShowFaces = $derived(showCardFaces || revealed);

	function handleContainerClick(e: Event) {
		// Only handle if cards are currently hidden and not the main player
		if (showCardFaces || isMain) return;
		e.stopPropagation();

		// Clear any existing timer
		if (revealTimer) clearTimeout(revealTimer);

		revealed = true;
		revealTimer = setTimeout(() => {
			revealed = false;
			revealTimer = null;
		}, REVEAL_DURATION_MS);
	}

	// Cleanup on destroy
	import { onDestroy } from 'svelte';
	onDestroy(() => {
		if (revealTimer) clearTimeout(revealTimer);
	});

	// ── Pass animation ─────────────────────────────────────────────
	const showPassAnimation = $derived(passTimestamp > 0);
</script>

<div
	class="relative flex flex-col items-center justify-center {isMain ? 'origin-bottom scale-[1.3]' : ''}"
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="transition-all duration-150 flex flex-wrap justify-center items-center gap-0.5 px-2"
		class:cursor-pointer={!showCardFaces && !isMain}
		class:opacity-75={!effectiveShowFaces}
		role="button"
		tabindex={!showCardFaces && !isMain ? 0 : -1}
		onclick={handleContainerClick}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleContainerClick(e); } }}
	>
		{#if effectiveShowFaces}
			{#each player.hand as tile (tile.id)}
				{@const isActive = activeTileId === tile.id}
				{@const isPlayable = playableTileIds.has(tile.id)}
				{@const tileDisabled = !isMyTurn || !isPlayable}
				<button
					disabled={tileDisabled}
					class="flex cursor-pointer transition-all duration-150 select-none
					{isHandVertical ? 'hover:-translate-y-2' : 'hover:-translate-x-2'}
					{isMyTurn && isPlayable ? 'opacity-100' : 'opacity-40'}
					{isActive ? 'scale-90 opacity-30' : ''}
					{isMyTurn && selectedTileId !== null && !isActive
						? 'rounded-lg ring-2 ring-primary/20'
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
					<DominoTile {tile} isVertical={isHandVertical} size={tileSize} />
				</button>
			{/each}
		{:else}
			<div class="relative flex items-center gap-px flex-wrap justify-center">
				{#each { length: player.hand.length } as _, i}
					<div
						class="flex overflow-hidden rounded border border-stone-600 bg-stone-800 w-[20px] h-[40px]"
					>
						<div class="flex h-full w-full items-center justify-center">
							<div class=" size-[7px] rounded-full border-stone-600/50 bg-primary"></div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pass animation: below the hand for opponents -->
	{#if showPassAnimation && !isMain}
		<div
			transition:fade={{ duration: 400 }}
			class="mt-1 animate-bounce rounded-full bg-amber-500/20 px-3 py-0.5 font-body text-xs font-bold text-amber-400"
		>
			PASS
		</div>
	{/if}

	<!-- Turn countdown timer (only shown when it's this player's turn) -->
	{#if turnCountdown > 0 && !isMain}
		<div class="mt-1 flex items-center justify-center gap-1">
			<div
				class="flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-xs font-bold
				{turnCountdown <= 10
					? 'border-red-500/40 bg-red-500/15 text-red-400'
					: 'border-amber-500/30 bg-amber-500/10 text-amber-400'}"
			>
				<span class="text-[10px]">⏱</span>
				<span>{turnCountdown}s</span>
			</div>
		</div>
	{/if}

	{#if isMain}
		<div class="hidden w-full origin-bottom scale-[0.8] bg-red-300">
			<div class="relative flex w-fit items-center gap-2">
				{#if !isMarked}
					<span
						class="flex size-5 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950 shadow-md"
						>D</span
					>
				{/if}
				<div class="flex items-center gap-1.5">
					<span
						class="flex size-6 min-w-[24px] items-center justify-center rounded-full bg-black/75 px-2 text-xs font-black text-yellow-400 ring-1 ring-yellow-400/40"
					>
						{winCount}
					</span>
				</div>
			</div>
		</div>
	{/if}
</div>
