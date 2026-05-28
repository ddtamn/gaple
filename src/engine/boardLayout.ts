import type { Domino } from './types';

const SNAKE_ROW_LENGTH = 4;

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

type Direction = 'E' | 'S' | 'W' | 'N';

// Right side snakes out to the right and spirals downwards (South)
function getRightSideDirection(offset: number, rowLength: number): Direction {
	const runIndex = Math.floor((offset - 1) / (rowLength + 1));
	const posInRun = (offset - 1) % (rowLength + 1);
	if (posInRun < rowLength) {
		return runIndex % 2 === 0 ? 'E' : 'W';
	} else {
		return 'S'; // Turn corner downwards
	}
}

// Left side snakes out to the left and spirals upwards (North)
function getLeftSideDirection(offset: number, rowLength: number): Direction {
	const runIndex = Math.floor((offset - 1) / (rowLength + 1));
	const posInRun = (offset - 1) % (rowLength + 1);
	if (posInRun < rowLength) {
		return runIndex % 2 === 0 ? 'W' : 'E';
	} else {
		return 'N'; // Turn corner upwards
	}
}

function getTilePlacement(
	offset: number,
	side: 'left' | 'right',
	prevX: number,
	prevY: number,
	prevW: number,
	prevH: number,
	prevDir: Direction,
	prevIsCrosswise: boolean,
	isBalak: boolean,
	TILE_W: number,
	TILE_H: number,
	GAP: number
) {
	const currDir =
		side === 'right'
			? getRightSideDirection(offset, SNAKE_ROW_LENGTH)
			: getLeftSideDirection(offset, SNAKE_ROW_LENGTH);

	// A Balak only sits cross-wise if it is continuing the exact same direction.
	// If it lands on a corner turn, it acts like a normal tile parallel to the new direction
	// so that its dots can properly attach to the long edge of the previous tile.
	const isCrosswise = isBalak && currDir === prevDir;

	let rotation = 0;
	if (isCrosswise) {
		rotation = currDir === 'E' || currDir === 'W' ? 90 : 0;
	} else {
		// Treat as normal tile orientation
		if (side === 'right') {
			switch (currDir) {
				case 'E':
					rotation = 0;
					break;
				case 'S':
					rotation = 90;
					break;
				case 'W':
					rotation = 180;
					break;
				case 'N':
					rotation = 270;
					break;
			}
		} else {
			switch (currDir) {
				case 'W':
					rotation = 0;
					break;
				case 'N':
					rotation = 90;
					break;
				case 'E':
					rotation = 180;
					break;
				case 'S':
					rotation = 270;
					break;
			}
		}
	}

	// Compute physical dimensions of the tile after rotation
	const isVertical = rotation % 180 !== 0;
	const curW = isVertical ? TILE_H : TILE_W;
	const curH = isVertical ? TILE_W : TILE_H;

	let cx = prevX;
	let cy = prevY;

	if (prevDir === currDir) {
		// Straight flow connection
		if (currDir === 'E') {
			cx = prevX + prevW / 2 + curW / 2 + GAP;
			cy = prevY;
		} else if (currDir === 'W') {
			cx = prevX - prevW / 2 - curW / 2 - GAP;
			cy = prevY;
		} else if (currDir === 'S') {
			cx = prevX;
			cy = prevY + prevH / 2 + curH / 2 + GAP;
		} else if (currDir === 'N') {
			cx = prevX;
			cy = prevY - prevH / 2 - curH / 2 - GAP;
		}
	} else {
		// Corner Turn - Calculate the exact center of the "Exit Square" to form an L-shape
		let EX = prevX;
		let EY = prevY;
		const halfSquare = Math.min(TILE_W, TILE_H) / 2;

		if (prevDir === 'E') EX = prevIsCrosswise ? prevX : prevX + prevW / 2 - halfSquare;
		else if (prevDir === 'W') EX = prevIsCrosswise ? prevX : prevX - prevW / 2 + halfSquare;
		else if (prevDir === 'S') EY = prevIsCrosswise ? prevY : prevY + prevH / 2 - halfSquare;
		else if (prevDir === 'N') EY = prevIsCrosswise ? prevY : prevY - prevH / 2 + halfSquare;

		// Apply exact alignment based on the corner turn direction
		if (currDir === 'S' || currDir === 'N') {
			cx = EX; // Align horizontally with the exit square
			cy =
				currDir === 'S' ? prevY + prevH / 2 + curH / 2 + GAP : prevY - prevH / 2 - curH / 2 - GAP;
		} else {
			cy = EY; // Align vertically with the exit square
			cx =
				currDir === 'E' ? prevX + prevW / 2 + curW / 2 + GAP : prevX - prevW / 2 - curW / 2 - GAP;
		}
	}

	return { x: cx, y: cy, rotation, w: curW, h: curH, dir: currDir, isCrosswise };
}

