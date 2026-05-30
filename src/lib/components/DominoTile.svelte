<script lang="ts">
	export type TileSize = 'sm' | 'md' | 'lg';

	interface Props {
		tile: { left: number; right: number };
		isVertical?: boolean;
		size?: TileSize;
	}

	let { tile, isVertical = false, size = 'md' }: Props = $props();

	const dotPatterns: Record<number, number[]> = {
		0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
		1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
		2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
		3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
		4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
		5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
		6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
	};

	// Reactive size classes — re-evaluates when size or isVertical changes
	const s = $derived.by(() => {
		const vert = isVertical;
		switch (size) {
			case 'sm':
				return {
					container: vert ? 'h-[56px] w-[36px] flex-col' : 'h-[36px] w-[56px] flex-row',
					dotCenter: 'h-2 w-2',
					dotRegular: 'h-[4px] w-[4px]',
					divider: vert ? 'h-full w-[55%]' : 'h-[55%] w-full',
					gridPadding: 'p-[3px] gap-px'
				};
			case 'lg':
				return {
					container: vert ? 'h-36 w-18 flex-col' : 'h-18 w-36 flex-row',
					dotCenter: 'h-4 w-4',
					dotRegular: 'h-2.5 w-2.5',
					divider: vert ? 'h-full w-[75%]' : 'h-[75%] w-full',
					gridPadding: 'p-2 gap-1'
				};
			default: // 'md'
				return {
					container: vert ? 'h-28 w-14 flex-col' : 'h-14 w-28 flex-row',
					dotCenter: 'h-3.5 w-3.5',
					dotRegular: 'h-2 w-2',
					divider: vert ? 'h-full w-[70%]' : 'h-[70%] w-full',
					gridPadding: 'p-1.5 gap-0.5'
				};
		}
	});
</script>

<div class="flex overflow-hidden rounded-lg border border-stone-300 bg-white {s.container}">
	<div
		class="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-3 place-items-center {s.gridPadding} {!isVertical
			? 'rotate-90'
			: ''}"
	>
		{#each dotPatterns[tile.left] as hasDot, j (j)}
			<div
				class="rounded-full {hasDot ? 'bg-red-600' : 'bg-transparent'} 
				{tile.left === 1 && hasDot ? s.dotCenter : s.dotRegular}"
			></div>
		{/each}
	</div>
	<div class="flex items-center justify-center {isVertical ? 'h-px w-full' : 'h-full w-px'}">
		<div class="{s.divider} bg-red-600/35"></div>
	</div>

	<div
		class="grid h-full min-h-0 w-full min-w-0 flex-1 grid-cols-3 grid-rows-3 place-items-center {s.gridPadding} {!isVertical
			? 'rotate-90'
			: ''}"
	>
		{#each dotPatterns[tile.right] as hasDot, j (j)}
			<div
				class="rounded-full {hasDot ? 'bg-red-600' : 'bg-transparent'} 
				{tile.right === 1 && hasDot ? s.dotCenter : s.dotRegular}"
			></div>
		{/each}
	</div>
</div>
