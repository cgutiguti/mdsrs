import type { Card, Grade } from '@mdsrs/core';
import { createMemoryStore } from '@mdsrs/store';

let store = createMemoryStore();

export const grades = new Set<Grade>(['forgot', 'hard', 'good', 'easy']);

export const syncStore = async (cards: Card[]) => {
	await store.syncCards(cards);
	return store;
};

export const getPerformance = async (cardHash: string) =>
	(await store.getPerformances([cardHash])).get(cardHash) ?? null;

export const getReviewQueue = (cards: Card[]) =>
	store.getDueCards(cards, {
		burySiblings: true
	});

export const recordReview = (cardHash: string, grade: Grade) => store.reviewCard(cardHash, grade);

export const resetReviews = () => {
	store = createMemoryStore();
};
