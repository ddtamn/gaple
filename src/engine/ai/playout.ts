import type { GameState, Move, TeamId } from '../types';
import { GameManager } from '../game';
import { generateLegalMoves } from '../moves';
import { createSeededRng } from '../utils';
import {
	evaluateResult,
	scoreMoveForPlayout,
	summarizeMove,
	getStateAfterMove,
	countMatchingNumbers
} from './heuristics';
import { evaluateGameResult } from '../scoring';

const DEFAULT_MAX_PLAYOUT_TURNS = 120;

function tacticalThreatBonus(state: GameState, move: Move): number {
	const nextState = getStateAfterMove(state, move);
	if (!nextState) return 0;

	const currentPlayer = nextState.players.find((player) => player.id === move.playerId);
	const nextPlayer = nextState.players[nextState.turnIndex];
	const futureFlexibility = countMatchingNumbers(
		currentPlayer?.hand ?? [],
		nextState.board.leftEnd,
		nextState.board.rightEnd
	);
	const opponentMoves = generateLegalMoves(nextState, nextPlayer.id).length;
	const isDouble =
		(state.players
			.find((player) => player.id === move.playerId)
			?.hand.find((tile) => tile.id === move.tileId)?.left ?? 0) ===
		(state.players
			.find((player) => player.id === move.playerId)
			?.hand.find((tile) => tile.id === move.tileId)?.right ?? 0);

	return (
		futureFlexibility * 4 +
		(opponentMoves === 0 ? 18 : 0) +
		(currentPlayer && currentPlayer.hand.length <= 2 ? 16 : 0) +
		(isDouble ? 8 : 0)
	);
}

export function choosePlayoutMove(
	state: GameState,
	legalMoves: Move[],
	rng = createSeededRng('gaple-ai')
): Move {
	const rankedMoves = [...legalMoves]
		.map((move) => ({
			move,
			score: scoreMoveForPlayout(state, move) + tacticalThreatBonus(state, move) + rng.next() * 0.8
		}))
		.sort((a, b) => b.score - a.score);

	const candidateCount = Math.min(2, rankedMoves.length);
	return rankedMoves[Math.floor(rng.next() * candidateCount)].move;
}

export function playout(
	simulatedState: GameState,
	aiPlayerId: string,
	rng = createSeededRng('gaple-ai'),
	maxPlayoutTurns = DEFAULT_MAX_PLAYOUT_TURNS,
	teamId?: TeamId
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

	// Scoring-aware evaluation: uses Gaple scoring rules
	return evaluateGameResult(simManager.state, aiPlayerId, teamId);
}

export function createPlayoutSummary(state: GameState, move: Move): string {
	return summarizeMove(state, move);
}
