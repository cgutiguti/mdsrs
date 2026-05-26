import { describe, expect, it } from 'vitest';
import { createMemoryStore, isOverdue } from './index.js';
import { describeSrsStoreConformance, makeConformanceCards } from '../test/conformance.js';

describeSrsStoreConformance('createMemoryStore', {
	createStore: () => createMemoryStore()
});

describe('createMemoryStore', () => {
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
