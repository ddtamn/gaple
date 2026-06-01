import type { Server, Connection, ConnectionContext } from 'partykit/server';
import { GameManager } from '../engine/game';
import { selectAiMove } from '../engine/ai';
import { generateLegalMoves } from '../engine/moves';
import type { GameState, Move, TeamConfig, TeamId, GameResult } from '../engine/types';

// ── Message Protocol ──────────────────────────────────────────────────

type ServerMessage =
	| { type: 'ROOM_STATE'; roomId: string; players: PlayerInfo[]; hostId: string; mode: string; rounds: number }
	| { type: 'PLAYER_JOINED'; player: PlayerInfo }
	| { type: 'PLAYER_LEFT'; playerId: string }
	| { type: 'PLAYER_READY'; playerId: string }
	| { type: 'ALL_READY' }
	| { type: 'GAME_START'; seed: string; state: GameState; currentRound: number; seatAssignment: Record<string, number> }
	| { type: 'MOVE_ACCEPTED'; state: GameState }
	| { type: 'GAME_OVER'; state: GameState }
	| { type: 'ERROR'; message: string }
	| { type: 'CHAT'; playerId: string; message: string };

type ClientMessage =
	| { type: 'JOIN'; name: string }
	| { type: 'LEAVE' }
	| { type: 'READY' }
	| { type: 'UNREADY' }
	| { type: 'START_GAME' }
	| { type: 'PLAY_TILE'; tileId: string; side: 'left' | 'right' }
	| { type: 'PASS' }
	| { type: 'CHAT'; message: string }
	| { type: 'NEXT_ROUND' };

interface PlayerInfo {
	id: string;
	name: string;
	connected: boolean;
	ready: boolean;
	isBot?: boolean;
}

// ── Room Implementation ───────────────────────────────────────────────

const SEAT_NAMES = ['Pemain Bawah', 'AI Kanan', 'Pemain Atas', 'AI Kiri'];
const SEATS_TEAMS: [number[], number[]] = [
	[0, 2],
	[1, 3]
];

export default class GapleRoom implements Server {
	readonly options = { hibernate: false };

	private players: PlayerInfo[] = [];
	private game: GameManager | null = null;
	private gameMode: 'ffa' | 'coop-vs-ai' | 'coop-vs-coop' = 'ffa';
	private gameRounds = 3;
	private currentRound = 0;
	private botTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
	private storageLoaded = false;

	constructor(readonly room: import('partykit/server').Room) {}

	// ── Storage Persistence ─────────────────────────────────────────

	/**
	 * Load room + game state from PartyKit persistent storage (only once).
	 * Called on the first connection after room instantiation.
	 */
	private async loadFromStorage() {
		if (this.storageLoaded) return;
		this.storageLoaded = true;

		try {
			const [room, players, gameState] = await Promise.all([
				this.room.storage.get<any>('room'),
				this.room.storage.get<any[]>('players'),
				this.room.storage.get<any>('game')
			]);

			if (room) {
				this.gameMode = room.mode || 'ffa';
				this.gameRounds = room.rounds || 3;
				this.currentRound = room.currentRound || 0;
			}

			if (players) {
				this.players = [];
				for (let i = 0; i < 4; i++) {
					this.players[i] = players[i] || (undefined as unknown as PlayerInfo);
				}
			}

			if (gameState) {
				const playerNames = gameState.players.map((p: any) => p.name);
				const teamConfig: TeamConfig | undefined =
					this.gameMode === 'coop-vs-ai' || this.gameMode === 'coop-vs-coop'
						? { mode: 'teams', layout: SEATS_TEAMS }
						: undefined;
				const gm = new GameManager(playerNames, gameState.seed || 'seed', teamConfig);
				gm.state = gameState;
				this.game = gm;
			}
		} catch (e) {
			console.error('[GapleRoom] loadFromStorage failed:', e);
		}
	}

	/** Persist room metadata (mode, rounds, currentRound). */
	private async saveRoom() {
		try {
			await this.room.storage.put('room', {
				mode: this.gameMode,
				rounds: this.gameRounds,
				currentRound: this.currentRound
			});
			await this.room.storage.put('players', this.players);
		} catch (e) {
			console.error('[GapleRoom] saveRoom failed:', e);
		}
	}

