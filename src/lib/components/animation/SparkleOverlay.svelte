<script lang="ts">
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';

	interface Props {
		x: number;
		y: number;
		color?: string;
		duration?: number;
	}

	let { x, y, color = '#F59E0B', duration = 520 }: Props = $props();

	const PARTICLE_COUNT = 8;

	let progress = $state(0);

	const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
		const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
		const distance = 28 + (i % 2) * 6;
		return { angle, distance };
	});

	onMount(() => {
		const controller = new AbortController();
		const dur = duration;
		runAnimation({
			duration: dur,
			easing: easeOutCubic,
			abortSignal: controller.signal,
			onUpdate: (p) => {
				progress = p;
			}
		});
		return () => controller.abort();
	});
</script>

{#each particles as p, i (i)}
	{@const xPos = x + Math.cos(p.angle) * p.distance * progress}
	{@const yPos = y + Math.sin(p.angle) * p.distance * progress}
	{@const opacity = Math.max(0, 1 - progress)}
	{@const size = 6 * (1 - progress * 0.4)}
	<div
		class="pointer-events-none fixed z-50 rounded-full"
		style="left:{xPos}px; top:{yPos}px; width:{size}px; height:{size}px; background:{color}; opacity:{opacity}; transform:translate(-50%,-50%); box-shadow: 0 0 8px {color};"
	></div>
{/each}
