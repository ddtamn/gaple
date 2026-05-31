import type { Domino, GameResult, GameState, Player, PlayerId, TeamId } from './types';

export interface RoundScore {
	winnerId: PlayerId;
	points: number;
	winType: string;
	reason: 'empty-hand' | 'blocked';
}

/**
 * Hitung skor untuk situasi pemain menghabiskan kartu (empty-hand).
 */
export function scoreEmptyHand(
	playerId: PlayerId,
	lastTile: Domino,
	legalMovesCount: number
): RoundScore {
	let pts = 1;
	let type = 'Normal';

	// Palang / Balak finish: menutup dengan kartu balak (kembar)
	if (lastTile.left === lastTile.right) {
		pts = 4;
		type = 'Palang (Balak)';
	}
	// Cecek: kartu bisa dimasukkan di kedua ujung
	else if (legalMovesCount === 2) {
		pts = 3;
		type = 'Cium Kiri-Kanan (Cecek)';
	}

	return {
		winnerId: playerId,
		points: pts,
		winType: type,
		reason: 'empty-hand'
	};
}

/**
 * Hitung total pip (titik) pada tangan pemain.
 */
export function calculateHandScore(player: Player): number {
	return player.hand.reduce((total, tile) => total + tile.left + tile.right, 0);
}

/**
 * Hitung skor untuk situasi board buntu / gaple (semua pemain pass).
 */
export function scoreBlockedGame(
	players: Player[],
	lastPlayerId: PlayerId | null | undefined
): RoundScore {
	const winner = [...players].sort((a, b) => {
		const scoreDiff = calculateHandScore(a) - calculateHandScore(b);
		if (scoreDiff !== 0) return scoreDiff;
		return a.hand.length - b.hand.length;
	})[0];

	let pts = 1;
	let type = 'Buntu (Mutlak)';

	// Tembak: pemenang BUKAN yang menutup meja
	if (winner.id !== lastPlayerId) {
		pts = 2;
		type = 'Buntu (Kena Tembak)';
	}

	return {
		winnerId: winner.id,
		points: pts,
		winType: type,
		reason: 'blocked'
	};
}

/**
 * Hitung skor akhir berdasar GameState yang sudah memiliki result.
 */
export function calculateRoundScore(gameState: GameState): RoundScore | null {
	if (!gameState.result) return null;

	// Gunakan data yang sudah ada di result
	return {
		winnerId: gameState.result.winnerId,
		points: gameState.result.points ?? 1,
		winType: gameState.result.winType ?? 'Normal',
		reason: gameState.result.reason
	};
}

/**
 * Hitung expected value untuk AI berdasarkan aturan Gaple.
 * Return nilai numerik: makin tinggi = makin baik untuk aiPlayerId.
 */
export function evaluateScoreForAi(score: RoundScore | null, aiPlayerId: PlayerId): number {
	if (!score) return 0;

	if (score.winnerId === aiPlayerId) {
		// Bonus untuk kemenangan bernilai tinggi
		return 1000 + score.points * 100;
	} else {
		return -1000 - score.points * 100;
	}
}

/**
 * Evaluasi state akhir untuk AI dengan mempertimbangkan nilai kemenangan.
 */
export function evaluateGameResult(
	state: GameState,
	aiPlayerId: PlayerId,
	teamId?: TeamId
): number {
	if (!state.result) {
		const aiPlayer = state.players.find((p) => p.id === aiPlayerId);
		if (!aiPlayer) return 0;

		if (teamId !== undefined) {
			// Team mode: hitung total pip tim
			const teamMembers = state.players.filter((p) => p.teamId === teamId);
			const aiPips = teamMembers.reduce((sum, p) => sum + calculateHandScore(p), 0);
			const opponents = state.players.filter((p) => p.teamId !== teamId);
			const bestOpponentPips = Math.min(...opponents.map((p) => calculateHandScore(p)));
			return bestOpponentPips - aiPips;
		}

		const aiScore = calculateHandScore(aiPlayer);
		const bestOpponentScore = Math.min(
			...state.players
				.filter((p) => p.id !== aiPlayerId)
				.map((p) => calculateHandScore(p))
		);
		return bestOpponentScore - aiScore;
	}

	const score = calculateRoundScore(state);
	if (!score) return 0;

	if (teamId !== undefined) {
		const winnerPlayer = state.players.find((p) => p.id === score.winnerId);
		const winnerTeam: TeamId | undefined = winnerPlayer?.teamId;
		if (winnerTeam === teamId) {
			return 1000 + score.points * 100;
		} else {
			return -1000 - score.points * 100;
		}
	}

	return evaluateScoreForAi(score, aiPlayerId);
}

/**
 * Bandingkan nilai strategis Gaple (untuk heuristic).
 * Nilai positif = menguntungkan pemain.
 */
export function estimateStrategisValue(
	currentPlayerPips: number,
	opponentPips: number[],
	remainingTiles: number
): number {
	const averageOpponent = opponentPips.reduce((a, b) => a + b, 0) / opponentPips.length;
	const pipAdvantage = averageOpponent - currentPlayerPips;

	// Semakin sedikit kartu tersisa, semakin penting pip advantage
	const urgency = Math.max(0, 14 - remainingTiles) / 14;
	return pipAdvantage * (1 + urgency * 2);
}
