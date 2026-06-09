<script lang="ts">
	import { onMount } from 'svelte';
	import { runAnimation, easeOutCubic } from '$lib/animation/tween';

	interface Props {
		color?: string;
		duration?: number;
		peak?: number;
	}

	let { color = '#F59E0B', duration = 420, peak = 0.55 }: Props = $props();

	let opacity = $state(0);

	onMount(() => {
		const controller = new AbortController();
		runAnimation({
			duration,
			easing: easeOutCubic,
			signal: controller.signal,
			onUpdate: (p) => {
				opacity = peak * (1 - p);
			}
		});
		return () => controller.abort();
	});
</script>

<div
	class="pointer-events-none fixed inset-0 z-30"
	style="background:{color}; opacity:{opacity};"
></div>
