import { PartySocket } from 'partysocket';
import type { GameState } from '../../engine/types';
import type {
	PlayerInfo,
	ServerMessage,
	ClientMessage
} from './types';

// ── Reactive State ────────────────────────────────────────────────────

let partySocket: PartySocket | null = $state(null);
let connectionState = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
let players = $state<PlayerInfo[]>([]);
let roomId = $state('');
let hostId = $state('');
let gameState = $state<GameState | null>(null);
let myPlayerId = $state('');
let myName = $state('');
let isReady = $state(false);
let lastError = $state('');
let chatMessages = $state<{ playerId: string; message: string }[]>([]);

// Derived: am I the host?
let isHost = $derived(hostId === myPlayerId && hostId !== '');

// Derived: how many human players are connected (excluding bots)?
let humanCount = $derived(players.filter((p) => !p.isBot && p.connected).length);

// Derived: are all human players ready?
let allReady = $derived(
	players.filter((p) => !p.isBot && p.connected).length > 0 &&
	players.filter((p) => !p.isBot && p.connected).every((p) => p.ready)
);

// ── Actions ───────────────────────────────────────────────────────────

function connect(host: string, roomIdInput: string, name: string) {
	if (partySocket) disconnect();

	connectionState = 'connecting';
	myName = name;
	roomId = roomIdInput;

	partySocket = new PartySocket({
		host,
		room: roomIdInput,
		query: { name }
	});

	partySocket.onopen = () => {
		connectionState = 'connected';
	};

	partySocket.onclose = () => {
		connectionState = 'disconnected';
	};

	partySocket.onerror = (event: Event) => {
		const errorMsg = 'Connection failed';
		console.error('[PartySocket]', errorMsg, event);
		lastError = errorMsg;
		connectionState = 'disconnected';
	};

	partySocket.onmessage = (event: MessageEvent) => {
		try {
			const msg = JSON.parse(event.data as string) as ServerMessage;
			handleServerMessage(msg);
		} catch (e) {
			console.error('Failed to parse message:', e);
		}
	};
}

function disconnect() {
	if (partySocket) {
		partySocket.close();
		partySocket = null;
	}
	connectionState = 'disconnected';
	players = [];
	gameState = null;
	myPlayerId = '';
	isReady = false;
	chatMessages = [];
	lastError = '';
}

function send(msg: ClientMessage) {
	if (partySocket && partySocket.readyState === WebSocket.OPEN) {
		partySocket.send(JSON.stringify(msg));
	}
}

function toggleReady() {
	isReady = !isReady;
	send(isReady ? { type: 'READY' } : { type: 'UNREADY' });
}

function startGame() {
	send({ type: 'START_GAME' });
}

function playTile(tileId: string, side: 'left' | 'right') {
	send({ type: 'PLAY_TILE', tileId, side });
}

function pass() {
	send({ type: 'PASS' });
}

function sendChat(message: string) {
	send({ type: 'CHAT', message });
	chatMessages = [...chatMessages, { playerId: myPlayerId, message }];
}

function handleServerMessage(msg: ServerMessage) {
	switch (msg.type) {
		case 'ROOM_STATE': {
			players = msg.players;
			hostId = msg.hostId;

			// Find my player ID
			const me = msg.players.find((p) => p.name === myName && p.connected);
			if (me && !myPlayerId) {
				myPlayerId = me.id;
			}
			break;
		}
		case 'PLAYER_JOINED': {
			const existing = players.findIndex((p) => p.id === msg.player.id);
			if (existing >= 0) {
				players = players.map((p) => (p.id === msg.player.id ? msg.player : p));
			} else {
				players = [...players, msg.player];
			}
			if (!myPlayerId) myPlayerId = msg.player.id;
			break;
		}
		case 'PLAYER_LEFT': {
			players = players.filter((p) => p.id !== msg.playerId);
			break;
		}
		case 'PLAYER_READY': {
			players = players.map((p) =>
				p.id === msg.playerId ? { ...p, ready: true } : p
			);
			break;
		}
		case 'ALL_READY': {
			// Could trigger auto-start here
			break;
		}
		case 'GAME_START': {
			gameState = msg.state;
			break;
		}
		case 'MOVE_ACCEPTED': {
			gameState = msg.state;
			break;
		}
		case 'GAME_OVER': {
			gameState = msg.state;
			break;
		}
		case 'ERROR': {
			lastError = msg.message;
			break;
		}
		case 'CHAT': {
			chatMessages = [...chatMessages, { playerId: msg.playerId, message: msg.message }];
			break;
		}
	}
}

// ── Exports (read-only reactive references) ───────────────────────────

export function useMultiplayer() {
	return {
		// State (read only)
		get connectionState() {
			return connectionState;
		},
		get players() {
			return players;
		},
		get roomId() {
			return roomId;
		},
		get hostId() {
			return hostId;
		},
		get isHost() {
			return isHost;
		},
		get myPlayerId() {
			return myPlayerId;
		},
		get myName() {
			return myName;
		},
		get isReady() {
			return isReady;
		},
		get allReady() {
			return allReady;
		},
		get humanCount() {
			return humanCount;
		},
		get gameState() {
			return gameState;
		},
		get lastError() {
			return lastError;
		},
		get chatMessages() {
			return chatMessages;
		},

		// Actions
		connect,
		disconnect,
		toggleReady,
		startGame,
		playTile,
		pass,
		sendChat
	};
}

// Singleton instance
let _instance: ReturnType<typeof useMultiplayer> | null = null;

export function getMultiplayer() {
	if (!_instance) {
		_instance = useMultiplayer();
	}
	return _instance;
}
