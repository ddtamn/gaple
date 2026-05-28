export type TileId = string;
export type PlayerId = string;
export type Side = 'left' | 'right';

export interface Domino {
	id: TileId;
	left: number;
	right: number;
}

export interface Player {
	id: PlayerId;
	name: string;
	hand: Domino[];
}

export interface Board {
	playedTiles: Domino[];
	leftEnd: number | null;
	rightEnd: number | null;
	initialTileIndex: number; // Track position of first tile (shifts when left tiles added)
	requiresStarterTile: boolean;
}

export interface Move {
	playerId: PlayerId;
	tileId: TileId;
	side: Side;
}

export type GameOverReason = 'empty-hand' | 'blocked';

export interface GameResult {
	winnerId: PlayerId;
	reason: GameOverReason;
	scores: Record<PlayerId, number>;
}

export type GameEventType = 'MOVE_PLAYED' | 'PLAYER_PASS' | 'GAME_OVER';

export interface GameEvent {
	type: GameEventType;
	payload: Record<string, unknown>;
	timestamp: number;
}

export interface GameState {
	players: Player[];
	board: Board;
	turnIndex: number;
	history: Move[];
	events: GameEvent[];
	drawPile: Domino[];
	seed: string;
	result: GameResult | null;
}
