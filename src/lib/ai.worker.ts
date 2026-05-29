import { selectAiMove } from '../engine/ai';
import type { GameState } from '../engine/types';

// Event Listener ini akan menangkap pesan (data state game) dari Main Thread
self.onmessage = (e: MessageEvent<{ state: GameState; playerId: string }>) => {
	try {
		const { state, playerId } = e.data;

		// Panggil fungsi AI yang berat di dalam thread terpisah ini
		const move = selectAiMove(state, playerId);

		// Kirim hasilnya kembali ke Main Thread
		self.postMessage({ type: 'SUCCESS', move });
	} catch (error) {
		self.postMessage({ type: 'ERROR', error });
	}
};
