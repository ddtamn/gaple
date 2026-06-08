import fs from 'node:fs';
import path from 'node:path';
import { runPersonaBenchmark } from '../src/engine/ai/benchmark';
import { ensureAiTrainingStore, recordBenchmarkRun } from '../src/lib/server/ai/training-store';

function readArg(name: string, fallback?: string) {
	const argv = process.argv.slice(2);
	const prefixed = `--${name}=`;
	const directIndex = argv.findIndex((entry) => entry === `--${name}`);
	const valueFromEquals = argv.find((entry) => entry.startsWith(prefixed))?.slice(prefixed.length);

	if (valueFromEquals !== undefined) {
		return valueFromEquals;
	}

	if (directIndex >= 0 && argv[directIndex + 1] && !argv[directIndex + 1].startsWith('--')) {
		return argv[directIndex + 1];
	}

	return fallback;
}

function parseSeeds(raw: string | undefined, countFallback = 20) {
	if (!raw) {
		return Array.from({ length: countFallback }, (_, index) => `benchmark-${index}`);
	}

	const count = Number(raw);
	if (Number.isFinite(count) && count > 0) {
		return Array.from({ length: count }, (_, index) => `benchmark-${index}`);
	}

	return raw
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

async function main() {
	const baselinePersona = readArg('baseline', 'balanced') ?? 'balanced';
	const challengerPersona = readArg('challenger', 'aggressive') ?? 'aggressive';
	const supportPersona = readArg('support', 'balanced') ?? 'balanced';
	const seeds = parseSeeds(readArg('seeds'));
	const iterations = Number(readArg('iterations', '64') ?? '64');
	const maxMoves = Number(readArg('max-moves', '80') ?? '80');

	ensureAiTrainingStore();

	const summary = runPersonaBenchmark({
		baselinePersona,
		challengerPersona,
		supportPersona,
		seeds,
		baseIterations: Number.isFinite(iterations) ? iterations : 64,
		maxMoves: Number.isFinite(maxMoves) ? maxMoves : 80
	});

	recordBenchmarkRun({
		id: summary.id,
		baselinePersona: summary.baselinePersona,
		challengerPersona: summary.challengerPersona,
		seeds: summary.seeds,
		summary,
		createdAt: Date.now()
	});

	const outputDir = path.resolve('data', 'self-play', 'benchmarks', summary.id);
	fs.mkdirSync(outputDir, { recursive: true });
	fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

	console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
