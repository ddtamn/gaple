import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { eq, lt, inArray, sql } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * POST /api/ai/acquire
 *
 * Acquires (locks) available AI bots for a game room.
 * If not enough bots are available, generates new ones.
 *
 * Body: { count: number }
 * Response: { bots: Array<{ id: string, name: string, mmr: number }> }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const count = typeof body.count === 'number' ? body.count : 4;

	if (count < 1 || count > 8) {
		throw error(400, 'count must be between 1 and 8');
	}

	const db = getDb();
	const now = Date.now();

	// 1. Bebaskan bot "Zombie" (yang nyangkut aktif lebih dari 2 jam)
	const twoHoursAgo = new Date(now - TWO_HOURS_MS);
	db.update(profiles)
		.set({ isActive: false })
		.where(
			sql`${profiles.isBot} = 1 AND ${profiles.isActive} = 1 AND ${profiles.lastPlayedAt} IS NOT NULL AND ${profiles.lastPlayedAt} < ${twoHoursAgo.getTime()}`
		)
		.run();

	// 2. Ambil Bot yang tersedia (random order)
	const availableBots = db
		.select()
		.from(profiles)
		.where(sql`${profiles.isBot} = 1 AND ${profiles.isActive} = 0`)
		.orderBy(sql`RANDOM()`)
		.limit(count)
		.all();

	let bots = [...availableBots];

	// 3. Jika kurang, generate AI baru
	if (bots.length < count) {
		const newBots: Array<{
			id: string;
			name: string;
			isBot: boolean;
			isActive: boolean;
			mmr: number;
			matchesPlayed: number;
			matchesWon: number;
			createdAt: Date;
		}> = [];

		const botNames = [
			'AI Baru 1',
			'AI Baru 2',
			'AI Baru 3',
			'AI Baru 4',
			'AI Baru 5',
			'AI Baru 6',
			'AI Baru 7',
			'AI Baru 8'
		];

		const needed = count - bots.length;
		for (let i = 0; i < needed; i++) {
			const mmr = 800 + Math.floor(Math.random() * 1400);
			newBots.push({
				id: crypto.randomUUID(),
				name: botNames[i] || `Bot-${crypto.randomUUID().slice(0, 4)}`,
				isBot: true,
				isActive: true,
				mmr,
				matchesPlayed: 0,
				matchesWon: 0,
				createdAt: new Date()
			});
		}

		if (newBots.length > 0) {
			db.insert(profiles).values(newBots).run();
			bots = [...bots, ...newBots];
		}
	}

	// 4. Lock bot tersebut (set isActive = true, lastPlayedAt = now)
	const botIds = bots.map((b) => b.id);
	if (botIds.length > 0) {
		db.update(profiles)
			.set({ isActive: true, lastPlayedAt: new Date() })
			.where(inArray(profiles.id, botIds))
			.run();
	}

	return json({
		bots: bots.map((b) => ({
			id: b.id,
			name: b.name,
			mmr: b.mmr
		}))
	});
};
