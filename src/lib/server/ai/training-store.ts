import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getSqlite } from '../db';

const SELF_PLAY_ROOT = path.resolve('data', 'self-play');
const TRAINING_DB_DDL = `
	CREATE TABLE IF NOT EXISTS ai_training_runs (
		id TEXT PRIMARY KEY,
		persona TEXT NOT NULL,
		seed TEXT NOT NULL,
		total_games INTEGER NOT NULL DEFAULT 0,
		total_positions INTEGER NOT NULL DEFAULT 0,
		total_belief_rows INTEGER NOT NULL DEFAULT 0,
		output_dir TEXT NOT NULL,
		config_json TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'running',
		created_at INTEGER NOT NULL,
		completed_at INTEGER
	);

	CREATE TABLE IF NOT EXISTS ai_benchmark_runs (
		id TEXT PRIMARY KEY,
		baseline_persona TEXT NOT NULL,
		challenger_persona TEXT NOT NULL,
		seeds_json TEXT NOT NULL,
		summary_json TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
`;

export interface TrainingRunSeed {
	persona: string;
	seed: string;
	totalGames: number;
	outputDir?: string;
	config: Record<string, unknown>;
}

export interface TrainingRunRecord extends TrainingRunSeed {
	id: string;
	outputDir: string;
	status: 'running' | 'completed' | 'failed';
	createdAt: number;
	completedAt?: number | null;
	totalPositions: number;
	totalBeliefRows: number;
}

export interface BenchmarkRunRecord {
	id: string;
	baselinePersona: string;
	challengerPersona: string;
	seeds: string[];
	summary: Record<string, unknown>;
	createdAt: number;
}

interface TrainingRunRow {
	id: string;
	total_positions: number;
	total_belief_rows: number;
	status: TrainingRunRecord['status'];
	completed_at: number | null;
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
}

export function ensureAiTrainingStore() {
	const sqlite = getSqlite();
	ensureDir(SELF_PLAY_ROOT);
	sqlite.exec(TRAINING_DB_DDL);
}

export function createTrainingRunRecord(seed: TrainingRunSeed): TrainingRunRecord {
	ensureAiTrainingStore();

	const id = crypto.randomUUID();
	const createdAt = Date.now();
	const outputDir = seed.outputDir ?? path.join(SELF_PLAY_ROOT, id);
	const record: TrainingRunRecord = {
		id,
		persona: seed.persona,
		seed: seed.seed,
		totalGames: seed.totalGames,
		totalPositions: 0,
		totalBeliefRows: 0,
		outputDir,
		config: seed.config,
		status: 'running',
		createdAt,
		completedAt: null
	};

	ensureDir(outputDir);
	getSqlite()
		.prepare(
			`INSERT INTO ai_training_runs (
				id, persona, seed, total_games, total_positions, total_belief_rows,
				output_dir, config_json, status, created_at, completed_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			record.id,
			record.persona,
			record.seed,
			record.totalGames,
			record.totalPositions,
			record.totalBeliefRows,
			record.outputDir,
			JSON.stringify(record.config),
			record.status,
			record.createdAt,
			record.completedAt
		);

	return record;
}

export function updateTrainingRunProgress(
	runId: string,
	patch: { totalPositions?: number; totalBeliefRows?: number; status?: TrainingRunRecord['status'] }
) {
	ensureAiTrainingStore();
	const existing = getSqlite()
		.prepare(`SELECT * FROM ai_training_runs WHERE id = ?`)
		.get(runId) as TrainingRunRow | undefined;

	if (!existing) {
		throw new Error(`Training run not found: ${runId}`);
	}

	const next = {
		totalPositions: patch.totalPositions ?? existing.total_positions,
		totalBeliefRows: patch.totalBeliefRows ?? existing.total_belief_rows,
		status: patch.status ?? existing.status,
		completedAt: patch.status && patch.status !== 'running' ? Date.now() : existing.completed_at ?? null
	};

	getSqlite()
		.prepare(
			`UPDATE ai_training_runs
			 SET total_positions = ?, total_belief_rows = ?, status = ?, completed_at = ?
			 WHERE id = ?`
		)
		.run(next.totalPositions, next.totalBeliefRows, next.status, next.completedAt, runId);
}

export function recordBenchmarkRun(record: BenchmarkRunRecord) {
	ensureAiTrainingStore();
	getSqlite()
		.prepare(
			`INSERT INTO ai_benchmark_runs (
				id, baseline_persona, challenger_persona, seeds_json, summary_json, created_at
			) VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(
			record.id,
			record.baselinePersona,
			record.challengerPersona,
			JSON.stringify(record.seeds),
			JSON.stringify(record.summary),
			record.createdAt
		);
}

export function appendJsonlRecord(filePath: string, record: unknown) {
	ensureDir(path.dirname(filePath));
	fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function resolveTrainingOutputDir(runId: string) {
	return path.join(SELF_PLAY_ROOT, runId);
}
