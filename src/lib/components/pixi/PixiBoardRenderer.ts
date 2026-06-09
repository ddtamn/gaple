/**
 * PixiBoardRenderer — manages the PIXI.js scene for the domino board.
 *
 * Responsibilities:
 *   - Renders the board (placed tiles) as PIXI sprites
 *   - Handles flying tile animations (play card) via GSAP
 *   - Handles overlay effects (stamp, confetti, sparkle) via PIXI Graphics
 *   - Subscribes to GameAnimationController's event bus for animation triggers
 *
 * Usage:
 *   const renderer = new PixiBoardRenderer(app.stage);
 *   renderer.syncBoard(boardLayout);
 *   controller.events.onAny((e) => renderer.handleEvent(e));
 */

import { Container, Graphics, Text, type Application } from 'pixi.js';
import gsap from 'gsap';
import { createTileContainer, TILE_W, TILE_H } from './PixiTileRenderer';
import type { FlyingTileAnimData, StampAnimData, SparkleAnimData } from '$lib/animation/types';
import type { AnimationEvent } from '$lib/animation/renderer';

interface BoardTile {
	id: string;
	left: number;
	right: number;
	x: number;
	y: number;
	rotation: number;
	isBalak: boolean;
}

export class PixiBoardRenderer {
	private stage: Container;
	private boardContainer: Container;
	private overlayContainer: Container;
	private flyContainer: Container;
	
	/** Map of tileId → PIXI Container for board tiles */
	private boardTiles = new Map<string, Container>();
	
	/** Track which tile IDs are hidden (while flying animation plays) */
	private hiddenTileIds = new Set<string>();

	constructor(parent: Container) {
		this.stage = parent;
		
		// Layer 0: Board tiles (placed tiles)
		this.boardContainer = new Container();
		this.stage.addChild(this.boardContainer);
		
		// Layer 1: Overlay effects (stamps, sparks, text)
		this.overlayContainer = new Container();
		this.overlayContainer.zIndex = 1;
		this.stage.addChild(this.overlayContainer);
		
		// Layer 2: Flying tile animations
		this.flyContainer = new Container();
		this.flyContainer.zIndex = 2;
		this.stage.addChild(this.flyContainer);
		
		// Enable zIndex for proper layering
		this.stage.sortableChildren = true;
	}

	// ── Board Sync ───────────────────────────────────────────

	/**
	 * Synchronize the board display with the current layout.
	 * Creates/updates/removes tile sprites as needed.
	 */
	syncBoard(layout: BoardTile[]) {
		const currentIds = new Set(layout.map((t) => t.id));
		
		// Remove tiles no longer on board
		for (const [id] of this.boardTiles) {
			if (!currentIds.has(id)) {
				const container = this.boardTiles.get(id)!;
				this.boardContainer.removeChild(container);
				container.destroy({ children: true });
				this.boardTiles.delete(id);
			}
		}

		// Add/update tiles
		for (const tile of layout) {
			const isVertical = tile.rotation % 180 !== 0;
			
			if (!this.boardTiles.has(tile.id)) {
				const container = createTileContainer(tile, isVertical, 1);
				this.boardContainer.addChild(container);
				this.boardTiles.set(tile.id, container);
			}

			const container = this.boardTiles.get(tile.id)!;
			container.position.set(tile.x, tile.y);
			container.rotation = (tile.rotation * Math.PI) / 180;
			container.visible = !this.hiddenTileIds.has(tile.id);
		}
	}

	/** Hide a board tile (while flying animation plays over it). */
	hideBoardTile(tileId: string) {
		this.hiddenTileIds.add(tileId);
		const container = this.boardTiles.get(tileId);
		if (container) container.visible = false;
	}

	/** Show a board tile (after flying tile lands). */
	showBoardTile(tileId: string) {
		this.hiddenTileIds.delete(tileId);
		const container = this.boardTiles.get(tileId);
		if (container) container.visible = true;
	}

	/** Set camera transform on the board container. */
	setCamera(scale: number, offsetX: number, offsetY: number) {
		this.boardContainer.scale.set(scale);
		this.boardContainer.position.set(offsetX, offsetY);
	}

	// ── Animation Handlers ──────────────────────────────────

	/**
	 * Handle an animation event from the controller's event bus.
	 * Subscribe with: controller.events.onAny((e) => renderer.handleEvent(e));
	 */
	handleEvent(event: AnimationEvent) {
		switch (event.type) {
			case 'move:start':
				this.onMoveStart(event.data as FlyingTileAnimData);
				break;
			case 'move:end':
				this.onMoveEnd(event.data as FlyingTileAnimData);
				break;
			case 'sparkle:start':
				this.onSparkle(event.data as SparkleAnimData);
				break;
			case 'stamp:start':
				this.onStamp(event.data as StampAnimData);
				break;
			case 'stamp:end':
				this.clearOverlays();
				break;
			case 'queue:drain':
				this.clearFlyContainer();
				break;
		}
	}