	/** Persist the full game state (board, hands, scores, etc.). */
	private async saveGame() {
		try {
			if (this.game) {
				await this.room.storage.put('game', this.game.state);
			}
		} catch (e) {
			console.error('[GapleRoom] saveGame failed:', e);
		}
	}

	/** Fire-and-forget persist both room and game state. */
	private persist() {
		this.saveRoom();
		this.saveGame();
	}

	// ── Connection Lifecycle ─────────────────────────────────────────

	async onConnect(connection: Connection, ctx: ConnectionContext) {
		// Restore persisted state (only runs once per room lifetime)
		await this.loadFromStorage();

		const url = new URL(ctx.request.url);
		const name = url.searchParams.get('name') || `Player-${connection.id.slice(0, 4)}`;
		const modeParam = url.searchParams.get('mode') || '';
		const roundsParam = url.searchParams.get('rounds') || '3';

		// Set mode from the first connection (the room creator)
		if (this.players.length === 0 && (modeParam === 'coop-vs-ai' || modeParam === 'coop-vs-coop')) {
			this.gameMode = modeParam;
			this.gameRounds = parseInt(roundsParam, 10) || 3;
		}

		// ── Reconnection: player rejoining mid-game ───────────────
		if (this.game) {
			const existingIndex = this.players.findIndex(
				(p) => p && p.name === name && !p.connected
			);
			if (existingIndex >= 0) {
				this.players[existingIndex].id = connection.id;
				this.players[existingIndex].connected = true;
				connection.setState({ seatIndex: existingIndex, playerId: connection.id });

				// Fill bot seats if needed (coop-vs-ai)
				if (this.gameMode === 'coop-vs-ai') {
					this.fillBotSeats();
				}

				const seatAssignment: Record<string, number> = {};
				for (let i = 0; i < this.players.length; i++) {
					const p = this.players[i];
					if (p) seatAssignment[p.id] = i;
				}

				connection.send(
					JSON.stringify({
						type: 'GAME_START',
						seed: this.game.seed,
						state: this.game.state,
						currentRound: this.currentRound,
						seatAssignment
					} satisfies ServerMessage)
				);

				this.broadcast({
					type: 'PLAYER_JOINED',
					player: { ...this.players[existingIndex], id: connection.id }
				});
				this.broadcastRoomState();
				return;
			}
		}

		// ── New connection ────────────────────────────────────────

		// Assign seat based on mode
		const seatIndex = this.findAvailableSeat();
		if (seatIndex < 0) {
			connection.send(
				JSON.stringify({ type: 'ERROR', message: 'Room is full' } satisfies ServerMessage)
			);
			connection.close();
			return;
		}

		const playerInfo: PlayerInfo = {
			id: connection.id,
			name: name,
			connected: true,
			ready: false
		};

		this.players[seatIndex] = playerInfo;
		connection.setState({ seatIndex, playerId: connection.id });

		// For coop-vs-ai: immediately fill AI seats (1 and 3)
		if (this.gameMode === 'coop-vs-ai') {
			this.fillBotSeats();
		}

		// Notify all
		this.broadcast({
			type: 'PLAYER_JOINED',
			player: playerInfo
		});

		this.broadcastRoomState();
	}

	async onClose(connection: Connection) {
		const state = connection.state as { seatIndex?: number } | null;
		if (state?.seatIndex !== undefined && this.players[state.seatIndex]) {
			if (this.game) {
				// Game in progress — keep slot, just mark disconnected (allows reconnect)
				this.players[state.seatIndex].connected = false;
			} else {
				// Lobby — remove player entirely
				this.players[state.seatIndex] = undefined as unknown as PlayerInfo;

				// Clean up trailing undefineds (not middle ones)
				while (this.players.length > 0 && !this.players[this.players.length - 1]) {
					this.players.pop();
				}
			}

			// For coop-vs-ai: re-fill bot seats if game hasn't started
			if (this.gameMode === 'coop-vs-ai' && !this.game) {
				this.fillBotSeats();
			}

			this.broadcast({
				type: 'PLAYER_LEFT',
				playerId: connection.id
			});

			this.broadcastRoomState();
		}

		// Cancel bot timeout and turn timeout if game running
		if (state?.seatIndex !== undefined && this.game) {
			const playerId = this.game.state.players[state.seatIndex]?.id;
			if (playerId) {
				const existing = this.botTimeouts.get(playerId);
				if (existing) {
					clearTimeout(existing);
					this.botTimeouts.delete(playerId);
				}
				this.clearTurnTimeout(playerId);
			}
		}
	}

