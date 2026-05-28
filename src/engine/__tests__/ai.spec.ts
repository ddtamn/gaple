import { describe, expect, it, vi } from 'vitest';
import { GameManager } from '../game';
import { createAiConfig, selectAiMove } from '../ai';
import { runMctsSearch } from '../ai/search';
import { createDomino } from '../domino';
import { generateLegalMoves } from '../moves';
import { shouldUseEndgameSolver, solveEndgameMove } from '../ai/endgame';
import { choosePlayoutMove, createPlayoutSummary } from '../ai/playout';
import { hashGameState } from '../ai/cache';
import { createLearningBlueprint } from '../ai/learning';

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

		game.state.board = {
			playedTiles: [createDomino(3, 3)],
			leftEnd: 3,
			rightEnd: 3,
			initialTileIndex: 0,
			requiresStarterTile: true
		};
		game.state.players = game.state.players.map((player) => ({
			...player,
			hand: player.id === game.currentPlayer.id ? [createDomino(3, 0)] : [createDomino(0, 0)]
		}));
		game.state.drawPile = [];

		expect(shouldUseEndgameSolver(game.state, game.currentPlayer.id)).toBe(true);
	});

	it('returns a legal move from the endgame solver', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		game.state.board = {
			playedTiles: [createDomino(3, 3)],
			leftEnd: 3,
			rightEnd: 3,
			initialTileIndex: 0,
			requiresStarterTile: true
		};
		game.state.players = game.state.players.map((player) => ({
			...player,
			hand: player.id === game.currentPlayer.id ? [createDomino(3, 0)] : [createDomino(0, 0)]
		}));
		game.state.drawPile = [];

		const move = solveEndgameMove(game.state, game.currentPlayer.id);

		expect(move).toBeTruthy();
		expect(generateLegalMoves(game.state, game.currentPlayer.id)).toContainEqual(move);
	});

	it('prefers a tactical playout move and keeps the summary readable', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();
		const legalMoves = generateLegalMoves(game.state, game.currentPlayer.id);

		const move = choosePlayoutMove(game.state, legalMoves, { next: () => 0.1 } as never);

		expect(move).toBeTruthy();
		expect(typeof createPlayoutSummary(game.state, move)).toBe('string');
	});

	it('creates a stable hash for transposition caching', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'seed-test');
		game.startGame();

		const first = hashGameState(game.state);
		const second = hashGameState({ ...game.state, history: [...game.state.history] });

		expect(first).toBeTruthy();
		expect(first).toBe(second);
	});

	it('collects learning samples and produces evaluation logs', () => {
		const learning = createLearningBlueprint({ enabled: true, maxSamples: 5 });

		learning.collectSelfPlaySample('pos-1', 1.25);
		learning.collectSelfPlaySample('pos-2', -0.5);

		expect(learning.samples).toHaveLength(2);
		expect(learning.createEvaluationLog('pos-1', 1.25)).toContain('pos-1');
		expect(learning.createEvaluationLog('pos-1', 1.25)).toContain('1.25');
	});
});
