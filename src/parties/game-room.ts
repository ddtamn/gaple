import type { Server, Connection, ConnectionContext } from 'partykit/server';
import { GameManager } from '../engine/game';
import { selectAiMove } from '../engine/ai';
import type { GameState, Move, TeamConfig, TeamId, GameResult } from '../engine/types';

// ── Message Protocol ──────────────────────────────────────────────────

type ServerMessage =
	| { type: 'ROOM_STATE'; roomId: string; players: PlayerInfo[]; hostId: string; mode: string; rounds: number }
	| { type: 'PLAYER_JOINED'; player: PlayerInfo }
	| { type: 'PLAYER_LEFT'; playerId: string }
	| { type: 'PLAYER_READY'; playerId: string }
	| { type: 'ALL_READY' }
	| { type: 'GAME_START'; seed: string; state: GameState }
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
	| { type: 'CHAT'; message: string };

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
	private botCount = 2;
	private botTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(readonly room: import('partykit/server').Room) {}

	// ── Connection Lifecycle ─────────────────────────────────────────

	async onConnect(connection: Connection, ctx: ConnectionContext) {
		const url = new URL(ctx.request.url);
		const name = url.searchParams.get('name') || `Player-${connection.id.slice(0, 4)}`;
		const modeParam = url.searchParams.get('mode') || '';
		const roundsParam = url.searchParams.get('rounds') || '3';

		// Set mode from the first connection (the room creator)
		if (this.players.length === 0 && (modeParam === 'coop-vs-ai' || modeParam === 'coop-vs-coop')) {
			this.gameMode = modeParam;
			this.gameRounds = parseInt(roundsParam, 10) || 3;
		}

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
			this.players[state.seatIndex] = undefined!;

			// Don't compact the array — preserve seat indices
			// But clean up trailing undefineds (not middle ones)
			while (this.players.length > 0 && !this.players[this.players.length - 1]) {
				this.players.pop();
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

		// Cancel bot timeout if game running
		if (state?.seatIndex !== undefined && this.game) {
			const playerId = this.game.state.players[state.seatIndex]?.id;
			if (playerId) {
				const existing = this.botTimeouts.get(playerId);
				if (existing) {
					clearTimeout(existing);
					this.botTimeouts.delete(playerId);
				}
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

		// Broadcast initial state
		this.broadcast({
			type: 'GAME_START',
			seed,
			state: this.game.state
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

		// Only schedule bot turns with delay
		if (!playerInfo?.isBot) return;

		const existing = this.botTimeouts.get(currentPlayer.id);
		if (existing) clearTimeout(existing);

		const delay = 800 + Math.random() * 600;
		const timeout = setTimeout(() => {
			this.botTimeouts.delete(currentPlayer.id);
			this.runBotTurn(currentPlayer.id);
		}, delay);
		this.botTimeouts.set(currentPlayer.id, timeout);
	}

	private runBotTurn(playerId: string) {
		if (!this.game || this.game.state.result) return;

		if (this.game.currentPlayer.id !== playerId) return;

		const state = this.game.state;
		const move = selectAiMove(state, playerId);

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
