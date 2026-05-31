import type { Domino, GameState, Move, TeamId } from '../types';
import { playTile } from '../board';
import { GameManager, calculateHandScore } from '../game';
import { generateLegalMoves } from '../moves';
import { evaluateGameResult } from '../scoring';
import { areTeammates, isTeamMode } from '../teams';

const HUMAN_PLAYER_ID = '0';

export function getMoveTile(state: GameState, move: Move): Domino | null {
	return (
		state.players
			.find((player) => player.id === move.playerId)
			?.hand.find((tile) => tile.id === move.tileId) ?? null
	);
}

export function countMatchingNumbers(
	hand: Domino[],
	leftEnd: number | null,
	rightEnd: number | null
): number {
	return hand.reduce((total, tile) => {
		const matchesLeft = leftEnd !== null && (tile.left === leftEnd || tile.right === leftEnd);
		const matchesRight = rightEnd !== null && (tile.left === rightEnd || tile.right === rightEnd);
		return total + (matchesLeft ? 1 : 0) + (matchesRight ? 1 : 0);
	}, 0);
}

export function getStateAfterMove(state: GameState, move: Move): GameState | null {
	const playerIndex = state.players.findIndex((player) => player.id === move.playerId);
	const player = state.players[playerIndex];
	const tile = getMoveTile(state, move);
	if (!player || !tile) return null;

	const board = playTile(state.board, tile, move.side);
	if (!board) return null;

	return {
		...state,
		board,
		players: state.players.map((item) =>
			item.id === player.id
				? { ...item, hand: item.hand.filter((handTile) => handTile.id !== tile.id) }
				: item
		),
		turnIndex: (playerIndex + 1) % state.players.length
	};
}

export function countLegalMovesForBoard(state: GameState, playerId: string): number {
	return generateLegalMoves(state, playerId).length;
}

export function countEndpointCopies(
	hand: Domino[],
	leftEnd: number | null,
	rightEnd: number | null
): number {
	return hand.reduce((total, tile) => {
		const values = [tile.left, tile.right];
		return total + values.filter((value) => value === leftEnd || value === rightEnd).length;
	}, 0);
}

export function scoreTacticalMove(
	state: GameState,
	move: Move,
	perspectivePlayerId: string
): number {
	const player = state.players.find((item) => item.id === move.playerId);
	const tile = getMoveTile(state, move);
	const nextState = getStateAfterMove(state, move);
	if (!player || !tile || !nextState) return Number.NEGATIVE_INFINITY;

	const remainingHand = nextState.players.find((item) => item.id === move.playerId)?.hand ?? [];
	const nextPlayer = nextState.players[nextState.turnIndex];
	const human = nextState.players.find((item) => item.id === HUMAN_PLAYER_ID);
	const nextPlayerMoves = countLegalMovesForBoard(nextState, nextPlayer.id);
	const humanMoves = human ? countLegalMovesForBoard(nextState, human.id) : 0;
	const ownFutureOptions = countEndpointCopies(
		remainingHand,
		nextState.board.leftEnd,
		nextState.board.rightEnd
	);
	const highRiskOpponent = nextPlayer.id !== perspectivePlayerId && nextPlayer.hand.length <= 2;

	let score = 0;
	score += (tile.left + tile.right) * 2.4;
	score += ownFutureOptions * 8;
	score += remainingHand.length === 0 ? 10_000 : 0;
	score += tile.left === tile.right ? 8 : 0;
	score += nextPlayerMoves === 0 ? 35 : -nextPlayerMoves * 3;
	score += highRiskOpponent && nextPlayerMoves === 0 ? 90 : 0;

	if (human && human.id !== perspectivePlayerId) {
		score += humanMoves === 0 ? 110 : -humanMoves * 7;
		score += human.hand.length <= 2 && humanMoves === 0 ? 140 : 0;
		score += human.hand.length <= 2 && humanMoves > 0 ? -120 : 0;
	}

	// Team-aware heuristics
	if (isTeamMode(state)) {
		const teammate = nextState.players.find(
			(p) => p.id !== perspectivePlayerId && areTeammates(state, perspectivePlayerId, p.id)
		);
		if (teammate) {
			// Prefer moves that keep teammate's options open
			const teammateMoves = countLegalMovesForBoard(nextState, teammate.id);
			score += teammateMoves * 6;

			// If teammate is close to winning, help them
			if (teammate.hand.length <= 2) {
				score += 20;
			}
		}
	}

	const bestOpponentHandSize = Math.min(
		...nextState.players
			.filter((item) => item.id !== perspectivePlayerId)
			.map((item) => item.hand.length)
	);
	score += (bestOpponentHandSize - remainingHand.length) * 12;

	return score;
}

export function scoreMoveForPlayout(state: GameState, move: Move): number {
	const player = state.players.find((item) => item.id === move.playerId);
	const tile = getMoveTile(state, move);
	if (!player || !tile) return Number.NEGATIVE_INFINITY;

	const nextState = getStateAfterMove(state, move);
	if (!nextState) return Number.NEGATIVE_INFINITY;

	const nextBoard = nextState.board;
	const remainingHand = nextState.players.find((item) => item.id === player.id)?.hand ?? [];
	const pipScore = tile.left + tile.right;
	const futureOptions = countMatchingNumbers(remainingHand, nextBoard.leftEnd, nextBoard.rightEnd);
	const tacticalScore = scoreTacticalMove(state, move, player.id);

	return (
		tacticalScore * 0.45 +
		pipScore * 2 +
		futureOptions * 2 +
		(tile.left === tile.right ? 5 : 0) +
		(remainingHand.length === 0 ? 500 : 0)
	);
}

export function evaluateResult(state: GameState, aiPlayerId: string, teamId?: TeamId): number {
	return evaluateGameResult(state, aiPlayerId, teamId);
}

export function summarizeMove(state: GameState, move: Move): string {
	const tile = getMoveTile(state, move);
	return tile ? `${tile.left}-${tile.right} ke ${move.side}` : `${move.tileId} ke ${move.side}`;
}
