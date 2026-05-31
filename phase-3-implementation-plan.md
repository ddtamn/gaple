# Gaple Phase 3 Implementation Plan

## Overview

Sebelum migrasi ke multiplayer online, seluruh logika permainan lokal harus matang dan stabil terlebih dahulu.

Prioritas implementasi:

1. AI Scoring-Aware MCTS
2. Team / Alliance System
3. Multiplayer Server Architecture (PartyKit)
4. Room System
5. Real-Time Synchronization
6. Database & Leaderboard

**IMPORTANT**

Jangan mulai implementasi poin 3-6 sebelum poin 1 dan 2 selesai sepenuhnya.

Target utama fase ini adalah memastikan seluruh game logic dapat dipindahkan ke server tanpa perubahan besar.

---

# Phase 3.1 — AI Scoring-Aware Monte Carlo Tree Search

## Objective

Mengubah AI dari:

```text
Menang = 1
Kalah = 0
```

menjadi:

```text
Cari expected score tertinggi
```

AI harus mempertimbangkan seluruh sistem penilaian Gaple.

---

## Current Problem

MCTS saat ini hanya mengevaluasi:

```ts
win ? 1 : 0
```

Akibatnya:

* Tidak menghargai kemenangan balak
* Tidak menghargai gaple
* Tidak menghargai forcing pass
* Tidak memahami nilai kemenangan besar

---

## New Evaluation Model

Buat fungsi:

```ts
calculateRoundScore(gameState)
```

Return:

```ts
{
    winner: number;
    score: number;
}
```

---

## Scoring Rules

### Normal Win

```text
+1
```

### Balak Finish

Jika kartu terakhir adalah balak:

```text
+4
```

atau sesuai rules engine yang digunakan.

---

### Gaple / Blocked Board

Jika seluruh pemain pass:

Hitung total pip tiap pemain.

Pemain dengan total terkecil menang.

Contoh:

P0 = 12
P1 = 25
P2 = 8
P3 = 19

Winner = P2

````

Score diberikan sesuai rules game.

---

### Forced Pass Bonus

Opsional:

