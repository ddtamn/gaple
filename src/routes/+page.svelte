<script lang="ts">
	import GameArea from '$lib/components/GameArea.svelte';
	import LobbyRoom from '$lib/components/LobbyRoom.svelte';
	import { getMultiplayer } from '$lib/multiplayer/room.svelte';

	// Tipe data untuk Navigasi & Pengaturan Game
	type ViewState = 'lobby' | 'setup-mode' | 'setup-rounds' | 'playing' | 'multiplayer-room' | 'multiplayer-game' | 'rules' | 'leaderboard';
	type GameMode = 'vs-ai' | 'coop-vs-ai' | 'coop-vs-coop' | 'multiplayer' | null;
	type Rounds = 3 | 5 | 7 | 'custom' | null;

	let currentView = $state<ViewState>('lobby');

	// State untuk menyimpan pilihan pemain di Wizard
	let selectedMode = $state<GameMode>(null);
	let selectedRounds = $state<Rounds>(null);

	// Multiplayer singleton
	const mp = getMultiplayer();

	// Fungsi Navigasi
	function goToSetup() {
		currentView = 'setup-mode';
	}

	function goToMultiplayer() {
		selectedMode = 'multiplayer';
		currentView = 'multiplayer-room';
	}

	function selectMode(mode: GameMode) {
		selectedMode = mode;
		currentView = 'setup-rounds';
	}

	function selectRounds(rounds: Rounds) {
		selectedRounds = rounds;
		// Semua pengaturan selesai, mulai game!
		currentView = 'playing';
	}

	function backToLobby() {
		currentView = 'lobby';
		selectedMode = null;
		selectedRounds = null;
		mp.disconnect();
	}
</script>

<div
	class="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-background text-stone-100 selection:bg-primary/20"