function getSideEndState(
	tiles: Domino[],
	initialTileIndex: number,
	side: 'left' | 'right',
	TILE_W: number,
	TILE_H: number,
	GAP: number
) {
	const initialTile = tiles[initialTileIndex];
	const initialIsBalak = initialTile.left === initialTile.right;

	let state = {
		prevX: 0,
		prevY: 0,
		prevW: initialIsBalak ? TILE_H : TILE_W,
		prevH: initialIsBalak ? TILE_W : TILE_H,
		prevDir: (side === 'right' ? 'E' : 'W') as Direction,
		prevIsCrosswise: initialIsBalak, // Initial tile sets the precedent
		count: 0
	};

	if (side === 'right') {
		for (let i = initialTileIndex + 1; i < tiles.length; i++) {
			state.count++;
			const isBalak = tiles[i].left === tiles[i].right;
			const p = getTilePlacement(
				state.count,
				'right',
				state.prevX,
				state.prevY,
				state.prevW,
				state.prevH,
				state.prevDir,
				state.prevIsCrosswise,
				isBalak,
				TILE_W,
				TILE_H,
				GAP
			);
			state = {
				prevX: p.x,
				prevY: p.y,
				prevW: p.w,
				prevH: p.h,
				prevDir: p.dir,
				prevIsCrosswise: p.isCrosswise,
				count: state.count
			};
		}
	} else {
		for (let i = initialTileIndex - 1; i >= 0; i--) {
			state.count++;
			const isBalak = tiles[i].left === tiles[i].right;
			const p = getTilePlacement(
				state.count,
				'left',
				state.prevX,
				state.prevY,
				state.prevW,
				state.prevH,
				state.prevDir,
				state.prevIsCrosswise,
				isBalak,
				TILE_W,
				TILE_H,
				GAP
			);
			state = {
				prevX: p.x,
				prevY: p.y,
				prevW: p.w,
				prevH: p.h,
				prevDir: p.dir,
				prevIsCrosswise: p.isCrosswise,
				count: state.count
			};
		}
	}

	return state;
}

export function calculateBoardLayout(
	tiles: Domino[],
	initialTileIndex: number,
	TILE_W: number = 112,
	TILE_H: number = 56,
	GAP: number = 0
): TilePosition[] {
	if (tiles.length === 0) return [];

	const layoutMap = new Map<number, TilePosition>();
	const initialTile = tiles[initialTileIndex];
	const initialIsBalak = initialTile.left === initialTile.right;

	layoutMap.set(initialTileIndex, {
		...initialTile,
		x: 0,
		y: 0,
		rotation: initialIsBalak ? 90 : 0,
		isBalak: initialIsBalak,
		side: 'center'
	});

	// Calculate Right side layout
	let state = {
		prevX: 0,
		prevY: 0,
		prevW: initialIsBalak ? TILE_H : TILE_W,
		prevH: initialIsBalak ? TILE_W : TILE_H,
		prevDir: 'E' as Direction,
		prevIsCrosswise: initialIsBalak,
		count: 0
	};

	for (let i = initialTileIndex + 1; i < tiles.length; i++) {
		state.count++;
		const isBalak = tiles[i].left === tiles[i].right;
		const p = getTilePlacement(
			state.count,
			'right',
			state.prevX,
			state.prevY,
			state.prevW,
			state.prevH,
			state.prevDir,
			state.prevIsCrosswise,
			isBalak,
			TILE_W,
			TILE_H,
			GAP
		);
		layoutMap.set(i, { ...tiles[i], x: p.x, y: p.y, rotation: p.rotation, isBalak, side: 'right' });
		state.prevX = p.x;
		state.prevY = p.y;
		state.prevW = p.w;
		state.prevH = p.h;
		state.prevDir = p.dir;
		state.prevIsCrosswise = p.isCrosswise;
	}

	// Calculate Left side layout
	state = {
		prevX: 0,
		prevY: 0,
		prevW: initialIsBalak ? TILE_H : TILE_W,
		prevH: initialIsBalak ? TILE_W : TILE_H,
		prevDir: 'W' as Direction,
		prevIsCrosswise: initialIsBalak,
		count: 0
	};

	for (let i = initialTileIndex - 1; i >= 0; i--) {
		state.count++;
		const isBalak = tiles[i].left === tiles[i].right;
		const p = getTilePlacement(
			state.count,
			'left',
			state.prevX,
			state.prevY,
			state.prevW,
			state.prevH,
			state.prevDir,
			state.prevIsCrosswise,
			isBalak,
			TILE_W,
			TILE_H,
			GAP
		);
		layoutMap.set(i, { ...tiles[i], x: p.x, y: p.y, rotation: p.rotation, isBalak, side: 'left' });
		state.prevX = p.x;
		state.prevY = p.y;
		state.prevW = p.w;
		state.prevH = p.h;
		state.prevDir = p.dir;
		state.prevIsCrosswise = p.isCrosswise;
	}

	return tiles.map((_, i) => layoutMap.get(i)!);
}

export function calculateBoardPreviewPosition(
	tiles: Domino[],
	initialTileIndex: number,
	side: 'left' | 'right',
	previewTile: Domino,
	TILE_W: number = 112,
	TILE_H: number = 56,
	GAP: number = 0
): Pick<TilePosition, 'x' | 'y' | 'rotation'> & { side: 'left' | 'right' } {
	if (tiles.length === 0) {
		return { x: 0, y: 0, rotation: previewTile.left === previewTile.right ? 90 : 0, side };
	}

	const state = getSideEndState(tiles, initialTileIndex, side, TILE_W, TILE_H, GAP);
	const isBalak = previewTile.left === previewTile.right;
	const p = getTilePlacement(
		state.count + 1,
		side,
		state.prevX,
		state.prevY,
		state.prevW,
		state.prevH,
		state.prevDir,
		state.prevIsCrosswise,
		isBalak,
		TILE_W,
		TILE_H,
		GAP
	);

	return { x: p.x, y: p.y, rotation: p.rotation, side };
}

export function calculateDropZones(TILE_W: number = 112, TILE_H: number = 56) {
	const BOARD_WIDTH = 900;
	const CENTER = BOARD_WIDTH / 2;
	const ZONE_WIDTH = TILE_W * 2;

	return {
		left: { x: CENTER - ZONE_WIDTH, y: 250, width: ZONE_WIDTH, height: 500, side: 'left' as const },
		right: { x: CENTER, y: 250, width: ZONE_WIDTH, height: 500, side: 'right' as const }
	};
}
