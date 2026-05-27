import type { GameState, Move } from '../types';
import { GameManager } from '../game';
import { generateLegalMoves } from '../moves';
import { createSeededRng } from '../utils';
import { evaluateResult, scoreMoveForPlayout, summarizeMove } from './heuristics';

const DEFAULT_MAX_PLAYOUT_TURNS = 120;

export function choosePlayoutMove(
	state: GameState,
	legalMoves: Move[],
	rng = createSeededRng('gaple-ai')
): Move {
	const rankedMoves = [...legalMoves]
		.map((move) => ({ move, score: scoreMoveForPlayout(state, move) + rng.next() * 3 }))
		.sort((a, b) => b.score - a.score);

	const candidateCount = Math.min(3, rankedMoves.length);
	return rankedMoves[Math.floor(rng.next() * candidateCount)].move;
}

export function playout(
	simulatedState: GameState,
	aiPlayerId: string,
	rng = createSeededRng('gaple-ai'),
	maxPlayoutTurns = DEFAULT_MAX_PLAYOUT_TURNS
): number {
	const simManager = new GameManager(simulatedState.players.map((player) => player.name));
	simManager.state = simulatedState;

	let safetyLimit = maxPlayoutTurns;
	while (!simManager.state.result && safetyLimit > 0) {
		safetyLimit--;
		const currentPlayer = simManager.currentPlayer;
		const legalMoves = generateLegalMoves(simManager.state, currentPlayer.id);

		if (legalMoves.length > 0) {
			const move = choosePlayoutMove(simManager.state, legalMoves, rng);
			if (!simManager.nextTurn(move.playerId, move.tileId, move.side)) {
				simManager.passTurn(currentPlayer.id);
			}
		} else {
			simManager.passTurn(currentPlayer.id);
		}
	}

	return evaluateResult(simManager.state, aiPlayerId);
}

export function createPlayoutSummary(state: GameState, move: Move): string {
	return summarizeMove(state, move);
}
