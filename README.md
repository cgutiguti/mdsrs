# mdsrs

Markdown-native spaced repetition with deterministic, content-addressed cards.

`mdsrs` is a small TypeScript toolkit for building spaced repetition systems where
Markdown files are the source of truth and persisted review state is keyed by card
content hashes.

## Card format

```md
Q: What does mdsrs use as a stable card identity?
A: A SHA-256 hash of the normalized card content.

---

C: Editing a card changes its [hash] and creates a new review identity.
```

## Packages

- `@mdsrs/core`: dependency-free parser, card model, deck tree helpers, hashing, and deterministic scheduling.
- `@mdsrs/store`: persistence interface plus an in-memory implementation.
- `@mdsrs/fs`: Node filesystem loader for Markdown card collections.
- `@mdsrs/markdown`: safe Markdown, math, and media rendering for card faces.
- `@mdsrs/cli`: command-line tools for checking and exporting card collections.

## Design principles

- Markdown is the source of truth.
- Review state is adapter-owned data keyed by card hashes.
- The core package does no database IO and owns no UI framework.
- Given the same card content, prior performance, grade, and review time, scheduling is deterministic.

## Loading a Folder

```ts
import { loadCollection } from '@mdsrs/fs';

const collection = await loadCollection('./cards');

console.log(collection.cards);
console.log(collection.deckTree);
```

## Rendering Card Faces

```ts
import { renderCard } from '@mdsrs/markdown';

const rendered = renderCard(collection.cards[0], {
	resolveAsset: (url) => `/assets/${url}`
});
```

## CLI

```sh
mdsrs check ./cards
mdsrs export ./cards --pretty
```
