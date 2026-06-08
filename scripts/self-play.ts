import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { runSelfPlayGame } from '../src/engine/ai/selfPlay';

type PersonaArg = 'balanced' | 'aggressive' | 'defensive' | 'all';

interface WorkerPayload {
	persona: Exclude<PersonaArg, 'all'>;
	seed: string;
	iterations: number;
	maxMoves: number;
	startIndex: number;
	endIndex: number;
	shardIndex: number;
	outputDir: string;
	progressEvery: number;
}

interface WorkerResult {
	shardIndex: number;
	gamesCompleted: number;
	totalPositions: number;
	totalBeliefs: number;
	durationMs: number;
}

function readArg(name: string, fallback?: string) {
	const argv = process.argv.slice(2);
	const prefixed = `--${name}=`;
	const directIndex = argv.findIndex((entry) => entry === `--${name}`);
	const valueFromEquals = argv.find((entry) => entry.startsWith(prefixed))?.slice(prefixed.length);

	if (valueFromEquals !== undefined) return valueFromEquals;
	if (directIndex >= 0 && argv[directIndex + 1] && !argv[directIndex + 1].startsWith('--')) {
		return argv[directIndex + 1];
	}

	return fallback;
}

function readNumberArg(name: string, fallback: number) {
	const value = readArg(name);
	if (value === undefined) return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePersona(value: string | undefined): PersonaArg {
	if (value === 'aggressive' || value === 'defensive' || value === 'balanced' || value === 'all') {
		return value;
	}
	return 'balanced';
}

function defaultWorkerCount() {
	const available = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
	return Math.max(1, Math.min(4, available - 1));
}

function padShard(index: number) {
	return index.toString().padStart(2, '0');
}

function writeCheckpoint(outputDir: string, checkpoint: Record<string, unknown>) {
	fs.writeFileSync(path.join(outputDir, 'checkpoint.json'), JSON.stringify(checkpoint, null, 2));
}

function appendJsonlRecord(filePath: string, record: unknown) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

function writeSamples(payload: WorkerPayload): WorkerResult {
	const startedAt = Date.now();
	const shardDir = path.join(payload.outputDir, `shard-${padShard(payload.shardIndex)}`);
	fs.mkdirSync(shardDir, { recursive: true });

	const positionsFile = path.join(shardDir, 'positions.jsonl');
	const beliefsFile = path.join(shardDir, 'beliefs.jsonl');
	const gamesFile = path.join(shardDir, 'games.jsonl');

	let gamesCompleted = 0;
	let totalPositions = 0;
	let totalBeliefs = 0;

	for (let index = payload.startIndex; index < payload.endIndex; index++) {
		const result = runSelfPlayGame({
			seed: `${payload.seed}:${payload.persona}:${index}`,
			persona: payload.persona,
			baseIterations: payload.iterations,
			maxMoves: payload.maxMoves
		});

		appendJsonlRecord(gamesFile, result.summary);
		for (const sample of result.positionSamples) {
			appendJsonlRecord(positionsFile, sample);
			totalPositions += 1;
		}
		for (const belief of result.beliefSamples) {
			appendJsonlRecord(beliefsFile, belief);
			totalBeliefs += 1;
		}

		gamesCompleted += 1;
		if (gamesCompleted % payload.progressEvery === 0 && parentPort) {
			parentPort.postMessage({
				type: 'progress',
				shardIndex: payload.shardIndex,
				gamesCompleted,
				totalPositions,
				totalBeliefs
			});
		}
	}

	const result = {
		shardIndex: payload.shardIndex,
		gamesCompleted,
		totalPositions,
		totalBeliefs,
		durationMs: Date.now() - startedAt
	};

	fs.writeFileSync(path.join(shardDir, 'summary.json'), JSON.stringify(result, null, 2));
	return result;
}

async function runWorkerThread(payload: WorkerPayload): Promise<WorkerResult> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL(import.meta.url), { workerData: payload });
		worker.on('message', (message) => {
			if (message?.type === 'done') {
				resolve(message.result as WorkerResult);
			}
		});
		worker.on('error', reject);
		worker.on('exit', (code) => {
			if (code !== 0) reject(new Error(`Self-play worker exited with code ${code}`));
		});
	});
}

