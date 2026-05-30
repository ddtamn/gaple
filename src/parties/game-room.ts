import type { Server, Connection, ConnectionContext } from 'partykit/server';
import { GameManager } from '../engine/game';
import { selectAiMove } from '../engine/ai';
import type { GameState, Move, TeamConfig, TeamId, GameResult } from '../engine/types';

// ── Message Protocol ──────────────────────────────────────────────────

type ServerMessage =
	| { type: 'ROOM_STATE'; roomId: string; players: PlayerInfo[]; hostId: string; mode: string }
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
	private gameMode: 'ffa' | 'teams' = 'ffa';
	private botCount = 2;
	private botTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

	constructor(readonly room: import('partykit/server').Room) {}

	// ── Connection Lifecycle ─────────────────────────────────────────

	async onConnect(connection: Connection, ctx: ConnectionContext) {
		// First connection becomes host
		const url = new URL(ctx.request.url);
		const name = url.searchParams.get('name') || `Player-${connection.id.slice(0, 4)}`;

		// Assign seat
		const seatIndex = this.findAvailableSeat();

		const playerInfo: PlayerInfo = {
			id: connection.id,
			name: name,
			connected: true,
			ready: false
		};

		this.players[seatIndex] = playerInfo;
		connection.setState({ seatIndex, playerId: connection.id });

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
			// Compact players array
			this.players = this.players.filter(Boolean);

			this.broadcast({
				type: 'PLAYER_LEFT',
				playerId: connection.id
			});

			this.broadcastRoomState();
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
				this.handlePlayTile(playerId, message.tileId, message.side);
				break;
			case 'PASS':
				this.handlePass(playerId);
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

			// Check if all human players are ready
			const humanPlayers = this.players.filter((p) => p && !p.isBot);
			if (humanPlayers.length > 0 && humanPlayers.every((p) => p.ready)) {
				this.broadcast({ type: 'ALL_READY' });
			}
		}
	}

	private async handleStartGame(sender: Connection) {
		const senderState = sender.state as { seatIndex?: number } | null;
		if (senderState?.seatIndex !== 0) {
			// Only host (seat 0) can start
			this.sendTo(sender, { type: 'ERROR', message: 'Only the host can start the game' });
			return;
		}

		// Fill remaining seats with bots
		this.fillBots();
		this.broadcastRoomState();

		const seed = Math.random().toString(36).substring(2, 10);
		const teamConfig: TeamConfig | undefined =
			this.gameMode === 'teams'
				? { mode: 'teams', layout: SEATS_TEAMS }
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

		// Run bot turns if applicable
		await this.scheduleBotTurns();
	}

	private handlePlayTile(playerId: string, tileId: string, side: 'left' | 'right') {
		if (!this.game || this.game.state.result) return;

		const currentPlayer = this.game.currentPlayer;
		if (currentPlayer.id !== playerId) {
			this.sendToPlayer(playerId, {
				type: 'ERROR',
				message: 'Not your turn'
			});
			return;
		}

		const success = this.game.nextTurn(playerId, tileId, side);
		if (!success) {
			this.sendToPlayer(playerId, {
				type: 'ERROR',
				message: 'Invalid move'
			});
			return;
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			// Schedule bot turns after human move
			this.scheduleBotTurns();
		}
	}

	private handlePass(playerId: string) {
		if (!this.game || this.game.state.result) return;

		const currentPlayer = this.game.currentPlayer;
		if (currentPlayer.id !== playerId) {
			this.sendToPlayer(playerId, {
				type: 'ERROR',
				message: 'Not your turn'
			});
			return;
		}

		const success = this.game.passTurn(playerId);
		if (!success) {
			this.sendToPlayer(playerId, {
				type: 'ERROR',
				message: 'You have moves available — cannot pass'
			});
			return;
		}

		if (this.game.state.result) {
			this.broadcast({ type: 'GAME_OVER', state: this.game.state });
		} else {
			this.broadcast({ type: 'MOVE_ACCEPTED', state: this.game.state });
			this.scheduleBotTurns();
		}
	}

	// ── Bot Management ────────────────────────────────────────────────

	private fillBots() {
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

	private async scheduleBotTurns() {
		if (!this.game || this.game.state.result) return;

		const currentPlayer = this.game.currentPlayer;
		const playerInfo = this.players[this.game.turnIndex];

		if (!playerInfo?.isBot) return;

		// Clear any existing bot timeout
		const existing = this.botTimeouts.get(currentPlayer.id);
		if (existing) clearTimeout(existing);

		// Delay to simulate thinking
		const delay = 800 + Math.random() * 600;
		const timeout = setTimeout(() => {
			this.botTimeouts.delete(currentPlayer.id);
			this.runBotTurn(currentPlayer.id);
		}, delay);
		this.botTimeouts.set(currentPlayer.id, timeout);
	}

	private runBotTurn(playerId: string) {
		if (!this.game || this.game.state.result) return;

		// Make sure it's still this bot's turn
		if (this.game.currentPlayer.id !== playerId) return;

		const state = this.game.state;
		const teamId = state.players.find((p) => p.id === playerId)?.teamId;
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
			// Continue scheduling bot turns
			this.scheduleBotTurns();
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────

	private findAvailableSeat(): number {
		for (let i = 0; i < 4; i++) {
			if (!this.players[i]) return i;
		}
		return this.players.length; // Will be filtered if > 3
	}

	private broadcastRoomState() {
		this.broadcast({
			type: 'ROOM_STATE',
			roomId: this.room.id,
			players: this.players.filter(Boolean),
			hostId: this.players[0]?.id || '',
			mode: this.gameMode
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
