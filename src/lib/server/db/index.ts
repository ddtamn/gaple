import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve('data');
const DB_PATH = path.join(DATA_DIR, 'gaple.db');

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Get or create the Drizzle ORM database instance.
 * The SQLite database file is created at `data/gaple.db` relative to the project root.
 */
export function getDb() {
	if (_db) return _db;

	// Ensure data directory exists
	if (!fs.existsSync(DATA_DIR)) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
	}

	const sqlite = new Database(DB_PATH);

	// Enable WAL mode for better concurrent read performance
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');

	_db = drizzle(sqlite, { schema });

	return _db;
}

/**
 * Get the raw better-sqlite3 database instance (for direct queries if needed).
 */
export function getSqlite(): Database.Database {
	const db = getDb();
	// Access the underlying sqlite instance from the Drizzle wrapper
	return (db as unknown as { session: { client: Database.Database } }).session.client;
}

/**
 * Close the database connection gracefully.
 */
export function closeDb() {
	if (_db) {
		const sqlite = getSqlite();
		sqlite.close();
		_db = null;
	}
}