function createShards(
	persona: Exclude<PersonaArg, 'all'>,
	games: number,
	workers: number,
	seed: string,
	iterations: number,
	maxMoves: number,
	outputDir: string,
	progressEvery: number
) {
	const shardCount = Math.max(1, Math.min(workers, games));
	const gamesPerShard = Math.ceil(games / shardCount);

	return Array.from({ length: shardCount }, (_, shardIndex): WorkerPayload => {
		const startIndex = shardIndex * gamesPerShard;
		const endIndex = Math.min(games, startIndex + gamesPerShard);
		return {
			persona,
			seed,
			iterations,
			maxMoves,
			startIndex,
			endIndex,
			shardIndex,
			outputDir,
			progressEvery
		};
	}).filter((shard) => shard.startIndex < shard.endIndex);
}

async function runPersonaBatch(
	persona: Exclude<PersonaArg, 'all'>,
	games: number,
	seed: string,
	iterations: number,
	maxMoves: number,
	workers: number,
	progressEvery: number
) {
	const {
		createTrainingRunRecord,
		ensureAiTrainingStore,
		resolveTrainingOutputDir,
		updateTrainingRunProgress
	} = await import('../src/lib/server/ai/training-store');

	ensureAiTrainingStore();
	const run = createTrainingRunRecord({
		persona,
		seed,
		totalGames: games,
		config: { seed, persona, games, iterations, maxMoves, workers, progressEvery }
	});

	const shards = createShards(
		persona,
		games,
		workers,
		seed,
		iterations,
		maxMoves,
		run.outputDir,
		progressEvery
	);

	console.log(
		`Starting ${persona}: ${games} games, ${iterations} iterations, ${maxMoves} max moves, ${shards.length} worker(s)`
	);

	try {
		const results =
			shards.length === 1
				? [writeSamples(shards[0])]
				: await Promise.all(shards.map((shard) => runWorkerThread(shard)));

		const totalPositions = results.reduce((total, result) => total + result.totalPositions, 0);
		const totalBeliefRows = results.reduce((total, result) => total + result.totalBeliefs, 0);
		const gamesCompleted = results.reduce((total, result) => total + result.gamesCompleted, 0);

		updateTrainingRunProgress(run.id, {
			totalPositions,
			totalBeliefRows,
			status: 'completed'
		});

		const summary = {
			...run,
			gamesCompleted,
			totalPositions,
			totalBeliefRows,
			status: 'completed' as const,
			completedAt: Date.now(),
			outputDir: resolveTrainingOutputDir(run.id),
			shards: results
		};

		fs.writeFileSync(path.join(run.outputDir, 'summary.json'), JSON.stringify(summary, null, 2));
		writeCheckpoint(run.outputDir, {
			persona,
			seed,
			gamesCompleted,
			totalPositions,
			totalBeliefRows,
			status: 'completed'
		});
		console.log(JSON.stringify(summary, null, 2));
	} catch (error) {
		updateTrainingRunProgress(run.id, { status: 'failed' });
		writeCheckpoint(run.outputDir, {
			persona,
			seed,
			status: 'failed',
			error: error instanceof Error ? error.message : String(error)
		});
		throw error;
	}
}

async function main() {
	const persona = normalizePersona(readArg('persona', 'balanced'));
	const games = readNumberArg('games', 10);
	const seed = readArg('seed', 'gaple-self-play') ?? 'gaple-self-play';
	const iterations = readNumberArg('iterations', 24);
	const maxMoves = readNumberArg('max-moves', 80);
	const explicitWorkers = readArg('workers');
	const workerFallback = games < 100 ? 1 : defaultWorkerCount();
	const workers = Math.max(
		1,
		Math.floor(explicitWorkers === undefined ? workerFallback : readNumberArg('workers', workerFallback))
	);
	const progressEvery = Math.max(1, Math.floor(readNumberArg('progress-every', 25)));

	if (persona === 'all') {
		for (const nextPersona of ['balanced', 'aggressive', 'defensive'] as const) {
			await runPersonaBatch(nextPersona, games, seed, iterations, maxMoves, workers, progressEvery);
		}
		return;
	}

	await runPersonaBatch(persona, games, seed, iterations, maxMoves, workers, progressEvery);
}

if (!isMainThread) {
	const result = writeSamples(workerData as WorkerPayload);
	parentPort?.postMessage({ type: 'done', result });
} else {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
