import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { describeSrsStoreConformance, makeConformanceCards } from '../../store/test/conformance.js';
import { createFileStore, fileStoreSchemaVersion } from './index.js';

const makeFilePath = async () => {
	const directory = await mkdtemp(path.join(tmpdir(), 'mdsrs-file-store-'));
	return path.join(directory, 'srs.json');
};

describeSrsStoreConformance('createFileStore', {
	createStore: async () => createFileStore(await makeFilePath())
});

describe('createFileStore', () => {
	it('persists reviews and reloads them from disk', async () => {
		const filePath = await makeFilePath();
		const [card] = makeConformanceCards();

		if (!card) throw new Error('Expected fixture card.');

		const store = await createFileStore(filePath);
		await store.syncCards([card], new Date('2026-01-01T00:00:00.000Z'));
		await store.reviewCard(card.hash, 'good', new Date('2026-01-02T00:00:00.000Z'));

		const restored = await createFileStore(filePath);
		const cards = await restored.getCards([card.hash]);
		const reviews = await restored.getReviews([card.hash]);

		expect(cards.get(card.hash)?.performance).toMatchObject({
			reviewCount: 1,
			dueDate: '2026-01-05'
		});
		expect(reviews).toHaveLength(1);
		expect(reviews[0]).toMatchObject({
			cardHash: card.hash,
			grade: 'good'
		});
	});

	it('writes a versioned JSON document', async () => {
		const filePath = await makeFilePath();
		const store = await createFileStore(filePath);

		await store.save();

		const document = JSON.parse(await readFile(filePath, 'utf8')) as {
			schemaVersion: number;
			cards: unknown[];
			reviews: unknown[];
			nextReviewId: number;
		};

		expect(document).toMatchObject({
			schemaVersion: fileStoreSchemaVersion,
			cards: [],
			reviews: [],
			nextReviewId: 1
		});
	});
});
