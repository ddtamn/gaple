<script lang="ts">
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';

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

	onMount(() => {
		const controller = new AbortController();
		// Capture props at mount time — overlay is one-shot, props are stable for its lifetime
		const fx = fromX,
			fy = fromY,
			tx = toX,
			ty = toY;
		runAnimation({
			duration: 500,
			easing: easeOutCubic,
			abortSignal: controller.signal,
			onUpdate: (p) => {
				x = fx + (tx - fx) * p;
				y = fy + (ty - fy) * p;
				scale = 1.3 - 0.5 * p;
				opacity = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
			}
		});
		return () => controller.abort();
	});
</script>

<div
	class="pointer-events-none fixed z-50 flex items-center gap-1 rounded-full border border-amber-400/40 bg-stone-950/90 px-3 py-1.5 shadow-lg backdrop-blur"
	style="left:{x}px; top:{y}px; transform:translate(-50%,-50%) scale({scale}); opacity:{opacity};"
>
	<span class="font-headline text-base font-black text-amber-400">{label}</span>
</div>
