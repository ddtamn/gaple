import type { GameState } from '../../engine/types';

// ── Server → Client Messages ──────────────────────────────────────────

export interface PlayerInfo {
	id: string;
	name: string;
	connected: boolean;
	ready: boolean;
	isBot?: boolean;
}

export interface RoomStateMessage {
	type: 'ROOM_STATE';
	roomId: string;
	players: PlayerInfo[];
	hostId: string;
	mode: 'ffa' | 'coop-vs-ai' | 'coop-vs-coop';
	rounds: number;
}

export interface PlayerJoinedMessage {
	type: 'PLAYER_JOINED';
	player: PlayerInfo;
}

export interface PlayerLeftMessage {
	type: 'PLAYER_LEFT';
	playerId: string;
}

export interface PlayerReadyMessage {
	type: 'PLAYER_READY';
	playerId: string;
}

export interface AllReadyMessage {
	type: 'ALL_READY';
}

export interface GameStartMessage {
	type: 'GAME_START';
	seed: string;
	state: GameState;
	currentRound: number;
}

export interface MoveAcceptedMessage {
	type: 'MOVE_ACCEPTED';
	state: GameState;
}

export interface GameOverMessage {
	type: 'GAME_OVER';
	state: GameState;
}

export interface ErrorMessage {
	type: 'ERROR';
	message: string;
}

export interface ChatMessage {
	type: 'CHAT';
	playerId: string;
	message: string;
}

export type ServerMessage =
	| RoomStateMessage
	| PlayerJoinedMessage
	| PlayerLeftMessage
	| PlayerReadyMessage
	| AllReadyMessage
	| GameStartMessage
	| MoveAcceptedMessage
	| GameOverMessage
	| ErrorMessage
	| ChatMessage;

// ── Client → Server Messages ──────────────────────────────────────────

export interface JoinMessage {
	type: 'JOIN';
	name: string;
}

export interface ReadyMessage {
	type: 'READY';
}

export interface UnreadyMessage {
	type: 'UNREADY';
}

export interface StartGameMessage {
	type: 'START_GAME';
}

export interface PlayTileMessage {
	type: 'PLAY_TILE';
	tileId: string;
	side: 'left' | 'right';
}

export interface PassMessage {
	type: 'PASS';
}

export interface ClientChatMessage {
	type: 'CHAT';
	message: string;
}

export interface NextRoundMessage {
	type: 'NEXT_ROUND';
}

export type ClientMessage =
	| JoinMessage
	| ReadyMessage
	| UnreadyMessage
	| StartGameMessage
	| PlayTileMessage
	| PassMessage
	| NextRoundMessage
	| ClientChatMessage;
