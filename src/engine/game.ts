import type { Domino, GameResult, GameState, Move, Player } from './types';
import { createBoard } from './board';
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
import { playTile } from './board';

function createDeck(): Domino[] {
	const deck: Domino[] = [];
	for (let i = 0; i <= 6; i++) {
		for (let j = i; j <= 6; j++) {
			deck.push(createDomino(i, j));
		}
	}
	return deck;
}

function createPlayers(names: string[]): Player[] {
	return names.map((name, index) => createPlayer(index.toString(), name));
}

export function calculateHandScore(player: Player): number {
	return player.hand.reduce((total, tile) => total + tile.left + tile.right, 0);
}

function createScores(players: Player[]): Record<string, number> {
	return Object.fromEntries(players.map((player) => [player.id, calculateHandScore(player)]));
}

function getLowestScoreWinner(players: Player[]): Player {
	return [...players].sort((a, b) => {
		const scoreDiff = calculateHandScore(a) - calculateHandScore(b);
		if (scoreDiff !== 0) return scoreDiff;
		return a.hand.length - b.hand.length;
	})[0];
}

function createEmptyHandResult(players: Player[], winnerId: string): GameResult {
	return {
		winnerId,
		reason: 'empty-hand',
		scores: createScores(players)
	};
}

function createBlockedResult(players: Player[]): GameResult {
	const winner = getLowestScoreWinner(players);
	return {
		winnerId: winner.id,
		reason: 'blocked',
		scores: createScores(players)
	};
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
	requiresStarterTile = true
): GameState {
	const rng = createSeededRng(seed);
	const deck = shuffle(createDeck(), rng);
	const players = createPlayers(playerNames);

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
		result: null
	};
}

export class GameManager {
	public state: GameState;

	constructor(
		playerNames: string[],
		public seed = 'seed'
	) {
		if (playerNames.length !== 4) {
			throw new Error('Game requires exactly 4 players');
		}
		this.state = createGameState(playerNames, seed);
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
		// Buat seed acak baru setiap kali game di-restart
		this.seed = Math.random().toString(36).substring(2, 10);
		const requiresStarterTile = previousWinnerId === undefined;
		this.state = createGameState(
			this.players.map((player) => player.name),
			this.seed,
			previousWinnerId,
			requiresStarterTile
		);
	}

	nextTurn(playerId: string, tileId: string, side: Move['side']): boolean {
		if (this.state.result) {
			return false;
		}

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
		const result = removeTile(currentPlayer.hand, move.tileId);
		const placedBoard = playTile(this.state.board, result.tile, move.side);

		if (!placedBoard) {
			return false;
		}

		// PERBAIKAN 1: Buat array players baru tanpa memutasi yang lama
		const newPlayers = this.state.players.map((p) =>
			p.id === currentPlayer.id ? { ...p, hand: result.hand } : p
		);

		// Cek apakah game selesai (kartu habis)
		const isFinished = result.hand.length === 0;
		const gameResult = isFinished ? createEmptyHandResult(newPlayers, currentPlayer.id) : null;

		this.state = {
			...this.state,
			players: newPlayers, // Masukkan players baru
			board: placedBoard,
			history: [...this.state.history, move],
			events: [
				...this.state.events,
				createMoveEvent(move),
				...(gameResult ? [createGameOverEvent(currentPlayer.id, gameResult.reason)] : [])
			],
			result: gameResult,
			// PERBAIKAN 3: Jika game selesai, jangan pindah giliran agar tidak error (Infinity Loop)
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
		if (this.state.result) {
			return false;
		}

		if (this.currentPlayer.id !== playerId) {
			return false;
		}

		if (this.hasMoveAvailable(playerId)) {
			return false;
		}

		const nextTurnIndex = (this.state.turnIndex + 1) % this.players.length;
		const stateAfterPass: GameState = {
			...this.state,
			events: [...this.state.events, createPassEvent(playerId)],
			turnIndex: nextTurnIndex
		};

		const isBlocked = stateAfterPass.players.every(
			(player) => generateLegalMoves(stateAfterPass, player.id).length === 0
		);
		if (isBlocked) {
			const gameResult = createBlockedResult(stateAfterPass.players);
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
