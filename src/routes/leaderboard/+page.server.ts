import { getDb } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';
import { desc, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDb();

	const topPlayers = db
		.select({
			id: profiles.id,
			name: profiles.name,
			isBot: profiles.isBot,
			mmr: profiles.mmr,
			matchesPlayed: profiles.matchesPlayed,
			matchesWon: profiles.matchesWon
		})
		.from(profiles)
		.where(sql`${profiles.matchesPlayed} > 0 OR ${profiles.isBot} = 0`)
		.orderBy(desc(profiles.mmr))
		.limit(100)
		.all();

	const totalPlayers = db
		.select({ count: sql<number>`COUNT(*)` })
		.from(profiles)
		.where(sql`${profiles.isBot} = 0`)
		.get();

	return {
		players: topPlayers,
		totalHumans: totalPlayers?.count ?? 0
	};
};
