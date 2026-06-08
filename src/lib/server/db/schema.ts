import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ------------------------------------------------------
// 1. Better Auth Tables (SQLite adapted)
// ------------------------------------------------------
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull(),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId')
		.notNull()
		.references(() => user.id)
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	password: text('password')
});

// ------------------------------------------------------
// 2. Game Specific Tables
// ------------------------------------------------------

// Tabel profiles menyatukan Player (Human) dan AI (Bot)
export const profiles = sqliteTable('profiles', {
	id: text('id').primaryKey(), // UUID generated in application code
	userId: text('user_id').unique().references(() => user.id), // Nullable. Jika null, berarti dia adalah AI/Bot.
	name: text('name').notNull(),
	isBot: integer('is_bot', { mode: 'boolean' }).default(false).notNull(),
	isActive: integer('is_active', { mode: 'boolean' }).default(false).notNull(), // Lock untuk AI yang sedang main
	mmr: integer('mmr').default(1000).notNull(), // Rating awal 1000
	matchesPlayed: integer('matches_played').default(0).notNull(),
	matchesWon: integer('matches_won').default(0).notNull(),
	lastPlayedAt: integer('last_played_at', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Menyimpan history permainan
export const matches = sqliteTable('matches', {
	id: text('id').primaryKey(), // UUID generated in application code
	roomId: text('room_id').notNull(),
	mode: text('mode').notNull(), // 'ffa', 'coop-vs-ai', 'coop-vs-coop'
	durationSeconds: integer('duration_seconds').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.$defaultFn(() => new Date())
		.notNull()
});

// Menyimpan detail pemain di dalam suatu match
export const matchParticipants = sqliteTable('match_participants', {
	id: text('id').primaryKey(), // UUID generated in application code
	matchId: text('match_id')
		.references(() => matches.id)
		.notNull(),
	profileId: text('profile_id')
		.references(() => profiles.id)
		.notNull(),
	teamId: integer('team_id'), // 0 atau 1 (untuk mode coop)
	score: integer('score').notNull(),
	mmrChange: integer('mmr_change').notNull(), // Nilai plus/minus MMR setelah match
	isWinner: integer('is_winner', { mode: 'boolean' }).notNull()
});

// ------------------------------------------------------
// 3. Relations (Untuk Drizzle Query)
// ------------------------------------------------------
export const matchesRelations = relations(matches, ({ many }) => ({
	participants: many(matchParticipants)
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
	matchHistory: many(matchParticipants)
}));
