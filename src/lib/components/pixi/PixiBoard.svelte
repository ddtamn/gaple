<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Application, Container } from 'pixi.js';
	import { PixiBoardRenderer } from './PixiBoardRenderer';
	import type { GameAnimationController } from '$lib/animation/gameAnimationController.svelte';
	import type { TilePosition } from '../../../engine/types';

	interface Props {
		controller: GameAnimationController;
		boardLayout: TilePosition[];
		camera: { scale: number; offsetX: number; offsetY: number };
		/** Width of the board area */
		width: number;
		/** Height of the board area */
		height: number;
	}

	let { controller, boardLayout, camera, width, height }: Props = $props();

	let canvasEl: HTMLCanvasElement;
	let app: Application | null = null;
	let renderer: PixiBoardRenderer | null = null;

	// Track the last board layout to detect changes
	let prevLayoutJson = '';

	onMount(async () => {
		app = new Application();
		await app.init({
			canvas: canvasEl,
			width,
			height,
			backgroundAlpha: 0,
			antialias: true,
			resolution: Math.min(window.devicePixelRatio || 1, 2)
		});

		const stage = new Container();
		app.stage.addChild(stage);
		renderer = new PixiBoardRenderer(stage);

		// Initial sync
		syncBoard();
	});

	onDestroy(() => {
		if (renderer) {
			renderer.destroy();
			renderer = null;
		}
		if (app) {
			app.destroy(true, { children: true });
			app = null;
		}
	});

	function syncBoard() {
		if (!renderer) return;
		const layoutJson = JSON.stringify(boardLayout);
		if (layoutJson === prevLayoutJson) return;
		prevLayoutJson = layoutJson;

		const tiles = boardLayout.map((t) => ({
			id: t.id,
			left: t.left,
			right: t.right,
			x: t.x,
			y: t.y,
			rotation: t.rotation,
			isBalak: t.isBalak
		}));
		// Sync board with controller's hidden tile IDs (tiles mid-animation)
		renderer.syncBoard(tiles, controller.hiddenBoardTileIds);
	}

	// Sync board layout reactively
	$effect(() => {
		// Re-sync on layout changes OR hidden tile ID changes
		// Reading controller.hiddenBoardTileIds in this effect makes Svelte track it reactively
		const _hidden = controller.hiddenBoardTileIds;
		syncBoard();
	});

	// Sync camera transform (centered in canvas + offset + scale)
	$effect(() => {
		if (!renderer) return;
		// The board layout coordinates are relative to the board center.
		// DOM renders: flexbox centers the board → scale → offset.
		// PixiJS needs: position at canvas center + offset * scale, then scale.
		const { scale, offsetX, offsetY } = camera;
		renderer.setCamera(scale, offsetX, offsetY, width, height);
	});

	// Resize on dimension change
	$effect(() => {
		if (!app) return;
		app.renderer.resize(width, height);
	});
</script>

<canvas
	bind:this={canvasEl}
	class="pointer-events-none absolute inset-0 z-10"
	style="width:{width}px; height:{height}px;"
></canvas>
