import type { GameState, Player, PlayerId, TeamConfig, TeamId } from './types';

/**
 * Get the team ID for a player.
 */
export function getPlayerTeam(player: Player): TeamId | undefined {
	return player.teamId;
}

/**
 * Get all members of a given team.
 */
export function getTeamMembers(state: GameState, teamId: TeamId): Player[] {
	return state.players.filter((p) => p.teamId === teamId);
}

/**
 * Check if two players are on the same team.
 */
export function areTeammates(state: GameState, playerA: PlayerId, playerB: PlayerId): boolean {
	const a = state.players.find((p) => p.id === playerA);
	const b = state.players.find((p) => p.id === playerB);
	if (!a || !b) return false;
	return a.teamId !== undefined && a.teamId === b.teamId;
}

/**
 * Check if we are in team mode.
 */
export function isTeamMode(state: GameState): boolean {
	return state.teamConfig?.mode === 'teams' && state.teamConfig.layout !== undefined;
}

/**
 * Get which team a player belongs to based on layout.
 */
export function resolveTeamId(layout: [number[], number[]], playerIndex: number): TeamId {
	if (layout[0].includes(playerIndex)) return 0;
	if (layout[1].includes(playerIndex)) return 1;
	return 0; // fallback
}

/**
 * Assign team IDs to all players based on the team layout.
 */
export function assignTeams(players: Player[], layout: [number[], number[]]): Player[] {
	return players.map((player, index) => ({
		...player,
		teamId: resolveTeamId(layout, index)
	}));
}

/**
 * Get the team ID of the winner from the game result.
 * Returns undefined in FFA mode.
 */
export function getWinnerTeamId(state: GameState): TeamId | undefined {
	if (!state.result) return undefined;
	if (isTeamMode(state)) {
		return state.result.winnerTeamId;
	}
	return undefined;
}

/**
 * Check if the AI's team won (team mode) or the AI won (FFA mode).
 */
export function didAiWin(state: GameState, aiPlayerId: PlayerId): boolean {
	if (!state.result) return false;

	if (isTeamMode(state)) {
		const aiTeam = state.players.find((p) => p.id === aiPlayerId)?.teamId;
		return aiTeam !== undefined && state.result.winnerTeamId === aiTeam;
	}

	return state.result.winnerId === aiPlayerId;
}

/**
 * Calculate the combined pip score for a team.
 */
export function getTeamPipScore(state: GameState, teamId: TeamId): number {
	const members = getTeamMembers(state, teamId);
	return members.reduce((sum, member) => {
		return sum + member.hand.reduce((total, tile) => total + tile.left + tile.right, 0);
	}, 0);
}
