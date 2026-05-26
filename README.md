# mdsrs

Markdown-native spaced repetition with deterministic, content-addressed cards.

`mdsrs` is a small TypeScript toolkit for building spaced repetition systems.
It is for apps where Markdown files are the source of truth, humans and agents
can edit those files directly, and review state is stored separately by card
hash.

The core idea is simple:

1. You write cards in plain Markdown.
2. `mdsrs` parses those cards and gives each card a stable hash.
3. Your app stores review progress by hash.
4. If the card text changes, the hash changes, so the edited card starts a new
   review history.

The library does not require a UI framework. You can use it with SvelteKit,
Next.js, Express, a command line app, a desktop app, or your own framework.

## Packages

- `@mdsrs/core`: parser, card model, hashes, deck tree helpers, review queue, and deterministic scheduling.
- `@mdsrs/fs`: loads a folder of Markdown files and media assets from disk.
- `@mdsrs/markdown`: renders card Markdown, math, images, audio, and video to safe HTML.
- `@mdsrs/store`: shared store interface and an in-memory store.
- `@mdsrs/postgres-drizzle`: Postgres store adapter using Drizzle.
- `@mdsrs/cli`: command line tools for initializing, checking, and exporting collections.

Install only the packages you need:

```sh
pnpm add @mdsrs/core
pnpm add @mdsrs/fs @mdsrs/markdown @mdsrs/store
pnpm add @mdsrs/postgres-drizzle drizzle-orm
pnpm add -D @mdsrs/cli
```

The published packages include built files and package metadata. They do not
include source tests, fixtures, or the example app.

## Start a Card Collection

Create a starter collection with the CLI:

```sh
pnpm dlx @mdsrs/cli init ./cards
```

This creates files like this:

```txt
cards/
  README.md
  cards/
    index.md
    example/
      concepts.md
      math.md
```

Check that the collection parses:

```sh
pnpm dlx @mdsrs/cli check ./cards
```

Export the parsed collection as JSON:

```sh
pnpm dlx @mdsrs/cli export ./cards --pretty
```

If a directory is not empty, `init` will refuse to write into it. Use `--force`
when you mean to add or overwrite the starter files:

```sh
pnpm dlx @mdsrs/cli init ./cards --force
```

## Card Format

A basic card uses `Q:` and `A:`.

```md
Q: What does mdsrs use as a stable card identity?
A: A SHA-256 hash of the normalized card content.
```

Separate cards with `---`.

```md
Q: What is the source of truth?
A: Markdown files.

---

Q: Where should review progress live?
A: In a store keyed by card hash.
```

A cloze card uses `C:`. Put the hidden part in square brackets.

```md
C: Editing card [content] changes its deterministic hash.
```

The front will hide the bracketed text. The back will show it.

One cloze line can produce more than one card:

```md
C: The [front] and [back] of a card are derived from Markdown.
```

Markdown is allowed inside cards:

```md
Q: What does `mdsrs check` do?
A: It parses the collection and prints a summary.
```

Math is allowed when you render with `@mdsrs/markdown`:

```md
Q: What is the derivative of $x^2$?
A: $2x$.
```

Media can be referenced with normal Markdown image syntax:

```md
Q: What does this graph show?
A: ![A graph](./assets/graph.svg)
```

Audio and video files also use image syntax. The renderer turns them into
`audio` or `video` elements based on the file extension:

```md
Q: What word is spoken?
A: ![Audio prompt](./audio/word.mp3)
```

## Folders and Decks

Folders become nested decks.

For this collection:

```txt
cards/
  index.md
  history/
    index.md
    art.md
  math/
    algebra.md
```

`mdsrs` will build deck paths like:

```txt
cards
cards/history
cards/history/art
cards/math/algebra
```

An `index.md` file contributes cards to the folder deck. A non-index Markdown
file becomes its own deck under the folder.

You can set a display name with simple frontmatter:

```md
---
name = "Art History"
---

Q: Who painted Las Meninas?
A: Diego Velazquez.
```

## Load Cards From Disk

Use `@mdsrs/fs` when your cards live in a folder.

```ts
import { loadCollection } from '@mdsrs/fs';

const collection = await loadCollection('./cards');

console.log(collection.rootPath);
console.log(collection.sources);
console.log(collection.cards);
console.log(collection.deckTree);
console.log(collection.assets);
```

Each card includes its hash, deck path, source file, front Markdown, and back
Markdown.

```ts
const card = collection.cards[0];

console.log(card.hash);
console.log(card.deckName);
console.log(card.filePath);
console.log(card.frontMarkdown);
console.log(card.backMarkdown);
```

## Parse Cards Without the Filesystem

Use `@mdsrs/core` directly if your Markdown comes from a database, API, editor,
or another source.

```ts
import { parseDeck } from '@mdsrs/core';

const cards = parseDeck({
	deckName: 'example/math',
	filePath: 'example/math.md',
	text: [
		'Q: What is 2 + 2?',
		'A: 4.',
		'',
		'---',
		'',
		'C: The additive identity is [0].'
	].join('\n')
});

console.log(cards.map((card) => card.hash));
```

## Render Cards

Use `@mdsrs/markdown` to render card faces to safe HTML.

```ts
import { renderCard } from '@mdsrs/markdown';

const rendered = renderCard(card, {
	resolveAsset: (url) => `/media/${url}`
});

console.log(rendered.frontHtml);
console.log(rendered.backHtml);
```

If you use KaTeX styles in a web app, load KaTeX CSS in your app:

```ts
import 'katex/dist/katex.min.css';
```

You can also render plain Markdown strings:

