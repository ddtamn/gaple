import type { Domino, GameResult, GameState, Move, Player, TeamConfig, TeamId } from './types';
import { createBoard, playTile } from './board';
import { createDomino } from './domino';
import { createPlayer, receiveTiles, removeTile } from './player';
import {
	createSeededRng,
	shuffle,
	cloneGameState,
	serializeGameState,
	loadGameState
} from './utils';
import {
	createGameOverEvent,
	createMoveEvent,
	createPassEvent,
	generateLegalMoves,
	isValidMove
} from './moves';
import { scoreEmptyHand, scoreBlockedGame, calculateHandScore } from './scoring';
import { assignTeams } from './teams';

export { calculateHandScore };

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
	const players = names.map((name, index) => createPlayer(index.toString(), name));
	if (teamConfig?.mode === 'teams' && teamConfig.layout) {
		return assignTeams(players, teamConfig.layout);
	}
	return players;
}

function createScores(players: Player[]): Record<string, number> {
	return Object.fromEntries(players.map((player) => [player.id, calculateHandScore(player)]));
}

function findStarterPlayer(players: Player[]): number {
	const doubleThree = players.findIndex((player) =>
		player.hand.some((tile) => tile.left === 3 && tile.right === 3)
	);
	return doubleThree >= 0 ? doubleThree : 0;
}

