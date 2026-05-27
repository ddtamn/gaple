import type { Domino, GameState, Move } from './types';
import { playTile } from './board';
import { createDomino } from './domino';
import { GameManager, calculateHandScore } from './game';
import { generateLegalMoves } from './moves';

const ITERATIONS_PER_MOVE = 140;
const MAX_PLAYOUT_TURNS = 120;
const HUMAN_PLAYER_ID = '0';

function getStandardDeck(): Domino[] {
	const deck: Domino[] = [];
	for (let i = 0; i <= 6; i++) {
		for (let j = i; j <= 6; j++) {
			deck.push(createDomino(i, j));
		}
	}
	return deck;
}

function tileKey(tile: Domino): string {
	return `tile-${Math.min(tile.left, tile.right)}-${Math.max(tile.left, tile.right)}`;
}

function shuffleWithMath<T>(items: T[]): T[] {
	const array = [...items];
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

function determinizeState(state: GameState, aiPlayerId: string): GameState {
	const tempManager = new GameManager(state.players.map((player) => player.name), state.seed);
	tempManager.state = state;
	const clonedState = tempManager.cloneState();

	const knownTiles = new Set<string>();
	clonedState.board.playedTiles.forEach((tile) => knownTiles.add(tileKey(tile)));

	const aiPlayer = clonedState.players.find((player) => player.id === aiPlayerId);
	aiPlayer?.hand.forEach((tile) => knownTiles.add(tileKey(tile)));
	const humanPlayer = clonedState.players.find((player) => player.id === HUMAN_PLAYER_ID);
	humanPlayer?.hand.forEach((tile) => knownTiles.add(tileKey(tile)));

	const mysteryTiles = shuffleWithMath(
		getStandardDeck().filter((tile) => !knownTiles.has(tileKey(tile)))
	);

	clonedState.players.forEach((player) => {
		if (player.id !== aiPlayerId && player.id !== HUMAN_PLAYER_ID) {
			player.hand = mysteryTiles.splice(0, player.hand.length);
		}
	});

	return clonedState;
}

function getMoveTile(state: GameState, move: Move): Domino | null {
	return state.players
		.find((player) => player.id === move.playerId)
		?.hand.find((tile) => tile.id === move.tileId) ?? null;
}

function countMatchingNumbers(hand: Domino[], leftEnd: number | null, rightEnd: number | null): number {
	return hand.reduce((total, tile) => {
		const matchesLeft = leftEnd !== null && (tile.left === leftEnd || tile.right === leftEnd);
		const matchesRight = rightEnd !== null && (tile.left === rightEnd || tile.right === rightEnd);
		return total + (matchesLeft ? 1 : 0) + (matchesRight ? 1 : 0);
	}, 0);
}

function getStateAfterMove(state: GameState, move: Move): GameState | null {
	const playerIndex = state.players.findIndex((player) => player.id === move.playerId);
	const player = state.players[playerIndex];
	const tile = getMoveTile(state, move);
	if (!player || !tile) return null;

	const board = playTile(state.board, tile, move.side);
	if (!board) return null;

	return {
		...state,
		board,
		players: state.players.map((item) =>
			item.id === player.id ? { ...item, hand: item.hand.filter((handTile) => handTile.id !== tile.id) } : item
		),
		turnIndex: (playerIndex + 1) % state.players.length
	};
}

function countLegalMovesForBoard(state: GameState, playerId: string): number {
	return generateLegalMoves(state, playerId).length;
}

function countEndpointCopies(hand: Domino[], leftEnd: number | null, rightEnd: number | null): number {
	return hand.reduce((total, tile) => {
		const values = [tile.left, tile.right];
		return total + values.filter((value) => value === leftEnd || value === rightEnd).length;
	}, 0);
}

function scoreTacticalMove(state: GameState, move: Move, perspectivePlayerId: string): number {
	const player = state.players.find((item) => item.id === move.playerId);
	const tile = getMoveTile(state, move);
	const nextState = getStateAfterMove(state, move);
	if (!player || !tile || !nextState) return Number.NEGATIVE_INFINITY;

	const remainingHand = nextState.players.find((item) => item.id === move.playerId)?.hand ?? [];
	const nextPlayer = nextState.players[nextState.turnIndex];
	const human = nextState.players.find((item) => item.id === HUMAN_PLAYER_ID);
	const nextPlayerMoves = countLegalMovesForBoard(nextState, nextPlayer.id);
	const humanMoves = human ? countLegalMovesForBoard(nextState, human.id) : 0;
	const ownFutureOptions = countEndpointCopies(
		remainingHand,
		nextState.board.leftEnd,
		nextState.board.rightEnd
	);
	const highRiskOpponent = nextPlayer.id !== perspectivePlayerId && nextPlayer.hand.length <= 2;

	let score = 0;
	score += (tile.left + tile.right) * 2.4;
	score += ownFutureOptions * 8;
	score += remainingHand.length === 0 ? 10_000 : 0;
	score += tile.left === tile.right ? 8 : 0;
	score += nextPlayerMoves === 0 ? 35 : -nextPlayerMoves * 3;
	score += highRiskOpponent && nextPlayerMoves === 0 ? 90 : 0;

	if (human && human.id !== perspectivePlayerId) {
		score += humanMoves === 0 ? 110 : -humanMoves * 7;
		score += human.hand.length <= 2 && humanMoves === 0 ? 140 : 0;
		score += human.hand.length <= 2 && humanMoves > 0 ? -120 : 0;
	}

	const bestOpponentHandSize = Math.min(
		...nextState.players
			.filter((item) => item.id !== perspectivePlayerId)
			.map((item) => item.hand.length)
	);
	score += (bestOpponentHandSize - remainingHand.length) * 12;

	return score;
}

function scoreMoveForPlayout(state: GameState, move: Move): number {
	const player = state.players.find((item) => item.id === move.playerId);
	const tile = getMoveTile(state, move);
	if (!player || !tile) return Number.NEGATIVE_INFINITY;

	const nextState = getStateAfterMove(state, move);
	if (!nextState) return Number.NEGATIVE_INFINITY;

	const nextBoard = nextState.board;
	const remainingHand = nextState.players.find((item) => item.id === player.id)?.hand ?? [];
	const pipScore = tile.left + tile.right;
	const futureOptions = countMatchingNumbers(remainingHand, nextBoard.leftEnd, nextBoard.rightEnd);
	const tacticalScore = scoreTacticalMove(state, move, player.id);

	return (
		tacticalScore * 0.45 +
		pipScore * 2 +
		futureOptions * 2 +
		(tile.left === tile.right ? 5 : 0) +
		(remainingHand.length === 0 ? 500 : 0)
	);
}

function choosePlayoutMove(state: GameState, legalMoves: Move[]): Move {
	const rankedMoves = [...legalMoves]
		.map((move) => ({ move, score: scoreMoveForPlayout(state, move) + Math.random() * 3 }))
		.sort((a, b) => b.score - a.score);

	const candidateCount = Math.min(3, rankedMoves.length);
	return rankedMoves[Math.floor(Math.random() * candidateCount)].move;
}

function evaluateResult(state: GameState, aiPlayerId: string): number {
	if (!state.result) {
		const aiPlayer = state.players.find((player) => player.id === aiPlayerId);
		const aiScore = aiPlayer ? calculateHandScore(aiPlayer) : 99;
		const bestOpponentScore = Math.min(
			...state.players
				.filter((player) => player.id !== aiPlayerId)
				.map((player) => calculateHandScore(player))
		);

		return bestOpponentScore - aiScore;
	}

	const aiScore = state.result.scores[aiPlayerId] ?? 99;
	const bestOpponentScore = Math.min(
		...state.players
			.filter((player) => player.id !== aiPlayerId)
			.map((player) => state.result?.scores[player.id] ?? 99)
	);
	const margin = bestOpponentScore - aiScore;

	return state.result.winnerId === aiPlayerId ? 100 + margin : -100 + margin;
}

function playout(simulatedState: GameState, aiPlayerId: string): number {
	const simManager = new GameManager(simulatedState.players.map((player) => player.name));
	simManager.state = simulatedState;

	let safetyLimit = MAX_PLAYOUT_TURNS;

	while (!simManager.state.result && safetyLimit > 0) {
		safetyLimit--;
		const currentPlayer = simManager.currentPlayer;
		const legalMoves = generateLegalMoves(simManager.state, currentPlayer.id);

		if (legalMoves.length > 0) {
			const move = choosePlayoutMove(simManager.state, legalMoves);
			if (!simManager.nextTurn(move.playerId, move.tileId, move.side)) {
				simManager.passTurn(currentPlayer.id);
			}
		} else {
			simManager.passTurn(currentPlayer.id);
		}
	}

	return evaluateResult(simManager.state, aiPlayerId);
}

function summarizeMove(state: GameState, move: Move): string {
	const tile = getMoveTile(state, move);
	return tile ? `${tile.left}-${tile.right} ke ${move.side}` : `${move.tileId} ke ${move.side}`;
}

export function selectAiMove(state: GameState, playerId: string): Move | null {
	const legalMoves = generateLegalMoves(state, playerId);

	if (legalMoves.length === 0) return null;
	if (legalMoves.length === 1) return legalMoves[0];

	let bestMove = legalMoves[0];
	let highestScore = Number.NEGATIVE_INFINITY;

	for (const move of legalMoves) {
		const tacticalScore = scoreTacticalMove(state, move, playerId);
		if (tacticalScore >= 10_000) {
			return move;
		}

		let playoutScore = 0;

		for (let i = 0; i < ITERATIONS_PER_MOVE; i++) {
			const simState = determinizeState(state, playerId);
			const simManager = new GameManager(simState.players.map((player) => player.name));
			simManager.state = simState;

			if (simManager.nextTurn(move.playerId, move.tileId, move.side)) {
				playoutScore += playout(simManager.state, playerId);
			} else {
				playoutScore -= 150;
			}
		}

		const averageScore = playoutScore / ITERATIONS_PER_MOVE + tacticalScore * 2.75;
		console.log(
			`[AI ${playerId}] ${summarizeMove(state, move)}: taktis ${tacticalScore.toFixed(1)}, skor ${averageScore.toFixed(2)}`
		);

		if (averageScore > highestScore) {
			highestScore = averageScore;
			bestMove = move;
		}
	}

	return bestMove;
}
