<script lang="ts">
	import { onMount } from 'svelte';
	import { createTurnHighlightAnimation } from '$lib/animation/card-animations';

	interface Props {
		playerId: string;
		avatarX: number;
		avatarY: number;
		duration?: number;
	}

	let { playerId: _playerId, avatarX, avatarY, duration = 600 }: Props = $props();

	let glowOpacity = $state(0);
	let glowScale = $state(0.5);

	onMount(() => {
		const cleanup = createTurnHighlightAnimation({
			avatarX,
			avatarY,
			duration,
			onUpdate: (state) => {
				glowOpacity = state.glowOpacity;
				glowScale = state.glowScale;
			},
			onComplete: () => {
				// Keep glow visible (parent will clear on next turn)
			}
		});

		return cleanup;
	});
</script>

{#if glowOpacity > 0}
	<div
		class="pointer-events-none fixed z-30 rounded-full"
		style="left:{avatarX}px; top:{avatarY}px; width:{56 * glowScale}px; height:{56 * glowScale}px; opacity:{glowOpacity * 0.5}; transform:translate(-50%,-50%); background: radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%); box-shadow: 0 0 {20 * glowScale}px rgba(245,158,11,{0.3 * glowOpacity});"
	></div>
{/if}
