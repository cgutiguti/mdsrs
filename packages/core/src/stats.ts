import { toDateString } from './schedule.js';
import type { Card, DeckTreeNode, Grade } from './types.js';

export interface CollectionCardState {
	cardHash: string;
	active?: boolean;
	addedAt?: Date | string | null;
	dueDate: string | null;
}

export interface CollectionReviewState {
	cardHash: string;
	reviewedAt: Date | string;
	grade: Grade | string;
}

export interface DeckStats {
	path: string;
	name: string;
	cardCount: number;
	totalCardCount: number;
	activeCards: number;
	dueCards: number;
	overdueCards: number;
	newCards: number;
	cardsAddedLast7Days: number;
	reviewsLast7Days: number;
	hitRateLast30Days: number | null;
	children: DeckStats[];
}

export interface CollectionStats {
	totalCards: number;
	activeCards: number;
	dueCards: number;
	overdueCards: number;
	newCards: number;
	cardsAddedLast7Days: number;
	reviewsToday: number;
	reviewsLast7Days: number;
	reviewActiveDaysLast14: number;
	hitRateLast30Days: number | null;
	daysSinceLastReview: number | null;
	decks: DeckStats[];
}

export interface BuildCollectionStatsOptions {
	now?: Date;
}

const dayMs = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) =>
	new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const daysBetween = (left: Date, right: Date) =>
	Math.max(0, Math.floor((startOfDay(left).getTime() - startOfDay(right).getTime()) / dayMs));

const hitRate = (reviews: CollectionReviewState[]) => {
	if (reviews.length === 0) return null;
	const hits = reviews.filter((review) => review.grade !== 'forgot').length;
	return hits / reviews.length;
};

export const buildCollectionStats = (
	cards: Card[],
	deckTree: DeckTreeNode[],
	cardStates: CollectionCardState[],
	reviews: CollectionReviewState[],
	options: BuildCollectionStatsOptions = {}
): CollectionStats => {
	const now = options.now ?? new Date();
	const today = toDateString(now);
	const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
	const fourteenDaysAgo = new Date(now.getTime() - 14 * dayMs);
	const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);
	const cardStateByHash = new Map(cardStates.map((card) => [card.cardHash, card]));
	const hasCardStates = cardStateByHash.size > 0;
	const activeCards = cards.filter((card) => isActiveCard(card, cardStateByHash, hasCardStates));
	const activeCardHashes = new Set(activeCards.map((card) => card.hash));
	const dueCards = activeCards.filter((card) => isDueCard(card, cardStateByHash, hasCardStates, today));
	const overdueCards = activeCards.filter((card) => isOverdueCard(card, cardStateByHash, today));
	const newCards = activeCards.filter((card) => isNewCard(card, cardStateByHash, hasCardStates));
	const cardsAddedLast7Days = activeCards.filter((card) =>
		wasAddedSince(card, cardStateByHash, hasCardStates, sevenDaysAgo)
	);
	const activeReviews = reviews.filter((review) => activeCardHashes.has(review.cardHash));
	const reviewsToday = activeReviews.filter(
		(review) => toDate(review.reviewedAt).toISOString().slice(0, 10) === today
	);
	const reviewsLast7Days = activeReviews.filter((review) => toDate(review.reviewedAt) >= sevenDaysAgo);
	const reviewsLast14Days = activeReviews.filter(
		(review) => toDate(review.reviewedAt) >= fourteenDaysAgo
	);
	const reviewsLast30Days = activeReviews.filter(
		(review) => toDate(review.reviewedAt) >= thirtyDaysAgo
	);
	const activeDays = new Set(
		reviewsLast14Days.map((review) => toDate(review.reviewedAt).toISOString().slice(0, 10))
	);
	const lastReview = activeReviews
		.map((review) => toDate(review.reviewedAt))
		.sort((left, right) => right.getTime() - left.getTime())[0];

	return {
		totalCards: cards.length,
		activeCards: activeCards.length,
		dueCards: dueCards.length,
		overdueCards: overdueCards.length,
		newCards: newCards.length,
		cardsAddedLast7Days: cardsAddedLast7Days.length,
		reviewsToday: reviewsToday.length,
		reviewsLast7Days: reviewsLast7Days.length,
		reviewActiveDaysLast14: activeDays.size,
		hitRateLast30Days: hitRate(reviewsLast30Days),
		daysSinceLastReview: lastReview ? daysBetween(now, lastReview) : null,
		decks: buildDeckStats(deckTree, cards, cardStateByHash, activeReviews, hasCardStates, now)
	};
};

