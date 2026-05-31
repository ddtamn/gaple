export type TileId = string;
export type PlayerId = string;
export type Side = 'left' | 'right' | 'center';
export type TeamId = 0 | 1;

export interface Domino {
	id: TileId;
	left: number;
	right: number;
}

export interface Player {
	id: PlayerId;
	name: string;
	hand: Domino[];
	teamId?: TeamId;
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
	winnerTeamId?: TeamId;
	reason: GameOverReason;
	scores: Record<PlayerId, number>; // dead code
	points?: number;
	winType?: string; // Palang, Cekik, Normal, Tangkap, Mutlak
}

export type GameEventType = 'MOVE_PLAYED' | 'PLAYER_PASS' | 'GAME_OVER' | 'ROUND_SCORED';

export interface GameEvent {
	type: GameEventType;
	payload: Record<string, unknown>;
	timestamp: number;
}

export type GameMode = 'ffa' | 'teams';

export interface TeamConfig {
	mode: GameMode;
	// In team mode, teams[0] and teams[1] each contain array of player indices
	layout?: [number[], number[]]; // e.g. [[0, 2], [1, 3]] for P0+P2 vs P1+P3
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
	lastPlayedTile?: Domino | null;
	lastPlayerId?: string | null;
	lastMoveWasCekik?: boolean;
	pointStandings: Record<string, number>; // all round point
	teamConfig?: TeamConfig;
}

export interface TilePosition {
	id: TileId;
	left: number;
	right: number;
	isBalak: boolean;
	side: Side;
	x: number;
	y: number;
	rotation: number;
}
