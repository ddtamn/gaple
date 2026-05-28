import type { GameState, Move } from '../types';
import { GameManager, calculateHandScore } from '../game';
import { generateLegalMoves } from '../moves';
import { createTranspositionTable, hashGameState } from './cache';

const ENDGAME_TILE_LIMIT = 8;
const MAX_ENDGAME_DEPTH = 10;

function countRemainingTiles(state: GameState): number {
	return (
		state.players.reduce((total, player) => total + player.hand.length, 0) + state.drawPile.length
	);
}

function scoreEndgameState(state: GameState, playerId: string): number {
	if (state.result) {
		const aiScore = state.result.scores[playerId] ?? 99;
		const bestOpponentScore = Math.min(
			...state.players
				.filter((item) => item.id !== playerId)
				.map((item) => state.result?.scores[item.id] ?? 99)
		);
		const margin = bestOpponentScore - aiScore;
		return state.result.winnerId === playerId ? 10_000 + margin : -10_000 + margin;
	}

	const aiScore = state.players.find((player) => player.id === playerId)?.hand
		? calculateHandScore(state.players.find((player) => player.id === playerId)!)
		: 99;
	const bestOpponentScore = Math.min(
		...state.players.filter((item) => item.id !== playerId).map((item) => calculateHandScore(item))
	);

	return bestOpponentScore - aiScore;
}

function cloneState(state: GameState): GameState {
	const manager = new GameManager(
		state.players.map((player) => player.name),
		state.seed
	);
	manager.state = state;
	return manager.cloneState();
}

function applyMove(state: GameState, move: Move): GameState {
	const manager = new GameManager(
		state.players.map((player) => player.name),
		state.seed
	);
	manager.state = cloneState(state);
	if (!manager.nextTurn(move.playerId, move.tileId, move.side)) {
		manager.passTurn(move.playerId);
	}
	return manager.state;
}

function minimax(
	state: GameState,
	playerId: string,
	depth: number,
	alpha: number,
	beta: number,
	cache = createTranspositionTable()
): number {
	const memoKey = `${hashGameState(state)}:${depth}:${playerId}`;
	const cached = cache.get(memoKey);
	if (cached) {
		return cached.value;
	}

	if (state.result || depth >= MAX_ENDGAME_DEPTH) {
		const value = scoreEndgameState(state, playerId);
		cache.set(memoKey, { value, visits: 1, updatedAt: Date.now() });
		return value;
	}

	const currentPlayer = state.players[state.turnIndex];
	const legalMoves = generateLegalMoves(state, currentPlayer.id);

	if (legalMoves.length === 0) {
		const passManager = new GameManager(
			state.players.map((player) => player.name),
			state.seed
		);
		passManager.state = cloneState(state);
		passManager.passTurn(currentPlayer.id);
		const value = minimax(passManager.state, playerId, depth + 1, alpha, beta, cache);
		cache.set(memoKey, { value, visits: 1, updatedAt: Date.now() });
		return value;
	}

	let value: number;
	if (currentPlayer.id === playerId) {
		value = Number.NEGATIVE_INFINITY;
		for (const move of legalMoves) {
			const nextState = applyMove(state, move);
			value = Math.max(value, minimax(nextState, playerId, depth + 1, alpha, beta, cache));
			alpha = Math.max(alpha, value);
			if (beta <= alpha) {
				break;
			}
		}
	} else {
		value = Number.POSITIVE_INFINITY;
		for (const move of legalMoves) {
			const nextState = applyMove(state, move);
			value = Math.min(value, minimax(nextState, playerId, depth + 1, alpha, beta, cache));
			beta = Math.min(beta, value);
			if (beta <= alpha) {
				break;
			}
		}
	}

	cache.set(memoKey, { value, visits: 1, updatedAt: Date.now() });
	return value;
}

export function shouldUseEndgameSolver(state: GameState, playerId: string): boolean {
	if (state.result) {
		return false;
	}

	const totalRemaining = countRemainingTiles(state);
	const player = state.players.find((item) => item.id === playerId);

	return totalRemaining <= ENDGAME_TILE_LIMIT || (player?.hand.length ?? 99) <= 2;
}

export function solveEndgameMove(state: GameState, playerId: string): Move | null {
	if (!shouldUseEndgameSolver(state, playerId)) {
		return null;
	}

	const legalMoves = generateLegalMoves(state, playerId);
	if (legalMoves.length === 0) {
		return null;
	}

	let bestMove = legalMoves[0];
	let bestScore = Number.NEGATIVE_INFINITY;

	const cache = createTranspositionTable();
	for (const move of legalMoves) {
		const nextState = applyMove(state, move);
		const score = minimax(
			nextState,
			playerId,
			0,
			Number.NEGATIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			cache
		);
		if (score > bestScore) {
			bestScore = score;
			bestMove = move;
		}
	}

	return bestMove;
}
