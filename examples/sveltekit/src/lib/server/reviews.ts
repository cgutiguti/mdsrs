import { buildReviewQueue, scheduleReview, type Card, type CardPerformance, type Grade } from '@mdsrs/core';

const performances = new Map<string, CardPerformance>();

export const grades = new Set<Grade>(['forgot', 'hard', 'good', 'easy']);

export const getPerformance = (cardHash: string) => performances.get(cardHash) ?? null;

export const getPerformances = () => performances;

export const getReviewQueue = (cards: Card[]) =>
	buildReviewQueue(cards, performances, {
		burySiblings: true
	});

export const recordReview = (cardHash: string, grade: Grade) => {
	const result = scheduleReview(performances.get(cardHash), grade);
	performances.set(cardHash, {
		lastReviewedAt: result.lastReviewedAt,
		stability: result.stability,
		difficulty: result.difficulty,
		intervalRaw: result.intervalRaw,
		intervalDays: result.intervalDays,
		dueDate: result.dueDate,
		reviewCount: result.reviewCount
	});

	return result;
};

export const resetReviews = () => {
	performances.clear();
};
