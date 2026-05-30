import type { Domino, GameResult, GameState, Move, Player } from './types';
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

function findStarterPlayer(players: Player[]): number {
	const doubleThree = players.findIndex((player) =>
		player.hand.some((tile) => tile.left === 3 && tile.right === 3)
	);
	return doubleThree >= 0 ? doubleThree : 0;
}

// PERBAIKAN 1: Tambahkan parameter `prevStandings` agar skor ronde lalu tidak hangus
export function createGameState(
	playerNames: string[],
	seed: string,
	startingPlayerId?: string,
	requiresStarterTile = true,
	prevStandings: Record<string, number> = {}
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
		result: null,
		// PERBAIKAN 2: Inisialisasi memori untuk aturan Gaple Tradisional
		pointStandings: prevStandings,
		lastPlayedTile: null,
		lastPlayerId: null,
		lastMoveWasCekik: false
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
		// PERBAIKAN 3: Amankan rekam jejak poin sebelum reset ronde
		const prevStandings = this.state?.pointStandings || {};

		this.seed = Math.random().toString(36).substring(2, 10);
		const requiresStarterTile = previousWinnerId === undefined;
		this.state = createGameState(
			this.players.map((player) => player.name),
			this.seed,
			previousWinnerId,
			requiresStarterTile,
			prevStandings
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

		// PERBAIKAN 4: Deteksi apakah langkah ini Cecek (bisa masuk di kedua ujung)
		const legalMoves = generateLegalMoves(this.state, currentPlayer.id);
		const isCecek = legalMoves.filter((m) => m.tileId === move.tileId).length === 2;

		const result = removeTile(currentPlayer.hand, move.tileId);
		const placedBoard = playTile(this.state.board, result.tile, move.side);

		if (!placedBoard) return false;

		const newPlayers = this.state.players.map((p) =>
			p.id === currentPlayer.id ? { ...p, hand: result.hand } : p
		);

		const isFinished = result.hand.length === 0;

		// Clone pointStandings agar tidak mutasi state secara kotor
		const newStandings = { ...this.state.pointStandings };
		let gameResult: GameResult | null = null;

		// PERBAIKAN 5: Kalkulasi Poin Menang Normal
		if (isFinished) {
			let pts = 1;
			let type = 'Normal';

			if (result.tile.left === result.tile.right) {
				pts = 4;
				type = 'Palang (Balak)';
			} else if (isCecek) {
				pts = 3;
				type = 'Cium Kiri-Kanan (Cecek)';
			}

			newStandings[currentPlayer.id] = (newStandings[currentPlayer.id] || 0) + pts;

			gameResult = {
				winnerId: currentPlayer.id,
				reason: 'empty-hand',
				scores: createScores(newPlayers),
				points: pts,
				winType: type
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

		// PERBAIKAN 6: Aturan Cekik (Tambahkan 1 poin ke pemain yang membuat Pass)
		if (this.state.lastPlayerId) {
			newStandings[this.state.lastPlayerId] = (newStandings[this.state.lastPlayerId] || 0) + 1;
		}

		const nextTurnIndex = (this.state.turnIndex + 1) % this.players.length;
		const stateAfterPass: GameState = {
			...this.state,
			pointStandings: newStandings, // Simpan poin cekik
			events: [...this.state.events, createPassEvent(playerId)],
			turnIndex: nextTurnIndex
		};

		const isBlocked = stateAfterPass.players.every(
			(player) => generateLegalMoves(stateAfterPass, player.id).length === 0
		);

		// PERBAIKAN 7: Kalkulasi Poin Buntu / Gaple
		if (isBlocked) {
			const winner = getLowestScoreWinner(stateAfterPass.players);
			let pts = 1;
			let type = 'Buntu (Mutlak)';

			// Aturan Tembak (Yang menang BUKAN yang menutup meja)
			if (winner.id !== stateAfterPass.lastPlayerId) {
				pts = 2;
				type = 'Buntu (Kena Tembak)';
			}

			stateAfterPass.pointStandings[winner.id] =
				(stateAfterPass.pointStandings[winner.id] || 0) + pts;

			const gameResult: GameResult = {
				winnerId: winner.id,
				reason: 'blocked',
				scores: createScores(stateAfterPass.players),
				points: pts,
				winType: type
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
