<script lang="ts">
	import type { GameAnimationController, FlyingTileAnim, StampAnim, FloatingPointsAnim, PassAnim } from '$lib/animation/gameAnimationController.svelte';
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
	let passEffects = $derived(controller.activePassEffects);
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
		onland={() => {}}
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
		onstamped={() => {}}
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
		onland={() => {}}
	/>
{/each}

<!-- Pass effects -->
{#each passEffects as anim (anim.id)}
	<div
		class="pointer-events-none fixed z-50"
		style="left:{anim.position.x}px; top:{anim.position.y - 40}px; transform:translate(-50%,-50%);"
	>
		<div
			class="animate-bounce rounded-full bg-amber-500/25 px-3 py-1 font-body text-sm font-bold text-amber-400 shadow-lg backdrop-blur"
		>
			PASS
		</div>
	</div>
{/each}
