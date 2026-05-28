import type { GameState } from '../types';

export interface TranspositionEntry {
	value: number;
	visits: number;
	updatedAt: number;
}

function tileKey(tile: { left: number; right: number }): string {
	return `${Math.min(tile.left, tile.right)}:${Math.max(tile.left, tile.right)}`;
}

export function hashGameState(state: GameState): string {
	const board = state.board.playedTiles.map((tile) => tileKey(tile)).join('|');
	const hands = state.players
		.map((player) => `${player.id}:${player.hand.map((tile) => tileKey(tile)).join(',')}`)
		.join(';');
	const drawPile = state.drawPile.map((tile) => tileKey(tile)).join(',');

	return [
		state.turnIndex,
		state.seed,
		state.board.leftEnd ?? 'n',
		state.board.rightEnd ?? 'n',
		state.board.initialTileIndex,
		board,
		hands,
		drawPile,
		state.result?.winnerId ?? 'none',
		state.result?.reason ?? 'open'
	].join('|');
}

export function createTranspositionTable() {
	return new Map<string, TranspositionEntry>();
}
