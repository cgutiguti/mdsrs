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

export const mdsrsCards = pgTable('mdsrs_cards', {
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

export const mdsrsReviews = pgTable(
	'mdsrs_reviews',
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
			foreignColumns: [mdsrsCards.cardHash],
			name: 'mdsrs_reviews_review_card_hash_mdsrs_cards_card_hash_fk'
		}).onDelete('cascade')
	]
);

export const schema = {
	mdsrsCards,
	mdsrsReviews
};

export type MdsrsCardRow = typeof mdsrsCards.$inferSelect;
export type NewMdsrsCardRow = typeof mdsrsCards.$inferInsert;
export type MdsrsReviewRow = typeof mdsrsReviews.$inferSelect;
export type NewMdsrsReviewRow = typeof mdsrsReviews.$inferInsert;
