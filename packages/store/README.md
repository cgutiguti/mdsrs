# @mdsrs/store

Persistence interface and in-memory implementation for `mdsrs`.

`@mdsrs/store` defines the contract that durable adapters, such as a future
Postgres adapter, should implement.

## Example

```ts
import { createMemoryStore } from '@mdsrs/store';

const store = createMemoryStore();

await store.syncCards(cards);
const queue = await store.getDueCards(cards);
await store.reviewCard(queue[0].card.hash, 'good');
```
