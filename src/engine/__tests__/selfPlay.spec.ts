import { describe, expect, it } from 'vitest';
import { runSelfPlayGame } from '../ai/selfPlay';
import { runPersonaBenchmark } from '../ai/benchmark';

describe('self-play pipeline', () => {
	it('runs a self-play game and emits policy and belief samples', () => {
		const result = runSelfPlayGame({
			seed: 'self-play-spec',
			persona: 'balanced',
			baseIterations: 1,
			maxMoves: 12
		});

		expect(result.summary.gameId).toBeTruthy();
		expect(result.positionSamples.length).toBeGreaterThan(0);
		expect(result.beliefSamples.length).toBeGreaterThan(0);
		expect(result.positionSamples[0].visibleState.ownHand.length).toBeGreaterThan(0);
		expect(result.positionSamples[0].chosenMove?.playerId ?? null).not.toBeUndefined();
	});

	it('benchmarks two personas with deterministic seeds', () => {
		const summary = runPersonaBenchmark({
			baselinePersona: 'balanced',
			challengerPersona: 'aggressive',
			seeds: ['seed-a'],
			baseIterations: 1,
			maxMoves: 10
		});

		expect(summary.baseline.games).toBe(1);
		expect(summary.challenger.games).toBe(1);
		expect(summary.baselinePersona).toBe('balanced');
		expect(summary.challengerPersona).toBe('aggressive');
		expect(summary.id).toBeTruthy();
	});
});

