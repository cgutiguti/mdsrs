import {
	buildCollectionStats,
	buildReviewQueue,
	scheduleReview,
	toDateString,
	toTimestamp,
	type BuildReviewQueueOptions,
	type BuildCollectionStatsOptions,
	type Card,
	type CardPerformance,
	type CollectionStats,
	type DeckTreeNode,
	type Grade,
	type ReviewQueueItem,
	type ReviewResult
} from '@mdsrs/core';

export interface StoredCard {
	cardHash: string;
	deckName: string;
	filePath: string;
	familyHash: string | null;
	frontMarkdown: string;
	backMarkdown: string;
	cardType: Card['content']['type'];
	active: boolean;
	addedAt: string;
	lastSeenAt: string;
	performance: CardPerformance;
}

export interface StoredReview {
	reviewId: number;
	cardHash: string;
	reviewedAt: string;
	grade: Grade;
	stability: number;
	difficulty: number;
	intervalRaw: number;
	intervalDays: number;
	dueDate: string;
}

export interface CardStats {
	cardHash: string;
	reviewCount: number;
	forgotCount: number;
	hardCount: number;
	goodCount: number;
	easyCount: number;
	hitRate: number | null;
	missRate: number | null;
	difficulty: number | null;
	stability: number | null;
	intervalDays: number | null;
	dueDate: string | null;
	lastReviewedAt: string | null;
	active: boolean;
}

export interface SrsStore {
	syncCards(cards: Card[], syncedAt?: Date): Promise<void>;
	getCards(cardHashes?: string[]): Promise<Map<string, StoredCard>>;
	getPerformances(cardHashes: string[]): Promise<Map<string, CardPerformance>>;
	getDueCards(cards: Card[], options?: BuildReviewQueueOptions): Promise<ReviewQueueItem[]>;
	reviewCard(cardHash: string, grade: Grade, reviewedAt?: Date): Promise<ReviewResult>;
	getReviews(cardHashes?: string[]): Promise<StoredReview[]>;
	getCardStats(cardHashes: string[]): Promise<Map<string, CardStats>>;
}

export const getCollectionStats = async (
	store: SrsStore,
	cards: Card[],
	deckTree: DeckTreeNode[],
	options: BuildCollectionStatsOptions = {}
): Promise<CollectionStats> => {
	const cardHashes = cards.map((card) => card.hash);
	const [storedCards, reviews] = await Promise.all([
		store.getCards(cardHashes),
		store.getReviews(cardHashes)
	]);

	return buildCollectionStats(
		cards,
		deckTree,
		[...storedCards.values()].map((card) => ({
			cardHash: card.cardHash,
			active: card.active,
			addedAt: card.addedAt,
			dueDate: card.performance.dueDate
		})),
		reviews.map((review) => ({
			cardHash: review.cardHash,
			reviewedAt: review.reviewedAt,
			grade: review.grade
		})),
		options
	);
};

export interface MemoryStoreSnapshot {
	cards: StoredCard[];
	reviews: StoredReview[];
	nextReviewId: number;
}

export class CardNotFoundError extends Error {
	constructor(readonly cardHash: string) {
		super(`Card is not synced: ${cardHash}`);
	}
}

