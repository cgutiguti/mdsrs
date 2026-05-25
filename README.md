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

## Design principles

- Markdown is the source of truth.
- Review state is adapter-owned data keyed by card hashes.
- The core package does no database IO and owns no UI framework.
- Given the same card content, prior performance, grade, and review time, scheduling is deterministic.
