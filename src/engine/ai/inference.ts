import type { GameState, Move } from '../types';
import { createBelief, updateBeliefFromPass } from './belief';

export function collectOpponentBeliefs(
	state: GameState
): Map<string, ReturnType<typeof createBelief>> {
	const beliefs = new Map<string, ReturnType<typeof createBelief>>();

	state.players.forEach((player) => {
		beliefs.set(player.id, createBelief());
	});

	state.history.forEach((move) => {
		const player = state.players.find((item) => item.id === move.playerId);
		if (!player) return;

		const belief = beliefs.get(move.playerId) ?? createBelief();
		belief.likelyPresent.add(
			move.side === 'left' ? (state.board.leftEnd ?? 0) : (state.board.rightEnd ?? 0)
		);
		beliefs.set(move.playerId, belief);
	});

	return beliefs;
}

export function markPassesAsUnlikely(
	state: GameState,
	beliefs: Map<string, ReturnType<typeof createBelief>>
) {
	state.history.forEach((move) => {
		const belief = beliefs.get(move.playerId);
		if (!belief) return;

		const openValue = move.side === 'left' ? state.board.leftEnd : state.board.rightEnd;
		if (openValue !== null) {
			updateBeliefFromPass(belief, openValue);
		}
	});
}

export function estimateHiddenHandWeight(state: GameState, playerId: string): number {
	const beliefs = collectOpponentBeliefs(state);
	const belief = beliefs.get(playerId) ?? createBelief();
	return belief.passHistory.length > 0 ? 0.7 : 1;
}
