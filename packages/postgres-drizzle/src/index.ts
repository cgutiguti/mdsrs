import { and, eq, inArray, not, sql } from 'drizzle-orm';
import { buildReviewQueue, scheduleReview, type Card, type CardPerformance, type Grade } from '@mdsrs/core';
import {
	CardNotFoundError,
	type CardStats,
	type SrsStore,
	type StoredCard,
	type StoredReview
} from '@mdsrs/store';
import {
	mdsrsCards,
	mdsrsReviews,
	schema,
	type MdsrsCardRow,
	type MdsrsReviewRow,
	type NewMdsrsReviewRow
} from './schema.js';

export { mdsrsCards, mdsrsReviews, schema } from './schema.js';
export type { MdsrsCardRow, MdsrsReviewRow, NewMdsrsCardRow, NewMdsrsReviewRow } from './schema.js';

export interface DrizzlePostgresDatabase {
	select: (fields?: unknown) => unknown;
	insert: (table: unknown) => unknown;
	update: (table: unknown) => unknown;
}

export const createPostgresDrizzleStore = (db: DrizzlePostgresDatabase): SrsStore => ({
	async syncCards(cards: Card[], syncedAt = new Date()) {
		const database = db as DrizzleDb;
		if (cards.length === 0) {
			await database.update(mdsrsCards).set({ active: false });
			return;
		}

		const cardHashes = cards.map((card) => card.hash);

		await database
			.insert(mdsrsCards)
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
					lastSeenAt: syncedAt
				}))
			)
			.onConflictDoUpdate({
				target: mdsrsCards.cardHash,
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
			.update(mdsrsCards)
			.set({ active: false })
			.where(not(inArray(mdsrsCards.cardHash, cardHashes)));
	},

	async getCards(cardHashes?: string[]) {
		const database = db as DrizzleDb;
		const query = database.select().from(mdsrsCards);
		const rows = (
			cardHashes && cardHashes.length > 0
				? await query.where(inArray(mdsrsCards.cardHash, cardHashes))
				: await query
		) as MdsrsCardRow[];

		return new Map(rows.map((row) => [row.cardHash, rowToStoredCard(row)]));
	},

	async getPerformances(cardHashes: string[]) {
		if (cardHashes.length === 0) return new Map<string, CardPerformance>();

		const database = db as DrizzleDb;
		const rows = (await database
			.select()
			.from(mdsrsCards)
			.where(
				and(inArray(mdsrsCards.cardHash, cardHashes), eq(mdsrsCards.active, true))
			)) as MdsrsCardRow[];

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
			.from(mdsrsCards)
			.where(and(eq(mdsrsCards.cardHash, cardHash), eq(mdsrsCards.active, true)))
			.limit(1)) as MdsrsCardRow[];
		const row = rows[0];
		if (!row) throw new CardNotFoundError(cardHash);

		const result = scheduleReview(rowToPerformance(row), grade, reviewedAt);
		const reviewedAtDate = new Date(result.lastReviewedAt);

		await database
			.update(mdsrsCards)
			.set({
				lastReviewedAt: reviewedAtDate,
				stability: result.stability,
				difficulty: result.difficulty,
				intervalRaw: result.intervalRaw,
				intervalDays: result.intervalDays,
				dueDate: result.dueDate,
				reviewCount: result.reviewCount
			})
			.where(eq(mdsrsCards.cardHash, cardHash));

		const review: NewMdsrsReviewRow = {
			reviewCardHash: cardHash,
			reviewedAt: reviewedAtDate,
			grade,
			stability: result.stability,
			difficulty: result.difficulty,
			intervalRaw: result.intervalRaw,
			intervalDays: result.intervalDays,
			dueDate: result.dueDate
		};

		await database.insert(mdsrsReviews).values(review);

		return result;
	},

	async getReviews(cardHashes?: string[]) {
		const database = db as DrizzleDb;
		const query = database.select().from(mdsrsReviews);
		const rows = (
			cardHashes && cardHashes.length > 0
				? await query.where(inArray(mdsrsReviews.reviewCardHash, cardHashes))
				: await query
		) as MdsrsReviewRow[];

		return rows.map(rowToStoredReview);
	},

	async getCardStats(cardHashes: string[]) {
		if (cardHashes.length === 0) return new Map<string, CardStats>();

		const database = db as DrizzleDb;
		const rows = await database
			.select({
				cardHash: mdsrsCards.cardHash,
				reviewCount: mdsrsCards.reviewCount,
				difficulty: mdsrsCards.difficulty,
				stability: mdsrsCards.stability,
				intervalDays: mdsrsCards.intervalDays,
				dueDate: mdsrsCards.dueDate,
				lastReviewedAt: mdsrsCards.lastReviewedAt,
				active: mdsrsCards.active,
				forgotCount: sql<number>`count(*) filter (where ${mdsrsReviews.grade} = 'forgot')`,
				hardCount: sql<number>`count(*) filter (where ${mdsrsReviews.grade} = 'hard')`,
				goodCount: sql<number>`count(*) filter (where ${mdsrsReviews.grade} = 'good')`,
				easyCount: sql<number>`count(*) filter (where ${mdsrsReviews.grade} = 'easy')`
			})
			.from(mdsrsCards)
			.leftJoin(mdsrsReviews, eq(mdsrsReviews.reviewCardHash, mdsrsCards.cardHash))
			.where(inArray(mdsrsCards.cardHash, cardHashes))
			.groupBy(
				mdsrsCards.cardHash,
				mdsrsCards.reviewCount,
				mdsrsCards.difficulty,
				mdsrsCards.stability,
				mdsrsCards.intervalDays,
				mdsrsCards.dueDate,
				mdsrsCards.lastReviewedAt,
				mdsrsCards.active
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

export const rowToPerformance = (row: Pick<MdsrsCardRow, 'lastReviewedAt' | 'stability' | 'difficulty' | 'intervalRaw' | 'intervalDays' | 'dueDate' | 'reviewCount'>): CardPerformance => ({
	lastReviewedAt: toIsoString(row.lastReviewedAt),
	stability: row.stability,
	difficulty: row.difficulty,
	intervalRaw: row.intervalRaw,
	intervalDays: row.intervalDays,
	dueDate: row.dueDate,
	reviewCount: row.reviewCount
});

export const rowToStoredCard = (row: MdsrsCardRow): StoredCard => ({
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

export const rowToStoredReview = (row: MdsrsReviewRow): StoredReview => ({
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
