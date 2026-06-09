/**
 * Card Animation Presets — GSAP-powered card animations.
 *
 * This module owns all GSAP calls related to card movements.
 * Components call these functions instead of importing GSAP directly.
 *
 * Each function takes a params object and returns a cleanup/dispose function.
 */

import gsap from 'gsap';
import type { FlyingTileAnimData } from './types';

// ── Play Card (Flying Tile) ─────────────────────────────────────────

export interface PlayCardParams extends FlyingTileAnimData {
	onUpdate: (state: {
		x: number;
		y: number;
		rot: number;
		scale: number;
		opacity: number;
		shadowX: number;
		shadowY: number;
		shadowSize: number;
		shadowOpacity: number;
	}) => void;
	onComplete: () => void;
}

/**
 * Creates a GSAP timeline for a flying tile animation (play card).
 * Animates position along an arc, shadow, rotation, and scale.
 *
 * Returns a cleanup function to kill the timeline.
 */
export function createPlayCardAnimation(params: PlayCardParams): () => void {
	const { fromX, fromY, toX, toY, rotation, duration, onUpdate, onComplete } = params;
	const dist = Math.hypot(toX - fromX, toY - fromY);
	const arcHeight = Math.max(70, dist * 0.2 + 30);
	const durSec = duration / 1000;

	// Proxy objects for GSAP to animate
	const flight = { p: 0 };
	const scaleObj = { s: 0.5 };
	const rotObj = { r: rotation };

	const tl = gsap.timeline({
		onComplete
	});

	// 1. Flight progress: drives x, y (with arc), and shadow
	tl.to(flight, {
		p: 1,
		duration: durSec,
		ease: 'power3.out',
		onUpdate: () => {
			const p = flight.p;
			const x = fromX + (toX - fromX) * p;
			
			// Asymmetric arc: quadratic bezier peaks early
			const biased = Math.pow(p, 0.8);
			const arc = 4 * biased * (1 - biased) * arcHeight;
			const y = fromY + (toY - fromY) * p - arc;

			// Shadow stays on the ground
			const shadowX = fromX + (toX - fromX) * p;
			const shadowY = fromY + (toY - fromY) * p;

			// Shadow tightens as tile descends
			const arcRatio = arc / arcHeight;
			const shadowSize = 0.2 + arcRatio * 0.8;
			const shadowOpacity = 0.1 + (1 - arcRatio) * 0.3;
			const opacity = p < 0.12 ? p / 0.12 : 1;

			onUpdate({
				x,
				y,
				rot: rotObj.r,
				scale: scaleObj.s,
				opacity,
				shadowX,
				shadowY,
				shadowSize,
				shadowOpacity
			});
		}
	}, 0);

	// 2. Rotation: start tilted, snap to 0 with back easing
	tl.to(rotObj, {
		r: 0,
		duration: durSec,
		ease: 'back.out(1.7)',
		onUpdate: () => {
			// Update is handled inside flight's onUpdate via rotObj.r reference
		}
	}, 0);

	// 3. Scale: rapid rise then slam down
	tl.to(scaleObj, {
		keyframes: [
			{ s: 1.15, duration: durSec * 0.35, ease: 'power2.out' },
			{ s: 1.0, duration: durSec * 0.65, ease: 'back.out(2.2)' }
		]
	}, 0);

	return () => tl.kill();
}

// ── Deal Card ───────────────────────────────────────────────────────

export interface DealCardParams {
	/** Source (deck) x center */
	fromX: number;
	/** Source (deck) y center */
	fromY: number;
	/** Target (hand area) x center */
	toX: number;
	/** Target (hand area) y center */
	toY: number;
	/** Index of this card in the deal sequence (0..n) */
	index: number;
	/** Total cards being dealt to this player */
	total: number;
	/** Stagger offset in ms between each card */
	staggerMs?: number;
	/** Duration of the flight in ms */
	duration?: number;
	onUpdate: (state: { x: number; y: number; scale: number; opacity: number; rotation: number }) => void;
	onComplete: () => void;
}

/**
 * Creates a GSAP animation for dealing a single card from the deck to a hand.
 * Each card in a deal sequence can be staggered.
 */
