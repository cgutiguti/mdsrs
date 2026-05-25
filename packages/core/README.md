# @mdsrs/core

Core primitives for Markdown-native spaced repetition.

This package contains:

- `parseDeck` and `parseCollection` for `Q:/A:` and `C:` Markdown cards.
- `hashCardContent` and `hashCardFamily` for content-addressed card identity.
- `scheduleReview` for deterministic FSRS-style scheduling.
- `buildReviewQueue` for due-card ordering and cloze sibling burial.
- `buildDeckTree` for human-readable deck navigation.

## Example

```ts
import { buildReviewQueue, parseCollection, scheduleReview } from '@mdsrs/core';

const cards = parseCollection([
	{
		deckName: 'Example',
		filePath: 'example.md',
		text: 'Q: What is the source of truth?\nA: Markdown.'
	}
]);

const queue = buildReviewQueue(cards, new Map());
const result = scheduleReview(queue[0]?.performance, 'good', new Date('2026-01-01T00:00:00.000Z'));
```

## Runtime note

`@mdsrs/core` currently uses Node's built-in `crypto` module for synchronous SHA-256 hashing.
The API is otherwise framework-agnostic and does not depend on a database, renderer, or web framework.
