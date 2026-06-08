import crypto from 'node:crypto';
import { GameManager, calculateHandScore } from '../game';
import { generateLegalMoves } from '../moves';
import { cloneGameState } from '../utils';
import { selectAiMove } from '../ai';
import type { GameState, Move } from '../types';
import { collectOpponentBeliefs, markPassesAsUnlikely } from './inference';
import { normalizePersona, type AiPersona } from './personas';

export type GamePhase = 'opening' | 'midgame' | 'endgame';

export interface TileSnapshot {
	id: string;
	left: number;
	right: number;
}

export interface SelfPlayVisibleState {
	board: GameState['board'];
	turnIndex: number;
	history: Move[];
	pointStandings: GameState['pointStandings'];
	lastPlayedTile: TileSnapshot | null;
	lastPlayerId: string | null;
	lastMoveWasCekik: boolean;
	passHints: GameState['passHints'];
	ownHand: TileSnapshot[];
	playerId: string;
	playerName: string;
}

export interface SelfPlayBeliefEntry {
	playerId: string;
	likelyMissing: number[];
	likelyPresent: number[];
	aggression: number;
	defensive: number;
	accuracyScore: number;
	actualHand: TileSnapshot[];
}

export interface SelfPlayPositionSample {
	gameId: string;
	seed: string;
	persona: AiPersona;
	moveIndex: number;
	playerId: string;
	playerName: string;
	gamePhase: GamePhase;
	boardState: GameState['board'];
	visibleState: SelfPlayVisibleState;
	aiHand: TileSnapshot[];
	legalMoves: Move[];
	chosenMove: Move | null;
	beliefSnapshot: SelfPlayBeliefEntry[];
	placement: number | null;
	outcome: number | null;
	rolloutScore: number | null;
	finalWinnerId: string | null;
	finalReason: string | null;
	createdAt: number;
}

export interface SelfPlayGameSummary {
	gameId: string;
	seed: string;
	persona: AiPersona;
	winnerId: string | null;
	winnerName: string | null;
	winnerTeamId: number | null;
	reason: string | null;
	placements: Record<string, number>;
	moveCount: number;
	passCount: number;
	durationMs: number;
}

export interface SelfPlayGameResult {
	summary: SelfPlayGameSummary;
	positionSamples: SelfPlayPositionSample[];
	beliefSamples: SelfPlayBeliefEntry[];
}

export interface SelfPlayGameOptions {
	seed: string;
	persona?: string;
	seatPersonas?: [string, string, string, string];
	playerNames?: [string, string, string, string];
	baseIterations?: number;
	maxMoves?: number;
}

export interface SelfPlayBatchOptions {
	persona: string;
	games: number;
	seed?: string;
	seatPersonas?: [string, string, string, string];
	playerNames?: [string, string, string, string];
	baseIterations?: number;
	maxMoves?: number;
}

function tileSnapshot(tile: { id: string; left: number; right: number }): TileSnapshot {
	return {
		id: tile.id,
		left: tile.left,
		right: tile.right
	};
}

function getRemainingTileCount(state: GameState): number {
	return state.players.reduce((total, player) => total + player.hand.length, 0);
}

export function getGamePhase(state: GameState): GamePhase {
	const remaining = getRemainingTileCount(state);
	if (remaining > 18) return 'opening';
	if (remaining > 8) return 'midgame';
	return 'endgame';
}

function createVisibleState(state: GameState, playerId: string): SelfPlayVisibleState {
	const player = state.players.find((item) => item.id === playerId);

	return {
		board: cloneGameState(state.board),
		turnIndex: state.turnIndex,
		history: cloneGameState(state.history),
		pointStandings: cloneGameState(state.pointStandings),
		lastPlayedTile: state.lastPlayedTile ? tileSnapshot(state.lastPlayedTile) : null,
		lastPlayerId: state.lastPlayerId ?? null,
		lastMoveWasCekik: state.lastMoveWasCekik ?? false,
		passHints: cloneGameState(state.passHints ?? {}),
		ownHand: cloneGameState(player?.hand ?? []).map(tileSnapshot),
		playerId,
		playerName: player?.name ?? ''
	};
}

function countAccuracy(actual: Set<number>, predictedPresent: Set<number>, predictedMissing: Set<number>) {
	const allNumbers = new Set<number>([0, 1, 2, 3, 4, 5, 6]);
	const actualMissing = new Set([...allNumbers].filter((value) => !actual.has(value)));

	const presentHits = [...predictedPresent].filter((value) => actual.has(value)).length;
	const missingHits = [...predictedMissing].filter((value) => actualMissing.has(value)).length;

	const presentScore = actual.size > 0 ? presentHits / actual.size : 1;
	const missingScore = actualMissing.size > 0 ? missingHits / actualMissing.size : 1;
	return Math.max(0, Math.min(1, (presentScore + missingScore) / 2));
}

function createBeliefSnapshot(state: GameState): SelfPlayBeliefEntry[] {
	const beliefs = collectOpponentBeliefs(state);
	markPassesAsUnlikely(state, beliefs);

	return state.players.map((player) => {
		const belief = beliefs.get(player.id);
		const actualHand = player.hand.map(tileSnapshot);
		const actualNumbers = new Set<number>(player.hand.flatMap((tile) => [tile.left, tile.right]));
		const likelyPresent = new Set<number>(belief?.likelyPresent ?? []);
		const likelyMissing = new Set<number>(belief?.likelyMissing ?? []);

		return {
			playerId: player.id,
			likelyMissing: [...likelyMissing].sort((a, b) => a - b),
			likelyPresent: [...likelyPresent].sort((a, b) => a - b),
			aggression: belief?.aggression ?? 0.5,
			defensive: belief?.defensive ?? 0.5,
			accuracyScore: countAccuracy(actualNumbers, likelyPresent, likelyMissing),
			actualHand
		};
	});
}

