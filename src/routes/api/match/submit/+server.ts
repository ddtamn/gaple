import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { assertInternalPartykitRequest } from '$lib/server/internal';
import { profiles, matches, matchParticipants } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { MatchResultPayloadSchema } from '$lib/server/validations';
import crypto from 'node:crypto';
import type { RequestHandler } from './$types';

/**
 * POST /api/match/submit
 *
 * Submitted by PartyKit when a game ends.
 * Creates match records, calculates MMR changes, updates profiles.
 *
 * Body: MatchResultPayload
 *   { roomId, mode, durationSeconds, participants: [{ profileId, teamId?, score, isWinner }] }
 */
export const POST: RequestHandler = async ({ request }) => {
	assertInternalPartykitRequest(request);
	const body = await request.json();

	// 1. Validate payload with Zod
	const parsed = MatchResultPayloadSchema.safeParse(body);
	if (!parsed.success) {
		throw error(400, `Invalid match payload: ${parsed.error.message}`);
	}

	const { roomId, mode, durationSeconds, participants } = parsed.data;
	const db = getDb();

	// 2-5. Insert match + participants and update profile stats atomically
	const { matchId, mmrChanges } = db.transaction((tx) => {
		const matchId = crypto.randomUUID();

		tx.insert(matches)
			.values({
				id: matchId,
				roomId,
				mode,
				durationSeconds,
				createdAt: new Date()
			})
			.run();

		// Winner: +25 MMR, Loser: -25 MMR
		const mmrChanges: Record<string, number> = {};
		for (const p of participants) {
			mmrChanges[p.profileId] = p.isWinner ? 25 : -25;
		}

		const participantRecords = participants.map((p) => ({
			id: crypto.randomUUID(),
			matchId,
			profileId: p.profileId,
			teamId: p.teamId ?? null,
			score: p.score,
			mmrChange: mmrChanges[p.profileId],
			isWinner: p.isWinner
		}));

		tx.insert(matchParticipants).values(participantRecords).run();

		for (const p of participants) {
			const profile = tx
				.select()
				.from(profiles)
				.where(eq(profiles.id, p.profileId))
				.get();

			if (!profile) continue;

			const mmrChange = mmrChanges[p.profileId];
			const newMmr = Math.max(0, profile.mmr + mmrChange);

			tx.update(profiles)
				.set({
					mmr: newMmr,
					matchesPlayed: profile.matchesPlayed + 1,
					matchesWon: profile.matchesWon + (p.isWinner ? 1 : 0),
					isActive: false,
					lastPlayedAt: new Date()
				})
				.where(eq(profiles.id, p.profileId))
				.run();
		}

		return { matchId, mmrChanges };
	});

	return json({
		success: true,
		matchId,
		mmrChanges
	});
};
