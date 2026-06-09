/**
 * PixiPositionResolver — provides canvas-space coordinates for the
 * animation controller when using PixiJS rendering.
 *
 * This replaces the DOM-based position resolvers in GameArea.
 * It returns positions relative to the PixiJS canvas, mapped from
 * the board's coordinate system (which uses the same TILE_W/TILE_H
 * values as the DOM layout).
 *
 * Since the board is centered at (0, 0) in the board layout system,
 * and the PixiJS canvas shows the board with a camera transform,
 * the position resolver needs to account for:
 *   1. The camera scale
 *   2. The camera offset
 *   3. The board's center position on screen
 */

import type { PositionResolver, Vec2 } from '$lib/animation/renderer';

export interface CameraState {
	scale: number;
	offsetX: number;
	offsetY: number;
}

export class PixiPositionResolver implements PositionResolver {
	private camera: CameraState = { scale: 1, offsetX: 0, offsetY: 0 };
	private canvasRect = { x: 0, y: 0, width: 800, height: 600 };

	/** Update the camera state (call from GameArea when camera changes). */
	updateCamera(camera: CameraState) {
		this.camera = camera;
	}

	/** Update the canvas bounding rect. */
	updateCanvasRect(rect: { x: number; y: number; width: number; height: number }) {
		this.canvasRect = rect;
	}

	/** Convert board-layout coordinates to screen-space. */
	private boardToScreen(boardX: number, boardY: number): Vec2 {
		const { scale, offsetX, offsetY } = this.camera;
		// Board layout coords → screen coords with camera transform
		const screenX = this.canvasRect.x + this.canvasRect.width / 2 + (boardX + offsetX) * scale;
		const screenY = this.canvasRect.y + this.canvasRect.height / 2 + (boardY + offsetY) * scale;
		return { x: screenX, y: screenY };
	}

	/** Get the center of the canvas in screen-space. */
	getBoardCenter(): Vec2 {
		return {
			x: this.canvasRect.x + this.canvasRect.width / 2,
			y: this.canvasRect.y + this.canvasRect.height / 2
		};
	}

	// ── PositionResolver Implementation ──
	// These return screen-space positions that match what the
	// DOM-based resolvers return, so the controller gets consistent values.

	getHandCenter(_playerId: string): Vec2 | null {
		// In PixiJS mode, hands are still DOM elements, so we can fall back
		// to the DOM resolver for hand/avatar positions.
		return null;
	}

	getAvatarCenter(_playerId: string): Vec2 | null {
		return null;
	}

	getScoreTarget(_playerId: string): Vec2 | null {
		// Score targets are DOM elements
		return null;
	}

	getTilePlaySource(tileId: string, _playerId: string): Vec2 | null {
		// Board tile positions are in the layout system
		// The source is the player's hand (DOM), so return null to fall back
		return null;
	}

	getTilePlayTarget(tileId: string): Vec2 | null {
		// Board tile positions come from layout
		// For now, return null to fall back to board center
		return null;
	}
}
