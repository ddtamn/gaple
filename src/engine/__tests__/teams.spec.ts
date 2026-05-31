import { describe, expect, it } from 'vitest';
import { getPlayerTeam, getTeamMembers, areTeammates, isTeamMode, resolveTeamId, assignTeams, getWinnerTeamId, didAiWin, getTeamPipScore } from '../teams';
import type { GameState, Player } from '../types';

function createPlayer(id: string, teamId?: 0 | 1, hand?: Array<{ left: number; right: number }>): Player {
	return { id, name: `Player ${id}`, hand: hand?.map((h, i) => ({ ...h, id: `${id}-t${i}` })) ?? [], teamId };
}

function createFFAState(): GameState {
	return {
		players: ['0', '1', '2', '3'].map((id) => createPlayer(id)),
		board: { playedTiles: [], leftEnd: null, rightEnd: null, initialTileIndex: 0, requiresStarterTile: true },
		turnIndex: 0,
		history: [],
		events: [],
		drawPile: [],
		seed: 'test',
		result: null,
		pointStandings: {},
		teamConfig: { mode: 'ffa' }
	} as GameState;
}

function createTeamState(): GameState {
	const state = createFFAState();
	state.players = assignTeams(
		['0', '1', '2', '3'].map((id) => createPlayer(id)),
		[[0, 2], [1, 3]]
	);
	state.teamConfig = { mode: 'teams', layout: [[0, 2], [1, 3]] };
	return state;
}

describe('teams module', () => {
	describe('getPlayerTeam', () => {
		it('returns undefined for unassigned player', () => {
			expect(getPlayerTeam(createPlayer('0'))).toBeUndefined();
		});

		it('returns team for assigned player', () => {
			expect(getPlayerTeam(createPlayer('0', 0))).toBe(0);
			expect(getPlayerTeam(createPlayer('1', 1))).toBe(1);
		});
	});

	describe('getTeamMembers', () => {
		it('returns correct team members in team mode', () => {
			const state = createTeamState();
			const team0 = getTeamMembers(state, 0);
			const team1 = getTeamMembers(state, 1);
			expect(team0.map((p) => p.id)).toEqual(['0', '2']);
			expect(team1.map((p) => p.id)).toEqual(['1', '3']);
		});
	});

	describe('areTeammates', () => {
		it('returns true for same team members', () => {
			const state = createTeamState();
			expect(areTeammates(state, '0', '2')).toBe(true);
			expect(areTeammates(state, '1', '3')).toBe(true);
		});

		it('returns false for opponents', () => {
			const state = createTeamState();
			expect(areTeammates(state, '0', '1')).toBe(false);
			expect(areTeammates(state, '0', '3')).toBe(false);
		});

		it('returns false in FFA mode', () => {
			const state = createFFAState();
			expect(areTeammates(state, '0', '1')).toBe(false);
		});
	});

	describe('isTeamMode', () => {
		it('returns false for FFA mode', () => {
			expect(isTeamMode(createFFAState())).toBe(false);
		});

		it('returns true for teams mode', () => {
			expect(isTeamMode(createTeamState())).toBe(true);
		});
	});

	describe('resolveTeamId / assignTeams', () => {
		it('assigns teams based on layout', () => {
			const players = assignTeams(
				['0', '1', '2', '3'].map((id) => createPlayer(id)),
				[[0, 2], [1, 3]]
			);
			expect(players[0].teamId).toBe(0);
			expect(players[1].teamId).toBe(1);
			expect(players[2].teamId).toBe(0);
			expect(players[3].teamId).toBe(1);
		});
	});

	describe('getWinnerTeamId', () => {
		it('returns undefined when no result', () => {
			expect(getWinnerTeamId(createFFAState())).toBeUndefined();
		});

		it('returns team ID in team mode', () => {
			const state = createTeamState();
			state.result = { winnerId: '0', winnerTeamId: 0, reason: 'empty-hand', scores: {}, points: 1, winType: 'Normal' };
			expect(getWinnerTeamId(state)).toBe(0);
		});
	});

	describe('didAiWin', () => {
		it('returns true when AI won in FFA', () => {
			const state = createFFAState();
			state.result = { winnerId: '0', reason: 'empty-hand', scores: {}, points: 1, winType: 'Normal' };
			expect(didAiWin(state, '0')).toBe(true);
			expect(didAiWin(state, '1')).toBe(false);
		});

		it('returns true when AI team won', () => {
			const state = createTeamState();
			state.result = { winnerId: '0', winnerTeamId: 0, reason: 'empty-hand', scores: {}, points: 1, winType: 'Normal' };
			expect(didAiWin(state, '0')).toBe(true);
			expect(didAiWin(state, '1')).toBe(false);
		});
	});

	describe('getTeamPipScore', () => {
		it('calculates combined pip score for a team', () => {
			const players = assignTeams(
				[
					createPlayer('0', undefined, [{ left: 6, right: 6 }]),  // 12 pips
					createPlayer('1', undefined, [{ left: 0, right: 1 }]),  // 1 pip
					createPlayer('2', undefined, [{ left: 3, right: 3 }]),  // 6 pips
					createPlayer('3', undefined, [{ left: 2, right: 2 }])   // 4 pips
				],
				[[0, 2], [1, 3]]
			);
			const state = createTeamState();
			state.players = players;
			expect(getTeamPipScore(state, 0)).toBe(18); // 12 + 6
			expect(getTeamPipScore(state, 1)).toBe(5);  // 1 + 4
		});
	});
});
