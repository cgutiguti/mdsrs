import { isDue, toDateString } from './schedule.js';
import type { Card, CardPerformance, ReviewQueueItem } from './types.js';

export interface BuildReviewQueueOptions {
	now?: Date;
	limit?: number;
	burySiblings?: boolean;
	deckName?: string;
}

export const buildReviewQueue = (
	cards: Card[],
	performances: ReadonlyMap<string, CardPerformance>,
	options: BuildReviewQueueOptions = {}
): ReviewQueueItem[] => {
	const now = options.now ?? new Date();
	const seenFamilies = new Set<string>();
	const today = toDateString(now);
	const dueCards = cards
		.filter((card) => options.deckName == null || card.deckName === options.deckName)
		.map((card) => ({ card, performance: performances.get(card.hash) ?? null }))
		.filter((item) => isDue(item.performance, now))
		.sort(compareQueueItems(today));

	const queue: ReviewQueueItem[] = [];
	for (const item of dueCards) {
		const familyHash = item.card.familyHash;
		if (options.burySiblings !== false && familyHash) {
			if (seenFamilies.has(familyHash)) continue;
			seenFamilies.add(familyHash);
		}
		queue.push(item);
		if (options.limit != null && queue.length >= options.limit) break;
	}

	return queue;
};

const compareQueueItems = (today: string) => (left: ReviewQueueItem, right: ReviewQueueItem) => {
	const leftDue = left.performance?.dueDate ?? '';
	const rightDue = right.performance?.dueDate ?? '';

	if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
	if ((left.performance?.reviewCount ?? 0) !== (right.performance?.reviewCount ?? 0)) {
		return (left.performance?.reviewCount ?? 0) - (right.performance?.reviewCount ?? 0);
	}
	if ((left.performance?.dueDate == null ? today : left.performance.dueDate) !==
		(right.performance?.dueDate == null ? today : right.performance.dueDate)) {
		return (left.performance?.dueDate ?? today).localeCompare(right.performance?.dueDate ?? today);
	}
	return left.card.hash.localeCompare(right.card.hash);
};

