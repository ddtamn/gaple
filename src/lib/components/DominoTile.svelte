<script lang="ts">
	interface Props {
		tile: { left: number; right: number };
		isVertical?: boolean;
	}

	let { tile, isVertical = false }: Props = $props();

	const dotPatterns: Record<number, number[]> = {
		0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
		2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
		3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
		5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
		6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
	};
</script>

<div
	class="flex overflow-hidden rounded-lg border border-stone-300 bg-white
      {isVertical ? 'h-28 w-14 flex-col' : 'h-14 w-28 flex-row'}"
>
	<div
		class="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-3 place-items-center gap-0.5 p-1.5 {!isVertical
			? 'rotate-90'
			: ''}"
	>
		{#each dotPatterns[tile.left] as hasDot, j (j)}
			<div
				class="rounded-full {hasDot ? 'bg-red-600' : 'bg-transparent'} 
				{tile.left === 1 && hasDot ? 'h-3.5 w-3.5' : 'h-2 w-2'}"
			></div>
		{/each}
	</div>	<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
		<div class="{isVertical ? 'h-full w-[70%]' : 'h-[70%] w-full'} bg-red-600/35"></div>x
	</div>

	<div
		class="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-3 place-items-center gap-0.5 p-1.5 {!isVertical
			? 'rotate-90'
			: ''}"
	>
		{#each dotPatterns[tile.right] as hasDot, j (j)}
			<div
				class="rounded-full {hasDot ? 'bg-red-600' : 'bg-transparent'} 
				{tile.right === 1 && hasDot ? 'h-3.5 w-3.5' : 'h-2 w-2'}"
			></div>
		{/each}
	</div>
</div>