	// ── Message Handling ──────────────────────────────────────────────

	async onMessage(rawMessage: string | ArrayBuffer | ArrayBufferView, sender: Connection) {
		const message = JSON.parse(rawMessage.toString()) as ClientMessage;
		const senderState = sender.state as { seatIndex?: number } | null;
		const playerId = sender.id;

		switch (message.type) {
			case 'READY':
				this.handleReady(playerId, true);
				break;
			case 'UNREADY':
				this.handleReady(playerId, false);
				break;
			case 'START_GAME':
				await this.handleStartGame(sender);
				break;
			case 'PLAY_TILE':
				this.handlePlayTile(sender, senderState, message.tileId, message.side);
				break;
			case 'PASS':
				this.handlePass(sender, senderState);
				break;
			case 'NEXT_ROUND':
				this.handleNextRound(sender);
				break;
			case 'CHAT':
				this.broadcast({
					type: 'CHAT',
					playerId,
					message: message.message
				});
				break;
		}
	}

	// ── Game Logic ────────────────────────────────────────────────────

	private handleReady(playerId: string, ready: boolean) {
		const player = this.players.find((p) => p?.id === playerId);
		if (player) {
			player.ready = ready;
			this.broadcast({
				type: 'PLAYER_READY',
				playerId
			});
			this.broadcastRoomState();
		}
	}

	private async handleStartGame(sender: Connection) {
		const senderState = sender.state as { seatIndex?: number } | null;
		if (senderState?.seatIndex !== 0) {
			this.sendTo(sender, { type: 'ERROR', message: 'Only the host can start the game' });
			return;
		}

		// Validate room is ready based on mode
		if (this.gameMode === 'coop-vs-coop') {
			const humans = this.players.filter((p) => p && !p.isBot);
			if (humans.length < 4) {
				this.sendTo(sender, { type: 'ERROR', message: 'Need 4 players to start' });
				return;
			}
			if (!humans.every((p) => p.ready)) {
				this.sendTo(sender, { type: 'ERROR', message: 'All players must be ready' });
				return;
			}
		} else if (this.gameMode === 'coop-vs-ai') {
			// Need at least the second human (seat 2)
			if (!this.players[2]) {
				this.sendTo(sender, { type: 'ERROR', message: 'Need a teammate to join first' });
				return;
			}
			this.fillBotSeats();
		} else {
			// FFA: fill all with bots
			this.fillBotSeats();
		}

		// Mark all bots ready
		this.players.forEach((p) => {
			if (p && p.isBot) p.ready = true;
		});

		this.broadcastRoomState();

		const seed = Math.random().toString(36).substring(2, 10);
		const teamConfig: TeamConfig | undefined =
			this.gameMode === 'coop-vs-ai' || this.gameMode === 'coop-vs-coop'
				? { mode: 'teams' as const, layout: SEATS_TEAMS }
				: undefined;

		const playerNames = this.players.map((p) => p.name);
		this.game = new GameManager(playerNames, seed, teamConfig);
		this.game.startGame();
		this.currentRound = 1;

		// Build seat assignment: connectionId → game state player index
		const seatAssignment: Record<string, number> = {};
		for (let i = 0; i < this.players.length; i++) {
			const p = this.players[i];
			if (p) seatAssignment[p.id] = i;
		}

		// Broadcast initial state
		this.broadcast({
			type: 'GAME_START',
			seed,
			state: this.game.state,
			currentRound: this.currentRound,
			seatAssignment
		});

		// Run bot turns if applicable (coop-vs-ai: AIs are at seats 1 and 3)
		if (this.gameMode === 'coop-vs-ai' || this.gameMode === 'ffa') {
			this.handleNextTurn();
		}
	}

	/** FIXED: Use seatIndex from connection state instead of connection ID */
	private handlePlayTile(
		sender: Connection,
		senderState: { seatIndex?: number } | null,
		tileId: string,
		side: 'left' | 'right'
	) {
		if (!this.game || this.game.state.result) return;

		const seatIndex = senderState?.seatIndex;
		if (seatIndex === undefined || seatIndex !== this.game.turnIndex) {
			this.sendTo(sender, { type: 'ERROR', message: 'Not your turn' });
			return;
		}

		const playerId = this.game.state.players[seatIndex].id;
		const success = this.game.nextTurn(playerId, tileId, side);
		if (!success) {
			this.sendTo(sender, { type: 'ERROR', message: 'Invalid move' });
			return;
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			this.handleNextTurn();
		}
	}

