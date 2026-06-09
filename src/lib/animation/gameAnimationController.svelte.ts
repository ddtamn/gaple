/**
 * Central animation controller for the Gaple game.
 *
 * Orchestrates all game animations: listens to game events, manages an
 * animation queue, and exposes reactive state for overlay components.
 *
 * PIXIJS-READY: This controller contains ZERO DOM-specific logic.
 * All positions are passed in as parameters — the caller (GameArea)
 * is responsible for resolving them via domAnchors (DOM) or canvas
 * coordinates (PixiJS).
 *
 * This file uses Svelte 5 runes ($state, $derived) so it must
 * be loaded in a .svelte.ts context.
 */

import type { Domino, GameEvent } from '../../engine/types';
import { delay, tween, easeOutBack } from './tween';
import { getWinTypeConfig } from './winTypes';
import { AnimationEventBus, type Vec2 } from './renderer';

import type {
	AnimationJob,
	AnimationState,
	FlyingTileAnim,
	FlyingTileAnimData,
	StampAnimData,
	FloatingPointsAnimData,
	ScoreUpdateAnimData,
	ConfettiAnimData,
	ScreenFlashAnimData,
	SparkleAnimData,
	DealAnimData,
	PassAnimData,
	TurnHighlightAnimData
} from './types';


// ── Exported types ─────────────────────────────────────────────────

export type {
	FlyingTileAnim,
	StampAnimData,
	FloatingPointsAnimData,
	ScoreUpdateAnimData,
	ConfettiAnimData,
	ScreenFlashAnimData,
	SparkleAnimData,
	DealAnimData,
	PassAnimData,
	TurnHighlightAnimData,
	AnimationState
};

export class GameAnimationController {
	// ── Event bus (for PixiJS / external subscribers) ──
	events = new AnimationEventBus();

	// ── Reactive state for overlay rendering ──
	activeFlyingTiles = $state<FlyingTileAnimData[]>([]);
	activeFlyingTileMeta = new Map<string, { tile: Domino; playerId: string; side: 'left' | 'right' }>();
	activeStamp = $state<StampAnimData | null>(null);
	activeFloatingPoints = $state<FloatingPointsAnimData[]>([]);
	activeConfetti = $state<ConfettiAnimData[]>([]);
	activeScreenFlash = $state<ScreenFlashAnimData | null>(null);
	activeSparkles = $state<SparkleAnimData[]>([]);
	activeDeal = $state<DealAnimData | null>(null);
	activePass = $state<PassAnimData | null>(null);
	activeTurnHighlight = $state<TurnHighlightAnimData | null>(null);

	/** Tracks which board tile IDs should be hidden (while flying animation plays) */
	hiddenBoardTileIds = $state<Set<string>>(new Set());

	/** Display scores that animate smoothly rather than jumping */
	displayScores = $state<Record<string, number>>({});

	/** Current animation state machine state */
	animState = $state<AnimationState>('idle');

	/** Event count tracker to avoid processing old events on mount */
	processedEventCount = 0;

	/** Guard to prevent double-enqueue of the same round result */
	private _lastEnqueuedResultKey = '';

	// ── Internal queue ──
	private queue: AnimationJob[] = [];
	private running = false;
	private abortController: AbortController | null = null;

	// ── Public API ──────────────────────────────

	/** Initialize displayScores from current game state. Call on mount. */
	initScores(pointStandings: Record<string, number>) {
		this.displayScores = { ...pointStandings };
	}

	/** Reset all animation state (e.g. on new round). */
	reset() {
		this.abortController?.abort();
		this.abortController = new AbortController();
		this.queue = [];
		this.running = false;
		this.animState = 'idle';
		this.activeFlyingTiles = [];
		this.activeFlyingTileMeta.clear();
		this.activeStamp = null;
		this.activeFloatingPoints = [];
		this.activeConfetti = [];
		this.activeScreenFlash = null;
		this.activeSparkles = [];
		this.activeDeal = null;
		this.activePass = null;
		this.activeTurnHighlight = null;
		this.hiddenBoardTileIds = new Set();
		this._lastEnqueuedResultKey = '';
		this.events.removeAll();
	}

