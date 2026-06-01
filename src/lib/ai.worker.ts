import { selectAiMove } from '../engine/ai';
import type { GameState } from '../engine/types';

// Event Listener ini akan menangkap pesan (data state game) dari Main Thread
self.onmessage = (e: MessageEvent<{ state: GameState; playerId: string; humanPlayerIds?: string[] }>) => {
	try {
		const { state, playerId, humanPlayerIds } = e.data;

		// Panggil fungsi AI yang berat di dalam thread terpisah ini
		const move = selectAiMove(state, playerId, { humanPlayerIds: humanPlayerIds ?? ['0'] });

		// Kirim hasilnya kembali ke Main Thread
		self.postMessage({ type: 'SUCCESS', move });
	} catch (error) {
		self.postMessage({ type: 'ERROR', error });
	}
};