export const createMemoryStore = (snapshot?: Partial<MemoryStoreSnapshot>): SrsStore & {
	snapshot(): MemoryStoreSnapshot;
} => {
	const cards = new Map<string, StoredCard>(
		(snapshot?.cards ?? []).map((card) => [card.cardHash, cloneStoredCard(card)])
	);
	const reviews = (snapshot?.reviews ?? []).map(cloneStoredReview);
	let nextReviewId =
		snapshot?.nextReviewId ??
		reviews.reduce((next, review) => Math.max(next, review.reviewId + 1), 1);

	const store = {
		async syncCards(sourceCards: Card[], syncedAt = new Date()) {
			const lastSeenAt = toTimestamp(syncedAt);
			const seenHashes = new Set<string>();

			for (const card of sourceCards) {
				seenHashes.add(card.hash);
				const existing = cards.get(card.hash);
				const addedAt = existing?.addedAt ?? lastSeenAt;

				cards.set(card.hash, {
					cardHash: card.hash,
					deckName: card.deckName,
					filePath: card.filePath,
					familyHash: card.familyHash,
					frontMarkdown: card.frontMarkdown,
					backMarkdown: card.backMarkdown,
					cardType: card.content.type,
					active: true,
					addedAt,
					lastSeenAt,
					performance: existing?.performance
						? clonePerformance(existing.performance)
						: emptyPerformance()
				});
			}

			for (const [cardHash, card] of cards) {
				if (!seenHashes.has(cardHash)) {
					cards.set(cardHash, {
						...card,
						active: false
					});
				}
			}
		},

		async getCards(cardHashes?: string[]) {
			const wanted = cardHashes ? new Set(cardHashes) : null;
			return new Map(
				[...cards.entries()]
					.filter(([cardHash]) => wanted == null || wanted.has(cardHash))
					.map(([cardHash, card]) => [cardHash, cloneStoredCard(card)])
			);
		},

		async getPerformances(cardHashes: string[]) {
			const performances = new Map<string, CardPerformance>();
			for (const cardHash of cardHashes) {
				const card = cards.get(cardHash);
				if (card?.active) performances.set(cardHash, clonePerformance(card.performance));
			}
			return performances;
		},

		async getDueCards(sourceCards: Card[], options: BuildReviewQueueOptions = {}) {
			const activeHashes = new Set(
				[...cards.values()].filter((card) => card.active).map((card) => card.cardHash)
			);
			const syncedCards = sourceCards.filter((card) => activeHashes.has(card.hash));
			const performances = await this.getPerformances(syncedCards.map((card) => card.hash));

			return buildReviewQueue(syncedCards, performances, options);
		},

		async reviewCard(cardHash: string, grade: Grade, reviewedAt = new Date()) {
			const card = cards.get(cardHash);
			if (!card?.active) throw new CardNotFoundError(cardHash);

			const result = scheduleReview(card.performance, grade, reviewedAt);
			const performance = reviewResultToPerformance(result);
			cards.set(cardHash, {
				...card,
				performance
			});
			reviews.push({
				reviewId: nextReviewId++,
				cardHash,
				reviewedAt: result.lastReviewedAt,
				grade,
				stability: result.stability,
				difficulty: result.difficulty,
				intervalRaw: result.intervalRaw,
				intervalDays: result.intervalDays,
				dueDate: result.dueDate
			});

			return result;
		},

		async getReviews(cardHashes?: string[]) {
			const wanted = cardHashes ? new Set(cardHashes) : null;
			return reviews
				.filter((review) => wanted == null || wanted.has(review.cardHash))
				.map(cloneStoredReview);
		},

		async getCardStats(cardHashes: string[]) {
			const stats = new Map<string, CardStats>();
			for (const cardHash of cardHashes) {
				const card = cards.get(cardHash);
				if (!card) continue;
				const cardReviews = reviews.filter((review) => review.cardHash === cardHash);
				const forgotCount = countGrade(cardReviews, 'forgot');
				const hardCount = countGrade(cardReviews, 'hard');
				const goodCount = countGrade(cardReviews, 'good');
				const easyCount = countGrade(cardReviews, 'easy');
				const hitCount = hardCount + goodCount + easyCount;
				const reviewCount = card.performance.reviewCount;

				stats.set(cardHash, {
					cardHash,
					reviewCount,
					forgotCount,
					hardCount,
					goodCount,
					easyCount,
					hitRate: reviewCount === 0 ? null : hitCount / reviewCount,
					missRate: reviewCount === 0 ? null : forgotCount / reviewCount,
					difficulty: card.performance.difficulty,
					stability: card.performance.stability,
					intervalDays: card.performance.intervalDays,
					dueDate: card.performance.dueDate,
					lastReviewedAt: card.performance.lastReviewedAt,
					active: card.active
				});
			}

			return stats;
		},

		snapshot() {
			return {
				cards: [...cards.values()].map(cloneStoredCard),
				reviews: reviews.map(cloneStoredReview),
				nextReviewId
			};
		}
	};

	return store;
};

const emptyPerformance = (): CardPerformance => ({
	lastReviewedAt: null,
	stability: null,
	difficulty: null,
	intervalRaw: null,
	intervalDays: null,
	dueDate: null,
	reviewCount: 0
});

const reviewResultToPerformance = (result: ReviewResult): CardPerformance => ({
	lastReviewedAt: result.lastReviewedAt,
	stability: result.stability,
	difficulty: result.difficulty,
	intervalRaw: result.intervalRaw,
	intervalDays: result.intervalDays,
	dueDate: result.dueDate,
	reviewCount: result.reviewCount
});

const clonePerformance = (performance: CardPerformance): CardPerformance => ({
	...performance
});

const cloneStoredCard = (card: StoredCard): StoredCard => ({
	...card,
	performance: clonePerformance(card.performance)
});

const cloneStoredReview = (review: StoredReview): StoredReview => ({
	...review
});

const countGrade = (reviews: StoredReview[], grade: Grade) =>
	reviews.filter((review) => review.grade === grade).length;

export const isOverdue = (performance: Pick<CardPerformance, 'dueDate'>, now = new Date()) =>
	performance.dueDate != null && performance.dueDate < toDateString(now);
