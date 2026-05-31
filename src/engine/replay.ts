import type { Domino, GameState, Move, Player, TeamConfig } from './types';
import { createBoard, playTile } from './board';
import { createDomino } from './domino';
import { createPlayer, receiveTiles, removeTile } from './player';
import { createSeededRng, shuffle } from './utils';
import { generateLegalMoves } from './moves';
import { scoreEmptyHand, scoreBlockedGame } from './scoring';

/**
 * Reconstruct a full GameState from a list of moves and initial parameters.
 * This ensures 100% reproducibility from move history alone.
 */
export interface ReplayConfig {
	playerNames: string[];
	seed: string;
	moves: Move[];
	requiresStarterTile?: boolean;
	teamConfig?: TeamConfig;
}

function createDeck(): Domino[] {
	const deck: Domino[] = [];
	for (let i = 0; i <= 6; i++) {
		for (let j = i; j <= 6; j++) {
			deck.push(createDomino(i, j));
		}
	}
	return deck;
}

function createPlayers(names: string[], teamConfig?: TeamConfig): Player[] {
	const players = names.map((name, index) => {
		const p = createPlayer(index.toString(), name);
		// Assign team IDs if in team mode
		if (teamConfig?.mode === 'teams' && teamConfig.layout) {
			const [team0, team1] = teamConfig.layout;
			p.teamId = team0.includes(index) ? 0 : team1.includes(index) ? 1 : undefined;
		}
		return p;
	});
	return players;
}

function findStarterPlayer(players: Player[]): number {
	const doubleThree = players.findIndex((player) =>
		player.hand.some((tile) => tile.left === 3 && tile.right === 3)
	);
	return doubleThree >= 0 ? doubleThree : 0;
}

/**
 * Rebuild a GameState by replaying every move from the initial state.
 * Since passTurn does NOT record moves in state.history, the move list
 * only contains actual tile plays. We skip over players whose pass turns
 * are unrecorded by advancing turnIndex to match each move's playerId.
 */
