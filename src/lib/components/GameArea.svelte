<script lang="ts">
	import { SvelteGameManager } from '$lib/game.svelte';
	import { getMultiplayer } from '$lib/multiplayer/room.svelte';
	import { calculateBoardLayout, calculateBoardPreviewPosition } from '../../engine/boardLayout';
	import { orientTileForSide } from '../../engine/board';
	import { generateLegalMoves } from '../../engine/moves';
	import type { Domino, TeamConfig, TilePosition } from '../../engine/types';

	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { createWebHaptics } from 'web-haptics/svelte';

	import DominoTile from './DominoTile.svelte';
	import PlacementGhost from './PlacementGhost.svelte';
	import BotAvatar from './BotAvatar.svelte';
	import PassHintBadge from './PassHintBadge.svelte';
	import PlayerHand from './PlayerHand.svelte';
	import MainPlayerHand from './MainPlayerHand.svelte';
	import AnimationLayer from './animation/AnimationLayer.svelte';
	import { GameAnimationController } from '$lib/animation/gameAnimationController.svelte';
	import PixiBoard from './pixi/PixiBoard.svelte';


	// PROPS DARI LOBI
	let {
		mode = 'vs-ai',
		rounds = 3,
		onExit
	}: { rounds: number | string; mode: string; onExit: () => void } = $props();

	// ── Determine if multiplayer (coop modes use PartyKit) ─────────────
	const isMultiplayer = $derived(mode === 'coop-vs-ai' || mode === 'coop-vs-coop');
	const mp = $derived(isMultiplayer ? getMultiplayer() : null);

	// Coop-specific helpers
	const isCoopMode = $derived(mode === 'coop-vs-ai' || mode === 'coop-vs-coop');

	// In multiplayer, find our player index in the game state (for POV rotation)
	const myPlayerIndex = $derived(isMultiplayer ? (mp?.myPlayerIndex ?? -1) : 0);

	// Helper: map position offset (0=bottom, 1=right, 2=top, 3=left) to actual player index
	// In single-player, human is always index 0. In multiplayer, rotate based on myPlayerIndex.
	function p(offset: number) {
		const players = currentGameState?.players;
		if (!players || players.length === 0) return null;
		if (isMultiplayer && myPlayerIndex >= 0) {
			return players[(myPlayerIndex + offset) % players.length];
		}
		return players[offset];
	}

	// Card visibility:
	// - Main player's own hand is always visible
	// - ALL other players' cards are hidden by default (click to reveal), including teammate cards
	// - When round ends (result is set), ALL cards are revealed
	function getShowCardFaces(gamePlayerIndex: number): boolean {
		// Self — always visible
		if (gamePlayerIndex === myPlayerIndex) return true;
		// Round over — reveal all cards
		if (currentGameState?.result) return true;
		// Everyone else — hidden behind card backs, click to reveal
		return false;
	}

	const TILE_W = 112;
	const TILE_H = 56;
	const GAP = 0;

	// ── Game State Resolution ─────────────────────────────────────────
	// In multiplayer mode, game state comes from the server via the multiplayer store.
	// In local mode, we use SvelteGameManager.
	let game = $state<SvelteGameManager | null>(null);

	// Reactive game state (from whichever source)
	const currentGameState = $derived(mp?.gameState ?? game?.state ?? null);

	$effect(() => {
		if (!isMultiplayer && !game) {
			initLocalGame();
		}
	});

	// Placeholder for non-interactive bot hand events
	function handleSampleDisabled() {}

	function initLocalGame() {
		const teamConfig = resolveTeamConfig(mode);
		const g = new SvelteGameManager(
			['Pemain Bawah', 'AI Kanan', 'AI Tengah', 'AI Kiri'],
			undefined,
			teamConfig
		);
		g.startGame();
		g.setBotPlayers(['1', '2', '3']);
		game = g;
		starterPlayerId = g.state.players[g.state.turnIndex]?.id ?? null;
	}

	function resolveTeamConfig(gameMode: string): TeamConfig | undefined {
		if (gameMode === 'vs-ai') return undefined;
		// For coop modes, team config comes from the server via the game state
		return undefined;
	}

	let starterPlayerId = $state<string | null>(null);

	// STATE UNTUK RONDE (from server for multiplayer, local for vs-ai)
	let currentRound = $state(1);
	// In multiplayer, round counter and total rounds come from server
	const mpCurrentRound = $derived(isMultiplayer ? (mp?.currentRound ?? 1) : currentRound);
	const effectiveRounds = $derived(isMultiplayer ? (mp?.roomRounds ?? rounds) : rounds);

	function syncStarterMarker() {
		if (!game || !game.state) return;
		starterPlayerId = game.state.players[game.state.turnIndex]?.id ?? null;
	}

	// FUNGSI LANJUT RONDE
	function nextRound() {
		if (isMultiplayer && mp) {
			mp.nextRound();
			currentRound++;
			return;
		}
		if (!game) return;
		const previousWinnerId = game.state.result?.winnerId;
		currentRound++;
		game.startGame(previousWinnerId);
		syncStarterMarker();
		game.setBotPlayers(['1', '2', '3']);
	}

	// ── Haptic Feedback ──────────────────────────────────────────────────────
	const { trigger: hapticTrigger, destroy: hapticDestroy } = createWebHaptics();

	onDestroy(() => {
		hapticDestroy();
	});

	// ── Auto-advance countdown (between rounds) ────────────────────────
	let countdown = $state(0);

	$effect(() => {
		const hasResult = !!currentGameState?.result;

		// No countdown for match-over (user clicks a button instead)
		if (!hasResult || isMatchOver) {
			countdown = 0;
			return;
		}

		// Round just finished — start auto-advance countdown for next round
		countdown = 10;

		const interval = setInterval(() => {
			countdown--;
			if (countdown <= 0) {
				clearInterval(interval);
				nextRound();
			}
		}, 1000);

		return () => clearInterval(interval);
	});

	// ── Per-player turn countdown timer ───────────────────────────────
	// Managed OUTSIDE $effect lifecycle to avoid interval being killed by effect cleanup
	// on every state update. Interval is stored directly, not returned from $effect.
	const TURN_TIMEOUT_SECONDS = 30;
	let turnTimerRemaining = $state(0);
	let previousTurnIndex = $state(-1);
	let tickInterval: ReturnType<typeof setInterval> | null = null;

	function startTickTimer(timeoutCallback: () => void) {
		stopTickTimer();
		tickInterval = setInterval(() => {
			turnTimerRemaining--;
			if (turnTimerRemaining <= 0) {
				stopTickTimer();
				timeoutCallback();
			}
		}, 1000);
	}

	function stopTickTimer() {
		if (tickInterval !== null) {
			clearInterval(tickInterval);
			tickInterval = null;
		}
	}

	// Only reads currentGameState to detect turn changes — does NOT return cleanup.
	// The interval is managed by startTickTimer/stopTickTimer which are called manually.
	$effect(() => {
		const result = currentGameState?.result;
		const turnIdx = currentGameState?.turnIndex;

		// Game over or no turn — reset
		if (result || turnIdx === undefined || turnIdx < 0) {
			stopTickTimer();
			turnTimerRemaining = 0;
			previousTurnIndex = -1;
			return;
		}

		// If turnIndex hasn't changed, keep existing timer running
		if (turnIdx === previousTurnIndex && turnTimerRemaining > 0) {
			return;
		}

		// Turn changed — restart countdown from full
		previousTurnIndex = turnIdx;
		turnTimerRemaining = TURN_TIMEOUT_SECONDS;
		startTickTimer(() => {
			// Auto-play only for local human player when time runs out
			if (!isMultiplayer && turnIdx === myPlayerIndex) {
				autoPlayTurn();
			}
		});
	});

	// Cleanup on destroy
	onDestroy(() => {
		stopTickTimer();
	});

	/** Get countdown value for a specific player index (0 = not this player's turn). */
	function getCountdownForPlayer(gamePlayerIndex: number): number {
		if (currentGameState?.result) return 0;
		if (currentGameState?.turnIndex !== gamePlayerIndex) return 0;
		return turnTimerRemaining;
	}

	// ── Thinking indicator for multiplayer ──────────────────────────────
	// Shows briefly after a human player makes a move while waiting for server confirmation
	let waitingForServer = $state(false);

	$effect(() => {
		// When game state updates after a move, clear the waiting indicator
		if (waitingForServer) {
			// Track game state so effect re-runs on server response
			currentGameState;
			// Small delay so the indicator isn't removed instantly
			const timer = setTimeout(() => {
				waitingForServer = false;
			}, 200);
			return () => clearTimeout(timer);
		}
	});

	function autoPlayTurn() {
		if (!currentGameState || currentGameState.result) return;
		const playerId = currentGameState.players[myPlayerIndex]?.id;
		if (!playerId) return;

		const moves = generateLegalMoves(currentGameState, playerId);
		if (moves.length > 0) {
			const randomMove = moves[Math.floor(Math.random() * moves.length)];
			const side = randomMove.side as 'left' | 'right'; // Legal moves are never 'center'
			if (isMultiplayer && mp) {
				mp.playTile(randomMove.tileId, side);
			} else if (game) {
				game.nextTurn(playerId, randomMove.tileId, side);
			}
		} else {
			// No valid moves — auto-pass
			if (isMultiplayer && mp) {
				mp.pass();
			} else if (game) {
				game.passTurn(playerId);
			}
		}
	}

	// ── Pass animation tracking ────────────────────────────────────────
	let lastPassEvent = $state<{ playerId: string; timestamp: number } | null>(null);
	let prevEventCount = $state(0);

	$effect(() => {
		const events = currentGameState?.events;
		if (!events) {
			prevEventCount = 0;
			return;
		}

		// Reset when a new round starts (events array cleared)
		if (events.length < prevEventCount) {
			prevEventCount = 0;
		}

		if (events.length > prevEventCount) {
			for (let i = prevEventCount; i < events.length; i++) {
				if (events[i].type === 'PLAYER_PASS') {
					const pid = events[i].payload.playerId as string;
					if (pid) {
						lastPassEvent = { playerId: pid, timestamp: Date.now() };
					}
				}
			}
			prevEventCount = events.length;
		}
	});

	// Auto-clear pass animation after 1.5s
	$effect(() => {
		if (!lastPassEvent) return;
		const timer = setTimeout(() => {
			lastPassEvent = null;
		}, 1500);
		return () => clearTimeout(timer);
	});

	function getPassTimestamp(playerIndex: number): number {
		const player = currentGameState?.players[playerIndex];
		if (!player || !lastPassEvent || lastPassEvent.playerId !== player.id) return 0;
		const elapsed = Date.now() - lastPassEvent.timestamp;
		if (elapsed > 1500) return 0;
		return lastPassEvent.timestamp;
	}

	function getPassHintValues(playerIndex: number): number[] {
		const player = currentGameState?.players[playerIndex];
		if (!player) return [];
		return currentGameState?.passHints?.[player.id]?.values ?? [];
	}


	// ── Animation Controller ────────────────────────────────────────────
	let animController = $state(new GameAnimationController());
	/** Track previous turn index for turn highlight animation (separate from timer) */
	let prevTurnForHighlight = $state(-1);
	/** Track whether deal animation has been triggered for the current round */
	let dealTriggered = $state(false);
	/** Pending move source positions (resolved from DOM before game state updates) */
	let pendingMoveSources = new Map<string, { x: number; y: number }>();

	// ── DOM position resolvers ──
	// These are the ONLY places the animation system touches the DOM.
	// Swap these implementations for PixiJS canvas coordinates.

	const resolveBoardCenter = () => {
		// Board center: viewport center (board is centered by CSS)
		const boardEl = document.querySelector('[data-board-area]');
		if (boardEl) {
			const rect = boardEl.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
	};

	const resolveHandCenter = (playerId: string): { x: number; y: number } => {
		const el = document.querySelector(`[data-player-id="${playerId}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return resolveBoardCenter();
	};

	const resolveAvatarCenter = (playerId: string): { x: number; y: number } => {
		const el = document.querySelector(`[data-avatar-id="${playerId}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return resolveHandCenter(playerId);
	};

	const resolveScoreTarget = (playerId: string): { x: number; y: number } => {
		const el = document.querySelector(`[data-score-id="${playerId}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return resolveBoardCenter();
	};

	const resolveTilePlaySource = (tileId: string, playerId: string): { x: number; y: number } | null => {
		const pending = pendingMoveSources.get(tileId);
		if (pending) return pending;
		return resolveHandCenter(playerId);
	};

	const resolveTilePlayTarget = (tileId: string): { x: number; y: number } | null => {
		const el = document.querySelector(`[data-board-tile-id="${tileId}"]`);
		if (el) {
			const rect = el.getBoundingClientRect();
			return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
		}
		return null;
	};

	/** Position resolver callback passed to controller for each event. */
	function resolveEventPositions(event: { type: string; payload: Record<string, unknown> }) {
		if (event.type === 'MOVE_PLAYED') {
			const tileId = event.payload.tileId as string;
			const playerId = event.payload.playerId as string;
			const from = resolveTilePlaySource(tileId, playerId) ?? resolveBoardCenter();
			const to = resolveTilePlayTarget(tileId) ?? resolveBoardCenter();
			return { from, to };
		}
		if (event.type === 'POINTS_AWARDED') {
			const pid = event.payload.playerId as string;
			const from = resolveHandCenter(pid);
			from.y -= 40;
			const to = resolveScoreTarget(pid);
			return { from, to };
		}
		return null;
	}

	// Init display scores on mount and when re-initializing
	$effect(() => {
		if (currentGameState) {
			animController.initScores(currentGameState.pointStandings);
		}
	});

	// Process events for animation (with DOM position resolution)
	$effect(() => {
		const events = currentGameState?.events;
		const players = currentGameState?.players;
		if (!events || !players) return;
		animController.processEvents(events, players, resolveEventPositions);
	});

	// Deal animation: trigger when a new round starts (events reset or first state)
	let dealTriggeredPrevEventCount = $state(0);
	$effect(() => {
		const state = currentGameState;
		if (!state) return;
		const eventCount = state.events.length;
		const boardCenter = resolveBoardCenter();
		// Detect new round: events cleared (shrank) or first state with no events
		if ((eventCount === 0 && dealTriggeredPrevEventCount > 0) ||
		    (eventCount === 0 && !dealTriggered)) {
			dealTriggered = true;
			dealTriggeredPrevEventCount = 0;
			for (const player of state.players) {
				const tiles = player.hand.map((t: { left: number; right: number; id: string }) => ({
					left: t.left,
					right: t.right,
					id: t.id
				}));
				const handPos = resolveHandCenter(player.id);
				animController.enqueueDealAnimation(player.id, tiles, boardCenter, handPos);
			}
		} else if (eventCount > 0) {
			dealTriggeredPrevEventCount = eventCount;
		}
	});

	// Pass animation: detect PLAYER_PASS events
	$effect(() => {
		const events = currentGameState?.events;
		if (!events) return;
		const lastEvent = events[events.length - 1];
		if (lastEvent && lastEvent.type === 'PLAYER_PASS') {
			const pid = lastEvent.payload.playerId as string;
			if (pid) {
				const avatarPos = resolveAvatarCenter(pid);
				animController.enqueuePassAnimation(pid, avatarPos);
			}
		}
	});

	// Turn highlight: detect turnIndex changes
	$effect(() => {
		const state = currentGameState;
		if (!state || state.result) return;
		const currentIdx = state.turnIndex;
		const prevIdx = prevTurnForHighlight;
		if (currentIdx !== prevIdx && prevIdx >= 0 && currentIdx >= 0) {
			const player = state.players[currentIdx];
			const prevPlayer = prevIdx >= 0 ? state.players[prevIdx] : null;
			if (player) {
				const avatarPos = resolveAvatarCenter(player.id);
				animController.enqueueTurnHighlight(
					player.id,
					prevPlayer?.id ?? null,
					avatarPos
				);
			}
		}
		prevTurnForHighlight = currentIdx;
	});

	// Detect round result and enqueue stamp/score animation
	$effect(() => {
		const result = currentGameState?.result;
		if (!result || !currentGameState) return;
		const winner = currentGameState.players.find((p) => p.id === result.winnerId);
		if (!winner) return;
		const boardCenter = resolveBoardCenter();
		const scoreTarget = resolveScoreTarget(result.winnerId);
		animController.enqueueRoundResult(
			result.winnerId,
			winner.name,
			result.points ?? 1,
			result.winType ?? 'Normal',
			currentGameState.pointStandings,
			boardCenter,
			scoreTarget
		);
	});

	// Capture move source position for flying tile animation (DOM-specific)
	function captureMoveSource(tileId: string, el?: HTMLElement | null) {
		if (el && document.contains(el)) {
			const rect = el.getBoundingClientRect();
			pendingMoveSources.set(tileId, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
		} else {
			const handCenter = resolveHandCenter('main');
			pendingMoveSources.set(tileId, handCenter);
		}
	}

	function handleReplay() {
		if (isMultiplayer) {
			onExit();
		} else {
			// Reset local game: clear game so $effect re-initializes it
			game = null;
			currentRound = 1;
		}
		animController.reset();
	}

// ── Team Scores (Coop Mode) ──────────────────────────────────────
	const teamScores = $derived.by(() => {
		if (!currentGameState || !isCoopMode) return null;
		const scores: Record<string, number> = {};
		for (const player of currentGameState.players) {
			const key = player.teamId !== undefined ? `team-${player.teamId}` : 'team-0';
			scores[key] = (scores[key] || 0) + (currentGameState.pointStandings[player.id] || 0);
		}
		return scores;
	});
	const teamScoreEntries = $derived.by(() => teamScores ? Object.entries(teamScores) : []);

	// ── Interaction state ──────────────────────────────────────────────────────
	let draggedTile = $state<Domino | null>(null);
	let selectedTile = $state<Domino | null>(null);
	let mouseX = $state(0);
	let mouseY = $state(0);
	let dropZoneHovered = $state<'left' | 'right' | 'center' | null>(null);
	// Separate tracker for haptic — not overwritten by pointerenter (which fires before touchmove)
	let _lastHoveredGhost: 'left' | 'right' | null = null;

	const activeTile = $derived(draggedTile ?? selectedTile);
	const isDragging = $derived(draggedTile !== null);
	// Show drop zones when it's the player's turn
	const isMyTurn = $derived(
		isMultiplayer
			? currentGameState?.turnIndex === myPlayerIndex
			: currentGameState?.turnIndex === 0
	);
	const showDropZones = $derived(activeTile !== null && !!isMyTurn && !currentGameState?.result);

	const leftPreview = $derived.by(() => getPlacementPreview('left'));
	const rightPreview = $derived.by(() => getPlacementPreview('right'));

	const winner = $derived.by(() => {
		if (!currentGameState?.result) return null;
		return currentGameState.players.find((p) => p.id === currentGameState.result?.winnerId) ?? null;
	});

	const markerPlayerId = $derived.by(() => {
		if (currentGameState?.result && winner) return winner.id;
		return starterPlayerId;
	});

	// Mengecek apakah pertandingan (seluruh ronde) sudah selesai
	const isMatchOver = $derived(
		currentGameState?.result && effectiveRounds !== 'custom' && mpCurrentRound >= (effectiveRounds as number)
	);

	// Mengurutkan klasemen skor untuk akhir pertandingan
	const finalStandings = $derived.by(() => {
		if (!currentGameState?.result) return [];
		const standings = currentGameState.players.map((p) => ({
			name: p.name,
			points: currentGameState.pointStandings[p.id] || 0
		}));
		return standings.sort((a, b) => b.points - a.points);
	});

	function getEventPos(e: MouseEvent | TouchEvent) {
		if ('touches' in e && e.touches.length > 0) {
			return { x: e.touches[0].clientX, y: e.touches[0].clientY };
		}
		if ('changedTouches' in e && e.changedTouches.length > 0) {
			return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
		}
		return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
	}

	function getGhostSideFromPoint(x: number, y: number): 'left' | 'right' | null {
		const el = document.elementFromPoint(x, y);
		const ghostBtn = el?.closest('[data-ghost-side]');
		if (ghostBtn) {
			return ghostBtn.getAttribute('data-ghost-side') as 'left' | 'right';
		}
		return null;
	}

	function onWindowMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;

		// Sync haptic in user-gesture context (mouse drag over ghost)
		if (draggedTile) {
			const side = getGhostSideFromPoint(e.clientX, e.clientY);
			if (side && side !== _lastHoveredGhost) {
				hapticTrigger('selection');
				_lastHoveredGhost = side;
			} else if (!side) {
				_lastHoveredGhost = null;
			}
		}
	}

	function onWindowMouseUp() {
		draggedTile = null;
		dropZoneHovered = null;
		_lastHoveredGhost = null;
	}

	function onWindowTouchMove(e: TouchEvent) {
		const pos = getEventPos(e);
		mouseX = pos.x;
		mouseY = pos.y;

		// Sync haptic in user-gesture context (touch drag over ghost — this is the one that matters)
		if (draggedTile) {
			const side = getGhostSideFromPoint(pos.x, pos.y);
			// Use _lastHoveredGhost (not dropZoneHovered) because pointerenter fires before touchmove
			// and already sets dropZoneHovered — making the comparison always false.
			if (side && side !== _lastHoveredGhost) {
				hapticTrigger('selection');
				_lastHoveredGhost = side;
			} else if (!side) {
				_lastHoveredGhost = null;
			}
		}
	}

	function onWindowTouchEnd(e: TouchEvent) {
		if (!draggedTile) return;
		_lastHoveredGhost = null;
		const pos = getEventPos(e);
		// Check if the touch ended on a placement ghost
		const side = getGhostSideFromPoint(pos.x, pos.y);
		if (side) {
			placeTile(side);
		} else {
			draggedTile = null;
			dropZoneHovered = null;
		}
	}

	function placeTile(side: 'left' | 'right') {
		if (!activeTile || currentGameState?.result) return;
		hapticTrigger('medium');
		if (isMultiplayer && mp) {
			waitingForServer = true;
			mp.playTile(activeTile.id, side);
		} else if (game && currentGameState) {
			game.nextTurn(currentGameState.players[0].id, activeTile.id, side);
		}
		_lastHoveredGhost = null;
		draggedTile = null;
		selectedTile = null;
		dropZoneHovered = null;
	}

	function getPlacementPreview(side: 'left' | 'right') {
		if (!activeTile || !currentGameState || currentGameState.result) return null;
		if (currentGameState.turnIndex !== myPlayerIndex) return null;

		if (currentGameState.board.playedTiles.length === 0) {
			if (side === 'left') return null;
			return { ...activeTile, x: 0, y: 0, rotation: 90, side };
		}

		const orientedTile = orientTileForSide(currentGameState.board, activeTile, side);
		if (!orientedTile) return null;

		return {
			...orientedTile,
			...calculateBoardPreviewPosition(
				currentGameState.board.playedTiles,
				currentGameState.board.initialTileIndex,
				side,
				activeTile,
				TILE_W,
				TILE_H,
				GAP
			)
		};
	}

	let boardLayout = $derived.by(() => {
		if (!currentGameState) return [];
		const tiles = currentGameState.board.playedTiles;
		if (!tiles || tiles.length === 0) return [];
		return calculateBoardLayout(tiles, currentGameState.board.initialTileIndex, TILE_W, TILE_H, GAP);
	});

	let boardWidth = $state(950);
	let boardHeight = $state(650);
	let mainHandHeight = $state(0);

	let camera = $derived.by(() => {
		const items = [...boardLayout];
		if (showDropZones && leftPreview) items.push(leftPreview as TilePosition);
		if (showDropZones && rightPreview) items.push(rightPreview as TilePosition);

		if (items.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;

		for (const item of items) {
			const isVertical = item.rotation % 180 !== 0;
			const w = isVertical ? TILE_H : TILE_W;
			const h = isVertical ? TILE_W : TILE_H;
			minX = Math.min(minX, item.x - w / 2);
			maxX = Math.max(maxX, item.x + w / 2);
			minY = Math.min(minY, item.y - h / 2);
			maxY = Math.max(maxY, item.y + h / 2);
		}

		const isMobile = boardWidth < 768;
		const PADDING_W = isMobile ? 40 : 100;
		const PADDING_H = isMobile ? mainHandHeight + 100 : mainHandHeight + 160;

		const maxW = Math.max(boardWidth - PADDING_W, 200);
		const maxH = Math.max(boardHeight - PADDING_H, 200);

		const boundingWidth = maxX - minX;
		const boundingHeight = maxY - minY;
		const centerX = (minX + maxX) / 2;
		const centerY = (minY + maxY) / 2;

		const scale = Math.min(1, maxW / (boundingWidth || 1), maxH / (boundingHeight || 1));
		return { scale, offsetX: -centerX, offsetY: -centerY };
	});

	function handleTileDragStart(tile: Domino, e: MouseEvent | TouchEvent) {
		e.preventDefault();
		draggedTile = tile;
		selectedTile = null;
		_lastHoveredGhost = null;
		const pos = getEventPos(e);
		mouseX = pos.x;
		mouseY = pos.y;
	}

	function handleTileClick(tile: Domino, e: MouseEvent) {
		e.stopPropagation();
		if (currentGameState?.result) return;
		if (selectedTile?.id === tile.id) selectedTile = null;
		else {
			selectedTile = tile;
			draggedTile = null;
		}
	}
</script>

<svelte:window
	onmousemove={onWindowMouseMove}
	onmouseup={onWindowMouseUp}
	ontouchmove={onWindowTouchMove}
	ontouchend={onWindowTouchEnd}
/>	<!-- Dragged tile follow-mouse overlay -->
	{#if isDragging && draggedTile}
		<div
			transition:fade={{ duration: 200 }}
			class="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 scale-110 rotate-3 opacity-80"
			style="left:{mouseX}px; top:{mouseY}px;"
		>
			<DominoTile tile={draggedTile} isVertical={false} />
		</div>
	{/if}

	<!-- Animation overlay layer (fixed, pointer-events-none) -->
	<AnimationLayer controller={animController} />

	<!-- PixiJS board renderer (canvas overlay, pointer-events-none) -->
	<PixiBoard
		controller={animController}
		boardLayout={boardLayout}
		camera={camera}
		width={boardWidth}
		height={boardHeight}
	/>

	<!-- score anchors for animation targets -->
	{#each currentGameState?.players ?? [] as p}
		<div
			data-score-id={p.id}
			class="pointer-events-none fixed z-0 opacity-0"
			style="left:0; top:0; width:1px; height:1px;"
		></div>
	{/each}

<!-- ══════════════════ MAIN FLEXBOX LAYOUT ══════════════════ -->
<div
	role="presentation"
	class="flex h-dvh w-full flex-col bg-[radial-gradient(ellipse_at_50%_40%,rgba(212,163,115,0.12)_0%,transparent_70%)] text-stone-100 select-none"
	onclick={() => (selectedTile = null)}
>
	<!-- ── LAYER 1: Game Info Bar ─────────────────────────────── -->
	<div class="flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 md:px-6 md:py-3">
		{#if waitingForServer}
			<div class="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1">
				<span class="inline-block size-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"></span>
				<span class="font-body text-xs font-semibold text-amber-400">Menunggu server...</span>
			</div>
		{/if}
		<div class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3">
			<span class="font-body text-xs font-semibold text-stone-100 uppercase">{mode?.replace(/-/g, ' ')}</span>
			<span class="text-stone-500">|</span>
			<span class="font-body text-xs text-stone-500">Ronde</span>
			<span class="font-body text-xs font-bold text-primary"
				>{mpCurrentRound} / {effectiveRounds === 'custom' ? '∞' : effectiveRounds}</span
			>
		</div>

		<!-- Coop team scores -->
		{#if isCoopMode && teamScores}
			<div class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3">
				<span class="font-body text-xs text-stone-500">Score:</span>
				{#each teamScoreEntries as [teamKey, score], i}
					<span class="font-body text-xs font-bold {i === 0 ? 'text-emerald-400' : 'text-red-400'}">
						{score}
					</span>
					{#if i < teamScoreEntries.length - 1}
						<span class="text-stone-600">|</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── LAYER 2: Round Result / Match Over (inline, no modal) ── -->
	{#if currentGameState?.result}
		<div class="shrink-0 px-4 py-3">
			{#if isMatchOver}
				<!-- Match completed -->
				<div class="mx-auto max-w-lg text-center">
					<p class="font-body text-xs font-bold tracking-[0.25em] text-primary uppercase">
						Match Completed
					</p>
					<h2 class="mt-1 font-headline text-2xl font-bold text-stone-100 md:text-3xl">
						🏆 {finalStandings[0].name} Juara!
					</h2>
					<div class="mt-3 flex flex-col gap-1.5">
						{#each finalStandings as rank, index (index)}
							<div
								class="flex items-center justify-between rounded-lg border border-stone-700 bg-warm-hover px-4 py-2"
							>
								<div class="flex items-center gap-3">
									<span class="w-4 font-headline text-lg font-bold text-stone-400">{index + 1}</span>
									<span
										class="font-body font-semibold text-stone-100 {rank.name === 'Pemain Bawah'
											? 'text-primary'
											: ''}"
									>
										{rank.name}
									</span>
								</div>
								<span class="font-headline text-lg font-bold text-primary"
									>{rank.points} <span class="font-body text-xs font-normal text-primary/60">pts</span></span
								>
							</div>
						{/each}
					</div>
				</div>
			{:else if winner}
				<!-- Single round result -->
				<div class="text-center">
					<h2
						class="font-headline text-2xl font-bold tracking-wide md:text-3xl
						{winner.id === (p(0)?.id ?? '') ? 'text-primary' : 'text-stone-200'}"
					>
						{#if winner.id === (p(0)?.id ?? '')}
							🎉 Anda Menang Ronde Ini!
						{:else}
							{winner.name} Menang!
						{/if}
					</h2>
					{#if currentGameState.result}
						<p class="mt-1 font-body text-base font-semibold text-stone-300 md:text-lg">
							{currentGameState.result.winType}
							<span class="text-primary">(+{currentGameState.result.points} Poin)</span>
						</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- ── LAYER 3: 3 Opponent Players ────────────────────────── -->
	<div class="shrink-0">
		{#if currentGameState}
			{@const leftPlayer = p(3)}
			{@const leftTurnIndex = (myPlayerIndex + 3) % 4}
			{@const leftPassTs = getPassTimestamp(leftTurnIndex)}
			{@const leftPassHintValues = getPassHintValues(leftTurnIndex)}
			{@const leftCountdown = getCountdownForPlayer(leftTurnIndex)}
			{@const topPlayer = p(2)}
			{@const topTurnIndex = (myPlayerIndex + 2) % 4}
			{@const topPassTs = getPassTimestamp(topTurnIndex)}
			{@const topPassHintValues = getPassHintValues(topTurnIndex)}
			{@const topCountdown = getCountdownForPlayer(topTurnIndex)}
			{@const rightPlayer = p(1)}
			{@const rightTurnIndex = (myPlayerIndex + 1) % 4}
			{@const rightPassTs = getPassTimestamp(rightTurnIndex)}
			{@const rightPassHintValues = getPassHintValues(rightTurnIndex)}
			{@const rightCountdown = getCountdownForPlayer(rightTurnIndex)}
			<!-- Spread opponents across the row: left / top / right with generous gaps -->
			<div class="flex w-full">
			<!-- Left Opponent (index 3) - shifted down -->
			{#if leftPlayer}
				<div class="flex w-[calc(100%/3)] translate-y-6 flex-col items-center gap-1 md:translate-y-8">
					<div class="flex items-center gap-1.5">
						<BotAvatar
							player={leftPlayer}
							isMyTurn={currentGameState.turnIndex === leftTurnIndex}
							isMarked={markerPlayerId === leftPlayer.id}
							winCount={animController.displayScores[leftPlayer.id] ?? (currentGameState.pointStandings[leftPlayer.id] || 0)}
							showScore={!isCoopMode}
							size="sm"
							passHintValues={leftPassHintValues}
						/>
						{#if leftPassTs > 0 || leftCountdown > 0}
							<div class="flex flex-col gap-1">
								{#if leftPassTs > 0}
									<div
										transition:fade={{ duration: 300 }}
										class="animate-bounce rounded-full bg-amber-500/20 px-2 py-0.5 font-body text-[10px] font-bold text-amber-400 text-center"
									>
										PASS
									</div>
								{/if}
								{#if leftCountdown > 0}
									<div
										class="flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] font-bold
										{leftCountdown <= 10
											? 'border-red-500/40 bg-red-500/15 text-red-400'
											: 'border-amber-500/30 bg-amber-500/10 text-amber-400'}"
									>
										<span>⏱</span>
										<span>{leftCountdown}s</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
					<div class="pointer-events-auto">
						<PlayerHand
							player={leftPlayer}
							isMyTurn={currentGameState.turnIndex === leftTurnIndex}
							isMarked={markerPlayerId === leftPlayer.id}
							winCount={currentGameState.pointStandings[leftPlayer.id] || 0}
							playableTileIds={new Set(
								generateLegalMoves(currentGameState, leftPlayer.id).map((m) => m.tileId)
							)}
							activeTileId={activeTile?.id ?? null}
							selectedTileId={selectedTile?.id ?? null}
							ondragstart={handleSampleDisabled}
							ontileclick={handleSampleDisabled}
							showCardFaces={getShowCardFaces((myPlayerIndex + 3) % 4)}
							tileSize="sm"
						/>
					</div>
				</div>
			{/if}

			<!-- Top Opponent (index 2) - normal position -->
			{#if topPlayer}
				<div class="flex w-[calc(100%/3)] flex-col items-center gap-1">
					<div class="flex items-center gap-1.5">
						<BotAvatar
							player={topPlayer}
							isMyTurn={currentGameState.turnIndex === topTurnIndex}
							isMarked={markerPlayerId === topPlayer.id}
							winCount={animController.displayScores[topPlayer.id] ?? (currentGameState.pointStandings[topPlayer.id] || 0)}
							showScore={!isCoopMode}
							size="sm"
							passHintValues={topPassHintValues}
						/>
						{#if topPassTs > 0 || topCountdown > 0}
							<div class="flex flex-col gap-1">
								{#if topPassTs > 0}
									<div
										transition:fade={{ duration: 300 }}
										class="animate-bounce rounded-full bg-amber-500/20 px-2 py-0.5 font-body text-[10px] font-bold text-amber-400 text-center"
									>
										PASS
									</div>
								{/if}
								{#if topCountdown > 0}
									<div
										class="flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] font-bold
										{topCountdown <= 10
											? 'border-red-500/40 bg-red-500/15 text-red-400'
											: 'border-amber-500/30 bg-amber-500/10 text-amber-400'}"
									>
										<span>⏱</span>
										<span>{topCountdown}s</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
					<div class="pointer-events-auto">
						<PlayerHand
							player={topPlayer}
							isMyTurn={currentGameState.turnIndex === topTurnIndex}
							isMarked={markerPlayerId === topPlayer.id}
							winCount={currentGameState.pointStandings[topPlayer.id] || 0}
							playableTileIds={new Set(
								generateLegalMoves(currentGameState, topPlayer.id).map((m) => m.tileId)
							)}
							activeTileId={activeTile?.id ?? null}
							selectedTileId={selectedTile?.id ?? null}
							ondragstart={handleSampleDisabled}
							ontileclick={handleSampleDisabled}
							showCardFaces={getShowCardFaces((myPlayerIndex + 2) % 4)}
							tileSize="sm"
						/>
					</div>
				</div>
			{/if}

			<!-- Right Opponent (index 1) - shifted down -->
			{#if rightPlayer}
				<div class="flex w-[calc(100%/3)] translate-y-6 flex-col items-center gap-1">
					<div class="flex items-center gap-1.5">
						<BotAvatar
							player={rightPlayer}
							isMyTurn={currentGameState.turnIndex === rightTurnIndex}
							isMarked={markerPlayerId === rightPlayer.id}
							winCount={animController.displayScores[rightPlayer.id] ?? (currentGameState.pointStandings[rightPlayer.id] || 0)}
							showScore={!isCoopMode}
							size="sm"
							passHintValues={rightPassHintValues}
						/>
						{#if rightPassTs > 0 || rightCountdown > 0}
							<div class="flex flex-col gap-1">
								{#if rightPassTs > 0}
									<div
										transition:fade={{ duration: 300 }}
										class="animate-bounce rounded-full bg-amber-500/20 px-2 py-0.5 font-body text-[10px] font-bold text-amber-400 text-center"
									>
										PASS
									</div>
								{/if}
								{#if rightCountdown > 0}
									<div
										class="flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] font-bold
										{rightCountdown <= 10
											? 'border-red-500/40 bg-red-500/15 text-red-400'
											: 'border-amber-500/30 bg-amber-500/10 text-amber-400'}"
									>
										<span>⏱</span>
										<span>{rightCountdown}s</span>
									</div>
								{/if}
							</div>
						{/if}
					</div>
					<div class="pointer-events-auto">
						<PlayerHand
							player={rightPlayer}
							isMyTurn={currentGameState.turnIndex === rightTurnIndex}
							isMarked={markerPlayerId === rightPlayer.id}
							winCount={currentGameState.pointStandings[rightPlayer.id] || 0}
							playableTileIds={new Set(
								generateLegalMoves(currentGameState, rightPlayer.id).map((m) => m.tileId)
							)}
							activeTileId={activeTile?.id ?? null}
							selectedTileId={selectedTile?.id ?? null}
							ondragstart={handleSampleDisabled}
							ontileclick={handleSampleDisabled}
							showCardFaces={getShowCardFaces((myPlayerIndex + 1) % 4)}
							tileSize="sm"
						/>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

	<!-- ── LAYER 4: Board Area (flex-1 = fills remaining space) ── -->
	<div class="relative flex min-h-[140px] flex-1 items-center justify-center overflow-hidden md:min-h-0" data-board-area>
		<div
			class="flex h-full w-full items-center justify-center overflow-hidden"
			bind:clientWidth={boardWidth}
			bind:clientHeight={boardHeight}
		>
			<div class="pointer-events-none absolute inset-0"></div>
			{#if currentGameState?.board.playedTiles.length === 0 && !showDropZones}
				<p class="px-4 text-center font-body text-sm font-medium text-stone-500 md:text-lg">
					Meja kosong. Pemain pertama mulai.
				</p>
			{/if}

			<div
				class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out {currentGameState
					?.board.playedTiles.length === 0 && !showDropZones
					? 'invisible opacity-0'
					: ''}"
				style="transform: scale({camera.scale});"
			>
				<div
					class="absolute flex h-0 w-0 items-center justify-center transition-transform duration-500 ease-out"
					style="transform: translate({camera.offsetX}px, {camera.offsetY}px);"
				>
					{#each boardLayout as tile (tile.id)}
						{@const isVertical = tile.rotation % 180 !== 0}
						{@const cssRotation = isVertical ? tile.rotation - 90 : tile.rotation}
						{@const isHidden = animController.hiddenBoardTileIds.has(tile.id)}
						<div
							class="absolute transition-all duration-500 ease-out {isHidden ? 'invisible' : ''}"
							style="transform: translate({tile.x}px, {tile.y}px) rotate({cssRotation}deg);"
							data-board-tile-id={tile.id}
						>
							<DominoTile {tile} {isVertical} />
						</div>
					{/each}

					{#if showDropZones && leftPreview}
						<PlacementGhost
							tile={leftPreview}
							{dropZoneHovered}						onhover={(v) => dropZoneHovered = v}
							onplace={placeTile}
						/>
					{/if}
					{#if showDropZones && rightPreview}
						<PlacementGhost
							tile={rightPreview}
							{dropZoneHovered}						onhover={(v) => dropZoneHovered = v}
							onplace={placeTile}
						/>
					{/if}
				</div>
			</div>
		</div>
	</div>


	<!-- ── LAYER 5: Next Round CTA / Match Over Buttons ── -->
	{#if currentGameState?.result}
		{#if isMatchOver}
			<!-- Match completed — show action buttons without countdown -->
			<div class="shrink-0 border-t border-stone-800 px-4 py-3">
				<div class="flex items-center justify-center gap-3">
					<button
						class="rounded-lg border border-stone-700 bg-surface px-6 py-2.5 font-body text-sm font-semibold text-stone-200 transition hover:bg-warm-hover active:scale-[0.98]"
						onclick={onExit}
					>
						← Kembali ke Lobi
					</button>
					<button
						class="rounded-lg bg-primary px-6 py-2.5 font-body text-sm font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98]"
						onclick={handleReplay}
					>
						🔄 Main Lagi
					</button>
				</div>
			</div>
		{:else if countdown > 0}
			<!-- Between rounds — countdown to next round -->
			<div class="shrink-0 border-t border-stone-800 px-4 py-2.5">
				<div class="flex items-center justify-center gap-2">
					<button
						class="font-body text-sm text-primary underline underline-offset-2 transition hover:text-primary-hover active:text-primary-active"
						onclick={nextRound}
					>
						Ronde Berikutnya
					</button>
					<span class="font-headline text-sm font-bold text-primary">{countdown}</span>
				</div>
			</div>
		{/if}
	{/if}

	<!-- ── LAYER 6: Main Player Hand ──────────────────────────── -->
	<div
		bind:clientHeight={mainHandHeight}
		class="shrink-0 pb-2 pt-1 md:pb-4"
	>
		{#if currentGameState}
				{@const mainPlayer = p(0)}
				{#if mainPlayer}					<!-- Main player avatar + info panel (PASS, countdown, score) -->
					{@const mainCountdown = getCountdownForPlayer(myPlayerIndex)}
					{@const mainPassTs = getPassTimestamp(myPlayerIndex)}
				{@const mainPassHintValues = getPassHintValues(myPlayerIndex)}
				{@const mainScore = animController.displayScores[mainPlayer.id] ?? (currentGameState.pointStandings[mainPlayer.id] || 0)}
					<div class="mb-2 flex items-center justify-center gap-3">
						<!-- Avatar box -->
						<div class="flex items-center gap-2 rounded-lg border border-stone-700 bg-surface px-3 py-1.5">
							<div class="relative">
								<PassHintBadge values={mainPassHintValues} />
								<img
									src="https://api.dicebear.com/9.x/bottts/svg?seed={mainPlayer.name}&backgroundColor=78350f"
									alt="Avatar"
									class="h-7 w-7 rounded-full bg-stone-800 object-cover ring-2 ring-stone-600"
								/>
							</div>
							<span class="font-body text-sm font-semibold text-stone-100">{mainPlayer.name}</span>
						</div>

					<!-- Info panel: PASS / countdown / score -->
					<div class="flex items-center gap-2">
						{#if mainPassTs > 0}
							<div
								transition:fade={{ duration: 300 }}
								class="animate-bounce rounded-full bg-amber-500/20 px-3 py-1 font-body text-sm font-bold text-amber-400"
							>
								PASS
							</div>
						{/if}
						{#if mainCountdown > 0}
							<div
								class="flex items-center gap-1 rounded-full border px-3 py-1 font-body text-sm font-bold
								{mainCountdown <= 10
									? 'border-red-500/40 bg-red-500/15 text-red-400'
									: 'border-amber-500/30 bg-amber-500/10 text-amber-400'}"
							>
								<span>⏱</span>
								<span>{mainCountdown}s</span>
							</div>
						{/if}
						{#if !isCoopMode}
							<div
								class="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-body text-sm font-bold text-primary"
							>
								<span>🏆</span>
								<span>{mainScore}</span>
							</div>
						{/if}
					</div>
				</div>						<MainPlayerHand
							player={mainPlayer}
							isMyTurn={currentGameState.turnIndex === myPlayerIndex}
							isMain={true}
							isMarked={markerPlayerId === mainPlayer.id}
							winCount={currentGameState.pointStandings[mainPlayer.id] || 0}
							playableTileIds={new Set(
								generateLegalMoves(currentGameState, mainPlayer.id).map((m) => m.tileId)
							)}
							activeTileId={activeTile?.id ?? null}
							selectedTileId={selectedTile?.id ?? null}
							ondragstart={handleTileDragStart}
							ontileclick={handleTileClick}
							onCaptureMoveSource={captureMoveSource}
							{game}
							{currentGameState}
						/>
						<!-- score anchor for main player -->
						<div
							data-score-id={mainPlayer.id}
							class="pointer-events-none fixed z-0 opacity-0"
							style="left:0; top:0; width:1px; height:1px;"
						></div>
			{/if}
		{/if}
	</div>
</div>
