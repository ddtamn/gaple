<script lang="ts">
	import { getMultiplayer } from '$lib/multiplayer/room.svelte';

	let {
		viewType,
		mode,
		rounds = 3,
		onBack,
		onGameStart
	}: {
		viewType: 'create' | 'join';
		mode: string;
		rounds: number;
		onBack: () => void;
		onGameStart: () => void;
	} = $props();

	const mp = getMultiplayer();

	const seatLabels = ['Bawah', 'Kanan', 'Atas', 'Kiri'];

	let playerName = $state('');
	let roomCode = $state('');
	let joinCodeInput = $state('');
	let roomCreated = $state(false);

	// Determine the PartyKit host
	function resolvePartyKitHost(): string {
		if (typeof window === 'undefined') return 'localhost:1999';
		const hostname = window.location.hostname;
		if (hostname.endsWith('.app.github.dev')) {
			const base = hostname.replace(/-?\d+\.app\.github\.dev$/, '');
			return `${base}-1999.app.github.dev`;
		}
		if (hostname === 'localhost' || hostname === '127.0.0.1') return 'localhost:1999';
		return `${hostname}:1999`;
	}

	const host = $derived(resolvePartyKitHost());

	const isCreate = $derived(viewType === 'create');

	const modeLabel = $derived.by(() => {
		if (mode === 'coop-vs-ai') return 'Coop vs AIs';
		if (mode === 'coop-vs-coop') return 'Coop vs Coop';
		return 'Multiplayer';
	});

	const myPlayer = $derived(mp.players.find((p) => p.id === mp.myPlayerId) ?? null);

	const humanPlayers = $derived(mp.players.filter((p) => !p.isBot && p.connected));
	const botPlayers = $derived(mp.players.filter((p) => p.isBot));

	// Watch for game start from server
	$effect(() => {
		if (mp.gameState && mp.gameState.players.length === 4) {
			onGameStart();
		}
	});

	function createRoom() {
		const name = playerName.trim() || 'Player';
		const code = roomCode.trim() || generateRoomCode();
		mp.connect(host, code, name, mode, rounds);
		roomCreated = true;
	}

	function joinRoom() {
		const name = playerName.trim() || 'Player';
		const code = joinCodeInput.trim().toUpperCase();
		if (code.length < 4) return;
		mp.connect(host, code, name);
		roomCreated = true;
	}

	function leaveRoom() {
		mp.disconnect();
		roomCreated = false;
	}

	function generateRoomCode(): string {
		const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
		let code = '';
		for (let i = 0; i < 4; i++) {
			code += chars[Math.floor(Math.random() * chars.length)];
		}
		return code;
	}

	function copyRoomCode() {
		if (mp.roomId) {
			navigator.clipboard.writeText(mp.roomId);
		}
	}
</script>

