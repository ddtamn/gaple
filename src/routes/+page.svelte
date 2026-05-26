<script lang="ts">
	import { GameManager } from '$lib/game.svelte';

	const dotPatterns: Record<number, number[]> = {
		0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
		2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
		3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
		5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
		6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
	};

	const game = new GameManager(['1', '2', '3', '4']);
	game.startGame();
</script>

{#snippet Tiles(index: number)}
	{@const isVertical = index === 0 || index === 2}

	{#each game.players[index].hand as tile, i (i)}
		<button
			class="flex cursor-pointer overflow-hidden rounded-xl bg-neutral-200 shadow-md transition-transform
					{isVertical
				? 'h-34 w-16 flex-col hover:-translate-y-2'
				: 'h-16 w-34 flex-row hover:-translate-x-2'}"
		>
			<div
				class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical
					? 'rotate-90'
					: ''}"
			>
				{#each dotPatterns[tile.left] as hasDot, j (j)}
					<div class="h-3 w-3 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
				{/each}
			</div>

			<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
				<div class="{isVertical ? 'h-full w-[70%]' : 'h-[70%] w-full'} bg-red-700/25"></div>
			</div>

			<div
				class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical
					? 'rotate-90'
					: ''}"
			>
				{#each dotPatterns[tile.right] as hasDot, j (j)}
					<div class="h-3 w-3 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
				{/each}
			</div>
		</button>
		<!-- <div
				class="flex items-center justify-center rounded-xl border-2 border-red-950 bg-red-800 shadow-sm
					{isVertical ? 'h-34 w-16' : 'h-16 w-34'}"
			>
				{i}
			</div> -->
	{/each}
{/snippet}

<div class="relative flex h-screen w-full items-center justify-center">
	{#each game.players as player, i (player.id)}
		<div
			class="absolute flex gap-2
				{i === 0
				? 'bottom-4 left-1/2 -translate-x-1/2 flex-row'
				: i === 1
					? 'top-1/2 right-4 -translate-y-1/2 flex-col-reverse'
					: i === 2
						? 'top-4 left-1/2 -translate-x-1/2 flex-row'
						: 'top-1/2 left-4 -translate-y-1/2 flex-col'}"
		>
			{@render Tiles(i)}
		</div>
	{/each}
</div>
