import type { Domino } from './types';

export interface RandomGenerator {
	next(): number;
}

export function createSeededRng(seed: string): RandomGenerator {
	let state = 0;
	for (let i = 0; i < seed.length; i++) {
		state = (state * 31 + seed.charCodeAt(i)) >>> 0;
	}

	return {
		next() {
			state = (state * 1664525 + 1013904223) >>> 0;
			return state / 0x100000000;
		}
	};
}

export function shuffle<T>(items: T[], rng: RandomGenerator): T[] {
	const array = [...items];
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

export function cloneGameState<T>(state: T): T {
	return JSON.parse(JSON.stringify(state)) as T;
}

export function serializeGameState(state: unknown): string {
	return JSON.stringify(state);
}

export function loadGameState(serialized: string): unknown {
	return JSON.parse(serialized);
}
