# Gaple Animation System Architecture v1

## Objective

Implement a production-grade animation architecture for Gaple that provides:

* Smooth 60 FPS gameplay
* Native-like card animations similar to Higgs Domino
* Fully decoupled game logic and animation systems
* Reusable animation presets
* Support for future replay mode
* Support for future spectator mode
* Support for future multiplayer synchronization

---

# Core Design Principles

## Rule 1: Game Engine Must Not Know Animations

The game engine should only emit events.

Bad:

```ts
playCard(card);
animateCard(card);
```

Good:

```ts
emit('CARD_PLAYED', {
  playerId,
  cardId,
  position
});
```

Animation system reacts to events.

---

## Rule 2: UI Components Must Not Contain GSAP Logic

Bad:

```svelte
<script>
gsap.to(...)
</script>
```

Good:

```svelte
<Card bind:this={element} />
```

AnimationManager owns all GSAP calls.

---

## Rule 3: Animations Are Event Driven

Flow:

```text
Game Engine
    ↓
Game Event
    ↓
Animation Queue
    ↓
Animation Manager
    ↓
GSAP Timeline
    ↓
Visual Update
```

---

# Folder Structure

```text
src/
├── lib/
│
├── game/
│   ├── engine/
│   ├── ai/
│   ├── rules/
│   └── events/
│
├── animation/
│   ├── animation-manager.ts
│   ├── animation-queue.ts
│   ├── animation-registry.ts
│   ├── card-animations.ts
│   ├── flip.ts
│   └── types.ts
│
├── components/
│   ├── board/
│   ├── hand/
│   ├── card/
│   └── table/
│
└── stores/
```

---

# Animation Manager

Create a singleton service.

```ts
class AnimationManager {
  register(...)
  play(...)
  enqueue(...)
}
```

Responsibilities:

* Own all GSAP timelines
* Resolve animation promises
* Coordinate animation sequences
* Execute animations from queue

---

# Animation Queue

Purpose:

Prevent overlapping gameplay animations.

Example:

Bad:

```text
Player A play card
Player B play card
Player C pass
```

All running simultaneously.

Good:

```text
Player A animation
↓
Player B animation
↓
Player C animation
```

Implementation:

```ts
class AnimationQueue {
  enqueue(task)
  process()
}
```

Every animation returns Promise.

```ts
await queue.enqueue(
  () => animations.playCard(...)
);
```

---

# Animation Registry

Purpose:

Single source of truth for available animations.

```ts
export const AnimationRegistry = {
  playCard,
  dealCard,
  reorderHand,
  passTurn,
  highlightTurn,
  winAnimation
};
```

---

# Card Animation Presets

## Deal Card

Flow:

```text
Deck
 ↓
Fly
 ↓
Hand Slot
 ↓
Flip
```

Duration:

200-300ms

---

## Play Card

Flow:

```text
Lift
 ↓
Fly
 ↓
Rotate
 ↓
Snap
 ↓
Glow
```

Timeline:

```text
Scale 1 → 1.05
Translate to table
Rotate slightly
Snap to target
Flash highlight
```

Target duration:

250-450ms

---

## Pass Turn

Flow:

```text
Avatar highlight
 ↓
PASS badge
 ↓
Fade out
```

Duration:

600ms

---

## Win Animation

Flow:

```text
Board freeze
 ↓
Avatar glow
 ↓
Score popup
 ↓
Celebration
```

---

# FLIP Animation System

Mandatory for hand reordering.

Problem:

Before:

```text
[1][2][3][4][5][6][7]
```

After playing card:

```text
[1][2][4][5][6][7]
```

Without FLIP:

Cards instantly jump.

With FLIP:

Cards smoothly slide.

Implementation:

```ts
captureFirst()
renderNewLayout()
captureLast()
invert()
play()
```

Use GSAP Flip plugin if available.

Otherwise implement manually.

---

# DOM Requirements

Every card must have:

```html
<div
  data-card-id="6-6"
  data-player-id="p1"
/>
```

AnimationManager should locate elements using ids.

Never use array indexes.

Bad:

```ts
cards[3]
```

Good:

```ts
cardId
```

---

# Animation Events

Define central animation events.

```ts
CARD_DEALT
CARD_PLAYED
CARD_REORDERED
PLAYER_PASSED
TURN_CHANGED
ROUND_ENDED
GAME_ENDED
```

---

# Animation State Machine

States:

```text
idle
playing
waiting
blocked
```

Prevent duplicate animations.

Example:

```ts
if (animationRunning) {
  queue.enqueue(...)
}
```

---

# Performance Requirements

Mandatory:

* Use transform only
* Use translate3d()
* Use scale()
* Use rotate()

Never animate:

```css
top
left
width
height
margin
```

Use:

```css
transform
opacity
```

---

# Future PixiJS Compatibility

AnimationManager must not depend on DOM-specific logic.

Design API:

```ts
playCard({
  cardId,
  from,
  to
});
```

instead of

```ts
playCard(domElement);
```

This allows migration to PixiJS later.

---

# Phase 1 Deliverables

Implement:

* AnimationManager
* AnimationQueue
* Card Deal Animation
* Card Play Animation
* Hand Reorder FLIP Animation
* Turn Highlight Animation
* Pass Animation

Do not implement particles or visual effects yet.

Focus on architecture first.

---

# Success Criteria

The animation system is considered complete when:

* Game engine contains zero GSAP imports
* Components contain zero GSAP imports
* All animations run through AnimationManager
* Animations are queued
* Hand reordering uses FLIP
* Play-card animation feels comparable to native mobile card games
* Architecture supports replay mode in the future

```
```
