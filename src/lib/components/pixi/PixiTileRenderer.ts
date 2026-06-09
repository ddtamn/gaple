/**
 * PixiTileRenderer — draws domino tiles as PIXI.Graphics.
 * No external textures needed — everything is drawn procedurally.
 */

import { Graphics, Container, Text, type TextStyleOptions } from 'pixi.js';

export interface TileVisualData {
	id: string;
	left: number;
	right: number;
}

/** Dimensions of a rendered tile */
export const TILE_W = 112;
export const TILE_H = 56;

const DOT_COLORS = [0xDC2626, 0xDC2626]; // red-600
const BG_COLOR = 0xF5F5F4; // stone-100
const BORDER_COLOR = 0x44403C; // stone-600
const LINE_COLOR = 0xDC2626; // red-600/35

const DOT_PATTERNS: Record<number, number[]> = {
	0: [0, 0, 0, 0, 0, 0, 0, 0, 0],
	1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
	2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
	3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
	4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
	5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
	6: [1, 0, 1, 1, 0, 1, 1, 0, 1]
};

/**
 * Create a Container with a rendered domino tile.
 * @param tile The tile data (left, right values)
 * @param isVertical Whether the tile is oriented vertically
 * @param size Multiplier for tile size (1 = default)
 * @returns A PIXI.Container with the tile graphics
 */
export function createTileContainer(
	tile: TileVisualData,
	isVertical: boolean,
	size: number = 1
): Container {
	const container = new Container();
	const w = (isVertical ? TILE_H : TILE_W) * size;
	const h = (isVertical ? TILE_W : TILE_H) * size;
	const halfW = w / 2;
	const halfH = h / 2;

	// Background rectangle with border
	const bg = new Graphics();
	bg.roundRect(-halfW, -halfH, w, h, 8 * size)
		.fill(BG_COLOR)
		.stroke({ width: 1, color: BORDER_COLOR });
	container.addChild(bg);

	// Draw the two halves
	const halfHeight = h / 2;
	const dotSize = Math.max(3, 6 * size);
	const padding = Math.max(4, 12 * size);
	const gridSpacing = (halfHeight - padding * 2) / 3;

	// Draw dots for each half
	// For horizontal tiles, dots are rotated 90° to match DominoTile.svelte's CSS
	const dotsOffset = isVertical ? 0 : 2;

	// Top/left half
	const topDots = new Container();
	if (!isVertical) topDots.rotation = Math.PI / 2;
	addDots(topDots, tile.left, isVertical ? -halfHeight / 2 : 0);
	topDots.position.y = -halfHeight / 2;
	container.addChild(topDots);

	// Bottom/right half
	const bottomDots = new Container();
	if (!isVertical) bottomDots.rotation = Math.PI / 2;
	addDots(bottomDots, tile.right, isVertical ? halfHeight / 2 : 0);
	bottomDots.position.y = halfHeight / 2;
	container.addChild(bottomDots);

	// Helper: add dots for a value to a container
	function addDots(target: Container, value: number, _offsetY: number) {
		const pattern = DOT_PATTERNS[value] ?? DOT_PATTERNS[0];
		const centerDotSize = value === 1 ? dotSize * 1.4 : dotSize;

		for (let i = 0; i < 9; i++) {
			if (!pattern[i]) continue;
			const col = i % 3;
			const row = Math.floor(i / 3);
			const dx = (col - 1) * gridSpacing;
			const dy = (row - 1) * gridSpacing;

			const dot = new Graphics();
			const sz = value === 1 && i === 4 ? centerDotSize : dotSize;
			dot.circle(dx, dy, sz / 2).fill(DOT_COLORS[0]);
			target.addChild(dot);
		}
	}

	// Divider line
	const line = new Graphics();
	if (isVertical) {
		line.rect(-w * 0.35, -1, w * 0.7, 2)
			.fill(LINE_COLOR);
	} else {
		line.rect(-1, -h * 0.35, 2, h * 0.7)
			.fill(LINE_COLOR);
	}
	container.addChild(line);

	return container;
}

/**
 * Create a simple dot-count label tile (used for hand card backs).
 */
export function createCardBackTile(size: number = 1): Container {
	const container = new Container();
	const w = TILE_W * size;
	const h = TILE_H * size;

	const bg = new Graphics();
	bg.roundRect(-w / 2, -h / 2, w, h, 8 * size)
		.fill(0x1C1917) // stone-900
		.stroke({ width: 1, color: 0x57534E });
	container.addChild(bg);

	const dot = new Graphics();
	dot.circle(0, 0, 4 * size)
		.fill(0xD97706); // amber-600
	container.addChild(dot);

	return container;
}