const isActiveCard = (
	card: Card,
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	hasCardStates: boolean
) => {
	if (!hasCardStates) return true;
	return cardStateByHash.get(card.hash)?.active !== false && cardStateByHash.has(card.hash);
};

const isDueCard = (
	card: Card,
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	hasCardStates: boolean,
	today: string
) => {
	if (!hasCardStates) return true;
	const dueDate = cardStateByHash.get(card.hash)?.dueDate;
	return dueDate == null || dueDate <= today;
};

const isOverdueCard = (
	card: Card,
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	today: string
) => {
	const dueDate = cardStateByHash.get(card.hash)?.dueDate;
	return dueDate != null && dueDate < today;
};

const isNewCard = (
	card: Card,
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	hasCardStates: boolean
) => !hasCardStates || cardStateByHash.get(card.hash)?.dueDate == null;

const wasAddedSince = (
	card: Card,
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	hasCardStates: boolean,
	since: Date
) => {
	if (!hasCardStates) return true;
	const addedAt = cardStateByHash.get(card.hash)?.addedAt;
	return addedAt ? toDate(addedAt) >= since : false;
};

const nodeCardsForStats = (cards: Card[], node: DeckTreeNode) =>
	cards.filter((card) => card.nodePath === node.path || card.nodePath.startsWith(`${node.path}/`));

const buildDeckStats = (
	nodes: DeckTreeNode[],
	cards: Card[],
	cardStateByHash: ReadonlyMap<string, CollectionCardState>,
	reviews: CollectionReviewState[],
	hasCardStates: boolean,
	now: Date
): DeckStats[] => {
	const today = toDateString(now);
	const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);
	const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);
	const reviewsByCard = new Map<string, CollectionReviewState[]>();

	for (const review of reviews) {
		const cardReviews = reviewsByCard.get(review.cardHash) ?? [];
		cardReviews.push(review);
		reviewsByCard.set(review.cardHash, cardReviews);
	}

	return nodes.map((node) => {
		const nodeCards = nodeCardsForStats(cards, node);
		const activeCards = nodeCards.filter((card) => isActiveCard(card, cardStateByHash, hasCardStates));
		const nodeReviews = activeCards.flatMap((card) => reviewsByCard.get(card.hash) ?? []);
		const reviewsLast30Days = nodeReviews.filter((review) => toDate(review.reviewedAt) >= thirtyDaysAgo);

		return {
			path: node.path,
			name: node.name,
			cardCount: node.cardCount,
			totalCardCount: node.totalCardCount,
			activeCards: activeCards.length,
			dueCards: activeCards.filter((card) => isDueCard(card, cardStateByHash, hasCardStates, today))
				.length,
			overdueCards: activeCards.filter((card) => isOverdueCard(card, cardStateByHash, today)).length,
			newCards: activeCards.filter((card) => isNewCard(card, cardStateByHash, hasCardStates)).length,
			cardsAddedLast7Days: activeCards.filter((card) =>
				wasAddedSince(card, cardStateByHash, hasCardStates, sevenDaysAgo)
			).length,
			reviewsLast7Days: nodeReviews.filter((review) => toDate(review.reviewedAt) >= sevenDaysAgo)
				.length,
			hitRateLast30Days: hitRate(reviewsLast30Days),
			children: buildDeckStats(node.children, cards, cardStateByHash, reviews, hasCardStates, now)
		};
	});
};
