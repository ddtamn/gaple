<script lang="ts">
	import TileIcon from '$lib/icons/TileIcon.svelte';

	interface Props {
		values?: number[];
	}

	let { values = [] }: Props = $props();

	const visibleValues = $derived([...new Set(values)].slice(0, 2));
</script>

{#if visibleValues.length > 0}
	<div
		class="pointer-events-none absolute -top-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-amber-400/40 bg-stone-950/90 px-1.5 py-1 shadow-lg backdrop-blur"
	>
		{#each visibleValues as value (value)}
			<span
				class="flex size-5 items-center justify-center rounded-sm bg-stone-900 ring-1 ring-amber-500/30"
			>
				<TileIcon value={value} size="14" color="#fbbf24" />
			</span>
		{/each}
	</div>
{/if}
