<script lang="ts">
	import type { GameAnimationController } from '$lib/animation/gameAnimationController.svelte';
	import FlyingTileOverlay from './FlyingTileOverlay.svelte';
	import CenterStampOverlay from './CenterStampOverlay.svelte';
	import FloatingPointsOverlay from './FloatingPointsOverlay.svelte';

	interface Props {
		controller: GameAnimationController;
	}

	let { controller }: Props = $props();

	let flyingTiles = $derived(controller.activeFlyingTiles);
	let stamp = $derived(controller.activeStamp);
	let floatingPoints = $derived(controller.activeFloatingPoints);
</script>

<!-- Flying tiles overlay -->
{#each flyingTiles as anim (anim.id)}
	<FlyingTileOverlay
		tile={anim.tile}
		fromX={anim.from.x}
		fromY={anim.from.y}
		toX={anim.to.x}
		toY={anim.to.y}
		rotation={anim.rotation}
		duration={anim.duration}
	/>
{/each}

<!-- Center stamp overlay -->
{#if stamp}
	<CenterStampOverlay
		label={stamp.label}
		points={stamp.points}
		winnerName={stamp.winnerName}
		centerX={stamp.center.x}
		centerY={stamp.center.y}
	/>
{/if}

<!-- Floating points overlay -->
{#each floatingPoints as anim (anim.id)}
	<FloatingPointsOverlay
		label={anim.label}
		fromX={anim.from.x}
		fromY={anim.from.y}
		toX={anim.to.x}
		toY={anim.to.y}
	/>
{/each}
