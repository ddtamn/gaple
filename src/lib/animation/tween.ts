/**
 * Simple number tween utility for animating score changes.
 * Runs on requestAnimationFrame for smooth visuals.
 */

export interface TweenConfig {
	from: number;
	to: number;
	duration: number;
	easing?: (t: number) => number;
	onUpdate: (value: number) => void;
	onComplete?: () => void;
}

/** Ease-out cubic for a decelerating feel. */
export function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/** Ease-out quint for a more dramatic deceleration. */
export function easeOutQuint(t: number): number {
	return 1 - Math.pow(1 - t, 5);
}

/** Spring-like overshoot then settle. */
export function easeOutBack(t: number): number {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Run a tween animation. Returns a promise that resolves when complete.
 * Automatically cancels if `abortSignal` is provided and triggered.
 */
export function tween(config: TweenConfig, abortSignal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (abortSignal?.aborted) {
			config.onUpdate(config.to);
			config.onComplete?.();
			resolve();
			return;
		}

		const easing = config.easing ?? easeOutCubic;
		const startTime = performance.now();

		function tick(now: number) {
			if (abortSignal?.aborted) {
				config.onUpdate(config.to);
				config.onComplete?.();
				resolve();
				return;
			}

			const elapsed = now - startTime;
			const progress = Math.min(elapsed / config.duration, 1);
			const easedProgress = easing(progress);
			const currentValue = config.from + (config.to - config.from) * easedProgress;

			config.onUpdate(currentValue);

			if (progress < 1) {
				requestAnimationFrame(tick);
			} else {
				config.onUpdate(config.to);
				config.onComplete?.();
				resolve();
			}
		}

		requestAnimationFrame(tick);
	});
}

/**
 * Wait a specific duration (ms).
 */
export function delay(ms: number, abortSignal?: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (abortSignal?.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		if (abortSignal) {
			abortSignal.addEventListener(
				'abort',
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true }
			);
		}
	});
}
