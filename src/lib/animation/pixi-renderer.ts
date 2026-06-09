/**
 * PixiJS Renderer Stub
 *
 * This file provides a skeleton PixiJS renderer that implements the
 * AnimationRenderer interface. It is NOT functional — it documents the
 * migration path from DOM-based overlays to PixiJS canvas rendering.
 *
 * ==============  MIGRATION STEPS  ==============
 *
 * 1. Install pixi.js v8:
 *    npm install pixi.js@^8
 *
 * 2. Create a PIXI.Application in a Svelte component:
 *    <script lang="ts">
 *      import { Application } from 'pixi.js';
 *      let canvasEl: HTMLCanvasElement;
 *      onMount(() => {
 *        const app = new Application();
 *        await app.init({ canvas: canvasEl, resizeTo: window });
 *      });
 *    </script>
 *    <canvas bind:this={canvasEl} />
 *
 * 3. For each animation type, create PIXI display objects (sprites,
 *    graphics, text) instead of managing DOM overlays. Use the
 *    controller's AnimationEventBus to drive the renderer.
 *
 * 4. Replace domAnchors-based position resolution in GameArea with
 *    PixiJS scene-space coordinates.
 *
 * 5. Remove the AnimationLayer component and DOM overlay components.
 *
 * ==============================================
 */

import type { AnimationRenderer, PositionResolver } from './renderer';
import type {
	FlyingTileAnimData,
	StampAnimData,
	FloatingPointsAnimData,
	ConfettiAnimData,
	ScreenFlashAnimData,
	SparkleAnimData,
	DealAnimData,
	PassAnimData,
	TurnHighlightAnimData
} from './types';
import type { Domino } from '../../engine/types';

/**
 * Position resolver that returns PixiJS canvas-space coordinates.
 * Replace the DOM-based resolver in GameArea with this.
 */
export class PixiPositionResolver implements PositionResolver {
	getBoardCenter(): { x: number; y: number } {
		// TODO: Return the center of the PixiJS stage
		return { x: 0, y: 0 };
	}

	getHandCenter(_playerId: string): { x: number; y: number } | null {
		// TODO: Return hand area center in canvas space
		return null;
	}

	getAvatarCenter(_playerId: string): { x: number; y: number } | null {
		// TODO: Return avatar center in canvas space
		return null;
	}

	getScoreTarget(_playerId: string): { x: number; y: number } | null {
		// TODO: Return score display position in canvas space
		return null;
	}

	getTilePlaySource(_tileId: string, _playerId: string): { x: number; y: number } | null {
		// TODO: Return tile source position in canvas space
		return null;
	}

	getTilePlayTarget(_tileId: string): { x: number; y: number } | null {
		// TODO: Return board tile position in canvas space
		return null;
	}
}

/**
 * PixiJS Animation Renderer
 *
 * Renders all game animations using PixiJS sprites and graphics
 * instead of DOM overlays. Subscribe this to the controller's event bus:
 *
 *   controller.events.onAny((event) => pixiRenderer.handleEvent(event));
 */
export class PixiAnimationRenderer implements Partial<AnimationRenderer> {
	// ── Sprite management ──
	private tiles = new Map<string, unknown>(); // Map<TileId, PIXI.Sprite>
	private stamps = new Map<string, unknown>();
	private particles: unknown[] = [];

	// ── Renderer Methods ──

	reset(): void {
		this.tiles.clear();
		this.stamps.clear();
		this.particles = [];
		// TODO: Remove all children from stage
	}

	playMove(_data: FlyingTileAnimData, _tile: Domino, _playerId: string, _side: 'left' | 'right'): void {
		// TODO: Create flying sprite, tween from data.fromX/Y to data.toX/Y
		// Example:
		//   const sprite = new PIXI.Sprite(texture);
		//   sprite.position.set(data.fromX, data.fromY);
		//   app.stage.addChild(sprite);
		//   gsap.to(sprite, { x: data.toX, y: data.toY, ... });
	}

	showStamp(_data: StampAnimData): void {
		// TODO: Create PIXI.Text or Graphics stamp at center
	}

	hideStamp(_id: string): void {
		// TODO: Remove stamp from stage
	}

	showFloatingPoints(_data: FloatingPointsAnimData): void {
		// TODO: Create floating +points text, tween to score target
	}

	hideFloatingPoints(_id: string): void {
		// TODO: Remove points text
	}

	showConfetti(_data: ConfettiAnimData): void {
		// TODO: Create particle sprites with physics
	}

	hideConfetti(_id: string): void {
		// TODO: Remove confetti particles
	}

	showScreenFlash(_data: ScreenFlashAnimData): void {
		// TODO: Create full-screen color overlay
	}

	hideScreenFlash(_id: string): void {
		// TODO: Remove flash overlay
	}

	showSparkle(_data: SparkleAnimData): void {
		// TODO: Create sparkle particle burst
	}

	hideSparkle(_id: string): void {
		// TODO: Remove sparkle particles
	}

	showDeal(_data: DealAnimData): void {
		// TODO: Animate cards from deck to hand positions
	}

	hideDeal(_id: string): void {
		// TODO: Remove deal sprites
	}

	showPass(_data: PassAnimData): void {
		// TODO: Avatar pulse + PASS badge animation
	}

	hidePass(_id: string): void {
		// TODO: Remove pass badge
	}

	showTurnHighlight(_data: TurnHighlightAnimData): void {
		// TODO: Glow ring on active player's avatar
	}

	hideTurnHighlight(_id: string): void {
		// TODO: Remove glow ring
	}

	hideBoardTile(_tileId: string): void {
		// TODO: Hide board tile sprite
	}

	showBoardTile(_tileId: string): void {
		// TODO: Show board tile sprite
	}

	updateScores(_scores: Record<string, number>): void {
		// TODO: Update score display sprites
	}
}
