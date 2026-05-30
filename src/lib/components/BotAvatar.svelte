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
	class="pointer-events-auto relative z-20 mb-8 flex w-[64px] scale-[1.8] flex-col items-center justify-center gap-1 rounded-lg border border-stone-700 bg-surface p-2 md:w-[80px] md:scale-none"
>
	{#if isMyTurn}
		<div
			class="pointer-events-none absolute inset-0 animate-pulse rounded-lg border-2 border-primary"
		></div>
	{/if}

	<div class="relative">
		<img
			src="https://api.dicebear.com/9.x/bottts/svg?seed={player.name}"
			alt="Avatar AI"
			class="h-10 w-10 rounded-full bg-stone-800 object-cover ring-2 ring-stone-600 md:h-12 md:w-12"
		/>
		{#if isMarked}		<span
			class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-body text-[10px] font-bold text-white"
				>D</span
		>
		{/if}
	</div>
	<span
		class="mt-2 w-full rounded bg-warm-hover py-0.5 text-center font-body text-[12px] font-semibold text-primary"
	>
		{winCount}
	</span>
</div>
