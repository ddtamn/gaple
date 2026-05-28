import type { Board, Domino, Side } from './types';
import { flipped } from './domino';

export function createBoard(requiresStarterTile = true): Board {
	return {
		playedTiles: [],
		leftEnd: null,
		rightEnd: null,
		initialTileIndex: 0,
		requiresStarterTile
	};
}

function isStarterTile(tile: Domino): boolean {
	return tile.left === 3 && tile.right === 3;
}

export function canPlayTile(board: Board, tile: Domino): boolean {
	if (board.playedTiles.length === 0) {
		return !board.requiresStarterTile || isStarterTile(tile);
	}

	return (
		[board.leftEnd, board.rightEnd].includes(tile.left) ||
		[board.leftEnd, board.rightEnd].includes(tile.right)
	);
}

export function orientTileForSide(board: Board, tile: Domino, side: Side): Domino | null {
	if (board.playedTiles.length === 0) {
		return tile;
	}

	if (side === 'left') {
		if (tile.right === board.leftEnd) {
			return tile;
		}
		if (tile.left === board.leftEnd) {
			return flipped(tile);
		}
	}

	if (side === 'right') {
		if (tile.left === board.rightEnd) {
			return tile;
		}
		if (tile.right === board.rightEnd) {
			return flipped(tile);
		}
	}

	return null;
}

export function playTile(board: Board, tile: Domino, side: Side): Board | null {
	if (board.playedTiles.length === 0 && board.requiresStarterTile && !isStarterTile(tile)) {
		return null;
	}

	const placedTile = orientTileForSide(board, tile, side);
	if (!placedTile) {
		return null;
	}

	const playedTiles = [...board.playedTiles];
	let leftEnd = board.leftEnd;
	let rightEnd = board.rightEnd;
	let initialTileIndex = board.initialTileIndex;

	if (playedTiles.length === 0) {
		playedTiles.push(placedTile);
		leftEnd = placedTile.left;
		rightEnd = placedTile.right;
		initialTileIndex = 0;
	} else if (side === 'left') {
		playedTiles.unshift(placedTile);
		leftEnd = placedTile.left;
		initialTileIndex++; // Shift initial index when prepending
	} else {
		playedTiles.push(placedTile);
		rightEnd = placedTile.right;
	}

	return {
		playedTiles,
		leftEnd,
		rightEnd,
		initialTileIndex,
		requiresStarterTile: board.requiresStarterTile
	};
}