function computePlacements(state: GameState): Record<string, number> {
	const winnerId = state.result?.winnerId ?? null;
	const rankedPlayers = [...state.players].sort((a, b) => {
		if (a.id === winnerId) return -1;
		if (b.id === winnerId) return 1;

		const scoreDiff = calculateHandScore(a) - calculateHandScore(b);
		if (scoreDiff !== 0) return scoreDiff;
		return Number(a.id) - Number(b.id);
	});

	return Object.fromEntries(rankedPlayers.map((player, index) => [player.id, index + 1]));
}

function createPlayerNames(prefix: string): [string, string, string, string] {
	return [
		`${prefix}-A`,
		`${prefix}-B`,
		`${prefix}-C`,
		`${prefix}-D`
	];
}

export function runSelfPlayGame(options: SelfPlayGameOptions): SelfPlayGameResult {
	const persona = normalizePersona(options.persona);
	const playerNames = options.playerNames ?? createPlayerNames(persona);
	const seatPersonas = options.seatPersonas ?? [
		persona,
		persona,
		persona,
		persona
	];
	const gameId = crypto.randomUUID();
	const game = new GameManager(playerNames, options.seed);
	const positionSamples: SelfPlayPositionSample[] = [];
	const beliefSamples: SelfPlayBeliefEntry[] = [];
	const start = Date.now();
	const baseIterations = options.baseIterations ?? 24;
	const maxMoves = options.maxMoves ?? 80;
	let moveIndex = 0;
	let passCount = 0;

	game.startGame();

	while (!game.state.result && moveIndex < maxMoves) {
		const currentPlayer = game.currentPlayer;
		const currentSeatPersona = normalizePersona(seatPersonas[Number(currentPlayer.id)] ?? persona);
		const legalMoves = generateLegalMoves(game.state, currentPlayer.id);
		const visibleState = createVisibleState(game.state, currentPlayer.id);
		const beliefSnapshot = createBeliefSnapshot(game.state);
		beliefSamples.push(...beliefSnapshot);

		const chosenMove =
			legalMoves.length === 0
				? null
			: selectAiMove(game.state, currentPlayer.id, {
						seed: `${options.seed}:${moveIndex}`,
						iterations: baseIterations,
						humanPlayerIds: [],
						persona: currentSeatPersona
					});

		positionSamples.push({
			gameId,
			seed: options.seed,
			persona: currentSeatPersona,
			moveIndex,
			playerId: currentPlayer.id,
			playerName: currentPlayer.name,
			gamePhase: getGamePhase(game.state),
			boardState: cloneGameState(game.state.board),
			visibleState,
			aiHand: currentPlayer.hand.map(tileSnapshot),
			legalMoves: cloneGameState(legalMoves),
			chosenMove,
			beliefSnapshot,
			placement: null,
			outcome: null,
			rolloutScore: null,
			finalWinnerId: null,
			finalReason: null,
			createdAt: Date.now()
		});

		if (!chosenMove) {
			passCount += 1;
			game.passTurn(currentPlayer.id);
			moveIndex += 1;
			continue;
		}

		const success = game.nextTurn(chosenMove.playerId, chosenMove.tileId, chosenMove.side);
		if (!success) {
			passCount += 1;
			game.passTurn(currentPlayer.id);
		}

		moveIndex += 1;
	}

	const finalState = game.state;
	const placements = computePlacements(finalState);
	const winnerId = finalState.result?.winnerId ?? null;
	const winnerName = finalState.players.find((player) => player.id === winnerId)?.name ?? null;
	const winnerTeamId = finalState.result?.winnerTeamId ?? null;
	const reason = finalState.result?.reason ?? null;

	for (const sample of positionSamples) {
		sample.placement = placements[sample.playerId] ?? null;
		sample.outcome = winnerId && sample.playerId === winnerId ? 1 : winnerId ? -1 : null;
		sample.rolloutScore = sample.placement ? 1 / sample.placement : null;
		sample.finalWinnerId = winnerId;
		sample.finalReason = reason;
	}

	return {
		summary: {
			gameId,
			seed: options.seed,
			persona,
			winnerId,
			winnerName,
			winnerTeamId,
			reason,
			placements,
			moveCount: moveIndex,
			passCount,
			durationMs: Date.now() - start
		},
		positionSamples,
		beliefSamples
	};
}

export function runSelfPlayBatch(options: SelfPlayBatchOptions): SelfPlayGameResult[] {
	const seed = options.seed ?? 'gaple-self-play';
	const results: SelfPlayGameResult[] = [];

	for (let index = 0; index < options.games; index++) {
		results.push(
			runSelfPlayGame({
				seed: `${seed}:${options.persona}:${index}`,
				persona: options.persona,
				seatPersonas: options.seatPersonas,
				playerNames: options.playerNames,
				baseIterations: options.baseIterations,
				maxMoves: options.maxMoves
			})
		);
	}

	return results;
}
