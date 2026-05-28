import { describe, expect, it } from 'vitest';
import { GameManager } from '../game';

describe('Domino engine', () => {
	it('starts the match with the player holding 3|3 as the first mover', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();

		const starter = game.players.find((player) =>
			player.hand.some((tile) => tile.left === 3 && tile.right === 3)
		);

		expect(starter).toBeDefined();
		expect(game.currentPlayer.id).toBe(starter?.id);
	});

	it('restores the previous winner as the first mover for the next match', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame('2');

		expect(game.currentPlayer.id).toBe('2');
	});

	it('allows the previous winner to start with any tile on the next match', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame('2');

		const current = game.currentPlayer;
		const nonStartingTile = current.hand.find((tile) => !(tile.left === 3 && tile.right === 3))!;

		const success = game.nextTurn(current.id, nonStartingTile.id, 'right');

		expect(success).toBe(true);
		expect(game.board.playedTiles).toHaveLength(1);
		expect(game.board.playedTiles[0]).toEqual(nonStartingTile);
	});

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
		const firstTile = current.hand.find((tile) => tile.left === 3 && tile.right === 3);
		expect(firstTile).toBeDefined();

		const success = game.nextTurn(current.id, firstTile!.id, 'right');

		expect(success).toBe(true);
		expect(game.history).toHaveLength(1);
		expect(game.board.playedTiles).toHaveLength(1);
		expect(game.turnIndex).toBe((Number(current.id) + 1) % 4);
	});

	it('only allows 3|3 to be played on the very first move', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();

		const current = game.currentPlayer;
		const nonStartingTile = current.hand.find((tile) => !(tile.left === 3 && tile.right === 3))!;
		game.state = {
			...game.state,
			players: game.state.players.map((player, index) =>
				index === game.turnIndex ? { ...player, hand: [nonStartingTile] } : player
			)
		};

		const success = game.nextTurn(current.id, nonStartingTile.id, 'right');

		expect(success).toBe(true);
		expect(game.board.playedTiles).toHaveLength(0);
		expect(game.history).toHaveLength(0);
		expect(game.state.result?.reason).toBe('blocked');
	});

	it('ends the game when a player plays their last tile', () => {
		expect.assertions(4);
		const game = new GameManager(['A', 'B', 'C', 'D'], 'test-seed');
		game.startGame();
		const current = game.currentPlayer;
		const lastTile = { id: 'last-3-0', left: 3, right: 0 };
		game.state = {
			...game.state,
			board: {
				playedTiles: [{ id: 'starter-3-3', left: 3, right: 3 }],
				leftEnd: 3,
				rightEnd: 3,
				initialTileIndex: 0,
				requiresStarterTile: true
			},
			players: game.state.players.map((player, index) =>
				index === game.turnIndex ? { ...player, hand: [lastTile] } : player
			)
		};

		const success = game.nextTurn(game.currentPlayer.id, lastTile.id, 'right');

		expect(success).toBe(true);
		expect(game.state.result?.winnerId).toBe(game.currentPlayer.id);
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
				initialTileIndex: 0,
				requiresStarterTile: true
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