	/**
	 * Process new game events and enqueue animations.
	 * 
	 * PIXIJS NOTE: positions are resolved externally (by GameArea using domAnchors
	 * or by a PixiJS layout system) and passed in via getPositions. This is the
	 * only place the controller learns about DOM/canvas coordinates.
	 */
	processEvents(
		events: GameEvent[],
		players: { id: string; name: string }[],
		getPositions?: (event: GameEvent) => {
			from: Vec2;
			to: Vec2;
		} | null
	) {
		if (!events || events.length === 0) return;

		// Detect round reset (events shrunk)
		if (events.length < this.processedEventCount) {
			this.reset();
			this.processedEventCount = 0;
		}

		for (let i = this.processedEventCount; i < events.length; i++) {
			const event = events[i];
			this.enqueueEvent(event, players, getPositions);
		}

		this.processedEventCount = events.length;
		this.runQueue();
	}

	/**
	 * Enqueue a points-awarded animation.
	 * All positions are passed as parameters — no DOM queries.
	 */
	enqueuePointsAwarded(
		playerId: string,
		points: number,
		_winnerName: string,
		from: Vec2,
		to: Vec2
	) {
		this.queue.push({
			kind: 'points-fly',
			data: {
				id: `points-${playerId}-${Date.now()}`,
				label: `+${points}`,
				fromX: from.x,
				fromY: from.y,
				toX: to.x,
				toY: to.y,
				playerId,
				points
			}
		});
		this.runQueue();
	}

	/**
	 * Enqueue a deal animation with explicit positions.
	 * All positions passed as parameters — no DOM queries.
	 */
	enqueueDealAnimation(
		playerId: string,
		tiles: { left: number; right: number; id: string }[],
		deckPos: Vec2,
		handPos: Vec2
	) {
		this.queue.push({
			kind: 'deal',
			data: {
				id: `deal-${playerId}-${Date.now()}`,
				playerId,
				tiles,
				fromX: deckPos.x,
				fromY: deckPos.y - 20,
				toX: handPos.x,
				toY: handPos.y
			}
		});
		this.runQueue();
	}

	/**
	 * Enqueue a pass animation with explicit avatar position.
	 */
	enqueuePassAnimation(playerId: string, avatarPos: Vec2) {
		this.queue.push({
			kind: 'pass',
			data: {
				id: `pass-${playerId}-${Date.now()}`,
				playerId,
				avatarX: avatarPos.x,
				avatarY: avatarPos.y
			}
		});
		this.runQueue();
	}

	/**
	 * Enqueue a turn highlight transition with explicit avatar position.
	 */
	enqueueTurnHighlight(playerId: string, previousPlayerId: string | null, avatarPos: Vec2) {
		this.queue.push({
			kind: 'turn-highlight',
			data: {
				id: `turn-${playerId}-${Date.now()}`,
				playerId,
				previousPlayerId,
				avatarX: avatarPos.x,
				avatarY: avatarPos.y
			}
		});
		this.runQueue();
	}

	/**
	 * Enqueue a flying tile (move) animation with explicit from/to positions.
	 */
	enqueueMove(
		tileId: string,
		tile: Domino,
		playerId: string,
		side: 'left' | 'right',
		from: Vec2,
		to: Vec2
	) {
		const isMain = playerId === '0';
		const duration = isMain ? 320 : 420 + Math.random() * 100;

		this.hiddenBoardTileIds = new Set([...this.hiddenBoardTileIds, tileId]);

		const data: FlyingTileAnimData = {
			id: tileId,
			fromX: from.x,
			fromY: from.y,
			toX: to.x,
			toY: to.y,
			rotation: side === 'left' ? -8 : 8,
			duration
		};

		this.activeFlyingTileMeta.set(tileId, { tile, playerId, side });

		this.queue.push({
			kind: 'move',
			data: { ...data, tile, playerId, side }
		});
		this.runQueue();
	}

	/** Enqueue a delay job. */
	enqueueDelay(ms: number) {
		this.queue.push({ kind: 'delay', ms });
		this.runQueue();
	}

