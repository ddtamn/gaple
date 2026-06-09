/**
 * Animation Renderer Interface
 * 
 * Abstraction layer between the animation controller and the rendering backend.
 * 
 * The controller produces animation events (tile moved, stamp shown, etc.)
 * and the renderer is responsible for making them visible — whether via
 * DOM overlays (current) or PixiJS canvas (future).
 * 
 * To integrate PixiJS:
 *   1. Implement this interface (see pixi-renderer.ts stub)
 *   2. Pass the renderer instance to the controller
 *   3. The controller calls renderer methods instead of modifying reactive state
 */

import type { Domino } from '../../engine/types';
import type {
	FlyingTileAnimData,
	StampAnimData,
	FloatingPointsAnimData,
	ConfettiAnimData,
	ScreenFlashAnimData,
	SparkleAnimData,
	DealAnimData,
	PassAnimData,
	TurnHighlightAnimData
} from './types';

// ── Coordinate Types ───────────────────────────────────────────────

/** A 2D position in screen/canvas space. */
export interface Vec2 {
	x: number;
	y: number;
}

/** Bounding rectangle in screen/canvas space. */
export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

// ── Position Resolver ──────────────────────────────────────────────

/**
 * Provides positions needed by the animation controller.
 * 
 * The DOM implementation queries getBoundingClientRect().
 * The PixiJS implementation returns canvas-space coordinates.
 * 
 * This is the key abstraction that decouples the controller from the DOM.
 */
export interface PositionResolver {
	getBoardCenter(): Vec2;
	getHandCenter(playerId: string): Vec2 | null;
	getAvatarCenter(playerId: string): Vec2 | null;
	getScoreTarget(playerId: string): Vec2 | null;
	getTilePlaySource(tileId: string, playerId: string): Vec2 | null;
	getTilePlayTarget(tileId: string): Vec2 | null;
}

// ── Renderer Interface ─────────────────────────────────────────────

/**
 * Interface that all animation renderers must implement.
 * 
 * Each method corresponds to an animation job kind.
 * The controller calls these methods instead of pushing to reactive state,
 * making the rendering backend fully swappable.
 */
export interface AnimationRenderer {
	/** A tile flies from hand to board. */
	playMove(data: FlyingTileAnimData, tile: Domino, playerId: string, side: 'left' | 'right'): void;
	/** Show a center stamp (round result overlay). */
	showStamp(data: StampAnimData): void;
	/** Hide a center stamp. */
	hideStamp(id: string): void;
	/** Float points from a position to the score display. */
	showFloatingPoints(data: FloatingPointsAnimData): void;
	/** Hide floating points. */
	hideFloatingPoints(id: string): void;
	/** Show a confetti burst. */
	showConfetti(data: ConfettiAnimData): void;
	/** Hide confetti burst. */
	hideConfetti(id: string): void;
	/** Show a full-screen color flash. */
	showScreenFlash(data: ScreenFlashAnimData): void;
	/** Hide screen flash. */
	hideScreenFlash(id: string): void;
	/** Show a sparkle burst at a position. */
	showSparkle(data: SparkleAnimData): void;
	/** Hide sparkle burst. */
	hideSparkle(id: string): void;
	/** Show deal animation (cards flying from deck to hand). */
	showDeal(data: DealAnimData): void;
	/** Hide deal animation. */
	hideDeal(id: string): void;
	/** Show pass animation (avatar pulse + PASS badge). */
	showPass(data: PassAnimData): void;
	/** Hide pass animation. */
	hidePass(id: string): void;
	/** Show turn highlight (glow ring on avatar). */
	showTurnHighlight(data: TurnHighlightAnimData): void;
	/** Hide turn highlight. */
	hideTurnHighlight(id: string): void;
	/** Hide a board tile (while flying tile animation plays). */
	hideBoardTile(tileId: string): void;
	/** Show a board tile (after flying tile lands). */
	showBoardTile(tileId: string): void;
	/** Update display scores. */
	updateScores(scores: Record<string, number>): void;
	/** Reset all visuals (new round). */
	reset(): void;
}

// ── Animation Event (for external subscribers) ─────────────────────

export type AnimationEventType =
	| 'move:start' | 'move:end'
	| 'stamp:start' | 'stamp:end'
	| 'points:start' | 'points:end'
	| 'confetti:start' | 'confetti:end'
	| 'flash:start' | 'flash:end'
	| 'sparkle:start' | 'sparkle:end'
	| 'deal:start' | 'deal:end'
	| 'pass:start' | 'pass:end'
	| 'turn-highlight:start' | 'turn-highlight:end'
	| 'queue:drain';

export interface AnimationEvent {
	type: AnimationEventType;
	data?: unknown;
	timestamp: number;
}

export type AnimationEventCallback = (event: AnimationEvent) => void;

/**
 * Simple event emitter for animation lifecycle events.
 * PixiJS renderer (or any other subscriber) can listen to these
 * to synchronize its own rendering.
 */
export class AnimationEventBus {
	private listeners = new Map<AnimationEventType, Set<AnimationEventCallback>>();
	private wildcardListeners = new Set<(event: AnimationEvent) => void>();

	on(type: AnimationEventType, callback: AnimationEventCallback): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(callback);
		return () => this.listeners.get(type)?.delete(callback);
	}

	/** Listen to all animation events. */
	onAny(callback: (event: AnimationEvent) => void): () => void {
		this.wildcardListeners.add(callback);
		return () => this.wildcardListeners.delete(callback);
	}

	emit(type: AnimationEventType, data?: unknown) {
		const event: AnimationEvent = { type, data, timestamp: Date.now() };
		this.listeners.get(type)?.forEach((cb) => cb(event));
		this.wildcardListeners.forEach((cb) => cb(event));
	}

	removeAll() {
		this.listeners.clear();
		this.wildcardListeners.clear();
	}
}
