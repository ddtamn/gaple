import { describe, expect, it } from 'vitest';
import { GameManager } from '../game';

describe('Domino engine', () => {
	it('creates a standard 4-player game with 7 tiles each', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();

		expect(game.players).toHaveLength(4);
		game.players.forEach((player) => {
			expect(player.hand).toHaveLength(7);
		});
		expect(game.board.playedTiles).toHaveLength(0);
	});

	it('records a valid first move and advances the turn', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();

		const current = game.currentPlayer;
		const firstTile = current.hand[0];
		const success = game.nextTurn(current.id, firstTile.id, 'right');

		expect(success).toBe(true);
		expect(game.history).toHaveLength(1);
		expect(game.board.playedTiles).toHaveLength(1);
		expect(game.turnIndex).toBe(1);
	});

	it('ends the game when a player plays their last tile', () => {
		expect.assertions(4);
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();
		const lastTile = game.currentPlayer.hand[0];
		game.state = {
			...game.state,
			players: game.state.players.map((player, index) =>
				index === game.turnIndex ? { ...player, hand: [lastTile] } : player
			)
		};

		const success = game.nextTurn(game.currentPlayer.id, lastTile.id, 'right');

		expect(success).toBe(true);
		expect(game.state.result?.winnerId).toBe('0');
		expect(game.state.result?.reason).toBe('empty-hand');
		expect(game.events.at(-1)?.type).toBe('GAME_OVER');
	});

	it('ends a blocked game with the lowest hand score as winner', () => {
		expect.assertions(5);
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();
		game.state = {
			...game.state,
			board: {
				playedTiles: [{ id: 'blocked-start', left: 6, right: 6 }],
				leftEnd: 6,
				rightEnd: 6,
				initialTileIndex: 0
			},
			players: [
				{ ...game.state.players[0], hand: [{ id: 'lowest', left: 0, right: 1 }] },
				{ ...game.state.players[1], hand: [{ id: 'two', left: 1, right: 1 }] },
				{ ...game.state.players[2], hand: [{ id: 'four', left: 2, right: 2 }] },
				{ ...game.state.players[3], hand: [{ id: 'six', left: 3, right: 3 }] }
			],
			turnIndex: 0
		};

		const success = game.passTurn('0');

		expect(success).toBe(true);
		expect(game.state.result?.winnerId).toBe('0');
		expect(game.state.result?.reason).toBe('blocked');
		expect(game.state.result?.scores['0']).toBe(1);
		expect(game.events.at(-1)?.type).toBe('GAME_OVER');
	});
});
