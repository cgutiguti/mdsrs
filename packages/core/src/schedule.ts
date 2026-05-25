import type { CardPerformance, Grade, ReviewResult } from './types.js';

const weights = [
	0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
	1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621
] as const;

const desiredRecall = 0.9;
const factor = 19 / 81;
const decay = -0.5;

const gradeValue = (grade: Grade) =>
	({
		forgot: 1,
		hard: 2,
		good: 3,
		easy: 4
	})[grade];

const clampDifficulty = (difficulty: number) => Math.min(10, Math.max(1, difficulty));

export const retrievability = (intervalDays: number, stability: number) =>
	(1 + factor * (intervalDays / stability)) ** decay;

export const interval = (recall: number, stability: number) =>
	(stability / factor) * (recall ** (1 / decay) - 1);

export const initialStability = (grade: Grade) =>
	({
		forgot: weights[0],
		hard: weights[1],
		good: weights[2],
		easy: weights[3]
	})[grade];

export const initialDifficulty = (grade: Grade) =>
	clampDifficulty(weights[4] - Math.exp(weights[5] * (gradeValue(grade) - 1)) + 1);

const deltaDifficulty = (grade: Grade) => -weights[6] * (gradeValue(grade) - 3);

const difficultyPrime = (difficulty: number, grade: Grade) =>
	difficulty + deltaDifficulty(grade) * ((10 - difficulty) / 9);

export const newDifficulty = (difficulty: number, grade: Grade) =>
	clampDifficulty(
		weights[7] * initialDifficulty('easy') + (1 - weights[7]) * difficultyPrime(difficulty, grade)
	);

const successStability = (difficulty: number, stability: number, recall: number, grade: Grade) => {
	const hardPenalty = grade === 'hard' ? weights[15] : 1;
	const easyBonus = grade === 'easy' ? weights[16] : 1;
	const alpha =
		1 +
		(11 - difficulty) *
			stability ** -weights[9] *
			(Math.exp(weights[10] * (1 - recall)) - 1) *
			hardPenalty *
			easyBonus *
			Math.exp(weights[8]);
	return stability * alpha;
};

const failStability = (difficulty: number, stability: number, recall: number) =>
	Math.min(
		difficulty ** -weights[12] *
			((stability + 1) ** weights[13] - 1) *
			Math.exp(weights[14] * (1 - recall)) *
			weights[11],
		stability
	);

export const newStability = (
	difficulty: number,
	stability: number,
	recall: number,
	grade: Grade
) =>
	grade === 'forgot'
		? failStability(difficulty, stability, recall)
		: successStability(difficulty, stability, recall, grade);

export const scheduleReview = (
	performance: CardPerformance | null | undefined,
	grade: Grade,
	reviewedAt = new Date()
): ReviewResult => {
	const previousInterval = performance?.intervalDays ?? 0;
	const previousStability = performance?.stability;
	const previousDifficulty = performance?.difficulty;
	const stability =
		previousStability == null || previousDifficulty == null
			? initialStability(grade)
			: newStability(
					previousDifficulty,
					previousStability,
					retrievability(Math.max(previousInterval, 1), previousStability),
					grade
				);
	const difficulty =
		previousDifficulty == null ? initialDifficulty(grade) : newDifficulty(previousDifficulty, grade);
	const intervalRaw = interval(desiredRecall, stability);
	const intervalDays = Math.max(Math.round(intervalRaw), 1);
	const dueDate = addDays(reviewedAt, intervalDays);

	return {
		lastReviewedAt: toTimestamp(reviewedAt),
		stability,
		difficulty,
		intervalRaw,
		intervalDays,
		dueDate,
		reviewCount: (performance?.reviewCount ?? 0) + 1,
		grade
	};
};

export const toTimestamp = (date: Date) => date.toISOString();

export const toDateString = (date: Date) => date.toISOString().slice(0, 10);

export const isDue = (
	performance: Pick<CardPerformance, 'dueDate'> | null | undefined,
	now = new Date()
) => performance?.dueDate == null || performance.dueDate <= toDateString(now);

const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return toDateString(next);
};

