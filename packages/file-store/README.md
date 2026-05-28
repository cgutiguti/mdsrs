# @mdsrs/file-store

A local JSON-file backend for mdsrs.

Use this when you want durable reviews without running Postgres. It is a good fit
for command line tools, small personal apps, local-first prototypes, and tests.

```ts
import { createFileStore } from '@mdsrs/file-store';

const store = await createFileStore('.mdsrs/srs.json');

await store.syncCards(cards);
const queue = await store.getDueCards(cards);
await store.reviewCard(queue[0].card.hash, 'good');
```

The file contains a versioned snapshot of cards and reviews. Writes are atomic:
mdsrs writes a temporary file next to the database file and then renames it.

This store is meant for one local process at a time. If many users or processes
need to write reviews at the same time, use `@mdsrs/postgres-drizzle`.