```ts
import { renderMarkdown } from '@mdsrs/markdown';

const html = renderMarkdown('Euler: $e^{i\\pi} + 1 = 0$');
```

## Review State

Cards are content. Review state is separate.

That separation is important. It means your Markdown files can live in Git, and
your app can store progress in memory, Postgres, SQLite, a server database, local
storage, or any other backend.

The shared store interface is called `SrsStore`. It has methods for syncing
cards, finding due cards, recording reviews, reading review history, and reading
stats.

## Use the Memory Store

The memory store is useful for tests, demos, local tools, and apps that want to
save their own snapshots.

```ts
import { loadCollection } from '@mdsrs/fs';
import { createMemoryStore } from '@mdsrs/store';

const collection = await loadCollection('./cards');
const store = createMemoryStore();

await store.syncCards(collection.cards);

const due = await store.getDueCards(collection.cards, {
	now: new Date(),
	limit: 20
});

const item = due[0];
if (item) {
	console.log(item.card.frontMarkdown);

	const result = await store.reviewCard(item.card.hash, 'good');
	console.log(result.dueDate);
}
```

Grades are:

```ts
type Grade = 'forgot' | 'hard' | 'good' | 'easy';
```

You can snapshot and restore the memory store:

```ts
const snapshot = store.snapshot();
const restored = createMemoryStore(snapshot);
```

## Use Postgres With Drizzle

Use `@mdsrs/postgres-drizzle` when you want review state in Postgres.

Install the runtime pieces:

```sh
pnpm add @mdsrs/postgres-drizzle @mdsrs/store @mdsrs/core drizzle-orm pg
```

Run the migration in your database:

```sql
-- from packages/postgres-drizzle/migrations/0000_initial.sql
CREATE TABLE IF NOT EXISTS "mdsrs_cards" (...);
CREATE TABLE IF NOT EXISTS "mdsrs_reviews" (...);
```

Create a Drizzle database and pass it to the adapter:

```ts
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createPostgresDrizzleStore, schema } from '@mdsrs/postgres-drizzle';
import { loadCollection } from '@mdsrs/fs';

const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL
});

const db = drizzle(pool, { schema });
const store = createPostgresDrizzleStore(db);

const collection = await loadCollection('./cards');
await store.syncCards(collection.cards);

const due = await store.getDueCards(collection.cards);
```

The Postgres adapter implements the same `SrsStore` contract as the memory
store. New store adapters should pass the same behavior tests.

## Build a Review Screen

The library does not prescribe a UI. A review flow usually looks like this:

```ts
const due = await store.getDueCards(collection.cards, {
	limit: 1,
	burySiblings: true
});

const review = due[0];

if (!review) {
	console.log('No cards due.');
} else {
	const rendered = renderCard(review.card);

	showFront(rendered.frontHtml);
	await waitForReveal();
	showBack(rendered.backHtml);

	const grade = await waitForGrade();
	await store.reviewCard(review.card.hash, grade);
}
```

`burySiblings` is enabled by default. It avoids showing multiple cloze siblings
from the same source text in one queue.

## Build a Browse Screen

Use the deck tree from `loadCollection`.

```ts
const collection = await loadCollection('./cards');

for (const deck of collection.deckTree) {
	console.log(deck.path);
	console.log(deck.name);
	console.log(deck.cardCount);
	console.log(deck.totalCardCount);
	console.log(deck.children);
}
```

To show cards for one deck:

```ts
const deckName = 'cards/example/math';
const cardsInDeck = collection.cards.filter((card) => card.deckName === deckName);
```

To show due cards for one deck:

```ts
const dueInDeck = await store.getDueCards(collection.cards, {
	deckName: 'cards/example/math'
});
```

## Deterministic Scheduling

Scheduling is deterministic. Given the same previous performance, grade, and
review time, `mdsrs` returns the same next due date.

```ts
import { scheduleReview } from '@mdsrs/core';

const next = scheduleReview(null, 'good', new Date('2026-01-01T00:00:00.000Z'));

console.log(next.intervalDays);
console.log(next.dueDate);
```

You can use the scheduler without any store:

```ts
const performance = {
	lastReviewedAt: null,
	stability: null,
	difficulty: null,
	intervalRaw: null,
	intervalDays: null,
	dueDate: null,
	reviewCount: 0
};

const result = scheduleReview(performance, 'easy');
```

## Command Line Reference

```sh
mdsrs init <root> [--force]
mdsrs check <root>
mdsrs export <root> [--pretty]
mdsrs help
```

`init` creates a starter collection.

`check` loads a collection and prints a summary.

`export` emits the parsed collection as JSON.

## Example App

The repo includes a small SvelteKit example in `examples/sveltekit`. It is not
required to use `mdsrs`. It is there to show one way to build browse and review
screens on top of the framework-agnostic packages.

Run it from the repo:

```sh
pnpm install
pnpm --filter @mdsrs/example-sveltekit dev
```

## Development

Install dependencies:

```sh
pnpm install
```

Run tests:

```sh
pnpm test
```

Run typechecks:

```sh
pnpm typecheck
```

Build all packages and the example app:

```sh
pnpm build
```

Run the Postgres integration test:

```sh
MDSRS_POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:5432/mdsrs_test \
	pnpm --filter @mdsrs/postgres-drizzle test:integration
```

## Design Principles

- Markdown is the source of truth.
- Review state is keyed by card hashes.
- Editing card content creates a new review identity.
- The parser and scheduler do not depend on a database or UI framework.
- Stores own persistence.
- Rendering is separate from parsing.
- The same cards and review events should produce the same schedule.
