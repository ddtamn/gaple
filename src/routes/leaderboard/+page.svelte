<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const { players, totalHumans } = data;
</script>

<div class="flex min-h-dvh flex-col items-center bg-background px-4 py-8 text-stone-100">
	<div class="w-full max-w-2xl">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="font-headline text-3xl font-bold text-stone-100">Leaderboard</h1>
			<a
				href="/"
				class="rounded border-[1.5px] border-primary bg-transparent px-4 py-2 font-body text-sm font-semibold text-primary transition hover:bg-warm-hover"
			>
				← Back to Lobby
			</a>
		</div>

		{#if players.length === 0}
			<div class="mt-16 text-center font-body text-stone-400">
				<p class="text-lg">Belum ada data permainan.</p>
				<p class="mt-2 text-sm">Mainkan game terlebih dahulu untuk muncul di papan peringkat.</p>
			</div>
		{:else}
			<div class="mb-4 flex items-center gap-2 font-body text-xs text-stone-500">
				<span>🏆 {totalHumans} pemain terdaftar</span>
				<span class="text-stone-700">·</span>
				<span>Top {players.length} berdasarkan MMR</span>
			</div>

			<div class="overflow-hidden rounded-lg border border-stone-700 bg-surface/50">
				<!-- Header -->
				<div
					class="grid grid-cols-[48px_1fr_100px_100px_100px] gap-2 border-b border-stone-700 px-4 py-3 font-body text-xs font-semibold uppercase tracking-wider text-stone-500"
				>
					<span>#</span>
					<span>Name</span>
					<span class="text-right">MMR</span>
					<span class="text-right">W</span>
					<span class="text-right">WR</span>
				</div>

				<!-- Rows -->
				{#each players as player, i}
					<div
						class="grid grid-cols-[48px_1fr_100px_100px_100px] gap-2 border-b border-stone-800/50 px-4 py-3 font-body text-sm transition hover:bg-stone-800/30 last:border-b-0"
					>
						<span class="flex items-center font-semibold">
							{#if i === 0}
								<span class="text-xl">🥇</span>
							{:else if i === 1}
								<span class="text-xl">🥈</span>
							{:else if i === 2}
								<span class="text-xl">🥉</span>
							{:else}
								<span class="text-stone-500">{i + 1}</span>
							{/if}
						</span>

						<div class="flex items-center gap-2">
							<span class="truncate text-stone-100">{player.name}</span>
							{#if player.isBot}
								<span
									class="rounded bg-stone-700 px-1.5 py-0.5 font-body text-[10px] font-medium text-stone-400"
								>
									AI
								</span>
							{/if}
						</div>

						<span class="flex items-center justify-end font-mono font-semibold text-secondary">
							{player.mmr}
						</span>

						<span class="flex items-center justify-end font-mono text-stone-400">
							{player.matchesWon}
						</span>

						<span class="flex items-center justify-end font-mono text-stone-500">
							{player.matchesPlayed > 0
								? Math.round((player.matchesWon / player.matchesPlayed) * 100) + '%'
								: '—'}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
