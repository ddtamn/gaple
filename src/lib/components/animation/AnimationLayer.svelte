<script lang="ts">
	import type { GameAnimationController } from '$lib/animation/gameAnimationController.svelte';
	import FlyingTileOverlay from './FlyingTileOverlay.svelte';
	import CenterStampOverlay from './CenterStampOverlay.svelte';
	import FloatingPointsOverlay from './FloatingPointsOverlay.svelte';
	import ConfettiOverlay from './ConfettiOverlay.svelte';
	import ScreenFlashOverlay from './ScreenFlashOverlay.svelte';
	import SparkleOverlay from './SparkleOverlay.svelte';

	interface Props {
		controller: GameAnimationController;
	}

	let { controller }: Props = $props();

	let flyingTiles = $derived(controller.activeFlyingTiles);
	let stamp = $derived(controller.activeStamp);
	let floatingPoints = $derived(controller.activeFloatingPoints);
	let confetti = $derived(controller.activeConfetti);
	let flash = $derived(controller.activeScreenFlash);
	let sparkles = $derived(controller.activeSparkles);
</script>

<!-- Screen flash (lowest z, behind everything) -->
{#if flash}
	<ScreenFlashOverlay color={flash.color} duration={flash.duration} peak={flash.peak} />
{/if}

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

<!-- Confetti burst -->
{#each confetti as anim (anim.id)}
	<ConfettiOverlay
		centerX={anim.center.x}
		centerY={anim.center.y}
		intensity={anim.intensity}
	/>
{/each}

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

<!-- Sparkle bursts on score land -->
{#each sparkles as anim (anim.id)}
	<SparkleOverlay x={anim.position.x} y={anim.position.y} color={anim.color} />
{/each}
