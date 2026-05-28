import type { GameState, Move } from '../types';
import { GameManager } from '../game';
import { generateLegalMoves } from '../moves';
import { createSeededRng } from '../utils';
import { playout } from './playout';
import { createTranspositionTable, hashGameState } from './cache';

export interface MctsOptions {
	iterations?: number;
	seed?: string;
	maxPlayoutTurns?: number;
	exploration?: number;
}

interface MctsNode {
	move: Move | null;
	parent: MctsNode | null;
	children: MctsNode[];
	state: GameState;
	visits: number;
	totalValue: number;
	untriedMoves: Move[];
}

function createNode(state: GameState, parent: MctsNode | null, move: Move | null): MctsNode {
	const currentPlayerId = state.players[state.turnIndex]?.id ?? '';
	return {
		move,
		parent,
		children: [],
		state,
		visits: 0,
		totalValue: 0,
		untriedMoves: generateLegalMoves(state, currentPlayerId)
	};
}

function applyMove(state: GameState, move: Move): GameState {
	const simManager = new GameManager(state.players.map((player) => player.name));
	simManager.state = state;
	if (!simManager.nextTurn(move.playerId, move.tileId, move.side)) {
		simManager.passTurn(move.playerId);
	}
	return simManager.state;
}

function rolloutValue(
	state: GameState,
	playerId: string,
	maxPlayoutTurns: number,
	rng: ReturnType<typeof createSeededRng>,
	cache = createTranspositionTable()
): number {
	const key = hashGameState(state);
	const cached = cache.get(key);
	if (cached) {
		return cached.value;
	}
	const simManager = new GameManager(state.players.map((player) => player.name));
	simManager.state = state;

	let safetyLimit = maxPlayoutTurns;
	while (!simManager.state.result && safetyLimit > 0) {
		safetyLimit--;
		const currentPlayer = simManager.currentPlayer;
		const legalMoves = generateLegalMoves(simManager.state, currentPlayer.id);
		if (legalMoves.length === 0) {
			simManager.passTurn(currentPlayer.id);
			continue;
		}

		const candidate = legalMoves[Math.floor(rng.next() * legalMoves.length)];
		if (!simManager.nextTurn(candidate.playerId, candidate.tileId, candidate.side)) {
			simManager.passTurn(currentPlayer.id);
		}
	}

	const value = playout(simManager.state, playerId, rng, maxPlayoutTurns);
	cache.set(key, { value, visits: 1, updatedAt: Date.now() });
	return value;
}

function selectChild(
	node: MctsNode,
	exploration: number,
	rng: ReturnType<typeof createSeededRng>
): MctsNode {
	if (node.children.length === 0) {
		return node;
	}

	const logParent = Math.log(Math.max(1, node.visits));
	const bestChoice = node.children.reduce<{ node: MctsNode; score: number } | null>(
		(best, child) => {
			const exploitation = child.totalValue / Math.max(1, child.visits);
			const explorationTerm = exploration * Math.sqrt(logParent / Math.max(1, child.visits));
			const score = exploitation + explorationTerm + rng.next() * 0.01;
			if (!best || score > best.score) {
				return { node: child, score };
			}
			return best;
		},
		null
	);

	return bestChoice?.node ?? node;
}

export function runMctsSearch(
	state: GameState,
	playerId: string,
	options: MctsOptions = {}
): Move | null {
	const iterations = options.iterations ?? 8;
	const maxPlayoutTurns = options.maxPlayoutTurns ?? 60;
	const exploration = options.exploration ?? 1.414;
	const rng = createSeededRng(options.seed ?? `mcts-${playerId}`);
	const transpositionTable = createTranspositionTable();
	const root = createNode(state, null, null);

	for (let index = 0; index < iterations; index++) {
		let node = root;

		while (!node.state.result && node.untriedMoves.length === 0 && node.children.length > 0) {
			node = selectChild(node, exploration, rng);
		}

		if (node.untriedMoves.length > 0) {
			const move = node.untriedMoves.splice(
				Math.floor(rng.next() * node.untriedMoves.length),
				1
			)[0];
			const nextState = applyMove(node.state, move);
			const child = createNode(nextState, node, move);
			node.children.push(child);
			node = child;
		}

		const reward = rolloutValue(node.state, playerId, maxPlayoutTurns, rng, transpositionTable);
		let current: MctsNode | null = node;
		while (current) {
			current.visits += 1;
			current.totalValue += reward;
			current = current.parent;
		}
	}

	const legalMoves = generateLegalMoves(state, playerId);
	if (legalMoves.length === 0) {
		return null;
	}

	const bestChild = root.children.reduce(
		(best, child) => {
			if (child.visits > best.visits) {
				return child;
			}
			return best;
		},
		root.children[0] ?? createNode(state, null, legalMoves[0])
	);

	return bestChild.move ?? legalMoves[0];
}
