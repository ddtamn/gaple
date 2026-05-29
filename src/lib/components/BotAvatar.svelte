<script lang="ts">
	interface Props {
		player: { name: string; id: string };
		isMyTurn: boolean;
		isMarked: boolean;
		winCount: number;
	}

	let { player, isMyTurn, isMarked, winCount }: Props = $props();
</script>

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
			src="https://api.dicebear.com/9.x/bottts/svg?seed={player.name}"
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
		{winCount}
	</span>
</div>