	private onMoveStart(data: FlyingTileAnimData) {
		// Create a flying tile sprite
		const flyContainer = new Container();
		const tileGfx = new Graphics();
		const w = TILE_W;
		const h = TILE_H;
		tileGfx.roundRect(-w / 2, -h / 2, w, h, 8)
			.fill(0xF5F5F4)
			.stroke({ width: 2, color: 0x44403C });
		flyContainer.addChild(tileGfx);
		
		flyContainer.position.set(data.fromX, data.fromY);
		flyContainer.rotation = (data.rotation * Math.PI) / 180;
		flyContainer.alpha = 0;
		this.flyContainer.addChild(flyContainer);

		const dist = Math.hypot(data.toX - data.fromX, data.toY - data.fromY);
		const arcHeight = Math.max(70, dist * 0.2 + 30);
		const durSec = data.duration / 1000;

		// Animate with GSAP
		const tl = gsap.timeline();
		
		// Fade in
		tl.to(flyContainer, { alpha: 1, duration: 0.05 }, 0);
		
		// Flight path (use a custom tween for the arc)
		const pos = { p: 0 };
		tl.to(pos, {
			p: 1,
			duration: durSec,
			ease: 'power3.out',
			onUpdate: () => {
				const p = pos.p;
				const biased = Math.pow(p, 0.8);
				const arc = 4 * biased * (1 - biased) * arcHeight;
				flyContainer.position.set(
					data.fromX + (data.toX - data.fromX) * p,
					data.fromY + (data.toY - data.fromY) * p - arc
				);
				flyContainer.rotation = data.rotation * (1 - p);
			},
			onComplete: () => {
				this.flyContainer.removeChild(flyContainer);
				flyContainer.destroy({ children: true });
			}
		}, 0);

		tl.to(flyContainer, { alpha: 0, duration: 0.05 }, durSec - 0.05);
	}

	private onMoveEnd(_data: FlyingTileAnimData) {
		// Cleanup handled in onComplete of onMoveStart
	}

	private onSparkle(data: SparkleAnimData) {
		const count = 8;
		const particles: Graphics[] = [];
		const colors = [0xF59E0B, 0xFBBF24, 0xD97706];

		for (let i = 0; i < count; i++) {
			const angle = (i / count) * Math.PI * 2;
			const dist = 24 + (i % 2) * 8;
			const dot = new Graphics();
			dot.circle(0, 0, 3)
				.fill(colors[i % colors.length]);
			dot.position.set(data.positionX, data.positionY);
			dot.alpha = 1;
			this.overlayContainer.addChild(dot);
			particles.push(dot);

			gsap.to(dot, {
				x: data.positionX + Math.cos(angle) * dist,
				y: data.positionY + Math.sin(angle) * dist,
				alpha: 0,
				duration: 0.4,
				ease: 'power2.out',
				onComplete: () => {
					this.overlayContainer.removeChild(dot);
					dot.destroy();
				}
			});
		}
	}

	private onStamp(data: StampAnimData) {
		const text = new Text({
			text: data.label,
			style: {
				fontFamily: 'serif',
				fontSize: 48,
				fontWeight: 'bold',
				fill: 0xF59E0B,
				stroke: { color: 0x000000, width: 3 }
			}
		});
		text.anchor.set(0.5);
		text.position.set(data.centerX, data.centerY);
		text.scale.set(0);
		this.overlayContainer.addChild(text);

		gsap.to(text, {
			scale: 1,
			duration: 0.4,
			ease: 'back.out(1.7)',
			onComplete: () => {
				// Keep visible for a moment, then fade
				gsap.to(text, {
					alpha: 0,
					duration: 0.3,
					delay: 1.5,
					onComplete: () => {
						this.overlayContainer.removeChild(text);
						text.destroy();
					}
				});
			}
		});
	}

	private clearOverlays() {
		// Remove all overlay children with a fade
		for (const child of this.overlayContainer.children) {
			gsap.to(child, {
				alpha: 0,
				duration: 0.2,
				onComplete: () => {
					this.overlayContainer.removeChild(child);
					child.destroy({ children: true });
				}
			});
		}
	}

	private clearFlyContainer() {
		for (const child of this.flyContainer.children) {
			this.flyContainer.removeChild(child);
			child.destroy({ children: true });
		}
	}

	// ── Cleanup ─────────────────────────────────────────────

	destroy() {
		this.clearFlyContainer();
		this.clearOverlays();
		this.boardTiles.forEach((container) => {
			this.boardContainer.removeChild(container);
			container.destroy({ children: true });
		});
		this.boardTiles.clear();
		this.hiddenTileIds.clear();
	}
}
