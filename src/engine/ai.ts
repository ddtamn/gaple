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
import {
	applyPersonaScoreBias,
	getPersonaProfile,
	normalizePersona,
	type AiPersona
} from './ai/personas';

const ITERATIONS_PER_MOVE = 96;
const MAX_PLAYOUT_TURNS = 90;

export interface AiMoveOptions {
	seed?: string;
	iterations?: number;
	maxPlayoutTurns?: number;
	persona?: AiPersona;
	/** IDs of human players whose hands are visible to the AI. Defaults to ['0']. */
	humanPlayerIds?: string[];
	/** Optional time limit in milliseconds. If exceeded, AI returns the best move found so far. */
	timeLimitMs?: number;
	debug?: boolean;
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
	knownPlayerIds: Set<string>,
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
	// All known player IDs (e.g. human players whose hands are visible) have their tiles exposed
	clonedState.players.forEach((player) => {
		if (knownPlayerIds.has(player.id)) {
			player.hand.forEach((tile) => knownTiles.add(tileKey(tile)));
		}
	});

	const availableTiles = getStandardDeck().filter((tile) => !knownTiles.has(tileKey(tile)));
	const belief = createBelief();
	const weightedTiles = biasTileWeights(availableTiles, belief);
	const mysteryTiles = shuffle(weightedTiles, rng);

	clonedState.players.forEach((player) => {
		if (!knownPlayerIds.has(player.id)) {
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
	const persona = normalizePersona(options.persona);
	const personaProfile = getPersonaProfile(persona);
	const rng = createSeededRng(`${config.seed}:${personaProfile.seedSuffix}`);
	const knownPlayerIds = new Set([playerId, ...(options.humanPlayerIds ?? ['0'])]);
	const legalMoves = generateLegalMoves(state, playerId);
	const effectiveIterations = Math.max(1, Math.round(config.iterations * personaProfile.iterationsMultiplier));

	if (legalMoves.length === 0) return null;
	if (legalMoves.length === 1) return legalMoves[0];

	// Get team info for scoring-aware evaluation
	const aiPlayer = state.players.find((p) => p.id === playerId);
	const teamId = aiPlayer?.teamId;

	if (shouldUseEndgameSolver(state, playerId)) {
		const endgameMove = solveEndgameMove(state, playerId);
		if (endgameMove) {
			return endgameMove;
		}
	}

	let bestMove = legalMoves[0];
	let highestScore = Number.NEGATIVE_INFINITY;

	const startTime = Date.now();
	const timeLimitMs = options.timeLimitMs ?? 0;

	for (const move of legalMoves) {
		// Check time limit at the start of each move evaluation
		if (timeLimitMs > 0 && Date.now() - startTime > timeLimitMs) {
			if (options.debug) {
				console.log(`[AI ${playerId}] Time budget exceeded (${timeLimitMs}ms), returning best move so far`);
			}
			break;
		}
		const tacticalScore = scoreTacticalMove(state, move, playerId);
		if (tacticalScore >= 10_000) {
			return move;
		}

		let playoutScore = 0;

		for (let i = 0; i < effectiveIterations; i++) {
			const simState = determinizeState(state, playerId, knownPlayerIds, rng);
			const simManager = new GameManager(simState.players.map((player) => player.name));
			simManager.state = simState;

			if (simManager.nextTurn(move.playerId, move.tileId, move.side)) {
				// Scoring-aware playout: passes teamId for team mode
				playoutScore += playout(simManager.state, playerId, rng, config.maxPlayoutTurns, teamId);
			} else {
				playoutScore -= 150;
			}
		}

		const averageScore =
			playoutScore / effectiveIterations + applyPersonaScoreBias(persona, state, move, tacticalScore * 2.75);
		if (options.debug) {
			console.log(
				`[AI ${playerId}] ${summarizeMove(state, move)}: taktis ${tacticalScore.toFixed(1)}, skor ${averageScore.toFixed(2)}${teamId !== undefined ? ` tim=${teamId}` : ''}`
			);
		}

		if (averageScore > highestScore) {
			highestScore = averageScore;
			bestMove = move;
		}
	}

	return bestMove;
}
