# Refactoring Plan: GameArea.svelte Layout Restructure

## Goal
Restructure `GameArea.svelte` from absolute-positioned layout to clean flexbox layout, improve coop score display, and replace round-result modal with inline UI.

---

## Step 1: Commit Existing Changes

The following files have unstaged changes that need a meaningful commit before refactoring:

- `src/lib/components/GameArea.svelte` — current WIP changes
- `src/lib/components/LobbyRoom.svelte` — rounds prop type fix
- `src/lib/multiplayer/room.svelte.ts` — multiplayer round tracking, nextRound action
- `src/lib/multiplayer/types.ts` — NextRoundMessage type
- `src/parties/game-room.ts` — handleNextRound server logic
- `src/routes/+page.svelte` — flow: all modes go through round selection first

**Commit message:** `feat(multiplayer): add round progression, next round handler, flow improvements`

---

## Step 2: New Flexbox Layout Structure

Replace absolute positioning with a simple vertical flexbox column:

```
┌─────────────────────────────────────────────┐
│  [Layer 1] Game Info Bar                     │
│  Mode | Round X/Y  |  [Coop: Team Score]     │
├─────────────────────────────────────────────┤
│  [Layer 2] Round Result Text (shown on win)  │
│  "🎉 Anda Menang!" / "AI Kanan Menang!"     │
│  +points info                                │
├─────────────────────────────────────────────┤
│  [Layer 3] 3 Opponent Player Areas          │
│  (Row: BotAvatar + PlayerHand each)          │
├─────────────────────────────────────────────┤
│  [Layer 4] Middle Table (board + tiles)     │
├─────────────────────────────────────────────┤
│  [Layer 5] "Lanjut Ronde / Ke Lobi" Buttons │
│  (shown after round ends)                    │
├─────────────────────────────────────────────┤
│  [Layer 6] Main Player Hand                 │
└─────────────────────────────────────────────┘
```

Each layer uses CSS flexbox. No absolute positioning for layout foundation.
The board tiles area retains its internal SVG/canvas-like coordinate system, but the
container itself is positioned with flexbox.

### Opponent Player Areas (Layer 3)

All 3 opponent players sit in a single horizontal row with `justify-content: space-around`:
- Left opponent (index 3 on POV)
- Top opponent (index 2 on POV)
- Right opponent (index 1 on POV)

Their `PlayerHand` components show card backs (or faces if same team in coop).

---

## Step 3: Coop Score Display

- **In game info bar (Layer 1):** Add team scores like `Score: 3 | 4` when in coop mode.
- **Per-player score hidden:** Remove individual winCount / pointStandings from BotAvatar and PlayerHand when `isCoopMode` is true.
- Compute team scores from `currentGameState.pointStandings` grouped by `teamId`.

---

## Step 4: Round Result — No Modal

Current: modal overlay (`fixed inset-0 z-50 flex items-center justify-center...`)

New:
- Remove the modal entirely.
- Show win announcement text between Layer 1 and Layer 3 (inline, not overlay).
- Show "Lanjut Ronde" and "Ke Lobi" buttons between Layer 4 (board) and Layer 6 (main hand).
- Match over (last round finished) shows a similar inline summary with final standings.

---

## Step 5: Clean Up & Commit

- Remove unused variables/imports after restructure.
- Test locally with `npm run dev` and check for build errors with `npx svelte-check`.
- Commit with message: `refactor(ui): restructure GameArea to flexbox layout, remove modal for round results`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/components/GameArea.svelte` | Major: layout restructure, result UI, coop scores |