export function replayFromMoves(config: ReplayConfig): GameState {
	const { playerNames, seed, moves, requiresStarterTile = true, teamConfig } = config;

	// 1. Create deck and deal hands
	const rng = createSeededRng(seed);
	const deck = shuffle(createDeck(), rng);
	const players = createPlayers(playerNames, teamConfig);

	let remainingDeck = [...deck];
	for (let i = 0; i < players.length; i++) {
		const hand = remainingDeck.slice(0, 7);
		remainingDeck = remainingDeck.slice(7);
		players[i].hand = receiveTiles([], hand);
	}

	// 2. Determine starting player
	const turnIndex = findStarterPlayer(players);

	// 3. Create initial state
	const state: GameState = {
		players,
		board: createBoard(requiresStarterTile),
		turnIndex: turnIndex >= 0 ? turnIndex : 0,
		history: [],
		events: [],
		drawPile: remainingDeck,
		seed,
		result: null,
		pointStandings: {},
		lastPlayedTile: null,
		lastPlayerId: null,
		lastMoveWasCekik: false,
		teamConfig
	};

	// 4. Replay every move — passes are NOT in history, so we skip by advancing
	for (const move of moves) {
		// Skip if game is already over
		if (state.result) break;

		// Find the index of the player who made this move
		const movePlayerIndex = state.players.findIndex((p) => p.id === move.playerId);
		if (movePlayerIndex < 0) break;

		// Advance turnIndex past any players who passed (not recorded in history)
		// Keep advancing until we reach the player who made this move
		while (state.turnIndex !== movePlayerIndex) {
			const skippedPlayer = state.players[state.turnIndex];
			if (!skippedPlayer) break;

			// Check if all players are blocked (Gaple) — happens when every player passes
			const allBlocked = state.players.every(
				(p) => generateLegalMoves(state, p.id).length === 0
			);
			if (allBlocked && state.board.playedTiles.length > 0) {
				const score = scoreBlockedGame(state.players, state.lastPlayerId);
				state.pointStandings[score.winnerId] =
					(state.pointStandings[score.winnerId] || 0) + score.points;
				state.result = {
					winnerId: score.winnerId,
					winnerTeamId: state.players.find((p) => p.id === score.winnerId)?.teamId,
					reason: 'blocked',
					scores: {},
					points: score.points,
					winType: score.winType
				};
				// Match game engine: set turnIndex to winner index
				state.turnIndex = state.players.findIndex((p) => p.id === score.winnerId);
				break;
			}

			// Cekik scoring: player who made last opponent pass gets +1
			if (state.board.playedTiles.length > 0 && state.lastPlayerId) {
				state.pointStandings[state.lastPlayerId] =
					(state.pointStandings[state.lastPlayerId] || 0) + 1;
			}

			state.turnIndex = (state.turnIndex + 1) % state.players.length;
		}
		if (state.result) break;		const currentPlayer = state.players[state.turnIndex];
		if (!currentPlayer) break;

		// Try to remove tile from hand and play it
		const tile = currentPlayer.hand.find((t) => t.id === move.tileId);
		if (!tile) {
			// Should not happen with valid input; advance and try next move
			state.turnIndex = (state.turnIndex + 1) % state.players.length;
			continue;
		}

		// Check if tile can legally be played
		const placedBoard = playTile(state.board, tile, move.side);
		console.log('[Replay] placedBoard:', placedBoard ? 'SUCCESS (' + placedBoard.playedTiles.length + ' tiles)' : 'NULL');
		if (!placedBoard) {
			// Tile can't be played on this board; advance
			state.turnIndex = (state.turnIndex + 1) % state.players.length;
			continue;
		}

		// Remove tile from hand
		const removed = removeTile(currentPlayer.hand, move.tileId);

		// Check for Cecek
		const legalMovesAtBoard = generateLegalMoves(state, currentPlayer.id);
		const isCecek = legalMovesAtBoard.filter((m) => m.tileId === move.tileId).length === 2;

		const isFinished = removed.hand.length === 0;

		// Update state
		state.board = placedBoard;
		state.players = state.players.map((p) =>
			p.id === currentPlayer.id ? { ...p, hand: removed.hand } : p
		);
		state.history = [...state.history, move];
		state.turnIndex = (state.turnIndex + 1) % state.players.length;
		state.lastPlayedTile = removed.tile;
		state.lastPlayerId = currentPlayer.id;
		state.lastMoveWasCekik = isCecek;

		// Score if finished
		if (isFinished) {
			const score = scoreEmptyHand(currentPlayer.id, removed.tile, isCecek ? 2 : 1);
			state.pointStandings[currentPlayer.id] =
				(state.pointStandings[currentPlayer.id] || 0) + score.points;
			state.result = {
				winnerId: score.winnerId,
				winnerTeamId: state.players.find((p) => p.id === score.winnerId)?.teamId,
				reason: 'empty-hand',
				scores: {},
				points: score.points,
				winType: score.winType
			};
		}
	}

	return state;
}

/**
 * Get the sequence of moves from a GameState's history.
 */
export function getMoveHistory(state: GameState): Move[] {
	return [...state.history];
}

/**
 * Serialize a replay to a portable JSON string.
 */
export function serializeReplay(
	playerNames: string[],
	seed: string,
	moves: Move[],
	teamConfig?: TeamConfig
): string {
	return JSON.stringify({
		version: 1,
		playerNames,
		seed,
		moves,
		teamConfig,
		timestamp: Date.now()
	});
}

/**
 * Deserialize a replay JSON string.
 */
export function deserializeReplay(json: string): ReplayConfig {
	const data = JSON.parse(json);
	return {
		playerNames: data.playerNames,
		seed: data.seed,
		moves: data.moves,
		requiresStarterTile: data.requiresStarterTile ?? true,
		teamConfig: data.teamConfig
	};
}

/**
 * Verify that replaying moves produces the same result.
 * Returns true if the final winner matches.
 */
export function verifyReplay(state: GameState, config: ReplayConfig): boolean {
	const reconstructed = replayFromMoves(config);
	if (!state.result && !reconstructed.result) return true;
	if (state.result && reconstructed.result) {
		return (
			state.result.winnerId === reconstructed.result.winnerId &&
			state.result.points === reconstructed.result.points
		);
	}
	return false;
}
