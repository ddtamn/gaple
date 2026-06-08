import type { GameState, Move } from './types';
import { getTile } from './player';
import { playTile } from './board';

export function isValidMove(state: GameState, move: Move): boolean {
	if (state.result) {
		return false;
	}

	const currentPlayer = state.players[state.turnIndex];
	if (currentPlayer.id !== move.playerId) {
		return false;
	}

	const tile = getTile(currentPlayer.hand, move.tileId);
	if (!tile) {
		return false;
	}

	return playTile(state.board, tile, move.side) !== null;
}

export function generateLegalMoves(state: GameState, playerId: string): Move[] {
	const player = state.players.find((item) => item.id === playerId);
	if (!player || state.result) {
		return [];
	}

	return player.hand.flatMap((tile) => {
		const possibleSides: Move['side'][] = ['left', 'right'];
		return possibleSides
			.map((side) => ({
				playerId,
				tileId: tile.id,
				side
			}))
			.filter((move) => playTile(state.board, tile, move.side) !== null);
	});
}

export function hasLegalMove(state: GameState, playerId: string): boolean {
	return generateLegalMoves(state, playerId).length > 0;
}

export function createMoveEvent(move: Move, tile?: { left: number; right: number }) {
	return {
		type: 'MOVE_PLAYED' as const,
		payload: { ...move, ...(tile ? { tile } : {}) } as unknown as Record<string, unknown>,
		timestamp: Date.now()
	};
}

export function createPassEvent(playerId: string) {
	return {
		type: 'PLAYER_PASS' as const,
		payload: { playerId },
		timestamp: Date.now()
	};
}

export function createGameOverEvent(playerId: string, reason = 'empty-hand') {
	return {
		type: 'GAME_OVER' as const,
		payload: { playerId, reason },
		timestamp: Date.now()
	};
}

export function createPointsAwardedEvent(
	playerId: string,
	points: number,
	reason: string,
	targetPlayerId?: string
) {
	return {
		type: 'POINTS_AWARDED' as const,
		payload: { playerId, points, reason, targetPlayerId },
		timestamp: Date.now()
	};
}

export function createRoundScoredEvent(
	winnerId: string,
	points: number,
	winType: string,
	reason: string
) {
	return {
		type: 'ROUND_SCORED' as const,
		payload: { winnerId, points, winType, reason },
		timestamp: Date.now()
	};
}
