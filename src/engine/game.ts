import type { Domino, GameState, Move, Player } from './types';
import { createBoard } from './board';
import { createDomino } from './domino';
import { createPlayer, receiveTiles, removeTile } from './player';
import { createSeededRng, shuffle, cloneGameState, serializeGameState, loadGameState } from './utils';
import { createGameOverEvent, createMoveEvent, createPassEvent, generateLegalMoves, isValidMove } from './moves';
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

export function createGameState(playerNames: string[], seed: string): GameState {
	const rng = createSeededRng(seed);
	const deck = shuffle(createDeck(), rng);
	const players = createPlayers(playerNames);

	let remainingDeck = [...deck];
	for (let i = 0; i < players.length; i++) {
		const hand = remainingDeck.slice(0, 7);
		remainingDeck = remainingDeck.slice(7);
		players[i].hand = receiveTiles([], hand);
	}

	return {
		players,
		board: createBoard(),
		turnIndex: 0,
		history: [],
		events: [],
		drawPile: remainingDeck,
		seed
	};
}

export class GameManager {
	public state: GameState;

	constructor(playerNames: string[], public seed = 'seed') {
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

	startGame() {
		this.state = createGameState(this.players.map((player) => player.name), this.seed);
	}

	nextTurn(playerId: string, tileId: string, side: Move['side']): boolean {
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

		currentPlayer.hand = result.hand;
		this.state = {
			...this.state,
			board: placedBoard,
			history: [...this.state.history, move],
			events: [...this.state.events, createMoveEvent(move)],
			turnIndex: (this.state.turnIndex + 1) % this.players.length
		};

		if (currentPlayer.hand.length === 0) {
			this.state = {
				...this.state,
				events: [...this.state.events, createGameOverEvent(currentPlayer.id)]
			};
		}

		return true;
	}

	hasMoveAvailable(playerId: string): boolean {
		return generateLegalMoves(this.state, playerId).length > 0;
	}

	passTurn(playerId: string): boolean {
		if (this.currentPlayer.id !== playerId) {
			return false;
		}

		if (this.hasMoveAvailable(playerId)) {
			return false;
		}

		this.state = {
			...this.state,
			events: [...this.state.events, createPassEvent(playerId)],
			turnIndex: (this.state.turnIndex + 1) % this.players.length
		};
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
