/**
 * Central animation controller for the Gaple game.
 *
 * Listens to game events, manages an animation queue, and exposes
 * reactive state for overlay components to render.
 *
 * This file uses Svelte 5 runes ($state, $derived) so it must
 * be loaded in a .svelte.ts context.
 */

import type { Domino, GameEvent, GameState, PlayerId } from '../../engine/types';
import { getAnchorRect, getAnchorCenter, getBoardCenter, registerAnchor } from './domAnchors';
import { delay, tween, easeOutBack } from './tween';

// ── Types ──────────────────────────────────────────────────────────

export interface FlyingTileAnim {
	id: string;
	tile: Domino;
	from: { x: number; y: number };
	to: { x: number; y: number };
	rotation: number;
	/** Player who played this tile */
	playerId: string;
	/** Side the tile was placed on */
	side: 'left' | 'right';
	/** Duration in ms */
	duration: number;
}

export interface StampAnim {
	id: string;
	label: string; // "Gab", "Ceki Palang", "Ceki", "Domi", "Gab Tangkap"
	points: number;
	winnerId: string;
	winnerName: string;
	/** Center position on screen */
	center: { x: number; y: number };
}

export interface FloatingPointsAnim {
	id: string;
	label: string; // "+1", "+2", "+4"
	from: { x: number; y: number };
	to: { x: number; y: number };
	playerId: string;
	points: number;
}

export interface PassAnim {
	id: string;
	playerId: string;
	/** Center of the player area */
	position: { x: number; y: number };
}

export interface ScoreUpdateAnim {
	playerId: string;
	oldScore: number;
	newScore: number;
}

// ── Sequential animation runner ────────────────────────────────────

type AnimationJob =
	| { kind: 'move'; data: FlyingTileAnim }
	| { kind: 'pass'; data: PassAnim }
	| { kind: 'stamp'; data: StampAnim }
	| { kind: 'points-fly'; data: FloatingPointsAnim }
	| { kind: 'score-update'; data: ScoreUpdateAnim }
	| { kind: 'delay'; ms: number };

export class GameAnimationController {
	// ── Reactive state for overlay rendering ──
	activeFlyingTiles = $state<FlyingTileAnim[]>([]);
	activeStamp = $state<StampAnim | null>(null);
	activeFloatingPoints = $state<FloatingPointsAnim[]>([]);
	activePassEffects = $state<PassAnim[]>([]);

	/** Tracks which board tile IDs should be hidden (while flying animation plays) */
	hiddenBoardTileIds = $state<Set<string>>(new Set());

	/** Display scores that animate smoothly rather than jumping */
	displayScores = $state<Record<string, number>>({});

	/** Event count tracker to avoid processing old events on mount */
	processedEventCount = 0;

	/** Guard to prevent double-enqueue of the same round result */
	private _lastEnqueuedResultKey = '';

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
		this.activeFlyingTiles = [];
		this.activeStamp = null;
		this.activeFloatingPoints = [];
		this.activePassEffects = [];
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
	enqueuePointsAwarded(playerId: string, points: number, winnerName: string, from?: { x: number; y: number }) {
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
				from: startPos,
				to,
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

				const player = players.find((p) => p.id === playerId);
				const isMain = playerId === '0';
				const duration = isMain ? 320 : 420 + Math.random() * 100;

				// Hide the real board tile until animation lands
				this.hiddenBoardTileIds = new Set([...this.hiddenBoardTileIds, tileId]);

				this.queue.push({
					kind: 'move',
					data: {
						id: tileId,
						tile,
						from,
						to,
						rotation: side === 'left' ? -8 : 8,
						playerId,
						side,
						duration
					}
				});
				break;
			}

			case 'PLAYER_PASS': {
				const pid = event.payload.playerId as string;
				if (!pid) return;

				const handCenter = getAnchorCenter('hand-area', pid) ?? getBoardCenter();
				this.queue.push({
					kind: 'pass',
					data: {
						id: `pass-${pid}-${event.timestamp}`,
						playerId: pid,
						position: handCenter
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
				const reason = event.payload.reason as string;
				if (!pid || !pts) return;

				const player = players.find((p) => p.id === pid);
				const playerName = player?.name ?? 'Player';
				const boardCenter = getBoardCenter();

				// Source: nearby the player's area
				const handCenter = getAnchorCenter('hand-area', pid) ?? boardCenter;
				const from = { x: handCenter.x, y: handCenter.y - 40 };

				this.enqueuePointsAwarded(pid, pts, playerName, from);
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

		// Stamp
		this.queue.push({
			kind: 'stamp',
			data: {
				id: `stamp-${Date.now()}`,
				label: winType,
				points,
				winnerId,
				winnerName,
				center: boardCenter
			}
		});

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
				from: { x: boardCenter.x, y: boardCenter.y + 40 },
				to,
				playerId: winnerId,
				points
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

	// ── Pending move source capture ──
	private _pendingMoveSources = new Map<string, { x: number; y: number }>();

	storeMoveSource(tileId: string, pos: { x: number; y: number }) {
		this._pendingMoveSources.set(tileId, pos);
	}

	// ── Queue runner ─────────────────────────────

	private async runQueue() {
		if (this.running || this.queue.length === 0) return;
		this.running = true;

		const signal = this.abortController?.signal;

		while (this.queue.length > 0 && !signal?.aborted) {
			const job = this.queue.shift()!;

			try {
				switch (job.kind) {
					case 'move':
						await this.playMove(job.data, signal);
						break;
					case 'pass':
						await this.playPass(job.data, signal);
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
					case 'delay':
						await delay(job.ms, signal);
						break;
				}
			} catch {
				// Ignore errors from aborted animations
			}
		}

		this.running = false;
	}

	private async playMove(anim: FlyingTileAnim, signal?: AbortSignal) {
		// Show flying tile
		this.activeFlyingTiles = [...this.activeFlyingTiles, anim];

		// Wait for flight duration
		await delay(anim.duration, signal);

		// Remove overlay and show real board tile
		this.activeFlyingTiles = this.activeFlyingTiles.filter((a) => a.id !== anim.id);
		this.hiddenBoardTileIds = new Set([...this.hiddenBoardTileIds].filter((id) => id !== anim.id));
	}

	private async playPass(anim: PassAnim, signal?: AbortSignal) {
		this.activePassEffects = [...this.activePassEffects, anim];
		await delay(600, signal);
		this.activePassEffects = this.activePassEffects.filter((a) => a.id !== anim.id);
	}

	private playStamp(anim: StampAnim) {
		this.activeStamp = anim;
	}

	private async playPointsFly(anim: FloatingPointsAnim, signal?: AbortSignal) {
		this.activeFloatingPoints = [...this.activeFloatingPoints, anim];

		const flyDuration = 600;
		await delay(flyDuration, signal);

		this.activeFloatingPoints = this.activeFloatingPoints.filter((a) => a.id !== anim.id);
	}

	private async playScoreUpdate(anim: ScoreUpdateAnim, signal?: AbortSignal) {
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
}