>
	{#if currentView === 'lobby'}
		<div class="z-10 flex flex-col items-center gap-8">
			<div class="text-center">
				<h1
					class="bg-gradient-to-br from-primary to-secondary bg-clip-text font-headline text-6xl font-black tracking-tighter text-transparent md:text-8xl"
				>
					DOMINDO
				</h1>
				<p class="mt-2 font-body text-sm font-semibold tracking-widest text-stone-400 uppercase">
					Gaple Digital Nusantara
				</p>
			</div>

			<div class="flex w-64 flex-col gap-4">
				<button
					onclick={goToSetup}
					class="rounded bg-primary px-8 py-3.5 font-body text-base font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active active:scale-[0.98]"
				>
					New Game
				</button>
				<button
					onclick={goToMultiplayer}
					class="rounded bg-secondary px-8 py-3.5 font-body text-base font-semibold text-white transition hover:bg-secondary/80 active:scale-[0.98]"
				>
					🛜 Multiplayer
				</button>
				<button
					onclick={() => (currentView = 'leaderboard')}
					class="rounded border-[1.5px] border-primary bg-transparent px-8 py-3.5 font-body text-base font-semibold text-primary transition hover:bg-warm-hover active:scale-[0.98]"
				>
					Leaderboard
				</button>
				<button
					onclick={() => (currentView = 'rules')}
					class="rounded border-[1.5px] border-primary bg-transparent px-8 py-3.5 font-body text-base font-semibold text-primary transition hover:bg-warm-hover active:scale-[0.98]"
				>
					Game Rules
				</button>
			</div>
		</div>
	{/if}

	{#if currentView === 'setup-mode'}
		<div class="z-10 flex w-full max-w-2xl flex-col items-center gap-6 px-4">
			<div class="relative w-full text-center">
				<button
					onclick={backToLobby}
					class="absolute top-1/2 left-0 -translate-y-1/2 p-2 text-stone-500 transition hover:text-stone-100"
				>
					← Back
				</button>
				<h2 class="font-headline text-3xl font-semibold text-stone-100">Select Mode</h2>
			</div>

			<div class="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
				<button
					onclick={() => selectMode('vs-ai')}
					class="flex flex-col items-center gap-3 rounded-lg border border-stone-700 bg-surface p-6 text-left transition hover:border-stone-600 hover:bg-warm-hover active:scale-[0.98]"
				>
					<div class="text-4xl">🤖</div>
					<h3 class="font-body text-lg font-semibold text-stone-100">VS AIs</h3>
					<p class="text-center font-body text-xs text-stone-400">
						1 Player melawan 3 AI secara individual.
					</p>
				</button>
				<button
					onclick={() => selectMode('coop-vs-ai')}
					class="flex flex-col items-center gap-3 rounded-lg border border-stone-700 bg-surface p-6 text-left transition hover:border-stone-600 hover:bg-warm-hover active:scale-[0.98]"
				>
					<div class="text-4xl">🤝</div>
					<h3 class="font-body text-lg font-semibold text-stone-100">Coop vs AIs</h3>
					<p class="text-center font-body text-xs text-stone-400">
						2 Player bergabung melawan 2 AI cerdas.
					</p>
				</button>
				<button
					onclick={() => selectMode('coop-vs-coop')}
					class="relative flex flex-col items-center gap-3 overflow-hidden rounded-lg border border-stone-700 bg-surface p-6 text-left transition hover:border-secondary hover:bg-warm-hover active:scale-[0.98]"
				>
					<div class="text-4xl">🔥</div>
					<h3 class="font-body text-lg font-semibold text-stone-100">Coop vs Coop</h3>
					<p class="text-center font-body text-xs text-stone-400">4 Player bertarung dalam 2 tim.</p>
					<div
						class="absolute top-2 right-2 rounded bg-secondary px-2 py-0.5 font-body text-[10px] font-bold text-white"
					>
						PRO
					</div>
				</button>
			</div>
		</div>
	{/if}

	{#if currentView === 'setup-rounds'}
		<div class="z-10 flex w-full max-w-xl flex-col items-center gap-6 px-4">
			<div class="relative w-full text-center">
				<button
					onclick={() => (currentView = 'setup-mode')}
					class="absolute top-1/2 left-0 -translate-y-1/2 p-2 text-stone-500 transition hover:text-stone-100"
				>
					← Back
				</button>
				<h2 class="font-headline text-3xl font-semibold text-stone-100">How Many Rounds?</h2>
			</div>

			<div class="mt-4 grid w-full grid-cols-2 gap-4 md:grid-cols-4">
				{#each [3, 5, 7, 'custom'] as round, i (i)}
					<button
						onclick={() => selectRounds(round as Rounds)}
						class="flex flex-col items-center justify-center gap-2 rounded-lg border border-stone-700 bg-surface p-6 font-headline text-xl font-semibold text-stone-100 transition hover:border-primary hover:bg-primary hover:text-white active:scale-[0.98]"
					>
						{round}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if currentView === 'multiplayer-room'}
		<LobbyRoom
			onBack={backToLobby}
			onGameStart={() => (currentView = 'multiplayer-game')}
		/>
	{/if}

	{#if currentView === 'multiplayer-game'}
		<GameArea mode="multiplayer" rounds={3} onExit={backToLobby} />
	{/if}

	{#if currentView === 'playing' && selectedMode !== null && selectedRounds !== null}
		<GameArea mode={selectedMode} rounds={selectedRounds} onExit={backToLobby} />
	{/if}

	{#if currentView === 'rules' || currentView === 'leaderboard'}
		<div class="z-10 flex flex-col items-center">
			<h2 class="mb-4 font-headline text-3xl font-semibold uppercase text-stone-100">{currentView}</h2>
			<p class="mb-8 font-body text-stone-400">Fitur ini sedang dalam perancangan...</p>
			<button
				onclick={backToLobby}					class="rounded border-[1.5px] border-primary bg-transparent px-6 py-3 font-body text-sm font-semibold text-primary transition hover:bg-warm-hover"
				>Kembali ke Lobi</button
			>
		</div>
	{/if}

	{#if currentView !== 'playing'}
		<div class="pointer-events-none absolute inset-0 z-0 opacity-20">
			<div
				class="absolute -top-[20%] -left-[10%] h-[50vw] w-[50vw] rounded-full bg-primary blur-[120px]"
			></div>
			<div
				class="absolute -right-[10%] -bottom-[20%] h-[50vw] w-[50vw] rounded-full bg-secondary blur-[120px]"
			></div>
		</div>
	{/if}
</div>
