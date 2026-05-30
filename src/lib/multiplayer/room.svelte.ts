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
let myPlayerIndex = $state(-1);
let myName = $state('');
let isReady = $state(false);
let lastError = $state('');
let chatMessages = $state<{ playerId: string; message: string }[]>([]);
let roomMode = $state<'ffa' | 'coop-vs-ai' | 'coop-vs-coop'>('ffa');
let roomRounds = $state(3);
let multiplayerCurrentRound = $state(1);

// Derived: is this a coop mode?
let isCoopMode = $derived(roomMode === 'coop-vs-ai' || roomMode === 'coop-vs-coop');

// Derived: am I the host?
let isHost = $derived(hostId === myPlayerId && hostId !== '');

// Derived: how many human players are connected (excluding bots)?
let humanCount = $derived(players.filter((p) => !p.isBot && p.connected).length);

// Derived: are all human players ready?
let allReady = $derived(
	players.filter((p) => !p.isBot && p.connected).length > 0 &&
	players.filter((p) => !p.isBot && p.connected).every((p) => p.ready)
);

// Derived: teammate player index (in coop mode)
let teammateIndex = $derived.by(() => {
	if (!isCoopMode || myPlayerIndex < 0) return -1;
	if (myPlayerIndex === 0) return 2;
	if (myPlayerIndex === 2) return 0;
	return -1;
});

// Derived: teammate player name (for display)
let teammateName = $derived.by(() => {
	if (teammateIndex < 0) return '';
	return players[teammateIndex]?.name || '';
});

// ── Actions ───────────────────────────────────────────────────────────

function connect(host: string, roomIdInput: string, name: string, mode?: string, rounds?: number | string) {
	if (partySocket) disconnect();

	connectionState = 'connecting';
	myName = name;
	roomId = roomIdInput;

	// Build query with optional mode/rounds for room creator
	const query: Record<string, string> = { name };
	if (mode) query.mode = mode;
	if (rounds !== undefined) query.rounds = String(rounds);

	partySocket = new PartySocket({
		host,
		room: roomIdInput,
		query
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
	myPlayerIndex = -1;
	isReady = false;
	chatMessages = [];
	lastError = '';
	roomMode = 'ffa';
	roomRounds = 3;
	multiplayerCurrentRound = 1;
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

function nextRound() {
	send({ type: 'NEXT_ROUND' });
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
			roomMode = msg.mode;
			roomRounds = msg.rounds;

			// Find my player ID (only before game starts)
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
			// Store currentRound from server
			if ('currentRound' in msg) multiplayerCurrentRound = (msg as any).currentRound;
			// Find my player index by matching name
			const myIdx = msg.state.players.findIndex((p: any) => p.name === myName);
			if (myIdx >= 0) myPlayerIndex = myIdx;
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
		get myPlayerIndex() {
			return myPlayerIndex;
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
		get roomMode() {
			return roomMode;
		},
		get roomRounds() {
			return roomRounds;
		},
		get currentRound() {
			return multiplayerCurrentRound;
		},
		get isCoopMode() {
			return isCoopMode;
		},
		get teammateIndex() {
			return teammateIndex;
		},
		get teammateName() {
			return teammateName;
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
		nextRound,
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
