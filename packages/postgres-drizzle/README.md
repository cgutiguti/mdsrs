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

## Integration Tests

The default test suite does not require a running database. To exercise this
adapter against real Postgres, set `MDSRS_POSTGRES_URL` and run:

```sh
pnpm --filter @mdsrs/postgres-drizzle test:integration
```

The integration test creates a temporary schema, runs the migration, and drops
the schema when it finishes.
