import { readFile } from 'node:fs/promises';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDeck, type Card } from '@mdsrs/core';
import { CardNotFoundError } from '@mdsrs/store';
import { createPostgresDrizzleStore, migrations, schema } from './index.js';

const connectionString = process.env.MDSRS_POSTGRES_URL;
const describePostgres = connectionString ? describe : describe.skip;

const makeCards = () =>
	parseDeck({
		deckName: 'Integration',
		filePath: 'integration/index.md',
		folderPath: 'integration',
		nodePath: 'integration',
		displayName: 'Integration',
		text: [
			'Q: What stores mdsrs progression?',
			'A: A database keyed by card hash.',
			'',
			'---',
			'',
			'C: Edited [content] creates a new review identity.'
		].join('\n')
	});

describePostgres('createPostgresDrizzleStore integration', () => {
	const schemaName = `mdsrs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;
	let adminPool: pg.Pool;
	let pool: pg.Pool;

	beforeAll(async () => {
		if (!connectionString) throw new Error('MDSRS_POSTGRES_URL is required.');

		adminPool = new pg.Pool({ connectionString });
		await adminPool.query(`CREATE SCHEMA "${schemaName}"`);

		pool = new pg.Pool({
			connectionString,
			options: `-c search_path=${schemaName}`
		});
		await pool.query(await readFile(migrations.initial, 'utf8'));
	});

	afterAll(async () => {
		await pool?.end();
		if (adminPool) {
			await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
			await adminPool.end();
		}
	});

	it('syncs cards, records reviews, builds stats, and marks removed cards inactive', async () => {
		const db = drizzle(pool, { schema });
		const store = createPostgresDrizzleStore(db);
		const cards = makeCards();
		const [firstCard, secondCard] = cards as [Card, Card];

		await store.syncCards(cards, new Date('2026-01-01T00:00:00.000Z'));

		const stored = await store.getCards(cards.map((card) => card.hash));
		expect(stored).toHaveLength(2);
		expect(stored.get(firstCard.hash)).toMatchObject({
			cardHash: firstCard.hash,
			active: true,
			addedAt: '2026-01-01T00:00:00.000Z',
			lastSeenAt: '2026-01-01T00:00:00.000Z',
			performance: {
				reviewCount: 0,
				dueDate: null
			}
		});

		await expect(
			store.getDueCards(cards, {
				now: new Date('2026-01-01T12:00:00.000Z')
			})
		).resolves.toHaveLength(2);

		const result = await store.reviewCard(
			firstCard.hash,
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

		const reviews = await store.getReviews([firstCard.hash]);
		expect(reviews).toHaveLength(1);
		expect(reviews[0]).toMatchObject({
			cardHash: firstCard.hash,
			grade: 'good',
			reviewedAt: '2026-01-02T03:04:05.000Z'
		});

		const stats = await store.getCardStats([firstCard.hash]);
		expect(stats.get(firstCard.hash)).toMatchObject({
			cardHash: firstCard.hash,
			reviewCount: 1,
			forgotCount: 0,
			hardCount: 0,
			goodCount: 1,
			easyCount: 0,
			hitRate: 1,
			missRate: 0,
			active: true
		});

		await store.syncCards([firstCard], new Date('2026-01-03T00:00:00.000Z'));

		const afterRemoval = await store.getCards([firstCard.hash, secondCard.hash]);
		expect(afterRemoval.get(firstCard.hash)?.active).toBe(true);
		expect(afterRemoval.get(secondCard.hash)?.active).toBe(false);
		await expect(store.reviewCard(secondCard.hash, 'good')).rejects.toBeInstanceOf(
			CardNotFoundError
		);
	});
});
