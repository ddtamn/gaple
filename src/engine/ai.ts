import type { GameState, Move, Domino } from './types';
import { generateLegalMoves } from './moves';
import { GameManager } from './game';
import { createDomino } from './domino';

// Membuat deck standar untuk menebak kartu misteri
function getStandardDeck(): Domino[] {
	const deck: Domino[] = [];
	for (let i = 0; i <= 6; i++) {
		for (let j = i; j <= 6; j++) {
			deck.push(createDomino(i, j));
		}
	}
	return deck;
}

// FASE 1: Menebak Kartu (Imperfect Information)
function determinizeState(state: GameState, aiPlayerId: string): GameState {
	const tempManager = new GameManager(state.players.map(p => p.name), state.seed);
	tempManager.state = state;
	const clonedState = tempManager.cloneState();

	const knownTiles = new Set<string>();
	
	// Catat kartu yang terlihat di meja
	clonedState.board.playedTiles.forEach(t => knownTiles.add(`${t.left}|${t.right}`));
	
	// Catat kartu di tangan AI
	const aiPlayer = clonedState.players.find(p => p.id === aiPlayerId);
	if (aiPlayer) {
		aiPlayer.hand.forEach(t => knownTiles.add(`${t.left}|${t.right}`));
	}

	// Filter deck untuk mencari kartu yang belum terlihat
	let mysteryTiles = getStandardDeck().filter(
		t => !knownTiles.has(`${t.left}|${t.right}`) && !knownTiles.has(`${t.right}|${t.left}`)
	);
	
	// Acak kartu misteri
	mysteryTiles = mysteryTiles.sort(() => Math.random() - 0.5);

	// Bagikan kartu misteri ke musuh
	clonedState.players.forEach(p => {
		if (p.id !== aiPlayerId) {
			const handSize = p.hand.length;
			p.hand = mysteryTiles.splice(0, handSize);
		}
	});

	return clonedState;
}

// FASE 2: Simulasi Game (Playout) Cepat
function playout(simulatedState: GameState, aiPlayerId: string): boolean {
	const simManager = new GameManager(simulatedState.players.map(p => p.name));
	simManager.state = simulatedState;

	let consecutivePasses = 0;
	let safetyLimit = 100; // Mencegah infinite loop jika simulasi nyangkut

	while (consecutivePasses < 4 && safetyLimit > 0) {
		safetyLimit--;
		const currentPlayer = simManager.currentPlayer;
		
		// Jika kartunya habis, cek apakah yang habis itu si AI
		if (currentPlayer.hand.length === 0) {
			return currentPlayer.id === aiPlayerId;
		}

		const legalMoves = generateLegalMoves(simManager.state, currentPlayer.id);
		
		if (legalMoves.length > 0) {
			const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
			
			// Coba mainkan langkahnya
			let success = simManager.nextTurn(randomMove.playerId, randomMove.tileId, randomMove.side);
			if (!success) {
				const otherSide = randomMove.side === 'left' ? 'right' : 'left';
				success = simManager.nextTurn(randomMove.playerId, randomMove.tileId, otherSide);
			}

			if (success) {
				consecutivePasses = 0;
			} else {
				simManager.passTurn(currentPlayer.id);
				consecutivePasses++;
			}
		} else {
			simManager.passTurn(currentPlayer.id);
			consecutivePasses++;
		}
	}
	return false; 
}

// FASE 3: Loop Utama Monte Carlo
export function selectAiMove(state: GameState, playerId: string): Move | null {
	const legalMoves = generateLegalMoves(state, playerId);
	
	if (legalMoves.length === 0) return null;
	if (legalMoves.length === 1) return legalMoves[0];

	// Simulasi 30x untuk tiap opsi langkah (Total 60-150 playouts)
	const ITERATIONS = 30; 
	let bestMove = legalMoves[0];
	let highestWinRate = -1;

	for (const move of legalMoves) {
		let wins = 0;

		for (let i = 0; i < ITERATIONS; i++) {
			const simState = determinizeState(state, playerId);
			const simManager = new GameManager(simState.players.map(p => p.name));
			simManager.state = simState;
			
			// Terapkan langkah pertama yang sedang diuji
			let success = simManager.nextTurn(move.playerId, move.tileId, move.side);
			if(!success) {
				const otherSide = move.side === 'left' ? 'right' : 'left';
				success = simManager.nextTurn(move.playerId, move.tileId, otherSide);
			}

			if (success) {
				const isWin = playout(simManager.state, playerId);
				if (isWin) wins++;
			}
		}

		const winRate = wins / ITERATIONS;
		console.log(`[AI ${playerId}] Mencoba opsi: Kemenangan ${(winRate * 100).toFixed(1)}%`);

		if (winRate > highestWinRate) {
			highestWinRate = winRate;
			bestMove = move;
		}
	}

	return bestMove;
}