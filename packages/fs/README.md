# @mdsrs/fs

Node filesystem loader for Markdown card collections.

`@mdsrs/fs` turns a human-readable folder of Markdown files into the pure data
structures exposed by `@mdsrs/core`.

## Example

```ts
import { loadCollection, resolveContentAssetPath } from '@mdsrs/fs';

const collection = await loadCollection('./cards');
const assetPath = resolveContentAssetPath('biology/cells.md', './assets/cell.png');
```

## Folder conventions

- Every `*.md` file is parsed as a deck source.
- `index.md` contributes cards directly to its folder deck.
- Other Markdown files become child deck nodes below their folder.
- Frontmatter can set a human display name with `name = "..."`.
- Asset paths resolve relative to the Markdown file, while `@/` resolves from the collection root.
