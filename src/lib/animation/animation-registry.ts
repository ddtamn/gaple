/**
 * AnimationRegistry — single source of truth for all available animations.
 *
 * Each animation is registered with a name, implementation function,
 * and description. This provides a discoverable API for the animation
 * controller and makes it easy to find, replace, or extend animations.
 */

import type { AnimationRegistryEntry } from './types';

export class AnimationRegistry {
	private animations = new Map<string, AnimationRegistryEntry>();

	/** Register a single animation. */
	register(name: string, fn: (...args: unknown[]) => Promise<void> | void, description: string) {
		this.animations.set(name, { name, fn, description });
	}

	/** Register multiple animations at once. */
	registerAll(entries: AnimationRegistryEntry[]) {
		for (const entry of entries) {
			this.animations.set(entry.name, entry);
		}
	}

	/** Get a registered animation by name. */
	get(name: string): AnimationRegistryEntry | undefined {
		return this.animations.get(name);
	}

	/** Check if an animation is registered. */
	has(name: string): boolean {
		return this.animations.has(name);
	}

	/** Get all registered animation names. */
	list(): string[] {
		return Array.from(this.animations.keys());
	}

	/** Get all registered entries. */
	entries(): AnimationRegistryEntry[] {
		return Array.from(this.animations.values());
	}

	/** Run a registered animation with the given arguments. */
	async run(name: string, ...args: unknown[]): Promise<void> {
		const entry = this.animations.get(name);
		if (!entry) {
			console.warn(`[AnimationRegistry] No animation registered for "${name}"`);
			return;
		}
		await entry.fn(...args);
	}

	/** Remove a registered animation. */
	unregister(name: string) {
		this.animations.delete(name);
	}
}
