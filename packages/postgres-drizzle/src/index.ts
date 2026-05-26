import { and, asc, eq, inArray, not, sql } from 'drizzle-orm';
import { buildReviewQueue, scheduleReview, type Card, type CardPerformance, type Grade } from '@mdsrs/core';
import {
	CardNotFoundError,
	type CardStats,
	type SrsStore,
	type StoredCard,
	type StoredReview
} from '@mdsrs/store';
import {
	schema,
	srsCards,
	srsReviews,
	type SrsCardRow,
	type SrsReviewRow,
	type NewSrsReviewRow
} from './schema.js';

export { mdsrsCards, mdsrsReviews, schema, srsCards, srsReviews } from './schema.js';
export type {
	MdsrsCardRow,
	MdsrsReviewRow,
	NewMdsrsCardRow,
	NewMdsrsReviewRow,
	NewSrsCardRow,
	NewSrsReviewRow,
	SrsCardRow,
	SrsReviewRow
} from './schema.js';

export interface DrizzlePostgresDatabase {
	select: (fields?: unknown) => unknown;
	insert: (table: unknown) => unknown;
	update: (table: unknown) => unknown;
}

export const createPostgresDrizzleStore = (db: DrizzlePostgresDatabase): SrsStore => ({
	async syncCards(cards: Card[], syncedAt = new Date()) {
		const database = db as DrizzleDb;
		if (cards.length === 0) {
			await database.update(srsCards).set({ active: false });
			return;
		}

		const cardHashes = cards.map((card) => card.hash);

		await database
			.insert(srsCards)
			.values(
				cards.map((card) => ({
					cardHash: card.hash,
					deckName: card.deckName,
					filePath: card.filePath,
					familyHash: card.familyHash,
					frontMarkdown: card.frontMarkdown,
					backMarkdown: card.backMarkdown,
					cardType: card.content.type,
					active: true,
					addedAt: syncedAt,
					lastSeenAt: syncedAt
				}))
			)
			.onConflictDoUpdate({
				target: srsCards.cardHash,
				set: {
					deckName: sql`excluded.deck_name`,
					filePath: sql`excluded.file_path`,
					familyHash: sql`excluded.family_hash`,
					frontMarkdown: sql`excluded.front_markdown`,
					backMarkdown: sql`excluded.back_markdown`,
					cardType: sql`excluded.card_type`,
					active: true,
					lastSeenAt: syncedAt
				}
			});

		await database
			.update(srsCards)
			.set({ active: false })
			.where(not(inArray(srsCards.cardHash, cardHashes)));
	},

	async getCards(cardHashes?: string[]) {
		const database = db as DrizzleDb;
		const query = database.select().from(srsCards);
		const rows = (
			cardHashes && cardHashes.length > 0
				? await query.where(inArray(srsCards.cardHash, cardHashes))
				: await query
		) as SrsCardRow[];

		return new Map(rows.map((row) => [row.cardHash, rowToStoredCard(row)]));
	},

	async getPerformances(cardHashes: string[]) {
		if (cardHashes.length === 0) return new Map<string, CardPerformance>();

		const database = db as DrizzleDb;
		const rows = (await database
			.select()
			.from(srsCards)
			.where(
				and(inArray(srsCards.cardHash, cardHashes), eq(srsCards.active, true))
			)) as SrsCardRow[];

		return new Map(rows.map((row) => [row.cardHash, rowToPerformance(row)]));
	},

	async getDueCards(cards: Card[], options = {}) {
		const activeCards = await this.getCards(cards.map((card) => card.hash));
		const syncedCards = cards.filter((card) => activeCards.get(card.hash)?.active);
		const performances = await this.getPerformances(syncedCards.map((card) => card.hash));

		return buildReviewQueue(syncedCards, performances, options);
	},

	async reviewCard(cardHash: string, grade: Grade, reviewedAt = new Date()) {
		const database = db as DrizzleDb;
		const rows = (await database
			.select()
			.from(srsCards)
			.where(and(eq(srsCards.cardHash, cardHash), eq(srsCards.active, true)))
			.limit(1)) as SrsCardRow[];
		const row = rows[0];
		if (!row) throw new CardNotFoundError(cardHash);

		const result = scheduleReview(rowToPerformance(row), grade, reviewedAt);
		const reviewedAtDate = new Date(result.lastReviewedAt);

		await database
			.update(srsCards)
			.set({
				lastReviewedAt: reviewedAtDate,
				stability: result.stability,
				difficulty: result.difficulty,
				intervalRaw: result.intervalRaw,
				intervalDays: result.intervalDays,
				dueDate: result.dueDate,
				reviewCount: result.reviewCount
			})
			.where(eq(srsCards.cardHash, cardHash));

		const review: NewSrsReviewRow = {
			reviewCardHash: cardHash,
			reviewedAt: reviewedAtDate,
			grade,
			stability: result.stability,
			difficulty: result.difficulty,
			intervalRaw: result.intervalRaw,
			intervalDays: result.intervalDays,
			dueDate: result.dueDate
		};

		await database.insert(srsReviews).values(review);

		return result;
	},

	async getReviews(cardHashes?: string[]) {
		const database = db as DrizzleDb;
		const query = database.select().from(srsReviews);
		const filtered =
			cardHashes && cardHashes.length > 0
				? query.where(inArray(srsReviews.reviewCardHash, cardHashes))
				: query;
		const rows = (
			await filtered.orderBy(asc(srsReviews.reviewedAt), asc(srsReviews.reviewId))
		) as SrsReviewRow[];

		return rows.map(rowToStoredReview);
	},

	async getCardStats(cardHashes: string[]) {
		if (cardHashes.length === 0) return new Map<string, CardStats>();

		const database = db as DrizzleDb;
		const rows = await database
			.select({
				cardHash: srsCards.cardHash,
				reviewCount: srsCards.reviewCount,
				difficulty: srsCards.difficulty,
				stability: srsCards.stability,
				intervalDays: srsCards.intervalDays,
				dueDate: srsCards.dueDate,
				lastReviewedAt: srsCards.lastReviewedAt,
				active: srsCards.active,
				forgotCount: sql<number>`count(*) filter (where ${srsReviews.grade} = 'forgot')`,
				hardCount: sql<number>`count(*) filter (where ${srsReviews.grade} = 'hard')`,
				goodCount: sql<number>`count(*) filter (where ${srsReviews.grade} = 'good')`,
				easyCount: sql<number>`count(*) filter (where ${srsReviews.grade} = 'easy')`
			})
			.from(srsCards)
			.leftJoin(srsReviews, eq(srsReviews.reviewCardHash, srsCards.cardHash))
			.where(inArray(srsCards.cardHash, cardHashes))
			.groupBy(
				srsCards.cardHash,
				srsCards.reviewCount,
				srsCards.difficulty,
				srsCards.stability,
				srsCards.intervalDays,
				srsCards.dueDate,
				srsCards.lastReviewedAt,
				srsCards.active
			);

		return new Map(rows.map((row) => [row.cardHash, statsRowToCardStats(row)]));
	}
});

