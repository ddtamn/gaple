import type { GameState, Move } from '../types';
import { generateLegalMoves } from '../moves';
import { getMoveTile, getStateAfterMove } from './heuristics';

export type AiPersona = 'balanced' | 'aggressive' | 'defensive';

export interface PersonaProfile {
	name: AiPersona;
	seedSuffix: string;
	iterationsMultiplier: number;
}

export function normalizePersona(persona?: string): AiPersona {
	if (persona === 'aggressive' || persona === 'defensive') {
		return persona;
	}

	return 'balanced';
}

export function getPersonaProfile(persona: AiPersona): PersonaProfile {
	switch (persona) {
		case 'aggressive':
			return {
				name: 'aggressive',
				seedSuffix: 'aggro',
				iterationsMultiplier: 1.15
			};
		case 'defensive':
			return {
				name: 'defensive',
				seedSuffix: 'shield',
				iterationsMultiplier: 0.95
			};
		default:
			return {
				name: 'balanced',
				seedSuffix: 'balanced',
				iterationsMultiplier: 1
			};
	}
}

function getMovePressure(state: GameState, move: Move) {
	const nextState = getStateAfterMove(state, move);
	if (!nextState) {
		return {
			tilePips: 0,
			nextOpponentMoves: 0,
			ownRemaining: 0
		};
	}

	const tile = getMoveTile(state, move);
	const ownRemaining = nextState.players.find((player) => player.id === move.playerId)?.hand.length ?? 0;
	const nextOpponent = nextState.players[nextState.turnIndex];
	const nextOpponentMoves = nextOpponent ? generateLegalMoves(nextState, nextOpponent.id).length : 0;

	return {
		tilePips: tile ? tile.left + tile.right : 0,
		nextOpponentMoves,
		ownRemaining
	};
}

export function applyPersonaScoreBias(
	persona: AiPersona,
	state: GameState,
	move: Move,
	score: number
): number {
	const { tilePips, nextOpponentMoves, ownRemaining } = getMovePressure(state, move);

	switch (persona) {
		case 'aggressive':
			return (
				score +
				tilePips * 0.85 +
				(ownRemaining === 0 ? 120 : 0) +
				(nextOpponentMoves === 0 ? 20 : 0) +
				(ownRemaining <= 2 ? 10 : 0)
			);
		case 'defensive':
			return (
				score +
				(nextOpponentMoves === 0 ? 90 : 0) +
				(ownRemaining <= 2 ? 30 : 0) -
				tilePips * 0.35 -
				Math.max(0, 4 - ownRemaining) * 4
			);
		default:
			return score;
	}
}
