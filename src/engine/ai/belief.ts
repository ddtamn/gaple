import type { Domino } from '../types';

export interface OpponentBelief {
	likelyMissing: Set<number>;
	likelyPresent: Set<number>;
	passHistory: number[];
	aggression: number;
	defensive: number;
}

export function createBelief(): OpponentBelief {
	return {
		likelyMissing: new Set(),
		likelyPresent: new Set(),
		passHistory: [],
		aggression: 0.5,
		defensive: 0.5
	};
}

export function updateBeliefFromPass(belief: OpponentBelief, openValue: number): OpponentBelief {
	belief.passHistory = [...belief.passHistory, openValue].slice(-8);
	belief.likelyMissing.add(openValue);
	belief.likelyPresent.delete(openValue);
	return belief;
}

export function tileWeight(tile: Domino, belief: OpponentBelief): number {
	const total = tile.left + tile.right;
	const containsOpen = belief.passHistory.some(
		(value) => value === tile.left || value === tile.right
	);
	const hasHighPips = total >= 6;
	const penalty = containsOpen ? 0.35 : 0;
	const bonus = hasHighPips ? 0.15 : 0;
	return 1 - penalty + bonus;
}

export function biasTileWeights(tiles: Domino[], belief: OpponentBelief): Domino[] {
	return tiles
		.map((tile) => ({ tile, weight: tileWeight(tile, belief) }))
		.sort((a, b) => b.weight - a.weight)
		.map(({ tile }) => tile);
}
