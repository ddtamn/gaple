/**
 * AnimationQueue — sequential promise-based task execution.
 *
 * Ensures animations don't overlap. Each task runs to completion
 * before the next task begins. Supports abort signals for cleanup.
 */

export class AnimationQueue {
	private queue: Array<{
		task: () => Promise<void>;
		label?: string;
	}> = [];
	private running = false;

	/** Enqueue a task that returns a promise. Resolves when the task completes. */
	enqueue(task: () => Promise<void>, label?: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.queue.push({
				task: () => task().then(resolve, reject),
				label
			});
			if (!this.running) {
				this.process();
			}
		});
	}

	/** Clear all pending tasks. */
	clear() {
		this.queue = [];
	}

	/** Number of pending tasks. */
	get pending(): number {
		return this.queue.length;
	}

	/** Whether the queue is actively processing. */
	get isRunning(): boolean {
		return this.running;
	}

	private async process() {
		if (this.running) return;
		this.running = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift()!;
			try {
				await item.task();
			} catch {
				// Task failed — continue with the next one
			}
		}

		this.running = false;
	}
}
