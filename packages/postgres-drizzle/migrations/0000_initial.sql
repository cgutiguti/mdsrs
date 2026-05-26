CREATE TABLE IF NOT EXISTS "srs_cards" (
	"card_hash" text PRIMARY KEY NOT NULL,
	"deck_name" text NOT NULL,
	"file_path" text NOT NULL,
	"family_hash" text,
	"front_markdown" text NOT NULL,
	"back_markdown" text NOT NULL,
	"card_type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"stability" double precision,
	"difficulty" double precision,
	"interval_raw" double precision,
	"interval_days" integer,
	"due_date" date,
	"review_count" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "srs_reviews" (
	"review_id" bigserial PRIMARY KEY NOT NULL,
	"review_card_hash" text NOT NULL,
	"reviewed_at" timestamp with time zone NOT NULL,
	"grade" text NOT NULL,
	"stability" double precision NOT NULL,
	"difficulty" double precision NOT NULL,
	"interval_raw" double precision NOT NULL,
	"interval_days" integer NOT NULL,
	"due_date" date NOT NULL,
	CONSTRAINT "srs_reviews_review_card_hash_srs_cards_card_hash_fk"
		FOREIGN KEY ("review_card_hash")
		REFERENCES "srs_cards"("card_hash")
		ON DELETE cascade
		ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "srs_cards_active_due_idx"
	ON "srs_cards" ("active", "due_date");

CREATE INDEX IF NOT EXISTS "srs_reviews_card_hash_idx"
	ON "srs_reviews" ("review_card_hash");
