import { GameManager as PureGameManager } from '../engine/game';
import type { GameState, Move } from '../engine/types';
// import { selectAiMove } from '../engine/ai';
import AiWorker from './ai.worker?worker';

export class SvelteGameManager {
	private engine: PureGameManager;
	private botIds: string[] = [];
	private botTimeout = 0;
	private botThinking = false;
	private winCounts: Record<string, number> = {};
	private lastRecordedResult: GameState['result'] = null;

	private aiWorker: Worker | null = null;

	// Gunakan $state untuk membuat UI bereaksi saat variabel ini ditimpa (di-assign ulang)
	public state = $state<GameState>() as GameState;

	constructor(playerNames: string[], seed?: string) {
		this.engine = new PureGameManager(playerNames, seed);
		this.state = this.engine.state;

		if (typeof window !== 'undefined') {
			this.aiWorker = new AiWorker();
		}
	}

	startGame(previousWinnerId?: string) {
		this.engine.startGame(previousWinnerId);
		this.lastRecordedResult = null;
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

	private getAiMoveFromWorker(state: GameState, playerId: string): Promise<Move | null> {
		return new Promise((resolve, reject) => {
			if (!this.aiWorker) return resolve(null);

			const handleMessage = (e: MessageEvent) => {
				this.aiWorker!.removeEventListener('message', handleMessage);
				if (e.data.type === 'SUCCESS') resolve(e.data.move);
				else reject(e.data.error);
			};

			this.aiWorker.addEventListener('message', handleMessage);

			// PENTING: Kita harus menghilangkan Svelte $state Proxy sebelum mengirimnya ke Worker.
			// Menggunakan JSON.parse(JSON.stringify) adalah cara teraman menghindari 'DataCloneError'.
			const pureState = JSON.parse(JSON.stringify(state));
			this.aiWorker.postMessage({ state: pureState, playerId });
		});
	}

	private isBotTurn() {
		return !this.engine.state.result && this.botIds.includes(this.engine.currentPlayer.id);
	}

	private scheduleBotTurn() {
		if (this.botThinking || !this.isBotTurn() || typeof window === 'undefined') return;
		this.botThinking = true;
		if (this.botTimeout) {
			clearTimeout(this.botTimeout);
		}
		this.botTimeout = window.setTimeout(
			() => {
				this.botThinking = false;
				this.runBotTurn();
			},
			750 + Math.floor(Math.random() * 550)
		);
	}

	private async runBotTurn() {
		if (this.engine.state.result) return;

		const currentPlayer = this.engine.currentPlayer;
		try {
			// Tunggu Worker selesai berpikir (UI Anda TIDAK akan freeze saat ini terjadi!)
			const move = await this.getAiMoveFromWorker(this.state, currentPlayer.id);

			if (move) {
				let success = this.nextTurn(move.playerId, move.tileId, move.side);
				if (!success) {
					const otherSide = move.side === 'left' ? 'right' : 'left';
					success = this.nextTurn(move.playerId, move.tileId, otherSide);
				}
				if (!success) {
					console.warn('AI mencoba langkah tidak valid, memaksa Pass.');
					this.passTurn(currentPlayer.id);
				}
			} else {
				this.passTurn(currentPlayer.id);
			}
		} catch (e) {
			console.error('AI Worker Error:', e);
			this.passTurn(currentPlayer.id);
		}
	}

	// Fungsi helper untuk memaksa Svelte mendeteksi perubahan
	private syncState() {
		const previousResult = this.state?.result ?? null;

		if (
			!this.engine.state.result &&
			!this.isBotTurn() &&
			!this.engine.hasMoveAvailable(this.engine.currentPlayer.id)
		) {
			this.engine.passTurn(this.engine.currentPlayer.id);
			this.state = this.engine.state;
			this.maybeRunBot();
			return;
		}

		// Svelte 5 akan mendeteksi assignment ini dan merender ulang UI yang bersangkutan
		this.state = this.engine.state;

		if (
			this.engine.state.result &&
			(!previousResult ||
				previousResult.winnerId !== this.engine.state.result.winnerId ||
				previousResult.reason !== this.engine.state.result.reason)
		) {
			this.winCounts[this.engine.state.result.winnerId] =
				(this.winCounts[this.engine.state.result.winnerId] ?? 0) + 1;
		}

		this.maybeRunBot();
	}

	getWinCount(playerId: string) {
		return this.winCounts[playerId] ?? 0;
	}

	private maybeRunBot() {
		if (this.isBotTurn()) {
			this.scheduleBotTurn();
		}
	}
}
