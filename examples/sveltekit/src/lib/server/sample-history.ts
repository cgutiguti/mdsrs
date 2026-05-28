import { scheduleReview, type Card, type CardPerformance, type Grade } from '@mdsrs/core';

export type ReviewHistoryEntry = {
	reviewId: number;
	reviewedAt: string;
	grade: Grade;
	stability: number;
	difficulty: number;
	intervalRaw: number;
	intervalDays: number;
	dueDate: string;
};

export type SampleCardStats = {
	reviewCount: number;
	forgotCount: number;
	hardCount: number;
	goodCount: number;
	easyCount: number;
	hitRate: number | null;
	missRate: number | null;
	difficulty: number | null;
	stability: number | null;
	intervalDays: number | null;
	dueDate: string | null;
};

const emptyPerformance = (): CardPerformance => ({
	lastReviewedAt: null,
	stability: null,
	difficulty: null,
	intervalRaw: null,
	intervalDays: null,
	dueDate: null,
	reviewCount: 0
});

const toPerformance = (entry: ReviewHistoryEntry): CardPerformance => ({
	lastReviewedAt: entry.reviewedAt,
	stability: entry.stability,
	difficulty: entry.difficulty,
	intervalRaw: entry.intervalRaw,
	intervalDays: entry.intervalDays,
	dueDate: entry.dueDate,
	reviewCount: entry.reviewId
});

const gradePatterns = [
	['good', 'hard', 'good', 'easy', 'good', 'good'],
	['forgot', 'hard', 'good', 'good', 'easy'],
	['hard', 'good', 'hard', 'good', 'easy', 'good'],
	['good', 'good', 'easy', 'good']
] as const satisfies readonly (readonly Grade[])[];

const hashSeed = (hash: string) =>
	hash
		.slice(0, 8)
		.split('')
		.reduce((total, char) => total + char.charCodeAt(0), 0);

export const buildSampleHistory = (card: Pick<Card, 'hash'>): ReviewHistoryEntry[] => {
	const seed = hashSeed(card.hash);
	const pattern = gradePatterns[seed % gradePatterns.length] ?? gradePatterns[0];
	let performance = emptyPerformance();
	let reviewedAt = Date.UTC(2026, 0, 2 + (seed % 5), 12, 0, 0);

	return pattern.map((grade, index) => {
		const result = scheduleReview(performance, grade, new Date(reviewedAt));
		const entry: ReviewHistoryEntry = {
			reviewId: index + 1,
			reviewedAt: result.lastReviewedAt,
			grade,
			stability: result.stability,
			difficulty: result.difficulty,
			intervalRaw: result.intervalRaw,
			intervalDays: result.intervalDays,
			dueDate: result.dueDate
		};

		performance = toPerformance(entry);
		reviewedAt += Math.max(1, Math.min(result.intervalDays, 9)) * 86_400_000;

		return entry;
	});
};

const countGrade = (history: ReviewHistoryEntry[], grade: Grade) =>
	history.filter((entry) => entry.grade === grade).length;

export const buildSampleStats = (history: ReviewHistoryEntry[]): SampleCardStats => {
	const latest = history.at(-1);
	const forgotCount = countGrade(history, 'forgot');
	const hardCount = countGrade(history, 'hard');
	const goodCount = countGrade(history, 'good');
	const easyCount = countGrade(history, 'easy');
	const hitCount = hardCount + goodCount + easyCount;
	const reviewCount = history.length;

	return {
		reviewCount,
		forgotCount,
		hardCount,
		goodCount,
		easyCount,
		hitRate: reviewCount === 0 ? null : hitCount / reviewCount,
		missRate: reviewCount === 0 ? null : forgotCount / reviewCount,
		difficulty: latest?.difficulty ?? null,
		stability: latest?.stability ?? null,
		intervalDays: latest?.intervalDays ?? null,
		dueDate: latest?.dueDate ?? null
	};
};
