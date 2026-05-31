import { describe, expect, it } from 'vitest';
import { scoreEmptyHand, scoreBlockedGame, calculateHandScore, calculateRoundScore, evaluateScoreForAi, evaluateGameResult, estimateStrategisValue } from '../scoring';
import type { Domino, GameState, Player } from '../types';

function createPlayer(id: string, hand: Domino[]): Player {
	return { id, name: `Player ${id}`, hand, teamId: undefined };
}

function createTeamPlayer(id: string, teamId: 0 | 1, hand: Domino[]): Player {
	return { id, name: `Player ${id}`, hand, teamId };
}

describe('scoring module', () => {
	describe('scoreEmptyHand', () => {
		it('scores normal win as 1 point', () => {
			const result = scoreEmptyHand('0', { id: 't', left: 3, right: 5 }, 1);
			expect(result.points).toBe(1);
			expect(result.winType).toBe('Normal');
			expect(result.reason).toBe('empty-hand');
		});

		it('scores balak finish as 4 points', () => {
			const result = scoreEmptyHand('0', { id: 't', left: 6, right: 6 }, 1);
			expect(result.points).toBe(4);
			expect(result.winType).toContain('Palang');
		});

		it('scores cecek finish as 3 points', () => {
			const result = scoreEmptyHand('0', { id: 't', left: 3, right: 5 }, 2);
			expect(result.points).toBe(3);
			expect(result.winType).toContain('Cecek');
		});
	});

	describe('scoreBlockedGame', () => {
		it('picks lowest hand score as winner', () => {
			const players = [
				createPlayer('0', [{ id: 'a', left: 0, right: 1 }]),     // 1 pip
				createPlayer('1', [{ id: 'b', left: 2, right: 3 }]),     // 5 pips
				createPlayer('2', [{ id: 'c', left: 4, right: 5 }]),     // 9 pips
				createPlayer('3', [{ id: 'd', left: 6, right: 6 }])      // 12 pips
			];
			const result = scoreBlockedGame(players, '0');
			expect(result.winnerId).toBe('0');
			expect(result.points).toBe(1);
			expect(result.winType).toContain('Buntu');
			expect(result.winType).not.toContain('Tembak');
		});

		it('detects "Kena Tembak" when winner is not the last player', () => {
			const players = [
				createPlayer('0', [{ id: 'a', left: 0, right: 1 }]),     // 1 pip - winner
				createPlayer('1', [{ id: 'b', left: 1, right: 1 }]),     // 2 pips
				createPlayer('2', [{ id: 'c', left: 2, right: 2 }]),     // 4 pips
				createPlayer('3', [{ id: 'd', left: 3, right: 3 }])      // 6 pips - last to play
			];
			const result = scoreBlockedGame(players, '3');
			expect(result.winnerId).toBe('0');
			expect(result.points).toBe(2);
			expect(result.winType).toContain('Tembak');
		});
	});

	describe('calculateHandScore', () => {
		it('sums pip values of all tiles in hand', () => {
			const player = createPlayer('0', [
				{ id: 'a', left: 3, right: 4 },  // 7
				{ id: 'b', left: 6, right: 6 },  // 12
				{ id: 'c', left: 0, right: 2 }   // 2
			]);
			expect(calculateHandScore(player)).toBe(21);
		});
	});

	describe('evaluateScoreForAi', () => {
		it('returns positive value when AI wins', () => {
			const score = { winnerId: '0', points: 4, winType: 'Palang (Balak)', reason: 'empty-hand' as const };
			expect(evaluateScoreForAi(score, '0')).toBeGreaterThan(0);
		});

		it('returns negative value when opponent wins', () => {
			const score = { winnerId: '1', points: 1, winType: 'Normal', reason: 'empty-hand' as const };
			expect(evaluateScoreForAi(score, '0')).toBeLessThan(0);
		});

		it('scales with point value', () => {
			const balakScore = { winnerId: '0', points: 4, winType: 'Palang', reason: 'empty-hand' as const };
			const normalScore = { winnerId: '0', points: 1, winType: 'Normal', reason: 'empty-hand' as const };
			expect(evaluateScoreForAi(balakScore, '0')).toBeGreaterThan(evaluateScoreForAi(normalScore, '0'));
		});
	});

	describe('evaluateGameResult', () => {
		it('returns positive value when AI wins in FFA mode', () => {
			const state = {
				result: { winnerId: '0', reason: 'empty-hand' as const, scores: {}, points: 1, winType: 'Normal' },
				players: [
					createPlayer('0', []),  // empty hand = winner
					createPlayer('1', [{ id: 'x', left: 1, right: 2 }]),
					createPlayer('2', [{ id: 'x', left: 3, right: 4 }]),
					createPlayer('3', [{ id: 'x', left: 5, right: 6 }])
				]
			} as GameState;
			expect(evaluateGameResult(state, '0')).toBeGreaterThan(0);
			expect(evaluateGameResult(state, '1')).toBeLessThan(0);
		});

		it('evaluates non-terminal states based on pip difference', () => {
			const state = {
				result: null,
				players: [
					createPlayer('0', [{ id: 'a', left: 0, right: 1 }]),     // 1 pip
					createPlayer('1', [{ id: 'b', left: 2, right: 2 }]),     // 4 pips
					createPlayer('2', [{ id: 'c', left: 3, right: 3 }]),     // 6 pips
					createPlayer('3', [{ id: 'd', left: 4, right: 4 }])      // 8 pips
				]
			} as GameState;
			const value = evaluateGameResult(state, '0');
			expect(value).toBeGreaterThan(0); // AI has lowest pips
		});

		it('evaluates team mode correctly', () => {
			const state = {
				result: null,
				players: [
					createTeamPlayer('0', 0, [{ id: 'a', left: 6, right: 6 }]),  // 12 pips
					createTeamPlayer('1', 1, [{ id: 'b', left: 0, right: 1 }]),  // 1 pip
					createTeamPlayer('2', 0, [{ id: 'c', left: 3, right: 3 }]),  // 6 pips
					createTeamPlayer('3', 1, [{ id: 'd', left: 2, right: 2 }])   // 4 pips
				]
			} as GameState;
			// Team 0 total pips: 18, Team 1 total pips: 5
			// best opponent (team 1): min(1, 4) = 1
			// AI team pips: 12 + 6 = 18
			// value = 1 - 18 = -17
			const value = evaluateGameResult(state, '0', 0);
			expect(value).toBeLessThan(0);
		});
	});

	describe('estimateStrategisValue', () => {
		it('gives positive value when player has lower pips than opponents', () => {
			const value = estimateStrategisValue(10, [15, 20, 25], 14);
			expect(value).toBeGreaterThan(0);
		});

		it('gives negative value when player has higher pips', () => {
			const value = estimateStrategisValue(30, [15, 20, 25], 14);
			expect(value).toBeLessThan(0);
		});
	});
});
