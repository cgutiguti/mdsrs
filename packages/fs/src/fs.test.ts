import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
	loadAssets,
	loadCollection,
	loadDeckSources,
	resolveCollectionAssetPath,
	resolveContentAssetPath,
	sourceHierarchy
} from './index.js';

const fixtureRoot = fileURLToPath(new URL('../test-fixtures/collection', import.meta.url));

describe('sourceHierarchy', () => {
	it('maps index files to folder decks and sibling markdown files to child decks', () => {
		expect(sourceHierarchy('example/index.md', 'Example')).toEqual({
			folderPath: 'example',
			nodePath: 'example',
			displayName: 'Example',
			deckName: 'example'
		});
		expect(sourceHierarchy('example/math/algebra.md', null)).toEqual({
			folderPath: 'example/math',
			nodePath: 'example/math/algebra',
			displayName: 'Algebra',
			deckName: 'example/math/algebra'
		});
	});
});

describe('asset resolution', () => {
	it('resolves relative, root-relative, and external asset paths', () => {
		expect(resolveContentAssetPath('example/math/algebra.md', './assets/plot.svg')).toBe(
			'example/math/assets/plot.svg'
		);
		expect(resolveContentAssetPath('example/math/algebra.md', '@/example/math/assets/plot.svg')).toBe(
			'example/math/assets/plot.svg'
		);
		expect(resolveContentAssetPath('example/math/algebra.md', 'https://example.com/image.png')).toBe(
			'https://example.com/image.png'
		);
		expect(resolveContentAssetPath('example/math/algebra.md', '../../../outside.png')).toBe(null);
	});

	it('resolves normalized content asset paths to absolute filesystem paths', () => {
		expect(resolveCollectionAssetPath(fixtureRoot, 'example/math/assets/plot.svg')).toBe(
			`${fixtureRoot}/example/math/assets/plot.svg`
		);
	});
});

describe('loadDeckSources', () => {
	it('loads markdown files as deterministic deck sources', async () => {
		const sources = await loadDeckSources(fixtureRoot);

		expect(sources.map((source) => source.filePath)).toEqual([
			'example/index.md',
			'example/math/algebra.md'
		]);
		expect(sources[0]).toMatchObject({
			deckName: 'example',
			folderPath: 'example',
			nodePath: 'example',
			displayName: 'Example'
		});
		expect(sources[0]?.text).not.toContain('name = "Example"');
	});
});

describe('loadAssets', () => {
	it('loads known media assets with collection-relative paths', async () => {
		await expect(loadAssets(fixtureRoot)).resolves.toEqual([
			{
				path: 'example/math/assets/plot.svg',
				absolutePath: `${fixtureRoot}/example/math/assets/plot.svg`
			}
		]);
	});
});

describe('loadCollection', () => {
	it('loads sources, parsed cards, deck tree, and assets', async () => {
		const collection = await loadCollection(fixtureRoot);

		expect(collection.sources).toHaveLength(2);
		expect(collection.cards).toHaveLength(4);
		expect(collection.assets).toHaveLength(1);
		expect(collection.deckTree).toEqual([
			{
				path: 'example',
				name: 'Example',
				cardCount: 2,
				totalCardCount: 4,
				children: [
					{
						path: 'example/math',
						name: 'Math',
						cardCount: 0,
						totalCardCount: 2,
						children: [
							{
								path: 'example/math/algebra',
								name: 'Algebra',
								cardCount: 2,
								totalCardCount: 2,
								children: []
							}
						]
					}
				]
			}
		]);
	});
});