	/**
	 * Enqueue round result (stamp + confetti + points + score update).
	 * boardCenter and scoreTarget positions are passed explicitly.
	 */
	enqueueRoundResult(
		winnerId: string,
		winnerName: string,
		points: number,
		winType: string,
		pointStandings: Record<string, number>,
		boardCenter: Vec2,
		scoreTarget: Vec2
	) {
		const key = `${winnerId}:${points}:${winType}`;
		if (key === this._lastEnqueuedResultKey) return;
		this._lastEnqueuedResultKey = key;
		const oldScore = this.displayScores[winnerId] ?? 0;
		const newScore = (pointStandings[winnerId] ?? 0);

		const winConfig = getWinTypeConfig(winType);
		const flashColor = winConfig.theme === 'danger' ? '#EF4444' : '#F59E0B';

		// Screen flash
		if (winConfig.flash) {
			this.queue.push({
				kind: 'flash',
				data: {
					id: `flash-${Date.now()}`,
					color: flashColor,
					duration: 420,
					peak: 0.55
				}
			});
		}

		// Stamp
		this.queue.push({
			kind: 'stamp',
			data: {
				id: `stamp-${Date.now()}`,
				label: winType,
				points,
				winnerId,
				winnerName,
				centerX: boardCenter.x,
				centerY: boardCenter.y
			}
		});

		// Confetti
		if (winConfig.confetti) {
			this.queue.push({ kind: 'delay', ms: 120 });
			this.queue.push({
				kind: 'confetti',
				data: {
					id: `confetti-${Date.now()}`,
					centerX: boardCenter.x,
					centerY: boardCenter.y,
					intensity: winConfig.intensity === 'epic' ? 'epic' : 'normal'
				}
			});
		}

		this.queue.push({ kind: 'delay', ms: 800 });

		// Points flying to score
		this.queue.push({
			kind: 'points-fly',
			data: {
				id: `points-${winnerId}-${Date.now()}`,
				label: `+${points}`,
				fromX: boardCenter.x,
				fromY: boardCenter.y + 40,
				toX: scoreTarget.x,
				toY: scoreTarget.y,
				playerId: winnerId,
				points
			}
		});

		// Sparkle
		this.queue.push({
			kind: 'sparkle',
			data: {
				id: `sparkle-${Date.now()}`,
				positionX: scoreTarget.x,
				positionY: scoreTarget.y,
				color: '#F59E0B'
			}
		});

		// Score update
		this.queue.push({
			kind: 'score-update',
			data: { playerId: winnerId, oldScore, newScore }
		});
	}

	/** Process events since last call. Used by external callers (GameArea). */
	processEvent(
		event: GameEvent,
		players: { id: string; name: string }[],
		getPositions?: (event: GameEvent) => { from: Vec2; to: Vec2 } | null
	) {
		this.enqueueEvent(event, players, getPositions);
		this.runQueue();
	}

	// ── Private ─────────────────────────────────

	private enqueueEvent(
		event: GameEvent,
		players: { id: string; name: string }[],
		getPositions?: (event: GameEvent) => { from: Vec2; to: Vec2 } | null
	) {
		switch (event.type) {
			case 'MOVE_PLAYED': {
				const payload = event.payload as Record<string, unknown>;
				const tileId = payload.tileId as string;
				const playerId = payload.playerId as string;
				const tile = payload.tile as Domino | undefined;
				const side = payload.side as 'left' | 'right';

				if (!tile || !playerId) return;

				// Use externally-resolved positions, or fall back to default
				const positions = getPositions?.(event);
				const from = positions?.from ?? { x: 0, y: 0 };
				const to = positions?.to ?? { x: 0, y: 0 };

				this.enqueueMove(tileId, tile, playerId, side, from, to);
				break;
			}

			case 'GAME_OVER': {
				this.queue.push({ kind: 'delay', ms: 150 });
				break;
			}

			case 'POINTS_AWARDED': {
				const pid = event.payload.playerId as string;
				const pts = event.payload.points as number;
				if (!pid || !pts) return;

				const positions = getPositions?.(event);
				const from = positions?.from ?? { x: 0, y: 0 };
				const to = positions?.to ?? { x: 0, y: 0 };

				this.enqueuePointsAwarded(pid, pts, '', from, to);
				break;
			}

			case 'ROUND_SCORED': {
				// Handled via enqueueRoundResult for richer data
				break;
			}
		}
	}

	// ── Queue runner ─────────────────────────────

	async runQueue() {
		if (this.running || this.queue.length === 0) return;
		this.running = true;
		this.animState = 'playing';

		const signal = this.abortController?.signal;

		while (this.queue.length > 0 && !signal?.aborted) {
			const job = this.queue.shift()!;

			try {
				switch (job.kind) {
					case 'move':
						await this.playMove(job.data, signal);
						break;
					case 'stamp':
						this.playStamp(job.data);
						break;
					case 'points-fly':
						await this.playPointsFly(job.data, signal);
						break;
					case 'score-update':
						await this.playScoreUpdate(job.data, signal);
						break;
					case 'confetti':
						await this.playConfetti(job.data, signal);
						break;
					case 'flash':
						await this.playFlash(job.data, signal);
						break;
					case 'sparkle':
						await this.playSparkle(job.data, signal);
						break;
					case 'deal':
						await this.playDeal(job.data, signal);
						break;
					case 'pass':
						await this.playPass(job.data, signal);
						break;
					case 'turn-highlight':
						await this.playTurnHighlight(job.data, signal);
						break;
					case 'delay':
						await delay(job.ms, signal);
						break;
				}
			} catch {
				// Ignore errors from aborted animations
			}
		}

		this.running = false;
		this.animState = this.queue.length > 0 ? 'playing' : 'idle';
		this.events.emit('queue:drain');
	}

