/**
 * Per-win-type configuration for round-end celebrations.
 *
 * Drives the visual treatment of the center stamp, whether to fire
 * confetti, whether to flash the screen, and how dramatic the entrance
 * animation should be.
 *
 * Win types come from engine/scoring.ts:
 *   - Domi (1pt, basic empty-hand play)
 *   - Ceki (3pt, non-balak last tile playable on both ends)
 *   - Ceki Palang (4pt, balak last tile playable on both ends — EPIC)
 *   - Gab (1pt, lowest-pip player wins a blocked game)
 *   - Gab Tangkap (2pt, lowest-pip player wins when they did NOT close the board)
 */

export type WinTheme = 'primary' | 'danger';
export type WinIntensity = 'normal' | 'great' | 'epic';
export type ConfettiIntensity = 'normal' | 'epic';

export interface WinTypeConfig {
	/** Display label shown in the stamp. */
	label: string;
	/** Color theme: primary (warm amber) or danger (red) */
	theme: WinTheme;
	/** Visual intensity used for stamp entrance scale/rotation */
	intensity: WinIntensity;
	/** Fire a confetti burst from the stamp center */
	confetti: boolean;
	/** Fire a full-screen color flash on stamp */
	flash: boolean;
	/** Initial scale for stamp overshoot (1 = neutral) */
	initialScale: number;
	/** Initial rotation (degrees) for stamp overshoot */
	initialRotation: number;
}

export const WIN_TYPE_CONFIG: Record<string, WinTypeConfig> = {
	Domi: {
		label: 'Domi',
		theme: 'primary',
		intensity: 'normal',
		confetti: false,
		flash: false,
		initialScale: 1.4,
		initialRotation: -10
	},
	Ceki: {
		label: 'Ceki',
		theme: 'primary',
		intensity: 'great',
		confetti: false,
		flash: false,
		initialScale: 1.6,
		initialRotation: -14
	},
	'Ceki Palang': {
		label: 'Ceki Palang',
		theme: 'danger',
		intensity: 'epic',
		confetti: true,
		flash: true,
		initialScale: 2.0,
		initialRotation: -18
	},
	Gab: {
		label: 'Gab',
		theme: 'primary',
		intensity: 'normal',
		confetti: false,
		flash: false,
		initialScale: 1.4,
		initialRotation: -10
	},
	'Gab Tangkap': {
		label: 'Gab Tangkap',
		theme: 'danger',
		intensity: 'great',
		confetti: true,
		flash: false,
		initialScale: 1.65,
		initialRotation: -14
	}
};

const DEFAULT_CONFIG: WinTypeConfig = {
	label: 'Normal',
	theme: 'primary',
	intensity: 'normal',
	confetti: false,
	flash: false,
	initialScale: 1.4,
	initialRotation: -10
};

/** Look up a win-type config with a graceful fallback for unknown types. */
export function getWinTypeConfig(winType: string): WinTypeConfig {
	return WIN_TYPE_CONFIG[winType] ?? { ...DEFAULT_CONFIG, label: winType };
}
