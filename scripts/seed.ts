/**
 * Seed script: Creates AI bot profiles in the database.
 *
 * Usage:
 *   pnpm tsx scripts/seed.ts
 *
 * This script generates a set of AI profiles with varied MMR ratings
 * so they can be used in games. It also creates a demo human profile.
 */

import { getDb, closeDb } from '../src/lib/server/db';
import { profiles } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

const AI_NAMES = [
	'AI Kanan',
	'AI Kiri',
	'AI Atas',
	'AI Bawah',
	'Bot Santai',
	'Bot Galak',
	'Bot Ahli',
	'Bot Pemula',
	'Bot Senior',
	'Bot Junior'
];

async function seed() {
	console.log('🌱 Seeding database...');

	const db = getDb();

	// Check if AI profiles already exist
	const allProfiles = db.select().from(profiles).all();

	if (allProfiles.length > 5) {
		console.log(`✅ ${allProfiles.length} profiles already exist. Skipping seed.`);
		closeDb();
		return;
	}

	console.log('Creating AI bot profiles...');

	for (const name of AI_NAMES) {
		const mmr = 800 + Math.floor(Math.random() * 1400); // 800–2200
		db.insert(profiles)
			.values({
				id: crypto.randomUUID(),
				name,
				isBot: true,
				isActive: false,
				mmr,
				matchesPlayed: 0,
				matchesWon: 0,
				createdAt: new Date()
			})
			.run();
	}

	console.log(`✅ Created ${AI_NAMES.length} AI profiles.`);

	// Create a demo human profile (for testing without full auth)
	const existingHuman = db
		.select()
		.from(profiles)
		.where(eq(profiles.name, 'Player Demo'))
		.get();

	if (!existingHuman) {
		db.insert(profiles)
			.values({
				id: crypto.randomUUID(),
				name: 'Player Demo',
				isBot: false,
				isActive: false,
				mmr: 1000,
				matchesPlayed: 0,
				matchesWon: 0,
				createdAt: new Date()
			})
			.run();
		console.log('✅ Created demo human profile.');
	}

	console.log('🎉 Seeding complete!');
	closeDb();
}

seed().catch((err) => {
	console.error('❌ Seed failed:', err);
	closeDb();
	process.exit(1);
});