export function createDealCardAnimation(params: DealCardParams): () => void {
	const {
		fromX,
		fromY,
		toX,
		toY,
		index,
		total,
		staggerMs = 60,
		duration = 250,
		onUpdate,
		onComplete
	} = params;

	const startDelay = index * staggerMs;
	const durSec = duration / 1000;

	// Each card lands slightly offset from the previous one
	const offsetX = (index - (total - 1) / 2) * 36;
	const targetX = toX + offsetX;
	const arcHeight = 40 + index * 8;

	const pos = { p: 0, scale: 0.3, rot: -15 + Math.random() * 30 };

	const tl = gsap.timeline({
		delay: startDelay / 1000,
		onComplete
	});

	tl.to(pos, {
		p: 1,
		duration: durSec,
		ease: 'power2.out',
		onUpdate: () => {
			const p = pos.p;
			const x = fromX + (targetX - fromX) * p;
			const biased = Math.pow(p, 0.85);
			const arc = 4 * biased * (1 - biased) * arcHeight;
			const y = fromY + (toY - fromY) * p - arc;
			const scale = 0.3 + 0.7 * p;
			const rotation = pos.rot * (1 - p);
			const opacity = p < 0.08 ? p / 0.08 : 1;

			onUpdate({ x, y, scale, opacity, rotation });
		}
	}, 0);

	tl.to(pos, {
		scale: 1,
		duration: durSec * 0.4,
		ease: 'back.out(1.4)',
		onUpdate: () => {
			// scale handled via pos reference in the main tween's onUpdate
		}
	}, 0);

	return () => tl.kill();
}

// ── Pass Animation ──────────────────────────────────────────────────

export interface PassAnimationParams {
	avatarX: number;
	avatarY: number;
	onUpdate: (state: { badgeOpacity: number; badgeScale: number; badgeY: number; avatarPulse: number }) => void;
	onComplete: () => void;
	duration?: number;
}

/**
 * Creates a GSAP animation for the pass turn sequence:
 * avatar pulse → PASS badge expands from avatar → badge fades out.
 */
export function createPassAnimation(params: PassAnimationParams): () => void {
	const { avatarX, avatarY, onUpdate, onComplete, duration = 600 } = params;
	const durSec = duration / 1000;

	const state = { badgeOpacity: 0, badgeScale: 0.3, badgeY: avatarY - 10, avatarPulse: 0 };

	const tl = gsap.timeline({ onComplete });

	// Phase 1: Avatar pulse (0-25%)
	tl.to(state, {
		avatarPulse: 1,
		duration: durSec * 0.25,
		ease: 'power2.out',
		onUpdate: () => {
			onUpdate({ ...state });
		}
	}, 0);

	// Phase 2: Badge expands upward (25-60%)
	tl.to(state, {
		badgeOpacity: 1,
		badgeScale: 1,
		badgeY: avatarY - 50,
		duration: durSec * 0.35,
		ease: 'back.out(1.7)',
		onUpdate: () => {
			onUpdate({ ...state });
		}
	}, durSec * 0.25);

	// Phase 3: Avatar pulse settles, badge fades (60-100%)
	tl.to(state, {
		avatarPulse: 0,
		badgeOpacity: 0,
		badgeScale: 0.8,
		badgeY: avatarY - 70,
		duration: durSec * 0.4,
		ease: 'power2.in',
		onUpdate: () => {
			onUpdate({ ...state });
		}
	}, durSec * 0.6);

	return () => tl.kill();
}

// ── Turn Highlight Animation ────────────────────────────────────────

export interface TurnHighlightParams {
	avatarX: number;
	avatarY: number;
	onUpdate: (state: { glowOpacity: number; glowScale: number }) => void;
	onComplete: () => void;
	duration?: number;
}

/**
 * Creates a GSAP animation for a smooth turn highlight transition.
 * Glow ring expands and pulses on the active player's avatar.
 */
export function createTurnHighlightAnimation(params: TurnHighlightParams): () => void {
	const { onUpdate, onComplete, duration = 600 } = params;
	const durSec = duration / 1000;

	const state = { glowOpacity: 0, glowScale: 0.5 };

	const tl = gsap.timeline({ onComplete });

	// Swell in
	tl.to(state, {
		glowOpacity: 1,
		glowScale: 1.15,
		duration: durSec * 0.4,
		ease: 'back.out(2)',
		onUpdate: () => onUpdate({ ...state })
	}, 0);

	// Settle to steady pulse
	tl.to(state, {
		glowScale: 1,
		duration: durSec * 0.6,
		ease: 'power2.out',
		onUpdate: () => onUpdate({ ...state })
	}, durSec * 0.4);

	return () => tl.kill();
}
