// src/lib/game.svelte.ts
import { GameManager as PureGameManager } from '../engine/game';
import type { GameState, Move } from '../engine/types';

export class SvelteGameManager {
	private engine: PureGameManager;
	
	// Gunakan $state untuk membuat UI bereaksi saat variabel ini ditimpa (di-assign ulang)
	public state = $state<GameState>() as GameState;

	constructor(playerNames: string[], seed?: string) {
		this.engine = new PureGameManager(playerNames, seed);
		this.state = this.engine.state;
	}

	startGame() {
		this.engine.startGame();
		this.syncState();
	}

	nextTurn(playerId: string, tileId: string, side: Move['side']): boolean {
		const success = this.engine.nextTurn(playerId, tileId, side);
		if (success) {
			this.syncState();
		}
		return success;
	}

	passTurn(playerId: string): boolean {
		const success = this.engine.passTurn(playerId);
		if (success) {
			this.syncState();
		}
		return success;
	}

	// Fungsi helper untuk memaksa Svelte mendeteksi perubahan
	private syncState() {
		// Svelte 5 akan mendeteksi assignment ini dan merender ulang UI yang bersangkutan
		this.state = this.engine.state;
	}
}