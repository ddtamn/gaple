import type { Domino, Player } from './types';
import { normalizeTile } from './domino';

export function createPlayer(id: string, name: string): Player {
	return {
		id,
		name,
		hand: []
	};
}

export function sortHand(hand: Domino[]): Domino[] {
	return [...hand].sort((a, b) => {
		const totalA = a.left + a.right;
		const totalB = b.left + b.right;

		if (totalA !== totalB) {
			return totalB - totalA;
		}

		return Math.max(b.left, b.right) - Math.max(a.left, a.right);
	});
}

export function receiveTiles(hand: Domino[], tiles: Domino[]): Domino[] {
	const normalized = tiles.map(normalizeTile);
	return sortHand([...hand, ...normalized]);
}

export function getTile(hand: Domino[], tileId: string): Domino | undefined {
	return hand.find((tile) => tile.id === tileId);
}

export function removeTile(hand: Domino[], tileId: string): { hand: Domino[]; tile: Domino } {
	const tile = getTile(hand, tileId);
	if (!tile) {
		throw new Error(`Tile ${tileId} not found in hand`);
	}

	return {
		hand: hand.filter((item) => item.id !== tileId),
		tile
	};
}