	/** FIXED: Use seatIndex from connection state instead of connection ID */
	private handlePass(sender: Connection, senderState: { seatIndex?: number } | null) {
		if (!this.game || this.game.state.result) return;

		const seatIndex = senderState?.seatIndex;
		if (seatIndex === undefined || seatIndex !== this.game.turnIndex) {
			this.sendTo(sender, { type: 'ERROR', message: 'Not your turn' });
			return;
		}

		const playerId = this.game.state.players[seatIndex].id;
		const success = this.game.passTurn(playerId);
		if (!success) {
			this.sendTo(sender, {
				type: 'ERROR',
				message: 'You have moves available — cannot pass'
			});
			return;
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			this.handleNextTurn();
		}
	}

	// ── Bot Management ────────────────────────────────────────────────

	private fillBotSeats() {
		// For coop-vs-ai: seats 1 and 3 are AI
		if (this.gameMode === 'coop-vs-ai') {
			for (const seatIdx of [1, 3]) {
				if (!this.players[seatIdx]) {
					this.players[seatIdx] = {
						id: `bot-${seatIdx}`,
						name: SEAT_NAMES[seatIdx] || `Bot ${seatIdx}`,
						connected: true,
						ready: true,
						isBot: true
					};
				}
			}
			return;
		}

		// FFA: fill all empty seats
		while (this.players.length < 4) {
			const botIndex = this.players.length;
			this.players.push({
				id: `bot-${botIndex}`,
				name: SEAT_NAMES[botIndex] || `Bot ${botIndex}`,
				connected: true,
				ready: true,
				isBot: true
			});
		}
	}

	// ── Turn Timeout Configuration ──────────────────────────────────
	// Auto-play a random valid move after this many seconds
	private readonly HUMAN_TURN_TIMEOUT_MS = 30_000;
	private turnTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

	private async handleNextTurn() {
		if (!this.game || this.game.state.result) return;

		const currentPlayer = this.game.currentPlayer;
		const playerInfo = this.players[this.game.turnIndex];

		// Auto-pass if current player has no legal moves (bot or human)
		if (!this.game.hasMoveAvailable(currentPlayer.id)) {
			this.game.passTurn(currentPlayer.id);
			if (this.game.state.result) {
				this.broadcast({ type: 'GAME_OVER', state: this.game.state });
			} else {
				this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
				// Continue handling next player
				this.handleNextTurn();
			}
			return;
		}

		// Cancel any existing turn timeout for this player
		this.clearTurnTimeout(currentPlayer.id);

		if (playerInfo?.isBot) {
			// Bot turn with delay
			const delay = 300 + Math.random() * 400;
			const timeout = setTimeout(() => {
				this.botTimeouts.delete(currentPlayer.id);
				this.runBotTurn(currentPlayer.id);
			}, delay);
			this.botTimeouts.set(currentPlayer.id, timeout);
		} else {
			// Human turn — set auto-play timeout
			const timeout = setTimeout(() => {
				this.turnTimeouts.delete(currentPlayer.id);
				this.autoPlayTurn(currentPlayer.id);
			}, this.HUMAN_TURN_TIMEOUT_MS);
			this.turnTimeouts.set(currentPlayer.id, timeout);
		}
	}

	/** Auto-play a random valid move for a player who ran out of time. */
	private autoPlayTurn(playerId: string) {
		if (!this.game || this.game.state.result) return;
		if (this.game.currentPlayer.id !== playerId) return;

		const state = this.game.state;
		const moves = generateLegalMoves(state, playerId);

		if (moves.length > 0) {
			const move = moves[Math.floor(Math.random() * moves.length)];
			this.game.nextTurn(playerId, move.tileId, move.side);
		} else {
			this.game.passTurn(playerId);
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			this.handleNextTurn();
		}
	}

	private clearTurnTimeout(playerId: string) {
		const existing = this.turnTimeouts.get(playerId);
		if (existing) {
			clearTimeout(existing);
			this.turnTimeouts.delete(playerId);
		}
	}

