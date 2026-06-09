/**
 * PixiBoardRenderer — manages the PIXI.js scene for the domino board.
 *
 * Responsibilities:
 *   - Renders the board (placed tiles) as PIXI sprites
 *   - Hides tiles that are mid-animation (flying tile overlay shows them)
 *   - Syncs camera transform (scale + offset)
 *
 * BOARD-ONLY: No animation effects. Flying tiles, sparkles, stamps, confetti,
 * etc. remain in the DOM overlay (AnimationLayer) via card-animations.ts.
 *
 * Usage:
 *   const renderer = new PixiBoardRenderer(app.stage);
 *   renderer.syncBoard(layout, controller.hiddenBoardTileIds);
 *   renderer.setCamera(scale, offsetX, offsetY);
 */

import { Container } from 'pixi.js';
import { createTileContainer } from './PixiTileRenderer';

interface BoardTile {
	id: string;
	left: number;
	right: number;
	x: number;
	y: number;
	rotation: number;
	isBalak: boolean;
}

export class PixiBoardRenderer {
	private stage: Container;
	private boardContainer: Container;
	
	/** Map of tileId → PIXI Container for board tiles */
	private boardTiles = new Map<string, Container>();

	constructor(parent: Container) {
		this.stage = parent;
		this.boardContainer = new Container();
		this.stage.addChild(this.boardContainer);
	}

	// ── Board Sync ───────────────────────────────────────────

	/**
	 * Synchronize the board display with the current layout.
	 * Creates/updates/removes tile sprites as needed.
	 *
	 * @param hiddenTileIds Tiles currently mid-animation — hidden from both DOM and PixiJS
	 */
	syncBoard(layout: BoardTile[], hiddenTileIds: Set<string> = new Set()) {
		const currentIds = new Set(layout.map((t) => t.id));
		
		// Remove tiles no longer on board
		for (const [id] of this.boardTiles) {
			if (!currentIds.has(id)) {
				const container = this.boardTiles.get(id)!;
				this.boardContainer.removeChild(container);
				container.destroy({ children: true });
				this.boardTiles.delete(id);
			}
		}

		// Add/update tiles
		for (const tile of layout) {
			const isVertical = tile.rotation % 180 !== 0;
			const rotationDeg = isVertical ? tile.rotation - 90 : tile.rotation;
			
			if (!this.boardTiles.has(tile.id)) {
				const container = createTileContainer(tile, isVertical, 1);
				this.boardContainer.addChild(container);
				this.boardTiles.set(tile.id, container);
			}

			const container = this.boardTiles.get(tile.id)!;
			container.position.set(tile.x, tile.y);
			container.rotation = (rotationDeg * Math.PI) / 180;
			// Hide tiles that are mid-animation (flying tile overlay shows them)
			container.visible = !hiddenTileIds.has(tile.id);
		}
	}

	/**
	 * Set camera transform on the board container.
	 * The board layout coordinates are relative to the board center.
	 * This method transforms them to screen space:
	 *   screenPos = canvasCenter + (boardPos + offset) * scale
	 */
	setCamera(scale: number, offsetX: number, offsetY: number, canvasWidth: number, canvasHeight: number) {
		this.boardContainer.scale.set(scale);
		// Position at canvas center, then apply offset in board-space (multiplied by scale)
		this.boardContainer.position.set(
			canvasWidth / 2 + offsetX * scale,
			canvasHeight / 2 + offsetY * scale
		);
	}

	// ── Cleanup ─────────────────────────────────────────────

	destroy() {
		this.boardTiles.forEach((container) => {
			this.boardContainer.removeChild(container);
			container.destroy({ children: true });
		});
		this.boardTiles.clear();
	}
}