type DrizzleDb = {
	select: (fields?: unknown) => SelectQuery;
	insert: (table: unknown) => InsertQuery;
	update: (table: unknown) => UpdateQuery;
};

type SelectQuery<Row = unknown> = Promise<Row[]> & {
	from: <NextRow = Row>(table: unknown) => SelectQuery<NextRow>;
	where: (condition: unknown) => SelectQuery<Row>;
	limit: (limit: number) => SelectQuery<Row>;
	leftJoin: (table: unknown, condition: unknown) => SelectQuery<Row>;
	orderBy: (...columns: unknown[]) => SelectQuery<Row>;
	groupBy: (...columns: unknown[]) => Promise<StatsRow[]>;
};

type InsertQuery = {
	values: (values: unknown) => InsertQuery;
	onConflictDoUpdate: (config: unknown) => Promise<unknown>;
	then: Promise<unknown>['then'];
};

type UpdateQuery = {
	set: (values: unknown) => UpdateQuery;
	where: (condition: unknown) => Promise<unknown>;
};

export const rowToPerformance = (row: Pick<SrsCardRow, 'lastReviewedAt' | 'stability' | 'difficulty' | 'intervalRaw' | 'intervalDays' | 'dueDate' | 'reviewCount'>): CardPerformance => ({
	lastReviewedAt: toIsoString(row.lastReviewedAt),
	stability: row.stability,
	difficulty: row.difficulty,
	intervalRaw: row.intervalRaw,
	intervalDays: row.intervalDays,
	dueDate: row.dueDate,
	reviewCount: row.reviewCount
});

export const rowToStoredCard = (row: SrsCardRow): StoredCard => ({
	cardHash: row.cardHash,
	deckName: row.deckName,
	filePath: row.filePath,
	familyHash: row.familyHash,
	frontMarkdown: row.frontMarkdown,
	backMarkdown: row.backMarkdown,
	cardType: row.cardType === 'cloze' ? 'cloze' : 'basic',
	active: row.active,
	addedAt: toIsoString(row.addedAt) ?? new Date(0).toISOString(),
	lastSeenAt: toIsoString(row.lastSeenAt) ?? new Date(0).toISOString(),
	performance: rowToPerformance(row)
});

export const rowToStoredReview = (row: SrsReviewRow): StoredReview => ({
	reviewId: row.reviewId,
	cardHash: row.reviewCardHash,
	reviewedAt: toIsoString(row.reviewedAt) ?? new Date(0).toISOString(),
	grade: toGrade(row.grade),
	stability: row.stability,
	difficulty: row.difficulty,
	intervalRaw: row.intervalRaw,
	intervalDays: row.intervalDays,
	dueDate: row.dueDate
});

interface StatsRow {
	cardHash: string;
	reviewCount: number;
	difficulty: number | null;
	stability: number | null;
	intervalDays: number | null;
	dueDate: string | null;
	lastReviewedAt: Date | string | null;
	active: boolean;
	forgotCount: number | string | bigint;
	hardCount: number | string | bigint;
	goodCount: number | string | bigint;
	easyCount: number | string | bigint;
}

export const statsRowToCardStats = (row: StatsRow): CardStats => {
	const forgotCount = Number(row.forgotCount);
	const hardCount = Number(row.hardCount);
	const goodCount = Number(row.goodCount);
	const easyCount = Number(row.easyCount);
	const hitCount = hardCount + goodCount + easyCount;

	return {
		cardHash: row.cardHash,
		reviewCount: row.reviewCount,
		forgotCount,
		hardCount,
		goodCount,
		easyCount,
		hitRate: row.reviewCount === 0 ? null : hitCount / row.reviewCount,
		missRate: row.reviewCount === 0 ? null : forgotCount / row.reviewCount,
		difficulty: row.difficulty,
		stability: row.stability,
		intervalDays: row.intervalDays,
		dueDate: row.dueDate,
		lastReviewedAt: toIsoString(row.lastReviewedAt),
		active: row.active
	};
};

const toIsoString = (value: Date | string | null): string | null =>
	value instanceof Date ? value.toISOString() : value;

const toGrade = (value: string): Grade => {
	if (value === 'forgot' || value === 'hard' || value === 'good' || value === 'easy') return value;
	throw new Error(`Invalid review grade in database: ${value}`);
};

export const migrations = {
	initial: new URL('../migrations/0000_initial.sql', import.meta.url)
};
