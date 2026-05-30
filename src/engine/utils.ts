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

/**
 * Menghitung sisa kartu untuk setiap angka (0-6) yang tidak terlihat oleh pemain utama.
 * * @param playedTiles Array kartu yang sudah ada di atas meja (board)
 * @param playerHand Array kartu yang ada di tangan pemain (index 0)
 * @returns Object berisi sisa kartu untuk masing-masing angka (0 sampai 6)
 */
export function getRemainingTilesCount(
	playedTiles: Domino[],
	playerHand: Domino[]
): Record<number, number> {
	// Standar domino double-six: masing-masing angka (0-6) ada di 7 kartu berbeda
	const remainingCounts: Record<number, number> = { 0: 7, 1: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7 };

	// Fungsi helper untuk mengurangi hitungan berdasarkan angka di kiri dan kanan kartu
	const processTile = (tile: Domino) => {
		// Kurangi hitungan untuk angka sebelah kiri
		remainingCounts[tile.left] -= 1;

		// Jika bukan kartu balak/kembar, kurangi juga hitungan untuk angka sebelah kanan
		if (tile.left !== tile.right) {
			remainingCounts[tile.right] -= 1;
		}
	};

	// 1. Kurangi dengan kartu yang sudah terbuka di meja
	playedTiles.forEach(processTile);

	// 2. Kurangi dengan kartu yang sedang dipegang di tangan pemain utama
	playerHand.forEach(processTile);

	return remainingCounts;
}

// Menghitung jumlah titik (pips) pada satu kartu
export function getTilePips(tile: Domino): number {
	return tile.left + tile.right;
}

// Menghitung total titik (pips) di tangan pemain
export function getHandPips(hand: Domino[]): number {
	return hand.reduce((sum, tile) => sum + getTilePips(tile), 0);
}
