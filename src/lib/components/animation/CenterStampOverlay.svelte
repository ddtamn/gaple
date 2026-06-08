<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		label: string;
		points: number;
		winnerName: string;
		centerX: number;
		centerY: number;
		onstamped: () => void;
	}

	let { label, points, winnerName, centerX, centerY, onstamped }: Props = $props();

	let scale = $state(0);
	let rotate = $state(-12);
	let opacity = $state(0);
	let blur = $state(8);

	const startTime = performance.now();

	onMount(() => {
		requestAnimationFrame(function tick(now) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / 400, 1);

			// Stamp-like: overshoot then settle
			if (progress < 0.6) {
				const subProgress = progress / 0.6;
				scale = 1.5 - 0.5 * subProgress; // 1.5 -> 1.0
				rotate = -12 + 14 * subProgress; // -12 -> 2
				blur = 8 - 8 * subProgress;
				opacity = Math.min(1, subProgress * 2);
			} else {
				const subProgress = (progress - 0.6) / 0.4;
				scale = 1 - 0.04 * subProgress; // 1.0 -> 0.96
				rotate = 2 - 2 * subProgress; // 2 -> 0
				blur = 0;
				opacity = 1;
			}

			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				scale = 0.96;
				rotate = 0;
				blur = 0;
				opacity = 1;
				onstamped();
			}
		});
	});
</script>

<div
	class="pointer-events-none fixed z-50 flex flex-col items-center"
	style="left:{centerX}px; top:{centerY}px; transform:translate(-50%,-50%) scale({scale}) rotate({rotate}deg); opacity:{opacity}; filter:blur({blur}px);"
>
	<!-- Stamp circle background -->
	<div
		class="flex flex-col items-center rounded-2xl border-2 border-primary/60 bg-background/95 px-8 py-5 shadow-2xl shadow-primary/30"
	>
		<span class="font-headline text-4xl font-black tracking-widest text-primary md:text-5xl">
			{label}
		</span>
		<span class="mt-1 font-body text-sm font-semibold text-stone-400">
			{winnerName}
		</span>
		<div class="mt-2 h-px w-16 bg-primary/30"></div>
		<span class="mt-1 font-headline text-lg font-bold text-amber-400">
			+{points} Poin
		</span>
	</div>
</div>