export function createGameState(
	playerNames: string[],
	seed: string,
	startingPlayerId?: string,
	requiresStarterTile = true,
	prevStandings: Record<string, number> = {},
	teamConfig?: TeamConfig
): GameState {
	const rng = createSeededRng(seed);
	const deck = shuffle(createDeck(), rng);
	const players = createPlayers(playerNames, teamConfig);

	let remainingDeck = [...deck];
	for (let i = 0; i < players.length; i++) {
		const hand = remainingDeck.slice(0, 7);
		remainingDeck = remainingDeck.slice(7);
		players[i].hand = receiveTiles([], hand);
	}

	const turnIndex = startingPlayerId
		? players.findIndex((player) => player.id === startingPlayerId)
		: findStarterPlayer(players);

	return {
		players,
		board: createBoard(requiresStarterTile),
		turnIndex: turnIndex >= 0 ? turnIndex : 0,
		history: [],
		events: [],
		drawPile: remainingDeck,
		seed,
		result: null,
		pointStandings: prevStandings,
		lastPlayedTile: null,
		lastPlayerId: null,
		lastMoveWasCekik: false,
		teamConfig
	};
}	export class GameManager {
	public state: GameState;
	private teamConfig?: TeamConfig;

	constructor(
		playerNames: string[],
		public seed = 'seed',
		teamConfig?: TeamConfig
	) {
		if (playerNames.length !== 4) {
			throw new Error('Game requires exactly 4 players');
		}
		this.teamConfig = teamConfig;
		this.state = createGameState(playerNames, seed, undefined, true, {}, teamConfig);
	}

	get players() {
		return this.state.players;
	}
	get board() {
		return this.state.board;
	}
	get turnIndex() {
		return this.state.turnIndex;
	}
	get history() {
		return this.state.history;
	}
	get events() {
		return this.state.events;
	}
	get currentPlayer() {
		return this.players[this.state.turnIndex];
	}
	get result() {
		return this.state.result;
	}

	startGame(previousWinnerId?: string) {
		const prevStandings = this.state?.pointStandings || {};

		this.seed = Math.random().toString(36).substring(2, 10);
		const requiresStarterTile = previousWinnerId === undefined;
		this.state = createGameState(
			this.players.map((player) => player.name),
			this.seed,
			previousWinnerId,
			requiresStarterTile,
			prevStandings,
			this.teamConfig
		);
	}

	nextTurn(playerId: string, tileId: string, side: Move['side']): boolean {
		if (this.state.result) return false;

		const move: Move = { playerId, tileId, side };
		if (!isValidMove(this.state, move)) {
			if (!this.hasMoveAvailable(playerId)) {
				return this.passTurn(playerId);
			}
			return false;
		}

		return this.applyMove(move);
	}

	private applyMove(move: Move): boolean {
		const currentPlayer = this.players[this.state.turnIndex];

		const legalMoves = generateLegalMoves(this.state, currentPlayer.id);
		const isCecek = legalMoves.filter((m) => m.tileId === move.tileId).length === 2;

		const result = removeTile(currentPlayer.hand, move.tileId);
		const placedBoard = playTile(this.state.board, result.tile, move.side);

		if (!placedBoard) return false;

		const newPlayers = this.state.players.map((p) =>
			p.id === currentPlayer.id ? { ...p, hand: result.hand } : p
		);

		const isFinished = result.hand.length === 0;

		const newStandings = { ...this.state.pointStandings };
		let gameResult: GameResult | null = null;

		if (isFinished) {
			// Gunakan scoring module untuk menghitung skor
			const score = scoreEmptyHand(currentPlayer.id, result.tile, isCecek ? 2 : 1);

			newStandings[currentPlayer.id] = (newStandings[currentPlayer.id] || 0) + score.points;

			gameResult = {
				winnerId: score.winnerId,
				winnerTeamId: newPlayers.find((p) => p.id === score.winnerId)?.teamId,
				reason: score.reason,
				scores: createScores(newPlayers),
				points: score.points,
				winType: score.winType
			};
		}

		this.state = {
			...this.state,
			players: newPlayers,
			board: placedBoard,
			history: [...this.state.history, move],
			events: [
				...this.state.events,
				createMoveEvent(move),
				...(gameResult ? [createGameOverEvent(currentPlayer.id, gameResult.reason)] : [])
			],
			result: gameResult,
			pointStandings: newStandings,
			lastPlayedTile: result.tile,
			lastPlayerId: currentPlayer.id,
			lastMoveWasCekik: isCecek,
			turnIndex: isFinished
				? this.state.turnIndex
				: (this.state.turnIndex + 1) % this.players.length
		};

		return true;
	}

	hasMoveAvailable(playerId: string): boolean {
		return generateLegalMoves(this.state, playerId).length > 0;
	}

	passTurn(playerId: string): boolean {
		if (
			this.state.result ||
			this.currentPlayer.id !== playerId ||
			this.hasMoveAvailable(playerId)
		) {
			return false;
		}

		const newStandings = { ...this.state.pointStandings };

		// Cekik: tambahkan 1 poin ke pemain yang membuat lawan pass
		if (this.state.lastPlayerId) {
			newStandings[this.state.lastPlayerId] = (newStandings[this.state.lastPlayerId] || 0) + 1;
		}

		const nextTurnIndex = (this.state.turnIndex + 1) % this.players.length;
		const stateAfterPass: GameState = {
			...this.state,
			pointStandings: newStandings,
			events: [...this.state.events, createPassEvent(playerId)],
			turnIndex: nextTurnIndex
		};

		const isBlocked = stateAfterPass.players.every(
			(player) => generateLegalMoves(stateAfterPass, player.id).length === 0
		);

		if (isBlocked) {
			// Gunakan scoring module untuk gaple/blocked
			const score = scoreBlockedGame(stateAfterPass.players, stateAfterPass.lastPlayerId);

			stateAfterPass.pointStandings[score.winnerId] =
				(stateAfterPass.pointStandings[score.winnerId] || 0) + score.points;

			const gameResult: GameResult = {
				winnerId: score.winnerId,
				winnerTeamId: stateAfterPass.players.find((p) => p.id === score.winnerId)?.teamId,
				reason: score.reason,
				scores: createScores(stateAfterPass.players),
				points: score.points,
				winType: score.winType
			};

			this.state = {
				...stateAfterPass,
				result: gameResult,
				turnIndex: stateAfterPass.players.findIndex((player) => player.id === gameResult.winnerId),
				events: [
					...stateAfterPass.events,
					createGameOverEvent(gameResult.winnerId, gameResult.reason)
				]
			};
			return true;
		}

		this.state = stateAfterPass;
		return true;
	}

	cloneState() {
		return cloneGameState(this.state);
	}
	serializeState() {
		return serializeGameState(this.state);
	}
	loadState(serialized: string) {
		this.state = loadGameState(serialized) as GameState;
	}
}
