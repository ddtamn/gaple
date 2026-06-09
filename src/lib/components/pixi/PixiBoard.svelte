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

	// Store cleanup function from event bus subscription
	let unsub: (() => void) | null = null;

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

		// Subscribe to animation events
		unsub = controller.events.onAny((event) => {
			renderer?.handleEvent(event);
		});

		// Initial sync (also handled by $effect below, but guard prevents duplicate)
		syncBoard();
	});

	onDestroy(() => {
		unsub?.();
		unsub = null;
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
			rotation: t.rotation % 180 !== 0 ? t.rotation - 90 : t.rotation,
			isBalak: t.isBalak
		}));
		renderer.syncBoard(tiles);
	}

	// Sync board layout reactively
	$effect(() => {
		syncBoard();
	});

	// Sync camera transform
	$effect(() => {
		if (!renderer) return;
		renderer.setCamera(camera.scale, camera.offsetX, camera.offsetY);
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
