import { describe, expect, it } from 'vitest';
import {
	buildDeckTree,
	buildReviewQueue,
	hashCardContent,
	hashCardFamily,
	MdsrsParseError,
	parseCollection,
	parseDeck,
	scheduleReview,
	type CardPerformance
} from './index.js';

const source = {
	deckName: 'Example',
	filePath: 'example/index.md',
	folderPath: 'example',
	nodePath: 'example',
	displayName: 'Example',
	text: [
		'Q: What?',
		'A: This.',
		'',
		'---',
		'',
		'C: An [agonist] [activates it]',
		''
	].join('\n')
};

describe('hashing', () => {
	it('uses stable content hashes for basic and cloze cards', () => {
		expect(hashCardContent({ type: 'basic', question: 'What?', answer: 'This.' })).toBe(
			'fb2cdc69ca424b52ef4ae9229a648961790ca5603d50859a4624d2f9220cd69e'
		);
		expect(
			hashCardContent({
				type: 'cloze',
				text: 'An agonist activates it',
				start: 0,
				end: 7
			})
		).toBe('7f02519d8be18fc6857cd80f419403d12f8326d5d576ebedab4db8bc008b4d8d');
		expect(hashCardFamily({ type: 'cloze', text: 'An agonist activates it', start: 0, end: 7 })).toBe(
			'8a9b06f66f5616fdb3ba7fab1d869571edb94b70542b113236fd5098fa0616ad'
		);
	});
});

describe('parseDeck', () => {
	it('parses basic cards and expands each cloze deletion into a sibling card', () => {
		const cards = parseDeck(source);

		expect(cards).toHaveLength(3);
		expect(cards.map((card) => card.hash)).toEqual([
			'9933cc49e0c0e331c53ea75d9f74d012f04e20e0d1d4bdd268ce1c04236821b1',
			'b5a7b3889cf2c16747ce11ce6b49e4cdcb5f95411fb4adf9615963912b36b6a1',
			'fb2cdc69ca424b52ef4ae9229a648961790ca5603d50859a4624d2f9220cd69e'
		]);
		expect(cards[0]?.frontMarkdown).toBe('An [...] activates it');
		expect(cards[0]?.backMarkdown).toBe('An **agonist** activates it');
		expect(cards[1]?.frontMarkdown).toBe('An agonist [...]');
		expect(cards[1]?.familyHash).toBe(cards[0]?.familyHash);
		expect(cards[2]?.frontMarkdown).toBe('What?');
		expect(cards[2]?.backMarkdown).toBe('This.');
	});

	it('deduplicates repeated content across a collection', () => {
		expect(parseCollection([source, { ...source, filePath: 'copy.md' }])).toHaveLength(3);
	});

	it('reports line-numbered parse errors', () => {
		expect(() =>
			parseDeck({
				deckName: 'Broken',
				filePath: 'broken.md',
				text: 'Q: Missing answer'
			})
		).toThrow(MdsrsParseError);
	});

	it('does not inject markdown emphasis into cloze answers inside inline math', () => {
		const [card] = parseDeck({
			deckName: 'Math',
			filePath: 'math.md',
			text: 'C: Euler identity says $e^{i\\pi} + [1] = 0$.'
		});

		expect(card?.frontMarkdown).toBe('Euler identity says $e^{i\\pi} + [...] = 0$.');
		expect(card?.backMarkdown).toBe('Euler identity says $e^{i\\pi} + 1 = 0$.');
	});
});

describe('buildDeckTree', () => {
	it('builds direct and recursive card counts from node paths', () => {
		const cards = parseCollection([
			source,
			{
				...source,
				deckName: 'Chapter',
				filePath: 'example/chapter.md',
				nodePath: 'example/chapter',
				displayName: 'Chapter',
				text: 'Q: One?\nA: Two.'
			}
		]);
		const tree = buildDeckTree(cards);

		expect(tree).toEqual([
			{
				path: 'example',
				name: 'Example',
				cardCount: 3,
				totalCardCount: 4,
				children: [
					{
						path: 'example/chapter',
						name: 'Chapter',
						cardCount: 1,
						totalCardCount: 1,
						children: []
					}
				]
			}
		]);
	});
});

describe('scheduleReview', () => {
	it('is deterministic for a given prior performance, grade, and review time', () => {
		const reviewedAt = new Date('2026-01-02T03:04:05.000Z');
		const first = scheduleReview(null, 'good', reviewedAt);
		const second = scheduleReview(first, 'easy', new Date('2026-01-03T03:04:05.000Z'));

		expect(first).toMatchObject({
			grade: 'good',
			lastReviewedAt: '2026-01-02T03:04:05.000Z',
			intervalDays: 3,
			dueDate: '2026-01-05',
			reviewCount: 1
		});
		expect(second.intervalDays).toBe(26);
		expect(second.dueDate).toBe('2026-01-29');
		expect(second.reviewCount).toBe(2);
	});
});

describe('buildReviewQueue', () => {
	it('orders new and due cards deterministically and buries cloze siblings by default', () => {
		const cards = parseDeck(source);
		const performances = new Map<string, CardPerformance>([
			[
				cards[2]?.hash ?? '',
				{
					lastReviewedAt: '2025-01-01T00:00:00.000Z',
					stability: 1,
					difficulty: 5,
					intervalRaw: 1,
					intervalDays: 1,
					dueDate: '2025-01-02',
					reviewCount: 1
				}
			]
		]);

		const queue = buildReviewQueue(cards, performances, {
			now: new Date('2026-01-01T00:00:00.000Z')
		});

		expect(queue.map((item) => item.card.hash)).toEqual([
			cards[0]?.hash,
			cards[2]?.hash
		]);
		expect(buildReviewQueue(cards, performances, { burySiblings: false })).toHaveLength(3);
	});
});
