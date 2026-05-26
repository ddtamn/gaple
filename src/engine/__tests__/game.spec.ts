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
});