	// Helper to clear all turn timeouts
	private clearAllTurnTimeouts() {
		for (const [, timeout] of this.turnTimeouts) {
			clearTimeout(timeout);
		}
		this.turnTimeouts.clear();
	}

	private runBotTurn(playerId: string) {
		if (!this.game || this.game.state.result) return;

		if (this.game.currentPlayer.id !== playerId) return;

		const state = this.game.state;
		// Determine which seats are occupied by human players (their hands are visible to the AI)
		// Map-then-filter to preserve seat indices (after filter, index doesn't match seat)
		const humanPlayerIds = this.players
			.map((p, i) => (p && !p.isBot ? String(i) : null))
			.filter((x): x is string => x !== null);
		// Give AI a 28-second time budget — slightly less than the 30s turn timer
		const move = selectAiMove(state, playerId, { humanPlayerIds, timeLimitMs: 28_000 });

		if (move) {
			this.game.nextTurn(move.playerId, move.tileId, move.side);
		} else {
			this.game.passTurn(playerId);
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			this.handleNextTurn();
		}
	}

	// ── Next Round ───────────────────────────────────────────────────

	private handleNextRound(sender: Connection) {
		const senderState = sender.state as { seatIndex?: number } | null;
		if (senderState?.seatIndex !== 0) {
			this.sendTo(sender, { type: 'ERROR', message: 'Only the host can start the next round' });
			return;
		}

		if (!this.game) {
			this.sendTo(sender, { type: 'ERROR', message: 'No game in progress' });
			return;
		}

		// Clear bot and turn timeouts
		for (const [, timeout] of this.botTimeouts) {
			clearTimeout(timeout);
		}
		this.botTimeouts.clear();
		this.clearAllTurnTimeouts();

		const previousWinnerId = this.game.state.result?.winnerId;
		// Preserve cumulative scores across rounds
		const prevStandings = { ...this.game.state.pointStandings };
		const playerNames = this.players.map((p) => p.name);
		const teamConfig: TeamConfig | undefined =
			this.gameMode === 'coop-vs-ai' || this.gameMode === 'coop-vs-coop'
				? { mode: 'teams' as const, layout: SEATS_TEAMS }
				: undefined;

		this.game = new GameManager(playerNames, undefined, teamConfig);
		this.currentRound++;
		this.game.startGame(previousWinnerId);
		// Restore cumulative pointStandings (startGame resets them from the fresh state)
		this.game.state = { ...this.game.state, pointStandings: prevStandings };

		// Build seat assignment for the new round
		const seatAssignment: Record<string, number> = {};
		for (let i = 0; i < this.players.length; i++) {
			const p = this.players[i];
			if (p) seatAssignment[p.id] = i;
		}

		this.broadcast({
			type: 'GAME_START',
			seed: this.game.state.seed,
			state: this.game.state,
			currentRound: this.currentRound,
			seatAssignment
		});

		// Run bot turns if applicable
		if (this.gameMode === 'coop-vs-ai' || this.gameMode === 'ffa') {
			this.handleNextTurn();
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────

	private findAvailableSeat(): number {
		if (this.gameMode === 'coop-vs-ai') {
			// Only seats 0 (host) and 2 (joiner) are available for humans
			if (!this.players[0]) return 0;
			if (!this.players[2]) return 2;
			return -1; // Both human seats taken
		}

		for (let i = 0; i < 4; i++) {
			if (!this.players[i]) return i;
		}
		return this.players.length;
	}

	private broadcastRoomState() {
		this.broadcast({
			type: 'ROOM_STATE',
			roomId: this.room.id,
			players: this.players.filter(Boolean),
			hostId: this.players[0]?.id || '',
			mode: this.gameMode,
			rounds: this.gameRounds
		});
	}

	private broadcast(msg: ServerMessage) {
		this.room.broadcast(JSON.stringify(msg));
		this.persist(); // Persist state after every broadcast
	}

	private sendTo(connection: Connection, msg: ServerMessage) {
		try {
			connection.send(JSON.stringify(msg));
		} catch {
			// Connection closed
		}
	}

	private sendToPlayer(playerId: string, msg: ServerMessage) {
		const conn = this.room.getConnection(playerId);
		if (conn) this.sendTo(conn, msg);
	}
}
