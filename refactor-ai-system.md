# Domino Gaple AI Refactor Plan

## Goal

Turn the current AI from a strong heuristic-plus-playout bot into a modular engine that can:

- Reason about hidden information more realistically
- Reuse search work across turns
- Improve endgame accuracy
- Scale cleanly without turning `src/engine/ai.ts` into a monolith

This plan is written for the codebase as it exists now, where the core AI lives in [`src/engine/ai.ts`](src/engine/ai.ts) and currently relies on tactical scoring plus repeated randomized playouts.

---

## Current Baseline

The current AI already does a few important things well:

- Generates legal moves
- Scores moves with tactical heuristics
- Uses determinization for hidden hands
- Runs repeated playouts to estimate move quality

The biggest limitations are:

- Determinization still treats unknown tiles too uniformly
- There is no opponent memory or belief model
- Search is not a real tree search, so previous work is thrown away every turn
- Endgame play still relies on simulation even when exact search is possible
- The AI logic is concentrated in one file, which makes further changes risky

---

## Design Principles

1. Build the smallest useful upgrade first.
2. Keep each stage shippable and measurable.
3. Add inference before adding more search depth.
4. Add tree search before adding expensive parallelism.
5. Keep optional ML work out of the critical path.

---

## Recommended Priority

### Highest Priority

1. Split the AI into modules
2. Add deterministic randomness
3. Add opponent memory and belief tracking
4. Replace uniform determinization with weighted determinization
5. Introduce real MCTS with subtree reuse
6. Add a small exact endgame solver

### Medium Priority

7. Improve simulation policy
8. Add tactical threat detection
9. Add transposition caching / hashing
10. Add worker-based parallel simulations

### Low Priority

11. Self-play data collection
12. Neural evaluation
13. Reinforcement learning

---

## Phase 0 - Baseline and Safety Net

### Objective

Make sure we can refactor the AI without regressing gameplay.

### Deliverables

- Add focused tests for:
  - legal move selection
  - pass behavior
  - game end conditions
  - deterministic game setup
- Capture a few baseline AI-vs-AI outcomes for comparison
- Document the current public AI entrypoint

### Why this comes first

The AI is currently concentrated in one place, so even a small change can shift outcomes. We need a baseline before we split logic apart.

### Acceptance criteria

- Existing game rules still pass
- A few representative AI scenarios are reproducible with a fixed seed

---

## Phase 1 - Extract the AI Into Modules

### Objective

Break `src/engine/ai.ts` into smaller pieces so the search logic can evolve without becoming fragile.

### Suggested structure

```text
src/engine/ai/
  ai.ts                # public entrypoint
  types.ts             # AI-specific types
  rng.ts               # seeded / deterministic random helpers
  state.ts             # clone, delta, and move application helpers
  heuristics.ts        # tactical move scoring
  playout.ts           # simulation policy
  belief.ts            # hidden-information model
  inference.ts         # deduction from passes and board history
  search.ts            # MCTS / tree search
  endgame.ts           # exact solver for small states
  cache.ts             # transposition / hash helpers
  telemetry.ts         # debug stats, if needed
```

### What to move out first

Start with the helpers that are easiest to isolate:

- deck generation
- tile keys
- state cloning / move application
- tactical scoring
- playout move selection

### Acceptance criteria

- `selectAiMove` still works as the public entrypoint
- The AI behavior is unchanged or only intentionally improved
- The new module boundaries make later changes local instead of global

---

## Phase 2 - Deterministic RNG and State Handling

### Objective

Make the AI reproducible and cheaper to simulate.

### Deliverables

- Replace `Math.random()` in AI code with a seeded RNG
- Thread the RNG through:
  - determinization
  - playout move selection
  - any tie-breakers
- Reduce expensive state cloning where possible
- Prefer move application helpers that produce new state from deltas

### Why this matters

Search and simulation are hard to debug when they are nondeterministic. Deterministic runs also make benchmarks meaningful.

### Acceptance criteria

- Same seed + same state produces the same AI move
- Repeated simulations are reproducible during testing

---

## Phase 3 - Opponent Memory and Belief Modeling

### Objective

Stop treating unknown hands as fully random.

### Deliverables

- Add a per-opponent memory structure that records:
  - passed when a number was open
  - numbers they are unlikely to hold
  - numbers they repeatedly keep open or avoid
  - simple play-style signals
