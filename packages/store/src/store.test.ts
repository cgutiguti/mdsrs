import { describe, expect, it } from 'vitest';
import { parseDeck, type Card } from '@mdsrs/core';
import { CardNotFoundError, createMemoryStore, isOverdue } from './index.js';

const source = {
	deckName: 'Example',
	filePath: 'example/index.md',
	folderPath: 'example',
	nodePath: 'example',
	displayName: 'Example',
	text: [
		'Q: What is the source of truth?',
		'A: Markdown.',
		'',
		'---',
		'',
		'C: Edited content changes the [hash].'
	].join('\n')
};

const makeCards = () => parseDeck(source);

describe('createMemoryStore', () => {
	it('syncs cards and preserves addedAt across later syncs', async () => {
		const store = createMemoryStore();
		const cards = makeCards();

		await store.syncCards(cards, new Date('2026-01-01T00:00:00.000Z'));
		await store.syncCards(cards, new Date('2026-01-02T00:00:00.000Z'));
		const stored = await store.getCards(cards.map((card) => card.hash));

		expect(stored).toHaveLength(2);
		expect(stored.get(cards[0]?.hash ?? '')).toMatchObject({
			active: true,
			addedAt: '2026-01-01T00:00:00.000Z',
			lastSeenAt: '2026-01-02T00:00:00.000Z',
			performance: {
				reviewCount: 0,
				dueDate: null
			}
		});
	});

	it('marks missing cards inactive during sync', async () => {
		const store = createMemoryStore();
		const cards = makeCards();

		await store.syncCards(cards);
		await store.syncCards(cards.slice(0, 1));
		const stored = await store.getCards();

		expect(stored.get(cards[0]?.hash ?? '')?.active).toBe(true);
		expect(stored.get(cards[1]?.hash ?? '')?.active).toBe(false);
	});

	it('returns due cards only for active synced cards', async () => {
		const store = createMemoryStore();
		const cards = makeCards();

		await store.syncCards(cards.slice(0, 1));

		const queue = await store.getDueCards(cards);

		expect(queue).toHaveLength(1);
		expect(queue[0]?.card.hash).toBe(cards[0]?.hash);
		expect(queue[0]?.performance?.reviewCount).toBe(0);
	});

	it('records reviews, schedules the next due date, and excludes future cards from due queue', async () => {
		const store = createMemoryStore();
		const cards = makeCards();
		const card = cards[0] as Card;

		await store.syncCards(cards);
		const result = await store.reviewCard(card.hash, 'good', new Date('2026-01-02T03:04:05.000Z'));

		expect(result).toMatchObject({
			grade: 'good',
			lastReviewedAt: '2026-01-02T03:04:05.000Z',
			intervalDays: 3,
			dueDate: '2026-01-05',
			reviewCount: 1
		});
		await expect(
			store.getDueCards([card], {
				now: new Date('2026-01-03T00:00:00.000Z')
			})
		).resolves.toHaveLength(0);
		await expect(
			store.getDueCards([card], {
				now: new Date('2026-01-05T00:00:00.000Z')
			})
		).resolves.toHaveLength(1);
	});

	it('throws for reviews of unsynced or inactive cards', async () => {
		const store = createMemoryStore();
		const cards = makeCards();

		await expect(store.reviewCard('missing', 'good')).rejects.toBeInstanceOf(CardNotFoundError);

		await store.syncCards(cards);
		await store.syncCards([]);

		await expect(store.reviewCard(cards[0]?.hash ?? '', 'good')).rejects.toBeInstanceOf(
			CardNotFoundError
		);
	});

	it('builds aggregate card stats', async () => {
		const store = createMemoryStore();
		const [card] = makeCards();

		if (!card) throw new Error('Expected fixture card.');

		await store.syncCards([card]);
		await store.reviewCard(card.hash, 'forgot', new Date('2026-01-01T00:00:00.000Z'));
		await store.reviewCard(card.hash, 'easy', new Date('2026-01-02T00:00:00.000Z'));

		const stats = await store.getCardStats([card.hash]);

		expect(stats.get(card.hash)).toMatchObject({
			cardHash: card.hash,
			reviewCount: 2,
			forgotCount: 1,
			easyCount: 1,
			hitRate: 0.5,
			missRate: 0.5,
			active: true
		});
	});

	it('snapshots and restores without sharing mutable references', async () => {
		const store = createMemoryStore();
		const [card] = makeCards();

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
