<script lang="ts">
	import type { GameAnimationController } from '$lib/animation/gameAnimationController.svelte';
	import FlyingTileOverlay from './FlyingTileOverlay.svelte';
	import CenterStampOverlay from './CenterStampOverlay.svelte';
	import FloatingPointsOverlay from './FloatingPointsOverlay.svelte';
	import ConfettiOverlay from './ConfettiOverlay.svelte';
	import ScreenFlashOverlay from './ScreenFlashOverlay.svelte';
	import SparkleOverlay from './SparkleOverlay.svelte';
	import DealOverlay from './DealOverlay.svelte';
	import PassOverlay from './PassOverlay.svelte';
	import TurnHighlightOverlay from './TurnHighlightOverlay.svelte';

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
	let deal = $derived(controller.activeDeal);
	let pass = $derived(controller.activePass);
	let turnHighlight = $derived(controller.activeTurnHighlight);

	function getFlyingTileMeta(id: string) {
		const meta = controller.activeFlyingTileMeta.get(id);
		return meta ?? null;
	}
</script>

<!-- Screen flash (lowest z, behind everything) -->
{#if flash}
	<ScreenFlashOverlay color={flash.color} duration={flash.duration} peak={flash.peak} />
{/if}

<!-- Deal animation overlay -->
{#if deal}
	<DealOverlay
		tiles={deal.tiles}
		fromX={deal.fromX}
		fromY={deal.fromY}
		toX={deal.toX}
		toY={deal.toY}
	/>
{/if}

<!-- Turn highlight overlay -->
{#if turnHighlight}
	<TurnHighlightOverlay
		playerId={turnHighlight.playerId}
		avatarX={turnHighlight.avatarX}
		avatarY={turnHighlight.avatarY}
	/>
{/if}

<!-- Pass overlay -->
{#if pass}
	<PassOverlay
		playerId={pass.playerId}
		avatarX={pass.avatarX}
		avatarY={pass.avatarY}
	/>
{/if}

<!-- Flying tiles overlay -->
{#each flyingTiles as anim (anim.id)}
	{@const meta = getFlyingTileMeta(anim.id)}
	{#if meta}
		<FlyingTileOverlay data={anim} tile={meta.tile} />
	{/if}
{/each}

<!-- Center stamp overlay -->
{#if stamp}
	<CenterStampOverlay
		label={stamp.label}
		points={stamp.points}
		winnerName={stamp.winnerName}
		centerX={stamp.centerX}
		centerY={stamp.centerY}
	/>
{/if}

<!-- Confetti burst -->
{#each confetti as anim (anim.id)}
	<ConfettiOverlay
		centerX={anim.centerX}
		centerY={anim.centerY}
		intensity={anim.intensity}
	/>
{/each}

<!-- Floating points overlay -->
{#each floatingPoints as anim (anim.id)}
	<FloatingPointsOverlay
		label={anim.label}
		fromX={anim.fromX}
		fromY={anim.fromY}
		toX={anim.toX}
		toY={anim.toY}
	/>
{/each}

<!-- Sparkle bursts on score land -->
{#each sparkles as anim (anim.id)}
	<SparkleOverlay x={anim.positionX} y={anim.positionY} color={anim.color} />
{/each}
