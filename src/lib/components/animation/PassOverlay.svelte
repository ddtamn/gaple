<script lang="ts">
	import { onMount } from 'svelte';
	import { createPassAnimation } from '$lib/animation/card-animations';

	interface Props {
		playerId: string;
		avatarX: number;
		avatarY: number;
		duration?: number;
	}

	let { playerId: _playerId, avatarX, avatarY, duration = 600 }: Props = $props();

	let badgeOpacity = $state(0);
	let badgeScale = $state(0.3);
	let badgeY = $state(avatarY - 10);
	let avatarPulse = $state(0);

	onMount(() => {
		const cleanup = createPassAnimation({
			avatarX,
			avatarY,
			duration,
			onUpdate: (state) => {
				badgeOpacity = state.badgeOpacity;
				badgeScale = state.badgeScale;
				badgeY = state.badgeY;
				avatarPulse = state.avatarPulse;
			},
			onComplete: () => {
				// Cleanup handled by parent
			}
		});

		return cleanup;
	});
</script>

<!-- Avatar pulse ring -->
{#if avatarPulse > 0}
	<div
		class="pointer-events-none fixed z-40 rounded-full border-2 border-amber-400"
		style="left:{avatarX}px; top:{avatarY}px; width:{48 + avatarPulse * 20}px; height:{48 + avatarPulse * 20}px; opacity:{avatarPulse * 0.6}; transform:translate(-50%,-50%);"
	></div>
{/if}

<!-- PASS badge -->
{#if badgeOpacity > 0}
	<div
		class="pointer-events-none fixed z-50 flex items-center justify-center rounded-full bg-amber-500/20 px-3 py-1 shadow-lg backdrop-blur"
		style="left:{avatarX}px; top:{badgeY}px; transform:translate(-50%,-50%) scale({badgeScale}); opacity:{badgeOpacity};"
	>
		<span class="font-headline text-sm font-black text-amber-400">PASS</span>
	</div>
{/if}
