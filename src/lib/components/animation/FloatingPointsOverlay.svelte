<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		label: string;
		fromX: number;
		fromY: number;
		toX: number;
		toY: number;
	}

	let { label, fromX, fromY, toX, toY }: Props = $props();

	let x = $state(fromX);
	let y = $state(fromY);
	let scale = $state(1.3);
	let opacity = $state(0);

	const startTime = performance.now();
	const DURATION = 500;

	onMount(() => {
		requestAnimationFrame(function tick(now) {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / DURATION, 1);

			const ease = 1 - Math.pow(1 - progress, 3);

			x = fromX + (toX - fromX) * ease;
			y = fromY + (toY - fromY) * ease;
			scale = 1.3 - 0.5 * ease;
			opacity = progress < 0.15 ? progress / 0.15 : progress > 0.85 ? (1 - progress) / 0.15 : 1;

			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				x = toX;
				y = toY;
				scale = 0.8;
				opacity = 0;
			}
		});
	});
</script>

<div
	class="pointer-events-none fixed z-50 flex items-center gap-1 rounded-full border border-amber-400/40 bg-stone-950/90 px-3 py-1.5 shadow-lg backdrop-blur"
	style="left:{x}px; top:{y}px; transform:translate(-50%,-50%) scale({scale}); opacity:{opacity};"
>
	<span class="font-headline text-base font-black text-amber-400">{label}</span>
</div>
