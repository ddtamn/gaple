<script lang="ts">
	type AvatarSize = 'sm' | 'md';

	interface Props {
		player: { name: string; id: string };
		isMyTurn: boolean;
		isMarked: boolean;
		winCount: number;
		showScore?: boolean;
		size?: AvatarSize;
	}

	let { player, isMyTurn, isMarked, winCount, showScore = true, size = 'md' }: Props = $props();

	const sizeClass = $derived(
		size === 'sm'
			? {
					container: 'w-10 md:w-14 p-1 md:p-1.5',
					avatar: 'h-8 w-8 md:h-10 md:w-10'
				}
			: {
					container: 'w-14 md:w-[80px] p-1.5',
					avatar: 'h-10 w-10 md:h-12 md:w-12'
				}
	);
</script>

<div
	class="pointer-events-auto relative z-20 flex flex-col items-center justify-center gap-1 rounded-lg border border-stone-700 bg-surface {sizeClass.container}"
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
			class="rounded-full bg-stone-800 object-cover ring-2 ring-stone-600 {sizeClass.avatar}"
		/>
		{#if isMarked}		<span
			class="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-secondary font-body text-[10px] font-bold text-white"
				>D</span
		>
		{/if}
	</div>
	{#if showScore}
		<span
			class="mt-2 w-full rounded bg-warm-hover py-0.5 text-center font-body text-[12px] font-semibold text-primary"
		>
			{winCount}
		</span>
	{/if}
</div>
