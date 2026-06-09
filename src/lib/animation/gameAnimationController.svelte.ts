/**
 * Central animation controller for the Gaple game.
 *
 * Orchestrates all game animations: listens to game events, manages an
 * animation queue, and exposes reactive state for overlay components.
 *
 * Architecture (per animation-system.md):
 *   Game Engine → Game Event → Animation Queue → AnimationManager → GSAP → Visual
 *
 * This file uses Svelte 5 runes ($state, $derived) so it must
 * be loaded in a .svelte.ts context.
 */

import type { Domino, GameEvent } from '../../engine/types';
import { getAnchorRect, getAnchorCenter, getBoardCenter, type AnchorType } from './domAnchors';
import { delay, tween, easeOutBack } from './tween';
import { getWinTypeConfig } from './winTypes';

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


// ── Types ──────────────────────────────────────────────────────────

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

	// ── Modular subsystems ──
	private queue: AnimationJob[] = [];
	private running = false;
	private abortController: AbortController | null = null;

	// ── Pending move source capture ──
	private _pendingMoveSources = new Map<string, { x: number; y: number }>();

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
	}

	/**
	 * Process new game events and enqueue appropriate animations.
	 * Call this from an $effect whenever events change.
	 */
	processEvents(events: GameEvent[], players: { id: string; name: string }[]) {
		if (!events || events.length === 0) return;

		// Detect round reset (events shrunk)
		if (events.length < this.processedEventCount) {
			this.reset();
			this.processedEventCount = 0;
		}

		for (let i = this.processedEventCount; i < events.length; i++) {
			const event = events[i];
			this.enqueueEvent(event, players);
		}

		this.processedEventCount = events.length;
		this.runQueue();
	}

	/**
	 * Enqueue a one-off points-awarded animation (e.g. from cekik/pass scoring).
	 */
	enqueuePointsAwarded(playerId: string, points: number, _winnerName: string, from?: { x: number; y: number }) {
		const scoreAnchor = getAnchorRect('score', playerId);
		const boardCenter = getBoardCenter();
		const to = scoreAnchor
			? { x: scoreAnchor.left + scoreAnchor.width / 2, y: scoreAnchor.top + scoreAnchor.height / 2 }
			: boardCenter;

		const startPos = from ?? { x: boardCenter.x, y: boardCenter.y - 60 };

		this.queue.push({
			kind: 'points-fly',
			data: {
				id: `points-${playerId}-${Date.now()}`,
				label: `+${points}`,
				fromX: startPos.x,
				fromY: startPos.y,
				toX: to.x,
				toY: to.y,
				playerId,
				points
			}
		});
		this.runQueue();
	}

	/**
	 * Capture source rect for a tile being played by the main player.
	 * Called BEFORE the game state updates.
	 */
	captureMoveSource(tileId: string, el?: HTMLElement | null): { x: number; y: number } | null {
		if (el && document.contains(el)) {
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		// Fallback to hand area anchor
		const handCenter = getAnchorCenter('hand-area', 'main');
		return handCenter ?? getBoardCenter();
	}

	/**
	 * Store a move source position for animation.
	 */
	storeMoveSource(tileId: string, pos: { x: number; y: number }) {
		this._pendingMoveSources.set(tileId, pos);
	}

	// ── Public: Deal Animation ─────────────────

	/**
	 * Enqueue a deal animation for a player's hand.
	 * Call after a new round starts.
	 */
	enqueueDealAnimation(
		playerId: string,
		tiles: { left: number; right: number; id: string }[],
		handAnchorType: AnchorType = 'hand-area'
	) {
		const handCenter = getAnchorCenter(handAnchorType, playerId) ?? getBoardCenter();
		const deckPos = getBoardCenter();

		this.queue.push({
			kind: 'deal',
			data: {
				id: `deal-${playerId}-${Date.now()}`,
				playerId,
				tiles,
				fromX: deckPos.x,
				fromY: deckPos.y - 20,
				toX: handCenter.x,
				toY: handCenter.y
			}
		});
		this.runQueue();
	}

	// ── Public: Pass Animation ─────────────────

	/**
	 * Enqueue a pass animation at the player's avatar position.
	 */
	enqueuePassAnimation(playerId: string) {
		const avatarRect = getAnchorRect('hand', playerId) ?? getAnchorRect('avatar', playerId);
		const pos = avatarRect
			? { x: avatarRect.left + avatarRect.width / 2, y: avatarRect.top + avatarRect.height / 2 }
			: getBoardCenter();

		this.queue.push({
			kind: 'pass',
			data: {
				id: `pass-${playerId}-${Date.now()}`,
				playerId,
				avatarX: pos.x,
				avatarY: pos.y
			}
		});
		this.runQueue();
	}

	// ── Public: Turn Highlight Animation ───────

	/**
	 * Enqueue a turn highlight transition.
	 */
	enqueueTurnHighlight(playerId: string, previousPlayerId: string | null) {
		const avatarRect = getAnchorRect('hand', playerId) ?? getAnchorRect('avatar', playerId);
		const pos = avatarRect
			? { x: avatarRect.left + avatarRect.width / 2, y: avatarRect.top + avatarRect.height / 2 }
			: getBoardCenter();

		this.queue.push({
			kind: 'turn-highlight',
			data: {
				id: `turn-${playerId}-${Date.now()}`,
				playerId,
				previousPlayerId,
				avatarX: pos.x,
				avatarY: pos.y
			}
		});
		this.runQueue();
	}

	// ── Private ─────────────────────────────────

	private enqueueEvent(event: GameEvent, players: { id: string; name: string }[]) {
		switch (event.type) {
			case 'MOVE_PLAYED': {
				const payload = event.payload as Record<string, unknown>;
				const side = payload.side as 'left' | 'right';
				const tile = payload.tile as Domino | undefined;
				const playerId = payload.playerId as string;
				const tileId = payload.tileId as string;

				if (!tile || !playerId) return;

				// Source: try to find from pending capture or player hand area
				let from = this._pendingMoveSources.get(tileId);
				if (!from) {
					const handCenter = getAnchorCenter('hand', playerId) ?? getAnchorCenter('hand-area', playerId);
					from = handCenter ?? getBoardCenter();
				}
				this._pendingMoveSources.delete(tileId);

				// Target: board tile position
				const boardRect = getAnchorRect('board-tile', tileId);
				const to = boardRect
					? { x: boardRect.left + boardRect.width / 2, y: boardRect.top + boardRect.height / 2 }
					: getBoardCenter();

				const isMain = playerId === '0';
				const duration = isMain ? 320 : 420 + Math.random() * 100;

				// Hide the real board tile until animation lands
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

				// Store meta separately
				this.activeFlyingTileMeta.set(tileId, { tile, playerId, side });

				this.queue.push({
					kind: 'move',
					data: {
						...data,
						tile,
						playerId,
						side
					}
				});
				break;
			}

			case 'GAME_OVER': {
				// Enqueue a brief delay to let the last move animation finish
				this.queue.push({ kind: 'delay', ms: 150 });
				break;
			}

			case 'POINTS_AWARDED': {
				const pid = event.payload.playerId as string;
				const pts = event.payload.points as number;
				if (!pid || !pts) return;

				const boardCenter = getBoardCenter();
				const handCenter = getAnchorCenter('hand-area', pid) ?? boardCenter;
				const from = { x: handCenter.x, y: handCenter.y - 40 };

				this.enqueuePointsAwarded(pid, pts, '', from);
				break;
			}

			case 'ROUND_SCORED': {
				// Handled via detectResultChange for richer data
				break;
			}
		}
	}

	/**
	 * Called manually when a new result is detected (richer data available).
	 * Has a guard to prevent double-enqueuing the same result.
	 */
	enqueueRoundResult(
		winnerId: string,
		winnerName: string,
		points: number,
		winType: string,
		pointStandings: Record<string, number>
	) {
		const key = `${winnerId}:${points}:${winType}`;
		if (key === this._lastEnqueuedResultKey) return;
		this._lastEnqueuedResultKey = key;
		const boardCenter = getBoardCenter();
		const oldScore = this.displayScores[winnerId] ?? 0;
		const newScore = (pointStandings[winnerId] ?? 0);

		const winConfig = getWinTypeConfig(winType);
		const flashColor = winConfig.theme === 'danger' ? '#EF4444' : '#F59E0B';

		// Screen flash first (if any) — quick burst to set the tone
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

		// Confetti burst (slightly delayed so it follows the stamp impact)
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

		// Hold stamp visible
		this.queue.push({ kind: 'delay', ms: 800 });

		// Points flying to score
		const scoreAnchor = getAnchorRect('score', winnerId);
		const to = scoreAnchor
			? { x: scoreAnchor.left + scoreAnchor.width / 2, y: scoreAnchor.top + scoreAnchor.height / 2 }
			: boardCenter;

		this.queue.push({
			kind: 'points-fly',
			data: {
				id: `points-${winnerId}-${Date.now()}`,
				label: `+${points}`,
				fromX: boardCenter.x,
				fromY: boardCenter.y + 40,
				toX: to.x,
				toY: to.y,
				playerId: winnerId,
				points
			}
		});

		// Sparkle burst on the score chip as the points land
		this.queue.push({
			kind: 'sparkle',
			data: {
				id: `sparkle-${Date.now()}`,
				positionX: to.x,
				positionY: to.y,
				color: '#F59E0B'
			}
		});

		// Score update
		this.queue.push({
			kind: 'score-update',
			data: {
				playerId: winnerId,
				oldScore,
				newScore
			}
		});
	}

	// ── Queue runner ─────────────────────────────

	private async runQueue() {
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
	}

	// ── Animation playback methods ───────────────

	private async playMove(anim: FlyingTileAnim, signal?: AbortSignal) {
		const { tile, ...data } = anim;
		this.animState = 'playing';

		// Store data for the overlay (FlyingTileOverlay handles GSAP via card-animations.ts)
		this.activeFlyingTiles = [...this.activeFlyingTiles, data];

		// Wait for the flying animation to complete
		await delay(anim.duration + 50, signal);

		// Fire sparkle at landing spot
		this.queue.push({
			kind: 'sparkle',
			data: {
				id: `sparkle-land-${data.id}`,
				positionX: data.toX,
				positionY: data.toY,
				color: '#F59E0B'
			}
		});

		// Show the real board tile and remove overlay
		this.hiddenBoardTileIds = new Set([...this.hiddenBoardTileIds].filter((id) => id !== tile.id));
		this.activeFlyingTiles = this.activeFlyingTiles.filter((d) => d.id !== data.id);
		this.activeFlyingTileMeta.delete(data.id);
	}

	private playStamp(anim: StampAnimData) {
		this.activeStamp = anim;
	}

	private async playPointsFly(anim: FloatingPointsAnimData, signal?: AbortSignal) {
		this.activeFloatingPoints = [...this.activeFloatingPoints, anim];
		await delay(600, signal);
		this.activeFloatingPoints = this.activeFloatingPoints.filter((a) => a.id !== anim.id);
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
		const duration = anim.intensity === 'epic' ? 1700 : 1500;
		await delay(duration, signal);
		this.activeConfetti = this.activeConfetti.filter((a) => a.id !== anim.id);
	}

	private async playFlash(anim: ScreenFlashAnimData, signal?: AbortSignal) {
		this.activeScreenFlash = anim;
		await delay(anim.duration, signal);
		if (this.activeScreenFlash?.id === anim.id) {
			this.activeScreenFlash = null;
		}
	}

	private async playSparkle(anim: SparkleAnimData, signal?: AbortSignal) {
		this.activeSparkles = [...this.activeSparkles, anim];
		await delay(520, signal);
		this.activeSparkles = this.activeSparkles.filter((a) => a.id !== anim.id);
	}

	private async playDeal(anim: DealAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activeDeal = anim;
		// Show for the duration of the deal animation (staggered cards)
		const dealDuration = 250 + anim.tiles.length * 60;
		await delay(dealDuration, signal);
		if (this.activeDeal?.id === anim.id) {
			this.activeDeal = null;
		}
	}

	private async playPass(anim: PassAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activePass = anim;
		await delay(800, signal);
		if (this.activePass?.id === anim.id) {
			this.activePass = null;
		}
	}

	private async playTurnHighlight(anim: TurnHighlightAnimData, signal?: AbortSignal) {
		this.animState = 'playing';
		this.activeTurnHighlight = anim;
		await delay(700, signal);
		if (this.activeTurnHighlight?.id === anim.id) {
			this.activeTurnHighlight = null;
		}
	}
}
