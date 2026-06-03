# 📄 `backend-spec.md`

## 1. Tech Stack & Infrastructure

- **Framework:** SvelteKit (Meta-framework)
- **Realtime Server:** PartyKit (Authoritative Game Server)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Drizzle ORM
- **Authentication:** Better Auth
- **Validation:** Zod (via `drizzle-zod` dan validasi input)

---

## 2. System Architecture Flow

1. **Authentication:** User login menggunakan **Better Auth** di sisi SvelteKit.
2. **Game Lobby:** SvelteKit mengambil data `profiles` (Leaderboard) via **Drizzle ORM**.
3. **Room Creation:** Saat user membuat room mode VS AI, Server PartyKit melakukan query ke database via Drizzle untuk mencari AI (Bots) yang `is_active = false`.
4. **Game Loop:** Berjalan secara realtime di PartyKit (Stateless terhadap DB selama game berjalan).
5. **Game Over:** PartyKit mengirimkan payload `MatchResult` (divalidasi dengan **Zod**) ke endpoint/fungsi database untuk mencatat history dan memperbarui nilai MMR (Matchmaking Rating).

---

## 3. Database Schema (Drizzle ORM)

Entitas pemain (baik Manusia maupun AI) akan disatukan dalam tabel `profiles` agar pembuatan Leaderboard menjadi sangat mudah.

Buat file: `src/lib/server/db/schema.ts`

```typescript
import { pgTable, text, integer, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ------------------------------------------------------
// 1. Better Auth Tables (Standard)
// ------------------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull()
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id)
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  password: text("password")
});

// ------------------------------------------------------
// 2. Game Specific Tables
// ------------------------------------------------------

// Tabel profiles menyatukan Player (Human) dan AI (Bot)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => user.id), // Nullable. Jika null, berarti dia adalah AI/Bot.
  name: text("name").notNull(),
  isBot: boolean("is_bot").default(false).notNull(),
  isActive: boolean("is_active").default(false).notNull(), // Lock untuk AI yang sedang main
  mmr: integer("mmr").default(1000).notNull(), // Rating awal 1000
  matchesPlayed: integer("matches_played").default(0).notNull(),
  matchesWon: integer("matches_won").default(0).notNull(),
  lastPlayedAt: timestamp("last_played_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Menyimpan history permainan
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: text("room_id").notNull(),
  mode: text("mode").notNull(), // 'ffa', 'coop-vs-ai', 'coop-vs-coop'
  durationSeconds: integer("duration_seconds").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Menyimpan detail pemain di dalam suatu match
export const matchParticipants = pgTable("match_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").references(() => matches.id).notNull(),
  profileId: uuid("profile_id").references(() => profiles.id).notNull(),
  teamId: integer("team_id"), // 0 atau 1 (untuk mode coop)
  score: integer("score").notNull(),
  mmrChange: integer("mmr_change").notNull(), // Nilai plus/minus MMR setelah match
  isWinner: boolean("is_winner").notNull(),
});

// ------------------------------------------------------
// 3. Relations (Untuk Drizzle Query)
// ------------------------------------------------------
export const matchesRelations = relations(matches, ({ many }) => ({
  participants: many(matchParticipants),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  matchHistory: many(matchParticipants),
}));
```

---

## 4. Zod Validation Schemas

Digunakan untuk memvalidasi payload antara PartyKit dan SvelteKit Backend.
Buat file: `src/lib/server/validations.ts`

```typescript
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
  participants: z.array(z.object({
    profileId: z.string().uuid(),
    teamId: z.number().optional(),
    score: z.number(),
    isWinner: z.boolean(),
  })).length(4), // Harus selalu 4 pemain
});

export type MatchResultPayload = z.infer<typeof MatchResultPayloadSchema>;
```

---

## 5. Core Logics (To Implement)

### A. AI Registry Manager (Server Action)

Fungsi yang akan dipanggil oleh SvelteKit/PartyKit sebelum memulai game untuk mendapatkan Bot.

```typescript
// Pseudocode Logic
async function getAvailableAIs(count: number) {
  // 1. Bebaskan bot "Zombie" (yang nyangkut aktif lebih dari 2 jam)
  await db.update(profiles)
    .set({ isActive: false })
    .where(and(eq(profiles.isBot, true), lt(profiles.lastPlayedAt, TwoHoursAgo)));

  // 2. Ambil Bot yang tersedia
  const bots = await db.select()
    .from(profiles)
    .where(and(eq(profiles.isBot, true), eq(profiles.isActive, false)))
    .orderBy(sql`RANDOM()`)
    .limit(count);

  if (bots.length < count) {
     // 3. Jika kurang, generate AI baru (Dataset Generation)
     const newBots = generateNewBots(count - bots.length);
     await db.insert(profiles).values(newBots);
     bots.push(...newBots);
  }

  // 4. Lock bot tersebut
  const botIds = bots.map(b => b.id);
  await db.update(profiles).set({ isActive: true }).where(inArray(profiles.id, botIds));

  return bots;
}
```

### B. Rating (MMR) Calculator

Saat game over, hitung perubahan MMR sebelum di-_insert_ ke database.

- **Winner:** `+25 MMR`
- **Loser:** `-25 MMR`
- **Bot Modifier:** AI yang sering menang (MMR tinggi) akan menjadi lebih "pintar" (logic ini bisa diimplementasikan di `GameEngine` nantinya dengan membaca nilai MMR).

### C. PartyKit End-of-Game Lifecycle

Di file `game-room.ts` milik PartyKit, tambahkan lifecycle ini:

1. Saat `game.state.result` terpanggil (Game Over).
2. PartyKit mengumpulkan profil ID dari 4 pemain.
3. PartyKit melakukan HTTP `POST` ke endpoint SvelteKit (misal: `/api/match/submit`) menggunakan payload sesuai `MatchResultPayloadSchema`.
4. Endpoint Drizzle menyimpan ke tabel `matches`, memperbarui `mmr` dan `is_active = false` (unlock) untuk semua ID di tabel `profiles`.

---

## 6. Implementation Phasing

- **Phase 1: Database & Auth Setup**
  - Install `better-auth`, `drizzle-orm`, `drizzle-zod`, `postgres`, `zod`.
  - Setup koneksi Supabase Postgres di `src/lib/server/db/index.ts`.
  - Push `schema.ts` ke Supabase (`drizzle-kit push`).
  - Setup Better Auth client dan server.
- **Phase 2: Entity Linking**
  - Buat webhook/callback di Better Auth: Saat _Human User_ register, otomatis buatkan record di tabel `profiles` (dengan `isBot: false`).
- **Phase 3: API Endpoints**
  - Buat endpoint `/api/ai/acquire` (mengunci AI untuk room).
  - Buat endpoint `/api/match/submit` (menulis data post-match, unlock AI, dan kalkulasi MMR).
- **Phase 4: Leaderboard UI**
  - Buat `+page.server.ts` di halaman Lobby untuk query top 100 `profiles` berdasarkan `mmr`.
- **Phase 5: PartyKit Integration**
  - Update `game-room.ts` untuk memanggil API di atas saat room dibuat dan saat game selesai.
