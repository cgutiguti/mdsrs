import { describe, expect, it } from 'vitest';
import { buildDeckTree } from '@mdsrs/core';
import { createMemoryStore, getCollectionStats, isOverdue } from './index.js';
import { describeSrsStoreConformance, makeConformanceCards } from '../test/conformance.js';

describeSrsStoreConformance('createMemoryStore', {
	createStore: () => createMemoryStore()
});

describe('createMemoryStore', () => {
	it('builds generic collection stats through the store interface', async () => {
		const store = createMemoryStore();
		const cards = makeConformanceCards();
		const tree = buildDeckTree(cards);
		const [card] = cards;

		if (!card) throw new Error('Expected fixture card.');

		await store.syncCards(cards, new Date('2026-01-01T00:00:00.000Z'));
		await store.reviewCard(card.hash, 'good', new Date('2026-01-02T00:00:00.000Z'));

		const stats = await getCollectionStats(store, cards, tree, {
			now: new Date('2026-01-02T12:00:00.000Z')
		});

		expect(stats).toMatchObject({
			totalCards: 2,
			activeCards: 2,
			dueCards: 1,
			queuedCards: 1,
			newCards: 1,
			reviewsToday: 1,
			hitRateLast30Days: 1
		});
		expect(stats.decks[0]).toMatchObject({
			path: 'conformance',
			activeCards: 2,
			dueCards: 1,
			queuedCards: 1
		});
	});

	it('snapshots and restores without sharing mutable references', async () => {
		const store = createMemoryStore();
		const [card] = makeConformanceCards();

		if (!card) throw new Error('Expected fixture card.');

		await store.syncCards([card]);
		await store.reviewCard(card.hash, 'good', new Date('2026-01-01T00:00:00.000Z'));

		const snapshot = store.snapshot();
		snapshot.cards[0]!.performance.reviewCount = 999;
		const restored = createMemoryStore(snapshot);
		snapshot.cards[0]!.performance.reviewCount = 1000;

		expect((await store.getCards()).get(card.hash)?.performance.reviewCount).toBe(1);
		expect((await restored.getCards()).get(card.hash)?.performance.reviewCount).toBe(999);
	});
});

describe('isOverdue', () => {
	it('checks due dates before the current UTC date', () => {
		expect(isOverdue({ dueDate: '2026-01-01' }, new Date('2026-01-02T00:00:00.000Z'))).toBe(
			true
		);
		expect(isOverdue({ dueDate: '2026-01-02' }, new Date('2026-01-02T00:00:00.000Z'))).toBe(
			false
		);
		expect(isOverdue({ dueDate: null }, new Date('2026-01-02T00:00:00.000Z'))).toBe(false);
	});
});
