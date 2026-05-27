import type { GameState, Move } from './types';
import { generateLegalMoves } from './moves';

export function selectAiMove(state: GameState, playerId: string): Move | null {
	const legalMoves = generateLegalMoves(state, playerId);
	if (legalMoves.length === 0) return null;
	return legalMoves[Math.floor(Math.random() * legalMoves.length)];
}
