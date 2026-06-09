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
		const c = color;
		const pk = peak;
		const dur = duration;
		runAnimation({
			duration: dur,
			easing: easeOutCubic,
			abortSignal: controller.signal,
			onUpdate: (p) => {
				opacity = pk * (1 - p);
			}
		});
		return () => controller.abort();
	});
</script>

<div
	class="pointer-events-none fixed inset-0 z-30"
	style="background:{color}; opacity:{opacity};"
></div>
