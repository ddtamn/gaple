import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';
import * as schema from './db/schema';
import { profiles } from './db/schema';
import crypto from 'node:crypto';

export const auth = betterAuth({
	database: drizzleAdapter(getDb(), {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account
		}
	}),
	emailAndPassword: {
		enabled: true
	},
	// Auto-create a profile record when a new user registers
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const db = getDb();
					db.insert(profiles)
						.values({
							id: crypto.randomUUID(),
							userId: user.id,
							name: user.name || 'Player',
							isBot: false,
							isActive: false,
							mmr: 1000,
							matchesPlayed: 0,
							matchesWon: 0,
							createdAt: new Date()
						})
						.run();
				}
			}
		}
	}
});