{#if !roomCreated}
	<!-- Create / Join Room -->
	<div class="z-10 flex w-full max-w-md flex-col items-center gap-6 px-4">
		<div class="relative w-full text-center">
			<button
				onclick={onBack}
				class="absolute top-1/2 left-0 -translate-y-1/2 p-2 text-stone-500 transition hover:text-stone-100"
			>
				← Back
			</button>
			<h2 class="font-headline text-3xl font-semibold text-stone-100">
				{isCreate ? modeLabel : 'Join Room'}
			</h2>
		</div>

		<div class="w-full space-y-4">
			<!-- Player Name -->
			<div>
				<label class="mb-1 block font-body text-xs font-semibold tracking-wide text-stone-500 uppercase">
					Your Name
				</label>
				<input
					bind:value={playerName}
					placeholder="Masukkan namamu..."
					class="w-full rounded-lg border border-stone-700 bg-surface px-4 py-3 font-body text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
				/>
			</div>

			{#if isCreate}
				<div>
					<label class="mb-1 block font-body text-xs font-semibold tracking-wide text-stone-500 uppercase">
						Room Code (optional)
					</label>
					<input
						bind:value={roomCode}
						placeholder="Kosongkan untuk random"
						class="w-full rounded-lg border border-stone-700 bg-surface px-4 py-3 font-body text-sm text-stone-100 outline-none uppercase transition placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
						maxlength={6}
					/>
				</div>

				{#if mode === 'coop-vs-ai'}
					<div class="rounded-lg border border-stone-700 bg-surface/50 p-4">
						<p class="font-body text-xs font-semibold tracking-wide text-stone-500 uppercase">Informasi Tim</p>
						<div class="mt-2 space-y-1 font-body text-xs text-stone-400">
							<p>• Kamu akan menjadi <span class="font-bold text-primary">Pemain Bawah</span> (index 0)</p>
							<p>• Temanmu akan menjadi <span class="font-bold text-secondary">Pemain Atas</span> (index 2)</p>
							<p>• Kartu antar anggota tim bisa saling lihat</p>
							<p>• Room siap jika ada teman yang bergabung</p>
						</div>
					</div>
				{:else if mode === 'coop-vs-coop'}
					<div class="rounded-lg border border-stone-700 bg-surface/50 p-4">
						<p class="font-body text-xs font-semibold tracking-wide text-stone-500 uppercase">Informasi Room</p>
						<div class="mt-2 space-y-1 font-body text-xs text-stone-400">
							<p>• Membutuhkan <span class="font-bold text-secondary">4 pemain</span> untuk mulai</p>
							<p>• Tim: [0,2] vs [1,3]</p>
							<p>• Kartu antar anggota tim bisa saling lihat</p>
						</div>
					</div>
				{/if}

				<button
					onclick={createRoom}
					class="w-full rounded-lg bg-primary px-6 py-3.5 font-body text-base font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98]"
				>
					Buat Room
				</button>
			{:else}
				<div>
					<label class="mb-1 block font-body text-xs font-semibold tracking-wide text-stone-500 uppercase">
						Room Code
					</label>
					<input
						bind:value={joinCodeInput}
						placeholder="Contoh: X7B9"
						class="w-full rounded-lg border border-stone-700 bg-surface px-4 py-3 font-body text-center text-2xl font-bold tracking-[0.3em] text-stone-100 outline-none uppercase transition placeholder:text-sm placeholder:tracking-normal placeholder:font-normal placeholder:text-stone-600 focus:border-primary focus:ring-1 focus:ring-primary"
						maxlength={6}
					/>
				</div>
				<button
					onclick={joinRoom}
					disabled={joinCodeInput.trim().length < 4}
					class="w-full rounded-lg bg-primary px-6 py-3.5 font-body text-base font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
				>
					Gabung
				</button>
			{/if}
		</div>
	</div>
{:else}
	<!-- Waiting Room -->
	<div class="z-10 flex w-full max-w-lg flex-col items-center gap-6 px-4">
		<div class="relative w-full text-center">
			<h2 class="font-headline text-3xl font-semibold text-stone-100">
				{mp.roomMode === 'coop-vs-ai' ? 'Coop vs AI' : mp.roomMode === 'coop-vs-coop' ? 'Coop vs Coop' : 'Room'} — Waiting
			</h2>
			<p class="mt-1 font-body text-sm text-stone-400">
				Kode Room:
				<button onclick={copyRoomCode} class="font-mono font-bold text-primary hover:text-primary-hover">
					{mp.roomId}
				</button>
			</p>
		</div>

		<!-- Connection status -->
		{#if mp.connectionState === 'connecting'}
			<div class="flex items-center gap-3 rounded-lg border border-stone-700 bg-surface px-6 py-3">
				<div class="size-3 animate-pulse rounded-full bg-amber-400"></div>
				<span class="font-body text-sm text-stone-400">Menghubungkan ke server...</span>
			</div>
		{/if}

		<!-- Player List -->
		<div class="w-full space-y-2">
			<p class="font-body text-xs font-semibold tracking-widest text-stone-500 uppercase">
				Pemain ({mp.players.filter((p) => p.connected).length}/4)
			</p>

			{#each mp.players as player, i (player.id)}
				<div
					class="flex items-center justify-between rounded-lg border px-4 py-3 {player.isBot
						? 'border-stone-700/50 bg-surface/50'
						: 'border-stone-700 bg-surface'}"
				>
					<div class="flex items-center gap-3">
						<span
							class="flex size-8 items-center justify-center rounded-full bg-stone-800 font-body text-sm font-bold {player.isBot
								? 'text-stone-600'
								: i === 0
									? 'bg-primary/20 text-primary'
									: 'text-stone-300'}"
						>
							{i + 1}
						</span>
						<div>
							<span class="font-body text-sm font-semibold {player.isBot ? 'text-stone-500' : 'text-stone-100'}">
								{player.name}
							</span>
							<span class="ml-1 font-body text-xs text-stone-600">({seatLabels[i]})</span>

							{#if player.id === mp.hostId}
								<span class="ml-2 rounded bg-secondary/20 px-1.5 py-0.5 font-body text-[10px] font-bold text-secondary">
									HOST
								</span>
							{/if}

							{#if mp.isCoopMode && (i === 0 || i === 2)}
								<span class="ml-1 rounded bg-emerald-500/20 px-1.5 py-0.5 font-body text-[10px] font-bold text-emerald-400">
									TIM A
								</span>
							{:else if mp.isCoopMode && (i === 1 || i === 3)}
								<span class="ml-1 rounded bg-red-500/20 px-1.5 py-0.5 font-body text-[10px] font-bold text-red-400">
									TIM B
								</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2">
						{#if player.isBot}
							<span class="rounded bg-stone-700/50 px-2 py-0.5 font-body text-xs font-medium text-stone-500">
								AI
							</span>
						{:else if player.ready}
							<span class="rounded bg-emerald-500/20 px-2 py-0.5 font-body text-xs font-medium text-emerald-400">
								Siap
							</span>
						{:else if player.id === mp.myPlayerId}
							<span class="rounded bg-stone-700 px-2 py-0.5 font-body text-xs font-medium text-stone-400">
								Belum
							</span>
						{/if}
					</div>
				</div>
			{/each}

			<!-- Empty slots (coop-vs-coop mode shows all empty slots) -->
			{#if mp.roomMode === 'coop-vs-coop'}
				{#each Array(Math.max(0, 4 - mp.players.length)) as _, i}
					<div class="flex items-center gap-3 rounded-lg border border-dashed border-stone-700/50 bg-surface/30 px-4 py-3">
						<span class="flex size-8 items-center justify-center rounded-full bg-stone-800/30 font-body text-sm font-bold text-stone-600">
							{mp.players.length + i + 1}
						</span>
						<span class="font-body text-sm italic text-stone-600">Menunggu pemain...</span>
					</div>
				{/each}
			{/if}
		</div>

		<!-- Action Buttons -->
		<div class="flex w-full flex-col gap-3">
			{#if mp.myPlayerId !== ''}
				<button
					onclick={mp.toggleReady}
					class="w-full rounded-lg border px-6 py-3 font-body text-sm font-semibold transition active:scale-[0.98] {mp.isReady
						? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
						: 'border-primary bg-primary text-white hover:bg-primary-hover'}"
				>
					{mp.isReady ? '✅ Siap!' : 'Siap'}
				</button>
			{/if}

			{#if mp.isHost}
				<button
					onclick={mp.startGame}
					disabled={!mp.allReady}
					class="w-full rounded-lg bg-secondary px-6 py-3 font-body text-base font-semibold text-white transition hover:bg-secondary/80 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
				>
					Mulai Game
				</button>
				<p class="text-center font-body text-xs text-stone-500">
					{mp.roomMode === 'coop-vs-coop' && mp.players.length < 4
						? 'Tunggu semua pemain bergabung...'
						: mp.roomMode === 'coop-vs-ai' && !mp.players[2]
							? 'Tunggu teman bergabung...'
							: !mp.allReady
								? 'Tunggu semua pemain siap...'
								: ''}
				</p>
			{/if}

			<button
				onclick={leaveRoom}
				class="text-center font-body text-sm text-stone-500 underline transition hover:text-stone-300"
			>
				Keluar Room
			</button>
		</div>

		<!-- Error display -->
		{#if mp.lastError}
			<div class="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center font-body text-sm text-red-400">
				{mp.lastError}
			</div>
		{/if}
	</div>
{/if}
