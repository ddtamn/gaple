import crypto from 'node:crypto';
import { runSelfPlayGame } from './selfPlay';

export interface PersonaBenchmarkOptions {
	baselinePersona: string;
	challengerPersona: string;
	seeds: string[];
	supportPersona?: string;
	baseIterations?: number;
	maxMoves?: number;
}

export interface PersonaBenchmarkStats {
	games: number;
	winRate: number;
	averagePlacement: number;
	averageGameLength: number;
	averagePassCount: number;
	averageBeliefAccuracy: number;
}

export interface PersonaBenchmarkSummary {
	id: string;
	baselinePersona: string;
	challengerPersona: string;
	seeds: string[];
	supportPersona: string;
	baseline: PersonaBenchmarkStats;
	challenger: PersonaBenchmarkStats;
}

function createStatsAccumulator() {
	return {
		games: 0,
		wins: 0,
		placementSum: 0,
		moveCountSum: 0,
		passCountSum: 0,
		beliefAccuracySum: 0
	};
}

function finalizeStats(acc: ReturnType<typeof createStatsAccumulator>): PersonaBenchmarkStats {
	return {
		games: acc.games,
		winRate: acc.games > 0 ? acc.wins / acc.games : 0,
		averagePlacement: acc.games > 0 ? acc.placementSum / acc.games : 0,
		averageGameLength: acc.games > 0 ? acc.moveCountSum / acc.games : 0,
		averagePassCount: acc.games > 0 ? acc.passCountSum / acc.games : 0,
		averageBeliefAccuracy: acc.games > 0 ? acc.beliefAccuracySum / acc.games : 0
	};
}

function averageBeliefAccuracy(samples: { beliefSnapshot: { accuracyScore: number }[] }[]) {
	let total = 0;
	let count = 0;

	for (const sample of samples) {
		for (const belief of sample.beliefSnapshot) {
			total += belief.accuracyScore;
			count += 1;
		}
	}

	return count > 0 ? total / count : 0;
}

function scoreRunForSeatZero(
	result: ReturnType<typeof runSelfPlayGame>,
	acc: ReturnType<typeof createStatsAccumulator>
) {
	const seatZeroPlacement = result.summary.placements['0'] ?? 4;
	const seatZeroWon = result.summary.winnerId === '0';

	acc.games += 1;
	acc.wins += seatZeroWon ? 1 : 0;
	acc.placementSum += seatZeroPlacement;
	acc.moveCountSum += result.summary.moveCount;
	acc.passCountSum += result.summary.passCount;
	acc.beliefAccuracySum += averageBeliefAccuracy(result.positionSamples);
}

export function runPersonaBenchmark(options: PersonaBenchmarkOptions): PersonaBenchmarkSummary {
	const baselineAcc = createStatsAccumulator();
	const challengerAcc = createStatsAccumulator();
	const supportPersona = options.supportPersona ?? 'balanced';

	for (const seed of options.seeds) {
		const baselineRun = runSelfPlayGame({
			seed: `${seed}:baseline`,
			persona: options.baselinePersona,
			seatPersonas: [
				options.baselinePersona,
				supportPersona,
				supportPersona,
				supportPersona
			],
			baseIterations: options.baseIterations,
			maxMoves: options.maxMoves
		});

		const challengerRun = runSelfPlayGame({
			seed: `${seed}:challenger`,
			persona: options.challengerPersona,
			seatPersonas: [
				options.challengerPersona,
				supportPersona,
				supportPersona,
				supportPersona
			],
			baseIterations: options.baseIterations,
			maxMoves: options.maxMoves
		});

		scoreRunForSeatZero(baselineRun, baselineAcc);
		scoreRunForSeatZero(challengerRun, challengerAcc);
	}

	return {
		id: crypto.randomUUID(),
		baselinePersona: options.baselinePersona,
		challengerPersona: options.challengerPersona,
		seeds: [...options.seeds],
		supportPersona,
		baseline: finalizeStats(baselineAcc),
		challenger: finalizeStats(challengerAcc)
	};
}

