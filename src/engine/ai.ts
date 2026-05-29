import type { Domino, GameState, Move } from './types';
import { createDomino } from './domino';
import { GameManager } from './game';
import { generateLegalMoves } from './moves';
import { createSeededRng, shuffle } from './utils';
import { scoreTacticalMove, summarizeMove } from './ai/heuristics';
import { playout } from './ai/playout';
import { biasTileWeights, createBelief } from './ai/belief';
import { estimateHiddenHandWeight } from './ai/inference';
import { shouldUseEndgameSolver, solveEndgameMove } from './ai/endgame';

const ITERATIONS_PER_MOVE = 350;
const MAX_PLAYOUT_TURNS = 120;
const HUMAN_PLAYER_ID = '0';

export interface AiMoveOptions {
	seed?: string;
	iterations?: number;
	maxPlayoutTurns?: number;
}

export interface AiMoveConfig {
	seed: string;
	iterations: number;
	maxPlayoutTurns: number;
}

function getStandardDeck(): Domino[] {
	const deck: Domino[] = [];
	for (let i = 0; i <= 6; i++) {
		for (let j = i; j <= 6; j++) {
			deck.push(createDomino(i, j));
		}
	}
	return deck;
}

function tileKey(tile: Domino): string {
	return `tile-${Math.min(tile.left, tile.right)}-${Math.max(tile.left, tile.right)}`;
}

export function createAiConfig(options: AiMoveOptions = {}): AiMoveConfig {
	return {
		seed: options.seed ?? 'gaple-ai',
		iterations: options.iterations ?? ITERATIONS_PER_MOVE,
		maxPlayoutTurns: options.maxPlayoutTurns ?? MAX_PLAYOUT_TURNS
	};
}

function determinizeState(
	state: GameState,
	aiPlayerId: string,
	rng = createSeededRng('gaple-ai')
): GameState {
	const tempManager = new GameManager(
		state.players.map((player) => player.name),
		state.seed
	);
	tempManager.state = state;
	const clonedState = tempManager.cloneState();

	const knownTiles = new Set<string>();
	clonedState.board.playedTiles.forEach((tile) => knownTiles.add(tileKey(tile)));

	const aiPlayer = clonedState.players.find((player) => player.id === aiPlayerId);
	aiPlayer?.hand.forEach((tile) => knownTiles.add(tileKey(tile)));
	const humanPlayer = clonedState.players.find((player) => player.id === HUMAN_PLAYER_ID);
	humanPlayer?.hand.forEach((tile) => knownTiles.add(tileKey(tile)));

	const availableTiles = getStandardDeck().filter((tile) => !knownTiles.has(tileKey(tile)));
	const belief = createBelief();
	const weightedTiles = biasTileWeights(availableTiles, belief);
	const mysteryTiles = shuffle(weightedTiles, rng);

	clonedState.players.forEach((player) => {
		if (player.id !== aiPlayerId && player.id !== HUMAN_PLAYER_ID) {
			const weight = estimateHiddenHandWeight(state, player.id);
			const size = Math.max(0, Math.min(player.hand.length, mysteryTiles.length));
			const candidateTiles = mysteryTiles.splice(0, size);
			player.hand = weight > 0.7 ? candidateTiles : candidateTiles.reverse();
		}
	});

	return clonedState;
}

export function selectAiMove(
	state: GameState,
	playerId: string,
	options: AiMoveOptions = {}
): Move | null {
	const config = createAiConfig(options);
	const rng = createSeededRng(config.seed);
	const legalMoves = generateLegalMoves(state, playerId);

	if (legalMoves.length === 0) return null;
	if (legalMoves.length === 1) return legalMoves[0];
	if (shouldUseEndgameSolver(state, playerId)) {
		const endgameMove = solveEndgameMove(state, playerId);
		if (endgameMove) {
			return endgameMove;
		}
	}

	let bestMove = legalMoves[0];
	let highestScore = Number.NEGATIVE_INFINITY;

	for (const move of legalMoves) {
		const tacticalScore = scoreTacticalMove(state, move, playerId);
		if (tacticalScore >= 10_000) {
			return move;
		}

		let playoutScore = 0;

		for (let i = 0; i < config.iterations; i++) {
			const simState = determinizeState(state, playerId, rng);
			const simManager = new GameManager(simState.players.map((player) => player.name));
			simManager.state = simState;

			if (simManager.nextTurn(move.playerId, move.tileId, move.side)) {
				playoutScore += playout(simManager.state, playerId, rng, config.maxPlayoutTurns);
			} else {
				playoutScore -= 150;
			}
		}

		const averageScore = playoutScore / config.iterations + tacticalScore * 2.75;
		console.log(
			`[AI ${playerId}] ${summarizeMove(state, move)}: taktis ${tacticalScore.toFixed(1)}, skor ${averageScore.toFixed(2)}`
		);

		if (averageScore > highestScore) {
			highestScore = averageScore;
			bestMove = move;
		}
	}

	return bestMove;
}
