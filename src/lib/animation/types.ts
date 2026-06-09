/**
 * Shared types for the Gaple animation system.
 *
 * These types are framework-agnostic and used by all animation modules.
 */

// ── Animation State Machine ─────────────────────────────────────────

export type AnimationState = 'idle' | 'playing' | 'waiting' | 'blocked';

// ── Animation Events ────────────────────────────────────────────────

export const AnimationEventTypes = {
	CARD_DEALT: 'CARD_DEALT',
	CARD_PLAYED: 'CARD_PLAYED',
	CARD_REORDERED: 'CARD_REORDERED',
	PLAYER_PASSED: 'PLAYER_PASSED',
	TURN_CHANGED: 'TURN_CHANGED',
	ROUND_ENDED: 'ROUND_ENDED',
	GAME_ENDED: 'GAME_ENDED'
} as const;

export type AnimationEventType = (typeof AnimationEventTypes)[keyof typeof AnimationEventTypes];

// ── Animation Job Types ─────────────────────────────────────────────

export interface FlyingTileAnimData {
	id: string;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	rotation: number;
	duration: number;
}

export interface FlyingTileAnim extends FlyingTileAnimData {
	tile: { id: string; left: number; right: number };
	playerId: string;
	side: 'left' | 'right';
}

export interface StampAnimData {
	id: string;
	label: string;
	points: number;
	winnerId: string;
	winnerName: string;
	centerX: number;
	centerY: number;
}

export interface FloatingPointsAnimData {
	id: string;
	label: string;
	fromX: number;
	fromY: number;
	toX: number;
	toY: number;
	playerId: string;
	points: number;
}

export interface ScoreUpdateAnimData {
	playerId: string;
	oldScore: number;
	newScore: number;
}

export interface ConfettiAnimData {
	id: string;
	centerX: number;
	centerY: number;
	intensity: 'normal' | 'epic';
}

export interface ScreenFlashAnimData {
	id: string;
	color: string;
	duration: number;
	peak: number;
}

export interface SparkleAnimData {
	id: string;
	positionX: number;
	positionY: number;
	color: string;
}

export interface DealAnimData {
	id: string;
	playerId: string;
	/** Cards being dealt to this player */
	tiles: { left: number; right: number; id: string }[];
	/** Source center position (deck) */
	fromX: number;
	fromY: number;
	/** Target center position (hand area) */
	toX: number;
	toY: number;
}

export interface PassAnimData {
	id: string;
	playerId: string;
	/** Position of the player's avatar */
	avatarX: number;
	avatarY: number;
}

export interface TurnHighlightAnimData {
	id: string;
	playerId: string;
	/** Previous player who had the turn */
	previousPlayerId: string | null;
	/** Position of the current player's avatar */
	avatarX: number;
	avatarY: number;
}

export type AnimationJob =
	| { kind: 'move'; data: FlyingTileAnim }
	| { kind: 'stamp'; data: StampAnimData }
	| { kind: 'points-fly'; data: FloatingPointsAnimData }
	| { kind: 'score-update'; data: ScoreUpdateAnimData }
	| { kind: 'confetti'; data: ConfettiAnimData }
	| { kind: 'flash'; data: ScreenFlashAnimData }
	| { kind: 'sparkle'; data: SparkleAnimData }
	| { kind: 'deal'; data: DealAnimData }
	| { kind: 'pass'; data: PassAnimData }
	| { kind: 'turn-highlight'; data: TurnHighlightAnimData }
	| { kind: 'delay'; ms: number };

// ── Animation Registry Types ────────────────────────────────────────

export type AnimationFn = (...args: unknown[]) => Promise<void> | void;

export interface AnimationRegistryEntry {
	name: string;
	fn: AnimationFn;
	description: string;
}
