import { describe, expect, it, vi } from 'vitest';
import { GameManager } from '../game';
import { createAiConfig, selectAiMove } from '../ai';
import { runMctsSearch } from '../ai/search';
import { createDomino } from '../domino';
import { generateLegalMoves } from '../moves';
import { shouldUseEndgameSolver, solveEndgameMove } from '../ai/endgame';

describe('AI move selection', () => {
	it('creates a seeded AI config with sensible defaults', () => {
		const config = createAiConfig({ seed: 'alpha', iterations: 5 });

		expect(config.seed).toBe('alpha');
		expect(config.iterations).toBe(5);
		expect(config.maxPlayoutTurns).toBeGreaterThan(0);
	});

	it('accepts an optional config object without changing the public entrypoint', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		expect(() =>
			selectAiMove(game.state, game.currentPlayer.id, { seed: 'alpha', iterations: 1 })
		).not.toThrow();
	});

	it('uses the seeded RNG path instead of Math.random during AI selection', () => {
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');

		const move = selectAiMove(game.state, game.currentPlayer.id, { seed: 'alpha', iterations: 1 });

		expect(move).toBeTruthy();
		expect(randomSpy).not.toHaveBeenCalled();

		randomSpy.mockRestore();
	});

	it('returns a legal move from the MCTS helper', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		const move = runMctsSearch(game.state, game.currentPlayer.id, { iterations: 2, seed: 'mcts' });

		expect(move).toBeTruthy();
		expect(typeof move?.playerId).toBe('string');
		expect(typeof move?.tileId).toBe('string');
	});

	it('detects an endgame state when few tiles remain', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		game.state.players = game.state.players.map((player, index) => ({
			...player,
			hand: index === 0 ? [createDomino(1, 2)] : [createDomino(0, 0)]
		}));
		game.state.drawPile = [];

		expect(shouldUseEndgameSolver(game.state, game.currentPlayer.id)).toBe(true);
	});

	it('returns a legal move from the endgame solver', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		game.state.players = game.state.players.map((player, index) => ({
			...player,
			hand: index === 0 ? [createDomino(1, 2)] : [createDomino(0, 0)]
		}));
		game.state.drawPile = [];

		const move = solveEndgameMove(game.state, game.currentPlayer.id);

		expect(move).toBeTruthy();
		expect(generateLegalMoves(game.state, game.currentPlayer.id)).toContainEqual(move);
	});
});
