<script lang="ts">
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';
	import { getWinTypeConfig } from '$lib/animation/winTypes';

	interface Props {
		label: string;
		points: number;
		winnerName: string;
		centerX: number;
		centerY: number;
	}

	let { label, points, winnerName, centerX, centerY }: Props = $props();

	let scale = $state(0);
	let rotate = $state(0);
	let opacity = $state(0);

	const config = $derived(getWinTypeConfig(label));

	onMount(() => {
		const controller = new AbortController();
		runAnimation({
			duration: 520,
			easing: easeOutCubic,
			signal: controller.signal,
			onUpdate: (p) => {
				if (p < 0.55) {
					const sp = p / 0.55;
					scale = config.initialScale - (config.initialScale - 1) * sp;
					rotate = config.initialRotation - config.initialRotation * sp;
					opacity = Math.min(1, sp * 2);
				} else {
					const sp = (p - 0.55) / 0.45;
					scale = 1 - 0.04 * sp;
					rotate = 0;
					opacity = 1;
				}
			}
		});
		return () => controller.abort();
	});

	const themeBorder = $derived(
		config.theme === 'danger' ? 'border-red-500/70' : 'border-primary/60'
	);
	const themeShadow = $derived(
		config.theme === 'danger' ? 'shadow-red-500/50' : 'shadow-primary/30'
	);
	const labelColor = $derived(config.theme === 'danger' ? 'text-red-400' : 'text-primary');
	const bgGradient = $derived(
		config.intensity === 'epic'
			? 'bg-gradient-to-br from-red-950/95 via-stone-950/95 to-amber-950/95'
			: 'bg-background/95'
	);
</script>

<div
	class="pointer-events-none fixed z-50 flex flex-col items-center"
	style="left:{centerX}px; top:{centerY}px; transform:translate(-50%,-50%) scale({scale}) rotate({rotate}deg); opacity:{opacity};"
>
	<div
		class="flex flex-col items-center rounded-2xl border-2 px-8 py-5 shadow-2xl backdrop-blur {themeBorder} {themeShadow} {bgGradient}"
	>
		<span class="font-headline text-4xl font-black tracking-widest md:text-5xl {labelColor}">
			{label}
		</span>
		<span class="mt-1 font-body text-sm font-semibold text-stone-400">
			{winnerName}
		</span>
		<div class="mt-2 h-px w-16 bg-stone-600/50"></div>
		<span class="mt-1 font-headline text-lg font-bold text-amber-400">
			+{points} Poin
		</span>
	</div>
</div>
