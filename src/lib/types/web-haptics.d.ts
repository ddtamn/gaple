declare module 'web-haptics/svelte' {
	interface HapticOptions {
		debug?: boolean;
		showSwitch?: boolean;
	}

	interface HapticTriggerResult {
		trigger: (
			preset?: string | Array<{ duration: number; intensity?: number; delay?: number }>,
			options?: { intensity?: number }
		) => void;
		cancel: () => void;
		destroy: () => void;
		setDebug: (debug: boolean) => void;
		isSupported: boolean;
	}

	export function createWebHaptics(options?: HapticOptions): HapticTriggerResult;
}