- Add a belief model that assigns probabilities to unseen tiles
- Use the belief model when filling hidden hands during determinization

### Practical approach

Do not try to infer everything at once. Start with rules that are cheap and reliable:

- If a player passes on an open endpoint, decrease probability of holding matching numbers
- If a player repeatedly opens a number, increase probability they still have related tiles
- Prefer weighted sampling over uniform random assignment

### Acceptance criteria

- Unknown opponent hands are filled with weighted probabilities
- Pass history affects future determinization
- The AI can explain, at least in logs, why certain tiles became unlikely

---

## Phase 4 - Real Search, Not Independent Playouts

### Objective

Replace the current move-by-move playout loop with actual tree search.

### Deliverables

- Implement MCTS with:
  - selection
  - expansion
  - simulation
  - backpropagation
- Reuse subtrees between turns when the board state matches prior search nodes
- Use tactical heuristics to bias expansion and playouts

### Recommended order

1. Basic MCTS
2. Move priors from heuristics
3. Tree reuse
4. Progressive widening, if branching gets too large

### Why not do this earlier

If the belief model is still weak, MCTS will search over bad hidden-information samples. Better inference first gives the search better inputs.

### Acceptance criteria

- Search statistics are stored per node, not recomputed every turn
- The AI can continue a search tree across consecutive turns
- Strong tactical moves still get priority

---

## Phase 5 - Endgame Solver

### Objective

Use exact search when the remaining game is small enough.

### Deliverables

- Add a solver that activates when the remaining state is small
- Use minimax or alpha-beta pruning for the endgame
- Return exact win/loss or best-score lines when possible

### Recommended trigger

Start with a conservative threshold such as:

- few remaining tiles in total
- or small combined hand size

Tune the threshold after measuring cost.

### Acceptance criteria

- The AI stops simulating endgames blindly when exact search is feasible
- Forced wins and forced losses are detected more accurately

---

## Phase 6 - Better Simulation Policy

### Objective

Make playouts more realistic so the search learns from better rollouts.

### Deliverables

- Improve playout move selection with:
  - board control
  - future flexibility
  - block potential
  - double preservation
  - endgame urgency
- Add explicit tactical threat detection
- Make playouts slightly less random and more domain-aware

### Acceptance criteria

- Playouts are more stable than pure random play
- Tactical moves that create or prevent blocks are valued appropriately

---

## Phase 7 - Performance Engineering

### Objective

Make stronger search affordable.

### Deliverables

- Add a transposition table
- Add hashing for game states
- Consider parallel simulations through workers after the search model is stable
- Profile hotspots before adding more complexity

### Recommended order

1. Hashing
2. Transposition caching
3. Profiling
4. Worker parallelism

### Acceptance criteria

- Duplicate positions are detected and reused
- Performance gains are measured, not assumed

---

## Phase 8 - Optional Learning Systems

### Objective

Only after the engine is strong and stable, explore learning-based upgrades.

### Deliverables

- Self-play data collection
- Position evaluation logs
- Optional lightweight neural evaluator
- Optional reinforcement-learning experiments

### Important constraint

Do not depend on ML to make the first major version of the refactor successful. The engine should already be competitive from heuristics + belief + search.

---

## Suggested Implementation Order

If we want the best chance of success with the least churn, the order should be:

1. Add tests and baseline snapshots
2. Split `src/engine/ai.ts` into modules
3. Make RNG deterministic
4. Add opponent memory and belief weighting
5. Replace playout-only evaluation with MCTS
6. Add subtree reuse
7. Add endgame solver
8. Improve playout policy and tactical threat handling
9. Add caching and performance work
10. Consider optional ML

---

## What Not To Do First

- Do not start with neural networks
- Do not start with worker threads before the search algorithm is stable
- Do not add complex profiling infrastructure before we know where the real bottlenecks are
- Do not refactor into many files without a clear module boundary

---

## Success Metrics

We should consider the refactor successful if:

- The AI is more reproducible
- The AI stops making obviously random hidden-information guesses
- Search strength improves without making the code harder to maintain
- Endgame play becomes visibly sharper
- The codebase becomes easier to test and extend

---

## Short Version

If we only do one meaningful upgrade first, it should be this:

1. Add a belief model for hidden hands
2. Feed that model into weighted determinization
3. Use that stronger information inside MCTS

That sequence gives the biggest jump in strength without jumping straight into research-heavy work.
