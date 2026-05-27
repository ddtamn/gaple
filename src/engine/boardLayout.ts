//boardlayout.ts
import type { Domino } from './types';

const STRAIGHT_TILES_BEFORE_TURN = 3;

export interface TilePosition {
	id: string;
	left: number;
	right: number;
	x: number;
	y: number;
	rotation: number;
	isBalak: boolean;
	side: 'left' | 'center' | 'right';
}

function positionTileOnArm(
	offsetFromInitial: number,
	side: 'left' | 'right',
	TILE_W: number,
	TILE_H: number,
	GAP: number
): Pick<TilePosition, 'x' | 'y' | 'rotation'> {
	const horizontalStep = TILE_W + GAP;
	const verticalStep = TILE_W + GAP;
	const turnY = TILE_H + GAP;
	const rowY = turnY + verticalStep;
	const direction = side === 'right' ? 1 : -1;
	const verticalDirection = side === 'right' ? 1 : -1;

	if (offsetFromInitial <= STRAIGHT_TILES_BEFORE_TURN) {
		return {
			x: direction * horizontalStep * offsetFromInitial,
			y: 0,
			rotation: 0
		};
	}

	if (offsetFromInitial <= STRAIGHT_TILES_BEFORE_TURN + 2) {
		const verticalOffset = offsetFromInitial - STRAIGHT_TILES_BEFORE_TURN;
		return {
			x: direction * horizontalStep * STRAIGHT_TILES_BEFORE_TURN,
			y: verticalDirection * (turnY + verticalStep * (verticalOffset - 1)),
			rotation: 90
		};
	}

	const rowOffset = offsetFromInitial - (STRAIGHT_TILES_BEFORE_TURN + 2);
	return {
		x: direction * horizontalStep * (STRAIGHT_TILES_BEFORE_TURN - rowOffset),
		y: verticalDirection * rowY,
		rotation: 180
	};
}

/**
 * Calculates bidirectional layout for board tiles
 * LEFT TILES ← INITIAL TILE → RIGHT TILES
 * 
 * @param tiles - All played tiles in order [leftTiles..., initialTile, rightTiles...]
 * @param initialTileIndex - Index of the initial tile in the array
 * @param TILE_W - Width of horizontal tile
 * @param TILE_H - Height of horizontal tile
 * @param GAP - Gap between tiles
 * @returns Array of tile positions with x, y, rotation
 */
export function calculateBoardLayout(
	tiles: Domino[],
	initialTileIndex: number,
	TILE_W: number = 112,
	TILE_H: number = 56,
	GAP: number = 4
): TilePosition[] {
	if (tiles.length === 0) return [];

	const layout: TilePosition[] = [];

	for (let i = 0; i < tiles.length; i++) {
		const tile = tiles[i];
		const isBalak = tile.left === tile.right;

		let side: 'left' | 'center' | 'right';
		let x = 0;
		let y = 0;
		let rotation = 0;

		if (i === initialTileIndex) {
			// Initial tile stays at center
			side = 'center';
			x = 0;
			y = 0;
			rotation = 0;
		} else if (i < initialTileIndex) {
			// Left tiles
			side = 'left';
			const offsetFromInitial = initialTileIndex - i;
			({ x, y, rotation } = positionTileOnArm(offsetFromInitial, side, TILE_W, TILE_H, GAP));
		} else {
			// Right tiles
			side = 'right';
			const offsetFromInitial = i - initialTileIndex;
			({ x, y, rotation } = positionTileOnArm(offsetFromInitial, side, TILE_W, TILE_H, GAP));
		}

		layout.push({
			...tile,
			x,
			y,
			rotation,
			isBalak,
			side
		});
	}

	return layout;
}

export function calculateBoardPreviewPosition(
	tiles: Domino[],
	initialTileIndex: number,
	side: 'left' | 'right',
	TILE_W: number = 112,
	TILE_H: number = 56,
	GAP: number = 4
): Pick<TilePosition, 'x' | 'y' | 'rotation'> & { side: 'left' | 'right' } {
	if (tiles.length === 0) {
		return {
			x: 0,
			y: 0,
			rotation: 0,
			side
		};
	}

	const offsetFromInitial =
		side === 'left' ? initialTileIndex + 1 : tiles.length - initialTileIndex;
	const position = positionTileOnArm(offsetFromInitial, side, TILE_W, TILE_H, GAP);

	return {
		...position,
		side
	};
}

/**
 * Calculates drop zones for placing tiles on left or right
 * @param TILE_W - Width of horizontal tile
 * @param TILE_H - Height of horizontal tile
 * @returns Object with left and right drop zone bounds
 */
export function calculateDropZones(TILE_W: number = 112, TILE_H: number = 56) {
	const BOARD_WIDTH = 900; // From +page.svelte
	const CENTER = BOARD_WIDTH / 2;
	const ZONE_WIDTH = TILE_W * 2; // Zone width for drop detection

	return {
		left: {
			x: CENTER - ZONE_WIDTH,
			y: 250,
			width: ZONE_WIDTH,
			height: 500,
			side: 'left' as const
		},
		right: {
			x: CENTER,
			y: 250,
			width: ZONE_WIDTH,
			height: 500,
			side: 'right' as const
		}
	};
}
