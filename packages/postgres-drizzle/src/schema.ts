import {
	bigserial,
	boolean,
	date,
	doublePrecision,
	foreignKey,
	integer,
	pgTable,
	text,
	timestamp
} from 'drizzle-orm/pg-core';

export const srsCards = pgTable('srs_cards', {
	cardHash: text('card_hash').primaryKey(),
	deckName: text('deck_name').notNull(),
	filePath: text('file_path').notNull(),
	familyHash: text('family_hash'),
	frontMarkdown: text('front_markdown').notNull(),
	backMarkdown: text('back_markdown').notNull(),
	cardType: text('card_type').notNull(),
	active: boolean('active').notNull().default(true),
	addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
	lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
	lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
	stability: doublePrecision('stability'),
	difficulty: doublePrecision('difficulty'),
	intervalRaw: doublePrecision('interval_raw'),
	intervalDays: integer('interval_days'),
	dueDate: date('due_date'),
	reviewCount: integer('review_count').notNull().default(0)
});

export const srsReviews = pgTable(
	'srs_reviews',
	{
		reviewId: bigserial('review_id', { mode: 'number' }).primaryKey(),
		reviewCardHash: text('review_card_hash').notNull(),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true }).notNull(),
		grade: text('grade').notNull(),
		stability: doublePrecision('stability').notNull(),
		difficulty: doublePrecision('difficulty').notNull(),
		intervalRaw: doublePrecision('interval_raw').notNull(),
		intervalDays: integer('interval_days').notNull(),
		dueDate: date('due_date').notNull()
	},
	(table) => [
		foreignKey({
			columns: [table.reviewCardHash],
			foreignColumns: [srsCards.cardHash],
			name: 'srs_reviews_review_card_hash_srs_cards_card_hash_fk'
		}).onDelete('cascade')
	]
);

export const schema = {
	srsCards,
	srsReviews
};

export const mdsrsCards = srsCards;
export const mdsrsReviews = srsReviews;

export type SrsCardRow = typeof srsCards.$inferSelect;
export type NewSrsCardRow = typeof srsCards.$inferInsert;
export type SrsReviewRow = typeof srsReviews.$inferSelect;
export type NewSrsReviewRow = typeof srsReviews.$inferInsert;

export type MdsrsCardRow = SrsCardRow;
export type NewMdsrsCardRow = NewSrsCardRow;
export type MdsrsReviewRow = SrsReviewRow;
export type NewMdsrsReviewRow = NewSrsReviewRow;
