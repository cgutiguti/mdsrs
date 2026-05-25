# mdsrs

Markdown-native spaced repetition with deterministic, content-addressed cards.

`mdsrs` is a small TypeScript toolkit for building spaced repetition systems where
Markdown files are the source of truth and persisted review state is keyed by card
content hashes.

## Packages

- `@mdsrs/core`: dependency-free parser, card model, deck tree helpers, hashing, and deterministic scheduling.

