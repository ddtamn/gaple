# Domino Engine Refactor Plan

## Goal

Evolve current prototype into:

* scalable game engine
* AI-ready architecture
* replay-ready system
* multiplayer-ready foundation

without rewriting everything from scratch.

---

# PHASE 1 — Stabilize Core Engine

## 1. Remove `$state()` from engine

### Current

```ts
left = $state(0)
```

### Refactor

```ts
left: number
```

### Why

Engine should be:

* pure TypeScript
* independent from Svelte runtime
* reusable for AI workers/server

Reactive state should exist only in UI layer.

---

## 2. Add unique `id` to Domino

### Current

```ts
new Domino(6, 5)
```

### Refactor

```ts
new Domino(id, 6, 5)
```

### Why

Needed for:

* animation
* multiplayer sync
* replay system
* AI simulation
* stable references

---

## 3. Replace `tileIndex` with `tileId`

### Current

```ts
nextTurn(playerIndex, tileIndex, side)
```

### Refactor

```ts
nextTurn(playerId, tileId, side)
```

### Why

Indexes are unstable after:

* sorting
* splicing
* syncing

IDs are stable.

---

## 4. Avoid mutation with `flip()`

### Current

```ts
tile.flip()
```

### Refactor

```ts
const flippedTile = flipped(tile)
```

### Why

Mutation will complicate:

* replay
* rollback
* AI simulations
* debugging

Prefer immutable operations.

---

# PHASE 2 — Better Architecture

## 5. Separate engine files

### Suggested structure

```txt
engine/
├── types.ts
├── board.ts
├── player.ts
├── game.ts
├── moves.ts
└── utils.ts
```

---

## 6. Centralize move validation

### Create

```ts
isValidMove(state, move)
```

### Why

Single source of truth for rules.

AI and UI should consume same validation.

---

## 7. Add `Move` type

```ts
type Move = {
  playerId: string;
  tileId: string;
  side: 'left' | 'right';
}
```

### Why

Important for:

* replay
* networking
* move history
* AI

---

## 8. Add `GameState`

### Create

```ts
type GameState = {
  players: Player[];
  board: Board;
  turnIndex: number;
}
```

### Why

Centralized state simplifies:

* save/load
* replay
* AI simulation
* multiplayer sync

---

# PHASE 3 — Deterministic System

## 9. Add move history

### Create

```ts
history: Move[]
```

### Why

Needed for:

* replay
* undo
* analytics
* AI training

---

## 10. Replace `Math.random()` with seeded RNG

### Current

```ts
Math.random()
```

### Why

Current shuffle is not reproducible.

### Suggested

Use:

* seedrandom
* custom PRNG

---

## 11. Add serialization

### Create

```ts
serializeGameState()
loadGameState()
```

### Why

Needed for:

* save/load
* multiplayer sync
* debugging
* replay system

---

# PHASE 4 — AI Preparation

## 12. Add clone system

### Create

```ts
cloneGameState()
```

### Why

AI will repeatedly:

* clone
* simulate
* rollback

thousands of times.

---

## 13. Add legal move generator

### Create

```ts
generateLegalMoves(player)
```

### Why

This becomes the foundation for AI.

---

## 14. Add pass system

### Missing features

* blocked turn
* no playable tiles
* pass handling

### Why

Critical for real gameplay and AI logic.

---

# PHASE 5 — Production Quality

## 15. Add event system

### Current

```ts
console.log()
```

### Refactor

```ts
GameEvent[]
```

### Example events

* MOVE_PLAYED
* PLAYER_PASS
* GAME_OVER

### Why

Decouples engine from UI.

---

## 16. Add unit tests

### Minimum tests

* valid move
* invalid move
* flip logic
* win detection
* blocked game

### Why

Game engines become fragile quickly without tests.

---

# Highest Priority Refactors

If focusing only on the most important upgrades:

1. Remove Svelte dependency from engine
2. Add tile IDs
3. Add Move type
4. Add centralized GameState
5. Add move history

These alone will massively improve scalability for:

* AI
* replay
* multiplayer
* synchronization
* spectator mode
* ranking systems
