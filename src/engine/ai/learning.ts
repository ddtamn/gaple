export interface LearningSample {
	position: string;
	outcome: number;
	timestamp: number;
}

export interface LearningBlueprintOptions {
	enabled?: boolean;
	maxSamples?: number;
}

export interface LearningBlueprint {
	enabled: boolean;
	samples: LearningSample[];
	collectSelfPlaySample: (position: string, outcome: number) => void;
	createEvaluationLog: (position: string, value: number) => string;
	clearSamples: () => void;
}

export function createLearningBlueprint(options: LearningBlueprintOptions = {}): LearningBlueprint {
	const enabled = options.enabled ?? false;
	const maxSamples = options.maxSamples ?? 100;
	const samples: LearningSample[] = [];

	return {
		enabled,
		samples,
		collectSelfPlaySample(position, outcome) {
			if (!enabled) {
				return;
			}

			samples.push({ position, outcome, timestamp: Date.now() });
			if (samples.length > maxSamples) {
				samples.splice(0, samples.length - maxSamples);
			}
		},
		createEvaluationLog(position, value) {
			return JSON.stringify({
				position,
				value: Number(value.toFixed(2)),
				sampleCount: samples.length,
				enabled
			});
		},
		clearSamples() {
			samples.length = 0;
		}
	};
}
