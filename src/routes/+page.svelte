<script lang="ts">
	import GameArea from '$lib/components/GameArea.svelte';

	// Tipe data untuk Navigasi & Pengaturan Game
	type ViewState = 'lobby' | 'setup-mode' | 'setup-rounds' | 'playing' | 'rules' | 'leaderboard';
	type GameMode = 'vs-ai' | 'coop-vs-ai' | 'coop-vs-coop' | null;
	type Rounds = 3 | 5 | 7 | 'custom' | null;

	let currentView = $state<ViewState>('lobby');

	// State untuk menyimpan pilihan pemain di Wizard
	let selectedMode = $state<GameMode>(null);
	let selectedRounds = $state<Rounds>(null);

	// Fungsi Navigasi
	function goToSetup() {
		currentView = 'setup-mode';
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
	}
</script>

<div
	class="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-neutral-900 text-white selection:bg-green-500/30"
>
	{#if currentView === 'lobby'}
		<div class="z-10 flex flex-col items-center gap-8">
			<div class="text-center">
				<h1
					class="bg-gradient-to-br from-green-400 to-amber-500 bg-clip-text text-6xl font-black tracking-tighter text-transparent drop-shadow-lg md:text-8xl"
				>
					DOMINDO
				</h1>
				<p class="mt-2 text-sm font-semibold tracking-widest text-neutral-400 uppercase">
					Gaple Digital Nusantara
				</p>
			</div>

			<div class="flex w-64 flex-col gap-4">
				<button
					onclick={goToSetup}
					class="rounded-2xl bg-green-500 px-6 py-4 text-lg font-bold text-green-950 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition hover:scale-105 hover:bg-green-400 active:scale-95"
				>
					New Game
				</button>
				<button
					onclick={() => (currentView = 'leaderboard')}
					class="rounded-2xl border border-neutral-700 bg-neutral-800 px-6 py-4 text-lg font-bold text-white transition hover:bg-neutral-700 active:scale-95"
				>
					Leaderboard
				</button>
				<button
					onclick={() => (currentView = 'rules')}
					class="rounded-2xl border border-neutral-700 bg-neutral-800 px-6 py-4 text-lg font-bold text-white transition hover:bg-neutral-700 active:scale-95"
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
					class="absolute top-1/2 left-0 -translate-y-1/2 p-2 text-neutral-400 transition hover:text-white"
				>
					← Back
				</button>
				<h2 class="text-3xl font-bold text-white">Select Mode</h2>
			</div>

			<div class="mt-4 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
				<button
					onclick={() => selectMode('vs-ai')}
					class="flex flex-col items-center gap-3 rounded-2xl border-2 border-transparent bg-neutral-800 p-6 text-left transition hover:border-green-500 hover:bg-neutral-700 active:scale-95"
				>
					<div class="text-4xl">🤖</div>
					<h3 class="text-lg font-bold">VS AIs</h3>
					<p class="text-center text-xs text-neutral-400">
						1 Player melawan 3 AI secara individual.
					</p>
				</button>
				<button
					onclick={() => selectMode('coop-vs-ai')}
					class="flex flex-col items-center gap-3 rounded-2xl border-2 border-transparent bg-neutral-800 p-6 text-left transition hover:border-green-500 hover:bg-neutral-700 active:scale-95"
				>
					<div class="text-4xl">🤝</div>
					<h3 class="text-lg font-bold">Coop vs AIs</h3>
					<p class="text-center text-xs text-neutral-400">
						2 Player bergabung melawan 2 AI cerdas.
					</p>
				</button>
				<button
					onclick={() => selectMode('coop-vs-coop')}
					class="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border-2 border-transparent bg-neutral-800 p-6 text-left transition hover:border-amber-500 hover:bg-neutral-700 active:scale-95"
				>
					<div class="text-4xl">🔥</div>
					<h3 class="text-lg font-bold">Coop vs Coop</h3>
					<p class="text-center text-xs text-neutral-400">4 Player bertarung dalam 2 tim.</p>
					<div
						class="absolute top-2 right-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-amber-950"
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
					class="absolute top-1/2 left-0 -translate-y-1/2 p-2 text-neutral-400 transition hover:text-white"
				>
					← Back
				</button>
				<h2 class="text-3xl font-bold text-white">How Many Rounds?</h2>
			</div>

			<div class="mt-4 grid w-full grid-cols-2 gap-4 md:grid-cols-4">
				{#each [3, 5, 7, 'custom'] as round, i (i)}
					<button
						onclick={() => selectRounds(round as Rounds)}
						class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-800 p-6 text-xl font-bold transition hover:border-green-500 hover:bg-green-500 hover:text-green-950 active:scale-95"
					>
						{round}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if currentView === 'playing'}
		<GameArea mode={selectedMode} rounds={selectedRounds} onExit={backToLobby} />
	{/if}

	{#if currentView === 'rules' || currentView === 'leaderboard'}
		<div class="z-10 flex flex-col items-center">
			<h2 class="mb-4 text-3xl font-bold uppercase">{currentView}</h2>
			<p class="mb-8 text-neutral-400">Fitur ini sedang dalam perancangan...</p>
			<button
				onclick={backToLobby}
				class="rounded-xl bg-neutral-800 px-6 py-3 text-sm font-bold transition hover:bg-neutral-700"
				>Kembali ke Lobi</button
			>
		</div>
	{/if}

	{#if currentView !== 'playing'}
		<div class="pointer-events-none absolute inset-0 z-0 opacity-20">
			<div
				class="absolute -top-[20%] -left-[10%] h-[50vw] w-[50vw] rounded-full bg-green-500 blur-[120px]"
			></div>
			<div
				class="absolute -right-[10%] -bottom-[20%] h-[50vw] w-[50vw] rounded-full bg-amber-500 blur-[120px]"
			></div>
		</div>
	{/if}
</div>