	// ── Animation playback methods ───────────────

	private async playMove(anim: FlyingTileAnim, signal?: AbortSignal) {
		const { tile, ...data } = anim;
		this.animState = 'playing';
		this.activeFlyingTiles = [...this.activeFlyingTiles, data];
		this.events.emit('move:start', data);

		await delay(anim.duration + 50, signal);

		// Sparkle on landing
		this.queue.push({
			kind: 'sparkle',
			data: {
				id: `sparkle-land-${data.id}`,
				positionX: data.toX,
				positionY: data.toY,
				color: '#F59E0B'
			}
		});

		this.hiddenBoardTileIds = new Set([...this.hiddenBoardTileIds].filter((id) => id !== tile.id));
		this.activeFlyingTiles = this.activeFlyingTiles.filter((d) => d.id !== data.id);
		this.activeFlyingTileMeta.delete(data.id);
		this.events.emit('move:end', data);
	}

	private playStamp(anim: StampAnimData) {
		this.activeStamp = anim;
		this.events.emit('stamp:start', anim);
	}

	private async playPointsFly(anim: FloatingPointsAnimData, signal?: AbortSignal) {
		this.activeFloatingPoints = [...this.activeFloatingPoints, anim];
		this.events.emit('points:start', anim);
		await delay(600, signal);
		this.activeFloatingPoints = this.activeFloatingPoints.filter((a) => a.id !== anim.id);
		this.events.emit('points:end', anim);
	}

	private async playScoreUpdate(anim: ScoreUpdateAnimData, signal?: AbortSignal) {
		await tween(
			{
				from: anim.oldScore,
				to: anim.newScore,
				duration: 500,
				easing: easeOutBack,
				onUpdate: (value) => {
					this.displayScores = {
						...this.displayScores,
						[anim.playerId]: Math.round(value)
					};
				},
				onComplete: () => {
					this.displayScores = {
						...this.displayScores,
						[anim.playerId]: anim.newScore
					};
				}
			},
			signal
		);
	}

	private async playConfetti(anim: ConfettiAnimData, signal?: AbortSignal) {
		this.activeConfetti = [...this.activeConfetti, anim];
		this.events.emit('confetti:start', anim);
		const duration = anim.intensity === 'epic' ? 1700 : 1500;
		await delay(duration, signal);
		this.activeConfetti = this.activeConfetti.filter((a) => a.id !== anim.id);
		this.events.emit('confetti:end', anim);
	}

	private async playFlash(anim: ScreenFlashAnimData, signal?: AbortSignal) {
		this.activeScreenFlash = anim;
		this.events.emit('flash:start', anim);
		await delay(anim.duration, signal);
		if (this.activeScreenFlash?.id === anim.id) {
			this.activeScreenFlash = null;
		}
		this.events.emit('flash:end', anim);
	}

	private async playSparkle(anim: SparkleAnimData, signal?: AbortSignal) {
		this.activeSparkles = [...this.activeSparkles, anim];
		this.events.emit('sparkle:start', anim);
		await delay(520, signal);
		this.activeSparkles = this.activeSparkles.filter((a) => a.id !== anim.id);
		this.events.emit('sparkle:end', anim);
	}

	private async playDeal(anim: DealAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activeDeal = anim;
		this.events.emit('deal:start', anim);
		const dealDuration = 250 + anim.tiles.length * 60;
		await delay(dealDuration, signal);
		if (this.activeDeal?.id === anim.id) {
			this.activeDeal = null;
		}
		this.events.emit('deal:end', anim);
	}

	private async playPass(anim: PassAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activePass = anim;
		this.events.emit('pass:start', anim);
		await delay(800, signal);
		if (this.activePass?.id === anim.id) {
			this.activePass = null;
		}
		this.events.emit('pass:end', anim);
	}

	private async playTurnHighlight(anim: TurnHighlightAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activeTurnHighlight = anim;
		this.events.emit('turn-highlight:start', anim);
		await delay(700, signal);
		if (this.activeTurnHighlight?.id === anim.id) {
			this.activeTurnHighlight = null;
		}
		this.events.emit('turn-highlight:end', anim);
	}
}
