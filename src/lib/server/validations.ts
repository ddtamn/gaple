import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { profiles, matches } from './db/schema';

// Generate schema langsung dari Drizzle untuk konsistensi
export const ProfileSchema = createSelectSchema(profiles);
export const InsertMatchSchema = createInsertSchema(matches);

// Validasi saat PartyKit mengirim hasil game (Game Over) ke API SvelteKit
export const MatchResultPayloadSchema = z.object({
	roomId: z.string(),
	mode: z.enum(['ffa', 'coop-vs-ai', 'coop-vs-coop']),
	durationSeconds: z.number().min(0),
	participants: z
		.array(
			z.object({
				profileId: z.string().uuid(),
				teamId: z.number().optional(),
				score: z.number(),
				isWinner: z.boolean()
			})
		)
		.length(4) // Harus selalu 4 pemain
});

export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;
