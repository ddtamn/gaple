import type { Domino } from './types';

const createDominoId = (left: number, right: number) => `tile-${Math.min(left, right)}-${Math.max(left, right)}`;

export function createDomino(left: number, right: number): Domino {
	const normalizedLeft = Math.min(left, right);
	const normalizedRight = Math.max(left, right);
	return {
		id: createDominoId(left, right),
		left: normalizedLeft,
		right: normalizedRight
	};
}

export function flipped(tile: Domino): Domino {
	return {
		...tile,
		left: tile.right,
		right: tile.left
	};
}

export function normalizeTile(tile: Domino): Domino {
	return createDomino(tile.left, tile.right);
}

export function isDouble(tile: Domino): boolean {
	return tile.left === tile.right;
}
