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

export interface RunAnimationConfig {
	/** Total duration in ms */
	duration: number;
	/** Easing applied to linear progress (0..1) before being passed to onUpdate */
	easing?: (t: number) => number;
	/** Called every frame with eased progress in [0, 1] */
	onUpdate: (progress: number) => void;
	/** Called once when progress reaches 1 (or animation is aborted) */
	onComplete?: () => void;
	/** When triggered, animation snaps to progress=1 and resolves */
	abortSignal?: AbortSignal;
}

/**
 * Run a progress-based animation. Like tween() but exposes a single eased
 * progress value (0..1) instead of interpolating a single number. This lets
 * overlays animate multiple properties (x, y, scale, rotation, opacity) with
 * one shared timeline and one chosen easing.
 *
 * Resolves when the animation completes naturally or is aborted. If aborted,
 * onUpdate is called once with progress=1 and onComplete is invoked.
 */
export function runAnimation(config: RunAnimationConfig): Promise<void> {
	return new Promise((resolve) => {
		if (config.abortSignal?.aborted) {
			config.onUpdate(1);
			config.onComplete?.();
			resolve();
			return;
		}

		const easing = config.easing ?? easeOutCubic;
		const startTime = performance.now();
		let rafId = 0;
		let done = false;

		const finish = () => {
			if (done) return;
			done = true;
			cancelAnimationFrame(rafId);
			config.onUpdate(1);
			config.onComplete?.();
			resolve();
		};

		if (config.abortSignal) {
			config.abortSignal.addEventListener('abort', finish, { once: true });
		}

		function tick(now: number) {
			if (config.abortSignal?.aborted) {
				finish();
				return;
			}
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / config.duration, 1);
			const easedProgress = easing(progress);

			config.onUpdate(easedProgress);

			if (progress < 1) {
				rafId = requestAnimationFrame(tick);
			} else {
				finish();
			}
		}

		rafId = requestAnimationFrame(tick);
	});
}

/** A reusable no-op easing (linear) for callers that want raw progress. */
export const linear = (t: number): number => t;
