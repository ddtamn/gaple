import { describe, expect, it } from 'vitest';
import { replayFromMoves, serializeReplay, deserializeReplay, verifyReplay, getMoveHistory } from '../replay';
import { GameManager } from '../game';
import { generateLegalMoves } from '../moves';
import type { Move } from '../types';

describe('replay module', () => {
	it('reconstructs the same game state from move history', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'replay-test-seed');
		game.startGame();

		// Play a few legal moves
		let movesPlayed = 0;
		const maxMoves = 10;
		while (!game.state.result && movesPlayed < maxMoves) {
			const legalMoves = generateLegalMoves(game.state, game.currentPlayer.id);
			if (legalMoves.length === 0) {
				game.passTurn(game.currentPlayer.id);
			} else {
				game.nextTurn(legalMoves[0].playerId, legalMoves[0].tileId, legalMoves[0].side);
			}
			movesPlayed++;
		}

		const moveHistory = getMoveHistory(game.state);

		// Replay from the same moves — use game.state.seed since startGame() regenerates the seed
		const reconstructed = replayFromMoves({
			playerNames: ['A', 'B', 'C', 'D'],
			seed: game.state.seed,
			moves: moveHistory,
			requiresStarterTile: true
		});

		// Verify key state properties match
		expect(reconstructed.board.playedTiles).toEqual(game.state.board.playedTiles);
		expect(reconstructed.board.leftEnd).toBe(game.state.board.leftEnd);
		expect(reconstructed.board.rightEnd).toBe(game.state.board.rightEnd);
		expect(reconstructed.turnIndex).toBe(game.state.turnIndex);
		expect(reconstructed.players.map((p) => p.hand.length)).toEqual(
			game.state.players.map((p) => p.hand.length)
		);
	});

	it('correctly handles empty move history', () => {
		const reconstructed = replayFromMoves({
			playerNames: ['A', 'B', 'C', 'D'],
			seed: 'empty-test',
			moves: [],
			requiresStarterTile: true
		});

		expect(reconstructed.board.playedTiles).toHaveLength(0);
		expect(reconstructed.players).toHaveLength(4);
		reconstructed.players.forEach((p) => {
			expect(p.hand).toHaveLength(7);
		});
		expect(reconstructed.result).toBeNull();
	});

	it('supports serialization roundtrip', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'serialize-test');
		game.startGame();

		const moves: Move[] = [];
		let movesPlayed = 0;
		while (!game.state.result && movesPlayed < 3) {
			const legalMoves = generateLegalMoves(game.state, game.currentPlayer.id);
			if (legalMoves.length === 0) {
				game.passTurn(game.currentPlayer.id);
			} else {
				const move = legalMoves[0];
				game.nextTurn(move.playerId, move.tileId, move.side);
				moves.push(move);
			}
			movesPlayed++;
		}

		const serialized = serializeReplay(['A', 'B', 'C', 'D'], game.state.seed, moves);
		const deserialized = deserializeReplay(serialized);

		expect(deserialized.playerNames).toEqual(['A', 'B', 'C', 'D']);
		expect(deserialized.seed).toBe(game.state.seed);
		expect(deserialized.moves).toEqual(moves);
	});

	it('supports team mode replay', () => {
		const teamConfig = { mode: 'teams' as const, layout: [[0, 2], [1, 3]] as [number[], number[]] };
		const game = new GameManager(['A', 'B', 'C', 'D'], 'team-replay', teamConfig);
		game.startGame();

		const moves: Move[] = [];
		let movesPlayed = 0;
		while (!game.state.result && movesPlayed < 5) {
			const legalMoves = generateLegalMoves(game.state, game.currentPlayer.id);
			if (legalMoves.length === 0) {
				game.passTurn(game.currentPlayer.id);
			} else {
				const move = legalMoves[0];
				game.nextTurn(move.playerId, move.tileId, move.side);
				moves.push(move);
			}
			movesPlayed++;
		}

		const reconstructed = replayFromMoves({
			playerNames: ['A', 'B', 'C', 'D'],
			seed: game.state.seed,
			moves,
			requiresStarterTile: true,
			teamConfig
		});

		if (game.state.result && reconstructed.result) {
			expect(reconstructed.result.winnerId).toBe(game.state.result.winnerId);
			expect(reconstructed.result.points).toBe(game.state.result.points);
		}

		// Verify team assignments
		expect(reconstructed.players[0].teamId).toBe(0);
		expect(reconstructed.players[2].teamId).toBe(0);
		expect(reconstructed.players[1].teamId).toBe(1);
		expect(reconstructed.players[3].teamId).toBe(1);
	});

	it('verifyReplay returns true for matching replays', () => {
		const game = new GameManager(['A', 'B', 'C', 'D'], 'verify-test');
		game.startGame();

		const moves: Move[] = [];
		let movesPlayed = 0;
		while (!game.state.result && movesPlayed < 5) {
			const legalMoves = generateLegalMoves(game.state, game.currentPlayer.id);
			if (legalMoves.length === 0) {
				game.passTurn(game.currentPlayer.id);
			} else {
				const move = legalMoves[0];
				game.nextTurn(move.playerId, move.tileId, move.side);
				moves.push(move);
			}
			movesPlayed++;
		}

		const result = verifyReplay(game.state, {
			playerNames: ['A', 'B', 'C', 'D'],
			seed: game.state.seed,
			moves
		});

		expect(result).toBe(true);
	});
});
