import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
	migrations,
	rowToPerformance,
	rowToStoredCard,
	rowToStoredReview,
	statsRowToCardStats,
	type SrsCardRow,
	type SrsReviewRow
} from './index.js';

const cardRow = {
	cardHash: 'abc123',
	deckName: 'example/math',
	filePath: 'content/example/math.md',
	familyHash: 'family123',
	frontMarkdown: 'Front',
	backMarkdown: 'Back',
	cardType: 'basic',
	active: true,
	addedAt: new Date('2026-01-01T00:00:00.000Z'),
	lastSeenAt: new Date('2026-01-02T00:00:00.000Z'),
	lastReviewedAt: new Date('2026-01-03T00:00:00.000Z'),
	stability: 4.5,
	difficulty: 3.25,
	intervalRaw: 5.8,
	intervalDays: 6,
	dueDate: '2026-01-09',
	reviewCount: 2
} satisfies SrsCardRow;

describe('row mapping', () => {
	it('maps card rows into stored cards and performances', () => {
		expect(rowToPerformance(cardRow)).toEqual({
			lastReviewedAt: '2026-01-03T00:00:00.000Z',
			stability: 4.5,
			difficulty: 3.25,
			intervalRaw: 5.8,
			intervalDays: 6,
			dueDate: '2026-01-09',
			reviewCount: 2
		});

		expect(rowToStoredCard(cardRow)).toMatchObject({
			cardHash: 'abc123',
			deckName: 'example/math',
			cardType: 'basic',
			addedAt: '2026-01-01T00:00:00.000Z',
			lastSeenAt: '2026-01-02T00:00:00.000Z',
			performance: {
				reviewCount: 2,
				dueDate: '2026-01-09'
			}
		});
	});

	it('normalizes unknown card types to basic', () => {
		expect(rowToStoredCard({ ...cardRow, cardType: 'custom' }).cardType).toBe('basic');
		expect(rowToStoredCard({ ...cardRow, cardType: 'cloze' }).cardType).toBe('cloze');
	});

	it('maps review rows and validates grades', () => {
		const reviewRow = {
			reviewId: 7,
			reviewCardHash: 'abc123',
			reviewedAt: new Date('2026-01-03T00:00:00.000Z'),
			grade: 'good',
			stability: 4.5,
			difficulty: 3.25,
			intervalRaw: 5.8,
			intervalDays: 6,
			dueDate: '2026-01-09'
		} satisfies SrsReviewRow;

		expect(rowToStoredReview(reviewRow)).toEqual({
			reviewId: 7,
			cardHash: 'abc123',
			reviewedAt: '2026-01-03T00:00:00.000Z',
			grade: 'good',
			stability: 4.5,
			difficulty: 3.25,
			intervalRaw: 5.8,
			intervalDays: 6,
			dueDate: '2026-01-09'
		});

		expect(() => rowToStoredReview({ ...reviewRow, grade: 'again' })).toThrow(
			'Invalid review grade'
		);
	});

	it('maps aggregate stats rows with numeric database count variants', () => {
		expect(
			statsRowToCardStats({
				cardHash: 'abc123',
				reviewCount: 4,
				forgotCount: 1n,
				hardCount: '1',
				goodCount: 1,
				easyCount: 1,
				difficulty: 3.25,
				stability: 4.5,
				intervalDays: 6,
				dueDate: '2026-01-09',
				lastReviewedAt: new Date('2026-01-03T00:00:00.000Z'),
				active: true
			})
		).toEqual({
			cardHash: 'abc123',
			reviewCount: 4,
			forgotCount: 1,
			hardCount: 1,
			goodCount: 1,
			easyCount: 1,
			hitRate: 0.75,
			missRate: 0.25,
			difficulty: 3.25,
			stability: 4.5,
			intervalDays: 6,
			dueDate: '2026-01-09',
			lastReviewedAt: '2026-01-03T00:00:00.000Z',
			active: true
		});
	});
});

describe('migration', () => {
	it('creates the SRS card and review tables with indexes', async () => {
		const sql = await readFile(migrations.initial, 'utf8');

		expect(sql).toContain('CREATE TABLE IF NOT EXISTS "srs_cards"');
		expect(sql).toContain('CREATE TABLE IF NOT EXISTS "srs_reviews"');
		expect(sql).toContain('FOREIGN KEY ("review_card_hash")');
		expect(sql).toContain('ON DELETE cascade');
		expect(sql).toContain('CREATE INDEX IF NOT EXISTS "srs_cards_active_due_idx"');
		expect(sql).toContain('CREATE INDEX IF NOT EXISTS "srs_reviews_card_hash_idx"');
	});
});
