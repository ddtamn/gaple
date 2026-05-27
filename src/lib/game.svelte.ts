// src/lib/game.svelte.ts
import { GameManager as PureGameManager } from '../engine/game';
import { selectAiMove } from '../engine/ai';
import type { GameState, Move } from '../engine/types';

export class SvelteGameManager {
	private engine: PureGameManager;
	private botIds: string[] = [];
	private botTimeout = 0;
	private botThinking = false;
	
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

	setBotPlayers(botIds: string[]) {
		this.botIds = botIds;
		this.maybeRunBot();
	}

	private isBotTurn() {
		return this.botIds.includes(this.engine.currentPlayer.id);
	}

	private scheduleBotTurn() {
		if (this.botThinking || !this.isBotTurn()) return;
		this.botThinking = true;
		if (this.botTimeout) {
			clearTimeout(this.botTimeout);
		}
		this.botTimeout = window.setTimeout(() => {
			this.botThinking = false;
			this.runBotTurn();
		}, 180);
	}

	private runBotTurn() {
		const currentPlayer = this.engine.currentPlayer;
		try {
			// Panggil AI Monte Carlo
			const move = selectAiMove(this.state, currentPlayer.id);
			
			if (move) {
				// Coba pasang batu ke sisi yang dipilih AI
				let success = this.nextTurn(move.playerId, move.tileId, move.side);
				
				// JIKA DITOLAK: Berarti sisi-nya terbalik! Coba pasang ke sisi sebelahnya.
				if (!success) {
					const otherSide = move.side === 'left' ? 'right' : 'left';
					success = this.nextTurn(move.playerId, move.tileId, otherSide);
				}
				
				// JIKA MASIH DITOLAK: Berarti batunya benar-benar tidak valid. Paksa Pass agar tidak macet.
				if (!success) {
					console.warn('AI mencoba langkah tidak valid, memaksa Pass.');
					this.passTurn(currentPlayer.id);
				}
			} else {
				// Jika AI mengembalikan null, berarti tidak ada kartu yang bisa jalan
				this.passTurn(currentPlayer.id);
			}
		} catch (e) {
			console.error("AI Error:", e);
			// Fallback aman: Jika otak AI error, paksa Pass agar UI pemain tidak freeze
			this.passTurn(currentPlayer.id);
		}
	}

	// Fungsi helper untuk memaksa Svelte mendeteksi perubahan
	private syncState() {
		// Svelte 5 akan mendeteksi assignment ini dan merender ulang UI yang bersangkutan
		this.state = this.engine.state;
		this.maybeRunBot();
	}

	private maybeRunBot() {
		if (this.isBotTurn()) {
			this.scheduleBotTurn();
		}
	}
}