```text
+1 setiap lawan yang dipaksa pass
````

Nilai ini dapat digunakan sebagai heuristic.

---

## MCTS Changes

### Current

```ts
backpropagate(node, winner)
```

### New

```ts
backpropagate(node, score)
```

Node harus menyimpan:

```ts
visits
totalScore
averageScore
```

---

## UCT Formula

Current:

```ts
wins / visits
```

New:

```ts
averageScore +
explorationConstant *
Math.sqrt(Math.log(parentVisits) / visits)
```

---

## Expected AI Improvements

AI dapat:

* Menahan balak untuk finishing
* Memilih kemenangan bernilai tinggi
* Memaksa lawan pass
* Sengaja membuat gaple bila unggul pip
* Menghindari kemenangan bernilai kecil

---

## Acceptance Criteria

* AI tetap legal
* AI tidak crash
* AI mengejar expected score tertinggi
* Balak finish lebih sering terjadi
* Gaple strategy muncul secara natural

---

# Phase 3.2 — Team / Alliance System

## Objective

Menambahkan mode permainan tim.

---

## Supported Modes

### Free For All

```text
P0 vs P1 vs P2 vs P3
```

---

### Coop vs AIs

```text
P0 + P2
vs
P1 + P3
```

---

### Coop vs Coop

```text
Human + Human
vs
Human + Human
```

---

## New Structures

### Team

```ts
type TeamId = 0 | 1;
```

---

### Player

Tambahkan:

```ts
teamId: TeamId;
```

---

### GameState

Tambahkan:

```ts
teams: Team[];
```

---

## Winner Resolution

Current:

```ts
winnerPlayerId
```

New:

```ts
winnerTeamId
```

---

## Score Distribution

Jika:

```text
P0 menang
```

Maka:

```text
Team A menang
```

Skor masuk ke tim.

---

## AI Team Awareness

AI harus mengenali:

```text
partner
enemy
```

---

## Team Heuristics

### Avoid Partner Blocking

Contoh:

Partner membutuhkan angka:

```text
6
```

AI tidak boleh:

```text
menutup kedua ujung dengan angka lain
```

jika itu menghilangkan kesempatan partner bermain.

---

### Prefer Partner Mobility

Heuristic:

```text
maximize team legal moves
```

bukan hanya:

```text
maximize self legal moves
```

---

### Shared Victory

Jika partner memiliki peluang menang lebih cepat:

AI boleh membantu.

Contoh:

```text
partner tinggal 1 kartu
AI masih 5 kartu
```

AI boleh membuka jalur untuk partner.

---

## Acceptance Criteria

* Team mode berjalan
* Team score dihitung benar
* AI mengenali partner
* AI membantu partner secara aktif

---

# Phase 3.3 — Multiplayer Preparation Refactor

## Objective

Memisahkan game engine dari UI agar siap dipindah ke server.

---

## Engine Rules

Engine tidak boleh mengetahui:

* Svelte
* DOM
* Animation
* Embla
* FLIP

Engine hanya mengelola:

```ts
GameState
Move
Rules
AI
Scoring
```

---

## Required Structure

```text
src/lib/game/
├─ board.ts
├─ game.ts
├─ moves.ts
├─ scoring.ts
├─ teams.ts
├─ ai/
│  ├─ mcts.ts
│  ├─ rollout.ts
│  └─ evaluator.ts
```

---

## Acceptance Criteria

Engine dapat dijalankan:

* Browser
* Web Worker
* Node.js
* PartyKit

tanpa perubahan kode.

---

# Phase 3.4 — PartyKit Multiplayer Architecture

## Objective

Menjadikan server sebagai single source of truth.

---

## Responsibilities

Server menyimpan:

* deck
* hands
* turn
* board
* score
* room state

Client tidak boleh memiliki authority.

---

## Migration Strategy

Pindahkan:

```text
game.ts
board.ts
moves.ts
scoring.ts
teams.ts
ai/
```

ke server package.

---

## Remove

Web Worker AI.

AI berjalan di server.

---

## Acceptance Criteria

Semua keputusan game berasal dari server.

---

# Phase 3.5 — Room System

## Room Code

Format:

```text
X7B9
AB3K
T9M2
```

---

## Features

### Create Room

Return:

```ts
roomCode
```

---

### Join Room

Input:

```ts
roomCode
```

---

### Seat Assignment

```text
Bottom
Left
Top
Right
```

---

### Waiting Room

Menampilkan:

* Player Name
* Seat
* Ready Status

---

### Host Controls

Host dapat:

* Start Game
* Kick Player
* Change Mode

---

## Acceptance Criteria

4 pemain dapat masuk room yang sama.

---

# Phase 3.6 — Real-Time Synchronization

## Objective

Seluruh state berasal dari server.

---

## Current

Client:

```ts
game.play(...)
game.nextTurn(...)
```

---

## New Flow

Client:

```json
{
  "type": "PLAY_TILE",
  "tile": [3,4],
  "side": "left"
}
```

---

Server:

Validasi move.

---

Server Broadcast

```json
{
  "type": "MOVE_ACCEPTED",
  "player": 0,
  "tile": [3,4],
  "side": "left"
}
```

---

Client

Update animation.

---

## Important

Client tidak boleh mengubah game state sebelum server mengirim event valid.

---

## Acceptance Criteria

Semua pemain melihat board identik.

---

# Phase 3.7 — Database & Leaderboard

## Objective

Persist match history dan ranking.

---

## Candidate Providers

### Supabase

Recommended.

---

### Firebase

Alternative.

---

## User Profile

Minimal:

```ts
id
username
avatar
rating
gamesPlayed
wins
losses
```

---

## Match Record

```ts
matchId
date
players
winner
score
duration
```

---

## Rating System

Gunakan:

```text
MMR
```

atau

```text
ELO
```

---

## Leaderboard

Tampilkan:

```text
Top 100 Players
```

berdasarkan rating.

---

## Acceptance Criteria

* Match tersimpan
* Rating berubah otomatis
* Leaderboard realtime
* Top 100 dapat ditampilkan di lobby

---

# Final Milestone

Urutan implementasi wajib:

```text
1. AI Scoring-Aware MCTS
2. Team System
3. Engine Refactor
4. PartyKit Server
5. Room System
6. Realtime Sync
7. Database & Leaderboard
```

Tidak boleh mulai multiplayer sebelum AI dan Team System stabil pada mode offline.
