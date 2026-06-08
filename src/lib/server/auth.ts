import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { customSession, magicLink } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import * as schema from './db/schema';
import { profiles } from './db/schema';
import crypto from 'node:crypto';
import { sendAuthEmail } from './email';

const baseURL = env.BETTER_AUTH_URL ?? (dev ? 'http://localhost:5173' : undefined);
const authSecret = env.BETTER_AUTH_SECRET ?? env.AUTH_SECRET;
const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
	socialProviders.github = {
		clientId: env.GITHUB_CLIENT_ID,
		clientSecret: env.GITHUB_CLIENT_SECRET
	};
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
	socialProviders.google = {
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET
	};
}

if (!authSecret && !dev) {
	throw new Error('BETTER_AUTH_SECRET (or AUTH_SECRET) must be set in production.');
}

export const auth = betterAuth({
	appName: 'Gaple',
	baseURL,
	secret: authSecret ?? 'gaple-dev-only-secret-change-me',
	database: drizzleAdapter(getDb(), {
		provider: 'sqlite',
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account
		}
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		requireEmailVerification: false
	},
	socialProviders,
	plugins: [
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				await sendAuthEmail({
					to: email,
					subject: 'Sign in ke Gaple',
					text: `Buka link ini untuk masuk ke Gaple: ${url}`,
					html: `
						<div style="font-family: Inter, Arial, sans-serif; line-height: 1.6; color: #1a1614;">
							<h2 style="margin: 0 0 12px;">Masuk ke Gaple</h2>
							<p style="margin: 0 0 16px;">Klik tombol di bawah untuk masuk tanpa password.</p>
							<p style="margin: 0 0 24px;">
								<a href="${url}" style="display:inline-block;background:#c2410c;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">
									Sign in now
								</a>
							</p>
							<p style="font-size: 12px; color: #6b5f57; margin: 0;">
								Jika tombol tidak berfungsi, salin tautan ini:<br />
								${url}
							</p>
						</div>
					`
				});
			}
		}),
		customSession(async ({ user, session }) => {
			const db = getDb();
			const profile = db.select().from(profiles).where(eq(profiles.userId, user.id)).get();
			return {
				user,
				session,
				profileId: profile?.id ?? null,
				isBot: profile?.isBot ?? false
			};
		}),
		sveltekitCookies(getRequestEvent)
	],
	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ['google', 'github', 'email-password'],
			allowDifferentEmails: false
		}
	},
	// Auto-create a profile record when a new user registers
	databaseHooks: {
		user: {
			create: {
				after: async (user) => {
					const db = getDb();
					const existing = db.select().from(profiles).where(eq(profiles.userId, user.id)).get();
					if (existing) return;

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
