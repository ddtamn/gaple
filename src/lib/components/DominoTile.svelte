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
	class="flex overflow-hidden rounded-xl bg-neutral-200 shadow-md
      {isVertical ? 'h-28 w-14 flex-col' : 'h-14 w-28 flex-row'}"
>
	<div
		class="grid flex-1 grid-cols-3 grid-rows-3 place-items-center gap-1 p-2 {!isVertical
			? 'rotate-90'
			: ''}"
	>
		{#each dotPatterns[tile.left] as hasDot, j (j)}
			<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
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
			<div class="h-2 w-2 rounded-full {hasDot ? 'bg-red-700' : 'bg-transparent'}"></div>
		{/each}
	</div>
</div>
