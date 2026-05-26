# @mdsrs/postgres-drizzle

Postgres persistence adapter for the `@mdsrs/store` interface.

This package is driver-agnostic: pass a Drizzle Postgres database instance that
uses the exported `schema`.

```ts
import { createPostgresDrizzleStore, schema } from '@mdsrs/postgres-drizzle';

const store = createPostgresDrizzleStore(db);

await store.syncCards(cards);
const queue = await store.getDueCards(cards);
```

Run the SQL in `migrations/0000_initial.sql` before using the adapter.
