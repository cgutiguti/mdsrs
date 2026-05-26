import { describe, expect, it } from 'vitest';
import { parseDeck, type Card } from '@mdsrs/core';
import type { SrsStore } from '../src/index.js';

export interface SrsStoreConformanceOptions {
	createStore: () => SrsStore | Promise<SrsStore>;
	reset?: () => Promise<void>;
}

export const makeConformanceCards = () =>
	parseDeck({
		deckName: 'Conformance',
		filePath: 'conformance/index.md',
		folderPath: 'conformance',
		nodePath: 'conformance',
		displayName: 'Conformance',
		text: [
			'Q: What is the source of truth?',
			'A: Markdown.',
			'',
			'---',
			'',
			'C: Edited content changes the [hash].'
		].join('\n')
	});

export const describeSrsStoreConformance = (
	name: string,
	{ createStore, reset }: SrsStoreConformanceOptions
) => {
	const setup = async () => {
		await reset?.();
		return {
			store: await createStore(),
			cards: makeConformanceCards()
		};
	};

	describe(`${name} SrsStore conformance`, () => {
		it('syncs cards and preserves addedAt across later syncs', async () => {
			const { store, cards } = await setup();

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
			const { store, cards } = await setup();

			await store.syncCards(cards);
			await store.syncCards(cards.slice(0, 1));
			const stored = await store.getCards();

			expect(stored.get(cards[0]?.hash ?? '')?.active).toBe(true);
			expect(stored.get(cards[1]?.hash ?? '')?.active).toBe(false);
		});

		it('returns due cards only for active synced cards', async () => {
			const { store, cards } = await setup();

			await store.syncCards(cards.slice(0, 1));

			const queue = await store.getDueCards(cards);

			expect(queue).toHaveLength(1);
			expect(queue[0]?.card.hash).toBe(cards[0]?.hash);
			expect(queue[0]?.performance?.reviewCount).toBe(0);
		});

		it('records reviews, schedules the next due date, and excludes future cards from due queue', async () => {
			const { store, cards } = await setup();
			const card = cards[0] as Card;

			await store.syncCards(cards);
			const result = await store.reviewCard(
				card.hash,
				'good',
				new Date('2026-01-02T03:04:05.000Z')
			);

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
			const { store, cards } = await setup();

			await expect(store.reviewCard('missing', 'good')).rejects.toMatchObject({
				cardHash: 'missing'
			});

			await store.syncCards(cards);
			await store.syncCards([]);

			await expect(store.reviewCard(cards[0]?.hash ?? '', 'good')).rejects.toMatchObject({
				cardHash: cards[0]?.hash
			});
		});

		it('builds aggregate card stats', async () => {
			const { store, cards } = await setup();
			const [card] = cards;

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

		it('returns review history oldest-to-newest', async () => {
			const { store, cards } = await setup();
			const [card] = cards;

			if (!card) throw new Error('Expected fixture card.');

			await store.syncCards([card]);
			await store.reviewCard(card.hash, 'good', new Date('2026-01-03T00:00:00.000Z'));
			await store.reviewCard(card.hash, 'easy', new Date('2026-01-02T00:00:00.000Z'));

			const reviews = await store.getReviews([card.hash]);

			expect(reviews.map((review) => review.reviewedAt)).toEqual([
				'2026-01-02T00:00:00.000Z',
				'2026-01-03T00:00:00.000Z'
			]);
		});
	});
};
